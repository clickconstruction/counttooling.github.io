// @ts-check
'use strict';
/**
 * Unit tests for save-engine.js: createSaveEngine(ctx) with a fully stubbed
 * ctx. Stage 1 (keep-alive skip ladder + expiry routing; force-reload
 * decision) asserts against the engine's OWN Save Status log (Stage 2 moved
 * the log inside, so debug/skip breadcrumbs are engine events now, not ctx
 * spy calls). Stage 2 adds the log core (push/prune/clear + debug gating)
 * and the dirty core (markProjectDirty semantics: generation, first-dirty
 * stamp, throttled dirty event, backup kick, checkout-refresh gate).
 *
 * Pattern per line-metrics.test.js: assign the constants.js + save-utils.js
 * exports onto globalThis first (the engine reads them by bare name), then
 * require the engine.
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

Object.assign(globalThis, require('./constants.js'));
Object.assign(globalThis, require('./save-utils.js'));
// Local bindings for the keys this file asserts on (the globalThis assigns
// above feed the engine; the lint test-group doesn't know module globals).
const { GLOBAL_RELOAD_STAMP_KEY, PENDING_GLOBAL_RELOAD_STAMP_KEY, SAVE_STATUS_LOG_MS, SAVE_STATUS_LOG_VERBOSE_MS } = require('./constants.js');

// Browser-global stubs. `window` exists so the CLICKCOUNT_DEBUG_SAVE flag can
// toggle verbose mode per test; the caches-clear branch sees window.caches
// undefined and skips.
function freshLocalStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
let reloads = 0;
let deletedDbs = [];
globalThis.window = /** @type {any} */ ({});
globalThis.location = { reload: () => { reloads++; } };
globalThis.indexedDB = { deleteDatabase: (n) => { deletedDbs.push(n); } };

// idb.js storage-primitive stubs (the engine reads these classic-script
// globals bare; stubbing avoids fake-indexeddb here).
let idbPuts = [];
let idbRawEntry = null;
let idbDeletes = [];
globalThis.BACKUP_PDF_TO_INDEXEDDB = true;
globalThis.idbTakeoffBackupPut = async (...a) => { idbPuts.push(a); return { ok: true }; };
globalThis.idbTakeoffBackupGetRaw = async () => idbRawEntry;
globalThis.takeoffBackupDelete = async (id) => { idbDeletes.push(id); };
globalThis.pdfCacheGet = async () => null;

const { createSaveEngine } = require('./save-engine.js');

beforeEach(() => {
  globalThis.localStorage = freshLocalStorage();
  globalThis.window.CLICKCOUNT_DEBUG_SAVE = false;
  reloads = 0;
  deletedDbs = [];
  idbPuts = [];
  idbRawEntry = null;
  idbDeletes = [];
});

function makeCtx(overrides) {
  const calls = { expired: 0, backupKicks: 0, footerInvalidations: 0, setDirty: [], lastModified: [], refreshAt: [], clock: [] };
  const appSide = { autoSaveDirty: false, lastCheckoutRefreshAt: 0 };
  const ctx = {
    getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', isViewer: false, pages: [{}] }),
    getSupabase: () => ({ rpc: () => Promise.resolve({ data: {} }) }),
    isSupabaseEnabled: () => true,
    withTimeout: (p) => p,
    probeCheckoutLock: async () => ({ expired: false }),
    handleBackgroundCheckoutExpired: async () => { calls.expired++; },
    isAutoSaveSuspended: () => false,
    getLastCheckoutRefreshAt: () => appSide.lastCheckoutRefreshAt,
    getAutoSaveDirty: () => appSide.autoSaveDirty,
    setAutoSaveDirty: (v) => { appSide.autoSaveDirty = v; calls.setDirty.push(v); },
    setLastModifiedAt: (ms) => { calls.lastModified.push(ms); },
    invalidateFooterTotals: () => { calls.footerInvalidations++; },
    autosaveEventDetail: (extra) => JSON.stringify(extra || {}),
    isCheckoutExpiredAttention: () => false,
    setLastCheckoutRefreshAt: (ms) => { appSide.lastCheckoutRefreshAt = ms; calls.refreshAt.push(ms); },
    updateServerClockFromRpc: (d) => { calls.clock.push(d); },
    serverNowMs: () => Date.now(),
    noteSupabaseCallOk: () => { calls.supabaseOk = (calls.supabaseOk || 0) + 1; },
    perfLog: () => {},
    getUserCustomIcons: () => [],
    computePageBakeFrame: () => null,
    getLastModifiedAt: () => 0,
    ...overrides,
  };
  return { ctx, calls, appSide };
}

const logKinds = (engine) => engine.getSaveStatusLog().map((e) => e.kind);
const debugPhases = (engine) => engine.getSaveStatusLog().filter((e) => e.kind === 'debug').map((e) => e.message);

// --- Stage 2: Save Status log core ---------------------------------------

test('log core: push/get/clear round-trip; disabled Supabase drops events', () => {
  const { ctx } = makeCtx();
  const engine = createSaveEngine(ctx);
  engine.pushSaveEvent('x', 'msg', 'detail');
  assert.deepStrictEqual(logKinds(engine), ['x']);
  engine.clearSaveStatusLog();
  assert.deepStrictEqual(engine.getSaveStatusLog(), []);

  const off = createSaveEngine(makeCtx({ isSupabaseEnabled: () => false }).ctx);
  off.pushSaveEvent('x', 'msg');
  assert.deepStrictEqual(off.getSaveStatusLog(), []);
});

test('log core: verbose mode widens the prune window and gates saveDebugLog', () => {
  const { ctx } = makeCtx();
  const engine = createSaveEngine(ctx);
  assert.strictEqual(engine.getSaveStatusLogWindowMs(), SAVE_STATUS_LOG_MS);
  engine.saveDebugLog('quiet.phase', {});
  assert.deepStrictEqual(debugPhases(engine), []);
  globalThis.window.CLICKCOUNT_DEBUG_SAVE = true;
  assert.strictEqual(engine.getSaveStatusLogWindowMs(), SAVE_STATUS_LOG_VERBOSE_MS);
  engine.saveDebugLog('loud.phase', { a: 1 });
  assert.deepStrictEqual(debugPhases(engine), ['loud.phase']);
});

// --- Stage 2: dirty core ---------------------------------------------------

test('markProjectDirty: viewer / empty sessions are no-ops', () => {
  const a = makeCtx({ getState: () => ({ isViewer: true, pages: [{}], currentProjectId: 'p1' }) });
  const ea = createSaveEngine(a.ctx);
  ea.markProjectDirty();
  assert.strictEqual(ea.getDirtyGeneration(), 0);
  const b = makeCtx({ getState: () => ({ isViewer: false, pages: [], currentProjectId: null }) });
  const eb = createSaveEngine(b.ctx);
  eb.markProjectDirty();
  assert.strictEqual(eb.getDirtyGeneration(), 0);
});

test('markProjectDirty: sets dirty, bumps generation, stamps first-dirty once, kicks the debounced backup', async () => {
  const { ctx, calls, appSide } = makeCtx();
  const engine = createSaveEngine(ctx);
  engine.markProjectDirty();
  engine.markProjectDirty();
  assert.strictEqual(engine.getDirtyGeneration(), 2);
  assert.strictEqual(appSide.autoSaveDirty, true);
  assert.strictEqual(calls.footerInvalidations, 2);
  // The debounced (1s) backup fires once for the burst and lands in the idb stub.
  await new Promise((r) => setTimeout(r, 1300));
  assert.strictEqual(idbPuts.length, 1);
  assert.ok(engine.getLastLocalBackupOk());
  const stamp = engine.getDirtyStartedAt();
  assert.ok(stamp > 0);
  engine.markProjectDirty();
  assert.strictEqual(engine.getDirtyStartedAt(), stamp);   // not re-stamped while dirty
  engine.clearDirtyStartedAt();
  assert.strictEqual(engine.getDirtyStartedAt(), 0);
});

test('markProjectDirty: the dirty event is throttled to one per 2s window', () => {
  const { ctx } = makeCtx();
  const engine = createSaveEngine(ctx);
  engine.markProjectDirty();
  engine.markProjectDirty();
  engine.markProjectDirty();
  const dirtyEvents = logKinds(engine).filter((k) => k === 'dirty');
  assert.strictEqual(dirtyEvents.length, 1);
});

test('markProjectDirty: refreshes the checkout lock once per debounce window (holder only)', () => {
  let rpcCalls = 0;
  const supabase = { rpc: () => { rpcCalls++; return Promise.resolve({ data: { ok: true, checked_out_at: 'ts' } }); } };
  const { ctx, calls } = makeCtx({ getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.markProjectDirty();
  engine.markProjectDirty();   // within CHECKOUT_REFRESH_DEBOUNCE_MS -> no second rpc
  assert.strictEqual(rpcCalls, 1);
  assert.strictEqual(calls.refreshAt.length, 1);

  // A non-holder never refreshes.
  let rpc2 = 0;
  const other = makeCtx({
    getSupabase: () => ({ rpc: () => { rpc2++; return Promise.resolve({ data: {} }); } }),
    getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'someone-else', isViewer: false, pages: [{}] }),
  });
  createSaveEngine(other.ctx).markProjectDirty();
  assert.strictEqual(rpc2, 0);
});

test('resetDirtyTracking zeroes generation, stamp, and the event throttle', () => {
  const { ctx } = makeCtx();
  const engine = createSaveEngine(ctx);
  engine.markProjectDirty();
  engine.resetDirtyTracking();
  assert.strictEqual(engine.getDirtyGeneration(), 0);
  assert.strictEqual(engine.getDirtyStartedAt(), 0);
  engine.markProjectDirty();   // throttle stamp was reset -> a fresh dirty event logs
  assert.strictEqual(logKinds(engine).filter((k) => k === 'dirty').length, 2);
});

// --- Stage 3: storage ring --------------------------------------------------

test('backup writer: viewer and empty sessions never write', async () => {
  const a = makeCtx({ getState: () => ({ isViewer: true, pages: [{}], counters: [], lineTypes: [] }) });
  await createSaveEngine(a.ctx).writeTakeoffStateBackup();
  const b = makeCtx({ getState: () => ({ isViewer: false, pages: [], counters: [], lineTypes: [] }) });
  await createSaveEngine(b.ctx).writeTakeoffStateBackup();
  assert.strictEqual(idbPuts.length, 0);
});

test('backup writer: serializes the takeoff under the local key and stamps success', async () => {
  const state = {
    isViewer: false, currentProjectId: null, pdfBuffer: null, pdfHash: null,
    currentProjectName: null, supabaseSession: null,
    pages: [{ canvases: [{ id: 'c', name: 'Main', annotations: { counterMarkers: { x: [{}] } } }], scale: null, rotation: 0 }],
    counters: [{ id: 'x' }], lineTypes: [], groups: [],
    counterSettings: {}, lineTypeSettings: {}, exportSettings: {}, recentLineColors: [],
    iconNames: {}, iconOrder: null, legendSettings: {}, multiplyZoneSettings: {},
    showGridOverlay: false, gridSettings: null, activeCanvasIdByPage: {},
  };
  const { ctx } = makeCtx({ getState: () => state });
  const engine = createSaveEngine(ctx);
  assert.strictEqual(engine.getLastLocalBackupAt(), null);
  await engine.writeTakeoffStateBackup();
  assert.strictEqual(idbPuts.length, 1);
  const [projectId, data] = idbPuts[0];
  assert.strictEqual(projectId, 'local');
  assert.strictEqual(data.counters[0].id, 'x');
  assert.strictEqual(data.pageCanvases.length, 1);
  assert.ok(engine.getLastLocalBackupAt());
  assert.strictEqual(engine.getLastLocalBackupOk(), true);
  engine.resetLocalBackupState();
  assert.strictEqual(engine.getLastLocalBackupAt(), null);
});

test('takeoffBackupGet: cross-user entries are deleted and hidden', async () => {
  const { ctx } = makeCtx();
  const engine = createSaveEngine(ctx);
  idbRawEntry = { userId: 'someone-else', data: {} };
  assert.strictEqual(await engine.takeoffBackupGet('p1', 'u1'), null);
  assert.deepStrictEqual(idbDeletes, ['p1']);
  idbRawEntry = { userId: 'u1', data: { ok: 1 } };
  const entry = await engine.takeoffBackupGet('p1', 'u1');
  assert.strictEqual(entry.data.ok, 1);
});

test('probeCheckoutLock: non-holder reports expired; a healthy refresh stamps the clocks', async () => {
  const a = makeCtx({ getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'other' }) });
  const ra = await createSaveEngine(a.ctx).probeCheckoutLock();
  assert.strictEqual(ra.expired, true);

  const supabase = { rpc: async () => ({ data: { ok: true, checked_out_at: '2026-07-18T00:00:00Z' } }) };
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: null };
  const b = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const rb = await createSaveEngine(b.ctx).probeCheckoutLock();
  assert.deepStrictEqual(rb, { ok: true, refreshed: true });
  assert.strictEqual(state.checkedOutAt, '2026-07-18T00:00:00Z');
  assert.strictEqual(b.calls.supabaseOk, 1);
  assert.strictEqual(b.calls.refreshAt.length, 1);
});

// --- Stage 1: checkout keep-alive ------------------------------------------

test('keepalive: no client or disabled -> silent no-op', async () => {
  globalThis.window.CLICKCOUNT_DEBUG_SAVE = true;
  const a = makeCtx({ getSupabase: () => null });
  const ea = createSaveEngine(a.ctx);
  await ea.checkoutKeepalive();
  assert.deepStrictEqual(debugPhases(ea), []);
});

test('keepalive: viewer / suspended / debounced skip with logged reasons', async () => {
  globalThis.window.CLICKCOUNT_DEBUG_SAVE = true;
  const a = makeCtx({ getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', isViewer: true, pages: [{}] }) });
  const ea = createSaveEngine(a.ctx);
  await ea.checkoutKeepalive();
  assert.deepStrictEqual(debugPhases(ea), ['keepalive.skip']);

  const b = makeCtx({ isAutoSaveSuspended: () => true });
  const eb = createSaveEngine(b.ctx);
  await eb.checkoutKeepalive();
  assert.deepStrictEqual(debugPhases(eb), ['keepalive.skip']);

  let probed = 0;
  const c = makeCtx({ getLastCheckoutRefreshAt: () => Date.now(), probeCheckoutLock: async () => { probed++; return { expired: false }; } });
  const ec = createSaveEngine(c.ctx);
  await ec.checkoutKeepalive();
  assert.strictEqual(probed, 0);
  assert.deepStrictEqual(debugPhases(ec), ['keepalive.skip']);
});

test('keepalive: expired probe pushes keepalive_expired and routes background recovery; throws are contained', async () => {
  const a = makeCtx({ probeCheckoutLock: async () => ({ expired: true }) });
  const ea = createSaveEngine(a.ctx);
  await ea.checkoutKeepalive();
  assert.ok(logKinds(ea).includes('keepalive_expired'));
  assert.strictEqual(a.calls.expired, 1);

  const b = makeCtx({
    probeCheckoutLock: async () => ({ expired: true }),
    handleBackgroundCheckoutExpired: async () => { throw new Error('boom'); },
  });
  const eb = createSaveEngine(b.ctx);
  await eb.checkoutKeepalive();   // must not reject
  assert.ok(logKinds(eb).includes('background_recovery_threw'));
});

// --- Stage 1: global force reload ------------------------------------------

function supabaseWithStamp(valueTs) {
  const chain = {
    from: () => chain, select: () => chain, eq: () => chain,
    single: async () => ({ data: { value_ts: valueTs, value_text: 'maintenance' }, error: null }),
  };
  return chain;
}

test('force reload: disabled or signed-out never queries', async () => {
  let queried = 0;
  const supabase = { from: () => { queried++; return supabase; }, select: () => supabase, eq: () => supabase, single: async () => ({ data: null }) };
  const a = makeCtx({ isSupabaseEnabled: () => false, getSupabase: () => supabase });
  await createSaveEngine(a.ctx).checkGlobalForceReload();
  const b = makeCtx({ getState: () => ({ supabaseSession: null }), getSupabase: () => supabase });
  await createSaveEngine(b.ctx).checkGlobalForceReload();
  assert.strictEqual(queried, 0);
});

test('force reload: newer server stamp writes the pending stamp, drops the IDB cache, reloads', async () => {
  localStorage.setItem(GLOBAL_RELOAD_STAMP_KEY, '1000');
  const state = { supabaseSession: { user: { id: 'u1' } } };
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabaseWithStamp(new Date(5000).toISOString()) });
  const engine = createSaveEngine(ctx);
  await engine.checkGlobalForceReload();
  assert.strictEqual(reloads, 1);
  assert.deepStrictEqual(deletedDbs, ['clickcount-pdf-cache']);
  assert.strictEqual(localStorage.getItem(PENDING_GLOBAL_RELOAD_STAMP_KEY), '5000');
  assert.strictEqual(state.globalReloadReason, 'maintenance');
  assert.ok(logKinds(engine).includes('global_reload_triggered'));
});

test('force reload: stale server stamp records state but does not reload', async () => {
  localStorage.setItem(GLOBAL_RELOAD_STAMP_KEY, '9999999');
  const state = { supabaseSession: { user: { id: 'u1' } } };
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabaseWithStamp(new Date(5000).toISOString()) });
  await createSaveEngine(ctx).checkGlobalForceReload();
  assert.strictEqual(reloads, 0);
  assert.strictEqual(state.globalReloadAtServerMs, 5000);
});

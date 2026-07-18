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
const { GLOBAL_RELOAD_STAMP_KEY, PENDING_GLOBAL_RELOAD_STAMP_KEY, SAVE_STATUS_LOG_MS, SAVE_STATUS_LOG_VERBOSE_MS, CHECKOUT_INACTIVITY_MS } = require('./constants.js');

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
  const calls = {
    expired: 0, backupKicks: 0, footerInvalidations: 0, setDirty: [], lastModified: [], refreshAt: [], clock: [],
    // Stage 5 spies
    toasts: [], turnInLabels: [], progressHandlers: [], autosaves: [], uploads: [],
    attention: 0, cleared: 0, suspends: 0, uiUpdates: 0, statusUpdates: 0, indicatorUpdates: 0, settingsSection: 0, cloudFailFlag: [],
  };
  const appSide = { autoSaveDirty: false, lastCheckoutRefreshAt: 0 };
  const ctx = {
    getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', isViewer: false, pages: [{}] }),
    getSupabase: () => ({ rpc: () => Promise.resolve({ data: {} }) }),
    isSupabaseEnabled: () => true,
    withTimeout: (p) => (typeof p === 'function' ? p(undefined) : p),
    probeCheckoutLock: async () => ({ expired: false }),
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
    setSupabase: () => {},
    getSupabaseUrl: () => 'https://x.supabase.co',
    getSupabaseAnonKey: () => 'anon',
    getConsecutiveAutoSaveFailures: () => 0,
    clearAutoSaveBackoff: () => {},
    // Stage 5 (checkout UX)
    isSaveInProgress: () => false,
    getInFlightAutoSavePromise: () => null,
    getLastSuccessfulSupabaseCallAt: () => Date.now(),
    performAutoSave: async (runId) => { calls.autosaves.push(runId); return { ok: true }; },
    uploadLocalPdfToCloudIfNeeded: async (reason, opts) => { calls.uploads.push([reason, opts]); return { ok: true }; },
    setPdfUploadProgressHandler: (fn) => { calls.progressHandlers.push(fn); },
    setTurnInProgress: (label) => { calls.turnInLabels.push(label); },
    showToast: (msg, ms) => { calls.toasts.push(msg); },
    updateUI: () => { calls.uiUpdates++; },
    updateStatus: () => { calls.statusUpdates++; },
    updateSaveStatusIndicator: () => { calls.indicatorUpdates++; },
    updateSettingsCheckoutSection: () => { calls.settingsSection++; },
    clearCheckoutExpiredAttention: () => { calls.cleared++; },
    setCheckoutExpiredAttention: () => { calls.attention++; },
    suspendAutoSave: () => { calls.suspends++; },
    setLastCloudSaveAttemptFailed: (v) => { calls.cloudFailFlag.push(v); },
    captureNetworkInfoDetail: () => null,
    isAuthError: () => false,
    ...overrides,
  };
  return { ctx, calls, appSide };
}

// Supabase stub with a working realtime-channel chain for the Stage 5
// subscription cluster (channel().on().subscribe() + removeChannel).
function makeChannelSupabase(rpcImpl) {
  const sub = { channels: [], removed: [] };
  const supabase = {
    rpc: rpcImpl || (async () => ({ data: {} })),
    removeAllChannels: async () => {},
    removeChannel: async (ch) => { sub.removed.push(ch); },
    channel: (name) => {
      const ch = { name, ons: [], statusCb: null };
      ch.on = (type, filter, cb) => { ch.ons.push({ type, filter, cb }); return ch; };
      ch.subscribe = (cb) => { ch.statusCb = cb; return ch; };
      sub.channels.push(ch);
      return ch;
    },
  };
  return { supabase, sub };
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

// --- Stage 4: client resilience ---------------------------------------------

test('noteSupabaseJsFailure: 4xx and checkout-domain errors are ignored; real failures stamp', () => {
  const { ctx } = makeCtx();
  const engine = createSaveEngine(ctx);
  engine.noteSupabaseJsFailure('t', { status: 403 });
  engine.noteSupabaseJsFailure('t', { code: 'CHECKOUT_EXPIRED' });
  assert.strictEqual(engine.getLastSupabaseJsFailureAt(), 0);
  engine.noteSupabaseJsFailure('t', { message: 'socket hang up' });
  assert.ok(engine.getLastSupabaseJsFailureAt() > 0);
  assert.ok(logKinds(engine).includes('sbjs_failure_recorded'));
  engine.noteSupabaseJsFailure('t', { status: 408, message: 'timeout-ish' });   // 408 is NOT ignored
  assert.strictEqual(logKinds(engine).filter((k) => k === 'sbjs_failure_recorded').length, 2);
});

test('recreateSupabaseClient: swaps the client, resubscribes on the NEW client, counts; cooldown blocks a rerun', async () => {
  // createClient returns channel-capable clients: Stage 5 made the checkout
  // subscription engine-internal, so the recycle resubscribes through the
  // engine's own subscribeToProjectCheckoutChanges against the new client.
  const created = [];
  globalThis.window.supabase = { createClient: () => { const { supabase, sub } = makeChannelSupabase(); created.push({ client: supabase, sub }); return supabase; } };
  const initial = makeChannelSupabase();
  let current = initial.supabase;
  const state = { supabaseSession: { user: { id: 'u1' }, access_token: 'a', refresh_token: 'r' }, currentProjectId: 'p1' };
  const set = [];
  const { ctx } = makeCtx({
    getState: () => state,
    getSupabase: () => current,
    setSupabase: (c) => { current = c; set.push(c); },
  });
  const engine = createSaveEngine(ctx);
  const ok = await engine.recreateSupabaseClient('test');
  assert.strictEqual(ok, true);
  assert.strictEqual(set.length, 1);
  assert.strictEqual(set[0], created[0].client);
  // The resubscribe landed on the new client, keyed by the project id.
  assert.strictEqual(created[0].sub.channels.length, 1);
  assert.strictEqual(created[0].sub.channels[0].name, 'projects-checkout-p1');
  assert.strictEqual(engine.getClientRecycleCount(), 1);
  assert.ok(logKinds(engine).includes('autosave_client_recycled'));
  // Immediate rerun -> cooldown skip.
  const again = await engine.recreateSupabaseClient('test2');
  assert.strictEqual(again, false);
  assert.ok(logKinds(engine).includes('client_recycle_skipped_cooldown'));
  assert.strictEqual(engine.getClientRecycleCount(), 1);
  engine.resetRecycleState();
  assert.strictEqual(engine.getClientRecycleCount(), 0);
  delete globalThis.window.supabase;
});

test('runRecoveryProbeAndMaybeRecycle: healthy probe with zero failures stops before the client probe', async () => {
  let clientProbes = 0;
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null } });
  const { ctx } = makeCtx({
    getConsecutiveAutoSaveFailures: () => 0,
    getSupabase: () => ({ from: () => { clientProbes++; throw new Error('should not run'); } }),
    getSupabaseUrl: () => 'https://x.supabase.co',
    getSupabaseAnonKey: () => 'anon',
  });
  const engine = createSaveEngine(ctx);
  await engine.runRecoveryProbeAndMaybeRecycle('test');
  assert.strictEqual(clientProbes, 0);
  assert.ok(logKinds(engine).includes('autosave_recovery_ok'));
  delete globalThis.fetch;
});

test('rawProjectsInsert: missing token returns the RAW_INSERT_NO_TOKEN error shape', async () => {
  const { ctx } = makeCtx({
    getState: () => ({ supabaseSession: null }),
    getSupabaseUrl: () => 'https://x.supabase.co',
    getSupabaseAnonKey: () => 'anon',
  });
  const res = await createSaveEngine(ctx).rawProjectsInsert({}, undefined);
  assert.strictEqual(res.data, null);
  assert.strictEqual(res.error.code, 'RAW_INSERT_NO_TOKEN');
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
  // The default rpc stub answers refresh_checkout_activity with {} (no ok) ->
  // the internal probe reports expired -> the (now engine-internal) background
  // recovery runs: attention flagged, auto-recheckout attempted and blocked
  // (permissions never grant canCheckOut), one-shot toast shown.
  const a = makeCtx();
  const ea = createSaveEngine(a.ctx);
  await ea.checkoutKeepalive();
  assert.ok(logKinds(ea).includes('keepalive_expired'));
  assert.ok(logKinds(ea).includes('checkout_expired'));
  assert.strictEqual(a.calls.attention, 1);
  assert.ok(logKinds(ea).includes('auto_recheckout_blocked'));
  assert.strictEqual(a.calls.toasts.length, 1);

  const b = makeCtx({
    setCheckoutExpiredAttention: () => { throw new Error('boom'); },
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

// --- Stage 5: checkout subscription & permission refresh --------------------

// list_accessible_projects responder for the permission-refresh tests.
function rpcWithProjects(rows, outcomes) {
  return async (name) => {
    if (name === 'list_accessible_projects') return { data: rows };
    if (name === 'check_out_project') return outcomes?.checkOut || { data: { ok: true, checked_out_at: 'TS' } };
    if (name === 'check_in_project') return outcomes?.checkIn || { data: { ok: true } };
    return { data: {} };
  };
}

test('subscription: wires the postgres_changes channel; null projectId unsubscribes and resets', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1' };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  await engine.subscribeToProjectCheckoutChanges('p1');
  assert.strictEqual(sub.channels.length, 1);
  assert.strictEqual(sub.channels[0].name, 'projects-checkout-p1');
  assert.strictEqual(sub.channels[0].ons[0].filter.filter, 'id=eq.p1');
  // The UPDATE callback routes into refreshProjectPermissions; with an empty
  // project list that lands on the "no longer have access" path.
  await sub.channels[0].ons[0].cb();
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(calls.suspends, 1);
  assert.ok(logKinds(engine).includes('permissions_project_missing'));
  // Turn the subscription off: the stale channel is removed.
  await engine.subscribeToProjectCheckoutChanges(null);
  assert.strictEqual(sub.removed.length, 1);
});

test('refreshProjectPermissions: applies the project row and pings the UI', async () => {
  const row = { id: 'p1', can_edit: true, can_check_out: false, checked_out_by: 'u1', checked_out_at: 'TS', checked_out_email: 'me@x.com' };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', canCheckOut: false };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  await createSaveEngine(ctx).refreshProjectPermissions();
  assert.strictEqual(state.checkedOutBy, 'u1');
  assert.strictEqual(state.checkedOutEmail, 'me@x.com');
  assert.strictEqual(state.isViewer, false);
  assert.strictEqual(state.loadedViaViewLink, false);
  assert.ok(calls.uiUpdates >= 1);
  assert.ok(calls.statusUpdates >= 1);
  assert.deepStrictEqual(calls.toasts, []);
});

test('refreshProjectPermissions: force turn-in with dirty edits flushes once and warns', async () => {
  const row = { id: 'p1', can_edit: false, can_check_out: false, checked_out_by: 'u2', checked_out_email: 'other@x.com' };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', canCheckOut: false };
  const { ctx, calls, appSide } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  appSide.autoSaveDirty = true;
  const engine = createSaveEngine(ctx);
  await engine.refreshProjectPermissions();
  await new Promise((r) => setImmediate(r));   // the flush is fire-and-forget
  assert.strictEqual(calls.autosaves.length, 1);
  assert.ok(logKinds(engine).includes('force_turn_in'));
  assert.strictEqual(state.isViewer, true);
  assert.match(calls.toasts[0], /turned in by another user/);
});

// --- Stage 5: checkout expired recovery -------------------------------------

test('computeCheckoutExpiryAgeMs: no candidates -> 0; stale last-success dates the expiry', () => {
  const a = makeCtx({ getState: () => ({}), getLastSuccessfulSupabaseCallAt: () => 0 });
  assert.strictEqual(createSaveEngine(a.ctx).computeCheckoutExpiryAgeMs(), 0);
  const staleBy = 60000;
  const b = makeCtx({ getState: () => ({}), getLastSuccessfulSupabaseCallAt: () => Date.now() - CHECKOUT_INACTIVITY_MS - staleBy });
  const age = createSaveEngine(b.ctx).computeCheckoutExpiryAgeMs();
  assert.ok(age >= staleBy - 1000 && age <= staleBy + 5000, 'age ~= ' + staleBy + ', got ' + age);
  // A fresh last-success puts the expiry in the future -> clamped to 0.
  const c = makeCtx({ getState: () => ({}), getLastSuccessfulSupabaseCallAt: () => Date.now() });
  assert.strictEqual(createSaveEngine(c.ctx).computeCheckoutExpiryAgeMs(), 0);
});

test('reCheckOutAfterExpiry: success clears attention, retakes the lock, flushes dirty edits', async () => {
  const row = { id: 'p1', can_edit: true, can_check_out: false, checked_out_by: 'u1' };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: null, canCheckOut: true };
  const { ctx, calls, appSide } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  appSide.autoSaveDirty = true;
  const engine = createSaveEngine(ctx);
  const res = await engine.reCheckOutAfterExpiry('test_trigger');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls.cleared, 1);
  assert.strictEqual(state.checkedOutBy, 'u1');
  assert.strictEqual(state.isViewer, false);
  assert.strictEqual(calls.refreshAt.length, 1);
  assert.ok(logKinds(engine).includes('checkout_recovered'));
  assert.deepStrictEqual(calls.autosaves, ['checkout_recovered']);
  assert.match(calls.toasts[0], /Saving your edits/);
});

test('reCheckOutAfterExpiry: blocked by another holder reports otherEmail', async () => {
  const row = { id: 'p1', can_edit: true, can_check_out: false, checked_out_by: 'u2', checked_out_email: 'other@x.com' };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row], { checkOut: { data: { ok: false, error: 'held' } } }));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u2', checkedOutEmail: 'other@x.com' };
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  const res = await engine.reCheckOutAfterExpiry('test_trigger');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.otherEmail, 'other@x.com');
  assert.ok(logKinds(engine).includes('checkout_recover_blocked'));
});

test('tryAutoRecheckoutIfAllowed: skip ladder, per-project cap, and counter reset', async () => {
  const savedGap = globalThis.AUTO_RECHECKOUT_MIN_GAP_MS;
  const savedCap = globalThis.AUTO_RECHECKOUT_MAX_PER_PROJECT;
  globalThis.AUTO_RECHECKOUT_MIN_GAP_MS = 0;
  globalThis.AUTO_RECHECKOUT_MAX_PER_PROJECT = 2;
  try {
    const viewer = makeCtx({ getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', isViewer: true }) });
    const rv = await createSaveEngine(viewer.ctx).tryAutoRecheckoutIfAllowed('t');
    assert.deepStrictEqual(rv, { skipped: true, reason: 'viewer' });

    const row = { id: 'p1', can_edit: true, can_check_out: true, checked_out_by: null };
    const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
    const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: null, canCheckOut: true, isViewer: false };
    const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
    const engine = createSaveEngine(ctx);
    assert.strictEqual((await engine.tryAutoRecheckoutIfAllowed('t')).ok, true);
    assert.strictEqual((await engine.tryAutoRecheckoutIfAllowed('t')).ok, true);
    const capped = await engine.tryAutoRecheckoutIfAllowed('t');
    assert.deepStrictEqual(capped, { skipped: true, reason: 'cap_reached' });
    engine.resetAutoRecheckoutCounter('p1');
    assert.strictEqual((await engine.tryAutoRecheckoutIfAllowed('t')).ok, true);
  } finally {
    globalThis.AUTO_RECHECKOUT_MIN_GAP_MS = savedGap;
    globalThis.AUTO_RECHECKOUT_MAX_PER_PROJECT = savedCap;
  }
});

test('handleBackgroundCheckoutExpired: disabled no-op; silent recovery; one-shot toast re-armed by clear', async () => {
  const off = makeCtx({ isSupabaseEnabled: () => false });
  const ro = await createSaveEngine(off.ctx).handleBackgroundCheckoutExpired('t');
  assert.deepStrictEqual(ro, { silentlyRecovered: false, reason: 'supabase_disabled' });

  const savedGap = globalThis.AUTO_RECHECKOUT_MIN_GAP_MS;
  globalThis.AUTO_RECHECKOUT_MIN_GAP_MS = 0;
  try {
    // Recoverable: permissions grant canCheckOut and check_out succeeds. The
    // row flips to "held by me" once the checkout lands (so the trailing
    // permission refresh doesn't re-grant canCheckOut and toast a promotion).
    let held = false;
    const supabase = makeChannelSupabase(async (name) => {
      if (name === 'check_out_project') { held = true; return { data: { ok: true, checked_out_at: 'TS' } }; }
      if (name === 'list_accessible_projects') {
        return { data: [held
          ? { id: 'p1', can_edit: true, can_check_out: false, checked_out_by: 'u1' }
          : { id: 'p1', can_edit: true, can_check_out: true, checked_out_by: null }] };
      }
      return { data: {} };
    }).supabase;
    const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: null, canCheckOut: true, isViewer: false };
    const ok = makeCtx({ getState: () => state, getSupabase: () => supabase });
    const rOk = await createSaveEngine(ok.ctx).handleBackgroundCheckoutExpired('t');
    assert.deepStrictEqual(rOk, { silentlyRecovered: true });
    assert.strictEqual(ok.calls.attention, 1);
    assert.deepStrictEqual(ok.calls.toasts, []);

    // Unrecoverable (viewer): the expired toast fires exactly once until cleared.
    const v = makeCtx({ getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', isViewer: true }) });
    const ev = createSaveEngine(v.ctx);
    await ev.handleBackgroundCheckoutExpired('t');
    await ev.handleBackgroundCheckoutExpired('t');
    assert.strictEqual(v.calls.toasts.length, 1);
    ev.clearCheckoutExpiredToastShown();
    await ev.handleBackgroundCheckoutExpired('t');
    assert.strictEqual(v.calls.toasts.length, 2);
  } finally {
    globalThis.AUTO_RECHECKOUT_MIN_GAP_MS = savedGap;
  }
});

// --- Stage 5: Turn In core ---------------------------------------------------

test('doTurnIn: clean session releases the lock, stages the banner, and clears it', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', pages: [], counters: [], lineTypes: [], pdfStoragePath: null, isViewer: false };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  assert.strictEqual(engine.isTurnInInProgress(), false);
  const res = await engine.doTurnIn();
  assert.deepStrictEqual(res, { ok: true });
  assert.ok(logKinds(engine).includes('turn_in_start'));
  assert.ok(logKinds(engine).includes('turn_in_ok'));
  assert.strictEqual(calls.turnInLabels[calls.turnInLabels.length - 1], null);
  assert.strictEqual(engine.isTurnInInProgress(), false);
});

test('doTurnIn: dirty session flushes via performAutoSave while in-progress is held', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', pages: [], counters: [], lineTypes: [], pdfStoragePath: 'cloud/p.pdf', isViewer: false };
  let sawInProgress = null;
  const { ctx, calls, appSide } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  appSide.autoSaveDirty = true;
  const engine = createSaveEngine(ctx);
  ctx.performAutoSave = async () => { sawInProgress = engine.isTurnInInProgress(); return { ok: true }; };
  const res = await engine.doTurnIn();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(sawInProgress, true);
  assert.ok(logKinds(engine).some((k) => k === 'turn_in_stage'));
  assert.strictEqual(calls.turnInLabels[calls.turnInLabels.length - 1], null);
});

test('doTurnIn: CHECKOUT_EXPIRED from the pre-check-in save is surfaced as a code', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', pages: [], counters: [], lineTypes: [], pdfStoragePath: 'cloud/p.pdf', isViewer: false };
  const { ctx, appSide } = makeCtx({
    getState: () => state,
    getSupabase: () => supabase,
    performAutoSave: async () => ({ ok: false, error: { code: 'CHECKOUT_EXPIRED', message: 'expired' } }),
  });
  appSide.autoSaveDirty = true;
  const engine = createSaveEngine(ctx);
  const res = await engine.doTurnIn();
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'CHECKOUT_EXPIRED');
  assert.ok(logKinds(engine).includes('turn_in_blocked_by_save_err'));
});

test('doTurnIn: local-only PDF is uploaded with progress handler set and cleared', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', pages: [{ canvases: [] }], counters: [], lineTypes: [], pdfStoragePath: null, isViewer: false };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  const res = await engine.doTurnIn();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls.uploads.length, 1);
  assert.strictEqual(calls.uploads[0][0], 'turn_in');
  assert.strictEqual(calls.uploads[0][1].ignoreBackoff, true);
  assert.strictEqual(calls.progressHandlers.length, 2);
  assert.strictEqual(typeof calls.progressHandlers[0], 'function');
  assert.strictEqual(calls.progressHandlers[1], null);
});

test('doTurnIn: server-side already-released is treated as success', async () => {
  const err = { code: 'CHECKOUT_NOT_OWNED', message: 'You do not have this project checked out' };
  const { supabase } = makeChannelSupabase(rpcWithProjects([], { checkIn: { data: null, error: err } }));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', pages: [], counters: [], lineTypes: [], pdfStoragePath: null, isViewer: false };
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  const res = await engine.doTurnIn();
  assert.deepStrictEqual(res, { ok: true, releasedByServer: true });
  assert.ok(logKinds(engine).includes('turn_in_already_released'));
});

test('resetTurnInState clears the in-flight guard so a wedged flag cannot brick Turn In', async () => {
  const { ctx } = makeCtx();
  const engine = createSaveEngine(ctx);
  engine.resetTurnInState();
  assert.strictEqual(engine.isTurnInInProgress(), false);
});

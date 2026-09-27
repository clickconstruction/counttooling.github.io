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
const { GLOBAL_RELOAD_STAMP_KEY, PENDING_GLOBAL_RELOAD_STAMP_KEY, SAVE_STATUS_LOG_MS, SAVE_STATUS_LOG_VERBOSE_MS, CHECKOUT_INACTIVITY_MS, SELF_RELEASE_GRACE_MS } = require('./constants.js');

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
// Stage 6: updateSyncPausedBanner (engine-internal) reaches for the banner
// element; keepalive gates on visibilityState. A null-returning stub keeps
// both honest under node.
globalThis.document = /** @type {any} */ ({ getElementById: () => null, visibilityState: 'visible' });

// idb.js storage-primitive stubs (the engine reads these classic-script
// globals bare; stubbing avoids fake-indexeddb here).
let idbPuts = [];
let idbRawEntry = null;
let idbDeletes = [];
globalThis.BACKUP_PDF_TO_INDEXEDDB = true;
globalThis.idbTakeoffBackupPut = async (...a) => { idbPuts.push(a); return { ok: true }; };
globalThis.idbTakeoffBackupGetRaw = async () => idbRawEntry;
globalThis.takeoffBackupDelete = async (id) => { idbDeletes.push(id); };
let cacheClears = 0;
globalThis.idbClearCachesKeepTakeoffBackups = async () => { cacheClears++; return true; };
globalThis.pdfCacheGet = async () => null;

const { createSaveEngine } = require('./save-engine.js');

beforeEach(() => {
  globalThis.localStorage = freshLocalStorage();
  globalThis.window.CLICKCOUNT_DEBUG_SAVE = false;
  reloads = 0;
  deletedDbs = [];
  cacheClears = 0;
  idbPuts = [];
  idbRawEntry = null;
  idbDeletes = [];
  // Stage 6: the save paths run engine-internal now. The recovery probe
  // (doTurnIn pre-probe with a 0 last-success stamp) needs a healthy fetch,
  // and performSaveProjectToCloud's yield helper needs requestAnimationFrame.
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => '' });
  globalThis.requestAnimationFrame = (cb) => { cb(); return 0; };
});

function makeCtx(overrides) {
  const calls = {
    expired: 0, backupKicks: 0, footerInvalidations: 0, lastModified: [], refreshAt: [], clock: [],
    // Stage 5/6 spies
    toasts: [], turnInLabels: [], includedPdf: [],
    attention: 0, cleared: 0, suspends: 0, uiUpdates: 0, statusUpdates: 0, indicatorUpdates: 0, settingsSection: 0,
  };
  const appSide = { lastCheckoutRefreshAt: 0 };
  const ctx = {
    getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', isViewer: false, pages: [{}] }),
    getSupabase: () => ({ rpc: () => Promise.resolve({ data: {} }) }),
    isSupabaseEnabled: () => true,
    withTimeout: (p) => (typeof p === 'function' ? p(undefined) : p),
    probeCheckoutLock: async () => ({ expired: false }),
    isAutoSaveSuspended: () => false,
    getLastCheckoutRefreshAt: () => appSide.lastCheckoutRefreshAt,
    setLastModifiedAt: (ms) => { calls.lastModified.push(ms); },
    invalidateFooterTotals: () => { calls.footerInvalidations++; },
    isCheckoutExpiredAttention: () => false,
    // Dormant by default like production (app.js ?ff=self-release); the
    // self-release tests opt in.
    isSelfReleaseStampEnabled: () => false,
    setLastCheckoutRefreshAt: (ms) => { appSide.lastCheckoutRefreshAt = ms; calls.refreshAt.push(ms); },
    updateServerClockFromRpc: (d) => { calls.clock.push(d); },
    serverNowMs: () => Date.now(),
    getServerClockOffsetMs: () => 0,
    perfLog: () => {},
    getUserCustomIcons: () => [],
    computePageBakeFrame: () => null,
    getLastModifiedAt: () => 0,
    getMaxZoom: () => 4,
    setSupabase: () => {},
    getSupabaseUrl: () => 'https://x.supabase.co',
    getSupabaseAnonKey: () => 'anon',
    assertPdfWithinLimit: () => null,
    maybeLogProjectSaveEvent: () => {},
    captureDisplayInfoObj: () => null,
    setLastSaveIncludedPdf: (v) => { calls.includedPdf.push(v); },
    setTurnInProgress: (label) => { calls.turnInLabels.push(label); },
    showToast: (msg, ms) => { calls.toasts.push(msg); },
    updateUI: () => { calls.uiUpdates++; },
    updateStatus: () => { calls.statusUpdates++; },
    updateSaveStatusIndicator: () => { calls.indicatorUpdates++; },
    updateSettingsCheckoutSection: () => { calls.settingsSection++; },
    clearCheckoutExpiredAttention: () => { calls.cleared++; },
    setCheckoutExpiredAttention: () => { calls.attention++; },
    suspendAutoSave: () => { calls.suspends++; },
    isAuthError: () => false,
    ...overrides,
  };
  return { ctx, calls, appSide };
}

// Supabase stub with a working realtime-channel chain for the Stage 5
// subscription cluster (channel().on().subscribe() + removeChannel), plus a
// from()/update()/eq()/abortSignal() chain for the Stage 6 save paths.
// opts.updateResult overrides the projects.update outcome ({ error }).
function makeChannelSupabase(rpcImpl, opts) {
  opts = opts || {};
  const sub = { channels: [], removed: [], updates: [] };
  const supabase = {
    rpc: rpcImpl || (async () => ({ data: {} })),
    removeAllChannels: async () => {},
    removeChannel: async (ch) => { sub.removed.push(ch); },
    from: (table) => ({
      update: (payload) => ({
        eq: () => {
          sub.updates.push({ table, payload });
          const result = Promise.resolve(opts.updateResult || { error: null });
          return Object.assign(result, { abortSignal: () => result });
        },
      }),
      select: () => ({ eq: () => ({ single: async () => ({ data: opts.selectRow || null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    storage: { from: () => ({ info: async () => ({ data: null }), upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
    auth: { getSession: async () => ({ data: { session: null } }) },
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
  const { ctx, calls } = makeCtx();
  const engine = createSaveEngine(ctx);
  engine.markProjectDirty();
  engine.markProjectDirty();
  assert.strictEqual(engine.getDirtyGeneration(), 2);
  assert.strictEqual(engine.getAutoSaveDirty(), true);
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
    pages: [{ label: 'P-101 Underground', canvases: [{ id: 'c', name: 'Main', annotations: { counterMarkers: { x: [{}] } } }], scale: null, rotation: 0 }],
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
  assert.deepStrictEqual(data.pageLabels, ['P-101 Underground']);
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
  const eb = createSaveEngine(b.ctx);
  assert.strictEqual(eb.getLastSuccessfulSupabaseCallAt(), 0);
  const rb = await eb.probeCheckoutLock();
  assert.deepStrictEqual(rb, { ok: true, refreshed: true });
  assert.strictEqual(state.checkedOutAt, '2026-07-18T00:00:00Z');
  assert.ok(eb.getLastSuccessfulSupabaseCallAt() > 0);   // noteSupabaseCallOk (engine-internal since Stage 6)
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

test('force reload: newer server stamp writes the pending stamp, clears the caches (keeping the takeoff backups), reloads', async () => {
  localStorage.setItem(GLOBAL_RELOAD_STAMP_KEY, '1000');
  const state = { supabaseSession: { user: { id: 'u1' } } };
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabaseWithStamp(new Date(5000).toISOString()) });
  const engine = createSaveEngine(ctx);
  await engine.checkGlobalForceReload();
  assert.strictEqual(reloads, 1);
  // never deleteDatabase: that took the takeoff backups (work that is not in the cloud) with it
  assert.deepStrictEqual(deletedDbs, []);
  assert.strictEqual(cacheClears, 1);
  assert.strictEqual(localStorage.getItem(PENDING_GLOBAL_RELOAD_STAMP_KEY), '5000');
  assert.strictEqual(state.globalReloadReason, 'maintenance');
  assert.ok(logKinds(engine).includes('global_reload_triggered'));
});

test('force reload: a browser with no stamp adopts the server stamp and does NOT reload (first sign-in keeps the takeoff)', async () => {
  const state = { supabaseSession: { user: { id: 'u1' } } };
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabaseWithStamp(new Date(5000).toISOString()) });
  const engine = createSaveEngine(ctx);
  await engine.checkGlobalForceReload();
  assert.strictEqual(reloads, 0);
  assert.strictEqual(cacheClears, 0);
  assert.deepStrictEqual(deletedDbs, []);
  assert.strictEqual(localStorage.getItem(GLOBAL_RELOAD_STAMP_KEY), '5000');
  assert.strictEqual(localStorage.getItem(PENDING_GLOBAL_RELOAD_STAMP_KEY), null);
  assert.ok(logKinds(engine).includes('global_reload_baseline'));
  // a broadcast made AFTER the baseline still reloads this browser
  const later = makeCtx({ getState: () => state, getSupabase: () => supabaseWithStamp(new Date(9000).toISOString()) });
  await createSaveEngine(later.ctx).checkGlobalForceReload();
  assert.strictEqual(reloads, 1);
  assert.strictEqual(cacheClears, 1);
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

// PostgREST's answer for an RPC the schema cache does not hold (supabase-js
// surfaces it as a PostgrestError; the raw fetch sees a 404 with this body).
const PGRST202 = { code: 'PGRST202', message: 'Could not find the function public.get_project_permissions(p_project_id) in the schema cache', details: null, hint: null };

// list_accessible_projects responder for the permission-refresh tests.
// get_project_permissions answers missing (PGRST202, the way prod did before
// MAP-PERMS's migration was applied on 2026-09-27) so these tests keep walking
// the list fallback while it stays, unless outcomes.lean opts in to the lean
// read, which filters the same rows to the asked project.
function rpcWithProjects(rows, outcomes) {
  return async (name, args) => {
    if (name === 'get_project_permissions') {
      if (!outcomes?.lean) return { data: null, error: PGRST202, status: 404 };
      return { data: rows.filter((r) => r.id === args?.p_project_id), error: null };
    }
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
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', canCheckOut: false, isViewer: false, pages: [] };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));   // the flush is fire-and-forget
  // The flush ran through the (engine-internal) performAutoSave against the
  // stubbed projects.update chain.
  assert.ok(logKinds(engine).includes('autosave_start'));
  assert.strictEqual(sub.updates.length, 1);
  assert.ok(logKinds(engine).includes('force_turn_in'));
  assert.strictEqual(state.isViewer, true);
  assert.match(calls.toasts[0], /turned in by another user/);
});

test('refreshProjectPermissions: notifyForceTurnedIn hook gets hadDirty and suppresses the toast fallback', async () => {
  const row = { id: 'p1', can_edit: false, can_check_out: true, checked_out_by: null, checked_out_email: null };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const notices = [];
  const run = async (dirty) => {
    const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', canCheckOut: false, isViewer: false, pages: [] };
    const { ctx, calls } = makeCtx({
      getState: () => state,
      getSupabase: () => supabase,
      notifyForceTurnedIn: (info) => { notices.push(info); return true; },
    });
    const engine = createSaveEngine(ctx);
    engine.setAutoSaveDirty(dirty);
    await engine.refreshProjectPermissions();
    await new Promise((r) => setTimeout(r, 20));
    return { calls, engine };
  };
  const clean = await run(false);
  assert.deepStrictEqual(notices, [{ hadDirty: false }]);
  assert.deepStrictEqual(clean.calls.toasts, [], 'modal handled it — no toast');
  assert.ok(logKinds(clean.engine).includes('force_turn_in'));
  const dirty = await run(true);
  assert.deepStrictEqual(notices[1], { hadDirty: true });
  assert.deepStrictEqual(dirty.calls.toasts, [], 'modal handled the dirty variant too');
});

test('refreshProjectPermissions: an expired self-attributed lock is expiry, not a force — and cannot re-fire', async () => {
  // The RPC keeps checked_out_by = me on an EXPIRED lock while can_edit goes
  // false (field report 2026-09-01: the turn-in notice "keeps coming back").
  const staleAt = new Date(Date.now() - CHECKOUT_INACTIVITY_MS - 60000).toISOString();
  const row = { id: 'p1', can_edit: false, can_check_out: true, checked_out_by: 'u1', checked_out_at: staleAt, checked_out_email: 'me@x.com' };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: staleAt, canCheckOut: false, isViewer: false, pages: [] };
  const notices = [];
  const { ctx } = makeCtx({
    getState: () => state,
    getSupabase: () => supabase,
    notifyForceTurnedIn: (info) => { notices.push(info); return true; },
  });
  const engine = createSaveEngine(ctx);
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(notices, [], 'expiry must not claim an admin force');
  assert.ok(logKinds(engine).includes('checkout_expired_on_refresh'));
  assert.ok(logKinds(engine).includes('checkout_expired'), 'routed to the expiry machinery');
  assert.strictEqual(state.checkedOutBy, null, 'stale self-attribution normalized');
  assert.strictEqual(state.isViewer, true);
  // Second refresh with the same row: the was-checked-out edge is disarmed.
  const expiredEvents = () => logKinds(engine).filter((k) => k === 'checkout_expired_on_refresh').length;
  const before = expiredEvents();
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(expiredEvents(), before, 'no re-fire on the next refresh');
  assert.deepStrictEqual(notices, []);
});

test('refreshProjectPermissions: a stale lock taken by someone else is still expiry, not a force', async () => {
  const staleAt = new Date(Date.now() - CHECKOUT_INACTIVITY_MS - 60000).toISOString();
  const row = { id: 'p1', can_edit: false, can_check_out: false, checked_out_by: 'u2', checked_out_at: new Date().toISOString(), checked_out_email: 'other@x.com' };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: staleAt, canCheckOut: false, isViewer: false, pages: [] };
  const notices = [];
  const { ctx } = makeCtx({
    getState: () => state,
    getSupabase: () => supabase,
    notifyForceTurnedIn: (info) => { notices.push(info); return true; },
  });
  const engine = createSaveEngine(ctx);
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(notices, [], 'expired-then-claimed is not an admin force');
  assert.ok(logKinds(engine).includes('checkout_expired_on_refresh'));
  assert.strictEqual(state.checkedOutEmail, 'other@x.com', 'the new holder is shown');
});

// --- Self-release stamp (field report 2026-09-15) --------------------------
// Our own check_in_project reaches the tab as a row UPDATE with the exact
// "was editor, now viewer, lock not stale" shape of an external force. The
// Turn In button's own tab was getting the "an admin turned this project in"
// notice after EVERY release (reproduced on prod-identical code, test
// account). doTurnIn stamps the release; refreshProjectPermissions inside
// SELF_RELEASE_GRACE_MS is ours. Ships DORMANT behind app.js's
// ?ff=self-release (ctx.isSelfReleaseStampEnabled) until _TODO.md R1-FLIP.

test('refreshProjectPermissions: the refresh after our own doTurnIn is not a force (no notice, no toast)', async () => {
  // The row the server shows right after OUR check_in_project: lock cleared,
  // we can claim it again. Fresh stamp on our side (we were the holder a
  // moment ago).
  const row = { id: 'p1', can_edit: false, can_check_out: true, checked_out_by: null, checked_out_at: null, checked_out_email: null };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: new Date().toISOString(), canCheckOut: false, isViewer: false, pages: [], counters: [], lineTypes: [], pdfStoragePath: null };
  const notices = [];
  const { ctx, calls } = makeCtx({
    getState: () => state,
    getSupabase: () => supabase, isSelfReleaseStampEnabled: () => true,
    notifyForceTurnedIn: (info) => { notices.push(info); return true; },
  });
  const engine = createSaveEngine(ctx);
  const res = await engine.doTurnIn();
  assert.deepStrictEqual(res, { ok: true });
  // Both refreshes the real app runs land inside the grace window: the
  // realtime UPDATE callback and doTurnInAndHandleResult's own refresh.
  await engine.refreshProjectPermissions();
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(notices, [], 'our own turn-in must not open the force notice');
  assert.ok(!logKinds(engine).includes('force_turn_in'), 'not classified as a force');
  assert.ok(!logKinds(engine).includes('checkout_expired_on_refresh'), 'not classified as expiry either');
  assert.ok(logKinds(engine).includes('self_release_refresh'), 'recorded as our own release');
  assert.deepStrictEqual(calls.toasts, [], 'the caller already said "Project turned in."');
  assert.strictEqual(state.isViewer, true);
  assert.strictEqual(state.canCheckOut, true, 'the banner offers Check out to Edit again');
  assert.strictEqual(state.checkedOutBy, null);
});

test('refreshProjectPermissions: the app-side check-in (close / load another / sign-out) stamps too', async () => {
  const row = { id: 'p1', can_edit: false, can_check_out: true, checked_out_by: null, checked_out_at: null, checked_out_email: null };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: new Date().toISOString(), canCheckOut: false, isViewer: false, pages: [] };
  const notices = [];
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase, isSelfReleaseStampEnabled: () => true, notifyForceTurnedIn: (info) => { notices.push(info); return true; } });
  const engine = createSaveEngine(ctx);
  engine.noteSelfRelease();   // what checkInCurrentProjectIfHeld does on data.ok
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(notices, []);
  assert.ok(logKinds(engine).includes('self_release_refresh'));
  assert.ok(!logKinds(engine).includes('force_turn_in'));
});

test('refreshProjectPermissions: the stamp does not leak across projects — releasing A never covers a force on B', async () => {
  // Release A (stamped), then open and check out B inside the 15s window and
  // have an admin force B. The stamp is time-based, so without a project
  // scope B's genuine force would be swallowed and the estimator silently
  // demoted with no notice on a project they never released.
  const rowB = { id: 'p2', can_edit: false, can_check_out: true, checked_out_by: null, checked_out_at: null, checked_out_email: null };
  const { supabase } = makeChannelSupabase(rpcWithProjects([rowB]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: new Date().toISOString(), canCheckOut: false, isViewer: false, pages: [] };
  const notices = [];
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase, isSelfReleaseStampEnabled: () => true, notifyForceTurnedIn: (info) => { notices.push(info); return true; } });
  const engine = createSaveEngine(ctx);
  engine.noteSelfRelease();                 // we let go of A, moments ago
  state.currentProjectId = 'p2';            // ...then opened and checked out B
  state.checkedOutBy = 'u1';
  state.checkedOutAt = new Date().toISOString();
  await engine.refreshProjectPermissions(); // B's live lock cleared by an admin
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(notices.length, 1, 'a force on B still tells the user');
  assert.ok(logKinds(engine).includes('force_turn_in'), 'classified as a force, not our release');
  assert.ok(!logKinds(engine).includes('self_release_refresh'), "A's stamp must not cover B");
});

test('refreshProjectPermissions: the self-release window closes — the same row later IS a force', async () => {
  // Same released row, but our stamp has aged past SELF_RELEASE_GRACE_MS:
  // someone else (an admin, or another session as us) cleared a LIVE lock.
  const row = { id: 'p1', can_edit: false, can_check_out: true, checked_out_by: null, checked_out_at: null, checked_out_email: null };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: new Date().toISOString(), canCheckOut: false, isViewer: false, pages: [] };
  const notices = [];
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase, isSelfReleaseStampEnabled: () => true, notifyForceTurnedIn: (info) => { notices.push(info); return true; } });
  const engine = createSaveEngine(ctx);
  engine.noteSelfRelease(Date.now() - SELF_RELEASE_GRACE_MS - 1);
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(notices, [{ hadDirty: false }], 'outside the window the classifier is unchanged');
  assert.ok(logKinds(engine).includes('force_turn_in'));
  assert.ok(!logKinds(engine).includes('self_release_refresh'));
});

test('refreshProjectPermissions: a dirty flag at our own release is not flushed over the released lock', async () => {
  const row = { id: 'p1', can_edit: false, can_check_out: true, checked_out_by: null, checked_out_at: null, checked_out_email: null };
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: new Date().toISOString(), canCheckOut: false, isViewer: false, pages: [] };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase, isSelfReleaseStampEnabled: () => true, notifyForceTurnedIn: () => true });
  const engine = createSaveEngine(ctx);
  engine.noteSelfRelease();
  engine.setAutoSaveDirty(true);
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(sub.updates.length, 0, 'no flush attempted against a lock we gave up');
  assert.ok(logKinds(engine).includes('self_release_flush_skipped'));
  assert.ok(!logKinds(engine).includes('autosave_start'));
  assert.deepStrictEqual(calls.toasts, []);
});

test('refreshProjectPermissions: with the self-release flag OFF, our own turn-in still classifies as before (the dormant ship)', async () => {
  // Pins the pre-flip behavior so the flag is provably a no-op until R1-FLIP:
  // same row, same stamp, flag off → the force branch fires exactly as it
  // did before 2026-09-15 (the bug the tester is verifying the fix for).
  const row = { id: 'p1', can_edit: false, can_check_out: true, checked_out_by: null, checked_out_at: null, checked_out_email: null };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: new Date().toISOString(), canCheckOut: false, isViewer: false, pages: [] };
  const notices = [];
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase, notifyForceTurnedIn: (info) => { notices.push(info); return true; } });
  const engine = createSaveEngine(ctx);
  engine.noteSelfRelease();
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(notices, [{ hadDirty: false }], 'flag off: unchanged (misclassified) behavior');
  assert.ok(logKinds(engine).includes('force_turn_in'));
  assert.ok(!logKinds(engine).includes('self_release_refresh'));
});


test('refreshProjectPermissions: a live lock externally cleared IS a force — notice fires', async () => {
  const freshAt = new Date(Date.now() - 60000).toISOString();
  const row = { id: 'p1', can_edit: false, can_check_out: true, checked_out_by: null, checked_out_at: null, checked_out_email: null };
  const { supabase } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', checkedOutAt: freshAt, canCheckOut: false, isViewer: false, pages: [] };
  const notices = [];
  const { ctx } = makeCtx({
    getState: () => state,
    getSupabase: () => supabase,
    notifyForceTurnedIn: (info) => { notices.push(info); return true; },
  });
  const engine = createSaveEngine(ctx);
  await engine.refreshProjectPermissions();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(notices, [{ hadDirty: false }]);
  assert.ok(logKinds(engine).includes('force_turn_in'));
  assert.ok(!logKinds(engine).includes('checkout_expired_on_refresh'));
});

// --- MAP-PERMS: the lean permissions read, behind a list fallback ------------

test('refreshProjectPermissions: the lean RPC answers, its row is applied, the list is never read', async () => {
  const row = { id: 'p1', can_edit: true, can_check_out: false, checked_out_by: 'u1', checked_out_at: 'TS', checked_out_email: 'me@x.com' };
  const names = [];
  const lean = rpcWithProjects([row, { id: 'p2', can_edit: false }], { lean: true });
  const { supabase } = makeChannelSupabase(async (name, args) => { names.push([name, args]); return lean(name, args); });
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', canCheckOut: false };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  await engine.refreshProjectPermissions();
  assert.deepStrictEqual(names, [['get_project_permissions', { p_project_id: 'p1' }]]);
  assert.strictEqual(state.checkedOutBy, 'u1');
  assert.strictEqual(state.checkedOutAt, 'TS');
  assert.strictEqual(state.checkedOutEmail, 'me@x.com');
  assert.strictEqual(state.isViewer, false);
  assert.strictEqual(state.canCheckOut, false);
  assert.ok(calls.uiUpdates >= 1);
  assert.ok(!logKinds(engine).includes('permissions_rpc_missing'));
  assert.ok(!logKinds(engine).includes('sbjs_failure_recorded'));
  // No row = no access, the same verdict the list's missing row gave.
  state.currentProjectId = 'p9';
  await engine.refreshProjectPermissions();
  assert.ok(logKinds(engine).includes('permissions_project_missing'));
  assert.strictEqual(state.isViewer, true);
  assert.ok(!names.some(([n]) => n === 'list_accessible_projects'));
});

test('refreshProjectPermissions: a missing lean RPC (PGRST202) falls back to the list once, latches, and a client recycle clears the latch', async () => {
  const row = { id: 'p1', can_edit: true, can_check_out: false, checked_out_by: 'u1', checked_out_at: 'TS', checked_out_email: 'me@x.com' };
  const names = [];
  const missing = rpcWithProjects([row]);
  const { supabase } = makeChannelSupabase(async (name, args) => { names.push(name); return missing(name, args); });
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', canCheckOut: false };
  let current = supabase;
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => current, setSupabase: (c) => { current = c; } });
  const engine = createSaveEngine(ctx);
  await engine.refreshProjectPermissions();
  assert.deepStrictEqual(names, ['get_project_permissions', 'list_accessible_projects']);
  assert.strictEqual(state.checkedOutEmail, 'me@x.com');
  assert.strictEqual(state.isViewer, false);
  // A clean server answer, not a wedged client: raw fetch is not preferred.
  assert.ok(!logKinds(engine).includes('sbjs_failure_recorded'));
  assert.strictEqual(logKinds(engine).filter((k) => k === 'permissions_rpc_missing').length, 1);
  // Latched: the next refreshes go straight to the list.
  await engine.refreshProjectPermissions();
  await engine.refreshProjectPermissions();
  assert.deepStrictEqual(names, ['get_project_permissions', 'list_accessible_projects', 'list_accessible_projects', 'list_accessible_projects']);
  // A recycle (the new client may meet a freshly migrated schema) retries it once.
  const nextNames = [];
  const next = makeChannelSupabase(async (name, args) => { nextNames.push(name); return rpcWithProjects([row], { lean: true })(name, args); }).supabase;
  globalThis.window.supabase = { createClient: () => next };
  try {
    assert.strictEqual(await engine.recreateSupabaseClient('test'), true);
    await engine.refreshProjectPermissions();
    assert.deepStrictEqual(nextNames.filter((n) => n !== 'list_accessible_projects').slice(-1), ['get_project_permissions']);
    assert.ok(!nextNames.includes('list_accessible_projects'), 'the applied RPC answered on the new client');
  } finally {
    delete globalThis.window.supabase;
  }
});

test('refreshProjectPermissions: the raw-fetch path reads the lean RPC, and on a 404 PGRST202 falls back to the raw list and latches', async () => {
  const row = { id: 'p1', can_edit: false, can_check_out: true, checked_out_by: null, checked_out_at: null, checked_out_email: null };
  // Wedged supabase-js: the first attempt times out, the retry goes raw.
  const sbNames = [];
  const wedged = { rpc: async (name) => { sbNames.push(name); throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); } };

  // (1) The function is applied: one raw POST with the project id, no list.
  let fetches = routeFetch([
    { match: '/rest/v1/rpc/get_project_permissions', body: [row] },
    { match: '/rest/v1/rpc/list_accessible_projects', body: [row] },
  ]);
  const a = rawCtx({ getSupabase: () => wedged });
  a.ctx.getState().canCheckOut = false;
  const ea = createSaveEngine(a.ctx);
  await ea.refreshProjectPermissions();
  const rawA = fetches.filter((c) => c.url.includes('/rest/v1/rpc/'));
  assert.deepStrictEqual(rawA.map((c) => c.url.split('/rpc/')[1]), ['get_project_permissions']);
  assert.strictEqual(rawA[0].init.body, JSON.stringify({ p_project_id: 'p1' }));
  assert.strictEqual(a.ctx.getState().canCheckOut, true);
  assert.strictEqual(a.ctx.getState().isViewer, true);

  // (2) The function is missing: PostgREST's 404 body, the raw list, the latch.
  fetches = routeFetch([
    { match: '/rest/v1/rpc/get_project_permissions', status: 404, body: PGRST202 },
    { match: '/rest/v1/rpc/list_accessible_projects', body: [row] },
  ]);
  const b = rawCtx({ getSupabase: () => wedged });
  b.ctx.getState().canCheckOut = false;
  const eb = createSaveEngine(b.ctx);
  await eb.refreshProjectPermissions();
  const rawB = () => fetches.filter((c) => c.url.includes('/rest/v1/rpc/')).map((c) => c.url.split('/rpc/')[1]);
  assert.deepStrictEqual(rawB(), ['get_project_permissions', 'list_accessible_projects']);
  assert.strictEqual(b.ctx.getState().canCheckOut, true);
  assert.strictEqual(logKinds(eb).filter((k) => k === 'permissions_rpc_missing').length, 1);
  // Supabase-js is now marked bad, so the next refresh goes raw at once, list only.
  await eb.refreshProjectPermissions();
  assert.deepStrictEqual(rawB(), ['get_project_permissions', 'list_accessible_projects', 'list_accessible_projects']);

  // (3) A 404 that is NOT PostgREST's missing-function answer does not latch.
  fetches = routeFetch([
    { match: '/rest/v1/rpc/get_project_permissions', status: 404, body: '<html>not found</html>' },
    { match: '/rest/v1/rpc/list_accessible_projects', body: [row] },
  ]);
  const c = rawCtx({ getSupabase: () => wedged });
  const ec = createSaveEngine(c.ctx);
  await ec.refreshProjectPermissions();
  assert.ok(!logKinds(ec).includes('permissions_rpc_missing'));
  assert.ok(logKinds(ec).includes('refresh_permissions_err'));
});

// --- Stage 5: checkout expired recovery -------------------------------------

test('computeCheckoutExpiryAgeMs: no candidates -> 0; stale checkout dates the expiry', () => {
  // The last-success stamp is engine-internal since Stage 6 (0 on a fresh
  // engine), so the candidates are driven through state.checkedOutAt.
  const a = makeCtx({ getState: () => ({}) });
  assert.strictEqual(createSaveEngine(a.ctx).computeCheckoutExpiryAgeMs(), 0);
  const staleBy = 60000;
  const b = makeCtx({ getState: () => ({ checkedOutAt: new Date(Date.now() - CHECKOUT_INACTIVITY_MS - staleBy).toISOString() }) });
  const age = createSaveEngine(b.ctx).computeCheckoutExpiryAgeMs();
  assert.ok(age >= staleBy - 1000 && age <= staleBy + 5000, 'age ~= ' + staleBy + ', got ' + age);
  // A fresh checkout puts the expiry in the future -> clamped to 0.
  const c = makeCtx({ getState: () => ({ checkedOutAt: new Date().toISOString() }) });
  assert.strictEqual(createSaveEngine(c.ctx).computeCheckoutExpiryAgeMs(), 0);
});

test('reCheckOutAfterExpiry: success clears attention, retakes the lock, flushes dirty edits', async () => {
  const row = { id: 'p1', can_edit: true, can_check_out: false, checked_out_by: 'u1' };
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([row]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: null, canCheckOut: true, isViewer: false, pages: [] };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  const res = await engine.reCheckOutAfterExpiry('test_trigger');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls.cleared, 1);
  assert.strictEqual(state.checkedOutBy, 'u1');
  assert.strictEqual(state.isViewer, false);
  assert.ok(calls.refreshAt.length >= 1);
  assert.ok(logKinds(engine).includes('checkout_recovered'));
  // The recovery save ran through the (engine-internal) performAutoSave and
  // cleared the dirty flag against the stubbed update chain.
  assert.ok(logKinds(engine).includes('autosave_ok'));
  assert.strictEqual(sub.updates.length, 1);
  assert.strictEqual(engine.getAutoSaveDirty(), false);
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
      if (name === 'get_project_permissions') return { data: null, error: PGRST202, status: 404 };
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
  // A fresh engine has lastSuccessfulSupabaseCallAt 0 -> the staleness
  // pre-probe runs against the beforeEach fetch stub and passes.
  assert.ok(logKinds(engine).includes('autosave_recovery_ok'));
  assert.ok(logKinds(engine).includes('turn_in_ok'));
  assert.strictEqual(calls.turnInLabels[calls.turnInLabels.length - 1], null);
  assert.strictEqual(engine.isTurnInInProgress(), false);
});

test('doTurnIn: dirty session flushes through the engine-internal autosave before check-in', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', pages: [], counters: [], lineTypes: [], pdfStoragePath: 'cloud/p.pdf', isViewer: false };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  const res = await engine.doTurnIn();
  assert.strictEqual(res.ok, true);
  const kinds = logKinds(engine);
  assert.ok(kinds.indexOf('autosave_ok') > -1 && kinds.indexOf('autosave_ok') < kinds.indexOf('turn_in_ok'));
  assert.strictEqual(sub.updates.length, 1);
  assert.strictEqual(engine.getAutoSaveDirty(), false);
  assert.strictEqual(calls.turnInLabels[calls.turnInLabels.length - 1], null);
});

test('doTurnIn: CHECKOUT_EXPIRED from the pre-check-in save is surfaced as a code', async () => {
  // Suspended autosave is the engine's own CHECKOUT_EXPIRED source now.
  const { supabase } = makeChannelSupabase(rpcWithProjects([]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', pages: [], counters: [], lineTypes: [], pdfStoragePath: 'cloud/p.pdf', isViewer: false };
  const { ctx } = makeCtx({
    getState: () => state,
    getSupabase: () => supabase,
    isAutoSaveSuspended: () => true,
  });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  const res = await engine.doTurnIn();
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'CHECKOUT_EXPIRED');
  assert.ok(logKinds(engine).includes('turn_in_blocked_by_save_err'));
});

test('doTurnIn: unreachable local PDF falls back to a warning and still releases the lock', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]));
  const state = { supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', pages: [{ canvases: [] }], counters: [], lineTypes: [], pdfStoragePath: null, pdfBuffer: null, pdfBufferSize: 0, isViewer: false };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  const res = await engine.doTurnIn();
  assert.strictEqual(res.ok, true);
  // uploadLocalPdfToCloudIfNeeded (engine-internal) skipped with
  // no_usable_buffer -> the user is warned, the lock is still released.
  assert.ok(calls.toasts.some((t) => /couldn.t be uploaded/.test(t)));
  assert.ok(logKinds(engine).includes('turn_in_ok'));
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

// --- Stage 6: auto-save ------------------------------------------------------

function saveTestState(extra) {
  return Object.assign({
    supabaseSession: { user: { id: 'u1' } },
    currentProjectId: 'p1',
    checkedOutBy: 'u1',
    isViewer: false,
    pages: [], counters: [], lineTypes: [],
    pdfStoragePath: null, pdfBuffer: null, pdfBufferSize: 0,
  }, extra || {});
}

test('performAutoSave: happy update path clears dirty, stamps lastSavedAt, resets the failure ladder', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = saveTestState();
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  const res = await engine.performAutoSave();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(sub.updates.length, 1);
  assert.strictEqual(sub.updates[0].table, 'projects');
  assert.strictEqual(engine.getAutoSaveDirty(), false);
  assert.ok(state.lastSavedAt);
  assert.strictEqual(engine.isSaveInProgress(), false);
  assert.strictEqual(engine.getConsecutiveAutoSaveFailures(), 0);
  assert.strictEqual(engine.getNextAutoSaveAttemptAt(), 0);
  assert.ok(logKinds(engine).includes('autosave_ok'));
});

test('performAutoSave: suspended sessions surface CHECKOUT_EXPIRED without touching the cloud', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const { ctx } = makeCtx({ getState: () => saveTestState(), getSupabase: () => supabase, isAutoSaveSuspended: () => true });
  const engine = createSaveEngine(ctx);
  const res = await engine.performAutoSave();
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error?.code, 'CHECKOUT_EXPIRED');
  assert.strictEqual(sub.updates.length, 0);
  // ...but the recovery save runId is exempt (checkout_recovered flush).
  const res2 = await engine.performAutoSave('checkout_recovered');
  assert.strictEqual(res2.ok, true);
  assert.strictEqual(sub.updates.length, 1);
});

test('performAutoSave: a non-transient failure restores dirty, arms the backoff, and counts', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]), { updateResult: { error: { message: 'row level security', status: 400 } } });
  const state = saveTestState();
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  const res = await engine.performAutoSave();
  assert.strictEqual(res.ok, false);
  assert.strictEqual(engine.getAutoSaveDirty(), true);
  assert.strictEqual(engine.getConsecutiveAutoSaveFailures(), 1);
  assert.ok(engine.getNextAutoSaveAttemptAt() > Date.now());
  assert.ok(logKinds(engine).includes('autosave_err'));

  // Recovery bookkeeping: retrySyncNow clears the backoff and re-dirties.
  await engine.retrySyncNow();
  assert.strictEqual(engine.getNextAutoSaveAttemptAt(), 0);
  assert.strictEqual(engine.getAutoSaveDirty(), true);
  assert.ok(logKinds(engine).includes('manual_sync_retry'));
  // resetAutosaveDegradedState zeroes the ladder.
  engine.resetAutosaveDegradedState();
  assert.strictEqual(engine.getConsecutiveAutoSaveFailures(), 0);
});

test('performAutoSave: three straight failures emit the autosave_failing_3 milestone', async () => {
  // performAutoSave itself does not gate on the backoff (the interval does),
  // so three direct calls drive the failure ladder.
  const { supabase } = makeChannelSupabase(rpcWithProjects([]), { updateResult: { error: { message: 'denied', status: 400 } } });
  const engine = createSaveEngine(makeCtx({ getState: () => saveTestState(), getSupabase: () => supabase }).ctx);
  for (let i = 0; i < 3; i++) {
    engine.setAutoSaveDirty(true);
    await engine.performAutoSave();
  }
  assert.strictEqual(engine.getConsecutiveAutoSaveFailures(), 3);
  assert.ok(logKinds(engine).includes('autosave_failing_3'));
});

// MAP-EMPTY-SAVE (map D29): the canvas-only state load-project.js builds when the
// project's PDF is not in memory (the cloud object is missing, or none was stored):
// the project is open (currentProjectId set, checked out), the palette is loaded,
// but state.pages is [] and the saved marks live only in pendingCanvasLoad.data
// until the estimator re-attaches the PDF (pdf-intake.js matchPendingCanvasLoad).
function canvasOnlyState(extra) {
  return saveTestState(Object.assign({
    pages: [],
    counters: [{ id: 'wc', name: 'WC' }], lineTypes: [],
    pendingCanvasLoad: {
      projectId: 'p1', name: 'Clinic', pdf_hash: null,
      data: { pages: [{ index: 0, canvases: [{ id: 'c', name: 'Main', annotations: { counterMarkers: { wc: [{ x: 10, y: 20 }] } } }] }] },
    },
  }, extra || {}));
}

test('canvas-only: markProjectDirty does not arm while the saved marks wait for their PDF (MAP-EMPTY-SAVE)', async () => {
  const state = canvasOnlyState();
  const { ctx } = makeCtx({ getState: () => state });
  const engine = createSaveEngine(ctx);
  engine.markProjectDirty();
  assert.strictEqual(engine.getAutoSaveDirty(), false);
  assert.strictEqual(engine.getDirtyGeneration(), 0);
  // The debounced backup never fires either. (Earlier tests' 1s debounce timers can
  // land in idbPuts during this wait, so count only writes of THIS session's palette.)
  await new Promise((r) => setTimeout(r, 1300));
  assert.strictEqual(idbPuts.filter(([, data]) => data.counters === state.counters).length, 0);
});

test('canvas-only: performAutoSave never sends pages: [] over the saved marks, and Turn In still releases (MAP-EMPTY-SAVE)', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = canvasOnlyState();
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  // Dirty by a route that bypasses markProjectDirty (retrySyncNow, re-checkout).
  engine.setAutoSaveDirty(true);
  const res = await engine.performAutoSave();
  const sentPages = sub.updates.map((u) => u.payload.data && u.payload.data.pages);
  assert.deepStrictEqual(sentPages, [], 'the autosave wrote data.pages = ' + JSON.stringify(sentPages) + ' over the saved marks');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.skipped, true);
  assert.strictEqual(engine.getAutoSaveDirty(), false);
  // Turn In's pre-check-in flush takes the same skip and does not block the release.
  engine.setAutoSaveDirty(true);
  const turnIn = await engine.doTurnIn();
  assert.strictEqual(turnIn.ok, true);
  assert.strictEqual(sub.updates.length, 0);
  // Once the PDF is re-attached (pages built, pendingCanvasLoad cleared) the save runs.
  state.pages = [{ label: 'P-101', canvases: state.pendingCanvasLoad.data.pages[0].canvases, scale: null, rotation: 0 }];
  state.pendingCanvasLoad = null;
  engine.setAutoSaveDirty(true);
  const after = await engine.performAutoSave();
  assert.strictEqual(after.ok, true);
  assert.strictEqual(sub.updates.length, 1);
  assert.strictEqual(sub.updates[0].payload.data.pages.length, 1);
});

test('canvas-only: a manual Save sends no pages: [] over the saved marks, and Turn In still releases (MAP-MANUAL-SAVE)', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = canvasOnlyState({ currentProjectName: 'Clinic' });
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  // Both toggle positions: the pdf_missing branch keeps pdf_path, so the dialog can
  // offer Include PDF on; the no_pdf_stored branch leaves it off.
  for (const includePdf of [false, true]) {
    const res = await engine.performSaveProjectToCloud({ name: 'Renamed', includePdf });
    const sentPages = sub.updates.map((u) => u.payload.data && u.payload.data.pages);
    assert.deepStrictEqual(sentPages, [], 'the manual save wrote data.pages = ' + JSON.stringify(sentPages) + ' over the saved marks');
    assert.strictEqual(res.ok, true, 'a held save is not a failed one (includePdf=' + includePdf + ')');
    assert.strictEqual(res.skipped, true);
    assert.strictEqual(res.reason, 'canvas_only_pending_pdf');
  }
  assert.strictEqual(state.currentProjectName, 'Clinic', 'nothing was written, so the name did not change either');
  assert.strictEqual(engine.wasLastCloudSaveAttemptFailed(), false);
  assert.ok(!logKinds(engine).includes('manual_save_err'));
  assert.strictEqual(engine.getAutoSaveDirty(), false);
  // Turn In after the held Save still releases the lock, still without a write.
  engine.setAutoSaveDirty(true);
  const turnIn = await engine.doTurnIn();
  assert.strictEqual(turnIn.ok, true);
  assert.strictEqual(sub.updates.length, 0);
  // With the PDF back, the same manual Save writes the sheet.
  state.pages = [{ label: 'P-101', canvases: state.pendingCanvasLoad.data.pages[0].canvases, scale: null, rotation: 0 }];
  state.pendingCanvasLoad = null;
  state.checkedOutBy = state.supabaseSession.user.id;
  const after = await engine.performSaveProjectToCloud({ name: 'Renamed', includePdf: false });
  assert.strictEqual(after.ok, true);
  assert.strictEqual(sub.updates.length, 1);
  assert.strictEqual(sub.updates[0].payload.data.pages.length, 1);
});

test('canvas-only: the 5s takeoff backup does not overwrite the device copy with no pages (MAP-EMPTY-SAVE)', async () => {
  const { ctx } = makeCtx({ getState: () => canvasOnlyState(), getLastModifiedAt: () => 0 });
  await createSaveEngine(ctx).writeTakeoffStateBackup();
  const written = idbPuts.map(([projectId, data]) => ({ projectId, pageCanvases: data.pageCanvases }));
  assert.deepStrictEqual(written, [], 'the backup wrote ' + JSON.stringify(written));
});

test('uploadLocalPdfToCloudIfNeeded: the skip ladder reports its reasons', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]));
  const mk = (stateExtra, ctxExtra) => createSaveEngine(makeCtx(Object.assign({
    getState: () => saveTestState(stateExtra), getSupabase: () => supabase,
  }, ctxExtra || {})).ctx);
  assert.deepStrictEqual(await mk({}, { isSupabaseEnabled: () => false }).uploadLocalPdfToCloudIfNeeded('t'),
    { skipped: true, reason: 'no_supabase' });
  assert.deepStrictEqual(await mk({ currentProjectId: null }).uploadLocalPdfToCloudIfNeeded('t'),
    { skipped: true, reason: 'no_project' });
  assert.deepStrictEqual(await mk({ pages: [] }).uploadLocalPdfToCloudIfNeeded('t'),
    { skipped: true, reason: 'no_pages' });
  assert.deepStrictEqual(await mk({ pages: [{}], pdfStoragePath: 'cloud/p.pdf' }).uploadLocalPdfToCloudIfNeeded('t'),
    { skipped: true, reason: 'already_in_cloud' });
  assert.deepStrictEqual(await mk({ pages: [{}], isViewer: true }).uploadLocalPdfToCloudIfNeeded('t'),
    { skipped: true, reason: 'viewer' });
  assert.deepStrictEqual(await mk({ pages: [{}] }).uploadLocalPdfToCloudIfNeeded('t'),
    { skipped: true, reason: 'no_usable_buffer' });
});

test('abortInFlightAutoSave: no controller -> false; save flags reset cleanly', () => {
  const { ctx } = makeCtx();
  const engine = createSaveEngine(ctx);
  assert.strictEqual(engine.abortInFlightAutoSave('hidden'), false);
  engine.resetSaveFlags();
  assert.strictEqual(engine.isSaveInProgress(), false);
  assert.strictEqual(engine.isSavePdfInProgress(), false);
  assert.strictEqual(engine.getSaveProgressMessage(), '');
});

// --- Stage 6: manual save & envelope ----------------------------------------

test('performSaveProjectToCloud: signed-out sessions fail fast', async () => {
  const { ctx } = makeCtx({ getState: () => ({ supabaseSession: null }) });
  const res = await createSaveEngine(ctx).performSaveProjectToCloud({ name: 'X', includePdf: false });
  assert.strictEqual(res.ok, false);
  assert.match(res.error.message, /Not signed in/);
});

test('performSaveProjectToCloud: no-PDF update path completes and stamps state', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = saveTestState({ currentProjectName: 'Old' });
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  const res = await engine.performSaveProjectToCloud({ name: 'Renamed', includePdf: false });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(sub.updates.length, 1);
  assert.strictEqual(sub.updates[0].payload.name, 'Renamed');
  assert.strictEqual(state.currentProjectName, 'Renamed');
  assert.ok(state.lastSavedAt);
  assert.ok(logKinds(engine).includes('manual_save_ok'));
  assert.strictEqual(engine.wasLastCloudSaveAttemptFailed(), false);
});

test('performSaveProjectToCloud: resolves with requestAnimationFrame suppressed (hidden tab)', async () => {
  // Hidden-tab regression pin: rAF never fires while document.hidden, and the
  // save path awaits tick() before every network phase — with rAF alone a
  // backgrounded tab stalled the save indefinitely (Stage-5 walk, 2026-08-31).
  // tick() must resolve via its timer fallback in both hidden flavors: the
  // flag set at call time, and rAF silently dead with the flag unset (tab
  // backgrounded mid-save; the stub document has no hidden property).
  globalThis.requestAnimationFrame = () => 0; // never invokes the callback
  try {
    for (const hidden of [true, false]) {
      if (hidden) globalThis.document.hidden = true; else delete globalThis.document.hidden;
      const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
      const state = saveTestState({ currentProjectName: 'Old' });
      const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
      const res = await createSaveEngine(ctx).performSaveProjectToCloud({ name: 'Hidden Save', includePdf: false });
      assert.strictEqual(res.ok, true, 'save must resolve with rAF suppressed (hidden=' + hidden + ')');
      assert.strictEqual(sub.updates.length, 1);
    }
  } finally {
    delete globalThis.document.hidden;
  }
});

test('envelope: schema, per-tab session id, timing block, and project summary', () => {
  const state = saveTestState({
    currentProjectName: 'Proj',
    pages: [
      { canvases: [{ annotations: { counterMarkers: { c1: [{}, {}] }, multiplyZones: [{}] } }], scale: { pixelsPerUnit: 10, unit: 'ft' }, rotation: 0 },
      { canvases: [{ annotations: {} }], scale: null, rotation: 0 },
    ],
    counters: [{ id: 'c1' }], groups: [],
  });
  const { ctx } = makeCtx({ getState: () => state });
  const engine = createSaveEngine(ctx);
  engine.pushSaveEvent('x', 'probe');
  const env = engine.buildSaveLogsEnvelope();
  assert.strictEqual(env.schema, 'clickcount-save-logs/v1');
  assert.ok(env.tabSessionId && typeof env.tabSessionId === 'string');
  assert.strictEqual(env.timing.consecutiveAutoSaveFailures, 0);
  assert.strictEqual(env.timing.autoSaveDirty, false);
  assert.strictEqual(env.project.projectName, 'Proj');
  assert.strictEqual(env.project.counters, 2);
  assert.strictEqual(env.project.multiplyZones, 1);
  // Real scale shape is { pixelsPerUnit, unit } — the envelope must count it
  // (a scale.feet check made this 0 for every project, misleading triage).
  assert.strictEqual(env.project.pagesWithScale, 1);
  assert.strictEqual(env.events.length, 1);
});

// --- Raw-REST wrappers (rawProjectsUpdate / rawCheckInProject / rawList) ---
// A fetch router: records every call and answers from a URL-matched table.
function routeFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    for (const r of routes) {
      if (String(url).includes(r.match)) {
        if (r.throws) throw r.throws;
        return {
          ok: r.status ? r.status < 400 : true,
          status: r.status || 200,
          headers: { get: (h) => (r.headers && r.headers[h]) || null },
          text: async () => (r.body != null ? (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)) : ''),
        };
      }
    }
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' };
  };
  return calls;
}

function rawCtx(overrides) {
  const state = saveTestState({ supabaseSession: { user: { id: 'u1' }, access_token: 'tok-1' } });
  return makeCtx({ getState: () => state, ...overrides });
}

test('sha256Hex hashes an ArrayBuffer to the canonical hex digest', async () => {
  const engine = createSaveEngine(rawCtx().ctx);
  const buf = new TextEncoder().encode('abc').buffer;
  assert.strictEqual(
    await engine.sha256Hex(buf),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('rawProjectsUpdate: PATCH with auth headers + minimal-return; ok contract', async () => {
  const calls = routeFetch([{ match: '/rest/v1/projects?id=eq.p1', status: 204 }]);
  const engine = createSaveEngine(rawCtx().ctx);
  const res = await engine.rawProjectsUpdate('p1', { name: 'N' }, undefined);
  assert.deepStrictEqual(res, { ok: true, status: 204 });
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/rest/v1/projects?id=eq.p1'));
  assert.strictEqual(calls[0].init.method, 'PATCH');
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer tok-1');
  assert.strictEqual(calls[0].init.headers.apikey, 'anon');
  assert.strictEqual(calls[0].init.headers.Prefer, 'return=minimal');
  assert.strictEqual(calls[0].init.body, JSON.stringify({ name: 'N' }));
});

test('rawProjectsUpdate: HTTP failure throws with status, code, body slice, and diag', async () => {
  routeFetch([{ match: '/rest/v1/projects', status: 500, body: 'boom detail', headers: { 'x-request-id': 'req-9' } }]);
  const engine = createSaveEngine(rawCtx().ctx);
  await assert.rejects(engine.rawProjectsUpdate('p1', {}, undefined), (e) => {
    assert.strictEqual(e.status, 500);
    assert.strictEqual(e.code, 'RAW_UPDATE_HTTP_500');
    assert.match(e.message, /500 boom detail/);
    assert.strictEqual(e.diag.requestId, 'req-9');
    return true;
  });
});

test('rawProjectsUpdate: missing token throws before any fetch', async () => {
  const calls = routeFetch([]);
  const state = saveTestState({ supabaseSession: { user: { id: 'u1' } } });
  const engine = createSaveEngine(makeCtx({ getState: () => state }).ctx);
  await assert.rejects(engine.rawProjectsUpdate('p1', {}, undefined), /No access token/);
  assert.strictEqual(calls.length, 0);
});

test('rawProjectsInsert: fetch rejection maps to the RAW_INSERT_FETCH_ERR shape', async () => {
  const err = Object.assign(new Error('socket hang up'), { name: 'FetchError' });
  routeFetch([{ match: '/rest/v1/projects', throws: err }]);
  const engine = createSaveEngine(rawCtx().ctx);
  const res = await engine.rawProjectsInsert({}, undefined);
  assert.strictEqual(res.data, null);
  assert.strictEqual(res.error.code, 'RAW_INSERT_FETCH_ERR');
  assert.strictEqual(res.error.status, 0);
  assert.strictEqual(res.error.name, 'FetchError');
});

test('rawProjectsInsert: HTTP error prefers the server body message/code', async () => {
  routeFetch([{ match: '/rest/v1/projects', status: 409, body: { message: 'duplicate name', code: '23505' } }]);
  const engine = createSaveEngine(rawCtx().ctx);
  const res = await engine.rawProjectsInsert({}, undefined);
  assert.strictEqual(res.data, null);
  assert.strictEqual(res.error.message, 'duplicate name');
  assert.strictEqual(res.error.code, '23505');
  assert.strictEqual(res.error.status, 409);
});

test('rawProjectsInsert: representation array unwraps to the first row', async () => {
  routeFetch([{ match: '/rest/v1/projects', body: [{ id: 'p-new', name: 'N' }] }]);
  const engine = createSaveEngine(rawCtx().ctx);
  const res = await engine.rawProjectsInsert({ name: 'N' }, undefined);
  assert.strictEqual(res.error, null);
  assert.strictEqual(res.data.id, 'p-new');
});

test('rawCheckInProject: ok parses the RPC body; HTTP error RETURNS (not throws) the raw error', async () => {
  routeFetch([{ match: '/rest/v1/rpc/check_in_project', body: { ok: true, server_now: 't' } }]);
  const engine = createSaveEngine(rawCtx().ctx);
  const ok = await engine.rawCheckInProject('p1', undefined);
  assert.strictEqual(ok.error, null);
  assert.deepStrictEqual(ok.data, { ok: true, server_now: 't' });

  routeFetch([{ match: '/rest/v1/rpc/check_in_project', status: 503, body: { hint: 'later' } }]);
  const bad = await engine.rawCheckInProject('p1', undefined);
  assert.ok(bad.error instanceof Error);
  assert.strictEqual(bad.error.status, 503);
  assert.strictEqual(bad.error.code, 'RAW_RPC_HTTP_503');
  assert.deepStrictEqual(bad.data, { hint: 'later' });
});

test('rawListAccessibleProjects: POSTs an empty object; mirrors the rawCheckIn contract', async () => {
  const calls = routeFetch([{ match: '/rest/v1/rpc/list_accessible_projects', body: [{ id: 'p1' }] }]);
  const engine = createSaveEngine(rawCtx().ctx);
  const res = await engine.rawListAccessibleProjects(undefined);
  assert.strictEqual(res.error, null);
  assert.deepStrictEqual(res.data, [{ id: 'p1' }]);
  assert.strictEqual(calls[0].init.body, '{}');
  assert.strictEqual(calls[0].init.method, 'POST');

  routeFetch([{ match: '/rest/v1/rpc/list_accessible_projects', status: 500 }]);
  const bad = await engine.rawListAccessibleProjects(undefined);
  assert.strictEqual(bad.error.code, 'RAW_RPC_HTTP_500');
});

// --- The PDF upload ladder, driven through performSaveProjectToCloud --------
// (uploadPdfToStorage / confirmPdfUploaded are engine-internal; the public
// create-project-with-PDF path exercises them.)

globalThis.pdfCachePut = async () => {};

// Storage recorder: upload/info/remove behaviors injectable per test.
function makeUploadSupabase(opts) {
  opts = opts || {};
  const rec = { uploads: [], infos: [], updates: [] };
  const { supabase } = makeChannelSupabase();
  supabase.storage = {
    from: () => ({
      upload: async (path, body, o) => { rec.uploads.push({ path, bytes: body.byteLength || body.size || 0, o }); return opts.upload ? opts.upload() : { error: null }; },
      info: async (path) => { rec.infos.push(path); return opts.info ? opts.info() : { data: null }; },
      remove: async () => ({ error: null }),
    }),
  };
  const origFrom = supabase.from.bind(supabase);
  supabase.from = (table) => {
    const chain = origFrom(table);
    const origUpdate = chain.update;
    chain.update = (payload) => { rec.updates.push({ table, payload }); return origUpdate(payload); };
    return chain;
  };
  return { supabase, rec };
}

function pdfSaveSetup(supabase) {
  const pdfBuf = new TextEncoder().encode('%PDF-1.4 spec bytes').buffer;
  const state = saveTestState({
    supabaseSession: { user: { id: 'u1' }, access_token: 'tok-1' },
    currentProjectId: null,
    pdfBuffer: pdfBuf, pdfBufferSize: pdfBuf.byteLength,
    pages: [{ label: 'p1', canvases: [], scale: null, rotation: 0 }],
  });
  routeFetch([{ match: '/rest/v1/projects', body: [{ id: 'p-new' }] }]);
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  return { state, ctx, calls, pdfBuf };
}

test('performSaveProjectToCloud (new project + PDF): raw insert, storage upload at uid/project/document.pdf, update stamps pdf_path + pdf_hash', async () => {
  const { supabase, rec } = makeUploadSupabase();
  const { state, ctx, pdfBuf } = pdfSaveSetup(supabase);
  const engine = createSaveEngine(ctx);
  const res = await engine.performSaveProjectToCloud({ name: 'Bid 1', includePdf: true });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(rec.uploads.length, 1);
  assert.strictEqual(rec.uploads[0].path, 'u1/p-new/document.pdf');
  assert.strictEqual(rec.uploads[0].bytes, pdfBuf.byteLength);
  const upd = rec.updates.find((u) => u.table === 'projects' && u.payload.pdf_path);
  assert.ok(upd, 'projects.update after the upload');
  assert.strictEqual(upd.payload.pdf_path, 'u1/p-new/document.pdf');
  const expectedHash = await engine.sha256Hex(new TextEncoder().encode('%PDF-1.4 spec bytes').buffer);
  assert.strictEqual(upd.payload.pdf_hash, expectedHash);
  // Post-save state hydration: id adopted, buffer released, storage path kept.
  assert.strictEqual(state.currentProjectId, 'p-new');
  assert.strictEqual(state.pdfStoragePath, 'u1/p-new/document.pdf');
  assert.strictEqual(state.pdfHash, expectedHash);
  assert.strictEqual(state.pdfBuffer, null);
  assert.ok(logKinds(engine).includes('manual_save_ok'));
});

test('upload verify net: a timed-out upload confirmed by storage.info() still succeeds (viaVerify)', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.4 spec bytes').buffer.byteLength;
  const { supabase, rec } = makeUploadSupabase({
    upload: () => { throw Object.assign(new Error('PDF upload timed out'), { name: 'TimeoutError' }); },
    info: () => ({ data: { metadata: { size: bytes } } }),
  });
  const { ctx } = pdfSaveSetup(supabase);
  const engine = createSaveEngine(ctx);
  const res = await engine.performSaveProjectToCloud({ name: 'Bid 2', includePdf: true });
  assert.strictEqual(res.ok, true);
  assert.ok(rec.infos.length >= 1, 'storage.info() polled');
  assert.ok(logKinds(engine).includes('pdf_upload_verified_after_timeout'));
});

test('upload failure with no server-side object fails the save and pushes manual_save_err', async () => {
  const { supabase } = makeUploadSupabase({
    upload: () => ({ error: Object.assign(new Error('exceeded quota'), { status: 413 }) }),
  });
  const { state, ctx } = pdfSaveSetup(supabase);
  const engine = createSaveEngine(ctx);
  const res = await engine.performSaveProjectToCloud({ name: 'Bid 3', includePdf: true });
  assert.strictEqual(res.ok, false);
  assert.match(res.error.message, /exceeded quota/);
  assert.ok(logKinds(engine).includes('manual_save_err'));
  assert.strictEqual(state.pdfStoragePath, null);
});

// --- uploadLocalPdfToCloudIfNeeded: the one-shot skip ladder ----------------

test('uploadLocalPdfToCloudIfNeeded: every skip-ladder rung reports its reason', async () => {
  const run = async (stateExtra, ctxExtra) => {
    const state = saveTestState(Object.assign({
      supabaseSession: { user: { id: 'u1' }, access_token: 'tok-1' },
      pages: [{}], pdfBuffer: null, pdfBufferSize: 0,
    }, stateExtra));
    const { ctx } = makeCtx({ getState: () => state, ...ctxExtra });
    return createSaveEngine(ctx).uploadLocalPdfToCloudIfNeeded('spec');
  };
  assert.deepStrictEqual(await run({}, { isSupabaseEnabled: () => false }), { skipped: true, reason: 'no_supabase' });
  assert.deepStrictEqual(await run({ currentProjectId: null }), { skipped: true, reason: 'no_project' });
  assert.deepStrictEqual(await run({ pages: [] }), { skipped: true, reason: 'no_pages' });
  assert.deepStrictEqual(await run({ pdfStoragePath: 'u1/p1/document.pdf' }), { skipped: true, reason: 'already_in_cloud' });
  assert.deepStrictEqual(await run({ isViewer: true }), { skipped: true, reason: 'viewer' });
  assert.deepStrictEqual(await run({}, { isAutoSaveSuspended: () => true }), { skipped: true, reason: 'suspended' });
  // Nothing in memory and nothing recoverable from the cache:
  assert.deepStrictEqual(await run({}), { skipped: true, reason: 'no_usable_buffer' });
});

// --- R21: the three folded blocks, pinned across the dedupe ------------------
// adoptNewCloudProject (three adopt sites), turnInSaveBlocked (three
// turn_in_blocked shapings), rawRpc (behind the two raw RPC twins).

const ADOPTED = { projectOwnerId: 'u1', loadedViaViewLink: false, isViewer: false, canCheckOut: true, checkedOutBy: null, checkedOutAt: null, checkedOutEmail: null };
const adoptedFields = (state) => Object.fromEntries(Object.keys(ADOPTED).map((k) => [k, state[k]]));

test('adopt (R21): the autosave\'s first insert adopts the new row, subscribes to it and drops the anonymous local backup', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = saveTestState({
    supabaseSession: { user: { id: 'u1' }, access_token: 'tok-1' },
    currentProjectId: null, currentProjectName: 'Bid A',
    pages: [{ label: 'p1', canvases: [], scale: null, rotation: 0 }],
    projectOwnerId: 'someone', loadedViaViewLink: true, canCheckOut: false,
    checkedOutBy: 'x', checkedOutAt: 'T', checkedOutEmail: 'x@y',
  });
  routeFetch([{ match: '/rest/v1/projects', body: [{ id: 'p-new' }] }]);
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  const res = await engine.performAutoSave();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.currentProjectId, 'p-new');
  assert.strictEqual(state.currentProjectName, 'Bid A');
  assert.deepStrictEqual(adoptedFields(state), ADOPTED);
  assert.ok(calls.cleared >= 1, 'the expired attention is cleared for the new row');
  assert.ok(idbDeletes.includes('local'), 'the anonymous local backup is dropped');
  await new Promise((r) => setImmediate(r));
  assert.ok(sub.channels.some((c) => c.name === 'projects-checkout-p-new'));
});

test('adopt (R21): the manual save\'s no-PDF insert adopts the new row the same way', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = saveTestState({
    supabaseSession: { user: { id: 'u1' }, access_token: 'tok-1' },
    currentProjectId: null,
    pages: [{ label: 'p1', canvases: [], scale: null, rotation: 0 }],
    projectOwnerId: 'someone', loadedViaViewLink: true, canCheckOut: false,
    checkedOutBy: 'x', checkedOutAt: 'T', checkedOutEmail: 'x@y',
  });
  routeFetch([{ match: '/rest/v1/projects', body: [{ id: 'p-man' }] }]);
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  const res = await engine.performSaveProjectToCloud({ name: 'Bid M', includePdf: false });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.currentProjectId, 'p-man');
  assert.deepStrictEqual(adoptedFields(state), ADOPTED);
  await new Promise((r) => setImmediate(r));
  assert.ok(sub.channels.some((c) => c.name === 'projects-checkout-p-man'));
});

test('doTurnIn (R21): a failed pre-check-in autosave is logged with its label and stage, and hands back the save error', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]), { updateResult: { error: { message: 'row level security', status: 400 } } });
  const state = saveTestState({ pdfStoragePath: 'cloud/p.pdf' });
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  const res = await engine.doTurnIn();
  assert.deepStrictEqual(res, { ok: false, error: 'row level security' });
  const ev = engine.getSaveStatusLog().find((e) => e.kind === 'turn_in_blocked_by_save_err');
  assert.strictEqual(ev.message, 'Turn In blocked: autosave failed before check-in');
  const d = JSON.parse(ev.detail);
  assert.strictEqual(d.message, 'row level security');
  assert.strictEqual(d.stage, 'sync_to_cloud');
  assert.ok(Number.isFinite(d.elapsedMs));
});

test('doTurnIn (R21): an auth error from the pre-check-in save asks for a refresh', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]), { updateResult: { error: { message: 'JWT expired', status: 400 } } });
  const state = saveTestState({ pdfStoragePath: 'cloud/p.pdf' });
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase, isAuthError: (e) => !!(e && /JWT/.test(e.message)) });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  assert.deepStrictEqual(await engine.doTurnIn(), { ok: false, error: 'Refresh the page to sync.' });
});

test('rawCheckInProject (R21): POSTs { p_project_id } to its RPC; a missing token throws before any fetch', async () => {
  const calls = routeFetch([{ match: '/rest/v1/rpc/check_in_project', body: { ok: true } }]);
  const engine = createSaveEngine(rawCtx().ctx);
  await engine.rawCheckInProject('p9', undefined);
  assert.ok(calls[0].url.endsWith('/rest/v1/rpc/check_in_project'));
  assert.strictEqual(calls[0].init.body, JSON.stringify({ p_project_id: 'p9' }));
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer tok-1');
  assert.strictEqual(calls[0].init.headers.apikey, 'anon');

  const noTok = routeFetch([]);
  const state = saveTestState({ supabaseSession: { user: { id: 'u1' } } });
  const bare = createSaveEngine(makeCtx({ getState: () => state }).ctx);
  await assert.rejects(bare.rawCheckInProject('p9', undefined), /No access token for raw check_in_project/);
  await assert.rejects(bare.rawListAccessibleProjects(undefined), /No access token for raw list_accessible_projects/);
  assert.strictEqual(noTok.length, 0);
});

// --- Stage 7 (R21): visibility, connectivity and the autosave tick ----------
// app.js keeps the three listeners and the interval; the bodies are engine
// functions driven here with a fake clock (Date.now) and a stubbed ctx.
const { LONG_IDLE_PROBE_MS } = require('./constants.js');

function fakeClock(startMs) {
  const realNow = Date.now;
  let now = startMs;
  Date.now = () => now;
  return { advance: (ms) => { now += ms; }, restore: () => { Date.now = realNow; } };
}

// The long-idle cast: a wedged client (its client probe errors) with a
// working auth, and the replacement createClient hands back. rpc names are
// recorded per client so a test can tell which one the calls reached.
function idleReturnClients(opts) {
  opts = opts || {};
  const rpcCalls = { old: [], next: [] };
  const auth = { refresh: 0, get: 0, setSession: 0 };
  const row = { id: 'p1', can_edit: true, can_check_out: false, checked_out_by: 'u1', checked_out_at: 'TS', checked_out_email: 'me@x.com' };
  const rpcFor = (bucket) => async (name) => {
    rpcCalls[bucket].push(name);
    if (name === 'refresh_checkout_activity') return opts.checkoutProbe || { data: { ok: true, checked_out_at: '2026-09-26T12:00:00Z' } };
    if (name === 'get_project_permissions') return { data: null, error: PGRST202, status: 404 };
    if (name === 'list_accessible_projects') return { data: [row] };
    return { data: {} };
  };
  const old = makeChannelSupabase(rpcFor('old'));
  old.supabase.auth = {
    refreshSession: async () => { auth.refresh++; return { data: { session: opts.refreshedSession } }; },
    getSession: async () => { auth.get++; return { data: { session: opts.currentSession || null } }; },
  };
  let clientProbes = 0;
  old.supabase.from = () => ({ select: () => ({ limit: () => ({ abortSignal: async () => { clientProbes++; return opts.clientHealthy ? { error: null } : { error: { message: 'wedged' } }; } }) }) });
  const next = makeChannelSupabase(rpcFor('next'));
  next.supabase.auth = { setSession: async () => { auth.setSession++; return { data: {} }; } };
  const created = [];
  globalThis.window.supabase = { createClient: () => { created.push(next.supabase); return next.supabase; } };
  return { old, next, rpcCalls, auth, created, clientProbes: () => clientProbes };
}

test('Stage 7: hidden stamps the idle clock, backs up, and flushes a dirty lock holder\'s edits', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = saveTestState({ pages: [{ canvases: [] }] });
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  await engine.onVisibilityChange('hidden');
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(sub.updates.length, 1, 'the dirty edits flushed on hide');
  assert.strictEqual(engine.getAutoSaveDirty(), false);
  assert.ok(idbPuts.length >= 1, 'the takeoff backup was written');
});

test('Stage 7: hidden does not flush for a viewer, a non-holder, or a suspended session', async () => {
  for (const [stateExtra, ctxExtra] of [
    [{ checkedOutBy: 'u2' }, {}],
    [{}, { isAutoSaveSuspended: () => true }],
  ]) {
    const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
    const state = saveTestState(Object.assign({ pages: [{ canvases: [] }] }, stateExtra));
    const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabase, ...ctxExtra });
    const engine = createSaveEngine(ctx);
    engine.setAutoSaveDirty(true);
    await engine.onVisibilityChange('hidden');
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(sub.updates.length, 0);
    assert.strictEqual(engine.getAutoSaveDirty(), true);
  }
});

test('Stage 7: a return past LONG_IDLE_PROBE_MS probes the connection, forces a JWT refresh, recycles a wedged client, then probes the lock and refreshes permissions on the new client', async () => {
  const clock = fakeClock(1_800_000_000_000);
  try {
    const refreshed = { user: { id: 'u1' }, access_token: 'tok-2', refresh_token: 'r-2' };
    const cast = idleReturnClients({ refreshedSession: refreshed });
    let client = cast.old.supabase;
    const state = saveTestState({
      supabaseSession: { user: { id: 'u1' }, access_token: 'tok-1', refresh_token: 'r-1' },
      checkedOutAt: '2026-09-26T11:59:00Z',
    });
    const fetches = routeFetch([
      { match: '/rest/v1/rpc/get_project_permissions', status: 404, body: PGRST202 },
      { match: '/rest/v1/rpc/list_accessible_projects', body: [{ id: 'p1', can_edit: true, can_check_out: false, checked_out_by: 'u1', checked_out_at: 'TS', checked_out_email: 'me@x.com' }] },
    ]);
    const set = [];
    const { ctx, calls } = makeCtx({
      getState: () => state,
      getSupabase: () => client,
      setSupabase: (c) => { client = c; set.push(c); },
    });
    const engine = createSaveEngine(ctx);
    await engine.onVisibilityChange('hidden');
    clock.advance(LONG_IDLE_PROBE_MS + 1000);
    const uiBefore = calls.uiUpdates;
    await engine.onVisibilityChange('visible');

    // 1. The raw-fetch connection probe ran first.
    assert.ok(fetches.some((c) => c.url.includes('/rest/v1/projects?select=id&limit=1')), 'recovery probe');
    assert.ok(logKinds(engine).includes('autosave_recovery_probe'));
    // 2. A forced refresh, not a getSession, and the new session is adopted.
    assert.strictEqual(cast.auth.refresh, 1);
    assert.strictEqual(cast.auth.get, 0);
    const refreshEv = engine.getSaveStatusLog().find((e) => e.kind === 'session_refresh_attempt');
    assert.ok(refreshEv, 'session_refresh_attempt logged');
    assert.strictEqual(JSON.parse(refreshEv.detail).hiddenForMs, LONG_IDLE_PROBE_MS + 1000);
    assert.strictEqual(state.supabaseSession, refreshed);
    // 3. The wedged client was probed and replaced, carrying the fresh session.
    assert.strictEqual(cast.clientProbes(), 1);
    assert.strictEqual(set.length, 1);
    assert.strictEqual(set[0], cast.next.supabase);
    assert.strictEqual(cast.auth.setSession, 1);
    assert.strictEqual(engine.getClientRecycleCount(), 1);
    // 4. The lock probe reached the NEW client, never the wedged one.
    assert.deepStrictEqual(cast.rpcCalls.old, []);
    assert.ok(cast.rpcCalls.next.includes('refresh_checkout_activity'));
    // The client probe's failure marks supabase-js as recently bad, so the
    // permissions read takes the raw-fetch twin (not a second wedged rpc).
    assert.ok(fetches.some((c) => c.url.includes('/rest/v1/rpc/list_accessible_projects')));
    assert.strictEqual(state.checkedOutEmail, 'me@x.com');
    assert.ok(calls.uiUpdates > uiBefore);
  } finally {
    clock.restore();
    delete globalThis.window.supabase;
  }
});

test('Stage 7: a short return reads the session, skips the recovery and client probes, and still probes the lock', async () => {
  const clock = fakeClock(1_800_000_000_000);
  try {
    const session = { user: { id: 'u1' }, access_token: 'tok-1' };
    const cast = idleReturnClients({ currentSession: session });
    const state = saveTestState({ supabaseSession: { user: { id: 'u1' } }, checkedOutAt: '2026-09-26T11:59:00Z' });
    const fetches = routeFetch([]);
    const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => cast.old.supabase });
    const engine = createSaveEngine(ctx);
    await engine.onVisibilityChange('hidden');
    clock.advance(LONG_IDLE_PROBE_MS - 1000);
    await engine.onVisibilityChange('visible');
    assert.strictEqual(fetches.length, 0, 'no recovery probe');
    assert.strictEqual(cast.auth.refresh, 0);
    assert.strictEqual(cast.auth.get, 1);
    assert.strictEqual(state.supabaseSession, session);
    assert.strictEqual(cast.clientProbes(), 0, 'no client probe');
    assert.strictEqual(cast.created.length, 0, 'no recycle');
    assert.ok(!logKinds(engine).includes('session_refresh_attempt'));
    assert.ok(cast.rpcCalls.old.includes('refresh_checkout_activity'));
    assert.ok(cast.rpcCalls.old.includes('list_accessible_projects'));
    assert.ok(calls.uiUpdates >= 1);
  } finally {
    clock.restore();
    delete globalThis.window.supabase;
  }
});

test('Stage 7: a long-idle return with a healthy client keeps it; an expired lock routes the background recovery', async () => {
  const clock = fakeClock(1_800_000_000_000);
  try {
    const refreshed = { user: { id: 'u1' }, access_token: 'tok-2', refresh_token: 'r-2' };
    const cast = idleReturnClients({ refreshedSession: refreshed, clientHealthy: true, checkoutProbe: { data: { ok: false, error: 'expired' } } });
    const state = saveTestState({ supabaseSession: { user: { id: 'u1' } } });
    routeFetch([]);
    const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => cast.old.supabase });
    const engine = createSaveEngine(ctx);
    await engine.onVisibilityChange('hidden');
    clock.advance(LONG_IDLE_PROBE_MS + 1);
    await engine.onVisibilityChange('visible');
    assert.strictEqual(cast.clientProbes(), 1);
    assert.strictEqual(cast.created.length, 0, 'a healthy client is not replaced');
    assert.strictEqual(engine.getClientRecycleCount(), 0);
    // handleBackgroundCheckoutExpired('visibility_probe') took over.
    assert.ok(calls.attention >= 1 || calls.suspends >= 1, 'the expired lock reached the background recovery');
  } finally {
    clock.restore();
    delete globalThis.window.supabase;
  }
});

test('Stage 7: a signed-out return past the idle limit probes the connection and stops there', async () => {
  const clock = fakeClock(1_800_000_000_000);
  try {
    const cast = idleReturnClients({});
    const state = saveTestState({ supabaseSession: null });
    const fetches = routeFetch([]);
    const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => cast.old.supabase });
    const engine = createSaveEngine(ctx);
    await engine.onVisibilityChange('hidden');
    clock.advance(LONG_IDLE_PROBE_MS + 1);
    await engine.onVisibilityChange('visible');
    assert.strictEqual(fetches.length, 1);
    assert.strictEqual(cast.auth.refresh + cast.auth.get, 0);
    assert.deepStrictEqual(cast.rpcCalls.old, []);
    assert.strictEqual(calls.uiUpdates, 0);
  } finally {
    clock.restore();
    delete globalThis.window.supabase;
  }
});

test('Stage 7: online logs, repaints the bell, and probes only after failures; offline logs and repaints', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]), { updateResult: { error: { message: 'row level security', status: 400 } } });
  const state = saveTestState();
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  const fetches = routeFetch([]);
  engine.onOnline();
  assert.ok(logKinds(engine).includes('online'));
  assert.strictEqual(calls.indicatorUpdates, 1);
  assert.strictEqual(fetches.length, 0, 'no failures, no probe');

  engine.onOffline();
  assert.ok(logKinds(engine).includes('offline'));
  assert.strictEqual(calls.indicatorUpdates, 2);

  engine.setAutoSaveDirty(true);
  await engine.performAutoSave();
  assert.strictEqual(engine.getConsecutiveAutoSaveFailures(), 1);
  engine.onOnline();
  await new Promise((r) => setImmediate(r));
  assert.ok(fetches.some((c) => c.url.includes('/rest/v1/projects?select=id&limit=1')), 'failures -> recovery probe');
  assert.strictEqual(calls.indicatorUpdates, 3);
});

test('Stage 7: one autosave tick saves a dirty takeoff and repaints; clean, signed-out and suspended ticks do not save', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]));
  const state = saveTestState({ pdfStoragePath: 'cloud/p.pdf' });
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  await engine.autoSaveTick();
  assert.strictEqual(sub.updates.length, 0, 'clean tick');
  engine.setAutoSaveDirty(true);
  await engine.autoSaveTick();
  assert.strictEqual(sub.updates.length, 1);
  assert.strictEqual(engine.getAutoSaveDirty(), false);
  assert.strictEqual(calls.indicatorUpdates >= 1, true);

  const signedOut = saveTestState({ supabaseSession: null });
  const e2 = createSaveEngine(makeCtx({ getState: () => signedOut, getSupabase: () => supabase }).ctx);
  e2.setAutoSaveDirty(true);
  await e2.autoSaveTick();
  assert.strictEqual(sub.updates.length, 1);

  const e3 = createSaveEngine(makeCtx({ getState: () => saveTestState(), getSupabase: () => supabase, isAutoSaveSuspended: () => true }).ctx);
  e3.setAutoSaveDirty(true);
  await e3.autoSaveTick();
  assert.strictEqual(sub.updates.length, 1);
  assert.strictEqual(e3.getAutoSaveDirty(), true);
});

test('Stage 7: a failing tick records the error and backs off; the next tick waits', async () => {
  const { supabase, sub } = makeChannelSupabase(rpcWithProjects([]), { updateResult: { error: { message: 'row level security', status: 400 } } });
  const state = saveTestState({ pdfStoragePath: 'cloud/p.pdf' });
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  delete globalThis.window.lastSaveError;
  engine.setAutoSaveDirty(true);
  await engine.autoSaveTick();
  assert.strictEqual(sub.updates.length, 1);
  assert.strictEqual(globalThis.window.lastSaveError.message, 'row level security');
  assert.ok(calls.indicatorUpdates >= 1);
  await engine.autoSaveTick();
  assert.strictEqual(sub.updates.length, 1, 'the backoff holds the next tick');
  delete globalThis.window.lastSaveError;
});

test('Stage 7: a tick whose save finds the checkout expired routes the background recovery', async () => {
  const { supabase } = makeChannelSupabase(rpcWithProjects([]));
  // Hard-skew expiry: the lock is older than the inactivity window plus grace.
  const state = saveTestState({ pdfStoragePath: 'cloud/p.pdf', checkedOutAt: new Date(Date.now() - 3 * CHECKOUT_INACTIVITY_MS).toISOString() });
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabase });
  const engine = createSaveEngine(ctx);
  engine.setAutoSaveDirty(true);
  await engine.autoSaveTick();
  assert.ok(calls.attention >= 1 || calls.suspends >= 1, 'handleBackgroundCheckoutExpired(\'autosave\') took over');
});

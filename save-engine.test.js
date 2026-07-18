// @ts-check
'use strict';
/**
 * Unit tests for save-engine.js (Stage 1 of the save/sync-engine extraction):
 * createSaveEngine(ctx) with a fully stubbed ctx — the first Node-testable
 * slice of the engine. Covers the checkout keep-alive skip ladder + expiry
 * routing and the global force-reload decision (newer server stamp -> pending
 * stamp written, caches dropped, reload; stale stamp -> no reload).
 *
 * Pattern per line-metrics.test.js: assign the constants.js exports onto
 * globalThis first (the engine reads GLOBAL_RELOAD_* / CHECKOUT_* by bare
 * name), then require the engine.
 */
const { test } = require('node:test');
const assert = require('node:assert');

Object.assign(globalThis, require('./constants.js'));
// Local bindings for the keys this file asserts on (the globalThis assign
// above feeds the engine; the lint test-group doesn't know module globals).
const { GLOBAL_RELOAD_STAMP_KEY, PENDING_GLOBAL_RELOAD_STAMP_KEY } = require('./constants.js');

// Browser-global stubs the force-reload path touches. `window` stays
// undefined, so the caches-clear branch throws and is swallowed by its try.
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
globalThis.location = { reload: () => { reloads++; } };
globalThis.indexedDB = { deleteDatabase: (n) => { deletedDbs.push(n); } };

const { createSaveEngine } = require('./save-engine.js');

function makeCtx(overrides) {
  const calls = { events: [], debug: [], expired: 0 };
  const ctx = {
    getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', isViewer: false }),
    getSupabase: () => ({}),
    isSupabaseEnabled: () => true,
    withTimeout: (p) => p,
    pushSaveEvent: (kind, msg, detail) => calls.events.push({ kind, msg, detail }),
    saveDebugLog: (phase, payload) => calls.debug.push({ phase, payload }),
    probeCheckoutLock: async () => ({ expired: false }),
    handleBackgroundCheckoutExpired: async () => { calls.expired++; },
    isAutoSaveSuspended: () => false,
    getLastCheckoutRefreshAt: () => 0,
    ...overrides,
  };
  return { ctx, calls };
}

test('keepalive: no client or disabled -> silent no-op', async () => {
  const a = makeCtx({ getSupabase: () => null });
  await createSaveEngine(a.ctx).checkoutKeepalive();
  assert.strictEqual(a.calls.debug.length, 0);
  const b = makeCtx({ isSupabaseEnabled: () => false });
  await createSaveEngine(b.ctx).checkoutKeepalive();
  assert.strictEqual(b.calls.debug.length, 0);
});

test('keepalive: viewer and suspended sessions skip with a logged reason', async () => {
  const a = makeCtx({ getState: () => ({ supabaseSession: { user: { id: 'u1' } }, currentProjectId: 'p1', checkedOutBy: 'u1', isViewer: true }) });
  await createSaveEngine(a.ctx).checkoutKeepalive();
  assert.deepStrictEqual(a.calls.debug[0], { phase: 'keepalive.skip', payload: { reason: 'viewer' } });

  const b = makeCtx({ isAutoSaveSuspended: () => true });
  await createSaveEngine(b.ctx).checkoutKeepalive();
  assert.deepStrictEqual(b.calls.debug[0], { phase: 'keepalive.skip', payload: { reason: 'suspended' } });
});

test('keepalive: recent checkout refresh debounces the probe', async () => {
  let probed = 0;
  const { ctx, calls } = makeCtx({
    getLastCheckoutRefreshAt: () => Date.now(),
    probeCheckoutLock: async () => { probed++; return { expired: false }; },
  });
  await createSaveEngine(ctx).checkoutKeepalive();
  assert.strictEqual(probed, 0);
  assert.deepStrictEqual(calls.debug[0], { phase: 'keepalive.skip', payload: { reason: 'debounced' } });
});

test('keepalive: healthy probe ticks without expiry handling', async () => {
  const { ctx, calls } = makeCtx();
  await createSaveEngine(ctx).checkoutKeepalive();
  assert.strictEqual(calls.debug[0].phase, 'keepalive.tick');
  assert.strictEqual(calls.expired, 0);
  assert.strictEqual(calls.events.length, 0);
});

test('keepalive: expired probe pushes keepalive_expired and routes background recovery', async () => {
  const { ctx, calls } = makeCtx({ probeCheckoutLock: async () => ({ expired: true }) });
  await createSaveEngine(ctx).checkoutKeepalive();
  assert.strictEqual(calls.events[0].kind, 'keepalive_expired');
  assert.strictEqual(calls.expired, 1);
});

test('keepalive: a throwing background recovery is contained and logged', async () => {
  const { ctx, calls } = makeCtx({
    probeCheckoutLock: async () => ({ expired: true }),
    handleBackgroundCheckoutExpired: async () => { throw new Error('boom'); },
  });
  await createSaveEngine(ctx).checkoutKeepalive();   // must not reject
  assert.strictEqual(calls.events[1].kind, 'background_recovery_threw');
});

test('force reload: disabled or signed-out never queries', async () => {
  let queried = 0;
  const supabase = { from: () => { queried++; return supabase; }, select: () => supabase, eq: () => supabase, single: async () => ({ data: null }) };
  const a = makeCtx({ isSupabaseEnabled: () => false, getSupabase: () => supabase });
  await createSaveEngine(a.ctx).checkGlobalForceReload();
  const b = makeCtx({ getState: () => ({ supabaseSession: null }), getSupabase: () => supabase });
  await createSaveEngine(b.ctx).checkGlobalForceReload();
  assert.strictEqual(queried, 0);
});

function supabaseWithStamp(valueTs) {
  const chain = {
    from: () => chain, select: () => chain, eq: () => chain,
    single: async () => ({ data: { value_ts: valueTs, value_text: 'maintenance' }, error: null }),
  };
  return chain;
}

test('force reload: newer server stamp writes the pending stamp, drops the IDB cache, reloads', async () => {
  globalThis.localStorage = freshLocalStorage();
  localStorage.setItem(GLOBAL_RELOAD_STAMP_KEY, '1000');
  reloads = 0; deletedDbs = [];
  const state = { supabaseSession: { user: { id: 'u1' } } };
  const { ctx, calls } = makeCtx({ getState: () => state, getSupabase: () => supabaseWithStamp(new Date(5000).toISOString()) });
  await createSaveEngine(ctx).checkGlobalForceReload();
  assert.strictEqual(reloads, 1);
  assert.deepStrictEqual(deletedDbs, ['clickcount-pdf-cache']);
  assert.strictEqual(localStorage.getItem(PENDING_GLOBAL_RELOAD_STAMP_KEY), '5000');
  assert.strictEqual(state.globalReloadReason, 'maintenance');
  assert.strictEqual(calls.events[0].kind, 'global_reload_triggered');
});

test('force reload: stale server stamp records state but does not reload', async () => {
  globalThis.localStorage = freshLocalStorage();
  localStorage.setItem(GLOBAL_RELOAD_STAMP_KEY, '9999999');
  reloads = 0;
  const state = { supabaseSession: { user: { id: 'u1' } } };
  const { ctx } = makeCtx({ getState: () => state, getSupabase: () => supabaseWithStamp(new Date(5000).toISOString()) });
  await createSaveEngine(ctx).checkGlobalForceReload();
  assert.strictEqual(reloads, 0);
  assert.strictEqual(state.globalReloadAtServerMs, 5000);
});

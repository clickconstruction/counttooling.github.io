// @ts-check
/**
 * Tests: features/save-project.js — specifically preflightCheckoutExpiry, the
 * three-tier checkout-expiry guard on manual save (previously the riskiest
 * UNTESTED logic in features/: it decides whether a save proceeds, stops, or
 * routes into checkout recovery). Non-cloud: every dep is read via App.* at
 * call time, so each tier is driven with per-call stubs; timings come from the
 * real CHECKOUT_* constants so a tuning change re-verifies the tiers.
 */
const { test, expect } = require('@playwright/test');
/* global CHECKOUT_INACTIVITY_MS, CHECKOUT_NEAR_EXPIRY_MS, CHECKOUT_SOFT_GRACE_MS --
   page.evaluate() arrows run in the browser, where constants.js's top-level
   consts are in the global lexical scope (not on window). */

/** Run the preflight in-page with stubbed App deps; returns observed calls. */
async function runPreflight(page, { ageOffsetMs, probeResult, recovered }) {
  return page.evaluate(async ({ ageOffsetMs, probeResult, recovered }) => {
    const App = window.App;
    const calls = { probes: 0, recoveries: 0, recoveryModal: 0, toasts: 0, cleared: 0 };
    const user = { id: 'u1' };
    App.state.supabaseSession = { user };
    App.state.currentProjectId = 'p1';
    App.state.checkedOutBy = 'u1';
    App.state.checkedOutEmail = 'me@example.com';
    App.state.checkedOutAt = new Date(Date.now() - ageOffsetMs).toISOString();
    const orig = {};
    const stub = (k, fn) => { orig[k] = App[k]; App[k] = fn; };
    stub('probeCheckoutLock', async () => { calls.probes++; return probeResult; });
    stub('handleBackgroundCheckoutExpired', async () => { calls.recoveries++; return recovered; });
    stub('refreshProjectPermissions', async () => {});
    stub('openCheckoutExpiredRecoveryModal', () => { calls.recoveryModal++; });
    stub('showToast', () => { calls.toasts++; });
    stub('clearUndoStacks', () => { calls.cleared++; });
    stub('saveDebugLog', () => {});
    try {
      const errEl = document.getElementById('saveProjectError');
      const proceed = await App.preflightCheckoutExpiry(user, errEl);
      return { proceed, calls, checkedOutBy: App.state.checkedOutBy };
    } finally {
      Object.keys(orig).forEach((k) => { App[k] = orig[k]; });
      App.state.currentProjectId = null;
      App.state.checkedOutBy = null;
      App.state.checkedOutAt = null;
      App.state.checkedOutEmail = null;
      App.state.supabaseSession = null;
    }
  }, { ageOffsetMs, probeResult, recovered });
}

test.describe('Save Project (features/save-project.js)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
  });

  test('registry contract: preflightCheckoutExpiry is a function; no-lock save proceeds', async ({ page }) => {
    expect(await page.evaluate(() => typeof window.App?.preflightCheckoutExpiry)).toBe('function');
    // No project / not the lock holder: proceed without touching the server.
    const r = await page.evaluate(async () => {
      const errEl = document.getElementById('saveProjectError');
      return window.App.preflightCheckoutExpiry({ id: 'nobody' }, errEl);
    });
    expect(r).toBe(true);
  });

  test('fresh checkout proceeds without probing the server', async ({ page }) => {
    const r = await runPreflight(page, {
      ageOffsetMs: 60 * 1000,   // 1 minute old — far inside the window
      probeResult: { ok: true, expired: false },
      recovered: null,
    });
    expect(r.proceed).toBe(true);
    expect(r.calls.probes).toBe(0);
    expect(r.calls.recoveries).toBe(0);
  });

  test('near-expiry probes the server; an alive lock proceeds', async ({ page }) => {
    const nearExpiry = await page.evaluate(() => CHECKOUT_INACTIVITY_MS - CHECKOUT_NEAR_EXPIRY_MS / 2);
    const r = await runPreflight(page, {
      ageOffsetMs: nearExpiry,
      probeResult: { ok: true, expired: false },
      recovered: null,
    });
    expect(r.proceed).toBe(true);
    expect(r.calls.probes).toBe(1);
    expect(r.calls.recoveries).toBe(0);
  });

  test('near-expiry probe failure stops the save with a toast (no recovery)', async ({ page }) => {
    const nearExpiry = await page.evaluate(() => CHECKOUT_INACTIVITY_MS - CHECKOUT_NEAR_EXPIRY_MS / 2);
    const r = await runPreflight(page, {
      ageOffsetMs: nearExpiry,
      probeResult: { ok: false, expired: false },
      recovered: null,
    });
    expect(r.proceed).toBe(false);
    expect(r.calls.toasts).toBe(1);
    expect(r.calls.recoveries).toBe(0);
  });

  test('probe-confirmed expiry with silent re-checkout stops this save, no modal', async ({ page }) => {
    const nearExpiry = await page.evaluate(() => CHECKOUT_INACTIVITY_MS - CHECKOUT_NEAR_EXPIRY_MS / 2);
    const r = await runPreflight(page, {
      ageOffsetMs: nearExpiry,
      probeResult: { ok: true, expired: true },
      recovered: { silentlyRecovered: true },
    });
    expect(r.proceed).toBe(false);
    expect(r.calls.probes).toBe(1);
    expect(r.calls.recoveries).toBe(1);
    expect(r.calls.recoveryModal).toBe(0);
    expect(r.calls.cleared).toBe(1);   // undo stacks cleared before recovery
  });

  test('hard-skew expiry skips the probe, opens recovery modal, zeroes the local lock', async ({ page }) => {
    const pastGrace = await page.evaluate(() => CHECKOUT_INACTIVITY_MS + CHECKOUT_SOFT_GRACE_MS + 60 * 1000);
    const r = await runPreflight(page, {
      ageOffsetMs: pastGrace,
      probeResult: { ok: true, expired: false },   // must NOT be consulted
      recovered: null,                              // recovery could not silently re-checkout
    });
    expect(r.proceed).toBe(false);
    expect(r.calls.probes).toBe(0);
    expect(r.calls.recoveries).toBe(1);
    expect(r.calls.recoveryModal).toBe(1);
    expect(r.checkedOutBy).toBe(null);   // zeroed because refresh did not reassign the lock
  });
});

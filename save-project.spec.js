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
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
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

  // MAP-MANUAL-SAVE: a cloud bid opened without its PDF (load-project.js's canvas-only
  // branch: project open, pages [], the saved marks waiting in pendingCanvasLoad). A
  // manual Save there wrote pages: [] over the marks. The dialog now says why it can't
  // save and has no live Save button, and the engine sends nothing even when called.
  test('canvas-only: the Save dialog says the marks cannot be saved until the PDF is back, and nothing is sent', async ({ page }) => {
    const writes = [];
    await page.route('**/rest/v1/**', (route) => {
      const m = route.request().method();
      if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') writes.push(m + ' ' + route.request().url());
      return route.abort();
    });
    await page.evaluate(() => {
      const s = window.state;
      s.supabaseSession = { user: { id: 'u1', email: 'me@example.com' }, access_token: 'x' };
      s.currentProjectId = 'p-canvas-only';
      s.currentProjectName = 'Clinic';
      s.checkedOutBy = 'u1';
      s.checkedOutAt = new Date().toISOString();
      s.pages = [];
      s.pdfStoragePath = 'u1/p-canvas-only/document.pdf';   // the pdf_missing branch keeps pdf_path
      s.pendingCanvasLoad = {
        projectId: 'p-canvas-only', name: 'Clinic', pdf_hash: null,
        data: { counters: [{ id: 'wc', name: 'WC' }], lineTypes: [], pages: [{ index: 0, canvases: [{ id: 'c', name: 'Main', annotations: { counterMarkers: { wc: [{ x: 10, y: 20 }] } } }] }] },
      };
      document.getElementById('saveProjectBtn').click();
    });
    await expect(page.locator('#saveProjectModal')).toHaveClass(/visible/);
    const note = page.locator('#saveProjectNoPdfMessage');
    await expect(note).toBeVisible();
    await expect(note).toHaveText(/PDF is not attached, so its marks can.t be saved yet/);
    await expect(page.locator('#saveProjectContentsList')).toBeHidden();
    await expect(page.locator('#saveProjectDo')).toBeDisabled();
    // The engine holds the write on its own, too: a caller that reaches it anyway
    // (not the dialog) gets a hold, not a failure, and no request leaves the page.
    const res = await page.evaluate(async () => {
      const r = await window.App.performSaveProjectToCloud({ name: 'Renamed', includePdf: true });
      return { ok: r.ok, skipped: !!r.skipped, reason: r.reason || null, name: window.state.currentProjectName };
    });
    expect(res).toEqual({ ok: true, skipped: true, reason: 'canvas_only_pending_pdf', name: 'Clinic' });
    expect(writes).toEqual([]);
    // Once the PDF is back (no pending load), the dialog is the ordinary one again.
    await page.evaluate(() => {
      window.App.hideModal('saveProjectModal');
      window.state.pendingCanvasLoad = null;
      window.state.pdfStoragePath = null;
      document.getElementById('saveProjectBtn').click();
    });
    await expect(page.locator('#saveProjectModal')).toHaveClass(/visible/);
    await expect(note).toHaveText('Canvas only. Upload a PDF first to include it in saves.');
    await expect(page.locator('#saveProjectDo')).toBeEnabled();
    await page.evaluate(() => {
      window.App.hideModal('saveProjectModal');
      Object.assign(window.state, { supabaseSession: null, currentProjectId: null, currentProjectName: null, checkedOutBy: null, checkedOutAt: null });
    });
  });
});

// @ts-check
/**
 * Tests: the window.App registry pilot #18 - the on-demand Save Status modal
 * extracted to features/save-status.js still opens, renders its activity list,
 * toggles Verbose, and closes. The hot-path bell + the save engine stay in
 * app.js; the modal reads engine state via publish-only deps + the
 * App.getSaveStatusLog() / App.isCheckoutExpiredAttention() getter accessors.
 *
 * The modal does not require sign-in (it renders from local state), so this spec
 * drives it via the registry. Export/Copy hit the download/clipboard APIs, so we
 * only assert the buttons exist and clicking does not throw (their handlers catch
 * failures); we do not assert clipboard/download contents.
 */
const { test, expect } = require('@playwright/test');

test.describe('window.App registry pilot - Save Status modal', () => {
  test('registry wired; modal opens, renders, toggles, and closes with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Registry contract.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openSaveStatusModal,
      render: typeof window.App?.renderSaveStatusModalContent,
      getLog: typeof window.App?.getSaveStatusLog,
      attn: typeof window.App?.isCheckoutExpiredAttention,
    }));
    expect(wired).toEqual({ open: 'function', render: 'function', getLog: 'function', attn: 'function' });

    // 2. Open via the registry; the modal renders its activity list.
    await page.evaluate(() => window.App.openSaveStatusModal());
    await page.waitForSelector('#saveStatusModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => {
      const el = document.getElementById('saveStatusEventList');
      return !!el && el.innerHTML.length > 0;
    })).toBe(true);

    // 3. VERBOSE toggle: flip it and re-render (programmatic to avoid toggle-switch
    //    actionability quirks); the state debug flag tracks the checkbox.
    await page.evaluate(() => {
      const cb = document.getElementById('saveStatusVerboseToggle');
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(await page.evaluate(() => window.App.isSaveDebugEnabled())).toBe(true);

    // 4. EXPORT / COPY buttons exist and clicking does not throw (handlers catch).
    const btns = await page.evaluate(() => ({
      exportExists: !!document.getElementById('saveStatusExportBtn'),
      copyExists: !!document.getElementById('saveStatusCopyBtn'),
    }));
    expect(btns).toEqual({ exportExists: true, copyExists: true });
    await page.evaluate(() => { document.getElementById('saveStatusExportBtn').click(); document.getElementById('saveStatusCopyBtn').click(); });
    await page.waitForTimeout(200);

    // 5. CLOSE dismisses the modal.
    await page.locator('#saveStatusModalClose').click();
    await page.waitForFunction(
      () => !document.getElementById('saveStatusModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    expect(errors).toEqual([]);
  });

  test('export envelope carries the diagnostic enrichment fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const env = await page.evaluate(async () => await window.App.buildSaveLogsEnvelopeWithSnapshots());

    // Schema stays v1 (additive); the new top-level + timing + project diagnostic
    // keys are present.
    expect(env.schema).toBe('clickcount-save-logs/v1');
    expect(typeof env.tabSessionId).toBe('string');
    expect(env.tabSessionId.length).toBeGreaterThan(0);
    for (const k of ['sessionExpiresAt', 'secondsToExpiry', 'clientRecycles', 'autosaveLatencyP95', 'degradedForMs', 'nextAutoSaveAttemptInMs']) {
      expect(k in env.timing).toBe(true);
    }
    // project is null until a project is loaded, but the key exists; lastLocalBackup
    // is always attached by the async builder.
    expect('project' in env).toBe(true);
    expect(env.lastLocalBackup && typeof env.lastLocalBackup === 'object').toBe(true);
    expect('ok' in env.lastLocalBackup).toBe(true);
  });
});

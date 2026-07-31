// @ts-check
/**
 * features/tool-context-menu.js: right-click (contextmenu) on the tool
 * buttons, centralized from the nine one-off handlers that lived in app.js
 * and features/counter.js. Pins: the declarative map's coverage (ids +
 * action labels, via the App.__toolContextMap seam), the primary action
 * firing on real right-clicks (Counter -> Counter Settings, Quick Line /
 * Polyline / active-line-type chip -> Line Type Settings, Multiply Zone ->
 * Multiply Zone Settings), default-context-menu suppression, and the viewer
 * no-op gate.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function bootWithPdf(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

async function rightClickOpens(page, buttonId, modalId) {
  await page.locator('#' + buttonId).click({ button: 'right' });
  await expect(page.locator('#' + modalId)).toHaveClass(/visible/, { timeout: 5000 });
  await page.evaluate((id) => window.App.hideModal(id), modalId);
}

test.describe('Tool context menu (features/tool-context-menu.js)', () => {
  test('map coverage: all nine ids wired with their action labels', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    const map = await page.evaluate(() => window.App.__toolContextMap());
    expect(map).toEqual({
      counterBtn: ['Counter Settings…'],
      counterBtnSidebar: ['Counter Settings…'],
      quickLine: ['Line Type Settings…'],
      quickLineSidebar: ['Line Type Settings…'],
      polylineBtn: ['Line Type Settings…'],
      polylineBtnSidebar: ['Line Type Settings…'],
      headerActiveLineType: ['Line Type Settings…'],
      multiplyZoneBtn: ['Multiply Zone Settings…'],
      multiplyZoneBtnSidebar: ['Multiply Zone Settings…'],
    });
    expect(errors).toEqual([]);
  });

  test('right-click opens the mapped settings modal (header buttons)', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    await rightClickOpens(page, 'counterBtn', 'counterSettingsModal');
    await rightClickOpens(page, 'quickLine', 'lineTypeSettingsModal');
    await rightClickOpens(page, 'polylineBtn', 'lineTypeSettingsModal');
    await rightClickOpens(page, 'multiplyZoneBtn', 'multiplyZoneSettingsModal');
    expect(errors).toEqual([]);
  });

  test('viewer gate: right-click is a no-op for view-link sessions', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    await page.evaluate(() => {
      window.App.state.isViewer = true;
      // Dispatch directly — the buttons are hidden for viewers, so a real
      // pointer click can't reach them; the handler's own gate is the pin.
      document.getElementById('counterBtn').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      document.getElementById('multiplyZoneBtn').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#counterSettingsModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#multiplyZoneSettingsModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('default browser context menu is suppressed on wired buttons', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    const prevented = await page.evaluate(() => {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.getElementById('quickLine').dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(true);
    expect(errors).toEqual([]);
  });
});

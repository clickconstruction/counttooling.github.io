// @ts-check
/**
 * features/tool-context-menu.js: right-click (contextmenu) on the tool
 * buttons opens the #toolContextMenu mini menu; tools with no settings
 * answer with a toast. Pins: the declarative map's coverage (ids + action
 * labels + the toast list, via the App.__toolContextMap seam), the popover
 * flow (items rendered, click routes to the target modal, menu closes),
 * multi-action menus (Counter -> Settings + Add), the Grid target opening
 * settings WITHOUT toggling the overlay, Escape closing only the menu (the
 * app's global Escape handler must not also fire), outside-click dismissal,
 * the toast fallback, the viewer no-op gate, and default-context-menu
 * suppression.
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

async function menuLabels(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('#toolContextMenu button')].map((b) => b.textContent));
}

// The ⋯ More tools tuck is UNCONDITIONAL on desktop (2026-08-15), so the
// low-frequency tool buttons are never inline — the real user path to their
// settings is right-clicking the ⋯ menu row, which forwards the contextmenu
// to the source button. Visible buttons still take the direct right-click.
async function rightClickTool(page, btnId, moreRowText) {
  const btn = page.locator('#' + btnId);
  if (await btn.isVisible()) {
    await btn.click({ button: 'right' });
    return;
  }
  await page.locator('#headerMoreBtn').click();
  await page.locator('#headerMoreMenu .hm-row', { hasText: moreRowText }).click({ button: 'right' });
}

test.describe('Tool context menu (features/tool-context-menu.js)', () => {
  test('map coverage: wired ids, action labels, and the toast list', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    const map = await page.evaluate(() => window.App.__toolContextMap());
    const counter = ['Counter Settings…', 'Add counter…'];
    const lineType = ['Line Type Settings…', 'Add line type…'];
    expect(map.tools).toEqual({
      moveBtn: ['Set / edit scale…'], moveBtnSidebar: ['Set / edit scale…'],
      measureBtn: ['Set / edit scale…'], measureBtnSidebar: ['Set / edit scale…'],
      counterBtn: counter, counterBtnSidebar: counter, headerActiveCounter: counter,
      quickLine: lineType, quickLineSidebar: lineType,
      polylineBtn: lineType, polylineBtnSidebar: lineType, headerActiveLineType: lineType,
      multiplyZoneBtn: ['Multiply Zone Settings…'], multiplyZoneBtnSidebar: ['Multiply Zone Settings…'],
      scaleZoneBtn: ['Scale Zone Settings…'], scaleZoneBtnSidebar: ['Scale Zone Settings…'],
      legendBtn: ['Legend Settings…'], legendBtnSidebar: ['Legend Settings…'],
      gridBtn: ['Grid Settings…'], gridBtnSidebar: ['Grid Settings…'],
    });
    expect(map.noSettings).not.toContain('moveBtn');
    expect(map.noSettings).not.toContain('measureBtn');
    expect(map.noSettings).not.toContain('scaleZoneBtn');
    expect(map.noSettings).toContain('highlightBtn');
    expect(map.noSettings).toContain('hideMarksBtn');
    expect(errors).toEqual([]);
  });

  test('move + measure: right-click offers Set / edit scale and opens the Set Scale modal', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    // With a scale already set, the same entry is the EDIT path — the modal
    // opens showing the current scale instead of being buried behind S.
    await page.evaluate(() => {
      window.App.state.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      window.App.updateUI();
    });
    for (const btn of ['moveBtn', 'measureBtn']) {
      await page.locator('#' + btn).click({ button: 'right' });
      await expect(page.locator('#toolContextMenu')).toBeVisible();
      expect(await menuLabels(page)).toEqual(['Set / edit scale…']);
      await page.locator('#toolContextMenu button').first().click();
      await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
      await expect(page.locator('#toolContextMenu')).toBeHidden();
      // The right-click must not have switched the active tool.
      const toolState = await page.evaluate(() => ({ tool: window.App.state.tool, none: window.App.TOOL.NONE }));
      expect(toolState.tool).toBe(toolState.none);
      await page.keyboard.press('Escape');
      await expect(page.locator('#scaleModal')).not.toHaveClass(/visible/);
    }
    expect(errors).toEqual([]);
  });

  test('counter menu: two items; Settings routes to the modal and closes the menu', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    await page.locator('#counterBtn').click({ button: 'right' });
    await expect(page.locator('#toolContextMenu')).toBeVisible();
    expect(await menuLabels(page)).toEqual(['Counter Settings…', 'Add counter…']);

    await page.locator('#toolContextMenu button', { hasText: 'Counter Settings' }).click();
    await expect(page.locator('#counterSettingsModal')).toHaveClass(/visible/);
    await expect(page.locator('#toolContextMenu')).toBeHidden();
    await page.evaluate(() => window.App.hideModal('counterSettingsModal'));

    // The second item opens the Create Counter flow.
    await page.locator('#counterBtn').click({ button: 'right' });
    await page.locator('#toolContextMenu button', { hasText: 'Add counter' }).click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('single-action menus route to their settings modals', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    for (const [btn, rowText, modal] of [
      ['quickLine', null, 'lineTypeSettingsModal'],
      ['multiplyZoneBtn', 'Multiply Zone', 'multiplyZoneSettingsModal'],
      ['legendBtn', 'Legend', 'legendSettingsModal'],
    ]) {
      await rightClickTool(page, btn, rowText);
      await expect(page.locator('#toolContextMenu')).toBeVisible();
      await page.locator('#toolContextMenu button').first().click();
      await expect(page.locator('#' + modal)).toHaveClass(/visible/, { timeout: 5000 });
      await page.evaluate((id) => window.App.hideModal(id), modal);
    }
    expect(errors).toEqual([]);
  });

  test('grid: right-click opens Grid Settings without toggling the overlay', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    await page.evaluate(() => { window.App.state.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' }; });
    const overlayBefore = await page.evaluate(() => !!window.App.state.showGridOverlay);
    await rightClickTool(page, 'gridBtn', 'Grid');
    await page.locator('#toolContextMenu button', { hasText: 'Grid Settings' }).click();
    await expect(page.locator('#gridSettingsModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => !!window.App.state.showGridOverlay)).toBe(overlayBefore);
    expect(errors).toEqual([]);
  });

  test('Escape closes only the menu; outside click dismisses too', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    // Open a modal underneath, then the menu on top: Escape must close the
    // menu and leave the modal up (capture-phase stopImmediatePropagation).
    await page.evaluate(() => window.App.openLegendSettingsModal());
    await expect(page.locator('#legendSettingsModal')).toHaveClass(/visible/);
    await page.locator('#counterBtn').click({ button: 'right' });
    await expect(page.locator('#toolContextMenu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#toolContextMenu')).toBeHidden();
    await expect(page.locator('#legendSettingsModal')).toHaveClass(/visible/);
    await page.evaluate(() => window.App.hideModal('legendSettingsModal'));

    await page.locator('#counterBtn').click({ button: 'right' });
    await expect(page.locator('#toolContextMenu')).toBeVisible();
    await page.locator('#pdfCanvas').click({ position: { x: 200, y: 200 }, force: true });
    await expect(page.locator('#toolContextMenu')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('tools with no settings toast instead of opening a menu', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    await rightClickTool(page, 'highlightBtn', 'Highlight');
    await expect(page.locator('#toolContextMenu')).toBeHidden();
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    expect(await page.locator('#airboardToastText').textContent()).toContain('No settings');
    expect(errors).toEqual([]);
  });

  test('viewer gate + default-context-menu suppression', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    const res = await page.evaluate(() => {
      window.App.state.isViewer = true;
      const ev1 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.getElementById('counterBtn').dispatchEvent(ev1);
      const ev2 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.getElementById('highlightBtn').dispatchEvent(ev2);
      return {
        menuHidden: document.getElementById('toolContextMenu').hidden,
        toastVisible: document.getElementById('airboardToastModal').classList.contains('visible'),
        prevented: ev1.defaultPrevented && ev2.defaultPrevented,
      };
    });
    expect(res.menuHidden).toBe(true);
    expect(res.toastVisible).toBe(false);
    expect(res.prevented).toBe(true);
    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: DUCT unit D22 — X2, the mobile layers peek (journeys/plans/_TODO.md
 * D22; _STAGE6.md X2).
 *
 * The desktop peek (#showAllCanvasesBtn) has existed since the peek shipped;
 * the phone's footer layers menu simply lacked the row, so mobile had no live
 * way to see two layers together. One row, the same state.showAllCanvases, no
 * new mode — and shown only where it works (2+ layers), because the flag
 * auto-clears below that. Plus B4's dialect: the menu says "Layers".
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const PDF = path.join(__dirname, 'test-page.pdf');

async function boot(page, errors, width = 390) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width, height: 780 });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(PDF);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

const addLayer = (page, name) => page.evaluate((n) => {
  const s = window.state;
  const page0 = s.pages[0];
  page0.canvases.push({ id: 'c-' + n, name: n, annotations: window.makeAnnotations() });
  window.App.updateUI();
}, name);

// The layers button TOGGLES the menu, so close it first — otherwise a second
// call in the same test just shuts it again.
const openMenu = async (page) => {
  await page.evaluate(() => document.getElementById('canvasMenu')?.classList.remove('visible'));
  await page.locator('#canvasLayersBtn').click();
  await expect(page.locator('#canvasMenu')).toHaveClass(/visible/);
};

test.describe('D22 — mobile layers peek (X2)', () => {
  /** @type {string[]} */
  let errors;
  test.beforeEach(async ({ page }) => { errors = []; await boot(page, errors); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('B4 dialect: the menu is titled Layers and adds a layer, not a canvas', async ({ page }) => {
    await expect(page.locator('#canvasLayersBtn')).toHaveAttribute('title', 'Layers');
    await expect(page.locator('#canvasLayersBtn')).toHaveAttribute('aria-label', 'Layers');
    await openMenu(page);
    await expect(page.locator('#canvasMenuTitle')).toHaveText('Layers');
    await expect(page.locator('#canvasMenuAdd')).toHaveText('+ Add layer');
  });

  test('the Show-all row appears only on a page with 2+ layers', async ({ page }) => {
    // One layer: the row would toggle a flag that auto-clears — so it is absent.
    await openMenu(page);
    await expect(page.locator('#canvasMenuShowAll')).toBeHidden();
    // A second layer brings it in.
    await addLayer(page, 'Gas');
    await openMenu(page);
    await expect(page.locator('#canvasMenuShowAll')).toBeVisible();
    await expect(page.locator('#canvasMenuShowAll')).toHaveText('Show all layers');
  });

  test('the row toggles the SAME state.showAllCanvases the desktop peek uses', async ({ page }) => {
    await addLayer(page, 'Gas');
    await openMenu(page);
    expect(await page.evaluate(() => window.state.showAllCanvases)).toBe(false);
    await page.locator('#canvasMenuShowAll').click();
    expect(await page.evaluate(() => window.state.showAllCanvases)).toBe(true);
    // The row now offers the way back, and says so.
    await openMenu(page);
    await expect(page.locator('#canvasMenuShowAll')).toHaveText('Show the active layer only');
    await expect(page.locator('#canvasMenuShowAll')).toHaveClass(/active/);
    await page.locator('#canvasMenuShowAll').click();
    expect(await page.evaluate(() => window.state.showAllCanvases)).toBe(false);
  });

  test('dropping back to one layer clears the peek and takes the row away', async ({ page }) => {
    await addLayer(page, 'Gas');
    await openMenu(page);
    await page.locator('#canvasMenuShowAll').click();
    expect(await page.evaluate(() => window.state.showAllCanvases)).toBe(true);
    // Remove the second layer: the existing auto-off rule clears the flag, and
    // the row goes with it.
    await page.evaluate(() => {
      window.state.pages[0].canvases = window.state.pages[0].canvases.slice(0, 1);
      window.App.updateUI();
    });
    expect(await page.evaluate(() => window.state.showAllCanvases)).toBe(false);
    await openMenu(page);
    await expect(page.locator('#canvasMenuShowAll')).toBeHidden();
  });

  test('desktop is unchanged: the dedicated peek button still owns the toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await addLayer(page, 'Gas');
    await expect(page.locator('#showAllCanvasesBtn')).toBeVisible();
    await page.locator('#showAllCanvasesBtn').click();
    expect(await page.evaluate(() => window.state.showAllCanvases)).toBe(true);
    await expect(page.locator('#showAllCanvasesBtn')).toHaveClass(/active/);
  });
});

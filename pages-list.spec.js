// @ts-check
/**
 * Tests: the sidebar Pages section renderer extracted to features/pages-list.js
 * (the lines-list recipe). Guards the registry contract (App.renderPagesList +
 * the new publish-only deps pageHasAnyAnnotations / startRename / exitEditMode)
 * and the moved behavior: rows render through the real updateUI path (which
 * reaches the feature defensively), title truncation splits long labels,
 * scale/annotation badges appear, and row click navigates.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Pages list (features/pages-list.js)', () => {
  test('registry wired; rows, truncation, badges, navigation all work', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Registry contract: entry point + the new publish-only deps.
    const wired = await page.evaluate(() => ({
      renderPagesList: typeof window.App?.renderPagesList,
      deps: ['pageHasAnyAnnotations', 'startRename', 'exitEditMode']
        .every((k) => typeof window.App[k] === 'function'),
    }));
    expect(wired.renderPagesList).toBe('function');
    expect(wired.deps).toBe(true);

    // Both pages rendered through the real (defensive) updateUI path.
    await expect(page.locator('#pagesList .sidebar-item')).toHaveCount(2);

    // Scale badge: setting a page scale turns its number badge yellow.
    await page.evaluate(() => {
      window.state.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft' };
      window.App.updateUI();
    });
    await expect(page.locator('#pagesList .sidebar-item').first().locator('.badge-scale-set')).toHaveCount(1);

    // Title truncation: a long label splits into start/end lines with the full
    // label preserved in the title attribute.
    await page.evaluate(() => {
      window.state.pages[1].label = 'A very long underground plumbing sheet title that overflows the sidebar';
      window.state.pagesTitlesTruncated = true;
      window.App.updateUI();
    });
    const row2 = page.locator('#pagesList .sidebar-item').nth(1);
    await expect(row2.locator('.name-line-start')).toHaveCount(1);
    await expect(row2.locator('.name-line-end')).toHaveCount(1);
    expect(await row2.locator('.name').getAttribute('title')).toContain('underground plumbing');

    // Row click navigates to that page.
    await row2.click();
    await page.waitForFunction(() => window.state.currentPage === 1);

    expect(errors).toEqual([]);
  });

  test('double-click renames the active row; other-row click still navigates + fit-zooms', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Regression (JOURNEY-MAP Tier-2 #27): double-clicking the ACTIVE row's
    // name must open the inline rename. Before the fix, the first click of the
    // double-click re-ran fitZoom -> updateUI -> renderPagesList, whose
    // innerHTML rebuild destroyed the clicked node so dblclick never fired.
    const activeName = page.locator('#pagesList .sidebar-item.active .name');
    await activeName.dblclick();
    const renameInput = page.locator('#pagesList .rename-input');
    await expect(renameInput).toHaveCount(1);

    // The rename actually lands.
    await renameInput.fill('Renamed via dblclick');
    await renameInput.press('Enter');
    await page.waitForFunction(() => window.state.pages[0].label === 'Renamed via dblclick');
    await expect(page.locator('#pagesList .sidebar-item').first().locator('.name')).toHaveText('Renamed via dblclick');

    // Badge-click rename path still works (Escape cancels without saving).
    await page.locator('#pagesList .sidebar-item.active .page-num-badge-editable').click();
    await expect(renameInput).toHaveCount(1);
    await renameInput.press('Escape');
    await expect(renameInput).toHaveCount(0);
    await page.waitForFunction(() => window.state.pages[0].label === 'Renamed via dblclick');

    // Clicking a DIFFERENT row still switches pages AND fit-zooms: pan is
    // knocked off-center first, then must be reset by fitZoom on the switch.
    await page.evaluate(() => { window.state.pan = { x: 55, y: 44 }; });
    await page.locator('#pagesList .sidebar-item').nth(1).click();
    await page.waitForFunction(() => window.state.currentPage === 1
      && window.state.pan.x === 0 && window.state.pan.y === 0);
    await expect(page.locator('#pagesList .sidebar-item').nth(1)).toHaveClass(/active/);

    expect(errors).toEqual([]);
  });
});

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

  test('double-click / double-tap rename survives the click-1 rebuild (T2 #27)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const rows = page.locator('#pagesList .sidebar-item');
    const renameInput = page.locator('#pagesList .rename-input');

    // Double-click an INACTIVE row's name: click 1 navigates (and rebuilds the
    // list — the old per-row binding died right here), click 2 reaches the
    // delegated container listener and opens the inline rename.
    await rows.nth(1).locator('.name').dblclick();
    await page.waitForFunction(() => window.state.currentPage === 1);
    await expect(renameInput).toHaveCount(1);
    await renameInput.fill('P-101 Underground');
    await page.keyboard.press('Enter');
    await expect(renameInput).toHaveCount(0);
    await page.waitForFunction(() => window.state.pages[1].label === 'P-101 Underground');
    await expect(rows.nth(1).locator('.name')).toHaveText('P-101 Underground');

    // Double-click the ACTIVE row's name: rename opens there too (click 1
    // refits zoom and still rebuilds). Escape restores the label.
    await rows.nth(1).locator('.name').dblclick();
    await expect(renameInput).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(renameInput).toHaveCount(0);
    await expect(rows.nth(1).locator('.name')).toHaveText('P-101 Underground');

    // Control: a single click just navigates — no rename after the 400ms window.
    await rows.nth(0).locator('.name').click();
    await page.waitForFunction(() => window.state.currentPage === 0);
    await page.waitForTimeout(450);
    await expect(renameInput).toHaveCount(0);

    // Control: two quick clicks on two DIFFERENT rows reset the window and
    // just navigate.
    await rows.nth(1).locator('.name').click();
    await rows.nth(0).locator('.name').click();
    await page.waitForFunction(() => window.state.currentPage === 0);
    await page.waitForTimeout(450);
    await expect(renameInput).toHaveCount(0);

    // Regression: the page-number badge's single-click rename + trash button
    // are untouched (the J2 control check).
    await rows.nth(0).locator('.page-num-badge-editable').click();
    await expect(page.locator('#pagesList .rename-with-delete')).toHaveCount(1);
    await expect(page.locator('#pagesList .page-delete-btn')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(renameInput).toHaveCount(0);

    // Viewer gate: viewers get navigation only — double-click opens nothing.
    await page.evaluate(() => { window.state.isViewer = true; window.App.updateUI(); });
    await rows.nth(1).locator('.name').dblclick();
    await page.waitForFunction(() => window.state.currentPage === 1);
    await page.waitForTimeout(450);
    await expect(renameInput).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});

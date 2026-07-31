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
});

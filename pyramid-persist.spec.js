// @ts-check
/**
 * Tests: the cross-session persistent pyramid.
 *
 * Rastered RUNG bitmaps persist to IndexedDB (webp, keyed by document content
 * hash + page + rotation + rung + effDpr). On a fresh session with the same
 * document, the ladder restores lazily on first render — so "yesterday's"
 * zoom levels are warm before the user zooms at all.
 *
 * Flow: load → rung prefetches raster + persist (stats.persisted rises) →
 * RELOAD the page (fresh JS state, same IndexedDB) → load the same file →
 * stats.restored rises and the cache holds restored rung keys without new
 * rasters for them.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.waitForFunction(() => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
    return !!c && c.width > 0;
  });
}

test.describe('Persistent pyramid', () => {
  test('rungs persist; a fresh session restores them without rasters', async ({ page }) => {
    const errors = [];
    await boot(page, errors);

    // Session 1: the idle prefetcher rasters rungs; captures persist.
    await page.waitForFunction(() => window.App.__pdfBitmapCacheStats().persisted >= 1, null, { timeout: 20000 });
    const persisted = await page.evaluate(() => window.App.__pdfBitmapCacheStats().persisted);
    expect(persisted).toBeGreaterThanOrEqual(1);

    // Session 2: fresh page (JS state gone, IndexedDB intact), same file.
    await page.reload();
    await boot(page, errors);
    await page.waitForFunction(() => window.App.__pdfBitmapCacheStats().restored >= 1, null, { timeout: 20000 });

    const after = await page.evaluate(() => ({
      stats: window.App.__pdfBitmapCacheStats(),
      keys: window.App.__pdfBitmapCacheKeys().length,
    }));
    expect(after.stats.restored).toBeGreaterThanOrEqual(1);
    expect(after.keys).toBeGreaterThanOrEqual(1);

    expect(errors).toEqual([]);
  });
});

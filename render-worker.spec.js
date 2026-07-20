// @ts-check
/**
 * Tests: the render worker (option 4 — off-main-thread pdf.js rasters).
 *
 * All rasters flow through render-service.js; when Worker + OffscreenCanvas
 * are available the service lazily "adopts" the current document (bytes read
 * back via the pinned pdf.js transport) into a dedicated render worker and
 * subsequent rasters happen off the main thread, returning ImageBitmaps.
 *
 *   1. Worker mode: adoption reaches 'ready' after boot, a fresh cold raster
 *      is worker-rastered, and the canvas has real content.
 *   2. Escape hatch: with window.DISABLE_RENDER_WORKER set (config-level),
 *      everything renders on the main thread exactly as before.
 *
 * (Every OTHER Playwright spec also exercises the worker path implicitly in
 * Chromium once this ships — this spec pins the mode transitions.)
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
  await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, null, { timeout: 15000 });
}

function canvasHasContentFn() {
  const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
  const s = document.createElement('canvas');
  s.width = 64; s.height = 64;
  const g = /** @type {CanvasRenderingContext2D} */ (s.getContext('2d'));
  g.drawImage(c, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
  return false;
}

test.describe('Render worker', () => {
  test('adopts the document and rasters off the main thread', async ({ page }) => {
    const errors = [];
    await boot(page, errors);

    // Lazy adoption kicks on the first raster; wait for the worker to be live.
    await page.waitForFunction(() => window.App.__renderWorkerState() === 'ready', null, { timeout: 15000 });
    expect(await page.evaluate(() => window.App.__renderServiceMode())).toBe('worker');

    // Force a cold full raster and prove it ran in the worker.
    const result = await page.evaluate(async () => {
      const before = window.App.__renderServiceStats().workerRastered;
      window.App.clearPdfBitmapCache();
      window.App.renderPdf();
      await new Promise((r) => setTimeout(r, 1500));
      return {
        workerGained: window.App.__renderServiceStats().workerRastered - before,
        fallbacks: window.App.__renderServiceStats().fallbacks,
      };
    });
    expect(result.workerGained).toBeGreaterThanOrEqual(1);
    expect(result.fallbacks).toBe(0);
    expect(await page.evaluate(canvasHasContentFn)).toBe(true);

    // Page flip exercises the worker path end-to-end too.
    await page.locator('#nextPage').click();
    await page.waitForFunction(() => window.state.currentPage === 1, null, { timeout: 5000 });
    await page.waitForTimeout(400);
    expect(await page.evaluate(canvasHasContentFn)).toBe(true);

    expect(errors).toEqual([]);
  });

  test('DISABLE_RENDER_WORKER escape hatch keeps everything on the main thread', async ({ page }) => {
    const errors = [];
    await page.addInitScript(() => { window.DISABLE_RENDER_WORKER = true; });
    await boot(page, errors);
    await page.waitForTimeout(800);   // give any (wrong) adoption time to surface

    const s = await page.evaluate(() => ({
      state: window.App.__renderWorkerState(),
      mode: window.App.__renderServiceMode(),
      stats: window.App.__renderServiceStats(),
    }));
    expect(s.mode).toBe('main');
    expect(s.state).toBe('idle');                      // adoption never kicked
    expect(s.stats.workerRastered).toBe(0);
    expect(s.stats.mainRastered).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(canvasHasContentFn)).toBe(true);
    expect(errors).toEqual([]);
  });
});

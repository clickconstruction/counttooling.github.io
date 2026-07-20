// @ts-check
/**
 * Tests: idle prefetch of adjacent zoom rungs.
 *
 * After a zoom commit lands on a rung, the idle prefetcher (the same
 * machinery that pre-rasters neighbor pages) warms the current page at
 * rung+1 / rung-1 into the bitmap cache, so the NEXT zoom step in either
 * direction is a synchronous blit — no raster, no blur window at all.
 *
 * Flow: cold-step to a rung (raster allowed) -> wait for the idle prefetch to
 * raster the adjacent rung (prefetched stat rises) -> step again -> assert
 * ZERO new pdf.js render calls for that step (pure cache hit).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Adjacent-rung idle prefetch', () => {
  test('after a commit, the next rung is pre-rastered and the next step is a blit', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.waitForFunction(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      return !!c && c.width > 0;
    });

    // Raster counts come from the render-service stats (all kinds, both
    // backends), so no pdfPage.render wrapping is needed.

    // Cold +0.1 step (continuous zoom); its exact raster and the idle rung
    // prefetches run. Gate on the ACTUAL cache contents — the rung nearest
    // the current zoom plus both neighbors must be warm, so the next ±0.1
    // step (≤ one rung away in either direction) is guaranteed served.
    await page.evaluate(() => { window.App.doZoomIn(); });
    const rungs = await page.evaluate(() => {
      const maxZ = window.App.getMaxZoom();
      /* eslint-disable no-undef */
      const r0 = snapZoomToRung(window.state.zoom, 0.2, maxZ);
      return { r0, up: nextRungUp(r0, 0.2, maxZ), down: nextRungDown(r0, 0.2, maxZ) };
      /* eslint-enable no-undef */
    });
    await page.waitForFunction((r) => {
      const keys = window.App.__pdfBitmapCacheKeys();
      const has = (z) => keys.some((k) => Math.abs(k.zoom - z) < 1e-6);
      return has(r.r0) && has(r.up) && has(r.down);
    }, rungs, { timeout: 15000 });
    await page.waitForTimeout(400);

    const measured = await page.evaluate(async () => {
      const before = window.App.__renderServiceStats().byKind.full || 0;
      const hitsBefore = window.App.__pdfBitmapCacheStats().hits;
      window.App.doZoomIn();   // +0.1 lands within a prefetched rung -> pure blit
      await new Promise((r) => setTimeout(r, 200));   // sample BEFORE the 600ms exact-refine
      return {
        renders: (window.App.__renderServiceStats().byKind.full || 0) - before,   // visible path only — background prefetches may fire in this window
        hitsGained: window.App.__pdfBitmapCacheStats().hits - hitsBefore,
        prefetched: window.App.__pdfBitmapCacheStats().prefetched,
      };
    });
    expect(measured.prefetched).toBeGreaterThanOrEqual(1);
    expect(measured.hitsGained).toBeGreaterThanOrEqual(1);   // the step hit the cache
    expect(measured.renders).toBe(0);                        // and needed zero rasters

    expect(errors).toEqual([]);
  });
});

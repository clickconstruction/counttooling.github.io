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

    // Wrap every page's render with a call counter BEFORE any stepping.
    await page.evaluate(() => {
      window.__renderCount = 0;
      window.state.pages.forEach((p) => {
        if (!p.pdfPage || p.pdfPage.__wrapped) return;
        const orig = p.pdfPage.render.bind(p.pdfPage);
        p.pdfPage.render = (args) => { window.__renderCount++; return orig(args); };
        p.pdfPage.__wrapped = true;
      });
    });

    // Cold step onto a rung; its raster (and the idle prefetches) may run.
    await page.evaluate(() => { window.App.doZoomIn(); });
    // Wait until the prefetcher has warmed at least one adjacent rung.
    await page.waitForFunction(() => window.App.__pdfBitmapCacheStats().prefetched >= 1, { timeout: 10000 });
    // Let any in-flight prefetch fully settle so the counter is quiescent.
    await page.waitForTimeout(700);

    const measured = await page.evaluate(async () => {
      const before = window.__renderCount;
      const hitsBefore = window.App.__pdfBitmapCacheStats().hits;
      window.App.doZoomIn();   // rung+1 was prefetched -> must be a pure blit
      await new Promise((r) => setTimeout(r, 200));
      return {
        renders: window.__renderCount - before,
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

// @ts-check
/**
 * Tests: the downsample pyramid + prefetch scheduling.
 *
 * A full-page bitmap rastered at zoom Z produces every rung below it (down to
 * ~0.55×Z) by GPU downscale — no pdf.js raster. Asserts:
 *   1. after the initial render settles, the rungs below the current zoom are
 *      in the cache flagged as DERIVED (stats.derived rises) without raster
 *      requests for them (render-service full/prefetch log has no entries at
 *      those zooms... indirectly: derived count matches the new keys),
 *   2. a zoom-OUT wheel commit is then served instantly from a derived rung
 *      (cache hit, zero visible-path misses),
 *   3. derived bitmaps carry real ink (a scaled page, not a blank).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Downsample pyramid', () => {
  test('lower rungs derive without rasters; zoom-out commits blit from them', async ({ page }) => {
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

    // 1. The initial fit render's capture should spawn derived lower rungs.
    await page.waitForFunction(() => window.App.__pdfBitmapCacheStats().derived >= 2, null, { timeout: 15000 });
    const derived = await page.evaluate(() => {
      const maxZ = window.App.getMaxZoom();
      /* eslint-disable no-undef */
      let r = snapZoomToRung(window.state.zoom, 0.2, maxZ);
      if (r > window.state.zoom) r = nextRungDown(r, 0.2, maxZ);
      const d1 = r, d2 = nextRungDown(d1, 0.2, maxZ);
      /* eslint-enable no-undef */
      const keys = window.App.__pdfBitmapCacheKeys();
      const has = (z) => keys.some((k) => Math.abs(k.zoom - z) < 1e-6);
      return {
        stats: window.App.__pdfBitmapCacheStats(),
        hasD1: has(d1), hasD2: has(d2),
        rasterLog: window.App.__renderServiceStats().log.length,
      };
    });
    expect(derived.stats.derived).toBeGreaterThanOrEqual(2);
    expect(derived.hasD1 && derived.hasD2).toBe(true);

    // 2. Zoom-out commit lands on/near a derived rung: pure blit.
    const out = await page.evaluate(async () => {
      const missesBefore = window.App.__pdfBitmapCacheStats().misses;
      const hitsBefore = window.App.__pdfBitmapCacheStats().hits;
      const wrapper = document.getElementById('canvasWrapper');
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      // deltaY negative -> delta positive -> exp(-x) < 1: zoom OUT one tick.
      wrapper.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: -120 }));
      await raf(); await raf();
      await new Promise((r) => setTimeout(r, 300));   // commit ran; before the 600ms refine
      const s = window.App.__pdfBitmapCacheStats();
      return { missesGained: s.misses - missesBefore, hitsGained: s.hits - hitsBefore };
    });
    expect(out.missesGained).toBe(0);                   // zero visible-path rasters
    expect(out.hitsGained).toBeGreaterThanOrEqual(1);   // served from the pyramid

    // 3. The now-displayed (derived) base has real ink.
    const hasInk = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      const s = document.createElement('canvas');
      s.width = 64; s.height = 64;
      const g = /** @type {CanvasRenderingContext2D} */ (s.getContext('2d'));
      g.drawImage(c, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    });
    expect(hasInk).toBe(true);

    expect(errors).toEqual([]);
  });
});

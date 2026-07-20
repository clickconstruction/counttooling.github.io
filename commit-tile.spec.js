// @ts-check
/**
 * Tests: window-first cold zoom commit (the commit tile).
 *
 * When a zoom commit lands on a rung the bitmap cache does NOT have, the app
 * rasters the visible window at the new zoom FIRST (bounded, screen-sized)
 * and shows it over the CSS-stretched old base, then chains the slow
 * full-page raster; the tile is retired the moment the crisp base paints.
 *
 * The slow raster is simulated by wrapping pdfPage.render so that FULL-page
 * renders (any canvas that isn't #cropCanvas) resolve ~1.2s late, while tile
 * renders run at native speed — letting us assert the mid-flight state:
 * tile visible + old base still up + committed zoom already on a rung.
 * Warm commits (cache hit) must show no tile at all.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Window-first cold zoom commit', () => {
  test('cold commit shows the tile before the full raster; warm commit blits with no tile', async ({ page }) => {
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
    await page.waitForTimeout(400);   // let boot-time prefetches settle

    // Slow down FULL-page rasters only (tile renders into #cropCanvas).
    await page.evaluate(() => {
      const DELAY = 1200;
      window.state.pages.forEach((p) => {
        if (!p.pdfPage || p.pdfPage.__slowWrapped) return;
        const orig = p.pdfPage.render.bind(p.pdfPage);
        p.pdfPage.render = (args) => {
          const t = orig(args);
          const isTile = args?.canvasContext?.canvas === document.getElementById('cropCanvas');
          if (isTile) return t;
          return { promise: t.promise.then((v) => new Promise((res) => setTimeout(() => res(v), DELAY))), cancel: () => t.cancel() };
        };
        p.pdfPage.__slowWrapped = true;
      });
    });

    // Cold commit: empty the cache, then wheel-zoom and let the commit fire.
    const mid = await page.evaluate(async () => {
      window.App.clearPdfBitmapCache();
      const wrapper = document.getElementById('canvasWrapper');
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      const pdfC = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      const baseBufBefore = { w: pdfC.width, h: pdfC.height };
      for (let i = 0; i < 5; i++) {
        // deltaY +120 -> delta -120 -> factor exp(+0.12) > 1: ZOOM IN, so the
        // visible window shrinks well below the page and the tile pays off
        // (zooming out would cover ~the whole page and hit the 0.7 skip).
        wrapper.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: 120 }));
        await raf(); await raf();
      }
      // Past the 150ms debounce: the commit snapped + started tile-then-full.
      // Sample mid-flight, well inside the 1.2s full-raster delay.
      await new Promise((r) => setTimeout(r, 600));
      const crop = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      return {
        zoomAtCommit: window.state.zoom,
        tileVisible: crop.style.display !== 'none' && crop.width > 0,
        baseUnchanged: pdfC.width === baseBufBefore.w && pdfC.height === baseBufBefore.h,
      };
    });
    expect(mid.tileVisible).toBe(true);    // sharp window is up while the full raster crawls
    expect(mid.baseUnchanged).toBe(true);  // full-page base hasn't swapped yet

    // After the delayed raster lands: base swaps crisp, the commit tile retires
    // (no DPR deficit at this zoom in headless dpr=1).
    await page.waitForFunction(() => {
      const crop = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      return crop.style.display === 'none' || crop.width === 0;
    }, { timeout: 10000 });
    const zoomAfterCold = await page.evaluate(() => window.state.zoom);

    // Warm commit: the idle prefetcher warms the adjacent rungs of the rung
    // we just landed on; a one-tick wheel-out gesture then commits onto the
    // prefetched rung below — cache hit, so NO tile and an instant blit.
    // Wait for the DOWN rung specifically to land in the cache (the
    // `prefetched` stat is a lifetime counter — boot-time prefetches from
    // before our cache clear count toward it, so it can't be used as a gate;
    // the slow-raster wrapper delays prefetches too, hence the long timeout).
    // The rung nearest the cold zoom, one down — what a small zoom-out commit will be served from.
    // eslint-disable-next-line no-undef
    const downRung = await page.evaluate((z) => nextRungDown(snapZoomToRung(z, 0.2, window.App.getMaxZoom()), 0.2, window.App.getMaxZoom()), zoomAfterCold);
    await page.waitForFunction(
      (dz) => window.App.__pdfBitmapCacheKeys().some((k) => Math.abs(k.zoom - dz) < 1e-6),
      downRung,
      { timeout: 20000 }
    );
    await page.waitForTimeout(400);   // let the prefetch task fully settle
    const warm = await page.evaluate(async () => {
      const hitsBefore = window.App.__pdfBitmapCacheStats().hits;
      const wrapper = document.getElementById('canvasWrapper');
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      // One tick out: factor exp(-0.12) ~ x0.887 -> nearest rung is one below.
      wrapper.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: -120 }));
      await raf(); await raf();
      await new Promise((r) => setTimeout(r, 400));
      const crop = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      return {
        zoom: window.state.zoom,
        tileVisible: crop.style.display !== 'none' && crop.width > 0,
        hitsGained: window.App.__pdfBitmapCacheStats().hits - hitsBefore,
      };
    });
    expect(warm.zoom).toBeLessThan(zoomAfterCold);    // continuous value, one tick out
    expect(warm.tileVisible).toBe(false);             // warm path: no tile, straight blit
    expect(warm.hitsGained).toBeGreaterThanOrEqual(1);

    expect(errors).toEqual([]);
  });
});

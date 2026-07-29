// @ts-check
/**
 * Tests: the zoom rung cache with CONTINUOUS zoom values.
 *
 * state.zoom is never snapped — the ladder (0.2 × 1.15^n) is raster currency
 * only: renderPdf serves a commit from the exact-zoom bitmap if cached, else
 * from the nearest RUNG bitmap (CSS carries the ≤7% residual, and an idle
 * exact-refine re-rasters crisp ~600ms later), else rasters exact. The idle
 * prefetcher warms the nearest rung ± one in each direction, so nearby zoom
 * commits become synchronous blits. Asserts:
 *   1. a wheel gesture's committed zoom is CONTINUOUS (exactly the preview
 *      value — no snap),
 *   2. once the surrounding rungs are prefetched, a further small zoom commit
 *      is served with ZERO visible-path rasters (cache-miss stat frozen),
 *   3. the idle exact-refine then re-rasters at the exact display zoom
 *      (pdfCanvas buffer matches state.zoom, not the rung).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Zoom rung cache (continuous values)', () => {
  test('commits stay continuous; rung-served commits blit; idle refine lands exact', async ({ page }) => {
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

    // 1. Wheel gesture: the committed zoom is exactly the continuous preview
    //    value — no snapping.
    const first = await page.evaluate(async () => {
      const wrapper = document.getElementById('canvasWrapper');
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      for (let i = 0; i < 2; i++) {
        wrapper.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: 120 }));
        await raf(); await raf();
      }
      const previewZoom = window.state.zoom;
      await new Promise((r) => setTimeout(r, 400));   // past the 150ms debounce
      return { previewZoom, committedZoom: window.state.zoom };
    });
    expect(first.committedZoom).toBe(first.previewZoom);   // continuous — Wendi's ask

    // Wait for the prefetcher to warm the nearest rung and its neighbors
    // (gate on actual cache contents — the prefetched stat is lifetime).
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

    // 2. A small further zoom (≤ one rung away) commits with zero
    //    visible-path rasters — served from a rung bitmap.
    const blit = await page.evaluate(async () => {
      const missesBefore = window.App.__pdfBitmapCacheStats().misses;
      const hitsBefore = window.App.__pdfBitmapCacheStats().hits;
      const wrapper = document.getElementById('canvasWrapper');
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      wrapper.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: 120 }));
      await raf(); await raf();
      const previewZoom = window.state.zoom;
      await new Promise((r) => setTimeout(r, 300));   // commit ran; still before the 600ms refine
      const s = window.App.__pdfBitmapCacheStats();
      return {
        previewZoom,
        committedZoom: window.state.zoom,
        missesGained: s.misses - missesBefore,
        hitsGained: s.hits - hitsBefore,
      };
    });
    expect(blit.committedZoom).toBe(blit.previewZoom);   // still continuous
    expect(blit.missesGained).toBe(0);                   // zero visible-path rasters
    expect(blit.hitsGained).toBeGreaterThanOrEqual(1);   // served from the rung cache

    // 3. Idle exact-refine: ~600ms later the buffer matches the EXACT display
    //    zoom (not the rung it was blitted from).
    await page.waitForFunction(() => {
      const pdfC = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      const p = window.state.pages[window.state.currentPage];
      if (!p || !p.pdfPage) return false;
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      // headless dpr = 1 → buffer width should equal pagePts × state.zoom (±1px rounding)
      return Math.abs(pdfC.width - vp.width * window.state.zoom) <= 1;
    }, { timeout: 10000 });

    expect(errors).toEqual([]);
  });
});

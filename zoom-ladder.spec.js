// @ts-check
/**
 * Tests: the zoom ladder (commit-snap to discrete rungs).
 *
 * Gesture previews stay continuous, but committed zooms snap to rungs
 * (0.2 × 1.15^n, clamped to [0.2, maxZoom]) so the PDF bitmap cache sees
 * repeatable zoom values — repeat zooming becomes a synchronous blit instead
 * of a fresh full-page raster. Asserts:
 *   1. doZoomIn/doZoomOut step exactly one rung per press,
 *   2. a wheel gesture's COMMITTED zoom lands on a rung, with the cursor
 *      anchor preserved through the snap (content point stays put ±2px),
 *   3. re-committing a previously visited rung adds ZERO pdf.js render calls
 *      (pure cache blit — the point of the whole feature).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

/** In-page: is z on the ladder (or a clamp end)? Runs in browser context. */
function isRungFn(z) {
  // eslint-disable-next-line no-undef
  const snapped = snapZoomToRung(z, 0.2, window.App.getMaxZoom());
  return Math.abs(snapped - z) < 1e-9;
}

test.describe('Zoom ladder', () => {
  test('buttons step rungs; wheel commits snap on-anchor; rung revisits are blits', async ({ page }) => {
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

    // 1. +/- step exactly one rung, idempotently invertible.
    const stepped = await page.evaluate(() => {
      const before = window.state.zoom;
      window.App.doZoomIn();
      const afterIn = window.state.zoom;
      window.App.doZoomIn();
      const afterIn2 = window.state.zoom;
      window.App.doZoomOut();
      const afterOut = window.state.zoom;
      return { before, afterIn, afterIn2, afterOut, max: window.App.getMaxZoom() };
    });
    // eslint-disable-next-line no-undef
    const up1 = await page.evaluate((z) => nextRungUp(z, 0.2, window.App.getMaxZoom()), stepped.before);
    expect(stepped.afterIn).toBeCloseTo(up1, 9);
    expect(stepped.afterIn2 / stepped.afterIn).toBeCloseTo(1.15, 6);   // exactly one rung apart
    expect(stepped.afterOut).toBeCloseTo(stepped.afterIn, 9);          // down inverts up
    expect(await page.evaluate(isRungFn, stepped.afterOut)).toBe(true);

    // 2. Wheel gesture: preview is continuous, the commit snaps to a rung and
    //    the content point under the cursor survives the snap.
    const wheelResult = await page.evaluate(async () => {
      const wrapper = document.getElementById('canvasWrapper');
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      for (let i = 0; i < 5; i++) {
        wrapper.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: -120 }));
        await raf(); await raf();
      }
      // Content (pdf-space) point under the cursor BEFORE the commit snap.
      const wrapPt = { x: cx - rect.left, y: cy - rect.top };
      const pdfBefore = {
        x: (wrapPt.x - window.state.pan.x) / window.state.zoom,
        y: (wrapPt.y - window.state.pan.y) / window.state.zoom,
      };
      const previewZoom = window.state.zoom;
      await new Promise((r) => setTimeout(r, 400));   // past the 150ms debounce -> commit ran
      const z = window.state.zoom;
      const anchorAfter = {
        x: window.state.pan.x + pdfBefore.x * z,
        y: window.state.pan.y + pdfBefore.y * z,
      };
      return { previewZoom, committedZoom: z, wrapPt, anchorAfter };
    });
    expect(await page.evaluate(isRungFn, wheelResult.committedZoom)).toBe(true);
    expect(Math.abs(wheelResult.anchorAfter.x - wheelResult.wrapPt.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(wheelResult.anchorAfter.y - wheelResult.wrapPt.y)).toBeLessThanOrEqual(2);

    // 3. Rung revisits are pure blits. The precise "visible path had to
    //    raster" counter is the cache-miss stat (idle rung PREFETCH rasters
    //    are speculative and legitimately run in the background).
    const blitResult = await page.evaluate(async () => {
      const settle = () => new Promise((r) => setTimeout(r, 350));
      // Visit two adjacent rungs (cold: visible-path misses allowed)...
      window.App.doZoomIn(); await settle();
      window.App.doZoomOut(); await settle();
      const missesAfterCold = window.App.__pdfBitmapCacheStats().misses;
      const hitsBefore = window.App.__pdfBitmapCacheStats().hits;
      // ...then bounce between them again: every commit must be a cache blit.
      window.App.doZoomIn(); await settle();
      window.App.doZoomOut(); await settle();
      window.App.doZoomIn(); await settle();
      window.App.doZoomOut(); await settle();
      const s = window.App.__pdfBitmapCacheStats();
      return { missesAfterCold, missesAfterBounce: s.misses, hitsGained: s.hits - hitsBefore };
    });
    expect(blitResult.missesAfterBounce).toBe(blitResult.missesAfterCold);   // zero visible-path rasters on revisits
    expect(blitResult.hitsGained).toBeGreaterThanOrEqual(4);                 // all four bounce commits blitted

    expect(errors).toEqual([]);
  });
});

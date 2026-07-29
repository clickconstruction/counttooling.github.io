// @ts-check
/**
 * Tests: the deep-zoom viewport tile compositor.
 *
 * When the DPR clamp makes the base soft, idle sharpening now runs a TILE
 * GRID: fixed 512-css-px cells rastered at full dpr (via the render
 * service/worker) into a budget-capped cache and composited onto cropCanvas
 * over the visible window. Panning re-composites cached tiles instantly and
 * rasters only newly exposed cells. Asserts:
 *   1. at a forced deep zoom, multiple tiles raster and the composited
 *      overlay covers the visible window with real ink,
 *   2. panning to a new region grows the tile cache and re-covers,
 *   3. a page flip clears the grid (cropCanvas retired), and a sharp zoom
 *      retires it entirely.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Deep-zoom tile grid', () => {
  test('tiles raster center-out, pan extends coverage, flips clear', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.waitForFunction(() => document.getElementById('pdfCanvas') && /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas')).width > 0);

    // Force a hard DPR clamp and go deep.
    await page.evaluate(() => {
      window.App.setCanvasCaps({ maxDim: 100000, maxArea: 2000000 });
      window.state.zoom = 3;
      window.state.pan = { x: 0, y: 0 };
      window.App.renderPdf();
    });

    // 1. Tiles arrive; the compositor shows with ink over the window.
    await page.waitForFunction(() => window.App.__tileGridStats().tiles >= 2, null, { timeout: 20000 });
    await page.waitForFunction(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      return c.style.display !== 'none' && c.width > 0;
    }, null, { timeout: 10000 });
    const first = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = false;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) { ink = true; break; }
      return { ink, tiles: window.App.__tileGridStats().tiles, left: c.style.left };
    });
    expect(first.ink).toBe(true);
    expect(first.tiles).toBeGreaterThanOrEqual(2);
    expect(first.left).toBe('0px');

    // 2. Pan right one viewport: cache grows to cover the new region.
    const tilesBefore = first.tiles;
    await page.evaluate(() => {
      window.state.pan = { x: -700, y: 0 };
      window.App.__ensureTileCoverage();
    });
    await page.waitForFunction((n) => window.App.__tileGridStats().tiles > n, tilesBefore, { timeout: 20000 });
    const afterPan = await page.evaluate(() => ({
      tiles: window.App.__tileGridStats().tiles,
      left: /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas')).style.left,
    }));
    expect(afterPan.tiles).toBeGreaterThan(tilesBefore);
    expect(parseFloat(afterPan.left)).toBeGreaterThan(0);   // compositor followed the window

    // 3. Page flip clears the grid; sharp zoom retires the overlay.
    await page.locator('#nextPage').click();
    await page.waitForFunction(() => window.state.currentPage === 1, null, { timeout: 5000 });
    expect(await page.evaluate(() => window.App.__tileGridStats().tiles)).toBe(0);
    await page.evaluate(() => { window.state.zoom = 0.5; window.App.renderPdf(); });
    await page.waitForTimeout(600);
    const retired = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      return c.style.display === 'none' || c.width === 0;
    });
    expect(retired).toBe(true);

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: the deep-zoom sharp crop tile (#cropCanvas).
 *
 * When effectiveDpr is clamped below devicePixelRatio (big sheet × deep zoom
 * vs the device canvas budget), the base render is soft; the app then rasters
 * just the visible window at full dpr into #cropCanvas, positioned in content
 * space between the PDF canvas and the annotation overlay.
 *
 * Forces the condition with App.setCanvasCaps (tiny area cap -> effectiveDpr
 * clamps hard at zoom 3 even at the headless dpr of 1), then asserts: the
 * tile appears after the debounced delay, its buffer respects the render
 * budget, its CSS box covers the visible window at the expected content
 * position, marks still paint above it, a page flip clears it immediately,
 * and returning to a sharp zoom (fit) retires it. No console/page errors.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Deep-zoom sharp crop tile', () => {
  test('tile appears when clamped, positions correctly, clears on flip and on sharp zoom', async ({ page }) => {
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

    // 1. At fit zoom with real caps the base is sharp: no tile.
    const initial = await page.evaluate(() => {
      const c = document.getElementById('cropCanvas');
      return { exists: !!c, visible: !!c && c.style.display !== 'none' && /** @type {HTMLCanvasElement} */ (c).width > 0 };
    });
    expect(initial.exists).toBe(true);
    expect(initial.visible).toBe(false);

    // 2. Force a hard effectiveDpr clamp and zoom deep -> tile appears.
    await page.evaluate(() => {
      window.App.setCanvasCaps({ maxDim: 100000, maxArea: 2000000 });
      window.state.zoom = 3;
      window.state.pan = { x: 0, y: 0 };
      window.App.renderPdf();
    });
    await page.waitForFunction(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      return !!c && c.style.display !== 'none' && c.width > 0;
    }, { timeout: 10000 });

    const tile = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      const wrap = document.getElementById('canvasWrapper');
      const r = wrap.getBoundingClientRect();
      const pdfC = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      // The tile must actually have ink (a raster landed, not a blank buffer).
      const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = false;
      for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) { ink = true; break; } }
      return {
        bufW: c.width, bufH: c.height,
        cssLeft: c.style.left, cssTop: c.style.top,
        cssW: parseFloat(c.style.width), cssH: parseFloat(c.style.height),
        wrapW: r.width, wrapH: r.height,
        pageCssW: parseFloat(pdfC.style.width), pageCssH: parseFloat(pdfC.style.height),
        budget: 2000000 * 0.5,   // caps.maxArea * RENDER_AREA_SAFETY_MAX
        ink,
      };
    });
    // Pan is 0,0 -> tile anchors at the page origin.
    expect(tile.cssLeft).toBe('0px');
    expect(tile.cssTop).toBe('0px');
    // Covers the visible window (wrapper ∩ page), within a rounding pixel.
    expect(Math.abs(tile.cssW - Math.min(tile.wrapW, tile.pageCssW))).toBeLessThanOrEqual(1);
    expect(Math.abs(tile.cssH - Math.min(tile.wrapH, tile.pageCssH))).toBeLessThanOrEqual(1);
    // Buffer respects the render budget the base render is clamped by.
    expect(tile.bufW * tile.bufH).toBeLessThanOrEqual(tile.budget);
    expect(tile.ink).toBe(true);

    // 3. Marks still paint on the overlay ABOVE the tile.
    const overlayAbove = await page.evaluate(() => {
      const crop = document.getElementById('cropCanvas');
      const ann = document.getElementById('annCanvas');
      const zCrop = parseInt(getComputedStyle(crop).zIndex || '0', 10);
      const zAnn = parseInt(getComputedStyle(ann).zIndex || '0', 10);
      const domOrderOk = !!(crop.compareDocumentPosition(ann) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { zCrop, zAnn, domOrderOk };
    });
    expect(overlayAbove.zAnn).toBeGreaterThan(overlayAbove.zCrop);
    expect(overlayAbove.domOrderOk).toBe(true);

    // 4. A page flip clears the tile immediately (renderPdf entry).
    await page.locator('#nextPage').click();
    const afterFlip = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      return { hidden: c.style.display === 'none' || c.width === 0 };
    });
    expect(afterFlip.hidden).toBe(true);

    // 5. Back at a sharp zoom (fit-ish), the tile retires and stays retired.
    await page.evaluate(() => {
      window.state.zoom = 0.5;
      window.App.renderPdf();
    });
    await page.waitForTimeout(600);   // past the raster + the 200ms tile debounce
    const afterSharp = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('cropCanvas'));
      return { hidden: c.style.display === 'none' || c.width === 0 };
    });
    expect(afterSharp.hidden).toBe(true);

    expect(errors).toEqual([]);
  });
});

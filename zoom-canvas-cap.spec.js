// @ts-check
/**
 * Regression: zooming in too far used to size the PDF canvas buffer beyond the
 * browser's max canvas dimension/area, so it rendered blank/black. The fix clamps
 * an "effective DPR" so the buffer always fits; the bitmap softens past the cap but
 * never disappears, and logical zoom/layout are unchanged.
 *
 * This drives the zoom past the device's dimension cap and asserts (a) the pdfCanvas
 * buffer stays within the detected cap, (b) the clamp actually engaged (effDpr < dpr),
 * and (c) the page still rendered content (not a blank canvas). Reads the caps via the
 * registry (window.App.getCanvasCaps / window.App.effectiveDpr).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Zoom canvas cap', () => {
  test('extreme zoom clamps the buffer under the device cap and still renders', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Use the sample floor plan (has real line content to detect after clamping).
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'samples', 'sample-plan.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });

    // Force a small cap so the clamp engages at a modest zoom (fast, deterministic
    // buffer) instead of rendering a ~16k-px canvas, then zoom 50% past it.
    const setup = await page.evaluate(() => {
      const maxDim = 2000, maxArea = 2000 * 1500;
      window.App.setCanvasCaps({ maxDim, maxArea });
      const p = window.state.pages[window.state.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const dpr = window.devicePixelRatio || 1;
      const longest = Math.max(vp.width, vp.height);
      const zoom = (maxDim / (longest * dpr)) * 1.5;
      window.state.maxZoom = Math.max(window.state.maxZoom || 0, zoom + 1);
      window.state.zoom = zoom;
      window.App.renderPdf();
      return { maxDim, maxArea, dpr, zoom };
    });

    // Wait until the buffer matches the clamped target for this zoom (render landed).
    await page.waitForFunction(() => {
      const c = document.getElementById('pdfCanvas');
      const p = window.state.pages[window.state.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const eff = window.App.effectiveDpr(p, window.state.zoom);
      const expectedW = Math.round(vp.width * window.state.zoom * eff);
      return c.width > 0 && Math.abs(c.width - expectedW) <= 2;
    }, null, { timeout: 12000 });

    const result = await page.evaluate(() => {
      const c = document.getElementById('pdfCanvas');
      const p = window.state.pages[window.state.currentPage];
      const eff = window.App.effectiveDpr(p, window.state.zoom);
      // Content check: downscale the whole buffer into 64x64 and look for any
      // non-transparent pixel (the plan's lines). A blank/black canvas has none.
      const tmp = document.createElement('canvas'); tmp.width = 64; tmp.height = 64;
      const tg = tmp.getContext('2d');
      tg.drawImage(c, 0, 0, 64, 64);
      const data = tg.getImageData(0, 0, 64, 64).data;
      let hasContent = false;
      for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) { hasContent = true; break; } }
      return { w: c.width, h: c.height, eff, hasContent };
    });

    // (a) buffer never exceeds the detected cap — the actual fix.
    expect(result.w).toBeLessThanOrEqual(setup.maxDim);
    expect(result.h).toBeLessThanOrEqual(setup.maxDim);
    expect(result.w * result.h).toBeLessThanOrEqual(setup.maxArea);
    // (b) the clamp engaged at this zoom.
    expect(result.eff).toBeLessThan(setup.dpr);
    // (c) the page still rendered content (not a blank/black canvas).
    expect(result.hasContent).toBe(true);

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: the show-all-canvases peek toggle (#showAllCanvasesBtn) - the opposite
 * of the hide-marks eye: while on, renderAnnotations draws every canvas layer
 * of the page merged instead of just the active one. Desktop only, shown only
 * when the page has 2+ canvases; in-memory (nothing persisted or marked dirty);
 * auto-clears when the page drops back to one layer.
 *
 * The cross-layer visibility assertion reads actual pixels off #annCanvas: a
 * quick line lives on canvas A while canvas B is active - its midpoint pixel
 * area must be painted only while the peek is on.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function bootTwoLayers(page, errors) {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  // Canvas A (existing) gets a colored quick line; canvas B becomes active.
  await page.evaluate(() => {
    const App = window.App;
    const s = App.state;
    const pageObj = s.pages[0];
    const a = App.ensureActiveCanvas(pageObj);
    s.lineTypes.push({ id: 'lt-spec', name: 'Spec Line', color: '#e74c3c' });
    a.annotations.quickLines.push({ x1: 50, y1: 50, x2: 150, y2: 150, color: '#e74c3c', id: 'ql-spec', lineTypeId: 'lt-spec' });
    const b = { id: 'canvas-b', name: 'Second', annotations: window.makeAnnotations ? window.makeAnnotations() : App.makeAnnotations() };
    pageObj.canvases.push(b);
    s.activeCanvasIdByPage[0] = 'canvas-b';
    App.renderPdf();
    App.updateUI();
  });
  await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 300, { timeout: 10000 });
}

// Sum the alpha channel in a box around the line's midpoint on #annCanvas.
async function midpointAlpha(page) {
  return page.evaluate(() => {
    const App = window.App;
    const s = App.state;
    const eff = App.effectiveDpr(s.pages[0], s.zoom);
    const c = document.getElementById('annCanvas');
    const px = 100 * s.zoom * eff, py = 100 * s.zoom * eff;   // pdf (100,100) = line midpoint
    const r = Math.max(4, Math.round(6 * eff));
    const img = c.getContext('2d').getImageData(Math.round(px - r), Math.round(py - r), r * 2, r * 2).data;
    let sum = 0;
    for (let i = 3; i < img.length; i += 4) sum += img[i];
    return sum;
  });
}

test.describe('Show-all-canvases peek (#showAllCanvasesBtn)', () => {
  test('button appears only with 2+ canvases (desktop); toggle merges layers on the overlay', async ({ page }) => {
    const errors = [];
    await bootTwoLayers(page, errors);

    // Visible with two layers on a desktop viewport.
    expect(await page.evaluate(() => document.getElementById('showAllCanvasesBtn').style.display)).not.toBe('none');

    // Active canvas is B (empty): the line on A must NOT be painted.
    expect(await midpointAlpha(page)).toBe(0);

    // Toggle on: the merged render paints A's line while B stays active.
    await page.locator('#showAllCanvasesBtn').click();
    const on = await page.evaluate(() => ({
      flag: window.App.state.showAllCanvases,
      active: document.getElementById('showAllCanvasesBtn').classList.contains('active'),
      activeCanvas: window.App.state.activeCanvasIdByPage[0],
    }));
    expect(on.flag).toBe(true);
    expect(on.active).toBe(true);
    expect(on.activeCanvas).toBe('canvas-b');   // editing target unchanged
    expect(await midpointAlpha(page)).toBeGreaterThan(0);

    // Toggle off: back to active-canvas-only rendering.
    await page.locator('#showAllCanvasesBtn').click();
    expect(await page.evaluate(() => window.App.state.showAllCanvases)).toBe(false);
    expect(await midpointAlpha(page)).toBe(0);

    expect(errors).toEqual([]);
  });

  test('hidden with a single canvas; flag auto-clears when layers drop to one', async ({ page }) => {
    const errors = [];
    await bootTwoLayers(page, errors);

    await page.locator('#showAllCanvasesBtn').click();
    expect(await page.evaluate(() => window.App.state.showAllCanvases)).toBe(true);

    // Remove the second canvas -> button hides and the flag clears.
    await page.evaluate(() => {
      const App = window.App;
      const s = App.state;
      s.pages[0].canvases = s.pages[0].canvases.filter(c => c.id !== 'canvas-b');
      s.activeCanvasIdByPage[0] = s.pages[0].canvases[0].id;
      App.updateUI();
    });
    const after = await page.evaluate(() => ({
      flag: window.App.state.showAllCanvases,
      display: document.getElementById('showAllCanvasesBtn').style.display,
    }));
    expect(after.flag).toBe(false);
    expect(after.display).toBe('none');

    expect(errors).toEqual([]);
  });

  test('mobile viewport: button never shows even with 2+ canvases', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 390, height: 844 });
    await bootTwoLayers(page, errors);

    const vis = await page.evaluate(() => {
      const el = document.getElementById('showAllCanvasesBtn');
      return { styleDisplay: el.style.display, computed: getComputedStyle(el).display };
    });
    expect(vis.computed).toBe('none');

    expect(errors).toEqual([]);
  });
});

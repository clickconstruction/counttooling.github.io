// @ts-check
/**
 * Tests: the true-width duct ghost (DUCT-PLAN.md unit D13 — "Duct
 * Follow-ups" canvas row 3a; the design-build "markup is the layout" band).
 *
 * Under each committed run's symbolic stroke (and under the live trace) the
 * painters lay a translucent band in the airside color whose width is the
 * segment's REAL plan-view width converted through the sheet scale — rect w
 * (the smaller side on edge, D12), round d — stepping per segment. Pixels are
 * sampled straight off the canvases:
 *
 * - live overlay: a seeded 48×24 supply run on a 12 pt/ft page paints a band
 *   48 pt wide (× the overlay's px/pt) — colored beside the centerline with the
 *   ghost ON, background with it OFF; a size step to 24×12 halves the band.
 * - no scale → no ghost (only the stroke); hideMarks hides everything.
 * - export raster: renderAnnotationsToContext into an offscreen canvas at
 *   scale 2 carries a 96 px band (the render-pixels.spec technique).
 * - the live draft (rubber band included) carries the same band while tracing.
 * - the Legend Settings "Show duct true width" toggle (legendSettings
 *   .showDuctGhost, default ON, beside D5's duct-rows toggle) turns it off.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Duct true-width ghost (D13)', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.waitForFunction(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      return !!c && c.width > 0;
    });
    await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      s.hideMarks = false;
      s.showLegendOverlay = false;
      s.showGridOverlay = false;
    });
  });

  // Seeds one horizontal supply run across page 0: 48×24 for the first half,
  // stepped to 24×12 at the midpoint vertex (when `step` is set). Returns the
  // pdf-space geometry the samplers use. Runs in the page.
  const seedRun = (page, opts = {}) => page.evaluate((o) => {
    const s = window.state;
    const p0 = s.pages[0];
    const vp = p0.pdfPage.getViewport({ scale: 1, rotation: p0.rotation ?? 0 });
    const y = vp.height * 0.4;
    const x0 = vp.width * 0.1, x1 = vp.width * 0.5, x2 = vp.width * 0.9;
    const ann = window.App.ensureActiveCanvas(p0).annotations;
    // duct-model.js globals (classic-script function declarations → window props)
    const w = /** @type {any} */ (window);
    const run = w.makeDuctRun({
      id: 'ghost-run', name: 'Supply Main', airside: o.airside || 'supply',
      vertices: [{ x: x0, y }, { x: x1, y }, { x: x2, y }],
      segments: o.step ? [{ startVertexIdx: 0, size: w.makeRectSize(48, 24) }, { startVertexIdx: 1, size: w.makeRectSize(24, 12) }] : [{ startVertexIdx: 0, size: w.makeRectSize(48, 24) }],
      orientation: o.orientation || 'flat',
    });
    (ann.ductRuns = ann.ductRuns || []).push(run);
    window.App.renderAnnotations();
    return { x0, x1, x2, y, vpW: vp.width, vpH: vp.height };
  }, opts);

  // Samples the live overlay: the vertical extent (px) of painted pixels in
  // the column at pdf x, centered on pdf y, plus the rgba at `offsetPx` above
  // the centerline. All in the overlay's buffer px (App.toCanvas).
  const sampleLive = (page, x, y, offsetPx) => page.evaluate(({ x, y, offsetPx }) => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
    const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    const p = window.App.toCanvas({ x, y });
    const cx = Math.round(p.x), cy = Math.round(p.y);
    const R = 120;
    const col = ctx.getImageData(cx, Math.max(0, cy - R), 1, R * 2).data;
    let inked = 0;
    for (let i = 3; i < col.length; i += 4) if (col[i] !== 0) inked++;
    const px = ctx.getImageData(cx, cy - offsetPx, 1, 1).data;
    return { inked, rgba: [px[0], px[1], px[2], px[3]], pxPerPt: window.App.toCanvas({ x: 1, y: 0 }).x };
  }, { x, y, offsetPx });

  const setGhost = (page, on) => page.evaluate((v) => {
    window.state.legendSettings = window.state.legendSettings || {};
    window.state.legendSettings.showDuctGhost = v;
    window.App.renderAnnotations();
  }, on);

  test('committed run: a translucent airside band at the true scaled width under the stroke; OFF paints only the stroke', async ({ page }) => {
    const g = await seedRun(page);
    const on = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    // 48" = 4 ft = 48 pt on a 12 pt/ft sheet → 48 × px/pt on the overlay
    const expected = 48 * on.pxPerPt;
    expect(expected).toBeGreaterThan(24);   // the 9 px sample sits inside the band's half-width
    expect(Math.abs(on.inked - expected)).toBeLessThanOrEqual(3);
    // beside the centerline, past the 10 px symbolic stroke: supply blue at the ghost alpha, not background
    expect(on.rgba[3]).toBeGreaterThan(15);
    expect(on.rgba[3]).toBeLessThan(80);
    expect(on.rgba[2]).toBeGreaterThan(on.rgba[0]);   // #2e86de: blue over red

    await setGhost(page, false);
    const off = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    expect(off.rgba[3]).toBe(0);
    expect(off.inked).toBeLessThanOrEqual(12);   // the 10 px band stroke (+ AA) only
    expect(off.inked).toBeGreaterThanOrEqual(8);

    await setGhost(page, true);
    const back = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    expect(back.inked).toBe(on.inked);
    expect(errors).toEqual([]);
  });

  test('size step halves the band; on edge the smaller side sits in plan; a return run paints red', async ({ page }) => {
    const g = await seedRun(page, { step: true });
    const seg1 = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    const seg2 = await sampleLive(page, g.x1 + g.vpW * 0.1, g.y, 9);
    expect(Math.abs(seg1.inked - 48 * seg1.pxPerPt)).toBeLessThanOrEqual(3);
    expect(Math.abs(seg2.inked - 24 * seg2.pxPerPt)).toBeLessThanOrEqual(3);
    expect(Math.abs(seg1.inked - 2 * seg2.inked)).toBeLessThanOrEqual(6);

    // D12: flip the run on edge → 48×24 hangs 48" deep and shows 24" in plan; 24×12 shows 12"
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      ann.ductRuns[0].orientation = 'edge';
      window.App.renderAnnotations();
    });
    const edge1 = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    const edge2 = await sampleLive(page, g.x1 + g.vpW * 0.1, g.y, 9);
    expect(Math.abs(edge1.inked - 24 * edge1.pxPerPt)).toBeLessThanOrEqual(3);
    expect(Math.abs(edge2.inked - Math.max(12 * edge2.pxPerPt, 6))).toBeLessThanOrEqual(3);

    // airside color rides the band
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      ann.ductRuns[0].orientation = 'flat';
      ann.ductRuns[0].airside = 'return';
      window.App.renderAnnotations();
    });
    const red = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    expect(red.rgba[3]).toBeGreaterThan(15);
    expect(red.rgba[0]).toBeGreaterThan(red.rgba[2]);   // #e85447: red over blue
    expect(errors).toEqual([]);
  });

  test('no scale → no ghost (stroke only); hideMarks hides the run and its ghost', async ({ page }) => {
    const g = await seedRun(page);
    await page.evaluate(() => { window.state.pages[0].scale = null; window.App.renderAnnotations(); });
    const unscaled = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    expect(unscaled.rgba[3]).toBe(0);
    expect(unscaled.inked).toBeLessThanOrEqual(12);
    expect(unscaled.inked).toBeGreaterThanOrEqual(8);

    await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: 'x' }; window.state.hideMarks = true; window.App.renderAnnotations(); });
    const hidden = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    expect(hidden.inked).toBe(0);
    await page.evaluate(() => { window.state.hideMarks = false; window.App.renderAnnotations(); });
    expect(errors).toEqual([]);
  });

  test('export raster: renderAnnotationsToContext carries the band at the raster scale; OFF leaves the scaled stroke only', async ({ page }) => {
    const g = await seedRun(page, { step: true });
    const exportColumn = (x, y) => page.evaluate(({ x, y }) => {
      const p0 = window.state.pages[0];
      const vp = p0.pdfPage.getViewport({ scale: 1, rotation: p0.rotation ?? 0 });
      const EXPORT_SCALE = 2;
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width * EXPORT_SCALE);
      c.height = Math.ceil(vp.height * EXPORT_SCALE);
      const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      window.App.renderAnnotationsToContext(ctx, p0, EXPORT_SCALE, { lineScale: 1.15, markerScale: 1.25 });
      const cx = Math.round(x * EXPORT_SCALE), cy = Math.round(y * EXPORT_SCALE);
      const R = 160;
      const col = ctx.getImageData(cx, Math.max(0, cy - R), 1, R * 2).data;
      let inked = 0;
      for (let i = 3; i < col.length; i += 4) if (col[i] !== 0) inked++;
      const px = ctx.getImageData(cx, cy - 20, 1, 1).data;
      return { inked, alphaAt20: px[3] };
    }, { x, y });
    const seg1 = await exportColumn(g.x0 + g.vpW * 0.1, g.y);
    const seg2 = await exportColumn(g.x1 + g.vpW * 0.1, g.y);
    expect(Math.abs(seg1.inked - 96)).toBeLessThanOrEqual(3);   // 48 pt × 2
    expect(Math.abs(seg2.inked - 48)).toBeLessThanOrEqual(3);   // 24 pt × 2
    expect(seg1.alphaAt20).toBeGreaterThan(15);

    await setGhost(page, false);
    const off = await exportColumn(g.x0 + g.vpW * 0.1, g.y);
    expect(off.alphaAt20).toBe(0);
    expect(Math.abs(off.inked - 10 * 2 * 1.15)).toBeLessThanOrEqual(3);   // the ductStrokePx band × raster × lineScale
    expect(errors).toEqual([]);
  });

  test('live draft: the band rides the in-progress trace and its rubber band', async ({ page }) => {
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateW').fill('48');
    await page.locator('#ductCreateH').fill('24');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
    await page.locator('#canvasWrapper').click({ position: { x: 150, y: 200 } });
    await page.waitForFunction(() => window.state.drawingDuct.vertices.length === 1);
    const g = await page.evaluate(() => {
      const v0 = window.state.drawingDuct.vertices[0];
      window.state.mousePos = { x: v0.x + 200, y: v0.y };   // the rubber band, straight right
      window.App.renderAnnotations();
      return { x: v0.x + 60, y: v0.y };
    });
    const on = await sampleLive(page, g.x, g.y, 9);
    expect(Math.abs(on.inked - 48 * on.pxPerPt)).toBeLessThanOrEqual(3);
    expect(on.rgba[3]).toBeGreaterThan(15);

    await setGhost(page, false);
    const off = await sampleLive(page, g.x, g.y, 9);
    expect(off.rgba[3]).toBe(0);
    expect(off.inked).toBeLessThanOrEqual(12);
    // leave the tool cleanly (the Esc ladder: vertex → draft + exit)
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.state.drawingDuct);
    expect(errors).toEqual([]);
  });

  test('Legend Settings: the "Show duct true width" toggle sits beside the duct-rows toggle, defaults ON, and writes legendSettings.showDuctGhost', async ({ page }) => {
    const g = await seedRun(page);
    await page.evaluate(() => { window.App.openLegendSettingsModal(); });
    await expect(page.locator('#legendSettingsModal')).toHaveClass(/visible/);
    await expect(page.locator('#legendShowDuctGhostBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#legendShowDuctBtn')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.state.legendSettings.showDuctGhost)).toBeUndefined();   // absent = ON (pre-D13 settings)
    await page.locator('#legendShowDuctGhostBtn').click();
    await expect(page.locator('#legendShowDuctGhostBtn')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => window.state.legendSettings.showDuctGhost)).toBe(false);
    const off = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    expect(off.rgba[3]).toBe(0);
    await page.locator('#legendShowDuctGhostBtn').click();
    expect(await page.evaluate(() => window.state.legendSettings.showDuctGhost)).toBe(true);
    const on = await sampleLive(page, g.x0 + g.vpW * 0.1, g.y, 9);
    expect(on.rgba[3]).toBeGreaterThan(15);
    // the toggle rides the project's legendSettings like showDuct — the export payload carries it
    const exported = await page.evaluate(() => JSON.parse(JSON.stringify(window.App.buildCanvasExportData())).legendSettings);
    expect(exported.showDuctGhost).toBe(true);
    await page.locator('#legendSettingsClose').click();
    expect(errors).toEqual([]);
  });
});

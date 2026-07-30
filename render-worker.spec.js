// @ts-check
/**
 * Tests: the render worker (option 4 — off-main-thread pdf.js rasters).
 *
 * All rasters flow through render-service.js; when Worker + OffscreenCanvas
 * are available the service lazily "adopts" the current document (bytes read
 * back via the pinned pdf.js transport) into a dedicated render worker and
 * subsequent rasters happen off the main thread, returning ImageBitmaps.
 *
 *   1. Worker mode: adoption reaches 'ready' after boot, a fresh cold raster
 *      is worker-rastered, and the canvas has real content.
 *   2. Escape hatch: with window.DISABLE_RENDER_WORKER set (config-level),
 *      everything renders on the main thread exactly as before.
 *   3. Dense-sheet PDF features survive worker scope. pdf.js's defaults reach
 *      for `document` in two lazy paths that simple test PDFs never touch:
 *      the aux-canvas factory (tiling patterns / transparency groups — the
 *      first hatched CAD sheet threw "createElement of undefined" and wedged
 *      the session into main-thread fallback) and FontLoader (embedded fonts
 *      without a FontFaceSet raster every glyph as a black box). A crafted
 *      tiling-pattern PDF must worker-raster with zero fallbacks, and the
 *      embedded-font sample plan must render pixel-equivalent ink in worker
 *      and main modes.
 *
 * (Every OTHER Playwright spec also exercises the worker path implicitly in
 * Chromium once this ships — this spec pins the mode transitions.)
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, null, { timeout: 15000 });
}

// A minimal one-page PDF whose only fill is a TILING PATTERN — rendering it
// makes pdf.js request an auxiliary canvas from its canvasFactory, the path
// that used to crash in worker scope (DOMCanvasFactory -> document.createElement).
// Assembled with a byte-accurate xref so pdf.js takes the normal parse path.
function buildTilingPatternPdf() {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Pattern << /P1 5 0 R >> >> /Contents 4 0 R >>',
    null,   // content stream, built below
    null,   // pattern stream, built below
  ];
  const content = '/Pattern cs /P1 scn\n50 50 500 700 re f\n';
  objs[3] = `<< /Length ${content.length} >>\nstream\n${content}endstream`;
  const tile = '0 g 2 w 0 0 m 20 20 l S\n';
  objs[4] = `<< /PatternType 1 /PaintType 1 /TilingType 1 /BBox [0 0 20 20] /XStep 20 /YStep 20 /Resources << >> /Length ${tile.length} >>\nstream\n${tile}endstream`;
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

// Count of non-white pixels on the visible PDF canvas — stable across worker
// vs main rasters (antialiasing jitter cancels out), but blown wide open by
// the black-box glyph failure mode.
function canvasInkCountFn() {
  const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let ink = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) ink++;
  }
  return { ink, w: c.width, h: c.height };
}

function canvasHasContentFn() {
  const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
  const s = document.createElement('canvas');
  s.width = 64; s.height = 64;
  const g = /** @type {CanvasRenderingContext2D} */ (s.getContext('2d'));
  g.drawImage(c, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
  return false;
}

test.describe('Render worker', () => {
  test('adopts the document and rasters off the main thread', async ({ page }) => {
    const errors = [];
    await boot(page, errors);

    // Lazy adoption kicks on the first raster; wait for the worker to be live.
    await page.waitForFunction(() => window.App.__renderWorkerState() === 'ready', null, { timeout: 15000 });
    expect(await page.evaluate(() => window.App.__renderServiceMode())).toBe('worker');

    // Force a cold full raster and prove it ran in the worker.
    const result = await page.evaluate(async () => {
      const before = window.App.__renderServiceStats().workerRastered;
      window.App.clearPdfBitmapCache();
      window.App.renderPdf();
      await new Promise((r) => setTimeout(r, 1500));
      return {
        workerGained: window.App.__renderServiceStats().workerRastered - before,
        fallbacks: window.App.__renderServiceStats().fallbacks,
      };
    });
    expect(result.workerGained).toBeGreaterThanOrEqual(1);
    expect(result.fallbacks).toBe(0);

    // Pool: on a high-memory machine with a small doc, the background slot
    // exists and has taken prefetch rasters (slot 0 stays interactive).
    const pool = await page.evaluate(() => window.App.__renderServiceStats().slots);
    if (pool.length > 1) {
      expect(pool[1].loaded).toBe(true);
      expect(pool[1].rastered).toBeGreaterThanOrEqual(1);
    }
    expect(await page.evaluate(canvasHasContentFn)).toBe(true);

    // Page flip exercises the worker path end-to-end too.
    await page.locator('#nextPage').click();
    await page.waitForFunction(() => window.state.currentPage === 1, null, { timeout: 5000 });
    await page.waitForTimeout(400);
    expect(await page.evaluate(canvasHasContentFn)).toBe(true);

    expect(errors).toEqual([]);
  });

  test('DISABLE_RENDER_WORKER escape hatch keeps everything on the main thread', async ({ page }) => {
    const errors = [];
    await page.addInitScript(() => { window.DISABLE_RENDER_WORKER = true; });
    await boot(page, errors);
    await page.waitForTimeout(800);   // give any (wrong) adoption time to surface

    const s = await page.evaluate(() => ({
      state: window.App.__renderWorkerState(),
      mode: window.App.__renderServiceMode(),
      stats: window.App.__renderServiceStats(),
    }));
    expect(s.mode).toBe('main');
    expect(s.state).toBe('idle');                      // adoption never kicked
    expect(s.stats.workerRastered).toBe(0);
    expect(s.stats.mainRastered).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(canvasHasContentFn)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('tiling-pattern pages raster in the worker (aux-canvas factory)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles({
      name: 'tiling-pattern.pdf', mimeType: 'application/pdf', buffer: buildTilingPatternPdf(),
    });
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, null, { timeout: 15000 });

    // Adoption must reach 'ready' and STAY there — the pattern raster is the
    // one that used to throw and flip the session to permanent main fallback.
    await page.waitForFunction(() => window.App.__renderWorkerState() === 'ready', null, { timeout: 15000 });
    const result = await page.evaluate(async () => {
      const before = window.App.__renderServiceStats().workerRastered;
      window.App.clearPdfBitmapCache();
      window.App.renderPdf();
      await new Promise((r) => setTimeout(r, 1500));
      const s = window.App.__renderServiceStats();
      return {
        workerGained: s.workerRastered - before,
        fallbacks: s.fallbacks,
        state: window.App.__renderWorkerState(),
      };
    });
    expect(result.workerGained).toBeGreaterThanOrEqual(1);
    expect(result.fallbacks).toBe(0);
    expect(result.state).toBe('ready');
    expect(await page.evaluate(canvasHasContentFn)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('embedded-font pages render identical ink in worker and main modes', async ({ page, context }) => {
    const errors = [];
    const samplePlan = path.join(__dirname, 'samples', 'sample-plan.pdf');

    async function inkFor(p, disableWorker) {
      if (disableWorker) await p.addInitScript(() => { window.DISABLE_RENDER_WORKER = true; });
      p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto('/app/');
      await p.waitForLoadState('networkidle');
      await p.locator('#pdfInput').setInputFiles(samplePlan);
      await p.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
      await p.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, null, { timeout: 15000 });
      if (!disableWorker) {
        await p.waitForFunction(() => window.App.__renderWorkerState() === 'ready', null, { timeout: 15000 });
        // Force the crisp raster through the worker (the boot render may have
        // run main-thread while adoption was still in flight).
        await p.evaluate(() => { window.App.clearPdfBitmapCache(); window.App.renderPdf(); });
      }
      await p.waitForTimeout(1500);
      const mode = await p.evaluate(() => window.App.__renderServiceMode());
      expect(mode).toBe(disableWorker ? 'main' : 'worker');
      return p.evaluate(canvasInkCountFn);
    }

    const worker = await inkFor(page, false);
    const main = await inkFor(await context.newPage(), true);
    expect(worker.w).toBe(main.w);
    expect(worker.h).toBe(main.h);
    // Broken embedded fonts raster as solid black boxes — a >1% ink swing.
    // Healthy worker/main pairs measure identical (AA jitter cancels in the
    // count); allow 0.3% for environment drift.
    const delta = Math.abs(worker.ink - main.ink) / Math.max(main.ink, 1);
    expect(delta).toBeLessThan(0.003);
    expect(errors).toEqual([]);
  });
});

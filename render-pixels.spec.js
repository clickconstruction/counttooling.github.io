// @ts-check
/**
 * Pixel-regression safety net for the annotation draw paths.
 *
 * Seeds one fixture takeoff exercising EVERY mark kind — straight + arc quick
 * lines (drops, length labels, selection glow), a closed polyline, a highlight,
 * a multiply zone, a scale zone, a room box, a wrapping note, two counters
 * (rings, outline, index numbers), group dots, the legend overlay, and the grid
 * overlay — then snapshots the raw canvas buffers of both draw paths:
 *
 *   1. the live overlay (#annCanvas via renderAnnotations), and
 *   2. an export canvas (renderAnnotationsToContext at export scale, with
 *      lineScale/markerScale overrides, and once more via annotationsOverride).
 *
 * Baselines live in render-pixels.spec.js-snapshots/ and are compared with
 * maxDiffPixels 0 — any pixel drift in either path fails. They are rasterized
 * on the machine that generated them (font AA varies across OS/browser
 * builds); regenerate on a new machine with:
 *   npx playwright test render-pixels.spec.js --update-snapshots
 *
 * Written as the Stage-0 gate for unifying renderAnnotations /
 * renderAnnotationsToContext behind one draw core (see ARCHITECTURE.md
 * "Large-file map").
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

/** Seeds the fixture takeoff into page 0's active canvas. Runs in the page. */
function seedFixtureFn() {
  const s = window.state;
  const uid = window.App.uid;

  // Deterministic settings (override anything restored from localStorage).
  s.counterSettings = { size: 26, opacity: 0.9, showRings: true, numberSize: 11, ringSize: 130, ringOpacity: 0.8, ringSolid: false, outlineSize: 2, showOnlyCountersOnCurrentPage: false };
  s.lineTypeSettings = { opacity: 0.85, lineSize: 3, dropXSize: 12, dropIconStyle: 'circle', parallelEndsSize: 12, lengthLabelSize: 13, snapToHorizontalVertical: false, orientLengthWithLine: true, showOnlyLineTypesOnCurrentPage: false };
  s.multiplyZoneSettings = { showLabelOnZone: true, defaultMultiplier: 2, labelSize: 15, labelPosition: 'center' };
  s.legendSettings = { legendScale: 1.2, bgColor: '#ffffff', bgOpacity: 0.95, showBorder: true, textOpacity: 1, showRooms: true };
  s.gridSettings = { spacing: 10, offsetX: 0, offsetY: 0, opacity: 0.3, color: '#e8c547', lineWidth: 1, lineStyle: 'dashed', majorInterval: 4, snapToGrid: false };
  s.showGridOverlay = true;
  s.showLegendOverlay = true;
  s.showGroupColors = true;
  s.hideMarks = false;
  s.showAllCanvases = false;
  s.currentPage = 0;

  const page0 = s.pages[0];
  page0.scale = { pixelsPerUnit: 4, unit: 'ft', label: 'spec 4pt/ft' };

  const gid = uid();
  s.groups = [{ id: gid, name: 'Spec Group', color: '#e85447' }];

  const roomId = uid();
  s.rooms = [{ id: roomId, name: 'Spec Room', color: '#8e6fd8' }];

  const ltStraight = { id: uid(), name: 'Spec Straight', color: '#4a9eff', curveStyle: 'straight' };
  const ltArc = { id: uid(), name: 'Spec Arc', color: '#47c88e', curveStyle: 'arc' };
  s.lineTypes = [ltStraight, ltArc];

  // eslint-disable-next-line no-undef
  const c1 = { id: uid(), name: 'Spec Counter A', icon: (typeof CIRCLE_PATH !== 'undefined') ? CIRCLE_PATH : 'M512 320C512 426 426 512 320 512C214 512 128 426 128 320C128 214 214 128 320 128C426 128 512 214 512 320z', color: '#e8c547' };
  const c2 = { id: uid(), name: 'Spec Counter B', icon: c1.icon, color: '#e85447' };
  s.counters = [c1, c2];

  const ann = page0.canvases[0].annotations;
  const selectedLine = { id: uid(), x1: 60, y1: 60, x2: 260, y2: 100, lineTypeId: ltStraight.id, color: ltStraight.color, showLength: true, startDrop: 2, endDrop: 3, group: gid };
  ann.quickLines = [
    selectedLine,
    { id: uid(), x1: 80, y1: 160, x2: 300, y2: 220, lineTypeId: ltArc.id, color: ltArc.color, showLength: true, startDrop: 0, endDrop: 2, group: null },
  ];
  ann.polylines = [
    { id: uid(), points: [{ x: 340, y: 60 }, { x: 470, y: 90 }, { x: 430, y: 200 }, { x: 350, y: 170 }], closed: true, lineTypeId: ltStraight.id, color: '#c9a227', showLength: true, startDrop: 1, endDrop: 1, group: gid },
  ];
  ann.highlights = [{ id: uid(), x1: 60, y1: 260, x2: 220, y2: 330, color: '#e8c547', opacity: 0.3 }];
  ann.multiplyZones = [{ id: uid(), x1: 250, y1: 260, x2: 420, y2: 360, multiplier: 3 }];
  ann.scaleZones = [{ id: uid(), x1: 450, y1: 260, x2: 580, y2: 360, scale: { pixelsPerUnit: 8, unit: 'ft', label: 'zone 8pt/ft' } }];
  ann.roomBoxes = [{ id: uid(), x1: 70, y1: 380, x2: 300, y2: 520, heightFt: 9, roomId }];
  ann.notes = [{ id: uid(), x: 340, y: 400, text: 'Spec note long enough to wrap onto lines', width: 120, fontSize: 14, color: '#e85447' }];
  ann.counterMarkers = {};
  ann.counterMarkers[c1.id] = [
    { x: 120, y: 560, id: uid(), group: gid },
    { x: 170, y: 590, id: uid(), group: null },
    { x: 220, y: 560, id: uid(), group: null },
  ];
  ann.counterMarkers[c2.id] = [{ x: 320, y: 570, id: uid(), group: null }];

  // Live-only: selection glow on the first quick line.
  s.selectedLineId = selectedLine.id;
  s.selectedLinePageIdx = 0;
  s.selectedLineIsPoly = false;
  return { annOk: !!ann, counters: s.counters.length };
}

test.describe('Annotation draw paths — pixel regression', () => {
  test('live overlay and export canvas match committed baselines', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      // Ignore the optional gitignored /config.local.js 404 (dev-only include).
      if (msg.type() === 'error' && !(msg.location()?.url || '').includes('config.local.js')) errors.push(msg.text());
    });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.waitForFunction(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      return !!c && c.width > 0;
    });
    // Fonts must be resolved before painting the baseline (canvas text uses DM
    // Sans only once loaded; a late load would shift glyph rasterization).
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    const seeded = await page.evaluate(seedFixtureFn);
    expect(seeded.annOk).toBe(true);

    // --- Path 1: the live overlay ---
    await page.evaluate(() => { window.App.renderAnnotations(); });
    const liveUrl = await page.evaluate(() => /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas')).toDataURL('image/png'));
    expect(Buffer.from(liveUrl.split(',')[1], 'base64')).toMatchSnapshot('live-overlay.png', { maxDiffPixels: 0 });

    // --- Path 2: the export canvas (explicit scale + line/marker overrides) ---
    const exportUrl = await page.evaluate(() => {
      const p0 = window.state.pages[0];
      const vp = p0.pdfPage.getViewport({ scale: 1, rotation: p0.rotation ?? 0 });
      const EXPORT_SCALE = 2;
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width * EXPORT_SCALE);
      c.height = Math.ceil(vp.height * EXPORT_SCALE);
      const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      window.App.renderAnnotationsToContext(ctx, p0, EXPORT_SCALE, { lineScale: 1.15, markerScale: 1.25 });
      return c.toDataURL('image/png');
    });
    expect(Buffer.from(exportUrl.split(',')[1], 'base64')).toMatchSnapshot('export-canvas.png', { maxDiffPixels: 0 });

    // --- Path 2b: annotationsOverride param (same ann passed explicitly) ---
    const overrideUrl = await page.evaluate(() => {
      const p0 = window.state.pages[0];
      const vp = p0.pdfPage.getViewport({ scale: 1, rotation: p0.rotation ?? 0 });
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width * 1.5);
      c.height = Math.ceil(vp.height * 1.5);
      const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      window.App.renderAnnotationsToContext(ctx, p0, 1.5, {}, p0.canvases[0].annotations);
      return c.toDataURL('image/png');
    });
    expect(Buffer.from(overrideUrl.split(',')[1], 'base64')).toMatchSnapshot('export-canvas-override.png', { maxDiffPixels: 0 });

    // Sanity: the live overlay actually has ink (guards against a blank-blank match).
    const hasInk = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
      const d = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) return true; }
      return false;
    });
    expect(hasInk).toBe(true);

    expect(errors).toEqual([]);
  });
});

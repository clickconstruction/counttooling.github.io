// @ts-check
/**
 * Tests: MAP-RESETS (DECOMPOSITION_MAP.md R09, defects D05, D17, D21, D26).
 * One reset path for the tools and one end for a pointer drag:
 *   - App.clearToolStarts() drops every tool's pending first point (quick line,
 *     highlight, the three zones, room box, schedule box, chain, ghost box and
 *     the ghost in hand, the scale / measure points);
 *   - App.resetToMove() is the Move reset the M hotkey and #moveBtn share;
 *   - a note, zone or ghost drag that leaves the canvas waits at the edge and
 *     ends where the button comes up, committed and saved like one released on
 *     the sheet, and nothing stays stuck to the pointer when it comes back.
 * Before the fix, V + one corner + M left the purple room band and its W x L
 * readout drawing in Move mode; Esc left a half-drawn schedule box; a zone
 * start survived the Note button; a note or zone dragged off the canvas was
 * never marked dirty; a ghost released off the canvas rode the pointer back in.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const PDF = path.join(__dirname, 'test-page.pdf');

async function boot(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(PDF);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1\'' };
    s.zoom = 1; s.pan = { x: 60, y: 40 };
    s.counters = [{ id: 'wc', name: 'WC', icon: 'M0 0 H10 V10 H0 Z', color: '#3050f0' }];
    s.lineTypes = [{ id: 'waste', name: 'Waste', color: '#3050f0', curveStyle: 'straight' }];
    s.tool = window.App.TOOL.NONE;
    window.App.hideModal && window.App.hideModal('airboardToastModal');
    window.App.renderPdf();
    window.App.updateUI();
  });
}

/** Screen point for a sheet (PDF) point. */
const screenFor = (page, pdf) => page.evaluate((p) => {
  const annCanvas = document.getElementById('annCanvas');
  const rect = annCanvas.getBoundingClientRect();
  const bc = window.App.toCanvas(p);
  return { x: rect.left + bc.x * (rect.width / annCanvas.width), y: rect.top + bc.y * (rect.height / annCanvas.height) };
}, pdf);

/** A screen point just outside #canvasWrapper (the sidebar, left of it). */
const outsideCanvas = (page) => page.evaluate(() => {
  const wrap = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper');
  const r = wrap.getBoundingClientRect();
  const p = { x: Math.max(2, r.left - 12), y: r.top + 120 };
  const el = document.elementFromPoint(p.x, p.y);
  return { ...p, outside: !!el && !wrap.contains(el) };
});

/** A screen point just inside the wrapper's left edge. */
const nearEdge = (page) => page.evaluate(() => {
  const wrap = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper');
  const r = wrap.getBoundingClientRect();
  return { x: r.left + 6, y: r.top + 120 };
});

/** Pixels on the mark overlay within `tol` of an rgb colour. */
const colourPixels = (page, rgb, tol = 14) => page.evaluate(({ rgb, tol }) => {
  const c = document.getElementById('annCanvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 100 && Math.abs(d[i] - rgb[0]) <= tol && Math.abs(d[i + 1] - rgb[1]) <= tol && Math.abs(d[i + 2] - rgb[2]) <= tol) n++;
  }
  return n;
}, { rgb, tol });

const ROOM_PURPLE = [0x8e, 0x6f, 0xd8];
const SCHEDULE_AMBER = [0xe8, 0xc5, 0x47];
const MULTIPLY_GREEN = [0x47, 0xc8, 0x8e];

const starts = (page) => page.evaluate(() => {
  const s = window.state;
  return {
    quickLineStart: s.quickLineStart, highlightStart: s.highlightStart, multiplyZoneStart: s.multiplyZoneStart,
    scaleZoneStart: s.scaleZoneStart, deleteZoneStart: s.deleteZoneStart, roomBoxStart: s.roomBoxStart,
    scheduleBoxStart: s.scheduleBoxStart, chainStart: s.chainStart, ghostRectStart: s.ghostRectStart,
    placingGhost: s.placingGhost,
  };
});
const ALL_CLEAR = {
  quickLineStart: null, highlightStart: null, multiplyZoneStart: null, scaleZoneStart: null, deleteZoneStart: null,
  roomBoxStart: null, scheduleBoxStart: null, chainStart: null, ghostRectStart: null, placingGhost: null,
};

async function clickSheet(page, pdf) {
  const p = await screenFor(page, pdf);
  await page.mouse.click(p.x, p.y);
}
async function hover(page, pdf) {
  const p = await screenFor(page, pdf);
  await page.mouse.move(p.x, p.y, { steps: 3 });
}
const repaint = (page) => page.evaluate(() => window.App.renderAnnotations());

test.describe('MAP-RESETS: one reset path for tool starts and pointer drags', () => {
  /** @type {string[]} */
  let errors;
  test.beforeEach(async ({ page }) => { errors = []; await boot(page, errors); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('the reset helpers are published on App', async ({ page }) => {
    expect(await page.evaluate(() => [typeof window.App.clearToolStarts, typeof window.App.resetToMove])).toEqual(['function', 'function']);
  });

  test('V, one room corner, then M: Move mode draws no room band and the corner is gone (D05)', async ({ page }) => {
    await page.evaluate(() => document.getElementById('roomBtn').click());
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.ROOM));
    await repaint(page);
    const base = await colourPixels(page, ROOM_PURPLE);   // whatever the sheet shows in that colour already
    await clickSheet(page, { x: 100, y: 100 });
    await hover(page, { x: 220, y: 200 });
    expect(await page.evaluate(() => !!window.state.roomBoxStart)).toBe(true);
    expect(await colourPixels(page, ROOM_PURPLE)).toBeGreaterThan(base + 50);   // the band is up while sizing

    await page.keyboard.press('m');
    await hover(page, { x: 260, y: 240 });
    await repaint(page);
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.NONE));
    expect(await starts(page)).toEqual(ALL_CLEAR);
    expect(await colourPixels(page, ROOM_PURPLE)).toBe(base);
  });

  test('a half-drawn schedule box: Esc drops it with the tool (D26)', async ({ page }) => {
    await page.evaluate(() => { window.state.tool = window.App.TOOL.SCHEDULE; window.App.updateUI(); });
    await repaint(page);
    const base = await colourPixels(page, SCHEDULE_AMBER);
    await clickSheet(page, { x: 100, y: 100 });
    await hover(page, { x: 240, y: 200 });
    expect(await page.evaluate(() => !!window.state.scheduleBoxStart)).toBe(true);
    expect(await colourPixels(page, SCHEDULE_AMBER)).toBeGreaterThan(base + 50);

    await page.keyboard.press('Escape');
    await hover(page, { x: 280, y: 240 });
    await repaint(page);
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.NONE));
    expect(await starts(page)).toEqual(ALL_CLEAR);
    expect(await colourPixels(page, SCHEDULE_AMBER)).toBe(base);
  });

  test('a zone corner does not survive another tool button (D17)', async ({ page }) => {
    await page.evaluate(() => document.getElementById('multiplyZoneBtn').click());
    await repaint(page);
    const base = await colourPixels(page, MULTIPLY_GREEN);
    await clickSheet(page, { x: 100, y: 100 });
    await hover(page, { x: 220, y: 200 });
    expect(await page.evaluate(() => !!window.state.multiplyZoneStart)).toBe(true);
    expect(await colourPixels(page, MULTIPLY_GREEN)).toBeGreaterThan(base + 50);

    await page.evaluate(() => document.getElementById('noteBtn').click());
    await hover(page, { x: 260, y: 240 });
    await repaint(page);
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.NOTE));
    expect(await starts(page)).toEqual(ALL_CLEAR);
    expect(await colourPixels(page, MULTIPLY_GREEN)).toBe(base);

    // H, one corner, then L (one line type: Quick Line arms directly): no highlight band under Line.
    await page.evaluate(() => document.getElementById('highlightBtn').click());
    await clickSheet(page, { x: 100, y: 100 });
    expect(await page.evaluate(() => !!window.state.highlightStart)).toBe(true);
    await page.evaluate(() => document.getElementById('quickLine').click());
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.LINE));
    expect(await starts(page)).toEqual(ALL_CLEAR);
  });

  test('a note dragged off the canvas keeps its new place and is saved (D21)', async ({ page }) => {
    const orig = await page.evaluate(() => {
      const s = window.state;
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      if (!ann.notes) ann.notes = [];
      ann.notes.push({ x: 200, y: 200, text: 'Drag me', id: 'n1', width: 150, fontSize: 14, placementRotation: 0, color: '#e85447' });
      window.App.renderAnnotations();
      window.App.setAutoSaveDirty(false);
      return { x: 200, y: 200 };
    });
    const out = await outsideCanvas(page);
    expect(out.outside).toBe(true);
    const from = await screenFor(page, { x: orig.x + 20, y: orig.y + 8 });
    const edge = await nearEdge(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(edge.x, edge.y, { steps: 8 });
    await page.mouse.move(out.x, out.y, { steps: 3 });
    await page.mouse.up();

    const after = await page.evaluate(() => {
      const n = window.App.getActiveAnnotations(window.state.pages[0]).notes[0];
      return { x: n.x, y: n.y, dirty: !!window.App.getAutoSaveDirty(), dragging: window.state.draggingNoteIdx };
    });
    expect(after.x).toBeLessThan(orig.x - 50);          // it moved toward the edge and stayed there
    expect(after.dirty).toBe(true);                      // the edit is saved like an on-sheet release
    expect(after.dragging).toBe(null);

    // Coming back over the sheet does not pick it up again.
    await hover(page, { x: 400, y: 400 });
    const again = await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).notes[0].x);
    expect(again).toBe(after.x);
  });

  test('a zone dragged off the canvas in Move is committed and saved (D21)', async ({ page }) => {
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      ann.multiplyZones.push({ id: 'mz1', x1: 100, y1: 100, x2: 300, y2: 250, multiplier: 3 });
      window.App.invalidateFooterTotals();
      window.App.renderAnnotations();
      window.App.updateUI();
      window.App.setAutoSaveDirty(false);
    });
    const out = await outsideCanvas(page);
    const from = await screenFor(page, { x: 200, y: 175 });
    const edge = await nearEdge(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(edge.x, edge.y, { steps: 8 });
    await page.mouse.move(out.x, out.y, { steps: 3 });
    await page.mouse.up();
    const after = await page.evaluate(() => {
      const z = window.App.getActiveAnnotations(window.state.pages[0]).multiplyZones[0];
      return { x1: z.x1, dirty: !!window.App.getAutoSaveDirty(), dragging: window.state.draggingZone };
    });
    expect(after.x1).toBeLessThan(100);
    expect(after.dirty).toBe(true);
    expect(after.dragging).toBe(null);
  });

  test('a ghost released off the canvas does not ride the pointer back in (D21)', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.state;
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.counterMarkers = { wc: [{ x: 210, y: 210, id: 'm1' }, { x: 230, y: 230, id: 'm2' }] };
      const g = window.App.captureGhostFromRect(ann, 0, 200, 200, 240, 240, 'Typical');
      if (!Array.isArray(ann.ghosts)) ann.ghosts = [];
      ann.ghosts.push(g);
      s.tool = window.App.TOOL.GHOST;
      window.App.updateUI();
      window.App.renderAnnotations();
      window.App.setAutoSaveDirty(false);
    });
    const firstX = () => page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0].src.counterMarkers.wc[0].x);
    const x0 = await firstX();
    const out = await outsideCanvas(page);
    const from = await screenFor(page, { x: 220, y: 220 });
    const edge = await nearEdge(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(edge.x, edge.y, { steps: 8 });
    await page.mouse.move(out.x, out.y, { steps: 3 });
    await page.mouse.up();
    const x1 = await firstX();
    expect(x1).toBeLessThan(x0);                          // it moved with the drag
    expect(await page.evaluate(() => [window.state.draggingGhostIdx, !!window.App.getAutoSaveDirty()])).toEqual([null, true]);
    await hover(page, { x: 400, y: 400 });
    expect(await firstX()).toBe(x1);                      // and stays put when the pointer comes back

    // Out and back in with the button held: the ghost follows again, and the
    // release on the sheet is still a ghost drag (no stray capture corner).
    const g2 = await page.evaluate(() => { const b = window.App.ghostBounds(window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0]); return { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 }; });
    const from2 = await screenFor(page, g2);
    await page.mouse.move(from2.x, from2.y);
    await page.mouse.down();
    await page.mouse.move(edge.x, edge.y, { steps: 8 });
    await page.mouse.move(out.x, out.y, { steps: 3 });
    const back = await screenFor(page, { x: 300, y: 300 });
    await page.mouse.move(back.x, back.y, { steps: 6 });
    await page.mouse.up();
    const end = await page.evaluate(() => ({
      x: window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0].src.counterMarkers.wc[0].x,
      rectArmed: !!window.state.ghostRectStart, dragging: window.state.draggingGhostIdx,
    }));
    expect(end.x).toBeGreaterThan(x1 + 100);             // it followed the pointer back in
    expect(end.rectArmed).toBe(false);
    expect(end.dragging).toBe(null);
  });
});

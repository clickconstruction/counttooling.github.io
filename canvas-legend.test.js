'use strict';
// Node unit tests for canvas-legend.js — the sheet legend (the tally list and
// the E-/M-sheet block) and the grid overlay, split out of canvas-draw.js in
// R24 (these tests moved with it from canvas-draw.test.js, pointed at
// createCanvasLegend; canvas-draw.test.js keeps one test that the composed
// canvasDraw.* keys paint the same). The same recording 2D-context stub; the
// geometry/icons/duct-model globals arrive via Object.assign(globalThis, ...).
// Run with `npm run test:unit`.
const test = require('node:test');
const assert = require('node:assert');

Object.assign(globalThis, require('./geometry.js'));
Object.assign(globalThis, require('./icons.js'));
Object.assign(globalThis, require('./duct-model.js'));
const { CIRCLE_PATH } = require('./icons.js');
global.Path2D = class Path2D { constructor(d) { this.d = d; } };

const { createCanvasLegend, createLegendFaceLoader, hexToRgb, lineStyleToDash, LEGEND_FACE, LEGEND_FACE_WEIGHTS } = require('./canvas-legend.js');

// Records every method call as [name, ...args] and every property write as
// ['set:<prop>', value]; measureText returns a deterministic width.
function makeCtx() {
  const calls = [];
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'calls') return calls;
      if (prop === 'measureText') return (s) => { calls.push(['measureText', s]); return { width: String(s).length * 7 }; };
      return (...args) => { calls.push([prop, ...args]); };
    },
    set(t, prop, v) { calls.push(['set:' + prop, v]); return true; },
  });
}
const setsOf = (ctx, prop) => ctx.calls.filter(c => c[0] === 'set:' + prop).map(c => c[1]);
const callsOf = (ctx, name) => ctx.calls.filter(c => c[0] === name);

function makeState(overrides) {
  return Object.assign({
    lineTypes: [{ id: 'lt-arc', name: 'Arc', curveStyle: 'arc' }, { id: 'lt-straight', name: 'Straight' }],
    counters: [{ id: 'c1', name: 'Counter', icon: CIRCLE_PATH, color: '#e8c547' }],
    rooms: [{ id: 'r1', name: 'Room', color: '#8e6fd8' }],
    groups: [{ id: 'g1', name: 'Group', color: '#e85447' }],
  }, overrides);
}

// The legend's deps (a subset of canvas-draw's; see canvas-legend.js's header).
function makeDeps(state) {
  return {
    getState: () => state,
    getEffectiveScaleForLine: () => ({ pixelsPerUnit: 4, unit: 'ft' }),
    iconRenderVb: () => 640,
    iconRenderCenter: () => ({ x: 320, y: 320 }),
  };
}

const tc1 = (p) => ({ x: p.x, y: p.y });

test('hexToRgb parses hex with/without hash and falls back to white', () => {
  assert.deepStrictEqual(hexToRgb('#47c88e'), [71, 200, 142]);
  assert.deepStrictEqual(hexToRgb('47c88e'), [71, 200, 142]);
  assert.deepStrictEqual(hexToRgb('nope'), [255, 255, 255]);
  assert.deepStrictEqual(hexToRgb(null), [255, 255, 255]);
});

test('lineStyleToDash maps styles', () => {
  assert.deepStrictEqual(lineStyleToDash('dashed'), [4, 4]);
  assert.deepStrictEqual(lineStyleToDash('dotted'), [2, 2]);
  assert.deepStrictEqual(lineStyleToDash('solid'), []);
  assert.deepStrictEqual(lineStyleToDash(undefined), []);
});

// --- drawLegend / drawGrid (previously zero-coverage regions) --------------

function makePage(w, h) {
  return { pdfPage: { getViewport: () => ({ width: w, height: h }) }, rotation: 0 };
}
function legendState(overrides) {
  return makeState(Object.assign({
    showLegendOverlay: true,
    legendSettings: { legendScale: 1, bgColor: '#ffffff', bgOpacity: 1, textOpacity: 1, showBorder: true },
    counters: [{ id: 'c1', name: 'WC', icon: CIRCLE_PATH, color: '#e8c547' }],
    lineTypes: [{ id: 'lt1', name: 'Waste', color: '#47c88e' }],
    rooms: [{ id: 'r1', name: 'Bath', color: '#8e6fd8' }],
  }, overrides));
}
function legendDeps(state) {
  return Object.assign(makeDeps(state), {
    getPageScale: () => ({ pixelsPerUnit: 10, unit: 'ft' }),
    // T1-05: drawLegend consumes the ft/px split; a line flagged `unscaled`
    // routes into the px bucket, everything else is 12 ft.
    getLineLengthSplitForTotals: (line) => (line && line.unscaled ? { feet: 0, px: 200 } : { feet: 12, px: 0 }),
    getEffectiveScaleForLine: () => ({ pixelsPerUnit: 10, unit: 'ft' }),
    iconRenderVb: () => 640,
    iconRenderCenter: () => ({ x: 320, y: 320 }),
  });
}
function legendAnn() {
  return {
    legend: { x: 20, y: 20, w: 100, h: 60 },
    counterMarkers: { c1: [{ x: 10, y: 10 }, { x: 300, y: 300 }] },
    multiplyZones: [{ x1: 0, y1: 0, x2: 50, y2: 50, multiplier: 2 }],
    quickLines: [{ x1: 0, y1: 0, x2: 120, y2: 0, lineTypeId: 'lt1' }],
    polylines: [],
    roomBoxes: [{ x1: 0, y1: 0, x2: 100, y2: 80, heightFt: 10, roomId: 'r1' }],
  };
}

test('drawLegend: gated off when hidden or when the canvas has no legend', () => {
  const state = legendState({ showLegendOverlay: false });
  const draw = createCanvasLegend(legendDeps(state));
  const ctx = makeCtx();
  draw.drawLegend(ctx, makePage(612, 792), 0, legendAnn(), 1, tc1);
  assert.strictEqual(ctx.calls.length, 0);

  const state2 = legendState();
  const draw2 = createCanvasLegend(legendDeps(state2));
  const ctx2 = makeCtx();
  draw2.drawLegend(ctx2, makePage(612, 792), 0, { legend: null }, 1, tc1);
  assert.strictEqual(ctx2.calls.length, 0);
});

test('drawLegend: rows render with multiply-zone counts, feet totals, and room volumes', () => {
  const state = legendState();
  const draw = createCanvasLegend(legendDeps(state));
  const ctx = makeCtx();
  const ann = legendAnn();
  draw.drawLegend(ctx, makePage(612, 792), 0, ann, 1, tc1);
  const texts = callsOf(ctx, 'fillText').map(c => c[1]);
  // Counter: marker inside the x2 zone + one outside = 3 effective.
  assert.ok(texts.includes('WC [3]'), 'counter row with zone-adjusted count; got ' + JSON.stringify(texts));
  // Line: 12 feet through the injected tally, formatted via formatFeet.
  assert.ok(texts.includes('Waste 12.00 ft'), 'line row with feet total; got ' + JSON.stringify(texts));
  // Room: 100x80pt at 10px/ft = 10ft x 8ft x 10ft = 800 cubic feet.
  assert.ok(texts.includes('Bath 800 ft³'), 'room row with volume; got ' + JSON.stringify(texts));
  // Background paints before any row text.
  const fillRects = callsOf(ctx, 'fillRect');
  assert.ok(fillRects.length >= 1, 'legend background fillRect');
  // Auto-size wrote the legend box back in PDF units, clamped inside the page.
  assert.ok(ann.legend.w >= 60 && ann.legend.w <= 612 - ann.legend.x - 10);
  assert.ok(ann.legend.h >= 40 && ann.legend.h <= 792 - ann.legend.y - 10);
});

test('drawLegend: mixed scaled/unscaled line rows read "N ft + M px", all-scaled rows unchanged', () => {
  // Mixed fixture: one 12-ft line + one 200-px (unscaled) line of the same
  // type — the row must keep the buckets separate, never "32.00 ft".
  const state = legendState();
  const draw = createCanvasLegend(legendDeps(state));
  const ctx = makeCtx();
  const ann = legendAnn();
  ann.quickLines.push({ x1: 0, y1: 0, x2: 200, y2: 0, lineTypeId: 'lt1', unscaled: true });
  draw.drawLegend(ctx, makePage(612, 792), 0, ann, 1, tc1);
  const texts = callsOf(ctx, 'fillText').map(c => c[1]);
  const row = texts.find(t => String(t).startsWith('Waste'));
  assert.ok(row && row.includes('ft + ') && row.includes(' px'), 'mixed row splits ft and px; got ' + JSON.stringify(texts));
  assert.strictEqual(row, 'Waste 12.00 ft + 200 px');
  // measureText saw the same string (row width accounting).
  assert.ok(callsOf(ctx, 'measureText').some(c => c[1] === 'Waste 12.00 ft + 200 px'));

  // All-scaled fixture: output is byte-identical to the pre-split renderer.
  const ctx2 = makeCtx();
  draw.drawLegend(ctx2, makePage(612, 792), 0, legendAnn(), 1, tc1);
  const texts2 = callsOf(ctx2, 'fillText').map(c => c[1]);
  assert.ok(texts2.includes('Waste 12.00 ft'), 'all-scaled row unchanged; got ' + JSON.stringify(texts2));
});

// D15: the legend's room air ⚠ line rides the deps seam (getRoomBalanceForPage
// — app-side, cross-page), so the core stays pure: under-served rooms on the
// sheet paint one line each behind legendSettings.showDuct; served rooms,
// showDuct:false, a box-less page and a missing dep all paint NOTHING extra —
// the call log is byte-identical to the pre-D15 renderer.
test('drawLegend: D15 room air line — under-served rooms only, behind showDuct, absent without the dep', () => {
  const balance = [
    { id: 'r1', name: 'Office 101', color: '#8e6fd8', targetCfm: 450, servedCfm: 300, under: true },
    { id: 'r2', name: 'Storage', color: '#47c88e', targetCfm: 100, servedCfm: 100, under: false },
  ];
  const withDep = (state, rows) => Object.assign(legendDeps(state), { getRoomBalanceForPage: () => rows });

  const state = legendState();
  const ctx = makeCtx();
  createCanvasLegend(withDep(state, balance)).drawLegend(ctx, makePage(612, 792), 0, legendAnn(), 1, tc1);
  const texts = callsOf(ctx, 'fillText').map(c => c[1]);
  assert.ok(texts.includes('⚠ Office 101 needs 450 · served 300'), 'under-served line; got ' + JSON.stringify(texts));
  assert.ok(!texts.some(t => String(t).includes('Storage')), 'a served room paints no line; got ' + JSON.stringify(texts));
  assert.ok(callsOf(ctx, 'measureText').some(c => c[1] === '⚠ Office 101 needs 450 · served 300'), 'the line joins the width fit');
  // Legend row order: the air line sits right after the room volume row.
  assert.ok(texts.indexOf('⚠ Office 101 needs 450 · served 300') === texts.indexOf('Bath 800 ft³') + 1);

  // Baseline: the pre-D15 renderer (no dep at all).
  const base = makeCtx();
  createCanvasLegend(legendDeps(legendState())).drawLegend(base, makePage(612, 792), 0, legendAnn(), 1, tc1);
  assert.ok(!callsOf(base, 'fillText').some(c => String(c[1]).startsWith('⚠')));

  // Dep present but nothing under-served → byte-identical to the baseline.
  const served = makeCtx();
  createCanvasLegend(withDep(legendState(), [balance[1]])).drawLegend(served, makePage(612, 792), 0, legendAnn(), 1, tc1);
  assert.deepStrictEqual(served.calls, base.calls);
  // Dep present, rows empty (no room carries a target — the render-pixels fixture) → identical.
  const empty = makeCtx();
  createCanvasLegend(withDep(legendState(), [])).drawLegend(empty, makePage(612, 792), 0, legendAnn(), 1, tc1);
  assert.deepStrictEqual(empty.calls, base.calls);
  // showDuct off → the line is gated with the duct rows (no new toggle).
  const off = makeCtx();
  const offState = legendState({ legendSettings: { legendScale: 1, bgColor: '#ffffff', bgOpacity: 1, textOpacity: 1, showBorder: true, showDuct: false } });
  createCanvasLegend(withDep(offState, balance)).drawLegend(off, makePage(612, 792), 0, legendAnn(), 1, tc1);
  assert.deepStrictEqual(off.calls, base.calls);
  // A page without room boxes never even asks the dep.
  let asked = 0;
  const noBoxes = Object.assign(legendDeps(legendState()), { getRoomBalanceForPage: () => { asked++; return balance; } });
  const ann = legendAnn(); ann.roomBoxes = [];
  createCanvasLegend(noBoxes).drawLegend(makeCtx(), makePage(612, 792), 0, ann, 1, tc1);
  assert.strictEqual(asked, 0);
});

// B10 (J8): an empty legend used to paint a mystery "No items" box on a
// brand-new sheet — it now paints NOTHING, and legendHasRows exposes the same
// gate so app.js hitTest can keep the invisible box from catching the mouse.
test('drawLegend: no rows -> nothing painted; legendHasRows mirrors the gate', () => {
  const state = legendState({ counters: [], lineTypes: [], rooms: [] });
  const draw = createCanvasLegend(legendDeps(state));
  const ctx = makeCtx();
  const emptyAnn = { legend: { x: 10, y: 10, w: 80, h: 40 }, counterMarkers: {}, quickLines: [], polylines: [], roomBoxes: [] };
  draw.drawLegend(ctx, makePage(612, 792), 0, emptyAnn, 1, tc1);
  assert.strictEqual(ctx.calls.length, 0, 'empty legend paints nothing; got ' + JSON.stringify(ctx.calls));
  assert.strictEqual(draw.legendHasRows(emptyAnn, 0), false);

  // Populated: rows exist -> hittable again.
  const draw2 = createCanvasLegend(legendDeps(legendState()));
  assert.strictEqual(draw2.legendHasRows(legendAnn(), 0), true);
});

// B10 (J18): the legend's scope ("This sheet" — current-page numbers beside
// project-total surfaces) is printed on the legend itself, as a small grey
// header above the rows.
test('drawLegend: "This sheet" scope header paints first, above the rows', () => {
  const state = legendState();
  const draw = createCanvasLegend(legendDeps(state));
  const ctx = makeCtx();
  draw.drawLegend(ctx, makePage(612, 792), 0, legendAnn(), 1, tc1);
  const textCalls = callsOf(ctx, 'fillText');
  const texts = textCalls.map(c => c[1]);
  assert.strictEqual(texts[0], 'This sheet', 'header first; got ' + JSON.stringify(texts));
  // Rows start below the header band (12pt at legendScale 1).
  const headerY = textCalls[0][3];
  const firstRowY = textCalls[1][3];
  assert.ok(firstRowY >= headerY + 12, 'rows offset below the header');
});

// B10 (J18): the anchor lives in page coords — an R rotation (sheet w/h swap)
// or an anchor parked near the right edge must walk the box left/up until the
// wanted width fits, instead of starving the box and clipping rows.
test('drawLegend: off-page (post-rotation) and right-edge anchors are walked back on-sheet at ideal width', () => {
  const state = legendState();
  const draw = createCanvasLegend(legendDeps(state));

  // Post-rotation: anchor at x=700 on a sheet now 612 wide (was 792 pre-R).
  const annRot = legendAnn();
  annRot.legend = { x: 700, y: 16, w: 100, h: 56 };
  draw.drawLegend(makeCtx(), makePage(612, 792), 0, annRot, 1, tc1);
  assert.ok(annRot.legend.x + annRot.legend.w <= 612 - 10, 'legend back inside the rotated sheet; got x=' + annRot.legend.x + ' w=' + annRot.legend.w);

  // Right-edge anchor: x leaves less room than the ideal width -> the anchor
  // shifts left and the box keeps its ideal width (rows no longer clipped).
  const annEdge = legendAnn();
  annEdge.legend = { x: 612 - 110, y: 16, w: 100, h: 56 };
  const ctrl = legendAnn();
  ctrl.legend = { x: 20, y: 20, w: 100, h: 60 };
  draw.drawLegend(makeCtx(), makePage(612, 792), 0, ctrl, 1, tc1);
  draw.drawLegend(makeCtx(), makePage(612, 792), 0, annEdge, 1, tc1);
  assert.strictEqual(annEdge.legend.w, ctrl.legend.w, 'edge-anchored box keeps the ideal width');
  assert.ok(annEdge.legend.x + annEdge.legend.w <= 612 - 10, 'and sits fully on-sheet');
});

test('drawGrid: gated off without the overlay flag, spacing, or a page scale', () => {
  const mk = (stateOver, depsOver) => {
    const state = makeState(Object.assign({ showGridOverlay: true, gridSettings: { spacing: 1 } }, stateOver));
    const deps = Object.assign(makeDeps(state), { getPageScale: () => ({ pixelsPerUnit: 10, unit: 'ft' }) }, depsOver);
    const ctx = makeCtx();
    createCanvasLegend(deps).drawGrid(ctx, makePage(100, 100), 0, 1, tc1);
    return ctx.calls.length;
  };
  assert.strictEqual(mk({ showGridOverlay: false }), 0);
  assert.strictEqual(mk({ gridSettings: { spacing: 0 } }), 0);
  assert.strictEqual(mk({}, { getPageScale: () => null }), 0);
});

test('drawGrid: line counts from spacing; major-interval lines double width with solid dash', () => {
  const state = makeState({
    showGridOverlay: true,
    gridSettings: { spacing: 1, opacity: 0.5, color: '#e8c547', lineWidth: 1, lineStyle: 'dashed', majorInterval: 5 },
  });
  const deps = Object.assign(makeDeps(state), { getPageScale: () => ({ pixelsPerUnit: 10, unit: 'ft' }) });
  const ctx = makeCtx();
  // 100x100pt page, 1ft grid @ 10px/ft = 10pt spacing -> 11 verticals + 11
  // horizontals (x/y = 0,10,...,100), no negative-offset lines.
  createCanvasLegend(deps).drawGrid(ctx, makePage(100, 100), 0, 1, tc1);
  const strokes = callsOf(ctx, 'stroke');
  assert.strictEqual(strokes.length, 22);
  // Major every 5th: indices 0,5,10 per axis = 3 majors x 2 axes.
  const dashes = callsOf(ctx, 'setLineDash').map(c => c[1]);
  assert.strictEqual(dashes.filter(d => Array.isArray(d) && d.length === 0).length, 6);
  const widths = setsOf(ctx, 'lineWidth');
  assert.strictEqual(widths.filter(w => w === 2).length, 6);
  assert.strictEqual(widths.filter(w => w === 1).length, 16);
  // Opacity + color applied once around the pass.
  assert.deepStrictEqual(setsOf(ctx, 'globalAlpha'), [0.5]);
  assert.ok(setsOf(ctx, 'strokeStyle').includes('rgb(232,197,71)'));
});

// --- the sheet legend (2026-09-19): style resolution, the compact block, the sheet factor --------

test('resolveLegendStyle: an explicit setting wins, else compact for electrical and HVAC, tally otherwise', () => {
  const draw = createCanvasLegend(legendDeps(legendState()));
  assert.strictEqual(draw.resolveLegendStyle({ legendSettings: {} }), 'tally');
  assert.strictEqual(draw.resolveLegendStyle({ trade: 'plumbing', legendSettings: {} }), 'tally');
  assert.strictEqual(draw.resolveLegendStyle({ trade: 'electrical', legendSettings: {} }), 'compact');
  assert.strictEqual(draw.resolveLegendStyle({ trade: 'hvac', legendSettings: {} }), 'compact');
  assert.strictEqual(draw.resolveLegendStyle({ trade: 'electrical', legendSettings: { style: 'tally' } }), 'tally');
  assert.strictEqual(draw.resolveLegendStyle({ trade: 'plumbing', legendSettings: { style: 'full' } }), 'full');
  assert.strictEqual(draw.resolveLegendStyle({ trade: 'hvac', legendSettings: { style: 'bogus' } }), 'compact');
});

test('legendSheetFactor: letter and ANSI B draw at 1×, a D sheet at about 2×, capped at 3×', () => {
  const draw = createCanvasLegend(legendDeps(legendState()));
  assert.strictEqual(draw.legendSheetFactor(612, 792), 1);
  assert.strictEqual(draw.legendSheetFactor(1224, 792), 1);
  assert.ok(Math.abs(draw.legendSheetFactor(2592, 1728) - 2.118) < 0.01);
  assert.ok(Math.abs(draw.legendSheetFactor(1728, 2592) - 2.118) < 0.01, 'the long side counts, whichever way the sheet turns');
  assert.strictEqual(draw.legendSheetFactor(9000, 9000), 3);
});

test('drawLegend: an electrical project draws the compact block — title with the sheet, caps descriptions, the mount column, the count', () => {
  const state = legendState({
    trade: 'electrical',
    counters: [{ id: 'c1', name: 'Duplex Receptacle', icon: CIRCLE_PATH, color: '#e85447', mountHeightIn: 18 }],
    lineTypes: [{ id: 'lt1', name: '3/4in EMT', color: '#a47fff' }],
    groups: [{ id: 'g1', name: 'Circuit 7', panel: 'LP-1', circuit: '7' }],
  });
  const deps = Object.assign(legendDeps(state), { getTrade: () => 'electrical', lineTypeSpecText: () => '3/4" EMT · 3 #12 THHN + 1 #12 G' });
  const draw = createCanvasLegend(deps);
  const ctx = makeCtx();
  const ann = legendAnn();
  draw.drawLegend(ctx, makePage(1224, 792), 0, ann, 1, tc1);
  const texts = callsOf(ctx, 'fillText').map(c => String(c[1]));
  assert.ok(texts.includes('ELECTRICAL LEGEND · THIS SHEET'), 'title names the trade and the scope; got ' + JSON.stringify(texts));
  assert.ok(texts.includes('DUPLEX RECEPTACLE'), 'description in caps');
  assert.ok(texts.includes('18" AFF'), 'the mount column');
  assert.ok(texts.includes('3'), 'the zone-adjusted count as the right-hand figure');
  assert.ok(texts.includes('3/4" EMT · 3 #12 THHN + 1 #12 G'), 'a conduit keeps its spec line in compact');
  assert.ok(texts.some(t => t.startsWith('PANEL LP-1')), 'the footer names the panel');
  assert.ok(!texts.includes('SYM'), 'compact has no column header');
  assert.ok(!texts.includes('Duplex Receptacle [3]'), 'not the tally row');
  // The compact block is shorter than the tally for the same rows (no panel:
  // no footer, which is the compact rule).
  const noPanel = legendState({ trade: 'electrical', counters: state.counters, lineTypes: state.lineTypes, groups: [] });
  const ann3 = legendAnn();
  createCanvasLegend(Object.assign(legendDeps(noPanel), { getTrade: () => 'electrical' })).drawLegend(makeCtx(), makePage(1224, 792), 0, ann3, 1, tc1);
  const tally = legendState({ counters: state.counters, lineTypes: state.lineTypes, legendSettings: { legendScale: 1, style: 'tally' } });
  const ann2 = legendAnn();
  createCanvasLegend(legendDeps(tally)).drawLegend(makeCtx(), makePage(1224, 792), 0, ann2, 1, tc1);
  assert.ok(ann3.legend.h < ann2.legend.h, 'compact ' + ann3.legend.h + ' shorter than tally ' + ann2.legend.h);
});

test('drawLegend: full adds the column header; an HVAC project reads neck · CFM; ink is a draw option', () => {
  const state = legendState({
    trade: 'hvac',
    legendSettings: { legendScale: 1, style: 'full' },
    counters: [{ id: 'c1', name: '12x12 Supply Diffuser', icon: CIRCLE_PATH, color: '#e8c547', cfm: 150 }],
    lineTypes: [],
  });
  const deps = Object.assign(legendDeps(state), { getTrade: () => 'hvac', suggestNeckSize: (cfm) => ({ neckDIn: cfm <= 150 ? 8 : 10, overCapacity: false }) });
  const draw = createCanvasLegend(deps);
  const ctx = makeCtx();
  const ann = legendAnn(); ann.quickLines = [];
  draw.drawLegend(ctx, makePage(1224, 792), 0, ann, 1, tc1, { ink: true });
  const texts = callsOf(ctx, 'fillText').map(c => String(c[1]));
  assert.ok(texts.includes('MECHANICAL LEGEND · THIS SHEET'), JSON.stringify(texts));
  assert.ok(texts.includes('SYM') && texts.includes('NECK · CFM') && texts.includes('QTY'), 'full draws the column header');
  assert.ok(texts.includes('8"Ø · 150'), 'neck from the table beside the CFM');
  assert.ok(texts.includes('BATH'), 'the room row in caps');
  assert.ok(texts.some(t => /DEVICES?$/.test(t)), 'full always carries the totals footer');
});

test('drawLegend: the tally is byte-for-byte the old list when no trade and no style are set', () => {
  const state = legendState();
  const draw = createCanvasLegend(legendDeps(state));
  const ctx = makeCtx();
  draw.drawLegend(ctx, makePage(612, 792), 0, legendAnn(), 1, tc1);
  const texts = callsOf(ctx, 'fillText').map(c => String(c[1]));
  assert.deepStrictEqual(texts, ['This sheet', 'WC [3]', 'Waste 12.00 ft', 'Bath 800 ft³']);
});

test('drawLegend: the box hugs its rows at legendScale; an oversized userResized box from an older save snaps back', () => {
  // The corner grip and the size slider both set legendSettings.legendScale
  // (2026-09-21); the box is always the rows' size at that scale.
  const at = (legendScale, style) => {
    const state = legendState({ legendSettings: { legendScale, bgColor: '#ffffff', bgOpacity: 1, textOpacity: 1, showBorder: true, style } });
    const ann = legendAnn();
    createCanvasLegend(legendDeps(state)).drawLegend(makeCtx(), makePage(1224, 792), 0, ann, 1, tc1);
    return ann.legend;
  };
  for (const style of ['tally', 'compact']) {
    const one = at(1, style), half = at(0.5, style), twice = at(2, style);
    assert.ok(half.w < one.w && half.h < one.h, style + ': half the scale, a smaller box (' + half.w + '×' + half.h + ' vs ' + one.w + '×' + one.h + ')');
    assert.ok(twice.w > one.w && twice.h > one.h, style + ': twice the scale, a bigger box');
    assert.ok(Math.abs(half.h - one.h / 2) < 0.01, style + ': the height scales linearly (' + half.h + ' vs ' + one.h + ')');
    // A box a pre-2026-09-21 save grew past its rows with the grip.
    const state = legendState({ legendSettings: { legendScale: 1, bgColor: '#ffffff', bgOpacity: 1, textOpacity: 1, showBorder: true, style } });
    const ann = legendAnn();
    ann.legend = { x: 20, y: 20, w: 500, h: 400, userResized: true };
    createCanvasLegend(legendDeps(state)).drawLegend(makeCtx(), makePage(1224, 792), 0, ann, 1, tc1);
    assert.deepStrictEqual([ann.legend.w, ann.legend.h], [one.w, one.h], style + ': the oversized box snaps to its rows');
  }
});

// --- LEGEND-FACE: the sheet block in Barlow Condensed, loaded before it is drawn ---

// A FontFaceSet stub: load() resolves (with one face) when release() is called.
function makeFonts({ fail = false, empty = false } = {}) {
  const asked = [];
  let release;
  const gate = new Promise(res => { release = res; });
  return {
    asked,
    release: () => release(),
    load(font) {
      asked.push(font);
      return gate.then(() => { if (fail) throw new Error('NetworkError'); return empty ? [] : [{ family: 'Barlow Condensed' }]; });
    },
  };
}

test('LEGEND-FACE: the compact and full blocks measure and draw in Barlow Condensed, at the four weights the loader asks for', () => {
  for (const style of ['compact', 'full']) {
    const state = legendState({ trade: 'electrical', legendSettings: { legendScale: 1, style } });
    const ctx = makeCtx();
    createCanvasLegend(Object.assign(legendDeps(state), { getTrade: () => 'electrical', getFonts: () => null })).drawLegend(ctx, makePage(1224, 792), 0, legendAnn(), 1, tc1);
    const fonts = setsOf(ctx, 'font');
    assert.ok(fonts.length > 0, style + ': fonts set');
    assert.ok(fonts.every(f => f.endsWith('px ' + LEGEND_FACE)), style + ': every legend font is the condensed face; got ' + JSON.stringify(fonts));
    const weights = new Set(fonts.map(f => Number(f.split(' ')[0])));
    for (const w of weights) assert.ok(LEGEND_FACE_WEIGHTS.includes(w), style + ': weight ' + w + ' is one the loader fetches');
  }
  assert.ok(LEGEND_FACE.startsWith('"Barlow Condensed"') && /"DM Sans", sans-serif$/.test(LEGEND_FACE), 'DM Sans is the fallback');
});

test('LEGEND-FACE: the plumbing tally keeps its sans-serif (no condensed face, no load asked for)', () => {
  const fontsSet = makeFonts();
  const ctx = makeCtx();
  createCanvasLegend(Object.assign(legendDeps(legendState()), { getFonts: () => fontsSet })).drawLegend(ctx, makePage(612, 792), 0, legendAnn(), 1, tc1);
  assert.ok(setsOf(ctx, 'font').every(f => /px sans-serif$/.test(f)));
  assert.strictEqual(fontsSet.asked.length, 0, 'the tally never asks for the legend face');
});

test('LEGEND-FACE: a block drawn before the face loaded asks for it once and is redrawn once it arrives', async () => {
  const fontsSet = makeFonts();
  let redraws = 0;
  const state = legendState({ trade: 'hvac' });
  const legend = createCanvasLegend(Object.assign(legendDeps(state), { getTrade: () => 'hvac', getFonts: () => fontsSet, onLegendFaceLoaded: () => { redraws++; } }));
  legend.drawLegend(makeCtx(), makePage(1224, 792), 0, legendAnn(), 1, tc1);
  legend.drawLegend(makeCtx(), makePage(1224, 792), 0, legendAnn(), 1, tc1);
  assert.deepStrictEqual(fontsSet.asked, LEGEND_FACE_WEIGHTS.map(w => w + ' 10px "Barlow Condensed"'), 'each weight asked for once, however many draws');
  assert.strictEqual(legend.legendFaceLoaded(), false);
  fontsSet.release();
  assert.strictEqual(await legend.legendFaceReady(), true);
  assert.strictEqual(legend.legendFaceLoaded(), true);
  assert.strictEqual(redraws, 1, 'one redraw when the face arrives');
  legend.drawLegend(makeCtx(), makePage(1224, 792), 0, legendAnn(), 1, tc1);
  assert.strictEqual(redraws, 1, 'no redraw once loaded');
});

test('LEGEND-FACE: ready() never rejects and never hangs: a failed load, an empty match, no FontFaceSet, a timeout all resolve false', async () => {
  const failed = makeFonts({ fail: true });
  const pFail = createLegendFaceLoader(() => failed, 1000).ready();
  failed.release();
  assert.strictEqual(await pFail, false);
  const empty = makeFonts({ empty: true });
  const pEmpty = createLegendFaceLoader(() => empty, 1000).ready();
  empty.release();
  assert.strictEqual(await pEmpty, false);
  assert.strictEqual(await createLegendFaceLoader(() => null, 1000).ready(), false);
  const never = makeFonts();   // never released
  const t0 = Date.now();
  assert.strictEqual(await createLegendFaceLoader(() => never, 30).ready(), false);
  assert.ok(Date.now() - t0 < 1000, 'the timeout bounds the wait');
});

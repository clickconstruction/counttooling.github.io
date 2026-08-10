'use strict';
// Node unit tests for canvas-draw.js — the annotation draw core. A recording
// 2D-context stub (Proxy call log) stands in for CanvasRenderingContext2D, and
// the geometry/icons globals arrive via Object.assign(globalThis, require(...))
// per the line-metrics.test.js pattern. Run with `npm run test:unit`.
const test = require('node:test');
const assert = require('node:assert');

Object.assign(globalThis, require('./geometry.js'));
Object.assign(globalThis, require('./icons.js'));
const { CIRCLE_PATH, RING_PATH } = require('./icons.js');
global.Path2D = class Path2D { constructor(d) { this.d = d; } };

const { createCanvasDraw, drawDropMarker, hexToRgb, lineStyleToDash } = require('./canvas-draw.js');

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
    showGroupColors: false,
    lineTypeSettings: { opacity: 0.8, lineSize: 3, dropXSize: 10, dropIconStyle: 'circle', parallelEndsSize: 10, lengthLabelSize: 12, orientLengthWithLine: true },
    counterSettings: { size: 22, opacity: 1, showRings: false, numberSize: 10, ringSize: 100, ringOpacity: 1, ringSolid: true, outlineSize: 0 },
    multiplyZoneSettings: { showLabelOnZone: true, labelSize: 14, labelPosition: 'center' },
  }, overrides);
}

function makeDeps(state) {
  return {
    getState: () => state,
    getEffectiveScaleForLine: () => ({ pixelsPerUnit: 4, unit: 'ft' }),
    getLineRealWorldLength: () => 10,
    formatDistFeetInchesFromReal: (len) => len + ' ft',
    getGroupColor: (gid) => (state.groups.find(g => g.id === gid) || {}).color || '#999',
    wrapNoteText: (text) => ({ lines: [text] }),
    getNoteRotationRad: () => 0,
    iconRenderVb: () => 640,
    iconRenderCenter: () => ({ x: 320, y: 320 }),
  };
}

const tc1 = (p) => ({ x: p.x, y: p.y });
function makeEnv(overrides) {
  return Object.assign({
    tc: tc1,
    page: {},
    pageIdx: 0,
    lineWidth: 3,
    lineOpacity: 0.8,
    dropSize: 10,
    dropStyle: 'circle',
    fontScale: 1,
    labelPad: 4,
    dotRadius: 4,
    counterSize: 22,
    counterOutline: 0,
    counterNumberSize: 10,
    fontFamily: 'DM Sans',
    selection: null,
    drawNoteHandles: false,
  }, overrides);
}
const emptyAnn = () => ({ quickLines: [], polylines: [], highlights: [], multiplyZones: [], scaleZones: [], roomBoxes: [], notes: [], counterMarkers: {} });

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

test('drawDropMarker: circle arcs, X crosses, save/restore balanced, inner stroke recolored', () => {
  const ctx = makeCtx();
  drawDropMarker(ctx, { x: 5, y: 5 }, 10, '#123456', 'circle');
  assert.strictEqual(callsOf(ctx, 'arc').length, 1);
  assert.strictEqual(callsOf(ctx, 'save').length, callsOf(ctx, 'restore').length);
  assert.ok(setsOf(ctx, 'strokeStyle').includes('#123456'));

  const x = makeCtx();
  drawDropMarker(x, { x: 0, y: 0 }, 10, null, 'x');
  assert.strictEqual(callsOf(x, 'arc').length, 0);
  assert.strictEqual(callsOf(x, 'moveTo').length, 2); // the two X strokes
  assert.ok(setsOf(x, 'strokeStyle').includes('#4a9eff')); // default color
});

test('drawRoomBoxesToContext: box renders rect + name; scale-less gets "no scale"; tiny box skips text', () => {
  const state = makeState();
  const draw = createCanvasDraw(makeDeps(state));
  const ctx = makeCtx();
  const ann = { roomBoxes: [{ x1: 0, y1: 0, x2: 200, y2: 100, heightFt: 9, roomId: 'r1' }] };
  draw.drawRoomBoxesToContext(ctx, ann, 0, tc1, 1);
  assert.strictEqual(callsOf(ctx, 'strokeRect').length, 1);
  assert.ok(callsOf(ctx, 'fillText').some(c => c[1] === 'Room'));

  const deps = makeDeps(state);
  deps.getEffectiveScaleForLine = () => null;
  const noScale = createCanvasDraw(deps);
  const ctx2 = makeCtx();
  noScale.drawRoomBoxesToContext(ctx2, ann, 0, tc1, 1);
  assert.ok(callsOf(ctx2, 'fillText').some(c => c[1] === 'no scale'));

  const ctx3 = makeCtx();
  draw.drawRoomBoxesToContext(ctx3, { roomBoxes: [{ x1: 0, y1: 0, x2: 20, y2: 10, roomId: 'r1' }] }, 0, tc1, 1);
  assert.strictEqual(callsOf(ctx3, 'strokeRect').length, 1); // box drawn
  assert.strictEqual(callsOf(ctx3, 'fillText').length, 0);   // label skipped
});

test('core: selection glow doubles width + sets shadow (live), absent under export env', () => {
  const state = makeState();
  const draw = createCanvasDraw(makeDeps(state));
  const ann = emptyAnn();
  const line = { id: 'q1', x1: 0, y1: 0, x2: 100, y2: 0, lineTypeId: 'lt-straight' };
  ann.quickLines = [line];

  const live = makeCtx();
  draw.drawAnnotationsCore(live, ann, makeEnv({ selection: { id: 'q1', isPoly: false } }));
  assert.ok(setsOf(live, 'lineWidth').includes(6));      // 2x env.lineWidth
  assert.ok(setsOf(live, 'shadowBlur').includes(8));

  const exp = makeCtx();
  draw.drawAnnotationsCore(exp, ann, makeEnv({ selection: null }));
  assert.ok(!setsOf(exp, 'lineWidth').includes(6));
  assert.strictEqual(setsOf(exp, 'shadowBlur').length, 0);
});

test('core: env.fontFamily flows into length labels and notes; counter numbers stay DM Sans', () => {
  const state = makeState();
  const draw = createCanvasDraw(makeDeps(state));
  const ann = emptyAnn();
  ann.quickLines = [{ id: 'q1', x1: 0, y1: 0, x2: 100, y2: 0, lineTypeId: 'lt-straight', showLength: true }];
  ann.notes = [{ text: 'note', x: 10, y: 10 }];
  ann.counterMarkers = { c1: [{ x: 1, y: 1 }, { x: 2, y: 2 }] };

  const exp = makeCtx();
  draw.drawAnnotationsCore(exp, ann, makeEnv({ fontFamily: 'sans-serif', fontScale: 2 }));
  const fonts = setsOf(exp, 'font');
  assert.ok(fonts.includes('24px sans-serif'));  // length label: 12 * fontScale 2
  assert.ok(fonts.includes('28px sans-serif'));  // note: 14 * fontScale 2
  assert.ok(fonts.includes('10px DM Sans'));     // counter index number quirk
});

test('core: note handles only when env.drawNoteHandles', () => {
  const state = makeState();
  const draw = createCanvasDraw(makeDeps(state));
  const ann = emptyAnn();
  ann.notes = [{ text: 'note', x: 10, y: 10, width: 150 }];

  const live = makeCtx();
  draw.drawAnnotationsCore(live, ann, makeEnv({ drawNoteHandles: true }));
  assert.strictEqual(callsOf(live, 'fillRect').length, 2); // the two handle squares

  const exp = makeCtx();
  draw.drawAnnotationsCore(exp, ann, makeEnv({ drawNoteHandles: false }));
  assert.strictEqual(callsOf(exp, 'fillRect').length, 0);
});

test('core: group dots use env.dotRadius and the group color when showGroupColors', () => {
  const state = makeState({ showGroupColors: true });
  const draw = createCanvasDraw(makeDeps(state));
  const ann = emptyAnn();
  ann.quickLines = [{ id: 'q1', x1: 0, y1: 0, x2: 100, y2: 0, lineTypeId: 'lt-straight', group: 'g1' }];

  const ctx = makeCtx();
  draw.drawAnnotationsCore(ctx, ann, makeEnv({ dotRadius: 9 }));
  const dot = callsOf(ctx, 'arc').find(c => c[3] === 9);
  assert.ok(dot, 'group dot drawn at env.dotRadius');
  assert.ok(setsOf(ctx, 'fillStyle').includes('#e85447'));

  const off = makeCtx();
  draw.drawAnnotationsCore(off, emptyAnn(), makeEnv({}));
  assert.strictEqual(callsOf(off, 'arc').length, 0);
});

test('core: counter ring stroked (hollow) vs filled (solid); outline only when > 0', () => {
  const ringState = makeState({ counterSettings: { size: 22, opacity: 1, showRings: true, numberSize: 10, ringSize: 100, ringOpacity: 1, ringSolid: false, outlineSize: 0 } });
  const draw = createCanvasDraw(makeDeps(ringState));
  const ann = emptyAnn();
  ann.counterMarkers = { c1: [{ x: 5, y: 5 }] };

  const hollow = makeCtx();
  draw.drawAnnotationsCore(hollow, ann, makeEnv({}));
  const strokes = callsOf(hollow, 'stroke').filter(c => c[1] instanceof global.Path2D);
  assert.strictEqual(strokes.length, 1); // the hollow ring, no outline
  assert.ok(strokes[0][1].d === RING_PATH);

  const outlined = makeCtx();
  draw.drawAnnotationsCore(outlined, ann, makeEnv({ counterOutline: 2 }));
  const strokes2 = callsOf(outlined, 'stroke').filter(c => c[1] instanceof global.Path2D);
  assert.strictEqual(strokes2.length, 2); // ring + icon outline
});

test('core: paint order is quickLines -> polylines -> highlights -> zones -> rooms -> notes -> counters', () => {
  const state = makeState();
  const draw = createCanvasDraw(makeDeps(state));
  const ann = emptyAnn();
  ann.quickLines = [{ id: 'q', x1: 0, y1: 0, x2: 9, y2: 0, lineTypeId: 'lt-straight' }];
  ann.polylines = [{ id: 'p', points: [{ x: 0, y: 0 }, { x: 9, y: 9 }] }];
  ann.highlights = [{ x1: 0, y1: 0, x2: 9, y2: 9 }];
  ann.multiplyZones = [{ x1: 0, y1: 0, x2: 99, y2: 99, multiplier: 2 }];
  ann.scaleZones = [{ x1: 0, y1: 0, x2: 99, y2: 99, scale: { label: 'z' } }];
  ann.roomBoxes = [{ x1: 0, y1: 0, x2: 99, y2: 99, roomId: 'r1' }];
  ann.notes = [{ text: 'n', x: 0, y: 0 }];
  ann.counterMarkers = { c1: [{ x: 1, y: 1 }] };

  const ctx = makeCtx();
  draw.drawAnnotationsCore(ctx, ann, makeEnv({}));
  const strokeStyles = setsOf(ctx, 'strokeStyle');
  const iMultiply = strokeStyles.indexOf('#47c88e');
  const iScaleZone = strokeStyles.indexOf('#c9a227');
  const iRoom = strokeStyles.indexOf('#8e6fd8');
  assert.ok(iMultiply >= 0 && iScaleZone > iMultiply && iRoom > iScaleZone, 'zone/room stroke order holds');
  const fills = callsOf(ctx, 'fillText').map(c => c[1]);
  assert.ok(fills.indexOf('n') < fills.indexOf('1') || !fills.includes('1'), 'notes before counter numbers');
  const translates = callsOf(ctx, 'translate');
  assert.ok(translates.length > 0, 'counter icon transform ran');
});

// --- scale zone label settings (scaleZoneSettings) -------------------------

test('scale zone label: default sits top-left inside the zone (not center)', () => {
  const state = makeState(); // no scaleZoneSettings -> built-in defaults
  const draw = createCanvasDraw(makeDeps(state));
  const ann = emptyAnn();
  ann.scaleZones = [{ x1: 0, y1: 0, x2: 99, y2: 99, scale: { label: 'z' } }];
  const ctx = makeCtx();
  draw.drawAnnotationsCore(ctx, ann, makeEnv({}));
  const label = callsOf(ctx, 'fillText').find(c => c[1] === 'z');
  assert.ok(label, 'label drawn');
  assert.deepStrictEqual([label[2], label[3]], [6, 6], 'anchored at the top-left inset, not zone center');
  assert.ok(setsOf(ctx, 'textAlign').includes('left'));
  assert.ok(setsOf(ctx, 'textBaseline').includes('top'));
});

test('scale zone label: showLabelOnZone false hides it, zone chrome still drawn', () => {
  const state = makeState({ scaleZoneSettings: { showLabelOnZone: false, labelSize: 14, labelPosition: 'top-left' } });
  const draw = createCanvasDraw(makeDeps(state));
  const ann = emptyAnn();
  ann.scaleZones = [{ x1: 0, y1: 0, x2: 99, y2: 99, scale: { label: 'z' } }];
  const ctx = makeCtx();
  draw.drawAnnotationsCore(ctx, ann, makeEnv({}));
  assert.ok(!callsOf(ctx, 'fillText').some(c => c[1] === 'z'), 'label suppressed');
  assert.ok(setsOf(ctx, 'strokeStyle').includes('#c9a227'), 'zone outline still drawn');
});

test('scale zone label: labelSize and labelPosition are honored', () => {
  const state = makeState({ scaleZoneSettings: { showLabelOnZone: true, labelSize: 20, labelPosition: 'bottom-right' } });
  const draw = createCanvasDraw(makeDeps(state));
  const ann = emptyAnn();
  ann.scaleZones = [{ x1: 0, y1: 0, x2: 99, y2: 99, scale: { label: 'z' } }];
  const ctx = makeCtx();
  draw.drawAnnotationsCore(ctx, ann, makeEnv({}));
  assert.ok(setsOf(ctx, 'font').includes('20px DM Sans'), 'labelSize flows into the font');
  const label = callsOf(ctx, 'fillText').find(c => c[1] === 'z');
  assert.deepStrictEqual([label[2], label[3]], [93, 93], 'anchored at the bottom-right inset');
  assert.ok(setsOf(ctx, 'textAlign').includes('right'));
  assert.ok(setsOf(ctx, 'textBaseline').includes('bottom'));
});

test('multiply zone label placement is unchanged by the shared layout helper', () => {
  const state = makeState(); // multiply default: center
  const draw = createCanvasDraw(makeDeps(state));
  const ann = emptyAnn();
  ann.multiplyZones = [{ x1: 0, y1: 0, x2: 99, y2: 99, multiplier: 3 }];
  const ctx = makeCtx();
  draw.drawAnnotationsCore(ctx, ann, makeEnv({}));
  const label = callsOf(ctx, 'fillText').find(c => c[1] === '×3');
  assert.ok(label, 'multiplier label drawn');
  assert.deepStrictEqual([label[2], label[3]], [49.5, 49.5], 'still centered');
  assert.ok(setsOf(ctx, 'textAlign').includes('center'));
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
  const draw = createCanvasDraw(legendDeps(state));
  const ctx = makeCtx();
  draw.drawLegend(ctx, makePage(612, 792), 0, legendAnn(), 1, tc1);
  assert.strictEqual(ctx.calls.length, 0);

  const state2 = legendState();
  const draw2 = createCanvasDraw(legendDeps(state2));
  const ctx2 = makeCtx();
  draw2.drawLegend(ctx2, makePage(612, 792), 0, { legend: null }, 1, tc1);
  assert.strictEqual(ctx2.calls.length, 0);
});

test('drawLegend: rows render with multiply-zone counts, feet totals, and room volumes', () => {
  const state = legendState();
  const draw = createCanvasDraw(legendDeps(state));
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
  const draw = createCanvasDraw(legendDeps(state));
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

test('drawLegend: no rows -> "No items" placeholder', () => {
  const state = legendState({ counters: [], lineTypes: [], rooms: [] });
  const draw = createCanvasDraw(legendDeps(state));
  const ctx = makeCtx();
  draw.drawLegend(ctx, makePage(612, 792), 0, { legend: { x: 10, y: 10, w: 80, h: 40 }, counterMarkers: {}, quickLines: [], polylines: [], roomBoxes: [] }, 1, tc1);
  const texts = callsOf(ctx, 'fillText').map(c => c[1]);
  assert.deepStrictEqual(texts, ['No items']);
});

test('drawGrid: gated off without the overlay flag, spacing, or a page scale', () => {
  const mk = (stateOver, depsOver) => {
    const state = makeState(Object.assign({ showGridOverlay: true, gridSettings: { spacing: 1 } }, stateOver));
    const deps = Object.assign(makeDeps(state), { getPageScale: () => ({ pixelsPerUnit: 10, unit: 'ft' }) }, depsOver);
    const ctx = makeCtx();
    createCanvasDraw(deps).drawGrid(ctx, makePage(100, 100), 0, 1, tc1);
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
  createCanvasDraw(deps).drawGrid(ctx, makePage(100, 100), 0, 1, tc1);
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

'use strict';
// Node unit tests for canvas-draw.js — the annotation draw core. A recording
// 2D-context stub (Proxy call log) stands in for CanvasRenderingContext2D, and
// the geometry/icons globals arrive via Object.assign(globalThis, require(...))
// per the line-metrics.test.js pattern. Run with `npm run test:unit`.
const test = require('node:test');
const assert = require('node:assert');

Object.assign(globalThis, require('./geometry.js'));
Object.assign(globalThis, require('./icons.js'));
// duct-model.js globals (runSegmentSpans / formatDuctSize / ductStrokePx /
// ductPlanWidthIn) — the core reads them by bare name for the duct painters.
Object.assign(globalThis, require('./duct-model.js'));
const { makeRectSize, makeRoundSize, runSegmentSpans } = require('./duct-model.js');
const { CIRCLE_PATH, RING_PATH } = require('./icons.js');
global.Path2D = class Path2D { constructor(d) { this.d = d; } };

const { createCanvasDraw, drawDropMarker, drawPerpTick, DUCT_GHOST_ALPHA, DUCT_GHOST_MIN_PX, ductPxPerPdfPt, ductGhostWidthPx, strokeDuctGhostSpans } = require('./canvas-draw.js');

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
    formatDropLabel: (v, u) => (typeof v === 'number' && v > 0 ? v + ' ' + String(u || 'ft') : ''),
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

test('drop-size labels: env.showDropSizes paints a value chip per carried drop, absent otherwise', () => {
  const state = makeState();
  const draw = createCanvasDraw(makeDeps(state));
  const ann = Object.assign(emptyAnn(), {
    quickLines: [{ x1: 0, y1: 0, x2: 100, y2: 0, color: '#4a9eff', id: 'q1', lineTypeId: 'lt-straight', startDrop: 3, startDropUnit: 'ft', endDrop: 0.5, endDropUnit: 'in' }],
    polylines: [{ points: [{ x: 0, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 100 }], color: '#e85447', id: 'p1', lineTypeId: 'lt-straight', endDrop: 10, endDropUnit: 'ft' }],
  });

  // Default env (no showDropSizes): glyphs only, no label text.
  const off = makeCtx();
  draw.drawAnnotationsCore(off, ann, makeEnv());
  assert.ok(!callsOf(off, 'fillText').some(c => /ft|in/.test(String(c[1]))));

  // showDropSizes: one label per drop, in each drop's own stored unit.
  const on = makeCtx();
  draw.drawAnnotationsCore(on, ann, makeEnv({ showDropSizes: true }));
  const texts = callsOf(on, 'fillText').map(c => c[1]);
  assert.ok(texts.includes('3 ft'), 'quick-line start drop labeled: ' + JSON.stringify(texts));
  assert.ok(texts.includes('0.5 in'), 'quick-line end drop labeled in its own unit');
  assert.ok(texts.includes('10 ft'), 'polyline end drop labeled');

  // The quick line's start label sits OUTWARD of the start point (the run goes
  // +x, so the label center must be at negative x, past the marker).
  const startLabel = callsOf(on, 'fillText').find(c => c[1] === '3 ft');
  assert.ok(startLabel[2] < 0, 'start label placed along the outward direction, got x=' + startLabel[2]);
  const endLabel = callsOf(on, 'fillText').find(c => c[1] === '0.5 in');
  assert.ok(endLabel[2] > 100, 'end label placed past the end point, got x=' + endLabel[2]);

  // A formatter that declines (empty string) suppresses the chip entirely.
  const deps = makeDeps(state);
  deps.formatDropLabel = () => '';
  const none = makeCtx();
  createCanvasDraw(deps).drawAnnotationsCore(none, ann, makeEnv({ showDropSizes: true }));
  assert.ok(!callsOf(none, 'fillText').some(c => /ft|in/.test(String(c[1]))));
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

// Canvas 2D cannot resolve CSS custom properties: assigning
// `ctx.strokeStyle = 'var(--red)'` is an invalid color, so the context
// silently KEEPS its previous style — the T2-14 Delete Area rubber band drew
// in whatever leftover color the frame had last set. Guard every canvas-drawing
// source against the pattern recurring (the fix uses the literal hex mirror of
// the styles.css token).
test("no canvas style is assigned a CSS var() — canvas can't resolve them", () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sources = ['app.js', 'canvas-draw.js', 'canvas-legend.js', 'report.js', ...fs.readdirSync(path.join(__dirname, 'features')).filter(f => f.endsWith('.js')).map(f => 'features/' + f)];
  for (const file of sources) {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(!/(?:strokeStyle|fillStyle|shadowColor)\s*=\s*['"`]var\(/.test(src), file + " assigns a canvas style from 'var(' — use the literal hex of the CSS token instead");
  }
});

// Electrical, First-Class S3: conductor tick marks ride the line type.
test('conductor ticks: one hash per conductor at the run midpoint, ground dashed; off per line type', () => {
  Object.assign(globalThis, require('./conductor-model.js'));
  const state = makeState({
    lineTypes: [
      { id: 'lt-emt', name: '3/4" EMT', raceway: { kind: 'EMT', size: '3/4"' }, conductors: [{ n: 3, gauge: '#12', insul: 'THHN', role: 'hot' }, { n: 1, gauge: '#12', insul: 'THHN', role: 'ground' }] },
      { id: 'lt-off', name: 'quiet', conductors: [{ n: 2, gauge: '#12', insul: 'THHN', role: 'hot' }], tickMarks: false },
      { id: 'lt-plain', name: 'plain' },
    ],
  });
  const draw = createCanvasDraw(makeDeps(state));
  const run = (lineTypeId, extra) => {
    const ctx = makeCtx();
    draw.drawAnnotationsCore(ctx, Object.assign(emptyAnn(), { quickLines: [Object.assign({ x1: 0, y1: 0, x2: 100, y2: 0, color: '#8a4bb0', id: 'q', lineTypeId }, extra || {})] }), makeEnv());
    return ctx;
  };
  const plain = run('lt-plain');
  const emt = run('lt-emt');
  // 4 conductors → 4 extra stroke() calls, one dashed for the ground
  assert.strictEqual(callsOf(emt, 'stroke').length - callsOf(plain, 'stroke').length, 4);
  assert.ok(callsOf(emt, 'setLineDash').some(c => Array.isArray(c[1]) && c[1].length === 2), 'ground tick is dashed');
  // the ticks straddle the midpoint (x ≈ 50)
  const xs = callsOf(emt, 'moveTo').slice(1).map(c => c[1]);
  assert.ok(xs.every(x => x > 30 && x < 70), 'ticks near the midpoint: ' + JSON.stringify(xs));
  // tickMarks: false silences a type that has conductors
  assert.strictEqual(callsOf(run('lt-off'), 'stroke').length, callsOf(plain, 'stroke').length);
  // a per-line override wins: 9 hots + 1 ground = 10 ticks
  const over = run('lt-emt', { conductors: [{ n: 9, gauge: '#12', insul: 'THHN', role: 'hot' }, { n: 1, gauge: '#12', insul: 'THHN', role: 'ground' }] });
  assert.strictEqual(callsOf(over, 'stroke').length - callsOf(plain, 'stroke').length, 10);
});

// Electrical, First-Class S4: the homerun arrowhead + circuit tag.
test('homerun: a filled arrowhead at the run end with the circuit tag; per line type or per run', () => {
  Object.assign(globalThis, require('./circuit-model.js'));
  const state = makeState({
    lineTypes: [{ id: 'lt-hr', name: 'Homerun', homerun: true }, { id: 'lt-plain', name: 'plain' }],
    groups: [{ id: 'g1', name: 'Open office', color: '#e85447', panel: 'LP-1', circuit: '7' }],
  });
  const draw = createCanvasDraw(makeDeps(state));
  const run = (lineTypeId, extra) => {
    const ctx = makeCtx();
    draw.drawAnnotationsCore(ctx, Object.assign(emptyAnn(), { quickLines: [Object.assign({ x1: 0, y1: 0, x2: 100, y2: 0, color: '#8a4bb0', id: 'q', lineTypeId, group: 'g1' }, extra || {})] }), makeEnv());
    return ctx;
  };
  const plain = run('lt-plain');
  const hr = run('lt-hr');
  assert.strictEqual(callsOf(hr, 'fill').length - callsOf(plain, 'fill').length, 1, 'one filled arrowhead');
  assert.ok(callsOf(hr, 'fillText').some(c => c[1] === 'LP-1/7'), 'the circuit tag rides the arrow');
  // the tip is the run END
  const tip = callsOf(hr, 'moveTo').find(c => Math.abs(c[1] - 100) < 0.01 && Math.abs(c[2]) < 0.01);
  assert.ok(tip, 'arrow tip at (100,0)');
  // per-run flag on a plain type
  const perRun = run('lt-plain', { homerun: true });
  assert.strictEqual(callsOf(perRun, 'fill').length - callsOf(plain, 'fill').length, 1);
  // no circuit group → arrow, no label
  const noTag = run('lt-hr', { group: null });
  assert.ok(!callsOf(noTag, 'fillText').some(c => c[1] === 'LP-1/7'));
});

// --- D13 true-width ghost ---------------------------------------------------

test('ductPxPerPdfPt measures the mapper (live zoom·DPR, export scale) instead of assuming it', () => {
  assert.strictEqual(ductPxPerPdfPt(tc1), 1);
  assert.strictEqual(ductPxPerPdfPt((p) => ({ x: p.x * 2.5, y: p.y * 2.5 })), 2.5);
  // a rotated mapper still measures the same length
  assert.ok(Math.abs(ductPxPerPdfPt((p) => ({ x: -p.y * 3, y: p.x * 3 })) - 3) < 1e-12);
});

test('ductGhostWidthPx: inches → the scale unit → pdf pts → canvas px through a seeded scale', () => {
  const rect = makeRectSize(24, 12);
  const ftScale = { pixelsPerUnit: 12, unit: 'ft' };   // 1/4" = 1' on a 48 pt/in sheet
  // 24" = 2 ft → 24 pdf pts → ×2 px/pt = 48 px
  assert.ok(Math.abs(ductGhostWidthPx(rect, undefined, ftScale, 2) - 48) < 1e-9);
  assert.ok(Math.abs(ductGhostWidthPx(rect, 'flat', ftScale, 1) - 24) < 1e-9);
  // orientation swap (D12): on edge the smaller side sits in plan → 12" = 1 ft → 12 pt → 24 px
  assert.ok(Math.abs(ductGhostWidthPx(rect, 'edge', ftScale, 2) - 24) < 1e-9);
  // round: d either way
  assert.ok(Math.abs(ductGhostWidthPx(makeRoundSize(10), 'edge', ftScale, 2) - 20) < 1e-9);
  // an inch-unit scale needs no conversion; a metric one converts through geometry.js
  assert.ok(Math.abs(ductGhostWidthPx(rect, 'flat', { pixelsPerUnit: 1.5, unit: 'in' }, 1) - 36) < 1e-9);
  assert.ok(Math.abs(ductGhostWidthPx(rect, 'flat', { pixelsPerUnit: 100, unit: 'm' }, 1) - 24 * 0.0254 * 100) < 1e-9);
  // a missing unit reads as feet (the app's default scale unit)
  assert.ok(Math.abs(ductGhostWidthPx(rect, 'flat', { pixelsPerUnit: 12 }, 1) - 24) < 1e-9);
});

test('ductGhostWidthPx: nothing honest to draw → null (no scale, bad size, the deep zoom-out cutoff)', () => {
  const rect = makeRectSize(24, 12);
  const ftScale = { pixelsPerUnit: 12, unit: 'ft' };
  assert.strictEqual(ductGhostWidthPx(rect, 'flat', null, 2), null);
  assert.strictEqual(ductGhostWidthPx(rect, 'flat', undefined, 2), null);
  assert.strictEqual(ductGhostWidthPx(rect, 'flat', { pixelsPerUnit: 0, unit: 'ft' }, 2), null);
  assert.strictEqual(ductGhostWidthPx({ kind: 'nope' }, 'flat', ftScale, 2), null);
  assert.strictEqual(ductGhostWidthPx(null, 'flat', ftScale, 2), null);
  assert.strictEqual(ductGhostWidthPx(rect, 'flat', ftScale, 0), null);
  // the < DUCT_GHOST_MIN_PX cutoff: 24 pt × 0.05 = 1.2 px → null; exactly 1.5 px still paints
  assert.strictEqual(DUCT_GHOST_MIN_PX, 1.5);
  assert.strictEqual(ductGhostWidthPx(rect, 'flat', ftScale, 0.05), null);
  assert.ok(Math.abs(ductGhostWidthPx(rect, 'flat', ftScale, 1.5 / 24) - 1.5) < 1e-9);
});

// A two-segment supply run: 48×24 for the first leg, stepped to 24×12 at vertex 1.
function ghostRun() {
  return {
    id: 'run-1', name: 'Supply Main', airside: 'supply', pressureClass: '1', linerType: null, linerThicknessIn: 0, systemGroupId: null,
    vertices: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }],
    segments: [{ startVertexIdx: 0, size: makeRectSize(48, 24) }, { startVertexIdx: 1, size: makeRectSize(24, 12) }],
  };
}
const ghostStrokes = (ctx) => setsOf(ctx, 'globalAlpha').filter(a => a === DUCT_GHOST_ALPHA).length;

test('drawAnnotationsCore: the ghost band paints under every run stroke at the real width, stepping per segment', () => {
  const state = makeState({ legendSettings: {} });
  const deps = Object.assign(makeDeps(state), { getEffectiveScaleForLine: () => ({ pixelsPerUnit: 12, unit: 'ft' }) });
  const ctx = makeCtx();
  const ann = Object.assign(emptyAnn(), { ductRuns: [ghostRun()] });
  createCanvasDraw(deps).drawAnnotationsCore(ctx, ann, makeEnv({ tc: (p) => ({ x: p.x * 2, y: p.y * 2 }) }));
  assert.strictEqual(ghostStrokes(ctx), 2, 'one ghost stroke per segment');
  const widths = setsOf(ctx, 'lineWidth');
  // 48" = 4 ft = 48 pt × 2 = 96 px, then 24" → 48 px; the symbolic strokes (10 px / 6 px bands × scale 1) follow
  assert.deepStrictEqual(widths.slice(0, 2), [96, 48]);
  assert.ok(widths.indexOf(96) < widths.indexOf(10), 'ghost paints BEFORE the band stroke');
  assert.ok(widths.includes(10) && widths.includes(6), 'the symbolic strokes still paint');
  assert.ok(setsOf(ctx, 'strokeStyle').includes('#2e86de'));
  assert.ok(setsOf(ctx, 'lineCap').includes('round') && setsOf(ctx, 'lineJoin').includes('round'));
  // the alpha is restored before the stroke pass
  const alphas = setsOf(ctx, 'globalAlpha');
  assert.strictEqual(alphas[alphas.indexOf(DUCT_GHOST_ALPHA) + 1], 1);
});

test('drawAnnotationsCore: on edge the ghost reads the smaller side; the export raster scale widens it like everything else', () => {
  const state = makeState({ legendSettings: {} });
  const deps = Object.assign(makeDeps(state), { getEffectiveScaleForLine: () => ({ pixelsPerUnit: 12, unit: 'ft' }) });
  const run = Object.assign(ghostRun(), { orientation: 'edge' });
  const ctx = makeCtx();
  createCanvasDraw(deps).drawAnnotationsCore(ctx, Object.assign(emptyAnn(), { ductRuns: [run] }), makeEnv({ tc: (p) => ({ x: p.x * 3, y: p.y * 3 }), ductStrokeScale: 3 }));
  // 24" → 24 pt × 3 = 72 px; 12" → 36 px
  assert.deepStrictEqual(setsOf(ctx, 'lineWidth').slice(0, 2), [72, 36]);
});

test('drawAnnotationsCore: no ghost without a scale, under the cutoff, or with legendSettings.showDuctGhost off — and byte-identical call logs', () => {
  const paint = (stateOverrides, scale, tc) => {
    const state = makeState(Object.assign({ legendSettings: {} }, stateOverrides));
    const deps = Object.assign(makeDeps(state), { getEffectiveScaleForLine: () => scale });
    const ctx = makeCtx();
    createCanvasDraw(deps).drawAnnotationsCore(ctx, Object.assign(emptyAnn(), { ductRuns: [ghostRun()] }), makeEnv({ tc: tc || tc1 }));
    return ctx;
  };
  const off = paint({ legendSettings: { showDuctGhost: false } }, { pixelsPerUnit: 12, unit: 'ft' });
  assert.strictEqual(ghostStrokes(off), 0);
  const unscaled = paint({}, null);
  assert.strictEqual(ghostStrokes(unscaled), 0);
  // the toggled-off and unscaled logs are the same paint the run had before D13
  assert.deepStrictEqual(off.calls, unscaled.calls);
  // deep zoom-out: 48 pt × 0.02 = 0.96 px < 1.5 → nothing, and 24 pt × 0.02 either
  const tiny = paint({}, { pixelsPerUnit: 12, unit: 'ft' }, (p) => ({ x: p.x * 0.02, y: p.y * 0.02 }));
  assert.strictEqual(ghostStrokes(tiny), 0);
  // default ON when the key is absent (pre-D13 legendSettings)
  const on = paint({ legendSettings: { showRooms: true } }, { pixelsPerUnit: 12, unit: 'ft' });
  assert.strictEqual(ghostStrokes(on), 2);
});

// R24: the length-label end tick the quick-line and polyline passes share.
test('drawPerpTick: one stroke across the run end, tickLen long, in the given colour and width', () => {
  const ctx = makeCtx();
  drawPerpTick(ctx, (p) => ({ x: p.x * 2, y: p.y * 2 }), { x: 10, y: 5 }, { x: 3, y: 0 }, 8, '#ff0000', 3);
  assert.deepStrictEqual(ctx.calls, [
    ['set:strokeStyle', '#ff0000'], ['set:lineWidth', 3], ['beginPath'],
    ['moveTo', 20, 2], ['lineTo', 20, 18], ['stroke'],
  ]);
});

// R24: the ghost band stroke the committed painter and the live draft share.
test('strokeDuctGhostSpans: one band per span at the real width, alpha back to 1; a span with nothing honest to draw paints nothing', () => {
  const run = ghostRun();
  const spans = runSegmentSpans(run);
  const eff = { pixelsPerUnit: 12, unit: 'ft' };
  const ctx = makeCtx();
  strokeDuctGhostSpans(ctx, run.vertices, spans, run.orientation, eff, 2, (p) => ({ x: p.x * 2, y: p.y * 2 }), '#2e86de');
  assert.deepStrictEqual(setsOf(ctx, 'lineWidth'), [96, 48]);
  assert.deepStrictEqual(setsOf(ctx, 'globalAlpha'), [DUCT_GHOST_ALPHA, 1, DUCT_GHOST_ALPHA, 1]);
  assert.deepStrictEqual(callsOf(ctx, 'moveTo'), [['moveTo', 20, 20], ['moveTo', 220, 20]]);
  assert.strictEqual(callsOf(ctx, 'setLineDash').length, 0, 'the committed path never touches the dash');
  const none = makeCtx();
  strokeDuctGhostSpans(none, run.vertices, spans, run.orientation, null, 2, tc1, '#2e86de');
  assert.strictEqual(none.calls.length, 0);
});

// --- planRoomLabels (D24, X4 option D) -----------------------------------------

function roomState(nameFromPlan) {
  return { rooms: [{ id: 'r1', name: 'OPEN OFFICE 204', color: '#47c88e', roomType: 'office', nameFromPlan }], groups: [], counters: [], lineTypes: [] };
}
function roomDeps(state, items, balance) {
  return Object.assign(makeDeps(state), {
    getEffectiveScaleForLine: () => ({ pixelsPerUnit: 12, unit: 'ft' }),
    getPageTextItems: () => items,
    getRoomBalanceForPage: () => balance || [],
  });
}

test('planRoomLabels: an estimator-named multi-box room is labelled once (X4 option A); plan-named rooms get one tag on the largest box', () => {
  const ann = { roomBoxes: [
    { x1: 0, y1: 0, x2: 240, y2: 200, heightFt: 9, roomId: 'r1' },
    { x1: 0, y1: 200, x2: 100, y2: 248, heightFt: 9, roomId: 'r1' },
  ] };
  const once = createCanvasDraw(roomDeps(roomState(false), [])).planRoomLabels(ann, 0);
  assert.deepStrictEqual(once.boxes.map(b => b.mode), ['roomFull', 'namePart']);   // largest box first
  assert.deepStrictEqual(once.boxes.map(b => b.part), ['2 boxes', '2/2']);
  assert.deepStrictEqual(once.tags, []);
  // a single-box estimator-named room keeps today's full label
  const single = createCanvasDraw(roomDeps(roomState(false), [])).planRoomLabels({ roomBoxes: [ann.roomBoxes[0]] }, 0);
  assert.deepStrictEqual(single.boxes.map(b => b.mode), ['full']);
  const items = [{ str: 'OPEN OFFICE 204', x: 60, y: 90, w: 110, h: 14 }];
  const d = createCanvasDraw(roomDeps(roomState(true), items, [{ id: 'r1', under: false }])).planRoomLabels(ann, 0);
  assert.deepStrictEqual(d.boxes.map(b => b.mode), ['none', 'none']);
  assert.strictEqual(d.tags.length, 1);
  assert.strictEqual(d.tags[0].boxIndex, 0);
  // 20x16.67x9 + 8.33x4x9 ≈ 3,000 + 300 ft³; office 1 CFM/ft² over ~366 ft²; balance says ✓.
  assert.match(d.tags[0].text, /^3,3\d\d ft³ · 36\d CFM · ✓$/);
  assert.strictEqual(d.tags[0].collided, false);
});

test('planRoomLabels: the tag takes the first anchor clear of the printed text, corners first', () => {
  const ann = { roomBoxes: [{ x1: 0, y1: 0, x2: 240, y2: 200, heightFt: 9, roomId: 'r1' }] };
  // Text pinned at the NW corner: the tag moves to NE.
  const nw = [{ str: 'OPEN OFFICE 204', x: 2, y: 2, w: 120, h: 14 }];
  assert.strictEqual(createCanvasDraw(roomDeps(roomState(true), nw)).planRoomLabels(ann, 0).tags[0].anchor, 'ne');
  // Text across the whole top edge: NW/NE both blocked → SW.
  const top = [{ str: 'OPEN OFFICE 204', x: 0, y: 0, w: 240, h: 16 }];
  assert.strictEqual(createCanvasDraw(roomDeps(roomState(true), top)).planRoomLabels(ann, 0).tags[0].anchor, 'sw');
  // Text everywhere: nothing clears → NW with collided:true, never nothing.
  const all = [{ str: 'x', x: -10, y: -10, w: 300, h: 300 }];
  const p = createCanvasDraw(roomDeps(roomState(true), all)).planRoomLabels(ann, 0).tags[0];
  assert.strictEqual(p.anchor, 'nw'); assert.strictEqual(p.collided, true);
});

test('planRoomLabels: a plan-named room with no text items available falls back to name-only (option B)', () => {
  const ann = { roomBoxes: [{ x1: 0, y1: 0, x2: 240, y2: 200, heightFt: 9, roomId: 'r1' }] };
  const d = createCanvasDraw(roomDeps(roomState(true), [])).planRoomLabels(ann, 0);
  assert.deepStrictEqual(d.boxes.map(b => b.mode), ['nameOnly']);
  assert.deepStrictEqual(d.tags, []);
});

// R24: the legend and the grid live in canvas-legend.js (canvas-legend.test.js
// holds their tests); createCanvasDraw composes createCanvasLegend over the same
// deps and re-exports its keys, so app.js's canvasDraw.* reads paint the same.
test('createCanvasDraw composes canvas-legend.js: the same legend keys, the same paint', () => {
  const { createCanvasLegend } = require('./canvas-legend.js');
  const state = makeState({
    showLegendOverlay: true,
    legendSettings: { legendScale: 1, bgColor: '#ffffff', bgOpacity: 1, textOpacity: 1, showBorder: true },
    showGridOverlay: true,
    gridSettings: { spacing: 1, lineStyle: 'dashed', majorInterval: 2 },
  });
  const deps = Object.assign(makeDeps(state), {
    getPageScale: () => ({ pixelsPerUnit: 10, unit: 'ft' }),
    getLineLengthSplitForTotals: () => ({ feet: 12, px: 0 }),
  });
  const draw = createCanvasDraw(deps);
  const legend = createCanvasLegend(deps);
  assert.deepStrictEqual(Object.keys(draw), ['drawRoomBoxesToContext', 'drawAnnotationsCore', 'drawGhosts', 'drawLegend', 'legendHasRows', 'planRoomLabels', 'resolveLegendStyle', 'legendSheetFactor', 'computeLegendRows', 'drawGrid']);
  const page = { pdfPage: { getViewport: () => ({ width: 612, height: 792 }) }, rotation: 0 };
  const ann = () => ({ legend: { x: 20, y: 20, w: 100, h: 60 }, counterMarkers: { c1: [{ x: 10, y: 10 }] }, quickLines: [{ x1: 0, y1: 0, x2: 120, y2: 0, lineTypeId: 'lt-straight' }], polylines: [], roomBoxes: [] });
  const a = makeCtx(), b = makeCtx();
  draw.drawLegend(a, page, 0, ann(), 1, tc1);
  legend.drawLegend(b, page, 0, ann(), 1, tc1);
  assert.ok(a.calls.length > 0);
  assert.deepStrictEqual(a.calls, b.calls);
  assert.strictEqual(draw.legendHasRows(ann(), 0), true);
  assert.deepStrictEqual(draw.computeLegendRows(ann(), 0), legend.computeLegendRows(ann(), 0));
  assert.strictEqual(draw.resolveLegendStyle({ trade: 'hvac', legendSettings: {} }), 'compact');
  assert.strictEqual(draw.legendSheetFactor(2448, 1584), 2);
  const g1 = makeCtx(), g2 = makeCtx();
  draw.drawGrid(g1, page, 0, 1, tc1);
  legend.drawGrid(g2, page, 0, 1, tc1);
  assert.ok(g1.calls.length > 0);
  assert.deepStrictEqual(g1.calls, g2.calls);
});

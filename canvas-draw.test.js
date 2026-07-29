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

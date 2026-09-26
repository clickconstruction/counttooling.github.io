// Node unit tests for status-hint-model.js — the status bar's tool hint as a pure model
// (MAP-HINTS, 2026-09-26). npm run test:unit.
const test = require('node:test');
const assert = require('node:assert');
const m = require('./status-hint-model.js');
const { TOOL, SCALE_MODES } = require('./constants.js');

const enums = { TOOL, SCALE_MODES };
const hint = (s, press, readouts) => m.toolHintFor(s, press || 'Click', readouts || {}, enums);
// A hint with no live readout measures as itself.
const plain = (s, text, press) => {
  const h = hint(s, press);
  assert.deepStrictEqual(h, { text, keyed: text }, JSON.stringify(s));
};

test('every TOOL has its hint (or none), and a plain hint is keyed as itself', () => {
  const A = SCALE_MODES.POINT_A, B = SCALE_MODES.POINT_B;
  plain({ tool: TOOL.MEASURE, scaleMode: A }, 'Click first point (or hold to aim)');
  plain({ tool: TOOL.MEASURE, scaleMode: B }, 'Click second point (or hold to aim)');
  plain({ tool: TOOL.MEASURE, scaleMode: A, aiming: true }, 'Hold + drag to aim; release to place');
  plain({ tool: TOOL.SCALE, scaleMode: A }, 'Click first point');
  plain({ tool: TOOL.SCALE, scaleMode: B }, 'Click second point');
  plain({ tool: TOOL.LINE }, 'Click start point');
  plain({ tool: TOOL.LINE, quickLineStart: { x: 0, y: 0 } }, 'Click end point');
  plain({ tool: TOOL.POLYLINE }, 'Click to add points');
  plain({ tool: TOOL.DUCT }, 'Click to trace duct · S = size');
  const rects = [
    [TOOL.HIGHLIGHT, 'highlightStart'], [TOOL.MULTIPLY_ZONE, 'multiplyZoneStart'],
    [TOOL.SCALE_ZONE, 'scaleZoneStart'], [TOOL.ROOM, 'roomBoxStart'], [TOOL.DELETE_ZONE, 'deleteZoneStart'],
  ];
  for (const [tool, key] of rects) {
    plain({ tool }, 'Click first corner');
    plain({ tool, [key]: { x: 1, y: 1 } }, 'Click second corner');
  }
  plain({ tool: TOOL.NOTE }, 'Click to add note');
  plain({ tool: TOOL.COUNTER }, 'Click to place marker');
  plain({ tool: TOOL.SCHEDULE }, 'Click one corner of the fixture schedule');
  plain({ tool: TOOL.SCHEDULE, scheduleBoxStart: { x: 1, y: 1 } }, 'Click the schedule\'s far corner');
  plain({ tool: TOOL.CHAIN, currentPage: 0 }, 'Click first device');
  plain({ tool: TOOL.CHAIN, currentPage: 0, chainStart: { page: 0 } }, 'Click next device (Enter ends)');
  // A chain started on another sheet: the next tap is a first device here.
  plain({ tool: TOOL.CHAIN, currentPage: 1, chainStart: { page: 0 } }, 'Click first device');
  plain({ tool: TOOL.EDIT_POLY }, 'Edit polyline · drag a vertex · right-click a vertex');
  for (const tool of [TOOL.NONE, TOOL.GHOST, TOOL.DROP, undefined]) {
    assert.deepStrictEqual(hint({ tool }), { text: '', keyed: '' }, 'tool ' + tool);
  }
  // Every TOOL value was asked above; a new TOOL fails here until it is decided.
  const asked = new Set([TOOL.MEASURE, TOOL.SCALE, TOOL.LINE, TOOL.POLYLINE, TOOL.DUCT, ...rects.map((r) => r[0]),
    TOOL.NOTE, TOOL.COUNTER, TOOL.SCHEDULE, TOOL.CHAIN, TOOL.EDIT_POLY, TOOL.NONE, TOOL.GHOST, TOOL.DROP]);
  assert.deepStrictEqual(Object.values(TOOL).filter((t) => !asked.has(t)), []);
});

test('press is the device word: Tap to a finger, Click to a mouse, Click by default', () => {
  plain({ tool: TOOL.LINE }, 'Tap start point', 'Tap');
  plain({ tool: TOOL.MEASURE, scaleMode: SCALE_MODES.POINT_A }, 'Tap first point (or hold to aim)', 'Tap');
  plain({ tool: TOOL.ROOM }, 'Tap first corner', 'Tap');
  assert.strictEqual(m.toolHintFor({ tool: TOOL.NOTE }, '', {}, enums).text, 'Click to add note');
  // Edit polyline and aiming name no press at all.
  plain({ tool: TOOL.EDIT_POLY }, 'Edit polyline · drag a vertex · right-click a vertex', 'Tap');
});

test('a live readout rides the text; keyed carries the fixed worst-case placeholder instead', () => {
  const cases = [
    [{ tool: TOOL.LINE, quickLineStart: { x: 0, y: 0 } }, 'draw', '10\'-0"', 'Click end point', m.HINT_READOUT_PLACEHOLDER],
    [{ tool: TOOL.POLYLINE }, 'draw', '20\'-0"', 'Click to add points', m.HINT_READOUT_PLACEHOLDER],
    [{ tool: TOOL.DUCT }, 'duct', '24×12 · 38\'-6" · 267 lb · run 1,196 lb', 'Click to trace duct · S = size', m.DUCT_READOUT_PLACEHOLDER],
    [{ tool: TOOL.COUNTER }, 'tag', 'Plan says B → Type B', 'Click to place marker', m.TAG_READOUT_PLACEHOLDER],
    [{ tool: TOOL.CHAIN, currentPage: 0, chainStart: { page: 0 } }, 'chain', '+9.5 ft drop at Duplex Receptacle', 'Click next device (Enter ends)', m.CHAIN_READOUT_PLACEHOLDER],
  ];
  for (const [s, key, live, text, ph] of cases) {
    const h = hint(s, 'Click', { [key]: live });
    assert.strictEqual(h.text, text + ': ' + live);
    assert.strictEqual(h.keyed, text + ': ' + ph);
    // Two different live numbers measure the same: the fit verdict cannot flicker.
    assert.strictEqual(hint(s, 'Click', { [key]: live + '1' }).keyed, h.keyed);
    // An empty readout is no readout.
    assert.deepStrictEqual(hint(s, 'Click', { [key]: '' }), { text, keyed: text });
  }
});

test('readouts are read only for the tool that shows them, and may be readers', () => {
  const calls = [];
  const reader = (k, v) => () => { calls.push(k); return v; };
  const readouts = { draw: reader('draw', '5\'-0"'), duct: reader('duct', 'x'), tag: reader('tag', 'y'), chain: reader('chain', 'z') };
  assert.strictEqual(hint({ tool: TOOL.LINE }, 'Click', readouts).text, 'Click start point: 5\'-0"');
  assert.deepStrictEqual(calls, ['draw']);
  calls.length = 0;
  hint({ tool: TOOL.NOTE }, 'Click', readouts);
  hint({ tool: TOOL.NONE }, 'Click', readouts);
  assert.deepStrictEqual(calls, []);
  // A duct readout never leaks onto the Line hint, and missing readouts are fine.
  assert.strictEqual(hint({ tool: TOOL.LINE }, 'Click', { duct: 'x' }).text, 'Click start point');
  assert.strictEqual(m.toolHintFor({ tool: TOOL.DUCT }, 'Click', null, enums).text, 'Click to trace duct · S = size');
});

test('joinStatusMode: the signed-in bar (empty base) shows the hint alone, never a leading bar', () => {
  assert.strictEqual(m.joinStatusMode('', 'Click start point'), 'Click start point');
  assert.strictEqual(m.joinStatusMode('plan · Saved · 4:42 PM', 'Click start point'), 'plan · Saved · 4:42 PM | Click start point');
  assert.strictEqual(m.joinStatusMode('Viewing, Available (check out to edit)', ''), 'Viewing, Available (check out to edit)');
  assert.strictEqual(m.joinStatusMode('', ''), '');
  assert.strictEqual(m.joinStatusMode(undefined, ''), '');
  // Composed the way the bar composes it: signed in, a draw in progress reads the number.
  const h = hint({ tool: TOOL.LINE, quickLineStart: { x: 0, y: 0 } }, 'Click', { draw: '10\'-0"' });
  assert.strictEqual(m.joinStatusMode('', h.text), 'Click end point: 10\'-0"');
});

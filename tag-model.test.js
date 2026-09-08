// Node unit tests for tag-model.js — the pure text-layer reading model behind
// "Read the tags" (Electrical, First-Class S6). npm run test:unit.
const test = require('node:test');
const assert = require('node:assert');
const tm = require('./tag-model.js');

test('isTagToken: fixture tags yes, words / room numbers no', () => {
  ['A', 'B', 'EM', 'X', 'A1', 'B12', 'WP', 'GFI', 'EX2'].forEach((t) => assert.strictEqual(tm.isTagToken(t), true, t));
  ['104', 'OFFICE', 'THE', 'TYP', 'a', 'A123', '', ' ', 'ABCD'].forEach((t) => assert.strictEqual(tm.isTagToken(t), false, t));
});

test('tagOfCounter: explicit tag, bare letter, "Type B", "Fixture Type EM — …"', () => {
  assert.strictEqual(tm.tagOfCounter({ name: 'Anything', tag: 'b' }), 'B');
  assert.strictEqual(tm.tagOfCounter({ name: 'B' }), 'B');
  assert.strictEqual(tm.tagOfCounter({ name: 'Type B' }), 'B');
  assert.strictEqual(tm.tagOfCounter({ name: 'Fixture Type EM — emergency' }), 'EM');
  assert.strictEqual(tm.tagOfCounter({ name: 'A1 - 2x4 troffer' }), 'A1');
  assert.strictEqual(tm.tagOfCounter({ name: 'Duplex Receptacle' }), null);
  assert.strictEqual(tm.tagOfCounter({ name: 'Water Closet' }), null);
  assert.strictEqual(tm.tagOfCounter(null), null);
});

test('nearestTag: the closest tag token within the radius, by box center', () => {
  const items = [
    { str: 'A', x: 100, y: 100, w: 6, h: 8 },
    { str: 'B', x: 130, y: 100, w: 6, h: 8 },
    { str: 'OFFICE', x: 110, y: 100, w: 40, h: 8 },
    { str: '104', x: 112, y: 110, w: 20, h: 8 },
  ];
  assert.strictEqual(tm.nearestTag(items, { x: 128, y: 104 }, 40).str, 'B');
  assert.strictEqual(tm.nearestTag(items, { x: 104, y: 104 }, 40).str, 'A');
  assert.strictEqual(tm.nearestTag(items, { x: 500, y: 500 }, 40), null);
  assert.strictEqual(tm.nearestTag([], { x: 0, y: 0 }), null);
});

test('rowsInBox + parseScheduleRows: a fixture schedule becomes tag + description rows', () => {
  const items = [
    { str: 'TYPE', x: 10, y: 10, w: 20, h: 8 }, { str: 'DESCRIPTION', x: 40, y: 10, w: 60, h: 8 },
    { str: 'A', x: 10, y: 22, w: 6, h: 8 }, { str: '2x4 LED troffer,', x: 40, y: 22, w: 60, h: 8 }, { str: '4000K', x: 105, y: 22, w: 20, h: 8 },
    { str: 'B', x: 10, y: 34, w: 6, h: 8 }, { str: '2x2 LED troffer', x: 40, y: 34, w: 60, h: 8 },
    { str: 'EM', x: 10, y: 46, w: 10, h: 8 }, { str: 'Emergency wall pack', x: 40, y: 46, w: 60, h: 8 },
    { str: 'X', x: 10, y: 58, w: 6, h: 8 }, { str: 'Exit sign', x: 40, y: 58, w: 40, h: 8 },
    { str: 'NOTES:', x: 10, y: 80, w: 30, h: 8 }, { str: '1.', x: 10, y: 92, w: 8, h: 8 }, { str: 'Verify voltage', x: 40, y: 92, w: 60, h: 8 },
    { str: 'Z', x: 300, y: 22, w: 6, h: 8 }, { str: 'outside the box', x: 320, y: 22, w: 60, h: 8 },
  ];
  const rows = tm.rowsInBox(items, { x1: 0, y1: 0, x2: 200, y2: 100 });
  assert.strictEqual(rows.length, 7);
  assert.strictEqual(rows[1].text, 'A 2x4 LED troffer, 4000K');
  assert.deepStrictEqual(tm.parseScheduleRows(rows), [
    { tag: 'A', description: '2x4 LED troffer, 4000K' },
    { tag: 'B', description: '2x2 LED troffer' },
    { tag: 'EM', description: 'Emergency wall pack' },
    { tag: 'X', description: 'Exit sign' },
  ]);
  // a repeated tag keeps its first description
  assert.strictEqual(tm.parseScheduleRows([{ tokens: ['A', 'first', 'thing'] }, { tokens: ['A', 'second', 'thing'] }]).length, 1);
});

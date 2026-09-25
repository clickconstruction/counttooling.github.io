// Node unit tests for tag-model.js — the pure text-layer reading model behind
// "Read the tags" (Electrical, First-Class S6). npm run test:unit.
const test = require('node:test');
const assert = require('node:assert');
const tm = require('./tag-model.js');

test('isTagToken: fixture tags yes, words / room numbers no', () => {
  ['A', 'B', 'EM', 'X', 'A1', 'B12', 'WP', 'GFI', 'EX2', 'WC-1', '3CS-1', 'FD1', 'HS-12'].forEach((t) => assert.strictEqual(tm.isTagToken(t), true, t));
  ['104', 'OFFICE', 'THE', 'TYP', 'a', 'A123', '', ' ', 'ABCD', 'A-', 'WC-123', '33CS'].forEach((t) => assert.strictEqual(tm.isTagToken(t), false, t));
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

test('nearestTag: among candidates in reach, the tag on the click\'s line wins over a nearer one above it (E-201 by hand, 2026-09-24)', () => {
  // the click at the center of a 2x4 troffer: its B 22 pt to the right; the emergency light 12 pt
  // above has its EM 18 pt away, up and to the right (box centers relative to the click)
  const at = (str, dx, dy) => ({ str, x: 100 + dx - 2, y: 100 + dy - 3, w: 4, h: 6 });
  const items = [at('B', 22.3, -0.6), at('EM', 13.2, -12.6), at('KITCHEN', 0, 10)];
  assert.strictEqual(tm.nearestTag(items, { x: 100, y: 100 }, 24).str, 'B');
  assert.strictEqual(tm.nearestTag(items, { x: 100, y: 97 }, 24).str, 'B');      // three points high, still the troffer's
  assert.strictEqual(tm.nearestTag(items, { x: 113, y: 88 }, 24).str, 'EM');     // on the emergency light itself
  assert.ok(Math.abs(tm.nearestTag(items, { x: 100, y: 100 }, 24).dist - 22.3) < 0.1);   // dist stays the true distance
  assert.strictEqual(tm.nearestTag([at('B', 22.3, -0.6)], { x: 100, y: 100 }, 18), null);   // out of reach is still out of reach
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
  // the description stops where the size columns begin
  assert.deepStrictEqual(tm.parseScheduleRows([{ tokens: ['WC-1', 'WATER', 'CLOSET,', 'FLOOR', 'MTD', '1"', '-', '4"', '2"', '10', '4'] }, { tokens: ['FS-1', 'FLOOR', 'SINK,', '1/2', 'GRATE', '-', '-', '3"'] }]), [
    { tag: 'WC-1', description: 'WATER CLOSET, FLOOR MTD' },
    { tag: 'FS-1', description: 'FLOOR SINK, 1/2 GRATE' },
  ]);
  assert.deepStrictEqual(tm.parseScheduleRows([{ tokens: ['A', 'PENDANT,', 'LED', 'LED', '18W', '120', '18', 'SURFACE'] }]), [{ tag: 'A', description: 'PENDANT, LED LED 18W' }]);
  // a repeated tag keeps its first description
  assert.strictEqual(tm.parseScheduleRows([{ tokens: ['A', 'first', 'thing'] }, { tokens: ['A', 'second', 'thing'] }]).length, 1);
});

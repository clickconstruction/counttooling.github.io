// Node unit tests for the pure line-length / scale helpers in line-metrics.js.
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
//
// line-metrics.js references the geometry.js helpers (ptDist, polylineDistance,
// the bezier helpers, getScaleZoneForLine, getMultiplyZoneForLine) by bare name
// (geometry.js globals in the browser), so we copy geometry.js onto the global
// object BEFORE requiring line-metrics.js. Assertions reference geometry via the
// `geom` handle to keep the test's own lint group free of those globals.
const test = require('node:test');
const assert = require('node:assert');
const geom = require('./geometry.js');
Object.assign(globalThis, geom);
const lm = require('./line-metrics.js');

test('lineSegmentLength: straight chord length (no/!arc line type)', () => {
  const seg = { x1: 0, y1: 0, x2: 3, y2: 4 };
  assert.strictEqual(lm.lineSegmentLength(seg, null), 5);
  assert.strictEqual(lm.lineSegmentLength(seg, { curveStyle: 'straight' }), 5);
});

test('lineSegmentLength: arc line type routes to the bezier path (differs from chord)', () => {
  const seg = { x1: 0, y1: 0, x2: 10, y2: 0 };
  const chord = lm.lineSegmentLength(seg, null);
  const arc = lm.lineSegmentLength(seg, { curveStyle: 'arc' });
  assert.strictEqual(chord, 10);
  assert.ok(Number.isFinite(arc));
  assert.notStrictEqual(arc, chord, 'arc curveStyle should take the bezier branch, not the straight chord');
});

test('lineGeomPdfPts: polyline sums its segments; single delegates to the chord', () => {
  const poly = { points: [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }], closed: false };
  assert.strictEqual(lm.lineGeomPdfPts(poly, true, null), 7);
  assert.strictEqual(lm.lineGeomPdfPts({ x1: 0, y1: 0, x2: 6, y2: 8 }, false, null), 10);
});

test('lineLengthPdfPts: adds drop length (drops * pixelsPerUnit) only when scaled', () => {
  const line = { x1: 0, y1: 0, x2: 10, y2: 0, startDrop: 2, endDrop: 3 };
  const scale = { pixelsPerUnit: 10, unit: 'ft' };
  // base 10 + (2 + 3) * 10 = 60
  assert.strictEqual(lm.lineLengthPdfPts(line, false, scale, null), 60);
  // no scale -> drops can't be converted, returns base geometry only
  assert.strictEqual(lm.lineLengthPdfPts(line, false, null, null), 10);
});

test('lineLengthPdfPts: drop units convert to the scale unit; missing unit = legacy', () => {
  const scale = { pixelsPerUnit: 10, unit: 'ft' };
  // 8 in start drop on a ft-scaled page -> 8 in = 0.6667 ft -> base 10 + 0.6667*10
  const inLine = { x1: 0, y1: 0, x2: 10, y2: 0, startDrop: 8, startDropUnit: 'in' };
  assert.ok(Math.abs(lm.lineLengthPdfPts(inLine, false, scale, null) - (10 + (8 * 0.0254 / 0.3048) * 10)) < 1e-6);
  // explicit ft unit == legacy (no *Unit) == bare scale unit
  const ftLine = { x1: 0, y1: 0, x2: 10, y2: 0, startDrop: 2, startDropUnit: 'ft' };
  const legacy = { x1: 0, y1: 0, x2: 10, y2: 0, startDrop: 2 };
  assert.strictEqual(lm.lineLengthPdfPts(ftLine, false, scale, null), 30);
  assert.strictEqual(lm.lineLengthPdfPts(legacy, false, scale, null), 30);
  // start + end in different units (1 yd start + 12 in end on ft scale = 3 + 1 = 4 ft)
  const mixed = { x1: 0, y1: 0, x2: 10, y2: 0, startDrop: 1, startDropUnit: 'yd', endDrop: 12, endDropUnit: 'in' };
  assert.ok(Math.abs(lm.lineLengthPdfPts(mixed, false, scale, null) - (10 + 4 * 10)) < 1e-6);
});

test('effectiveScaleForLine: scale-zone override wins, else the injected page scale', () => {
  const pageScale = { pixelsPerUnit: 2, unit: 'ft' };
  const zoneScale = { pixelsPerUnit: 5, unit: 'in' };
  const annWithZone = { scaleZones: [{ x1: 0, y1: 0, x2: 100, y2: 100, scale: zoneScale }] };
  const inside = { x1: 10, y1: 10, x2: 20, y2: 20 };
  assert.strictEqual(lm.effectiveScaleForLine(annWithZone, inside, false, pageScale), zoneScale);
  assert.strictEqual(lm.effectiveScaleForLine({}, inside, false, pageScale), pageScale);
});

test('lineRealWorldLength: pdf-points / pixelsPerUnit, plus raw drop length', () => {
  const line = { x1: 0, y1: 0, x2: 10, y2: 0 };
  const scale = { pixelsPerUnit: 2 };
  assert.strictEqual(lm.lineRealWorldLength(line, false, {}, scale, null), 5);
  const withDrop = { x1: 0, y1: 0, x2: 10, y2: 0, startDrop: 1 };
  assert.strictEqual(lm.lineRealWorldLength(withDrop, false, {}, scale, null), 6);
  // no usable scale -> falls back to raw pdf points
  assert.strictEqual(lm.lineRealWorldLength(line, false, {}, null, null), 10);
});

test('lineLengthForTotals: scales the real-world length by the multiply-zone factor', () => {
  const line = { x1: 10, y1: 10, x2: 30, y2: 10 };
  const scale = { pixelsPerUnit: 2 };
  const ann = { multiplyZones: [{ x1: 0, y1: 0, x2: 100, y2: 100, multiplier: 3 }] };
  // base 20 -> realWorld 10 -> * 3 = 30
  assert.strictEqual(lm.lineLengthForTotals(line, false, ann, scale, null), 30);
  // no zone -> factor 1
  assert.strictEqual(lm.lineLengthForTotals(line, false, {}, scale, null), 10);
});

test('lineLengthFeetForTotals: converts the total to feet via the line\'s effective unit', () => {
  const closeTo = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ~= ${b}`);
  const line = { x1: 10, y1: 10, x2: 30, y2: 10 };   // base 20 pdf-pts
  // foot scale: realWorld 10 ft -> 10 ft (unchanged)
  assert.strictEqual(lm.lineLengthFeetForTotals(line, false, {}, { pixelsPerUnit: 2, unit: 'ft' }, null), 10);
  // inch scale: realWorld 10 in -> 10/12 ft
  closeTo(lm.lineLengthFeetForTotals(line, false, {}, { pixelsPerUnit: 2, unit: 'in' }, null), 10 / 12);
  // meter scale: realWorld 10 m -> 10 / 0.3048 ft
  closeTo(lm.lineLengthFeetForTotals(line, false, {}, { pixelsPerUnit: 2, unit: 'm' }, null), 10 / 0.3048);
  // multiply-zone factor still applies (then converts, ft): 10 ft * 3 = 30 ft
  const ann = { multiplyZones: [{ x1: 0, y1: 0, x2: 100, y2: 100, multiplier: 3 }] };
  assert.strictEqual(lm.lineLengthFeetForTotals(line, false, ann, { pixelsPerUnit: 2, unit: 'ft' }, null), 30);
  // unscaled -> raw PDF-pts (no unit to convert)
  assert.strictEqual(lm.lineLengthFeetForTotals(line, false, {}, null, null), 20);
});

test('scaleForLineType: prefers ft over other units regardless of page order', () => {
  const pages = [
    { scale: { unit: 'm', pixelsPerUnit: 1 } },
    { scale: { unit: 'ft', pixelsPerUnit: 2 } },
  ];
  assert.strictEqual(lm.scaleForLineType([0, 1], pages).unit, 'ft');
});

test('scaleForLineType: falls back to first scaled page, then null', () => {
  const pages = [{ scale: { unit: 'px', pixelsPerUnit: 3 } }, {}];
  assert.strictEqual(lm.scaleForLineType([0, 1], pages).pixelsPerUnit, 3);
  assert.strictEqual(lm.scaleForLineType([0, 1], [{}, {}]), null);
});

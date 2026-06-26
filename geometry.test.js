// Node unit tests for the pure primitives in geometry.js.
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
const test = require('node:test');
const assert = require('node:assert');
const g = require('./geometry.js');

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ~= ${b}`);

test('ptDist', () => {
  assert.strictEqual(g.ptDist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.strictEqual(g.ptDist({ x: 1, y: 1 }, { x: 1, y: 1 }), 0);
});

test('snapToHorizontalOrVertical', () => {
  // mostly horizontal -> snap y to start
  assert.deepStrictEqual(g.snapToHorizontalOrVertical(0, 0, 10, 2), { x: 10, y: 0 });
  // mostly vertical -> snap x to start
  assert.deepStrictEqual(g.snapToHorizontalOrVertical(0, 0, 2, 10), { x: 0, y: 10 });
});

test('polylineDistance open and closed', () => {
  const pts = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }];
  assert.strictEqual(g.polylineDistance(pts), 20);
  assert.strictEqual(g.polylineDistance(pts, true), 20 + Math.sqrt(200));
  assert.strictEqual(g.polylineDistance(null), 0);
  assert.strictEqual(g.polylineDistance([{ x: 0, y: 0 }]), 0);
});

test('polygonArea', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.strictEqual(g.polygonArea(square), 100);
  // winding direction should not matter (uses abs)
  assert.strictEqual(g.polygonArea(square.slice().reverse()), 100);
});

test('distToSegment', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
  assert.strictEqual(g.distToSegment({ x: 5, y: 3 }, a, b), 3); // perpendicular
  assert.strictEqual(g.distToSegment({ x: -4, y: 0 }, a, b), 4); // beyond start clamps to a
  assert.strictEqual(g.distToSegment({ x: 0, y: 0 }, a, a), 0); // degenerate segment
});

test('quadratic bezier helpers', () => {
  const p0 = { x: 0, y: 0 }, p1 = { x: 5, y: 0 }, p2 = { x: 10, y: 0 };
  // collinear midpoint control -> the curve is the straight line, midpoint at t=0.5 is (5,0)
  assert.deepStrictEqual(g.quadraticBezierPoint(0.5, p0, p1, p2), { x: 5, y: 0 });
  // length is a 20-step polyline approximation (~10; slightly undershoots due to the
  // float t-loop dropping the final step). Lock it as "approximately the chord length".
  close(g.quadraticBezierLength(p0, p1, p2), 10, 0.6);
  // control point is offset perpendicular to the chord
  const ctrl = g.getQuadraticBezierControlPoint(p0, p2, 1);
  assert.strictEqual(ctrl.x, 5);
  close(Math.abs(ctrl.y), 10 * 0.15, 1e-9);
  // distance from a point on the curve is ~0
  assert.ok(g.distToQuadraticBezier({ x: 5, y: 0 }, p0, p1, p2) < 1e-6);
});

test('rotatePoint90CW', () => {
  assert.deepStrictEqual(g.rotatePoint90CW({ x: 2, y: 3 }, 100, 50), { x: 50 - 3, y: 2 });
});

test('pointInRect inside, outside, edge (unordered corners)', () => {
  assert.strictEqual(g.pointInRect({ x: 5, y: 5 }, 0, 0, 10, 10), true);
  assert.strictEqual(g.pointInRect({ x: 50, y: 5 }, 0, 0, 10, 10), false);
  assert.strictEqual(g.pointInRect({ x: 0, y: 0 }, 0, 0, 10, 10), true); // edge inclusive
  assert.strictEqual(g.pointInRect({ x: 5, y: 5 }, 10, 10, 0, 0), true); // corners reversed
});

test('rectsOverlap', () => {
  assert.strictEqual(g.rectsOverlap(0, 0, 10, 10, 5, 5, 15, 15), true);
  assert.strictEqual(g.rectsOverlap(0, 0, 10, 10, 20, 20, 30, 30), false);
  assert.strictEqual(g.rectsOverlap(0, 0, 10, 10, 10, 10, 20, 20), true); // touching corner
});

test('getMultiplyZoneForPoint', () => {
  const ann = { multiplyZones: [{ x1: 0, y1: 0, x2: 10, y2: 10, multiplier: 4 }] };
  assert.strictEqual(g.getMultiplyZoneForPoint(ann, { x: 5, y: 5 }), 4);
  assert.strictEqual(g.getMultiplyZoneForPoint(ann, { x: 50, y: 5 }), 1); // miss -> 1
  assert.strictEqual(g.getMultiplyZoneForPoint({}, { x: 5, y: 5 }), 1); // no zones
});

test('getMultiplyZoneForLine requires both endpoints inside', () => {
  const ann = { multiplyZones: [{ x1: 0, y1: 0, x2: 10, y2: 10, multiplier: 3 }] };
  assert.strictEqual(g.getMultiplyZoneForLine(ann, { x1: 1, y1: 1, x2: 9, y2: 9 }, false), 3);
  assert.strictEqual(g.getMultiplyZoneForLine(ann, { x1: 1, y1: 1, x2: 99, y2: 9 }, false), 1); // one end out
  // polyline form uses first/last point
  assert.strictEqual(g.getMultiplyZoneForLine(ann, { points: [{ x: 2, y: 2 }, { x: 50, y: 50 }, { x: 8, y: 8 }] }, true), 3);
});

test('getScaleZoneForLine gates on a present scale and both endpoints', () => {
  const withScale = { scaleZones: [{ x1: 0, y1: 0, x2: 10, y2: 10, scale: { pixelsPerUnit: 2, unit: 'ft' } }] };
  const noScale = { scaleZones: [{ x1: 0, y1: 0, x2: 10, y2: 10 }] };
  assert.strictEqual(g.getScaleZoneForLine(withScale, { x1: 1, y1: 1, x2: 9, y2: 9 }, false), withScale.scaleZones[0]);
  assert.strictEqual(g.getScaleZoneForLine(noScale, { x1: 1, y1: 1, x2: 9, y2: 9 }, false), null); // no scale on zone
  assert.strictEqual(g.getScaleZoneForLine(withScale, { x1: 1, y1: 1, x2: 99, y2: 9 }, false), null); // one end out
});

test('formatLineLengthRealSum', () => {
  assert.strictEqual(g.formatLineLengthRealSum(12.345, { pixelsPerUnit: 2, unit: 'ft' }), '12.35 ft');
  assert.strictEqual(g.formatLineLengthRealSum(0, null), '0');
  assert.strictEqual(g.formatLineLengthRealSum(7.6, null), '8 px');
});

test('parseRealWorldLength', () => {
  // The first number is always parsed as FEET; `unit` only picks the output units.
  close(g.parseRealWorldLength("3", 'ft'), 3);
  close(g.parseRealWorldLength("3 6", 'ft'), 3 + 6 / 12); // 3 ft 6 in -> 3.5 ft
  assert.strictEqual(g.parseRealWorldLength("18", 'in'), 18 * 12); // 18 ft expressed in inches
  assert.strictEqual(g.parseRealWorldLength("1 6", 'in'), 1 * 12 + 6); // 1 ft 6 in -> 18 in
  close(g.parseRealWorldLength("2.5", 'm'), 2.5); // non ft/in -> plain number
  assert.strictEqual(g.parseRealWorldLength("", 'ft'), null);
  assert.strictEqual(g.parseRealWorldLength("abc", 'm'), null);
});

test('parseFraction', () => {
  assert.strictEqual(g.parseFraction('1/4'), 0.25);
  assert.strictEqual(g.parseFraction('0.5'), 0.5);
  assert.strictEqual(g.parseFraction('1/0'), null); // div by zero
  assert.strictEqual(g.parseFraction('0'), null); // not > 0
  assert.strictEqual(g.parseFraction(''), null);
  assert.strictEqual(g.parseFraction('abc'), null);
});

test('formatAgo ladder boundaries', () => {
  assert.strictEqual(g.formatAgo(0), 'Just now');
  assert.strictEqual(g.formatAgo(59), 'Just now');
  assert.strictEqual(g.formatAgo(60), '1min ago');
  assert.strictEqual(g.formatAgo(3599), '59min ago');
  assert.strictEqual(g.formatAgo(3600), '1hr ago');
  assert.strictEqual(g.formatAgo(86399), '23hr ago');
  assert.strictEqual(g.formatAgo(86400), '1d ago');
  assert.strictEqual(g.formatAgo(2 * 86400), '2d ago');
});

test('formatFeetInchesFromVal', () => {
  // ft: floor feet + rounded inches, with carry at 12"
  assert.strictEqual(g.formatFeetInchesFromVal(5, 'ft'), `5'-0"`);
  assert.strictEqual(g.formatFeetInchesFromVal(5.5, 'ft'), `5'-6"`);
  assert.strictEqual(g.formatFeetInchesFromVal(5.99, 'ft'), `6'-0"`); // 11.88" rounds to 12 -> carry
  // in: < 12 stays inches-only, >= 12 becomes ft-in
  assert.strictEqual(g.formatFeetInchesFromVal(7, 'in'), `7"`);
  assert.strictEqual(g.formatFeetInchesFromVal(18, 'in'), `1'-6"`);
  // yd: value is in yards -> *3 feet
  assert.strictEqual(g.formatFeetInchesFromVal(2, 'yd'), `6'-0"`);
  // other unit: decimal fallback
  assert.strictEqual(g.formatFeetInchesFromVal(2.5, 'm'), '2.50 m');
});

test('formatDist: decimal real-world length + px fallback', () => {
  assert.strictEqual(g.formatDist(100, { pixelsPerUnit: 2, unit: 'ft' }), '50.00 ft');
  assert.strictEqual(g.formatDist(15, { pixelsPerUnit: 3, unit: 'm' }), '5.00 m');
  // no scale -> rounded pixels
  assert.strictEqual(g.formatDist(100.4, null), '100 px');
});

test('formatFeet: already-in-feet value -> decimal feet, with px/0 fallback', () => {
  // value is already feet; a truthy scale just selects the "ft" display
  assert.strictEqual(g.formatFeet(12.5, { pixelsPerUnit: 2, unit: 'ft' }), '12.50 ft');
  assert.strictEqual(g.formatFeet(12.5, { pixelsPerUnit: 5, unit: 'in' }), '12.50 ft');   // unit on the scale is irrelevant
  assert.strictEqual(g.formatFeet(0, { pixelsPerUnit: 2, unit: 'ft' }), '0.00 ft');
  // no scale -> rounded pixels, or '0'
  assert.strictEqual(g.formatFeet(100.4, null), '100 px');
  assert.strictEqual(g.formatFeet(0, null), '0');
});

test('formatArea: ppu^2 division + unit-squared suffix', () => {
  assert.strictEqual(g.formatArea(400, { pixelsPerUnit: 2, unit: 'ft' }), '100.0 ft\u00b2');
  assert.strictEqual(g.formatArea(900, { pixelsPerUnit: 3, unit: 'm' }), '100.0 m\u00b2');
  // no scale -> rounded square pixels
  assert.strictEqual(g.formatArea(49.6, null), '50 px\u00b2');
});

test('formatDistFeetInches: divides by ppu then delegates to formatFeetInchesFromVal', () => {
  assert.strictEqual(g.formatDistFeetInches(120, { pixelsPerUnit: 2, unit: 'ft' }), `60'-0"`);
  assert.strictEqual(g.formatDistFeetInches(11, { pixelsPerUnit: 1, unit: 'in' }), `11"`);
  assert.strictEqual(g.formatDistFeetInches(100, null), '100 px');
});

test('formatDistFeetInchesFromReal: delegates with already-real value', () => {
  assert.strictEqual(g.formatDistFeetInchesFromReal(5.5, { pixelsPerUnit: 2, unit: 'ft' }), `5'-6"`);
  assert.strictEqual(g.formatDistFeetInchesFromReal(18, { pixelsPerUnit: 2, unit: 'in' }), `1'-6"`);
  assert.strictEqual(g.formatDistFeetInchesFromReal(5.5, null), '6 px');
});

test('clampEffectiveDpr: below the cap returns the real dpr unchanged', () => {
  // small page, modest zoom — well under any cap
  assert.strictEqual(g.clampEffectiveDpr({ pageW: 612, pageH: 792, zoom: 1, dpr: 2, maxDim: 8192, maxArea: 16777216 }), 2);
  assert.strictEqual(g.clampEffectiveDpr({ pageW: 612, pageH: 792, zoom: 2, dpr: 1, maxDim: 8192, maxArea: 16777216 }), 1);
});

test('clampEffectiveDpr: dimension-limited -> buffer side pinned at maxDim', () => {
  // wide page * high zoom * dpr would blow past maxDim on the width axis
  const pageW = 2000, pageH = 1000, zoom = 4, dpr = 3, maxDim = 8192, maxArea = 1e12;
  const eff = g.clampEffectiveDpr({ pageW, pageH, zoom, dpr, maxDim, maxArea });
  close(pageW * zoom * eff, maxDim, 1e-6);            // long axis exactly at the cap
  assert.ok(eff < dpr);
});

test('clampEffectiveDpr: area-limited -> buffer area pinned at maxArea', () => {
  // dims individually under maxDim but the product exceeds maxArea
  const pageW = 1500, pageH = 1500, zoom = 3, dpr = 3, maxDim = 100000, maxArea = 16777216;
  const eff = g.clampEffectiveDpr({ pageW, pageH, zoom, dpr, maxDim, maxArea });
  const bw = pageW * zoom * eff, bh = pageH * zoom * eff;
  close(bw * bh, maxArea, 1);
  assert.ok(eff < dpr);
});

test('clampEffectiveDpr: budgeting maxArea shrinks eff by ~sqrt(ratio) when area-limited', () => {
  // The render path budgets the probed area cap down (renderAreaSafety) by passing a
  // reduced maxArea. On an area-limited page this shrinks the buffer side by sqrt(ratio).
  const base = { pageW: 1500, pageH: 1500, zoom: 3, dpr: 3, maxDim: 100000 };
  const effFull = g.clampEffectiveDpr({ ...base, maxArea: 16777216 });
  const effBudgeted = g.clampEffectiveDpr({ ...base, maxArea: 16777216 * 0.5 });
  close(effBudgeted, effFull * Math.sqrt(0.5), 1e-9);
  assert.ok(effBudgeted < effFull);
});

test('clampEffectiveDpr: budgeting maxArea does not change a dimension-limited result', () => {
  // When the dimension is the binding constraint, reducing maxArea (kept non-binding)
  // leaves eff identical — proves area-budgeting only bites when area is the limit.
  const base = { pageW: 2000, pageH: 1000, zoom: 4, dpr: 3, maxDim: 8192 };
  const effFull = g.clampEffectiveDpr({ ...base, maxArea: 1e12 });
  const effBudgeted = g.clampEffectiveDpr({ ...base, maxArea: 1e12 * 0.5 });
  assert.strictEqual(effBudgeted, effFull);
});

test('clampEffectiveDpr: never exceeds the real dpr', () => {
  // tiny page where the caps would "allow" a huge eff — still clamped to dpr
  const eff = g.clampEffectiveDpr({ pageW: 10, pageH: 10, zoom: 1, dpr: 2, maxDim: 8192, maxArea: 16777216 });
  assert.strictEqual(eff, 2);
});

test('clampEffectiveDpr: degenerate inputs floor above 0', () => {
  assert.strictEqual(g.clampEffectiveDpr({ pageW: 0, pageH: 100, zoom: 1, dpr: 2, maxDim: 8192, maxArea: 16777216 }), 2);
  const eff = g.clampEffectiveDpr({ pageW: 1e9, pageH: 1e9, zoom: 1000, dpr: 3, maxDim: 8192, maxArea: 16777216 });
  assert.ok(eff >= 0.01 && eff < 1);
});

test('clampEffectiveDpr: monotonic — more zoom never grows the clamped buffer', () => {
  const base = { pageW: 2000, pageH: 1400, dpr: 3, maxDim: 8192, maxArea: 16777216 };
  let prevBuffer = 0;
  for (const zoom of [0.5, 1, 2, 4, 8, 16]) {
    const eff = g.clampEffectiveDpr({ ...base, zoom });
    const longSide = Math.max(base.pageW, base.pageH) * zoom * eff;
    assert.ok(longSide <= base.maxDim + 1e-6, `zoom ${zoom}: ${longSide} <= ${base.maxDim}`);
    const area = (base.pageW * zoom * eff) * (base.pageH * zoom * eff);
    assert.ok(area <= base.maxArea + 1, `zoom ${zoom}: area ${area} <= ${base.maxArea}`);
    prevBuffer = area;
  }
  assert.ok(prevBuffer > 0);
});

test('convertUnitValue: converts between the Set-Scale units via a metres base', () => {
  close(g.convertUnitValue(1, 'ft', 'in'), 12, 1e-9);
  close(g.convertUnitValue(12, 'in', 'ft'), 1, 1e-9);
  close(g.convertUnitValue(1, 'yd', 'ft'), 3, 1e-9);
  close(g.convertUnitValue(1, 'm', 'cm'), 100, 1e-9);
  close(g.convertUnitValue(8, 'in', 'ft'), 0.6666666666666667, 1e-9);
});

test('convertUnitValue: identical or unknown units are a no-op', () => {
  assert.strictEqual(g.convertUnitValue(5, 'ft', 'ft'), 5);
  assert.strictEqual(g.convertUnitValue(5, 'ft', 'bogus'), 5);
  assert.strictEqual(g.convertUnitValue(5, undefined, 'ft'), 5);
});

test('bakeFramesMatch: same frame matches; swapped dims / changed intrinsic do not', () => {
  const f = { w: 918, h: 594, intrinsic: 0 };
  assert.strictEqual(g.bakeFramesMatch(f, { w: 918, h: 594, intrinsic: 0 }), true);
  // sub-pixel viewport rounding is absorbed by the default ±1 tolerance
  assert.strictEqual(g.bakeFramesMatch(f, { w: 919, h: 593, intrinsic: 0 }), true);
  assert.strictEqual(g.bakeFramesMatch(f, { w: 920, h: 594, intrinsic: 0 }), false); // off by 2
  // dims swapped (page reconstructed at a different rotation) -> mismatch
  assert.strictEqual(g.bakeFramesMatch(f, { w: 594, h: 918, intrinsic: 0 }), false);
  // same dims but the PDF's intrinsic /Rotate differs -> mismatch
  assert.strictEqual(g.bakeFramesMatch(f, { w: 918, h: 594, intrinsic: 90 }), false);
});

test('bakeFramesMatch: a missing frame on either side is treated as a match (no false warning)', () => {
  // pre-stamp projects have no saved frame -> nothing to verify
  assert.strictEqual(g.bakeFramesMatch(null, { w: 918, h: 594, intrinsic: 0 }), true);
  assert.strictEqual(g.bakeFramesMatch({ w: 918, h: 594, intrinsic: 0 }, null), true);
  assert.strictEqual(g.bakeFramesMatch(undefined, undefined), true);
});

// Node unit tests for fitting-model.js (BEND-FITTINGS): the angle read, the
// nearer-of-45-and-90 rule, the defaults a name earns, per-vertex overrides,
// drops as 90s, and the derived rows a line type produces.
const test = require('node:test');
const assert = require('node:assert');
const fm = require('./fitting-model.js');

const P = (x, y, extra) => Object.assign({ x, y }, extra || {});

test('bend angle: straight is 0, a square corner is 90, a mitre is 45, a hairpin is 180', () => {
  assert.strictEqual(Math.round(fm.bendAngleDeg(P(0, 0), P(10, 0), P(20, 0))), 0);
  assert.strictEqual(Math.round(fm.bendAngleDeg(P(0, 0), P(10, 0), P(10, 10))), 90);
  assert.strictEqual(Math.round(fm.bendAngleDeg(P(0, 0), P(10, 0), P(20, 10))), 45);
  assert.strictEqual(Math.round(fm.bendAngleDeg(P(0, 0), P(10, 0), P(0, 0))), 180);
  assert.strictEqual(fm.bendAngleDeg(P(0, 0), P(0, 0), P(5, 5)), 0);   // a zero-length leg reads straight
});

test('the rule: under 22.5° nothing, up to 67.5° a 45, past that a 90 (the nearer of the two)', () => {
  assert.strictEqual(fm.classifyBend(0), null);
  assert.strictEqual(fm.classifyBend(10), null);
  assert.strictEqual(fm.classifyBend(22.5), 'bend45');
  assert.strictEqual(fm.classifyBend(45), 'bend45');
  assert.strictEqual(fm.classifyBend(67.4), 'bend45');
  assert.strictEqual(fm.classifyBend(67.5), 'bend90');
  assert.strictEqual(fm.classifyBend(90), 'bend90');
  assert.strictEqual(fm.classifyBend(135), 'bend90');
  // the duct tool's pair, when a caller wants it
  assert.strictEqual(fm.classifyBend(35, { min45: 30, min90: 60 }), 'bend45');
  assert.strictEqual(fm.classifyBend(61, { min45: 30, min90: 60 }), 'bend90');
});

test('defaults come from the type name; an empty name still yields fittings', () => {
  const d = fm.defaultBendFittings('2in Cu');
  assert.strictEqual(d.enabled, false);
  assert.deepStrictEqual(d.bend45, { name: '2in Cu 45° elbow', qty: 1 });
  assert.deepStrictEqual(d.bend90, { name: '2in Cu 90° elbow', qty: 1 });
  assert.deepStrictEqual(d.drop, { name: '2in Cu 90° elbow', qty: 1 });
  assert.strictEqual(fm.defaultBendFittings('').bend90.name, '90° elbow');
});

test('normalize fills missing rows from the defaults and keeps what the estimator chose', () => {
  const lt = { name: '4in PVC', bendFittings: { enabled: true, bend45: { name: '4in PVC 1/8 bend' }, bend90: { name: '4in PVC 1/4 bend', qty: 1 }, drop: { qty: 2 } } };
  const n = fm.normalizeBendFittings(lt);
  assert.strictEqual(n.enabled, true);
  assert.deepStrictEqual(n.bend45, { name: '4in PVC 1/8 bend', qty: 1 });
  assert.deepStrictEqual(n.bend90, { name: '4in PVC 1/4 bend', qty: 1 });
  assert.deepStrictEqual(n.drop, { name: '4in PVC 90° elbow', qty: 2 });
  assert.strictEqual(fm.normalizeBendFittings({ name: 'x' }).enabled, false);
  assert.strictEqual(fm.bendFittingsEnabled({ name: 'x' }), false);
  assert.strictEqual(fm.bendFittingsEnabled(lt), true);
  // pure: the type is untouched
  assert.strictEqual(lt.bendFittings.drop.name, undefined);
});

test('a run counts its own bends; endpoints are never elbows; a closed run bends at every vertex', () => {
  // right, then down (90), then a 45 out, then a 45 back to horizontal
  const pts = [P(0, 0), P(100, 0), P(100, 100), P(170, 170), P(270, 170)];
  assert.deepStrictEqual(fm.runBendCounts(pts, false), { bend45: 2, bend90: 1 });
  assert.strictEqual(fm.vertexBendClass(pts, 0, false), null);
  assert.strictEqual(fm.vertexBendClass(pts, 4, false), null);
  assert.strictEqual(fm.vertexBendClass(pts, 1, false), 'bend90');
  assert.strictEqual(fm.vertexBendClass(pts, 2, false), 'bend45');
  // a 10° wobble is not a fitting
  assert.deepStrictEqual(fm.runBendCounts([P(0, 0), P(100, 0), P(200, 17)], false), { bend45: 0, bend90: 0 });
  // a closed rectangle: four 90s
  assert.deepStrictEqual(fm.runBendCounts([P(0, 0), P(100, 0), P(100, 50), P(0, 50)], true), { bend45: 0, bend90: 4 });
  // fewer than three points: nothing to bend
  assert.deepStrictEqual(fm.runBendCounts([P(0, 0), P(100, 0)], false), { bend45: 0, bend90: 0 });
});

test('a vertex override wins over the angle read', () => {
  const pts = [P(0, 0), P(100, 0, { fitting: 'none' }), P(100, 100), P(200, 100, { fitting: 'bend45' }), P(200, 200)];
  assert.strictEqual(fm.vertexBendClass(pts, 1, false), null);      // a jog drawn to route around text
  assert.strictEqual(fm.vertexBendClass(pts, 2, false), 'bend90');
  assert.strictEqual(fm.vertexBendClass(pts, 3, false), 'bend45');  // forced
  assert.deepStrictEqual(fm.runBendCounts(pts, false), { bend45: 1, bend90: 1 });
});

test('drops: each end of a run that carries one is a 90', () => {
  assert.strictEqual(fm.lineDropEnds({}), 0);
  assert.strictEqual(fm.lineDropEnds({ endDrop: 3, endDropUnit: 'ft' }), 1);
  assert.strictEqual(fm.lineDropEnds({ startDrop: 9.5, endDrop: 9.5 }), 2);
  assert.strictEqual(fm.lineDropEnds({ startDrop: 0, endDrop: '4' }), 1);
  assert.strictEqual(fm.lineDropEnds(null), 0);
});

test('the derived rows: named and counted per class, zero rows omitted, off means none', () => {
  const lt = { name: '2in Cu', bendFittings: { enabled: true, bend90: { name: '2in Cu 45° elbow', qty: 2 } } };
  const rows = fm.bendFittingRows(lt, { bend45: 1, bend90: 3, drop: 2 });
  assert.deepStrictEqual(rows, [
    { name: '2in Cu 45° elbow', qty: 1, per: 'bend', bendClass: 'bend45', derived: true, total: 1, excludedPxRuns: 0 },
    { name: '2in Cu 45° elbow', qty: 2, per: 'bend', bendClass: 'bend90', derived: true, total: 6, excludedPxRuns: 0 },
    { name: '2in Cu 90° elbow', qty: 1, per: 'drop', bendClass: 'drop', derived: true, total: 2, excludedPxRuns: 0 },
  ]);
  assert.deepStrictEqual(fm.bendFittingRows(lt, { bend45: 0, bend90: 0, drop: 0 }), []);
  assert.deepStrictEqual(fm.bendFittingRows({ name: '2in Cu' }, { bend45: 5, bend90: 5, drop: 5 }), []);
});

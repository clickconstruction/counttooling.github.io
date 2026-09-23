// Node unit tests for water-model.js (WATER-PLAN.md rung 1): the fixture-unit
// loads by occupancy and control, the demand curve and its interpolation, the
// velocity arithmetic and the size suggestion under the side's cap, the fixture
// supply minimums, and the fraction labels the rulebook pins through.
const test = require('node:test');
const assert = require('node:assert');
const w = require('./water-model.js');

test('wsfuFor: the occupancy column asked for, the other when the code prints one, the control or the first', () => {
  assert.deepStrictEqual(w.wsfuFor('lavatory', 'public'), { fixture: 'lavatory', occupancy: 'public', control: 'faucet', cold: 1.5, hot: 1.5, total: 2 });
  assert.deepStrictEqual(w.wsfuFor('lavatory', 'private'), { fixture: 'lavatory', occupancy: 'private', control: 'faucet', cold: 0.5, hot: 0.5, total: 0.7 });
  // a bidet is private-only in the code; a service sink public-only
  assert.strictEqual(w.wsfuFor('bidet', 'public').occupancy, 'private');
  assert.strictEqual(w.wsfuFor('service-sink', 'private').occupancy, 'public');
  // the control picks the row; an unknown control falls to the first
  assert.strictEqual(w.wsfuFor('water-closet', 'public', 'flush-valve').cold, 10);
  assert.strictEqual(w.wsfuFor('water-closet', 'public', 'flush-tank').cold, 5);
  assert.strictEqual(w.wsfuFor('water-closet', 'private', 'flush-tank').cold, 2.2);
  assert.strictEqual(w.wsfuFor('water-closet', 'public', 'nope').control, 'flush-valve');
  // no hot connection reads 0, never undefined
  assert.strictEqual(w.wsfuFor('urinal', 'public').hot, 0);
  assert.strictEqual(w.wsfuFor('dishwasher', 'private').cold, 0);
  assert.strictEqual(w.wsfuFor('bathroom-group', 'private', 'flush-tank').total, 3.6);
  assert.strictEqual(w.wsfuFor('garbage', 'public'), null);
  // every row has the three sides and a label
  for (const [key, f] of Object.entries(w.WSFU_LOADS)) {
    assert.ok(f.label, key);
    for (const occ of ['public', 'private']) for (const row of Object.values(f[occ] || {})) {
      for (const side of ['cold', 'hot', 'total']) assert.strictEqual(typeof row[side], 'number', key + ' ' + occ + ' ' + side);
      assert.ok(row.total >= Math.max(row.cold, row.hot), key + ': total is at least the larger side');
    }
  }
});

test('demandGpm: the printed points exactly, straight lines between, the low and high ends', () => {
  assert.strictEqual(w.demandGpm(10, 'flush-tank'), 14.6);
  assert.strictEqual(w.demandGpm(1, 'flush-tank'), 3);
  assert.strictEqual(w.demandGpm(5000, 'flush-tank'), 593);
  assert.strictEqual(w.demandGpm(10, 'flush-valve'), 27);
  assert.strictEqual(w.demandGpm(5, 'flush-valve'), 15);
  // between 4 (8.0) and 5 (9.4): 4.5 → 8.7
  assert.strictEqual(w.demandGpm(4.5, 'flush-tank'), 8.7);
  // between 20 (19.6) and 25 (21.5): 22 → 20.4 (rounded to a tenth)
  assert.strictEqual(w.demandGpm(22, 'flush-tank'), 20.4);
  // below the curve's first point: to zero with the load; a flush-valve load that small reads the tank column
  assert.strictEqual(w.demandGpm(0.5, 'flush-tank'), 1.5);
  assert.strictEqual(w.demandGpm(3, 'flush-valve'), 6.5);
  assert.strictEqual(w.demandGpm(0, 'flush-tank'), 0);
  // past the end the last value holds
  assert.strictEqual(w.demandGpm(9000, 'flush-valve'), 593);
  assert.strictEqual(w.demandGpm(-1, 'flush-tank'), null);
  assert.strictEqual(w.demandGpm('x', 'flush-tank'), null);
  // both columns climb monotonically, and the valve column is never below the tank column where both print
  for (const col of ['flush-tank', 'flush-valve']) {
    const pts = w.DEMAND_CURVE[col];
    for (let i = 1; i < pts.length; i++) assert.ok(pts[i][0] > pts[i - 1][0] && pts[i][1] >= pts[i - 1][1], col + ' at ' + pts[i][0]);
  }
  for (const [x, y] of w.DEMAND_CURVE['flush-valve']) assert.ok(y >= w.demandGpm(x, 'flush-tank'), 'valve ≥ tank at ' + x);
});

test('velocity, inside diameters and the size under the cap', () => {
  assert.strictEqual(w.pipeIdIn('pex', 0.5), 0.475);
  assert.strictEqual(w.pipeIdIn('pex', '0.75'), 0.671);
  assert.strictEqual(w.pipeIdIn('copper', 1), 1.025);
  assert.strictEqual(w.pipeIdIn('cpvc', 0.375), null);
  assert.strictEqual(w.pipeIdIn('brass', 0.5), null);
  // 8 gpm through 1/2 in PEX: 0.4085 × 8 ÷ 0.475² ≈ 14.5 fps
  assert.ok(Math.abs(w.velocityFps(8, 0.475) - 14.48) < 0.02);
  assert.strictEqual(w.velocityFps(8, 0), null);
  // the plan's worked example: 12 WSFU cold at flush tanks → 8 gpm-ish; 1/2 in PEX is over the 8 fps cap, 3/4 in passes
  const cold = w.suggestWaterSizeIn(8, 'pex', 'cold');
  assert.strictEqual(cold.sizeIn, 0.75);
  assert.ok(cold.velocityFps < 8 && cold.velocityFps > 7);
  assert.strictEqual(cold.capFps, 8);
  // hot at 5 fps needs 1 in for the same flow
  assert.strictEqual(w.suggestWaterSizeIn(8, 'pex', 'hot').sizeIn, 1);
  // the project's own cap overrides the side's default
  assert.strictEqual(w.suggestWaterSizeIn(8, 'pex', 'hot', 8).sizeIn, 0.75);
  // no size in the table passes → null
  assert.strictEqual(w.suggestWaterSizeIn(5000, 'pex', 'cold'), null);
  assert.strictEqual(w.suggestWaterSizeIn(8, 'brass', 'cold'), null);
  assert.deepStrictEqual(w.WATER_VELOCITY_CAP_FPS, { cold: 8, hot: 5 });
  // sizes ascend within every material and the ID is always under the nominal-ish OD
  for (const key of w.WATER_MATERIAL_ORDER) {
    const sizes = Object.keys(w.PIPE_ID_IN[key].sizes).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < sizes.length; i++) assert.ok(w.PIPE_ID_IN[key].sizes[String(sizes[i])] > w.PIPE_ID_IN[key].sizes[String(sizes[i - 1])], key);
  }
});

test('material from the name: CPVC is neither copper nor PVC, galvanized by its aliases', () => {
  assert.strictEqual(w.waterMaterialFromName('3/4in PEX hot'), 'pex');
  assert.strictEqual(w.waterMaterialFromName('1in Cu'), 'copper');
  assert.strictEqual(w.waterMaterialFromName('Type L copper 1-1/4"'), 'copper');
  assert.strictEqual(w.waterMaterialFromName('3/4in CPVC'), 'cpvc');
  assert.strictEqual(w.waterMaterialFromName('2" galv'), 'galvanized');
  assert.strictEqual(w.waterMaterialFromName('1in GI water'), 'galvanized');
  assert.strictEqual(w.waterMaterialFromName('4" PVC waste'), null);
  assert.strictEqual(w.waterMaterialFromName(''), null);
});

test('fixture supply minimums and the fraction labels the rulebook pins', () => {
  assert.strictEqual(w.fixtureSupplyMinIn('lavatory'), 0.375);
  assert.strictEqual(w.fixtureSupplyMinIn('water-closet', 'flush-valve'), 1);
  assert.strictEqual(w.fixtureSupplyMinIn('water-closet', 'flush-tank'), 0.375);
  assert.strictEqual(w.fixtureSupplyMinIn('urinal', 'flush-valve'), 0.75);
  assert.strictEqual(w.fixtureSupplyMinIn('shower', 'anything'), 0.5);
  assert.strictEqual(w.fixtureSupplyMinIn('water-closet'), null);
  assert.strictEqual(w.fixtureSupplyMinIn('nope'), null);
  assert.strictEqual(w.fixtureSupplyMinLabel('lavatory'), '3/8');
  assert.strictEqual(w.fixtureSupplyMinLabel('water-closet', 'flush-valve'), '1');
  assert.strictEqual(w.fixtureSupplyMinLabel('nope'), '');
  assert.strictEqual(w.sizeFraction(0.375), '3/8');
  assert.strictEqual(w.sizeFraction(0.5), '1/2');
  assert.strictEqual(w.sizeFraction(0.75), '3/4');
  assert.strictEqual(w.sizeFraction(1), '1');
  assert.strictEqual(w.sizeFraction(1.25), '1-1/4');
  assert.strictEqual(w.sizeFraction(1.5), '1-1/2');
  assert.strictEqual(w.sizeFraction(2.5), '2-1/2');
  assert.strictEqual(w.sizeFraction(0), '');
  assert.strictEqual(w.WATER_SERVICE_MIN_IN, 0.75);
});

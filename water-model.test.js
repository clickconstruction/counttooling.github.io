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
  assert.strictEqual(w.wsfuFor('water-closet', 'private').control, 'flush-tank');
  assert.strictEqual(w.wsfuFor('urinal', 'public').control, 'flush-valve-3/4');
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

test('wsfuFixtureFromName: the trade\'s names, word-bounded, drains and bibbs are not fixtures', () => {
  const f = (n) => w.wsfuFixtureFromName(n);
  assert.deepStrictEqual(f('Lavatory'), { fixture: 'lavatory', control: null });
  assert.deepStrictEqual(f('LAV-1'), { fixture: 'lavatory', control: null });
  assert.deepStrictEqual(f('Hand sink'), { fixture: 'lavatory', control: null });
  assert.deepStrictEqual(f('Water Closet'), { fixture: 'water-closet', control: null });
  assert.deepStrictEqual(f('WC flush valve'), { fixture: 'water-closet', control: 'flush-valve' });
  assert.deepStrictEqual(f('WC-2 (tank)'), { fixture: 'water-closet', control: 'flush-tank' });
  assert.deepStrictEqual(f('Toilet, flushometer tank'), { fixture: 'water-closet', control: 'flushometer-tank' });
  assert.deepStrictEqual(f('Urinal'), { fixture: 'urinal', control: null });
  assert.deepStrictEqual(f('UR 1" FV'), { fixture: 'urinal', control: 'flush-valve-1' });
  assert.deepStrictEqual(f('Urinal flush valve'), { fixture: 'urinal', control: 'flush-valve-3/4' });
  assert.deepStrictEqual(f('Sink'), { fixture: 'kitchen-sink', control: null });
  assert.deepStrictEqual(f('3-comp sink'), { fixture: 'kitchen-sink', control: null });
  assert.deepStrictEqual(f('Mop sink'), { fixture: 'service-sink', control: null });
  assert.deepStrictEqual(f('Shower'), { fixture: 'shower', control: null });
  assert.deepStrictEqual(f('Bath'), { fixture: 'bathtub', control: null });
  assert.deepStrictEqual(f('Water Fountain'), { fixture: 'drinking-fountain', control: null });
  assert.deepStrictEqual(f('EWC'), { fixture: 'drinking-fountain', control: null });
  assert.deepStrictEqual(f('DW'), { fixture: 'dishwasher', control: null });
  assert.deepStrictEqual(f('Washer 15 lb'), { fixture: 'washing-machine-15', control: null });
  assert.deepStrictEqual(f('Washing machine'), { fixture: 'washing-machine-8', control: null });
  assert.deepStrictEqual(f('Laundry tray'), { fixture: 'laundry-tray', control: null });
  assert.deepStrictEqual(f('Bidet'), { fixture: 'bidet', control: null });
  // not fixtures: drains, bibbs, heaters, cleanouts, and a floor sink is a drain even though it says sink
  for (const n of ['Floor drain', 'FD-1', 'Floor sink', 'Hose Bib', 'HB', 'Water Heater', 'Cleanout', 'Backflow preventer', 'Duplex Receptacle', '1/2in Copper Tee', '']) assert.strictEqual(f(n), null, n);
});

test('wsfuPrefillFor: the table row for the name and the occupancy, with its label', () => {
  const pub = w.wsfuPrefillFor('Lavatory', 'public');
  assert.strictEqual(pub.total, 2);
  assert.strictEqual(pub.occupancy, 'public');
  assert.strictEqual(pub.label, 'Lavatory');
  assert.strictEqual(pub.controlLabel, 'faucet');
  assert.strictEqual(w.wsfuPrefillFor('Lavatory', 'private').total, 0.7);
  // a bare public WC is a flush valve (10), a private one a flush tank (2.2); the name's control wins
  assert.strictEqual(w.wsfuPrefillFor('WC', 'public').total, 10);
  assert.strictEqual(w.wsfuPrefillFor('WC', 'private').total, 2.2);
  assert.strictEqual(w.wsfuPrefillFor('WC tank', 'public').total, 5);
  assert.strictEqual(w.wsfuPrefillFor('WC tank', 'public').controlLabel, 'flush tank');
  // a fixture the code prints in one column reads that column whatever the project says
  assert.strictEqual(w.wsfuPrefillFor('Mop sink', 'private').occupancy, 'public');
  assert.strictEqual(w.wsfuPrefillFor('Floor drain', 'public'), null);
  // a mark's number: its override, else its counter's, else 0
  assert.strictEqual(w.markerWsfu({ wsfuOverride: 3 }, { wsfu: 2 }), 3);
  assert.strictEqual(w.markerWsfu({}, { wsfu: 2 }), 2);
  assert.strictEqual(w.markerWsfu({ wsfuOverride: 0 }, { wsfu: 2 }), 2);
  assert.strictEqual(w.markerWsfu({}, {}), 0);
  assert.strictEqual(w.markerWsfu(null, null), 0);
});

test('rung 3: the side from a name, a fixture\'s loads per side, the runs from a page', () => {
  assert.strictEqual(w.waterSideFromName('3/4in PEX hot'), 'hot');
  assert.strictEqual(w.waterSideFromName('1/2" Cu CW'), 'cold');
  assert.strictEqual(w.waterSideFromName('HWR 3/4'), 'hot');
  assert.strictEqual(w.waterSideFromName('Domestic cold water'), 'cold');
  assert.strictEqual(w.waterSideFromName('2in PVC waste'), null);
  assert.strictEqual(w.waterSideFromName(''), null);
  // a public lavatory carrying the table's 2 splits 1.5 / 1.5; typed over to 3 it splits pro rata; a WC is all cold
  assert.deepStrictEqual(w.waterFixtureLoads({ name: 'Lavatory' }, 'public', 2), { cold: 1.5, hot: 1.5, total: 2, known: true });
  assert.deepStrictEqual(w.waterFixtureLoads({ name: 'Lavatory' }, 'public', 3), { cold: 2.25, hot: 2.25, total: 3, known: true });
  assert.deepStrictEqual(w.waterFixtureLoads({ name: 'WC' }, 'public', 10), { cold: 10, hot: 0, total: 10, known: true });
  // the counter's own column wins over the project's
  assert.deepStrictEqual(w.waterFixtureLoads({ name: 'Lavatory', wsfuOccupancy: 'private' }, 'public', 0.7), { cold: 0.5, hot: 0.5, total: 0.7, known: true });
  // a fixture the table does not know counts its whole number on each side
  assert.deepStrictEqual(w.waterFixtureLoads({ name: 'Ice maker' }, 'public', 1), { cold: 1, hot: 1, total: 1, known: false });
  assert.strictEqual(w.waterFixtureLoads({ name: 'Lavatory' }, 'public', 0), null);
  const lineTypes = [{ id: 'c', name: 'cold', color: '#00f', waterSide: 'cold' }, { id: 'h', name: 'hot', color: '#f00', waterSide: 'hot' }, { id: 'w', name: 'waste' }];
  const ann = {
    quickLines: [{ id: 'q1', lineTypeId: 'c', x1: 0, y1: 0, x2: 100, y2: 0 }, { id: 'q2', lineTypeId: 'w', x1: 0, y1: 50, x2: 100, y2: 50 }],
    polylines: [{ id: 'p1', lineTypeId: 'h', color: '#a00', points: [{ x: 0, y: 20 }, { x: 100, y: 20 }] }, { id: 'p2', lineTypeId: 'h', points: [{ x: 0, y: 0 }] }],
  };
  const runs = w.waterRunsFromAnnotations(ann, lineTypes);
  assert.deepStrictEqual(runs.map((r) => [r.id, r.side, r.kind, r.color]), [['q1', 'cold', 'quick', '#00f'], ['p1', 'hot', 'poly', '#a00']]);
  assert.deepStrictEqual(runs[0].vertices, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  assert.deepStrictEqual(w.waterRunsFromAnnotations(null, lineTypes), []);
});

test('rung 3: attachment per side, leaders, the rescue, and what each run serves', () => {
  const runs = [
    { id: 'cold-main', side: 'cold', vertices: [{ x: 0, y: 0 }, { x: 200, y: 0 }] },
    { id: 'hot-main', side: 'hot', vertices: [{ x: 0, y: 30 }, { x: 200, y: 30 }] },
  ];
  const lav = { id: 'lav', x: 50, y: 10, loads: { cold: 1.5, hot: 1.5 } };      // 10 from the cold run, 20 from the hot
  const wc = { id: 'wc', x: 120, y: 5, loads: { cold: 10, hot: 0 } };           // cold only
  const far = { id: 'far', x: 100, y: 80, loads: { cold: 2, hot: 2 } };         // 50 from the hot run: a stray
  const r = w.attachWaterFixtures([lav, wc, far], runs, { snapDist: 25 });
  assert.deepStrictEqual(r.attached.map((a) => [a.fixture.id, a.side, a.runId, a.load, a.dist]), [['lav', 'cold', 'cold-main', 1.5, 10], ['lav', 'hot', 'hot-main', 1.5, 20], ['wc', 'cold', 'cold-main', 10, 5]]);
  assert.deepStrictEqual(r.unattached.map((u) => [u.fixture.id, u.side]), [['far', 'cold'], ['far', 'hot']]);
  // the default snap is the duct tap snap: the lavatory's hot side at 20 is beyond 12
  assert.deepStrictEqual(w.attachWaterFixtures([lav], runs).attached.map((a) => a.side), ['cold']);
  // a side attaches only to a run of that side, whatever is nearer
  const hotOnly = { id: 'h', x: 50, y: 2, loads: { cold: 0, hot: 1 } };
  assert.deepStrictEqual(w.attachWaterFixtures([hotOnly], runs, { snapDist: 40 }).attached.map((a) => a.runId), ['hot-main']);
  // leaders: one per attached side, none when the fixture sits on the run
  const leaders = w.waterFixtureLeaders([lav, { id: 'on', x: 90, y: 0, loads: { cold: 1, hot: 0 } }], runs, { snapDist: 25 });
  assert.deepStrictEqual(leaders.map((l) => [l.fixture.id, l.side, l.to]), [['lav', 'cold', { x: 50, y: 0 }], ['lav', 'hot', { x: 50, y: 30 }]]);
  // the rescue: the nearest run of a wanted side within reach
  assert.deepStrictEqual(w.waterNearestRunPoint(far, runs, ['hot']), { runId: 'hot-main', side: 'hot', point: { x: 100, y: 30 }, dist: 50 });
  assert.deepStrictEqual(w.waterNearestRunPoint(far, runs, ['cold']), { runId: 'cold-main', side: 'cold', point: { x: 100, y: 0 }, dist: 80 });
  assert.strictEqual(w.waterNearestRunPoint({ x: 100, y: 500, loads: {} }, runs), null);
  // served per run
  assert.deepStrictEqual(w.waterServedByRun([lav, wc, far], runs, { snapDist: 25 }), { 'cold-main': { side: 'cold', wsfu: 11.5, fixtures: 2 }, 'hot-main': { side: 'hot', wsfu: 1.5, fixtures: 1 } });
});

test('rung 4: branch links, the load beyond the tip of a trace, the downstream per run', () => {
  const main = { id: 'main', side: 'cold', vertices: [{ x: 0, y: 0 }, { x: 300, y: 0 }] };
  const branch = { id: 'br', side: 'cold', vertices: [{ x: 200, y: 5 }, { x: 200, y: 100 }] };   // starts 5 off the main
  const other = { id: 'other', side: 'cold', vertices: [{ x: 0, y: 200 }, { x: 300, y: 200 }] };
  const hot = { id: 'hot', side: 'hot', vertices: [{ x: 200, y: 3 }, { x: 200, y: 100 }] };       // a hot line is never a cold main's child
  assert.deepStrictEqual(w.waterChildLinks([main, branch, other, hot]).map((l) => [l.childId, l.parentId, l.s]), [['br', 'main', 200]]);
  const fx = (id, x, y, cold, flushValve) => ({ id, x, y, loads: { cold, hot: 0 }, flushValve: !!flushValve });
  const fixtures = [fx('a', 50, 5, 1.5), fx('b', 250, 5, 10, true), fx('c', 200, 60, 2), fx('d', 100, 205, 3), fx('e', 150, 400, 4)];
  // the trace is the main itself so far (0 → 300): a and b are attached to it, c hangs off the branch (a child), d is on the other run, e is a stray
  let r = w.waterDraftRemainingLoad({ runs: [branch, other], draft: { side: 'cold', vertices: [{ x: 0, y: 0 }, { x: 300, y: 0 }] }, fixtures });
  // at the tip (300): a at 50 and b at 250 are behind → served; the branch's c and the stray e are still to serve
  assert.deepStrictEqual(r, { wsfu: 6, served: 11.5, fixtures: 2, flushValve: false });
  // the trace has only reached 100: a is behind (served); b at 250 is not on any run yet, so it is
  // the pool the trace is heading for (its flush valve picks the column); the branch is its own root
  // until the trace reaches it, so c is served elsewhere; e is a stray
  r = w.waterDraftRemainingLoad({ runs: [branch, other], draft: { side: 'cold', vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }, fixtures });
  assert.deepStrictEqual(r, { wsfu: 14, served: 1.5, fixtures: 2, flushValve: true });
  // one placed point: nothing attaches to the draft and nothing is behind its tip; the unserved pool (a, b, e) is what it is heading for
  r = w.waterDraftRemainingLoad({ runs: [branch, other], draft: { side: 'cold', vertices: [{ x: 0, y: 0 }] }, fixtures });
  assert.deepStrictEqual(r, { wsfu: 15.5, served: 0, fixtures: 3, flushValve: true });
  // the branch traced as a draft off the committed main: its fixture c, and a flush valve sets the column
  r = w.waterDraftRemainingLoad({ runs: [main, other], draft: { side: 'cold', vertices: [{ x: 200, y: 5 }, { x: 200, y: 30 }] }, fixtures: fixtures.concat([fx('f', 200, 90, 10, true)]) });
  assert.deepStrictEqual(r, { wsfu: 16, served: 0, fixtures: 3, flushValve: true });
  assert.strictEqual(w.waterDraftRemainingLoad({ runs: [], draft: { side: 'hot', vertices: [] }, fixtures }), null);
  // downstream per committed run: the main carries its own and the branch's
  const d = w.waterDownstreamByRun(fixtures, [main, branch, other]);
  assert.deepStrictEqual(d, { main: { side: 'cold', wsfu: 13.5, fixtures: 3, flushValve: true }, br: { side: 'cold', wsfu: 2, fixtures: 1, flushValve: false }, other: { side: 'cold', wsfu: 3, fixtures: 1, flushValve: false } });
});

test('rung 4: the suggestion, the ladder, and a name with its size swapped', () => {
  // 12 WSFU at flush tanks → 16 gpm; cold at 8 fps wants 1 in PEX (0.862 in: 8.8 fps? no, 1 in reads 8.8 → 1-1/4 in)
  const s = w.waterDraftSuggestion({ wsfu: 12, material: 'pex', side: 'cold', currentSizeIn: 0.75 });
  assert.strictEqual(s.column, 'flush-tank');
  assert.strictEqual(s.gpm, 16);
  assert.strictEqual(s.capFps, 8);
  assert.strictEqual(s.sizeIn, 1.25);
  assert.ok(s.velocityFps < 8);
  assert.strictEqual(s.currentSizeIn, 0.75);
  assert.ok(s.currentVelocityFps > 8);
  assert.strictEqual(s.over, true);
  assert.strictEqual(s.holds, false);
  // a flush valve picks the valve column (12 → 28.6 gpm); the project's cap overrides the side's
  const v = w.waterDraftSuggestion({ wsfu: 12, flushValve: true, material: 'copper', side: 'cold', cap: 10, currentSizeIn: 1.25 });
  assert.strictEqual(v.column, 'flush-valve');
  assert.strictEqual(v.gpm, 28.6);
  assert.strictEqual(v.capFps, 10);
  assert.strictEqual(v.sizeIn, 1.25);
  assert.strictEqual(v.holds, true);
  // no material: the flow, no size
  const n = w.waterDraftSuggestion({ wsfu: 4, side: 'hot' });
  assert.strictEqual(n.gpm, 8);
  assert.strictEqual(n.sizeIn, null);
  assert.strictEqual(n.capFps, 5);
  assert.strictEqual(w.waterDraftSuggestion({ wsfu: 0, material: 'pex', side: 'cold' }), null);
  const ladder = w.waterSizeLadder(8, 'pex', 8);
  assert.deepStrictEqual(ladder.map((r) => [r.label, r.ok]), [['3/8', false], ['1/2', false], ['3/4', true], ['1', true], ['1-1/4', true], ['1-1/2', true], ['2', true]]);
  assert.deepStrictEqual(w.waterSizeLadder(8, 'brass', 8), []);
  assert.strictEqual(w.replaceSizeInName('3/4in PEX hot', 1), '1in PEX hot');
  assert.strictEqual(w.replaceSizeInName('1/2" Cu', 0.75), '3/4" Cu');
  assert.strictEqual(w.replaceSizeInName('1-1/4 in copper', 1.5), '1-1/2 in copper');
  assert.strictEqual(w.replaceSizeInName('2 inch galv', 2.5), '2-1/2 inch galv');
  assert.strictEqual(w.replaceSizeInName('PEX cold', 0.5), '1/2in PEX cold');
});

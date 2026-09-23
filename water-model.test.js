// Node unit tests for water-model.js (WATER-PLAN.md rung 1): the IPC Appendix E
// tables as transcribed, the fixture-unit sums per occupancy, the demand curve's
// interpolation and its edges, the velocity math, the size a flow earns under
// the side's cap, and the fixture-supply minimums. The values themselves are
// checked against the book by the plumber walkthrough; these tests pin the
// shape and the math, and the plan's worked example.
const test = require('node:test');
const assert = require('node:assert');
const w = require('./water-model.js');

test('every fixture row is well formed: a label, at least one occupancy, cold and hot never above the total, the total never above their sum', () => {
  for (const key of w.WSFU_FIXTURE_ORDER) {
    const f = w.WSFU_FIXTURES[key];
    assert.ok(f.label && f.control, key);
    assert.ok(f.private || f.public, key + ': no occupancy');
    for (const occ of w.WATER_OCCUPANCIES) {
      const v = f[occ];
      if (!v) continue;
      assert.ok(v.cold >= 0 && v.hot >= 0 && v.total > 0, key + ' ' + occ);
      assert.ok(Math.max(v.cold, v.hot) <= v.total + 1e-9, key + ' ' + occ + ': a side above the total');
      assert.ok(v.total <= v.cold + v.hot + 1e-9, key + ' ' + occ + ': the total above the sum of the sides');
    }
  }
});

test('wsfuFor reads the occupancy column, falls back across when the table lists one only, and says so', () => {
  assert.deepStrictEqual(w.wsfuFor('lavatory', 'public'), { key: 'lavatory', label: 'Lavatory', control: 'faucet', occupancy: 'public', fallback: false, cold: 1.5, hot: 1.5, total: 2 });
  assert.strictEqual(w.wsfuFor('lavatory', 'private').total, 0.7);
  // a house's drinking fountain is the table's (public-only) drinking fountain
  const df = w.wsfuFor('drinking-fountain', 'private');
  assert.strictEqual(df.fallback, true); assert.strictEqual(df.occupancy, 'public'); assert.strictEqual(df.total, 0.25);
  // junk occupancy reads the default (public)
  assert.strictEqual(w.wsfuFor('water-closet-tank', 'both').total, 5);
  assert.strictEqual(w.wsfuFor('hose-bibb', 'public'), null);
});

test('wsfuTotals sums by side and total, counts unknown keys, ignores junk quantities', () => {
  const t = w.wsfuTotals([{ key: 'lavatory', qty: 3 }, { key: 'water-closet-tank', qty: 3 }, { key: 'hose-bibb', qty: 2 }, { key: 'lavatory', qty: 0 }, { key: 'shower', qty: 'x' }], 'public');
  assert.deepStrictEqual(t, { cold: 19.5, hot: 4.5, total: 21, unknown: ['hose-bibb'] });
  assert.deepStrictEqual(w.wsfuTotals([], 'public'), { cold: 0, hot: 0, total: 0, unknown: [] });
});

test('the demand column is flush valve when any flush valve is on the set', () => {
  assert.strictEqual(w.demandColumnFor([{ key: 'lavatory', qty: 3 }, { key: 'water-closet-tank', qty: 3 }]), 'flushTank');
  assert.strictEqual(w.demandColumnFor([{ key: 'lavatory', qty: 3 }, { key: 'water-closet-valve', qty: 1 }]), 'flushValve');
  assert.strictEqual(w.demandColumnFor([{ key: 'urinal-valve-3-4in', qty: 1 }]), 'flushValve');
  assert.strictEqual(w.demandColumnFor([{ key: 'water-closet-valve', qty: 0 }]), 'flushTank');
});

test('the demand curve: monotonic rows, the table values on the rows, straight-line between them, the edges', () => {
  for (const col of ['flushTank', 'flushValve']) {
    const rows = w.WSFU_DEMAND[col];
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i][0] > rows[i - 1][0] && rows[i][1] > rows[i - 1][1], col + ' row ' + i);
    for (const [wsfu, gpm] of rows) assert.strictEqual(w.demandGpm(wsfu, col), gpm, col + ' @ ' + wsfu);
  }
  assert.strictEqual(w.demandGpm(4.5, 'flushTank'), 8.7);          // between 4 → 8.0 and 5 → 9.4
  assert.strictEqual(w.demandGpm(0.7, 'flushTank'), 2.1);          // under the first row: scaled from zero
  assert.strictEqual(w.demandGpm(3, 'flushValve'), 6.5);           // a valve load under 5 reads the tank column
  assert.strictEqual(w.demandGpm(1250, 'flushValve'), 239);        // past 1,000 the columns rejoin
  assert.strictEqual(w.demandGpm(9000, 'flushTank'), 593);         // past the table the last value holds
  assert.strictEqual(w.demandGpm(0, 'flushTank'), 0);
  assert.strictEqual(w.demandGpm('junk', 'flushTank'), 0);
});

test('velocity: gpm through a bore, and the size keys round-trip', () => {
  assert.strictEqual(Math.round(w.velocityFps(10, 1.025) * 100) / 100, 3.89);   // 10 gpm in 1 in Type L
  assert.strictEqual(w.velocityFps(10, 0), null);
  assert.strictEqual(w.sizeKey(1.25), '1-1/4'); assert.strictEqual(w.sizeKeyIn('1-1/4'), 1.25);
  assert.strictEqual(w.sizeKey(0.375), '3/8'); assert.strictEqual(w.sizeKeyIn('3/4'), 0.75);
  assert.strictEqual(w.pipeIdIn('copper', 0.75), 0.785);
  assert.strictEqual(w.pipeIdIn('pex', 5), null);
  assert.strictEqual(w.pipeIdIn('lead', 0.5), null);
  for (const m of w.WATER_MATERIAL_ORDER) {
    const sizes = w.pipeSizesIn(m);
    for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] > sizes[i - 1] && w.pipeIdIn(m, sizes[i]) > w.pipeIdIn(m, sizes[i - 1]), m);
    for (const s of sizes) assert.ok(w.pipeIdIn(m, s) < s * 1.3 && w.pipeIdIn(m, s) > s * 0.6, m + ' ' + s + ': an inside diameter near its nominal size');
  }
});

test('the worked example (WATER-PLAN §7, the tables\' own numbers): three public lavatories on PEX', () => {
  const lavs = [{ key: 'lavatory', qty: 3 }];
  const t = w.wsfuTotals(lavs, 'public');
  assert.strictEqual(t.cold, 4.5);
  const gpm = w.demandGpm(t.cold, w.demandColumnFor(lavs));
  assert.strictEqual(gpm, 8.7);
  // cold at 8 fps: 1/2 in PEX runs about 15.8 fps, 3/4 in about 7.9 → 3/4 in
  const cold = w.suggestWaterSize({ gpm, side: 'cold', material: 'pex' });
  assert.strictEqual(cold.key, '3/4'); assert.strictEqual(cold.ok, true); assert.strictEqual(cold.velocityFps, 7.9); assert.strictEqual(cold.capFps, 8);
  // hot at 5 fps on the same three: 3/4 in is over, 1 in about 4.8 → 1 in
  const hot = w.suggestWaterSize({ gpm, side: 'hot', material: 'pex' });
  assert.strictEqual(hot.key, '1'); assert.strictEqual(hot.velocityFps, 4.8); assert.strictEqual(hot.capFps, 5);
  // add the three flush-tank water closets upstream: 19.5 WSFU cold → 19.4 gpm → 1-1/4 in PEX cold
  const all = [{ key: 'lavatory', qty: 3 }, { key: 'water-closet-tank', qty: 3 }];
  const g2 = w.demandGpm(w.wsfuTotals(all, 'public').cold, w.demandColumnFor(all));
  assert.strictEqual(g2, 19.4);
  assert.strictEqual(w.suggestWaterSize({ gpm: g2, side: 'cold', material: 'pex' }).key, '1-1/4');
  // the fixture's own minimum is a floor: a water closet flush valve is never on less than 1 in
  assert.strictEqual(w.suggestWaterSize({ gpm: 3, side: 'cold', material: 'copper', minSizeIn: w.fixtureSupplyMinIn('water-closet-valve') }).key, '1');
  // a custom cap is honoured; nothing passing returns the largest size with ok false
  assert.strictEqual(w.suggestWaterSize({ gpm, side: 'cold', material: 'pex', capFps: 4 }).key, '1-1/4');
  const none = w.suggestWaterSize({ gpm: 900, side: 'cold', material: 'pex' });
  assert.strictEqual(none.ok, false); assert.strictEqual(none.key, '2');
  // junk material and side read PEX and cold
  assert.strictEqual(w.suggestWaterSize({ gpm, material: 'lead', side: 'warm' }).material, 'pex');
});

test('fixture supply minimums: the table rows, both urinal valves on one row, labels in trade sizes, the service minimum', () => {
  assert.strictEqual(w.fixtureSupplyMinIn('lavatory'), 0.375);
  assert.strictEqual(w.fixtureSupplyMinLabel('lavatory'), '3/8');
  assert.strictEqual(w.fixtureSupplyMinIn('water-closet-valve'), 1);
  assert.strictEqual(w.fixtureSupplyMinIn('urinal-valve-1in'), 0.75);
  assert.strictEqual(w.fixtureSupplyMinIn('urinal-valve-3-4in'), 0.75);
  assert.strictEqual(w.fixtureSupplyMinLabel('sink-flushing-rim'), '3/4');
  assert.strictEqual(w.fixtureSupplyMinIn('bathroom-group-tank'), null);
  assert.strictEqual(w.WATER_SERVICE_MIN_IN, 0.75);
  // every WSFU fixture that is a single fixture has a minimum supply size (the groups and the washing machines have none in the table)
  for (const key of w.WSFU_FIXTURE_ORDER) {
    if (/^bathroom-group|^washing-machine/.test(key)) continue;
    assert.ok(w.fixtureSupplyMinIn(key) != null, key + ': no minimum supply size');
  }
});

test('rung 2: the fixture a counter name declares, with the tag prefixes the schedule reader writes', () => {
  const k = (name, occ) => (w.wsfuFixtureFromName(name, occ) || {}).key || null;
  // the engineer's own schedule on P-501 (public): WC-1 10, U-1 5, L-1 2, HS-1 2, 3CS-1 4, MS-1 3, FD-1 and FS-1 none
  const sched = { 'WC-1 Water Closet': 10, 'U-1 Urinal': 5, 'L-1 Lavatory': 2, 'HS-1 Hand Sink': 2, '3CS-1 3-Compartment Sink': 4, 'MS-1 Mop Sink': 3 };
  for (const name of Object.keys(sched)) assert.strictEqual(w.wsfuPrefillFor(name, 'public').total, sched[name], name);
  for (const name of ['FD-1 Floor Drain', 'FS-1 Floor Sink', 'HB Hose Bibb', 'Water Heater', 'Grease Interceptor', 'Cleanout', 'Trap primer', 'VTR', 'Ball Valve', '1/2in PEX Tee', '']) assert.strictEqual(w.wsfuPrefillFor(name, 'public'), null, name);
  // bare tags and words
  assert.strictEqual(k('WC', 'public'), 'water-closet-valve');
  assert.strictEqual(k('WC', 'private'), 'water-closet-tank');
  assert.strictEqual(k('Toilet, flush tank', 'public'), 'water-closet-tank');
  assert.strictEqual(k('Water Closet FV', 'private'), 'water-closet-valve');
  assert.strictEqual(k('Flushometer tank WC', 'public'), 'water-closet-flushometer-tank');
  assert.strictEqual(k('Urinal 1" flush valve', 'public'), 'urinal-valve-1in');
  assert.strictEqual(k('Urinal, flush tank', 'public'), 'urinal-tank');
  assert.strictEqual(k('LAV', 'public'), 'lavatory');
  assert.strictEqual(k('Kitchen Sink', 'public'), 'kitchen-sink');
  assert.strictEqual(k('Prep Sink', 'public'), 'kitchen-sink');
  assert.strictEqual(k('Service Sink', 'public'), 'service-sink');
  assert.strictEqual(k('DW Dishwasher', 'public'), 'dishwasher');
  assert.strictEqual(k('EWC', 'public'), 'drinking-fountain');
  assert.strictEqual(k('Shower', 'public'), 'shower');
  assert.strictEqual(k('Bathtub', 'private'), 'bathtub');
  assert.strictEqual(k('Laundry Tray', 'private'), 'laundry-tray');
  assert.strictEqual(k('Washer', 'private'), 'washing-machine-8lb');
  assert.strictEqual(k('Commercial washing machine', 'public'), 'washing-machine-15lb');
  assert.strictEqual(k('Bathroom group', 'private'), 'bathroom-group-tank');
  // the match names the assumption
  assert.match(w.wsfuFixtureFromName('WC-1', 'public').match, /flush valve assumed/);
  assert.match(w.wsfuFixtureFromName('HS-1 Hand Sink', 'public').match, /read as a lavatory/);
  // the prefill carries the rule and the occupancy it read
  const p = w.wsfuPrefillFor('L-1 Lavatory', 'private');
  assert.strictEqual(p.total, 0.7); assert.strictEqual(p.occupancy, 'private'); assert.strictEqual(p.ruleId, 'plumb.wsfu.fixtures'); assert.strictEqual(p.fallback, false);
  // a public-only fixture on a private project falls back and says so
  assert.strictEqual(w.wsfuPrefillFor('Mop Sink', 'private').fallback, true);
});

test('rung 2: a counter\'s fixture units, the per-mark override, and the cold / hot split of a typed total', () => {
  assert.strictEqual(w.counterWsfu({ wsfu: 2 }), 2);
  assert.strictEqual(w.counterWsfu({ wsfu: 0 }), null);
  assert.strictEqual(w.counterWsfu({}), null);
  assert.strictEqual(w.counterWsfu(null), null);
  assert.strictEqual(w.markerWsfu({ wsfuOverride: 4 }, { wsfu: 2 }), 4);
  assert.strictEqual(w.markerWsfu({}, { wsfu: 2 }), 2);
  assert.strictEqual(w.markerWsfu({ wsfuOverride: -1 }, { wsfu: 2 }), 2);
  assert.strictEqual(w.markerWsfu({}, {}), null);
  assert.deepStrictEqual(w.counterWsfuSplit({ wsfu: 2, wsfuFixture: 'lavatory' }, 'public'), { cold: 1.5, hot: 1.5, total: 2 });
  assert.deepStrictEqual(w.counterWsfuSplit({ wsfu: 4, wsfuFixture: 'lavatory' }, 'public'), { cold: 3, hot: 3, total: 4 });   // typed over: the fixture's shape
  assert.deepStrictEqual(w.counterWsfuSplit({ wsfu: 10, wsfuFixture: 'water-closet-valve' }, 'public'), { cold: 10, hot: 0, total: 10 });
  assert.strictEqual(w.counterWsfuSplit({ wsfu: 3 }, 'public'), null);
  assert.strictEqual(w.counterWsfuSplit({}, 'public'), null);
});

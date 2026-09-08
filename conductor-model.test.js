// Node unit tests for conductor-model.js — the pure raceway / conductor model
// behind "Conductors on the run" (Electrical, First-Class S3). npm run test:unit.
const test = require('node:test');
const assert = require('node:assert');
const cm = require('./conductor-model.js');

test('parseConductorSpec: the shorthand the trade writes', () => {
  assert.deepStrictEqual(cm.parseConductorSpec('3 #12 THHN + 1 #12 G'), {
    conductors: [{ n: 3, gauge: '#12', insul: 'THHN', role: 'hot' }, { n: 1, gauge: '#12', insul: 'THHN', role: 'ground' }],
    bad: [],
  });
  assert.deepStrictEqual(cm.parseConductorSpec('2#12, 1#12 N, 1#12 GND').conductors.map((c) => c.role), ['hot', 'neutral', 'ground']);
  assert.deepStrictEqual(cm.parseConductorSpec('3 x 10 THWN + 1 10 green').conductors, [
    { n: 3, gauge: '#10', insul: 'THWN', role: 'hot' }, { n: 1, gauge: '#10', insul: 'THHN', role: 'ground' },
  ]);
  assert.deepStrictEqual(cm.parseConductorSpec('3 #1/0 XHHW + 1 #6 G').conductors, [
    { n: 3, gauge: '1/0', insul: 'XHHW', role: 'hot' }, { n: 1, gauge: '#6', insul: 'THHN', role: 'ground' },
  ]);
  assert.deepStrictEqual(cm.parseConductorSpec('4 250 kcmil').conductors, [{ n: 4, gauge: '250 kcmil', insul: 'THHN', role: 'hot' }]);
  assert.deepStrictEqual(cm.parseConductorSpec('3 250 THHN').conductors[0].gauge, '250 kcmil');
  assert.deepStrictEqual(cm.parseConductorSpec(''), { conductors: [], bad: [] });
  assert.deepStrictEqual(cm.parseConductorSpec('three wires + 1 #12 G').bad, ['three wires']);
});

test('formatConductorSpec round-trips', () => {
  const spec = '3 #12 THHN + 1 #12 THHN N + 1 #12 THHN G';
  assert.strictEqual(cm.formatConductorSpec(cm.parseConductorSpec(spec).conductors), spec);
});

test('wireRowsFor: feet × n per gauge; hots and neutrals merge, ground is its own row', () => {
  const list = cm.parseConductorSpec('2 #12 THHN + 1 #12 N + 1 #12 G').conductors;
  const rows = cm.wireRowsFor(143, list);
  const byName = Object.fromEntries(Object.values(rows).map((r) => [r.name, r.feet]));
  assert.deepStrictEqual(byName, { '#12 THHN': 429, '#12 THHN green': 143 });
  assert.deepStrictEqual(cm.wireRowsFor(0, list), {});
});

test('cableNameFor: MC 12/2 w/G', () => {
  const list = cm.parseConductorSpec('2 #12 THHN + 1 #12 G').conductors;
  assert.strictEqual(cm.cableNameFor({ kind: 'MC' }, list), 'MC 12/2 w/G');
  assert.strictEqual(cm.cableNameFor({ kind: 'NM' }, cm.parseConductorSpec('2 #14 + 1 #14 G').conductors), 'NM 14/2 w/G');
  assert.strictEqual(cm.cableNameFor({ kind: 'MC' }, cm.parseConductorSpec('3 #10 + 1 #10 N').conductors), 'MC 10/4');
  assert.strictEqual(cm.cableNameFor({ kind: 'MC' }, []), 'MC');
});

test('isCableRaceway / racewayLabel / conductorsForLine', () => {
  assert.strictEqual(cm.isCableRaceway('MC'), true);
  assert.strictEqual(cm.isCableRaceway('nm'), true);
  assert.strictEqual(cm.isCableRaceway('EMT'), false);
  assert.strictEqual(cm.racewayLabel({ kind: 'EMT', size: '3/4"' }), '3/4" EMT');
  assert.strictEqual(cm.racewayLabel({ kind: 'MC' }), 'MC');
  assert.strictEqual(cm.racewayLabel(null), '');
  const lt = { conductors: [{ n: 3, gauge: '#12', insul: 'THHN', role: 'hot' }] };
  assert.strictEqual(cm.conductorsForLine({}, lt), lt.conductors);
  const own = [{ n: 7, gauge: '#12', insul: 'THHN', role: 'hot' }];
  assert.strictEqual(cm.conductorsForLine({ conductors: own }, lt), own);
  assert.strictEqual(cm.conductorsForLine({ conductors: [] }, lt), lt.conductors);
  assert.strictEqual(cm.conductorsForLine({}, {}), null);
});

test('tickLayout: hots, then the longer neutral, then the dashed ground; capped at 12', () => {
  const list = cm.parseConductorSpec('2 #12 + 1 #12 N + 1 #12 G').conductors;
  assert.deepStrictEqual(cm.tickLayout(list), [
    { role: 'hot', len: 1, dashed: false }, { role: 'hot', len: 1, dashed: false },
    { role: 'neutral', len: 1.5, dashed: false }, { role: 'ground', len: 1, dashed: true },
  ]);
  assert.strictEqual(cm.tickLayout(cm.parseConductorSpec('20 #12').conductors).length, 12);
  assert.deepStrictEqual(cm.tickLayout(null), []);
});

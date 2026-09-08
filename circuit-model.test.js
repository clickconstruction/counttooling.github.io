// Node unit tests for circuit-model.js — the pure circuit model behind
// "Circuits" (Electrical, First-Class S4). npm run test:unit.
const test = require('node:test');
const assert = require('node:assert');
const cm = require('./circuit-model.js');

test('circuitTag / isCircuitGroup', () => {
  assert.strictEqual(cm.circuitTag({ panel: 'LP-1', circuit: '7' }), 'LP-1/7');
  assert.strictEqual(cm.circuitTag({ panel: 'LP-1' }), 'LP-1');
  assert.strictEqual(cm.circuitTag({ circuit: 7 }), '7');
  assert.strictEqual(cm.circuitTag({ name: 'Open office' }), '');
  assert.strictEqual(cm.isCircuitGroup({ panel: ' ' }), false);
  assert.strictEqual(cm.isCircuitGroup({ panel: 'LP-1' }), true);
});

test('buildRunGraph snaps coincident endpoints; distancesFrom walks feet', () => {
  const g = cm.buildRunGraph([
    { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, feet: 10 },
    { a: { x: 100.5, y: 0.5 }, b: { x: 100, y: 100 }, feet: 12 },   // within tol of the first end
    { a: { x: 300, y: 300 }, b: { x: 400, y: 300 }, feet: 5 },      // an island
  ]);
  assert.strictEqual(g.nodes.length, 5);
  const d = cm.distancesFrom(g, 0);
  assert.deepStrictEqual(d.slice(0, 3), [0, 10, 22]);
  assert.strictEqual(d[3], Infinity);
});

test('farthestDeviceFeet: from the panel mark, else from the homerun end; off-run devices are counted apart', () => {
  // panel at (0,0); homerun 0→(100,0) 40 ft; branch (100,0)→(200,0) 20 ft and (100,0)→(100,80) 15 ft
  const runs = [
    { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, feet: 40, id: 'hr' },
    { a: { x: 100, y: 0 }, b: { x: 200, y: 0 }, feet: 20 },
    { a: { x: 100, y: 0 }, b: { x: 100, y: 80 }, feet: 15 },
  ];
  const devices = [{ x: 200, y: 0 }, { x: 100, y: 80 }, { x: 500, y: 500 }];
  const r = cm.farthestDeviceFeet({ runs, devices, panelPoints: [{ x: 0, y: 0 }] });
  assert.deepStrictEqual(r, { feet: 60, from: 'panel', devicesOnRuns: 2, devicesOffRuns: 1 });
  // no panel mark on the graph: the homerun's far end is home
  // both ends of the homerun offered in either order: the leaf end (no device, no continuation) is home
  const r2 = cm.farthestDeviceFeet({ runs, devices, panelPoints: [{ x: 900, y: 900 }], homerunEnds: [{ x: 100, y: 0 }, { x: 0, y: 0 }] });
  assert.strictEqual(r2.from, 'homerun');
  assert.strictEqual(r2.feet, 60);
  // nothing to start from
  const r3 = cm.farthestDeviceFeet({ runs, devices });
  assert.deepStrictEqual([r3.feet, r3.from], [null, null]);
  assert.deepStrictEqual(cm.farthestDeviceFeet({}), { feet: null, from: null, devicesOnRuns: 0, devicesOffRuns: 0 });
});

test('panelCrossCheck: circuits on plan vs the panel counter\'s poles', () => {
  const groups = [
    { id: 'a', name: 'Lights 104', panel: 'LP-1', circuit: '1' },
    { id: 'b', name: 'Lights 105', panel: 'LP-1', circuit: '3' },
    { id: 'c', name: 'Recept', panel: 'lp-1', circuit: '5,7' },   // a two-pole run counts both
    { id: 'd', name: 'Panel feed', panel: 'LP-1' },               // panel, no number: counts once
    { id: 'e', name: 'Kitchen', panel: 'LP-2', circuit: '2' },
    { id: 'f', name: 'Plain group' },
  ];
  const counters = [{ id: 'p1', name: 'Panel LP-1', panelName: 'LP-1', poles: 42 }, { id: 'p3', name: 'Panel LP-3', panelName: 'LP-3', poles: 12 }];
  assert.deepStrictEqual(cm.panelCrossCheck(groups, counters), [
    { panel: 'LP-1', onPlan: 5, scheduled: 42, verdict: 'under' },
    { panel: 'LP-2', onPlan: 1, scheduled: null, verdict: 'unknown' },
    { panel: 'LP-3', onPlan: 0, scheduled: 12, verdict: 'under' },
  ]);
  assert.deepStrictEqual(cm.panelCrossCheck([{ panel: 'A', circuit: '1' }], [{ panelName: 'A', poles: 1 }])[0].verdict, 'match');
});

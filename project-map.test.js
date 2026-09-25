// Node unit tests for scripts/lib/project-map.js — the measured skeleton under
// DECOMPOSITION_MAP.md and the three structural invariants `npm run check`
// runs through scripts/build-projectmap.js --check. The invariants are only
// worth running if they can fail, so each one is driven red here on a
// synthetic map.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyzeJs, shellModals, duplicates, sections, invariants } = require('./scripts/lib/project-map.js');

const FEATURE = `
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const early = App.loadedLater;            // load-time read
  const { alsoEarly } = App;                // load-time destructure
  function openThing() {
    const state = App.state;
    if (App.optionalHook) App.optionalHook();
    App.showToast('hi');
    state.tool = 1;
    state.pages.push({});
    state.counters.forEach(() => {});
    document.getElementById('thingModal').style.display = 'flex';
    document.querySelector('#thingInput').value = '';
    return state.zoom;
  }
  (window.App = window.App || {}).selfBoot = 1;
  App.openThing = openThing;
})();
`;

test('analyzeJs: registrations, reads, guards, load-time reads', () => {
  const r = analyzeJs('features/thing.js', FEATURE, 1);
  assert.ok(r.iife);
  assert.deepStrictEqual(Object.keys(r.registers).sort(), ['openThing', 'selfBoot']);
  assert.strictEqual(r.reads.loadedLater.loadTime, true);
  assert.strictEqual(r.reads.alsoEarly.loadTime, true);
  assert.strictEqual(r.reads.showToast.loadTime, false);
  assert.strictEqual(r.reads.showToast.guarded, false);
  assert.strictEqual(r.reads.optionalHook.guarded, true);
  assert.ok(!('state' in r.reads) || r.reads.state.n === 1, 'App.state counted as a read, never its fields');
});

test('analyzeJs: state reads vs writes, DOM ids, functions', () => {
  const r = analyzeJs('features/thing.js', FEATURE, 1);
  assert.deepStrictEqual(Object.keys(r.stateWrites).sort(), ['pages', 'tool']);
  assert.ok(r.stateReads.counters && r.stateReads.zoom);
  assert.ok(!r.stateReads.tool, 'an assignment is not a read');
  assert.deepStrictEqual(Object.keys(r.domIds).sort(), ['thingInput', 'thingModal']);
  const fn = r.functions.find((f) => f.name === 'openThing');
  assert.ok(fn && fn.lines > 5 && fn.depth === 1);
});

test('shellModals: ids belong to the modal-overlay that encloses them', () => {
  const html = [
    '<div id="chrome"><button id="openBtn"></button></div>',
    '<!-- <div id="commented" class="modal-overlay"></div> -->',
    '<div id="aModal" class="modal-overlay">',
    '  <div class="modal-card"><input id="aInput"><img src="x"><span id="aLabel"></span></div>',
    '</div>',
    '<div id="bModal" class="modal-overlay hidden"><p id="bText">x</p></div>',
  ].join('\n');
  const { modals, idOwner } = shellModals(html);
  assert.deepStrictEqual(Object.keys(modals).sort(), ['aModal', 'bModal']);
  assert.strictEqual(modals.aModal.start, 3);
  assert.strictEqual(modals.aModal.end, 5);
  assert.strictEqual(idOwner.aInput, 'aModal');
  assert.strictEqual(idOwner.aLabel, 'aModal', 'a void <input>/<img> does not swallow its siblings');
  assert.strictEqual(idOwner.bText, 'bModal');
  assert.strictEqual(idOwner.openBtn, null);
  assert.ok(!('commented' in idOwner));
});

test('sections: spans run to the next marker', () => {
  const s = sections('a\n  // SECTION: One\nb\nc\n  // SECTION: Two\nd\n');
  assert.deepStrictEqual(s.map((x) => [x.name, x.start, x.end]), [['One', 2, 4], ['Two', 5, 7]]);
});

test('duplicates: a copied block is found once, with both locations', () => {
  const block = Array.from({ length: 10 }, (_, i) => `  const value${i} = computeSomethingLong(argumentNumber${i}, 'label ${i}');`).join('\n');
  const r = duplicates({ 'a.js': 'x();\n' + block + '\ny();', 'b.js': block + '\nz();', 'c.js': 'unrelated();' });
  assert.strictEqual(r.runs.length, 1);
  assert.strictEqual(r.runs[0].normLines, 10);
  assert.deepStrictEqual([r.runs[0].a.file, r.runs[0].b.file].sort(), ['a.js', 'b.js']);
  assert.strictEqual(r.runs[0].a.start, r.runs[0].a.file === 'a.js' ? 2 : 1);
});

// A synthetic map shaped like build()'s output, for driving each invariant red.
function fakeMap(over) {
  const base = {
    shellOrder: ['app.js', 'features/early.js', 'features/late.js'],
    files: {
      'app.js': { kind: 'core', reads: {} },
      'features/early.js': { kind: 'feature', reads: { lateThing: { n: 1, guarded: false, loadTime: true, lines: [5] } } },
      'features/late.js': { kind: 'feature', reads: {} },
    },
    registry: { lateThing: { registeredBy: ['features/late.js'], readBy: { 'features/early.js': 1 }, guardedEverywhere: false } },
  };
  return Object.assign(base, over || {});
}

test('invariants: a load-time read of a later-registered name fails (the D1 shape)', () => {
  const problems = invariants(fakeMap());
  assert.ok(problems.some((p) => p.includes('features/early.js:5 reads App.lateThing at load time')), problems.join('\n'));
});

test('invariants: an unguarded read of a name nothing registers fails', () => {
  const m = fakeMap();
  m.files['features/early.js'].reads = { ghost: { n: 1, guarded: false, loadTime: false, lines: [9] } };
  m.registry = { ghost: { registeredBy: [], readBy: { 'features/early.js': 1 }, guardedEverywhere: false } };
  assert.ok(invariants(m).some((p) => p.startsWith('App.ghost is read unguarded')));
  m.registry.ghost.guardedEverywhere = true;   // an optional hook nobody implements yet is fine
  assert.ok(!invariants(m).some((p) => p.startsWith('App.ghost')));
});

test('invariants: a feature file with no ARCHITECTURE.md Files-table row fails', () => {
  const m = fakeMap();
  m.files['features/no-such-feature-row.js'] = { kind: 'feature', reads: {} };
  assert.ok(invariants(m).some((p) => p.includes('no row for features/no-such-feature-row.js')));
});

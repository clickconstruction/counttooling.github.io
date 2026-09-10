// Node unit tests for the takeoff eval kernel (takeoff-eval.js) — Wave 3.1 of the
// estimator-twin pipeline. Run with: npm run test:unit
const test = require('node:test');
const assert = require('node:assert');
const { tally, diffTakeoffs } = require('./takeoff-eval.js');

function proj({ wcMarks = 2, lineLenPx = 240, ppu = 12, extraCounter = null }) {
  const counterMarkers = { 'c-wc': Array.from({ length: wcMarks }, (_, i) => ({ x: i, y: i })) };
  if (extraCounter) counterMarkers['c-x'] = [{ x: 9, y: 9 }];
  const counters = [{ id: 'c-wc', name: 'WC-12' }];
  if (extraCounter) counters.push({ id: 'c-x', name: extraCounter });
  return {
    version: 1,
    counters,
    lineTypes: [{ id: 'lt-cw', name: 'Cold Water' }],
    pages: [{
      index: 0,
      scale: ppu ? { pixelsPerUnit: ppu, unit: 'ft' } : undefined,
      canvases: [{ id: 'c1', annotations: {
        counterMarkers,
        quickLines: [{ x1: 0, y1: 0, x2: lineLenPx, y2: 0, lineTypeId: 'lt-cw' }],
        polylines: [], highlights: [], notes: [], multiplyZones: [], scaleZones: [], roomBoxes: [],
      } }],
    }],
  };
}

test('tally counts marks by counter NAME and feet by line-type name', () => {
  const t = tally(proj({ wcMarks: 3, lineLenPx: 240, ppu: 12 }));
  assert.equal(t.counts['wc-12'].count, 3);
  assert.equal(Math.round(t.feet['cold water'].feet), 20);
});

test('unscaled pages report px, never fake feet', () => {
  const t = tally(proj({ ppu: null, lineLenPx: 100 }));
  assert.equal(t.feet['cold water'].feet, 0);
  assert.equal(t.feet['cold water'].px, 100);
});

test('diff: match / over / missing / extra verdicts + summary accuracy', () => {
  const reference = proj({ wcMarks: 3, extraCounter: 'FD-2' });
  const candidate = proj({ wcMarks: 4, extraCounter: 'HB-3' });
  const d = diffTakeoffs(candidate, reference);
  const byName = Object.fromEntries(d.counts.map((r) => [r.name, r]));
  assert.equal(byName['WC-12'].verdict, 'over');
  assert.equal(byName['WC-12'].delta, 1);
  assert.equal(byName['FD-2'].verdict, 'missing');
  assert.equal(byName['HB-3'].verdict, 'extra');
  assert.equal(d.summary.count_rows, 3);
  assert.equal(d.summary.count_matches, 0);
  const cw = d.feet.find((r) => r.name === 'Cold Water');
  assert.equal(cw.verdict, 'match'); // identical geometry within ±1 ft tolerance
});

test('ids differing across projects still join by name', () => {
  const ref = proj({ wcMarks: 2 });
  const cand = JSON.parse(JSON.stringify(proj({ wcMarks: 2 })));
  cand.counters[0].id = 'totally-different-id';
  cand.pages[0].canvases[0].annotations.counterMarkers = { 'totally-different-id': [{ x: 1, y: 1 }, { x: 2, y: 2 }] };
  const d = diffTakeoffs(cand, ref);
  assert.equal(d.counts[0].verdict, 'match');
});

test('v2: groups, drops and child-count rules tally and diff', () => {
  const data = (marksGroup, drop) => ({
    counters: [{ id: 'c1', name: 'Duplex Receptacle', childCounts: [{ name: '4" Square Box', qty: 1, per: 'count' }] }],
    lineTypes: [{ id: 'lt1', name: '1/2" EMT', childCounts: [{ name: 'Coupling', qty: 1, per: 'ft', ftInterval: 10 }, { name: 'Connector', qty: 2, per: 'run' }, { name: 'Hanger', qty: 1, per: 'ft', intervalIn: 32, ruleId: 'plumb.hanger.pex' }] }],
    groups: [{ id: 'g1', name: 'LP-1 / 7' }, { id: 'g2', name: 'LP-1 / 9' }],
    pages: [{ scale: { pixelsPerUnit: 12, unit: 'ft' }, canvases: [{ annotations: {
      counterMarkers: { c1: [{ x: 0, y: 0, group: 'g1' }, { x: 1, y: 1, group: marksGroup }] },
      quickLines: [{ x1: 0, y1: 0, x2: 120, y2: 0, lineTypeId: 'lt1', group: 'g1', startDrop: drop, endDrop: 0 }],
      polylines: [],
    } }] }],
  });
  const ref = tally(data('g1', 9.5));
  assert.strictEqual(ref.counts['duplex receptacle'].count, 2);
  assert.strictEqual(Math.round(ref.feet['1/2" emt'].feet * 100) / 100, 19.5, '10 ft traced + 9.5 ft drop');
  assert.strictEqual(ref.groups['lp-1 / 7'].counts['duplex receptacle'].count, 2);
  assert.deepStrictEqual(Object.fromEntries(Object.entries(ref.children).map(([k, v]) => [k, v.total])), { '4" square box': 2, coupling: 2, connector: 2, hanger: 8 }, 'ceil(19.5/10)=2 couplings, 2 connectors per run, box per count, ceil(19.5/2.667)=8 hangers at 32 in');
  // candidate wired one receptacle to the wrong circuit and forgot the drop
  const diff = diffTakeoffs(data('g2', 0), data('g1', 9.5));
  assert.strictEqual(diff.counts[0].verdict, 'match', 'total count still right');
  const g7 = diff.groups.find((g) => g.name === 'LP-1 / 7');
  const g9 = diff.groups.find((g) => g.name === 'LP-1 / 9');
  assert.strictEqual(g7.counts[0].verdict, 'under');
  assert.strictEqual(g9.verdict, 'extra');
  assert.strictEqual(diff.feet[0].verdict, 'under', 'the missing drop shows in feet');
  assert.strictEqual(diff.children.find((c) => c.name === 'Coupling').verdict, 'under', '10 ft → 1 coupling vs 19.5 ft → 2');
  assert.strictEqual(diff.summary.group_rows, 2);
});

test('v1 data (no groups, no rules) still tallies with empty groups/children', () => {
  const d = { counters: [{ id: 'c', name: 'WC' }], lineTypes: [], pages: [{ canvases: [{ annotations: { counterMarkers: { c: [{ x: 0, y: 0 }] }, quickLines: [], polylines: [] } }] }] };
  const t = tally(d);
  assert.strictEqual(t.counts.wc.count, 1);
  assert.deepStrictEqual(t.children, {});
  assert.deepStrictEqual(Object.keys(t.groups), ['']);
  assert.strictEqual(diffTakeoffs(d, d).summary.group_matches, 1);
});

// S3 conductors: wire by gauge / cable rows in tally and diff.
test('tally + diff: conductors on line types yield wire rows; MC yields cable; cablePerCount counters yield cable', () => {
  const { tally, diffTakeoffs } = require('./takeoff-eval.js');
  const conductors = [{ n: 3, gauge: '#12', insul: 'THHN', role: 'hot' }, { n: 1, gauge: '#12', insul: 'THHN', role: 'ground' }];
  const mk = (feet, override) => ({
    counters: [{ id: 'c1', name: 'Data drop', cablePerCount: { ft: 150, name: 'Cat6' } }],
    lineTypes: [{ id: 'emt', name: '3/4" EMT', raceway: { kind: 'EMT', size: '3/4"' }, conductors }, { id: 'mc', name: 'MC', raceway: { kind: 'MC' }, conductors: [{ n: 2, gauge: '#12', insul: 'THHN', role: 'hot' }, { n: 1, gauge: '#12', insul: 'THHN', role: 'ground' }] }],
    pages: [{ scale: { pixelsPerUnit: 10, unit: 'ft' }, canvases: [{ annotations: {
      counterMarkers: { c1: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
      quickLines: [{ x1: 0, y1: 0, x2: feet * 10, y2: 0, lineTypeId: 'emt', ...(override ? { conductors: override } : {}) }, { x1: 0, y1: 0, x2: 200, y2: 0, lineTypeId: 'mc' }],
    } }] }],
  });
  const t = tally(mk(100));
  assert.strictEqual(t.wire['#12 thhn'].feet, 300);
  assert.strictEqual(t.wire['#12 thhn green'].feet, 100);
  assert.strictEqual(t.cable['mc 12/2 w/g'].feet, 20);
  assert.strictEqual(t.cable['cat6'].feet, 300);
  const d = diffTakeoffs(mk(100, [{ n: 9, gauge: '#12', insul: 'THHN', role: 'hot' }]), mk(100));
  const w = d.wire.find((r) => r.name === '#12 THHN');
  assert.deepStrictEqual([w.candidate_ft, w.reference_ft, w.verdict], [900, 300, 'over']);
  assert.strictEqual(d.summary.cable_matches, 2);
});

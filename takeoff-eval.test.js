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

// Node unit tests for bid-basis-model.js (run: npm run test:unit).
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./bid-basis-model.js');

test('parseBidBasisParams: only the exact flag activates, ref is sanitized', () => {
  assert.deepEqual(M.parseBidBasisParams('?t=abc&export=bid-basis&ref=b409'), { active: true, ref: 'b409' });
  assert.deepEqual(M.parseBidBasisParams('?t=abc&export=bid-basis&ref=BP%2012'), { active: true, ref: 'bp-12' });
  assert.deepEqual(M.parseBidBasisParams('?t=abc&export=bid-basis'), { active: true, ref: null });
  assert.deepEqual(M.parseBidBasisParams('?t=abc&export=something'), { active: false, ref: null });
  assert.deepEqual(M.parseBidBasisParams(''), { active: false, ref: null });
  const long = 'x'.repeat(80);
  assert.equal(M.parseBidBasisParams('?export=bid-basis&ref=' + long).ref.length, 40);
});

test('buildBidBasisFilename: bid first, slugged project, local date and minute', () => {
  const at = new Date(2026, 8, 9, 14, 32); // Sep 9 2026 14:32 local
  assert.equal(
    M.buildBidBasisFilename({ ref: 'b409', projectName: 'Livingston Steel Office TI', at }),
    'bid-basis_b409_livingston-steel-office-ti_2026-09-09_1432.pdf'
  );
  assert.equal(M.buildBidBasisFilename({ ref: '', projectName: '', at }), 'bid-basis_bid_plans_2026-09-09_1432.pdf');
  assert.equal(M.buildBidBasisFilename({ ref: 'B409', projectName: 'plans.PDF', at }), 'bid-basis_b409_plans_2026-09-09_1432.pdf');
  // Early morning pads the hour.
  assert.match(M.buildBidBasisFilename({ ref: 'b1', projectName: 'x', at: new Date(2026, 0, 2, 3, 4) }), /_2026-01-02_0304\.pdf$/);
});

test('slugForFilename: trims on a word boundary and never returns empty', () => {
  assert.equal(M.slugForFilename('  Hello,  World! '), 'hello-world');
  assert.equal(M.slugForFilename('///'), 'plans');
  const long = M.slugForFilename('a very very long project name that goes on and on forever and ever amen', 40);
  assert.ok(long.length <= 40, long);
  assert.ok(!long.endsWith('-'));
});

test('pageHasBidMarks: counters, runs, ducts and rooms count; highlights and notes alone do not', () => {
  const page = (annotations) => ({ canvases: [{ id: 'c', name: 'Main', annotations }] });
  assert.equal(M.pageHasBidMarks(page({ counterMarkers: { c1: [{ x: 1, y: 1 }] } })), true);
  assert.equal(M.pageHasBidMarks(page({ quickLines: [{}] })), true);
  assert.equal(M.pageHasBidMarks(page({ polylines: [{}] })), true);
  assert.equal(M.pageHasBidMarks(page({ ductRuns: [{}] })), true);
  assert.equal(M.pageHasBidMarks(page({ roomBoxes: [{}] })), true);
  assert.equal(M.pageHasBidMarks(page({ highlights: [{}] })), false);
  assert.equal(M.pageHasBidMarks(page({ notes: [{}] })), false);
  assert.equal(M.pageHasBidMarks(page({ counterMarkers: {} })), false);
  assert.equal(M.pageHasBidMarks({ canvases: [] }), false);
  assert.equal(M.pageHasBidMarks(null), false);
  // A non-active layer with marks still selects the page (every layer is the takeoff).
  assert.equal(M.pageHasBidMarks({ canvases: [{ annotations: {} }, { annotations: { quickLines: [{}] } }] }), true);
});

test('bidBasisPageSelections: marked pages in, the rest excluded, included indexes in order', () => {
  const pages = [
    { canvases: [{ annotations: {} }] },
    { canvases: [{ annotations: { counterMarkers: { c: [{}] } } }] },
    { canvases: [{ annotations: { notes: [{}] } }] },
    { canvases: [{ annotations: { polylines: [{}] } }] },
  ];
  const r = M.bidBasisPageSelections(pages);
  assert.deepEqual(r.selections, { 0: 'exclude', 1: 'marked', 2: 'exclude', 3: 'marked' });
  assert.deepEqual(r.canvasMode, { 0: 'current', 1: 'current', 2: 'current', 3: 'current' });
  assert.deepEqual(r.included, [1, 3]);
});

test('summarizeIncludedPages counts markers, runs and notes on the active canvas only', () => {
  const pages = [
    { active: { counterMarkers: { a: [{}, {}], b: [{}] }, quickLines: [{}], polylines: [{}, {}], notes: [{}] } },
    { active: { ductRuns: [{}], notes: [{}, {}] } },
    { active: { counterMarkers: { z: [{}] } } },
  ];
  const s = M.summarizeIncludedPages(pages, [0, 1], (p) => p.active);
  assert.deepEqual(s, { counters: 3, runs: 4, notes: 3 });
});

test('bidBasisTargetOrigins: production posts only to PipeTooling; localhost adds dev ports and itself', () => {
  const prod = M.bidBasisTargetOrigins('https://counttooling.com');
  assert.deepEqual(prod, M.PIPETOOLING_ORIGINS.slice());
  assert.ok(!prod.includes('*'));
  const local = M.bidBasisTargetOrigins('http://localhost:3456');
  assert.ok(local.includes('http://localhost:5173'));
  assert.ok(local.includes('http://localhost:3456'));
  assert.ok(local.includes('https://clicktooling.com'));
});

test('buildBidBasisManifest: flat, typed, JSON-safe envelope', () => {
  const m = M.buildBidBasisManifest({
    ref: 'B409', filename: 'bid-basis_b409_x_2026-09-09_1432.pdf', fileSizeBytes: 1234.6,
    sheets: ['P-101', 'P-201'], pageIndices: [2, 4], counters: 11, runs: 3, notes: 2,
    includeReport: true, projectName: 'X', projectId: 'p1', viewToken: 't1', pdfHash: 'h', ctUpdatedAt: '2026-09-09T18:58:00Z',
    exportedAt: '2026-09-09T19:32:00Z', canvasSnapshot: { version: 1 },
  });
  assert.equal(m.type, 'counttooling:bid-basis-export');
  assert.equal(m.version, 1);
  assert.equal(m.ref, 'b409');
  assert.equal(m.saveMethod, 'intended');
  assert.equal(m.fileSizeBytes, 1235);
  assert.equal(m.sheetCount, 2);
  assert.deepEqual(m.pageIndices, [2, 4]);
  assert.deepEqual(m.markTotals, { counters: 11, runs: 3 });
  assert.equal(m.notesCount, 2);
  assert.equal(m.includeReport, true);
  assert.deepEqual(m.canvasSnapshot, { version: 1 });
  assert.equal(JSON.parse(JSON.stringify(m)).ref, 'b409');
  const bare = M.buildBidBasisManifest({});
  assert.equal(bare.ref, null);
  assert.equal(bare.fileSizeBytes, null);
  assert.equal(bare.sheetCount, 0);
  assert.match(bare.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('buildBidBasisLoadedNotice: the light notice with the last-saved time', () => {
  const n = M.buildBidBasisLoadedNotice({ ref: 'B409', projectId: 'p1', projectName: 'X', viewToken: 't1', pdfHash: 'h', ctUpdatedAt: '2026-09-11T14:14:00Z' });
  assert.deepEqual(n, { type: 'counttooling:bid-basis-loaded', version: 1, ref: 'b409', projectId: 'p1', projectName: 'X', viewToken: 't1', pdfHash: 'h', ctUpdatedAt: '2026-09-11T14:14:00Z' });
  assert.equal(M.buildBidBasisLoadedNotice({}).ref, null);
});

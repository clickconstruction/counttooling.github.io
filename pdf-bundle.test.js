// Unit tests for the pure pagination helpers in features/pdf-bundle.js
// (break-aware report page cuts + uniform note-page/summary layout).
// Run: npm run test:unit  (node --test)
const test = require('node:test');
const assert = require('node:assert');
const {
  computeReportCutPoints,
  computeNotesSummaryLayout,
  computeNotePageLayout,
} = require('./features/pdf-bundle.js');

test.describe('computeReportCutPoints', () => {
  test('single page: content shorter than a page cuts once at totalHeight', () => {
    assert.deepStrictEqual(computeReportCutPoints([100, 200], 500, 2245), [500]);
  });

  test('content exactly one page tall cuts once at totalHeight', () => {
    assert.deepStrictEqual(computeReportCutPoints([500], 1000, 1000), [1000]);
  });

  test('cuts snap to the largest row boundary within each page window', () => {
    // Rows every 100px; page holds 950px -> first cut snaps back to 900.
    const boundaries = [];
    for (let b = 100; b < 5000; b += 100) boundaries.push(b);
    const cuts = computeReportCutPoints(boundaries, 5000, 950);
    assert.deepStrictEqual(cuts, [900, 1800, 2700, 3600, 4500, 5000]);
    // No cut (except the final edge) may straddle a row: every cut lands on a
    // row boundary, i.e. never strictly inside a (b, b+100) row interval.
    for (const cut of cuts.slice(0, -1)) assert.strictEqual(cut % 100, 0, 'cut ' + cut + ' slices a row');
  });

  test('every slice is at most pageHeight and cuts ascend to totalHeight', () => {
    const boundaries = [130, 260, 390, 700, 705, 1100, 1900, 2200];
    const cuts = computeReportCutPoints(boundaries, 2500, 800);
    let prev = 0;
    for (const cut of cuts) {
      assert.ok(cut > prev, 'cuts must ascend');
      assert.ok(cut - prev <= 800, 'slice taller than a page');
      prev = cut;
    }
    assert.strictEqual(cuts[cuts.length - 1], 2500);
  });

  test('no boundaries: falls back to the old fixed-stride cuts', () => {
    assert.deepStrictEqual(computeReportCutPoints([], 2500, 950), [950, 1900, 2500]);
  });

  test('block taller than a page: hard cut inside it, then re-snaps after', () => {
    // Only boundary is at 2000; first two windows have none -> hard cuts.
    const cuts = computeReportCutPoints([2000], 3000, 950);
    assert.deepStrictEqual(cuts, [950, 1900, 2000, 2950, 3000]);
  });

  test('unsorted and duplicate boundaries are normalised', () => {
    const cuts = computeReportCutPoints([900, 300, 900, 600.4], 2000, 1000);
    assert.deepStrictEqual(cuts, [900, 1900, 2000]);
  });

  test('boundaries at or beyond the edges are ignored', () => {
    const cuts = computeReportCutPoints([-5, 0, 2000, 2500], 2000, 950);
    assert.deepStrictEqual(cuts, [950, 1900, 2000]);
  });

  test('degenerate inputs return no cuts', () => {
    assert.deepStrictEqual(computeReportCutPoints([100], 0, 950), []);
    assert.deepStrictEqual(computeReportCutPoints([100], 500, 0), []);
  });
});

test.describe('computeNotesSummaryLayout', () => {
  test('matches the drawn geometry: header at 35, rows from 43, 7mm stride', () => {
    const s = computeNotesSummaryLayout(3);
    assert.strictEqual(s.titleY, 20);
    assert.strictEqual(s.headerY, 35);
    assert.strictEqual(s.firstRowY, 43);
    assert.strictEqual(s.rowH, 7);
    assert.strictEqual(s.bottom, 43 + 3 * 7);
  });

  test('zero rows leaves the bottom at the first-row baseline', () => {
    assert.strictEqual(computeNotesSummaryLayout(0).bottom, 43);
  });
});

test.describe('computeNotePageLayout', () => {
  test('every note page is uniform A4 portrait with fixed margins', () => {
    for (const opts of [
      { imgW: 300, imgH: 400, textH: 10, startY: 10 },
      { imgW: 20, imgH: 10, textH: 4, startY: 10 },
      { imgW: 150, imgH: 60, textH: 8, startY: 76 },
    ]) {
      const l = computeNotePageLayout(opts);
      assert.strictEqual(l.pageW, 210);
      assert.strictEqual(l.pageH, 297);
      assert.strictEqual(l.margin, 14);
      assert.strictEqual(l.imgX, 14);
    }
  });

  test('oversized image is scaled down to fit the content box and page', () => {
    const l = computeNotePageLayout({ imgW: 400, imgH: 500, textH: 12, startY: 10 });
    assert.ok(l.drawW <= 182 + 1e-9);
    assert.ok(l.imgY + l.drawH <= 297 - 14 - 12 - 8 + 1e-9, 'image overlaps text/margin');
    // Aspect ratio preserved.
    assert.ok(Math.abs(l.drawW / l.drawH - 400 / 500) < 1e-9);
    // Text sits below the image and above the bottom margin.
    assert.ok(l.textY > l.imgY + l.drawH);
    assert.ok(l.textY + 12 <= 297 - 14 + 1e-9);
  });

  test('tiny image upscale is capped at 2x (no blurry blowups)', () => {
    const l = computeNotePageLayout({ imgW: 20, imgH: 10, textH: 4, startY: 10 });
    assert.strictEqual(l.drawW, 40);
    assert.strictEqual(l.drawH, 20);
  });

  test('availH reports the room under a folded summary so callers can bail', () => {
    // Deep startY (big summary) leaves little room -> the caller's < 40 check
    // sends the note to its own page.
    const deep = computeNotePageLayout({ imgW: 150, imgH: 100, textH: 30, startY: 240 });
    assert.ok(deep.availH < 40);
    const shallow = computeNotePageLayout({ imgW: 150, imgH: 100, textH: 10, startY: 76 });
    assert.ok(shallow.availH >= 40);
    assert.strictEqual(shallow.availH, 297 - 14 - 10 - 8 - (76 + 4));
  });
});

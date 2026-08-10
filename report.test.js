// Node unit tests for the pure helpers in report.js.
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
const test = require('node:test');
const assert = require('node:assert');
const { escapeHtml, pickScaleForLineType, orderGroupIds, isUntaggedGroupId, collectSummaries } = require('./report.js');

test('escapeHtml returns empty string for null/undefined', () => {
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
});

test('escapeHtml escapes the five HTML-sensitive characters', () => {
  assert.strictEqual(escapeHtml('<'), '&lt;');
  assert.strictEqual(escapeHtml('>'), '&gt;');
  assert.strictEqual(escapeHtml('"'), '&quot;');
  assert.strictEqual(escapeHtml("'"), '&#39;');
  assert.strictEqual(escapeHtml('&'), '&amp;');
});

test('escapeHtml escapes & first so existing entities are not double-encoded', () => {
  // If '<' were escaped before '&', the resulting '&lt;' would become '&amp;lt;'.
  assert.strictEqual(escapeHtml('<&>'), '&lt;&amp;&gt;');
  assert.strictEqual(escapeHtml('a & b < c'), 'a &amp; b &lt; c');
});

test('escapeHtml coerces non-strings via String()', () => {
  assert.strictEqual(escapeHtml(42), '42');
  assert.strictEqual(escapeHtml(0), '0');
  assert.strictEqual(escapeHtml(true), 'true');
});

test('pickScaleForLineType prefers ft over other units regardless of page order', () => {
  global.state = { pages: [{ scale: { unit: 'm', pixelsPerUnit: 1 } }, { scale: { unit: 'ft', pixelsPerUnit: 2 } }] };
  try {
    const s = pickScaleForLineType([1, 2]);
    assert.strictEqual(s.unit, 'ft');
    assert.strictEqual(s.pixelsPerUnit, 2);
  } finally {
    delete global.state;
  }
});

test('pickScaleForLineType falls back to the first scaled page when no preferred unit', () => {
  global.state = { pages: [{}, { scale: { unit: 'km', pixelsPerUnit: 9 } }] };
  try {
    const s = pickScaleForLineType([1, 2]);
    assert.strictEqual(s.unit, 'km');
    assert.strictEqual(s.pixelsPerUnit, 9);
  } finally {
    delete global.state;
  }
});

test('pickScaleForLineType returns null when no page has a scale', () => {
  global.state = { pages: [{}, {}] };
  try {
    assert.strictEqual(pickScaleForLineType([1, 2]), null);
  } finally {
    delete global.state;
  }
});

test('collectSummaries routes each line into the ft or px bucket — never both, no lengthReal', () => {
  // Two-page fixture: p1's line is scaled (10 ft), p2's is unscaled (367.2
  // raw pts). The record must carry the split buckets with per-bucket runs
  // and pages, and the legacy summed `lengthReal` key must be gone.
  global.state = {
    pages: [{}, {}],
    counters: [{ id: 'c1', name: 'Drain', icon: null, color: '#e8c547' }],
    lineTypes: [{ id: 'lt1', name: 'Cold Water', color: '#4a9eff' }],
  };
  global.getLineLengthSplitForTotals = (item, i) => (i === 0 ? { feet: 10, px: 0 } : { feet: 0, px: 367.2 });
  global.getMultiplyZoneForPoint = () => 1;
  try {
    const anns = [
      { counterMarkers: { c1: [{ x: 1, y: 1 }] }, quickLines: [{ lineTypeId: 'lt1', x1: 0, y1: 0, x2: 240, y2: 0 }], polylines: [] },
      { counterMarkers: {}, quickLines: [{ lineTypeId: 'lt1', x1: 0, y1: 0, x2: 367.2, y2: 0 }], polylines: [] },
    ];
    const { counterSummaryByGroup, lineTypeSummaryByGroup } = collectSummaries([0, 1], (page, i) => anns[i]);
    const r = lineTypeSummaryByGroup[null].lt1;
    assert.strictEqual(r.lengthFt, 10);
    assert.strictEqual(r.lengthPx, 367.2);
    assert.strictEqual(r.runsFt, 1);
    assert.strictEqual(r.runsPx, 1);
    assert.deepStrictEqual(r.pagesFt, [1]);
    assert.deepStrictEqual(r.pagesPx, [2]);
    assert.deepStrictEqual(r.pages, [1, 2]);   // union kept for the zero-length edge
    assert.ok(!('lengthReal' in r), 'the summed lengthReal key is deleted outright');
    assert.strictEqual(counterSummaryByGroup[null].c1.total, 1);
  } finally {
    delete global.state;
    delete global.getLineLengthSplitForTotals;
    delete global.getMultiplyZoneForPoint;
  }
});

test('isUntaggedGroupId treats null/empty/stringified-null keys as untagged', () => {
  assert.strictEqual(isUntaggedGroupId(null), true);
  assert.strictEqual(isUntaggedGroupId(undefined), true);
  assert.strictEqual(isUntaggedGroupId(''), true);
  // Object keys are strings, so a null group id round-trips as the string 'null'.
  assert.strictEqual(isUntaggedGroupId('null'), true);
  assert.strictEqual(isUntaggedGroupId('undefined'), true);
  assert.strictEqual(isUntaggedGroupId('g1'), false);
});

test('orderGroupIds sorts alphabetically by group name with untagged last', () => {
  const names = { g1: 'Zeta', g2: 'Alpha', g3: 'Mid' };
  const getGroupName = (gid) => names[gid] || 'Untagged';
  const ordered = orderGroupIds({ g1: {}, null: {} }, { g2: {}, g3: {} }, getGroupName);
  assert.deepStrictEqual(ordered, ['g2', 'g3', 'g1', 'null']);
});

test('orderGroupIds merges ids from both summaries without duplicates', () => {
  const getGroupName = (gid) => ({ a: 'A', b: 'B' })[gid] || 'Untagged';
  const ordered = orderGroupIds({ a: {}, b: {} }, { b: {}, a: {} }, getGroupName);
  assert.deepStrictEqual(ordered, ['a', 'b']);
});

test('orderGroupIds tolerates a getGroupName that returns null for deleted groups', () => {
  // getPipeToolingSummary's getGroupName returns null (no [Group] prefix) for
  // untagged AND for ids whose group row was deleted; the comparator must not
  // throw on null.localeCompare.
  const getGroupName = (gid) => (gid === 'live' ? 'Live' : null);
  const ordered = orderGroupIds({ live: {}, deleted: {} }, {}, getGroupName);
  assert.strictEqual(ordered.length, 2);
  assert.ok(ordered.includes('live') && ordered.includes('deleted'));
});

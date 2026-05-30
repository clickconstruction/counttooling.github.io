// Node unit tests for the pure helpers in report.js.
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
const test = require('node:test');
const assert = require('node:assert');
const { escapeHtml, pickScaleForLineType } = require('./report.js');

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

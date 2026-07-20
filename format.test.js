// Node unit tests for the pure formatters in format.js.
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
//
// format.js references USER_ACTIVITY_TZ by bare name (a constants.js global in
// the browser), so we copy constants.js onto the global object before requiring
// format.js (same trick as idb.test.js).
const test = require('node:test');
const assert = require('node:assert');
Object.assign(globalThis, require('./constants.js'));
const f = require('./format.js');

const DAY = 86400000;

// dateKeyInTimeZone / formatLastSignInUserActivity rely on en-CA producing
// hyphenated YYYY-MM-DD keys (they split('-')). Browsers and full-ICU Node 20
// (CI) do this; a limited-ICU runtime falls back to MM/DD/YYYY, where these
// assertions are not meaningful, so skip them with a clear reason there.
const hyphenIcu = f.dateKeyInTimeZone('2026-01-15T12:00:00Z', 'America/Chicago') === '2026-01-15';
const icuSkip = hyphenIcu ? false : 'requires full-ICU en-CA hyphen date formatting (browser / Node full-icu)';

test('dateKeyInTimeZone: formats YYYY-MM-DD in the given zone', { skip: icuSkip }, () => {
  // 18:00 UTC in summer (Chicago UTC-5) is same calendar day.
  assert.strictEqual(f.dateKeyInTimeZone('2026-06-15T18:00:00Z', 'America/Chicago'), '2026-06-15');
  // Midnight UTC in winter (Chicago UTC-6) rolls back to the previous day.
  assert.strictEqual(f.dateKeyInTimeZone('2026-01-15T00:00:00Z', 'America/Chicago'), '2026-01-14');
});

test('calendarDaysFromSignInToNowInZone: integer day deltas', () => {
  assert.strictEqual(f.calendarDaysFromSignInToNowInZone('2026-01-01', '2026-01-01'), 0);
  assert.strictEqual(f.calendarDaysFromSignInToNowInZone('2026-01-01', '2026-01-02'), 1);
  assert.strictEqual(f.calendarDaysFromSignInToNowInZone('2026-01-01', '2026-01-11'), 10);
  // Across a year boundary.
  assert.strictEqual(f.calendarDaysFromSignInToNowInZone('2025-12-31', '2026-01-01'), 1);
  // Future sign-in relative to now is negative.
  assert.strictEqual(f.calendarDaysFromSignInToNowInZone('2026-01-05', '2026-01-01'), -4);
});

test('formatUserActivityDateTime: null -> em dash, ISO -> short date/time string', () => {
  assert.strictEqual(f.formatUserActivityDateTime(null), '—');
  assert.strictEqual(f.formatUserActivityDateTime(''), '—');
  const s = f.formatUserActivityDateTime('2026-06-15T18:00:00Z');
  assert.strictEqual(typeof s, 'string');
  assert.ok(s.includes('/'), 'expected a slash-separated short date');
  assert.ok(/AM|PM/.test(s), 'expected a 12-hour clock marker');
});

test('filterUserActivityRows: empty query passes the array through unchanged', () => {
  const rows = [{ email: 'a@x.com' }, { email: 'b@x.com' }];
  assert.strictEqual(f.filterUserActivityRows(rows, ''), rows);
  assert.strictEqual(f.filterUserActivityRows(rows, '   '), rows);
});

test('filterUserActivityRows: matches email / event / metadata, case-insensitive', () => {
  const rows = [
    { email: 'Alice@Example.com', event_type: 'sign_in', metadata: { projectName: 'Roof' } },
    { email: 'bob@example.com', event_type: 'project_open', metadata: { note: 'basement' } },
  ];
  assert.deepStrictEqual(f.filterUserActivityRows(rows, 'alice').map(r => r.email), ['Alice@Example.com']);
  assert.deepStrictEqual(f.filterUserActivityRows(rows, 'OPEN').map(r => r.email), ['bob@example.com']);
  // metadata is JSON-stringified before matching
  assert.deepStrictEqual(f.filterUserActivityRows(rows, 'roof').map(r => r.email), ['Alice@Example.com']);
  assert.strictEqual(f.filterUserActivityRows(rows, 'zzz').length, 0);
});

test('renderUserActivityAllUsersTableHtml: builds cells, escapes, em-dashes missing fields', () => {
  const html = f.renderUserActivityAllUsersTableHtml([
    { email: 'a@x.com', event_type: 'sign_in', created_at: '2026-06-15T18:00:00Z', project_id: 'p1', metadata: { a: 1 } },
    { email: '<script>', event_type: 'evt' },
  ]);
  assert.ok(html.startsWith('<table class="user-activity-table">'));
  assert.ok(html.includes('<td>a@x.com</td>'));
  // Missing created_at and project_id render as em dash.
  assert.ok(html.includes('<td>—</td>'));
  // HTML in a field is escaped.
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<td><script></td>'));
});

test('formatLastSignIn: relative buckets and Never', () => {
  assert.strictEqual(f.formatLastSignIn(null), 'Never');
  assert.strictEqual(f.formatLastSignIn(Date.now() - 2 * 3600000), 'Today');
  assert.strictEqual(f.formatLastSignIn(Date.now() - 1.2 * DAY), 'Yesterday');
  assert.strictEqual(f.formatLastSignIn(Date.now() - 3 * DAY), '3 days ago');
  assert.strictEqual(f.formatLastSignIn(Date.now() - 14 * DAY), '2 weeks ago');
});

test('formatLastSignInUserActivity: Never (ICU-independent)', () => {
  assert.strictEqual(f.formatLastSignInUserActivity(null), 'Never');
});

test('formatLastSignInUserActivity: Today / old-date fallback', { skip: icuSkip }, () => {
  assert.strictEqual(f.formatLastSignInUserActivity(Date.now()), 'Today');
  // 60 days ago falls past the 30-day window -> localized date, not a bucket label.
  const old = f.formatLastSignInUserActivity(Date.now() - 60 * DAY);
  assert.ok(!['Today', 'Yesterday'].includes(old) && !/ago$/.test(old), 'expected a localized date string');
  assert.ok(/\d/.test(old));
});

test('escapeHtml: escapes the full entity superset & < > " \'', () => {
  assert.strictEqual(f.escapeHtml(`<img src="x" onerror='a&b'>`),
    '&lt;img src=&quot;x&quot; onerror=&#39;a&amp;b&#39;&gt;');
});

test('escapeHtml: null/undefined become empty, numbers stringify', () => {
  assert.strictEqual(f.escapeHtml(null), '');
  assert.strictEqual(f.escapeHtml(undefined), '');
  assert.strictEqual(f.escapeHtml(42), '42');
});

test('wrapNoteTextCore: greedy wrap with a stub char-width measurer', () => {
  const measure = (s) => s.length * 10;   // 10px per char
  // maxWidth 100 -> 10 chars per line
  const r = f.wrapNoteTextCore('one two three four', 100, 14, measure);
  assert.deepStrictEqual(r.lines, ['one two', 'three four']);
  assert.strictEqual(r.height, 2 * 14);
});

test('wrapNoteTextCore: hyphen/underscore break opportunities keep the separator on the left fragment', () => {
  const measure = (s) => s.length * 10;
  const r = f.wrapNoteTextCore('first-second', 80, 14, measure);
  assert.deepStrictEqual(r.lines, ['first-', 'second']);
  const r2 = f.wrapNoteTextCore('a_b_c', 200, 14, measure);
  assert.deepStrictEqual(r2.lines, ['a_ b_ c']);   // fragments rejoin when they fit
});

test('wrapNoteTextCore: empty text and single overlong word are safe', () => {
  const measure = (s) => s.length * 10;
  assert.deepStrictEqual(f.wrapNoteTextCore('', 100, 14, measure), { lines: [], height: 0 });
  // An overlong single word still lands on its own line (no infinite loop).
  assert.deepStrictEqual(f.wrapNoteTextCore('abcdefghijklmnop', 50, 10, measure).lines, ['abcdefghijklmnop']);
});

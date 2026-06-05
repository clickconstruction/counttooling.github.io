// Node invariant tests for constants.js.
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
const test = require('node:test');
const assert = require('node:assert');
const c = require('./constants.js');

const isStrictlyIncreasing = (arr) => arr.every((v, i) => i === 0 || v > arr[i - 1]);

test('backoff arrays are strictly increasing and positive', () => {
  for (const name of ['AUTOSAVE_BACKOFF_LEVELS_MS', 'PROJECTS_CHECKOUT_RECONNECT_BACKOFF_MS']) {
    const arr = c[name];
    assert.ok(Array.isArray(arr) && arr.length > 0, `${name} is a non-empty array`);
    assert.ok(arr.every((v) => typeof v === 'number' && v > 0), `${name} all > 0`);
    assert.ok(isStrictlyIncreasing(arr), `${name} strictly increasing`);
  }
});

test('all *_MS timing/threshold consts are positive numbers', () => {
  for (const [k, v] of Object.entries(c)) {
    if (/_MS$/.test(k) && !Array.isArray(v)) {
      assert.strictEqual(typeof v, 'number', `${k} is a number`);
      assert.ok(v > 0, `${k} > 0 (got ${v})`);
    }
  }
});

test('all *_MAX_* caps and threshold counts are positive numbers', () => {
  const counts = [
    'PDF_CACHE_MAX_ENTRIES', 'PDF_CACHE_MAX_BYTES', 'TAKEOFF_BACKUP_MAX_ENTRIES',
    'TAKEOFF_BACKUP_MAX_BYTES', 'SAVE_LOGS_SNAPSHOT_MAX_ENTRIES',
    'AUTOSAVE_BANNER_THRESHOLD', 'AUTOSAVE_RECOVERY_THRESHOLD', 'AUTOSAVE_SLOW_WINDOW',
    'AUTOSAVE_SLOW_MIN_SAMPLES', 'AUTO_RECHECKOUT_MAX_PER_PROJECT', 'UNDO_STACK_SIZE',
  ];
  for (const k of counts) {
    assert.strictEqual(typeof c[k], 'number', `${k} is a number`);
    assert.ok(c[k] > 0, `${k} > 0 (got ${c[k]})`);
  }
});

test('TOOL ids are unique', () => {
  const ids = Object.values(c.TOOL);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('SCALE_MODES ids are unique', () => {
  const ids = Object.values(c.SCALE_MODES);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('COLORS are all valid 6-digit hex', () => {
  assert.ok(c.COLORS.length > 0);
  for (const col of c.COLORS) {
    assert.ok(/^#[0-9a-f]{6}$/i.test(col), `invalid color: ${col}`);
  }
});

test('SCALE_PRESETS each have positive pixelsPerUnit, a label, and a unit', () => {
  assert.ok(c.SCALE_PRESETS.length > 0);
  for (const p of c.SCALE_PRESETS) {
    assert.strictEqual(typeof p.pixelsPerUnit, 'number');
    assert.ok(p.pixelsPerUnit > 0, `pixelsPerUnit > 0 for ${p.label}`);
    assert.ok(typeof p.label === 'string' && p.label.length > 0);
    assert.ok(typeof p.unit === 'string' && p.unit.length > 0);
  }
});

test('domain default arrays are non-empty', () => {
  for (const arr of [c.PLUMBING_DEFAULTS.sizes, c.PLUMBING_DEFAULTS.types, c.PLUMBING_DEFAULTS.materials,
                     c.LINE_DEFAULTS.sizes, c.LINE_DEFAULTS.materials]) {
    assert.ok(Array.isArray(arr) && arr.length > 0);
  }
});

test('PDF upload timeout budget is sane (max >= base, positive rate/slack/attempts/threshold)', () => {
  assert.ok(c.PDF_UPLOAD_TIMEOUT_MAX_MS >= c.PDF_UPLOAD_TIMEOUT_BASE_MS, 'max >= base');
  assert.ok(c.PDF_UPLOAD_ASSUMED_BPS > 0, 'assumed bps > 0');
  assert.ok(c.PDF_UPLOAD_TIMEOUT_SLACK_MS > 0, 'slack > 0');
  assert.ok(Number.isInteger(c.PDF_UPLOAD_VERIFY_ATTEMPTS) && c.PDF_UPLOAD_VERIFY_ATTEMPTS > 0, 'verify attempts > 0');
  assert.ok(c.PDF_RESUMABLE_THRESHOLD_BYTES > 0 && c.PDF_RESUMABLE_THRESHOLD_BYTES <= c.PDF_MAX_SIZE_BYTES, 'resumable threshold within cap');
  assert.ok(c.PDF_ONESHOT_LARGE_BACKOFF_MS > c.PDF_ONESHOT_BACKOFF_MS, 'large-PDF backoff is longer than the default');
});

test('near-expiry and soft-grace stay within the inactivity window', () => {
  // The keep-alive math assumes these are smaller than the full inactivity timeout.
  assert.ok(c.CHECKOUT_NEAR_EXPIRY_MS < c.CHECKOUT_INACTIVITY_MS);
  assert.ok(c.CHECKOUT_SOFT_GRACE_MS < c.CHECKOUT_INACTIVITY_MS);
  assert.ok(c.CHECKOUT_KEEPALIVE_MS < c.CHECKOUT_INACTIVITY_MS);
});

const PRESETS = ['#e85447', '#4a9eff', '#e8c547'];

test('nextRecentColors: a preset color is never added to recents', () => {
  assert.deepStrictEqual(c.nextRecentColors([], '#4a9eff', PRESETS), []);
  assert.deepStrictEqual(c.nextRecentColors(['#123456'], '#e85447', PRESETS), ['#123456']);
});

test('nextRecentColors: an off-palette color is unshifted to the front', () => {
  assert.deepStrictEqual(c.nextRecentColors([], '#123456', PRESETS), ['#123456']);
  assert.deepStrictEqual(c.nextRecentColors(['#abcdef'], '#123456', PRESETS), ['#123456', '#abcdef']);
});

test('nextRecentColors: an existing color moves to the front without growing the list', () => {
  assert.deepStrictEqual(
    c.nextRecentColors(['#111111', '#222222', '#333333'], '#333333', PRESETS),
    ['#333333', '#111111', '#222222']
  );
});

test('nextRecentColors: dedupe is case-insensitive and the stored value is lowercased', () => {
  assert.deepStrictEqual(c.nextRecentColors(['#abcdef'], '#ABCDEF', PRESETS), ['#abcdef']);
  assert.deepStrictEqual(c.nextRecentColors([], '#AB12CD', PRESETS), ['#ab12cd']);
});

test('nextRecentColors: caps the list at RECENT_COLORS_MAX, dropping the oldest', () => {
  const max = c.RECENT_COLORS_MAX;
  const full = Array.from({ length: max }, (_, i) => '#0000' + String(i).padStart(2, '0'));
  const out = c.nextRecentColors(full, '#ffffff', PRESETS);
  assert.strictEqual(out.length, max);
  assert.strictEqual(out[0], '#ffffff');
  assert.ok(!out.includes(full[full.length - 1]), 'oldest entry was dropped');
});

test('nextRecentColors: falsy/invalid color returns the list unchanged (capped)', () => {
  assert.deepStrictEqual(c.nextRecentColors(['#123456'], '', PRESETS), ['#123456']);
  assert.deepStrictEqual(c.nextRecentColors(['#123456'], null, PRESETS), ['#123456']);
  assert.deepStrictEqual(c.nextRecentColors(['#123456'], 42, PRESETS), ['#123456']);
});

test('nextRecentColors: tolerates a non-array list and never mutates the input', () => {
  assert.deepStrictEqual(c.nextRecentColors(undefined, '#123456', PRESETS), ['#123456']);
  const input = ['#abcdef'];
  c.nextRecentColors(input, '#123456', PRESETS);
  assert.deepStrictEqual(input, ['#abcdef'], 'input list was not mutated');
});

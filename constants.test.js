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

test('near-expiry and soft-grace stay within the inactivity window', () => {
  // The keep-alive math assumes these are smaller than the full inactivity timeout.
  assert.ok(c.CHECKOUT_NEAR_EXPIRY_MS < c.CHECKOUT_INACTIVITY_MS);
  assert.ok(c.CHECKOUT_SOFT_GRACE_MS < c.CHECKOUT_INACTIVITY_MS);
  assert.ok(c.CHECKOUT_KEEPALIVE_MS < c.CHECKOUT_INACTIVITY_MS);
});

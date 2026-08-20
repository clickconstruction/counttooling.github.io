// Node invariant tests for constants.js.
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
const test = require('node:test');
const assert = require('node:assert');
const c = Object.assign({},
  require('./constants.js'),
  // Split out 2026-07-30 (behavior/build-input, not literals) — the reflective
  // sweeps below still cover the whole family:
  require('./zoom-ladder.js'),
  require('./hotkeys.js'),
  require('./recent-colors.js'),
  require('./recent-drops.js'));

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

// --- nextRecentDrops / formatDropLabel (recent-drops.js) --------------------

test('nextRecentDrops: a used size is unshifted; same value+unit dedupes to the front', () => {
  assert.deepStrictEqual(c.nextRecentDrops([], 3, 'ft'), [{ value: 3, unit: 'ft' }]);
  assert.deepStrictEqual(
    c.nextRecentDrops([{ value: 10, unit: 'ft' }, { value: 3, unit: 'ft' }], 3, 'ft'),
    [{ value: 3, unit: 'ft' }, { value: 10, unit: 'ft' }]
  );
});

test('nextRecentDrops: same value in a different unit is a different drop', () => {
  const out = c.nextRecentDrops([{ value: 3, unit: 'ft' }], 3, 'in');
  assert.deepStrictEqual(out, [{ value: 3, unit: 'in' }, { value: 3, unit: 'ft' }]);
});

test('nextRecentDrops: caps at RECENT_DROPS_MAX, dropping the oldest', () => {
  const max = c.RECENT_DROPS_MAX;
  const full = Array.from({ length: max }, (_, i) => ({ value: i + 1, unit: 'ft' }));
  const out = c.nextRecentDrops(full, 99, 'ft');
  assert.strictEqual(out.length, max);
  assert.deepStrictEqual(out[0], { value: 99, unit: 'ft' });
  assert.ok(!out.some(d => d.value === max), 'oldest entry was dropped');
});

test('nextRecentDrops: non-positive/invalid values and junk entries are ignored', () => {
  assert.deepStrictEqual(c.nextRecentDrops([{ value: 3, unit: 'ft' }], 0, 'ft'), [{ value: 3, unit: 'ft' }]);
  assert.deepStrictEqual(c.nextRecentDrops([{ value: 3, unit: 'ft' }], NaN, 'ft'), [{ value: 3, unit: 'ft' }]);
  assert.deepStrictEqual(c.nextRecentDrops([null, { value: -2, unit: 'ft' }, { value: 3, unit: 'ft' }], 'x', 'ft'), [{ value: 3, unit: 'ft' }]);
  const input = [{ value: 3, unit: 'ft' }];
  c.nextRecentDrops(input, 5, 'ft');
  assert.deepStrictEqual(input, [{ value: 3, unit: 'ft' }], 'input list was not mutated');
});

test('formatDropLabel: whole numbers stay whole, fractions keep up to 2 decimals', () => {
  assert.strictEqual(c.formatDropLabel(3, 'ft'), '3 ft');
  assert.strictEqual(c.formatDropLabel(2.5, 'ft'), '2.5 ft');
  assert.strictEqual(c.formatDropLabel(8.505, 'in'), '8.51 in');
  assert.strictEqual(c.formatDropLabel(0, 'ft'), '');
  assert.strictEqual(c.formatDropLabel(NaN, 'ft'), '');
});

test('nextRecentColors: tolerates a non-array list and never mutates the input', () => {
  assert.deepStrictEqual(c.nextRecentColors(undefined, '#123456', PRESETS), ['#123456']);
  const input = ['#abcdef'];
  c.nextRecentColors(input, '#123456', PRESETS);
  assert.deepStrictEqual(input, ['#abcdef'], 'input list was not mutated');
});

const { ZOOM_LADDER_STEP, snapZoomToRung, nextRungUp, nextRungDown } = c;

test('zoom ladder: snap is idempotent, monotone, clamped; up/down step exactly one rung', () => {
  const lo = 0.2, hi = 4;
  for (const z of [0.2, 0.25, 0.5, 0.83, 1, 1.07, 1.5, 2.2, 3.9, 4]) {
    const r = snapZoomToRung(z, lo, hi);
    assert.ok(r >= lo && r <= hi, 'clamped');
    assert.ok(Math.abs(snapZoomToRung(r, lo, hi) - r) < 1e-12, 'idempotent');
    // r is genuinely a rung: lo * step^n for integer n
    const n = Math.log(r / lo) / Math.log(ZOOM_LADDER_STEP);
    assert.ok(Math.abs(n - Math.round(n)) < 1e-9 || r === hi, 'on the ladder (or the clamped max)');
  }
  // Monotone: snapping preserves order
  assert.ok(snapZoomToRung(1, lo, hi) <= snapZoomToRung(2, lo, hi));
  // up/down from a rung step exactly one rung and invert each other
  const rung = snapZoomToRung(1, lo, hi);
  const up = nextRungUp(rung, lo, hi);
  assert.ok(Math.abs(up / rung - ZOOM_LADDER_STEP) < 1e-9);
  assert.ok(Math.abs(nextRungDown(up, lo, hi) - rung) < 1e-9);
  // from between rungs: up -> the rung above, down -> the rung below
  const mid = rung * 1.07;
  assert.ok(Math.abs(nextRungUp(mid, lo, hi) - up) < 1e-9);
  assert.ok(Math.abs(nextRungDown(mid, lo, hi) - rung) < 1e-9);
  // clamps at the ends
  assert.strictEqual(nextRungDown(lo, lo, hi), lo);
  assert.strictEqual(nextRungUp(hi, lo, hi), hi);
  // degenerate input
  assert.strictEqual(snapZoomToRung(0, lo, hi), lo);
  assert.strictEqual(snapZoomToRung(NaN, lo, hi), lo);
});

test('zoom ladder: the clamp ends behave as rungs (drag-to-max commits max)', () => {
  const lo = 0.2, hi = 4;
  assert.strictEqual(snapZoomToRung(hi, lo, hi), hi);           // exactly max -> max
  assert.strictEqual(snapZoomToRung(3.95, lo, hi), hi);         // near max -> max
  assert.strictEqual(snapZoomToRung(lo, lo, hi), lo);           // exactly min -> min
  const interior = snapZoomToRung(3.5, lo, hi);
  assert.ok(interior < hi, 'well below max stays on an interior rung');
  assert.ok(Math.abs(nextRungDown(hi, lo, hi) - 0.2 * Math.pow(ZOOM_LADDER_STEP, 21)) < 1e-9);
});

test('HOTKEYS: table shape — the handler/docs single source stays executable', () => {
  assert.ok(Array.isArray(c.HOTKEYS) && c.HOTKEYS.length >= 20, 'HOTKEYS present');
  const keys = [];
  for (const h of c.HOTKEYS) {
    assert.strictEqual(typeof h.action, 'string', 'action text');
    assert.ok(h.section === 'Navigation' || h.section === 'Tools', 'known section');
    if (h.bespoke) {
      assert.ok(h.key === undefined, 'bespoke rows carry no runnable key');
      continue;
    }
    assert.match(h.key, /^[a-z]$/, 'runnable key is a single lowercase char');
    keys.push(h.key);
    const ways = [h.btnId, h.runner].filter(Boolean).length;
    assert.strictEqual(ways, 1, `${h.key}: exactly one of btnId/runner`);
  }
  assert.strictEqual(new Set(keys).size, keys.length, 'runnable keys unique');
});

test('takeoff-backup IDB record keys are pinned (restore prompt key-aside)', () => {
  // The held key is a RECORD key in the existing takeoff_backup store (not a
  // store name): the boot key-aside moves a promptable 'local' backup here so
  // no later write can clobber it while the restore prompt is unresolved.
  assert.strictEqual(c.TAKEOFF_BACKUP_HELD_ID, 'local-held');
  // Must never collide with the live local record key.
  assert.notStrictEqual(c.TAKEOFF_BACKUP_HELD_ID, 'local');
});

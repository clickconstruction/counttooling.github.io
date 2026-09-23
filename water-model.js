/*
 * water-model.js - the pure water-supply sizing model (WATER-PLAN.md, rung 1 of
 * the ladder, 2026-09-23): the IPC Appendix E tables as the app will apply
 * them, transcribed here so the rulebook's plumb.wsfu.* and plumb.water.* pages
 * can point at every number (a value here cannot change without its rule,
 * `npm run build:rules --check`), and so a plumber can check the transcription
 * against the book before anything is sized from it.
 *
 *   WSFU_FIXTURES        IPC Table E103.3(2): load values per fixture, private
 *                        and public columns, cold / hot / total WSFU
 *   WSFU_DEMAND          IPC Table E103.3(3): WSFU -> design gpm, the flush-tank
 *                        and flush-valve columns; demandGpm() interpolates
 *   WATER_VELOCITY_CAPS  design practice, not code: the fps a size is capped at
 *                        per side (the S-moment rule of thumb; the pressure and
 *                        developed-length method in Appendix E is Bid Check's)
 *   PIPE_ID_IN           inside diameters by material and nominal size, from the
 *                        ASTM / ASME dimension tables, for velocity = gpm / area
 *   FIXTURE_SUPPLY_MIN_IN  IPC Table 604.5: minimum fixture supply pipe size
 *   WATER_SERVICE_MIN_IN   IPC 603.1: the water service is never under 3/4 in
 *
 * Rung 2 (features/water-fixtures.js) reads WSFU_FIXTURES through wsfuPrefillFor:
 * a counter's name earns its fixture units in the project's occupancy column;
 * rung 3 (the same module) puts a side on a line type, attaches fixtures to the
 * nearest run of that side and walks what each run serves; rung 4 will read the
 * rest for the size suggestion at S. The helpers below are the math those rungs
 * will call, pinned by water-model.test.js against the plan's worked example.
 *
 * No state, no DOM: a classic <script src> after support-model.js, exposed as
 * window.WaterModel, with the guarded CommonJS footer for the node tests and
 * the rulebook's drift check.
 */

// Occupancy picks the column of Table E103.3(2) a fixture reads. It is a
// project-level choice, in Project Settings beside the code editions
// (state.codes.occupancy); public is the default on a commercial bid.
const WATER_OCCUPANCIES = ['public', 'private'];
const WATER_OCCUPANCY_DEFAULT = 'public';
const WATER_SIDES = ['cold', 'hot'];

// DATA TABLE — IPC Table E103.3(2), load values assigned to fixtures, in water
// supply fixture units. A fixture the table lists under one occupancy only
// carries null for the other; wsfuFor() says when it fell back across. The
// table's total is a diversified figure, not cold + hot. `control` is the
// table's "type of supply control" column, kept for the prefill's wording.
const WSFU_FIXTURES = {
  'bathroom-group-tank': { label: 'Bathroom group, flush tank', control: 'flush tank', private: { cold: 2.7, hot: 1.5, total: 3.6 }, public: null },
  'bathroom-group-valve': { label: 'Bathroom group, flush valve', control: 'flush valve', private: { cold: 6, hot: 3, total: 8 }, public: null },
  bathtub: { label: 'Bathtub', control: 'faucet', private: { cold: 1, hot: 1, total: 1.4 }, public: { cold: 3, hot: 3, total: 4 } },
  bidet: { label: 'Bidet', control: 'faucet', private: { cold: 1.5, hot: 1.5, total: 2 }, public: null },
  'combination-fixture': { label: 'Combination fixture', control: 'faucet', private: { cold: 2.25, hot: 2.25, total: 3 }, public: null },
  dishwasher: { label: 'Dishwashing machine', control: 'automatic', private: { cold: 0, hot: 1.4, total: 1.4 }, public: null },
  'drinking-fountain': { label: 'Drinking fountain', control: '3/8 in valve', private: null, public: { cold: 0.25, hot: 0, total: 0.25 } },
  'kitchen-sink': { label: 'Kitchen sink', control: 'faucet', private: { cold: 1, hot: 1, total: 1.4 }, public: { cold: 3, hot: 3, total: 4 } },
  'laundry-tray': { label: 'Laundry trays (1 to 3)', control: 'faucet', private: { cold: 1, hot: 1, total: 1.4 }, public: null },
  lavatory: { label: 'Lavatory', control: 'faucet', private: { cold: 0.5, hot: 0.5, total: 0.7 }, public: { cold: 1.5, hot: 1.5, total: 2 } },
  'service-sink': { label: 'Service sink', control: 'faucet', private: null, public: { cold: 2.25, hot: 2.25, total: 3 } },
  shower: { label: 'Shower head', control: 'mixing valve', private: { cold: 1, hot: 1, total: 1.4 }, public: { cold: 3, hot: 3, total: 4 } },
  'urinal-valve-1in': { label: 'Urinal, 1 in flush valve', control: '1 in flush valve', private: null, public: { cold: 10, hot: 0, total: 10 } },
  'urinal-valve-3-4in': { label: 'Urinal, 3/4 in flush valve', control: '3/4 in flush valve', private: null, public: { cold: 5, hot: 0, total: 5 } },
  'urinal-tank': { label: 'Urinal, flush tank', control: 'flush tank', private: null, public: { cold: 3, hot: 0, total: 3 } },
  'washing-machine-8lb': { label: 'Washing machine (8 lb)', control: 'automatic', private: { cold: 1, hot: 1, total: 1.4 }, public: { cold: 2.25, hot: 2.25, total: 3 } },
  'washing-machine-15lb': { label: 'Washing machine (15 lb)', control: 'automatic', private: null, public: { cold: 3, hot: 3, total: 4 } },
  'water-closet-valve': { label: 'Water closet, flush valve', control: 'flush valve', private: { cold: 6, hot: 0, total: 6 }, public: { cold: 10, hot: 0, total: 10 } },
  'water-closet-tank': { label: 'Water closet, flush tank', control: 'flush tank', private: { cold: 2.2, hot: 0, total: 2.2 }, public: { cold: 5, hot: 0, total: 5 } },
  'water-closet-flushometer-tank': { label: 'Water closet, flushometer tank', control: 'flushometer tank', private: { cold: 2, hot: 0, total: 2 }, public: { cold: 2, hot: 0, total: 2 } },
};
const WSFU_FIXTURE_ORDER = Object.keys(WSFU_FIXTURES);

// The load a fixture carries for an occupancy. When the table lists the fixture
// under the other occupancy only, that column is used and `fallback` says so
// (a drinking fountain in a house is still the table's drinking fountain).
// Unknown fixture: null. The prefill (rung 2) reads this.
function wsfuFor(key, occupancy) {
  const f = WSFU_FIXTURES[key];
  if (!f) return null;
  const occ = WATER_OCCUPANCIES.includes(occupancy) ? occupancy : WATER_OCCUPANCY_DEFAULT;
  const other = occ === 'public' ? 'private' : 'public';
  if (f[occ]) return { key, label: f.label, control: f.control, occupancy: occ, fallback: false, ...f[occ] };
  if (f[other]) return { key, label: f.label, control: f.control, occupancy: other, fallback: true, ...f[other] };
  return null;
}
// Fixture units for a set of { key, qty } — cold, hot and total, and the keys
// the table does not know (a hose bibb, a floor drain, an interceptor), which
// get no load here. A total is the sum of the fixtures' totals, the way the
// method adds them before the demand curve applies the diversity.
function wsfuTotals(items, occupancy) {
  const out = { cold: 0, hot: 0, total: 0, unknown: [] };
  (items || []).forEach((it) => {
    const qty = Number(it && it.qty);
    if (!it || !Number.isFinite(qty) || qty <= 0) return;
    const w = wsfuFor(it.key, occupancy);
    if (!w) { out.unknown.push(it.key); return; }
    out.cold += w.cold * qty; out.hot += w.hot * qty; out.total += w.total * qty;
  });
  out.cold = round2(out.cold); out.hot = round2(out.hot); out.total = round2(out.total);
  return out;
}
// Table E103.3(3) has two columns: a system with any flush valve on it reads the
// flush-valve column (the surges are larger), otherwise the flush-tank column.
function demandColumnFor(items) {
  return (items || []).some((it) => it && Number(it.qty) > 0 && /-valve\b|-valve-/.test(String(it.key))) ? 'flushValve' : 'flushTank';
}

// DATA TABLE — IPC Table E103.3(3), table for estimating demand: [WSFU, gpm]
// rows, the flush-tank and flush-valve columns. The valve column starts at 5
// WSFU and rejoins the tank column above 1,000 WSFU, as the table does.
const WSFU_DEMAND = {
  flushTank: [[1, 3], [2, 5], [3, 6.5], [4, 8], [5, 9.4], [6, 10.7], [7, 11.8], [8, 12.8], [9, 13.7], [10, 14.6], [11, 15.4], [12, 16], [13, 16.5], [14, 17], [15, 17.5], [16, 18], [17, 18.4], [18, 18.8], [19, 19.2], [20, 19.6], [25, 21.5], [30, 23.3], [35, 24.9], [40, 26.3], [45, 27.7], [50, 29.1], [60, 32], [70, 35], [80, 38], [90, 41], [100, 43.5], [120, 48], [140, 52.5], [160, 57], [180, 61], [200, 65], [225, 70], [250, 75], [275, 80], [300, 85], [400, 105], [500, 124], [750, 170], [1000, 208], [1250, 239], [1500, 269], [1750, 297], [2000, 325], [2500, 380], [3000, 433], [4000, 525], [5000, 593]],
  flushValve: [[5, 15], [6, 17.4], [7, 19.8], [8, 22.2], [9, 24.6], [10, 27], [11, 27.8], [12, 28.6], [13, 29.4], [14, 30.2], [15, 31], [16, 31.8], [17, 32.6], [18, 33.4], [19, 34.2], [20, 35], [25, 38], [30, 42], [35, 44], [40, 46], [45, 48], [50, 50], [60, 54], [70, 58], [80, 61.2], [90, 64.3], [100, 67.5], [120, 73], [140, 77], [160, 81], [180, 85.5], [200, 90], [225, 95.5], [250, 101], [275, 104.5], [300, 108], [400, 127], [500, 143], [750, 177], [1000, 208]],
};
// Design flow in gpm for a load, read off the column with straight-line
// interpolation between the table's rows (the table's own note). Under the
// column's first row the flow scales from zero to that row (a lone private
// lavatory at 0.7 WSFU reads about 2 gpm, never the 3 gpm of a full unit); a
// flush-valve load under 5 WSFU reads the tank column, which is where the
// valve column meets it; past the last row the last value holds. To 0.1 gpm.
function demandGpm(wsfu, column) {
  const w = Number(wsfu);
  if (!Number.isFinite(w) || w <= 0) return 0;
  let rows = WSFU_DEMAND[column === 'flushValve' ? 'flushValve' : 'flushTank'];
  if (column === 'flushValve' && w < rows[0][0]) rows = WSFU_DEMAND.flushTank;
  if (column === 'flushValve' && w > rows[rows.length - 1][0]) rows = WSFU_DEMAND.flushTank;
  if (w <= rows[0][0]) return round1(rows[0][1] * (w / rows[0][0]));
  for (let i = 1; i < rows.length; i++) {
    const [w0, g0] = rows[i - 1], [w1, g1] = rows[i];
    if (w <= w1) return round1(g0 + (g1 - g0) * ((w - w0) / (w1 - w0)));
  }
  return round1(rows[rows.length - 1][1]);
}

// DATA TABLE — design practice, not code: the velocity a size suggestion is
// capped at, per side. Hot water is held slower because copper erodes and PEX
// fittings wear at speed in hot lines; cold runs faster. Both are knobs the
// schedule will carry per project (rung 5), stamped "practice, not code".
const WATER_VELOCITY_CAPS = { cold: 8, hot: 5 };

// DATA TABLE — inside diameters in inches by material and nominal size, from
// the dimension tables the materials are made to. `sizes` is keyed by the
// trade size as it is spoken (the Quick Line's own words), in ascending order.
const PIPE_ID_IN = {
  pex: { label: 'PEX, CTS SDR 9', standard: 'ASTM F876', sizes: { '3/8': 0.35, '1/2': 0.475, '3/4': 0.671, '1': 0.862, '1-1/4': 1.054, '1-1/2': 1.244, '2': 1.629 } },
  copper: { label: 'copper tube, Type L', standard: 'ASTM B88', sizes: { '3/8': 0.43, '1/2': 0.545, '3/4': 0.785, '1': 1.025, '1-1/4': 1.265, '1-1/2': 1.505, '2': 1.985, '2-1/2': 2.465, '3': 2.945 } },
  cpvc: { label: 'CPVC, CTS SDR 11', standard: 'ASTM D2846', sizes: { '1/2': 0.489, '3/4': 0.715, '1': 0.921, '1-1/4': 1.125, '1-1/2': 1.329, '2': 1.739 } },
  galvanized: { label: 'galvanized steel, Schedule 40', standard: 'ASME B36.10', sizes: { '1/2': 0.622, '3/4': 0.824, '1': 1.049, '1-1/4': 1.38, '1-1/2': 1.61, '2': 2.067, '2-1/2': 2.469, '3': 3.068 } },
};
const WATER_MATERIAL_ORDER = ['pex', 'copper', 'cpvc', 'galvanized'];

// A nominal size as a number ↔ the spoken key ("1-1/4"), the sizes the tables carry.
const SIZE_KEYS = { 0.375: '3/8', 0.5: '1/2', 0.75: '3/4', 1: '1', 1.25: '1-1/4', 1.5: '1-1/2', 2: '2', 2.5: '2-1/2', 3: '3', 4: '4' };
function sizeKey(sizeIn) {
  const v = Number(sizeIn);
  return SIZE_KEYS[Math.round(v * 1000) / 1000] || (Number.isFinite(v) && v > 0 ? String(v) : null);
}
function sizeKeyIn(key) {
  const k = String(key || '').trim();
  const found = Object.keys(SIZE_KEYS).find((n) => SIZE_KEYS[n] === k);
  if (found != null) return Number(found);
  const v = Number(k);
  return Number.isFinite(v) && v > 0 ? v : null;
}
function pipeIdIn(material, sizeIn) {
  const m = PIPE_ID_IN[material];
  if (!m) return null;
  const id = m.sizes[sizeKey(sizeIn)];
  return typeof id === 'number' ? id : null;
}
function pipeSizesIn(material) {
  const m = PIPE_ID_IN[material];
  // Sorted: an object lists its integer-like keys ("1", "2") before the fractions.
  return m ? Object.keys(m.sizes).map(sizeKeyIn).sort((a, b) => a - b) : [];
}
// Velocity in feet per second: gpm through a round bore of the given inside
// diameter (gal/min ÷ 448.83 → ft³/s, over π d² / 4 in² ÷ 144 → ft²).
function velocityFps(gpm, idIn) {
  const q = Number(gpm), d = Number(idIn);
  if (!Number.isFinite(q) || !Number.isFinite(d) || d <= 0) return null;
  return 0.408498 * q / (d * d);
}
// The size an experienced estimator would pencil in: the smallest nominal size
// of the material whose velocity at the design flow stays under the side's cap
// (and not under a fixture's minimum supply, when one is given). When no size
// passes, the largest is returned with ok false so the caller can warn.
function suggestWaterSize(opts) {
  const o = opts || {};
  const material = PIPE_ID_IN[o.material] ? o.material : 'pex';
  const side = WATER_SIDES.includes(o.side) ? o.side : 'cold';
  const cap = Number.isFinite(Number(o.capFps)) && Number(o.capFps) > 0 ? Number(o.capFps) : WATER_VELOCITY_CAPS[side];
  const gpm = Number(o.gpm) || 0;
  const minIn = Number(o.minSizeIn) || 0;
  const sizes = pipeSizesIn(material).filter((s) => s >= minIn);
  let last = null;
  for (const sizeIn of sizes) {
    const id = pipeIdIn(material, sizeIn);
    const v = velocityFps(gpm, id);
    last = { material, side, sizeIn, key: sizeKey(sizeIn), idIn: id, gpm, velocityFps: round1(v), capFps: cap, ok: v <= cap };
    if (last.ok) return last;
  }
  return last;
}

// DATA TABLE — IPC Table 604.5, minimum sizes of fixture water supply pipes, in
// inches. Keyed like WSFU_FIXTURES where the fixture is the same; the table's
// own extra rows (hose bibb, flushing-rim sink, wall hydrant, one-piece water
// closet) keep their names. Both urinal flush valves read the one row.
const FIXTURE_SUPPLY_MIN_IN = {
  bathtub: 0.5, bidet: 0.375, 'combination-fixture': 0.5, dishwasher: 0.5, 'drinking-fountain': 0.375, 'hose-bibb': 0.5,
  'kitchen-sink': 0.5, 'laundry-tray': 0.5, lavatory: 0.375, shower: 0.5, 'sink-flushing-rim': 0.75, 'service-sink': 0.5,
  'urinal-tank': 0.5, 'urinal-valve': 0.75, 'wall-hydrant': 0.5, 'water-closet-tank': 0.375, 'water-closet-valve': 1,
  'water-closet-flushometer-tank': 0.375, 'water-closet-one-piece': 0.5,
};
function fixtureSupplyMinIn(key) {
  const k = /^urinal-valve/.test(String(key)) ? 'urinal-valve' : String(key);
  const v = FIXTURE_SUPPLY_MIN_IN[k];
  return typeof v === 'number' ? v : null;
}
function fixtureSupplyMinLabel(key) {
  const v = fixtureSupplyMinIn(key);
  return v == null ? null : sizeKey(v);
}
// IPC 603.1: the water service pipe is never smaller than 3/4 inch.
const WATER_SERVICE_MIN_IN = 0.75;

// --- Rung 2: fixture units on counters ------------------------------------------
// The rule the prefill is stamped with (content/rules/plumbing/water-fixture-units.md).
const WSFU_RULE_ID = 'plumb.wsfu.fixtures';

// The fixture a counter's name declares, or null. Word-bounded over the name in
// lower case, the way support-model reads a material off a line type: the tag
// prefixes the schedule reader writes ("WC-1 Water Closet", "L-1 Lavatory",
// "HS-1 Hand Sink", "MS-1 Mop Sink", "3CS-1 3-Compartment Sink") and the bare
// tags ("WC", "LAV", "UR", "DF") both read. The things a plumbing takeoff counts
// that draw no supply (a floor drain, a floor sink, a cleanout, a trap primer, a
// water heater, an interceptor) and the continuous demands the method leaves out
// (a hose bibb, a wall hydrant) read as null on purpose: no prefill, no chip.
// A water closet or urinal whose name does not say tank or valve is assumed a
// flush valve on a public bid and a flush tank in a house, and `match` says so.
function wsfuFixtureFromName(name, occupancy) {
  const n = ' ' + String(name || '').toLowerCase().replace(/[_/,()]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const occ = occupancy === 'private' ? 'private' : 'public';
  const has = (re) => re.test(n);
  // Not a supply fixture, or a continuous demand: never a prefill.
  if (has(/\b(floor sink|fs-?\d*|floor drain|fd-?\d*|drain|cleanout|clean out|c\.?o\.?-?\d*|trap primer|water heater|wh-?\d*|heater|interceptor|grease|hose ?bibb?|hb-?\d*|wall hydrant|hydrant|vtr|vent|backflow|rpz|meter|valve|shut-?off|pump|expansion)\b/) && !has(/\bflush ?valve\b|\bfv\b/)) return null;
  const flushValve = has(/\bflush ?valve\b|\bf\.?v\.?\b|\bflushometer\b(?! ?tank)/);
  const flushTank = has(/\bflush ?tank\b|\btank\b/);
  const flushometerTank = has(/\bflushometer ?tank\b/);
  if (has(/\bbathroom group\b|\bbath group\b/)) return { key: flushValve ? 'bathroom-group-valve' : 'bathroom-group-tank', match: 'bathroom group' + (flushValve ? ', flush valve' : ', flush tank') };
  if (has(/\bwater ?closet\b|\bw\.?c\.?-?\d*\b|\btoilet\b/)) {
    if (flushometerTank) return { key: 'water-closet-flushometer-tank', match: 'water closet, flushometer tank' };
    if (flushTank) return { key: 'water-closet-tank', match: 'water closet, flush tank' };
    if (flushValve) return { key: 'water-closet-valve', match: 'water closet, flush valve' };
    return occ === 'private'
      ? { key: 'water-closet-tank', match: 'water closet, flush tank assumed (say valve in the name to change)' }
      : { key: 'water-closet-valve', match: 'water closet, flush valve assumed (say tank in the name to change)' };
  }
  if (has(/\burinal\b|\bur-?\d*\b|\bu-\d+\b/)) {
    if (flushTank) return { key: 'urinal-tank', match: 'urinal, flush tank' };
    if (has(/\b1 ?(in|inch|")\b|\b1"/)) return { key: 'urinal-valve-1in', match: 'urinal, 1 in flush valve' };
    return { key: 'urinal-valve-3-4in', match: flushValve ? 'urinal, 3/4 in flush valve' : 'urinal, 3/4 in flush valve assumed' };
  }
  if (has(/\blavatory\b|\blav-?\d*\b|\bl-\d+\b|\bhand ?sink\b|\bhs-?\d*\b|\bwash ?basin\b|\bbasin\b/)) return { key: 'lavatory', match: has(/hand ?sink|\bhs/) ? 'hand sink, read as a lavatory' : 'lavatory' };
  if (has(/\bmop ?sink\b|\bservice ?sink\b|\bjanitor\b|\bms-?\d*\b|\bslop ?sink\b/)) return { key: 'service-sink', match: 'service sink' };
  if (has(/\bdish ?washer\b|\bdw-?\d*\b|\bdish ?machine\b/)) return { key: 'dishwasher', match: 'dishwashing machine' };
  if (has(/\bdrinking ?fountain\b|\bdf-?\d*\b|\bewc\b|\bwater ?cooler\b|\bbottle ?fill/)) return { key: 'drinking-fountain', match: 'drinking fountain' };
  if (has(/\blaundry ?(tray|sink|tub)\b|\blt-?\d*\b/)) return { key: 'laundry-tray', match: 'laundry tray' };
  if (has(/\bwashing ?machine\b|\bclothes ?washer\b|\bwasher\b|\bwm-?\d*\b/)) return has(/\b15 ?lb\b|\bcommercial\b/) ? { key: 'washing-machine-15lb', match: 'washing machine, 15 lb' } : { key: 'washing-machine-8lb', match: 'washing machine, 8 lb' };
  if (has(/\bbidet\b/)) return { key: 'bidet', match: 'bidet' };
  if (has(/\bbath ?tub\b|\btub\b/)) return { key: 'bathtub', match: 'bathtub' };
  if (has(/\bshower\b|\bsh-?\d*\b/)) return { key: 'shower', match: 'shower head' };
  if (has(/\bsink\b|\bscullery\b|\bcs-?\d*\b|\bks-?\d*\b/)) return { key: 'kitchen-sink', match: has(/\d ?-? ?comp/) ? 'compartment sink, read as a kitchen sink' : 'kitchen sink' };
  return null;
}
// The prefill a counter's name earns for the project's occupancy: the table row
// plus the rule id and the words the chip shows. Null when the name declares no
// supply fixture.
function wsfuPrefillFor(name, occupancy) {
  const f = wsfuFixtureFromName(name, occupancy);
  if (!f) return null;
  const w = wsfuFor(f.key, occupancy);
  if (!w) return null;
  return { ...w, match: f.match, ruleId: WSFU_RULE_ID };
}
// A counter's fixture units: `wsfu` when it carries one (> 0), else null.
// `wsfuFixture` (the table key the prefill came from, kept when the value was
// accepted) lets the later rungs split a typed total into cold and hot.
function counterWsfu(counter) {
  const v = counter ? Number(counter.wsfu) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}
// THE per-mark rule, the twin of duct-model's ductMarkerCfm: a positive
// `wsfuOverride` on the placed mark wins, else the counter's, else null.
function markerWsfu(marker, counter) {
  const o = marker ? Number(marker.wsfuOverride) : NaN;
  if (Number.isFinite(o) && o > 0) return o;
  return counterWsfu(counter);
}
// The cold / hot split of a counter's total: the table's proportions for its
// fixture when one is known (a typed-over total keeps the fixture's shape);
// null when the counter has no fixture key.
function counterWsfuSplit(counter, occupancy) {
  const total = counterWsfu(counter);
  if (total == null) return null;
  const w = counter.wsfuFixture ? wsfuFor(counter.wsfuFixture, occupancy) : null;
  if (!w || !(w.total > 0)) return null;
  return { cold: round2(total * w.cold / w.total), hot: round2(total * w.hot / w.total), total };
}

// --- Rung 3: water side on line types, attachment, the served walk -----------------
// The two sides, and the colors the pickers and the legend use for them (the
// leaders wear their run's own color). Cold reads blue and hot red on the plan.
const WATER_SIDE_COLORS = { cold: '#2e86de', hot: '#e85447' };
// The side a line type's name declares: CW / DCW / cold → cold; HW / DHW / HWR /
// hot / recirc → hot; nothing → null. Word-bounded, like the material read.
function waterSideFromName(name) {
  const n = ' ' + String(name || '').toLowerCase().replace(/[_/,()]+/g, ' ') + ' ';
  if (/\b(hw|hwr|hws|dhw|dhwr|hot|h\.w\.|recirc|recirculation)\b/.test(n)) return 'hot';
  if (/\b(cw|dcw|cold|c\.w\.)\b/.test(n)) return 'cold';
  return null;
}
// THE per-type rule: an explicit `waterSide` ('cold' | 'hot' | 'none') wins,
// else the name decides. A type with no side is what it is today: pipe.
function lineTypeWaterSide(lt) {
  if (!lt) return null;
  if (lt.waterSide === 'cold' || lt.waterSide === 'hot') return lt.waterSide;
  if (lt.waterSide === 'none') return null;
  return waterSideFromName(lt.name);
}
// A run's vertices in PDF space: a polyline's points, a quick line's two ends.
function waterRunVertices(item, isPoly) {
  if (!item) return [];
  if (isPoly) return Array.isArray(item.points) ? item.points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
  return [Number.isFinite(item.x1) && Number.isFinite(item.y1) ? { x: item.x1, y: item.y1 } : null, Number.isFinite(item.x2) && Number.isFinite(item.y2) ? { x: item.x2, y: item.y2 } : null].filter(Boolean);
}
// The water runs on a canvas: every quick line and polyline whose type has a
// side and which has two or more vertices, as { id, side, vertices, lineTypeId,
// item, isPoly, color }. Runs whose type has no side are not water.
function waterRunsOf(ann, lineTypes) {
  const byId = new Map((lineTypes || []).map((lt) => [lt.id, lt]));
  const out = [];
  const add = (item, isPoly) => {
    const lt = byId.get(item && item.lineTypeId);
    const side = lineTypeWaterSide(lt);
    if (!side) return;
    const vertices = waterRunVertices(item, isPoly);
    if (vertices.length < 2) return;
    // A run with no length (two clicks on one point) is not pipe and would sit
    // on whatever it was clicked on as a branch of it.
    if (!vertices.some((v, i) => i > 0 && (v.x !== vertices[0].x || v.y !== vertices[0].y))) return;
    out.push({ id: item.id, side, vertices, lineTypeId: lt.id, item, isPoly, color: item.color || lt.color || WATER_SIDE_COLORS[side] });
  };
  ((ann && ann.quickLines) || []).forEach((q) => add(q, false));
  ((ann && ann.polylines) || []).forEach((p) => add(p, true));
  return out;
}
// Nearest point on a run: { dist, s, point } (duct-model's walk, kept local so
// this module needs no other).
function waterNearestOnRun(p, verts) {
  let best = { dist: Infinity, s: 0, point: null };
  let acc = 0;
  for (let i = 0; i < (verts ? verts.length : 0) - 1; i++) {
    const a = verts[i], b = verts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    const fx = a.x + t * dx, fy = a.y + t * dy;
    const d = Math.hypot(p.x - fx, p.y - fy);
    const segLen = Math.sqrt(len2);
    if (d < best.dist) best = { dist: d, s: acc + t * segLen, point: { x: fx, y: fy } };
    acc += segLen;
  }
  return best;
}
// The attachment rule. A fixture sits on the floor and its pipe runs in the
// wall, so the snap is twice the duct tap's: 24 pt is 2'-8" at 1/8" = 1'-0".
const WATER_ATTACH_SNAP_PDF = 24;
// The rescue looks further, but never across the sheet.
const WATER_ATTACH_SEARCH_PDF = 96;
// Fixtures attach PER SIDE: a lavatory joins the nearest cold run and the
// nearest hot run; a water closet the nearest cold run only. fixtures =
// [{ x, y, cold, hot, links? }] where `links` ({ cold: runId, hot: runId }) is
// the rescue's stored answer and wins over proximity while that run exists.
// Returns { attached: [{ fixture, side, runId, s, dist, point, explicit }],
// strays: [{ fixture, side }] } — a stray is a side with load and no run.
function attachWaterFixtures(fixtures, runs, opts) {
  const snap = opts && opts.snapDist > 0 ? opts.snapDist : WATER_ATTACH_SNAP_PDF;
  const list = (runs || []).filter((r) => r && (r.vertices ? r.vertices.length : 0) >= 2);
  const attached = [], strays = [];
  (fixtures || []).forEach((f) => {
    if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.y)) return;
    WATER_SIDES.forEach((side) => {
      if (!(Number(f[side]) > 0)) return;
      const linkId = f.links && f.links[side];
      const linked = linkId ? list.find((r) => r.id === linkId && r.side === side) : null;
      if (linked) {
        const hit = waterNearestOnRun(f, linked.vertices);
        attached.push({ fixture: f, side, runId: linked.id, s: hit.s, dist: hit.dist, point: hit.point, explicit: true });
        return;
      }
      let best = null;
      list.forEach((run) => {
        if (run.side !== side) return;
        const hit = waterNearestOnRun(f, run.vertices);
        if (hit.dist <= snap && (!best || hit.dist < best.dist)) best = { fixture: f, side, runId: run.id, s: hit.s, dist: hit.dist, point: hit.point, explicit: false };
      });
      if (best) attached.push(best);
      else strays.push({ fixture: f, side });
    });
  });
  return { attached, strays };
}
// The leaders: one dashed tie per attached side, from the mark to the point on
// the run that serves it; a zero-length tie is dropped.
function waterFixtureLeaders(fixtures, runs, opts) {
  const { attached } = attachWaterFixtures(fixtures, runs, opts);
  const out = [];
  attached.forEach((a) => {
    if (!a.point) return;
    const from = { x: a.fixture.x, y: a.fixture.y };
    if (Math.hypot(a.point.x - from.x, a.point.y - from.y) < 0.5) return;
    out.push({ fixture: a.fixture, side: a.side, runId: a.runId, from, to: { x: a.point.x, y: a.point.y }, dist: a.dist, explicit: a.explicit });
  });
  return out;
}
// The rescue's target: the nearest run of a side within the search distance.
function waterNearestRunPoint(fixture, runs, side, opts) {
  const search = opts && opts.searchDist > 0 ? opts.searchDist : WATER_ATTACH_SEARCH_PDF;
  if (!fixture || !Number.isFinite(fixture.x) || !Number.isFinite(fixture.y)) return null;
  let best = null;
  (runs || []).forEach((run) => {
    if (!run || run.side !== side || (run.vertices ? run.vertices.length : 0) < 2) return;
    const hit = waterNearestOnRun(fixture, run.vertices);
    if (hit.point && hit.dist <= search && (!best || hit.dist < best.dist)) best = { runId: run.id, point: hit.point, dist: hit.dist, run };
  });
  return best;
}
// Branches: a run whose FIRST vertex lands within snap of another run of the
// same side is that parent's child (the tap precedent). Nearest parent wins.
function waterChildLinks(runs, opts) {
  const snap = opts && opts.snapDist > 0 ? opts.snapDist : WATER_ATTACH_SNAP_PDF;
  const list = (runs || []).filter((r) => r && (r.vertices ? r.vertices.length : 0) >= 2);
  const out = [];
  list.forEach((child) => {
    const start = child.vertices[0];
    let best = null;
    list.forEach((parent) => {
      if (parent === child || parent.id === child.id || parent.side !== child.side) return;
      const hit = waterNearestOnRun(start, parent.vertices);
      if (hit.dist <= snap && (!best || hit.dist < best.dist)) best = { childId: child.id, parentId: parent.id, s: hit.s, dist: hit.dist };
    });
    if (best) out.push({ childId: best.childId, parentId: best.parentId, s: best.s });
  });
  return out;
}
// What each run serves: its own attached fixtures' units on its side, plus
// everything its branches serve. Returns a Map runId → { side, own, served,
// ownCount, servedCount, children: [ids] }. A cycle (two runs starting on each
// other) is walked once.
function waterServedByRun(fixtures, runs, opts) {
  const { attached } = attachWaterFixtures(fixtures, runs, opts);
  const links = waterChildLinks(runs, opts);
  const out = new Map();
  (runs || []).forEach((r) => { if (r && r.id) out.set(r.id, { side: r.side, own: 0, served: 0, ownCount: 0, servedCount: 0, children: [] }); });
  attached.forEach((a) => {
    const row = out.get(a.runId);
    if (!row) return;
    row.own += Number(a.fixture[a.side]) || 0;
    row.ownCount += 1;
  });
  links.forEach((l) => { const p = out.get(l.parentId); if (p && !p.children.includes(l.childId)) p.children.push(l.childId); });
  const memo = new Map();
  const walk = (id, stack) => {
    if (memo.has(id)) return memo.get(id);
    const row = out.get(id);
    if (!row) return { wsfu: 0, count: 0 };
    if (stack.has(id)) return { wsfu: 0, count: 0 };
    stack.add(id);
    let wsfu = row.own, count = row.ownCount;
    row.children.forEach((c) => { const r = walk(c, stack); wsfu += r.wsfu; count += r.count; });
    stack.delete(id);
    const res = { wsfu: round2(wsfu), count };
    memo.set(id, res);
    return res;
  };
  out.forEach((row, id) => { const r = walk(id, new Set()); row.served = r.wsfu; row.servedCount = r.count; row.own = round2(row.own); });
  return out;
}

// --- Rung 4: the moment at S -----------------------------------------------------
// The material a line type's name declares, in PIPE_ID_IN's terms, or null.
// CPVC before copper and PVC (support-model reads "CPVC" as no material on
// purpose; here it is a bore). Galvanized steel by galv / GI / steel.
function waterMaterialFromName(name) {
  const n = ' ' + String(name || '').toLowerCase().replace(/[_/,()]+/g, ' ') + ' ';
  if (/\bcpvc\b/.test(n)) return 'cpvc';
  if (/\bpex(-al-pex)?\b/.test(n)) return 'pex';
  if (/\b(copper|cu|type\s?[klm])\b/.test(n)) return 'copper';
  if (/\b(galv|galvanized|galvanised|g\.?i\.?|steel|black\s?iron|\bbi\b)\b/.test(n)) return 'galvanized';
  return null;
}
// The trade size a line type's name declares, in inches (the support model's
// read: "1.5in", '3/4"', "1-1/4 in"), or null.
function waterSizeInFromName(name) {
  const m = /(\d+\s*-\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*(?:in\b|inch(?:es)?\b|"|″|”)/i.exec(String(name || ''));
  if (!m) return null;
  const t = m[1].replace(/\s+/g, '');
  let v;
  if (/^\d+-\d+\/\d+$/.test(t)) { const [w, f] = t.split('-'); const [a, b] = f.split('/'); v = Number(w) + Number(a) / Number(b); }
  else if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split('/'); v = Number(a) / Number(b); }
  else v = Number(t);
  return Number.isFinite(v) && v > 0 ? v : null;
}
// The name of the same type at another size: the size token replaced in the
// style the name used ("1.5in Copper CW" → "0.75in Copper CW", '3/4" PEX HW' →
// '1/2" PEX HW'); a name with no size gets one in front.
function sizedTypeName(name, sizeIn) {
  const key = sizeKey(sizeIn);
  if (!key) return String(name || '');
  const src = String(name || '');
  const re = /(\d+\s*-\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)(\s*)(in\b|inch(?:es)?\b|"|″|”)/i;
  const m = re.exec(src);
  if (!m) return key + 'in ' + src;
  const decimal = /^\d+(\.\d+)?$/.test(m[1].trim()) && !/\//.test(m[1]);
  const num = decimal ? String(Math.round(Number(sizeIn) * 1000) / 1000) : key;
  return src.slice(0, m.index) + num + m[2] + m[3] + src.slice(m.index + m[0].length);
}
// What the run being traced still has to serve on its side, the ductulator's
// "air still to serve" in fixture units: every fixture of the side that no
// COMMITTED run of the side serves is assumed downstream of this trace, less
// those the trace has already passed (attached to the draft strictly behind
// its tip). A fixture the tip has just reached is still ahead. The draft's
// placed vertices only: the number changes on clicks, not on every hover.
// opts: { runs (committed water runs), draft: { id?, side, vertices }, fixtures, snapDist? }
// Returns { wsfu, totalWsfu, servedWsfu, ahead: [fixture], column } or null
// when nothing on the side is unserved.
function waterDraftRemaining(opts) {
  const o = opts || {};
  const draft = o.draft;
  if (!draft || !WATER_SIDES.includes(draft.side)) return null;
  const EPS = 1e-6;
  const side = draft.side;
  const verts = (draft.vertices || []).filter((v) => v && Number.isFinite(v.x) && Number.isFinite(v.y));
  const draftRun = { id: draft.id || '__draft__', side, vertices: verts };
  const committed = (o.runs || []).filter((r) => r && r.side === side && (r.vertices ? r.vertices.length : 0) >= 2);
  const all = verts.length >= 2 ? committed.concat([draftRun]) : committed;
  const fixtures = (o.fixtures || []).filter((f) => f && Number(f[side]) > 0);
  if (!fixtures.length) return null;
  const { attached, strays } = attachWaterFixtures(fixtures, all, o);
  const tipLen = waterNearestOnRun(verts[verts.length - 1] || { x: 0, y: 0 }, verts).s;
  let totalWsfu = 0, servedWsfu = 0;
  const ahead = [];
  attached.forEach((a) => {
    if (a.side !== side) return;
    if (a.runId !== draftRun.id) return;   // a committed run of the side serves it: not this trace's load
    totalWsfu += Number(a.fixture[side]) || 0;
    if (a.s < tipLen - EPS) servedWsfu += Number(a.fixture[side]) || 0;   // passed by the trace
    else ahead.push(a.fixture);
  });
  strays.forEach((st) => {
    if (st.side !== side) return;
    totalWsfu += Number(st.fixture[side]) || 0;   // unserved: assumed ahead of this trace
    ahead.push(st.fixture);
  });
  if (!(totalWsfu > 0)) return null;
  const column = demandColumnFor(ahead.map((f) => ({ key: f.fixtureKey, qty: 1 })));
  return { wsfu: round2(totalWsfu - servedWsfu), totalWsfu: round2(totalWsfu), servedWsfu: round2(servedWsfu), ahead, column, side };
}
// The suggestion for a trace: fixture units ahead → design gpm on the set's
// curve → the smallest size of the material under the side's cap. `material`
// null reads as copper Type L and says so. Returns null when nothing is ahead.
function waterDraftSuggestion(opts) {
  const o = opts || {};
  const rem = o.remaining;
  if (!rem || !(rem.wsfu > 0)) return null;
  const material = PIPE_ID_IN[o.material] ? o.material : 'copper';
  const materialAssumed = !PIPE_ID_IN[o.material];
  const gpm = demandGpm(rem.wsfu, rem.column);
  const pick = suggestWaterSize({ gpm, side: rem.side, material, capFps: o.capFps });
  if (!pick) return null;
  const cap = pick.capFps;
  const sizeLabel = pick.key + ' in';
  const chipText = sizeLabel + ' suggested · ' + fmtWsfu(rem.wsfu) + ' WSFU still to serve · ' + pick.velocityFps + ' ft/s' + (pick.ok ? '' : ', over ' + cap) + (materialAssumed ? ' as copper' : '') + ' · S accepts';
  return { wsfu: rem.wsfu, gpm, column: rem.column, side: rem.side, material, materialAssumed, sizeIn: pick.sizeIn, key: pick.key, velocityFps: pick.velocityFps, capFps: cap, ok: pick.ok, sizeLabel, chipText };
}
// Every size of a material with its velocity at a flow, for the popover's row.
function waterSizeOptions(gpm, side, material) {
  const m = PIPE_ID_IN[material] ? material : 'copper';
  const cap = WATER_VELOCITY_CAPS[WATER_SIDES.includes(side) ? side : 'cold'];
  return pipeSizesIn(m).map((sizeIn) => {
    const v = velocityFps(gpm, pipeIdIn(m, sizeIn));
    return { sizeIn, key: sizeKey(sizeIn), velocityFps: round1(v), ok: v <= cap, capFps: cap };
  });
}
function fmtWsfu(v) { return String(Math.round(v * 100) / 100); }

function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return Math.round(v * 100) / 100; }

const WATER_MODEL_API = {
  WATER_OCCUPANCIES, WATER_OCCUPANCY_DEFAULT, WATER_SIDES,
  WSFU_FIXTURES, WSFU_FIXTURE_ORDER, wsfuFor, wsfuTotals, demandColumnFor,
  WSFU_DEMAND, demandGpm,
  WATER_VELOCITY_CAPS,
  PIPE_ID_IN, WATER_MATERIAL_ORDER, sizeKey, sizeKeyIn, pipeIdIn, pipeSizesIn, velocityFps, suggestWaterSize,
  FIXTURE_SUPPLY_MIN_IN, fixtureSupplyMinIn, fixtureSupplyMinLabel, WATER_SERVICE_MIN_IN,
  WSFU_RULE_ID, wsfuFixtureFromName, wsfuPrefillFor, counterWsfu, markerWsfu, counterWsfuSplit,
  WATER_SIDE_COLORS, WATER_ATTACH_SNAP_PDF, WATER_ATTACH_SEARCH_PDF, waterSideFromName, lineTypeWaterSide, waterRunVertices, waterRunsOf,
  waterNearestOnRun, attachWaterFixtures, waterFixtureLeaders, waterNearestRunPoint, waterChildLinks, waterServedByRun,
  waterMaterialFromName, waterSizeInFromName, sizedTypeName, waterDraftRemaining, waterDraftSuggestion, waterSizeOptions,
};
if (typeof window !== 'undefined') window.WaterModel = WATER_MODEL_API;
// Node test harness and the rulebook's drift check only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = WATER_MODEL_API;

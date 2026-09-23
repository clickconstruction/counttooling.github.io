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
 * rung 4 will read the rest for the size suggestion at S. The helpers below are the math those rungs
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
};
if (typeof window !== 'undefined') window.WaterModel = WATER_MODEL_API;
// Node test harness and the rulebook's drift check only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = WATER_MODEL_API;

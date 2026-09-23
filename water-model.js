/*
 * water-model.js - the pure water-sizing model (WATER-PLAN.md rung 1, 2026-09-23):
 * the IPC Appendix E tables as the app applies them, so a fixture's water supply
 * fixture units, the demand curve behind every size suggestion, the velocity cap
 * per side, the inside diameters the velocity is computed from, and the fixture
 * supply minimums all live in one place the rulebook points at
 * (content/rules/plumbing/water-*.md and wsfu-*.md carry a `code:` pointer per
 * value, so a number here cannot change without its rule; `npm run build:rules
 * --check` says which one drifted).
 *
 * Rung 1 is the tables and the arithmetic over them. The counter's WSFU field
 * (rung 2), the water side on line types and the attachment (rung 3), the S
 * moment (rung 4), the schedule (rung 5) and the Bid Check rows (rung 6) read
 * from here; nothing here reads state.
 *
 * No state, no DOM: a classic <script src> loaded after support-model.js,
 * top-level declarations in the shared global lexical scope, exposed as
 * window.WaterModel (features read it at call time) with the guarded CommonJS
 * footer so water-model.test.js and the rulebook's drift check can require() it.
 */

// DATA TABLE — load values assigned to fixtures, in water supply fixture units
// (IPC Table E103.3(2)): per fixture, the occupancy column the code prints it in
// (the code's "Offices, etc." and "Hotel, restaurant" rows are the public
// column here), then the supply control, then cold / hot / total. A fixture with
// no hot connection carries hot 0. `total` is the code's own combined figure,
// not the sum of the two sides.
const WSFU_LOADS = {
  'bathroom-group': { label: 'Bathroom group', private: { 'flush-tank': { cold: 2.7, hot: 1.5, total: 3.6 }, 'flush-valve': { cold: 6, hot: 3, total: 8 } } },
  bathtub: { label: 'Bathtub', private: { faucet: { cold: 1, hot: 1, total: 1.4 } }, public: { faucet: { cold: 3, hot: 3, total: 4 } } },
  bidet: { label: 'Bidet', private: { faucet: { cold: 1.5, hot: 1.5, total: 2 } } },
  'combination-fixture': { label: 'Combination fixture', private: { faucet: { cold: 2.25, hot: 2.25, total: 3 } } },
  dishwasher: { label: 'Dishwashing machine', private: { automatic: { cold: 0, hot: 1.4, total: 1.4 } } },
  'drinking-fountain': { label: 'Drinking fountain', public: { 'valve-3/8': { cold: 0.25, hot: 0, total: 0.25 } } },
  'kitchen-sink': { label: 'Kitchen sink', private: { faucet: { cold: 1, hot: 1, total: 1.4 } }, public: { faucet: { cold: 3, hot: 3, total: 4 } } },
  'laundry-tray': { label: 'Laundry trays (1 to 3)', private: { faucet: { cold: 1, hot: 1, total: 1.4 } } },
  lavatory: { label: 'Lavatory', private: { faucet: { cold: 0.5, hot: 0.5, total: 0.7 } }, public: { faucet: { cold: 1.5, hot: 1.5, total: 2 } } },
  'service-sink': { label: 'Service sink', public: { faucet: { cold: 2.25, hot: 2.25, total: 3 } } },
  shower: { label: 'Shower head', private: { 'mixing-valve': { cold: 1, hot: 1, total: 1.4 } }, public: { 'mixing-valve': { cold: 3, hot: 3, total: 4 } } },
  urinal: { label: 'Urinal', public: { 'flush-valve-3/4': { cold: 5, hot: 0, total: 5 }, 'flush-valve-1': { cold: 10, hot: 0, total: 10 }, 'flush-tank': { cold: 3, hot: 0, total: 3 } } },
  'washing-machine-8': { label: 'Washing machine (8 lb)', private: { automatic: { cold: 1, hot: 1, total: 1.4 } }, public: { automatic: { cold: 2.25, hot: 2.25, total: 3 } } },
  'washing-machine-15': { label: 'Washing machine (15 lb)', public: { automatic: { cold: 3, hot: 3, total: 4 } } },
  'water-closet': { label: 'Water closet', private: { 'flush-tank': { cold: 2.2, hot: 0, total: 2.2 }, 'flush-valve': { cold: 6, hot: 0, total: 6 }, 'flushometer-tank': { cold: 2, hot: 0, total: 2 } }, public: { 'flush-valve': { cold: 10, hot: 0, total: 10 }, 'flush-tank': { cold: 5, hot: 0, total: 5 }, 'flushometer-tank': { cold: 2, hot: 0, total: 2 } } },
};
const WSFU_CONTROL_LABELS = {
  faucet: 'faucet', automatic: 'automatic', 'flush-tank': 'flush tank', 'flush-valve': 'flush valve', 'flushometer-tank': 'flushometer tank',
  'mixing-valve': 'mixing valve', 'valve-3/8': '3/8 in valve', 'flush-valve-1': '1 in flush valve', 'flush-valve-3/4': '3/4 in flush valve',
};
const WATER_OCCUPANCIES = ['public', 'private'];

// The fixture a counter's name declares, as { fixture, control } (control null
// when the name does not say), or null when the name is not a water fixture
// the table knows (a floor drain, a hose bibb, a water heater, a cleanout).
// Word-bounded on the lowercased name with punctuation as spaces, so "WC-1"
// reads, "Hand sink" is a lavatory before "sink" is a kitchen sink, and
// "Floor sink" is a drain, not a fixture.
function wsfuFixtureFromName(name) {
  const n = ' ' + String(name || '').toLowerCase().replace(/[_/,()#.:-]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  if (/\b(floor sink|floor drain|fs|fd|hose bibb?|hb|wall hydrant|water heater|wh|cleanout|co|backflow|trap primer|ice maker|ice machine)\b/.test(n)) return null;
  let fixture = null;
  if (/\b(bathroom group|bath group)\b/.test(n)) fixture = 'bathroom-group';
  else if (/\bcombination (fixture|sink)\b/.test(n)) fixture = 'combination-fixture';
  else if (/\b(lav|lavs|lavatory|lavatories|hand sink|hand wash(ing)? sink|hs|wash basin|basin)\b/.test(n)) fixture = 'lavatory';
  else if (/\b(wc|w c|water closet|water closets|toilet|toilets)\b/.test(n)) fixture = 'water-closet';
  else if (/\b(ur|urinal|urinals)\b/.test(n)) fixture = 'urinal';
  else if (/\bbidet\b/.test(n)) fixture = 'bidet';
  else if (/\b(bathtub|bath tub|tub|bath|bt)\b/.test(n)) fixture = 'bathtub';
  else if (/\b(shower|showers|shower head|sh)\b/.test(n)) fixture = 'shower';
  else if (/\b(mop sink|service sink|slop sink|janitor sink|jan sink|ms)\b/.test(n)) fixture = 'service-sink';
  else if (/\b(dw|dishwasher|dish washer|dish machine|dishwashing machine)\b/.test(n)) fixture = 'dishwasher';
  else if (/\b(df|ewc|drinking fountain|water fountain|water cooler|bottle fill(er|ing)?( station)?)\b/.test(n)) fixture = 'drinking-fountain';
  else if (/\b(laundry tray|laundry sink|laundry tub|lt)\b/.test(n)) fixture = 'laundry-tray';
  else if (/\b(wm|washer|washing machine|clothes washer|laundry machine)\b/.test(n)) fixture = /\b15 ?lbs?\b/.test(n) ? 'washing-machine-15' : 'washing-machine-8';
  else if (/\b(sink|sinks|ks|kitchen sink|prep sink|bar sink|pot sink|scullery|[23] ?comp(artment)?( sink)?|three comp(artment)?( sink)?|two comp(artment)?( sink)?)\b/.test(n)) fixture = 'kitchen-sink';
  if (!fixture) return null;
  let control = null;
  if (/\bflushometer tank\b/.test(n)) control = 'flushometer-tank';
  else if (/\b(flush valve|flushometer|fv)\b/.test(n)) control = fixture === 'urinal' ? (/\b1 ?(in|inch)\b|\b1 ?"/.test(n) ? 'flush-valve-1' : 'flush-valve-3/4') : 'flush-valve';
  else if (/\b(flush tank|tank|ft)\b/.test(n)) control = 'flush-tank';
  return { fixture, control };
}
// What the counter's WSFU field is prefilled with for a name and the project's
// occupancy: the table row plus the fixture's label, or null when the name is
// not a fixture the table knows.
function wsfuPrefillFor(name, occupancy) {
  const hit = wsfuFixtureFromName(name);
  if (!hit) return null;
  const row = wsfuFor(hit.fixture, occupancy, hit.control);
  return row ? { ...row, label: WSFU_LOADS[hit.fixture].label, controlLabel: WSFU_CONTROL_LABELS[row.control] || row.control } : null;
}
// A placed mark's fixture units: its own override, else its counter's, else 0.
function markerWsfu(marker, counter) {
  if (marker && Number.isFinite(marker.wsfuOverride) && marker.wsfuOverride > 0) return marker.wsfuOverride;
  return counter && Number.isFinite(counter.wsfu) && counter.wsfu > 0 ? counter.wsfu : 0;
}
const WATER_SIDES = ['cold', 'hot'];

// The load row for a fixture: the occupancy column asked for, or the other one
// when the code prints the fixture in only one (a bidet is private-only, a
// service sink public-only); the control asked for, or the fixture's first
// (the table's order is the read a bare name gets: a public water closet is a
// flush valve, a private one a flush tank, a public urinal a 3/4 in flush
// valve). null when the fixture is unknown.
function wsfuFor(fixtureKey, occupancy, control) {
  const f = WSFU_LOADS[fixtureKey];
  if (!f) return null;
  const occ = f[occupancy] ? occupancy : (f.public ? 'public' : 'private');
  const col = f[occ];
  if (!col) return null;
  const ctl = control && col[control] ? control : Object.keys(col)[0];
  return { fixture: fixtureKey, occupancy: occ, control: ctl, ...col[ctl] };
}

// DATA TABLE — demand in gallons per minute for a load in fixture units (IPC
// Table E103.3(3)), the two columns the code prints: systems predominantly for
// flush tanks, and predominantly for flush valves. Points are [wsfu, gpm].
const DEMAND_CURVE = {
  'flush-tank': [
    [1, 3], [2, 5], [3, 6.5], [4, 8], [5, 9.4], [6, 10.7], [7, 11.8], [8, 12.8], [9, 13.7], [10, 14.6],
    [11, 15.4], [12, 16], [13, 16.5], [14, 17], [15, 17.5], [16, 18], [17, 18.4], [18, 18.8], [19, 19.2], [20, 19.6],
    [25, 21.5], [30, 23.3], [35, 24.9], [40, 26.3], [45, 27.7], [50, 29.1], [60, 32], [70, 35], [80, 38], [90, 41],
    [100, 43.5], [120, 48], [140, 52.5], [160, 57], [180, 61], [200, 65], [225, 70], [250, 75], [275, 80], [300, 85],
    [400, 105], [500, 124], [750, 170], [1000, 208], [1250, 239], [1500, 269], [1750, 297], [2000, 325], [2500, 380], [3000, 433],
    [4000, 525], [5000, 593],
  ],
  'flush-valve': [
    [5, 15], [6, 17.4], [7, 19.8], [8, 22.2], [9, 24.6], [10, 27],
    [11, 27.8], [12, 28.6], [13, 29.4], [14, 30.2], [15, 31], [16, 31.8], [17, 32.6], [18, 33.4], [19, 34.2], [20, 35],
    [25, 38], [30, 42], [35, 44], [40, 46], [45, 48], [50, 50], [60, 54], [70, 58], [80, 61.2], [90, 64.3],
    [100, 67.5], [120, 73], [140, 77], [160, 81], [180, 85.5], [200, 90], [225, 95.5], [250, 101], [275, 104.5], [300, 108],
    [400, 127], [500, 143], [750, 177], [1000, 208], [1250, 239], [1500, 269], [1750, 297], [2000, 325], [2500, 380], [3000, 433],
    [4000, 525], [5000, 593],
  ],
};
// Design flow for a load, read off the curve with straight-line interpolation
// between the printed points (the code says to interpolate). Below the first
// point of the flush-valve column the load is too small for a flush valve to be
// on it, so the flush-tank column answers; below 1 WSFU the flow goes to zero
// with the load; past the last point the last value holds (a load that size is
// an engineer's job, and the schedule says so). null for a bad load.
function demandGpm(wsfu, column) {
  const load = Number(wsfu);
  if (!Number.isFinite(load) || load < 0) return null;
  if (load === 0) return 0;
  const pts = DEMAND_CURVE[column] || DEMAND_CURVE['flush-tank'];
  if (load < pts[0][0]) {
    if (column === 'flush-valve') return demandGpm(load, 'flush-tank');
    return round1(load / pts[0][0] * pts[0][1]);
  }
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (load <= x1) return round1(y0 + (y1 - y0) * (load - x0) / (x1 - x0));
  }
  return pts[pts.length - 1][1];
}
function round1(n) { return Math.round(n * 10) / 10; }

// DATA TABLE — the velocity the trade sizes water to, feet per second, per side.
// Not a code table: the IPC's own method (Appendix E) sizes by pressure and
// developed length; these are the design-practice caps the size suggestion uses,
// stamped "practice, not code" wherever they show. Editable per project (rung 5).
const WATER_VELOCITY_CAP_FPS = { cold: 8, hot: 5 };

// DATA TABLE — inside diameter, inches, per nominal size for the materials the
// Quick Line knows, from the dimension standards (velocity = flow ÷ area).
// Keys are the nominal size in decimal inches as a string.
const PIPE_ID_IN = {
  pex: { label: 'PEX', standard: 'ASTM F876, SDR 9', sizes: { '0.375': 0.35, '0.5': 0.475, '0.75': 0.671, '1': 0.862, '1.25': 1.054, '1.5': 1.244, '2': 1.629 } },
  copper: { label: 'copper Type L', standard: 'ASTM B88', sizes: { '0.375': 0.43, '0.5': 0.545, '0.75': 0.785, '1': 1.025, '1.25': 1.265, '1.5': 1.505, '2': 1.985, '2.5': 2.465, '3': 2.945 } },
  cpvc: { label: 'CPVC', standard: 'ASTM D2846, CTS SDR 11', sizes: { '0.5': 0.489, '0.75': 0.715, '1': 0.921, '1.25': 1.125, '1.5': 1.329, '2': 1.739 } },
  galvanized: { label: 'galvanized steel', standard: 'ASTM A53, Schedule 40', sizes: { '0.5': 0.622, '0.75': 0.824, '1': 1.049, '1.25': 1.38, '1.5': 1.61, '2': 2.067, '2.5': 2.469, '3': 3.068 } },
};
const WATER_MATERIAL_ORDER = ['pex', 'copper', 'cpvc', 'galvanized'];

// The water material a line type's name declares, or null. CPVC before PVC-ish
// words so "CPVC" is never copper or PVC; galvanized also as "galv", "GI",
// "steel".
function waterMaterialFromName(name) {
  const n = ' ' + String(name || '').toLowerCase().replace(/[_/,()]+/g, ' ') + ' ';
  if (/\bcpvc\b/.test(n)) return 'cpvc';
  if (/\bpex(-al-pex)?\b/.test(n)) return 'pex';
  if (/\b(copper|cu|type\s?[klm])\b/.test(n)) return 'copper';
  if (/\b(galv(anized|anised)?|g\.?i\.?|steel|iron\s?pipe)\b/.test(n)) return 'galvanized';
  return null;
}
// Inside diameter for a material at a nominal size, or null when the table has
// no row (a size the material is not made in, or an unknown material).
function pipeIdIn(material, sizeIn) {
  const m = PIPE_ID_IN[material];
  if (!m || !Number.isFinite(Number(sizeIn))) return null;
  const id = m.sizes[String(Number(sizeIn))];
  return id == null ? null : id;
}
// Velocity in feet per second for a flow in gpm through an inside diameter in
// inches: v = 0.4085 × Q ÷ d² (the gpm-and-inches form of Q = A·v).
function velocityFps(gpm, idIn) {
  const q = Number(gpm), d = Number(idIn);
  if (!Number.isFinite(q) || !Number.isFinite(d) || d <= 0) return null;
  return 0.408498 * q / (d * d);
}
// The smallest nominal size of a material whose velocity at the flow stays under
// the side's cap, with the velocity it runs at; null when no size in the table
// passes (the main is an engineer's job). `cap` overrides the side's default
// (the project's knob, rung 5).
function suggestWaterSizeIn(gpm, material, side, cap) {
  const m = PIPE_ID_IN[material];
  const limit = Number.isFinite(Number(cap)) && Number(cap) > 0 ? Number(cap) : WATER_VELOCITY_CAP_FPS[side] || WATER_VELOCITY_CAP_FPS.cold;
  if (!m) return null;
  const sizes = Object.keys(m.sizes).map(Number).sort((a, b) => a - b);
  for (const s of sizes) {
    const v = velocityFps(gpm, m.sizes[String(s)]);
    if (v != null && v <= limit) return { sizeIn: s, velocityFps: v, capFps: limit };
  }
  return null;
}

// DATA TABLE — minimum size of the fixture supply pipe, inches (IPC Table 604.4),
// keyed by fixture and, where the code splits it, the supply control.
const FIXTURE_SUPPLY_MIN_IN = {
  bathtub: 0.5, bidet: 0.375, 'combination-fixture': 0.5, dishwasher: 0.5, 'drinking-fountain': 0.375, 'hose-bibb': 0.5,
  'kitchen-sink': 0.5, 'laundry-tray': 0.5, lavatory: 0.375, shower: 0.5, 'flushing-rim-sink': 0.75, 'service-sink': 0.5,
  'urinal-flush-tank': 0.5, 'urinal-flush-valve': 0.75, 'wall-hydrant': 0.5,
  'water-closet-flush-tank': 0.375, 'water-closet-flush-valve': 1, 'water-closet-flushometer-tank': 0.375, 'water-closet-one-piece': 0.5,
};
// The row for a fixture key and control: "water-closet" + "flush-valve" → 1 in;
// a fixture the table lists once ignores the control. null when unknown.
function fixtureSupplyMinIn(fixtureKey, control) {
  if (control && FIXTURE_SUPPLY_MIN_IN[fixtureKey + '-' + control] != null) return FIXTURE_SUPPLY_MIN_IN[fixtureKey + '-' + control];
  return FIXTURE_SUPPLY_MIN_IN[fixtureKey] != null ? FIXTURE_SUPPLY_MIN_IN[fixtureKey] : null;
}
// The water service pipe is never smaller than this (IPC 603.1).
const WATER_SERVICE_MIN_IN = 0.75;

// A nominal size as the trade writes it: 0.375 → "3/8", 1.25 → "1-1/4", 2 → "2".
function sizeFraction(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  const whole = Math.floor(v), eighths = Math.round((v - whole) * 8);
  if (eighths === 0) return String(whole);
  if (eighths === 8) return String(whole + 1);
  const g = eighths % 2 === 0 ? (eighths % 4 === 0 ? 4 : 2) : 1;
  const frac = (eighths / g) + '/' + (8 / g);
  return whole ? whole + '-' + frac : frac;
}
// The rulebook pins fractions through this: fixtureSupplyMinLabel("lavatory") → "3/8".
function fixtureSupplyMinLabel(fixtureKey, control) {
  const v = fixtureSupplyMinIn(fixtureKey, control);
  return v == null ? '' : sizeFraction(v);
}

// --- rung 3: water runs, attachment, leaders, served loads ----------------------
const WATER_SIDE_LABELS = { cold: 'Cold', hot: 'Hot' };
// A fixture attaches to the nearest run of its side within this many sheet
// points (the duct tap snap); the rescue looks this far for the obvious run.
const WATER_ATTACH_SNAP_PDF = 12;
const WATER_ATTACH_SEARCH_PDF = 96;

// The water side a line type's name declares: "hot", "HW", "HWR", "hot water"
// → hot; "cold", "CW", "cold water", "domestic cold" → cold; null otherwise.
function waterSideFromName(name) {
  const n = ' ' + String(name || '').toLowerCase().replace(/[_/,()#.:-]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  if (/\b(hot|hw|hwr|hws|dhw|hot water)\b/.test(n)) return 'hot';
  if (/\b(cold|cw|dcw|cold water)\b/.test(n)) return 'cold';
  return null;
}
// A fixture's load per side for the number it carries: the table row for its
// name (the counter's own column, else the project's) scaled to that number,
// so a typed-over 3 on a lavatory still splits half and half; a fixture the
// table does not know counts its whole number on each side it touches.
// null when the number is not positive.
function waterFixtureLoads(counter, occupancy, number) {
  const n = Number(number);
  if (!Number.isFinite(n) || n <= 0) return null;
  const occ = counter && (counter.wsfuOccupancy === 'public' || counter.wsfuOccupancy === 'private') ? counter.wsfuOccupancy : occupancy;
  const read = counter ? wsfuPrefillFor(counter.name, occ) : null;
  if (read && read.total > 0) {
    const k = n / read.total;
    return { cold: round2(read.cold * k), hot: round2(read.hot * k), total: n, known: true };
  }
  return { cold: n, hot: n, total: n, known: false };
}
function round2(n) { return Math.round(n * 100) / 100; }
// The water runs on a page: every quick line and polyline whose line type has
// a water side, as { id, side, lineTypeId, kind: 'quick' | 'poly', index,
// vertices, color }. Pure over the annotation shape; a line's own color wins.
function waterRunsFromAnnotations(ann, lineTypes) {
  const sideOf = {};
  const colorOf = {};
  (lineTypes || []).forEach((lt) => { if (lt && (lt.waterSide === 'cold' || lt.waterSide === 'hot')) { sideOf[lt.id] = lt.waterSide; colorOf[lt.id] = lt.color; } });
  const out = [];
  (ann && ann.quickLines || []).forEach((q, index) => {
    const side = q && sideOf[q.lineTypeId];
    if (!side) return;
    out.push({ id: q.id || ('q' + index), side, lineTypeId: q.lineTypeId, kind: 'quick', index, vertices: [{ x: q.x1, y: q.y1 }, { x: q.x2, y: q.y2 }], color: q.color || colorOf[q.lineTypeId] });
  });
  (ann && ann.polylines || []).forEach((poly, index) => {
    const side = poly && sideOf[poly.lineTypeId];
    if (!side || !Array.isArray(poly.points) || poly.points.length < 2) return;
    out.push({ id: poly.id || ('p' + index), side, lineTypeId: poly.lineTypeId, kind: 'poly', index, vertices: poly.points, color: poly.color || colorOf[poly.lineTypeId] });
  });
  return out;
}
// Nearest point on a polyline: { dist, s, point }; s = arclength from vertex 0.
function waterNearestOnPolyline(p, verts) {
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
// The attachment rule, per side. fixtures = [{ x, y, loads: { cold, hot }, … }];
// runs from waterRunsFromAnnotations. Each side a fixture loads attaches to the
// nearest run OF THAT SIDE within snap (a lavatory ties to its cold run and its
// hot run separately). Returns { attached: [{ fixture, side, load, runId, s,
// dist, point }], unattached: [{ fixture, side, load }] }.
function attachWaterFixtures(fixtures, runs, opts) {
  const snap = opts && opts.snapDist > 0 ? opts.snapDist : WATER_ATTACH_SNAP_PDF;
  const list = (runs || []).filter((r) => r && (r.vertices ? r.vertices.length : 0) >= 2);
  const attached = [], unattached = [];
  (fixtures || []).forEach((f) => {
    if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.y) || !f.loads) return;
    WATER_SIDES.forEach((side) => {
      const load = f.loads[side];
      if (!(load > 0)) return;
      let best = null;
      list.forEach((run) => {
        if (run.side !== side) return;
        const hit = waterNearestOnPolyline(f, run.vertices);
        if (hit.dist <= snap && (!best || hit.dist < best.dist)) best = { fixture: f, side, load, runId: run.id, s: hit.s, dist: hit.dist, point: hit.point };
      });
      if (best) attached.push(best);
      else unattached.push({ fixture: f, side, load });
    });
  });
  return { attached, unattached };
}
// The leaders to paint: one per attached side, from the fixture to the point
// on its run; a zero-length one (the fixture sits on the run) is dropped.
function waterFixtureLeaders(fixtures, runs, opts) {
  const { attached } = attachWaterFixtures(fixtures, runs, opts);
  const out = [];
  attached.forEach((a) => {
    if (!a.point) return;
    const from = { x: a.fixture.x, y: a.fixture.y };
    if (Math.hypot(a.point.x - from.x, a.point.y - from.y) < 0.5) return;
    out.push({ fixture: a.fixture, side: a.side, runId: a.runId, from, to: { x: a.point.x, y: a.point.y }, dist: a.dist });
  });
  return out;
}
// The rescue: the nearest run of one of `sides` within the search distance,
// as { runId, side, point, dist }, or null when none is close enough.
function waterNearestRunPoint(fixture, runs, sides, opts) {
  const search = opts && opts.searchDist > 0 ? opts.searchDist : WATER_ATTACH_SEARCH_PDF;
  const want = Array.isArray(sides) && sides.length ? sides : WATER_SIDES;
  if (!fixture || !Number.isFinite(fixture.x) || !Number.isFinite(fixture.y)) return null;
  let best = null;
  (runs || []).forEach((run) => {
    if (!run || !want.includes(run.side) || (run.vertices ? run.vertices.length : 0) < 2) return;
    const hit = waterNearestOnPolyline(fixture, run.vertices);
    if (hit.point && hit.dist <= search && (!best || hit.dist < best.dist)) best = { runId: run.id, side: run.side, point: hit.point, dist: hit.dist };
  });
  return best;
}
// What each run serves: { [runId]: { side, wsfu, fixtures } } summed over the
// attached fixtures of its side (a fixture's multiply factor rides in its load).
function waterServedByRun(fixtures, runs, opts) {
  const out = {};
  (runs || []).forEach((r) => { if (r) out[r.id] = { side: r.side, wsfu: 0, fixtures: 0 }; });
  attachWaterFixtures(fixtures, runs, opts).attached.forEach((a) => {
    const row = out[a.runId];
    if (!row) return;
    row.wsfu = round2(row.wsfu + a.load);
    row.fixtures++;
  });
  return out;
}

// --- rung 4: the S moment ------------------------------------------------------------
// Branch links: a run whose FIRST vertex lands within snap of another run of
// the SAME side is that parent's child (a branch tapped off a main). Returns
// [{ childId, parentId, s }], s = arclength along the parent. Nearest wins.
function waterChildLinks(runs, opts) {
  const snap = opts && opts.snapDist > 0 ? opts.snapDist : WATER_ATTACH_SNAP_PDF;
  const list = (runs || []).filter((r) => r && (r.vertices ? r.vertices.length : 0) >= 2);
  const out = [];
  list.forEach((child) => {
    const start = child.vertices[0];
    let best = null;
    list.forEach((parent) => {
      if (parent === child || parent.id === child.id || parent.side !== child.side) return;
      const hit = waterNearestOnPolyline(start, parent.vertices);
      if (hit.dist <= snap && (!best || hit.dist < best.dist)) best = { childId: child.id, parentId: parent.id, s: hit.s, dist: hit.dist };
    });
    if (best) out.push({ childId: best.childId, parentId: best.parentId, s: best.s });
  });
  return out;
}
function waterPolylineLength(verts) {
  let acc = 0;
  for (let i = 0; i < (verts ? verts.length : 0) - 1; i++) acc += Math.hypot(verts[i + 1].x - verts[i].x, verts[i + 1].y - verts[i].y);
  return acc;
}
// The load still to serve beyond the tip of an IN-PROGRESS water trace, the
// duct rule per side: fixtures of the draft's side attached to the draft AT or
// past its tip, on committed runs that branch off the draft (children,
// recursively), or attached to no run of that side at all (assumed to be what
// the trace is heading for). Fixtures the trace has already passed (attached
// strictly behind the tip) and fixtures on unrelated runs of the side are
// served elsewhere. `flushValve` says a flush valve is among them, which picks
// the demand column. opts: { runs, draft: { vertices, side }, fixtures
// ([{ x, y, loads, flushValve? }]), snapDist? }. Returns { wsfu, served,
// fixtures, flushValve } or null with nothing in scope.
function waterDraftRemainingLoad(opts) {
  const o = opts || {};
  const draft = o.draft;
  if (!draft || !WATER_SIDES.includes(draft.side)) return null;
  const EPS = 1e-6;
  const side = draft.side;
  const draftRun = { id: '__draft__', side, vertices: draft.vertices || [] };
  const committed = (o.runs || []).filter((r) => r && r.side === side && (r.vertices ? r.vertices.length : 0) >= 2);
  const all = draftRun.vertices.length >= 2 ? committed.concat([draftRun]) : committed;
  const fixtures = (o.fixtures || []).filter((f) => f && f.loads && f.loads[side] > 0);
  const { attached, unattached } = attachWaterFixtures(fixtures, all, o);
  const links = waterChildLinks(all, o);
  const childrenOf = new Map();
  links.forEach((l) => { if (!childrenOf.has(l.parentId)) childrenOf.set(l.parentId, []); childrenOf.get(l.parentId).push(l.childId); });
  const onRun = new Map();
  attached.forEach((a) => { if (a.side !== side) return; if (!onRun.has(a.runId)) onRun.set(a.runId, []); onRun.get(a.runId).push(a); });
  const tipLen = waterPolylineLength(draftRun.vertices);
  let wsfu = 0, served = 0, count = 0, flushValve = false;
  const take = (a) => { wsfu += a.load; count++; if (a.fixture.flushValve) flushValve = true; };
  (onRun.get('__draft__') || []).forEach((a) => { if (a.s >= tipLen - EPS) take(a); else served += a.load; });
  const visited = new Set(['__draft__']);
  const subtree = (rid) => {
    if (visited.has(rid)) return;
    visited.add(rid);
    (onRun.get(rid) || []).forEach(take);
    (childrenOf.get(rid) || []).forEach(subtree);
  };
  (childrenOf.get('__draft__') || []).forEach(subtree);
  unattached.forEach((u) => { if (u.side === side) take({ load: u.load, fixture: u.fixture }); });
  if (!(wsfu > 0) && !(served > 0)) return null;
  return { wsfu: round2(wsfu), served: round2(served), fixtures: count, flushValve };
}
// What a COMMITTED run carries at its head: its own attached fixtures plus its
// children's, recursively (the schedule's number, rung 5). Returns
// { [runId]: { side, wsfu, fixtures, flushValve } }.
function waterDownstreamByRun(fixtures, runs, opts) {
  const list = (runs || []).filter((r) => r && (r.vertices ? r.vertices.length : 0) >= 2);
  const { attached } = attachWaterFixtures(fixtures, list, opts);
  const links = waterChildLinks(list, opts);
  const childrenOf = new Map();
  links.forEach((l) => { if (!childrenOf.has(l.parentId)) childrenOf.set(l.parentId, []); childrenOf.get(l.parentId).push(l.childId); });
  const onRun = new Map();
  attached.forEach((a) => { if (!onRun.has(a.runId)) onRun.set(a.runId, []); onRun.get(a.runId).push(a); });
  const out = {};
  list.forEach((run) => {
    let wsfu = 0, count = 0, flushValve = false;
    const visited = new Set();
    const walk = (rid) => {
      if (visited.has(rid)) return;
      visited.add(rid);
      (onRun.get(rid) || []).forEach((a) => { wsfu += a.load; count++; if (a.fixture.flushValve) flushValve = true; });
      (childrenOf.get(rid) || []).forEach(walk);
    };
    walk(run.id);
    out[run.id] = { side: run.side, wsfu: round2(wsfu), fixtures: count, flushValve };
  });
  return out;
}
// The size the S moment offers for a load: the demand flow in the column the
// fixtures call for, the smallest size of the material under the side's cap,
// and how the run's current size fares. opts: { wsfu, flushValve?, material,
// side, cap?, currentSizeIn? }. Returns null when the load is not positive.
function waterDraftSuggestion(opts) {
  const o = opts || {};
  if (!(o.wsfu > 0)) return null;
  const column = o.flushValve ? 'flush-valve' : 'flush-tank';
  const gpm = demandGpm(o.wsfu, column);
  const cap = Number.isFinite(Number(o.cap)) && Number(o.cap) > 0 ? Number(o.cap) : (WATER_VELOCITY_CAP_FPS[o.side] || WATER_VELOCITY_CAP_FPS.cold);
  const out = { wsfu: o.wsfu, column, gpm, capFps: cap, side: o.side, material: o.material || null, sizeIn: null, velocityFps: null, currentSizeIn: null, currentVelocityFps: null, over: false, holds: false };
  const sug = o.material ? suggestWaterSizeIn(gpm, o.material, o.side, cap) : null;
  if (sug) { out.sizeIn = sug.sizeIn; out.velocityFps = sug.velocityFps; }
  if (o.material && Number.isFinite(Number(o.currentSizeIn)) && Number(o.currentSizeIn) > 0) {
    const id = pipeIdIn(o.material, o.currentSizeIn);
    out.currentSizeIn = Number(o.currentSizeIn);
    out.currentVelocityFps = id ? velocityFps(gpm, id) : null;
    out.over = out.currentVelocityFps != null && out.currentVelocityFps > cap;
    out.holds = out.currentVelocityFps != null && !out.over;
  }
  return out;
}
// The velocity at every size the material comes in, for the popover's ladder.
function waterSizeLadder(gpm, material, cap) {
  const m = PIPE_ID_IN[material];
  if (!m) return [];
  return Object.keys(m.sizes).map(Number).sort((a, b) => a - b).map((sizeIn) => {
    const v = velocityFps(gpm, m.sizes[String(sizeIn)]);
    return { sizeIn, label: sizeFraction(sizeIn), velocityFps: v, ok: v != null && v <= cap };
  });
}
// A line type's name with its size swapped for a new one, in the style the
// name wrote it: '3/4in PEX hot' → '1in PEX hot', '1/2" Cu' → '3/4" Cu',
// '1-1/4 in copper' → '1-1/2 in copper'. A name with no size gets the new one in front.
function replaceSizeInName(name, sizeIn) {
  const frac = sizeFraction(sizeIn);
  const n = String(name || '');
  const re = /(\d+(?:[-\s]\d+\/\d+)?|\d+\/\d+)(\s*)(in\b|inch\b|"|″)/i;
  const m = re.exec(n);
  if (m) return n.slice(0, m.index) + frac + m[2] + m[3] + n.slice(m.index + m[0].length);
  return frac + 'in ' + n;
}

// --- rung 5: the schedule --------------------------------------------------------------
// The per-project knobs the schedule's foot edits: the velocity cap per side.
// (Occupancy is the codes blob's.) Defaults are the rulebook's figures.
const WATER_SETTINGS_DEFAULTS = { capFps: { cold: WATER_VELOCITY_CAP_FPS.cold, hot: WATER_VELOCITY_CAP_FPS.hot } };
// A saved / imported waterSettings blob → the shape the app stores.
function normalizeWaterSettings(raw) {
  const out = { capFps: { ...WATER_SETTINGS_DEFAULTS.capFps } };
  const caps = raw && raw.capFps;
  WATER_SIDES.forEach((side) => {
    const v = caps ? Number(caps[side]) : NaN;
    if (Number.isFinite(v) && v > 0) out.capFps[side] = v;
  });
  return out;
}
// One schedule row's arithmetic for a committed run: the demand in the column
// its fixtures call for, the velocity at the run's own size, over the cap or
// under a served fixture's supply minimum, and the size that would pass.
// opts: { side, material, sizeIn, wsfu, flushValve, supplyMinIn, cap }.
function waterScheduleRow(opts) {
  const o = opts || {};
  const column = o.flushValve ? 'flush-valve' : 'flush-tank';
  const gpm = o.wsfu > 0 ? demandGpm(o.wsfu, column) : 0;
  const cap = Number.isFinite(Number(o.cap)) && Number(o.cap) > 0 ? Number(o.cap) : (WATER_VELOCITY_CAP_FPS[o.side] || WATER_VELOCITY_CAP_FPS.cold);
  const sizeIn = Number.isFinite(Number(o.sizeIn)) && Number(o.sizeIn) > 0 ? Number(o.sizeIn) : null;
  const id = o.material && sizeIn ? pipeIdIn(o.material, sizeIn) : null;
  const v = id && gpm > 0 ? velocityFps(gpm, id) : (id ? 0 : null);
  const over = v != null && v > cap;
  const underMin = sizeIn != null && Number.isFinite(Number(o.supplyMinIn)) && Number(o.supplyMinIn) > sizeIn;
  const sug = o.material && gpm > 0 ? suggestWaterSizeIn(gpm, o.material, o.side, cap) : null;
  let suggestSizeIn = sug ? sug.sizeIn : null;
  if (underMin && Number(o.supplyMinIn) > (suggestSizeIn || 0)) suggestSizeIn = Number(o.supplyMinIn);
  return { column, gpm, capFps: cap, sizeIn, velocityFps: v, over, underMin, suggestSizeIn, unsized: sizeIn == null || !o.material, ok: !over && !underMin && sizeIn != null && !!o.material };
}

const WATER_MODEL_API = {
  WATER_SETTINGS_DEFAULTS, normalizeWaterSettings, waterScheduleRow,
  waterChildLinks, waterPolylineLength, waterDraftRemainingLoad, waterDownstreamByRun, waterDraftSuggestion, waterSizeLadder, replaceSizeInName,
  WATER_SIDE_LABELS, WATER_ATTACH_SNAP_PDF, WATER_ATTACH_SEARCH_PDF, waterSideFromName, waterFixtureLoads, waterRunsFromAnnotations,
  waterNearestOnPolyline, attachWaterFixtures, waterFixtureLeaders, waterNearestRunPoint, waterServedByRun,
  WSFU_LOADS, WSFU_CONTROL_LABELS, WATER_OCCUPANCIES, WATER_SIDES, wsfuFor, wsfuFixtureFromName, wsfuPrefillFor, markerWsfu,
  DEMAND_CURVE, demandGpm,
  WATER_VELOCITY_CAP_FPS, PIPE_ID_IN, WATER_MATERIAL_ORDER, waterMaterialFromName, pipeIdIn, velocityFps, suggestWaterSizeIn,
  FIXTURE_SUPPLY_MIN_IN, fixtureSupplyMinIn, fixtureSupplyMinLabel, WATER_SERVICE_MIN_IN, sizeFraction,
};
if (typeof window !== 'undefined') window.WaterModel = WATER_MODEL_API;
// Node test harness only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = WATER_MODEL_API;

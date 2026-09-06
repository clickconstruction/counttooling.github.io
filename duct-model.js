/*
 * duct-model.js — pure duct-takeoff math + data model (DUCT-PLAN.md unit D1).
 *
 * Classic <script src="/duct-model.js"> pure module in the geometry.js mold:
 * zero DOM, zero `state`/App dependencies, top-level declarations in the shared
 * global lexical scope, guarded CommonJS footer (inert in the browser) so
 * duct-model.test.js can require() it under `node --test`.
 *
 * Owns, in order:
 *   1. The duct annotation model — run / size / fitting factories + validation.
 *      Shapes are plain JSON (no methods, no class instances, no Infinity/NaN
 *      fields) so they serialize on the existing annotation payloads exactly
 *      like quickLines/polylines do (see annotation-model.js conventions).
 *      D2 adds `ductRuns` / `ductFittings` arrays to makeAnnotations(); this
 *      unit only defines the element shapes.
 *   2. SMACNA-style gauge selection (data table, by pressure class + larger
 *      side) and galvanized sheet weights.
 *   3. Weight math — lb/ft, segment/rollup pounds, fitting lb-eq, seam & waste
 *      %, fitting-factor % fallback.
 *   4. Insulation — liner/wrap sq ft from LF × perimeter.
 *   5. Ductulator — equal-friction round sizing, velocity cap, round→rect
 *      equivalents, suggestRoundAndRect.
 *   6. Neck-size rules of thumb (CFM → device/neck suggestion).
 */

// --- 1. Annotation model -----------------------------------------------------
//
// A duct RUN is one continuous trace with size segments (DUCT-PLAN "The model"):
//   { id, name, airside, pressureClass, linerType, linerThicknessIn,
//     systemGroupId, vertices: [{x,y}...], segments: [{startVertexIdx, size}] }
// - vertices are PDF-space points, exactly like polyline.points — length math
//   stays out of this shape; callers convert with their scale glue.
// - segments[i] covers the trace from vertices[segments[i].startVertexIdx] to
//   vertices[segments[i+1].startVertexIdx] (or the last vertex for the final
//   segment). segments[0].startVertexIdx must be 0; indices strictly ascend.
//   Corners WITHOUT a size change are just extra vertices inside a segment.
//
// A duct SIZE (inches):
//   { kind: 'rect', w, h }   — w × h sheet-metal rectangle
//   { kind: 'round', d }     — spiral/round, diameter d
//
// A FITTING:
//   { id, runId, vertexIdx, position, type, size, auto }
// - vertexIdx anchors a fitting inferred from run geometry (corner = elbow,
//   size step = transition); `position` ({x,y} PDF-space) anchors one placed
//   free (a tap where a branch lands mid-segment). Exactly one of the two is
//   normally set; both may be present (vertexIdx wins for geometry-derived
//   redraws). `auto: true` marks a self-counted fitting (reclassify/delete
//   flips it to false) — the SMACNA-gauge-auto-pick philosophy.

/** Valid airside values for a run. */
const DUCT_AIRSIDES = ['supply', 'return', 'exhaust'];

/** Valid fitting types (DUCT-PLAN: corner/step/tap inference + reclassify menu). */
const DUCT_FITTING_TYPES = ['elbow90', 'elbow45', 'transition', 'tap', 'boot', 'offset'];

// Same id shape the app's uid() produces (app.js: Math.random().toString(36)
// .slice(2, 10)). Factories accept opts.id so app code passes ctx.uid();
// the fallback keeps the module usable standalone (tests, node tooling).
function ductUid() { return Math.random().toString(36).slice(2, 10); }

/** { kind: 'rect', w, h } — inches. */
function makeRectSize(w, h) { return { kind: 'rect', w: w, h: h }; }
/** { kind: 'round', d } — inches. */
function makeRoundSize(d) { return { kind: 'round', d: d }; }

/** Is `size` a well-formed duct size (finite positive dims)? */
function isDuctSize(size) {
  if (!size || typeof size !== 'object') return false;
  if (size.kind === 'rect') return Number.isFinite(size.w) && size.w > 0 && Number.isFinite(size.h) && size.h > 0;
  if (size.kind === 'round') return Number.isFinite(size.d) && size.d > 0;
  return false;
}

function cloneDuctSize(size) {
  return size.kind === 'round' ? makeRoundSize(size.d) : makeRectSize(size.w, size.h);
}

// Display label AND tally key: '24×12' / '12"Ø'. Rect sizes are kept as-drawn
// (24×12 and 12×24 tally separately — width vs depth matters to the shop).
function formatDuctSize(size) {
  if (!isDuctSize(size)) return '?';
  return size.kind === 'round' ? size.d + '"Ø' : size.w + '×' + size.h;
}

/**
 * Duct run factory. All fields optional; defaults make a valid empty supply
 * run at 1" w.g. `opts.vertices` / `opts.segments` are used as-given (caller
 * owns validity — see validateDuctRun).
 */
function makeDuctRun(opts) {
  const o = opts || {};
  return {
    id: o.id || ductUid(),
    name: o.name || '',
    airside: DUCT_AIRSIDES.includes(o.airside) ? o.airside : 'supply',
    pressureClass: o.pressureClass != null ? String(o.pressureClass) : '1',
    linerType: o.linerType === 'liner' || o.linerType === 'wrap' ? o.linerType : null,
    linerThicknessIn: Number.isFinite(o.linerThicknessIn) && o.linerThicknessIn > 0 ? o.linerThicknessIn : 0,
    systemGroupId: o.systemGroupId || null,
    vertices: Array.isArray(o.vertices) ? o.vertices : [],
    segments: Array.isArray(o.segments) ? o.segments : [],
  };
}

/**
 * Fitting factory. `type` defaults to 'elbow90'; unknown types are kept only
 * via validateDuctFitting failing (factory normalizes to elbow90 so a bad
 * payload can't crash draw code).
 */
function makeDuctFitting(opts) {
  const o = opts || {};
  return {
    id: o.id || ductUid(),
    runId: o.runId || null,
    vertexIdx: Number.isInteger(o.vertexIdx) ? o.vertexIdx : null,
    position: o.position && Number.isFinite(o.position.x) && Number.isFinite(o.position.y)
      ? { x: o.position.x, y: o.position.y } : null,
    type: DUCT_FITTING_TYPES.includes(o.type) ? o.type : 'elbow90',
    size: isDuctSize(o.size) ? cloneDuctSize(o.size) : null,
    auto: !!o.auto,
  };
}

/** Validation: array of human-readable problems; [] means valid. */
function validateDuctRun(run) {
  const errs = [];
  if (!run || typeof run !== 'object') return ['run is not an object'];
  if (!run.id) errs.push('missing id');
  if (!DUCT_AIRSIDES.includes(run.airside)) errs.push('invalid airside: ' + run.airside);
  if (!Object.prototype.hasOwnProperty.call(DUCT_GAUGE_TABLE, run.pressureClass)) {
    errs.push('unknown pressure class: ' + run.pressureClass);
  }
  if (!Array.isArray(run.vertices)) errs.push('vertices is not an array');
  else run.vertices.forEach((v, i) => {
    if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y)) errs.push('vertex ' + i + ' is not {x,y}');
  });
  if (!Array.isArray(run.segments)) errs.push('segments is not an array');
  else {
    let prev = -1;
    run.segments.forEach((s, i) => {
      if (!s || !Number.isInteger(s.startVertexIdx)) { errs.push('segment ' + i + ' missing startVertexIdx'); return; }
      if (i === 0 && s.startVertexIdx !== 0) errs.push('segment 0 must start at vertex 0');
      if (s.startVertexIdx <= prev && i > 0) errs.push('segment ' + i + ' startVertexIdx not ascending');
      prev = s.startVertexIdx;
      if (Array.isArray(run.vertices) && s.startVertexIdx >= run.vertices.length && run.vertices.length > 0) {
        errs.push('segment ' + i + ' startVertexIdx out of range');
      }
      if (!isDuctSize(s.size)) errs.push('segment ' + i + ' has invalid size');
    });
    if (run.segments.length === 0 && Array.isArray(run.vertices) && run.vertices.length >= 2) {
      errs.push('run with vertices has no segments');
    }
  }
  return errs;
}

/** Validation: array of problems; [] means valid. */
function validateDuctFitting(f) {
  const errs = [];
  if (!f || typeof f !== 'object') return ['fitting is not an object'];
  if (!f.id) errs.push('missing id');
  if (!DUCT_FITTING_TYPES.includes(f.type)) errs.push('invalid type: ' + f.type);
  if (!isDuctSize(f.size)) errs.push('invalid size');
  if (f.vertexIdx == null && !f.position) errs.push('needs vertexIdx or position');
  return errs;
}

// --- 2. SMACNA gauge selection ----------------------------------------------
//
// Galvanized sheet weight, lb per sq ft, by gauge (standard galvanized sheet
// weights — the basis of every pounds number below).
const SHEET_WEIGHT_LB_PER_SQFT = { 26: 0.906, 24: 1.156, 22: 1.406, 20: 1.656, 18: 2.156 };

// DATA TABLE — gauge schedule keyed by pressure class (in. w.g., as strings)
// then by the LARGER side dimension (rect: max(w,h); round: diameter), inches.
// Rows are { maxDimIn, gauge }: first row whose maxDimIn >= dim wins.
//
// This is the simplified rule-of-thumb schedule (the full SMACNA HVAC Duct
// Construction Standards tables trade gauge against reinforcement spacing;
// estimating apps conventionally carry the unreinforced/typical column, which
// for 1" w.g. is the widely quoted ≤12→26 / ≤30→24 / ≤54→22 / ≤84→20 / else
// 18 ladder). Higher classes tighten the breaks. Adding the remaining classes
// (4", 6", 10" w.g.) is a data edit here — no code changes.
const DUCT_GAUGE_TABLE = {
  '1/2': [ // ½" w.g. — same schedule as 1"
    { maxDimIn: 12, gauge: 26 }, { maxDimIn: 30, gauge: 24 }, { maxDimIn: 54, gauge: 22 },
    { maxDimIn: 84, gauge: 20 }, { maxDimIn: Infinity, gauge: 18 },
  ],
  '1': [
    { maxDimIn: 12, gauge: 26 }, { maxDimIn: 30, gauge: 24 }, { maxDimIn: 54, gauge: 22 },
    { maxDimIn: 84, gauge: 20 }, { maxDimIn: Infinity, gauge: 18 },
  ],
  '2': [
    { maxDimIn: 10, gauge: 26 }, { maxDimIn: 24, gauge: 24 }, { maxDimIn: 48, gauge: 22 },
    { maxDimIn: 72, gauge: 20 }, { maxDimIn: Infinity, gauge: 18 },
  ],
  '3': [
    { maxDimIn: 8, gauge: 26 }, { maxDimIn: 20, gauge: 24 }, { maxDimIn: 40, gauge: 22 },
    { maxDimIn: 60, gauge: 20 }, { maxDimIn: Infinity, gauge: 18 },
  ],
};

/** Pressure classes the gauge table knows, in data order. */
const DUCT_PRESSURE_CLASSES = Object.keys(DUCT_GAUGE_TABLE);

/** The dimension the gauge schedule keys on: larger rect side, or diameter. */
function ductGoverningDimIn(size) {
  if (!isDuctSize(size)) return 0;
  return size.kind === 'round' ? size.d : Math.max(size.w, size.h);
}

/**
 * Auto-pick the gauge for a size at a pressure class (always overridable at
 * the weight call). Unknown pressure class falls back to '1' (the app default)
 * rather than failing — the override chip is the correction surface.
 */
function selectGauge(pressureClass, size) {
  const rows = DUCT_GAUGE_TABLE[pressureClass] || DUCT_GAUGE_TABLE['1'];
  const dim = ductGoverningDimIn(size);
  if (!(dim > 0)) return null;
  for (const row of rows) { if (dim <= row.maxDimIn) return row.gauge; }
  return rows[rows.length - 1].gauge;
}

// --- 3. Weight math ----------------------------------------------------------

/** Sheet-metal perimeter in inches: rect 2(w+h); round π·d. */
function ductPerimeterIn(size) {
  if (!isDuctSize(size)) return 0;
  return size.kind === 'round' ? Math.PI * size.d : 2 * (size.w + size.h);
}

/**
 * Pounds per linear foot for a size at a gauge:
 * perimeter(in)/12 → sq ft of sheet per LF, × sheet weight (lb/sq ft).
 * DUCT-PLAN worked numbers: 24×12 @ 24ga = 6.94, 20×12 @ 24ga = 6.17,
 * 16×10 @ 26ga = 3.93, 12"Ø @ 26ga = 2.85 (all lb/ft, 2-dp).
 * Returns null for an unknown gauge (callers show the override chip).
 */
function ductWeightPerFoot(size, gauge) {
  const w = SHEET_WEIGHT_LB_PER_SQFT[gauge];
  if (!w || !isDuctSize(size)) return null;
  return (ductPerimeterIn(size) / 12) * w;
}

/** Straight-duct pounds for a length: lb/ft × ft. Null for unknown gauge. */
function segmentPounds(size, gauge, lengthFt) {
  const perFt = ductWeightPerFoot(size, gauge);
  if (perFt == null || !Number.isFinite(lengthFt)) return null;
  return perFt * lengthFt;
}

// DATA TABLE — fitting weight as EQUIVALENT LINEAR FEET of straight duct of
// the fitting's size (shop rule of thumb: an elbow takes about as much metal
// and labor-weight as 5 LF of the run it sits in). lb = equivLF × lb/ft.
// Basis check against DUCT-PLAN's worked numbers @ 24×12 24ga (6.94 lb/ft):
// elbow 5 LF → 34.7 ≈ 35 lb; transition 2 LF → 13.9 ≈ 15; tap 1.5 → 10.4 ≈ 12.
// elbow45 and offset carry half/half-ish of a hard 90 (rule of thumb; edit here).
const FITTING_EQUIV_LF = {
  elbow90: 5,
  elbow45: 2.5,
  transition: 2,
  tap: 1.5,
  boot: 1,
  offset: 2.5,
};

/** Equivalent-LF for a fitting type (0 for unknown types). */
function fittingEquivalentLF(type) { return FITTING_EQUIV_LF[type] || 0; }

/** One fitting's pounds: equivLF × lb/ft of its size @ gauge. Null on unknown gauge. */
function fittingPounds(type, size, gauge) {
  const perFt = ductWeightPerFoot(size, gauge);
  if (perFt == null) return null;
  return fittingEquivalentLF(type) * perFt;
}

// Walk a run's segments into spans: [{ size, fromIdx, toIdx }] over vertices.
// The last segment runs to the final vertex. Degenerate runs (fewer than 2
// vertices, or no segments) yield [].
function runSegmentSpans(run) {
  const verts = run?.vertices || [];
  const segs = run?.segments || [];
  if (verts.length < 2 || !segs.length) return [];
  const spans = [];
  for (let i = 0; i < segs.length; i++) {
    const fromIdx = segs[i].startVertexIdx;
    const toIdx = i + 1 < segs.length ? segs[i + 1].startVertexIdx : verts.length - 1;
    if (toIdx > fromIdx) spans.push({ size: segs[i].size, fromIdx: fromIdx, toIdx: toIdx });
  }
  return spans;
}

// Default vertex distance when the caller passes none: plain Euclidean on the
// vertex coordinates (i.e. vertices already in feet). App code passes its
// scale glue: (a, b) => feet between two PDF-space points on this page.
function ductVertexDistDefault(a, b) {
  return Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
}

/**
 * Flatten one run into straight-duct items: [{ size, lengthFt, liner }].
 * distFt(a, b) converts a vertex pair to FEET (defaults to Euclidean on the
 * raw coordinates). `liner` carries the run's linerType (or null) so rollups
 * can derive insulation from the same items.
 */
function runStraightItems(run, distFt) {
  const d = distFt || ductVertexDistDefault;
  const verts = run?.vertices || [];
  return runSegmentSpans(run).map(span => {
    let len = 0;
    for (let i = span.fromIdx; i < span.toIdx; i++) len += d(verts[i], verts[i + 1]);
    return { size: span.size, lengthFt: len, liner: run.linerType || null };
  });
}

/**
 * Tally straight items by size: rows of { sizeKey, size, gauge, lengthFt,
 * lbPerFt, pounds } plus totals. `gaugeBySizeKey` (optional) overrides the
 * auto-picked gauge per size key (the override chip's data path).
 */
function tallyStraightBySize(items, pressureClass, gaugeBySizeKey) {
  const overrides = gaugeBySizeKey || {};
  const byKey = new Map();
  (items || []).forEach(it => {
    if (!isDuctSize(it.size) || !(it.lengthFt > 0)) return;
    const key = formatDuctSize(it.size);
    let row = byKey.get(key);
    if (!row) {
      const gauge = overrides[key] || selectGauge(pressureClass, it.size);
      row = { sizeKey: key, size: cloneDuctSize(it.size), gauge: gauge, lengthFt: 0, lbPerFt: ductWeightPerFoot(it.size, gauge) || 0, pounds: 0 };
      byKey.set(key, row);
    }
    row.lengthFt += it.lengthFt;
  });
  let totalLengthFt = 0, totalPounds = 0;
  const rows = [...byKey.values()];
  rows.forEach(row => {
    row.pounds = row.lengthFt * row.lbPerFt;
    totalLengthFt += row.lengthFt;
    totalPounds += row.pounds;
  });
  return { rows: rows, totalLengthFt: totalLengthFt, totalPounds: totalPounds };
}

/**
 * The schedule/bid rollup (DUCT-PLAN "The schedule prices like a bid").
 *
 * opts:
 *   straightItems     [{ size, lengthFt, liner? }] (e.g. from runStraightItems)
 *   fittings          [{ type, size }] (gauge auto-picked per size, overridable)
 *   pressureClass     gauge-table key (default '1')
 *   gaugeBySizeKey    { '24×12': 22, ... } per-size gauge overrides
 *   seamWastePct      % added to the subtotal as its own labeled line (default 0)
 *   fittingMode       'counted' (lb-eq per fitting) | 'factor' (% of straight lb)
 *   fittingFactorPct  the factor fallback (default 40 — DUCT-PLAN's quick-bid ≈40%)
 *
 * Returns { straight, fittings, fittingFactorPounds, fittingsAppliedPounds,
 *           subtotalPounds, seamWastePct, seamWastePounds, bidWeightPounds,
 *           linerSqFt, wrapSqFt }.
 * Both fitting numbers are always computed (the UI's Counted|Factor toggle
 * flips without recomputing); `fittingsAppliedPounds` follows fittingMode.
 */
function rollupDuct(opts) {
  const o = opts || {};
  const pressureClass = o.pressureClass != null ? String(o.pressureClass) : '1';
  const straight = tallyStraightBySize(o.straightItems, pressureClass, o.gaugeBySizeKey);

  // Fittings, counted: group by type+size.
  const fByKey = new Map();
  (o.fittings || []).forEach(f => {
    if (!isDuctSize(f.size)) return;
    const sizeKey = formatDuctSize(f.size);
    const key = f.type + '|' + sizeKey;
    let row = fByKey.get(key);
    if (!row) {
      const gauge = (o.gaugeBySizeKey || {})[sizeKey] || selectGauge(pressureClass, f.size);
      const lbEach = fittingPounds(f.type, f.size, gauge) || 0;
      row = { type: f.type, sizeKey: sizeKey, size: cloneDuctSize(f.size), gauge: gauge, count: 0, lbEach: lbEach, pounds: 0 };
      fByKey.set(key, row);
    }
    row.count++;
  });
  let fittingsCountedPounds = 0;
  const fittingRows = [...fByKey.values()];
  fittingRows.forEach(row => { row.pounds = row.count * row.lbEach; fittingsCountedPounds += row.pounds; });

  const fittingFactorPct = Number.isFinite(o.fittingFactorPct) ? o.fittingFactorPct : 40;
  const fittingFactorPounds = straight.totalPounds * (fittingFactorPct / 100);
  const fittingMode = o.fittingMode === 'factor' ? 'factor' : 'counted';
  const fittingsAppliedPounds = fittingMode === 'factor' ? fittingFactorPounds : fittingsCountedPounds;

  const subtotalPounds = straight.totalPounds + fittingsAppliedPounds;
  const seamWastePct = Number.isFinite(o.seamWastePct) ? o.seamWastePct : 0;
  const seamWastePounds = subtotalPounds * (seamWastePct / 100);
  const bidWeightPounds = subtotalPounds + seamWastePounds;

  // Insulation riding the same items: liner/wrap sq ft = LF × perimeter/12.
  let linerSqFt = 0, wrapSqFt = 0;
  (o.straightItems || []).forEach(it => {
    if (!isDuctSize(it.size) || !(it.lengthFt > 0)) return;
    if (it.liner === 'liner') linerSqFt += insulationSqFt(it.size, it.lengthFt);
    else if (it.liner === 'wrap') wrapSqFt += insulationSqFt(it.size, it.lengthFt);
  });

  return {
    straight: straight,
    fittings: { rows: fittingRows, mode: fittingMode, totalPounds: fittingsCountedPounds },
    fittingFactorPct: fittingFactorPct,
    fittingFactorPounds: fittingFactorPounds,
    fittingsAppliedPounds: fittingsAppliedPounds,
    subtotalPounds: subtotalPounds,
    seamWastePct: seamWastePct,
    seamWastePounds: seamWastePounds,
    bidWeightPounds: bidWeightPounds,
    linerSqFt: linerSqFt,
    wrapSqFt: wrapSqFt,
  };
}

/**
 * Convenience composition: runs (+ shared fittings list) → the full rollup.
 * distFt as in runStraightItems; remaining opts as in rollupDuct. Note the
 * pressure class comes from opts (a schedule-level choice); per-run classes
 * can be handled by calling rollupDuct per class and summing.
 */
function rollupRunsToSchedule(runs, fittings, opts) {
  const o = opts || {};
  const items = [];
  (runs || []).forEach(run => { items.push(...runStraightItems(run, o.distFt)); });
  return rollupDuct({ ...o, straightItems: items, fittings: fittings });
}

// --- 4. Insulation -----------------------------------------------------------

/** Insulation sq ft per LF of duct: perimeter(in)/12. */
function insulationSqFtPerFoot(size) { return ductPerimeterIn(size) / 12; }

/**
 * Liner/wrap square feet for a length of duct: LF × perimeter/12.
 * Simplification (documented on purpose): liner area uses the DUCT perimeter
 * (the sheet-metal perimeter ≈ the liner's glued face), and wrap uses the same
 * perimeter, ignoring the extra girth the wrap's own thickness adds — a few
 * percent, inside estimating noise and always on the safe side for liner.
 */
function insulationSqFt(size, lengthFt) {
  if (!isDuctSize(size) || !Number.isFinite(lengthFt) || lengthFt <= 0) return 0;
  return lengthFt * insulationSqFtPerFoot(size);
}

// --- 5. Ductulator -----------------------------------------------------------
//
// Equal-friction sizing uses the standard ASHRAE friction-chart fit for
// galvanized round duct (absolute roughness ≈ 0.0003 ft):
//
//   f = 0.109136 · Q^1.9 / D^5.02
//
// with f in in. w.g. per 100 ft, Q in CFM, D in inches — inverted for D:
//
//   D = (0.109136 · Q^1.9 / f)^(1/5.02)
//
// Anchor points (verified in duct-model.test.js, matching DUCT-PLAN §D1):
//   600 CFM @ 0.08 → 11.98" (ductulator reads 12–13"Ø)
//   150 CFM @ 0.08 →  7.09" (ductulator reads 7–8"Ø)
const DUCT_FRICTION_FIT = { coeff: 0.109136, qExp: 1.9, dExp: 5.02 };

/** Friction rate (in. w.g./100 ft) of Q CFM through a D-inch round duct. */
function frictionRateForRound(cfm, dIn) {
  if (!(cfm > 0) || !(dIn > 0)) return 0;
  return DUCT_FRICTION_FIT.coeff * Math.pow(cfm, DUCT_FRICTION_FIT.qExp) / Math.pow(dIn, DUCT_FRICTION_FIT.dExp);
}

/** Exact (unrounded) round diameter, inches, for CFM at a friction rate. */
function frictionRoundDiameterIn(cfm, frictionRate) {
  if (!(cfm > 0) || !(frictionRate > 0)) return 0;
  return Math.pow(DUCT_FRICTION_FIT.coeff * Math.pow(cfm, DUCT_FRICTION_FIT.qExp) / frictionRate, 1 / DUCT_FRICTION_FIT.dExp);
}

/** Round-duct free area in sq ft: π·d²/576 (d in inches). */
function roundAreaSqFt(dIn) { return Math.PI * dIn * dIn / 576; }

/** Velocity (fpm) of CFM through a d-inch round duct. */
function roundVelocityFpm(cfm, dIn) {
  const a = roundAreaSqFt(dIn);
  return a > 0 ? cfm / a : 0;
}

/** Smallest round diameter (inches, exact) that keeps velocity ≤ maxFpm. */
function velocityLimitedDiameterIn(cfm, maxFpm) {
  if (!(cfm > 0) || !(maxFpm > 0)) return 0;
  return Math.sqrt(576 * cfm / (Math.PI * maxFpm));
}

// Round a raw diameter UP to the next catalog size: whole inches to 10",
// even inches above (the common spiral/flex ladder), floor 4".
function roundUpToStockDiameter(rawIn) {
  if (!(rawIn > 0)) return 0;
  let d = Math.ceil(rawIn - 1e-9);
  if (d > 10 && d % 2 === 1) d += 1;
  return Math.max(4, d);
}

/**
 * Equal-friction round suggestion with velocity cap (DUCT-PLAN §5): the
 * suggested size is the LARGER of the friction answer and the velocity-cap
 * answer, and the result names which constraint bound.
 *
 * opts: { frictionRate = 0.08 (in/100ft), maxVelocityFpm = 1200 }
 * Returns { diameterIn, binding: 'friction'|'velocity', velocityFpm,
 *           frictionDiameterIn, velocityDiameterIn } or null for bad input.
 */
function suggestRoundDiameter(cfm, opts) {
  const o = opts || {};
  const frictionRate = o.frictionRate > 0 ? o.frictionRate : 0.08;
  const maxVelocityFpm = o.maxVelocityFpm > 0 ? o.maxVelocityFpm : 1200;
  if (!(cfm > 0)) return null;
  const fd = frictionRoundDiameterIn(cfm, frictionRate);
  const vd = velocityLimitedDiameterIn(cfm, maxVelocityFpm);
  const binding = vd > fd ? 'velocity' : 'friction';
  const diameterIn = roundUpToStockDiameter(Math.max(fd, vd));
  return {
    diameterIn: diameterIn,
    binding: binding,
    velocityFpm: roundVelocityFpm(cfm, diameterIn),
    frictionDiameterIn: fd,
    velocityDiameterIn: vd,
  };
}

/**
 * Rectangular equivalent diameter (equal friction/flow):
 *   De = 1.30 · (a·b)^0.625 / (a+b)^0.25   (inches)
 */
function rectEquivalentDiameterIn(w, h) {
  if (!(w > 0) || !(h > 0)) return 0;
  return 1.30 * Math.pow(w * h, 0.625) / Math.pow(w + h, 0.25);
}

/**
 * Pick a rectangular duct whose equivalent diameter meets/exceeds a target
 * round diameter. Candidates are even sizes (standard shop increments),
 * aspect ratio capped (default 4:1); among the qualifying rects the one with
 * the SMALLEST PERIMETER wins (least metal), tie-broken by the De closest to
 * the target (least oversize), then by the shallower depth.
 *
 * opts: { maxAspect = 4, maxDepthIn (optional plenum limit), minSideIn = 6,
 *         incrementIn = 2 }
 * Returns { w, h, equivalentDiameterIn } (w ≥ h) or null when nothing fits
 * (e.g. a depth limit too tight for the aspect cap).
 */
function suggestRectForRound(targetDIn, opts) {
  const o = opts || {};
  const maxAspect = o.maxAspect > 0 ? o.maxAspect : 4;
  const minSideIn = o.minSideIn > 0 ? o.minSideIn : 6;
  const inc = o.incrementIn > 0 ? o.incrementIn : 2;
  if (!(targetDIn > 0)) return null;
  const maxDepth = o.maxDepthIn > 0 ? o.maxDepthIn : Infinity;
  let best = null;
  // Depth (h) from the minimum up to the target-ish scale; width from h up to
  // the aspect cap. targetDIn × 2 depth is always enough (a square whose side
  // exceeds the target De qualifies well before that).
  const hMax = Math.min(maxDepth, Math.ceil(targetDIn * 2) + inc);
  for (let h = minSideIn; h <= hMax; h += inc) {
    for (let w = h; w <= h * maxAspect; w += inc) {
      const de = rectEquivalentDiameterIn(w, h);
      if (de < targetDIn) continue;
      const cand = { w: w, h: h, equivalentDiameterIn: de, perim: 2 * (w + h) };
      if (!best
        || cand.perim < best.perim
        || (cand.perim === best.perim && (cand.equivalentDiameterIn < best.equivalentDiameterIn
          || (cand.equivalentDiameterIn === best.equivalentDiameterIn && cand.h < best.h)))) {
        best = cand;
      }
      break; // wider w at this h only grows De and perimeter — first hit is the h-row's best
    }
  }
  if (!best) return null;
  return { w: best.w, h: best.h, equivalentDiameterIn: best.equivalentDiameterIn };
}

/**
 * The dual suggestion (DUCT-PLAN round-first: '10"Ø or 12×8'): round size by
 * equal friction + velocity cap, plus a rect equivalent, with the binding
 * constraint named. opts = suggestRoundDiameter opts + suggestRectForRound
 * opts (merged; maxDepthIn etc. pass through). Returns
 * { round: {...suggestRoundDiameter result}, rect: {w,h,equivalentDiameterIn}|null,
 *   binding } or null for bad input.
 */
function suggestRoundAndRect(cfm, opts) {
  const round = suggestRoundDiameter(cfm, opts);
  if (!round) return null;
  const rect = suggestRectForRound(round.diameterIn, opts);
  return { round: round, rect: rect, binding: round.binding };
}

// --- 6. Neck-size table ------------------------------------------------------
//
// DATA TABLE — rules of thumb, CFM → diffuser/neck suggestion (DUCT-PLAN
// master walkthrough: "150 CFM → 2×2 lay-in, 8"Ø neck" so exported layouts
// are submittal-grade). Rows are { maxCfm, neckDIn, device }; first row whose
// maxCfm >= cfm wins. Extend/edit here — no code changes.
const NECK_SIZE_TABLE = [
  { maxCfm: 150, neckDIn: 8, device: '2×2 lay-in diffuser' },
  { maxCfm: 300, neckDIn: 10, device: '2×2 lay-in diffuser' },
  { maxCfm: 450, neckDIn: 12, device: '2×2 lay-in diffuser' },
  { maxCfm: 700, neckDIn: 14, device: '2×4 lay-in diffuser' },
];

/**
 * Device suggestion for a drop's CFM. Above the table's top row, returns the
 * largest row with overCapacity: true (split the drop or pick a register by
 * hand). Returns null for non-positive/absent CFM.
 */
function suggestNeckSize(cfm) {
  if (!(cfm > 0)) return null;
  for (const row of NECK_SIZE_TABLE) {
    if (cfm <= row.maxCfm) return { maxCfm: row.maxCfm, neckDIn: row.neckDIn, device: row.device, overCapacity: false };
  }
  const last = NECK_SIZE_TABLE[NECK_SIZE_TABLE.length - 1];
  return { maxCfm: last.maxCfm, neckDIn: last.neckDIn, device: last.device, overCapacity: true };
}

// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // model
    DUCT_AIRSIDES, DUCT_FITTING_TYPES,
    makeRectSize, makeRoundSize, isDuctSize, cloneDuctSize, formatDuctSize,
    makeDuctRun, makeDuctFitting, validateDuctRun, validateDuctFitting,
    // gauge
    SHEET_WEIGHT_LB_PER_SQFT, DUCT_GAUGE_TABLE, DUCT_PRESSURE_CLASSES,
    ductGoverningDimIn, selectGauge,
    // weight
    ductPerimeterIn, ductWeightPerFoot, segmentPounds,
    FITTING_EQUIV_LF, fittingEquivalentLF, fittingPounds,
    runSegmentSpans, runStraightItems, tallyStraightBySize, rollupDuct, rollupRunsToSchedule,
    // insulation
    insulationSqFtPerFoot, insulationSqFt,
    // ductulator
    DUCT_FRICTION_FIT, frictionRateForRound, frictionRoundDiameterIn,
    roundAreaSqFt, roundVelocityFpm, velocityLimitedDiameterIn,
    suggestRoundDiameter, rectEquivalentDiameterIn, suggestRectForRound, suggestRoundAndRect,
    // necks
    NECK_SIZE_TABLE, suggestNeckSize,
  };
}

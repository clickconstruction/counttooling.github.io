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

/** Which inference rule anchored an auto fitting (D3). */
const DUCT_FITTING_ORIGINS = ['bend', 'step', 'tap'];

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
    // D3 — which inference rule anchored this fitting ('bend' | 'step' |
    // 'tap'; null for a hypothetical hand-placed one). Reclassifying keeps
    // the origin, so the reconciliation walk can still match the override to
    // the geometry that would re-infer at the same anchor.
    origin: DUCT_FITTING_ORIGINS.includes(o.origin) ? o.origin : null,
    // D3 — delete tombstone: a deleted fitting is kept as {auto:false,
    // suppressed:true} so re-inference cannot resurrect it. Suppressed
    // fittings are skipped by paint, hitTest, and the count tallies.
    suppressed: !!o.suppressed,
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

// --- 3b. Fitting inference (unit D3) -----------------------------------------
//
// Fittings COUNT THEMSELVES from run geometry (DUCT-PLAN "Fittings count
// themselves from geometry, always overridable" — the SMACNA-gauge-auto-pick
// philosophy). The walk is pure and deterministic, so re-running it after any
// edit converges (idempotent). Three rules:
//
//   bend — every INTERIOR vertex whose direction change is ≥30° logs an
//          elbow: ≥60° = elbow90, 30–60° = elbow45. Size = the INCOMING
//          segment's size at that vertex (the duct being bent). Shallower
//          bends are drafting wiggle, not fittings.
//   step — every segment boundary logs a transition (equivalently: every
//          committed sizeSteps entry — a boundary exists iff a step was
//          recorded). Size = the LARGER of the two sides (governing dim,
//          then perimeter — the metal is cut from the big end).
//   tap  — a run whose FIRST vertex lands within tapSnapDist of another
//          run's polyline logs a tap ON THE PARENT run (nearest parent
//          wins), position-anchored at the child's first vertex; size = the
//          child's STARTING size (the branch collar).
//
// RECONCILIATION (the auto/manual contract, reconcileDuctFittings):
//   - auto fittings are RE-DERIVED on every walk. Each carries an anchor key
//     (runId + origin + vertexIdx/position), and a re-derived fitting keeps
//     the id of the auto fitting it replaces — stable identity across edits.
//   - non-auto fittings (reclassified via the marker menu, or delete
//     tombstones with suppressed:true) are PRESERVED BY ANCHOR: they survive
//     verbatim, and an inferred auto at the same anchor is dropped — the
//     human's call outranks the walk. They are pruned only when their anchor
//     no longer resolves (run deleted / vertexIdx gone).
//   - deleting a fitting flips it to a suppressed tombstone ({auto:false,
//     suppressed:true}) instead of splicing, so the walk cannot resurrect
//     it; tombstones are invisible to paint/hitTest/counts.

/** Inference thresholds (degrees) + the tap snap distance (PDF-space pts —
 * ~12 units = the hitTest radius at zoom 1; a data constant, deliberately
 * zoom-independent so re-inference is deterministic). */
const DUCT_ELBOW_MIN_DEG = 30;
const DUCT_ELBOW90_MIN_DEG = 60;
const DUCT_TAP_SNAP_PDF = 12;

/** Direction change (degrees, 0 = straight through) at vertex b of a→b→c. */
function ductBendAngleDeg(a, b, c) {
  const v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
  if (!m1 || !m2) return 0;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)));
  return Math.acos(cos) * 180 / Math.PI;
}

/** The larger of two duct sizes: governing dim, then perimeter; ties → a. */
function largerDuctSize(a, b) {
  if (!isDuctSize(a)) return isDuctSize(b) ? b : null;
  if (!isDuctSize(b)) return a;
  const da = ductGoverningDimIn(a), db = ductGoverningDimIn(b);
  if (db > da) return b;
  if (da > db) return a;
  return ductPerimeterIn(b) > ductPerimeterIn(a) ? b : a;
}

/** The size of the segment ARRIVING at a vertex (segments[0] for vertex 0). */
function ductSizeAtVertex(run, vertexIdx) {
  const spans = runSegmentSpans(run);
  for (const span of spans) { if (vertexIdx <= span.toIdx) return span.size; }
  return spans.length ? spans[spans.length - 1].size : null;
}

// Point-to-segment distance, local so the module stays dependency-free.
function ductDistToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Min distance from a point to a run's polyline (Infinity for <2 vertices). */
function ductDistToPolyline(pt, verts) {
  let min = Infinity;
  for (let i = 0; i < (verts?.length || 0) - 1; i++) {
    min = Math.min(min, ductDistToSegment(pt, verts[i], verts[i + 1]));
  }
  return min;
}

/**
 * The pure inference walk: all AUTO fittings the geometry implies for one
 * annotation universe's runs (a canvas). Returns plain records WITHOUT ids —
 * reconcileDuctFittings assigns/preserves those. opts.tapSnapDist overrides
 * the tap tolerance (default DUCT_TAP_SNAP_PDF).
 */
function inferAutoDuctFittings(runs, opts) {
  const tapSnap = opts?.tapSnapDist > 0 ? opts.tapSnapDist : DUCT_TAP_SNAP_PDF;
  const out = [];
  const list = (runs || []).filter(r => r && (r.vertices?.length || 0) >= 2 && (r.segments?.length || 0) >= 1);
  list.forEach(run => {
    const verts = run.vertices;
    // bends: interior vertices only (endpoints can't be elbows).
    for (let v = 1; v < verts.length - 1; v++) {
      const ang = ductBendAngleDeg(verts[v - 1], verts[v], verts[v + 1]);
      if (ang < DUCT_ELBOW_MIN_DEG - 1e-9) continue;
      out.push({
        runId: run.id, vertexIdx: v, origin: 'bend',
        type: ang >= DUCT_ELBOW90_MIN_DEG - 1e-9 ? 'elbow90' : 'elbow45',
        size: ductSizeAtVertex(run, v), auto: true,
      });
    }
    // steps: every segment boundary is a transition.
    for (let i = 1; i < run.segments.length; i++) {
      const from = run.segments[i - 1].size, to = run.segments[i].size;
      const size = largerDuctSize(from, to);
      if (!size) continue;
      out.push({ runId: run.id, vertexIdx: run.segments[i].startVertexIdx, origin: 'step', type: 'transition', size: size, auto: true });
    }
  });
  // taps: child's first vertex on a parent's polyline → tap ON THE PARENT.
  list.forEach(child => {
    const start = child.vertices[0];
    let parent = null, best = Infinity;
    list.forEach(other => {
      if (other === child || other.id === child.id) return;
      const d = ductDistToPolyline(start, other.vertices);
      if (d <= tapSnap && d < best) { best = d; parent = other; }
    });
    if (!parent) return;
    out.push({
      runId: parent.id, position: { x: start.x, y: start.y }, origin: 'tap',
      type: 'tap', size: child.segments[0].size, auto: true,
    });
  });
  return out;
}

/** Stable anchor identity for reconciliation: runId + origin + anchor. */
function ductFittingAnchorKey(f) {
  const anchor = f.vertexIdx != null ? 'v' + f.vertexIdx
    : f.position ? 'p' + f.position.x.toFixed(3) + ',' + f.position.y.toFixed(3) : 'none';
  return (f.runId || '') + '|' + (f.origin || 'manual') + '|' + anchor;
}

/** Resolve a fitting's PDF-space anchor point against its run, or null when
 * the anchor no longer exists (run deleted / vertexIdx out of range).
 * vertexIdx wins when both are present (geometry-derived redraws). */
function ductFittingAnchor(f, runs) {
  if (!f) return null;
  if (f.vertexIdx != null) {
    const run = (runs || []).find(r => r && r.id === f.runId);
    const v = run?.vertices?.[f.vertexIdx];
    return v ? { x: v.x, y: v.y } : null;
  }
  if (f.position) {
    if (f.runId && !(runs || []).some(r => r && r.id === f.runId)) return null;   // parent gone → tap gone
    return { x: f.position.x, y: f.position.y };
  }
  return null;
}

/** Outgoing unit direction at a fitting's anchor (for oriented glyphs like
 * the transition chevrons); null for position-anchored/unresolvable ones. */
function ductFittingOutDirection(f, runs) {
  if (!f || f.vertexIdx == null) return null;
  const run = (runs || []).find(r => r && r.id === f.runId);
  const verts = run?.vertices || [];
  const v = f.vertexIdx;
  const a = verts[v], b = verts[v + 1] || null;
  const from = b ? a : verts[v - 1], to = b || a;
  if (!from || !to) return null;
  const dx = to.x - from.x, dy = to.y - from.y;
  const m = Math.hypot(dx, dy);
  return m > 0 ? { x: dx / m, y: dy / m } : null;
}

/**
 * Reconcile a canvas's fitting list against a fresh inference walk.
 * `existing` = the current ductFittings, `inferred` = inferAutoDuctFittings'
 * output, `runs` = the canvas's ductRuns (anchor pruning). Returns the NEW
 * list (never mutates inputs): non-auto fittings with live anchors survive
 * verbatim (and suppress a same-anchor inferred auto); autos are re-derived,
 * keeping their prior id when the anchor matches. Idempotent: reconciling
 * the result against the same walk returns a deep-equal list.
 */
function reconcileDuctFittings(existing, inferred, runs) {
  const out = [];
  const byKey = new Map();
  (existing || []).forEach(f => { if (f) byKey.set(ductFittingAnchorKey(f), f); });
  (existing || []).forEach(f => {
    if (!f || f.auto) return;
    if (ductFittingAnchor(f, runs)) out.push(f);   // manual/tombstone survives while its anchor does
  });
  (inferred || []).forEach(inf => {
    const prior = byKey.get(ductFittingAnchorKey(inf));
    if (prior && !prior.auto) return;   // the human's override outranks the walk
    out.push(makeDuctFitting({ ...inf, id: prior ? prior.id : inf.id, auto: true }));
  });
  return out;
}

/**
 * Minimal counts surface for D4/D5: tally fittings by type + size key.
 * Skips suppressed tombstones. Returns rows [{ type, sizeKey, count }] in
 * DUCT_FITTING_TYPES order, then by sizeKey.
 */
function tallyDuctFittingCounts(fittings) {
  const byKey = new Map();
  (fittings || []).forEach(f => {
    if (!f || f.suppressed || !DUCT_FITTING_TYPES.includes(f.type)) return;
    const sizeKey = formatDuctSize(f.size);
    const key = f.type + '|' + sizeKey;
    const row = byKey.get(key) || { type: f.type, sizeKey: sizeKey, count: 0 };
    row.count++;
    byKey.set(key, row);
  });
  return [...byKey.values()].sort((a, b) =>
    (DUCT_FITTING_TYPES.indexOf(a.type) - DUCT_FITTING_TYPES.indexOf(b.type))
    || (a.sizeKey < b.sizeKey ? -1 : a.sizeKey > b.sizeKey ? 1 : 0));
}

// --- 3c. Design-build accumulation (unit D6) ---------------------------------
//
// DUCT-PLAN "Design-build (primary)": air devices carry CFM; while the main is
// traced the size chip suggests the ductulator answer for the remaining
// downstream CFM. The pure logic here is three layers:
//
//   ATTACHMENT — a device (a placed counter marker whose counter type has a
//   CFM) belongs to the run whose polyline passes NEAREST its position, when
//   that distance is within the tap-snap tolerance (DUCT_TAP_SNAP_PDF — the
//   same constant D3's tap inference uses, so "the flex lands here" means the
//   same thing for a branch run and for a diffuser). Devices beyond snap of
//   every run are UNATTACHED. A device's system is derived from its attachment
//   (DUCT-PLAN §2 "devices inherit from the run that taps them"): the attached
//   run's systemGroupId; an unattached device falls back to the marker's own
//   group assignment, else no system.
//
//   NETWORK — runs connect by D3's tap rule: a run whose FIRST vertex lands
//   within tap-snap of another run's polyline is that parent's CHILD, joined
//   at the tap arclength. Runs with no parent are roots. Each run is oriented
//   from its EQUIPMENT END outward: a child's equipment end is always vertex 0
//   (the tap — air enters there); a root's equipment end is vertex 0 unless an
//   equipment position is given and the run's LAST vertex is nearer to it
//   (a return main traced from the far grille toward the unit).
//
//   ACCUMULATION — the CFM crossing a point on a run is the total CFM of
//   devices served BEYOND that point, away from the equipment: devices
//   attached further along the run, plus the whole subtree of every child
//   tapped beyond it. AIRSIDE: on supply, air flows equipment → devices; on
//   return it flows devices → equipment — the direction reverses but the
//   cross-section magnitude is identical (the duct at P carries exactly the
//   air of the far-side devices, outbound or inbound), so ONE traversal
//   serves both airsides and the equipment end sets the orientation.
//
// All positions/arclengths are raw vertex coordinates (PDF-space in the app).
// Cycle-safe (two runs tap-snapping each other cannot loop the walk).

/** Nearest point on a polyline: { dist, s } — s = arclength from vertex 0 to
 * the nearest point. { dist: Infinity, s: 0 } for fewer than 2 vertices. */
function ductNearestOnPolyline(p, verts) {
  let best = { dist: Infinity, s: 0 };
  let acc = 0;
  for (let i = 0; i < (verts?.length || 0) - 1; i++) {
    const a = verts[i], b = verts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    const segLen = Math.sqrt(len2);
    if (d < best.dist) best = { dist: d, s: acc + t * segLen };
    acc += segLen;
  }
  return best;
}

/** Total polyline arclength of a run's vertices. */
function ductPolylineLength(verts) {
  let acc = 0;
  for (let i = 0; i < (verts?.length || 0) - 1; i++) acc += Math.hypot(verts[i + 1].x - verts[i].x, verts[i + 1].y - verts[i].y);
  return acc;
}

/**
 * The attachment rule. devices = [{ x, y, cfm, … }]; runs = duct runs.
 * Returns { attached: [{ device, runId, s, dist }], unattached: [device] }.
 * Nearest run within opts.snapDist (default DUCT_TAP_SNAP_PDF) wins; s is the
 * arclength (from vertex 0) of the nearest point on that run.
 */
function attachDuctDevices(devices, runs, opts) {
  const snap = opts?.snapDist > 0 ? opts.snapDist : DUCT_TAP_SNAP_PDF;
  const list = (runs || []).filter(r => r && (r.vertices?.length || 0) >= 2);
  const attached = [], unattached = [];
  (devices || []).forEach(dev => {
    if (!dev || !Number.isFinite(dev.x) || !Number.isFinite(dev.y)) return;
    let best = null;
    list.forEach(run => {
      const hit = ductNearestOnPolyline(dev, run.vertices);
      if (hit.dist <= snap && (!best || hit.dist < best.dist)) best = { device: dev, runId: run.id, s: hit.s, dist: hit.dist };
    });
    if (best) attached.push(best);
    else unattached.push(dev);
  });
  return { attached: attached, unattached: unattached };
}

/**
 * Tap links between runs (D3's tap rule, reused for the network walk): a run
 * whose FIRST vertex lands within snap of another run's polyline is that
 * parent's child. Returns [{ childId, parentId, s }] — s = arclength along
 * the PARENT of the tap point. Nearest parent wins.
 */
function ductChildLinks(runs, opts) {
  const snap = opts?.snapDist > 0 ? opts.snapDist : DUCT_TAP_SNAP_PDF;
  const list = (runs || []).filter(r => r && (r.vertices?.length || 0) >= 2);
  const out = [];
  list.forEach(child => {
    const start = child.vertices[0];
    let best = null;
    list.forEach(parent => {
      if (parent === child || parent.id === child.id) return;
      const hit = ductNearestOnPolyline(start, parent.vertices);
      if (hit.dist <= snap && (!best || hit.dist < best.dist)) best = { childId: child.id, parentId: parent.id, s: hit.s, dist: hit.dist };
    });
    if (best) out.push({ childId: best.childId, parentId: best.parentId, s: best.s });
  });
  return out;
}

/**
 * A device's system, derived from attachment (DUCT-PLAN §2): the nearest-run-
 * within-snap's systemGroupId; else the device's own groupId; else null.
 */
function ductDeviceSystemId(device, runs, opts) {
  const { attached } = attachDuctDevices([device], runs, opts);
  if (attached.length) {
    const run = (runs || []).find(r => r && r.id === attached[0].runId);
    return run?.systemGroupId || null;
  }
  return device?.groupId || null;
}

// Is vertex 0 the equipment end of this run? Children: always (air enters at
// the tap). Roots: yes unless equipmentPos sits nearer the LAST vertex.
function ductEquipmentEndIsStart(run, isChild, equipmentPos) {
  if (isChild || !equipmentPos) return true;
  const verts = run.vertices || [];
  if (verts.length < 2) return true;
  const d0 = Math.hypot(equipmentPos.x - verts[0].x, equipmentPos.y - verts[0].y);
  const d1 = Math.hypot(equipmentPos.x - verts[verts.length - 1].x, equipmentPos.y - verts[verts.length - 1].y);
  return d0 <= d1;
}

/**
 * Downstream CFM at a point on a run (the accumulation query).
 *
 * opts: { runs, devices, runId, s, equipmentPos?, snapDist? }
 *   - runId + s name the query point: s = arclength from the run's VERTEX 0
 *     (orientation is resolved internally from the equipment end).
 *   - devices as in attachDuctDevices (only cfm > 0 entries count).
 *
 * Returns the total CFM of devices served beyond that point away from the
 * equipment — attached further along this run (inclusive of the point, eps
 * 1e-6) plus the full subtree of children tapped beyond it. Unattached
 * devices are excluded. Returns null when the run is unknown.
 */
function ductDownstreamCfm(opts) {
  const o = opts || {};
  const runs = (o.runs || []).filter(r => r && (r.vertices?.length || 0) >= 2);
  const run = runs.find(r => r.id === o.runId);
  if (!run) return null;
  const EPS = 1e-6;
  const links = ductChildLinks(runs, o);
  const parentOf = new Map(links.map(l => [l.childId, l]));
  const childrenOf = new Map();
  links.forEach(l => {
    if (!childrenOf.has(l.parentId)) childrenOf.set(l.parentId, []);
    childrenOf.get(l.parentId).push(l);
  });
  const { attached } = attachDuctDevices((o.devices || []).filter(d => d && d.cfm > 0), runs, o);
  const devsOn = new Map();
  attached.forEach(a => {
    if (!devsOn.has(a.runId)) devsOn.set(a.runId, []);
    devsOn.get(a.runId).push(a);
  });
  // Oriented arclength: distance from the equipment end.
  const fromEquip = (r, sRaw) => {
    const isChild = parentOf.has(r.id);
    return ductEquipmentEndIsStart(r, isChild, o.equipmentPos) ? sRaw : ductPolylineLength(r.vertices) - sRaw;
  };
  const subtree = (rid, visited) => {
    if (visited.has(rid)) return 0;
    visited.add(rid);
    let sum = 0;
    (devsOn.get(rid) || []).forEach(a => { sum += a.device.cfm; });
    (childrenOf.get(rid) || []).forEach(l => { sum += subtree(l.childId, visited); });
    return sum;
  };
  const qs = fromEquip(run, Number.isFinite(o.s) ? o.s : 0);
  let total = 0;
  (devsOn.get(run.id) || []).forEach(a => { if (fromEquip(run, a.s) >= qs - EPS) total += a.device.cfm; });
  const visited = new Set([run.id]);
  (childrenOf.get(run.id) || []).forEach(l => {
    if (fromEquip(run, l.s) >= qs - EPS) total += subtree(l.childId, visited);
  });
  return total;
}

/**
 * Remaining downstream CFM for an IN-PROGRESS trace (the live suggestion's
 * number — DUCT-PLAN "every tap subtracts its air … the remaining downstream
 * CFM"). The draft is assumed to be heading toward everything its system has
 * not served yet:
 *
 *   remaining = Σ cfm of the system's devices
 *             − Σ cfm of devices already SERVED (attached to a committed run
 *               of the same system, or passed by the draft — attached to the
 *               draft polyline strictly BEHIND its tip).
 *
 * A device the tip has just reached (its nearest point IS the tip) is still
 * downstream — the segment being sized carries its air; it flips to served
 * once the trace moves past it.
 *
 * System scope: a device is IN scope when its derived system (attachment
 * against committed runs + the draft, else its own groupId) matches the
 * draft's systemGroupId, or when it has no system at all (the unassigned
 * pool is assumed to belong to whatever is being traced — D7's balance
 * badges are the multi-system correction surface).
 *
 * opts: { runs (committed), draft ({ vertices, segments?, systemGroupId? }),
 *         devices, snapDist? }
 * Returns { cfm, totalCfm, servedCfm } or null when no in-scope device has
 * CFM (the clean-absence rule — no data, no suggestion).
 */
function ductDraftRemainingCfm(opts) {
  const o = opts || {};
  const draft = o.draft;
  if (!draft) return null;
  const EPS = 1e-6;
  const draftRun = { id: '__draft__', systemGroupId: draft.systemGroupId || null, vertices: draft.vertices || [], segments: draft.segments || [] };
  const committed = (o.runs || []).filter(r => r && (r.vertices?.length || 0) >= 2);
  const all = draftRun.vertices.length >= 2 ? committed.concat([draftRun]) : committed;
  const devices = (o.devices || []).filter(d => d && d.cfm > 0);
  const { attached, unattached } = attachDuctDevices(devices, all, o);
  const sys = draftRun.systemGroupId;
  const runById = new Map(all.map(r => [r.id, r]));
  const tipLen = ductPolylineLength(draftRun.vertices);
  let totalCfm = 0, servedCfm = 0;
  attached.forEach(a => {
    const run = runById.get(a.runId);
    const devSys = run.id === '__draft__' ? sys : (run.systemGroupId || null);
    if (devSys !== sys) return;   // another system's device — out of scope
    totalCfm += a.device.cfm;
    if (run.id === '__draft__') {
      if (a.s < tipLen - EPS) servedCfm += a.device.cfm;   // passed by the trace
    } else {
      servedCfm += a.device.cfm;   // a committed run of this system serves it
    }
  });
  unattached.forEach(d => {
    const devSys = d.groupId || null;
    if (devSys !== null && devSys !== sys) return;   // assigned elsewhere
    totalCfm += d.cfm;   // unserved — assumed downstream of this trace
  });
  if (!(totalCfm > 0)) return null;
  return { cfm: totalCfm - servedCfm, totalCfm: totalCfm, servedCfm: servedCfm };
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

// --- 5b. Stroke-width mapping (D2 drawing tool) ------------------------------
//
// DATA TABLE — canvas stroke width for a duct run, stepped by the size's
// governing dimension (larger rect side / round diameter, inches). This is the
// D2 "stroke width steps with the size" mapping: SYMBOLIC bands (a bigger duct
// reads bolder at a glance), not true-to-scale width (that's D8's true-width
// ghost). Values are screen px on the live overlay (same constant-screen-weight
// convention as line strokes; the export env multiplies by its raster scale).
// Rows are { maxDimIn, px }: first row whose maxDimIn >= dim wins.
const DUCT_STROKE_BANDS = [
  { maxDimIn: 8, px: 3 },
  { maxDimIn: 14, px: 4 },
  { maxDimIn: 20, px: 5 },
  { maxDimIn: 28, px: 6 },
  { maxDimIn: 40, px: 8 },
  { maxDimIn: 60, px: 10 },
  { maxDimIn: Infinity, px: 12 },
];

/** Stroke width (px) for a duct size; 3 (the smallest band) for bad sizes. */
function ductStrokePx(size) {
  const dim = ductGoverningDimIn(size);
  if (!(dim > 0)) return DUCT_STROKE_BANDS[0].px;
  for (const row of DUCT_STROKE_BANDS) { if (dim <= row.maxDimIn) return row.px; }
  return DUCT_STROKE_BANDS[DUCT_STROKE_BANDS.length - 1].px;
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
    DUCT_AIRSIDES, DUCT_FITTING_TYPES, DUCT_FITTING_ORIGINS,
    makeRectSize, makeRoundSize, isDuctSize, cloneDuctSize, formatDuctSize,
    makeDuctRun, makeDuctFitting, validateDuctRun, validateDuctFitting,
    // fitting inference (D3)
    DUCT_ELBOW_MIN_DEG, DUCT_ELBOW90_MIN_DEG, DUCT_TAP_SNAP_PDF,
    ductBendAngleDeg, largerDuctSize, ductSizeAtVertex, ductDistToPolyline,
    inferAutoDuctFittings, ductFittingAnchorKey, ductFittingAnchor,
    ductFittingOutDirection, reconcileDuctFittings, tallyDuctFittingCounts,
    // design-build accumulation (D6)
    ductNearestOnPolyline, ductPolylineLength, attachDuctDevices, ductChildLinks,
    ductDeviceSystemId, ductEquipmentEndIsStart, ductDownstreamCfm, ductDraftRemainingCfm,
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
    // drawing (D2)
    DUCT_STROKE_BANDS, ductStrokePx,
    // necks
    NECK_SIZE_TABLE, suggestNeckSize,
  };
}

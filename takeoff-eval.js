// Takeoff eval kernel — Wave 3.1 of PipeTooling's estimator-twin pipeline
// (docs/ESTIMATOR_TWIN_PIPELINE_PLAN.md): diff two takeoffs over the SAME plan set —
// counts per counter name and feet per line-type name — so an agent-placed takeoff can be
// scored against a human reference (or any two revisions compared). Pure data-in/data-out
// over the saved project `data` JSON (the save-engine shape: pages[].canvases[].annotations,
// palette in counters/lineTypes, per-page scale {pixelsPerUnit, unit}).
//
// Denomination discipline (the copy-tooling-feet rule): lengths are DECIMAL FEET whenever a
// page scale exists; unscaled pages contribute px and are reported separately, never summed
// into feet. Join key is the palette item's NAME (trimmed, case-insensitive) — ids differ
// across projects by construction.
//
// Works in Node (`module.exports`) and the browser (attaches to window) with no deps.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TakeoffEval = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
  function polyLen(points) {
    let d = 0;
    for (let i = 1; i < points.length; i++) d += dist(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    return d;
  }
  const keyOf = (name) => String(name ?? '').trim().toLowerCase();

  /** Tally one project's saved data: { counts: {key:{name,count}}, feet: {key:{name,feet,px}} } */
  function tally(data) {
    const counterName = new Map((data?.counters ?? []).map((c) => [c.id, c.name]));
    const lineName = new Map((data?.lineTypes ?? []).map((lt) => [lt.id, lt.name]));
    const counts = {};
    const feet = {};
    for (const page of data?.pages ?? []) {
      const ppu = page?.scale?.pixelsPerUnit > 0 ? page.scale.pixelsPerUnit : null;
      // Unit rule: scale.unit is feet in practice; a non-ft unit still normalizes via
      // pixelsPerUnit only when the caller pre-normalized — we report ft for scaled pages
      // and px for unscaled, mirroring the app's export discipline.
      for (const cv of page?.canvases ?? []) {
        const ann = cv?.annotations ?? {};
        for (const [cid, marks] of Object.entries(ann.counterMarkers ?? {})) {
          const name = counterName.get(cid) ?? cid;
          const k = keyOf(name);
          counts[k] = counts[k] || { name, count: 0 };
          counts[k].count += Array.isArray(marks) ? marks.length : 0;
        }
        const addLen = (ltId, px) => {
          const name = lineName.get(ltId) ?? ltId;
          const k = keyOf(name);
          feet[k] = feet[k] || { name, feet: 0, px: 0 };
          if (ppu) feet[k].feet += px / ppu;
          else feet[k].px += px;
        };
        for (const q of ann.quickLines ?? []) addLen(q.lineTypeId, dist(q.x1, q.y1, q.x2, q.y2));
        for (const pl of ann.polylines ?? []) addLen(pl.lineTypeId, polyLen(pl.points ?? []));
      }
    }
    return { counts, feet };
  }

  /** Diff candidate vs reference. Every key from either side appears; deltas are
   * candidate − reference. `verdict` per row: 'match' | 'over' | 'under' | 'missing' |
   * 'extra' (missing = in reference only; extra = in candidate only). */
  function diffTakeoffs(candidateData, referenceData, opts) {
    const feetTolerance = opts?.feetTolerance ?? 1; // ± ft considered a match
    const a = tally(candidateData);
    const b = tally(referenceData);
    const countRows = [];
    for (const k of new Set([...Object.keys(a.counts), ...Object.keys(b.counts)])) {
      const ca = a.counts[k]?.count ?? 0;
      const cb = b.counts[k]?.count ?? 0;
      countRows.push({
        name: (a.counts[k] ?? b.counts[k]).name,
        candidate: ca, reference: cb, delta: ca - cb,
        verdict: ca === cb ? 'match' : cb === 0 ? 'extra' : ca === 0 ? 'missing' : ca > cb ? 'over' : 'under',
      });
    }
    const feetRows = [];
    for (const k of new Set([...Object.keys(a.feet), ...Object.keys(b.feet)])) {
      const fa = a.feet[k]?.feet ?? 0;
      const fb = b.feet[k]?.feet ?? 0;
      const pxa = a.feet[k]?.px ?? 0;
      const pxb = b.feet[k]?.px ?? 0;
      feetRows.push({
        name: (a.feet[k] ?? b.feet[k]).name,
        candidate_ft: Math.round(fa * 100) / 100, reference_ft: Math.round(fb * 100) / 100,
        delta_ft: Math.round((fa - fb) * 100) / 100,
        unscaled_px: pxa || pxb ? { candidate: Math.round(pxa), reference: Math.round(pxb) } : null,
        verdict: Math.abs(fa - fb) <= feetTolerance && !pxa === !pxb ? 'match' : fb === 0 && pxb === 0 ? 'extra' : fa === 0 && pxa === 0 ? 'missing' : fa > fb ? 'over' : 'under',
      });
    }
    const countMatches = countRows.filter((r) => r.verdict === 'match').length;
    return {
      counts: countRows.sort((x, y) => x.name.localeCompare(y.name)),
      feet: feetRows.sort((x, y) => x.name.localeCompare(y.name)),
      summary: {
        count_rows: countRows.length,
        count_matches: countMatches,
        count_accuracy: countRows.length ? Math.round((countMatches / countRows.length) * 1000) / 10 : 100,
        feet_rows: feetRows.length,
        feet_matches: feetRows.filter((r) => r.verdict === 'match').length,
      },
    };
  }

  return { tally, diffTakeoffs };
});

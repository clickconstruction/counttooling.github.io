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

  // Child-count rules (features/child-counts.js): per 'count' = qty × marks; per 'run' = qty
  // × runs; per 'ft' = qty × ceil(runFeet / ftInterval), computed PER RUN on scaled runs
  // only (px runs are excluded, never guessed — the same discipline as the length totals).
  function childTotalsFor(rules, marks, runsFeet) {
    const out = [];
    for (const r of rules || []) {
      const qty = Number(r.qty) || 0;
      if (!qty) continue;
      let total = 0;
      if (r.per === 'count') total = qty * marks;
      else if (r.per === 'run') total = qty * runsFeet.length;
      else if (r.per === 'ft') total = runsFeet.reduce((s, f) => s + (f > 0 ? qty * Math.ceil(f / (Number(r.ftInterval) || 10)) : 0), 0);
      if (total > 0) out.push({ name: r.name, total });
    }
    return out;
  }

  /**
   * Tally one project's saved data:
   *   { counts: {key:{name,count}}, feet: {key:{name,feet,px}},
   *     groups: {gkey:{name, counts:{key:{name,count}}, feet:{key:{name,feet,px}}}}   (v2 marks/lines carry group ids)
   *     children: {key:{name,total}} }                                                (palette childCounts rules)
   * Group key '' is the untagged bucket. Multiply zones are NOT applied (marks are counted as
   * placed), matching the reviewer's "physically placed" view; child totals follow the same rule.
   */
  function tally(data) {
    const counterName = new Map((data?.counters ?? []).map((c) => [c.id, c.name]));
    const lineName = new Map((data?.lineTypes ?? []).map((lt) => [lt.id, lt.name]));
    const groupName = new Map((data?.groups ?? []).map((g) => [g.id, g.name]));
    const counts = {};
    const feet = {};
    const groups = {};
    const marksByCounter = {};      // counterId -> marks
    const runsByLineType = {};      // lineTypeId -> [feet per run] (px runs contribute 0)
    const groupBucket = (gid) => {
      const gk = gid ? keyOf(groupName.get(gid) ?? gid) : '';
      groups[gk] = groups[gk] || { name: gid ? (groupName.get(gid) ?? String(gid)) : '', counts: {}, feet: {} };
      return groups[gk];
    };
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
          const list = Array.isArray(marks) ? marks : [];
          counts[k].count += list.length;
          marksByCounter[cid] = (marksByCounter[cid] || 0) + list.length;
          for (const m of list) {
            const g = groupBucket(m?.group || null);
            g.counts[k] = g.counts[k] || { name, count: 0 };
            g.counts[k].count += 1;
          }
        }
        const addLen = (ltId, px, gid, drop) => {
          const name = lineName.get(ltId) ?? ltId;
          const k = keyOf(name);
          feet[k] = feet[k] || { name, feet: 0, px: 0 };
          const g = groupBucket(gid || null);
          g.feet[k] = g.feet[k] || { name, feet: 0, px: 0 };
          // drops are feet of vertical at the line ends (v2 / the Drop tool); they ride the
          // feet bucket whether or not the page is scaled, because they are stated in feet
          const dropFt = drop || 0;
          if (ppu) { const f = px / ppu + dropFt; feet[k].feet += f; g.feet[k].feet += f; (runsByLineType[ltId] = runsByLineType[ltId] || []).push(f); }
          else { feet[k].px += px; g.feet[k].px += px; if (dropFt) { feet[k].feet += dropFt; g.feet[k].feet += dropFt; } (runsByLineType[ltId] = runsByLineType[ltId] || []).push(0); }
        };
        const dropsOf = (l) => (Number(l?.startDrop) || 0) + (Number(l?.endDrop) || 0);
        for (const q of ann.quickLines ?? []) addLen(q.lineTypeId, dist(q.x1, q.y1, q.x2, q.y2), q.group, dropsOf(q));
        for (const pl of ann.polylines ?? []) addLen(pl.lineTypeId, polyLen(pl.points ?? []), pl.group, dropsOf(pl));
      }
    }
    // children: palette rules over the tallied marks/runs (same-named rules merge, as the export does)
    const children = {};
    const addChild = (name, total) => { const k = keyOf(name); children[k] = children[k] || { name, total: 0 }; children[k].total += total; };
    for (const c of data?.counters ?? []) for (const ch of childTotalsFor(c.childCounts, marksByCounter[c.id] || 0, [])) addChild(ch.name, ch.total);
    for (const lt of data?.lineTypes ?? []) for (const ch of childTotalsFor(lt.childCounts, 0, runsByLineType[lt.id] || [])) addChild(ch.name, ch.total);
    return { counts, feet, groups, children };
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
    // children (v2 child-count rules): exact-count rows, same verdicts as counts
    const childRows = [];
    for (const k of new Set([...Object.keys(a.children), ...Object.keys(b.children)])) {
      const ca = a.children[k]?.total ?? 0;
      const cb = b.children[k]?.total ?? 0;
      childRows.push({
        name: (a.children[k] ?? b.children[k]).name,
        candidate: ca, reference: cb, delta: ca - cb,
        verdict: ca === cb ? 'match' : cb === 0 ? 'extra' : ca === 0 ? 'missing' : ca > cb ? 'over' : 'under',
      });
    }
    // groups (v2 circuits / panels / areas): per-group count rows — a takeoff that counts
    // right but wires wrong (device on the wrong circuit) shows here, not in `counts`
    const groupRows = [];
    for (const gk of new Set([...Object.keys(a.groups), ...Object.keys(b.groups)])) {
      const ga = a.groups[gk], gb = b.groups[gk];
      const rows = [];
      for (const k of new Set([...Object.keys(ga?.counts ?? {}), ...Object.keys(gb?.counts ?? {})])) {
        const ca = ga?.counts[k]?.count ?? 0;
        const cb = gb?.counts[k]?.count ?? 0;
        const src = (ga && ga.counts[k]) || (gb && gb.counts[k]);
        rows.push({ name: src ? src.name : k, candidate: ca, reference: cb, delta: ca - cb, verdict: ca === cb ? 'match' : cb === 0 ? 'extra' : ca === 0 ? 'missing' : ca > cb ? 'over' : 'under' });
      }
      const fa = Object.values(ga?.feet ?? {}).reduce((s, r) => s + r.feet, 0);
      const fb = Object.values(gb?.feet ?? {}).reduce((s, r) => s + r.feet, 0);
      groupRows.push({
        name: (ga ?? gb).name || '(untagged)',
        counts: rows.sort((x, y) => x.name.localeCompare(y.name)),
        candidate_ft: Math.round(fa * 100) / 100, reference_ft: Math.round(fb * 100) / 100, delta_ft: Math.round((fa - fb) * 100) / 100,
        verdict: rows.every((r) => r.verdict === 'match') && Math.abs(fa - fb) <= feetTolerance ? 'match' : !gb ? 'extra' : !ga ? 'missing' : 'differs',
      });
    }
    const countMatches = countRows.filter((r) => r.verdict === 'match').length;
    return {
      counts: countRows.sort((x, y) => x.name.localeCompare(y.name)),
      feet: feetRows.sort((x, y) => x.name.localeCompare(y.name)),
      children: childRows.sort((x, y) => x.name.localeCompare(y.name)),
      groups: groupRows.sort((x, y) => x.name.localeCompare(y.name)),
      summary: {
        count_rows: countRows.length,
        count_matches: countMatches,
        count_accuracy: countRows.length ? Math.round((countMatches / countRows.length) * 1000) / 10 : 100,
        feet_rows: feetRows.length,
        feet_matches: feetRows.filter((r) => r.verdict === 'match').length,
        child_rows: childRows.length,
        child_matches: childRows.filter((r) => r.verdict === 'match').length,
        group_rows: groupRows.length,
        group_matches: groupRows.filter((r) => r.verdict === 'match').length,
      },
    };
  }

  return { tally, diffTakeoffs, childTotalsFor };
});

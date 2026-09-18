/*
 * fitting-model.js — the pure "fittings from bends" model (punch row
 * BEND-FITTINGS, 2026-09-18; the mockup is
 * https://claude.ai/artifact/6Gj27nuq1uYh9BZjeSPm82).
 *
 * A line type may carry
 *   bendFittings: { enabled, bend45: { name, qty }, bend90: { name, qty }, drop: { name, qty } }
 * and then every run of that type derives its elbows from its OWN geometry:
 *   - each interior vertex of a polyline is a bend; its direction change decides
 *     the class — under BEND_45_MIN_DEG is a wobble and counts nothing, up to
 *     BEND_90_MIN_DEG is a 45, past that a 90 (the nearer of the two, in the
 *     estimator's words);
 *   - each end of a run that carries a drop (the Drop tool's rise/fall, or the
 *     Chain tool's device vertical) is a 90, because the pipe turns up or down.
 * The fitting each class produces is the type's to name and count (a 90 that is
 * really two 45s is "45° elbow × 2" on the bend90 row; DWV is "1/8 bend" and
 * "1/4 bend"; a drop can be "drop-ear 90"). Defaults come from the type's name,
 * the way the hanger rule reads it.
 *
 * Fittings are DERIVED at tally time (features/child-counts.js), never marks on
 * the sheet; deleting a run deletes its fittings by construction. A vertex may
 * carry `fitting: 'none' | 'bend45' | 'bend90'` to override the angle read
 * (the edit-mode menu that writes it is a follow-up; the model honours it now).
 *
 * The same angle function the duct tool uses (duct-model.js ductBendAngleDeg),
 * with pipe thresholds. Loaded as a script (window.FittingModel) and as a
 * CommonJS module for the node tests. No DOM, no app state.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FittingModel = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // The estimator's rule: nearer 45 than 90 is a 45, nearer 90 than 45 is a 90.
  const BEND_45_MIN_DEG = 22.5;
  const BEND_90_MIN_DEG = 67.5;
  const BEND_CLASSES = ['bend45', 'bend90', 'drop'];
  const BEND_CLASS_LABELS = { bend45: 'Bend nearer 45°', bend90: 'Bend nearer 90°', drop: 'Drop at an end' };
  const BEND_CLASS_PER = { bend45: 'bend', bend90: 'bend', drop: 'drop' };

  /** Direction change in degrees at vertex b of a→b→c (0 = straight through). */
  function bendAngleDeg(a, b, c) {
    const v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
    const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
    if (!m1 || !m2) return 0;
    const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)));
    return Math.acos(cos) * 180 / Math.PI;
  }

  /** 'bend45' | 'bend90' | null for a direction change in degrees. */
  function classifyBend(deg, opts) {
    const t45 = opts && opts.min45 > 0 ? opts.min45 : BEND_45_MIN_DEG;
    const t90 = opts && opts.min90 > 0 ? opts.min90 : BEND_90_MIN_DEG;
    if (!(deg >= t45 - 1e-9)) return null;
    return deg >= t90 - 1e-9 ? 'bend90' : 'bend45';
  }

  /** The three default rows a type's name earns: "2in Cu" → "2in Cu 45° elbow" … */
  function defaultBendFittings(name) {
    const base = String(name || '').trim();
    const pre = base ? base + ' ' : '';
    return {
      enabled: false,
      bend45: { name: pre + '45° elbow', qty: 1 },
      bend90: { name: pre + '90° elbow', qty: 1 },
      drop: { name: pre + '90° elbow', qty: 1 },
    };
  }

  /** A complete bendFittings object for a line type (missing rows filled from the defaults). Pure: returns a new object. */
  function normalizeBendFittings(lt) {
    const d = defaultBendFittings(lt && lt.name);
    const cur = (lt && lt.bendFittings) || {};
    const row = (k) => {
      const r = cur[k] || {};
      const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : d[k].name;
      const qty = Number.isFinite(Number(r.qty)) && Number(r.qty) >= 0 ? Math.round(Number(r.qty)) : d[k].qty;
      return { name, qty };
    };
    return { enabled: !!cur.enabled, bend45: row('bend45'), bend90: row('bend90'), drop: row('drop') };
  }

  function bendFittingsEnabled(lt) {
    return !!(lt && lt.bendFittings && lt.bendFittings.enabled);
  }

  /** The bend class at vertex i of a run's points (interior vertices only; every vertex when closed), honouring a per-vertex override. */
  function vertexBendClass(points, i, closed, opts) {
    const pts = points || [];
    const n = pts.length;
    if (n < 3) return null;
    const p = pts[i];
    if (!p) return null;
    if (p.fitting === 'none') return null;
    if (p.fitting === 'bend45' || p.fitting === 'bend90') return p.fitting;
    let a, c;
    if (closed) { a = pts[(i - 1 + n) % n]; c = pts[(i + 1) % n]; }
    else { if (i <= 0 || i >= n - 1) return null; a = pts[i - 1]; c = pts[i + 1]; }
    return classifyBend(bendAngleDeg(a, p, c), opts);
  }

  /** { bend45, bend90 } for one run's points. */
  function runBendCounts(points, closed, opts) {
    const out = { bend45: 0, bend90: 0 };
    const pts = points || [];
    for (let i = 0; i < pts.length; i++) {
      const k = vertexBendClass(pts, i, closed, opts);
      if (k) out[k]++;
    }
    return out;
  }

  /** How many ends of a run (quick line or polyline) carry a drop. */
  function lineDropEnds(line) {
    if (!line) return 0;
    return (Number(line.startDrop) > 0 ? 1 : 0) + (Number(line.endDrop) > 0 ? 1 : 0);
  }

  /**
   * The derived rows for one line type given its (zone-weighted) counts
   * { bend45, bend90, drop }: [{ name, qty, per: 'bend' | 'drop', bendClass,
   * derived: true, total, excludedPxRuns: 0 }], zero totals omitted.
   */
  function bendFittingRows(lt, counts) {
    if (!bendFittingsEnabled(lt)) return [];
    const bf = normalizeBendFittings(lt);
    const c = counts || {};
    return BEND_CLASSES.map((k) => {
      const n = Number(c[k]) || 0;
      const total = n * bf[k].qty;
      return { name: bf[k].name, qty: bf[k].qty, per: BEND_CLASS_PER[k], bendClass: k, derived: true, total, excludedPxRuns: 0 };
    }).filter((r) => r.total > 0);
  }

  return {
    BEND_45_MIN_DEG, BEND_90_MIN_DEG, BEND_CLASSES, BEND_CLASS_LABELS, BEND_CLASS_PER,
    bendAngleDeg, classifyBend, defaultBendFittings, normalizeBendFittings, bendFittingsEnabled,
    vertexBendClass, runBendCounts, lineDropEnds, bendFittingRows,
  };
});

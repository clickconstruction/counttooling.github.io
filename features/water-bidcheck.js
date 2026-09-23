/*
 * features/water-bidcheck.js — the water rows of **Bid Check** (WATER-PLAN.md
 * rung 6, 2026-09-23; the duct rows' twin, features/duct-bidcheck.js).
 *
 * The panel is S5's (features/bid-check.js); this file FEEDS it once the
 * project has any water run, through App.getWaterBidCheck({ pageIndices?,
 * getAnnotations? }) → { rows, auto, manual, unresolved } | null (null = no
 * water run = nothing contributed). The rows are water-model's
 * WATER_BID_CHECK_ROWS resolved against what the schedule already computes
 * (features/water-schedule.js computeWaterSchedule):
 *   Every water run sized      the schedule's over-the-cap and unsized rows, naming the size that passes
 *   Fixture supply minimums    a run smaller than a served fixture's Table 604.4 minimum
 *   Every fixture served       the schedule's not-reached list (the strays)
 *   Water service at least 3/4″  a run named service / meter under the 603.1 minimum (na until one is named)
 *   Scale set on every water sheet   App.collectUnscaledWaterPages, the gate's collector
 *   + the manual rows (pressure available checked per Appendix E, backflow,
 *     water heater sized, recirculation), ticked in state.bidCheck.manual.
 *
 * The export GATE is the duct one (features/duct-bidcheck.js runDuctBidGate):
 * its scope now includes a project with water runs (App.hasWaterRuns), so the
 * badge on Copy to /Tooling and Export PDFs, the "Review · Export anyway"
 * toast and the acknowledgment memory all serve water too, unchanged. Boundary
 * rule: shared deps from App.* at call time.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const WM = () => window.WaterModel;

  function scopeOf(opts) {
    const state = App.state;
    const o = opts || {};
    const pageIndices = o.pageIndices || (state.pages || []).map((_, i) => i);
    const getAnn = o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi));
    return { pageIndices, getAnn };
  }
  function hasWaterRuns(opts) {
    const state = App.state;
    if (!state || !state.pages || !state.pages.length || !App.getWaterRuns) return false;
    const scope = scopeOf(opts);
    return scope.pageIndices.some((pi) => App.getWaterRuns(pi, scope.getAnn(pi)).length > 0);
  }
  function manualTicks() {
    const bc = App.state && App.state.bidCheck;
    return bc && bc.manual && typeof bc.manual === 'object' ? bc.manual : {};
  }
  const pageLabel = (pi) => App.state.pages[pi]?.label || 'Page ' + (pi + 1);

  function getWaterBidCheck(opts) {
    const wm = WM();
    if (!wm || !hasWaterRuns(opts)) return null;
    const scope = scopeOf(opts);
    const s = App.computeWaterSchedule ? App.computeWaterSchedule({ pageIndices: scope.pageIndices, getAnnotations: scope.getAnn }) : null;
    const rows = s ? s.rows : [];
    const waterPages = [...new Set(rows.map((r) => r.pageIdx))].map(pageLabel);
    const unscaledPages = (App.collectUnscaledWaterPages ? App.collectUnscaledWaterPages(scope.getAnn ? (p, pi) => scope.getAnn(pi) : null, scope.pageIndices) : []).map(pageLabel);
    const service = rows.filter((r) => /\bservice\b|\bmeter\b/i.test(r.name + ' ' + r.typeName)).map((r) => ({ name: r.name, sizeIn: r.sizeIn, sizeLabel: r.sizeLabel }));
    const inputs = { rows, unserved: s ? s.unserved : [], served: s ? s.served : 0, waterPages, unscaledPages, service };
    const resolved = wm.waterBidCheckRows(inputs, manualTicks());
    return {
      rows: resolved,
      auto: resolved.filter((r) => r.kind === 'auto'),
      manual: resolved.filter((r) => r.kind === 'manual'),
      unresolved: wm.waterBidCheckUnresolved(resolved),
    };
  }

  App.getWaterBidCheck = getWaterBidCheck;
  App.hasWaterRuns = hasWaterRuns;
})();

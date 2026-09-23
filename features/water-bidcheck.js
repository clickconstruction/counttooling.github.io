(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/water-bidcheck.js — the water rows of **Bid Check** (WATER-PLAN.md
   * rung 6, the pattern's sign-off, 2026-09-23), the duct rows' twin
   * (features/duct-bidcheck.js). The panel is S5's (features/bid-check.js); this
   * file FEEDS it once the project has a water run or a fixture with fixture
   * units, through App.getWaterBidCheck({ pageIndices?, getAnnotations? }) →
   * { rows, auto, manual, unresolved } | null. The rows are water-model's
   * WATER_BID_CHECK_ROWS resolved against inputs collected from what the app
   * already computes:
   *   Every water run sized      the schedule's rows (App.computeWaterSchedule): overCap
   *   Fixture supply minimums    the same rows: underMin, a fixture the run serves directly
   *   Every fixture served       attachWaterFixtures' strays per page, by counter and side
   *   Scale set on every sheet   pages with a water run and no effective scale
   *   Water service 3/4 in min   the cold runs no run feeds (waterChildLinks' roots)
   *   + three manual rows: pressure available (Appendix E), the water heater's
   *     load, recirculation; ticked in state.bidCheck.manual like S5's.
   *
   * The export GATE is the duct file's, shared: its status reads the whole
   * panel and arms while the project has duct OR water (App.hasWaterRuns), so
   * "Bid Check: Every water run sized? — Review · Export anyway" fires on Copy
   * to /Tooling and Export PDFs with the same memory and badges. Boundary rule:
   * read shared deps from App.* and window.WaterModel at call time.
   */
  const WM = () => window.WaterModel || null;

  function scopeOf(opts) {
    const state = App.state;
    const o = opts || {};
    const pageIndices = o.pageIndices || (state.pages || []).map((_, i) => i);
    const getAnn = o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi));
    return { pageIndices, getAnn };
  }
  const pageLabel = (pi) => App.state.pages[pi]?.label || 'Page ' + (pi + 1);

  function hasWaterRuns(opts) {
    const wm = WM();
    const state = App.state;
    if (!wm || !state || !state.pages || !state.pages.length) return false;
    const scope = scopeOf(opts);
    return scope.pageIndices.some((pi) => wm.waterRunsOf(scope.getAnn(pi), state.lineTypes || []).length > 0);
  }

  function collectInputs(scope) {
    const wm = WM();
    const state = App.state;
    const schedule = App.computeWaterSchedule ? App.computeWaterSchedule({ pageIndices: scope.pageIndices, getAnnotations: scope.getAnn }) : null;
    const runs = schedule ? schedule.rows : [];
    const strayMap = new Map();
    const roots = [];
    const waterPages = [], unscaledPages = [];
    let fixtures = 0;
    const ltById = new Map((state.lineTypes || []).map((lt) => [lt.id, lt]));
    scope.pageIndices.forEach((pi) => {
      const ann = scope.getAnn(pi);
      if (!ann) return;
      const wruns = wm.waterRunsOf(ann, state.lineTypes || []);
      const fx = App.collectWaterFixturesFrom ? App.collectWaterFixturesFrom(ann) : [];
      fixtures += fx.length;
      if (fx.length) {
        const { strays } = wm.attachWaterFixtures(fx, wruns);
        strays.forEach((s) => {
          const key = s.fixture.counterName + '|' + s.side;
          if (!strayMap.has(key)) strayMap.set(key, { counterName: s.fixture.counterName, side: s.side, count: 0 });
          strayMap.get(key).count += 1;
        });
      }
      if (!wruns.length) return;
      waterPages.push(pageLabel(pi));
      const unscaled = wruns.some((run) => {
        const eff = App.getEffectiveScaleForLine(ann, run.isPoly ? run.item : { points: run.vertices }, true, pi);
        return !(eff && eff.pixelsPerUnit);
      });
      if (unscaled) unscaledPages.push(pageLabel(pi));
      const children = new Set(wm.waterChildLinks(wruns).map((l) => l.childId));
      wruns.forEach((run) => {
        if (children.has(run.id)) return;
        const lt = ltById.get(run.lineTypeId);
        roots.push({ name: run.item.name || (run.isPoly ? 'Polyline' : 'Quick line'), typeName: lt ? lt.name : 'Line', side: run.side, sizeIn: lt ? wm.waterSizeInFromName(lt.name) : null, key: lt && wm.waterSizeInFromName(lt.name) != null ? wm.sizeKey(wm.waterSizeInFromName(lt.name)) : null });
      });
    });
    return { runs, strays: [...strayMap.values()], fixtures, roots, waterPages, unscaledPages };
  }

  function manualTicks() {
    const bc = App.state && App.state.bidCheck;
    return bc && bc.manual && typeof bc.manual === 'object' ? bc.manual : {};
  }

  // The seam features/bid-check.js reads: null = no water = nothing contributed.
  function getWaterBidCheck(opts) {
    const wm = WM();
    const state = App.state;
    if (!wm || !state || !state.pages || !state.pages.length) return null;
    const scope = scopeOf(opts);
    const inputs = collectInputs(scope);
    if (!inputs.runs.length && !inputs.fixtures) return null;
    const rows = wm.waterBidCheckRows(inputs, manualTicks());
    return { rows, auto: rows.filter((r) => r.kind === 'auto'), manual: rows.filter((r) => r.kind === 'manual'), unresolved: wm.waterBidCheckUnresolved(rows) };
  }

  App.getWaterBidCheck = getWaterBidCheck;
  App.hasWaterRuns = hasWaterRuns;
})();

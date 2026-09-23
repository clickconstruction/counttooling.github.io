/*
 * features/water-runs.js — water runs and the fixtures they serve (WATER-PLAN.md
 * rung 3, 2026-09-23). A line type may carry `waterSide` ('cold' | 'hot'), the
 * airside precedent for water: every quick line and polyline of that type is a
 * water run, and the fixture-unit counters (rung 2) attach to the nearest run of
 * each side they load, the duct model's proximity rule twinned per side (a
 * lavatory ties to its cold run and its hot run separately). Nothing is stored:
 * attachment is DERIVED from geometry every time it is read.
 *
 * This file owns:
 * - The Water field (—, Cold, Hot) on the four line-type surfaces: the sidebar
 *   Add Line Type modal, the Choose Line Type modal's Create tab, its Quick tab,
 *   and the line type's details modal. Each is a registered "form": shown on a
 *   plumbing-shaped project (or when the type already has a side), prefilled
 *   from the name while the estimator has not picked (water-model's
 *   waterSideFromName: "hot", "HW", "cold", "CW"…); a pick wins over a later
 *   name. Create writes `waterSide` set-only; the details radio writes it at
 *   once ('' deletes the key).
 * - The page collectors: App.collectWaterFixtures(pageIdx, ann) (every placed
 *   mark of a counter with fixture units, its loads per side from water-model's
 *   waterFixtureLoads × the multiply zone), App.getWaterRuns(pageIdx, ann),
 *   App.getWaterServed(pageIdx) → { [runId]: { side, wsfu, fixtures } }, and
 *   App.getWaterServedForLine(line, pageIdx) for the sidebar rows.
 * - The stray rescue: App.waterStrayTarget(marker, counter, ann) — a fixture
 *   with a side no run within snap serves, and a run of that side within reach:
 *   app.js's strayDeviceAttachTarget asks it after the CFM rule, so the same
 *   "Attach to nearest run" context row moves the fixture onto the run.
 * - The read-back on the sidebar: the line type row's "cold · 12 WSFU served"
 *   meta and the Lines list's per-run "6 WSFU" (App.waterLineMetaHtml).
 *
 * canvas-draw.js paints the leaders (waterFixtureLeaders over the same
 * collectors' shapes) in the run's color, dashed, under the strokes. Rung 4
 * reads App.getWaterServed for the downstream load at the cursor. Boundary
 * rule: shared deps from App.* at call time; the geometry in water-model.js.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const WM = () => window.WaterModel;
  const esc = (s) => (App.escapeHtml ? App.escapeHtml(s) : String(s));
  const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
  const SIDES = ['cold', 'hot'];

  function plumbingShaped() {
    return (App.getQuickTrade ? App.getQuickTrade() : 'plumbing') === 'plumbing';
  }
  function occupancy() {
    return App.getProjectOccupancy ? App.getProjectOccupancy() : 'public';
  }

  // --- the Water field ------------------------------------------------------------
  // key → { radioName, groupId, name(), item?, picked }
  const forms = {};
  function registerForm(key, cfg) {
    forms[key] = { ...cfg, picked: false, item: null };
    const nameEl = cfg.nameInputId ? document.getElementById(cfg.nameInputId) : null;
    if (nameEl && !nameEl.dataset.waterBound) { nameEl.dataset.waterBound = '1'; nameEl.addEventListener('input', () => syncForm(key)); }
    document.querySelectorAll('input[name="' + cfg.radioName + '"]').forEach((r) => {
      if (r.dataset.waterBound) return;
      r.dataset.waterBound = '1';
      r.addEventListener('change', () => {
        const f = forms[key];
        if (!f) return;
        f.picked = true;
        if (f.onPick) f.onPick(r.value || null);
      });
    });
    return forms[key];
  }
  function setRadios(radioName, value) {
    document.querySelectorAll('input[name="' + radioName + '"]').forEach((r) => { r.checked = (r.value || '') === (value || ''); });
  }
  function syncForm(key) {
    const f = forms[key];
    if (!f) return;
    const group = document.getElementById(f.groupId);
    const has = !!(f.item && SIDES.includes(f.item.waterSide));
    const show = plumbingShaped() || has;
    if (group) group.style.display = show ? '' : 'none';
    if (!show || f.picked || f.item) return;
    setRadios(f.radioName, WM() ? WM().waterSideFromName(f.name()) : null);
  }
  function resetForm(key) {
    const f = forms[key];
    if (!f) return;
    f.picked = false; f.item = null;
    setRadios(f.radioName, null);
    syncForm(key);
  }
  function loadForm(key, item) {
    const f = forms[key];
    if (!f) return;
    f.item = item; f.picked = true;
    setRadios(f.radioName, item && SIDES.includes(item.waterSide) ? item.waterSide : null);
    syncForm(key);
  }
  function fieldValue(key) {
    const f = forms[key];
    if (!f) return null;
    const sel = document.querySelector('input[name="' + f.radioName + '"]:checked');
    return sel && SIDES.includes(sel.value) ? sel.value : null;
  }
  // Create: set-only, so a type with no side keeps its shape.
  function applyFieldToLineType(key, lt) {
    const v = fieldValue(key);
    if (v) lt.waterSide = v;
  }

  // --- the collectors -------------------------------------------------------------
  function annFor(pageIdx, ann) {
    if (ann) return ann;
    const p = App.state.pages[pageIdx];
    return p ? App.getActiveAnnotations(p, pageIdx) : null;
  }
  // Every placed mark of a counter with fixture units on the page, as
  // { id, x, y, loads: { cold, hot }, counterId, index } — the multiply zone
  // rides in the loads, so a ×3 typical bay serves three times the water.
  function collectWaterFixtures(pageIdx, ann) {
    const wm = WM();
    const a = annFor(pageIdx, ann);
    if (!wm || !a) return [];
    const out = [];
    const occ = occupancy();
    (App.state.counters || []).forEach((c) => {
      if (!(c.wsfu > 0)) return;
      (a.counterMarkers?.[c.id] || []).forEach((m, index) => {
        const loads = wm.waterFixtureLoads(c, occ, wm.markerWsfu(m, c));
        if (!loads) return;
        const k = App.getMultiplyZoneForPoint ? App.getMultiplyZoneForPoint(a, m) : 1;
        out.push({ id: c.id + ':' + index, x: m.x, y: m.y, loads: { cold: loads.cold * k, hot: loads.hot * k }, total: loads.total * k, known: loads.known, counterId: c.id, index });
      });
    });
    return out;
  }
  function getWaterRuns(pageIdx, ann) {
    const wm = WM();
    const a = annFor(pageIdx, ann);
    return wm && a ? wm.waterRunsFromAnnotations(a, App.state.lineTypes || []) : [];
  }
  function getWaterServed(pageIdx, ann) {
    const wm = WM();
    if (!wm) return {};
    const a = annFor(pageIdx, ann);
    return wm.waterServedByRun(collectWaterFixtures(pageIdx, a), getWaterRuns(pageIdx, a));
  }
  // The served row for one line (a quick line or polyline) on a page, or null
  // when its type has no water side.
  function getWaterServedForLine(line, pageIdx) {
    if (!line) return null;
    const served = getWaterServed(pageIdx);
    const runs = getWaterRuns(pageIdx);
    const run = runs.find((r) => (line.id && r.id === line.id));
    return run ? served[run.id] || null : null;
  }
  // The stray rescue: a side of this fixture that no run within snap serves,
  // and a run of that side within reach → { point, runId, side }, else null.
  function waterStrayTarget(marker, counter, ann) {
    const wm = WM();
    if (!wm || !marker || !counter || !(counter.wsfu > 0) || !ann) return null;
    const runs = wm.waterRunsFromAnnotations(ann, App.state.lineTypes || []);
    if (!runs.length) return null;
    const loads = wm.waterFixtureLoads(counter, occupancy(), wm.markerWsfu(marker, counter));
    if (!loads) return null;
    const fixture = { x: marker.x, y: marker.y, loads };
    const { unattached } = wm.attachWaterFixtures([fixture], runs);
    if (!unattached.length) return null;
    const near = wm.waterNearestRunPoint(fixture, runs, unattached.map((u) => u.side));
    return near ? { point: near.point, runId: near.runId, side: near.side } : null;
  }

  // --- the sidebar read-back ----------------------------------------------------------
  // The line type row: "cold · 12 WSFU served" over every sheet (active layer).
  function waterLineTypeMetaHtml(lt) {
    if (!lt || !SIDES.includes(lt.waterSide)) return '';
    let wsfu = 0, fixtures = 0, runs = 0;
    (App.state.pages || []).forEach((p, pi) => {
      const served = getWaterServed(pi);
      getWaterRuns(pi).forEach((r) => {
        if (r.lineTypeId !== lt.id) return;
        runs++;
        const row = served[r.id];
        if (row) { wsfu += row.wsfu; fixtures += row.fixtures; }
      });
    });
    const label = WM() ? WM().WATER_SIDE_LABELS[lt.waterSide].toLowerCase() : lt.waterSide;
    const served = runs ? fmt(Math.round(wsfu * 100) / 100) + ' WSFU served' + (fixtures ? ' · ' + fixtures + (fixtures === 1 ? ' fixture' : ' fixtures') : '') : 'no runs yet';
    return '<div class="line-water-meta" title="Water supply fixture units of the fixtures attached to this type’s runs, ' + esc(label) + ' side">' + esc(label) + ' · ' + esc(served) + '</div>';
  }
  // The Lines list row: "cold · 6 WSFU" for one run.
  function waterLineMetaHtml(line, pageIdx) {
    const row = getWaterServedForLine(line, pageIdx);
    if (!row) return '';
    const label = WM() ? WM().WATER_SIDE_LABELS[row.side].toLowerCase() : row.side;
    return '<div class="line-water-meta">' + esc(label) + ' · ' + fmt(row.wsfu) + ' WSFU' + (row.fixtures ? ' · ' + row.fixtures + (row.fixtures === 1 ? ' fixture' : ' fixtures') : '') + '</div>';
  }

  App.registerWaterSideForm = registerForm;
  App.syncWaterSideForm = syncForm;
  App.resetWaterSideForm = resetForm;
  App.loadWaterSideForm = loadForm;
  App.waterSideFieldValue = fieldValue;
  App.applyWaterSideToLineType = applyFieldToLineType;
  App.collectWaterFixtures = collectWaterFixtures;
  App.getWaterRuns = getWaterRuns;
  App.getWaterServed = getWaterServed;
  App.getWaterServedForLine = getWaterServedForLine;
  App.waterStrayTarget = waterStrayTarget;
  App.waterLineTypeMetaHtml = waterLineTypeMetaHtml;
  App.waterLineMetaHtml = waterLineMetaHtml;
})();

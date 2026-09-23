/*
 * features/water-schedule.js — the Water Sizing schedule modal + Copy Schedule
 * + the report seam (WATER-PLAN.md rung 5, 2026-09-23; the Duct Schedule's
 * twin, "the schedule prices like a bid").
 *
 * The schedule is one row per committed water run (a quick line or polyline of
 * a line type with a water side), per sheet in scope: the run, its type, its
 * size (read off the type's name), the fixture units it carries at its head
 * (its own attached fixtures plus every branch tapped off it, water-model's
 * waterDownstreamByRun), the design flow (IPC E103.3(3), the flush-valve column
 * when a flush valve is among them), the velocity at that size (water-model's
 * pipe bores), and the check: ✓, or ⚠ with the size that passes (over the
 * side's cap, or under a served fixture's supply minimum, IPC Table 604.4), or
 * "no size" when the type's name carries no material or size. Cold and hot
 * totals (fixture units attached to any run of the side, runs, ⚠ count) and
 * the fixtures no run of a side reaches ("Lavatory, hot ×2: no hot run within
 * reach"). Scope follows the house dialect (This sheet / Every sheet, hidden
 * at one page); runs read the ACTIVE canvas unless a getAnnotations override
 * is passed (the report path).
 *
 * The knobs at the foot stick with the project: the velocity cap per side
 * (`state.waterSettings.capFps`, defaulted from the rulebook's
 * WATER_VELOCITY_CAP_FPS, normalized by water-model's normalizeWaterSettings,
 * riding every intake like ductSettings) and the occupancy column (the codes
 * blob's `occupancy`, one writer: App.setProjectCodes). The foot stamps "sized
 * at 8 / 5 fps, practice not code; the pressure check is Bid Check's".
 *
 * Copy Schedule writes tab-separated text through the same pre-copy scale gate
 * as the other copy surfaces (App.runGatedCopy, with the water collector);
 * App.buildWaterCopyRows feeds report.js's "--- Water sizing ---" block in
 * Copy Summary / Copy to /Tooling, and App.getWaterScheduleForReport the
 * Show Report / Export PDFs table. The opener (#waterScheduleBtn on the Line
 * Types header) shows exactly when a line type has a water side
 * (App.syncWaterScheduleBtn, called by the sidebar's line-type render).
 * Boundary rule: shared deps from App.* at call time.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const WM = () => window.WaterModel;
  const SM = () => window.SupportModel;
  const esc = (s) => (App.escapeHtml ? App.escapeHtml(s) : String(s));
  const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
  const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const SIDES = ['cold', 'hot'];
  const SIDE_LABEL = { cold: 'Cold water', hot: 'Hot water' };
  let scheduleScope = 'project';

  function getWaterSettings() {
    const state = App.state;
    const wm = WM();
    if (!state.waterSettings || !state.waterSettings.capFps) state.waterSettings = wm ? wm.normalizeWaterSettings(state.waterSettings) : { capFps: { cold: 8, hot: 5 } };
    return state.waterSettings;
  }
  function scopePageIndices() {
    const state = App.state;
    if (scheduleScope === 'page' && state.pages.length > 1) return [state.currentPage];
    return null;
  }
  function anyWaterType() {
    return (App.state.lineTypes || []).some((lt) => lt && SIDES.includes(lt.waterSide));
  }

  // --- the schedule --------------------------------------------------------------------
  function computeWaterSchedule(opts) {
    const o = opts || {};
    const wm = WM(), sm = SM();
    const state = App.state;
    if (!wm) return null;
    const indices = o.pageIndices != null ? o.pageIndices : state.pages.map((_, i) => i);
    const getAnn = o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi));
    const ws = getWaterSettings();
    const blank = () => ({ wsfu: 0, fixtures: 0, runs: 0, warn: 0, unsized: 0 });
    const totals = { cold: blank(), hot: blank() };
    const rows = [];
    const unserved = {};
    indices.forEach((pi) => {
      const page = state.pages[pi];
      if (!page) return;
      const ann = getAnn(pi);
      if (!ann) return;
      const runs = App.getWaterRuns ? App.getWaterRuns(pi, ann) : [];
      if (!runs.length) return;
      const fixtures = App.collectWaterFixtures ? App.collectWaterFixtures(pi, ann) : [];
      fixtures.forEach((f) => {
        const c = (state.counters || []).find((x) => x.id === f.counterId);
        const hit = c ? wm.wsfuFixtureFromName(c.name) : null;
        f.supplyMinIn = hit ? wm.fixtureSupplyMinIn(hit.fixture, hit.control) : null;
        f.counterName = c ? c.name : '';
      });
      const down = wm.waterDownstreamByRun(fixtures, runs);
      const { attached, unattached } = wm.attachWaterFixtures(fixtures, runs);
      const minByRun = {};
      attached.forEach((a) => { if (a.fixture.supplyMinIn > (minByRun[a.runId] || 0)) minByRun[a.runId] = a.fixture.supplyMinIn; });
      runs.forEach((run) => {
        const lt = (state.lineTypes || []).find((l) => l.id === run.lineTypeId);
        const line = run.kind === 'quick' ? (ann.quickLines || [])[run.index] : (ann.polylines || [])[run.index];
        const typeName = lt ? (lt.name || 'Line') : 'Line';
        const material = wm.waterMaterialFromName(typeName);
        const sizeIn = sm && sm.supportSizeInFromName ? sm.supportSizeInFromName(typeName) : null;
        const d = down[run.id] || { wsfu: 0, fixtures: 0, flushValve: false };
        const r = wm.waterScheduleRow({ side: run.side, material, sizeIn, wsfu: d.wsfu, flushValve: d.flushValve, supplyMinIn: minByRun[run.id] || null, cap: ws.capFps[run.side] });
        let lengthFt = null;
        try {
          const lenFn = App.getLineLengthFeetForTotals || window.getLineLengthFeetForTotals;
          if (lenFn && line) lengthFt = lenFn(line, pi, run.kind === 'poly', ann);
        } catch (_) { lengthFt = null; }
        rows.push({
          pageIdx: pi, pageLabel: page.label || ('Sheet ' + (pi + 1)), runId: run.id, kind: run.kind,
          name: (line && line.name) || (run.kind === 'poly' ? 'Polyline' : 'Quick line'), typeName, side: run.side,
          material, sizeIn, sizeLabel: sizeIn != null ? wm.sizeFraction(sizeIn) + '″' : '—',
          wsfu: d.wsfu, fixtures: d.fixtures, lengthFt: Number.isFinite(lengthFt) ? lengthFt : null,
          ...r, suggestLabel: r.suggestSizeIn != null ? wm.sizeFraction(r.suggestSizeIn) + '″' : null,
          supplyMinIn: minByRun[run.id] || null,
        });
        const t = totals[run.side];
        t.runs++;
        if (r.over || r.underMin) t.warn++;
        if (r.unsized) t.unsized++;
      });
      attached.forEach((a) => { totals[a.side].wsfu += a.load; totals[a.side].fixtures++; });
      unattached.forEach((u) => {
        const key = (u.fixture.counterName || '?') + '|' + u.side;
        if (!unserved[key]) unserved[key] = { counterName: u.fixture.counterName || 'Fixture', side: u.side, count: 0, wsfu: 0 };
        unserved[key].count++;
        unserved[key].wsfu += u.load;
      });
    });
    if (!rows.length) return null;
    SIDES.forEach((side) => { totals[side].wsfu = Math.round(totals[side].wsfu * 100) / 100; });
    const un = Object.values(unserved).map((u) => ({ ...u, wsfu: Math.round(u.wsfu * 100) / 100 }));
    return { rows, totals, unserved: un, warnings: totals.cold.warn + totals.hot.warn, unsized: totals.cold.unsized + totals.hot.unsized, capFps: { ...ws.capFps }, occupancy: App.getProjectOccupancy ? App.getProjectOccupancy() : 'public' };
  }
  function verdictText(r) {
    if (r.unsized) return r.material ? 'no size in the name' : 'no material in the name';
    if (r.underMin) return '⚠ under the ' + (WM() ? WM().sizeFraction(r.supplyMinIn) : r.supplyMinIn) + '″ fixture supply minimum' + (r.suggestLabel ? ' → ' + r.suggestLabel : '');
    if (r.over) return '⚠ over ' + fmt(r.capFps) + ' fps' + (r.suggestLabel ? ' → ' + r.suggestLabel : ', no size passes');
    return '✓';
  }
  function servesText(r) { return fmt(r.wsfu) + ' WSFU' + (r.fixtures ? ' · ' + r.fixtures + (r.fixtures === 1 ? ' fixture' : ' fixtures') : ''); }

  // --- the modal ------------------------------------------------------------------------
  function renderBody() {
    const body = document.getElementById('waterScheduleBody');
    if (!body) return;
    const s = computeWaterSchedule({ pageIndices: scopePageIndices() });
    const copyBtn = document.getElementById('waterScheduleCopy');
    if (!s) {
      body.innerHTML = '<p class="duct-schedule-empty empty-state">No water runs ' + (scheduleScope === 'page' ? 'on this sheet' : 'yet') + '. Give a line type a water side (Cold or Hot) and trace the runs; the fixtures attach to them.</p>';
      if (copyBtn) copyBtn.disabled = true;
      return;
    }
    if (copyBtn) copyBtn.disabled = false;
    const chip = (id) => (App.ruleChipHtml ? ' ' + App.ruleChipHtml(id, { cls: 'rule-chip-th' }) : '');
    let html = '';
    SIDES.forEach((side) => {
      const rows = s.rows.filter((r) => r.side === side);
      if (!rows.length) return;
      const t = s.totals[side];
      html += '<div class="duct-schedule-section-label">' + SIDE_LABEL[side] + ' <span class="duct-schedule-sublabel">' + fmt(t.wsfu) + ' WSFU · ' + t.runs + (t.runs === 1 ? ' run' : ' runs') + (t.warn ? ' · ' + t.warn + ' ⚠' : '') + '</span></div>';
      html += '<table class="duct-schedule-table water-schedule-table"><tr><th>Run</th><th>Size' + chip('plumb.water.pipe-id') + '</th><th>Serves' + chip('plumb.wsfu.demand') + '</th><th>gpm</th><th>fps' + chip('plumb.water.velocity') + '</th><th>Check' + chip('plumb.water.fixture-supply-min') + '</th></tr>';
      rows.forEach((r) => {
        html += '<tr class="' + (r.ok ? '' : 'water-row-warn') + '"><td>' + esc(r.name) + '<div class="water-row-type">' + esc(r.typeName) + (App.state.pages.length > 1 ? ' · ' + esc(r.pageLabel) : '') + '</div></td>'
          + '<td class="mono">' + esc(r.sizeLabel) + '</td><td class="mono">' + esc(servesText(r)) + '</td><td class="mono num">' + (r.wsfu > 0 ? fmt1(r.gpm) : '—') + '</td>'
          + '<td class="mono num">' + (r.velocityFps != null && r.wsfu > 0 ? fmt1(r.velocityFps) : '—') + '</td><td>' + esc(verdictText(r)) + '</td></tr>';
      });
      html += '</table>';
    });
    if (s.unserved.length) {
      html += '<div class="duct-schedule-section-label">Not reached</div><ul class="water-unserved">';
      s.unserved.forEach((u) => { html += '<li>' + esc(u.counterName) + ', ' + esc(u.side) + (u.count > 1 ? ' ×' + u.count : '') + ' · ' + fmt(u.wsfu) + ' WSFU: no ' + esc(u.side) + ' run within reach. Trace one past it, or right-click the mark for Attach to nearest run.</li>'; });
      html += '</ul>';
    }
    body.innerHTML = html;
    if (App.syncRuleChips) App.syncRuleChips();
  }
  function syncScopeSegment() {
    const seg = document.getElementById('waterScheduleScope');
    if (!seg) return;
    seg.style.display = App.state.pages.length > 1 ? '' : 'none';
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.scope === scheduleScope));
  }
  function syncKnobs() {
    const ws = getWaterSettings();
    const cold = document.getElementById('waterCapCold');
    const hot = document.getElementById('waterCapHot');
    if (cold) cold.value = ws.capFps.cold;
    if (hot) hot.value = ws.capFps.hot;
    const occ = App.getProjectOccupancy ? App.getProjectOccupancy() : 'public';
    document.querySelectorAll('#waterScheduleOccupancy button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.occupancy === occ)));
    const foot = document.getElementById('waterScheduleFoot');
    if (foot) foot.textContent = 'Sized at ' + fmt(ws.capFps.cold) + ' fps cold / ' + fmt(ws.capFps.hot) + ' fps hot, practice not code; the pressure check is Bid Check’s. Fixture units read the ' + occ + ' column.';
  }
  function openWaterScheduleModal() {
    scheduleScope = 'project';
    syncScopeSegment();
    syncKnobs();
    renderBody();
    App.showModal('waterScheduleModal');
  }
  function syncWaterScheduleBtn() {
    const btn = document.getElementById('waterScheduleBtn');
    if (btn) btn.style.display = anyWaterType() && !App.state.isViewer ? '' : 'none';
  }

  // --- Copy Schedule / the report rows ----------------------------------------------------
  function copyRow(r) {
    return [SIDE_LABEL[r.side].replace(' water', '') + ' · ' + r.name + ' (' + r.typeName + ')', r.sizeLabel, servesText(r), r.wsfu > 0 ? fmt1(r.gpm) + ' gpm' : '', r.velocityFps != null && r.wsfu > 0 ? fmt1(r.velocityFps) + ' fps' : '', verdictText(r)].join('\t');
  }
  function buildWaterCopyRows(s) {
    if (!s) return [];
    const lines = [];
    SIDES.forEach((side) => {
      s.rows.filter((r) => r.side === side).forEach((r) => lines.push(copyRow(r)));
      const t = s.totals[side];
      if (t.runs) lines.push([SIDE_LABEL[side] + ' total', '', fmt(t.wsfu) + ' WSFU · ' + t.fixtures + (t.fixtures === 1 ? ' fixture' : ' fixtures'), '', '', t.warn ? t.warn + ' ⚠' : '✓'].join('\t'));
    });
    s.unserved.forEach((u) => lines.push(['Not reached · ' + u.counterName + ', ' + u.side + (u.count > 1 ? ' ×' + u.count : ''), '', fmt(u.wsfu) + ' WSFU', '', '', '⚠ no ' + u.side + ' run within reach'].join('\t')));
    lines.push(['Sized at ' + fmt(s.capFps.cold) + ' fps cold / ' + fmt(s.capFps.hot) + ' fps hot, practice not code; ' + s.occupancy + ' fixture units', '', '', '', '', ''].join('\t'));
    return lines;
  }
  function buildWaterScheduleText(s) {
    if (!s) return '';
    return ['Water sizing', ['Run', 'Size', 'Serves', 'gpm', 'fps', 'Check'].join('\t')].concat(buildWaterCopyRows(s)).join('\n');
  }
  function collectUnscaledWaterPages(getAnnFn, pageIndices) {
    const state = App.state;
    const indices = pageIndices != null ? pageIndices : state.pages.map((_, i) => i);
    const flagged = [];
    indices.forEach((pi) => {
      const page = state.pages[pi];
      if (!page) return;
      const ann = getAnnFn ? getAnnFn(page, pi) : App.getActiveAnnotations(page, pi);
      const runs = App.getWaterRuns ? App.getWaterRuns(pi, ann) : [];
      const unscaled = runs.some((run) => {
        const eff = App.getEffectiveScaleForLine(ann, { points: run.vertices }, true, pi);
        return !(eff && eff.pixelsPerUnit);
      });
      if (unscaled) flagged.push(pi);
    });
    return flagged;
  }
  async function doCopyWaterSchedule(getAnnFn, pageIndices, mode) {
    const s = computeWaterSchedule({ pageIndices, getAnnotations: getAnnFn ? (pi) => getAnnFn(App.state.pages[pi], pi) : undefined });
    const text = buildWaterScheduleText(s);
    if (!text) { App.showToast('No water runs to schedule yet.', 4000); return; }
    try {
      await navigator.clipboard.writeText(text);
      App.logUserEvent('copy_summary', App.state.currentProjectId || null, { surface: 'water-schedule', mode: mode || 'project' });
      App.showToast('Water sizing copied: ' + s.rows.length + (s.rows.length === 1 ? ' run' : ' runs') + (s.warnings ? ', ' + s.warnings + ' ⚠' : ', every run passes') + '. Pastes into PipeTooling in columns.', 4000);
    } catch (err) {
      console.error('[copy]', err);
      App.showToast('Nothing was copied. The browser blocked clipboard access. Click Copy Schedule again, and allow clipboard access if the browser asks.', 6000);
    }
  }
  function getWaterScheduleForReport(opts) { return computeWaterSchedule(opts || {}); }

  // --- wiring ---------------------------------------------------------------------------
  const openBtn = document.getElementById('waterScheduleBtn');
  if (openBtn) openBtn.onclick = (e) => { e.stopPropagation(); openWaterScheduleModal(); };
  const closeBtn = document.getElementById('waterScheduleClose');
  if (closeBtn) closeBtn.onclick = () => App.hideModal('waterScheduleModal');
  const scopeSeg = document.getElementById('waterScheduleScope');
  if (scopeSeg) scopeSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-scope]');
    if (!b) return;
    scheduleScope = b.dataset.scope === 'page' ? 'page' : 'project';
    syncScopeSegment();
    renderBody();
  });
  SIDES.forEach((side) => {
    const input = document.getElementById(side === 'cold' ? 'waterCapCold' : 'waterCapHot');
    if (!input) return;
    input.addEventListener('change', () => {
      const v = parseFloat(input.value);
      const ws = getWaterSettings();
      ws.capFps[side] = Number.isFinite(v) && v > 0 ? v : (WM() ? WM().WATER_VELOCITY_CAP_FPS[side] : (side === 'cold' ? 8 : 5));
      syncKnobs();
      App.markProjectDirty();
      renderBody();
      App.updateUI();
    });
  });
  const occSeg = document.getElementById('waterScheduleOccupancy');
  if (occSeg) occSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-occupancy]');
    if (!b || !App.setProjectCodes) return;
    App.setProjectCodes({ occupancy: b.dataset.occupancy }, { route: 'water-schedule' });
    syncKnobs();
    renderBody();
  });
  const copyBtn = document.getElementById('waterScheduleCopy');
  if (copyBtn) copyBtn.onclick = async () => {
    const indices = scopePageIndices();
    await App.runGatedCopy(null, indices, doCopyWaterSchedule, 'water-schedule', scheduleScope === 'page' ? 'this-sheet' : 'project', collectUnscaledWaterPages);
  };

  App.openWaterScheduleModal = openWaterScheduleModal;
  App.getWaterSettings = getWaterSettings;
  App.computeWaterSchedule = computeWaterSchedule;
  App.getWaterScheduleForReport = getWaterScheduleForReport;
  App.buildWaterCopyRows = buildWaterCopyRows;
  App.buildWaterScheduleText = buildWaterScheduleText;   // spec seam
  App.syncWaterScheduleBtn = syncWaterScheduleBtn;
  App.collectUnscaledWaterPages = collectUnscaledWaterPages;
})();

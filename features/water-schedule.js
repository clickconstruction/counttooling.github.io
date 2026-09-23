(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/water-schedule.js — the Water Sizing schedule modal, Copy Schedule
   * and the report seam (WATER-PLAN.md rung 5, "the schedule prices like a bid",
   * 2026-09-23). The Duct Schedule's shape (features/duct-schedule.js), on the
   * water side:
   *
   *   Per run   the run's name and type, its side, the fixture units it serves
   *             (rung 3's walk: own fixtures plus its branches), the design gpm
   *             on the set's curve, the size its type names, the velocity in that
   *             bore, and ✓ or ⚠ (over the side's cap; a fixture it serves
   *             directly whose supply minimum is larger than the run), with the
   *             size that would pass beside a ⚠ (water-model waterRunSizing).
   *   Totals    cold and hot: runs, fixture units, the peak flow.
   *   Knobs     the velocity cap per side (state.waterSettings, per project,
   *             riding every save/load/export/import path like ductSettings) and
   *             occupancy (state.codes.occupancy, the same field Project Settings
   *             edits), at the foot; stamped "practice, not code".
   *
   * Scope follows the house dialect (This sheet / Every sheet, hidden at one
   * page). Runs are each page's ACTIVE canvas unless the report passes its own
   * getAnnotations. Copy Schedule writes a tab-separated table through
   * App.runGatedCopy (no scale gate is needed for these columns, so the
   * collector flags nothing, but the surface logs and resumes like the others).
   * report.js resolves App.getWaterScheduleForReport at call time, so the table
   * lands in Show Report / Export PDFs, and App.buildWaterCopyRows under the
   * "--- Water sizing ---" heading in Copy Summary / Copy to /Tooling.
   *
   * The opener is a Water button on the Line Types header, shown only while the
   * project has a water run (features/water-fixtures.js syncs it). Boundary
   * rule: read shared deps from App.* and window.WaterModel at call time.
   */
  const WM = () => window.WaterModel || null;
  const esc = (s) => (App.escapeHtml ? App.escapeHtml(s) : String(s));
  const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString();
  let scheduleScope = 'project';

  function getWaterSettings() {
    const wm = WM();
    const state = App.state;
    const next = wm ? wm.normalizeWaterSettings(state.waterSettings) : { coldFps: 8, hotFps: 5 };
    if (!state.waterSettings || state.waterSettings.coldFps !== next.coldFps || state.waterSettings.hotFps !== next.hotFps) state.waterSettings = next;
    return state.waterSettings;
  }
  function occupancy() { return (App.getProjectCodes ? App.getProjectCodes().occupancy : null) || 'public'; }

  function scopePageIndices() {
    const state = App.state;
    if (scheduleScope === 'page') return [state.currentPage];
    return state.pages.map((_, i) => i);
  }

  // The rollup: one row per water run in scope. opts: { pageIndices, getAnnotations? }.
  function computeWaterSchedule(opts) {
    const wm = WM();
    const state = App.state;
    if (!wm) return null;
    const o = opts || {};
    const indices = o.pageIndices != null ? o.pageIndices : state.pages.map((_, i) => i);
    const getAnn = o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi));
    const settings = getWaterSettings();
    const ltById = new Map((state.lineTypes || []).map((lt) => [lt.id, lt]));
    const rows = [];
    indices.forEach((pi) => {
      const page = state.pages[pi];
      if (!page) return;
      const ann = getAnn(pi);
      const runs = wm.waterRunsOf(ann, state.lineTypes || []);
      if (!runs.length) return;
      const fixtures = App.collectWaterFixturesFrom ? App.collectWaterFixturesFrom(ann) : [];
      const served = wm.waterServedByRun(fixtures, runs);
      const { attached } = wm.attachWaterFixtures(fixtures, runs);
      const byRun = new Map();
      attached.forEach((a) => { if (!byRun.has(a.runId)) byRun.set(a.runId, []); byRun.get(a.runId).push(a.fixture); });
      const keysUnder = (id, seen) => {
        if (seen.has(id)) return [];
        seen.add(id);
        const row = served.get(id);
        let keys = (byRun.get(id) || []).map((f) => f.fixtureKey).filter(Boolean);
        (row ? row.children : []).forEach((c) => { keys = keys.concat(keysUnder(c, seen)); });
        return keys;
      };
      runs.forEach((run) => {
        const sv = served.get(run.id);
        if (!sv) return;
        const lt = ltById.get(run.lineTypeId);
        const sizing = wm.waterRunSizing({
          served: sv.served, fixtureKeys: keysUnder(run.id, new Set()), ownFixtureKeys: (byRun.get(run.id) || []).map((f) => f.fixtureKey).filter(Boolean),
          sizeIn: lt ? wm.waterSizeInFromName(lt.name) : null, material: lt ? wm.waterMaterialFromName(lt.name) : null, side: run.side, settings,
        });
        rows.push({
          runId: run.id, pageIdx: pi, pageLabel: page.label || ('Sheet ' + (pi + 1)),
          name: run.item.name || (run.isPoly ? 'Polyline' : 'Quick line'), typeName: lt ? lt.name : 'Line', side: run.side,
          fixtures: sv.servedCount, branches: sv.children.length, ...sizing,
        });
      });
    });
    if (!rows.length) return null;
    const totals = {};
    ['cold', 'hot'].forEach((side) => {
      const rs = rows.filter((r) => r.side === side);
      // The peak flow on a side is the largest single run's, not a sum: a
      // branch's fixtures are already in its main's units.
      totals[side] = { runs: rs.length, wsfu: Math.round(rs.reduce((a, r) => Math.max(a, r.served), 0) * 100) / 100, gpm: rs.reduce((a, r) => Math.max(a, r.gpm), 0), warn: rs.filter((r) => !r.ok).length, cap: wm.waterCapFor(side, settings) };
    });
    return { rows, totals, settings: { ...settings }, occupancy: occupancy(), warnCount: rows.filter((r) => !r.ok).length };
  }

  // --- the modal -----------------------------------------------------------------
  function sideLabel(side) { return side === 'hot' ? 'Hot' : 'Cold'; }
  function renderScheduleBody() {
    const body = document.getElementById('waterScheduleBody');
    if (!body) return;
    const s = computeWaterSchedule({ pageIndices: scopePageIndices() });
    const copyBtn = document.getElementById('waterScheduleCopy');
    if (!s) {
      body.innerHTML = '<p class="duct-schedule-empty empty-state">No water runs ' + (scheduleScope === 'page' ? 'on this sheet' : 'yet') + '. A line type whose name says CW or HW, or one given a side in its details, makes a water run; the fixtures within reach attach to it.</p>';
      if (copyBtn) copyBtn.disabled = true;
      return;
    }
    if (copyBtn) copyBtn.disabled = false;
    const chip = (id) => (App.ruleChipHtml ? ' ' + App.ruleChipHtml(id, { cls: 'rule-chip-th' }) : '');
    let html = '';
    ['cold', 'hot'].forEach((side) => {
      const rs = s.rows.filter((r) => r.side === side);
      if (!rs.length) return;
      html += '<div class="duct-schedule-section-label">' + sideLabel(side) + ' water <span class="duct-schedule-sublabel">(' + rs.length + (rs.length === 1 ? ' run' : ' runs') + ' · capped at ' + s.totals[side].cap + ' ft/s)</span></div>';
      html += '<table class="duct-schedule-table water-schedule-table"><tr><th>Run</th><th>WSFU</th><th>gpm</th><th>Size</th><th>ft/s</th><th></th></tr>';
      rs.forEach((r) => {
        const verdict = r.ok ? '<span class="water-ok">✓</span>' : '<span class="water-warn" title="' + esc(r.warnings.join('; ')) + '">⚠ ' + esc(r.warnings.join('; ')) + (r.suggestedKey && r.suggestedKey !== r.key ? ' → ' + esc(r.suggestedKey) + ' in' : '') + '</span>';
        html += '<tr><td>' + esc(r.name) + ' <span class="duct-schedule-sublabel">' + esc(r.typeName) + (s.rows.some((x) => x.pageIdx !== r.pageIdx) ? ' · ' + esc(r.pageLabel) : '') + '</span></td>'
          + '<td class="mono">' + fmt(r.served) + ' <span class="duct-schedule-sublabel">' + r.fixtures + (r.fixtures === 1 ? ' fixture' : ' fixtures') + '</span></td>'
          + '<td class="mono">' + r.gpm + '</td><td class="mono">' + (r.key ? esc(r.key) + ' in' : '<span class="duct-schedule-sublabel">no size in the name</span>') + '</td>'
          + '<td class="mono">' + (r.velocityFps != null ? r.velocityFps : '<span class="duct-schedule-sublabel">' + (r.material ? '' : 'no material') + '</span>') + '</td><td>' + verdict + '</td></tr>';
      });
      const t = s.totals[side];
      html += '<tr class="duct-schedule-total-row"><td>' + sideLabel(side) + ' peak</td><td class="mono">' + fmt(t.wsfu) + '</td><td class="mono">' + t.gpm + '</td><td></td><td></td><td>' + (t.warn ? '<span class="water-warn">' + t.warn + ' ⚠</span>' : '') + '</td></tr>';
      html += '</table>';
    });
    html += '<p class="duct-schedule-sublabel water-schedule-note">A run’s units are its own fixtures plus its branches’, on the ' + esc(s.occupancy) + ' column; the peak is the largest run’s, never a sum. Sized at the velocity cap: practice, not code. The pressure and developed-length check is Bid Check’s.</p>';
    html += '<p class="water-schedule-rules">' + chip('plumb.wsfu.fixtures') + chip('plumb.wsfu.demand') + chip('plumb.water.pipe-id') + chip('plumb.water.velocity') + chip('plumb.water.fixture-supply-min') + '</p>';
    body.innerHTML = html;
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
    if (cold) cold.value = ws.coldFps;
    if (hot) hot.value = ws.hotFps;
    const occ = occupancy();
    document.querySelectorAll('#waterScheduleOccupancy button[data-occupancy]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.occupancy === occ)));
  }
  function openWaterScheduleModal() {
    scheduleScope = 'project';
    syncScopeSegment();
    syncKnobs();
    renderScheduleBody();
    App.showModal('waterScheduleModal');
  }
  // The opener shows only while the project has a water run.
  function syncWaterScheduleBtn() {
    const btn = document.getElementById('waterScheduleBtn');
    const wm = WM();
    if (!btn || !wm) return;
    const state = App.state;
    const any = (state.pages || []).some((p, pi) => wm.waterRunsOf(App.getActiveAnnotations(p, pi), state.lineTypes || []).length > 0);
    btn.style.display = any ? '' : 'none';
  }

  // --- Copy Schedule and the copy rows ----------------------------------------------
  function rowCells(r) {
    return [r.name + ' (' + r.typeName + ')', r.side, fmt(r.served) + ' WSFU', r.gpm + ' gpm', r.key ? r.key + ' in' : '', r.velocityFps != null ? r.velocityFps + ' ft/s' : '', r.ok ? 'ok' : '⚠ ' + r.warnings.join('; ') + (r.suggestedKey && r.suggestedKey !== r.key ? ' → ' + r.suggestedKey + ' in' : '')];
  }
  function buildWaterCopyRows(s) {
    if (!s) return [];
    const lines = [];
    ['cold', 'hot'].forEach((side) => {
      const rs = s.rows.filter((r) => r.side === side);
      if (!rs.length) return;
      rs.forEach((r) => lines.push(rowCells(r).join('\t')));
      const t = s.totals[side];
      lines.push([sideLabel(side) + ' peak', side, fmt(t.wsfu) + ' WSFU', t.gpm + ' gpm', '', 'cap ' + t.cap + ' ft/s', t.warn ? t.warn + ' ⚠' : 'ok'].join('\t'));
    });
    lines.push(['Occupancy', s.occupancy, '', '', '', '', 'practice, not code'].join('\t'));
    return lines;
  }
  function buildWaterScheduleText(s) {
    if (!s) return '';
    return ['Water sizing', ['Run', 'Side', 'WSFU', 'gpm', 'Size', 'Velocity', 'Check'].join('\t')].concat(buildWaterCopyRows(s)).join('\n');
  }
  async function doCopyWaterSchedule(getAnnFn, pageIndices, mode) {
    const s = computeWaterSchedule({ pageIndices, getAnnotations: getAnnFn ? (pi) => getAnnFn(App.state.pages[pi], pi) : undefined });
    const text = buildWaterScheduleText(s);
    if (!text) { App.showToast('No water runs to schedule yet.', 4000); return; }
    try {
      await navigator.clipboard.writeText(text);
      App.logUserEvent('copy_summary', App.state.currentProjectId || null, { surface: 'water-schedule', mode: mode || 'project' });
      App.showToast('Water sizing copied: ' + s.rows.length + (s.rows.length === 1 ? ' run' : ' runs') + (s.warnCount ? ', ' + s.warnCount + ' ⚠' : ', all under the caps') + '. Pastes in columns.', 4000);
    } catch (err) {
      console.error('[copy]', err);
      App.showToast('Nothing was copied. The browser blocked clipboard access. Click Copy Schedule again, and allow clipboard access if the browser asks.', 6000);
    }
  }
  function getWaterScheduleForReport(opts) { return computeWaterSchedule(opts || {}); }

  // --- wiring ----------------------------------------------------------------------
  const openBtn = document.getElementById('waterScheduleBtn');
  if (openBtn) openBtn.onclick = (e) => { e.stopPropagation(); openWaterScheduleModal(); };
  const scopeSeg = document.getElementById('waterScheduleScope');
  if (scopeSeg) scopeSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-scope]');
    if (!b) return;
    scheduleScope = b.dataset.scope === 'page' ? 'page' : 'project';
    syncScopeSegment();
    renderScheduleBody();
  });
  const capChange = (id, key, fallback) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const v = parseFloat(el.value);
      getWaterSettings()[key] = Number.isFinite(v) && v > 0 ? v : fallback;
      syncKnobs();
      App.markProjectDirty();
      App.updateUI();          // the Lines list readouts and the trace card read the caps
      renderScheduleBody();
    });
  };
  capChange('waterCapCold', 'coldFps', 8);
  capChange('waterCapHot', 'hotFps', 5);
  const occSeg = document.getElementById('waterScheduleOccupancy');
  if (occSeg) occSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-occupancy]');
    if (!b || !App.setProjectCodes) return;
    App.setProjectCodes({ occupancy: b.dataset.occupancy }, { route: 'water-schedule' });   // the same field Project Settings edits
    syncKnobs();
    renderScheduleBody();
  });
  const copyBtn = document.getElementById('waterScheduleCopy');
  if (copyBtn) copyBtn.onclick = async () => {
    await App.runGatedCopy(null, scopePageIndices(), doCopyWaterSchedule, 'water-schedule', scheduleScope === 'page' ? 'this-sheet' : 'project', () => []);
  };

  App.getWaterSettings = getWaterSettings;
  App.computeWaterSchedule = computeWaterSchedule;
  App.openWaterScheduleModal = openWaterScheduleModal;
  App.syncWaterScheduleBtn = syncWaterScheduleBtn;
  App.buildWaterScheduleText = buildWaterScheduleText;
  App.buildWaterCopyRows = buildWaterCopyRows;
  App.getWaterScheduleForReport = getWaterScheduleForReport;
})();

/*
 * features/bid-check.js - **Bid Check** (Electrical, First-Class S5): the
 * sidebar section where the app says what it knows and asks what it cannot.
 *
 * AUTO rows are rule functions (bid-check-model.js) over the app's own tallies
 * — conduit fill, voltage drop to the farthest device, circuits vs the panel
 * schedule, every device on a circuit — and show their work. MANUAL rows are
 * judgment calls ticked per project; ticks persist in `state.bidCheck.manual`
 * (with the circuit-load and voltage defaults the voltage-drop row assumes),
 * riding every save/load/export/import path like ductSettings. Trade-skinned:
 * every project sees the trade-neutral manual rows; electrical projects see the
 * electrical rows too. The section is collapsed by default (state.bidCheckCollapsed,
 * in-memory) with the open-item count on its header.
 *
 * Advisory at the gate: after Copy to /Tooling, Open in TakeoffTooling and
 * Export PDFs the open items surface as a toast with a Review link — never a
 * block; the estimator decides (features/output.js and export-pdfs.js call
 * App.showBidCheckAdvisory(surface) once the action has run).
 *
 * Registrations: getBidCheck({ pageIndices?, getAnnotations? }) ->
 *   { auto: [{ id, label, verdict, detail }], manual: [{ id, label, trade, done }],
 *     open: { auto, manual, total }, defaults: { loadAmps, volts } }
 * (report.js consumes it guarded for the Bid Check section, the email block and
 * the payload's `checks`), renderBidCheck() (updateUI), showBidCheckAdvisory(surface),
 * openBidCheckAtRow(rowId) (expand + scroll + flash one row — the gate toast's Review).
 *
 * DUCT (D9, features/duct-bidcheck.js): once the project has a duct run the
 * seam App.getDuctBidCheck contributes duct-model's DUCT_BID_CHECK_ROWS —
 * its auto rows after the trade's, its manual rows BEFORE the trade-neutral
 * ones (the duct judgment calls sit with the duct scope; generic sign-off
 * last), ticked in the same state.bidCheck.manual map. The Copy / Export
 * PDFs GATE (the interactive "Review · Export anyway" toast) is that file's;
 * this file's post-action advisory yields to it on the gated surfaces.
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const BM = () => window.BidCheckModel;
  const CM = () => window.ConductorModel;

  function bidCheckState() {
    const state = App.state;
    if (!state.bidCheck || typeof state.bidCheck !== 'object') state.bidCheck = { manual: {} };
    if (!state.bidCheck.manual || typeof state.bidCheck.manual !== 'object') state.bidCheck.manual = {};
    return state.bidCheck;
  }
  function defaults() {
    const bc = bidCheckState();
    return { loadAmps: bc.loadAmps > 0 ? bc.loadAmps : 12, volts: bc.volts > 0 ? bc.volts : 120 };
  }

  // Distinct (raceway, conductors) combinations on scaled runs — one fill case
  // each, labelled the way the verdict reads ('1/2" EMT · 10 #12 THHN').
  function collectFillCases(pageIndices, getAnn) {
    const state = App.state;
    const cm = CM();
    const cases = new Map();
    const ltById = new Map((state.lineTypes || []).map((lt) => [lt.id, lt]));
    pageIndices.forEach((pi) => {
      const ann = getAnn(pi);
      if (!ann) return;
      const add = (item, isPoly) => {
        const lt = ltById.get(item.lineTypeId);
        const rw = lt && lt.raceway;
        if (!rw || !rw.size || cm.isCableRaceway(rw.kind)) return;
        const conductors = cm.conductorsForLine(item, lt);
        if (!conductors) return;
        const split = App.getLineLengthSplitForTotals(item, pi, isPoly, ann);
        if (!(split.feet > 0)) return;
        const key = cm.racewayLabel(rw) + '|' + cm.formatConductorSpec(conductors);
        if (!cases.has(key)) cases.set(key, { label: cm.racewayLabel(rw) + ' · ' + cm.formatConductorSpec(conductors), raceway: rw, conductors, runs: 0 });
        cases.get(key).runs++;
      };
      (ann.quickLines || []).forEach((q) => add(q, false));
      (ann.polylines || []).forEach((p) => add(p, true));
    });
    return [...cases.values()];
  }

  // Devices (non-panel counter marks) with no group, while circuits exist.
  function countUntaggedDevices(pageIndices, getAnn) {
    const state = App.state;
    const panelIds = new Set((state.counters || []).filter((c) => c.panelName).map((c) => c.id));
    let n = 0;
    pageIndices.forEach((pi) => {
      const ann = getAnn(pi);
      if (!ann) return;
      Object.entries(ann.counterMarkers || {}).forEach(([cid, marks]) => {
        if (panelIds.has(cid)) return;
        (marks || []).forEach((m) => { if (!m.group) n++; });
      });
    });
    return n;
  }

  function getBidCheck(opts) {
    const state = App.state;
    const bm = BM();
    if (!state || !bm) return { auto: [], manual: [], open: { auto: 0, manual: 0, total: 0 }, defaults: { loadAmps: 12, volts: 120 } };
    const o = opts || {};
    const pageIndices = o.pageIndices || (state.pages || []).map((_, i) => i);
    const getAnn = o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi));
    const trade = state.trade || null;
    const d = defaults();
    let auto = [];
    if (trade === 'electrical' && CM() && state.pages && state.pages.length) {
      const schedule = App.getCircuitSchedule ? App.getCircuitSchedule({ pageIndices, getAnnotations: getAnn }) : { panels: [], crossCheck: [] };
      const circuits = schedule.panels.flatMap((p) => p.circuits);
      auto = bm.bidCheckAutoRows({
        fillCases: collectFillCases(pageIndices, getAnn),
        circuits,
        crossCheck: schedule.crossCheck,
        untaggedDevices: circuits.length ? countUntaggedDevices(pageIndices, getAnn) : 0,
        offRunDevices: circuits.reduce((s, c) => s + (c.devicesOffRuns || 0), 0),
        defaults: d,
      });
    }
    // Plumbing (rulebook slice 3): every line type whose name declares a
    // supported material should count its hangers from the rulebook spacing.
    if (trade === 'plumbing' && window.SupportModel) {
      const row = window.SupportModel.hangerCoverage(state.lineTypes);
      if (row) auto = [row];
    }
    const manualState = bidCheckState().manual;
    let manual = bm.BID_CHECK_MANUAL_ROWS.filter((r) => !r.trade || r.trade === trade).map((r) => ({ id: r.id, label: r.label, trade: r.trade, done: !!manualState[r.id] }));
    // D9: the duct rows, once the project has duct (null = none contributed).
    const duct = App.getDuctBidCheck ? App.getDuctBidCheck({ pageIndices, getAnnotations: getAnn }) : null;
    if (duct) {
      auto = auto.concat(duct.auto);
      manual = duct.manual.map((r) => ({ id: r.id, label: r.label, short: r.short, trade: 'duct', done: r.done })).concat(manual);
    }
    return { auto, manual, open: bm.bidCheckOpenCount(auto, manualState, trade, duct ? duct.manual : null), defaults: d };
  }

  // --- the sidebar section ----------------------------------------------------

  function renderBidCheck() {
    const state = App.state;
    const section = document.getElementById('bidCheckSection');
    if (!section || !state) return;
    const hasProject = !!(state.pages && state.pages.length);
    section.style.display = hasProject ? '' : 'none';
    if (!hasProject) return;
    const check = getBidCheck();
    const badge = document.getElementById('bidCheckBadge');
    if (badge) {
      badge.textContent = String(check.open.total);
      badge.className = 'badge bid-check-badge' + (check.open.auto ? ' warn' : '');
      badge.title = check.open.auto + ' check' + (check.open.auto === 1 ? '' : 's') + ' at ⚠ · ' + check.open.manual + ' unticked';
    }
    if (App.renderDuctBidBadges) App.renderDuctBidBadges();   // D9: the Copy / Export PDFs gate badges
    const collapsed = state.bidCheckCollapsed !== false;   // collapsed by default
    document.getElementById('bidCheckCollapseIcon').textContent = collapsed ? '▶' : '▼';
    const list = document.getElementById('bidCheckList');
    list.style.display = collapsed ? 'none' : '';
    if (collapsed) return;
    const esc = App.escapeHtml;
    const showEdit = !state.isViewer;
    list.innerHTML = '';
    check.auto.forEach((r) => {
      const div = document.createElement('div');
      div.className = 'bid-check-row auto ' + r.verdict;
      div.dataset.rowId = r.id;
      div.innerHTML = '<span class="bid-check-mark">' + (r.verdict === 'ok' ? '✓' : r.verdict === 'warn' ? '⚠' : '·') + '</span>'
        + '<div class="bid-check-body"><div class="bid-check-label">' + esc(r.label) + ' <span class="bid-check-kind">auto</span>' + (r.rule && App.ruleChipHtml ? ' ' + App.ruleChipHtml(r.rule) : '') + '</div><div class="bid-check-detail">' + esc(r.detail) + '</div></div>';
      list.appendChild(div);
    });
    check.manual.forEach((r) => {
      const div = document.createElement('div');
      div.className = 'bid-check-row manual' + (r.done ? ' done' : '');
      div.dataset.rowId = r.id;
      div.innerHTML = '<button type="button" class="bid-check-box" role="checkbox" aria-checked="' + r.done + '" data-id="' + esc(r.id) + '"' + (showEdit ? '' : ' disabled') + '></button>'
        + '<div class="bid-check-body"><div class="bid-check-label">' + esc(r.label) + '</div></div>';
      if (showEdit) {
        div.querySelector('.bid-check-box').onclick = () => {
          const bc = bidCheckState();
          if (bc.manual[r.id]) delete bc.manual[r.id]; else bc.manual[r.id] = true;
          App.markProjectDirty();
          App.logUserEvent && App.logUserEvent('bid_check_row_state', state.currentProjectId || null, { row: r.id, kind: 'manual', state: !!bc.manual[r.id] });
          renderBidCheck();
        };
      }
      list.appendChild(div);
    });
    // Rulebook slice 4: which editions the rows resolve against, with the way to change them.
    if (App.getProjectCodes) {
      const codes = App.getProjectCodes();
      const edition = codes[state.trade || 'plumbing'] || '';
      const foot = document.createElement('div');
      foot.className = 'bid-check-codes';
      foot.innerHTML = 'Rules resolve for <b>' + esc([edition, codes.jurisdiction].filter(Boolean).join(' · ') || 'the model code as written') + '</b> — <button type="button" class="bid-check-codes-link" id="bidCheckCodesLink">Project Settings</button>';
      foot.querySelector('#bidCheckCodesLink').onclick = () => { App.syncProjectSettingsRows && App.syncProjectSettingsRows(); App.showModal('settingsModal'); };
      list.appendChild(foot);
    }
    // The voltage-drop defaults, inline (electrical only).
    if (state.trade === 'electrical') {
      const d = check.defaults;
      const div = document.createElement('div');
      div.className = 'bid-check-defaults';
      div.innerHTML = 'Voltage drop assumes <input type="number" id="bidCheckLoadAmps" min="1" step="1" value="' + d.loadAmps + '" aria-label="Default circuit load (amps)"' + (showEdit ? '' : ' disabled') + '> A per circuit at <input type="number" id="bidCheckVolts" min="1" step="1" value="' + d.volts + '" aria-label="Circuit voltage"' + (showEdit ? '' : ' disabled') + '> V unless the group says otherwise.';
      const commit = () => {
        const bc = bidCheckState();
        const amps = parseFloat(div.querySelector('#bidCheckLoadAmps').value);
        const volts = parseFloat(div.querySelector('#bidCheckVolts').value);
        const next = { loadAmps: Number.isFinite(amps) && amps > 0 ? amps : 12, volts: Number.isFinite(volts) && volts > 0 ? volts : 120 };
        if (next.loadAmps === (bc.loadAmps || 12) && next.volts === (bc.volts || 120)) return;
        if (next.loadAmps === 12) delete bc.loadAmps; else bc.loadAmps = next.loadAmps;
        if (next.volts === 120) delete bc.volts; else bc.volts = next.volts;
        App.markProjectDirty();
        renderBidCheck();
      };
      div.querySelectorAll('input').forEach((el) => { el.onblur = commit; el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } }; });
      list.appendChild(div);
    }
  }

  // --- the advisory at the gate ----------------------------------------------

  let advisoryTimer = null;
  function showBidCheckAdvisory(surface) {
    const state = App.state;
    if (!state || !state.pages || !state.pages.length) return;
    if (App.ductBidGateHandles && App.ductBidGateHandles(surface)) return;   // D9: the pre-action gate is the surface with duct present
    const check = getBidCheck();
    if (!check.open.auto) return;   // advisory only when the app itself found something
    const el = document.getElementById('bidCheckAdvisoryModal');
    const textEl = document.getElementById('bidCheckAdvisoryText');
    if (!el || !textEl) return;
    const warn = check.auto.filter((r) => r.verdict === 'warn');
    textEl.textContent = 'Bid Check has ' + warn.length + ' open item' + (warn.length === 1 ? '' : 's') + ': ' + warn.map((r) => r.label.replace(/ within.*| on plan.*| and reached.*/i, '').toLowerCase()).join(', ') + '.';
    App.logUserEvent && App.logUserEvent('bid_check_row_state', state.currentProjectId || null, { surface, kind: 'auto', open: warn.map((r) => r.id) });
    if (advisoryTimer) clearTimeout(advisoryTimer);
    App.showModal('bidCheckAdvisoryModal');
    advisoryTimer = setTimeout(() => { App.hideModal('bidCheckAdvisoryModal'); advisoryTimer = null; }, 8000);
  }
  document.getElementById('bidCheckAdvisoryReview')?.addEventListener('click', () => {
    if (advisoryTimer) clearTimeout(advisoryTimer);
    advisoryTimer = null;
    App.hideModal('bidCheckAdvisoryModal');
    App.state.bidCheckCollapsed = false;
    renderBidCheck();
    document.body.classList.add('sidebar-open');
    document.getElementById('bidCheckSection')?.scrollIntoView({ block: 'nearest' });
  });
  document.getElementById('bidCheckSectionTitle')?.addEventListener('click', () => {
    App.state.bidCheckCollapsed = App.state.bidCheckCollapsed === false;
    renderBidCheck();
  });

  // D9 (the gate toast's Review): expand the section, uncollapse the desktop
  // sidebar / open the mobile one, scroll the row into view and flash it —
  // B10's summary-flash recipe (remove + reflow so a repeat restarts it).
  function openBidCheckAtRow(rowId) {
    App.state.bidCheckCollapsed = false;
    renderBidCheck();
    document.body.classList.remove('sidebar-collapsed');
    document.body.classList.add('sidebar-open');
    const section = document.getElementById('bidCheckSection');
    const row = rowId ? section?.querySelector('.bid-check-row[data-row-id="' + rowId + '"]') : null;
    const target = row || section;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    target.classList.remove(row ? 'bid-check-flash' : 'summary-flash');
    void target.offsetWidth;
    target.classList.add(row ? 'bid-check-flash' : 'summary-flash');
  }

  App.getBidCheck = getBidCheck;
  App.renderBidCheck = renderBidCheck;
  App.showBidCheckAdvisory = showBidCheckAdvisory;
  App.openBidCheckAtRow = openBidCheckAtRow;
})();

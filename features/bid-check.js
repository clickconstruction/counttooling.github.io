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
 * openBidCheckAtRow(rowId) (expand + scroll + flash one row — the gate toast's Review),
 * bidCheckScope(opts) (R13: the pages, annotation getter and tick map every
 * contributor reads), and the export gate's runBidGate (+ its spec seam
 * isBidGateAcknowledged).
 *
 * CONTRIBUTORS: once the project has a duct run, App.getDuctBidCheck
 * (features/duct-bidcheck.js, D9) contributes duct-model's DUCT_BID_CHECK_ROWS;
 * once it has a water run, App.getWaterBidCheck (features/water-bidcheck.js,
 * WATER-PLAN rung 6) contributes water-model's WATER_BID_CHECK_ROWS. Their auto
 * rows follow the trade's, their manual rows sit BEFORE the trade-neutral ones
 * (the judgment calls sit with their scope; generic sign-off last), ticked in
 * the same state.bidCheck.manual map. Both tables resolve through
 * bid-check-model.js's resolveBidCheckRows.
 *
 * THE EXPORT GATE (R13: moved here from features/duct-bidcheck.js, where D9
 * built it; it is trade-generic). Copy to /Tooling (features/output.js
 * runGatedCopy, surfaces pipe-tooling / takeoff-tooling, after the T1-05 scale
 * gate) and Export PDFs (`#specificPages`, features/export-pdfs.js) run
 * App.runBidGate(proceed, surface). While a contributor is present
 * (GATE_CONTRIBUTORS: duct runs, water runs) and the WHOLE panel has open
 * items, it shows the INTERACTIVE corner toast `#bidGateToastModal`, "Bid
 * Check: Fits the roof? — Review · Export anyway" (T2-04 .toast-interactive +
 * T2-06 gate-link, the B3 Copy-again precedent): Review opens the panel at that
 * row (openBidCheckAtRow), Export anyway calls proceed() inside the click
 * (clipboard writes stay permitted). Otherwise proceed() runs straight away,
 * silent. NEVER a block. The post-action advisory yields to the gate on those
 * surfaces (bidGateHandles), and (D18, J19 #9) on the 'duct-schedule' and
 * 'water-schedule' copies, whose single "copied" toast carries the open ⚠ rows.
 * GATE MEMORY (D18, B19 ratchet, "Export anyway IS the acknowledgment"):
 * pressing Export anyway records the exact unresolved-row set on
 * `state.bidCheck.acknowledgedGate`, `{ rows: [{ id, verdict }], at }` (verdict
 * 'warn' for an auto ⚠ row, 'unchecked' for an unticked manual row, ids
 * sorted), and the next Export / Copy presses proceed silently while the live
 * set is IDENTICAL; any change re-arms the toast. It rides the project data
 * like the ticks (every intake spreads state.bidCheck).
 * THE BADGES on `#forPipeTooling` / `#specificPages` ("2 ⚠ · 3 unchecked",
 * `.bid-gate-badge`), present only while the gate would fire, render from the
 * check renderBidCheck already computed (D25: one Bid Check per updateUI); only
 * the click-time gate computes a fresh one.
 * Telemetry: `bid_check_row_state` ({ surface, kind: 'gate', open: [ids],
 * choice }) via App.logUserEvent (the S5 event, allowlisted).
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

  // R13: the one scope + ticks read every contributor shares (features/duct-bidcheck.js,
  // water-bidcheck.js): the pages in scope (every page by default), the annotation
  // getter (each page's active canvas by default) and the manual tick map, read-only.
  function bidCheckScope(opts) {
    const state = App.state;
    const o = opts || {};
    const bc = state && state.bidCheck;
    return {
      pageIndices: o.pageIndices || ((state && state.pages) || []).map((_, i) => i),
      getAnn: o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi)),
      ticks: bc && bc.manual && typeof bc.manual === 'object' ? bc.manual : {},
    };
  }

  function getBidCheck(opts) {
    const state = App.state;
    const bm = BM();
    if (!state || !bm) return { auto: [], manual: [], open: { auto: 0, manual: 0, total: 0 }, defaults: { loadAmps: 12, volts: 120 } };
    const { pageIndices, getAnn } = bidCheckScope(opts);
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
      // Only the types with a run in scope: a palette type nobody drew on this bid (the Artboard's
      // "4in PVC old") has nothing to hang or fit, and with a standing palette both rows stayed open
      // however many hangers the bid's own pipe counted (by hand, 2026-09-25).
      const drawn = new Set();
      pageIndices.forEach((pi) => { const ann = getAnn(pi); if (!ann) return; (ann.polylines || []).concat(ann.quickLines || []).forEach((l) => { if (l && l.lineTypeId) drawn.add(l.lineTypeId); }); });
      const runTypes = (state.lineTypes || []).filter((lt) => drawn.has(lt.id));
      const row = window.SupportModel.hangerCoverage(runTypes);
      // BEND-FITTINGS: the fittings row rides beside the hangers row.
      const fit = window.SupportModel.bendFittingCoverage ? window.SupportModel.bendFittingCoverage(runTypes) : null;
      const rows = [row, fit].filter(Boolean);
      if (rows.length) auto = auto.concat(rows);
    }
    const manualState = bidCheckState().manual;
    let manual = bm.BID_CHECK_MANUAL_ROWS.filter((r) => !r.trade || r.trade === trade).map((r) => ({ id: r.id, label: r.label, trade: r.trade, done: !!manualState[r.id] }));
    // D9: the duct rows, once the project has duct (null = none contributed).
    const duct = App.getDuctBidCheck ? App.getDuctBidCheck({ pageIndices, getAnnotations: getAnn }) : null;
    if (duct) {
      auto = auto.concat(duct.auto);
      manual = duct.manual.map((r) => ({ id: r.id, label: r.label, short: r.short, trade: 'duct', done: r.done })).concat(manual);
    }
    // WATER-PLAN rung 6: the water rows, once the project has a water run (features/water-bidcheck.js).
    const water = App.getWaterBidCheck ? App.getWaterBidCheck({ pageIndices, getAnnotations: getAnn }) : null;
    if (water) {
      auto = auto.concat(water.auto);
      manual = water.manual.map((r) => ({ id: r.id, label: r.label, short: r.short, trade: 'water', done: r.done })).concat(manual);
    }
    const extraManual = (duct ? duct.manual : []).concat(water ? water.manual : []);
    return { auto, manual, open: bm.bidCheckOpenCount(auto, manualState, trade, extraManual.length ? extraManual : null), defaults: d };
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
    renderBidGateBadges(check);   // D9: the Copy / Export PDFs gate badges, from this check (D25)
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
      // D17 (J19 #1): a hint that sends the estimator to Groups while the
      // per-project gate is off becomes the door — "Turn on groups" in place.
      if (showEdit && /\(Groups\)/.test(r.detail || '') && App.groupsUiVisible && !App.groupsUiVisible() && App.turnOnGroupsFromDuct) {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'duct-groups-link bid-check-groups-link';
        link.textContent = 'Turn on groups';
        link.onclick = (e) => { e.stopPropagation(); App.turnOnGroupsFromDuct(); };
        div.querySelector('.bid-check-detail').append(' ', link);
      }
      list.appendChild(div);
    });
    // A manual row is a wrapping <label> (the house checkbox pattern — the
    // scale dialog's "Show the scale line"): the whole row, label text
    // included, is the tick's click target, and the text is the box's
    // accessible name. A click on the text activates the labelled button
    // once (the browser's label activation), a click on the box is the box's
    // own click — never two toggles. Viewers keep the disabled box: a label
    // click on a disabled control does nothing.
    check.manual.forEach((r) => {
      const div = document.createElement('label');
      div.className = 'bid-check-row manual' + (r.done ? ' done' : '') + (showEdit ? '' : ' readonly');
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
      foot.innerHTML = 'Rules resolve for <b>' + esc([edition, codes.jurisdiction].filter(Boolean).join(' · ') || 'the model code as written') + '</b> · <button type="button" class="bid-check-codes-link" id="bidCheckCodesLink">Project Settings</button>';
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
    if (bidGateHandles(surface)) return;   // D9: the pre-action gate is the surface while a contributor is present
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

  // --- the export gate (R13: from features/duct-bidcheck.js) ------------------

  const GATED_SURFACES = ['pipe-tooling', 'takeoff-tooling', 'export-pdfs'];
  // Surfaces whose own confirmation toast carries the open-items line, so the
  // advisory card must not stack a second one (D18: Copy Schedule; WATER-PLAN
  // rung 5: the water copy toast carries its own ⚠ count).
  const FOLDED_ADVISORY_SURFACES = ['duct-schedule', 'water-schedule'];
  // What puts a project behind the gate: a contributor with rows of its own.
  // A trade that contributes a table adds its predicate here.
  const GATE_CONTRIBUTORS = [
    () => !!(App.hasDuctRuns && App.hasDuctRuns()),     // D9, features/duct-bidcheck.js
    () => !!(App.hasWaterRuns && App.hasWaterRuns()),   // WATER-PLAN rung 6, features/water-bidcheck.js
  ];
  const gateScope = () => GATE_CONTRIBUTORS.some((has) => has());

  // What the gate reads: the WHOLE panel's open items (the trade rows too, the
  // panel is one sign-off list), but only while a contributor is present.
  // `check` is the one renderBidCheck already computed (D25); the click-time
  // gate passes none and gets a fresh one.
  function gateStatus(check) {
    if (!gateScope()) return null;
    const c = check || getBidCheck();
    if (!c) return null;
    const auto = c.auto.filter((r) => r.verdict === 'warn');
    const manual = c.manual.filter((r) => !r.done);
    const first = auto[0] || manual[0] || null;
    return { auto, manual, first, open: auto.length + manual.length };
  }

  function bidGateHandles(surface) {
    if (FOLDED_ADVISORY_SURFACES.includes(surface)) return true;
    return GATED_SURFACES.includes(surface) && gateScope();
  }

  // Gate memory (D18). The unresolved set as the memory records it: every auto
  // ⚠ row and every unticked manual row, `{ id, verdict }`, sorted by id so two
  // walks of the same state compare equal.
  function unresolvedRows(status) {
    return status.auto.map((r) => ({ id: r.id, verdict: 'warn' }))
      .concat(status.manual.map((r) => ({ id: r.id, verdict: 'unchecked' })))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  const rowsKey = (rows) => (rows || []).map((r) => r.id + '=' + r.verdict).join('|');
  function isAcknowledged(status) {
    const bc = App.state && App.state.bidCheck;
    const ack = bc && bc.acknowledgedGate;
    if (!ack || !Array.isArray(ack.rows) || !ack.rows.length) return false;
    return rowsKey(ack.rows) === rowsKey(unresolvedRows(status));
  }
  function acknowledgeGate(status) {
    bidCheckState().acknowledgedGate = { rows: unresolvedRows(status), at: new Date().toISOString() };
    App.markProjectDirty && App.markProjectDirty();
  }

  let gateTimer = null;
  let pendingProceed = null;   // { proceed, surface, rowId, projectId, rows } while the toast is up
  const shortLabel = (row) => row.short || row.label.replace(/[:—].*$/, '').replace(/ within.*| on plan.*| and reached.*/i, '');

  function hideGateToast() {
    if (gateTimer) { clearTimeout(gateTimer); gateTimer = null; }
    App.hideModal('bidGateToastModal');
  }

  // proceed() runs the export. Synchronous when nothing gates it (the caller's
  // user gesture is intact); deferred to the toast's "Export anyway" otherwise.
  function runBidGate(proceed, surface) {
    const status = gateStatus();
    if (!status || !status.open) return proceed();
    // D18 gate memory: the same unresolved set was already exported past, so
    // the earlier "Export anyway" stands until the set changes.
    if (isAcknowledged(status)) {
      App.logUserEvent && App.logUserEvent('bid_check_row_state', App.state.currentProjectId || null,
        { surface, kind: 'gate', choice: 'remembered', open: status.auto.concat(status.manual).map((r) => r.id) });
      return proceed();
    }
    const el = document.getElementById('bidGateToastModal');
    const textEl = document.getElementById('bidGateToastText');
    if (!el || !textEl) return proceed();
    textEl.textContent = 'Bid Check: ' + shortLabel(status.first) + '?';
    pendingProceed = { proceed, surface, rowId: status.first.id, projectId: App.state.currentProjectId || null, rows: unresolvedRows(status) };
    App.logUserEvent && App.logUserEvent('bid_check_row_state', App.state.currentProjectId || null,
      { surface, kind: 'gate', open: status.auto.concat(status.manual).map((r) => r.id) });
    if (gateTimer) clearTimeout(gateTimer);
    App.showModal('bidGateToastModal');
    gateTimer = setTimeout(() => { hideGateToast(); pendingProceed = null; }, 8000);
    return undefined;
  }

  document.getElementById('bidGateReview')?.addEventListener('click', () => {
    const pending = pendingProceed;
    pendingProceed = null;
    hideGateToast();
    App.logUserEvent && App.logUserEvent('bid_check_row_state', App.state.currentProjectId || null, { surface: pending?.surface, kind: 'gate', choice: 'review' });
    openBidCheckAtRow(pending ? pending.rowId : null);
  });
  document.getElementById('bidGateExportAnyway')?.addEventListener('click', () => {
    const pending = pendingProceed;
    pendingProceed = null;
    hideGateToast();
    if (!pending || pending.projectId !== (App.state.currentProjectId || null)) return;
    App.logUserEvent && App.logUserEvent('bid_check_row_state', App.state.currentProjectId || null, { surface: pending.surface, kind: 'gate', choice: 'export-anyway' });
    // D18: "Export anyway" IS the acknowledgment. Remember the set the toast
    // was raised for (not a re-walk: the state may have moved while it was up).
    acknowledgeGate({ auto: pending.rows.filter((r) => r.verdict === 'warn'), manual: pending.rows.filter((r) => r.verdict === 'unchecked') });
    // The click is the user gesture: the clipboard write inside proceed stays permitted.
    pending.proceed();
  });

  // The badges on the two gated buttons, from the check renderBidCheck passes.
  function badgeText(status) {
    const parts = [];
    if (status.auto.length) parts.push(status.auto.length + ' ⚠');
    if (status.manual.length) parts.push(status.manual.length + ' unchecked');
    return parts.join(' · ');
  }

  function renderBidGateBadges(check) {
    const status = gateStatus(check);
    ['forPipeTooling', 'specificPages'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      let badge = btn.querySelector('.bid-gate-badge');
      if (!status || !status.open) { if (badge) { badge.remove(); btn.removeAttribute('title'); } return; }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'bid-gate-badge';
        badge.setAttribute('aria-hidden', 'true');
        btn.appendChild(badge);
      }
      const text = badgeText(status);
      if (badge.textContent !== text) badge.textContent = text;
      btn.title = 'Bid Check: ' + text + '. Review in the sidebar, or export anyway';
    });
  }

  App.bidCheckScope = bidCheckScope;
  App.runBidGate = runBidGate;
  App.isBidGateAcknowledged = () => { const s = gateStatus(); return !!(s && s.open && isAcknowledged(s)); };   // D18 spec seam

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

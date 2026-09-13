/*
 * features/duct-bidcheck.js — the duct rows of **Bid Check** (DUCT-PLAN.md
 * unit D9: the fourth pillar, quantity → capacity → physics → sign-off).
 *
 * The panel itself is S5's (features/bid-check.js — `#bidCheckSection`); this
 * file FEEDS it once the project has any duct run, through the registry seam
 * App.getDuctBidCheck({ pageIndices?, getAnnotations? }) → { rows, auto,
 * manual, unresolved } | null (null = no duct = nothing contributed, no gate).
 * The rows are duct-model's DUCT_BID_CHECK_ROWS data table resolved against
 * live inputs this file collects from what the app already computes:
 *   Every room served          D7  App.getRoomAirBalance (under-served rooms)
 *   Systems within capacity    D7  groups with capacityCfm vs App.getDuctSystemDesignedCfm
 *   Flex drops within max      D8  computeDuctSchedule().flexRows (overCount)
 *   Scale set on every sheet   T1-05  App.collectUnscaledDuctPages (the gate's collector)
 *   Fits the roof              MANUAL until ductSettings.deckHeightFt + a room ceiling
 *                              under the run (App.roomHeightAtPoint at the segment's
 *                              vertices — the smallest containing room box) + the run's
 *                              size/liner are all known, then AUTO with its work
 *                              ("24×12 + 2" wrap = 14" · plenum 30" ✓" — duct-model
 *                              ductPlenumFit; depth = rect h / round d + 2 × insulation)
 *   + the manual rows (fire dampers, OA, static path — auto deferred, curb &
 *     power, controls), ticked in state.bidCheck.manual like S5's.
 *
 * Three more surfaces this file owns:
 *   1. The export GATE — Copy to /Tooling (features/output.js runGatedCopy,
 *      surfaces pipe-tooling / takeoff-tooling, after the T1-05 scale gate)
 *      and Export PDFs (`#specificPages`, features/export-pdfs.js) run
 *      App.runDuctBidGate(proceed, surface): with duct present and unresolved
 *      rows it shows the INTERACTIVE corner toast `#bidGateToastModal` —
 *      "Bid Check: Fits the roof? — Review · Export anyway" (T2-04
 *      .toast-interactive + T2-06 gate-link pattern, the B3 Copy-again
 *      precedent) — Review opens the panel scrolled + flashed to that row
 *      (App.openBidCheckAtRow, B10's summary-flash), Export anyway calls
 *      proceed() inside the click (clipboard writes stay permitted). No duct
 *      or every row resolved → proceed() straight away, silent. NEVER a block.
 *      S5's post-action advisory yields to this gate on those surfaces
 *      (App.ductBidGateHandles).
 *   2. The BADGES on `#forPipeTooling` / `#specificPages` ("2 ⚠ · 3 unchecked",
 *      `.bid-gate-badge`) — rendered by App.renderDuctBidBadges from
 *      renderBidCheck, present only while the gate would fire.
 *   3. The S-popover DEPTH LINE at order 40 (the D2 seam): while tracing with
 *      deck height + a room ceiling under the last placed vertex known, a
 *      quiet "14" deep · plenum 30" ✓" (⚠ past it) for the current size —
 *      informative, never interrupts the trace.
 *
 * Telemetry: `bid_check_row_state` ({ surface, kind: 'gate', open: [ids],
 * choice }) via App.logUserEvent (the S5 event, allowlisted).
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load; pure duct math by bare duct-model.js globals. See ARCHITECTURE.md
 * "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const GATED_SURFACES = ['pipe-tooling', 'takeoff-tooling', 'export-pdfs'];

  function scopeOf(opts) {
    const state = App.state;
    const o = opts || {};
    const pageIndices = o.pageIndices || (state.pages || []).map((_, i) => i);
    const getAnn = o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi));
    return { pageIndices, getAnn };
  }

  // Runs with ≥2 vertices on the scope's pages (the schedule's universe rule).
  function collectDuctRuns(scope) {
    const out = [];
    scope.pageIndices.forEach((pi) => {
      const ann = scope.getAnn(pi);
      (ann?.ductRuns || []).forEach((run) => {
        if (run && (run.vertices?.length || 0) >= 2) out.push({ pageIdx: pi, run });
      });
    });
    return out;
  }

  function hasDuctRuns(opts) {
    const state = App.state;
    if (!state || !state.pages || !state.pages.length) return false;
    return collectDuctRuns(scopeOf(opts)).length > 0;
  }

  const pageLabel = (pi) => App.state.pages[pi]?.label || 'Page ' + (pi + 1);

  // The ceiling under a run segment: the smallest known room ceiling at any of
  // the span's vertices (App.roomHeightAtPoint — nested rooms resolve to the
  // inner one). null when no vertex sits in a room box with a height.
  function segmentCeilingFt(run, span, pageIdx) {
    if (!App.roomHeightAtPoint) return null;
    let best = null;
    for (let i = span.fromIdx; i <= span.toIdx; i++) {
      const h = App.roomHeightAtPoint(run.vertices[i], pageIdx);
      if (h > 0 && (best == null || h < best)) best = h;
    }
    return best;
  }

  function collectPlenumItems(runs) {
    const items = [];
    runs.forEach(({ pageIdx, run }) => {
      runSegmentSpans(run).forEach((span) => {
        const ceilingFt = segmentCeilingFt(run, span, pageIdx);
        if (!(ceilingFt > 0)) return;
        items.push({ runName: run.name || 'Duct run', size: span.size, linerType: run.linerType || null, linerThicknessIn: run.linerThicknessIn || 0, ceilingFt });
      });
    });
    return items;
  }

  // The inputs duct-model's evaluators read — every block from a surface the
  // app already renders (no new math here).
  function collectInputs(scope, runs) {
    const state = App.state;
    const ds = App.getDuctSettings ? App.getDuctSettings() : (state.ductSettings || {});
    const rooms = App.getRoomAirBalance ? App.getRoomAirBalance() : [];
    const systems = (state.groups || []).filter((g) => g && g.capacityCfm > 0).map((g) => ({
      name: g.name || 'System', capacityCfm: g.capacityCfm,
      designedCfm: App.getDuctSystemDesignedCfm ? App.getDuctSystemDesignedCfm(g.id) : 0,
    }));
    let flex = null;
    if (App.computeDuctSchedule) {
      const s = App.computeDuctSchedule({ pageIndices: scope.pageIndices, getAnnotations: scope.getAnn });
      if (s && s.flexRows && s.flexRows.length) {
        flex = {
          drops: s.flexRows.reduce((n, r) => n + r.count, 0),
          overCount: s.flexRows.reduce((n, r) => n + r.overCount, 0),
          maxFlexFt: s.maxFlexFt,
          overSystems: s.flexRows.filter((r) => r.overCount > 0).map((r) => r.systemName),
        };
      }
    }
    const ductPageIdx = [...new Set(runs.map((r) => r.pageIdx))];
    const unscaledIdx = App.collectUnscaledDuctPages
      ? App.collectUnscaledDuctPages((page, pi) => scope.getAnn(pi), ductPageIdx)
      : [];
    return {
      rooms, systems, flex,
      ductPages: ductPageIdx.map(pageLabel),
      unscaledPages: unscaledIdx.map(pageLabel),
      plenum: { deckHeightFt: ds.deckHeightFt > 0 ? ds.deckHeightFt : null, items: collectPlenumItems(runs) },
    };
  }

  function manualTicks() {
    const bc = App.state && App.state.bidCheck;
    return bc && bc.manual && typeof bc.manual === 'object' ? bc.manual : {};
  }

  // The seam features/bid-check.js reads: null = no duct = nothing contributed.
  function getDuctBidCheck(opts) {
    const state = App.state;
    if (!state || !state.pages || !state.pages.length || typeof ductBidCheckRows !== 'function') return null;
    const scope = scopeOf(opts);
    const runs = collectDuctRuns(scope);
    if (!runs.length) return null;
    const rows = ductBidCheckRows(collectInputs(scope, runs), manualTicks());
    return {
      rows,
      auto: rows.filter((r) => r.kind === 'auto'),
      manual: rows.filter((r) => r.kind === 'manual'),
      unresolved: ductBidCheckUnresolved(rows),
    };
  }

  // --- the gate --------------------------------------------------------------

  // What the gate reads: the WHOLE panel's open items (S5's trade rows too —
  // the panel is one sign-off list) — but only while the project has duct.
  function gateStatus() {
    if (!hasDuctRuns()) return null;
    const check = App.getBidCheck ? App.getBidCheck() : null;
    if (!check) return null;
    const auto = check.auto.filter((r) => r.verdict === 'warn');
    const manual = check.manual.filter((r) => !r.done);
    const first = auto[0] || manual[0] || null;
    return { auto, manual, first, open: auto.length + manual.length };
  }

  function ductBidGateHandles(surface) {
    return GATED_SURFACES.includes(surface) && hasDuctRuns();
  }

  let gateTimer = null;
  let pendingProceed = null;   // { proceed, surface, rowId, projectId } while the toast is up
  const shortLabel = (row) => row.short || row.label.replace(/ —.*$/, '').replace(/ within.*| on plan.*| and reached.*/i, '');

  function hideGateToast() {
    if (gateTimer) { clearTimeout(gateTimer); gateTimer = null; }
    App.hideModal('bidGateToastModal');
  }

  // proceed() runs the export. Synchronous when nothing gates it (the caller's
  // user gesture is intact); deferred to the toast's "Export anyway" otherwise.
  function runDuctBidGate(proceed, surface) {
    const status = gateStatus();
    if (!status || !status.open) return proceed();
    const el = document.getElementById('bidGateToastModal');
    const textEl = document.getElementById('bidGateToastText');
    if (!el || !textEl) return proceed();
    textEl.textContent = 'Bid Check: ' + shortLabel(status.first) + '?';
    pendingProceed = { proceed, surface, rowId: status.first.id, projectId: App.state.currentProjectId || null };
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
    if (App.openBidCheckAtRow) App.openBidCheckAtRow(pending ? pending.rowId : null);
  });
  document.getElementById('bidGateExportAnyway')?.addEventListener('click', () => {
    const pending = pendingProceed;
    pendingProceed = null;
    hideGateToast();
    if (!pending || pending.projectId !== (App.state.currentProjectId || null)) return;
    App.logUserEvent && App.logUserEvent('bid_check_row_state', App.state.currentProjectId || null, { surface: pending.surface, kind: 'gate', choice: 'export-anyway' });
    // The click is the user gesture: the clipboard write inside proceed stays permitted.
    pending.proceed();
  });

  // --- the badges ------------------------------------------------------------

  function badgeText(status) {
    const parts = [];
    if (status.auto.length) parts.push(status.auto.length + ' ⚠');
    if (status.manual.length) parts.push(status.manual.length + ' unchecked');
    return parts.join(' · ');
  }

  function renderDuctBidBadges() {
    const status = gateStatus();
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
      btn.title = 'Bid Check: ' + text + ' — review in the sidebar, or export anyway';
    });
  }

  // --- the S-popover depth line (order 40) ------------------------------------

  function draftDepthLine(size, draft) {
    const state = App.state;
    const ds = App.getDuctSettings ? App.getDuctSettings() : null;
    if (!ds || !(ds.deckHeightFt > 0) || !isDuctSize(size) || !draft || !draft.vertices || !draft.vertices.length) return null;
    const last = draft.vertices[draft.vertices.length - 1];
    const ceilingFt = App.roomHeightAtPoint ? App.roomHeightAtPoint(last, state.currentPage) : null;
    if (!(ceilingFt > 0)) return null;
    const fit = ductPlenumFit({ deckHeightFt: ds.deckHeightFt, items: [{ runName: draft.name, size, linerType: draft.linerType, linerThicknessIn: draft.linerThicknessIn, ceilingFt }] });
    if (!fit) return null;
    const t = fit.tightest;
    const inches = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));
    return { ok: fit.ok, text: inches(t.depthIn) + '" deep · plenum ' + inches(t.plenumIn) + '" ' + (fit.ok ? '✓' : '⚠') };
  }

  if (App.registerDuctPopoverSection) {
    App.registerDuctPopoverSection({
      id: 'depth-line',
      order: 40,
      render(container, ctx) {
        const line = draftDepthLine(ctx.currentSize, ctx.draft);
        if (!line) return false;   // deck or ceiling unknown → clean absence
        const div = document.createElement('div');
        div.className = 'duct-depth-line' + (line.ok ? '' : ' warn');
        div.textContent = line.text;
        div.title = line.ok ? 'Deepest duct + insulation clears the plenum (deck height − room ceiling)' : 'Too deep for the plenum here (deck height − room ceiling) — the Bid Check row will say so';
        container.appendChild(div);
      },
    });
  }

  App.getDuctBidCheck = getDuctBidCheck;
  App.hasDuctRuns = hasDuctRuns;
  App.runDuctBidGate = runDuctBidGate;
  App.ductBidGateHandles = ductBidGateHandles;
  App.renderDuctBidBadges = renderDuctBidBadges;
  App.getDuctDraftDepthLine = draftDepthLine;   // spec seam
})();

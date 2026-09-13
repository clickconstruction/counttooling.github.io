/*
 * features/duct-tool.js — the Duct drawing tool (TOOL.DUCT), DUCT-PLAN.md
 * unit D2; LIVE since unit D5 (the shippable-core checkpoint): #ductBtn always
 * renders for non-viewer sessions — the D2–D4 preview flag (localStorage
 * 'clickcount-duct-preview' / App.enableDuctPreview()) is GONE.
 *
 * The tool is the POLYLINE PATTERN WITH SEGMENTS: arming (via the button →
 * #ductCreateModal — starting size, pressure class, liner, and (D4) the
 * Supply/Return/Exhaust airside chip, default Supply) creates
 * `state.drawingDuct`, a pre-commit draft exactly like state.drawingPolyline:
 *   { id, name, airside, pressureClass, linerType, linerThicknessIn,
 *     vertices: [{x,y}…],                    // PDF-space, like polyline.points
 *     segments: [{ startVertexIdx, size }],  // duct-model.js run shape
 *     sizeSteps: [{ vertexIdx, from, to }] } // D3 turns these into transitions
 * Clicks stage vertices (45° snap + bounds, the commitPolylinePoint recipe);
 * `S` / tapping the cursor size chip / the finish-bar Size button open the
 * step popover (features/duct-size-popover.js — that file owns the surface,
 * THIS file owns what a pick means: applyDuctSizeStep ends the current
 * segment at the LAST placed vertex and starts the next at the new size,
 * recording the step on sizeSteps). Enter / double-click / the finish bar
 * commit the draft through duct-model's makeDuctRun onto the active canvas's
 * annotations.ductRuns (drawn by canvas-draw.js, so runs re-render on reload
 * and ride save/load/undo untouched). Esc is the staged T2-02 ladder: close
 * the popover → pop one vertex → clear the draft and exit to Move.
 *
 * app.js integration points: TOOL.DUCT branch in handleCanvasClick →
 * App.commitDuctClick; renderAnnotations → App.drawDuctOverlay (after the
 * hideMarks early-return, so hidden marks hide the trace too); updateUI →
 * App.onDuctToolSync; keydown → App.toggleDuctSizePopover (S while drawing),
 * App.finishDuctRun (Enter), App.handleDuctEscape (Esc rung);
 * HOTKEY_RUNNERS.moveReset / the viewer reset → App.clearDuctDraft.
 * features/status-bar.js reads App.ductLiveReadout() for the live
 * "24×12 · 38'-6" · 267 lb · run 1,196 lb" footer readout (T2-09 seam).
 *
 * Pure duct math (sizes, gauges, pounds, ductStrokePx stroke bands) comes
 * from duct-model.js globals; DUCT_AIRSIDE_COLORS from canvas-draw.js.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  let wired = false;
  let createShape = 'rect';
  // Airside chip selection (D4) — reset to 'supply' on every modal open so a
  // new run never silently inherits the previous run's airside.
  let createAirside = 'supply';
  // The cursor size chip's last-drawn rect in annotation-canvas BUFFER px —
  // the click hit-target that opens the popover (and the popover's anchor).
  let cursorChipRect = null;

  function isDuctDrawing() { return !!App.state.drawingDuct; }
  function currentDuctSize() {
    const d = App.state.drawingDuct;
    if (!d || !d.segments.length) return null;
    return d.segments[d.segments.length - 1].size;
  }

  // Auto-name like T2-12's nextPolylineName: project-wide run count + 1.
  function nextDuctRunName() {
    const state = App.state;
    let n = 0;
    for (const p of state.pages || []) for (const c of App.getPageCanvases(p)) n += (c.annotations?.ductRuns?.length || 0);
    return 'Duct run ' + (n + 1);
  }

  // --- create modal ---------------------------------------------------------

  function syncCreateShape() {
    const toggle = document.getElementById('ductCreateShapeToggle');
    if (!toggle) return;
    toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.shape === createShape));
    document.getElementById('ductCreateRectInputs').style.display = createShape === 'rect' ? '' : 'none';
    document.getElementById('ductCreateRoundInputs').style.display = createShape === 'round' ? '' : 'none';
  }

  function syncCreateAirside() {
    const toggle = document.getElementById('ductCreateAirside');
    if (!toggle) return;
    toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.airside === createAirside));
  }

  // D7 equipment-first suggestion (DUCT-PLAN master walkthrough): when rooms
  // carry target CFMs but NO system group has a capacity yet, one quiet line
  // seeds the system thinking — "Rooms total ~2,400 CFM — about 2 systems at
  // 1,200 CFM (edit in Groups)". Rule of thumb from duct-model's
  // DUCT_SYSTEM_RULE_OF_THUMB (~400 CFM/ton, ~5 tons per light-commercial
  // RTU → ~2,000 CFM per system). Informative only — nothing auto-creates.
  function syncEquipFirstLine() {
    const line = document.getElementById('ductCreateEquipFirst');
    if (!line) return;
    let txt = '';
    if (typeof suggestSystemsForCfm === 'function' && App.getRoomAirBalance
      && !(App.state.groups || []).some((g) => g.capacityCfm > 0)) {
      const total = App.getRoomAirBalance().reduce((sum, r) => sum + r.targetCfm, 0);
      const s = suggestSystemsForCfm(total);
      if (s) {
        txt = 'Rooms total ~' + Math.round(total).toLocaleString() + ' CFM — about '
          + s.systems + ' system' + (s.systems === 1 ? '' : 's') + ' at '
          + s.cfmEach.toLocaleString() + ' CFM (edit in Groups)';
      }
    }
    line.textContent = txt;
    line.style.display = txt ? '' : 'none';
  }

  function openDuctCreateModal() {
    document.getElementById('ductCreateName').value = nextDuctRunName();
    const sel = document.getElementById('ductCreatePressure');
    sel.innerHTML = DUCT_PRESSURE_CLASSES.map((pc) => '<option value="' + pc + '"' + (pc === '1' ? ' selected' : '') + '>' + pc + '"</option>').join('');
    createAirside = 'supply';
    syncCreateShape();
    syncCreateAirside();
    syncEquipFirstLine();
    App.showModal('ductCreateModal');
  }

  function readCreateSize() {
    if (createShape === 'round') {
      const d = parseFloat(document.getElementById('ductCreateD').value);
      return d > 0 ? makeRoundSize(d) : null;
    }
    const w = parseFloat(document.getElementById('ductCreateW').value);
    const h = parseFloat(document.getElementById('ductCreateH').value);
    return w > 0 && h > 0 ? makeRectSize(w, h) : null;
  }

  function startDuctTrace() {
    const state = App.state;
    const size = readCreateSize();
    if (!size) { App.showToast('Enter a starting size'); return; }
    state.drawingDuct = {
      id: App.uid(),
      name: document.getElementById('ductCreateName').value.trim() || nextDuctRunName(),
      airside: createAirside,   // D4 Supply/Return/Exhaust chip (default Supply)
      pressureClass: document.getElementById('ductCreatePressure').value || '1',
      linerType: document.getElementById('ductCreateLiner').value || null,
      linerThicknessIn: 0,
      // D4 (DUCT-PLAN §2): a run drawn while a system group is active inherits
      // it — the same state.activeGroupId convention T2-12 gave polylines.
      systemGroupId: state.activeGroupId || null,
      vertices: [],
      segments: [{ startVertexIdx: 0, size: size }],
      sizeSteps: [],
      // D8 (§4): rise/drop entries staged on the draft — { vertexIdx, ft,
      // auto? }; the popover's rise/drop section adds/removes them and the
      // commit carries them onto the run (duct-model verticalFt shape).
      verticalFt: [],
    };
    state.tool = App.TOOL.DUCT;
    App.hideModal('ductCreateModal');
    App.collapsePagesSectionForPlacing();
    App.updateUI();
  }

  // --- arming ---------------------------------------------------------------

  function onDuctBtnClick() {
    const state = App.state;
    if (!App.getPageScale(state.currentPage)) { App.showSetScaleFirstToast('Duct'); return; }
    // T2-12: an in-flight draft is resumed, never replaced — re-press mid-draw
    // just re-arms the tool; Finish/Esc/M remain the ways to start fresh.
    if (state.drawingDuct) { state.tool = App.TOOL.DUCT; App.updateUI(); return; }
    openDuctCreateModal();
  }

  // --- tracing --------------------------------------------------------------

  // One trace click. A click landing on the cursor size chip opens the step
  // popover instead of staging a vertex (the chip is the touch path to S).
  function commitDuctClick(pdf) {
    const state = App.state;
    const draft = state.drawingDuct;
    if (!draft) return;
    if (cursorChipRect && App.toCanvas) {
      const p = App.toCanvas(pdf);
      const r = cursorChipRect;
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        App.toggleDuctSizePopover && App.toggleDuctSizePopover();
        return;
      }
    }
    // Same snap-to-previous-axis + bounds recipe as commitPolylinePoint.
    let pt = pdf;
    if (draft.vertices.length >= 1 && state.lineTypeSettings.snapToHorizontalVertical) {
      const prev = draft.vertices[draft.vertices.length - 1];
      pt = App.snapLineToAngle(prev.x, prev.y, pdf.x, pdf.y);
      if (!App.isPointInPageBounds(pt)) pt = App.clampPointToPageBounds(pt);
    } else {
      if (!App.isPointInPageBounds(pdf)) { App.showOutOfBoundsToast(); return; }
    }
    App.pushUndoSnapshotCurrentPage();
    draft.vertices.push(pt);
    // D8 auto-riser (§4 "defaults absorb the common cases"): the FIRST vertex
    // of a system run landing on the system's equipment marker gets the
    // deck-height riser staged automatically (visible in tallies, removable
    // via the popover's rise/drop section while still at vertex 0).
    if (draft.vertices.length === 1) maybeAutoDeckRiser(draft);
    App.markProjectDirty();
  }

  // The auto-riser rule: project deck height set (ductSettings.deckHeightFt)
  // AND the draft belongs to a system group AND its first vertex lands within
  // the tap-snap tolerance of that system's equipment marker (D7's matching
  // ladder via App.getDuctSystemEquipmentPos). Riser feet = deck height minus
  // the ceiling of the room box under the vertex when one is known (heightFt
  // of a containing roomBox on the page's merged annotations), else the full
  // deck height; nothing is added when that lands ≤ 0.
  function maybeAutoDeckRiser(draft) {
    const state = App.state;
    const ds = App.getDuctSettings ? App.getDuctSettings() : null;
    const deck = ds && ds.deckHeightFt > 0 ? ds.deckHeightFt : 0;
    if (!deck || !draft.systemGroupId) return;
    const equip = App.getDuctSystemEquipmentPos && App.getDuctSystemEquipmentPos(draft.systemGroupId, state.currentPage);
    if (!equip) return;
    const v0 = draft.vertices[0];
    if (Math.hypot(v0.x - equip.x, v0.y - equip.y) > DUCT_TAP_SNAP_PDF) return;
    const page = state.pages[state.currentPage];
    const ann = page && App.getMergedAnnotationsForPage(page);
    const box = (ann?.roomBoxes || []).find((b) => b && b.heightFt > 0 && pointInRoomBox(v0, b));
    const ft = box ? Math.round((deck - box.heightFt) * 100) / 100 : deck;
    if (!(ft > 0)) return;
    if (!draft.verticalFt) draft.verticalFt = [];
    draft.verticalFt.push({ vertexIdx: 0, ft: ft, auto: true });
  }

  // A popover pick: end the current segment at the LAST placed vertex, start
  // the next at the new size, and record the step (D3's transition input).
  // With no vertex placed yet (or a second pick at the same vertex) the
  // boundary already exists — the size is REPLACED, not stacked, so the
  // duct-model "startVertexIdx strictly ascending" invariant holds.
  function applyDuctSizeStep(newSize) {
    const draft = App.state.drawingDuct;
    if (!draft || !isDuctSize(newSize)) return;
    const from = currentDuctSize();
    if (from && formatDuctSize(from) === formatDuctSize(newSize)) return;   // no-op pick
    const last = draft.segments[draft.segments.length - 1];
    const lastVertexIdx = draft.vertices.length - 1;
    if (draft.vertices.length === 0 || last.startVertexIdx === lastVertexIdx) {
      last.size = cloneDuctSize(newSize);
      const step = draft.sizeSteps.find((s) => s.vertexIdx === last.startVertexIdx);
      if (step) step.to = cloneDuctSize(newSize);
    } else {
      draft.segments.push({ startVertexIdx: lastVertexIdx, size: cloneDuctSize(newSize) });
      draft.sizeSteps.push({ vertexIdx: lastVertexIdx, from: cloneDuctSize(from), to: cloneDuctSize(newSize) });
    }
    App.renderAnnotations();
    App.updateUI();
  }

  // --- commit ---------------------------------------------------------------

  // Returns true when a run was committed (the dblclick caller uses it to
  // swallow the gesture). <2 vertices = nothing to commit (polyline rule).
  function finishDuctRun() {
    const state = App.state;
    const draft = state.drawingDuct;
    if (!draft || draft.vertices.length < 2) return false;
    App.pushUndoSnapshot();
    const page = state.pages[state.currentPage];
    const canvas = page && App.ensureActiveCanvas(page);
    if (canvas) {
      const run = makeDuctRun({
        id: draft.id,
        name: draft.name,
        airside: draft.airside,
        pressureClass: draft.pressureClass,
        linerType: draft.linerType,
        linerThicknessIn: draft.linerThicknessIn,
        systemGroupId: draft.systemGroupId,
        vertices: draft.vertices,
        segments: draft.segments,
        verticalFt: draft.verticalFt,   // D8 — attached only when entries exist
      });
      run.sizeSteps = draft.sizeSteps;   // D3's transition-fitting input
      if (!canvas.annotations.ductRuns) canvas.annotations.ductRuns = [];
      canvas.annotations.ductRuns.push(run);
      // D3: the commit is the inference moment — re-walk the canvas's runs
      // into auto fittings (corner/step/tap), reconciled against manual
      // overrides (features/duct-fittings.js).
      App.reinferDuctFittings && App.reinferDuctFittings(state.currentPage);
      // D5 telemetry: one duct_run event per committed run (allowlisted by the
      // 20260906120000_log_user_event_duct_run migration). Metadata mirrors
      // the schedule's units: segment count, straight LF + lb of THIS run
      // (duct-model math over the app's scale glue), airside, and how many
      // fittings the inference walk anchored to it.
      try {
        const ann = canvas.annotations;
        const distFt = (a, b) => App.getLineRealWorldLengthFeet({ points: [a, b] }, state.currentPage, true, ann) || 0;
        const tally = tallyStraightBySize(runStraightItems(run, distFt), run.pressureClass);
        const fittings = (ann.ductFittings || []).filter((f) => f.runId === run.id && !f.suppressed).length;
        App.logUserEvent('duct_run', state.currentProjectId || null, {
          segments: run.segments.length,
          totalFt: Math.round(tally.totalLengthFt),
          totalLb: Math.round(tally.totalPounds),
          airside: run.airside,
          fittings: fittings,
        });
      } catch (_) { /* telemetry only — never blocks the commit */ }
    }
    state.drawingDuct = null;
    state.tool = App.TOOL.NONE;
    App.closeDuctSizePopover && App.closeDuctSizePopover();
    App.markProjectDirty();
    App.updateUI();
    App.renderAnnotations();
    return true;
  }

  function clearDuctDraft() {
    App.state.drawingDuct = null;
    cursorChipRect = null;
    App.closeDuctSizePopover && App.closeDuctSizePopover();
  }

  // Esc ladder rung (staged per T2-02): popover → one vertex → draft+exit.
  // Returns true when a stage was consumed; false = nothing duct-side left
  // (app.js then exits to Move itself — reached only when the tool is armed
  // with no draft, e.g. right after a commit left the tool active).
  function handleDuctEscape() {
    const state = App.state;
    if (App.isDuctPopoverOpen && App.isDuctPopoverOpen()) { App.closeDuctSizePopover(); return true; }
    const draft = state.drawingDuct;
    if (!draft) return false;
    if (draft.vertices.length > 0) {
      draft.vertices.pop();
      const n = draft.vertices.length;
      // Prune segment boundaries (and their recorded steps) that no longer
      // have a vertex to sit on; the starting segment always survives.
      while (draft.segments.length > 1 && draft.segments[draft.segments.length - 1].startVertexIdx >= n) {
        const dropped = draft.segments.pop();
        draft.sizeSteps = draft.sizeSteps.filter((s) => s.vertexIdx !== dropped.startVertexIdx);
      }
      // D8: rise/drop entries anchored to the popped vertex go with it.
      if (draft.verticalFt) draft.verticalFt = draft.verticalFt.filter((e) => e.vertexIdx < n);
      App.renderAnnotations();
      App.updateUI();
    } else {
      clearDuctDraft();
      state.tool = App.TOOL.NONE;
      App.updateUI();
      App.renderAnnotations();
    }
    return true;
  }

  // --- live overlay ---------------------------------------------------------

  // Segment spans over the draft, INCLUDING the rubber-band cursor point.
  function draftSpansWithCursor(cursorPdf) {
    const draft = App.state.drawingDuct;
    if (!draft) return { verts: [], spans: [] };
    const verts = cursorPdf ? [...draft.vertices, cursorPdf] : [...draft.vertices];
    const spans = runSegmentSpans({ vertices: verts, segments: draft.segments });
    return { verts, spans };
  }

  function snappedCursor() {
    const state = App.state;
    const draft = state.drawingDuct;
    if (!draft || !state.mousePos) return null;
    if (draft.vertices.length >= 1 && state.lineTypeSettings?.snapToHorizontalVertical) {
      const prev = draft.vertices[draft.vertices.length - 1];
      return App.snapLineToAngle(prev.x, prev.y, state.mousePos.x, state.mousePos.y);
    }
    return state.mousePos;
  }

  // Called from renderAnnotations AFTER the hideMarks early-return: the
  // in-progress trace at stepped stroke widths (dashed = not yet committed),
  // per-segment size chips, and the cursor size chip (tap target for the
  // popover). env = { fontScale, lineOpacity } from the live overlay.
  function drawDuctOverlay(ctx, env) {
    const state = App.state;
    const draft = state.drawingDuct;
    cursorChipRect = null;
    if (!draft || state.tool !== App.TOOL.DUCT) return;
    const color = DUCT_AIRSIDE_COLORS[draft.airside] || DUCT_AIRSIDE_COLORS.supply;
    const cursor = snappedCursor();
    const { verts, spans } = draftSpansWithCursor(cursor);
    const fontScale = env?.fontScale || 1;
    const lo = env?.lineOpacity != null ? env.lineOpacity : 1;
    ctx.save();
    spans.forEach((span) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = ductStrokePx(span.size);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.globalAlpha = lo;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      const p0 = App.toCanvas(verts[span.fromIdx]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = span.fromIdx + 1; i <= span.toIdx; i++) { const p = App.toCanvas(verts[i]); ctx.lineTo(p.x, p.y); }
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Per-segment size chips at the segment midpoints (committed-look labels
    // arrive via canvas-draw at commit; these track the live trace).
    const chip = (label, cx, cy, remember) => {
      const fontSize = 10 * fontScale;
      ctx.font = '600 ' + fontSize + 'px DM Sans';
      const tw = ctx.measureText(label).width;
      const pad = 4;
      const x = cx - tw / 2 - pad, y = cy - fontSize / 2 - pad;
      const w = tw + pad * 2, h = fontSize + pad * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      if (remember) cursorChipRect = { x, y, w, h };
    };
    spans.forEach((span) => {
      const a = App.toCanvas(verts[span.fromIdx]);
      const b = App.toCanvas(verts[span.toIdx]);
      chip(formatDuctSize(span.size), (a.x + b.x) / 2, (a.y + b.y) / 2, false);
    });
    // Cursor size chip: rides just past the cursor; a click/tap on it opens
    // the step popover (commitDuctClick checks cursorChipRect first).
    const cur = currentDuctSize();
    if (cur && cursor) {
      const pc = App.toCanvas(cursor);
      // Offset scales with the overlay's font scale so the chip clears the
      // cursor at any zoom/DPR.
      const chipX = pc.x + 24 + 14 * fontScale;
      const chipY = pc.y - 10 - 8 * fontScale;
      chip(formatDuctSize(cur) + ' ▾', chipX, chipY, true);
      // D6: the design-build suggestion line rides UNDER the size chip when
      // the system has CFM data ("450 CFM downstream · suggests 12×10 @
      // 0.08″/100′ — S accepts"; features/duct-suggest.js — informs only, S /
      // the popover accepts). Drawn at a smaller size so the chip stays the
      // headline; defensive read per the registry boundary rule.
      const sug = App.getDuctDraftSuggestion && App.getDuctDraftSuggestion();
      if (sug) {
        const sFont = 8.5 * fontScale;
        ctx.font = '600 ' + sFont + 'px DM Sans';
        const tw = ctx.measureText(sug.chipText).width;
        const pad = 4;
        const sy = chipY + (10 * fontScale) / 2 + pad * 2 + sFont / 2 + 3;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(chipX - tw / 2 - pad, sy - sFont / 2 - pad, tw + pad * 2, sFont + pad * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(chipX - tw / 2 - pad, sy - sFont / 2 - pad, tw + pad * 2, sFont + pad * 2);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sug.chipText, chipX, sy);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }
    ctx.restore();
  }

  // Popover anchor for features/duct-size-popover.js: the cursor chip's rect
  // converted to CLIENT coords (null when it hasn't been drawn — the popover
  // then anchors to the canvas center).
  function getDuctChipClientAnchor() {
    const c = document.getElementById('annCanvas');
    if (!c || !cursorChipRect || !c.width) return null;
    const rect = c.getBoundingClientRect();
    return {
      x: rect.left + (cursorChipRect.x + cursorChipRect.w / 2) * (rect.width / c.width),
      y: rect.top + (cursorChipRect.y + cursorChipRect.h) * (rect.height / c.height),
    };
  }

  // --- live readout (T2-09 seam; consumed by features/status-bar.js) --------

  function feetBetween(a, b, ann, pageIdx) {
    return App.getLineRealWorldLengthFeet({ points: [a, b] }, pageIdx, true, ann) || 0;
  }

  // "24×12 · 38'-6" · 267 lb · run 1,196 lb" — current segment size, its
  // running length (duct-model lb math over the app's scale glue), and the
  // whole run's pounds including the rubber band. '' when not tracing.
  function ductLiveReadout() {
    const state = App.state;
    const draft = state.drawingDuct;
    if (!draft || state.tool !== App.TOOL.DUCT || !draft.vertices.length) return '';
    const cursor = snappedCursor();
    const { verts, spans } = draftSpansWithCursor(cursor);
    if (!spans.length) return '';
    const page = state.pages[state.currentPage];
    const ann = page ? App.getActiveAnnotations(page) : null;
    const pageIdx = state.currentPage;
    const cur = spans[spans.length - 1];
    // Current segment: feet-inches label via the same pdf-pts + effective-scale
    // calls the Measure chip makes.
    const segPts = verts.slice(cur.fromIdx, cur.toIdx + 1);
    const pdfPts = App.getLineLengthPdfPts({ points: segPts, closed: false }, pageIdx, true);
    const eff = ann ? App.getEffectiveScaleForLine(ann, { points: segPts }, true, pageIdx) : App.getPageScale(pageIdx);
    const lenLabel = App.formatDistFeetInches(pdfPts, eff);
    const distFt = (a, b) => feetBetween(a, b, ann, pageIdx);
    // D8: verticalFt rides the items (at the segment-at-vertex size) so the
    // run pounds include staged risers/drops; the CURRENT-segment pounds stay
    // the last flat span (vertical items carry `vertical: true`).
    const items = runStraightItems({ vertices: verts, segments: draft.segments, linerType: draft.linerType, verticalFt: draft.verticalFt }, distFt);
    let segLb = 0, runLb = 0;
    items.forEach((it) => {
      const lb = segmentPounds(it.size, selectGauge(draft.pressureClass, it.size), it.lengthFt) || 0;
      runLb += lb;
      if (!it.vertical) segLb = lb;
    });
    return formatDuctSize(cur.size) + ' · ' + lenLabel + ' · ' + Math.round(segLb).toLocaleString()
      + ' lb · run ' + Math.round(runLb).toLocaleString() + ' lb';
  }

  // --- D8: the rise/drop popover section (§4 "Vertical footage lives in the
  // S popover") — registered at order 30, the D2 seam's reserved slot. "Rise/
  // drop X ft here": vertical LF staged on the draft at the LAST placed
  // vertex; existing entries AT that vertex list with a remove × — the auto
  // deck riser included, so opening the popover right after the first click
  // (still at vertex 0) is the way to drop an unwanted riser. NOTE: this file
  // loads BEFORE duct-size-popover.js, so the registration happens in wire()
  // (first updateUI — the seam exists by then; same-id re-registers are
  // idempotent), not at IIFE load. ------------------------------------------

  const riseDropSection = {
    id: 'rise-drop',
    order: 30,
    render(container, ctx) {
      const draft = App.state.drawingDuct;
      if (!draft || !draft.vertices.length) return false;   // nothing placed — nowhere to anchor
      const vIdx = draft.vertices.length - 1;
      const label = document.createElement('div');
      label.className = 'duct-popover-section-label';
      label.textContent = 'Rise / drop';
      container.appendChild(label);
      (draft.verticalFt || []).forEach((e, i) => {
        if (e.vertexIdx !== vIdx) return;
        const row = document.createElement('div');
        row.className = 'duct-vertical-row';
        const txt = document.createElement('span');
        txt.textContent = e.ft + "' vertical" + (e.auto ? ' · auto riser' : '');
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'duct-vertical-remove';
        del.title = 'Remove this rise/drop';
        del.setAttribute('aria-label', 'Remove ' + e.ft + ' ft rise/drop');
        del.textContent = '×';
        del.onclick = () => {
          draft.verticalFt.splice(i, 1);
          App.markProjectDirty();
          App.updateUI();
          ctx.requestRender();
        };
        row.append(txt, del);
        container.appendChild(row);
      });
      const inputs = document.createElement('div');
      inputs.className = 'duct-size-inputs';
      const ftInput = document.createElement('input');
      ftInput.type = 'number';
      ftInput.min = '0';
      ftInput.step = '0.5';
      ftInput.placeholder = 'ft';
      ftInput.setAttribute('aria-label', 'Rise or drop, feet');
      const unit = document.createElement('span');
      unit.textContent = 'ft here';
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'duct-custom-apply';
      add.textContent = 'Add';
      add.onclick = () => {
        const ft = parseFloat(ftInput.value);
        if (!(ft > 0)) { App.showToast('Enter the vertical feet'); return; }
        if (!draft.verticalFt) draft.verticalFt = [];
        draft.verticalFt.push({ vertexIdx: vIdx, ft: ft });
        App.markProjectDirty();
        App.updateUI();
        ctx.requestRender();
      };
      inputs.append(ftInput, unit, add);
      container.appendChild(inputs);
    },
  };

  // --- core→feature sync (updateUI calls this every pass) -------------------

  function onDuctToolSync() {
    const state = App.state;
    wire();
    const btn = document.getElementById('ductBtn');
    if (btn) {
      // LIVE since D5: only viewer sessions hide the button (no preview flag).
      btn.style.display = state.isViewer ? 'none' : '';
      btn.classList.toggle('active', state.tool === App.TOOL.DUCT);
    }
    if (state.isViewer && state.drawingDuct) clearDuctDraft();
    const bar = document.getElementById('ductFinishBar');
    if (bar) bar.classList.toggle('visible', !!state.drawingDuct);
    if (state.tool !== App.TOOL.DUCT && App.isDuctPopoverOpen && App.isDuctPopoverOpen()) App.closeDuctSizePopover();
  }

  function wire() {
    if (wired) return;
    wired = true;
    // D8: the rise/drop popover section — registered here because the seam
    // (duct-size-popover.js) loads after this file.
    App.registerDuctPopoverSection && App.registerDuctPopoverSection(riseDropSection);
    const btn = document.getElementById('ductBtn');
    if (btn) btn.onclick = onDuctBtnClick;
    document.getElementById('ductCreateCancel').onclick = () => App.hideModal('ductCreateModal');
    document.getElementById('ductCreateStart').onclick = startDuctTrace;
    document.getElementById('ductCreateShapeToggle').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-shape]');
      if (!b) return;
      createShape = b.dataset.shape;
      syncCreateShape();
    });
    document.getElementById('ductCreateAirside').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-airside]');
      if (!b) return;
      createAirside = b.dataset.airside;
      syncCreateAirside();
    });
    document.getElementById('finishDuctRunBtn').onclick = () => finishDuctRun();
    document.getElementById('ductSizeStepBtn').onclick = () => App.toggleDuctSizePopover && App.toggleDuctSizePopover();
  }

  App.isDuctDrawing = isDuctDrawing;
  App.getCurrentDuctSize = currentDuctSize;
  App.commitDuctClick = commitDuctClick;
  App.applyDuctSizeStep = applyDuctSizeStep;
  App.finishDuctRun = finishDuctRun;
  App.handleDuctEscape = handleDuctEscape;
  App.clearDuctDraft = clearDuctDraft;
  App.drawDuctOverlay = drawDuctOverlay;
  App.getDuctChipClientAnchor = getDuctChipClientAnchor;
  App.ductLiveReadout = ductLiveReadout;
  App.onDuctToolSync = onDuctToolSync;
})();

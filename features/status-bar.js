(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/status-bar.js - the status-bar / footer-totals cluster, extracted
   * from app.js's Math & Format Helpers region (where it was always misfiled —
   * it is pure DOM chrome over state + save-engine getters): the footer totals
   * cache (computeFooterTotals / getFooterTotalsCached / invalidateFooterTotals),
   * the status-bar renderer (updateStatus — sync dot/square, mode line, tool
   * hints, [count | length] totals), the Save Status summary-block data
   * (getCloudSaveSummary, consumed by features/save-status.js), and the
   * save-status bell state (updateSaveStatusIndicator — the hot-path bell;
   * the on-demand modal lives in features/save-status.js).
   * app.js keeps same-named thin wrappers for its ~30 call sites and the
   * save-engine ctx entries; new publish-only deps: formatSaveTime,
   * formatSaveTimeParts, formatAgo, getLastSaveIncludedPdf, and the engine
   * getter passthroughs (isSaveInProgress, isSavePdfInProgress,
   * getSaveProgressMessage, wasLastCloudSaveAttemptFailed,
   * getLastLocalBackupAt).
   * Boundary rule: read shared deps from App.* at call time, never captured at
   * load. See ARCHITECTURE.md "Feature files / window.App registry".
   */

  let footerTotalsCache = null;
  let footerTotalsDirty = true;
  // One-line-only tool hints: cache key (composed text @ bar width) + verdict,
  // so the wrap measurement's forced layout read runs only when either changes.
  let footerHintKey = null;
  let footerHintFits = true;
  function invalidateFooterTotals() { footerTotalsDirty = true; }
  function computeFooterTotals() {
    const state = App.state;
    if (!state.pages || !state.pages.length) return { count: 0, lengthFt: 0, lengthPx: 0 };
    let count = 0, lengthFt = 0, lengthPx = 0;
    state.pages.forEach((page, i) => {
      const ann = (typeof App.getMergedAnnotationsForPage === 'function')
        ? App.getMergedAnnotationsForPage(page)
        : (page.annotations || App.makeAnnotations());
      (state.counters || []).forEach(c => {
        const ms = ann.counterMarkers?.[c.id] || [];
        ms.forEach(m => {
          count += (typeof App.getMultiplyZoneForPoint === 'function') ? App.getMultiplyZoneForPoint(ann, m) : 1;
        });
      });
      // T1-05 ft/px split: feet and raw-px lengths accumulate in separate
      // buckets and are never summed under one label.
      const addSplit = (line, isPoly) => {
        if (typeof App.getLineLengthSplitForTotals !== 'function') return;
        const s = App.getLineLengthSplitForTotals(line, i, isPoly, ann);
        lengthFt += s.feet; lengthPx += s.px;
      };
      (ann.quickLines || []).forEach(q => addSplit(q, false));
      (ann.polylines || []).forEach(poly => addSplit(poly, true));
    });
    return { count, lengthFt, lengthPx };
  }
  function getFooterTotalsCached() {
    const state = App.state;
    const pageCount = state.pages?.length || 0;
    const counterCount = state.counters?.length || 0;
    const lineTypeCount = state.lineTypes?.length || 0;
    if (footerTotalsDirty || !footerTotalsCache
        || footerTotalsCache._pageCount !== pageCount
        || footerTotalsCache._counterCount !== counterCount
        || footerTotalsCache._lineTypeCount !== lineTypeCount) {
      footerTotalsCache = computeFooterTotals();
      footerTotalsCache._pageCount = pageCount;
      footerTotalsCache._counterCount = counterCount;
      footerTotalsCache._lineTypeCount = lineTypeCount;
      footerTotalsDirty = false;
    }
    return footerTotalsCache;
  }

  // Live length readout while drawing (Tier-2 #21): the running feet-inches of
  // the in-progress Quick Line / polyline trace, formatted exactly like the
  // Measure chip (formatDistFeetInches; 'N px' with no usable scale). Endpoint
  // snapping mirrors the dashed rubber-band preview byte-for-byte (45° snap
  // from the start / last vertex), so the number always matches the line on
  // screen; getLineLengthPdfPts is arc-aware and getEffectiveScaleForLine
  // honors scale zones — the same calls the Measure toast-turned-chip makes.
  // Returns '' when no draw is in progress.
  function liveDrawReadout() {
    const state = App.state;
    if (!state.mousePos || !state.pages || !state.pages.length) return '';
    const TOOL = App.TOOL;
    const snap = (a, b) => (state.lineTypeSettings?.snapToHorizontalVertical
      ? App.snapLineToAngle(a.x, a.y, b.x, b.y) : b);
    let tmp = null, isPoly = false;
    if (state.tool === TOOL.LINE && state.quickLineStart) {
      const a = state.quickLineStart;
      const b = snap(a, state.mousePos);
      tmp = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, lineTypeId: state.activeLineTypeId };
    } else if (state.tool === TOOL.POLYLINE && state.drawingPolyline
        && state.drawingPolyline.points.length >= 1) {
      const pts = state.drawingPolyline.points;
      const cursor = snap(pts[pts.length - 1], state.mousePos);
      tmp = { points: [...pts, cursor], closed: false, lineTypeId: state.drawingPolyline.lineTypeId };
      isPoly = true;
    }
    if (!tmp) return '';
    const page = state.pages[state.currentPage];
    const ann = page ? App.getActiveAnnotations(page) : null;
    const pdfPts = App.getLineLengthPdfPts(tmp, state.currentPage, isPoly);
    const eff = ann ? App.getEffectiveScaleForLine(ann, tmp, isPoly, state.currentPage)
      : App.getPageScale(state.currentPage);
    return App.formatDistFeetInches(pdfPts, eff);
  }
  // Worst-case stand-in for the wrap cache: keying the one-line fit verdict on
  // the live number would re-run the forced layout read every mousemove — the
  // exact thrash the (text @ width) cache exists to prevent (field feedback
  // 2026-08-14). The fit is measured with this fixed placeholder instead, so
  // the verdict is stable while the number grows and a growing readout can
  // never wrap the bar mid-draw.
  const HINT_READOUT_PLACEHOLDER = '88888\'-88"';

  function updateStatus() {
    const state = App.state;
    const lastLocalBackupAt = App.getLastLocalBackupAt();   // engine-owned (Stage 3)
    const modeEl = document.getElementById('statusMode');
    const coordsEl = document.getElementById('statusCoords');
    const dotEl = document.getElementById('statusBarDot');
    const squareEl = document.getElementById('statusBarSquare');
    const canvasLabelEl = document.getElementById('statusCanvasLabel');
    const pdfLabelEl = document.getElementById('statusPdfLabel');
    const pdfGroupEl = document.getElementById('statusPdfGroup');
    let mode;
    const cloudMode = App.SUPABASE_ENABLED && state.supabaseSession?.user;
    if (cloudMode) {
      if (pdfGroupEl) { pdfGroupEl.style.display = ''; }
      if (App.isSaveInProgress()) {
        if (dotEl) { dotEl.className = 'dot dot-yellow'; dotEl.title = 'Canvas sync: Uploading...'; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas Uploading...';
        mode = '';
      } else if (state.lastSavedAt && !App.getAutoSaveDirty()) {
        let canvasTitle = 'Canvas sync: Synced with Cloud';
        if (state.lastSavedAt) canvasTitle += '\nCloud: ' + App.formatSaveTime(state.lastSavedAt);
        if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
        if (dotEl) { dotEl.className = 'dot dot-green'; dotEl.title = canvasTitle; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas';
        mode = '';
      } else if (!state.pages.length) {
        if (dotEl) { dotEl.className = 'dot dot-grey'; dotEl.title = 'Canvas sync: Upload PDF to start a project'; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas';
        if (pdfLabelEl) pdfLabelEl.textContent = 'PDF - Upload PDF to start a project';
        mode = '';
      } else if (state.isViewer) {
        let canvasTitle = 'Canvas sync: Viewing (read-only)';
        if (state.lastSavedAt) canvasTitle += '\nCloud: ' + App.formatSaveTime(state.lastSavedAt);
        if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
        if (dotEl) { dotEl.className = 'dot dot-yellow'; dotEl.title = canvasTitle; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas Viewing (read-only)';
        mode = state.checkedOutEmail ? ('Viewing — ' + (App.twinEmailText ? App.twinEmailText(state.checkedOutEmail) : state.checkedOutEmail) + ' is editing') : 'Viewing — Available (check out to edit)';
      } else {
        let canvasTitle = 'Canvas sync: Project not saved to cloud';
        if (state.lastSavedAt) canvasTitle += '\nCloud: ' + App.formatSaveTime(state.lastSavedAt);
        if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
        if (dotEl) { dotEl.className = 'dot dot-red'; dotEl.title = canvasTitle; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas';
        mode = '';
      }
      if (squareEl) {
        const pdfSynced = App.getLastSaveIncludedPdf() || !!state.pdfStoragePath;
        if (App.isSavePdfInProgress()) { squareEl.className = 'square square-yellow'; squareEl.title = 'PDF sync: Uploading PDF...'; }
        else if (pdfSynced) {
          let pdfTitle = 'PDF sync: Synced with Cloud';
          if (state.lastSavedAt) pdfTitle += '\nCloud: ' + App.formatSaveTime(state.lastSavedAt);
          if (lastLocalBackupAt) pdfTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
          squareEl.className = 'square square-green'; squareEl.title = pdfTitle;
        } else if (!state.pages.length) { squareEl.className = 'square square-grey'; squareEl.title = 'PDF sync: No PDF in project'; }
        else {
          let pdfTitle = 'PDF sync: PDF not saved to cloud';
          if (lastLocalBackupAt) pdfTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
          squareEl.className = 'square square-red'; squareEl.title = pdfTitle;
        }
      }
      if (pdfLabelEl) {
        const pdfSyncedLabel = App.getLastSaveIncludedPdf() || !!state.pdfStoragePath;
        if (App.isSavePdfInProgress()) pdfLabelEl.textContent = 'PDF Uploading...';
        else if (pdfSyncedLabel) pdfLabelEl.textContent = 'PDF Synced with Cloud';
        else if (!state.pages.length) pdfLabelEl.textContent = 'PDF - Upload PDF to start a project';
        else pdfLabelEl.textContent = 'PDF: Not saved to cloud';
      }
    } else {
      let canvasTitle = 'Canvas sync: Local only';
      if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
      if (dotEl) { dotEl.className = 'dot dot-green'; dotEl.title = canvasTitle; }
      if (canvasLabelEl) canvasLabelEl.textContent = '';
      if (pdfGroupEl) pdfGroupEl.style.display = 'none';
      if (App.isSaveInProgress() && App.getSaveProgressMessage()) {
        mode = App.getSaveProgressMessage();
      } else {
        const projectSegment = state.currentProjectName || (state.pages.length ? 'Untitled' : '—');
        let lastSavedSegment = '—';
        if (state.lastSavedAt) {
          const d = new Date(state.lastSavedAt);
          const agoSec = (Date.now() - d.getTime()) / 1000;
          const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
          const agoStr = App.formatAgo(agoSec);
          lastSavedSegment = timeStr + ' | ' + agoStr;
        }
        mode = projectSegment + ' - ' + lastSavedSegment;
        let toolHint = '';
        // Wrap-cache variant of the hint: live length readout replaced by the
        // fixed worst-case placeholder ('' = no readout, key on toolHint).
        let toolHintKeyed = '';
        const TOOL = App.TOOL, SCALE_MODES = App.SCALE_MODES;
        // B9 (J15): touch talks "Tap", mouse talks "Click" — same hints, the
        // trade's word for the device in hand (App.isCoarsePointer, live).
        const press = App.isCoarsePointer && App.isCoarsePointer() ? 'Tap' : 'Click';
        if (state.tool === TOOL.MEASURE) toolHint = state.aiming ? 'Hold + drag to aim; release to place' : (state.scaleMode === SCALE_MODES.POINT_A ? 'Tap first point (or hold to aim)' : 'Tap second point (or hold to aim)');
        else if (state.tool === TOOL.SCALE) toolHint = state.scaleMode === SCALE_MODES.POINT_A ? press + ' first point' : press + ' second point';
        else if (state.tool === TOOL.LINE || state.tool === TOOL.POLYLINE) {
          toolHint = state.tool === TOOL.LINE
            ? (state.quickLineStart ? 'Tap end point' : 'Tap start point')
            : press + ' to add points';
          const readout = liveDrawReadout();
          if (readout) {
            toolHintKeyed = toolHint + ' — ' + HINT_READOUT_PLACEHOLDER;
            toolHint += ' — ' + readout;
          }
        }
        else if (state.tool === TOOL.HIGHLIGHT) toolHint = state.highlightStart ? press + ' second corner' : press + ' first corner';
        else if (state.tool === TOOL.MULTIPLY_ZONE) toolHint = state.multiplyZoneStart ? press + ' second corner' : press + ' first corner';
        else if (state.tool === TOOL.SCALE_ZONE) toolHint = state.scaleZoneStart ? press + ' second corner' : press + ' first corner';
        else if (state.tool === TOOL.ROOM) toolHint = state.roomBoxStart ? press + ' second corner' : press + ' first corner';
        else if (state.tool === TOOL.DELETE_ZONE) toolHint = state.deleteZoneStart ? press + ' second corner' : press + ' first corner';
        else if (state.tool === TOOL.NOTE) toolHint = press + ' to add note';
        else if (state.tool === TOOL.COUNTER) toolHint = press + ' to place marker';
        else if (state.tool === TOOL.EDIT_POLY) toolHint = 'Edit polyline';
        // The hint only rides when the bar stays on ONE line (field feedback
        // 2026-08-14): on narrow layouts the status bar flex-wraps, and a long
        // project name + "Tap start point" shoved the right-side actions onto
        // a second row. Measure with the hint in and drop it if the bar
        // wrapped. updateStatus runs per mousemove, so the layout read is
        // cached by (composed text, bar width) — coords/totals live in their
        // own spans and never invalidate the key. A live length readout keys
        // and measures via its worst-case placeholder (toolHintKeyed), never
        // the growing number — the verdict stays stable per (static text,
        // width) and the live string is swapped in after the cached verdict.
        if (toolHint && modeEl) {
          const fullMode = mode + ' | ' + toolHint;
          const keyedMode = mode + ' | ' + (toolHintKeyed || toolHint);
          const barEl = modeEl.parentElement;
          const actionsEl = document.getElementById('statusBarActions');
          if (barEl && actionsEl) {
            const key = keyedMode + '@' + barEl.clientWidth;
            if (key !== footerHintKey) {
              footerHintKey = key;
              modeEl.textContent = keyedMode;
              footerHintFits = actionsEl.offsetTop <= modeEl.offsetTop;
            }
            if (footerHintFits) mode = fullMode;
          } else {
            mode = fullMode;
          }
        }
      }
    }
    if (state.hoverLegendResize) mode += ' | Drag to resize';
    if (modeEl) { modeEl.textContent = mode; modeEl.title = mode || ''; }
    if (coordsEl) coordsEl.textContent = state.mousePos ? `(${Math.round(state.mousePos.x)}, ${Math.round(state.mousePos.y)})` : '—';
    const totalsEl = document.getElementById('statusTotals');
    if (totalsEl) {
      if (!state.pages || !state.pages.length) {
        totalsEl.style.display = 'none';
      } else {
        const t = getFooterTotalsCached();
        const countStr = (t.count || 0).toLocaleString();
        // Split buckets: feet (scaled lines) and raw px (unscaled) are never summed.
        const lenStr = App.formatFeetPx(t.lengthFt || 0, t.lengthPx || 0);
        // B10 (J18): the bare "[14 | 225.00 ft]" pair was cryptic until hover
        // — the words ride inline now, and the pair is the audit entry point
        // (click scrolls to and flashes the Summary; binding below). The
        // words are .status-totals-words spans, CSS-hidden on bars narrower
        // than 1280px — the compact pair keeps the one-line-bar invariant
        // (field feedback 2026-08-14) that the droppable tool hint protects,
        // since totals, unlike the hint, never drop.
        totalsEl.textContent = '';
        const seg = (txt, words) => {
          const sp = document.createElement('span');
          sp.textContent = txt;
          if (words) sp.className = 'status-totals-words';
          totalsEl.appendChild(sp);
        };
        seg('[' + countStr); seg(' counts', true);
        seg(' | ' + lenStr); seg(' of lines', true);
        seg(']');
        totalsEl.title = countStr + ' counts | ' + lenStr + ' of lines'
          + ((t.lengthPx || 0) > 0 ? ' — px lengths are on sheets with no scale' : '')
          + ' — click to see the Summary';
        totalsEl.style.display = '';
      }
    }
    // Measure-tool result chip (Tier-2 #15): shows state.lastMeasure while it
    // belongs to the current page — page flips hide it, flipping back shows it
    // again (a fact about that sheet), a new measure overwrites it.
    const measureEl = document.getElementById('statusMeasure');
    if (measureEl) {
      const lm = state.lastMeasure;
      if (lm && lm.pageIdx === state.currentPage) {
        measureEl.textContent = lm.text;
        measureEl.title = lm.text;
        measureEl.style.display = '';
      } else {
        measureEl.style.display = 'none';
      }
    }
  }

  function getCloudSaveSummary() {
    const state = App.state;
    const cloudMode = App.SUPABASE_ENABLED && state.supabaseSession?.user;
    if (!cloudMode) {
      return {
        canvas: { label: 'Canvas', state: 'grey', status: 'Not signed in to cloud', clock: '', ago: '' },
        pdf:    { label: 'PDF',    state: 'grey', status: '',                       clock: '', ago: '' }
      };
    }
    const savedParts = App.formatSaveTimeParts(state.lastSavedAt);
    let canvas;
    if (App.isSaveInProgress()) {
      canvas = { label: 'Canvas', state: 'yellow', status: 'Uploading...', clock: '', ago: '' };
    } else if (state.lastSavedAt && !App.getAutoSaveDirty()) {
      canvas = { label: 'Canvas', state: 'green', status: 'Synced with cloud', clock: savedParts.clock, ago: savedParts.ago };
    } else if (!state.pages.length) {
      canvas = { label: 'Canvas', state: 'grey', status: 'No project', clock: '', ago: '' };
    } else if (state.isViewer) {
      canvas = { label: 'Canvas', state: 'yellow', status: 'Viewing (read-only)', clock: savedParts.clock, ago: savedParts.ago };
    } else {
      const status = App.wasLastCloudSaveAttemptFailed() ? 'Last sync failed' : 'Not saved to cloud';
      canvas = { label: 'Canvas', state: 'red', status, clock: savedParts.clock, ago: savedParts.ago };
    }
    let pdf;
    const pdfSynced = App.getLastSaveIncludedPdf() || !!state.pdfStoragePath;
    if (App.isSavePdfInProgress()) {
      pdf = { label: 'PDF', state: 'yellow', status: 'Uploading...', clock: '', ago: '' };
    } else if (pdfSynced) {
      pdf = { label: 'PDF', state: 'green', status: 'Synced with cloud', clock: savedParts.clock, ago: savedParts.ago };
    } else if (!state.pdfBuffer || !state.pages.length) {
      pdf = { label: 'PDF', state: 'grey', status: 'No PDF in cloud', clock: '', ago: '' };
    } else {
      pdf = { label: 'PDF', state: 'red', status: 'Not saved to cloud', clock: '', ago: '' };
    }
    return { canvas, pdf };
  }

  function updateSaveStatusIndicator() {
    const state = App.state;
    const inModal = document.getElementById('saveStatusBtn');
    const header  = document.getElementById('saveStatusBtnHeader');
    const section = document.getElementById('settingsCheckoutSection');
    const sectionVisible = !!(section && section.style.display !== 'none');
    const user = state.supabaseSession?.user;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const checkoutExpired = App.isCheckoutExpiredAttention();
    const syncAttention = !!(App.wasLastCloudSaveAttemptFailed() && App.getAutoSaveDirty());
    const attention = syncAttention || checkoutExpired;

    if (inModal) {
      const showModal = !!(sectionVisible && App.SUPABASE_ENABLED && state.currentProjectId && user);
      inModal.style.display = showModal ? '' : 'none';
      inModal.classList.toggle('save-status-bell-attention', showModal && attention);
      inModal.classList.toggle('save-status-bell-offline', showModal && offline);
    }

    if (header) {
      const showHeader = !!(App.SUPABASE_ENABLED && user);
      header.style.display = showHeader ? '' : 'none';
      header.classList.toggle('save-status-bell-attention', showHeader && attention);
      header.classList.toggle('save-status-bell-offline', showHeader && offline);
    }

    const title = offline
      ? 'Save status — offline (changes saved locally)'
      : attention
        ? (checkoutExpired ? 'Save status — checkout expired' : 'Save status — sync needs attention')
        : 'Save status';
    const aria = offline
      ? 'Save status, offline, changes saved locally'
      : attention
        ? (checkoutExpired ? 'Save status, checkout expired' : 'Save status, sync needs attention')
        : 'Save status';
    if (inModal) { inModal.title = title; inModal.setAttribute('aria-label', aria); }
    if (header)  { header.title  = title; header.setAttribute('aria-label',  aria); }
  }

  // B10 (J18): the footer totals looked like the audit entry but were two
  // dead clicks — clicking them now jumps to the surface that itemizes them.
  // Uncollapses the desktop sidebar if needed, scrolls the Summary section
  // into view, and flashes it (the .summary-flash keyframe in styles.css;
  // remove + reflow so a second click restarts the animation).
  const statusTotalsEl = document.getElementById('statusTotals');
  if (statusTotalsEl) statusTotalsEl.onclick = () => {
    const section = document.getElementById('summarySection');
    if (!section) return;
    document.body.classList.remove('sidebar-collapsed');
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    section.classList.remove('summary-flash');
    void section.offsetWidth;
    section.classList.add('summary-flash');
  };

  App.invalidateFooterTotals = invalidateFooterTotals;
  App.getFooterTotalsCached = getFooterTotalsCached;
  App.updateStatus = updateStatus;
  App.getCloudSaveSummary = getCloudSaveSummary;
  App.updateSaveStatusIndicator = updateSaveStatusIndicator;
})();

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
  function invalidateFooterTotals() { footerTotalsDirty = true; }
  function computeFooterTotals() {
    const state = App.state;
    if (!state.pages || !state.pages.length) return { count: 0, lengthReal: 0, scale: null };
    let count = 0, lengthReal = 0;
    const markedIdx = [];
    state.pages.forEach((page, i) => {
      const ann = (typeof App.getMergedAnnotationsForPage === 'function')
        ? App.getMergedAnnotationsForPage(page)
        : (page.annotations || App.makeAnnotations());
      let pageHas = false;
      (state.counters || []).forEach(c => {
        const ms = ann.counterMarkers?.[c.id] || [];
        ms.forEach(m => {
          count += (typeof App.getMultiplyZoneForPoint === 'function') ? App.getMultiplyZoneForPoint(ann, m) : 1;
          pageHas = true;
        });
      });
      (ann.quickLines || []).forEach(q => {
        lengthReal += (typeof App.getLineLengthFeetForTotals === 'function') ? App.getLineLengthFeetForTotals(q, i, false, ann) : 0;
        pageHas = true;
      });
      (ann.polylines || []).forEach(poly => {
        lengthReal += (typeof App.getLineLengthFeetForTotals === 'function') ? App.getLineLengthFeetForTotals(poly, i, true, ann) : 0;
        pageHas = true;
      });
      if (pageHas) markedIdx.push(i);
    });
    const scaleIdx = markedIdx.length ? markedIdx : state.pages.map((_, i) => i);
    return { count, lengthReal, scale: App.pickScaleForLineType(scaleIdx) };
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
        mode = state.checkedOutEmail ? ('Viewing — ' + state.checkedOutEmail + ' is editing') : 'Viewing — Available (check out to edit)';
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
        const TOOL = App.TOOL, SCALE_MODES = App.SCALE_MODES;
        if (state.tool === TOOL.MEASURE) toolHint = state.aiming ? 'Hold + drag to aim; release to place' : (state.scaleMode === SCALE_MODES.POINT_A ? 'Tap first point (or hold to aim)' : 'Tap second point (or hold to aim)');
        else if (state.tool === TOOL.SCALE) toolHint = state.scaleMode === SCALE_MODES.POINT_A ? 'Click first point' : 'Click second point';
        else if (state.tool === TOOL.LINE) toolHint = state.quickLineStart ? 'Tap end point' : 'Tap start point';
        else if (state.tool === TOOL.POLYLINE) toolHint = 'Click to add points';
        else if (state.tool === TOOL.HIGHLIGHT) toolHint = state.highlightStart ? 'Click second corner' : 'Click first corner';
        else if (state.tool === TOOL.MULTIPLY_ZONE) toolHint = state.multiplyZoneStart ? 'Click second corner' : 'Click first corner';
        else if (state.tool === TOOL.SCALE_ZONE) toolHint = state.scaleZoneStart ? 'Click second corner' : 'Click first corner';
        else if (state.tool === TOOL.ROOM) toolHint = state.roomBoxStart ? 'Click second corner' : 'Click first corner';
        else if (state.tool === TOOL.DELETE_ZONE) toolHint = state.deleteZoneStart ? 'Click second corner' : 'Click first corner';
        else if (state.tool === TOOL.NOTE) toolHint = 'Click to add note';
        else if (state.tool === TOOL.COUNTER) toolHint = 'Click to place marker';
        else if (state.tool === TOOL.EDIT_POLY) toolHint = 'Edit polyline';
        if (toolHint) mode += ' | ' + toolHint;
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
        // t.lengthReal is already in feet (accumulated via getLineLengthFeetForTotals).
        const lenStr = App.formatFeet(t.lengthReal || 0, t.scale);
        totalsEl.textContent = '[' + countStr + ' | ' + lenStr + ']';
        totalsEl.title = countStr + ' counters | ' + lenStr + ' of lines';
        totalsEl.style.display = '';
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

  App.invalidateFooterTotals = invalidateFooterTotals;
  App.getFooterTotalsCached = getFooterTotalsCached;
  App.updateStatus = updateStatus;
  App.getCloudSaveSummary = getCloudSaveSummary;
  App.updateSaveStatusIndicator = updateSaveStatusIndicator;
})();

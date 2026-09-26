(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/status-bar.js - the status-bar / footer-totals cluster, extracted
   * from app.js's Math & Format Helpers region (where it was always misfiled —
   * it is pure DOM chrome over state + save-engine getters): the footer totals
   * cache (computeFooterTotals / getFooterTotalsCached / invalidateFooterTotals),
   * the status-bar renderer (updateStatus — sync dot/square, mode line, tool
   * hints, [count | length] totals; four passes since MAP-HINTS, with the
   * tool-hint ladder itself pure in status-hint-model.js and shown signed in
   * as well as signed out), the Save Status summary-block data
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
  let footerBareCompact = false;   // the hint dropped AND the full stamp still wrapped: show the compact stamp alone
  // D19 (J19 Friction #5): which save-stamp variant the cached verdict was
  // reached with — the bar compacts the stamp before it sacrifices the hint.
  let footerHintCompactStamp = false;
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

  // updateStatus renders the bar in four passes (MAP-HINTS, 2026-09-26; the map's R05):
  // renderSyncIndicators (dot, square, labels, and the mode text the sync state owns),
  // composeMode (that text plus the tool hint, negotiated onto one line), renderTotals
  // and renderMeasureChip. The tool hint itself is status-hint-model.js `toolHintFor`.
  // Until this split the hint was composed only in the signed-out branch, so a signed-in
  // estimator, which is every production estimator, never saw "Click start point", the
  // live length readout, "S = size" or the duct pounds (the map's D01).

  // The sync dot / square and their labels, and the mode text that belongs to the sync
  // state: signed in, '' (the dot and labels say it) or the viewer line; signed out, the
  // project name and the local-save stamp (B11), with its compact twin (D19).
  // Returns { base, compact, hintable, fitSalt }: `hintable` false keeps the tool hint off
  // (a save-progress message, a signed-in viewer), `fitSalt` is the text beside the
  // mode that changes the bar's fit without changing the mode (the signed-in labels).
  function renderSyncIndicators(state, cloudMode) {
    const lastLocalBackupAt = App.getLastLocalBackupAt();   // engine-owned (Stage 3)
    const dotEl = document.getElementById('statusBarDot');
    const squareEl = document.getElementById('statusBarSquare');
    const canvasLabelEl = document.getElementById('statusCanvasLabel');
    const pdfLabelEl = document.getElementById('statusPdfLabel');
    const pdfGroupEl = document.getElementById('statusPdfGroup');
    if (cloudMode) {
      let base = '';
      if (pdfGroupEl) { pdfGroupEl.style.display = ''; }
      if (App.isSaveInProgress()) {
        if (dotEl) { dotEl.className = 'dot dot-yellow'; dotEl.title = 'Canvas sync: Uploading...'; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas Uploading...';
      } else if (state.lastSavedAt && !App.getAutoSaveDirty()) {
        let canvasTitle = 'Canvas sync: Synced with Cloud';
        if (state.lastSavedAt) canvasTitle += '\nCloud: ' + App.formatSaveTime(state.lastSavedAt);
        if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
        if (dotEl) { dotEl.className = 'dot dot-green'; dotEl.title = canvasTitle; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas';
      } else if (!state.pages.length) {
        if (dotEl) { dotEl.className = 'dot dot-grey'; dotEl.title = 'Canvas sync: Upload PDF to start a project'; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas';
        if (pdfLabelEl) pdfLabelEl.textContent = 'PDF - Upload PDF to start a project';
      } else if (state.isViewer) {
        let canvasTitle = 'Canvas sync: Viewing (read-only)';
        if (state.lastSavedAt) canvasTitle += '\nCloud: ' + App.formatSaveTime(state.lastSavedAt);
        if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
        if (dotEl) { dotEl.className = 'dot dot-yellow'; dotEl.title = canvasTitle; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas Viewing (read-only)';
        base = state.checkedOutEmail ? ('Viewing, ' + (App.twinEmailText ? App.twinEmailText(state.checkedOutEmail) : state.checkedOutEmail) + ' is editing') : 'Viewing, Available (check out to edit)';
      } else {
        let canvasTitle = 'Canvas sync: Project not saved to cloud';
        if (state.lastSavedAt) canvasTitle += '\nCloud: ' + App.formatSaveTime(state.lastSavedAt);
        if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
        if (dotEl) { dotEl.className = 'dot dot-red'; dotEl.title = canvasTitle; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas';
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
      // A signed-in viewer's mode text stays exactly as it was: no hint rides it (a
      // viewer arms only Measure and Set Scale, and the line is what tells them who is
      // editing). The labels go in the fit key: "Canvas Uploading..." / "PDF Uploading..."
      // are wider than "Canvas" / "PDF Synced with Cloud" at the same width and mode text.
      const fitSalt = (canvasLabelEl ? canvasLabelEl.textContent : '') + '/' + (pdfLabelEl ? pdfLabelEl.textContent : '');
      return { base, compact: base, hintable: !state.isViewer, fitSalt };
    }
    let canvasTitle = 'Canvas sync: Local only';
    if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + App.formatSaveTime(lastLocalBackupAt);
    if (dotEl) { dotEl.className = 'dot dot-green'; dotEl.title = canvasTitle; }
    if (canvasLabelEl) canvasLabelEl.textContent = '';
    if (pdfGroupEl) pdfGroupEl.style.display = 'none';
    if (App.isSaveInProgress() && App.getSaveProgressMessage()) {
      const msg = App.getSaveProgressMessage();
      return { base: msg, compact: msg, hintable: false, fitSalt: '' };
    }
    const projectSegment = (state.currentProjectName || (state.pages.length ? 'Untitled' : 'none'))
      + (state.currentProjectExternalRef ? ' · ' + state.currentProjectExternalRef : '');
    let lastSavedSegment = 'not saved yet';
    // Same text unless the local-save branch below offers a shorter twin.
    let lastSavedSegmentCompact = null;
    if (lastLocalBackupAt) {
      // B11 (J12/J15): signed-out, the segment shows the local-save stamp
      // the engine already tracks ("Saved on this device · 4:42 PM")
      // instead of the permanent dash — the IDB backup lands ~1s after
      // every change, so this replaces a false "never saved" signal.
      // Narrow bars (<1280px, B10's footer-words threshold) compact the
      // words to "Saved · 4:42 PM"; the mode is one text node so the swap
      // is done here in JS — window.innerWidth, not a clientWidth read,
      // because updateStatus runs per mousemove and must not force layout.
      const timeStr = new Date(lastLocalBackupAt)
        .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const words = window.innerWidth >= 1280 ? 'Saved on this device' : 'Saved';
      lastSavedSegment = words + ' · ' + timeStr;
      // D19 (J19 Friction #5): the compact twin is kept ready even on a
      // wide bar. At ~1380 px the long stamp fits but pushes the tool hint
      // over the one-line budget, and B11's fixed 1280 px threshold had no
      // way to notice — the hint (and the duct readout with it) just
      // vanished for the rest of the session. The fit negotiation in
      // composeMode spends this before it spends the hint.
      lastSavedSegmentCompact = 'Saved · ' + timeStr;
    } else if (state.lastSavedAt) {
      const d = new Date(state.lastSavedAt);
      const agoSec = (Date.now() - d.getTime()) / 1000;
      const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const agoStr = App.formatAgo(agoSec);
      lastSavedSegment = timeStr + ' | ' + agoStr;
    } else {
      lastSavedSegmentCompact = '';   // never saved: the compact twin is the name alone
    }
    // Nothing loaded: one plain phrase instead of "none · not saved yet".
    const noProject = !state.pages.length && !state.currentProjectName;
    const base = noProject ? 'No project open' : projectSegment + ' · ' + lastSavedSegment;
    const compact = (noProject || lastSavedSegmentCompact === null) ? base
      : (lastSavedSegmentCompact ? projectSegment + ' · ' + lastSavedSegmentCompact : projectSegment);
    return { base, compact, hintable: true, fitSalt: '' };
  }

  // The mode line: the sync state's text plus the armed tool's hint, kept to ONE line.
  function composeMode(state, modeEl, sync) {
    const Model = window.StatusHintModel;
    let mode = sync.base;
    const modeCompact = sync.compact;
    if (!sync.hintable || !Model) return mode;
    // B9 (J15): touch talks "Tap", mouse talks "Click" — same hints, the
    // trade's word for the device in hand (App.isCoarsePointer, live).
    const press = App.isCoarsePointer && App.isCoarsePointer() ? 'Tap' : 'Click';
    // The live readouts go in as readers; the model calls only the one its tool shows.
    const hint = Model.toolHintFor(state, press, {
      draw: liveDrawReadout,
      duct: () => (App.ductLiveReadout ? App.ductLiveReadout() : ''),
      tag: () => (App.tagHintText ? App.tagHintText() : ''),
      chain: () => (App.chainDropHint ? App.chainDropHint() : ''),
    }, { TOOL: App.TOOL, SCALE_MODES: App.SCALE_MODES });
    const toolHint = hint.text;
    const join = Model.joinStatusMode;
    if (!toolHint) return mode;
    if (!modeEl) return join(mode, toolHint);
    // The hint only rides when the bar stays on ONE line (field feedback
    // 2026-08-14): on narrow layouts the status bar flex-wraps, and a long
    // project name + "Tap start point" shoved the right-side actions onto
    // a second row. Measure with the hint in and drop it if the bar
    // wrapped. updateStatus runs per mousemove, so the layout read is
    // cached by (composed text, bar width, signed-in labels); coords/totals
    // live in their own spans and never invalidate the key. A live readout keys
    // and measures via its worst-case placeholder (hint.keyed), never
    // the growing number — the verdict stays stable per (static text,
    // width) and the live string is swapped in after the cached verdict.
    // Phone widths (768px and under) never wrap: the bar is nowrap there and
    // the mode ellipsizes on a zero flex basis, so a hint can only truncate.
    const barEl = modeEl.parentElement;
    const actionsEl = document.getElementById('statusBarActions');
    if (!barEl || !actionsEl) return join(mode, toolHint);
    // D19 (J19 Friction #5): three candidates, in the order the bar
    // should spend its width — full stamp + hint, COMPACT stamp + hint,
    // then full stamp alone. B11's own narrow-bar rule says the stamp's
    // words are the droppable part; the hint carries the only on-screen
    // mention of "S = size" and the live duct readout, so it goes last.
    // Signed in, the stamp is '' and there is one candidate: the hint, or nothing.
    const keyed = (m) => join(m, hint.keyed);
    const key = keyed(mode) + '@' + barEl.clientWidth + '#' + sync.fitSalt;
    if (key !== footerHintKey) {
      footerHintKey = key;
      // "Fits" means the candidate costs the bar no row: the bar is no taller than with
      // the narrowest bare text (the compact stamp, or '' signed in). Until MAP-HINTS
      // this asked whether the actions still shared the mode's row, which only held while
      // the bare bar was one line; a signed-in bar at 769-900px, or on a phone, is already
      // two rows from the sync labels alone, and the hint then never showed there even
      // where it took no room (on a phone the mode has a zero flex basis and ellipsizes).
      modeEl.textContent = modeCompact;
      const baseHeight = barEl.offsetHeight;
      const noNewRow = () => barEl.offsetHeight <= baseHeight;
      modeEl.textContent = keyed(mode);
      let fits = noNewRow();
      let compact = false;
      if (!fits && modeCompact !== mode) {
        modeEl.textContent = keyed(modeCompact);
        if (noNewRow()) { fits = true; compact = true; }
      }
      // Fourth rung: no hint at all — does the full stamp fit? If not, the compact stamp alone.
      let bareCompact = false;
      if (!fits && modeCompact !== mode) {
        modeEl.textContent = mode;
        bareCompact = !noNewRow();
      }
      footerHintFits = fits;
      footerHintCompactStamp = compact;
      footerBareCompact = bareCompact;
    }
    if (footerHintFits) mode = join(footerHintCompactStamp ? modeCompact : mode, toolHint);
    else if (footerBareCompact) mode = modeCompact;
    return mode;
  }

  function renderTotals(state) {
    const totalsEl = document.getElementById('statusTotals');
    if (!totalsEl) return;
    if (!state.pages || !state.pages.length) {
      totalsEl.style.display = 'none';
      return;
    }
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
    // X13 (D19 fold-in): "1 counts" read as a bug in the one place the
    // footer is supposed to be the audit entry point. Same grammar in the
    // chip and its tooltip, which are the same sentence twice.
    const countWord = (t.count || 0) === 1 ? ' count' : ' counts';
    seg('[' + countStr); seg(countWord, true);
    seg(' | ' + lenStr); seg(' of lines', true);
    seg(']');
    totalsEl.title = countStr + countWord + ' | ' + lenStr + ' of lines'
      + ((t.lengthPx || 0) > 0 ? '; px lengths are on sheets with no scale' : '')
      + '. Click to see the Summary';
    totalsEl.style.display = '';
  }

  // Measure-tool result chip (Tier-2 #15): shows state.lastMeasure while it
  // belongs to the current page — page flips hide it, flipping back shows it
  // again (a fact about that sheet), a new measure overwrites it.
  function renderMeasureChip(state) {
    const measureEl = document.getElementById('statusMeasure');
    if (!measureEl) return;
    const lm = state.lastMeasure;
    if (lm && lm.pageIdx === state.currentPage) {
      measureEl.textContent = lm.text;
      measureEl.title = lm.text;
      measureEl.style.display = '';
    } else {
      measureEl.style.display = 'none';
    }
  }

  function updateStatus() {
    const state = App.state;
    const modeEl = document.getElementById('statusMode');
    const coordsEl = document.getElementById('statusCoords');
    const cloudMode = App.SUPABASE_ENABLED && state.supabaseSession?.user;
    const sync = renderSyncIndicators(state, cloudMode);
    let mode = composeMode(state, modeEl, sync);
    if (state.hoverLegendResize) mode = window.StatusHintModel ? window.StatusHintModel.joinStatusMode(mode, 'Drag to resize') : mode + ' | Drag to resize';
    if (modeEl) { modeEl.textContent = mode; modeEl.title = mode || ''; }
    if (coordsEl) coordsEl.textContent = state.mousePos ? `(${Math.round(state.mousePos.x)}, ${Math.round(state.mousePos.y)})` : 'none';
    renderTotals(state);
    renderMeasureChip(state);
  }

  function getCloudSaveSummary() {
    const state = App.state;
    const cloudMode = App.SUPABASE_ENABLED && state.supabaseSession?.user;
    if (!cloudMode) {
      // B11 (J12): truthful signed-out copy — when the IDB backup has landed
      // the work IS saved (on this device), so the panel says so instead of
      // the false "Not signed in to cloud" + empty rows. The sign-in nudge
      // line (#saveStatusSignedOutHint) is toggled by save-status.js.
      const localAt = App.getLastLocalBackupAt();
      if (localAt) {
        const p = App.formatSaveTimeParts(localAt);
        const pdfLocal = !!(state.pages && state.pages.length);
        return {
          canvas: { label: 'Canvas', state: 'green', status: 'Saved on this device', clock: p.clock, ago: p.ago },
          pdf: pdfLocal
            ? { label: 'PDF', state: 'green', status: 'Saved on this device', clock: p.clock, ago: p.ago }
            : { label: 'PDF', state: 'grey',  status: 'No PDF in project',    clock: '', ago: '' }
        };
      }
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
      ? 'Save status: offline (changes saved locally)'
      : attention
        ? (checkoutExpired ? 'Save status: checkout expired' : 'Save status: sync needs attention')
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

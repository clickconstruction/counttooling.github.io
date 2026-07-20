  (function() {
  // SECTION: Constants
  if (typeof pdfjsLib !== 'undefined') pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min-3.11.174.js';

  const SUPABASE_URL = (typeof window !== 'undefined' && window.SUPABASE_URL) || '';
  const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || '';
  const SUPABASE_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.includes('supabase'));
  let supabase = null;
  if (SUPABASE_ENABLED && typeof window.supabase !== 'undefined') {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // Pure constants (TOOL, SCALE_MODES, PLUMBING_DEFAULTS, LINE_DEFAULTS, COLORS, SCALE_PRESETS) live in constants.js
  // (classic <script src> loaded before this IIFE); referenced here by bare name via the shared global lexical scope.
  const uid = () => Math.random().toString(36).slice(2, 10);
  function getLineModifiers() {
    try {
      const raw = localStorage.getItem('lineModifiers');
      const saved = raw ? JSON.parse(raw) : {};
      return {
        sizes: (saved.sizes && saved.sizes.length) ? saved.sizes : LINE_DEFAULTS.sizes,
        materials: (saved.materials && saved.materials.length) ? saved.materials : LINE_DEFAULTS.materials,
        defaultColor: saved.defaultColor || COLORS[2]
      };
    } catch (_) {
      return { sizes: [...LINE_DEFAULTS.sizes], materials: [...LINE_DEFAULTS.materials], defaultColor: COLORS[2] };
    }
  }
  function saveLineModifiers(mods) {
    try { localStorage.setItem('lineModifiers', JSON.stringify(mods)); } catch (_) {}
  }
  function getPlumbingModifiers() {
    try {
      const raw = localStorage.getItem('plumbingModifiers');
      const saved = raw ? JSON.parse(raw) : {};
      return {
        sizes: (saved.sizes && saved.sizes.length) ? saved.sizes : PLUMBING_DEFAULTS.sizes,
        types: (saved.types && saved.types.length) ? saved.types : PLUMBING_DEFAULTS.types,
        materials: (saved.materials && saved.materials.length) ? saved.materials : PLUMBING_DEFAULTS.materials,
        iconByType: (saved.iconByType && typeof saved.iconByType === 'object') ? saved.iconByType : {},
        defaultColor: saved.defaultColor || COLORS[2]
      };
    } catch (_) {
      return { sizes: [...PLUMBING_DEFAULTS.sizes], types: [...PLUMBING_DEFAULTS.types], materials: [...PLUMBING_DEFAULTS.materials], iconByType: {}, defaultColor: COLORS[2] };
    }
  }
  function savePlumbingModifiers(mods) {
    try { localStorage.setItem('plumbingModifiers', JSON.stringify(mods)); } catch (_) {}
  }
  // COLORS and SCALE_PRESETS live in constants.js (see note above).

  // SECTION: Icon data (icon *_PATH consts, VB_384_512_PATHS, CUSTOM_ICONS) lives in icons.js,
  // a classic <script src> loaded before this IIFE; referenced here via the shared global lexical scope.
  // CUSTOM_ICON_META + the pure icon-render rules live in icon-render.js (loaded
  // before app.js) and resolve here by bare name. The helpers below stay because
  // they read the runtime user-icon cache; they inject getEffectiveCustomIcons()
  // into the pure *FromList/*Rule primitives.
  let customIconsCache = [];
  function getUserCustomIcons() {
    return customIconsCache;
  }
  function saveUserCustomIcons(arr) {
    customIconsCache = Array.isArray(arr) ? arr : [];
    customIconsPutToIndexedDB(customIconsCache);
  }
  function getEffectiveCustomIcons() {
    return [...CUSTOM_ICONS, ...getUserCustomIcons()];
  }
  function getCustomIconViewBox(path) {
    return iconViewBoxFromList(path, getEffectiveCustomIcons());
  }
  function getCustomIconMeta(path) {
    return iconMetaFromList(path, getEffectiveCustomIcons());
  }
  function iconRenderVb(path) {
    return iconRenderVbRule(getCustomIconMeta(path), path);
  }
  function iconRenderCenter(path) {
    return iconRenderCenterRule(getCustomIconMeta(path), path);
  }
  function iconViewBoxString(path) {
    return iconViewBoxStringRule(getCustomIconViewBox(path), path);
  }


  const COUNTER_BTN_DEFAULT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="28" height="28"><path fill="currentColor" d="M320 320C178.6 320 64 277 64 224C64 171 178.6 128 320 128C461.4 128 576 171 576 224C576 277 461.4 320 320 320zM64 416L64 306.7C80.9 319 101 328.9 122.1 336.8C175.1 356.7 245.1 368 320 368C394.9 368 464.9 356.7 517.9 336.8C539.1 328.9 559.1 319 576 306.7L576 416C576 469 461.4 512 320 512C178.6 512 64 469 64 416z"/></svg>';
  const USER_ACTIVITY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M320 171.9L305 151.1C280 116.5 239.9 96 197.1 96C123.6 96 64 155.6 64 229.1L64 231.7C64 255.3 70.2 279.7 80.6 304L186.6 304C189.8 304 192.7 302.1 194 299.1L225.8 222.8C229.5 214 238.1 208.2 247.6 208C257.1 207.8 265.9 213.4 269.8 222.1L321.1 336L362.5 253.2C366.6 245.1 374.9 239.9 384 239.9C393.1 239.9 401.4 245 405.5 253.2L428.7 299.5C430.1 302.2 432.8 303.9 435.9 303.9L559.5 303.9C570 279.6 576.1 255.2 576.1 231.6L576.1 229C576 155.6 516.4 96 442.9 96C400.2 96 360 116.5 335 151.1L320 171.8zM533.6 352L435.8 352C414.6 352 395.2 340 385.7 321L384 317.6L341.5 402.7C337.4 411 328.8 416.2 319.5 416C310.2 415.8 301.9 410.3 298.1 401.9L248.8 292.4L238.3 317.6C229.6 338.5 209.2 352.1 186.6 352.1L106.4 352.1C153.6 425.9 229.4 493.8 276.8 530C289.2 539.4 304.4 544.1 319.9 544.1C335.4 544.1 350.7 539.5 363 530C410.6 493.7 486.4 425.8 533.6 352z"/></svg>';
  const DROP_ICON_STYLES = [
    { id: 'circle', name: 'Circle', svg: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/></svg>' },
    { id: 'x', name: 'X', svg: '<svg viewBox="0 0 24 24" width="24" height="24"><path stroke="currentColor" stroke-width="2" fill="none" d="M6 6 L18 18 M18 6 L6 18"/></svg>' },
    { id: 'plus', name: 'Plus', svg: '<svg viewBox="0 0 24 24" width="24" height="24"><path stroke="currentColor" stroke-width="2" fill="none" d="M12 4 L12 20 M4 12 L20 12"/></svg>' },
    { id: 'diamond', name: 'Diamond', svg: '<svg viewBox="0 0 24 24" width="24" height="24"><path stroke="currentColor" stroke-width="2" fill="none" d="M12 4 L20 12 L12 20 L4 12 Z"/></svg>' },
    { id: 'triangle', name: 'Triangle', svg: '<svg viewBox="0 0 24 24" width="24" height="24"><path stroke="currentColor" stroke-width="2" fill="none" d="M12 4 L20 20 L4 20 Z"/></svg>' },
  ];

  // SECTION: ICONS array lives in icons.js (see icon-data note above).

  // The annotation model (canvas/annotation shape accessors, merge/migrate,
  // backup<->proj format conversion, bake-frame verify, backup/data appliers,
  // orphan reconcile) lives in annotation-model.js (createAnnotationModel(ctx),
  // loaded before this file). Same-named wrappers keep the ~150 call sites,
  // the App registry, and the feature-file contracts frozen.
  const annotationModel = createAnnotationModel({
    getState: () => state,
    uid: () => uid(),
    showToast: (msg, ms) => showToast(msg, ms),
    ensureGroupColors: (groups) => ensureGroupColors(groups),
    saveUserCustomIcons: (arr) => saveUserCustomIcons(arr),
  });
  // mergeAnnotations / migratePageToCanvases / verifyPageBakeFrame have no
  // app-side callers (their callers moved into the model) — annotationModel.*.
  function makeAnnotations() { return annotationModel.makeAnnotations(); }
  function getPageCanvases(page) { return annotationModel.getPageCanvases(page); }
  function getActiveCanvas(page, pageIdxHint) { return annotationModel.getActiveCanvas(page, pageIdxHint); }
  function getActiveAnnotations(page, pageIdxHint) { return annotationModel.getActiveAnnotations(page, pageIdxHint); }
  function getMergedAnnotationsForPage(page) { return annotationModel.getMergedAnnotationsForPage(page); }
  function ensureActiveCanvas(page) { return annotationModel.ensureActiveCanvas(page); }
  function pageHasAnyAnnotations(p) { return annotationModel.pageHasAnyAnnotations(p); }
  function projectHasAnyCanvasMarkup() { return annotationModel.projectHasAnyCanvasMarkup(); }
  function backupDataToProjFormat(data) { return annotationModel.backupDataToProjFormat(data); }
  function computePageBakeFrame(p) { return annotationModel.computePageBakeFrame(p); }
  function applyTakeoffBackupToState(backup) { return annotationModel.applyTakeoffBackupToState(backup); }
  function applyPageAnnotationsFromData(page, p, scaleFallback) { return annotationModel.applyPageAnnotationsFromData(page, p, scaleFallback); }
  function reconcileOrphanedCountersAndLineTypes() { return annotationModel.reconcileOrphanedCountersAndLineTypes(); }

  function getIconName(path) {
    if (state.iconNames && state.iconNames[path]) return state.iconNames[path];
    const custom = getEffectiveCustomIcons().find(i => i.value === path);
    if (custom) return custom.name;
    const ic = ICONS.find(i => i.value === path);
    return ic ? ic.name : 'Icon';
  }
  function getOrderedIcons() {
    const order = state.iconOrder;
    if (!order || !Array.isArray(order) || order.length === 0) return ICONS;
    const byPath = new Map(ICONS.map(i => [i.value, i]));
    const ordered = order.map(p => byPath.get(p)).filter(Boolean);
    const rest = ICONS.filter(i => !order.includes(i.value));
    return [...ordered, ...rest];
  }

  // SECTION: State
  const state = {
    pages: [], currentPage: 0, zoom: 1.0, tool: TOOL.NONE, scaleMode: SCALE_MODES.NONE,
    scalePointA: null, scalePointB: null, gridOriginPickMode: false, activeCounterType: null, activePolylineId: null, drawingPolyline: null,
    quickLineStart: null, highlightStart: null, multiplyZoneStart: null, scaleZoneStart: null, deleteZoneStart: null, roomBoxStart: null, pendingRoomBox: null, pendingRoomBoxEdit: null, pendingMultiplyZone: null, pendingMultiplyZoneValue: null, pendingMultiplyZoneEdit: null, pendingScaleZone: null, pendingScaleZoneEdit: null, scaleModalApplyTarget: null, scaleCheckMode: false, pendingDeleteZone: null, pendingNote: null, editingNote: null, mousePos: { x: 0, y: 0 }, pan: { x: 0, y: 0 }, isPanning: false, panStart: null,
    counters: [], lineTypes: [], activeLineTypeId: null, ctxTarget: null, selectedLineId: null, selectedLineIsPoly: false, selectedLinePageIdx: null,
    counterSettings: { size: 22, opacity: 1, showRings: false, numberSize: 10, ringSize: 1, ringOpacity: 1, ringSolid: true, outlineSize: 0, showOnlyCountersOnCurrentPage: false },
    iconNames: {},
    iconOrder: null,
    pagesListCollapsed: false,
    pagesTitlesTruncated: true,
    countersListCollapsed: false,
    sidebarReorderModeActive: false,
    lineTypesListCollapsed: false,
    linesListCollapsed: true,
    counterSearch: '',
    lineTypeSearch: '',
    linesSearch: '',
    linesTypeExpanded: {},
    groupsListCollapsed: true,
    summaryListCollapsed: false,
    lineTypeSettings: { opacity: 1, lineSize: 2, dropXSize: 10, dropIconStyle: 'circle', orientLengthWithLine: true, parallelEndsSize: 10, lengthLabelSize: 12, snapToHorizontalVertical: false, showOnlyLineTypesOnCurrentPage: false, showOnlyLinesOnCurrentPage: false },
    legendSettings: { bgOpacity: 1, textOpacity: 1, bgColor: '#ffffff', showBorder: true, legendScale: 1, showResizeHighlight: false },
    multiplyZoneSettings: { showLabelOnZone: true, defaultMultiplier: 2, labelSize: 14, labelPosition: 'center' },
    exportSettings: { markerScale: 0.75, lineScale: 0.75, bundleHighlightsToPdf: true, bundleNotesToPdf: true },
    recentLineColors: [],
    editingPolyline: null, editingPolyIndex: null, draggingVertexIdx: null, resizingNoteIdx: null, resizingNotePageIdx: null, resizingNoteFontSizeIdx: null, resizingNoteFontSizePageIdx: null, resizingNoteFontSizeStartY: null, resizingNoteFontSizeStartLocalY: null, resizingNoteFontSizeStartVal: null, justFinishedResize: false, draggingNoteIdx: null, draggingNotePageIdx: null, draggingNoteOffset: null, dragNoteStartPos: null, justFinishedDragNote: false, draggingLegend: false, resizingLegend: false, legendDragOffset: null, legendResizeStart: null, longPressTimer: null, longPressFired: false,
    longPressStart: null, pinchStartDistance: null, pinchStartZoom: null,
    touchPanStart: null, touchPanning: false,
    aiming: false, aimPressTimer: null, aimPoint: null, aimClient: null, aimRafPending: false,
    aimOffsetPx: 0, aimMouseDownClient: null, justFinishedLoupe: false,
    vertexDragStart: null, vertexDragMoved: false,
    lastScaleTapTime: 0,
    currentProjectId: null,
    currentProjectName: null,
    isAdmin: false,
    pendingDeletePage: null,
    supabaseSession: null,
    pdfBuffer: null,
    pdfBufferSize: 0,
    pdfStoragePath: null,
    pdfHash: null,
    lastSavedAt: null,
    pendingCanvasLoad: null,
    checkedOutBy: null,
    checkedOutAt: null,
    checkedOutEmail: null,
    isViewer: false,
    loadedViaViewLink: false,
    viewToken: null,
    hideMarks: false,
    showAllCanvases: false,   // in-memory peek: render every canvas layer of the page at once
    canCheckOut: false,
    projectOwnerId: null,
    maxZoom: null,
    groups: [],
    rooms: [],
    roomsListCollapsed: false,
    recentRoomHeights: [],
    activeGroupId: null,
    activeCanvasIdByPage: {},
    showLegendOverlay: true,
    showGridOverlay: false,
    showScaleRefLine: true,
    gridSettings: null,
    userActivityAllRowsCache: null,
    userActivityViewMode: 'events'
  };
  state.showGroupColors = localStorage.getItem('groupColorDisplay') === '1';
  try {
    const rrh = JSON.parse(localStorage.getItem('recentRoomHeights') || '[]');
    if (Array.isArray(rrh)) state.recentRoomHeights = rrh.filter(h => typeof h === 'number' && h > 0).slice(0, 5);
  } catch (_) { /* corrupted entry -> empty recents */ }
  state.pagesTitlesTruncated = localStorage.getItem('pagesTitlesTruncated') !== '0';
  state.hideUnmarkedPagesFromSidebar = localStorage.getItem('hideUnmarkedPagesFromSidebar') === '1';
  try {
    state.counterSearch = localStorage.getItem('counterSearch') || '';
    state.lineTypeSearch = localStorage.getItem('lineTypeSearch') || '';
    state.linesSearch = localStorage.getItem('linesSearch') || '';
    const le = localStorage.getItem('linesTypeExpanded');
    state.linesTypeExpanded = le ? JSON.parse(le) : {};
  } catch (_) {}
  try {
    const rc = localStorage.getItem('recentLineColors');
    const parsed = rc ? JSON.parse(rc) : null;
    if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
      state.recentLineColors = parsed.slice(0, RECENT_COLORS_MAX);
    }
  } catch (_) {}

  function getGroupColor(groupId) {
    const g = (state.groups || []).find(x => x.id === groupId);
    return (g && g.color) || COLORS[0];
  }
  function ensureGroupColors(groups) {
    if (!Array.isArray(groups)) return groups;
    groups.forEach((g, i) => { if (!g.color) g.color = COLORS[i % COLORS.length]; });
    return groups;
  }

  // #7b: When true, the next pdfInput.onchange treats the upload as "add
  // additional pages to the current project" and routes through Prepare PDF
  // in append mode. Set by the Project Settings "Add additional PDF pages"
  // button. Always cleared at the top of pdfInput.onchange so it can't leak
  // across calls.
  let lastAuthUserId = null;
  let lastModifiedAt = 0;
  let pendingLastSessionRestore = null;
  let lastSaveIncludedPdf = false;
  // turnInInProgress + inFlightRecoverySavePromise live in save-engine.js
  // (Stage 5): saveEngine.isTurnInInProgress() / resetTurnInState().
  // dirtyStartedAt lives in save-engine.js (Stage 2): saveEngine.getDirtyStartedAt().
  // Autosave/checkout timing & threshold constants live in constants.js (see note in the Constants section).
  // The auto-recheckout rate-limit state (per-project count/cap Maps + min-gap
  // stamp) lives in save-engine.js (Stage 5); resetAutoRecheckoutCounter below.
  // Background-expiry entry point: implementation lives in save-engine.js
  // (Stage 5), including the old supabase-disabled no-op fallback.
  function handleBackgroundCheckoutExpired(trigger) { return saveEngine.handleBackgroundCheckoutExpired(trigger); }
  function resetAutoRecheckoutCounter(projectId) { return saveEngine.resetAutoRecheckoutCounter(projectId); }
  let lastCheckoutRefreshAt = 0;
  let suspendAutoSaveUntilCheckout = false;
  let lastHiddenAt = 0;
  let serverClockOffsetMs = 0;
  function serverNowMs() { return Date.now() + serverClockOffsetMs; }
  function updateServerClockFromRpc(rpcData) {
    const off = computeClockOffsetMs(rpcData, Date.now());
    if (off != null) serverClockOffsetMs = off;
  }

  const withTimeout = (promiseOrFactory, ms, label) => {
    const controller = (typeof promiseOrFactory === 'function') ? new AbortController() : null;
    const inner = controller ? promiseOrFactory(controller.signal) : promiseOrFactory;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (controller) { try { controller.abort(); } catch (_) {} }
        reject(new Error((label || 'Request') + ' timed out after ' + (ms / 1000) + 's'));
      }, ms);
    });
    const result = Promise.race([inner, timeout]).finally(() => clearTimeout(timer));
    result.controller = controller;
    return result;
  };

  // noteAutoSaveOutcome + recordAutosaveLatency (the failure/backoff/latency
  // bookkeeping) live in save-engine.js (Stage 6), internal to the save paths.

  // noteSupabaseJsFailure has no app-side callers anymore (its callers all
  // moved in by Stage 6) — saveEngine.noteSupabaseJsFailure.

  // Save/sync engine: this and the other `[sync]`-prefixed sections form the
  // scattered save/sync subsystem. See ARCHITECTURE.md "Save/sync engine map"
  // for the logical reading order.  (rg "SECTION: \[sync\]" app.js)
  // SECTION: [sync] Sync recovery & client recycle
  // The recovery/recycle orchestrators, probes, client recycle, and raw-fetch
  // fallbacks live in save-engine.js (Stage 4); same-named wrappers below.
  // runRecoveryProbeAndMaybeRecycle: engine-internal since Stage 6.
  function recycleClientIfWedgedOnIdleReturn(trigger) { return saveEngine.recycleClientIfWedgedOnIdleReturn(trigger); }

  // updateSyncPausedBanner + retrySyncNow + captureNetworkInfoDetail/Obj live
  // in save-engine.js (Stage 6); the sync-paused banner Retry button below
  // reaches the abort-and-retry through this wrapper.
  function retrySyncNow() { return saveEngine.retrySyncNow(); }

  // Canvas/display environment for the export envelope -- catches "my counts vanish at
  // high zoom" by revealing the device pixel ratio, the probed canvas caps, the current
  // render-area-safety knob (lowered if a blank was caught), and the last render's buffer
  // dims. Read at export time only; all identifiers are module-scope and initialised by
  // the time logs are exported.
  function captureDisplayInfoObj() {
    try {
      return {
        devicePixelRatio: (typeof window !== 'undefined' && window.devicePixelRatio) || null,
        canvasCaps: getCanvasCaps(),
        fallback: { maxDim: FALLBACK_MAX_DIM, maxArea: FALLBACK_MAX_AREA },
        renderAreaSafety,
        lastRender: {
          pdfW: pdfCanvas ? pdfCanvas.width : null,
          pdfH: pdfCanvas ? pdfCanvas.height : null,
          annW: annCanvas ? annCanvas.width : null,
          annH: annCanvas ? annCanvas.height : null,
          effDpr: currentEffDpr
        }
      };
    } catch (_) { return null; }
  }

  // autosaveEventDetail (the enriched event-detail builder) lives in
  // save-engine.js (Stage 6), internal to the engine's event writers.

  // serializeSaveErrorForEvent + saveDebugSerializeError moved (deduped) to
  // save-utils.js as the single pure serializeSaveError; formatSaveStatusErrDetail
  // moved there too. All three are referenced here by bare name (save-utils
  // globals).

  function runRecoveryProbe(trigger) { return saveEngine.runRecoveryProbe(trigger); }
  // runSupabaseClientProbe / recreateSupabaseClient have no app-side callers
  // anymore (their orchestrators moved with them) — reach them via saveEngine.*.

  // rawProjectsUpdate / rawProjectsInsert: engine-internal since Stage 6
  // (the save paths moved in with them).
  // rawCheckInProject / rawListAccessibleProjects have no app-side callers
  // anymore (Turn In + permission refresh moved in Stage 5) — saveEngine.*.

  // SECTION: [sync] Global force reload
  // The force-reload + keep-alive implementations moved to save-engine.js
  // (createSaveEngine, a classic script loaded before this IIFE). The engine
  // receives everything state/closure-coupled through this ctx of accessors —
  // arrows resolve the live values at call time, so client recycles and `let`
  // reassignments are always seen. The same-named wrappers below keep every
  // call site, the App registry, and the window.* contracts frozen.
  const saveEngine = createSaveEngine({
    getState: () => state,
    getSupabase: () => supabase,
    isSupabaseEnabled: () => SUPABASE_ENABLED,
    withTimeout: (p, ms, label) => withTimeout(p, ms, label),
    pushSaveEvent: (...a) => pushSaveEvent(...a),
    saveDebugLog: (...a) => saveDebugLog(...a),
    isAutoSaveSuspended: () => suspendAutoSaveUntilCheckout,
    getLastCheckoutRefreshAt: () => lastCheckoutRefreshAt,
    // Stage 2 (dirty core): app-side state whose primary writers migrate later.
    setLastModifiedAt: (ms) => { lastModifiedAt = ms; },
    invalidateFooterTotals: () => invalidateFooterTotals(),
    isCheckoutExpiredAttention: () => checkoutExpiredNeedsAttention,
    setLastCheckoutRefreshAt: (ms) => { lastCheckoutRefreshAt = ms; },
    updateServerClockFromRpc: (data) => updateServerClockFromRpc(data),
    // Stage 3 (storage ring).
    serverNowMs: () => serverNowMs(),
    perfLog: (label, ms, extra) => perfLog(label, ms, extra),
    getUserCustomIcons: () => getUserCustomIcons(),
    computePageBakeFrame: (p) => computePageBakeFrame(p),
    getLastModifiedAt: () => lastModifiedAt,
    // Stage 4 (client resilience).
    setSupabase: (client) => { supabase = client; },
    getSupabaseUrl: () => SUPABASE_URL,
    getSupabaseAnonKey: () => SUPABASE_ANON_KEY,
    // Stage 5 (checkout UX): stage-6 save-path state via get/set until those
    // paths migrate; UI hooks resolve at call time (definitions come later in
    // this IIFE, but the engine only calls them from event/async contexts).
    setTurnInProgress: (label) => setTurnInProgress(label),
    showToast: (msg, ms) => showToast(msg, ms),
    updateUI: () => updateUI(),
    updateStatus: () => updateStatus(),
    updateSaveStatusIndicator: () => updateSaveStatusIndicator(),
    updateSettingsCheckoutSection: () => updateSettingsCheckoutSection(),
    clearCheckoutExpiredAttention: () => clearCheckoutExpiredAttention(),
    setCheckoutExpiredAttention: () => { checkoutExpiredNeedsAttention = true; suspendAutoSaveUntilCheckout = true; },
    suspendAutoSave: () => { suspendAutoSaveUntilCheckout = true; },
    isAuthError: (e) => isAuthError(e),
    // Stage 6 (save paths): render-core / feature hooks the engine's save
    // blobs and export envelope need; lastSaveIncludedPdf stays app-side
    // (the load paths write it).
    getServerClockOffsetMs: () => serverClockOffsetMs,
    captureDisplayInfoObj: () => captureDisplayInfoObj(),
    getMaxZoom: () => getMaxZoom(),
    assertPdfWithinLimit: (bytes, context) => assertPdfWithinLimit(bytes, context),
    maybeLogProjectSaveEvent: (projectId) => maybeLogProjectSaveEvent(projectId),
    setLastSaveIncludedPdf: (v) => { lastSaveIncludedPdf = v; },
  });
  function checkGlobalForceReload() { return saveEngine.checkGlobalForceReload(); }
  function doGlobalReloadNow(trigger) { return saveEngine.doGlobalReloadNow(trigger); }
  function showGlobalReloadBanner() { return saveEngine.showGlobalReloadBanner(); }
  saveEngine.installGlobalReloadStampCommit();

  // isTransientSaveError(e) lives in save-utils.js (loaded before this IIFE).

  // The [SaveDebug] helpers (isSaveDebugEnabled/setSaveDebugEnabled/
  // saveDebugRunId/saveDebugLog/saveDebugLogError) live in save-engine.js
  // (Stage 2); same-named wrappers below.
  function isSaveDebugEnabled() { return saveEngine.isSaveDebugEnabled(); }
  function setSaveDebugEnabled(on) { return saveEngine.setSaveDebugEnabled(on); }
  function saveDebugRunId() { return saveEngine.saveDebugRunId(); }
  function saveDebugLog(phase, payload) { return saveEngine.saveDebugLog(phase, payload); }
  function getSaveStatusLogWindowMs() { return saveEngine.getSaveStatusLogWindowMs(); }
  // The saveStatusLog array + prune/push live in save-engine.js (Stage 2);
  // read it via saveEngine.getSaveStatusLog() (App.getSaveStatusLog delegates).
  // saveStatusModalTickTimer moved to features/save-status.js (private to the modal).
  let checkoutExpiredNeedsAttention = false;
  // checkoutExpiredToastShown (the one-shot expired toast) lives in
  // save-engine.js (Stage 5); re-armed via the engine call below.
  function clearCheckoutExpiredAttention() {
    checkoutExpiredNeedsAttention = false;
    saveEngine.clearCheckoutExpiredToastShown();
    suspendAutoSaveUntilCheckout = false;
    updateSaveStatusIndicator();
  }
  function pruneSaveStatusLog() { return saveEngine.pruneSaveStatusLog(); }
  // SECTION: [sync] Save Status log & envelope
  function pushSaveEvent(kind, message, detail) { return saveEngine.pushSaveEvent(kind, message, detail); }
  // getProjectSummaryForLogs + buildSaveLogsEnvelope(+WithSnapshots) + the
  // per-tab session id live in save-engine.js (Stage 6). The wrapper keeps
  // the App registry + features/save-status.js contract frozen.
  function buildSaveLogsEnvelopeWithSnapshots() { return saveEngine.buildSaveLogsEnvelopeWithSnapshots(); }

  function perfLog(label, durationMs, extra) {
    const msg = '[Perf] ' + label + ': ' + durationMs + 'ms';
    if (extra && Object.keys(extra).length) console.log(msg, extra);
    else console.log(msg);
  }

  // SECTION: [sync] Dirty tracking & local session reset
  // markProjectDirty + dirtyGeneration/dirtyStartedAt live in save-engine.js
  // (Stage 2). The wrapper keeps the ~90 call sites + the App publish frozen;
  // the debounced local-backup kick stays here (the writer moves in Stage 3).
  function markProjectDirty() { return saveEngine.markProjectDirty(); }

  // SECTION: Undo/redo stacks
  // The undo/redo stack lives in annotation-model.js (createUndoStack(ctx),
  // same seam as createAnnotationModel). Same-named wrappers keep the call
  // sites + App publishes frozen; updateUI reads the depths via canUndo/canRedo.
  const undoStackModel = createUndoStack({
    getState: () => state,
    uid: () => uid(),
    ensureGroupColors: (g) => ensureGroupColors(g),
    markProjectDirty: () => markProjectDirty(),
    renderPdf: () => renderPdf(),
    updateUI: () => updateUI(),
  });
  function pushUndoSnapshot() { return undoStackModel.pushUndoSnapshot(); }
  function undo() { return undoStackModel.undo(); }
  function redo() { return undoStackModel.redo(); }
  function clearUndoStacks() { return undoStackModel.clearUndoStacks(); }

  function resetAutosaveDegradedState() { return saveEngine.resetAutosaveDegradedState(); }

  function resetLocalSessionState(opts) {
    opts = opts || {};
    const keepArtboard = !!opts.keepArtboard;
    saveEngine.abortInFlightAutoSave('session_reset', true);
    try { subscribeToProjectCheckoutChanges(null); } catch (_) {}
    clearPdfBitmapCache();
    state.pages = [];
    state.currentPage = 0;
    state.currentProjectId = null;
    state.currentProjectName = null;
    state.pdfBuffer = null;
    state.pdfBufferSize = 0;
    state.pdfStoragePath = null;
    state.pdfHash = null;
    state.projectOwnerId = null;
    state.lastSavedAt = null;
    saveEngine.resetLocalBackupState();
    lastSaveIncludedPdf = false;
    state.pendingCanvasLoad = null;
    state.groups = [];
    state.rooms = [];
    state.maxZoom = null;
    state.activeCanvasIdByPage = {};
    state.checkedOutBy = null;
    state.checkedOutAt = null;
    state.checkedOutEmail = null;
    state.isViewer = false;
    state.loadedViaViewLink = false;
    state.canCheckOut = false;
    saveEngine.setAutoSaveDirty(false);
    saveEngine.resetDirtyTracking();
    saveEngine.resetSaveFlags();
    saveEngine.resetTurnInState();
    lastModifiedAt = 0;
    if (App.resetCopyProjectState) App.resetCopyProjectState();
    if (App.resetPdfIntakeFlags) App.resetPdfIntakeFlags();
    pendingLastSessionRestore = null;
    clearUndoStacks();
    resetAutosaveDegradedState();
    saveEngine.clearSaveStatusLog();
    state.userActivityAllRowsCache = null;
    state.userActivityViewMode = 'events';
    try { saveEngine.resetAutoRecheckoutCounter(); } catch (_) {}
    lastCheckoutRefreshAt = 0;
    try { clearCheckoutExpiredAttention(); } catch (_) {}
    try { localStorage.removeItem('clickcount-last-project'); } catch (_) {}
    if (!keepArtboard) {
      state.counters = [];
      state.lineTypes = [];
      try { customIconsCache = []; } catch (_) {}
    }
    try { updateSaveStatusIndicator(); } catch (_) {}
  }

  let signOutBroadcastChannel = null;
  function broadcastSignOut() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        if (!signOutBroadcastChannel) signOutBroadcastChannel = new BroadcastChannel('clickcount-auth');
        signOutBroadcastChannel.postMessage({ kind: 'signed_out', ts: Date.now() });
      }
    } catch (_) {}
    try { localStorage.setItem('clickcount-signout-broadcast', String(Date.now())); } catch (_) {}
  }
  function handleCrossTabSignOut(source) {
    try { pushSaveEvent('cross_tab_signout', 'Sign-out received from another tab', source || ''); } catch (_) {}
    try { resetLocalSessionState(); } catch (_) {}
    try { state.supabaseSession = null; state.isAdmin = false; } catch (_) {}
    // Clear lastAuthUserId so the local SIGNED_OUT event that follows (once
    // supabase-js syncs the auth storage change) skips a redundant broadcast.
    lastAuthUserId = null;
    try { stopPresenceHeartbeat && stopPresenceHeartbeat(); } catch (_) {}
    try { updateUI(); renderPdf(); updateSaveStatusIndicator(); } catch (_) {}
  }
  if (typeof window !== 'undefined') {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        signOutBroadcastChannel = new BroadcastChannel('clickcount-auth');
        signOutBroadcastChannel.addEventListener('message', (ev) => {
          if (ev?.data?.kind === 'signed_out') handleCrossTabSignOut('broadcast');
        });
      }
    } catch (_) {}
    try {
      window.addEventListener('storage', (ev) => {
        if (ev.key === 'clickcount-signout-broadcast' && ev.newValue) handleCrossTabSignOut('storage');
      });
    } catch (_) {}
  }

  // SECTION: [sync] Checkout probe, hashing & PDF cache
  // probeCheckoutLock lives in save-engine.js (Stage 3); wrapper keeps the
  // preflight/visibility callers frozen.
  function probeCheckoutLock(runId) { return saveEngine.probeCheckoutLock(runId); }

  // sha256Hex: engine-internal + App.sha256Hex delegate (intake moved, split #38).

  // IndexedDB store names & caps live in constants.js; the BACKUP_PDF_TO_INDEXEDDB
  // env read lives in idb.js (a shared classic-script global the engine also reads).

  // openPdfCacheDb, viewCache*, pdfCache* live in idb.js (loaded before app.js).
  // They are context-free storage primitives and resolve here by bare name.

  // takeoffBackupGet / takeoffBackupPut (the mismatch check + one-shot warn
  // wrappers over the idb.js primitives) live in save-engine.js (Stage 3).
  function takeoffBackupGet(projectId, currentUserId) { return saveEngine.takeoffBackupGet(projectId, currentUserId); }
  function takeoffBackupPut(projectId, data, pdfBlob, pdfHash, lastMod, projectName, userId) { return saveEngine.takeoffBackupPut(projectId, data, pdfBlob, pdfHash, lastMod, projectName, userId); }

  // takeoffBackupDelete + readSaveLogsSnapshots live in idb.js (context-free).

  // writeSaveLogsSnapshot (the throttled diagnostic envelope snapshot) lives
  // in save-engine.js (Stage 6); idb.js owns the put + prune-to-max.

  function customIconsCurrentKey() {
    const uid = state.supabaseSession?.user?.id || null;
    return uid ? ('customIcons_' + uid) : CUSTOM_ICONS_KEY;
  }
  // Wrappers over idb.js idbCustomIconsGet/Put: customIconsCurrentKey reads state,
  // so the key is computed here and passed in; the migration log stays app-side.
  async function customIconsGetFromIndexedDB() {
    const primaryKey = customIconsCurrentKey();
    const res = await idbCustomIconsGet(primaryKey, CUSTOM_ICONS_KEY);
    if (res && res.migratedFrom) {
      try { saveDebugLog('customIcons.migrated_to_per_user', { from: res.migratedFrom, to: res.migratedTo, count: Array.isArray(res.data) ? res.data.length : 0 }); } catch (_) {}
    }
    return res ? res.data : null;
  }
  async function customIconsPutToIndexedDB(arr) {
    await idbCustomIconsPut(customIconsCurrentKey(), arr);
  }

  async function deleteProjectAsOwner(projectId, pdfPath) {
    if (!supabase) return;
    try {
      if (pdfPath) {
        try {
          await supabase.storage.from('pdfs').remove([pdfPath]);
        } catch (_) { /* continue */ }
      }
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      await pdfCacheDelete(projectId);
      await takeoffBackupDelete(projectId);
    } catch (e) {
      console.error('[Delete project]', e);
      throw e;
    }
  }

  async function doRestoreLastProject(proj, cachedBlob) {
    // A1: Same hygiene as the Load Project row-click - clear any stale
    // pendingCanvasLoad before we start rebuilding session state.
    state.pendingCanvasLoad = null;
    const d = proj.data;
    const projUpdated = proj.updated_at ? new Date(proj.updated_at).getTime() : 0;
    const idbBackup = await takeoffBackupGet(proj.id, state.supabaseSession?.user?.id || null);
    const useIdbBackup = idbBackup && idbBackup.lastModifiedAt > projUpdated;
    let pdf;
    const idbPdfBlob = useIdbBackup && idbBackup.pdfBlob && idbBackup.pdfBlob.size > 0 ? idbBackup.pdfBlob : null;
    if (idbPdfBlob) {
      try {
        const buf = await idbPdfBlob.arrayBuffer();
        pdf = await pdfjsLib.getDocument(buf).promise;
      } catch (e) {
        if (!cachedBlob && !proj.pdf_path) throw e;
      }
    }
    if (!pdf && cachedBlob && cachedBlob.size > 0) {
      try {
        const buf = await cachedBlob.arrayBuffer();
        pdf = await pdfjsLib.getDocument(buf).promise;
      } catch (e) {
        if (!proj.pdf_path) throw e;
        const { data: signed, error: urlErr } = await supabase.storage.from('pdfs').createSignedUrl(proj.pdf_path, 3600);
        if (urlErr) throw urlErr;
        pdf = await pdfjsLib.getDocument({ url: signed.signedUrl }).promise;
        if (proj.pdf_hash) {
          supabase.storage.from('pdfs').download(proj.pdf_path).then(({ data: blob }) => {
            if (blob) pdfCachePut(proj.id, blob, proj.pdf_hash);
          });
        }
      }
    }
    if (!pdf && proj.pdf_path) {
      const { data: blob, error: urlErr } = await supabase.storage.from('pdfs').download(proj.pdf_path);
      if (urlErr) throw urlErr;
      if (!blob || blob.size === 0) throw new Error('The PDF file in cloud storage is empty');
      pdf = await pdfjsLib.getDocument(blob).promise;
      if (proj.pdf_hash) pdfCachePut(proj.id, blob, proj.pdf_hash);
    }
    if (!pdf) throw new Error('No PDF available for this project');
    clearPdfBitmapCache();
    state.pages = [];
    const numPages = pdf.numPages;
    for (let i = 0; i < numPages; i++) {
      const pdfPage = await pdf.getPage(i + 1);
      const label = numPages > 1 ? ('document.pdf — p' + (i + 1)) : 'document.pdf';
      const canvasId = uid();
      state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: makeAnnotations() }], scale: null, rotation: 0 });
      state.activeCanvasIdByPage[i] = canvasId;
    }
    if (useIdbBackup && idbBackup.data) {
      applyTakeoffBackupToState(idbBackup.data);
    } else {
      state.counters = Array.isArray(d.counters) ? d.counters : [];
      state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
      state.groups = ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
      state.rooms = Array.isArray(d.rooms) ? d.rooms : [];
      if (d.iconNames && typeof d.iconNames === 'object') state.iconNames = d.iconNames;
      if (Array.isArray(d.iconOrder)) state.iconOrder = d.iconOrder;
      if (Array.isArray(d.customIconPaths)) saveUserCustomIcons(d.customIconPaths);
      (d.pages || []).forEach(p => {
        applyPageAnnotationsFromData(state.pages[p.index], p);
      });
      if (d.activeCanvasIdByPage && typeof d.activeCanvasIdByPage === 'object') state.activeCanvasIdByPage = d.activeCanvasIdByPage;
      state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
      if (d.legendSettings) state.legendSettings = { ...state.legendSettings, ...d.legendSettings };
      if (d.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...d.multiplyZoneSettings };
      if (d.showGridOverlay != null) state.showGridOverlay = !!d.showGridOverlay;
      if (d.gridSettings) state.gridSettings = d.gridSettings;
    }
    reconcileOrphanedCountersAndLineTypes();
    state.currentProjectId = proj.id === 'local' ? null : proj.id;
    try { clearCheckoutExpiredAttention(); } catch (_) {}
    state.currentProjectName = proj.name || 'Untitled';
    state.pdfStoragePath = proj.pdf_path;
    state.pdfHash = proj.pdf_hash || null;
    state.pdfBuffer = null;
    state.pdfBufferSize = 0;
    lastSaveIncludedPdf = !!proj.pdf_path;
    state.lastSavedAt = proj.updated_at || null;
    saveEngine.setLastLocalBackupAt(null);
    state.currentPage = Math.min(state.currentPage, Math.max(0, state.pages.length - 1));
    state.projectOwnerId = proj.user_id || null;
    state.checkedOutBy = proj.checked_out_by || null;
    state.checkedOutAt = proj.checked_out_at || null;
    state.checkedOutEmail = null;
    const userId = state.supabaseSession?.user?.id;
    const isOwner = proj.user_id === userId;
    const lockExpired = !proj.checked_out_at || (serverNowMs() - new Date(proj.checked_out_at).getTime() >= CHECKOUT_INACTIVITY_MS);
    const hasValidCheckout = proj.checked_out_by === userId && !lockExpired;
    state.loadedViaViewLink = false;
    state.isViewer = !hasValidCheckout;
    state.canCheckOut = (isOwner && (!proj.checked_out_by || lockExpired)) || false;
    clearUndoStacks();
    saveEngine.setAutoSaveDirty(false);
    lastModifiedAt = 0;
    fitZoom();
    renderPdf();
    refreshProjectPermissions();
    subscribeToProjectCheckoutChanges(state.currentProjectId);
  }

  // SECTION: Math & Format Helpers
  // Pure geometry/parse primitives (ptDist, snapToHorizontalOrVertical, polylineDistance,
  // polygonArea, distToSegment, the quadratic-bezier helpers, rotatePoint90CW, pointInRect,
  // rectsOverlap, the zone locators, formatLineLengthRealSum, parseRealWorldLength,
  // parseFraction) live in geometry.js (loaded before this IIFE); referenced here by bare
  // name via the shared global lexical scope. The state-coupled helpers below stay.
  // The pure line-length / scale math lives in line-metrics.js (loaded before
  // this IIFE); the helpers below are same-named thin wrappers that resolve the
  // state-coupled inputs (per-page scale, the line's resolved line-type, the
  // pages array) and delegate to the distinctly-named pure primitives. The
  // window.* exports stay here unchanged (report.js contract).
  function lineTypeForLine(line) {
    return (state.lineTypes || []).find(l => l.id === line.lineTypeId);
  }
  function quickLineLength(q) {
    return lineSegmentLength(q, lineTypeForLine(q));
  }
  window.quickLineLength = quickLineLength;
  function getLineLengthPdfPts(line, pageIdx, isPoly) {
    return lineLengthPdfPts(line, isPoly, state.pages[pageIdx]?.scale, lineTypeForLine(line));
  }
  window.getLineLengthPdfPts = getLineLengthPdfPts;
  window.getMultiplyZoneForPoint = getMultiplyZoneForPoint;
  window.getMultiplyZoneForLine = getMultiplyZoneForLine;
  function getEffectiveScaleForLine(ann, line, isPoly, pageIdx) {
    return effectiveScaleForLine(ann, line, isPoly, getPageScale(pageIdx));
  }
  function getLineRealWorldLength(line, pageIdx, isPoly, ann) {
    return lineRealWorldLength(line, isPoly, ann, getPageScale(pageIdx), lineTypeForLine(line));
  }
  function getLineLengthForTotals(line, pageIdx, isPoly, ann) {
    return lineLengthForTotals(line, isPoly, ann, getPageScale(pageIdx), lineTypeForLine(line));
  }
  // Total length in FEET — used by every takeoff tally/summary/export so line lengths
  // read identically ("12.50 ft") regardless of the page's scale unit, and so a line
  // type spanning differently-scaled pages sums correctly. Per-line on-canvas labels and
  // the Measure tool keep their feet-inches notation (they don't use this).
  function getLineLengthFeetForTotals(line, pageIdx, isPoly, ann) {
    return lineLengthFeetForTotals(line, isPoly, ann, getPageScale(pageIdx), lineTypeForLine(line));
  }
  // A single line's real-world length in feet (no multiply-zone factor) — for the
  // per-line length badges in the Lines list. Converts via the line's effective unit.
  function getLineRealWorldLengthFeet(line, pageIdx, isPoly, ann) {
    const raw = getLineRealWorldLength(line, pageIdx, isPoly, ann);
    const eff = getEffectiveScaleForLine(ann, line, isPoly, pageIdx);
    return (eff && eff.unit) ? convertUnitValue(raw, eff.unit, 'ft') : raw;
  }
  window.getScaleZoneForLine = getScaleZoneForLine;
  window.getEffectiveScaleForLine = getEffectiveScaleForLine;
  window.getLineRealWorldLength = getLineRealWorldLength;
  window.getLineLengthForTotals = getLineLengthForTotals;
  window.getLineLengthFeetForTotals = getLineLengthFeetForTotals;

  function countItemsInRect(ann, pageIdx, x1, y1, x2, y2) {
    let counterCount = 0, lineRunCount = 0, lengthRealSum = 0;
    const inRect = (p) => pointInRect(p, x1, y1, x2, y2);
    (state.counters || []).forEach(c => {
      (ann?.counterMarkers?.[c.id] || []).forEach(m => { if (inRect(m)) counterCount++; });
    });
    (ann?.quickLines || []).forEach(q => {
      const start = { x: q.x1, y: q.y1 }, end = { x: q.x2, y: q.y2 };
      if (inRect(start) && inRect(end)) { lineRunCount++; lengthRealSum += getLineRealWorldLengthFeet(q, pageIdx, false, ann); }
    });
    (ann?.polylines || []).forEach(poly => {
      const pts = poly.points || [];
      const start = pts[0], end = pts[pts.length - 1];
      if (start && end && inRect(start) && inRect(end)) { lineRunCount++; lengthRealSum += getLineRealWorldLengthFeet(poly, pageIdx, true, ann); }
    });
    return { counterCount, lineRunCount, lengthRealSum };
  }
  function collectItemsToDeleteInRect(ann, pageIdx, x1, y1, x2, y2) {
    const inRect = (p) => pointInRect(p, x1, y1, x2, y2);
    const result = {
      counterCount: 0, lineRunCount: 0, lengthRealSum: 0,
      highlightCount: 0, noteCount: 0, multiplyZoneCount: 0, scaleZoneCount: 0, roomBoxCount: 0,
      counters: [], quickLines: [], polylines: [],
      highlights: [], notes: [], multiplyZones: [], scaleZones: [], roomBoxes: []
    };
    (state.counters || []).forEach(c => {
      (ann?.counterMarkers?.[c.id] || []).forEach(m => {
        if (inRect(m)) {
          result.counterCount++;
          result.counters.push({ counterId: c.id, marker: m });
        }
      });
    });
    (ann?.quickLines || []).forEach((q, i) => {
      const start = { x: q.x1, y: q.y1 }, end = { x: q.x2, y: q.y2 };
      if (inRect(start) && inRect(end)) {
        result.lineRunCount++;
        result.lengthRealSum += getLineRealWorldLengthFeet(q, pageIdx, false, ann);
        result.quickLines.push({ index: i, line: q });
      }
    });
    (ann?.polylines || []).forEach((poly, i) => {
      const pts = poly.points || [];
      const start = pts[0], end = pts[pts.length - 1];
      if (start && end && inRect(start) && inRect(end)) {
        result.lineRunCount++;
        result.lengthRealSum += getLineRealWorldLengthFeet(poly, pageIdx, true, ann);
        result.polylines.push({ index: i, poly });
      }
    });
    (ann?.highlights || []).forEach((h, i) => {
      const cx = (h.x1 + h.x2) / 2, cy = (h.y1 + h.y2) / 2;
      if (inRect({ x: cx, y: cy })) {
        result.highlightCount++;
        result.highlights.push({ index: i });
      }
    });
    (ann?.notes || []).forEach((n, i) => {
      if (inRect({ x: n.x, y: n.y })) {
        result.noteCount++;
        result.notes.push({ index: i });
      }
    });
    (ann?.multiplyZones || []).forEach((z, i) => {
      const cx = (z.x1 + z.x2) / 2, cy = (z.y1 + z.y2) / 2;
      if (inRect({ x: cx, y: cy })) {
        result.multiplyZoneCount++;
        result.multiplyZones.push({ index: i });
      }
    });
    (ann?.scaleZones || []).forEach((z, i) => {
      const cx = (z.x1 + z.x2) / 2, cy = (z.y1 + z.y2) / 2;
      if (inRect({ x: cx, y: cy })) {
        result.scaleZoneCount++;
        result.scaleZones.push({ index: i });
      }
    });
    (ann?.roomBoxes || []).forEach((b, i) => {
      const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
      if (inRect({ x: cx, y: cy })) {
        result.roomBoxCount++;
        result.roomBoxes.push({ index: i });
      }
    });
    return result;
  }
  function performDeleteZone(ann, collected) {
    pushUndoSnapshot();
    (collected.counters || []).forEach(({ counterId, marker }) => {
      const arr = ann?.counterMarkers?.[counterId];
      if (arr) {
        const idx = arr.indexOf(marker);
        if (idx >= 0) arr.splice(idx, 1);
      }
    });
    (collected.multiplyZones || []).slice().sort((a, b) => b.index - a.index).forEach(({ index }) => {
      (ann?.multiplyZones || []).splice(index, 1);
    });
    (collected.scaleZones || []).slice().sort((a, b) => b.index - a.index).forEach(({ index }) => {
      (ann?.scaleZones || []).splice(index, 1);
    });
    (collected.roomBoxes || []).slice().sort((a, b) => b.index - a.index).forEach(({ index }) => {
      (ann?.roomBoxes || []).splice(index, 1);
    });
    (collected.polylines || []).slice().sort((a, b) => b.index - a.index).forEach(({ index }) => {
      (ann?.polylines || []).splice(index, 1);
    });
    (collected.quickLines || []).slice().sort((a, b) => b.index - a.index).forEach(({ index }) => {
      (ann?.quickLines || []).splice(index, 1);
    });
    (collected.highlights || []).slice().sort((a, b) => b.index - a.index).forEach(({ index }) => {
      (ann?.highlights || []).splice(index, 1);
    });
    (collected.notes || []).slice().sort((a, b) => b.index - a.index).forEach(({ index }) => {
      (ann?.notes || []).splice(index, 1);
    });
    markProjectDirty();
    renderPdf();
    updateUI();
  }
  function getPageScale(pi) { return state.pages[pi]?.scale ?? null; }
  // Classify a page's PDF point dimensions against the standard sheet sizes so the Set Scale
  // presets can detect a compressed / re-boxed page and offer a sheet-size correction. Uses the
  // unrotated viewport (analyzeSheet normalizes orientation). Returns null when the page has no
  // pdfPage yet (e.g. a canvas-only project). Pure analysis lives in geometry.js.
  function getPageSheetAnalysis(pi) {
    const p = state.pages[pi];
    if (!p?.pdfPage) return null;
    try {
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: 0 });
      return analyzeSheet(vp.width, vp.height);
    } catch (_) { return null; }
  }
  function pickScaleForLineType(pageIndices) {
    return scaleForLineType(pageIndices, state.pages);
  }
  function getMarkedPageIndices() {
    return state.pages
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => pageHasAnyAnnotations(p))
      .map(({ i }) => i);
  }
  // formatDist / formatDistFeetInches / formatDistFeetInchesFromReal / formatArea
  // moved to geometry.js (pure; all callers pass `scale` explicitly). The old
  // `scale ?? getPageScale(state.currentPage)` default was unused and was dropped.

  function rotateAnnotations(page, w, h) {
    const r = (pt) => rotatePoint90CW(pt, w, h);
    const rotateAnn = (ann) => {
    if (ann.counterMarkers) {
      const next = {};
      for (const [cid, arr] of Object.entries(ann.counterMarkers)) {
        next[cid] = (arr || []).map(m => ({ ...m, ...r({ x: m.x, y: m.y }) }));
      }
      ann.counterMarkers = next;
    }
    (ann.quickLines || []).forEach(q => {
      const a = r({ x: q.x1, y: q.y1 }), b = r({ x: q.x2, y: q.y2 });
      q.x1 = a.x; q.y1 = a.y; q.x2 = b.x; q.y2 = b.y;
    });
    (ann.polylines || []).forEach(poly => {
      if (poly.points) poly.points = poly.points.map(pt => r(pt));
    });
    (ann.highlights || []).forEach(h => {
      const a = r({ x: h.x1, y: h.y1 }), b = r({ x: h.x2, y: h.y2 });
      h.x1 = a.x; h.y1 = a.y; h.x2 = b.x; h.y2 = b.y;
    });
    (ann.multiplyZones || []).forEach(z => {
      const a = r({ x: z.x1, y: z.y1 }), b = r({ x: z.x2, y: z.y2 });
      z.x1 = a.x; z.y1 = a.y; z.x2 = b.x; z.y2 = b.y;
    });
    (ann.scaleZones || []).forEach(z => {
      const a = r({ x: z.x1, y: z.y1 }), b = r({ x: z.x2, y: z.y2 });
      z.x1 = a.x; z.y1 = a.y; z.x2 = b.x; z.y2 = b.y;
    });
    (ann.roomBoxes || []).forEach(bx => {
      const a = r({ x: bx.x1, y: bx.y1 }), b = r({ x: bx.x2, y: bx.y2 });
      bx.x1 = a.x; bx.y1 = a.y; bx.x2 = b.x; bx.y2 = b.y;
    });
    (ann.notes || []).forEach(n => {
      const p = r({ x: n.x, y: n.y });
      n.x = p.x; n.y = p.y;
    });
    if (ann.legend && typeof ann.legend === 'object') {
      const p = r({ x: ann.legend.x, y: ann.legend.y });
      ann.legend.x = p.x; ann.legend.y = p.y;
    }
    };
    const canvases = getPageCanvases(page);
    if (canvases.length) canvases.forEach(c => { if (c.annotations) rotateAnn(c.annotations); });
    else rotateAnn(getActiveAnnotations(page));
  }
  function applyRotationDeltaToAnnotations(page, deltaDegrees) {
    if (!page?.pdfPage || deltaDegrees % 90 !== 0) return;
    const steps = Math.round((((deltaDegrees % 360) + 360) % 360) / 90);
    if (steps === 0) return;
    let rot = page.rotation ?? 0;
    for (let i = 0; i < steps; i++) {
      const vp = page.pdfPage.getViewport({ scale: 1, rotation: rot });
      rotateAnnotations(page, vp.width, vp.height);
      rot = (rot + 90) % 360;
    }
  }
  function deepCopyAnnotations(ann) {
    if (!ann) return makeAnnotations();
    return JSON.parse(JSON.stringify(ann));
  }
  function rotatePage90() {
    const page = state.pages[state.currentPage];
    if (!page || !page.pdfPage) return;
    pushUndoSnapshot();
    const rot = page.rotation ?? 0;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: rot });
    const w = vp.width, h = vp.height;
    rotateAnnotations(page, w, h);
    page.rotation = (rot + 90) % 360;
    state.scalePointA = null;
    state.scalePointB = null;
    state.scaleMode = SCALE_MODES.NONE;
    markProjectDirty();
    renderPdf();
    updateUI();
  }

  let _measureCanvas = null;
  function wrapNoteText(text, maxWidth, font, lineHeight) {
    if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
    const ctx = _measureCanvas.getContext('2d');
    ctx.font = font || '14px DM Sans';
    const lh = lineHeight != null ? lineHeight : 14;
    const rawWords = (text || '').split(/\s+/).filter(Boolean);
    const words = [];
    for (const w of rawWords) {
      const parts = w.split(/([-_])/);
      if (parts.length === 1) {
        words.push(w);
      } else {
        let buf = '';
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === '-' || parts[i] === '_') {
            buf += parts[i];
            words.push(buf);
            buf = '';
          } else if (parts[i]) {
            buf = parts[i];
          }
        }
        if (buf) words.push(buf);
      }
    }
    const lines = [];
    let current = '';
    for (const w of words) {
      const test = current ? current + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = w;
      } else current = test;
    }
    if (current) lines.push(current);
    return { lines, height: lines.length * lh };
  }

  function getClientCoords(e) {
    if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  const canvasContainer = document.getElementById('canvasContainer');
  const pdfCanvas = document.getElementById('pdfCanvas');
  const annCanvas = document.getElementById('annCanvas');
  const aimLoupe = document.getElementById('aimLoupe');

  const dpr = () => window.devicePixelRatio || 1;

  // Canvas-size cap: at extreme zoom, pageW*zoom*dpr can exceed the browser's max
  // canvas dimension/area (iOS Safari is strictest, area-limited) and the canvas
  // silently renders blank/black. We clamp the render-path device-pixel-ratio to an
  // "effective" value so the buffer always fits. dpr only affects bitmap sharpness —
  // it cancels out of every on-screen size — so layout/positions/fonts are unchanged
  // and the bitmap merely softens past the cap (never blank). A few constant-pixel
  // features (line widths, marker dots) draw slightly larger only *beyond* the cap,
  // i.e. only where the canvas used to go black — benign.
  let currentEffDpr = window.devicePixelRatio || 1;     // refreshed by renderPdf + renderAnnotations
  const FALLBACK_MAX_DIM = 8192;
  const FALLBACK_MAX_AREA = 16777216;                   // ~4096^2 — safe for old iOS Safari
  let _canvasCaps = null;
  function getCanvasCaps() { return _canvasCaps || { maxDim: FALLBACK_MAX_DIM, maxArea: FALLBACK_MAX_AREA }; }
  function setCanvasCaps(caps) { _canvasCaps = caps; }   // override (debug / tests)

  // The boot probe measures the largest *single* canvas the device can allocate, but a
  // render keeps THREE big canvases alive at peak (pdfOffscreenCanvas + pdfCanvas +
  // annCanvas). On a memory-pressured desktop the last one (the annotation overlay)
  // can silently allocate-but-paint-blank — counts vanish. So the render path budgets
  // the probed area cap down by `renderAreaSafety` (applied in effectiveDpr), leaving
  // memory headroom. If a render still reads back blank, the read-back guard in
  // renderPdf ratchets this knob lower and re-renders (softer, never blank). Monotonic
  // within a session — never raised back up, since a device that failed once shouldn't retry.
  const RENDER_AREA_SAFETY_MAX = 0.5;    // start at 50% of the probed area cap (coexistence headroom)
  const RENDER_AREA_SAFETY_MIN = 0.12;   // ratchet floor — below this we accept a soft bitmap
  const RENDER_AREA_SAFETY_STEP = 0.6;   // each ratchet step multiplies the knob
  let renderAreaSafety = RENDER_AREA_SAFETY_MAX;

  // Does this canvas's far corner actually read back? A canvas that silently failed to
  // allocate its backing store (memory pressure / over the device cap) paints blank with
  // no error — the corner pixel won't read as the colour we set. Mutates one corner pixel
  // (scratch; caller repaints). Dependency-free; shared by the boot probe + render guard.
  function canvasCornerReadsBack(canvas) {
    if (!canvas || !(canvas.width > 0) || !(canvas.height > 0)) return false;
    const g = canvas.getContext('2d');
    if (!g) return false;
    const x = canvas.width - 1, y = canvas.height - 1;
    const prev = g.fillStyle;
    g.fillStyle = '#fff';
    g.fillRect(x, y, 1, 1);
    let ok = false;
    try { ok = g.getImageData(x, y, 1, 1).data[3] === 255; } catch (_) { ok = false; }
    g.fillStyle = prev;
    return ok;
  }

  // One-time probe of the device's real max canvas size: binary-search the largest
  // canvas whose far-corner pixel reads back. Detached canvases, freed after each test.
  function detectMaxCanvasArea() {
    try {
      const readsBack = (w, h) => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ok = canvasCornerReadsBack(c);
        c.width = 0; c.height = 0;
        return ok;
      };
      let lo = 1024, hi = 16384, maxDim = 1024;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (readsBack(mid, mid)) { maxDim = mid; lo = mid + 1; } else hi = mid - 1; }
      const stripW = Math.min(maxDim, 4096);
      lo = 1024; hi = 16384; let bestH = 1024;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (readsBack(stripW, mid)) { bestH = mid; lo = mid + 1; } else hi = mid - 1; }
      const margin = 0.95;
      _canvasCaps = { maxDim: Math.floor(maxDim * margin), maxArea: Math.floor(stripW * bestH * margin) };
    } catch (_) {
      _canvasCaps = null;   // fall back to conservative constants
    }
  }

  // Clamped device-pixel-ratio for rendering `page` at `zoom` (keeps the buffer under
  // the detected cap). Uses the scale-1, rotation-correct page dimensions.
  function effectiveDpr(page, zoom) {
    if (!page || !page.pdfPage) return window.devicePixelRatio || 1;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const caps = getCanvasCaps();
    // Budget the probed area cap down so pdfCanvas + annCanvas (and, transiently, the
    // offscreen) can coexist without exhausting device memory. maxDim is left intact —
    // the failure is area/memory-driven, not single-axis overflow, and clampEffectiveDpr
    // already takes the min across both, so this only bites when area is the binding limit.
    return clampEffectiveDpr({ pageW: vp.width, pageH: vp.height, zoom, dpr: window.devicePixelRatio || 1, maxDim: caps.maxDim, maxArea: caps.maxArea * renderAreaSafety });
  }

  function toCanvas(p) { const scale = state.zoom * currentEffDpr; return { x: p.x * scale, y: p.y * scale }; }

  function canvasToPdf(canvasX, canvasY) {
    return { x: (canvasX - state.pan.x) / state.zoom, y: (canvasY - state.pan.y) / state.zoom };
  }

  function isPointInPageBounds(p) {
    const page = state.pages[state.currentPage];
    if (!page?.pdfPage) return false;
    const scale = state.zoom * dpr();
    const vp = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
    const w = vp.width / scale, h = vp.height / scale;
    return p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
  }
  function clampPointToPageBounds(p) {
    const page = state.pages[state.currentPage];
    if (!page?.pdfPage) return p;
    const scale = state.zoom * dpr();
    const vp = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
    const w = vp.width / scale, h = vp.height / scale;
    return { x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(h, p.y)) };
  }

  function hitTest(pos, radius = 12) {
    const r = radius / state.zoom;
    const page = state.pages[state.currentPage];
    if (!page) return null;
    const ann = getActiveAnnotations(page);
    for (const [typeId, markers] of Object.entries(ann.counterMarkers || {})) {
      for (let i = 0; i < markers.length; i++) {
        if (ptDist(pos, markers[i]) <= r) return { type: 'marker', typeId, index: i };
      }
    }
    const lineCandidates = [];
    for (let i = 0; i < (ann.quickLines || []).length; i++) {
      const q = ann.quickLines[i];
      const a = { x: q.x1, y: q.y1 }, b = { x: q.x2, y: q.y2 };
      const lt = (state.lineTypes || []).find(l => l.id === q.lineTypeId);
      const d = lt?.curveStyle === 'arc'
        ? distToQuadraticBezier(pos, a, getQuadraticBezierControlPoint(a, b, 1), b)
        : distToSegment(pos, a, b);
      if (d <= r) lineCandidates.push({ type: 'quickLine', index: i, dist: d });
    }
    for (let i = 0; i < (ann.polylines || []).length; i++) {
      const poly = ann.polylines[i];
      const pts = poly.points || [];
      let minD = Infinity;
      for (let j = 0; j < pts.length - 1; j++) {
        minD = Math.min(minD, distToSegment(pos, pts[j], pts[j + 1]));
      }
      if (poly.closed && pts.length >= 3) {
        minD = Math.min(minD, distToSegment(pos, pts[pts.length - 1], pts[0]));
      }
      if (minD <= r) lineCandidates.push({ type: 'polyline', index: i, dist: minD });
    }
    if (lineCandidates.length > 0) {
      const best = lineCandidates.reduce((a, b) => a.dist <= b.dist ? a : b);
      return { type: best.type, index: best.index };
    }
    for (let i = 0; i < (ann.highlights || []).length; i++) {
      const h = ann.highlights[i];
      const minX = Math.min(h.x1, h.x2), maxX = Math.max(h.x1, h.x2);
      const minY = Math.min(h.y1, h.y2), maxY = Math.max(h.y1, h.y2);
      if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) return { type: 'highlight', index: i };
    }
    for (let i = 0; i < (ann.multiplyZones || []).length; i++) {
      const z = ann.multiplyZones[i];
      const minX = Math.min(z.x1, z.x2), maxX = Math.max(z.x1, z.x2);
      const minY = Math.min(z.y1, z.y2), maxY = Math.max(z.y1, z.y2);
      if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) return { type: 'multiplyZone', index: i };
    }
    for (let i = 0; i < (ann.scaleZones || []).length; i++) {
      const z = ann.scaleZones[i];
      const minX = Math.min(z.x1, z.x2), maxX = Math.max(z.x1, z.x2);
      const minY = Math.min(z.y1, z.y2), maxY = Math.max(z.y1, z.y2);
      if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) return { type: 'scaleZone', index: i };
    }
    for (let i = 0; i < (ann.roomBoxes || []).length; i++) {
      const b = ann.roomBoxes[i];
      const minX = Math.min(b.x1, b.x2), maxX = Math.max(b.x1, b.x2);
      const minY = Math.min(b.y1, b.y2), maxY = Math.max(b.y1, b.y2);
      if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) return { type: 'roomBox', index: i };
    }
    for (let i = 0; i < (ann.notes || []).length; i++) {
      const n = ann.notes[i];
      const noteRot = getNoteRotationRad(n, page);
      const cosR = Math.cos(noteRot), sinR = Math.sin(noteRot);
      const localToViewport = (note, lx, ly) => ({ x: note.x + cosR * lx - sinR * ly, y: note.y + sinR * lx + cosR * ly });
      const w = n.width || 150;
      const fontSizeHandle = localToViewport(n, -8, 8);
      const widthHandle = localToViewport(n, w, 8);
      if (ptDist(pos, fontSizeHandle) <= r) return { type: 'noteFontSize', index: i };
      if (ptDist(pos, widthHandle) <= r) return { type: 'noteResize', index: i };
      const fontSize = n.fontSize || 14;
      const scale = state.zoom * currentEffDpr;   // match the drawn note font (effDpr-clamped)
      const font = fontSize * scale + 'px DM Sans';
      const { lines } = wrapNoteText(n.text, w * scale, font, fontSize * scale);
      const heightPdf = lines.length * fontSize;
      const lx = cosR * (pos.x - n.x) + sinR * (pos.y - n.y);
      const ly = -sinR * (pos.x - n.x) + cosR * (pos.y - n.y);
      if (lx >= 0 && lx <= w && ly >= 0 && ly <= heightPdf) return { type: 'note', index: i };
    }
    const leg = ann.legend;
    if (leg && state.showLegendOverlay) {
      const { x, y, w, h } = leg;
      const HEADER_H = 18;
      const RESIZE_SIZE = 16;
      if (pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h) {
        if (pos.x >= x + w - RESIZE_SIZE && pos.y >= y + h - RESIZE_SIZE)
          return { type: 'legendResize' };
        if (pos.y <= y + HEADER_H)
          return { type: 'legendDrag' };
        return { type: 'legend' };
      }
    }
    return null;
  }

  function getNoteRotationRad(n, page) {
    if (n.placementRotation == null) n.placementRotation = page.rotation ?? 0;
    let diff = (n.placementRotation - (page.rotation ?? 0)) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return -diff * Math.PI / 180;
  }

  function renderIconHtml(iconValue, color) {
    return iconSvgHtml(iconValue, color, iconViewBoxString(iconValue));
  }

  function formatSaveTime(isoStr) {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    const agoSec = (Date.now() - d.getTime()) / 1000;
    const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const agoStr = formatAgo(agoSec);
    return timeStr + ' (' + agoStr + ')';
  }

  function formatSaveTimeParts(isoStr) {
    if (!isoStr) return { clock: '', ago: '' };
    const d = new Date(isoStr);
    const agoSec = (Date.now() - d.getTime()) / 1000;
    const clock = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const ago = formatAgo(agoSec);
    return { clock, ago };
  }

  let footerTotalsCache = null;
  let footerTotalsDirty = true;
  function invalidateFooterTotals() { footerTotalsDirty = true; }
  function computeFooterTotals() {
    if (!state.pages || !state.pages.length) return { count: 0, lengthReal: 0, scale: null };
    let count = 0, lengthReal = 0;
    const markedIdx = [];
    state.pages.forEach((page, i) => {
      const ann = (typeof getMergedAnnotationsForPage === 'function')
        ? getMergedAnnotationsForPage(page)
        : (page.annotations || makeAnnotations());
      let pageHas = false;
      (state.counters || []).forEach(c => {
        const ms = ann.counterMarkers?.[c.id] || [];
        ms.forEach(m => {
          count += (typeof getMultiplyZoneForPoint === 'function') ? getMultiplyZoneForPoint(ann, m) : 1;
          pageHas = true;
        });
      });
      (ann.quickLines || []).forEach(q => {
        lengthReal += (typeof getLineLengthFeetForTotals === 'function') ? getLineLengthFeetForTotals(q, i, false, ann) : 0;
        pageHas = true;
      });
      (ann.polylines || []).forEach(poly => {
        lengthReal += (typeof getLineLengthFeetForTotals === 'function') ? getLineLengthFeetForTotals(poly, i, true, ann) : 0;
        pageHas = true;
      });
      if (pageHas) markedIdx.push(i);
    });
    const scaleIdx = markedIdx.length ? markedIdx : state.pages.map((_, i) => i);
    return { count, lengthReal, scale: pickScaleForLineType(scaleIdx) };
  }
  function getFooterTotalsCached() {
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
    const lastLocalBackupAt = saveEngine.getLastLocalBackupAt();   // engine-owned (Stage 3)
    const modeEl = document.getElementById('statusMode');
    const coordsEl = document.getElementById('statusCoords');
    const dotEl = document.getElementById('statusBarDot');
    const squareEl = document.getElementById('statusBarSquare');
    const canvasLabelEl = document.getElementById('statusCanvasLabel');
    const pdfLabelEl = document.getElementById('statusPdfLabel');
    const pdfGroupEl = document.getElementById('statusPdfGroup');
    let mode;
    const cloudMode = SUPABASE_ENABLED && state.supabaseSession?.user;
    if (cloudMode) {
      if (pdfGroupEl) { pdfGroupEl.style.display = ''; }
      if (saveEngine.isSaveInProgress()) {
        if (dotEl) { dotEl.className = 'dot dot-yellow'; dotEl.title = 'Canvas sync: Uploading...'; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas Uploading...';
        mode = '';
      } else if (state.lastSavedAt && !saveEngine.getAutoSaveDirty()) {
        let canvasTitle = 'Canvas sync: Synced with Cloud';
        if (state.lastSavedAt) canvasTitle += '\nCloud: ' + formatSaveTime(state.lastSavedAt);
        if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + formatSaveTime(lastLocalBackupAt);
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
        if (state.lastSavedAt) canvasTitle += '\nCloud: ' + formatSaveTime(state.lastSavedAt);
        if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + formatSaveTime(lastLocalBackupAt);
        if (dotEl) { dotEl.className = 'dot dot-yellow'; dotEl.title = canvasTitle; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas Viewing (read-only)';
        mode = state.checkedOutEmail ? ('Viewing — ' + state.checkedOutEmail + ' is editing') : 'Viewing — Available (check out to edit)';
      } else {
        let canvasTitle = 'Canvas sync: Project not saved to cloud';
        if (state.lastSavedAt) canvasTitle += '\nCloud: ' + formatSaveTime(state.lastSavedAt);
        if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + formatSaveTime(lastLocalBackupAt);
        if (dotEl) { dotEl.className = 'dot dot-red'; dotEl.title = canvasTitle; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas';
        mode = '';
      }
      if (squareEl) {
        const pdfSynced = lastSaveIncludedPdf || !!state.pdfStoragePath;
        if (saveEngine.isSavePdfInProgress()) { squareEl.className = 'square square-yellow'; squareEl.title = 'PDF sync: Uploading PDF...'; }
        else if (pdfSynced) {
          let pdfTitle = 'PDF sync: Synced with Cloud';
          if (state.lastSavedAt) pdfTitle += '\nCloud: ' + formatSaveTime(state.lastSavedAt);
          if (lastLocalBackupAt) pdfTitle += '\nLocal: ' + formatSaveTime(lastLocalBackupAt);
          squareEl.className = 'square square-green'; squareEl.title = pdfTitle;
        } else if (!state.pages.length) { squareEl.className = 'square square-grey'; squareEl.title = 'PDF sync: No PDF in project'; }
        else {
          let pdfTitle = 'PDF sync: PDF not saved to cloud';
          if (lastLocalBackupAt) pdfTitle += '\nLocal: ' + formatSaveTime(lastLocalBackupAt);
          squareEl.className = 'square square-red'; squareEl.title = pdfTitle;
        }
      }
      if (pdfLabelEl) {
        const pdfSyncedLabel = lastSaveIncludedPdf || !!state.pdfStoragePath;
        if (saveEngine.isSavePdfInProgress()) pdfLabelEl.textContent = 'PDF Uploading...';
        else if (pdfSyncedLabel) pdfLabelEl.textContent = 'PDF Synced with Cloud';
        else if (!state.pages.length) pdfLabelEl.textContent = 'PDF - Upload PDF to start a project';
        else pdfLabelEl.textContent = 'PDF: Not saved to cloud';
      }
    } else {
      let canvasTitle = 'Canvas sync: Local only';
      if (lastLocalBackupAt) canvasTitle += '\nLocal: ' + formatSaveTime(lastLocalBackupAt);
      if (dotEl) { dotEl.className = 'dot dot-green'; dotEl.title = canvasTitle; }
      if (canvasLabelEl) canvasLabelEl.textContent = '';
      if (pdfGroupEl) pdfGroupEl.style.display = 'none';
      if (saveEngine.isSaveInProgress() && saveEngine.getSaveProgressMessage()) {
        mode = saveEngine.getSaveProgressMessage();
      } else {
        const projectSegment = state.currentProjectName || (state.pages.length ? 'Untitled' : '—');
        let lastSavedSegment = '—';
        if (state.lastSavedAt) {
          const d = new Date(state.lastSavedAt);
          const agoSec = (Date.now() - d.getTime()) / 1000;
          const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
          const agoStr = formatAgo(agoSec);
          lastSavedSegment = timeStr + ' | ' + agoStr;
        }
        mode = projectSegment + ' - ' + lastSavedSegment;
        let toolHint = '';
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
        const lenStr = formatFeet(t.lengthReal || 0, t.scale);
        totalsEl.textContent = '[' + countStr + ' | ' + lenStr + ']';
        totalsEl.title = countStr + ' counters | ' + lenStr + ' of lines';
        totalsEl.style.display = '';
      }
    }
  }

  function getCloudSaveSummary() {
    const cloudMode = SUPABASE_ENABLED && state.supabaseSession?.user;
    if (!cloudMode) {
      return {
        canvas: { label: 'Canvas', state: 'grey', status: 'Not signed in to cloud', clock: '', ago: '' },
        pdf:    { label: 'PDF',    state: 'grey', status: '',                       clock: '', ago: '' }
      };
    }
    const savedParts = formatSaveTimeParts(state.lastSavedAt);
    let canvas;
    if (saveEngine.isSaveInProgress()) {
      canvas = { label: 'Canvas', state: 'yellow', status: 'Uploading...', clock: '', ago: '' };
    } else if (state.lastSavedAt && !saveEngine.getAutoSaveDirty()) {
      canvas = { label: 'Canvas', state: 'green', status: 'Synced with cloud', clock: savedParts.clock, ago: savedParts.ago };
    } else if (!state.pages.length) {
      canvas = { label: 'Canvas', state: 'grey', status: 'No project', clock: '', ago: '' };
    } else if (state.isViewer) {
      canvas = { label: 'Canvas', state: 'yellow', status: 'Viewing (read-only)', clock: savedParts.clock, ago: savedParts.ago };
    } else {
      const status = saveEngine.wasLastCloudSaveAttemptFailed() ? 'Last sync failed' : 'Not saved to cloud';
      canvas = { label: 'Canvas', state: 'red', status, clock: savedParts.clock, ago: savedParts.ago };
    }
    let pdf;
    const pdfSynced = lastSaveIncludedPdf || !!state.pdfStoragePath;
    if (saveEngine.isSavePdfInProgress()) {
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
    const inModal = document.getElementById('saveStatusBtn');
    const header  = document.getElementById('saveStatusBtnHeader');
    const section = document.getElementById('settingsCheckoutSection');
    const sectionVisible = !!(section && section.style.display !== 'none');
    const user = state.supabaseSession?.user;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const syncAttention = !!(saveEngine.wasLastCloudSaveAttemptFailed() && saveEngine.getAutoSaveDirty());
    const attention = syncAttention || checkoutExpiredNeedsAttention;

    if (inModal) {
      const showModal = !!(sectionVisible && SUPABASE_ENABLED && state.currentProjectId && user);
      inModal.style.display = showModal ? '' : 'none';
      inModal.classList.toggle('save-status-bell-attention', showModal && attention);
      inModal.classList.toggle('save-status-bell-offline', showModal && offline);
    }

    if (header) {
      const showHeader = !!(SUPABASE_ENABLED && user);
      header.style.display = showHeader ? '' : 'none';
      header.classList.toggle('save-status-bell-attention', showHeader && attention);
      header.classList.toggle('save-status-bell-offline', showHeader && offline);
    }

    const title = offline
      ? 'Save status — offline (changes saved locally)'
      : attention
        ? (checkoutExpiredNeedsAttention ? 'Save status — checkout expired' : 'Save status — sync needs attention')
        : 'Save status';
    const aria = offline
      ? 'Save status, offline, changes saved locally'
      : attention
        ? (checkoutExpiredNeedsAttention ? 'Save status, checkout expired' : 'Save status, sync needs attention')
        : 'Save status';
    if (inModal) { inModal.title = title; inModal.setAttribute('aria-label', aria); }
    if (header)  { header.title  = title; header.setAttribute('aria-label',  aria); }
  }

  // The Save Status modal UI (renderSaveStatusModalContent, openSaveStatusModal,
  // escSaveStatusHtml, applySaveStatusSummaryBlock, and the #saveStatus* modal
  // handlers) moved to features/save-status.js (window.App registry); reached via
  // App.openSaveStatusModal / the bell buttons. The hot-path bell
  // (updateSaveStatusIndicator) and the save engine stay here; the modal reads
  // engine state via publish-only deps + the App.getSaveStatusLog() /
  // App.isCheckoutExpiredAttention() getter accessors.

  // SECTION: Coordinate Helpers
  function canvasPointFromEvent(e) {
    const el = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper');
    const rect = el ? el.getBoundingClientRect() : { left: 0, top: 0 };
    const c = getClientCoords(e);
    return { x: c.x - rect.left, y: c.y - rect.top };
  }

  // SECTION: PDF render bitmap cache
  // Small LRU of recently rendered page bitmaps so switching back to a recent
  // page (or to an idle-prefetched neighbor) blits in ~1 frame instead of
  // re-running a full pdf.js raster — the dominant page-switch cost on
  // vector-dense sheets. The key is SELF-VALIDATING: pdfPage proxy identity +
  // rotation + zoom + effDpr. That automatically invalidates on: page delete
  // (proxy never looked up again), prepare-pdf's pdfPage rebind (new proxy),
  // undo's in-place rotation write, wrapper resize (fitZoom yields a new
  // zoom), and any renderAreaSafety/caps change (new effDpr). Explicit clears
  // are hygiene only — they free memory when a document is torn down or the
  // device shows pressure.
  const PDF_BITMAP_CACHE_MAX = 4;                    // entries (fit-zoom pages: ~1-5MB each)
  const PDF_BITMAP_CACHE_AREA_FRAC = 0.15;           // of caps.maxArea × renderAreaSafety
  const PDF_BITMAP_CACHE_AREA_ABS = 5000000;         // px — absolute clamp so big-desktop probes can't balloon retention
  const pdfBitmapCache = [];                          // LRU: oldest first, [{pdfPage, rotation, zoom, effDpr, bitmap, w, h}]
  let pdfBitmapCacheGeneration = 0;                   // bumped on clear; async inserts self-discard if it moved
  const pdfBitmapCacheStats = { hits: 0, misses: 0, prefetched: 0 };
  function pdfBitmapCacheMaxArea() {
    return Math.min(PDF_BITMAP_CACHE_AREA_FRAC * getCanvasCaps().maxArea * renderAreaSafety, PDF_BITMAP_CACHE_AREA_ABS);
  }
  function pdfBitmapCacheGet(pdfPage, rotation, zoom, effDpr) {
    for (let i = pdfBitmapCache.length - 1; i >= 0; i--) {
      const e = pdfBitmapCache[i];
      if (e.pdfPage === pdfPage && e.rotation === rotation && Math.abs(e.zoom - zoom) < 1e-6 && e.effDpr === effDpr) {
        // LRU touch: move to the end (most recent).
        pdfBitmapCache.splice(i, 1);
        pdfBitmapCache.push(e);
        return e;
      }
    }
    return null;
  }
  // Latest entry for the page regardless of zoom/effDpr — the stale-blit
  // preview source when a switch lands at a zoom we haven't cached.
  function pdfBitmapCacheGetAnyZoom(pdfPage, rotation) {
    for (let i = pdfBitmapCache.length - 1; i >= 0; i--) {
      const e = pdfBitmapCache[i];
      if (e.pdfPage === pdfPage && e.rotation === rotation) return e;
    }
    return null;
  }
  function pdfBitmapCacheDrop(entry) {
    const i = pdfBitmapCache.indexOf(entry);
    if (i >= 0) pdfBitmapCache.splice(i, 1);
    try { entry.bitmap.close(); } catch (_) { /* already closed */ }
  }
  function pdfBitmapCachePut(entry) {
    // Replace any same-key entry (same page re-rendered, e.g. after a blit
    // read-back drop), then evict oldest past the cap. close() everywhere —
    // ImageBitmap backing stores must never wait for GC.
    for (let i = pdfBitmapCache.length - 1; i >= 0; i--) {
      const e = pdfBitmapCache[i];
      if (e.pdfPage === entry.pdfPage && e.rotation === entry.rotation && Math.abs(e.zoom - entry.zoom) < 1e-6 && e.effDpr === entry.effDpr) {
        pdfBitmapCache.splice(i, 1);
        try { e.bitmap.close(); } catch (_) { /* already closed */ }
      }
    }
    pdfBitmapCache.push(entry);
    while (pdfBitmapCache.length > PDF_BITMAP_CACHE_MAX) {
      const old = pdfBitmapCache.shift();
      try { old.bitmap.close(); } catch (_) { /* already closed */ }
    }
  }
  function clearPdfBitmapCache() {
    pdfBitmapCacheGeneration++;
    while (pdfBitmapCache.length) {
      const e = pdfBitmapCache.pop();
      try { e.bitmap.close(); } catch (_) { /* already closed */ }
    }
  }
  // Snapshot a just-rendered canvas into the cache. createImageBitmap copies
  // the pixels synchronously at call time (only delivery is async), so the
  // caller may free/reuse the source right after. The generation guard makes
  // a clear-between-snapshot-and-insert discard the late bitmap instead of
  // repopulating a torn-down cache.
  function pdfBitmapCacheCapture(sourceCanvas, key, { prefetch } = {}) {
    if (typeof createImageBitmap !== 'function') return;                 // old Safari: cache disabled, behavior as before
    if (sourceCanvas.width * sourceCanvas.height > pdfBitmapCacheMaxArea()) return;   // deep-zoom giants are never cached
    const gen = pdfBitmapCacheGeneration;
    const w = sourceCanvas.width, h = sourceCanvas.height;
    createImageBitmap(sourceCanvas).then((bitmap) => {
      if (gen !== pdfBitmapCacheGeneration) { try { bitmap.close(); } catch (_) {} return; }
      pdfBitmapCachePut({ pdfPage: key.pdfPage, rotation: key.rotation, zoom: key.zoom, effDpr: key.effDpr, bitmap, w, h });
      if (prefetch) pdfBitmapCacheStats.prefetched++;
    }).catch(() => { /* capture is best-effort; a miss just re-renders */ });
  }

  // --- Idle prefetch of adjacent pages ---
  // After a render settles, speculatively raster currentPage±1 at their
  // predicted fit zoom into the cache, so the common "flip to the next sheet"
  // is a blit. pdf.js executes operator lists in main-thread chunks, so a
  // prefetch must yield to ANY interaction: renderPdf's entry and the
  // wheel/touchstart/pointerdown listeners (bound in the Event Binding
  // section) all call cancelPdfBitmapPrefetch. One prefetch at a time; the
  // completion re-arms the timer for the other neighbor.
  let pdfPrefetchTimer = null;
  let pdfPrefetchTask = null;
  let pdfPrefetchScratch = null;    // dedicated — never pdfOffscreenCanvas
  function cancelPdfBitmapPrefetch() {
    if (pdfPrefetchTimer) { clearTimeout(pdfPrefetchTimer); pdfPrefetchTimer = null; }
    if (pdfPrefetchTask) { try { pdfPrefetchTask.cancel(); } catch (_) { /* settling */ } pdfPrefetchTask = null; }
  }
  function schedulePdfBitmapPrefetch() {
    if (pdfPrefetchTimer) clearTimeout(pdfPrefetchTimer);
    pdfPrefetchTimer = setTimeout(runPdfBitmapPrefetch, 250);
  }
  function predictedFitZoom(page) {
    const wrap = document.querySelector('.canvas-wrapper');
    if (!wrap || !page?.pdfPage) return null;
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    return Math.max(0.2, Math.min(getMaxZoom(), Math.min(r.width / vp.width, r.height / vp.height)));
  }
  function runPdfBitmapPrefetch() {
    pdfPrefetchTimer = null;
    if (typeof createImageBitmap !== 'function') return;
    if (document.hidden) return;
    if (renderAreaSafety < RENDER_AREA_SAFETY_MAX) return;   // device showed memory pressure: no speculation
    if (pdfRenderTask || pdfPrefetchTask) return;            // real render or a prefetch already in flight
    for (const idx of [state.currentPage + 1, state.currentPage - 1]) {
      const page = state.pages[idx];
      if (!page || !page.pdfPage) continue;
      const zoom = predictedFitZoom(page);
      if (zoom == null) continue;
      const eff = effectiveDpr(page, zoom);
      const rot = page.rotation ?? 0;
      if (pdfBitmapCacheGet(page.pdfPage, rot, zoom, eff)) continue;   // already cached
      const viewport = page.pdfPage.getViewport({ scale: zoom * eff, rotation: rot });
      if (viewport.width * viewport.height > pdfBitmapCacheMaxArea()) continue;
      if (!pdfPrefetchScratch) pdfPrefetchScratch = document.createElement('canvas');
      pdfPrefetchScratch.width = viewport.width;
      pdfPrefetchScratch.height = viewport.height;
      const key = { pdfPage: page.pdfPage, rotation: rot, zoom, effDpr: eff };
      const task = page.pdfPage.render({ canvasContext: pdfPrefetchScratch.getContext('2d'), viewport });
      pdfPrefetchTask = task;
      task.promise.then(() => {
        if (pdfPrefetchTask === task) pdfPrefetchTask = null;
        // createImageBitmap copies synchronously at call time, so the scratch
        // can be freed immediately after the capture call.
        pdfBitmapCacheCapture(pdfPrefetchScratch, key, { prefetch: true });
        pdfPrefetchScratch.width = 0;
        pdfPrefetchScratch.height = 0;
        schedulePdfBitmapPrefetch();   // other neighbor on the next idle slot
      }).catch((err) => {
        if (pdfPrefetchTask === task) pdfPrefetchTask = null;
        pdfPrefetchScratch.width = 0;
        pdfPrefetchScratch.height = 0;
        if (err && err.name !== 'RenderingCancelledException') { /* speculative: swallow */ }
      });
      return;   // one at a time
    }
  }

  let pdfRenderTask = null;
  let pdfRenderCancelled = false;   // guards against double-cancel on one task (pdf.js re-invokes callbacks)
  let pdfOffscreenCanvas = null;
  let pdfRenderId = 0;
  let pdfRenderPending = false;
  // What the visible pdfCanvas currently shows (page identity + rotation;
  // lastRenderedZoom below carries the zoom). Stamped at every pdfCanvas
  // paint so the stale-blit preview can tell a genuinely stale canvas (page
  // flip / rotate / zoom commit) from a same-target re-render — an
  // annotation-only edit re-raster must NOT repaint correct pixels with an
  // upscaled old bitmap (the "blurry after placing drops" bug, cddb807).
  let lastPaintedPdfPage = null;
  let lastPaintedRot = 0;
  // SECTION: PDF Rendering
  function renderPdf() {
    cancelPdfBitmapPrefetch();   // real rendering always preempts speculation
    const page = state.pages[state.currentPage];
    if (!page || !page.pdfPage) {
      pdfCanvas.width = 0;
      pdfCanvas.height = 0;
      pdfCanvas.style.width = '0';
      pdfCanvas.style.height = '0';
      annCanvas.width = 0;
      annCanvas.height = 0;
      annCanvas.style.width = '0';
      annCanvas.style.height = '0';
      lastPaintedPdfPage = null;
      return;
    }
    if (pdfRenderTask) {
      pdfRenderPending = true;
      // Cancel the in-flight raster so a rapid page flip skips straight to the
      // latest target instead of serializing full renders of every
      // intermediate page. The rejection lands in the catch below (which
      // swallows RenderingCancelledException) and re-drives via the pending
      // flag. Guarded: pdf.js re-invokes internal callbacks if cancel() is
      // called repeatedly on one task (key-autorepeat flips).
      if (!pdfRenderCancelled) {
        pdfRenderCancelled = true;
        try { pdfRenderTask.cancel(); } catch (_) { /* already settling */ }
      }
      return;
    }
    pdfRenderPending = false;
    pdfRenderId++;
    const thisRenderId = pdfRenderId;
    const eff = effectiveDpr(page, state.zoom);   // clamped dpr so the buffer fits the canvas cap
    currentEffDpr = eff;
    const scale = state.zoom * eff;
    // Capture the cache-key tuple NOW: rotation/pdfPage/zoom can all change
    // while the async raster runs (undo rewrites rotation in place,
    // prepare-pdf rebinds pdfPage, queued interactions move zoom/page). The
    // completion callback must only trust these captured values — reading
    // state.* at completion time would poison the cache after a cancel-lost
    // race (task settles before cancel() lands).
    const keyPdfPage = page.pdfPage;
    const keyRot = page.rotation ?? 0;
    const keyZoom = state.zoom;
    const viewport = keyPdfPage.getViewport({ scale, rotation: keyRot });

    // Cache hit: blit the retained bitmap — no pdf.js, fully synchronous.
    const cached = pdfBitmapCacheGet(keyPdfPage, keyRot, keyZoom, eff);
    if (cached) {
      lastRenderedZoom = keyZoom;
      lastPaintedPdfPage = keyPdfPage;
      lastPaintedRot = keyRot;
      updateContainerTransform();
      pdfCanvas.width = cached.w;
      pdfCanvas.height = cached.h;
      pdfCanvas.style.width = cached.w / eff + 'px';
      pdfCanvas.style.height = cached.h / eff + 'px';
      pdfCanvas.getContext('2d').drawImage(cached.bitmap, 0, 0);
      // A blit that reads back blank is the same memory-pressure signal as the
      // full path's guard: drop the entry, free the whole cache, ratchet, and
      // re-enter for a fresh (smaller) render. Mirrors the guard below.
      if (!canvasCornerReadsBack(pdfCanvas)) {
        pdfBitmapCacheDrop(cached);
        clearPdfBitmapCache();
        if (renderAreaSafety > RENDER_AREA_SAFETY_MIN) {
          renderAreaSafety = Math.max(RENDER_AREA_SAFETY_MIN, renderAreaSafety * RENDER_AREA_SAFETY_STEP);
        }
        renderPdf();   // re-entrant: no task in flight, cache now empty -> full render path
        return;
      }
      pdfBitmapCacheStats.hits++;
      renderAnnotations();
      schedulePdfBitmapPrefetch();
      if (pdfRenderPending) renderPdf();
      return;
    }
    pdfBitmapCacheStats.misses++;

    // Stale-blit preview: we have this page cached at a different zoom/effDpr
    // (e.g. the window was resized since the visit). Paint it scaled NOW so a
    // switch to a dense sheet shows the right page instantly instead of the
    // previous page for the whole raster; the async render below replaces it
    // crisp. Gated on the canvas being GENUINELY stale (page flip / rotate /
    // zoom commit): a same-target re-render — e.g. an annotation edit that
    // routes through renderPdf — must keep the correct pixels it already
    // shows instead of downgrading them to an upscaled old bitmap for the
    // whole raster (the "blurry after placing drops / deleting lines" bug).
    const canvasIsCurrent = pdfCanvas.width > 0 &&
      lastPaintedPdfPage === keyPdfPage &&
      lastPaintedRot === keyRot &&
      lastRenderedZoom === keyZoom;
    const preview = canvasIsCurrent ? null : pdfBitmapCacheGetAnyZoom(keyPdfPage, keyRot);
    if (preview) {
      lastRenderedZoom = keyZoom;
      lastPaintedPdfPage = keyPdfPage;
      lastPaintedRot = keyRot;
      updateContainerTransform();
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      pdfCanvas.style.width = viewport.width / eff + 'px';
      pdfCanvas.style.height = viewport.height / eff + 'px';
      const pctx = pdfCanvas.getContext('2d');
      pctx.drawImage(preview.bitmap, 0, 0, preview.w, preview.h, 0, 0, viewport.width, viewport.height);
      renderAnnotations();
    }

    if (!pdfOffscreenCanvas) pdfOffscreenCanvas = document.createElement('canvas');
    pdfOffscreenCanvas.width = viewport.width;
    pdfOffscreenCanvas.height = viewport.height;
    pdfRenderTask = keyPdfPage.render({ canvasContext: pdfOffscreenCanvas.getContext('2d'), viewport });
    pdfRenderCancelled = false;
    pdfRenderTask.promise.then(() => {
      pdfRenderTask = null;
      if (thisRenderId !== pdfRenderId) {
        if (pdfRenderPending) renderPdf();
        return;
      }
      lastRenderedZoom = keyZoom;   // captured, not state.zoom: a mid-gesture completion must not make commitWheelZoom skip its crisp re-render
      lastPaintedPdfPage = keyPdfPage;
      lastPaintedRot = keyRot;
      updateContainerTransform();
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      pdfCanvas.style.width = viewport.width / eff + 'px';     // = pageW*zoom CSS px (clamp-independent)
      pdfCanvas.style.height = viewport.height / eff + 'px';
      pdfCanvas.getContext('2d').drawImage(pdfOffscreenCanvas, 0, 0);

      // Read-back guard: did pdfCanvas actually allocate, or silently paint blank under
      // memory pressure? If blank and we still have headroom, ratchet the shared safety
      // knob down and re-render smaller. Both renderPdf and renderAnnotations re-read the
      // lowered knob via effectiveDpr, so their buffers stay the same size. Bounded by
      // RENDER_AREA_SAFETY_MIN (~3 steps) so it never spins. A silent blank becomes a
      // softer-but-visible render instead of vanished counts.
      if (!canvasCornerReadsBack(pdfCanvas) && renderAreaSafety > RENDER_AREA_SAFETY_MIN) {
        const prevSafety = renderAreaSafety;
        renderAreaSafety = Math.max(RENDER_AREA_SAFETY_MIN, renderAreaSafety * RENDER_AREA_SAFETY_STEP);
        try {
          pushSaveEvent('canvas_render_blank', 'PDF canvas read back blank — reduced render area', JSON.stringify({
            devicePixelRatio: window.devicePixelRatio || 1,
            requestedW: viewport.width, requestedH: viewport.height,
            actualW: pdfCanvas.width, actualH: pdfCanvas.height,
            zoom: state.zoom, caps: getCanvasCaps(),
            prevSafety, newSafety: renderAreaSafety
          }));
        } catch (_) { /* diagnostics are best-effort */ }
        // Free the offscreen AND the bitmap cache before retrying so the
        // smaller re-render has max headroom — retained bitmaps are the first
        // thing to give back under memory pressure.
        clearPdfBitmapCache();
        pdfOffscreenCanvas.width = 0;
        pdfOffscreenCanvas.height = 0;
        renderPdf();   // re-entrant: pdfRenderTask is null here, so this proceeds
        return;
      }

      // Cache the fresh raster (guard passed — never a blank). Snapshot from
      // the offscreen before it's freed: createImageBitmap copies pixels
      // synchronously at call time, and the offscreen (unlike pdfCanvas)
      // doesn't carry the guard's scratch corner pixel. Entry key is the
      // CAPTURED tuple — see the capture note at the top of this function.
      pdfBitmapCacheCapture(pdfOffscreenCanvas, { pdfPage: keyPdfPage, rotation: keyRot, zoom: keyZoom, effDpr: eff });

      // Success: drop the offscreen backing store (cuts peak coexisting canvases from 3
      // to 2 — the root cause of the overlay blanking), then paint the overlay.
      pdfOffscreenCanvas.width = 0;
      pdfOffscreenCanvas.height = 0;
      renderAnnotations();
      schedulePdfBitmapPrefetch();
      if (pdfRenderPending) renderPdf();
    }).catch(err => {
      pdfRenderTask = null;
      if (err && err.name !== 'RenderingCancelledException') console.error(err);
      if (pdfRenderPending) renderPdf();
    });
  }

  // Hide-marks toggle (header eye button) — blanks the annotation overlay so a
  // viewer can read the bare drawing, then bring the marks back. Visual only:
  // exports/reports use renderAnnotationsToContext and are unaffected. The flag
  // persists across pages/zoom (every render checks it) and, for view-link
  // sessions, across reloads (keyed to the view token).
  function toggleHideMarks() {
    state.hideMarks = !state.hideMarks;
    if (state.viewToken) {
      try { localStorage.setItem('view:hideMarks:' + state.viewToken, state.hideMarks ? '1' : '0'); } catch (_) { /* storage may be unavailable */ }
    }
    renderAnnotations();
    updateHideMarksButton();
  }
  function updateHideMarksButton() {
    const btn = document.getElementById('hideMarksBtn');
    if (!btn) return;
    btn.style.display = state.pages.length ? '' : 'none';
    const hidden = !!state.hideMarks;
    btn.classList.toggle('active', hidden);
    btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    const label = hidden ? 'Show marks' : 'Hide marks';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    const iconShow = document.getElementById('hideMarksIconShow');
    const iconHide = document.getElementById('hideMarksIconHide');
    if (iconShow) iconShow.style.display = hidden ? 'none' : '';
    if (iconHide) iconHide.style.display = hidden ? '' : 'none';
  }

  function drawDropMarker(ctx, p, s, color, style) {
    const lwOut = Math.max(2, Math.round(s * 0.4));
    const lwIn = Math.max(1, Math.round(s * 0.2));
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = lwOut;
    ctx.fillStyle = color || '#4a9eff';
    ctx.beginPath();
    switch (style || 'circle') {
      case 'circle':
        ctx.arc(p.x, p.y, s * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = color || '#4a9eff';
        ctx.lineWidth = lwIn;
        ctx.stroke();
        break;
      case 'plus':
        ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
        ctx.stroke();
        ctx.strokeStyle = color || '#4a9eff';
        ctx.lineWidth = lwIn;
        ctx.stroke();
        break;
      case 'diamond':
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y);
        ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y); ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = color || '#4a9eff';
        ctx.lineWidth = lwIn;
        ctx.stroke();
        break;
      case 'triangle':
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y + s);
        ctx.lineTo(p.x - s, p.y + s); ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = color || '#4a9eff';
        ctx.lineWidth = lwIn;
        ctx.stroke();
        break;
      default:
        ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s);
        ctx.moveTo(p.x - s, p.y + s); ctx.lineTo(p.x + s, p.y - s);
        ctx.stroke();
        ctx.strokeStyle = color || '#4a9eff';
        ctx.lineWidth = lwIn;
        ctx.stroke();
    }
    ctx.restore();
  }

  // Room Sizer boxes, shared by the live overlay and the export path (the two
  // callers differ only in their PDF->canvas mapper and label scale factor).
  // Boxes render in their room's color with a name + W×L×H label; a box whose
  // page (or containing scale zone) has no scale gets an explicit "no scale"
  // label instead of silently wrong numbers.
  function drawRoomBoxesToContext(ctx, ann, pageIdx, tcFn, fontScale) {
    (ann.roomBoxes || []).forEach(b => {
      const room = (state.rooms || []).find(r => r.id === b.roomId);
      const color = room?.color || '#47c88e';
      const minX = Math.min(b.x1, b.x2), maxX = Math.max(b.x1, b.x2);
      const minY = Math.min(b.y1, b.y2), maxY = Math.max(b.y1, b.y2);
      const tl = tcFn({ x: minX, y: minY }), br = tcFn({ x: maxX, y: maxY });
      ctx.globalAlpha = 0.12; ctx.fillStyle = color;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      const boxW = br.x - tl.x, boxH = br.y - tl.y;
      if (boxW < 40 || boxH < 24) return;
      const effScale = getEffectiveScaleForLine(ann, b, false, pageIdx);
      const dims = roomBoxDimsFeet(b, effScale);
      const nameLabel = room?.name || 'Room';
      // Dims read L × W (× H): longer side first, matching the modal's table,
      // with small (L)/(W)/(H) tags centered under their segments.
      let segs = null;
      let dimsLabel = 'no scale';
      if (dims) {
        segs = [
          { text: formatFeetInchesFromVal(Math.max(dims.widthFt, dims.lengthFt), 'ft'), tag: '(L)' },
          { text: formatFeetInchesFromVal(Math.min(dims.widthFt, dims.lengthFt), 'ft'), tag: '(W)' }
        ];
        if (dims.heightFt > 0) segs.push({ text: formatFeetInchesFromVal(dims.heightFt, 'ft'), tag: '(H)' });
        dimsLabel = segs.map(s => s.text).join(' × ');
      }
      const nameSize = 13 * fontScale, dimsSize = 11 * fontScale, tagSize = 8.5 * fontScale;
      const center = tcFn({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
      ctx.textAlign = 'center';
      ctx.font = '600 ' + nameSize + 'px DM Sans';
      const nameW = ctx.measureText(nameLabel).width;
      ctx.font = dimsSize + 'px DM Sans';
      const dimsW = ctx.measureText(dimsLabel).width;
      const sepW = ctx.measureText(' × ').width;
      const pad = 4 * fontScale;
      const blockW = Math.max(nameW, dimsW) + pad * 2;
      const blockH = nameSize + dimsSize + (segs ? tagSize + pad : 0) + pad * 3;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(center.x - blockW / 2, center.y - blockH / 2, blockW, blockH);
      ctx.fillStyle = '#222';
      ctx.textBaseline = 'top';
      ctx.font = '600 ' + nameSize + 'px DM Sans';
      ctx.fillText(nameLabel, center.x, center.y - blockH / 2 + pad);
      const dimsY = center.y - blockH / 2 + pad * 2 + nameSize;
      ctx.font = dimsSize + 'px DM Sans';
      ctx.fillText(dimsLabel, center.x, dimsY);
      if (segs) {
        const tagY = dimsY + dimsSize + pad / 2;
        ctx.fillStyle = '#8a8a8a';
        ctx.font = tagSize + 'px DM Sans';
        let segX = center.x - dimsW / 2;
        segs.forEach(seg => {
          ctx.font = dimsSize + 'px DM Sans';
          const segW = ctx.measureText(seg.text).width;
          ctx.font = tagSize + 'px DM Sans';
          ctx.fillText(seg.tag, segX + segW / 2, tagY);
          segX += segW + sepW;
        });
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    });
  }

  function renderAnnotations() {
    const page = state.pages[state.currentPage];
    if (!page) return;
    currentEffDpr = effectiveDpr(page, state.zoom);   // match the (possibly clamped) pdfCanvas buffer
    annCanvas.width = pdfCanvas.width;
    annCanvas.height = pdfCanvas.height;
    annCanvas.style.width = pdfCanvas.style.width;
    annCanvas.style.height = pdfCanvas.style.height;
    const ctx = annCanvas.getContext('2d');
    const z = state.zoom;
    ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
    // Hide-marks mode: the overlay is sized + cleared (so the bare PDF shows
    // through) but nothing is painted on it. Toggle via the header eye button.
    if (state.hideMarks) return;
    // Show-all-canvases peek (the opposite of hide-marks): draw every layer of
    // the page merged instead of just the active canvas. Purely visual — hit
    // testing / editing / exports still target the active canvas only.
    const ann = state.showAllCanvases ? getMergedAnnotationsForPage(page) : getActiveAnnotations(page);
    if (state.scalePointA) {
      const a = toCanvas(state.scalePointA), b = toCanvas(state.scalePointB || state.scalePointA);
      ctx.strokeStyle = '#e8c547'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      [state.scalePointA, state.scalePointB].filter(Boolean).forEach(pt => {
        const p = toCanvas(pt);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(24 / 640, 24 / 640);
        ctx.translate(-320, -320);
        ctx.fillStyle = '#e8c547';
        ctx.fill(new Path2D(SCALE_CROSSHAIR_PATH));
        ctx.restore();
      });
    } else if (state.showScaleRefLine && page.scale?.refLine) {
      // Persistent scale reference line: the segment used to set this page's two-point
      // scale, kept visible so the measured reference is always known. Dimmed + dashed
      // so it reads as a reference, not a takeoff line. Suppressed while re-picking points.
      const rl = page.scale.refLine;
      const a = toCanvas({ x: rl.x1, y: rl.y1 }), b = toCanvas({ x: rl.x2, y: rl.y2 });
      ctx.save();
      ctx.strokeStyle = '#e8c547'; ctx.globalAlpha = 0.65; ctx.lineWidth = 1.5 * currentEffDpr; ctx.setLineDash([7 * currentEffDpr, 5 * currentEffDpr]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      [{ x: rl.x1, y: rl.y1 }, { x: rl.x2, y: rl.y2 }].forEach(pt => {
        const p = toCanvas(pt);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(18 / 640, 18 / 640);
        ctx.translate(-320, -320);
        ctx.fillStyle = '#e8c547';
        ctx.fill(new Path2D(SCALE_CROSSHAIR_PATH));
        ctx.restore();
      });
      // Measured length label near the midpoint (e.g. "10 ft").
      if (page.scale.pixelsPerUnit) {
        const lenReal = ptDist({ x: rl.x1, y: rl.y1 }, { x: rl.x2, y: rl.y2 }) / page.scale.pixelsPerUnit;
        const label = formatDistFeetInchesFromReal(lenReal, page.scale);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.globalAlpha = 1;
        ctx.font = (11 * currentEffDpr) + 'px DM Sans, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(label).width, padX = 5 * currentEffDpr, h = 16 * currentEffDpr;
        ctx.fillStyle = 'rgba(20,20,20,0.82)';
        ctx.fillRect(mid.x - tw / 2 - padX, mid.y - h / 2 - 9 * currentEffDpr, tw + padX * 2, h);
        ctx.fillStyle = '#e8c547';
        ctx.fillText(label, mid.x, mid.y - 9 * currentEffDpr + 1);
      }
      ctx.restore();
    } else if (state.showScaleRefLine && page.scale?.pixelsPerUnit && !page.scale.refLine && page.pdfPage) {
      // Synthetic verification scale bar for preset/custom scales (which have no two-point
      // refLine): a dashed segment of a round real length near the page's bottom-left, so the
      // user can eyeball the chosen scale against a known dimension — the safety net for the
      // sheet-size correction. Same dashed-yellow look as the refLine above; same toggle.
      let vp; try { vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 }); } catch (_) { vp = null; }
      if (vp) {
        const ppu = page.scale.pixelsPerUnit;
        const targetReal = (vp.width * 0.2) / ppu;   // aim ~20% of page width
        const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
        let nice = NICE[0];
        for (const n of NICE) { if (n <= targetReal) nice = n; }
        const barPts = nice * ppu;
        if (barPts > 1 && barPts < vp.width * 0.85) {
          const x1 = vp.width * 0.06, y1 = vp.height * 0.94, x2 = x1 + barPts, y2 = y1;
          const a = toCanvas({ x: x1, y: y1 }), b = toCanvas({ x: x2, y: y2 });
          ctx.save();
          ctx.strokeStyle = '#e8c547'; ctx.globalAlpha = 0.65; ctx.lineWidth = 1.5 * currentEffDpr; ctx.setLineDash([7 * currentEffDpr, 5 * currentEffDpr]);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.setLineDash([]);
          [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach(pt => {
            const p = toCanvas(pt);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(18 / 640, 18 / 640);
            ctx.translate(-320, -320);
            ctx.fillStyle = '#e8c547';
            ctx.fill(new Path2D(SCALE_CROSSHAIR_PATH));
            ctx.restore();
          });
          const label = formatDistFeetInchesFromReal(nice, page.scale);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          ctx.globalAlpha = 1;
          ctx.font = (11 * currentEffDpr) + 'px DM Sans, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const tw = ctx.measureText(label).width, padX = 5 * currentEffDpr, h = 16 * currentEffDpr;
          ctx.fillStyle = 'rgba(20,20,20,0.82)';
          ctx.fillRect(mid.x - tw / 2 - padX, mid.y - h / 2 - 9 * currentEffDpr, tw + padX * 2, h);
          ctx.fillStyle = '#e8c547';
          ctx.fillText(label, mid.x, mid.y - 9 * currentEffDpr + 1);
          ctx.restore();
        }
      }
    }
    // Live Measure preview (mobile loupe aim + desktop hover): a dashed rubber band
    // to the moving second point, and the first-point crosshair while aiming. Scoped
    // to MEASURE so the Scale tool's appearance is unchanged.
    if (state.tool === TOOL.MEASURE) {
      const drawScaleCrosshairGlyph = (ptPdf) => {
        const p = toCanvas(ptPdf);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(24 / 640, 24 / 640);
        ctx.translate(-320, -320);
        ctx.fillStyle = '#e8c547';
        ctx.fill(new Path2D(SCALE_CROSSHAIR_PATH));
        ctx.restore();
      };
      const moving = state.aiming ? state.aimPoint : state.mousePos;
      if (state.scaleMode === SCALE_MODES.POINT_B && state.scalePointA && !state.scalePointB && moving) {
        const a = toCanvas(state.scalePointA), m = toCanvas(moving);
        ctx.save();
        ctx.strokeStyle = '#e8c547'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(m.x, m.y); ctx.stroke();
        ctx.restore();
        drawScaleCrosshairGlyph(moving);
      } else if (state.aiming && state.aimPoint && !state.scalePointA) {
        drawScaleCrosshairGlyph(state.aimPoint);
      }
    }
    // Generic aim crosshair for the other aiming flows (Line / Polyline placement,
    // and vertex drag in Part B) — the loupe shows the magnified target; this marks
    // it on the page too. Measure draws its own yellow crosshair above.
    if (state.aiming && state.aimPoint && state.tool !== TOOL.MEASURE) {
      const m = toCanvas(state.aimPoint), r = 10 * currentEffDpr;
      ctx.save();
      ctx.strokeStyle = '#4a9eff'; ctx.lineWidth = 1.5 * currentEffDpr; ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(m.x - r, m.y); ctx.lineTo(m.x + r, m.y);
      ctx.moveTo(m.x, m.y - r); ctx.lineTo(m.x, m.y + r);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(m.x, m.y, 3 * currentEffDpr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const lts = state.lineTypeSettings || { opacity: 1, lineSize: 2, dropXSize: 10, dropIconStyle: 'circle', parallelEndsSize: 10, lengthLabelSize: 12, snapToHorizontalVertical: false, showOnlyLineTypesOnCurrentPage: false };
    const lw = lts.lineSize || 2;
    const lo = lts.opacity != null ? lts.opacity : 1;
    const dropS = lts.dropXSize ?? 10;
    const dropStyle = lts.dropIconStyle ?? 'circle';
    const sel = state.selectedLineId && state.currentPage === state.selectedLinePageIdx;
    (ann.quickLines || []).forEach(q => {
      const aPdf = { x: q.x1, y: q.y1 }, bPdf = { x: q.x2, y: q.y2 };
      const a = toCanvas(aPdf), b = toCanvas(bPdf);
      const lt = (state.lineTypes || []).find(l => l.id === q.lineTypeId);
      const isCurved = lt && lt.curveStyle === 'arc';
      const ctrlPdf = isCurved ? getQuadraticBezierControlPoint(aPdf, bPdf, 1) : null;
      const ctrl = ctrlPdf ? toCanvas(ctrlPdf) : null;
      const isSelected = sel && !state.selectedLineIsPoly && state.selectedLineId === q.id;
      ctx.strokeStyle = q.color || '#4a9eff'; ctx.lineWidth = isSelected ? lw * 2 : lw; ctx.globalAlpha = lo;
      if (isSelected) { ctx.shadowBlur = 8; ctx.shadowColor = q.color || '#4a9eff'; }
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      if (isCurved && ctrl) ctx.quadraticCurveTo(ctrl.x, ctrl.y, b.x, b.y);
      else ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (isSelected) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
      ctx.globalAlpha = 1;
      if (state.showGroupColors && (q.group || null)) {
        const midPdf = isCurved && ctrlPdf ? quadraticBezierPoint(0.5, aPdf, ctrlPdf, bPdf) : { x: (aPdf.x + bPdf.x) / 2, y: (aPdf.y + bPdf.y) / 2 };
        const mid = toCanvas(midPdf);
        const groupColor = getGroupColor(q.group);
        ctx.fillStyle = groupColor;
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const drawDrop = (p) => drawDropMarker(ctx, p, dropS, q.color || '#4a9eff', dropStyle);
      if ((q.startDrop || 0) > 0) drawDrop(a);
      if ((q.endDrop || 0) > 0) drawDrop(b);
      if (q.showLength) {
        const tickLen = lts.parallelEndsSize ?? 10;
        const drawPerpTick = (endPdf, tangentPdf) => {
          const dx = tangentPdf.x, dy = tangentPdf.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len, perpY = dx / len;
          const half = tickLen / 2;
          const p1 = toCanvas({ x: endPdf.x - perpX * half, y: endPdf.y - perpY * half });
          const p2 = toCanvas({ x: endPdf.x + perpX * half, y: endPdf.y + perpY * half });
          ctx.strokeStyle = q.color || '#4a9eff';
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        };
        if (isCurved && ctrlPdf) {
          drawPerpTick(aPdf, { x: ctrlPdf.x - aPdf.x, y: ctrlPdf.y - aPdf.y });
          drawPerpTick(bPdf, { x: bPdf.x - ctrlPdf.x, y: bPdf.y - ctrlPdf.y });
        } else {
          drawPerpTick(aPdf, { x: bPdf.x - aPdf.x, y: bPdf.y - aPdf.y });
          drawPerpTick(bPdf, { x: bPdf.x - aPdf.x, y: bPdf.y - aPdf.y });
        }
        const midPdf = isCurved && ctrlPdf ? quadraticBezierPoint(0.5, aPdf, ctrlPdf, bPdf) : { x: (aPdf.x + bPdf.x) / 2, y: (aPdf.y + bPdf.y) / 2 };
        const mid = toCanvas(midPdf);
        const effScale = getEffectiveScaleForLine(ann, q, false, state.currentPage);
        const realLen = getLineRealWorldLength(q, state.currentPage, false, ann);
        const label = formatDistFeetInchesFromReal(realLen, effScale);
        const fontSize = (lts.lengthLabelSize ?? 12) * z * currentEffDpr;
        ctx.font = fontSize + 'px DM Sans';
        const tw = ctx.measureText(label).width;
        const pad = 4;
        const orient = lts.orientLengthWithLine !== false;
        let angle = Math.atan2(bPdf.y - aPdf.y, bPdf.x - aPdf.x);
        if (orient && (angle > Math.PI / 2 || angle < -Math.PI / 2)) angle += Math.PI;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (orient) {
          ctx.save();
          ctx.translate(mid.x, mid.y);
          ctx.rotate(angle);
          ctx.fillRect(-tw / 2 - pad, -fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
          ctx.fillStyle = '#000';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else {
          ctx.fillRect(mid.x - tw / 2 - pad, mid.y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
          ctx.fillStyle = '#000';
          ctx.fillText(label, mid.x, mid.y);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    (ann.polylines || []).forEach(poly => {
      const pts = poly.points || [];
      if (pts.length < 2) return;
      const isSelected = sel && state.selectedLineIsPoly && state.selectedLineId === poly.id;
      ctx.strokeStyle = poly.color || '#4a9eff'; ctx.lineWidth = isSelected ? lw * 2 : lw; ctx.globalAlpha = lo;
      if (isSelected) { ctx.shadowBlur = 8; ctx.shadowColor = poly.color || '#4a9eff'; }
      ctx.beginPath();
      const p0 = toCanvas(pts[0]); ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) { const p = toCanvas(pts[i]); ctx.lineTo(p.x, p.y); }
      if (poly.closed) ctx.closePath();
      ctx.stroke();
      if (isSelected) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
      ctx.globalAlpha = 1;
      if (state.showGroupColors && (poly.group || null)) {
        const pts = poly.points || [];
        const idx = Math.floor(pts.length / 2);
        const midPdf = pts[idx] || pts[0];
        const mid = toCanvas(midPdf);
        const groupColor = getGroupColor(poly.group);
        ctx.fillStyle = groupColor;
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const drawDrop = (p) => drawDropMarker(ctx, p, dropS, poly.color || '#4a9eff', dropStyle);
      if ((poly.startDrop || 0) > 0 && pts.length > 0) drawDrop(toCanvas(pts[0]));
      if ((poly.endDrop || 0) > 0 && pts.length > 0) drawDrop(toCanvas(pts[pts.length - 1]));
      if (poly.showLength && pts.length >= 2) {
        const tickLen = lts.parallelEndsSize ?? 10;
        const drawPerpTick = (endPdf, tangentPdf) => {
          const dx = tangentPdf.x, dy = tangentPdf.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len, perpY = dx / len;
          const half = tickLen / 2;
          const p1 = toCanvas({ x: endPdf.x - perpX * half, y: endPdf.y - perpY * half });
          const p2 = toCanvas({ x: endPdf.x + perpX * half, y: endPdf.y + perpY * half });
          ctx.strokeStyle = poly.color || '#4a9eff';
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        };
        drawPerpTick(pts[0], { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y });
        if (pts.length > 2) drawPerpTick(pts[pts.length - 1], { x: pts[pts.length - 1].x - pts[pts.length - 2].x, y: pts[pts.length - 1].y - pts[pts.length - 2].y });
        const totalLen = polylineDistance(pts, poly.closed);
        let acc = 0;
        let midPdf = pts[0];
        let segAngle = 0;
        const halfLen = totalLen / 2;
        for (let i = 0; i < pts.length - 1; i++) {
          const segLen = ptDist(pts[i], pts[i + 1]);
          if (acc + segLen >= halfLen) {
            const t = (halfLen - acc) / segLen;
            midPdf = { x: pts[i].x + t * (pts[i + 1].x - pts[i].x), y: pts[i].y + t * (pts[i + 1].y - pts[i].y) };
            segAngle = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
            break;
          }
          acc += segLen;
        }
        if (poly.closed && pts.length >= 3) {
          const segLen = ptDist(pts[pts.length - 1], pts[0]);
          if (acc + segLen >= halfLen) {
            const t = (halfLen - acc) / segLen;
            midPdf = { x: pts[pts.length - 1].x + t * (pts[0].x - pts[pts.length - 1].x), y: pts[pts.length - 1].y + t * (pts[0].y - pts[pts.length - 1].y) };
            segAngle = Math.atan2(pts[0].y - pts[pts.length - 1].y, pts[0].x - pts[pts.length - 1].x);
          }
        }
        const mid = toCanvas(midPdf);
        const effScale = getEffectiveScaleForLine(ann, poly, true, state.currentPage);
        const realLen = getLineRealWorldLength(poly, state.currentPage, true, ann);
        const label = formatDistFeetInchesFromReal(realLen, effScale);
        const fontSize = (lts.lengthLabelSize ?? 12) * z * currentEffDpr;
        ctx.font = fontSize + 'px DM Sans';
        const tw = ctx.measureText(label).width;
        const pad = 4;
        const orient = lts.orientLengthWithLine !== false;
        let angle = segAngle;
        if (orient && (angle > Math.PI / 2 || angle < -Math.PI / 2)) angle += Math.PI;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (orient) {
          ctx.save();
          ctx.translate(mid.x, mid.y);
          ctx.rotate(angle);
          ctx.fillRect(-tw / 2 - pad, -fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
          ctx.fillStyle = '#000';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else {
          ctx.fillRect(mid.x - tw / 2 - pad, mid.y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
          ctx.fillStyle = '#000';
          ctx.fillText(label, mid.x, mid.y);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    (ann.highlights || []).forEach(h => {
      const minX = Math.min(h.x1, h.x2), maxX = Math.max(h.x1, h.x2);
      const minY = Math.min(h.y1, h.y2), maxY = Math.max(h.y1, h.y2);
      const tl = toCanvas({ x: minX, y: minY }), br = toCanvas({ x: maxX, y: maxY });
      ctx.fillStyle = h.color || '#e8c547'; ctx.globalAlpha = h.opacity != null ? h.opacity : 0.25;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1;
    });
    (ann.multiplyZones || []).forEach((zone, zi) => {
      const minX = Math.min(zone.x1, zone.x2), maxX = Math.max(zone.x1, zone.x2);
      const minY = Math.min(zone.y1, zone.y2), maxY = Math.max(zone.y1, zone.y2);
      const tl = toCanvas({ x: minX, y: minY }), br = toCanvas({ x: maxX, y: maxY });
      ctx.strokeStyle = '#47c88e'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.15; ctx.fillStyle = '#47c88e'; ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1; ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
      const zoneW = br.x - tl.x, zoneH = br.y - tl.y;
      if (zoneW >= 30 && zoneH >= 20 && state.multiplyZoneSettings?.showLabelOnZone !== false) {
        const label = '×' + (zone.multiplier ?? 1);
        const center = toCanvas({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        const fontSize = (state.multiplyZoneSettings?.labelSize ?? 14) * z * currentEffDpr;
        ctx.font = fontSize + 'px DM Sans';
        const tw = ctx.measureText(label).width;
        const pad = 4;
        const inset = 6;
        const pos = state.multiplyZoneSettings?.labelPosition ?? 'center';
        let textX, textY, rectX, rectY, textAlign, textBaseline;
        if (pos === 'center') {
          textX = center.x; textY = center.y; textAlign = 'center'; textBaseline = 'middle';
          rectX = center.x - tw / 2 - pad; rectY = center.y - fontSize / 2 - pad;
        } else if (pos === 'top-left') {
          textX = tl.x + inset; textY = tl.y + inset; textAlign = 'left'; textBaseline = 'top';
          rectX = textX; rectY = textY;
        } else if (pos === 'top-right') {
          textX = br.x - inset; textY = tl.y + inset; textAlign = 'right'; textBaseline = 'top';
          rectX = textX - tw - pad * 2; rectY = textY;
        } else if (pos === 'bottom-left') {
          textX = tl.x + inset; textY = br.y - inset; textAlign = 'left'; textBaseline = 'bottom';
          rectX = textX; rectY = textY - fontSize - pad;
        } else {
          textX = br.x - inset; textY = br.y - inset; textAlign = 'right'; textBaseline = 'bottom';
          rectX = textX - tw - pad * 2; rectY = textY - fontSize - pad;
        }
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(rectX, rectY, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#2d7a4a';
        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        ctx.fillText(label, textX, textY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    (ann.scaleZones || []).forEach((zone) => {
      const minX = Math.min(zone.x1, zone.x2), maxX = Math.max(zone.x1, zone.x2);
      const minY = Math.min(zone.y1, zone.y2), maxY = Math.max(zone.y1, zone.y2);
      const tl = toCanvas({ x: minX, y: minY }), br = toCanvas({ x: maxX, y: maxY });
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#c9a227'; ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1; ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
      const zoneW = br.x - tl.x, zoneH = br.y - tl.y;
      const sc = zone.scale;
      const label = (sc && sc.label) ? sc.label : ((sc && sc.unit) ? ((sc.pixelsPerUnit ? (1 / sc.pixelsPerUnit).toFixed(2) : '?') + ' ' + sc.unit + '/pt') : 'Scale');
      if (zoneW >= 30 && zoneH >= 20 && label) {
        const center = toCanvas({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        const fontSize = (state.multiplyZoneSettings?.labelSize ?? 14) * z * currentEffDpr;
        ctx.font = fontSize + 'px DM Sans';
        const tw = ctx.measureText(label).width;
        const pad = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(center.x - tw / 2 - pad, center.y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#8a6d1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, center.x, center.y);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    drawRoomBoxesToContext(ctx, ann, state.currentPage, toCanvas, z * currentEffDpr);
    (ann.notes || []).forEach(n => {
      if (!n.text) return;
      const w = n.width || 150;
      const fontSize = n.fontSize || 14;
      const scale = z * currentEffDpr;
      const font = fontSize * scale + 'px DM Sans';
      const lineHeight = fontSize * scale;
      const { lines } = wrapNoteText(n.text, w * scale, font, lineHeight);
      const p = toCanvas({ x: n.x, y: n.y });
      const rot = getNoteRotationRad(n, page);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rot);
      ctx.font = font;
      ctx.fillStyle = n.color || '#e85447';
      ctx.textBaseline = 'top';
      lines.forEach((line, i) => { ctx.fillText(line, 0, i * lineHeight); });
      ctx.fillStyle = '#666';
      ctx.fillRect(-8 * scale - 3, 8 * scale - 3, 6, 6);
      ctx.fillRect(w * scale - 3, 8 * scale - 3, 6, 6);
      ctx.restore();
    });
    const cs = state.counterSettings || { size: 22, opacity: 1, showRings: false, numberSize: 10, ringSize: 1, ringOpacity: 1, ringSolid: true, outlineSize: 0, showOnlyCountersOnCurrentPage: false };
    const s = cs.size ?? 22;
    const opacity = cs.opacity;
    Object.entries(ann.counterMarkers || {}).forEach(([typeId, markers]) => {
      const def = state.counters.find(c => c.id === typeId);
      const iconPath = def ? def.icon : CIRCLE_PATH;
      const color = def ? def.color : '#e8c547';
      const vb = iconRenderVb(iconPath);
      const center = iconRenderCenter(iconPath);
      markers.forEach((m, i) => {
        const p = toCanvas(m);
        if (cs.showRings) {
          const ringScale = (cs.ringSize || 100) / 100;
          const ringSizePx = s * ringScale;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(ringSizePx / 640, ringSizePx / 640);
          ctx.translate(-320, -320);
          ctx.globalAlpha = cs.ringOpacity != null ? cs.ringOpacity : 1;
          if (cs.ringSolid) {
            ctx.fillStyle = color;
            ctx.fill(new Path2D(RING_PATH));
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke(new Path2D(RING_PATH));
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s / vb, s / vb);
        ctx.translate(-center.x, -center.y);
        const path = new Path2D(iconPath);
        const outlineSize = cs.outlineSize != null ? cs.outlineSize : 0;
        if (outlineSize > 0) {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = outlineSize * vb / s;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke(path);
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.fill(path);
        ctx.globalAlpha = 1;
        ctx.restore();
        if (state.showGroupColors && (m.group || null)) {
          const groupColor = getGroupColor(m.group);
          const dotRadius = 4;
          const topLeft = { x: p.x - s / 2 + dotRadius, y: p.y - s / 2 + dotRadius };
          ctx.fillStyle = groupColor;
          ctx.beginPath();
          ctx.arc(topLeft.x, topLeft.y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (markers.length > 1) {
          const ns = (cs.numberSize || 10);
          ctx.fillStyle = '#000'; ctx.font = ns + 'px DM Sans'; ctx.fillText(String(i + 1), p.x + ns * 0.6, p.y - ns * 0.6);
        }
      });
    });
    if (state.quickLineStart && state.mousePos) {
      const lt = state.lineTypes.find(l => l.id === state.activeLineTypeId);
      const aPdf = state.quickLineStart;
      let bPdf = state.mousePos;
      if (lts.snapToHorizontalVertical) bPdf = snapToHorizontalOrVertical(aPdf.x, aPdf.y, bPdf.x, bPdf.y);
      const a = toCanvas(aPdf), b = toCanvas(bPdf);
      const useArc = lt?.curveStyle === 'arc';
      const ctrlPdf = useArc ? getQuadraticBezierControlPoint(aPdf, bPdf, 1) : null;
      const ctrl = ctrlPdf ? toCanvas(ctrlPdf) : null;
      ctx.strokeStyle = lt?.color || '#4a9eff'; ctx.lineWidth = lw; ctx.globalAlpha = lo; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      if (useArc && ctrl) ctx.quadraticCurveTo(ctrl.x, ctrl.y, b.x, b.y);
      else ctx.lineTo(b.x, b.y);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    if (state.highlightStart && state.mousePos) {
      const minX = Math.min(state.highlightStart.x, state.mousePos.x), maxX = Math.max(state.highlightStart.x, state.mousePos.x);
      const minY = Math.min(state.highlightStart.y, state.mousePos.y), maxY = Math.max(state.highlightStart.y, state.mousePos.y);
      const tl = toCanvas({ x: minX, y: minY }), br = toCanvas({ x: maxX, y: maxY });
      ctx.fillStyle = '#e8c547'; ctx.globalAlpha = 0.25; ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#e8c547'; ctx.lineWidth = 2; ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    if (state.multiplyZoneStart && state.mousePos) {
      const minX = Math.min(state.multiplyZoneStart.x, state.mousePos.x), maxX = Math.max(state.multiplyZoneStart.x, state.mousePos.x);
      const minY = Math.min(state.multiplyZoneStart.y, state.mousePos.y), maxY = Math.max(state.multiplyZoneStart.y, state.mousePos.y);
      const tl = toCanvas({ x: minX, y: minY }), br = toCanvas({ x: maxX, y: maxY });
      ctx.strokeStyle = '#47c88e'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
    }
    if (state.scaleZoneStart && state.mousePos) {
      const minX = Math.min(state.scaleZoneStart.x, state.mousePos.x), maxX = Math.max(state.scaleZoneStart.x, state.mousePos.x);
      const minY = Math.min(state.scaleZoneStart.y, state.mousePos.y), maxY = Math.max(state.scaleZoneStart.y, state.mousePos.y);
      const tl = toCanvas({ x: minX, y: minY }), br = toCanvas({ x: maxX, y: maxY });
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
    }
    if (state.roomBoxStart && state.mousePos) {
      const minX = Math.min(state.roomBoxStart.x, state.mousePos.x), maxX = Math.max(state.roomBoxStart.x, state.mousePos.x);
      const minY = Math.min(state.roomBoxStart.y, state.mousePos.y), maxY = Math.max(state.roomBoxStart.y, state.mousePos.y);
      const tl = toCanvas({ x: minX, y: minY }), br = toCanvas({ x: maxX, y: maxY });
      ctx.strokeStyle = '#8e6fd8'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
      // Live W × L readout beside the cursor while sizing the room.
      const effScale = getEffectiveScaleForLine(getActiveAnnotations(state.pages[state.currentPage]), { x1: minX, y1: minY, x2: maxX, y2: maxY }, false, state.currentPage);
      const dims = roomBoxDimsFeet({ x1: minX, y1: minY, x2: maxX, y2: maxY }, effScale);
      if (dims) {
        const label = formatFeetInchesFromVal(Math.max(dims.widthFt, dims.lengthFt), 'ft') + ' × ' + formatFeetInchesFromVal(Math.min(dims.widthFt, dims.lengthFt), 'ft');
        const fontSize = 12 * z * currentEffDpr;
        ctx.font = fontSize + 'px DM Sans';
        const tw = ctx.measureText(label).width, pad = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(br.x + 8, br.y - fontSize - pad, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#5b3fa8';
        ctx.fillText(label, br.x + 8 + pad, br.y - pad);
      }
    }
    if (state.tool === TOOL.DELETE_ZONE && state.deleteZoneStart && state.mousePos) {
      const minX = Math.min(state.deleteZoneStart.x, state.mousePos.x), maxX = Math.max(state.deleteZoneStart.x, state.mousePos.x);
      const minY = Math.min(state.deleteZoneStart.y, state.mousePos.y), maxY = Math.max(state.deleteZoneStart.y, state.mousePos.y);
      const tl = toCanvas({ x: minX, y: minY }), br = toCanvas({ x: maxX, y: maxY });
      ctx.strokeStyle = 'var(--red)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
    }
    if (state.drawingPolyline && state.drawingPolyline.points.length >= 1) {
      const pts = state.drawingPolyline.points;
      ctx.strokeStyle = state.drawingPolyline.color || '#4a9eff'; ctx.lineWidth = lw; ctx.globalAlpha = lo; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const p0 = toCanvas(pts[0]); ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) { const p = toCanvas(pts[i]); ctx.lineTo(p.x, p.y); }
      if (state.mousePos) {
        let pmPdf = state.mousePos;
        if (lts.snapToHorizontalVertical) {
          const prev = pts[pts.length - 1];
          pmPdf = snapToHorizontalOrVertical(prev.x, prev.y, pmPdf.x, pmPdf.y);
        }
        const pm = toCanvas(pmPdf); ctx.lineTo(pm.x, pm.y);
      }
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    if (state.editingPolyline) {
      const pts = state.editingPolyline.points || [];
      pts.forEach((pt, i) => {
        const p = toCanvas(pt);
        ctx.fillStyle = '#e8c547'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      });
    }
    if (state.showLegendOverlay) {
      if (!ann.legend) {
        const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
        ann.legend = { x: vp.width - 110, y: 16, w: 100, h: 56 };
      }
      const scale = state.zoom * currentEffDpr;
      drawLegend(ctx, page, state.currentPage, ann, scale, toCanvas);
    }
    if (state.showGridOverlay) {
      const scale = state.zoom * currentEffDpr;
      drawGrid(ctx, page, state.currentPage, scale, toCanvas);
    }
  }

  function renderAnnotationsToContext(ctx, page, scale, exportOverrides, annotationsOverride) {
    const tc = (p) => ({ x: p.x * scale, y: p.y * scale });
    const ann = annotationsOverride ?? getActiveAnnotations(page);
    const pageIdx = state.pages.indexOf(page);
    const lts = state.lineTypeSettings || { opacity: 1, lineSize: 2, dropXSize: 10, dropIconStyle: 'circle', parallelEndsSize: 10, lengthLabelSize: 12, snapToHorizontalVertical: false, showOnlyLineTypesOnCurrentPage: false };
    const dropS = (lts.dropXSize ?? 10) * scale;
    const dropStyle = lts.dropIconStyle ?? 'circle';
    const lineScale = exportOverrides?.lineScale ?? 1;
    const markerScale = exportOverrides?.markerScale ?? 1;
    let lw = (lts.lineSize || 2) * scale * lineScale;
    const lo = lts.opacity != null ? lts.opacity : 1;
    (ann.quickLines || []).forEach(q => {
      const aPdf = { x: q.x1, y: q.y1 }, bPdf = { x: q.x2, y: q.y2 };
      const a = tc(aPdf), b = tc(bPdf);
      const lt = (state.lineTypes || []).find(l => l.id === q.lineTypeId);
      const useArc = lt?.curveStyle === 'arc';
      const ctrlPdf = useArc ? getQuadraticBezierControlPoint(aPdf, bPdf, 1) : null;
      const ctrl = ctrlPdf ? tc(ctrlPdf) : null;
      ctx.strokeStyle = q.color || '#4a9eff'; ctx.lineWidth = lw; ctx.globalAlpha = lo;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      if (useArc && ctrl) ctx.quadraticCurveTo(ctrl.x, ctrl.y, b.x, b.y);
      else ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (state.showGroupColors && (q.group || null)) {
        const mid = useArc && ctrlPdf ? tc(quadraticBezierPoint(0.5, aPdf, ctrlPdf, bPdf)) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const groupColor = getGroupColor(q.group);
        const dotRadius = 4 * scale;
        ctx.fillStyle = groupColor;
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const drawDrop = (p) => drawDropMarker(ctx, p, dropS, q.color || '#4a9eff', dropStyle);
      if ((q.startDrop || 0) > 0) drawDrop(a);
      if ((q.endDrop || 0) > 0) drawDrop(b);
      if (q.showLength) {
        const tickLen = lts.parallelEndsSize ?? 10;
        const drawPerpTick = (endPdf, tangentPdf) => {
          const dx = tangentPdf.x, dy = tangentPdf.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len, perpY = dx / len;
          const half = tickLen / 2;
          const p1 = tc({ x: endPdf.x - perpX * half, y: endPdf.y - perpY * half });
          const p2 = tc({ x: endPdf.x + perpX * half, y: endPdf.y + perpY * half });
          ctx.strokeStyle = q.color || '#4a9eff';
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        };
        if (useArc && ctrlPdf) {
          drawPerpTick(aPdf, { x: ctrlPdf.x - aPdf.x, y: ctrlPdf.y - aPdf.y });
          drawPerpTick(bPdf, { x: bPdf.x - ctrlPdf.x, y: bPdf.y - ctrlPdf.y });
        } else {
          drawPerpTick(aPdf, { x: bPdf.x - aPdf.x, y: bPdf.y - aPdf.y });
          drawPerpTick(bPdf, { x: bPdf.x - aPdf.x, y: bPdf.y - aPdf.y });
        }
        const midPdf = useArc && ctrlPdf ? quadraticBezierPoint(0.5, aPdf, ctrlPdf, bPdf) : { x: (aPdf.x + bPdf.x) / 2, y: (aPdf.y + bPdf.y) / 2 };
        const mid = tc(midPdf);
        const effScale = getEffectiveScaleForLine(ann, q, false, pageIdx >= 0 ? pageIdx : 0);
        const realLen = getLineRealWorldLength(q, pageIdx >= 0 ? pageIdx : 0, false, ann);
        const label = formatDistFeetInchesFromReal(realLen, effScale);
        const fontSize = (lts.lengthLabelSize ?? 12) * scale;
        ctx.font = fontSize + 'px sans-serif';
        const tw = ctx.measureText(label).width;
        const pad = 4 * scale;
        const orient = lts.orientLengthWithLine !== false;
        let angle = Math.atan2(bPdf.y - aPdf.y, bPdf.x - aPdf.x);
        if (orient && (angle > Math.PI / 2 || angle < -Math.PI / 2)) angle += Math.PI;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (orient) {
          ctx.save();
          ctx.translate(mid.x, mid.y);
          ctx.rotate(angle);
          ctx.fillRect(-tw / 2 - pad, -fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
          ctx.fillStyle = '#000';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else {
          ctx.fillRect(mid.x - tw / 2 - pad, mid.y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
          ctx.fillStyle = '#000';
          ctx.fillText(label, mid.x, mid.y);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    (ann.polylines || []).forEach(poly => {
      const pts = poly.points || [];
      if (pts.length < 2) return;
      ctx.strokeStyle = poly.color || '#4a9eff'; ctx.lineWidth = lw; ctx.globalAlpha = lo;
      ctx.beginPath();
      const p0 = tc(pts[0]); ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) { const p = tc(pts[i]); ctx.lineTo(p.x, p.y); }
      if (poly.closed) ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (state.showGroupColors && (poly.group || null)) {
        const pts = poly.points || [];
        const idx = Math.floor(pts.length / 2);
        const midPdf = pts[idx] || pts[0];
        const mid = tc(midPdf);
        const groupColor = getGroupColor(poly.group);
        const dotRadius = 4 * scale;
        ctx.fillStyle = groupColor;
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const drawDrop = (p) => drawDropMarker(ctx, p, dropS, poly.color || '#4a9eff', dropStyle);
      if ((poly.startDrop || 0) > 0 && pts.length > 0) drawDrop(tc(pts[0]));
      if ((poly.endDrop || 0) > 0 && pts.length > 0) drawDrop(tc(pts[pts.length - 1]));
      if (poly.showLength && pts.length >= 2) {
        const tickLen = lts.parallelEndsSize ?? 10;
        const drawPerpTick = (endPdf, tangentPdf) => {
          const dx = tangentPdf.x, dy = tangentPdf.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len, perpY = dx / len;
          const half = tickLen / 2;
          const p1 = tc({ x: endPdf.x - perpX * half, y: endPdf.y - perpY * half });
          const p2 = tc({ x: endPdf.x + perpX * half, y: endPdf.y + perpY * half });
          ctx.strokeStyle = poly.color || '#4a9eff';
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        };
        drawPerpTick(pts[0], { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y });
        if (pts.length > 2) drawPerpTick(pts[pts.length - 1], { x: pts[pts.length - 1].x - pts[pts.length - 2].x, y: pts[pts.length - 1].y - pts[pts.length - 2].y });
        const totalLen = polylineDistance(pts, poly.closed);
        let acc = 0;
        let midPdf = pts[0];
        let segAngle = 0;
        const halfLen = totalLen / 2;
        for (let i = 0; i < pts.length - 1; i++) {
          const segLen = ptDist(pts[i], pts[i + 1]);
          if (acc + segLen >= halfLen) {
            const t = (halfLen - acc) / segLen;
            midPdf = { x: pts[i].x + t * (pts[i + 1].x - pts[i].x), y: pts[i].y + t * (pts[i + 1].y - pts[i].y) };
            segAngle = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
            break;
          }
          acc += segLen;
        }
        if (poly.closed && pts.length >= 3) {
          const segLen = ptDist(pts[pts.length - 1], pts[0]);
          if (acc + segLen >= halfLen) {
            const t = (halfLen - acc) / segLen;
            midPdf = { x: pts[pts.length - 1].x + t * (pts[0].x - pts[pts.length - 1].x), y: pts[pts.length - 1].y + t * (pts[0].y - pts[pts.length - 1].y) };
            segAngle = Math.atan2(pts[0].y - pts[pts.length - 1].y, pts[0].x - pts[pts.length - 1].x);
          }
        }
        const mid = tc(midPdf);
        const effScale = getEffectiveScaleForLine(ann, poly, true, pageIdx >= 0 ? pageIdx : 0);
        const realLen = getLineRealWorldLength(poly, pageIdx >= 0 ? pageIdx : 0, true, ann);
        const label = formatDistFeetInchesFromReal(realLen, effScale);
        const fontSize = (lts.lengthLabelSize ?? 12) * scale;
        ctx.font = fontSize + 'px sans-serif';
        const tw = ctx.measureText(label).width;
        const pad = 4 * scale;
        const orient = lts.orientLengthWithLine !== false;
        let angle = segAngle;
        if (orient && (angle > Math.PI / 2 || angle < -Math.PI / 2)) angle += Math.PI;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (orient) {
          ctx.save();
          ctx.translate(mid.x, mid.y);
          ctx.rotate(angle);
          ctx.fillRect(-tw / 2 - pad, -fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
          ctx.fillStyle = '#000';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else {
          ctx.fillRect(mid.x - tw / 2 - pad, mid.y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
          ctx.fillStyle = '#000';
          ctx.fillText(label, mid.x, mid.y);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    (ann.highlights || []).forEach(h => {
      const minX = Math.min(h.x1, h.x2), maxX = Math.max(h.x1, h.x2);
      const minY = Math.min(h.y1, h.y2), maxY = Math.max(h.y1, h.y2);
      const tl = tc({ x: minX, y: minY }), br = tc({ x: maxX, y: maxY });
      ctx.fillStyle = h.color || '#e8c547'; ctx.globalAlpha = h.opacity != null ? h.opacity : 0.25;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1;
    });
    (ann.multiplyZones || []).forEach(zone => {
      const minX = Math.min(zone.x1, zone.x2), maxX = Math.max(zone.x1, zone.x2);
      const minY = Math.min(zone.y1, zone.y2), maxY = Math.max(zone.y1, zone.y2);
      const tl = tc({ x: minX, y: minY }), br = tc({ x: maxX, y: maxY });
      ctx.strokeStyle = '#47c88e'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.15; ctx.fillStyle = '#47c88e'; ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1; ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
      const zoneW = br.x - tl.x, zoneH = br.y - tl.y;
      if (zoneW >= 30 && zoneH >= 20 && state.multiplyZoneSettings?.showLabelOnZone !== false) {
        const label = '×' + (zone.multiplier ?? 1);
        const center = tc({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        const fontSize = (state.multiplyZoneSettings?.labelSize ?? 14) * scale;
        ctx.font = fontSize + 'px sans-serif';
        const tw = ctx.measureText(label).width;
        const pad = 4;
        const inset = 6;
        const pos = state.multiplyZoneSettings?.labelPosition ?? 'center';
        let textX, textY, rectX, rectY, textAlign, textBaseline;
        if (pos === 'center') {
          textX = center.x; textY = center.y; textAlign = 'center'; textBaseline = 'middle';
          rectX = center.x - tw / 2 - pad; rectY = center.y - fontSize / 2 - pad;
        } else if (pos === 'top-left') {
          textX = tl.x + inset; textY = tl.y + inset; textAlign = 'left'; textBaseline = 'top';
          rectX = textX; rectY = textY;
        } else if (pos === 'top-right') {
          textX = br.x - inset; textY = tl.y + inset; textAlign = 'right'; textBaseline = 'top';
          rectX = textX - tw - pad * 2; rectY = textY;
        } else if (pos === 'bottom-left') {
          textX = tl.x + inset; textY = br.y - inset; textAlign = 'left'; textBaseline = 'bottom';
          rectX = textX; rectY = textY - fontSize - pad;
        } else {
          textX = br.x - inset; textY = br.y - inset; textAlign = 'right'; textBaseline = 'bottom';
          rectX = textX - tw - pad * 2; rectY = textY - fontSize - pad;
        }
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(rectX, rectY, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#2d7a4a';
        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        ctx.fillText(label, textX, textY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    (ann.scaleZones || []).forEach((zone) => {
      const minX = Math.min(zone.x1, zone.x2), maxX = Math.max(zone.x1, zone.x2);
      const minY = Math.min(zone.y1, zone.y2), maxY = Math.max(zone.y1, zone.y2);
      const tl = tc({ x: minX, y: minY }), br = tc({ x: maxX, y: maxY });
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#c9a227'; ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1; ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
      const zoneW = br.x - tl.x, zoneH = br.y - tl.y;
      const sc = zone.scale;
      const label = (sc && sc.label) ? sc.label : ((sc && sc.unit) ? ((sc.pixelsPerUnit ? (1 / sc.pixelsPerUnit).toFixed(2) : '?') + ' ' + sc.unit + '/pt') : 'Scale');
      if (zoneW >= 30 && zoneH >= 20 && label) {
        const center = tc({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        const fontSize = (state.multiplyZoneSettings?.labelSize ?? 14) * scale;
        ctx.font = fontSize + 'px sans-serif';
        const tw = ctx.measureText(label).width;
        const pad = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(center.x - tw / 2 - pad, center.y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#8a6d1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, center.x, center.y);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    drawRoomBoxesToContext(ctx, ann, pageIdx >= 0 ? pageIdx : 0, tc, scale);
    (ann.notes || []).forEach(n => {
      if (!n.text) return;
      const w = n.width || 150;
      const fontSize = n.fontSize || 14;
      const maxW = w * scale;
      const font = (fontSize * scale) + 'px sans-serif';
      const lh = fontSize * scale;
      const { lines } = wrapNoteText(n.text, maxW, font, lh);
      const p = tc({ x: n.x, y: n.y });
      const rot = getNoteRotationRad(n, page);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rot);
      ctx.font = font;
      ctx.fillStyle = n.color || '#e85447';
      ctx.textBaseline = 'top';
      lines.forEach((line, i) => { ctx.fillText(line, 0, i * lh); });
      ctx.restore();
    });
    const cs = state.counterSettings || { size: 22, opacity: 1, showRings: false, numberSize: 10, ringSize: 1, ringOpacity: 1, ringSolid: true, outlineSize: 0, showOnlyCountersOnCurrentPage: false };
    const s = (cs.size || 22) * scale * markerScale;
    const opacity = cs.opacity;
    Object.entries(ann.counterMarkers || {}).forEach(([typeId, markers]) => {
      const def = state.counters.find(c => c.id === typeId);
      const iconPath = def ? def.icon : CIRCLE_PATH;
      const color = def ? def.color : '#e8c547';
      const vb = iconRenderVb(iconPath);
      const center = iconRenderCenter(iconPath);
      markers.forEach((m, i) => {
        const p = tc(m);
        if (cs.showRings) {
          const ringScale = (cs.ringSize || 100) / 100;
          const ringSizePx = s * ringScale;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(ringSizePx / 640, ringSizePx / 640);
          ctx.translate(-320, -320);
          ctx.globalAlpha = cs.ringOpacity != null ? cs.ringOpacity : 1;
          if (cs.ringSolid) {
            ctx.fillStyle = color;
            ctx.fill(new Path2D(RING_PATH));
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke(new Path2D(RING_PATH));
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s / vb, s / vb);
        ctx.translate(-center.x, -center.y);
        const path = new Path2D(iconPath);
        const outlineSize = (cs.outlineSize != null ? cs.outlineSize : 0) * scale * markerScale;
        if (outlineSize > 0) {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = outlineSize * vb / s;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke(path);
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.fill(path);
        ctx.globalAlpha = 1;
        ctx.restore();
        if (state.showGroupColors && (m.group || null)) {
          const groupColor = getGroupColor(m.group);
          const dotRadius = 4 * scale;
          const topLeft = { x: p.x - s / 2 + dotRadius, y: p.y - s / 2 + dotRadius };
          ctx.fillStyle = groupColor;
          ctx.beginPath();
          ctx.arc(topLeft.x, topLeft.y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (markers.length > 1) {
          const ns = (cs.numberSize || 10) * scale * markerScale;
          ctx.fillStyle = '#000'; ctx.font = ns + 'px DM Sans'; ctx.fillText(String(i + 1), p.x + ns * 0.6, p.y - ns * 0.6);
        }
      });
    });
    if (state.showLegendOverlay) {
      if (!ann.legend) {
        const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
        ann.legend = { x: vp.width - 110, y: 16, w: 100, h: 56 };
      }
      drawLegend(ctx, page, pageIdx, ann, scale, tc);
    }
  }

  function hexToRgb(hex) {
    const m = (hex || '#ffffff').match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
  }
  function drawLegend(ctx, page, pageIdx, ann, scale, tc) {
    if (!state.showLegendOverlay || !ann.legend) return;
    const leg = ann.legend;
    const legendScale = state.legendSettings?.legendScale ?? 1;
    const effectiveScale = scale * legendScale;
    const pageScale = getPageScale(pageIdx >= 0 ? pageIdx : 0);
    const counterRows = [];
    (state.counters || []).forEach(c => {
      const markers = ann.counterMarkers?.[c.id] || [];
      let effectiveCount = 0;
      markers.forEach(m => { effectiveCount += getMultiplyZoneForPoint(ann, m); });
      if (effectiveCount > 0) counterRows.push({ name: c.name || 'Counter', icon: c.icon || CIRCLE_PATH, color: c.color || '#e8c547', count: effectiveCount });
    });
    const lineRows = [];
    (state.lineTypes || []).forEach(lt => {
      let lenReal = 0;
      const pi = pageIdx >= 0 ? pageIdx : 0;
      (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
        lenReal += getLineLengthFeetForTotals(q, pi, false, ann);
      });
      (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
        lenReal += getLineLengthFeetForTotals(poly, pi, true, ann);
      });
      if (lenReal > 0) lineRows.push({ name: lt.name || 'Line', color: lt.color || '#4a9eff', lengthStr: formatFeet(lenReal, pageScale) });
    });
    // Room Sizer rows: per-room volume for this page's boxes (always cubic feet).
    // Toggleable in Legend Settings; on by default — only projects that use the
    // Room Sizer have roomBoxes, so legacy legends are unchanged.
    const roomRows = [];
    if (state.legendSettings?.showRooms !== false) {
      const pi = pageIdx >= 0 ? pageIdx : 0;
      (state.rooms || []).forEach(rm => {
        let vol = 0, any = false;
        (ann.roomBoxes || []).filter(b => b.roomId === rm.id).forEach(b => {
          const dims = roomBoxDimsFeet(b, getEffectiveScaleForLine(ann, b, false, pi));
          if (dims) { vol += dims.volumeCuFt; any = true; }
        });
        if (any) roomRows.push({ name: rm.name || 'Room', color: rm.color || '#47c88e', volStr: Math.round(vol) + ' ft³' });
      });
    }
    const hasRows = counterRows.length > 0 || lineRows.length > 0 || roomRows.length > 0;
    ctx.font = (10 * effectiveScale) + 'px sans-serif';
    let maxTextWidthCanvas = 0;
    counterRows.forEach(r => {
      const w = ctx.measureText((r.name || '') + ' [' + r.count + ']').width;
      if (w > maxTextWidthCanvas) maxTextWidthCanvas = w;
    });
    lineRows.forEach(r => {
      const w = ctx.measureText((r.name || '') + ' ' + r.lengthStr).width;
      if (w > maxTextWidthCanvas) maxTextWidthCanvas = w;
    });
    roomRows.forEach(r => {
      const w = ctx.measureText((r.name || '') + ' ' + r.volStr).width;
      if (w > maxTextWidthCanvas) maxTextWidthCanvas = w;
    });
    const ROW_H_PDF = 14;
    const PAD_PDF = 6;
    const totalRows = counterRows.length + lineRows.length + roomRows.length;
    const idealHeightPdf = legendScale * (hasRows ? (2 * PAD_PDF + totalRows * ROW_H_PDF) : 40);
    const idealWidthPdf = hasRows ? (legendScale * (24 + 6 + 6) + maxTextWidthCanvas / scale) : legendScale * 80;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const pageW = vp.width, pageH = vp.height;
    const minW = 60 * legendScale, minH = 40 * legendScale;
    if (!leg.userResized) {
      leg.w = Math.max(minW, Math.min(idealWidthPdf, pageW - leg.x - 10));
      leg.h = Math.max(minH, Math.min(idealHeightPdf, pageH - leg.y - 10));
    } else {
      leg.w = Math.max(leg.w, Math.min(idealWidthPdf, pageW - leg.x - 10));
      leg.h = Math.max(leg.h, Math.min(idealHeightPdf, pageH - leg.y - 10));
    }
    leg.w = Math.max(minW, Math.min(leg.w, pageW - leg.x - 10));
    leg.h = Math.max(minH, Math.min(leg.h, pageH - leg.y - 10));
    const tl = tc({ x: leg.x, y: leg.y });
    const width = leg.w * scale;
    const height = leg.h * scale;
    const [r, g, b] = hexToRgb(state.legendSettings?.bgColor || '#ffffff');
    const bgOpacity = state.legendSettings?.bgOpacity ?? 1;
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + bgOpacity + ')';
    ctx.fillRect(tl.x, tl.y, width, height);
    ctx.save();
    ctx.globalAlpha = state.legendSettings?.textOpacity ?? 1;
    if (state.legendSettings?.showBorder !== false) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.x, tl.y, width, height);
    }
    const GRIP_SIZE = 16;
    const brX = tl.x + width - GRIP_SIZE - 4;
    const brY = tl.y + height - GRIP_SIZE - 4;
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const o = 2 + i * 3;
      ctx.beginPath();
      ctx.moveTo(brX + o, brY + GRIP_SIZE);
      ctx.lineTo(brX + GRIP_SIZE, brY + o);
      ctx.stroke();
    }
    if (state.legendSettings?.showResizeHighlight) {
      const LEGEND_RESIZE_HIT = 16;
      const hitW = LEGEND_RESIZE_HIT * scale;
      const hitH = LEGEND_RESIZE_HIT * scale;
      const hitX = tl.x + width - hitW;
      const hitY = tl.y + height - hitH;
      ctx.fillStyle = 'rgba(255, 200, 0, 0.4)';
      ctx.fillRect(hitX, hitY, hitW, hitH);
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hitX, hitY, hitW, hitH);
    }
    const ROW_H = 14 * effectiveScale;
    const PAD = 6 * effectiveScale;
    const ICON_SIZE = 14 * effectiveScale;
    const LEFT_COL = 24 * effectiveScale;
    const NAME_START = tl.x + PAD + LEFT_COL;
    ctx.fillStyle = '#333';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    let rowY = tl.y + PAD;
    if (!hasRows) {
      ctx.fillStyle = '#666';
      ctx.fillText('No items', tl.x + PAD, rowY);
      ctx.restore();
      return;
    }
    counterRows.forEach(r => {
      const center = iconRenderCenter(r.icon);
      const vb = iconRenderVb(r.icon);
      ctx.save();
      const ICON_OFFSET_X = 6.5 * effectiveScale;
      const ICON_OFFSET_Y = 4.5 * effectiveScale;
      ctx.translate(tl.x + PAD + (LEFT_COL - ICON_SIZE) / 2 + ICON_OFFSET_X, rowY + (ROW_H - ICON_SIZE) / 2 + ICON_OFFSET_Y);
      ctx.scale(ICON_SIZE / vb, ICON_SIZE / vb);
      ctx.translate(-center.x, -center.y);
      const path = new Path2D(r.icon);
      ctx.fillStyle = r.color;
      ctx.fill(path);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = vb / ICON_SIZE;
      ctx.stroke(path);
      ctx.restore();
      ctx.fillStyle = '#000';
      ctx.fillText((r.name || '') + ' [' + r.count + ']', NAME_START, rowY);
      rowY += ROW_H;
    });
    lineRows.forEach(r => {
      ctx.fillStyle = r.color;
      const SWATCH_H = 3 * effectiveScale;
      const swatchY = rowY + 1 + (ROW_H - SWATCH_H) / 4;
      ctx.fillRect(tl.x + PAD + (LEFT_COL - 20 * effectiveScale) / 2, swatchY, 20 * effectiveScale, SWATCH_H);
      ctx.fillStyle = '#000';
      ctx.fillText((r.name || '') + ' ' + r.lengthStr, NAME_START, rowY);
      rowY += ROW_H;
    });
    roomRows.forEach(r => {
      ctx.fillStyle = r.color;
      const SWATCH = 8 * effectiveScale;
      ctx.fillRect(tl.x + PAD + (LEFT_COL - SWATCH) / 2, rowY + (ROW_H - SWATCH) / 2, SWATCH, SWATCH);
      ctx.fillStyle = '#000';
      ctx.fillText((r.name || '') + ' ' + r.volStr, NAME_START, rowY);
      rowY += ROW_H;
    });
    ctx.restore();
  }

  function lineStyleToDash(style) {
    if (style === 'dashed') return [4, 4];
    if (style === 'dotted') return [2, 2];
    return [];
  }
  function drawGrid(ctx, page, pageIdx, scale, toCanvas) {
    if (!state.showGridOverlay || !state.gridSettings?.spacing) return;
    const pageScale = getPageScale(pageIdx >= 0 ? pageIdx : 0);
    if (!pageScale) return;
    const gs = state.gridSettings;
    const spacingX = gs.spacing * pageScale.pixelsPerUnit;
    const spacingY = gs.spacing * pageScale.pixelsPerUnit;
    const offsetXPdf = (gs.offsetX ?? 0) * pageScale.pixelsPerUnit;
    const offsetYPdf = (gs.offsetY ?? 0) * pageScale.pixelsPerUnit;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const pageW = vp.width, pageH = vp.height;
    const opacity = gs.opacity ?? 0.35;
    const [r, g, b] = hexToRgb(gs.color || '#e8c547');
    const lineWidth = gs.lineWidth ?? 1;
    const lineStyle = gs.lineStyle || 'solid';
    const majorInterval = (gs.majorInterval != null && gs.majorInterval > 0) ? gs.majorInterval : null;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    const drawLine = (x1, y1, x2, y2, isMajor) => {
      ctx.beginPath();
      ctx.lineWidth = isMajor ? lineWidth * 2 : lineWidth;
      ctx.setLineDash(isMajor ? [] : lineStyleToDash(lineStyle));
      const a = toCanvas({ x: x1, y: y1 });
      const b = toCanvas({ x: x2, y: y2 });
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    let vIdx = 0;
    for (let x = offsetXPdf - spacingX, vi = -1; x >= 0; x -= spacingX, vi--) {
      drawLine(x, 0, x, pageH, majorInterval && Math.abs(vi) % majorInterval === 0);
    }
    for (let x = offsetXPdf; x <= pageW; x += spacingX, vIdx++) {
      drawLine(x, 0, x, pageH, majorInterval && vIdx % majorInterval === 0);
    }
    let hIdx = 0;
    for (let y = offsetYPdf - spacingY, hi = -1; y >= 0; y -= spacingY, hi--) {
      drawLine(0, y, pageW, y, majorInterval && Math.abs(hi) % majorInterval === 0);
    }
    for (let y = offsetYPdf; y <= pageH; y += spacingY, hIdx++) {
      drawLine(0, y, pageW, y, majorInterval && hIdx % majorInterval === 0);
    }
    ctx.restore();
  }

  function snapToGrid(pdf, pageIdx) {
    if (!state.gridSettings?.snapToGrid || !state.showGridOverlay) return pdf;
    const pageScale = getPageScale(pageIdx);
    if (!pageScale) return pdf;
    const gs = state.gridSettings;
    const spacingX = (gs.spacing ?? 0) * pageScale.pixelsPerUnit;
    const spacingY = (gs.spacing ?? 0) * pageScale.pixelsPerUnit;
    const offX = (gs.offsetX ?? 0) * pageScale.pixelsPerUnit;
    const offY = (gs.offsetY ?? 0) * pageScale.pixelsPerUnit;
    if (spacingX <= 0 || spacingY <= 0) return pdf;
    const snappedX = offX + Math.round((pdf.x - offX) / spacingX) * spacingX;
    const snappedY = offY + Math.round((pdf.y - offY) / spacingY) * spacingY;
    return { x: snappedX, y: snappedY };
  }

  function getMaxZoom() { return state.maxZoom ?? 4; }
  function getWheelZoomSpeed() {
    try {
      const s = localStorage.getItem('zoomSettings');
      if (s) { const j = JSON.parse(s); return (j && typeof j.wheelZoomSpeed === 'number') ? j.wheelZoomSpeed : 1; }
    } catch (_) {}
    return 1;
  }

  function fitZoom() {
    const page = state.pages[state.currentPage];
    if (!page || !page.pdfPage) return;
    const wrap = document.querySelector('.canvas-wrapper');
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const scaleX = r.width / vp.width, scaleY = r.height / vp.height;
    state.zoom = Math.max(0.2, Math.min(getMaxZoom(), Math.min(scaleX, scaleY)));
    state.pan = { x: 0, y: 0 };
    renderPdf();
    updateUI();
  }

  // SECTION: UI Render Functions
  function updateUI() {
    try { updateCanvasOnlyNeedsPdfBanner(); } catch (_) {}
    document.getElementById('zoomPct').textContent = Math.round(state.zoom * 100) + '%';
    if (App.onZoomRailSync) App.onZoomRailSync();
    if (App.maybeShowViewerScaleNotice) App.maybeShowViewerScaleNotice();
    const pageInfo = document.getElementById('pageInfo');
    const current = state.pages.length ? state.currentPage + 1 : 0;
    const total = state.pages.length || 0;
    pageInfo.innerHTML = current + '/' + total;
    document.getElementById('prevPage').disabled = state.currentPage <= 0;
    document.getElementById('nextPage').disabled = state.currentPage >= state.pages.length - 1;
    const marked = getMarkedPageIndices();
    const prevMarkedBtn = document.getElementById('prevMarkedPage');
    const nextMarkedBtn = document.getElementById('nextMarkedPage');
    if (prevMarkedBtn) prevMarkedBtn.disabled = !marked.length || marked.filter(i => i < state.currentPage).length === 0;
    if (nextMarkedBtn) nextMarkedBtn.disabled = !marked.length || marked.filter(i => i > state.currentPage).length === 0;
    const setScaleBtn = document.getElementById('setScale');
    const setScaleSidebarBtn = document.getElementById('setScaleSidebar');
    const scale = getPageScale(state.currentPage);
    const scaleIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18"><path fill="currentColor" d="M163.3 320.1L232.7 200.2C227.1 188 223.9 174.4 223.9 160C223.9 107 266.9 64 319.9 64C372.9 64 415.9 107 415.9 160C415.9 174.3 412.8 187.9 407.1 200.2L451.5 276.9C428.4 302.9 397.8 322 363.1 330.7L320 255.9L251.9 373.5C273.4 380.3 296.2 384 320 384C390.7 384 453.8 351.3 494.9 300C506 286.2 526.1 284 539.9 295C553.7 306 555.9 326.2 544.9 340C492.2 405.8 411 448 320.1 448C284.7 448 250.7 441.6 219.4 429.9L162.7 527.7C158 535.8 151 542.4 142.6 546.6L87.2 574.3C82.2 576.8 76.3 576.5 71.6 573.6C66.9 570.7 64 565.5 64 560L64 504.6C64 496.2 66.2 487.9 70.5 480.5L130.5 376.8C117.7 365.6 105.9 353.3 95.2 340C84.1 326.2 86.4 306.1 100.2 295C114 283.9 134.1 286.2 145.2 300C150.9 307.1 157 313.8 163.4 320.1zM445.1 471.9C477.6 458.9 507.5 440.9 534 419L569.6 480.5C573.8 487.8 576.1 496.1 576.1 504.6L576.1 560C576.1 565.5 573.2 570.7 568.5 573.6C563.8 576.5 557.9 576.8 552.9 574.3L497.5 546.6C489.1 542.4 482.1 535.8 477.4 527.7L445.1 471.9zM320 192C337.7 192 352 177.7 352 160C352 142.3 337.7 128 320 128C302.3 128 288 142.3 288 160C288 177.7 302.3 192 320 192z"/></svg>';
    const scaleIconSvgHeader = scaleIconSvg.replace('width="18" height="18"', 'width="28" height="28"');
    const setScaleContent = (btn) => {
      const isHeader = btn.id === 'setScale';
      const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      if (scale) {
        btn.classList.add('scale-set');
        if (isHeader) btn.classList.remove('scale-unset');
        const pxLine = '1 ' + scale.unit + ' = ' + scale.pixelsPerUnit.toFixed(1) + ' px' + (scale.temp ? ' · temp' : '');
        btn.title = scale.temp ? 'Temporary scale — only on this device' : '';
        if (isHeader) {
          btn.innerHTML = scaleIconSvgHeader;
        } else if (scale.label) {
          btn.innerHTML = '<span class="set-scale-icon">' + scaleIconSvg + '</span><div class="set-scale-display"><span class="scale-label">' + esc(scale.label) + '</span><span class="scale-px">' + esc(pxLine) + '</span></div>';
        } else {
          btn.innerHTML = '<span class="set-scale-icon">' + scaleIconSvg + '</span><div class="set-scale-display"><span class="scale-value">' + esc(pxLine) + '</span></div>';
        }
      } else {
        btn.classList.remove('scale-set');
        if (isHeader) btn.classList.add('scale-unset');
        btn.title = '';
        btn.innerHTML = isHeader ? scaleIconSvgHeader : scaleIconSvg + ' Set Scale';
      }
    };
    setScaleContent(setScaleBtn);
    if (setScaleSidebarBtn) setScaleContent(setScaleSidebarBtn);
    const scaleDisplay = document.getElementById('sidebarScaleDisplay');
    if (scaleDisplay) {
      if (scale) {
        const pxLine = '1 ' + scale.unit + ' = ' + scale.pixelsPerUnit.toFixed(1) + ' px' + (scale.temp ? ' · temp' : '');
        const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        if (scale.label) {
          scaleDisplay.innerHTML = '<span class="set-scale-icon">' + scaleIconSvg + '</span><div class="set-scale-display"><span class="scale-label">' + esc(scale.label) + '</span><span class="scale-px">' + esc(pxLine) + '</span></div>';
        } else {
          scaleDisplay.innerHTML = '<span class="set-scale-icon">' + scaleIconSvg + '</span><div class="set-scale-display"><span class="scale-px">' + esc(pxLine) + '</span></div>';
        }
        scaleDisplay.style.display = 'flex';
        scaleDisplay.style.flexDirection = 'row';
        scaleDisplay.style.gap = '8px';
        scaleDisplay.classList.add('has-scale');
        scaleDisplay.title = scale.temp ? 'Temporary scale — only on this device' : 'Click to set scale';
        scaleDisplay.onclick = () => document.getElementById('setScale').click();
      } else {
        scaleDisplay.textContent = '—';
        scaleDisplay.style.display = '';
        scaleDisplay.style.flexDirection = '';
        scaleDisplay.style.gap = '';
        scaleDisplay.classList.remove('has-scale');
        scaleDisplay.title = '';
        scaleDisplay.onclick = null;
      }
    }
    const scaleDisplaySection = document.getElementById('sidebarScaleDisplaySection');
    if (scaleDisplaySection) scaleDisplaySection.style.display = state.pages.length ? '' : 'none';
    document.getElementById('moveBtn').classList.toggle('active', state.tool === TOOL.NONE);
    document.getElementById('quickLine').classList.toggle('active', state.tool === TOOL.LINE);
    document.getElementById('polylineBtn').classList.toggle('active', state.tool === TOOL.POLYLINE);
    document.getElementById('highlightBtn').classList.toggle('active', state.tool === TOOL.HIGHLIGHT);
    const multiplyZoneBtn = document.getElementById('multiplyZoneBtn');
    if (multiplyZoneBtn) multiplyZoneBtn.classList.toggle('active', state.tool === TOOL.MULTIPLY_ZONE);
    const scaleZoneBtn = document.getElementById('scaleZoneBtn');
    if (scaleZoneBtn) scaleZoneBtn.classList.toggle('active', state.tool === TOOL.SCALE_ZONE);
    const deleteZoneBtn = document.getElementById('deleteZoneBtn');
    if (deleteZoneBtn) deleteZoneBtn.classList.toggle('active', state.tool === TOOL.DELETE_ZONE);
    const roomBtnEl = document.getElementById('roomBtn');
    if (roomBtnEl) roomBtnEl.classList.toggle('active', state.tool === TOOL.ROOM);
    document.getElementById('noteBtn').classList.toggle('active', state.tool === TOOL.NOTE);
    document.getElementById('counterBtn').classList.toggle('active', state.tool === TOOL.COUNTER);
    const counterBtn = document.getElementById('counterBtn');
    if (counterBtn) {
      const counter = state.tool === TOOL.COUNTER && state.activeCounterType
        ? state.counters.find(c => c.id === state.activeCounterType)
        : null;
      if (counter) {
        counterBtn.innerHTML = '<svg viewBox="' + iconVbFor(counter.icon) + '" width="28" height="28"><path fill="' + (counter.color || '#e8c547') + '" stroke="#000" stroke-width="32" stroke-linejoin="round" stroke-linecap="round" d="' + counter.icon + '"/></svg>';
        counterBtn.title = (counter.name || 'Counter') + ' (right-click for settings)';
      } else {
        counterBtn.innerHTML = COUNTER_BTN_DEFAULT_SVG;
        counterBtn.title = 'Counter (right-click for settings)';
      }
    }
    const moveBtnSidebar = document.getElementById('moveBtnSidebar');
    const counterBtnSidebar = document.getElementById('counterBtnSidebar');
    const quickLineSidebar = document.getElementById('quickLineSidebar');
    const polylineBtnSidebar = document.getElementById('polylineBtnSidebar');
    if (counterBtnSidebar) {
      const counter = state.tool === TOOL.COUNTER && state.activeCounterType
        ? state.counters.find(c => c.id === state.activeCounterType)
        : null;
      const svgEl = counterBtnSidebar.querySelector('svg');
      if (counter && svgEl) {
        svgEl.outerHTML = '<svg viewBox="' + iconVbFor(counter.icon) + '" width="18" height="18"><path fill="' + (counter.color || '#e8c547') + '" stroke="#000" stroke-width="32" stroke-linejoin="round" stroke-linecap="round" d="' + counter.icon + '"/></svg>';
        counterBtnSidebar.title = (counter.name || 'Counter') + ' (right-click for settings)';
      } else if (svgEl) {
        svgEl.outerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18"><path fill="currentColor" d="M320 320C178.6 320 64 277 64 224C64 171 178.6 128 320 128C461.4 128 576 171 576 224C576 277 461.4 320 320 320zM64 416L64 306.7C80.9 319 101 328.9 122.1 336.8C175.1 356.7 245.1 368 320 368C394.9 368 464.9 356.7 517.9 336.8C539.1 328.9 559.1 319 576 306.7L576 416C576 469 461.4 512 320 512C178.6 512 64 469 64 416z"/></svg>';
        counterBtnSidebar.title = 'Counter (right-click for settings)';
      }
    }
    if (moveBtnSidebar) moveBtnSidebar.classList.toggle('active', state.tool === TOOL.NONE);
    if (counterBtnSidebar) counterBtnSidebar.classList.toggle('active', state.tool === TOOL.COUNTER);
    if (quickLineSidebar) quickLineSidebar.classList.toggle('active', state.tool === TOOL.LINE);
    if (polylineBtnSidebar) polylineBtnSidebar.classList.toggle('active', state.tool === TOOL.POLYLINE);
    const snapHvHeaderBtn = document.getElementById('lineTypeSnapToHVHeaderBtn');
    if (snapHvHeaderBtn) {
      snapHvHeaderBtn.classList.toggle('active', !!state.lineTypeSettings.snapToHorizontalVertical);
      snapHvHeaderBtn.setAttribute('aria-pressed', !!state.lineTypeSettings.snapToHorizontalVertical);
      snapHvHeaderBtn.style.display = (!state.isViewer && (state.tool === TOOL.LINE || state.tool === TOOL.POLYLINE)) ? '' : 'none';
    }
    const counterShowOnlyInline = document.getElementById('counterShowOnlyOnPageInlineBtn');
    const lineTypeShowOnlyInline = document.getElementById('lineTypeShowOnlyOnPageInlineBtn');
    const linesShowOnlyBtn = document.getElementById('linesShowOnlyOnPageBtn');
    if (counterShowOnlyInline) counterShowOnlyInline.setAttribute('aria-pressed', !!state.counterSettings?.showOnlyCountersOnCurrentPage);
    if (lineTypeShowOnlyInline) lineTypeShowOnlyInline.setAttribute('aria-pressed', !!state.lineTypeSettings?.showOnlyLineTypesOnCurrentPage);
    if (linesShowOnlyBtn) linesShowOnlyBtn.setAttribute('aria-pressed', !!state.lineTypeSettings?.showOnlyLinesOnCurrentPage);
    const highlightBtnSidebar = document.getElementById('highlightBtnSidebar');
    if (highlightBtnSidebar) highlightBtnSidebar.classList.toggle('active', state.tool === TOOL.HIGHLIGHT);
    const multiplyZoneBtnSidebar = document.getElementById('multiplyZoneBtnSidebar');
    if (multiplyZoneBtnSidebar) multiplyZoneBtnSidebar.classList.toggle('active', state.tool === TOOL.MULTIPLY_ZONE);
    const scaleZoneBtnSidebar = document.getElementById('scaleZoneBtnSidebar');
    if (scaleZoneBtnSidebar) scaleZoneBtnSidebar.classList.toggle('active', state.tool === TOOL.SCALE_ZONE);
    const deleteZoneBtnSidebar = document.getElementById('deleteZoneBtnSidebar');
    if (deleteZoneBtnSidebar) deleteZoneBtnSidebar.classList.toggle('active', state.tool === TOOL.DELETE_ZONE);
    const roomBtnSidebarEl = document.getElementById('roomBtnSidebar');
    if (roomBtnSidebarEl) roomBtnSidebarEl.classList.toggle('active', state.tool === TOOL.ROOM);
    // Rooms sidebar section (features/room-sizer.js); deferred — the feature
    // file registers after app.js loads.
    if (App.renderRoomsList) App.renderRoomsList();
    const noteBtnSidebar = document.getElementById('noteBtnSidebar');
    if (noteBtnSidebar) noteBtnSidebar.classList.toggle('active', state.tool === TOOL.NOTE);
    const legendBtnEl = document.getElementById('legendBtn');
    const legendBtnSidebarEl = document.getElementById('legendBtnSidebar');
    if (legendBtnEl) legendBtnEl.classList.toggle('active', !!state.showLegendOverlay);
    if (legendBtnSidebarEl) legendBtnSidebarEl.classList.toggle('active', !!state.showLegendOverlay);
    if (legendBtnEl) legendBtnEl.disabled = !state.pages.length;
    if (legendBtnSidebarEl) legendBtnSidebarEl.disabled = !state.pages.length;
    const gridBtnEl = document.getElementById('gridBtn');
    const gridBtnSidebarEl = document.getElementById('gridBtnSidebar');
    if (gridBtnEl) gridBtnEl.classList.toggle('active', !!state.showGridOverlay);
    if (gridBtnSidebarEl) gridBtnSidebarEl.classList.toggle('active', !!state.showGridOverlay);
    if (gridBtnEl) gridBtnEl.disabled = !state.pages.length;
    if (gridBtnSidebarEl) gridBtnSidebarEl.disabled = !state.pages.length;
    document.getElementById('setScale').classList.toggle('active', state.tool === TOOL.SCALE);
    if (setScaleSidebarBtn) setScaleSidebarBtn.classList.toggle('active', state.tool === TOOL.SCALE);
    const measureBtn = document.getElementById('measureBtn');
    const measureBtnSidebar = document.getElementById('measureBtnSidebar');
    if (measureBtn) measureBtn.classList.toggle('active', state.tool === TOOL.MEASURE);
    if (measureBtnSidebar) measureBtnSidebar.classList.toggle('active', state.tool === TOOL.MEASURE);
    document.getElementById('doneEditing').style.display = (state.tool === TOOL.EDIT_POLY && !state.isViewer) ? 'block' : 'none';
    const doneEditingSidebar = document.getElementById('doneEditingSidebar');
    if (doneEditingSidebar) doneEditingSidebar.style.display = (state.tool === TOOL.EDIT_POLY && !state.isViewer) ? 'block' : 'none';
    if (state.isViewer && state.tool !== TOOL.NONE && state.tool !== TOOL.MEASURE && state.tool !== TOOL.SCALE) {
      state.tool = TOOL.NONE;
      state.activeCounterType = null;
      state.activeLineTypeId = null;
      state.quickLineStart = null;
      state.highlightStart = null;
      state.multiplyZoneStart = null;
      state.scaleZoneStart = null;
      state.deleteZoneStart = null;
      state.roomBoxStart = null;
      state.drawingPolyline = null;
      state.editingPolyline = null;
    }
    document.getElementById('polylineFinishBar').classList.toggle('visible', !!state.drawingPolyline);
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = !undoStackModel.canUndo() || !!state.isViewer;
    if (redoBtn) redoBtn.disabled = !undoStackModel.canRedo() || !!state.isViewer;
    // setScale/setScaleSidebar are deliberately NOT in this list: viewers see the
    // page's scale status on them and may set a temporary, local-only scale
    // (never saved - markProjectDirty/performAutoSave are viewer-inert) so the
    // Measure tool reads real units. See noteViewerTempScale.
    const viewerHideIds = ['counterBtn', 'quickLine', 'polylineBtn', 'highlightBtn', 'multiplyZoneBtn', 'scaleZoneBtn', 'deleteZoneBtn', 'noteBtn', 'legendBtn', 'legendBtnSidebar', 'undoBtn', 'redoBtn', 'counterBtnSidebar', 'quickLineSidebar', 'polylineBtnSidebar', 'highlightBtnSidebar', 'multiplyZoneBtnSidebar', 'scaleZoneBtnSidebar', 'deleteZoneBtnSidebar', 'noteBtnSidebar', 'doneEditing', 'doneEditingSidebar', 'clearPage', 'clearPageSidebar', 'exportBtn', 'exportBtnSidebar', 'importBtn', 'importBtnSidebar', 'saveProjectBtn', 'saveProjectBtnSidebar', 'addCounter', 'addLineType', 'addGroup', 'groupsSection', 'headerActiveCounter', 'headerActiveLineType', 'lineTypeSnapToHVHeaderBtn', 'plumBtn', 'plumLineBtn'];
    viewerHideIds.forEach(function(id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (state.isViewer) el.style.display = 'none';
      else if (id === 'doneEditing' || id === 'doneEditingSidebar') { /* keep tool-based display */ }
      else if (id === 'lineTypeSnapToHVHeaderBtn') { /* keep tool-based display from snap block */ }
      else el.style.display = '';
    });
    updateHideMarksButton();
    const activeLineEl = document.getElementById('headerActiveLineType');
    const activeCounterEl = document.getElementById('headerActiveCounter');
    if (activeLineEl) {
      const lt = state.tool === TOOL.LINE && state.activeLineTypeId ? state.lineTypes.find(l => l.id === state.activeLineTypeId) : null;
      if (lt) {
        activeLineEl.innerHTML = '<span class="header-type-swatch" style="background:' + (lt.color || '#4a9eff') + '"></span>';
        activeLineEl.classList.add('visible');
      } else {
        activeLineEl.innerHTML = '';
        activeLineEl.classList.remove('visible');
      }
    }
    if (activeCounterEl) {
      activeCounterEl.innerHTML = '';
      activeCounterEl.classList.remove('visible');
    }
    document.body.classList.toggle('supabase-enabled', !!SUPABASE_ENABLED);
    document.body.classList.toggle('has-project', !!state.currentProjectId);
    if (SUPABASE_ENABLED) {
      const authBtn = document.getElementById('authBtn');
      const authBtnSidebar = document.getElementById('authBtnSidebar');
      const saveProjectBtn = document.getElementById('saveProjectBtn');
      const saveProjectBtnSidebar = document.getElementById('saveProjectBtnSidebar');
      const loadProjectBtn = document.getElementById('loadProjectBtn');
      const loadProjectBtnSidebar = document.getElementById('loadProjectBtnSidebar');
      const manageUsersBtn = document.getElementById('manageUsersBtn');
      const manageUsersBtnSidebar = document.getElementById('manageUsersBtnSidebar');
      document.querySelectorAll('.supabase-only').forEach(el => { el.style.display = ''; });
      const loggedIn = !!(state.supabaseSession && state.supabaseSession.user);
      if (authBtn) authBtn.textContent = loggedIn ? (state.supabaseSession?.user?.email || 'Sign Out') : 'Sign In';
      if (authBtnSidebar) authBtnSidebar.textContent = loggedIn ? 'User' : 'Sign In';
      if (saveProjectBtn) saveProjectBtn.style.display = (loggedIn && !state.isViewer) ? '' : 'none';
      if (saveProjectBtnSidebar) saveProjectBtnSidebar.style.display = (loggedIn && !state.isViewer) ? '' : 'none';
      if (loadProjectBtn) loadProjectBtn.style.display = loggedIn ? '' : 'none';
      if (loadProjectBtnSidebar) loadProjectBtnSidebar.style.display = loggedIn ? '' : 'none';
      if (manageUsersBtn) manageUsersBtn.style.display = loggedIn && state.isAdmin ? '' : 'none';
      if (manageUsersBtnSidebar) manageUsersBtnSidebar.style.display = loggedIn && state.isAdmin ? '' : 'none';
      const settingsManageProjectsBtn = document.getElementById('settingsManageProjects');
      if (settingsManageProjectsBtn) settingsManageProjectsBtn.style.display = loggedIn && state.isAdmin ? '' : 'none';
      const globalReloadBtn = document.getElementById('advancedGlobalForceReload');
      if (globalReloadBtn) globalReloadBtn.style.display = (loggedIn && state.isAdmin) ? '' : 'none';
      const settingsSidebarBtn = document.getElementById('settingsSidebarBtn');
      if (settingsSidebarBtn) settingsSidebarBtn.style.display = loggedIn ? '' : 'none';
      const statusBarAuth = document.getElementById('statusBarAuth');
      if (statusBarAuth) { statusBarAuth.textContent = loggedIn ? (state.supabaseSession?.user?.email || 'Sign Out') : 'Sign In'; statusBarAuth.style.display = ''; }
    } else {
      document.querySelectorAll('.supabase-only').forEach(el => { el.style.display = 'none'; });
      document.querySelectorAll('#statusBarActions .supabase-only').forEach(el => { el.style.display = 'none'; });
    }
    const settingsCloseProject = document.getElementById('settingsCloseProject');
    if (settingsCloseProject) settingsCloseProject.style.display = (!state.pages.length && !state.currentProjectId) ? 'none' : '';
    const editBanner = document.getElementById('headerEditStatusBanner');
    if (editBanner) {
      const show = SUPABASE_ENABLED && state.supabaseSession?.user && (state.pages.length > 0 || state.currentProjectId);
      if (!show) {
        editBanner.style.display = 'none';
        editBanner.innerHTML = '';
        const sb = document.getElementById('sidebarCheckoutBanner');
        if (sb) { sb.innerHTML = ''; sb.className = 'sidebar-checkout-banner supabase-only'; }
      } else {
        editBanner.style.display = '';
        editBanner.className = 'header-edit-status supabase-only';
        editBanner.innerHTML = '';
        if (checkoutExpiredNeedsAttention && !state.isViewer && state.currentProjectId) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'header-edit-status-btn header-edit-status-btn-expired';
          btn.dataset.action = 'checkout_expired_recover';
          btn.textContent = '[Edit session expired — Re-check out]';
          editBanner.appendChild(btn);
          editBanner.classList.add('edit-status-expired');
        } else if (!state.isViewer && state.currentProjectId) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'header-edit-status-btn';
          btn.dataset.action = 'checkin';
          btn.textContent = '[Turn In]';
          editBanner.appendChild(btn);
          editBanner.classList.add('edit-status-editing');
        } else if (state.pages.length > 0 && !state.currentProjectId && !state.isViewer) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'header-edit-status-btn header-edit-status-btn-save';
          btn.dataset.action = 'save';
          const spanDefault = document.createElement('span');
          spanDefault.className = 'save-btn-label-default';
          spanDefault.textContent = 'Unsaved';
          const spanHover = document.createElement('span');
          spanHover.className = 'save-btn-label-hover';
          spanHover.textContent = 'Save';
          btn.appendChild(spanDefault);
          btn.appendChild(spanHover);
          editBanner.appendChild(btn);
          editBanner.classList.add('edit-status-editing');
        } else if (state.canCheckOut) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'header-edit-status-btn';
          btn.dataset.action = 'checkout';
          btn.textContent = '[Check out to Edit]';
          editBanner.appendChild(btn);
          editBanner.classList.add('edit-status-available');
        } else if (state.checkedOutEmail) {
          const span = document.createElement('span');
          span.textContent = state.checkedOutEmail + ' is editing';
          editBanner.appendChild(span);
          editBanner.classList.add('edit-status-viewing');
        } else {
          const span = document.createElement('span');
          span.textContent = 'Viewing only';
          editBanner.appendChild(span);
          editBanner.classList.add('edit-status-viewing');
        }
        const sidebarBanner = document.getElementById('sidebarCheckoutBanner');
        if (sidebarBanner) {
          sidebarBanner.className = 'sidebar-checkout-banner ' + editBanner.className.replace('header-edit-status', '').trim();
          sidebarBanner.innerHTML = editBanner.innerHTML;
        }
      }
    }
    document.body.classList.toggle('has-pdf', state.pages.length > 0);
    const uploadPdfEl = document.getElementById('uploadPdf');
    const uploadPdfSidebarEl = document.getElementById('uploadPdfSidebar');
    if (uploadPdfEl) uploadPdfEl.style.display = (state.pages.length || state.isViewer) ? 'none' : '';
    if (uploadPdfSidebarEl) uploadPdfSidebarEl.style.display = (state.pages.length || state.isViewer) ? 'none' : '';
    const dividerEls = document.querySelectorAll('.header-primary-divider');
    const hidePrimary = !!(state.pages.length || state.isViewer);
    dividerEls.forEach(el => { el.style.display = hidePrimary ? 'none' : ''; });
    const settingsAddAdditionalPages = document.getElementById('settingsAddAdditionalPages');
    if (settingsAddAdditionalPages) settingsAddAdditionalPages.style.display = (state.pages.length && !state.isViewer) ? '' : 'none';
    const settingsDownloadPdf = document.getElementById('settingsDownloadPdf');
    if (settingsDownloadPdf) settingsDownloadPdf.style.display = (state.pages.length && !state.isViewer && (state.pdfBuffer || state.pdfStoragePath)) ? '' : 'none';
    const advancedExportPdf = document.getElementById('advancedExportPdf');
    if (advancedExportPdf) advancedExportPdf.style.display = (state.pages.length && (state.pdfBuffer || state.pdfStoragePath)) ? '' : 'none';
    const advancedExportBtn = document.getElementById('advancedExport');
    if (advancedExportBtn) advancedExportBtn.style.display = (state.pages.length && projectHasAnyCanvasMarkup() && !state.isViewer) ? '' : 'none';
    const advancedLoadTestPdf = document.getElementById('advancedLoadTestPdf');
    if (advancedLoadTestPdf) advancedLoadTestPdf.style.display = (IS_DEV_HOST && !state.isViewer) ? '' : 'none';
    const settingsShareProject = document.getElementById('settingsShareProject');
    if (settingsShareProject) settingsShareProject.style.display = (SUPABASE_ENABLED && state.currentProjectId && state.supabaseSession?.user && !state.loadedViaViewLink) ? '' : 'none';
    const copyViewLinkBtn = document.getElementById('copyViewLinkBtn');
    if (copyViewLinkBtn) copyViewLinkBtn.style.display = (SUPABASE_ENABLED && state.currentProjectId && state.supabaseSession?.user && !state.loadedViaViewLink) ? '' : 'none';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const headerShareBtn = document.getElementById('headerShareBtn');
    if (headerShareBtn) headerShareBtn.classList.toggle('in-view-mode', !!(isMobile && SUPABASE_ENABLED && state.currentProjectId && state.supabaseSession?.user && state.isViewer));
    const sidebarLogoShare = document.getElementById('sidebarLogoShare');
    if (sidebarLogoShare) sidebarLogoShare.style.display = (SUPABASE_ENABLED && state.currentProjectId && state.supabaseSession?.user && !state.loadedViaViewLink && !(isMobile && state.isViewer)) ? '' : 'none';
    document.body.classList.toggle('mobile-view-mode', isMobile && !!state.isViewer);
    const settingsSaveProject = document.getElementById('settingsSaveProject');
    if (settingsSaveProject) {
      settingsSaveProject.style.display = state.isViewer ? 'none' : '';
      settingsSaveProject.textContent = (state.currentProjectId && state.pdfStoragePath)
        ? 'Save Changes'
        : 'Name / Upload / Save Project to Cloud';
    }
    const settingsAdvancedBtn = document.getElementById('settingsAdvancedBtn');
    if (settingsAdvancedBtn) settingsAdvancedBtn.style.display = '';
    const settingsClearPageBtn = document.getElementById('settingsClearPage');
    if (settingsClearPageBtn) settingsClearPageBtn.style.display = (state.pages.length > 0 && !state.isViewer) ? '' : 'none';
    const advancedCanvasRepair = document.getElementById('advancedCanvasRepair');
    if (advancedCanvasRepair) advancedCanvasRepair.style.display = (state.pages.length > 0 && !state.isViewer) ? '' : 'none';
    const advancedImport = document.getElementById('advancedImport');
    if (advancedImport) advancedImport.style.display = state.isViewer ? 'none' : '';
    const rotatePageBtn = document.getElementById('rotatePage');
    if (rotatePageBtn) rotatePageBtn.style.display = state.isViewer ? 'none' : '';
    renderPagesList();
    renderCanvasSwitcher();
    renderCountersList();
    const sidebarReorderBanner = document.getElementById('sidebarReorderBanner');
    const canReorder = state.counters.length >= 2 || state.lineTypes.length >= 2;
    if (sidebarReorderBanner) sidebarReorderBanner.style.display = (state.sidebarReorderModeActive && !state.isViewer && canReorder) ? 'flex' : 'none';
    document.body.classList.toggle('sidebar-reorder-mode-active', state.sidebarReorderModeActive);
    renderLineTypesList();
    renderGroupsList();
    renderLinesList();
    renderSummary();
    // App.hasAnyHighlights / hasAnyNotes are registered by features/pdf-bundle.js,
    // which loads AFTER app.js. updateUI is a hot path that can run during boot
    // before that feature <script> executes: supabase-js emits INITIAL_SESSION to
    // the onAuthStateChange callback (which calls updateUI) within the microtask
    // checkpoint right after app.js's <script>, ahead of the parser reaching the
    // feature scripts. Guard defensively per the registry idiom (App.fn && App.fn()).
    // At that point no annotations exist yet, so a hidden default is correct; the
    // next updateUI (post-load / on any state change) reflects the real state.
    const bundleBtn = document.getElementById('bundleHighlights');
    if (bundleBtn) bundleBtn.style.display = (App.hasAnyHighlights && App.hasAnyHighlights()) ? '' : 'none';
    const bundleNotesBtn = document.getElementById('bundleNotes');
    if (bundleNotesBtn) bundleNotesBtn.style.display = (App.hasAnyNotes && App.hasAnyNotes()) ? '' : 'none';
    // Cheap existence probe (report.js) — semantically identical to
    // getPipeToolingSummary().length > 0 but short-circuits at the first count
    // or line instead of building the whole summary (a real cost per updateUI
    // on large projects). Same load-order guard as the App.* checks above:
    // report.js loads after app.js, so this can run before it registers.
    const hasCountsOrLines = typeof window.getPipeToolingHasData === 'function' && window.getPipeToolingHasData();
    const ptBtn = document.getElementById('forPipeToolingDropdown');
    if (ptBtn) ptBtn.style.display = hasCountsOrLines ? '' : 'none';
    const copySummaryBtn = document.getElementById('copySummaryTextDropdown');
    if (copySummaryBtn) copySummaryBtn.style.display = hasCountsOrLines ? '' : 'none';
    const showReportDropdown = document.getElementById('showReportDropdown');
    if (showReportDropdown) showReportDropdown.style.display = hasCountsOrLines ? '' : 'none';
    const specificPagesBtn = document.getElementById('specificPages');
    if (specificPagesBtn) specificPagesBtn.style.display = hasCountsOrLines ? '' : 'none';
    const allCanvasesOnPageOpt = document.querySelector('.show-report-option[data-mode="all-canvases-on-page"]');
    if (allCanvasesOnPageOpt) {
      const page = state.pages[state.currentPage];
      const canvases = page ? getPageCanvases(page) : [];
      allCanvasesOnPageOpt.style.display = canvases.length > 1 ? '' : 'none';
    }
    const downloadCurrentPageDropdown = document.getElementById('downloadCurrentPageDropdown');
    if (downloadCurrentPageDropdown) downloadCurrentPageDropdown.style.display = state.pages.length > 0 ? 'inline-flex' : 'none';
    const exportDropdown = document.getElementById('exportDropdown');
    const showExportDropdownBase = !state.isViewer || state.pages.length > 0;
    const exportContent = document.getElementById('exportDropdownExportContent');
    const shieldImportMode = !state.isViewer && state.pages.length === 0;
    if (exportContent) exportContent.style.display = shieldImportMode ? 'none' : '';
    const exportDropdownBtn = document.getElementById('exportDropdownBtn');
    if (exportDropdownBtn) {
      if (shieldImportMode) {
        exportDropdownBtn.setAttribute('aria-label', 'Import PDF');
        exportDropdownBtn.title = 'Upload PDF to start';
        exportDropdownBtn.setAttribute('aria-haspopup', 'false');
      } else {
        exportDropdownBtn.setAttribute('aria-label', 'Export');
        exportDropdownBtn.title = 'Export project';
        exportDropdownBtn.setAttribute('aria-haspopup', 'menu');
      }
      const iconImport = document.getElementById('exportDropdownIconImport');
      const iconExport = document.getElementById('exportDropdownIconExport');
      if (iconImport) iconImport.style.display = shieldImportMode ? '' : 'none';
      if (iconExport) iconExport.style.display = shieldImportMode ? 'none' : '';
    }
    const exportPdfOpt = document.querySelector('.export-dropdown-option[data-action="pdf"]');
    const hasPdfExport = !!(state.pdfBuffer || state.pdfStoragePath);
    if (exportPdfOpt) exportPdfOpt.style.display = hasPdfExport ? '' : 'none';
    const exportCanvasOpt = document.querySelector('.export-dropdown-option[data-action="canvas"]');
    const exportBothOpt = document.querySelector('.export-dropdown-option[data-action="both"]');
    const hasCanvasMarkupForExport = projectHasAnyCanvasMarkup();
    if (!shieldImportMode) {
      const showCanvasBoth = hasCanvasMarkupForExport ? '' : 'none';
      if (exportCanvasOpt) exportCanvasOpt.style.display = showCanvasBoth;
      if (exportBothOpt) exportBothOpt.style.display = showCanvasBoth;
    }
    const exportImportCanvasOpt = document.querySelector('.export-dropdown-option[data-action="import-canvas"]');
    if (exportImportCanvasOpt) {
      const showImportCanvas = !shieldImportMode && !state.isViewer && !hasCanvasMarkupForExport ? '' : 'none';
      exportImportCanvasOpt.style.display = showImportCanvas;
    }
    let showExportDropdown = showExportDropdownBase;
    if (showExportDropdown && !shieldImportMode && exportContent) {
      const anyExportRow = hasPdfExport || hasCanvasMarkupForExport;
      if (!anyExportRow) showExportDropdown = false;
    }
    if (exportDropdown) exportDropdown.style.display = showExportDropdown ? 'inline-flex' : 'none';
    const allCanvasesOpt = document.querySelector('.download-page-option[data-mode="all-canvases"]');
    if (allCanvasesOpt) {
      const page = state.pages[state.currentPage];
      const canvases = page ? getPageCanvases(page) : [];
      allCanvasesOpt.style.display = canvases.length > 1 ? '' : 'none';
    }
    const allPagesOpt = document.querySelector('.download-page-option[data-mode="all-pages"]');
    const allPagesCanvasesOpt = document.querySelector('.download-page-option[data-mode="all-pages-canvases"]');
    if (allPagesOpt) allPagesOpt.style.display = state.pages.length > 1 ? '' : 'none';
    if (allPagesCanvasesOpt) allPagesCanvasesOpt.style.display = state.pages.length > 1 ? '' : 'none';
    if (App.updateBurgerMenu) App.updateBurgerMenu();
    if (App.scheduleHeaderCollapseCheck) App.scheduleHeaderCollapseCheck();
    document.querySelectorAll('.pipe-tooling-option[data-mode="this-canvas"], .copy-summary-option[data-mode="this-canvas"]').forEach(el => {
      el.style.display = state.pages.length <= 1 ? 'none' : '';
    });
    updateStatus();
    if (SUPABASE_ENABLED && state.currentProjectId) updateSaveStatusIndicator();
  }

  function renderCanvasSwitcher() {
    const switcher = document.getElementById('canvasSwitcher');
    const pillsEl = document.getElementById('canvasPills');
    const addBtn = document.getElementById('addCanvasBtn');
    const layersBtn = document.getElementById('canvasLayersBtn');
    const menuList = document.getElementById('canvasMenuList');
    const canvasMenu = document.getElementById('canvasMenu');
    if (!switcher || !pillsEl || !addBtn) return;
    const page = state.pages[state.currentPage];
    const canvases = page ? getPageCanvases(page) : [];
    const activeId = page ? (state.activeCanvasIdByPage[state.currentPage] || (canvases[0]?.id)) : null;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const canvasNameEl = document.getElementById('canvasCurrentName');
    if (canvasNameEl) {
      const activeCanvas = activeId ? canvases.find(c => c.id === activeId) : canvases[0];
      canvasNameEl.textContent = activeCanvas?.name || 'Main';
      canvasNameEl.style.display = state.pages.length > 0 ? '' : 'none';
    }
    const indexEl = document.getElementById('canvasIndexDisplay');
    if (indexEl) {
      if (canvases.length > 0 && activeId) {
        const idx = canvases.findIndex(c => c.id === activeId);
        const oneBased = idx >= 0 ? idx + 1 : 1;
        indexEl.textContent = '(' + oneBased + '/' + canvases.length + ')';
        indexEl.style.display = '';
      } else {
        indexEl.textContent = '';
        indexEl.style.display = 'none';
      }
    }
    pillsEl.innerHTML = '';
    if (canvases.length === 0) {
      pillsEl.style.display = 'none';
      addBtn.style.display = state.pages.length > 0 && !state.isViewer ? '' : 'none';
      if (pillsEl && !isMobile) pillsEl.classList.remove('canvas-pills-multi');
    } else {
      pillsEl.style.display = 'flex';
      addBtn.style.display = state.isViewer ? 'none' : '';
      if (pillsEl && !isMobile) pillsEl.classList.toggle('canvas-pills-multi', canvases.length >= 3);
      canvases.forEach(c => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'canvas-pill' + (c.id === activeId ? ' active' : '');
        pill.textContent = c.name || 'Main';
        pill.title = c.name || 'Main';
        pill.dataset.canvasId = c.id;
        pill.onclick = (e) => {
          e.stopPropagation();
          state.activeCanvasIdByPage[state.currentPage] = c.id;
          if (!state.isViewer) markProjectDirty();
          renderPdf();
          updateUI();
        };
        pillsEl.appendChild(pill);
      });
    }
    if (layersBtn && menuList && canvasMenu) {
      const showLayersDropdown = (isMobile || (!isMobile && canvases.length >= 1)) && state.pages.length > 0;
      layersBtn.style.display = showLayersDropdown ? '' : 'none';
      layersBtn.classList.toggle('canvas-layers-multi', canvases.length > 1);
      const canvasMenuAdd = document.getElementById('canvasMenuAdd');
      if (canvasMenuAdd) canvasMenuAdd.style.display = state.isViewer ? 'none' : '';
      switcher?.classList.toggle('canvas-layers-desktop-visible', !isMobile && canvases.length >= 1);
      const showAllBtn = document.getElementById('showAllCanvasesBtn');
      if (showAllBtn) {
        // Only meaningful with 2+ layers; desktop only (the mobile switcher is
        // already the compact layers menu). Auto-off when layers drop to one.
        if (state.showAllCanvases && canvases.length < 2) state.showAllCanvases = false;
        showAllBtn.style.display = (!isMobile && canvases.length > 1 && state.pages.length > 0) ? '' : 'none';
        showAllBtn.classList.toggle('active', !!state.showAllCanvases);
        showAllBtn.title = state.showAllCanvases
          ? 'Showing all canvases — click to show only the active canvas'
          : 'Temporarily show all canvases at once';
      }
      menuList.innerHTML = '';
      canvases.forEach(c => {
        const row = document.createElement('div');
        row.className = 'canvas-menu-item' + (c.id === activeId ? ' active' : '');
        row.dataset.canvasId = c.id;
        const nameSpan = document.createElement('span');
        nameSpan.textContent = c.name || 'Main';
        nameSpan.style.flex = '1';
        nameSpan.style.minWidth = '0';
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.style.whiteSpace = 'nowrap';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'canvas-menu-item-edit';
        editBtn.title = 'Edit';
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16"><path fill="currentColor" d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/></svg>';
        editBtn.onclick = (e) => {
          e.stopPropagation();
          if (state.isViewer) return;
          App.openCanvasDetailsModal(c);
        };
        row.appendChild(editBtn);
        row.appendChild(nameSpan);
        row.onclick = (e) => {
          if (e.target.closest('.canvas-menu-item-edit')) return;
          e.stopPropagation();
          state.activeCanvasIdByPage[state.currentPage] = c.id;
          if (!state.isViewer) markProjectDirty();
          renderPdf();
          updateUI();
          canvasMenu.classList.remove('visible');
        };
        menuList.appendChild(row);
      });
    }
  }

  function formatPageTitleStartEnd(label, truncated) {
    if (!truncated || !label || label.length <= 28) return label;
    const half = Math.floor((label.length - 6) / 2);
    const nFirst = Math.min(24, half);
    const nLast = Math.min(14, half);
    if (nFirst <= 0 && nLast <= 0) return label.slice(0, 37) + '...';
    return { first: label.slice(0, nFirst), last: label.slice(-nLast) };
  }

  function renderPagesList() {
    const el = document.getElementById('pagesList');
    el.classList.toggle('pages-titles-truncated', !!state.pagesTitlesTruncated);
    el.innerHTML = '';
    const showEdit = !state.isViewer;
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    state.pages.forEach((p, i) => {
      if (state.hideUnmarkedPagesFromSidebar && !pageHasAnyAnnotations(p)) return;
      const div = document.createElement('div');
      div.className = 'sidebar-item' + (state.currentPage === i ? ' active' : '');
      const hasAnn = pageHasAnyAnnotations(p);
      const hasScale = !!p.scale;
      const rawLabel = p.label || 'Page ' + (i + 1);
      const formatted = formatPageTitleStartEnd(rawLabel, state.pagesTitlesTruncated);
      let nameHtml;
      const nameTitle = typeof formatted === 'object' ? rawLabel : '';
      if (typeof formatted === 'object') {
        nameHtml = '<span class="name-line name-line-start">' + esc(formatted.first) + '...</span><span class="name-line name-line-end">...' + esc(formatted.last) + '</span>';
      } else {
        nameHtml = esc(formatted);
      }
      const canvasCount = getPageCanvases(p).length;
      const canvasBadge = canvasCount > 1 ? '<span class="badge badge-canvas-count" title="' + canvasCount + ' canvases">' + canvasCount + '</span>' : '';
      const pageNumBadgeClass = 'badge' + (hasScale ? ' badge-scale-set' : '') + (hasAnn ? ' badge-has-ann' : '') + (showEdit ? ' page-num-badge-editable' : '');
      div.innerHTML = '<span class="page-num-badge-wrap"><span class="' + pageNumBadgeClass + '" title="' + (showEdit ? 'Click to rename or delete' : '') + '">' + (i + 1) + '</span>' + canvasBadge + '</span><span class="name"' + (nameTitle ? ' title="' + esc(nameTitle) + '"' : '') + '>' + nameHtml + '</span>';
      div.onclick = (e) => { if (!e.target.closest('.page-num-badge-wrap') && !e.target.closest('.page-delete-btn')) { state.currentPage = i; fitZoom(); } };
      if (showEdit) {
        const deletePage = () => {
          if (state.pages.length <= 1) { alert('Cannot delete the only page.'); return; }
          pushUndoSnapshot();
          state.pages.splice(i, 1);
          if (state.currentPage >= state.pages.length) state.currentPage = Math.max(0, state.pages.length - 1);
          else if (state.currentPage > i) state.currentPage--;
          if (state.selectedLinePageIdx === i) { state.selectedLineId = null; state.selectedLinePageIdx = null; }
          else if (state.selectedLinePageIdx > i) state.selectedLinePageIdx--;
          if (state.editingPolyline && state.editingPolyIndex === i) exitEditMode(false);
          else if (state.editingPolyline && state.editingPolyIndex > i) state.editingPolyIndex--;
          markProjectDirty();
          updateUI();
          renderPdf();
          fitZoom();
        };
        const pageName = p.label || 'Page ' + (i + 1);
        const openRename = () => startRename(div.querySelector('.name'), (v) => { pushUndoSnapshot(); p.label = v; markProjectDirty(); updateUI(); }, { onDelete: deletePage, pageName });
        const pageNumBadge = div.querySelector('.page-num-badge-editable');
        if (pageNumBadge) pageNumBadge.addEventListener('click', (e) => { e.stopPropagation(); openRename(); });
        onDoubleTapOrDblClick(div.querySelector('.name'), openRename);
      }
      el.appendChild(div);
    });
  }

  function renderCountersList() {
    const el = document.getElementById('countersList');
    el.innerHTML = '';
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const showEdit = !state.isViewer;
    const q = (state.counterSearch || '').trim().toLowerCase();
    const filtered = q ? state.counters.filter(c => (c.name || 'Counter').toLowerCase().includes(q)) : state.counters;
    filtered.forEach(c => {
      if (state.counterSettings?.showOnlyCountersOnCurrentPage && state.pages.length > 0) {
        const page = state.pages[state.currentPage];
        const ann = getActiveAnnotations(page, state.currentPage);
        const markers = (ann?.counterMarkers?.[c.id] || []);
        if (markers.length === 0) return;
      }
      const div = document.createElement('div');
      div.className = 'sidebar-item' + (state.activeCounterType === c.id && showEdit ? ' active' : '');
      const count = state.pages.reduce((n, p, pi) => n + ((getActiveAnnotations(p, pi)?.counterMarkers?.[c.id] || []).length), 0);
      div.innerHTML = '<span class="counter-drag-handle icon-svg" title="Drag to reorder"><svg viewBox="' + iconVbFor(c.icon) + '" width="20" height="20"><path fill="' + c.color + '" d="' + c.icon + '"/></svg></span><span class="name">' + esc(c.name || 'Counter') + '</span><span class="badge">' + count + '</span>' + (showEdit ? '<span class="swatch" style="background:' + c.color + '"></span><span class="edit-btn" title="Edit">✎</span>' : '');
      if (showEdit) {
        div.dataset.counterId = c.id;
        const handle = div.querySelector('.counter-drag-handle');
        if (handle) {
          handle.draggable = state.sidebarReorderModeActive && state.counters.length >= 2;
          handle.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', c.id);
            e.dataTransfer.effectAllowed = 'move';
            div.classList.add('counter-dragging');
          };
          handle.ondragend = () => div.classList.remove('counter-dragging');
        }
        div.ondragover = (e) => { if (!state.sidebarReorderModeActive) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        div.ondrop = (e) => {
          e.preventDefault();
          if (!state.sidebarReorderModeActive) return;
          const fromId = e.dataTransfer.getData('text/plain');
          const toId = div.dataset.counterId;
          if (fromId === toId) return;
          const fromIdx = state.counters.findIndex(x => x.id === fromId);
          const toIdx = state.counters.findIndex(x => x.id === toId);
          if (fromIdx < 0 || toIdx < 0) return;
          const [moved] = state.counters.splice(fromIdx, 1);
          state.counters.splice(toIdx, 0, moved);
          pushUndoSnapshot();
          markProjectDirty();
          updateUI();
        };
        div.onclick = (e) => { if (!e.target.closest('.swatch') && !e.target.closest('.edit-btn') && !(state.sidebarReorderModeActive && e.target.closest('.counter-drag-handle'))) { state.activeCounterType = state.activeCounterType === c.id ? null : c.id; state.tool = state.activeCounterType ? TOOL.COUNTER : TOOL.NONE; if (state.activeCounterType) { state.pagesListCollapsed = true; document.getElementById('pagesSection').classList.add('collapsed'); document.getElementById('pagesCollapseIcon').textContent = '▶'; } updateUI(); } };
        div.querySelector('.swatch')?.addEventListener('click', (e) => { e.stopPropagation(); App.showLineColorModal(c.color || '#e8c547', (color) => { pushUndoSnapshot(); c.color = color; markProjectDirty(); }); });
        div.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); App.openCounterLineTypeDetailsModal('counter', c); });
      }
      el.appendChild(div);
    });
  }

  function renderLineTypesList() {
    const el = document.getElementById('lineTypesList');
    el.innerHTML = '';
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const showEdit = !state.isViewer;
    const q = (state.lineTypeSearch || '').trim().toLowerCase();
    const filtered = q ? state.lineTypes.filter(lt => (lt.name || 'Line').toLowerCase().includes(q)) : state.lineTypes;
    filtered.forEach(lt => {
      if (state.lineTypeSettings?.showOnlyLineTypesOnCurrentPage && state.pages.length > 0) {
        const page = state.pages[state.currentPage];
        const ann = getActiveAnnotations(page, state.currentPage);
        const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
        const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
        if (qLines.length === 0 && polys.length === 0) return;
      }
      let runs = 0, len = 0;
      const pageIndices = [];
      state.pages.forEach((p, pi) => {
        const ann = getActiveAnnotations(p, pi);
        const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
        const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
        if (qLines.length || polys.length) pageIndices.push(pi);
        qLines.forEach(q => { runs++; len += getLineLengthFeetForTotals(q, pi, false, ann); });
        polys.forEach(poly => { runs++; len += getLineLengthFeetForTotals(poly, pi, true, ann); });
      });
      const scale = pickScaleForLineType(pageIndices);
      const div = document.createElement('div');
      div.className = 'sidebar-item sidebar-item-line-type' + (state.activeLineTypeId === lt.id && showEdit ? ' active' : '');
      div.innerHTML = '<span class="name line-type-name">' + esc(lt.name || 'Line') + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch line-type-drag-handle" style="background:' + lt.color + '" title="Drag to reorder"></span>' : '') + '<span class="badge">' + runs + ' · ' + formatFeet(len, scale) + '</span>' + (showEdit ? '<span class="edit-btn" title="Edit">✎</span>' : '') + '</div>';
      if (showEdit) {
        div.dataset.lineTypeId = lt.id;
        const handle = div.querySelector('.line-type-drag-handle');
        if (handle) {
          handle.draggable = state.sidebarReorderModeActive && state.lineTypes.length >= 2;
          handle.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', lt.id);
            e.dataTransfer.effectAllowed = 'move';
            div.classList.add('line-type-dragging');
          };
          handle.ondragend = () => div.classList.remove('line-type-dragging');
        }
        div.ondragover = (e) => { if (!state.sidebarReorderModeActive) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        div.ondrop = (e) => {
          e.preventDefault();
          if (!state.sidebarReorderModeActive) return;
          const fromId = e.dataTransfer.getData('text/plain');
          const toId = div.dataset.lineTypeId;
          if (fromId === toId) return;
          const fromIdx = state.lineTypes.findIndex(x => x.id === fromId);
          const toIdx = state.lineTypes.findIndex(x => x.id === toId);
          if (fromIdx < 0 || toIdx < 0) return;
          const [moved] = state.lineTypes.splice(fromIdx, 1);
          state.lineTypes.splice(toIdx, 0, moved);
          pushUndoSnapshot();
          markProjectDirty();
          updateUI();
        };
        div.onclick = (e) => { if (!e.target.closest('.swatch') && !e.target.closest('.edit-btn') && !e.target.closest('.line-type-drag-handle')) { state.activeLineTypeId = state.activeLineTypeId === lt.id ? null : lt.id; state.tool = state.activeLineTypeId ? TOOL.LINE : TOOL.NONE; if (state.activeLineTypeId) { state.quickLineStart = null; state.pagesListCollapsed = true; document.getElementById('pagesSection').classList.add('collapsed'); document.getElementById('pagesCollapseIcon').textContent = '▶'; } updateUI(); } };
        div.querySelector('.swatch')?.addEventListener('click', (e) => { e.stopPropagation(); App.showLineColorModal(lt.color || '#4a9eff', (color) => { pushUndoSnapshot(); lt.color = color; markProjectDirty(); }); });
        div.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); App.openCounterLineTypeDetailsModal('lineType', lt); });
      }
      el.appendChild(div);
    });
  }

  function renderGroupsList() {
    const el = document.getElementById('groupsList');
    if (!el) return;
    el.innerHTML = '';
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const showEdit = !state.isViewer;
    const groups = state.groups || [];
    groups.forEach(g => {
      const count = countItemsInGroup(g.id);
      const div = document.createElement('div');
      div.className = 'sidebar-item sidebar-item-line-type' + (state.activeGroupId === g.id && showEdit ? ' active' : '');
      div.innerHTML = '<span class="name line-type-name">' + esc(g.name || 'Group') + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch" style="background:' + (g.color || COLORS[0]) + '"></span>' : '') + '<span class="badge">' + count + '</span>' + (showEdit ? '<span class="edit-btn" title="Edit">✎</span>' : '') + '</div>';
      if (showEdit) {
        div.onclick = (e) => {
          if (!e.target.closest('.swatch') && !e.target.closest('.edit-btn')) {
            state.activeGroupId = state.activeGroupId === g.id ? null : g.id;
            updateUI();
          }
        };
        div.querySelector('.swatch')?.addEventListener('click', (e) => { e.stopPropagation(); App.showLineColorModal(g.color || COLORS[0], (color) => { pushUndoSnapshot(); g.color = color; markProjectDirty(); updateUI(); renderPdf(); }); });
        div.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); App.openGroupModal(g); });
      }
      el.appendChild(div);
    });
  }

  function countItemsInGroup(groupId) {
    let n = 0;
    state.pages.forEach(p => {
      getPageCanvases(p).forEach(c => {
        const ann = c.annotations || makeAnnotations();
        Object.values(ann.counterMarkers || {}).forEach(arr => arr.forEach(m => { if ((m.group || null) === groupId) n++; }));
        (ann.quickLines || []).forEach(q => { if ((q.group || null) === groupId) n++; });
        (ann.polylines || []).forEach(poly => { if ((poly.group || null) === groupId) n++; });
      });
    });
    return n;
  }

  function renderLinesList() {
    const el = document.getElementById('linesList');
    el.innerHTML = '';
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const byType = {};
    state.pages.forEach((p, pi) => {
      if (state.lineTypeSettings?.showOnlyLinesOnCurrentPage && state.pages.length > 0 && pi !== state.currentPage) return;
      const ann = getActiveAnnotations(p, pi);
      (ann?.polylines || []).forEach(poly => {
        const tid = poly.lineTypeId || '_none';
        if (!byType[tid]) byType[tid] = [];
        byType[tid].push({ type: 'poly', poly, pageIdx: pi });
      });
      (ann?.quickLines || []).forEach(q => {
        const tid = q.lineTypeId || '_none';
        if (!byType[tid]) byType[tid] = [];
        byType[tid].push({ type: 'quick', q, pageIdx: pi });
      });
    });
    const linesQ = (state.linesSearch || '').trim().toLowerCase();
    const filterItem = (it) => {
      if (!linesQ) return true;
      const name = it.type === 'poly' ? (it.poly.name || 'Polyline') : (it.q.name || 'Quick line');
      return name.toLowerCase().includes(linesQ);
    };
    const showEdit = !state.isViewer;
    Object.entries(byType).forEach(([tid, items]) => {
      const filteredItems = linesQ ? items.filter(filterItem) : items;
      if (linesQ && filteredItems.length === 0) return;
      const lt = tid === '_none' ? null : state.lineTypes.find(l => l.id === tid);
      const typeName = lt ? (lt.name || 'Line') : 'Unassigned';
      const pageIndices = [...new Set(filteredItems.map(it => it.pageIdx))];
      let totalLen = 0;
      filteredItems.forEach(it => {
        const p = state.pages[it.pageIdx];
        const annIt = p ? getActiveAnnotations(p, it.pageIdx) : makeAnnotations();
        totalLen += it.type === 'poly' ? getLineLengthFeetForTotals(it.poly, it.pageIdx, true, annIt) : getLineLengthFeetForTotals(it.q, it.pageIdx, false, annIt);
      });
      const scale = pickScaleForLineType(pageIndices);
      const summary = filteredItems.length + ' lines · ' + formatFeet(totalLen, scale);
      const expanded = !!state.linesTypeExpanded[tid];
      const groupWrapper = document.createElement('div');
      groupWrapper.className = 'lines-type-group' + (expanded ? '' : ' collapsed');
      const header = document.createElement('div');
      header.className = 'lines-type-header';
      header.innerHTML = '<span class="lines-type-name">' + esc(typeName) + '</span><span class="lines-type-summary">' + summary + '</span><span class="collapse-icon lines-type-collapse-icon">' + (expanded ? '▼' : '▶') + '</span>';
      header.onclick = () => {
        state.linesTypeExpanded[tid] = !state.linesTypeExpanded[tid];
        try { localStorage.setItem('linesTypeExpanded', JSON.stringify(state.linesTypeExpanded)); } catch (_) {}
        groupWrapper.classList.toggle('collapsed', !state.linesTypeExpanded[tid]);
        header.querySelector('.lines-type-collapse-icon').textContent = state.linesTypeExpanded[tid] ? '▼' : '▶';
      };
      groupWrapper.appendChild(header);
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'lines-type-items';
      filteredItems.forEach(it => {
      const lineId = it.type === 'poly' ? it.poly.id : it.q.id;
      const isSelected = state.selectedLineId === lineId && state.selectedLinePageIdx === it.pageIdx;
      const div = document.createElement('div');
      div.className = 'sidebar-item sidebar-item-line-type' + (isSelected ? ' active' : '');
      const ltItem = state.lineTypes.find(l => l.id === (it.type === 'poly' ? it.poly.lineTypeId : it.q.lineTypeId));
      const color = (it.type === 'poly' ? it.poly.color : it.q.color) || (ltItem?.color || '#4a9eff');
      const pageScale = state.pages[it.pageIdx]?.scale;
      const annRow = state.pages[it.pageIdx] ? getActiveAnnotations(state.pages[it.pageIdx], it.pageIdx) : makeAnnotations();
      let dist, name;
      if (it.type === 'poly') {
        dist = it.poly.closed ? formatArea(polygonArea(it.poly.points || []), pageScale) : formatFeet(getLineRealWorldLengthFeet(it.poly, it.pageIdx, true, annRow), getEffectiveScaleForLine(annRow, it.poly, true, it.pageIdx));
        name = it.poly.name || 'Polyline';
      } else {
        dist = formatFeet(getLineRealWorldLengthFeet(it.q, it.pageIdx, false, annRow), getEffectiveScaleForLine(annRow, it.q, false, it.pageIdx));
        name = it.q.name || 'Quick line';
      }
      const line = it.type === 'poly' ? it.poly : it.q;
      const sd = line.startDrop || 0, ed = line.endDrop || 0;
      let dropsHtml = '';
      if (sd > 0 || ed > 0) {
        const su = line.startDropUnit || pageScale?.unit, eu = line.endDropUnit || pageScale?.unit;
        const parts = [];
        if (sd > 0) parts.push('↧ ' + sd + (su ? ' ' + su : ''));
        if (ed > 0) parts.push('↧ ' + ed + (eu ? ' ' + eu : ''));
        dropsHtml = '<div class="line-drops">' + parts.join(' + ') + '</div>';
      }
      div.innerHTML = '<span class="name line-type-name">' + esc(name) + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch" style="background:' + color + '"></span>' : '') + '<span class="badge">' + dist + '</span>' + (showEdit ? '<span class="edit-btn" title="' + (it.type === 'poly' ? 'Edit vertices' : 'Rename') + '">✎</span>' : '') + '</div>' + dropsHtml;
      div.onclick = (e) => {
        if (showEdit && (e.target.closest('.swatch') || e.target.closest('.edit-btn'))) return;
        if (isSelected) {
          state.selectedLineId = null;
          state.selectedLineIsPoly = false;
          state.selectedLinePageIdx = null;
          updateUI();
          renderPdf();
        } else if (lineId) {
          state.selectedLineId = lineId;
          state.selectedLineIsPoly = it.type === 'poly';
          state.selectedLinePageIdx = it.pageIdx;
          state.currentPage = it.pageIdx;
          fitZoom();
        }
      };
      if (showEdit) {
        const swatch = div.querySelector('.swatch');
        if (swatch) swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          App.showLineColorModal(
            (it.type === 'poly' ? it.poly.color : it.q.color) || (ltItem?.color || '#4a9eff'),
            (color) => {
              pushUndoSnapshot();
              if (it.type === 'poly') it.poly.color = color;
              else it.q.color = color;
              markProjectDirty();
            }
          );
        });
        const editBtn = div.querySelector('.edit-btn');
        if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); App.openLinePropertiesModal(it); };
        onDoubleTapOrDblClick(div.querySelector('.name'), () => App.openLinePropertiesModal(it));
      }
      itemsContainer.appendChild(div);
    });
      groupWrapper.appendChild(itemsContainer);
      el.appendChild(groupWrapper);
    });
  }

  function renderSummary() {
    const el = document.getElementById('summaryList');
    el.innerHTML = '';
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const groups = state.groups || [];
    const getGroupName = (gid) => (gid && groups.find(g => g.id === gid))?.name || 'Untagged';
    let hasAnyGroups = false;
    state.pages.forEach((p, pi) => {
      const ann = getActiveAnnotations(p, pi);
      Object.values(ann?.counterMarkers || {}).forEach(arr => arr.forEach(m => { if (m.group) hasAnyGroups = true; }));
      (ann?.quickLines || []).forEach(q => { if (q.group) hasAnyGroups = true; });
      (ann?.polylines || []).forEach(poly => { if (poly.group) hasAnyGroups = true; });
    });
    const counterByGroup = {};
    const lineTypeByGroup = {};
    state.pages.forEach((p, pi) => {
      const ann = getActiveAnnotations(p, pi);
      (state.counters || []).forEach(c => {
        (ann?.counterMarkers?.[c.id] || []).forEach(m => {
          const gid = m.group || null;
          if (!counterByGroup[gid]) counterByGroup[gid] = {};
          if (!counterByGroup[gid][c.id]) counterByGroup[gid][c.id] = { name: c.name, total: 0, pageIndices: [] };
          counterByGroup[gid][c.id].total += getMultiplyZoneForPoint(ann, m);
          if (!counterByGroup[gid][c.id].pageIndices.includes(pi)) counterByGroup[gid][c.id].pageIndices.push(pi);
        });
      });
      (state.lineTypes || []).forEach(lt => {
        (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
          const gid = q.group || null;
          if (!lineTypeByGroup[gid]) lineTypeByGroup[gid] = {};
          if (!lineTypeByGroup[gid][lt.id]) lineTypeByGroup[gid][lt.id] = { name: lt.name, runs: 0, len: 0, pageIndices: [] };
          lineTypeByGroup[gid][lt.id].runs++;
          lineTypeByGroup[gid][lt.id].len += getLineLengthFeetForTotals(q, pi, false, ann);
          if (!lineTypeByGroup[gid][lt.id].pageIndices.includes(pi)) lineTypeByGroup[gid][lt.id].pageIndices.push(pi);
        });
        (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          const gid = poly.group || null;
          if (!lineTypeByGroup[gid]) lineTypeByGroup[gid] = {};
          if (!lineTypeByGroup[gid][lt.id]) lineTypeByGroup[gid][lt.id] = { name: lt.name, runs: 0, len: 0, pageIndices: [] };
          lineTypeByGroup[gid][lt.id].runs++;
          lineTypeByGroup[gid][lt.id].len += getLineLengthFeetForTotals(poly, pi, true, ann);
          if (!lineTypeByGroup[gid][lt.id].pageIndices.includes(pi)) lineTypeByGroup[gid][lt.id].pageIndices.push(pi);
        });
      });
    });
    const allGroupIds = [...new Set([...Object.keys(counterByGroup), ...Object.keys(lineTypeByGroup)])];
    const isUntagged = (x) => x == null || x === '' || String(x) === 'null' || String(x) === 'undefined';
    const orderedGroupIds = hasAnyGroups ? allGroupIds.sort((a, b) => {
      if (isUntagged(a)) return 1;
      if (isUntagged(b)) return -1;
      return getGroupName(a).localeCompare(getGroupName(b));
    }) : [];
    const renderItems = (gid) => {
      const counters = counterByGroup[gid] || {};
      const lineTypes = lineTypeByGroup[gid] || {};
      (state.counters || []).forEach(c => {
        const r = counters[c.id];
        if (r && r.total > 0) {
          const div = document.createElement('div');
          div.className = 'sidebar-item summary-item-clickable';
          div.dataset.type = 'counter';
          div.dataset.id = c.id;
          div.innerHTML = '<span class="name">' + esc(r.name) + '</span><span class="badge">[' + r.total + ']</span>';
          div.onclick = () => openSummaryCountDetailModal('counter', c.id);
          el.appendChild(div);
        }
      });
      (state.lineTypes || []).forEach(lt => {
        const r = lineTypes[lt.id];
        if (r && r.runs > 0) {
          const scale = pickScaleForLineType(r.pageIndices);
          const div = document.createElement('div');
          div.className = 'sidebar-item summary-item-clickable summary-line-item';
          div.dataset.type = 'lineType';
          div.dataset.id = lt.id;
          div.innerHTML = '<span class="name">' + esc(r.name) + '</span><span class="summary-line-meta">' + r.runs + ' lines · ' + formatFeet(r.len, scale) + '</span>';
          div.onclick = () => openSummaryCountDetailModal('lineType', lt.id);
          el.appendChild(div);
        }
      });
    };
    if (hasAnyGroups && orderedGroupIds.length > 0) {
      orderedGroupIds.forEach(gid => {
        const groupName = getGroupName(gid);
        const hasItems = Object.keys(counterByGroup[gid] || {}).some(cid => (counterByGroup[gid][cid]?.total || 0) > 0) ||
          Object.keys(lineTypeByGroup[gid] || {}).some(lid => (lineTypeByGroup[gid][lid]?.runs || 0) > 0);
        if (!hasItems) return;
        const h = document.createElement('h3');
        h.style.cssText = 'font-size:0.7rem;color:var(--text3);margin:8px 0 4px 0;';
        h.textContent = 'Group: ' + groupName;
        el.appendChild(h);
        renderItems(gid);
      });
    } else {
      state.counters.forEach(c => {
        const count = state.pages.reduce((n, p, pi) => {
          const ann = getActiveAnnotations(p);
          return n + ((ann?.counterMarkers?.[c.id] || []).reduce((s, m) => s + getMultiplyZoneForPoint(ann, m), 0));
        }, 0);
        if (count > 0) {
          const div = document.createElement('div');
          div.className = 'sidebar-item summary-item-clickable';
          div.dataset.type = 'counter';
          div.dataset.id = c.id;
          div.innerHTML = '<span class="name">' + esc(c.name) + '</span><span class="badge">[' + count + ']</span>';
          div.onclick = () => openSummaryCountDetailModal('counter', c.id);
          el.appendChild(div);
        }
      });
      state.lineTypes.forEach(lt => {
        let runs = 0, len = 0;
        const pageIndices = [];
        state.pages.forEach((p, pi) => {
          const ann = getActiveAnnotations(p);
          const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
          const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
          if (qLines.length || polys.length) pageIndices.push(pi);
          qLines.forEach(q => { runs++; len += getLineLengthFeetForTotals(q, pi, false, ann); });
          polys.forEach(poly => { runs++; len += getLineLengthFeetForTotals(poly, pi, true, ann); });
        });
        if (runs > 0) {
          const scale = pickScaleForLineType(pageIndices);
          const div = document.createElement('div');
          div.className = 'sidebar-item summary-item-clickable summary-line-item';
          div.dataset.type = 'lineType';
          div.dataset.id = lt.id;
          div.innerHTML = '<span class="name">' + esc(lt.name) + '</span><span class="summary-line-meta">' + runs + ' lines · ' + formatFeet(len, scale) + '</span>';
          div.onclick = () => openSummaryCountDetailModal('lineType', lt.id);
          el.appendChild(div);
        }
      });
    }
  }

  async function openSummaryCountDetailModal(type, id) {
    const titleEl = document.getElementById('summaryCountDetailTitle');
    const listEl = document.getElementById('summaryCountDetailList');
    const exportOverrides = { markerScale: state.exportSettings?.markerScale ?? 0.75, lineScale: state.exportSettings?.lineScale ?? 0.75 };
    const THUMB_WIDTH = 200;
    let items = [];
    if (type === 'counter') {
      const c = state.counters.find(x => x.id === id);
      if (!c) return;
      titleEl.textContent = (c.name || 'Counter') + ' — by page';
      state.pages.forEach((p, pageIdx) => {
        const ann = getActiveAnnotations(p);
        const markers = ann?.counterMarkers?.[id] || [];
        if (markers.length > 0) {
          const count = markers.reduce((s, m) => s + getMultiplyZoneForPoint(ann, m), 0);
          items.push({ pageIdx, pageLabel: p.label || 'Page ' + (pageIdx + 1), count, isCounter: true });
        }
      });
    } else {
      const lt = state.lineTypes.find(x => x.id === id);
      if (!lt) return;
      titleEl.textContent = (lt.name || 'Line type') + ' — by page';
      state.pages.forEach((p, pageIdx) => {
        const ann = getActiveAnnotations(p);
        let runs = 0, len = 0;
        (ann?.quickLines || []).filter(q => q.lineTypeId === id).forEach(q => { runs++; len += getLineLengthFeetForTotals(q, pageIdx, false, ann); });
        (ann?.polylines || []).filter(poly => poly.lineTypeId === id).forEach(poly => { runs++; len += getLineLengthFeetForTotals(poly, pageIdx, true, ann); });
        if (runs > 0) items.push({ pageIdx, pageLabel: p.label || 'Page ' + (pageIdx + 1), runs, length: len, isCounter: false });
      });
    }
    if (!items.length) return;
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    listEl.innerHTML = '<p style="color:var(--text2);">Loading…</p>';
    showModal('summaryCountDetailModal');
    listEl.innerHTML = '';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const page = state.pages[it.pageIdx];
      const fullLabel = it.pageLabel || 'Page ' + (it.pageIdx + 1);
      let docName = 'document.pdf';
      let pagePart = 'p' + (it.pageIdx + 1);
      if (fullLabel.indexOf(' — ') >= 0) {
        const parts = fullLabel.split(' — ');
        docName = (parts[0] || 'document.pdf').trim();
        pagePart = (parts[1] || pagePart).trim();
      } else if (fullLabel.toLowerCase().endsWith('.pdf')) {
        docName = fullLabel;
        pagePart = 'p' + (it.pageIdx + 1);
      } else {
        pagePart = fullLabel;
      }
      const row = document.createElement('div');
      row.className = 'summary-count-detail-row';
      let metaHtml = '<div class="summary-count-detail-meta">';
      metaHtml += '<span class="summary-count-detail-count">' + esc(it.isCounter ? String(it.count) : String(it.runs)) + '</span>';
      if (!it.isCounter) {
        const ps = getPageScale(it.pageIdx);
        metaHtml += '<span class="summary-count-detail-length">' + esc(formatFeet(it.length, ps)) + '</span>';
      }
      metaHtml += '<span class="summary-count-detail-page">on ' + esc(pagePart) + '</span></div>';
      row.innerHTML = metaHtml;
      if (page.pdfPage) {
        try {
          const natView = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
          const scale = THUMB_WIDTH / natView.width;
          const viewport = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
          const pageW = viewport.width, pageH = viewport.height;
          const canvas = document.createElement('canvas');
          canvas.width = pageW;
          canvas.height = pageH;
          const ctx = canvas.getContext('2d');
          await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'display' }).promise;
          renderAnnotationsToContext(ctx, page, scale, exportOverrides);
          const previewWrap = document.createElement('div');
          previewWrap.className = 'summary-count-detail-preview';
          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/jpeg', 0.9);
          img.alt = fullLabel;
          previewWrap.appendChild(img);
          const docSpan = document.createElement('span');
          docSpan.className = 'summary-count-detail-doc';
          docSpan.textContent = docName;
          previewWrap.appendChild(docSpan);
          row.appendChild(previewWrap);
        } catch (e) {
          console.error('[Summary detail thumbnail]', e);
        }
      }
      listEl.appendChild(row);
    }
  }

  // SECTION: Inline rename & polyline edit mode
  function onDoubleTapOrDblClick(el, handler) {
    if (!el) return;
    let lastTap = 0;
    el.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - lastTap < 400) { e.preventDefault(); handler(); lastTap = 0; }
      else lastTap = now;
    });
    el.addEventListener('dblclick', (e) => { e.preventDefault(); handler(); });
  }

  function startRename(el, onSave, opts) {
    if (!el) return;
    const span = el.tagName === 'SPAN' ? el : el.querySelector('.name');
    if (!span) return;
    const originalText = span.textContent;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = originalText;
    inp.className = 'rename-input';
    inp.style.cssText = 'width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:4px;';
    let wrapper = inp;
    if (opts?.onDelete) {
      wrapper = document.createElement('div');
      wrapper.className = 'rename-with-delete';
      wrapper.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;';
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'page-delete-btn danger';
      delBtn.title = 'Delete page';
      delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16"><path fill="#e85447" d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/></svg>';
      delBtn.style.cssText = 'flex-shrink:0;width:24px;height:24px;padding:0;border:none;background:transparent;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        if (state.pages.length <= 1) { alert('Cannot delete the only page.'); return; }
        inp.dataset.cancelled = '1';
        state.pendingDeletePage = { onDelete: opts.onDelete };
        document.getElementById('deletePageName').textContent = opts.pageName || 'this page';
        showModal('deletePageConfirmModal');
      };
      inp.style.flex = '1';
      inp.style.minWidth = '0';
      wrapper.appendChild(delBtn);
      wrapper.appendChild(inp);
    }
    span.replaceWith(wrapper);
    if (opts?.editBtn) opts.editBtn.style.display = 'none';
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
    inp.onclick = inp.onmousedown = inp.onmouseup = (e) => e.stopPropagation();
    inp.onblur = (e) => {
      if (inp.dataset.cancelled) return;
      if (opts?.onDelete && wrapper.contains && e.relatedTarget && wrapper.contains(e.relatedTarget)) return;
      const v = inp.value.trim();
      if (v) onSave(v);
      if (opts?.editBtn) opts.editBtn.style.display = '';
      const newSpan = document.createElement('span');
      newSpan.className = 'name';
      newSpan.textContent = v || originalText;
      wrapper.replaceWith(newSpan);
      updateUI();
    };
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') inp.blur();
      if (e.key === 'Escape') {
        inp.dataset.cancelled = '1';
        if (opts?.editBtn) opts.editBtn.style.display = '';
        const newSpan = document.createElement('span');
        newSpan.className = 'name';
        newSpan.textContent = originalText;
        wrapper.replaceWith(newSpan);
        updateUI();
      }
    };
  }

  function enterEditMode(polyId, pageIdx) {
    const page = state.pages[pageIdx];
    const canvas = getActiveCanvas(page);
    if (!canvas) return;
    const idx = (canvas.annotations?.polylines || []).findIndex(p => p.id === polyId);
    if (idx < 0) return;
    state.editingPolyline = canvas.annotations.polylines.splice(idx, 1)[0];
    state.editingPolyIndex = pageIdx;
    state.tool = TOOL.EDIT_POLY;
    state.activePolylineId = polyId;
    state.selectedLineId = null;
    state.selectedLineIsPoly = false;
    state.selectedLinePageIdx = null;
    annCanvas.classList.add('interactive');
    updateUI();
    renderAnnotations();
  }

  function exitEditMode(save) {
    if (!state.editingPolyline) return;
    if (save && (state.editingPolyline.points || []).length >= 2) {
      pushUndoSnapshot();
      const page = state.pages[state.editingPolyIndex];
      const canvas = page && getActiveCanvas(page);
      if (canvas) { if (!canvas.annotations.polylines) canvas.annotations.polylines = []; canvas.annotations.polylines.push(state.editingPolyline); }
      markProjectDirty();
    }
    state.editingPolyline = null;
    state.editingPolyIndex = null;
    state.activePolylineId = null;
    state.tool = TOOL.NONE;
    state.draggingVertexIdx = null;
    annCanvas.classList.remove('interactive');
    updateUI();
    renderPdf();
  }

  // SECTION: Modal primitives (showModal / hideModal)
  function showModal(id) { document.getElementById(id).classList.add('visible'); }
  function hideModal(id) {
    if (id === 'groupModal') App.onGroupModalHidden && App.onGroupModalHidden();
    if (id === 'counterLineTypeDetailsModal') App.onCounterLineTypeDetailsHidden && App.onCounterLineTypeDetailsHidden();
    if (id === 'canvasDetailsModal') App.onCanvasDetailsHidden && App.onCanvasDetailsHidden();
    if (id === 'deleteCanvasConfirmModal') App.onDeleteCanvasConfirmHidden && App.onDeleteCanvasConfirmHidden();
    document.getElementById(id).classList.remove('visible');
  }

  // The Counter/Line Type details modal (openCounterLineTypeDetailsModal +
  // performDeleteCounterLineType + the counterLineTypeDetailsItem /
  // pendingDeleteCounterLineType flags), the Line Properties modal
  // (openLinePropertiesModal / closeLinePropertiesModal + pendingLineProperties),
  // and deleteGroup moved to features/item-details.js (window.App registry);
  // reached via App.* at call time. showModal/hideModal stay here (app-wide
  // modal primitives); hideModal resets the moved details item via the
  // App.onCounterLineTypeDetailsHidden callback.

  // SECTION: Toasts & line color picker
  let airboardToastTimer = null;
  function showToast(msg, durationMs) {
    if (airboardToastTimer) clearTimeout(airboardToastTimer);
    const el = document.getElementById('airboardToastText');
    if (el) el.textContent = msg || '';
    showModal('airboardToastModal');
    airboardToastTimer = setTimeout(() => { hideModal('airboardToastModal'); airboardToastTimer = null; }, durationMs ?? 2000);
  }

  let turnInProgressActive = false;
  function setTurnInProgress(label) {
    if (!label) {
      if (turnInProgressActive) hideModal('airboardToastModal');
      turnInProgressActive = false;
      return;
    }
    if (airboardToastTimer) { clearTimeout(airboardToastTimer); airboardToastTimer = null; }
    const el = document.getElementById('airboardToastText');
    if (el) el.textContent = 'Turn In: ' + label;
    showModal('airboardToastModal');
    turnInProgressActive = true;
  }

  let setScaleFirstToastTimer = null;
  const scaleIconSvgToast = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18" style="vertical-align:middle;flex-shrink:0;"><path fill="currentColor" d="M163.3 320.1L232.7 200.2C227.1 188 223.9 174.4 223.9 160C223.9 107 266.9 64 319.9 64C372.9 64 415.9 107 415.9 160C415.9 174.3 412.8 187.9 407.1 200.2L451.5 276.9C428.4 302.9 397.8 322 363.1 330.7L320 255.9L251.9 373.5C273.4 380.3 296.2 384 320 384C390.7 384 453.8 351.3 494.9 300C506 286.2 526.1 284 539.9 295C553.7 306 555.9 326.2 544.9 340C492.2 405.8 411 448 320.1 448C284.7 448 250.7 441.6 219.4 429.9L162.7 527.7C158 535.8 151 542.4 142.6 546.6L87.2 574.3C82.2 576.8 76.3 576.5 71.6 573.6C66.9 570.7 64 565.5 64 560L64 504.6C64 496.2 66.2 487.9 70.5 480.5L130.5 376.8C117.7 365.6 105.9 353.3 95.2 340C84.1 326.2 86.4 306.1 100.2 295C114 283.9 134.1 286.2 145.2 300C150.9 307.1 157 313.8 163.4 320.1zM445.1 471.9C477.6 458.9 507.5 440.9 534 419L569.6 480.5C573.8 487.8 576.1 496.1 576.1 504.6L576.1 560C576.1 565.5 573.2 570.7 568.5 573.6C563.8 576.5 557.9 576.8 552.9 574.3L497.5 546.6C489.1 542.4 482.1 535.8 477.4 527.7L445.1 471.9zM320 192C337.7 192 352 177.7 352 160C352 142.3 337.7 128 320 128C302.3 128 288 142.3 288 160C288 177.7 302.3 192 320 192z"/></svg>';
  function showSetScaleFirstToast(toolName) {
    if (setScaleFirstToastTimer) clearTimeout(setScaleFirstToastTimer);
    const el = document.getElementById('setScaleFirstText');
    if (el) el.innerHTML = 'Set Scale ' + scaleIconSvgToast + ' first to use ' + toolName + '.';
    showModal('setScaleFirstModal');
    setScaleFirstToastTimer = setTimeout(() => {
      hideModal('setScaleFirstModal');
      setScaleFirstToastTimer = null;
    }, 3000);
  }
  let outOfBoundsToastTimer = null;
  function showOutOfBoundsToast() {
    if (outOfBoundsToastTimer) clearTimeout(outOfBoundsToastTimer);
    showModal('outOfBoundsModal');
    outOfBoundsToastTimer = setTimeout(() => {
      hideModal('outOfBoundsModal');
      outOfBoundsToastTimer = null;
    }, 2000);
  }
  // The Choose/Create Line Type modal (showLineTypeTab,
  // populateChooseLineTypeList, showChooseLineTypeModal) moved to
  // features/choose-create-line-type.js (window.App registry); reached via
  // App.showChooseLineTypeModal / App.showLineTypeTab at call time.
  // The line color picker cluster (showLineColorModal / applyLineColor /
  // pushRecentColor / setupCreateColorPicker + the #lineColorCancel /
  // #lineColorCustom bindings) lives in features/line-color.js (registry
  // split #36); reached via App.* at call time.

  // SECTION: Airboard cloud sync
  async function fetchUserAirboard() {
    const user = state.supabaseSession?.user;
    if (!supabase || !user) return null;
    const { data, error } = await supabase.from('user_airboard').select('counters, line_types, icon_names, icon_order, plumbing_modifiers, line_modifiers').eq('user_id', user.id).maybeSingle();
    if (error) return null;
    if (!data) return null;
    return {
      counters: data.counters || [],
      lineTypes: data.line_types || [],
      iconNames: (data.icon_names && typeof data.icon_names === 'object') ? data.icon_names : {},
      iconOrder: Array.isArray(data.icon_order) ? data.icon_order : null,
      plumbingModifiers: (data.plumbing_modifiers && typeof data.plumbing_modifiers === 'object') ? data.plumbing_modifiers : null,
      lineModifiers: (data.line_modifiers && typeof data.line_modifiers === 'object') ? data.line_modifiers : null
    };
  }
  async function saveUserAirboard() {
    const user = state.supabaseSession?.user;
    if (!supabase || !user) return false;
    const payload = {
      user_id: user.id,
      counters: state.counters || [],
      line_types: state.lineTypes || [],
      icon_names: state.iconNames || {},
      icon_order: state.iconOrder || null,
      plumbing_modifiers: getPlumbingModifiers(),
      line_modifiers: getLineModifiers(),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('user_airboard').upsert(payload, { onConflict: 'user_id' });
    return !error;
  }

  // SECTION: Supabase RPC & presence heartbeat
  let presenceHeartbeatTimer = null;
  let presenceVisibilityTimer = null;
  const activityHighFreqLastAt = Object.create(null);
  const activityProjectSaveLastAt = Object.create(null);

  function rpcSupabase(rpcName, body) {
    if (!SUPABASE_ENABLED || !supabase || !state.supabaseSession?.access_token) return Promise.resolve(null);
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + rpcName, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + state.supabaseSession.access_token,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    }).catch(() => {});
  }
  function touchPresence() {
    if (!SUPABASE_ENABLED || !supabase || !state.supabaseSession?.user) return;
    rpcSupabase('touch_presence', {});
  }
  function stopPresenceHeartbeat() {
    if (presenceHeartbeatTimer) { clearInterval(presenceHeartbeatTimer); presenceHeartbeatTimer = null; }
    if (presenceVisibilityTimer) { clearTimeout(presenceVisibilityTimer); presenceVisibilityTimer = null; }
    document.removeEventListener('visibilitychange', onPresenceVisibilityChange);
  }
  function onPresenceVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    if (presenceVisibilityTimer) clearTimeout(presenceVisibilityTimer);
    presenceVisibilityTimer = setTimeout(() => { touchPresence(); presenceVisibilityTimer = null; }, 5000);
  }
  function startPresenceHeartbeat() {
    stopPresenceHeartbeat();
    if (!SUPABASE_ENABLED || !supabase || !state.supabaseSession?.user) return;
    touchPresence();
    presenceHeartbeatTimer = setInterval(touchPresence, 60000);
    document.addEventListener('visibilitychange', onPresenceVisibilityChange);
  }

  // SECTION: User activity / event telemetry
  function logUserEvent(eventType, projectId, metadata) {
    if (!SUPABASE_ENABLED || !supabase || !state.supabaseSession?.user) return;
    if (eventType === 'counter_marker_added' || eventType === 'line_added') {
      const now = Date.now();
      const last = activityHighFreqLastAt[eventType];
      if (last && now - last < ACTIVITY_HIGH_FREQ_MS) return;
      activityHighFreqLastAt[eventType] = now;
    }
    rpcSupabase('log_user_event', {
      p_event_type: eventType,
      p_project_id: projectId == null ? null : projectId,
      p_metadata: metadata && typeof metadata === 'object' ? metadata : {}
    });
  }
  function maybeLogProjectSaveEvent(projectId) {
    if (!projectId) return;
    const now = Date.now();
    const last = activityProjectSaveLastAt[projectId];
    if (last && now - last < ACTIVITY_PROJECT_SAVE_MS) return;
    activityProjectSaveLastAt[projectId] = now;
    logUserEvent('project_save', projectId, {});
  }
  function maybeLogSessionStartOnce() {
    try {
      if (sessionStorage.getItem('clickcount-activity-session')) return;
      sessionStorage.setItem('clickcount-activity-session', '1');
    } catch (_) {}
    logUserEvent('session_start', null, {});
  }
  function logProjectOpenEvent() {
    if (!SUPABASE_ENABLED || !state.supabaseSession?.user || state.isViewer) return;
    const pid = state.currentProjectId;
    if (!pid) return;
    logUserEvent('project_open', pid, {});
  }
  function logCounterMarkerAddedEvent() {
    logUserEvent('counter_marker_added', state.currentProjectId, { counterTypeId: state.activeCounterType || null, pageIndex: state.currentPage });
  }
  function logLineAddedEvent(kind) {
    logUserEvent('line_added', state.currentProjectId, { kind: kind, lineTypeId: state.activeLineTypeId || null, pageIndex: state.currentPage });
  }

  // SECTION: Supabase auth & dev auth
  async function initSupabaseAuth() {
    if (!supabase) return;
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session;
    } catch (e) {
      if (e?.name === 'AuthApiError' || (e?.message && (e.message.includes('Refresh Token') || e.message.includes('refresh_token')))) {
        await supabase.auth.signOut();
      }
    }
    state.supabaseSession = session;
    if (session?.user) {
      lastAuthUserId = session.user.id;
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('user_id', session.user.id).maybeSingle();
      state.isAdmin = !!profile?.is_admin;
      startPresenceHeartbeat();
      maybeLogSessionStartOnce();
      checkGlobalForceReload();
    } else {
      lastAuthUserId = null;
      state.isAdmin = false;
      stopPresenceHeartbeat();
    }
    updateSaveStatusIndicator();
    supabase.auth.onAuthStateChange(async (event, session) => {
      const prevUserId = lastAuthUserId;
      const newUserId = session?.user?.id || null;
      state.supabaseSession = session;
      updateSaveStatusIndicator();
      if (event === 'TOKEN_REFRESHED') {
        if (newUserId && prevUserId && newUserId !== prevUserId) {
          try { pushSaveEvent('auth_user_changed_on_refresh', 'TOKEN_REFRESHED with different user id - tearing down prior session'); } catch (_) {}
          try { stopPresenceHeartbeat(); } catch (_) {}
          resetLocalSessionState();
          lastAuthUserId = newUserId;
          if (session?.user) {
            const { data: profile } = await supabase.from('profiles').select('is_admin').eq('user_id', session.user.id).maybeSingle();
            state.isAdmin = !!profile?.is_admin;
            startPresenceHeartbeat();
            maybeLogSessionStartOnce();
          }
          updateUI();
          renderPdf();
          updateSaveStatusIndicator();
        }
        checkGlobalForceReload();
        return;
      }
      if (session?.user) {
        const userChanged = newUserId !== prevUserId;
        lastAuthUserId = newUserId;
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('user_id', session.user.id).maybeSingle();
        state.isAdmin = !!profile?.is_admin;
        startPresenceHeartbeat();
        maybeLogSessionStartOnce();
        checkGlobalForceReload();
        // Reload custom icons on any user transition so per-user keys/migration
        // pick up correctly, even when cache was populated from the legacy key
        // (anonymous boot before sign-in).
        const needsCustomIconReload = userChanged || !customIconsCache || customIconsCache.length === 0;
        if (needsCustomIconReload && typeof customIconsGetFromIndexedDB === 'function') {
          try {
            const loaded = await customIconsGetFromIndexedDB();
            customIconsCache = Array.isArray(loaded) ? loaded : [];
          } catch (_) {}
        }
        if (!state.currentProjectId && state.pages.length === 0) {
          const airboard = await fetchUserAirboard();
          if (airboard && (airboard.counters?.length || airboard.lineTypes?.length) &&
              !state.currentProjectId && state.pages.length === 0) {
            state.counters = airboard.counters;
            state.lineTypes = airboard.lineTypes;
            state.iconNames = airboard.iconNames || {};
            state.iconOrder = airboard.iconOrder;
            if (Array.isArray(airboard.customIconPaths)) saveUserCustomIcons(airboard.customIconPaths);
            if (airboard.plumbingModifiers && typeof airboard.plumbingModifiers === 'object') savePlumbingModifiers(airboard.plumbingModifiers);
            if (airboard.lineModifiers && typeof airboard.lineModifiers === 'object') saveLineModifiers(airboard.lineModifiers);
          }
        }
        reconcileOrphanedCountersAndLineTypes();
      } else {
        stopPresenceHeartbeat();
        state.isAdmin = false;
        const hadSession = !!prevUserId;
        lastAuthUserId = null;
        // Per-user data hygiene: wipe only on a REAL sign-out (a user existed in
        // this tab). supabase-js fires INITIAL_SESSION with no session right after
        // subscribing on any signed-out device — wiping there nuked view-link
        // projects milliseconds after they loaded (and could clobber a signed-out
        // local session's restored backup). A view-link tab is never wiped: its
        // project access rides on the token + email gate, not the session.
        if (hadSession) {
          if (!state.loadedViaViewLink) resetLocalSessionState();
          broadcastSignOut();
        }
      }
      updateUI();
      renderPdf();
      updateSaveStatusIndicator();
    });
  }

  function isAuthError(e) {
    if (!e) return false;
    const msg = (e.message || '').toLowerCase();
    return e.code === 'PGRST301' || e.status === 401 ||
      msg.includes('jwt') || msg.includes('refresh') || msg.includes('token') || msg.includes('expired') || msg.includes('401');
  }

  function canUseDevAuth() {
    return IS_DEV_HOST && typeof window.DEV_AUTH_EMAIL === 'string' && window.DEV_AUTH_EMAIL &&
      typeof window.DEV_AUTH_PASSWORD === 'string' && window.DEV_AUTH_PASSWORD;
  }
  async function devAuthSignIn() {
    if (!canUseDevAuth() || !supabase) return false;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: window.DEV_AUTH_EMAIL,
      password: window.DEV_AUTH_PASSWORD
    });
    if (error) {
      console.error('[Dev auth]', error);
      return false;
    }
    state.supabaseSession = data.session;
    return true;
  }

  // SECTION: [sync] Checkout subscription & permission refresh
  // The realtime channel (handle + reconnect backoff + generation guard) and
  // refreshProjectPermissions live in save-engine.js (Stage 5); same-named
  // wrappers below keep the many call sites + the App registry frozen.
  function subscribeToProjectCheckoutChanges(projectId) { return saveEngine.subscribeToProjectCheckoutChanges(projectId); }
  function refreshProjectPermissions() { return saveEngine.refreshProjectPermissions(); }

  // Note: consolidated visibilitychange handler (with probeCheckoutLock + refreshProjectPermissions)
  // lives near the autosave interval block below.

  // SECTION: Modals & Handlers
  document.getElementById('uploadPdf').onclick = () => document.getElementById('pdfInput').click();
  document.getElementById('uploadPdfSidebar').onclick = () => document.getElementById('pdfInput').click();
  function assertPdfWithinLimit(bytes, context) {
    if (typeof bytes !== 'number' || bytes <= PDF_MAX_SIZE_BYTES) return null;
    const mb = Math.round(bytes / (1024 * 1024) * 10) / 10;
    const maxMb = PDF_MAX_SIZE_BYTES / (1024 * 1024);
    const msg = 'PDF is ' + mb + ' MB, which exceeds the ' + maxMb + ' MB cloud-storage limit. Please reduce the file size and try again.';
    try { pushSaveEvent('pdf_size_exceeded', msg, JSON.stringify({ bytes, limit: PDF_MAX_SIZE_BYTES, context: context || null })); } catch (_) {}
    return { ok: false, message: msg, bytes, limit: PDF_MAX_SIZE_BYTES };
  }
  const IS_DEV_HOST = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  async function mergePdfBuffers(buffers) {
    if (!buffers.length) return null;
    if (buffers.length === 1) return buffers[0].slice(0);
    if (typeof PDFLib === 'undefined') return buffers[0].slice(0);
    const merged = await PDFLib.PDFDocument.create();
    for (const buf of buffers) {
      const doc = await PDFLib.PDFDocument.load(buf);
      const indices = doc.getPageIndices();
      const copied = await merged.copyPages(doc, indices);
      copied.forEach(p => merged.addPage(p));
    }
    return await merged.save();
  }
  async function buildTrimmedPdfBuffer(sourceBuffer, keptIndices) {
    if (!keptIndices.length) return null;
    if (typeof PDFLib === 'undefined') return null;
    const srcDoc = await PDFLib.PDFDocument.load(sourceBuffer);
    const out = await PDFLib.PDFDocument.create();
    const indices = keptIndices.map(i => i).sort((a, b) => a - b);
    const copied = await out.copyPages(srcDoc, indices);
    copied.forEach(p => out.addPage(p));
    return await out.save();
  }
  // C1: Open canvasOnlyNeedsPdfModal with optional context-specific copy.
  function openCanvasOnlyNeedsPdfModal(opts) {
    opts = opts || {};
    const titleEl = document.getElementById('canvasOnlyNeedsPdfTitle');
    const bodyEl = document.getElementById('canvasOnlyNeedsPdfBody');
    if (titleEl) {
      titleEl.textContent = opts.reason === 'pdf_missing'
        ? 'This project\u2019s PDF is missing'
        : 'This project has annotations but no PDF';
    }
    if (bodyEl) {
      bodyEl.textContent = opts.reason === 'pdf_missing'
        ? 'The PDF for this project couldn\u2019t be loaded from cloud storage. Choose a PDF to view the saved counters, lines, and notes. The PDF will be attached to this project the next time you save.'
        : 'Choose a PDF to view the saved counters, lines, and notes. The PDF will be attached to this project the next time you save.';
    }
    showModal('canvasOnlyNeedsPdfModal');
    updateCanvasOnlyNeedsPdfBanner();
  }
  // Show the persistent "Choose PDF" banner whenever a project is loaded but
  // has zero pages and a pendingCanvasLoad is waiting for a PDF. Hidden once
  // pages exist or the project is closed.
  function updateCanvasOnlyNeedsPdfBanner() {
    const el = document.getElementById('canvasOnlyNeedsPdfBanner');
    if (!el) return;
    const modalEl = document.getElementById('canvasOnlyNeedsPdfModal');
    const modalVisible = !!(modalEl && modalEl.classList.contains('visible'));
    const needsPdf = !!(state.currentProjectId && state.pages.length === 0 && state.pendingCanvasLoad && !state.isViewer);
    el.style.display = (needsPdf && !modalVisible) ? '' : 'none';
  }

  // openPreparePdfModal + the modal's preview/nav/commit + #preparePdf* bindings
  // moved to features/prepare-pdf.js (App.openPreparePdfModal). What remains here
  // is the PDF intake pipeline (file upload, test PDF, hashing) that feeds it.
  // SECTION: PDF intake (upload, test PDF, hashing)
  // The whole intake pipeline (the #pdfInput onchange flow: size caps,
  // multi-file merge, append mode, canvas-load hash match, the
  // load-annotations prompt, the Prepare PDF handoff; plus loadTestPdf and
  // titleFromPdfFilename) lives in features/pdf-intake.js (registry split
  // #38). The feature owns the pendingAddAdditionalPages /
  // pendingImportCanvasAfterPdf flags; app.js reaches them via
  // App.setPendingAddAdditionalPages / App.resetPdfIntakeFlags.
  // SECTION: Toolbar tool buttons
  // The Scale modal (updateScalePlaceholder, openScaleModal,
  // resetScaleModalZoneMode, applyScaleObjectToZoneOrPage, showScaleTab, the
  // setScale/setScaleSidebar openers, and the #scale* handlers that were down in
  // the Counter-modal region) moved to features/scale.js (window.App registry);
  // reached via App.openScaleModal / App.resetScaleModalZoneMode at call time.
  document.getElementById('measureBtn').onclick = () => {
    if (!getPageScale(state.currentPage)) {
      showSetScaleFirstToast('Measure');
      return;
    }
    state.tool = TOOL.MEASURE;
    state.scaleMode = SCALE_MODES.POINT_A;
    state.scalePointA = null;
    state.scalePointB = null;
    updateUI();
    renderPdf();
  };
  document.getElementById('measureBtnSidebar').onclick = () => document.getElementById('measureBtn').click();
  document.getElementById('moveBtn').onclick = () => {
    if (state.aiming || state.aimPressTimer) cancelAiming();
    state.tool = TOOL.NONE;
    state.quickLineStart = null;
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.roomBoxStart = null;
    if (state.scalePointA || state.scalePointB) { state.scalePointA = null; state.scalePointB = null; state.scaleMode = SCALE_MODES.NONE; }
    state.activeCounterType = null;
    updateUI();
    renderPdf();
  };
  document.getElementById('quickLine').onclick = () => {
    if (!getPageScale(state.currentPage)) {
      showSetScaleFirstToast('Quick Line');
      return;
    }
    if (state.quickLineStart) {
      state.quickLineStart = null;
      renderAnnotations();
    }
    App.showChooseLineTypeModal();
  };
  document.getElementById('quickLine').oncontextmenu = (e) => {
    e.preventDefault();
    if (state.isViewer) return;
    document.getElementById('lineTypesSectionTitle').click();
  };
  document.getElementById('undoBtn').onclick = () => { undo(); };
  document.getElementById('redoBtn').onclick = () => { redo(); };
  document.getElementById('polylineBtn').onclick = () => {
    if (!getPageScale(state.currentPage)) {
      showSetScaleFirstToast('Polyline');
      return;
    }
    document.getElementById('polylineLineType').innerHTML = state.lineTypes.map(lt => '<option value="' + lt.id + '">' + lt.name + '</option>').join('') || '<option value="">—</option>';
    document.getElementById('polylineName').value = '';
    const cr = document.getElementById('polylineColorRow');
    cr.innerHTML = COLORS.map((c, i) => '<span class="color-swatch' + (i === 2 ? ' selected' : '') + '" data-color="' + c + '" style="background:' + c + '"></span>').join('');
    cr.querySelectorAll('.color-swatch').forEach(s => s.onclick = () => { cr.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('selected')); s.classList.add('selected'); });
    showModal('polylineModal');
  };
  document.getElementById('polylineBtn').oncontextmenu = (e) => {
    e.preventDefault();
    if (state.isViewer) return;
    document.getElementById('lineTypesSectionTitle').click();
  };
  document.getElementById('highlightBtn').onclick = () => {
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.roomBoxStart = null;
    state.tool = TOOL.HIGHLIGHT;
    updateUI();
  };
  document.getElementById('multiplyZoneBtn').onclick = () => {
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.roomBoxStart = null;
    state.tool = TOOL.MULTIPLY_ZONE;
    updateUI();
  };
  document.getElementById('scaleZoneBtn').onclick = () => {
    if (!getPageScale(state.currentPage)) {
      showSetScaleFirstToast('Scale Zone');
      return;
    }
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.roomBoxStart = null;
    state.tool = TOOL.SCALE_ZONE;
    updateUI();
  };
  document.getElementById('deleteZoneBtn').onclick = () => {
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.roomBoxStart = null;
    state.tool = TOOL.DELETE_ZONE;
    updateUI();
  };
  document.getElementById('roomBtn').onclick = () => {
    if (!getPageScale(state.currentPage)) {
      showSetScaleFirstToast('Room Sizer');
      return;
    }
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.roomBoxStart = null;
    state.tool = TOOL.ROOM;
    updateUI();
  };
  document.getElementById('multiplyZoneBtn').oncontextmenu = (e) => {
    e.preventDefault();
    if (state.isViewer) return;
    App.openMultiplyZoneSettingsModal();
  };
  // SECTION: Tool sidebar buttons & legend overlay
  // The Counter modal (showCounterTab, showCounterIconTab, populateCounterChooseList,
  // the #counterBtn/.counter-tab/#counterModalSearchInput/#counterChooseCancel
  // choose-tab handlers, and the #addCounter/.counter-icon-tab/#counterIconSearch/
  // #counterCancel/#counterCreate create-tab handlers further below) moved to
  // features/counter.js (window.App registry); reached via App.showCounterTab. The
  // quickcount tab body populateCounterQuickCountPanel stays in app.js (Quick Count).
  document.getElementById('doneEditing').onclick = () => exitEditMode(true);

  document.getElementById('moveBtnSidebar').onclick = () => document.getElementById('moveBtn').click();
  document.getElementById('counterBtnSidebar').onclick = () => document.getElementById('counterBtn').click();
  document.getElementById('counterBtnSidebar').oncontextmenu = (e) => {
    e.preventDefault();
    if (state.isViewer) return;
    document.getElementById('countersSectionTitle').click();
  };
  document.getElementById('quickLineSidebar').onclick = () => document.getElementById('quickLine').click();
  document.getElementById('quickLineSidebar').oncontextmenu = (e) => {
    e.preventDefault();
    if (state.isViewer) return;
    document.getElementById('lineTypesSectionTitle').click();
  };
  document.getElementById('polylineBtnSidebar').onclick = () => document.getElementById('polylineBtn').click();
  document.getElementById('polylineBtnSidebar').oncontextmenu = (e) => {
    e.preventDefault();
    if (state.isViewer) return;
    document.getElementById('lineTypesSectionTitle').click();
  };
  const headerActiveLineTypeEl = document.getElementById('headerActiveLineType');
  if (headerActiveLineTypeEl) {
    headerActiveLineTypeEl.oncontextmenu = (e) => {
      e.preventDefault();
      if (state.isViewer) return;
      document.getElementById('lineTypesSectionTitle').click();
    };
  }
  document.getElementById('highlightBtnSidebar').onclick = () => document.getElementById('highlightBtn').click();
  const roomBtnSidebarWire = document.getElementById('roomBtnSidebar');
  if (roomBtnSidebarWire) roomBtnSidebarWire.onclick = () => document.getElementById('roomBtn').click();
  const multiplyZoneBtnSidebarEl = document.getElementById('multiplyZoneBtnSidebar');
  if (multiplyZoneBtnSidebarEl) {
    multiplyZoneBtnSidebarEl.onclick = () => document.getElementById('multiplyZoneBtn').click();
    multiplyZoneBtnSidebarEl.oncontextmenu = (e) => {
      e.preventDefault();
      if (state.isViewer) return;
      App.openMultiplyZoneSettingsModal();
    };
  }
  const scaleZoneBtnSidebarEl = document.getElementById('scaleZoneBtnSidebar');
  if (scaleZoneBtnSidebarEl) scaleZoneBtnSidebarEl.onclick = () => document.getElementById('scaleZoneBtn').click();
  const deleteZoneBtnSidebarEl = document.getElementById('deleteZoneBtnSidebar');
  if (deleteZoneBtnSidebarEl) deleteZoneBtnSidebarEl.onclick = () => document.getElementById('deleteZoneBtn').click();
  document.getElementById('noteBtn').onclick = () => { state.tool = TOOL.NOTE; updateUI(); };
  document.getElementById('noteBtnSidebar').onclick = () => document.getElementById('noteBtn').click();
  const legendBtn = document.getElementById('legendBtn');
  const legendBtnSidebar = document.getElementById('legendBtnSidebar');
  function toggleLegendOverlay() {
    if (!state.pages.length) return;
    state.showLegendOverlay = !state.showLegendOverlay;
    if (state.showLegendOverlay) {
      state.tool = TOOL.NONE;
      state.activeCounterType = null;
      state.activeLineTypeId = null;
      state.quickLineStart = null;
      state.highlightStart = null;
      state.multiplyZoneStart = null;
      state.scaleZoneStart = null;
      state.deleteZoneStart = null;
      state.roomBoxStart = null;
      if (state.drawingPolyline) state.drawingPolyline = null;
      const page = state.pages[state.currentPage];
      const ann = getActiveAnnotations(page);
      if (!ann.legend) {
        const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
        const pageW = vp.width;
        ann.legend = { x: pageW - 110, y: 16, w: 100, h: 56 };
      }
    }
    markProjectDirty();
    renderPdf();
    updateUI();
  }
  if (legendBtn) legendBtn.onclick = toggleLegendOverlay;
  if (legendBtnSidebar) legendBtnSidebar.onclick = () => legendBtn?.click();
  // The Grid Settings modal (toggleGridOverlay + the gridBtn/gridBtnSidebar
  // bindings + the #gridSettings* / #gridSetOriginOnPage / #gridClearOrigin /
  // spacing-preset / line-style handlers) moved to features/grid.js (window.App
  // registry); reached via App.toggleGridOverlay / the Grid buttons. The
  // "set origin on page" handoff goes through state.gridOriginPickMode (handled by
  // the canvas event handler). resetGridOrigin stays here (used by the prepare-PDF
  // / page-setup flows, not the modal).
  function resetGridOrigin() {
    if (!state.gridSettings) state.gridSettings = { spacing: 3, unit: 'ft' };
    state.gridSettings.offsetX = 0;
    state.gridSettings.offsetY = 0;
    const disp = document.getElementById('gridOriginDisplay');
    const setGrp = document.getElementById('gridSetOriginFormGroup');
    const txt = document.getElementById('gridOriginText');
    if (disp) disp.style.display = 'none';
    if (setGrp) setGrp.style.display = '';
    if (txt) txt.textContent = '—';
  }
  document.getElementById('doneEditingSidebar').onclick = () => document.getElementById('doneEditing').click();

  // The Scale modal handlers (#scaleModalTabs tabs, #scaleUnit, #scaleSelectOnPdf,
  // #scalePresetsCancel, #scaleCustomApply, #scaleCancel, #scaleSet) moved to
  // features/scale.js (window.App registry) alongside the scale-modal functions.

  const iconVbFor = (p) => iconViewBoxString(p);
  // The Counter modal create-tab handlers (#addCounter, .counter-icon-tab,
  // #counterIconSearch, #counterCancel, #counterCreate) moved to
  // features/counter.js (window.App registry) alongside the choose-tab handlers.

  // The Quick Plumbing + Quick Count modals (populatePlumModal,
  // populateCounterQuickCountPanel, removePlumbingModifier, the icon-tab helpers,
  // and the #plumBtn opener) moved to features/quick-modals.js.

  // SECTION: Add Line Type modal
  // The Quick Line modal (populateQuickLineModal, updateQuickLineNamePreview,
  // removeLineModifier + the #plumLineBtn opener and the #quickLine* handlers)
  // moved to features/quick-line.js (window.App registry), which now registers
  // App.populateQuickLineModal (consumed by features/choose-create-line-type.js).
  // getLineModifiers/saveLineModifiers stay here (published as App.*).
  document.getElementById('addLineType').onclick = () => {
    document.getElementById('lineTypeName').value = '';
    App.setupCreateColorPicker({ presetsRowId: 'lineTypeColorRow', customInputId: 'lineTypeColorCustom', recentRowId: 'lineTypeColorRecent', recentGroupId: 'lineTypeColorRecentGroup' });
    showModal('lineTypeModal');
  };
  document.getElementById('lineTypeCancel').onclick = () => hideModal('lineTypeModal');
  document.getElementById('lineTypeCreate').onclick = () => {
    const name = document.getElementById('lineTypeName').value.trim() || 'Line';
    const color = document.getElementById('lineTypeColorRow').dataset.selectedColor || COLORS[2];
    const curveSel = document.querySelector('input[name="lineTypeCurve"]:checked');
    const curveStyle = curveSel ? curveSel.value : 'straight';
    pushUndoSnapshot();
    const newLt = { id: uid(), name, color, curveStyle };
    state.lineTypes.push(newLt);
    App.pushRecentColor(color);
    state.activeLineTypeId = newLt.id;
    markProjectDirty();
    state.pagesListCollapsed = true;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
    hideModal('lineTypeModal');
    updateUI();
  };

  // The #addGroup opener + the #groupModalCancel/#groupModalDelete/#groupModalDone
  // handlers moved to features/groups.js (window.App registry). The #showGroupColors
  // sidebar toggle below stays here.
  const showGroupColorsCheckbox = document.getElementById('showGroupColorsCheckbox');
  const showGroupColorsBtn = document.getElementById('showGroupColorsBtn');
  if (showGroupColorsCheckbox && showGroupColorsBtn) {
    showGroupColorsCheckbox.checked = !!state.showGroupColors;
    showGroupColorsBtn.setAttribute('aria-pressed', state.showGroupColors);
    showGroupColorsBtn.onclick = () => {
      showGroupColorsCheckbox.checked = !showGroupColorsCheckbox.checked;
      showGroupColorsBtn.setAttribute('aria-pressed', showGroupColorsCheckbox.checked);
      showGroupColorsCheckbox.dispatchEvent(new Event('change'));
    };
    showGroupColorsCheckbox.onchange = () => {
      state.showGroupColors = showGroupColorsCheckbox.checked;
      try { localStorage.setItem('groupColorDisplay', state.showGroupColors ? '1' : '0'); } catch (_) {}
      renderPdf();
    };
  }
  // The #groupAssign* handlers and refreshGroupAssignButtons / openGroupAssignModal
  // moved to features/groups.js (window.App registry) alongside the group-modal
  // handlers; the emptied "// SECTION: Groups" marker was removed.

  // The Summary Legend settings modal (openLegendSettingsModal + its close / 8
  // appearance handlers + the #summarySectionTitle opener) lives in
  // features/legend-settings.js (window.App registry); it is reached via
  // App.openLegendSettingsModal at call time. The #summaryCollapseIcon toggle,
  // drawLegend, and the legendBtn overlay stay here.
  // The Multiply Zone settings modal (openMultiplyZoneSettingsModal + its
  // ShowLabel/LabelSize/Close handlers) lives in
  // features/multiply-zone-settings.js (window.App registry);
  // openMultiplyZoneSettingsModal is reached via App.openMultiplyZoneSettingsModal
  // at call time. The Multiply Zone apply flow (X-tool draw + multiplyZoneModal)
  // stays here.
  // The Line Type settings modal (openLineTypeSettingsModal + its value handlers
  // + close + reorder + the #lineTypesSectionTitle opener) lives in
  // features/line-type-settings.js (window.App registry); reached via
  // App.openLineTypeSettingsModal at call time. The #lineTypeSnapToHVHeaderBtn,
  // the sidebar inline show-only buttons, #sidebarReorderFinish, the J-hotkey,
  // and the Escape-key close branch stay here.
  // SECTION: Line color & sidebar handlers
  // The Choose/Create Line Type modal handlers (.line-type-tab clicks,
  // #lineTypeModalSearchInput, #chooseLineTypeCancel, #createLineTypeCancel,
  // #createLineTypeCreate) moved to features/choose-create-line-type.js
  // (window.App registry). The line color modal handlers moved to
  // features/line-color.js (split #36).
  // The Line Type settings value handlers (lineTypeSize/Opacity/DropXSize/
  // OrientLength/ParallelEnds/LengthLabel/SnapToHV/ShowOnlyOnPage) moved to
  // features/line-type-settings.js (window.App registry).
  document.getElementById('lineTypeSnapToHVHeaderBtn').onclick = (e) => {
    e.stopPropagation();
    state.lineTypeSettings.snapToHorizontalVertical = !state.lineTypeSettings.snapToHorizontalVertical;
    const cb = document.getElementById('lineTypeSnapToHV');
    const snapBtn = document.getElementById('lineTypeSnapToHVBtn');
    cb.checked = !!state.lineTypeSettings.snapToHorizontalVertical;
    if (snapBtn) snapBtn.setAttribute('aria-pressed', cb.checked);
    renderAnnotations();
    updateUI();
  };

  document.getElementById('pagesCollapseIcon').onclick = (e) => {
    e.stopPropagation();
    state.pagesListCollapsed = !state.pagesListCollapsed;
    document.getElementById('pagesSection').classList.toggle('collapsed', state.pagesListCollapsed);
    document.getElementById('pagesCollapseIcon').textContent = state.pagesListCollapsed ? '▶' : '▼';
  };
  // The #pagesSectionTitle opener + the pageSettingsTruncate/HideUnmarked toggles
  // + pageSettingsClose (Page settings modal) moved to features/page-settings.js
  // (window.App registry); reached via App.openPageSettingsModal at call time.
  // The #pagesCollapseIcon toggle above and the Escape-key close branch stay here.
  document.getElementById('countersCollapseIcon').onclick = (e) => {
    e.stopPropagation();
    state.countersListCollapsed = !state.countersListCollapsed;
    document.getElementById('countersSection').classList.toggle('collapsed', state.countersListCollapsed);
    document.getElementById('countersCollapseIcon').textContent = state.countersListCollapsed ? '▶' : '▼';
  };
  const counterSearchInput = document.getElementById('counterSearchInput');
  if (counterSearchInput) {
    counterSearchInput.value = state.counterSearch || '';
    counterSearchInput.oninput = () => {
      state.counterSearch = counterSearchInput.value;
      localStorage.setItem('counterSearch', state.counterSearch);
      renderCountersList();
    };
  }
  const lineTypeSearchInput = document.getElementById('lineTypeSearchInput');
  if (lineTypeSearchInput) {
    lineTypeSearchInput.value = state.lineTypeSearch || '';
    lineTypeSearchInput.oninput = () => {
      state.lineTypeSearch = lineTypeSearchInput.value;
      localStorage.setItem('lineTypeSearch', state.lineTypeSearch);
      renderLineTypesList();
      renderLinesList();
    };
  }
  const linesSearchInput = document.getElementById('linesSearchInput');
  if (linesSearchInput) {
    linesSearchInput.value = state.linesSearch || '';
    linesSearchInput.oninput = () => {
      state.linesSearch = linesSearchInput.value;
      localStorage.setItem('linesSearch', state.linesSearch);
      renderLinesList();
    };
  }
  const counterShowOnlyOnPageInlineBtn = document.getElementById('counterShowOnlyOnPageInlineBtn');
  if (counterShowOnlyOnPageInlineBtn) {
    counterShowOnlyOnPageInlineBtn.onclick = () => {
      state.counterSettings.showOnlyCountersOnCurrentPage = !state.counterSettings.showOnlyCountersOnCurrentPage;
      const cb = document.getElementById('counterShowOnlyOnPage');
      const modalBtn = document.getElementById('counterShowOnlyOnPageBtn');
      if (cb) cb.checked = !!state.counterSettings.showOnlyCountersOnCurrentPage;
      if (modalBtn) modalBtn.setAttribute('aria-pressed', state.counterSettings.showOnlyCountersOnCurrentPage);
      renderCountersList();
      updateUI();
    };
  }
  const lineTypeShowOnlyOnPageInlineBtn = document.getElementById('lineTypeShowOnlyOnPageInlineBtn');
  if (lineTypeShowOnlyOnPageInlineBtn) {
    lineTypeShowOnlyOnPageInlineBtn.onclick = () => {
      state.lineTypeSettings.showOnlyLineTypesOnCurrentPage = !state.lineTypeSettings.showOnlyLineTypesOnCurrentPage;
      const cb = document.getElementById('lineTypeShowOnlyOnPage');
      const modalBtn = document.getElementById('lineTypeShowOnlyOnPageBtn');
      if (cb) cb.checked = !!state.lineTypeSettings.showOnlyLineTypesOnCurrentPage;
      if (modalBtn) modalBtn.setAttribute('aria-pressed', state.lineTypeSettings.showOnlyLineTypesOnCurrentPage);
      renderLineTypesList();
      renderLinesList();
      updateUI();
    };
  }
  const linesShowOnlyOnPageBtn = document.getElementById('linesShowOnlyOnPageBtn');
  if (linesShowOnlyOnPageBtn) {
    linesShowOnlyOnPageBtn.onclick = () => {
      state.lineTypeSettings.showOnlyLinesOnCurrentPage = !state.lineTypeSettings.showOnlyLinesOnCurrentPage;
      linesShowOnlyOnPageBtn.setAttribute('aria-pressed', state.lineTypeSettings.showOnlyLinesOnCurrentPage);
      renderLinesList();
      updateUI();
    };
  }
  document.getElementById('lineTypesCollapseIcon').onclick = (e) => {
    e.stopPropagation();
    state.lineTypesListCollapsed = !state.lineTypesListCollapsed;
    document.getElementById('lineTypesSection').classList.toggle('collapsed', state.lineTypesListCollapsed);
    document.getElementById('lineTypesCollapseIcon').textContent = state.lineTypesListCollapsed ? '▶' : '▼';
  };
  document.getElementById('summaryCollapseIcon').onclick = (e) => {
    e.stopPropagation();
    state.summaryListCollapsed = !state.summaryListCollapsed;
    document.getElementById('summarySection').classList.toggle('collapsed', state.summaryListCollapsed);
    document.getElementById('summaryCollapseIcon').textContent = state.summaryListCollapsed ? '▶' : '▼';
  };
  document.getElementById('linesSectionTitle').onclick = () => {
    state.linesListCollapsed = !state.linesListCollapsed;
    document.getElementById('linesSection').classList.toggle('collapsed', state.linesListCollapsed);
    document.getElementById('linesCollapseIcon').textContent = state.linesListCollapsed ? '▶' : '▼';
  };
  document.getElementById('groupsSectionTitle').onclick = () => {
    state.groupsListCollapsed = !state.groupsListCollapsed;
    document.getElementById('groupsSection').classList.toggle('collapsed', state.groupsListCollapsed);
    document.getElementById('groupsCollapseIcon').textContent = state.groupsListCollapsed ? '▶' : '▼';
  };
  // The #summarySectionTitle opener (Summary Legend settings) moved to
  // features/legend-settings.js; the #summaryCollapseIcon toggle above stays.
  // The #countersSectionTitle opener + the counterSettings* value handlers +
  // counterSettingsClose + counterSettingsReorder (Counter settings modal) moved
  // to features/counter-settings.js (window.App registry); reached via
  // App.openCounterSettingsModal at call time. The #countersCollapseIcon toggle,
  // the #counterShowOnlyOnPageInlineBtn sidebar button, #sidebarReorderFinish,
  // and the Escape-key close branch stay here.
  // The #lineTypesSectionTitle opener + the lineTypeSettingsReorder handler moved
  // to features/line-type-settings.js (window.App registry).
  // The Page settings toggles (pageSettingsTruncate/HideUnmarked) + pageSettingsClose
  // moved to features/page-settings.js (window.App registry).
  document.getElementById('sidebarReorderFinish').onclick = () => {
    state.sidebarReorderModeActive = false;
    updateUI();
  };
  // The Counter settings modal (opener + value handlers + close + reorder) moved
  // to features/counter-settings.js (window.App registry).
  // The Zoom Settings modal (showZoomModal + its Close/max/speed handlers) lives
  // in features/zoom.js (window.App registry); showZoomModal is reached via
  // App.showZoomModal at call time. getMaxZoom/getWheelZoomSpeed stay here.

  // SECTION: Polyline modal & drawing
  document.getElementById('polylineCancel').onclick = () => hideModal('polylineModal');
  document.getElementById('polylineStart').onclick = () => {
    const lineTypeId = document.getElementById('polylineLineType').value || state.lineTypes[0]?.id;
    const name = document.getElementById('polylineName').value.trim() || 'Polyline';
    const colorSel = document.querySelector('#polylineColorRow .color-swatch.selected');
    const color = colorSel ? colorSel.dataset.color : COLORS[2];
    state.drawingPolyline = { id: uid(), name, color, points: [], closed: false, lineTypeId: lineTypeId || null, group: state.activeGroupId || null };
    state.tool = TOOL.POLYLINE;
    hideModal('polylineModal');
    updateUI();
  };

  document.getElementById('finishPolyline').onclick = () => finishPolyline(false);
  document.getElementById('closePolygon').onclick = () => finishPolyline(true);

  function finishPolyline(closed) {
    if (!state.drawingPolyline || state.drawingPolyline.points.length < 2) return;
    if (closed && state.drawingPolyline.points.length >= 3) state.drawingPolyline.closed = true;
    pushUndoSnapshot();
    const page = state.pages[state.currentPage];
    const canvas = page && ensureActiveCanvas(page);
    if (canvas) { if (!canvas.annotations.polylines) canvas.annotations.polylines = []; canvas.annotations.polylines.push(state.drawingPolyline); }
    logLineAddedEvent('polyline');
    state.drawingPolyline = null;
    state.tool = TOOL.NONE;
    markProjectDirty();
    updateUI();
    renderPdf();
  }

  // SECTION: Zoom bar & page navigation
  function doZoomOut() { if (wheelZoomCommitTimer) { clearTimeout(wheelZoomCommitTimer); wheelZoomCommitTimer = null; } state.zoom = Math.max(0.2, state.zoom - 0.1); renderPdf(); updateUI(); }
  function doZoomIn() { if (wheelZoomCommitTimer) { clearTimeout(wheelZoomCommitTimer); wheelZoomCommitTimer = null; } state.zoom = Math.min(getMaxZoom(), state.zoom + 0.1); renderPdf(); updateUI(); }
  document.getElementById('zoomOut').onclick = () => doZoomOut();
  document.getElementById('zoomIn').onclick = () => doZoomIn();
  document.getElementById('rotatePage').onclick = () => rotatePage90();
  document.getElementById('zoomFit').onclick = () => { if (wheelZoomCommitTimer) { clearTimeout(wheelZoomCommitTimer); wheelZoomCommitTimer = null; } fitZoom(); };
  const zoomPct = document.getElementById('zoomPct');
  zoomPct.onclick = () => {
    if (!state.pages.length) return;
    // Zoom Settings stays reachable from the rail's gear button.
    App.toggleZoomRail && App.toggleZoomRail();
  };
  document.getElementById('prevPage').onclick = () => { if (state.currentPage > 0) { state.currentPage--; fitZoom(); } };
  document.getElementById('nextPage').onclick = () => { if (state.currentPage < state.pages.length - 1) { state.currentPage++; fitZoom(); } };
  document.getElementById('prevMarkedPage').onclick = () => {
    const marked = getMarkedPageIndices();
    const prev = marked.filter(i => i < state.currentPage).pop();
    if (prev !== undefined) { state.currentPage = prev; fitZoom(); }
  };
  document.getElementById('nextMarkedPage').onclick = () => {
    const marked = getMarkedPageIndices();
    const next = marked.find(i => i > state.currentPage);
    if (next !== undefined) { state.currentPage = next; fitZoom(); }
  };

  // SECTION: Export canvas JSON
  // The canvas-layer management UI (Add Canvas / Canvas Details / Delete Canvas
  // modals, the footer layers menu, the show-all-canvases peek toggle, and their
  // pending state) moved to features/canvas-layers.js; the canvas switcher's
  // edit pen reaches the details modal via App.openCanvasDetailsModal.
  document.getElementById('exportBtn').onclick = () => {
    if (!projectHasAnyCanvasMarkup()) return;
    const data = { version: 1, counters: state.counters, lineTypes: state.lineTypes, iconNames: state.iconNames || {}, iconOrder: state.iconOrder || null, customIconPaths: getUserCustomIcons(), maxZoom: getMaxZoom(), groups: state.groups || [], rooms: state.rooms || [], legendSettings: state.legendSettings, multiplyZoneSettings: state.multiplyZoneSettings, showGridOverlay: state.showGridOverlay, gridSettings: state.gridSettings, pages: state.pages.map((p, i) => ({ index: i, label: p.label, canvases: p.canvases, scale: p.scale, rotation: p.rotation ?? 0, bakeFrame: computePageBakeFrame(p) })), activeCanvasIdByPage: state.activeCanvasIdByPage || {} };
    const a = document.createElement('a');
    a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(data));
    a.download = App.sanitizeForFilename(state.currentProjectName) + '.json';
    a.click();
    logUserEvent('export_canvas', state.currentProjectId, {});
  };
  document.getElementById('exportBtnSidebar').onclick = () => document.getElementById('exportBtn').click();

  // SECTION: PDF download helpers
  // The Export PDFs modal (openSpecificPagesModal + the specificPages* cluster
  // and its #specificPages* handlers) lives in features/export-pdfs.js
  // (window.App registry); it is reached via App.openSpecificPagesModal at call
  // time. The shared download helpers (sanitizeForFilename /
  // downloadPdfBuffer / downloadProjectPdf) live in features/output.js
  // (split #37); reached via App.* at call time.
  // The #forPipeTooling dropdown toggle moved to features/output.js with the
  // Copy to PipeTooling flow.
  // SECTION: View-link URL helpers & show-highlights/notes
  // Build the public view-link URL for a token (origin + path + ?t=token).
  function buildViewLinkUrl(token) {
    const base = window.location.origin + (window.location.pathname || '/');
    return base + (base.includes('?') ? '&' : '?') + 't=' + token;
  }
  // Reuse the project's existing view link, or create one. Resolves to the URL
  // or rejects. Shared by the header Share button and the /Tooling export.
  async function getOrCreateViewLinkUrl() {
    if (!state.currentProjectId || !supabase) throw new Error('No project');
    let token;
    const { data: links, error: linksErr } = await supabase.rpc('list_view_links', { p_project_id: state.currentProjectId });
    if (!linksErr && links && links.length > 0) {
      token = links[0].token;
    } else {
      const { data, error } = await supabase.rpc('create_view_link', { p_project_id: state.currentProjectId, p_name: null, p_expires_at: null });
      if (error) throw new Error(error.message);
      if (data && data.ok && data.token) token = data.token;
      else throw new Error((data && data.error) || 'Failed to create');
    }
    if (!token) throw new Error('No view link');
    return buildViewLinkUrl(token);
  }
  // The Copy to PipeTooling / Copy Summary flows (doCopyPipeTooling +
  // doCopyEmailSummary, their dropdown toggles + option bindings, and the
  // prefetched export view-link cache) moved to features/output.js; the Share
  // modal's revoke clears that cache via App.onViewLinkRevoked().

  document.getElementById('bundleHighlights').onclick = async () => {
    if (!App.hasAnyHighlights()) return;
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib || !jsPDFLib.jsPDF) { alert('Show Highlights requires jsPDF. Please refresh the page.'); return; }
    const btn = document.getElementById('bundleHighlights');
    const origText = btn.textContent;
    btn.textContent = 'Opening…';
    const EXPORT_SCALE = 4;
    const exportOverrides = { markerScale: state.exportSettings.markerScale ?? 0.75, lineScale: state.exportSettings.lineScale ?? 0.75 };
    try {
      const doc = new jsPDFLib.jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
      await App.addHighlightsToPdf(doc, { scale: EXPORT_SCALE, exportOverrides });
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('Export failed: ' + (err.message || err));
    }
    btn.textContent = origText;
  };

  document.getElementById('bundleNotes').onclick = async () => {
    if (!App.hasAnyNotes()) return;
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib || !jsPDFLib.jsPDF) { alert('Show Notes requires jsPDF. Please refresh the page.'); return; }
    const btn = document.getElementById('bundleNotes');
    const origText = btn.textContent;
    btn.textContent = 'Opening…';
    const EXPORT_SCALE = 4;
    const exportOverrides = { markerScale: state.exportSettings.markerScale ?? 0.75, lineScale: state.exportSettings.lineScale ?? 0.75 };
    try {
      const doc = new jsPDFLib.jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
      await App.addNotesToPdf(doc, { scale: EXPORT_SCALE, exportOverrides });
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('Export failed: ' + (err.message || err));
    }
    btn.textContent = origText;
  };

  // PDF bundling helpers (addReportPagesToPdf / addNotesToPdf / addHighlightsToPdf
  // / hasAnyHighlights / hasAnyNotes) moved to features/pdf-bundle.js.
  // SECTION: Custom icon upload handler
  // The #customIconUploadInput handler + parseUploadedSvg live in
  // features/custom-icon-upload.js (split #37).

  // The canvas JSON import (#importBtn / #importBtnSidebar / #importInput) and
  // the import-canvas-after-PDF prompt modal moved to features/import-clear.js.


  // showClearPageModal + the #clearPage / #clearPageSidebar openers moved to
  // features/import-clear.js (registered as App.showClearPageModal).
  // SECTION: Export & report dropdown menus
  // downloadCurrentPageAsPdf + the #downloadCurrentPageBtn mode menu moved to
  // features/output.js (the mobile burger menu keeps dispatching clicks on the
  // same .download-page-option elements).
  const exportDropdownBtn = document.getElementById('exportDropdownBtn');
  const exportDropdownMenu = document.getElementById('exportDropdownMenu');
  if (exportDropdownBtn && exportDropdownMenu) {
    exportDropdownBtn.onclick = (e) => {
      e.stopPropagation();
      const shieldImportModeClick = !state.isViewer && state.pages.length === 0;
      if (shieldImportModeClick) {
        exportDropdownMenu.classList.remove('visible');
        document.getElementById('pdfInput').click();
        return;
      }
      if (exportDropdownMenu.classList.contains('visible')) {
        exportDropdownMenu.classList.remove('visible');
      } else {
        exportDropdownMenu.style.left = '';
        exportDropdownMenu.style.right = '';
        exportDropdownMenu.classList.add('visible');
        const btnRect = exportDropdownBtn.getBoundingClientRect();
        exportDropdownMenu.style.position = 'fixed';
        exportDropdownMenu.style.left = (btnRect.right - 220) + 'px';
        exportDropdownMenu.style.top = (btnRect.bottom + 4) + 'px';
      }
    };
  }
  document.querySelectorAll('.export-dropdown-option').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      const action = opt.dataset.action;
      if (exportDropdownMenu) exportDropdownMenu.classList.remove('visible');
      if (action === 'canvas') document.getElementById('exportBtn').click();
      else if (action === 'pdf') await App.downloadProjectPdf();
      else if (action === 'both') {
        document.getElementById('exportBtn').click();
        await App.downloadProjectPdf();
      } else if (action === 'import-canvas') {
        document.getElementById('importInput').click();
      }
    };
  });
  const printReportBtn = document.getElementById('printReport');
  const showReportMenu = document.getElementById('showReportMenu');
  const showReportDropdown = document.getElementById('showReportDropdown');
  if (printReportBtn && showReportMenu) {
    printReportBtn.onclick = (e) => {
      e.stopPropagation();
      if (showReportMenu.classList.contains('visible')) {
        showReportMenu.classList.remove('visible');
        if (showReportDropdown && showReportMenu.parentElement !== showReportDropdown) showReportDropdown.appendChild(showReportMenu);
      } else {
        showReportMenu.style.left = '';
        showReportMenu.style.right = '';
        showReportMenu.classList.add('visible');
        const btnRect = printReportBtn.getBoundingClientRect();
        showReportMenu.style.position = 'fixed';
        showReportMenu.style.left = btnRect.left + 'px';
        showReportMenu.style.top = (btnRect.bottom + 4) + 'px';
        showReportMenu.style.minWidth = Math.max(btnRect.width, 280) + 'px';
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && showReportMenu.parentElement !== document.body) document.body.appendChild(showReportMenu);
      }
    };
  }
  document.querySelectorAll('.show-report-option').forEach(opt => {
    opt.onclick = (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      if (showReportMenu) {
        showReportMenu.classList.remove('visible');
        if (showReportDropdown && showReportMenu.parentElement !== showReportDropdown) showReportDropdown.appendChild(showReportMenu);
      }
      if (mode && typeof window.printReport === 'function') window.printReport(mode);
    };
  });
  document.getElementById('settingsMacros').onclick = () => { hideModal('settingsModal'); showModal('macrosModal'); };
  document.getElementById('statusBarMacros').onclick = () => showModal('macrosModal');
  document.getElementById('settingsClearPage').onclick = () => { hideModal('settingsModal'); App.showClearPageModal(); };
  document.getElementById('macrosModalClose').onclick = () => hideModal('macrosModal');
  document.getElementById('counterCustomIconsLabel')?.addEventListener('click', () => showModal('customIconTipsModal'));
  document.getElementById('counterLineTypeDetailsCustomIconsLabel')?.addEventListener('click', () => showModal('customIconTipsModal'));
  document.getElementById('plumCustomIconsLabel')?.addEventListener('click', () => showModal('customIconTipsModal'));
  document.getElementById('counterQuickCountCustomIconsLabel')?.addEventListener('click', () => showModal('customIconTipsModal'));
  document.getElementById('customIconTipsClose').onclick = () => hideModal('customIconTipsModal');
  // The Note add/edit modal (openNoteModal + its Cancel/Done handlers) lives in
  // features/note.js (window.App registry); openNoteModal is reached via
  // App.openNoteModal at call time.

  // SECTION: Sidebar drawer toggles
  // The Multiply Zone value modal, Delete Zone confirm, and Delete Page confirm
  // handlers moved to features/zone-modals.js (all element-bound; their pending
  // state lives on `state`, so no callbacks were needed).
  // The counterLineTypeDetailsClose / linePropertiesClose / deleteCounterLineType
  // confirm+cancel bindings moved to features/item-details.js with their modals;
  // the #clearPageCancel / #clearPageConfirm handlers moved to
  // features/import-clear.js with the Clear Page flow.

  document.getElementById('hamburger').onclick = () => document.body.classList.toggle('sidebar-open');
  document.getElementById('sidebarBackdrop').onclick = () => document.body.classList.remove('sidebar-open');
  // SECTION: Mobile actions burger menu pointer & header logo
  // The burger drawer (closeBurgerMenu / updateBurgerMenu + the #headerBurger /
  // #rightMenuBackdrop bindings) and the desktop header-overflow compact mode
  // (updateHeaderCollapsed / scheduleHeaderCollapseCheck + the resize listener)
  // moved to features/burger-menu.js; updateUI calls the registered
  // App.updateBurgerMenu / App.scheduleHeaderCollapseCheck defensively.
  document.getElementById('headerLogo').onclick = () => {
    if (window.matchMedia('(min-width: 769px)').matches) {
      document.body.classList.toggle('sidebar-collapsed');
    }
  };

  // SECTION: User Activity pointer (format.js + features/user-activity.js)
  // The pure formatters live in format.js (loaded before app.js) and resolve
  // here by bare name: formatLastSignIn, dateKeyInTimeZone,
  // calendarDaysFromSignInToNowInZone, formatLastSignInUserActivity,
  // formatUserActivityDateTime, filterUserActivityRows,
  // renderUserActivityAllUsersTableHtml. The DOM-coupled modal code stays below.

  // The admin User Activity modal (openUserActivityModal, the all-users/summary
  // loaders, the user-select + client-side filter, and their bindings) moved to
  // features/user-activity.js; features/user-admin.js keeps reaching it via
  // App.openUserActivityModal (registration re-homed there).

  // SECTION: My Settings pointer (features/my-settings.js)
  // openMySettings (+ every #mySettings* handler: airboard save/load/export/
  // clear, change-password form, sign-out, admin openers) moved to
  // features/my-settings.js; the three openers below reach it via
  // App.openMySettings.
  // The admin Manage-Users modals (openManageUserModal, openAllUsersModal,
  // deleteUser, the #manageUsersBtn create-user opener + #adminCreateForm, and the
  // manageUser/allUsers/adminPanel close handlers) moved to features/user-admin.js
  // (window.App registry); reached via App.openManageUserModal /
  // App.openAllUsersModal. openMySettings (My Settings + airboard) and the User
  // Activity modal stay here; the feature reaches User Activity via
  // App.openUserActivityModal + reuses App.formatLastSignIn/USER_ACTIVITY_ICON_SVG/
  // SUPABASE_URL/SUPABASE_ANON_KEY.

  // Canvas Repair lives in features/canvas-repair.js (window.App registry pilot);
  // openCanvasRepairModal / applyCanvasRepair are reached via App.* at call time.

  // The Manage Icons modal (openManageIconsModal + its Close/Cancel/Save
  // handlers) lives in features/manage-icons.js (window.App registry);
  // openManageIconsModal is reached via App.openManageIconsModal at call time.
  // getOrderedIcons/iconVbFor/getUserCustomIcons/saveUserCustomIcons/showToast
  // stay here and are published on App.

  // SECTION: Auth & settings entry buttons
  // The Manage Projects modal (openManageProjectsModal, forceCheckInProjectFromManage,
  // deleteProject, and the #manageProjectsModalClose handler) moved to
  // features/manage-projects.js (window.App registry); reached via
  // App.openManageProjectsModal. It reads the supabase client through
  // App.getSupabase() (reassigned by client recycle) + the publish-only
  // App.SUPABASE_URL/SUPABASE_ANON_KEY/updateServerClockFromRpc/
  // clearCheckoutExpiredAttention/resetAutoRecheckoutCounter.
  if (SUPABASE_ENABLED) {
    document.getElementById('authBtn').onclick = () => {
      if (state.supabaseSession?.user) {
        App.openMySettings();
      } else {
        document.getElementById('authError').style.display = 'none';
        document.getElementById('authError').textContent = '';
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';
        const authDevBypassWrap = document.getElementById('authDevBypassWrap');
        if (authDevBypassWrap) authDevBypassWrap.style.display = canUseDevAuth() ? 'block' : 'none';
        showModal('authModal');
      }
      updateUI();
    };
    document.getElementById('authBtnSidebar').onclick = () => document.getElementById('authBtn').click();
    document.getElementById('settingsSidebarBtn').onclick = () => {
      const titleEl = document.getElementById('settingsTitle');
      if (titleEl) titleEl.textContent = state.pages.length || state.currentProjectId ? ('Project Settings - ' + (state.currentProjectName || 'Untitled')) : 'Project Settings';
      document.body.classList.remove('sidebar-open');
      updateSettingsCheckoutSection();
      showModal('settingsModal');
    };
    document.getElementById('sidebarLogoUser').onclick = () => { document.body.classList.remove('sidebar-open'); App.openMySettings(); };
    document.getElementById('sidebarLogoShare').onclick = () => { document.body.classList.remove('sidebar-open'); hideModal('settingsModal'); App.openShareProjectModal(); };
    const headerShareBtnEl = document.getElementById('headerShareBtn');
    if (headerShareBtnEl) headerShareBtnEl.onclick = () => copyOrCreateViewLinkToClipboard(headerShareBtnEl);
    const hideMarksBtnEl = document.getElementById('hideMarksBtn');
    if (hideMarksBtnEl) hideMarksBtnEl.onclick = () => toggleHideMarks();
    document.getElementById('sidebarLogoGear').onclick = () => {
      const titleEl = document.getElementById('settingsTitle');
      if (titleEl) titleEl.textContent = state.pages.length || state.currentProjectId ? ('Project Settings - ' + (state.currentProjectName || 'Untitled')) : 'Project Settings';
      document.body.classList.remove('sidebar-open');
      updateSettingsCheckoutSection();
      showModal('settingsModal');
    };
    document.getElementById('statusBarAuth').onclick = () => App.openMySettings();
    // SECTION: Project Settings checkout & Save Status bell
    function updateSettingsCheckoutSection() {
      const section = document.getElementById('settingsCheckoutSection');
      const statusEl = document.getElementById('settingsCheckoutStatus');
      const checkOutBtn = document.getElementById('settingsCheckOut');
      const checkInBtn = document.getElementById('settingsCheckIn');
      const forceBtn = document.getElementById('settingsForceCheckIn');
      if (!section || !SUPABASE_ENABLED || !state.currentProjectId) {
        if (section) section.style.display = 'none';
        updateSaveStatusIndicator();
        return;
      }
      section.style.display = '';
      statusEl.textContent = '';
      checkOutBtn.style.display = 'none';
      checkInBtn.style.display = 'none';
      forceBtn.style.display = 'none';
      if (state.canCheckOut) {
        statusEl.innerHTML = 'Project is available.<br>Check out to edit.';
        checkOutBtn.style.display = '';
      } else if (state.checkedOutBy === state.supabaseSession?.user?.id) {
        statusEl.innerHTML = 'You have this project<br><strong style="text-decoration:underline">checked out.</strong>';
        checkInBtn.style.display = '';
      } else if (state.checkedOutEmail) {
        statusEl.textContent = state.checkedOutEmail + ' is editing.';
        if (state.isAdmin) forceBtn.style.display = '';
      }
      updateSaveStatusIndicator();
    }
    async function copyOrCreateViewLinkToClipboard(btn) {
      if (!state.currentProjectId || !supabase) return;
      try {
        // Flush pending edits (e.g. a just-applied page rotation) so the link's live cloud
        // data reflects the current state. Best-effort — sharing proceeds even if it fails.
        if (saveEngine.getAutoSaveDirty() && !state.isViewer && !state.loadedViaViewLink && state.supabaseSession?.user) {
          try { await performAutoSave('share_flush'); } catch (_) { /* best-effort */ }
        }
        const url = await getOrCreateViewLinkUrl();
        await navigator.clipboard.writeText(url);
        showToast('View link copied to clipboard');
        if (btn) {
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 1500);
        }
      } catch (e) {
        showToast(e.message || 'Failed to copy view link');
      }
    }
    document.getElementById('copyViewLinkBtn').onclick = () => copyOrCreateViewLinkToClipboard(document.getElementById('copyViewLinkBtn'));
    document.getElementById('settingsGearBtn').onclick = () => {
      if (state.supabaseSession?.user) {
        const titleEl = document.getElementById('settingsTitle');
        if (titleEl) titleEl.textContent = state.pages.length || state.currentProjectId ? ('Project Settings - ' + (state.currentProjectName || 'Untitled')) : 'Project Settings';
        updateSettingsCheckoutSection();
        showModal('settingsModal');
      } else {
        document.getElementById('authBtn').click();
      }
    };
    document.getElementById('authCancel').onclick = () => hideModal('authModal');
    const authDevBypassWrap = document.getElementById('authDevBypassWrap');
    const authDevBypass = document.getElementById('authDevBypass');
    if (authDevBypassWrap) authDevBypassWrap.style.display = canUseDevAuth() ? 'block' : 'none';
    if (authDevBypass) {
      authDevBypass.onclick = async () => {
        const errEl = document.getElementById('authError');
        errEl.style.display = 'none';
        const ok = await devAuthSignIn();
        if (ok) {
          hideModal('authModal');
          updateUI();
        } else {
          errEl.textContent = 'Dev sign-in failed. Check config.';
          errEl.style.display = 'block';
        }
      };
    }
    document.getElementById('settingsModalClose').onclick = () => hideModal('settingsModal');
    // The Save Status bell open buttons (#saveStatusBtn/#saveStatusBtnHeader) and
    // the #saveStatusModalClose/#saveStatusModalDone/#saveStatusVerboseToggle/
    // #saveStatusExportBtn/#saveStatusCopyBtn handlers moved to
    // features/save-status.js (window.App registry). #syncPausedBannerRetry stays.
    const syncPausedBannerRetryEl = document.getElementById('syncPausedBannerRetry');
    if (syncPausedBannerRetryEl) syncPausedBannerRetryEl.onclick = () => { retrySyncNow(); };
    async function checkInCurrentProjectIfHeld() {
      if (!state.currentProjectId || !supabase || state.checkedOutBy !== state.supabaseSession?.user?.id) return;
      try {
        const { data } = await withTimeout(supabase.rpc('check_in_project', { p_project_id: state.currentProjectId }), CHECK_IN_TIMEOUT_MS, 'Sign-out check-in');
        updateServerClockFromRpc(data);
      } catch (e) {
        try { pushSaveEvent('signout_checkin_timeout', 'Sign-out check-in did not complete', (e && e.message) || String(e)); } catch (_) {}
      }
    }
    function formatExpiryAge(ms) {
      if (!ms || ms < 0) return '';
      const minutes = Math.round(ms / 60000);
      if (minutes < 1) return 'less than a minute ago';
      if (minutes < 60) return '~' + minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
      const hours = Math.round(minutes / 60);
      return '~' + hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
    }
    // SECTION: [sync] Checkout expired recovery
    function applyCheckoutExpiredRecoveryMode(mode, ctx) {
      const modal = document.getElementById('checkoutExpiredRecoveryModal');
      if (!modal) return;
      const titleEl = document.getElementById('checkoutExpiredRecoveryTitle');
      const bodyEl = document.getElementById('checkoutExpiredRecoveryBody');
      const errEl = document.getElementById('checkoutExpiredRecoveryError');
      const recheckBtn = document.getElementById('checkoutExpiredRecoveryRecheckout');
      const exportBtn = document.getElementById('checkoutExpiredRecoveryExport');
      if (mode === 'someone_else') {
        if (titleEl) titleEl.textContent = 'Someone else is editing';
        if (bodyEl) bodyEl.textContent = (ctx && ctx.otherEmail ? ctx.otherEmail : 'Another user') + ' is editing this project now. Save your edits to a file so you don\u2019t lose them.';
        if (recheckBtn) recheckBtn.style.display = 'none';
        if (exportBtn) { exportBtn.classList.add('btn-yellow'); }
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      } else if (mode === 'error') {
        if (titleEl) titleEl.textContent = 'Edit session expired';
        if (bodyEl) bodyEl.textContent = 'Your edit session expired while idle. Your edits are still safe in this browser. Re-check out to save them to the cloud.';
        if (recheckBtn) recheckBtn.style.display = '';
        if (exportBtn) { exportBtn.classList.remove('btn-yellow'); }
        if (errEl) {
          errEl.style.display = '';
          errEl.textContent = (ctx && ctx.message) || 'Re-check out failed. Try again or export a local backup.';
        }
      } else {
        if (titleEl) titleEl.textContent = 'Edit session expired';
        if (bodyEl) bodyEl.textContent = 'Your edit session expired while idle. Your edits are still safe in this browser. Re-check out to save them to the cloud.';
        if (recheckBtn) { recheckBtn.style.display = ''; recheckBtn.disabled = false; recheckBtn.textContent = 'Re-check out and save'; }
        if (exportBtn) { exportBtn.classList.remove('btn-yellow'); }
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      }
    }
    function openCheckoutExpiredRecoveryModal(opts) {
      opts = opts || {};
      const modal = document.getElementById('checkoutExpiredRecoveryModal');
      if (!modal) return;
      try { hideModal('settingsModal'); } catch (_) {}
      applyCheckoutExpiredRecoveryMode('default');
      const ageEl = document.getElementById('checkoutExpiredRecoveryAge');
      if (ageEl) {
        const ageMs = saveEngine.computeCheckoutExpiryAgeMs();
        const label = formatExpiryAge(ageMs);
        if (label) { ageEl.style.display = ''; ageEl.textContent = 'Expired ' + label + '.'; }
        else { ageEl.style.display = 'none'; ageEl.textContent = ''; }
      }
      showModal('checkoutExpiredRecoveryModal');
      saveDebugLog('checkoutRecovery.open', { trigger: opts.trigger || 'unknown' });
    }
    function closeCheckoutExpiredRecoveryModal() {
      hideModal('checkoutExpiredRecoveryModal');
    }
    // reCheckOutAfterExpiry / tryAutoRecheckoutIfAllowed /
    // handleBackgroundCheckoutExpired live in save-engine.js (Stage 5) with
    // the auto-recheckout rate-limit state; the recovery modal handlers below
    // reach the re-checkout through this wrapper.
    function reCheckOutAfterExpiry(trigger, opts) { return saveEngine.reCheckOutAfterExpiry(trigger, opts); }
    // SECTION: [sync] Turn In
    // doTurnIn (the staged release: pre-probe, local backup, PDF/canvas
    // flush, raw-fetch check-in fallback + retry) lives in save-engine.js
    // (Stage 5). The result-handling UX below stays here with the modals.
    async function doTurnInAndHandleResult(opts) {
      opts = opts || {};
      if (checkoutExpiredNeedsAttention && state.currentProjectId && !state.isViewer) {
        pushSaveEvent('turn_in_short_circuit_expired', 'Turn In short-circuited to recovery modal');
        if (opts.hideSettings) { try { hideModal('settingsModal'); } catch (_) {} }
        openCheckoutExpiredRecoveryModal({ trigger: 'turn_in_short_circuit' });
        return { ok: false, code: 'CHECKOUT_EXPIRED', error: CHECKOUT_EXPIRED_SAVE_STATUS_MSG };
      }
      const result = await saveEngine.doTurnIn();
      if (result.ok) {
        clearCheckoutExpiredAttention();
        await refreshProjectPermissions();
        updateSettingsCheckoutSection();
        if (opts.hideSettings) hideModal('settingsModal');
        showToast(result.releasedByServer ? 'Edit session had already expired — turned in.' : 'Project turned in.');
        if (state.pdfBuffer && !state.pdfStoragePath) {
          showToast('PDF saved locally—use Name / Upload / Save Project to add it to the project.', 3000);
        }
        updateUI();
      } else {
        if (result.code === 'CHECKOUT_EXPIRED') {
          pushSaveEvent('checkout_expired', CHECKOUT_EXPIRED_SAVE_STATUS_MSG);
          checkoutExpiredNeedsAttention = true;
          suspendAutoSaveUntilCheckout = true;
          refreshProjectPermissions().catch(() => {});
          updateSaveStatusIndicator();
          if (opts.hideSettings) { try { hideModal('settingsModal'); } catch (_) {} }
          openCheckoutExpiredRecoveryModal({ trigger: 'turn_in_button' });
        } else if (typeof result.error === 'string' && /do not have .* checked out|NOT_CHECKED_OUT|not_owned/i.test(result.error)) {
          pushSaveEvent('turn_in_already_released', 'Turn In: checkout was already released elsewhere');
          showToast('You no longer hold the checkout - refreshing.', 4000);
          await refreshProjectPermissions();
          updateSettingsCheckoutSection();
          if (opts.hideSettings) hideModal('settingsModal');
          updateUI();
        } else {
          showToast(result.error || 'Failed to turn in', 3000);
        }
      }
      return result;
    }
    async function tryTurnIn(opts) {
      opts = opts || {};
      return doTurnInAndHandleResult(opts);
    }
    const headerEditBanner = document.getElementById('headerEditStatusBanner');
    async function handleEditStatusBannerClick(e) {
      const btn = e.target.closest('.header-edit-status-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'save') {
        document.getElementById('saveProjectBtn').click();
        return;
      }
      if (!state.currentProjectId || !supabase) return;
      if (action === 'checkout') {
        btn.disabled = true;
        btn.textContent = 'Checking out...';
        try {
          const { data, error } = await supabase.rpc('check_out_project', { p_project_id: state.currentProjectId });
          updateServerClockFromRpc(data);
          const result = data || (error ? { ok: false, error: error.message } : { ok: false });
          if (result.ok) {
            const wasSuspended = suspendAutoSaveUntilCheckout;
            clearCheckoutExpiredAttention();
            try { if (state.currentProjectId) resetAutoRecheckoutCounter(state.currentProjectId); } catch (_) {}
            if (wasSuspended) saveDebugLog('autosave.resumed', { trigger: 'header_banner_checkout' });
            state.checkedOutBy = state.supabaseSession?.user?.id;
            state.checkedOutAt = result.checked_out_at || new Date().toISOString();
            lastCheckoutRefreshAt = Date.now();
            state.isViewer = false;
            state.canCheckOut = false;
            updateSettingsCheckoutSection();
            updateUI();
            updateStatus();
            showToast('Project checked out. You can now edit.');
          } else {
            await refreshProjectPermissions();
            const msg = state.checkedOutEmail ? 'Project is checked out by ' + state.checkedOutEmail : (result.error || 'Failed to check out');
            showToast(msg, 5000);
            updateUI();
          }
        } finally {
          btn.disabled = false;
          updateUI();
        }
      } else if (action === 'checkin') {
        btn.disabled = true;
        btn.textContent = 'Turning in...';
        try {
          await tryTurnIn({});
        } finally {
          btn.disabled = false;
          updateUI();
        }
      } else if (action === 'checkout_expired_recover') {
        openCheckoutExpiredRecoveryModal({ trigger: 'expired_banner' });
      }
    }
    if (headerEditBanner) headerEditBanner.addEventListener('click', handleEditStatusBannerClick);
    const sidebarCheckoutBanner = document.getElementById('sidebarCheckoutBanner');
    if (sidebarCheckoutBanner) sidebarCheckoutBanner.addEventListener('click', handleEditStatusBannerClick);
    document.getElementById('settingsCheckOut').onclick = async () => {
      if (!state.currentProjectId || !supabase) return;
      const btn = document.getElementById('settingsCheckOut');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Checking out...';
      try {
        const { data, error } = await supabase.rpc('check_out_project', { p_project_id: state.currentProjectId });
        updateServerClockFromRpc(data);
        const result = data || (error ? { ok: false, error: error.message } : { ok: false });
        if (result.ok) {
          const wasSuspended = suspendAutoSaveUntilCheckout;
          clearCheckoutExpiredAttention();
          try { if (state.currentProjectId) resetAutoRecheckoutCounter(state.currentProjectId); } catch (_) {}
          if (wasSuspended) saveDebugLog('autosave.resumed', { trigger: 'settings_checkout' });
          state.checkedOutBy = state.supabaseSession?.user?.id;
          state.checkedOutAt = result.checked_out_at || new Date().toISOString();
          lastCheckoutRefreshAt = Date.now();
          state.isViewer = false;
          state.canCheckOut = false;
          updateSettingsCheckoutSection();
          updateUI();
          updateStatus();
          showToast('Project checked out. You can now edit.');
        } else {
          hideModal('settingsModal');
          await refreshProjectPermissions();
          const msg = state.checkedOutEmail
            ? 'Project is checked out by ' + state.checkedOutEmail
            : (result.error || 'Failed to check out');
          showToast(msg, 5000);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    };
    document.getElementById('settingsCheckIn').onclick = async () => {
      if (!state.currentProjectId || !supabase) return;
      const btn = document.getElementById('settingsCheckIn');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Turning in...';
      try {
        await tryTurnIn({ hideSettings: true });
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    };
    document.getElementById('settingsForceCheckIn').onclick = async () => {
      if (!state.currentProjectId || !supabase) return;
      setTurnInProgress('Force turning in…');
      let data, error;
      try {
        ({ data, error } = await supabase.rpc('force_check_in_project', { p_project_id: state.currentProjectId }));
      } finally {
        setTurnInProgress(null);
      }
      updateServerClockFromRpc(data);
      const result = data || (error ? { ok: false, error: error.message } : { ok: false });
      if (result.ok) {
        state.checkedOutBy = null;
        state.checkedOutAt = null;
        state.checkedOutEmail = null;
        clearUndoStacks();
        state.isViewer = true;
        state.canCheckOut = true;
        try { clearCheckoutExpiredAttention(); } catch (_) {}
        try { if (state.currentProjectId) resetAutoRecheckoutCounter(state.currentProjectId); } catch (_) {}
        updateSettingsCheckoutSection();
        updateUI();
        updateStatus();
        hideModal('settingsModal');
        showToast('Project force turned in.');
      } else {
        showToast(result.error || 'Failed to force turn-in', 3000);
      }
    };
    document.getElementById('settingsSaveProject').onclick = () => { hideModal('settingsModal'); document.getElementById('saveProjectBtn').click(); };
    document.getElementById('settingsAddAdditionalPages').onclick = async () => {
      // #7b: Route through Prepare PDF in append mode. We need the current
      // project's PDF buffer in memory so the commit step can merge the new
      // pages onto it; recover from pdfCache when needed.
      hideModal('settingsModal');
      if (!state.pdfBuffer && state.currentProjectId && state.pdfHash) {
        try {
          const blob = await pdfCacheGet(state.currentProjectId, state.pdfHash);
          if (blob && blob.size > 0) {
            const ab = await blob.arrayBuffer();
            state.pdfBuffer = ab;
            state.pdfBufferSize = ab.byteLength;
          }
        } catch (_) {}
      }
      if (!state.pdfBuffer) {
        showToast('Could not load the current PDF to merge new pages. Save the project, then try again.', 5000);
        return;
      }
      App.setPendingAddAdditionalPages(true);
      document.getElementById('pdfInput').click();
    };
    document.getElementById('settingsDownloadPdf').onclick = async () => { hideModal('settingsModal'); await App.downloadProjectPdf(); };
    document.getElementById('settingsAdvancedBtn').onclick = () => showModal('settingsAdvancedModal');
    document.getElementById('settingsAdvancedModalClose').onclick = () => hideModal('settingsAdvancedModal');
    document.getElementById('settingsAdvancedModal').onclick = (e) => { if (e.target.id === 'settingsAdvancedModal') hideModal('settingsAdvancedModal'); };
    document.querySelector('#settingsAdvancedModal .modal-card').onclick = (e) => e.stopPropagation();
    document.getElementById('advancedLoadTestPdf').onclick = async () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); await App.loadTestPdf(); };
    document.getElementById('advancedManageIcons').onclick = () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); App.openManageIconsModal(); };
    document.getElementById('advancedExport').onclick = () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); document.getElementById('exportBtn').click(); };
    document.getElementById('advancedExportPdf').onclick = async () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); await App.downloadProjectPdf(); };
    document.getElementById('advancedImport').onclick = () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); document.getElementById('importBtn').click(); };
    document.getElementById('advancedCanvasRepair').onclick = () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); App.openCanvasRepairModal(); };
    document.getElementById('advancedEmptyCacheReload').onclick = async () => {
      if (!confirm('Clear all cached data (IndexedDB, localStorage) and reload? Unsaved work will be lost.')) return;
      hideModal('settingsAdvancedModal');
      hideModal('settingsModal');
      try {
        indexedDB.deleteDatabase('clickcount-pdf-cache');
      } catch (_) {}
      const keysToRemove = ['clickcount-last-project', 'clickcount-save-error', 'takeoff-state', 'lineModifiers', 'plumbingModifiers', 'groupColorDisplay', 'pagesTitlesTruncated', 'hideUnmarkedPagesFromSidebar', 'counterSearch', 'lineTypeSearch', 'linesSearch', 'linesTypeExpanded', 'zoomSettings', 'specificPagesIncludeReport', 'customIconPaths'];
      for (const k of keysToRemove) { try { localStorage.removeItem(k); } catch (_) {} }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('view:allowed:')) { try { localStorage.removeItem(k); } catch (_) {} }
      }
      location.reload();
    };
    document.getElementById('advancedGlobalForceReload').onclick = async () => {
      if (!state.isAdmin) return;
      if (!confirm('Force a hard reload on EVERY signed-in user (active tabs see a Reload banner; everyone else reloads on next visit). Continue?')) return;
      const reason = (prompt('Optional note shown to users (e.g. "v1.42 update"):') || '').trim() || null;
      try {
        const { error } = await supabase.rpc('admin_trigger_global_reload', { p_reason: reason });
        if (error) { showToast(error.message || 'Failed to trigger global reload', 4000); return; }
        showToast('Global reload triggered.', 3000);
      } catch (e) {
        showToast(e?.message || 'Failed to trigger global reload', 4000);
      }
    };
    {
      const reloadBtn = document.getElementById('globalReloadBannerReload');
      const dismissBtn = document.getElementById('globalReloadBannerDismiss');
      if (reloadBtn) reloadBtn.addEventListener('click', () => doGlobalReloadNow('banner'));
      if (dismissBtn) dismissBtn.addEventListener('click', () => {
        const el = document.getElementById('globalReloadBanner');
        if (el) el.style.display = 'none';
      });
    }
    (function() {
      const section = document.getElementById('mySettingsAirboardSection');
      const header = document.getElementById('mySettingsAirboardHeader');
      const icon = document.getElementById('mySettingsAirboardCollapseIcon');
      if (header && icon) {
        header.onclick = () => {
          const collapsed = section.classList.toggle('collapsed');
          icon.textContent = collapsed ? '▶' : '▼';
          header.title = collapsed ? 'Click to expand' : 'Click to collapse';
        };
      }
    })();
    (function() {
      const section = document.getElementById('mySettingsPasswordSection');
      const header = document.getElementById('mySettingsPasswordHeader');
      const icon = document.getElementById('mySettingsPasswordCollapseIcon');
      if (header && icon) {
        header.onclick = () => {
          const collapsed = section.classList.toggle('collapsed');
          icon.textContent = collapsed ? '▶' : '▼';
          header.title = collapsed ? 'Click to expand' : 'Click to collapse';
        };
      }
    })();
    // SECTION: Share modal pointer & copy-project openers
    // The Share Project modal (openShareProjectModal + the people list, view
    // links list/create/copy/access-log/revoke, and the #shareViewLinkCreate /
    // #shareProjectModalClose / #shareProjectAdd bindings) moved to
    // features/share-links.js; reached via App.openShareProjectModal at call
    // time. Revoke clears the export view-link cache via App.onViewLinkRevoked
    // (features/output.js).
    // The copy-project modal openers, the cloud hydrate/fork cluster
    // (hydrateProjectFromCloudRow / resolvePdfBufferForCloudProject /
    // buildPagesFromPdfArrayBufferAndProjectData / fork), the save-before-load
    // gate + modal bindings, and the copy-confirm binding live in
    // features/load-project.js (registry split #35). pendingCopyProject and
    // copyProjectModalTarget are feature-owned; app.js reaches them via
    // App.resetCopyProjectState / App.clearCopyProjectModalTarget.
    // B1: Centralizes the "post-PDF-load" hydration that turns a cloud project
    // row into local session state. Used by both the Load Project modal row
    // click and the loadAnnotationsModal row click, so checkout/permissions/
    // realtime/subscription stay in lockstep.
    //
    // proj must include: id, name, updated_at, pdf_path, pdf_hash, user_id,
    //   can_edit, can_check_out, checked_out_by, checked_out_at, checked_out_email
    // opts: { reusePdfHash?: string|null, reusePdfStoragePath?: string|null,
    //         source?: 'load_project'|'load_annotations'|'restore_last' }
    // openLoadProjectModal moved to features/load-project.js (App.openLoadProjectModal);
    // the save-before-load gate + #loadProject* bindings stay in app.js.
    // in-block load-helper publish: these async fns are block-scoped (not
    // Annex-B hoisted), so publish them here where they are in scope for
    // features/load-project.js. window.App is reused by the tail registry.
    (window.App = window.App || {}).checkInCurrentProjectIfHeld = checkInCurrentProjectIfHeld;
    // resolvePdfBufferForCloudProject / buildPagesFromPdfArrayBufferAndProjectData
    // moved to features/load-project.js (split #35), registered there.
    // SECTION: Settings menu actions
    document.getElementById('settingsLoadProject').onclick = () => {
      hideModal('settingsModal');
      App.openLoadProjectModalOrPromptSave();
    };
    document.getElementById('settingsCloseProject').onclick = async () => {
      hideModal('settingsModal');
      if (state.pages.length > 0 && !confirm('Close project? Any unsaved changes will be lost.')) return;
      await checkInCurrentProjectIfHeld();
      resetGridOrigin();
      resetLocalSessionState({ keepArtboard: true });
      state.pagesListCollapsed = true;
      state.sidebarReorderModeActive = false;
      document.getElementById('pagesSection').classList.add('collapsed');
      document.getElementById('pagesCollapseIcon').textContent = '▶';
      updateUI();
      renderPdf();
    };
    document.getElementById('settingsManageProjects').onclick = () => { hideModal('settingsModal'); App.openManageProjectsModal(); };
    document.getElementById('settingsShareProject').onclick = () => { hideModal('settingsModal'); App.openShareProjectModal(); };
    // The #mySettings* handlers moved to features/my-settings.js.
    // SECTION: Auth sign-in form
    document.getElementById('authForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const errEl = document.getElementById('authError');
      errEl.style.display = 'none';
      if (!email || !password) {
        errEl.textContent = 'Email and password required';
        errEl.style.display = 'block';
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        errEl.textContent = error.message || 'Sign in failed';
        errEl.style.display = 'block';
        return;
      }
      state.supabaseSession = data.session;
      hideModal('authModal');
      updateUI();
      updateSaveStatusIndicator();
    };

    // SECTION: Save Project modal
    // The Save Project modal (open/prefill with the PDF-size probe, Include
    // PDF toggle, and the save action with its checkout-expiry preflight and
    // stale-PDF confirm) lives in features/save-project.js (registry split
    // #35b).
    document.getElementById('loadProjectBtn').onclick = () => App.openLoadProjectModalOrPromptSave();
    document.getElementById('loadProjectBtnSidebar').onclick = () => App.openLoadProjectModalOrPromptSave();
    document.getElementById('loadProjectCancel').onclick = () => hideModal('loadProjectModal');
    document.getElementById('copyProjectModalCancel').onclick = () => {
      if (App.clearCopyProjectModalTarget) App.clearCopyProjectModalTarget();
      hideModal('copyProjectModal');
    };
    document.getElementById('summaryCountDetailClose').onclick = () => hideModal('summaryCountDetailModal');
    // SECTION: Checkout expired recovery modal wiring
    (function wireCheckoutExpiredRecoveryModal() {
      const modal = document.getElementById('checkoutExpiredRecoveryModal');
      if (!modal) return;
      const closeBtn = document.getElementById('checkoutExpiredRecoveryClose');
      const cancelBtn = document.getElementById('checkoutExpiredRecoveryCancel');
      const exportBtn = document.getElementById('checkoutExpiredRecoveryExport');
      const recheckBtn = document.getElementById('checkoutExpiredRecoveryRecheckout');
      const discardBtn = document.getElementById('checkoutExpiredRecoveryDiscard');
      if (closeBtn) closeBtn.onclick = () => closeCheckoutExpiredRecoveryModal();
      if (cancelBtn) cancelBtn.onclick = () => closeCheckoutExpiredRecoveryModal();
      modal.onclick = (e) => { if (e.target === modal) closeCheckoutExpiredRecoveryModal(); };
      const card = modal.querySelector('.modal-card');
      if (card) card.onclick = (e) => e.stopPropagation();
      if (exportBtn) exportBtn.onclick = () => {
        try {
          const btn = document.getElementById('exportBtn');
          if (btn) btn.click();
          else showToast('Export not available', 3000);
        } catch (_) { showToast('Export failed', 3000); }
      };
      if (recheckBtn) recheckBtn.onclick = async () => {
        if (recheckBtn.disabled) return;
        recheckBtn.disabled = true;
        recheckBtn.textContent = 'Re-checking out...';
        try {
          const result = await reCheckOutAfterExpiry('expired_modal');
          if (result.ok) {
            closeCheckoutExpiredRecoveryModal();
          } else if (result.otherEmail) {
            applyCheckoutExpiredRecoveryMode('someone_else', { otherEmail: result.otherEmail });
          } else {
            applyCheckoutExpiredRecoveryMode('error', { message: result.error });
          }
        } finally {
          recheckBtn.disabled = false;
          if (recheckBtn.textContent === 'Re-checking out...') recheckBtn.textContent = 'Re-check out and save';
        }
      };
      if (discardBtn) discardBtn.onclick = async () => {
        if (saveEngine.isSaveInProgress() || saveEngine.isTurnInInProgress()) {
          showToast('Sync in progress, try again in a moment', 3000);
          return;
        }
        if (!confirm('Discard local edits and reload? Your unsaved local edits for this project will be lost.')) return;
        try {
          saveEngine.setAutoSaveDirty(false);
          if (state.currentProjectId) {
            try { await takeoffBackupDelete(state.currentProjectId); } catch (_) {}
          }
          pushSaveEvent('checkout_recover_discarded', 'User discarded local edits and reloaded', JSON.stringify({ projectId: state.currentProjectId || null }));
        } catch (_) {}
        try { location.reload(); } catch (_) {}
      };
    })();
    (function wireSaveStatusExpiredCallout() {
      const recheckBtn = document.getElementById('saveStatusExpiredRecheckout');
      const exportBtn = document.getElementById('saveStatusExpiredExport');
      if (recheckBtn) recheckBtn.onclick = async () => {
        if (recheckBtn.disabled) return;
        recheckBtn.disabled = true;
        const origText = recheckBtn.textContent;
        recheckBtn.textContent = 'Re-checking out...';
        try {
          const result = await reCheckOutAfterExpiry('save_status_modal');
          if (!result.ok) {
            openCheckoutExpiredRecoveryModal({ trigger: 'save_status_modal_fallback' });
            if (result.otherEmail) applyCheckoutExpiredRecoveryMode('someone_else', { otherEmail: result.otherEmail });
            else applyCheckoutExpiredRecoveryMode('error', { message: result.error });
          }
        } finally {
          recheckBtn.disabled = false;
          recheckBtn.textContent = origText;
          App.renderSaveStatusModalContent();
        }
      };
      if (exportBtn) exportBtn.onclick = () => {
        try {
          const btn = document.getElementById('exportBtn');
          if (btn) btn.click();
          else showToast('Export not available', 3000);
        } catch (_) { showToast('Export failed', 3000); }
      };
    })();
    document.getElementById('loadAnnotationsSkip').onclick = () => {
      hideModal('loadAnnotationsModal');
      renderPdf();
    };
    // C1: canvasOnlyNeedsPdfModal - opens after a canvas-only project loads so
    // the user has a clear next action (choose PDF) instead of a fleeting toast.
    document.getElementById('canvasOnlyNeedsPdfChoose').onclick = () => {
      hideModal('canvasOnlyNeedsPdfModal');
      // Refresh the banner so it appears if the user dismisses the file
      // picker. If a file is chosen, the resulting pdfInput.onchange will call
      // updateUI (which calls this again) and hide the banner once pages exist.
      updateCanvasOnlyNeedsPdfBanner();
      try { document.getElementById('pdfInput').click(); } catch (_) {}
    };
    document.getElementById('canvasOnlyNeedsPdfSkip').onclick = () => {
      hideModal('canvasOnlyNeedsPdfModal');
      updateCanvasOnlyNeedsPdfBanner();
    };
    document.getElementById('canvasOnlyNeedsPdfBannerChoose').onclick = () => {
      try { document.getElementById('pdfInput').click(); } catch (_) {}
    };
    // SECTION: Last-session restore prompt
    document.getElementById('lastSessionRestoreKeep').onclick = async () => {
      const p = pendingLastSessionRestore;
      if (!p) { hideModal('lastSessionRestoreModal'); return; }
      // Cloud last-session: the boot path deferred the Supabase fetch + PDF-blob lookup
      // to here (so the modal could appear instantly). Resolve the project now, behind a
      // brief loading state on the modal buttons.
      if (p.cloudLast) {
        const last = p.cloudLast;
        const keepBtn = document.getElementById('lastSessionRestoreKeep');
        const discardBtn = document.getElementById('lastSessionRestoreDiscard');
        const keepLabel = keepBtn ? keepBtn.textContent : '';
        if (keepBtn) { keepBtn.disabled = true; keepBtn.textContent = 'Loading…'; }
        if (discardBtn) discardBtn.disabled = true;
        const currentUid = state.supabaseSession?.user?.id || null;
        try {
          let proj = null, fetchErr = null;
          try {
            const res = await supabase.from('projects').select('id, name, data, updated_at, pdf_path, pdf_hash, user_id, checked_out_by, checked_out_at').eq('id', last.projectId).single();
            proj = res.data; fetchErr = res.error;
          } catch (netErr) { fetchErr = netErr; }
          const accessDenied = !!fetchErr && (fetchErr.code === 'PGRST116' || /no rows|denied|permission|policy/i.test(fetchErr.message || ''));
          if (accessDenied) {
            try { pushSaveEvent('last_session_restore_skip_inaccessible', 'Last-session project not accessible to current user', JSON.stringify({ projectId: last.projectId, code: fetchErr.code, message: fetchErr.message })); } catch (_) {}
            try { localStorage.removeItem('clickcount-last-project'); } catch (_) {}
            try { await takeoffBackupDelete(last.projectId); } catch (_) {}
            showToast('This project is no longer available.', 5000);
            return;
          }
          // Network/other error (e.g. offline): fall back to a local IndexedDB backup if
          // one exists, so resuming offline still works.
          let projForRestore = proj;
          if (!projForRestore) {
            const idbBackup = await takeoffBackupGet(last.projectId, currentUid);
            if (idbBackup && idbBackup.data) {
              projForRestore = { id: last.projectId, name: idbBackup.projectName || last.projectName || 'Untitled', data: backupDataToProjFormat(idbBackup.data || {}), updated_at: null, pdf_path: null, pdf_hash: idbBackup.pdfHash, user_id: last.userId, checked_out_by: null, checked_out_at: null };
            }
          }
          if (!projForRestore) throw (fetchErr || new Error('Project unavailable'));
          const pdfHashForCache = projForRestore.pdf_hash || last.pdfHash;
          const cachedBlob = pdfHashForCache ? await pdfCacheGet(last.projectId, pdfHashForCache) : null;
          await doRestoreLastProject(projForRestore, cachedBlob);
          updateUI();
        } catch (err) {
          showToast('Failed to restore project: ' + (err?.message || 'Unknown error'), 5000);
        } finally {
          pendingLastSessionRestore = null;
          hideModal('lastSessionRestoreModal');
          if (keepBtn) { keepBtn.disabled = false; keepBtn.textContent = keepLabel || 'Keep and Open'; }
          if (discardBtn) discardBtn.disabled = false;
        }
        return;
      }
      pendingLastSessionRestore = null;
      hideModal('lastSessionRestoreModal');
      try {
        await doRestoreLastProject(p.proj, p.cachedBlob);
        updateUI();
      } catch (err) {
        showToast('Failed to restore project: ' + (err?.message || 'Unknown error'), 5000);
      }
    };
    document.getElementById('lastSessionRestoreDiscard').onclick = async () => {
      const p = pendingLastSessionRestore;
      if (!p) { hideModal('lastSessionRestoreModal'); return; }
      const projectId = p.cloudLast ? p.cloudLast.projectId : (p.proj && p.proj.id);
      pendingLastSessionRestore = null;
      hideModal('lastSessionRestoreModal');
      try { localStorage.removeItem('clickcount-last-project'); } catch (_) {}
      if (projectId) {
        await pdfCacheDelete(projectId);
        await takeoffBackupDelete(projectId);
      }
      updateUI();
    };
    // The admin Manage-Users handlers (#manageUsersBtn create-user opener,
    // #manageUsersBtnSidebar, #adminPanelClose, #manageUserModalClose,
    // manageUserModalAllActivityBtn, #allUsersModalClose, #adminCreateForm below)
    // moved to features/user-admin.js (window.App registry).
    // SECTION: Canvas Repair modal wiring
    // The #userActivity* close/select/filter/view-toggle bindings moved to
    // features/user-activity.js.
    // #manageProjectsModalClose moved to features/manage-projects.js.
    // manageIconsModalClose / manageIconsCancel / manageIconsSave handlers live
    // in features/manage-icons.js (window.App registry). The #canvasRepair*
    // close/cancel/apply bindings live in features/canvas-repair.js (split #37).
    // #adminCreateForm (create-user) moved to features/user-admin.js.
  }

  document.getElementById('ctxEdit').onclick = () => {
    const t = state.ctxTarget;
    if (!t || (t.type !== 'note' && t.type !== 'noteResize' && t.type !== 'noteFontSize')) return;
    const page = state.pages[state.currentPage];
    const ann = page ? getActiveAnnotations(page) : null;
    const note = ann?.notes?.[t.index];
    if (note) {
      document.getElementById('contextMenu').classList.remove('visible');
      state.ctxTarget = null;
      App.openNoteModal('edit', note.text, note);
    }
  };
  document.getElementById('ctxLineProperties').onclick = () => {
    const t = state.ctxTarget;
    if (!t || (t.type !== 'quickLine' && t.type !== 'polyline')) return;
    const page = state.pages[state.currentPage];
    const ann = page ? getActiveAnnotations(page) : null;
    if (!ann) return;
    let it = null;
    if (t.type === 'quickLine') it = { type: 'quick', q: ann.quickLines[t.index], pageIdx: state.currentPage };
    else if (t.type === 'polyline') it = { type: 'poly', poly: ann.polylines[t.index], pageIdx: state.currentPage };
    if (!it) return;
    document.getElementById('contextMenu').classList.remove('visible');
    App.openLinePropertiesModal(it);
  };
  document.getElementById('ctxShowLength').onclick = () => {
    const t = state.ctxTarget;
    if (!t || (t.type !== 'quickLine' && t.type !== 'polyline')) return;
    const page = state.pages[state.currentPage];
    const ann = page ? getActiveAnnotations(page) : null;
    if (!ann) return;
    const line = t.type === 'quickLine' ? ann.quickLines[t.index] : ann.polylines[t.index];
    if (!line) return;
    pushUndoSnapshot();
    line.showLength = !line.showLength;
    markProjectDirty();
    document.getElementById('contextMenu').classList.remove('visible');
    state.ctxTarget = null;
    renderPdf();
    updateUI();
  };
  document.getElementById('ctxAssignGroup').onclick = () => {
    const t = state.ctxTarget;
    if (!t || (t.type !== 'marker' && t.type !== 'quickLine' && t.type !== 'polyline')) return;
    const page = state.pages[state.currentPage];
    const ann = page ? getActiveAnnotations(page) : null;
    if (!ann) return;
    let item = null;
    if (t.type === 'marker') item = ann.counterMarkers?.[t.typeId]?.[t.index];
    else if (t.type === 'quickLine') item = ann.quickLines?.[t.index];
    else if (t.type === 'polyline') item = ann.polylines?.[t.index];
    if (!item) return;
    document.getElementById('contextMenu').classList.remove('visible');
    App.openGroupAssignModal(item);
  };
  const ctxEditRoomBoxEl = document.getElementById('ctxEditRoomBox');
  if (ctxEditRoomBoxEl) ctxEditRoomBoxEl.onclick = () => {
    document.getElementById('contextMenu').classList.remove('visible');
    const t = state.ctxTarget;
    state.ctxTarget = null;
    if (t?.type === 'roomBox') App.openRoomBoxModalForEdit(t.index);
  };
  document.getElementById('ctxEditMultiplyZone').onclick = () => {
    const t = state.ctxTarget;
    if (!t || t.type !== 'multiplyZone') return;
    document.getElementById('contextMenu').classList.remove('visible');
    const page = state.pages[state.currentPage];
    const ann = page ? getActiveAnnotations(page) : null;
    const zone = ann?.multiplyZones?.[t.index];
    if (!zone) return;
    state.pendingMultiplyZoneEdit = { zoneIndex: t.index };
    state.pendingMultiplyZone = null;
    const mult = zone.multiplier ?? 1;
    state.pendingMultiplyZoneValue = mult;
    const inputEl = document.getElementById('multiplyZoneMultiplier');
    const previewEl = document.getElementById('multiplyZonePreview');
    const titleEl = document.querySelector('#multiplyZoneModal h2');
    if (inputEl) inputEl.value = String(mult);
    if (previewEl) previewEl.textContent = 'Change the multiplier for this zone.';
    if (titleEl) titleEl.textContent = 'Edit zone multiplier';
    showModal('multiplyZoneModal');
    state.ctxTarget = null;
  };
  document.getElementById('ctxEditScaleZone').onclick = () => {
    const t = state.ctxTarget;
    if (!t || t.type !== 'scaleZone') return;
    document.getElementById('contextMenu').classList.remove('visible');
    const page = state.pages[state.currentPage];
    const ann = page ? getActiveAnnotations(page) : null;
    if (!ann?.scaleZones?.[t.index]) return;
    state.scaleModalApplyTarget = 'zone';
    state.pendingScaleZone = null;
    state.pendingScaleZoneEdit = { zoneIndex: t.index };
    const h2 = document.querySelector('#scaleModal h2');
    if (h2) h2.textContent = 'Edit zone scale';
    App.openScaleModal();
    state.ctxTarget = null;
  };
  document.getElementById('ctxDelete').onclick = () => {
    const t = state.ctxTarget;
    if (!t) return;
    pushUndoSnapshot();
    const page = state.pages[state.currentPage];
    const canvas = page ? getActiveCanvas(page) : null;
    const ann = canvas?.annotations;
    if (!ann) return;
    if (t.type === 'marker') {
      const arr = ann.counterMarkers[t.typeId];
      if (arr) arr.splice(t.index, 1);
    } else if (t.type === 'quickLine') {
      const deletedId = ann.quickLines[t.index]?.id;
      ann.quickLines.splice(t.index, 1);
      if (deletedId === state.selectedLineId && !state.selectedLineIsPoly) {
        state.selectedLineId = null;
        state.selectedLineIsPoly = false;
        state.selectedLinePageIdx = null;
      }
    } else if (t.type === 'polyline') {
      const deletedId = ann.polylines[t.index]?.id;
      ann.polylines.splice(t.index, 1);
      if (deletedId === state.selectedLineId && state.selectedLineIsPoly) {
        state.selectedLineId = null;
        state.selectedLineIsPoly = false;
        state.selectedLinePageIdx = null;
      }
    } else if (t.type === 'highlight') {
      ann.highlights.splice(t.index, 1);
    } else if (t.type === 'multiplyZone') {
      if (ann.multiplyZones) ann.multiplyZones.splice(t.index, 1);
    } else if (t.type === 'scaleZone') {
      if (ann.scaleZones) ann.scaleZones.splice(t.index, 1);
    } else if (t.type === 'note' || t.type === 'noteResize' || t.type === 'noteFontSize') {
      ann.notes.splice(t.index, 1);
    }
    markProjectDirty();
    document.getElementById('contextMenu').classList.remove('visible');
    state.ctxTarget = null;
    renderAnnotations();
    renderPdf();
    updateUI();
  };

  // SECTION: Canvas Event Handlers
  function showContextMenu(x, y) {
    const menu = document.getElementById('contextMenu');
    const editBtn = document.getElementById('ctxEdit');
    const linePropsBtn = document.getElementById('ctxLineProperties');
    const showLengthBtn = document.getElementById('ctxShowLength');
    const assignGroupBtn = document.getElementById('ctxAssignGroup');
    editBtn.style.display = (state.ctxTarget?.type === 'note' || state.ctxTarget?.type === 'noteResize' || state.ctxTarget?.type === 'noteFontSize') ? 'block' : 'none';
    const canLineProps = !state.isViewer && (state.ctxTarget?.type === 'quickLine' || state.ctxTarget?.type === 'polyline');
    linePropsBtn.style.display = canLineProps ? 'block' : 'none';
    const canShowLength = !state.isViewer && (state.ctxTarget?.type === 'quickLine' || state.ctxTarget?.type === 'polyline');
    showLengthBtn.style.display = canShowLength ? 'block' : 'none';
    if (canShowLength) {
      const page = state.pages[state.currentPage];
      const ann = page ? getActiveAnnotations(page) : null;
      const line = state.ctxTarget?.type === 'quickLine' ? ann?.quickLines?.[state.ctxTarget.index] : ann?.polylines?.[state.ctxTarget.index];
      showLengthBtn.textContent = line?.showLength ? 'Hide Length' : 'Show Length';
    }
    const canAssignGroup = !state.isViewer && (state.ctxTarget?.type === 'marker' || state.ctxTarget?.type === 'quickLine' || state.ctxTarget?.type === 'polyline');
    assignGroupBtn.style.display = canAssignGroup ? 'block' : 'none';
    const ctxEditMzBtn = document.getElementById('ctxEditMultiplyZone');
    ctxEditMzBtn.style.display = !state.isViewer && state.ctxTarget?.type === 'multiplyZone' ? 'block' : 'none';
    const ctxEditSzBtn = document.getElementById('ctxEditScaleZone');
    ctxEditSzBtn.style.display = !state.isViewer && state.ctxTarget?.type === 'scaleZone' ? 'block' : 'none';
    const ctxEditRoomBoxBtn = document.getElementById('ctxEditRoomBox');
    if (ctxEditRoomBoxBtn) ctxEditRoomBoxBtn.style.display = !state.isViewer && state.ctxTarget?.type === 'roomBox' ? 'block' : 'none';
    const nameRow = document.getElementById('ctxTargetNameRow');
    if (nameRow) {
      const t = state.ctxTarget;
      let targetLabel = null;
      if (t && (t.type === 'marker' || t.type === 'quickLine' || t.type === 'polyline')) {
        if (t.type === 'marker') {
          const c = (state.counters || []).find(x => x.id === t.typeId);
          targetLabel = c ? (c.name || 'Counter') : 'Unknown';
        } else {
          const page = state.pages[state.currentPage];
          const ann = page ? getActiveAnnotations(page) : null;
          const line = ann ? (t.type === 'quickLine' ? ann.quickLines?.[t.index] : ann.polylines?.[t.index]) : null;
          if (line) {
            const lt = (state.lineTypes || []).find(l => l.id === line.lineTypeId);
            targetLabel = lt ? (lt.name || 'Line') : '\u2014';
          }
        }
      }
      if (targetLabel != null) {
        nameRow.textContent = targetLabel;
        nameRow.style.display = 'block';
        nameRow.setAttribute('aria-hidden', 'false');
      } else {
        nameRow.textContent = '';
        nameRow.style.display = 'none';
        nameRow.setAttribute('aria-hidden', 'true');
      }
    }
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('visible');
  }

  // Commit one Quick Line point (start, then end). Shared by the desktop click path,
  // the mobile tap path (handleTouchAsCanvasTap), and the loupe-release path — so all
  // three apply identical snap (H/V) + bounds handling. Callers render + updateUI.
  function commitLinePoint(pdf) {
    const lt = state.lineTypes.find(l => l.id === state.activeLineTypeId);
    if (!state.quickLineStart) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      state.quickLineStart = pdf;
    } else {
      let x2 = pdf.x, y2 = pdf.y;
      if (state.lineTypeSettings.snapToHorizontalVertical) {
        const end = snapToHorizontalOrVertical(state.quickLineStart.x, state.quickLineStart.y, pdf.x, pdf.y);
        x2 = end.x; y2 = end.y;
        if (!isPointInPageBounds({ x: x2, y: y2 })) {
          const clamped = clampPointToPageBounds({ x: x2, y: y2 });
          x2 = clamped.x; y2 = clamped.y;
        }
      } else {
        if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      }
      pushUndoSnapshot();
      const page = state.pages[state.currentPage];
      const canvas = page && ensureActiveCanvas(page);
      if (canvas) { if (!canvas.annotations.quickLines) canvas.annotations.quickLines = []; canvas.annotations.quickLines.push({ x1: state.quickLineStart.x, y1: state.quickLineStart.y, x2, y2, color: lt?.color || '#4a9eff', id: uid(), lineTypeId: state.activeLineTypeId, group: state.activeGroupId || null }); }
      logLineAddedEvent('quick');
      state.quickLineStart = null;
      markProjectDirty();
    }
  }

  // Commit one in-progress Polyline vertex. Shared by the desktop click + loupe-release
  // paths (same snap-to-previous-axis + bounds). Callers render + updateUI.
  function commitPolylinePoint(pdf) {
    if (!state.drawingPolyline) return;
    let pt = pdf;
    if (state.drawingPolyline.points.length >= 1 && state.lineTypeSettings.snapToHorizontalVertical) {
      const prev = state.drawingPolyline.points[state.drawingPolyline.points.length - 1];
      pt = snapToHorizontalOrVertical(prev.x, prev.y, pdf.x, pdf.y);
      if (!isPointInPageBounds(pt)) pt = clampPointToPageBounds(pt);
    } else {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
    }
    pushUndoSnapshot();
    state.drawingPolyline.points.push(pt);
    markProjectDirty();
  }

  // Commit one Measure point (point A, then point B -> distance toast). Shared by
  // the desktop click path and the mobile loupe-release path. opts.fromAim bypasses
  // the 400ms double-tap guard (a deliberate press-and-hold easily exceeds 400ms).
  function commitMeasurePoint(pdf, opts) {
    opts = opts || {};
    if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
    const now = Date.now();
    if (!opts.fromAim && now - state.lastScaleTapTime < 400) return;
    state.lastScaleTapTime = now;
    if (state.scaleMode === SCALE_MODES.POINT_A) {
      state.scalePointA = pdf;
      state.scaleMode = SCALE_MODES.POINT_B;
    } else if (state.scaleMode === SCALE_MODES.POINT_B) {
      state.scalePointB = pdf;
      const dist = ptDist(state.scalePointA, state.scalePointB);
      const page = state.pages[state.currentPage];
      const ann = page ? getActiveAnnotations(page) : null;
      const measLine = { x1: state.scalePointA.x, y1: state.scalePointA.y, x2: state.scalePointB.x, y2: state.scalePointB.y };
      const effScale = ann ? getEffectiveScaleForLine(ann, measLine, false, state.currentPage) : getPageScale(state.currentPage);
      const formatted = formatDistFeetInches(dist, effScale);
      showToast('Distance: ' + formatted, 5000);
      state.scalePointA = null;
      state.scalePointB = null;
      state.scaleMode = SCALE_MODES.NONE;
      state.tool = TOOL.NONE;
    }
    renderPdf();
    updateUI();
  }

  // pdfOverride: when set (loupe-release path), place at that exact PDF point instead
  // of deriving it from the event — lets the aim loupe reuse every tool's commit branch.
  function handleCanvasClick(e, pdfOverride) {
    if (!state.pages.length) return;
    if (state.isViewer && state.tool !== TOOL.NONE && state.tool !== TOOL.MEASURE && state.tool !== TOOL.SCALE) return;
    let pdf;
    if (pdfOverride) { pdf = pdfOverride; }
    else { const pt = canvasPointFromEvent(e); pdf = canvasToPdf(pt.x, pt.y); }
    state.mousePos = pdf;
    if (state.gridOriginPickMode) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const pageScale = getPageScale(state.currentPage);
      if (!pageScale) { showToast('Set Scale first'); state.gridOriginPickMode = false; return; }
      const offsetX = pdf.x / pageScale.pixelsPerUnit;
      const offsetY = pdf.y / pageScale.pixelsPerUnit;
      if (!state.gridSettings) state.gridSettings = { spacing: 3, unit: 'ft' };
      state.gridSettings.offsetX = offsetX;
      state.gridSettings.offsetY = offsetY;
      document.getElementById('gridOriginDisplay').style.display = '';
      document.getElementById('gridSetOriginFormGroup').style.display = 'none';
      document.getElementById('gridOriginText').textContent = offsetX.toFixed(2) + ', ' + offsetY.toFixed(2) + ' ' + (document.getElementById('gridSpacingUnit')?.value || 'ft');
      state.gridOriginPickMode = false;
      showModal('gridSettingsModal');
      showToast('Origin set. Click Apply to confirm.');
      renderPdf();
      updateUI();
      return;
    }
    if (state.tool === TOOL.SCALE) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const now = Date.now();
      if (!pdfOverride && now - state.lastScaleTapTime < 400) return;   // bypass double-tap guard on aim
      state.lastScaleTapTime = now;
      if (state.scaleMode === SCALE_MODES.POINT_A) { state.scalePointA = pdf; state.scaleMode = SCALE_MODES.POINT_B; }
      else if (state.scaleMode === SCALE_MODES.POINT_B) {
        state.scalePointB = pdf;
        document.getElementById('scaleValue').value = '';
        App.openScaleModal();
      }
      renderPdf();
    } else if (state.tool === TOOL.MEASURE) {
      commitMeasurePoint(pdf);
    } else if (state.tool === TOOL.LINE) {
      commitLinePoint(pdf);
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.POLYLINE && state.drawingPolyline) {
      commitPolylinePoint(pdf);
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.COUNTER && state.activeCounterType) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      pushUndoSnapshot();
      let pos = pdf;
      if (state.gridSettings?.snapToGrid && state.showGridOverlay) pos = snapToGrid(pdf, state.currentPage);
      const page = state.pages[state.currentPage];
      const canvas = page && ensureActiveCanvas(page);
      if (canvas) {
        if (!canvas.annotations.counterMarkers[state.activeCounterType]) canvas.annotations.counterMarkers[state.activeCounterType] = [];
        canvas.annotations.counterMarkers[state.activeCounterType].push({ x: pos.x, y: pos.y, id: uid(), group: state.activeGroupId || null });
        logCounterMarkerAddedEvent();
        markProjectDirty();
      }
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.HIGHLIGHT) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const page = state.pages[state.currentPage];
      if (!state.highlightStart) state.highlightStart = pdf;
      else {
        const canvas = page && ensureActiveCanvas(page);
        if (canvas) {
          pushUndoSnapshot();
          if (!canvas.annotations.highlights) canvas.annotations.highlights = [];
          const x1 = state.highlightStart.x, y1 = state.highlightStart.y, x2 = pdf.x, y2 = pdf.y;
          canvas.annotations.highlights.push({ x1, y1, x2, y2, color: '#e8c547', opacity: 0.25, id: uid() });
          markProjectDirty();
        }
        state.highlightStart = null;
      }
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.MULTIPLY_ZONE) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const page = state.pages[state.currentPage];
      if (!state.multiplyZoneStart) {
        state.multiplyZoneStart = pdf;
      } else {
        const canvas = page && ensureActiveCanvas(page);
        if (canvas) {
          const x1 = Math.min(state.multiplyZoneStart.x, pdf.x), x2 = Math.max(state.multiplyZoneStart.x, pdf.x);
          const y1 = Math.min(state.multiplyZoneStart.y, pdf.y), y2 = Math.max(state.multiplyZoneStart.y, pdf.y);
          const zones = canvas.annotations.multiplyZones || [];
          const overlaps = zones.some(z => rectsOverlap(x1, y1, x2, y2, z.x1, z.y1, z.x2, z.y2));
          if (overlaps) {
            showToast('Cannot place multiply zone:\nIt overlaps an existing zone.\nItems cannot be multiplied more than once.', 4000);
            state.multiplyZoneStart = null;
          } else {
            const counts = countItemsInRect(canvas.annotations, state.currentPage, x1, y1, x2, y2);
            const lenStr = formatFeet(counts.lengthRealSum, page?.scale);
            state.pendingMultiplyZone = { x1, y1, x2, y2 };
            state.pendingMultiplyZoneValue = state.multiplyZoneSettings?.defaultMultiplier ?? 2;
            const mzTitleEl = document.querySelector('#multiplyZoneModal h2');
            if (mzTitleEl) mzTitleEl.textContent = 'Multiply Zone';
            document.getElementById('multiplyZonePreview').textContent = 'In this area: ' + counts.counterCount + ' counter(s), ' + counts.lineRunCount + ' line run(s) (' + lenStr + ')';
            document.getElementById('multiplyZoneMultiplier').value = String(state.pendingMultiplyZoneValue);
            showModal('multiplyZoneModal');
          }
        }
        state.multiplyZoneStart = null;
      }
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.SCALE_ZONE) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      if (!getPageScale(state.currentPage)) {
        showSetScaleFirstToast('Scale Zone');
        return;
      }
      const page = state.pages[state.currentPage];
      if (!state.scaleZoneStart) {
        state.scaleZoneStart = pdf;
      } else {
        const canvas = page && ensureActiveCanvas(page);
        if (canvas) {
          const x1 = Math.min(state.scaleZoneStart.x, pdf.x), x2 = Math.max(state.scaleZoneStart.x, pdf.x);
          const y1 = Math.min(state.scaleZoneStart.y, pdf.y), y2 = Math.max(state.scaleZoneStart.y, pdf.y);
          const szones = canvas.annotations.scaleZones || [];
          const overlaps = szones.some(z => rectsOverlap(x1, y1, x2, y2, z.x1, z.y1, z.x2, z.y2));
          if (overlaps) {
            showToast('Cannot place scale zone:\nit overlaps an existing scale zone.', 4000);
            state.scaleZoneStart = null;
          } else {
            state.scaleModalApplyTarget = 'zone';
            state.pendingScaleZone = { x1, y1, x2, y2 };
            state.pendingScaleZoneEdit = null;
            const h2 = document.querySelector('#scaleModal h2');
            if (h2) h2.textContent = 'Scale for zone';
            App.openScaleModal();
          }
        }
        state.scaleZoneStart = null;
      }
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.ROOM) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      if (!getPageScale(state.currentPage)) { showSetScaleFirstToast('Room Sizer'); return; }
      if (!state.roomBoxStart) {
        state.roomBoxStart = pdf;
      } else {
        const x1 = Math.min(state.roomBoxStart.x, pdf.x), x2 = Math.max(state.roomBoxStart.x, pdf.x);
        const y1 = Math.min(state.roomBoxStart.y, pdf.y), y2 = Math.max(state.roomBoxStart.y, pdf.y);
        state.roomBoxStart = null;
        App.openRoomBoxModal({ x1, y1, x2, y2 });
      }
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.DELETE_ZONE) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const page = state.pages[state.currentPage];
      if (!state.deleteZoneStart) {
        state.deleteZoneStart = pdf;
      } else {
        const canvas = page && ensureActiveCanvas(page);
        const ann = canvas?.annotations;
        if (ann) {
          const x1 = Math.min(state.deleteZoneStart.x, pdf.x), x2 = Math.max(state.deleteZoneStart.x, pdf.x);
          const y1 = Math.min(state.deleteZoneStart.y, pdf.y), y2 = Math.max(state.deleteZoneStart.y, pdf.y);
          const collected = collectItemsToDeleteInRect(ann, state.currentPage, x1, y1, x2, y2);
          const total = collected.counterCount + collected.lineRunCount + collected.highlightCount + collected.noteCount + collected.multiplyZoneCount + collected.scaleZoneCount + collected.roomBoxCount;
          if (total === 0) {
            showToast('No items in this area.', 2000);
          } else {
            const lenStr = formatFeet(collected.lengthRealSum, page?.scale);
            const parts = [];
            if (collected.counterCount) parts.push(collected.counterCount + ' counter(s)');
            if (collected.lineRunCount) parts.push(collected.lineRunCount + ' line run(s) (' + lenStr + ')');
            if (collected.highlightCount) parts.push(collected.highlightCount + ' highlight(s)');
            if (collected.noteCount) parts.push(collected.noteCount + ' note(s)');
            if (collected.multiplyZoneCount) parts.push(collected.multiplyZoneCount + ' multiply zone(s)');
            if (collected.scaleZoneCount) parts.push(collected.scaleZoneCount + ' scale zone(s)');
            if (collected.roomBoxCount) parts.push(collected.roomBoxCount + ' room box(es)');
            state.pendingDeleteZone = { ann, collected };
            document.getElementById('deleteZonePreview').textContent = 'In this area: ' + parts.join(', ');
            showModal('deleteZoneModal');
          }
        }
        state.deleteZoneStart = null;
      }
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.NOTE) {
      const tNote = hitTest(pdf);
      if (tNote && (tNote.type === 'note' || tNote.type === 'noteResize' || tNote.type === 'noteFontSize')) {
        const page = state.pages[state.currentPage];
        const ann = page ? getActiveAnnotations(page) : null;
        const note = ann?.notes?.[tNote.index];
        if (note) { App.openNoteModal('edit', note.text, note); return; }
      }
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      App.openNoteModal('add', '', { x: pdf.x, y: pdf.y });
    } else if (state.tool === TOOL.EDIT_POLY && state.editingPolyline) {
      if (state.draggingVertexIdx !== null) state.draggingVertexIdx = null;
    }
    updateUI();
  }

  function handleCanvasDblClick(e) {
    if (state.isViewer) return;
    if (state.tool === TOOL.POLYLINE && state.drawingPolyline && state.drawingPolyline.points.length >= 2) {
      finishPolyline(false);
      return;
    }
    if (state.tool === TOOL.NONE || state.tool === TOOL.NOTE) {
      const pt = canvasPointFromEvent(e);
      const pdf = canvasToPdf(pt.x, pt.y);
      const t = hitTest(pdf);
      if (t && (t.type === 'note' || t.type === 'noteResize' || t.type === 'noteFontSize')) {
        const page = state.pages[state.currentPage];
        const ann = page ? getActiveAnnotations(page) : null;
        const note = ann?.notes?.[t.index];
        if (note) App.openNoteModal('edit', note.text, note);
      }
    }
  }

  function handleContextMenu(e) {
    e.preventDefault();
    if (state.isViewer) return;
    const pt = canvasPointFromEvent(e);
    const pdf = canvasToPdf(pt.x, pt.y);
    if (state.tool === TOOL.EDIT_POLY && state.editingPolyline) {
      const pts = state.editingPolyline.points || [];
      const r = 12 / state.zoom;
      const idx = pts.findIndex(p => ptDist(pdf, p) < r);
      if (idx >= 0 && pts.length > 2) {
        pushUndoSnapshot();
        pts.splice(idx, 1);
        renderAnnotations();
        updateUI();
        return;
      }
    }
    if (state.tool === TOOL.POLYLINE && state.drawingPolyline && state.drawingPolyline.points.length >= 3) {
      finishPolyline(true);
      return;
    }
    state.ctxTarget = hitTest(pdf);
    if (state.ctxTarget) showContextMenu(e.clientX, e.clientY);
  }

  // SECTION: Event Binding
  const cWrapper = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper');
  // Prefetch yields to any canvas interaction (pdf.js runs operator lists in
  // main-thread chunks — a speculative raster must never jank a gesture).
  // Capture phase + passive: observation only, never interferes with the real
  // handlers below.
  ['wheel', 'touchstart', 'pointerdown'].forEach((evt) => {
    (cWrapper || pdfCanvas).addEventListener(evt, cancelPdfBitmapPrefetch, { passive: true, capture: true });
  });

  // SECTION: Aim loupe (mobile press-hold precise placement)
  // Press-and-hold on a placement tool summons a magnifier loupe + an offset
  // crosshair that track the finger; lifting commits the point at the crosshair
  // (not the raw fingertip). A quick tap is unaffected (instant placement).
  const AIM_PRESS_MS = 280;            // shorter than the 500ms context-menu long-press
  const AIM_OFFSET_LOGICAL_PX = 44;    // crosshair sits this far ABOVE the fingertip
  const LOUPE_MAGNIFY = 2.5;
  const LOUPE_DIAMETER_LOGICAL = 120;

  // Which tools support press-hold-aim: Measure, Quick Line, and an in-progress Polyline.
  // Tools that support press-hold-aim (loupe). All point-placement tools qualify;
  // TOOL.NONE (pan) and EDIT_POLY (its own vertex-drag loupe) are excluded.
  function isAimingTool() {
    if (state.gridOriginPickMode) return true;
    switch (state.tool) {
      case TOOL.MEASURE:
      case TOOL.SCALE:
      case TOOL.LINE:
      case TOOL.COUNTER:
      case TOOL.HIGHLIGHT:
      case TOOL.MULTIPLY_ZONE:
      case TOOL.SCALE_ZONE:
      case TOOL.DELETE_ZONE:
      case TOOL.ROOM:
      case TOOL.NOTE:
        return true;
      case TOOL.POLYLINE:
        return !!state.drawingPolyline;
      default:
        return false;
    }
  }

  // Commit the aimed point through the active tool's normal commit path (so snap +
  // bounds are identical to a tap/click). Measure keeps the fromAim guard-bypass; every
  // other tool is routed through handleCanvasClick's branch for that tool.
  function commitAimPoint(pdf) {
    if (state.tool === TOOL.MEASURE) { commitMeasurePoint(pdf, { fromAim: true }); return; }
    handleCanvasClick(null, pdf);
  }

  // Client coords -> wrapper-logical -> PDF, offset upward by state.aimOffsetPx so a
  // finger doesn't cover the target (0 for mouse — the cursor doesn't occlude), then
  // clamped to the page so the crosshair is always placeable. opts.offsetPx (set at
  // enterAiming) is sticky so the per-move tracker reuses the right offset.
  function updateAimFromClient(c, opts) {
    if (opts && typeof opts.offsetPx === 'number') state.aimOffsetPx = opts.offsetPx;
    const offset = state.aimOffsetPx || 0;
    const rect = (cWrapper || pdfCanvas).getBoundingClientRect();
    const fingerPdf = canvasToPdf(c.x - rect.left, c.y - rect.top);
    const aim = clampPointToPageBounds({ x: fingerPdf.x, y: fingerPdf.y - offset / state.zoom });
    state.aimPoint = aim;
    state.mousePos = aim;     // so the rubber band + status coords follow the crosshair
    state.aimClient = c;
  }

  function hideAimLoupe() { if (aimLoupe) aimLoupe.style.display = 'none'; }

  function cancelAiming() {
    if (state.aimPressTimer) { clearTimeout(state.aimPressTimer); state.aimPressTimer = null; }
    state.aiming = false;
    state.aimPoint = null;
    state.aimClient = null;
    state.aimRafPending = false;
    state.aimOffsetPx = 0;
    state.aimMouseDownClient = null;
    hideAimLoupe();
    renderAnnotations();
    updateUI();
  }

  // Abort an in-progress EDIT_POLY vertex drag (e.g. a 2nd finger lands -> pinch),
  // restoring the vertex to where it was grabbed.
  function abortVertexDrag() {
    if (state.draggingVertexIdx !== null && state.editingPolyline && state.vertexDragStart && state.editingPolyline.points[state.draggingVertexIdx]) {
      state.editingPolyline.points[state.draggingVertexIdx] = state.vertexDragStart;
    }
    state.draggingVertexIdx = null;
    state.vertexDragStart = null;
    state.vertexDragMoved = false;
    hideAimLoupe();
    state.aimPoint = null;
    state.aimClient = null;
    renderAnnotations();
  }

  function enterAiming(c, opts) {
    state.aiming = true;
    updateAimFromClient(c, { offsetPx: (opts && opts.mouse) ? 0 : AIM_OFFSET_LOGICAL_PX });
    drawAimLoupe();
    renderAnnotations();
    updateUI();
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) { /* haptics optional */ } }
  }

  // Draw the magnifier: sample a small source rect (around the crosshair) from
  // pdfCanvas + annCanvas, magnified into the dedicated #aimLoupe canvas. Source
  // coords MUST come from toCanvas() (device px) to align with the canvas buffers.
  function drawAimLoupe() {
    // Driven explicitly during aiming and during EDIT_POLY vertex drag; callers
    // hide it on release, so gating on aimPoint/aimClient is sufficient.
    if (!aimLoupe || !state.aimPoint || !state.aimClient) return;
    const ratio = dpr();
    const devSize = Math.round(LOUPE_DIAMETER_LOGICAL * ratio);
    if (aimLoupe.width !== devSize) {
      aimLoupe.width = devSize;
      aimLoupe.height = devSize;
      aimLoupe.style.width = LOUPE_DIAMETER_LOGICAL + 'px';
      aimLoupe.style.height = LOUPE_DIAMETER_LOGICAL + 'px';
    }
    const lctx = aimLoupe.getContext('2d');
    lctx.clearRect(0, 0, aimLoupe.width, aimLoupe.height);
    const center = toCanvas(state.aimPoint);     // device px, aligns with pdfCanvas/annCanvas buffers
    const srcSize = devSize / LOUPE_MAGNIFY;
    const sx = center.x - srcSize / 2, sy = center.y - srcSize / 2;
    lctx.imageSmoothingEnabled = true;
    try {
      lctx.drawImage(pdfCanvas, sx, sy, srcSize, srcSize, 0, 0, aimLoupe.width, aimLoupe.height);
      lctx.drawImage(annCanvas, sx, sy, srcSize, srcSize, 0, 0, aimLoupe.width, aimLoupe.height);
    } catch (_) { /* source rect partly off-canvas — drawImage clips */ }
    const cxp = aimLoupe.width / 2, cyp = aimLoupe.height / 2, rr = 14 * ratio;
    lctx.strokeStyle = '#e8c547'; lctx.lineWidth = 1.5 * ratio;
    lctx.beginPath();
    lctx.moveTo(cxp - rr, cyp); lctx.lineTo(cxp + rr, cyp);
    lctx.moveTo(cxp, cyp - rr); lctx.lineTo(cxp, cyp + rr);
    lctx.stroke();
    // Position in logical wrapper px, pinned away from the finger, clamped on-screen.
    const rect = (cWrapper || pdfCanvas).getBoundingClientRect();
    const fingerLx = state.aimClient.x - rect.left, fingerLy = state.aimClient.y - rect.top;
    const size = LOUPE_DIAMETER_LOGICAL, gap = 20;
    let lx = fingerLx - size - gap, ly = fingerLy - size - gap;
    if (lx < 4) lx = fingerLx + gap;
    if (ly < 4) ly = fingerLy + gap;
    lx = Math.max(4, Math.min(rect.width - size - 4, lx));
    ly = Math.max(4, Math.min(rect.height - size - 4, ly));
    aimLoupe.style.transform = 'translate3d(' + lx + 'px,' + ly + 'px,0)';
    aimLoupe.style.display = 'block';
  }

  // SECTION: Zoom transform preview & commit
  let lastRenderedZoom = 1.0;
  let wheelZoomCommitTimer = null;
  let pinchZoomPending = false;
  function commitPinchZoom() {
    if (Math.abs(state.zoom - lastRenderedZoom) > 0.001) {
      lastRenderedZoom = state.zoom;
      renderPdf();
    }
    updateUI();
  }
  function updateContainerTransform() {
    const scale = state.zoom / lastRenderedZoom;
    canvasContainer.style.transform = 'translate3d(' + state.pan.x + 'px, ' + state.pan.y + 'px, 0) scale(' + scale + ')';
  }
  // Light per-frame zoom sync: just the zoom-% readout + the zoom-rail thumb.
  // Used by the wheel/pinch rAF paths and the zoom-rail drag INSTEAD of the full
  // updateUI() — the sidebar lists don't depend on zoom, and rebuilding them on
  // every gesture frame is what made zooming lag on large multi-page projects.
  // The gesture-end commits (commitWheelZoom / commitPinchZoom) still run the
  // full updateUI() once.
  function syncZoomIndicators() {
    const zp = document.getElementById('zoomPct');
    if (zp) zp.textContent = Math.round(state.zoom * 100) + '%';
    if (App.onZoomRailSync) App.onZoomRailSync();
  }
  function commitWheelZoom() {
    if (wheelZoomCommitTimer) clearTimeout(wheelZoomCommitTimer);
    wheelZoomCommitTimer = null;
    if (Math.abs(state.zoom - lastRenderedZoom) > 0.001) {
      lastRenderedZoom = state.zoom;
      renderPdf();
    }
    updateUI();
  }

  // SECTION: Canvas mouse, wheel & touch handlers
  const moveCursorSvg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="24" height="24"><path fill="#000" stroke="#fff" stroke-width="40" d="M342.6 73.4C330.1 60.9 309.8 60.9 297.3 73.4L233.3 137.4C224.1 146.6 221.4 160.3 226.4 172.3C231.4 184.3 243.1 192 256 192L288 192L288 288L192 288L192 256C192 243.1 184.2 231.4 172.2 226.4C160.2 221.4 146.5 224.2 137.3 233.3L73.3 297.3C60.8 309.8 60.8 330.1 73.3 342.6L137.3 406.6C146.5 415.8 160.2 418.5 172.2 413.5C184.2 408.5 192 396.9 192 384L192 352L288 352L288 448L256 448C243.1 448 231.4 455.8 226.4 467.8C221.4 479.8 224.2 493.5 233.3 502.7L297.3 566.7C309.8 579.2 330.1 579.2 342.6 566.7L406.6 502.7C415.8 493.5 418.5 479.8 413.5 467.8C408.5 455.8 396.9 448 384 448L352 448L352 352L448 352L448 384C448 396.9 455.8 408.6 467.8 413.6C479.8 418.6 493.5 415.8 502.7 406.7L566.7 342.7C579.2 330.2 579.2 309.9 566.7 297.4L502.7 233.4C493.5 224.2 479.8 221.5 467.8 226.5C455.8 231.5 448 243.1 448 256L448 288L352 288L352 192L384 192C396.9 192 408.6 184.2 413.6 172.2C418.6 160.2 415.8 146.5 406.7 137.3L342.7 73.3z"/></svg>');

  (cWrapper || pdfCanvas).addEventListener('mousedown', (e) => {
    if (!state.pages.length) return;
    if (e.button === 1) {
      state.isPanning = true;
      state.panStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const pt = canvasPointFromEvent(e);
    state.mousePos = canvasToPdf(pt.x, pt.y);
    const t = hitTest(state.mousePos);
    if (t && t.type === 'legendResize') {
      pushUndoSnapshot();
      state.resizingLegend = true;
      const leg = getActiveAnnotations(state.pages[state.currentPage])?.legend;
      if (leg) state.legendResizeStart = { w: leg.w, h: leg.h, pdfX: state.mousePos.x, pdfY: state.mousePos.y };
    } else if (t && (t.type === 'legendDrag' || t.type === 'legend')) {
      pushUndoSnapshot();
      state.draggingLegend = true;
      const leg = getActiveAnnotations(state.pages[state.currentPage])?.legend;
      if (leg) state.legendDragOffset = { x: state.mousePos.x - leg.x, y: state.mousePos.y - leg.y };
    } else if (t && t.type === 'noteResize') {
      pushUndoSnapshot();
      state.resizingNoteIdx = t.index;
      state.resizingNotePageIdx = state.currentPage;
    } else if (t && t.type === 'noteFontSize') {
      const page = state.pages[state.currentPage];
      const note = page ? getActiveAnnotations(page)?.notes?.[t.index] : null;
      if (note) {
        pushUndoSnapshot();
        state.resizingNoteFontSizeIdx = t.index;
        state.resizingNoteFontSizePageIdx = state.currentPage;
        state.resizingNoteFontSizeStartY = state.mousePos.y;
        const rot = getNoteRotationRad(note, page);
        state.resizingNoteFontSizeStartLocalY = -Math.sin(rot) * (state.mousePos.x - note.x) + Math.cos(rot) * (state.mousePos.y - note.y);
        state.resizingNoteFontSizeStartVal = note.fontSize || 14;
      }
    } else if (t && t.type === 'note') {
      const page = state.pages[state.currentPage];
      const note = page ? getActiveAnnotations(page)?.notes?.[t.index] : null;
      if (note) {
        pushUndoSnapshot();
        state.draggingNoteIdx = t.index;
        state.draggingNotePageIdx = state.currentPage;
        state.draggingNoteOffset = { x: state.mousePos.x - note.x, y: state.mousePos.y - note.y };
        state.dragNoteStartPos = { x: state.mousePos.x, y: state.mousePos.y };
      }
    } else if (state.tool === TOOL.NONE && !state.editingPolyline) {
      state.isPanning = true;
      state.panStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
    } else if (state.tool === TOOL.EDIT_POLY && state.editingPolyline) {
      const pts = state.editingPolyline.points || [];
      const pdfPt = canvasToPdf(pt.x, pt.y);
      const r = 12 / state.zoom;
      state.draggingVertexIdx = pts.findIndex(p => ptDist(pdfPt, p) < r);
    } else if (isAimingTool() && !(state.isViewer && state.tool !== TOOL.MEASURE && state.tool !== TOOL.SCALE)) {
      // Left press-and-hold on a placement tool summons the aim loupe (desktop parity
      // with mobile). A quick click (release before AIM_PRESS_MS) still places instantly.
      const c = { x: e.clientX, y: e.clientY };
      state.aimMouseDownClient = c;
      state.aimPressTimer = setTimeout(() => { state.aimPressTimer = null; enterAiming(c, { mouse: true }); }, AIM_PRESS_MS);
    }
  });

  function handleCanvasMouseMove(e) {
    const pt = canvasPointFromEvent(e);
    const pdf = canvasToPdf(pt.x, pt.y);
    state.mousePos = pdf;
    if (state.aiming) {
      const c = { x: e.clientX, y: e.clientY };
      updateAimFromClient(c);   // reuses the stored offset (0 for mouse)
      if (!state.aimRafPending) {
        state.aimRafPending = true;
        requestAnimationFrame(() => { state.aimRafPending = false; drawAimLoupe(); renderAnnotations(); });
      }
      return;
    }
    if (state.aimPressTimer && state.aimMouseDownClient && ptDist({ x: e.clientX, y: e.clientY }, state.aimMouseDownClient) > 6) {
      clearTimeout(state.aimPressTimer); state.aimPressTimer = null;   // moved before the hold fired
    }
    if (state.isPanning && state.panStart) {
      state.pan = { x: e.clientX - state.panStart.x, y: e.clientY - state.panStart.y };
      updateContainerTransform();
    } else if (state.resizingLegend && state.legendResizeStart) {
      const page = state.pages[state.currentPage];
      const leg = page ? getActiveAnnotations(page)?.legend : null;
      if (leg) {
        leg.userResized = true;
        leg.w = Math.max(60, state.legendResizeStart.w + (pdf.x - state.legendResizeStart.pdfX));
        leg.h = Math.max(40, state.legendResizeStart.h + (pdf.y - state.legendResizeStart.pdfY));
        renderAnnotations();
      }
    } else if (state.draggingLegend && state.legendDragOffset) {
      const page = state.pages[state.currentPage];
      const leg = page ? getActiveAnnotations(page)?.legend : null;
      if (leg && page?.pdfPage) {
        const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
        const pageW = vp.width, pageH = vp.height;
        leg.x = Math.max(0, Math.min(pageW - leg.w, pdf.x - state.legendDragOffset.x));
        leg.y = Math.max(0, Math.min(pageH - leg.h, pdf.y - state.legendDragOffset.y));
        renderAnnotations();
      }
    } else if (state.tool === TOOL.EDIT_POLY && state.draggingVertexIdx !== null && state.editingPolyline) {
      state.editingPolyline.points[state.draggingVertexIdx] = pdf;
      renderAnnotations();
    } else if (state.resizingNoteIdx !== null && state.resizingNotePageIdx !== null) {
      const page = state.pages[state.resizingNotePageIdx];
      const note = page ? getActiveAnnotations(page)?.notes?.[state.resizingNoteIdx] : null;
      if (note) {
        const rot = getNoteRotationRad(note, page);
        const localX = Math.cos(rot) * (pdf.x - note.x) + Math.sin(rot) * (pdf.y - note.y);
        note.width = Math.max(50, Math.min(400, localX));
        renderAnnotations();
      }
    } else if (state.resizingNoteFontSizeIdx !== null && state.resizingNoteFontSizePageIdx !== null && state.resizingNoteFontSizeStartLocalY != null && state.resizingNoteFontSizeStartVal != null) {
      const page = state.pages[state.resizingNoteFontSizePageIdx];
      const note = page ? getActiveAnnotations(page)?.notes?.[state.resizingNoteFontSizeIdx] : null;
      if (note) {
        const rot = getNoteRotationRad(note, page);
        const currentLocalY = -Math.sin(rot) * (pdf.x - note.x) + Math.cos(rot) * (pdf.y - note.y);
        const dy = state.resizingNoteFontSizeStartLocalY - currentLocalY;
        note.fontSize = Math.round(Math.max(8, Math.min(48, state.resizingNoteFontSizeStartVal + dy / 3)));
        renderAnnotations();
      }
    } else if (state.draggingNoteIdx !== null && state.draggingNotePageIdx !== null && state.draggingNoteOffset) {
      const page = state.pages[state.draggingNotePageIdx];
      const note = page ? getActiveAnnotations(page)?.notes?.[state.draggingNoteIdx] : null;
      if (note) {
        note.x = pdf.x - state.draggingNoteOffset.x;
        note.y = pdf.y - state.draggingNoteOffset.y;
        renderAnnotations();
      }
    } else if ((state.tool === TOOL.LINE && state.quickLineStart) || (state.tool === TOOL.POLYLINE && state.drawingPolyline && state.drawingPolyline.points.length >= 1) || (state.tool === TOOL.HIGHLIGHT && state.highlightStart) || (state.tool === TOOL.MULTIPLY_ZONE && state.multiplyZoneStart) || (state.tool === TOOL.SCALE_ZONE && state.scaleZoneStart) || (state.tool === TOOL.ROOM && state.roomBoxStart) || (state.tool === TOOL.DELETE_ZONE && state.deleteZoneStart)) {
      renderAnnotations();
    }
    const t = hitTest(pdf);
    state.hoverLegendResize = !!(t && t.type === 'legendResize');
    if (annCanvas) {
      if (state.isPanning && state.panStart) {
        annCanvas.style.cursor = 'url(' + moveCursorSvg + ') 12 12, move';
      } else {
        const overUi = t && (t.type === 'legendResize' || t.type === 'legendDrag' || t.type === 'legend' || t.type === 'noteResize' || t.type === 'noteFontSize' || t.type === 'note');
        annCanvas.style.cursor = (t && t.type === 'legendResize') ? 'se-resize' : (t && (t.type === 'legendDrag' || t.type === 'legend')) ? 'move' : (t && t.type === 'noteResize') ? 'ew-resize' : (t && t.type === 'noteFontSize') ? 'ns-resize' : (t && t.type === 'note') ? 'move' : (!overUi && isAimingTool()) ? 'crosshair' : '';
      }
    }
    updateStatus();
  }
  (cWrapper || pdfCanvas).addEventListener('mousemove', handleCanvasMouseMove);
  window.addEventListener('mousemove', (e) => {
    if (state.resizingLegend || state.draggingLegend) handleCanvasMouseMove(e);
  });

  (cWrapper || pdfCanvas).addEventListener('mouseup', (e) => {
    if (e.button === 1) {
      state.isPanning = false;
      state.panStart = null;
      return;
    }
    if (e.button !== 0) return;
    if (state.aiming) {
      // Release to commit at the crosshair; hide the loupe FIRST so any modal opens
      // cleanly, then suppress the trailing native click.
      const committed = state.aimPoint;
      cancelAiming();
      if (committed) commitAimPoint(committed);
      state.justFinishedLoupe = true;
      state.aimMouseDownClient = null;
      return;
    }
    if (state.aimPressTimer) {
      // Released before the hold fired -> quick click = instant placement: clear the
      // timer and let the native click reach handleCanvasClick (no suppression).
      clearTimeout(state.aimPressTimer); state.aimPressTimer = null;
      state.aimMouseDownClient = null;
    }
    if (state.resizingNoteIdx !== null || state.resizingNoteFontSizeIdx !== null) { state.justFinishedResize = true; markProjectDirty(); }
    if (state.draggingNoteIdx !== null && state.dragNoteStartPos && ptDist(state.mousePos, state.dragNoteStartPos) > 3) { state.justFinishedDragNote = true; markProjectDirty(); }
    if (state.resizingLegend || state.draggingLegend) { state.justFinishedLegendResize = true; markProjectDirty(); }
    state.isPanning = false;
    state.panStart = null;
    state.draggingVertexIdx = null;
    state.resizingNoteIdx = null;
    state.resizingNotePageIdx = null;
    state.resizingNoteFontSizeIdx = null;
    state.resizingNoteFontSizePageIdx = null;
    state.resizingNoteFontSizeStartY = null;
    state.resizingNoteFontSizeStartLocalY = null;
    state.resizingNoteFontSizeStartVal = null;
    state.draggingNoteIdx = null;
    state.draggingNotePageIdx = null;
    state.draggingNoteOffset = null;
    state.dragNoteStartPos = null;
    state.resizingLegend = false;
    state.draggingLegend = false;
    state.legendResizeStart = null;
    state.legendDragOffset = null;
  });

  (cWrapper || pdfCanvas).addEventListener('mouseleave', () => {
    if (state.aiming || state.aimPressTimer) cancelAiming();
    state.aimMouseDownClient = null;
    state.isPanning = false;
    state.panStart = null;
    state.resizingNoteIdx = null;
    state.resizingNotePageIdx = null;
    state.resizingNoteFontSizeIdx = null;
    state.resizingNoteFontSizePageIdx = null;
    state.resizingNoteFontSizeStartY = null;
    state.resizingNoteFontSizeStartLocalY = null;
    state.resizingNoteFontSizeStartVal = null;
    state.draggingNoteIdx = null;
    state.draggingNotePageIdx = null;
    state.draggingNoteOffset = null;
    state.dragNoteStartPos = null;
    if (!state.resizingLegend && !state.draggingLegend) {
      state.resizingLegend = false;
      state.draggingLegend = false;
      state.legendResizeStart = null;
      state.legendDragOffset = null;
      state.hoverLegendResize = false;
      if (annCanvas) annCanvas.style.cursor = '';
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 1) {
      state.isPanning = false;
      state.panStart = null;
    }
    if (e.button === 0 && (state.resizingLegend || state.draggingLegend)) {
      state.justFinishedLegendResize = true;
      markProjectDirty();
      state.resizingLegend = false;
      state.draggingLegend = false;
      state.legendResizeStart = null;
      state.legendDragOffset = null;
      state.hoverLegendResize = false;
      if (annCanvas) annCanvas.style.cursor = '';
    }
  });

  (cWrapper || pdfCanvas).addEventListener('click', (e) => {
    if (state.isPanning || state.justFinishedResize || state.justFinishedDragNote || state.justFinishedLegendResize || state.justFinishedLoupe) { state.justFinishedResize = false; state.justFinishedDragNote = false; state.justFinishedLegendResize = false; state.justFinishedLoupe = false; return; }
    state.justFinishedResize = false;
    state.justFinishedDragNote = false;
    state.justFinishedLegendResize = false;
    state.justFinishedLoupe = false;
    handleCanvasClick(e);
  });

  (cWrapper || pdfCanvas).addEventListener('dblclick', (e) => handleCanvasDblClick(e));
  (cWrapper || pdfCanvas).addEventListener('contextmenu', (e) => handleContextMenu(e));

  let wheelZoomPending = false;
  let wheelZoomAccum = 0;
  let wheelZoomCursor = null;
  (cWrapper || pdfCanvas).addEventListener('wheel', (e) => {
    e.preventDefault();
    let delta = -e.deltaY;
    if (e.deltaMode === 1) delta *= 24;
    else if (e.deltaMode === 2) delta *= 240;
    wheelZoomAccum += delta;
    wheelZoomCursor = canvasPointFromEvent(e);
    if (!wheelZoomPending) {
      wheelZoomPending = true;
      requestAnimationFrame(() => {
        wheelZoomPending = false;
        const delta = wheelZoomAccum;
        wheelZoomAccum = 0;
        if (delta === 0 || !wheelZoomCursor) return;
        const factor = 1 - delta * 0.001 * getWheelZoomSpeed();
        const newZoom = Math.max(0.2, Math.min(getMaxZoom(), state.zoom * factor));
        if (newZoom === state.zoom) return;
        const pt = wheelZoomCursor;
        const pdfX = (pt.x - state.pan.x) / state.zoom;
        const pdfY = (pt.y - state.pan.y) / state.zoom;
        state.pan.x = pt.x - pdfX * newZoom;
        state.pan.y = pt.y - pdfY * newZoom;
        state.zoom = newZoom;
        updateContainerTransform();
        syncZoomIndicators();   // full updateUI() waits for commitWheelZoom — see syncZoomIndicators
        if (wheelZoomCommitTimer) clearTimeout(wheelZoomCommitTimer);
        wheelZoomCommitTimer = setTimeout(commitWheelZoom, 150);
      });
    }
  }, { passive: false });

  (cWrapper || pdfCanvas).addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      if (state.aiming || state.aimPressTimer) cancelAiming();
      if (state.draggingVertexIdx !== null) abortVertexDrag();   // 2nd finger -> pinch, not drag
      state.pinchStartDistance = ptDist({ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY });
      state.pinchStartZoom = state.zoom;
    } else if (e.touches.length === 1) {
      const c = getClientCoords(e);
      state.touchPanStart = { x: c.x, y: c.y, panX: state.pan.x, panY: state.pan.y };
      state.longPressStart = c;
      if (isAimingTool()) {
        // Press-and-hold summons the aim loupe; suppress the context-menu long-press.
        state.aimPressTimer = setTimeout(() => { state.aimPressTimer = null; enterAiming(c); }, AIM_PRESS_MS);
      } else {
        // EDIT_POLY: grab a vertex under the finger for touch dragging (mouse parity).
        if (state.tool === TOOL.EDIT_POLY && state.editingPolyline) {
          const pt = canvasPointFromEvent(e);
          const pdfPt = canvasToPdf(pt.x, pt.y);
          const r = 16 / state.zoom;   // a touch fatter than the mouse hit radius (12)
          const idx = (state.editingPolyline.points || []).findIndex(p => ptDist(pdfPt, p) < r);
          if (idx >= 0) {
            state.draggingVertexIdx = idx;
            state.vertexDragStart = { x: state.editingPolyline.points[idx].x, y: state.editingPolyline.points[idx].y };
            state.vertexDragMoved = false;
          }
        }
        // Keep the 500ms long-press (context menu / delete-vertex) available.
        state.longPressTimer = setTimeout(() => {
          state.longPressFired = true;
          const ev = new MouseEvent('contextmenu', { clientX: c.x, clientY: c.y, bubbles: true });
          (cWrapper || pdfCanvas).dispatchEvent(ev);
        }, 500);
      }
    }
  }, { passive: true });

  (cWrapper || pdfCanvas).addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && state.pinchStartDistance) {
      e.preventDefault();
      const d = ptDist({ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY });
      const scale = d / state.pinchStartDistance;
      const newZoom = Math.max(0.2, Math.min(getMaxZoom(), state.pinchStartZoom * scale));
      const rect = (document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper'))?.getBoundingClientRect() || { left: 0, top: 0 };
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const pdfX = (cx - state.pan.x) / state.zoom;
      const pdfY = (cy - state.pan.y) / state.zoom;
      state.pan.x = cx - pdfX * newZoom;
      state.pan.y = cy - pdfY * newZoom;
      state.zoom = newZoom;
      if (!pinchZoomPending) {
        pinchZoomPending = true;
        requestAnimationFrame(() => {
          pinchZoomPending = false;
          updateContainerTransform();
          syncZoomIndicators();
        });
      }
    } else if (e.touches.length === 1 && state.touchPanStart) {
      const c = getClientCoords(e);
      if (state.aiming) {
        e.preventDefault();
        updateAimFromClient(c);
        if (!state.aimRafPending) {
          state.aimRafPending = true;
          requestAnimationFrame(() => { state.aimRafPending = false; drawAimLoupe(); renderAnnotations(); });
        }
        return;
      }
      // EDIT_POLY: drag the grabbed vertex (with the loupe), touch parity with mouse.
      // Skip if a long-press already fired a delete (draggingVertexIdx would be stale).
      if (state.tool === TOOL.EDIT_POLY && state.draggingVertexIdx !== null && state.editingPolyline &&
          !state.longPressFired && state.draggingVertexIdx < (state.editingPolyline.points || []).length) {
        e.preventDefault();
        if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = null; }  // a drag, not a delete-hold
        state.vertexDragMoved = true;
        const pt = canvasPointFromEvent(e);
        const pdf = canvasToPdf(pt.x, pt.y);
        state.editingPolyline.points[state.draggingVertexIdx] = pdf;   // no snap/bounds, matching mouse
        state.aimPoint = pdf;     // loupe reveals the vertex under the finger
        state.aimClient = c;
        if (!state.aimRafPending) {
          state.aimRafPending = true;
          requestAnimationFrame(() => { state.aimRafPending = false; drawAimLoupe(); renderAnnotations(); });
        }
        return;
      }
      const moved = ptDist(state.touchPanStart, c) > 10;
      // A drag before the hold fires cancels precision mode (so a quick tap still places).
      if (state.aimPressTimer && moved) { clearTimeout(state.aimPressTimer); state.aimPressTimer = null; }
      if (((state.tool === TOOL.LINE && state.quickLineStart) || (state.tool === TOOL.HIGHLIGHT && state.highlightStart) || (state.tool === TOOL.MULTIPLY_ZONE && state.multiplyZoneStart) || (state.tool === TOOL.SCALE_ZONE && state.scaleZoneStart) || (state.tool === TOOL.ROOM && state.roomBoxStart)) && moved) {
        if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = null; }
        const pt = canvasPointFromEvent(e);
        const pdf = canvasToPdf(pt.x, pt.y);
        state.mousePos = pdf;
        renderAnnotations();
        e.preventDefault();
      } else if (moved && state.tool === TOOL.NONE && !state.editingPolyline) {
        if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = null; }
        state.touchPanning = true;
        e.preventDefault();
        state.pan = { x: state.touchPanStart.panX + (c.x - state.touchPanStart.x), y: state.touchPanStart.panY + (c.y - state.touchPanStart.y) };
        updateContainerTransform();
      } else if (moved && state.longPressTimer && state.longPressStart) {
        const tapCancelThreshold = (state.tool === TOOL.LINE) || (state.tool === TOOL.POLYLINE && state.drawingPolyline) || (state.tool === TOOL.HIGHLIGHT && state.highlightStart) || (state.tool === TOOL.MULTIPLY_ZONE && state.multiplyZoneStart) || (state.tool === TOOL.SCALE_ZONE && state.scaleZoneStart) || (state.tool === TOOL.ROOM && state.roomBoxStart) || (state.tool === TOOL.DELETE_ZONE && state.deleteZoneStart) ? 25 : 10;
        if (ptDist(state.longPressStart, c) > tapCancelThreshold) { clearTimeout(state.longPressTimer); state.longPressTimer = null; }
      }
    }
  }, { passive: false });

  function handleTouchAsCanvasTap(clientX, clientY) {
    if (!state.pages.length) return;
    const rect = (document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper'))?.getBoundingClientRect();
    if (!rect) return;
    const pt = { x: clientX - rect.left, y: clientY - rect.top };
    const pdf = canvasToPdf(pt.x, pt.y);
    state.mousePos = pdf;
    if (state.tool === TOOL.LINE) {
      commitLinePoint(pdf);
      renderAnnotations();
      updateUI();
      return;
    }
    if (state.tool === TOOL.HIGHLIGHT) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const page = state.pages[state.currentPage];
      if (!state.highlightStart) {
        state.highlightStart = pdf;
      } else {
        const canvas = page && ensureActiveCanvas(page);
        if (canvas) {
          pushUndoSnapshot();
          if (!canvas.annotations.highlights) canvas.annotations.highlights = [];
          const x1 = state.highlightStart.x, y1 = state.highlightStart.y, x2 = pdf.x, y2 = pdf.y;
          canvas.annotations.highlights.push({ x1, y1, x2, y2, color: '#e8c547', opacity: 0.25, id: uid() });
          markProjectDirty();
        }
        state.highlightStart = null;
      }
      renderAnnotations();
      updateUI();
      return;
    }
    if (state.tool === TOOL.MULTIPLY_ZONE) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const page = state.pages[state.currentPage];
      if (!state.multiplyZoneStart) {
        state.multiplyZoneStart = pdf;
      } else {
        const canvas = page && ensureActiveCanvas(page);
        if (canvas) {
          const x1 = Math.min(state.multiplyZoneStart.x, pdf.x), x2 = Math.max(state.multiplyZoneStart.x, pdf.x);
          const y1 = Math.min(state.multiplyZoneStart.y, pdf.y), y2 = Math.max(state.multiplyZoneStart.y, pdf.y);
          const zones = canvas.annotations.multiplyZones || [];
          const overlaps = zones.some(z => rectsOverlap(x1, y1, x2, y2, z.x1, z.y1, z.x2, z.y2));
          if (overlaps) {
            showToast('Cannot place multiply zone:\nIt overlaps an existing zone.\nItems cannot be multiplied more than once.', 4000);
            state.multiplyZoneStart = null;
          } else {
            const counts = countItemsInRect(canvas.annotations, state.currentPage, x1, y1, x2, y2);
            const lenStr = formatFeet(counts.lengthRealSum, page?.scale);
            state.pendingMultiplyZone = { x1, y1, x2, y2 };
            state.pendingMultiplyZoneValue = state.multiplyZoneSettings?.defaultMultiplier ?? 2;
            const mzTitleElTouch = document.querySelector('#multiplyZoneModal h2');
            if (mzTitleElTouch) mzTitleElTouch.textContent = 'Multiply Zone';
            document.getElementById('multiplyZonePreview').textContent = 'In this area: ' + counts.counterCount + ' counter(s), ' + counts.lineRunCount + ' line run(s) (' + lenStr + ')';
            document.getElementById('multiplyZoneMultiplier').value = String(state.pendingMultiplyZoneValue);
            showModal('multiplyZoneModal');
          }
        }
        state.multiplyZoneStart = null;
      }
      renderAnnotations();
      updateUI();
      return;
    }
    if (state.tool === TOOL.ROOM) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      if (!getPageScale(state.currentPage)) { showSetScaleFirstToast('Room Sizer'); return; }
      if (!state.roomBoxStart) {
        state.roomBoxStart = pdf;
      } else {
        const x1 = Math.min(state.roomBoxStart.x, pdf.x), x2 = Math.max(state.roomBoxStart.x, pdf.x);
        const y1 = Math.min(state.roomBoxStart.y, pdf.y), y2 = Math.max(state.roomBoxStart.y, pdf.y);
        state.roomBoxStart = null;
        App.openRoomBoxModal({ x1, y1, x2, y2 });
      }
      renderAnnotations();
      updateUI();
      return;
    }
    if (state.tool === TOOL.SCALE_ZONE) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      if (!getPageScale(state.currentPage)) {
        showSetScaleFirstToast('Scale Zone');
        return;
      }
      const page = state.pages[state.currentPage];
      if (!state.scaleZoneStart) {
        state.scaleZoneStart = pdf;
      } else {
        const canvas = page && ensureActiveCanvas(page);
        if (canvas) {
          const x1 = Math.min(state.scaleZoneStart.x, pdf.x), x2 = Math.max(state.scaleZoneStart.x, pdf.x);
          const y1 = Math.min(state.scaleZoneStart.y, pdf.y), y2 = Math.max(state.scaleZoneStart.y, pdf.y);
          const szones = canvas.annotations.scaleZones || [];
          const overlaps = szones.some(z => rectsOverlap(x1, y1, x2, y2, z.x1, z.y1, z.x2, z.y2));
          if (overlaps) {
            showToast('Cannot place scale zone:\nit overlaps an existing scale zone.', 4000);
            state.scaleZoneStart = null;
          } else {
            state.scaleModalApplyTarget = 'zone';
            state.pendingScaleZone = { x1, y1, x2, y2 };
            state.pendingScaleZoneEdit = null;
            const h2t = document.querySelector('#scaleModal h2');
            if (h2t) h2t.textContent = 'Scale for zone';
            App.openScaleModal();
          }
        }
        state.scaleZoneStart = null;
      }
      renderAnnotations();
      updateUI();
      return;
    }
    if (state.tool === TOOL.DELETE_ZONE) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const page = state.pages[state.currentPage];
      if (!state.deleteZoneStart) {
        state.deleteZoneStart = pdf;
      } else {
        const canvas = page && ensureActiveCanvas(page);
        const ann = canvas?.annotations;
        if (ann) {
          const x1 = Math.min(state.deleteZoneStart.x, pdf.x), x2 = Math.max(state.deleteZoneStart.x, pdf.x);
          const y1 = Math.min(state.deleteZoneStart.y, pdf.y), y2 = Math.max(state.deleteZoneStart.y, pdf.y);
          const collected = collectItemsToDeleteInRect(ann, state.currentPage, x1, y1, x2, y2);
          const total = collected.counterCount + collected.lineRunCount + collected.highlightCount + collected.noteCount + collected.multiplyZoneCount + collected.scaleZoneCount + collected.roomBoxCount;
          if (total === 0) {
            showToast('No items in this area.', 2000);
          } else {
            const lenStr = formatFeet(collected.lengthRealSum, page?.scale);
            const parts = [];
            if (collected.counterCount) parts.push(collected.counterCount + ' counter(s)');
            if (collected.lineRunCount) parts.push(collected.lineRunCount + ' line run(s) (' + lenStr + ')');
            if (collected.highlightCount) parts.push(collected.highlightCount + ' highlight(s)');
            if (collected.noteCount) parts.push(collected.noteCount + ' note(s)');
            if (collected.multiplyZoneCount) parts.push(collected.multiplyZoneCount + ' multiply zone(s)');
            if (collected.scaleZoneCount) parts.push(collected.scaleZoneCount + ' scale zone(s)');
            if (collected.roomBoxCount) parts.push(collected.roomBoxCount + ' room box(es)');
            state.pendingDeleteZone = { ann, collected };
            document.getElementById('deleteZonePreview').textContent = 'In this area: ' + parts.join(', ');
            showModal('deleteZoneModal');
          }
        }
        state.deleteZoneStart = null;
      }
      renderAnnotations();
      updateUI();
      return;
    }
    if (state.tool === TOOL.NOTE) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      App.openNoteModal('add', '', { x: pdf.x, y: pdf.y });
      updateUI();
      return;
    }
    const ev = new MouseEvent('click', { clientX, clientY, bubbles: true });
    (cWrapper || pdfCanvas).dispatchEvent(ev);
  }

  (cWrapper || pdfCanvas).addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      if (state.pinchStartDistance != null) commitPinchZoom();
      state.pinchStartDistance = null;
    }
    if (state.tool === TOOL.EDIT_POLY && state.draggingVertexIdx !== null) {
      // Release a dragged polyline vertex. (A long-press delete is handled by the
      // context-menu path; here we just finalize the drag.)
      e.preventDefault();
      if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = null; }
      if (state.vertexDragMoved) markProjectDirty();
      state.draggingVertexIdx = null;
      state.vertexDragStart = null;
      state.vertexDragMoved = false;
      state.longPressFired = false;
      hideAimLoupe();
      state.aimPoint = null;
      state.aimClient = null;
      renderAnnotations();
      state.touchPanStart = null;
      return;
    }
    if (state.aiming) {
      // Lift to commit the point at the crosshair (not the raw fingertip).
      e.preventDefault();
      const committed = state.aimPoint;
      cancelAiming();
      if (committed) commitAimPoint(committed);
      state.touchPanStart = null;
      return;
    }
    if (state.aimPressTimer) {
      // Released before the hold fired -> quick tap = instant placement, as today.
      clearTimeout(state.aimPressTimer);
      state.aimPressTimer = null;
      if (e.changedTouches && e.changedTouches.length) {
        e.preventDefault();
        const c = getClientCoords(e);
        const ev = new MouseEvent('click', { clientX: c.x, clientY: c.y, bubbles: true });
        (cWrapper || pdfCanvas).dispatchEvent(ev);
      }
      state.touchPanStart = null;
      return;
    }
    if (state.touchPanning) {
      state.touchPanning = false;
      state.touchPanStart = null;
      return;
    }
    if (e.changedTouches && e.changedTouches.length && state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
      if (!state.longPressFired) {
        e.preventDefault();
        const c = getClientCoords(e);
        if (state.tool === TOOL.LINE || state.tool === TOOL.HIGHLIGHT || state.tool === TOOL.MULTIPLY_ZONE || state.tool === TOOL.SCALE_ZONE || state.tool === TOOL.ROOM || state.tool === TOOL.NOTE) {
          handleTouchAsCanvasTap(c.x, c.y);
        } else {
          const ev = new MouseEvent('click', { clientX: c.x, clientY: c.y, bubbles: true });
          (cWrapper || pdfCanvas).dispatchEvent(ev);
        }
      }
      state.longPressFired = false;
    }
    state.touchPanStart = null;
  }, { passive: false });

  (cWrapper || pdfCanvas).addEventListener('touchcancel', () => {
    if (state.aiming || state.aimPressTimer) cancelAiming();
    if (state.draggingVertexIdx !== null) abortVertexDrag();
    if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = null; }
    state.touchPanStart = null;
    state.touchPanning = false;
  }, { passive: true });

  // SECTION: Global dropdown dismissal & keyboard hotkeys
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu') && !e.target.closest('#contextMenu')) document.getElementById('contextMenu').classList.remove('visible');
    const cm = document.getElementById('canvasMenu');
    if (cm && !e.target.closest('#canvasMenu') && !e.target.closest('#canvasLayersBtn')) cm.classList.remove('visible');
    const dpm = document.getElementById('downloadCurrentPageMenu');
    if (dpm && !e.target.closest('#downloadCurrentPageDropdown')) dpm.classList.remove('visible');
    const edm = document.getElementById('exportDropdownMenu');
    if (edm && !e.target.closest('#exportDropdown')) edm.classList.remove('visible');
    const srm = document.getElementById('showReportMenu');
    const srd = document.getElementById('showReportDropdown');
    if (srm && !e.target.closest('#showReportDropdown') && !e.target.closest('.show-report-menu')) {
      srm.classList.remove('visible');
      if (srd && srm.parentElement !== srd) srd.appendChild(srm);
    }
    const ptm = document.getElementById('forPipeToolingMenu');
    const ptd = document.getElementById('forPipeToolingDropdown');
    if (ptm && !e.target.closest('#forPipeToolingDropdown') && !e.target.closest('.show-report-menu')) {
      ptm.classList.remove('visible');
      if (ptd && ptm.parentElement !== ptd) ptd.appendChild(ptm);
    }
    const csm = document.getElementById('copySummaryTextMenu');
    const csd = document.getElementById('copySummaryTextDropdown');
    if (csm && !e.target.closest('#copySummaryTextDropdown') && !e.target.closest('.show-report-menu')) {
      csm.classList.remove('visible');
      if (csd && csm.parentElement !== csd) csd.appendChild(csm);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
      if (document.getElementById('counterModal').classList.contains('visible')) {
        App.showCounterTab('quickcount');
        e.preventDefault();
        return;
      }
      if (document.getElementById('chooseLineTypeModal').classList.contains('visible')) {
        App.showLineTypeTab('quick');
        e.preventDefault();
        return;
      }
    }
    if (e.target.matches('input, textarea, [contenteditable="true"]') && e.key !== 'Escape') return;
    if (e.key === ' ') {
      if (!e.target.closest('button') && window.matchMedia('(min-width: 769px)').matches) {
        document.body.classList.toggle('sidebar-collapsed');
        e.preventDefault();
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === 'z') {
        if (e.shiftKey) { redo(); e.preventDefault(); }
        else { undo(); e.preventDefault(); }
        return;
      }
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (k === 'm') { state.tool = TOOL.NONE; state.quickLineStart = null; state.highlightStart = null; state.multiplyZoneStart = null; state.scaleZoneStart = null; state.deleteZoneStart = null; state.pendingNote = null; state.editingNote = null; if (state.drawingPolyline) state.drawingPolyline = null; updateUI(); e.preventDefault(); }
      else if (k === 'd') { document.getElementById('measureBtn').click(); e.preventDefault(); }
      else if (k === 'r') { rotatePage90(); e.preventDefault(); }
      else if (k === 'j') {
        state.lineTypeSettings.snapToHorizontalVertical = !state.lineTypeSettings.snapToHorizontalVertical;
        const cb = document.getElementById('lineTypeSnapToHV');
        const snapBtn = document.getElementById('lineTypeSnapToHVBtn');
        const snapHeaderEl = document.getElementById('lineTypeSnapToHVHeaderBtn');
        if (cb) { cb.checked = !!state.lineTypeSettings.snapToHorizontalVertical; }
        if (snapBtn) snapBtn.setAttribute('aria-pressed', !!state.lineTypeSettings.snapToHorizontalVertical);
        if (snapHeaderEl) snapHeaderEl.setAttribute('aria-pressed', !!state.lineTypeSettings.snapToHorizontalVertical);
        renderAnnotations();
        updateUI();
        e.preventDefault();
      }
      // S works for viewers too - they may set a temporary local scale to measure.
      else if (k === 's') { document.getElementById('setScale').click(); e.preventDefault(); }
      else if (!state.isViewer) {
        if (k === 'c') { document.getElementById('counterBtn').click(); e.preventDefault(); }
        else if (k === 'l') { document.getElementById('quickLine').click(); e.preventDefault(); }
        else if (k === 'p') { document.getElementById('polylineBtn').click(); e.preventDefault(); }
        else if (k === 'h') { document.getElementById('highlightBtn').click(); e.preventDefault(); }
        else if (k === 'x') { document.getElementById('multiplyZoneBtn').click(); e.preventDefault(); }
        else if (k === 'v') { document.getElementById('roomBtn').click(); e.preventDefault(); }
        else if (k === 'n') { document.getElementById('noteBtn').click(); e.preventDefault(); }
      }
    }
    if (e.key === 'Escape') {
      if (state.gridOriginPickMode) {
        state.gridOriginPickMode = false;
        showModal('gridSettingsModal');
        updateUI();
        return;
      }
      if (document.getElementById('setScaleFirstModal').classList.contains('visible')) {
        hideModal('setScaleFirstModal');
        if (setScaleFirstToastTimer) { clearTimeout(setScaleFirstToastTimer); setScaleFirstToastTimer = null; }
      } else if (document.getElementById('outOfBoundsModal').classList.contains('visible')) {
        hideModal('outOfBoundsModal');
        if (outOfBoundsToastTimer) { clearTimeout(outOfBoundsToastTimer); outOfBoundsToastTimer = null; }
      } else if (document.getElementById('chooseLineTypeModal').classList.contains('visible')) {
        hideModal('chooseLineTypeModal');
      } else if (document.getElementById('scaleModal').classList.contains('visible')) {
        if (state.tool === TOOL.SCALE) { state.tool = TOOL.NONE; state.scaleMode = SCALE_MODES.NONE; state.scalePointA = null; state.scalePointB = null; }
        App.resetScaleModalZoneMode();
        App.resetScaleCheckMode && App.resetScaleCheckMode();
        hideModal('scaleModal');
        updateUI();
      } else if (document.getElementById('counterModal').classList.contains('visible')) {
        hideModal('counterModal');
      } else if (document.getElementById('lineColorModal').classList.contains('visible')) { state.pendingLineColorApply = null; hideModal('lineColorModal'); }
      else if (document.getElementById('gridSettingsModal').classList.contains('visible')) { hideModal('gridSettingsModal'); }
      else if (document.getElementById('specificPagesModal').classList.contains('visible')) { hideModal('specificPagesModal'); }
      else if (document.getElementById('pipeToolingCopiedModal').classList.contains('visible')) { hideModal('pipeToolingCopiedModal'); }
      else if (document.getElementById('noteModal').classList.contains('visible')) { hideModal('noteModal'); state.pendingNote = null; state.editingNote = null; state.pendingNoteColor = null; }
      else if (document.getElementById('multiplyZoneModal').classList.contains('visible')) { hideModal('multiplyZoneModal'); state.pendingMultiplyZone = null; state.pendingMultiplyZoneEdit = null; }
      else if (document.getElementById('deleteZoneModal').classList.contains('visible')) { hideModal('deleteZoneModal'); state.pendingDeleteZone = null; }
      else if (document.getElementById('roomBoxModal')?.classList.contains('visible')) { hideModal('roomBoxModal'); state.pendingRoomBox = null; state.pendingRoomBoxEdit = null; }
      else if (document.getElementById('roomEditModal')?.classList.contains('visible')) { hideModal('roomEditModal'); }
      else if (document.getElementById('roomDeleteConfirmModal')?.classList.contains('visible')) { hideModal('roomDeleteConfirmModal'); }
      else if (document.getElementById('multiplyZoneSettingsModal').classList.contains('visible')) { hideModal('multiplyZoneSettingsModal'); }
      else if (document.getElementById('linePropertiesModal').classList.contains('visible')) { App.closeLinePropertiesModal(); }
      else if (document.getElementById('airboardToastModal').classList.contains('visible')) { hideModal('airboardToastModal'); if (airboardToastTimer) { clearTimeout(airboardToastTimer); airboardToastTimer = null; } }
      else if (document.getElementById('macrosModal').classList.contains('visible')) { hideModal('macrosModal'); }
      else if (document.getElementById('pageSettingsModal').classList.contains('visible')) { hideModal('pageSettingsModal'); }
      else if (document.getElementById('clearPageConfirmModal').classList.contains('visible')) { hideModal('clearPageConfirmModal'); }
      else if (document.getElementById('deletePageConfirmModal').classList.contains('visible')) { hideModal('deletePageConfirmModal'); state.pendingDeletePage = null; }
      else if (document.getElementById('settingsAdvancedModal').classList.contains('visible')) { hideModal('settingsAdvancedModal'); }
      else if (document.getElementById('settingsModal').classList.contains('visible')) { hideModal('settingsModal'); }
      else if (document.getElementById('mySettingsModal').classList.contains('visible')) { hideModal('mySettingsModal'); }
      else if (document.getElementById('authModal').classList.contains('visible')) { hideModal('authModal'); }
      else if (document.getElementById('adminPanelModal').classList.contains('visible')) { hideModal('adminPanelModal'); }
      else if (document.getElementById('manageUserModal').classList.contains('visible')) { hideModal('manageUserModal'); }
      else if (document.getElementById('allUsersModal').classList.contains('visible')) { hideModal('allUsersModal'); }
      else if (document.getElementById('userActivityModal').classList.contains('visible')) { hideModal('userActivityModal'); }
      else if (document.getElementById('manageProjectsModal').classList.contains('visible')) { hideModal('manageProjectsModal'); }
      else if (document.getElementById('manageIconsModal').classList.contains('visible')) { hideModal('manageIconsModal'); }
      else if (document.getElementById('canvasRepairModal').classList.contains('visible')) { hideModal('canvasRepairModal'); }
      else if (document.getElementById('saveProjectModal').classList.contains('visible')) { hideModal('saveProjectModal'); }
      else if (document.getElementById('copyProjectModal').classList.contains('visible')) { if (App.clearCopyProjectModalTarget) App.clearCopyProjectModalTarget(); hideModal('copyProjectModal'); }
      else if (document.getElementById('loadProjectModal').classList.contains('visible')) { hideModal('loadProjectModal'); }
      else if (document.getElementById('shareProjectModal').classList.contains('visible')) { hideModal('shareProjectModal'); }
      else if (document.getElementById('loadAnnotationsModal').classList.contains('visible')) { hideModal('loadAnnotationsModal'); }
      else if (document.getElementById('preparePdfModal').classList.contains('visible')) { if (typeof closePreparePdfModal === 'function') closePreparePdfModal(); }
      else if (document.getElementById('summaryCountDetailModal').classList.contains('visible')) { hideModal('summaryCountDetailModal'); }
      else if (document.getElementById('viewLinkEmailModal').classList.contains('visible')) {
        if (App.cancelViewLinkEmailPrompt) App.cancelViewLinkEmailPrompt();
        hideModal('viewLinkEmailModal');
      }
      else if (document.getElementById('addCanvasModal').classList.contains('visible')) { hideModal('addCanvasModal'); }
      else if (document.getElementById('deleteCanvasConfirmModal').classList.contains('visible')) { hideModal('deleteCanvasConfirmModal'); }
      else if (document.getElementById('canvasDetailsModal').classList.contains('visible')) {
        // Same commit-name-then-close path as the Done button (features/canvas-layers.js).
        document.getElementById('canvasDetailsClose').click();
      }
      else if (state.tool === TOOL.EDIT_POLY) exitEditMode(false);
      else if (state.drawingPolyline) { state.drawingPolyline = null; state.tool = TOOL.NONE; updateUI(); }
      else if (state.tool === TOOL.LINE) {
        if (state.quickLineStart) { state.quickLineStart = null; renderPdf(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.SCALE) {
        // Escaping mid "Select on PDF" must clear the placed scale point(s) (else a
        // stray crosshair lingers) and any zone-apply state.
        state.tool = TOOL.NONE;
        state.scaleMode = SCALE_MODES.NONE;
        state.scalePointA = null;
        state.scalePointB = null;
        App.resetScaleModalZoneMode();
        App.resetScaleCheckMode && App.resetScaleCheckMode();
        updateUI();
        renderPdf();
      } else if (state.tool === TOOL.MEASURE) {
        state.tool = TOOL.NONE;
        state.scalePointA = null;
        state.scalePointB = null;
        state.scaleMode = SCALE_MODES.NONE;
        updateUI();
        renderPdf();
      } else if (state.tool === TOOL.HIGHLIGHT) {
        if (state.highlightStart) { state.highlightStart = null; renderPdf(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.MULTIPLY_ZONE) {
        if (state.multiplyZoneStart) { state.multiplyZoneStart = null; renderPdf(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.SCALE_ZONE) {
        if (state.scaleZoneStart) { state.scaleZoneStart = null; renderPdf(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.DELETE_ZONE) {
        if (state.deleteZoneStart) { state.deleteZoneStart = null; renderPdf(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.ROOM) {
        if (state.roomBoxStart) { state.roomBoxStart = null; renderPdf(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.NOTE) {
        state.tool = TOOL.NONE;
        updateUI();
      } else state.tool = TOOL.NONE;
    }
    if (e.key === 'ArrowLeft') {
      if (e.shiftKey) {
        const marked = getMarkedPageIndices();
        const prev = marked.filter(i => i < state.currentPage).pop();
        if (prev !== undefined) { state.currentPage = prev; fitZoom(); }
      } else if (state.currentPage > 0) { state.currentPage--; fitZoom(); }
    }
    if (e.key === 'ArrowRight') {
      if (e.shiftKey) {
        const marked = getMarkedPageIndices();
        const next = marked.find(i => i > state.currentPage);
        if (next !== undefined) { state.currentPage = next; fitZoom(); }
      } else if (state.currentPage < state.pages.length - 1) { state.currentPage++; fitZoom(); }
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const page = state.pages[state.currentPage];
      const canvases = getPageCanvases(page);
      if (canvases.length > 1) {
        const activeId = state.activeCanvasIdByPage?.[state.currentPage] || canvases[0]?.id;
        let idx = canvases.findIndex(c => c.id === activeId);
        if (idx < 0) idx = 0;
        if (e.key === 'ArrowUp' && idx > 0) {
          state.activeCanvasIdByPage[state.currentPage] = canvases[idx - 1].id;
          if (!state.isViewer) markProjectDirty();
          renderPdf();
          updateUI();
        } else if (e.key === 'ArrowDown' && idx < canvases.length - 1) {
          state.activeCanvasIdByPage[state.currentPage] = canvases[idx + 1].id;
          if (!state.isViewer) markProjectDirty();
          renderPdf();
          updateUI();
        }
      }
    }
    if (e.key === 'Enter' && state.drawingPolyline && state.drawingPolyline.points.length >= 2) finishPolyline(false);
    if (e.key === 'Enter' && state.tool === TOOL.EDIT_POLY) exitEditMode(true);
  });

  // SECTION: [sync] Manual save to cloud

  // The PDF upload ladder (resumable/TUS + verify-after-timeout),
  // performSaveProjectToCloud, and the one-shot local-PDF uploader live in
  // save-engine.js (Stage 6) with the upload-progress sink and the one-shot
  // in-flight/backoff state. Wrappers keep the App registry (Prepare PDF
  // commit) and the interval/visibility callers below frozen.
  function performSaveProjectToCloud(opts) { return saveEngine.performSaveProjectToCloud(opts); }
  function uploadLocalPdfToCloudIfNeeded(reason, opts) { return saveEngine.uploadLocalPdfToCloudIfNeeded(reason, opts); }

  // SECTION: [sync] Auto-save
  // performAutoSave (the 5s dirty-loop worker: checkout preflight, update/
  // insert with raw-fetch fallback + retry, outcome bookkeeping) lives in
  // save-engine.js (Stage 6); the interval + visibility callers use this
  // wrapper.
  function performAutoSave(externalRunId) { return saveEngine.performAutoSave(externalRunId); }

  // SECTION: [sync] Local backup (IndexedDB takeoff state)
  // The three-layer backup writer (writeTakeoffStateBackup ->
  // writeTakeoffBackupToIndexedDB -> doWriteTakeoffBackupToIndexedDB, with the
  // in-flight promise + lastLocalBackup stamps) lives in save-engine.js
  // (Stage 3); the 5s interval and the visibilitychange kick stay here.
  function writeTakeoffStateBackup() { return saveEngine.writeTakeoffStateBackup(); }
  setInterval(() => { writeTakeoffStateBackup(); }, 5000);

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt = Date.now();
        saveDebugLog('visibility.hidden', { autoSaveDirty: saveEngine.getAutoSaveDirty(), hasProject: !!state.currentProjectId });
        writeTakeoffStateBackup();
        saveEngine.abortInFlightAutoSave('hidden');
        const userId = state.supabaseSession?.user?.id;
        if (SUPABASE_ENABLED && supabase && userId && state.currentProjectId &&
            state.checkedOutBy === userId && saveEngine.getAutoSaveDirty() && !saveEngine.isSaveInProgress() && !suspendAutoSaveUntilCheckout) {
          performAutoSave().catch(() => {});
        }
        return;
      }
      if (document.visibilityState !== 'visible') return;
      const hiddenForMs = lastHiddenAt ? Date.now() - lastHiddenAt : 0;
      if (hiddenForMs > LONG_IDLE_PROBE_MS && SUPABASE_ENABLED && supabase) {
        await runRecoveryProbe('long_idle_return').catch(() => {});
      }
      if (!(SUPABASE_ENABLED && supabase && state.supabaseSession?.user)) {
        saveDebugLog('visibility.visible', { hiddenForMs, signedIn: false });
        return;
      }
      let sessionRefreshOk = false;
      try {
        let result;
        if (hiddenForMs > LONG_IDLE_PROBE_MS) {
          pushSaveEvent('session_refresh_attempt', 'Forcing JWT refresh after long idle', JSON.stringify({ hiddenForMs }));
          result = await withTimeout(supabase.auth.refreshSession(), 5000, 'visibility refreshSession');
        } else {
          result = await withTimeout(supabase.auth.getSession(), 5000, 'visibility getSession');
        }
        if (result?.data?.session) {
          state.supabaseSession = result.data.session;
          sessionRefreshOk = true;
        }
      } catch (_) {}
      // After a long idle, replace a wedged supabase-js client before the checkout
      // and permissions refreshes below try to use it (each is a .rpc that would
      // otherwise hang to its full timeout on a wedged client). Runs only on the
      // long-idle path; the JWT was just refreshed above, so a probe failure here
      // means a genuine wedge rather than an expired token.
      let clientRecycled = false;
      if (hiddenForMs > LONG_IDLE_PROBE_MS) {
        clientRecycled = await recycleClientIfWedgedOnIdleReturn('long_idle_return').catch(() => false);
      }
      let probeResult = null;
      const userId = state.supabaseSession?.user?.id;
      if (state.currentProjectId && userId && state.checkedOutBy === userId && !state.isViewer && !suspendAutoSaveUntilCheckout) {
        const probe = await probeCheckoutLock();
        probeResult = probe.ok ? 'ok' : (probe.expired ? 'expired' : 'error');
        if (probe.expired) {
          try {
            await handleBackgroundCheckoutExpired('visibility_probe');
          } catch (e) {
            try {
              pushSaveEvent('background_recovery_threw', 'Background recovery threw unexpectedly',
                JSON.stringify({ trigger: 'visibility_probe', message: (e && e.message) || String(e), name: e && e.name }));
            } catch (_) {}
          }
        }
      }
      let permsRefreshed = false;
      if (state.currentProjectId) {
        try { await refreshProjectPermissions(); permsRefreshed = true; } catch (_) {}
      }
      saveDebugLog('visibility.visible', { hiddenForMs, sessionRefreshOk, clientRecycled, probeResult, permsRefreshed });
      updateUI();
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      pushSaveEvent('online', 'Browser reports connection online');
      updateSaveStatusIndicator();
      if (saveEngine.getConsecutiveAutoSaveFailures() > 0) {
        runRecoveryProbe('online_event').catch(() => {});
      }
    });
    window.addEventListener('offline', () => {
      pushSaveEvent('offline', 'Browser reports connection offline');
      updateSaveStatusIndicator();
    });
  }

  setInterval(async () => {
    if (!SUPABASE_ENABLED || !state.supabaseSession?.user) return;
    if (suspendAutoSaveUntilCheckout) {
      if (saveEngine.getAutoSaveDirty() && isSaveDebugEnabled()) saveDebugLog('autosave.suspended', { reason: 'checkout_expired_pending_recheckout' });
      return;
    }
    // Belt-and-suspenders: if this project has a local PDF that never reached
    // cloud storage (e.g. created via Prepare PDF "Open"), upload it. Fire and
    // forget; the helper self-gates (in-flight, backoff, !pdfStoragePath) and
    // stops firing once the upload succeeds. Runs regardless of canvas-dirty
    // state so a failed attempt retries on a later tick.
    uploadLocalPdfToCloudIfNeeded('autosave_tick').catch(() => {});
    if (!saveEngine.getAutoSaveDirty()) return;
    saveEngine.maybeWriteDirtySnapshot();
    if (Date.now() < saveEngine.getNextAutoSaveAttemptAt()) {
      if (isSaveDebugEnabled()) saveDebugLog('autosave.skip', { reason: 'backoff', untilInMs: saveEngine.getNextAutoSaveAttemptAt() - Date.now() });
      return;
    }
    const intervalRunId = isSaveDebugEnabled() ? saveDebugRunId() : undefined;
    if (intervalRunId) saveDebugLog('autosave.interval.tick', { runId: intervalRunId });
    const result = await performAutoSave(intervalRunId);
    if (!result.ok) {
      if (result.error?.code === 'CHECKOUT_EXPIRED') {
        try {
          await handleBackgroundCheckoutExpired('autosave');
        } catch (e) {
          try {
            pushSaveEvent('background_recovery_threw', 'Background recovery threw unexpectedly',
              JSON.stringify({ trigger: 'autosave', message: (e && e.message) || String(e), name: e && e.name }));
          } catch (_) {}
        }
      } else if (result.error) {
        window.lastSaveError = result.error;
        updateSaveStatusIndicator();
      }
    } else {
      updateSaveStatusIndicator();
    }
  }, AUTO_SAVE_INTERVAL_MS);

  // SECTION: [sync] Checkout keep-alive
  // Implementation in save-engine.js (Stage 1); the wrapper + interval stay so
  // the symbol remains greppable here and future callers bind the same name.
  function checkoutKeepalive() { return saveEngine.checkoutKeepalive(); }
  setInterval(checkoutKeepalive, CHECKOUT_KEEPALIVE_MS);

  window.state = state;
  window.makeAnnotations = makeAnnotations;
  window.getAnnotationsForReport = (page, pageIdx) => getActiveAnnotations(page, pageIdx);
  window.getMergedAnnotationsForPage = getMergedAnnotationsForPage;
  window.ptDist = ptDist;
  window.polylineDistance = polylineDistance;
  window.renderIconHtml = renderIconHtml;

  // SECTION: App feature registry
  // Shared registry that lets feature files (features/*.js, loaded AFTER this
  // IIFE) reach the cross-cutting state + helpers they need without living
  // inside this closure. Feature files read these at call time (user actions,
  // long after load) and register their own public entry points back onto App;
  // app.js then calls those via deferred bindings (() => App.fn()). See
  // ARCHITECTURE.md "Feature files / window.App registry".
  const App = (window.App = window.App || {});
  App.state = state;
  App.uid = uid;
  App.makeAnnotations = makeAnnotations;
  App.applyRotationDeltaToAnnotations = applyRotationDeltaToAnnotations;
  App.reconcileOrphanedCountersAndLineTypes = reconcileOrphanedCountersAndLineTypes;
  App.pushUndoSnapshot = pushUndoSnapshot;
  App.markProjectDirty = markProjectDirty;
  App.showModal = showModal;
  App.hideModal = hideModal;
  App.renderPdf = renderPdf;
  App.updateUI = updateUI;
  // showLineColorModal / pushRecentColor / setupCreateColorPicker are
  // registered by features/line-color.js (split #36).
  App.ensureActiveCanvas = ensureActiveCanvas;
  App.getMaxZoom = getMaxZoom;
  App.getWheelZoomSpeed = getWheelZoomSpeed;
  // Zoom rail deps (features/zoom-rail.js): publish-only — the wheel/pinch
  // paths in this file keep using them directly.
  App.doZoomIn = doZoomIn;
  App.doZoomOut = doZoomOut;
  App.updateContainerTransform = updateContainerTransform;
  App.commitWheelZoom = commitWheelZoom;
  App.syncZoomIndicators = syncZoomIndicators;
  App.getCanvasCaps = getCanvasCaps;
  App.setCanvasCaps = setCanvasCaps;
  App.effectiveDpr = effectiveDpr;
  App.__getRenderAreaSafety = () => renderAreaSafety;   // debug/test seam (mirrors setCanvasCaps)
  // Bitmap cache: the clear is called from features/prepare-pdf.js and
  // features/load-project.js at their pages-rebuild sites; the stats object is
  // a debug/test seam (page-switch-cache.spec.js).
  App.clearPdfBitmapCache = clearPdfBitmapCache;
  App.__pdfBitmapCacheStats = () => ({ size: pdfBitmapCache.length, hits: pdfBitmapCacheStats.hits, misses: pdfBitmapCacheStats.misses, prefetched: pdfBitmapCacheStats.prefetched });
  App.__pdfBitmapCacheDump = () => pdfBitmapCache.map(e => ({ zoom: e.zoom, effDpr: e.effDpr, rotation: e.rotation, w: e.w, h: e.h, pageIdx: state.pages.findIndex(p => p.pdfPage === e.pdfPage) }));
  App.getOrderedIcons = getOrderedIcons;
  App.iconVbFor = iconVbFor;
  App.getUserCustomIcons = getUserCustomIcons;
  App.saveUserCustomIcons = saveUserCustomIcons;
  App.showToast = showToast;
  App.getPageCanvases = getPageCanvases;
  App.renderAnnotationsToContext = renderAnnotationsToContext;
  // addReportPagesToPdf / addHighlightsToPdf / addNotesToPdf / hasAnyHighlights /
  // hasAnyNotes are registered from features/pdf-bundle.js.
  App.wrapNoteText = wrapNoteText;
  App.logUserEvent = logUserEvent;
  App.renderPagesList = renderPagesList;
  App.renderAnnotations = renderAnnotations;
  App.renderCountersList = renderCountersList;
  App.renderLineTypesList = renderLineTypesList;
  App.DROP_ICON_STYLES = DROP_ICON_STYLES;
  App.TOOL = TOOL;
  App.COLORS = COLORS;
  App.getLineModifiers = getLineModifiers;
  App.saveLineModifiers = saveLineModifiers;
  App.getPlumbingModifiers = getPlumbingModifiers;
  App.savePlumbingModifiers = savePlumbingModifiers;
  App.getIconName = getIconName;
  App.getEffectiveCustomIcons = getEffectiveCustomIcons;
  // populatePlumModal + populateCounterQuickCountPanel are registered from
  // features/quick-modals.js (counter.js calls App.populateCounterQuickCountPanel).
  App.getCloudSaveSummary = getCloudSaveSummary;
  App.pruneSaveStatusLog = pruneSaveStatusLog;
  App.getSaveStatusLogWindowMs = getSaveStatusLogWindowMs;
  App.isSaveDebugEnabled = isSaveDebugEnabled;
  App.setSaveDebugEnabled = setSaveDebugEnabled;
  App.buildSaveLogsEnvelopeWithSnapshots = buildSaveLogsEnvelopeWithSnapshots;
  App.pushSaveEvent = pushSaveEvent;
  App.getSaveStatusLog = () => saveEngine.getSaveStatusLog();
  App.isCheckoutExpiredAttention = () => checkoutExpiredNeedsAttention;
  App.SUPABASE_URL = SUPABASE_URL;
  App.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  App.updateServerClockFromRpc = updateServerClockFromRpc;
  App.clearCheckoutExpiredAttention = clearCheckoutExpiredAttention;
  App.resetAutoRecheckoutCounter = (projectId) => resetAutoRecheckoutCounter(projectId);
  App.getSupabase = () => supabase;
  App.formatLastSignIn = formatLastSignIn;
  App.formatUserActivityDateTime = formatUserActivityDateTime;
  App.USER_ACTIVITY_ICON_SVG = USER_ACTIVITY_ICON_SVG;
  // openUserActivityModal is registered by features/user-activity.js (re-homed).
  App.formatLastSignInUserActivity = formatLastSignInUserActivity;
  App.filterUserActivityRows = filterUserActivityRows;
  App.renderUserActivityAllUsersTableHtml = renderUserActivityAllUsersTableHtml;
  App.updateSaveStatusIndicator = updateSaveStatusIndicator;
  App.canUseDevAuth = canUseDevAuth;
  App.deleteProjectAsOwner = deleteProjectAsOwner;
  // Load Project modal deep deps (features/load-project.js): the project-load
  // action is fused with the boot/engine path, so it reaches these internals.
  App.SUPABASE_URL = SUPABASE_URL;
  App.clearUndoStacks = clearUndoStacks;
  App.subscribeToProjectCheckoutChanges = subscribeToProjectCheckoutChanges;
  App.takeoffBackupGet = takeoffBackupGet;
  App.ensureGroupColors = ensureGroupColors;
  App.openCanvasOnlyNeedsPdfModal = openCanvasOnlyNeedsPdfModal;
  App.backupDataToProjFormat = backupDataToProjFormat;
  App.fitZoom = fitZoom;
  // Import Canvas / Clear Page deps (features/import-clear.js).
  App.applyPageAnnotationsFromData = applyPageAnnotationsFromData;
  App.getActiveCanvas = getActiveCanvas;
  // Zone/page-action modal dep (features/zone-modals.js).
  App.performDeleteZone = performDeleteZone;
  // Canvas layers dep (features/canvas-layers.js).
  App.deepCopyAnnotations = deepCopyAnnotations;
  // My Settings deps (features/my-settings.js).
  App.fetchUserAirboard = fetchUserAirboard;
  App.saveUserAirboard = saveUserAirboard;
  App.PLUMBING_DEFAULTS = PLUMBING_DEFAULTS;
  App.LINE_DEFAULTS = LINE_DEFAULTS;
  // Output cluster deps (features/output.js).
  App.SUPABASE_ENABLED = SUPABASE_ENABLED;
  App.getOrCreateViewLinkUrl = getOrCreateViewLinkUrl;
  // Prepare PDF modal deps (features/prepare-pdf.js).
  App.assertPdfWithinLimit = assertPdfWithinLimit;
  App.mergePdfBuffers = mergePdfBuffers;
  App.buildTrimmedPdfBuffer = buildTrimmedPdfBuffer;
  App.resetGridOrigin = resetGridOrigin;
  App.writeTakeoffStateBackup = writeTakeoffStateBackup;
  App.performSaveProjectToCloud = performSaveProjectToCloud;
  App.isAuthError = isAuthError;
  // NB: the three async, block-scoped load helpers (checkInCurrentProjectIfHeld,
  // resolvePdfBufferForCloudProject, buildPagesFromPdfArrayBufferAndProjectData)
  // are NOT Annex-B hoisted to this scope, so they are published from inside the
  // `if (SUPABASE_ENABLED)` block instead (search "in-block load-helper publish").
  // Setters for engine let-state the load action resets (cannot assign through
  // the registry otherwise).
  App.setAutoSaveDirty = (v) => saveEngine.setAutoSaveDirty(v);
  App.getAutoSaveDirty = () => saveEngine.getAutoSaveDirty();
  App.performAutoSave = (runId) => saveEngine.performAutoSave(runId);
  App.sha256Hex = (buf) => saveEngine.sha256Hex(buf);
  App.refreshProjectPermissions = () => refreshProjectPermissions();
  App.setCheckoutExpiredAttention = () => { checkoutExpiredNeedsAttention = true; suspendAutoSaveUntilCheckout = true; };
  App.applyTakeoffBackupToState = applyTakeoffBackupToState;
  App.logProjectOpenEvent = logProjectOpenEvent;
  // Annex-B hoisted from the SUPABASE_ENABLED block; resolved at call time.
  App.openCheckoutExpiredRecoveryModal = (opts) => openCheckoutExpiredRecoveryModal(opts);
  App.serverNowMs = () => serverNowMs();
  App.probeCheckoutLock = (runId) => saveEngine.probeCheckoutLock(runId);
  App.saveDebugLog = (phase, payload) => saveEngine.saveDebugLog(phase, payload);
  App.handleBackgroundCheckoutExpired = (trigger) => saveEngine.handleBackgroundCheckoutExpired(trigger);
  App.withTimeout = (p, ms, label) => withTimeout(p, ms, label);
  App.setLastModifiedAt = (v) => { lastModifiedAt = v; };
  App.setLastLocalBackupAt = (v) => saveEngine.setLastLocalBackupAt(v);
  App.setLastSaveIncludedPdf = (v) => { lastSaveIncludedPdf = v; };
  App.SCALE_MODES = SCALE_MODES;
  App.SCALE_PRESETS = SCALE_PRESETS;
  App.ptDist = ptDist;
  App.parseFraction = parseFraction;
  App.parseRealWorldLength = parseRealWorldLength;
  App.getActiveAnnotations = getActiveAnnotations;
  // Item detail & properties modal deps (features/item-details.js; deleteGroup's
  // App registration moved there too — groups.js keeps consuming App.deleteGroup).
  App.enterEditMode = enterEditMode;
  App.countItemsInGroup = countItemsInGroup;
  App.getPageScale = getPageScale;
  App.getPageSheetAnalysis = getPageSheetAnalysis;
  App.STANDARD_SHEETS = STANDARD_SHEETS;
  App.sheetCorrectionFactor = sheetCorrectionFactor;
  App.scaleCheckDelta = scaleCheckDelta;
  App.convertUnitValue = convertUnitValue;
  App.formatFeetInchesFromVal = formatFeetInchesFromVal;
  // Room Sizer deps (features/room-sizer.js).
  App.roomBoxDimsFeet = roomBoxDimsFeet;
  App.getEffectiveScaleForLine = getEffectiveScaleForLine;
  App.getMergedAnnotationsForPage = getMergedAnnotationsForPage;
  App.showSetScaleFirstToast = showSetScaleFirstToast;
  // Viewer scale sharing + view-only boot live in features/view-only.js
  // (App.shareViewerScale / noteViewerTempScale / applyViewerTempScales /
  // maybeShowViewerScaleNotice / App.initViewOnlyMode — all registered by the
  // feature file; the first three double as viewer-scale.spec.js test seams).

  if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.__takeoffBackupGetForTest = takeoffBackupGet;
    window.__takeoffBackupDeleteForTest = takeoffBackupDelete;
    window.__customIconsGetFromIndexedDBForTest = customIconsGetFromIndexedDB;
    window.getUserCustomIcons = getUserCustomIcons;
    window.saveUserCustomIcons = saveUserCustomIcons;
    // isTransientSaveError self-tests now live in save-utils.test.js (node:test).
  }

  // SECTION: View-only mode
  // The whole view-link session (initViewOnlyMode, the email gate, the
  // viewer-scale sharing layer + owner notice) lives in features/view-only.js
  // (registry split #34); boot resolves it via App.initViewOnlyMode after
  // DOMContentLoaded, and updateUI pings App.maybeShowViewerScaleNotice.

  // SECTION: Init / boot
  (async function init() {
    // Probe the device's max canvas size once, before any PDF render, so high-zoom
    // renders are clamped to a size the browser can actually rasterize (no black screen).
    detectMaxCanvasArea();
    // Scale reference-line visibility is a device view-preference (localStorage), not
    // project data — the line geometry itself rides on page.scale.refLine.
    try { const v = localStorage.getItem('showScaleRefLine'); if (v != null) state.showScaleRefLine = v === 'true'; } catch (_) { /* private mode */ }
    // PWA: register the service worker (offline shell + cached PDF/lib assets).
    // Scoped to /app/ — the app lives there; the marketing site at / is plain static
    // HTML, outside the SW. Registered for every entry path, incl. the view-link branch.
    if ('serviceWorker' in navigator) {
      // After a deploy, a returning tab renders one "mixed shell" (network-first
      // HTML + the previous version's cached assets) until the updated SW takes
      // control. Reload once on that takeover so users aren't left on mismatched
      // UI — but only when it's an update (the page was already controlled at
      // load, not a first-install claim) and nothing would be lost.
      const swHadController = !!navigator.serviceWorker.controller;
      let swReloadedOnUpdate = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!swHadController || swReloadedOnUpdate) return;
        swReloadedOnUpdate = true;
        if (state.pages.length === 0 && !saveEngine.getAutoSaveDirty()) window.location.reload();
      });
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/app/' }).catch(() => {});
      });
    }
    const urlParams = new URLSearchParams(window.location.search || '');
    const viewToken = urlParams.get('t');
    if (viewToken && SUPABASE_ENABLED && SUPABASE_URL) {
      try {
        // features/view-only.js registers initViewOnlyMode; feature scripts
        // load after this one, so wait for the DOM to finish parsing before
        // resolving it through the registry.
        if (!App.initViewOnlyMode && document.readyState === 'loading') {
          await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
        }
        await App.initViewOnlyMode(viewToken);
        try {
          await initSupabaseAuth();
          if (state.supabaseSession?.user) {
            state.isViewer = true;
            state.canCheckOut = false;
            state.loadedViaViewLink = true;
            try { pushSaveEvent('view_link_session_attached', 'View-link tab observed an existing Supabase session', JSON.stringify({ userEmail: state.supabaseSession.user.email || null })); } catch (_) {}
            try { updateUI(); updateSaveStatusIndicator(); } catch (_) {}
          }
        } catch (authErr) {
          console.warn('[View link] auth init failed:', authErr);
        }
      } catch (e) {
        console.error('[View link]', e);
        showToast('Failed to load: ' + (e.message || 'Unknown error'), 5000);
      }
      updateUI();
      return;
    }
    // PR 11: resolve auth BEFORE applying takeoff backup so backups tied to a
    // previous user are not briefly visible on the canvas of the new user.
    await initSupabaseAuth();
    // PWA: best-effort request that the OS keep our IndexedDB (PDF cache +
    // takeoff backups) from being evicted under storage pressure — that data is
    // the offline corpus. Granted more readily once a session exists.
    try {
      if (navigator.storage && navigator.storage.persist) {
        const alreadyPersisted = navigator.storage.persisted && await navigator.storage.persisted();
        if (!alreadyPersisted) await navigator.storage.persist();
      }
    } catch (_) {}
    // Arriving from the landing's "Already have access? Sign in" CTA (/app/?signin=1):
    // open the sign-in modal, unless already signed in.
    try {
      if (urlParams.get('signin') === '1' && SUPABASE_ENABLED && !state.supabaseSession?.user) {
        document.getElementById('authBtn')?.click();
      }
    } catch (_) {}
    // Load custom icons AFTER auth so customIconsCurrentKey() resolves to the
    // signed-in user's key (PR 7 per-user split). If signed-out, falls back to
    // the legacy 'user' key with automatic migration on first signed-in load.
    let loaded = await customIconsGetFromIndexedDB();
    if (!loaded) {
      try {
        const stored = localStorage.getItem('customIconPaths');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length) {
            loaded = parsed;
            await customIconsPutToIndexedDB(loaded);
            localStorage.removeItem('customIconPaths');
          }
        }
      } catch (_) {}
    }
    if (loaded) customIconsCache = loaded;
    // Restore takeoff backup (IndexedDB-primary, localStorage fallback for migration)
    const localBackupForBoot = await takeoffBackupGet('local', state.supabaseSession?.user?.id || null);
    let backupToApply = localBackupForBoot?.data || null;
    if (!backupToApply) {
      try {
        const stored = localStorage.getItem('takeoff-state');
        if (stored) {
          const parsed = JSON.parse(stored);
          const storedUserId = parsed?.userId || null;
          const currentUid = state.supabaseSession?.user?.id || null;
          if (!storedUserId || !currentUid || storedUserId === currentUid) {
            backupToApply = parsed;
            // One-time migration: write to IndexedDB, then clear localStorage
            if (parsed.counters || parsed.lineTypes) {
              await takeoffBackupPut('local', parsed, null, null, parsed.lastModifiedAt || Date.now(), parsed.projectName || null, currentUid);
              localStorage.removeItem('takeoff-state');
            }
          } else {
            try { pushSaveEvent('takeoff_backup_skip_other_user', 'Skipped legacy takeoff-state from a different user', JSON.stringify({ storedUserId })); } catch (_) {}
            localStorage.removeItem('takeoff-state');
          }
        }
      } catch (_) {}
    }
    if (backupToApply) applyTakeoffBackupToState(backupToApply);
    if (!state.supabaseSession?.user && canUseDevAuth() && urlParams.get('devAuth') === '1') {
      const ok = await devAuthSignIn();
      if (ok && window.history?.replaceState) {
        const u = new URL(window.location.href);
        u.searchParams.delete('devAuth');
        window.history.replaceState({}, '', u.toString());
      }
      if (ok) {
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('user_id', state.supabaseSession.user.id).maybeSingle();
        state.isAdmin = !!profile?.is_admin;
      }
    }
    if (SUPABASE_ENABLED && supabase && state.supabaseSession?.user) {
      const uid = state.supabaseSession.user.id;
      supabase.channel('project-shares-changes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'project_shares', filter: 'user_id=eq.' + uid }, function() {
        if (state.currentProjectId) refreshProjectPermissions();
      }).subscribe();
      supabase.channel('system-settings-changes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: 'key=eq.force_reload_after' }, function(payload) {
        state.globalReloadAtServerMs = payload?.new?.value_ts ? new Date(payload.new.value_ts).getTime() : Date.now();
        state.globalReloadReason = payload?.new?.value_text || '';
        showGlobalReloadBanner();
      }).subscribe();
      try {
        let offeredRestore = false;
        // Reuse the 'local' record already read into localBackupForBoot above instead of
        // a second identical full read of the same IndexedDB entry.
        const localBackup = localBackupForBoot;
        const hasLocalPdf = localBackup && localBackup.pdfBlob && localBackup.pdfBlob.size > 0;
        if (hasLocalPdf && localBackup.data) {
          const projForRestore = { id: 'local', name: localBackup.projectName || 'Untitled', data: backupDataToProjFormat(localBackup.data || {}), updated_at: null, pdf_path: null, pdf_hash: localBackup.pdfHash, user_id: uid, checked_out_by: null, checked_out_at: null };
          pendingLastSessionRestore = { proj: projForRestore, cachedBlob: localBackup.pdfBlob };
          const msgEl = document.getElementById('lastSessionRestoreMessage');
          if (msgEl) {
            const n = (projForRestore.name || 'Untitled').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([-_])/g, '$1\u200B');
            msgEl.innerHTML = 'You have a local session from your last visit: <strong>' + n + '</strong>. What would you like to do?';
          }
          showModal('lastSessionRestoreModal');
          offeredRestore = true;
        }
        if (!offeredRestore) {
          // Cloud last-session: show the modal INSTANTLY from the lightweight
          // localStorage metadata (projectName etc.). The Supabase project fetch +
          // PDF-blob resolution are deferred to the #lastSessionRestoreKeep handler so a
          // network round-trip no longer blocks the modal's appearance. A stale /
          // inaccessible project is cleaned up on "Keep" rather than at boot.
          const stored = localStorage.getItem('clickcount-last-project');
          if (stored) {
            const last = JSON.parse(stored);
            if (last && last.userId === state.supabaseSession.user.id && last.projectId) {
              pendingLastSessionRestore = { cloudLast: last };
              const msgEl = document.getElementById('lastSessionRestoreMessage');
              if (msgEl) {
                const n = (last.projectName || 'Untitled').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([-_])/g, '$1\u200B');
                msgEl.innerHTML = 'You have a project from your last session: <strong>' + n + '</strong>. What would you like to do?';
              }
              showModal('lastSessionRestoreModal');
            }
          }
        }
      } catch (_) {}
    }
    updateUI();
  })();
  })();

  (function() {
  // SECTION: Constants
  if (typeof pdfjsLib !== 'undefined') pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min-3.11.174.js';

  // All pdf.js getDocument calls go through here. pdf.js needs its bundled
  // substitute fonts (standard_fonts/) for PDFs that reference fonts without
  // embedding them (common in CAD-exported plan sets) and cmaps/ for
  // predefined CID text encodings — without these, every glyph in such a PDF
  // renders as the .notdef box. Accepts an ArrayBuffer/TypedArray, a Blob, a
  // URL string, or a DocumentInitParameters object; returns an object with a
  // .promise resolving to the PDFDocumentProxy (the only loading-task surface
  // the app uses).
  const PDF_OPEN_OPTIONS = {
    standardFontDataUrl: '/vendor/standard_fonts/',
    cMapUrl: '/vendor/cmaps/',
    cMapPacked: true,
  };
  function getPdfDocument(src) {
    if (typeof Blob !== 'undefined' && src instanceof Blob) {
      // pdf.js 3.x does not accept a Blob directly — read it first.
      return { promise: src.arrayBuffer().then((buf) => pdfjsLib.getDocument({ ...PDF_OPEN_OPTIONS, data: buf }).promise) };
    }
    let params;
    if (typeof src === 'string' || (typeof URL !== 'undefined' && src instanceof URL)) {
      params = { ...PDF_OPEN_OPTIONS, url: src };
    } else if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
      params = { ...PDF_OPEN_OPTIONS, data: src };
    } else {
      params = { ...PDF_OPEN_OPTIONS, ...src };
    }
    return pdfjsLib.getDocument(params);
  }

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
    getLineRealWorldLengthFeet: (line, pageIdx, isPoly, ann) => getLineRealWorldLengthFeet(line, pageIdx, isPoly, ann),
  });
  // mergeAnnotations / migratePageToCanvases / verifyPageBakeFrame have no
  // app-side callers (their callers moved into the model) — annotationModel.*.
  function makeAnnotations() { return annotationModel.makeAnnotations(); }
  function getPageCanvases(page) { return annotationModel.getPageCanvases(page); }
  function getActiveCanvas(page, pageIdxHint) { return annotationModel.getActiveCanvas(page, pageIdxHint); }
  function getActiveAnnotations(page, pageIdxHint) { return annotationModel.getActiveAnnotations(page, pageIdxHint); }
  function getMergedAnnotationsForPage(page, onlyIds) { return annotationModel.getMergedAnnotationsForPage(page, onlyIds); }
  function ensureActiveCanvas(page) { return annotationModel.ensureActiveCanvas(page); }
  function pageHasAnyAnnotations(p) { return annotationModel.pageHasAnyAnnotations(p); }
  function projectHasAnyCanvasMarkup() { return annotationModel.projectHasAnyCanvasMarkup(); }
  function backupDataToProjFormat(data) { return annotationModel.backupDataToProjFormat(data); }
  function computePageBakeFrame(p) { return annotationModel.computePageBakeFrame(p); }
  function applyTakeoffBackupToState(backup) { return annotationModel.applyTakeoffBackupToState(backup); }
  function applyPageAnnotationsFromData(page, p, scaleFallback) { return annotationModel.applyPageAnnotationsFromData(page, p, scaleFallback); }
  function hydrateStateFromProjectData(d) { return annotationModel.hydrateStateFromProjectData(d); }
  function reconcileOrphanedCountersAndLineTypes() { return annotationModel.reconcileOrphanedCountersAndLineTypes(); }
  function planPaletteRelink(incomingCounters, incomingLineTypes) { return annotationModel.planPaletteRelink(incomingCounters, incomingLineTypes); }
  function applyPaletteRelink(plan) { return annotationModel.applyPaletteRelink(plan); }

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
    quickLineStart: null, highlightStart: null, multiplyZoneStart: null, scaleZoneStart: null, deleteZoneStart: null, roomBoxStart: null, chainStart: null, ghostRectStart: null, placingGhost: null, placingGhostLast: null, activeGhostId: null, draggingGhostIdx: null, draggingGhostLast: null, ghostDragMoved: false, justFinishedDragGhost: false, pendingRoomBox: null, pendingRoomBoxEdit: null, pendingMultiplyZone: null, pendingMultiplyZoneValue: null, pendingMultiplyZoneEdit: null, pendingScaleZone: null, pendingScaleZoneEdit: null, scaleModalApplyTarget: null, scaleCheckMode: false, pendingDeleteZone: null, pendingNote: null, editingNote: null, mousePos: { x: 0, y: 0 }, pan: { x: 0, y: 0 }, isPanning: false, panStart: null,
    counters: [], lineTypes: [], activeLineTypeId: null, groupsEnabled: false, ctxTarget: null, selectedLineId: null, selectedLineIsPoly: false, selectedLinePageIdx: null,
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
    scaleZoneSettings: { showLabelOnZone: true, labelSize: 14, labelPosition: 'top-left' },
    exportSettings: { markerScale: 0.75, lineScale: 0.75, bundleHighlightsToPdf: true, bundleNotesToPdf: true },
    recentLineColors: [],
    recentDrops: [],
    editingPolyline: null, editingPolyIndex: null, draggingVertexIdx: null, resizingNoteIdx: null, resizingNotePageIdx: null, resizingNoteFontSizeIdx: null, resizingNoteFontSizePageIdx: null, resizingNoteFontSizeStartY: null, resizingNoteFontSizeStartLocalY: null, resizingNoteFontSizeStartVal: null, justFinishedResize: false, draggingNoteIdx: null, draggingNotePageIdx: null, draggingNoteOffset: null, dragNoteStartPos: null, justFinishedDragNote: false, draggingLegend: false, resizingLegend: false, legendDragOffset: null, legendResizeStart: null, longPressTimer: null, longPressFired: false,
    longPressStart: null, pinchStartDistance: null, pinchStartZoom: null,
    touchPanStart: null, touchPanning: false,
    aiming: false, aimPressTimer: null, aimPoint: null, aimClient: null, aimRafPending: false,
    aimOffsetPx: 0, aimMouseDownClient: null, justFinishedLoupe: false,
    rectPress: null, rectDragging: false, justFinishedRectDrag: false,
    vertexDragStart: null, vertexDragMoved: false,
    lastScaleTapTime: 0,
    currentProjectId: null,
    currentProjectName: null,
    isAdmin: false,
    isOverseer: false,
    isDigitalTwin: false,
    pendingDeletePage: null,
    supabaseSession: null,
    pdfBuffer: null,
    pdfBufferSize: 0,
    pdfStoragePath: null,
    pdfHash: null,
    // In-memory only: hash of a locally-uploaded (never-saved) PDF, stamped by
    // features/pdf-intake.js. NOT state.pdfHash, which carries cloud-PDF
    // semantics through the save/upload ladder. Rides signed-out IndexedDB
    // backups so the same-PDF re-upload re-apply can hash-verify the match.
    localPdfHash: null,
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
    peekCanvasIdsByPage: {},  // in-memory peek subset: pageIdx -> [canvasId,...] to show besides the active one (absent = all); chosen via right-click on #showAllCanvasesBtn
    canCheckOut: false,
    projectOwnerId: null,
    maxZoom: null,
    groups: [],
    rooms: [],
    roomsListCollapsed: false,
    recentRoomHeights: [],
    activeGroupId: null,
    activeCanvasIdByPage: {},
    // Quick Keys: slot ('1'..'9','0') -> { kind: 'counter'|'lineType', id }.
    // Per-project (ids are uid()-scoped to the project); rides save/load,
    // export/import, and the IDB takeoff backup. See features/quick-keys.js.
    numberKeyBindings: {},
    showLegendOverlay: true,
    showGridOverlay: false,
    showScaleRefLine: true,
    gridSettings: null,
    userActivityAllRowsCache: null,
    userActivityViewMode: 'events'
  };
  state.showGroupColors = localStorage.getItem('groupColorDisplay') === '1';
  // Sidebar usage-filter scope persists per device (idea recovered from the
  // unlanded claude/app-review-docs-bb19fa attempt): a big-palette user who
  // sets "this project" keeps it across sessions. The setters write these
  // keys; 'off' is stored too so an explicit reset also sticks.
  try {
    const cScope = localStorage.getItem('counterSidebarFilterScope');
    if (cScope === 'page' || cScope === 'project') setCounterListFilterScope(cScope);
    const ltScope = localStorage.getItem('lineTypeSidebarFilterScope');
    if (ltScope === 'page' || ltScope === 'project') setLineTypeListFilterScope(ltScope);
  } catch (_) {}
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
  try {
    // Recent drop sizes ({ value, unit }), per device like recentRoomHeights.
    const rd = JSON.parse(localStorage.getItem('recentDrops') || '[]');
    if (Array.isArray(rd)) {
      state.recentDrops = rd.filter(d => d && typeof d.value === 'number' && d.value > 0 && typeof d.unit === 'string').slice(0, RECENT_DROPS_MAX);
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
  // --- Interaction-latency telemetry (rings of recent samples, ms) ---
  // placeMs: counter click -> mark painted (incl. undo snapshot + overlay).
  // zoomCrispMs: last gesture input -> first crisp base paint after commit.
  // undoSnapshotMs / renderAnnotationsMs / updateUIMs: the per-piece costs of
  // the placement hot path, so "feels slow" decomposes into numbers. p50/p95
  // ride the Save Status envelope via captureDisplayInfoObj below.
  const PERF_SAMPLE_CAP = 200;
  const perfSamples = { placeMs: [], zoomCrispMs: [], undoSnapshotMs: [], renderAnnotationsMs: [], updateUIMs: [] };
  let pendingZoomCrispT0 = null;
  function notePerfSample(kind, ms) {
    const arr = perfSamples[kind];
    if (!arr) return;
    arr.push(Math.round(ms * 100) / 100);
    if (arr.length > PERF_SAMPLE_CAP) arr.splice(0, arr.length - PERF_SAMPLE_CAP);
  }
  function perfSummary() {
    const out = {};
    for (const k of Object.keys(perfSamples)) {
      const arr = perfSamples[k];
      out[k] = { n: arr.length, p50: percentile(arr, 0.5), p95: percentile(arr, 0.95) };
    }
    return out;
  }
  function noteZoomCrispPaint() {
    if (pendingZoomCrispT0 == null) return;
    notePerfSample('zoomCrispMs', performance.now() - pendingZoomCrispT0);
    pendingZoomCrispT0 = null;
  }

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
        },
        interactionLatency: perfSummary()
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
    // T1-01 clobber guard: deferred App.* lookup (features/restore-last-session.js
    // registers after app.js, per the registry load-order rule).
    isRestorePromptPending: () => !!(window.App && window.App.isRestorePromptPending && window.App.isRestorePromptPending()),
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

  // SECTION: [sync] Field-error telemetry
  // Save/sync failures arrive richly instrumented via the Save Status
  // envelope, but a plain JS exception in the field (a handler throwing on an
  // odd project) used to vanish silently — "it just stopped working" reports
  // came with nothing. These hooks ride the SAME rails: client_error /
  // client_unhandled_rejection events land in the saveStatusLog and export
  // with the envelope. Deduped by kind+message and capped per session so a
  // throw-in-a-loop can't flood the log (the log window prunes anyway; the cap
  // keeps the envelope's tail useful). pushSaveEvent already drops everything
  // when Supabase is disabled — cloud users are who export envelopes, so
  // that's the right gate to inherit. Never rethrows, never preventDefaults:
  // the console still shows the original error.
  const CLIENT_ERROR_CAP = 10;
  const clientErrorSeen = new Set();
  let clientErrorCount = 0;
  function reportClientError(kind, message, stack, source) {
    try {
      const msg = String(message || 'unknown').slice(0, 300);
      const dedupeKey = kind + '|' + msg;
      if (clientErrorSeen.has(dedupeKey) || clientErrorCount >= CLIENT_ERROR_CAP) return;
      clientErrorSeen.add(dedupeKey);
      clientErrorCount++;
      pushSaveEvent(kind, msg, JSON.stringify({
        source: String(source || '').slice(0, 200),
        stack: String(stack || '').slice(0, 1500),
        capped: clientErrorCount >= CLIENT_ERROR_CAP ? 'last reported this session' : undefined,
      }));
      // Mirror to the server-side activity feed (signed-in only — logUserEvent
      // gates itself) so field crashes show up PROACTIVELY in the admin User
      // Activity view instead of waiting for a user to export their envelope.
      // Message + source only; the stack stays client-side in the envelope.
      // The dedupe + session cap above already bound the volume.
      logUserEvent(kind, state.currentProjectId || null, {
        message: msg,
        source: String(source || '').slice(0, 200),
      });
    } catch (_) { /* telemetry must never become its own error source */ }
  }
  window.addEventListener('error', (e) => {
    // Resource-load errors (img/script) surface here with no .error — skip
    // them; the SW/network layer owns those stories.
    if (!e || (!e.error && !e.message)) return;
    reportClientError('client_error', e.message, e.error && e.error.stack, (e.filename || '') + ':' + (e.lineno || 0));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    reportClientError('client_unhandled_rejection', (r && r.message) || String(r), r && r.stack, 'promise');
  });
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
  function pushUndoSnapshot() {
    const t0 = performance.now();
    const r = undoStackModel.pushUndoSnapshot();
    notePerfSample('undoSnapshotMs', performance.now() - t0);
    return r;
  }
  // Page-scoped snapshot for high-frequency page-local mutations (placements,
  // drops, notes): O(current page) instead of O(project). Cascade operations
  // (group/room deletes, imports, canvas repair) must keep pushUndoSnapshot.
  function pushUndoSnapshotCurrentPage() {
    const t0 = performance.now();
    const r = undoStackModel.pushUndoSnapshotPage(state.currentPage);
    notePerfSample('undoSnapshotMs', performance.now() - t0);
    return r;
  }
  // The one undo choke point (Ctrl+Z + the bottom-bar button): a successful
  // undo toasts how many are left so the 50-step ceiling is never a surprise.
  function undo() {
    const applied = undoStackModel.undo();
    if (applied) {
      const left = undoStackModel.undoDepth();
      showToast(left + (left === 1 ? ' undo left' : ' undos left'), 1000);
    }
    return applied;
  }
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
    state.localPdfHash = null;
    state.projectOwnerId = null;
    state.lastSavedAt = null;
    saveEngine.resetLocalBackupState();
    lastSaveIncludedPdf = false;
    state.pendingCanvasLoad = null;
    state.groups = [];
    state.groupsEnabled = false;
    state.rooms = [];
    state.maxZoom = null;
    state.activeCanvasIdByPage = {};
    // Unconditional: this reset doubles as the SIGN-OUT wipe, so Quick Key
    // bindings (and their artboard-seed lineage flag) never leak to the next
    // user on a shared machine. The seed survives the normal new-bid flow
    // (sign in -> upload PDF), which never passes through here.
    state.numberKeyBindings = {};
    state.numberKeyBindingsSeededFromArtboard = false;
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
    if (App.onLastSessionRestoreReset) App.onLastSessionRestoreReset();
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
    try { state.supabaseSession = null; state.isAdmin = false; state.isOverseer = false; state.isDigitalTwin = false; } catch (_) {}
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

  // doRestoreLastProject moved to features/restore-last-session.js (the
  // last-session restore flow); boot hands the candidate over via
  // App.openLastSessionRestorePrompt.
  // SECTION: Math & Format Helpers
  // Pure geometry/parse primitives (ptDist, snapLineToAngle, polylineDistance,
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
  // Split total { feet, px } — the T1-05 rollup primitive: feet for lines with a
  // usable effective scale, raw PDF-pts for the rest. Exactly one bucket is
  // non-zero per line; rollup surfaces must never add the buckets together.
  function getLineLengthSplitForTotals(line, pageIdx, isPoly, ann) {
    return lineLengthSplitForTotals(line, isPoly, ann, getPageScale(pageIdx), lineTypeForLine(line));
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
  window.getLineLengthSplitForTotals = getLineLengthSplitForTotals;

  // countItemsInRect / collectItemsToDeleteInRect / the Delete Area splice
  // core moved to annotation-model.js (node-tested there); performDeleteZone
  // keeps the UI choreography around the model's deleteCollectedItems.
  function countItemsInRect(ann, pageIdx, x1, y1, x2, y2) { return annotationModel.countItemsInRect(ann, pageIdx, x1, y1, x2, y2); }
  function collectItemsToDeleteInRect(ann, pageIdx, x1, y1, x2, y2) { return annotationModel.collectItemsToDeleteInRect(ann, pageIdx, x1, y1, x2, y2); }
  function performDeleteZone(ann, collected) {
    pushUndoSnapshot();
    annotationModel.deleteCollectedItems(ann, collected);
    markProjectDirty();
    renderAnnotations();
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

  // rotateAnnotations / applyRotationDeltaToAnnotations / deepCopyAnnotations
  // moved to annotation-model.js (node-tested 4x90-degree round trips there).
  function rotateAnnotations(page, w, h) { return annotationModel.rotateAnnotations(page, w, h); }
  function applyRotationDeltaToAnnotations(page, deltaDegrees) { return annotationModel.applyRotationDeltaToAnnotations(page, deltaDegrees); }
  function deepCopyAnnotations(ann) { return annotationModel.deepCopyAnnotations(ann); }
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
    renderPdf();   // rotation changes the raster — NOT an annotation-only edit
    updateUI();
  }

  // Pure wrap core moved to format.js (wrapNoteTextCore, node-tested); this
  // wrapper supplies the canvas-backed text measurer. Same signature as ever
  // (App.wrapNoteText / the render + hit-test callers are unchanged).
  let _measureCanvas = null;
  function wrapNoteText(text, maxWidth, font, lineHeight) {
    if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
    const ctx = _measureCanvas.getContext('2d');
    ctx.font = font || '14px DM Sans';
    return wrapNoteTextCore(text, maxWidth, lineHeight, (s) => ctx.measureText(s).width);
  }
  function getClientCoords(e) {
    if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  const canvasContainer = document.getElementById('canvasContainer');
  const pdfCanvas = document.getElementById('pdfCanvas');
  const cropCanvas = document.getElementById('cropCanvas');
  const annCanvas = document.getElementById('annCanvas');
  // Low-latency presentation hint: desynchronize these canvases from the
  // compositor's vsync queue (Chrome honors it; others ignore it). Must be
  // the FIRST getContext call per canvas — every later plain getContext('2d')
  // returns this same context.
  try {
    if (pdfCanvas) pdfCanvas.getContext('2d', { desynchronized: true });
    if (cropCanvas) cropCanvas.getContext('2d', { desynchronized: true });
    if (annCanvas) annCanvas.getContext('2d', { desynchronized: true });
  } catch (_) { /* hint only */ }
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
  // The zoom the pdfCanvas BUFFER represents. state.zoom stays continuous
  // (Wendi's ask); when a commit is served from a cached ladder-rung bitmap,
  // the buffer is at the rung and CSS scales the <=7% residual — so every
  // buffer-space consumer (toCanvas, the overlay env, the aim loupe blits)
  // must use THIS, never state.zoom. Refreshed by every renderPdf paint.
  let currentRenderZoom = 1;
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

  function toCanvas(p) { const scale = currentRenderZoom * currentEffDpr; return { x: p.x * scale, y: p.y * scale }; }   // buffer space — currentRenderZoom, NOT state.zoom (rung blits)

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
    // T2-03: hide-marks means the sheet is read-only-bare — invisible marks
    // must not catch the mouse. Mirrors renderAnnotations' early return.
    if (state.hideMarks) return null;
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

  // The status-bar / footer-totals cluster (invalidateFooterTotals,
  // computeFooterTotals, getFooterTotalsCached, updateStatus,
  // getCloudSaveSummary, updateSaveStatusIndicator) moved to
  // features/status-bar.js (window.App registry) — it was always DOM chrome
  // over state + save-engine getters, misfiled under Math & Format Helpers.
  // The same-named wrappers below keep every app.js call site and the
  // save-engine ctx entries frozen; they read window.App at call time
  // (deferred — the registry object is created near the tail), and a
  // boot-time call before the feature file loads is a no-op that self-heals
  // on the next updateUI (the lines-list seam). New publish-only deps in the
  // registry block: formatSaveTime(Parts), formatAgo, getLastSaveIncludedPdf,
  // and the engine getter passthroughs.
  function invalidateFooterTotals() { const A = window.App; A && A.invalidateFooterTotals && A.invalidateFooterTotals(); }
  function updateStatus() { const A = window.App; A && A.updateStatus && A.updateStatus(); }
  function updateSaveStatusIndicator() { const A = window.App; A && A.updateSaveStatusIndicator && A.updateSaveStatusIndicator(); }

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
  // The bitmap-cache substrate — page-bitmap LRU, downsample pyramid,
  // persisted zoom rungs, idle prefetch, and the full-document warm-up walk —
  // lives in pdf-tile-cache.js (createPdfTileCache; stage 1 of the
  // pdf-tile-cache extraction — the Sharp crop tile / tile grid below is a
  // later stage). ctx entries are live-value accessors so reassigned lets
  // (renderAreaSafety, pdfRenderTask, lastPaintedPdfPage,
  // zoomGestureDirection) and the later-declared renderService const are
  // resolved at call time, never captured. The same-named thin wrappers below
  // keep every call site and the App registry / __debug seams frozen.
  const pdfTileCache = createPdfTileCache({
    getState: () => state,
    getMaxZoom: () => getMaxZoom(),
    getCanvasCaps: () => getCanvasCaps(),
    getRenderAreaSafety: () => renderAreaSafety,
    renderAreaSafetyMax: RENDER_AREA_SAFETY_MAX,
    effectiveDpr: (page, zoom) => effectiveDpr(page, zoom),
    getMarkedPageIndices: () => getMarkedPageIndices(),
    renderPdf: (opts) => renderPdf(opts),
    getRenderService: () => renderService,
    getCropCanvas: () => cropCanvas,
    getWrapper: () => cWrapper,
    getPdfCanvas: () => pdfCanvas,
    getCurrentEffDpr: () => currentEffDpr,
    getLastRenderedZoom: () => lastRenderedZoom,
    isRenderInFlight: () => !!pdfRenderTask,
    getLastPaintedPdfPage: () => lastPaintedPdfPage,
    getZoomGestureDirection: () => zoomGestureDirection,
  });
  // renderPdf's cache accounting increments .hits/.misses on this shared
  // object (never reassigned — a direct reference is safe).
  const pdfBitmapCacheStats = pdfTileCache.stats;
  function pdfBitmapCacheGet(...a) { return pdfTileCache.pdfBitmapCacheGet(...a); }
  function pdfBitmapCacheGetAnyZoom(...a) { return pdfTileCache.pdfBitmapCacheGetAnyZoom(...a); }
  function pdfBitmapCacheDrop(...a) { return pdfTileCache.pdfBitmapCacheDrop(...a); }
  function pdfBitmapCacheCapture(...a) { return pdfTileCache.pdfBitmapCacheCapture(...a); }
  function clearPdfBitmapCache() { return pdfTileCache.clearPdfBitmapCache(); }
  function cancelPdfBitmapPrefetch() { return pdfTileCache.cancelPdfBitmapPrefetch(); }
  function schedulePdfBitmapPrefetch(delayMs) { return pdfTileCache.schedulePdfBitmapPrefetch(delayMs); }
  function maybeRestorePersistedRungs(page) { return pdfTileCache.maybeRestorePersistedRungs(page); }

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
  // SECTION: Sharp crop tile (deep-zoom sharpening + window-first commits)
  // Stage 2 of the pdf-tile-cache extraction: the crop tile (idle deep-zoom
  // sharpening + window-first cold commits) and the deep-zoom tile-grid
  // compositor moved into pdf-tile-cache.js alongside the bitmap cache.
  // The same-named wrappers below keep renderPdf's and the event handlers'
  // call sites frozen; renderCropTile keeps its ({force, onDone}) contract.
  function clearCropTile() { return pdfTileCache.clearCropTile(); }
  function scheduleCropTile() { return pdfTileCache.scheduleCropTile(); }
  function renderCropTile(options) { return pdfTileCache.renderCropTile(options); }
  function schedulePdfExactRefine(forZoom) { return pdfTileCache.schedulePdfExactRefine(forZoom); }

  // SECTION: PDF Rendering
  // T1-05: the Set-Scale gate only ran at tool-arm; an armed line tool page-
  // flipped onto an unscaled sheet kept placing px-measured lines. Re-check on
  // every page change (renderPdf is the sink for all ~10 nav entry points).
  let scaleGatePage = -1;
  function recheckScaleGateOnPageSwitch() {
    if (state.currentPage === scaleGatePage) return;
    scaleGatePage = state.currentPage;
    const gated = { [TOOL.LINE]: 'Quick Line', [TOOL.POLYLINE]: 'Polyline',
      [TOOL.MEASURE]: 'Measure', [TOOL.SCALE_ZONE]: 'Scale Zone', [TOOL.ROOM]: 'Room Sizer',
      [TOOL.CHAIN]: 'Chain' };
    const toolName = gated[state.tool];
    if (!toolName || !state.pages.length || getPageScale(state.currentPage)) return;
    // Same reset as the Move button (the #moveBtn onclick): drop to Move + clear starts.
    state.tool = TOOL.NONE;
    state.quickLineStart = null; state.scaleZoneStart = null; state.roomBoxStart = null; state.chainStart = null;
    if (state.scalePointA || state.scalePointB) { state.scalePointA = null; state.scalePointB = null; state.scaleMode = SCALE_MODES.NONE; }
    showSetScaleFirstToast(toolName);
    logUserEvent('unscaled_ft_block', state.currentProjectId || null, { surface: 'page-switch' });
    updateUI();
  }
  function renderPdf(opts) {
    const exactOnly = !!(opts && opts.exactOnly);   // idle exact-refine: skip the rung fallback
    pdfTileCache.cancelPdfExactRefine();
    cancelPdfBitmapPrefetch();   // real rendering always preempts speculation
    // Tile handling: a tile that matches the CURRENT target (page, rotation,
    // zoom) stays up through the raster — that's the window-first commit
    // showing sharp pixels while the slow full-page raster runs. Anything
    // else (page flip, rotate, another zoom) is stale and cleared.
    {
      const tp = state.pages[state.currentPage];
      const ctk = pdfTileCache.getCropTileKey();
      const keep = tp && tp.pdfPage && ctk &&
        ctk.pdfPage === tp.pdfPage && ctk.rot === (tp.rotation ?? 0) &&
        Math.abs(ctk.zoom - state.zoom) < 1e-9;
      if (!keep) clearCropTile();
      else pdfTileCache.clearCropTileTimer();
    }
    const page = state.pages[state.currentPage];
    recheckScaleGateOnPageSwitch();   // T1-05: armed line tools drop to Move on unscaled sheets
    if (page && page.pdfPage) maybeRestorePersistedRungs(page);   // lazy cross-session warm-up (Set-guarded)
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
    // Capture the cache-key tuple NOW: rotation/pdfPage/zoom can all change
    // while the async raster runs (undo rewrites rotation in place,
    // prepare-pdf rebinds pdfPage, queued interactions move zoom/page). The
    // completion callback must only trust these captured values — reading
    // state.* at completion time would poison the cache after a cancel-lost
    // race (task settles before cancel() lands).
    const keyPdfPage = page.pdfPage;
    const keyRot = page.rotation ?? 0;
    const keyZoom = state.zoom;                      // the DISPLAY zoom (continuous)
    const eff = effectiveDpr(page, keyZoom);         // clamped dpr so the buffer fits the canvas cap
    currentEffDpr = eff;
    const scale = keyZoom * eff;
    const viewport = keyPdfPage.getViewport({ scale, rotation: keyRot });

    // Cache lookup ladder: the EXACT display zoom first; failing that, the
    // nearest ladder rung — a rung bitmap serves any display zoom within
    // ~7% via CSS residual scaling (state.zoom stays continuous; the ladder
    // is raster currency only). A rung blit schedules an idle exact-refine
    // so the view still lands pixel-perfect once the user settles.
    let cached = pdfBitmapCacheGet(keyPdfPage, keyRot, keyZoom, eff);
    let blitZoom = keyZoom;
    let blitEff = eff;
    if (!cached && !exactOnly) {
      const rung = snapZoomToRung(keyZoom, 0.2, getMaxZoom());
      if (Math.abs(rung - keyZoom) > 1e-9) {
        const effR = effectiveDpr(page, rung);
        const c2 = pdfBitmapCacheGet(keyPdfPage, keyRot, rung, effR);
        if (c2) { cached = c2; blitZoom = rung; blitEff = effR; }
      }
    }
    if (cached) {
      lastRenderedZoom = keyZoom;
      lastPaintedPdfPage = keyPdfPage;
      lastPaintedRot = keyRot;
      currentEffDpr = blitEff;
      currentRenderZoom = blitZoom;
      updateContainerTransform();
      pdfCanvas.width = cached.w;
      pdfCanvas.height = cached.h;
      // CSS box always represents the DISPLAY zoom; a rung buffer carries a
      // <=7% residual scale here (buffer px = pagePts·rung·eff, CSS px =
      // pagePts·display).
      pdfCanvas.style.width = (cached.w / blitEff) * (keyZoom / blitZoom) + 'px';
      pdfCanvas.style.height = (cached.h / blitEff) * (keyZoom / blitZoom) + 'px';
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
      noteZoomCrispPaint();
      // The base at this display zoom just painted: a tile authored against a
      // DIFFERENT base zoom is now in the wrong container units — retire it.
      { const ctk = pdfTileCache.getCropTileKey();
        if (ctk && ctk.baseZoom !== lastRenderedZoom) clearCropTile(); }
      renderAnnotations();
      schedulePdfBitmapPrefetch();
      scheduleCropTile();
      if (Math.abs(blitZoom - keyZoom) > 1e-9) schedulePdfExactRefine(keyZoom);   // rung blit -> settle crisp when idle
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
    currentRenderZoom = keyZoom;   // the raster below is exact — buffer will be display-zoom space
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
    } else if (pdfCanvas.width > 0 && lastPaintedPdfPage &&
               (lastPaintedPdfPage !== keyPdfPage || lastPaintedRot !== keyRot)) {
      // Truly cold flip: nothing of the TARGET page is cached at any zoom and
      // the canvas is showing a DIFFERENT sheet. Leaving the old sheet up for
      // the whole raster shows the WRONG drawing for seconds on dense pages
      // and reads as "it ignored my click" — clear to paper-white immediately
      // (the new page's annotations paint over it below as the response).
      // Deliberately does NOT stamp lastPainted*: the canvas is a placeholder,
      // so the restore-retrigger and stale-blit logic still treat it as stale
      // and repaint the moment real pixels (pyramid restore / raster) arrive.
      updateContainerTransform();
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      pdfCanvas.style.width = viewport.width / eff + 'px';
      pdfCanvas.style.height = viewport.height / eff + 'px';
      const wctx = pdfCanvas.getContext('2d');
      wctx.fillStyle = '#ffffff';
      wctx.fillRect(0, 0, viewport.width, viewport.height);
      renderAnnotations();
    }

    if (!pdfOffscreenCanvas) pdfOffscreenCanvas = document.createElement('canvas');
    pdfOffscreenCanvas.width = viewport.width;
    pdfOffscreenCanvas.height = viewport.height;
    pdfRenderTask = renderService.raster({ pdfPage: keyPdfPage, scale, rotation: keyRot, canvasContext: pdfOffscreenCanvas.getContext('2d'), kind: 'full' });
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
      noteZoomCrispPaint();
      // The crisp base at this zoom just painted: a commit tile authored
      // against the OLD base zoom is now in the wrong container units and no
      // longer needed — retire it (the deficit path re-tiles via the
      // schedule below when the base is clamped soft).
      { const ctk = pdfTileCache.getCropTileKey();
        if (ctk && ctk.baseZoom !== lastRenderedZoom) clearCropTile(); }
      renderAnnotations();
      schedulePdfBitmapPrefetch();
      scheduleCropTile();
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

  // drawDropMarker moved to canvas-draw.js (pure; read by bare name).

  // The annotation draw core lives in canvas-draw.js (createCanvasDraw) —
  // instantiated once with live-value accessor arrows (the save-engine seam
  // recipe). Same-named thin wrappers keep call sites and contracts frozen.
  // Every pdf.js raster (full page / prefetch / crop tile) goes through this
  // seam — main-thread today, the render worker when available (option 4).
  const renderService = createRenderService({
    logEvent: (type, msg, detail) => { try { pushSaveEvent(type, msg, detail); } catch (_) { /* log ring not up yet */ } },
    // A worker fallback silently degrades the whole session to main-thread
    // rasters — mirror it into the admin activity feed (same idea as
    // reportClientError) so it's visible without a user-exported log.
    onFallback: (reason) => {
      try {
        logUserEvent('render_worker_fallback', state.currentProjectId || null, {
          message: String(reason).slice(0, 300), source: 'render-service',
        });
      } catch (_) { /* telemetry only */ }
    },
  });
  const canvasDraw = createCanvasDraw({
    getState: () => state,
    getEffectiveScaleForLine: (ann, line, isPoly, pageIdx) => getEffectiveScaleForLine(ann, line, isPoly, pageIdx),
    getLineRealWorldLength: (line, pageIdx, isPoly, ann) => getLineRealWorldLength(line, pageIdx, isPoly, ann),
    formatDistFeetInchesFromReal: (realLen, sc) => formatDistFeetInchesFromReal(realLen, sc),
    getGroupColor: (gid) => getGroupColor(gid),
    wrapNoteText: (text, maxWidth, font, lineHeight) => wrapNoteText(text, maxWidth, font, lineHeight),
    getNoteRotationRad: (n, page) => getNoteRotationRad(n, page),
    iconRenderVb: (iconPath) => iconRenderVb(iconPath),
    iconRenderCenter: (iconPath) => iconRenderCenter(iconPath),
    getPageScale: (pi) => getPageScale(pi),
    getLineLengthFeetForTotals: (line, pageIdx, isPoly, ann) => getLineLengthFeetForTotals(line, pageIdx, isPoly, ann),
    getLineLengthSplitForTotals: (line, pageIdx, isPoly, ann) => getLineLengthSplitForTotals(line, pageIdx, isPoly, ann),
    formatDropLabel: (value, unit) => formatDropLabel(value, unit),
  });

  function renderAnnotations() {
    const t0 = performance.now();
    renderAnnotationsInner();
    notePerfSample('renderAnnotationsMs', performance.now() - t0);
  }
  function renderAnnotationsInner() {
    const page = state.pages[state.currentPage];
    if (!page) return;
    currentEffDpr = effectiveDpr(page, state.zoom);   // match the (possibly clamped) pdfCanvas buffer
    annCanvas.width = pdfCanvas.width;
    annCanvas.height = pdfCanvas.height;
    annCanvas.style.width = pdfCanvas.style.width;
    annCanvas.style.height = pdfCanvas.style.height;
    const ctx = annCanvas.getContext('2d');
    const z = currentRenderZoom;   // buffer space (rung blits render at the rung, CSS carries the residual)
    ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
    // Hide-marks mode: the overlay is sized + cleared (so the bare PDF shows
    // through) but nothing is painted on it. Toggle via the header eye button.
    if (state.hideMarks) return;
    // Show-canvases peek (the opposite of hide-marks): draw the page's layers
    // merged instead of just the active canvas — every layer, or only the
    // right-click-chosen subset in state.peekCanvasIdsByPage (active always
    // included). Purely visual — hit testing / editing / exports still target
    // the active canvas only.
    const ann = state.showAllCanvases
      ? getMergedAnnotationsForPage(page, state.peekCanvasIdsByPage[state.currentPage] || null)
      : getActiveAnnotations(page);
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
    // Persisted marks paint through the unified core in canvas-draw.js; the
    // env carries the live path's sizing rules (constant-screen-weight line
    // width, raw chrome sizes, zoom*DPR font scale, selection glow, note
    // handles). The lts/lw/lo consts stay for the in-progress previews below.
    const lts = state.lineTypeSettings || { opacity: 1, lineSize: 2, dropXSize: 10, dropIconStyle: 'circle', parallelEndsSize: 10, lengthLabelSize: 12, snapToHorizontalVertical: false, showOnlyLineTypesOnCurrentPage: false };
    const lw = lts.lineSize || 2;
    const lo = lts.opacity != null ? lts.opacity : 1;
    const cs = state.counterSettings || { size: 22, opacity: 1, showRings: false, numberSize: 10, ringSize: 1, ringOpacity: 1, ringSolid: true, outlineSize: 0, showOnlyCountersOnCurrentPage: false };
    const sel = state.selectedLineId && state.currentPage === state.selectedLinePageIdx;
    // Ghosts paint UNDER the real marks: they are reference scaffolding, and
    // the takeoff has to stay readable on top of its own stencil. The ghost
    // being positioned (placingGhost) rides the cursor and is drawn from the
    // same list, so drop is just "move it into ann.ghosts".
    const ghostEnv = {
      tc: toCanvas,
      page,
      pageIdx: state.currentPage,
      lineWidth: lw,
      lineOpacity: lo,
      dropSize: lts.dropXSize ?? 10,
      dropStyle: lts.dropIconStyle ?? 'circle',
      fontScale: z * currentEffDpr,
      labelPad: 4,
      dotRadius: 4,
      counterSize: cs.size ?? 22,
      counterOutline: cs.outlineSize != null ? cs.outlineSize : 0,
      counterNumberSize: cs.numberSize || 10,
      fontFamily: 'DM Sans',
      ghostBounds: (g) => annotationModel.ghostBounds(g),
      ghostActiveId: state.placingGhost ? state.placingGhost.id : state.activeGhostId,
      ghostAlpha: GHOST_ALPHA,
    };
    if ((ann.ghosts || []).length) canvasDraw.drawGhosts(ctx, ann, ghostEnv);
    if (state.placingGhost) canvasDraw.drawGhosts(ctx, { ghosts: [state.placingGhost] }, ghostEnv);
    canvasDraw.drawAnnotationsCore(ctx, ann, {
      tc: toCanvas,
      page,
      pageIdx: state.currentPage,
      lineWidth: lw,
      lineOpacity: lo,
      dropSize: lts.dropXSize ?? 10,
      dropStyle: lts.dropIconStyle ?? 'circle',
      fontScale: z * currentEffDpr,
      labelPad: 4,
      dotRadius: 4,
      counterSize: cs.size ?? 22,
      counterOutline: cs.outlineSize != null ? cs.outlineSize : 0,
      counterNumberSize: cs.numberSize || 10,
      fontFamily: 'DM Sans',
      selection: sel ? { id: state.selectedLineId, isPoly: state.selectedLineIsPoly } : null,
      drawNoteHandles: true,
      showDropSizes: !!state.showDropSizes,   // the "Drop sizes" toggle (features/drop-peek.js); live overlay only
    });
    if (state.quickLineStart && state.mousePos) {
      const lt = state.lineTypes.find(l => l.id === state.activeLineTypeId);
      const aPdf = state.quickLineStart;
      let bPdf = state.mousePos;
      if (lts.snapToHorizontalVertical) bPdf = snapLineToAngle(aPdf.x, aPdf.y, bPdf.x, bPdf.y);
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
    if (state.tool === TOOL.CHAIN && state.chainStart && state.chainStart.page === state.currentPage && state.mousePos) {
      // Chain rubber band: anchor (last placed counter) -> cursor, in the
      // selected line type's color, honoring the 45° snap toggle.
      const lt = state.lineTypes.find(l => l.id === state.activeLineTypeId);
      const aPdf = state.chainStart;
      let bPdf = state.mousePos;
      if (lts.snapToHorizontalVertical) bPdf = snapLineToAngle(aPdf.x, aPdf.y, bPdf.x, bPdf.y);
      const a = toCanvas(aPdf), b = toCanvas(bPdf);
      ctx.strokeStyle = lt?.color || '#4a9eff'; ctx.lineWidth = lw; ctx.globalAlpha = lo; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    if (state.tool === TOOL.DROP) {
      // Drop tool armed: every line end on the page becomes a labeled target
      // ring (features/drop-mode.js draws them so the node math lives once).
      App.drawDropNodesOverlay && App.drawDropNodesOverlay(ctx);
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
      // Literal hex, not 'var(--red)': canvas 2D can't resolve CSS variables,
      // so an invalid strokeStyle silently keeps the previous color. Mirror of
      // styles.css :root --red.
      ctx.strokeStyle = '#e85447'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
    }
    if (state.tool === TOOL.GHOST && state.ghostRectStart && state.mousePos) {
      const minX = Math.min(state.ghostRectStart.x, state.mousePos.x), maxX = Math.max(state.ghostRectStart.x, state.mousePos.x);
      const minY = Math.min(state.ghostRectStart.y, state.mousePos.y), maxY = Math.max(state.ghostRectStart.y, state.mousePos.y);
      const tl = toCanvas({ x: minX, y: minY }), br = toCanvas({ x: maxX, y: maxY });
      ctx.strokeStyle = '#e8c547'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
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
          pmPdf = snapLineToAngle(prev.x, prev.y, pmPdf.x, pmPdf.y);
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
      const scale = currentRenderZoom * currentEffDpr;
      canvasDraw.drawLegend(ctx, page, state.currentPage, ann, scale, toCanvas);
    }
    if (state.showGridOverlay) {
      const scale = currentRenderZoom * currentEffDpr;
      canvasDraw.drawGrid(ctx, page, state.currentPage, scale, toCanvas);
    }
  }

  function renderAnnotationsToContext(ctx, page, scale, exportOverrides, annotationsOverride) {
    const tc = (p) => ({ x: p.x * scale, y: p.y * scale });
    const ann = annotationsOverride ?? getActiveAnnotations(page);
    const pageIdx = state.pages.indexOf(page);
    const pi = pageIdx >= 0 ? pageIdx : 0;
    const lts = state.lineTypeSettings || { opacity: 1, lineSize: 2, dropXSize: 10, dropIconStyle: 'circle', parallelEndsSize: 10, lengthLabelSize: 12, snapToHorizontalVertical: false, showOnlyLineTypesOnCurrentPage: false };
    const cs = state.counterSettings || { size: 22, opacity: 1, showRings: false, numberSize: 10, ringSize: 1, ringOpacity: 1, ringSolid: true, outlineSize: 0, showOnlyCountersOnCurrentPage: false };
    const lineScale = exportOverrides?.lineScale ?? 1;
    const markerScale = exportOverrides?.markerScale ?? 1;
    canvasDraw.drawAnnotationsCore(ctx, ann, {
      tc,
      page,
      pageIdx: pi,
      lineWidth: (lts.lineSize || 2) * scale * lineScale,
      lineOpacity: lts.opacity != null ? lts.opacity : 1,
      dropSize: (lts.dropXSize ?? 10) * scale,
      dropStyle: lts.dropIconStyle ?? 'circle',
      fontScale: scale,
      labelPad: 4 * scale,
      dotRadius: 4 * scale,
      counterSize: (cs.size || 22) * scale * markerScale,
      counterOutline: (cs.outlineSize != null ? cs.outlineSize : 0) * scale * markerScale,
      counterNumberSize: (cs.numberSize || 10) * scale * markerScale,
      fontFamily: 'sans-serif',
      selection: null,
      drawNoteHandles: false,
    });
    if (state.showLegendOverlay) {
      if (!ann.legend) {
        const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
        ann.legend = { x: vp.width - 110, y: 16, w: 100, h: 56 };
      }
      canvasDraw.drawLegend(ctx, page, pageIdx, ann, scale, tc);
    }
  }

  // hexToRgb moved to canvas-draw.js (pure; read by bare name).
  // drawLegend moved to canvas-draw.js (canvasDraw.drawLegend).

  // lineStyleToDash moved to canvas-draw.js (pure; read by bare name).
  // drawGrid moved to canvas-draw.js (canvasDraw.drawGrid).

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
    const t0 = performance.now();
    updateUIInner();
    // Defensive core->feature callback: the header "⋯ More tools" overflow
    // (features/header-more.js) re-syncs its button/menu active state after
    // every UI reconcile.
    App.onHeaderMoreSync && App.onHeaderMoreSync();
    notePerfSample('updateUIMs', performance.now() - t0);
  }
  // N3: rapid mark placement must never rebuild the sidebar per click — the
  // canvas repaint is immediate, the sidebar/totals catch up ~120ms later.
  let updateUITimer = null;
  function scheduleUpdateUI() {
    if (updateUITimer) return;   // trailing debounce
    updateUITimer = setTimeout(() => { updateUITimer = null; updateUI(); }, 120);
  }
  function updateUIInner() {
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
      const esc = escapeHtml;
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
        const esc = escapeHtml;
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
    const ghostBtn = document.getElementById('ghostBtn');
    if (ghostBtn) ghostBtn.classList.toggle('active', state.tool === TOOL.GHOST);
    const deleteZoneBtn = document.getElementById('deleteZoneBtn');
    if (deleteZoneBtn) deleteZoneBtn.classList.toggle('active', state.tool === TOOL.DELETE_ZONE);
    const roomBtnEl = document.getElementById('roomBtn');
    if (roomBtnEl) roomBtnEl.classList.toggle('active', state.tool === TOOL.ROOM);
    const chainBtnEl = document.getElementById('chainBtn');
    if (chainBtnEl) chainBtnEl.classList.toggle('active', state.tool === TOOL.CHAIN);
    // Defensive core->feature callback: features/chain.js re-syncs its palette
    // panel (show/hide + row selection) whenever the tool or palettes change.
    App.onChainToolSync && App.onChainToolSync();
    const dropBtnEl = document.getElementById('dropBtn');
    if (dropBtnEl) dropBtnEl.classList.toggle('active', state.tool === TOOL.DROP);
    // Same pattern for the Drop tool's size palette (features/drop-mode.js).
    App.onDropToolSync && App.onDropToolSync();
    App.onHighlightToolSync && App.onHighlightToolSync();
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
    syncSidebarFilterButton(counterShowOnlyInline, getCounterListFilterScope(), 'counters');
    syncSidebarFilterButton(lineTypeShowOnlyInline, getLineTypeListFilterScope(), 'line types');
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
      state.chainStart = null;
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
    const viewerHideIds = ['counterBtn', 'quickLine', 'polylineBtn', 'chainBtn', 'dropBtn', 'highlightBtn', 'multiplyZoneBtn', 'scaleZoneBtn', 'deleteZoneBtn', 'ghostBtn', 'noteBtn', 'legendBtn', 'legendBtnSidebar', 'undoBtn', 'redoBtn', 'counterBtnSidebar', 'quickLineSidebar', 'polylineBtnSidebar', 'highlightBtnSidebar', 'multiplyZoneBtnSidebar', 'scaleZoneBtnSidebar', 'deleteZoneBtnSidebar', 'noteBtnSidebar', 'doneEditing', 'doneEditingSidebar', 'clearPage', 'clearPageSidebar', 'exportBtn', 'exportBtnSidebar', 'importBtn', 'importBtnSidebar', 'saveProjectBtn', 'saveProjectBtnSidebar', 'addCounter', 'addLineType', 'addGroup', 'groupsSection', 'headerActiveCounter', 'headerActiveLineType', 'lineTypeSnapToHVHeaderBtn', 'plumBtn', 'plumLineBtn'];
    viewerHideIds.forEach(function(id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (state.isViewer) el.style.display = 'none';
      else if (id === 'doneEditing' || id === 'doneEditingSidebar') { /* keep tool-based display */ }
      else if (id === 'lineTypeSnapToHVHeaderBtn') { /* keep tool-based display from snap block */ }
      else el.style.display = '';
    });
    // Per-project Groups gate: hide the whole Groups section unless the
    // project opted in OR already contains groups (existing organized
    // takeoffs keep their section with no migration). Runs after the
    // viewer loop above so viewer mode still wins.
    const groupsSectionEl = document.getElementById('groupsSection');
    if (groupsSectionEl && !state.isViewer) groupsSectionEl.style.display = groupsUiVisible() ? '' : 'none';
    const useGroupsBtn = document.getElementById('settingsUseGroupsBtn');
    if (useGroupsBtn) {
      const hasGroups = (state.groups || []).length > 0;
      useGroupsBtn.setAttribute('aria-pressed', String(groupsUiVisible()));
      useGroupsBtn.disabled = hasGroups;
      useGroupsBtn.title = hasGroups
        ? 'This project has groups, so the Groups section stays on'
        : 'Show the Groups section and Assign-to-Group menus in this project';
    }
    updateHideMarksButton();
    App.updateDropSizesButton && App.updateDropSizesButton();   // features/drop-peek.js
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
      const bidBoardBtnSidebar = document.getElementById('bidBoardBtnSidebar');
      if (bidBoardBtnSidebar) bidBoardBtnSidebar.style.display = (loggedIn && (state.isOverseer || state.isAdmin)) ? '' : 'none';
      const settingsManageProjectsBtn = document.getElementById('settingsManageProjects');
      if (settingsManageProjectsBtn) settingsManageProjectsBtn.style.display = loggedIn && state.isAdmin ? '' : 'none';
      const globalReloadBtn = document.getElementById('advancedGlobalForceReload');
      if (globalReloadBtn) globalReloadBtn.style.display = (loggedIn && state.isAdmin) ? '' : 'none';
      const statusBarAuth = document.getElementById('statusBarAuth');
      if (statusBarAuth) { statusBarAuth.textContent = loggedIn ? (state.supabaseSession?.user?.email || 'Sign Out') : 'Sign In'; statusBarAuth.style.display = ''; }
      if (window.App?.renderTwinBanner) window.App.renderTwinBanner();
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
          span.textContent = (window.App?.twinEmailText ? window.App.twinEmailText(state.checkedOutEmail) : state.checkedOutEmail) + ' is editing';
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
        : 'Save Project to Cloud';
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
    App.renderPagesList && App.renderPagesList();
    App.renderCanvasSwitcher && App.renderCanvasSwitcher();
    App.renderCountersList && App.renderCountersList();
    const sidebarReorderBanner = document.getElementById('sidebarReorderBanner');
    const canReorder = state.counters.length >= 2 || state.lineTypes.length >= 2;
    if (sidebarReorderBanner) sidebarReorderBanner.style.display = (state.sidebarReorderModeActive && !state.isViewer && canReorder) ? 'flex' : 'none';
    document.body.classList.toggle('sidebar-reorder-mode-active', state.sidebarReorderModeActive);
    App.renderLineTypesList && App.renderLineTypesList();
    App.renderGroupsList && App.renderGroupsList();
    App.renderLinesList && App.renderLinesList();   // features/lines-list.js; boot-time no-op is fine (no project yet)
    App.renderSummary && App.renderSummary();
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
    // Cheap existence probes (report.js) — would the report/summary be
    // non-empty? Short-circuit at the first count, line, or room box instead
    // of building the whole summary (a real cost per updateUI on large
    // projects). Same load-order guard as the App.* checks above:
    // report.js loads after app.js, so this can run before it registers.
    const hasCountsOrLines = typeof window.getPipeToolingHasData === 'function' && window.getPipeToolingHasData();
    // Room Sizer boxes count as report data too: the report renders a "Room
    // Volumes" table and the email summary a "--- Rooms ---" block, so a
    // rooms-only takeoff still has something to show/export/copy. Only Copy
    // to /Tooling stays counts/lines-only — getPipeToolingSummary never emits
    // rooms, so on a rooms-only project it would copy an empty string.
    const hasRooms = typeof window.getReportHasRooms === 'function' && window.getReportHasRooms();
    const hasReportData = hasCountsOrLines || hasRooms;
    const ptBtn = document.getElementById('forPipeToolingDropdown');
    if (ptBtn) ptBtn.style.display = hasCountsOrLines ? '' : 'none';
    const copySummaryBtn = document.getElementById('copySummaryTextDropdown');
    if (copySummaryBtn) copySummaryBtn.style.display = hasReportData ? '' : 'none';
    const showReportDropdown = document.getElementById('showReportDropdown');
    if (showReportDropdown) showReportDropdown.style.display = hasReportData ? '' : 'none';
    const specificPagesBtn = document.getElementById('specificPages');
    if (specificPagesBtn) specificPagesBtn.style.display = hasReportData ? '' : 'none';
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

  // renderCanvasSwitcher (the footer canvas switcher: name label, (n/N)
  // index, pills, layers dropdown rows, show-all peek visibility) moved to
  // features/canvas-switcher.js (window.App registry) per the lines-list
  // recipe; updateUI reaches it defensively via App.renderCanvasSwitcher.

  // formatPageTitleStartEnd + renderPagesList (the sidebar Pages section:
  // truncated titles, scale/annotation badges, canvas-count badge, rename /
  // delete affordances) moved to features/pages-list.js (window.App registry)
  // per the lines-list recipe. updateUI reaches it defensively via
  // App.renderPagesList; features/page-settings.js consumes it via App.* at
  // call time. New publish-only deps: pageHasAnyAnnotations, startRename,
  // exitEditMode (registry block).

  /*
   * Selecting a counter / line type for placing. These are the ONE path: the
   * sidebar row click and the Quick Keys number hotkeys both call them, so the
   * toggle-off semantics (pressing the same target twice clears the selection),
   * the tool switch, and the pages-section collapse can't drift between the two
   * entry points. Published on App for features/quick-keys.js.
   */
  function collapsePagesSectionForPlacing() {
    state.pagesListCollapsed = true;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
  }
  function setActiveCounterType(id) {
    state.activeCounterType = state.activeCounterType === id ? null : id;
    state.tool = state.activeCounterType ? TOOL.COUNTER : TOOL.NONE;
    if (state.activeCounterType) collapsePagesSectionForPlacing();
    updateUI();
  }
  function setActiveLineType(id) {
    state.activeLineTypeId = state.activeLineTypeId === id ? null : id;
    state.tool = state.activeLineTypeId ? TOOL.LINE : TOOL.NONE;
    if (state.activeLineTypeId) { state.quickLineStart = null; collapsePagesSectionForPlacing(); }
    updateUI();
  }
  // T2-08: every line-type create surface hands the user the pen, exactly as
  // counter create (features/counter.js) and the picker's Create tab already do.
  function armLineToolAfterCreate() {
    if (!state.pages.length) return;          // palette prep, no plan open — nothing to draw on
    if (state.drawingPolyline) return;        // never abandon an in-flight polyline trace
    if (!getPageScale(state.currentPage)) { showSetScaleFirstToast('Quick Line'); return; }
    state.tool = TOOL.LINE;
    state.quickLineStart = null;
    collapsePagesSectionForPlacing();
  }

  // quickKeyBadgeHtml + renderCountersList + renderLineTypesList +
  // renderGroupsList + countItemsInGroup (the sidebar Counters / Line Types /
  // Groups section renderers) moved to features/sidebar-lists.js (window.App
  // registry) per the lines-list recipe. updateUI reaches them defensively via
  // App.render*List; quick-keys.js / counter-settings.js /
  // line-type-settings.js / item-details.js consume them via App.* at call
  // time. Row activation still funnels through setActiveCounterType /
  // setActiveLineType above (the ONE selection path).

  // renderLinesList (the sidebar Lines section: per-type grouping + totals,
  // expand/collapse, search, row selection/jump, swatch + Line Properties
  // openers) moved to features/lines-list.js (window.App registry) — the first
  // split out of the UI Render Functions region. updateUI reaches it
  // defensively via App.renderLinesList; the search/show-only handlers call it
  // plainly (user-action time). Five publish-only deps in the registry block.

  // renderSummary (the sidebar Summary section: per-group / flat rollups)
  // moved to features/summary-list.js (window.App registry) per the
  // lines-list recipe; updateUI reaches it defensively via App.renderSummary.

  // openSummaryCountDetailModal moved to features/summary-detail.js
  // (window.App registry); the renderSummary rows call it via App.*.
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
    renderAnnotations();
  }

  // SECTION: Modal primitives (showModal / hideModal)
  // Clamp-and-place a position:fixed popover: measure the (already-visible)
  // menu and route the desired top-left through the pure clampMenuPosition
  // (geometry.js) so it can never open off-screen. Callers show the menu
  // first (parked at left:-9999px so there's no flicker), then place it.
  function placeFixedMenu(el, left, top) {
    const p = clampMenuPosition(left, top, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight);
    el.style.left = p.left + 'px';
    el.style.top = p.top + 'px';
  }
  function showModal(id) { document.getElementById(id).classList.add('visible'); }
  function hideModal(id) {
    if (id === 'groupModal') App.onGroupModalHidden && App.onGroupModalHidden();
    if (id === 'authModal') App.onAuthMagicLinkReset && App.onAuthMagicLinkReset();
    if (id === 'counterLineTypeDetailsModal') App.onCounterLineTypeDetailsHidden && App.onCounterLineTypeDetailsHidden();
    if (id === 'canvasDetailsModal') App.onCanvasDetailsHidden && App.onCanvasDetailsHidden();
    if (id === 'deleteCanvasConfirmModal') App.onDeleteCanvasConfirmHidden && App.onDeleteCanvasConfirmHidden();
    if (id === 'summaryCountDetailModal') App.onSummaryCountDetailHidden && App.onSummaryCountDetailHidden();
    if (id === 'toolingScaleCheckModal') App.onToolingScaleCheckHidden && App.onToolingScaleCheckHidden();
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

  // Turn-in progress is a deliberate BLOCKING overlay (save + checkout release
  // in flight) with its own element — it is a progress state, not a toast, and
  // no longer shares #airboardToastModal with showToast (Tier-2 #15).
  let turnInProgressActive = false;
  function setTurnInProgress(label) {
    if (!label) {
      if (turnInProgressActive) hideModal('turnInProgressModal');
      turnInProgressActive = false;
      return;
    }
    const el = document.getElementById('turnInProgressText');
    if (el) el.textContent = 'Turn In: ' + label;
    showModal('turnInProgressModal');
    turnInProgressActive = true;
  }

  let setScaleFirstToastTimer = null;
  // The "Set Scale ⚖" words in the card are a real button (static markup in
  // app/index.html — T2-06); only the tail span changes per call, and the
  // longer 6s timer leaves time to actually reach the link.
  function showSetScaleFirstToast(toolName) {
    if (setScaleFirstToastTimer) clearTimeout(setScaleFirstToastTimer);
    const tail = document.getElementById('setScaleFirstTail');
    if (tail) tail.textContent = ' first to use ' + toolName + '.';
    showModal('setScaleFirstModal');
    setScaleFirstToastTimer = setTimeout(() => {
      hideModal('setScaleFirstModal');
      setScaleFirstToastTimer = null;
    }, 6000);
  }
  // Bound once: hide the toast, then open the Set Scale dialog (same no-plan
  // guard as the tool context menu's "Set / edit scale…" item; openScaleModal
  // is registered by features/scale.js — read from App at call time).
  const setScaleFirstLinkEl = document.getElementById('setScaleFirstLink');
  if (setScaleFirstLinkEl) setScaleFirstLinkEl.onclick = () => {
    if (setScaleFirstToastTimer) { clearTimeout(setScaleFirstToastTimer); setScaleFirstToastTimer = null; }
    hideModal('setScaleFirstModal');
    if (state.pages.length) App.openScaleModal(); else showToast('Open a plan first.', 2000);
  };
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
    const { data, error } = await supabase.from('user_airboard').select('counters, line_types, icon_names, icon_order, plumbing_modifiers, line_modifiers, number_key_bindings, custom_icon_paths').eq('user_id', user.id).maybeSingle();
    if (error) return null;
    if (!data) return null;
    return {
      // Dedupe on read: a corrupted artboard row (same id under several
      // renamed entries — the Wendi FD bug) is collapsed before it can seed
      // any project; the next saveUserAirboard writes it back clean.
      counters: dedupePaletteById(data.counters || []),
      lineTypes: dedupePaletteById(data.line_types || []),
      iconNames: (data.icon_names && typeof data.icon_names === 'object') ? data.icon_names : {},
      iconOrder: Array.isArray(data.icon_order) ? data.icon_order : null,
      plumbingModifiers: (data.plumbing_modifiers && typeof data.plumbing_modifiers === 'object') ? data.plumbing_modifiers : null,
      lineModifiers: (data.line_modifiers && typeof data.line_modifiers === 'object') ? data.line_modifiers : null,
      numberKeyBindings: (data.number_key_bindings && typeof data.number_key_bindings === 'object' && !Array.isArray(data.number_key_bindings)) ? data.number_key_bindings : null,
      // Feeds the (previously dead) `airboard.customIconPaths` checks at both
      // apply sites — the user's uploaded icon library now follows the account.
      customIconPaths: Array.isArray(data.custom_icon_paths) ? data.custom_icon_paths : null
    };
  }
  async function saveUserAirboard() {
    const user = state.supabaseSession?.user;
    if (!supabase || !user) return false;
    const payload = {
      user_id: user.id,
      counters: dedupePaletteById(state.counters || []),
      line_types: dedupePaletteById(state.lineTypes || []),
      icon_names: state.iconNames || {},
      icon_order: state.iconOrder || null,
      plumbing_modifiers: getPlumbingModifiers(),
      line_modifiers: getLineModifiers(),
      // Quick Keys ride the artboard so a standard palette carries its number
      // row into every new bid (column added 2026-07-24; requires the
      // user_airboard_number_key_bindings migration before this client deploys).
      number_key_bindings: state.numberKeyBindings || {},
      custom_icon_paths: getUserCustomIcons() || [],
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

  // Every surface that sets a line drop reports through here — the route field
  // ('modal', 'modal-recent', 'context-repeat', 'drop-tool', …) is what tells
  // us which entry path estimators actually use. value 0 = a cleared drop.
  function logDropSetEvent(value, unit, route) {
    logUserEvent('drop_set', state.currentProjectId, { value: value, unit: unit, route: route, pageIndex: state.currentPage });
  }

  // Commit a used drop size to the shared recent list (state.recentDrops,
  // persisted per device). nextRecentDrops is the pure core (recent-drops.js);
  // both consumers — the Line Properties chips and the Drop tool palette —
  // read the same list, so the two surfaces always offer the same sizes.
  function pushRecentDrop(value, unit) {
    state.recentDrops = nextRecentDrops(state.recentDrops, value, unit);
    try { localStorage.setItem('recentDrops', JSON.stringify(state.recentDrops)); } catch (_) {}
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
      const { data: profile } = await supabase.from('profiles').select('is_admin, is_digital_twin, is_overseer').eq('user_id', session.user.id).maybeSingle();
      state.isAdmin = !!profile?.is_admin;
      state.isOverseer = !!profile?.is_overseer;
      state.isDigitalTwin = !!profile?.is_digital_twin;
      startPresenceHeartbeat();
      maybeLogSessionStartOnce();
      checkGlobalForceReload();
      App.maybeAutoOpenBidBoard && App.maybeAutoOpenBidBoard();
    } else {
      lastAuthUserId = null;
      state.isAdmin = false;
      state.isOverseer = false;
      state.isDigitalTwin = false;
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
            const { data: profile } = await supabase.from('profiles').select('is_admin, is_digital_twin, is_overseer').eq('user_id', session.user.id).maybeSingle();
            state.isAdmin = !!profile?.is_admin;
            state.isOverseer = !!profile?.is_overseer;
            state.isDigitalTwin = !!profile?.is_digital_twin;
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
        const { data: profile } = await supabase.from('profiles').select('is_admin, is_digital_twin, is_overseer').eq('user_id', session.user.id).maybeSingle();
        state.isAdmin = !!profile?.is_admin;
        state.isOverseer = !!profile?.is_overseer;
        state.isDigitalTwin = !!profile?.is_digital_twin;
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
            // Fill-if-empty only: this auto-restore must never stomp a layout the
            // user already has going (e.g. a project restored before auth settled).
            App.seedQuickKeysFromArtboard && App.seedQuickKeysFromArtboard(airboard.numberKeyBindings);
          }
        }
        reconcileOrphanedCountersAndLineTypes();
        App.maybeAutoOpenBidBoard && App.maybeAutoOpenBidBoard();
      } else {
        stopPresenceHeartbeat();
        state.isAdmin = false;
        state.isOverseer = false;
        state.isDigitalTwin = false;
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
    renderAnnotations();
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
    state.chainStart = null;
    state.ghostRectStart = null;
    state.placingGhost = null;
    if (state.scalePointA || state.scalePointB) { state.scalePointA = null; state.scalePointB = null; state.scaleMode = SCALE_MODES.NONE; }
    state.activeCounterType = null;
    updateUI();
    renderAnnotations();
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
    // T2-08: exactly one line type — nothing to choose, arm it directly.
    if (state.lineTypes.length === 1) {
      state.activeLineTypeId = state.lineTypes[0].id;
      armLineToolAfterCreate();
      updateUI();
      return;
    }
    App.showChooseLineTypeModal();
  };
  document.getElementById('chainBtn').onclick = () => {
    if (!getPageScale(state.currentPage)) {
      showSetScaleFirstToast('Chain');
      return;
    }
    if (state.tool !== TOOL.CHAIN) {
      state.quickLineStart = null;
      state.highlightStart = null;
      state.multiplyZoneStart = null;
      state.scaleZoneStart = null;
      state.deleteZoneStart = null;
      state.roomBoxStart = null;
      state.chainStart = null;
      state.tool = TOOL.CHAIN;
      collapsePagesSectionForPlacing();
    }
    // Every activation opens the picker; T/click while already in Chain
    // reopens a closed palette WITHOUT clearing the run in progress.
    App.openChainPanel && App.openChainPanel();
    updateUI();
  };
  document.getElementById('dropBtn').onclick = () => {
    // Drop tool: no page-scale gate — a drop is entered in its own unit and
    // the length math only adds it where a scale exists.
    if (state.tool !== TOOL.DROP) {
      state.quickLineStart = null;
      state.highlightStart = null;
      state.multiplyZoneStart = null;
      state.scaleZoneStart = null;
      state.deleteZoneStart = null;
      state.roomBoxStart = null;
      state.chainStart = null;
      state.tool = TOOL.DROP;
      collapsePagesSectionForPlacing();
    }
    // Re-click while active reopens a closed palette (the Chain pattern).
    App.openDropPanel && App.openDropPanel();
    updateUI();
    renderAnnotations();
  };
  // Tool right-click (contextmenu) handlers live in
  // features/tool-context-menu.js (one declarative map for all tools).
  document.getElementById('undoBtn').onclick = () => { undo(); };
  document.getElementById('redoBtn').onclick = () => { redo(); };
  document.getElementById('polylineBtn').onclick = () => {
    if (!getPageScale(state.currentPage)) {
      showSetScaleFirstToast('Polyline');
      return;
    }
    // T2-12: an in-flight draft is resumed, never replaced — re-press mid-draw
    // (or after the T1-05 page-switch disarm left an orphan draft) just re-arms
    // the tool; before, the dialog reopened and Start silently discarded every
    // clicked vertex. Finish/Esc/M remain the ways to start fresh.
    if (state.drawingPolyline) { state.tool = TOOL.POLYLINE; updateUI(); return; }
    const activeLt = state.lineTypes.find(l => l.id === state.activeLineTypeId);
    if (activeLt) {
      // T2-12: a line type is active — P behaves like L: no dialog, the run
      // takes the type's color and an auto-name; the dialog stays reachable
      // by pressing P with no active type. (JOURNEY-MAP Tier-2 #28)
      state.drawingPolyline = { id: uid(), name: nextPolylineName(), color: activeLt.color, points: [], closed: false, lineTypeId: activeLt.id, group: state.activeGroupId || null };
      state.tool = TOOL.POLYLINE;
      updateUI();
      return;
    }
    document.getElementById('polylineLineType').innerHTML = state.lineTypes.map(lt => '<option value="' + lt.id + '">' + lt.name + '</option>').join('') || '<option value="">—</option>';
    document.getElementById('polylineName').value = '';
    const cr = document.getElementById('polylineColorRow');
    cr.innerHTML = COLORS.map((c, i) => '<span class="color-swatch' + (i === 2 ? ' selected' : '') + '" data-color="' + c + '" style="background:' + c + '"></span>').join('');
    cr.querySelectorAll('.color-swatch').forEach(s => s.onclick = () => { cr.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('selected')); s.classList.add('selected'); });
    // T2-12: with zero line types the select's sole option is "—" and Start
    // used to commit a lineTypeId:null run whose footage landed under
    // "Unassigned" — block it with the picker's empty-state copy instead.
    const none = state.lineTypes.length === 0;
    document.getElementById('polylineEmpty').style.display = none ? '' : 'none';
    document.getElementById('polylineStart').disabled = none;
    showModal('polylineModal');
  };
  document.getElementById('highlightBtn').onclick = () => {
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.roomBoxStart = null;
    state.tool = TOOL.HIGHLIGHT;
    // Re-click while active reopens a closed bookmarks panel (the Chain pattern).
    App.openHighlightPanel && App.openHighlightPanel();
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
  document.getElementById('ghostBtn').onclick = () => {
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.roomBoxStart = null;
    state.ghostRectStart = null;
    // A ghost mid-placement survives nothing but a drop or Escape — re-arming
    // the tool while carrying one would leave it orphaned on the cursor.
    state.placingGhost = null;
    state.tool = TOOL.GHOST;
    updateUI();
    renderAnnotations();
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
  document.getElementById('quickLineSidebar').onclick = () => document.getElementById('quickLine').click();
  document.getElementById('polylineBtnSidebar').onclick = () => document.getElementById('polylineBtn').click();
  document.getElementById('highlightBtnSidebar').onclick = () => document.getElementById('highlightBtn').click();
  const roomBtnSidebarWire = document.getElementById('roomBtnSidebar');
  if (roomBtnSidebarWire) roomBtnSidebarWire.onclick = () => document.getElementById('roomBtn').click();
  const multiplyZoneBtnSidebarEl = document.getElementById('multiplyZoneBtnSidebar');
  if (multiplyZoneBtnSidebarEl) {
    multiplyZoneBtnSidebarEl.onclick = () => document.getElementById('multiplyZoneBtn').click();
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
      state.chainStart = null;
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
    renderAnnotations();
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

  // The Quick Count panel (populateCounterQuickCountPanel,
  // removePlumbingModifier, the icon-tab helpers, and the #plumBtn opener)
  // moved to features/quick-modals.js. The legacy #plumModal surface was
  // removed 2026-07-30 (nothing opened it).

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
    hideModal('lineTypeModal');
    armLineToolAfterCreate();
    updateUI();
  };

  // The #addGroup opener + the #groupModalCancel/#groupModalDelete/#groupModalDone
  // handlers moved to features/groups.js (window.App registry). The #showGroupColors
  // sidebar toggle below stays here.
  // Per-project Groups gate: the UI (sidebar section + Assign-to-Group
  // menus) shows when the project opted in OR already contains groups.
  // "No groups anywhere" is the default off state — nothing to migrate.
  function groupsUiVisible() {
    return !!state.groupsEnabled || (state.groups || []).length > 0;
  }
  const settingsUseGroupsBtn = document.getElementById('settingsUseGroupsBtn');
  if (settingsUseGroupsBtn) {
    settingsUseGroupsBtn.onclick = () => {
      if ((state.groups || []).length > 0) return; // locked on while groups exist
      state.groupsEnabled = !state.groupsEnabled;
      markProjectDirty();
      updateUI();
    };
  }
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
      renderAnnotations();
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
      App.renderCountersList();
    };
  }
  const lineTypeSearchInput = document.getElementById('lineTypeSearchInput');
  if (lineTypeSearchInput) {
    lineTypeSearchInput.value = state.lineTypeSearch || '';
    lineTypeSearchInput.oninput = () => {
      state.lineTypeSearch = lineTypeSearchInput.value;
      localStorage.setItem('lineTypeSearch', state.lineTypeSearch);
      App.renderLineTypesList();
      App.renderLinesList();
    };
  }
  const linesSearchInput = document.getElementById('linesSearchInput');
  if (linesSearchInput) {
    linesSearchInput.value = state.linesSearch || '';
    linesSearchInput.oninput = () => {
      state.linesSearch = linesSearchInput.value;
      localStorage.setItem('linesSearch', state.linesSearch);
      App.renderLinesList();
    };
  }
  // Sidebar usage-filter scope ('off' | 'page' | 'project'). The scope field
  // supersedes the legacy page-only booleans; the booleans are kept in sync
  // (true only for 'page') so the settings objects keep their historical shape.
  function getCounterListFilterScope() {
    const cs = state.counterSettings || {};
    return cs.sidebarFilterScope || (cs.showOnlyCountersOnCurrentPage ? 'page' : 'off');
  }
  function setCounterListFilterScope(scope) {
    state.counterSettings.sidebarFilterScope = scope;
    state.counterSettings.showOnlyCountersOnCurrentPage = scope === 'page';
    try { localStorage.setItem('counterSidebarFilterScope', scope); } catch (_) {}
  }
  function getLineTypeListFilterScope() {
    const lts = state.lineTypeSettings || {};
    return lts.sidebarFilterScope || (lts.showOnlyLineTypesOnCurrentPage ? 'page' : 'off');
  }
  function setLineTypeListFilterScope(scope) {
    state.lineTypeSettings.sidebarFilterScope = scope;
    state.lineTypeSettings.showOnlyLineTypesOnCurrentPage = scope === 'page';
    try { localStorage.setItem('lineTypeSidebarFilterScope', scope); } catch (_) {}
  }
  const FILTER_SCOPE_CYCLE = { off: 'page', page: 'project', project: 'off' };
  // Reflect a scope onto a settings-modal segmented control (aria-pressed per
  // data-scope button). Shared with the settings feature files via App.*.
  function syncFilterScopeSegment(segmentId, scope) {
    const seg = document.getElementById(segmentId);
    if (!seg) return;
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scope === scope)));
  }
  // The project-scope glyph (stacked sheets) swapped into the inline filter
  // buttons; 'off'/'page' restore the arrows-inward glyph the markup ships.
  const FILTER_GLYPH_PROJECT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" d="M3 1.5h8a1 1 0 0 1 1 1V4h-1V2.5H3v9H2v-9a1 1 0 0 1 1-1zm2 3h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm0 1v8h8v-8H5z"/></svg>';
  let filterGlyphPageSvg = null; // captured from the markup on first swap
  function syncSidebarFilterButton(btn, scope, kind) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(scope !== 'off'));
    btn.title = scope === 'project' ? ('Showing only ' + kind + ' used in this project (click to show all)')
      : scope === 'page' ? ('Showing only ' + kind + ' used on this sheet (click for this project)')
      : ('Show only ' + kind + ' used on this sheet (click again for this project)');
    if ((btn.dataset.scope || 'off') === scope) return;
    if (filterGlyphPageSvg === null) filterGlyphPageSvg = btn.innerHTML;
    btn.innerHTML = scope === 'project' ? FILTER_GLYPH_PROJECT_SVG : filterGlyphPageSvg;
    btn.dataset.scope = scope;
  }
  // Narrate each cycle click of the inline filter buttons with a two-line
  // toast: "Filter:" / the state just landed on.
  // The button's meaning is otherwise only discoverable via its title attr
  // (field feedback 2026-08-13). #airboardToastText is pre-line, so the \n
  // layout needs no markup; only the hint line is a styled span.
  const FILTER_TOAST_LINES = {
    page: 'used on this sheet',
    project: 'used anywhere in this project',
    off: 'off — showing all',
  };
  // The shared two-line filter toast core: "Filter: <kind>" / the landed state.
  function showFilterToast(kind, stateLine) {
    showToast('', 3200);
    const el = document.getElementById('airboardToastText');
    if (el) el.textContent = 'Filter: ' + kind + '\n' + stateLine;
  }
  function showFilterScopeToast(kind, scope) {
    const t = FILTER_TOAST_LINES[scope];
    if (t) showFilterToast(kind, t);
  }
  const counterShowOnlyOnPageInlineBtn = document.getElementById('counterShowOnlyOnPageInlineBtn');
  if (counterShowOnlyOnPageInlineBtn) {
    counterShowOnlyOnPageInlineBtn.onclick = () => {
      setCounterListFilterScope(FILTER_SCOPE_CYCLE[getCounterListFilterScope()]);
      syncFilterScopeSegment('counterShowOnlySegment', getCounterListFilterScope());
      showFilterScopeToast('counters', getCounterListFilterScope());
      App.renderCountersList();
      updateUI();
    };
  }
  const lineTypeShowOnlyOnPageInlineBtn = document.getElementById('lineTypeShowOnlyOnPageInlineBtn');
  if (lineTypeShowOnlyOnPageInlineBtn) {
    lineTypeShowOnlyOnPageInlineBtn.onclick = () => {
      setLineTypeListFilterScope(FILTER_SCOPE_CYCLE[getLineTypeListFilterScope()]);
      syncFilterScopeSegment('lineTypeShowOnlySegment', getLineTypeListFilterScope());
      showFilterScopeToast('line types', getLineTypeListFilterScope());
      App.renderLineTypesList();
      App.renderLinesList();
      updateUI();
    };
  }
  const linesShowOnlyOnPageBtn = document.getElementById('linesShowOnlyOnPageBtn');
  if (linesShowOnlyOnPageBtn) {
    linesShowOnlyOnPageBtn.onclick = () => {
      state.lineTypeSettings.showOnlyLinesOnCurrentPage = !state.lineTypeSettings.showOnlyLinesOnCurrentPage;
      linesShowOnlyOnPageBtn.setAttribute('aria-pressed', state.lineTypeSettings.showOnlyLinesOnCurrentPage);
      // Narrate the two-state Lines toggle like the scope cycles do — this
      // button's meaning was otherwise only in its title attr.
      if (state.lineTypeSettings.showOnlyLinesOnCurrentPage) showFilterToast('lines', 'on this sheet only');
      else showFilterToast('lines', 'off — showing every sheet');
      App.renderLinesList();
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
  // The Groups chevron moved out of the h3 (flush right, after "+ Add"), so it
  // forwards to the title toggle it used to ride along with.
  document.getElementById('groupsCollapseIcon').onclick = () => document.getElementById('groupsSectionTitle').click();
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
    // T2-12 belt-and-braces: the button is disabled with zero line types, but a
    // forced click must still never commit a lineTypeId:null polyline (its
    // footage would vanish into Lines → "Unassigned").
    if (!lineTypeId) return;
    const name = document.getElementById('polylineName').value.trim() || 'Polyline';
    const colorSel = document.querySelector('#polylineColorRow .color-swatch.selected');
    const color = colorSel ? colorSel.dataset.color : COLORS[2];
    state.drawingPolyline = { id: uid(), name, color, points: [], closed: false, lineTypeId, group: state.activeGroupId || null };
    state.tool = TOOL.POLYLINE;
    hideModal('polylineModal');
    updateUI();
  };

  document.getElementById('finishPolyline').onclick = () => finishPolyline(false);
  document.getElementById('closePolygon').onclick = () => finishPolyline(true);

  // Auto-name for dialog-skipped polylines (T2-12 immediate arm): "Polyline N",
  // N = project-wide polyline count + 1. Cosmetic; collisions after deletes are fine.
  function nextPolylineName() {
    let n = 0;
    for (const p of state.pages) for (const c of getPageCanvases(p)) n += (c.annotations?.polylines?.length || 0);
    return 'Polyline ' + (n + 1);
  }

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
    renderAnnotations();
  }

  // SECTION: Zoom bar & page navigation
  function doZoomOut() { if (wheelZoomCommitTimer) { clearTimeout(wheelZoomCommitTimer); wheelZoomCommitTimer = null; } state.zoom = Math.max(0.2, state.zoom - 0.1); renderPdf(); syncZoomIndicators(); }
  function doZoomIn() { if (wheelZoomCommitTimer) { clearTimeout(wheelZoomCommitTimer); wheelZoomCommitTimer = null; } state.zoom = Math.min(getMaxZoom(), state.zoom + 0.1); renderPdf(); syncZoomIndicators(); }
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
    const data = { version: 1, counters: state.counters, lineTypes: state.lineTypes, iconNames: state.iconNames || {}, iconOrder: state.iconOrder || null, customIconPaths: getUserCustomIcons(), maxZoom: getMaxZoom(), groups: state.groups || [], groupsEnabled: !!state.groupsEnabled, rooms: state.rooms || [], legendSettings: state.legendSettings, multiplyZoneSettings: state.multiplyZoneSettings, scaleZoneSettings: state.scaleZoneSettings, showGridOverlay: state.showGridOverlay, gridSettings: state.gridSettings, pages: state.pages.map((p, i) => ({ index: i, label: p.label, canvases: p.canvases, scale: p.scale, rotation: p.rotation ?? 0, bakeFrame: computePageBakeFrame(p) })), activeCanvasIdByPage: state.activeCanvasIdByPage || {}, numberKeyBindings: state.numberKeyBindings || {} };
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
        exportDropdownMenu.style.left = '-9999px';
        exportDropdownMenu.style.right = '';
        exportDropdownMenu.classList.add('visible');
        const btnRect = exportDropdownBtn.getBoundingClientRect();
        exportDropdownMenu.style.position = 'fixed';
        placeFixedMenu(exportDropdownMenu, btnRect.right - 220, btnRect.bottom + 4);
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
        showReportMenu.style.left = '-9999px';
        showReportMenu.style.right = '';
        showReportMenu.classList.add('visible');
        const btnRect = printReportBtn.getBoundingClientRect();
        showReportMenu.style.position = 'fixed';
        showReportMenu.style.minWidth = Math.max(btnRect.width, 280) + 'px';
        placeFixedMenu(showReportMenu, btnRect.left, btnRect.bottom + 4);
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
    // Project Settings has two doors -- the desktop header gear and the mobile
    // sidebar-logo gear -- so they open through one function and can't drift
    // apart on auth or title. No sign-in gate here:
    // the modal is mostly local work (add PDF pages, Close Project, quick keys,
    // Advanced -> Manage Icons / Export / Import / Canvas Repair), and the
    // cloud rows inside prompt for sign-in themselves.
    function openProjectSettings() {
      const titleEl = document.getElementById('settingsTitle');
      if (titleEl) titleEl.textContent = state.pages.length || state.currentProjectId ? ('Project Settings - ' + (state.currentProjectName || 'Untitled')) : 'Project Settings';
      document.body.classList.remove('sidebar-open');
      updateSettingsCheckoutSection();
      showModal('settingsModal');
    }
    document.getElementById('sidebarLogoUser').onclick = () => { document.body.classList.remove('sidebar-open'); App.openMySettings(); };
    document.getElementById('sidebarLogoShare').onclick = () => { document.body.classList.remove('sidebar-open'); hideModal('settingsModal'); App.openShareProjectModal(); };
    const headerShareBtnEl = document.getElementById('headerShareBtn');
    if (headerShareBtnEl) headerShareBtnEl.onclick = () => copyOrCreateViewLinkToClipboard(headerShareBtnEl);
    const hideMarksBtnEl = document.getElementById('hideMarksBtn');
    if (hideMarksBtnEl) hideMarksBtnEl.onclick = () => toggleHideMarks();
    document.getElementById('sidebarLogoGear').onclick = openProjectSettings;
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
        statusEl.textContent = (window.App?.twinEmailText ? window.App.twinEmailText(state.checkedOutEmail) : state.checkedOutEmail) + ' is editing.';
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
    document.getElementById('settingsGearBtn').onclick = openProjectSettings;
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
    // The Turn In / Check Out UX (doTurnInAndHandleResult, tryTurnIn,
    // doCheckoutCurrentProject, the edit-status banner handler, and the
    // Project Settings checkout buttons) moved to features/turn-in.js
    // (window.App registry). The engine still owns the staged release
    // (saveEngine.doTurnIn, published as App.doTurnIn); every call site was
    // internal to the moved cluster, so no wrappers were needed here.

    // Signed out, this row carries the sign-in prompt the settings gear used
    // to carry -- the save flow itself has no session recovery and would just
    // dead-end in a "Please sign in to save" error inside the Save modal.
    // (The Load row below needs no gate: openLoadProjectModal re-runs
    // getSession itself, recovering a stored session or showing authModal.)
    document.getElementById('settingsSaveProject').onclick = () => {
      hideModal('settingsModal');
      if (SUPABASE_ENABLED && !state.supabaseSession?.user) { document.getElementById('authBtn').click(); return; }
      document.getElementById('saveProjectBtn').click();
    };
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
    document.getElementById('advancedImport').onclick = () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); document.getElementById('importBtn').click(); };
    document.getElementById('advancedCanvasRepair').onclick = () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); App.openCanvasRepairModal(); };
    document.getElementById('advancedEmptyCacheReload').onclick = async () => {
      if (!confirm('Clear all cached data (IndexedDB, localStorage) and reload? Unsaved work will be lost.')) return;
      hideModal('settingsAdvancedModal');
      hideModal('settingsModal');
      try {
        indexedDB.deleteDatabase('clickcount-pdf-cache');
      } catch (_) {}
      const keysToRemove = ['clickcount-last-project', 'clickcount-save-error', 'takeoff-state', 'lineModifiers', 'plumbingModifiers', 'groupColorDisplay', 'pagesTitlesTruncated', 'hideUnmarkedPagesFromSidebar', 'counterSearch', 'lineTypeSearch', 'linesSearch', 'linesTypeExpanded', 'counterSidebarFilterScope', 'lineTypeSidebarFilterScope', 'zoomSettings', 'specificPagesIncludeReport', 'customIconPaths'];
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
        if (window.App?.onAuthSignInFailed) window.App.onAuthSignInFailed(email);
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
    // The #lastSessionRestoreKeep/#lastSessionRestoreDiscard handlers and the
    // restore flow moved to features/restore-last-session.js.
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
  // Repeat-drop: apply the last-used drop size to the clicked line's nearest
  // end. Goes through the node model (collectDropNodes/applyDropToNode), so an
  // end shared with another run — every joint in a chain — carries the drop
  // ONCE instead of once per line. No-op (no undo, no dirty) when that end
  // already has this exact drop.
  const ctxRepeatDropEl = document.getElementById('ctxRepeatDrop');
  if (ctxRepeatDropEl) ctxRepeatDropEl.onclick = () => {
    const t = state.ctxTarget;
    const lastDrop = (state.recentDrops || [])[0];
    document.getElementById('contextMenu').classList.remove('visible');
    state.ctxTarget = null;
    if (!t || !lastDrop || (t.type !== 'quickLine' && t.type !== 'polyline')) return;
    const page = state.pages[state.currentPage];
    const ann = page ? getActiveAnnotations(page) : null;
    const line = t.type === 'quickLine' ? ann?.quickLines?.[t.index] : ann?.polylines?.[t.index];
    if (!line) return;
    const isPoly = t.type === 'polyline';
    const pts = isPoly ? (line.points || []) : null;
    const start = isPoly ? pts[0] : { x: line.x1, y: line.y1 };
    const end = isPoly ? pts[pts.length - 1] : { x: line.x2, y: line.y2 };
    if (!start || !end) return;
    const target = t.pdf && ptDist(t.pdf, start) <= ptDist(t.pdf, end) ? start : end;
    const nodes = collectDropNodes(ann);
    const node = nodes.find(n => ptDist(n, target) <= 1);
    if (!node) return;
    if (!applyDropToNode(ann, node, lastDrop.value, lastDrop.unit, true)) return;
    pushUndoSnapshotCurrentPage();
    applyDropToNode(ann, node, lastDrop.value, lastDrop.unit);
    pushRecentDrop(lastDrop.value, lastDrop.unit);
    logDropSetEvent(lastDrop.value, lastDrop.unit, 'context-repeat');
    markProjectDirty();
    renderAnnotations();
    updateUI();
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
    renderAnnotations();
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
    pushUndoSnapshotCurrentPage();   // every branch below mutates the current page's active canvas only
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
    } else if (t.type === 'roomBox') {
      if (ann.roomBoxes) ann.roomBoxes.splice(t.index, 1);
    }
    markProjectDirty();
    document.getElementById('contextMenu').classList.remove('visible');
    state.ctxTarget = null;
    renderAnnotations();
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
    // Repeat-drop row: the last drop size this device used, applied to the
    // clicked line's nearest end in one click — the menu is already open, so
    // the whole modal round-trip disappears for every drop after the first.
    const repeatDropBtn = document.getElementById('ctxRepeatDrop');
    if (repeatDropBtn) {
      const lastDrop = (state.recentDrops || [])[0];
      const showRepeat = canLineProps && lastDrop;
      repeatDropBtn.style.display = showRepeat ? 'block' : 'none';
      if (showRepeat) repeatDropBtn.textContent = 'Drop ' + formatDropLabel(lastDrop.value, lastDrop.unit) + ' here';
    }
    const canShowLength = !state.isViewer && (state.ctxTarget?.type === 'quickLine' || state.ctxTarget?.type === 'polyline');
    showLengthBtn.style.display = canShowLength ? 'block' : 'none';
    if (canShowLength) {
      const page = state.pages[state.currentPage];
      const ann = page ? getActiveAnnotations(page) : null;
      const line = state.ctxTarget?.type === 'quickLine' ? ann?.quickLines?.[state.ctxTarget.index] : ann?.polylines?.[state.ctxTarget.index];
      showLengthBtn.textContent = line?.showLength ? 'Hide Length' : 'Show Length';
    }
    const canAssignGroup = !state.isViewer && groupsUiVisible() && (state.ctxTarget?.type === 'marker' || state.ctxTarget?.type === 'quickLine' || state.ctxTarget?.type === 'polyline');
    assignGroupBtn.style.display = canAssignGroup ? 'block' : 'none';
    const ctxEditMzBtn = document.getElementById('ctxEditMultiplyZone');
    ctxEditMzBtn.style.display = !state.isViewer && state.ctxTarget?.type === 'multiplyZone' ? 'block' : 'none';
    const ctxEditSzBtn = document.getElementById('ctxEditScaleZone');
    ctxEditSzBtn.style.display = !state.isViewer && state.ctxTarget?.type === 'scaleZone' ? 'block' : 'none';
    const ctxEditRoomBoxBtn = document.getElementById('ctxEditRoomBox');
    if (ctxEditRoomBoxBtn) ctxEditRoomBoxBtn.style.display = !state.isViewer && state.ctxTarget?.type === 'roomBox' ? 'block' : 'none';
    const ctxNameHighlightBtn = document.getElementById('ctxNameHighlight');
    if (ctxNameHighlightBtn) {
      const isHl = !state.isViewer && state.ctxTarget?.type === 'highlight';
      ctxNameHighlightBtn.style.display = isHl ? 'block' : 'none';
      if (isHl) {
        const page = state.pages[state.currentPage];
        const ann = page ? getActiveAnnotations(page) : null;
        const h = ann?.highlights?.[state.ctxTarget.index];
        ctxNameHighlightBtn.textContent = h?.label ? 'Rename highlight…' : 'Name highlight…';
      }
    }
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
      } else if (t && t.type === 'highlight') {
        const page = state.pages[state.currentPage];
        const ann = page ? getActiveAnnotations(page) : null;
        targetLabel = ann?.highlights?.[t.index]?.label || null;
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
    // Show off-screen first, then clamp-place: a mark near the viewport's
    // bottom/right edge must not push the menu off-screen (field report:
    // Delete unreachable when right-clicking a line at the bottom of a count).
    menu.style.left = '-9999px';
    menu.style.top = '0px';
    menu.classList.add('visible');
    placeFixedMenu(menu, x, y);
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
        const end = snapLineToAngle(state.quickLineStart.x, state.quickLineStart.y, pdf.x, pdf.y);
        x2 = end.x; y2 = end.y;
        if (!isPointInPageBounds({ x: x2, y: y2 })) {
          const clamped = clampPointToPageBounds({ x: x2, y: y2 });
          x2 = clamped.x; y2 = clamped.y;
        }
      } else {
        if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      }
      pushUndoSnapshotCurrentPage();
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
      pt = snapLineToAngle(prev.x, prev.y, pdf.x, pdf.y);
      if (!isPointInPageBounds(pt)) pt = clampPointToPageBounds(pt);
    } else {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
    }
    pushUndoSnapshotCurrentPage();
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
      // Footer chip, not a toast (Tier-2 #15): the 5s Distance toast used to
      // eat the first Scale Zone corner click at the measure→zone hand-off.
      // In-memory only (like state.localPdfHash) — a per-sheet fact: the chip
      // renders only while lastMeasure.pageIdx === state.currentPage
      // (features/status-bar.js), a new measure overwrites it, and a
      // PDF/project load resets state.
      state.lastMeasure = { text: 'Distance: ' + formatted, pageIdx: state.currentPage };
      state.scalePointA = null;
      state.scalePointB = null;
      state.scaleMode = SCALE_MODES.NONE;
      state.tool = TOOL.NONE;
    }
    renderAnnotations();
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
      renderAnnotations();
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
      renderAnnotations();
    } else if (state.tool === TOOL.MEASURE) {
      commitMeasurePoint(pdf);
    } else if (state.tool === TOOL.LINE) {
      commitLinePoint(pdf);
      renderAnnotations();
    } else if (state.tool === TOOL.POLYLINE && state.drawingPolyline) {
      commitPolylinePoint(pdf);
      renderAnnotations();
    } else if (state.tool === TOOL.COUNTER && state.activeCounterType) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const placeT0 = performance.now();
      pushUndoSnapshotCurrentPage();
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
      requestAnimationFrame(() => notePerfSample('placeMs', performance.now() - placeT0));
    } else if (state.tool === TOOL.CHAIN) {
      // Chain: every click drops a counter; from the second click on, a quick
      // line back to the previous counter rides along. Logic in features/chain.js.
      App.commitChainPoint && App.commitChainPoint(pdf);
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.DROP) {
      // Drop tool: a click on a line end sets the palette's drop size there
      // (same size again clears — click-to-toggle). Logic in features/drop-mode.js.
      App.commitDropClick && App.commitDropClick(pdf);
    } else if (state.tool === TOOL.HIGHLIGHT) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const page = state.pages[state.currentPage];
      if (!state.highlightStart) state.highlightStart = pdf;
      else {
        const canvas = page && ensureActiveCanvas(page);
        if (canvas) {
          pushUndoSnapshotCurrentPage();
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
    } else if (state.tool === TOOL.GHOST) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      App.handleGhostCanvasClick && App.handleGhostCanvasClick(pdf);
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
    } else if (state.tool === TOOL.NONE) {
      // Drop-size peek: a stationary click/tap on a drop marker pins the value
      // chip (viewers included — the tool gate above admits NONE). Logic in
      // features/drop-peek.js; `e` may be null on the aim-loupe commit path.
      App.onDropPeekClick && App.onDropPeekClick(pdf, e);
    }
    // The one shared post-click refresh. Debounced: rapid mark placement must
    // never rebuild the sidebar per click (the canvas repaint above is
    // immediate; the sidebar/totals catch up ~120ms after the burst ends).
    scheduleUpdateUI();
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
    // Ghost tool: a right-click that lands on a ghost opens the batch menu
    // instead of the per-mark one. Gated on the tool, so right-clicking a real
    // mark that happens to sit under a ghost still works everywhere else.
    if (App.tryOpenGhostMenuAt && App.tryOpenGhostMenuAt(pdf, e.clientX, e.clientY)) return;
    state.ctxTarget = hitTest(pdf);
    // The right-click's PDF-space point rides along so point-aware rows (the
    // repeat-drop row picks the line end nearest the click) know where on the
    // mark the user aimed. Cleared with ctxTarget everywhere.
    if (state.ctxTarget) { state.ctxTarget.pdf = pdf; showContextMenu(e.clientX, e.clientY); }
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
  // Rect-tool drag gesture (mouse): press-drag past this threshold arms corner 1
  // at the PRESS point and completes the rectangle on release. It matches the
  // aim-timer move-cancel threshold so "drag" and "hold-to-aim" can never both
  // claim a gesture: hold still 280ms -> loupe wins; move >6px first -> drag wins.
  const RECT_DRAG_MIN_PX = 6;   // client px
  const RECT_TOOL_START_KEY = { [TOOL.HIGHLIGHT]: 'highlightStart',
    [TOOL.MULTIPLY_ZONE]: 'multiplyZoneStart', [TOOL.SCALE_ZONE]: 'scaleZoneStart',
    [TOOL.ROOM]: 'roomBoxStart', [TOOL.DELETE_ZONE]: 'deleteZoneStart' };

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
      case TOOL.CHAIN:
      case TOOL.DROP:
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
    state.rectPress = null;   // a hold that entered the loupe must not later promote into a drag
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
  // Shared gesture-commit render. state.zoom stays CONTINUOUS (the ladder is
  // raster currency only — see renderPdf's lookup): a commit that the cache
  // can serve (exact key or the nearest rung's bitmap) blits straight through
  // renderPdf; a genuinely cold commit paints the visible-window tile first
  // (bounded, screen-sized raster at the new zoom — sharp pixels under the
  // cursor fast), then chains the full-page raster. lastRenderedZoom is NEVER
  // advanced here — renderPdf owns it at paint time; pre-setting it while a
  // raster was in flight snapped the preview transform to 1 around old
  // content and flashed wrong-scale/dark margins (the black-screen bug).
  function commitZoomRender() {
    pendingZoomCrispT0 = wheelZoomLastEventTs > 0 ? wheelZoomLastEventTs : performance.now();
    if (Math.abs(state.zoom - lastRenderedZoom) <= 0.001) {
      updateContainerTransform();   // landed back on the already-rendered zoom — settle the preview
      return;
    }
    const page = state.pages[state.currentPage];
    if (page && page.pdfPage && !pdfRenderTask) {
      const rot = page.rotation ?? 0;
      const warm = pdfBitmapCacheGet(page.pdfPage, rot, state.zoom, effectiveDpr(page, state.zoom)) ||
        (() => {
          const rung = snapZoomToRung(state.zoom, 0.2, getMaxZoom());
          return Math.abs(rung - state.zoom) > 1e-9 && pdfBitmapCacheGet(page.pdfPage, rot, rung, effectiveDpr(page, rung));
        })();
      if (!warm) {
        renderCropTile({ force: true, onDone: () => renderPdf() });
        return;
      }
    }
    renderPdf();
  }
  function commitPinchZoom() {
    commitZoomRender();
    syncZoomIndicators();   // nothing in the full updateUI() depends on zoom — see the gesture spec
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
    maybeRideZoomRung();   // wheel/pinch/rail frames all pass through here
  }
  // Mid-gesture crisp riding: whenever the continuous preview zoom is nearer
  // a DIFFERENT cached rung than the one the base currently shows, blit-swap
  // immediately (renderPdf's rung-fallback path — synchronous). Strictly
  // blit-only: uncached rungs are skipped and left to the idle prefetcher,
  // and nothing happens while a raster is in flight. The visible base is
  // therefore never more than ~half a rung (≈7%) from a crisp raster while
  // zooming; the idle exact-refine lands pixel-perfect once the user rests.
  function maybeRideZoomRung() {
    const page = state.pages[state.currentPage];
    if (!page || !page.pdfPage || pdfRenderTask) return;
    if (Math.abs(state.zoom - lastRenderedZoom) <= 0.001) return;   // nothing to ride
    const rot = page.rotation ?? 0;
    if (pdfBitmapCacheGet(page.pdfPage, rot, state.zoom, effectiveDpr(page, state.zoom))) { renderPdf(); return; }   // exact bitmap cached
    const rung = snapZoomToRung(state.zoom, 0.2, getMaxZoom());
    if (Math.abs(rung - currentRenderZoom) < 1e-9) return;          // base already at the nearest rung
    if (!pdfBitmapCacheGet(page.pdfPage, rot, rung, effectiveDpr(page, rung))) return;   // cold — never raster mid-gesture
    renderPdf();
  }
  function commitWheelZoom() {
    if (wheelZoomCommitTimer) clearTimeout(wheelZoomCommitTimer);
    wheelZoomCommitTimer = null;
    commitZoomRender();
    syncZoomIndicators();   // nothing in the full updateUI() depends on zoom — see the gesture spec
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
    // Ghost drag. Gated on TOOL.GHOST: a ghost sits ON TOP of the plan where
    // real marks live, so outside its own tool it must never intercept a click
    // meant for the takeoff underneath.
    if (state.tool === TOOL.GHOST && !state.placingGhost && !state.ghostRectStart) {
      const gAnn = getActiveAnnotations(state.pages[state.currentPage]);
      const gi = annotationModel.ghostIndexAtPoint(gAnn, state.mousePos);
      if (gi >= 0) {
        pushUndoSnapshot();
        state.draggingGhostIdx = gi;
        state.draggingGhostLast = { x: state.mousePos.x, y: state.mousePos.y };
        state.activeGhostId = gAnn.ghosts[gi].id;
        renderAnnotations();
        return;
      }
    }
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
      // Rect tools with no corner pending: remember the press so a
      // >RECT_DRAG_MIN_PX move can promote it into a drag (corner 1 = press
      // point). With a corner already pending, a drag simply completes at the
      // release point via the trailing native click — today's behavior.
      const startKey = RECT_TOOL_START_KEY[state.tool];
      if (startKey && !state[startKey] && isPointInPageBounds(state.mousePos)) {
        state.rectPress = { pdf: state.mousePos, client: c };
      }
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
    if (state.aimPressTimer && state.aimMouseDownClient && ptDist({ x: e.clientX, y: e.clientY }, state.aimMouseDownClient) > RECT_DRAG_MIN_PX) {
      clearTimeout(state.aimPressTimer); state.aimPressTimer = null;   // moved before the hold fired
      // The same move that cancels hold-to-aim promotes a rect-tool press into
      // a drag: corner 1 lands at the PRESS point and the existing rubber-band
      // preview takes over from here (mouseup completes the rectangle).
      if (state.rectPress && RECT_TOOL_START_KEY[state.tool]
          && !state[RECT_TOOL_START_KEY[state.tool]]) {
        state[RECT_TOOL_START_KEY[state.tool]] = state.rectPress.pdf;
        state.rectDragging = true;
      }
      state.rectPress = null;
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
    } else if (state.draggingGhostIdx !== null && state.draggingGhostLast) {
      const gAnn = getActiveAnnotations(state.pages[state.currentPage]);
      const g = gAnn?.ghosts?.[state.draggingGhostIdx];
      if (g) {
        // Delta-based, not offset-based: the ghost stores absolute points, so
        // it moves by the same delta the pointer did.
        annotationModel.translateGhost(g, pdf.x - state.draggingGhostLast.x, pdf.y - state.draggingGhostLast.y);
        state.draggingGhostLast = { x: pdf.x, y: pdf.y };
        state.ghostDragMoved = true;
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
    } else if (state.tool === TOOL.GHOST && state.placingGhost && state.placingGhostLast) {
      // The freshly-captured copy rides the cursor until the next click drops
      // it: capture and placement are one gesture (corner, corner, drop).
      annotationModel.translateGhost(state.placingGhost, pdf.x - state.placingGhostLast.x, pdf.y - state.placingGhostLast.y);
      state.placingGhostLast = { x: pdf.x, y: pdf.y };
      renderAnnotations();
    } else if ((state.tool === TOOL.LINE && state.quickLineStart) || (state.tool === TOOL.POLYLINE && state.drawingPolyline && state.drawingPolyline.points.length >= 1) || (state.tool === TOOL.HIGHLIGHT && state.highlightStart) || (state.tool === TOOL.MULTIPLY_ZONE && state.multiplyZoneStart) || (state.tool === TOOL.SCALE_ZONE && state.scaleZoneStart) || (state.tool === TOOL.ROOM && state.roomBoxStart) || (state.tool === TOOL.DELETE_ZONE && state.deleteZoneStart) || (state.tool === TOOL.CHAIN && state.chainStart) || (state.tool === TOOL.GHOST && (state.ghostRectStart || state.placingGhost))) {
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
    // Drop-size peek hover (features/drop-peek.js) — after the cursor block so
    // the feature can promote the cursor to a pointer over a drop marker.
    App.onDropPeekHover && App.onDropPeekHover(pdf);
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
      scheduleCropTile();   // pan settled — re-cover the new visible window
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
    if (state.rectDragging) {
      // Rect-tool drag: complete the rectangle at the release point through the
      // tool's normal corner-2 click path, so overlap toasts, undo snapshots,
      // dirty marking, and every dialog open identically to two-click.
      state.rectDragging = false;
      const key = RECT_TOOL_START_KEY[state.tool];
      if (key && state[key]) {   // Esc mid-drag cleared the corner -> gesture is dead
        const pt = canvasPointFromEvent(e);
        const pdfUp = clampPointToPageBounds(canvasToPdf(pt.x, pt.y));   // same clamp the loupe uses
        handleCanvasClick(null, pdfUp);
        // TEMP T2-10 bake-in — remove after: drag-completion debug counter (Save Status log).
        pushSaveEvent('rect_drag_complete', 'Rectangle completed by drag', JSON.stringify({ tool: state.tool }));
      }
      state.justFinishedRectDrag = true;   // swallow the trailing native click
      return;
    }
    state.rectPress = null;   // sub-threshold press: plain click, the two-click path handles it
    if (state.resizingNoteIdx !== null || state.resizingNoteFontSizeIdx !== null) { state.justFinishedResize = true; markProjectDirty(); }
    if (state.draggingNoteIdx !== null && state.dragNoteStartPos && ptDist(state.mousePos, state.dragNoteStartPos) > 3) { state.justFinishedDragNote = true; markProjectDirty(); }
    if (state.resizingLegend || state.draggingLegend) { state.justFinishedLegendResize = true; markProjectDirty(); }
    if (state.draggingGhostIdx !== null) {
      if (state.ghostDragMoved) markProjectDirty();
      state.draggingGhostIdx = null;
      state.draggingGhostLast = null;
      state.ghostDragMoved = false;
      // NOT cleared here: the click event fires AFTER mouseup, and without
      // this flag it would fall into the TOOL.GHOST branch and arm a stray
      // capture corner. The click handler consumes it (justFinishedDragNote
      // pattern). Unconditional on purpose — a press that grabbed a ghost is
      // ghost interaction even when the pointer never moved.
      state.justFinishedDragGhost = true;
    }
    state.isPanning = false;
    state.panStart = null;
    scheduleCropTile();   // pan settled — re-cover the new visible window (no-ops when base is sharp)
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
    if (state.rectDragging) {
      // A drag that leaves the canvas dies whole — no phantom corner survives
      // the exit (mirrors cancelAiming semantics).
      const key = RECT_TOOL_START_KEY[state.tool];
      if (key) state[key] = null;
      state.rectDragging = false;
      renderAnnotations();
    }
    state.rectPress = null;
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
      scheduleCropTile();
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
    if (state.isPanning || state.justFinishedResize || state.justFinishedDragNote || state.justFinishedLegendResize || state.justFinishedLoupe || state.justFinishedDragGhost || state.justFinishedRectDrag) { state.justFinishedResize = false; state.justFinishedDragNote = false; state.justFinishedLegendResize = false; state.justFinishedLoupe = false; state.justFinishedDragGhost = false; state.justFinishedRectDrag = false; return; }
    state.justFinishedResize = false;
    state.justFinishedDragNote = false;
    state.justFinishedLegendResize = false;
    state.justFinishedLoupe = false;
    state.justFinishedRectDrag = false;
    handleCanvasClick(e);
  });

  (cWrapper || pdfCanvas).addEventListener('dblclick', (e) => handleCanvasDblClick(e));
  (cWrapper || pdfCanvas).addEventListener('contextmenu', (e) => handleContextMenu(e));

  let wheelZoomPending = false;
  let wheelZoomAccum = 0;
  let wheelZoomCursor = null;
  let wheelZoomLastEventTs = 0;
  let zoomGestureDirection = 0;   // +1 zooming in, -1 out — biases which rungs prefetch first
  // Cap on the per-frame zoom step exponent: |x| <= 0.6 -> one rAF step can
  // change zoom by at most ~1.8x, no matter how many wheel deltas queued up
  // while the main thread was busy rastering a dense sheet.
  const WHEEL_ZOOM_STEP_CLAMP = 0.6;
  // Accumulated deltas older than this are stale input from a main-thread
  // stall (multi-second pdf.js raster): the user has stopped scrolling by the
  // time we get to run, so applying the backlog would yank the view "after
  // the fact". Discard instead.
  const WHEEL_ZOOM_STALE_MS = 150;
  (cWrapper || pdfCanvas).addEventListener('wheel', (e) => {
    e.preventDefault();
    let delta = -e.deltaY;
    if (e.deltaMode === 1) delta *= 24;
    else if (e.deltaMode === 2) delta *= 240;
    wheelZoomAccum += delta;
    wheelZoomCursor = canvasPointFromEvent(e);
    wheelZoomLastEventTs = performance.now();
    if (!wheelZoomPending) {
      wheelZoomPending = true;
      requestAnimationFrame(() => {
        wheelZoomPending = false;
        const delta = wheelZoomAccum;
        wheelZoomAccum = 0;
        if (delta === 0 || !wheelZoomCursor) return;
        if (performance.now() - wheelZoomLastEventTs > WHEEL_ZOOM_STALE_MS) return;   // stale backlog after a stall
        // Sign-safe exponential step: exp(-x) ~ (1 - x) for the small per-frame
        // deltas of a live gesture (same feel/direction as the old linear
        // factor), but it can never go <= 0 — the old `1 - x` flipped negative
        // for a big queued delta and the zoom clamp then slammed to 20%.
        const x = Math.max(-WHEEL_ZOOM_STEP_CLAMP, Math.min(WHEEL_ZOOM_STEP_CLAMP, delta * 0.001 * getWheelZoomSpeed()));
        const factor = Math.exp(-x);
        const newZoom = Math.max(0.2, Math.min(getMaxZoom(), state.zoom * factor));
        if (newZoom === state.zoom) return;
        zoomGestureDirection = newZoom > state.zoom ? 1 : -1;
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
      if (newZoom !== state.zoom) zoomGestureDirection = newZoom > state.zoom ? 1 : -1;
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
          pushUndoSnapshotCurrentPage();
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
      scheduleCropTile();   // touch pan settled
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

  // The closure actions the HOTKEYS table (constants.js) names via `runner` —
  // the pieces of a hotkey that aren't just "click this button". Keys here must
  // match the table; hotkeys.spec.js asserts full coverage both directions.
  const HOTKEY_RUNNERS = {
    moveReset: () => {
      state.tool = TOOL.NONE; state.quickLineStart = null; state.highlightStart = null;
      state.multiplyZoneStart = null; state.scaleZoneStart = null; state.deleteZoneStart = null;
      state.chainStart = null;
      state.pendingNote = null; state.editingNote = null;
      if (state.drawingPolyline) state.drawingPolyline = null;
      updateUI();
    },
    toggleSnap: () => {
      state.lineTypeSettings.snapToHorizontalVertical = !state.lineTypeSettings.snapToHorizontalVertical;
      const cb = document.getElementById('lineTypeSnapToHV');
      const snapBtn = document.getElementById('lineTypeSnapToHVBtn');
      const snapHeaderEl = document.getElementById('lineTypeSnapToHVHeaderBtn');
      if (cb) { cb.checked = !!state.lineTypeSettings.snapToHorizontalVertical; }
      if (snapBtn) snapBtn.setAttribute('aria-pressed', !!state.lineTypeSettings.snapToHorizontalVertical);
      if (snapHeaderEl) snapHeaderEl.setAttribute('aria-pressed', !!state.lineTypeSettings.snapToHorizontalVertical);
      renderAnnotations();
      updateUI();
    },
    rotatePage: () => rotatePage90(),
  };

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
    // Quick Keys: the number row switches the active counter / line type. Placed
    // before the modifier checks but gated on none being held, so Ctrl+1 (browser
    // tab switching) and friends are left alone. Unbound digits fall through as
    // no-ops. The input/textarea guard above already protects typing digits into
    // a name field. Viewer gating lives in App.triggerQuickKey.
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && /^[0-9]$/.test(e.key)) {
      if (App.triggerQuickKey && App.triggerQuickKey(e.key)) e.preventDefault();
      return;
    }
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === 'z') {
        // One undo/redo per PRESS: OS key auto-repeat is ignored, so holding
        // Ctrl+Z cannot machine-gun through the stack — release and press
        // again for the next step.
        if (!e.repeat) { if (e.shiftKey) redo(); else undo(); }
        e.preventDefault();
        return;
      }
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      // Tool hotkeys are DATA-DRIVEN off the HOTKEYS table (constants.js) —
      // the same source scripts/build-macros.js generates the Macros rows
      // from, so a key can no longer work while being missing from the docs
      // (the V/Room-Sizer gap). Non-bespoke entries either click their button
      // or run a named closure action from HOTKEY_RUNNERS. Viewer gating rides
      // the entry (m/d/r/j/s stay viewer-usable — S so viewers can set a temp
      // scale to measure with).
      const hk = HOTKEYS.find((h) => !h.bespoke && h.key === k);
      if (hk && (hk.viewerAllowed || !state.isViewer)) {
        if (hk.runner) HOTKEY_RUNNERS[hk.runner]();
        else document.getElementById(hk.btnId).click();
        e.preventDefault();
      }
    }
    if (e.key === 'Escape') {
      // Toasts are non-blocking corner cards (Tier-2 #15): they self-dismiss
      // and never consume Escape, so the ladder below goes straight to real
      // modals and tools. (The old Ghost mid-gesture pre-clear hack and the
      // toast rungs died with the modal toasts.)
      if (state.gridOriginPickMode) {
        state.gridOriginPickMode = false;
        showModal('gridSettingsModal');
        updateUI();
        return;
      }
      if (document.getElementById('chooseLineTypeModal').classList.contains('visible')) {
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
      else if (document.getElementById('toolingScaleCheckModal')?.classList.contains('visible')) { hideModal('toolingScaleCheckModal'); }
      else if (document.getElementById('noteModal').classList.contains('visible')) { hideModal('noteModal'); state.pendingNote = null; state.editingNote = null; state.pendingNoteColor = null; }
      else if (document.getElementById('multiplyZoneModal').classList.contains('visible')) { hideModal('multiplyZoneModal'); state.pendingMultiplyZone = null; state.pendingMultiplyZoneEdit = null; }
      else if (document.getElementById('deleteZoneModal').classList.contains('visible')) { hideModal('deleteZoneModal'); state.pendingDeleteZone = null; }
      else if (document.getElementById('roomBoxModal')?.classList.contains('visible')) { hideModal('roomBoxModal'); state.pendingRoomBox = null; state.pendingRoomBoxEdit = null; }
      else if (document.getElementById('roomEditModal')?.classList.contains('visible')) { hideModal('roomEditModal'); }
      else if (document.getElementById('roomDeleteConfirmModal')?.classList.contains('visible')) { hideModal('roomDeleteConfirmModal'); }
      else if (document.getElementById('multiplyZoneSettingsModal').classList.contains('visible')) { hideModal('multiplyZoneSettingsModal'); }
      else if (document.getElementById('scaleZoneSettingsModal').classList.contains('visible')) { hideModal('scaleZoneSettingsModal'); }
      else if (document.getElementById('linePropertiesModal').classList.contains('visible')) { App.closeLinePropertiesModal(); }
      // Keyboard Map opens ON TOP of Macros, so it must be checked first — one
      // Escape closes the board and leaves the shortcut list up behind it.
      else if (document.getElementById('keyboardMapModal').classList.contains('visible')) { hideModal('keyboardMapModal'); }
      else if (document.getElementById('quickKeysModal').classList.contains('visible')) { hideModal('quickKeysModal'); }
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
      else if (state.drawingPolyline) {
        // Staged like Quick Line/Ghost: each Escape unwinds one clicked vertex;
        // with none left, Escape exits to Move. A stray Esc never costs more
        // than the last click. (JOURNEY-MAP Tier-2 #22)
        if (state.drawingPolyline.points.length > 0) { state.drawingPolyline.points.pop(); renderAnnotations(); updateUI(); }
        else { state.drawingPolyline = null; state.tool = TOOL.NONE; updateUI(); }
      }
      else if (state.tool === TOOL.LINE) {
        if (state.quickLineStart) { state.quickLineStart = null; renderAnnotations(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.CHAIN) {
        // Esc ladder: end the run -> close the palette (tool stays active,
        // the header pair chip takes over) -> exit to Move.
        if (state.chainStart) { state.chainStart = null; renderAnnotations(); updateUI(); }
        else if (App.isChainPanelOpen && App.isChainPanelOpen()) { App.closeChainPanel(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.DROP) {
        // Same ladder as Chain, minus the run: close the palette first, then exit.
        if (App.isDropPanelOpen && App.isDropPanelOpen()) { App.closeDropPanel(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); renderAnnotations(); }
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
        renderAnnotations();
      } else if (state.tool === TOOL.MEASURE) {
        state.tool = TOOL.NONE;
        state.scalePointA = null;
        state.scalePointB = null;
        state.scaleMode = SCALE_MODES.NONE;
        updateUI();
        renderAnnotations();
      } else if (state.tool === TOOL.HIGHLIGHT) {
        // Esc ladder: cancel the in-progress rect -> close the bookmarks
        // panel (tool stays active) -> exit to Move.
        if (state.highlightStart) { state.highlightStart = null; renderAnnotations(); updateUI(); }
        else if (App.isHighlightPanelOpen && App.isHighlightPanelOpen()) { App.closeHighlightPanel(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.MULTIPLY_ZONE) {
        if (state.multiplyZoneStart) { state.multiplyZoneStart = null; renderAnnotations(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.SCALE_ZONE) {
        if (state.scaleZoneStart) { state.scaleZoneStart = null; renderAnnotations(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.DELETE_ZONE) {
        if (state.deleteZoneStart) { state.deleteZoneStart = null; renderAnnotations(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
      } else if (state.tool === TOOL.GHOST) {
        // Staged like Quick Line's: drop the ghost in hand -> drop the first
        // corner -> exit to Move. One Escape never costs more than one click.
        if (App.handleGhostEscape && App.handleGhostEscape()) { renderAnnotations(); updateUI(); }
        else { state.tool = TOOL.NONE; state.activeGhostId = null; updateUI(); renderAnnotations(); }
      } else if (state.tool === TOOL.ROOM) {
        if (state.roomBoxStart) { state.roomBoxStart = null; renderAnnotations(); updateUI(); }
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
          renderAnnotations();
          updateUI();
        } else if (e.key === 'ArrowDown' && idx < canvases.length - 1) {
          state.activeCanvasIdByPage[state.currentPage] = canvases[idx + 1].id;
          if (!state.isViewer) markProjectDirty();
          renderAnnotations();
          updateUI();
        }
      }
    }
    if (e.key === 'Enter' && state.drawingPolyline && state.drawingPolyline.points.length >= 2) finishPolyline(false);
    if (e.key === 'Enter' && state.tool === TOOL.EDIT_POLY) exitEditMode(true);
    // Chain: Enter ends the current run like the first Escape (tool stays
    // active — the next click starts a fresh chain); with no run in progress
    // it closes the palette instead (the header pair chip takes over).
    if (e.key === 'Enter' && state.tool === TOOL.CHAIN) {
      if (state.chainStart) { state.chainStart = null; renderAnnotations(); updateUI(); }
      else if (App.isChainPanelOpen && App.isChainPanelOpen()) { App.closeChainPanel(); updateUI(); }
    }
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
  App.planPaletteRelink = planPaletteRelink;
  App.applyPaletteRelink = applyPaletteRelink;
  App.pushUndoSnapshot = pushUndoSnapshot;
  App.pushUndoSnapshotCurrentPage = pushUndoSnapshotCurrentPage;
  App.markProjectDirty = markProjectDirty;
  App.showModal = showModal;
  App.hideModal = hideModal;
  App.placeFixedMenu = placeFixedMenu;
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
  App.__pdfBitmapCacheStats = () => pdfTileCache.debugStats();
  App.__renderServiceStats = () => renderService.statsSnapshot();          // debug/spec introspection
  App.__perfSamples = () => ({ summary: perfSummary(), samples: JSON.parse(JSON.stringify(perfSamples)) });
  App.__renderServiceMode = () => renderService.mode();
  App.__renderWorkerState = () => renderService.workerState();
  App.__setRasterTestDelay = (ms, kinds) => renderService.setTestDelay(ms, kinds);   // spec hook (replaces pdfPage.render wrapping)
  App.__tileGridStats = () => pdfTileCache.tileGridStats();   // debug/spec introspection
  App.__ensureTileCoverage = () => pdfTileCache.ensureTileCoverage();
  App.__pdfBitmapCacheKeys = () => pdfTileCache.debugKeys();   // debug/spec introspection
  App.__docWarmupState = () => pdfTileCache.warmupState();   // full-document warm-up progress (debug/spec)
  App.__pdfBitmapCacheDump = () => pdfTileCache.debugDump();
  App.getOrderedIcons = getOrderedIcons;
  App.iconVbFor = iconVbFor;
  App.svgShapeToPath = svgShapeToPath;   // pure (icon-render.js) — custom-icon-upload feeds DOMParser shapes through it
  App.iconGridCellsHtml = iconGridCellsHtml;     // pure (icon-render.js) — shared picker-grid cell markup
  App.customIconCellsHtml = customIconCellsHtml; // pure (icon-render.js) — upload cell + custom icon cells
  App.getUserCustomIcons = getUserCustomIcons;
  App.saveUserCustomIcons = saveUserCustomIcons;
  App.showToast = showToast;
  App.getPageCanvases = getPageCanvases;
  App.renderAnnotationsToContext = renderAnnotationsToContext;
  // addReportPagesToPdf / addHighlightsToPdf / addNotesToPdf / hasAnyHighlights /
  // hasAnyNotes are registered from features/pdf-bundle.js.
  App.wrapNoteText = wrapNoteText;
  App.logUserEvent = logUserEvent;
  App.renderAnnotations = renderAnnotations;
  // renderPagesList / renderCountersList / renderLineTypesList /
  // renderGroupsList / countItemsInGroup are registered from
  // features/pages-list.js + features/sidebar-lists.js.
  App.pageHasAnyAnnotations = pageHasAnyAnnotations;
  App.startRename = startRename;
  App.exitEditMode = exitEditMode;
  // features/lines-list.js deps (publish-only). formatArea/polygonArea are
  // geometry.js globals — lint-invisible to the features eslint group, so they
  // route through the registry (the pilot-#13 ptDist pattern).
  App.formatArea = formatArea;
  App.polygonArea = polygonArea;
  App.pickScaleForLineType = pickScaleForLineType;
  App.getLineRealWorldLengthFeet = getLineRealWorldLengthFeet;
  App.onDoubleTapOrDblClick = onDoubleTapOrDblClick;
  App.DROP_ICON_STYLES = DROP_ICON_STYLES;
  App.TOOL = TOOL;
  App.COLORS = COLORS;
  App.getLineModifiers = getLineModifiers;
  App.saveLineModifiers = saveLineModifiers;
  App.getPlumbingModifiers = getPlumbingModifiers;
  App.savePlumbingModifiers = savePlumbingModifiers;
  App.getIconName = getIconName;
  App.getEffectiveCustomIcons = getEffectiveCustomIcons;
  // populateCounterQuickCountPanel is registered from
  // features/quick-modals.js (counter.js calls App.populateCounterQuickCountPanel).
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
  App.escapeHtml = escapeHtml;   // canonical HTML escaper (format.js)
  // The single selection path, shared by the sidebar rows and Quick Keys.
  App.setActiveCounterType = setActiveCounterType;
  App.setActiveLineType = setActiveLineType;
  // T2-08 arm-on-create (features/quick-line.js + features/choose-create-line-type.js).
  App.armLineToolAfterCreate = armLineToolAfterCreate;
  // Chain tool deps (features/chain.js) — publish-only; all defined in app.js.
  App.isPointInPageBounds = isPointInPageBounds;
  App.showOutOfBoundsToast = showOutOfBoundsToast;
  App.snapLineToAngle = snapLineToAngle;
  App.clampPointToPageBounds = clampPointToPageBounds;
  App.snapToGrid = snapToGrid;
  App.logCounterMarkerAddedEvent = logCounterMarkerAddedEvent;
  App.logLineAddedEvent = logLineAddedEvent;
  App.collapsePagesSectionForPlacing = collapsePagesSectionForPlacing;
  // Child counts dep (features/child-counts.js) — publish-only.
  App.getMultiplyZoneForLine = getMultiplyZoneForLine;
  // Hotkey coverage seam: hotkeys.spec.js asserts every non-bespoke HOTKEYS
  // entry resolves to a runner here or a real element — the executable half of
  // the hotkeys-as-data contract (build:macros gates the documentation half).
  App.__hotkeyRunnerNames = Object.keys(HOTKEY_RUNNERS);
  App.HOTKEYS = HOTKEYS;   // the constants.js single source (specs + future features)
  App.formatLastSignIn = formatLastSignIn;
  App.formatUserActivityDateTime = formatUserActivityDateTime;
  App.USER_ACTIVITY_ICON_SVG = USER_ACTIVITY_ICON_SVG;
  // openUserActivityModal is registered by features/user-activity.js (re-homed).
  App.formatLastSignInUserActivity = formatLastSignInUserActivity;
  App.filterUserActivityRows = filterUserActivityRows;
  App.renderUserActivityAllUsersTableHtml = renderUserActivityAllUsersTableHtml;
  // updateStatus / updateSaveStatusIndicator / getCloudSaveSummary /
  // invalidateFooterTotals / getFooterTotalsCached are registered from
  // features/status-bar.js. Publish-only deps for it:
  App.formatSaveTime = formatSaveTime;
  App.formatSaveTimeParts = formatSaveTimeParts;
  App.formatAgo = formatAgo;
  App.getLastSaveIncludedPdf = () => lastSaveIncludedPdf;
  App.isSaveInProgress = () => saveEngine.isSaveInProgress();
  App.isSavePdfInProgress = () => saveEngine.isSavePdfInProgress();
  App.getSaveProgressMessage = () => saveEngine.getSaveProgressMessage();
  App.wasLastCloudSaveAttemptFailed = () => saveEngine.wasLastCloudSaveAttemptFailed();
  App.getLastLocalBackupAt = () => saveEngine.getLastLocalBackupAt();
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
  App.hydrateStateFromProjectData = hydrateStateFromProjectData;
  App.getActiveCanvas = getActiveCanvas;
  // Zone/page-action modal dep (features/zone-modals.js).
  App.performDeleteZone = performDeleteZone;
  // Canvas layers dep (features/canvas-layers.js).
  App.deepCopyAnnotations = deepCopyAnnotations;
  // Ghosts (features/ghost.js) — the model half stays pure in
  // annotation-model.js; the tool's gesture + menu live in the feature file.
  App.captureGhostFromRect = (...a) => annotationModel.captureGhostFromRect(...a);
  App.ghostCounts = (...a) => annotationModel.ghostCounts(...a);
  App.ghostBounds = (...a) => annotationModel.ghostBounds(...a);
  App.translateGhost = (...a) => annotationModel.translateGhost(...a);
  App.stampGhostIntoAnnotations = (...a) => annotationModel.stampGhostIntoAnnotations(...a);
  App.ghostIndexAtPoint = (...a) => annotationModel.ghostIndexAtPoint(...a);
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
  App.isAutoSaveSuspended = () => suspendAutoSaveUntilCheckout;
  App.setLastCheckoutRefreshAt = (ms) => { lastCheckoutRefreshAt = ms; };
  App.doTurnIn = () => saveEngine.doTurnIn();
  App.setTurnInProgress = (msg) => setTurnInProgress(msg);
  App.updateSettingsCheckoutSection = (...a2) => updateSettingsCheckoutSection(...a2);
  App.applyTakeoffBackupToState = applyTakeoffBackupToState;
  // PDF-intake re-apply gate (features/pdf-intake.js, T1-01/J4): "do the
  // current pages carry any annotations at all?"
  App.projectHasAnyCanvasMarkup = projectHasAnyCanvasMarkup;
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
  App.getPageScale = getPageScale;
  App.getPageSheetAnalysis = getPageSheetAnalysis;
  App.STANDARD_SHEETS = STANDARD_SHEETS;
  App.sheetCorrectionFactor = sheetCorrectionFactor;
  App.sheetMatchingCorrection = sheetMatchingCorrection;
  App.scaleCheckDelta = scaleCheckDelta;
  App.convertUnitValue = convertUnitValue;
  App.formatFeetInchesFromVal = formatFeetInchesFromVal;
  // Summary count-detail deps (features/summary-detail.js).
  App.getMultiplyZoneForPoint = getMultiplyZoneForPoint;
  // T2-11 shared counter arithmetic: { placed, withRepeats } per annotations
  // object — the badges (sidebar-lists.js, counter.js) and the Summary flat
  // path all tally through this one primitive.
  App.counterTally = counterTally;
  App.getLineLengthFeetForTotals = getLineLengthFeetForTotals;
  App.getLineLengthSplitForTotals = getLineLengthSplitForTotals;
  App.formatFeet = formatFeet;
  App.formatFeetPx = formatFeetPx;
  // Live draw readout deps (features/status-bar.js updateStatus): the Measure
  // feet-inches formatter and the arc-aware line length. getLineLengthPdfPts
  // stays a window.* report.js global — this only aliases it onto App.
  App.formatDistFeetInches = formatDistFeetInches;
  App.getLineLengthPdfPts = getLineLengthPdfPts;
  // Room Sizer deps (features/room-sizer.js).
  App.roomBoxDimsFeet = roomBoxDimsFeet;
  App.getEffectiveScaleForLine = getEffectiveScaleForLine;
  App.getMergedAnnotationsForPage = getMergedAnnotationsForPage;
  // Per-project Groups gate (spec seam; updateUI + showContextMenu consume it
  // internally).
  App.groupsUiVisible = groupsUiVisible;
  // Same-id palette collapse (features/palette-insights.js id-aware merge +
  // spec seam; annotation-model.js pure helper).
  App.dedupePaletteById = dedupePaletteById;
  // Line-drop deps (features/item-details.js Recent chips + features/drop-mode.js
  // Drop tool). collectDropNodes/applyDropToNode are the pure node model in
  // annotation-model.js; the recent list is device-local (localStorage
  // 'recentDrops'), one store behind both surfaces.
  App.collectDropNodes = collectDropNodes;
  App.applyDropToNode = applyDropToNode;
  App.formatDropLabel = formatDropLabel;
  App.getRecentDrops = () => state.recentDrops || [];
  App.pushRecentDrop = pushRecentDrop;
  App.logDropSetEvent = logDropSetEvent;
  App.toCanvas = toCanvas;
  App.showContextMenu = showContextMenu;               // spec seam (drop-mode.spec.js)
  App.getUndoDepth = () => undoStackModel.undoDepth(); // spec seam (no-op close stays clean)
  // Sidebar usage-filter scope (features/sidebar-lists.js reads, the settings
  // modals in features/counter-settings.js + line-type-settings.js write).
  App.getCounterListFilterScope = getCounterListFilterScope;
  App.setCounterListFilterScope = setCounterListFilterScope;
  App.getLineTypeListFilterScope = getLineTypeListFilterScope;
  App.setLineTypeListFilterScope = setLineTypeListFilterScope;
  App.syncFilterScopeSegment = syncFilterScopeSegment;
  App.showSetScaleFirstToast = showSetScaleFirstToast;
  App.getPdfDocument = getPdfDocument;
  // Viewer scale sharing + view-only boot live in features/view-only.js
  // (App.shareViewerScale / noteViewerTempScale / applyViewerTempScales /
  // maybeShowViewerScaleNotice / App.initViewOnlyMode — all registered by the
  // feature file; the first three double as viewer-scale.spec.js test seams).

  if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.__takeoffBackupGetForTest = takeoffBackupGet;
    window.__takeoffBackupDeleteForTest = takeoffBackupDelete;
    window.__takeoffBackupPutForTest = takeoffBackupPut;
    window.__writeTakeoffStateBackupForTest = writeTakeoffStateBackup;
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
        // Handled failure with a real UI: features/view-only.js owns the
        // full-screen dead/unreachable-link message (T1-12). warn, not error —
        // the Playwright specs assert zero console errors on this path. The
        // toast survives only as the can't-happen fallback (feature file
        // failed to load), per the defensive-callback convention.
        console.warn('[View link]', e);
        if (App.showViewLinkFailure) App.showViewLinkFailure(e);
        else showToast('Failed to load: ' + (e.message || 'Unknown error'), 5000);
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
    // Restore takeoff backup (IndexedDB-primary, localStorage fallback for migration).
    // T1-01: two records may exist — the live 'local' backup and the key-aside
    // 'local-held' record (a prior session's still-unresolved Keep/Discard
    // candidate, kept across reloads by design). The pure picker
    // (save-utils.js) chooses the boot candidate.
    const bootUserId = state.supabaseSession?.user?.id || null;
    const localBackupForBoot = await takeoffBackupGet('local', bootUserId);
    const heldBackupForBoot = await takeoffBackupGet(TAKEOFF_BACKUP_HELD_ID, bootUserId);
    const { candidate: bootRestoreCandidate, from: bootRestoreFrom, promptable: bootRestorePromptable } =
      pickBootRestoreCandidate(localBackupForBoot, heldBackupForBoot);
    // KEY-ASIDE: state has no pages/counters/lineTypes until the pre-apply
    // below, so the backup writer's guard short-circuits every write — move a
    // promptable 'local' candidate to the held key NOW, before that dangerous
    // window opens, so no later write can destroy it while the "Project from
    // Last Session" prompt is unresolved.
    if (bootRestorePromptable && bootRestoreFrom === 'local') {
      // A stale (e.g. data-only) held record could out-timestamp the candidate
      // and trip the put's stale-skip — clear it first so the move always lands.
      if (heldBackupForBoot) await takeoffBackupDelete(TAKEOFF_BACKUP_HELD_ID);
      await takeoffBackupPut(TAKEOFF_BACKUP_HELD_ID, bootRestoreCandidate.data, bootRestoreCandidate.pdfBlob,
        bootRestoreCandidate.pdfHash, bootRestoreCandidate.lastModifiedAt, bootRestoreCandidate.projectName, bootRestoreCandidate.userId);
      await takeoffBackupDelete('local');
    }
    let backupToApply = bootRestoreCandidate?.data || null;
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
        const { data: profile } = await supabase.from('profiles').select('is_admin, is_digital_twin, is_overseer').eq('user_id', state.supabaseSession.user.id).maybeSingle();
        state.isAdmin = !!profile?.is_admin;
        state.isOverseer = !!profile?.is_overseer;
        state.isDigitalTwin = !!profile?.is_digital_twin;
      }
    }
    // T1-01: the local "Project from Last Session" offer is HOISTED out of the
    // signed-in gate — the backup is on-device data and restores fully offline,
    // so signed-out sessions get the same Keep/Discard prompt. The candidate
    // (now under the held key) rides along as `heldBackup` so the Keep handler
    // uses it directly instead of re-reading a record a later write could have
    // poisoned. No `await` sits between the pre-apply above and this offer
    // (the dev-auth block is localhost-only, and the key-aside protects that
    // window anyway), so no interval tick can interleave — `pendingRestore`
    // (the clobber-guard gate) is set before any backup write becomes possible.
    let offeredRestore = false;
    if (bootRestorePromptable) {
      const projForRestore = { id: 'local', name: bootRestoreCandidate.projectName || 'Untitled', data: backupDataToProjFormat(bootRestoreCandidate.data || {}), updated_at: null, pdf_path: null, pdf_hash: bootRestoreCandidate.pdfHash, user_id: state.supabaseSession?.user?.id || null, checked_out_by: null, checked_out_at: null };
      App.openLastSessionRestorePrompt({ proj: projForRestore, cachedBlob: bootRestoreCandidate.pdfBlob, heldBackup: bootRestoreCandidate });
      logUserEvent('restore_prompt_shown', null, { source: 'local' });
      offeredRestore = true;
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
        if (!offeredRestore) {
          // Cloud last-session: show the modal INSTANTLY from the lightweight
          // localStorage metadata (projectName etc.). The Supabase project fetch +
          // PDF-blob resolution are deferred to the #lastSessionRestoreKeep handler so a
          // network round-trip no longer blocks the modal's appearance. A stale /
          // inaccessible project is cleaned up on "Keep" rather than at boot.
          const stored = localStorage.getItem('clickcount-last-project');
          if (stored) {
            const last = JSON.parse(stored);
            if (last && last.userId === uid && last.projectId) {
              App.openLastSessionRestorePrompt({ cloudLast: last });
              logUserEvent('restore_prompt_shown', last.projectId, { source: 'cloud' });
            }
          }
        }
      } catch (_) {}
    }
    updateUI();
  })();
  })();

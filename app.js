  (function() {
  // SECTION: Constants
  if (typeof pdfjsLib !== 'undefined') pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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

  function parseUploadedSvg(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        try {
          const doc = new DOMParser().parseFromString(r.result, 'image/svg+xml');
          const svg = doc.querySelector('svg');
          if (!svg) { reject(new Error('Invalid SVG')); return; }
          const vb = svg.getAttribute('viewBox') || svg.getAttribute('viewbox') || '0 0 24 24';
          const paths = [];
          function toPath(el) {
            const tag = (el.tagName || '').toLowerCase();
            if (tag === 'path' && el.getAttribute('d')) return el.getAttribute('d');
            if (tag === 'rect') {
              const x = Number(el.getAttribute('x')) || 0, y = Number(el.getAttribute('y')) || 0, w = Number(el.getAttribute('width')) || 0, h = Number(el.getAttribute('height')) || 0;
              return 'M' + x + ' ' + y + ' L' + (x + w) + ' ' + y + ' L' + (x + w) + ' ' + (y + h) + ' L' + x + ' ' + (y + h) + ' Z';
            }
            if (tag === 'circle') {
              const cx = Number(el.getAttribute('cx')) || 0, cy = Number(el.getAttribute('cy')) || 0, r = Number(el.getAttribute('r')) || 0;
              return 'M' + cx + ' ' + cy + ' m -' + r + ' 0 a ' + r + ' ' + r + ' 0 1 1 0 ' + (2 * r) + ' a ' + r + ' ' + r + ' 0 1 1 0 -' + (2 * r);
            }
            if (tag === 'ellipse') {
              const cx = Number(el.getAttribute('cx')) || 0, cy = Number(el.getAttribute('cy')) || 0, rx = Number(el.getAttribute('rx')) || 0, ry = Number(el.getAttribute('ry')) || 0;
              return 'M' + cx + ' ' + cy + ' m -' + rx + ' 0 a ' + rx + ' ' + ry + ' 0 1 1 0 ' + (2 * ry) + ' a ' + rx + ' ' + ry + ' 0 1 1 0 -' + (2 * ry);
            }
            if (tag === 'line') {
              const x1 = Number(el.getAttribute('x1')) || 0, y1 = Number(el.getAttribute('y1')) || 0, x2 = Number(el.getAttribute('x2')) || 0, y2 = Number(el.getAttribute('y2')) || 0;
              return 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2;
            }
            return null;
          }
          doc.querySelectorAll('path, rect, circle, ellipse, line').forEach(el => {
            const d = toPath(el);
            if (d) paths.push(d);
          });
          const value = paths.join(' ');
          if (!value.trim()) { reject(new Error('SVG must contain at least one path, rect, circle, ellipse, or line.')); return; }
          const name = (file.name || 'icon').replace(/\.svg$/i, '') || 'Icon';
          resolve({ value, name, viewBox: vb });
        } catch (e) { reject(e); }
      };
      r.onerror = () => reject(new Error('Failed to read file'));
      r.readAsText(file);
    });
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

  function makeAnnotations() { return { counterMarkers: {}, polylines: [], quickLines: [], highlights: [], notes: [], multiplyZones: [], scaleZones: [], legend: null }; }

  function getPageCanvases(page) { return page?.canvases ?? []; }
  function getActiveCanvas(page) {
    if (!page) return null;
    const canvases = getPageCanvases(page);
    if (!canvases.length) return null;
    const pageIdx = state.pages?.indexOf(page);
    const activeId = pageIdx >= 0 ? state.activeCanvasIdByPage?.[pageIdx] : null;
    const found = activeId ? canvases.find(c => c.id === activeId) : null;
    return found || canvases[0];
  }
  function getActiveAnnotations(page) {
    const canvas = getActiveCanvas(page);
    return canvas?.annotations ?? makeAnnotations();
  }
  function mergeAnnotations(...anns) {
    const out = makeAnnotations();
    anns.forEach(ann => {
      if (!ann) return;
      Object.entries(ann.counterMarkers || {}).forEach(([id, arr]) => {
        if (!out.counterMarkers) out.counterMarkers = {};
        if (!out.counterMarkers[id]) out.counterMarkers[id] = [];
        out.counterMarkers[id].push(...arr);
      });
      (ann.quickLines || []).forEach(q => { (out.quickLines = out.quickLines || []).push(q); });
      (ann.polylines || []).forEach(p => { (out.polylines = out.polylines || []).push(p); });
      (ann.notes || []).forEach(n => { (out.notes = out.notes || []).push(n); });
      (ann.highlights || []).forEach(h => { (out.highlights = out.highlights || []).push(h); });
      (ann.multiplyZones || []).forEach(z => { (out.multiplyZones = out.multiplyZones || []).push(z); });
      (ann.scaleZones || []).forEach(z => { (out.scaleZones = out.scaleZones || []).push(z); });
    });
    return out;
  }
  function getMergedAnnotationsForPage(page) {
    const canvases = getPageCanvases(page);
    const anns = canvases.map(c => c.annotations || makeAnnotations());
    return mergeAnnotations(...anns);
  }
  function ensureActiveCanvas(page) {
    migratePageToCanvases(page);
    let canvas = getActiveCanvas(page);
    if (!canvas) {
      const id = uid();
      page.canvases = [{ id, name: 'Main', annotations: makeAnnotations() }];
      const pi = state.pages?.indexOf(page);
      if (pi >= 0) state.activeCanvasIdByPage[pi] = id;
      canvas = page.canvases[0];
    }
    return canvas;
  }
  function migratePageToCanvases(page) {
    if (!page) return;
    if (page.canvases && page.canvases.length) return;
    const ann = page.annotations || makeAnnotations();
    page.canvases = [{ id: uid(), name: 'Main', annotations: ann }];
    delete page.annotations;
  }
  function pageHasAnyAnnotations(p) {
    return getPageCanvases(p).some(c => {
      const ann = c.annotations || makeAnnotations();
      return (ann.counterMarkers && Object.keys(ann.counterMarkers).length) || (ann.quickLines?.length) || (ann.polylines?.length) || (ann.highlights?.length) || (ann.notes?.length) || (ann.multiplyZones?.length) || (ann.scaleZones?.length);
    });
  }
  function projectHasAnyCanvasMarkup() {
    return Array.isArray(state.pages) && state.pages.some(pageHasAnyAnnotations);
  }

  function backupDataToProjFormat(data) {
    if (!data || (data.pages && Array.isArray(data.pages))) return data;
    if (data.pageCanvases && Array.isArray(data.pageCanvases)) {
      return {
        ...data,
        pages: data.pageCanvases.map((canvases, i) => ({
          index: i,
          canvases,
          scale: data.pageScales?.[i],
          rotation: (data.pageRotations?.[i] ?? 0)
        }))
      };
    }
    return data;
  }

  function applyTakeoffBackupToState(backup) {
    if (!backup) return;
    if (Array.isArray(backup.counters)) state.counters = backup.counters;
    if (Array.isArray(backup.lineTypes)) state.lineTypes = backup.lineTypes;
    if (Array.isArray(backup.groups)) state.groups = ensureGroupColors(backup.groups);
    if (backup.iconNames && typeof backup.iconNames === 'object') state.iconNames = backup.iconNames;
    if (Array.isArray(backup.iconOrder)) state.iconOrder = backup.iconOrder;
    if (Array.isArray(backup.customIconPaths)) saveUserCustomIcons(backup.customIconPaths);
    if (backup.activeCanvasIdByPage && typeof backup.activeCanvasIdByPage === 'object') state.activeCanvasIdByPage = backup.activeCanvasIdByPage;
    if (backup.pageCanvases && Array.isArray(backup.pageCanvases)) {
      backup.pageCanvases.forEach((canvases, i) => {
        if (state.pages[i] && Array.isArray(canvases) && canvases.length) state.pages[i].canvases = canvases;
      });
    } else if (backup.pageAnnotations && Array.isArray(backup.pageAnnotations)) {
      backup.pageAnnotations.forEach((ann, i) => {
        if (state.pages[i]) {
          state.pages[i].canvases = [{ id: uid(), name: 'Main', annotations: ann }];
          delete state.pages[i].annotations;
        }
      });
    }
    if (backup.pageScales) backup.pageScales.forEach((s, i) => { if (state.pages[i]) state.pages[i].scale = s; });
    if (backup.pageRotations) backup.pageRotations.forEach((r, i) => { if (state.pages[i]) state.pages[i].rotation = r ?? 0; });
    if (backup.legendSettings) state.legendSettings = { ...state.legendSettings, ...backup.legendSettings };
    if (backup.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...backup.multiplyZoneSettings };
    if (backup.showGridOverlay != null) state.showGridOverlay = !!backup.showGridOverlay;
    if (backup.gridSettings) state.gridSettings = backup.gridSettings;
  }

  function applyPageAnnotationsFromData(page, p, scaleFallback) {
    if (!page) return;
    if (p.canvases && Array.isArray(p.canvases) && p.canvases.length) {
      page.canvases = p.canvases.map(c => ({
        id: c.id || uid(),
        name: c.name || 'Main',
        annotations: c.annotations ? {
          counterMarkers: c.annotations.counterMarkers && typeof c.annotations.counterMarkers === 'object' ? c.annotations.counterMarkers : {},
          polylines: Array.isArray(c.annotations.polylines) ? c.annotations.polylines : [],
          quickLines: Array.isArray(c.annotations.quickLines) ? c.annotations.quickLines : [],
          highlights: Array.isArray(c.annotations.highlights) ? c.annotations.highlights : [],
          notes: Array.isArray(c.annotations.notes) ? c.annotations.notes : [],
          multiplyZones: Array.isArray(c.annotations.multiplyZones) ? c.annotations.multiplyZones : [],
          scaleZones: Array.isArray(c.annotations.scaleZones) ? c.annotations.scaleZones : [],
          legend: c.annotations.legend && typeof c.annotations.legend === 'object' ? c.annotations.legend : null
        } : makeAnnotations()
      }));
      delete page.annotations;
    } else if (p.annotations) {
      const a = p.annotations;
      const ann = {
        counterMarkers: a.counterMarkers && typeof a.counterMarkers === 'object' ? a.counterMarkers : {},
        polylines: Array.isArray(a.polylines) ? a.polylines : [],
        quickLines: Array.isArray(a.quickLines) ? a.quickLines : [],
        highlights: Array.isArray(a.highlights) ? a.highlights : [],
        notes: Array.isArray(a.notes) ? a.notes : [],
        multiplyZones: Array.isArray(a.multiplyZones) ? a.multiplyZones : [],
        scaleZones: Array.isArray(a.scaleZones) ? a.scaleZones : [],
        legend: a.legend && typeof a.legend === 'object' ? a.legend : null
      };
      page.canvases = [{ id: uid(), name: 'Main', annotations: ann }];
      delete page.annotations;
    }
    page.scale = p.scale !== undefined ? p.scale : (scaleFallback ?? null);
    page.rotation = p.rotation ?? 0;
  }

  function reconcileOrphanedCountersAndLineTypes() {
    if (!state.pages || !state.pages.length) return;
    state.pages.forEach(migratePageToCanvases);
    const counterIds = new Set((state.counters || []).map(c => c.id));
    const lineTypeIds = new Set((state.lineTypes || []).map(lt => lt.id));
    const orphanCounterIds = new Set();
    const orphanLineTypeIds = new Set();
    state.pages.forEach(p => {
      getPageCanvases(p).forEach(c => {
        const ann = c.annotations || makeAnnotations();
        Object.keys(ann.counterMarkers || {}).forEach(id => { if (!counterIds.has(id)) orphanCounterIds.add(id); });
        (ann.quickLines || []).forEach(q => { if (q.lineTypeId && !lineTypeIds.has(q.lineTypeId)) orphanLineTypeIds.add(q.lineTypeId); });
        (ann.polylines || []).forEach(poly => { if (poly.lineTypeId && !lineTypeIds.has(poly.lineTypeId)) orphanLineTypeIds.add(poly.lineTypeId); });
      });
    });
    if (orphanCounterIds.size > 0) {
      state.counters = state.counters || [];
      orphanCounterIds.forEach(id => {
        if (!state.counters.some(c => c.id === id)) {
          state.counters.push({ id, name: 'Unknown', icon: CIRCLE_PATH, color: '#e8c547' });
        }
      });
    }
    if (orphanLineTypeIds.size > 0) {
      state.lineTypes = state.lineTypes || [];
      orphanLineTypeIds.forEach(id => {
        if (!state.lineTypes.some(lt => lt.id === id)) {
          state.lineTypes.push({ id, name: 'Unknown', color: '#4a9eff', curveStyle: 'straight' });
        }
      });
    }
  }

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
    quickLineStart: null, highlightStart: null, multiplyZoneStart: null, scaleZoneStart: null, deleteZoneStart: null, pendingMultiplyZone: null, pendingMultiplyZoneValue: null, pendingMultiplyZoneEdit: null, pendingScaleZone: null, pendingScaleZoneEdit: null, scaleModalApplyTarget: null, pendingDeleteZone: null, pendingNote: null, editingNote: null, mousePos: { x: 0, y: 0 }, pan: { x: 0, y: 0 }, isPanning: false, panStart: null,
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
    canCheckOut: false,
    projectOwnerId: null,
    maxZoom: null,
    groups: [],
    activeGroupId: null,
    activeCanvasIdByPage: {},
    showLegendOverlay: true,
    showGridOverlay: false,
    gridSettings: null,
    userActivityAllRowsCache: null,
    userActivityViewMode: 'events'
  };
  state.showGroupColors = localStorage.getItem('groupColorDisplay') === '1';
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

  let pendingImportCanvasAfterPdf = false;
  // #7b: When true, the next pdfInput.onchange treats the upload as "add
  // additional pages to the current project" and routes through Prepare PDF
  // in append mode. Set by the Project Settings "Add additional PDF pages"
  // button. Always cleared at the top of pdfInput.onchange so it can't leak
  // across calls.
  let pendingAddAdditionalPages = false;
  let lastAuthUserId = null;
  let autoSaveDirty = false;
  let lastModifiedAt = 0;
  let pendingLastSessionRestore = null;
  let pendingCopyProject = null;
  let copyProjectModalTarget = null;
  let viewLinkEmailResolve = null;
  let saveInProgress = false;
  let savePdfInProgress = false;
  let saveProgressMessage = '';
  let lastSaveIncludedPdf = false;
  let lastLocalBackupAt = null;
  let lastLocalBackupOk = null;
  let pdfCacheWarnShown = false;
  let takeoffBackupWarnShown = false;
  let turnInInProgress = false;
  let inFlightRecoverySavePromise = null;
  let inFlightAutoSavePromise = null;
  let consecutiveAutoSaveFailures = 0;
  let firstAutoSaveFailureAt = 0;
  let nextAutoSaveAttemptAt = 0;
  let bannerShown = false;
  let inFlightAutoSaveController = null;
  let autoSaveAbortReason = null;
  let recoveryProbeInFlight = false;
  let recoveryProbeFiredForFailureCount = 0;
  let autoSaveLatencySamples = [];
  let autosaveSlowEmittedAt = 0;
  let autosaveMilestoneFiredAt = { f3: 0, f5: 0, f10: 0 };
  let lastSuccessfulSupabaseCallAt = 0;
  let lastSupabaseJsFailureAt = 0;
  let clientRecycleInFlight = false;
  let clientRecycleCountThisRun = 0;
  let lastClientRecycleAt = 0;
  let clientProbeInFlightGuard = false;
  let dirtyStartedAt = 0;
  let envelopeSnapshotFiredAt = 0;
  let envelopeSnapshotDirtyStamp = 0;
  // Autosave/checkout timing & threshold constants live in constants.js (see note in the Constants section).
  const autoRecheckoutCountByProject = new Map();
  const autoRecheckoutCapReachedAt = new Map();
  let lastAutoRecheckoutAt = 0;
  // Forward declaration: hoisted to IIFE scope so the autosave/keepalive/visibility
  // background callers (which live outside `if (SUPABASE_ENABLED)`) can reach it.
  // The real implementation is assigned inside the SUPABASE_ENABLED block; when
  // Supabase is disabled the no-op below stands in.
  var handleBackgroundCheckoutExpired = async function () {
    return { silentlyRecovered: false, reason: 'supabase_disabled' };
  };
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

  function noteAutoSaveOutcome(ok, errOrNull) {
    if (ok) {
      if (consecutiveAutoSaveFailures > 0) {
        pushSaveEvent('autosave_recovered', 'Cloud sync recovered', autosaveEventDetail({
          failures: consecutiveAutoSaveFailures,
          durationMs: firstAutoSaveFailureAt ? (Date.now() - firstAutoSaveFailureAt) : 0,
          clientRecycles: clientRecycleCountThisRun
        }));
      }
      consecutiveAutoSaveFailures = 0;
      firstAutoSaveFailureAt = 0;
      nextAutoSaveAttemptAt = 0;
      recoveryProbeFiredForFailureCount = 0;
      autosaveMilestoneFiredAt = { f3: 0, f5: 0, f10: 0 };
      clientRecycleCountThisRun = 0;
      lastSuccessfulSupabaseCallAt = Date.now();
      updateSyncPausedBanner(false);
      return;
    }
    consecutiveAutoSaveFailures++;
    if (!firstAutoSaveFailureAt) firstAutoSaveFailureAt = Date.now();
    nextAutoSaveAttemptAt = Date.now() + backoffDelayMs(consecutiveAutoSaveFailures, AUTOSAVE_BACKOFF_LEVELS_MS);
    if (consecutiveAutoSaveFailures >= AUTOSAVE_BANNER_THRESHOLD) updateSyncPausedBanner(true);

    if (consecutiveAutoSaveFailures === 3 && !autosaveMilestoneFiredAt.f3) {
      autosaveMilestoneFiredAt.f3 = Date.now();
      pushSaveEvent('autosave_failing_3', 'Cloud sync has failed 3 times in a row', autosaveEventDetail({ milestone: 3 }));
    }
    if (consecutiveAutoSaveFailures === AUTOSAVE_RECOVERY_THRESHOLD && !autosaveMilestoneFiredAt.f5) {
      autosaveMilestoneFiredAt.f5 = Date.now();
      pushSaveEvent('autosave_failing_5', 'Cloud sync has failed 5 times in a row', autosaveEventDetail({ milestone: 5 }));
      writeSaveLogsSnapshot('autosave_failing_5').catch(() => {});
    }
    if (consecutiveAutoSaveFailures === 10 && !autosaveMilestoneFiredAt.f10) {
      autosaveMilestoneFiredAt.f10 = Date.now();
      pushSaveEvent('autosave_failing_10', 'Cloud sync has failed 10 times in a row', autosaveEventDetail({ milestone: 10 }));
    }

    if (consecutiveAutoSaveFailures >= 3 &&
        recoveryProbeFiredForFailureCount !== consecutiveAutoSaveFailures) {
      recoveryProbeFiredForFailureCount = consecutiveAutoSaveFailures;
      const trigger = consecutiveAutoSaveFailures >= AUTOSAVE_RECOVERY_THRESHOLD ? 'failure_threshold' : 'failure_threshold_early';
      runRecoveryProbeAndMaybeRecycle(trigger).catch(() => {});
    }
  }

  function noteSupabaseJsFailure(context, err) {
    if (err && typeof err.status === 'number' && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
      return;
    }
    if (err && (err.code === 'CHECKOUT_EXPIRED' || err.code === 'CHECKOUT_NOT_OWNED' || err.code === '42501' || err.code === 'PGRST116')) {
      return;
    }
    lastSupabaseJsFailureAt = Date.now();
    try {
      pushSaveEvent('sbjs_failure_recorded', 'Supabase-js call failed (raw-fetch may be safer)', autosaveEventDetail({
        context: context || 'unknown',
        message: err?.message,
        name: err?.name,
        code: err?.code,
        status: err?.status
      }));
    } catch (_) {}
  }

  // Save/sync engine: this and the other `[sync]`-prefixed sections form the
  // scattered save/sync subsystem. See ARCHITECTURE.md "Save/sync engine map"
  // for the logical reading order.  (rg "SECTION: \[sync\]" app.js)
  // SECTION: [sync] Sync recovery & client recycle
  async function runRecoveryProbeAndMaybeRecycle(trigger) {
    const probe = await runRecoveryProbe(trigger).catch(() => null);
    if (!probe || !probe.ok) return;
    if (consecutiveAutoSaveFailures === 0) return;
    const clientProbe = await runSupabaseClientProbe(trigger).catch(() => null);
    if (clientProbe && !clientProbe.ok) {
      await recreateSupabaseClient('client_probe_failed:' + trigger).catch(() => {});
    } else if (!clientProbe) {
      await recreateSupabaseClient('client_probe_threw:' + trigger).catch(() => {});
    }
  }

  // Proactively recycle a wedged supabase-js client on a long-idle return. The
  // raw-fetch recovery probe can pass (the network is fine) while the supabase-js
  // client is wedged after sleep/background -- then every .rpc/.from in the wake
  // path hangs to its full timeout (probeCheckoutLock 10s, refreshProjectPermissions
  // 8s x2). runRecoveryProbeAndMaybeRecycle never fires here because an idle user
  // has zero autosave failures, so detection has to be an ACTIVE probe rather than
  // a failure count. Probe the client and, if it's wedged, recreate it BEFORE the
  // wake's checkout/permissions refresh runs. Returns true iff a recycle happened.
  async function recycleClientIfWedgedOnIdleReturn(trigger) {
    if (!SUPABASE_ENABLED || !supabase) return false;
    const clientProbe = await runSupabaseClientProbe(trigger).catch(() => null);
    if (clientProbe && clientProbe.ok) return false;
    // probe failed (recorded via noteSupabaseJsFailure) or threw -> looks wedged.
    // recreateSupabaseClient is cooldown- and in-flight-guarded internally.
    const reason = (clientProbe ? 'idle_return_client_wedged:' : 'idle_return_client_probe_threw:') + trigger;
    return await recreateSupabaseClient(reason).catch(() => false);
  }

  function updateSyncPausedBanner(show) {
    const el = document.getElementById('syncPausedBanner');
    if (!el) return;
    const next = !!show;
    if (next === bannerShown) return;
    bannerShown = next;
    el.style.display = next ? 'flex' : 'none';
  }

  async function retrySyncNow() {
    if (inFlightAutoSaveController) {
      autoSaveAbortReason = 'user_retry';
      try { inFlightAutoSaveController.abort(); } catch (_) {}
      inFlightAutoSaveController = null;
    }
    nextAutoSaveAttemptAt = 0;
    autoSaveDirty = true;
    try { await supabase.auth.getSession(); } catch (_) {}
    pushSaveEvent('manual_sync_retry', 'User requested manual retry');
  }

  function recordAutosaveLatency(ms) {
    if (typeof ms !== 'number' || ms < 0) return;
    autoSaveLatencySamples.push(ms);
    if (autoSaveLatencySamples.length > AUTOSAVE_SLOW_WINDOW) autoSaveLatencySamples.shift();
    if (autoSaveLatencySamples.length < AUTOSAVE_SLOW_MIN_SAMPLES) return;
    const p95 = percentile(autoSaveLatencySamples, 0.95);
    if (p95 > AUTOSAVE_SLOW_MS && Date.now() - autosaveSlowEmittedAt > AUTOSAVE_SLOW_DEBOUNCE_MS) {
      autosaveSlowEmittedAt = Date.now();
      pushSaveEvent('autosave_slow', 'Cloud writes are slow', JSON.stringify({
        p95, n: autoSaveLatencySamples.length, latest: ms
      }));
    }
  }

  function captureNetworkInfoDetail() {
    if (typeof navigator === 'undefined' || !navigator.connection) return undefined;
    const c = navigator.connection;
    try {
      return JSON.stringify({
        effectiveType: c.effectiveType,
        downlink: c.downlink,
        rtt: c.rtt,
        saveData: c.saveData
      });
    } catch (_) { return undefined; }
  }

  function captureNetworkInfoObj() {
    if (typeof navigator === 'undefined' || !navigator.connection) return null;
    const c = navigator.connection;
    try {
      return {
        effectiveType: c.effectiveType,
        downlink: c.downlink,
        rtt: c.rtt,
        saveData: c.saveData
      };
    } catch (_) { return null; }
  }

  function autosaveEventDetail(extra) {
    const ctx = {
      failures: consecutiveAutoSaveFailures,
      online: (typeof navigator !== 'undefined') ? navigator.onLine : null,
      msSinceLastSuccess: lastSuccessfulSupabaseCallAt ? (Date.now() - lastSuccessfulSupabaseCallAt) : null,
      network: captureNetworkInfoObj(),
      visibility: (typeof document !== 'undefined') ? document.visibilityState : null
    };
    if (extra && typeof extra === 'object') Object.assign(ctx, extra);
    try { return JSON.stringify(ctx); } catch (_) { return ''; }
  }

  // serializeSaveErrorForEvent + saveDebugSerializeError moved (deduped) to
  // save-utils.js as the single pure serializeSaveError; formatSaveStatusErrDetail
  // moved there too. All three are referenced here by bare name (save-utils
  // globals).

  async function runRecoveryProbe(trigger) {
    if (recoveryProbeInFlight) return { ok: false, ms: 0, status: null, errMsg: 'in_flight' };
    if (!SUPABASE_ENABLED || !SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, ms: 0, status: null, errMsg: 'disabled' };
    recoveryProbeInFlight = true;
    const runId = saveDebugRunId();
    saveDebugLog('autosave.recovery.start', { runId, trigger, failures: consecutiveAutoSaveFailures });
    pushSaveEvent('autosave_recovery_probe', 'Attempting to refresh connection', JSON.stringify({ trigger }));
    try {
      const token = state.supabaseSession?.access_token || null;
      const controller = new AbortController();
      const timer = setTimeout(() => { try { controller.abort(); } catch (_) {} }, AUTOSAVE_RECOVERY_TIMEOUT_MS);
      const t0 = Date.now();
      let ok = false, status = null, errMsg = null, diag = null;
      try {
        const res = await fetch(SUPABASE_URL + '/rest/v1/projects?select=id&limit=1', {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            ...(token ? { Authorization: 'Bearer ' + token } : {})
          },
          cache: 'no-store',
          signal: controller.signal
        });
        status = res.status;
        ok = res.ok;
        diag = extractResponseDiagnostics(res.headers);
      } catch (e) {
        errMsg = e?.message || String(e);
      } finally {
        clearTimeout(timer);
      }
      const ms = Date.now() - t0;
      if (ok) {
        saveDebugLog('autosave.recovery.ok', { runId, ms, status });
        pushSaveEvent('autosave_recovery_ok', 'Connection refreshed', JSON.stringify({ ms, status }));
        nextAutoSaveAttemptAt = 0;
        lastSuccessfulSupabaseCallAt = Date.now();
      } else {
        saveDebugLog('autosave.recovery.err', { runId, ms, status, message: errMsg });
        pushSaveEvent('autosave_recovery_err', 'Recovery probe failed', JSON.stringify({ ms, status, message: errMsg, diag }));
      }
      return { ok, ms, status, errMsg };
    } finally {
      recoveryProbeInFlight = false;
    }
  }

  async function runSupabaseClientProbe(trigger) {
    if (!SUPABASE_ENABLED || !supabase) return { ok: false, ms: 0, errMsg: 'disabled' };
    if (clientProbeInFlightGuard) return { ok: false, ms: 0, errMsg: 'in_flight' };
    clientProbeInFlightGuard = true;
    const t0 = Date.now();
    let ok = false, errMsg = null, errName = null, errStatus = null, errCode = null;
    try {
      const probeOp = withTimeout(
        (signal) => supabase.from('projects').select('id').limit(1).abortSignal(signal),
        CLIENT_PROBE_TIMEOUT_MS,
        'Client probe'
      );
      const { error } = await probeOp;
      if (error) {
        errMsg = error.message || String(error);
        errName = error.name;
        errStatus = (typeof error.status === 'number') ? error.status : null;
        errCode = error.code || null;
      } else {
        ok = true;
      }
    } catch (e) {
      errMsg = e?.message || String(e);
      errName = e?.name;
      errStatus = (typeof e?.status === 'number') ? e.status : null;
      errCode = e?.code || null;
    } finally {
      clientProbeInFlightGuard = false;
    }
    const ms = Date.now() - t0;
    if (ok) {
      saveDebugLog('autosave.client_probe.ok', { trigger, ms });
      pushSaveEvent('autosave_client_probe_ok', 'Supabase client responsive', autosaveEventDetail({ trigger, ms }));
      lastSuccessfulSupabaseCallAt = Date.now();
    } else {
      saveDebugLog('autosave.client_probe.err', { trigger, ms, message: errMsg, name: errName });
      pushSaveEvent('autosave_client_probe_err', 'Supabase client appears wedged', autosaveEventDetail({ trigger, ms, message: errMsg, name: errName }));
      noteSupabaseJsFailure('client_probe', { message: errMsg, name: errName, status: errStatus, code: errCode });
    }
    return { ok, ms, errMsg };
  }

  async function recreateSupabaseClient(reason) {
    if (!SUPABASE_ENABLED || typeof window.supabase === 'undefined') return false;
    if (clientRecycleInFlight) {
      saveDebugLog('autosave.client_recycle.skip', { reason, why: 'in_flight' });
      pushSaveEvent('client_recycle_skipped_inflight', 'Client recycle skipped (already running)', autosaveEventDetail({ reason }));
      return false;
    }
    if (Date.now() - lastClientRecycleAt < CLIENT_RECYCLE_COOLDOWN_MS) {
      saveDebugLog('autosave.client_recycle.skip', { reason, why: 'cooldown' });
      pushSaveEvent('client_recycle_skipped_cooldown', 'Client recycle skipped (cooldown)', autosaveEventDetail({ reason, msSinceLastRecycle: Date.now() - lastClientRecycleAt, cooldownMs: CLIENT_RECYCLE_COOLDOWN_MS }));
      return false;
    }
    clientRecycleInFlight = true;
    const t0 = Date.now();
    const previousSession = state.supabaseSession || null;
    let resubscribed = false;
    try {
      try { if (supabase) await supabase.removeAllChannels(); } catch (_) {}
      projectsCheckoutChannel = null;
      const { createClient } = window.supabase;
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      if (previousSession?.access_token && previousSession?.refresh_token) {
        try {
          await withTimeout(
            supabase.auth.setSession({
              access_token: previousSession.access_token,
              refresh_token: previousSession.refresh_token
            }),
            5000,
            'Client recycle setSession'
          );
        } catch (sessErr) {
          saveDebugLog('autosave.client_recycle.setSession_err', { reason, message: sessErr?.message });
        }
      }
      if (state.currentProjectId && state.supabaseSession?.user) {
        try {
          subscribeToProjectCheckoutChanges(state.currentProjectId);
          resubscribed = true;
        } catch (rtErr) {
          saveDebugLog('autosave.client_recycle.resubscribe_err', { reason, message: rtErr?.message });
        }
      }
      lastClientRecycleAt = Date.now();
      clientRecycleCountThisRun++;
      const elapsedMs = Date.now() - t0;
      saveDebugLog('autosave.client_recycle.ok', { reason, elapsedMs, resubscribed });
      pushSaveEvent('autosave_client_recycled', 'Supabase client recreated', autosaveEventDetail({ reason, elapsedMs, resubscribed, recycleCount: clientRecycleCountThisRun }));
      return true;
    } catch (e) {
      saveDebugLog('autosave.client_recycle.err', { reason, message: e?.message, name: e?.name });
      pushSaveEvent('autosave_client_recycle_err', 'Supabase client recreate failed', autosaveEventDetail({ reason, message: e?.message, name: e?.name }));
      return false;
    } finally {
      clientRecycleInFlight = false;
    }
  }

  async function rawProjectsUpdate(projectId, payload, signal) {
    if (!SUPABASE_ENABLED || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase not configured');
    }
    const accessToken = state.supabaseSession?.access_token || '';
    if (!accessToken) throw new Error('No access token for raw projects update');
    const url = SUPABASE_URL + '/rest/v1/projects?id=eq.' + encodeURIComponent(projectId);
    const res = await fetch(url, {
      method: 'PATCH',
      cache: 'no-store',
      signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch (_) {}
      const e = new Error('Raw projects update failed: ' + res.status + (body ? (' ' + body.slice(0, 200)) : ''));
      e.status = res.status;
      e.code = 'RAW_UPDATE_HTTP_' + res.status;
      e.diag = extractResponseDiagnostics(res.headers);
      throw e;
    }
    return { ok: true, status: res.status };
  }

  async function rawProjectsInsert(payload, signal) {
    if (!SUPABASE_ENABLED || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return { data: null, error: { message: 'Supabase not configured', status: 0, code: 'RAW_INSERT_NOT_CONFIGURED' } };
    }
    const accessToken = state.supabaseSession?.access_token || '';
    if (!accessToken) {
      return { data: null, error: { message: 'No access token for raw projects insert', status: 401, code: 'RAW_INSERT_NO_TOKEN' } };
    }
    const url = SUPABASE_URL + '/rest/v1/projects';
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        signal,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      return { data: null, error: { message: (e && e.message) || 'fetch_failed', status: 0, name: e && e.name, code: 'RAW_INSERT_FETCH_ERR' } };
    }
    let body = null;
    let bodyText = '';
    try {
      bodyText = await res.text();
      if (bodyText) body = JSON.parse(bodyText);
    } catch (_) {}
    if (!res.ok) {
      const message = (body && (body.message || body.error)) || ('HTTP ' + res.status + (bodyText ? (' ' + bodyText.slice(0, 200)) : ''));
      return { data: null, error: { message, status: res.status, code: (body && body.code) || ('RAW_INSERT_HTTP_' + res.status), diag: extractResponseDiagnostics(res.headers) } };
    }
    const row = Array.isArray(body) ? body[0] : body;
    return { data: row || null, error: null };
  }

  async function rawCheckInProject(projectId, signal) {
    if (!SUPABASE_ENABLED || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase not configured');
    }
    const accessToken = state.supabaseSession?.access_token || '';
    if (!accessToken) throw new Error('No access token for raw check_in_project');
    const url = SUPABASE_URL + '/rest/v1/rpc/check_in_project';
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_project_id: projectId })
    });
    let bodyJson = null;
    let bodyText = '';
    try {
      bodyText = await res.text();
      if (bodyText) bodyJson = JSON.parse(bodyText);
    } catch (_) {}
    if (!res.ok) {
      const e = new Error('Raw check_in failed: ' + res.status + (bodyText ? (' ' + bodyText.slice(0, 200)) : ''));
      e.status = res.status;
      e.code = 'RAW_RPC_HTTP_' + res.status;
      e.diag = extractResponseDiagnostics(res.headers);
      return { data: bodyJson, error: e };
    }
    return { data: bodyJson, error: null };
  }

  // Raw-fetch twin of supabase.rpc('list_accessible_projects'), and it exists for
  // the same reason rawCheckInProject does: when the supabase-js client wedges
  // after a long background/sleep, raw fetch to the same REST endpoint still
  // returns in well under a second. Mirrors rawCheckInProject's return contract.
  async function rawListAccessibleProjects(signal) {
    if (!SUPABASE_ENABLED || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase not configured');
    }
    const accessToken = state.supabaseSession?.access_token || '';
    if (!accessToken) throw new Error('No access token for raw list_accessible_projects');
    const url = SUPABASE_URL + '/rest/v1/rpc/list_accessible_projects';
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    let bodyJson = null;
    let bodyText = '';
    try {
      bodyText = await res.text();
      if (bodyText) bodyJson = JSON.parse(bodyText);
    } catch (_) {}
    if (!res.ok) {
      const e = new Error('Raw list_accessible_projects failed: ' + res.status + (bodyText ? (' ' + bodyText.slice(0, 200)) : ''));
      e.status = res.status;
      e.code = 'RAW_RPC_HTTP_' + res.status;
      e.diag = extractResponseDiagnostics(res.headers);
      return { data: bodyJson, error: e };
    }
    return { data: bodyJson, error: null };
  }

  // SECTION: [sync] Global force reload
  async function checkGlobalForceReload() {
    if (!SUPABASE_ENABLED || !supabase || !state.supabaseSession?.user) return;
    try {
      const { data, error } = await withTimeout(
        supabase.from('system_settings').select('value_ts,value_text').eq('key', 'force_reload_after').single(),
        5000,
        'check global reload'
      );
      if (error || !data?.value_ts) return;
      const serverTs = new Date(data.value_ts).getTime();
      const localTs = parseInt(localStorage.getItem(GLOBAL_RELOAD_STAMP_KEY) || '0', 10);
      state.globalReloadAtServerMs = serverTs;
      state.globalReloadReason = data.value_text || '';
      if (serverTs > localTs) doGlobalReloadNow('boot');
    } catch (_) {}
  }

  function doGlobalReloadNow(trigger) {
    const stamp = String(state.globalReloadAtServerMs || Date.now());
    try { localStorage.setItem(PENDING_GLOBAL_RELOAD_STAMP_KEY, stamp); } catch (_) {}
    try { pushSaveEvent('global_reload_triggered', 'Admin triggered global reload', JSON.stringify({ trigger, reason: state.globalReloadReason || '' })); } catch (_) {}
    try { indexedDB.deleteDatabase('clickcount-pdf-cache'); } catch (_) {}
    const keysToRemove = ['clickcount-last-project', 'clickcount-save-error', 'takeoff-state', 'lineModifiers', 'plumbingModifiers', 'groupColorDisplay', 'pagesTitlesTruncated', 'hideUnmarkedPagesFromSidebar', 'counterSearch', 'lineTypeSearch', 'linesSearch', 'linesTypeExpanded', 'zoomSettings', 'specificPagesIncludeReport', 'customIconPaths'];
    for (const k of keysToRemove) { try { localStorage.removeItem(k); } catch (_) {} }
    location.reload();
  }
  if (typeof window !== 'undefined') {
    try {
      const commitPendingReloadStamp = () => {
        try {
          const pending = localStorage.getItem(PENDING_GLOBAL_RELOAD_STAMP_KEY);
          if (!pending) return;
          // We are running this code in a fresh document, so a navigation/load
          // has happened. Treat any non-"prerender" navigation as a confirmed
          // reload commit and write the real stamp.
          let confirmedReload = true;
          try {
            const entries = (performance.getEntriesByType && performance.getEntriesByType('navigation')) || [];
            if (entries.length && entries.every(e => e.type === 'prerender')) confirmedReload = false;
          } catch (_) {}
          if (confirmedReload) {
            localStorage.setItem(GLOBAL_RELOAD_STAMP_KEY, pending);
            localStorage.removeItem(PENDING_GLOBAL_RELOAD_STAMP_KEY);
            try { pushSaveEvent && pushSaveEvent('global_reload_committed', 'Global reload stamp committed after successful reload', pending); } catch (_) {}
          }
        } catch (_) {}
      };
      if (document.readyState === 'complete' || document.readyState === 'interactive') commitPendingReloadStamp();
      else window.addEventListener('load', commitPendingReloadStamp, { once: true });
      window.addEventListener('pageshow', commitPendingReloadStamp, { once: true });
    } catch (_) {}
  }

  function showGlobalReloadBanner() {
    const el = document.getElementById('globalReloadBanner');
    const txt = document.getElementById('globalReloadBannerText');
    if (!el) return;
    const reason = state.globalReloadReason ? ' Reason: ' + state.globalReloadReason : '';
    if (txt) txt.textContent = 'Reload required for update.' + reason;
    el.style.display = '';
  }

  // isTransientSaveError(e) lives in save-utils.js (loaded before this IIFE).

  function isSaveDebugEnabled() {
    try {
      if (typeof window.CLICKCOUNT_DEBUG_SAVE !== 'undefined' && window.CLICKCOUNT_DEBUG_SAVE) return true;
      return localStorage.getItem('clickcount-debug-save') === '1';
    } catch (_) { return false; }
  }
  function setSaveDebugEnabled(on) {
    try {
      if (on) localStorage.setItem('clickcount-debug-save', '1');
      else localStorage.removeItem('clickcount-debug-save');
    } catch (_) {}
  }
  function saveDebugRunId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function saveDebugLog(phase, payload) {
    if (!isSaveDebugEnabled()) return;
    const obj = payload && typeof payload === 'object' ? payload : {};
    console.log('[SaveDebug]', phase, obj);
    try {
      let detailStr;
      try { detailStr = JSON.stringify(obj); } catch (_) { detailStr = String(obj); }
      if (detailStr && detailStr.length > 4096) detailStr = detailStr.slice(0, 4096) + '…';
      pushSaveEvent('debug', phase, detailStr);
    } catch (_) {}
  }
  function saveDebugLogError(runId, context, e) {
    if (!isSaveDebugEnabled()) return;
    const msg = (e && e.message) || '';
    if (msg.includes('timed out')) {
      saveDebugLog(context + '.timeout', { runId, note: 'The HTTP request may still complete server-side.', message: msg });
    } else {
      saveDebugLog(context + '.error', Object.assign({ runId }, serializeSaveError(e)));
    }
  }

  function getSaveStatusLogWindowMs() {
    return isSaveDebugEnabled() ? SAVE_STATUS_LOG_VERBOSE_MS : SAVE_STATUS_LOG_MS;
  }
  let saveStatusLog = [];
  // saveStatusModalTickTimer moved to features/save-status.js (private to the modal).
  let lastCloudSaveAttemptFailed = false;
  let checkoutExpiredNeedsAttention = false;
  let checkoutExpiredToastShown = false;
  let saveStatusDirtyLogAt = 0;
  function clearCheckoutExpiredAttention() {
    checkoutExpiredNeedsAttention = false;
    checkoutExpiredToastShown = false;
    suspendAutoSaveUntilCheckout = false;
    updateSaveStatusIndicator();
  }
  function pruneSaveStatusLog() {
    const cutoff = Date.now() - getSaveStatusLogWindowMs();
    while (saveStatusLog.length && saveStatusLog[0].ts < cutoff) saveStatusLog.shift();
  }
  // SECTION: [sync] Save Status log & envelope
  // Per-tab session id, stamped into the export envelope so concurrent tabs of
  // the same project (a real save/sync race) are distinguishable in logs.
  const TAB_SESSION_ID = uid();
  function pushSaveEvent(kind, message, detail) {
    if (!SUPABASE_ENABLED) return;
    pruneSaveStatusLog();
    saveStatusLog.push({ ts: Date.now(), kind: kind, message: message || '', detail: detail !== undefined && detail !== '' ? detail : undefined });
  }
  function getProjectSummaryForLogs() {
    try {
      const pages = (state && state.pages) || [];
      // Count across the current per-page `canvases[].annotations` shape (with a
      // fallback to the legacy per-page `annotations` shape), using the field
      // names the app actually writes (counterMarkers / quickLines / polylines).
      // The old code read `a.counts` / `a.lines` off `p.annotations`, which never
      // exist in the canvases shape -- so every count logged as 0 even on full
      // projects. counters/lines reuse getProjectCounts so the two never drift.
      const { counter_count: counters, line_count: lines } = getProjectCounts({ pages });
      let multiplyZones = 0, scaleZones = 0, highlights = 0, notes = 0;
      pages.forEach(p => {
        const canvases = p?.canvases || (p?.annotations ? [{ annotations: p.annotations }] : []);
        canvases.forEach(c => {
          const a = c?.annotations || {};
          multiplyZones += (a.multiplyZones || []).length;
          scaleZones    += (a.scaleZones || []).length;
          highlights    += (a.highlights || []).length;
          notes         += (a.notes || []).length;
        });
      });
      // Payload sizing (export-time only -- never called per save event). An
      // approximation of the cloud-save data blob, for "saves fail on big
      // projects / large PDFs" diagnosis.
      let dataJsonBytes = null;
      try {
        dataJsonBytes = JSON.stringify({
          pages: pages.map(p => p.annotations || p.canvases || null),
          counters: state.counters, lineTypes: state.lineTypes, groups: state.groups
        }).length;
      } catch (_) {}
      const pdfBytes = (typeof state.pdfBufferSize === 'number') ? state.pdfBufferSize : null;
      return {
        projectId: state.currentProjectId,
        projectName: state.currentProjectName,
        pageCount: pages.length,
        pagesWithScale: pages.filter(p => p.scale && p.scale.feet > 0).length,
        counters, lines, multiplyZones, scaleZones, highlights, notes,
        isAdmin: !!state.isAdmin,
        isViewer: !!state.isViewer,
        // Checkout ownership (multi-user contention / expiry diagnosis)
        checkedOutBy: state.checkedOutBy || null,
        checkedOutEmail: state.checkedOutEmail || null,
        checkedOutAt: state.checkedOutAt || null,
        checkedOutAgoMs: state.checkedOutAt ? (Date.now() - new Date(state.checkedOutAt).getTime()) : null,
        canCheckOut: !!state.canCheckOut,
        projectOwnerId: state.projectOwnerId || null,
        loadedViaViewLink: !!state.loadedViaViewLink,
        // Payload sizing
        dataJsonBytes,
        pdfBufferBytes: pdfBytes,
        nearPdfCap: (pdfBytes != null && typeof PDF_MAX_SIZE_BYTES === 'number') ? (pdfBytes > PDF_MAX_SIZE_BYTES * 0.9) : null
      };
    } catch (_) { return null; }
  }

  async function buildSaveLogsEnvelopeWithSnapshots() {
    const envelope = buildSaveLogsEnvelope();
    try {
      const snapshots = await readSaveLogsSnapshots(5);
      if (snapshots && snapshots.length) envelope.autoSnapshotEnvelopes = snapshots;
    } catch (_) {}
    // Storage health -- catches "my work didn't recover" / private-mode / disk-full.
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        envelope.storage = { usage: est.usage ?? null, quota: est.quota ?? null };
      }
    } catch (_) {}
    envelope.lastLocalBackup = { at: lastLocalBackupAt, ok: lastLocalBackupOk };
    return envelope;
  }

  function buildSaveLogsEnvelope() {
    let userEmail = null;
    try { userEmail = state.supabaseSession?.user?.email || null; } catch (_) {}
    return {
      schema: 'clickcount-save-logs/v1',
      capturedAt: new Date().toISOString(),
      tabSessionId: TAB_SESSION_ID,
      projectRef: (typeof SUPABASE_URL === 'string' ? ((SUPABASE_URL.match(/^https?:\/\/([^.]+)\./) || [])[1] || null) : null),
      // Triage note for anyone -- especially an AI/LLM -- handed an exported copy
      // of these logs: these are CLIENT-side save/sync telemetry events. To
      // root-cause a failure, cross-reference each error event against THIS
      // project's Supabase server logs (Supabase MCP `get_logs` with service
      // "api", or the dashboard Logs Explorer) by timestamp + path + status_code
      // (and tabSessionId / user.email). The authoritative server request id
      // (sb-request-id) is recorded server-side but is NOT browser-readable here
      // (it is omitted from Access-Control-Expose-Headers), so it will be absent
      // from these events -- get it from the server logs, not from here.
      analysisNote: 'Client-side save/sync telemetry. To root-cause a failure, cross-reference each error event with this project\'s Supabase server logs (Supabase MCP get_logs service:"api", or the dashboard Logs Explorer) by timestamp + path + status_code (and tabSessionId / user.email). The authoritative sb-request-id lives in the server logs, not here (it is not browser-readable due to CORS). projectRef is included above.',
      user: {
        email: userEmail,
        isAdmin: !!state.isAdmin,
        isViewer: !!state.isViewer
      },
      browser: {
        ua: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
        platform: (typeof navigator !== 'undefined' && navigator.platform) || null,
        onLine: (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : null,
        network: captureNetworkInfoDetail() || null
      },
      timing: {
        lastSuccessfulSupabaseCallAt: (typeof lastSuccessfulSupabaseCallAt !== 'undefined') ? lastSuccessfulSupabaseCallAt : null,
        serverClockOffsetMs: (typeof serverClockOffsetMs !== 'undefined') ? serverClockOffsetMs : null,
        consecutiveAutoSaveFailures: (typeof consecutiveAutoSaveFailures !== 'undefined') ? consecutiveAutoSaveFailures : null,
        autoSaveDirty: (typeof autoSaveDirty !== 'undefined') ? autoSaveDirty : null,
        saveInProgress: (typeof saveInProgress !== 'undefined') ? saveInProgress : null,
        turnInInProgress: (typeof turnInInProgress !== 'undefined') ? turnInInProgress : null,
        verbose: isSaveDebugEnabled(),
        windowMs: getSaveStatusLogWindowMs(),
        // Token expiry -- catches the JWT-expired 401 class on long-open tabs
        sessionExpiresAt: (state.supabaseSession && state.supabaseSession.expires_at) || null,
        secondsToExpiry: secondsToExpiry(state.supabaseSession && state.supabaseSession.expires_at, Date.now()),
        // Degradation metrics (computed in the engine; surfaced here for export)
        clientRecycles: (typeof clientRecycleCountThisRun !== 'undefined') ? clientRecycleCountThisRun : null,
        autosaveLatencyP50: percentile(autoSaveLatencySamples, 0.5),
        autosaveLatencyP95: percentile(autoSaveLatencySamples, 0.95),
        autosaveLatencyN: (autoSaveLatencySamples && autoSaveLatencySamples.length) || 0,
        degradedForMs: firstAutoSaveFailureAt ? (Date.now() - firstAutoSaveFailureAt) : 0,
        nextAutoSaveAttemptInMs: nextAutoSaveAttemptAt ? Math.max(0, nextAutoSaveAttemptAt - Date.now()) : 0
      },
      project: getProjectSummaryForLogs(),
      events: saveStatusLog.slice()
    };
  }

  function perfLog(label, durationMs, extra) {
    const msg = '[Perf] ' + label + ': ' + durationMs + 'ms';
    if (extra && Object.keys(extra).length) console.log(msg, extra);
    else console.log(msg);
  }

  let backupDebounceTimer = null;
  let dirtyGeneration = 0;
  // SECTION: [sync] Dirty tracking & local session reset
  function markProjectDirty() {
    if (state.isViewer || !state.pages.length && !state.currentProjectId) return;
    const wasDirty = autoSaveDirty;
    autoSaveDirty = true;
    dirtyGeneration++;
    lastModifiedAt = Date.now();
    if (!wasDirty) dirtyStartedAt = Date.now();
    invalidateFooterTotals();
    if (SUPABASE_ENABLED && state.supabaseSession?.user && !state.isViewer) {
      const now = Date.now();
      if (now - saveStatusDirtyLogAt >= 2000) {
        saveStatusDirtyLogAt = now;
        pushSaveEvent('dirty', 'Project marked dirty (pending cloud sync)', autosaveEventDetail({ dirtyForMs: dirtyStartedAt ? (now - dirtyStartedAt) : 0 }));
      }
    }
    if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
    backupDebounceTimer = setTimeout(() => { backupDebounceTimer = null; writeTakeoffStateBackup(); }, 1000);
    if (!suspendAutoSaveUntilCheckout && !checkoutExpiredNeedsAttention && state.currentProjectId && state.checkedOutBy === state.supabaseSession?.user?.id && Date.now() - lastCheckoutRefreshAt >= CHECKOUT_REFRESH_DEBOUNCE_MS) {
      lastCheckoutRefreshAt = Date.now();
      if (supabase) supabase.rpc('refresh_checkout_activity', { p_project_id: state.currentProjectId }).then(({ data }) => {
        updateServerClockFromRpc(data);
        if (data?.ok) state.checkedOutAt = data.checked_out_at || new Date().toISOString();
      });
    }
  }

  let undoStack = [];
  let redoStack = [];

  // getProjectCounts(data) lives in save-utils.js (loaded before this IIFE).

  function getUndoableSnapshot() {
    return {
      pages: state.pages.map(p => ({
        canvases: JSON.parse(JSON.stringify(p.canvases || [])),
        scale: p.scale ? { ...p.scale } : null,
        rotation: p.rotation ?? 0,
        label: p.label
      })),
      counters: JSON.parse(JSON.stringify(state.counters)),
      lineTypes: JSON.parse(JSON.stringify(state.lineTypes)),
      groups: JSON.parse(JSON.stringify(state.groups || []))
    };
  }

  function pushUndoSnapshot() {
    if (state.isViewer || !state.pages.length) return;
    undoStack.push(getUndoableSnapshot());
    if (undoStack.length > UNDO_STACK_SIZE) undoStack.shift();
    redoStack = [];
  }

  function applySnapshot(snap) {
    state.pages.forEach((p, i) => {
      if (snap.pages[i]) {
        if (Array.isArray(snap.pages[i].canvases)) p.canvases = snap.pages[i].canvases;
        else if (snap.pages[i].annotations) { p.canvases = [{ id: uid(), name: 'Main', annotations: snap.pages[i].annotations }]; }
        p.scale = snap.pages[i].scale;
        p.rotation = snap.pages[i].rotation ?? 0;
        if (snap.pages[i].label != null) p.label = snap.pages[i].label;
      }
    });
    state.counters = snap.counters;
    state.lineTypes = snap.lineTypes;
    if (Array.isArray(snap.groups)) state.groups = ensureGroupColors(snap.groups);
    state.quickLineStart = null;
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.drawingPolyline = null;
    state.editingPolyline = null;
    if (state.activeCounterType && !state.counters.some(c => c.id === state.activeCounterType)) state.activeCounterType = null;
    if (state.activeLineTypeId && !state.lineTypes.some(lt => lt.id === state.activeLineTypeId)) state.activeLineTypeId = null;
  }

  function undo() {
    if (undoStack.length === 0 || state.isViewer) return;
    redoStack.push(getUndoableSnapshot());
    const prev = undoStack.pop();
    applySnapshot(prev);
    markProjectDirty();
    renderPdf();
    updateUI();
  }

  function redo() {
    if (redoStack.length === 0 || state.isViewer) return;
    undoStack.push(getUndoableSnapshot());
    const next = redoStack.pop();
    applySnapshot(next);
    markProjectDirty();
    renderPdf();
    updateUI();
  }

  function clearUndoStacks() {
    undoStack = [];
    redoStack = [];
  }

  function resetAutosaveDegradedState() {
    consecutiveAutoSaveFailures = 0;
    firstAutoSaveFailureAt = 0;
    nextAutoSaveAttemptAt = 0;
    recoveryProbeFiredForFailureCount = 0;
    autosaveMilestoneFiredAt = { f3: 0, f5: 0, f10: 0 };
    autoSaveLatencySamples = [];
    autosaveSlowEmittedAt = 0;
    envelopeSnapshotFiredAt = 0;
    envelopeSnapshotDirtyStamp = 0;
    dirtyStartedAt = 0;
    clientRecycleCountThisRun = 0;
    lastClientRecycleAt = 0;
    autoSaveAbortReason = null;
    try { updateSyncPausedBanner(false); } catch (_) {}
  }

  function resetLocalSessionState(opts) {
    opts = opts || {};
    const keepArtboard = !!opts.keepArtboard;
    if (inFlightAutoSaveController) {
      try { autoSaveAbortReason = autoSaveAbortReason || 'session_reset'; inFlightAutoSaveController.abort(); } catch (_) {}
      inFlightAutoSaveController = null;
    }
    try { subscribeToProjectCheckoutChanges(null); } catch (_) {}
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
    lastLocalBackupAt = null;
    lastSaveIncludedPdf = false;
    state.pendingCanvasLoad = null;
    state.groups = [];
    state.maxZoom = null;
    state.activeCanvasIdByPage = {};
    state.checkedOutBy = null;
    state.checkedOutAt = null;
    state.checkedOutEmail = null;
    state.isViewer = false;
    state.loadedViaViewLink = false;
    state.canCheckOut = false;
    autoSaveDirty = false;
    dirtyGeneration = 0;
    saveInProgress = false;
    savePdfInProgress = false;
    turnInInProgress = false;
    lastModifiedAt = 0;
    pendingCopyProject = null;
    pendingImportCanvasAfterPdf = false;
    pendingLastSessionRestore = null;
    clearUndoStacks();
    resetAutosaveDegradedState();
    pdfCacheWarnShown = false;
    takeoffBackupWarnShown = false;
    saveStatusLog = [];
    state.userActivityAllRowsCache = null;
    state.userActivityViewMode = 'events';
    try { autoRecheckoutCountByProject.clear(); } catch (_) {}
    try { autoRecheckoutCapReachedAt.clear(); } catch (_) {}
    lastAutoRecheckoutAt = 0;
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
  async function probeCheckoutLock(runId) {
    const userId = state.supabaseSession?.user?.id;
    if (!SUPABASE_ENABLED || !supabase || !state.currentProjectId || !userId) {
      return { ok: false, error: new Error('Not signed in or no project') };
    }
    if (state.checkedOutBy !== userId) {
      return { ok: false, expired: true, error: 'Not the lock holder' };
    }
    const checkedAt = state.checkedOutAt ? new Date(state.checkedOutAt).getTime() : 0;
    const ageMs = checkedAt ? serverNowMs() - checkedAt : null;
    saveDebugLog('probe.start', { runId, ageMs, projectId: state.currentProjectId });
    const t0 = Date.now();
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('refresh_checkout_activity', { p_project_id: state.currentProjectId }),
        10000,
        'Probe checkout'
      );
      const roundTripMs = Date.now() - t0;
      updateServerClockFromRpc(data);
      if (error) {
        saveDebugLog('probe.error', { runId, ageMs, roundTripMs, message: error.message, code: error.code });
        return { ok: false, error };
      }
      if (data?.ok) {
        state.checkedOutAt = data.checked_out_at || new Date().toISOString();
        lastCheckoutRefreshAt = Date.now();
        lastSuccessfulSupabaseCallAt = Date.now();
        saveDebugLog('probe.ok', { runId, ageMs, roundTripMs });
        return { ok: true, refreshed: true };
      }
      saveDebugLog('probe.expired', { runId, ageMs, roundTripMs, serverError: data?.error });
      return { ok: false, expired: true, error: data?.error || 'Checkout expired' };
    } catch (e) {
      const roundTripMs = Date.now() - t0;
      saveDebugLog('probe.error', { runId, ageMs, roundTripMs, message: e?.message, name: e?.name });
      return { ok: false, error: e };
    }
  }

  async function sha256Hex(buffer) {
    const t0 = Date.now();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    perfLog('sha256Hex', Date.now() - t0, { bytes: buffer.byteLength });
    return hex;
  }

  // IndexedDB store names & caps live in constants.js (see note in the Constants section).
  const BACKUP_PDF_TO_INDEXEDDB = (typeof window.BACKUP_PDF_TO_INDEXEDDB !== 'undefined' ? window.BACKUP_PDF_TO_INDEXEDDB : true);

  // openPdfCacheDb, viewCache*, pdfCache* live in idb.js (loaded before app.js).
  // They are context-free storage primitives and resolve here by bare name.

  // Wrapper over idb.js idbTakeoffBackupGetRaw: keeps the cross-user mismatch
  // check + logging in app.js (saveDebugLog / takeoffBackupDelete are app-side).
  async function takeoffBackupGet(projectId, currentUserId) {
    const entry = await idbTakeoffBackupGetRaw(projectId);
    if (!entry) return null;
    if (currentUserId && entry.userId && entry.userId !== currentUserId) {
      try { saveDebugLog('takeoffBackup.user_mismatch', { projectId, ownerUserId: entry.userId, currentUserId }); } catch (_) {}
      try { await takeoffBackupDelete(projectId); } catch (_) {}
      return null;
    }
    return entry;
  }

  // Wrapper over idb.js idbTakeoffBackupPut: the pure primitive does the eviction
  // + stale-skip inside one transaction and returns a status; the logging + the
  // one-shot warning (gated by the IIFE-local takeoffBackupWarnShown) stay here.
  async function takeoffBackupPut(projectId, data, pdfBlob, pdfHash, lastModifiedAt, projectName, userId) {
    const res = await idbTakeoffBackupPut(projectId, data, pdfBlob, pdfHash, lastModifiedAt, projectName, userId);
    if (res && res.skippedStale) {
      saveDebugLog('takeoffBackup.skip_stale', { projectId, existing: res.existing, incoming: res.incoming });
    } else if (res && res.error) {
      saveDebugLog('takeoffBackup.put_err', { projectId, message: res.error?.message });
      if (!takeoffBackupWarnShown) {
        takeoffBackupWarnShown = true;
        try {
          pushSaveEvent(
            'takeoff_backup_warn',
            'Local takeoff backup failed - tab-crash recovery may not work',
            res.error?.message || ''
          );
        } catch (_) {}
      }
    }
  }

  // takeoffBackupDelete + readSaveLogsSnapshots live in idb.js (context-free).

  // Wrapper over idb.js idbPutSaveLogsSnapshot: the throttle, envelope build
  // (reads state), and logging stay here; idb.js owns the put + prune-to-max.
  async function writeSaveLogsSnapshot(reason) {
    if (typeof indexedDB === 'undefined') return;
    if (envelopeSnapshotFiredAt && Date.now() - envelopeSnapshotFiredAt < 60000) return;
    envelopeSnapshotFiredAt = Date.now();
    try {
      const envelope = buildSaveLogsEnvelope();
      envelope.autoSnapshotReason = reason || 'unknown';
      const res = await idbPutSaveLogsSnapshot(envelope);
      if (res && res.error) throw res.error;
      saveDebugLog('autosave.snapshot.put', { reason, capturedAt: envelope.capturedAt, eventCount: envelope.events.length });
    } catch (e) {
      saveDebugLog('autosave.snapshot.put_err', { reason, message: e?.message });
    }
  }

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
    lastLocalBackupAt = null;
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
    autoSaveDirty = false;
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
  window.getScaleZoneForLine = getScaleZoneForLine;
  window.getEffectiveScaleForLine = getEffectiveScaleForLine;
  window.getLineRealWorldLength = getLineRealWorldLength;
  window.getLineLengthForTotals = getLineLengthForTotals;

  function countItemsInRect(ann, pageIdx, x1, y1, x2, y2) {
    let counterCount = 0, lineRunCount = 0, lengthRealSum = 0;
    const inRect = (p) => pointInRect(p, x1, y1, x2, y2);
    (state.counters || []).forEach(c => {
      (ann?.counterMarkers?.[c.id] || []).forEach(m => { if (inRect(m)) counterCount++; });
    });
    (ann?.quickLines || []).forEach(q => {
      const start = { x: q.x1, y: q.y1 }, end = { x: q.x2, y: q.y2 };
      if (inRect(start) && inRect(end)) { lineRunCount++; lengthRealSum += getLineRealWorldLength(q, pageIdx, false, ann); }
    });
    (ann?.polylines || []).forEach(poly => {
      const pts = poly.points || [];
      const start = pts[0], end = pts[pts.length - 1];
      if (start && end && inRect(start) && inRect(end)) { lineRunCount++; lengthRealSum += getLineRealWorldLength(poly, pageIdx, true, ann); }
    });
    return { counterCount, lineRunCount, lengthRealSum };
  }
  function collectItemsToDeleteInRect(ann, pageIdx, x1, y1, x2, y2) {
    const inRect = (p) => pointInRect(p, x1, y1, x2, y2);
    const result = {
      counterCount: 0, lineRunCount: 0, lengthRealSum: 0,
      highlightCount: 0, noteCount: 0, multiplyZoneCount: 0, scaleZoneCount: 0,
      counters: [], quickLines: [], polylines: [],
      highlights: [], notes: [], multiplyZones: [], scaleZones: []
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
        result.lengthRealSum += getLineRealWorldLength(q, pageIdx, false, ann);
        result.quickLines.push({ index: i, line: q });
      }
    });
    (ann?.polylines || []).forEach((poly, i) => {
      const pts = poly.points || [];
      const start = pts[0], end = pts[pts.length - 1];
      if (start && end && inRect(start) && inRect(end)) {
        result.lineRunCount++;
        result.lengthRealSum += getLineRealWorldLength(poly, pageIdx, true, ann);
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

  const dpr = () => window.devicePixelRatio || 1;
  function toCanvas(p) { const scale = state.zoom * dpr(); return { x: p.x * scale, y: p.y * scale }; }

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
      const scale = state.zoom * dpr();
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
        lengthReal += (typeof getLineLengthForTotals === 'function') ? getLineLengthForTotals(q, i, false, ann) : 0;
        pageHas = true;
      });
      (ann.polylines || []).forEach(poly => {
        lengthReal += (typeof getLineLengthForTotals === 'function') ? getLineLengthForTotals(poly, i, true, ann) : 0;
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
      if (saveInProgress) {
        if (dotEl) { dotEl.className = 'dot dot-yellow'; dotEl.title = 'Canvas sync: Uploading...'; }
        if (canvasLabelEl) canvasLabelEl.textContent = 'Canvas Uploading...';
        mode = '';
      } else if (state.lastSavedAt && !autoSaveDirty) {
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
        if (savePdfInProgress) { squareEl.className = 'square square-yellow'; squareEl.title = 'PDF sync: Uploading PDF...'; }
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
        if (savePdfInProgress) pdfLabelEl.textContent = 'PDF Uploading...';
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
      if (saveInProgress && saveProgressMessage) {
        mode = saveProgressMessage;
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
        if (state.tool === TOOL.SCALE || state.tool === TOOL.MEASURE) toolHint = state.scaleMode === SCALE_MODES.POINT_A ? 'Click first point' : 'Click second point';
        else if (state.tool === TOOL.LINE) toolHint = state.quickLineStart ? 'Tap end point' : 'Tap start point';
        else if (state.tool === TOOL.POLYLINE) toolHint = 'Click to add points';
        else if (state.tool === TOOL.HIGHLIGHT) toolHint = state.highlightStart ? 'Click second corner' : 'Click first corner';
        else if (state.tool === TOOL.MULTIPLY_ZONE) toolHint = state.multiplyZoneStart ? 'Click second corner' : 'Click first corner';
        else if (state.tool === TOOL.SCALE_ZONE) toolHint = state.scaleZoneStart ? 'Click second corner' : 'Click first corner';
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
        let lenStr;
        if (t.scale) {
          const unit = t.scale.unit || '';
          lenStr = Math.round(t.lengthReal || 0).toLocaleString() + (unit ? ' ' + unit : '');
        } else {
          lenStr = Math.round(t.lengthReal || 0).toLocaleString() + ' px';
        }
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
    if (saveInProgress) {
      canvas = { label: 'Canvas', state: 'yellow', status: 'Uploading...', clock: '', ago: '' };
    } else if (state.lastSavedAt && !autoSaveDirty) {
      canvas = { label: 'Canvas', state: 'green', status: 'Synced with cloud', clock: savedParts.clock, ago: savedParts.ago };
    } else if (!state.pages.length) {
      canvas = { label: 'Canvas', state: 'grey', status: 'No project', clock: '', ago: '' };
    } else if (state.isViewer) {
      canvas = { label: 'Canvas', state: 'yellow', status: 'Viewing (read-only)', clock: savedParts.clock, ago: savedParts.ago };
    } else {
      const status = lastCloudSaveAttemptFailed ? 'Last sync failed' : 'Not saved to cloud';
      canvas = { label: 'Canvas', state: 'red', status, clock: savedParts.clock, ago: savedParts.ago };
    }
    let pdf;
    const pdfSynced = lastSaveIncludedPdf || !!state.pdfStoragePath;
    if (savePdfInProgress) {
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
    const syncAttention = !!(lastCloudSaveAttemptFailed && autoSaveDirty);
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

  let pdfRenderTask = null;
  let pdfOffscreenCanvas = null;
  let pdfRenderId = 0;
  let pdfRenderPending = false;
  // SECTION: PDF Rendering
  function renderPdf() {
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
      return;
    }
    if (pdfRenderTask) {
      pdfRenderPending = true;
      return;
    }
    pdfRenderPending = false;
    pdfRenderId++;
    const thisRenderId = pdfRenderId;
    const scale = state.zoom * (window.devicePixelRatio || 1);
    const viewport = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
    if (!pdfOffscreenCanvas) pdfOffscreenCanvas = document.createElement('canvas');
    pdfOffscreenCanvas.width = viewport.width;
    pdfOffscreenCanvas.height = viewport.height;
    pdfRenderTask = page.pdfPage.render({ canvasContext: pdfOffscreenCanvas.getContext('2d'), viewport });
    pdfRenderTask.promise.then(() => {
      pdfRenderTask = null;
      if (thisRenderId !== pdfRenderId) {
        if (pdfRenderPending) renderPdf();
        return;
      }
      lastRenderedZoom = state.zoom;
      updateContainerTransform();
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      pdfCanvas.style.width = viewport.width / (window.devicePixelRatio || 1) + 'px';
      pdfCanvas.style.height = viewport.height / (window.devicePixelRatio || 1) + 'px';
      pdfCanvas.getContext('2d').drawImage(pdfOffscreenCanvas, 0, 0);
      renderAnnotations();
      if (pdfRenderPending) renderPdf();
    }).catch(err => {
      pdfRenderTask = null;
      if (err && err.name !== 'RenderingCancelledException') console.error(err);
      if (pdfRenderPending) renderPdf();
    });
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

  function renderAnnotations() {
    const page = state.pages[state.currentPage];
    if (!page) return;
    annCanvas.width = pdfCanvas.width;
    annCanvas.height = pdfCanvas.height;
    annCanvas.style.width = pdfCanvas.style.width;
    annCanvas.style.height = pdfCanvas.style.height;
    const ctx = annCanvas.getContext('2d');
    const z = state.zoom;
    ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
    const ann = getActiveAnnotations(page);
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
        const fontSize = (lts.lengthLabelSize ?? 12) * z * dpr();
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
        const fontSize = (lts.lengthLabelSize ?? 12) * z * dpr();
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
        const fontSize = (state.multiplyZoneSettings?.labelSize ?? 14) * z * dpr();
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
        const fontSize = (state.multiplyZoneSettings?.labelSize ?? 14) * z * dpr();
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
    (ann.notes || []).forEach(n => {
      if (!n.text) return;
      const w = n.width || 150;
      const fontSize = n.fontSize || 14;
      const scale = z * dpr();
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
      const scale = state.zoom * dpr();
      drawLegend(ctx, page, state.currentPage, ann, scale, toCanvas);
    }
    if (state.showGridOverlay) {
      const scale = state.zoom * dpr();
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
        lenReal += getLineLengthForTotals(q, pi, false, ann);
      });
      (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
        lenReal += getLineLengthForTotals(poly, pi, true, ann);
      });
      if (lenReal > 0) lineRows.push({ name: lt.name || 'Line', color: lt.color || '#4a9eff', lengthStr: pageScale ? formatDistFeetInchesFromReal(lenReal, pageScale) : formatLineLengthRealSum(lenReal, null) });
    });
    const hasRows = counterRows.length > 0 || lineRows.length > 0;
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
    const ROW_H_PDF = 14;
    const PAD_PDF = 6;
    const totalRows = counterRows.length + lineRows.length;
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
        const pxLine = '1 ' + scale.unit + ' = ' + scale.pixelsPerUnit.toFixed(1) + ' px';
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
        btn.innerHTML = isHeader ? scaleIconSvgHeader : scaleIconSvg + ' Set Scale';
      }
    };
    setScaleContent(setScaleBtn);
    if (setScaleSidebarBtn) setScaleContent(setScaleSidebarBtn);
    const scaleDisplay = document.getElementById('sidebarScaleDisplay');
    if (scaleDisplay) {
      if (scale) {
        const pxLine = '1 ' + scale.unit + ' = ' + scale.pixelsPerUnit.toFixed(1) + ' px';
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
        scaleDisplay.title = 'Click to set scale';
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
    if (state.isViewer && state.tool !== TOOL.NONE && state.tool !== TOOL.MEASURE) {
      state.tool = TOOL.NONE;
      state.activeCounterType = null;
      state.activeLineTypeId = null;
      state.quickLineStart = null;
      state.highlightStart = null;
      state.multiplyZoneStart = null;
      state.scaleZoneStart = null;
      state.deleteZoneStart = null;
      state.drawingPolyline = null;
      state.editingPolyline = null;
    }
    document.getElementById('polylineFinishBar').classList.toggle('visible', !!state.drawingPolyline);
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0 || !!state.isViewer;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0 || !!state.isViewer;
    const viewerHideIds = ['setScale', 'counterBtn', 'quickLine', 'polylineBtn', 'highlightBtn', 'multiplyZoneBtn', 'scaleZoneBtn', 'deleteZoneBtn', 'noteBtn', 'legendBtn', 'legendBtnSidebar', 'undoBtn', 'redoBtn', 'setScaleSidebar', 'counterBtnSidebar', 'quickLineSidebar', 'polylineBtnSidebar', 'highlightBtnSidebar', 'multiplyZoneBtnSidebar', 'scaleZoneBtnSidebar', 'deleteZoneBtnSidebar', 'noteBtnSidebar', 'doneEditing', 'doneEditingSidebar', 'clearPage', 'clearPageSidebar', 'exportBtn', 'exportBtnSidebar', 'importBtn', 'importBtnSidebar', 'saveProjectBtn', 'saveProjectBtnSidebar', 'addCounter', 'addLineType', 'addGroup', 'groupsSection', 'headerActiveCounter', 'headerActiveLineType', 'lineTypeSnapToHVHeaderBtn', 'plumBtn', 'plumLineBtn'];
    viewerHideIds.forEach(function(id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (state.isViewer) el.style.display = 'none';
      else if (id === 'doneEditing' || id === 'doneEditingSidebar') { /* keep tool-based display */ }
      else if (id === 'lineTypeSnapToHVHeaderBtn') { /* keep tool-based display from snap block */ }
      else el.style.display = '';
    });
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
    const hasCountsOrLines = typeof window.getPipeToolingSummary === 'function' && window.getPipeToolingSummary().length > 0;
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
          openCanvasDetailsModal(c);
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
        const ann = getActiveAnnotations(page);
        const markers = (ann?.counterMarkers?.[c.id] || []);
        if (markers.length === 0) return;
      }
      const div = document.createElement('div');
      div.className = 'sidebar-item' + (state.activeCounterType === c.id && showEdit ? ' active' : '');
      const count = state.pages.reduce((n, p) => n + ((getActiveAnnotations(p)?.counterMarkers?.[c.id] || []).length), 0);
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
        div.querySelector('.swatch')?.addEventListener('click', (e) => { e.stopPropagation(); showLineColorModal(c.color || '#e8c547', (color) => { pushUndoSnapshot(); c.color = color; markProjectDirty(); }); });
        div.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openCounterLineTypeDetailsModal('counter', c); });
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
        const ann = getActiveAnnotations(page);
        const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
        const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
        if (qLines.length === 0 && polys.length === 0) return;
      }
      let runs = 0, len = 0;
      const pageIndices = [];
      state.pages.forEach((p, pi) => {
        const ann = getActiveAnnotations(p);
        const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
        const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
        if (qLines.length || polys.length) pageIndices.push(pi);
        qLines.forEach(q => { runs++; len += getLineLengthForTotals(q, pi, false, ann); });
        polys.forEach(poly => { runs++; len += getLineLengthForTotals(poly, pi, true, ann); });
      });
      const scale = pickScaleForLineType(pageIndices);
      const div = document.createElement('div');
      div.className = 'sidebar-item sidebar-item-line-type' + (state.activeLineTypeId === lt.id && showEdit ? ' active' : '');
      div.innerHTML = '<span class="name line-type-name">' + esc(lt.name || 'Line') + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch line-type-drag-handle" style="background:' + lt.color + '" title="Drag to reorder"></span>' : '') + '<span class="badge">' + runs + ' · ' + (scale ? formatDistFeetInchesFromReal(len, scale) : formatLineLengthRealSum(len, null)) + '</span>' + (showEdit ? '<span class="edit-btn" title="Edit">✎</span>' : '') + '</div>';
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
        div.querySelector('.swatch')?.addEventListener('click', (e) => { e.stopPropagation(); showLineColorModal(lt.color || '#4a9eff', (color) => { pushUndoSnapshot(); lt.color = color; markProjectDirty(); }); });
        div.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openCounterLineTypeDetailsModal('lineType', lt); });
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
        div.querySelector('.swatch')?.addEventListener('click', (e) => { e.stopPropagation(); showLineColorModal(g.color || COLORS[0], (color) => { pushUndoSnapshot(); g.color = color; markProjectDirty(); updateUI(); renderPdf(); }); });
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
      const ann = getActiveAnnotations(p);
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
        const annIt = p ? getActiveAnnotations(p) : makeAnnotations();
        totalLen += it.type === 'poly' ? getLineLengthForTotals(it.poly, it.pageIdx, true, annIt) : getLineLengthForTotals(it.q, it.pageIdx, false, annIt);
      });
      const scale = pickScaleForLineType(pageIndices);
      const summary = filteredItems.length + ' lines · ' + (scale ? formatDistFeetInchesFromReal(totalLen, scale) : formatLineLengthRealSum(totalLen, null));
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
      const annRow = state.pages[it.pageIdx] ? getActiveAnnotations(state.pages[it.pageIdx]) : makeAnnotations();
      let dist, name;
      if (it.type === 'poly') {
        dist = it.poly.closed ? formatArea(polygonArea(it.poly.points || []), pageScale) : formatDistFeetInchesFromReal(getLineRealWorldLength(it.poly, it.pageIdx, true, annRow), getEffectiveScaleForLine(annRow, it.poly, true, it.pageIdx));
        name = it.poly.name || 'Polyline';
      } else {
        dist = formatDistFeetInchesFromReal(getLineRealWorldLength(it.q, it.pageIdx, false, annRow), getEffectiveScaleForLine(annRow, it.q, false, it.pageIdx));
        name = it.q.name || 'Quick line';
      }
      const line = it.type === 'poly' ? it.poly : it.q;
      const sd = line.startDrop || 0, ed = line.endDrop || 0;
      let dropsHtml = '';
      if (sd > 0 || ed > 0) {
        const parts = [];
        if (sd > 0) parts.push('↧ ' + sd);
        if (ed > 0) parts.push('↧ ' + ed);
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
          showLineColorModal(
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
        if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); openLinePropertiesModal(it); };
        onDoubleTapOrDblClick(div.querySelector('.name'), () => openLinePropertiesModal(it));
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
    state.pages.forEach(p => {
      const ann = getActiveAnnotations(p);
      Object.values(ann?.counterMarkers || {}).forEach(arr => arr.forEach(m => { if (m.group) hasAnyGroups = true; }));
      (ann?.quickLines || []).forEach(q => { if (q.group) hasAnyGroups = true; });
      (ann?.polylines || []).forEach(poly => { if (poly.group) hasAnyGroups = true; });
    });
    const counterByGroup = {};
    const lineTypeByGroup = {};
    state.pages.forEach((p, pi) => {
      const ann = getActiveAnnotations(p);
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
          lineTypeByGroup[gid][lt.id].len += getLineLengthForTotals(q, pi, false, ann);
          if (!lineTypeByGroup[gid][lt.id].pageIndices.includes(pi)) lineTypeByGroup[gid][lt.id].pageIndices.push(pi);
        });
        (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          const gid = poly.group || null;
          if (!lineTypeByGroup[gid]) lineTypeByGroup[gid] = {};
          if (!lineTypeByGroup[gid][lt.id]) lineTypeByGroup[gid][lt.id] = { name: lt.name, runs: 0, len: 0, pageIndices: [] };
          lineTypeByGroup[gid][lt.id].runs++;
          lineTypeByGroup[gid][lt.id].len += getLineLengthForTotals(poly, pi, true, ann);
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
          div.innerHTML = '<span class="name">' + esc(r.name) + '</span><span class="summary-line-meta">' + r.runs + ' lines · ' + (scale ? formatDistFeetInchesFromReal(r.len, scale) : formatLineLengthRealSum(r.len, null)) + '</span>';
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
          qLines.forEach(q => { runs++; len += getLineLengthForTotals(q, pi, false, ann); });
          polys.forEach(poly => { runs++; len += getLineLengthForTotals(poly, pi, true, ann); });
        });
        if (runs > 0) {
          const scale = pickScaleForLineType(pageIndices);
          const div = document.createElement('div');
          div.className = 'sidebar-item summary-item-clickable summary-line-item';
          div.dataset.type = 'lineType';
          div.dataset.id = lt.id;
          div.innerHTML = '<span class="name">' + esc(lt.name) + '</span><span class="summary-line-meta">' + runs + ' lines · ' + (scale ? formatDistFeetInchesFromReal(len, scale) : formatLineLengthRealSum(len, null)) + '</span>';
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
        (ann?.quickLines || []).filter(q => q.lineTypeId === id).forEach(q => { runs++; len += getLineLengthForTotals(q, pageIdx, false, ann); });
        (ann?.polylines || []).filter(poly => poly.lineTypeId === id).forEach(poly => { runs++; len += getLineLengthForTotals(poly, pageIdx, true, ann); });
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
        metaHtml += '<span class="summary-count-detail-length">' + esc(ps ? formatDistFeetInchesFromReal(it.length, ps) : formatLineLengthRealSum(it.length, null)) + '</span>';
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

  // SECTION: Item detail & properties modals
  function showModal(id) { document.getElementById(id).classList.add('visible'); }
  function hideModal(id) {
    if (id === 'groupModal') App.onGroupModalHidden && App.onGroupModalHidden();
    if (id === 'counterLineTypeDetailsModal') counterLineTypeDetailsItem = null;
    if (id === 'canvasDetailsModal') pendingCanvasEdit = null;
    if (id === 'deleteCanvasConfirmModal') pendingDeleteCanvas = null;
    document.getElementById(id).classList.remove('visible');
  }

  let pendingDeleteCounterLineType = null;
  let counterLineTypeDetailsItem = null;
  function openCounterLineTypeDetailsModal(kind, item) {
    counterLineTypeDetailsItem = kind === 'counter' ? item : null;
    const titleEl = document.getElementById('counterLineTypeDetailsTitle');
    const nameEl = document.getElementById('counterLineTypeDetailsName');
    const swatchEl = document.getElementById('counterLineTypeDetailsSwatch');
    const pagesEl = document.getElementById('counterLineTypeDetailsPages');
    const deleteBtn = document.getElementById('counterLineTypeDetailsDelete');
    titleEl.textContent = kind === 'counter' ? 'Counter' : 'Line Type';
    const curveGroup = document.getElementById('counterLineTypeDetailsCurveGroup');
    if (curveGroup) {
      curveGroup.style.display = kind === 'lineType' ? '' : 'none';
      if (kind === 'lineType') {
        const curveVal = item.curveStyle || 'straight';
        document.querySelectorAll('input[name="counterLineTypeDetailsCurve"]').forEach(r => { r.checked = r.value === curveVal; });
      }
    }
    const iconGroup = document.getElementById('counterLineTypeDetailsIconGroup');
    if (iconGroup) iconGroup.style.display = kind === 'counter' ? '' : 'none';
    if (kind === 'counter' && iconGroup) {
      const grid = document.getElementById('counterLineTypeDetailsIconGrid');
      const customGrid = document.getElementById('counterLineTypeDetailsIconGridCustom');
      const customIconsGroup = document.getElementById('counterLineTypeDetailsCustomIconsGroup');
      if (customIconsGroup) customIconsGroup.style.display = '';
      const icons = getOrderedIcons();
      const effectiveCustom = getEffectiveCustomIcons();
      const allIcons = [...icons, ...effectiveCustom];
      const currentIcon = item.icon && allIcons.some(ic => ic.value === item.icon) ? item.icon : (icons[0]?.value || '');
      grid.innerHTML = icons.map((ic) => {
        const sel = ic.value === currentIcon ? ' selected' : '';
        return '<div class="icon-cell' + sel + '" data-path="' + ic.value + '"><svg viewBox="' + iconVbFor(ic.value) + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>';
      }).join('');
      customGrid.innerHTML = '<div class="icon-cell icon-cell-upload" data-upload="1" title="Upload SVG">+</div>' + effectiveCustom.map((ic) => {
        const sel = ic.value === currentIcon ? ' selected' : '';
        return '<div class="icon-cell' + sel + '" data-path="' + ic.value + '"><svg viewBox="' + ic.viewBox + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>';
      }).join('');
      const applyIcon = (path) => {
        pushUndoSnapshot();
        item.icon = path;
        markProjectDirty();
        updateUI();
        renderPdf();
      };
      grid.querySelectorAll('.icon-cell').forEach(c => {
        c.onclick = () => {
          grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          c.classList.add('selected');
          applyIcon(c.dataset.path);
        };
      });
      customGrid.querySelectorAll('.icon-cell').forEach(c => {
        c.onclick = () => {
          if (c.dataset.upload) {
            document.getElementById('customIconUploadInput').click();
            return;
          }
          grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          c.classList.add('selected');
          applyIcon(c.dataset.path);
        };
      });
    }
    nameEl.value = item.name || '';
    nameEl.onblur = () => {
      const v = nameEl.value.trim();
      pushUndoSnapshot();
      item.name = v || (kind === 'counter' ? 'Counter' : 'Line');
      markProjectDirty();
      updateUI();
    };
    const color = item.color || (kind === 'counter' ? '#e8c547' : '#4a9eff');
    swatchEl.style.background = color;
    swatchEl.onclick = () => {
      showLineColorModal(color, (newColor) => {
        pushUndoSnapshot();
        item.color = newColor;
        swatchEl.style.background = newColor;
        markProjectDirty();
        updateUI();
        renderPdf();
      });
    };
    if (kind === 'lineType') {
      document.querySelectorAll('input[name="counterLineTypeDetailsCurve"]').forEach(r => {
        r.onchange = () => { pushUndoSnapshot(); item.curveStyle = r.value; markProjectDirty(); updateUI(); renderPdf(); };
      });
    }
    let totalCount = 0;
    const pages = [];
    if (kind === 'counter') {
      state.pages.forEach((p, pi) => {
        let n = 0;
        getPageCanvases(p).forEach(c => { n += (c.annotations?.counterMarkers?.[item.id] || []).length; });
        if (n > 0) { pages.push({ pageIdx: pi, count: n, label: p.label || 'Page ' + (pi + 1) }); totalCount += n; }
      });
    } else {
      state.pages.forEach((p, pi) => {
        let runs = 0;
        getPageCanvases(p).forEach(c => {
          const ann = c.annotations || makeAnnotations();
          runs += (ann.quickLines || []).filter(q => q.lineTypeId === item.id).length;
          runs += (ann.polylines || []).filter(poly => poly.lineTypeId === item.id).length;
        });
        if (runs > 0) { pages.push({ pageIdx: pi, count: runs, label: p.label || 'Page ' + (pi + 1) }); totalCount += runs; }
      });
    }
    pagesEl.innerHTML = '';
    if (pages.length === 0) {
      pagesEl.innerHTML = '<p style="margin:0;color:var(--text2);font-size:0.9rem;">Not used on any page</p>';
    } else {
      pages.forEach(({ pageIdx, count, label }) => {
        const div = document.createElement('div');
        div.className = 'page-item';
        div.textContent = kind === 'counter' ? label + ': ' + count + ' marker' + (count !== 1 ? 's' : '') : label + ': ' + count + ' run' + (count !== 1 ? 's' : '');
        div.onclick = () => {
          state.currentPage = pageIdx;
          fitZoom();
          hideModal('counterLineTypeDetailsModal');
          updateUI();
          renderPdf();
        };
        pagesEl.appendChild(div);
      });
    }
    deleteBtn.onclick = () => {
      if (totalCount === 0) {
        performDeleteCounterLineType(kind, item);
        hideModal('counterLineTypeDetailsModal');
      } else {
        pendingDeleteCounterLineType = { kind, item };
        document.getElementById('deleteCounterLineTypeName').textContent = item.name || (kind === 'counter' ? 'this counter' : 'this line type');
        document.getElementById('deleteCounterLineTypeMessage').textContent = 'This will remove ' + totalCount + (kind === 'counter' ? ' marker' + (totalCount !== 1 ? 's' : '') : ' line' + (totalCount !== 1 ? 's' : '')) + ' from the project. Continue?';
        showModal('deleteCounterLineTypeConfirmModal');
      }
    };
    showModal('counterLineTypeDetailsModal');
  }
  function performDeleteCounterLineType(kind, item) {
    pushUndoSnapshot();
    if (kind === 'counter') {
      const idx = state.counters.findIndex(c => c.id === item.id);
      if (idx >= 0) state.counters.splice(idx, 1);
      state.pages.forEach(p => {
        getPageCanvases(p).forEach(c => { if (c.annotations?.counterMarkers) delete c.annotations.counterMarkers[item.id]; });
      });
      if (state.activeCounterType === item.id) { state.activeCounterType = null; state.tool = TOOL.NONE; }
    } else {
      const idx = state.lineTypes.findIndex(lt => lt.id === item.id);
      if (idx >= 0) state.lineTypes.splice(idx, 1);
      state.pages.forEach(p => {
        getPageCanvases(p).forEach(c => {
          const ann = c.annotations;
          if (ann) {
            if (ann.quickLines) ann.quickLines = ann.quickLines.filter(q => q.lineTypeId !== item.id);
            if (ann.polylines) ann.polylines = ann.polylines.filter(poly => poly.lineTypeId !== item.id);
          }
        });
      });
      if (state.activeLineTypeId === item.id) { state.activeLineTypeId = null; state.tool = TOOL.NONE; }
      const selPage = state.pages[state.selectedLinePageIdx];
      const selAnn = selPage ? getActiveAnnotations(selPage) : null;
      const selPoly = (selAnn?.polylines || []).find(p => p.id === state.selectedLineId);
      const selQuick = (selAnn?.quickLines || []).find(q => q.id === state.selectedLineId);
      if ((selPoly && selPoly.lineTypeId === item.id) || (selQuick && selQuick.lineTypeId === item.id)) {
        state.selectedLineId = null; state.selectedLineIsPoly = false; state.selectedLinePageIdx = null;
      }
    }
    markProjectDirty();
    updateUI();
    renderPdf();
  }

  let pendingLineProperties = null;
  function openLinePropertiesModal(it) {
    pendingLineProperties = it;
    const line = it.type === 'poly' ? it.poly : it.q;
    const lt = state.lineTypes.find(l => l.id === line.lineTypeId);
    const color = line.color || (lt?.color || '#4a9eff');
    const lineTypeLineEl = document.getElementById('linePropertiesLineType');
    if (lineTypeLineEl) {
      lineTypeLineEl.textContent = lt
        ? ('Line type: ' + (lt.name || 'Line'))
        : 'Line type: \u2014';
    }
    const nameEl = document.getElementById('linePropertiesName');
    const swatchEl = document.getElementById('linePropertiesSwatch');
    const startDropEl = document.getElementById('linePropertiesStartDrop');
    const endDropEl = document.getElementById('linePropertiesEndDrop');
    const editVerticesGroup = document.getElementById('linePropertiesEditVerticesGroup');
    const editVerticesBtn = document.getElementById('linePropertiesEditVertices');
    nameEl.value = line.name || (it.type === 'poly' ? 'Polyline' : 'Quick line');
    startDropEl.value = String(line.startDrop ?? '');
    endDropEl.value = String(line.endDrop ?? '');
    swatchEl.style.background = color;
    editVerticesGroup.style.display = it.type === 'poly' ? '' : 'none';
    nameEl.onblur = () => {
      const v = nameEl.value.trim();
      pushUndoSnapshot();
      line.name = v || (it.type === 'poly' ? 'Polyline' : 'Quick line');
      markProjectDirty();
      updateUI();
    };
    swatchEl.onclick = () => {
      showLineColorModal(color, (newColor) => {
        pushUndoSnapshot();
        line.color = newColor;
        swatchEl.style.background = newColor;
        markProjectDirty();
        updateUI();
        renderPdf();
      });
    };
    const applyDrops = () => {
      const sd = parseInt(startDropEl.value, 10);
      const ed = parseInt(endDropEl.value, 10);
      line.startDrop = (isNaN(sd) || sd < 0) ? 0 : sd;
      line.endDrop = (isNaN(ed) || ed < 0) ? 0 : ed;
    };
    startDropEl.onblur = () => { pushUndoSnapshot(); applyDrops(); markProjectDirty(); updateUI(); };
    endDropEl.onblur = () => { pushUndoSnapshot(); applyDrops(); markProjectDirty(); updateUI(); };
    const adjustDrop = (el, prop, delta) => {
      const v = parseInt(el.value, 10);
      const cur = isNaN(v) || v < 0 ? 0 : v;
      const next = Math.max(0, cur + delta);
      pushUndoSnapshot();
      line[prop] = next;
      el.value = next || '';
      markProjectDirty();
      updateUI();
      renderPdf();
    };
    document.getElementById('linePropertiesStartDropPlus1').onclick = () => adjustDrop(startDropEl, 'startDrop', 1);
    document.getElementById('linePropertiesStartDropPlus10').onclick = () => adjustDrop(startDropEl, 'startDrop', 10);
    document.getElementById('linePropertiesStartDropMinus1').onclick = () => adjustDrop(startDropEl, 'startDrop', -1);
    document.getElementById('linePropertiesStartDropMinus10').onclick = () => adjustDrop(startDropEl, 'startDrop', -10);
    document.getElementById('linePropertiesClearStartDrop').onclick = () => {
      pushUndoSnapshot();
      line.startDrop = 0;
      startDropEl.value = '';
      markProjectDirty();
      updateUI();
      renderPdf();
    };
    document.getElementById('linePropertiesEndDropPlus1').onclick = () => adjustDrop(endDropEl, 'endDrop', 1);
    document.getElementById('linePropertiesEndDropPlus10').onclick = () => adjustDrop(endDropEl, 'endDrop', 10);
    document.getElementById('linePropertiesEndDropMinus1').onclick = () => adjustDrop(endDropEl, 'endDrop', -1);
    document.getElementById('linePropertiesEndDropMinus10').onclick = () => adjustDrop(endDropEl, 'endDrop', -10);
    document.getElementById('linePropertiesClearEndDrop').onclick = () => {
      pushUndoSnapshot();
      line.endDrop = 0;
      endDropEl.value = '';
      markProjectDirty();
      updateUI();
      renderPdf();
    };
    if (editVerticesBtn) {
      editVerticesBtn.onclick = () => {
        hideModal('linePropertiesModal');
        pendingLineProperties = null;
        enterEditMode(it.poly.id, it.pageIdx);
      };
    }
    showModal('linePropertiesModal');
  }
  function closeLinePropertiesModal() {
    if (!pendingLineProperties) return;
    const line = pendingLineProperties.type === 'poly' ? pendingLineProperties.poly : pendingLineProperties.q;
    const startDropEl = document.getElementById('linePropertiesStartDrop');
    const endDropEl = document.getElementById('linePropertiesEndDrop');
    if (startDropEl && endDropEl) {
      const sd = parseInt(startDropEl.value, 10);
      const ed = parseInt(endDropEl.value, 10);
      line.startDrop = (isNaN(sd) || sd < 0) ? 0 : sd;
      line.endDrop = (isNaN(ed) || ed < 0) ? 0 : ed;
    }
    pushUndoSnapshot();
    markProjectDirty();
    hideModal('linePropertiesModal');
    pendingLineProperties = null;
    updateUI();
    renderPdf();
  }

  // The Groups modals (openGroupModal + the groupModal handlers,
  // refreshGroupAssignButtons + openGroupAssignModal + the groupAssign handlers,
  // and the pendingGroupEdit / pendingGroupAssignTarget / openedGroupModalFromAssign
  // flags) moved to features/groups.js (window.App registry); reached via
  // App.openGroupModal / App.openGroupAssignModal at call time. deleteGroup stays
  // here (published as App.deleteGroup for the moved Delete handler).
  function deleteGroup(groupId) {
    const g = (state.groups || []).find(x => x.id === groupId);
    if (!g) return false;
    const count = countItemsInGroup(groupId);
    if (count > 0 && !confirm('This group has ' + count + ' item(s). Remove group and clear assignment from those items?')) return false;
    pushUndoSnapshot();
    state.groups = (state.groups || []).filter(x => x.id !== groupId);
    if (state.activeGroupId === groupId) state.activeGroupId = null;
    state.pages.forEach(p => {
      getPageCanvases(p).forEach(c => {
        const ann = c.annotations || makeAnnotations();
        Object.values(ann.counterMarkers || {}).forEach(arr => arr.forEach(m => { if ((m.group || null) === groupId) m.group = null; }));
        (ann.quickLines || []).forEach(q => { if ((q.group || null) === groupId) q.group = null; });
        (ann.polylines || []).forEach(poly => { if ((poly.group || null) === groupId) poly.group = null; });
      });
    });
    markProjectDirty();
    updateUI();
    renderPdf();
    return true;
  }

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

  function showLineColorModal(currentColor, onApply) {
    state.pendingLineColorApply = onApply;
    const inp = document.getElementById('lineColorCustom');
    inp.value = currentColor || '#4a9eff';
    const presetsEl = document.getElementById('lineColorPresets');
    presetsEl.innerHTML = COLORS.map(c =>
      '<span class="color-swatch' + ((currentColor || '').toLowerCase() === c.toLowerCase() ? ' selected' : '') + '" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></span>'
    ).join('');
    presetsEl.querySelectorAll('.color-swatch').forEach(s => {
      s.onclick = () => applyLineColor(s.dataset.color);
    });
    const recentEl = document.getElementById('lineColorRecent');
    const recentGroup = document.getElementById('lineColorRecentGroup');
    recentEl.innerHTML = '';
    (state.recentLineColors || []).forEach(c => {
      const s = document.createElement('span');
      s.className = 'color-swatch';
      s.style.background = c;
      s.dataset.color = c;
      s.onclick = () => applyLineColor(c);
      recentEl.appendChild(s);
    });
    recentGroup.style.display = (state.recentLineColors || []).length ? 'block' : 'none';
    showModal('lineColorModal');
  }
  function applyLineColor(color) {
    if (state.pendingLineColorApply) {
      state.pendingLineColorApply(color);
      pushRecentColor(color);
      state.pendingLineColorApply = null;
      hideModal('lineColorModal');
      updateUI();
      renderPdf();
    }
  }
  // Commit a chosen color to the shared Recent list (state.recentLineColors) and
  // persist it app-wide in localStorage. Only off-palette (custom) colors are
  // recorded; preset colors are skipped by nextRecentColors since they are always
  // shown. Shared by applyLineColor (edit picker) and the Create Counter / Create
  // Line Type pickers via App.pushRecentColor.
  function pushRecentColor(color) {
    state.recentLineColors = nextRecentColors(state.recentLineColors, color, COLORS);
    try { localStorage.setItem('recentLineColors', JSON.stringify(state.recentLineColors)); } catch (_) {}
  }
  // Render the inline color picker used by the Create Counter / Create Line Type
  // modals: the 18 preset swatches, a native <input type="color"> custom picker,
  // and a Recent-colors row. The single source of truth for the chosen value is
  // the presets row's dataset.selectedColor (lowercase hex). Clicking any preset
  // or recent swatch, or committing the custom input, updates that value and
  // re-rings the matching swatch by value. Recents are NOT committed here (only
  // on Create), so cancelling never pollutes the Recent list.
  function setupCreateColorPicker(opts) {
    const presetsRow = document.getElementById(opts.presetsRowId);
    const customInput = document.getElementById(opts.customInputId);
    const recentRow = document.getElementById(opts.recentRowId);
    const recentGroup = document.getElementById(opts.recentGroupId);
    if (!presetsRow) return;
    const initial = (opts.defaultColor || COLORS[2]).toLowerCase();

    function ring(color) {
      const c = (color || '').toLowerCase();
      [presetsRow, recentRow].forEach(row => {
        if (!row) return;
        row.querySelectorAll('.color-swatch').forEach(s =>
          s.classList.toggle('selected', (s.dataset.color || '').toLowerCase() === c));
      });
    }
    function select(color) {
      const c = (color || '').toLowerCase();
      presetsRow.dataset.selectedColor = c;
      if (customInput) customInput.value = c;
      ring(c);
    }

    presetsRow.innerHTML = COLORS.map(c =>
      '<span class="color-swatch" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></span>'
    ).join('');
    presetsRow.querySelectorAll('.color-swatch').forEach(s => { s.onclick = () => select(s.dataset.color); });

    if (recentRow) {
      recentRow.innerHTML = '';
      (state.recentLineColors || []).forEach(c => {
        const s = document.createElement('span');
        s.className = 'color-swatch';
        s.style.background = c;
        s.dataset.color = c;
        s.title = c;
        s.onclick = () => select(c);
        recentRow.appendChild(s);
      });
    }
    if (recentGroup) recentGroup.style.display = (state.recentLineColors || []).length ? '' : 'none';

    if (customInput) customInput.onchange = () => select(customInput.value);

    select(initial);
  }

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
        resetLocalSessionState();
        lastAuthUserId = null;
        if (hadSession) broadcastSignOut();
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
  let projectsCheckoutChannel = null;
  let projectsCheckoutReconnectTimer = null;
  let projectsCheckoutReconnectAttempt = 0;
  let projectsCheckoutGeneration = 0;

  function clearProjectsCheckoutReconnectTimer() {
    if (projectsCheckoutReconnectTimer) {
      clearTimeout(projectsCheckoutReconnectTimer);
      projectsCheckoutReconnectTimer = null;
    }
  }

  function scheduleProjectsCheckoutReconnect(projectId) {
    if (!SUPABASE_ENABLED || !supabase || !projectId) return;
    if (projectsCheckoutReconnectTimer) return;
    const idx = Math.min(projectsCheckoutReconnectAttempt, PROJECTS_CHECKOUT_RECONNECT_BACKOFF_MS.length - 1);
    const delay = PROJECTS_CHECKOUT_RECONNECT_BACKOFF_MS[idx];
    projectsCheckoutReconnectAttempt += 1;
    saveDebugLog('realtime.checkout.reconnect.schedule', { projectId, attempt: projectsCheckoutReconnectAttempt, delayMs: delay });
    const scheduledGen = projectsCheckoutGeneration;
    projectsCheckoutReconnectTimer = setTimeout(() => {
      projectsCheckoutReconnectTimer = null;
      if (scheduledGen === projectsCheckoutGeneration && state.currentProjectId === projectId) {
        subscribeToProjectCheckoutChanges(projectId);
      }
    }, delay);
  }

  async function subscribeToProjectCheckoutChanges(projectId) {
    const gen = ++projectsCheckoutGeneration;
    clearProjectsCheckoutReconnectTimer();
    if (projectsCheckoutChannel && supabase) {
      const old = projectsCheckoutChannel;
      projectsCheckoutChannel = null;
      try { await supabase.removeChannel(old); } catch (_) {}
    }
    if (gen !== projectsCheckoutGeneration) return;
    if (!SUPABASE_ENABLED || !supabase || !projectId || !state.supabaseSession?.user) {
      projectsCheckoutReconnectAttempt = 0;
      return;
    }
    projectsCheckoutChannel = supabase
      .channel('projects-checkout-' + projectId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: 'id=eq.' + projectId
      }, function() {
        if (gen !== projectsCheckoutGeneration) return;
        refreshProjectPermissions();
      })
      .subscribe((status, err) => {
        if (gen !== projectsCheckoutGeneration) return;
        saveDebugLog('realtime.checkout.status', { projectId, status, message: err?.message });
        if (status === 'SUBSCRIBED') {
          projectsCheckoutReconnectAttempt = 0;
          clearProjectsCheckoutReconnectTimer();
          refreshProjectPermissions().catch(() => {});
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleProjectsCheckoutReconnect(projectId);
        }
      });
  }

  async function refreshProjectPermissions() {
    if (!supabase || !state.currentProjectId || !state.supabaseSession?.user) return;
    const prevCanCheckOut = state.canCheckOut;
    const prevCheckedOutEmail = state.checkedOutEmail;
    const prevWasCheckedOut = state.checkedOutBy === state.supabaseSession?.user?.id;
    let projects = null;
    let error = null;
    // When the supabase-js client has wedged recently (a frequent post-sleep /
    // post-background failure mode), skip it and hit the REST endpoint with raw
    // fetch -- which keeps returning sub-second while supabase-js hangs to the
    // full timeout. Same pattern Turn In uses for check_in_project.
    const sbJsRecentlyBad = () => lastSupabaseJsFailureAt > 0 && Date.now() - lastSupabaseJsFailureAt < 5 * 60 * 1000;
    for (let attempt = 0; attempt < 2; attempt++) {
      const useRaw = sbJsRecentlyBad() || attempt > 0;
      try {
        const r = useRaw
          ? await withTimeout((signal) => rawListAccessibleProjects(signal), REFRESH_PERMISSIONS_TIMEOUT_MS, 'list_accessible_projects')
          : await withTimeout(supabase.rpc('list_accessible_projects'), REFRESH_PERMISSIONS_TIMEOUT_MS, 'list_accessible_projects');
        projects = r.data;
        error = r.error;
      } catch (e) {
        projects = null;
        error = e;
      }
      if (!error && projects) break;
      // A supabase-js timeout/error here is the most reliable "client is wedged"
      // signal we get -- record it so other sync paths (Turn In) proactively
      // prefer raw fetch instead of each eating a full timeout first. Previously
      // these 10+/hour timeouts were dropped on the floor, so Turn In had no idea
      // the client was wedged and hung the full check-in timeout before retrying.
      if (error && !useRaw) noteSupabaseJsFailure('list_accessible_projects', error);
      if (attempt === 0) await new Promise(r2 => setTimeout(r2, 500));
    }
    if (error || !projects) {
      try { pushSaveEvent('refresh_permissions_err', 'refreshProjectPermissions failed', (error && (error.message || String(error))) || 'no data returned'); } catch (_) {}
      return;
    }
    const proj = projects.find(function(p) { return p.id === state.currentProjectId; });
    if (!proj) {
      try { pushSaveEvent('permissions_project_missing', 'You no longer have access to this project', JSON.stringify({ projectId: state.currentProjectId })); } catch (_) {}
      state.isViewer = true;
      state.canCheckOut = false;
      state.checkedOutBy = null;
      state.checkedOutAt = null;
      state.checkedOutEmail = null;
      suspendAutoSaveUntilCheckout = true;
      try { showToast('You no longer have access to this project.', 5000); } catch (_) {}
      try { updateUI(); updateStatus(); updateSaveStatusIndicator(); } catch (_) {}
      return;
    }
    const willBecomeViewer = prevWasCheckedOut && !proj.can_edit;
    const hadDirty = autoSaveDirty;
    const hadInflight = saveInProgress;
    if (willBecomeViewer && hadDirty && !hadInflight) {
      if (suspendAutoSaveUntilCheckout) {
        try { pushSaveEvent('force_turn_in_flush_skipped_suspended', 'Force turn-in flush skipped: autosave suspended pending re-checkout'); } catch (_) {}
      } else {
      performAutoSave()
        .then((res) => {
          if (res && res.ok === false) {
            const code = res.error?.code || res.error?.details || '';
            const msg  = res.error?.message || String(res.error || '');
            const lockedOut =
              code === 'CHECKOUT_EXPIRED' ||
              code === 'CHECKOUT_NOT_OWNED' ||
              code === '42501' ||
              /not[_ ]?owned|checked[_ ]?out|permission/i.test(msg);
            if (lockedOut) {
              pushSaveEvent('force_turn_in_flush_blocked', 'Force turn-in: unsaved edits could not be flushed (lock taken)', msg);
            } else {
              pushSaveEvent('force_turn_in_flush_err', 'Force turn-in: flush errored', msg);
            }
            autoSaveDirty = true;
            lastCloudSaveAttemptFailed = true;
            updateSaveStatusIndicator();
          }
        })
        .catch((err) => {
          pushSaveEvent('force_turn_in_flush_err', 'Force turn-in: flush threw', err?.message || String(err));
          autoSaveDirty = true;
          lastCloudSaveAttemptFailed = true;
          updateSaveStatusIndicator();
        });
      }
    }
    state.checkedOutBy = proj.checked_out_by || null;
    state.checkedOutAt = proj.checked_out_at || null;
    state.checkedOutEmail = proj.checked_out_email || null;
    state.loadedViaViewLink = false;
    state.isViewer = !proj.can_edit;
    state.canCheckOut = proj.can_check_out || false;
    updateUI();
    updateStatus();
    if (prevWasCheckedOut && state.isViewer) {
      pushSaveEvent('force_turn_in', hadDirty ? 'Force turn-in with unsaved edits' : 'Force turn-in');
      if (hadDirty) {
        showToast('Project was turned in by another user. Unsaved edits may have been lost - check Save status (bell).', 6000);
      } else {
        showToast('Project was turned in. You can check out to edit again.');
      }
    } else if (!prevCanCheckOut && state.canCheckOut) {
      if (prevCheckedOutEmail) {
        showToast('Project is now available. You can check out to edit.');
      } else {
        showToast('You have been promoted to editor. You can now check out to edit.');
      }
    }
  }

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
  function titleFromPdfFilename(name) {
    if (!name) return 'Untitled';
    const s = String(name).replace(/\.pdf$/i, '').trim();
    return s || 'Untitled';
  }
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
  async function loadTestPdf() {
    // A2: When a project is already loaded, refuse to clobber its name/buffer.
    // The Advanced "Load test PDF" entry point is a dev fixture and should not
    // be a back-door for the load-annotations-modal-style data loss.
    if (state.currentProjectId) {
      showToast('Close the current project before loading the test PDF.', 4000);
      return;
    }
    try {
      const res = await fetch(LOAD_TEST_PDF_URL);
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      const buf = await res.arrayBuffer();
      const bufForDisplay = buf.slice(0);
      const pdf = await pdfjsLib.getDocument(buf).promise;
      const numPages = pdf.numPages;
      const pages = [];
      for (let i = 0; i < numPages; i++) {
        const pdfPage = await pdf.getPage(i + 1);
        const label = numPages > 1 ? ('Test PDF — p' + (i + 1)) : 'Test PDF';
        const canvasId = uid();
        pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: makeAnnotations() }], scale: null, rotation: 0 });
      }
      App.openPreparePdfModal(pages, bufForDisplay, 'Test PDF');
      state.pages = [];
      state.activeCanvasIdByPage = {};
      resetGridOrigin();
      state.pdfBuffer = null;
      state.pdfBufferSize = 0;
      state.currentProjectName = 'Untitled';
      state.currentPage = 0;
      updateUI();
      requestAnimationFrame(() => { fitZoom(); renderPdf(); });
    } catch (e) {
      console.error('[Load test PDF]', e);
      showToast('Failed to load test PDF: ' + (e?.message || 'Unknown error'), 4000);
    }
  }
  document.getElementById('pdfInput').onchange = async (e) => {
    // #7b: Capture and clear the "Add additional PDF pages" flag immediately
    // so it can never leak across calls (e.g. user dismisses picker, then
    // uses Upload PDF from elsewhere).
    const isAddAdditional = pendingAddAdditionalPages;
    pendingAddAdditionalPages = false;
    const files = e.target.files;
    if (!files?.length) {
      pendingImportCanvasAfterPdf = false;
      return;
    }
    // #7b: When this upload is an explicit "add additional pages" request and
    // we have a project already, route through Prepare PDF in append mode.
    // Single-file & multi-file uploads both work: multi-file is merged into a
    // single new buffer first so Prepare PDF can show one continuous preview.
    if (isAddAdditional && state.currentProjectId && state.pages.length > 0) {
      const filesToProcess = Array.from(files);
      for (const f of filesToProcess) {
        if (SUPABASE_ENABLED && f.size > PDF_MAX_SIZE_BYTES) {
          alert('File too large. Maximum size is 50 MB. Your file is ' + (f.size / 1024 / 1024).toFixed(1) + ' MB.');
          e.target.value = '';
          return;
        }
      }
      const newBuffers = [];
      const newPages = [];
      try {
        for (const f of filesToProcess) {
          const buf = await f.arrayBuffer();
          newBuffers.push(buf.slice(0));
          const pdf = await pdfjsLib.getDocument(buf).promise;
          const numPages = pdf.numPages;
          for (let i = 0; i < numPages; i++) {
            const pdfPage = await pdf.getPage(i + 1);
            const label = numPages > 1 ? (f.name + ' — p' + (i + 1)) : f.name;
            newPages.push({ pdfPage, label, rotation: 0 });
          }
        }
      } catch (err) {
        alert('Failed to read uploaded PDF: ' + (err?.message || 'unknown error'));
        e.target.value = '';
        return;
      }
      const newBuf = newBuffers.length === 1
        ? newBuffers[0]
        : await mergePdfBuffers(newBuffers);
      e.target.value = '';
      if (!newBuf || !newPages.length) {
        alert('Failed to read uploaded PDF.');
        return;
      }
      App.openPreparePdfModal(newPages, newBuf, state.currentProjectName || 'Untitled', { mode: 'append' });
      return;
    }
    const importBothFollowUp = pendingImportCanvasAfterPdf;
    pendingImportCanvasAfterPdf = false;
    const filesToProcess = Array.from(files);
    const startPageIdx = state.pages.length;
    if (startPageIdx === 0) resetGridOrigin();
    let firstBuf = null;
    const buffersForMerge = [];
    if (startPageIdx > 0 && state.pdfBuffer) {
      buffersForMerge.push(state.pdfBuffer.slice ? state.pdfBuffer.slice(0) : state.pdfBuffer);
    }
    for (const f of filesToProcess) {
      if (SUPABASE_ENABLED && f.size > PDF_MAX_SIZE_BYTES) {
        alert('File too large. Maximum size is 50 MB. Your file is ' + (f.size / 1024 / 1024).toFixed(1) + ' MB.');
        e.target.value = '';
        return;
      }
      const buf = await f.arrayBuffer();
      const bufCopy = buf.slice(0);
      if (!firstBuf) firstBuf = bufCopy;
      buffersForMerge.push(bufCopy);
      const pdf = await pdfjsLib.getDocument(buf).promise;
      const numPages = pdf.numPages;
      for (let i = 0; i < numPages; i++) {
        const pdfPage = await pdf.getPage(i + 1);
        const label = numPages > 1 ? (f.name + ' — p' + (i + 1)) : f.name;
        const canvasId = uid();
        const idx = state.pages.length;
        state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: makeAnnotations() }], scale: null, rotation: 0 });
        state.activeCanvasIdByPage[idx] = canvasId;
      }
    }
    if (SUPABASE_ENABLED && buffersForMerge.length > 0) {
      const projectedBytes = buffersForMerge.reduce(
        (s, b) => s + ((b && (b.byteLength || b.length)) || 0),
        0
      );
      if (projectedBytes > PDF_MAX_SIZE_BYTES) {
        state.pages.length = startPageIdx;
        Object.keys(state.activeCanvasIdByPage).forEach((k) => {
          if (Number(k) >= startPageIdx) delete state.activeCanvasIdByPage[k];
        });
        alert(
          'Total PDF size after merge would be ' +
          (projectedBytes / 1024 / 1024).toFixed(1) +
          ' MB. Maximum is 50 MB. No pages were added.'
        );
        e.target.value = '';
        return;
      }
    }
    if (buffersForMerge.length > 0) {
      const merged = await mergePdfBuffers(buffersForMerge);
      state.pdfBuffer = merged;
      state.pdfBufferSize = merged ? (merged.byteLength ?? merged.length ?? merged.size ?? 0) : 0;
      state.pdfStoragePath = null;
      const mergedPdf = await pdfjsLib.getDocument(merged.slice ? merged.slice(0) : merged).promise;
      const numPages = mergedPdf.numPages;
      for (let i = 0; i < numPages && i < state.pages.length; i++) {
        state.pages[i].pdfPage = await mergedPdf.getPage(i + 1);
      }
      if (!state.pendingCanvasLoad) markProjectDirty();
    }
    if (state.pendingCanvasLoad && firstBuf) {
      const d = state.pendingCanvasLoad.data;
      const hashBuf = state.pdfBuffer || firstBuf;
      const uploadHash = await sha256Hex(hashBuf);
      const hashMatches = !state.pendingCanvasLoad.pdf_hash || state.pendingCanvasLoad.pdf_hash === uploadHash;
      if (!hashMatches && !confirm('This PDF doesn\'t match the project. Annotations may not align. Load anyway?')) {
        state.pendingCanvasLoad = null;
        state.currentProjectId = null;
        state.currentProjectName = titleFromPdfFilename(filesToProcess[0].name);
        try { clearCheckoutExpiredAttention(); } catch (_) {}
      } else {
        const projName = state.pendingCanvasLoad.name;
        state.counters = Array.isArray(d.counters) ? d.counters : [];
        state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
        state.groups = ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
        if (d.iconNames && typeof d.iconNames === 'object') state.iconNames = d.iconNames;
        if (Array.isArray(d.iconOrder)) state.iconOrder = d.iconOrder;
        if (Array.isArray(d.customIconPaths)) saveUserCustomIcons(d.customIconPaths);
        (d.pages || []).forEach(p => {
          applyPageAnnotationsFromData(state.pages[p.index], p);
        });
        if (d.pageScales) {
          d.pageScales.forEach((scale, i) => { if (state.pages[i]) state.pages[i].scale = scale; });
        } else if (d.scale) {
          state.pages.forEach(p => { p.scale = d.scale; });
        }
        state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
        if (d.legendSettings) state.legendSettings = { ...state.legendSettings, ...d.legendSettings };
        if (d.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...d.multiplyZoneSettings };
        if (d.showGridOverlay != null) state.showGridOverlay = !!d.showGridOverlay;
        if (d.gridSettings) state.gridSettings = d.gridSettings;
        reconcileOrphanedCountersAndLineTypes();
        clearUndoStacks();
        state.pendingCanvasLoad = null;
        state.currentProjectName = projName;
        state.pdfHash = uploadHash;
        // Do NOT push this hash to the cloud row here: the locally-uploaded PDF
        // has not been stored, so recording its hash would make the row claim a
        // PDF that isn't in storage (or that differs from the file pdf_path
        // points to). That both reintroduces the "saved but no PDF" bug and can
        // cause the manual-save hash-skip to skip the real upload. The next real
        // save (performSaveProjectToCloud with Include PDF) writes pdf_hash and
        // pdf_path together once the file is actually uploaded.
      }
    } else {
      state.currentProjectName = titleFromPdfFilename(filesToProcess[0].name);
    }
    state.currentPage = startPageIdx;
    updateUI();
    requestAnimationFrame(() => {
      fitZoom();
    });
    e.target.value = '';

    const hashBufForMatch = state.pdfBuffer || firstBuf;
    // Only prompt to load existing annotations / auto-open Prepare PDF when the
    // user is NOT already inside a loaded project. Otherwise the user is just
    // attaching/adding a PDF to their active project and these prompts would
    // either offer to switch projects (destructive) or clobber the project name.
    if (!importBothFollowUp && !state.pendingCanvasLoad && !state.currentProjectId && SUPABASE_ENABLED && supabase && state.supabaseSession?.user && hashBufForMatch) {
      const uploadHash = await sha256Hex(hashBufForMatch);
      const user = state.supabaseSession.user;
      const { data: matches } = await supabase.from('projects').select('id, name, updated_at').eq('user_id', user.id).eq('pdf_hash', uploadHash).order('updated_at', { ascending: false });
      if (matches && matches.length > 0) {
        const listEl = document.getElementById('loadAnnotationsList');
        listEl.innerHTML = '';
        const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        matches.forEach(proj => {
          const div = document.createElement('div');
          const date = proj.updated_at ? new Date(proj.updated_at).toLocaleString() : '';
          div.className = 'sidebar-item load-annotations-item';
          div.innerHTML = '<span class="name">' + esc(proj.name || 'Untitled') + '</span><span class="load-annotations-date">' + esc(date) + '</span>';
          div.onclick = async () => {
            // B1b: Fetch the full project row via list_accessible_projects so
            // we have can_edit / can_check_out / checked_out_* / user_id and
            // can hydrate checkout/permissions via the shared helper.
            let fullProj;
            try {
              const { data: allProjects, error: allErr } = await supabase.rpc('list_accessible_projects');
              if (allErr) throw allErr;
              fullProj = (allProjects || []).find(p => p.id === proj.id) || null;
            } catch (fetchErr) {
              showToast('Failed to load project: ' + ((fetchErr && fetchErr.message) || 'unknown error'), 4000);
              return;
            }
            if (!fullProj) {
              showToast('Project is no longer accessible.', 4000);
              return;
            }
            const d = fullProj.data || {};
            // B2: Page-count mismatch warning. If the cloud project's pages
            // count differs from the just-uploaded PDF, the user might lose
            // annotations or end up with them on wrong pages. Only warn when
            // the cloud project actually has per-page data; an empty d.pages
            // array means nothing to misalign.
            const cloudPages = Array.isArray(d.pages) ? d.pages : [];
            const cloudPageCount = cloudPages.reduce((m, p) => Math.max(m, (p?.index ?? -1) + 1), 0) || cloudPages.length;
            if (cloudPages.length > 0 && cloudPageCount !== state.pages.length) {
              const ok = confirm(
                'These annotations were saved for a ' + cloudPageCount + '-page PDF; ' +
                'the PDF you uploaded has ' + state.pages.length + ' pages. ' +
                'Some annotations may be missing or misplaced. Continue?'
              );
              if (!ok) return;
            }
            state.counters = Array.isArray(d.counters) ? d.counters : [];
            state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
            state.groups = ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
            if (d.iconNames && typeof d.iconNames === 'object') state.iconNames = d.iconNames;
            if (Array.isArray(d.iconOrder)) state.iconOrder = d.iconOrder;
            if (Array.isArray(d.customIconPaths)) saveUserCustomIcons(d.customIconPaths);
            cloudPages.forEach(p => {
              if (state.pages[p.index]) applyPageAnnotationsFromData(state.pages[p.index], p);
            });
            // B2: Sanitize activeCanvasIdByPage to indices that exist in the
            // current PDF so we never reference canvases on pages that aren't
            // present.
            if (d.activeCanvasIdByPage && typeof d.activeCanvasIdByPage === 'object') {
              const sanitized = {};
              Object.entries(d.activeCanvasIdByPage).forEach(([k, v]) => {
                const idx = Number(k);
                if (Number.isFinite(idx) && state.pages[idx]) sanitized[idx] = v;
              });
              state.activeCanvasIdByPage = sanitized;
            }
            if (d.pageScales) {
              d.pageScales.forEach((scale, i) => { if (state.pages[i]) state.pages[i].scale = scale; });
            } else if (d.scale) {
              state.pages.forEach(p => { p.scale = d.scale; });
            }
            state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
            if (d.legendSettings) state.legendSettings = { ...state.legendSettings, ...d.legendSettings };
            if (d.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...d.multiplyZoneSettings };
            if (d.showGridOverlay != null) state.showGridOverlay = !!d.showGridOverlay;
            if (d.gridSettings) state.gridSettings = d.gridSettings;
            reconcileOrphanedCountersAndLineTypes();
            clearUndoStacks();
            // B1b: Shared helper sets currentProjectId/Name, checkout/permissions,
            // realtime subscription, clickcount-last-project, etc. Reuse the
            // in-memory PDF (matched by hash) so next save doesn't re-upload.
            hydrateProjectFromCloudRow(fullProj, {
              reusePdfHash: uploadHash,
              reusePdfStoragePath: fullProj.pdf_path || null,
              source: 'load_annotations'
            });
            state.sidebarReorderModeActive = false;
            hideModal('loadAnnotationsModal');
            fitZoom();
            updateUI();
            renderPdf();
          };
          listEl.appendChild(div);
        });
        showModal('loadAnnotationsModal');
      } else if (startPageIdx === 0) {
        App.openPreparePdfModal(state.pages, state.pdfBuffer, state.currentProjectName);
        state.pages = [];
        state.activeCanvasIdByPage = {};
        state.pdfBuffer = null;
        state.pdfBufferSize = 0;
        state.currentProjectName = 'Untitled';
        state.currentPage = 0;
        updateUI();
        renderPdf();
      }
    }
    if (importBothFollowUp && state.pages.length > 0) {
      showModal('importCanvasAfterPdfModal');
    }
  };

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
    state.tool = TOOL.NONE;
    state.quickLineStart = null;
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
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
    state.tool = TOOL.HIGHLIGHT;
    updateUI();
  };
  document.getElementById('multiplyZoneBtn').onclick = () => {
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
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
    state.tool = TOOL.SCALE_ZONE;
    updateUI();
  };
  document.getElementById('deleteZoneBtn').onclick = () => {
    state.highlightStart = null;
    state.multiplyZoneStart = null;
    state.scaleZoneStart = null;
    state.deleteZoneStart = null;
    state.tool = TOOL.DELETE_ZONE;
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
    setupCreateColorPicker({ presetsRowId: 'lineTypeColorRow', customInputId: 'lineTypeColorCustom', recentRowId: 'lineTypeColorRecent', recentGroupId: 'lineTypeColorRecentGroup' });
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
    pushRecentColor(color);
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
  document.getElementById('lineColorCancel').onclick = () => { state.pendingLineColorApply = null; hideModal('lineColorModal'); };
  // The Choose/Create Line Type modal handlers (.line-type-tab clicks,
  // #lineTypeModalSearchInput, #chooseLineTypeCancel, #createLineTypeCancel,
  // #createLineTypeCreate) moved to features/choose-create-line-type.js
  // (window.App registry). The line color modal handlers (#lineColorCancel
  // above, #lineColorCustom below) and showLineColorModal/applyLineColor stay.
  document.getElementById('lineColorCustom').onchange = () => applyLineColor(document.getElementById('lineColorCustom').value);
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
  const zoomOverlay = document.getElementById('zoomOverlay');
  zoomPct.onclick = () => {
    if (!state.pages.length) return;
    if (window.matchMedia('(max-width: 768px)').matches) {
      zoomOverlay.classList.add('visible');
      const rect = zoomPct.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - zoomOverlay.offsetWidth / 2;
      left = Math.max(8, Math.min(window.innerWidth - zoomOverlay.offsetWidth - 8, left));
      zoomOverlay.style.left = left + 'px';
      zoomOverlay.style.top = Math.max(8, rect.top - zoomOverlay.offsetHeight - 8) + 'px';
    } else {
      App.showZoomModal();
    }
  };
  document.getElementById('zoomOverlayMinus').onclick = (e) => { e.stopPropagation(); doZoomOut(); };
  document.getElementById('zoomOverlayPlus').onclick = (e) => { e.stopPropagation(); doZoomIn(); };
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

  let pendingAddCanvasMode = 'new';

  // SECTION: Canvas layers
  function openAddCanvasModal() {
    if (!state.pages.length || state.isViewer) return;
    const page = state.pages[state.currentPage];
    const canvases = getPageCanvases(page);
    const n = canvases.length + 1;
    pendingAddCanvasMode = 'new';
    const newBtn = document.getElementById('addCanvasModalNew');
    const dupBtn = document.getElementById('addCanvasModalDuplicate');
    const nameInput = document.getElementById('addCanvasModalName');
    if (newBtn) newBtn.classList.add('selected');
    if (dupBtn) dupBtn.classList.remove('selected');
    nameInput.placeholder = 'Layer ' + n;
    nameInput.value = '';
    showModal('addCanvasModal');
    nameInput.focus();
  }

  function updateAddCanvasModalForMode() {
    const page = state.pages[state.currentPage];
    const canvases = getPageCanvases(page);
    const currentCanvas = getActiveCanvas(page);
    const n = canvases.length + 1;
    const nameInput = document.getElementById('addCanvasModalName');
    if (pendingAddCanvasMode === 'duplicate') {
      const baseName = currentCanvas?.name || 'Main';
      nameInput.placeholder = 'Copy of ' + baseName;
      nameInput.value = 'Copy of ' + baseName;
    } else {
      nameInput.placeholder = 'Layer ' + n;
      nameInput.value = '';
    }
  }

  function doAddCanvas(mode, name) {
    if (!state.pages.length || state.isViewer) return;
    const page = state.pages[state.currentPage];
    const canvases = getPageCanvases(page);
    const n = canvases.length + 1;
    const defaultNew = 'Layer ' + n;
    const currentCanvas = getActiveCanvas(page);
    const defaultDup = 'Copy of ' + (currentCanvas?.name || 'Main');
    const finalName = (name || '').trim() || (mode === 'duplicate' ? defaultDup : defaultNew);
    if (!finalName) return;
    pushUndoSnapshot();
    const annotations = mode === 'duplicate' ? deepCopyAnnotations(getActiveAnnotations(page)) : makeAnnotations();
    const newCanvas = { id: uid(), name: finalName, annotations };
    if (!page.canvases) page.canvases = [];
    page.canvases.push(newCanvas);
    state.activeCanvasIdByPage[state.currentPage] = newCanvas.id;
    markProjectDirty();
    renderPdf();
    updateUI();
  }

  let pendingCanvasEdit = null;
  let pendingDeleteCanvas = null;

  function openCanvasDetailsModal(canvas) {
    if (!state.pages.length || state.isViewer) return;
    const page = state.pages[state.currentPage];
    const canvases = getPageCanvases(page);
    if (!canvases.includes(canvas)) return;
    document.getElementById('canvasMenu')?.classList.remove('visible');
    pendingCanvasEdit = canvas;
    const nameInput = document.getElementById('canvasDetailsName');
    const deleteBtn = document.getElementById('canvasDetailsDelete');
    if (nameInput) nameInput.value = canvas.name || 'Main';
    if (deleteBtn) deleteBtn.style.display = canvases.length <= 1 ? 'none' : '';
    showModal('canvasDetailsModal');
    nameInput?.focus();
  }

  function performDeleteCanvas(canvas) {
    if (!state.pages.length || state.isViewer) return;
    const page = state.pages[state.currentPage];
    const canvases = getPageCanvases(page);
    if (canvases.length <= 1) return;
    const idx = canvases.indexOf(canvas);
    if (idx < 0) return;
    pushUndoSnapshot();
    page.canvases.splice(idx, 1);
    if (state.activeCanvasIdByPage[state.currentPage] === canvas.id) {
      const remaining = getPageCanvases(page);
      state.activeCanvasIdByPage[state.currentPage] = remaining[0]?.id ?? null;
    }
    markProjectDirty();
    renderPdf();
    updateUI();
  }

  document.getElementById('addCanvasBtn').onclick = () => openAddCanvasModal();

  const addCanvasModalNew = document.getElementById('addCanvasModalNew');
  const addCanvasModalDuplicate = document.getElementById('addCanvasModalDuplicate');
  const addCanvasModalName = document.getElementById('addCanvasModalName');
  const addCanvasModalCancel = document.getElementById('addCanvasModalCancel');
  const addCanvasModalCreate = document.getElementById('addCanvasModalCreate');
  if (addCanvasModalNew) {
    addCanvasModalNew.onclick = () => {
      pendingAddCanvasMode = 'new';
      addCanvasModalNew.classList.add('selected');
      if (addCanvasModalDuplicate) addCanvasModalDuplicate.classList.remove('selected');
      updateAddCanvasModalForMode();
    };
  }
  if (addCanvasModalDuplicate) {
    addCanvasModalDuplicate.onclick = () => {
      pendingAddCanvasMode = 'duplicate';
      addCanvasModalDuplicate.classList.add('selected');
      if (addCanvasModalNew) addCanvasModalNew.classList.remove('selected');
      updateAddCanvasModalForMode();
    };
  }
  if (addCanvasModalCancel) addCanvasModalCancel.onclick = () => hideModal('addCanvasModal');
  if (addCanvasModalCreate) {
    addCanvasModalCreate.onclick = () => {
      const name = addCanvasModalName?.value?.trim() || addCanvasModalName?.placeholder || '';
      hideModal('addCanvasModal');
      doAddCanvas(pendingAddCanvasMode, name);
    };
  }
  if (addCanvasModalName) {
    addCanvasModalName.onkeydown = (e) => {
      if (e.key === 'Enter') addCanvasModalCreate?.click();
    };
  }

  document.getElementById('canvasDetailsClose').onclick = () => {
    const canvas = pendingCanvasEdit;
    const nameInput = document.getElementById('canvasDetailsName');
    if (canvas && nameInput) {
      canvas.name = (nameInput.value || '').trim() || 'Main';
      markProjectDirty();
      updateUI();
    }
    pendingCanvasEdit = null;
    hideModal('canvasDetailsModal');
  };
  document.getElementById('canvasDetailsDelete').onclick = () => {
    const canvas = pendingCanvasEdit;
    if (!canvas) return;
    const page = state.pages[state.currentPage];
    const canvases = getPageCanvases(page);
    if (canvases.length <= 1) return;
    pendingDeleteCanvas = canvas;
    document.getElementById('deleteCanvasName').textContent = canvas.name || 'Main';
    hideModal('canvasDetailsModal');
    showModal('deleteCanvasConfirmModal');
  };
  document.getElementById('canvasDetailsName').onkeydown = (e) => {
    if (e.key === 'Enter') document.getElementById('canvasDetailsClose').click();
  };

  document.getElementById('deleteCanvasCancel').onclick = () => {
    pendingDeleteCanvas = null;
    hideModal('deleteCanvasConfirmModal');
  };
  document.getElementById('deleteCanvasConfirm').onclick = () => {
    const canvas = pendingDeleteCanvas;
    pendingDeleteCanvas = null;
    hideModal('deleteCanvasConfirmModal');
    if (canvas) {
      performDeleteCanvas(canvas);
    }
  };

  const canvasLayersBtn = document.getElementById('canvasLayersBtn');
  const canvasMenu = document.getElementById('canvasMenu');
  const canvasMenuAdd = document.getElementById('canvasMenuAdd');
  if (canvasLayersBtn && canvasMenu) {
    canvasLayersBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (canvasMenu.classList.contains('visible')) {
        canvasMenu.classList.remove('visible');
        return;
      }
      canvasMenu.style.left = '-9999px';
      canvasMenu.classList.add('visible');
      const btnRect = canvasLayersBtn.getBoundingClientRect();
      canvasMenu.style.left = btnRect.left + 'px';
      canvasMenu.style.top = Math.max(8, btnRect.top - canvasMenu.offsetHeight - 4) + 'px';
    });
  }
  if (canvasMenuAdd && canvasMenu) {
    canvasMenuAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      canvasMenu.classList.remove('visible');
      openAddCanvasModal();
    });
  }

  document.getElementById('exportBtn').onclick = () => {
    if (!projectHasAnyCanvasMarkup()) return;
    const data = { version: 1, counters: state.counters, lineTypes: state.lineTypes, iconNames: state.iconNames || {}, iconOrder: state.iconOrder || null, customIconPaths: getUserCustomIcons(), maxZoom: getMaxZoom(), groups: state.groups || [], legendSettings: state.legendSettings, multiplyZoneSettings: state.multiplyZoneSettings, showGridOverlay: state.showGridOverlay, gridSettings: state.gridSettings, pages: state.pages.map((p, i) => ({ index: i, label: p.label, canvases: p.canvases, scale: p.scale, rotation: p.rotation ?? 0 })), activeCanvasIdByPage: state.activeCanvasIdByPage || {} };
    const a = document.createElement('a');
    a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(data));
    a.download = sanitizeForFilename(state.currentProjectName) + '.json';
    a.click();
    logUserEvent('export_canvas', state.currentProjectId, {});
  };
  document.getElementById('exportBtnSidebar').onclick = () => document.getElementById('exportBtn').click();

  // SECTION: PDF download helpers & PipeTooling menu
  // The Export PDFs modal (openSpecificPagesModal + the specificPages* cluster
  // and its #specificPages* handlers) lives in features/export-pdfs.js
  // (window.App registry); it is reached via App.openSpecificPagesModal at call
  // time. The shared download helpers below (sanitizeForFilename /
  // downloadPdfBuffer / downloadProjectPdf) and the PipeTooling toggle stay here.
  function sanitizeForFilename(s) {
    const raw = (s || 'Untitled').replace(/\.pdf$/i, '').trim();
    const cleaned = raw.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
    return cleaned || 'Untitled';
  }
  function downloadPdfBuffer(buffer, filename) {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.pdf') ? filename : filename + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function downloadProjectPdf() {
    let buf = null;
    if (state.pdfBuffer && state.pdfBuffer.byteLength > 0) {
      buf = state.pdfBuffer;
    } else if (state.pdfStoragePath && SUPABASE_ENABLED && supabase) {
      try {
        const cachedBlob = state.currentProjectId && state.pdfHash ? await pdfCacheGet(state.currentProjectId, state.pdfHash) : null;
        if (cachedBlob && cachedBlob.size > 0) {
          buf = await cachedBlob.arrayBuffer();
        }
        if (!buf || buf.byteLength === 0) {
          const { data: blob, error: dlErr } = await supabase.storage.from('pdfs').download(state.pdfStoragePath);
          if (dlErr || !blob || blob.size === 0) {
            showToast('Failed to download PDF: ' + (dlErr?.message || 'PDF not found'), 4000);
            return;
          }
          buf = await blob.arrayBuffer();
        }
      } catch (e) {
        console.error('[Download PDF]', e);
        showToast('Failed to download PDF: ' + (e?.message || 'Unknown error'), 4000);
        return;
      }
    }
    if (!buf || buf.byteLength === 0) {
      showToast('No PDF available to download.', 3000);
      return;
    }
    downloadPdfBuffer(buf, sanitizeForFilename(state.currentProjectName) + '.pdf');
    logUserEvent('export_pdf', state.currentProjectId, { source: 'project-pdf' });
  }
  const forPipeToolingBtn = document.getElementById('forPipeTooling');
  const forPipeToolingMenu = document.getElementById('forPipeToolingMenu');
  const forPipeToolingDropdown = document.getElementById('forPipeToolingDropdown');
  if (forPipeToolingBtn && forPipeToolingMenu) {
    forPipeToolingBtn.onclick = (e) => {
      e.stopPropagation();
      if (forPipeToolingMenu.classList.contains('visible')) {
        forPipeToolingMenu.classList.remove('visible');
        if (forPipeToolingDropdown && forPipeToolingMenu.parentElement !== forPipeToolingDropdown) forPipeToolingDropdown.appendChild(forPipeToolingMenu);
      } else {
        prefetchExportViewLink();
        forPipeToolingMenu.style.left = '';
        forPipeToolingMenu.style.right = '';
        forPipeToolingMenu.classList.add('visible');
        const btnRect = forPipeToolingBtn.getBoundingClientRect();
        forPipeToolingMenu.style.position = 'fixed';
        forPipeToolingMenu.style.left = btnRect.left + 'px';
        const menuHeight = 120;
        forPipeToolingMenu.style.top = Math.max(8, btnRect.top - menuHeight - 4) + 'px';
        forPipeToolingMenu.style.minWidth = Math.max(btnRect.width, 280) + 'px';
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && forPipeToolingMenu.parentElement !== document.body) document.body.appendChild(forPipeToolingMenu);
      }
    };
  }
  // SECTION: Copy summaries (PipeTooling / Email)
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
  // Cached view-link URL for the "Copy to /Tooling" export. Prefetched when the
  // dropdown opens so the clipboard write can stay inside the user gesture
  // (Safari/Firefox revoke clipboard permission across an await).
  let exportViewLinkUrl = null;
  let exportViewLinkProjectId = null;
  function canExportViewLink() {
    return !!(SUPABASE_ENABLED && supabase && state.currentProjectId && state.supabaseSession?.user && !state.loadedViaViewLink);
  }
  function prefetchExportViewLink() {
    if (!canExportViewLink()) { exportViewLinkUrl = null; exportViewLinkProjectId = null; return; }
    if (exportViewLinkUrl && exportViewLinkProjectId === state.currentProjectId) return;
    const pid = state.currentProjectId;
    getOrCreateViewLinkUrl().then((url) => {
      if (state.currentProjectId === pid) { exportViewLinkUrl = url; exportViewLinkProjectId = pid; }
    }).catch(() => { /* best-effort; doCopyPipeTooling retries inline */ });
  }
  async function doCopyPipeTooling(getAnnFn, pageIndices) {
    const opts = {};
    if (getAnnFn) opts.getAnnotations = getAnnFn;
    if (pageIndices != null) opts.pageIndices = pageIndices;
    let text = typeof window.getPipeToolingSummary === 'function' ? window.getPipeToolingSummary(opts) : '';
    if (!text) {
      alert('No items to summarize. Add counters or line types first.');
      return;
    }
    // Append a project view link so importing tools (PipeTooling / TakeoffTooling)
    // can link the bid back to the source takeoff. Importers detect it by scanning
    // the pasted text for a counttooling URL with a ?t=<token>.
    let noLinkToast = null;
    if (SUPABASE_ENABLED) {
      if (canExportViewLink()) {
        let url = (exportViewLinkUrl && exportViewLinkProjectId === state.currentProjectId) ? exportViewLinkUrl : null;
        if (!url) {
          try {
            url = await getOrCreateViewLinkUrl();
            exportViewLinkUrl = url;
            exportViewLinkProjectId = state.currentProjectId;
          } catch (_) {
            noLinkToast = 'Counts copied, but the view link could not be created.';
          }
        }
        if (url) text += '\n\nView link:\t' + url;
      } else if (!state.currentProjectId) {
        noLinkToast = 'Counts copied. Save the project to the cloud to include a view link.';
      } else if (!state.supabaseSession?.user) {
        noLinkToast = 'Counts copied. Sign in to include a view link.';
      } else if (state.loadedViaViewLink) {
        noLinkToast = 'Counts copied. View-only sessions cannot create a share link.';
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      if (noLinkToast) {
        showToast(noLinkToast);
      } else {
        showModal('pipeToolingCopiedModal');
        setTimeout(() => hideModal('pipeToolingCopiedModal'), 1500);
      }
    } catch (err) {
      alert('Could not copy to clipboard: ' + (err.message || err));
    }
  }
  document.querySelectorAll('.pipe-tooling-option').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      if (forPipeToolingMenu) {
        forPipeToolingMenu.classList.remove('visible');
        if (forPipeToolingDropdown && forPipeToolingMenu.parentElement !== forPipeToolingDropdown) forPipeToolingDropdown.appendChild(forPipeToolingMenu);
      }
      if (mode === 'this-canvas') await doCopyPipeTooling(null, [state.currentPage]);
      else if (mode === 'visible') await doCopyPipeTooling(null);
      else if (mode === 'all') await doCopyPipeTooling(getMergedAnnotationsForPage);
    };
  });

  const copySummaryTextBtn = document.getElementById('copySummaryText');
  const copySummaryTextMenu = document.getElementById('copySummaryTextMenu');
  const copySummaryTextDropdown = document.getElementById('copySummaryTextDropdown');
  if (copySummaryTextBtn && copySummaryTextMenu) {
    copySummaryTextBtn.onclick = (e) => {
      e.stopPropagation();
      if (copySummaryTextMenu.classList.contains('visible')) {
        copySummaryTextMenu.classList.remove('visible');
        if (copySummaryTextDropdown && copySummaryTextMenu.parentElement !== copySummaryTextDropdown) copySummaryTextDropdown.appendChild(copySummaryTextMenu);
      } else {
        copySummaryTextMenu.style.left = '';
        copySummaryTextMenu.style.right = '';
        copySummaryTextMenu.classList.add('visible');
        const btnRect = copySummaryTextBtn.getBoundingClientRect();
        copySummaryTextMenu.style.position = 'fixed';
        copySummaryTextMenu.style.left = btnRect.left + 'px';
        const menuHeight = 120;
        const spaceBelow = window.innerHeight - (btnRect.bottom + 4);
        const top = spaceBelow < menuHeight
          ? Math.max(8, btnRect.top - menuHeight - 4)
          : (btnRect.bottom + 4);
        copySummaryTextMenu.style.top = top + 'px';
        copySummaryTextMenu.style.minWidth = Math.max(btnRect.width, 280) + 'px';
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && copySummaryTextMenu.parentElement !== document.body) document.body.appendChild(copySummaryTextMenu);
      }
    };
  }
  async function doCopyEmailSummary(getAnnFn, pageIndices) {
    const opts = {};
    if (getAnnFn) opts.getAnnotations = getAnnFn;
    if (pageIndices != null) opts.pageIndices = pageIndices;
    const text = typeof window.getEmailTextSummary === 'function' ? window.getEmailTextSummary(opts) : '';
    if (!text) {
      alert('No items to summarize. Add counters or line types first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showModal('pipeToolingCopiedModal');
      setTimeout(() => hideModal('pipeToolingCopiedModal'), 1500);
    } catch (err) {
      alert('Could not copy to clipboard: ' + (err.message || err));
    }
  }
  document.querySelectorAll('.copy-summary-option').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      if (copySummaryTextMenu) {
        copySummaryTextMenu.classList.remove('visible');
        if (copySummaryTextDropdown && copySummaryTextMenu.parentElement !== copySummaryTextDropdown) copySummaryTextDropdown.appendChild(copySummaryTextMenu);
      }
      if (mode === 'this-canvas') await doCopyEmailSummary(null, [state.currentPage]);
      else if (mode === 'visible') await doCopyEmailSummary(null);
      else if (mode === 'all') await doCopyEmailSummary(getMergedAnnotationsForPage);
    };
  });

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
  // SECTION: Import-canvas-after-PDF & Clear Page modals

  document.getElementById('importBtn').onclick = () => document.getElementById('importInput').click();
  document.getElementById('importBtnSidebar').onclick = () => document.getElementById('importInput').click();
  const importCanvasAfterPdfChoose = document.getElementById('importCanvasAfterPdfChoose');
  const importCanvasAfterPdfCancel = document.getElementById('importCanvasAfterPdfCancel');
  const importCanvasAfterPdfModalClose = document.getElementById('importCanvasAfterPdfModalClose');
  function closeImportCanvasAfterPdfModal() { hideModal('importCanvasAfterPdfModal'); }
  if (importCanvasAfterPdfChoose) {
    importCanvasAfterPdfChoose.onclick = () => {
      closeImportCanvasAfterPdfModal();
      document.getElementById('importInput').click();
    };
  }
  if (importCanvasAfterPdfCancel) importCanvasAfterPdfCancel.onclick = closeImportCanvasAfterPdfModal;
  if (importCanvasAfterPdfModalClose) importCanvasAfterPdfModalClose.onclick = closeImportCanvasAfterPdfModal;
  document.getElementById('importInput').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        state.counters = Array.isArray(data.counters) ? data.counters : [];
        state.lineTypes = Array.isArray(data.lineTypes) ? data.lineTypes : [];
        state.groups = ensureGroupColors(Array.isArray(data.groups) ? data.groups : []);
        if (data.iconNames && typeof data.iconNames === 'object') state.iconNames = data.iconNames;
        if (Array.isArray(data.iconOrder)) state.iconOrder = data.iconOrder;
        if (data.legendSettings) state.legendSettings = { ...state.legendSettings, ...data.legendSettings };
        if (data.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...data.multiplyZoneSettings };
        if (data.showGridOverlay != null) state.showGridOverlay = !!data.showGridOverlay;
        if (data.gridSettings) state.gridSettings = data.gridSettings;
        if (Array.isArray(data.customIconPaths)) saveUserCustomIcons(data.customIconPaths);
        (data.pages || []).forEach(p => {
          applyPageAnnotationsFromData(state.pages[p.index], p, data.scale || null);
        });
        if (data.maxZoom != null) state.maxZoom = data.maxZoom; else state.maxZoom = null;
        reconcileOrphanedCountersAndLineTypes();
        clearUndoStacks();
        markProjectDirty();
        updateUI();
        renderPdf();
      } catch (err) { alert('Invalid import file'); }
    };
    r.readAsText(f);
    e.target.value = '';
  };

  document.getElementById('customIconUploadInput').onchange = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    parseUploadedSvg(f).then((icon) => {
      const userIcons = getUserCustomIcons();
      userIcons.push(icon);
      saveUserCustomIcons(userIcons);
      markProjectDirty();
      const customGrid = document.getElementById('counterIconGridCustom');
      const detailsCustomGrid = document.getElementById('counterLineTypeDetailsIconGridCustom');
      const effectiveCustom = getEffectiveCustomIcons();
      const uploadCell = '<div class="icon-cell icon-cell-upload" data-upload="1" title="Upload SVG">+</div>';
      const iconCells = effectiveCustom.map((ic) => '<div class="icon-cell" data-path="' + ic.value + '"><svg viewBox="' + ic.viewBox + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
      if (customGrid) {
        customGrid.innerHTML = uploadCell + iconCells;
        customGrid.querySelectorAll('.icon-cell').forEach(c => {
          c.onclick = () => {
            if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
            document.querySelectorAll('#counterIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
            customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            c.classList.add('selected');
            const path = c.dataset.path;
            if (path) {
              const nameEl = document.getElementById('counterName');
              if (!nameEl.value.trim()) nameEl.value = getIconName(path);
            }
          };
        });
        const newIconCell = Array.from(customGrid.querySelectorAll('.icon-cell[data-path]')).find(c => c.dataset.path === icon.value);
        if (newIconCell) {
          document.querySelectorAll('#counterIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
          customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          newIconCell.classList.add('selected');
          const nameEl = document.getElementById('counterName');
          if (!nameEl.value.trim()) nameEl.value = icon.name;
        }
      }
      const plumCustomGrid = document.getElementById('plumIconGridCustom');
      if (plumCustomGrid) {
        plumCustomGrid.innerHTML = uploadCell + iconCells;
        plumCustomGrid.querySelectorAll('.icon-cell').forEach(c => {
          c.onclick = () => {
            if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
            document.querySelectorAll('#plumIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
            plumCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            c.classList.add('selected');
          };
        });
        const newIconCellPlum = Array.from(plumCustomGrid.querySelectorAll('.icon-cell[data-path]')).find(c => c.dataset.path === icon.value);
        if (newIconCellPlum) {
          document.querySelectorAll('#plumIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
          plumCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          newIconCellPlum.classList.add('selected');
        }
      }
      const counterQuickCountCustomGrid = document.getElementById('counterQuickCountIconGridCustom');
      if (counterQuickCountCustomGrid) {
        counterQuickCountCustomGrid.innerHTML = uploadCell + iconCells;
        counterQuickCountCustomGrid.querySelectorAll('.icon-cell').forEach(c => {
          c.onclick = () => {
            if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
            document.querySelectorAll('#counterQuickCountIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
            counterQuickCountCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            c.classList.add('selected');
            App.updateCounterQuickCountNamePreview();
          };
        });
        const newIconCellQC = Array.from(counterQuickCountCustomGrid.querySelectorAll('.icon-cell[data-path]')).find(c => c.dataset.path === icon.value);
        if (newIconCellQC) {
          document.querySelectorAll('#counterQuickCountIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
          counterQuickCountCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          newIconCellQC.classList.add('selected');
          App.updateCounterQuickCountNamePreview();
        }
      }
      if (detailsCustomGrid) {
        const grid = document.getElementById('counterLineTypeDetailsIconGrid');
        const item = counterLineTypeDetailsItem;
        const currentIcon = item?.icon || '';
        const iconCellsDetails = effectiveCustom.map((ic) => {
          const sel = ic.value === currentIcon ? ' selected' : '';
          return '<div class="icon-cell' + sel + '" data-path="' + ic.value + '"><svg viewBox="' + ic.viewBox + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>';
        }).join('');
        detailsCustomGrid.innerHTML = uploadCell + iconCellsDetails;
        detailsCustomGrid.querySelectorAll('.icon-cell').forEach(c => {
          c.onclick = () => {
            if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
            if (grid) grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            detailsCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            c.classList.add('selected');
            if (item) {
              pushUndoSnapshot();
              item.icon = c.dataset.path;
              markProjectDirty();
              updateUI();
              renderPdf();
            }
          };
        });
        const newIconCellDetails = Array.from(detailsCustomGrid.querySelectorAll('.icon-cell[data-path]')).find(c => c.dataset.path === icon.value);
        if (newIconCellDetails && item) {
          if (grid) grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          detailsCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          newIconCellDetails.classList.add('selected');
          pushUndoSnapshot();
          item.icon = icon.value;
          markProjectDirty();
          updateUI();
          renderPdf();
        }
      }
      updateUI();
    }).catch((err) => {
      alert(err && err.message ? err.message : 'Invalid SVG. SVG must contain at least one path, rect, circle, ellipse, or line.');
    });
  };

  function showClearPageModal() {
    const page = state.pages[state.currentPage];
    const canvas = page ? getActiveCanvas(page) : null;
    const name = canvas?.name || 'Main';
    const msg = document.getElementById('clearPageConfirmMessage');
    if (msg) msg.textContent = 'Clear current canvas (' + name + ')?';
    showModal('clearPageConfirmModal');
  }
  document.getElementById('clearPage').onclick = () => showClearPageModal();
  document.getElementById('clearPageSidebar').onclick = () => showClearPageModal();
  // SECTION: Download current page
  async function downloadCurrentPageAsPdf(mode) {
    const page = state.pages[state.currentPage];
    const isAllPages = mode === 'all-pages' || mode === 'all-pages-canvases';
    if (!isAllPages && !page?.pdfPage) return;
    if (!isAllPages) ensureActiveCanvas(page);
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib?.jsPDF) { alert('Download requires jsPDF. Please refresh the page.'); return; }
    const EXPORT_SCALE = 4;
    const PT_TO_MM = 25.4 / 72;
    const exportOverrides = { markerScale: state.exportSettings?.markerScale ?? 0.75, lineScale: state.exportSettings?.lineScale ?? 0.75 };
    const btn = document.getElementById('downloadCurrentPageBtn');
    const origText = btn?.title || '';
    if (btn) { btn.disabled = true; btn.title = 'Downloading…'; }
    const baseName = sanitizeForFilename(state.currentProjectName);
    const pageNum = state.currentPage + 1;
    try {
      if (mode === 'all-canvases') {
        const canvases = getPageCanvases(page);
        if (canvases.length === 0) { if (btn) { btn.disabled = false; btn.title = origText; } return; }
        let doc = null;
        for (let i = 0; i < canvases.length; i++) {
          const c = canvases[i];
          const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
          renderAnnotationsToContext(ctx, page, EXPORT_SCALE, exportOverrides, c.annotations || makeAnnotations());
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
          const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
          const caption = c.name || 'Main';
          const captionTop = 10;
          const imageTop = 14;
          const pdfPageW = Math.max(210, wMm + 28);
          const pdfPageH = imageTop + hMm + 14 + 20;
          if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [pdfPageW, pdfPageH], orientation: pdfPageW > pdfPageH ? 'l' : 'p' });
          else doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
          doc.setFontSize(9);
          doc.text(caption, 14, captionTop);
          doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
        }
        if (doc) doc.save('takeoff-page' + pageNum + '_all-canvases_' + baseName + '.pdf');
      } else if (mode === 'all-pages') {
        if (state.pages.length === 0) { if (btn) { btn.disabled = false; btn.title = origText; } return; }
        let doc = null;
        for (let i = 0; i < state.pages.length; i++) {
          if (btn) btn.title = 'Exporting plan ' + (i + 1) + '/' + state.pages.length + '…';
          const p = state.pages[i];
          ensureActiveCanvas(p);
          const viewport = p.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: p.rotation ?? 0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await p.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
          renderAnnotationsToContext(ctx, p, EXPORT_SCALE, exportOverrides);
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
          const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
          if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
          else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
          doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        }
        if (doc) doc.save('takeoff-all-pages_' + baseName + '.pdf');
      } else if (mode === 'all-pages-canvases') {
        if (state.pages.length === 0) { if (btn) { btn.disabled = false; btn.title = origText; } return; }
        let doc = null;
        for (let pageIdx = 0; pageIdx < state.pages.length; pageIdx++) {
          const p = state.pages[pageIdx];
          ensureActiveCanvas(p);
          const canvases = getPageCanvases(p);
          if (canvases.length === 0) continue;
          for (let ci = 0; ci < canvases.length; ci++) {
            if (btn) btn.title = 'Exporting page ' + (pageIdx + 1) + '/' + state.pages.length + '…';
            const c = canvases[ci];
            const viewport = p.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: p.rotation ?? 0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await p.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
            renderAnnotationsToContext(ctx, p, EXPORT_SCALE, exportOverrides, c.annotations || makeAnnotations());
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
            const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
            if (canvases.length === 1) {
              if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
              else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
              doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
            } else {
              const caption = c.name || 'Main';
              const captionTop = 10;
              const imageTop = 14;
              const pdfPageW = Math.max(210, wMm + 28);
              const pdfPageH = imageTop + hMm + 14 + 20;
              if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [pdfPageW, pdfPageH], orientation: pdfPageW > pdfPageH ? 'l' : 'p' });
              else doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
              doc.setFontSize(9);
              doc.text(caption, 14, captionTop);
              doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
            }
          }
        }
        if (doc) doc.save('takeoff-all-pages-canvases_' + baseName + '.pdf');
      } else {
        const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
        renderAnnotationsToContext(ctx, page, EXPORT_SCALE, exportOverrides);
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
        const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
        const doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
        doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        doc.save('takeoff-page' + pageNum + '_' + baseName + '.pdf');
      }
      logUserEvent('export_pdf', state.currentProjectId, { source: 'download-current-page', mode: mode || 'this-canvas' });
    } catch (err) {
      console.error(err);
      alert('Download failed: ' + (err?.message || err));
    }
    if (btn) { btn.disabled = false; btn.title = origText; }
  }
  const downloadCurrentPageBtn = document.getElementById('downloadCurrentPageBtn');
  const downloadCurrentPageMenu = document.getElementById('downloadCurrentPageMenu');
  if (downloadCurrentPageBtn) {
    downloadCurrentPageBtn.onclick = (e) => {
      e.stopPropagation();
      const page = state.pages[state.currentPage];
      const canvases = page ? getPageCanvases(page) : [];
      const multiPage = state.pages.length > 1;
      if (!multiPage && canvases.length <= 1) {
        downloadCurrentPageAsPdf('this-canvas');
      } else if (downloadCurrentPageMenu) {
        if (downloadCurrentPageMenu.classList.contains('visible')) {
          downloadCurrentPageMenu.classList.remove('visible');
        } else {
          downloadCurrentPageMenu.style.left = '';
          downloadCurrentPageMenu.style.right = '';
          downloadCurrentPageMenu.classList.add('visible');
          const btnRect = downloadCurrentPageBtn.getBoundingClientRect();
          downloadCurrentPageMenu.style.position = 'fixed';
          downloadCurrentPageMenu.style.left = (btnRect.right - 300) + 'px';
          downloadCurrentPageMenu.style.top = (btnRect.bottom + 4) + 'px';
        }
      }
    };
  }
  document.querySelectorAll('.download-page-option').forEach(opt => {
    opt.onclick = (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      if (downloadCurrentPageMenu) downloadCurrentPageMenu.classList.remove('visible');
      if (mode) downloadCurrentPageAsPdf(mode);
    };
  });
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
      else if (action === 'pdf') await downloadProjectPdf();
      else if (action === 'both') {
        document.getElementById('exportBtn').click();
        await downloadProjectPdf();
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
  document.getElementById('settingsClearPage').onclick = () => { hideModal('settingsModal'); showClearPageModal(); };
  document.getElementById('macrosModalClose').onclick = () => hideModal('macrosModal');
  document.getElementById('counterCustomIconsLabel')?.addEventListener('click', () => showModal('customIconTipsModal'));
  document.getElementById('counterLineTypeDetailsCustomIconsLabel')?.addEventListener('click', () => showModal('customIconTipsModal'));
  document.getElementById('plumCustomIconsLabel')?.addEventListener('click', () => showModal('customIconTipsModal'));
  document.getElementById('counterQuickCountCustomIconsLabel')?.addEventListener('click', () => showModal('customIconTipsModal'));
  document.getElementById('customIconTipsClose').onclick = () => hideModal('customIconTipsModal');
  // The Note add/edit modal (openNoteModal + its Cancel/Done handlers) lives in
  // features/note.js (window.App registry); openNoteModal is reached via
  // App.openNoteModal at call time.

  // SECTION: Zone & page-action modal handlers
  document.getElementById('multiplyZoneCancel').onclick = () => {
    hideModal('multiplyZoneModal');
    state.multiplyZoneStart = null;
    state.pendingMultiplyZone = null;
    state.pendingMultiplyZoneEdit = null;
  };
  document.getElementById('deleteZoneCancel').onclick = () => {
    hideModal('deleteZoneModal');
    state.pendingDeleteZone = null;
  };
  document.getElementById('deleteZoneConfirm').onclick = () => {
    const pending = state.pendingDeleteZone;
    hideModal('deleteZoneModal');
    state.pendingDeleteZone = null;
    if (pending?.ann && pending?.collected) {
      performDeleteZone(pending.ann, pending.collected);
    }
  };
  (() => {
    const inputEl = document.getElementById('multiplyZoneMultiplier');
    const sync = () => { const v = parseInt(inputEl.value, 10); if (!isNaN(v) && v >= 1) state.pendingMultiplyZoneValue = v; };
    if (inputEl) {
      inputEl.oninput = inputEl.onchange = sync;
      inputEl.onblur = sync;
    }
  })();
  document.getElementById('multiplyZoneApply').onclick = (e) => {
    const pending = state.pendingMultiplyZone;
    /* Defer so input blur commits value before we read. Number inputs may not
       update .value until after blur; click runs before blur on some browsers. */
    setTimeout(() => {
      const inputEl = document.getElementById('multiplyZoneMultiplier');
      if (inputEl) { const v = parseInt(inputEl.value, 10); if (!isNaN(v) && v >= 1) state.pendingMultiplyZoneValue = v; }
      hideModal('multiplyZoneModal');
      const edit = state.pendingMultiplyZoneEdit;
      state.pendingMultiplyZone = null;
      state.pendingMultiplyZoneEdit = null;
      const mult = state.pendingMultiplyZoneValue != null && state.pendingMultiplyZoneValue >= 1
        ? state.pendingMultiplyZoneValue
        : parseInt(document.getElementById('multiplyZoneMultiplier').value, 10);
      if (isNaN(mult) || mult < 1) return;
      if (edit) {
        const page = state.pages[state.currentPage];
        const ann = page ? getActiveAnnotations(page) : null;
        const zone = ann?.multiplyZones?.[edit.zoneIndex];
        if (zone) {
          pushUndoSnapshot();
          zone.multiplier = mult;
          markProjectDirty();
        }
      } else if (pending) {
        pushUndoSnapshot();
        const page = state.pages[state.currentPage];
        const canvas = page && ensureActiveCanvas(page);
        if (canvas) {
          if (!canvas.annotations.multiplyZones) canvas.annotations.multiplyZones = [];
          canvas.annotations.multiplyZones.push({ x1: pending.x1, y1: pending.y1, x2: pending.x2, y2: pending.y2, multiplier: mult, id: uid() });
        }
        state.tool = TOOL.NONE;
        markProjectDirty();
      }
      updateUI();
      renderPdf();
    }, 0);
  };
  document.getElementById('clearPageCancel').onclick = () => hideModal('clearPageConfirmModal');
  document.getElementById('deletePageCancel').onclick = () => { hideModal('deletePageConfirmModal'); state.pendingDeletePage = null; };
  document.getElementById('deletePageConfirm').onclick = () => {
    hideModal('deletePageConfirmModal');
    const pending = state.pendingDeletePage;
    state.pendingDeletePage = null;
    if (pending?.onDelete) pending.onDelete();
  };
  document.getElementById('counterLineTypeDetailsClose').onclick = () => { counterLineTypeDetailsItem = null; hideModal('counterLineTypeDetailsModal'); };
  document.getElementById('linePropertiesClose').onclick = () => closeLinePropertiesModal();
  document.getElementById('deleteCounterLineTypeCancel').onclick = () => { hideModal('deleteCounterLineTypeConfirmModal'); pendingDeleteCounterLineType = null; };
  document.getElementById('deleteCounterLineTypeConfirm').onclick = () => {
    hideModal('deleteCounterLineTypeConfirmModal');
    const pending = pendingDeleteCounterLineType;
    pendingDeleteCounterLineType = null;
    if (pending) {
      performDeleteCounterLineType(pending.kind, pending.item);
      hideModal('counterLineTypeDetailsModal');
    }
  };
  document.getElementById('clearPageConfirm').onclick = () => {
    hideModal('clearPageConfirmModal');
    pushUndoSnapshot();
    const page = state.pages[state.currentPage];
    const canvas = page && getActiveCanvas(page);
    if (canvas) canvas.annotations = makeAnnotations();
    if (state.selectedLinePageIdx === state.currentPage) {
      state.selectedLineId = null;
      state.selectedLineIsPoly = false;
      state.selectedLinePageIdx = null;
    }
    markProjectDirty();
    renderPdf();
    updateUI();
  };

  document.getElementById('hamburger').onclick = () => document.body.classList.toggle('sidebar-open');
  document.getElementById('sidebarBackdrop').onclick = () => document.body.classList.remove('sidebar-open');
  document.getElementById('headerLogo').onclick = () => {
    if (window.matchMedia('(min-width: 769px)').matches) {
      document.body.classList.toggle('sidebar-collapsed');
    }
  };

  // SECTION: User activity time formatting
  // The pure formatters live in format.js (loaded before app.js) and resolve
  // here by bare name: formatLastSignIn, dateKeyInTimeZone,
  // calendarDaysFromSignInToNowInZone, formatLastSignInUserActivity,
  // formatUserActivityDateTime, filterUserActivityRows,
  // renderUserActivityAllUsersTableHtml. The DOM-coupled modal code stays below.

  let userActivitySelectSuppress = false;

  function applyUserActivityFilter() {
    const listEl = document.getElementById('userActivityList');
    const filterInp = document.getElementById('userActivityFilterInput');
    const toolbar = document.getElementById('userActivityToolbar');
    if (!listEl || !toolbar || toolbar.classList.contains('user-activity-toolbar-hidden')) return;
    if (!Array.isArray(state.userActivityAllRowsCache)) return;
    const q = filterInp ? filterInp.value : '';
    const filtered = filterUserActivityRows(state.userActivityAllRowsCache, q);
    if (filtered.length === 0 && state.userActivityAllRowsCache.length > 0) {
      listEl.innerHTML = '<p style="color:var(--text3);">No rows match your filter.</p>';
      return;
    }
    if (filtered.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text3);">No activity recorded.</p>';
      return;
    }
    listEl.innerHTML = renderUserActivityAllUsersTableHtml(filtered);
  }

  function populateUserActivityUserSelect(users, listOk) {
    const sel = document.getElementById('userActivityUserSelect');
    const hint = document.getElementById('userActivityUserListHint');
    if (!sel) return;
    userActivitySelectSuppress = true;
    const esc = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let html = '<option value="">All users (latest)</option>';
    if (listOk && Array.isArray(users) && users.length) {
      const sorted = users.slice().sort((a, b) => String(a.email || '').localeCompare(String(b.email || ''), undefined, { sensitivity: 'base' }));
      sorted.forEach((u) => {
        html += '<option value="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + esc(u.email || '—') + '</option>';
      });
    }
    sel.innerHTML = html;
    sel.value = '';
    userActivitySelectSuppress = false;
    if (hint) {
      if (!listOk) {
        hint.textContent = 'Could not load user list; use Filter to narrow activity.';
        hint.style.display = 'block';
      } else {
        hint.textContent = '';
        hint.style.display = 'none';
      }
    }
  }

  function syncUserActivityViewToggleUI() {
    const ev = document.getElementById('userActivityViewEventsBtn');
    const sum = document.getElementById('userActivityViewSummaryBtn');
    const mode = state.userActivityViewMode;
    if (ev) ev.setAttribute('aria-pressed', mode === 'events' ? 'true' : 'false');
    if (sum) sum.setAttribute('aria-pressed', mode === 'summary' ? 'true' : 'false');
  }

  function renderUserActivitySummaryTableHtml(rows) {
    const esc = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const head = '<thead><tr><th>Email</th><th title="Relative labels use US Central (Chicago) calendar days">Last sign-in</th><th>1 day</th><th>7 days</th><th>30 days</th></tr></thead>';
    const body = rows.map((row) => {
      const signIn = esc(formatLastSignInUserActivity(row.last_sign_in_at));
      const e1 = row.events_1d != null ? String(row.events_1d) : '0';
      const e7 = row.events_7d != null ? String(row.events_7d) : '0';
      const e30 = row.events_30d != null ? String(row.events_30d) : '0';
      return '<tr><td>' + esc(row.email) + '</td><td>' + signIn + '</td><td>' + esc(e1) + '</td><td>' + esc(e7) + '</td><td>' + esc(e30) + '</td></tr>';
    }).join('');
    return '<table class="user-activity-table user-activity-summary-table">' + head + '<tbody>' + body + '</tbody></table>';
  }

  function loadUserActivityAllUsersContent() {
    const session = state.supabaseSession;
    if (!session?.access_token) return;
    const listEl = document.getElementById('userActivityList');
    const toolbar = document.getElementById('userActivityToolbar');
    const filterInp = document.getElementById('userActivityFilterInput');
    const subEl = document.getElementById('userActivityModalSubtitle');
    const headers = { 'Authorization': 'Bearer ' + session.access_token, 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (subEl) {
      subEl.textContent = state.userActivityViewMode === 'summary'
        ? 'Per-user event counts (rolling windows) and last sign-in. Days are in CST not UTC.'
        : 'Latest events across all users (newest first). Event times are US Central (Chicago).';
    }
    if (state.userActivityViewMode === 'summary') {
      state.userActivityAllRowsCache = null;
      if (toolbar) toolbar.classList.add('user-activity-toolbar-hidden');
      if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
      fetch(SUPABASE_URL + '/rest/v1/rpc/list_user_activity_summary_for_admin', {
        method: 'POST',
        headers: headers,
        body: '{}'
      }).then(async (res) => {
        let data;
        try { data = await res.json(); } catch (_) { data = []; }
        if (!res.ok) {
          const msg = (data && (data.message || data.error || data.hint)) ? String(data.message || data.error || data.hint) : ('HTTP ' + res.status);
          if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + msg.replace(/</g, '&lt;') + '</p>';
          return;
        }
        const rows = Array.isArray(data) ? data : [];
        if (rows.length === 0) {
          if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">No users.</p>';
          return;
        }
        if (listEl) listEl.innerHTML = renderUserActivitySummaryTableHtml(rows);
      }).catch((e) => {
        if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + ((e && e.message) || 'Network error').replace(/</g, '&lt;') + '</p>';
      });
      return;
    }
    if (toolbar) toolbar.classList.remove('user-activity-toolbar-hidden');
    if (filterInp) filterInp.value = '';
    if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
    const payload = { p_limit: 500, p_user_id: null, p_since: null };
    const actFetch = fetch(SUPABASE_URL + '/rest/v1/rpc/list_user_activity_for_admin', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    const usrFetch = fetch(SUPABASE_URL + '/rest/v1/rpc/list_users_for_admin', {
      method: 'POST',
      headers: headers,
      body: '{}'
    });
    Promise.all([actFetch, usrFetch]).then(async ([actRes, usrRes]) => {
      let actData;
      let usrData;
      try { actData = await actRes.json(); } catch (_) { actData = []; }
      try { usrData = await usrRes.json(); } catch (_) { usrData = []; }
      const usersOk = usrRes.ok && Array.isArray(usrData);
      populateUserActivityUserSelect(usersOk ? usrData : [], usersOk);
      if (!actRes.ok) {
        state.userActivityAllRowsCache = null;
        const msg = (actData && (actData.message || actData.error || actData.hint)) ? String(actData.message || actData.error || actData.hint) : ('HTTP ' + actRes.status);
        if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + msg.replace(/</g, '&lt;') + '</p>';
        if (toolbar) toolbar.classList.add('user-activity-toolbar-hidden');
        return;
      }
      const data = Array.isArray(actData) ? actData : [];
      state.userActivityAllRowsCache = data;
      if (data.length === 0) {
        if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">No activity recorded.</p>';
        return;
      }
      if (listEl) listEl.innerHTML = renderUserActivityAllUsersTableHtml(filterUserActivityRows(data, filterInp ? filterInp.value : ''));
    }).catch((e) => {
      state.userActivityAllRowsCache = null;
      if (toolbar) toolbar.classList.add('user-activity-toolbar-hidden');
      if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + ((e && e.message) || 'Network error').replace(/</g, '&lt;') + '</p>';
    });
  }

  // SECTION: User Activity modal (admin)
  function openUserActivityModal(userId, email) {
    const session = state.supabaseSession;
    if (!session?.access_token || !state.isAdmin) return;
    const allUsers = userId == null;
    const titleEl = document.getElementById('userActivityModalTitle');
    const listEl = document.getElementById('userActivityList');
    const subEl = document.getElementById('userActivityModalSubtitle');
    const toolbar = document.getElementById('userActivityToolbar');
    const filterInp = document.getElementById('userActivityFilterInput');
    const viewToggle = document.getElementById('userActivityModalViewToggle');
    if (titleEl) titleEl.textContent = allUsers ? 'All user activity' : 'User activity';
    if (subEl) {
      if (allUsers) subEl.textContent = 'Latest events across all users (newest first).';
      else subEl.textContent = (email ? ('Activity for ' + email) : String(userId)) + ' Event times are US Central (Chicago).';
    }
    if (!allUsers) {
      state.userActivityAllRowsCache = null;
      if (toolbar) toolbar.classList.add('user-activity-toolbar-hidden');
      if (viewToggle) viewToggle.classList.add('user-activity-view-toggle-hidden');
    } else {
      state.userActivityViewMode = 'events';
      if (viewToggle) viewToggle.classList.remove('user-activity-view-toggle-hidden');
      syncUserActivityViewToggleUI();
      if (filterInp) filterInp.value = '';
    }
    if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
    showModal('userActivityModal');
    const headers = { 'Authorization': 'Bearer ' + session.access_token, 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (!allUsers) {
      const payload = { p_limit: 200, p_user_id: userId, p_since: null };
      fetch(SUPABASE_URL + '/rest/v1/rpc/list_user_activity_for_admin', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      }).then(async (res) => {
        let data;
        try { data = await res.json(); } catch (_) { data = []; }
        if (!res.ok) {
          const msg = (data && (data.message || data.error || data.hint)) ? String(data.message || data.error || data.hint) : ('HTTP ' + res.status);
          if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + msg.replace(/</g, '&lt;') + '</p>';
          return;
        }
        if (!Array.isArray(data) || data.length === 0) {
          if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">No activity recorded.</p>';
          return;
        }
        const esc = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        if (listEl) {
          listEl.innerHTML = data.map((row) => {
            const when = row.created_at ? formatUserActivityDateTime(row.created_at) : '—';
            let meta;
            try { meta = row.metadata && typeof row.metadata === 'object' ? JSON.stringify(row.metadata) : String(row.metadata || ''); } catch (_) { meta = ''; }
            return '<div class="settings-user-row" style="flex-wrap:wrap;align-items:flex-start;">' +
              '<span style="min-width:120px;font-weight:600;">' + esc(row.event_type) + '</span>' +
              '<span style="color:var(--text3);min-width:150px;">' + esc(when) + '</span>' +
              '<span style="color:var(--text2);flex:1;word-break:break-all;">' + esc(meta) + '</span>' +
              '</div>';
          }).join('');
        }
      }).catch((e) => {
        if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + ((e && e.message) || 'Network error').replace(/</g, '&lt;') + '</p>';
      });
      return;
    }
    loadUserActivityAllUsersContent();
  }

  // SECTION: My Settings modal
  function openMySettings() {
    const user = state.supabaseSession?.user;
    if (!user) { document.getElementById('authBtn').click(); return; }
    document.getElementById('mySettingsEmail').textContent = user.email || '—';
    document.getElementById('mySettingsNewPassword').value = '';
    document.getElementById('mySettingsConfirmPassword').value = '';
    document.getElementById('mySettingsPasswordError').style.display = 'none';
    document.getElementById('mySettingsPasswordSuccess').style.display = 'none';
    document.getElementById('mySettingsManageUsersSection').style.display = state.isAdmin ? 'block' : 'none';
    showModal('mySettingsModal');
  }

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
        openMySettings();
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
    document.getElementById('sidebarLogoUser').onclick = () => { document.body.classList.remove('sidebar-open'); openMySettings(); };
    document.getElementById('sidebarLogoShare').onclick = () => { document.body.classList.remove('sidebar-open'); hideModal('settingsModal'); openShareProjectModal(); };
    const headerShareBtnEl = document.getElementById('headerShareBtn');
    if (headerShareBtnEl) headerShareBtnEl.onclick = () => copyOrCreateViewLinkToClipboard(headerShareBtnEl);
    document.getElementById('sidebarLogoGear').onclick = () => {
      const titleEl = document.getElementById('settingsTitle');
      if (titleEl) titleEl.textContent = state.pages.length || state.currentProjectId ? ('Project Settings - ' + (state.currentProjectName || 'Untitled')) : 'Project Settings';
      document.body.classList.remove('sidebar-open');
      updateSettingsCheckoutSection();
      showModal('settingsModal');
    };
    document.getElementById('statusBarAuth').onclick = () => openMySettings();
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
    let checkoutExpiredRecoveryInFlight = false;
    function computeCheckoutExpiryAgeMs() {
      const candidates = [];
      if (state.checkedOutAt) {
        const t = new Date(state.checkedOutAt).getTime();
        if (Number.isFinite(t) && t > 0) candidates.push(t + CHECKOUT_INACTIVITY_MS);
      }
      try {
        for (let i = saveStatusLog.length - 1; i >= 0; i--) {
          const ev = saveStatusLog[i];
          if (ev && (ev.kind === 'checkout_expired' || ev.kind === 'keepalive_expired')) {
            candidates.push(ev.ts);
            break;
          }
        }
      } catch (_) {}
      if (lastSuccessfulSupabaseCallAt > 0) candidates.push(lastSuccessfulSupabaseCallAt + CHECKOUT_INACTIVITY_MS);
      if (!candidates.length) return 0;
      const expiredAt = Math.min(...candidates);
      const age = Date.now() - expiredAt;
      return age > 0 ? age : 0;
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
        const ageMs = computeCheckoutExpiryAgeMs();
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
    async function reCheckOutAfterExpiry(trigger, opts) {
      opts = opts || {};
      const silent = !!opts.silent;
      if (!state.currentProjectId || !supabase) return { ok: false, error: 'No project' };
      if (checkoutExpiredRecoveryInFlight) return { ok: false, error: 'Re-check out already in progress' };
      checkoutExpiredRecoveryInFlight = true;
      const tStart = Date.now();
      const ageMsAtStart = computeCheckoutExpiryAgeMs();
      try {
        let data = null, error = null;
        try {
          const r = await withTimeout(
            supabase.rpc('check_out_project', { p_project_id: state.currentProjectId }),
            CHECK_IN_TIMEOUT_MS,
            'Re-check out'
          );
          data = r.data;
          error = r.error;
        } catch (e) {
          error = e;
        }
        updateServerClockFromRpc(data);
        const result = data || (error ? { ok: false, error: error.message } : { ok: false });
        if (result.ok) {
          const wasDirty = autoSaveDirty;
          clearCheckoutExpiredAttention();
          state.checkedOutBy = state.supabaseSession?.user?.id;
          state.checkedOutAt = result.checked_out_at || new Date().toISOString();
          lastCheckoutRefreshAt = Date.now();
          state.isViewer = false;
          state.canCheckOut = false;
          pushSaveEvent('checkout_recovered', 'Re-checked out after expiry', JSON.stringify({
            trigger: trigger || 'unknown',
            msSinceExpiry: ageMsAtStart,
            elapsedMs: Date.now() - tStart,
            dirty: wasDirty
          }));
          saveDebugLog('checkoutRecovery.ok', { trigger, msSinceExpiry: ageMsAtStart, dirty: wasDirty });
          updateSettingsCheckoutSection();
          updateUI();
          updateStatus();
          refreshProjectPermissions().catch(() => {});
          if (!silent) {
            try { if (state.currentProjectId) resetAutoRecheckoutCounter(state.currentProjectId); } catch (_) {}
          }
          if (wasDirty) {
            const recoverySavePromise = performAutoSave('checkout_recovered').catch((e) => ({ ok: false, error: e }));
            inFlightRecoverySavePromise = recoverySavePromise;
            recoverySavePromise.finally(() => { if (inFlightRecoverySavePromise === recoverySavePromise) inFlightRecoverySavePromise = null; });
            try { await recoverySavePromise; } catch (_) {}
            if (!silent) showToast('Re-checked out. Saving your edits...');
          } else {
            if (!silent) showToast('Project checked out. You can now edit.');
          }
          return { ok: true };
        }
        await refreshProjectPermissions().catch(() => {});
        const errMsg = (error && error.message) || result.error || 'Re-check out failed';
        const otherEmail = state.checkedOutEmail || null;
        if (otherEmail && state.checkedOutBy && state.checkedOutBy !== state.supabaseSession?.user?.id) {
          pushSaveEvent('checkout_recover_blocked', 'Cannot re-check out: someone else has it', JSON.stringify({
            trigger: trigger || 'unknown',
            otherEmail,
            elapsedMs: Date.now() - tStart
          }));
          saveDebugLog('checkoutRecovery.blocked', { trigger, otherEmail });
          updateUI();
          return { ok: false, otherEmail, error: errMsg };
        }
        pushSaveEvent('checkout_recover_err', 'Re-check out failed', JSON.stringify({
          trigger: trigger || 'unknown',
          message: errMsg,
          status: error && error.status,
          elapsedMs: Date.now() - tStart
        }));
        saveDebugLog('checkoutRecovery.err', { trigger, message: errMsg });
        updateUI();
        return { ok: false, error: errMsg };
      } finally {
        checkoutExpiredRecoveryInFlight = false;
      }
    }
    function resetAutoRecheckoutCounter(projectId) {
      if (projectId) {
        autoRecheckoutCountByProject.delete(projectId);
        autoRecheckoutCapReachedAt.delete(projectId);
      } else {
        autoRecheckoutCountByProject.clear();
        autoRecheckoutCapReachedAt.clear();
      }
      lastAutoRecheckoutAt = 0;
    }
    async function tryAutoRecheckoutIfAllowed(detectionTrigger) {
      const trigger = detectionTrigger || 'unknown';
      const projectId = state.currentProjectId;
      if (!projectId || !supabase) {
        pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: no project', JSON.stringify({ trigger, reason: 'no_project' }));
        return { skipped: true, reason: 'no_project' };
      }
      if (state.isViewer) {
        pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: viewer', JSON.stringify({ trigger, reason: 'viewer' }));
        return { skipped: true, reason: 'viewer' };
      }
      if (Date.now() - lastAutoRecheckoutAt < AUTO_RECHECKOUT_MIN_GAP_MS) {
        pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: too soon after previous attempt', JSON.stringify({ trigger, reason: 'min_gap', sinceLastMs: Date.now() - lastAutoRecheckoutAt }));
        return { skipped: true, reason: 'min_gap' };
      }
      let count = autoRecheckoutCountByProject.get(projectId) || 0;
      if (count >= AUTO_RECHECKOUT_MAX_PER_PROJECT) {
        const capReachedAt = autoRecheckoutCapReachedAt.get(projectId) || 0;
        if (capReachedAt && Date.now() - capReachedAt > AUTO_RECHECKOUT_COOLDOWN_MS) {
          autoRecheckoutCountByProject.set(projectId, 0);
          autoRecheckoutCapReachedAt.delete(projectId);
          count = 0;
          pushSaveEvent('auto_recheckout_cooldown_reset', 'Per-project auto-recheckout cap reset after cool-down',
            JSON.stringify({ trigger, projectId, cooldownMs: AUTO_RECHECKOUT_COOLDOWN_MS }));
        } else {
          if (!capReachedAt) autoRecheckoutCapReachedAt.set(projectId, Date.now());
          const stamp = capReachedAt || Date.now();
          pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: cap reached',
            JSON.stringify({
              trigger,
              reason: 'cap_reached',
              count,
              cap: AUTO_RECHECKOUT_MAX_PER_PROJECT,
              projectId,
              cooldownRemainingMs: Math.max(0, AUTO_RECHECKOUT_COOLDOWN_MS - (Date.now() - stamp))
            }));
          return { skipped: true, reason: 'cap_reached' };
        }
      }
      const tStart = Date.now();
      pushSaveEvent('auto_recheckout_attempt', 'Attempting silent re-check out', JSON.stringify({ trigger, count, projectId }));
      try {
        await refreshProjectPermissions();
      } catch (_) {}
      const selfId = state.supabaseSession?.user?.id;
      const heldByOther = state.checkedOutBy && selfId && state.checkedOutBy !== selfId;
      if (!state.canCheckOut || heldByOther) {
        pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: not allowed', JSON.stringify({
          trigger,
          reason: 'not_allowed',
          canCheckOut: !!state.canCheckOut,
          heldByOther: !!heldByOther,
          otherEmail: state.checkedOutEmail || null
        }));
        return { skipped: true, reason: 'not_allowed', otherEmail: state.checkedOutEmail || null };
      }
      lastAutoRecheckoutAt = Date.now();
      const result = await reCheckOutAfterExpiry('auto_' + trigger, { silent: true });
      const elapsedMs = Date.now() - tStart;
      const isTransient = result && !result.ok && typeof isTransientSaveError === 'function' && isTransientSaveError({ message: (result.error || '').toString() });
      if (result && result.ok) {
        autoRecheckoutCountByProject.set(projectId, count + 1);
        pushSaveEvent('auto_recheckout_ok', 'Silent re-check out succeeded', JSON.stringify({
          trigger,
          count: count + 1,
          cap: AUTO_RECHECKOUT_MAX_PER_PROJECT,
          elapsedMs,
          projectId
        }));
        return { ok: true };
      }
      if (!isTransient) autoRecheckoutCountByProject.set(projectId, count + 1);
      pushSaveEvent('auto_recheckout_err', 'Silent re-check out failed', JSON.stringify({
        trigger,
        count: isTransient ? count : count + 1,
        message: (result && result.error) || 'unknown',
        otherEmail: (result && result.otherEmail) || null,
        transient: !!isTransient,
        elapsedMs
      }));
      return { ok: false, error: (result && result.error) || 'Auto re-check out failed', otherEmail: (result && result.otherEmail) || null };
    }
    let backgroundCheckoutExpiredInFlight = false;
    // Assigned (not declared) so the binding installed at IIFE scope above is
    // overwritten with the real implementation. Async function declarations
    // inside this `if (SUPABASE_ENABLED)` block are block-scoped per spec
    // (Annex B.3.3 does not apply to AsyncFunctionDeclaration), so the
    // background callers outside the block would otherwise hit a ReferenceError.
    handleBackgroundCheckoutExpired = async function (trigger) {
      if (backgroundCheckoutExpiredInFlight) {
        try { saveDebugLog('checkoutExpired.skip_inflight', { trigger }); } catch (_) {}
        return { silentlyRecovered: false, reason: 'already_handling' };
      }
      backgroundCheckoutExpiredInFlight = true;
      try {
        pushSaveEvent('checkout_expired', CHECKOUT_EXPIRED_SAVE_STATUS_MSG, JSON.stringify({ trigger }));
        checkoutExpiredNeedsAttention = true;
        suspendAutoSaveUntilCheckout = true;
        updateSaveStatusIndicator();
        const auto = await tryAutoRecheckoutIfAllowed(trigger);
        if (auto && auto.ok) return { silentlyRecovered: true };
        if (!checkoutExpiredToastShown) {
          showToast(CHECKOUT_EXPIRED_TOAST_MSG, 6000);
          checkoutExpiredToastShown = true;
        }
        updateUI();
        return { silentlyRecovered: false, reason: auto && auto.reason };
      } finally {
        backgroundCheckoutExpiredInFlight = false;
      }
    };
    // SECTION: [sync] Turn In
    async function doTurnIn() {
      if (turnInInProgress) {
        saveDebugLog('turnIn.skip', { reason: 'already_in_progress' });
        return { ok: false, error: 'Turn In is already running' };
      }
      if (inFlightRecoverySavePromise) {
        try {
          saveDebugLog('turnIn.awaitRecovery', {});
          pushSaveEvent('turn_in_await_recovery', 'Turn In waiting for recovery save to complete');
          await Promise.race([
            inFlightRecoverySavePromise,
            new Promise(r => setTimeout(r, 8000))
          ]);
        } catch (_) {}
      }
      turnInInProgress = true;
      const tTurnIn = Date.now();
      let currentStage = 'start';
      let stageStartedAt = Date.now();
      let checkInAttempt = 0;
      let usedRawFetchForCheckIn = false;
      const progress = (stage, label) => {
        if (currentStage && currentStage !== 'start') {
          pushSaveEvent('turn_in_phase_done', currentStage + ' done', JSON.stringify({ stage: currentStage, durationMs: Date.now() - stageStartedAt, elapsedMs: Date.now() - tTurnIn }));
        }
        currentStage = stage;
        stageStartedAt = Date.now();
        setTurnInProgress(label);
        pushSaveEvent('turn_in_stage', label, JSON.stringify({ stage, elapsedMs: Date.now() - tTurnIn }));
      };
      const errDetail = (e) => {
        try {
          return JSON.stringify(Object.assign(serializeSaveError(e) || {}, {
            elapsedMs: Date.now() - tTurnIn,
            stage: currentStage,
            attempt: checkInAttempt,
            online: (typeof navigator !== 'undefined') ? navigator.onLine : null,
            network: captureNetworkInfoDetail() || null
          }));
        } catch (_) { return formatSaveStatusErrDetail(e); }
      };
      try {
        if (!state.currentProjectId || !supabase) return { ok: false, error: 'No project' };
        pushSaveEvent('turn_in_start', 'Turn In started', JSON.stringify({
          onLine: (typeof navigator !== 'undefined') ? navigator.onLine : null,
          network: captureNetworkInfoDetail() || null,
          lastOk: lastSuccessfulSupabaseCallAt,
          failures: consecutiveAutoSaveFailures,
          dirty: autoSaveDirty,
          saveInProgress,
          projectId: state.currentProjectId
        }));
        const isSbJsRecentlyBad = () => lastSupabaseJsFailureAt > 0 && Date.now() - lastSupabaseJsFailureAt < 5 * 60 * 1000;
        const looksStale = consecutiveAutoSaveFailures > 0 ||
          (lastSuccessfulSupabaseCallAt > 0 && Date.now() - lastSuccessfulSupabaseCallAt > TURN_IN_STALENESS_MS) ||
          lastSuccessfulSupabaseCallAt === 0 ||
          isSbJsRecentlyBad();
        if (looksStale) {
          progress('pre_probe', 'Checking connection…');
          saveDebugLog('turnIn.preProbe', { failures: consecutiveAutoSaveFailures, lastOk: lastSuccessfulSupabaseCallAt });
          const probe = await runRecoveryProbe('turn_in_pre').catch(() => null);
          if (probe && !probe.ok && probe.errMsg !== 'in_flight') {
            pushSaveEvent('turn_in_pre_probe_failed', 'Connection seems offline; Turn In aborted (saved locally)', JSON.stringify({ ms: probe.ms, status: probe.status, message: probe.errMsg, elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
            return { ok: false, error: 'Connection offline. Saved locally; try Turn In again in a moment.' };
          }
        }
        progress('local_backup', 'Saving local backup…');
        await writeTakeoffStateBackup();
        const hadAutoSave = autoSaveDirty;
        // If this project has a local PDF that never reached cloud storage,
        // upload it as part of Turn In so the PDF doesn't get left behind.
        const needsPdfUpload = state.pages.length > 0 && !state.pdfStoragePath && !state.isViewer;
        if (needsPdfUpload) {
          if (saveInProgress) {
            saveDebugLog('turnIn.skip', { reason: 'save_in_progress' });
            pushSaveEvent('turn_in_save_in_progress', 'Turn In skipped: sync still in progress', JSON.stringify({ elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
            return { ok: false, error: 'Sync in progress, try again in a moment' };
          }
          progress('sync_to_cloud', 'Uploading PDF to cloud…');
          // Show determinate upload progress in the Turn In banner (resumable
          // path emits byte progress; the standard path stays on the plain label).
          onPdfUploadProgress = (sent, total) => {
            const pct = (total > 0) ? Math.min(100, Math.floor((sent / total) * 100)) : 0;
            setTurnInProgress('Uploading PDF to cloud\u2026 ' + pct + '%');
          };
          let pdfResult;
          try {
            pdfResult = await uploadLocalPdfToCloudIfNeeded('turn_in', { ignoreBackoff: true });
          } finally {
            onPdfUploadProgress = null;
          }
          if (pdfResult && pdfResult.skipped) {
            // No usable PDF buffer in memory or cache (detached + unrecoverable),
            // or some other skip. Don't strand the user: fall back to a
            // canvas-only save when dirty, warn, and continue releasing the lock.
            if (autoSaveDirty) {
              const saveResult = await performAutoSave();
              if (!saveResult.ok) {
                pushSaveEvent(
                  'turn_in_blocked_by_save_err',
                  'Turn In blocked: autosave failed before check-in',
                  JSON.stringify({ message: (saveResult.error && saveResult.error.message) || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage })
                );
                if (isAuthError(saveResult.error)) return { ok: false, error: 'Refresh the page to sync.' };
                if (saveResult.error?.code === 'CHECKOUT_EXPIRED') return { ok: false, code: 'CHECKOUT_EXPIRED', error: CHECKOUT_EXPIRED_SAVE_STATUS_MSG };
                return { ok: false, error: (saveResult.error && saveResult.error.message) || 'Save failed' };
              }
            }
            if (pdfResult.reason === 'no_usable_buffer') {
              showToast('PDF couldn\u2019t be uploaded \u2014 reopen the project to attach it.', 4000);
            }
          } else if (pdfResult && !pdfResult.ok) {
            pushSaveEvent(
              'turn_in_blocked_by_save_err',
              'Turn In blocked: PDF upload failed before check-in',
              JSON.stringify({ message: (pdfResult.error && pdfResult.error.message) || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage })
            );
            if (isAuthError(pdfResult.error)) return { ok: false, error: 'Refresh the page to sync.' };
            if (pdfResult.error?.code === 'CHECKOUT_EXPIRED') return { ok: false, code: 'CHECKOUT_EXPIRED', error: CHECKOUT_EXPIRED_SAVE_STATUS_MSG };
            return { ok: false, error: (pdfResult.error && pdfResult.error.message) || 'Save failed' };
          }
        } else if (autoSaveDirty) {
          if (saveInProgress) {
            saveDebugLog('turnIn.skip', { reason: 'save_in_progress' });
            pushSaveEvent('turn_in_save_in_progress', 'Turn In skipped: sync still in progress', JSON.stringify({ elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
            return { ok: false, error: 'Sync in progress, try again in a moment' };
          }
          progress('sync_to_cloud', 'Syncing edits to cloud…');
          const saveResult = await performAutoSave();
          if (!saveResult.ok) {
            pushSaveEvent(
              'turn_in_blocked_by_save_err',
              'Turn In blocked: autosave failed before check-in',
              JSON.stringify({ message: (saveResult.error && saveResult.error.message) || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage })
            );
            if (isAuthError(saveResult.error)) return { ok: false, error: 'Refresh the page to sync.' };
            if (saveResult.error?.code === 'CHECKOUT_EXPIRED') return { ok: false, code: 'CHECKOUT_EXPIRED', error: CHECKOUT_EXPIRED_SAVE_STATUS_MSG };
            return { ok: false, error: (saveResult.error && saveResult.error.message) || 'Save failed' };
          }
        }
        if (inFlightAutoSavePromise && saveInProgress) {
          const tAwait = Date.now();
          pushSaveEvent('turn_in_await_inflight_autosave', 'Turn In waiting briefly for in-flight autosave', JSON.stringify({ elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
          try {
            await Promise.race([
              inFlightAutoSavePromise,
              new Promise(r => setTimeout(r, 3000))
            ]);
          } catch (_) {}
          pushSaveEvent('turn_in_await_inflight_autosave_done', 'Done waiting for in-flight autosave', JSON.stringify({ waitMs: Date.now() - tAwait, saveStillInProgress: saveInProgress }));
        }
        progress('release_lock', 'Releasing edit lock…');
        let result;
        while (true) {
          try {
            const tCheckIn = Date.now();
            const sbJsBadNow = isSbJsRecentlyBad();
            const useRawForCheckIn = consecutiveAutoSaveFailures >= 3 ||
              (checkInAttempt > 0 && !usedRawFetchForCheckIn) ||
              sbJsBadNow;
            if (useRawForCheckIn && checkInAttempt === 0 && sbJsBadNow && consecutiveAutoSaveFailures < 3) {
              pushSaveEvent('turn_in_raw_fetch_engaged_proactively', 'Turn In using raw fetch (supabase-js wedged recently)', JSON.stringify({ msSinceSbJsFailure: Date.now() - lastSupabaseJsFailureAt, lastOk: lastSuccessfulSupabaseCallAt, failures: consecutiveAutoSaveFailures }));
            }
            usedRawFetchForCheckIn = useRawForCheckIn;
            let data = null, error = null;
            if (useRawForCheckIn) {
              try {
                const r = await withTimeout((signal) => rawCheckInProject(state.currentProjectId, signal), CHECK_IN_TIMEOUT_MS, 'Turn in');
                data = r.data || null;
                error = r.error || null;
                if (!error) pushSaveEvent('turn_in_via_raw_fetch_ok', 'Raw-fetch check-in succeeded', JSON.stringify({ ms: Date.now() - tCheckIn, attempt: checkInAttempt }));
                else pushSaveEvent('turn_in_via_raw_fetch_err', 'Raw-fetch check-in failed', JSON.stringify({ ms: Date.now() - tCheckIn, attempt: checkInAttempt, message: error?.message, status: error?.status, diag: error?.diag }));
              } catch (rawErr) {
                error = rawErr;
                pushSaveEvent('turn_in_via_raw_fetch_err', 'Raw-fetch check-in threw', JSON.stringify({ ms: Date.now() - tCheckIn, attempt: checkInAttempt, message: rawErr?.message, status: rawErr?.status, diag: rawErr?.diag }));
              }
            } else {
              const r = await withTimeout(
                supabase.rpc('check_in_project', { p_project_id: state.currentProjectId }),
                CHECK_IN_TIMEOUT_MS,
                'Turn in'
              );
              data = r.data;
              error = r.error;
            }
            updateServerClockFromRpc(data);
            perfLog('doTurnIn check_in_project', Date.now() - tCheckIn, { projectId: state.currentProjectId, attempt: checkInAttempt, raw: useRawForCheckIn });
            result = data || (error ? { ok: false, error: error.message } : { ok: false });
            const releaseMsg = (result?.error || '').toString();
            const releaseCode = error?.code || '';
            const alreadyReleased =
              releaseCode === 'CHECKOUT_EXPIRED' ||
              releaseCode === 'CHECKOUT_NOT_OWNED' ||
              /CHECKOUT_EXPIRED|NOT_OWNED|not.checked.out|do not have .* checked out|expired/i.test(releaseMsg);
            if (alreadyReleased) {
              pushSaveEvent('turn_in_already_released', 'Server had already released the lock; treating as Turn In success', JSON.stringify({ message: releaseMsg || releaseCode, elapsedMs: Date.now() - tTurnIn, stage: currentStage, attempt: checkInAttempt }));
              return { ok: true, releasedByServer: true };
            }
            if (error && checkInAttempt === 0 && isTransientSaveError(error)) {
              saveDebugLog('turnIn.retry', { message: error?.message });
              pushSaveEvent('turn_in_retry', 'Transient turn-in error, retrying once', JSON.stringify({ message: error?.message || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
              checkInAttempt++;
              progress('retry', 'Retrying…');
              await new Promise(r => setTimeout(r, 500));
              continue;
            }
            break;
          } catch (e) {
            const isTimedOutMsg = /timed?\s*out/i.test(e?.message || '');
            if (checkInAttempt === 0 && (isTransientSaveError(e) || isTimedOutMsg)) {
              saveDebugLog('turnIn.retry', { message: e?.message });
              pushSaveEvent('turn_in_retry', 'Transient turn-in error, retrying once', JSON.stringify({ message: e?.message || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage, viaTimedOutCatch: isTimedOutMsg && !isTransientSaveError(e) }));
              checkInAttempt++;
              progress('retry', 'Retrying…');
              await new Promise(r => setTimeout(r, 500));
              continue;
            }
            perfLog('doTurnIn total', Date.now() - tTurnIn, { hadAutoSave });
            pushSaveEvent('turn_in_err', (e && e.message) || 'Failed to turn in', errDetail(e));
            return { ok: false, error: (e && e.message) || 'Failed to turn in' };
          }
        }
        perfLog('doTurnIn total', Date.now() - tTurnIn, { hadAutoSave });
        if (currentStage && currentStage !== 'start') {
          pushSaveEvent('turn_in_phase_done', currentStage + ' done', JSON.stringify({ stage: currentStage, durationMs: Date.now() - stageStartedAt, elapsedMs: Date.now() - tTurnIn }));
        }
        if (result.ok) {
          pushSaveEvent('turn_in_ok', 'Project turned in (checkout released)', JSON.stringify({ elapsedMs: Date.now() - tTurnIn, attempts: checkInAttempt + 1, usedRawFetchForCheckIn }));
          return { ok: true };
        }
        pushSaveEvent('turn_in_err', (result.error || 'Failed to turn in').toString(), JSON.stringify({ elapsedMs: Date.now() - tTurnIn, stage: currentStage, attempt: checkInAttempt, usedRawFetchForCheckIn, online: (typeof navigator !== 'undefined') ? navigator.onLine : null, network: captureNetworkInfoDetail() || null }));
        return { ok: false, error: result.error || 'Failed to turn in' };
      } finally {
        setTurnInProgress(null);
        turnInInProgress = false;
      }
    }
    async function doTurnInAndHandleResult(opts) {
      opts = opts || {};
      if (checkoutExpiredNeedsAttention && state.currentProjectId && !state.isViewer) {
        pushSaveEvent('turn_in_short_circuit_expired', 'Turn In short-circuited to recovery modal');
        if (opts.hideSettings) { try { hideModal('settingsModal'); } catch (_) {} }
        openCheckoutExpiredRecoveryModal({ trigger: 'turn_in_short_circuit' });
        return { ok: false, code: 'CHECKOUT_EXPIRED', error: CHECKOUT_EXPIRED_SAVE_STATUS_MSG };
      }
      const result = await doTurnIn();
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
      pendingAddAdditionalPages = true;
      document.getElementById('pdfInput').click();
    };
    document.getElementById('settingsDownloadPdf').onclick = async () => { hideModal('settingsModal'); await downloadProjectPdf(); };
    document.getElementById('settingsAdvancedBtn').onclick = () => showModal('settingsAdvancedModal');
    document.getElementById('settingsAdvancedModalClose').onclick = () => hideModal('settingsAdvancedModal');
    document.getElementById('settingsAdvancedModal').onclick = (e) => { if (e.target.id === 'settingsAdvancedModal') hideModal('settingsAdvancedModal'); };
    document.querySelector('#settingsAdvancedModal .modal-card').onclick = (e) => e.stopPropagation();
    document.getElementById('advancedLoadTestPdf').onclick = async () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); await loadTestPdf(); };
    document.getElementById('advancedManageIcons').onclick = () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); App.openManageIconsModal(); };
    document.getElementById('advancedExport').onclick = () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); document.getElementById('exportBtn').click(); };
    document.getElementById('advancedExportPdf').onclick = async () => { hideModal('settingsAdvancedModal'); hideModal('settingsModal'); await downloadProjectPdf(); };
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
    // SECTION: Share project & view links
    async function openShareProjectModal() {
      if (!state.currentProjectId || !supabase) return;
      const listEl = document.getElementById('shareProjectList');
      const errEl = document.getElementById('shareProjectError');
      const userSelect = document.getElementById('shareProjectUserSelect');
      errEl.style.display = 'none';
      listEl.innerHTML = '<p style="color:var(--text3);font-size:0.9rem;">Loading...</p>';
      userSelect.innerHTML = '<option value="">Select a user...</option>';
      userSelect.value = '';
      showModal('shareProjectModal');
      const shareViewLinksSection = document.getElementById('shareViewLinksSection');
      if (shareViewLinksSection) shareViewLinksSection.style.display = state.loadedViaViewLink ? 'none' : '';
      const shareViewLinkCreate = document.getElementById('shareViewLinkCreate');
      if (shareViewLinkCreate) shareViewLinkCreate.style.display = state.loadedViaViewLink ? 'none' : '';
      let usersResult, sharesResult;
      try {
        [usersResult, sharesResult] = await Promise.all([
          supabase.rpc('list_users_for_project_invite', { p_project_id: state.currentProjectId }),
          supabase.rpc('list_project_shares', { p_project_id: state.currentProjectId })
        ]);
      } catch (e) {
        listEl.innerHTML = '';
        errEl.textContent = 'Failed to load: ' + (e.message || 'Network error');
        errEl.style.display = 'block';
        return;
      }
      const { data: users, error: usersErr } = usersResult;
      const { data: shares, error } = sharesResult;
      if (!usersErr && users && users.length > 0) {
        users.forEach(function(u) {
          const opt = document.createElement('option');
          opt.value = (u.email || '').toLowerCase();
          opt.textContent = u.email || u.id;
          userSelect.appendChild(opt);
        });
      }
      listEl.innerHTML = '';
      if (error) {
        errEl.textContent = 'Failed to load shares: ' + (error.message || 'Unknown error');
        errEl.style.display = 'block';
      } else if (shares && shares.length > 0) {
        const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const trashSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 640 640"><path fill="currentColor" d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/></svg>';
        shares.forEach(function(s) {
          const div = document.createElement('div');
          div.className = 'share-project-row' + (s.role === 'owner' ? ' share-project-owner-row' : '');
          div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);';
          if (s.role === 'owner') {
            div.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;"><span style="flex-shrink:0;color:var(--text2);">Owner: ' + esc(s.email || s.user_id) + '</span></div>';
          } else {
            div.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;"><span style="flex-shrink:0;">' + esc(s.email || s.user_id) + '</span><select class="share-project-role-select" style="padding:4px 8px;font-size:0.85rem;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--text);" data-user-id="' + s.user_id + '"><option value="viewer"' + (s.role === 'viewer' ? ' selected' : '') + '>Viewer</option><option value="editor"' + (s.role === 'editor' ? ' selected' : '') + '>Editor</option></select></div><button type="button" class="danger share-project-remove-btn" style="padding:6px;border-radius:4px;cursor:pointer;border:none;background:transparent;color:var(--red);" aria-label="Remove" data-user-id="' + s.user_id + '">' + trashSvg + '</button>';
            div.querySelector('.share-project-remove-btn').onclick = async () => {
              const { data: res } = await supabase.rpc('remove_project_share', { p_project_id: state.currentProjectId, p_target_user_id: s.user_id });
              if (res && res.ok) openShareProjectModal();
              else showToast((res && res.error) || 'Failed to remove');
            };
            div.querySelector('.share-project-role-select').onchange = async function() {
              const newRole = this.value;
              const { data: res } = await supabase.rpc('add_project_share', { p_project_id: state.currentProjectId, p_target_user_id: s.user_id, p_role: newRole });
              if (res && res.ok) openShareProjectModal();
              else showToast((res && res.error) || 'Failed to update role');
            };
          }
          listEl.appendChild(div);
        });
      } else {
        listEl.innerHTML = '<p style="color:var(--text3);font-size:0.9rem;">No one else has access yet.</p>';
      }
      const viewLinksListEl = document.getElementById('shareViewLinksList');
      if (viewLinksListEl) {
        viewLinksListEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">Loading...</p>';
        try {
          const { data: links, error: linksErr } = await supabase.rpc('list_view_links', { p_project_id: state.currentProjectId });
          viewLinksListEl.innerHTML = '';
          if (linksErr || !links || links.length === 0) {
            viewLinksListEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">No view links yet.</p>';
          } else {
            const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const base = window.location.origin + (window.location.pathname || '/');
            const baseUrl = base + (base.includes('?') ? '&' : '?') + 't=';
            links.forEach(function(l) {
              const div = document.createElement('div');
              div.className = 'share-view-link-row';
              div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;';
              const name = esc(l.name || 'View link');
              const date = l.created_at ? new Date(l.created_at).toLocaleString() : '';
              div.innerHTML = '<div style="flex:1;min-width:0;"><span style="font-weight:500;">' + name + '</span><div style="font-size:0.8rem;color:var(--text2);">' + date + '</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="settings-menu-btn share-view-link-copy" style="padding:4px 8px;font-size:0.85rem;" data-token="' + l.token + '" data-url="' + esc(baseUrl + l.token) + '">Copy URL</button><button type="button" class="settings-menu-btn share-view-link-log" style="padding:4px 8px;font-size:0.85rem;" data-id="' + l.id + '">Access log</button><button type="button" class="danger share-view-link-revoke" style="padding:4px 8px;font-size:0.85rem;border:none;cursor:pointer;" data-token="' + l.token + '">Revoke</button></div>';
              div.querySelector('.share-view-link-copy').onclick = function() {
                const url = this.dataset.url;
                navigator.clipboard.writeText(url).then(() => showToast('Copied to clipboard')).catch(() => showToast('Failed to copy'));
              };
              div.querySelector('.share-view-link-log').onclick = async function() {
                const id = this.dataset.id;
                const { data: log } = await supabase.rpc('get_view_link_access_log', { p_view_link_id: id });
                const lines = (log || []).map(function(r) { return (r.email || '') + ' — ' + (r.accessed_at ? new Date(r.accessed_at).toLocaleString() : ''); });
                alert('Access log:\n\n' + (lines.length ? lines.join('\n') : 'No access yet'));
              };
              div.querySelector('.share-view-link-revoke').onclick = async function() {
                const tok = this.dataset.token;
                if (!confirm('Revoke this view link? It will stop working immediately.')) return;
                const { data: res } = await supabase.rpc('revoke_view_link', { p_token: tok });
                if (res && res.ok) { exportViewLinkUrl = null; exportViewLinkProjectId = null; openShareProjectModal(); }
                else showToast((res && res.error) || 'Failed to revoke');
              };
              viewLinksListEl.appendChild(div);
            });
          }
        } catch (e) {
          viewLinksListEl.innerHTML = '<p style="color:var(--red);font-size:0.85rem;">Failed to load: ' + (e.message || 'Error') + '</p>';
        }
      }
    }
    (function() {
      const header = document.getElementById('shareViewLinksHeader');
      const content = document.getElementById('shareViewLinksContent');
      const icon = document.getElementById('shareViewLinksCollapseIcon');
      if (header && content && icon) {
        header.onclick = () => {
          const collapsed = content.classList.toggle('collapsed');
          icon.textContent = collapsed ? '▶' : '▼';
        };
      }
    })();
    document.getElementById('shareViewLinkCreate').onclick = async () => {
      if (!state.currentProjectId || !supabase) return;
      const btn = document.getElementById('shareViewLinkCreate');
      btn.disabled = true;
      btn.textContent = 'Creating...';
      try {
        const { data, error } = await supabase.rpc('create_view_link', { p_project_id: state.currentProjectId, p_name: null, p_expires_at: null });
        if (error) throw new Error(error.message);
        if (data && data.ok && data.token) {
          const base = window.location.origin + (window.location.pathname || '/');
          const url = base + (base.includes('?') ? '&' : '?') + 't=' + data.token;
          navigator.clipboard.writeText(url).then(() => {
            showToast('View link created and copied to clipboard');
            openShareProjectModal();
          }).catch(() => {
            showToast('Link created: ' + url);
            openShareProjectModal();
          });
        } else {
          throw new Error((data && data.error) || 'Failed to create');
        }
      } catch (e) {
        showToast(e.message || 'Failed to create view link');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create view link';
      }
    };
    document.getElementById('shareProjectModalClose').onclick = () => hideModal('shareProjectModal');
    document.getElementById('shareProjectAdd').onclick = async () => {
      const userSelect = document.getElementById('shareProjectUserSelect');
      const roleSel = document.getElementById('shareProjectRole');
      const errEl = document.getElementById('shareProjectError');
      const email = (userSelect.value || '').trim().toLowerCase();
      if (!email) {
        errEl.textContent = 'Select a user';
        errEl.style.display = 'block';
        return;
      }
      errEl.style.display = 'none';
      try {
        const res = await fetch((typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/invite-to-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (state.supabaseSession?.access_token || '') },
          body: JSON.stringify({ project_id: state.currentProjectId, email: email, role: roleSel.value || 'viewer' })
        });
        const data = await res.json();
        if (data.ok) {
          userSelect.value = '';
          openShareProjectModal();
          showToast('Added ' + (data.email || email));
        } else {
          errEl.textContent = data.error || 'Failed to add user';
          errEl.style.display = 'block';
        }
      } catch (e) {
        errEl.textContent = e.message || 'Failed to add user';
        errEl.style.display = 'block';
      }
    };
    function openCopyProjectModal(proj) {
      copyProjectModalTarget = proj;
      const inp = document.getElementById('copyProjectNameInput');
      const confirmBtn = document.getElementById('copyProjectModalConfirm');
      if (inp) inp.value = (proj.name || 'Untitled') + ' (copy)';
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Open copy'; }
      showModal('copyProjectModal');
      if (inp) setTimeout(function () { inp.focus(); inp.select && inp.select(); }, 0);
    }
    // eslint-disable-next-line no-unused-vars -- published on App for features/load-project.js
    function openCopyProjectModalOrPromptSave(proj) {
      if (!autoSaveDirty) {
        pendingCopyProject = null;
        openCopyProjectModal(proj);
        return;
      }
      pendingCopyProject = proj;
      const msgEl = document.querySelector('#saveBeforeLoadModal p');
      const cancelBtn = document.getElementById('saveBeforeLoadCancel');
      const discardBtn = document.getElementById('saveBeforeLoadDiscard');
      const saveBtn = document.getElementById('saveBeforeLoadSave');
      if (msgEl) msgEl.textContent = 'You have unsaved changes. Save before copying another project?';
      if (cancelBtn) { cancelBtn.disabled = false; cancelBtn.textContent = 'Cancel'; }
      if (discardBtn) discardBtn.style.display = '';
      if (saveBtn) saveBtn.style.display = '';
      showModal('saveBeforeLoadModal');
    }
    // B1: Centralizes the "post-PDF-load" hydration that turns a cloud project
    // row into local session state. Used by both the Load Project modal row
    // click and the loadAnnotationsModal row click, so checkout/permissions/
    // realtime/subscription stay in lockstep.
    //
    // proj must include: id, name, updated_at, pdf_path, pdf_hash, user_id,
    //   can_edit, can_check_out, checked_out_by, checked_out_at, checked_out_email
    // opts: { reusePdfHash?: string|null, reusePdfStoragePath?: string|null,
    //         source?: 'load_project'|'load_annotations'|'restore_last' }
    // SECTION: Cloud project hydrate / copy / fork
    // eslint-disable-next-line no-unused-vars -- published on App for features/load-project.js
    function hydrateProjectFromCloudRow(proj, opts) {
      opts = opts || {};
      state.pendingCanvasLoad = null;
      state.currentProjectId = proj.id;
      state.currentProjectName = proj.name || 'Untitled';
      state.pdfHash = opts.reusePdfHash !== undefined ? opts.reusePdfHash : (proj.pdf_hash || null);
      if (opts.reusePdfStoragePath !== undefined) state.pdfStoragePath = opts.reusePdfStoragePath;
      lastSaveIncludedPdf = !!proj.pdf_path;
      state.lastSavedAt = proj.updated_at || null;
      lastLocalBackupAt = null;
      state.currentPage = state.pages.length > 0
        ? Math.min(state.currentPage, Math.max(0, state.pages.length - 1))
        : 0;
      autoSaveDirty = false;
      lastModifiedAt = 0;
      state.checkedOutBy = proj.checked_out_by || null;
      state.checkedOutAt = proj.checked_out_at || null;
      state.checkedOutEmail = proj.checked_out_email || null;
      state.loadedViaViewLink = false;
      state.isViewer = !proj.can_edit;
      state.canCheckOut = proj.can_check_out || false;
      try { clearCheckoutExpiredAttention(); } catch (_) {}
      state.projectOwnerId = proj.user_id || null;
      subscribeToProjectCheckoutChanges(proj.id);
      logProjectOpenEvent();
      if (SUPABASE_ENABLED && state.supabaseSession?.user) {
        try {
          localStorage.setItem('clickcount-last-project', JSON.stringify({
            projectId: state.currentProjectId,
            projectName: state.currentProjectName || 'Untitled',
            pdfStoragePath: state.pdfStoragePath || null,
            pdfHash: state.pdfHash || null,
            userId: state.supabaseSession.user.id
          }));
        } catch (_) {}
      }
    }

    async function resolvePdfBufferForCloudProject(proj, useIdbBackup, idbBackup) {
      let buf;
      if (useIdbBackup && idbBackup.pdfBlob) {
        buf = await idbBackup.pdfBlob.arrayBuffer();
      }
      if (buf === undefined || !buf || buf.byteLength === 0) {
        const cachedBlob = proj.pdf_hash ? await pdfCacheGet(proj.id, proj.pdf_hash) : null;
        if (cachedBlob && cachedBlob.size > 0) {
          buf = await cachedBlob.arrayBuffer();
        }
        if (cachedBlob && (!buf || buf.byteLength === 0)) {
          pdfCacheDelete(proj.id);
        }
      }
      if (buf === undefined || !buf || buf.byteLength === 0) {
        const { data: blob, error: dlErr } = await supabase.storage.from('pdfs').download(proj.pdf_path);
        const emptyOrMissing = dlErr || !blob || blob.size === 0;
        if (emptyOrMissing) return null;
        buf = await blob.arrayBuffer();
        if (proj.pdf_hash) pdfCachePut(proj.id, blob, proj.pdf_hash);
      }
      return (buf && buf.byteLength > 0) ? buf : null;
    }
    async function buildPagesFromPdfArrayBufferAndProjectData(buf, d, useIdbBackup, idbBackup) {
      const bufPdf = buf.slice(0);
      const bufStorage = buf.slice(0);
      const pdf = await pdfjsLib.getDocument(bufPdf).promise;
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
        if (d.iconNames && typeof d.iconNames === 'object') state.iconNames = d.iconNames;
        if (Array.isArray(d.iconOrder)) state.iconOrder = d.iconOrder;
        if (Array.isArray(d.customIconPaths)) saveUserCustomIcons(d.customIconPaths);
        (d.pages || []).forEach(function (p) {
          applyPageAnnotationsFromData(state.pages[p.index], p);
        });
        if (d.activeCanvasIdByPage && typeof d.activeCanvasIdByPage === 'object') state.activeCanvasIdByPage = d.activeCanvasIdByPage;
        if (d.pageScales) {
          d.pageScales.forEach(function (scale, i) { if (state.pages[i]) state.pages[i].scale = scale; });
        } else if (d.scale) {
          state.pages.forEach(function (p) { p.scale = d.scale; });
        }
        state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
        if (d.legendSettings) state.legendSettings = { ...state.legendSettings, ...d.legendSettings };
        if (d.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...d.multiplyZoneSettings };
        if (d.showGridOverlay != null) state.showGridOverlay = !!d.showGridOverlay;
        if (d.gridSettings) state.gridSettings = d.gridSettings;
      }
      reconcileOrphanedCountersAndLineTypes();
      clearUndoStacks();
      return bufStorage;
    }
    async function applyLocalForkAfterPdfLoad(forkName, pdfArrayBuffer) {
      state.pdfStoragePath = null;
      state.pendingCanvasLoad = null;
      state.currentProjectId = null;
      state.currentProjectName = forkName || 'Untitled';
      state.pdfBuffer = pdfArrayBuffer;
      state.pdfBufferSize = pdfArrayBuffer.byteLength;
      state.pdfHash = await sha256Hex(pdfArrayBuffer);
      subscribeToProjectCheckoutChanges(null);
      state.checkedOutBy = null;
      state.checkedOutAt = null;
      state.checkedOutEmail = null;
      state.isViewer = false;
      state.canCheckOut = false;
      state.projectOwnerId = null;
      state.loadedViaViewLink = false;
      state.lastSavedAt = null;
      lastSaveIncludedPdf = false;
      lastLocalBackupAt = null;
      autoSaveDirty = false;
      try { clearCheckoutExpiredAttention(); } catch (_) {}
      lastModifiedAt = 0;
      state.currentPage = Math.min(state.currentPage, Math.max(0, state.pages.length - 1));
      try { localStorage.removeItem('clickcount-last-project'); } catch (_) {}
      hideModal('copyProjectModal');
      hideModal('loadProjectModal');
      state.sidebarReorderModeActive = false;
      copyProjectModalTarget = null;
      fitZoom();
      updateUI();
      showToast('Local copy opened. Save to cloud from Project Settings when you are ready.', 5000);
    }
    async function forkCloudProjectToLocalWorkingCopy(proj, forkName) {
      if (!supabase) {
        showToast('Cloud not configured.', 3000);
        return;
      }
      if (state.currentProjectId && state.currentProjectId !== proj.id) await checkInCurrentProjectIfHeld();
      let d = proj.data || {};
      try {
        const { data: full, error } = await supabase.from('projects').select('data').eq('id', proj.id).single();
        if (!error && full && full.data) d = full.data;
      } catch (_) {}
      const projUpdated = proj.updated_at ? new Date(proj.updated_at).getTime() : 0;
      const idbBackup = await takeoffBackupGet(proj.id, state.supabaseSession?.user?.id || null);
      const useIdbBackup = idbBackup && idbBackup.lastModifiedAt > projUpdated;
      if (!proj.pdf_path) {
        showToast('Copy to new requires a PDF in the project.', 4000);
        return;
      }
      try {
        const buf = await resolvePdfBufferForCloudProject(proj, useIdbBackup, idbBackup);
        if (!buf) {
          showToast('Cannot copy: PDF is missing from storage. Open the project and upload a PDF if needed.', 5000);
          return;
        }
        const bufStorage = await buildPagesFromPdfArrayBufferAndProjectData(buf, d, useIdbBackup, idbBackup);
        const nameTrim = (forkName || '').trim() || 'Untitled';
        await applyLocalForkAfterPdfLoad(nameTrim, bufStorage);
      } catch (e) {
        console.error('[Fork project]', e);
        showToast(e.message || 'Failed to copy project.', 5000);
      }
    }
    function openLoadProjectModalOrPromptSave() {
      if (!autoSaveDirty) {
        pendingCopyProject = null;
        App.openLoadProjectModal().catch(e => {
          console.error('[Load Project]', e);
          showToast('Failed to load projects: ' + (e?.message || 'Unknown error'));
        });
        return;
      }
      pendingCopyProject = null;
      const msgEl = document.querySelector('#saveBeforeLoadModal p');
      const cancelBtn = document.getElementById('saveBeforeLoadCancel');
      const discardBtn = document.getElementById('saveBeforeLoadDiscard');
      const saveBtn = document.getElementById('saveBeforeLoadSave');
      if (msgEl) msgEl.textContent = 'You have unsaved changes. Save before loading another project?';
      if (cancelBtn) { cancelBtn.disabled = false; cancelBtn.textContent = 'Cancel'; }
      if (discardBtn) discardBtn.style.display = '';
      if (saveBtn) saveBtn.style.display = '';
      showModal('saveBeforeLoadModal');
    }
    // openLoadProjectModal moved to features/load-project.js (App.openLoadProjectModal);
    // the save-before-load gate + #loadProject* bindings stay in app.js.
    // in-block load-helper publish: these async fns are block-scoped (not
    // Annex-B hoisted), so publish them here where they are in scope for
    // features/load-project.js. window.App is reused by the tail registry.
    (window.App = window.App || {}).checkInCurrentProjectIfHeld = checkInCurrentProjectIfHeld;
    window.App.resolvePdfBufferForCloudProject = resolvePdfBufferForCloudProject;
    window.App.buildPagesFromPdfArrayBufferAndProjectData = buildPagesFromPdfArrayBufferAndProjectData;
    // SECTION: Settings menu actions & Airboard sync
    document.getElementById('settingsLoadProject').onclick = () => {
      hideModal('settingsModal');
      openLoadProjectModalOrPromptSave();
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
    document.getElementById('settingsShareProject').onclick = () => { hideModal('settingsModal'); openShareProjectModal(); };
    document.getElementById('mySettingsSignOut').onclick = async () => { hideModal('mySettingsModal'); await checkInCurrentProjectIfHeld(); supabase.auth.signOut(); updateUI(); updateSaveStatusIndicator(); };
    document.getElementById('mySettingsModalClose').onclick = () => hideModal('mySettingsModal');
    document.getElementById('mySettingsSaveAirboard').onclick = async () => {
      const ok = await saveUserAirboard();
      if (ok) {
        showToast('Artboard saved to your account');
        const statusEl = document.getElementById('mySettingsAirboardStatus');
        if (statusEl) statusEl.textContent = 'Last saved: just now';
      } else {
        alert('Failed to save artboard. Please try again.');
      }
    };
    document.getElementById('mySettingsLoadAirboard').onclick = async () => {
      if (state.counters.length || state.lineTypes.length) {
        if (!confirm('Replace your current artboard with the saved version from the cloud?')) return;
      }
      const data = await fetchUserAirboard();
      if (!data) {
        showToast('No saved artboard found');
        return;
      }
      state.counters = data.counters;
      state.lineTypes = data.lineTypes;
      state.iconNames = data.iconNames;
      state.iconOrder = data.iconOrder;
      if (Array.isArray(data.customIconPaths)) saveUserCustomIcons(data.customIconPaths);
      if (data.plumbingModifiers && typeof data.plumbingModifiers === 'object') savePlumbingModifiers(data.plumbingModifiers);
      if (data.lineModifiers && typeof data.lineModifiers === 'object') saveLineModifiers(data.lineModifiers);
      updateUI();
      renderPdf();
      showToast('Artboard loaded from cloud');
    };
    document.getElementById('mySettingsExportAirboard').onclick = () => {
      const data = { counters: state.counters, lineTypes: state.lineTypes, iconNames: state.iconNames || {}, iconOrder: state.iconOrder || null, customIconPaths: getUserCustomIcons(), plumbingModifiers: getPlumbingModifiers(), lineModifiers: getLineModifiers() };
      const a = document.createElement('a');
      a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(data));
      a.download = 'artboard-backup.json';
      a.click();
      showToast('Artboard exported');
    };
    document.getElementById('mySettingsClearAirboard').onclick = () => {
      if (!confirm('Clear all counters and line types? This cannot be undone.')) return;
      pushUndoSnapshot();
      state.counters = [];
      state.lineTypes = [];
      state.iconNames = {};
      state.iconOrder = null;
      state.activeCounterType = null;
      state.activeLineTypeId = null;
      savePlumbingModifiers({ sizes: [...PLUMBING_DEFAULTS.sizes], types: [...PLUMBING_DEFAULTS.types], materials: [...PLUMBING_DEFAULTS.materials], iconByType: {}, defaultColor: COLORS[2] });
      saveLineModifiers({ sizes: [...LINE_DEFAULTS.sizes], materials: [...LINE_DEFAULTS.materials], defaultColor: COLORS[2] });
      markProjectDirty();
      updateUI();
      renderPdf();
      showToast('Artboard cleared');
    };
    document.getElementById('mySettingsManageUsers').onclick = () => { hideModal('mySettingsModal'); document.getElementById('manageUsersBtn').click(); };
    document.getElementById('mySettingsManageUser').onclick = () => App.openManageUserModal();
    document.getElementById('mySettingsAllUsers').onclick = () => App.openAllUsersModal();
    // SECTION: My Settings password & Auth sign-in
    document.getElementById('mySettingsPasswordForm').onsubmit = async (e) => {
      e.preventDefault();
      const newPw = document.getElementById('mySettingsNewPassword').value;
      const confirmPw = document.getElementById('mySettingsConfirmPassword').value;
      const errEl = document.getElementById('mySettingsPasswordError');
      const successEl = document.getElementById('mySettingsPasswordSuccess');
      errEl.style.display = 'none';
      successEl.style.display = 'none';
      if (!newPw || newPw.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters';
        errEl.style.display = 'block';
        return;
      }
      if (newPw !== confirmPw) {
        errEl.textContent = 'Passwords do not match';
        errEl.style.display = 'block';
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        errEl.textContent = error.message || 'Failed to update password';
        errEl.style.display = 'block';
        return;
      }
      successEl.textContent = 'Password updated';
      successEl.style.display = 'block';
      document.getElementById('mySettingsNewPassword').value = '';
      document.getElementById('mySettingsConfirmPassword').value = '';
    };
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
    document.getElementById('saveProjectBtn').onclick = async () => {
      document.getElementById('saveProjectName').value = state.currentProjectName || 'Untitled';
      document.getElementById('saveProjectError').style.display = 'none';
      document.getElementById('saveProjectDo').disabled = false;
      document.getElementById('saveProjectDo').textContent = 'Save';
      document.getElementById('saveProjectProgress').style.display = 'none';
      document.getElementById('saveProjectChecklist').innerHTML = '';
      const contentsList = document.getElementById('saveProjectContentsList');
      const contentsLabel = document.getElementById('saveProjectContentsLabel');
      const noPdfMessage = document.getElementById('saveProjectNoPdfMessage');
      const checkboxEl = document.getElementById('saveProjectIncludePdf');
      const includePdfLabel = document.getElementById('saveProjectIncludePdfLabel');
      const includePdfBtn = document.getElementById('saveProjectIncludePdfBtn');
      let pdfBufLen = state.pdfBufferSize > 0 ? state.pdfBufferSize : 0;
      if (pdfBufLen === 0 && state.pdfBuffer) {
        const b = state.pdfBuffer;
        pdfBufLen = (typeof b.byteLength === 'number' ? b.byteLength : 0) || (typeof b.length === 'number' ? b.length : 0) || (typeof b.size === 'number' ? b.size : 0);
        if (pdfBufLen === 0 && b) {
          try { pdfBufLen = new Blob([b]).size; } catch (_) {}
          if (pdfBufLen > 0) state.pdfBufferSize = pdfBufLen;
        }
      }
      const hasValidPdfBuffer = pdfBufLen > 0;
      let pdfSizeBytes = hasValidPdfBuffer ? pdfBufLen : 0;
      if (!hasValidPdfBuffer) {
        // Try the local IndexedDB cache first. This works even when the PDF is
        // not in the cloud yet (e.g. created via Prepare PDF "Open"):
        // performSaveProjectToCloud recovers the buffer the same way, so a cache
        // hit means Include PDF will actually succeed.
        if (state.currentProjectId && state.pdfHash) {
          try {
            const cached = await pdfCacheGet(state.currentProjectId, state.pdfHash);
            if (cached && cached.size > 0) pdfSizeBytes = cached.size;
          } catch (_) {}
        }
        if (pdfSizeBytes === 0 && state.pdfStoragePath && SUPABASE_ENABLED && supabase) {
          try {
            const { data: info } = await supabase.storage.from('pdfs').info(state.pdfStoragePath);
            const sz = info?.metadata?.size ?? info?.size ?? info?.metadata?.contentLength;
            pdfSizeBytes = typeof sz === 'number' ? sz : (typeof sz === 'string' ? parseInt(sz, 10) : 0);
          } catch (_) {}
        }
      }
      if (state.pdfBuffer || state.pdfStoragePath || state.pages.length > 0) {
        contentsList.style.display = '';
        contentsLabel.style.display = 'block';
        noPdfMessage.style.display = 'none';
        const nameEl = includePdfLabel?.querySelector('.save-contents-name');
        if (hasValidPdfBuffer || pdfSizeBytes > 0) {
          if (nameEl) nameEl.innerHTML = 'PDF (<span id="saveProjectPdfSize">' + (Math.max(pdfBufLen, pdfSizeBytes) / 1024 / 1024).toFixed(2) + '</span> MB)';
          if (includePdfLabel) includePdfLabel.classList.remove('save-contents-omitted');
          if (includePdfBtn) { includePdfBtn.style.display = ''; includePdfBtn.setAttribute('aria-pressed', 'true'); }
          checkboxEl.checked = true;
        } else if (state.pdfStoragePath) {
          // PDF is already in the cloud but its size is unknown; keep it
          // included (the save will simply not re-upload an unchanged file).
          if (nameEl) nameEl.textContent = 'PDF (in project)';
          if (includePdfBtn) includePdfBtn.style.display = 'none';
          checkboxEl.checked = true;
        } else {
          // PDF is not in memory, not in the local cache, and not in the cloud.
          // We cannot upload it from here, so saving with Include PDF would
          // fail. Leave it off and tell the user how to re-attach it.
          if (nameEl) nameEl.textContent = 'PDF (not in memory \u2014 reload the project to re-attach)';
          if (includePdfLabel) includePdfLabel.classList.add('save-contents-omitted');
          if (includePdfBtn) { includePdfBtn.style.display = ''; includePdfBtn.setAttribute('aria-pressed', 'false'); }
          checkboxEl.checked = false;
        }
      } else {
        contentsList.style.display = 'none';
        contentsLabel.style.display = 'none';
        noPdfMessage.style.display = 'block';
      }
      showModal('saveProjectModal');
    };
    document.getElementById('saveProjectBtnSidebar').onclick = () => document.getElementById('saveProjectBtn').click();
    document.getElementById('saveProjectCancel').onclick = () => hideModal('saveProjectModal');
    document.getElementById('saveProjectIncludePdf').onchange = () => {
      const label = document.getElementById('saveProjectIncludePdfLabel');
      const checkboxEl = document.getElementById('saveProjectIncludePdf');
      const btn = document.getElementById('saveProjectIncludePdfBtn');
      if (label) label.classList.toggle('save-contents-omitted', !checkboxEl.checked);
      if (btn) btn.setAttribute('aria-pressed', checkboxEl.checked);
    };
    document.getElementById('saveProjectIncludePdfBtn').onclick = (e) => {
      e.preventDefault();
      const checkboxEl = document.getElementById('saveProjectIncludePdf');
      checkboxEl.checked = !checkboxEl.checked;
      checkboxEl.dispatchEvent(new Event('change'));
    };
    document.getElementById('saveProjectDo').onclick = async () => {
      const name = document.getElementById('saveProjectName').value.trim() || 'Untitled';
      const errEl = document.getElementById('saveProjectError');
      const saveBtn = document.getElementById('saveProjectDo');
      errEl.style.display = 'none';
      const user = state.supabaseSession?.user;
      if (!user) {
        errEl.textContent = 'Please sign in to save.';
        errEl.style.display = 'block';
        return;
      }
      if (state.isViewer) {
        errEl.textContent = 'You are viewing only. Check out the project to edit and save.';
        errEl.style.display = 'block';
        return;
      }
      if (state.currentProjectId && state.checkedOutBy === user.id && state.checkedOutAt) {
        const checkedAt = new Date(state.checkedOutAt).getTime();
        const ageMs = serverNowMs() - checkedAt;
        let confirmedExpired = false;
        if (ageMs > CHECKOUT_INACTIVITY_MS + CHECKOUT_SOFT_GRACE_MS) {
          confirmedExpired = true;
          saveDebugLog('manual.save.expired', { ageMs, mode: 'hard_skew' });
        } else if (ageMs > CHECKOUT_INACTIVITY_MS - CHECKOUT_NEAR_EXPIRY_MS) {
          const probe = await probeCheckoutLock();
          if (probe.expired) {
            confirmedExpired = true;
            saveDebugLog('manual.save.expired', { ageMs, mode: 'probe' });
          } else if (!probe.ok) {
            showToast('Could not verify edit session. Try again.', 4000);
            return;
          }
        }
        if (confirmedExpired) {
          // Note: keep state.checkedOutBy/At/Email populated until recovery resolves.
          // Nulling them eagerly lets a re-click during a slow recovery bypass the
          // preflight expiry guard and fall through to performSaveProjectToCloud
          // against a wedged client.
          clearUndoStacks();
          updateSaveStatusIndicator();
          const recovered = await handleBackgroundCheckoutExpired('manual_save');
          await refreshProjectPermissions().catch(() => {});
          if (recovered && recovered.silentlyRecovered) {
            errEl.style.display = 'none';
            updateUI();
            return;
          }
          // Only zero locally when refresh did not reassign the lock to a
          // different user. If refresh repopulated state.checkedOutBy with a
          // new holder, preserve their info so the header banner / settings
          // checkout row can show "Checked out by <email>" while the recovery
          // modal is open.
          if (state.checkedOutBy === user.id || !state.checkedOutBy) {
            state.checkedOutBy = null;
            state.checkedOutAt = null;
            state.checkedOutEmail = null;
          }
          updateUI();
          hideModal('saveProjectModal');
          openCheckoutExpiredRecoveryModal({ trigger: 'manual_save' });
          return;
        }
      }
      const origText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      hideModal('saveProjectModal');
      const includePdf = document.getElementById('saveProjectIncludePdf').checked;
      if (!includePdf && state.currentProjectId && state.pdfBuffer && state.pdfHash) {
        let cloudPdfHash = null;
        try {
          const { data: cloudProj } = await withTimeout(
            supabase.from('projects').select('pdf_hash').eq('id', state.currentProjectId).single(),
            5000,
            'pdf_hash check (G7)'
          );
          cloudPdfHash = cloudProj?.pdf_hash || null;
        } catch (_) { /* network blip: skip the confirm */ }
        if (cloudPdfHash && cloudPdfHash !== state.pdfHash) {
          const proceed = confirm(
            'Heads up: your local PDF is newer than the one in the cloud.\n\n' +
            'Saving canvas only will leave the cloud copy referencing the old PDF. ' +
            'Click Cancel to go back and turn Include PDF on, or OK to save canvas only anyway.'
          );
          if (!proceed) {
            saveBtn.disabled = false;
            saveBtn.textContent = origText;
            pushSaveEvent('manual_save_canceled', 'User canceled at stale-PDF confirm');
            return;
          }
          pushSaveEvent('manual_save_pdf_mismatch_accepted', 'User saved canvas only with newer local PDF');
        }
      }
      const result = await performSaveProjectToCloud({ name, includePdf });
      if (!result.ok) {
        if (isAuthError(result.error)) {
          showToast('Refresh the page to sync.', 4000);
        } else {
          const errMsg = (result.error?.message) || (result.error?.details) || (result.error?.hint) || String(result.error) || 'Save failed';
          showToast('Save failed: ' + errMsg + '. Open Project Settings to retry.', 4000);
        }
      }
      saveBtn.disabled = false;
      saveBtn.textContent = origText;
    };
    document.getElementById('loadProjectBtn').onclick = () => openLoadProjectModalOrPromptSave();
    document.getElementById('loadProjectBtnSidebar').onclick = () => openLoadProjectModalOrPromptSave();
    document.getElementById('loadProjectCancel').onclick = () => hideModal('loadProjectModal');
    document.getElementById('copyProjectModalCancel').onclick = () => {
      copyProjectModalTarget = null;
      hideModal('copyProjectModal');
    };
    // SECTION: Copy project modal
    document.getElementById('copyProjectModalConfirm').onclick = async () => {
      const proj = copyProjectModalTarget;
      const inp = document.getElementById('copyProjectNameInput');
      const confirmBtn = document.getElementById('copyProjectModalConfirm');
      if (!proj) {
        hideModal('copyProjectModal');
        return;
      }
      const name = inp ? inp.value : '';
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Opening…';
      }
      try {
        await forkCloudProjectToLocalWorkingCopy(proj, name);
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Open copy';
        }
      }
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
        if (saveInProgress || turnInInProgress) {
          showToast('Sync in progress, try again in a moment', 3000);
          return;
        }
        if (!confirm('Discard local edits and reload? Your unsaved local edits for this project will be lost.')) return;
        try {
          autoSaveDirty = false;
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
    // SECTION: Save-before-load modal
    document.getElementById('saveBeforeLoadCancel').onclick = () => {
      pendingCopyProject = null;
      hideModal('saveBeforeLoadModal');
    };
    document.getElementById('saveBeforeLoadDiscard').onclick = () => {
      hideModal('saveBeforeLoadModal');
      const p = pendingCopyProject;
      pendingCopyProject = null;
      if (p) openCopyProjectModal(p);
      else App.openLoadProjectModal();
    };
    document.getElementById('saveBeforeLoadSave').onclick = async () => {
      const cancelBtn = document.getElementById('saveBeforeLoadCancel');
      const discardBtn = document.getElementById('saveBeforeLoadDiscard');
      const saveBtn = document.getElementById('saveBeforeLoadSave');
      const msgEl = document.querySelector('#saveBeforeLoadModal p');
      msgEl.textContent = 'Saving Now...';
      discardBtn.style.display = 'none';
      saveBtn.style.display = 'none';
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancel';
      const result = await performAutoSave();
      if (result.ok) {
        hideModal('saveBeforeLoadModal');
        const p = pendingCopyProject;
        pendingCopyProject = null;
        if (p) openCopyProjectModal(p);
        else App.openLoadProjectModal();
      } else {
        if (result.error?.code === 'CHECKOUT_EXPIRED') {
          pushSaveEvent('checkout_expired', CHECKOUT_EXPIRED_SAVE_STATUS_MSG);
          checkoutExpiredNeedsAttention = true;
          suspendAutoSaveUntilCheckout = true;
          refreshProjectPermissions().catch(() => {});
          updateSaveStatusIndicator();
          hideModal('saveBeforeLoadModal');
          pendingCopyProject = null;
          openCheckoutExpiredRecoveryModal({ trigger: 'save_before_load' });
          return;
        } else if (isAuthError(result.error)) {
          showToast('Refresh the page to sync.', 4000);
        } else {
          const errMsg = result.error ? ((result.error?.message) || (result.error?.details) || (result.error?.hint) || String(result.error)) : '';
          showToast('Save failed' + (errMsg ? ': ' + errMsg : '') + '. Open Project Settings to retry.', 4000);
        }
        msgEl.textContent = pendingCopyProject
          ? 'You have unsaved changes. Save before copying another project?'
          : 'You have unsaved changes. Save before loading another project?';
        discardBtn.style.display = '';
        saveBtn.style.display = '';
        cancelBtn.disabled = false;
      }
    };
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
      const { proj } = p;
      pendingLastSessionRestore = null;
      hideModal('lastSessionRestoreModal');
      try { localStorage.removeItem('clickcount-last-project'); } catch (_) {}
      await pdfCacheDelete(proj.id);
      await takeoffBackupDelete(proj.id);
      updateUI();
    };
    // The admin Manage-Users handlers (#manageUsersBtn create-user opener,
    // #manageUsersBtnSidebar, #adminPanelClose, #manageUserModalClose,
    // manageUserModalAllActivityBtn, #allUsersModalClose, #adminCreateForm below)
    // moved to features/user-admin.js (window.App registry).
    // SECTION: User Activity filters & view toggle
    document.getElementById('userActivityModalClose').onclick = () => hideModal('userActivityModal');
    const userActivityUserSelect = document.getElementById('userActivityUserSelect');
    if (userActivityUserSelect) {
      userActivityUserSelect.onchange = function () {
        if (userActivitySelectSuppress) return;
        const v = this.value;
        if (v === '') openUserActivityModal(null, null);
        else {
          const opt = this.options[this.selectedIndex];
          const em = opt && opt.dataset ? opt.dataset.email : '';
          openUserActivityModal(v, em || '');
        }
      };
    }
    const userActivityFilterInput = document.getElementById('userActivityFilterInput');
    if (userActivityFilterInput) {
      userActivityFilterInput.addEventListener('input', () => applyUserActivityFilter());
    }
    const userActivityFilterClear = document.getElementById('userActivityFilterClear');
    if (userActivityFilterClear) {
      userActivityFilterClear.onclick = () => {
        if (userActivityFilterInput) userActivityFilterInput.value = '';
        applyUserActivityFilter();
      };
    }
    const userActivityViewEventsBtn = document.getElementById('userActivityViewEventsBtn');
    const userActivityViewSummaryBtn = document.getElementById('userActivityViewSummaryBtn');
    if (userActivityViewEventsBtn) {
      userActivityViewEventsBtn.onclick = () => {
        if (state.userActivityViewMode === 'events') return;
        state.userActivityViewMode = 'events';
        syncUserActivityViewToggleUI();
        loadUserActivityAllUsersContent();
      };
    }
    if (userActivityViewSummaryBtn) {
      userActivityViewSummaryBtn.onclick = () => {
        if (state.userActivityViewMode === 'summary') return;
        state.userActivityViewMode = 'summary';
        syncUserActivityViewToggleUI();
        loadUserActivityAllUsersContent();
      };
    }
    // #manageProjectsModalClose moved to features/manage-projects.js.
    // manageIconsModalClose / manageIconsCancel / manageIconsSave handlers live
    // in features/manage-icons.js (window.App registry).
    document.getElementById('canvasRepairModalClose').onclick = () => hideModal('canvasRepairModal');
    document.getElementById('canvasRepairCancel').onclick = () => hideModal('canvasRepairModal');
    document.getElementById('canvasRepairApply').onclick = () => App.applyCanvasRepair();
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
    openLinePropertiesModal(it);
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

  function handleCanvasClick(e) {
    if (!state.pages.length) return;
    if (state.isViewer && state.tool !== TOOL.NONE && state.tool !== TOOL.MEASURE) return;
    const pt = canvasPointFromEvent(e);
    const pdf = canvasToPdf(pt.x, pt.y);
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
      if (now - state.lastScaleTapTime < 400) return;
      state.lastScaleTapTime = now;
      if (state.scaleMode === SCALE_MODES.POINT_A) { state.scalePointA = pdf; state.scaleMode = SCALE_MODES.POINT_B; }
      else if (state.scaleMode === SCALE_MODES.POINT_B) {
        state.scalePointB = pdf;
        document.getElementById('scaleValue').value = '';
        App.openScaleModal();
      }
      renderPdf();
    } else if (state.tool === TOOL.MEASURE) {
      if (!isPointInPageBounds(pdf)) { showOutOfBoundsToast(); return; }
      const now = Date.now();
      if (now - state.lastScaleTapTime < 400) return;
      state.lastScaleTapTime = now;
      if (state.scaleMode === SCALE_MODES.POINT_A) { state.scalePointA = pdf; state.scaleMode = SCALE_MODES.POINT_B; }
      else if (state.scaleMode === SCALE_MODES.POINT_B) {
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
    } else if (state.tool === TOOL.LINE) {
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
      renderAnnotations();
      updateUI();
    } else if (state.tool === TOOL.POLYLINE && state.drawingPolyline) {
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
            const lenStr = formatLineLengthRealSum(counts.lengthRealSum, page?.scale);
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
          const total = collected.counterCount + collected.lineRunCount + collected.highlightCount + collected.noteCount + collected.multiplyZoneCount + collected.scaleZoneCount;
          if (total === 0) {
            showToast('No items in this area.', 2000);
          } else {
            const lenStr = formatLineLengthRealSum(collected.lengthRealSum, page?.scale);
            const parts = [];
            if (collected.counterCount) parts.push(collected.counterCount + ' counter(s)');
            if (collected.lineRunCount) parts.push(collected.lineRunCount + ' line run(s) (' + lenStr + ')');
            if (collected.highlightCount) parts.push(collected.highlightCount + ' highlight(s)');
            if (collected.noteCount) parts.push(collected.noteCount + ' note(s)');
            if (collected.multiplyZoneCount) parts.push(collected.multiplyZoneCount + ' multiply zone(s)');
            if (collected.scaleZoneCount) parts.push(collected.scaleZoneCount + ' scale zone(s)');
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
  function commitWheelZoom() {
    if (wheelZoomCommitTimer) clearTimeout(wheelZoomCommitTimer);
    wheelZoomCommitTimer = null;
    if (Math.abs(state.zoom - lastRenderedZoom) > 0.001) {
      lastRenderedZoom = state.zoom;
      renderPdf();
    }
    updateUI();
  }

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
    }
  });

  function handleCanvasMouseMove(e) {
    const pt = canvasPointFromEvent(e);
    const pdf = canvasToPdf(pt.x, pt.y);
    state.mousePos = pdf;
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
    } else if ((state.tool === TOOL.LINE && state.quickLineStart) || (state.tool === TOOL.POLYLINE && state.drawingPolyline && state.drawingPolyline.points.length >= 1) || (state.tool === TOOL.HIGHLIGHT && state.highlightStart) || (state.tool === TOOL.MULTIPLY_ZONE && state.multiplyZoneStart) || (state.tool === TOOL.SCALE_ZONE && state.scaleZoneStart) || (state.tool === TOOL.DELETE_ZONE && state.deleteZoneStart)) {
      renderAnnotations();
    }
    const t = hitTest(pdf);
    state.hoverLegendResize = !!(t && t.type === 'legendResize');
    if (annCanvas) {
      if (state.isPanning && state.panStart) {
        annCanvas.style.cursor = 'url(' + moveCursorSvg + ') 12 12, move';
      } else {
        annCanvas.style.cursor = (t && t.type === 'legendResize') ? 'se-resize' : (t && (t.type === 'legendDrag' || t.type === 'legend')) ? 'move' : (t && t.type === 'noteResize') ? 'ew-resize' : (t && t.type === 'noteFontSize') ? 'ns-resize' : (t && t.type === 'note') ? 'move' : '';
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
    if (state.isPanning || state.justFinishedResize || state.justFinishedDragNote || state.justFinishedLegendResize) { state.justFinishedResize = false; state.justFinishedDragNote = false; state.justFinishedLegendResize = false; return; }
    state.justFinishedResize = false;
    state.justFinishedDragNote = false;
    state.justFinishedLegendResize = false;
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
        updateUI();
        if (wheelZoomCommitTimer) clearTimeout(wheelZoomCommitTimer);
        wheelZoomCommitTimer = setTimeout(commitWheelZoom, 150);
      });
    }
  }, { passive: false });

  (cWrapper || pdfCanvas).addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      state.pinchStartDistance = ptDist({ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY });
      state.pinchStartZoom = state.zoom;
    } else if (e.touches.length === 1) {
      const c = getClientCoords(e);
      state.touchPanStart = { x: c.x, y: c.y, panX: state.pan.x, panY: state.pan.y };
      state.longPressTimer = setTimeout(() => {
        state.longPressFired = true;
        const ev = new MouseEvent('contextmenu', { clientX: c.x, clientY: c.y, bubbles: true });
        (cWrapper || pdfCanvas).dispatchEvent(ev);
      }, 500);
      state.longPressStart = c;
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
          const zp = document.getElementById('zoomPct');
          if (zp) zp.textContent = Math.round(state.zoom * 100) + '%';
        });
      }
    } else if (e.touches.length === 1 && state.touchPanStart) {
      const c = getClientCoords(e);
      const moved = ptDist(state.touchPanStart, c) > 10;
      if (((state.tool === TOOL.LINE && state.quickLineStart) || (state.tool === TOOL.HIGHLIGHT && state.highlightStart) || (state.tool === TOOL.MULTIPLY_ZONE && state.multiplyZoneStart) || (state.tool === TOOL.SCALE_ZONE && state.scaleZoneStart)) && moved) {
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
        const tapCancelThreshold = (state.tool === TOOL.LINE) || (state.tool === TOOL.POLYLINE && state.drawingPolyline) || (state.tool === TOOL.HIGHLIGHT && state.highlightStart) || (state.tool === TOOL.MULTIPLY_ZONE && state.multiplyZoneStart) || (state.tool === TOOL.SCALE_ZONE && state.scaleZoneStart) || (state.tool === TOOL.DELETE_ZONE && state.deleteZoneStart) ? 25 : 10;
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
            const lenStr = formatLineLengthRealSum(counts.lengthRealSum, page?.scale);
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
          const total = collected.counterCount + collected.lineRunCount + collected.highlightCount + collected.noteCount + collected.multiplyZoneCount + collected.scaleZoneCount;
          if (total === 0) {
            showToast('No items in this area.', 2000);
          } else {
            const lenStr = formatLineLengthRealSum(collected.lengthRealSum, page?.scale);
            const parts = [];
            if (collected.counterCount) parts.push(collected.counterCount + ' counter(s)');
            if (collected.lineRunCount) parts.push(collected.lineRunCount + ' line run(s) (' + lenStr + ')');
            if (collected.highlightCount) parts.push(collected.highlightCount + ' highlight(s)');
            if (collected.noteCount) parts.push(collected.noteCount + ' note(s)');
            if (collected.multiplyZoneCount) parts.push(collected.multiplyZoneCount + ' multiply zone(s)');
            if (collected.scaleZoneCount) parts.push(collected.scaleZoneCount + ' scale zone(s)');
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
        if (state.tool === TOOL.LINE || state.tool === TOOL.HIGHLIGHT || state.tool === TOOL.MULTIPLY_ZONE || state.tool === TOOL.SCALE_ZONE || state.tool === TOOL.NOTE) {
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
    const zo = document.getElementById('zoomOverlay');
    if (zo && zo.classList.contains('visible') && !e.target.closest('#zoomOverlay') && !e.target.closest('#zoomPct')) zo.classList.remove('visible');
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
      else if (!state.isViewer) {
        if (k === 's') { document.getElementById('setScale').click(); e.preventDefault(); }
        else if (k === 'c') { document.getElementById('counterBtn').click(); e.preventDefault(); }
        else if (k === 'l') { document.getElementById('quickLine').click(); e.preventDefault(); }
        else if (k === 'p') { document.getElementById('polylineBtn').click(); e.preventDefault(); }
        else if (k === 'h') { document.getElementById('highlightBtn').click(); e.preventDefault(); }
        else if (k === 'x') { document.getElementById('multiplyZoneBtn').click(); e.preventDefault(); }
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
      else if (document.getElementById('multiplyZoneSettingsModal').classList.contains('visible')) { hideModal('multiplyZoneSettingsModal'); }
      else if (document.getElementById('linePropertiesModal').classList.contains('visible')) { closeLinePropertiesModal(); }
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
      else if (document.getElementById('copyProjectModal').classList.contains('visible')) { copyProjectModalTarget = null; hideModal('copyProjectModal'); }
      else if (document.getElementById('loadProjectModal').classList.contains('visible')) { hideModal('loadProjectModal'); }
      else if (document.getElementById('shareProjectModal').classList.contains('visible')) { hideModal('shareProjectModal'); }
      else if (document.getElementById('loadAnnotationsModal').classList.contains('visible')) { hideModal('loadAnnotationsModal'); }
      else if (document.getElementById('preparePdfModal').classList.contains('visible')) { if (typeof closePreparePdfModal === 'function') closePreparePdfModal(); }
      else if (document.getElementById('summaryCountDetailModal').classList.contains('visible')) { hideModal('summaryCountDetailModal'); }
      else if (document.getElementById('viewLinkEmailModal').classList.contains('visible')) {
        if (typeof viewLinkEmailResolve === 'function') { viewLinkEmailResolve(null); viewLinkEmailResolve = null; }
        hideModal('viewLinkEmailModal');
      }
      else if (document.getElementById('addCanvasModal').classList.contains('visible')) { hideModal('addCanvasModal'); }
      else if (document.getElementById('deleteCanvasConfirmModal').classList.contains('visible')) { pendingDeleteCanvas = null; hideModal('deleteCanvasConfirmModal'); }
      else if (document.getElementById('canvasDetailsModal').classList.contains('visible')) {
        const canvas = pendingCanvasEdit;
        const nameInput = document.getElementById('canvasDetailsName');
        if (canvas && nameInput) { canvas.name = (nameInput.value || '').trim() || 'Main'; markProjectDirty(); updateUI(); }
        pendingCanvasEdit = null;
        hideModal('canvasDetailsModal');
      }
      else if (state.tool === TOOL.EDIT_POLY) exitEditMode(false);
      else if (state.drawingPolyline) { state.drawingPolyline = null; state.tool = TOOL.NONE; updateUI(); }
      else if (state.tool === TOOL.LINE) {
        if (state.quickLineStart) { state.quickLineStart = null; renderPdf(); updateUI(); }
        else { state.tool = TOOL.NONE; updateUI(); }
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

  // Module-level progress sink for the active PDF upload. A flow that wants the
  // byte-level upload progress (e.g. Turn In, to show a percentage in its banner)
  // sets this before kicking off a save and clears it after; the upload helpers
  // invoke it. Null when nobody is listening.
  let onPdfUploadProgress = null;

  // Poll storage.info() to confirm an object actually landed after an upload that
  // timed out / aborted client-side (the underlying request can still complete
  // server-side). Returns true when the object exists with the expected byte size.
  async function confirmPdfUploaded(storagePath, expectedBytes) {
    if (!supabase || !(expectedBytes > 0)) return false;
    for (let i = 0; i < PDF_UPLOAD_VERIFY_ATTEMPTS; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, PDF_UPLOAD_VERIFY_GAP_MS));
      try {
        const { data: info } = await withTimeout(supabase.storage.from('pdfs').info(storagePath), STORAGE_INFO_TIMEOUT_MS, 'Storage info');
        const sz = info && (info.metadata?.size ?? info.size);
        if (typeof sz === 'number' && sz === expectedBytes) return true;
      } catch (_) { /* keep polling */ }
    }
    return false;
  }

  // True when the resumable/TUS path can be used (large file + library loaded).
  function canUseResumableUpload(bytes) {
    return bytes > PDF_RESUMABLE_THRESHOLD_BYTES &&
      typeof tus !== 'undefined' && tus && typeof tus.Upload === 'function' && tus.isSupported;
  }

  // Resumable PDF upload via tus against Supabase Storage's resumable endpoint.
  // Chunked (6 MB, required by Supabase), reports byte progress via opts.onProgress,
  // honors opts.signal for abort, and resumes from a prior interrupted upload for
  // the same fingerprint (persisted in IndexedDB, so it survives a page reload).
  // Resolves { ok: true } or rejects with the tus error. opts: { fingerprint,
  // onProgress, signal }.
  async function uploadPdfResumable(storagePath, blob, opts) {
    opts = opts || {};
    if (typeof tus === 'undefined' || typeof tus.Upload !== 'function') throw new Error('Resumable upload library not loaded');
    const token = state.supabaseSession?.access_token;
    if (!token) throw new Error('Not signed in');
    const fingerprint = 'clickcount-pdf::' + (opts.fingerprint || storagePath);
    // tus UrlStorage backed by IndexedDB (cross-reload resume).
    const idbUrlStorage = {
      addUpload: async (fp, upload) => {
        const urlStorageKey = 'tus::' + fp + '::' + Date.now();
        await idbPdfUploadResumePut({
          urlStorageKey, fingerprint: fp,
          uploadUrl: upload.uploadUrl || null,
          size: upload.size != null ? upload.size : null,
          metadata: upload.metadata || null,
          creationTime: upload.creationTime || new Date().toISOString(),
          parallelUploadUrls: upload.parallelUploadUrls || null
        });
        return urlStorageKey;
      },
      removeUpload: async (urlStorageKey) => { await idbPdfUploadResumeDelete(urlStorageKey); },
      findAllUploads: async () => { return await idbPdfUploadResumeGetAll(); },
      findUploadsByFingerprint: async (fp) => { return await idbPdfUploadResumeGetByFingerprint(fp); }
    };
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };
      const upload = new tus.Upload(blob, {
        endpoint: SUPABASE_URL + '/storage/v1/upload/resumable',
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: 'Bearer ' + token,
          apikey: SUPABASE_ANON_KEY,
          'x-upsert': 'true'
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        fingerprint: () => Promise.resolve(fingerprint),
        urlStorage: idbUrlStorage,
        metadata: {
          bucketName: 'pdfs',
          objectName: storagePath,
          contentType: 'application/pdf',
          cacheControl: '3600'
        },
        onError: (err) => finish(reject, err),
        onProgress: (sent, total) => { if (typeof opts.onProgress === 'function') { try { opts.onProgress(sent, total); } catch (_) {} } },
        onSuccess: () => { idbPdfUploadResumeDeleteByFingerprint(fingerprint).catch(() => {}); finish(resolve, { ok: true }); }
      });
      if (opts.signal) {
        if (opts.signal.aborted) { try { upload.abort(); } catch (_) {} finish(reject, new DOMException('Aborted', 'AbortError')); return; }
        opts.signal.addEventListener('abort', () => { try { upload.abort(); } catch (_) {} finish(reject, new DOMException('Aborted', 'AbortError')); }, { once: true });
      }
      // Resume a prior interrupted upload for this fingerprint if one exists.
      upload.findPreviousUploads().then((prev) => {
        if (prev && prev.length) { try { upload.resumeFromPreviousUpload(prev[0]); } catch (_) {} }
        upload.start();
      }).catch(() => { upload.start(); });
    });
  }

  // Upload a PDF to the `pdfs` bucket. Large files (> PDF_RESUMABLE_THRESHOLD_BYTES)
  // go through the resumable/TUS path (chunked, progress, cross-reload resume, and
  // genuinely cancellable via tus); smaller files use a single standard upload with
  // a size-aware timeout (so a slow PDF is not falsely failed). NOTE: storage-js
  // `upload()` does not accept an AbortSignal, so the standard path cannot cancel an
  // in-flight request -- the timeout only bounds how long we WAIT, and the
  // verify-after-timeout net (confirmPdfUploaded) reconciles an upload that actually
  // completed server-side after the client gave up. Either path runs that verify net
  // on a transient failure before surfacing. Returns { ok, ms, timeoutMs, viaVerify,
  // resumable } or throws. ctx: { runId, timeoutMs, onProgress, fingerprint }.
  async function uploadPdfToStorage(storagePath, pdfToUpload, ctx) {
    ctx = ctx || {};
    const bytes = pdfToUpload.byteLength || pdfToUpload.size || 0;
    const timeoutMs = ctx.timeoutMs || pdfUploadTimeoutMs(bytes, {
      baseMs: PDF_UPLOAD_TIMEOUT_BASE_MS, assumedBps: PDF_UPLOAD_ASSUMED_BPS,
      slackMs: PDF_UPLOAD_TIMEOUT_SLACK_MS, maxMs: PDF_UPLOAD_TIMEOUT_MAX_MS
    });
    const t1 = Date.now();
    if (canUseResumableUpload(bytes)) {
      try {
        const blob = (typeof Blob !== 'undefined' && pdfToUpload instanceof Blob) ? pdfToUpload : new Blob([pdfToUpload], { type: 'application/pdf' });
        await uploadPdfResumable(storagePath, blob, { fingerprint: ctx.fingerprint || storagePath, onProgress: ctx.onProgress, signal: ctx.signal });
        return { ok: true, ms: Date.now() - t1, timeoutMs, resumable: true };
      } catch (e) {
        // The upload may have completed server-side even though tus reported an
        // error / was aborted; the object's presence is authoritative.
        const confirmed = await confirmPdfUploaded(storagePath, bytes).catch(() => false);
        if (confirmed) {
          pushSaveEvent('pdf_upload_verified_after_timeout', 'PDF upload confirmed via storage info after error', JSON.stringify({ path: storagePath, bytes, ms: Date.now() - t1, resumable: true, runId: ctx.runId }));
          return { ok: true, ms: Date.now() - t1, timeoutMs, viaVerify: true, resumable: true };
        }
        throw e;
      }
    }
    try {
      // storage-js upload() is not cancellable (no AbortSignal param), so pass a
      // plain promise; withTimeout bounds the wait and verify-after-timeout below
      // reconciles a request that completed server-side after we stopped waiting.
      const { error: uploadErr } = await withTimeout(
        supabase.storage.from('pdfs').upload(storagePath, pdfToUpload, { contentType: 'application/pdf', upsert: true }),
        timeoutMs, 'PDF upload'
      );
      if (uploadErr) throw uploadErr;
      return { ok: true, ms: Date.now() - t1, timeoutMs };
    } catch (e) {
      // A timeout/network error does not prove the object failed to land: the
      // request may have finished server-side just as the client gave up.
      // Verify via storage.info() before surfacing a failure.
      if (isTransientSaveError(e)) {
        const confirmed = await confirmPdfUploaded(storagePath, bytes).catch(() => false);
        if (confirmed) {
          pushSaveEvent('pdf_upload_verified_after_timeout', 'PDF upload confirmed via storage info after timeout', JSON.stringify({ path: storagePath, bytes, ms: Date.now() - t1, timeoutMs, runId: ctx.runId }));
          return { ok: true, ms: Date.now() - t1, timeoutMs, viaVerify: true };
        }
      }
      throw e;
    }
  }

  async function performSaveProjectToCloud(opts) {
    const runId = saveDebugRunId();
    const { name, includePdf, pdfBuffer: optsPdfBuffer } = opts;
    const user = state.supabaseSession?.user;
    if (!user || !supabase) {
      saveDebugLog('manual.save.skip', { runId, reason: 'not_signed_in' });
      return { ok: false, error: new Error('Not signed in') };
    }
    let rawPdf = optsPdfBuffer ?? state.pdfBuffer;
    let rawPdfBytes = (rawPdf && (rawPdf.byteLength || rawPdf.length || 0)) | 0;
    if (includePdf && rawPdfBytes === 0 && state.pdfBufferSize > 0 && state.currentProjectId && state.pdfHash) {
      try {
        const cached = await pdfCacheGet(state.currentProjectId, state.pdfHash);
        if (cached && cached.size > 0) {
          const recoveredBuf = await cached.arrayBuffer();
          if (recoveredBuf && recoveredBuf.byteLength > 0) {
            rawPdf = recoveredBuf;
            rawPdfBytes = recoveredBuf.byteLength;
            saveDebugLog('manual.save.recover_pdf', { runId, bytes: recoveredBuf.byteLength });
            pushSaveEvent('manual_save_recover', 'Recovered PDF from local cache');
          }
        }
      } catch (recoverErr) {
        saveDebugLog('manual.save.recover_pdf_err', { runId, message: recoverErr?.message });
      }
    }
    if (includePdf && rawPdfBytes === 0 && state.pdfBufferSize > 0 && !state.pdfStoragePath) {
      const detachedErr = new Error('PDF data is no longer in memory. Reload the project, then re-open Save.');
      saveDebugLog('manual.save.detached_pdf_fail', { runId, hadHash: !!state.pdfHash, hasStoragePath: !!state.pdfStoragePath });
      pushSaveEvent('manual_save_err', detachedErr.message);
      lastCloudSaveAttemptFailed = true;
      updateSaveStatusIndicator();
      return { ok: false, error: detachedErr };
    }
    const pdfToUpload = rawPdfBytes > 0 ? rawPdf : null;
    const willUploadPdf = pdfToUpload && includePdf;
    const prevPdfStoragePath = state.pdfStoragePath || null;
    saveInProgress = true;
    savePdfInProgress = willUploadPdf;
    const wasDirty = autoSaveDirty;
    const genAtEntry = dirtyGeneration;
    autoSaveDirty = false;
    updateStatus();
    const setProgress = (msg) => { saveProgressMessage = msg; updateStatus(); };
    // Determinate upload progress: drives the local status line and forwards to
    // any module-level listener (e.g. Turn In's banner). Only the resumable/TUS
    // path actually emits byte progress; the standard upload is a no-op here.
    const onUploadProgress = (sent, total) => {
      const pct = (total > 0) ? Math.min(100, Math.floor((sent / total) * 100)) : 0;
      setProgress('Uploading PDF... ' + pct + '%');
      if (typeof onPdfUploadProgress === 'function') { try { onPdfUploadProgress(sent, total); } catch (_) {} }
    };
    const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const data = {
      version: 1,
      counters: state.counters,
      lineTypes: state.lineTypes,
      iconNames: state.iconNames || {},
      iconOrder: state.iconOrder || null,
      customIconPaths: getUserCustomIcons(),
      maxZoom: getMaxZoom(),
      groups: state.groups || [],
      legendSettings: state.legendSettings,
      multiplyZoneSettings: state.multiplyZoneSettings,
      showGridOverlay: state.showGridOverlay,
      gridSettings: state.gridSettings,
      pages: state.pages.map((p, i) => ({ index: i, label: p.label, canvases: p.canvases, scale: p.scale, rotation: p.rotation ?? 0 })),
      activeCanvasIdByPage: state.activeCanvasIdByPage || {}
    };
    const counts = getProjectCounts(data);
    const tJson = Date.now();
    const dataJson = JSON.stringify(data);
    perfLog('Save JSON.stringify', Date.now() - tJson, { size: dataJson.length });
    const dataSize = dataJson.length;
    const log = (msg, extra) => { console.log('[Save]', msg, extra || ''); };
    log('Starting save', { userId: user.id, name, hasPdfBuffer: !!pdfToUpload, currentProjectId: state.currentProjectId, payloadSize: dataSize, supabaseUrl: (typeof SUPABASE_URL === 'string' ? SUPABASE_URL : 'not set') });
    saveDebugLog('manual.save.start', {
      runId,
      name,
      includePdf,
      hasPdfBuffer: !!pdfToUpload,
      currentProjectId: state.currentProjectId,
      willUploadPdf
    });
    saveDebugLog('manual.save.payload', {
      runId,
      dataSize,
      counter_count: counts.counter_count,
      line_count: counts.line_count
    });
    let orphanProjectIdForCleanup = null;
    let pendingNewProjectHydration = null;
    try {
      let pdfPath = state.pdfStoragePath;
      let cachePdfHash = null;
      const originalProjectId = state.currentProjectId;
      let manualSaveAttempt = 0;
      manualSaveLoop: while (true) {
        pdfPath = state.pdfStoragePath;
        cachePdfHash = null;
        try {
          if (willUploadPdf) {
            let projectId = state.currentProjectId;
            const pdfSize = pdfToUpload.byteLength;
            const sizeBytes = dataSize + pdfSize;
            let skipUpload = false;
            if (projectId) {
              const tSelect = Date.now();
              let row = null;
              try {
                const res = await withTimeout(supabase.from('projects').select('pdf_hash, pdf_path').eq('id', projectId).single(), 10000, 'pdf_hash check');
                row = res?.data || null;
              } catch (hashErr) {
                saveDebugLog('manual.save.pdf_hash_timeout', { runId, message: hashErr?.message });
              }
              perfLog('Save projects.select pdf_hash', Date.now() - tSelect);
              const newHash = await sha256Hex(pdfToUpload);
              // Skip the upload only when the cloud row carries a matching hash
              // AND actually has a pdf_path. A row can hold a pdf_hash with no
              // pdf_path (e.g. a project first created by autosave, which records
              // the hash but never uploads the file); in that case the storage
              // object does not exist, so we MUST upload even though the hashes
              // match — otherwise the project is left permanently without its PDF.
              if (row?.pdf_hash === newHash && row?.pdf_path) {
                skipUpload = true;
                cachePdfHash = newHash;
                log('PDF unchanged (hash match), skipping upload');
                saveDebugLog('manual.save.branch', { runId, branch: 'pdf_unchanged_hash_match' });
              } else if (row?.pdf_hash === newHash && !row?.pdf_path) {
                saveDebugLog('manual.save.branch', { runId, branch: 'hash_match_but_no_path_force_upload' });
                pushSaveEvent('manual_save_force_upload_missing_pdf', 'PDF hash matched but no file in cloud — uploading');
              }
            }
            if (!skipUpload) {
              // Check size BEFORE creating the project row so we don't leave an
              // orphan record behind when the PDF exceeds the limit.
              const sizeCheck = assertPdfWithinLimit(pdfToUpload.byteLength, 'performSaveProjectToCloud.upload');
              if (sizeCheck && !sizeCheck.ok) throw new Error(sizeCheck.message);
            }
            if (!projectId) {
              setProgress('Uploading project...');
              await tick();
              log('Inserting project...');
              saveDebugLog('manual.save.request.start', { runId, op: 'projects.insert', phase: 'with_pdf_new_project', timeoutMs: 60000, attempt: manualSaveAttempt, raw: true });
              const t0 = Date.now();
              const insertPayload = { user_id: user.id, name, data, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count };
              const { data: row, error } = await withTimeout((signal) => rawProjectsInsert(insertPayload, signal), 60000, 'Save project');
              log('Insert done', { duration: Date.now() - t0 + 'ms', error: error?.message, projectId: row?.id });
              if (error) {
                pushSaveEvent('manual_save_via_raw_fetch_err', 'Raw-fetch project insert (with PDF) failed', autosaveEventDetail({ runId, ms: Date.now() - t0, message: error.message, status: error.status, code: error.code, phase: 'with_pdf_new_project', diag: error.diag }));
                throw error;
              }
              pushSaveEvent('manual_save_via_raw_fetch_ok', 'Raw-fetch project insert (with PDF) succeeded', autosaveEventDetail({ runId, ms: Date.now() - t0, projectId: row?.id, phase: 'with_pdf_new_project' }));
              if (consecutiveAutoSaveFailures > 0 && !clientRecycleInFlight) {
                runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
              }
              saveDebugLog('manual.save.request.ok', { runId, op: 'projects.insert', phase: 'with_pdf_new_project', ms: Date.now() - t0, projectId: row?.id, raw: true });
              projectId = row?.id;
              if (!projectId) throw new Error('Project was created but no ID was returned. Please try again.');
              orphanProjectIdForCleanup = projectId;
              pendingNewProjectHydration = { projectId, userId: user.id };
              await tick();
            }
            if (!skipUpload) {
              setProgress('Uploading project...');
              await tick();
              const storagePath = user.id + '/' + projectId + '/document.pdf';
              log('Uploading PDF...', { path: storagePath, size: pdfToUpload.byteLength });
              // Hash before the upload so it can key the resumable-upload
              // fingerprint (project + content), so a resume after reload never
              // attaches to a stale partial upload of different PDF content. Reused
              // below as pdf_hash / cachePdfHash to avoid a second hash pass.
              const newHash = await sha256Hex(pdfToUpload);
              const uploadTimeoutMs = pdfUploadTimeoutMs(pdfToUpload.byteLength, { baseMs: PDF_UPLOAD_TIMEOUT_BASE_MS, assumedBps: PDF_UPLOAD_ASSUMED_BPS, slackMs: PDF_UPLOAD_TIMEOUT_SLACK_MS, maxMs: PDF_UPLOAD_TIMEOUT_MAX_MS });
              saveDebugLog('manual.save.request.start', { runId, op: 'storage.upload', path: storagePath, timeoutMs: uploadTimeoutMs, attempt: manualSaveAttempt });
              const t1 = Date.now();
              const uploadOutcome = await uploadPdfToStorage(storagePath, pdfToUpload, { runId, timeoutMs: uploadTimeoutMs, onProgress: onUploadProgress, fingerprint: projectId + '::' + newHash });
              log('Upload done', { duration: Date.now() - t1 + 'ms', viaVerify: !!uploadOutcome.viaVerify, resumable: !!uploadOutcome.resumable });
              saveDebugLog('manual.save.request.ok', { runId, op: 'storage.upload', ms: Date.now() - t1, viaVerify: !!uploadOutcome.viaVerify, resumable: !!uploadOutcome.resumable });
              pdfPath = storagePath;
              cachePdfHash = newHash;
              await tick();
              setProgress('Uploading project...');
              await tick();
              log('Updating project with pdf_path and pdf_hash...');
              saveDebugLog('manual.save.request.start', { runId, op: 'projects.update', phase: 'after_pdf_upload', projectId, timeoutMs: 30000, attempt: manualSaveAttempt });
              const t2 = Date.now();
              const updatePayload = { name, data, pdf_path: pdfPath, pdf_hash: newHash, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count, updated_at: new Date().toISOString() };
              if (state.checkedOutBy === user.id) updatePayload.checked_out_at = new Date().toISOString();
              const { error: updateErr } = await withTimeout((signal) => supabase.from('projects').update(updatePayload).eq('id', projectId).abortSignal(signal), 30000, 'Update project');
              log('Update done', { duration: Date.now() - t2 + 'ms', error: updateErr?.message });
              if (updateErr) throw updateErr;
              saveDebugLog('manual.save.request.ok', { runId, op: 'projects.update', phase: 'after_pdf_upload', ms: Date.now() - t2, projectId });
            } else {
              setProgress('Uploading project...');
              await tick();
              log('Updating project data (PDF unchanged)...');
              saveDebugLog('manual.save.request.start', { runId, op: 'projects.update', phase: 'pdf_hash_skip', projectId, timeoutMs: 30000, attempt: manualSaveAttempt });
              const t2 = Date.now();
              const updatePayload = { name, data, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count, updated_at: new Date().toISOString() };
              if (state.checkedOutBy === user.id) updatePayload.checked_out_at = new Date().toISOString();
              const { error: updateErr } = await withTimeout((signal) => supabase.from('projects').update(updatePayload).eq('id', projectId).abortSignal(signal), 30000, 'Update project');
              log('Update done', { duration: Date.now() - t2 + 'ms', error: updateErr?.message });
              if (updateErr) throw updateErr;
              saveDebugLog('manual.save.request.ok', { runId, op: 'projects.update', phase: 'pdf_hash_skip', ms: Date.now() - t2, projectId });
            }
          } else if (state.currentProjectId) {
            setProgress('Uploading project...');
            await tick();
            let sizeBytes = dataSize;
            const skipStorageInfoForDegraded = consecutiveAutoSaveFailures > 0;
            if (state.pdfStoragePath && !skipStorageInfoForDegraded) {
              const tInfo = Date.now();
              try {
                const { data: info } = await withTimeout(supabase.storage.from('pdfs').info(state.pdfStoragePath), STORAGE_INFO_TIMEOUT_MS, 'Storage info');
                const sz = info && (info.metadata?.size ?? info.size);
                if (typeof sz === 'number' && sz >= 0) sizeBytes += sz;
                saveDebugLog('manual.save.storage.info.ok', { runId, ms: Date.now() - tInfo, path: state.pdfStoragePath, pdfSizeBytes: typeof sz === 'number' ? sz : null, sizeBytes });
              } catch (se) {
                saveDebugLog('manual.save.storage.info.error', { runId, ms: Date.now() - tInfo, message: se?.message, name: se?.name });
                pushSaveEvent('manual_save_storage_info_err', 'Storage size check failed', autosaveEventDetail({ runId, ms: Date.now() - tInfo, message: se?.message, name: se?.name }));
              }
            } else if (state.pdfStoragePath) {
              pushSaveEvent('manual_save_storage_info_skipped', 'Skipping size check while sync is degraded', autosaveEventDetail({ runId, reason: 'degraded_mode' }));
            }
            log('Updating existing project (no PDF)...');
            const useRawForManual = consecutiveAutoSaveFailures >= 3;
            saveDebugLog('manual.save.request.start', { runId, op: 'projects.update', phase: 'no_pdf_in_save', projectId: state.currentProjectId, timeoutMs: 30000, attempt: manualSaveAttempt, raw: useRawForManual });
            const t3 = Date.now();
            const updatePayload = { name, data, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count, updated_at: new Date().toISOString() };
            if (state.checkedOutBy === user.id) updatePayload.checked_out_at = new Date().toISOString();
            if (useRawForManual) {
              try {
                await withTimeout((signal) => rawProjectsUpdate(state.currentProjectId, updatePayload, signal), 30000, 'Update project');
                pushSaveEvent('manual_save_via_raw_fetch_ok', 'Raw-fetch manual save succeeded', autosaveEventDetail({ runId, ms: Date.now() - t3 }));
                if (consecutiveAutoSaveFailures > 0 && !clientRecycleInFlight) {
                  runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
                }
              } catch (rawErr) {
                pushSaveEvent('manual_save_via_raw_fetch_err', 'Raw-fetch manual save failed', autosaveEventDetail({ runId, ms: Date.now() - t3, message: rawErr?.message, status: rawErr?.status, diag: rawErr?.diag }));
                throw rawErr;
              }
            } else {
              let mErr = null;
              try {
                const { error } = await withTimeout((signal) => supabase.from('projects').update(updatePayload).eq('id', state.currentProjectId).abortSignal(signal), 30000, 'Update project');
                log('Update done', { duration: Date.now() - t3 + 'ms', error: error?.message });
                mErr = error || null;
              } catch (timeoutOrThrow) {
                mErr = timeoutOrThrow;
              }
              if (mErr) {
                noteSupabaseJsFailure('manual_save.projects.update', mErr);
                throw mErr;
              }
            }
            saveDebugLog('manual.save.request.ok', { runId, op: 'projects.update', phase: 'no_pdf_in_save', ms: Date.now() - t3, projectId: state.currentProjectId, raw: useRawForManual });
          } else {
            setProgress('Uploading project...');
            await tick();
            log('Inserting project (no PDF)...');
            saveDebugLog('manual.save.request.start', { runId, op: 'projects.insert', phase: 'no_pdf', timeoutMs: 60000, attempt: manualSaveAttempt, raw: true });
            const t4 = Date.now();
            const insertPayloadNoPdf = { user_id: user.id, name, data, size_bytes: dataSize, counter_count: counts.counter_count, line_count: counts.line_count };
            const { data: row, error } = await withTimeout((signal) => rawProjectsInsert(insertPayloadNoPdf, signal), 60000, 'Save project');
            log('Insert done', { duration: Date.now() - t4 + 'ms', error: error?.message, projectId: row?.id });
            if (error) {
              pushSaveEvent('manual_save_via_raw_fetch_err', 'Raw-fetch project insert (no PDF) failed', autosaveEventDetail({ runId, ms: Date.now() - t4, message: error.message, status: error.status, code: error.code, phase: 'no_pdf', diag: error.diag }));
              throw error;
            }
            pushSaveEvent('manual_save_via_raw_fetch_ok', 'Raw-fetch project insert (no PDF) succeeded', autosaveEventDetail({ runId, ms: Date.now() - t4, projectId: row?.id, phase: 'no_pdf' }));
            if (consecutiveAutoSaveFailures > 0 && !clientRecycleInFlight) {
              runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
            }
            saveDebugLog('manual.save.request.ok', { runId, op: 'projects.insert', phase: 'no_pdf', ms: Date.now() - t4, projectId: row?.id, raw: true });
            const projectId = row?.id;
            if (!projectId) throw new Error('Project was created but no ID was returned. Please try again.');
            state.currentProjectId = projectId;
            try { clearCheckoutExpiredAttention(); } catch (_) {}
            subscribeToProjectCheckoutChanges(projectId);
            state.projectOwnerId = user.id;
            state.loadedViaViewLink = false;
            state.isViewer = false;
            state.canCheckOut = true;
            state.checkedOutBy = null;
            state.checkedOutAt = null;
            state.checkedOutEmail = null;
          }
          if (pendingNewProjectHydration && !state.currentProjectId) {
            const h = pendingNewProjectHydration;
            state.currentProjectId = h.projectId;
            try { clearCheckoutExpiredAttention(); } catch (_) {}
            subscribeToProjectCheckoutChanges(h.projectId);
            state.projectOwnerId = h.userId;
            state.loadedViaViewLink = false;
            state.isViewer = false;
            state.canCheckOut = true;
            state.checkedOutBy = null;
            state.checkedOutAt = null;
            state.checkedOutEmail = null;
          }
          orphanProjectIdForCleanup = null;
          pendingNewProjectHydration = null;
          break manualSaveLoop;
        } catch (innerErr) {
          if (manualSaveAttempt === 0 && originalProjectId && isTransientSaveError(innerErr)) {
            saveDebugLog('manual.save.retry', { runId, message: innerErr?.message });
            pushSaveEvent('manual_save_retry', 'Transient save error, retrying once', innerErr?.message || '');
            manualSaveAttempt++;
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          throw innerErr;
        }
      }
      state.currentProjectName = name;
      if (willUploadPdf && pdfToUpload && state.currentProjectId && cachePdfHash) {
        withTimeout(pdfCachePut(state.currentProjectId, new Blob([pdfToUpload]), cachePdfHash), 5000, 'PDF cache put')
          .catch((cacheErr) => {
            saveDebugLog('manual.save.pdf_cache_put_err', { runId, message: cacheErr?.message });
            if (!pdfCacheWarnShown) {
              pdfCacheWarnShown = true;
              pushSaveEvent(
                'manual_save_cache_warn',
                'Local PDF cache failed - recovery from a detached buffer may not work',
                cacheErr?.message || ''
              );
            }
          });
      }
      state.pdfBuffer = null;
      state.pdfBufferSize = 0;
      if (pdfPath) state.pdfStoragePath = pdfPath;
      if (cachePdfHash) state.pdfHash = cachePdfHash;
      if (pdfPath && prevPdfStoragePath && prevPdfStoragePath !== pdfPath) {
        withTimeout(
          supabase.storage.from('pdfs').remove([prevPdfStoragePath]),
          10000,
          'PDF cleanup remove'
        )
          .then((res) => {
            const error = res && res.error;
            if (error) saveDebugLog('manual.save.pdf_cleanup_err', { runId, message: error.message, path: prevPdfStoragePath });
            else       saveDebugLog('manual.save.pdf_cleanup_ok',  { runId, path: prevPdfStoragePath });
          })
          .catch((err) => saveDebugLog('manual.save.pdf_cleanup_err', { runId, message: err?.message, path: prevPdfStoragePath }));
      }
      lastSaveIncludedPdf = willUploadPdf;
      state.lastSavedAt = new Date().toISOString();
      if (SUPABASE_ENABLED && state.currentProjectId && user) {
        try {
          localStorage.setItem('clickcount-last-project', JSON.stringify({
            projectId: state.currentProjectId,
            projectName: state.currentProjectName || 'Untitled',
            pdfStoragePath: state.pdfStoragePath || null,
            pdfHash: state.pdfHash || null,
            userId: user.id
          }));
        } catch (_) {}
      }
      // Graduation cleanup: a projectless session that just became a cloud
      // project leaves a stale anonymous 'local' takeoff backup behind. That
      // 'local' snapshot would otherwise shadow this project at next boot
      // (boot prefers 'local' over clickcount-last-project), so drop it.
      if (!originalProjectId && state.currentProjectId) {
        takeoffBackupDelete('local').catch(() => {});
      }
      log('Save complete');
      saveDebugLog('manual.save.complete', { runId });
      lastCloudSaveAttemptFailed = false;
      autoSaveDirty = (dirtyGeneration !== genAtEntry);
      pushSaveEvent('manual_save_ok', 'Manual save to cloud completed', autosaveEventDetail({ runId, genAtEntry, genNow: dirtyGeneration, stillDirty: autoSaveDirty }));
      saveProgressMessage = '';
      updateUI();
      return { ok: true };
    } catch (e) {
      console.error('[Save] Failed:', e);
      saveDebugLogError(runId, 'manual.save', e);
      log('Save failed', { message: e?.message, details: e?.details, hint: e?.hint });
      window.lastSaveError = e;
      if (orphanProjectIdForCleanup) {
        const orphanId = orphanProjectIdForCleanup;
        try {
          await withTimeout(supabase.from('projects').delete().eq('id', orphanId), 5000, 'Orphan project cleanup');
          pushSaveEvent('manual_save_orphan_cleanup_ok', 'Orphan project row deleted after save failure', JSON.stringify({ projectId: orphanId }));
        } catch (cleanupErr) {
          pushSaveEvent('manual_save_orphan_cleanup_err', 'Orphan project cleanup failed', JSON.stringify({ projectId: orphanId, message: cleanupErr?.message }));
        }
      }
      writeTakeoffBackupToIndexedDB();
      pushSaveEvent('manual_save_err', (e && e.message) || 'Manual save failed', formatSaveStatusErrDetail(e));
      lastCloudSaveAttemptFailed = true;
      autoSaveDirty = wasDirty || (dirtyGeneration !== genAtEntry);
      updateSaveStatusIndicator();
      try { localStorage.setItem('clickcount-save-error', JSON.stringify({ msg: e?.message, details: e?.details, hint: e?.hint, code: e?.code })); } catch (_) {}
      saveProgressMessage = '';
      updateUI();
      return { ok: false, error: e };
    } finally {
      saveInProgress = false;
      savePdfInProgress = false;
      saveProgressMessage = '';
    }
  }

  // One-shot PDF upload: closes the gap where a project has annotations + a
  // local PDF but no cloud storage object (e.g. created via Prepare PDF "Open",
  // then only autosaved). Autosave never uploads the file, so without this the
  // PDF would stay local until a manual Save-with-PDF. This runs from the
  // autosave interval tick and Turn In, but only when there is genuinely a
  // local-only PDF that is reachable (in memory or recoverable from cache),
  // and it stops firing once pdf_path is set.
  let pdfOneShotUploadInFlight = false;
  let pdfOneShotNextAttemptAt = 0;
  async function uploadLocalPdfToCloudIfNeeded(reason, opts) {
    opts = opts || {};
    if (!SUPABASE_ENABLED || !supabase || !state.supabaseSession?.user) return { skipped: true, reason: 'no_supabase' };
    if (!state.currentProjectId) return { skipped: true, reason: 'no_project' };
    if (!state.pages.length) return { skipped: true, reason: 'no_pages' };
    if (state.pdfStoragePath) return { skipped: true, reason: 'already_in_cloud' };
    if (state.isViewer) return { skipped: true, reason: 'viewer' };
    if (suspendAutoSaveUntilCheckout) return { skipped: true, reason: 'suspended' };
    if (saveInProgress) return { skipped: true, reason: 'save_in_progress' };
    if (pdfOneShotUploadInFlight) return { skipped: true, reason: 'in_flight' };
    // Turn In passes ignoreBackoff so an explicit user action is not blocked by
    // a prior background tick's failure backoff window.
    if (!opts.ignoreBackoff && Date.now() < pdfOneShotNextAttemptAt) return { skipped: true, reason: 'backoff' };
    // Large first-PDF uploads still run from the background autosave tick (so a
    // PDF opened via "Open", without an explicit Save/Turn In, still reaches the
    // cloud), but they cannot tight-loop: the pdfOneShotUploadInFlight guard
    // prevents overlapping ticks, the resumable/TUS path resumes rather than
    // restarts, the size-aware timeout avoids premature failure, and a failed
    // large upload backs off PDF_ONESHOT_LARGE_BACKOFF_MS (5 min) rather than 30s.
    const pdfBytesApprox = (state.pdfBuffer && (state.pdfBuffer.byteLength || state.pdfBuffer.length)) || state.pdfBufferSize || 0;
    const isLargePdf = pdfBytesApprox > PDF_RESUMABLE_THRESHOLD_BYTES;
    // Verify a usable PDF buffer is reachable before invoking the cloud save so
    // we don't trip performSaveProjectToCloud's detached-PDF error path (which
    // flips the save-status bell to a failure state). pdf.js detaches the
    // in-memory buffer after rendering, so fall back to the IndexedDB cache.
    let hasUsableBuffer = !!(state.pdfBuffer && (state.pdfBuffer.byteLength || state.pdfBuffer.length || 0) > 0);
    if (!hasUsableBuffer && state.pdfBufferSize > 0 && state.pdfHash) {
      try {
        const cached = await pdfCacheGet(state.currentProjectId, state.pdfHash);
        if (cached && cached.size > 0) hasUsableBuffer = true;
      } catch (_) {}
    }
    if (!hasUsableBuffer) return { skipped: true, reason: 'no_usable_buffer' };
    pdfOneShotUploadInFlight = true;
    pushSaveEvent('pdf_oneshot_upload_start', 'Uploading local PDF to cloud', JSON.stringify({ reason }));
    try {
      const result = await performSaveProjectToCloud({ name: state.currentProjectName || 'Untitled', includePdf: true });
      if (result && result.ok) {
        pushSaveEvent('pdf_oneshot_upload_ok', 'Local PDF uploaded to cloud', JSON.stringify({ reason }));
        pdfOneShotNextAttemptAt = 0;
      } else {
        pdfOneShotNextAttemptAt = Date.now() + (isLargePdf ? PDF_ONESHOT_LARGE_BACKOFF_MS : PDF_ONESHOT_BACKOFF_MS);
        pushSaveEvent('pdf_oneshot_upload_err', 'Local PDF upload failed', JSON.stringify({ reason, message: result?.error?.message, code: result?.error?.code }));
      }
      return result || { ok: false };
    } catch (e) {
      pdfOneShotNextAttemptAt = Date.now() + (isLargePdf ? PDF_ONESHOT_LARGE_BACKOFF_MS : PDF_ONESHOT_BACKOFF_MS);
      pushSaveEvent('pdf_oneshot_upload_err', 'Local PDF upload threw', JSON.stringify({ reason, message: e?.message }));
      return { ok: false, error: e };
    } finally {
      pdfOneShotUploadInFlight = false;
    }
  }

  // SECTION: [sync] Auto-save
  async function performAutoSave(externalRunId) {
    const runId = externalRunId || saveDebugRunId();
    if (!SUPABASE_ENABLED || !supabase || !state.supabaseSession?.user) {
      saveDebugLog('autosave.skip', { runId, reason: 'no_supabase_or_user' });
      return { ok: false, error: null };
    }
    if (saveInProgress) {
      saveDebugLog('autosave.skip', { runId, reason: 'save_in_progress' });
      return { ok: false, error: null };
    }
    if (!state.pages.length && !state.currentProjectId) {
      saveDebugLog('autosave.skip', { runId, reason: 'no_pages_no_project' });
      return { ok: false, error: null };
    }
    if (state.isViewer) {
      saveDebugLog('autosave.skip', { runId, reason: 'viewer' });
      return { ok: false, error: null };
    }
    if (suspendAutoSaveUntilCheckout && externalRunId !== 'checkout_recovered') {
      saveDebugLog('autosave.skip', { runId, reason: 'suspended_pending_recheckout' });
      return { ok: false, error: { code: 'CHECKOUT_EXPIRED' } };
    }
    const user = state.supabaseSession.user;
    if (state.currentProjectId && state.checkedOutBy === user.id && state.checkedOutAt) {
      const checkedAt = new Date(state.checkedOutAt).getTime();
      const ageMs = serverNowMs() - checkedAt;
      if (ageMs > CHECKOUT_INACTIVITY_MS + CHECKOUT_SOFT_GRACE_MS) {
        saveDebugLog('autosave.skip', { runId, reason: 'checkout_expired', ageMs, mode: 'hard_skew' });
        return { ok: false, error: { code: 'CHECKOUT_EXPIRED' } };
      }
      if (ageMs > CHECKOUT_INACTIVITY_MS - CHECKOUT_NEAR_EXPIRY_MS) {
        const probe = await probeCheckoutLock(runId);
        if (probe.expired) {
          saveDebugLog('autosave.skip', { runId, reason: 'checkout_expired', ageMs, mode: 'probe' });
          return { ok: false, error: { code: 'CHECKOUT_EXPIRED' } };
        }
      }
    }
    const t0 = Date.now();
    const genAtEntry = dirtyGeneration;
    autoSaveDirty = false;
    const data = {
      version: 1,
      counters: state.counters,
      lineTypes: state.lineTypes,
      iconNames: state.iconNames || {},
      iconOrder: state.iconOrder || null,
      customIconPaths: getUserCustomIcons(),
      maxZoom: getMaxZoom(),
      groups: state.groups || [],
      legendSettings: state.legendSettings,
      multiplyZoneSettings: state.multiplyZoneSettings,
      showGridOverlay: state.showGridOverlay,
      gridSettings: state.gridSettings,
      pages: state.pages.map((p, i) => ({ index: i, label: p.label, canvases: p.canvases, scale: p.scale, rotation: p.rotation ?? 0 })),
      activeCanvasIdByPage: state.activeCanvasIdByPage || {}
    };
    const counts = getProjectCounts(data);
    const dataSize = JSON.stringify(data).length;
    perfLog('performAutoSave JSON.stringify', Date.now() - t0, { dataSize, pages: state.pages.length });
    const name = state.currentProjectName || 'Untitled';
    saveDebugLog('autosave.payload', {
      runId,
      projectId: state.currentProjectId || null,
      dataSize,
      pages: state.pages.length,
      counter_count: counts.counter_count,
      line_count: counts.line_count,
      willInsert: !state.currentProjectId
    });
    const tTotal = Date.now();
    saveInProgress = true;
    let _resolveAutoSaveInFlight = null;
    inFlightAutoSavePromise = new Promise(r => { _resolveAutoSaveInFlight = r; });
    let storageInfoFailedThisCall = false;
    let storageInfoMs = 0;
    let storageInfoStatus = 'not_run';
    let lastAttemptUsedRawFetch = false;
    let lastAttemptOpMs = 0;
    let lastAttemptPhase = 'init';
    let attempt = 0;
    try {
      pushSaveEvent(
        'autosave_start',
        state.currentProjectId ? 'Autosave: updating project in cloud' : 'Autosave: creating project in cloud',
        autosaveEventDetail({
          runId,
          projectId: state.currentProjectId || null,
          dataSize,
          pages: state.pages.length,
          hasPdfStoragePath: !!state.pdfStoragePath,
          attempt
        })
      );
      while (true) {
        try {
          if (state.currentProjectId) {
            let sizeBytes = dataSize;
            const skipStorageInfoForDegraded = consecutiveAutoSaveFailures > 0;
            if (state.pdfStoragePath && !storageInfoFailedThisCall && !skipStorageInfoForDegraded) {
              const t1 = Date.now();
              try {
                const { data: info } = await withTimeout(supabase.storage.from('pdfs').info(state.pdfStoragePath), STORAGE_INFO_TIMEOUT_MS, 'Storage info');
                storageInfoMs = Date.now() - t1;
                storageInfoStatus = 'ok';
                perfLog('performAutoSave storage.info', storageInfoMs, { path: state.pdfStoragePath });
                const sz = info && (info.metadata?.size ?? info.size);
                if (typeof sz === 'number' && sz >= 0) sizeBytes += sz;
                saveDebugLog('autosave.storage.info.ok', { runId, ms: storageInfoMs, path: state.pdfStoragePath, pdfSizeBytes: typeof sz === 'number' ? sz : null, sizeBytes });
              } catch (se) {
                storageInfoMs = Date.now() - t1;
                storageInfoStatus = 'err';
                storageInfoFailedThisCall = true;
                saveDebugLog('autosave.storage.info.error', { runId, ms: storageInfoMs, message: se?.message, name: se?.name });
                pushSaveEvent('autosave_storage_info_err', 'Storage size check failed', autosaveEventDetail({ runId, ms: storageInfoMs, message: se?.message, name: se?.name, attempt }));
                noteSupabaseJsFailure('autosave.storage.info', se);
              }
            } else if (state.pdfStoragePath) {
              storageInfoStatus = storageInfoFailedThisCall ? 'skipped_failed' : 'skipped_degraded';
              pushSaveEvent('autosave_storage_info_skipped', 'Skipping size check while sync is degraded', autosaveEventDetail({ runId, reason: storageInfoStatus, attempt }));
            }
            const updatePayload = { name, data, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count, updated_at: new Date().toISOString() };
            if (state.checkedOutBy === user.id) updatePayload.checked_out_at = new Date().toISOString();
            const useRawFetch = (consecutiveAutoSaveFailures >= 3) || (attempt > 0 && lastAttemptUsedRawFetch === false && lastAttemptPhase === 'projects.update');
            lastAttemptUsedRawFetch = useRawFetch;
            lastAttemptPhase = 'projects.update';
            saveDebugLog('autosave.request.start', { runId, op: 'projects.update', projectId: state.currentProjectId, timeoutMs: AUTOSAVE_TIMEOUT_MS, attempt, raw: useRawFetch });
            pushSaveEvent('autosave_request_start', useRawFetch ? 'Updating project (raw fetch)' : 'Updating project', autosaveEventDetail({ runId, op: 'projects.update', attempt, raw: useRawFetch }));
            const t3 = Date.now();
            let opErr = null;
            if (useRawFetch) {
              const op = withTimeout((signal) => rawProjectsUpdate(state.currentProjectId, updatePayload, signal), AUTOSAVE_TIMEOUT_MS, 'Update project');
              inFlightAutoSaveController = op.controller;
              try {
                await op;
              } catch (rawErr) {
                opErr = rawErr;
              }
            } else {
              const op = withTimeout((signal) => supabase.from('projects').update(updatePayload).eq('id', state.currentProjectId).abortSignal(signal), AUTOSAVE_TIMEOUT_MS, 'Update project');
              inFlightAutoSaveController = op.controller;
              const { error } = await op;
              opErr = error || null;
            }
            const updMs = Date.now() - t3;
            lastAttemptOpMs = updMs;
            perfLog('performAutoSave projects.update', updMs, { projectId: state.currentProjectId, raw: useRawFetch });
            recordAutosaveLatency(updMs);
            if (opErr) {
              pushSaveEvent('autosave_request_end', useRawFetch ? 'Update failed (raw fetch)' : 'Update failed', autosaveEventDetail({ runId, op: 'projects.update', attempt, raw: useRawFetch, ms: updMs, ok: false, message: opErr?.message, code: opErr?.code, status: opErr?.status }));
              if (useRawFetch) pushSaveEvent('autosave_via_raw_fetch_err', 'Raw-fetch update failed', autosaveEventDetail({ runId, ms: updMs, message: opErr?.message, status: opErr?.status, diag: opErr?.diag }));
              throw opErr;
            }
            pushSaveEvent('autosave_request_end', useRawFetch ? 'Update OK (raw fetch)' : 'Update OK', autosaveEventDetail({ runId, op: 'projects.update', attempt, raw: useRawFetch, ms: updMs, ok: true }));
            if (useRawFetch) {
              pushSaveEvent('autosave_via_raw_fetch_ok', 'Raw-fetch update succeeded', autosaveEventDetail({ runId, ms: updMs }));
              if ((consecutiveAutoSaveFailures > 0 || attempt > 0) && !clientRecycleInFlight) {
                runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
              }
            }
            saveDebugLog('autosave.request.ok', { runId, op: 'projects.update', ms: updMs, projectId: state.currentProjectId, raw: useRawFetch });
          } else {
            let sizeBytes = dataSize;
            if (state.pdfBuffer) {
              sizeBytes += state.pdfBuffer.byteLength;
            }
            // IMPORTANT: autosave never uploads the PDF file. We must NOT record
            // pdf_hash here. Doing so would poison the row — the cloud would claim
            // a PDF (pdf_hash set) while no storage object exists (pdf_path null),
            // and the manual-save hash-skip would then skip the upload forever,
            // leaving the project permanently without its PDF. pdf_hash is only
            // written once the file is actually uploaded (performSaveProjectToCloud).
            const insertData = { user_id: user.id, name, data, size_bytes: sizeBytes, pdf_path: null, counter_count: counts.counter_count, line_count: counts.line_count };
            lastAttemptPhase = 'projects.insert';
            lastAttemptUsedRawFetch = true;
            saveDebugLog('autosave.request.start', { runId, op: 'projects.insert', timeoutMs: 60000, hasPdfHash: false, attempt, raw: true });
            pushSaveEvent('autosave_request_start', 'Creating project (raw fetch)', autosaveEventDetail({ runId, op: 'projects.insert', attempt, raw: true }));
            const t4 = Date.now();
            const insertOp = withTimeout((signal) => rawProjectsInsert(insertData, signal), 60000, 'Save project');
            inFlightAutoSaveController = insertOp.controller;
            const { data: row, error } = await insertOp;
            const insMs = Date.now() - t4;
            lastAttemptOpMs = insMs;
            perfLog('performAutoSave projects.insert', insMs, { dataSize, raw: true });
            if (error) {
              pushSaveEvent('autosave_request_end', 'Create failed (raw fetch)', autosaveEventDetail({ runId, op: 'projects.insert', attempt, ms: insMs, ok: false, raw: true, message: error?.message, code: error?.code, status: error?.status }));
              pushSaveEvent('autosave_via_raw_fetch_err', 'Raw-fetch autosave insert failed', autosaveEventDetail({ runId, ms: insMs, message: error?.message, status: error?.status, code: error?.code, diag: error?.diag }));
              throw error;
            }
            const projectId = row?.id;
            if (!projectId) throw new Error('Project created but no ID returned');
            state.currentProjectId = projectId;
            // Graduation cleanup: this branch only runs when there was no
            // currentProjectId, so the session just became a cloud project.
            // Drop the now-stale anonymous 'local' takeoff backup so it can't
            // shadow this project at next boot.
            takeoffBackupDelete('local').catch(() => {});
            try { clearCheckoutExpiredAttention(); } catch (_) {}
            subscribeToProjectCheckoutChanges(projectId);
            state.projectOwnerId = user.id;
            state.loadedViaViewLink = false;
            state.isViewer = false;
            state.canCheckOut = true;
            state.checkedOutBy = null;
            state.checkedOutAt = null;
            state.checkedOutEmail = null;
            state.currentProjectName = name;
            pushSaveEvent('autosave_request_end', 'Create OK (raw fetch)', autosaveEventDetail({ runId, op: 'projects.insert', attempt, ms: insMs, ok: true, raw: true, projectId }));
            pushSaveEvent('autosave_via_raw_fetch_ok', 'Raw-fetch autosave insert succeeded', autosaveEventDetail({ runId, ms: insMs, projectId }));
            if (consecutiveAutoSaveFailures > 0 && !clientRecycleInFlight) {
              runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
            }
            saveDebugLog('autosave.request.ok', { runId, op: 'projects.insert', ms: insMs, projectId: state.currentProjectId, raw: true });
          }
          break;
        } catch (innerErr) {
          if (!lastAttemptUsedRawFetch && lastAttemptPhase !== 'init') {
            noteSupabaseJsFailure('autosave.' + lastAttemptPhase, innerErr);
          }
          if (attempt === 0 && isTransientSaveError(innerErr)) {
            saveDebugLog('autosave.retry', { runId, message: innerErr?.message });
            pushSaveEvent('autosave_retry', 'Transient autosave error, retrying once', autosaveEventDetail({ runId, attempt, message: innerErr?.message }));
            attempt++;
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          throw innerErr;
        }
      }
      lastSaveIncludedPdf = !!state.pdfStoragePath;
      state.lastSavedAt = new Date().toISOString();
      if (state.currentProjectId && state.supabaseSession?.user) {
        try {
          localStorage.setItem('clickcount-last-project', JSON.stringify({
            projectId: state.currentProjectId,
            projectName: state.currentProjectName || 'Untitled',
            pdfStoragePath: state.pdfStoragePath || null,
            pdfHash: state.pdfHash || null,
            userId: state.supabaseSession.user.id
          }));
        } catch (_) {}
      }
      updateUI();
      perfLog('performAutoSave total', Date.now() - tTotal);
      saveDebugLog('autosave.complete', { runId, totalMs: Date.now() - tTotal });
      maybeLogProjectSaveEvent(state.currentProjectId);
      lastCloudSaveAttemptFailed = false;
      autoSaveDirty = (dirtyGeneration !== genAtEntry);
      if (!autoSaveDirty) dirtyStartedAt = 0;
      pushSaveEvent('autosave_ok', state.currentProjectId ? 'Canvas synced with cloud (update)' : 'Canvas synced with cloud (new project)', autosaveEventDetail({ runId, totalMs: Date.now() - tTotal, attempts: attempt + 1, usedRawFetch: lastAttemptUsedRawFetch, genAtEntry, genNow: dirtyGeneration }));
      autoSaveAbortReason = null;
      noteAutoSaveOutcome(true, null);
      return { ok: true };
    } catch (e) {
      if (autoSaveAbortReason) {
        const reason = autoSaveAbortReason;
        autoSaveAbortReason = null;
        autoSaveDirty = true;
        saveDebugLog('autosave.aborted', { runId, reason, message: e?.message });
        return { ok: false, error: null };
      }
      console.error('[Auto-save] Failed:', e);
      saveDebugLogError(runId, 'autosave.request', e);
      window.lastSaveError = e;
      autoSaveDirty = true;
      writeTakeoffBackupToIndexedDB();
      lastCloudSaveAttemptFailed = true;
      const elapsedMs = Date.now() - tTotal;
      pushSaveEvent(
        'autosave_err',
        (e && e.message) || 'Autosave failed',
        autosaveEventDetail(Object.assign(
          serializeSaveError(e),
          {
            runId,
            elapsedMs,
            attempt,
            phase: lastAttemptPhase,
            usedRawFetch: lastAttemptUsedRawFetch,
            opMs: lastAttemptOpMs,
            storageInfoStatus,
            storageInfoMs
          }
        ))
      );
      noteAutoSaveOutcome(false, e);
      return { ok: false, error: e };
    } finally {
      saveInProgress = false;
      inFlightAutoSaveController = null;
      try { if (_resolveAutoSaveInFlight) _resolveAutoSaveInFlight(); } catch (_) {}
      inFlightAutoSavePromise = null;
    }
  }

  let takeoffBackupWriteInFlight = null;
  // SECTION: [sync] Local backup (IndexedDB takeoff state)
  async function writeTakeoffStateBackup() {
    if (!state.pages.length && !state.counters.length && !state.lineTypes.length) return;
    // If an in-flight write exists, wait for it to finish then start a fresh write so
    // the latest state is captured (critical for doTurnIn / preparePdf commit paths).
    if (takeoffBackupWriteInFlight) {
      try { await takeoffBackupWriteInFlight; } catch (_) {}
    }
    try {
      await writeTakeoffBackupToIndexedDB();
    } catch (_) {}
  }

  async function writeTakeoffBackupToIndexedDB() {
    if (!BACKUP_PDF_TO_INDEXEDDB) return;
    if (!state.pages.length && !state.counters.length && !state.lineTypes.length) return;
    if (takeoffBackupWriteInFlight) {
      try { saveDebugLog('takeoff_backup_skip_inflight', {}); } catch (_) {}
      return takeoffBackupWriteInFlight;
    }
    let resolveInFlight;
    takeoffBackupWriteInFlight = new Promise((res) => { resolveInFlight = res; });
    try {
      return await doWriteTakeoffBackupToIndexedDB();
    } finally {
      const p = takeoffBackupWriteInFlight;
      takeoffBackupWriteInFlight = null;
      try { resolveInFlight && resolveInFlight(); } catch (_) {}
      void p;
    }
  }

  async function doWriteTakeoffBackupToIndexedDB() {
    let projectId = state.currentProjectId || 'local';
    let pdfBlob = state.pdfBuffer && (state.pdfBuffer.byteLength || state.pdfBuffer.length || 0) > 0
      ? new Blob([state.pdfBuffer], { type: 'application/pdf' }) : null;
    if (!pdfBlob) {
      let cacheProjectId = state.currentProjectId;
      let cachePdfHash = state.pdfHash;
      if (!cacheProjectId || !cachePdfHash) {
        try {
          const last = JSON.parse(localStorage.getItem('clickcount-last-project') || 'null');
          if (last && last.userId === state.supabaseSession?.user?.id) {
            if (!cacheProjectId) cacheProjectId = last.projectId;
            if (!cachePdfHash) cachePdfHash = last.pdfHash;
            if (!cachePdfHash && cacheProjectId && SUPABASE_ENABLED && supabase) {
              const { data: proj } = await supabase.from('projects').select('pdf_hash').eq('id', cacheProjectId).single();
              if (proj?.pdf_hash) cachePdfHash = proj.pdf_hash;
            }
          }
        } catch (_) {}
      }
      if (cacheProjectId && cachePdfHash) {
        try {
          const cached = await pdfCacheGet(cacheProjectId, cachePdfHash);
          if (cached && cached.size > 0) {
            pdfBlob = cached;
            if (projectId === 'local') projectId = cacheProjectId;
          }
        } catch (_) {}
      }
    }
    const data = {
      counters: state.counters,
      lineTypes: state.lineTypes,
      groups: state.groups || [],
      counterSettings: state.counterSettings,
      lineTypeSettings: state.lineTypeSettings,
      exportSettings: state.exportSettings,
      recentLineColors: state.recentLineColors,
      iconNames: state.iconNames || {},
      iconOrder: state.iconOrder || null,
      customIconPaths: getUserCustomIcons(),
      legendSettings: state.legendSettings,
      multiplyZoneSettings: state.multiplyZoneSettings,
      showGridOverlay: state.showGridOverlay,
      gridSettings: state.gridSettings,
      pageCanvases: state.pages.map(p => p.canvases),
      activeCanvasIdByPage: state.activeCanvasIdByPage || {},
      pageScales: state.pages.map(p => p.scale),
      pageRotations: state.pages.map(p => p.rotation ?? 0)
    };
    const lastMod = (state.currentProjectId && lastModifiedAt) ? lastModifiedAt : Date.now();
    const pdfHash = state.pdfHash || null;
    const projectName = state.currentProjectName || null;
    const userId = state.supabaseSession?.user?.id || null;
    lastLocalBackupOk = false;
    await takeoffBackupPut(projectId, data, pdfBlob, pdfHash, lastMod, projectName, userId);
    lastLocalBackupAt = new Date().toISOString();
    lastLocalBackupOk = true;
  }

  setInterval(() => { writeTakeoffStateBackup(); }, 5000);

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt = Date.now();
        saveDebugLog('visibility.hidden', { autoSaveDirty, hasProject: !!state.currentProjectId });
        writeTakeoffStateBackup();
        if (inFlightAutoSaveController) {
          autoSaveAbortReason = 'hidden';
          try { inFlightAutoSaveController.abort(); } catch (_) {}
          inFlightAutoSaveController = null;
        }
        const userId = state.supabaseSession?.user?.id;
        if (SUPABASE_ENABLED && supabase && userId && state.currentProjectId &&
            state.checkedOutBy === userId && autoSaveDirty && !saveInProgress && !suspendAutoSaveUntilCheckout) {
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
      if (consecutiveAutoSaveFailures > 0) {
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
      if (autoSaveDirty && isSaveDebugEnabled()) saveDebugLog('autosave.suspended', { reason: 'checkout_expired_pending_recheckout' });
      return;
    }
    // Belt-and-suspenders: if this project has a local PDF that never reached
    // cloud storage (e.g. created via Prepare PDF "Open"), upload it. Fire and
    // forget; the helper self-gates (in-flight, backoff, !pdfStoragePath) and
    // stops firing once the upload succeeds. Runs regardless of canvas-dirty
    // state so a failed attempt retries on a later tick.
    uploadLocalPdfToCloudIfNeeded('autosave_tick').catch(() => {});
    if (!autoSaveDirty) return;
    if (dirtyStartedAt && Date.now() - dirtyStartedAt >= DIRTY_SNAPSHOT_THRESHOLD_MS && envelopeSnapshotDirtyStamp < dirtyStartedAt) {
      envelopeSnapshotDirtyStamp = dirtyStartedAt;
      writeSaveLogsSnapshot('dirty_10min').catch(() => {});
    }
    if (Date.now() < nextAutoSaveAttemptAt) {
      if (isSaveDebugEnabled()) saveDebugLog('autosave.skip', { reason: 'backoff', untilInMs: nextAutoSaveAttemptAt - Date.now() });
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
  async function checkoutKeepalive() {
    if (!SUPABASE_ENABLED || !supabase) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      saveDebugLog('keepalive.skip', { reason: 'not_visible' });
      return;
    }
    const userId = state.supabaseSession?.user?.id;
    if (!userId) return;
    if (!state.currentProjectId || state.checkedOutBy !== userId) return;
    if (state.isViewer || suspendAutoSaveUntilCheckout) {
      saveDebugLog('keepalive.skip', { reason: state.isViewer ? 'viewer' : 'suspended' });
      return;
    }
    if (Date.now() - lastCheckoutRefreshAt < CHECKOUT_REFRESH_DEBOUNCE_MS) {
      saveDebugLog('keepalive.skip', { reason: 'debounced' });
      return;
    }
    saveDebugLog('keepalive.tick', { projectId: state.currentProjectId });
    const probe = await probeCheckoutLock();
    if (probe.expired) {
      saveDebugLog('keepalive.expired', {});
      pushSaveEvent('keepalive_expired', CHECKOUT_EXPIRED_SAVE_STATUS_MSG);
      try {
        await handleBackgroundCheckoutExpired('keepalive');
      } catch (e) {
        try {
          pushSaveEvent('background_recovery_threw', 'Background recovery threw unexpectedly',
            JSON.stringify({ trigger: 'keepalive', message: (e && e.message) || String(e), name: e && e.name }));
        } catch (_) {}
      }
    }
  }

  setInterval(checkoutKeepalive, CHECKOUT_KEEPALIVE_MS);

  window.state = state;
  window.makeAnnotations = makeAnnotations;
  window.getAnnotationsForReport = (page) => getActiveAnnotations(page);
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
  App.showLineColorModal = showLineColorModal;
  App.pushRecentColor = pushRecentColor;
  App.setupCreateColorPicker = setupCreateColorPicker;
  App.ensureActiveCanvas = ensureActiveCanvas;
  App.getMaxZoom = getMaxZoom;
  App.getWheelZoomSpeed = getWheelZoomSpeed;
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
  App.sanitizeForFilename = sanitizeForFilename;
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
  App.getSaveStatusLog = () => saveStatusLog;
  App.isCheckoutExpiredAttention = () => checkoutExpiredNeedsAttention;
  App.SUPABASE_URL = SUPABASE_URL;
  App.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  App.updateServerClockFromRpc = updateServerClockFromRpc;
  App.clearCheckoutExpiredAttention = clearCheckoutExpiredAttention;
  // resetAutoRecheckoutCounter is a sloppy-mode block-scoped function hoisted to
  // the IIFE scope at runtime; wrap so the lookup defers to call time.
  App.resetAutoRecheckoutCounter = (projectId) => resetAutoRecheckoutCounter(projectId);
  App.getSupabase = () => supabase;
  App.formatLastSignIn = formatLastSignIn;
  App.formatUserActivityDateTime = formatUserActivityDateTime;
  App.USER_ACTIVITY_ICON_SVG = USER_ACTIVITY_ICON_SVG;
  App.openUserActivityModal = openUserActivityModal;
  App.updateSaveStatusIndicator = updateSaveStatusIndicator;
  App.canUseDevAuth = canUseDevAuth;
  App.deleteProjectAsOwner = deleteProjectAsOwner;
  App.openCopyProjectModalOrPromptSave = openCopyProjectModalOrPromptSave;
  App.hydrateProjectFromCloudRow = hydrateProjectFromCloudRow;
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
  // Prepare PDF modal deps (features/prepare-pdf.js).
  App.assertPdfWithinLimit = assertPdfWithinLimit;
  App.mergePdfBuffers = mergePdfBuffers;
  App.buildTrimmedPdfBuffer = buildTrimmedPdfBuffer;
  App.resetGridOrigin = resetGridOrigin;
  App.writeTakeoffStateBackup = writeTakeoffStateBackup;
  App.downloadPdfBuffer = downloadPdfBuffer;
  App.performSaveProjectToCloud = performSaveProjectToCloud;
  App.isAuthError = isAuthError;
  // NB: the three async, block-scoped load helpers (checkInCurrentProjectIfHeld,
  // resolvePdfBufferForCloudProject, buildPagesFromPdfArrayBufferAndProjectData)
  // are NOT Annex-B hoisted to this scope, so they are published from inside the
  // `if (SUPABASE_ENABLED)` block instead (search "in-block load-helper publish").
  // Setters for engine let-state the load action resets (cannot assign through
  // the registry otherwise).
  App.setAutoSaveDirty = (v) => { autoSaveDirty = v; };
  App.setLastModifiedAt = (v) => { lastModifiedAt = v; };
  App.setLastLocalBackupAt = (v) => { lastLocalBackupAt = v; };
  App.setLastSaveIncludedPdf = (v) => { lastSaveIncludedPdf = v; };
  App.SCALE_MODES = SCALE_MODES;
  App.SCALE_PRESETS = SCALE_PRESETS;
  App.ptDist = ptDist;
  App.parseFraction = parseFraction;
  App.parseRealWorldLength = parseRealWorldLength;
  App.getActiveAnnotations = getActiveAnnotations;
  App.deleteGroup = deleteGroup;
  App.getPageScale = getPageScale;
  App.showSetScaleFirstToast = showSetScaleFirstToast;

  if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.__takeoffBackupGetForTest = takeoffBackupGet;
    window.__takeoffBackupDeleteForTest = takeoffBackupDelete;
    window.__customIconsGetFromIndexedDBForTest = customIconsGetFromIndexedDB;
    window.getUserCustomIcons = getUserCustomIcons;
    window.saveUserCustomIcons = saveUserCustomIcons;
    // isTransientSaveError self-tests now live in save-utils.test.js (node:test).
  }

  // SECTION: View-only mode
  async function initViewOnlyMode(viewToken) {
    const allowedEmail = localStorage.getItem('view:allowed:' + viewToken);
    let email = allowedEmail ? allowedEmail.trim() : '';

    function showViewEmailModal() {
      return new Promise((resolve) => {
        const modal = document.getElementById('viewLinkEmailModal');
        const input = document.getElementById('viewLinkEmailInput');
        const errEl = document.getElementById('viewLinkEmailError');
        const submitBtn = document.getElementById('viewLinkEmailSubmit');
        const cancelBtn = document.getElementById('viewLinkEmailCancel');
        if (!modal || !input) { resolve(null); return; }
        viewLinkEmailResolve = resolve;
        errEl.style.display = 'none';
        input.value = email || '';
        input.focus();
        showModal('viewLinkEmailModal');
        const done = (val) => {
          viewLinkEmailResolve = null;
          hideModal('viewLinkEmailModal');
          resolve(val);
        };
        submitBtn.onclick = () => {
          const val = (input.value || '').trim().toLowerCase();
          if (!val) {
            errEl.textContent = 'Enter your email';
            errEl.style.display = 'block';
            return;
          }
          email = val;
          done(val);
        };
        if (cancelBtn) cancelBtn.onclick = () => done(null);
        input.onkeydown = (e) => { if (e.key === 'Enter') submitBtn.click(); };
      });
    }

    if (!email) {
      await showViewEmailModal();
      if (!email) return;
    }

    const domainMsg = (typeof window.VIEW_LINK_ALLOWED_DOMAINS === 'string' ? window.VIEW_LINK_ALLOWED_DOMAINS : 'clickplumbing.com');

    async function fetchViewProject(useEmail) {
      const res = await fetch(SUPABASE_URL + '/functions/v1/get-view-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: viewToken, email: useEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'domain_restricted') {
          const err = { domainRestricted: true, message: data.message || 'Access restricted to ' + domainMsg };
          throw err;
        }
        if (data.error === 'email_required') {
          throw new Error(data.message || 'Email required');
        }
        throw new Error(data.message || 'Failed to load');
      }
      return data;
    }

    let projectData = null;
    const cachedMeta = await viewCacheGetMeta(viewToken);
    const cachedBlob = cachedMeta ? await viewCacheGet(viewToken, cachedMeta.pdfHash) : null;
    if (cachedBlob && cachedMeta && cachedMeta.data && cachedMeta.projectId) {
      projectData = { projectId: cachedMeta.projectId, name: cachedMeta.name, data: cachedMeta.data, pdfHash: cachedMeta.pdfHash };
    }
    if (!projectData) {
      while (true) {
        try {
          projectData = await fetchViewProject(email);
          localStorage.setItem('view:allowed:' + viewToken, email);
          break;
        } catch (e) {
          if (e && e.domainRestricted) {
            const errEl = document.getElementById('viewLinkEmailError');
            if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
            showModal('viewLinkEmailModal');
            email = await showViewEmailModal();
            if (!email) return;
          } else {
            throw e;
          }
        }
      }
    }

    const d = projectData.data || {};
    let buf;
    if (cachedBlob && cachedMeta && projectData.projectId === cachedMeta.projectId) {
      buf = await cachedBlob.arrayBuffer();
    } else if (projectData.pdfSignedUrl) {
      const pdfRes = await fetch(projectData.pdfSignedUrl);
      if (!pdfRes.ok) throw new Error('Failed to load PDF');
      buf = await pdfRes.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/pdf' });
      viewCachePut(viewToken, blob, projectData.pdfHash || null, { projectId: projectData.projectId, name: projectData.name, data: d });
    } else {
      throw new Error('No PDF available');
    }

    const pdf = await pdfjsLib.getDocument(buf).promise;
    state.pages = [];
    const numPages = pdf.numPages;
    for (let i = 0; i < numPages; i++) {
      const pdfPage = await pdf.getPage(i + 1);
      const label = numPages > 1 ? ('document.pdf — p' + (i + 1)) : 'document.pdf';
      const canvasId = uid();
      state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: makeAnnotations() }], scale: null, rotation: 0 });
      state.activeCanvasIdByPage[i] = canvasId;
    }
    state.counters = Array.isArray(d.counters) ? d.counters : [];
    state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
    state.groups = ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
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
    reconcileOrphanedCountersAndLineTypes();
    state.currentProjectId = projectData.projectId;
    state.currentProjectName = projectData.name || 'Untitled';
    state.pdfStoragePath = null;
    state.pdfBuffer = null;
    state.pdfBufferSize = 0;
    state.pdfHash = projectData.pdfHash || null;
    clearUndoStacks();
    state.loadedViaViewLink = true;
    state.isViewer = true;
    state.canCheckOut = false;
    state.checkedOutBy = null;
    state.checkedOutAt = null;
    state.checkedOutEmail = null;
    state.projectOwnerId = null;
    state.currentPage = 0;
    try { clearCheckoutExpiredAttention(); } catch (_) {}
    document.body.classList.add('has-pdf');
    fitZoom();
    renderPdf();
    updateUI();
  }

  // SECTION: Init / boot
  (async function init() {
    const urlParams = new URLSearchParams(window.location.search || '');
    const viewToken = urlParams.get('t');
    if (viewToken && SUPABASE_ENABLED && SUPABASE_URL) {
      try {
        await initViewOnlyMode(viewToken);
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
        const localBackup = await takeoffBackupGet('local', uid);
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
          const stored = localStorage.getItem('clickcount-last-project');
          if (stored) {
            const last = JSON.parse(stored);
            if (last && last.userId === state.supabaseSession.user.id && last.projectId) {
              const { data: proj, error } = await supabase.from('projects').select('id, name, data, updated_at, pdf_path, pdf_hash, user_id, checked_out_by, checked_out_at').eq('id', last.projectId).single();
              const idbBackup = await takeoffBackupGet(last.projectId, uid);
              const hasIdbPdf = idbBackup && idbBackup.pdfBlob && idbBackup.pdfBlob.size > 0;
              const projectAccessDenied = !!error && (error.code === 'PGRST116' || /no rows|denied|permission|policy/i.test(error.message || ''));
              if (projectAccessDenied) {
                try { pushSaveEvent('last_session_restore_skip_inaccessible', 'Last-session project not accessible to current user', JSON.stringify({ projectId: last.projectId, code: error.code, message: error.message })); } catch (_) {}
                try { localStorage.removeItem('clickcount-last-project'); } catch (_) {}
                try { await takeoffBackupDelete(last.projectId); } catch (_) {}
              } else if ((!error && proj && proj.data) || hasIdbPdf) {
                const projForRestore = proj || (idbBackup ? { id: last.projectId, name: idbBackup.projectName || 'Untitled', data: backupDataToProjFormat(idbBackup.data || {}), updated_at: null, pdf_path: null, pdf_hash: idbBackup.pdfHash, user_id: last.userId, checked_out_by: null, checked_out_at: null } : null);
                const pdfHashForCache = proj?.pdf_hash || last.pdfHash;
                const cachedBlob = pdfHashForCache ? await pdfCacheGet(last.projectId, pdfHashForCache) : null;
                if (cachedBlob || proj?.pdf_path || hasIdbPdf) {
                  pendingLastSessionRestore = { proj: projForRestore, cachedBlob: cachedBlob || null };
                  const msgEl = document.getElementById('lastSessionRestoreMessage');
                  if (msgEl) {
                    const n = (projForRestore.name || 'Untitled').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([-_])/g, '$1\u200B');
                    msgEl.innerHTML = 'You have a project from your last session: <strong>' + n + '</strong>. What would you like to do?';
                  }
                  showModal('lastSessionRestoreModal');
                }
              } else if (error) {
                localStorage.removeItem('clickcount-last-project');
              }
            }
          }
        }
      } catch (_) {}
    }
    updateUI();
  })();
  })();

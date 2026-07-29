/*
 * annotation-model.js — the canvas/annotation data model, extracted from
 * app.js (Tier-2 item 7 of the post-engine map). Classic <script src> loaded
 * AFTER geometry.js + icons.js (it reads bakeFramesMatch / CIRCLE_PATH by
 * bare name) and BEFORE app.js, in the save-engine.js slot.
 *
 * Shape: createAnnotationModel(ctx) — the same seam recipe as
 * createSaveEngine. ctx carries the state accessor and the app hooks the
 * model's appliers need:
 *   getState()            -> the live state object
 *   uid()                 -> id generator
 *   showToast(msg, ms)    -> bake-mismatch warning UI
 *   ensureGroupColors(g)  -> group color normalizer (app-side)
 *   saveUserCustomIcons(a)-> custom icon persister (app-side)
 *   getLineRealWorldLengthFeet(line, pageIdx, isPoly, ann)
 *                         -> per-line real length in feet (app-side scale glue),
 *                            used by the rect count/collect helpers
 * app.js keeps same-named wrappers so every call site, the App registry, and
 * the feature-file contracts stay frozen.
 *
 * The guarded CommonJS footer (inert in the browser) lets
 * annotation-model.test.js require() this under node --test and
 * eslint.config.js derive the app.js lint globals.
 */
function createAnnotationModel(ctx) {
  function makeAnnotations() { return { counterMarkers: {}, polylines: [], quickLines: [], highlights: [], notes: [], multiplyZones: [], scaleZones: [], roomBoxes: [], legend: null }; }

  function getPageCanvases(page) { return page?.canvases ?? []; }
  // pageIdxHint (optional): the page's index when the caller already knows it —
  // skips the O(pages) indexOf, which otherwise makes every all-pages loop over
  // these accessors O(pages²) on large projects. Callers without the index are
  // unchanged (indexOf fallback).
  function getActiveCanvas(page, pageIdxHint) {
    if (!page) return null;
    const canvases = getPageCanvases(page);
    if (!canvases.length) return null;
    const pageIdx = (pageIdxHint != null && ctx.getState().pages?.[pageIdxHint] === page) ? pageIdxHint : ctx.getState().pages?.indexOf(page);
    const activeId = pageIdx >= 0 ? ctx.getState().activeCanvasIdByPage?.[pageIdx] : null;
    const found = activeId ? canvases.find(c => c.id === activeId) : null;
    return found || canvases[0];
  }
  function getActiveAnnotations(page, pageIdxHint) {
    const canvas = getActiveCanvas(page, pageIdxHint);
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
      (ann.roomBoxes || []).forEach(b => { (out.roomBoxes = out.roomBoxes || []).push(b); });
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
      const id = ctx.uid();
      page.canvases = [{ id, name: 'Main', annotations: makeAnnotations() }];
      const pi = ctx.getState().pages?.indexOf(page);
      if (pi >= 0) ctx.getState().activeCanvasIdByPage[pi] = id;
      canvas = page.canvases[0];
    }
    return canvas;
  }
  function migratePageToCanvases(page) {
    if (!page) return;
    if (page.canvases && page.canvases.length) return;
    const ann = page.annotations || makeAnnotations();
    page.canvases = [{ id: ctx.uid(), name: 'Main', annotations: ann }];
    delete page.annotations;
  }
  function pageHasAnyAnnotations(p) {
    return getPageCanvases(p).some(c => {
      const ann = c.annotations || makeAnnotations();
      return (ann.counterMarkers && Object.keys(ann.counterMarkers).length) || (ann.quickLines?.length) || (ann.polylines?.length) || (ann.highlights?.length) || (ann.notes?.length) || (ann.multiplyZones?.length) || (ann.scaleZones?.length) || (ann.roomBoxes?.length);
    });
  }
  function projectHasAnyCanvasMarkup() {
    return Array.isArray(ctx.getState().pages) && ctx.getState().pages.some(pageHasAnyAnnotations);
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
          rotation: (data.pageRotations?.[i] ?? 0),
          bakeFrame: data.pageBakeFrames?.[i] ?? null
        }))
      };
    }
    return data;
  }

  // The frame a page's annotations are baked into: viewport dims at the page's rotation
  // plus the PDF's intrinsic /Rotate. Stamped into saved data so a later load can detect
  // when the loaded PDF would render the page in a different orientation than the marks
  // were placed against ("rotated under the canvas"). See verifyPageBakeFrame.
  function computePageBakeFrame(p) {
    if (!p?.pdfPage) return null;
    try {
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      return { w: Math.round(vp.width), h: Math.round(vp.height), intrinsic: p.pdfPage.rotate ?? 0 };
    } catch (_) { return null; }
  }
  let lastBakeMismatchToastAt = 0;
  // Detect-and-warn (never auto-correct): if the loaded PDF produces a different frame than
  // the marks were baked against, the overlay will be misaligned. Surface it instead of
  // rendering silently wrong. `page.bakeMismatch` feeds the Save Status telemetry.
  function verifyPageBakeFrame(page, savedBakeFrame) {
    if (!savedBakeFrame || !page?.pdfPage) return;
    const cur = computePageBakeFrame(page);
    if (bakeFramesMatch(savedBakeFrame, cur, 1)) { page.bakeMismatch = false; return; }
    page.bakeMismatch = true;
    try { console.warn('[bakeFrame] page orientation mismatch', { saved: savedBakeFrame, current: cur, rotation: page.rotation ?? 0 }); } catch (_) { /* noop */ }
    const now = Date.now();
    if (now - lastBakeMismatchToastAt > 4000) {
      lastBakeMismatchToastAt = now;
      try { ctx.showToast('This view may be misaligned — the PDF differs from when the marks were placed.', 6000); } catch (_) { /* showToast may not be ready */ }
    }
  }

  function applyTakeoffBackupToState(backup) {
    if (!backup) return;
    if (Array.isArray(backup.counters)) ctx.getState().counters = backup.counters;
    if (Array.isArray(backup.lineTypes)) ctx.getState().lineTypes = backup.lineTypes;
    if (Array.isArray(backup.groups)) ctx.getState().groups = ctx.ensureGroupColors(backup.groups);
    if (Array.isArray(backup.rooms)) ctx.getState().rooms = backup.rooms;
    if (backup.iconNames && typeof backup.iconNames === 'object') ctx.getState().iconNames = backup.iconNames;
    if (Array.isArray(backup.iconOrder)) ctx.getState().iconOrder = backup.iconOrder;
    if (Array.isArray(backup.customIconPaths)) ctx.saveUserCustomIcons(backup.customIconPaths);
    if (backup.activeCanvasIdByPage && typeof backup.activeCanvasIdByPage === 'object') ctx.getState().activeCanvasIdByPage = backup.activeCanvasIdByPage;
    if (backup.numberKeyBindings && typeof backup.numberKeyBindings === 'object') ctx.getState().numberKeyBindings = backup.numberKeyBindings;
    if (backup.pageCanvases && Array.isArray(backup.pageCanvases)) {
      backup.pageCanvases.forEach((canvases, i) => {
        if (ctx.getState().pages[i] && Array.isArray(canvases) && canvases.length) ctx.getState().pages[i].canvases = canvases;
      });
    } else if (backup.pageAnnotations && Array.isArray(backup.pageAnnotations)) {
      backup.pageAnnotations.forEach((ann, i) => {
        if (ctx.getState().pages[i]) {
          ctx.getState().pages[i].canvases = [{ id: ctx.uid(), name: 'Main', annotations: ann }];
          delete ctx.getState().pages[i].annotations;
        }
      });
    }
    if (backup.pageScales) backup.pageScales.forEach((s, i) => { if (ctx.getState().pages[i]) ctx.getState().pages[i].scale = s; });
    if (backup.pageRotations) backup.pageRotations.forEach((r, i) => { if (ctx.getState().pages[i]) ctx.getState().pages[i].rotation = r ?? 0; });
    if (backup.pageBakeFrames) backup.pageBakeFrames.forEach((bf, i) => { if (ctx.getState().pages[i]) verifyPageBakeFrame(ctx.getState().pages[i], bf); });
    if (backup.legendSettings) ctx.getState().legendSettings = { ...ctx.getState().legendSettings, ...backup.legendSettings };
    if (backup.multiplyZoneSettings) ctx.getState().multiplyZoneSettings = { ...ctx.getState().multiplyZoneSettings, ...backup.multiplyZoneSettings };
    if (backup.showGridOverlay != null) ctx.getState().showGridOverlay = !!backup.showGridOverlay;
    if (backup.gridSettings) ctx.getState().gridSettings = backup.gridSettings;
  }

  function applyPageAnnotationsFromData(page, p, scaleFallback) {
    if (!page) return;
    if (p.canvases && Array.isArray(p.canvases) && p.canvases.length) {
      page.canvases = p.canvases.map(c => ({
        id: c.id || ctx.uid(),
        name: c.name || 'Main',
        annotations: c.annotations ? {
          counterMarkers: c.annotations.counterMarkers && typeof c.annotations.counterMarkers === 'object' ? c.annotations.counterMarkers : {},
          polylines: Array.isArray(c.annotations.polylines) ? c.annotations.polylines : [],
          quickLines: Array.isArray(c.annotations.quickLines) ? c.annotations.quickLines : [],
          highlights: Array.isArray(c.annotations.highlights) ? c.annotations.highlights : [],
          notes: Array.isArray(c.annotations.notes) ? c.annotations.notes : [],
          multiplyZones: Array.isArray(c.annotations.multiplyZones) ? c.annotations.multiplyZones : [],
          scaleZones: Array.isArray(c.annotations.scaleZones) ? c.annotations.scaleZones : [],
          roomBoxes: Array.isArray(c.annotations.roomBoxes) ? c.annotations.roomBoxes : [],
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
        roomBoxes: Array.isArray(a.roomBoxes) ? a.roomBoxes : [],
        legend: a.legend && typeof a.legend === 'object' ? a.legend : null
      };
      page.canvases = [{ id: ctx.uid(), name: 'Main', annotations: ann }];
      delete page.annotations;
    }
    page.scale = p.scale !== undefined ? p.scale : (scaleFallback ?? null);
    page.rotation = p.rotation ?? 0;
    verifyPageBakeFrame(page, p.bakeFrame);
  }

  function reconcileOrphanedCountersAndLineTypes() {
    if (!ctx.getState().pages || !ctx.getState().pages.length) return;
    ctx.getState().pages.forEach(migratePageToCanvases);
    const counterIds = new Set((ctx.getState().counters || []).map(c => c.id));
    const lineTypeIds = new Set((ctx.getState().lineTypes || []).map(lt => lt.id));
    const roomIds = new Set((ctx.getState().rooms || []).map(r => r.id));
    const orphanCounterIds = new Set();
    const orphanLineTypeIds = new Set();
    const orphanRoomIds = new Set();
    ctx.getState().pages.forEach(p => {
      getPageCanvases(p).forEach(c => {
        const ann = c.annotations || makeAnnotations();
        Object.keys(ann.counterMarkers || {}).forEach(id => { if (!counterIds.has(id)) orphanCounterIds.add(id); });
        (ann.quickLines || []).forEach(q => { if (q.lineTypeId && !lineTypeIds.has(q.lineTypeId)) orphanLineTypeIds.add(q.lineTypeId); });
        (ann.polylines || []).forEach(poly => { if (poly.lineTypeId && !lineTypeIds.has(poly.lineTypeId)) orphanLineTypeIds.add(poly.lineTypeId); });
        (ann.roomBoxes || []).forEach(b => { if (b.roomId && !roomIds.has(b.roomId)) orphanRoomIds.add(b.roomId); });
      });
    });
    if (orphanCounterIds.size > 0) {
      ctx.getState().counters = ctx.getState().counters || [];
      orphanCounterIds.forEach(id => {
        if (!ctx.getState().counters.some(c => c.id === id)) {
          ctx.getState().counters.push({ id, name: 'Unknown', icon: CIRCLE_PATH, color: '#e8c547' });
        }
      });
    }
    if (orphanLineTypeIds.size > 0) {
      ctx.getState().lineTypes = ctx.getState().lineTypes || [];
      orphanLineTypeIds.forEach(id => {
        if (!ctx.getState().lineTypes.some(lt => lt.id === id)) {
          ctx.getState().lineTypes.push({ id, name: 'Unknown', color: '#4a9eff', curveStyle: 'straight' });
        }
      });
    }
    if (orphanRoomIds.size > 0) {
      ctx.getState().rooms = ctx.getState().rooms || [];
      orphanRoomIds.forEach(id => {
        if (!ctx.getState().rooms.some(r => r.id === id)) {
          ctx.getState().rooms.push({ id, name: 'Unknown room', color: '#47c88e' });
        }
      });
    }
  }

  // --- Rect-select operations (Multiply Zone preview + Delete Area) ---------
  // Hit semantics: lines count only when BOTH endpoints are inside the rect;
  // zones/highlights/room boxes hit on their center point; notes on their
  // anchor. pointInRect is a geometry.js global.
  function countItemsInRect(ann, pageIdx, x1, y1, x2, y2) {
    let counterCount = 0, lineRunCount = 0, lengthRealSum = 0;
    const inRect = (p) => pointInRect(p, x1, y1, x2, y2);
    (ctx.getState().counters || []).forEach(c => {
      (ann?.counterMarkers?.[c.id] || []).forEach(m => { if (inRect(m)) counterCount++; });
    });
    (ann?.quickLines || []).forEach(q => {
      const start = { x: q.x1, y: q.y1 }, end = { x: q.x2, y: q.y2 };
      if (inRect(start) && inRect(end)) { lineRunCount++; lengthRealSum += ctx.getLineRealWorldLengthFeet(q, pageIdx, false, ann); }
    });
    (ann?.polylines || []).forEach(poly => {
      const pts = poly.points || [];
      const start = pts[0], end = pts[pts.length - 1];
      if (start && end && inRect(start) && inRect(end)) { lineRunCount++; lengthRealSum += ctx.getLineRealWorldLengthFeet(poly, pageIdx, true, ann); }
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
    (ctx.getState().counters || []).forEach(c => {
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
        result.lengthRealSum += ctx.getLineRealWorldLengthFeet(q, pageIdx, false, ann);
        result.quickLines.push({ index: i, line: q });
      }
    });
    (ann?.polylines || []).forEach((poly, i) => {
      const pts = poly.points || [];
      const start = pts[0], end = pts[pts.length - 1];
      if (start && end && inRect(start) && inRect(end)) {
        result.lineRunCount++;
        result.lengthRealSum += ctx.getLineRealWorldLengthFeet(poly, pageIdx, true, ann);
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
  // The splice core of Delete Area. Descending-index order is load-bearing:
  // ascending splices would shift the later indices and delete wrong items.
  // The UI choreography (undo snapshot, dirty, re-render) stays app-side in
  // the performDeleteZone wrapper.
  function deleteCollectedItems(ann, collected) {
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
  }

  // --- Page-rotation math (rotatePoint90CW is a geometry.js global) ---------
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

  return {
    makeAnnotations,
    getPageCanvases,
    getActiveCanvas,
    getActiveAnnotations,
    mergeAnnotations,
    getMergedAnnotationsForPage,
    ensureActiveCanvas,
    migratePageToCanvases,
    pageHasAnyAnnotations,
    projectHasAnyCanvasMarkup,
    backupDataToProjFormat,
    computePageBakeFrame,
    verifyPageBakeFrame,
    applyTakeoffBackupToState,
    applyPageAnnotationsFromData,
    reconcileOrphanedCountersAndLineTypes,
    countItemsInRect,
    collectItemsToDeleteInRect,
    deleteCollectedItems,
    rotateAnnotations,
    applyRotationDeltaToAnnotations,
    deepCopyAnnotations,
  };
}


/*
 * The undo/redo stack — annotation-data snapshots over the same state seam.
 * ctx: getState, uid, ensureGroupColors (snapshot restore) + markProjectDirty,
 * renderPdf, updateUI (the undo/redo commit hooks).
 */
function createUndoStack(ctx) {
  let undoStack = [];
  let redoStack = [];

  // getProjectCounts(data) lives in save-utils.js (loaded before this IIFE).

  function getUndoableSnapshot() {
    return {
      pages: ctx.getState().pages.map(p => ({
        canvases: JSON.parse(JSON.stringify(p.canvases || [])),
        scale: p.scale ? { ...p.scale } : null,
        rotation: p.rotation ?? 0,
        label: p.label
      })),
      counters: JSON.parse(JSON.stringify(ctx.getState().counters)),
      lineTypes: JSON.parse(JSON.stringify(ctx.getState().lineTypes)),
      groups: JSON.parse(JSON.stringify(ctx.getState().groups || [])),
      rooms: JSON.parse(JSON.stringify(ctx.getState().rooms || []))
    };
  }

  function pushUndoSnapshot() {
    if (ctx.getState().isViewer || !ctx.getState().pages.length) return;
    undoStack.push(getUndoableSnapshot());
    if (undoStack.length > UNDO_STACK_SIZE) undoStack.shift();
    redoStack = [];
  }

  // Page-scoped snapshot for the HIGH-FREQUENCY page-local mutations (placing
  // counters/lines/highlights, drops, notes): deep-copies ONE page + the small
  // palettes instead of every page's annotations — O(current page), not
  // O(project), which is what made rapid placement pay a hidden per-click tax
  // on large projects. Cascade operations (group/room deletes, rotations of
  // other pages, imports) MUST keep using the full pushUndoSnapshot.
  function getPageSnapshot(pageIdx) {
    const state = ctx.getState();
    const p = state.pages[pageIdx];
    return {
      scope: 'page',
      pageIdx,
      page: p ? {
        canvases: JSON.parse(JSON.stringify(p.canvases || [])),
        scale: p.scale ? { ...p.scale } : null,
        rotation: p.rotation ?? 0,
        label: p.label
      } : null,
      counters: JSON.parse(JSON.stringify(state.counters)),
      lineTypes: JSON.parse(JSON.stringify(state.lineTypes)),
      groups: JSON.parse(JSON.stringify(state.groups || [])),
      rooms: JSON.parse(JSON.stringify(state.rooms || []))
    };
  }
  function pushUndoSnapshotPage(pageIdx) {
    if (ctx.getState().isViewer || !ctx.getState().pages.length) return;
    undoStack.push(getPageSnapshot(pageIdx));
    if (undoStack.length > UNDO_STACK_SIZE) undoStack.shift();
    redoStack = [];
  }

  function applySnapshot(snap) {
    if (snap.scope === 'page') {
      const p = ctx.getState().pages[snap.pageIdx];
      if (p && snap.page) {
        p.canvases = snap.page.canvases;
        p.scale = snap.page.scale;
        p.rotation = snap.page.rotation ?? 0;
        if (snap.page.label != null) p.label = snap.page.label;
      }
      applySharedSnapshotTail(snap);
      return;
    }
    ctx.getState().pages.forEach((p, i) => {
      if (snap.pages[i]) {
        if (Array.isArray(snap.pages[i].canvases)) p.canvases = snap.pages[i].canvases;
        else if (snap.pages[i].annotations) { p.canvases = [{ id: ctx.uid(), name: 'Main', annotations: snap.pages[i].annotations }]; }
        p.scale = snap.pages[i].scale;
        p.rotation = snap.pages[i].rotation ?? 0;
        if (snap.pages[i].label != null) p.label = snap.pages[i].label;
      }
    });
    applySharedSnapshotTail(snap);
  }

  function applySharedSnapshotTail(snap) {
    ctx.getState().counters = snap.counters;
    ctx.getState().lineTypes = snap.lineTypes;
    if (Array.isArray(snap.groups)) ctx.getState().groups = ctx.ensureGroupColors(snap.groups);
    if (Array.isArray(snap.rooms)) ctx.getState().rooms = snap.rooms;
    ctx.getState().quickLineStart = null;
    ctx.getState().highlightStart = null;
    ctx.getState().multiplyZoneStart = null;
    ctx.getState().scaleZoneStart = null;
    ctx.getState().deleteZoneStart = null;
    ctx.getState().roomBoxStart = null;
    ctx.getState().drawingPolyline = null;
    ctx.getState().editingPolyline = null;
    if (ctx.getState().activeCounterType && !ctx.getState().counters.some(c => c.id === ctx.getState().activeCounterType)) ctx.getState().activeCounterType = null;
    if (ctx.getState().activeLineTypeId && !ctx.getState().lineTypes.some(lt => lt.id === ctx.getState().activeLineTypeId)) ctx.getState().activeLineTypeId = null;
  }

  function undo() {
    if (undoStack.length === 0 || ctx.getState().isViewer) return;
    const prev = undoStack.pop();
    redoStack.push(prev.scope === 'page' ? getPageSnapshot(prev.pageIdx) : getUndoableSnapshot());
    applySnapshot(prev);
    ctx.markProjectDirty();
    ctx.renderPdf();
    ctx.updateUI();
  }

  function redo() {
    if (redoStack.length === 0 || ctx.getState().isViewer) return;
    const next = redoStack.pop();
    undoStack.push(next.scope === 'page' ? getPageSnapshot(next.pageIdx) : getUndoableSnapshot());
    applySnapshot(next);
    ctx.markProjectDirty();
    ctx.renderPdf();
    ctx.updateUI();
  }

  function clearUndoStacks() {
    undoStack = [];
    redoStack = [];
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }
  return { getUndoableSnapshot, pushUndoSnapshot,
    pushUndoSnapshotPage, applySnapshot, undo, redo, clearUndoStacks, canUndo, canRedo };
}

// Dual-environment export (inert in the browser) for node --test + eslint.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createAnnotationModel, createUndoStack };
}

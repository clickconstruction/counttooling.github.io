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
 * app.js keeps same-named wrappers so every call site, the App registry, and
 * the feature-file contracts stay frozen.
 *
 * The guarded CommonJS footer (inert in the browser) lets
 * annotation-model.test.js require() this under node --test and
 * eslint.config.js derive the app.js lint globals.
 */
function createAnnotationModel(ctx) {
  function makeAnnotations() { return { counterMarkers: {}, polylines: [], quickLines: [], highlights: [], notes: [], multiplyZones: [], scaleZones: [], legend: null }; }

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
      return (ann.counterMarkers && Object.keys(ann.counterMarkers).length) || (ann.quickLines?.length) || (ann.polylines?.length) || (ann.highlights?.length) || (ann.notes?.length) || (ann.multiplyZones?.length) || (ann.scaleZones?.length);
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
    if (backup.iconNames && typeof backup.iconNames === 'object') ctx.getState().iconNames = backup.iconNames;
    if (Array.isArray(backup.iconOrder)) ctx.getState().iconOrder = backup.iconOrder;
    if (Array.isArray(backup.customIconPaths)) ctx.saveUserCustomIcons(backup.customIconPaths);
    if (backup.activeCanvasIdByPage && typeof backup.activeCanvasIdByPage === 'object') ctx.getState().activeCanvasIdByPage = backup.activeCanvasIdByPage;
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
    const orphanCounterIds = new Set();
    const orphanLineTypeIds = new Set();
    ctx.getState().pages.forEach(p => {
      getPageCanvases(p).forEach(c => {
        const ann = c.annotations || makeAnnotations();
        Object.keys(ann.counterMarkers || {}).forEach(id => { if (!counterIds.has(id)) orphanCounterIds.add(id); });
        (ann.quickLines || []).forEach(q => { if (q.lineTypeId && !lineTypeIds.has(q.lineTypeId)) orphanLineTypeIds.add(q.lineTypeId); });
        (ann.polylines || []).forEach(poly => { if (poly.lineTypeId && !lineTypeIds.has(poly.lineTypeId)) orphanLineTypeIds.add(poly.lineTypeId); });
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
  };
}

// Dual-environment export (inert in the browser) for node --test + eslint.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createAnnotationModel };
}

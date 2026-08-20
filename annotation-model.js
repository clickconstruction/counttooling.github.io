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
// Collapse same-id palette entries (counters or line types) into one. Marks
// are stored under counterMarkers[id] / line.lineTypeId, so N palette entries
// sharing one id all claim the same placed marks and every total counts them
// N times (the Wendi FD bug, 2026-08-13: Palette Insights' name-keyed merge
// re-appended each RENAME of a counter with its original id). Keeps the FIRST
// occurrence's position and the LAST occurrence's fields (newest rename wins).
// Pure; safe on any array — entries without an id pass through untouched.
function dedupePaletteById(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  const out = [];
  list.forEach(item => {
    const id = item && item.id;
    if (id == null) { out.push(item); return; }
    if (byId.has(id)) Object.assign(byId.get(id), item);
    else { const copy = { ...item }; byId.set(id, copy); out.push(copy); }
  });
  return out;
}

// --- Drop nodes (the Drop tool's model) -------------------------------------
//
// A drop is stored on a LINE END (line.startDrop / line.endDrop), but on the
// plan it belongs to a POINT: chain runs, and any two runs traced end-to-end,
// leave two line ends stacked on the same spot. The Drop tool clicks points,
// so it needs the point view — and the collapse is load-bearing, not cosmetic:
// writing a drop to both of a shared point's ends would add the vertical
// footage to the takeoff TWICE, which is the failure that loses trust in the
// number. So coincident ends become ONE node, and every write goes to exactly
// one of its refs while the rest are zeroed.
//
// Returns [{ x, y, refs: [{ kind: 'quick'|'poly', index, end: 'start'|'end' }],
//            value, unit }] in PDF-space. `value`/`unit` report the node's
// current drop — the first ref carrying a positive one. Pure.
function collectDropNodes(ann, tol) {
  const t = typeof tol === 'number' && tol > 0 ? tol : 1;
  const nodes = [];
  const add = (x, y, ref, drop, unit) => {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    let node = null;
    for (let i = 0; i < nodes.length; i++) {
      const dx = nodes[i].x - x, dy = nodes[i].y - y;
      if (dx * dx + dy * dy <= t * t) { node = nodes[i]; break; }
    }
    if (!node) { node = { x, y, refs: [], value: 0, unit: null }; nodes.push(node); }
    node.refs.push(ref);
    if (!(node.value > 0) && drop > 0) { node.value = drop; node.unit = unit || null; }
  };
  (ann?.quickLines || []).forEach((q, index) => {
    add(q.x1, q.y1, { kind: 'quick', index, end: 'start' }, q.startDrop || 0, q.startDropUnit);
    add(q.x2, q.y2, { kind: 'quick', index, end: 'end' }, q.endDrop || 0, q.endDropUnit);
  });
  (ann?.polylines || []).forEach((poly, index) => {
    const pts = poly.points || [];
    if (pts.length < 2) return;
    add(pts[0].x, pts[0].y, { kind: 'poly', index, end: 'start' }, poly.startDrop || 0, poly.startDropUnit);
    const last = pts[pts.length - 1];
    add(last.x, last.y, { kind: 'poly', index, end: 'end' }, poly.endDrop || 0, poly.endDropUnit);
  });
  return nodes;
}

// Resolve one ref back to its line object.
function dropRefLine(ann, ref) {
  if (!ann || !ref) return null;
  return ref.kind === 'poly' ? (ann.polylines || [])[ref.index] : (ann.quickLines || [])[ref.index];
}

// Write `value` (in `unit`) to a node: the FIRST ref carries it, every other
// ref at the same point is zeroed, so a shared point contributes its vertical
// footage exactly once. `value` <= 0 clears the node. With `dryRun` true,
// nothing is written — the return value answers "would this change anything?",
// which callers check BEFORE pushing an undo snapshot (the stack has no
// discard API, so a snapshot must only be pushed for a real change). Returns
// true when something changed / would change.
function applyDropToNode(ann, node, value, unit, dryRun) {
  if (!ann || !node || !Array.isArray(node.refs) || !node.refs.length) return false;
  const v = typeof value === 'number' && value > 0 ? value : 0;
  const u = String(unit || 'ft');
  let changed = false;
  node.refs.forEach((ref, i) => {
    const line = dropRefLine(ann, ref);
    if (!line) return;
    const valKey = ref.end === 'start' ? 'startDrop' : 'endDrop';
    const unitKey = valKey + 'Unit';
    const want = i === 0 ? v : 0;
    if ((line[valKey] || 0) !== want) { if (!dryRun) line[valKey] = want; changed = true; }
    if (want > 0 && line[unitKey] !== u) { if (!dryRun) line[unitKey] = u; changed = true; }
  });
  if (changed && !dryRun) { node.value = v; node.unit = v > 0 ? u : null; }
  return changed;
}

function createAnnotationModel(ctx) {
  function makeAnnotations() { return { counterMarkers: {}, polylines: [], quickLines: [], highlights: [], notes: [], multiplyZones: [], scaleZones: [], roomBoxes: [], ghosts: [], legend: null }; }

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
      (ann.ghosts || []).forEach(g => { (out.ghosts = out.ghosts || []).push(g); });
    });
    return out;
  }
  // onlyIds (optional): an ARRAY of canvas ids to include — the selective
  // show-canvases peek. The active canvas is always included regardless of the
  // list; omitted/null means every canvas (the classic show-all merge).
  // Array-gated on purpose: report.js and the export paths pass this function
  // around as a generic (page, pageIdx) annotations getter, so a non-array
  // second argument (the page index) must keep meaning "merge everything".
  function getMergedAnnotationsForPage(page, onlyIds) {
    const canvases = getPageCanvases(page);
    const filter = Array.isArray(onlyIds) ? onlyIds : null;
    const active = filter ? getActiveCanvas(page) : null;
    const use = filter ? canvases.filter(c => c === active || filter.includes(c.id)) : canvases;
    const anns = use.map(c => c.annotations || makeAnnotations());
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
    if (backup.groupsEnabled != null) ctx.getState().groupsEnabled = !!backup.groupsEnabled;
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
    if (backup.scaleZoneSettings) ctx.getState().scaleZoneSettings = { ...ctx.getState().scaleZoneSettings, ...backup.scaleZoneSettings };
    if (backup.showGridOverlay != null) ctx.getState().showGridOverlay = !!backup.showGridOverlay;
    if (backup.gridSettings) ctx.getState().gridSettings = backup.gridSettings;
  }

  // The shared cloud-project hydration block: palettes, icon prefs, per-page
  // annotations, and the per-project view settings. ONE home for the contract
  // — used by the view-link boot (features/view-only.js) and the last-session
  // restore (features/restore-last-session.js), which carried verbatim copies
  // until 2026-07-30; a new persisted field added to one intake could silently
  // drop from the other. Callers construct state.pages first; this fills in
  // everything the project data payload carries.
  function hydrateStateFromProjectData(d) {
    const state = ctx.getState();
    state.counters = Array.isArray(d.counters) ? d.counters : [];
    state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
    state.groups = ctx.ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
    state.groupsEnabled = !!d.groupsEnabled;
    state.rooms = Array.isArray(d.rooms) ? d.rooms : [];
    if (d.iconNames && typeof d.iconNames === 'object') state.iconNames = d.iconNames;
    if (Array.isArray(d.iconOrder)) state.iconOrder = d.iconOrder;
    if (Array.isArray(d.customIconPaths)) ctx.saveUserCustomIcons(d.customIconPaths);
    (d.pages || []).forEach(p => {
      applyPageAnnotationsFromData(state.pages[p.index], p);
    });
    if (d.activeCanvasIdByPage && typeof d.activeCanvasIdByPage === 'object') state.activeCanvasIdByPage = d.activeCanvasIdByPage;
    state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
    if (d.legendSettings) state.legendSettings = { ...state.legendSettings, ...d.legendSettings };
    if (d.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...d.multiplyZoneSettings };
    if (d.scaleZoneSettings) state.scaleZoneSettings = { ...state.scaleZoneSettings, ...d.scaleZoneSettings };
    if (d.showGridOverlay != null) state.showGridOverlay = !!d.showGridOverlay;
    if (d.gridSettings) state.gridSettings = d.gridSettings;
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
          ghosts: Array.isArray(c.annotations.ghosts) ? c.annotations.ghosts : [],
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
        ghosts: Array.isArray(a.ghosts) ? a.ghosts : [],
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
    // Self-heal duplicate-id palettes first (see dedupePaletteById): this
    // reconcile runs at every palette intake (cloud load, import, copy,
    // artboard apply, pdf-intake, canvas repair), so corrupted payloads are
    // collapsed on open and written back clean by the next save.
    ctx.getState().counters = dedupePaletteById(ctx.getState().counters);
    ctx.getState().lineTypes = dedupePaletteById(ctx.getState().lineTypes);
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

  // --- Palette relink (Load-from-Cloud, T1-09) ------------------------------
  // Marks are keyed by palette id, so a wholesale palette replace (Load from
  // Cloud) orphans every placed mark whose trade name survives under a new id.
  // planPaletteRelink maps CURRENT palette ids to INCOMING ids by trimmed
  // case-insensitive name (the exact nameKey convention Palette Insights uses
  // for its "On Artboard" badge) and counts the placed marks each way;
  // applyPaletteRelink rewrites the annotations through those maps. Name
  // matching lives ONLY here — reconcileOrphanedCountersAndLineTypes stays
  // byte-identical for its six other intake paths and remains the backstop
  // that turns any still-unmatched mark into a visible "Unknown" row.
  function paletteNameKey(s) { return String(s || '').trim().toLowerCase(); }
  function planPaletteRelink(incomingCounters, incomingLineTypes) {
    const state = ctx.getState();
    // First incoming match wins on duplicate names (deterministic); identity
    // mappings (oldId === newId) are dropped from the maps but still count as
    // matched — those marks keep counting without a rewrite.
    const buildMap = (current, incoming) => {
      const incomingByName = new Map();
      (incoming || []).forEach(it => {
        const key = paletteNameKey(it.name);
        if (key && !incomingByName.has(key)) incomingByName.set(key, it.id);
      });
      const map = {};
      const matched = new Set();
      (current || []).forEach(it => {
        const key = paletteNameKey(it.name);
        if (!key || !incomingByName.has(key)) return;
        matched.add(it.id);
        const newId = incomingByName.get(key);
        if (newId !== it.id) map[it.id] = newId;
      });
      return { map, matched };
    };
    const c = buildMap(state.counters, incomingCounters);
    const lt = buildMap(state.lineTypes, incomingLineTypes);
    const currentCounterIds = new Set((state.counters || []).map(x => x.id));
    const currentLineTypeIds = new Set((state.lineTypes || []).map(x => x.id));
    let relinkedMarks = 0;
    let orphanedMarks = 0;
    // Marks already orphaned before the load (id not in the current palette)
    // count toward neither bucket — reconcile's Unknown backfill covers them.
    const tallyCounter = (id, n) => {
      if (!n) return;
      if (c.matched.has(id)) relinkedMarks += n;
      else if (currentCounterIds.has(id)) orphanedMarks += n;
    };
    const tallyLine = (id) => {
      if (!id) return;
      if (lt.matched.has(id)) relinkedMarks++;
      else if (currentLineTypeIds.has(id)) orphanedMarks++;
    };
    (state.pages || []).forEach(p => {
      getPageCanvases(p).forEach(cv => {
        const ann = cv.annotations || makeAnnotations();
        Object.entries(ann.counterMarkers || {}).forEach(([id, arr]) => tallyCounter(id, (arr || []).length));
        (ann.quickLines || []).forEach(q => tallyLine(q.lineTypeId));
        (ann.polylines || []).forEach(poly => tallyLine(poly.lineTypeId));
      });
    });
    return { counterIdMap: c.map, lineTypeIdMap: lt.map, relinkedMarks, orphanedMarks };
  }
  // Rewrites annotations in place through the plan's id maps, across every
  // page/canvas. counterMarkers is rebuilt in ONE pass so key renames can
  // never chain (oldA→x while x→y must not double-move oldA's markers);
  // colliding targets MERGE (two same-named old counters relink to one
  // incoming counter — markers concatenate, none are lost). No UI calls —
  // the caller renders.
  function applyPaletteRelink(plan) {
    const counterIdMap = plan?.counterIdMap || {};
    const lineTypeIdMap = plan?.lineTypeIdMap || {};
    const hasCounterMap = Object.keys(counterIdMap).length > 0;
    const hasLineMap = Object.keys(lineTypeIdMap).length > 0;
    if (!hasCounterMap && !hasLineMap) return;
    (ctx.getState().pages || []).forEach(p => {
      getPageCanvases(p).forEach(cv => {
        const ann = cv.annotations;
        if (!ann) return;
        if (hasCounterMap && ann.counterMarkers) {
          const next = {};
          Object.entries(ann.counterMarkers).forEach(([id, arr]) => {
            const target = counterIdMap[id] || id;
            if (next[target]) next[target].push(...(arr || []));
            else next[target] = arr || [];
          });
          ann.counterMarkers = next;
        }
        if (hasLineMap) {
          (ann.quickLines || []).forEach(q => { if (q.lineTypeId && lineTypeIdMap[q.lineTypeId]) q.lineTypeId = lineTypeIdMap[q.lineTypeId]; });
          (ann.polylines || []).forEach(poly => { if (poly.lineTypeId && lineTypeIdMap[poly.lineTypeId]) poly.lineTypeId = lineTypeIdMap[poly.lineTypeId]; });
        }
      });
    });
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
    // A ghost's src is annotation-shaped (counterMarkers / quickLines /
    // polylines in absolute PDF-space), so it rotates through this same
    // walker — that shape choice is why ghosts need no rotation code of
    // their own. Nested ghosts can't exist, so the recursion is one deep.
    (ann.ghosts || []).forEach(g => { if (g && g.src) rotateAnn(g.src); });
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
  // --- Ghosts (reference copies) --------------------------------------------
  // A ghost is a translucent COPY of a batch of marks, kept as scaffolding for
  // repeating a "typical" layout: it is drawn on the plan, dragged around, and
  // never tallied. It is a DISTINCT annotation kind, not real marks carrying an
  // isGhost flag — that way no totals surface (footer, sidebar, Summary, legend,
  // report, Copy to /Tooling, Copy Summary, the PDF legend) can accidentally
  // count one. Nothing reads ann.ghosts except the ghost code and the renderer.
  //
  // Shape: { id, label, showCounters, showLines, src }, where src is
  // annotation-shaped ({ counterMarkers, quickLines, polylines }) and holds
  // ABSOLUTE PDF-space coordinates — no offset vector. Moving a ghost rewrites
  // its points; that keeps page rotation (rotateAnnotations) and bounds honest
  // without a second coordinate convention to reason about.
  function captureGhostFromRect(ann, pageIdx, x1, y1, x2, y2, label) {
    // Same hit semantics as Delete Area / Multiply Zone: counters on their
    // point, lines only when BOTH endpoints are inside the box.
    const collected = collectItemsToDeleteInRect(ann, pageIdx, x1, y1, x2, y2);
    if (!collected.counterCount && !collected.lineRunCount) return null;
    const src = { counterMarkers: {}, quickLines: [], polylines: [] };
    (collected.counters || []).forEach(({ counterId, marker }) => {
      if (!src.counterMarkers[counterId]) src.counterMarkers[counterId] = [];
      src.counterMarkers[counterId].push({ ...marker, id: ctx.uid() });
    });
    (collected.quickLines || []).forEach(({ line }) => {
      src.quickLines.push({ ...JSON.parse(JSON.stringify(line)), id: ctx.uid() });
    });
    (collected.polylines || []).forEach(({ poly }) => {
      src.polylines.push({ ...JSON.parse(JSON.stringify(poly)), id: ctx.uid() });
    });
    return {
      id: ctx.uid(),
      label: label || 'Typical',
      showCounters: true,
      showLines: true,
      src
    };
  }
  // What a ghost would contribute if stamped — also the menu's row counts.
  function ghostCounts(g) {
    let counters = 0;
    Object.values(g?.src?.counterMarkers || {}).forEach(arr => { counters += (arr || []).length; });
    const lines = (g?.src?.quickLines || []).length + (g?.src?.polylines || []).length;
    return { counters, lines };
  }
  // Bounding box over the VISIBLE parts only, so hiding the counters shrinks
  // the drag outline to what is actually on screen. Null when nothing shows.
  function ghostBounds(g) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (p) => {
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    };
    if (g?.showCounters !== false) {
      Object.values(g?.src?.counterMarkers || {}).forEach(arr => (arr || []).forEach(add));
    }
    if (g?.showLines !== false) {
      (g?.src?.quickLines || []).forEach(q => { add({ x: q.x1, y: q.y1 }); add({ x: q.x2, y: q.y2 }); });
      (g?.src?.polylines || []).forEach(p => (p.points || []).forEach(add));
    }
    if (minX === Infinity) return null;
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  }
  // Move the whole batch. Rewrites every point — see the shape note above.
  function translateGhost(g, dx, dy) {
    if (!g?.src || (!dx && !dy)) return g;
    Object.values(g.src.counterMarkers || {}).forEach(arr => (arr || []).forEach(m => { m.x += dx; m.y += dy; }));
    (g.src.quickLines || []).forEach(q => { q.x1 += dx; q.y1 += dy; q.x2 += dx; q.y2 += dy; });
    (g.src.polylines || []).forEach(p => (p.points || []).forEach(pt => { pt.x += dx; pt.y += dy; }));
    return g;
  }
  // The only door from ghost to real, counted marks. Honors the per-ghost
  // show/hide toggles: what you cannot see is what you do not get. Every
  // committed mark gets a FRESH id so it is a new mark, not a second reference
  // to the captured one. Caller owns the undo snapshot + dirty + re-render.
  function stampGhostIntoAnnotations(ann, g) {
    if (!ann || !g?.src) return { counters: 0, lines: 0 };
    let counters = 0, lines = 0;
    if (g.showCounters !== false) {
      Object.entries(g.src.counterMarkers || {}).forEach(([counterId, arr]) => {
        (arr || []).forEach(m => {
          if (!ann.counterMarkers) ann.counterMarkers = {};
          if (!ann.counterMarkers[counterId]) ann.counterMarkers[counterId] = [];
          ann.counterMarkers[counterId].push({ ...JSON.parse(JSON.stringify(m)), id: ctx.uid() });
          counters++;
        });
      });
    }
    if (g.showLines !== false) {
      (g.src.quickLines || []).forEach(q => {
        (ann.quickLines = ann.quickLines || []).push({ ...JSON.parse(JSON.stringify(q)), id: ctx.uid() });
        lines++;
      });
      (g.src.polylines || []).forEach(p => {
        (ann.polylines = ann.polylines || []).push({ ...JSON.parse(JSON.stringify(p)), id: ctx.uid() });
        lines++;
      });
    }
    return { counters, lines };
  }
  // Topmost-first: ghosts render in array order, so the last one drawn is the
  // one a click should grab.
  function ghostIndexAtPoint(ann, pos) {
    const ghosts = ann?.ghosts || [];
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const b = ghostBounds(ghosts[i]);
      if (!b) continue;
      if (pos.x >= b.x1 && pos.x <= b.x2 && pos.y >= b.y1 && pos.y <= b.y2) return i;
    }
    return -1;
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
    hydrateStateFromProjectData,
    reconcileOrphanedCountersAndLineTypes,
    planPaletteRelink,
    applyPaletteRelink,
    countItemsInRect,
    collectItemsToDeleteInRect,
    captureGhostFromRect,
    ghostCounts,
    ghostBounds,
    translateGhost,
    stampGhostIntoAnnotations,
    ghostIndexAtPoint,
    deleteCollectedItems,
    rotateAnnotations,
    applyRotationDeltaToAnnotations,
    deepCopyAnnotations,
  };
}


// The undo/redo stack (createUndoStack(ctx)) split out to undo-stack.js —
// the model factory above is pure-ish data transformation; the stack is a
// command-history controller with UI side-effect hooks in its ctx.

// Dual-environment export (inert in the browser) for node --test + eslint.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createAnnotationModel, dedupePaletteById, collectDropNodes, dropRefLine, applyDropToNode };
}

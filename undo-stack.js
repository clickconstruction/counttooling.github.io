/*
 * undo-stack.js - the undo/redo stack, split out of annotation-model.js
 * (2026-07-30): two unrelated factories were sharing one file. The model is
 * pure-ish data transformation; this is a command-history CONTROLLER whose
 * ctx additionally carries the three UI side-effect hooks (markProjectDirty,
 * renderPdf, updateUI) that undo()/redo() invoke. Same seam recipe as its
 * siblings: one factory, createUndoStack(ctx), instantiated once in app.js
 * with live-value accessors; app.js keeps same-named thin wrappers.
 * Reads UNDO_STACK_SIZE from constants.js by bare classic-script name
 * (constants.js precedes this file in app/index.html).
 */
/*
 * The undo/redo stack — annotation-data snapshots over the same state seam.
 * ctx: getState, uid, ensureGroupColors (snapshot restore) + markProjectDirty,
 * renderPdf, updateUI (the undo/redo commit hooks) + remapSessionPageIndices
 * (annotation-model.js; the page-list restore moves the selections with their
 * sheets).
 */
function createUndoStack(ctx) {
  let undoStack = [];
  let redoStack = [];

  // getProjectCounts(data) lives in save-utils.js (loaded before this IIFE).

  function getUndoableSnapshot(opts) {
    const snap = {
      pages: ctx.getState().pages.map(p => ({
        canvases: JSON.parse(JSON.stringify(p.canvases || [])),
        scale: p.scale ? { ...p.scale } : null,
        rotation: p.rotation ?? 0,
        label: p.label
      })),
      counters: JSON.parse(JSON.stringify(ctx.getState().counters)),
      lineTypes: JSON.parse(JSON.stringify(ctx.getState().lineTypes)),
      groups: JSON.parse(JSON.stringify(ctx.getState().groups || [])),
      rooms: JSON.parse(JSON.stringify(ctx.getState().rooms || [])),
      // The legend's size rides the full snapshot (2026-09-21): the corner
      // grip scales legendSettings.legendScale and pushes one at the press,
      // so Ctrl+Z puts the size back like any other drag.
      legendSettings: ctx.getState().legendSettings ? JSON.parse(JSON.stringify(ctx.getState().legendSettings)) : null
    };
    if (opts && opts.pageList) snap.pageList = getPageListShape();
    return snap;
  }

  function pushUndoSnapshot() {
    if (ctx.getState().isViewer || !ctx.getState().pages.length) return;
    undoStack.push(getUndoableSnapshot());
    if (undoStack.length > UNDO_STACK_SIZE) undoStack.shift();
    redoStack = [];
  }

  // MAP-PAGE-UNDO: the step for a change to the page LIST itself (today, a page
  // delete). An ordinary full step lays its pages back over the live list by
  // index, which is right while the list keeps its shape; after a delete it put
  // the deleted sheet's marks, label and scale on the sheet after it. This step
  // also records the list: the page OBJECTS in order (references, so the PDF
  // page, bake frame and anything else on a page come back with it; the
  // canvases, scale, rotation and label are still copied as in any full step)
  // and the two page-index-keyed maps. Undo puts that list back, then applies
  // the copies by index, which now line up; redo does the same with the list
  // as it was after the change. Only this step restores the list: an ordinary
  // step must not, since sheets appended without a step (the Prepare PDF
  // append) would vanish on undo. Entries recorded before the change stay
  // right, because the stack is last in, first out: this step is undone first,
  // so the list is back to the shape they were recorded against.
  function getPageListShape() {
    const state = ctx.getState();
    return {
      refs: state.pages.slice(),
      activeCanvasIdByPage: { ...(state.activeCanvasIdByPage || {}) },
      peekCanvasIdsByPage: JSON.parse(JSON.stringify(state.peekCanvasIdsByPage || {}))
    };
  }
  function pushUndoSnapshotPageList() {
    if (ctx.getState().isViewer || !ctx.getState().pages.length) return;
    undoStack.push(getUndoableSnapshot({ pageList: true }));
    if (undoStack.length > UNDO_STACK_SIZE) undoStack.shift();
    redoStack = [];
  }
  // Put the recorded list back IN PLACE (holders of state.pages and of the maps
  // see it), then carry every session index to its sheet's new position by
  // identity: the sheet on screen stays on screen, a selection follows its
  // sheet, and one on a sheet the list no longer has is dropped.
  function restorePageList(shape) {
    const state = ctx.getState();
    const before = state.pages.slice();
    state.pages.splice(0, state.pages.length, ...shape.refs);
    const to = (idx) => { const k = state.pages.indexOf(before[idx]); return k >= 0 ? k : null; };
    [['activeCanvasIdByPage', shape.activeCanvasIdByPage], ['peekCanvasIdsByPage', shape.peekCanvasIdsByPage]].forEach(([key, saved]) => {
      if (!state[key] || typeof state[key] !== 'object') state[key] = {};
      const map = state[key];
      Object.keys(map).forEach((k) => { delete map[k]; });
      Object.assign(map, JSON.parse(JSON.stringify(saved || {})));
    });
    const cur = to(state.currentPage);
    state.currentPage = cur != null ? cur : Math.min(Math.max(0, state.currentPage || 0), Math.max(0, state.pages.length - 1));
    if (ctx.remapSessionPageIndices) ctx.remapSessionPageIndices(to);
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
    if (snap.pageList) restorePageList(snap.pageList);
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
    if (snap.legendSettings) ctx.getState().legendSettings = snap.legendSettings;
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

  // Both return true when a snapshot was actually applied (false on an empty
  // stack / viewer no-op) so callers can react — app.js toasts the remaining
  // undo count off this.
  function undo() {
    if (undoStack.length === 0 || ctx.getState().isViewer) return false;
    const prev = undoStack.pop();
    redoStack.push(prev.scope === 'page' ? getPageSnapshot(prev.pageIdx) : getUndoableSnapshot({ pageList: !!prev.pageList }));
    applySnapshot(prev);
    ctx.markProjectDirty();
    ctx.renderPdf();
    ctx.updateUI();
    return true;
  }

  function redo() {
    if (redoStack.length === 0 || ctx.getState().isViewer) return false;
    const next = redoStack.pop();
    undoStack.push(next.scope === 'page' ? getPageSnapshot(next.pageIdx) : getUndoableSnapshot({ pageList: !!next.pageList }));
    applySnapshot(next);
    ctx.markProjectDirty();
    ctx.renderPdf();
    ctx.updateUI();
    return true;
  }

  function clearUndoStacks() {
    undoStack = [];
    redoStack = [];
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }
  function undoDepth() { return undoStack.length; }
  function redoDepth() { return redoStack.length; }
  return { getUndoableSnapshot, pushUndoSnapshot, pushUndoSnapshotPageList,
    pushUndoSnapshotPage, applySnapshot, undo, redo, clearUndoStacks, canUndo, canRedo,
    undoDepth, redoDepth };
}

// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declaration above stays a plain global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createUndoStack };
}

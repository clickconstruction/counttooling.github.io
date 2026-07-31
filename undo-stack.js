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

// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declaration above stays a plain global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createUndoStack };
}

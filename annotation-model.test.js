// @ts-check
'use strict';
/**
 * Unit tests for annotation-model.js: createAnnotationModel(ctx) with a
 * stubbed ctx. Pattern per save-engine.test.js: assign the classic-script
 * globals the model reads by bare name (bakeFramesMatch from geometry.js,
 * CIRCLE_PATH from icons.js) onto globalThis, then require the model.
 */
const { test } = require('node:test');
const assert = require('node:assert');

Object.assign(globalThis, require('./geometry.js'));
Object.assign(globalThis, require('./icons.js'));
Object.assign(globalThis, require('./constants.js'));   // UNDO_STACK_SIZE
const { UNDO_STACK_SIZE } = require('./constants.js');

const { createAnnotationModel, createUndoStack } = require('./annotation-model.js');

let nextId = 0;
function makeCtx(state) {
  const calls = { toasts: [], groupColors: 0, savedIcons: [] };
  const ctx = {
    getState: () => state,
    uid: () => 'id-' + (++nextId),
    showToast: (msg) => calls.toasts.push(msg),
    ensureGroupColors: (g) => { calls.groupColors++; return g; },
    saveUserCustomIcons: (a) => calls.savedIcons.push(a),
  };
  return { ctx, calls };
}

test('makeAnnotations returns the canonical empty shape', () => {
  const m = createAnnotationModel(makeCtx({}).ctx);
  const a = m.makeAnnotations();
  assert.deepStrictEqual(Object.keys(a).sort(),
    ['counterMarkers', 'highlights', 'legend', 'multiplyZones', 'notes', 'polylines', 'quickLines', 'scaleZones']);
  assert.deepStrictEqual(a.counterMarkers, {});
  assert.strictEqual(a.legend, null);
});

test('getActiveCanvas: honors activeCanvasIdByPage, hint short-circuit, first-canvas fallback', () => {
  const pageA = { canvases: [{ id: 'c1', annotations: null }, { id: 'c2', annotations: null }] };
  const state = { pages: [pageA], activeCanvasIdByPage: { 0: 'c2' } };
  const m = createAnnotationModel(makeCtx(state).ctx);
  assert.strictEqual(m.getActiveCanvas(pageA).id, 'c2');
  assert.strictEqual(m.getActiveCanvas(pageA, 0).id, 'c2');       // hint path
  state.activeCanvasIdByPage = { 0: 'missing' };
  assert.strictEqual(m.getActiveCanvas(pageA).id, 'c1');          // fallback
  assert.strictEqual(m.getActiveCanvas(null), null);
});

test('mergeAnnotations combines markers per counter id and concatenates lists', () => {
  const m = createAnnotationModel(makeCtx({}).ctx);
  const a = m.makeAnnotations(); a.counterMarkers.x = [{ n: 1 }]; a.quickLines.push({ q: 1 });
  const b = m.makeAnnotations(); b.counterMarkers.x = [{ n: 2 }]; b.counterMarkers.y = [{ n: 3 }];
  const out = m.mergeAnnotations(a, null, b);
  assert.strictEqual(out.counterMarkers.x.length, 2);
  assert.strictEqual(out.counterMarkers.y.length, 1);
  assert.strictEqual(out.quickLines.length, 1);
});

test('migratePageToCanvases wraps legacy page.annotations exactly once', () => {
  const m = createAnnotationModel(makeCtx({}).ctx);
  const legacyAnn = { counterMarkers: { x: [{}] } };
  const page = { annotations: legacyAnn };
  m.migratePageToCanvases(page);
  assert.strictEqual(page.canvases.length, 1);
  assert.strictEqual(page.canvases[0].annotations, legacyAnn);
  assert.strictEqual(page.annotations, undefined);
  const c0 = page.canvases[0];
  m.migratePageToCanvases(page);                                   // idempotent
  assert.strictEqual(page.canvases[0], c0);
});

test('ensureActiveCanvas migrates a bare page to a Main canvas and returns it', () => {
  const page = {};
  const state = { pages: [page], activeCanvasIdByPage: {} };
  const m = createAnnotationModel(makeCtx(state).ctx);
  const canvas = m.ensureActiveCanvas(page);
  assert.strictEqual(canvas.name, 'Main');
  assert.strictEqual(page.canvases.length, 1);
  assert.strictEqual(m.ensureActiveCanvas(page), canvas);   // stable on re-entry
});

test('backupDataToProjFormat converts pageCanvases arrays to the pages[] shape', () => {
  const m = createAnnotationModel(makeCtx({}).ctx);
  const backup = {
    counters: [], pageCanvases: [[{ id: 'c', annotations: {} }]],
    pageScales: [{ feet: 10 }], pageRotations: [90], pageBakeFrames: [{ w: 1, h: 2 }],
  };
  const proj = m.backupDataToProjFormat(backup);
  assert.strictEqual(proj.pages.length, 1);
  assert.deepStrictEqual(proj.pages[0].scale, { feet: 10 });
  assert.strictEqual(proj.pages[0].rotation, 90);
  // already-proj-shaped data passes through untouched
  const already = { pages: [] };
  assert.strictEqual(m.backupDataToProjFormat(already), already);
});

test('applyPageAnnotationsFromData: canvases shape normalizes fields; legacy shape wraps', () => {
  const m = createAnnotationModel(makeCtx({}).ctx);
  const page = {};
  m.applyPageAnnotationsFromData(page, {
    canvases: [{ annotations: { counterMarkers: { x: [{}] }, polylines: 'bogus' } }],
    scale: { feet: 5 }, rotation: 180,
  });
  assert.strictEqual(page.canvases[0].name, 'Main');
  assert.deepStrictEqual(page.canvases[0].annotations.polylines, []);   // bogus -> []
  assert.strictEqual(page.canvases[0].annotations.counterMarkers.x.length, 1);
  assert.strictEqual(page.rotation, 180);

  const legacyPage = {};
  m.applyPageAnnotationsFromData(legacyPage, { annotations: { notes: [{ text: 'n' }] } }, { feet: 3 });
  assert.strictEqual(legacyPage.canvases[0].annotations.notes.length, 1);
  assert.deepStrictEqual(legacyPage.scale, { feet: 3 });                // scaleFallback
});

test('verifyPageBakeFrame flags mismatches and throttles the toast', () => {
  const { ctx, calls } = makeCtx({});
  const m = createAnnotationModel(ctx);
  const pdfPage = { rotate: 0, getViewport: () => ({ width: 100, height: 200 }) };
  const page = { pdfPage, rotation: 0 };
  m.verifyPageBakeFrame(page, { w: 100, h: 200, intrinsic: 0 });
  assert.strictEqual(page.bakeMismatch, false);
  m.verifyPageBakeFrame(page, { w: 999, h: 200, intrinsic: 0 });
  assert.strictEqual(page.bakeMismatch, true);
  m.verifyPageBakeFrame(page, { w: 998, h: 200, intrinsic: 0 });   // within throttle window
  assert.strictEqual(calls.toasts.length, 1);
});

test('applyTakeoffBackupToState restores canvases, scales, and settings onto state', () => {
  const state = { pages: [{}, {}], counters: [], lineTypes: [], legendSettings: { a: 1 }, multiplyZoneSettings: {} };
  const { ctx, calls } = makeCtx(state);
  const m = createAnnotationModel(ctx);
  m.applyTakeoffBackupToState({
    counters: [{ id: 'x' }],
    groups: [{ id: 'g' }],
    customIconPaths: [{ value: 'p' }],
    pageCanvases: [[{ id: 'c1', annotations: {} }]],
    pageScales: [{ feet: 8 }],
    pageRotations: [90],
    legendSettings: { b: 2 },
  });
  assert.strictEqual(state.counters[0].id, 'x');
  assert.strictEqual(calls.groupColors, 1);
  assert.deepStrictEqual(calls.savedIcons[0], [{ value: 'p' }]);
  assert.strictEqual(state.pages[0].canvases[0].id, 'c1');
  assert.deepStrictEqual(state.pages[0].scale, { feet: 8 });
  assert.strictEqual(state.pages[1].canvases, undefined);          // empty entries skipped
  assert.deepStrictEqual(state.legendSettings, { a: 1, b: 2 });
});

test('reconcileOrphanedCountersAndLineTypes backfills Unknown rows for orphaned ids', () => {
  const state = {
    pages: [{ canvases: [{ id: 'c', annotations: { counterMarkers: { ghost: [{}] }, quickLines: [{ lineTypeId: 'phantom' }] } }] }],
    counters: [], lineTypes: [],
  };
  const m = createAnnotationModel(makeCtx(state).ctx);
  m.reconcileOrphanedCountersAndLineTypes();
  assert.strictEqual(state.counters[0].id, 'ghost');
  assert.strictEqual(state.counters[0].name, 'Unknown');
  assert.strictEqual(state.lineTypes[0].id, 'phantom');
});

// --- createUndoStack --------------------------------------------------------

function undoCtx(state) {
  const calls = { dirty: 0, renders: 0, ui: 0 };
  return { calls, ctx: {
    getState: () => state,
    uid: () => 'u-' + Math.random().toString(36).slice(2, 6),
    ensureGroupColors: (g) => g,
    markProjectDirty: () => calls.dirty++,
    renderPdf: () => calls.renders++,
    updateUI: () => calls.ui++,
  } };
}

test('undo/redo round-trip restores counters and marks dirty + re-renders', () => {
  const state = { isViewer: false, pages: [{ canvases: [], scale: null, rotation: 0 }], counters: [{ id: 'a' }], lineTypes: [], groups: [] };
  const { ctx, calls } = undoCtx(state);
  const u = createUndoStack(ctx);
  assert.strictEqual(u.canUndo(), false);
  u.pushUndoSnapshot();
  state.counters = [{ id: 'a' }, { id: 'b' }];
  u.undo();
  assert.strictEqual(state.counters.length, 1);
  assert.strictEqual(calls.dirty, 1);
  assert.strictEqual(calls.renders, 1);
  assert.strictEqual(u.canRedo(), true);
  u.redo();
  assert.strictEqual(state.counters.length, 2);
});

test('pushUndoSnapshot: viewer/empty sessions are no-ops; cap sheds oldest; new push clears redo', () => {
  const viewer = createUndoStack(undoCtx({ isViewer: true, pages: [{}] }).ctx);
  viewer.pushUndoSnapshot();
  assert.strictEqual(viewer.canUndo(), false);

  const state = { isViewer: false, pages: [{ canvases: [] }], counters: [], lineTypes: [], groups: [] };
  const u = createUndoStack(undoCtx(state).ctx);
  for (let i = 0; i < UNDO_STACK_SIZE + 5; i++) u.pushUndoSnapshot();
  u.undo();
  assert.strictEqual(u.canRedo(), true);
  u.pushUndoSnapshot();                       // a fresh edit invalidates redo
  assert.strictEqual(u.canRedo(), false);
});

test('applySnapshot clears in-flight drawing state and drops dangling active ids', () => {
  const state = {
    isViewer: false, pages: [{ canvases: [] }], counters: [{ id: 'x' }], lineTypes: [],
    groups: [], drawingPolyline: { pts: [] }, quickLineStart: { x: 1 },
    activeCounterType: 'x', activeLineTypeId: 'gone',
  };
  const u = createUndoStack(undoCtx(state).ctx);
  u.applySnapshot({ pages: [], counters: [], lineTypes: [], groups: [] });
  assert.strictEqual(state.drawingPolyline, null);
  assert.strictEqual(state.quickLineStart, null);
  assert.strictEqual(state.activeCounterType, null);   // counter list emptied
  assert.strictEqual(state.activeLineTypeId, null);
});

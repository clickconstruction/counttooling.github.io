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
    ['counterMarkers', 'highlights', 'legend', 'multiplyZones', 'notes', 'polylines', 'quickLines', 'roomBoxes', 'scaleZones']);
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

test('mergeAnnotations concatenates roomBoxes across canvases', () => {
  const m = createAnnotationModel(makeCtx({}).ctx);
  const a = m.makeAnnotations(); a.roomBoxes.push({ x1: 0, y1: 0, x2: 5, y2: 5, heightFt: 8, roomId: 'r1' });
  const b = m.makeAnnotations(); b.roomBoxes.push({ x1: 9, y1: 9, x2: 12, y2: 12, heightFt: 9, roomId: 'r2' });
  const out = m.mergeAnnotations(a, b);
  assert.strictEqual(out.roomBoxes.length, 2);
});

test('applyPageAnnotationsFromData sanitizes roomBoxes (array kept, junk dropped)', () => {
  const state = { pages: [{}] };
  const m = createAnnotationModel(makeCtx(state).ctx);
  const page = state.pages[0];
  m.applyPageAnnotationsFromData(page, { canvases: [{ id: 'c1', annotations: { roomBoxes: [{ x1: 0, y1: 0, x2: 3, y2: 3, heightFt: 8, roomId: 'r1' }] } }] });
  assert.strictEqual(page.canvases[0].annotations.roomBoxes.length, 1);
  m.applyPageAnnotationsFromData(page, { canvases: [{ id: 'c2', annotations: { roomBoxes: 'junk' } }] });
  assert.deepStrictEqual(page.canvases[0].annotations.roomBoxes, []);
});

test('pageHasAnyAnnotations counts a page with only room boxes as marked', () => {
  const m = createAnnotationModel(makeCtx({}).ctx);
  const ann = m.makeAnnotations(); ann.roomBoxes.push({ x1: 0, y1: 0, x2: 3, y2: 3 });
  assert.strictEqual(m.pageHasAnyAnnotations({ canvases: [{ annotations: ann }] }), true);
});

test('reconcileOrphanedCountersAndLineTypes recreates a room referenced by an orphan box', () => {
  const ann = { roomBoxes: [{ x1: 0, y1: 0, x2: 3, y2: 3, heightFt: 8, roomId: 'ghost' }] };
  const state = { pages: [{ canvases: [{ id: 'c1', annotations: ann }] }], counters: [], lineTypes: [], rooms: [] };
  const m = createAnnotationModel(makeCtx(state).ctx);
  m.reconcileOrphanedCountersAndLineTypes();
  assert.strictEqual(state.rooms.length, 1);
  assert.strictEqual(state.rooms[0].id, 'ghost');
});

test('undo snapshot carries rooms; applySnapshot restores them and clears roomBoxStart', () => {
  const state = {
    pages: [{ canvases: [{ id: 'c1', annotations: null }], scale: null, rotation: 0, label: 'p1' }],
    counters: [], lineTypes: [], groups: [],
    rooms: [{ id: 'r1', name: 'Office', color: '#4a9eff' }],
    roomBoxStart: { x: 1, y: 2 },
    isViewer: false
  };
  const { ctx } = makeCtx(state);
  ctx.markProjectDirty = () => {};
  ctx.renderPdf = () => {};
  ctx.updateUI = () => {};
  const u = createUndoStack(ctx);
  u.pushUndoSnapshot();
  state.rooms = [];   // mutate after snapshot
  u.undo();
  assert.strictEqual(state.rooms.length, 1);
  assert.strictEqual(state.rooms[0].name, 'Office');
  assert.strictEqual(state.roomBoxStart, null);
});

// --- rect-select operations (moved from app.js) ------------------------------

function rectFixture() {
  const state = { counters: [{ id: 'wc' }, { id: 'lav' }], pages: [] };
  const { ctx } = makeCtx(state);
  ctx.getLineRealWorldLengthFeet = (line, pageIdx, isPoly) => (isPoly ? 7 : 5);
  const m = createAnnotationModel(ctx);
  const ann = m.makeAnnotations();
  ann.counterMarkers.wc = [{ x: 10, y: 10 }, { x: 200, y: 200 }];   // one in, one out
  ann.counterMarkers.lav = [{ x: 20, y: 20 }];
  ann.quickLines.push({ x1: 5, y1: 5, x2: 40, y2: 40 });            // both ends in
  ann.quickLines.push({ x1: 5, y1: 5, x2: 500, y2: 500 });          // one end out -> not hit
  ann.polylines.push({ points: [{ x: 8, y: 8 }, { x: 90, y: 90 }, { x: 30, y: 30 }] }); // endpoints in
  ann.highlights.push({ x1: 0, y1: 0, x2: 60, y2: 60 });            // center (30,30) in
  ann.highlights.push({ x1: 90, y1: 90, x2: 300, y2: 300 });        // center out
  ann.notes.push({ x: 50, y: 50, text: 'n' });
  ann.multiplyZones.push({ x1: 10, y1: 10, x2: 80, y2: 80, multiplier: 2 });
  ann.scaleZones.push({ x1: 200, y1: 200, x2: 400, y2: 400 });      // center out
  ann.roomBoxes.push({ x1: 20, y1: 20, x2: 70, y2: 70, heightFt: 8, roomId: 'r1' });
  return { m, ann };
}

test('countItemsInRect: lines need both endpoints inside; counters per marker', () => {
  const { m, ann } = rectFixture();
  const r = m.countItemsInRect(ann, 0, 0, 0, 100, 100);
  assert.strictEqual(r.counterCount, 2);        // wc[0] + lav[0]; wc[1] outside
  assert.strictEqual(r.lineRunCount, 2);        // quickLine #1 + the polyline
  assert.strictEqual(r.lengthRealSum, 5 + 7);   // stubbed lengths, feet
});

test('collectItemsToDeleteInRect: center-point hits for zones/highlights/rooms, anchor for notes', () => {
  const { m, ann } = rectFixture();
  const c = m.collectItemsToDeleteInRect(ann, 0, 0, 0, 100, 100);
  assert.strictEqual(c.counterCount, 2);
  assert.strictEqual(c.lineRunCount, 2);
  assert.strictEqual(c.highlightCount, 1);
  assert.strictEqual(c.noteCount, 1);
  assert.strictEqual(c.multiplyZoneCount, 1);
  assert.strictEqual(c.scaleZoneCount, 0);      // its center is outside
  assert.strictEqual(c.roomBoxCount, 1);
  assert.strictEqual(c.quickLines[0].index, 0); // the second quickLine survived
});

test('deleteCollectedItems: descending-index splices delete the right items', () => {
  const state = { counters: [{ id: 'wc' }], pages: [] };
  const { ctx } = makeCtx(state);
  ctx.getLineRealWorldLengthFeet = () => 0;
  const m = createAnnotationModel(ctx);
  const ann = m.makeAnnotations();
  ann.quickLines.push({ id: 'a' }, { id: 'b' }, { id: 'c' });
  // Delete indices 0 and 2 — ascending splices would take 'a' then (shifted) 'c'
  // out by removing what WAS at index 2 after the shift, i.e. nothing/'wrong'.
  m.deleteCollectedItems(ann, { quickLines: [{ index: 0 }, { index: 2 }] });
  assert.deepStrictEqual(ann.quickLines.map(q => q.id), ['b']);
  // Counter markers delete by identity, not index.
  const keep = { x: 1, y: 1 }, drop = { x: 2, y: 2 };
  ann.counterMarkers.wc = [keep, drop];
  m.deleteCollectedItems(ann, { counters: [{ counterId: 'wc', marker: drop }] });
  assert.deepStrictEqual(ann.counterMarkers.wc, [keep]);
});

// --- page-rotation math (moved from app.js) -----------------------------------

test('rotateAnnotations: four 90-degree turns are the identity for every kind', () => {
  const state = { counters: [], pages: [] };
  const { ctx } = makeCtx(state);
  const m = createAnnotationModel(ctx);
  const ann = m.makeAnnotations();
  ann.counterMarkers.wc = [{ x: 11, y: 22, id: 'm1' }];
  ann.quickLines.push({ x1: 1, y1: 2, x2: 3, y2: 4 });
  ann.polylines.push({ points: [{ x: 5, y: 6 }, { x: 7, y: 8 }] });
  ann.highlights.push({ x1: 9, y1: 10, x2: 11, y2: 12 });
  ann.multiplyZones.push({ x1: 13, y1: 14, x2: 15, y2: 16 });
  ann.scaleZones.push({ x1: 17, y1: 18, x2: 19, y2: 20 });
  ann.roomBoxes.push({ x1: 21, y1: 22, x2: 23, y2: 24, heightFt: 8 });
  ann.notes.push({ x: 25, y: 26, text: 'n' });
  ann.legend = { x: 27, y: 28, w: 100, h: 50 };
  const page = { canvases: [{ id: 'c1', annotations: ann }] };
  const before = JSON.parse(JSON.stringify(ann));
  // W x H swaps on every quarter turn: 300x200 -> 200x300 -> 300x200 -> ...
  m.rotateAnnotations(page, 300, 200);
  assert.notDeepStrictEqual(JSON.parse(JSON.stringify(page.canvases[0].annotations)), before);
  m.rotateAnnotations(page, 200, 300);
  m.rotateAnnotations(page, 300, 200);
  m.rotateAnnotations(page, 200, 300);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(page.canvases[0].annotations)), before);
});

test('applyRotationDeltaToAnnotations: steps through viewports at each intermediate rotation', () => {
  const state = { counters: [], pages: [] };
  const m = createAnnotationModel(makeCtx(state).ctx);
  const seen = [];
  const page = {
    rotation: 0,
    pdfPage: { getViewport: ({ rotation }) => { seen.push(rotation); return (rotation % 180 === 0) ? { width: 300, height: 200 } : { width: 200, height: 300 }; } },
    canvases: [{ id: 'c1', annotations: Object.assign(createAnnotationModel(makeCtx(state).ctx).makeAnnotations(), { notes: [{ x: 10, y: 20, text: 'n' }] }) }],
  };
  m.applyRotationDeltaToAnnotations(page, 180);
  assert.deepStrictEqual(seen, [0, 90]);
  // 180 degrees on a 300x200 page: (x,y) -> (w-x, h-y)
  assert.deepStrictEqual(
    { x: page.canvases[0].annotations.notes[0].x, y: page.canvases[0].annotations.notes[0].y },
    { x: 290, y: 180 });
  // Non-multiples of 90 and null pages are safe no-ops.
  m.applyRotationDeltaToAnnotations(page, 45);
  m.applyRotationDeltaToAnnotations(null, 90);
  assert.deepStrictEqual(seen, [0, 90]);
});

test('deepCopyAnnotations: null gets the canonical shape; copies are detached', () => {
  const m = createAnnotationModel(makeCtx({}).ctx);
  assert.deepStrictEqual(m.deepCopyAnnotations(null), m.makeAnnotations());
  const ann = m.makeAnnotations();
  ann.quickLines.push({ x1: 1 });
  const copy = m.deepCopyAnnotations(ann);
  copy.quickLines.push({ x1: 2 });
  assert.strictEqual(ann.quickLines.length, 1);
});

test('pushUndoSnapshotPage: undo restores ONLY the scoped page; other pages untouched; redo inverts at page scope', () => {
  const mk = (n) => ({ canvases: [{ id: 'c' + n, name: 'Main', annotations: { counterMarkers: { t: [{ x: n, y: n }] }, quickLines: [], polylines: [], highlights: [], multiplyZones: [], scaleZones: [], roomBoxes: [], notes: [], legend: null } }], scale: null, rotation: 0, label: 'P' + n });
  const state = { isViewer: false, pages: [mk(0), mk(1)], counters: [{ id: 't' }], lineTypes: [], groups: [], rooms: [] };
  const { ctx } = undoCtx(state);
  const u = createUndoStack(ctx);

  // Snapshot page 0, then mutate BOTH pages.
  u.pushUndoSnapshotPage(0);
  state.pages[0].canvases[0].annotations.counterMarkers.t.push({ x: 99, y: 99 });
  state.pages[1].canvases[0].annotations.counterMarkers.t.push({ x: 77, y: 77 });

  u.undo();
  // Page 0 restored to one marker; page 1's mutation SURVIVES (out of scope).
  assert.strictEqual(state.pages[0].canvases[0].annotations.counterMarkers.t.length, 1);
  assert.strictEqual(state.pages[1].canvases[0].annotations.counterMarkers.t.length, 2);

  u.redo();
  // Redo re-applies page 0's mutation; page 1 still untouched by undo/redo.
  assert.strictEqual(state.pages[0].canvases[0].annotations.counterMarkers.t.length, 2);
  assert.strictEqual(state.pages[1].canvases[0].annotations.counterMarkers.t.length, 2);
});

test('page-scoped and full snapshots interleave correctly on the same stack', () => {
  const mk = (n) => ({ canvases: [{ id: 'c' + n, name: 'Main', annotations: { counterMarkers: {}, quickLines: [], polylines: [], highlights: [], multiplyZones: [], scaleZones: [], roomBoxes: [], notes: [], legend: null } }], scale: null, rotation: 0 });
  const state = { isViewer: false, pages: [mk(0), mk(1)], counters: [], lineTypes: [{ id: 'l1' }], groups: [], rooms: [] };
  const { ctx } = undoCtx(state);
  const u = createUndoStack(ctx);

  u.pushUndoSnapshot();                    // full
  state.lineTypes.push({ id: 'l2' });
  u.pushUndoSnapshotPage(1);               // page-scoped
  state.pages[1].canvases[0].annotations.quickLines.push({ id: 'q', x1: 0, y1: 0, x2: 1, y2: 1 });

  u.undo();                                // pops the page entry
  assert.strictEqual(state.pages[1].canvases[0].annotations.quickLines.length, 0);
  assert.strictEqual(state.lineTypes.length, 2);   // full entry not yet popped

  u.undo();                                // pops the full entry
  assert.strictEqual(state.lineTypes.length, 1);

  u.redo();
  assert.strictEqual(state.lineTypes.length, 2);
  u.redo();
  assert.strictEqual(state.pages[1].canvases[0].annotations.quickLines.length, 1);
});

test('pushUndoSnapshotPage restores page scale/rotation and palettes like the full path', () => {
  const state = { isViewer: false, pages: [{ canvases: [], scale: { pixelsPerUnit: 4, unit: 'ft' }, rotation: 0 }], counters: [{ id: 'a' }], lineTypes: [], groups: [], rooms: [] };
  const { ctx } = undoCtx(state);
  const u = createUndoStack(ctx);
  u.pushUndoSnapshotPage(0);
  state.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft' };
  state.pages[0].rotation = 90;
  state.counters.push({ id: 'b' });
  u.undo();
  assert.strictEqual(state.pages[0].scale.pixelsPerUnit, 4);
  assert.strictEqual(state.pages[0].rotation, 0);
  assert.strictEqual(state.counters.length, 1);
});

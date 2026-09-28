/*
 * features/esc-ladder.js: the Escape ladder, as tables (MAP-ESC, DECOMPOSITION_MAP R10).
 *
 * One press of Esc closes ONE thing, the thing on top, and stops there:
 *   1. the confirm dialog (it sits above everything; Esc is its Cancel), then the grid
 *      origin pick (it hid its settings dialog; Esc gives it back);
 *   2. the topmost visible `.modal-overlay`, the one opened last: app.js's showModal
 *      raises a dialog opened over another above it, so painted order is opened order
 *      (ESC-STACK, DECOMPOSITION_MAP S06). It closes through its CLOSERS entry (its own
 *      Cancel or Close, for a dialog that holds pending state) or a plain hide. An
 *      overlay marked `data-esc="none"` (the blocking Turn In progress) swallows the key;
 *   3. an open header popover (the bid menu, the ⋯ tool menu, the zoom rail);
 *   4. the armed tool, one step per press (TOOL_RUNGS): a pending start, then a palette,
 *      then the tool itself, through the MAP-RESETS helpers (App.clearToolStarts,
 *      App.resetToMove) rather than a hand list of starts;
 *   5. the "find this counter" halo, then the last rung, back to Move.
 * Before this file about twenty dialogs had no rung, so Esc left them up and fell
 * through to step 4: a polyline lost a vertex behind the Water Sizing schedule (D04, D12).
 *
 * The context menus that must win over everything (#contextMenu in app.js, the tool,
 * ghost, bend and fittings menus, the rules popover, the layers peek chooser) still take
 * Esc in the capture phase and stop it, so this ladder never sees those presses.
 *
 * A dialog's × (`data-modal-close`) dismisses its OWN overlay the way Esc does
 * (App.dismissOverlay, called by app.js's click handler): the same closer or hide, never
 * the tool under it. It used to re-dispatch a synthetic Escape through the whole ladder.
 *
 * Registers: App.handleEscape(e) (app.js's keydown calls it synchronously, so listener
 * order is unchanged), App.dismissOverlay(el).
 * Reads at call time: App.state, TOOL, SCALE_MODES, showModal, hideModal, updateUI,
 * renderAnnotations, resolveConfirm, clearAuthGate, clearToolStarts, resetToMove,
 * exitEditMode, and each feature's own close (the closers name them).
 * Spec: esc-ladder.spec.js (the closers and the stacking), esc-dialogs.spec.js (the plain
 * hide and the ×).
 */
(function () {
  const App = (window.App = window.App || {});
  const $ = (id) => document.getElementById(id);
  const isVisible = (id) => { const el = $(id); return !!(el && el.classList.contains('visible')); };
  const click = (id) => { const el = $(id); if (el) el.click(); };

  // How Esc (and a dialog's ×) closes an overlay whose close is more than a plain hide:
  // its own Cancel or Close, so the pending state it holds is dropped or the reset its
  // hide hook misses fires. Every other overlay just hides (App.hideModal runs the
  // per-dialog hide hooks). ESC-STACK: this used to be two tables, MODAL_RUNGS walked in
  // list order whenever the top overlay had a row, which closed the parent under the
  // colour picker; now showModal paints dialogs in the order they opened, so the ladder
  // closes the painted top and needs no order, and the 36 plain-hide rows went.
  const CLOSERS = {
    // z-index 210, above every standard overlay. Routed through its Close button so
    // the 5s re-render tick timer is cleared (features/save-status.js; Tier-3 B1 / J12).
    // The Done button, not the ×: the × is data-modal-close and would come back here.
    saveStatusModal: () => click('saveStatusModalDone'),
    // T1-01 clobber guard: NOT a bare hide. The dismiss helper clears pendingRestore
    // (takeoff backups resume) while consuming nothing, so the Keep/Discard offer
    // returns next boot (features/restore-last-session.js).
    lastSessionRestoreModal: () => { if (App.dismissLastSessionRestorePrompt) App.dismissLastSessionRestorePrompt(); },
    scaleModal: () => {
      const s = App.state;
      if (s.tool === App.TOOL.SCALE) { s.tool = App.TOOL.NONE; s.scaleMode = App.SCALE_MODES.NONE; App.clearToolStarts(); }
      App.resetScaleModalZoneMode();
      if (App.resetScaleCheckMode) App.resetScaleCheckMode();
      App.hideModal('scaleModal');
      App.updateUI();
    },
    // The counter dialogs (Tier-3 B1 / J4), through their own Cancel/Close so the
    // pending-state resets fire (features/item-details.js, features/groups.js).
    deleteCounterLineTypeConfirmModal: () => click('deleteCounterLineTypeCancel'),
    counterLineTypeDetailsModal: () => click('counterLineTypeDetailsClose'),
    groupModal: () => click('groupModalCancel'),
    groupAssignModal: () => click('groupAssignCancel'),
    lineColorModal: () => { App.state.pendingLineColorApply = null; App.hideModal('lineColorModal'); },
    noteModal: () => { const s = App.state; App.hideModal('noteModal'); s.pendingNote = null; s.editingNote = null; s.pendingNoteColor = null; },
    multiplyZoneModal: () => { const s = App.state; App.hideModal('multiplyZoneModal'); s.pendingMultiplyZone = null; s.pendingMultiplyZoneEdit = null; },
    roomBoxModal: () => { const s = App.state; App.hideModal('roomBoxModal'); s.pendingRoomBox = null; s.pendingRoomBoxEdit = null; },
    markerCfmModal: () => { if (App.cancelMarkerCfm) App.cancelMarkerCfm(); else App.hideModal('markerCfmModal'); },   // DUCT D15
    markerWsfuModal: () => { if (App.cancelMarkerWsfu) App.cancelMarkerWsfu(); else App.hideModal('markerWsfuModal'); },   // D12
    linePropertiesModal: () => App.closeLinePropertiesModal(),
    deletePageConfirmModal: () => { App.hideModal('deletePageConfirmModal'); App.state.pendingDeletePage = null; },
    authModal: () => { if (App.clearAuthGate) App.clearAuthGate(); App.hideModal('authModal'); },
    copyProjectModal: () => { if (App.clearCopyProjectModalTarget) App.clearCopyProjectModalTarget(); App.hideModal('copyProjectModal'); },
    preparePdfModal: () => { if (typeof window.closePreparePdfModal === 'function') window.closePreparePdfModal(); },
    viewLinkEmailModal: () => { if (App.cancelViewLinkEmailPrompt) App.cancelViewLinkEmailPrompt(); App.hideModal('viewLinkEmailModal'); },
    // Same commit-name-then-close path as the Done button (features/canvas-layers.js).
    canvasDetailsModal: () => click('canvasDetailsClose'),
    highlightNameModal: () => click('highlightNameCancel'),
    schedulePaletteModal: () => { if (App.cancelSchedulePalette) App.cancelSchedulePalette(); else App.hideModal('schedulePaletteModal'); },   // drops the pending proposal
    saveBeforeLoadModal: () => click('saveBeforeLoadCancel'),       // disabled while the save runs: then nothing
    canvasOnlyNeedsPdfModal: () => click('canvasOnlyNeedsPdfSkip'), // refreshes the banner
    deleteUserConfirmModal: () => click('deleteUserCancel'),
  };

  // The overlay on top: the highest z-index, and on a tie the later one in the
  // document (they are all siblings under <body>, so that is the one painted over).
  function topmostOverlay() {
    let top = null;
    let topZ = -Infinity;
    document.querySelectorAll('.modal-overlay.visible').forEach((el) => {
      const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
      if (z >= topZ) { top = el; topZ = z; }
    });
    return top;
  }

  // Close one overlay the way Esc closes it. Returns true when the key is consumed.
  function dismissOverlay(el) {
    if (!el) return false;
    if (el.dataset.esc === 'none') return true;   // blocking: swallow, close nothing
    if (CLOSERS[el.id]) CLOSERS[el.id]();
    else App.hideModal(el.id);
    return true;
  }

  // Header popovers: they close before any tool rung, one per press.
  const POPOVER_RUNGS = [
    { open: () => !!(App.isBidMenuOpen && App.isBidMenuOpen()), close: () => App.closeBidMenu() },
    { open: () => !!(App.isHeaderMoreOpen && App.isHeaderMoreOpen()), close: () => App.closeHeaderMoreMenu() },
    { open: () => isVisible('zoomRail'), close: () => App.closeZoomRail() },
  ];

  // The tool rungs, in the old ladder's order. A row is either `run` (its own ladder)
  // or staged: `start` (a pending first click), then `panel` (a palette, [isOpen, close]),
  // then back to Move. One press never costs more than the last click.
  const toMove = () => App.resetToMove({ keepCounter: true });
  const dropStart = () => { App.clearToolStarts(); App.renderAnnotations(); App.updateUI(); };
  const TOOL_RUNGS = [
    { tool: 'EDIT_POLY', run: () => App.exitEditMode(false) },
    // Staged like Quick Line: each Esc unwinds one clicked vertex; with none left, Esc
    // exits to Move (JOURNEY-MAP Tier-2 #22). WATER-PLAN rung 4: the water size popover
    // closes first, costing no vertex.
    { when: (s) => !!s.drawingPolyline, run: (s) => {
      if (App.isWaterPopoverOpen && App.isWaterPopoverOpen()) App.closeWaterSizePopover();
      else if (s.drawingPolyline.points.length > 0) { s.drawingPolyline.points.pop(); App.renderAnnotations(); App.updateUI(); }
      else { s.drawingPolyline = null; toMove(); }
    } },
    // Duct (D2): close the S popover, pop the last vertex, clear the draft, all in
    // features/duct-tool.js; false means nothing was left to unwind.
    { tool: 'DUCT', run: () => { if (!(App.handleDuctEscape && App.handleDuctEscape())) toMove(); } },
    { tool: 'LINE', start: 'quickLineStart' },
    // Chain: end the run, close the palette (the header pair chip takes over), exit.
    { tool: 'CHAIN', start: 'chainStart', panel: [() => App.isChainPanelOpen && App.isChainPanelOpen(), () => App.closeChainPanel()] },
    { tool: 'DROP', panel: [() => App.isDropPanelOpen && App.isDropPanelOpen(), () => App.closeDropPanel()] },
    // Mid "Select on PDF": clear the placed point(s) and any zone-apply state. D20: the
    // pick was reached from Set Scale over a live draft, so give the draft back.
    { tool: 'SCALE', run: (s) => {
      App.resetScaleModalZoneMode();
      if (App.resetScaleCheckMode) App.resetScaleCheckMode();
      s.scaleMode = App.SCALE_MODES.NONE;
      toMove();
      if (App.resumeParkedDraft) App.resumeParkedDraft();
    } },
    { tool: 'MEASURE', run: (s) => { s.scaleMode = App.SCALE_MODES.NONE; toMove(); } },
    { tool: 'HIGHLIGHT', start: 'highlightStart', panel: [() => App.isHighlightPanelOpen && App.isHighlightPanelOpen(), () => App.closeHighlightPanel()] },
    { tool: 'MULTIPLY_ZONE', start: 'multiplyZoneStart' },
    { tool: 'SCALE_ZONE', start: 'scaleZoneStart' },
    { tool: 'DELETE_ZONE', start: 'deleteZoneStart' },
    // Ghost: drop the ghost in hand, then the first corner (features/ghost.js), then exit.
    { tool: 'GHOST', run: (s) => {
      if (App.handleGhostEscape && App.handleGhostEscape()) { App.renderAnnotations(); App.updateUI(); }
      else { s.activeGhostId = null; toMove(); }
    } },
    { tool: 'ROOM', start: 'roomBoxStart' },
    { tool: 'NOTE', run: toMove },
  ];

  function runToolRung(r, s) {
    if (r.run) { r.run(s); return; }
    if (r.start && s[r.start]) { dropStart(); return; }
    if (r.panel && r.panel[0]()) { r.panel[1](); App.updateUI(); return; }
    toMove();
  }

  function handleEscape() {
    const s = App.state;
    // B20: the confirm dialog sits above everything; Esc is its Cancel.
    if (isVisible('confirmModal')) { App.resolveConfirm(false); return; }
    if (s.gridOriginPickMode) { App.cancelGridOriginPick && App.cancelGridOriginPick(); return; }   // features/grid.js
    // ESC-STACK: showModal paints dialogs in the order they opened, so the overlay on
    // top is the last one opened (the colour picker over its parent, the icon tips over
    // the details dialog) and it is the one that closes.
    const top = topmostOverlay();
    if (top) { dismissOverlay(top); return; }
    const pop = POPOVER_RUNGS.find((p) => p.open());
    if (pop) { pop.close(); return; }
    const T = App.TOOL;
    const tr = TOOL_RUNGS.find((r) => (r.when ? r.when(s) : s.tool === T[r.tool]));
    if (tr) { runToolRung(tr, s); return; }
    // "Find this counter" halo (features/drop-peek.js): reached only with no dialog
    // open and no tool rung.
    if (s.emphasizedCounterId) { s.emphasizedCounterId = null; App.renderAnnotations(); return; }
    // The last rung: back to Move, and the starts go with the tool (MAP-RESETS, D26: the
  // schedule box has no rung, so one Esc drops a half-drawn box with the tool;
  // tool-resets.spec.js pins that).
    toMove();
  }

  App.handleEscape = handleEscape;
  App.dismissOverlay = dismissOverlay;
})();

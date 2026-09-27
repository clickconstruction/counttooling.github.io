(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // The mark context menu: right-click (or long-press) a mark on the plan and
  // #contextMenu opens with the rows that fit it. app.js's handleContextMenu
  // hit-tests the click, stores state.ctxTarget (with the PDF-space point in
  // .pdf) and calls App.showContextMenu(x, y); duct fittings and runs, and the
  // ghost batch, open their own menus before it gets here.
  //
  // This file owns row visibility (showContextMenu), the nine row handlers
  // (#ctxEdit, #ctxLineProperties, #ctxRepeatDrop, #ctxShowLength,
  // #ctxAssignGroup, #ctxEditRoomBox, #ctxEditMultiplyZone, #ctxEditScaleZone,
  // #ctxDelete), the capture-phase Escape that closes only the menu, and the
  // menu's click-away. Four rows are bound by the feature that owns their
  // dialog and only shown here: #ctxMarkerCfm and #ctxAttachToRun
  // (features/duct-suggest.js, App.strayDeviceAttachTarget), #ctxMarkerWsfu
  // (features/water-fixtures.js), #ctxNameHighlight (features/highlight-labels.js).
  //
  // Moved out of app.js verbatim (R22, 2026-09-26) apart from App.* reads, all
  // at call time. Loads after app.js and before drop-peek.js and rules.js, so
  // the Escape listener still registers ahead of theirs. Registers
  // App.showContextMenu (also the spec seam: drop-mode, duct-b19b, tutorial).
  // See ARCHITECTURE.md "Feature files / window.App registry". No build step.

  const hideMenu = () => document.getElementById('contextMenu').classList.remove('visible');

  function activeAnnotations() {
    const state = App.state;
    const page = state.pages[state.currentPage];
    return page ? App.getActiveAnnotations(page) : null;
  }

  document.getElementById('ctxEdit').onclick = () => {
    const state = App.state;
    const t = state.ctxTarget;
    if (!t || (t.type !== 'note' && t.type !== 'noteResize' && t.type !== 'noteFontSize')) return;
    const ann = activeAnnotations();
    const note = ann?.notes?.[t.index];
    if (note) {
      hideMenu();
      state.ctxTarget = null;
      App.openNoteModal('edit', note.text, note);
    }
  };
  document.getElementById('ctxLineProperties').onclick = () => {
    const state = App.state;
    const t = state.ctxTarget;
    if (!t || (t.type !== 'quickLine' && t.type !== 'polyline')) return;
    const ann = activeAnnotations();
    if (!ann) return;
    let it = null;
    if (t.type === 'quickLine') it = { type: 'quick', q: ann.quickLines[t.index], pageIdx: state.currentPage };
    else if (t.type === 'polyline') it = { type: 'poly', poly: ann.polylines[t.index], pageIdx: state.currentPage };
    if (!it) return;
    hideMenu();
    App.openLinePropertiesModal(it);
  };
  // Repeat-drop: apply the last-used drop size to the clicked line's nearest
  // end. Goes through the node model (collectDropNodes/applyDropToNode), so an
  // end shared with another run — every joint in a chain — carries the drop
  // ONCE instead of once per line. No-op (no undo, no dirty) when that end
  // already has this exact drop.
  const ctxRepeatDropEl = document.getElementById('ctxRepeatDrop');
  if (ctxRepeatDropEl) ctxRepeatDropEl.onclick = () => {
    const state = App.state;
    const t = state.ctxTarget;
    const lastDrop = (state.recentDrops || [])[0];
    hideMenu();
    state.ctxTarget = null;
    if (!t || !lastDrop || (t.type !== 'quickLine' && t.type !== 'polyline')) return;
    const ann = activeAnnotations();
    const line = t.type === 'quickLine' ? ann?.quickLines?.[t.index] : ann?.polylines?.[t.index];
    if (!line) return;
    const isPoly = t.type === 'polyline';
    const pts = isPoly ? (line.points || []) : null;
    const start = isPoly ? pts[0] : { x: line.x1, y: line.y1 };
    const end = isPoly ? pts[pts.length - 1] : { x: line.x2, y: line.y2 };
    if (!start || !end) return;
    const target = t.pdf && App.ptDist(t.pdf, start) <= App.ptDist(t.pdf, end) ? start : end;
    const nodes = App.collectDropNodes(ann);
    const node = nodes.find(n => App.ptDist(n, target) <= 1);
    if (!node) return;
    if (!App.applyDropToNode(ann, node, lastDrop.value, lastDrop.unit, true)) return;
    App.pushUndoSnapshotCurrentPage();
    App.applyDropToNode(ann, node, lastDrop.value, lastDrop.unit);
    App.pushRecentDrop(lastDrop.value, lastDrop.unit);
    App.logDropSetEvent(lastDrop.value, lastDrop.unit, 'context-repeat');
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  };
  document.getElementById('ctxShowLength').onclick = () => {
    const state = App.state;
    const t = state.ctxTarget;
    if (!t || (t.type !== 'quickLine' && t.type !== 'polyline')) return;
    const ann = activeAnnotations();
    if (!ann) return;
    const line = t.type === 'quickLine' ? ann.quickLines[t.index] : ann.polylines[t.index];
    if (!line) return;
    App.pushUndoSnapshot();
    line.showLength = !line.showLength;
    App.markProjectDirty();
    hideMenu();
    state.ctxTarget = null;
    App.renderAnnotations();
    App.updateUI();
  };
  document.getElementById('ctxAssignGroup').onclick = () => {
    const state = App.state;
    const t = state.ctxTarget;
    if (!t || (t.type !== 'marker' && t.type !== 'quickLine' && t.type !== 'polyline')) return;
    const ann = activeAnnotations();
    if (!ann) return;
    let item = null;
    if (t.type === 'marker') item = ann.counterMarkers?.[t.typeId]?.[t.index];
    else if (t.type === 'quickLine') item = ann.quickLines?.[t.index];
    else if (t.type === 'polyline') item = ann.polylines?.[t.index];
    if (!item) return;
    hideMenu();
    App.openGroupAssignModal(item);
  };
  const ctxEditRoomBoxEl = document.getElementById('ctxEditRoomBox');
  if (ctxEditRoomBoxEl) ctxEditRoomBoxEl.onclick = () => {
    const state = App.state;
    hideMenu();
    const t = state.ctxTarget;
    state.ctxTarget = null;
    if (t?.type === 'roomBox') App.openRoomBoxModalForEdit(t.index);
  };
  document.getElementById('ctxEditMultiplyZone').onclick = () => {
    const state = App.state;
    const t = state.ctxTarget;
    if (!t || t.type !== 'multiplyZone') return;
    hideMenu();
    // R14: the dialog is features/zone-modals.js's; false when the zone is gone.
    if (!(App.openMultiplyZoneModal && App.openMultiplyZoneModal({ editIndex: t.index }))) return;
    state.ctxTarget = null;
  };
  document.getElementById('ctxEditScaleZone').onclick = () => {
    const state = App.state;
    const t = state.ctxTarget;
    if (!t || t.type !== 'scaleZone') return;
    hideMenu();
    const ann = activeAnnotations();
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
    const state = App.state;
    const t = state.ctxTarget;
    if (!t) return;
    App.pushUndoSnapshotCurrentPage();   // every branch below mutates the current page's active canvas only
    const page = state.pages[state.currentPage];
    const canvas = page ? App.getActiveCanvas(page) : null;
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
    App.markProjectDirty();
    hideMenu();
    state.ctxTarget = null;
    App.renderAnnotations();
    App.updateUI();
  };

  function showContextMenu(x, y) {
    const state = App.state;
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
      if (showRepeat) repeatDropBtn.textContent = 'Drop ' + App.formatDropLabel(lastDrop.value, lastDrop.unit) + ' here';
    }
    const canShowLength = !state.isViewer && (state.ctxTarget?.type === 'quickLine' || state.ctxTarget?.type === 'polyline');
    showLengthBtn.style.display = canShowLength ? 'block' : 'none';
    if (canShowLength) {
      const ann = activeAnnotations();
      const line = state.ctxTarget?.type === 'quickLine' ? ann?.quickLines?.[state.ctxTarget.index] : ann?.polylines?.[state.ctxTarget.index];
      showLengthBtn.textContent = line?.showLength ? 'Hide Length' : 'Show Length';
    }
    const canAssignGroup = !state.isViewer && App.groupsUiVisible() && (state.ctxTarget?.type === 'marker' || state.ctxTarget?.type === 'quickLine' || state.ctxTarget?.type === 'polyline');
    assignGroupBtn.style.display = canAssignGroup ? 'block' : 'none';
    const ctxEditMzBtn = document.getElementById('ctxEditMultiplyZone');
    ctxEditMzBtn.style.display = !state.isViewer && state.ctxTarget?.type === 'multiplyZone' ? 'block' : 'none';
    const ctxEditSzBtn = document.getElementById('ctxEditScaleZone');
    ctxEditSzBtn.style.display = !state.isViewer && state.ctxTarget?.type === 'scaleZone' ? 'block' : 'none';
    const ctxEditRoomBoxBtn = document.getElementById('ctxEditRoomBox');
    if (ctxEditRoomBoxBtn) ctxEditRoomBoxBtn.style.display = !state.isViewer && state.ctxTarget?.type === 'roomBox' ? 'block' : 'none';
    // D15: "CFM for this one…" — a placed marker of a CFM-carrying counter
    // type gets the per-marker override row (features/duct-suggest.js binds
    // the click and owns #markerCfmModal).
    const ctxMarkerCfmBtn = document.getElementById('ctxMarkerCfm');
    if (ctxMarkerCfmBtn) {
      const mc = !state.isViewer && state.ctxTarget?.type === 'marker'
        ? (state.counters || []).find(c => c.id === state.ctxTarget.typeId) : null;
      ctxMarkerCfmBtn.style.display = mc && mc.cfm > 0 ? 'block' : 'none';
    }
    // WATER-PLAN rung 2: "WSFU for this one…" — a mark of a fixture-unit counter
    // gets the per-mark override row (features/water-fixtures.js owns the click
    // and #markerWsfuModal).
    const ctxMarkerWsfuBtn = document.getElementById('ctxMarkerWsfu');
    if (ctxMarkerWsfuBtn) {
      const mw = !state.isViewer && state.ctxTarget?.type === 'marker'
        ? (state.counters || []).find(c => c.id === state.ctxTarget.typeId) : null;
      ctxMarkerWsfuBtn.style.display = mw && mw.wsfu > 0 ? 'block' : 'none';
    }
    // D19 (J19 Friction #3): "Attach to nearest run" — the rescue for a CFM
    // device that finished a foot short of its branch. Offered ONLY when the
    // device is genuinely unattached AND a run sits close enough to be the
    // obvious intent, so the row never appears as a no-op.
    const ctxAttachBtn = document.getElementById('ctxAttachToRun');
    if (ctxAttachBtn) ctxAttachBtn.style.display = (App.strayDeviceAttachTarget && App.strayDeviceAttachTarget()) ? 'block' : 'none';   // R14: features/duct-suggest.js
    const ctxNameHighlightBtn = document.getElementById('ctxNameHighlight');
    if (ctxNameHighlightBtn) {
      const isHl = !state.isViewer && state.ctxTarget?.type === 'highlight';
      ctxNameHighlightBtn.style.display = isHl ? 'block' : 'none';
      if (isHl) {
        const ann = activeAnnotations();
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
          const ann = activeAnnotations();
          const line = ann ? (t.type === 'quickLine' ? ann.quickLines?.[t.index] : ann.polylines?.[t.index]) : null;
          if (line) {
            const lt = (state.lineTypes || []).find(l => l.id === line.lineTypeId);
            targetLabel = lt ? (lt.name || 'Line') : '—';
          }
        }
      } else if (t && t.type === 'highlight') {
        const ann = activeAnnotations();
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
    App.placeFixedMenu(menu, x, y);
  }

  // Escape dismisses the mark context menu ONLY — capture phase +
  // stopImmediatePropagation mirrors features/tool-context-menu.js's
  // onDocKeyDown, so the Escape ladder (features/esc-ladder.js, called from
  // app.js's bubble-phase keydown) never sees this press (no tool exit or
  // modal close underneath the menu). Registered once and inert while the
  // menu is hidden. (JOURNEY-MAP Tier-3 B1 / J9)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const menu = document.getElementById('contextMenu');
    if (!menu || !menu.classList.contains('visible')) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    menu.classList.remove('visible');
    App.state.ctxTarget = null;
  }, true);

  // Click-away: any click outside a context menu closes this one. (app.js's
  // document click listener still closes the canvas, export and download menus.)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu') && !e.target.closest('#contextMenu')) hideMenu();
  });

  App.showContextMenu = showContextMenu;   // app.js's handleContextMenu; spec seam (drop-mode, duct-b19b, tutorial)
})();

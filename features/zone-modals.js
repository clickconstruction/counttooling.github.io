/*
 * features/zone-modals.js - the zone & page-action modal handlers, extracted
 * from the app.js IIFE as the twenty-ninth feature-file split under the
 * window.App registry pattern. Three confirm/value modals' handlers move
 * together: the Multiply Zone value modal (`#multiplyZoneModal`: cancel +
 * multiplier input sync + the deferred Apply that creates a zone or commits a
 * context-menu edit), the Delete Zone confirm (`#deleteZoneModal`: cancel +
 * confirm -> App.performDeleteZone), and the Delete Page confirm
 * (`#deletePageConfirmModal`: cancel + confirm -> the pending onDelete).
 *
 * Loaded as a classic <script src="/features/zone-modals.js"> AFTER app.js.
 * Its own IIFE: it reaches the cross-cutting state + helpers through the
 * shared window.App registry and binds everything at load — like
 * features/output.js it registers NO entry points, because every handler
 * moves with its DOM element and all the pending state
 * (state.pendingMultiplyZone / pendingMultiplyZoneEdit /
 * pendingMultiplyZoneValue / pendingDeleteZone / pendingDeletePage) lives on
 * the shared `state` object, written by the canvas click handlers and page
 * rows that stay in app.js (the Grid-split pattern: state flags need no
 * callbacks). One new publish-only dep: App.performDeleteZone (the heavy
 * zone-deletion mutation stays in app.js).
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  document.getElementById('multiplyZoneCancel').onclick = () => {
    const state = App.state;
    App.hideModal('multiplyZoneModal');
    state.multiplyZoneStart = null;
    state.pendingMultiplyZone = null;
    state.pendingMultiplyZoneEdit = null;
  };
  document.getElementById('deleteZoneCancel').onclick = () => {
    App.hideModal('deleteZoneModal');
    App.state.pendingDeleteZone = null;
  };
  document.getElementById('deleteZoneConfirm').onclick = () => {
    const state = App.state;
    const pending = state.pendingDeleteZone;
    App.hideModal('deleteZoneModal');
    state.pendingDeleteZone = null;
    if (pending?.ann && pending?.collected) {
      App.performDeleteZone(pending.ann, pending.collected);
    }
  };
  (() => {
    const inputEl = document.getElementById('multiplyZoneMultiplier');
    const sync = () => { const v = parseInt(inputEl.value, 10); if (!isNaN(v) && v >= 1) App.state.pendingMultiplyZoneValue = v; };
    if (inputEl) {
      inputEl.oninput = inputEl.onchange = sync;
      inputEl.onblur = sync;
    }
  })();
  document.getElementById('multiplyZoneApply').onclick = (e) => {
    const state = App.state;
    const pending = state.pendingMultiplyZone;
    /* Defer so input blur commits value before we read. Number inputs may not
       update .value until after blur; click runs before blur on some browsers. */
    setTimeout(() => {
      const inputEl = document.getElementById('multiplyZoneMultiplier');
      if (inputEl) { const v = parseInt(inputEl.value, 10); if (!isNaN(v) && v >= 1) state.pendingMultiplyZoneValue = v; }
      App.hideModal('multiplyZoneModal');
      const edit = state.pendingMultiplyZoneEdit;
      state.pendingMultiplyZone = null;
      state.pendingMultiplyZoneEdit = null;
      const mult = state.pendingMultiplyZoneValue != null && state.pendingMultiplyZoneValue >= 1
        ? state.pendingMultiplyZoneValue
        : parseInt(document.getElementById('multiplyZoneMultiplier').value, 10);
      if (isNaN(mult) || mult < 1) return;
      if (edit) {
        const page = state.pages[state.currentPage];
        const ann = page ? App.getActiveAnnotations(page) : null;
        const zone = ann?.multiplyZones?.[edit.zoneIndex];
        if (zone) {
          App.pushUndoSnapshot();
          zone.multiplier = mult;
          App.markProjectDirty();
        }
      } else if (pending) {
        App.pushUndoSnapshot();
        const page = state.pages[state.currentPage];
        const canvas = page && App.ensureActiveCanvas(page);
        if (canvas) {
          if (!canvas.annotations.multiplyZones) canvas.annotations.multiplyZones = [];
          canvas.annotations.multiplyZones.push({ x1: pending.x1, y1: pending.y1, x2: pending.x2, y2: pending.y2, multiplier: mult, id: App.uid() });
        }
        state.tool = App.TOOL.NONE;
        App.markProjectDirty();
      }
      App.updateUI();
      App.renderAnnotations();
    }, 0);
  };
  document.getElementById('deletePageCancel').onclick = () => { App.hideModal('deletePageConfirmModal'); App.state.pendingDeletePage = null; };
  document.getElementById('deletePageConfirm').onclick = () => {
    const state = App.state;
    App.hideModal('deletePageConfirmModal');
    const pending = state.pendingDeletePage;
    state.pendingDeletePage = null;
    if (pending?.onDelete) pending.onDelete();
  };
})();

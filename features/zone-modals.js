/*
 * features/zone-modals.js - the zone & page-action modal handlers, extracted
 * from the app.js IIFE as the twenty-ninth feature-file split under the
 * window.App registry pattern. Two confirm/value modals' handlers move
 * together: the Multiply Zone value modal (`#multiplyZoneModal`: cancel +
 * multiplier input sync + the deferred Apply that creates a zone or commits a
 * context-menu edit) and the Delete Page confirm
 * (`#deletePageConfirmModal`: cancel + confirm -> the pending onDelete).
 * The Delete Zone confirm lived here until CONFIRM-ROUTE (2026-09-19); it is
 * App.confirmDialog now, awaited by app.js's openDeleteZoneForRect.
 *
 * Loaded as a classic <script src="/features/zone-modals.js"> AFTER app.js.
 * Its own IIFE: it reaches the cross-cutting state + helpers through the
 * shared window.App registry and binds everything at load. It registers
 * App.focusMultiplyZoneInput and (R14) App.openMultiplyZoneModal, the one opener
 * for both of the Multiply Zone dialog's jobs: app.js's X-tool canvas click
 * (a new zone, with the area's counts) and its context-menu Edit zone
 * multiplier (an edit) call it at call time. The pending state
 * (state.pendingMultiplyZone / pendingMultiplyZoneEdit /
 * pendingMultiplyZoneValue / pendingDeletePage) lives on the shared `state`
 * object; the Delete Page confirm's pending is written by page rows in app.js.
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
  (() => {
    const inputEl = document.getElementById('multiplyZoneMultiplier');
    const sync = () => { const v = parseInt(inputEl.value, 10); if (!isNaN(v) && v >= 1) App.state.pendingMultiplyZoneValue = v; };
    if (inputEl) {
      inputEl.oninput = inputEl.onchange = sync;
      inputEl.onblur = sync;
      // Enter applies, the way the dialog's one field asks to be used
      inputEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); sync(); document.getElementById('multiplyZoneApply').click(); } };
    }
    // The multiplier is the one thing the dialog asks: it opens with the caret in it and the
    // default selected, so typing 4 makes it 4. It opened unfocused, and the Repeats lesson's
    // "Type 4" typed into nothing (by hand, 2026-09-25). Mouse opens only: on touch the
    // on-screen keyboard would cover the preview. A touch tap reaches the same opener as a
    // click (the aim timer's synthetic click, or the loupe's commit), so the guard is here,
    // on the device's pointer, not on which path called (D22, R08).
    App.focusMultiplyZoneInput = () => {
      if (App.isCoarsePointer && App.isCoarsePointer()) return;
      requestAnimationFrame(() => { if (!inputEl || !inputEl.offsetParent) return; inputEl.focus(); inputEl.select(); });
    };
  })();
  // The Multiply Zone dialog's preview line. Duct runs (D17, J6-G) are named
  // only when the area holds one, so duct-free previews read as before.
  function multiplyZonePreviewText(counts, lenStr) {
    let txt = 'In this area: ' + counts.counterCount + ' counter(s), ' + counts.lineRunCount + ' line run(s) (' + lenStr + ')';
    if (counts.ductRunCount > 0) txt += ', ' + counts.ductRunCount + (counts.ductRunCount === 1 ? ' duct run' : ' duct runs');
    return txt;
  }
  // R14 (moved from app.js): the one opener for both of the dialog's jobs. A new zone,
  // { rect, counts, lenStr }, from the X tool's second corner in app.js's canvas click;
  // or an edit, { editIndex }, from the context menu's Edit zone multiplier. Returns
  // false (and opens nothing) when the edited zone is gone.
  function openMultiplyZoneModal(opts) {
    const state = App.state;
    if (opts && opts.editIndex != null) {
      const page = state.pages[state.currentPage];
      const ann = page ? App.getActiveAnnotations(page) : null;
      const zone = ann?.multiplyZones?.[opts.editIndex];
      if (!zone) return false;
      state.pendingMultiplyZoneEdit = { zoneIndex: opts.editIndex };
      state.pendingMultiplyZone = null;
      const mult = zone.multiplier ?? 1;
      state.pendingMultiplyZoneValue = mult;
      const inputEl = document.getElementById('multiplyZoneMultiplier');
      const previewEl = document.getElementById('multiplyZonePreview');
      const titleEl = document.querySelector('#multiplyZoneModal h2');
      if (inputEl) inputEl.value = String(mult);
      if (previewEl) previewEl.textContent = 'Change the multiplier for this zone.';
      if (titleEl) titleEl.textContent = 'Edit zone multiplier';
      App.showModal('multiplyZoneModal');
      if (App.focusMultiplyZoneInput) App.focusMultiplyZoneInput();
      return true;
    }
    const { x1, y1, x2, y2 } = opts.rect;
    state.pendingMultiplyZone = { x1, y1, x2, y2 };
    state.pendingMultiplyZoneValue = state.multiplyZoneSettings?.defaultMultiplier ?? 2;
    const mzTitleEl = document.querySelector('#multiplyZoneModal h2');
    if (mzTitleEl) mzTitleEl.textContent = 'Multiply Zone';
    document.getElementById('multiplyZonePreview').textContent = multiplyZonePreviewText(opts.counts, opts.lenStr);
    document.getElementById('multiplyZoneMultiplier').value = String(state.pendingMultiplyZoneValue);
    App.showModal('multiplyZoneModal');
    if (App.focusMultiplyZoneInput) App.focusMultiplyZoneInput();
    return true;
  }
  App.openMultiplyZoneModal = openMultiplyZoneModal;
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
        // J6 stay-armed (Tier-3 B8, gated on T2-10's drag gesture, now
        // shipped): a NEW zone commit keeps Multiply Zone armed so the next
        // typical floor is one drag away (the counter-tool pattern), with a
        // visible armed hint (J6 caution: silently-armed would make the
        // post-Apply pan click a silent corner 1). Toasts are non-blocking
        // corner cards since T2-15, so the hint never eats the next drag.
        // Context-menu edits (the branch above) arrive with no tool armed
        // and still leave the tool alone.
        state.tool = App.TOOL.MULTIPLY_ZONE;
        App.markProjectDirty();
        App.showToast('Zone added. Multiply Zone stays armed: drag the next zone, or press Esc to finish.', 4000);
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

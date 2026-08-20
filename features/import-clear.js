/*
 * features/import-clear.js - the Import Canvas + Clear Page flows, extracted
 * from the app.js IIFE as the twenty-eighth feature-file split under the
 * window.App registry pattern. Three related surfaces move together: the
 * canvas JSON import (`#importInput` change handler + the `#importBtn` /
 * `#importBtnSidebar` openers), the import-canvas-after-PDF prompt modal
 * (`#importCanvasAfterPdfModal`), and the Clear Page confirm flow
 * (`showClearPageModal` + the `#clearPage` / `#clearPageSidebar` openers and
 * the `#clearPageCancel` / `#clearPageConfirm` handlers, consolidated from the
 * zone & page-action handler block).
 *
 * Loaded as a classic <script src="/features/import-clear.js"> AFTER app.js.
 * Its own IIFE: it reaches the cross-cutting state + helpers through the
 * shared window.App registry, registers App.showClearPageModal (the Project
 * Settings "Clear page" row stays in app.js and reaches it via App.*), and
 * binds everything else at load — the bindings move with their DOM elements.
 *
 * Two publish-only deps were added for this split: App.applyPageAnnotationsFromData
 * (the shared per-page deserialize funnel, also used by cloud load / view mode)
 * and App.getActiveCanvas. The shared custom-icon upload handler that lived in
 * the same app.js section has since moved to features/custom-icon-upload.js
 * (registry split #37).
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  document.getElementById('importBtn').onclick = () => document.getElementById('importInput').click();
  document.getElementById('importBtnSidebar').onclick = () => document.getElementById('importInput').click();
  const importCanvasAfterPdfChoose = document.getElementById('importCanvasAfterPdfChoose');
  const importCanvasAfterPdfCancel = document.getElementById('importCanvasAfterPdfCancel');
  const importCanvasAfterPdfModalClose = document.getElementById('importCanvasAfterPdfModalClose');
  function closeImportCanvasAfterPdfModal() { App.hideModal('importCanvasAfterPdfModal'); }
  if (importCanvasAfterPdfChoose) {
    importCanvasAfterPdfChoose.onclick = () => {
      closeImportCanvasAfterPdfModal();
      document.getElementById('importInput').click();
    };
  }
  if (importCanvasAfterPdfCancel) importCanvasAfterPdfCancel.onclick = closeImportCanvasAfterPdfModal;
  if (importCanvasAfterPdfModalClose) importCanvasAfterPdfModalClose.onclick = closeImportCanvasAfterPdfModal;
  document.getElementById('importInput').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const state = App.state;
      // T3-B2: the catch used to wrap the WHOLE apply, so a valid export that
      // tripped a downstream bug was mislabeled "Invalid import file" — and a
      // wrong-shape-but-valid JSON silently wiped the palette. Narrowed: parse
      // + shape-gate first (refuse before touching state), then apply with its
      // own honest failure message. Raw errors go to the console either way.
      let data;
      try {
        data = JSON.parse(r.result);
      } catch (err) {
        console.error('[Import canvas] not JSON', err);
        App.showToast('This file isn\'t a canvas export — use Export Canvas to make one.', 5000);
        return;
      }
      // Shape gate: an Export Canvas file always carries counters/lineTypes/
      // pages arrays. Valid JSON without any of them is some other file.
      const looksLikeExport = data && typeof data === 'object' && !Array.isArray(data) &&
        (Array.isArray(data.counters) || Array.isArray(data.lineTypes) || Array.isArray(data.pages));
      if (!looksLikeExport) {
        App.showToast('This file isn\'t a canvas export — use Export Canvas to make one.', 5000);
        return;
      }
      try {
        state.counters = Array.isArray(data.counters) ? data.counters : [];
        state.lineTypes = Array.isArray(data.lineTypes) ? data.lineTypes : [];
        state.groups = App.ensureGroupColors(Array.isArray(data.groups) ? data.groups : []);
        state.groupsEnabled = !!data.groupsEnabled;
        state.rooms = Array.isArray(data.rooms) ? data.rooms : [];
        // Same replace-or-keep rule as cloud load (quick-keys.js).
        if (App.applyProjectQuickKeys) App.applyProjectQuickKeys(data.numberKeyBindings);
        else state.numberKeyBindings = (data.numberKeyBindings && typeof data.numberKeyBindings === 'object') ? data.numberKeyBindings : {};
        if (data.iconNames && typeof data.iconNames === 'object') state.iconNames = data.iconNames;
        if (Array.isArray(data.iconOrder)) state.iconOrder = data.iconOrder;
        if (data.legendSettings) state.legendSettings = { ...state.legendSettings, ...data.legendSettings };
        if (data.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...data.multiplyZoneSettings };
        if (data.scaleZoneSettings) state.scaleZoneSettings = { ...state.scaleZoneSettings, ...data.scaleZoneSettings };
        if (data.showGridOverlay != null) state.showGridOverlay = !!data.showGridOverlay;
        if (data.gridSettings) state.gridSettings = data.gridSettings;
        if (Array.isArray(data.customIconPaths)) App.saveUserCustomIcons(data.customIconPaths);
        // T3-B2 partial import: the export can cover more pages than the open
        // PDF — pages whose index doesn't exist here are silently dropped by
        // the matcher (state.pages[p.index] is undefined). Count what actually
        // landed and tell the user when it's only some of them.
        const importPages = Array.isArray(data.pages) ? data.pages : [];
        let appliedPages = 0;
        importPages.forEach(p => {
          if (!p) return;
          if (state.pages[p.index]) appliedPages++;
          App.applyPageAnnotationsFromData(state.pages[p.index], p, data.scale || null);
        });
        if (data.maxZoom != null) state.maxZoom = data.maxZoom; else state.maxZoom = null;
        App.reconcileOrphanedCountersAndLineTypes();
        App.clearUndoStacks();
        App.markProjectDirty();
        App.updateUI();
        App.renderPdf();
        if (importPages.length > 0 && appliedPages < importPages.length) {
          App.showToast('Applied marks to ' + appliedPages + ' of ' + importPages.length +
            ' pages — the export covers more pages than this PDF.', 6000);
        }
      } catch (err) {
        console.error('[Import canvas] apply failed', err);
        App.showToast('Couldn\'t apply this canvas file.', 5000);
      }
    };
    r.readAsText(f);
    e.target.value = '';
  };

  function showClearPageModal() {
    const state = App.state;
    const page = state.pages[state.currentPage];
    const canvas = page ? App.getActiveCanvas(page) : null;
    const name = canvas?.name || 'Main';
    const msg = document.getElementById('clearPageConfirmMessage');
    if (msg) msg.textContent = 'Clear current canvas (' + name + ')?';
    App.showModal('clearPageConfirmModal');
  }
  document.getElementById('clearPage').onclick = () => showClearPageModal();
  document.getElementById('clearPageSidebar').onclick = () => showClearPageModal();
  document.getElementById('clearPageCancel').onclick = () => App.hideModal('clearPageConfirmModal');
  document.getElementById('clearPageConfirm').onclick = () => {
    const state = App.state;
    App.hideModal('clearPageConfirmModal');
    App.pushUndoSnapshot();
    const page = state.pages[state.currentPage];
    const canvas = page && App.getActiveCanvas(page);
    if (canvas) canvas.annotations = App.makeAnnotations();
    if (state.selectedLinePageIdx === state.currentPage) {
      state.selectedLineId = null;
      state.selectedLineIsPoly = false;
      state.selectedLinePageIdx = null;
    }
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  };

  App.showClearPageModal = showClearPageModal;
})();

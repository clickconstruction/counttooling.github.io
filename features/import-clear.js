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
 * the same app.js section stays there (icon-domain infrastructure feeding four
 * icon grids across app.js + three feature files).
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
      try {
        const data = JSON.parse(r.result);
        state.counters = Array.isArray(data.counters) ? data.counters : [];
        state.lineTypes = Array.isArray(data.lineTypes) ? data.lineTypes : [];
        state.groups = App.ensureGroupColors(Array.isArray(data.groups) ? data.groups : []);
        state.rooms = Array.isArray(data.rooms) ? data.rooms : [];
        if (data.iconNames && typeof data.iconNames === 'object') state.iconNames = data.iconNames;
        if (Array.isArray(data.iconOrder)) state.iconOrder = data.iconOrder;
        if (data.legendSettings) state.legendSettings = { ...state.legendSettings, ...data.legendSettings };
        if (data.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...data.multiplyZoneSettings };
        if (data.showGridOverlay != null) state.showGridOverlay = !!data.showGridOverlay;
        if (data.gridSettings) state.gridSettings = data.gridSettings;
        if (Array.isArray(data.customIconPaths)) App.saveUserCustomIcons(data.customIconPaths);
        (data.pages || []).forEach(p => {
          App.applyPageAnnotationsFromData(state.pages[p.index], p, data.scale || null);
        });
        if (data.maxZoom != null) state.maxZoom = data.maxZoom; else state.maxZoom = null;
        App.reconcileOrphanedCountersAndLineTypes();
        App.clearUndoStacks();
        App.markProjectDirty();
        App.updateUI();
        App.renderPdf();
      } catch (err) { alert('Invalid import file'); }
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

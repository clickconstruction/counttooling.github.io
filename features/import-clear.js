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
 * and App.getActiveCanvas. Since R12 (2026-09-26) the import reads the whole file
 * through App.hydrateStateFromProjectData, the intake every project load shares. The shared custom-icon upload handler that lived in
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
  function closeImportCanvasAfterPdfModal() { App.hideModal('importCanvasAfterPdfModal'); }
  if (importCanvasAfterPdfChoose) {
    importCanvasAfterPdfChoose.onclick = () => {
      closeImportCanvasAfterPdfModal();
      document.getElementById('importInput').click();
    };
  }
  if (importCanvasAfterPdfCancel) importCanvasAfterPdfCancel.onclick = closeImportCanvasAfterPdfModal;
  document.getElementById('importInput').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const state = App.state;
      try {
        const data = JSON.parse(r.result);
        // R12: the shared intake (annotation-model.js). An old export's one `scale`
        // fills the sheets saved without one; D19: the layer each sheet was on comes
        // back, kept to the sheets this plan has. B2 / J10: it counts how many of the
        // export's sheets land on a sheet of THIS plan (a shorter plan used to drop the
        // extras silently), for the toast below.
        const { pageEntries, appliedPages } = App.hydrateStateFromProjectData(data, { scaleFallback: data.scale || null, trimLayers: true });
        App.reconcileOrphanedCountersAndLineTypes();
        App.clearUndoStacks();
        App.markProjectDirty();
        App.updateUI();
        App.renderPdf();
        if (pageEntries && appliedPages < pageEntries) {
          App.showToast('Applied marks to ' + appliedPages + ' of ' + pageEntries +
            ' pages. The plan has fewer pages than the export.', 6000);
        }
      } catch (err) {
        // B2 / J12: in-app toast (T2-04 toast region) instead of the native
        // alert('Invalid import file'), and it says what a valid file IS.
        console.error('[Import Canvas]', err);
        App.showToast('That file isn’t a canvas export. Import Canvas reads the .json file that Export Canvas creates.', 6000);
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
    // B14: the layer qualifier is load-bearing — "Clear Page" only empties the
    // ACTIVE layer, and trade language beats "canvas" (J9).
    const n = canvas ? App.countCanvasMarks(canvas.annotations) : 0;
    const marks = n + (n === 1 ? ' mark' : ' marks');
    if (msg) msg.textContent = 'Removes ' + marks + ' from this page\'s ' + name + ' layer. Other layers keep theirs. Undo brings them back.';
    const btn = document.getElementById('clearPageConfirm');
    if (btn) btn.textContent = n ? 'Clear ' + marks : 'Clear page';
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

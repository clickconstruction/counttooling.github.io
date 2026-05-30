/*
 * features/canvas-repair.js - Canvas Repair modal, extracted from the app.js
 * IIFE as the pilot for the window.App feature-registry pattern.
 *
 * Loaded as a classic <script src="features/canvas-repair.js"> AFTER app.js.
 * It is its own IIFE: it reaches the cross-cutting state + helpers through the
 * shared `window.App` registry that app.js populates during its own load, and
 * registers its public entry points (openCanvasRepairModal / applyCanvasRepair)
 * back onto App. app.js invokes those via deferred bindings (() => App.fn()),
 * so resolution always happens at click time, after this file has loaded.
 *
 * Boundary rule: all shared dependencies are read from `App.*` at call time
 * (never captured at load), so load order beyond "after app.js" does not matter.
 * See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function openCanvasRepairModal() {
    const state = App.state;
    if (!state.pages || !state.pages.length) return;
    const tbody = document.getElementById('canvasRepairBody');
    tbody.innerHTML = '';
    const ROT_OPTS = [0, 90, 180, 270];
    state.pages.forEach((page, i) => {
      const tr = document.createElement('tr');
      tr.dataset.pageIndex = String(i);
      const sourceSelect = document.createElement('select');
      sourceSelect.dataset.field = 'source';
      for (let j = 0; j < state.pages.length; j++) {
        const opt = document.createElement('option');
        opt.value = String(j);
        opt.textContent = 'Page ' + (j + 1);
        if (j === i) opt.selected = true;
        sourceSelect.appendChild(opt);
      }
      const rotSelect = document.createElement('select');
      rotSelect.dataset.field = 'rotation';
      ROT_OPTS.forEach(r => {
        const opt = document.createElement('option');
        opt.value = String(r);
        opt.textContent = r + '°';
        if (r === (page.rotation ?? 0)) opt.selected = true;
        rotSelect.appendChild(opt);
      });
      tr.innerHTML = '<td>Page ' + (i + 1) + '</td><td></td><td></td>';
      tr.querySelector('td:nth-child(2)').appendChild(sourceSelect);
      tr.querySelector('td:nth-child(3)').appendChild(rotSelect);
      tbody.appendChild(tr);
    });
    document.getElementById('canvasRepairResetRotations').onclick = () => {
      tbody.querySelectorAll('select[data-field="rotation"]').forEach(s => { s.value = '0'; });
    };
    App.showModal('canvasRepairModal');
  }

  function applyCanvasRepair() {
    const state = App.state;
    const tbody = document.getElementById('canvasRepairBody');
    if (!tbody || !state.pages.length) return;
    const rows = tbody.querySelectorAll('tr[data-page-index]');
    const newPages = state.pages.map((page) => ({ ...page, pdfPage: page.pdfPage, label: page.label }));
    const sourceCanvases = state.pages.map(p => JSON.parse(JSON.stringify(p.canvases || [])));
    rows.forEach((tr, i) => {
      const srcSelect = tr.querySelector('select[data-field="source"]');
      const rotSelect = tr.querySelector('select[data-field="rotation"]');
      if (!srcSelect || !rotSelect) return;
      const srcIdx = parseInt(srcSelect.value, 10);
      const targetRot = parseInt(rotSelect.value, 10);
      if (isNaN(srcIdx) || srcIdx < 0 || srcIdx >= state.pages.length) return;
      if (isNaN(targetRot)) return;
      const srcPage = state.pages[srcIdx];
      const srcCanvases = sourceCanvases[srcIdx];
      newPages[i].canvases = (srcCanvases && srcCanvases.length) ? srcCanvases : [{ id: App.uid(), name: 'Main', annotations: App.makeAnnotations() }];
      delete newPages[i].annotations;
      newPages[i].scale = srcPage?.scale ?? null;
      const srcRot = srcPage?.rotation ?? 0;
      newPages[i].rotation = srcRot;
      const delta = ((targetRot - srcRot) + 360) % 360;
      if (delta !== 0) App.applyRotationDeltaToAnnotations(newPages[i], delta);
      newPages[i].rotation = targetRot;
    });
    App.pushUndoSnapshot();
    state.pages = newPages;
    App.reconcileOrphanedCountersAndLineTypes();
    App.markProjectDirty();
    App.hideModal('canvasRepairModal');
    App.renderPdf();
    App.updateUI();
  }

  App.openCanvasRepairModal = openCanvasRepairModal;
  App.applyCanvasRepair = applyCanvasRepair;
})();

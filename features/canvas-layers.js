/*
 * features/canvas-layers.js - the canvas-layer management UI, extracted from
 * the app.js IIFE as the thirty-first feature-file split under the window.App
 * registry pattern (and the last candidate named by the original extraction
 * recipe). Four surfaces move together: the Add Canvas modal
 * (`#addCanvasModal`: new / duplicate-current modes + name), the Canvas
 * Details modal (`#canvasDetailsModal`: rename-on-close + delete entry), the
 * Delete Canvas confirm (`#deleteCanvasConfirmModal` -> the private
 * performDeleteCanvas), and the footer layers menu (`#canvasLayersBtn` /
 * `#canvasMenu` / `#canvasMenuAdd`) plus the `#addCanvasBtn` and
 * show-all-canvases peek (`#showAllCanvasesBtn`) toggles.
 *
 * Loaded as a classic <script src="/features/canvas-layers.js"> AFTER app.js.
 * Its own IIFE: reaches state + helpers through the shared window.App
 * registry; the mode/edit/delete state (pendingAddCanvasMode,
 * pendingCanvasEdit, pendingDeleteCanvas) lives here as private `let`s. Core
 * hooks: the `hideModal` resets call the registered App.onCanvasDetailsHidden
 * / App.onDeleteCanvasConfirmHidden callbacks (Groups pattern), the canvas
 * switcher's edit pen (renderCanvasSwitcher, app.js) opens the details modal
 * via App.openCanvasDetailsModal, and the Escape branch for the details modal
 * dispatches `#canvasDetailsClose`'s click so the rename-commit stays in one
 * place. One new publish-only dep: App.deepCopyAnnotations (used by the
 * duplicate-layer mode). The canvas JSON export (`#exportBtn`) that shared
 * the old section stays in app.js.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  let pendingAddCanvasMode = 'new';
  let pendingCanvasEdit = null;
  let pendingDeleteCanvas = null;

  function openAddCanvasModal() {
    const state = App.state;
    if (!state.pages.length || state.isViewer) return;
    const page = state.pages[state.currentPage];
    const canvases = App.getPageCanvases(page);
    const n = canvases.length + 1;
    pendingAddCanvasMode = 'new';
    const newBtn = document.getElementById('addCanvasModalNew');
    const dupBtn = document.getElementById('addCanvasModalDuplicate');
    const nameInput = document.getElementById('addCanvasModalName');
    if (newBtn) newBtn.classList.add('selected');
    if (dupBtn) dupBtn.classList.remove('selected');
    nameInput.placeholder = 'Layer ' + n;
    nameInput.value = '';
    App.showModal('addCanvasModal');
    nameInput.focus();
  }

  function updateAddCanvasModalForMode() {
    const state = App.state;
    const page = state.pages[state.currentPage];
    const canvases = App.getPageCanvases(page);
    const currentCanvas = App.getActiveCanvas(page);
    const n = canvases.length + 1;
    const nameInput = document.getElementById('addCanvasModalName');
    if (pendingAddCanvasMode === 'duplicate') {
      const baseName = currentCanvas?.name || 'Main';
      nameInput.placeholder = 'Copy of ' + baseName;
      nameInput.value = 'Copy of ' + baseName;
    } else {
      nameInput.placeholder = 'Layer ' + n;
      nameInput.value = '';
    }
  }

  function doAddCanvas(mode, name) {
    const state = App.state;
    if (!state.pages.length || state.isViewer) return;
    const page = state.pages[state.currentPage];
    const canvases = App.getPageCanvases(page);
    const n = canvases.length + 1;
    const defaultNew = 'Layer ' + n;
    const currentCanvas = App.getActiveCanvas(page);
    const defaultDup = 'Copy of ' + (currentCanvas?.name || 'Main');
    const finalName = (name || '').trim() || (mode === 'duplicate' ? defaultDup : defaultNew);
    if (!finalName) return;
    App.pushUndoSnapshot();
    const annotations = mode === 'duplicate' ? App.deepCopyAnnotations(App.getActiveAnnotations(page)) : App.makeAnnotations();
    const newCanvas = { id: App.uid(), name: finalName, annotations };
    if (!page.canvases) page.canvases = [];
    page.canvases.push(newCanvas);
    state.activeCanvasIdByPage[state.currentPage] = newCanvas.id;
    App.markProjectDirty();
    App.renderPdf();
    App.updateUI();
  }

  function openCanvasDetailsModal(canvas) {
    const state = App.state;
    if (!state.pages.length || state.isViewer) return;
    const page = state.pages[state.currentPage];
    const canvases = App.getPageCanvases(page);
    if (!canvases.includes(canvas)) return;
    document.getElementById('canvasMenu')?.classList.remove('visible');
    pendingCanvasEdit = canvas;
    const nameInput = document.getElementById('canvasDetailsName');
    const deleteBtn = document.getElementById('canvasDetailsDelete');
    if (nameInput) nameInput.value = canvas.name || 'Main';
    if (deleteBtn) deleteBtn.style.display = canvases.length <= 1 ? 'none' : '';
    App.showModal('canvasDetailsModal');
    nameInput?.focus();
  }

  function performDeleteCanvas(canvas) {
    const state = App.state;
    if (!state.pages.length || state.isViewer) return;
    const page = state.pages[state.currentPage];
    const canvases = App.getPageCanvases(page);
    if (canvases.length <= 1) return;
    const idx = canvases.indexOf(canvas);
    if (idx < 0) return;
    App.pushUndoSnapshot();
    page.canvases.splice(idx, 1);
    if (state.activeCanvasIdByPage[state.currentPage] === canvas.id) {
      const remaining = App.getPageCanvases(page);
      state.activeCanvasIdByPage[state.currentPage] = remaining[0]?.id ?? null;
    }
    App.markProjectDirty();
    App.renderPdf();
    App.updateUI();
  }

  document.getElementById('addCanvasBtn').onclick = () => openAddCanvasModal();
  // Show-all-canvases peek toggle (desktop, next to the canvas selector; the
  // opposite of the hide-marks eye). Visual only — no dirty, no persistence.
  document.getElementById('showAllCanvasesBtn').onclick = () => {
    const state = App.state;
    state.showAllCanvases = !state.showAllCanvases;
    App.renderAnnotations();
    App.updateUI();
  };

  const addCanvasModalNew = document.getElementById('addCanvasModalNew');
  const addCanvasModalDuplicate = document.getElementById('addCanvasModalDuplicate');
  const addCanvasModalName = document.getElementById('addCanvasModalName');
  const addCanvasModalCancel = document.getElementById('addCanvasModalCancel');
  const addCanvasModalCreate = document.getElementById('addCanvasModalCreate');
  if (addCanvasModalNew) {
    addCanvasModalNew.onclick = () => {
      pendingAddCanvasMode = 'new';
      addCanvasModalNew.classList.add('selected');
      if (addCanvasModalDuplicate) addCanvasModalDuplicate.classList.remove('selected');
      updateAddCanvasModalForMode();
    };
  }
  if (addCanvasModalDuplicate) {
    addCanvasModalDuplicate.onclick = () => {
      pendingAddCanvasMode = 'duplicate';
      addCanvasModalDuplicate.classList.add('selected');
      if (addCanvasModalNew) addCanvasModalNew.classList.remove('selected');
      updateAddCanvasModalForMode();
    };
  }
  if (addCanvasModalCancel) addCanvasModalCancel.onclick = () => App.hideModal('addCanvasModal');
  if (addCanvasModalCreate) {
    addCanvasModalCreate.onclick = () => {
      const name = addCanvasModalName?.value?.trim() || addCanvasModalName?.placeholder || '';
      App.hideModal('addCanvasModal');
      doAddCanvas(pendingAddCanvasMode, name);
    };
  }
  if (addCanvasModalName) {
    addCanvasModalName.onkeydown = (e) => {
      if (e.key === 'Enter') addCanvasModalCreate?.click();
    };
  }

  document.getElementById('canvasDetailsClose').onclick = () => {
    const canvas = pendingCanvasEdit;
    const nameInput = document.getElementById('canvasDetailsName');
    if (canvas && nameInput) {
      canvas.name = (nameInput.value || '').trim() || 'Main';
      App.markProjectDirty();
      App.updateUI();
    }
    pendingCanvasEdit = null;
    App.hideModal('canvasDetailsModal');
  };
  document.getElementById('canvasDetailsDelete').onclick = () => {
    const state = App.state;
    const canvas = pendingCanvasEdit;
    if (!canvas) return;
    const page = state.pages[state.currentPage];
    const canvases = App.getPageCanvases(page);
    if (canvases.length <= 1) return;
    pendingDeleteCanvas = canvas;
    document.getElementById('deleteCanvasName').textContent = canvas.name || 'Main';
    App.hideModal('canvasDetailsModal');
    App.showModal('deleteCanvasConfirmModal');
  };
  document.getElementById('canvasDetailsName').onkeydown = (e) => {
    if (e.key === 'Enter') document.getElementById('canvasDetailsClose').click();
  };

  document.getElementById('deleteCanvasCancel').onclick = () => {
    pendingDeleteCanvas = null;
    App.hideModal('deleteCanvasConfirmModal');
  };
  document.getElementById('deleteCanvasConfirm').onclick = () => {
    const canvas = pendingDeleteCanvas;
    pendingDeleteCanvas = null;
    App.hideModal('deleteCanvasConfirmModal');
    if (canvas) {
      performDeleteCanvas(canvas);
    }
  };

  const canvasLayersBtn = document.getElementById('canvasLayersBtn');
  const canvasMenu = document.getElementById('canvasMenu');
  const canvasMenuAdd = document.getElementById('canvasMenuAdd');
  if (canvasLayersBtn && canvasMenu) {
    canvasLayersBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (canvasMenu.classList.contains('visible')) {
        canvasMenu.classList.remove('visible');
        return;
      }
      canvasMenu.style.left = '-9999px';
      canvasMenu.classList.add('visible');
      const btnRect = canvasLayersBtn.getBoundingClientRect();
      canvasMenu.style.left = btnRect.left + 'px';
      canvasMenu.style.top = Math.max(8, btnRect.top - canvasMenu.offsetHeight - 4) + 'px';
    });
  }
  if (canvasMenuAdd && canvasMenu) {
    canvasMenuAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      canvasMenu.classList.remove('visible');
      openAddCanvasModal();
    });
  }

  App.openCanvasDetailsModal = openCanvasDetailsModal;
  // Core-function -> feature callbacks: the hideModal resets in app.js.
  App.onCanvasDetailsHidden = () => { pendingCanvasEdit = null; };
  App.onDeleteCanvasConfirmHidden = () => { pendingDeleteCanvas = null; };
})();

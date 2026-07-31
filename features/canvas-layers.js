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
    App.renderAnnotations();
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
    App.renderAnnotations();
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

  // --- Selective peek chooser (right-click on the peek button) --------------
  // #canvasPeekMenu: a checklist popover over the page's layers. The active
  // layer is always shown (pinned row); checking others narrows the peek to
  // that subset via state.peekCanvasIdsByPage (empty array = active only,
  // absent = all). Same in-memory/visual-only contract as the peek flag.
  // Dismissal follows the tool-context-menu pattern: listeners attached only
  // while open; Escape is swallowed in the capture phase so the app's global
  // Escape (modal close) never sees the press.
  let peekMenuPageIdx = null;   // the page the open menu was built for

  function hideCanvasPeekMenu() {
    const menu = document.getElementById('canvasPeekMenu');
    if (!menu || !menu.classList.contains('visible')) return;
    menu.classList.remove('visible');
    peekMenuPageIdx = null;
    document.removeEventListener('pointerdown', onPeekDocPointerDown, true);
    document.removeEventListener('keydown', onPeekDocKeyDown, true);
    window.removeEventListener('resize', hideCanvasPeekMenu);
  }
  function onPeekDocPointerDown(e) {
    const menu = document.getElementById('canvasPeekMenu');
    if (menu && !menu.contains(e.target)) hideCanvasPeekMenu();
  }
  function onPeekDocKeyDown(e) {
    if (e.key !== 'Escape') return;
    e.stopImmediatePropagation();
    e.preventDefault();
    hideCanvasPeekMenu();
  }

  function togglePeekCanvas(canvasId) {
    const state = App.state;
    const page = state.pages[peekMenuPageIdx];
    if (!page || peekMenuPageIdx !== state.currentPage) { hideCanvasPeekMenu(); return; }
    const canvases = App.getPageCanvases(page);
    const active = App.getActiveCanvas(page);
    const otherIds = canvases.filter(c => c !== active).map(c => c.id);
    const map = state.peekCanvasIdsByPage;
    // Absent selection = all: unchecking one layer materializes "all the others".
    let sel = map[peekMenuPageIdx] ? map[peekMenuPageIdx].slice() : otherIds.slice();
    sel = sel.includes(canvasId) ? sel.filter(id => id !== canvasId) : sel.concat(canvasId);
    // Normalize: every non-active layer checked is just "all" again.
    if (otherIds.every(id => sel.includes(id))) delete map[peekMenuPageIdx];
    else map[peekMenuPageIdx] = sel;
    state.showAllCanvases = true;
    App.renderAnnotations();
    App.updateUI();
    renderCanvasPeekMenu();
  }

  function renderCanvasPeekMenu() {
    const menu = document.getElementById('canvasPeekMenu');
    const state = App.state;
    if (!menu) return;
    const page = state.pages[peekMenuPageIdx];
    const canvases = page ? App.getPageCanvases(page) : [];
    if (peekMenuPageIdx !== state.currentPage || canvases.length < 2) { hideCanvasPeekMenu(); return; }
    const active = App.getActiveCanvas(page);
    const sel = state.peekCanvasIdsByPage[peekMenuPageIdx] || null;   // null = all
    menu.innerHTML = '';
    const mkRow = (label, checked, onPick, opts) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'canvas-menu-item canvas-peek-item';
      const box = document.createElement('span');
      box.className = 'canvas-peek-check' + (checked ? ' checked' : '');
      box.textContent = checked ? '✓' : '';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'canvas-peek-name';
      nameSpan.textContent = label;
      row.appendChild(box);
      row.appendChild(nameSpan);
      if (opts && opts.pinned) {
        const pin = document.createElement('span');
        pin.className = 'canvas-peek-pinned';
        pin.textContent = 'current';
        row.appendChild(pin);
        row.disabled = true;
      }
      if (onPick) row.onclick = (e) => { e.stopPropagation(); onPick(); };
      menu.appendChild(row);
    };
    mkRow('All canvases', !sel, () => {
      delete state.peekCanvasIdsByPage[peekMenuPageIdx];
      state.showAllCanvases = true;
      App.renderAnnotations();
      App.updateUI();
      renderCanvasPeekMenu();
    });
    canvases.forEach(c => {
      if (c === active) mkRow(c.name || 'Main', true, null, { pinned: true });
      else mkRow(c.name || 'Main', !sel || sel.includes(c.id), () => togglePeekCanvas(c.id));
    });
  }

  function openCanvasPeekMenu() {
    const state = App.state;
    const btn = document.getElementById('showAllCanvasesBtn');
    const menu = document.getElementById('canvasPeekMenu');
    if (!btn || !menu || !state.pages.length) return;
    const page = state.pages[state.currentPage];
    if (App.getPageCanvases(page).length < 2) return;
    if (menu.classList.contains('visible')) { hideCanvasPeekMenu(); return; }
    peekMenuPageIdx = state.currentPage;
    renderCanvasPeekMenu();
    if (!menu.childNodes.length) return;
    // Above the button, like the layers menu (footer anchor).
    menu.style.left = '-9999px';
    menu.classList.add('visible');
    const btnRect = btn.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(btnRect.left, window.innerWidth - menu.offsetWidth - 4)) + 'px';
    menu.style.top = Math.max(8, btnRect.top - menu.offsetHeight - 4) + 'px';
    document.addEventListener('pointerdown', onPeekDocPointerDown, true);
    document.addEventListener('keydown', onPeekDocKeyDown, true);
    window.addEventListener('resize', hideCanvasPeekMenu);
    // No scroll-dismiss (unlike tool-context-menu): the anchor button lives in
    // the fixed footer, and the checkbox toggles themselves trigger updateUI
    // scroll events that would close the menu mid-selection.
  }

  document.getElementById('showAllCanvasesBtn').oncontextmenu = (e) => {
    e.preventDefault();
    openCanvasPeekMenu();
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

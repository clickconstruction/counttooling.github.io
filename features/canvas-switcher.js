(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/canvas-switcher.js - the footer canvas switcher renderer
   * (renderCanvasSwitcher: current-name label, (n/N) index, pills, layers
   * dropdown rows, show-all peek button visibility), extracted from app.js's
   * UI Render Functions region per the lines-list recipe. updateUI reaches it
   * defensively via App.renderCanvasSwitcher; the edit pen keeps calling
   * features/canvas-layers.js through App.openCanvasDetailsModal. Zero new
   * publish-only deps — everything it reads was already on the registry.
   * Boundary rule: read shared deps from App.* at call time, never at load.
   */

  function renderCanvasSwitcher() {
    const switcher = document.getElementById('canvasSwitcher');
    const pillsEl = document.getElementById('canvasPills');
    const addBtn = document.getElementById('addCanvasBtn');
    const layersBtn = document.getElementById('canvasLayersBtn');
    const menuList = document.getElementById('canvasMenuList');
    const canvasMenu = document.getElementById('canvasMenu');
    if (!switcher || !pillsEl || !addBtn) return;
    const page = App.state.pages[App.state.currentPage];
    const canvases = page ? App.getPageCanvases(page) : [];
    const activeId = page ? (App.state.activeCanvasIdByPage[App.state.currentPage] || (canvases[0]?.id)) : null;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const canvasNameEl = document.getElementById('canvasCurrentName');
    if (canvasNameEl) {
      const activeCanvas = activeId ? canvases.find(c => c.id === activeId) : canvases[0];
      canvasNameEl.textContent = activeCanvas?.name || 'Main';
      canvasNameEl.style.display = App.state.pages.length > 0 ? '' : 'none';
    }
    const indexEl = document.getElementById('canvasIndexDisplay');
    if (indexEl) {
      if (canvases.length > 0 && activeId) {
        const idx = canvases.findIndex(c => c.id === activeId);
        const oneBased = idx >= 0 ? idx + 1 : 1;
        indexEl.textContent = '(' + oneBased + '/' + canvases.length + ')';
        indexEl.style.display = '';
      } else {
        indexEl.textContent = '';
        indexEl.style.display = 'none';
      }
    }
    pillsEl.innerHTML = '';
    if (canvases.length === 0) {
      pillsEl.style.display = 'none';
      addBtn.style.display = App.state.pages.length > 0 && !App.state.isViewer ? '' : 'none';
      if (pillsEl && !isMobile) pillsEl.classList.remove('canvas-pills-multi');
    } else {
      pillsEl.style.display = 'flex';
      addBtn.style.display = App.state.isViewer ? 'none' : '';
      if (pillsEl && !isMobile) pillsEl.classList.toggle('canvas-pills-multi', canvases.length >= 3);
      canvases.forEach(c => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'canvas-pill' + (c.id === activeId ? ' active' : '');
        pill.textContent = c.name || 'Main';
        pill.title = c.name || 'Main';
        pill.dataset.canvasId = c.id;
        pill.onclick = (e) => {
          e.stopPropagation();
          App.state.activeCanvasIdByPage[App.state.currentPage] = c.id;
          if (!App.state.isViewer) App.markProjectDirty();
          App.renderAnnotations();
          App.updateUI();
        };
        pillsEl.appendChild(pill);
      });
    }
    if (layersBtn && menuList && canvasMenu) {
      const showLayersDropdown = (isMobile || (!isMobile && canvases.length >= 1)) && App.state.pages.length > 0;
      layersBtn.style.display = showLayersDropdown ? '' : 'none';
      layersBtn.classList.toggle('canvas-layers-multi', canvases.length > 1);
      const canvasMenuAdd = document.getElementById('canvasMenuAdd');
      if (canvasMenuAdd) canvasMenuAdd.style.display = App.state.isViewer ? 'none' : '';
      switcher?.classList.toggle('canvas-layers-desktop-visible', !isMobile && canvases.length >= 1);
      const showAllBtn = document.getElementById('showAllCanvasesBtn');
      if (showAllBtn) {
        // Only meaningful with 2+ layers; desktop only (the mobile switcher is
        // already the compact layers menu). Auto-off when layers drop to one.
        if (App.state.showAllCanvases && canvases.length < 2) App.state.showAllCanvases = false;
        showAllBtn.style.display = (!isMobile && canvases.length > 1 && App.state.pages.length > 0) ? '' : 'none';
        showAllBtn.classList.toggle('active', !!App.state.showAllCanvases);
        showAllBtn.title = App.state.showAllCanvases
          ? 'Showing all canvases — click to show only the active canvas'
          : 'Temporarily show all canvases at once';
      }
      menuList.innerHTML = '';
      canvases.forEach(c => {
        const row = document.createElement('div');
        row.className = 'canvas-menu-item' + (c.id === activeId ? ' active' : '');
        row.dataset.canvasId = c.id;
        const nameSpan = document.createElement('span');
        nameSpan.textContent = c.name || 'Main';
        nameSpan.style.flex = '1';
        nameSpan.style.minWidth = '0';
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.style.whiteSpace = 'nowrap';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'canvas-menu-item-edit';
        editBtn.title = 'Edit';
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16"><path fill="currentColor" d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/></svg>';
        editBtn.onclick = (e) => {
          e.stopPropagation();
          if (App.state.isViewer) return;
          App.openCanvasDetailsModal(c);
        };
        row.appendChild(editBtn);
        row.appendChild(nameSpan);
        row.onclick = (e) => {
          if (e.target.closest('.canvas-menu-item-edit')) return;
          e.stopPropagation();
          App.state.activeCanvasIdByPage[App.state.currentPage] = c.id;
          if (!App.state.isViewer) App.markProjectDirty();
          App.renderAnnotations();
          App.updateUI();
          canvasMenu.classList.remove('visible');
        };
        menuList.appendChild(row);
      });
    }
  }

  App.renderCanvasSwitcher = renderCanvasSwitcher;
})();

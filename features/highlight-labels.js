/*
 * features/highlight-labels.js - named highlights: label a highlight rect and
 * jump back to it from a bookmarks panel.
 *
 * Why it exists (field request): a reviewer checking a bid wants the sender to
 * be able to highlight a spec section ("pipe material", "fixture schedule"),
 * NAME it, and have the reviewer jump straight to that page from a list —
 * highlights as shared reference points, not just ink.
 *
 * Two surfaces:
 *  - Naming: right-click a highlight on the plan -> "Name highlight…"
 *    (#ctxNameHighlight, shown by app.js's showContextMenu) opens
 *    #highlightNameModal; Save writes h.label onto the highlight annotation.
 *    The label is drawn on the plan by drawAnnotationsCore (canvas-draw.js) in
 *    BOTH the live overlay and every export path, and rides the annotation
 *    through save/load + export/import untouched (the annotation appliers pass
 *    highlight arrays through whole).
 *  - The bookmarks panel (#highlightPanel, markup in app/index.html): the
 *    Chain/Drop palette idiom wholesale — shown while TOOL.HIGHLIGHT is
 *    active, draggable by its title bar (position per device in localStorage
 *    `highlightPanelPos`, ignored when it no longer fits), closable without
 *    leaving the tool (Esc ladder: cancel rect -> close panel -> exit tool).
 *    Rows list every page's highlights (merged across canvas layers, named
 *    first); a row click jumps to that page (the lines-list jump pattern), ✎
 *    opens the same name modal.
 *
 * app.js integration points: updateUI calls App.onHighlightToolSync; the
 * #highlightBtn handler calls App.openHighlightPanel (re-click reopens); the
 * Escape branch uses App.isHighlightPanelOpen / App.closeHighlightPanel;
 * showContextMenu shows #ctxNameHighlight for highlight targets (this file
 * owns its click handler).
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  let panelCollapsed = false;
  let wired = false;
  const PANEL_POS_KEY = 'highlightPanelPos';

  // The highlight being named while #highlightNameModal is up ({ h, pageIdx }),
  // else null. Held by reference: the merged per-page arrays push the live
  // annotation objects, so writing .label here mutates the persisted mark.
  let naming = null;

  function loadPanelPos() {
    try { return JSON.parse(localStorage.getItem(PANEL_POS_KEY)) || null; } catch { return null; }
  }

  function applyPanelPos(panel) {
    const pos = loadPanelPos();
    if (!pos) return;
    const w = panel.offsetWidth || 200;
    if (pos.x < 0 || pos.y < 0 || pos.x + w > window.innerWidth || pos.y + 60 > window.innerHeight) return;
    panel.style.left = pos.x + 'px';
    panel.style.top = pos.y + 'px';
  }

  function wireDrag(panel) {
    const head = document.getElementById('highlightPanelHead');
    if (!head) return;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#highlightPanelClose')) return;
      const rect = panel.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
      head.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const x = Math.max(0, Math.min(ev.clientX - offX, window.innerWidth - rect.width));
        const y = Math.max(0, Math.min(ev.clientY - offY, window.innerHeight - 60));
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
      };
      const up = () => {
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        const r = panel.getBoundingClientRect();
        try { localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch { /* storage full/blocked — position just won't persist */ }
      };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
      e.preventDefault();
    });
  }

  // Every highlight across every page, merged across canvas layers (live
  // object references — rows mutate/jump against these). Page order; named
  // before unnamed within a page.
  function collectRows() {
    const state = App.state;
    const rows = [];
    (state.pages || []).forEach((page, pageIdx) => {
      const merged = App.getMergedAnnotationsForPage(page);
      (merged?.highlights || []).forEach(h => rows.push({ h, pageIdx }));
    });
    rows.sort((a, b) => a.pageIdx - b.pageIdx || (b.h.label ? 1 : 0) - (a.h.label ? 1 : 0));
    return rows;
  }

  function renderList() {
    const list = document.getElementById('highlightList');
    if (!list) return;
    const esc = App.escapeHtml;
    const rows = collectRows();
    if (!rows.length) {
      list.innerHTML = '<div class="chain-list-empty">No highlights yet — drag a box over a section of the plan, then right-click it to name it.</div>';
      return;
    }
    list.innerHTML = rows.map((r, i) =>
      '<div class="highlight-row' + (r.h.label ? '' : ' unnamed') + '" data-i="' + i + '" role="button" tabindex="0" title="Go to page ' + (r.pageIdx + 1) + '">' +
      '<span class="hl-swatch" style="background:' + esc(r.h.color || '#e8c547') + '"></span>' +
      '<span class="name">' + esc(r.h.label || 'Unnamed') + '</span>' +
      '<span class="hl-page">p' + (r.pageIdx + 1) + '</span>' +
      '<span class="edit-btn" title="' + (r.h.label ? 'Rename' : 'Name') + '">✎</span>' +
      '</div>').join('');
  }

  function renderFoot() {
    const foot = document.getElementById('highlightPanelFoot');
    if (!foot) return;
    const rows = collectRows();
    const named = rows.filter(r => r.h.label).length;
    foot.textContent = rows.length
      ? (named + ' named · ' + (rows.length - named) + ' unnamed — click a row to go to its page')
      : 'Named highlights become jump-to bookmarks for whoever reviews this bid.';
  }

  // Core->feature sync: updateUI calls this every pass (the Chain pattern).
  function onHighlightToolSync() {
    const state = App.state;
    const panel = document.getElementById('highlightPanel');
    if (!panel) return;
    wire();
    const active = state.tool === App.TOOL.HIGHLIGHT && !state.isViewer && state.pages.length > 0;
    if (!active) panelCollapsed = false;
    panel.style.display = active && !panelCollapsed ? '' : 'none';
    if (!active || panelCollapsed) return;
    applyPanelPos(panel);
    renderList();
    renderFoot();
  }

  function closeHighlightPanel() {
    panelCollapsed = true;
    onHighlightToolSync();
  }

  function openHighlightPanel() {
    panelCollapsed = false;
    onHighlightToolSync();
  }

  function isHighlightPanelOpen() {
    const state = App.state;
    return state.tool === App.TOOL.HIGHLIGHT && !panelCollapsed;
  }

  // --- name modal -----------------------------------------------------------

  function openHighlightNameModal(h, pageIdx) {
    if (!h) return;
    naming = { h, pageIdx };
    const title = document.getElementById('highlightNameModalTitle');
    if (title) title.textContent = h.label ? 'Rename Highlight' : 'Name Highlight';
    const input = document.getElementById('highlightNameInput');
    input.value = h.label || '';
    App.showModal('highlightNameModal');
    input.focus();
    input.select();
  }

  function commitName() {
    if (!naming) return;
    const input = document.getElementById('highlightNameInput');
    const label = String(input.value || '').trim();
    App.pushUndoSnapshot();
    if (label) naming.h.label = label;
    else delete naming.h.label;
    naming = null;
    App.hideModal('highlightNameModal');
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  function cancelName() {
    naming = null;
    App.hideModal('highlightNameModal');
  }

  // --- wiring ---------------------------------------------------------------

  function wire() {
    if (wired) return;
    wired = true;
    const panel = document.getElementById('highlightPanel');
    if (panel) wireDrag(panel);
    document.getElementById('highlightPanelClose').addEventListener('click', closeHighlightPanel);
    // Rows (delegated — rows re-render on every sync). Click = jump to the
    // page (the lines-list pattern); ✎ = name/rename.
    document.getElementById('highlightList').addEventListener('click', (e) => {
      const row = e.target.closest('.highlight-row');
      if (!row) return;
      const r = collectRows()[parseInt(row.dataset.i, 10)];
      if (!r) return;
      if (e.target.closest('.edit-btn')) { openHighlightNameModal(r.h, r.pageIdx); return; }
      App.state.currentPage = r.pageIdx;
      App.fitZoom();
    });
    const ctxBtn = document.getElementById('ctxNameHighlight');
    if (ctxBtn) ctxBtn.onclick = () => {
      const state = App.state;
      const t = state.ctxTarget;
      document.getElementById('contextMenu').classList.remove('visible');
      if (!t || t.type !== 'highlight') return;
      const page = state.pages[state.currentPage];
      const ann = page ? App.getActiveAnnotations(page) : null;
      const h = ann?.highlights?.[t.index];
      state.ctxTarget = null;
      if (h) openHighlightNameModal(h, state.currentPage);
    };
    document.getElementById('highlightNameSave').addEventListener('click', commitName);
    document.getElementById('highlightNameCancel').addEventListener('click', cancelName);
    document.getElementById('highlightNameInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitName(); }
    });
  }

  App.onHighlightToolSync = onHighlightToolSync;
  App.openHighlightPanel = openHighlightPanel;
  App.closeHighlightPanel = closeHighlightPanel;
  App.isHighlightPanelOpen = isHighlightPanelOpen;
  App.openHighlightNameModal = openHighlightNameModal;
})();

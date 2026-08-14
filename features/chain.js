/*
 * features/chain.js - the Chain tool (TOOL.CHAIN): one click per fixture, the
 * connecting runs draw themselves.
 *
 * Every click drops a counter marker; from the second click on, a quick line
 * back to the previous counter rides along in the same undo step. The
 * placements are ORDINARY counter markers and quick lines (the exact shapes
 * the Counter and Quick Line tools write), so save/load, reports, exports,
 * zones, and groups all work untouched — the only new state is UI state:
 * `state.chainStart` (the anchor, `{ x, y, page }` — the page stamp is how a
 * page switch invalidates it) plus this file's private search queries.
 *
 * The palette panel (#chainPanel, markup in app/index.html) shows while the
 * tool is active: two searchable columns (Counters | Line types). Selection
 * writes state.activeCounterType / state.activeLineTypeId DIRECTLY — not via
 * App.setActiveCounterType/setActiveLineType, whose side effect is switching
 * the tool to COUNTER/LINE. Both must be selected before placing.
 *
 * app.js integration points: the TOOL.CHAIN branch in handleCanvasClick calls
 * App.commitChainPoint(pdf); updateUI calls App.onChainToolSync (defensive
 * core->feature callback) so the panel tracks tool/palette changes; the
 * chain rubber-band preview + Escape handling live in app.js beside their
 * quick-line siblings.
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  let counterQuery = '';
  let lineTypeQuery = '';
  let wired = false;
  // Palette lifecycle (2026-08-15): the panel is CLOSABLE without leaving the
  // tool — panelCollapsed hides it while TOOL.CHAIN stays active, and the
  // #headerChainPair chip (current pair, straight from the active selections)
  // takes over as indicator + reopen handle. Auto-reset on tool exit so every
  // fresh activation opens the picker (decided behavior). The panel is also
  // DRAGGABLE by its title bar; the position persists per device in
  // localStorage (chainPanelPos) and falls back to the CSS dock when the
  // stored spot no longer fits the viewport.
  let panelCollapsed = false;
  const PANEL_POS_KEY = 'chainPanelPos';

  function loadPanelPos() {
    try { return JSON.parse(localStorage.getItem(PANEL_POS_KEY)) || null; } catch { return null; }
  }

  function applyPanelPos(panel) {
    const pos = loadPanelPos();
    if (!pos) return;
    const w = panel.offsetWidth || 300;
    if (pos.x < 0 || pos.y < 0 || pos.x + w > window.innerWidth || pos.y + 60 > window.innerHeight) return;
    panel.style.left = pos.x + 'px';
    panel.style.top = pos.y + 'px';
  }

  function wireDrag(panel) {
    const head = document.getElementById('chainPanelHead');
    if (!head) return;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#chainPanelClose')) return;
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

  // --- placement core -------------------------------------------------------

  // One chain click: counter always, connecting quick line when an anchor from
  // the same page exists. One undo snapshot covers both, so Ctrl+Z removes the
  // pair together.
  function commitChainPoint(pdf) {
    const state = App.state;
    if (!state.activeCounterType || !state.activeLineTypeId) {
      App.showToast('Pick a counter and a line type in the Chain panel');
      return;
    }
    const anchor = state.chainStart && state.chainStart.page === state.currentPage ? state.chainStart : null;
    let pos = pdf;
    if (anchor && state.lineTypeSettings.snapToHorizontalVertical) {
      // Same 45° snap the quick line applies, relative to the previous counter.
      pos = App.snapLineToAngle(anchor.x, anchor.y, pdf.x, pdf.y);
      if (!App.isPointInPageBounds(pos)) pos = App.clampPointToPageBounds(pos);
    } else {
      if (!App.isPointInPageBounds(pdf)) { App.showOutOfBoundsToast(); return; }
      if (state.gridSettings?.snapToGrid && state.showGridOverlay) pos = App.snapToGrid(pdf, state.currentPage);
    }
    const page = state.pages[state.currentPage];
    const canvas = page && App.ensureActiveCanvas(page);
    if (!canvas) return;
    App.pushUndoSnapshotCurrentPage();
    if (!canvas.annotations.counterMarkers[state.activeCounterType]) canvas.annotations.counterMarkers[state.activeCounterType] = [];
    canvas.annotations.counterMarkers[state.activeCounterType].push({ x: pos.x, y: pos.y, id: App.uid(), group: state.activeGroupId || null });
    App.logCounterMarkerAddedEvent();
    if (anchor) {
      const lt = state.lineTypes.find((l) => l.id === state.activeLineTypeId);
      if (!canvas.annotations.quickLines) canvas.annotations.quickLines = [];
      canvas.annotations.quickLines.push({ x1: anchor.x, y1: anchor.y, x2: pos.x, y2: pos.y, color: lt?.color || '#4a9eff', id: App.uid(), lineTypeId: state.activeLineTypeId, group: state.activeGroupId || null });
      App.logLineAddedEvent('chain');
    }
    state.chainStart = { x: pos.x, y: pos.y, page: state.currentPage };
    App.markProjectDirty();
  }

  // --- palette panel --------------------------------------------------------

  function esc(s) { return App.escapeHtml(String(s ?? '')); }

  function matches(name, query) {
    return !query || String(name || '').toLowerCase().includes(query.toLowerCase());
  }

  // Every list ends with a "+ New" action row that drives the REAL sidebar
  // create button (field review 2026-08-15: a fresh project dead-ended here —
  // "create one in the sidebar" sent the user away from the tool they just
  // picked). Creating keeps TOOL.CHAIN active, so the panel re-syncs with the
  // new item already selected.
  function newRowHtml(kind) {
    return '<div class="chain-new-row" data-new="' + kind + '">+ New ' + (kind === 'counter' ? 'counter' : 'line type') + '</div>';
  }

  function renderCounterList() {
    const state = App.state;
    const list = document.getElementById('chainCounterList');
    if (!list) return;
    const rows = state.counters.filter((c) => matches(c.name, counterQuery));
    let html;
    if (!state.counters.length) html = '<div class="chain-list-empty">No counters yet.</div>';
    else if (!rows.length) html = '<div class="chain-list-empty">No match.</div>';
    else {
      html = rows.map((c) =>
        '<div class="chain-row' + (state.activeCounterType === c.id ? ' selected' : '') + '" data-id="' + esc(c.id) + '">' +
        '<span class="icon-svg chain-glyph" title="' + esc('Edit ' + (c.name || 'Counter') + '…') + '"><svg viewBox="' + App.iconVbFor(c.icon) + '" width="18" height="18"><path fill="' + esc(c.color || '#e8c547') + '" d="' + c.icon + '"/></svg></span>' +
        '<span class="chain-row-name">' + esc(c.name || 'Counter') + '</span>' +
        '</div>').join('');
    }
    list.innerHTML = html + newRowHtml('counter');
  }

  function renderLineTypeList() {
    const state = App.state;
    const list = document.getElementById('chainLineTypeList');
    if (!list) return;
    const rows = state.lineTypes.filter((lt) => matches(lt.name, lineTypeQuery));
    let html;
    if (!state.lineTypes.length) html = '<div class="chain-list-empty">No line types yet.</div>';
    else if (!rows.length) html = '<div class="chain-list-empty">No match.</div>';
    else {
      html = rows.map((lt) =>
        '<div class="chain-row' + (state.activeLineTypeId === lt.id ? ' selected' : '') + '" data-id="' + esc(lt.id) + '">' +
        '<span class="chain-line-swatch chain-glyph" style="background:' + esc(lt.color || '#4a9eff') + '" title="' + esc('Edit ' + (lt.name || 'Line') + '…') + '"></span>' +
        '<span class="chain-row-name">' + esc(lt.name || 'Line') + '</span>' +
        '</div>').join('');
    }
    list.innerHTML = html + newRowHtml('lineType');
  }

  function renderFoot() {
    const state = App.state;
    const foot = document.getElementById('chainPanelFoot');
    if (!foot) return;
    const counter = state.counters.find((c) => c.id === state.activeCounterType);
    const lt = state.lineTypes.find((l) => l.id === state.activeLineTypeId);
    if (counter && lt) {
      foot.innerHTML = 'Chaining: <b>' + esc(counter.name || 'Counter') + '</b> + <b>' + esc(lt.name || 'Line') + '</b> · Enter/Esc ends the run';
    } else {
      foot.textContent = 'Pick a counter and a line type to start placing.';
    }
  }

  // The header pair chip: visible ONLY while TOOL.CHAIN is active with the
  // palette closed. It renders the CURRENT selections (no separate memory to
  // drift) and clicking it reopens the palette.
  function renderPairChip(active) {
    const state = App.state;
    const chip = document.getElementById('headerChainPair');
    if (!chip) return;
    const counter = state.counters.find((c) => c.id === state.activeCounterType);
    const lt = state.lineTypes.find((l) => l.id === state.activeLineTypeId);
    const show = active && panelCollapsed;
    chip.style.display = show ? '' : 'none';
    if (!show) return;
    const iconHtml = counter
      ? '<span class="chain-pair-icon"><svg viewBox="' + App.iconVbFor(counter.icon) + '"><path fill="' + esc(counter.color || '#e8c547') + '" d="' + counter.icon + '"/></svg></span>'
      : '<span class="chain-pair-icon">?</span>';
    const swatchHtml = '<span class="chain-pair-swatch" style="background:' + esc(lt?.color || '#4a9eff') + '"></span>';
    chip.innerHTML = iconHtml + '<span class="chain-pair-plus">+</span>' + swatchHtml;
    chip.title = 'Chaining ' + (counter?.name || '—') + ' + ' + (lt?.name || '—') + ' — click to change';
  }

  // Core->feature sync: updateUI calls this every pass. Shows/hides the panel
  // by tool + collapse state, re-renders rows (list DOM only — the search
  // inputs live outside the lists, so typing focus is never stolen), and
  // keeps the header pair chip tracking the closed state.
  function onChainToolSync() {
    const state = App.state;
    const panel = document.getElementById('chainPanel');
    if (!panel) return;
    wire();
    const active = state.tool === App.TOOL.CHAIN && !state.isViewer && state.pages.length > 0;
    if (!active) panelCollapsed = false;   // fresh activation always opens the picker
    panel.style.display = active && !panelCollapsed ? '' : 'none';
    renderPairChip(active);
    if (!active || panelCollapsed) return;
    applyPanelPos(panel);
    renderCounterList();
    renderLineTypeList();
    renderFoot();
  }

  function closeChainPanel() {
    panelCollapsed = true;
    onChainToolSync();
  }

  function openChainPanel() {
    panelCollapsed = false;
    onChainToolSync();
  }

  function isChainPanelOpen() {
    const state = App.state;
    return state.tool === App.TOOL.CHAIN && !panelCollapsed;
  }

  function wire() {
    if (wired) return;
    wired = true;
    const panel = document.getElementById('chainPanel');
    if (panel) wireDrag(panel);
    document.getElementById('chainPanelClose').addEventListener('click', closeChainPanel);
    const chip = document.getElementById('headerChainPair');
    if (chip) chip.addEventListener('click', openChainPanel);
    document.getElementById('chainCounterSearch').addEventListener('input', (e) => {
      counterQuery = e.target.value;
      renderCounterList();
    });
    document.getElementById('chainLineTypeSearch').addEventListener('input', (e) => {
      lineTypeQuery = e.target.value;
      renderLineTypeList();
    });
    // Row clicks (delegated — rows re-render on every sync). Selecting a new
    // counter/line type mid-run keeps the anchor: the next segment simply uses
    // the new selection.
    // Row clicks select; the leading GLYPH selects AND opens the item's
    // settings modal (decided 2026-08-15: one click does both) — the same
    // details modal as the sidebar edit pens, so rename/recolor/child counts
    // are reachable without leaving Chain. Its edits call updateUI, which
    // re-syncs the rows, footer, and chip live; tool stays CHAIN throughout.
    document.getElementById('chainCounterList').addEventListener('click', (e) => {
      if (e.target.closest('.chain-new-row')) { document.getElementById('addCounter').click(); return; }
      const row = e.target.closest('.chain-row');
      if (!row) return;
      App.state.activeCounterType = row.dataset.id;
      if (e.target.closest('.chain-glyph')) {
        const item = App.state.counters.find((c) => c.id === row.dataset.id);
        if (item) App.openCounterLineTypeDetailsModal('counter', item);
      }
      App.updateUI();
    });
    document.getElementById('chainLineTypeList').addEventListener('click', (e) => {
      if (e.target.closest('.chain-new-row')) { document.getElementById('addLineType').click(); return; }
      const row = e.target.closest('.chain-row');
      if (!row) return;
      App.state.activeLineTypeId = row.dataset.id;
      if (e.target.closest('.chain-glyph')) {
        const item = App.state.lineTypes.find((lt) => lt.id === row.dataset.id);
        if (item) App.openCounterLineTypeDetailsModal('lineType', item);
      }
      App.updateUI();
    });
  }

  App.commitChainPoint = commitChainPoint;
  App.onChainToolSync = onChainToolSync;
  App.openChainPanel = openChainPanel;
  App.closeChainPanel = closeChainPanel;
  App.isChainPanelOpen = isChainPanelOpen;
})();

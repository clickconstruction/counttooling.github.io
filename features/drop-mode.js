/*
 * features/drop-mode.js - the Drop tool (TOOL.DROP): pick a size once, then
 * one click per line end adds that vertical drop.
 *
 * Why it exists: a drop (riser/stack footage at a line end) used to cost a
 * right-click -> Line Properties -> ±/type -> Close round trip PER END, and a
 * chained branch has one end per fixture. With the tool armed, every line end
 * on the page renders as a labeled target ring; clicking one writes the
 * palette's size there. Clicking an end that already carries exactly the
 * selected size clears it (click-to-toggle), so a mis-click is its own fix —
 * and every click is one undo step.
 *
 * The writes go through the pure node model in annotation-model.js
 * (collectDropNodes / applyDropToNode): coincident line ends — every joint in
 * a chain, or any two runs traced end-to-end — collapse to ONE node, and a
 * node's drop lives on exactly one of its line ends while the rest are
 * zeroed. That is the double-count guard: a shared point can never add its
 * vertical footage twice.
 *
 * The palette panel (#dropPanel, markup in app/index.html) reuses the Chain
 * palette idiom wholesale: shown while the tool is active, draggable by its
 * title bar (position per device in localStorage `dropPanelPos`, falling back
 * to the CSS dock when it no longer fits), closable without leaving the tool
 * (Esc ladder: close panel -> exit tool). Its size rows are the shared
 * state.recentDrops list — the same store the Line Properties Recent chips
 * read — plus a custom value+unit entry that commits through the same
 * pushRecentDrop, so using a new size anywhere teaches it everywhere.
 *
 * app.js integration points: the TOOL.DROP branch in handleCanvasClick calls
 * App.commitDropClick(pdf); renderAnnotations calls App.drawDropNodesOverlay
 * while the tool is armed; updateUI calls App.onDropToolSync; the #dropBtn
 * handler calls App.openDropPanel; the Escape branch uses
 * App.isDropPanelOpen / App.closeDropPanel.
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Selected palette size ({ value, unit }); null until the user picks one or
  // the first sync defaults it to the most recent drop. Reset on tool exit so
  // a fresh activation starts from the current recents.
  let selected = null;
  let panelCollapsed = false;
  let wired = false;
  const PANEL_POS_KEY = 'dropPanelPos';

  // PDF-space hit radius for node clicks — the context-menu hitTest's 12px
  // feel, slightly widened because rapid clicking is the whole point here.
  const NODE_HIT_PX = 14;

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
    const head = document.getElementById('dropPanelHead');
    if (!head) return;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#dropPanelClose')) return;
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

  function sameSize(a, b) { return !!a && !!b && a.value === b.value && a.unit === b.unit; }

  // --- placement core -------------------------------------------------------

  function nearestNode(ann, pdf) {
    const state = App.state;
    const r = NODE_HIT_PX / state.zoom;
    const nodes = App.collectDropNodes(ann);
    let best = null, bestD = Infinity;
    nodes.forEach(n => {
      const d = App.ptDist(pdf, n);
      if (d <= r && d < bestD) { best = n; bestD = d; }
    });
    return best;
  }

  // One armed click: nearest line end within reach gets the selected size;
  // the same size again clears it. Snapshot only when something will change.
  function commitDropClick(pdf) {
    const state = App.state;
    if (state.isViewer) return;
    if (!selected) { App.showToast('Pick a drop size in the palette'); return; }
    const page = state.pages[state.currentPage];
    const ann = page ? App.getActiveAnnotations(page) : null;
    if (!ann) return;
    const node = nearestNode(ann, pdf);
    if (!node) return;
    const clearing = node.value > 0 && sameSize({ value: node.value, unit: node.unit }, selected);
    const value = clearing ? 0 : selected.value;
    if (!App.applyDropToNode(ann, node, value, selected.unit, true)) return;
    App.pushUndoSnapshotCurrentPage();
    App.applyDropToNode(ann, node, value, selected.unit);
    if (!clearing) App.pushRecentDrop(selected.value, selected.unit);
    App.logDropSetEvent(value, selected.unit, 'drop-tool');
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  // --- armed overlay --------------------------------------------------------

  // Rings at every line end; a node carrying a drop shows its value beside the
  // existing X marker, so a 10 ft and a 6 in drop stop looking identical while
  // you place them. Screen-constant sizes (÷ nothing: toCanvas already bakes
  // zoom×DPR into coordinates, so radii here are raw device pixels like the
  // other chrome in renderAnnotations' env).
  function drawDropNodesOverlay(ctx) {
    const state = App.state;
    const page = state.pages[state.currentPage];
    const ann = page ? App.getActiveAnnotations(page) : null;
    if (!ann) return;
    const dpr = window.devicePixelRatio || 1;
    const nodes = App.collectDropNodes(ann);
    ctx.save();
    nodes.forEach(n => {
      const p = App.toCanvas(n);
      const r = 8 * dpr;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3.5 * dpr;
      ctx.stroke();
      ctx.strokeStyle = '#e8c547';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
      if (n.value > 0) {
        const label = App.formatDropLabel(n.value, n.unit || 'ft');
        ctx.font = (11 * dpr) + 'px DM Sans';
        ctx.textBaseline = 'middle';
        const tx = p.x + r + 4 * dpr, ty = p.y - r - 2 * dpr;
        const w = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(tx - 3 * dpr, ty - 8 * dpr, w + 6 * dpr, 16 * dpr);
        ctx.fillStyle = '#e8c547';
        ctx.fillText(label, tx, ty);
      }
    });
    ctx.restore();
  }

  // --- palette panel --------------------------------------------------------

  function renderSizes() {
    const state = App.state;
    const list = document.getElementById('dropSizeList');
    if (!list) return;
    const recents = App.getRecentDrops();
    if (selected && !recents.some(d => sameSize(d, selected))) selected = null;
    if (!selected && recents.length) selected = { value: recents[0].value, unit: recents[0].unit };
    if (!recents.length) {
      list.innerHTML = '<div class="chain-list-empty">No sizes yet — add one below.</div>';
      return;
    }
    list.innerHTML = recents.map(d =>
      '<button type="button" class="drop-size-btn' + (sameSize(d, selected) ? ' selected' : '') + '" data-v="' + d.value + '" data-u="' + App.escapeHtml(d.unit) + '">' +
      App.escapeHtml(App.formatDropLabel(d.value, d.unit)) + '</button>').join('');
  }

  function renderFoot() {
    const foot = document.getElementById('dropPanelFoot');
    if (!foot) return;
    foot.textContent = selected
      ? 'Click a line end to drop ' + App.formatDropLabel(selected.value, selected.unit) + ' — same size again clears it'
      : 'Pick or add a drop size to start.';
  }

  // Core->feature sync: updateUI calls this every pass (the Chain pattern).
  function onDropToolSync() {
    const state = App.state;
    const panel = document.getElementById('dropPanel');
    if (!panel) return;
    wire();
    const active = state.tool === App.TOOL.DROP && !state.isViewer && state.pages.length > 0;
    if (!active) { panelCollapsed = false; selected = null; }
    panel.style.display = active && !panelCollapsed ? '' : 'none';
    if (!active || panelCollapsed) return;
    applyPanelPos(panel);
    renderSizes();
    renderFoot();
  }

  function closeDropPanel() {
    panelCollapsed = true;
    onDropToolSync();
  }

  function openDropPanel() {
    panelCollapsed = false;
    onDropToolSync();
  }

  function isDropPanelOpen() {
    const state = App.state;
    return state.tool === App.TOOL.DROP && !panelCollapsed;
  }

  function wire() {
    if (wired) return;
    wired = true;
    const panel = document.getElementById('dropPanel');
    if (panel) wireDrag(panel);
    document.getElementById('dropPanelClose').addEventListener('click', closeDropPanel);
    // Size rows (delegated — rows re-render on every sync).
    document.getElementById('dropSizeList').addEventListener('click', (e) => {
      const btn = e.target.closest('.drop-size-btn');
      if (!btn) return;
      selected = { value: parseFloat(btn.dataset.v), unit: btn.dataset.u };
      renderSizes();
      renderFoot();
    });
    // Custom size: value (decimal or ft-in like 8'6) + unit. Committing routes
    // through pushRecentDrop, so the new size lands in BOTH surfaces' recents
    // and becomes the selection.
    const commitCustom = () => {
      const valEl = document.getElementById('dropCustomValue');
      const unitEl = document.getElementById('dropCustomUnit');
      const unit = unitEl.value;
      const raw = String(valEl.value || '').trim();
      // Decimal in the selected unit; the ft-in shorthand ("8'6") only when
      // that unit is feet — elsewhere it would misread a plain "8" as 8 ft.
      const parsed = unit === 'ft' ? App.parseRealWorldLength(raw, 'ft') : parseFloat(raw);
      if (!(parsed > 0)) { App.showToast('Enter a drop size (e.g. 3, 2.5, or 8\'6)'); return; }
      const value = Math.round(parsed * 100) / 100;
      App.pushRecentDrop(value, unit);
      selected = { value, unit };
      valEl.value = '';
      renderSizes();
      renderFoot();
    };
    document.getElementById('dropCustomAdd').addEventListener('click', commitCustom);
    // No stopPropagation here: the app-level keydown handler already ignores
    // hotkeys while focus is in an input, and swallowing events would break
    // Escape (close panel) and Ctrl+Z while the field has focus.
    document.getElementById('dropCustomValue').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitCustom(); }
    });
  }

  App.commitDropClick = commitDropClick;
  App.drawDropNodesOverlay = drawDropNodesOverlay;
  App.onDropToolSync = onDropToolSync;
  App.openDropPanel = openDropPanel;
  App.closeDropPanel = closeDropPanel;
  App.isDropPanelOpen = isDropPanelOpen;
})();

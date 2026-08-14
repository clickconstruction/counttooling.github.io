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

  function renderCounterList() {
    const state = App.state;
    const list = document.getElementById('chainCounterList');
    if (!list) return;
    const rows = state.counters.filter((c) => matches(c.name, counterQuery));
    if (!state.counters.length) {
      list.innerHTML = '<div class="chain-list-empty">No counters yet — create one in the sidebar.</div>';
      return;
    }
    if (!rows.length) {
      list.innerHTML = '<div class="chain-list-empty">No match.</div>';
      return;
    }
    list.innerHTML = rows.map((c) =>
      '<div class="chain-row' + (state.activeCounterType === c.id ? ' selected' : '') + '" data-id="' + esc(c.id) + '">' +
      '<span class="icon-svg"><svg viewBox="' + App.iconVbFor(c.icon) + '" width="18" height="18"><path fill="' + esc(c.color || '#e8c547') + '" d="' + c.icon + '"/></svg></span>' +
      '<span class="chain-row-name">' + esc(c.name || 'Counter') + '</span>' +
      '</div>').join('');
  }

  function renderLineTypeList() {
    const state = App.state;
    const list = document.getElementById('chainLineTypeList');
    if (!list) return;
    const rows = state.lineTypes.filter((lt) => matches(lt.name, lineTypeQuery));
    if (!state.lineTypes.length) {
      list.innerHTML = '<div class="chain-list-empty">No line types yet — create one in the sidebar.</div>';
      return;
    }
    if (!rows.length) {
      list.innerHTML = '<div class="chain-list-empty">No match.</div>';
      return;
    }
    list.innerHTML = rows.map((lt) =>
      '<div class="chain-row' + (state.activeLineTypeId === lt.id ? ' selected' : '') + '" data-id="' + esc(lt.id) + '">' +
      '<span class="chain-line-swatch" style="background:' + esc(lt.color || '#4a9eff') + '"></span>' +
      '<span class="chain-row-name">' + esc(lt.name || 'Line') + '</span>' +
      '</div>').join('');
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

  // Core->feature sync: updateUI calls this every pass. Shows/hides the panel
  // by tool and re-renders rows (list DOM only — the search inputs live
  // outside the lists, so typing focus is never stolen).
  function onChainToolSync() {
    const state = App.state;
    const panel = document.getElementById('chainPanel');
    if (!panel) return;
    wire();
    const active = state.tool === App.TOOL.CHAIN && !state.isViewer && state.pages.length > 0;
    panel.style.display = active ? '' : 'none';
    if (!active) return;
    renderCounterList();
    renderLineTypeList();
    renderFoot();
  }

  function wire() {
    if (wired) return;
    wired = true;
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
    document.getElementById('chainCounterList').addEventListener('click', (e) => {
      const row = e.target.closest('.chain-row');
      if (!row) return;
      App.state.activeCounterType = row.dataset.id;
      App.updateUI();
    });
    document.getElementById('chainLineTypeList').addEventListener('click', (e) => {
      const row = e.target.closest('.chain-row');
      if (!row) return;
      App.state.activeLineTypeId = row.dataset.id;
      App.updateUI();
    });
  }

  App.commitChainPoint = commitChainPoint;
  App.onChainToolSync = onChainToolSync;
})();

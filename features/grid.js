/*
 * features/grid.js - the Grid Settings modal (gridSettingsModal), extracted from
 * the app.js IIFE as the fifteenth feature-file split under the window.App
 * registry pattern. This is the grid-overlay toggle + its settings dialog
 * (spacing, origin, major interval, opacity, color, line width/style, snap),
 * opened by the Grid buttons.
 *
 * Loaded as a classic <script src="features/grid.js"> AFTER app.js. Its own IIFE:
 * it reaches the cross-cutting state + helpers through the shared window.App
 * registry that app.js populates during its own load, registers
 * toggleGridOverlay back onto App, and binds the Grid buttons + the
 * #gridSettings* / #gridSetOriginOnPage / #gridClearOrigin / spacing-preset /
 * line-style handlers at this file's load.
 *
 * Scope is the grid-settings modal + overlay toggle only. The actual grid
 * drawing (drawGrid), the snap-to-grid branch, the render-code grid-button
 * active/disabled toggling, and resetGridOrigin (a state-reset used by the
 * prepare-PDF / page-setup flows, not the modal) all stay in app.js. The
 * "set origin on page" handoff goes through the shared `state.gridOriginPickMode`
 * flag: this feature sets it true, and the app.js canvas handler reads it, writes
 * the origin, flips it false, and reopens the modal via showModal -- because the
 * flag lives on the shared `state` object, no registry callback is needed
 * (unlike the Groups openedGroupModalFromAssign case).
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  const gridBtn = document.getElementById('gridBtn');
  const gridBtnSidebar = document.getElementById('gridBtnSidebar');

  function toggleGridOverlay() {
    const state = App.state;
    if (!state.pages.length) return;
    if (state.showGridOverlay) {
      state.showGridOverlay = false;
      App.markProjectDirty();
      App.renderPdf();
      App.updateUI();
      return;
    }
    if (!App.getPageScale(state.currentPage)) {
      App.showSetScaleFirstToast('Grid overlay');
      return;
    }
    let gs = state.gridSettings || { spacing: 3, unit: 'ft' };
    if (gs.unit === 'in') {
      gs = { ...gs, spacing: gs.spacing / 12, unit: 'ft' };
      state.gridSettings = state.gridSettings ? { ...state.gridSettings, ...gs } : gs;
    }
    document.getElementById('gridSpacingValue').value = gs.spacing != null ? String(gs.spacing) : '3';
    document.getElementById('gridSpacingUnit').value = gs.unit || 'ft';
    const ox = gs.offsetX ?? 0, oy = gs.offsetY ?? 0;
    const hasOrigin = ox !== 0 || oy !== 0;
    const disp = document.getElementById('gridOriginDisplay');
    const txt = document.getElementById('gridOriginText');
    disp.style.display = hasOrigin ? '' : 'none';
    document.getElementById('gridSetOriginFormGroup').style.display = hasOrigin ? 'none' : '';
    txt.textContent = hasOrigin ? (ox.toFixed(2) + ', ' + oy.toFixed(2) + ' ' + (gs.unit || 'ft')) : '—';
    document.getElementById('gridMajorInterval').value = gs.majorInterval != null && gs.majorInterval > 0 ? String(gs.majorInterval) : '';
    const opacityPct = Math.round((gs.opacity ?? 0.35) * 100);
    document.getElementById('gridOpacity').value = opacityPct;
    document.getElementById('gridOpacityVal').textContent = opacityPct;
    document.getElementById('gridColor').value = gs.color || '#e8c547';
    document.getElementById('gridColorHex').textContent = (gs.color || '#e8c547').toLowerCase();
    const lw = gs.lineWidth ?? 1;
    document.getElementById('gridLineWidth').value = lw;
    document.getElementById('gridLineWidthVal').textContent = lw;
    document.getElementById('gridLineStyle').value = gs.lineStyle || 'solid';
    document.querySelectorAll('.grid-line-style-opt').forEach(b => {
      b.classList.toggle('selected', b.dataset.style === (gs.lineStyle || 'solid'));
    });
    const snapCb = document.getElementById('gridSnapToGrid');
    const snapBtn = document.getElementById('gridSnapToGridBtn');
    snapCb.checked = gs.snapToGrid === true;
    snapBtn.setAttribute('aria-pressed', snapCb.checked);
    document.getElementById('gridOpacity').oninput = () => { document.getElementById('gridOpacityVal').textContent = document.getElementById('gridOpacity').value; };
    document.getElementById('gridLineWidth').oninput = () => { document.getElementById('gridLineWidthVal').textContent = document.getElementById('gridLineWidth').value; };
    document.getElementById('gridColor').oninput = () => { document.getElementById('gridColorHex').textContent = document.getElementById('gridColor').value.toLowerCase(); };
    snapBtn.onclick = (e) => {
      e.preventDefault();
      snapCb.checked = !snapCb.checked;
      snapBtn.setAttribute('aria-pressed', snapCb.checked);
    };
    App.showModal('gridSettingsModal');
  }
  if (gridBtn) gridBtn.onclick = toggleGridOverlay;
  if (gridBtnSidebar) gridBtnSidebar.onclick = () => gridBtn?.click();
  document.getElementById('gridSettingsCancel').onclick = () => App.hideModal('gridSettingsModal');
  document.getElementById('gridSetOriginOnPage').onclick = () => {
    const state = App.state;
    if (!App.getPageScale(state.currentPage)) {
      App.showToast('Set Scale first');
      return;
    }
    App.hideModal('gridSettingsModal');
    state.gridOriginPickMode = true;
    App.showToast('Click on the plan to set grid origin');
    App.updateUI();
  };
  document.getElementById('gridClearOrigin').onclick = () => {
    const state = App.state;
    if (!state.gridSettings) state.gridSettings = { spacing: 3, unit: 'ft' };
    state.gridSettings.offsetX = 0;
    state.gridSettings.offsetY = 0;
    document.getElementById('gridOriginDisplay').style.display = 'none';
    document.getElementById('gridSetOriginFormGroup').style.display = '';
    document.getElementById('gridOriginText').textContent = '—';
    App.renderPdf();
    App.updateUI();
  };
  document.querySelectorAll('.gridSpacingPreset').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('gridSpacingValue').value = btn.dataset.spacing;
      document.getElementById('gridSpacingUnit').value = btn.dataset.unit;
    };
  });
  document.querySelectorAll('.grid-line-style-opt').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('gridLineStyle').value = btn.dataset.style;
      document.querySelectorAll('.grid-line-style-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });
  document.getElementById('gridSettingsApply').onclick = () => {
    const state = App.state;
    const unit = document.getElementById('gridSpacingUnit').value;
    const val = App.parseRealWorldLength(document.getElementById('gridSpacingValue').value, unit);
    if (!val || val <= 0) {
      App.showToast('Enter a valid spacing');
      return;
    }
    if (!App.getPageScale(state.currentPage)) {
      App.showToast('Set Scale first to use grid overlay');
      return;
    }
    const offsetXVal = state.gridSettings?.offsetX ?? 0;
    const offsetYVal = state.gridSettings?.offsetY ?? 0;
    const majorInt = parseInt(document.getElementById('gridMajorInterval').value, 10);
    const opacityVal = parseInt(document.getElementById('gridOpacity').value, 10) / 100;
    const colorVal = document.getElementById('gridColor').value || '#e8c547';
    const lineWidthVal = parseFloat(document.getElementById('gridLineWidth').value) || 1;
    const lineStyleVal = document.getElementById('gridLineStyle').value || 'solid';
    const snapToGridVal = document.getElementById('gridSnapToGrid').checked;
    state.gridSettings = {
      spacing: val,
      unit,
      offsetX: offsetXVal,
      offsetY: offsetYVal,
      opacity: opacityVal,
      color: colorVal,
      lineWidth: lineWidthVal,
      lineStyle: lineStyleVal,
      majorInterval: (majorInt > 0 ? majorInt : null),
      snapToGrid: snapToGridVal
    };
    state.showGridOverlay = true;
    App.hideModal('gridSettingsModal');
    App.markProjectDirty();
    App.renderPdf();
    App.updateUI();
  };

  App.toggleGridOverlay = toggleGridOverlay;
})();

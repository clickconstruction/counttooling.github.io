/*
 * features/legend-settings.js - the Summary Legend settings modal
 * (legendSettingsModal), extracted from the app.js IIFE as the seventh
 * feature-file split under the window.App registry pattern. The lowest-risk
 * move so far: all four deps (state, showModal, hideModal, renderPdf) were
 * already on App (zero new publishes), and every handler renders live.
 *
 * Loaded as a classic <script src="features/legend-settings.js"> AFTER app.js.
 * Its own IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openLegendSettingsModal back onto App, and binds the modal's close / live
 * appearance handlers + the Summary section-title opener at this file's load.
 *
 * Scope is the Summary Legend *settings* modal only. The on-canvas legend
 * overlay (drawLegend, the legendBtn/legendBtnSidebar toggles), the Summary
 * section *collapse* icon (#summaryCollapseIcon), and every state.legendSettings
 * save/load/import site stay in app.js. Boundary rule: read shared deps from
 * App.* at call time, never captured at load. See ARCHITECTURE.md "Feature
 * files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function openLegendSettingsModal() {
    const state = App.state;
    const ls = state.legendSettings || { bgOpacity: 1, textOpacity: 1, bgColor: '#ffffff', showBorder: true, legendScale: 1, showResizeHighlight: false };
    document.getElementById('legendBgOpacity').value = Math.round((ls.bgOpacity ?? 1) * 100);
    document.getElementById('legendBgOpacityVal').textContent = Math.round((ls.bgOpacity ?? 1) * 100);
    document.getElementById('legendBgColor').value = ls.bgColor || '#ffffff';
    document.getElementById('legendBgColorHex').textContent = (ls.bgColor || '#ffffff').toLowerCase();
    document.getElementById('legendTextOpacity').value = Math.round((ls.textOpacity ?? 1) * 100);
    document.getElementById('legendTextOpacityVal').textContent = Math.round((ls.textOpacity ?? 1) * 100);
    const legendShowBorderCb = document.getElementById('legendShowBorder');
    const legendShowBorderBtn = document.getElementById('legendShowBorderBtn');
    legendShowBorderCb.checked = ls.showBorder !== false;
    legendShowBorderBtn.setAttribute('aria-pressed', legendShowBorderCb.checked);
    const legendScaleVal = Math.round((ls.legendScale ?? 1) * 100);
    document.getElementById('legendScale').value = legendScaleVal;
    document.getElementById('legendScaleVal').textContent = legendScaleVal;
    const legendShowResizeHighlightCb = document.getElementById('legendShowResizeHighlight');
    const legendShowResizeHighlightBtn = document.getElementById('legendShowResizeHighlightBtn');
    legendShowResizeHighlightCb.checked = ls.showResizeHighlight === true;
    legendShowResizeHighlightBtn.setAttribute('aria-pressed', legendShowResizeHighlightCb.checked);
    const legendShowRoomsCb = document.getElementById('legendShowRooms');
    const legendShowRoomsBtn = document.getElementById('legendShowRoomsBtn');
    legendShowRoomsCb.checked = ls.showRooms !== false;   // default on; only projects using the Room Sizer have rows
    legendShowRoomsBtn.setAttribute('aria-pressed', legendShowRoomsCb.checked);
    App.showModal('legendSettingsModal');
  }

  document.getElementById('summarySectionTitle').onclick = (e) => {
    if (e.target.closest('#summaryCollapseIcon')) return;
    openLegendSettingsModal();
  };

  document.getElementById('legendSettingsClose').onclick = () => App.hideModal('legendSettingsModal');

  document.getElementById('legendBgOpacity').oninput = () => {
    const state = App.state;
    if (!state.legendSettings) state.legendSettings = { bgOpacity: 1, textOpacity: 1, bgColor: '#ffffff', showBorder: true, legendScale: 1, showResizeHighlight: false };
    state.legendSettings.bgOpacity = parseInt(document.getElementById('legendBgOpacity').value, 10) / 100;
    document.getElementById('legendBgOpacityVal').textContent = Math.round(state.legendSettings.bgOpacity * 100);
    App.renderAnnotations();
  };
  document.getElementById('legendBgColor').oninput = () => {
    const state = App.state;
    if (!state.legendSettings) state.legendSettings = { bgOpacity: 1, textOpacity: 1, bgColor: '#ffffff', showBorder: true, legendScale: 1, showResizeHighlight: false };
    const hex = document.getElementById('legendBgColor').value;
    state.legendSettings.bgColor = hex;
    document.getElementById('legendBgColorHex').textContent = hex.toLowerCase();
    App.renderAnnotations();
  };
  document.getElementById('legendShowBorderBtn').onclick = (e) => {
    e.preventDefault();
    const cb = document.getElementById('legendShowBorder');
    cb.checked = !cb.checked;
    document.getElementById('legendShowBorderBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('legendShowBorder').onchange = () => {
    const state = App.state;
    if (!state.legendSettings) state.legendSettings = { bgOpacity: 1, textOpacity: 1, bgColor: '#ffffff', showBorder: true, legendScale: 1, showResizeHighlight: false };
    state.legendSettings.showBorder = document.getElementById('legendShowBorder').checked;
    App.renderAnnotations();
  };
  document.getElementById('legendScale').oninput = () => {
    const state = App.state;
    if (!state.legendSettings) state.legendSettings = { bgOpacity: 1, textOpacity: 1, bgColor: '#ffffff', showBorder: true, legendScale: 1, showResizeHighlight: false };
    state.legendSettings.legendScale = parseInt(document.getElementById('legendScale').value, 10) / 100;
    document.getElementById('legendScaleVal').textContent = Math.round(state.legendSettings.legendScale * 100);
    App.renderAnnotations();
  };
  document.getElementById('legendShowResizeHighlightBtn').onclick = (e) => {
    e.preventDefault();
    const cb = document.getElementById('legendShowResizeHighlight');
    cb.checked = !cb.checked;
    document.getElementById('legendShowResizeHighlightBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('legendShowResizeHighlight').onchange = () => {
    const state = App.state;
    if (!state.legendSettings) state.legendSettings = { bgOpacity: 1, textOpacity: 1, bgColor: '#ffffff', showBorder: true, legendScale: 1, showResizeHighlight: false };
    state.legendSettings.showResizeHighlight = document.getElementById('legendShowResizeHighlight').checked;
    App.renderAnnotations();
  };
  document.getElementById('legendShowRoomsBtn').onclick = (e) => {
    e.preventDefault();
    const cb = document.getElementById('legendShowRooms');
    cb.checked = !cb.checked;
    document.getElementById('legendShowRoomsBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('legendShowRooms').onchange = () => {
    const state = App.state;
    if (!state.legendSettings) state.legendSettings = { bgOpacity: 1, textOpacity: 1, bgColor: '#ffffff', showBorder: true, legendScale: 1, showResizeHighlight: false };
    state.legendSettings.showRooms = document.getElementById('legendShowRooms').checked;
    App.renderAnnotations();
  };
  document.getElementById('legendTextOpacity').oninput = () => {
    const state = App.state;
    if (!state.legendSettings) state.legendSettings = { bgOpacity: 1, textOpacity: 1, bgColor: '#ffffff', showBorder: true, legendScale: 1, showResizeHighlight: false };
    state.legendSettings.textOpacity = parseInt(document.getElementById('legendTextOpacity').value, 10) / 100;
    document.getElementById('legendTextOpacityVal').textContent = Math.round(state.legendSettings.textOpacity * 100);
    App.renderAnnotations();
  };

  App.openLegendSettingsModal = openLegendSettingsModal;
})();

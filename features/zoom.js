/*
 * features/zoom.js - the Zoom Settings modal, extracted from the app.js IIFE as
 * the third feature-file split under the window.App registry pattern.
 *
 * Loaded as a classic <script src="features/zoom.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * showZoomModal back onto App (the single inbound call site - the desktop
 * branch of the zoom-% click - calls App.showZoomModal at user-action time),
 * and binds the modal's Close / max / speed inputs at this file's load.
 *
 * getMaxZoom / getWheelZoomSpeed stay defined in app.js (used in ~10 places
 * there) and are read here via App.*. Boundary rule: all shared dependencies
 * are read from App.* at call time, never captured at load, so load order
 * beyond "after app.js" does not matter. See ARCHITECTURE.md "Feature files /
 * window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function showZoomModal() {
    const maxVal = Math.round(App.getMaxZoom() * 100);
    document.getElementById('zoomMax').value = maxVal;
    document.getElementById('zoomMaxVal').textContent = maxVal;
    const speed = App.getWheelZoomSpeed();
    const speedPct = Math.round(speed * 100);
    document.getElementById('zoomSpeed').value = speedPct;
    document.getElementById('zoomSpeedVal').textContent = speed.toFixed(1);
    App.showModal('zoomModal');
  }

  document.getElementById('zoomModalClose').onclick = () => {
    const state = App.state;
    const maxPct = parseInt(document.getElementById('zoomMax').value, 10);
    state.maxZoom = maxPct / 100;
    const speedPct = parseInt(document.getElementById('zoomSpeed').value, 10);
    const speed = speedPct / 100;
    try { localStorage.setItem('zoomSettings', JSON.stringify({ wheelZoomSpeed: speed })); } catch (_) {}
    document.getElementById('zoomSpeedVal').textContent = speed.toFixed(1);
    if (state.zoom > App.getMaxZoom()) { state.zoom = App.getMaxZoom(); App.renderPdf(); }
    App.markProjectDirty();
    App.hideModal('zoomModal');
    App.updateUI();
  };
  document.getElementById('zoomMax').oninput = () => { document.getElementById('zoomMaxVal').textContent = document.getElementById('zoomMax').value; };
  document.getElementById('zoomSpeed').oninput = () => { document.getElementById('zoomSpeedVal').textContent = (parseInt(document.getElementById('zoomSpeed').value, 10) / 100).toFixed(1); };

  App.showZoomModal = showZoomModal;
})();

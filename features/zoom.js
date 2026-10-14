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

  // DEEP-ZOOM part 2 (journeys/plans/DEEP-ZOOM.md): the slider runs to the device's ceiling
  // (App.getDeviceZoomCeiling: 5000% on a capable device, 1200% on a small-cap or low-memory
  // one) and shows the PROJECT's own ceiling held to that range; Done writes it back only when
  // the slider moved, so opening the dialog on a phone never lowers a project's 3000% to 1200%.
  let shownMaxPct = null;
  function showZoomModal() {
    const state = App.state;
    const ceilingPct = Math.round(App.getDeviceZoomCeiling() * 100);
    const slider = document.getElementById('zoomMax');
    slider.max = String(Math.max(100, ceilingPct));
    const projectPct = Math.round((state.maxZoom ?? 4) * 100);
    shownMaxPct = Math.max(100, Math.min(ceilingPct, projectPct));
    slider.value = shownMaxPct;
    document.getElementById('zoomMaxVal').textContent = shownMaxPct;
    const hint = document.getElementById('zoomMaxHint');
    if (hint) {
      const held = ceilingPct < 5000;
      hint.textContent = held
        ? 'This device holds zoom at ' + ceilingPct + '%.' + (projectPct > ceilingPct ? ' The project\'s ' + projectPct + '% applies on a larger screen.' : '')
        : '';
      hint.style.display = held ? '' : 'none';
    }
    const speed = App.getWheelZoomSpeed();
    const speedPct = Math.round(speed * 100);
    document.getElementById('zoomSpeed').value = speedPct;
    document.getElementById('zoomSpeedVal').textContent = speed.toFixed(1);
    App.showModal('zoomModal');
  }

  document.getElementById('zoomModalClose').onclick = () => {
    const state = App.state;
    const maxPct = parseInt(document.getElementById('zoomMax').value, 10);
    if (shownMaxPct == null || maxPct !== shownMaxPct) state.maxZoom = maxPct / 100;   // DEEP-ZOOM: an untouched slider leaves the project's ceiling alone
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

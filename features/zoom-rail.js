/*
 * features/zoom-rail.js - the giant vertical zoom slider ("zoom rail") that
 * floats on the right edge of the page, opened by clicking the footer zoom-%
 * label. A feature-file split under the window.App registry pattern.
 *
 * Loaded as a classic <script src="features/zoom-rail.js"> AFTER app.js. Its
 * own IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry, registers openZoomRail/closeZoomRail back onto App
 * (the single inbound call site - the zoom-% click - calls App.toggleZoomRail
 * at user-action time), and binds the rail's track/buttons at this file's
 * load. The zoom-% click toggles the rail; Zoom Settings opens only from the
 * rail's gear button (the rail's z-index 300 floats above the modal backdrop's
 * 200 so both stay usable together). The rail stays up until dismissed -
 * outside click, Escape, or re-clicking the zoom % (B9/J15: the old ~5s idle
 * auto-fade was an invisible timer that lost the rail mid-adjustment on a
 * field pause). The rail replaced the old #zoomOverlay popover on mobile.
 *
 * The track maps zoom logarithmically (equal distance per doubling) between
 * the hard-coded 0.2 minimum and App.getMaxZoom(), with tick marks at round
 * percentages and a light magnetic snap (within 2% ratio of a tick). Drags
 * anchor the zoom at the canvas-wrapper center and reuse app.js's cheap
 * transform preview + debounced commit (App.updateContainerTransform /
 * App.commitWheelZoom - publish-only, the wheel/pinch paths keep them).
 * Per drag-move the rail runs only the light App.syncZoomIndicators() (zoom-%
 * readout + thumb), never the full updateUI() - the sidebar rebuild is what
 * made zoom gestures lag on large multi-page projects; the full updateUI()
 * runs once in the commit. updateUI() calls App.onZoomRailSync() after every
 * zoom change so the thumb tracks wheel / pinch / +- / fit while the rail is
 * open.
 *
 * Boundary rule: all shared dependencies are read from App.* at call time,
 * never captured at load, so load order beyond "after app.js" does not
 * matter. See ARCHITECTURE.md "Feature files / window.App registry". No
 * build step.
 */
(function() {
  const App = (window.App = window.App || {});

  // The hard-coded zoom floor used across app.js (wheel, pinch, -, fit).
  const MIN_ZOOM = 0.2;
  // Round-percent tick candidates; filtered to [MIN_ZOOM*100, maxZoom*100].
  const TICK_PCTS = [25, 50, 75, 100, 150, 200, 300, 400, 600, 800, 1200];
  // Majors get a wider mark + a text label (the 64px rail stays uncluttered).
  const MAJOR_PCTS = [25, 50, 100, 200, 400, 800];

  const rail = document.getElementById('zoomRail');
  const track = document.getElementById('zoomRailTrack');
  const thumb = document.getElementById('zoomRailThumb');
  const thumbLabel = document.getElementById('zoomRailThumbLabel');
  const ticksEl = document.getElementById('zoomRailTicks');

  let builtMax = null;    // the maxZoom the ticks were last built for
  let dragging = false;
  let commitTimer = null; // mid-drag safety re-render (long slow drags stay crisp)

  // Log mapping: t in [0,1] bottom->top; zoom = MIN * (max/MIN)^t.
  function zoomToT(z, max) { return Math.log(z / MIN_ZOOM) / Math.log(max / MIN_ZOOM); }
  function tToZoom(t, max) { return MIN_ZOOM * Math.pow(max / MIN_ZOOM, t); }

  function buildTicks() {
    const max = App.getMaxZoom();
    builtMax = max;
    ticksEl.innerHTML = '';
    const maxPct = Math.round(max * 100);
    const pcts = TICK_PCTS.filter((p) => p >= MIN_ZOOM * 100 && p <= maxPct);
    for (const p of pcts) {
      const t = zoomToT(p / 100, max);
      const top = ((1 - t) * 100) + '%';
      const major = MAJOR_PCTS.includes(p) || p === maxPct;
      const tick = document.createElement('div');
      tick.className = 'zoom-rail-tick' + (major ? ' major' : '');
      tick.style.top = top;
      ticksEl.appendChild(tick);
      if (major) {
        const lbl = document.createElement('div');
        lbl.className = 'zoom-rail-tick-label';
        lbl.textContent = p + '%';
        lbl.style.top = top;
        ticksEl.appendChild(lbl);
      }
    }
  }

  function positionThumb() {
    const t = Math.max(0, Math.min(1, zoomToT(App.state.zoom, App.getMaxZoom())));
    thumb.style.top = ((1 - t) * 100) + '%';
    thumbLabel.textContent = Math.round(App.state.zoom * 100) + '%';
  }

  // Set zoom anchored at the canvas-wrapper center (same focal math as the
  // wheel handler, with the viewport midpoint as the fixed point).
  function applyZoom(newZoom) {
    const state = App.state;
    newZoom = Math.max(MIN_ZOOM, Math.min(App.getMaxZoom(), newZoom));
    if (newZoom === state.zoom) return;
    const wrap = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper');
    const pt = wrap ? { x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 } : { x: 0, y: 0 };
    const pdfX = (pt.x - state.pan.x) / state.zoom;
    const pdfY = (pt.y - state.pan.y) / state.zoom;
    state.pan.x = pt.x - pdfX * newZoom;
    state.pan.y = pt.y - pdfY * newZoom;
    state.zoom = newZoom;
    App.updateContainerTransform();
    App.syncZoomIndicators(); // writes #zoomPct and fires onZoomRailSync -> positionThumb
  }

  function zoomFromPointer(e) {
    const r = track.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    let z = tToZoom(t, App.getMaxZoom());
    // Light magnetic snap: within 2% (ratio) of a tick value snaps to it.
    for (const p of TICK_PCTS) {
      const tz = p / 100;
      if (tz >= MIN_ZOOM && tz <= App.getMaxZoom() && Math.abs(z / tz - 1) < 0.02) { z = tz; break; }
    }
    return z;
  }

  track.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    dragging = true;
    applyZoom(zoomFromPointer(e)); // jump-to-position, then drag
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    applyZoom(zoomFromPointer(e));
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => { commitTimer = null; App.commitWheelZoom(); }, 400);
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
    App.commitWheelZoom(); // one crisp render (mirrors the pinch commit-on-touchend)
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  document.getElementById('zoomRailPlus').onclick = (e) => { e.stopPropagation(); App.doZoomIn(); };
  document.getElementById('zoomRailMinus').onclick = (e) => { e.stopPropagation(); App.doZoomOut(); };
  // Unlike the old popover, the gear does NOT close the rail - the rail is
  // designed to coexist with the Zoom Settings modal.
  document.getElementById('zoomRailSettings').onclick = (e) => { e.stopPropagation(); App.showZoomModal(); };

  // B9 (J15): no idle auto-fade — the rail stays where the user put it until
  // an explicit dismissal (outside click, Escape, re-click the zoom %, or the
  // project unloading). The old ~5s timer was invisible: a field pause (glance
  // at the drawing, gloves) lost the rail mid-adjustment.
  function openZoomRail() {
    if (!App.state.pages.length) return;
    buildTicks();
    // The [hidden] attribute keeps the rail invisible even under a stale-cache
    // "mixed shell" load (new HTML + a previous version's CSS, which lacks the
    // .zoom-rail rules); with current CSS the classes drive display as usual.
    rail.hidden = false;
    rail.classList.add('visible');
    positionThumb();
  }
  function closeZoomRail() {
    rail.classList.remove('visible');
    rail.hidden = true;
  }
  function toggleZoomRail() {
    if (rail.classList.contains('visible')) closeZoomRail();
    else openZoomRail();
  }

  // Dismissal: outside click. The rail, its opener, and the Zoom Settings
  // modal (a full-screen .modal-overlay - clicks on it or its backdrop) all
  // count as "inside" so using the settings modal never dismisses the rail.
  document.addEventListener('click', (e) => {
    if (!rail.classList.contains('visible')) return;
    if (e.target.closest('#zoomRail') || e.target.closest('#zoomPct') || e.target.closest('#zoomModal')) return;
    closeZoomRail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rail.classList.contains('visible')) closeZoomRail();
  });

  // Called from app.js updateUI() (and the pinch rAF) after every zoom change.
  App.onZoomRailSync = () => {
    if (!rail.classList.contains('visible')) return;
    if (!App.state.pages.length) { closeZoomRail(); return; }
    if (App.getMaxZoom() !== builtMax) buildTicks(); // Zoom Settings changed max while open
    positionThumb();
  };
  App.openZoomRail = openZoomRail;
  App.closeZoomRail = closeZoomRail;
  App.toggleZoomRail = toggleZoomRail;
})();

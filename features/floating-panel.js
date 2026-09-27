/*
 * features/floating-panel.js - the drag and remembered spot the floating tool
 * palettes share (R20, 2026-09-26).
 *
 * The Chain palette (features/chain.js), the Drop palette (features/drop-mode.js)
 * and the Highlights bookmarks panel (features/highlight-labels.js) each drag by
 * their title bar and keep the spot per device in localStorage (chainPanelPos,
 * dropPanelPos, highlightPanelPos). They carried three byte-identical copies of
 * this code; now each calls
 *
 *   const fp = App.makeFloatingPanel({ panelId, headId, closeId, posKey, defaultWidth });
 *   fp.wireDrag();   // once, from the tool's own wire()
 *   fp.applyPos();   // on every show
 *
 * inside its own wire(), at call time, keeping its own ids, key and width. The
 * open / close / collapse lifecycle stays in each tool: it wraps the tool's own
 * sync function and tool enum, and little of it is shared.
 *
 * Rules the three shared, kept as they were:
 * - a stored spot that no longer fits the viewport (off an edge, or the head
 *   less than 60px from the bottom) is ignored and the CSS dock wins;
 * - a drag clamps the panel inside the viewport, the same 60px kept at the bottom;
 * - a press on the close button is never a drag.
 * New (D43): a drag ends on pointerup OR pointercancel. A touch drag the browser
 * cancels (a system gesture, a palm) never sends pointerup, and the move handler,
 * with its stale offset, used to stay on the head and drag the panel on any later
 * movement. A cancelled drag now unbinds and keeps the spot it reached, like a drop.
 *
 * Load order: before chain.js, so it is registered before any palette can sync.
 * No state, no app.js deps. Regression: chain.spec.js, drop-mode.spec.js,
 * highlight-labels.spec.js (the three drag-persist cases) and mobile-touch.spec.js
 * (the cancelled touch drag on all three).
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // The head row stays this far inside the bottom edge, in a stored spot and in a drag.
  const KEEP_BOTTOM_PX = 60;

  function makeFloatingPanel({ panelId, headId, closeId, posKey, defaultWidth }) {
    function loadPos() {
      try { return JSON.parse(localStorage.getItem(posKey)) || null; } catch { return null; }
    }

    // Put the panel at its remembered spot, when there is one and it still fits.
    function applyPos() {
      const panel = document.getElementById(panelId);
      const pos = loadPos();
      if (!panel || !pos) return;
      const w = panel.offsetWidth || defaultWidth;
      if (pos.x < 0 || pos.y < 0 || pos.x + w > window.innerWidth || pos.y + KEEP_BOTTOM_PX > window.innerHeight) return;
      panel.style.left = pos.x + 'px';
      panel.style.top = pos.y + 'px';
    }

    // Bind the title-bar drag. Call once; the tool's wire() guards that.
    function wireDrag() {
      const panel = document.getElementById(panelId);
      const head = document.getElementById(headId);
      if (!panel || !head) return;
      head.addEventListener('pointerdown', (e) => {
        if (closeId && e.target.closest('#' + closeId)) return;
        const rect = panel.getBoundingClientRect();
        const offX = e.clientX - rect.left;
        const offY = e.clientY - rect.top;
        head.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const x = Math.max(0, Math.min(ev.clientX - offX, window.innerWidth - rect.width));
          const y = Math.max(0, Math.min(ev.clientY - offY, window.innerHeight - KEEP_BOTTOM_PX));
          panel.style.left = x + 'px';
          panel.style.top = y + 'px';
        };
        const end = () => {
          head.removeEventListener('pointermove', move);
          head.removeEventListener('pointerup', end);
          head.removeEventListener('pointercancel', end);
          const r = panel.getBoundingClientRect();
          try { localStorage.setItem(posKey, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch { /* storage full/blocked, the position just won't persist */ }
        };
        head.addEventListener('pointermove', move);
        head.addEventListener('pointerup', end);
        head.addEventListener('pointercancel', end);
        e.preventDefault();
      });
    }

    return { applyPos, wireDrag };
  }

  App.makeFloatingPanel = makeFloatingPanel;
})();

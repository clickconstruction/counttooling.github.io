(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Tool context menus: right-click on a header/sidebar tool button (or an
  // active-item chip) opens the #toolContextMenu mini menu with that tool's
  // actions; tools with no settings answer with a toast so the gesture
  // always visibly responds. Centralized from the nine one-off
  // oncontextmenu handlers that had accumulated in app.js +
  // features/counter.js (which reached the same settings modals through the
  // sidebar section-title relay). One declarative map is the single source:
  // buttonId -> action list; header/sidebar twins and chips alias shared
  // lists.
  //
  // Loaded as a classic <script src="/features/tool-context-menu.js"> AFTER
  // app.js. Registers only the App.__toolContextMap test seam
  // (element-bound-only split, the zone-modals pattern). The dismissal
  // listeners (pointerdown/keydown/resize/scroll) are attached only while
  // the menu is open and removed on hide; Escape is handled in the capture
  // phase with stopImmediatePropagation so the app's global Escape handler
  // (which closes modals) never sees the same press. Desktop + tablet
  // (native contextmenu events) for now; phone long-press + burger-drawer
  // wiring is a planned follow-up.
  // Boundary rule: read shared deps from App.* at call time, never captured
  // at load. Viewer gate: viewers get no tool context actions (matching the
  // original handlers). See ARCHITECTURE.md "Feature files / window.App
  // registry". No build step.

  const clickEl = (id) => () => { const el = document.getElementById(id); if (el) el.click(); };

  const COUNTER_ACTIONS = [
    { label: 'Counter Settings…', run: () => App.openCounterSettingsModal() },
    { label: 'Add counter…', run: clickEl('addCounter') },
  ];
  const LINE_TYPE_ACTIONS = [
    { label: 'Line Type Settings…', run: () => App.openLineTypeSettingsModal() },
    { label: 'Add line type…', run: clickEl('addLineType') },
  ];
  const MULTIPLY_ZONE_ACTIONS = [
    { label: 'Multiply Zone Settings…', run: () => App.openMultiplyZoneSettingsModal() },
  ];
  const SCALE_ZONE_ACTIONS = [
    { label: 'Scale Zone Settings…', run: () => App.openScaleZoneSettingsModal() },
  ];
  const LEGEND_ACTIONS = [
    { label: 'Legend Settings…', run: () => App.openLegendSettingsModal() },
  ];
  const GRID_ACTIONS = [
    { label: 'Grid Settings…', run: () => App.openGridSettingsModal() },
  ];
  // Move's and Measure's "settings" is the page's scale: once a scale is set,
  // the Set Scale flow is otherwise buried behind the header S tool, so the
  // resting tool — and the tool whose readout is wrong when the scale is —
  // both give a direct path to review/edit it (features/scale.js registers
  // openScaleModal; registry-mediated, read at call time).
  // The "Open a plan first." no-plan gate lives INSIDE openScaleModal now
  // (Tier-3 B8) — one gate for every entrance, same copy as the per-caller
  // guard this line used to carry.
  const SCALE_EDIT_ACTIONS = [
    { label: 'Set / edit scale…', run: () => App.openScaleModal() },
  ];
  // Highlight's "settings" is its bookmarks panel: arm the tool (the button
  // click also reopens the panel) so the named-highlight list is one gesture
  // away from either button.
  const HIGHLIGHT_ACTIONS = [
    { label: 'Highlights panel…', run: () => { const el = document.getElementById('highlightBtn'); if (el) el.click(); } },
  ];

  const TOOL_CONTEXT = {
    moveBtn: SCALE_EDIT_ACTIONS,
    moveBtnSidebar: SCALE_EDIT_ACTIONS,
    measureBtn: SCALE_EDIT_ACTIONS,
    measureBtnSidebar: SCALE_EDIT_ACTIONS,
    counterBtn: COUNTER_ACTIONS,
    counterBtnSidebar: COUNTER_ACTIONS,
    headerActiveCounter: COUNTER_ACTIONS,
    quickLine: LINE_TYPE_ACTIONS,
    quickLineSidebar: LINE_TYPE_ACTIONS,
    polylineBtn: LINE_TYPE_ACTIONS,
    polylineBtnSidebar: LINE_TYPE_ACTIONS,
    headerActiveLineType: LINE_TYPE_ACTIONS,
    highlightBtn: HIGHLIGHT_ACTIONS,
    highlightBtnSidebar: HIGHLIGHT_ACTIONS,
    multiplyZoneBtn: MULTIPLY_ZONE_ACTIONS,
    multiplyZoneBtnSidebar: MULTIPLY_ZONE_ACTIONS,
    scaleZoneBtn: SCALE_ZONE_ACTIONS,
    scaleZoneBtnSidebar: SCALE_ZONE_ACTIONS,
    legendBtn: LEGEND_ACTIONS,
    legendBtnSidebar: LEGEND_ACTIONS,
    gridBtn: GRID_ACTIONS,
    gridBtnSidebar: GRID_ACTIONS,
  };

  // Tools with no settings surface: the gesture still responds (toast), so
  // the right-click convention never looks broken.
  const NO_SETTINGS_TOOLS = [
    'setScale', 'setScaleSidebar',
    'deleteZoneBtn', 'deleteZoneBtnSidebar',
    'noteBtn', 'noteBtnSidebar',
    'roomBtn', 'roomBtnSidebar',
    'hideMarksBtn',
  ];

  // --- Mini-menu popover ----------------------------------------------------
  let openedFor = null;   // anchor element while the menu is up, else null

  function hideToolContextMenu() {
    const menu = document.getElementById('toolContextMenu');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    openedFor = null;
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('keydown', onDocKeyDown, true);
    window.removeEventListener('resize', hideToolContextMenu);
    window.removeEventListener('scroll', hideToolContextMenu, true);
  }
  function onDocPointerDown(e) {
    const menu = document.getElementById('toolContextMenu');
    if (menu && !menu.contains(e.target)) hideToolContextMenu();
  }
  function onDocKeyDown(e) {
    if (e.key === 'Escape') {
      // Capture-phase + stopImmediatePropagation: one Escape closes only the
      // menu, never the modal underneath (the global handler runs later in
      // the dispatch order and must not see this press).
      e.stopImmediatePropagation();
      e.preventDefault();
      const anchor = openedFor;
      hideToolContextMenu();
      if (anchor && anchor.focus) anchor.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...document.querySelectorAll('#toolContextMenu button')];
      if (!items.length) return;
      e.preventDefault();
      const idx = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown'
        ? items[(idx + 1) % items.length]
        : items[(idx - 1 + items.length) % items.length];
      next.focus();
    }
  }

  function showToolContextMenu(anchorEl, actions) {
    const menu = document.getElementById('toolContextMenu');
    if (!menu) { actions[0].run(); return; }   // markup missing: degrade to direct-open
    menu.innerHTML = '';
    actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'menuitem');
      btn.textContent = a.label;
      btn.onclick = () => { hideToolContextMenu(); a.run(); };
      menu.appendChild(btn);
    });
    menu.hidden = false;
    openedFor = anchorEl;
    // Below the button, clamped to the viewport (position: fixed).
    const r = anchorEl.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(4, Math.min(r.left, window.innerWidth - mw - 4)) + 'px';
    menu.style.top = (r.bottom + mh + 4 > window.innerHeight ? Math.max(4, r.top - mh - 4) : r.bottom + 4) + 'px';
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onDocKeyDown, true);
    window.addEventListener('resize', hideToolContextMenu);
    window.addEventListener('scroll', hideToolContextMenu, true);
    const first = menu.querySelector('button');
    if (first) first.focus();
  }

  Object.entries(TOOL_CONTEXT).forEach(([id, actions]) => {
    const el = document.getElementById(id);
    if (el) el.oncontextmenu = (e) => {
      e.preventDefault();
      if (App.state.isViewer) return;
      showToolContextMenu(el, actions);
    };
  });
  NO_SETTINGS_TOOLS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.oncontextmenu = (e) => {
      e.preventDefault();
      if (App.state.isViewer) return;
      App.showToast('No settings for this tool.', 2000);
    };
  });

  // Test seam (frozen by tool-context-menu.spec.js): the wired ids and their
  // action labels, plus the toast-only list.
  App.__toolContextMap = () => ({
    tools: Object.fromEntries(Object.entries(TOOL_CONTEXT).map(([id, a]) => [id, a.map((x) => x.label)])),
    noSettings: NO_SETTINGS_TOOLS.slice(),
  });
})();

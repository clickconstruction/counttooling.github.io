(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Tool context menus (right-click on the header/sidebar tool buttons and
  // the active-item chips) -- centralized from app.js + features/counter.js,
  // where nine one-off oncontextmenu handlers had accumulated. One
  // declarative map is the single source: buttonId -> action list; aliases
  // (header/sidebar twins, chips) share one list. Right-click runs the
  // PRIMARY (first) action directly -- identical outcome to the scattered
  // handlers they replace, which reached the same settings modals through
  // the sidebar section-title relay (#countersSectionTitle /
  // #lineTypesSectionTitle onclick -> openXSettingsModal). The action lists
  // are shaped for the planned mini-menu popover, which will surface every
  // entry.
  //
  // Loaded as a classic <script src="/features/tool-context-menu.js"> AFTER
  // app.js. Registers no entry points (element-bound-only split, the
  // zone-modals pattern) beyond the App.__toolContextMap test seam.
  // Boundary rule: read shared deps from App.* at call time, never captured
  // at load. Viewer gate: viewers get no tool context actions (matching the
  // original handlers). See ARCHITECTURE.md "Feature files / window.App
  // registry". No build step.

  const COUNTER_ACTIONS = [
    { label: 'Counter Settings…', run: () => App.openCounterSettingsModal() },
  ];
  const LINE_TYPE_ACTIONS = [
    { label: 'Line Type Settings…', run: () => App.openLineTypeSettingsModal() },
  ];
  const MULTIPLY_ZONE_ACTIONS = [
    { label: 'Multiply Zone Settings…', run: () => App.openMultiplyZoneSettingsModal() },
  ];

  const TOOL_CONTEXT = {
    counterBtn: COUNTER_ACTIONS,
    counterBtnSidebar: COUNTER_ACTIONS,
    quickLine: LINE_TYPE_ACTIONS,
    quickLineSidebar: LINE_TYPE_ACTIONS,
    polylineBtn: LINE_TYPE_ACTIONS,
    polylineBtnSidebar: LINE_TYPE_ACTIONS,
    headerActiveLineType: LINE_TYPE_ACTIONS,
    multiplyZoneBtn: MULTIPLY_ZONE_ACTIONS,
    multiplyZoneBtnSidebar: MULTIPLY_ZONE_ACTIONS,
  };

  function onToolContextMenu(e, actions) {
    e.preventDefault();
    if (App.state.isViewer) return;
    actions[0].run();
  }

  Object.entries(TOOL_CONTEXT).forEach(([id, actions]) => {
    const el = document.getElementById(id);
    if (el) el.oncontextmenu = (e) => onToolContextMenu(e, actions);
  });

  // Test seam (frozen by tool-context-menu.spec.js): the wired ids and their
  // action labels, without dispatching real contextmenu events per alias.
  App.__toolContextMap = () =>
    Object.fromEntries(Object.entries(TOOL_CONTEXT).map(([id, a]) => [id, a.map((x) => x.label)]));
})();

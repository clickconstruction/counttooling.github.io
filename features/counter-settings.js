/*
 * features/counter-settings.js - the Counter settings modal (counterSettingsModal),
 * extracted from the app.js IIFE as the tenth feature-file split under the
 * window.App registry pattern. The first two-region consolidation: the opener /
 * close / reorder lived in the "Line type, counter & page settings modal
 * handlers" grab-bag while the value handlers lived in a separate
 * "// SECTION: Counter settings handlers" block - both are merged here.
 *
 * MAP-SETTINGS (2026-09-26): the settings are a device preference. Every slider
 * and toggle is a row in SLIDERS / TOGGLES, bound by one loop each, and every
 * change writes localStorage `counterSettings` through App.saveDisplaySettings
 * (app.js merges it over the defaults at boot). Never the project payload.
 *
 * Loaded as a classic <script src="features/counter-settings.js"> AFTER app.js.
 * Its own IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openCounterSettingsModal back onto App, and binds the modal's value handlers
 * + close + reorder + the Counters gear opener (#countersSettingsBtn) at this
 * file's load. HEADING-CLICK (2026-09-27): the COUNTERS title folds the list;
 * the gear and the Counter buttons' right-click menu open this modal.
 *
 * Scope is the Counter *settings* modal only. The Counters section fold (the
 * title and #countersCollapseIcon, features/sidebar-lists.js), the sidebar inline show-only button
 * (#counterShowOnlyOnPageInlineBtn), the shared #sidebarReorderFinish, and the
 * Escape-key close branch stay in app.js; they sync the static modal DOM by id
 * / set state directly, so they are independent of the moved JS. Boundary rule:
 * read shared deps from App.* at call time, never captured at load. See
 * ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  // The modal's sliders and toggles, one row each (MAP-SETTINGS / R18): `pct` sliders
  // show 0-100 over a 0-1 setting; `dflt` is what an unset field opens at. Every change
  // renders live and writes the device's settings through App.saveDisplaySettings.
  const SLIDERS = [
    { id: 'counterSize', key: 'size', dflt: 22 },
    { id: 'counterOpacity', key: 'opacity', dflt: 1, pct: true },
    { id: 'counterOutline', key: 'outlineSize', dflt: 0 },
    { id: 'counterNumberSize', key: 'numberSize', dflt: 10 },
    { id: 'counterRingSize', key: 'ringSize', dflt: 100 },
    { id: 'counterRingOpacity', key: 'ringOpacity', dflt: 1, pct: true },
  ];
  // A toggle is a hidden checkbox behind an aria-pressed button; `after` runs on change.
  const TOGGLES = [
    { id: 'counterShowRings', key: 'showRings', after: (on) => { document.getElementById('counterRingSection').style.display = on ? '' : 'none'; } },
    { id: 'counterRingSolid', key: 'ringSolid' },
  ];
  const shown = (row, v) => (row.pct ? Math.round(v * 100) : v);

  function openCounterSettingsModal() {
    const state = App.state;
    const cs = state.counterSettings;
    SLIDERS.forEach((row) => {
      const v = shown(row, cs[row.key] ?? row.dflt);
      document.getElementById(row.id).value = v;
      document.getElementById(row.id + 'Val').textContent = v;
    });
    TOGGLES.forEach((row) => {
      const on = !!cs[row.key];
      document.getElementById(row.id).checked = on;
      document.getElementById(row.id + 'Btn').setAttribute('aria-pressed', on);
      if (row.after) row.after(on);
    });
    App.syncFilterScopeSegment('counterShowOnlySegment', App.getCounterListFilterScope());
    document.getElementById('counterSettingsReorder').style.display = state.counters.length < 2 ? 'none' : '';
    App.showModal('counterSettingsModal');
  }

  // HEADING-CLICK (2026-09-27): the gear beside the title opens the settings; the title
  // itself folds the list (features/sidebar-lists.js bindCollapse).
  document.getElementById('countersSettingsBtn').onclick = () => openCounterSettingsModal();

  document.getElementById('counterSettingsClose').onclick = () => App.hideModal('counterSettingsModal');
  // Backdrop click closes like the Close button (Tier-3 B1 / J4; same
  // e.target === overlay pattern as checkoutExpiredRecoveryModal in app.js).
  document.getElementById('counterSettingsModal').onclick = (e) => {
    if (e.target === e.currentTarget) App.hideModal('counterSettingsModal');
  };

  document.getElementById('counterSettingsReorder').onclick = () => {
    const state = App.state;
    App.hideModal('counterSettingsModal');
    state.countersListCollapsed = false;
    state.lineTypesListCollapsed = false;
    document.getElementById('countersSection').classList.remove('collapsed');
    document.getElementById('countersCollapseIcon').textContent = '▼';
    document.getElementById('lineTypesSection').classList.remove('collapsed');
    document.getElementById('lineTypesCollapseIcon').textContent = '▼';
    state.sidebarReorderModeActive = true;
    document.getElementById('countersList').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    App.updateUI();
    App.showToast('Drag Counters and Lines by their left colors to re-order.', 3200);
  };

  SLIDERS.forEach((row) => {
    document.getElementById(row.id).oninput = () => {
      const cs = App.state.counterSettings;
      const n = parseInt(document.getElementById(row.id).value, 10);
      cs[row.key] = row.pct ? n / 100 : n;
      document.getElementById(row.id + 'Val').textContent = shown(row, cs[row.key]);
      App.saveDisplaySettings();
      App.renderAnnotations();
    };
  });
  TOGGLES.forEach((row) => {
    document.getElementById(row.id + 'Btn').onclick = () => {
      const cb = document.getElementById(row.id);
      cb.checked = !cb.checked;
      document.getElementById(row.id + 'Btn').setAttribute('aria-pressed', cb.checked);
      cb.dispatchEvent(new Event('change'));
    };
    document.getElementById(row.id).onchange = () => {
      const on = document.getElementById(row.id).checked;
      App.state.counterSettings[row.key] = on;
      if (row.after) row.after(on);
      App.saveDisplaySettings();
      App.renderAnnotations();
    };
  });
  document.querySelectorAll('#counterShowOnlySegment button').forEach(btn => {
    btn.onclick = () => {
      App.setCounterListFilterScope(btn.dataset.scope);
      App.syncFilterScopeSegment('counterShowOnlySegment', btn.dataset.scope);
      App.renderCountersList();
      App.updateUI();
    };
  });

  App.openCounterSettingsModal = openCounterSettingsModal;
})();

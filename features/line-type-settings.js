/*
 * features/line-type-settings.js - the Line Type settings modal
 * (lineTypeSettingsModal), extracted from the app.js IIFE as the eleventh
 * feature-file split under the window.App registry pattern. This drains the last
 * settings-modal unit from the old "Line type, counter & page settings modal
 * handlers" grab-bag (page left in pilot #8, counter in #10, line-type here).
 *
 * MAP-SETTINGS (2026-09-26): the settings are a device preference. Every slider
 * and toggle is a row in SLIDERS / TOGGLES, bound by one loop each, and every
 * change (the drop-icon grid too) writes localStorage `lineTypeSettings` through
 * App.saveDisplaySettings (app.js merges it over the defaults at boot; the header
 * Snap button and the J hotkey write through the same door). Never the project.
 *
 * Loaded as a classic <script src="features/line-type-settings.js"> AFTER
 * app.js. Its own IIFE: it reaches the cross-cutting state + helpers through the
 * shared window.App registry that app.js populates during its own load,
 * registers openLineTypeSettingsModal back onto App, and binds the modal's value
 * handlers + close + reorder + the Line Types section-title opener at this
 * file's load.
 *
 * Scope is the Line Type *settings* modal only. The header snap button
 * (#lineTypeSnapToHVHeaderBtn), the sidebar inline show-only buttons
 * (#lineTypeShowOnlyOnPageInlineBtn / #linesShowOnlyOnPageBtn), the shared
 * #sidebarReorderFinish, the J-hotkey snap toggle, and the Escape-key close
 * branch all stay in app.js; they set state directly / sync the static modal DOM
 * by id, so they are independent of the moved JS. The 5 right-click
 * (#lineTypesSectionTitle.click()) entry points on the Quick Line / Polyline
 * buttons keep working because the opener stays bound to that element's onclick.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  // The modal's sliders and toggles, one row each (MAP-SETTINGS / R18), the same shape as
  // features/counter-settings.js: `pct` sliders show 0-100 over a 0-1 setting, `dflt` is what
  // an unset field opens at, a toggle's `on` reads its field (orient defaults ON), `ui` asks
  // for an updateUI after the render (Snap lights the header button). Every change writes
  // the device's settings through App.saveDisplaySettings.
  const SLIDERS = [
    { id: 'lineTypeSize', key: 'lineSize', dflt: 2 },
    { id: 'lineTypeOpacity', key: 'opacity', dflt: 1, pct: true },
    { id: 'lineTypeDropXSize', key: 'dropXSize', dflt: 10 },
    { id: 'lineTypeParallelEnds', key: 'parallelEndsSize', dflt: 10 },
    { id: 'lineTypeLengthLabel', key: 'lengthLabelSize', dflt: 12 },
  ];
  const TOGGLES = [
    { id: 'lineTypeOrientLength', key: 'orientLengthWithLine', on: (v) => v !== false },
    { id: 'lineTypeSnapToHV', key: 'snapToHorizontalVertical', on: (v) => !!v, ui: true },
  ];
  const shown = (row, v) => (row.pct ? Math.round(v * 100) : v);

  function openLineTypeSettingsModal() {
    const state = App.state;
    const lts = state.lineTypeSettings;
    SLIDERS.forEach((row) => {
      const v = shown(row, lts[row.key] ?? row.dflt);
      document.getElementById(row.id).value = v;
      document.getElementById(row.id + 'Val').textContent = v;
    });
    const dropIconGrid = document.getElementById('lineTypeDropIconGrid');
    const currentStyle = lts.dropIconStyle ?? 'circle';
    dropIconGrid.innerHTML = App.DROP_ICON_STYLES.map(st =>
      '<div class="icon-cell' + (st.id === currentStyle ? ' selected' : '') + '" data-style="' + st.id + '" title="' + st.name + '">' + st.svg + '</div>'
    ).join('');
    dropIconGrid.querySelectorAll('.icon-cell').forEach(c => {
      c.onclick = () => {
        dropIconGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        state.lineTypeSettings.dropIconStyle = c.dataset.style;
        App.saveDisplaySettings();
        App.renderAnnotations();
      };
    });
    TOGGLES.forEach((row) => {
      const on = row.on(lts[row.key]);
      document.getElementById(row.id).checked = on;
      document.getElementById(row.id + 'Btn').setAttribute('aria-pressed', on);
    });
    App.syncFilterScopeSegment('lineTypeShowOnlySegment', App.getLineTypeListFilterScope());
    document.getElementById('lineTypeSettingsReorder').style.display = state.lineTypes.length < 2 ? 'none' : '';
    App.showModal('lineTypeSettingsModal');
  }

  document.getElementById('lineTypesSectionTitle').onclick = (e) => {
    if (e.target.closest('#lineTypesCollapseIcon')) return;
    openLineTypeSettingsModal();
  };

  document.getElementById('lineTypeSettingsClose').onclick = () => App.hideModal('lineTypeSettingsModal');

  SLIDERS.forEach((row) => {
    document.getElementById(row.id).oninput = () => {
      const lts = App.state.lineTypeSettings;
      const n = parseInt(document.getElementById(row.id).value, 10);
      lts[row.key] = row.pct ? n / 100 : n;
      document.getElementById(row.id + 'Val').textContent = shown(row, lts[row.key]);
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
      App.state.lineTypeSettings[row.key] = document.getElementById(row.id).checked;
      App.saveDisplaySettings();
      App.renderAnnotations();
      if (row.ui) App.updateUI();
    };
  });
  document.querySelectorAll('#lineTypeShowOnlySegment button').forEach(btn => {
    btn.onclick = () => {
      App.setLineTypeListFilterScope(btn.dataset.scope);
      App.syncFilterScopeSegment('lineTypeShowOnlySegment', btn.dataset.scope);
      App.renderLineTypesList();
      App.updateUI();
    };
  });

  document.getElementById('lineTypeSettingsReorder').onclick = () => {
    const state = App.state;
    App.hideModal('lineTypeSettingsModal');
    state.countersListCollapsed = false;
    state.lineTypesListCollapsed = false;
    document.getElementById('countersSection').classList.remove('collapsed');
    document.getElementById('countersCollapseIcon').textContent = '▼';
    document.getElementById('lineTypesSection').classList.remove('collapsed');
    document.getElementById('lineTypesCollapseIcon').textContent = '▼';
    state.sidebarReorderModeActive = true;
    document.getElementById('lineTypesList').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    App.updateUI();
    App.showToast('Drag Counters and Lines by their left colors to re-order.', 3200);
  };

  App.openLineTypeSettingsModal = openLineTypeSettingsModal;
})();

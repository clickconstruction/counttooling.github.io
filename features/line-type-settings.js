/*
 * features/line-type-settings.js - the Line Type settings modal
 * (lineTypeSettingsModal), extracted from the app.js IIFE as the eleventh
 * feature-file split under the window.App registry pattern. This drains the last
 * settings-modal unit from the old "Line type, counter & page settings modal
 * handlers" grab-bag (page left in pilot #8, counter in #10, line-type here).
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

  function openLineTypeSettingsModal() {
    const state = App.state;
    document.getElementById('lineTypeSize').value = state.lineTypeSettings.lineSize ?? 2;
    document.getElementById('lineTypeSizeVal').textContent = state.lineTypeSettings.lineSize ?? 2;
    document.getElementById('lineTypeOpacity').value = Math.round((state.lineTypeSettings.opacity ?? 1) * 100);
    document.getElementById('lineTypeOpacityVal').textContent = Math.round((state.lineTypeSettings.opacity ?? 1) * 100);
    document.getElementById('lineTypeDropXSize').value = state.lineTypeSettings.dropXSize ?? 10;
    document.getElementById('lineTypeDropXSizeVal').textContent = state.lineTypeSettings.dropXSize ?? 10;
    const dropIconGrid = document.getElementById('lineTypeDropIconGrid');
    const currentStyle = state.lineTypeSettings.dropIconStyle ?? 'circle';
    dropIconGrid.innerHTML = App.DROP_ICON_STYLES.map(st =>
      '<div class="icon-cell' + (st.id === currentStyle ? ' selected' : '') + '" data-style="' + st.id + '" title="' + st.name + '">' + st.svg + '</div>'
    ).join('');
    dropIconGrid.querySelectorAll('.icon-cell').forEach(c => {
      c.onclick = () => {
        dropIconGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        state.lineTypeSettings.dropIconStyle = c.dataset.style;
        App.renderAnnotations();
      };
    });
    const orientCb = document.getElementById('lineTypeOrientLength');
    const orientBtn = document.getElementById('lineTypeOrientLengthBtn');
    orientCb.checked = state.lineTypeSettings.orientLengthWithLine !== false;
    orientBtn.setAttribute('aria-pressed', orientCb.checked);
    document.getElementById('lineTypeParallelEnds').value = state.lineTypeSettings.parallelEndsSize ?? 10;
    document.getElementById('lineTypeParallelEndsVal').textContent = state.lineTypeSettings.parallelEndsSize ?? 10;
    document.getElementById('lineTypeLengthLabel').value = state.lineTypeSettings.lengthLabelSize ?? 12;
    document.getElementById('lineTypeLengthLabelVal').textContent = state.lineTypeSettings.lengthLabelSize ?? 12;
    const snapCb = document.getElementById('lineTypeSnapToHV');
    const snapBtn = document.getElementById('lineTypeSnapToHVBtn');
    snapCb.checked = !!state.lineTypeSettings.snapToHorizontalVertical;
    snapBtn.setAttribute('aria-pressed', snapCb.checked);
    const lineTypeShowOnlyOnPageCb = document.getElementById('lineTypeShowOnlyOnPage');
    const lineTypeShowOnlyOnPageBtn = document.getElementById('lineTypeShowOnlyOnPageBtn');
    if (lineTypeShowOnlyOnPageCb && lineTypeShowOnlyOnPageBtn) {
      lineTypeShowOnlyOnPageCb.checked = !!state.lineTypeSettings.showOnlyLineTypesOnCurrentPage;
      lineTypeShowOnlyOnPageBtn.setAttribute('aria-pressed', state.lineTypeSettings.showOnlyLineTypesOnCurrentPage);
    }
    document.getElementById('lineTypeSettingsReorder').style.display = state.lineTypes.length < 2 ? 'none' : '';
    App.showModal('lineTypeSettingsModal');
  }

  document.getElementById('lineTypesSectionTitle').onclick = (e) => {
    if (e.target.closest('#lineTypesCollapseIcon')) return;
    openLineTypeSettingsModal();
  };

  document.getElementById('lineTypeSettingsClose').onclick = () => App.hideModal('lineTypeSettingsModal');

  document.getElementById('lineTypeSize').oninput = () => {
    const state = App.state;
    state.lineTypeSettings.lineSize = parseInt(document.getElementById('lineTypeSize').value, 10);
    document.getElementById('lineTypeSizeVal').textContent = state.lineTypeSettings.lineSize;
    App.renderAnnotations();
  };
  document.getElementById('lineTypeOpacity').oninput = () => {
    const state = App.state;
    state.lineTypeSettings.opacity = parseInt(document.getElementById('lineTypeOpacity').value, 10) / 100;
    document.getElementById('lineTypeOpacityVal').textContent = Math.round(state.lineTypeSettings.opacity * 100);
    App.renderAnnotations();
  };
  document.getElementById('lineTypeDropXSize').oninput = () => {
    const state = App.state;
    state.lineTypeSettings.dropXSize = parseInt(document.getElementById('lineTypeDropXSize').value, 10);
    document.getElementById('lineTypeDropXSizeVal').textContent = state.lineTypeSettings.dropXSize;
    App.renderAnnotations();
  };
  document.getElementById('lineTypeOrientLengthBtn').onclick = () => {
    const cb = document.getElementById('lineTypeOrientLength');
    cb.checked = !cb.checked;
    document.getElementById('lineTypeOrientLengthBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('lineTypeOrientLength').onchange = () => {
    const state = App.state;
    state.lineTypeSettings.orientLengthWithLine = document.getElementById('lineTypeOrientLength').checked;
    App.renderAnnotations();
  };
  document.getElementById('lineTypeParallelEnds').oninput = () => {
    const state = App.state;
    state.lineTypeSettings.parallelEndsSize = parseInt(document.getElementById('lineTypeParallelEnds').value, 10);
    document.getElementById('lineTypeParallelEndsVal').textContent = state.lineTypeSettings.parallelEndsSize;
    App.renderAnnotations();
  };
  document.getElementById('lineTypeLengthLabel').oninput = () => {
    const state = App.state;
    state.lineTypeSettings.lengthLabelSize = parseInt(document.getElementById('lineTypeLengthLabel').value, 10);
    document.getElementById('lineTypeLengthLabelVal').textContent = state.lineTypeSettings.lengthLabelSize;
    App.renderAnnotations();
  };
  document.getElementById('lineTypeSnapToHVBtn').onclick = () => {
    const cb = document.getElementById('lineTypeSnapToHV');
    cb.checked = !cb.checked;
    document.getElementById('lineTypeSnapToHVBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('lineTypeSnapToHV').onchange = () => {
    const state = App.state;
    state.lineTypeSettings.snapToHorizontalVertical = document.getElementById('lineTypeSnapToHV').checked;
    App.renderAnnotations();
    App.updateUI();
  };
  document.getElementById('lineTypeShowOnlyOnPageBtn').onclick = () => {
    const cb = document.getElementById('lineTypeShowOnlyOnPage');
    cb.checked = !cb.checked;
    document.getElementById('lineTypeShowOnlyOnPageBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('lineTypeShowOnlyOnPage').onchange = () => {
    const state = App.state;
    state.lineTypeSettings.showOnlyLineTypesOnCurrentPage = document.getElementById('lineTypeShowOnlyOnPage').checked;
    App.renderLineTypesList();
    App.updateUI();
  };

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

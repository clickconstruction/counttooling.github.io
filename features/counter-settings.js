/*
 * features/counter-settings.js - the Counter settings modal (counterSettingsModal),
 * extracted from the app.js IIFE as the tenth feature-file split under the
 * window.App registry pattern. The first two-region consolidation: the opener /
 * close / reorder lived in the "Line type, counter & page settings modal
 * handlers" grab-bag while the value handlers lived in a separate
 * "// SECTION: Counter settings handlers" block - both are merged here.
 *
 * Loaded as a classic <script src="features/counter-settings.js"> AFTER app.js.
 * Its own IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openCounterSettingsModal back onto App, and binds the modal's value handlers
 * + close + reorder + the Counters section-title opener at this file's load.
 *
 * Scope is the Counter *settings* modal only. The Counters section *collapse*
 * icon (#countersCollapseIcon), the sidebar inline show-only button
 * (#counterShowOnlyOnPageInlineBtn), the shared #sidebarReorderFinish, and the
 * Escape-key close branch stay in app.js; they sync the static modal DOM by id
 * / set state directly, so they are independent of the moved JS. Boundary rule:
 * read shared deps from App.* at call time, never captured at load. See
 * ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function openCounterSettingsModal() {
    const state = App.state;
    document.getElementById('counterSize').value = state.counterSettings.size;
    document.getElementById('counterSizeVal').textContent = state.counterSettings.size;
    document.getElementById('counterOpacity').value = Math.round(state.counterSettings.opacity * 100);
    document.getElementById('counterOpacityVal').textContent = Math.round(state.counterSettings.opacity * 100);
    document.getElementById('counterOutline').value = state.counterSettings.outlineSize != null ? state.counterSettings.outlineSize : 0;
    document.getElementById('counterOutlineVal').textContent = state.counterSettings.outlineSize != null ? state.counterSettings.outlineSize : 0;
    const counterShowRingsCb = document.getElementById('counterShowRings');
    const counterShowRingsBtn = document.getElementById('counterShowRingsBtn');
    counterShowRingsCb.checked = state.counterSettings.showRings;
    counterShowRingsBtn.setAttribute('aria-pressed', state.counterSettings.showRings);
    document.getElementById('counterRingSection').style.display = state.counterSettings.showRings ? '' : 'none';
    document.getElementById('counterNumberSize').value = state.counterSettings.numberSize || 10;
    document.getElementById('counterNumberSizeVal').textContent = state.counterSettings.numberSize || 10;
    document.getElementById('counterRingSize').value = state.counterSettings.ringSize != null ? state.counterSettings.ringSize : 100;
    document.getElementById('counterRingSizeVal').textContent = state.counterSettings.ringSize != null ? state.counterSettings.ringSize : 100;
    document.getElementById('counterRingOpacity').value = Math.round((state.counterSettings.ringOpacity != null ? state.counterSettings.ringOpacity : 1) * 100);
    document.getElementById('counterRingOpacityVal').textContent = Math.round((state.counterSettings.ringOpacity != null ? state.counterSettings.ringOpacity : 1) * 100);
    const counterRingSolidCb = document.getElementById('counterRingSolid');
    const counterRingSolidBtn = document.getElementById('counterRingSolidBtn');
    counterRingSolidCb.checked = !!state.counterSettings.ringSolid;
    counterRingSolidBtn.setAttribute('aria-pressed', !!state.counterSettings.ringSolid);
    const counterShowOnlyOnPageCb = document.getElementById('counterShowOnlyOnPage');
    const counterShowOnlyOnPageBtn = document.getElementById('counterShowOnlyOnPageBtn');
    if (counterShowOnlyOnPageCb && counterShowOnlyOnPageBtn) {
      counterShowOnlyOnPageCb.checked = !!state.counterSettings.showOnlyCountersOnCurrentPage;
      counterShowOnlyOnPageBtn.setAttribute('aria-pressed', state.counterSettings.showOnlyCountersOnCurrentPage);
    }
    document.getElementById('counterSettingsReorder').style.display = state.counters.length < 2 ? 'none' : '';
    App.showModal('counterSettingsModal');
  }

  document.getElementById('countersSectionTitle').onclick = (e) => {
    if (e.target.closest('#countersCollapseIcon')) return;
    openCounterSettingsModal();
  };

  document.getElementById('counterSettingsClose').onclick = () => App.hideModal('counterSettingsModal');

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

  document.getElementById('counterSize').oninput = () => {
    const state = App.state;
    state.counterSettings.size = parseInt(document.getElementById('counterSize').value, 10);
    document.getElementById('counterSizeVal').textContent = state.counterSettings.size;
    App.renderAnnotations();
  };
  document.getElementById('counterOpacity').oninput = () => {
    const state = App.state;
    state.counterSettings.opacity = parseInt(document.getElementById('counterOpacity').value, 10) / 100;
    document.getElementById('counterOpacityVal').textContent = Math.round(state.counterSettings.opacity * 100);
    App.renderAnnotations();
  };
  document.getElementById('counterOutline').oninput = () => {
    const state = App.state;
    state.counterSettings.outlineSize = parseInt(document.getElementById('counterOutline').value, 10);
    document.getElementById('counterOutlineVal').textContent = state.counterSettings.outlineSize;
    App.renderAnnotations();
  };
  document.getElementById('counterShowRingsBtn').onclick = () => {
    const cb = document.getElementById('counterShowRings');
    cb.checked = !cb.checked;
    document.getElementById('counterShowRingsBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('counterShowRings').onchange = () => {
    const state = App.state;
    state.counterSettings.showRings = document.getElementById('counterShowRings').checked;
    document.getElementById('counterRingSection').style.display = state.counterSettings.showRings ? '' : 'none';
    App.renderAnnotations();
  };
  document.getElementById('counterNumberSize').oninput = () => {
    const state = App.state;
    state.counterSettings.numberSize = parseInt(document.getElementById('counterNumberSize').value, 10);
    document.getElementById('counterNumberSizeVal').textContent = state.counterSettings.numberSize;
    App.renderAnnotations();
  };
  document.getElementById('counterRingSize').oninput = () => {
    const state = App.state;
    state.counterSettings.ringSize = parseInt(document.getElementById('counterRingSize').value, 10);
    document.getElementById('counterRingSizeVal').textContent = state.counterSettings.ringSize;
    App.renderAnnotations();
  };
  document.getElementById('counterRingOpacity').oninput = () => {
    const state = App.state;
    state.counterSettings.ringOpacity = parseInt(document.getElementById('counterRingOpacity').value, 10) / 100;
    document.getElementById('counterRingOpacityVal').textContent = Math.round(state.counterSettings.ringOpacity * 100);
    App.renderAnnotations();
  };
  document.getElementById('counterRingSolidBtn').onclick = () => {
    const cb = document.getElementById('counterRingSolid');
    cb.checked = !cb.checked;
    document.getElementById('counterRingSolidBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('counterRingSolid').onchange = () => {
    const state = App.state;
    state.counterSettings.ringSolid = document.getElementById('counterRingSolid').checked;
    App.renderAnnotations();
  };
  document.getElementById('counterShowOnlyOnPageBtn').onclick = () => {
    const cb = document.getElementById('counterShowOnlyOnPage');
    cb.checked = !cb.checked;
    document.getElementById('counterShowOnlyOnPageBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('counterShowOnlyOnPage').onchange = () => {
    const state = App.state;
    state.counterSettings.showOnlyCountersOnCurrentPage = document.getElementById('counterShowOnlyOnPage').checked;
    App.renderCountersList();
    App.updateUI();
  };

  App.openCounterSettingsModal = openCounterSettingsModal;
})();

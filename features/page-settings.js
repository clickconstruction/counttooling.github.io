/*
 * features/page-settings.js - the Page settings modal (pageSettingsModal),
 * extracted from the app.js IIFE as the eighth feature-file split under the
 * window.App registry pattern.
 *
 * Loaded as a classic <script src="features/page-settings.js"> AFTER app.js.
 * Its own IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openPageSettingsModal back onto App, and binds the modal's truncate /
 * hide-unmarked toggles + close + the Pages gear opener (#pagesSettingsBtn) at
 * this file's load. HEADING-CLICK (2026-09-27): the PAGES title folds the list
 * like every other sidebar title; the gear beside it is this modal's one
 * entrance on every device.
 *
 * Scope is the Page *settings* modal only. The Pages section fold (the title and
 * its #pagesCollapseIcon, features/sidebar-lists.js bindCollapse), the scattered
 * collapse-icon writes and the Escape-key close branch live elsewhere.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build
 * step.
 */
(function() {
  const App = (window.App = window.App || {});

  function openPageSettingsModal() {
    const state = App.state;
    const pageSettingsTruncate = document.getElementById('pageSettingsTruncate');
    const pageSettingsTruncateBtn = document.getElementById('pageSettingsTruncateBtn');
    if (pageSettingsTruncate && pageSettingsTruncateBtn) {
      pageSettingsTruncate.checked = !!state.pagesTitlesTruncated;
      pageSettingsTruncateBtn.setAttribute('aria-pressed', state.pagesTitlesTruncated);
    }
    const pageSettingsHideUnmarked = document.getElementById('pageSettingsHideUnmarked');
    const pageSettingsHideUnmarkedBtn = document.getElementById('pageSettingsHideUnmarkedBtn');
    if (pageSettingsHideUnmarked && pageSettingsHideUnmarkedBtn) {
      pageSettingsHideUnmarked.checked = !!state.hideUnmarkedPagesFromSidebar;
      pageSettingsHideUnmarkedBtn.setAttribute('aria-pressed', state.hideUnmarkedPagesFromSidebar);
    }
    App.showModal('pageSettingsModal');
  }

  // HEADING-CLICK (2026-09-27): the gear beside the title opens the settings; the title
  // itself folds the list (features/sidebar-lists.js bindCollapse).
  document.getElementById('pagesSettingsBtn').onclick = () => openPageSettingsModal();

  const pageSettingsTruncateCb = document.getElementById('pageSettingsTruncate');
  const pageSettingsTruncateBtn = document.getElementById('pageSettingsTruncateBtn');
  if (pageSettingsTruncateCb && pageSettingsTruncateBtn) {
    pageSettingsTruncateBtn.onclick = () => {
      pageSettingsTruncateCb.checked = !pageSettingsTruncateCb.checked;
      pageSettingsTruncateBtn.setAttribute('aria-pressed', pageSettingsTruncateCb.checked);
      pageSettingsTruncateCb.dispatchEvent(new Event('change'));
    };
    pageSettingsTruncateCb.onchange = () => {
      const state = App.state;
      state.pagesTitlesTruncated = pageSettingsTruncateCb.checked;
      try { localStorage.setItem('pagesTitlesTruncated', state.pagesTitlesTruncated ? '1' : '0'); } catch (_) {}
      App.renderPagesList();
      App.updateUI();
    };
  }
  const pageSettingsHideUnmarkedCb = document.getElementById('pageSettingsHideUnmarked');
  const pageSettingsHideUnmarkedBtn = document.getElementById('pageSettingsHideUnmarkedBtn');
  if (pageSettingsHideUnmarkedCb && pageSettingsHideUnmarkedBtn) {
    pageSettingsHideUnmarkedBtn.onclick = () => {
      pageSettingsHideUnmarkedCb.checked = !pageSettingsHideUnmarkedCb.checked;
      pageSettingsHideUnmarkedBtn.setAttribute('aria-pressed', pageSettingsHideUnmarkedCb.checked);
      pageSettingsHideUnmarkedCb.dispatchEvent(new Event('change'));
    };
    pageSettingsHideUnmarkedCb.onchange = () => {
      const state = App.state;
      state.hideUnmarkedPagesFromSidebar = pageSettingsHideUnmarkedCb.checked;
      try { localStorage.setItem('hideUnmarkedPagesFromSidebar', state.hideUnmarkedPagesFromSidebar ? '1' : '0'); } catch (_) {}
      App.renderPagesList();
      App.updateUI();
    };
  }
  document.getElementById('pageSettingsClose').onclick = () => App.hideModal('pageSettingsModal');

  App.openPageSettingsModal = openPageSettingsModal;
})();

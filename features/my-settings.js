/*
 * features/my-settings.js - the My Settings (user settings) modal, extracted
 * from the app.js IIFE as the thirty-second feature-file split under the
 * window.App registry pattern — the surface pilot #20 (user-admin)
 * deliberately deferred. One modal moves whole: `#mySettingsModal` — the
 * opener (`openMySettings`, which falls through to the auth modal via a
 * dispatched `#authBtn` click when signed out), the Artboard cloud-sync rows
 * (Save / Load via the published `saveUserAirboard`/`fetchUserAirboard`
 * engine helpers, Export to JSON, Clear-with-defaults), the change-password
 * form (`supabase.auth.updateUser`), sign-out, close, and the admin
 * Manage-Users / Manage-User / All-Users openers (which reach
 * features/user-admin.js via `App.*` / a dispatched `#manageUsersBtn` click —
 * more feature-to-feature coupling mediated by the registry).
 *
 * Loaded as a classic <script src="/features/my-settings.js"> AFTER app.js.
 * Its own IIFE: registers App.openMySettings (the three openers — #authBtn
 * signed-in path, #sidebarLogoUser, #statusBarAuth — stay in app.js as
 * deferred App.* calls) and binds the `#mySettings*` handlers at load.
 * Cloud-coupled: handlers re-read App.getSupabase() at call time. The
 * `#mySettingsMyActivity` opener is bound by features/user-admin.js; the
 * Airboard engine (fetchUserAirboard/saveUserAirboard) and the auth sign-in
 * form stay in app.js. Four publishes were added for this split:
 * `fetchUserAirboard`/`saveUserAirboard` and the constants
 * `PLUMBING_DEFAULTS`/`LINE_DEFAULTS` (used by Clear-artboard's reset).
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function openMySettings() {
    const state = App.state;
    const user = state.supabaseSession?.user;
    if (!user) { document.getElementById('authBtn').click(); return; }
    document.getElementById('mySettingsEmail').textContent = user.email || '—';
    document.getElementById('mySettingsNewPassword').value = '';
    document.getElementById('mySettingsConfirmPassword').value = '';
    document.getElementById('mySettingsPasswordError').style.display = 'none';
    document.getElementById('mySettingsPasswordSuccess').style.display = 'none';
    document.getElementById('mySettingsManageUsersSection').style.display = state.isAdmin ? 'block' : 'none';
    App.showModal('mySettingsModal');
  }

  document.getElementById('mySettingsSignOut').onclick = async () => {
    App.hideModal('mySettingsModal');
    await App.checkInCurrentProjectIfHeld();
    const sb = App.getSupabase ? App.getSupabase() : null;
    if (sb) sb.auth.signOut();
    App.updateUI();
    App.updateSaveStatusIndicator();
  };
  document.getElementById('mySettingsModalClose').onclick = () => App.hideModal('mySettingsModal');
  document.getElementById('mySettingsSaveAirboard').onclick = async () => {
    const ok = await App.saveUserAirboard();
    if (ok) {
      App.showToast('Artboard saved to your account');
      const statusEl = document.getElementById('mySettingsAirboardStatus');
      if (statusEl) statusEl.textContent = 'Last saved: just now';
    } else {
      alert('Failed to save artboard. Please try again.');
    }
  };
  document.getElementById('mySettingsLoadAirboard').onclick = async () => {
    const state = App.state;
    if (state.counters.length || state.lineTypes.length) {
      if (!confirm('Replace your current artboard with the saved version from the cloud?')) return;
    }
    const data = await App.fetchUserAirboard();
    if (!data) {
      App.showToast('No saved artboard found');
      return;
    }
    state.counters = data.counters;
    state.lineTypes = data.lineTypes;
    state.iconNames = data.iconNames;
    state.iconOrder = data.iconOrder;
    if (Array.isArray(data.customIconPaths)) App.saveUserCustomIcons(data.customIconPaths);
    if (data.plumbingModifiers && typeof data.plumbingModifiers === 'object') App.savePlumbingModifiers(data.plumbingModifiers);
    if (data.lineModifiers && typeof data.lineModifiers === 'object') App.saveLineModifiers(data.lineModifiers);
    App.updateUI();
    App.renderPdf();
    App.showToast('Artboard loaded from cloud');
  };
  document.getElementById('mySettingsExportAirboard').onclick = () => {
    const state = App.state;
    const data = { counters: state.counters, lineTypes: state.lineTypes, iconNames: state.iconNames || {}, iconOrder: state.iconOrder || null, customIconPaths: App.getUserCustomIcons(), plumbingModifiers: App.getPlumbingModifiers(), lineModifiers: App.getLineModifiers() };
    const a = document.createElement('a');
    a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(data));
    a.download = 'artboard-backup.json';
    a.click();
    App.showToast('Artboard exported');
  };
  document.getElementById('mySettingsClearAirboard').onclick = () => {
    const state = App.state;
    if (!confirm('Clear all counters and line types? This cannot be undone.')) return;
    App.pushUndoSnapshot();
    state.counters = [];
    state.lineTypes = [];
    state.iconNames = {};
    state.iconOrder = null;
    state.activeCounterType = null;
    state.activeLineTypeId = null;
    App.savePlumbingModifiers({ sizes: [...App.PLUMBING_DEFAULTS.sizes], types: [...App.PLUMBING_DEFAULTS.types], materials: [...App.PLUMBING_DEFAULTS.materials], iconByType: {}, defaultColor: App.COLORS[2] });
    App.saveLineModifiers({ sizes: [...App.LINE_DEFAULTS.sizes], materials: [...App.LINE_DEFAULTS.materials], defaultColor: App.COLORS[2] });
    App.markProjectDirty();
    App.updateUI();
    App.renderPdf();
    App.showToast('Artboard cleared');
  };
  document.getElementById('mySettingsManageUsers').onclick = () => { App.hideModal('mySettingsModal'); document.getElementById('manageUsersBtn').click(); };
  document.getElementById('mySettingsManageUser').onclick = () => App.openManageUserModal();
  document.getElementById('mySettingsAllUsers').onclick = () => App.openAllUsersModal();
  document.getElementById('mySettingsPasswordForm').onsubmit = async (e) => {
    e.preventDefault();
    const newPw = document.getElementById('mySettingsNewPassword').value;
    const confirmPw = document.getElementById('mySettingsConfirmPassword').value;
    const errEl = document.getElementById('mySettingsPasswordError');
    const successEl = document.getElementById('mySettingsPasswordSuccess');
    errEl.style.display = 'none';
    successEl.style.display = 'none';
    if (!newPw || newPw.length < 6) {
      errEl.textContent = 'Password must be at least 6 characters';
      errEl.style.display = 'block';
      return;
    }
    if (newPw !== confirmPw) {
      errEl.textContent = 'Passwords do not match';
      errEl.style.display = 'block';
      return;
    }
    const sb = App.getSupabase ? App.getSupabase() : null;
    if (!sb) return;
    const { error } = await sb.auth.updateUser({ password: newPw });
    if (error) {
      errEl.textContent = error.message || 'Failed to update password';
      errEl.style.display = 'block';
      return;
    }
    successEl.textContent = 'Password updated';
    successEl.style.display = 'block';
    document.getElementById('mySettingsNewPassword').value = '';
    document.getElementById('mySettingsConfirmPassword').value = '';
  };

  App.openMySettings = openMySettings;
})();

(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/turn-in.js - the checkout lifecycle UX, extracted from app.js's
   * [sync] Turn In section (the one [sync] section that was real code, not
   * engine wrappers): doTurnInAndHandleResult (result-handling over the
   * engine's staged doTurnIn - expired short-circuit, already-released
   * refresh, recovery-modal routing), the shared doCheckoutCurrentProject
   * action, the header/sidebar edit-status banner click handler, and the
   * Project Settings Check Out / Turn In / Force turn-in buttons. All four
   * functions and every call site were internal to this cluster, so nothing
   * in app.js needed a wrapper. The engine still owns the staged release
   * (App.doTurnIn passthrough); the expired-attention flags stay app-side and
   * are reached through the existing getter/setter accessors
   * (isCheckoutExpiredAttention / setCheckoutExpiredAttention /
   * clearCheckoutExpiredAttention / isAutoSaveSuspended /
   * setLastCheckoutRefreshAt). CHECKOUT_EXPIRED_SAVE_STATUS_MSG is a
   * constants.js classic-script global.
   * Boundary rule: read shared deps from App.* at call time, never at load.
   */

  // SECTION: [sync] Turn In
  // doTurnIn (the staged release: pre-probe, local backup, PDF/canvas
  // flush, raw-fetch check-in fallback + retry) lives in save-engine.js
  // (Stage 5). The result-handling UX below stays here with the modals.
  async function doTurnInAndHandleResult(opts) {
    opts = opts || {};
    if (App.isCheckoutExpiredAttention() && App.state.currentProjectId && !App.state.isViewer) {
      App.pushSaveEvent('turn_in_short_circuit_expired', 'Turn In short-circuited to recovery modal');
      if (opts.hideSettings) { try { App.hideModal('settingsModal'); } catch (_) {} }
      App.openCheckoutExpiredRecoveryModal({ trigger: 'turn_in_short_circuit' });
      return { ok: false, code: 'CHECKOUT_EXPIRED', error: CHECKOUT_EXPIRED_SAVE_STATUS_MSG };
    }
    const result = await App.doTurnIn();
    if (result.ok) {
      App.clearCheckoutExpiredAttention();
      await App.refreshProjectPermissions();
      App.updateSettingsCheckoutSection();
      if (opts.hideSettings) App.hideModal('settingsModal');
      App.showToast(result.releasedByServer ? 'Edit session had already expired — turned in.' : 'Project turned in.');
      if (App.state.pdfBuffer && !App.state.pdfStoragePath) {
        App.showToast('PDF saved locally—use Save Project to Cloud to add it to the project.', 3000);
      }
      App.updateUI();
    } else {
      if (result.code === 'CHECKOUT_EXPIRED') {
        App.pushSaveEvent('checkout_expired', CHECKOUT_EXPIRED_SAVE_STATUS_MSG);
        App.setCheckoutExpiredAttention();
        App.refreshProjectPermissions().catch(() => {});
        App.updateSaveStatusIndicator();
        if (opts.hideSettings) { try { App.hideModal('settingsModal'); } catch (_) {} }
        App.openCheckoutExpiredRecoveryModal({ trigger: 'turn_in_button' });
      } else if (typeof result.error === 'string' && /do not have .* checked out|NOT_CHECKED_OUT|not_owned/i.test(result.error)) {
        App.pushSaveEvent('turn_in_already_released', 'Turn In: checkout was already released elsewhere');
        App.showToast('You no longer hold the checkout - refreshing.', 4000);
        await App.refreshProjectPermissions();
        App.updateSettingsCheckoutSection();
        if (opts.hideSettings) App.hideModal('settingsModal');
        App.updateUI();
      } else {
        App.showToast(result.error || 'Failed to turn in', 3000);
      }
    }
    return result;
  }
  async function tryTurnIn(opts) {
    opts = opts || {};
    return doTurnInAndHandleResult(opts);
  }
  const headerEditBanner = document.getElementById('headerEditStatusBanner');
  // Shared checkout action for the header/sidebar banner buttons and the
  // Project Settings Check Out button (was two near-identical ~45-line
  // blocks): RPC + server-clock update, expired-attention clear, state
  // flip, section refresh, toasts. opts.onDenied runs before the
  // permissions refresh on the not-ok path (Settings closes its modal
  // there); returns true on success.
  async function doCheckoutCurrentProject(opts) {
    const { data, error } = await App.getSupabase().rpc('check_out_project', { p_project_id: App.state.currentProjectId });
    App.updateServerClockFromRpc(data);
    const result = data || (error ? { ok: false, error: error.message } : { ok: false });
    if (result.ok) {
      const wasSuspended = App.isAutoSaveSuspended();
      App.clearCheckoutExpiredAttention();
      try { if (App.state.currentProjectId) App.resetAutoRecheckoutCounter(App.state.currentProjectId); } catch (_) {}
      if (wasSuspended) App.saveDebugLog('autosave.resumed', { trigger: opts.debugTrigger });
      App.state.checkedOutBy = App.state.supabaseSession?.user?.id;
      App.state.checkedOutAt = result.checked_out_at || new Date().toISOString();
      App.setLastCheckoutRefreshAt(Date.now());
      App.state.isViewer = false;
      App.state.canCheckOut = false;
      App.updateSettingsCheckoutSection();
      App.updateUI();
      App.updateStatus();
      App.showToast('Project checked out. You can now edit.');
      return true;
    }
    if (opts.onDenied) opts.onDenied();
    await App.refreshProjectPermissions();
    const msg = App.state.checkedOutEmail ? 'Project is checked out by ' + (App.twinEmailText ? App.twinEmailText(App.state.checkedOutEmail) : App.state.checkedOutEmail) : (result.error || 'Failed to check out');
    App.showToast(msg, 5000);
    return false;
  }
  async function handleEditStatusBannerClick(e) {
    const btn = e.target.closest('.header-edit-status-btn');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'save') {
      document.getElementById('saveProjectBtn').click();
      return;
    }
    if (!App.state.currentProjectId || !App.getSupabase()) return;
    if (action === 'checkout') {
      btn.disabled = true;
      btn.textContent = 'Checking out...';
      try {
        await doCheckoutCurrentProject({ debugTrigger: 'header_banner_checkout' });
      } finally {
        btn.disabled = false;
        App.updateUI();
      }
    } else if (action === 'checkin') {
      btn.disabled = true;
      btn.textContent = 'Turning in...';
      try {
        await tryTurnIn({});
      } finally {
        btn.disabled = false;
        App.updateUI();
      }
    } else if (action === 'checkout_expired_recover') {
      App.openCheckoutExpiredRecoveryModal({ trigger: 'expired_banner' });
    }
  }
  if (headerEditBanner) headerEditBanner.addEventListener('click', handleEditStatusBannerClick);
  const sidebarCheckoutBanner = document.getElementById('sidebarCheckoutBanner');
  if (sidebarCheckoutBanner) sidebarCheckoutBanner.addEventListener('click', handleEditStatusBannerClick);
  document.getElementById('settingsCheckOut').onclick = async () => {
    if (!App.state.currentProjectId || !App.getSupabase()) return;
    const btn = document.getElementById('settingsCheckOut');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Checking out...';
    try {
      await doCheckoutCurrentProject({ debugTrigger: 'settings_checkout', onDenied: () => App.hideModal('settingsModal') });
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  };
  document.getElementById('settingsCheckIn').onclick = async () => {
    if (!App.state.currentProjectId || !App.getSupabase()) return;
    const btn = document.getElementById('settingsCheckIn');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Turning in...';
    try {
      await tryTurnIn({ hideSettings: true });
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  };
  document.getElementById('settingsForceCheckIn').onclick = async () => {
    if (!App.state.currentProjectId || !App.getSupabase()) return;
    App.setTurnInProgress('Force turning in…');
    let data, error;
    try {
      ({ data, error } = await App.getSupabase().rpc('force_check_in_project', { p_project_id: App.state.currentProjectId }));
    } finally {
      App.setTurnInProgress(null);
    }
    App.updateServerClockFromRpc(data);
    const result = data || (error ? { ok: false, error: error.message } : { ok: false });
    if (result.ok) {
      App.state.checkedOutBy = null;
      App.state.checkedOutAt = null;
      App.state.checkedOutEmail = null;
      App.clearUndoStacks();
      App.state.isViewer = true;
      App.state.canCheckOut = true;
      try { App.clearCheckoutExpiredAttention(); } catch (_) {}
      try { if (App.state.currentProjectId) App.resetAutoRecheckoutCounter(App.state.currentProjectId); } catch (_) {}
      App.updateSettingsCheckoutSection();
      App.updateUI();
      App.updateStatus();
      App.hideModal('settingsModal');
      App.showToast('Project force turned in.');
    } else {
      App.showToast(result.error || 'Failed to force turn-in', 3000);
    }
  };

  // Force turn-in notice (Stage-5 J17 finding): the modal the demoted editor
  // sees instead of a transient toast. The engine reaches it via
  // ctx.notifyForceTurnedIn → App.openForceTurnInNoticeModal; truthy return
  // means handled (the engine then skips its toast fallback).
  function openForceTurnInNoticeModal(info) {
    const hadDirty = !!(info && info.hadDirty);
    const saved = document.getElementById('forceTurnInNoticeSaved');
    const warn = document.getElementById('forceTurnInNoticeWarn');
    if (!saved || !warn) return false;
    saved.style.display = hadDirty ? 'none' : '';
    warn.style.display = hadDirty ? 'flex' : 'none';
    App.showModal('forceTurnInNoticeModal');
    return true;
  }
  document.getElementById('forceTurnInNoticeKeepViewing').onclick = () => {
    App.hideModal('forceTurnInNoticeModal');
  };
  document.getElementById('forceTurnInNoticeCheckout').onclick = async () => {
    const btn = document.getElementById('forceTurnInNoticeCheckout');
    btn.disabled = true;
    btn.textContent = 'Checking out...';
    try {
      await doCheckoutCurrentProject({ debugTrigger: 'force_turnin_notice_checkout' });
    } finally {
      btn.disabled = false;
      btn.textContent = 'Check out to edit';
      App.hideModal('forceTurnInNoticeModal');
      App.updateUI();
    }
  };

  App.tryTurnIn = tryTurnIn;
  App.doTurnInAndHandleResult = doTurnInAndHandleResult;
  App.openForceTurnInNoticeModal = openForceTurnInNoticeModal;
})();

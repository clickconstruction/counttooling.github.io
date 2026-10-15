(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/turn-in.js - the checkout lifecycle UX, extracted from app.js's
   * [sync] Turn In section (the one [sync] section that was real code, not
   * engine wrappers): doTurnInAndHandleResult (result-handling over the
   * engine's staged doTurnIn - expired short-circuit, already-released
   * refresh, recovery-modal routing), the shared doCheckoutCurrentProject
   * action, the header/sidebar edit-status banner (its click handler, and
   * since R14 its render, renderEditStatusBanner, which updateUI calls), and the
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
      showTurnedInToast(result.releasedByServer ? 'Edit session had already expired. Turned in.' : 'Project turned in.');
      if (App.state.pdfBuffer && !App.state.pdfStoragePath) {
        App.showToast('PDF saved locally. Use Save Project to Cloud to add it to the project.', 3000);
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
  // R1-ADMIN: Manage Projects' row for the project open and held in this tab
  // offers this same Turn In (save first, then release) instead of a force.
  App.tryTurnIn = tryTurnIn;
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
      // R1-WINDOW: we hold the lock again, so the engine's self-release window
      // ends here; a force after this is real and must reach the notice.
      try { if (App.clearSelfRelease) App.clearSelfRelease(); } catch (_) {}
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
  // R1-RECLICK: [Check out to Edit] and [Turn In] are one button in the same pixels, and the
  // label used to flip the instant the first action landed, so a double-click (or an impatient
  // second click) checked a project out and turned it straight back in, or the reverse
  // (field report 2026-09-15: a 16:36:01 checkout, a 16:36:04 turn-in). After either action
  // succeeds FROM THIS BUTTON, the banner holds a "done" label and takes no clicks for a beat,
  // then offers the opposite action as before. Nobody acting on purpose pays a click for it.
  // Three seconds, not a double-click's half second: the field report's second click came 3 s
  // after the first, by someone who had not seen that the first one worked. The label tells them
  // it did; and nobody checks out and turns in on purpose inside three seconds.
  const EDIT_BANNER_HOLD_MS = 3000;
  let editBannerHold = null;   // { until, label, nextAction }
  let editBannerHoldTimer = null;
  function holdEditBanner(label, nextAction) {
    editBannerHold = { until: Date.now() + EDIT_BANNER_HOLD_MS, label, nextAction };
    if (editBannerHoldTimer) clearTimeout(editBannerHoldTimer);
    editBannerHoldTimer = setTimeout(() => { editBannerHoldTimer = null; editBannerHold = null; App.updateUI(); }, EDIT_BANNER_HOLD_MS);
  }
  const editBannerHoldActive = () => !!(editBannerHold && Date.now() < editBannerHold.until);
  // updateUI rebuilds the banner on every call: while the hold is live, the button that would
  // offer the opposite action is drawn disabled under the "done" label instead. Any other state
  // (expired, Unsaved / Save, someone else editing) is never held.
  function applyEditBannerHold(bannerEl) {
    if (!bannerEl || !editBannerHoldActive()) return;
    const btn = bannerEl.querySelector('.header-edit-status-btn[data-action="' + editBannerHold.nextAction + '"]');
    if (!btn) return;
    btn.textContent = editBannerHold.label;
    btn.disabled = true;
    btn.dataset.action = 'hold';
    btn.classList.add('header-edit-status-btn-hold');
  }
  App.applyEditBannerHold = applyEditBannerHold;

  // R14 (moved from app.js's updateUIInner, which calls it at the same point of every
  // render): the header edit-status banner and its sidebar copy. The buttons it draws carry
  // the data-action values handleEditStatusBannerClick below answers.
  // STALE-LOCK (2026-10-02): the words for the holder a project row still
  // names. The server never clears a checkout, it stops honouring one older
  // than CHECKOUT_INACTIVITY_MS, so the row keeps the LAST holder for good
  // (Wendi's export: a lock 50.8 hours dead read "grace is editing" on every
  // surface). Live: "<email> is editing". Expired: "Available · last edited
  // by <email>, 2d ago". One place for the words; the header, the status bar,
  // Project Settings, Load Project and Manage Projects all read these two.
  function isCheckoutLockLive(checkedOutAt) {
    return App.checkoutLockIsLive(checkedOutAt, App.serverNowMs(), CHECKOUT_INACTIVITY_MS);
  }
  function checkoutHolderText(email, checkedOutAt) {
    const who = App.twinEmailText ? App.twinEmailText(email) : email;
    if (isCheckoutLockLive(checkedOutAt)) return who + ' is editing';
    const agoSec = (App.serverNowMs() - new Date(checkedOutAt).getTime()) / 1000;
    return 'Available · last edited by ' + who + ', ' + App.formatAgo(agoSec);
  }
  App.isCheckoutLockLive = isCheckoutLockLive;
  App.checkoutHolderText = checkoutHolderText;

  function renderEditStatusBanner() {
    const state = App.state;
    const editBanner = document.getElementById('headerEditStatusBanner');
    if (editBanner) {
      // B6 (J13): anonymous view-link sessions get the same "Viewing only"
      // banner signed-in viewers see — without it, the recipient has no cue
      // that this is a window, not a workbench. All the branches above the
      // final "Viewing only" fallback are session-gated (checkout/save need
      // a user), so an anonymous viewer always lands on the fallback.
      const show = App.SUPABASE_ENABLED
        && (state.supabaseSession?.user || (state.isViewer && state.loadedViaViewLink))
        && (state.pages.length > 0 || state.currentProjectId);
      if (!show) {
        editBanner.style.display = 'none';
        editBanner.innerHTML = '';
        const sb = document.getElementById('sidebarCheckoutBanner');
        if (sb) { sb.innerHTML = ''; sb.className = 'sidebar-checkout-banner supabase-only'; }
      } else {
        editBanner.style.display = '';
        editBanner.className = 'header-edit-status supabase-only';
        editBanner.innerHTML = '';
        if (App.isCheckoutExpiredAttention() && !state.isViewer && state.currentProjectId) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'header-edit-status-btn header-edit-status-btn-expired';
          btn.dataset.action = 'checkout_expired_recover';
          btn.textContent = '[Edit session expired. Re-check out]';
          editBanner.appendChild(btn);
          editBanner.classList.add('edit-status-expired');
        } else if (!state.isViewer && state.currentProjectId) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'header-edit-status-btn';
          btn.dataset.action = 'checkin';
          btn.textContent = '[Turn In]';
          editBanner.appendChild(btn);
          editBanner.classList.add('edit-status-editing');
        } else if (state.pages.length > 0 && !state.currentProjectId && !state.isViewer) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'header-edit-status-btn header-edit-status-btn-save';
          btn.dataset.action = 'save';
          const spanDefault = document.createElement('span');
          spanDefault.className = 'save-btn-label-default';
          spanDefault.textContent = 'Unsaved';
          const spanHover = document.createElement('span');
          spanHover.className = 'save-btn-label-hover';
          spanHover.textContent = 'Save';
          btn.appendChild(spanDefault);
          btn.appendChild(spanHover);
          editBanner.appendChild(btn);
          editBanner.classList.add('edit-status-editing');
        } else if (state.canCheckOut) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'header-edit-status-btn';
          btn.dataset.action = 'checkout';
          btn.textContent = '[Check out to Edit]';
          editBanner.appendChild(btn);
          editBanner.classList.add('edit-status-available');
        } else if (state.checkedOutEmail) {
          // A role with no checkout arm (a viewer share, an overseer) never
          // reaches the canCheckOut rung, so the holder's words carry the
          // live / expired distinction (STALE-LOCK).
          const span = document.createElement('span');
          span.textContent = checkoutHolderText(state.checkedOutEmail, state.checkedOutAt);
          editBanner.appendChild(span);
          editBanner.classList.add(isCheckoutLockLive(state.checkedOutAt) ? 'edit-status-viewing' : 'edit-status-available');
        } else {
          const span = document.createElement('span');
          span.textContent = 'Viewing only';
          editBanner.appendChild(span);
          editBanner.classList.add('edit-status-viewing');
        }
        // R1-RECLICK: right after a checkout or a turn-in made from this button, it holds a
        // "done" label for a beat instead of offering the opposite action in the same pixels
        // (above). Before the sidebar copy below, so both banners hold alike.
        applyEditBannerHold(editBanner);
        const sidebarBanner = document.getElementById('sidebarCheckoutBanner');
        if (sidebarBanner) {
          sidebarBanner.className = 'sidebar-checkout-banner ' + editBanner.className.replace('header-edit-status', '').trim();
          sidebarBanner.innerHTML = editBanner.innerHTML;
        }
      }
    }
  }
  App.renderEditStatusBanner = renderEditStatusBanner;

  async function handleEditStatusBannerClick(e) {
    const btn = e.target.closest('.header-edit-status-btn');
    if (!btn) return;
    const action = btn.dataset.action;
    // The held button only (the sidebar's copy is markup, so this is its guard too). A button the
    // hold is not about still works: turned in here, checked out again from the admin notice or
    // Project Settings, and [Turn In] is a fresh, deliberate click.
    if (editBannerHoldActive() && (action === 'hold' || action === editBannerHold.nextAction)) return;
    if (action === 'save') {
      document.getElementById('saveProjectBtn').click();
      return;
    }
    if (!App.state.currentProjectId || !App.getSupabase()) return;
    if (action === 'checkout') {
      btn.disabled = true;
      btn.textContent = 'Checking out...';
      try {
        if (await doCheckoutCurrentProject({ debugTrigger: 'header_banner_checkout' })) holdEditBanner('Checked out \u2713', 'checkin');
      } finally {
        btn.disabled = false;
        App.updateUI();
      }
    } else if (action === 'checkin') {
      btn.disabled = true;
      btn.textContent = 'Turning in...';
      try {
        const result = await tryTurnIn({});
        if (result && result.ok) holdEditBanner('Turned in \u2713', 'checkout');
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
    // Already showing: report handled so the engine never stacks a toast on
    // top, and the user is never re-nagged mid-acknowledgement.
    const overlay = document.getElementById('forceTurnInNoticeModal');
    if (overlay && overlay.classList.contains('visible')) return true;
    saved.style.display = hadDirty ? 'none' : '';
    warn.style.display = hadDirty ? 'flex' : 'none';
    // Behind ?ff=self-release (_TODO.md R1): once our own releases are
    // classified out, what remains is an admin OR another tab/device signed
    // in as this user (check_in_project is per user), so the copy stops
    // asserting an admin. R1-FLIP moves this text into index.html.
    const body = document.getElementById('forceTurnInNoticeBody');
    if (body && App.featureFlagEnabled && App.featureFlagEnabled('self-release')) {
      body.innerHTML = 'This project was turned in while you had it checked out, by an admin or lead, or by another tab or device signed in as you. You\'re now <strong style="color:var(--text);">viewing only</strong>.';
    }
    App.showModal('forceTurnInNoticeModal');
    return true;
  }
  document.getElementById('forceTurnInNoticeKeepViewing').onclick = () => {
    App.hideModal('forceTurnInNoticeModal');
  };
  // The demoted editor's third way out: they were done anyway.
  document.getElementById('forceTurnInNoticeClose').onclick = async () => {
    App.hideModal('forceTurnInNoticeModal');
    await App.closeProject({ route: 'force_turn_in_notice' });
  };

  // "Project turned in." with Close project on the card (2026-09-10): the
  // moment an estimator used to reach for the browser's reload. A static
  // interactive toast like #setScaleFirstModal — the text span is rewritten
  // per call, the button is bound once; 6 s leaves time to reach it.
  let turnedInToastTimer = null;
  function showTurnedInToast(text) {
    const t = document.getElementById('turnedInToastText');
    if (!t) { App.showToast(text); return; }
    t.textContent = text;
    if (turnedInToastTimer) clearTimeout(turnedInToastTimer);
    App.showModal('turnedInToastModal');
    turnedInToastTimer = setTimeout(() => { App.hideModal('turnedInToastModal'); turnedInToastTimer = null; }, 6000);
  }
  const turnedInToastCloseBtn = document.getElementById('turnedInToastClose');
  if (turnedInToastCloseBtn) turnedInToastCloseBtn.onclick = async () => {
    if (turnedInToastTimer) { clearTimeout(turnedInToastTimer); turnedInToastTimer = null; }
    App.hideModal('turnedInToastModal');
    await App.closeProject({ route: 'turn_in_toast' });
  };
  App.showTurnedInToast = showTurnedInToast;
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

  App.openForceTurnInNoticeModal = openForceTurnInNoticeModal;
})();

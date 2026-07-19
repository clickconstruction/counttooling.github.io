(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Save Project modal (registry split #35b) -- extracted from app.js. The
  // modal open/prefill (with the local-cache / storage.info PDF-size probe),
  // the Include PDF toggle pair, and the Save action with its
  // checkout-expiry preflight and stale-PDF confirm. Deps resolve through App
  // at call time; pdfCacheGet is an idb.js classic-script global.

  document.getElementById('saveProjectBtn').onclick = async () => {
    document.getElementById('saveProjectName').value = App.state.currentProjectName || 'Untitled';
    document.getElementById('saveProjectError').style.display = 'none';
    document.getElementById('saveProjectDo').disabled = false;
    document.getElementById('saveProjectDo').textContent = 'Save';
    document.getElementById('saveProjectProgress').style.display = 'none';
    document.getElementById('saveProjectChecklist').innerHTML = '';
    const contentsList = document.getElementById('saveProjectContentsList');
    const contentsLabel = document.getElementById('saveProjectContentsLabel');
    const noPdfMessage = document.getElementById('saveProjectNoPdfMessage');
    const checkboxEl = document.getElementById('saveProjectIncludePdf');
    const includePdfLabel = document.getElementById('saveProjectIncludePdfLabel');
    const includePdfBtn = document.getElementById('saveProjectIncludePdfBtn');
    let pdfBufLen = App.state.pdfBufferSize > 0 ? App.state.pdfBufferSize : 0;
    if (pdfBufLen === 0 && App.state.pdfBuffer) {
      const b = App.state.pdfBuffer;
      pdfBufLen = (typeof b.byteLength === 'number' ? b.byteLength : 0) || (typeof b.length === 'number' ? b.length : 0) || (typeof b.size === 'number' ? b.size : 0);
      if (pdfBufLen === 0 && b) {
        try { pdfBufLen = new Blob([b]).size; } catch (_) {}
        if (pdfBufLen > 0) App.state.pdfBufferSize = pdfBufLen;
      }
    }
    const hasValidPdfBuffer = pdfBufLen > 0;
    let pdfSizeBytes = hasValidPdfBuffer ? pdfBufLen : 0;
    if (!hasValidPdfBuffer) {
      // Try the local IndexedDB cache first. This works even when the PDF is
      // not in the cloud yet (e.g. created via Prepare PDF "Open"):
      // performSaveProjectToCloud recovers the buffer the same way, so a cache
      // hit means Include PDF will actually succeed.
      if (App.state.currentProjectId && App.state.pdfHash) {
        try {
          const cached = await pdfCacheGet(App.state.currentProjectId, App.state.pdfHash);
          if (cached && cached.size > 0) pdfSizeBytes = cached.size;
        } catch (_) {}
      }
      if (pdfSizeBytes === 0 && App.state.pdfStoragePath && App.SUPABASE_ENABLED && App.getSupabase()) {
        try {
          const { data: info } = await App.getSupabase().storage.from('pdfs').info(App.state.pdfStoragePath);
          const sz = info?.metadata?.size ?? info?.size ?? info?.metadata?.contentLength;
          pdfSizeBytes = typeof sz === 'number' ? sz : (typeof sz === 'string' ? parseInt(sz, 10) : 0);
        } catch (_) {}
      }
    }
    if (App.state.pdfBuffer || App.state.pdfStoragePath || App.state.pages.length > 0) {
      contentsList.style.display = '';
      contentsLabel.style.display = 'block';
      noPdfMessage.style.display = 'none';
      const nameEl = includePdfLabel?.querySelector('.save-contents-name');
      if (hasValidPdfBuffer || pdfSizeBytes > 0) {
        if (nameEl) nameEl.innerHTML = 'PDF (<span id="saveProjectPdfSize">' + (Math.max(pdfBufLen, pdfSizeBytes) / 1024 / 1024).toFixed(2) + '</span> MB)';
        if (includePdfLabel) includePdfLabel.classList.remove('save-contents-omitted');
        if (includePdfBtn) { includePdfBtn.style.display = ''; includePdfBtn.setAttribute('aria-pressed', 'true'); }
        checkboxEl.checked = true;
      } else if (App.state.pdfStoragePath) {
        // PDF is already in the cloud but its size is unknown; keep it
        // included (the save will simply not re-upload an unchanged file).
        if (nameEl) nameEl.textContent = 'PDF (in project)';
        if (includePdfBtn) includePdfBtn.style.display = 'none';
        checkboxEl.checked = true;
      } else {
        // PDF is not in memory, not in the local cache, and not in the cloud.
        // We cannot upload it from here, so saving with Include PDF would
        // fail. Leave it off and tell the user how to re-attach it.
        if (nameEl) nameEl.textContent = 'PDF (not in memory \u2014 reload the project to re-attach)';
        if (includePdfLabel) includePdfLabel.classList.add('save-contents-omitted');
        if (includePdfBtn) { includePdfBtn.style.display = ''; includePdfBtn.setAttribute('aria-pressed', 'false'); }
        checkboxEl.checked = false;
      }
    } else {
      contentsList.style.display = 'none';
      contentsLabel.style.display = 'none';
      noPdfMessage.style.display = 'block';
    }
    App.showModal('saveProjectModal');
  };
  document.getElementById('saveProjectBtnSidebar').onclick = () => document.getElementById('saveProjectBtn').click();
  document.getElementById('saveProjectCancel').onclick = () => App.hideModal('saveProjectModal');
  document.getElementById('saveProjectIncludePdf').onchange = () => {
    const label = document.getElementById('saveProjectIncludePdfLabel');
    const checkboxEl = document.getElementById('saveProjectIncludePdf');
    const btn = document.getElementById('saveProjectIncludePdfBtn');
    if (label) label.classList.toggle('save-contents-omitted', !checkboxEl.checked);
    if (btn) btn.setAttribute('aria-pressed', checkboxEl.checked);
  };
  document.getElementById('saveProjectIncludePdfBtn').onclick = (e) => {
    e.preventDefault();
    const checkboxEl = document.getElementById('saveProjectIncludePdf');
    checkboxEl.checked = !checkboxEl.checked;
    checkboxEl.dispatchEvent(new Event('change'));
  };
  document.getElementById('saveProjectDo').onclick = async () => {
    const name = document.getElementById('saveProjectName').value.trim() || 'Untitled';
    const errEl = document.getElementById('saveProjectError');
    const saveBtn = document.getElementById('saveProjectDo');
    errEl.style.display = 'none';
    const user = App.state.supabaseSession?.user;
    if (!user) {
      errEl.textContent = 'Please sign in to save.';
      errEl.style.display = 'block';
      return;
    }
    if (App.state.isViewer) {
      errEl.textContent = 'You are viewing only. Check out the project to edit and save.';
      errEl.style.display = 'block';
      return;
    }
    if (App.state.currentProjectId && App.state.checkedOutBy === user.id && App.state.checkedOutAt) {
      const checkedAt = new Date(App.state.checkedOutAt).getTime();
      const ageMs = App.serverNowMs() - checkedAt;
      let confirmedExpired = false;
      if (ageMs > CHECKOUT_INACTIVITY_MS + CHECKOUT_SOFT_GRACE_MS) {
        confirmedExpired = true;
        App.saveDebugLog('manual.save.expired', { ageMs, mode: 'hard_skew' });
      } else if (ageMs > CHECKOUT_INACTIVITY_MS - CHECKOUT_NEAR_EXPIRY_MS) {
        const probe = await App.probeCheckoutLock();
        if (probe.expired) {
          confirmedExpired = true;
          App.saveDebugLog('manual.save.expired', { ageMs, mode: 'probe' });
        } else if (!probe.ok) {
          App.showToast('Could not verify edit session. Try again.', 4000);
          return;
        }
      }
      if (confirmedExpired) {
        // Note: keep App.state.checkedOutBy/At/Email populated until recovery resolves.
        // Nulling them eagerly lets a re-click during a slow recovery bypass the
        // preflight expiry guard and fall through to performSaveProjectToCloud
        // against a wedged client.
        App.clearUndoStacks();
        App.updateSaveStatusIndicator();
        const recovered = await App.handleBackgroundCheckoutExpired('manual_save');
        await App.refreshProjectPermissions().catch(() => {});
        if (recovered && recovered.silentlyRecovered) {
          errEl.style.display = 'none';
          App.updateUI();
          return;
        }
        // Only zero locally when refresh did not reassign the lock to a
        // different user. If refresh repopulated App.state.checkedOutBy with a
        // new holder, preserve their info so the header banner / settings
        // checkout row can show "Checked out by <email>" while the recovery
        // modal is open.
        if (App.state.checkedOutBy === user.id || !App.state.checkedOutBy) {
          App.state.checkedOutBy = null;
          App.state.checkedOutAt = null;
          App.state.checkedOutEmail = null;
        }
        App.updateUI();
        App.hideModal('saveProjectModal');
        App.openCheckoutExpiredRecoveryModal({ trigger: 'manual_save' });
        return;
      }
    }
    const origText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    App.hideModal('saveProjectModal');
    const includePdf = document.getElementById('saveProjectIncludePdf').checked;
    if (!includePdf && App.state.currentProjectId && App.state.pdfBuffer && App.state.pdfHash) {
      let cloudPdfHash = null;
      try {
        const { data: cloudProj } = await App.withTimeout(
          App.getSupabase().from('projects').select('pdf_hash').eq('id', App.state.currentProjectId).single(),
          5000,
          'pdf_hash check (G7)'
        );
        cloudPdfHash = cloudProj?.pdf_hash || null;
      } catch (_) { /* network blip: skip the confirm */ }
      if (cloudPdfHash && cloudPdfHash !== App.state.pdfHash) {
        const proceed = confirm(
          'Heads up: your local PDF is newer than the one in the cloud.\n\n' +
          'Saving canvas only will leave the cloud copy referencing the old PDF. ' +
          'Click Cancel to go back and turn Include PDF on, or OK to save canvas only anyway.'
        );
        if (!proceed) {
          saveBtn.disabled = false;
          saveBtn.textContent = origText;
          App.pushSaveEvent('manual_save_canceled', 'User canceled at stale-PDF confirm');
          return;
        }
        App.pushSaveEvent('manual_save_pdf_mismatch_accepted', 'User saved canvas only with newer local PDF');
      }
    }
    const result = await App.performSaveProjectToCloud({ name, includePdf });
    if (!result.ok) {
      if (App.isAuthError(result.error)) {
        App.showToast('Refresh the page to sync.', 4000);
      } else {
        const errMsg = (result.error?.message) || (result.error?.details) || (result.error?.hint) || String(result.error) || 'Save failed';
        App.showToast('Save failed: ' + errMsg + '. Open Project Settings to retry.', 4000);
      }
    }
    saveBtn.disabled = false;
    saveBtn.textContent = origText;
  };
})();

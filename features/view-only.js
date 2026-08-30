(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // View-only mode (registry split #34) -- extracted from app.js. The whole
  // view-link session: the gated email prompt, the get-view-project Edge
  // Function fetch with the offline view-cache fallback, page/annotation
  // hydration, and the viewer-scale sharing layer (share-for-everyone via the
  // set-view-scale Edge Function, with a per-device temp fallback) plus the
  // owner-side "a viewer set this scale" must-clear notice.
  //
  // Boot (app.js init) awaits DOMContentLoaded before resolving
  // App.initViewOnlyMode, because this script loads after app.js. Deps are
  // read from App at call time; viewCache* / pdfjsLib are classic-script
  // globals.

  // Pending resolver for the email prompt; the global Escape handler
  // (app.js hotkeys) cancels through App.cancelViewLinkEmailPrompt.
  let viewLinkEmailResolve = null;
  App.cancelViewLinkEmailPrompt = () => {
    if (typeof viewLinkEmailResolve === 'function') {
      viewLinkEmailResolve(null);
      viewLinkEmailResolve = null;
    }
  };

  // The allowed email domain(s) for view links — config.js may set
  // window.VIEW_LINK_ALLOWED_DOMAINS (comma-separated; the Edge Function env
  // is the real gate). ONE fallback shared by every surface that names the
  // domain (B6, J14): the rejection message, the email-gate placeholder, and
  // the Share modal copy (share-links.js).
  function viewLinkDomains() {
    return (typeof window.VIEW_LINK_ALLOWED_DOMAINS === 'string' && window.VIEW_LINK_ALLOWED_DOMAINS)
      ? window.VIEW_LINK_ALLOWED_DOMAINS : 'clickplumbing.com';
  }
  // Wire the email-gate placeholder to the configured domain at load (the
  // static markup carries the default as a fallback).
  (function () {
    const input = document.getElementById('viewLinkEmailInput');
    if (input) input.placeholder = 'you@' + viewLinkDomains().split(',')[0].trim();
  })();

  // B6 (J13 J14): Cancel/Escape at the email gate shows a static full-screen
  // card instead of stranding the viewer in the empty editor. Reuses the
  // dead-link screen chrome; the button reloads, which restarts the gate.
  function showViewEmailRequiredScreen() {
    const msg = document.getElementById('viewLinkDeadMessage');
    if (msg) msg.textContent = 'This plan needs your email — reload to try again.';
    const retry = document.getElementById('viewLinkDeadRetry');
    if (retry) {
      retry.style.display = '';
      retry.textContent = 'Reload';
      retry.onclick = () => window.location.reload();
    }
    const screen = document.getElementById('viewLinkDeadScreen');
    if (screen) screen.classList.add('visible');
  }

  // A viewer-set scale applies FOR EVERYONE: it is shared through the
  // set-view-scale Edge Function (token + email gated), which writes it into
  // the owner's project data with a viewerSet stamp so the owner gets a
  // must-clear notice on that page. If the share fails (offline / rejected),
  // the scale stays as a local temporary one -- stamped temp, remembered per
  // view token in localStorage (same pattern as view:hideMarks:<token>) and
  // restored only for pages the server has no scale for.
  function shareViewerScale(pageIdx) {
    const { state, updateUI, showToast, SUPABASE_ENABLED, SUPABASE_URL } = App;
    if (!state.isViewer) return;
    noteViewerTempScale(pageIdx);   // local-first: applies + persists the temp fallback
    const scale = state.pages[pageIdx]?.scale;
    if (!scale || !state.viewToken || !SUPABASE_ENABLED || !SUPABASE_URL) return;
    let email = '';
    try { email = (localStorage.getItem('view:allowed:' + state.viewToken) || '').trim(); } catch (_) {}
    if (!email) return;
    const payload = {
      token: state.viewToken,
      email,
      pageIndex: pageIdx,
      scale: {
        pixelsPerUnit: scale.pixelsPerUnit,
        unit: scale.unit,
        label: scale.label ?? null,
        refLine: scale.refLine ?? undefined,
        sheetSize: scale.sheetSize ?? undefined,
        correctionFactor: scale.correctionFactor ?? undefined,
      },
    };
    fetch(SUPABASE_URL + '/functions/v1/set-view-scale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) throw new Error('share failed: ' + res.status);
      await res.json().catch(() => ({}));
      // Shared successfully: this is now the project's scale, not a temp one.
      const cur = state.pages[pageIdx]?.scale;
      if (cur) delete cur.temp;
      try {
        const key = 'view:scale:' + state.viewToken;
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        delete map[pageIdx];
        localStorage.setItem(key, JSON.stringify(map));
      } catch (_) {}
      updateUI();
      showToast('Scale set for everyone viewing this plan');
    }).catch(() => {
      App.showToast('Couldn’t share the scale — it applies only on this device for now', 5000);
    });
  }
  function noteViewerTempScale(pageIdx) {
    const { state } = App;
    if (!state.isViewer) return;
    const scale = state.pages[pageIdx]?.scale;
    if (!scale) return;
    scale.temp = true;
    if (!state.viewToken) return;
    try {
      const key = 'view:scale:' + state.viewToken;
      const map = JSON.parse(localStorage.getItem(key) || '{}');
      map[pageIdx] = scale;
      localStorage.setItem(key, JSON.stringify(map));
    } catch (_) { /* storage may be unavailable */ }
  }
  function applyViewerTempScales() {
    const { state } = App;
    if (!state.viewToken) return;
    try {
      const map = JSON.parse(localStorage.getItem('view:scale:' + state.viewToken) || '{}');
      for (const [i, s] of Object.entries(map)) {
        const page = state.pages[+i];
        if (page && !page.scale && s && s.pixelsPerUnit) page.scale = { ...s, temp: true };
      }
    } catch (_) { /* corrupt/unavailable storage: just skip the restore */ }
  }

  // Owner-side notice: when a viewer shared a scale (scale.viewerSet stamped
  // by the set-view-scale Edge Function), the project owner gets a must-clear
  // modal every time they land on that page, until they acknowledge it (which
  // removes the stamp and persists via the normal dirty/save path -- hence
  // the checkout requirement, i.e. !state.isViewer).
  let viewerScaleNoticedPage = null;
  function maybeShowViewerScaleNotice() {
    const { state, showModal } = App;
    const pi = state.currentPage;
    if (viewerScaleNoticedPage !== pi) viewerScaleNoticedPage = null;   // left the noticed page
    const scale = state.pages[pi]?.scale;
    const vs = scale?.viewerSet;
    if (!vs || state.isViewer) return;
    const isOwner = !!(state.currentProjectId && state.supabaseSession?.user && state.projectOwnerId === state.supabaseSession.user.id);
    if (!isOwner) return;
    if (viewerScaleNoticedPage === pi) return;                          // already shown this visit
    viewerScaleNoticedPage = pi;
    const msg = document.getElementById('viewerScaleNoticeText');
    if (msg) {
      const pxLine = '1 ' + scale.unit + ' = ' + scale.pixelsPerUnit.toFixed(1) + ' px';
      const when = vs.at ? new Date(vs.at).toLocaleString() : null;
      msg.textContent = 'The scale on page ' + (pi + 1) + ' was set to '
        + (scale.label ? scale.label + ' (' + pxLine + ')' : pxLine)
        + ' by ' + (vs.email || 'a viewer') + (when ? ' on ' + when : '')
        + '. All lengths and tallies on this page use it.';
    }
    showModal('viewerScaleNoticeModal');
  }
  const viewerScaleNoticeOk = document.getElementById('viewerScaleNoticeOk');
  if (viewerScaleNoticeOk) viewerScaleNoticeOk.onclick = () => {
    const { state, markProjectDirty, hideModal, updateUI } = App;
    const scale = state.pages[state.currentPage]?.scale;
    if (scale && scale.viewerSet) { delete scale.viewerSet; markProjectDirty(); }
    hideModal('viewerScaleNoticeModal');
    updateUI();
  };

  async function initViewOnlyMode(viewToken) {
    const {
      state, showModal, hideModal, updateUI, SUPABASE_URL,
      clearPdfBitmapCache, uid, makeAnnotations, ensureGroupColors,
      saveUserCustomIcons, applyPageAnnotationsFromData,
      reconcileOrphanedCountersAndLineTypes, clearUndoStacks,
      clearCheckoutExpiredAttention, fitZoom, renderPdf,
    } = App;
    const allowedEmail = localStorage.getItem('view:allowed:' + viewToken);
    let email = allowedEmail ? allowedEmail.trim() : '';

    function showViewEmailModal(keepError) {
      return new Promise((resolve) => {
        const modal = document.getElementById('viewLinkEmailModal');
        const input = document.getElementById('viewLinkEmailInput');
        const errEl = document.getElementById('viewLinkEmailError');
        const submitBtn = document.getElementById('viewLinkEmailSubmit');
        const cancelBtn = document.getElementById('viewLinkEmailCancel');
        if (!modal || !input) { resolve(null); return; }
        viewLinkEmailResolve = resolve;
        // keepError: re-shown after a domain_restricted rejection -- the caller
        // just set the message; clearing it here made the modal reappear with
        // no explanation (looked like an endless silent loop).
        if (!keepError) errEl.style.display = 'none';
        input.value = email || '';
        input.focus();
        showModal('viewLinkEmailModal');
        const done = (val) => {
          viewLinkEmailResolve = null;
          hideModal('viewLinkEmailModal');
          resolve(val);
        };
        submitBtn.onclick = () => {
          const val = (input.value || '').trim().toLowerCase();
          if (!val) {
            errEl.textContent = 'Enter your email';
            errEl.style.display = 'block';
            return;
          }
          email = val;
          done(val);
        };
        if (cancelBtn) cancelBtn.onclick = () => done(null);
        input.onkeydown = (e) => { if (e.key === 'Enter') submitBtn.click(); };
      });
    }

    if (!email) {
      await showViewEmailModal();
      // B6 (J13 J14): Cancel/Escape at the gate used to strand the viewer in
      // the empty editor — a wall of tools with nothing behind them. The
      // static card says what's needed and how to try again.
      if (!email) { showViewEmailRequiredScreen(); return; }
    }

    const domainMsg = viewLinkDomains();

    async function fetchViewProject(useEmail) {
      const res = await fetch(SUPABASE_URL + '/functions/v1/get-view-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: viewToken, email: useEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'domain_restricted') {
          const err = { domainRestricted: true, message: data.message || 'Access restricted to ' + domainMsg };
          throw err;
        }
        // 4xx = the server itself rejected the link (not found / revoked /
        // gone / forbidden) — tag it "dead" so the failure screen shows the
        // inactive copy and the cache fallback below is skipped. 5xx stays
        // untagged (transient server trouble — retryable, cache still serves),
        // and a network failure never reaches here (fetch rejects untagged).
        const dead = res.status >= 400 && res.status < 500;
        const err = new Error(data.message
          || (data.error === 'email_required' ? 'Email required' : 'Failed to load'));
        if (dead) err.viewLinkDead = true;
        throw err;
      }
      return data;
    }

    const cachedMeta = await viewCacheGetMeta(viewToken);
    const cachedBlob = cachedMeta ? await viewCacheGet(viewToken, cachedMeta.pdfHash) : null;
    const cachedProjectData = (cachedBlob && cachedMeta && cachedMeta.data && cachedMeta.projectId)
      ? { projectId: cachedMeta.projectId, name: cachedMeta.name, data: cachedMeta.data, pdfHash: cachedMeta.pdfHash, updatedAt: cachedMeta.updatedAt ?? null }
      : null;

    // Revalidate against the server even on a cache hit, so a viewer isn't pinned to a stale
    // snapshot after the owner re-saves (rotation/marks change without changing the PDF hash).
    // Fall back to the cached snapshot only when the server is unreachable (offline); a
    // domain-restriction error always blocks (access may have been revoked).
    let projectData = null;
    while (true) {
      try {
        projectData = await fetchViewProject(email);
        localStorage.setItem('view:allowed:' + viewToken, email);
        break;
      } catch (e) {
        if (e && e.domainRestricted) {
          const errEl = document.getElementById('viewLinkEmailError');
          if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
          email = await showViewEmailModal(true);
          if (!email) { showViewEmailRequiredScreen(); return; }
        } else if (cachedProjectData && !(e && e.viewLinkDead)) {
          projectData = cachedProjectData;   // offline / transient -- use the cached snapshot
          break;
        } else {
          throw e;
        }
      }
    }

    const d = projectData.data || {};
    let buf;
    const blobHashMatches = !!(cachedBlob && cachedMeta && projectData.projectId === cachedMeta.projectId && (projectData.pdfHash || null) === (cachedMeta.pdfHash || null));
    if (blobHashMatches) {
      // PDF unchanged -- reuse the cached blob (no re-download), but refresh the cached data
      // snapshot if the server returned a fresher copy.
      buf = await cachedBlob.arrayBuffer();
      if (projectData !== cachedProjectData && (projectData.updatedAt ?? null) !== (cachedMeta.updatedAt ?? null)) {
        viewCachePut(viewToken, cachedBlob, projectData.pdfHash || null, { projectId: projectData.projectId, name: projectData.name, data: d, updatedAt: projectData.updatedAt ?? null });
      }
    } else if (projectData.pdfSignedUrl) {
      const pdfRes = await fetch(projectData.pdfSignedUrl);
      if (!pdfRes.ok) throw new Error('Failed to load PDF');
      buf = await pdfRes.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/pdf' });
      viewCachePut(viewToken, blob, projectData.pdfHash || null, { projectId: projectData.projectId, name: projectData.name, data: d, updatedAt: projectData.updatedAt ?? null });
    } else if (cachedBlob) {
      buf = await cachedBlob.arrayBuffer();   // cache fallback with no fresh signed URL
    } else {
      throw new Error('No PDF available');
    }

    const pdf = await App.getPdfDocument(buf).promise;
    clearPdfBitmapCache();
    state.pages = [];
    const numPages = pdf.numPages;
    // B6 (J12 J14): page labels carry the plan name, not a hardcoded
    // "document.pdf" — the viewer's Pages sidebar / report headings should say
    // which plan this is (restore-last-session.js fixes the same root cause).
    const planName = projectData.name || 'Untitled';
    for (let i = 0; i < numPages; i++) {
      const pdfPage = await pdf.getPage(i + 1);
      const label = numPages > 1 ? (planName + ' — p' + (i + 1)) : planName;
      const canvasId = uid();
      state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: makeAnnotations() }], scale: null, rotation: 0 });
      state.activeCanvasIdByPage[i] = canvasId;
    }
    App.hydrateStateFromProjectData(d);   // the shared intake (annotation-model.js)
    reconcileOrphanedCountersAndLineTypes();
    state.currentProjectId = projectData.projectId;
    state.currentProjectName = projectData.name || 'Untitled';
    state.pdfStoragePath = null;
    state.pdfBuffer = null;
    state.pdfBufferSize = 0;
    state.pdfHash = projectData.pdfHash || null;
    clearUndoStacks();
    state.loadedViaViewLink = true;
    state.viewToken = viewToken;
    state.hideMarks = localStorage.getItem('view:hideMarks:' + viewToken) === '1';
    state.showDropSizes = localStorage.getItem('view:dropSizes:' + viewToken) === '1';
    applyViewerTempScales();   // restore this device's temp scales (owner scale wins)
    state.isViewer = true;
    state.canCheckOut = false;
    state.checkedOutBy = null;
    state.checkedOutAt = null;
    state.checkedOutEmail = null;
    state.projectOwnerId = null;
    state.currentPage = 0;
    try { clearCheckoutExpiredAttention(); } catch (_) {}
    document.body.classList.add('has-pdf');
    fitZoom();
    renderPdf();
    updateUI();
  }

  // Full-screen failure surface for a dead/revoked/unreachable view link
  // (T1-12). Owns #viewLinkDeadScreen (app/index.html) — deliberately NOT a
  // .modal-overlay: not dismissable, nothing behind it worth revealing. app.js's
  // boot catch delegates here defensively (toast fallback if this file failed
  // to load). "Dead" = server-confirmed 4xx (the viewLinkDead tag stamped in
  // fetchViewProject); anything else (network failure, 5xx, PDF fetch failure)
  // is retryable — the whole boot IS the retry loop, so Retry just reloads.
  function showViewLinkFailure(err) {
    const dead = !!(err && err.viewLinkDead);
    const msg = document.getElementById('viewLinkDeadMessage');
    if (msg) {
      msg.textContent = dead
        ? 'This plan link isn’t active anymore. Ask the person who sent it for a new one.'
        : 'Couldn’t load this plan. Check your connection and try again.';
    }
    const retry = document.getElementById('viewLinkDeadRetry');
    if (retry) {
      retry.style.display = dead ? 'none' : '';
      retry.onclick = () => window.location.reload();
    }
    const screen = document.getElementById('viewLinkDeadScreen');
    if (screen) screen.classList.add('visible');
    // Signed-in sessions only (logUserEvent no-ops otherwise) — the anonymous
    // GC emits nothing; server-side dead-token logging is a follow-up.
    App.logUserEvent && App.logUserEvent('view_link_dead', null, { reason: dead ? 'inactive' : 'network' });
  }

  App.shareViewerScale = shareViewerScale;
  App.noteViewerTempScale = noteViewerTempScale;
  App.applyViewerTempScales = applyViewerTempScales;   // viewer-scale.spec.js test seam
  App.maybeShowViewerScaleNotice = maybeShowViewerScaleNotice;
  App.showViewLinkFailure = showViewLinkFailure;
  App.initViewOnlyMode = initViewOnlyMode;
})();

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
      if (!email) return;
    }

    const domainMsg = (typeof window.VIEW_LINK_ALLOWED_DOMAINS === 'string' ? window.VIEW_LINK_ALLOWED_DOMAINS : 'clickplumbing.com');

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
        if (data.error === 'email_required') {
          throw new Error(data.message || 'Email required');
        }
        throw new Error(data.message || 'Failed to load');
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
          if (!email) return;
        } else if (cachedProjectData) {
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

    const pdf = await pdfjsLib.getDocument(buf).promise;
    clearPdfBitmapCache();
    state.pages = [];
    const numPages = pdf.numPages;
    for (let i = 0; i < numPages; i++) {
      const pdfPage = await pdf.getPage(i + 1);
      const label = numPages > 1 ? ('document.pdf — p' + (i + 1)) : 'document.pdf';
      const canvasId = uid();
      state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: makeAnnotations() }], scale: null, rotation: 0 });
      state.activeCanvasIdByPage[i] = canvasId;
    }
    state.counters = Array.isArray(d.counters) ? d.counters : [];
    state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
    state.groups = ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
    state.rooms = Array.isArray(d.rooms) ? d.rooms : [];
    if (d.iconNames && typeof d.iconNames === 'object') state.iconNames = d.iconNames;
    if (Array.isArray(d.iconOrder)) state.iconOrder = d.iconOrder;
    if (Array.isArray(d.customIconPaths)) saveUserCustomIcons(d.customIconPaths);
    (d.pages || []).forEach(p => {
      applyPageAnnotationsFromData(state.pages[p.index], p);
    });
    if (d.activeCanvasIdByPage && typeof d.activeCanvasIdByPage === 'object') state.activeCanvasIdByPage = d.activeCanvasIdByPage;
    state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
    if (d.legendSettings) state.legendSettings = { ...state.legendSettings, ...d.legendSettings };
    if (d.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...d.multiplyZoneSettings };
    if (d.showGridOverlay != null) state.showGridOverlay = !!d.showGridOverlay;
    if (d.gridSettings) state.gridSettings = d.gridSettings;
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

  App.shareViewerScale = shareViewerScale;
  App.noteViewerTempScale = noteViewerTempScale;
  App.applyViewerTempScales = applyViewerTempScales;   // viewer-scale.spec.js test seam
  App.maybeShowViewerScaleNotice = maybeShowViewerScaleNotice;
  App.initViewOnlyMode = initViewOnlyMode;
})();

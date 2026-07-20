/*
 * features/restore-last-session.js - the last-session restore flow, extracted
 * from the app.js IIFE under the window.App registry pattern (Tier-2 audit
 * item: the largest single remaining chunk after the modal ladder).
 *
 * Owns: `doRestoreLastProject` (rebuilds the whole session from a cloud
 * project row or a local IndexedDB takeoff backup — PDF resolution ladder:
 * IDB backup blob -> cached blob -> signed-URL render -> storage download,
 * with background re-cache), the `#lastSessionRestoreModal` Keep/Discard
 * handlers (Keep defers the Supabase fetch until click so the modal appears
 * instantly; falls back to the IDB backup offline; cleans up a no-longer-
 * accessible project), and the private `pendingRestore` state.
 *
 * app.js keeps the BOOT detection (which backup/localStorage record to offer)
 * and hands the candidate over via `App.openLastSessionRestorePrompt(pending)`
 * — pending is `{ proj, cachedBlob }` (local backup) or `{ cloudLast }` (the
 * lightweight clickcount-last-project metadata). `resetLocalSessionState`
 * clears the private flag via the defensive `App.onLastSessionRestoreReset`
 * callback (the Groups pattern for feature-private state).
 *
 * Loaded as a classic <script src="/features/restore-last-session.js"> AFTER
 * app.js; boot (init) runs after all classic scripts, so the registration is
 * always in place before the boot path calls it. idb primitives
 * (pdfCacheGet/pdfCachePut/pdfCacheDelete/takeoffBackupDelete) and pdfjsLib
 * are classic-script globals; the engine-logged backup reader is
 * App.takeoffBackupGet. Boundary rule: read shared deps from App.* at call
 * time, never captured at load. See ARCHITECTURE.md "Feature files /
 * window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  let pendingRestore = null;

  // Prompt copy: the project name is escaped and gets zero-width break hints
  // after -/_ so long takeoff names wrap instead of overflowing the modal.
  function promptNameHtml(name) {
    return App.escapeHtml(name || 'Untitled').replace(/([-_])/g, '$1​');
  }

  function openLastSessionRestorePrompt(pending) {
    if (!pending) return;
    pendingRestore = pending;
    const msgEl = document.getElementById('lastSessionRestoreMessage');
    if (msgEl) {
      if (pending.cloudLast) {
        msgEl.innerHTML = 'You have a project from your last session: <strong>' + promptNameHtml(pending.cloudLast.projectName) + '</strong>. What would you like to do?';
      } else {
        msgEl.innerHTML = 'You have a local session from your last visit: <strong>' + promptNameHtml(pending.proj?.name) + '</strong>. What would you like to do?';
      }
    }
    App.showModal('lastSessionRestoreModal');
  }

  async function doRestoreLastProject(proj, cachedBlob) {
    const state = App.state;
    // A1: Same hygiene as the Load Project row-click - clear any stale
    // pendingCanvasLoad before we start rebuilding session state.
    state.pendingCanvasLoad = null;
    const d = proj.data;
    const projUpdated = proj.updated_at ? new Date(proj.updated_at).getTime() : 0;
    const idbBackup = await App.takeoffBackupGet(proj.id, state.supabaseSession?.user?.id || null);
    const useIdbBackup = idbBackup && idbBackup.lastModifiedAt > projUpdated;
    let pdf;
    const idbPdfBlob = useIdbBackup && idbBackup.pdfBlob && idbBackup.pdfBlob.size > 0 ? idbBackup.pdfBlob : null;
    if (idbPdfBlob) {
      try {
        const buf = await idbPdfBlob.arrayBuffer();
        pdf = await pdfjsLib.getDocument(buf).promise;
      } catch (e) {
        if (!cachedBlob && !proj.pdf_path) throw e;
      }
    }
    if (!pdf && cachedBlob && cachedBlob.size > 0) {
      try {
        const buf = await cachedBlob.arrayBuffer();
        pdf = await pdfjsLib.getDocument(buf).promise;
      } catch (e) {
        if (!proj.pdf_path) throw e;
        const { data: signed, error: urlErr } = await App.getSupabase().storage.from('pdfs').createSignedUrl(proj.pdf_path, 3600);
        if (urlErr) throw urlErr;
        pdf = await pdfjsLib.getDocument({ url: signed.signedUrl }).promise;
        if (proj.pdf_hash) {
          App.getSupabase().storage.from('pdfs').download(proj.pdf_path).then(({ data: blob }) => {
            if (blob) pdfCachePut(proj.id, blob, proj.pdf_hash);
          });
        }
      }
    }
    if (!pdf && proj.pdf_path) {
      const { data: blob, error: urlErr } = await App.getSupabase().storage.from('pdfs').download(proj.pdf_path);
      if (urlErr) throw urlErr;
      if (!blob || blob.size === 0) throw new Error('The PDF file in cloud storage is empty');
      pdf = await pdfjsLib.getDocument(blob).promise;
      if (proj.pdf_hash) pdfCachePut(proj.id, blob, proj.pdf_hash);
    }
    if (!pdf) throw new Error('No PDF available for this project');
    App.clearPdfBitmapCache();
    state.pages = [];
    const numPages = pdf.numPages;
    for (let i = 0; i < numPages; i++) {
      const pdfPage = await pdf.getPage(i + 1);
      const label = numPages > 1 ? ('document.pdf — p' + (i + 1)) : 'document.pdf';
      const canvasId = App.uid();
      state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: App.makeAnnotations() }], scale: null, rotation: 0 });
      state.activeCanvasIdByPage[i] = canvasId;
    }
    if (useIdbBackup && idbBackup.data) {
      App.applyTakeoffBackupToState(idbBackup.data);
    } else {
      state.counters = Array.isArray(d.counters) ? d.counters : [];
      state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
      state.groups = App.ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
      state.rooms = Array.isArray(d.rooms) ? d.rooms : [];
      if (d.iconNames && typeof d.iconNames === 'object') state.iconNames = d.iconNames;
      if (Array.isArray(d.iconOrder)) state.iconOrder = d.iconOrder;
      if (Array.isArray(d.customIconPaths)) App.saveUserCustomIcons(d.customIconPaths);
      (d.pages || []).forEach(p => {
        App.applyPageAnnotationsFromData(state.pages[p.index], p);
      });
      if (d.activeCanvasIdByPage && typeof d.activeCanvasIdByPage === 'object') state.activeCanvasIdByPage = d.activeCanvasIdByPage;
      state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
      if (d.legendSettings) state.legendSettings = { ...state.legendSettings, ...d.legendSettings };
      if (d.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...d.multiplyZoneSettings };
      if (d.showGridOverlay != null) state.showGridOverlay = !!d.showGridOverlay;
      if (d.gridSettings) state.gridSettings = d.gridSettings;
    }
    App.reconcileOrphanedCountersAndLineTypes();
    state.currentProjectId = proj.id === 'local' ? null : proj.id;
    try { App.clearCheckoutExpiredAttention(); } catch (_) { /* noop */ }
    state.currentProjectName = proj.name || 'Untitled';
    state.pdfStoragePath = proj.pdf_path;
    state.pdfHash = proj.pdf_hash || null;
    state.pdfBuffer = null;
    state.pdfBufferSize = 0;
    App.setLastSaveIncludedPdf(!!proj.pdf_path);
    state.lastSavedAt = proj.updated_at || null;
    App.setLastLocalBackupAt(null);
    state.currentPage = Math.min(state.currentPage, Math.max(0, state.pages.length - 1));
    state.projectOwnerId = proj.user_id || null;
    state.checkedOutBy = proj.checked_out_by || null;
    state.checkedOutAt = proj.checked_out_at || null;
    state.checkedOutEmail = null;
    const userId = state.supabaseSession?.user?.id;
    const isOwner = proj.user_id === userId;
    const lockExpired = !proj.checked_out_at || (App.serverNowMs() - new Date(proj.checked_out_at).getTime() >= CHECKOUT_INACTIVITY_MS);
    const hasValidCheckout = proj.checked_out_by === userId && !lockExpired;
    state.loadedViaViewLink = false;
    state.isViewer = !hasValidCheckout;
    state.canCheckOut = (isOwner && (!proj.checked_out_by || lockExpired)) || false;
    App.clearUndoStacks();
    App.setAutoSaveDirty(false);
    App.setLastModifiedAt(0);
    App.fitZoom();
    App.renderPdf();
    App.refreshProjectPermissions();
    App.subscribeToProjectCheckoutChanges(state.currentProjectId);
  }

  document.getElementById('lastSessionRestoreKeep').onclick = async () => {
    const state = App.state;
    const p = pendingRestore;
    if (!p) { App.hideModal('lastSessionRestoreModal'); return; }
    // Cloud last-session: the boot path deferred the Supabase fetch + PDF-blob lookup
    // to here (so the modal could appear instantly). Resolve the project now, behind a
    // brief loading state on the modal buttons.
    if (p.cloudLast) {
      const last = p.cloudLast;
      const keepBtn = document.getElementById('lastSessionRestoreKeep');
      const discardBtn = document.getElementById('lastSessionRestoreDiscard');
      const keepLabel = keepBtn ? keepBtn.textContent : '';
      if (keepBtn) { keepBtn.disabled = true; keepBtn.textContent = 'Loading…'; }
      if (discardBtn) discardBtn.disabled = true;
      const currentUid = state.supabaseSession?.user?.id || null;
      try {
        let proj = null, fetchErr = null;
        try {
          const res = await App.getSupabase().from('projects').select('id, name, data, updated_at, pdf_path, pdf_hash, user_id, checked_out_by, checked_out_at').eq('id', last.projectId).single();
          proj = res.data; fetchErr = res.error;
        } catch (netErr) { fetchErr = netErr; }
        const accessDenied = !!fetchErr && (fetchErr.code === 'PGRST116' || /no rows|denied|permission|policy/i.test(fetchErr.message || ''));
        if (accessDenied) {
          try { App.pushSaveEvent('last_session_restore_skip_inaccessible', 'Last-session project not accessible to current user', JSON.stringify({ projectId: last.projectId, code: fetchErr.code, message: fetchErr.message })); } catch (_) { /* noop */ }
          try { localStorage.removeItem('clickcount-last-project'); } catch (_) { /* noop */ }
          try { await takeoffBackupDelete(last.projectId); } catch (_) { /* noop */ }
          App.showToast('This project is no longer available.', 5000);
          return;
        }
        // Network/other error (e.g. offline): fall back to a local IndexedDB backup if
        // one exists, so resuming offline still works.
        let projForRestore = proj;
        if (!projForRestore) {
          const idbBackup = await App.takeoffBackupGet(last.projectId, currentUid);
          if (idbBackup && idbBackup.data) {
            projForRestore = { id: last.projectId, name: idbBackup.projectName || last.projectName || 'Untitled', data: App.backupDataToProjFormat(idbBackup.data || {}), updated_at: null, pdf_path: null, pdf_hash: idbBackup.pdfHash, user_id: last.userId, checked_out_by: null, checked_out_at: null };
          }
        }
        if (!projForRestore) throw (fetchErr || new Error('Project unavailable'));
        const pdfHashForCache = projForRestore.pdf_hash || last.pdfHash;
        const cachedBlob = pdfHashForCache ? await pdfCacheGet(last.projectId, pdfHashForCache) : null;
        await doRestoreLastProject(projForRestore, cachedBlob);
        App.updateUI();
      } catch (err) {
        App.showToast('Failed to restore project: ' + (err?.message || 'Unknown error'), 5000);
      } finally {
        pendingRestore = null;
        App.hideModal('lastSessionRestoreModal');
        if (keepBtn) { keepBtn.disabled = false; keepBtn.textContent = keepLabel || 'Keep and Open'; }
        if (discardBtn) discardBtn.disabled = false;
      }
      return;
    }
    pendingRestore = null;
    App.hideModal('lastSessionRestoreModal');
    try {
      await doRestoreLastProject(p.proj, p.cachedBlob);
      App.updateUI();
    } catch (err) {
      App.showToast('Failed to restore project: ' + (err?.message || 'Unknown error'), 5000);
    }
  };
  document.getElementById('lastSessionRestoreDiscard').onclick = async () => {
    const p = pendingRestore;
    if (!p) { App.hideModal('lastSessionRestoreModal'); return; }
    const projectId = p.cloudLast ? p.cloudLast.projectId : (p.proj && p.proj.id);
    pendingRestore = null;
    App.hideModal('lastSessionRestoreModal');
    try { localStorage.removeItem('clickcount-last-project'); } catch (_) { /* noop */ }
    if (projectId) {
      await pdfCacheDelete(projectId);
      await takeoffBackupDelete(projectId);
    }
    App.updateUI();
  };

  App.openLastSessionRestorePrompt = openLastSessionRestorePrompt;
  App.onLastSessionRestoreReset = () => { pendingRestore = null; };
})();

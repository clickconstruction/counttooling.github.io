(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Copy/fork domain + save-before-load gate -- extracted from
  // features/load-project.js at its documented domain boundary (the code
  // itself arrived from app.js as registry split #35). This file owns
  // pendingCopyProject / copyProjectModalTarget; app.js and
  // features/load-project.js reach everything through the App registry at
  // call time (openCopyProjectModalOrPromptSave / openLoadProjectModalOrPromptSave /
  // hydrateProjectFromCloudRow / resolvePdfBufferForCloudProject /
  // buildPagesFromPdfArrayBufferAndProjectData / resetCopyProjectState /
  // clearCopyProjectModalTarget), so load order between the two files is
  // irrelevant. The reverse edge (App.openLoadProjectModal) is registered by
  // features/load-project.js and read at call time here.
  // Boundary rule: read shared deps from App.* at call time, never captured
  // at load. The supabase client is re-read via App.getSupabase() at each
  // await site (it can be recycled). See ARCHITECTURE.md "Feature files /
  // window.App registry". No build step.
  let pendingCopyProject = null;
  let copyProjectModalTarget = null;

  function openCopyProjectModal(proj) {
    copyProjectModalTarget = proj;
    const inp = document.getElementById('copyProjectNameInput');
    const confirmBtn = document.getElementById('copyProjectModalConfirm');
    if (inp) inp.value = (proj.name || 'Untitled') + ' (copy)';
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Open copy'; }
    App.showModal('copyProjectModal');
    if (inp) setTimeout(function () { inp.focus(); inp.select && inp.select(); }, 0);
  }
  function openCopyProjectModalOrPromptSave(proj) {
    if (!App.getAutoSaveDirty()) {
      pendingCopyProject = null;
      openCopyProjectModal(proj);
      return;
    }
    pendingCopyProject = proj;
    const msgEl = document.querySelector('#saveBeforeLoadModal p');
    const cancelBtn = document.getElementById('saveBeforeLoadCancel');
    const discardBtn = document.getElementById('saveBeforeLoadDiscard');
    const saveBtn = document.getElementById('saveBeforeLoadSave');
    if (msgEl) msgEl.textContent = 'You have unsaved changes. Save before copying another project?';
    if (cancelBtn) { cancelBtn.disabled = false; cancelBtn.textContent = 'Cancel'; }
    if (discardBtn) discardBtn.style.display = '';
    if (saveBtn) saveBtn.style.display = '';
    App.showModal('saveBeforeLoadModal');
  }

  // SECTION: Cloud project hydrate / copy / fork
  function hydrateProjectFromCloudRow(proj, opts) {
    opts = opts || {};
    App.state.pendingCanvasLoad = null;
    App.state.currentProjectId = proj.id;
    App.state.currentProjectName = proj.name || 'Untitled';
    App.state.currentProjectExternalRef = proj.external_ref || null;
    App.state.pdfHash = opts.reusePdfHash !== undefined ? opts.reusePdfHash : (proj.pdf_hash || null);
    if (opts.reusePdfStoragePath !== undefined) App.state.pdfStoragePath = opts.reusePdfStoragePath;
    App.setLastSaveIncludedPdf(!!proj.pdf_path);
    App.state.lastSavedAt = proj.updated_at || null;
    App.setLastLocalBackupAt(null);
    App.state.currentPage = App.state.pages.length > 0
      ? Math.min(App.state.currentPage, Math.max(0, App.state.pages.length - 1))
      : 0;
    App.setAutoSaveDirty(false);
    App.setLastModifiedAt(0);
    App.state.checkedOutBy = proj.checked_out_by || null;
    App.state.checkedOutAt = proj.checked_out_at || null;
    App.state.checkedOutEmail = proj.checked_out_email || null;
    App.state.loadedViaViewLink = false;
    App.state.isViewer = !proj.can_edit;
    App.state.canCheckOut = proj.can_check_out || false;
    try { App.clearCheckoutExpiredAttention(); } catch (_) {}
    App.state.projectOwnerId = proj.user_id || null;
    App.subscribeToProjectCheckoutChanges(proj.id);
    App.logProjectOpenEvent();
    if (App.SUPABASE_ENABLED && App.state.supabaseSession?.user) {
      try {
        localStorage.setItem('clickcount-last-project', JSON.stringify({
          projectId: App.state.currentProjectId,
          projectName: App.state.currentProjectName || 'Untitled',
          pdfStoragePath: App.state.pdfStoragePath || null,
          pdfHash: App.state.pdfHash || null,
          userId: App.state.supabaseSession.user.id
        }));
      } catch (_) {}
    }
  }

  async function resolvePdfBufferForCloudProject(proj, useIdbBackup, idbBackup) {
    let buf;
    if (useIdbBackup && idbBackup.pdfBlob) {
      buf = await idbBackup.pdfBlob.arrayBuffer();
    }
    if (buf === undefined || !buf || buf.byteLength === 0) {
      const cachedBlob = proj.pdf_hash ? await pdfCacheGet(proj.id, proj.pdf_hash) : null;
      if (cachedBlob && cachedBlob.size > 0) {
        buf = await cachedBlob.arrayBuffer();
      }
      if (cachedBlob && (!buf || buf.byteLength === 0)) {
        pdfCacheDelete(proj.id);
      }
    }
    if (buf === undefined || !buf || buf.byteLength === 0) {
      const { data: blob, error: dlErr } = await App.getSupabase().storage.from('pdfs').download(proj.pdf_path);
      const emptyOrMissing = dlErr || !blob || blob.size === 0;
      if (emptyOrMissing) return null;
      buf = await blob.arrayBuffer();
      if (proj.pdf_hash) pdfCachePut(proj.id, blob, proj.pdf_hash);
    }
    return (buf && buf.byteLength > 0) ? buf : null;
  }
  async function buildPagesFromPdfArrayBufferAndProjectData(buf, d, useIdbBackup, idbBackup, planName) {
    const bufPdf = buf.slice(0);
    const bufStorage = buf.slice(0);
    const pdf = await App.getPdfDocument(bufPdf).promise;
    App.clearPdfBitmapCache();
    App.state.pages = [];
    const numPages = pdf.numPages;
    // Default page labels carry the plan name, not a hardcoded "document.pdf"
    // (same root cause as B6's view-only.js / restore-last-session.js fix).
    // Saved labels — including owner renames — override these below via
    // applyPageAnnotationsFromData / applyTakeoffBackupToState.
    const defaultName = planName || 'Untitled';
    for (let i = 0; i < numPages; i++) {
      const pdfPage = await pdf.getPage(i + 1);
      const label = numPages > 1 ? (defaultName + ' — p' + (i + 1)) : defaultName;
      const canvasId = App.uid();
      App.state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: App.makeAnnotations() }], scale: null, rotation: 0 });
      App.state.activeCanvasIdByPage[i] = canvasId;
    }
    if (useIdbBackup && idbBackup.data) {
      App.applyTakeoffBackupToState(idbBackup.data);
    } else {
      App.state.counters = Array.isArray(d.counters) ? d.counters : [];
      App.state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
      App.state.groups = App.ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
      App.state.groupsEnabled = !!d.groupsEnabled;
      App.state.rooms = Array.isArray(d.rooms) ? d.rooms : [];
      if (d.iconNames && typeof d.iconNames === 'object') App.state.iconNames = d.iconNames;
      if (Array.isArray(d.iconOrder)) App.state.iconOrder = d.iconOrder;
      if (Array.isArray(d.customIconPaths)) App.saveUserCustomIcons(d.customIconPaths);
      (d.pages || []).forEach(function (p) {
        App.applyPageAnnotationsFromData(App.state.pages[p.index], p);
      });
      if (d.activeCanvasIdByPage && typeof d.activeCanvasIdByPage === 'object') App.state.activeCanvasIdByPage = d.activeCanvasIdByPage;
      // Project bindings replace when present; when absent, an artboard-seeded
      // layout survives but a previous project's is dropped (quick-keys.js).
      if (App.applyProjectQuickKeys) App.applyProjectQuickKeys(d.numberKeyBindings);
      else App.state.numberKeyBindings = (d.numberKeyBindings && typeof d.numberKeyBindings === 'object') ? d.numberKeyBindings : {};
      if (d.pageScales) {
        d.pageScales.forEach(function (scale, i) { if (App.state.pages[i]) App.state.pages[i].scale = scale; });
      } else if (d.scale) {
        App.state.pages.forEach(function (p) { p.scale = d.scale; });
      }
      App.state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
      if (d.legendSettings) App.state.legendSettings = { ...App.state.legendSettings, ...d.legendSettings };
      if (d.multiplyZoneSettings) App.state.multiplyZoneSettings = { ...App.state.multiplyZoneSettings, ...d.multiplyZoneSettings };
      if (d.scaleZoneSettings) App.state.scaleZoneSettings = { ...App.state.scaleZoneSettings, ...d.scaleZoneSettings };
      if (d.showGridOverlay != null) App.state.showGridOverlay = !!d.showGridOverlay;
      if (d.gridSettings) App.state.gridSettings = d.gridSettings;
    }
    App.reconcileOrphanedCountersAndLineTypes();
    App.clearUndoStacks();
    return bufStorage;
  }
  async function applyLocalForkAfterPdfLoad(forkName, pdfArrayBuffer) {
    App.state.pdfStoragePath = null;
    App.state.pendingCanvasLoad = null;
    App.state.currentProjectId = null;
    App.state.currentProjectName = forkName || 'Untitled';
    App.state.currentProjectExternalRef = null;
    App.state.pdfBuffer = pdfArrayBuffer;
    App.state.pdfBufferSize = pdfArrayBuffer.byteLength;
    App.state.pdfHash = await App.sha256Hex(pdfArrayBuffer);
    App.subscribeToProjectCheckoutChanges(null);
    App.state.checkedOutBy = null;
    App.state.checkedOutAt = null;
    App.state.checkedOutEmail = null;
    App.state.isViewer = false;
    App.state.canCheckOut = false;
    App.state.projectOwnerId = null;
    App.state.loadedViaViewLink = false;
    App.state.lastSavedAt = null;
    App.setLastSaveIncludedPdf(false);
    App.setLastLocalBackupAt(null);
    App.setAutoSaveDirty(false);
    try { App.clearCheckoutExpiredAttention(); } catch (_) {}
    App.setLastModifiedAt(0);
    App.state.currentPage = Math.min(App.state.currentPage, Math.max(0, App.state.pages.length - 1));
    try { localStorage.removeItem('clickcount-last-project'); } catch (_) {}
    App.hideModal('copyProjectModal');
    App.hideModal('loadProjectModal');
    App.state.sidebarReorderModeActive = false;
    copyProjectModalTarget = null;
    App.fitZoom();
    App.updateUI();
    App.showToast('Local copy opened. Save to cloud from Project Settings when you are ready.', 5000);
  }
  async function forkCloudProjectToLocalWorkingCopy(proj, forkName) {
    if (!App.getSupabase()) {
      App.showToast('Cloud not configured.', 3000);
      return;
    }
    if (App.state.currentProjectId && App.state.currentProjectId !== proj.id) await App.checkInCurrentProjectIfHeld();
    let d = proj.data || {};
    try {
      const { data: full, error } = await App.getSupabase().from('projects').select('data').eq('id', proj.id).single();
      if (!error && full && full.data) d = full.data;
    } catch (_) {}
    const projUpdated = proj.updated_at ? new Date(proj.updated_at).getTime() : 0;
    const idbBackup = await App.takeoffBackupGet(proj.id, App.state.supabaseSession?.user?.id || null);
    const useIdbBackup = idbBackup && idbBackup.lastModifiedAt > projUpdated;
    if (!proj.pdf_path) {
      App.showToast('Copy to new requires a PDF in the project.', 4000);
      return;
    }
    try {
      const buf = await resolvePdfBufferForCloudProject(proj, useIdbBackup, idbBackup);
      if (!buf) {
        App.showToast('Cannot copy: PDF is missing from storage. Open the project and upload a PDF if needed.', 5000);
        return;
      }
      const bufStorage = await buildPagesFromPdfArrayBufferAndProjectData(buf, d, useIdbBackup, idbBackup, proj.name);
      const nameTrim = (forkName || '').trim() || 'Untitled';
      await applyLocalForkAfterPdfLoad(nameTrim, bufStorage);
    } catch (e) {
      console.error('[Fork project]', e);
      App.showToast(e.message || 'Failed to copy project.', 5000);
    }
  }
  function openLoadProjectModalOrPromptSave() {
    if (!App.getAutoSaveDirty()) {
      pendingCopyProject = null;
      App.openLoadProjectModal().catch(e => {
        console.error('[Load Project]', e);
        App.showToast('Failed to load projects: ' + (e?.message || 'Unknown error'));
      });
      return;
    }
    pendingCopyProject = null;
    const msgEl = document.querySelector('#saveBeforeLoadModal p');
    const cancelBtn = document.getElementById('saveBeforeLoadCancel');
    const discardBtn = document.getElementById('saveBeforeLoadDiscard');
    const saveBtn = document.getElementById('saveBeforeLoadSave');
    if (msgEl) msgEl.textContent = 'You have unsaved changes. Save before loading another project?';
    if (cancelBtn) { cancelBtn.disabled = false; cancelBtn.textContent = 'Cancel'; }
    if (discardBtn) discardBtn.style.display = '';
    if (saveBtn) saveBtn.style.display = '';
    App.showModal('saveBeforeLoadModal');
  }

  // SECTION: Copy project modal
  document.getElementById('copyProjectModalConfirm').onclick = async () => {
    const proj = copyProjectModalTarget;
    const inp = document.getElementById('copyProjectNameInput');
    const confirmBtn = document.getElementById('copyProjectModalConfirm');
    if (!proj) {
      App.hideModal('copyProjectModal');
      return;
    }
    const name = inp ? inp.value : '';
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Opening…';
    }
    try {
      await forkCloudProjectToLocalWorkingCopy(proj, name);
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Open copy';
      }
    }
  };

  // SECTION: Save-before-load modal
  document.getElementById('saveBeforeLoadCancel').onclick = () => {
    pendingCopyProject = null;
    App.hideModal('saveBeforeLoadModal');
  };
  document.getElementById('saveBeforeLoadDiscard').onclick = () => {
    App.hideModal('saveBeforeLoadModal');
    const p = pendingCopyProject;
    pendingCopyProject = null;
    if (p) openCopyProjectModal(p);
    else App.openLoadProjectModal();
  };
  document.getElementById('saveBeforeLoadSave').onclick = async () => {
    const cancelBtn = document.getElementById('saveBeforeLoadCancel');
    const discardBtn = document.getElementById('saveBeforeLoadDiscard');
    const saveBtn = document.getElementById('saveBeforeLoadSave');
    const msgEl = document.querySelector('#saveBeforeLoadModal p');
    msgEl.textContent = 'Saving Now...';
    discardBtn.style.display = 'none';
    saveBtn.style.display = 'none';
    cancelBtn.disabled = true;
    cancelBtn.textContent = 'Cancel';
    const result = await App.performAutoSave();
    if (result.ok) {
      App.hideModal('saveBeforeLoadModal');
      const p = pendingCopyProject;
      pendingCopyProject = null;
      if (p) openCopyProjectModal(p);
      else App.openLoadProjectModal();
    } else {
      if (result.error?.code === 'CHECKOUT_EXPIRED') {
        App.pushSaveEvent('checkout_expired', CHECKOUT_EXPIRED_SAVE_STATUS_MSG);
        App.setCheckoutExpiredAttention();
        App.refreshProjectPermissions().catch(() => {});
        App.updateSaveStatusIndicator();
        App.hideModal('saveBeforeLoadModal');
        pendingCopyProject = null;
        App.openCheckoutExpiredRecoveryModal({ trigger: 'save_before_load' });
        return;
      } else if (App.isAuthError(result.error)) {
        App.showToast('Refresh the page to sync.', 4000);
      } else {
        const errMsg = result.error ? ((result.error?.message) || (result.error?.details) || (result.error?.hint) || String(result.error)) : '';
        App.showToast('Save failed' + (errMsg ? ': ' + errMsg : '') + '. Open Project Settings to retry.', 4000);
      }
      msgEl.textContent = pendingCopyProject
        ? 'You have unsaved changes. Save before copying another project?'
        : 'You have unsaved changes. Save before loading another project?';
      discardBtn.style.display = '';
      saveBtn.style.display = '';
      cancelBtn.disabled = false;
    }
  };

  App.openCopyProjectModalOrPromptSave = openCopyProjectModalOrPromptSave;
  App.openLoadProjectModalOrPromptSave = openLoadProjectModalOrPromptSave;
  App.hydrateProjectFromCloudRow = hydrateProjectFromCloudRow;
  App.resolvePdfBufferForCloudProject = resolvePdfBufferForCloudProject;
  App.buildPagesFromPdfArrayBufferAndProjectData = buildPagesFromPdfArrayBufferAndProjectData;
  App.resetCopyProjectState = () => { pendingCopyProject = null; copyProjectModalTarget = null; };
  App.clearCopyProjectModalTarget = () => { copyProjectModalTarget = null; };
})();

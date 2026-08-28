(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Load Project modal (cloud project browser) -- extracted from app.js via the
  // window.App registry. Deps are read from App; the supabase client is re-read
  // via App.getSupabase() in the outer function and in each nested async helper
  // because it can be recycled. The save-before-load gate
  // (openLoadProjectModalOrPromptSave) and the whole copy/fork domain live in
  // features/copy-project.js (split at this file's documented domain boundary);
  // the #loadProject* bindings stay in app.js. Cross-file names travel through
  // the registry at call time in both directions (this file reads
  // App.openCopyProjectModalOrPromptSave / App.hydrateProjectFromCloudRow /
  // App.resolvePdfBufferForCloudProject /
  // App.buildPagesFromPdfArrayBufferAndProjectData; copy-project.js reads
  // App.openLoadProjectModal), so load order between the two is irrelevant.
  // The per-open helpers (access panel fill/fetch, invite user select,
  // canvas download, list filtering) are hoisted to the IIFE top level and
  // threaded a per-open `lp` context object ({ projectsAll, listEl, emptyEl,
  // accessCache }); the row renderer is decomposed along its action
  // boundaries (computeLoadProjectRowSizeBytes / buildLoadProjectRowHtml /
  // bindLoadProjectRowActions / bindLoadProjectAdminAccess /
  // bindLoadProjectRowLoad) with renderLoadProjectListRows as a thin loop.

  // Pure formatting helpers shared by the hoisted per-open list helpers.
  const esc = (s) => App.escapeHtml(s);
  const formatSizeMb = function (bytes) {
    if (bytes == null || bytes < 0) return '';
    const mb = bytes / (1024 * 1024);
    return mb < 0.01 ? (bytes / 1024).toFixed(2) + ' KB' : mb.toFixed(2) + ' MB';
  };
  function fillLoadProjectAccessPanel(panel, rows, escFn) {
    if (!rows || rows.length === 0) {
      panel.innerHTML = '<div class="load-project-access-empty" style="color:var(--text3);">No users listed.</div>';
      return;
    }
    let html = '<ul class="load-project-access-list">';
    for (let ai = 0; ai < rows.length; ai++) {
      const r = rows[ai];
      html += '<li><span class="load-project-access-email">' + escFn(r.email || '—') + '</span> <span class="badge" style="background:var(--surface2);color:var(--text2);font-size:10px;">' + escFn(r.role || '') + '</span></li>';
    }
    html += '</ul>';
    panel.innerHTML = html;
  }
  async function fetchLoadProjectAccessIntoPanel(lp, accessPanel, proj) {
    const supabase = App.getSupabase();
    if (lp.accessCache[proj.id]) {
      fillLoadProjectAccessPanel(accessPanel, lp.accessCache[proj.id], esc);
      return;
    }
    if (!supabase) {
      accessPanel.innerHTML = '<div class="load-project-access-error" style="color:var(--red);">Cloud not configured.</div>';
      return;
    }
    accessPanel.innerHTML = '<div class="load-project-access-loading">Loading…</div>';
    try {
      const { data, error } = await supabase.rpc('list_project_shares', { p_project_id: proj.id });
      if (error) {
        accessPanel.innerHTML = '<div class="load-project-access-error" style="color:var(--red);">' + esc(error.message || 'Failed to load') + '</div>';
        App.showToast(error.message || 'Could not load access list.', 4000);
        return;
      }
      lp.accessCache[proj.id] = data || [];
      fillLoadProjectAccessPanel(accessPanel, lp.accessCache[proj.id], esc);
    } catch (err) {
      accessPanel.innerHTML = '<div class="load-project-access-error" style="color:var(--red);">' + esc(err.message || 'Failed') + '</div>';
      App.showToast(err.message || 'Could not load access list.', 4000);
    }
  }
  async function populateLoadProjectUserSelect(userSelect, proj) {
    const supabase = App.getSupabase();
    const wrap = userSelect.closest('.load-project-access-add-wrap');
    const addErrEl = wrap ? wrap.querySelector('.load-project-access-add-error') : null;
    if (addErrEl) {
      addErrEl.style.display = 'none';
      addErrEl.textContent = '';
    }
    userSelect.innerHTML = '<option value="">Select a user…</option>';
    if (!supabase) {
      const o = document.createElement('option');
      o.value = '';
      o.disabled = true;
      o.textContent = 'Cloud not configured';
      userSelect.appendChild(o);
      userSelect.disabled = true;
      return;
    }
    userSelect.disabled = false;
    try {
      const { data, error } = await supabase.rpc('list_users_for_project_invite', { p_project_id: proj.id });
      if (error) {
        if (addErrEl) {
          addErrEl.textContent = error.message || 'Could not load users';
          addErrEl.style.display = 'block';
        }
        App.showToast(error.message || 'Could not load users for invite.', 4000);
        return;
      }
      userSelect.innerHTML = '<option value="">Select a user…</option>';
      if (data && data.length > 0) {
        for (let ui = 0; ui < data.length; ui++) {
          const u = data[ui];
          const opt = document.createElement('option');
          opt.value = (u.email || '').toLowerCase();
          opt.textContent = u.email || u.id;
          userSelect.appendChild(opt);
        }
      }
    } catch (err) {
      if (addErrEl) {
        addErrEl.textContent = err.message || 'Could not load users';
        addErrEl.style.display = 'block';
      }
      App.showToast(err.message || 'Could not load users for invite.', 4000);
    }
  }
  function downloadLoadProjectCanvasJson(data, filename) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  function getFilteredLoadProjects(lp) {
    let filtered = lp.projectsAll.slice();
    const ownEl = document.getElementById('loadProjectFilterOwnership');
    const roleEl = document.getElementById('loadProjectFilterRole');
    const ownerEl = document.getElementById('loadProjectFilterOwnerEmail');
    const searchEl = document.getElementById('loadProjectFilterSearch');
    if (ownEl && ownEl.value === 'mine') filtered = filtered.filter(function (p) { return p.is_owner; });
    else if (ownEl && ownEl.value === 'shared') filtered = filtered.filter(function (p) { return !p.is_owner; });
    if (roleEl && roleEl.value) filtered = filtered.filter(function (p) { return (p.my_access_role || '') === roleEl.value; });
    if ((App.state.isAdmin || App.state.isOverseer) && ownerEl && ownerEl.value) filtered = filtered.filter(function (p) { return (p.owner_email || '') === ownerEl.value; });
    if (searchEl) {
      const q = (searchEl.value || '').trim().toLowerCase();
      if (q) filtered = filtered.filter(function (p) { return (p.name || 'Untitled').toLowerCase().indexOf(q) !== -1; });
    }
    return filtered;
  }
  // Row-size resolution: prefer the RPC row's size_bytes; otherwise fall back
  // to data-JSON length (+ the storage object's size when a PDF exists).
  async function computeLoadProjectRowSizeBytes(proj) {
    const supabase = App.getSupabase();
    let sizeBytes = proj.size_bytes;
    if (sizeBytes == null && proj.pdf_path) {
      try {
        const { data: info } = await supabase.storage.from('pdfs').info(proj.pdf_path);
        const sz = info && (info.metadata?.size ?? info.size);
        sizeBytes = (proj.data ? JSON.stringify(proj.data).length : 0) + (typeof sz === 'number' && sz >= 0 ? sz : 0);
      } catch (_) { sizeBytes = proj.data ? JSON.stringify(proj.data).length : 0; }
    } else if (sizeBytes == null) {
      sizeBytes = proj.data ? JSON.stringify(proj.data).length : 0;
    }
    return sizeBytes;
  }
  // Row markup (name/meta/badges/actions + the admin access block). Pure
  // string build -- all bindings happen in the bind* helpers below.
  function buildLoadProjectRowHtml(proj, sizeBytes) {
    const state = App.state;
    const date = proj.updated_at ? new Date(proj.updated_at).toLocaleString() : '';
    const sizeStr = formatSizeMb(sizeBytes);
    const canvasOnlyBadge = !proj.pdf_path ? '<button type="button" class="badge load-project-canvas-download" title="Download canvas (.json)" aria-label="Download canvas">Canvas only</button>' : '';
    const countsBadge = (proj.counter_count != null || proj.line_count != null) && (proj.counter_count > 0 || proj.line_count > 0)
      ? '<span class="badge" style="background:var(--surface2);color:var(--text2);font-size:11px;">' + [proj.counter_count > 0 ? (proj.counter_count + ' cnt') : null, proj.line_count > 0 ? (proj.line_count + ' ln') : null].filter(Boolean).join(' · ') + '</span>'
      : '';
    let lockBadge = '';
    if (proj.can_edit) lockBadge = ' <span class="badge" style="background:var(--green);color:var(--bg);font-size:11px;">You\'re editing</span>';
    else if (proj.checked_out_email) lockBadge = ' <span class="badge" style="background:var(--yellow);color:var(--bg);font-size:11px;">Locked by ' + esc(proj.checked_out_email) + '</span>' + (App.twinBadgeHtml ? App.twinBadgeHtml(proj.checked_out_email) : '');
    else if (proj.can_check_out) lockBadge = ' <span class="badge" style="background:var(--surface2);color:var(--text2);font-size:11px;">Available</span>';
    const ownerBadge = proj.is_owner ? '' : ' <span class="badge" style="background:var(--blue);color:var(--bg);font-size:11px;">Shared</span>';
    const metaParts = [date, sizeStr].filter(Boolean);
    const meta = esc(metaParts.join(' · ')) + lockBadge + ownerBadge;
    const trashSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 640 640"><path fill="currentColor" d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/></svg>';
    const deleteBtnHtml = proj.is_owner ? '<button type="button" class="load-project-delete" title="Delete from cloud" aria-label="Delete">' + trashSvg + '</button>' : '';
    const copyNewBtnHtml = proj.pdf_path ? '<button type="button" class="load-project-copy-new" title="Open a local copy. Save to cloud from Project Settings when ready.">Copy to new</button>' : '';
    const actionsHtml = (countsBadge || canvasOnlyBadge || copyNewBtnHtml || deleteBtnHtml) ? '<div class="load-project-actions">' + countsBadge + canvasOnlyBadge + copyNewBtnHtml + deleteBtnHtml + '</div>' : '';
    const adminAccessHtml = state.isAdmin
      ? '<div class="load-project-admin-access">' +
        '<div class="load-project-access-header">' +
        '<button type="button" class="load-project-access-toggle" aria-expanded="true" aria-controls="loadProjectAccess_' + proj.id + '">' +
        '<span class="load-project-access-chevron" aria-hidden="true">▼</span> Who has access' +
        '</button>' +
        '<div class="load-project-access-add-wrap">' +
        '<div class="load-project-access-add">' +
        '<select class="load-project-access-user-select" aria-label="User to add">' +
        '<option value="">Select a user…</option>' +
        '</select>' +
        '<select class="load-project-access-role-select" aria-label="Role for new user">' +
        '<option value="viewer">Viewer</option>' +
        '<option value="editor">Editor</option>' +
        '</select>' +
        '<button type="button" class="load-project-access-add-btn">Add</button>' +
        '</div>' +
        '<div class="load-project-access-add-error" style="display:none;"></div>' +
        '</div>' +
        '</div>' +
        '<div id="loadProjectAccess_' + proj.id + '" class="load-project-access-panel"></div>' +
        '</div>'
      : '';
    return '<div class="load-project-row-main">' +
      '<div class="load-project-info"><span class="load-project-name">' + esc(proj.name || 'Untitled') + '</span><div class="load-project-meta">' + meta + '</div></div>' +
      actionsHtml + '</div>' + adminAccessHtml;
  }
  // Row actions: delete-from-cloud, canvas-only JSON download, copy-to-new.
  function bindLoadProjectRowActions(lp, proj, div) {
    const { listEl, emptyEl, projectsAll } = lp;
    const deleteBtn = div.querySelector('.load-project-delete');
    if (deleteBtn) {
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm('Delete "' + (proj.name || 'Untitled') + '" from cloud? This cannot be undone.')) return;
        const {
          state, showToast, deleteProjectAsOwner, clearUndoStacks,
          subscribeToProjectCheckoutChanges, setLastLocalBackupAt,
          clearCheckoutExpiredAttention, updateUI,
        } = App;
        try {
          await deleteProjectAsOwner(proj.id, proj.pdf_path);
          div.remove();
          for (let pi = projectsAll.length - 1; pi >= 0; pi--) {
            if (projectsAll[pi].id === proj.id) { projectsAll.splice(pi, 1); break; }
          }
          if (!projectsAll.length) {
            const filtersBarDel = document.getElementById('loadProjectFilters');
            if (filtersBarDel) filtersBarDel.style.display = 'none';
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
          } else {
            void renderLoadProjectListRows(lp);
          }
          if (state.currentProjectId === proj.id) {
            clearUndoStacks();
            App.clearPdfBitmapCache && App.clearPdfBitmapCache();
            state.pages = [];
            state.currentProjectId = null;
            subscribeToProjectCheckoutChanges(null);
            state.currentProjectName = null;
            state.pdfBuffer = null;
            state.pdfBufferSize = 0;
            state.pdfStoragePath = null;
            state.pdfHash = null;
            state.projectOwnerId = null;
            state.lastSavedAt = null;
            setLastLocalBackupAt(null);
            state.checkedOutBy = null;
            state.checkedOutAt = null;
            state.checkedOutEmail = null;
            state.isViewer = false;
            state.canCheckOut = false;
            try { localStorage.removeItem('clickcount-last-project'); } catch (_) {}
            try { clearCheckoutExpiredAttention(); } catch (_) {}
            updateUI();
          }
        } catch (err) {
          App.showToast(err?.message || 'Failed to delete project', 4000);
        }
      };
    }
    const canvasDlBtn = div.querySelector('.load-project-canvas-download');
    if (canvasDlBtn) {
      canvasDlBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const { showToast, sanitizeForFilename } = App;
        const supabase = App.getSupabase();
        if (!supabase) {
          showToast('Cloud not configured.', 3000);
          return;
        }
        try {
          const { data: full, error } = await supabase.from('projects').select('data').eq('id', proj.id).single();
          if (error) {
            showToast(error.message || 'Could not load canvas data.', 4000);
            return;
          }
          if (!full || full.data == null) {
            showToast('No canvas data for this project.', 4000);
            return;
          }
          downloadLoadProjectCanvasJson(full.data, sanitizeForFilename(proj.name || 'Untitled') + '.json');
        } catch (err) {
          showToast(err?.message || 'Download failed.', 4000);
        }
      };
    }
    const copyNewBtn = div.querySelector('.load-project-copy-new');
    if (copyNewBtn) {
      copyNewBtn.onclick = function (e) {
        e.stopPropagation();
        e.preventDefault();
        App.openCopyProjectModalOrPromptSave(proj);
      };
    }
  }
  // Admin "Who has access" block: expand/collapse, access-list fetch, invite.
  function bindLoadProjectAdminAccess(lp, proj, div) {
    if (!App.state.isAdmin) return;
    const toggleBtn = div.querySelector('.load-project-access-toggle');
    const accessPanel = div.querySelector('.load-project-access-panel');
    const addWrap = div.querySelector('.load-project-access-add-wrap');
    if (addWrap) {
      addWrap.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    if (!toggleBtn || !accessPanel) return;
    toggleBtn.onclick = async function (e) {
      e.stopPropagation();
      e.preventDefault();
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      const chev = toggleBtn.querySelector('.load-project-access-chevron');
      if (expanded) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        accessPanel.hidden = true;
        if (chev) chev.textContent = '▶';
        return;
      }
      toggleBtn.setAttribute('aria-expanded', 'true');
      accessPanel.hidden = false;
      if (chev) chev.textContent = '▼';
      await fetchLoadProjectAccessIntoPanel(lp, accessPanel, proj);
    };
    const addBtn = div.querySelector('.load-project-access-add-btn');
    const userSelect = div.querySelector('.load-project-access-user-select');
    const roleSel = div.querySelector('.load-project-access-role-select');
    const addErrEl = div.querySelector('.load-project-access-add-error');
    if (addBtn && userSelect && roleSel) {
      addBtn.onclick = async function (e) {
        e.stopPropagation();
        e.preventDefault();
        const { state, showToast, SUPABASE_URL } = App;
        if (addErrEl) {
          addErrEl.style.display = 'none';
          addErrEl.textContent = '';
        }
        const email = (userSelect.value || '').trim().toLowerCase();
        if (!email) {
          if (addErrEl) {
            addErrEl.textContent = 'Select a user';
            addErrEl.style.display = 'block';
          }
          return;
        }
        if (!App.getSupabase()) {
          showToast('Cloud not configured.', 3000);
          return;
        }
        addBtn.disabled = true;
        try {
          const res = await fetch((typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/invite-to-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (state.supabaseSession?.access_token || '') },
            body: JSON.stringify({ project_id: proj.id, email: email, role: roleSel.value || 'viewer' })
          });
          const data = await res.json();
          if (data.ok) {
            delete lp.accessCache[proj.id];
            userSelect.value = '';
            await fetchLoadProjectAccessIntoPanel(lp, accessPanel, proj);
            showToast('Added ' + (data.email || email));
          } else {
            const msg = data.error || 'Failed to add user';
            if (addErrEl) {
              addErrEl.textContent = msg;
              addErrEl.style.display = 'block';
            }
            showToast(msg, 4000);
          }
        } catch (err) {
          const msg = err.message || 'Failed to add user';
          if (addErrEl) {
            addErrEl.textContent = msg;
            addErrEl.style.display = 'block';
          }
          showToast(msg, 4000);
        } finally {
          addBtn.disabled = false;
        }
      };
    }
    void fetchLoadProjectAccessIntoPanel(lp, accessPanel, proj);
    if (userSelect) void populateLoadProjectUserSelect(userSelect, proj);
  }
  // The row's main click: the actual project load. `shared.inProgress` is the
  // per-render mutex (one load at a time across all rows).
  function bindLoadProjectRowLoad(lp, proj, div, shared) {
    const rowMain = div.querySelector('.load-project-row-main');
    if (!rowMain) return;
    rowMain.onclick = async () => {
      if (shared.inProgress) return;
      shared.inProgress = true;
      const { listEl } = lp;
      div.classList.add('loading');
      listEl.classList.add('loading');
      const metaEl = div.querySelector('.load-project-meta');
      const origMeta = metaEl ? metaEl.textContent : '';
      if (metaEl) metaEl.textContent = 'Loading…';
      try {
        await loadCloudProjectRow(proj, {
          hostModalId: 'loadProjectModal',
          showError: function (html) { listEl.innerHTML = html; },
        });
      } finally {
        shared.inProgress = false;
        div.classList.remove('loading');
        listEl.classList.remove('loading');
        if (metaEl) metaEl.textContent = origMeta;
      }
    };
  }
  // Host-agnostic cloud-project load (shared with features/bid-board.js): takes
  // a list_accessible_projects row, hydrates app state, and closes
  // ui.hostModalId when done (the canvas-only flow hands off to its own modal).
  // Load failures render via ui.showError(html) in the host's list area.
  async function loadCloudProjectRow(proj, ui) {
      const {
        state, hideModal, showToast,
        hydrateProjectFromCloudRow, clearCheckoutExpiredAttention,
        saveUserCustomIcons, reconcileOrphanedCountersAndLineTypes,
        clearUndoStacks, checkInCurrentProjectIfHeld, takeoffBackupGet,
        resolvePdfBufferForCloudProject, ensureGroupColors,
        openCanvasOnlyNeedsPdfModal, buildPagesFromPdfArrayBufferAndProjectData,
        backupDataToProjFormat, fitZoom, updateUI,
        setAutoSaveDirty, setLastModifiedAt, setLastSaveIncludedPdf,
      } = App;
      const supabase = App.getSupabase();
      // A1: Clear any stale pendingCanvasLoad from a previous canvas-only
      // load whose file picker the user dismissed, so it can't apply to
      // the project we're about to open.
      state.pendingCanvasLoad = null;
      if (state.currentProjectId && state.currentProjectId !== proj.id) await checkInCurrentProjectIfHeld();
      let d = proj.data || {};
      try {
        const { data: full, error } = await supabase.from('projects').select('data').eq('id', proj.id).single();
        if (!error && full && full.data) d = full.data;
      } catch (_) {}
      const projUpdated = proj.updated_at ? new Date(proj.updated_at).getTime() : 0;
      const idbBackup = await takeoffBackupGet(proj.id, state.supabaseSession?.user?.id || null);
      const useIdbBackup = idbBackup && idbBackup.lastModifiedAt > projUpdated;
      if (proj.pdf_path) {
        try {
          const buf = await resolvePdfBufferForCloudProject(proj, useIdbBackup, idbBackup);
          if (!buf) {
              /* PDF in storage is empty or missing – treat as canvas-only and offer upload */
              state.pdfStoragePath = null;
              state.pdfBuffer = null;
              state.pdfBufferSize = 0;
              App.clearPdfBitmapCache && App.clearPdfBitmapCache();
              state.pages = [];
              state.counters = Array.isArray(d.counters) ? d.counters : [];
              state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
              state.groups = ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
              state.groupsEnabled = !!d.groupsEnabled;
              if (d.iconNames && typeof d.iconNames === 'object') state.iconNames = d.iconNames;
              if (Array.isArray(d.iconOrder)) state.iconOrder = d.iconOrder;
              if (Array.isArray(d.customIconPaths)) saveUserCustomIcons(d.customIconPaths);
              if (d.legendSettings) state.legendSettings = { ...App.state.legendSettings, ...d.legendSettings };
              if (d.multiplyZoneSettings) state.multiplyZoneSettings = { ...App.state.multiplyZoneSettings, ...d.multiplyZoneSettings };
              if (d.scaleZoneSettings) state.scaleZoneSettings = { ...App.state.scaleZoneSettings, ...d.scaleZoneSettings };
              if (d.showGridOverlay != null) state.showGridOverlay = !!d.showGridOverlay;
              if (d.gridSettings) state.gridSettings = d.gridSettings;
              reconcileOrphanedCountersAndLineTypes();
              clearUndoStacks();
              hydrateProjectFromCloudRow(proj, { reusePdfHash: null, source: 'load_project' });
              // The cloud PDF object is empty/missing even though pdf_path
              // is set; correct the status-bar indicator so the user sees
              // the project as missing its PDF (matches original behavior
              // before the helper extraction).
              setLastSaveIncludedPdf(false);
              // hydrateProjectFromCloudRow clears pendingCanvasLoad, but this
              // path needs it set so the next PDF upload knows which project
              // these annotations belong to.
              state.pendingCanvasLoad = { projectId: proj.id, name: proj.name || 'Untitled', data: d, pdf_hash: null };
              hideModal(ui.hostModalId);
              state.sidebarReorderModeActive = false;
              // C1: Replaced the toast + auto-pdfInput.click() pair with a
              // dedicated modal so the user has a clear next action.
              openCanvasOnlyNeedsPdfModal({ reason: 'pdf_missing' });
              return;
          }
          await buildPagesFromPdfArrayBufferAndProjectData(buf, d, useIdbBackup, idbBackup);
          state.pdfStoragePath = proj.pdf_path;
          state.pdfBuffer = null;
          state.pdfBufferSize = 0;
        } catch (e) {
          ui.showError('<p style="color:var(--red);">Failed to load PDF: ' + (e.message || 'Unknown error') + '</p>');
          return;
        }
      } else {
        state.pendingCanvasLoad = { projectId: proj.id, name: proj.name || 'Untitled', data: backupDataToProjFormat(useIdbBackup && idbBackup.data ? idbBackup.data : d), pdf_hash: proj.pdf_hash || null };
        state.pdfStoragePath = null;
        state.pdfBuffer = null;
        state.pdfBufferSize = 0;
        App.clearPdfBitmapCache && App.clearPdfBitmapCache();
        state.pages = [];
        const canvasData = useIdbBackup && idbBackup.data ? idbBackup.data : d;
        state.counters = Array.isArray(canvasData.counters) ? canvasData.counters : [];
        state.lineTypes = Array.isArray(canvasData.lineTypes) ? canvasData.lineTypes : [];
        state.groups = ensureGroupColors(Array.isArray(canvasData.groups) ? canvasData.groups : []);
        if (canvasData.iconNames && typeof canvasData.iconNames === 'object') state.iconNames = canvasData.iconNames;
        if (Array.isArray(canvasData.iconOrder)) state.iconOrder = canvasData.iconOrder;
        if (Array.isArray(canvasData.customIconPaths)) saveUserCustomIcons(canvasData.customIconPaths);
        if (canvasData.legendSettings) state.legendSettings = { ...state.legendSettings, ...canvasData.legendSettings };
        if (canvasData.multiplyZoneSettings) state.multiplyZoneSettings = { ...state.multiplyZoneSettings, ...canvasData.multiplyZoneSettings };
        if (canvasData.scaleZoneSettings) state.scaleZoneSettings = { ...state.scaleZoneSettings, ...canvasData.scaleZoneSettings };
        if (canvasData.showGridOverlay != null) state.showGridOverlay = !!canvasData.showGridOverlay;
        if (canvasData.gridSettings) state.gridSettings = canvasData.gridSettings;
        reconcileOrphanedCountersAndLineTypes();
        clearUndoStacks();
        setAutoSaveDirty(false);
        setLastModifiedAt(0);
      }
      // B1: Capture pendingCanvasLoad that the no-PDF branch above set, so
      // the helper does not clear it. (For the with-PDF path this is null.)
      const preservedPendingCanvasLoad = state.pendingCanvasLoad;
      hydrateProjectFromCloudRow(proj, { source: 'load_project' });
      if (preservedPendingCanvasLoad) state.pendingCanvasLoad = preservedPendingCanvasLoad;
      hideModal(ui.hostModalId);
      state.sidebarReorderModeActive = false;
      if (!proj.pdf_path) {
        // C1: Replaced the toast + auto-pdfInput.click() pair with a
        // dedicated modal so the user has a clear next action.
        openCanvasOnlyNeedsPdfModal({ reason: 'no_pdf_stored' });
      }
      fitZoom();
      updateUI();
  }
  async function renderLoadProjectListRows(lp) {
    const { listEl } = lp;
    listEl.innerHTML = '';
    const filtered = getFilteredLoadProjects(lp);
    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="load-project-no-match" style="color:var(--text2);margin:0;">No projects match filters.</p>';
      App.showModal('loadProjectModal');
      return;
    }
    const shared = { inProgress: false };
    for (let i = 0; i < filtered.length; i++) {
      const proj = filtered[i];
      const sizeBytes = await computeLoadProjectRowSizeBytes(proj);
      const div = document.createElement('div');
      div.className = 'load-project-item';
      div.innerHTML = buildLoadProjectRowHtml(proj, sizeBytes);
      bindLoadProjectRowActions(lp, proj, div);
      bindLoadProjectAdminAccess(lp, proj, div);
      bindLoadProjectRowLoad(lp, proj, div, shared);
      listEl.appendChild(div);
    }
    App.showModal('loadProjectModal');
  }

  async function openLoadProjectModal() {
      const {
        state, showModal, updateUI, showToast,
        updateSaveStatusIndicator, canUseDevAuth,
      } = App;
      const supabase = App.getSupabase();
      const listEl = document.getElementById('loadProjectList');
      const emptyEl = document.getElementById('loadProjectEmpty');
      const filtersBarInit = document.getElementById('loadProjectFilters');
      if (filtersBarInit) filtersBarInit.style.display = 'none';
      listEl.innerHTML = '';
      emptyEl.style.display = 'none';
      try {
        if (!supabase) {
          listEl.innerHTML = '<p style="color:var(--red);">Cloud not configured.</p>';
          showModal('loadProjectModal');
          return;
        }
        let user = state.supabaseSession?.user;
        if (!user) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            state.supabaseSession = session;
            user = session?.user;
          } catch (e) {
            if (e?.name === 'AuthApiError' || (e?.message && (e.message.includes('Refresh Token') || e.message.includes('refresh_token')))) {
              await supabase.auth.signOut();
              state.supabaseSession = null;
            }
          }
          updateUI();
          updateSaveStatusIndicator();
        }
        if (!user) {
          const authDevBypassWrapEl = document.getElementById('authDevBypassWrap');
          if (authDevBypassWrapEl) authDevBypassWrapEl.style.display = canUseDevAuth() ? 'block' : 'none';
          showModal('authModal');
          return;
        }
        const { data: projects, error } = await supabase.rpc('list_accessible_projects');
        if (error) {
          listEl.innerHTML = '<p style="color:var(--red);">Failed to load projects.</p>';
          showModal('loadProjectModal');
          return;
        }
        if (!projects || projects.length === 0) {
          const filtersBarEmpty = document.getElementById('loadProjectFilters');
          if (filtersBarEmpty) filtersBarEmpty.style.display = 'none';
          emptyEl.style.display = 'block';
          showModal('loadProjectModal');
          return;
        }
        const projectsAll = projects;
        const lp = {
          projectsAll,
          listEl,
          emptyEl,
          accessCache: Object.create(null),
        };
        const filtersBarEl = document.getElementById('loadProjectFilters');
        if (filtersBarEl) {
          filtersBarEl.style.display = 'flex';
          const ownEl2 = document.getElementById('loadProjectFilterOwnership');
          const roleEl2 = document.getElementById('loadProjectFilterRole');
          const searchEl2 = document.getElementById('loadProjectFilterSearch');
          const ownerWrap2 = document.getElementById('loadProjectFilterOwnerWrap');
          const ownerEmailSel2 = document.getElementById('loadProjectFilterOwnerEmail');
          if (ownEl2) ownEl2.value = '';
          if (roleEl2) roleEl2.value = '';
          if (searchEl2) searchEl2.value = '';
          let ownerEmailsUnique = [];
          if (state.isAdmin || state.isOverseer) {
            const seenO = Object.create(null);
            for (let ei = 0; ei < projectsAll.length; ei++) {
              const emo = projectsAll[ei].owner_email;
              if (emo && !seenO[emo]) { seenO[emo] = true; ownerEmailsUnique.push(emo); }
            }
            ownerEmailsUnique.sort();
          }
          if (ownerWrap2) ownerWrap2.style.display = ((state.isAdmin || state.isOverseer) && ownerEmailsUnique.length > 1) ? 'inline-flex' : 'none';
          if (ownerEmailSel2) {
            ownerEmailSel2.innerHTML = '<option value="">All owners</option>';
            if (state.isAdmin || state.isOverseer) {
              for (let ej = 0; ej < ownerEmailsUnique.length; ej++) {
                const opto = document.createElement('option');
                opto.value = ownerEmailsUnique[ej];
                opto.textContent = App.twinEmailText ? App.twinEmailText(ownerEmailsUnique[ej]) : ownerEmailsUnique[ej];
                ownerEmailSel2.appendChild(opto);
              }
            }
          }
          const onFilterChange = function () { void renderLoadProjectListRows(lp); };
          if (ownEl2) ownEl2.onchange = onFilterChange;
          if (roleEl2) roleEl2.onchange = onFilterChange;
          if (ownerEmailSel2) ownerEmailSel2.onchange = onFilterChange;
          if (searchEl2) searchEl2.oninput = onFilterChange;
          const filtersExtraEl = document.getElementById('loadProjectFiltersExtra');
          const filtersToggleBtn = document.getElementById('loadProjectFiltersToggle');
          if (filtersExtraEl && filtersToggleBtn) {
            function applyLoadProjectFiltersPanelExpanded(isExp) {
              if (isExp) {
                filtersExtraEl.removeAttribute('hidden');
                filtersToggleBtn.setAttribute('aria-expanded', 'true');
              } else {
                filtersExtraEl.setAttribute('hidden', '');
                filtersToggleBtn.setAttribute('aria-expanded', 'false');
              }
            }
            let expandedDefault;
            try {
              const stored = localStorage.getItem('loadProjectFiltersExpanded');
              if (stored === 'true') expandedDefault = true;
              else if (stored === 'false') expandedDefault = false;
              else expandedDefault = !window.matchMedia('(max-width: 768px)').matches;
            } catch (_) {
              expandedDefault = !window.matchMedia('(max-width: 768px)').matches;
            }
            applyLoadProjectFiltersPanelExpanded(expandedDefault);
            filtersToggleBtn.onclick = function (e) {
              e.preventDefault();
              e.stopPropagation();
              const expand = filtersExtraEl.hasAttribute('hidden');
              applyLoadProjectFiltersPanelExpanded(expand);
              try { localStorage.setItem('loadProjectFiltersExpanded', expand ? 'true' : 'false'); } catch (_) {}
            };
          }
        }
        // Advanced toggle (admin-only): shows/hides every row's "Who has access"
        // block (.load-project-admin-access) via a class on the list. Default OFF
        // -> hidden. Set before the render so there is no flash.
        const advWrap = document.getElementById('loadProjectAdvancedWrap');
        const advBtn = document.getElementById('loadProjectAdvancedToggle');
        if (advWrap) advWrap.style.display = state.isAdmin ? '' : 'none';
        if (advBtn) {
          const advanced = state.isAdmin && localStorage.getItem('loadProjectAdvanced') === 'true';
          advBtn.setAttribute('aria-pressed', advanced ? 'true' : 'false');
          listEl.classList.toggle('hide-access', !advanced);
          advBtn.onclick = () => {
            const on = advBtn.getAttribute('aria-pressed') !== 'true';
            advBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
            listEl.classList.toggle('hide-access', !on);
            try { localStorage.setItem('loadProjectAdvanced', on ? 'true' : 'false'); } catch (_) {}
          };
        }
        await renderLoadProjectListRows(lp);
      } catch (e) {
        console.error('[Load Project]', e);
        listEl.innerHTML = '<p style="color:var(--red);">Failed to load projects: ' + (e?.message || 'Unknown error') + '</p>';
        showModal('loadProjectModal');
        showToast('Failed to load projects: ' + (e?.message || 'Unknown error'));
      }
    }

  App.openLoadProjectModal = openLoadProjectModal;
  App.loadCloudProjectRow = loadCloudProjectRow;
})();

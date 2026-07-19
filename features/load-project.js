(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Load Project modal (cloud project browser) -- extracted from app.js via the
  // window.App registry. Deps are read from App; the supabase client is re-read
  // via App.getSupabase() in the outer function and in each nested async helper
  // because it can be recycled. The save-before-load gate
  // (openLoadProjectModalOrPromptSave) and the #loadProject* bindings stay in
  // app.js and call App.openLoadProjectModal().
  async function openLoadProjectModal() {
      const {
        state, showModal, hideModal, updateUI, showToast, sanitizeForFilename,
        updateSaveStatusIndicator, canUseDevAuth, deleteProjectAsOwner,
        openCopyProjectModalOrPromptSave, hydrateProjectFromCloudRow,
        clearCheckoutExpiredAttention, saveUserCustomIcons,
        reconcileOrphanedCountersAndLineTypes, clearUndoStacks,
        subscribeToProjectCheckoutChanges, checkInCurrentProjectIfHeld,
        takeoffBackupGet, resolvePdfBufferForCloudProject, ensureGroupColors,
        openCanvasOnlyNeedsPdfModal, buildPagesFromPdfArrayBufferAndProjectData,
        backupDataToProjFormat, fitZoom, SUPABASE_URL,
        setAutoSaveDirty, setLastModifiedAt, setLastLocalBackupAt, setLastSaveIncludedPdf,
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
        const formatSizeMb = function (bytes) {
          if (bytes == null || bytes < 0) return '';
          const mb = bytes / (1024 * 1024);
          return mb < 0.01 ? (bytes / 1024).toFixed(2) + ' KB' : mb.toFixed(2) + ' MB';
        };
        const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const loadProjectAccessCache = Object.create(null);
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
        async function fetchLoadProjectAccessIntoPanel(accessPanel, proj) {
          const supabase = App.getSupabase();
          if (loadProjectAccessCache[proj.id]) {
            fillLoadProjectAccessPanel(accessPanel, loadProjectAccessCache[proj.id], esc);
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
              showToast(error.message || 'Could not load access list.', 4000);
              return;
            }
            loadProjectAccessCache[proj.id] = data || [];
            fillLoadProjectAccessPanel(accessPanel, loadProjectAccessCache[proj.id], esc);
          } catch (err) {
            accessPanel.innerHTML = '<div class="load-project-access-error" style="color:var(--red);">' + esc(err.message || 'Failed') + '</div>';
            showToast(err.message || 'Could not load access list.', 4000);
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
              showToast(error.message || 'Could not load users for invite.', 4000);
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
            showToast(err.message || 'Could not load users for invite.', 4000);
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
        function getFilteredLoadProjects() {
          let filtered = projectsAll.slice();
          const ownEl = document.getElementById('loadProjectFilterOwnership');
          const roleEl = document.getElementById('loadProjectFilterRole');
          const ownerEl = document.getElementById('loadProjectFilterOwnerEmail');
          const searchEl = document.getElementById('loadProjectFilterSearch');
          if (ownEl && ownEl.value === 'mine') filtered = filtered.filter(function (p) { return p.is_owner; });
          else if (ownEl && ownEl.value === 'shared') filtered = filtered.filter(function (p) { return !p.is_owner; });
          if (roleEl && roleEl.value) filtered = filtered.filter(function (p) { return (p.my_access_role || '') === roleEl.value; });
          if (state.isAdmin && ownerEl && ownerEl.value) filtered = filtered.filter(function (p) { return (p.owner_email || '') === ownerEl.value; });
          if (searchEl) {
            const q = (searchEl.value || '').trim().toLowerCase();
            if (q) filtered = filtered.filter(function (p) { return (p.name || 'Untitled').toLowerCase().indexOf(q) !== -1; });
          }
          return filtered;
        }
        async function renderLoadProjectListRows() {
          const supabase = App.getSupabase();
          listEl.innerHTML = '';
          const filtered = getFilteredLoadProjects();
          if (filtered.length === 0) {
            listEl.innerHTML = '<p class="load-project-no-match" style="color:var(--text2);margin:0;">No projects match filters.</p>';
            showModal('loadProjectModal');
            return;
          }
          let loadProjectInProgress = false;
          for (let i = 0; i < filtered.length; i++) {
            const proj = filtered[i];
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
          const div = document.createElement('div');
          div.className = 'load-project-item';
          const date = proj.updated_at ? new Date(proj.updated_at).toLocaleString() : '';
          const sizeStr = formatSizeMb(sizeBytes);
          const canvasOnlyBadge = !proj.pdf_path ? '<button type="button" class="badge load-project-canvas-download" title="Download canvas (.json)" aria-label="Download canvas">Canvas only</button>' : '';
          const countsBadge = (proj.counter_count != null || proj.line_count != null) && (proj.counter_count > 0 || proj.line_count > 0)
            ? '<span class="badge" style="background:var(--surface2);color:var(--text2);font-size:11px;">' + [proj.counter_count > 0 ? (proj.counter_count + ' cnt') : null, proj.line_count > 0 ? (proj.line_count + ' ln') : null].filter(Boolean).join(' · ') + '</span>'
            : '';
          let lockBadge = '';
          if (proj.can_edit) lockBadge = ' <span class="badge" style="background:var(--green);color:var(--bg);font-size:11px;">You\'re editing</span>';
          else if (proj.checked_out_email) lockBadge = ' <span class="badge" style="background:var(--yellow);color:var(--bg);font-size:11px;">Locked by ' + esc(proj.checked_out_email) + '</span>';
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
          div.innerHTML = '<div class="load-project-row-main">' +
            '<div class="load-project-info"><span class="load-project-name">' + esc(proj.name || 'Untitled') + '</span><div class="load-project-meta">' + meta + '</div></div>' +
            actionsHtml + '</div>' + adminAccessHtml;
          const deleteBtn = div.querySelector('.load-project-delete');
          if (deleteBtn) {
            deleteBtn.onclick = async (e) => {
              e.stopPropagation();
              if (!confirm('Delete "' + (proj.name || 'Untitled') + '" from cloud? This cannot be undone.')) return;
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
                  void renderLoadProjectListRows();
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
                showToast(err?.message || 'Failed to delete project', 4000);
              }
            };
          }
          const canvasDlBtn = div.querySelector('.load-project-canvas-download');
          if (canvasDlBtn) {
            canvasDlBtn.onclick = async (e) => {
              e.stopPropagation();
              e.preventDefault();
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
              openCopyProjectModalOrPromptSave(proj);
            };
          }
          if (state.isAdmin) {
            const toggleBtn = div.querySelector('.load-project-access-toggle');
            const accessPanel = div.querySelector('.load-project-access-panel');
            const addWrap = div.querySelector('.load-project-access-add-wrap');
            if (addWrap) {
              addWrap.addEventListener('click', function (e) { e.stopPropagation(); });
            }
            if (toggleBtn && accessPanel) {
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
                await fetchLoadProjectAccessIntoPanel(accessPanel, proj);
              };
              const addBtn = div.querySelector('.load-project-access-add-btn');
              const userSelect = div.querySelector('.load-project-access-user-select');
              const roleSel = div.querySelector('.load-project-access-role-select');
              const addErrEl = div.querySelector('.load-project-access-add-error');
              if (addBtn && userSelect && roleSel) {
                addBtn.onclick = async function (e) {
                  e.stopPropagation();
                  e.preventDefault();
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
                  if (!supabase) {
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
                      delete loadProjectAccessCache[proj.id];
                      userSelect.value = '';
                      await fetchLoadProjectAccessIntoPanel(accessPanel, proj);
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
              void fetchLoadProjectAccessIntoPanel(accessPanel, proj);
              if (userSelect) void populateLoadProjectUserSelect(userSelect, proj);
            }
          }
          const rowMain = div.querySelector('.load-project-row-main');
          const loadRowClick = async () => {
          if (loadProjectInProgress) return;
          loadProjectInProgress = true;
          div.classList.add('loading');
          listEl.classList.add('loading');
          const metaEl = div.querySelector('.load-project-meta');
          const origMeta = metaEl ? metaEl.textContent : '';
          if (metaEl) metaEl.textContent = 'Loading…';
          try {
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
                  if (d.iconNames && typeof d.iconNames === 'object') state.iconNames = d.iconNames;
                  if (Array.isArray(d.iconOrder)) state.iconOrder = d.iconOrder;
                  if (Array.isArray(d.customIconPaths)) saveUserCustomIcons(d.customIconPaths);
                  if (d.legendSettings) state.legendSettings = { ...App.state.legendSettings, ...d.legendSettings };
                  if (d.multiplyZoneSettings) state.multiplyZoneSettings = { ...App.state.multiplyZoneSettings, ...d.multiplyZoneSettings };
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
                  hideModal('loadProjectModal');
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
              listEl.innerHTML = '<p style="color:var(--red);">Failed to load PDF: ' + (e.message || 'Unknown error') + '</p>';
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
          hideModal('loadProjectModal');
          state.sidebarReorderModeActive = false;
          if (!proj.pdf_path) {
            // C1: Replaced the toast + auto-pdfInput.click() pair with a
            // dedicated modal so the user has a clear next action.
            openCanvasOnlyNeedsPdfModal({ reason: 'no_pdf_stored' });
          }
          fitZoom();
          updateUI();
          } finally {
            loadProjectInProgress = false;
            div.classList.remove('loading');
            listEl.classList.remove('loading');
            if (metaEl) metaEl.textContent = origMeta;
          }
        };
          if (rowMain) rowMain.onclick = loadRowClick;
          listEl.appendChild(div);
        }
        showModal('loadProjectModal');
        }
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
          if (state.isAdmin) {
            const seenO = Object.create(null);
            for (let ei = 0; ei < projectsAll.length; ei++) {
              const emo = projectsAll[ei].owner_email;
              if (emo && !seenO[emo]) { seenO[emo] = true; ownerEmailsUnique.push(emo); }
            }
            ownerEmailsUnique.sort();
          }
          if (ownerWrap2) ownerWrap2.style.display = (state.isAdmin && ownerEmailsUnique.length > 1) ? 'inline-flex' : 'none';
          if (ownerEmailSel2) {
            ownerEmailSel2.innerHTML = '<option value="">All owners</option>';
            if (state.isAdmin) {
              for (let ej = 0; ej < ownerEmailsUnique.length; ej++) {
                const opto = document.createElement('option');
                opto.value = ownerEmailsUnique[ej];
                opto.textContent = ownerEmailsUnique[ej];
                ownerEmailSel2.appendChild(opto);
              }
            }
          }
          const onFilterChange = function () { void renderLoadProjectListRows(); };
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
        await renderLoadProjectListRows();
      } catch (e) {
        console.error('[Load Project]', e);
        listEl.innerHTML = '<p style="color:var(--red);">Failed to load projects: ' + (e?.message || 'Unknown error') + '</p>';
        showModal('loadProjectModal');
        showToast('Failed to load projects: ' + (e?.message || 'Unknown error'));
      }
    }

  App.openLoadProjectModal = openLoadProjectModal;

  // --- Copy/fork domain + save-before-load gate (registry split #35) -------
  // Moved from app.js: the copy-project modal openers + confirm binding, the
  // cloud hydrate/fork cluster, and the save-before-load modal. This file
  // owns pendingCopyProject / copyProjectModalTarget now; app.js reaches
  // them via the accessors registered at the bottom.
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
  async function buildPagesFromPdfArrayBufferAndProjectData(buf, d, useIdbBackup, idbBackup) {
    const bufPdf = buf.slice(0);
    const bufStorage = buf.slice(0);
    const pdf = await pdfjsLib.getDocument(bufPdf).promise;
    App.clearPdfBitmapCache();
    App.state.pages = [];
    const numPages = pdf.numPages;
    for (let i = 0; i < numPages; i++) {
      const pdfPage = await pdf.getPage(i + 1);
      const label = numPages > 1 ? ('document.pdf — p' + (i + 1)) : 'document.pdf';
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
      if (d.iconNames && typeof d.iconNames === 'object') App.state.iconNames = d.iconNames;
      if (Array.isArray(d.iconOrder)) App.state.iconOrder = d.iconOrder;
      if (Array.isArray(d.customIconPaths)) App.saveUserCustomIcons(d.customIconPaths);
      (d.pages || []).forEach(function (p) {
        App.applyPageAnnotationsFromData(App.state.pages[p.index], p);
      });
      if (d.activeCanvasIdByPage && typeof d.activeCanvasIdByPage === 'object') App.state.activeCanvasIdByPage = d.activeCanvasIdByPage;
      if (d.pageScales) {
        d.pageScales.forEach(function (scale, i) { if (App.state.pages[i]) App.state.pages[i].scale = scale; });
      } else if (d.scale) {
        App.state.pages.forEach(function (p) { p.scale = d.scale; });
      }
      App.state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
      if (d.legendSettings) App.state.legendSettings = { ...App.state.legendSettings, ...d.legendSettings };
      if (d.multiplyZoneSettings) App.state.multiplyZoneSettings = { ...App.state.multiplyZoneSettings, ...d.multiplyZoneSettings };
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
      const bufStorage = await buildPagesFromPdfArrayBufferAndProjectData(buf, d, useIdbBackup, idbBackup);
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

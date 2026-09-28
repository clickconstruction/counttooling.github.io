(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/project-settings.js - the Project Settings modal (#settingsModal),
   * extracted from app.js per the lines-list recipe (R23, 2026-09-26).
   *
   * Owns: the two doors (the header gear #settingsGearBtn and the phone's
   * sidebar-logo gear #sidebarLogoGear) through one openProjectSettings, the
   * header Hide marks eye, the footer Help fold (setSettingsHelpOpen), the
   * per-project rows (trade, codes and jurisdiction, occupancy, ceiling and
   * make-up, the Use groups switch) with syncProjectSettingsRows, the
   * per-project Groups gate (groupsUiVisible / turnOnGroups), the local rows
   * (Add pages, Download PDF, Macros, Clear page, Advanced: Load test PDF,
   * Export, Import, Canvas Repair, Empty cache) and closeProject behind
   * Close project. All of it is bound at load and works with Supabase off
   * (MAP-NOSUPA put it outside app.js's SUPABASE_ENABLED block; this file keeps
   * it there).
   *
   * The cloud rows stay in app.js's SUPABASE_ENABLED block with their own gates:
   * the checkout strip (updateSettingsCheckoutSection, reached here through
   * App.updateSettingsCheckoutSection only when App.SUPABASE_ENABLED), Share,
   * Load, Manage and the admin reload. Their show / hide rows that sit in
   * updateUI's SUPABASE_ENABLED branch (Manage, Bid review, the admin reload)
   * stay there too, after the .supabase-only reset they depend on.
   *
   * App.syncProjectSettingsChrome is the settings-row slice of updateUI: which
   * rows show for this session (Close project, Add pages, Download PDF, the
   * Sheets row, Share, Save, Advanced and its rows, the Use groups switch).
   * app.js calls it guarded right after the SUPABASE_ENABLED show / hide pass,
   * so a row it sets is never reset by the .supabase-only pass behind it. A
   * boot-time updateUI before this file loads skips it; the next one heals.
   *
   * The name line under the title is the rename control (renameProject is the one
   * writer; App.openProjectRename is the bid chip menu's door to it).
   *
   * Registered: App.renameProject, App.openProjectRename, App.canRenameProject,
   * App.syncProjectSettingsRows, App.syncProjectSettingsChrome,
   * App.groupsUiVisible, App.turnOnGroups and App.closeProject (bid-check.js,
   * duct-tool.js, the courses, lessons.js, tutorial.js, tour-blank.js,
   * turn-in.js and output.js read these names, and the specs drive them).
   * Boundary rule: read shared deps from App.* at call time, never captured at
   * load. See ARCHITECTURE.md "Feature files / window.App registry".
   */

  // Null-guarded binding: a stale shell paired with fresh JS must cost one dead
  // button, never the rest of this file's bindings.
  const bindClick = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };

  // Per-project Groups gate: the UI (sidebar section + Assign-to-Group
  // menus) shows when the project opted in OR already contains groups.
  // "No groups anywhere" is the default off state — nothing to migrate.
  function groupsUiVisible() {
    const state = App.state;
    return !!state.groupsEnabled || (state.groups || []).length > 0;
  }
  // D17 (J19 #1): the duct surfaces that name Groups turn them on in place —
  // flips the gate, expands the sidebar section, re-renders. Returns true when
  // the gate was actually off (the callers' toast decision). No-op when on.
  function turnOnGroups() {
    if (groupsUiVisible()) return false;
    const state = App.state;
    state.groupsEnabled = true;
    state.groupsListCollapsed = false;
    const sec = document.getElementById('groupsSection');
    if (sec) sec.classList.remove('collapsed');
    const icon = document.getElementById('groupsCollapseIcon');
    if (icon) icon.textContent = '▼';
    App.markProjectDirty();
    App.updateUI();
    return true;
  }
  const settingsUseGroupsBtn = document.getElementById('settingsUseGroupsBtn');
  if (settingsUseGroupsBtn) {
    settingsUseGroupsBtn.onclick = () => {
      const state = App.state;
      if ((state.groups || []).length > 0) return; // locked on while groups exist
      // On goes through turnOnGroups, which also opens the sidebar section: a GROUPS heading
      // left collapsed at the foot of the sidebar hid the + Add the next move needs (by hand, 2026-09-25).
      if (!state.groupsEnabled) { turnOnGroups(); return; }
      state.groupsEnabled = false;
      App.markProjectDirty();
      App.updateUI();
    };
  }

  // S1/S2 Project Settings rows: trade (explicit, per project) and the
  // vertical-by-default figures. Synced on every open by syncProjectSettingsRows.
  function syncProjectSettingsRows() {
    const state = App.state;
    syncTradeSegment('settingsTradeSegment', state.trade);
    // Codes & jurisdiction (rulebook slice 4)
    const codes = App.getProjectCodes();
    TRADES.forEach((t) => {
      const sel = document.getElementById('settingsCode' + t.charAt(0).toUpperCase() + t.slice(1));
      if (!sel) return;
      if (!sel.options.length) CODE_EDITIONS[t].forEach((e) => { const o = document.createElement('option'); o.value = e; o.textContent = e; sel.appendChild(o); });
      if (codes[t] && ![...sel.options].some((o) => o.value === codes[t])) { const o = document.createElement('option'); o.value = codes[t]; o.textContent = codes[t]; sel.appendChild(o); }
      sel.value = codes[t] || '';
    });
    const jEl = document.getElementById('settingsJurisdiction');
    if (jEl) jEl.value = codes.jurisdiction || '';
    syncOccupancySegment(codes.occupancy);
    const ceilEl = document.getElementById('settingsCeilingHeight');
    if (ceilEl) ceilEl.value = state.ceilingHeightFt != null ? App.formatFeetInchesFromVal(state.ceilingHeightFt, 'ft') : '';
    const muEl = document.getElementById('settingsMakeUp');
    if (muEl) muEl.value = state.makeUpFt != null ? App.formatFeetInchesFromVal(state.makeUpFt, 'ft') : '';
    // Quick keys: the first three bindings as "1 WC · 2 Lav · 3 FD · +4"; empty when none.
    const qkEl = document.getElementById('settingsQuickKeysSummary');
    if (qkEl) {
      const labels = App.getQuickKeyLabels ? App.getQuickKeyLabels() : {};
      const slots = Object.keys(labels);
      const shown = slots.slice(0, 3).map((k) => k + ' ' + labels[k]);
      if (slots.length > 3) shown.push('+' + (slots.length - 3));
      qkEl.textContent = shown.join(' · ');
    }
  }
  function syncTradeSegment(segmentId, trade) {
    const seg = document.getElementById(segmentId);
    if (!seg) return;
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.trade === trade)));
  }
  // Occupancy (WATER-PLAN rung 1): the fixture-unit column the project reads,
  // public by default on a commercial bid. Rides state.codes like the editions.
  function syncOccupancySegment(occupancy) {
    const btn = document.getElementById('settingsOccupancyFlip');
    if (!btn) return;
    btn.textContent = occupancy === 'private' ? 'private' : 'public';
    btn.dataset.occupancy = occupancy === 'private' ? 'private' : 'public';
  }
  document.getElementById('settingsOccupancyFlip')?.addEventListener('click', () => {
    const next = App.getProjectCodes().occupancy === 'private' ? 'public' : 'private';
    App.setProjectCodes({ occupancy: next }, { route: 'settings' });
    syncOccupancySegment(App.getProjectCodes().occupancy);
  });
  document.getElementById('settingsTradeSegment')?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-trade]');
    if (!b) return;
    // Clicking the pressed trade clears it back to "not chosen" (plumbing behavior).
    App.setProjectTrade(b.getAttribute('aria-pressed') === 'true' ? null : b.dataset.trade, { route: 'settings' });
    syncTradeSegment('settingsTradeSegment', App.state.trade);
  });
  TRADES.forEach((t) => {
    document.getElementById('settingsCode' + t.charAt(0).toUpperCase() + t.slice(1))?.addEventListener('change', (e) => App.setProjectCodes({ [t]: e.target.value }, { route: 'settings' }));
  });
  const jurisdictionEl = document.getElementById('settingsJurisdiction');
  if (jurisdictionEl) {
    jurisdictionEl.addEventListener('change', () => App.setProjectCodes({ jurisdiction: jurisdictionEl.value }, { route: 'settings' }));
    jurisdictionEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jurisdictionEl.blur(); } });
  }
  const commitCeilingFields = () => {
    const state = App.state;
    const ceilEl = document.getElementById('settingsCeilingHeight');
    const muEl = document.getElementById('settingsMakeUp');
    const ceil = ceilEl ? App.parseRealWorldLength(ceilEl.value, 'ft') : null;
    const mu = muEl ? App.parseRealWorldLength(muEl.value, 'ft') : null;
    const nextCeil = ceil != null && ceil > 0 ? Math.round(ceil * 100) / 100 : null;
    const nextMu = mu != null && mu >= 0 ? Math.round(mu * 100) / 100 : null;
    if (nextCeil !== state.ceilingHeightFt || nextMu !== state.makeUpFt) {
      state.ceilingHeightFt = nextCeil;
      state.makeUpFt = nextMu;
      App.markProjectDirty();
      App.logUserEvent('ceiling_set', state.currentProjectId || null, { ceilingFt: nextCeil, makeUpFt: nextMu });
    }
    syncProjectSettingsRows();
  };
  ['settingsCeilingHeight', 'settingsMakeUp'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', commitCeilingFields);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  });

  // Project Settings has two doors -- the desktop header gear and the mobile
  // sidebar-logo gear -- so they open through one function and can't drift
  // apart on auth or title. No sign-in gate here:
  // the modal is mostly local work (add PDF pages, Close Project, quick keys,
  // Advanced -> Export / Import / Canvas Repair), and the
  // cloud rows inside prompt for sign-in themselves.
  function setSettingsHelpOpen(open) {
    const toggle = document.getElementById('settingsHelpToggle');
    const links = document.getElementById('settingsHelpLinks');
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    if (links) links.hidden = !open;
  }
  // Rename (reported 2026-09-28: "I am not finding where to rename a project under project
  // settings"). The name had one door, the name field inside the Save dialog, which nothing
  // on this card pointed at. Now the name line is the control: the name, then Rename, which
  // turns the name into a field in place. The new name rides the next save like any other
  // edit (the autosave's update writes `name`), so nothing here talks to the cloud.
  const PROJECT_NAME_MAX = 120;
  const projectOpen = () => !!(App.state.pages.length || App.state.currentProjectId);
  // A sample set is found by its name (tutorial.js TEACHING_SETS): a tour or lesson resets
  // a project that carries one, so a set keeps its name and no project may take one.
  const isSampleName = (name) => !!(App.tourKit && App.tourKit.isTeachingSet && App.tourKit.isTeachingSet(name));
  // null = Rename is not offered; 'checkout' = offered, and the click says to check out first.
  function renameOffer() {
    const state = App.state;
    if (!projectOpen() || state.loadedViaViewLink || isSampleName(state.currentProjectName)) return null;
    if (state.isViewer) return state.canCheckOut ? 'checkout' : null;
    return 'rename';
  }
  // The one writer. Returns { ok, name } or { ok: false, reason }.
  function renameProject(raw, opts) {
    const state = App.state;
    const name = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, PROJECT_NAME_MAX).trim();
    if (renameOffer() !== 'rename') return { ok: false, reason: 'locked' };
    if (!name) return { ok: false, reason: 'empty' };
    if (isSampleName(name)) {
      App.showToast('That name belongs to a sample plan. Pick another.', 4000);
      return { ok: false, reason: 'reserved' };
    }
    const before = state.currentProjectName || 'Untitled';
    if (name === before) return { ok: true, name, changed: false };
    state.currentProjectName = name;
    App.markProjectDirty();
    App.updateUI();
    syncNameLine();
    if (!(opts && opts.quiet)) App.showToast('Renamed to \u201c' + name + '\u201d.', 3000);
    return { ok: true, name, changed: true };
  }
  const nameEls = () => ({
    line: document.getElementById('settingsNameLine'),
    sub: document.getElementById('settingsSubtitle'),
    link: document.getElementById('settingsRenameProject'),
    edit: document.getElementById('settingsRenameEdit'),
    input: document.getElementById('settingsRenameInput'),
  });
  // The title stays "Project Settings"; the project name is the subtitle line under it
  // (a long bid-set name used to wrap the title onto two lines).
  function syncNameLine() {
    const { line, sub, link, edit } = nameEls();
    if (!sub) return;
    const open = projectOpen();
    const name = App.state.currentProjectName || 'Untitled';
    if (edit) edit.hidden = true;
    sub.textContent = open ? name : '';
    sub.title = open ? name : '';
    sub.style.display = open ? '' : 'none';
    if (line) line.style.display = open ? '' : 'none';
    if (link) {
      const offer = renameOffer();
      link.style.display = offer ? '' : 'none';
      // A bid nobody named yet is asked for its name; one that has a name is renamed.
      link.textContent = (App.state.currentProjectName || 'Untitled') === 'Untitled' ? 'Name this project' : 'Rename';
    }
  }
  function startProjectRename() {
    const { sub, link, edit, input } = nameEls();
    if (!sub || !edit || !input) return;
    const offer = renameOffer();
    if (offer === 'checkout') { App.showToast('Check out the project to rename it.', 4000); return; }
    if (offer !== 'rename') return;
    const current = App.state.currentProjectName || 'Untitled';
    input.value = current === 'Untitled' ? '' : current;
    sub.style.display = 'none';
    if (link) link.style.display = 'none';
    edit.hidden = false;
    input.focus();
    input.select();
  }
  function endProjectRename(keep) {
    const { edit, input } = nameEls();
    if (!edit || !input || edit.hidden) return;
    const value = input.value;
    edit.hidden = true;   // first: the blur this causes must find the edit already over
    if (keep) renameProject(value);
    syncNameLine();
  }
  bindClick('settingsRenameProject', startProjectRename);
  // Save: the field's blur has kept the name by the time this click lands; the
  // handler is for a press that reaches the button with the field never focused.
  bindClick('settingsRenameSave', () => endProjectRename(true));
  (function bindRenameInput() {
    const input = document.getElementById('settingsRenameInput');
    if (!input) return;
    input.addEventListener('blur', () => endProjectRename(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); endProjectRename(true); }
      // Esc ends the edit and stops there: the ladder (features/esc-ladder.js) would close the dialog.
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endProjectRename(false); }
    });
  })();
  // The second door (the header bid chip's menu): Project Settings, with the name already a field.
  function openProjectRename() {
    openProjectSettings();
    startProjectRename();
  }

  function openProjectSettings() {
    setSettingsHelpOpen(false);
    syncNameLine();
    document.body.classList.remove('sidebar-open');
    // Declared inside app.js's SUPABASE_ENABLED block (it hides the section itself when off).
    if (App.SUPABASE_ENABLED && App.updateSettingsCheckoutSection) App.updateSettingsCheckoutSection();
    syncProjectSettingsRows();
    App.showModal('settingsModal');
  }
  bindClick('settingsGearBtn', openProjectSettings);
  bindClick('sidebarLogoGear', openProjectSettings);
  // The header Hide marks eye: bound here so it works with Supabase off (MAP-NOSUPA);
  // toggleHideMarks and the eye's drawing (updateHideMarksButton) stay in app.js.
  bindClick('hideMarksBtn', () => App.toggleHideMarks());
  bindClick('settingsAddAdditionalPages', async () => {
    const state = App.state;
    // #7b: Route through Prepare PDF in append mode. We need the current
    // project's PDF buffer in memory so the commit step can merge the new
    // pages onto it; recover from pdfCache when needed.
    App.hideModal('settingsModal');
    if (!state.pdfBuffer && state.currentProjectId && state.pdfHash) {
      try {
        const blob = await pdfCacheGet(state.currentProjectId, state.pdfHash);
        if (blob && blob.size > 0) {
          const ab = await blob.arrayBuffer();
          state.pdfBuffer = ab;
          state.pdfBufferSize = ab.byteLength;
        }
      } catch (_) {}
    }
    if (!state.pdfBuffer) {
      App.showToast('Could not load the current PDF to merge new pages. Save the project, then try again.', 5000);
      return;
    }
    App.setPendingAddAdditionalPages(true);
    document.getElementById('pdfInput').click();
  });
  bindClick('settingsDownloadPdf', async () => { App.hideModal('settingsModal'); await App.downloadProjectPdf(); });
  bindClick('settingsAdvancedBtn', () => { const d = document.getElementById('settingsAdvancedSection'); d.open = !d.open; if (d.open) d.scrollIntoView({ block: 'nearest' }); });
  // Footer Help row: the shortcuts / tours / sample-plan links unfold under the footer;
  // folded again every time the modal opens (openProjectSettings).
  const settingsHelpToggle = document.getElementById('settingsHelpToggle');
  if (settingsHelpToggle) settingsHelpToggle.onclick = () => setSettingsHelpOpen(settingsHelpToggle.getAttribute('aria-expanded') !== 'true');
  bindClick('settingsMacros', () => { App.hideModal('settingsModal'); App.showModal('macrosModal'); });
  bindClick('settingsClearPage', () => { App.hideModal('settingsModal'); App.showClearPageModal(); });
  bindClick('advancedLoadTestPdf', async () => { App.hideModal('settingsModal'); await App.loadTestPdf(); });
  bindClick('advancedExport', () => { App.hideModal('settingsModal'); document.getElementById('exportBtn').click(); });
  bindClick('advancedImport', () => { App.hideModal('settingsModal'); document.getElementById('importBtn').click(); });
  bindClick('advancedCanvasRepair', () => { App.hideModal('settingsModal'); App.openCanvasRepairModal(); });
  bindClick('advancedEmptyCacheReload', async () => {
    if (!(await App.confirmDialog({ title: 'Clear cached data and reload?', body: 'Clears IndexedDB and localStorage on this device and reloads. Unsaved work will be lost.', confirmLabel: 'Clear and reload', danger: true }))) return;
    App.hideModal('settingsModal');
    try {
      indexedDB.deleteDatabase('clickcount-pdf-cache');
    } catch (_) {}
    const keysToRemove = ['clickcount-last-project', 'recentBids', 'clickcount-save-error', 'takeoff-state', 'lineModifiers', 'plumbingModifiers', 'groupColorDisplay', 'pagesTitlesTruncated', 'hideUnmarkedPagesFromSidebar', 'counterSearch', 'lineTypeSearch', 'linesSearch', 'linesTypeExpanded', 'counterSidebarFilterScope', 'lineTypeSidebarFilterScope', 'counterSettings', 'lineTypeSettings', 'stripPins', 'zoomSettings', 'specificPagesIncludeReport', 'customIconPaths'];
    for (const k of keysToRemove) { try { localStorage.removeItem(k); } catch (_) {} }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('view:allowed:')) { try { localStorage.removeItem(k); } catch (_) {} }
    }
    location.reload();
  });

  // Close project: ONE routine behind every door — Project Settings, the
  // header cloud menu, the "Project turned in." toast and the admin
  // force-turn-in notice (Wendi, 2026-09-10: "I just refresh after I turn
  // things in"). Confirms only when there is something to lose: unsaved
  // edits, or a takeoff that lives on this device alone — a turned-in
  // project is already saved and closes on the click.
  async function closeProject(opts) {
    const state = App.state;
    opts = opts || {};
    const unsaved = App.getAutoSaveDirty ? !!App.getAutoSaveDirty() : true;
    const localOnly = !state.currentProjectId;
    if (state.pages.length > 0 && (unsaved || localOnly) && !(await App.confirmDialog({ title: 'Close project?', body: 'Any unsaved changes will be lost.', confirmLabel: 'Close project', danger: true }))) return false;
    App.logUserEvent('project_close', state.currentProjectId || null, { route: opts.route || 'settings' });
    // Block-scoped in app.js's SUPABASE_ENABLED block, published there; absent with Supabase off.
    if (App.checkInCurrentProjectIfHeld) await App.checkInCurrentProjectIfHeld();
    App.resetGridOrigin();
    App.resetLocalSessionState({ keepArtboard: true });
    state.pagesListCollapsed = true;
    state.sidebarReorderModeActive = false;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
    App.updateUI();
    App.renderPdf();
    return true;
  }
  bindClick('settingsCloseProject', async () => {
    App.hideModal('settingsModal');
    await closeProject({ route: 'settings' });
  });

  // The settings-row slice of updateUI (R23): which rows the modal shows for this
  // session. Called guarded from updateUIInner right after its SUPABASE_ENABLED
  // .supabase-only pass (see the header).
  function syncProjectSettingsChrome() {
    const state = App.state;
    const SUPABASE_ENABLED = App.SUPABASE_ENABLED;
    const useGroupsBtn = document.getElementById('settingsUseGroupsBtn');
    if (useGroupsBtn) {
      const hasGroups = (state.groups || []).length > 0;
      useGroupsBtn.setAttribute('aria-pressed', String(groupsUiVisible()));
      useGroupsBtn.disabled = hasGroups;
      useGroupsBtn.title = hasGroups
        ? 'This project has groups, so the Groups section stays on'
        : 'Show the Groups section and Assign-to-Group menus in this project';
    }
    const settingsCloseProject = document.getElementById('settingsCloseProject');
    if (settingsCloseProject) settingsCloseProject.style.display = (!state.pages.length && !state.currentProjectId) ? 'none' : '';
    const settingsAddAdditionalPages = document.getElementById('settingsAddAdditionalPages');
    if (settingsAddAdditionalPages) settingsAddAdditionalPages.style.display = (state.pages.length && !state.isViewer) ? '' : 'none';
    const settingsDownloadPdf = document.getElementById('settingsDownloadPdf');
    if (settingsDownloadPdf) settingsDownloadPdf.style.display = (state.pages.length && !state.isViewer && (state.pdfBuffer || state.pdfStoragePath)) ? '' : 'none';
    const settingsSheetsRow = document.getElementById('settingsSheetsRow');
    if (settingsSheetsRow) settingsSheetsRow.style.display = (settingsAddAdditionalPages && settingsAddAdditionalPages.style.display !== 'none') || (settingsDownloadPdf && settingsDownloadPdf.style.display !== 'none') ? '' : 'none';
    const advancedExportBtn = document.getElementById('advancedExport');
    if (advancedExportBtn) advancedExportBtn.style.display = (state.pages.length && App.projectHasAnyCanvasMarkup() && !state.isViewer) ? '' : 'none';
    const advancedLoadTestPdf = document.getElementById('advancedLoadTestPdf');
    if (advancedLoadTestPdf) advancedLoadTestPdf.style.display = (App.IS_DEV_HOST && !state.isViewer) ? '' : 'none';
    const settingsShareProject = document.getElementById('settingsShareProject');
    if (settingsShareProject) settingsShareProject.style.display = (SUPABASE_ENABLED && state.currentProjectId && state.supabaseSession?.user && !state.loadedViaViewLink) ? '' : 'none';
    const settingsSaveProject = document.getElementById('settingsSaveProject');
    if (settingsSaveProject) {
      // A cloud save: no row at all without Supabase (MAP-NOSUPA).
      settingsSaveProject.style.display = (state.isViewer || !SUPABASE_ENABLED) ? 'none' : '';
      settingsSaveProject.textContent = (state.currentProjectId && state.pdfStoragePath)
        ? 'Save Changes'
        : 'Save Project to Cloud';
    }
    const settingsAdvancedBtn = document.getElementById('settingsAdvancedBtn');
    if (settingsAdvancedBtn) settingsAdvancedBtn.style.display = '';
    const settingsClearPageBtn = document.getElementById('settingsClearPage');
    if (settingsClearPageBtn) settingsClearPageBtn.style.display = (state.pages.length > 0 && !state.isViewer) ? '' : 'none';
    const advancedCanvasRepair = document.getElementById('advancedCanvasRepair');
    if (advancedCanvasRepair) advancedCanvasRepair.style.display = (state.pages.length > 0 && !state.isViewer) ? '' : 'none';
    const advancedImport = document.getElementById('advancedImport');
    if (advancedImport) advancedImport.style.display = state.isViewer ? 'none' : '';
  }

  App.syncProjectSettingsRows = syncProjectSettingsRows;
  App.syncProjectSettingsChrome = syncProjectSettingsChrome;
  App.groupsUiVisible = groupsUiVisible;
  App.turnOnGroups = turnOnGroups;   // D17: the duct surfaces' "Turn on groups" link
  App.closeProject = closeProject;
  App.renameProject = renameProject;
  App.openProjectRename = openProjectRename;
  App.canRenameProject = () => renameOffer() === 'rename';
})();

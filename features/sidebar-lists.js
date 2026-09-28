(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/sidebar-lists.js - the sidebar Counters / Line Types / Groups
   * section renderers, extracted from app.js's UI Render Functions region per
   * the features/lines-list.js recipe (defensive updateUI seam, publish-only
   * deps, zero moved state). The renderCountersList / renderLineTypesList /
   * renderGroupsList / countItemsInGroup registrations move here from app.js's
   * registry tail; features/quick-keys.js, counter-settings.js,
   * line-type-settings.js and item-details.js keep consuming them via App.* at
   * call time. quickKeyBadgeHtml (the Quick Key keycap badge on bound rows)
   * moves along as a private helper — it already read
   * App.getQuickKeySlotFor deferred. Row activation stays on the ONE selection
   * path: rows call App.setActiveCounterType / App.setActiveLineType, the same
   * functions the Quick Keys number row calls.
   * R14: the sections' controls live here too (the folds through bindCollapse,
   * where every title folds its list (HEADING-CLICK), the search inputs, the inline filter buttons and their toast,
   * Done reordering), bound at load; App.syncSidebarFilterButtons draws the filter
   * buttons from updateUI. The filter-scope getters/setters stay in app.js.
   * Boundary rule: read shared deps from App.* at call time, never captured at
   * load. See ARCHITECTURE.md "Feature files / window.App registry".
   */

  // Quick Key keycap badge for a bound sidebar row ('' when unbound). Deferred
  // App.* read — features/quick-keys.js registers the lookup independently of
  // this file's load order, and a render before any bindings exist simply
  // shows no badges.
  function quickKeyBadgeHtml(kind, id) {
    const slot = App.getQuickKeySlotFor && App.getQuickKeySlotFor(kind, id);
    return slot ? '<span class="quick-key-slot-badge" title="Quick Key ' + slot + ', press to select">' + slot + '</span>' : '';
  }

  // Append the usage-filter footer row to a sidebar list. The copy states the
  // REASON rows are hidden, scoped to the active filter ("N not used on this
  // sheet / in this project — show all"; idea recovered from the unlanded
  // claude/app-review-docs-bb19fa attempt). The show-all link drops the scope
  // to 'off' via the passed setter, syncs the matching settings-modal segment,
  // and re-renders.
  function appendFilterHintRow(el, hiddenCount, scope, setScope, segmentId, rerender) {
    if (hiddenCount <= 0) return;
    const hint = document.createElement('div');
    hint.className = 'sidebar-filter-hint';
    const where = scope === 'page' ? 'on this sheet' : 'in this project';
    hint.innerHTML = hiddenCount + ' not used ' + where + '. <span class="sidebar-filter-hint-clear">Show all</span>';
    hint.querySelector('.sidebar-filter-hint-clear').onclick = () => {
      setScope('off');
      App.syncFilterScopeSegment(segmentId, 'off');
      rerender();
      App.updateUI();
    };
    el.appendChild(hint);
  }

  function renderCountersList() {
    const state = App.state;
    const el = document.getElementById('countersList');
    el.innerHTML = '';
    const esc = App.escapeHtml;
    const showEdit = !state.isViewer;
    const q = (state.counterSearch || '').trim().toLowerCase();
    const filtered = q ? state.counters.filter(c => (c.name || 'Counter').toLowerCase().includes(q)) : state.counters;
    const scope = App.getCounterListFilterScope();
    let hiddenCount = 0;
    // Usage checks and badges count MERGED canvases (every layer of a page),
    // matching the footer totals and the Choose-tab badges (T1-11) — a counter
    // used only on a non-active layer is still "used".
    const usedOnPage = (c, pi) => ((App.getMergedAnnotationsForPage(state.pages[pi])?.counterMarkers?.[c.id] || []).length > 0);
    filtered.forEach(c => {
      // The active counter is exempt: a just-created type must stay visible
      // (and selectable) before its first mark is placed.
      if (scope !== 'off' && state.pages.length > 0 && c.id !== state.activeCounterType) {
        const used = scope === 'page' ? usedOnPage(c, state.currentPage) : state.pages.some((_, pi) => usedOnPage(c, pi));
        if (!used) { hiddenCount++; return; }
      }
      const div = document.createElement('div');
      div.className = 'sidebar-item' + (state.activeCounterType === c.id && showEdit ? ' active' : '');
      // T2-11: the badge shows the multiply-adjusted ("with repeats") total —
      // the same arithmetic as Summary, footer, legend, and report — with the
      // placed count in the hover title when a zone makes them differ.
      let placed = 0, withRepeats = 0;
      state.pages.forEach(p => {
        const t = App.counterTally(App.getMergedAnnotationsForPage(p), c.id);
        placed += t.placed; withRepeats += t.withRepeats;
      });
      const badgeTitle = withRepeats !== placed ? ' title="' + esc(placed + ' placed · ' + withRepeats + ' with repeats') + '"' : '';
      // D8 neck-size prefill (MINIMAL surface — a hover title, no new UI): a
      // CFM counter whose name carries no explicit size gets the D1-table
      // suggestion ("150 CFM → 8"Ø neck") on its name span.
      // D8 neck prefill + D15 "(override 250)" note, both in the hover title.
      const neckText = [
        App.getDuctNeckSuggestionText ? App.getDuctNeckSuggestionText(c) : null,
        App.getCounterCfmOverrideText ? App.getCounterCfmOverrideText(c) : null,
        App.getCounterWsfuText ? App.getCounterWsfuText(c) : null,   // WATER-PLAN rung 2
        App.getCounterWsfuOverrideText ? App.getCounterWsfuOverrideText(c) : null,
      ].filter(Boolean).join(' ');
      const neckTitle = neckText ? ' title="' + esc(neckText) + '"' : '';
      div.innerHTML = '<span class="counter-drag-handle icon-svg" title="Drag to reorder"><svg viewBox="' + esc(App.iconVbFor(c.icon)) + '" width="20" height="20"><path fill="' + esc(c.color) + '" d="' + esc(c.icon) + '"/></svg></span><span class="name"' + neckTitle + '>' + esc(c.name || 'Counter') + '</span>' + quickKeyBadgeHtml('counter', c.id) + '<span class="badge"' + badgeTitle + '>' + esc(withRepeats) + '</span>' + (showEdit ? '<span class="swatch" style="background:' + esc(c.color) + '"></span><span class="edit-btn" title="Edit">✎</span>' : '');   // XSS-COLOR sweep: the viewBox (a project's custom icons) and the repeat count (zone multipliers) ride a project
      if (showEdit) {
        div.dataset.counterId = c.id;
        const handle = div.querySelector('.counter-drag-handle');
        if (handle) {
          handle.draggable = state.sidebarReorderModeActive && state.counters.length >= 2;
          handle.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', c.id);
            e.dataTransfer.effectAllowed = 'move';
            div.classList.add('counter-dragging');
          };
          handle.ondragend = () => div.classList.remove('counter-dragging');
        }
        div.ondragover = (e) => { if (!state.sidebarReorderModeActive) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        div.ondrop = (e) => {
          e.preventDefault();
          if (!state.sidebarReorderModeActive) return;
          const fromId = e.dataTransfer.getData('text/plain');
          const toId = div.dataset.counterId;
          if (fromId === toId) return;
          const fromIdx = state.counters.findIndex(x => x.id === fromId);
          const toIdx = state.counters.findIndex(x => x.id === toId);
          if (fromIdx < 0 || toIdx < 0) return;
          const [moved] = state.counters.splice(fromIdx, 1);
          state.counters.splice(toIdx, 0, moved);
          App.pushUndoSnapshot();
          App.markProjectDirty();
          App.updateUI();
        };
        div.onclick = (e) => { if (!e.target.closest('.swatch') && !e.target.closest('.edit-btn') && !(state.sidebarReorderModeActive && e.target.closest('.counter-drag-handle'))) { App.setActiveCounterType(c.id); } };
        div.querySelector('.swatch')?.addEventListener('click', (e) => { e.stopPropagation(); App.showLineColorModal(c.color || '#e8c547', (color) => { App.pushUndoSnapshot(); c.color = color; App.markProjectDirty(); }); });
        div.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); App.openCounterLineTypeDetailsModal('counter', c); });
      }
      el.appendChild(div);
    });
    appendFilterHintRow(el, hiddenCount, scope, App.setCounterListFilterScope, 'counterShowOnlySegment', renderCountersList);
  }

  function renderLineTypesList() {
    const state = App.state;
    const el = document.getElementById('lineTypesList');
    el.innerHTML = '';
    const esc = App.escapeHtml;
    const showEdit = !state.isViewer;
    const q = (state.lineTypeSearch || '').trim().toLowerCase();
    const filtered = q ? state.lineTypes.filter(lt => (lt.name || 'Line').toLowerCase().includes(q)) : state.lineTypes;
    const scope = App.getLineTypeListFilterScope();
    let hiddenCount = 0;
    // Merged-canvas usage check — see renderCountersList.
    const usedOnPage = (lt, pi) => {
      const ann = App.getMergedAnnotationsForPage(state.pages[pi]);
      return (ann?.quickLines || []).some(ql => ql.lineTypeId === lt.id)
        || (ann?.polylines || []).some(poly => poly.lineTypeId === lt.id);
    };
    filtered.forEach(lt => {
      // Active line type exempt — see the counter loop.
      if (scope !== 'off' && state.pages.length > 0 && lt.id !== state.activeLineTypeId) {
        const used = scope === 'page' ? usedOnPage(lt, state.currentPage) : state.pages.some((_, pi) => usedOnPage(lt, pi));
        if (!used) { hiddenCount++; return; }
      }
      // T1-05 ft/px split: feet and raw-px lengths accumulate in separate
      // buckets and are never summed under one label. Runs/footage tally the
      // MERGED canvases, matching the footer totals (see usedOnPage above).
      let runs = 0, lenFt = 0, lenPx = 0;
      state.pages.forEach((p, pi) => {
        const ann = App.getMergedAnnotationsForPage(p);
        const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
        const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
        const addSplit = (item, isPoly) => {
          runs++;
          const s = App.getLineLengthSplitForTotals(item, pi, isPoly, ann);
          lenFt += s.feet; lenPx += s.px;
        };
        qLines.forEach(q => addSplit(q, false));
        polys.forEach(poly => addSplit(poly, true));
      });
      const div = document.createElement('div');
      div.className = 'sidebar-item sidebar-item-line-type' + (state.activeLineTypeId === lt.id && showEdit ? ' active' : '');
      div.innerHTML = '<span class="name line-type-name">' + esc(lt.name || 'Line') + quickKeyBadgeHtml('lineType', lt.id) + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch line-type-drag-handle" style="background:' + esc(lt.color) + '" title="Drag to reorder"></span>' : '') + '<span class="badge">' + runs + ' · ' + App.formatFeetPx(lenFt, lenPx) + '</span>' + (showEdit ? '<span class="edit-btn" title="Edit">✎</span>' : '') + '</div>';
      if (App.waterLineTypeMetaHtml) div.insertAdjacentHTML('beforeend', App.waterLineTypeMetaHtml(lt));   // WATER-PLAN rung 3: "cold · 12 WSFU served"
      if (showEdit) {
        div.dataset.lineTypeId = lt.id;
        const handle = div.querySelector('.line-type-drag-handle');
        if (handle) {
          handle.draggable = state.sidebarReorderModeActive && state.lineTypes.length >= 2;
          handle.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', lt.id);
            e.dataTransfer.effectAllowed = 'move';
            div.classList.add('line-type-dragging');
          };
          handle.ondragend = () => div.classList.remove('line-type-dragging');
        }
        div.ondragover = (e) => { if (!state.sidebarReorderModeActive) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        div.ondrop = (e) => {
          e.preventDefault();
          if (!state.sidebarReorderModeActive) return;
          const fromId = e.dataTransfer.getData('text/plain');
          const toId = div.dataset.lineTypeId;
          if (fromId === toId) return;
          const fromIdx = state.lineTypes.findIndex(x => x.id === fromId);
          const toIdx = state.lineTypes.findIndex(x => x.id === toId);
          if (fromIdx < 0 || toIdx < 0) return;
          const [moved] = state.lineTypes.splice(fromIdx, 1);
          state.lineTypes.splice(toIdx, 0, moved);
          App.pushUndoSnapshot();
          App.markProjectDirty();
          App.updateUI();
        };
        div.onclick = (e) => { if (!e.target.closest('.swatch') && !e.target.closest('.edit-btn') && !e.target.closest('.line-type-drag-handle')) { App.setActiveLineType(lt.id); } };
        div.querySelector('.swatch')?.addEventListener('click', (e) => { e.stopPropagation(); App.showLineColorModal(lt.color || '#4a9eff', (color) => { App.pushUndoSnapshot(); lt.color = color; App.markProjectDirty(); }); });
        div.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); App.openCounterLineTypeDetailsModal('lineType', lt); });
      }
      el.appendChild(div);
    });
    appendFilterHintRow(el, hiddenCount, scope, App.setLineTypeListFilterScope, 'lineTypeShowOnlySegment', renderLineTypesList);
    if (App.syncWaterScheduleBtn) App.syncWaterScheduleBtn();   // WATER-PLAN rung 5: the Water opener shows when a type has a side
  }

  function renderGroupsList() {
    const state = App.state;
    const el = document.getElementById('groupsList');
    if (!el) return;
    el.innerHTML = '';
    const esc = App.escapeHtml;
    const showEdit = !state.isViewer;
    const groups = state.groups || [];
    groups.forEach(g => {
      const count = countItemsInGroup(g.id);
      const div = document.createElement('div');
      div.className = 'sidebar-item sidebar-item-line-type' + (state.activeGroupId === g.id && showEdit ? ' active' : '');
      // DUCT unit D4 (DUCT-PLAN §2): a group with an equipment tag is a
      // SYSTEM — its header carries "RTU-1 · 600 CFM" (capacity optional) and
      // a small "plenum return" note when that per-system toggle is on (§1).
      // Plain groups render exactly as before.
      let sysHtml = '';
      // S4: a circuit group shows its panel/number tag ("LP-1/7") like a system tag.
      const ctag = (window.CircuitModel && window.CircuitModel.circuitTag(g)) || '';
      if (ctag) sysHtml += '<span class="group-system-tag">' + esc(ctag) + (g.loadAmps ? ' · ' + esc(g.loadAmps) + ' A' : '') + '</span>';   // XSS-COLOR sweep: a group's load rides a project
      if (g.equipmentTag) {
        sysHtml = '<span class="group-system-tag">' + esc(g.equipmentTag)
          + (g.capacityCfm ? ' · ' + Number(g.capacityCfm).toLocaleString() + ' CFM' : '') + '</span>'
          + (g.plenumReturn ? '<span class="group-plenum-note">plenum return</span>' : '');
        // DUCT unit D7 (DUCT-PLAN §3): the capacity line on system headers —
        // "600 designed / 600 capacity ✓" (⚠ when the attached device CFM
        // exceeds the unit). designed = duct-model's ductSystemDesignedCfm
        // via App.getDuctSystemDesignedCfm (features/duct-suggest.js — the D6
        // accumulation from each root's equipment end). Deferred App.* read;
        // groups without a capacity render exactly as before.
        // D11: the same line carries "· 0.34" of 0.8" ESP" once the group
        // has an ESP and a run (App.getDuctSystemStaticPath, features/
        // duct-bidcheck.js — the Bid Check static-path walk); ⚠ colors the
        // line when the static is over the ESP. No ESP / no run = no text.
        const parts = [];
        let over = false;
        if (g.capacityCfm > 0 && App.getDuctSystemDesignedCfm) {
          const designed = App.getDuctSystemDesignedCfm(g.id) || 0;
          if (designed > g.capacityCfm) over = true;
          parts.push(Math.round(designed).toLocaleString() + ' designed / '
            + Number(g.capacityCfm).toLocaleString() + ' capacity ' + (designed > g.capacityCfm ? '⚠' : '✓'));
        }
        const sp = g.espInWg > 0 && App.getDuctSystemStaticPath ? App.getDuctSystemStaticPath(g.id) : null;
        if (sp) {
          if (sp.over) over = true;
          const inWg = (v) => String(Math.round(v * 100) / 100) + '"';
          parts.push(inWg(sp.staticInWg) + ' of ' + inWg(g.espInWg) + ' ESP' + (sp.over ? ' ⚠' : ''));
        }
        if (parts.length) {
          sysHtml += '<span class="group-capacity-line' + (over ? ' over' : '') + '">' + parts.join(' · ') + '</span>';
        }
      }
      div.innerHTML = '<span class="name line-type-name">' + esc(g.name || 'Group') + sysHtml + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch" style="background:' + esc(g.color || App.COLORS[0]) + '"></span>' : '') + '<span class="badge">' + count + '</span>' + (showEdit ? '<span class="edit-btn" title="Edit">✎</span>' : '') + '</div>';   // XSS-COLOR: a group's color rides a project, so it is attribute text
      if (showEdit) {
        div.onclick = (e) => {
          if (!e.target.closest('.swatch') && !e.target.closest('.edit-btn')) {
            state.activeGroupId = state.activeGroupId === g.id ? null : g.id;
            App.updateUI();
          }
        };
        div.querySelector('.swatch')?.addEventListener('click', (e) => { e.stopPropagation(); App.showLineColorModal(g.color || App.COLORS[0], (color) => { App.pushUndoSnapshot(); g.color = color; App.markProjectDirty(); App.updateUI(); App.renderAnnotations(); }); });
        div.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); App.openGroupModal(g); });
      }
      el.appendChild(div);
    });
    App.renderPanelFooter && App.renderPanelFooter(el);   // S4 panel cross-check lines
  }

  function countItemsInGroup(groupId) {
    const state = App.state;
    let n = 0;
    state.pages.forEach(p => {
      App.getPageCanvases(p).forEach(c => {
        const ann = c.annotations || App.makeAnnotations();
        Object.values(ann.counterMarkers || {}).forEach(arr => arr.forEach(m => { if ((m.group || null) === groupId) n++; }));
        (ann.quickLines || []).forEach(q => { if ((q.group || null) === groupId) n++; });
        (ann.polylines || []).forEach(poly => { if ((poly.group || null) === groupId) n++; });
      });
    });
    return n;
  }

  // R14 (moved from app.js's "Line color & sidebar handlers", bound at this file's load):
  // the sidebar section controls. The filter-scope getters and setters and
  // syncFilterScopeSegment stay in app.js, because boot calls the setters before any
  // feature file loads; everything here reads them through App.* at click time.

  // A section's fold. HEADING-CLICK (2026-09-27): one rule for every title, a click on
  // it folds or opens its list. Settings sit behind the gear beside the title (the
  // settings feature files bind it). A chevron inside its title rides the title's click;
  // one outside it (after "+ Add", flush right) forwards to the title.
  function bindCollapse(stateKey, sectionId, iconId, titleId) {
    const title = document.getElementById(titleId);
    const icon = document.getElementById(iconId);
    title.onclick = () => {
      const state = App.state;
      state[stateKey] = !state[stateKey];
      document.getElementById(sectionId).classList.toggle('collapsed', state[stateKey]);
      icon.textContent = state[stateKey] ? '▶' : '▼';
    };
    if (!title.contains(icon)) icon.onclick = () => title.click();
  }
  bindCollapse('pagesListCollapsed', 'pagesSection', 'pagesCollapseIcon', 'pagesSectionTitle');
  bindCollapse('countersListCollapsed', 'countersSection', 'countersCollapseIcon', 'countersSectionTitle');
  bindCollapse('lineTypesListCollapsed', 'lineTypesSection', 'lineTypesCollapseIcon', 'lineTypesSectionTitle');
  bindCollapse('summaryListCollapsed', 'summarySection', 'summaryCollapseIcon', 'summarySectionTitle');
  bindCollapse('linesListCollapsed', 'linesSection', 'linesCollapseIcon', 'linesSectionTitle');
  bindCollapse('groupsListCollapsed', 'groupsSection', 'groupsCollapseIcon', 'groupsSectionTitle');

  const counterSearchInput = document.getElementById('counterSearchInput');
  if (counterSearchInput) {
    counterSearchInput.value = App.state.counterSearch || '';
    counterSearchInput.oninput = () => {
      App.state.counterSearch = counterSearchInput.value;
      localStorage.setItem('counterSearch', App.state.counterSearch);
      App.renderCountersList();
    };
  }
  const lineTypeSearchInput = document.getElementById('lineTypeSearchInput');
  if (lineTypeSearchInput) {
    lineTypeSearchInput.value = App.state.lineTypeSearch || '';
    lineTypeSearchInput.oninput = () => {
      App.state.lineTypeSearch = lineTypeSearchInput.value;
      localStorage.setItem('lineTypeSearch', App.state.lineTypeSearch);
      App.renderLineTypesList();
      App.renderLinesList();
    };
  }
  const linesSearchInput = document.getElementById('linesSearchInput');
  if (linesSearchInput) {
    linesSearchInput.value = App.state.linesSearch || '';
    linesSearchInput.oninput = () => {
      App.state.linesSearch = linesSearchInput.value;
      localStorage.setItem('linesSearch', App.state.linesSearch);
      App.renderLinesList();
    };
  }
  const FILTER_SCOPE_CYCLE = { off: 'page', page: 'project', project: 'off' };
  // The project-scope glyph (stacked sheets) swapped into the inline filter
  // buttons; 'off'/'page' restore the arrows-inward glyph the markup ships.
  const FILTER_GLYPH_PROJECT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" d="M3 1.5h8a1 1 0 0 1 1 1V4h-1V2.5H3v9H2v-9a1 1 0 0 1 1-1zm2 3h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm0 1v8h8v-8H5z"/></svg>';
  let filterGlyphPageSvg = null; // captured from the markup on first swap
  function syncSidebarFilterButton(btn, scope, kind) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(scope !== 'off'));
    btn.title = scope === 'project' ? ('Showing only ' + kind + ' used in this project (click to show all)')
      : scope === 'page' ? ('Showing only ' + kind + ' used on this sheet (click for this project)')
      : ('Show only ' + kind + ' used on this sheet (click again for this project)');
    if ((btn.dataset.scope || 'off') === scope) return;
    if (filterGlyphPageSvg === null) filterGlyphPageSvg = btn.innerHTML;
    btn.innerHTML = scope === 'project' ? FILTER_GLYPH_PROJECT_SVG : filterGlyphPageSvg;
    btn.dataset.scope = scope;
  }
  // Narrate each cycle click of the inline filter buttons with a two-line
  // toast: "Filter:" / the state just landed on.
  // The button's meaning is otherwise only discoverable via its title attr
  // (field feedback 2026-08-13). #airboardToastText is pre-line, so the \n
  // layout needs no markup; only the hint line is a styled span.
  const FILTER_TOAST_LINES = {
    page: 'used on this sheet',
    project: 'used anywhere in this project',
    off: 'off, showing all',
  };
  // The shared two-line filter toast core: "Filter: <kind>" / the landed state.
  function showFilterToast(kind, stateLine) {
    App.showToast('', 3200);
    const el = document.getElementById('airboardToastText');
    if (el) el.textContent = 'Filter: ' + kind + '\n' + stateLine;
  }
  function showFilterScopeToast(kind, scope) {
    const t = FILTER_TOAST_LINES[scope];
    if (t) showFilterToast(kind, t);
  }
  const counterShowOnlyOnPageInlineBtn = document.getElementById('counterShowOnlyOnPageInlineBtn');
  if (counterShowOnlyOnPageInlineBtn) {
    counterShowOnlyOnPageInlineBtn.onclick = () => {
      App.setCounterListFilterScope(FILTER_SCOPE_CYCLE[App.getCounterListFilterScope()]);
      App.syncFilterScopeSegment('counterShowOnlySegment', App.getCounterListFilterScope());
      showFilterScopeToast('counters', App.getCounterListFilterScope());
      App.renderCountersList();
      App.updateUI();
    };
  }
  const lineTypeShowOnlyOnPageInlineBtn = document.getElementById('lineTypeShowOnlyOnPageInlineBtn');
  if (lineTypeShowOnlyOnPageInlineBtn) {
    lineTypeShowOnlyOnPageInlineBtn.onclick = () => {
      App.setLineTypeListFilterScope(FILTER_SCOPE_CYCLE[App.getLineTypeListFilterScope()]);
      App.syncFilterScopeSegment('lineTypeShowOnlySegment', App.getLineTypeListFilterScope());
      showFilterScopeToast('line types', App.getLineTypeListFilterScope());
      App.renderLineTypesList();
      App.renderLinesList();
      App.updateUI();
    };
  }
  const linesShowOnlyOnPageBtn = document.getElementById('linesShowOnlyOnPageBtn');
  if (linesShowOnlyOnPageBtn) {
    linesShowOnlyOnPageBtn.onclick = () => {
      App.state.lineTypeSettings.showOnlyLinesOnCurrentPage = !App.state.lineTypeSettings.showOnlyLinesOnCurrentPage;
      App.saveDisplaySettings();
      linesShowOnlyOnPageBtn.setAttribute('aria-pressed', App.state.lineTypeSettings.showOnlyLinesOnCurrentPage);
      // Narrate the two-state Lines toggle like the scope cycles do — this
      // button's meaning was otherwise only in its title attr.
      if (App.state.lineTypeSettings.showOnlyLinesOnCurrentPage) showFilterToast('lines', 'on this sheet only');
      else showFilterToast('lines', 'off, showing every sheet');
      App.renderLinesList();
      App.updateUI();
    };
  }
  // updateUIInner calls this at the point it used to draw the three buttons itself.
  function syncSidebarFilterButtons() {
    const counterShowOnlyInline = document.getElementById('counterShowOnlyOnPageInlineBtn');
    const lineTypeShowOnlyInline = document.getElementById('lineTypeShowOnlyOnPageInlineBtn');
    const linesShowOnlyBtn = document.getElementById('linesShowOnlyOnPageBtn');
    syncSidebarFilterButton(counterShowOnlyInline, App.getCounterListFilterScope(), 'counters');
    syncSidebarFilterButton(lineTypeShowOnlyInline, App.getLineTypeListFilterScope(), 'line types');
    if (linesShowOnlyBtn) linesShowOnlyBtn.setAttribute('aria-pressed', !!App.state.lineTypeSettings?.showOnlyLinesOnCurrentPage);
  }
  document.getElementById('sidebarReorderFinish').onclick = () => {
    App.state.sidebarReorderModeActive = false;
    App.updateUI();
  };

  App.syncSidebarFilterButtons = syncSidebarFilterButtons;

  App.renderCountersList = renderCountersList;
  App.renderLineTypesList = renderLineTypesList;
  App.renderGroupsList = renderGroupsList;
  App.countItemsInGroup = countItemsInGroup;
})();

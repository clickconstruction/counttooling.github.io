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
   * Boundary rule: read shared deps from App.* at call time, never captured at
   * load. See ARCHITECTURE.md "Feature files / window.App registry".
   *
   * Multiply-zone arithmetic (JOURNEY-MAP Tier-2 #24): the Counters badge used
   * to be a RAW sum of placed markers while the Summary rollup, the footer
   * totals and the report all multiplied by the marker's multiply zone — two
   * different numbers for the same counter, side by side in one sidebar, with
   * nothing labelled either way (a ×3 typical floor read "7" here and "[13]"
   * two sections down). Every count surface now runs the ONE multiply-adjusted
   * arithmetic and says which number is which in trade words. The wording +
   * the note row live here and are published as App.multiplyCountLabels /
   * App.appendMultiplyNoteRow so features/summary-list.js renders the exact
   * same sentence from the same helper.
   */

  // The ONE multiply-zone wording for a count badge. `placed` is what the user
  // clicked; `total` is that count with multiply-zone repeats applied (what
  // the Summary, the footer totals and the report have always shown).
  function multiplyCountLabels(placed, total) {
    const repeats = total !== placed;
    return {
      repeats,
      text: String(total),
      title: repeats ? placed + ' placed on the plan — Multiply Zones repeat them, so totals bill ' + total + '.' : placed + ' placed',
    };
  }

  // The always-visible footnote under a count list — no hover, no docs: it
  // names both numbers and the fact that the tally spans every sheet (which is
  // what the usage filter's "this sheet" scope otherwise makes ambiguous).
  // Renders nothing when no multiply zone touched the rows on screen.
  function appendMultiplyNoteRow(el, o) {
    const placed = o?.placed || 0, total = o?.total || 0;
    const parts = [];
    if (total !== placed) parts.push(placed + ' placed, ' + total + ' with repeats');
    if (o?.lengthsRepeat) parts.push('lengths include repeats');
    if (!parts.length) return;
    const div = document.createElement('div');
    div.className = 'sidebar-filter-hint sidebar-repeats-note';
    div.textContent = 'Multiply zones counted — ' + parts.join('; ') + ' (all sheets).';
    el.appendChild(div);
  }

  // Quick Key keycap badge for a bound sidebar row ('' when unbound). Deferred
  // App.* read — features/quick-keys.js registers the lookup independently of
  // this file's load order, and a render before any bindings exist simply
  // shows no badges.
  function quickKeyBadgeHtml(kind, id) {
    const slot = App.getQuickKeySlotFor && App.getQuickKeySlotFor(kind, id);
    return slot ? '<span class="quick-key-slot-badge" title="Quick Key ' + slot + ' — press to select">' + slot + '</span>' : '';
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
    hint.innerHTML = hiddenCount + ' not used ' + where + ' — <span class="sidebar-filter-hint-clear">show all</span>';
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
    // Section tallies for the multiply note: ALL counters that pass the search
    // filter, including rows the usage filter hides, so the sentence always
    // matches the Summary footnote under any scope ('off' | 'page' | 'project').
    let shownPlaced = 0, shownTotal = 0;
    // Usage checks and badges count MERGED canvases (every layer of a page),
    // matching the footer totals and the Choose-tab badges (T1-11) — a counter
    // used only on a non-active layer is still "used".
    const usedOnPage = (c, pi) => ((App.getMergedAnnotationsForPage(state.pages[pi])?.counterMarkers?.[c.id] || []).length > 0);
    filtered.forEach(c => {
      // Multiply-adjusted badge — the SAME arithmetic as the Summary rollup,
      // the footer totals and the report: each marker counts its multiply-zone
      // factor, not 1. `placed` keeps the raw click count so the badge can say
      // which number is which ("7 placed · 13 with repeats").
      let placed = 0, count = 0;
      state.pages.forEach(p => {
        const ann = App.getMergedAnnotationsForPage(p);
        (ann?.counterMarkers?.[c.id] || []).forEach(m => { placed++; count += App.getMultiplyZoneForPoint(ann, m); });
      });
      // Tally BEFORE the usage-filter early-exit so the note row's numbers
      // always match the Summary footnote — two identically-worded footnotes
      // disagreeing in one sidebar would re-create the #24 defect one level up.
      shownPlaced += placed; shownTotal += count;
      // The active counter is exempt: a just-created type must stay visible
      // (and selectable) before its first mark is placed.
      if (scope !== 'off' && state.pages.length > 0 && c.id !== state.activeCounterType) {
        const used = scope === 'page' ? usedOnPage(c, state.currentPage) : state.pages.some((_, pi) => usedOnPage(c, pi));
        if (!used) { hiddenCount++; return; }
      }
      const div = document.createElement('div');
      div.className = 'sidebar-item' + (state.activeCounterType === c.id && showEdit ? ' active' : '');
      const labels = multiplyCountLabels(placed, count);
      div.innerHTML = '<span class="counter-drag-handle icon-svg" title="Drag to reorder"><svg viewBox="' + App.iconVbFor(c.icon) + '" width="20" height="20"><path fill="' + c.color + '" d="' + c.icon + '"/></svg></span><span class="name">' + esc(c.name || 'Counter') + '</span>' + quickKeyBadgeHtml('counter', c.id) + '<span class="badge" title="' + labels.title + '">' + labels.text + '</span>' + (showEdit ? '<span class="swatch" style="background:' + c.color + '"></span><span class="edit-btn" title="Edit">✎</span>' : '');
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
    appendMultiplyNoteRow(el, { placed: shownPlaced, total: shownTotal });
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
    // Runs are RAW (one drawn run is one run — the program-wide convention,
    // report.js included) while the footage IS multiply-adjusted, so a list
    // with a zone in play gets the same footnote the Counters list gets.
    let shownLengthsRepeat = false;
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
      let runs = 0, lenFt = 0, lenPx = 0, rowLengthsRepeat = false;
      state.pages.forEach((p, pi) => {
        const ann = App.getMergedAnnotationsForPage(p);
        const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
        const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
        const addSplit = (item, isPoly) => {
          runs++;
          const s = App.getLineLengthSplitForTotals(item, pi, isPoly, ann);
          lenFt += s.feet; lenPx += s.px;
          if (App.getMultiplyZoneForLine && App.getMultiplyZoneForLine(ann, item, isPoly) !== 1) rowLengthsRepeat = true;
        };
        qLines.forEach(q => addSplit(q, false));
        polys.forEach(poly => addSplit(poly, true));
      });
      const div = document.createElement('div');
      div.className = 'sidebar-item sidebar-item-line-type' + (state.activeLineTypeId === lt.id && showEdit ? ' active' : '');
      if (rowLengthsRepeat) shownLengthsRepeat = true;
      const lineTitle = runs + ' run' + (runs === 1 ? '' : 's') + ' drawn · length'
        + (rowLengthsRepeat ? ' with multiply-zone repeats' : '') + ', all sheets';
      div.innerHTML = '<span class="name line-type-name">' + esc(lt.name || 'Line') + quickKeyBadgeHtml('lineType', lt.id) + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch line-type-drag-handle" style="background:' + lt.color + '" title="Drag to reorder"></span>' : '') + '<span class="badge" title="' + lineTitle + '">' + runs + ' · ' + App.formatFeetPx(lenFt, lenPx) + '</span>' + (showEdit ? '<span class="edit-btn" title="Edit">✎</span>' : '') + '</div>';
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
    appendMultiplyNoteRow(el, { lengthsRepeat: shownLengthsRepeat });
    appendFilterHintRow(el, hiddenCount, scope, App.setLineTypeListFilterScope, 'lineTypeShowOnlySegment', renderLineTypesList);
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
      div.innerHTML = '<span class="name line-type-name">' + esc(g.name || 'Group') + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch" style="background:' + (g.color || App.COLORS[0]) + '"></span>' : '') + '<span class="badge">' + count + '</span>' + (showEdit ? '<span class="edit-btn" title="Edit">✎</span>' : '') + '</div>';
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

  // Shared with features/summary-list.js so the two count surfaces can never
  // drift apart in arithmetic or wording again (Tier-2 #24).
  App.multiplyCountLabels = multiplyCountLabels;
  App.appendMultiplyNoteRow = appendMultiplyNoteRow;
  App.renderCountersList = renderCountersList;
  App.renderLineTypesList = renderLineTypesList;
  App.renderGroupsList = renderGroupsList;
  App.countItemsInGroup = countItemsInGroup;
})();

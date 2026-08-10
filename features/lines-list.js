/*
 * features/lines-list.js - the sidebar Lines section renderer (renderLinesList),
 * the first split out of app.js's UI Render Functions region — the region the
 * ARCHITECTURE.md decomposition table names as the next candidate ("the list
 * renderers are separable per-list as feature files; updateUI itself stays
 * core"). 123 lines, fully self-contained, six inbound call sites, zero moved
 * state — the cleanest possible pilot for that roadmap.
 *
 * Loaded as a classic <script src="features/lines-list.js"> AFTER app.js. Its
 * own IIFE: reads shared state/helpers from the window.App registry at call
 * time and registers App.renderLinesList back onto it. app.js's updateUI calls
 * it DEFENSIVELY (App.renderLinesList && App.renderLinesList()) because a
 * boot-time updateUI runs before feature files load — an empty Lines section
 * for that instant is harmless (no project is open yet), and every later
 * updateUI re-renders; the burger-menu split established the pattern. The
 * search-input and show-only-on-page handlers call it plainly — they only fire
 * on user action, long after every script has loaded.
 *
 * What it owns: grouping every quick line / polyline by line type, the
 * per-type headers with run-count + always-feet totals and the expand/collapse
 * state (state.linesTypeExpanded, localStorage-persisted), the lines search
 * filter, per-row length/area + drop markers, row selection (click selects +
 * jumps to the line's page; click again deselects), the color-swatch picker,
 * and the Line Properties openers (edit pen + double-tap).
 *
 * Five new publish-only deps: formatArea + polygonArea (geometry.js globals —
 * lint-invisible to the features eslint group, so routed through the registry
 * like pilot #13 did for ptDist), pickScaleForLineType,
 * getLineRealWorldLengthFeet, and onDoubleTapOrDblClick (app.js helpers used
 * widely there). Boundary rule: read deps from App.* inside the function, never
 * captured at load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function() {
  const App = (window.App = window.App || {});

  function renderLinesList() {
    const el = document.getElementById('linesList');
    if (!el) return;
    el.innerHTML = '';
    const state = App.state;
    const esc = App.escapeHtml;
    const byType = {};
    state.pages.forEach((p, pi) => {
      if (state.lineTypeSettings?.showOnlyLinesOnCurrentPage && state.pages.length > 0 && pi !== state.currentPage) return;
      const ann = App.getActiveAnnotations(p, pi);
      (ann?.polylines || []).forEach(poly => {
        const tid = poly.lineTypeId || '_none';
        if (!byType[tid]) byType[tid] = [];
        byType[tid].push({ type: 'poly', poly, pageIdx: pi });
      });
      (ann?.quickLines || []).forEach(q => {
        const tid = q.lineTypeId || '_none';
        if (!byType[tid]) byType[tid] = [];
        byType[tid].push({ type: 'quick', q, pageIdx: pi });
      });
    });
    const linesQ = (state.linesSearch || '').trim().toLowerCase();
    const filterItem = (it) => {
      if (!linesQ) return true;
      const name = it.type === 'poly' ? (it.poly.name || 'Polyline') : (it.q.name || 'Quick line');
      return name.toLowerCase().includes(linesQ);
    };
    const showEdit = !state.isViewer;
    Object.entries(byType).forEach(([tid, items]) => {
      const filteredItems = linesQ ? items.filter(filterItem) : items;
      if (linesQ && filteredItems.length === 0) return;
      const lt = tid === '_none' ? null : state.lineTypes.find(l => l.id === tid);
      const typeName = lt ? (lt.name || 'Line') : 'Unassigned';
      // T1-05 ft/px split: feet and raw-px lengths accumulate in separate
      // buckets and are never summed under one label.
      let totalFt = 0, totalPx = 0;
      filteredItems.forEach(it => {
        const p = state.pages[it.pageIdx];
        const annIt = p ? App.getActiveAnnotations(p, it.pageIdx) : App.makeAnnotations();
        const s = it.type === 'poly' ? App.getLineLengthSplitForTotals(it.poly, it.pageIdx, true, annIt) : App.getLineLengthSplitForTotals(it.q, it.pageIdx, false, annIt);
        totalFt += s.feet; totalPx += s.px;
      });
      const summary = filteredItems.length + ' lines · ' + App.formatFeetPx(totalFt, totalPx);
      const expanded = !!state.linesTypeExpanded[tid];
      const groupWrapper = document.createElement('div');
      groupWrapper.className = 'lines-type-group' + (expanded ? '' : ' collapsed');
      const header = document.createElement('div');
      header.className = 'lines-type-header';
      header.innerHTML = '<span class="lines-type-name">' + esc(typeName) + '</span><span class="lines-type-summary">' + summary + '</span><span class="collapse-icon lines-type-collapse-icon">' + (expanded ? '▼' : '▶') + '</span>';
      header.onclick = () => {
        state.linesTypeExpanded[tid] = !state.linesTypeExpanded[tid];
        try { localStorage.setItem('linesTypeExpanded', JSON.stringify(state.linesTypeExpanded)); } catch (_) {}
        groupWrapper.classList.toggle('collapsed', !state.linesTypeExpanded[tid]);
        header.querySelector('.lines-type-collapse-icon').textContent = state.linesTypeExpanded[tid] ? '▼' : '▶';
      };
      groupWrapper.appendChild(header);
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'lines-type-items';
      filteredItems.forEach(it => {
        const lineId = it.type === 'poly' ? it.poly.id : it.q.id;
        const isSelected = state.selectedLineId === lineId && state.selectedLinePageIdx === it.pageIdx;
        const div = document.createElement('div');
        div.className = 'sidebar-item sidebar-item-line-type' + (isSelected ? ' active' : '');
        const ltItem = state.lineTypes.find(l => l.id === (it.type === 'poly' ? it.poly.lineTypeId : it.q.lineTypeId));
        const color = (it.type === 'poly' ? it.poly.color : it.q.color) || (ltItem?.color || '#4a9eff');
        const pageScale = state.pages[it.pageIdx]?.scale;
        const annRow = state.pages[it.pageIdx] ? App.getActiveAnnotations(state.pages[it.pageIdx], it.pageIdx) : App.makeAnnotations();
        let dist, name;
        if (it.type === 'poly') {
          dist = it.poly.closed ? App.formatArea(App.polygonArea(it.poly.points || []), pageScale) : App.formatFeet(App.getLineRealWorldLengthFeet(it.poly, it.pageIdx, true, annRow), App.getEffectiveScaleForLine(annRow, it.poly, true, it.pageIdx));
          name = it.poly.name || 'Polyline';
        } else {
          dist = App.formatFeet(App.getLineRealWorldLengthFeet(it.q, it.pageIdx, false, annRow), App.getEffectiveScaleForLine(annRow, it.q, false, it.pageIdx));
          name = it.q.name || 'Quick line';
        }
        const line = it.type === 'poly' ? it.poly : it.q;
        const sd = line.startDrop || 0, ed = line.endDrop || 0;
        let dropsHtml = '';
        if (sd > 0 || ed > 0) {
          const su = line.startDropUnit || pageScale?.unit, eu = line.endDropUnit || pageScale?.unit;
          const parts = [];
          if (sd > 0) parts.push('↧ ' + sd + (su ? ' ' + su : ''));
          if (ed > 0) parts.push('↧ ' + ed + (eu ? ' ' + eu : ''));
          dropsHtml = '<div class="line-drops">' + parts.join(' + ') + '</div>';
        }
        div.innerHTML = '<span class="name line-type-name">' + esc(name) + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch" style="background:' + color + '"></span>' : '') + '<span class="badge">' + dist + '</span>' + (showEdit ? '<span class="edit-btn" title="' + (it.type === 'poly' ? 'Edit vertices' : 'Rename') + '">✎</span>' : '') + '</div>' + dropsHtml;
        div.onclick = (e) => {
          if (showEdit && (e.target.closest('.swatch') || e.target.closest('.edit-btn'))) return;
          if (isSelected) {
            state.selectedLineId = null;
            state.selectedLineIsPoly = false;
            state.selectedLinePageIdx = null;
            App.updateUI();
            App.renderAnnotations();
          } else if (lineId) {
            state.selectedLineId = lineId;
            state.selectedLineIsPoly = it.type === 'poly';
            state.selectedLinePageIdx = it.pageIdx;
            state.currentPage = it.pageIdx;
            App.fitZoom();
          }
        };
        if (showEdit) {
          const swatch = div.querySelector('.swatch');
          if (swatch) swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            App.showLineColorModal(
              (it.type === 'poly' ? it.poly.color : it.q.color) || (ltItem?.color || '#4a9eff'),
              (color) => {
                App.pushUndoSnapshot();
                if (it.type === 'poly') it.poly.color = color;
                else it.q.color = color;
                App.markProjectDirty();
              }
            );
          });
          const editBtn = div.querySelector('.edit-btn');
          if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); App.openLinePropertiesModal(it); };
          App.onDoubleTapOrDblClick(div.querySelector('.name'), () => App.openLinePropertiesModal(it));
        }
        itemsContainer.appendChild(div);
      });
      groupWrapper.appendChild(itemsContainer);
      el.appendChild(groupWrapper);
    });
  }

  App.renderLinesList = renderLinesList;
})();

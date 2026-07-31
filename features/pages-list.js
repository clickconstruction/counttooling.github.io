(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/pages-list.js - the sidebar Pages section renderer, extracted from
   * app.js's UI Render Functions region per the features/lines-list.js recipe
   * (defensive updateUI seam, publish-only deps, zero moved state).
   * renderPagesList registration moves here from app.js's registry tail;
   * features/page-settings.js keeps consuming it via App.* at call time.
   * formatPageTitleStartEnd (the start/end title truncation) moves along as a
   * private helper. New publish-only deps: App.pageHasAnyAnnotations,
   * App.startRename, App.exitEditMode.
   * Boundary rule: read shared deps from App.* at call time, never captured at
   * load. See ARCHITECTURE.md "Feature files / window.App registry".
   */

  function formatPageTitleStartEnd(label, truncated) {
    if (!truncated || !label || label.length <= 28) return label;
    const half = Math.floor((label.length - 6) / 2);
    const nFirst = Math.min(24, half);
    const nLast = Math.min(14, half);
    if (nFirst <= 0 && nLast <= 0) return label.slice(0, 37) + '...';
    return { first: label.slice(0, nFirst), last: label.slice(-nLast) };
  }

  function renderPagesList() {
    const state = App.state;
    const el = document.getElementById('pagesList');
    el.classList.toggle('pages-titles-truncated', !!state.pagesTitlesTruncated);
    el.innerHTML = '';
    const showEdit = !state.isViewer;
    const esc = App.escapeHtml;
    state.pages.forEach((p, i) => {
      if (state.hideUnmarkedPagesFromSidebar && !App.pageHasAnyAnnotations(p)) return;
      const div = document.createElement('div');
      div.className = 'sidebar-item' + (state.currentPage === i ? ' active' : '');
      const hasAnn = App.pageHasAnyAnnotations(p);
      const hasScale = !!p.scale;
      const rawLabel = p.label || 'Page ' + (i + 1);
      const formatted = formatPageTitleStartEnd(rawLabel, state.pagesTitlesTruncated);
      let nameHtml;
      const nameTitle = typeof formatted === 'object' ? rawLabel : '';
      if (typeof formatted === 'object') {
        nameHtml = '<span class="name-line name-line-start">' + esc(formatted.first) + '...</span><span class="name-line name-line-end">...' + esc(formatted.last) + '</span>';
      } else {
        nameHtml = esc(formatted);
      }
      const canvasCount = App.getPageCanvases(p).length;
      const canvasBadge = canvasCount > 1 ? '<span class="badge badge-canvas-count" title="' + canvasCount + ' canvases">' + canvasCount + '</span>' : '';
      const pageNumBadgeClass = 'badge' + (hasScale ? ' badge-scale-set' : '') + (hasAnn ? ' badge-has-ann' : '') + (showEdit ? ' page-num-badge-editable' : '');
      div.innerHTML = '<span class="page-num-badge-wrap"><span class="' + pageNumBadgeClass + '" title="' + (showEdit ? 'Click to rename or delete' : '') + '">' + (i + 1) + '</span>' + canvasBadge + '</span><span class="name"' + (nameTitle ? ' title="' + esc(nameTitle) + '"' : '') + '>' + nameHtml + '</span>';
      div.onclick = (e) => { if (!e.target.closest('.page-num-badge-wrap') && !e.target.closest('.page-delete-btn')) { state.currentPage = i; App.fitZoom(); } };
      if (showEdit) {
        const deletePage = () => {
          if (state.pages.length <= 1) { alert('Cannot delete the only page.'); return; }
          App.pushUndoSnapshot();
          state.pages.splice(i, 1);
          if (state.currentPage >= state.pages.length) state.currentPage = Math.max(0, state.pages.length - 1);
          else if (state.currentPage > i) state.currentPage--;
          if (state.selectedLinePageIdx === i) { state.selectedLineId = null; state.selectedLinePageIdx = null; }
          else if (state.selectedLinePageIdx > i) state.selectedLinePageIdx--;
          if (state.editingPolyline && state.editingPolyIndex === i) App.exitEditMode(false);
          else if (state.editingPolyline && state.editingPolyIndex > i) state.editingPolyIndex--;
          App.markProjectDirty();
          App.updateUI();
          App.renderAnnotations();
          App.fitZoom();
        };
        const pageName = p.label || 'Page ' + (i + 1);
        const openRename = () => App.startRename(div.querySelector('.name'), (v) => { App.pushUndoSnapshot(); p.label = v; App.markProjectDirty(); App.updateUI(); }, { onDelete: deletePage, pageName });
        const pageNumBadge = div.querySelector('.page-num-badge-editable');
        if (pageNumBadge) pageNumBadge.addEventListener('click', (e) => { e.stopPropagation(); openRename(); });
        App.onDoubleTapOrDblClick(div.querySelector('.name'), openRename);
      }
      el.appendChild(div);
    });
  }

  App.renderPagesList = renderPagesList;
})();

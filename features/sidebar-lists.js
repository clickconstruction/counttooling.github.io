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
   */

  // Quick Key keycap badge for a bound sidebar row ('' when unbound). Deferred
  // App.* read — features/quick-keys.js registers the lookup independently of
  // this file's load order, and a render before any bindings exist simply
  // shows no badges.
  function quickKeyBadgeHtml(kind, id) {
    const slot = App.getQuickKeySlotFor && App.getQuickKeySlotFor(kind, id);
    return slot ? '<span class="quick-key-slot-badge" title="Quick Key ' + slot + ' — press to select">' + slot + '</span>' : '';
  }

  function renderCountersList() {
    const state = App.state;
    const el = document.getElementById('countersList');
    el.innerHTML = '';
    const esc = App.escapeHtml;
    const showEdit = !state.isViewer;
    const q = (state.counterSearch || '').trim().toLowerCase();
    const filtered = q ? state.counters.filter(c => (c.name || 'Counter').toLowerCase().includes(q)) : state.counters;
    filtered.forEach(c => {
      if (state.counterSettings?.showOnlyCountersOnCurrentPage && state.pages.length > 0) {
        const page = state.pages[state.currentPage];
        const ann = App.getActiveAnnotations(page, state.currentPage);
        const markers = (ann?.counterMarkers?.[c.id] || []);
        if (markers.length === 0) return;
      }
      const div = document.createElement('div');
      div.className = 'sidebar-item' + (state.activeCounterType === c.id && showEdit ? ' active' : '');
      const count = state.pages.reduce((n, p, pi) => n + ((App.getActiveAnnotations(p, pi)?.counterMarkers?.[c.id] || []).length), 0);
      div.innerHTML = '<span class="counter-drag-handle icon-svg" title="Drag to reorder"><svg viewBox="' + App.iconVbFor(c.icon) + '" width="20" height="20"><path fill="' + c.color + '" d="' + c.icon + '"/></svg></span><span class="name">' + esc(c.name || 'Counter') + '</span>' + quickKeyBadgeHtml('counter', c.id) + '<span class="badge">' + count + '</span>' + (showEdit ? '<span class="swatch" style="background:' + c.color + '"></span><span class="edit-btn" title="Edit">✎</span>' : '');
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
  }

  function renderLineTypesList() {
    const state = App.state;
    const el = document.getElementById('lineTypesList');
    el.innerHTML = '';
    const esc = App.escapeHtml;
    const showEdit = !state.isViewer;
    const q = (state.lineTypeSearch || '').trim().toLowerCase();
    const filtered = q ? state.lineTypes.filter(lt => (lt.name || 'Line').toLowerCase().includes(q)) : state.lineTypes;
    filtered.forEach(lt => {
      if (state.lineTypeSettings?.showOnlyLineTypesOnCurrentPage && state.pages.length > 0) {
        const page = state.pages[state.currentPage];
        const ann = App.getActiveAnnotations(page, state.currentPage);
        const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
        const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
        if (qLines.length === 0 && polys.length === 0) return;
      }
      let runs = 0, len = 0;
      const pageIndices = [];
      state.pages.forEach((p, pi) => {
        const ann = App.getActiveAnnotations(p, pi);
        const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
        const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
        if (qLines.length || polys.length) pageIndices.push(pi);
        qLines.forEach(q => { runs++; len += App.getLineLengthFeetForTotals(q, pi, false, ann); });
        polys.forEach(poly => { runs++; len += App.getLineLengthFeetForTotals(poly, pi, true, ann); });
      });
      const scale = App.pickScaleForLineType(pageIndices);
      const div = document.createElement('div');
      div.className = 'sidebar-item sidebar-item-line-type' + (state.activeLineTypeId === lt.id && showEdit ? ' active' : '');
      div.innerHTML = '<span class="name line-type-name">' + esc(lt.name || 'Line') + quickKeyBadgeHtml('lineType', lt.id) + '</span><div class="line-type-row">' + (showEdit ? '<span class="swatch line-type-drag-handle" style="background:' + lt.color + '" title="Drag to reorder"></span>' : '') + '<span class="badge">' + runs + ' · ' + App.formatFeet(len, scale) + '</span>' + (showEdit ? '<span class="edit-btn" title="Edit">✎</span>' : '') + '</div>';
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

  App.renderCountersList = renderCountersList;
  App.renderLineTypesList = renderLineTypesList;
  App.renderGroupsList = renderGroupsList;
  App.countItemsInGroup = countItemsInGroup;
})();

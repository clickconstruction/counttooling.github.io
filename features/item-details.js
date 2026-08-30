/*
 * features/item-details.js - the item detail & properties modals, extracted from
 * the app.js IIFE as the twenty-fifth feature-file split under the window.App
 * registry pattern. Three related surfaces move together: the Counter / Line Type
 * details modal (`#counterLineTypeDetailsModal`, with its delete-confirm modal
 * `#deleteCounterLineTypeConfirmModal`), the Line Properties modal
 * (`#linePropertiesModal`, name/color/drops/vertex-edit), and the heavier
 * deleteGroup mutation (whose App.deleteGroup registration moves here from
 * app.js's registry tail - features/groups.js keeps consuming it via App.* at
 * call time, so load order between the two feature files does not matter).
 *
 * Loaded as a classic <script src="/features/item-details.js"> AFTER app.js. Its
 * own IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openCounterLineTypeDetailsModal + openLinePropertiesModal +
 * closeLinePropertiesModal + deleteGroup back onto App, and binds the
 * counterLineTypeDetailsClose / linePropertiesClose / deleteCounterLineType
 * confirm+cancel handlers at load.
 *
 * The three pieces of modal state (counterLineTypeDetailsItem,
 * pendingDeleteCounterLineType, pendingLineProperties) live here as private
 * `let`s. Two core hooks reach them: the `hideModal('counterLineTypeDetailsModal')`
 * reset in app.js calls the registered App.onCounterLineTypeDetailsHidden()
 * (the Groups-callback pattern), and the shared custom-icon upload handler reads
 * the open details item through App.getCounterLineTypeDetailsItem() (a
 * feature-registered getter - the reverse direction of the save-status getters).
 *
 * showModal / hideModal (the app-wide modal primitives) stay in app.js. The
 * external callers - the sidebar edit pens (renderCountersList /
 * renderLineTypesList / renderLinesList), the canvas context menu, and the
 * Escape branch - reach these modals via App.* at call time.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  let pendingDeleteCounterLineType = null;
  let counterLineTypeDetailsItem = null;
  let pendingLineProperties = null;
  // Set by openLinePropertiesModal, called by closeLinePropertiesModal: commits
  // any value typed into the drop fields but not yet blurred (the Escape-close
  // path), through the SAME commitDrop funnel as every other path — so close
  // pushes its undo snapshot before mutating and marks dirty only on change.
  let commitPendingDropFields = null;

  // --- drop field I/O -------------------------------------------------------
  //
  // Drops used to be read with parseInt, which silently swallowed the fraction
  // of any decimal a user typed (10.5 stored as 10) while the field went on
  // showing 10.5 — a number on screen the takeoff was not counting. Both
  // halves are fixed here: the value parses as a decimal in the selected unit
  // (plus the ft-in shorthand "8'6" when that unit is feet, exactly as the
  // Room Sizer's ceiling height accepts — for any other unit the shorthand
  // would silently misread a plain "8" as 8 feet), and every commit path
  // re-renders the field from the value that was actually stored.
  function readDropField(el, unitEl) {
    const raw = String(el.value || '').trim();
    if (!raw) return 0;
    const unit = unitEl ? unitEl.value : 'ft';
    const parsed = unit === 'ft' ? App.parseRealWorldLength(raw, 'ft') : parseFloat(raw);
    if (parsed == null || isNaN(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100) / 100;
  }
  function writeDropField(el, value) {
    el.value = value > 0 ? String(parseFloat(value.toFixed(2))) : '';
  }

  function openCounterLineTypeDetailsModal(kind, item) {
    const state = App.state;
    counterLineTypeDetailsItem = kind === 'counter' ? item : null;
    const titleEl = document.getElementById('counterLineTypeDetailsTitle');
    const nameEl = document.getElementById('counterLineTypeDetailsName');
    const swatchEl = document.getElementById('counterLineTypeDetailsSwatch');
    const pagesEl = document.getElementById('counterLineTypeDetailsPages');
    const deleteBtn = document.getElementById('counterLineTypeDetailsDelete');
    titleEl.textContent = kind === 'counter' ? 'Counter' : 'Line Type';
    const curveGroup = document.getElementById('counterLineTypeDetailsCurveGroup');
    if (curveGroup) {
      curveGroup.style.display = kind === 'lineType' ? '' : 'none';
      if (kind === 'lineType') {
        const curveVal = item.curveStyle || 'straight';
        document.querySelectorAll('input[name="counterLineTypeDetailsCurve"]').forEach(r => { r.checked = r.value === curveVal; });
      }
    }
    const iconGroup = document.getElementById('counterLineTypeDetailsIconGroup');
    if (iconGroup) iconGroup.style.display = kind === 'counter' ? '' : 'none';
    if (kind === 'counter' && iconGroup) {
      const grid = document.getElementById('counterLineTypeDetailsIconGrid');
      const customGrid = document.getElementById('counterLineTypeDetailsIconGridCustom');
      const customIconsGroup = document.getElementById('counterLineTypeDetailsCustomIconsGroup');
      if (customIconsGroup) customIconsGroup.style.display = '';
      const icons = App.getOrderedIcons();
      const effectiveCustom = App.getEffectiveCustomIcons();
      const allIcons = [...icons, ...effectiveCustom];
      const currentIcon = item.icon && allIcons.some(ic => ic.value === item.icon) ? item.icon : (icons[0]?.value || '');
      grid.innerHTML = App.iconGridCellsHtml(icons, App.iconVbFor, (ic) => ic.value === currentIcon);
      customGrid.innerHTML = App.customIconCellsHtml(effectiveCustom, currentIcon);
      const applyIcon = (path) => {
        App.pushUndoSnapshotCurrentPage();
        item.icon = path;
        App.markProjectDirty();
        App.updateUI();
        App.renderAnnotations();
      };
      grid.querySelectorAll('.icon-cell').forEach(c => {
        c.onclick = () => {
          grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          c.classList.add('selected');
          applyIcon(c.dataset.path);
        };
      });
      customGrid.querySelectorAll('.icon-cell').forEach(c => {
        c.onclick = () => {
          if (c.dataset.upload) {
            document.getElementById('customIconUploadInput').click();
            return;
          }
          grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          c.classList.add('selected');
          applyIcon(c.dataset.path);
        };
      });
    }
    // Child counts editor (features/child-counts.js) — defensive cross-feature
    // call at open time, per the registry boundary rule.
    App.renderChildCountsSection && App.renderChildCountsSection(kind, item);
    nameEl.value = item.name || '';
    nameEl.onblur = () => {
      const v = nameEl.value.trim();
      App.pushUndoSnapshotCurrentPage();
      item.name = v || (kind === 'counter' ? 'Counter' : 'Line');
      App.markProjectDirty();
      App.updateUI();
    };
    const color = item.color || (kind === 'counter' ? '#e8c547' : '#4a9eff');
    swatchEl.style.background = color;
    swatchEl.onclick = () => {
      App.showLineColorModal(color, (newColor) => {
        App.pushUndoSnapshotCurrentPage();
        item.color = newColor;
        swatchEl.style.background = newColor;
        App.markProjectDirty();
        App.updateUI();
        App.renderAnnotations();
      });
    };
    if (kind === 'lineType') {
      document.querySelectorAll('input[name="counterLineTypeDetailsCurve"]').forEach(r => {
        r.onchange = () => { App.pushUndoSnapshotCurrentPage(); item.curveStyle = r.value; App.markProjectDirty(); App.updateUI(); App.renderAnnotations(); };
      });
    }
    let totalCount = 0;
    const pages = [];
    if (kind === 'counter') {
      state.pages.forEach((p, pi) => {
        let n = 0;
        App.getPageCanvases(p).forEach(c => { n += (c.annotations?.counterMarkers?.[item.id] || []).length; });
        if (n > 0) { pages.push({ pageIdx: pi, count: n, label: p.label || 'Page ' + (pi + 1) }); totalCount += n; }
      });
    } else {
      state.pages.forEach((p, pi) => {
        let runs = 0;
        App.getPageCanvases(p).forEach(c => {
          const ann = c.annotations || App.makeAnnotations();
          runs += (ann.quickLines || []).filter(q => q.lineTypeId === item.id).length;
          runs += (ann.polylines || []).filter(poly => poly.lineTypeId === item.id).length;
        });
        if (runs > 0) { pages.push({ pageIdx: pi, count: runs, label: p.label || 'Page ' + (pi + 1) }); totalCount += runs; }
      });
    }
    pagesEl.innerHTML = '';
    if (pages.length === 0) {
      pagesEl.innerHTML = '<p style="margin:0;color:var(--text2);font-size:0.9rem;">Not used on any page</p>';
    } else {
      pages.forEach(({ pageIdx, count, label }) => {
        const div = document.createElement('div');
        div.className = 'page-item';
        div.textContent = kind === 'counter' ? label + ': ' + count + ' marker' + (count !== 1 ? 's' : '') : label + ': ' + count + ' run' + (count !== 1 ? 's' : '');
        div.onclick = () => {
          state.currentPage = pageIdx;
          App.fitZoom();
          App.hideModal('counterLineTypeDetailsModal');
          App.updateUI();
          App.renderPdf();
        };
        pagesEl.appendChild(div);
      });
    }
    deleteBtn.onclick = () => {
      if (totalCount === 0) {
        performDeleteCounterLineType(kind, item);
        App.hideModal('counterLineTypeDetailsModal');
      } else {
        pendingDeleteCounterLineType = { kind, item };
        document.getElementById('deleteCounterLineTypeName').textContent = item.name || (kind === 'counter' ? 'this counter' : 'this line type');
        document.getElementById('deleteCounterLineTypeMessage').textContent = 'This will remove ' + totalCount + (kind === 'counter' ? ' marker' + (totalCount !== 1 ? 's' : '') : ' line' + (totalCount !== 1 ? 's' : '')) + ' from the project. Continue?';
        App.showModal('deleteCounterLineTypeConfirmModal');
      }
    };
    App.showModal('counterLineTypeDetailsModal');
  }

  function performDeleteCounterLineType(kind, item) {
    const state = App.state;
    App.pushUndoSnapshot();   // FULL snapshot — this delete cascades across every page's markers
    if (kind === 'counter') {
      const idx = state.counters.findIndex(c => c.id === item.id);
      if (idx >= 0) state.counters.splice(idx, 1);
      state.pages.forEach(p => {
        App.getPageCanvases(p).forEach(c => { if (c.annotations?.counterMarkers) delete c.annotations.counterMarkers[item.id]; });
      });
      if (state.activeCounterType === item.id) { state.activeCounterType = null; state.tool = App.TOOL.NONE; }
    } else {
      const idx = state.lineTypes.findIndex(lt => lt.id === item.id);
      if (idx >= 0) state.lineTypes.splice(idx, 1);
      state.pages.forEach(p => {
        App.getPageCanvases(p).forEach(c => {
          const ann = c.annotations;
          if (ann) {
            if (ann.quickLines) ann.quickLines = ann.quickLines.filter(q => q.lineTypeId !== item.id);
            if (ann.polylines) ann.polylines = ann.polylines.filter(poly => poly.lineTypeId !== item.id);
          }
        });
      });
      if (state.activeLineTypeId === item.id) { state.activeLineTypeId = null; state.tool = App.TOOL.NONE; }
      const selPage = state.pages[state.selectedLinePageIdx];
      const selAnn = selPage ? App.getActiveAnnotations(selPage) : null;
      const selPoly = (selAnn?.polylines || []).find(p => p.id === state.selectedLineId);
      const selQuick = (selAnn?.quickLines || []).find(q => q.id === state.selectedLineId);
      if ((selPoly && selPoly.lineTypeId === item.id) || (selQuick && selQuick.lineTypeId === item.id)) {
        state.selectedLineId = null; state.selectedLineIsPoly = false; state.selectedLinePageIdx = null;
      }
    }
    App.markProjectDirty();
    App.updateUI();
    App.renderAnnotations();
  }

  function openLinePropertiesModal(it) {
    const state = App.state;
    pendingLineProperties = it;
    const line = it.type === 'poly' ? it.poly : it.q;
    const lt = state.lineTypes.find(l => l.id === line.lineTypeId);
    const color = line.color || (lt?.color || '#4a9eff');
    const lineTypeLineEl = document.getElementById('linePropertiesLineType');
    if (lineTypeLineEl) {
      lineTypeLineEl.textContent = lt
        ? ('Line type: ' + (lt.name || 'Line'))
        : 'Line type: —';
    }
    const nameEl = document.getElementById('linePropertiesName');
    const swatchEl = document.getElementById('linePropertiesSwatch');
    const startDropEl = document.getElementById('linePropertiesStartDrop');
    const endDropEl = document.getElementById('linePropertiesEndDrop');
    const startDropUnitEl = document.getElementById('linePropertiesStartDropUnit');
    const endDropUnitEl = document.getElementById('linePropertiesEndDropUnit');
    const defaultDropUnit = App.getPageScale(it.pageIdx ?? state.currentPage)?.unit || 'ft';
    const editVerticesGroup = document.getElementById('linePropertiesEditVerticesGroup');
    const editVerticesBtn = document.getElementById('linePropertiesEditVertices');
    nameEl.value = line.name || (it.type === 'poly' ? 'Polyline' : 'Quick line');
    writeDropField(startDropEl, line.startDrop || 0);
    writeDropField(endDropEl, line.endDrop || 0);
    startDropUnitEl.value = line.startDropUnit || defaultDropUnit;
    endDropUnitEl.value = line.endDropUnit || defaultDropUnit;
    swatchEl.style.background = color;
    editVerticesGroup.style.display = it.type === 'poly' ? '' : 'none';
    nameEl.onblur = () => {
      const v = nameEl.value.trim();
      App.pushUndoSnapshotCurrentPage();
      line.name = v || (it.type === 'poly' ? 'Polyline' : 'Quick line');
      App.markProjectDirty();
      App.updateUI();
    };
    swatchEl.onclick = () => {
      App.showLineColorModal(color, (newColor) => {
        App.pushUndoSnapshotCurrentPage();
        line.color = newColor;
        swatchEl.style.background = newColor;
        App.markProjectDirty();
        App.updateUI();
        App.renderAnnotations();
      });
    };
    // Commit one drop field. Every path (typing, ±, a Recent chip, the unit
    // select, Close) funnels through here, so the undo snapshot is always
    // pushed BEFORE the mutation, the field is re-rendered from the value that
    // was actually stored, and only a real change marks the project dirty.
    const commitDrop = (el, unitEl, prop, value, route) => {
      const unit = unitEl.value;
      const v = value > 0 ? value : 0;
      const changed = (line[prop] || 0) !== v || (v > 0 && line[prop + 'Unit'] !== unit);
      if (changed) App.pushUndoSnapshotCurrentPage();
      line[prop] = v;
      if (v > 0) line[prop + 'Unit'] = unit;
      writeDropField(el, v);
      if (!changed) return false;
      if (v > 0) App.pushRecentDrop(v, unit);
      App.logDropSetEvent(v, unit, route || 'modal');
      App.markProjectDirty();
      App.updateUI();
      App.renderAnnotations();
      renderDropChips();
      return true;
    };
    const applyFromField = (el, unitEl, prop, route) => commitDrop(el, unitEl, prop, readDropField(el, unitEl), route);

    startDropEl.onblur = () => applyFromField(startDropEl, startDropUnitEl, 'startDrop', 'modal');
    endDropEl.onblur = () => applyFromField(endDropEl, endDropUnitEl, 'endDrop', 'modal');
    startDropUnitEl.onchange = () => applyFromField(startDropEl, startDropUnitEl, 'startDrop', 'modal-unit');
    endDropUnitEl.onchange = () => applyFromField(endDropEl, endDropUnitEl, 'endDrop', 'modal-unit');
    const adjustDrop = (el, unitEl, prop, delta) => {
      commitDrop(el, unitEl, prop, Math.max(0, readDropField(el, unitEl) + delta), 'modal-adjust');
    };
    document.getElementById('linePropertiesStartDropPlus1').onclick = () => adjustDrop(startDropEl, startDropUnitEl, 'startDrop', 1);
    document.getElementById('linePropertiesStartDropPlus10').onclick = () => adjustDrop(startDropEl, startDropUnitEl, 'startDrop', 10);
    document.getElementById('linePropertiesStartDropMinus1').onclick = () => adjustDrop(startDropEl, startDropUnitEl, 'startDrop', -1);
    document.getElementById('linePropertiesStartDropMinus10').onclick = () => adjustDrop(startDropEl, startDropUnitEl, 'startDrop', -10);
    document.getElementById('linePropertiesClearStartDrop').onclick = () => commitDrop(startDropEl, startDropUnitEl, 'startDrop', 0, 'modal-clear');
    document.getElementById('linePropertiesEndDropPlus1').onclick = () => adjustDrop(endDropEl, endDropUnitEl, 'endDrop', 1);
    document.getElementById('linePropertiesEndDropPlus10').onclick = () => adjustDrop(endDropEl, endDropUnitEl, 'endDrop', 10);
    document.getElementById('linePropertiesEndDropMinus1').onclick = () => adjustDrop(endDropEl, endDropUnitEl, 'endDrop', -1);
    document.getElementById('linePropertiesEndDropMinus10').onclick = () => adjustDrop(endDropEl, endDropUnitEl, 'endDrop', -10);
    document.getElementById('linePropertiesClearEndDrop').onclick = () => commitDrop(endDropEl, endDropUnitEl, 'endDrop', 0, 'modal-clear');

    // Recent-drop chips: the last few sizes this device used, one click each.
    // Same store the Drop tool's palette reads (state.recentDrops), so the two
    // surfaces can never offer different vocabularies.
    function renderDropChips() {
      [['linePropertiesStartDropRecent', startDropEl, startDropUnitEl, 'startDrop'],
        ['linePropertiesEndDropRecent', endDropEl, endDropUnitEl, 'endDrop']].forEach(([rowId, el, unitEl, prop]) => {
        const row = document.getElementById(rowId);
        if (!row) return;
        const recents = App.getRecentDrops();
        if (!recents.length) { row.style.display = 'none'; row.innerHTML = ''; return; }
        row.style.display = '';
        row.innerHTML = '<span class="drop-recent-label">Recent</span>' + recents.map(d =>
          '<button type="button" class="drop-recent-chip" data-v="' + d.value + '" data-u="' + App.escapeHtml(d.unit) + '">' +
          App.escapeHtml(App.formatDropLabel(d.value, d.unit)) + '</button>').join('');
        row.querySelectorAll('.drop-recent-chip').forEach(btn => {
          btn.onclick = () => {
            unitEl.value = btn.dataset.u;
            commitDrop(el, unitEl, prop, parseFloat(btn.dataset.v), 'modal-recent');
          };
        });
      });
    }
    renderDropChips();
    commitPendingDropFields = () => {
      applyFromField(startDropEl, startDropUnitEl, 'startDrop', 'modal-close');
      applyFromField(endDropEl, endDropUnitEl, 'endDrop', 'modal-close');
    };
    if (editVerticesBtn) {
      editVerticesBtn.onclick = () => {
        App.hideModal('linePropertiesModal');
        pendingLineProperties = null;
        commitPendingDropFields = null;
        App.enterEditMode(it.poly.id, it.pageIdx);
      };
    }
    App.showModal('linePropertiesModal');
  }

  // Close (button or Escape): commit any value typed but not yet blurred, then
  // dismiss. The commit runs through commitDrop, so it snapshots BEFORE
  // mutating (one Ctrl+Z after Close undoes the drop — it used to snapshot the
  // already-mutated state, making the first undo a no-op) and a plain
  // open-then-close no longer marks the project dirty or burns an undo slot.
  function closeLinePropertiesModal() {
    if (!pendingLineProperties) return;
    if (commitPendingDropFields) commitPendingDropFields();
    commitPendingDropFields = null;
    App.hideModal('linePropertiesModal');
    pendingLineProperties = null;
    App.updateUI();
    App.renderAnnotations();
  }

  function deleteGroup(groupId) {
    const state = App.state;
    const g = (state.groups || []).find(x => x.id === groupId);
    if (!g) return false;
    const count = App.countItemsInGroup(groupId);
    if (count > 0 && !confirm('This group has ' + count + ' item(s). Remove group and clear assignment from those items?')) return false;
    App.pushUndoSnapshot();   // FULL snapshot — group removal clears assignments on every page
    state.groups = (state.groups || []).filter(x => x.id !== groupId);
    if (state.activeGroupId === groupId) state.activeGroupId = null;
    state.pages.forEach(p => {
      App.getPageCanvases(p).forEach(c => {
        const ann = c.annotations || App.makeAnnotations();
        Object.values(ann.counterMarkers || {}).forEach(arr => arr.forEach(m => { if ((m.group || null) === groupId) m.group = null; }));
        (ann.quickLines || []).forEach(q => { if ((q.group || null) === groupId) q.group = null; });
        (ann.polylines || []).forEach(poly => { if ((poly.group || null) === groupId) poly.group = null; });
      });
    });
    App.markProjectDirty();
    App.updateUI();
    App.renderAnnotations();
    return true;
  }

  // Modal close / confirm bindings (moved from app.js's zone & page-action
  // handler block; the elements exist at load, handlers fire on user action).
  document.getElementById('counterLineTypeDetailsClose').onclick = () => { counterLineTypeDetailsItem = null; App.hideModal('counterLineTypeDetailsModal'); };
  document.getElementById('linePropertiesClose').onclick = () => closeLinePropertiesModal();
  // Backdrop click closes like Close/Cancel (Tier-3 B1 / J4) — routed through
  // the buttons so the pending-state resets fire. The delete-confirm overlay
  // sits ON TOP of the details dialog, so a backdrop click only reaches (and
  // closes) the top one.
  document.getElementById('counterLineTypeDetailsModal').onclick = (e) => {
    if (e.target === e.currentTarget) document.getElementById('counterLineTypeDetailsClose').click();
  };
  document.getElementById('deleteCounterLineTypeConfirmModal').onclick = (e) => {
    if (e.target === e.currentTarget) document.getElementById('deleteCounterLineTypeCancel').click();
  };
  document.getElementById('deleteCounterLineTypeCancel').onclick = () => { App.hideModal('deleteCounterLineTypeConfirmModal'); pendingDeleteCounterLineType = null; };
  document.getElementById('deleteCounterLineTypeConfirm').onclick = () => {
    App.hideModal('deleteCounterLineTypeConfirmModal');
    const pending = pendingDeleteCounterLineType;
    pendingDeleteCounterLineType = null;
    if (pending) {
      performDeleteCounterLineType(pending.kind, pending.item);
      App.hideModal('counterLineTypeDetailsModal');
    }
  };

  App.openCounterLineTypeDetailsModal = openCounterLineTypeDetailsModal;
  App.openLinePropertiesModal = openLinePropertiesModal;
  App.closeLinePropertiesModal = closeLinePropertiesModal;
  App.deleteGroup = deleteGroup;
  // Core-function -> feature callback: hideModal('counterLineTypeDetailsModal')
  // resets the private details item through this.
  App.onCounterLineTypeDetailsHidden = () => { counterLineTypeDetailsItem = null; };
  // Feature -> feature getter: the shared custom-icon upload handler in
  // features/custom-icon-upload.js refreshes the open details modal's icon
  // grid through this.
  App.getCounterLineTypeDetailsItem = () => counterLineTypeDetailsItem;
})();

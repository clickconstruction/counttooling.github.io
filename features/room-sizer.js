/*
 * features/room-sizer.js - the Room Sizer feature: draw room boxes on the plan,
 * assign each a ceiling height and a Room, and get per-room volumetric totals
 * (sidebar section, on-canvas labels, legend rows, report/summary block).
 *
 * Owns: the Room Box modal (#roomBoxModal: create + edit, recent-height chips,
 * room choose/create), the Room edit modal (#roomEditModal: rename/recolor +
 * delete via #roomDeleteConfirmModal), the Rooms sidebar section
 * (#roomsSection), and the totals computation (getRoomVolumeTotals) consumed
 * by report.js. The drawing tool itself (TOOL.ROOM two-corner click path,
 * rubber-band preview, committed-box rendering, hit testing) stays in app.js
 * with the other canvas-event code; it hands off here via App.openRoomBoxModal
 * / App.openRoomBoxModalForEdit.
 *
 * Data model: `state.rooms[]` = { id, name, color } (palette, rides save/load/
 * export/import/undo beside groups); each canvas's `annotations.roomBoxes[]` =
 * { x1, y1, x2, y2, heightFt, roomId, id } in PDF-space. All dimensions are
 * reported in FEET (roomBoxDimsFeet, geometry.js) per the sum-in-feet
 * invariant. `recentRoomHeights` persists in localStorage (max 5).
 *
 * DUCT unit D7 (DUCT-PLAN §7/§3): rooms may additionally carry `roomType`
 * (a ROOM_TYPE_CFM_PER_SQFT key, set on the Edit Room dialog) and
 * `targetCfmOverride` (a CFM number; override wins over area × rate). Both
 * are DELETED when unset — a typeless room's object is byte-identical to
 * pre-D7 (the D4 groups system-field recipe), and rooms serialize wholesale
 * on every existing path so the fields ride save/load/export/import free.
 * getRoomAirBalance() derives the needs/served rows (duct-model's
 * roomTargetCfm/roomServedCfm over App.collectDuctDevices' markers) and the
 * Rooms sidebar rows grow a "needs 450 · served 300 ⚠" badge (⚠ only when
 * under-served beyond duct-model's DUCT_BALANCE_TOLERANCE).
 * DELIBERATELY OUT OF SCOPE (D7): the legend's room rows do NOT carry the ⚠ —
 * canvas-draw's computeLegendRows is per-page and pure over its deps seam,
 * while a room's target derives from its PROJECT-wide floor area, so the
 * badge would need a new cross-page dep on the draw core (and re-baselining
 * risk) for one glyph; the sidebar badge is the §3 surface for now.
 *
 * Loaded as a classic <script src="/features/room-sizer.js"> AFTER app.js.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  // Sticky defaults so the draw-assign-draw loop is two clicks: the previous
  // box's height and room are preselected for the next one. Reset on new modal
  // open only when the palette no longer has them.
  let lastRoomId = null;
  let lastHeightFt = null;
  let editingRoom = null;   // room targeted by #roomEditModal

  function fmtVol(v) { return (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1)) + ' ft³'; }
  function fmtArea(v) { return (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1)) + ' ft²'; }
  function fmtFtIn(v) { return App.formatFeetInchesFromVal(v, 'ft'); }

  function saveRecentHeights() {
    try { localStorage.setItem('recentRoomHeights', JSON.stringify(App.state.recentRoomHeights || [])); } catch (_) { /* quota */ }
  }
  function pushRecentHeight(h) {
    if (!(h > 0)) return;
    const state = App.state;
    state.recentRoomHeights = [h, ...(state.recentRoomHeights || []).filter(x => x !== h)].slice(0, 5);
    saveRecentHeights();
  }

  function nextRoomColor() {
    return App.COLORS[(App.state.rooms || []).length % App.COLORS.length];
  }

  // Per-room totals across pages/canvases. Walks the REAL canvas annotation
  // arrays (not merged copies) so the sidebar rows can mutate boxes in place.
  // opts { pageIndices?, getAnnotations? } mirror the report.js summary
  // contract: when getAnnotations is supplied (report path) the returned boxes
  // are read-only aggregates.
  function getRoomVolumeTotals(opts) {
    const state = App.state;
    const pageIndices = opts?.pageIndices || (state.pages || []).map((_, i) => i);
    const byRoom = new Map();
    const roomFor = (id) => (state.rooms || []).find(r => r.id === id);
    const addBox = (b, ann, pageIdx) => {
      const room = roomFor(b.roomId);
      const key = room ? room.id : '__unassigned__';
      if (!byRoom.has(key)) {
        byRoom.set(key, {
          id: room?.id || null,
          name: room?.name || 'Unassigned',
          color: room?.color || '#47c88e',
          boxes: [], areaSqFt: 0, volumeCuFt: 0, missingScale: false
        });
      }
      const entry = byRoom.get(key);
      const dims = App.roomBoxDimsFeet(b, App.getEffectiveScaleForLine(ann, b, false, pageIdx));
      if (dims) {
        entry.areaSqFt += dims.areaSqFt;
        entry.volumeCuFt += dims.volumeCuFt;
      } else {
        entry.missingScale = true;
      }
      entry.boxes.push({ box: b, ann, pageIdx, dims });
    };
    pageIndices.forEach(pageIdx => {
      if (opts?.getAnnotations) {
        const ann = opts.getAnnotations(pageIdx);
        (ann?.roomBoxes || []).forEach(b => addBox(b, ann, pageIdx));
      } else {
        const page = state.pages[pageIdx];
        App.getPageCanvases(page).forEach(c => {
          const ann = c.annotations;
          (ann?.roomBoxes || []).forEach(b => addBox(b, ann, pageIdx));
        });
      }
    });
    // Palette order first, then any orphaned "Unassigned" tail.
    const out = [];
    (state.rooms || []).forEach(r => { if (byRoom.has(r.id)) out.push(byRoom.get(r.id)); });
    if (byRoom.has('__unassigned__')) out.push(byRoom.get('__unassigned__'));
    return out;
  }

  // ---- Room Box modal (create + edit) --------------------------------------

  // The Room picker: a scrollable single-select list (radio-style) with the
  // "+ New room" button living in the header row beside the "Room" label.
  // selectedRoomChoice is a room id or '__new__' (name input revealed).
  let selectedRoomChoice = '__new__';

  function renderRoomPicker(selectedId) {
    const rooms = App.state.rooms || [];
    selectedRoomChoice = (selectedId !== '__new__' && rooms.some(r => r.id === selectedId)) ? selectedId : '__new__';
    const list = document.getElementById('roomBoxRoomList');
    list.style.display = rooms.length ? '' : 'none';
    // Floor-area + volume so far per room, shown on the row's right edge
    // ("25 ft² | 932 ft³"); rooms with no boxes yet show nothing rather than
    // a misleading 0.
    const totalsById = {};
    getRoomVolumeTotals().forEach(t => { if (t.id) totalsById[t.id] = t; });
    list.innerHTML = rooms.map(r => {
      const t = totalsById[r.id];
      return '<div class="room-picker-item' + (r.id === selectedRoomChoice ? ' selected' : '') + '" data-room-id="' + r.id + '">'
        + '<span class="room-swatch" style="background:' + (r.color || '#47c88e') + '"></span>'
        + '<span class="room-picker-name">' + escapeHtmlText(r.name || 'Room') + '</span>'
        + (t ? '<span class="room-picker-vol">' + fmtArea(t.areaSqFt) + ' | ' + fmtVol(t.volumeCuFt) + '</span>' : '')
        + '</div>';
    }).join('');
    list.querySelectorAll('.room-picker-item').forEach(item => {
      item.onclick = () => {
        selectedRoomChoice = item.dataset.roomId;
        list.querySelectorAll('.room-picker-item').forEach(x => x.classList.toggle('selected', x === item));
        document.getElementById('roomBoxNewRoomNameGroup').style.display = 'none';
      };
    });
    document.getElementById('roomBoxNewRoomNameGroup').style.display = selectedRoomChoice === '__new__' ? '' : 'none';
  }
  function escapeHtmlText(s) {
    return App.escapeHtml(s);
  }
  function renderRecentHeightChips() {
    const row = document.getElementById('roomBoxRecentHeights');
    const recents = App.state.recentRoomHeights || [];
    row.style.display = recents.length ? '' : 'none';
    row.innerHTML = recents.map(h => '<button type="button" class="room-height-chip" data-h="' + h + '">' + fmtFtIn(h) + '</button>').join('');
    row.querySelectorAll('.room-height-chip').forEach(btn => {
      btn.onclick = () => {
        const h = parseFloat(btn.dataset.h);
        document.getElementById('roomBoxHeight').value = Number.isInteger(h) ? String(h) : h.toFixed(2);
      };
    });
  }
  // The modal's dims readout: a Length | Width | Height | Totals table with a
  // Volume row (needs the height) and a Floor Area row (doesn't). Length is
  // the box's longer side, Width the shorter — the way a room is spoken.
  function updateDimsPreview(rect, heightFt) {
    const state = App.state;
    const page = state.pages[state.currentPage];
    const ann = page ? App.getActiveAnnotations(page) : null;
    const dims = ann ? App.roomBoxDimsFeet({ ...rect, heightFt: heightFt || 0 }, App.getEffectiveScaleForLine(ann, rect, false, state.currentPage)) : null;
    const el = document.getElementById('roomBoxDimsPreview');
    if (!dims) { el.textContent = 'Set the page scale to size this box.'; return; }
    const lengthFt = Math.max(dims.widthFt, dims.lengthFt);
    const widthFt = Math.min(dims.widthFt, dims.lengthFt);
    const hCell = heightFt > 0 ? fmtFtIn(heightFt) : '—';
    const volCell = heightFt > 0 ? fmtVol(dims.areaSqFt * heightFt) + ' Air Volume' : 'enter height for air volume';
    el.innerHTML = '<table class="room-dims-table">'
      + '<tr><th>Length</th><th>Width</th><th>Height</th><th>Totals</th></tr>'
      + '<tr><td>' + fmtFtIn(lengthFt) + '</td><td>' + fmtFtIn(widthFt) + '</td><td>' + hCell + '</td><td>' + volCell + '</td></tr>'
      + '<tr><td>' + fmtFtIn(lengthFt) + '</td><td>' + fmtFtIn(widthFt) + '</td><td></td><td>' + fmtArea(dims.areaSqFt) + ' Floor Area</td></tr>'
      + '</table>';
  }
  function currentHeightInput() {
    return App.parseRealWorldLength(document.getElementById('roomBoxHeight').value, 'ft');
  }

  function openRoomBoxModal(rect) {
    const state = App.state;
    if (state.isViewer) return;
    // A ~zero-size box is a mis-click (drag-release + tap-same-spot both produce
    // them) — refuse the dialog instead of offering 0'-0" x 0'-0" (J7 friction #5).
    // Both dims must be under 6 logical px at the current zoom: a thin sliver
    // room (long in one dimension) stays legal.
    const zoom = state.zoom || 1;
    if (Math.abs(rect.x2 - rect.x1) * zoom < 6 && Math.abs(rect.y2 - rect.y1) * zoom < 6) return;
    state.pendingRoomBox = rect;
    state.pendingRoomBoxEdit = null;
    document.getElementById('roomBoxModalTitle').textContent = 'Room Size';
    document.getElementById('roomBoxDelete').style.display = 'none';
    const h = document.getElementById('roomBoxHeight');
    h.value = lastHeightFt > 0 ? (Number.isInteger(lastHeightFt) ? String(lastHeightFt) : lastHeightFt.toFixed(2)) : '';
    const rooms = state.rooms || [];
    const stillExists = lastRoomId && rooms.some(r => r.id === lastRoomId);
    renderRoomPicker(stillExists ? lastRoomId : '__new__');
    document.getElementById('roomBoxNewRoomName').value = '';
    renderRecentHeightChips();
    updateDimsPreview(rect, currentHeightInput() || 0);
    App.showModal('roomBoxModal');
    if (!(lastHeightFt > 0)) h.focus();
  }

  function openRoomBoxModalForEdit(index) {
    const state = App.state;
    if (state.isViewer) return;
    const page = state.pages[state.currentPage];
    const ann = page ? App.getActiveAnnotations(page) : null;
    const box = ann?.roomBoxes?.[index];
    if (!box) return;
    state.pendingRoomBox = null;
    state.pendingRoomBoxEdit = { ann, index };
    document.getElementById('roomBoxModalTitle').textContent = 'Edit Room Box';
    document.getElementById('roomBoxDelete').style.display = '';
    document.getElementById('roomBoxHeight').value = box.heightFt > 0 ? (Number.isInteger(box.heightFt) ? String(box.heightFt) : box.heightFt.toFixed(2)) : '';
    renderRoomPicker(box.roomId || '__new__');
    document.getElementById('roomBoxNewRoomName').value = '';
    renderRecentHeightChips();
    updateDimsPreview(box, box.heightFt || 0);
    App.showModal('roomBoxModal');
  }

  // Resolve the modal's room selection, creating a new palette room if asked.
  // Returns null (with a toast) when a new room has no name.
  function resolveSelectedRoom() {
    if (selectedRoomChoice !== '__new__' && (App.state.rooms || []).some(r => r.id === selectedRoomChoice)) return selectedRoomChoice;
    const name = document.getElementById('roomBoxNewRoomName').value.trim();
    if (!name) { App.showToast('Enter a name for the new room.'); return null; }
    const state = App.state;
    const existing = (state.rooms || []).find(r => (r.name || '').toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const room = { id: App.uid(), name, color: nextRoomColor() };
    state.rooms = state.rooms || [];
    state.rooms.push(room);
    return room.id;
  }

  document.getElementById('roomBoxCancel').onclick = () => {
    App.hideModal('roomBoxModal');
    App.state.pendingRoomBox = null;
    App.state.pendingRoomBoxEdit = null;
  };
  document.getElementById('roomBoxHeight').oninput = () => {
    const state = App.state;
    const rect = state.pendingRoomBox || state.pendingRoomBoxEdit?.ann?.roomBoxes?.[state.pendingRoomBoxEdit.index];
    if (rect) updateDimsPreview(rect, currentHeightInput() || 0);
  };
  document.getElementById('roomBoxNewRoomBtn').onclick = () => {
    selectedRoomChoice = '__new__';
    document.querySelectorAll('#roomBoxRoomList .room-picker-item').forEach(x => x.classList.remove('selected'));
    document.getElementById('roomBoxNewRoomNameGroup').style.display = '';
    document.getElementById('roomBoxNewRoomName').focus();
  };
  document.getElementById('roomBoxApply').onclick = () => {
    const state = App.state;
    const heightFt = currentHeightInput();
    if (!(heightFt > 0)) { App.showToast('Enter a ceiling height (e.g. 9.5 or 9\'6).'); return; }
    const roomId = resolveSelectedRoom();
    if (!roomId) return;
    const edit = state.pendingRoomBoxEdit;
    const pending = state.pendingRoomBox;
    if (edit) {
      const box = edit.ann?.roomBoxes?.[edit.index];
      if (box) {
        App.pushUndoSnapshot();
        box.heightFt = heightFt;
        box.roomId = roomId;
        App.markProjectDirty();
      }
    } else if (pending) {
      const page = state.pages[state.currentPage];
      const canvas = page && App.ensureActiveCanvas(page);
      if (canvas) {
        App.pushUndoSnapshot();
        if (!canvas.annotations.roomBoxes) canvas.annotations.roomBoxes = [];
        canvas.annotations.roomBoxes.push({ x1: pending.x1, y1: pending.y1, x2: pending.x2, y2: pending.y2, heightFt, roomId, id: App.uid() });
        App.markProjectDirty();
      }
      // Tool stays TOOL.ROOM: the workflow is draw -> assign -> draw the next box.
    }
    lastRoomId = roomId;
    lastHeightFt = heightFt;
    pushRecentHeight(heightFt);
    state.pendingRoomBox = null;
    state.pendingRoomBoxEdit = null;
    App.hideModal('roomBoxModal');
    App.renderAnnotations();
    App.updateUI();
  };
  document.getElementById('roomBoxDelete').onclick = () => {
    const state = App.state;
    const edit = state.pendingRoomBoxEdit;
    if (edit?.ann?.roomBoxes?.[edit.index]) {
      App.pushUndoSnapshot();
      edit.ann.roomBoxes.splice(edit.index, 1);
      App.markProjectDirty();
    }
    state.pendingRoomBox = null;
    state.pendingRoomBoxEdit = null;
    App.hideModal('roomBoxModal');
    App.renderAnnotations();
    App.updateUI();
  };

  // ---- Room air balance (DUCT unit D7) --------------------------------------

  // Guard: duct-model.js loads before app.js in the shell, but stay defensive
  // (the feature must not throw if the pure module is ever absent).
  function balanceReady() {
    return typeof roomTargetCfm === 'function' && typeof roomServedCfm === 'function';
  }

  /**
   * Per-room needs/served rows for every room WITH a target CFM (roomType
   * rate × total floor area, per-room override wins). served = the CFM
   * devices (App.collectDuctDevices — placed markers of CFM counter types)
   * whose markers lie inside the room's boxes, page-scoped like every rooms
   * total. Rooms without a target return no row (clean absence — zero
   * behavior change for typeless rooms).
   * Returns [{ id, name, targetCfm, servedCfm, under }].
   */
  function getRoomAirBalance() {
    if (!balanceReady() || !App.collectDuctDevices) return [];
    const rooms = App.state.rooms || [];
    if (!rooms.some(r => r.roomType || r.targetCfmOverride > 0)) return [];
    const devicesByPage = new Map();
    const devicesFor = (pi) => {
      if (!devicesByPage.has(pi)) {
        devicesByPage.set(pi, App.collectDuctDevices(pi).map(d => ({ ...d, pageIdx: pi })));
      }
      return devicesByPage.get(pi);
    };
    const out = [];
    getRoomVolumeTotals().forEach(t => {
      if (!t.id) return;
      const room = rooms.find(r => r.id === t.id);
      const target = roomTargetCfm(room, t.areaSqFt);
      if (!(target > 0)) return;
      const boxes = t.boxes.map(e => ({ x1: e.box.x1, y1: e.box.y1, x2: e.box.x2, y2: e.box.y2, pageIdx: e.pageIdx }));
      const devices = [...new Set(boxes.map(b => b.pageIdx))].flatMap(devicesFor);
      const served = roomServedCfm(boxes, devices);
      const bal = roomAirBalance(target, served);
      if (bal) out.push({ id: t.id, name: t.name, targetCfm: bal.targetCfm, servedCfm: bal.servedCfm, under: bal.under });
    });
    return out;
  }

  // ---- Room edit modal (rename / recolor / delete) --------------------------

  // D7: the room-type dropdown, built from duct-model's editable
  // ROOM_TYPE_CFM_PER_SQFT data table (a table edit flows straight through).
  function renderRoomTypeOptions(selected) {
    const sel = document.getElementById('roomEditType');
    if (!sel) return;
    let html = '<option value="">None</option>';
    if (balanceReady()) {
      Object.entries(ROOM_TYPE_CFM_PER_SQFT).forEach(([key, t]) => {
        html += '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>'
          + escapeHtmlText(t.label) + (t.cfmPerSqFt > 0 ? ' — ' + t.cfmPerSqFt + ' CFM/ft²' : '') + '</option>';
      });
    }
    sel.innerHTML = html;
    sel.value = selected && balanceReady() && ROOM_TYPE_CFM_PER_SQFT[selected] ? selected : '';
  }

  // The Target CFM input shows only once a type is chosen; empty means "use
  // the derived area × rate", surfaced as the placeholder (Custom has no
  // rate — the input is the number).
  function syncRoomEditTargetRow() {
    const group = document.getElementById('roomEditTargetGroup');
    const input = document.getElementById('roomEditTargetCfm');
    if (!group || !input) return;
    const type = document.getElementById('roomEditType').value;
    group.style.display = type ? '' : 'none';
    if (!type || !balanceReady() || !editingRoom) return;
    const area = getRoomVolumeTotals().find(t => t.id === editingRoom.id)?.areaSqFt || 0;
    const derived = roomTargetCfm({ roomType: type }, area);
    input.placeholder = derived > 0 ? derived + ' (from ' + Math.round(area) + ' ft²)' : 'CFM';
  }

  function openRoomEditModal(roomId) {
    const room = (App.state.rooms || []).find(r => r.id === roomId);
    if (!room || App.state.isViewer) return;
    editingRoom = room;
    document.getElementById('roomEditName').value = room.name || '';
    document.getElementById('roomEditSwatch').style.background = room.color || '#47c88e';
    renderRoomTypeOptions(room.roomType || '');
    const cfmEl = document.getElementById('roomEditTargetCfm');
    if (cfmEl) cfmEl.value = room.targetCfmOverride > 0 ? room.targetCfmOverride : '';
    syncRoomEditTargetRow();
    App.showModal('roomEditModal');
  }
  document.getElementById('roomEditSwatch').onclick = () => {
    if (!editingRoom) return;
    App.showLineColorModal(editingRoom.color || '#47c88e', (color) => {
      document.getElementById('roomEditSwatch').style.background = color;
      document.getElementById('roomEditSwatch').dataset.pickedColor = color;
    });
  };
  document.getElementById('roomEditCancel').onclick = () => {
    editingRoom = null;
    delete document.getElementById('roomEditSwatch').dataset.pickedColor;
    App.hideModal('roomEditModal');
  };
  // D7: re-derive the placeholder / row visibility as the type changes
  // (static DOM, bound once at load like the rest of this modal).
  document.getElementById('roomEditType').addEventListener('change', syncRoomEditTargetRow);
  document.getElementById('roomEditSave').onclick = () => {
    if (!editingRoom) { App.hideModal('roomEditModal'); return; }
    const name = document.getElementById('roomEditName').value.trim();
    const picked = document.getElementById('roomEditSwatch').dataset.pickedColor;
    App.pushUndoSnapshot();
    if (name) editingRoom.name = name;
    if (picked) editingRoom.color = picked;
    // D7 CFM fields, read at Save. Unset fields are DELETED, not nulled, so a
    // typeless room stays byte-identical to pre-D7 (the D4 groups recipe).
    const type = document.getElementById('roomEditType').value;
    const cfmRaw = parseFloat(document.getElementById('roomEditTargetCfm').value);
    if (type) {
      editingRoom.roomType = type;
      if (Number.isFinite(cfmRaw) && cfmRaw > 0) editingRoom.targetCfmOverride = cfmRaw;
      else delete editingRoom.targetCfmOverride;
    } else {
      delete editingRoom.roomType;
      delete editingRoom.targetCfmOverride;
    }
    editingRoom = null;
    delete document.getElementById('roomEditSwatch').dataset.pickedColor;
    App.markProjectDirty();
    App.hideModal('roomEditModal');
    App.renderAnnotations();
    App.updateUI();
  };
  document.getElementById('roomEditDelete').onclick = () => {
    if (!editingRoom) return;
    let count = 0;
    (App.state.pages || []).forEach(p => App.getPageCanvases(p).forEach(c => {
      count += (c.annotations?.roomBoxes || []).filter(b => b.roomId === editingRoom.id).length;
    }));
    document.getElementById('roomDeleteConfirmText').textContent =
      'Delete "' + (editingRoom.name || 'Room') + '"' + (count ? ' and its ' + count + ' box(es) on the plan?' : '?');
    App.hideModal('roomEditModal');
    App.showModal('roomDeleteConfirmModal');
  };
  document.getElementById('roomDeleteCancel').onclick = () => {
    editingRoom = null;
    App.hideModal('roomDeleteConfirmModal');
  };
  document.getElementById('roomDeleteConfirm').onclick = () => {
    const room = editingRoom;
    editingRoom = null;
    App.hideModal('roomDeleteConfirmModal');
    if (!room) return;
    App.pushUndoSnapshot();
    (App.state.pages || []).forEach(p => App.getPageCanvases(p).forEach(c => {
      const arr = c.annotations?.roomBoxes;
      if (arr) c.annotations.roomBoxes = arr.filter(b => b.roomId !== room.id);
    }));
    App.state.rooms = (App.state.rooms || []).filter(r => r.id !== room.id);
    if (lastRoomId === room.id) lastRoomId = null;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  };

  // ---- Rooms sidebar section -------------------------------------------------

  function renderRoomsList() {
    const section = document.getElementById('roomsSection');
    if (!section) return;
    const state = App.state;
    const totals = getRoomVolumeTotals();
    // Invisible until the first box is drawn: existing takeoffs see no new UI.
    section.style.display = totals.length ? '' : 'none';
    if (!totals.length) return;
    const collapsed = !!state.roomsListCollapsed;
    document.getElementById('roomsCollapseIcon').textContent = collapsed ? '▶' : '▼';
    const list = document.getElementById('roomsList');
    list.style.display = collapsed ? 'none' : '';
    if (collapsed) return;
    // D7 air-balance badges: one lookup for the whole render pass.
    const balanceById = new Map(getRoomAirBalance().map(b => [b.id, b]));
    list.innerHTML = totals.map((t, ti) => {
      const totalLine = t.missingScale
        ? fmtArea(t.areaSqFt) + ' · ' + fmtVol(t.volumeCuFt) + ' (some boxes have no scale)'
        : fmtArea(t.areaSqFt) + ' · ' + fmtVol(t.volumeCuFt);
      const boxRows = t.boxes.map((entry, bi) => {
        const d = entry.dims;
        const dimsTxt = d
          ? fmtFtIn(d.widthFt) + ' × ' + fmtFtIn(d.lengthFt) + (d.heightFt > 0 ? ' × ' + fmtFtIn(d.heightFt) : '') + (d.heightFt > 0 ? ' = ' + fmtVol(d.volumeCuFt) : '')
          : 'no scale';
        return '<div class="room-box-row" data-ti="' + ti + '" data-bi="' + bi + '" title="Click to view; ✕ deletes">'
          + '<span class="room-box-page">p' + (entry.pageIdx + 1) + '</span>'
          + '<span class="room-box-dims">' + dimsTxt + '</span>'
          + (state.isViewer ? '' : '<button type="button" class="room-box-delete" aria-label="Delete box">✕</button>')
          + '</div>';
      }).join('');
      // D7 (DUCT-PLAN §3): the air-balance badge — "needs 450 · served 300 ⚠"
      // — only on rooms with a target CFM; ⚠ only when under-served beyond
      // the ~10% tolerance (duct-model roomAirBalance).
      const bal = t.id ? balanceById.get(t.id) : null;
      const balanceRow = bal
        ? '<div class="room-balance-row' + (bal.under ? ' under' : '') + '">needs '
          + Math.round(bal.targetCfm).toLocaleString() + ' · served '
          + Math.round(bal.servedCfm).toLocaleString() + (bal.under ? ' ⚠' : '') + '</div>'
        : '';
      return '<div class="room-row-wrap">'
        + '<div class="room-row" data-ti="' + ti + '"' + (t.id ? ' title="Click to edit room"' : '') + '>'
        + '<span class="room-swatch" style="background:' + t.color + '"></span>'
        + '<span class="room-row-name">' + escapeHtmlText(t.name) + '</span>'
        + '<span class="room-row-total">' + totalLine + '</span>'
        + '</div>'
        + balanceRow
        + boxRows
        + '</div>';
    }).join('');
    list.querySelectorAll('.room-row').forEach(row => {
      row.onclick = () => {
        const t = totals[Number(row.dataset.ti)];
        if (t?.id) openRoomEditModal(t.id);
      };
    });
    list.querySelectorAll('.room-box-row').forEach(row => {
      const entry = totals[Number(row.dataset.ti)]?.boxes[Number(row.dataset.bi)];
      if (!entry) return;
      row.onclick = () => {
        if (state.currentPage !== entry.pageIdx) {
          state.currentPage = entry.pageIdx;
          App.renderPdf();
          App.updateUI();
        }
      };
      const del = row.querySelector('.room-box-delete');
      if (del) del.onclick = (e) => {
        e.stopPropagation();
        const arr = entry.ann?.roomBoxes;
        const idx = arr ? arr.indexOf(entry.box) : -1;
        if (idx >= 0) {
          App.pushUndoSnapshot();
          arr.splice(idx, 1);
          App.markProjectDirty();
          App.renderAnnotations();
          App.updateUI();
        }
      };
    });
  }
  document.getElementById('roomsSectionTitle').onclick = () => {
    App.state.roomsListCollapsed = !App.state.roomsListCollapsed;
    renderRoomsList();
  };

  App.openRoomBoxModal = openRoomBoxModal;
  App.openRoomBoxModalForEdit = openRoomBoxModalForEdit;
  App.renderRoomsList = renderRoomsList;
  App.getRoomVolumeTotals = getRoomVolumeTotals;
  App.getRoomAirBalance = getRoomAirBalance;   // D7: duct-tool's equipment-first line + the spec seam
})();

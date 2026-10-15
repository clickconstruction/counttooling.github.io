/*
 * features/groups.js - the Groups modals, extracted from the app.js IIFE as the
 * fourteenth feature-file split under the window.App registry pattern. Two
 * intertwined modals move together: the group create/edit modal (`#groupModal`)
 * and the assign-item-to-group modal (`#groupAssignModal`).
 *
 * Loaded as a classic <script src="features/groups.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openGroupModal + openGroupAssignModal + onGroupModalHidden + deleteGroup back
 * onto App, and binds the #addGroup opener + the groupModal / groupAssign
 * handlers at load.
 *
 * The three pieces of group-modal state (pendingGroupEdit,
 * pendingGroupAssignTarget, openedGroupModalFromAssign) live here as private
 * `let`s. openedGroupModalFromAssign is the only one the app.js core touches: the
 * `hideModal('groupModal')` reset hook now calls the registered
 * App.onGroupModalHidden() instead of mutating the flag directly -- the first
 * core-function -> feature callback in this codebase.
 *
 * Scope is the two modals plus deleteGroup, the heavier mutation that clears the
 * group off every annotation and out of every ghost (Typical). deleteGroup
 * lived in features/item-details.js until MAP-GHOST-DELETE (DECOMPOSITION_MAP
 * R17) moved it home; its callers read App.deleteGroup at call time, so load
 * order does not matter. The "Show group colors" sidebar toggle
 * (#showGroupColorsBtn) stays in app.js. The two external callers -- the groups-list Edit button (render code)
 * and the canvas right-click "Assign to Group" -- reach these via
 * App.openGroupModal / App.openGroupAssignModal at call time.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  let pendingGroupEdit = null;
  let pendingGroupAssignTarget = null;
  let openedGroupModalFromAssign = false;

  // DUCT unit D4 (DUCT-PLAN §2): the plenum-return row only shows once an
  // equipment tag is entered — plenum return is a per-SYSTEM call, and a
  // group without a tag is a plain group.
  function syncPlenumRowVisibility() {
    const row = document.getElementById('groupModalPlenumRow');
    const tagEl = document.getElementById('groupModalEquipTag');
    if (row && tagEl) row.style.display = tagEl.value.trim() ? '' : 'none';
  }

  function openGroupModal(g) {
    const state = App.state;
    pendingGroupEdit = g;
    const titleEl = document.getElementById('groupModalTitle');
    const nameEl = document.getElementById('groupModalName');
    const colorRow = document.getElementById('groupModalColorRow');
    const deleteBtn = document.getElementById('groupModalDelete');
    titleEl.textContent = g ? 'Edit Group' : 'Add Group';
    nameEl.value = g ? (g.name || '') : '';
    // System fields (D4): tag + capacity CFM + plenum-return toggle.
    document.getElementById('groupModalEquipTag').value = g ? (g.equipmentTag || '') : '';
    document.getElementById('groupModalCapacityCfm').value = g && g.capacityCfm != null ? g.capacityCfm : '';
    document.getElementById('groupModalEspInWg').value = g && g.espInWg > 0 ? g.espInWg : '';   // D11
    document.getElementById('groupModalPlenumBtn').setAttribute('aria-pressed', String(!!(g && g.plenumReturn)));
    document.getElementById('groupModalAlternateBtn').setAttribute('aria-pressed', String(!!(g && g.alternate)));   // ALT-GROUPS
    syncPlenumRowVisibility();
    App.renderGroupCircuitFields && App.renderGroupCircuitFields(g);   // S4 circuit row
    const groups = state.groups || [];
    const defaultColor = g ? (g.color || App.COLORS[0]) : (App.COLORS[groups.length % App.COLORS.length]);
    colorRow.innerHTML = App.COLORS.map((c, i) => '<span class="color-swatch' + (c === defaultColor ? ' selected' : '') + '" data-color="' + c + '" style="background:' + c + '"></span>').join('');
    colorRow.querySelectorAll('.color-swatch').forEach(s => s.onclick = () => {
      colorRow.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
    });
    if (deleteBtn) deleteBtn.style.display = g ? '' : 'none';
    App.showModal('groupModal');
    // after showModal: focusing a field in a hidden dialog does nothing, and "In Name, type Kitchen"
    // typed into the page as hotkeys (by hand, 2026-09-25)
    requestAnimationFrame(() => { if (!nameEl.offsetParent) return; nameEl.focus(); if (!g) nameEl.select(); });
  }

  function refreshGroupAssignButtons() {
    if (!pendingGroupAssignTarget) return;
    const state = App.state;
    const container = document.getElementById('groupAssignButtons');
    if (!container) return;
    const groups = state.groups || [];
    const item = pendingGroupAssignTarget.item;
    const targetGroupId = (item.group || null) || '';
    container.innerHTML = '';
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'group-assign-btn none' + (targetGroupId === '' ? ' selected' : '');
    noneBtn.dataset.groupId = '';
    noneBtn.textContent = 'None';
    noneBtn.onclick = () => { container.querySelectorAll('.group-assign-btn').forEach(b => b.classList.remove('selected')); noneBtn.classList.add('selected'); };
    container.appendChild(noneBtn);
    groups.forEach(g => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'group-assign-btn' + (targetGroupId === g.id ? ' selected' : '');
      btn.dataset.groupId = g.id;
      btn.style.background = (g.color || App.COLORS[0]);
      btn.style.color = '#fff';
      btn.style.textShadow = '0 1px 1px rgba(0,0,0,0.3)';
      btn.textContent = (g.name || 'Group') + (g.alternate ? ' · ALT' : '');   // ALT-GROUPS: the mark follows the name
      btn.onclick = () => { container.querySelectorAll('.group-assign-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); };
      container.appendChild(btn);
    });
  }
  function openGroupAssignModal(item) {
    const state = App.state;
    pendingGroupAssignTarget = { item };
    const container = document.getElementById('groupAssignButtons');
    const groups = state.groups || [];
    const currentGroupId = (item.group || null) || '';
    container.innerHTML = '';
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'group-assign-btn none' + (currentGroupId === '' ? ' selected' : '');
    noneBtn.dataset.groupId = '';
    noneBtn.textContent = 'None';
    noneBtn.onclick = () => {
      container.querySelectorAll('.group-assign-btn').forEach(b => b.classList.remove('selected'));
      noneBtn.classList.add('selected');
    };
    container.appendChild(noneBtn);
    groups.forEach(g => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'group-assign-btn' + (currentGroupId === g.id ? ' selected' : '');
      btn.dataset.groupId = g.id;
      btn.style.background = (g.color || App.COLORS[0]);
      btn.style.color = '#fff';
      btn.style.textShadow = '0 1px 1px rgba(0,0,0,0.3)';
      btn.textContent = (g.name || 'Group') + (g.alternate ? ' · ALT' : '');   // ALT-GROUPS: the mark follows the name
      btn.onclick = () => {
        container.querySelectorAll('.group-assign-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      container.appendChild(btn);
    });
    App.showModal('groupAssignModal');
  }

  document.getElementById('addGroup').onclick = () => openGroupModal(null);
  // Backdrop click closes like Cancel (Tier-3 B1 / J4) — routed through the
  // Cancel buttons so the pending-state resets and the from-assign refresh
  // fire. groupModal stacks OVER groupAssignModal ("+ Add group"), and each
  // overlay only sees clicks on its own backdrop, so a backdrop click closes
  // just the top dialog.
  document.getElementById('groupModal').onclick = (e) => {
    if (e.target === e.currentTarget) document.getElementById('groupModalCancel').click();
  };
  document.getElementById('groupAssignModal').onclick = (e) => {
    if (e.target === e.currentTarget) document.getElementById('groupAssignCancel').click();
  };
  document.getElementById('groupModalCancel').onclick = () => {
    if (openedGroupModalFromAssign) { refreshGroupAssignButtons(); openedGroupModalFromAssign = false; }
    pendingGroupEdit = null;
    App.hideModal('groupModal');
  };
  document.getElementById('groupModalDelete').onclick = async () => {
    if (pendingGroupEdit && await App.deleteGroup(pendingGroupEdit.id)) {
      if (openedGroupModalFromAssign) { refreshGroupAssignButtons(); openedGroupModalFromAssign = false; }
      pendingGroupEdit = null;
      App.hideModal('groupModal');
      App.updateUI();
      App.renderAnnotations();
    }
  };
  // D4 system fields, read at Done. A group with no tag stays exactly
  // { id, name, color } — the fields are DELETED, not nulled, so existing
  // projects' group objects are byte-identical (zero behavior change).
  // D11: `espInWg` (the unit's available external static, in. w.g.) is set
  // ONLY when positive and deleted otherwise, so a D4-era system group with
  // no ESP keeps its shape too. It arms the Bid Check "Static path" row.
  function applySystemFieldsTo(grp) {
    const equipTag = document.getElementById('groupModalEquipTag').value.trim();
    const cfmRaw = parseFloat(document.getElementById('groupModalCapacityCfm').value);
    const espRaw = parseFloat(document.getElementById('groupModalEspInWg').value);
    if (equipTag) {
      grp.equipmentTag = equipTag;
      grp.capacityCfm = Number.isFinite(cfmRaw) && cfmRaw > 0 ? cfmRaw : null;
      grp.plenumReturn = document.getElementById('groupModalPlenumBtn').getAttribute('aria-pressed') === 'true';
      if (Number.isFinite(espRaw) && espRaw > 0) grp.espInWg = espRaw; else delete grp.espInWg;
    } else {
      delete grp.equipmentTag;
      delete grp.capacityCfm;
      delete grp.plenumReturn;
      delete grp.espInWg;
    }
  }

  // ALT-GROUPS (2026-09-29): the Alternate switch. Set only when on and DELETED
  // when off, the D4 rule, so a group that was never an alternate stays
  // { id, name, color } and old projects are byte-identical.
  function applyAlternateTo(grp) {
    if (document.getElementById('groupModalAlternateBtn').getAttribute('aria-pressed') === 'true') grp.alternate = true;
    else delete grp.alternate;
  }

  document.getElementById('groupModalDone').onclick = () => {
    const state = App.state;
    const name = document.getElementById('groupModalName').value.trim() || 'Group';
    const colorSel = document.querySelector('#groupModalColorRow .color-swatch.selected');
    const color = colorSel ? colorSel.dataset.color : App.COLORS[0];
    if (pendingGroupEdit) {
      App.pushUndoSnapshot();
      pendingGroupEdit.name = name;
      pendingGroupEdit.color = color;
      applySystemFieldsTo(pendingGroupEdit);
      applyAlternateTo(pendingGroupEdit);
      App.applyGroupCircuitFields && App.applyGroupCircuitFields(pendingGroupEdit);
      App.markProjectDirty();
    } else {
      App.pushUndoSnapshot();
      const newGroup = { id: App.uid(), name, color };
      applySystemFieldsTo(newGroup);
      applyAlternateTo(newGroup);
      App.applyGroupCircuitFields && App.applyGroupCircuitFields(newGroup);
      if (!state.groups) state.groups = [];
      state.groups.push(newGroup);
      // Latch the per-project Groups gate on: without this, deleting the last
      // group would hide the whole Groups section mid-session.
      state.groupsEnabled = true;
      state.activeGroupId = newGroup.id;
      App.markProjectDirty();
    }
    if (openedGroupModalFromAssign) { refreshGroupAssignButtons(); openedGroupModalFromAssign = false; }
    pendingGroupEdit = null;
    App.hideModal('groupModal');
    App.updateUI();
    App.renderAnnotations();
  };

  // D4 system-field wiring (static DOM, bound once at load like the rest).
  document.getElementById('groupModalEquipTag').addEventListener('input', syncPlenumRowVisibility);
  document.getElementById('groupModalPlenumBtn').onclick = () => {
    const btn = document.getElementById('groupModalPlenumBtn');
    btn.setAttribute('aria-pressed', String(btn.getAttribute('aria-pressed') !== 'true'));
  };
  document.getElementById('groupModalAlternateBtn').onclick = () => {
    const btn = document.getElementById('groupModalAlternateBtn');
    btn.setAttribute('aria-pressed', String(btn.getAttribute('aria-pressed') !== 'true'));
  };

  document.getElementById('groupAssignAddGroup').onclick = () => {
    openedGroupModalFromAssign = true;
    openGroupModal(null);
  };
  document.getElementById('groupAssignCancel').onclick = () => { pendingGroupAssignTarget = null; App.hideModal('groupAssignModal'); };
  document.getElementById('groupAssignDone').onclick = () => {
    if (pendingGroupAssignTarget && pendingGroupAssignTarget.item) {
      const container = document.getElementById('groupAssignButtons');
      const sel = container.querySelector('.group-assign-btn.selected');
      const groupId = sel ? (sel.dataset.groupId || null) : null;
      App.pushUndoSnapshot();
      pendingGroupAssignTarget.item.group = groupId;
      App.markProjectDirty();
      App.updateUI();
      App.renderAnnotations();
    }
    pendingGroupAssignTarget = null;
    App.hideModal('groupAssignModal');
  };

  // Removes a group and clears its id off every mark, run and duct run on every
  // page and layer, and out of every ghost (Typical), so Stamp cannot put a
  // dangling group id back (MAP-GHOST-DELETE). Moved here from
  // features/item-details.js unchanged but for that ghost line (DECOMPOSITION_MAP R17).
  // B20: async — the confirm is the app's dialog now, so the ONE caller
  // (the groupModal Delete above) awaits the boolean.
  async function deleteGroup(groupId) {
    const state = App.state;
    const g = (state.groups || []).find(x => x.id === groupId);
    if (!g) return false;
    const count = App.countItemsInGroup(groupId);
    if (count > 0 && !(await App.confirmDialog({ title: 'Remove this group?', body: 'It has ' + count + ' item' + (count === 1 ? '' : 's') + '. They stay on the sheet and lose the group assignment.', confirmLabel: 'Remove group', danger: true }))) return false;
    App.pushUndoSnapshot();   // FULL snapshot — group removal clears assignments on every page
    state.groups = (state.groups || []).filter(x => x.id !== groupId);
    if (state.activeGroupId === groupId) state.activeGroupId = null;
    state.pages.forEach(p => {
      App.getPageCanvases(p).forEach(c => {
        const ann = c.annotations || App.makeAnnotations();
        Object.values(ann.counterMarkers || {}).forEach(arr => arr.forEach(m => { if ((m.group || null) === groupId) m.group = null; }));
        (ann.quickLines || []).forEach(q => { if ((q.group || null) === groupId) q.group = null; });
        (ann.polylines || []).forEach(poly => { if ((poly.group || null) === groupId) poly.group = null; });
        // DUCT unit D4: duct runs reference groups as their SYSTEM — clear
        // the inherited id so a deleted group leaves no dangling reference.
        (ann.ductRuns || []).forEach(run => { if ((run.systemGroupId || null) === groupId) run.systemGroupId = null; });
      });
    });
    App.purgeFromEveryGhost('group', groupId);
    App.markProjectDirty();
    App.updateUI();
    App.renderAnnotations();
    return true;
  }

  App.openGroupModal = openGroupModal;
  App.openGroupAssignModal = openGroupAssignModal;
  App.deleteGroup = deleteGroup;
  App.onGroupModalHidden = () => { openedGroupModalFromAssign = false; };
})();

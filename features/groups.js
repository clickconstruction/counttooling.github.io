/*
 * features/groups.js - the Groups modals, extracted from the app.js IIFE as the
 * fourteenth feature-file split under the window.App registry pattern. Two
 * intertwined modals move together: the group create/edit modal (`#groupModal`)
 * and the assign-item-to-group modal (`#groupAssignModal`).
 *
 * Loaded as a classic <script src="features/groups.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openGroupModal + openGroupAssignModal + onGroupModalHidden back onto App, and
 * binds the #addGroup opener + the groupModal / groupAssign handlers at load.
 *
 * The three pieces of group-modal state (pendingGroupEdit,
 * pendingGroupAssignTarget, openedGroupModalFromAssign) live here as private
 * `let`s. openedGroupModalFromAssign is the only one the app.js core touches: the
 * `hideModal('groupModal')` reset hook now calls the registered
 * App.onGroupModalHidden() instead of mutating the flag directly -- the first
 * core-function -> feature callback in this codebase.
 *
 * Scope is the two modals only. deleteGroup (a heavier mutation that clears the
 * group off every annotation) lives in features/item-details.js (split #25; its
 * App.deleteGroup registration moved there from app.js) and is reached via
 * App.deleteGroup at call time, so load order between the two files is irrelevant;
 * the "Show group colors" sidebar toggle (#showGroupColorsBtn) also stays in
 * app.js. The two external callers -- the groups-list Edit button (render code)
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

  function openGroupModal(g) {
    const state = App.state;
    pendingGroupEdit = g;
    const titleEl = document.getElementById('groupModalTitle');
    const nameEl = document.getElementById('groupModalName');
    const colorRow = document.getElementById('groupModalColorRow');
    const deleteBtn = document.getElementById('groupModalDelete');
    titleEl.textContent = g ? 'Edit Group' : 'Add Group';
    nameEl.value = g ? (g.name || '') : '';
    const groups = state.groups || [];
    const defaultColor = g ? (g.color || App.COLORS[0]) : (App.COLORS[groups.length % App.COLORS.length]);
    colorRow.innerHTML = App.COLORS.map((c, i) => '<span class="color-swatch' + (c === defaultColor ? ' selected' : '') + '" data-color="' + c + '" style="background:' + c + '"></span>').join('');
    colorRow.querySelectorAll('.color-swatch').forEach(s => s.onclick = () => {
      colorRow.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
    });
    if (deleteBtn) deleteBtn.style.display = g ? '' : 'none';
    nameEl.focus();
    App.showModal('groupModal');
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
      btn.textContent = g.name || 'Group';
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
      btn.textContent = g.name || 'Group';
      btn.onclick = () => {
        container.querySelectorAll('.group-assign-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      container.appendChild(btn);
    });
    App.showModal('groupAssignModal');
  }

  document.getElementById('addGroup').onclick = () => openGroupModal(null);
  document.getElementById('groupModalCancel').onclick = () => {
    if (openedGroupModalFromAssign) { refreshGroupAssignButtons(); openedGroupModalFromAssign = false; }
    pendingGroupEdit = null;
    App.hideModal('groupModal');
  };
  document.getElementById('groupModalDelete').onclick = () => {
    if (pendingGroupEdit && App.deleteGroup(pendingGroupEdit.id)) {
      if (openedGroupModalFromAssign) { refreshGroupAssignButtons(); openedGroupModalFromAssign = false; }
      pendingGroupEdit = null;
      App.hideModal('groupModal');
      App.updateUI();
      App.renderPdf();
    }
  };
  document.getElementById('groupModalDone').onclick = () => {
    const state = App.state;
    const name = document.getElementById('groupModalName').value.trim() || 'Group';
    const colorSel = document.querySelector('#groupModalColorRow .color-swatch.selected');
    const color = colorSel ? colorSel.dataset.color : App.COLORS[0];
    if (pendingGroupEdit) {
      App.pushUndoSnapshot();
      pendingGroupEdit.name = name;
      pendingGroupEdit.color = color;
      App.markProjectDirty();
    } else {
      App.pushUndoSnapshot();
      const newGroup = { id: App.uid(), name, color };
      if (!state.groups) state.groups = [];
      state.groups.push(newGroup);
      state.activeGroupId = newGroup.id;
      App.markProjectDirty();
    }
    if (openedGroupModalFromAssign) { refreshGroupAssignButtons(); openedGroupModalFromAssign = false; }
    pendingGroupEdit = null;
    App.hideModal('groupModal');
    App.updateUI();
    App.renderPdf();
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
      App.renderPdf();
    }
    pendingGroupAssignTarget = null;
    App.hideModal('groupAssignModal');
  };

  App.openGroupModal = openGroupModal;
  App.openGroupAssignModal = openGroupAssignModal;
  App.onGroupModalHidden = () => { openedGroupModalFromAssign = false; };
})();

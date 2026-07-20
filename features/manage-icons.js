/*
 * features/manage-icons.js - the Manage Icons modal, extracted from the app.js
 * IIFE as the fourth feature-file split under the window.App registry pattern.
 *
 * Loaded as a classic <script src="features/manage-icons.js"> AFTER app.js. Its
 * own IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openManageIconsModal back onto App (the single inbound call site - Advanced ->
 * Manage Icons - calls App.openManageIconsModal at user-action time), and binds
 * the modal's Close / Cancel / Save buttons at this file's load.
 *
 * getOrderedIcons / iconVbFor / getUserCustomIcons / saveUserCustomIcons /
 * showToast stay defined in app.js (used in many places there) and are read here
 * via App.*. Boundary rule: all shared dependencies are read from App.* at call
 * time, never captured at load, so load order beyond "after app.js" does not
 * matter. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function openManageIconsModal() {
    const state = App.state;
    const listEl = document.getElementById('manageIconsList');
    const customSection = document.getElementById('manageIconsCustomSection');
    const customListEl = document.getElementById('manageIconsCustomList');
    const editToggleBtn = document.getElementById('manageIconsEditToggle');
    const deleteSelectedBtn = document.getElementById('manageIconsDeleteSelected');
    listEl.innerHTML = '';
    const ordered = App.getOrderedIcons();
    const esc = (s) => App.escapeHtml(s);
    function updateMoveButtons() {
      listEl.querySelectorAll('.manage-icon-row').forEach((row, i) => {
        const rows = listEl.querySelectorAll('.manage-icon-row');
        const n = rows.length;
        const btns = row.querySelectorAll('.icon-move-btns button');
        if (btns.length >= 4) {
          btns[0].disabled = i === 0;
          btns[1].disabled = i === n - 1;
          btns[2].disabled = i === 0;
          btns[3].disabled = i === n - 1;
        }
      });
    }
    ordered.forEach((ic, i) => {
      const row = document.createElement('div');
      row.className = 'manage-icon-row';
      row.dataset.iconPath = ic.value;
      const currentName = state.iconNames && state.iconNames[ic.value] !== undefined ? state.iconNames[ic.value] : ic.name;
      row.innerHTML = '<span class="icon-svg"><svg viewBox="' + App.iconVbFor(ic.value) + '" width="24" height="24"><path fill="var(--accent)" d="' + ic.value + '"/></svg></span><input type="text" value="' + esc(currentName) + '" placeholder="' + esc(ic.name || 'Icon') + '"><div class="icon-move-btns"><button type="button" title="Move up" data-action="up">↑</button><button type="button" title="Move down" data-action="down">↓</button><button type="button" title="Send to top" data-action="top">⏫</button><button type="button" title="Send to bottom" data-action="bottom">⏬</button></div>';
      listEl.appendChild(row);
      row.querySelectorAll('.icon-move-btns button').forEach(btn => {
        btn.onclick = () => {
          if (btn.dataset.action === 'up' && row.previousElementSibling) {
            listEl.insertBefore(row, row.previousElementSibling);
          } else if (btn.dataset.action === 'down' && row.nextElementSibling) {
            listEl.insertBefore(row, row.nextElementSibling.nextElementSibling);
          } else if (btn.dataset.action === 'top') {
            listEl.insertBefore(row, listEl.firstChild);
          } else if (btn.dataset.action === 'bottom') {
            listEl.appendChild(row);
          }
          updateMoveButtons();
        };
      });
    });
    updateMoveButtons();

    let customEditMode = false;
    const selectedPaths = new Set();
    function renderCustomIcons() {
      const customIcons = App.getUserCustomIcons();
      if (customIcons.length === 0) {
        customSection.style.display = 'none';
        return;
      }
      customSection.style.display = '';
      customListEl.innerHTML = '';
      customIcons.forEach((ic) => {
        const row = document.createElement('div');
        row.className = 'manage-icon-row manage-icon-row-custom';
        row.dataset.iconPath = ic.value;
        row.dataset.custom = '1';
        const vb = ic.viewBox || '0 0 24 24';
        const name = (state.iconNames && state.iconNames[ic.value]) || ic.name || 'Custom icon';
        const cbHtml = customEditMode ? '<input type="checkbox" class="icon-select-cb" aria-label="Select">' : '';
        row.innerHTML = cbHtml + '<span class="icon-svg"><svg viewBox="' + esc(vb) + '" width="24" height="24"><path fill="var(--accent)" d="' + esc(ic.value) + '"/></svg></span><span class="manage-icon-custom-name">' + esc(name) + '</span>';
        customListEl.appendChild(row);
        if (customEditMode) {
          const cb = row.querySelector('.icon-select-cb');
          row.onclick = (e) => {
            if (e.target === cb) return;
            const path = row.dataset.iconPath;
            if (selectedPaths.has(path)) {
              selectedPaths.delete(path);
              row.classList.remove('selected');
              if (cb) cb.checked = false;
            } else {
              selectedPaths.add(path);
              row.classList.add('selected');
              if (cb) cb.checked = true;
            }
            deleteSelectedBtn.disabled = selectedPaths.size === 0;
          };
          if (cb) {
            cb.onclick = (e) => e.stopPropagation();
            cb.onchange = () => {
              if (cb.checked) {
                selectedPaths.add(ic.value);
                row.classList.add('selected');
              } else {
                selectedPaths.delete(ic.value);
                row.classList.remove('selected');
              }
              deleteSelectedBtn.disabled = selectedPaths.size === 0;
            };
          }
        } else {
          row.onclick = null;
        }
      });
      deleteSelectedBtn.disabled = selectedPaths.size === 0;
    }
    function toggleEditMode() {
      customEditMode = !customEditMode;
      selectedPaths.clear();
      const span = editToggleBtn.querySelector('span');
      if (span) span.textContent = customEditMode ? 'Done' : 'Edit';
      editToggleBtn.classList.toggle('active', customEditMode);
      deleteSelectedBtn.style.display = customEditMode ? '' : 'none';
      renderCustomIcons();
    }
    editToggleBtn.onclick = toggleEditMode;
    deleteSelectedBtn.onclick = () => {
      const toRemove = Array.from(selectedPaths);
      if (toRemove.length === 0) return;
      const updated = App.getUserCustomIcons().filter((ic) => !toRemove.includes(ic.value));
      App.saveUserCustomIcons(updated);
      selectedPaths.clear();
      customEditMode = false;
      const span = editToggleBtn.querySelector('span');
      if (span) span.textContent = 'Edit';
      editToggleBtn.classList.remove('active');
      deleteSelectedBtn.style.display = 'none';
      deleteSelectedBtn.disabled = true;
      renderCustomIcons();
      App.showToast('Removed ' + toRemove.length + ' custom icon(s).');
      App.updateUI();
    };
    renderCustomIcons();
    const initSpan = editToggleBtn.querySelector('span');
    if (initSpan) initSpan.textContent = 'Edit';
    editToggleBtn.classList.remove('active');
    deleteSelectedBtn.style.display = 'none';
    deleteSelectedBtn.disabled = true;

    App.showModal('manageIconsModal');
  }

  document.getElementById('manageIconsModalClose').onclick = () => App.hideModal('manageIconsModal');
  document.getElementById('manageIconsCancel').onclick = () => App.hideModal('manageIconsModal');
  document.getElementById('manageIconsSave').onclick = () => {
    const state = App.state;
    const listEl = document.getElementById('manageIconsList');
    const rows = listEl.querySelectorAll('.manage-icon-row');
    const allIcons = App.getOrderedIcons();
    const next = {};
    const order = [];
    rows.forEach((row) => {
      const path = row.dataset.iconPath;
      const inp = row.querySelector('input');
      const ic = allIcons.find(i => i.value === path);
      if (ic && inp) {
        const v = inp.value.trim();
        if (v && v !== ic.name) next[ic.value] = v;
        order.push(path);
      }
    });
    state.iconNames = next;
    state.iconOrder = order.length ? order : null;
    App.hideModal('manageIconsModal');
    App.updateUI();
  };

  App.openManageIconsModal = openManageIconsModal;
})();

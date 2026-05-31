(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // Quick Plumbing + Quick Count modals -- extracted from app.js via the
  // window.App registry. Registers App.populatePlumModal +
  // App.populateCounterQuickCountPanel (counter.js's showCounterTab('quickcount')
  // calls the latter). The #plumBtn opener + all internal calls move along.
  const {
    state, hideModal, updateUI, uid, showLineColorModal, markProjectDirty,
    getOrderedIcons, getEffectiveCustomIcons, iconVbFor, showCounterTab,
    getPlumbingModifiers, savePlumbingModifiers, pushUndoSnapshot, COLORS, TOOL,
  } = App;

  function populatePlumModal() {
    const mods = getPlumbingModifiers();
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const sizeSel = document.getElementById('plumSize');
    const typeSel = document.getElementById('plumType');
    const materialSel = document.getElementById('plumMaterial');
    sizeSel.innerHTML = mods.sizes.map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('');
    typeSel.innerHTML = mods.types.map(t => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('');
    materialSel.innerHTML = mods.materials.map(m => '<option value="' + esc(m) + '">' + esc(m) + '</option>').join('');
    const icons = getOrderedIcons();
    const grid = document.getElementById('plumIconGrid');
    grid.innerHTML = icons.map((ic, i) => '<div class="icon-cell' + (i === 0 ? ' selected' : '') + '" data-path="' + ic.value + '"><svg viewBox="' + iconVbFor(ic.value) + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
    grid.querySelectorAll('.icon-cell').forEach(c => c.onclick = () => {
      document.querySelectorAll('#plumIconGridCustom .icon-cell').forEach(x => x.classList.remove('selected'));
      grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      updatePlumNamePreview();
    });
    const effectiveCustom = getEffectiveCustomIcons();
    const uploadCell = '<div class="icon-cell icon-cell-upload" data-upload="1" title="Upload SVG">+</div>';
    const iconCells = effectiveCustom.map((ic) => '<div class="icon-cell" data-path="' + ic.value + '"><svg viewBox="' + ic.viewBox + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
    const customGrid = document.getElementById('plumIconGridCustom');
    customGrid.innerHTML = uploadCell + iconCells;
    customGrid.querySelectorAll('.icon-cell').forEach(c => {
      c.onclick = () => {
        if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
        document.querySelectorAll('#plumIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
        customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        updatePlumNamePreview();
      };
    });
    showPlumIconTab('icon');
    updatePlumNamePreview();
    updatePlumTypeIconBox();
    applyPlumIconForType();
    const swatchEl = document.getElementById('plumNameRowSwatch');
    if (swatchEl) {
      swatchEl.onclick = () => {
        const mods = getPlumbingModifiers();
        showLineColorModal(mods.defaultColor || COLORS[2], (color) => {
          mods.defaultColor = color;
          savePlumbingModifiers(mods);
          swatchEl.style.background = color;
          updatePlumNamePreview();
        });
      };
      swatchEl.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); swatchEl.click(); } };
    }
    document.getElementById('plumRemoveSize').disabled = mods.sizes.length <= 1;
    document.getElementById('plumRemoveType').disabled = mods.types.length <= 1;
    document.getElementById('plumRemoveMaterial').disabled = mods.materials.length <= 1;
  }
  function getPlumEffectiveIconPath() {
    const sel = document.querySelector('#plumIconGrid .icon-cell.selected') || document.querySelector('#plumIconGridCustom .icon-cell.selected');
    if (sel?.dataset.path) return sel.dataset.path;
    const type = document.getElementById('plumType')?.value;
    const mods = getPlumbingModifiers();
    const path = mods.iconByType?.[type];
    if (path) return path;
    return getEffectiveCustomIcons()[0]?.value || getOrderedIcons()[0]?.value;
  }
  function updatePlumNamePreview() {
    const size = document.getElementById('plumSize').value;
    const type = document.getElementById('plumType').value;
    const material = document.getElementById('plumMaterial').value;
    const name = [size, material, type].filter(Boolean).join(' ');
    const nameEl = document.getElementById('plumNamePreview');
    if (nameEl) nameEl.value = name;
    const iconEl = document.getElementById('plumNameRowIcon');
    if (iconEl) {
      const path = getPlumEffectiveIconPath();
      const color = getPlumbingModifiers().defaultColor || COLORS[2];
      iconEl.innerHTML = path ? '<svg viewBox="' + iconVbFor(path) + '" width="20" height="20"><path fill="' + color + '" d="' + path + '"/></svg>' : '';
    }
    const swatchEl = document.getElementById('plumNameRowSwatch');
    if (swatchEl) swatchEl.style.background = getPlumbingModifiers().defaultColor || COLORS[2];
  }
  function updatePlumTypeIconBox() {
    const box = document.getElementById('plumTypeIconBox');
    if (!box) return;
    const type = document.getElementById('plumType').value;
    const mods = getPlumbingModifiers();
    const iconByType = mods.iconByType || {};
    const path = iconByType[type];
    const iconExists = path && (getOrderedIcons().some(ic => ic.value === path) || getEffectiveCustomIcons().some(ic => ic.value === path));
    if (path && iconExists) {
      box.innerHTML = '<svg viewBox="' + iconVbFor(path) + '"><path fill="var(--accent)" d="' + path + '"/></svg>';
      box.classList.add('has-icon');
      box.title = 'Click to use selected icon for ' + type;
    } else {
      box.innerHTML = '<span class="plum-type-icon-placeholder">?</span>';
      box.classList.remove('has-icon');
      box.title = 'Select an icon below, then click to set for ' + type;
    }
  }
  function applyPlumIconForType() {
    const type = document.getElementById('plumType').value;
    const mods = getPlumbingModifiers();
    const path = mods.iconByType && mods.iconByType[type];
    if (!path) return;
    const allCells = document.querySelectorAll('#plumIconGrid .icon-cell[data-path], #plumIconGridCustom .icon-cell[data-path]');
    const cell = Array.from(allCells).find(c => c.dataset.path === path);
    if (cell) {
      const inCustom = cell.closest('#plumIconGridCustom');
      showPlumIconTab(inCustom ? 'custom' : 'icon');
      document.querySelectorAll('#plumIconGrid .icon-cell, #plumIconGridCustom .icon-cell').forEach(x => x.classList.remove('selected'));
      cell.classList.add('selected');
    }
  }
  function showPlumIconTab(tab) {
    document.querySelectorAll('#plumModal .counter-icon-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.plumIconTab === tab));
    document.getElementById('plumIconPanel').style.display = tab === 'icon' ? '' : 'none';
    document.getElementById('plumIconCustomPanel').style.display = tab === 'custom' ? '' : 'none';
  }
  document.getElementById('plumBtn').onclick = () => {
    document.getElementById('counterBtn').click();
    App.showCounterTab('quickcount');
  };
  document.querySelectorAll('#plumModal .counter-icon-tab').forEach(t =>
    t.onclick = () => showPlumIconTab(t.dataset.plumIconTab));
  document.getElementById('plumSize').onchange = updatePlumNamePreview;
  document.getElementById('plumType').onchange = () => {
    updatePlumNamePreview();
    updatePlumTypeIconBox();
    applyPlumIconForType();
  };
  document.getElementById('plumMaterial').onchange = updatePlumNamePreview;
  const plumTypeIconBoxClick = () => {
    const sel = document.querySelector('#plumIconGrid .icon-cell.selected') || document.querySelector('#plumIconGridCustom .icon-cell.selected');
    const path = sel && sel.dataset.path;
    if (!path) return;
    const type = document.getElementById('plumType').value;
    const mods = getPlumbingModifiers();
    mods.iconByType = mods.iconByType || {};
    mods.iconByType[type] = path;
    savePlumbingModifiers(mods);
    updatePlumTypeIconBox();
    updatePlumNamePreview();
  };
  document.getElementById('plumTypeIconBox').onclick = plumTypeIconBoxClick;
  document.getElementById('plumTypeIconBox').onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); plumTypeIconBoxClick(); }
  };
  function removePlumbingModifier(kind, plumSelectId, qcSelectId) {
    const plumEl = document.getElementById(plumSelectId);
    const qcEl = document.getElementById(qcSelectId);
    const qcPanel = document.getElementById('counterQuickCountPanel');
    const qcVisible = qcPanel && qcPanel.style.display !== 'none';
    const sel = qcVisible && qcEl ? qcEl : (plumEl || qcEl);
    const value = sel?.value;
    if (!value) return;
    const mods = getPlumbingModifiers();
    const arr = mods[kind];
    if (arr.length <= 1) return;
    const idx = arr.indexOf(value);
    if (idx < 0) return;
    arr.splice(idx, 1);
    if (kind === 'types' && mods.iconByType) delete mods.iconByType[value];
    savePlumbingModifiers(mods);
    populatePlumModal();
    populateCounterQuickCountPanel();
    const newVal = arr[0] || arr[Math.max(0, idx - 1)];
    const plumSel = document.getElementById(plumSelectId);
    const qcSel = document.getElementById(qcSelectId);
    if (plumSel) plumSel.value = newVal;
    if (qcSel) qcSel.value = newVal;
    updatePlumNamePreview();
    updateCounterQuickCountNamePreview();
    updatePlumTypeIconBox();
    updateCounterQuickCountTypeIconBox();
  }
  document.getElementById('plumRemoveSize').onclick = () => removePlumbingModifier('sizes', 'plumSize', 'counterQuickCountSize');
  document.getElementById('plumRemoveType').onclick = () => removePlumbingModifier('types', 'plumType', 'counterQuickCountType');
  document.getElementById('plumRemoveMaterial').onclick = () => removePlumbingModifier('materials', 'plumMaterial', 'counterQuickCountMaterial');
  document.getElementById('plumAddSize').onclick = () => {
    const v = prompt('Enter new size:');
    if (v && v.trim()) {
      const mods = getPlumbingModifiers();
      mods.sizes.push(v.trim());
      savePlumbingModifiers(mods);
      populatePlumModal();
      document.getElementById('plumSize').value = v.trim();
      updatePlumNamePreview();
    }
  };
  document.getElementById('plumAddType').onclick = () => {
    const v = prompt('Enter new type:');
    if (v && v.trim()) {
      const mods = getPlumbingModifiers();
      mods.types.push(v.trim());
      savePlumbingModifiers(mods);
      populatePlumModal();
      document.getElementById('plumType').value = v.trim();
      updatePlumNamePreview();
    }
  };
  document.getElementById('plumAddMaterial').onclick = () => {
    const v = prompt('Enter new material:');
    if (v && v.trim()) {
      const mods = getPlumbingModifiers();
      mods.materials.push(v.trim());
      savePlumbingModifiers(mods);
      populatePlumModal();
      document.getElementById('plumMaterial').value = v.trim();
      updatePlumNamePreview();
    }
  };
  document.getElementById('plumCancel').onclick = () => hideModal('plumModal');
  document.getElementById('plumAdd').onclick = () => {
    const size = document.getElementById('plumSize').value;
    const type = document.getElementById('plumType').value;
    const material = document.getElementById('plumMaterial').value;
    const computedName = [size, material, type].filter(Boolean).join(' ');
    const nameInput = document.getElementById('plumNamePreview');
    const name = (nameInput?.value?.trim() || computedName) || 'Plumbing';
    const sel = document.querySelector('#plumIconGrid .icon-cell.selected') || document.querySelector('#plumIconGridCustom .icon-cell.selected');
    const icon = sel ? sel.dataset.path : (getEffectiveCustomIcons()[0]?.value || getOrderedIcons()[0]?.value);
    const mods = getPlumbingModifiers();
    pushUndoSnapshot();
    const newCounter = { id: uid(), name, icon, color: mods.defaultColor || COLORS[2] };
    state.counters.push(newCounter);
    state.activeCounterType = newCounter.id;
    state.tool = TOOL.COUNTER;
    markProjectDirty();
    state.pagesListCollapsed = true;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
    hideModal('plumModal');
    updateUI();
  };

  function getCounterQuickCountEffectiveIconPath() {
    const sel = document.querySelector('#counterQuickCountIconGrid .icon-cell.selected') || document.querySelector('#counterQuickCountIconGridCustom .icon-cell.selected');
    if (sel?.dataset.path) return sel.dataset.path;
    const type = document.getElementById('counterQuickCountType')?.value;
    const mods = getPlumbingModifiers();
    const path = mods.iconByType?.[type];
    if (path) return path;
    return getEffectiveCustomIcons()[0]?.value || getOrderedIcons()[0]?.value;
  }
  function updateCounterQuickCountNamePreview() {
    const size = document.getElementById('counterQuickCountSize')?.value;
    const type = document.getElementById('counterQuickCountType')?.value;
    const material = document.getElementById('counterQuickCountMaterial')?.value;
    const name = [size, material, type].filter(Boolean).join(' ');
    const nameEl = document.getElementById('counterQuickCountName');
    if (nameEl) nameEl.value = name;
    const iconEl = document.getElementById('counterQuickCountIcon');
    if (iconEl) {
      const path = getCounterQuickCountEffectiveIconPath();
      const color = getPlumbingModifiers().defaultColor || COLORS[2];
      iconEl.innerHTML = path ? '<svg viewBox="' + iconVbFor(path) + '" width="20" height="20"><path fill="' + color + '" d="' + path + '"/></svg>' : '';
    }
    const swatchEl = document.getElementById('counterQuickCountSwatch');
    if (swatchEl) swatchEl.style.background = getPlumbingModifiers().defaultColor || COLORS[2];
  }
  function updateCounterQuickCountTypeIconBox() {
    const box = document.getElementById('counterQuickCountTypeIconBox');
    if (!box) return;
    const type = document.getElementById('counterQuickCountType')?.value;
    const mods = getPlumbingModifiers();
    const iconByType = mods.iconByType || {};
    const path = iconByType[type];
    const iconExists = path && (getOrderedIcons().some(ic => ic.value === path) || getEffectiveCustomIcons().some(ic => ic.value === path));
    if (path && iconExists) {
      box.innerHTML = '<svg viewBox="' + iconVbFor(path) + '"><path fill="var(--accent)" d="' + path + '"/></svg>';
      box.classList.add('has-icon');
      box.title = 'Click to use selected icon for ' + type;
    } else {
      box.innerHTML = '<span class="plum-type-icon-placeholder">?</span>';
      box.classList.remove('has-icon');
      box.title = 'Select an icon below, then click to set for ' + type;
    }
  }
  function applyCounterQuickCountIconForType() {
    const type = document.getElementById('counterQuickCountType')?.value;
    const mods = getPlumbingModifiers();
    const path = mods.iconByType && mods.iconByType[type];
    if (!path) return;
    const allCells = document.querySelectorAll('#counterQuickCountIconGrid .icon-cell[data-path], #counterQuickCountIconGridCustom .icon-cell[data-path]');
    const cell = Array.from(allCells).find(c => c.dataset.path === path);
    if (cell) {
      const inCustom = cell.closest('#counterQuickCountIconGridCustom');
      showCounterQuickCountIconTab(inCustom ? 'custom' : 'icon');
      document.querySelectorAll('#counterQuickCountIconGrid .icon-cell, #counterQuickCountIconGridCustom .icon-cell').forEach(x => x.classList.remove('selected'));
      cell.classList.add('selected');
    }
  }
  function showCounterQuickCountIconTab(tab) {
    document.querySelectorAll('#counterQuickCountPanel .counter-icon-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.counterQuickcountIconTab === tab));
    document.getElementById('counterQuickCountIconPanel').style.display = tab === 'icon' ? '' : 'none';
    document.getElementById('counterQuickCountIconCustomPanel').style.display = tab === 'custom' ? '' : 'none';
  }
  function populateCounterQuickCountPanel() {
    const mods = getPlumbingModifiers();
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const sizeSel = document.getElementById('counterQuickCountSize');
    const typeSel = document.getElementById('counterQuickCountType');
    const materialSel = document.getElementById('counterQuickCountMaterial');
    if (sizeSel) sizeSel.innerHTML = mods.sizes.map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('');
    if (typeSel) typeSel.innerHTML = mods.types.map(t => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('');
    if (materialSel) materialSel.innerHTML = mods.materials.map(m => '<option value="' + esc(m) + '">' + esc(m) + '</option>').join('');
    const icons = getOrderedIcons();
    const grid = document.getElementById('counterQuickCountIconGrid');
    if (grid) {
      grid.innerHTML = icons.map((ic, i) => '<div class="icon-cell' + (i === 0 ? ' selected' : '') + '" data-path="' + ic.value + '"><svg viewBox="' + iconVbFor(ic.value) + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
      grid.querySelectorAll('.icon-cell').forEach(c => c.onclick = () => {
        document.querySelectorAll('#counterQuickCountIconGridCustom .icon-cell').forEach(x => x.classList.remove('selected'));
        grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        updateCounterQuickCountNamePreview();
      });
    }
    const effectiveCustom = getEffectiveCustomIcons();
    const uploadCell = '<div class="icon-cell icon-cell-upload" data-upload="1" title="Upload SVG">+</div>';
    const iconCells = effectiveCustom.map((ic) => '<div class="icon-cell" data-path="' + ic.value + '"><svg viewBox="' + ic.viewBox + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
    const customGrid = document.getElementById('counterQuickCountIconGridCustom');
    if (customGrid) {
      customGrid.innerHTML = uploadCell + iconCells;
      customGrid.querySelectorAll('.icon-cell').forEach(c => {
        c.onclick = () => {
          if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
          document.querySelectorAll('#counterQuickCountIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
          customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          c.classList.add('selected');
          updateCounterQuickCountNamePreview();
        };
      });
    }
    showCounterQuickCountIconTab('icon');
    updateCounterQuickCountNamePreview();
    updateCounterQuickCountTypeIconBox();
    applyCounterQuickCountIconForType();
    const swatchEl = document.getElementById('counterQuickCountSwatch');
    if (swatchEl) {
      swatchEl.onclick = () => {
        const mods = getPlumbingModifiers();
        showLineColorModal(mods.defaultColor || COLORS[2], (color) => {
          mods.defaultColor = color;
          savePlumbingModifiers(mods);
          swatchEl.style.background = color;
          updateCounterQuickCountNamePreview();
        });
      };
      swatchEl.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); swatchEl.click(); } };
    }
    const rmSize = document.getElementById('counterQuickCountRemoveSize');
    const rmType = document.getElementById('counterQuickCountRemoveType');
    const rmMaterial = document.getElementById('counterQuickCountRemoveMaterial');
    if (rmSize) rmSize.disabled = mods.sizes.length <= 1;
    if (rmType) rmType.disabled = mods.types.length <= 1;
    if (rmMaterial) rmMaterial.disabled = mods.materials.length <= 1;
  }
  document.querySelectorAll('#counterQuickCountPanel .counter-icon-tab').forEach(t =>
    t.onclick = () => showCounterQuickCountIconTab(t.dataset.counterQuickcountIconTab));
  document.getElementById('counterQuickCountSize')?.addEventListener('change', updateCounterQuickCountNamePreview);
  document.getElementById('counterQuickCountType')?.addEventListener('change', () => {
    updateCounterQuickCountNamePreview();
    updateCounterQuickCountTypeIconBox();
    applyCounterQuickCountIconForType();
  });
  document.getElementById('counterQuickCountMaterial')?.addEventListener('change', updateCounterQuickCountNamePreview);
  const counterQuickCountTypeIconBoxClick = () => {
    const sel = document.querySelector('#counterQuickCountIconGrid .icon-cell.selected') || document.querySelector('#counterQuickCountIconGridCustom .icon-cell.selected');
    const path = sel && sel.dataset.path;
    if (!path) return;
    const type = document.getElementById('counterQuickCountType')?.value;
    const mods = getPlumbingModifiers();
    mods.iconByType = mods.iconByType || {};
    mods.iconByType[type] = path;
    savePlumbingModifiers(mods);
    updateCounterQuickCountTypeIconBox();
    updateCounterQuickCountNamePreview();
  };
  const counterQuickCountTypeIconBox = document.getElementById('counterQuickCountTypeIconBox');
  if (counterQuickCountTypeIconBox) {
    counterQuickCountTypeIconBox.onclick = counterQuickCountTypeIconBoxClick;
    counterQuickCountTypeIconBox.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); counterQuickCountTypeIconBoxClick(); } };
  }
  document.getElementById('counterQuickCountRemoveSize')?.addEventListener('click', () => removePlumbingModifier('sizes', 'plumSize', 'counterQuickCountSize'));
  document.getElementById('counterQuickCountRemoveType')?.addEventListener('click', () => removePlumbingModifier('types', 'plumType', 'counterQuickCountType'));
  document.getElementById('counterQuickCountRemoveMaterial')?.addEventListener('click', () => removePlumbingModifier('materials', 'plumMaterial', 'counterQuickCountMaterial'));
  document.getElementById('counterQuickCountAddSize')?.addEventListener('click', () => {
    const v = prompt('Enter new size:');
    if (v && v.trim()) {
      const mods = getPlumbingModifiers();
      mods.sizes.push(v.trim());
      savePlumbingModifiers(mods);
      populateCounterQuickCountPanel();
      document.getElementById('counterQuickCountSize').value = v.trim();
      updateCounterQuickCountNamePreview();
    }
  });
  document.getElementById('counterQuickCountAddType')?.addEventListener('click', () => {
    const v = prompt('Enter new type:');
    if (v && v.trim()) {
      const mods = getPlumbingModifiers();
      mods.types.push(v.trim());
      savePlumbingModifiers(mods);
      populateCounterQuickCountPanel();
      document.getElementById('counterQuickCountType').value = v.trim();
      updateCounterQuickCountNamePreview();
    }
  });
  document.getElementById('counterQuickCountAddMaterial')?.addEventListener('click', () => {
    const v = prompt('Enter new material:');
    if (v && v.trim()) {
      const mods = getPlumbingModifiers();
      mods.materials.push(v.trim());
      savePlumbingModifiers(mods);
      populateCounterQuickCountPanel();
      document.getElementById('counterQuickCountMaterial').value = v.trim();
      updateCounterQuickCountNamePreview();
    }
  });
  document.getElementById('counterQuickCountCancel')?.addEventListener('click', () => hideModal('counterModal'));
  document.getElementById('counterQuickCountAdd')?.addEventListener('click', () => {
    const size = document.getElementById('counterQuickCountSize')?.value;
    const type = document.getElementById('counterQuickCountType')?.value;
    const material = document.getElementById('counterQuickCountMaterial')?.value;
    const computedName = [size, material, type].filter(Boolean).join(' ');
    const nameInput = document.getElementById('counterQuickCountName');
    const name = (nameInput?.value?.trim() || computedName) || 'Plumbing';
    const sel = document.querySelector('#counterQuickCountIconGrid .icon-cell.selected') || document.querySelector('#counterQuickCountIconGridCustom .icon-cell.selected');
    const icon = sel ? sel.dataset.path : (getEffectiveCustomIcons()[0]?.value || getOrderedIcons()[0]?.value);
    const mods = getPlumbingModifiers();
    pushUndoSnapshot();
    const newCounter = { id: uid(), name, icon, color: mods.defaultColor || COLORS[2] };
    state.counters.push(newCounter);
    state.activeCounterType = newCounter.id;
    state.tool = TOOL.COUNTER;
    markProjectDirty();
    state.pagesListCollapsed = true;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
    hideModal('counterModal');
    updateUI();
  });

  App.populatePlumModal = populatePlumModal;
  App.populateCounterQuickCountPanel = populateCounterQuickCountPanel;
  // Called by the shared custom-icon-upload handler in app.js (which refreshes
  // the Quick Count icon grid).
  App.updateCounterQuickCountNamePreview = updateCounterQuickCountNamePreview;
})();


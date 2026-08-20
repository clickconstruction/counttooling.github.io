(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // Quick Count panel (the Counter modal's modifier-driven quick-create tab)
  // -- extracted from app.js via the window.App registry. Registers
  // App.populateCounterQuickCountPanel (counter.js's showCounterTab('quickcount')
  // calls it). The legacy #plumModal surface was removed 2026-07-30: nothing
  // opened it (#plumBtn below routes here instead); the shared modifier store
  // (getPlumbingModifiers) keeps its historical name.
  // Shared deps are read from App.* at call time (never captured at load), so
  // load order beyond "after app.js" does not matter.

  // Legacy quick-add button: routes to the Counter modal's Quick Count tab.
  document.getElementById('plumBtn').onclick = () => {
    document.getElementById('counterBtn').click();
    App.showCounterTab('quickcount');
  };

  function removePlumbingModifier(kind, qcSelectId) {
    const qcEl = document.getElementById(qcSelectId);
    const value = qcEl?.value;
    if (!value) return;
    const mods = App.getPlumbingModifiers();
    const arr = mods[kind];
    if (arr.length <= 1) return;
    const idx = arr.indexOf(value);
    if (idx < 0) return;
    arr.splice(idx, 1);
    if (kind === 'types' && mods.iconByType) delete mods.iconByType[value];
    App.savePlumbingModifiers(mods);
    populateCounterQuickCountPanel();
    const newVal = arr[0] || arr[Math.max(0, idx - 1)];
    const qcSel = document.getElementById(qcSelectId);
    if (qcSel) qcSel.value = newVal;
    updateCounterQuickCountNamePreview();
    updateCounterQuickCountTypeIconBox();
  }

  // T2-16: Quick Count counters used to inherit the FIRST library icon + the
  // default color for every Type — "0.5in PEX Tee" marks rendered identical to
  // "Water Closet" and the mixup only surfaced at pricing time. Default a
  // per-Type icon instead, by whole-token matching the Type's words against
  // the bundled icon library's search terms (so custom user types like
  // "Floor Drain" match too). Conservative: only exact term tokens (plus a
  // tiny fitting-vocabulary alias table) match; unknown types keep the
  // current first-icon fallback and rely on create-time color rotation below.
  const QC_TYPE_TERM_ALIASES = { elbow: 'bend', 90: 'bend', coupling: 'pipe' };
  // Whether the user manually clicked an icon cell since the panel populated;
  // type-driven auto-selection must never clobber an explicit pick.
  let qcUserPickedIcon = false;
  function quickCountDefaultIconForType(type) {
    if (!type) return null;
    const tokens = String(type).toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 2);
    if (!tokens.length) return null;
    const wanted = tokens.map(t => QC_TYPE_TERM_ALIASES[t] || t);
    let best = null, bestScore = 0;
    for (const ic of App.getOrderedIcons()) {
      const score = wanted.reduce((n, t) => n + (ic.terms.includes(t) ? 1 : 0), 0);
      if (score > bestScore) { best = ic; bestScore = score; }
    }
    return best ? best.value : null;
  }
  function getCounterQuickCountEffectiveIconPath() {
    const sel = document.querySelector('#counterQuickCountIconGrid .icon-cell.selected') || document.querySelector('#counterQuickCountIconGridCustom .icon-cell.selected');
    if (sel?.dataset.path) return sel.dataset.path;
    const type = document.getElementById('counterQuickCountType')?.value;
    const mods = App.getPlumbingModifiers();
    const path = mods.iconByType?.[type];
    if (path) return path;
    const inferred = quickCountDefaultIconForType(type);
    if (inferred) return inferred;
    return App.getEffectiveCustomIcons()[0]?.value || App.getOrderedIcons()[0]?.value;
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
      const color = App.getPlumbingModifiers().defaultColor || App.COLORS[2];
      iconEl.innerHTML = path ? '<svg viewBox="' + App.iconVbFor(path) + '" width="20" height="20"><path fill="' + color + '" d="' + path + '"/></svg>' : '';
    }
    const swatchEl = document.getElementById('counterQuickCountSwatch');
    if (swatchEl) swatchEl.style.background = App.getPlumbingModifiers().defaultColor || App.COLORS[2];
  }
  function updateCounterQuickCountTypeIconBox() {
    const box = document.getElementById('counterQuickCountTypeIconBox');
    if (!box) return;
    const type = document.getElementById('counterQuickCountType')?.value;
    const mods = App.getPlumbingModifiers();
    const iconByType = mods.iconByType || {};
    const path = iconByType[type];
    const iconExists = path && (App.getOrderedIcons().some(ic => ic.value === path) || App.getEffectiveCustomIcons().some(ic => ic.value === path));
    if (path && iconExists) {
      box.innerHTML = '<svg viewBox="' + App.iconVbFor(path) + '"><path fill="var(--accent)" d="' + path + '"/></svg>';
      box.classList.add('has-icon');
      box.title = 'Click to use selected icon for ' + type;
    } else {
      box.innerHTML = '<span class="plum-type-icon-placeholder">?</span>';
      box.classList.remove('has-icon');
      box.title = 'Select an icon below, then click to set for ' + type;
    }
  }
  function selectCounterQuickCountIconPath(path) {
    const allCells = document.querySelectorAll('#counterQuickCountIconGrid .icon-cell[data-path], #counterQuickCountIconGridCustom .icon-cell[data-path]');
    const cell = Array.from(allCells).find(c => c.dataset.path === path);
    if (!cell) return false;
    const inCustom = cell.closest('#counterQuickCountIconGridCustom');
    showCounterQuickCountIconTab(inCustom ? 'custom' : 'icon');
    document.querySelectorAll('#counterQuickCountIconGrid .icon-cell, #counterQuickCountIconGridCustom .icon-cell').forEach(x => x.classList.remove('selected'));
    cell.classList.add('selected');
    return true;
  }
  function applyCounterQuickCountIconForType() {
    const type = document.getElementById('counterQuickCountType')?.value;
    const mods = App.getPlumbingModifiers();
    const explicit = mods.iconByType && mods.iconByType[type];
    if (explicit && selectCounterQuickCountIconPath(explicit)) {
      updateCounterQuickCountNamePreview();
      return;
    }
    // No explicit per-Type icon: infer one from the Type's words, unless the
    // user already hand-picked a cell this session.
    if (qcUserPickedIcon) return;
    const inferred = quickCountDefaultIconForType(type);
    if (inferred && selectCounterQuickCountIconPath(inferred)) updateCounterQuickCountNamePreview();
  }
  function showCounterQuickCountIconTab(tab) {
    document.querySelectorAll('#counterQuickCountPanel .counter-icon-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.counterQuickcountIconTab === tab));
    document.getElementById('counterQuickCountIconPanel').style.display = tab === 'icon' ? '' : 'none';
    document.getElementById('counterQuickCountIconCustomPanel').style.display = tab === 'custom' ? '' : 'none';
  }
  function populateCounterQuickCountPanel() {
    qcUserPickedIcon = false;
    const mods = App.getPlumbingModifiers();
    const esc = (s) => App.escapeHtml(s);
    const sizeSel = document.getElementById('counterQuickCountSize');
    const typeSel = document.getElementById('counterQuickCountType');
    const materialSel = document.getElementById('counterQuickCountMaterial');
    if (sizeSel) sizeSel.innerHTML = mods.sizes.map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('');
    if (typeSel) typeSel.innerHTML = mods.types.map(t => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('');
    if (materialSel) materialSel.innerHTML = mods.materials.map(m => '<option value="' + esc(m) + '">' + esc(m) + '</option>').join('');
    const icons = App.getOrderedIcons();
    const grid = document.getElementById('counterQuickCountIconGrid');
    if (grid) {
      grid.innerHTML = App.iconGridCellsHtml(icons, App.iconVbFor, (ic, i) => i === 0);
      grid.querySelectorAll('.icon-cell').forEach(c => c.onclick = () => {
        document.querySelectorAll('#counterQuickCountIconGridCustom .icon-cell').forEach(x => x.classList.remove('selected'));
        grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        qcUserPickedIcon = true;
        updateCounterQuickCountNamePreview();
      });
    }
    const effectiveCustom = App.getEffectiveCustomIcons();
    const customGrid = document.getElementById('counterQuickCountIconGridCustom');
    if (customGrid) {
      customGrid.innerHTML = App.customIconCellsHtml(effectiveCustom);
      customGrid.querySelectorAll('.icon-cell').forEach(c => {
        c.onclick = () => {
          if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
          document.querySelectorAll('#counterQuickCountIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
          customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          c.classList.add('selected');
          qcUserPickedIcon = true;
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
        const mods = App.getPlumbingModifiers();
        App.showLineColorModal(mods.defaultColor || App.COLORS[2], (color) => {
          mods.defaultColor = color;
          App.savePlumbingModifiers(mods);
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
    const mods = App.getPlumbingModifiers();
    mods.iconByType = mods.iconByType || {};
    mods.iconByType[type] = path;
    App.savePlumbingModifiers(mods);
    updateCounterQuickCountTypeIconBox();
    updateCounterQuickCountNamePreview();
  };
  const counterQuickCountTypeIconBox = document.getElementById('counterQuickCountTypeIconBox');
  if (counterQuickCountTypeIconBox) {
    counterQuickCountTypeIconBox.onclick = counterQuickCountTypeIconBoxClick;
    counterQuickCountTypeIconBox.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); counterQuickCountTypeIconBoxClick(); } };
  }
  document.getElementById('counterQuickCountRemoveSize')?.addEventListener('click', () => removePlumbingModifier('sizes', 'counterQuickCountSize'));
  document.getElementById('counterQuickCountRemoveType')?.addEventListener('click', () => removePlumbingModifier('types', 'counterQuickCountType'));
  document.getElementById('counterQuickCountRemoveMaterial')?.addEventListener('click', () => removePlumbingModifier('materials', 'counterQuickCountMaterial'));
  document.getElementById('counterQuickCountAddSize')?.addEventListener('click', () => {
    const v = prompt('Enter new size:');
    if (v && v.trim()) {
      const mods = App.getPlumbingModifiers();
      mods.sizes.push(v.trim());
      App.savePlumbingModifiers(mods);
      populateCounterQuickCountPanel();
      document.getElementById('counterQuickCountSize').value = v.trim();
      updateCounterQuickCountNamePreview();
    }
  });
  document.getElementById('counterQuickCountAddType')?.addEventListener('click', () => {
    const v = prompt('Enter new type:');
    if (v && v.trim()) {
      const mods = App.getPlumbingModifiers();
      mods.types.push(v.trim());
      App.savePlumbingModifiers(mods);
      populateCounterQuickCountPanel();
      document.getElementById('counterQuickCountType').value = v.trim();
      updateCounterQuickCountNamePreview();
    }
  });
  document.getElementById('counterQuickCountAddMaterial')?.addEventListener('click', () => {
    const v = prompt('Enter new material:');
    if (v && v.trim()) {
      const mods = App.getPlumbingModifiers();
      mods.materials.push(v.trim());
      App.savePlumbingModifiers(mods);
      populateCounterQuickCountPanel();
      document.getElementById('counterQuickCountMaterial').value = v.trim();
      updateCounterQuickCountNamePreview();
    }
  });
  document.getElementById('counterQuickCountCancel')?.addEventListener('click', () => App.hideModal('counterModal'));
  document.getElementById('counterQuickCountAdd')?.addEventListener('click', () => {
    const size = document.getElementById('counterQuickCountSize')?.value;
    const type = document.getElementById('counterQuickCountType')?.value;
    const material = document.getElementById('counterQuickCountMaterial')?.value;
    const computedName = [size, material, type].filter(Boolean).join(' ');
    const nameInput = document.getElementById('counterQuickCountName');
    const name = (nameInput?.value?.trim() || computedName) || 'Plumbing';
    // Same selected-cell > per-Type > inferred > first-icon chain the preview
    // shows, so what you saw is what you get.
    const icon = getCounterQuickCountEffectiveIconPath();
    const mods = App.getPlumbingModifiers();
    let color = mods.defaultColor || App.COLORS[2];
    // Visual-twin guard: an existing counter already wears this exact
    // icon+color, so its marks would be indistinguishable on the sheet —
    // rotate to the next preset color not on a same-icon counter. Composes
    // with (never duplicates) the Create tab's exact name/icon/color twin
    // guard in features/counter.js: rotating here means a Quick Count create
    // can no longer mint an exact twin either.
    if (App.state.counters.some(c => c.icon === icon && (c.color || '').toLowerCase() === color.toLowerCase())) {
      const usedColors = new Set(App.state.counters.filter(c => c.icon === icon).map(c => (c.color || '').toLowerCase()));
      usedColors.add(color.toLowerCase());
      const rotated = App.COLORS.find(c => !usedColors.has(c.toLowerCase()));
      if (rotated) color = rotated;
    }
    App.pushUndoSnapshot();
    const newCounter = { id: App.uid(), name, icon, color };
    App.state.counters.push(newCounter);
    App.state.activeCounterType = newCounter.id;
    App.state.tool = App.TOOL.COUNTER;
    App.markProjectDirty();
    App.state.pagesListCollapsed = true;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
    App.hideModal('counterModal');
    App.updateUI();
  });

  App.populateCounterQuickCountPanel = populateCounterQuickCountPanel;
  // Called by the shared custom-icon-upload handler (which refreshes the Quick
  // Count icon grid).
  App.updateCounterQuickCountNamePreview = updateCounterQuickCountNamePreview;
})();

(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // Quick Count panel (the Counter modal's modifier-driven quick-create tab)
  // -- extracted from app.js via the window.App registry. Registers
  // App.populateCounterQuickCountPanel (counter.js's showCounterTab('quickcount')
  // calls it). The legacy #plumModal surface was removed 2026-07-30, and the
  // dead #plumBtn sidebar opener followed in Tier-3 B17; the shared modifier
  // store (getPlumbingModifiers) keeps its historical name.
  // Shared deps are read from App.* at call time (never captured at load), so
  // load order beyond "after app.js" does not matter.
  //
  // Electrical, First-Class S1 — the Trade switch. The panel is ONE panel for
  // every trade: the three modifier rows keep their storage keys (sizes /
  // types / materials) and the trade profile (constants.js
  // TRADE_QUICK_PROFILES) relabels them and sets the name order — Plumbing
  // reads "1in PEX Tee", Electrical reads "Duplex Receptacle 20A" (Category /
  // Variant / Rating). The store per trade comes from App.getTradeModifiers
  // (plumbing = the legacy blob; the others ride plumbingModifiers.profiles so
  // the cloud Artboard carries them with no migration). Trades that carry a
  // mount height (electrical) show the Mount height row, prefilled per variant
  // from the profile's mountByType, and stamp it on the counter (S2 reads it).

  // (Tier-3 B17: the dead #plumBtn sidebar opener was deleted with its
  // .sidebar-plum-row markup and viewerHideIds entry — the row shipped
  // display:none, so nothing user-reachable routed through it.)

  // The trade the panel is showing. Follows the project (state.trade), else
  // the device default, else plumbing; the segment click changes it for the
  // project AND remembers it as the device default (decision ⚑2: explicit).
  function quickTrade() {
    return App.getQuickTrade ? App.getQuickTrade() : 'plumbing';
  }
  function mods() {
    return App.getTradeModifiers ? App.getTradeModifiers(quickTrade()) : App.getPlumbingModifiers();
  }
  function saveMods(m) {
    if (App.saveTradeModifiers) App.saveTradeModifiers(quickTrade(), m);
    else App.savePlumbingModifiers(m);
  }
  function profile() {
    const p = App.TRADE_QUICK_PROFILES && App.TRADE_QUICK_PROFILES[quickTrade()];
    return p || { labels: ['Size', 'Type', 'Material'], nameOrder: ['size', 'material', 'type'], fallbackName: 'Plumbing', placeholder: '' };
  }
  function tradeHasMountHeight() {
    const m = mods();
    return !!(m.mountByType && Object.keys(m.mountByType).length);
  }
  function fieldValues() {
    return {
      size: document.getElementById('counterQuickCountSize')?.value || '',
      type: document.getElementById('counterQuickCountType')?.value || '',
      material: document.getElementById('counterQuickCountMaterial')?.value || ''
    };
  }
  function composeName() {
    const v = fieldValues();
    return profile().nameOrder.map((k) => v[k]).filter(Boolean).join(' ');
  }

  function removeModifier(kind, qcSelectId) {
    const qcEl = document.getElementById(qcSelectId);
    const value = qcEl?.value;
    if (value == null) return;
    const m = mods();
    const arr = m[kind];
    if (arr.length <= 1) return;
    const idx = arr.indexOf(value);
    if (idx < 0) return;
    arr.splice(idx, 1);
    if (kind === 'types' && m.iconByType) delete m.iconByType[value];
    saveMods(m);
    populateCounterQuickCountPanel();
    const newVal = arr[0] || arr[Math.max(0, idx - 1)];
    const qcSel = document.getElementById(qcSelectId);
    if (qcSel) qcSel.value = newVal;
    updateCounterQuickCountNamePreview();
    updateCounterQuickCountTypeIconBox();
  }

  // The icon a type resolves to: the user's pin in the profile, else (for
  // trades that ship a symbol set) the bundled symbol named for the variant.
  function iconForType(type) {
    if (App.tradeIconForType) return App.tradeIconForType(quickTrade(), type);
    const m = mods();
    return (m.iconByType && m.iconByType[type]) || null;
  }
  function getCounterQuickCountEffectiveIconPath() {
    const sel = document.querySelector('#counterQuickCountIconGrid .icon-cell.selected') || document.querySelector('#counterQuickCountIconGridCustom .icon-cell.selected');
    if (sel?.dataset.path) return sel.dataset.path;
    const type = document.getElementById('counterQuickCountType')?.value;
    const path = iconForType(type);
    if (path) return path;
    return App.getEffectiveCustomIcons()[0]?.value || App.getOrderedIcons()[0]?.value;
  }
  // The color the Add button will actually mint for `iconPath` (T2 #16): the
  // saved default — unless an existing counter already pairs that exact icon
  // with that exact color, in which case the shared `nextUnusedCounterColor`
  // (recent-colors.js, bare classic-script global) rotates to a free palette
  // entry so Quick Count never creates an identical-looking twin. Per-create
  // only: the profile's `defaultColor` is never written back.
  function getCounterQuickCountEffectiveColor(iconPath) {
    const counters = App.state.counters || [];
    const base = mods().defaultColor || App.COLORS[2];
    const norm = (s) => String(s || '').toLowerCase();
    const dupe = counters.some(c => c.icon === iconPath && norm(c.color) === norm(base));
    return dupe ? nextUnusedCounterColor(counters, App.COLORS, base) : base;
  }
  function updateCounterQuickCountNamePreview() {
    const name = composeName();
    const nameEl = document.getElementById('counterQuickCountName');
    if (nameEl) nameEl.value = name;
    // WYSIWYG (T2 #16): preview the color Add will actually mint — rotated
    // when the default would duplicate an existing counter's icon+color.
    const path = getCounterQuickCountEffectiveIconPath();
    const base = mods().defaultColor || App.COLORS[2];
    const color = getCounterQuickCountEffectiveColor(path);
    const iconEl = document.getElementById('counterQuickCountIcon');
    if (iconEl) {
      iconEl.innerHTML = path ? '<svg viewBox="' + App.iconVbFor(path) + '" width="20" height="20"><path fill="' + color + '" d="' + path + '"/></svg>' : '';
    }
    const swatchEl = document.getElementById('counterQuickCountSwatch');
    if (swatchEl) {
      swatchEl.style.background = color;
      swatchEl.title = color === base ? 'Change color' : "Color adjusted so these marks don't match an existing counter";
    }
  }
  // S1/S2: the mount height row — prefilled from the profile per variant,
  // then per category; the estimator can overwrite it before Add.
  function updateCounterQuickCountMount(prefill) {
    const row = document.getElementById('counterQuickCountMountRow');
    const input = document.getElementById('counterQuickCountMount');
    const hint = document.getElementById('counterQuickCountMountHint');
    if (!row || !input) return;
    const show = tradeHasMountHeight();
    row.style.display = show ? '' : 'none';
    if (!show) return;
    const v = fieldValues();
    const def = App.tradeMountHeightFor ? App.tradeMountHeightFor(quickTrade(), v.type, v.size) : null;
    if (prefill) input.value = def != null ? App.formatMountHeightIn(def) : '';
    if (hint) hint.textContent = def != null ? 'AFF · profile default for ' + (v.type || v.size) : 'empty = ceiling';
  }
  function updateCounterQuickCountTypeIconBox() {
    const box = document.getElementById('counterQuickCountTypeIconBox');
    if (!box) return;
    const type = document.getElementById('counterQuickCountType')?.value;
    const path = iconForType(type);
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
  function applyCounterQuickCountIconForType() {
    const type = document.getElementById('counterQuickCountType')?.value;
    const path = iconForType(type);
    if (!path) return;
    const allCells = document.querySelectorAll('#counterQuickCountIconGrid .icon-cell[data-path], #counterQuickCountIconGridCustom .icon-cell[data-path]');
    const cell = Array.from(allCells).find(c => c.dataset.path === path);
    if (cell) {
      const inCustom = cell.closest('#counterQuickCountIconGridCustom');
      showCounterQuickCountIconTab(inCustom ? 'custom' : 'icon');
      document.querySelectorAll('#counterQuickCountIconGrid .icon-cell, #counterQuickCountIconGridCustom .icon-cell').forEach(x => x.classList.remove('selected'));
      cell.classList.add('selected');
      cell.scrollIntoView && cell.scrollIntoView({ block: 'nearest' });
    }
  }
  function showCounterQuickCountIconTab(tab) {
    document.querySelectorAll('#counterQuickCountPanel .counter-icon-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.counterQuickcountIconTab === tab));
    document.getElementById('counterQuickCountIconPanel').style.display = tab === 'icon' ? '' : 'none';
    document.getElementById('counterQuickCountIconCustomPanel').style.display = tab === 'custom' ? '' : 'none';
  }
  function syncTradeSegment() {
    const seg = document.getElementById('counterQuickCountTradeSegment');
    if (!seg) return;
    const t = quickTrade();
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.trade === t)));
  }
  function populateCounterQuickCountPanel() {
    const m = mods();
    const prof = profile();
    const esc = (s) => App.escapeHtml(s);
    syncTradeSegment();
    // Relabel the rows for the trade; '' options read as "—" (no rating).
    const [l1, l2, l3] = prof.labels;
    const lbl = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    lbl('counterQuickCountSizeLabel', l1); lbl('counterQuickCountTypeLabel', l2); lbl('counterQuickCountMaterialLabel', l3);
    const nameInput = document.getElementById('counterQuickCountName');
    if (nameInput && prof.placeholder) nameInput.placeholder = prof.placeholder;
    const sizeSel = document.getElementById('counterQuickCountSize');
    const typeSel = document.getElementById('counterQuickCountType');
    const materialSel = document.getElementById('counterQuickCountMaterial');
    const opt = (v) => '<option value="' + esc(v) + '">' + (v === '' ? '—' : esc(v)) + '</option>';
    if (sizeSel) sizeSel.innerHTML = m.sizes.map(opt).join('');
    if (typeSel) typeSel.innerHTML = m.types.map(opt).join('');
    if (materialSel) materialSel.innerHTML = m.materials.map(opt).join('');
    const icons = App.getOrderedIcons();
    const grid = document.getElementById('counterQuickCountIconGrid');
    if (grid) {
      grid.innerHTML = App.iconGridCellsHtml(icons, App.iconVbFor, (ic, i) => i === 0);
      grid.querySelectorAll('.icon-cell').forEach(c => c.onclick = () => {
        document.querySelectorAll('#counterQuickCountIconGridCustom .icon-cell').forEach(x => x.classList.remove('selected'));
        grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        updateCounterQuickCountNamePreview();
      });
    }
    const effectiveCustom = App.getEffectiveCustomIcons();
    const customGrid = document.getElementById('counterQuickCountIconGridCustom');
    if (customGrid) {
      // The project's trade leads the custom grid (its set sits on top).
      customGrid.innerHTML = App.customIconCellsHtml(effectiveCustom, undefined, quickTrade());
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
    updateCounterQuickCountMount(true);
    const swatchEl = document.getElementById('counterQuickCountSwatch');
    if (swatchEl) {
      swatchEl.onclick = () => {
        const cur = mods();
        App.showLineColorModal(cur.defaultColor || App.COLORS[2], (color) => {
          cur.defaultColor = color;
          saveMods(cur);
          swatchEl.style.background = color;
          updateCounterQuickCountNamePreview();
        });
      };
      swatchEl.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); swatchEl.click(); } };
    }
    const rmSize = document.getElementById('counterQuickCountRemoveSize');
    const rmType = document.getElementById('counterQuickCountRemoveType');
    const rmMaterial = document.getElementById('counterQuickCountRemoveMaterial');
    if (rmSize) rmSize.disabled = m.sizes.length <= 1;
    if (rmType) rmType.disabled = m.types.length <= 1;
    if (rmMaterial) rmMaterial.disabled = m.materials.length <= 1;
  }
  document.querySelectorAll('#counterQuickCountPanel .counter-icon-tab').forEach(t =>
    t.onclick = () => showCounterQuickCountIconTab(t.dataset.counterQuickcountIconTab));
  // The Trade switch: per project, remembered as the device default. Switching
  // the pressed trade off is not offered here (Project Settings clears it) —
  // the Quick tab always speaks SOME trade.
  document.getElementById('counterQuickCountTradeSegment')?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-trade]');
    if (!b || b.dataset.trade === quickTrade()) return;
    if (App.setProjectTrade) App.setProjectTrade(b.dataset.trade, { remember: true, route: 'quick-tab' });
    else App.state.trade = b.dataset.trade;
    populateCounterQuickCountPanel();
  });
  document.getElementById('counterQuickCountSize')?.addEventListener('change', () => { updateCounterQuickCountNamePreview(); updateCounterQuickCountMount(true); });
  document.getElementById('counterQuickCountType')?.addEventListener('change', () => {
    updateCounterQuickCountNamePreview();
    updateCounterQuickCountTypeIconBox();
    applyCounterQuickCountIconForType();
    updateCounterQuickCountMount(true);
  });
  document.getElementById('counterQuickCountMaterial')?.addEventListener('change', updateCounterQuickCountNamePreview);
  const counterQuickCountTypeIconBoxClick = () => {
    const sel = document.querySelector('#counterQuickCountIconGrid .icon-cell.selected') || document.querySelector('#counterQuickCountIconGridCustom .icon-cell.selected');
    const path = sel && sel.dataset.path;
    if (!path) return;
    const type = document.getElementById('counterQuickCountType')?.value;
    const m = mods();
    m.iconByType = m.iconByType || {};
    m.iconByType[type] = path;
    saveMods(m);
    updateCounterQuickCountTypeIconBox();
    updateCounterQuickCountNamePreview();
  };
  const counterQuickCountTypeIconBox = document.getElementById('counterQuickCountTypeIconBox');
  if (counterQuickCountTypeIconBox) {
    counterQuickCountTypeIconBox.onclick = counterQuickCountTypeIconBoxClick;
    counterQuickCountTypeIconBox.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); counterQuickCountTypeIconBoxClick(); } };
  }
  document.getElementById('counterQuickCountRemoveSize')?.addEventListener('click', () => removeModifier('sizes', 'counterQuickCountSize'));
  document.getElementById('counterQuickCountRemoveType')?.addEventListener('click', () => removeModifier('types', 'counterQuickCountType'));
  document.getElementById('counterQuickCountRemoveMaterial')?.addEventListener('click', () => removeModifier('materials', 'counterQuickCountMaterial'));
  const addModifier = (kind, selectId) => {
    const label = profile().labels[['sizes', 'types', 'materials'].indexOf(kind)].toLowerCase();
    const v = prompt('Enter new ' + label + ':');
    if (v && v.trim()) {
      const m = mods();
      m[kind].push(v.trim());
      saveMods(m);
      populateCounterQuickCountPanel();
      document.getElementById(selectId).value = v.trim();
      updateCounterQuickCountNamePreview();
      if (kind !== 'materials') updateCounterQuickCountMount(true);
    }
  };
  document.getElementById('counterQuickCountAddSize')?.addEventListener('click', () => addModifier('sizes', 'counterQuickCountSize'));
  document.getElementById('counterQuickCountAddType')?.addEventListener('click', () => addModifier('types', 'counterQuickCountType'));
  document.getElementById('counterQuickCountAddMaterial')?.addEventListener('click', () => addModifier('materials', 'counterQuickCountMaterial'));
  document.getElementById('counterQuickCountCancel')?.addEventListener('click', () => App.hideModal('counterModal'));
  document.getElementById('counterQuickCountAdd')?.addEventListener('click', () => {
    const computedName = composeName();
    const nameInput = document.getElementById('counterQuickCountName');
    const name = (nameInput?.value?.trim() || computedName) || profile().fallbackName;
    const sel = document.querySelector('#counterQuickCountIconGrid .icon-cell.selected') || document.querySelector('#counterQuickCountIconGridCustom .icon-cell.selected');
    const icon = sel ? sel.dataset.path : (getCounterQuickCountEffectiveIconPath() || App.getEffectiveCustomIcons()[0]?.value || App.getOrderedIcons()[0]?.value);
    App.pushUndoSnapshot();
    const newCounter = { id: App.uid(), name, icon, color: getCounterQuickCountEffectiveColor(icon) };
    // S1: the mount height rides the counter when the trade carries one and
    // the field is not blank (blank = ceiling / no default vertical).
    if (tradeHasMountHeight()) {
      const mountIn = App.parseMountHeightIn ? App.parseMountHeightIn(document.getElementById('counterQuickCountMount')?.value) : null;
      if (mountIn != null) newCounter.mountHeightIn = mountIn;
    }
    // A project that never chose a trade adopts the one it just created in.
    if (App.state.trade == null && App.setProjectTrade) App.setProjectTrade(quickTrade(), { route: 'quick-add' });
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

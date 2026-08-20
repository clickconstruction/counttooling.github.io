/*
 * features/counter.js - the Counter modal (#counterModal), extracted from the
 * app.js IIFE as the seventeenth feature-file split under the window.App registry
 * pattern. This is the choose/create-counter picker opened by the Counter button
 * / C hotkey: a Choose tab (pick an existing counter), a Create tab (name + icon
 * grid + custom-icon grid + color), and a Quick Count tab (delegated to app.js).
 *
 * Loaded as a classic <script src="features/counter.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared window.App
 * registry that app.js populates during its own load, registers showCounterTab
 * back onto App, and binds the #counterBtn opener + the choose/create handlers at
 * this file's load.
 *
 * The "quickcount" tab body (populateCounterQuickCountPanel) stays in app.js with
 * the Quick Plumbing / Quick Count section: showCounterTab calls it via
 * App.populateCounterQuickCountPanel, and the Quick Count code + Shift+Q
 * Shift+Q hotkey reach this tab via App.showCounterTab('quickcount') (same bidirectional
 * shape as the Quick Line <-> Choose/Create handoff).
 *
 * Scope is the Counter modal only. The interleaved neighbors that shared the old
 * grab-bag -- #doneEditing, the sidebar tool buttons, toggleLegendOverlay + the
 * legend buttons, and the iconVbFor global helper -- stay in app.js (the latter is
 * already published as App.iconVbFor). The many #counterBtn.click() DOM triggers
 * (sidebar, Quick Count, C hotkey) keep working because the handler moves with the
 * #counterBtn element.
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 * See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  const nameKey = (s) => (s || '').trim().toLowerCase();

  function showCounterTab(tab) {
    document.querySelectorAll('#counterModal .counter-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('counterCreatePanel').style.display = tab === 'create' ? '' : 'none';
    document.getElementById('counterChoosePanel').style.display = tab === 'choose' ? '' : 'none';
    const qcPanel = document.getElementById('counterQuickCountPanel');
    if (qcPanel) qcPanel.style.display = tab === 'quickcount' ? '' : 'none';
    // The modal-level "Search counters..." box only filters the Choose list, so
    // it is hidden on the two tabs it does not drive (it used to sit above the
    // Create form doing nothing).
    const searchRow = document.getElementById('counterModalSearchRow');
    if (searchRow) searchRow.style.display = tab === 'choose' ? '' : 'none';
    if (tab === 'choose') populateCounterChooseList(document.getElementById('counterModalSearchInput')?.value);
    if (tab === 'quickcount') App.populateCounterQuickCountPanel();
  }
  function showCounterIconTab(tab) {
    document.querySelectorAll('#counterCreatePanel .counter-icon-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.iconTab === tab));
    const iconPanel = document.getElementById('counterIconPanel');
    const customPanel = document.getElementById('counterIconCustomPanel');
    if (iconPanel) iconPanel.style.display = tab === 'icon' ? '' : 'none';
    if (customPanel) customPanel.style.display = tab === 'custom' ? '' : 'none';
    // #counterIconSearch filters the bundled grid only -- same rule as above.
    const searchGroup = document.getElementById('counterIconSearchGroup');
    if (searchGroup) searchGroup.style.display = tab === 'icon' ? '' : 'none';
  }
  function populateCounterChooseList(query) {
    const state = App.state;
    const list = document.getElementById('counterChooseList');
    const empty = document.getElementById('counterChooseEmpty');
    list.innerHTML = '';
    const esc = (s) => App.escapeHtml(s);
    const q = (query || '').toLowerCase();
    const filtered = q ? state.counters.filter(c => (c.name || '').toLowerCase().includes(q)) : state.counters;
    if (!filtered.length) {
      empty.style.display = 'block';
      // Both messages used to name the "Create Counter" button, which lives on
      // the Create panel and is off-screen while this list is showing.
      empty.textContent = q ? 'No counters match. Try the Create or Quick tab above.' : 'No counters yet — use the Create tab above.';
      return;
    }
    empty.style.display = 'none';
    filtered.forEach(c => {
      const count = state.pages.reduce((n, p) => n + ((App.getMergedAnnotationsForPage(p)?.counterMarkers?.[c.id] || []).length), 0);
      const div = document.createElement('div');
      div.className = 'sidebar-item';
      div.innerHTML = '<span class="icon-svg"><svg viewBox="' + App.iconVbFor(c.icon) + '" width="20" height="20"><path fill="' + c.color + '" d="' + c.icon + '"/></svg></span><span class="name">' + esc(c.name || 'Counter') + '</span><span class="badge">' + count + '</span><span class="swatch" style="background:' + c.color + '"></span>';
      div.onclick = () => {
        state.activeCounterType = c.id;
        state.tool = App.TOOL.COUNTER;
        App.hideModal('counterModal');
        state.pagesListCollapsed = true;
        document.getElementById('pagesSection').classList.add('collapsed');
        document.getElementById('pagesCollapseIcon').textContent = '▶';
        App.updateUI();
      };
      list.appendChild(div);
    });
  }

  // --- Create-tab prefill + twin guard --------------------------------------
  // Two counters with the same name, icon and color are indistinguishable in the
  // sidebar, the legend and the report, and only one of them is active at a
  // time -- so the tally silently SPLITS across the pair and surfaces as wrong
  // numbers at pricing time. The old sidebar "+ Add" prefilled the first library
  // icon's name ("Water Closet") unconditionally, so two back-to-back adds minted
  // exact twins. Both openers now prefill the next unused icon/name/color, and
  // the create handler is the backstop that also covers custom icons and
  // hand-typed names.
  function usedIconPaths() { return new Set((App.state.counters || []).map(c => c.icon).filter(Boolean)); }
  function usedNameKeys() { return new Set((App.state.counters || []).map(c => nameKey(c.name))); }
  function nextUnusedIcon() {
    const icons = App.getOrderedIcons();
    const usedIcons = usedIconPaths();
    const usedNames = usedNameKeys();
    return icons.find(ic => !usedIcons.has(ic.value) && !usedNames.has(nameKey(App.getIconName(ic.value)))) || icons[0];
  }
  // COLORS[2] stays the create default (an empty palette gets the colour it has
  // always got); it only rotates once something already wears it.
  function nextUnusedColor() {
    const counters = App.state.counters || [];
    const fallback = App.COLORS[2];
    if (!counters.length) return fallback;
    const used = new Set(counters.map(c => (c.color || '').toLowerCase()));
    if (!used.has(fallback.toLowerCase())) return fallback;
    return App.COLORS.find(c => !used.has(c.toLowerCase())) || fallback;
  }
  function uniqueCounterName(name) {
    const used = usedNameKeys();
    if (!used.has(nameKey(name))) return name;
    for (let n = 2; n < 1000; n++) {
      const candidate = name + ' ' + n;
      if (!used.has(nameKey(candidate))) return candidate;
    }
    return name;
  }
  // Same icon AND same color as an existing counter = a visually identical mark;
  // rotate forward through the preset palette until the pair reads apart.
  function nonTwinColor(icon, color) {
    const isTwin = (c) => (App.state.counters || []).some(x =>
      x.icon === icon && (x.color || '').toLowerCase() === (c || '').toLowerCase());
    if (!isTwin(color)) return color;
    const palette = App.COLORS;
    const start = Math.max(0, palette.findIndex(c => c.toLowerCase() === (color || '').toLowerCase()));
    for (let i = 1; i <= palette.length; i++) {
      const candidate = palette[(start + i) % palette.length];
      if (!isTwin(candidate)) return candidate;
    }
    return color;
  }
  // The prefilled name is a suggestion: it follows the icon selection until the
  // user types something of their own.
  function setSuggestedName(name) {
    const el = document.getElementById('counterName');
    el.value = name;
    el.dataset.suggested = name;
  }
  function nameIsUntouched() {
    const el = document.getElementById('counterName');
    const v = el.value.trim();
    return !v || v === (el.dataset.suggested || '');
  }
  function wireIconCells(grid, customGrid) {
    const pick = (c) => {
      if (grid) grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      if (customGrid) customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      const path = c.dataset.path;
      if (path && nameIsUntouched()) setSuggestedName(App.getIconName(path));
    };
    if (grid) grid.querySelectorAll('.icon-cell').forEach(c => { c.onclick = () => pick(c); });
    if (customGrid) customGrid.querySelectorAll('.icon-cell').forEach(c => {
      c.onclick = () => {
        if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
        pick(c);
      };
    });
  }
  function prefillCounterCreatePanel() {
    showCounterIconTab('icon');
    const icons = App.getOrderedIcons();
    const suggested = nextUnusedIcon();
    setSuggestedName(App.getIconName(suggested.value));
    document.getElementById('counterIconSearch').value = '';
    const grid = document.getElementById('counterIconGrid');
    const customGrid = document.getElementById('counterIconGridCustom');
    grid.innerHTML = App.iconGridCellsHtml(icons, App.iconVbFor, (ic) => ic.value === suggested.value);
    customGrid.innerHTML = App.customIconCellsHtml(App.getEffectiveCustomIcons());
    wireIconCells(grid, customGrid);
    App.setupCreateColorPicker({ presetsRowId: 'counterColorRow', customInputId: 'counterColorCustom', recentRowId: 'counterColorRecent', recentGroupId: 'counterColorRecentGroup', defaultColor: nextUnusedColor() });
  }
  function focusCounterName() {
    requestAnimationFrame(() => setTimeout(() => {
      const el = document.getElementById('counterName');
      // Another opener (Shift+Q / #plumBtn) may have switched tabs under us
      // between the click and this deferred focus.
      const panel = document.getElementById('counterCreatePanel');
      if (!el || !panel || panel.style.display === 'none') return;
      el.focus();
      el.select();
    }, 0));
  }

  document.getElementById('counterBtn').onclick = () => {
    const modalSearchInput = document.getElementById('counterModalSearchInput');
    if (modalSearchInput) { modalSearchInput.value = ''; }
    prefillCounterCreatePanel();
    // C used to always land on Choose -- an empty list whose only instruction
    // pointed at a button on another tab. With no counters yet there is nothing
    // to choose, so open on the pre-filled Create tab instead.
    if ((App.state.counters || []).length) {
      showCounterTab('choose');
      requestAnimationFrame(() => { setTimeout(() => modalSearchInput?.focus(), 0); });
    } else {
      showCounterTab('create');
      focusCounterName();
    }
    App.showModal('counterModal');
  };
  // counterBtn's right-click handler lives in features/tool-context-menu.js.
  document.querySelectorAll('#counterModal .counter-tab').forEach(t => t.onclick = () => showCounterTab(t.dataset.tab));
  const counterModalSearchInput = document.getElementById('counterModalSearchInput');
  if (counterModalSearchInput) {
    counterModalSearchInput.oninput = counterModalSearchInput.onkeyup = () => populateCounterChooseList(counterModalSearchInput.value);
    counterModalSearchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const first = document.querySelector('#counterChooseList .sidebar-item');
        if (first) { first.click(); e.preventDefault(); }
      }
    };
  }
  document.getElementById('counterChooseCancel').onclick = () => App.hideModal('counterModal');

  document.getElementById('addCounter').onclick = () => {
    const modalSearchInput = document.getElementById('counterModalSearchInput');
    if (modalSearchInput) { modalSearchInput.value = ''; }
    showCounterTab('create');
    prefillCounterCreatePanel();
    App.showModal('counterModal');
    focusCounterName();
  };
  document.querySelectorAll('#counterCreatePanel .counter-icon-tab').forEach(t =>
    t.onclick = () => showCounterIconTab(t.dataset.iconTab));
  document.getElementById('counterIconSearch').oninput = () => {
    const q = document.getElementById('counterIconSearch').value.toLowerCase();
    const grid = document.getElementById('counterIconGrid');
    const customGrid = document.getElementById('counterIconGridCustom');
    const icons = App.getOrderedIcons();
    const filtered = q ? icons.filter(ic => ic.terms.some(t => t.includes(q))) : icons;
    const hadCustomSelected = customGrid.querySelector('.icon-cell.selected');
    grid.innerHTML = App.iconGridCellsHtml(filtered, App.iconVbFor, (ic, i) => i === 0 && !hadCustomSelected);
    wireIconCells(grid, customGrid);
    // The rebuild auto-selects the first hit, so the suggested name follows it.
    if (!hadCustomSelected && filtered.length && nameIsUntouched()) setSuggestedName(App.getIconName(filtered[0].value));
  };
  document.getElementById('counterCancel').onclick = () => App.hideModal('counterModal');
  document.getElementById('counterCreate').onclick = () => {
    const state = App.state;
    const sel = document.querySelector('#counterIconGrid .icon-cell.selected') || document.querySelector('#counterIconGridCustom .icon-cell.selected');
    const icon = sel ? sel.dataset.path : App.getOrderedIcons()[0].value;
    // A blank name used to mint a counter literally called "Counter"; name it
    // after the icon that was actually picked instead.
    const baseName = document.getElementById('counterName').value.trim() || App.getIconName(icon) || 'Counter';
    const name = uniqueCounterName(baseName);
    const pickedColor = document.getElementById('counterColorRow').dataset.selectedColor || App.COLORS[2];
    const color = nonTwinColor(icon, pickedColor);
    App.pushUndoSnapshot();
    const newCounter = { id: App.uid(), name, icon, color };
    state.counters.push(newCounter);
    App.pushRecentColor(color);
    state.activeCounterType = newCounter.id;
    state.tool = App.TOOL.COUNTER;
    App.markProjectDirty();
    state.pagesListCollapsed = true;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
    App.hideModal('counterModal');
    App.updateUI();
    if (name !== baseName) App.showToast('"' + baseName + '" already exists — created "' + name + '"');
  };

  App.showCounterTab = showCounterTab;
})();

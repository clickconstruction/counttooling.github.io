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

  function showCounterTab(tab) {
    document.querySelectorAll('#counterModal .counter-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('counterCreatePanel').style.display = tab === 'create' ? '' : 'none';
    document.getElementById('counterChoosePanel').style.display = tab === 'choose' ? '' : 'none';
    const qcPanel = document.getElementById('counterQuickCountPanel');
    if (qcPanel) qcPanel.style.display = tab === 'quickcount' ? '' : 'none';
    // The modal-level "Search counters..." box only filters the Choose list;
    // hide it on the Create/Quick tabs so it can't pose as an icon/type search.
    const searchRow = document.querySelector('#counterModal .counter-modal-search-row');
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
    // The icon search filters the library grid only, so it rides the Icon tab.
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
      empty.textContent = q ? 'No counters match. Try the Create or Quick tabs above.' : 'No counters yet — use the Create tab above to add one.';
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
  // Shared wiring for the create-tab icon grids: a pick clears BOTH grids'
  // selections (the upload cell re-opens the file picker instead), and fills
  // an empty Name field from the picked icon.
  function wireCreateIconCells(cells) {
    const grid = document.getElementById('counterIconGrid');
    const customGrid = document.getElementById('counterIconGridCustom');
    cells.forEach(c => {
      c.onclick = () => {
        if (c.dataset.upload) {
          document.getElementById('customIconUploadInput').click();
          return;
        }
        grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
        customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        const path = c.dataset.path;
        if (path && !document.getElementById('counterName').value.trim()) document.getElementById('counterName').value = App.getIconName(path);
      };
    });
  }
  // Reset the Create tab: prefill the first library icon NOT already used by an
  // existing counter (falling back to the first icon when all are used), so
  // back-to-back "+ Add" creates suggest distinct counters instead of minting
  // identical "Water Closet" twins that silently split tallies.
  function populateCounterCreatePanel() {
    const state = App.state;
    showCounterIconTab('icon');
    const icons = App.getOrderedIcons();
    const used = new Set((state.counters || []).map(c => c.icon));
    let selIdx = icons.findIndex(ic => !used.has(ic.value));
    if (selIdx === -1) selIdx = 0;
    document.getElementById('counterName').value = App.getIconName(icons[selIdx].value);
    document.getElementById('counterIconSearch').value = '';
    const grid = document.getElementById('counterIconGrid');
    const customGrid = document.getElementById('counterIconGridCustom');
    grid.innerHTML = App.iconGridCellsHtml(icons, App.iconVbFor, (ic, i) => i === selIdx);
    customGrid.innerHTML = App.customIconCellsHtml(App.getEffectiveCustomIcons());
    wireCreateIconCells(grid.querySelectorAll('.icon-cell'));
    wireCreateIconCells(customGrid.querySelectorAll('.icon-cell'));
    App.setupCreateColorPicker({ presetsRowId: 'counterColorRow', customInputId: 'counterColorCustom', recentRowId: 'counterColorRecent', recentGroupId: 'counterColorRecentGroup' });
  }
  document.getElementById('counterBtn').onclick = () => {
    const modalSearchInput = document.getElementById('counterModalSearchInput');
    if (modalSearchInput) { modalSearchInput.value = ''; }
    populateCounterCreatePanel();
    if (!App.state.counters.length) {
      // No counters yet: Choose is a dead end, so land on the prefilled
      // Create tab (same as "+ Add") instead of an empty list.
      showCounterTab('create');
    } else {
      showCounterTab('choose');
      requestAnimationFrame(() => { setTimeout(() => modalSearchInput?.focus(), 0); });
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
    populateCounterCreatePanel();
    showCounterTab('create');
    App.showModal('counterModal');
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
    wireCreateIconCells(grid.querySelectorAll('.icon-cell'));
  };
  document.getElementById('counterCancel').onclick = () => App.hideModal('counterModal');
  document.getElementById('counterCreate').onclick = () => {
    const state = App.state;
    const sel = document.querySelector('#counterIconGrid .icon-cell.selected') || document.querySelector('#counterIconGridCustom .icon-cell.selected');
    const icon = sel ? sel.dataset.path : App.getOrderedIcons()[0].value;
    // A blanked name inherits the picked icon's name, not the literal "Counter".
    let name = document.getElementById('counterName').value.trim() || App.getIconName(icon);
    let color = document.getElementById('counterColorRow').dataset.selectedColor || App.COLORS[2];
    // Exact twins (same name/icon/color — library or custom icon) silently
    // SPLIT tallies between two indistinguishable counters, surfacing as wrong
    // numbers at pricing time. De-twin: rotate to the next preset color not on
    // a same-icon counter, and number the name.
    if (state.counters.some(c => (c.name || '') === name && c.icon === icon && (c.color || '').toLowerCase() === color.toLowerCase())) {
      const usedColors = new Set(state.counters.filter(c => c.icon === icon).map(c => (c.color || '').toLowerCase()));
      usedColors.add(color.toLowerCase());
      const rotated = App.COLORS.find(c => !usedColors.has(c.toLowerCase()));
      if (rotated) color = rotated;
      let n = 2;
      while (state.counters.some(c => (c.name || '') === name + ' ' + n)) n++;
      name = name + ' ' + n;
    }
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
  };

  App.showCounterTab = showCounterTab;
})();

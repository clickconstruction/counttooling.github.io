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
    // The #counterIconSearch handler filters the built-in grid only, so the
    // search group shows only while the Icon tab is active (a Custom-tab
    // search box that filtered nothing would be a new inert-search papercut).
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
      empty.textContent = q ? 'No counters match. Try Create Counter or Quick Count.' : 'No counters yet — use the Create tab above.';
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
  // One shared prep for the Create panel — both openers (#counterBtn and
  // #addCounter) call it, so the old two-opener behavioral fork (C-route:
  // blank name, no custom grid; +Add-route: prefilled, custom grid) is gone.
  // Prefill walks App.getOrderedIcons() for the first icon whose name no
  // existing counter uses (respects the user's iconOrder; falls back to
  // icon[0] when every name is taken) and selects that cell so the name
  // matches the visible selection.
  function prepCreatePanel() {
    const state = App.state;
    showCounterIconTab('icon');
    const icons = App.getOrderedIcons();
    const usedNames = new Set(state.counters.map(c => (c.name || '').trim().toLowerCase()));
    let prefillIdx = icons.findIndex(ic => !usedNames.has(App.getIconName(ic.value).trim().toLowerCase()));
    if (prefillIdx < 0) prefillIdx = 0;
    document.getElementById('counterName').value = App.getIconName(icons[prefillIdx].value);
    document.getElementById('counterIconSearch').value = '';
    const grid = document.getElementById('counterIconGrid');
    const customGrid = document.getElementById('counterIconGridCustom');
    grid.innerHTML = App.iconGridCellsHtml(icons, App.iconVbFor, (ic, i) => i === prefillIdx);
    const effectiveCustom = App.getEffectiveCustomIcons();
    customGrid.innerHTML = App.customIconCellsHtml(effectiveCustom);
    grid.querySelectorAll('.icon-cell').forEach(c => c.onclick = () => {
      grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      const path = c.dataset.path;
      if (path && !document.getElementById('counterName').value.trim()) document.getElementById('counterName').value = App.getIconName(path);
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
        const path = c.dataset.path;
        if (path && !document.getElementById('counterName').value.trim()) document.getElementById('counterName').value = App.getIconName(path);
      };
    });
    App.setupCreateColorPicker({ presetsRowId: 'counterColorRow', customInputId: 'counterColorCustom', recentRowId: 'counterColorRecent', recentGroupId: 'counterColorRecentGroup' });
  }

  // Twin resolution for a to-be-created counter. Pure-shaped on purpose
  // (name, icon, color, counters, palette — no App.* reads).
  // Same trimmed name (case-insensitive) → lowest free numbered suffix
  // ("Water Closet 2", " 3", …). Only when that twin ALSO matches icon AND
  // color exactly does the color rotate — via the shared
  // `nextUnusedCounterColor` (recent-colors.js, bare classic-script global;
  // Quick Count shares it, T2 #16) — so a deliberate same-name/
  // different-color counter keeps its color.
  function resolveCounterTwin(name, icon, color, counters, palette) {
    const norm = (s) => (s || '').trim().toLowerCase();
    const twins = counters.filter(c => norm(c.name) === norm(name));
    if (!twins.length) return { name, color };
    const usedNames = new Set(counters.map(c => norm(c.name)));
    let n = 2;
    while (usedNames.has(norm(name + ' ' + n))) n++;
    const suffixed = name + ' ' + n;
    const exactTwin = twins.some(c => c.icon === icon && norm(c.color) === norm(color));
    if (!exactTwin) return { name: suffixed, color };
    return { name: suffixed, color: nextUnusedCounterColor(counters, palette, color) };
  }

  document.getElementById('counterBtn').onclick = () => {
    const state = App.state;
    const modalSearchInput = document.getElementById('counterModalSearchInput');
    if (modalSearchInput) { modalSearchInput.value = ''; }
    prepCreatePanel();
    if (state.counters.length === 0) {
      // Fresh project: land on Create, prefilled — exactly like + Add.
      showCounterTab('create');
    } else {
      showCounterTab('choose');
      populateCounterChooseList();
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
    showCounterTab('create');
    prepCreatePanel();
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
    grid.querySelectorAll('.icon-cell').forEach(c => c.onclick = () => {
      grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      const path = c.dataset.path;
      if (path && !document.getElementById('counterName').value.trim()) document.getElementById('counterName').value = App.getIconName(path);
    });
  };
  document.getElementById('counterCancel').onclick = () => App.hideModal('counterModal');
  document.getElementById('counterCreate').onclick = () => {
    const state = App.state;
    const sel = document.querySelector('#counterIconGrid .icon-cell.selected') || document.querySelector('#counterIconGridCustom .icon-cell.selected');
    const icon = sel ? sel.dataset.path : App.getOrderedIcons()[0].value;
    // A blank name falls back to the selected icon's name — never the
    // literal string 'Counter' (repeat blanks used to collide under it).
    const rawName = document.getElementById('counterName').value.trim() || App.getIconName(icon);
    const rawColor = document.getElementById('counterColorRow').dataset.selectedColor || App.COLORS[2];
    const { name, color } = resolveCounterTwin(rawName, icon, rawColor, state.counters, App.COLORS);
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

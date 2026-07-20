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
      empty.textContent = q ? 'No counters match. Try Create Counter or Quick Count.' : 'Add a counter first using Create Counter.';
      return;
    }
    empty.style.display = 'none';
    filtered.forEach(c => {
      const count = state.pages.reduce((n, p) => n + ((p.annotations?.counterMarkers?.[c.id] || []).length), 0);
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
  document.getElementById('counterBtn').onclick = () => {
    const modalSearchInput = document.getElementById('counterModalSearchInput');
    if (modalSearchInput) { modalSearchInput.value = ''; }
    showCounterTab('choose');
    populateCounterChooseList();
    requestAnimationFrame(() => { setTimeout(() => modalSearchInput?.focus(), 0); });
    document.getElementById('counterName').value = '';
    document.getElementById('counterIconSearch').value = '';
    const grid = document.getElementById('counterIconGrid');
    const icons = App.getOrderedIcons();
    grid.innerHTML = icons.map((ic, i) => '<div class="icon-cell' + (i === 0 ? ' selected' : '') + '" data-path="' + ic.value + '"><svg viewBox="' + App.iconVbFor(ic.value) + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
    grid.querySelectorAll('.icon-cell').forEach(c => c.onclick = () => { grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected')); c.classList.add('selected'); });
    App.setupCreateColorPicker({ presetsRowId: 'counterColorRow', customInputId: 'counterColorCustom', recentRowId: 'counterColorRecent', recentGroupId: 'counterColorRecentGroup' });
    App.showModal('counterModal');
  };
  document.getElementById('counterBtn').oncontextmenu = (e) => {
    e.preventDefault();
    if (App.state.isViewer) return;
    document.getElementById('countersSectionTitle').click();
  };
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
    showCounterIconTab('icon');
    const icons = App.getOrderedIcons();
    document.getElementById('counterName').value = App.getIconName(icons[0].value);
    document.getElementById('counterIconSearch').value = '';
    const grid = document.getElementById('counterIconGrid');
    const customGrid = document.getElementById('counterIconGridCustom');
    grid.innerHTML = icons.map((ic, i) => '<div class="icon-cell' + (i === 0 ? ' selected' : '') + '" data-path="' + ic.value + '"><svg viewBox="' + App.iconVbFor(ic.value) + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
    const effectiveCustom = App.getEffectiveCustomIcons();
    customGrid.innerHTML = '<div class="icon-cell icon-cell-upload" data-upload="1" title="Upload SVG">+</div>' + effectiveCustom.map((ic) => '<div class="icon-cell" data-path="' + ic.value + '"><svg viewBox="' + ic.viewBox + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
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
    grid.innerHTML = filtered.map((ic, i) => '<div class="icon-cell' + (i === 0 && !hadCustomSelected ? ' selected' : '') + '" data-path="' + ic.value + '"><svg viewBox="' + App.iconVbFor(ic.value) + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
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
    const name = document.getElementById('counterName').value.trim() || 'Counter';
    const sel = document.querySelector('#counterIconGrid .icon-cell.selected') || document.querySelector('#counterIconGridCustom .icon-cell.selected');
    const icon = sel ? sel.dataset.path : App.getOrderedIcons()[0].value;
    const color = document.getElementById('counterColorRow').dataset.selectedColor || App.COLORS[2];
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

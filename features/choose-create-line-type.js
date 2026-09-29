/*
 * features/choose-create-line-type.js - the Choose/Create Line Type modal
 * (chooseLineTypeModal), extracted from the app.js IIFE as the twelfth
 * feature-file split under the window.App registry pattern. This is the modal
 * that opens from the Quick Line button / L hotkey: a tabbed picker with a
 * Choose list (pick an existing line type), a Create panel (name + color +
 * curve), and a Quick tab (delegated to app.js's populateQuickLineModal).
 *
 * Loaded as a classic <script src="features/choose-create-line-type.js"> AFTER
 * app.js. Its own IIFE: it reaches the cross-cutting state + helpers through the
 * shared window.App registry that app.js populates during its own load,
 * registers showChooseLineTypeModal + showLineTypeTab back onto App, and binds
 * the modal's tab clicks, search input, Cancel buttons, and Create button at
 * this file's load.
 *
 * Scope is the Choose/Create Line Type modal only. The line-color modal
 * (showLineColorModal/applyLineColor + #lineColorCancel/#lineColorCustom) and
 * all sidebar collapse/search/show-only handlers stay in app.js; they are
 * separate concerns that share the same former grab-bag section. The Quick tab
 * body (populateQuickLineModal) and the Quick Line apply flow stay in app.js and
 * are reached via App.populateQuickLineModal. The two app.js call sites
 * (#quickLine.onclick and Shift+Q when this modal is open) reach this modal via
 * App.showChooseLineTypeModal / App.showLineTypeTab at call time.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function showLineTypeTab(tab) {
    document.querySelectorAll('.line-type-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('chooseLineTypePanel').style.display = tab === 'choose' ? '' : 'none';
    document.getElementById('createLineTypePanel').style.display = tab === 'create' ? '' : 'none';
    const quickPanel = document.getElementById('chooseLineTypeQuickPanel');
    if (quickPanel) quickPanel.style.display = tab === 'quick' ? '' : 'none';
    // B17 parity (FLAKE-WATER-FIELD, 2026-09-28): the search filters ONLY the Choose list, so on
    // Create and Quick the row goes, as the Counter dialog's has since B17; a hidden box cannot
    // take the caret from the name field a reader is typing in.
    const searchRow = document.querySelector('#chooseLineTypeModal .counter-modal-search-row');
    if (searchRow) searchRow.style.display = tab === 'choose' ? '' : 'none';
    if (tab === 'choose') populateChooseLineTypeList(document.getElementById('lineTypeModalSearchInput')?.value);
    else if (tab === 'create') {
      document.getElementById('createLineTypeName').value = '';
      if (App.registerWaterSideForm) { App.registerWaterSideForm('create', { radioName: 'createLineTypeWaterSide', groupId: 'createLineTypeWaterGroup', nameInputId: 'createLineTypeName', name: () => document.getElementById('createLineTypeName').value }); App.resetWaterSideForm('create'); }   // WATER-PLAN rung 3
      App.setupCreateColorPicker({ presetsRowId: 'createLineTypeColorRow', customInputId: 'createLineTypeColorCustom', recentRowId: 'createLineTypeColorRecent', recentGroupId: 'createLineTypeColorRecentGroup' });
    } else if (tab === 'quick') App.populateQuickLineModal();
  }
  function populateChooseLineTypeList(filter) {
    const state = App.state;
    const list = document.getElementById('chooseLineTypeList');
    const empty = document.getElementById('chooseLineTypeEmpty');
    list.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();
    const filtered = state.lineTypes.filter(lt => !q || (lt.name || 'Line').toLowerCase().includes(q));
    if (!filtered.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    filtered.forEach(lt => {
      const div = document.createElement('div');
      div.className = 'sidebar-item sidebar-item-line-type';
      // MAP-XSS: the name and the color are the estimator's own words (or a shared or imported project's); text, never markup.
      div.innerHTML = '<span class="name line-type-name">' + App.escapeHtml(lt.name || 'Line') + '</span><span class="swatch" style="background:' + App.escapeHtml(lt.color || '#4a9eff') + '"></span>';
      div.onclick = () => {
        state.activeLineTypeId = lt.id;
        App.hideModal('chooseLineTypeModal');
        state.tool = App.TOOL.LINE;
        state.quickLineStart = null;
        state.pagesListCollapsed = true;
        document.getElementById('pagesSection').classList.add('collapsed');
        document.getElementById('pagesCollapseIcon').textContent = '▶';
        // B9 (J1 J15): armed — close the mobile drawer so the next tap lands
        // on the plan (cancelling the picker leaves the drawer open instead).
        App.closeMobileSidebar && App.closeMobileSidebar();
        App.updateUI();
      };
      list.appendChild(div);
    });
  }
  // The search box takes the caret a beat after the chooser opens (a frame, then a tick, so
  // the dialog is painted first), and it YIELDS when the caret has moved on: a reader who
  // opened the chooser, went straight to Create or Quick and started typing keeps the field
  // they are in, and a tab that is no longer Choose keeps its own. FLAKE-WATER-FIELD
  // (2026-09-28): under CI load that beat landed between a spec's focus of the Create name
  // and its typing, the name went into the search box, and the Water radio never saw it.
  // counter.js's focusCreateName has had the same rule since 2026-09-12.
  function focusSearchSoon(searchInput) {
    requestAnimationFrame(() => setTimeout(() => {
      if (!searchInput) return;
      const modal = document.getElementById('chooseLineTypeModal');
      const active = document.activeElement;
      if (active && active !== searchInput && active !== document.body && modal && modal.contains(active)) return;   // the caret moved on
      if (document.getElementById('chooseLineTypePanel')?.style.display === 'none') return;   // the tab moved on
      searchInput.focus();
    }, 0));
  }
  function showChooseLineTypeModal() {
    const searchInput = document.getElementById('lineTypeModalSearchInput');
    if (searchInput) searchInput.value = '';
    showLineTypeTab('choose');
    App.showModal('chooseLineTypeModal');
    focusSearchSoon(searchInput);
  }

  document.querySelectorAll('.line-type-tab').forEach(t => t.onclick = () => showLineTypeTab(t.dataset.tab));
  const lineTypeModalSearchInput = document.getElementById('lineTypeModalSearchInput');
  if (lineTypeModalSearchInput) {
    lineTypeModalSearchInput.oninput = lineTypeModalSearchInput.onkeyup = () => populateChooseLineTypeList(lineTypeModalSearchInput.value);
    lineTypeModalSearchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const first = document.querySelector('#chooseLineTypeList .sidebar-item');
        if (first) first.click();
      }
    };
  }
  document.getElementById('chooseLineTypeCancel').onclick = () => App.hideModal('chooseLineTypeModal');
  document.getElementById('createLineTypeCancel').onclick = () => App.hideModal('chooseLineTypeModal');
  document.getElementById('createLineTypeCreate').onclick = () => {
    const state = App.state;
    const name = document.getElementById('createLineTypeName').value.trim() || nextLineTypeName(state.lineTypes);
    const color = document.getElementById('createLineTypeColorRow').dataset.selectedColor || App.COLORS[2];
    const curveSel = document.querySelector('input[name="createLineTypeCurve"]:checked');
    const curveStyle = curveSel ? curveSel.value : 'straight';
    App.pushUndoSnapshot();
    const newLt = { id: App.uid(), name, color, curveStyle };
    if (App.applyWaterSideToLineType) App.applyWaterSideToLineType('create', newLt);   // WATER-PLAN rung 3, set-only
    state.lineTypes.push(newLt);
    App.pushRecentColor(color);
    state.activeLineTypeId = newLt.id;
    App.markProjectDirty();
    App.hideModal('chooseLineTypeModal');
    App.armLineToolAfterCreate();
    App.updateUI();
  };

  App.showChooseLineTypeModal = showChooseLineTypeModal;
  App.showLineTypeTab = showLineTypeTab;
})();

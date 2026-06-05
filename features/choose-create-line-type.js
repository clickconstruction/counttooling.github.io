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
    if (tab === 'choose') populateChooseLineTypeList(document.getElementById('lineTypeModalSearchInput')?.value);
    else if (tab === 'create') {
      document.getElementById('createLineTypeName').value = '';
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
      div.innerHTML = '<span class="name line-type-name">' + (lt.name || 'Line') + '</span><span class="swatch" style="background:' + (lt.color || '#4a9eff') + '"></span>';
      div.onclick = () => {
        state.activeLineTypeId = lt.id;
        App.hideModal('chooseLineTypeModal');
        state.tool = App.TOOL.LINE;
        state.quickLineStart = null;
        state.pagesListCollapsed = true;
        document.getElementById('pagesSection').classList.add('collapsed');
        document.getElementById('pagesCollapseIcon').textContent = '▶';
        App.updateUI();
      };
      list.appendChild(div);
    });
  }
  function showChooseLineTypeModal() {
    const searchInput = document.getElementById('lineTypeModalSearchInput');
    if (searchInput) searchInput.value = '';
    showLineTypeTab('choose');
    App.showModal('chooseLineTypeModal');
    requestAnimationFrame(() => { setTimeout(() => searchInput?.focus(), 0); });
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
    const name = document.getElementById('createLineTypeName').value.trim() || 'Line';
    const color = document.getElementById('createLineTypeColorRow').dataset.selectedColor || App.COLORS[2];
    const curveSel = document.querySelector('input[name="createLineTypeCurve"]:checked');
    const curveStyle = curveSel ? curveSel.value : 'straight';
    App.pushUndoSnapshot();
    const newLt = { id: App.uid(), name, color, curveStyle };
    state.lineTypes.push(newLt);
    App.pushRecentColor(color);
    state.activeLineTypeId = newLt.id;
    App.markProjectDirty();
    App.hideModal('chooseLineTypeModal');
    state.tool = App.TOOL.LINE;
    state.quickLineStart = null;
    state.pagesListCollapsed = true;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
    App.updateUI();
  };

  App.showChooseLineTypeModal = showChooseLineTypeModal;
  App.showLineTypeTab = showLineTypeTab;
})();

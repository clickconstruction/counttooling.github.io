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
    // B17: the modal search filters ONLY the Choose list — on Create/Quick it
    // was an inert box (the same papercut the icon-search group already
    // avoids, see showCounterIconTab).
    const modalSearchRow = document.querySelector('#counterModal .counter-modal-search-row');
    if (modalSearchRow) modalSearchRow.style.display = tab === 'choose' ? '' : 'none';
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
      empty.textContent = q ? 'No counters match. Try Create Counter or Quick Count.' : 'No counters yet. Use the Create tab above.';
      return;
    }
    empty.style.display = 'none';
    filtered.forEach(c => {
      // T2-11: multiply-adjusted total, matching the sidebar Counters badge
      // (T1-11 rule: these two must agree) and every rollup surface; placed
      // count in the hover title when a zone makes them differ.
      let placed = 0, withRepeats = 0;
      state.pages.forEach(p => {
        const t = App.counterTally(App.getMergedAnnotationsForPage(p), c.id);
        placed += t.placed; withRepeats += t.withRepeats;
      });
      const badgeTitle = withRepeats !== placed ? ' title="' + placed + ' placed · ' + withRepeats + ' with repeats"' : '';
      const div = document.createElement('div');
      div.className = 'sidebar-item';
      div.innerHTML = '<span class="icon-svg"><svg viewBox="' + App.iconVbFor(c.icon) + '" width="20" height="20"><path fill="' + c.color + '" d="' + c.icon + '"/></svg></span><span class="name">' + esc(c.name || 'Counter') + '</span><span class="badge"' + badgeTitle + '>' + withRepeats + '</span><span class="swatch" style="background:' + c.color + '"></span>';
      div.onclick = () => {
        state.activeCounterType = c.id;
        state.tool = App.TOOL.COUNTER;
        App.hideModal('counterModal');
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
  // One shared prep for the Create panel — both openers (#counterBtn and
  // #addCounter) call it, so the old two-opener behavioral fork (C-route:
  // blank name, no custom grid; +Add-route: prefilled, custom grid) is gone.
  // Prefill walks App.getOrderedIcons() for the first icon whose name no
  // existing counter uses (respects the user's iconOrder; falls back to
  // icon[0] when every name is taken) and selects that cell so the name
  // matches the visible selection.
  //
  // D16: `createIconPicked` is false until the estimator clicks a cell — the
  // prefill selection is the app's choice, not hers. While it stays false, a
  // positive CFM moves the selection to the HVAC set's Supply Diffuser
  // (App.cfmDefaultIcon) and clearing it restores the prefill, so the Create
  // button's "selected cell" read stays WYSIWYG; the create handler applies
  // the same rule once more as the guarantee. A non-CFM counter never changes.
  let createIconPicked = false;
  let createPrefillPath = null;
  function selectCreateIconCell(path) {
    const grid = document.getElementById('counterIconGrid');
    const customGrid = document.getElementById('counterIconGridCustom');
    grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
    customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
    const cell = path && Array.from(grid.querySelectorAll('.icon-cell[data-path]')).concat(Array.from(customGrid.querySelectorAll('.icon-cell[data-path]'))).find(c => c.dataset.path === path);
    if (cell) cell.classList.add('selected');
  }
  // An SVG upload is an explicit choice too: the shared upload handler
  // (features/custom-icon-upload.js) rebuilds this panel's custom grid with
  // its own click wiring and selects the new icon, so it reports here.
  App.markCreateIconPicked = () => { createIconPicked = true; syncCreateCfmChip(); };
  function syncCreateIconToCfm() {
    if (createIconPicked) { syncCreateCfmChip(); return; }
    const v = parseFloat(document.getElementById('counterCfm')?.value);
    const cfmIcon = Number.isFinite(v) && v > 0 && App.cfmDefaultIcon ? App.cfmDefaultIcon() : null;
    selectCreateIconCell(cfmIcon || createPrefillPath);
    syncCreateCfmChip();
  }

  // D18 (B19 ratchet, J19 #11): the inline icon chip beside a CFM field —
  // "→ [icon] Supply Diffuser · change". D16 moved the selection to the HVAC
  // Supply Diffuser on the hidden Custom Icons panel, so the pick was
  // invisible; the chip names the glyph the counter WILL take right where the
  // CFM is typed (the diffuser while nothing was picked, the picked icon after
  // an explicit click/upload). "change" opens the Custom Icons grid scrolled to
  // the HVAC group — no automatic tab switch (D16 never switched; the chip is
  // the landing, not a jump). Hidden while the CFM is empty. Shared with the
  // Quick Count twin (features/quick-modals.js) through App.syncCfmIconChip.
  function syncCfmIconChip(chipId, opts) {
    const chip = document.getElementById(chipId);
    if (!chip) return;
    const show = !!(opts.hasCfm && opts.iconPath);
    chip.hidden = !show;
    if (!show) { chip.innerHTML = ''; delete chip.dataset.path; return; }
    const name = App.getIconName(opts.iconPath);
    chip.innerHTML = '<span class="cfm-icon-chip-arrow" aria-hidden="true">→</span>'
      + '<span class="cfm-icon-chip-glyph"><svg viewBox="' + App.iconVbFor(opts.iconPath) + '" width="18" height="18"><path fill="currentColor" d="' + opts.iconPath + '"/></svg></span>'
      + '<span class="cfm-icon-chip-name">' + App.escapeHtml(name) + '</span>'
      + '<span class="cfm-icon-chip-sep" aria-hidden="true">·</span>'
      + '<button type="button" class="cfm-icon-chip-change" title="Pick a different icon. Opens the Custom Icons grid at the HVAC group">change</button>';
    chip.dataset.path = opts.iconPath;
    chip.querySelector('.cfm-icon-chip-change').onclick = opts.onChange;
  }
  // Scroll an icon grid so the set heading ("HVAC") sits at its top, then
  // bring the grid itself into the modal's view.
  function scrollIconGridToSet(grid, setLabel) {
    if (!grid) return false;
    const heading = Array.from(grid.querySelectorAll('.icon-grid-heading')).find((h) => h.textContent.trim() === setLabel);
    if (!heading) return false;
    grid.scrollTop = heading.getBoundingClientRect().top - grid.getBoundingClientRect().top + grid.scrollTop;
    if (heading.scrollIntoView) heading.scrollIntoView({ block: 'nearest' });
    return true;
  }
  function createSelectedIconPath() {
    const sel = document.querySelector('#counterIconGrid .icon-cell.selected') || document.querySelector('#counterIconGridCustom .icon-cell.selected');
    return sel ? sel.dataset.path : null;
  }
  function syncCreateCfmChip() {
    const v = parseFloat(document.getElementById('counterCfm')?.value);
    const hasCfm = Number.isFinite(v) && v > 0;
    const iconPath = createIconPicked ? createSelectedIconPath() : ((App.cfmDefaultIcon && App.cfmDefaultIcon()) || null);
    syncCfmIconChip('counterCfmIconChip', {
      hasCfm, iconPath,
      onChange: () => {
        showCounterIconTab('custom');
        scrollIconGridToSet(document.getElementById('counterIconGridCustom'), 'HVAC');
      },
    });
  }
  // D19 (B19 part 2, ratcheted): the "More ▸ air & mounting" disclosure shared
  // by the Create tab and its Quick Count twin. The fields stay REACHABLE on
  // every trade — hiding them outright was rejected because the first CFM
  // device on a fresh project would be impossible to create — so the toggle
  // only decides whether they start unfolded: open on the HVAC and Electrical
  // trade profiles, closed on plumbing. An estimator's own toggle wins for the
  // rest of the project (state.counterAirMoreOpen; in-memory, reset with the
  // project by resetLocalSessionState). Both tabs read the one flag, so the
  // preference does not split between them.
  function airMoreDefaultOpen() {
    const trade = App.getQuickTrade ? App.getQuickTrade() : 'plumbing';
    return trade === 'hvac' || trade === 'electrical';
  }
  function setAirMoreOpen(btn, fields, open) {
    fields.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    const caret = btn.querySelector('.counter-air-more-caret');
    if (caret) caret.textContent = open ? '▾' : '▸';
  }
  function applyCounterAirMore(toggleId, fieldsId) {
    const btn = document.getElementById(toggleId);
    const fields = document.getElementById(fieldsId);
    if (!btn || !fields) return;
    const stored = App.state.counterAirMoreOpen;
    setAirMoreOpen(btn, fields, stored == null ? airMoreDefaultOpen() : !!stored);
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = fields.hidden;
      App.state.counterAirMoreOpen = next;
      setAirMoreOpen(btn, fields, next);
    };
  }

  function prepCreatePanel() {
    const state = App.state;
    showCounterIconTab('icon');
    const icons = App.getOrderedIcons();
    const usedNames = new Set(state.counters.map(c => (c.name || '').trim().toLowerCase()));
    let prefillIdx = icons.findIndex(ic => !usedNames.has(App.getIconName(ic.value).trim().toLowerCase()));
    if (prefillIdx < 0) prefillIdx = 0;
    createIconPicked = false;
    createPrefillPath = icons[prefillIdx].value;
    document.getElementById('counterName').value = App.getIconName(icons[prefillIdx].value);
    // D6: the optional CFM (air devices only) always opens empty — a stale
    // value from the previous create must never silently ride a new counter.
    const cfmEl = document.getElementById('counterCfm');
    if (cfmEl) cfmEl.value = '';
    const mountEl = document.getElementById('counterMountHeight');
    if (mountEl) mountEl.value = '';
    // D8: same rule for the optional flex-drop length beside it. D18: its
    // sublabel + placeholder read the data-table default (duct-model.js
    // DUCT_FLEX_DEFAULTS.dropFt) at render — the two numbers can't drift.
    const flexEl = document.getElementById('counterFlexDrop');
    if (flexEl) {
      flexEl.value = '';
      const dropFt = typeof DUCT_FLEX_DEFAULTS !== 'undefined' && DUCT_FLEX_DEFAULTS.dropFt > 0 ? DUCT_FLEX_DEFAULTS.dropFt : null;
      flexEl.placeholder = dropFt != null ? String(dropFt) : '';
      const defEl = document.getElementById('counterFlexDropDefault');
      if (defEl) defEl.textContent = dropFt != null ? dropFt + "'" : 'the default';
    }
    document.getElementById('counterIconSearch').value = '';
    const grid = document.getElementById('counterIconGrid');
    const customGrid = document.getElementById('counterIconGridCustom');
    grid.innerHTML = App.iconGridCellsHtml(icons, App.iconVbFor, (ic, i) => i === prefillIdx);
    const effectiveCustom = App.getEffectiveCustomIcons();
    customGrid.innerHTML = App.customIconCellsHtml(effectiveCustom, undefined, App.getQuickTrade ? App.getQuickTrade() : undefined);
    grid.querySelectorAll('.icon-cell').forEach(c => c.onclick = () => {
      grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      createIconPicked = true;
      const path = c.dataset.path;
      if (path && !document.getElementById('counterName').value.trim()) document.getElementById('counterName').value = App.getIconName(path);
      syncCreateCfmChip();   // D18: an explicit pick replaces the chip's icon
      if (App.syncWsfuForm) App.syncWsfuForm('create');   // the pick may have named the counter
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
        createIconPicked = true;
        const path = c.dataset.path;
        if (path && !document.getElementById('counterName').value.trim()) document.getElementById('counterName').value = App.getIconName(path);
        syncCreateCfmChip();
        if (App.syncWsfuForm) App.syncWsfuForm('create');
      };
    });
    if (cfmEl) cfmEl.oninput = syncCreateIconToCfm;
    // WATER-PLAN rung 2: the Fixture units field, prefilled from the name for
    // the project's occupancy while the estimator has not typed in it.
    if (App.registerWsfuForm) {
      App.registerWsfuForm('create', { inputId: 'counterWsfu', chipId: 'counterWsfuChip', groupId: 'counterWsfuGroup', name: () => document.getElementById('counterName').value });
      App.resetWsfuForm('create');
      const nameEl = document.getElementById('counterName');
      if (nameEl) nameEl.oninput = () => App.syncWsfuForm('create');
    }
    syncCreateCfmChip();   // a fresh panel: CFM empty → chip hidden
    applyCounterAirMore('counterAirMoreToggle', 'counterAirMoreFields');
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

  // Field report (2026-09-01): the T2-05 name prefill ("Hose Bib", "Water
  // Cooler") read as the app naming counters at random — an estimator's names
  // are her own fixture codes. Keep the one-keystroke create but select the
  // prefilled text whenever the Create tab is surfaced, so the first
  // keystroke replaces it instead of appending.
  //
  // The focus is DEFERRED (rAF + macrotask) past the modal's open paint, and
  // that deferral is a race: under load it can fire AFTER the user (or a test
  // driver) has already moved on to another field — "Diffuser 400" typed in
  // the name, the caret placed in CFM — at which point the stolen focus +
  // select() sends the next keystrokes into the NAME box ("400" replaced the
  // name, CFM stayed empty; duct-balance.spec's "0 designed" under a parallel
  // suite, 2026-09-12). Same hazard for a fast human: type "Dif…" and have
  // select-all swallow it on the next key. So the deferred focus runs only
  // while it is still harmless: nothing else in the modal holds the caret and
  // the prefilled text is untouched.
  function focusCreateName() {
    const nameInput = document.getElementById('counterName');
    const seeded = nameInput.value;
    requestAnimationFrame(() => setTimeout(() => {
      if (!nameInput.offsetParent) return; // Create panel not visible
      const active = document.activeElement;
      const modal = document.getElementById('counterModal');
      if (active && active !== nameInput && modal && modal.contains(active)) return;   // the caret moved on
      if (nameInput.value !== seeded) return;   // typing already started — never select over it
      nameInput.focus();
      nameInput.select();
    }, 0));
  }
  document.getElementById('counterBtn').onclick = () => {
    const state = App.state;
    const modalSearchInput = document.getElementById('counterModalSearchInput');
    if (modalSearchInput) { modalSearchInput.value = ''; }
    prepCreatePanel();
    if (state.counters.length === 0) {
      // Fresh project: land on Create, prefilled — exactly like + Add.
      showCounterTab('create');
      focusCreateName();
    } else {
      showCounterTab('choose');
      populateCounterChooseList();
      requestAnimationFrame(() => { setTimeout(() => modalSearchInput?.focus(), 0); });
    }
    App.showModal('counterModal');
  };
  // counterBtn's right-click handler lives in features/tool-context-menu.js.
  document.querySelectorAll('#counterModal .counter-tab').forEach(t => t.onclick = () => {
    showCounterTab(t.dataset.tab);
    if (t.dataset.tab === 'create') focusCreateName();
  });
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
  // Hide-then-open (mirrors the retired Advanced opener) is load-bearing: the
  // Escape chain checks counterModal before manageIconsModal, so the two must
  // never be visible together.
  document.getElementById('counterManageIcons').onclick = () => { App.hideModal('counterModal'); App.openManageIconsModal(); };

  document.getElementById('addCounter').onclick = () => {
    showCounterTab('create');
    prepCreatePanel();
    App.showModal('counterModal');
    focusCreateName();
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
    // Field report (2026-09-01): an estimator typed her fixture code into this
    // search, got zero matches, and the grid silently vanished — "it hid the
    // ability to change the icon". Zero matches keeps the grid area with an
    // honest empty state instead.
    if (q && filtered.length === 0) {
      grid.innerHTML = '<p class="icon-grid-empty">No icons match &ldquo;' + App.escapeHtml(q) + '&rdquo; &mdash; clear the search to see every icon.</p>';
      return;
    }
    grid.innerHTML = App.iconGridCellsHtml(filtered, App.iconVbFor, (ic, i) => i === 0 && !hadCustomSelected);
    grid.querySelectorAll('.icon-cell').forEach(c => c.onclick = () => {
      grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      createIconPicked = true;
      const path = c.dataset.path;
      if (path && !document.getElementById('counterName').value.trim()) document.getElementById('counterName').value = App.getIconName(path);
      syncCreateCfmChip();
    });
  };
  document.getElementById('counterCancel').onclick = () => App.hideModal('counterModal');
  document.getElementById('counterCreate').onclick = () => {
    const state = App.state;
    const sel = document.querySelector('#counterIconGrid .icon-cell.selected') || document.querySelector('#counterIconGridCustom .icon-cell.selected');
    let icon = sel ? sel.dataset.path : App.getOrderedIcons()[0].value;
    // D6: optional CFM — set only when a positive number was entered, so a
    // non-air counter's shape is unchanged (and old exports stay byte-alike).
    const cfmVal = parseFloat(document.getElementById('counterCfm')?.value);
    const hasCfm = Number.isFinite(cfmVal) && cfmVal > 0;
    // D16: a CFM-carrying counter whose icon was never picked takes the HVAC
    // set's Supply Diffuser (the live sync above already moved the selection;
    // this is the guarantee). An explicit pick always wins.
    if (hasCfm && !createIconPicked && App.cfmDefaultIcon) icon = App.cfmDefaultIcon() || icon;
    // A blank name falls back to the selected icon's name — never the
    // literal string 'Counter' (repeat blanks used to collide under it).
    const rawName = document.getElementById('counterName').value.trim() || App.getIconName(icon);
    const rawColor = document.getElementById('counterColorRow').dataset.selectedColor || App.COLORS[2];
    const { name, color } = resolveCounterTwin(rawName, icon, rawColor, state.counters, App.COLORS);
    App.pushUndoSnapshot();
    const newCounter = { id: App.uid(), name, icon, color };
    if (hasCfm) newCounter.cfm = cfmVal;
    // WATER-PLAN rung 2: fixture units, set-only like the CFM; the counter's own
    // occupancy column rides only when it differs from the project's.
    if (App.applyWsfuFieldToCounter) App.applyWsfuFieldToCounter('create', newCounter);
    // S1: optional mount height (inches AFF) — same set-only rule; the Chain
    // tool reads it for the default vertical (S2).
    const mountIn = App.parseMountHeightIn(document.getElementById('counterMountHeight')?.value);
    if (mountIn != null) newCounter.mountHeightIn = mountIn;
    // D8: optional flex-drop length (ft) — same set-only-when-positive rule;
    // absent means the DUCT_FLEX_DEFAULTS.dropFt table default (5').
    const flexVal = parseFloat(document.getElementById('counterFlexDrop')?.value);
    if (Number.isFinite(flexVal) && flexVal > 0) newCounter.flexDropFt = flexVal;
    state.counters.push(newCounter);
    App.pushRecentColor(color);
    state.activeCounterType = newCounter.id;
    state.tool = App.TOOL.COUNTER;
    App.markProjectDirty();
    state.pagesListCollapsed = true;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
    App.hideModal('counterModal');
    // B9 (J1 J15): Create Counter hands the user the pen — close the mobile
    // drawer so the first tap lands on the plan, not a drawer button under it.
    App.closeMobileSidebar && App.closeMobileSidebar();
    App.updateUI();
  };

  App.showCounterTab = showCounterTab;
  App.syncCfmIconChip = syncCfmIconChip;         // D18: the Quick Count twin renders the same chip
  App.scrollIconGridToSet = scrollIconGridToSet; // D18: "change" lands on the HVAC group
  App.applyCounterAirMore = applyCounterAirMore; // D19: the Quick Count twin shares the disclosure
})();

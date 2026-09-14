/*
 * features/header-more.js - the header "⋯ More tools" group (desktop).
 *
 * Field feedback 2026-08-14: on desktop widths the tools row overflowed into
 * an invisible-scrollbar scroll, so the tail tools looked cut off — the group
 * first tucked behind ⋯ only when the row would overflow. Follow-up feedback
 * 2026-08-15: even with room to spare, the full row reads as clutter — so the
 * fixed low-frequency tool group (Polyline, Highlight, Multiply Zone,
 * Scale Zone, Room Sizer, Delete Area, Note, Legend, Grid — the tail of
 * the priority-reordered row) now lives behind #headerMoreBtn's dropdown
 * UNCONDITIONALLY at desktop widths (no overflow measure): each menu row
 * shows the tool's icon, full NAME, and hotkey (the icon-only toolbar
 * teaches nothing; the menu doubles as hotkey education). Rows click through
 * to the REAL buttons (all tool logic, active classes, and gating preserved)
 * and forward right-clicks so the tool-context-menu settings still open.
 * Rows whose source button is inline-hidden (viewer mode) are skipped; if
 * every row is hidden the ⋯ button hides too. D14 (2026-09-12): Duct gets a
 * menu row WITHOUT leaving the strip (see OVERFLOW_TOOLS' `strip` flag). The ⋯ button takes .active
 * (the shared gold treatment) whenever the active tool lives in the menu.
 * D18 (2026-09-13): the row's hotkey column is READ from `App.HOTKEYS` (the
 * hotkeys.js single source, by btnId) at build time — the rows carried their
 * own key literals until Duct's arrived blank (J19 #7); now a key exists on
 * this surface exactly when the keydown handler executes it.
 *
 * Sequencing with body.header-collapsed (features/burger-menu.js): this mode
 * engages FIRST (unconditional), then App.updateHeaderCollapsed() runs the
 * compact-mode measure against the reduced row, keeping compact as the
 * deeper fallback for very narrow desktop windows. Mobile (≤768px) is
 * untouched — the media-query consolidation owns that regime.
 *
 * app.js's updateUI calls App.onHeaderMoreSync (defensive core→feature
 * callback) so the ⋯ active state and open menu track tool changes.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // `tool: true` rows are drawing tools (their .active means "current tool"
  // and feeds the ⋯ gold indicator); Legend/Grid are overlay TOGGLES whose
  // .active means "overlay on" — shown on their rows, excluded from the
  // indicator (the legend defaults on; the ⋯ would otherwise always glow).
  // `strip: true` (D14, Will 2026-09-12 "keep the strip order"): the row is
  // ALSO a menu entry for a button that STAYS inline in the strip — Duct is
  // not in styles.css's body.header-more hide list, so its strip position is
  // unchanged; the row is the reachable path when the strip scrolls
  // (compact mode) and excluded from the ⋯ indicator (the inline button
  // already shows the gold). Row order mirrors the strip's DOM order. No
  // `key` field: the hotkey column comes from App.HOTKEYS (hotkeyFor).
  const OVERFLOW_TOOLS = [
    { id: 'polylineBtn', name: 'Polyline', tool: true },
    { id: 'ductBtn', name: 'Duct', tool: true },
    { id: 'highlightBtn', name: 'Highlight', tool: true },
    { id: 'multiplyZoneBtn', name: 'Multiply Zone', tool: true },
    { id: 'scaleZoneBtn', name: 'Scale Zone', tool: true },
    { id: 'roomBtn', name: 'Room Sizer', tool: true },
    { id: 'ghostBtn', name: 'Ghost / Stamp', tool: true },
    { id: 'deleteZoneBtn', name: 'Delete Area', tool: true },
    { id: 'noteBtn', name: 'Note', tool: true },
    { id: 'legendBtn', name: 'Legend' },
    { id: 'gridBtn', name: 'Grid' },
  ];
  // The row's hotkey, from the single source: the non-bespoke HOTKEYS entry
  // whose btnId is this button ('' when none — Scale Zone, Delete Area,
  // Legend, Grid have no key and render no <kbd>).
  function hotkeyFor(id) {
    const h = (App.HOTKEYS || []).find((x) => !x.bespoke && x.btnId === id);
    return h && h.key ? String(h.key).toUpperCase() : '';
  }

  // D21 (J5-D, Will's option (b) + Pin): WHICH drawing tools sit inline in the
  // strip and which live behind the ⋯ is seeded by the project's TRADE, then
  // overridden per tool by the estimator's pins.
  //
  // D14 kept the strip order fixed and put Duct inline for everyone; J5-D's
  // complaint was that a plumbing estimator then carries an HVAC tool in the
  // strip while Polyline — their daily tool — is two clicks away. The trade
  // profile decides the default instead: HVAC keeps D14's arrangement (Duct
  // inline, Polyline in ⋯), and every other trade takes the reverse.
  //
  // Only VISIBILITY is computed here — the DOM order of the strip is never
  // touched, so the strip cannot re-order on its own mid-session. The resolved
  // set is a function of (trade, pins) alone: nothing about the current tool,
  // the window size or a click feeds it.
  // The pin glyph, in currentColor like every other icon in the chrome (an emoji
  // would render in the platform's color font against a monochrome menu).
  const PIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true"><path fill="currentColor" d="M416 64H224a32 32 0 0 0 0 64h16v134.4L157.7 320H128a32 32 0 0 0 0 64h160v160a32 32 0 0 0 64 0V384h160a32 32 0 0 0 0-64h-29.7L400 262.4V128h16a32 32 0 0 0 0-64z"/></svg>';
  const BASE_OVERFLOW = ['polylineBtn', 'highlightBtn', 'multiplyZoneBtn', 'scaleZoneBtn', 'roomBtn', 'ghostBtn', 'deleteZoneBtn', 'noteBtn', 'legendBtn', 'gridBtn'];
  // The trade the project (or the device) has actually STATED — null when
  // nothing has been. Deliberately not App.getQuickTrade, whose final fallback
  // is 'plumbing': that fallback exists to pick a VOCABULARY for the Quick
  // creator, and reading it here would silently re-arrange the toolbar of every
  // project that has never named a trade — which is most of them, since
  // state.trade is explicit and null by default. Re-arranging the strip is an
  // opt-in, so an unstated project keeps D14's shipped arrangement exactly.
  function statedTrade() {
    const state = App.state;
    const TRADES = ['plumbing', 'electrical', 'hvac'];
    if (TRADES.includes(state && state.trade)) return state.trade;
    const d = App.getPlumbingModifiers ? App.getPlumbingModifiers().defaultTrade : null;
    return TRADES.includes(d) ? d : null;   // a device default IS a statement
  }
  function tradeOverflowDefaults() {
    const trade = statedTrade();
    // Nothing stated, or HVAC: D14's arrangement — Duct inline, Polyline
    // behind the ⋯.
    if (trade === null || trade === 'hvac') return BASE_OVERFLOW.slice();
    // Plumbing / electrical: the reverse. Polyline is their daily tool.
    return BASE_OVERFLOW.filter((id) => id !== 'polylineBtn').concat(['ductBtn']);
  }
  function stripPins() {
    const s = App.state && App.state.stripPins;
    return (s && typeof s === 'object') ? s : {};
  }
  // true = the tool lives behind the ⋯ right now.
  function isOverflowed(id) {
    const pins = stripPins();
    if (pins[id] === true) return false;    // pinned to the strip
    if (pins[id] === false) return true;    // explicitly unpinned
    return tradeOverflowDefaults().includes(id);
  }
  // Paint the resolved set onto the buttons. styles.css hides
  // `body.header-more .hm-overflowed`, so a tool moves between the strip and
  // the menu by class alone — no DOM move, no reflowable order.
  function applyOverflowClasses() {
    OVERFLOW_TOOLS.forEach((t) => {
      const el = sourceBtn(t.id);
      if (el) el.classList.toggle('hm-overflowed', isOverflowed(t.id));
    });
  }
  // The pin write. `next` true = pin to strip, false = send to the ⋯, null =
  // back to whatever the trade says. Per project (state.stripPins), mirrored to
  // localStorage so the device keeps the arrangement across a plain reload —
  // the same both-places rule the sidebar filter scope uses.
  function setStripPin(id, next) {
    const state = App.state;
    const pins = Object.assign({}, stripPins());
    if (next == null) delete pins[id]; else pins[id] = !!next;
    state.stripPins = pins;
    try { localStorage.setItem('stripPins', JSON.stringify(pins)); } catch (_) { /* private window */ }
    if (App.markProjectDirty && state.pages && state.pages.length) App.markProjectDirty();
    applyOverflowClasses();
    updateHeaderMore();
    if (menuOpen) buildMenuRows();
  }
  App.setStripPin = setStripPin;
  App.isToolOverflowed = isOverflowed;         // spec seam
  App.applyStripOverflow = applyOverflowClasses;

  let menuOpen = false;

  function moreBtn() { return document.getElementById('headerMoreBtn'); }
  function menuEl() { return document.getElementById('headerMoreMenu'); }
  function sourceBtn(id) { return document.getElementById(id); }
  // Viewer mode hides tool buttons via INLINE display:none (updateUI's
  // viewerHideIds loop); the more-mode hide is class-based — inline is the
  // signal that a row shouldn't render.
  function sourceHidden(id) { const el = sourceBtn(id); return !el || el.style.display === 'none'; }

  function anyOverflowedToolActive() {
    return OVERFLOW_TOOLS.some((t) => { if (!t.tool || !isOverflowed(t.id)) return false; const el = sourceBtn(t.id); return el && el.classList.contains('active'); });
  }

  function closeMenu() {
    menuOpen = false;
    const m = menuEl();
    if (m) m.style.display = 'none';
    const b = moreBtn();
    if (b) b.setAttribute('aria-expanded', 'false');
  }

  function buildMenuRows() {
    const m = menuEl();
    if (!m) return 0;
    m.innerHTML = '';
    let rows = 0;
    OVERFLOW_TOOLS.forEach((t) => {
      if (sourceHidden(t.id)) return;
      const src = sourceBtn(t.id);
      const row = document.createElement('div');
      row.className = 'hm-row' + (src.classList.contains('active') ? ' active' : '');
      row.dataset.toolId = t.id;
      const svg = src.querySelector('svg');
      const key = hotkeyFor(t.id);
      // D21 (J5-D): the per-tool pin. A tool already inline reads "Unpin"; one
      // behind the ⋯ reads "Pin to strip". The pin is the ONLY control that
      // moves a tool between the two places, so the arrangement never changes
      // by itself.
      const overflowed = isOverflowed(t.id);
      const pinTitle = overflowed ? 'Pin ' + t.name + ' to the toolbar' : 'Unpin ' + t.name + ', move it into this menu';
      row.innerHTML = '<span class="hm-icon">' + (svg ? svg.outerHTML : '') + '</span>'
        + '<span class="hm-name">' + t.name + '</span>'
        + '<button type="button" class="hm-pin' + (overflowed ? '' : ' pinned') + '" data-pin-id="' + t.id + '" title="' + pinTitle + '" aria-label="' + pinTitle + '">' + PIN_SVG + '</button>'
        + (key ? '<kbd class="hm-key">' + key + '</kbd>' : '');
      const pinBtn = row.querySelector('.hm-pin');
      if (pinBtn) pinBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();   // the row's own click arms the tool — the pin must not
        setStripPin(t.id, overflowed ? true : false);
      };
      row.onclick = () => { closeMenu(); src.click(); };
      // Right-click parity: forward to the source button so the shared
      // tool-context-menu settings open, positioned at the row.
      row.oncontextmenu = (e) => {
        e.preventDefault();
        closeMenu();
        src.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
      };
      m.appendChild(row);
      rows++;
    });
    return rows;
  }

  function openMenu() {
    const b = moreBtn(); const m = menuEl();
    if (!b || !m) return;
    if (!buildMenuRows()) return;
    const r = b.getBoundingClientRect();
    m.style.display = 'block';
    m.style.top = (r.bottom + 6) + 'px';
    // Right-align the panel to the button, clamped to the viewport.
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, window.innerWidth - m.offsetWidth - 8)) + 'px';
    b.setAttribute('aria-expanded', 'true');
    menuOpen = true;
  }

  // Desktop: the group ALWAYS lives behind the ⋯ — no overflow measure (the
  // 2026-08-15 clutter feedback made the mode unconditional above 768px).
  // Still ONE deterministic pipeline: engage header-more, then run the
  // compact-mode measure synchronously against the reduced row.
  function updateHeaderMore() {
    const b = moreBtn();
    if (!b) return;
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.remove('header-more');
      b.style.display = 'none';
      closeMenu();
      if (App.updateHeaderCollapsed) App.updateHeaderCollapsed();
      return;
    }
    document.body.classList.add('header-more');
    applyOverflowClasses();   // D21: the resolved strip/⋯ split, before the measure
    b.style.display = OVERFLOW_TOOLS.every((t) => sourceHidden(t.id)) ? 'none' : '';
    syncMoreState();
    if (App.updateHeaderCollapsed) App.updateHeaderCollapsed();
  }

  // Keeps the ⋯ button's gold .active tracking the tool, and live-refreshes
  // the open menu's rows (called from updateUI via the defensive hook).
  function syncMoreState() {
    const b = moreBtn();
    if (!b) return;
    // D21: re-resolve the strip/⋯ split on every sync — a loaded project's
    // pins and trade arrive through hydrate + updateUI, never a resize.
    if (document.body.classList.contains('header-more')) applyOverflowClasses();
    b.classList.toggle('active', document.body.classList.contains('header-more') && anyOverflowedToolActive());
    if (menuOpen) buildMenuRows();
  }

  let moreRaf = 0;
  function scheduleHeaderMoreCheck() {
    if (moreRaf) return;
    moreRaf = requestAnimationFrame(() => { moreRaf = 0; updateHeaderMore(); });
  }
  window.addEventListener('resize', scheduleHeaderMoreCheck);
  scheduleHeaderMoreCheck();

  const btn = moreBtn();
  if (btn) btn.onclick = () => { if (menuOpen) closeMenu(); else openMenu(); };
  document.addEventListener('pointerdown', (e) => {
    if (!menuOpen) return;
    const m = menuEl(); const b = moreBtn();
    if (m && !m.contains(e.target) && b && !b.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) closeMenu(); });

  App.updateHeaderMore = updateHeaderMore;   // D21: a trade change re-resolves the strip
  App.onHeaderMoreSync = syncMoreState;
  App.scheduleHeaderMoreCheck = scheduleHeaderMoreCheck;
})();

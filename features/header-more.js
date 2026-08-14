/*
 * features/header-more.js - the header "⋯ More tools" overflow (desktop).
 *
 * Field feedback 2026-08-14: on desktop widths the tools row overflowed into
 * an invisible-scrollbar scroll (`.header-tools-scroll`), so the tail tools
 * looked cut off. Now, when the row would overflow at desktop widths, the
 * fixed low-frequency tool group (Polyline, Highlight, Multiply Zone,
 * Scale Zone, Room Sizer, Delete Area, Note, Legend, Grid — the tail of
 * the priority-reordered row)
 * tucks behind #headerMoreBtn's dropdown: each menu row shows the tool's
 * icon, full NAME, and hotkey (the icon-only toolbar teaches nothing; the
 * menu doubles as hotkey education). Rows click through to the REAL buttons
 * (all tool logic, active classes, and gating preserved) and forward
 * right-clicks so the tool-context-menu settings still open. Rows whose
 * source button is inline-hidden (viewer mode) are skipped; if every row is
 * hidden the ⋯ button hides too. The ⋯ button takes .active (the shared
 * gold treatment) whenever the active tool lives in the menu.
 *
 * Sequencing with body.header-collapsed (features/burger-menu.js): this mode
 * engages FIRST — measured in the expanded state (class removed) so the
 * decision never oscillates, then App.scheduleHeaderCollapseCheck() re-runs
 * the compact-mode measure against the reduced row, keeping compact as the
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
  const OVERFLOW_TOOLS = [
    { id: 'polylineBtn', name: 'Polyline', key: 'P', tool: true },
    { id: 'highlightBtn', name: 'Highlight', key: 'H', tool: true },
    { id: 'multiplyZoneBtn', name: 'Multiply Zone', key: 'X', tool: true },
    { id: 'scaleZoneBtn', name: 'Scale Zone', key: '', tool: true },
    { id: 'roomBtn', name: 'Room Sizer', key: 'V', tool: true },
    { id: 'deleteZoneBtn', name: 'Delete Area', key: '', tool: true },
    { id: 'noteBtn', name: 'Note', key: 'N', tool: true },
    { id: 'legendBtn', name: 'Legend', key: '' },
    { id: 'gridBtn', name: 'Grid', key: '' },
  ];

  let menuOpen = false;

  function moreBtn() { return document.getElementById('headerMoreBtn'); }
  function menuEl() { return document.getElementById('headerMoreMenu'); }
  function sourceBtn(id) { return document.getElementById(id); }
  // Viewer mode hides tool buttons via INLINE display:none (updateUI's
  // viewerHideIds loop); the more-mode hide is class-based — inline is the
  // signal that a row shouldn't render.
  function sourceHidden(id) { const el = sourceBtn(id); return !el || el.style.display === 'none'; }

  function anyOverflowedToolActive() {
    return OVERFLOW_TOOLS.some((t) => { if (!t.tool) return false; const el = sourceBtn(t.id); return el && el.classList.contains('active'); });
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
      row.innerHTML = '<span class="hm-icon">' + (svg ? svg.outerHTML : '') + '</span>'
        + '<span class="hm-name">' + t.name + '</span>'
        + (t.key ? '<kbd class="hm-key">' + t.key + '</kbd>' : '');
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

  // Desktop-only overflow check, measured in the EXPANDED state (class off)
  // so the verdict can't oscillate — the same recipe as updateHeaderCollapsed.
  function updateHeaderMore() {
    const header = document.querySelector('.header');
    const b = moreBtn();
    if (!header || !b) return;
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.remove('header-more');
      b.style.display = 'none';
      closeMenu();
      if (App.updateHeaderCollapsed) App.updateHeaderCollapsed();
      return;
    }
    // ONE deterministic pipeline (this function owns every resize): measure
    // the tools row with BOTH overflow modes stripped, decide header-more,
    // then run the compact-mode measure synchronously against the result —
    // two independent measurers previously raced, and which mode won
    // depended on the width the window arrived FROM.
    document.body.classList.remove('header-more');
    document.body.classList.remove('header-collapsed');
    b.style.display = 'none';
    // Same measurement updateHeaderCollapsed uses: the HEADER is the fixed-
    // width element that overflows (.header-tools-scroll is content-sized
    // outside compact mode and never reports overflow).
    const overflowing = header.scrollWidth > header.clientWidth + 1;
    if (overflowing) {
      document.body.classList.add('header-more');
      b.style.display = OVERFLOW_TOOLS.every((t) => sourceHidden(t.id)) ? 'none' : '';
    } else {
      closeMenu();
    }
    syncMoreState();
    if (App.updateHeaderCollapsed) App.updateHeaderCollapsed();
  }

  // Keeps the ⋯ button's gold .active tracking the tool, and live-refreshes
  // the open menu's rows (called from updateUI via the defensive hook).
  function syncMoreState() {
    const b = moreBtn();
    if (!b) return;
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

  App.onHeaderMoreSync = syncMoreState;
  App.scheduleHeaderMoreCheck = scheduleHeaderMoreCheck;
})();

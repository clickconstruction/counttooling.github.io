/*
 * features/burger-menu.js - the mobile right-side burger drawer + the desktop
 * header-overflow compact mode, extracted from the app.js IIFE as the
 * thirtieth feature-file split under the window.App registry pattern. The two
 * move together because they are one consolidation feature: on mobile the
 * media query folds the header's PDF actions into the drawer, on desktop
 * `updateHeaderCollapsed()` toggles `body.header-collapsed` when the header
 * overflows (measured in the EXPANDED state so the decision never
 * oscillates), and both funnel through the same `closeBurgerMenu()`.
 *
 * Loaded as a classic <script src="/features/burger-menu.js"> AFTER app.js.
 * Its own IIFE: it reaches `state` + `SUPABASE_ENABLED` through the shared
 * window.App registry, binds the `#headerBurger` / `#rightMenuBackdrop`
 * handlers + the window resize listener at load (and runs the initial
 * overflow check), and registers the two hooks `updateUI` calls at its tail:
 * App.updateBurgerMenu (rebuild the drawer rows from the currently-visible
 * `.download-page-option` / `.export-dropdown-option` buttons, whose
 * visibility updateUI just computed) and App.scheduleHeaderCollapseCheck
 * (rAF-throttled overflow re-measure). updateUI invokes both defensively
 * (`App.fn && App.fn()`), so a boot-time updateUI before this file loads is
 * a harmless no-op — the load-time initial check + the on-open rebuild cover
 * it. Each drawer row dispatches the click of its (CSS-hidden) source
 * control and clones its <svg>, so desktop behavior is reused wholesale.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function closeBurgerMenu() {
    document.body.classList.remove('right-menu-open');
    const b = document.getElementById('headerBurger');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  function updateBurgerMenu() {
    const state = App.state;
    const list = document.getElementById('rightMenuList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.pages.length) return;
    // Clone the matching header control's <svg> so each drawer row shows the same
    // icon as its source (pixel-match, no duplicated icon data). Strips id/size so
    // CSS (.right-menu-icon) controls dimensions.
    const iconClone = (el) => {
      if (!el) return null;
      const svg = (el.tagName && el.tagName.toLowerCase() === 'svg') ? el : el.querySelector('svg');
      if (!svg) return null;
      const c = svg.cloneNode(true);
      c.removeAttribute('id');
      c.removeAttribute('width');
      c.removeAttribute('height');
      c.style.display = '';
      c.setAttribute('aria-hidden', 'true');
      c.classList.add('right-menu-icon');
      return c;
    };
    const rows = [];
    const addSection = (label) => rows.push({ section: label });
    const addItem = (label, click, iconSrc) => rows.push({ label, click, iconSrc });
    // 1. Show / Hide marks (mirrors #hideMarksBtn + its current eye/eye-slash icon)
    addItem(
      state.hideMarks ? 'Show marks' : 'Hide marks',
      () => document.getElementById('hideMarksBtn')?.click(),
      document.getElementById(state.hideMarks ? 'hideMarksIconHide' : 'hideMarksIconShow')
    );
    // 2. Share — editor opens the Share modal (#sidebarLogoShare); a signed-in
    //    view-link viewer copies the link (#headerShareBtn). Same gating as updateUI.
    const baseShare = App.SUPABASE_ENABLED && state.currentProjectId && state.supabaseSession?.user;
    const shareIcon = document.getElementById('headerShareBtn');
    if (baseShare && !state.loadedViaViewLink) {
      addItem('Share', () => document.getElementById('sidebarLogoShare')?.click(), shareIcon);
    } else if (baseShare && state.isViewer) {
      addItem('Share', () => document.getElementById('headerShareBtn')?.click(), shareIcon);
    }
    // 3. Download — one row per currently-visible download option (visibility set by updateUI)
    const dlOpts = Array.from(document.querySelectorAll('.download-page-option')).filter(o => o.style.display !== 'none');
    if (dlOpts.length) {
      addSection('Download');
      const dlIcon = document.getElementById('downloadCurrentPageBtn');
      dlOpts.forEach(o => addItem(o.textContent, () => o.click(), dlIcon));
    }
    // 4. Export — one row per currently-visible export option (only if the section is shown)
    const exportDropdown = document.getElementById('exportDropdown');
    const exOpts = Array.from(document.querySelectorAll('.export-dropdown-option')).filter(o => o.style.display !== 'none');
    if (exportDropdown && exportDropdown.style.display !== 'none' && exOpts.length) {
      addSection('Export');
      const exIcon = document.getElementById('exportDropdownIconExport');
      exOpts.forEach(o => addItem(o.textContent, () => o.click(), exIcon));
    }
    rows.forEach(r => {
      if (r.section) {
        const s = document.createElement('div');
        s.className = 'right-menu-section';
        s.textContent = r.section;
        list.appendChild(s);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'right-menu-item';
        const icon = iconClone(r.iconSrc);
        if (icon) btn.appendChild(icon);
        const label = document.createElement('span');
        label.className = 'right-menu-label';
        // Put a trailing "(qualifier)" on its own line in the drawer (the label uses
        // white-space:pre-line). Desktop menus keep the single-line source text.
        label.textContent = r.label.replace(' (', '\n(');
        btn.appendChild(label);
        btn.onclick = () => { r.click(); closeBurgerMenu(); };
        list.appendChild(btn);
      }
    });
  }
  const headerBurgerEl = document.getElementById('headerBurger');
  if (headerBurgerEl) {
    headerBurgerEl.onclick = () => {
      const open = document.body.classList.toggle('right-menu-open');
      headerBurgerEl.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) updateBurgerMenu();
    };
  }
  const rightMenuBackdropEl = document.getElementById('rightMenuBackdrop');
  if (rightMenuBackdropEl) rightMenuBackdropEl.onclick = () => closeBurgerMenu();
  // Desktop header overflow → compact mode. On desktop only (mobile already
  // consolidates via media query), if the header row is wider than the viewport,
  // add body.header-collapsed so the left tools scroll and the right PDF actions
  // collapse into the burger drawer. Measured in the EXPANDED state (class removed
  // first) so the decision is stable and never oscillates.
  function updateHeaderCollapsed() {
    const header = document.querySelector('.header');
    if (!header) return;
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.remove('header-collapsed');
      return;
    }
    document.body.classList.remove('header-collapsed');
    const overflowing = header.scrollWidth > header.clientWidth + 1;
    if (overflowing) document.body.classList.add('header-collapsed');
    else closeBurgerMenu();
  }
  let headerCollapseRaf = 0;
  function scheduleHeaderCollapseCheck() {
    if (headerCollapseRaf) return;
    headerCollapseRaf = requestAnimationFrame(() => { headerCollapseRaf = 0; updateHeaderCollapsed(); });
  }
  window.addEventListener('resize', scheduleHeaderCollapseCheck);
  scheduleHeaderCollapseCheck();

  App.updateBurgerMenu = updateBurgerMenu;
  App.scheduleHeaderCollapseCheck = scheduleHeaderCollapseCheck;
})();

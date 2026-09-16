/*
 * features/bid-chip.js - the header bid switcher's chip (BID-SWITCHER.md, stage 2).
 *
 * Reported by an estimator 2026-09-15: the only desktop door to Load Project
 * was a small link in the Project Settings footer, while the top bar carried
 * two controls that both uploaded a PDF. The chip is the door, and it also
 * answers a question the header could not answer at all: WHICH bid is this?
 * state.currentProjectName was rendered in exactly one place before this, the
 * settings modal's subtitle.
 *
 * The wordmark yields its slot once a bid is open (Will, 2026-09-16). Nothing
 * open, there is room and no bid to name, so the wordmark stays and the chip
 * reads "No bid open".
 *
 * On the width budget, which the first pass got wrong: measuring "intrinsic
 * width" by forcing .header-tools-scroll to flex:0 0 auto and zeroing the
 * .spacer removed the slack the real layout runs on, and reported a 139px chip
 * cost and a 1391px header that do not exist. Re-measured against the live
 * layout in a realistic signed-in state, comparing WITH the chip against
 * WITHOUT it rather than against an absolute, the chip is free at 1280px and
 * up once the wordmark is out of the way; the caps in styles.css cover the
 * narrower bands.
 *
 * #headerLogo was ALSO the only visible desktop sidebar toggle (its click; the
 * spacebar in app.js's keydown is the invisible other half), so whenever the
 * chip takes its slot, #headerSidebarToggle appears in its place: the same job
 * in a narrow icon. Exactly one of the two is ever shown. It deliberately does
 * NOT live in the status bar -- that bar's width is pinned by
 * footer-hint.spec.js (one line at 1050px) and duct-b19b.spec.js Friction #5
 * (the save stamp's words are spent before the tool hint), and a link there
 * broke both.
 *
 * Gating: SUPABASE_ENABLED (the chip is a CLOUD bid switcher; the
 * .supabase-only class handles the disabled case) and never for a view-link
 * recipient, who has no bids of their own to switch between and cannot open
 * the ones the menu would list.
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  function chipEls() {
    return {
      chip: document.getElementById('headerBidChip'),
      name: document.getElementById('headerBidChipName'),
      divider: document.getElementById('headerBidChipDivider'),
      logo: document.getElementById('headerLogo'),
      sidebarToggle: document.getElementById('headerSidebarToggle'),
    };
  }

  // Rendered from updateUI, which runs constantly, so this stays cheap: plain
  // property writes every time (see the memo note below for why they cannot be
  // skipped) and the header re-measure only when something actually changed.
  let lastRendered = '';
  function renderBidChip() {
    const { chip, name, divider, logo, sidebarToggle } = chipEls();
    if (!chip || !name) return;
    const state = App.state;
    const enabled = !!App.SUPABASE_ENABLED;
    // A view-link session is a window onto someone else's bid, not a workbench.
    const show = enabled && !state.loadedViaViewLink;
    const hasBid = !!state.currentProjectId;
    // Once a plan is on screen, uploadPdf and both primary dividers hide
    // (app.js updateUI); the wordmark joins them, handing the chip its slot,
    // and the chip brings its own divider to stay clear of the tool strip.
    //
    // But ONLY where the chip is actually rendered. styles.css hides it below
    // 1240px, where no chip wide enough to name a bid fits once the sidebar-toggle
    // icon that replaces the wordmark is counted, and yielding the
    // wordmark there would empty the slot instead of handing it over: that
    // band would lose the branding AND the sidebar toggle and gain nothing.
    // matchMedia rather than a computed-style read, which updateUI would pay
    // for as a forced reflow on every call. Keep in step with styles.css.
    const chipFits = window.matchMedia('(min-width: 1240px)').matches;
    const hasPlan = show && !!(state.pages.length || state.isViewer);
    const logoYields = hasPlan && chipFits;

    const label = hasBid ? (state.currentProjectName || 'Untitled') : 'No bid open';
    const key = JSON.stringify([show, hasBid, label, hasPlan, logoYields]);
    // The visibility writes are NOT memoized: updateUI's `.supabase-only` pass
    // resets every such element to display:'' on each run, so an early return
    // here would resurrect a chip we had hidden (a view-link session). Only the
    // collapse re-measure, the one costly call, is gated on an actual change.
    const changed = key !== lastRendered;
    lastRendered = key;

    chip.style.display = show ? '' : 'none';
    if (divider) divider.style.display = hasPlan ? '' : 'none';
    if (logo) logo.style.display = logoYields ? 'none' : '';
    // Exactly one of the wordmark and the icon carries the sidebar toggle.
    if (sidebarToggle) sidebarToggle.style.display = logoYields ? '' : 'none';
    name.textContent = label;
    chip.classList.toggle('is-empty', !hasBid);
    chip.title = hasBid ? label : 'Open one of your bids';
    chip.setAttribute('aria-label', hasBid ? 'Current bid: ' + label + '. Switch bids' : 'Open a bid');

    // A chip whose width just changed moves the header's overflow point, so the
    // compact/burger measure has to re-run (features/burger-menu.js).
    if (changed && App.scheduleHeaderCollapseCheck) App.scheduleHeaderCollapseCheck();
  }


  // --- the menu -------------------------------------------------------------
  // Mirrors features/header-more.js's idiom (fixed panel, display toggle,
  // pointerdown-away + Escape) rather than inventing a third menu in one header.
  let menuOpen = false;
  function menuEl() { return document.getElementById('headerBidMenu'); }

  function closeBidMenu() {
    menuOpen = false;
    const m = menuEl();
    if (m) m.style.display = 'none';
    const { chip } = chipEls();
    if (chip) chip.setAttribute('aria-expanded', 'false');
  }

  function row(cls, label, when) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bm-row' + (cls ? ' ' + cls : '');
    b.setAttribute('role', 'menuitem');
    const n = document.createElement('span');
    n.className = 'bm-name';
    n.textContent = label;
    b.appendChild(n);
    if (when) {
      const w = document.createElement('span');
      w.className = 'bm-when';
      w.textContent = when;
      b.appendChild(w);
    }
    return b;
  }

  function buildBidMenu() {
    const m = menuEl();
    if (!m) return;
    const state = App.state;
    m.innerHTML = '';
    const now = Date.now();
    const recents = (App.getRecentBids ? App.getRecentBids() : []) || [];
    // The bid you are already in is listed but inert: it answers "which one is
    // this" without offering a reload that would only cost a save prompt.
    const others = recents.filter(b => b.id !== state.currentProjectId);
    const current = recents.find(b => b.id === state.currentProjectId);

    if (current) {
      const head = document.createElement('div');
      head.className = 'bm-head';
      head.textContent = 'This bid';
      m.appendChild(head);
      const r = row('is-current', current.name || 'Untitled', 'open now');
      r.disabled = true;
      m.appendChild(r);
    }
    if (others.length) {
      const head = document.createElement('div');
      head.className = 'bm-head';
      head.textContent = 'Recent bids';
      m.appendChild(head);
      others.forEach((b) => {
        const r = row('bm-recent', b.name || 'Untitled', App.formatBidAge ? App.formatBidAge(b.at, now) : '');
        r.title = b.name || 'Untitled';
        r.onclick = () => { closeBidMenu(); openRecentBid(b); };
        m.appendChild(r);
      });
    }
    // No empty-state copy: with no recents the two actions ARE the menu.
    if (current || others.length) {
      const sep = document.createElement('div');
      sep.className = 'bm-sep';
      m.appendChild(sep);
    }
    const all = row('bm-action', 'All my bids…');
    all.onclick = () => { closeBidMenu(); if (App.openLoadProjectModalOrPromptSave) App.openLoadProjectModalOrPromptSave(); };
    m.appendChild(all);
    const upload = row('', 'Upload a new plan');
    upload.onclick = () => { closeBidMenu(); const i = document.getElementById('pdfInput'); if (i) i.click(); };
    m.appendChild(upload);
  }

  // Clicking a recent opens that bid. It goes through the SAME save gate the
  // full list uses (features/copy-project.js), which now carries the target
  // through rather than dropping the estimator on the list.
  function openRecentBid(bid) {
    if (App.loadRecentBidOrPromptSave) App.loadRecentBidOrPromptSave(bid);
    else if (App.openLoadProjectModalOrPromptSave) App.openLoadProjectModalOrPromptSave();
  }

  // The load itself, once the gate is satisfied. The menu is free because it
  // reads the local store, but the OPEN pays what the Load Project modal pays
  // today for the same action: one list_accessible_projects call, whose row is
  // then handed to the shared host-agnostic loader (features/load-project.js,
  // already shared with features/bid-board.js). Fetching fresh matters: the
  // checkout columns the loader hydrates from change server-side.
  let loading = false;
  async function loadRecentBidNow(bid) {
    if (loading || !bid || !bid.id) return;
    const { chip, name } = chipEls();
    const supabase = App.getSupabase && App.getSupabase();
    if (!supabase) { App.showToast('Cloud is not configured.', 4000); return; }
    loading = true;
    const restore = name ? name.textContent : '';
    if (chip) chip.disabled = true;
    if (name) name.textContent = 'Opening…';
    try {
      const { data: projects, error } = await supabase.rpc('list_accessible_projects');
      if (error) throw error;
      const proj = (projects || []).find(p => p.id === bid.id);
      if (!proj) {
        // Deleted, or access revoked while it sat in this device's list. Drop
        // it and hand the estimator the real list rather than a dead row.
        if (App.forgetRecentBid) App.forgetRecentBid(bid.id);
        App.showToast('That bid is no longer available.', 4000);
        if (App.openLoadProjectModal) App.openLoadProjectModal();
        return;
      }
      await App.loadCloudProjectRow(proj, {
        hostModalId: null,
        showError: function () { App.showToast('Could not open that bid.', 4000); },
      });
    } catch (e) {
      console.error('[Bid chip] open recent', e);
      App.showToast('Could not open that bid: ' + (e?.message || 'unknown error'), 4000);
    } finally {
      loading = false;
      if (chip) chip.disabled = false;
      if (name && name.textContent === 'Opening…') name.textContent = restore;
      if (App.updateUI) App.updateUI();
    }
  }

  function openBidMenu() {
    const { chip } = chipEls();
    const m = menuEl();
    if (!chip || !m) return;
    buildBidMenu();
    m.style.display = 'block';
    const r = chip.getBoundingClientRect();
    m.style.top = (r.bottom + 6) + 'px';
    // Left-aligned to the chip, clamped to the viewport.
    m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 8)) + 'px';
    chip.setAttribute('aria-expanded', 'true');
    menuOpen = true;
  }

  function toggleBidMenu() {
    if (menuOpen) closeBidMenu();
    else openBidMenu();
  }

  function wireBidChip() {
    const { chip } = chipEls();
    if (chip) {
      chip.onclick = function (e) {
        e.stopPropagation();
        toggleBidMenu();
      };
    }
    const sidebarToggle = document.getElementById('headerSidebarToggle');
    if (sidebarToggle) {
      // Same behavior as #headerLogo's click, which this stands in for.
      sidebarToggle.onclick = function () {
        if (window.matchMedia('(min-width: 769px)').matches) {
          document.body.classList.toggle('sidebar-collapsed');
        }
      };
    }
  }
  wireBidChip();

  document.addEventListener('pointerdown', (e) => {
    if (!menuOpen) return;
    const m = menuEl();
    const { chip } = chipEls();
    if (m && !m.contains(e.target) && chip && !chip.contains(e.target)) closeBidMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) closeBidMenu(); });

  App.renderBidChip = renderBidChip;
  App.toggleBidMenu = toggleBidMenu;
  App.closeBidMenu = closeBidMenu;
  App.loadRecentBidNow = loadRecentBidNow;
})();

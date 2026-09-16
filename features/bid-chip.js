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
 * spacebar in app.js's keydown is the invisible other half), so hiding it hands
 * that job to #statusBarSidebar, beside quick keys and shortcuts, where this
 * class of view control already lives. Without it a collapsed sidebar would be
 * unrecoverable for anyone who does not know the key.
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
    };
  }

  // Rendered from updateUI, which runs constantly, so this stays cheap: plain
  // property writes every time (see the memo note below for why they cannot be
  // skipped) and the header re-measure only when something actually changed.
  let lastRendered = '';
  function renderBidChip() {
    const { chip, name, divider, logo } = chipEls();
    if (!chip || !name) return;
    const state = App.state;
    const enabled = !!App.SUPABASE_ENABLED;
    // A view-link session is a window onto someone else's bid, not a workbench.
    const show = enabled && !state.loadedViaViewLink;
    const hasBid = !!state.currentProjectId;
    // Once a plan is on screen, uploadPdf and both primary dividers hide
    // (app.js updateUI); the wordmark joins them, handing the chip its slot,
    // and the chip brings its own divider to stay clear of the tool strip.
    const hasPlan = show && !!(state.pages.length || state.isViewer);

    const label = hasBid ? (state.currentProjectName || 'Untitled') : 'No bid open';
    const key = JSON.stringify([show, hasBid, label, hasPlan]);
    // The visibility writes are NOT memoized: updateUI's `.supabase-only` pass
    // resets every such element to display:'' on each run, so an early return
    // here would resurrect a chip we had hidden (a view-link session). Only the
    // collapse re-measure, the one costly call, is gated on an actual change.
    const changed = key !== lastRendered;
    lastRendered = key;

    chip.style.display = show ? '' : 'none';
    if (divider) divider.style.display = hasPlan ? '' : 'none';
    if (logo) logo.style.display = hasPlan ? 'none' : '';
    name.textContent = label;
    chip.classList.toggle('is-empty', !hasBid);
    chip.title = hasBid ? label : 'Open one of your bids';
    chip.setAttribute('aria-label', hasBid ? 'Current bid: ' + label + '. Switch bids' : 'Open a bid');

    // A chip whose width just changed moves the header's overflow point, so the
    // compact/burger measure has to re-run (features/burger-menu.js).
    if (changed && App.scheduleHeaderCollapseCheck) App.scheduleHeaderCollapseCheck();
  }

  function wireBidChip() {
    const { chip } = chipEls();
    if (chip) {
      chip.onclick = function (e) {
        e.stopPropagation();
        // Deferred binding: stage 3 registers the menu. Until it does, the chip
        // still opens the full list, so this stage is useful if it ships alone.
        if (App.toggleBidMenu) App.toggleBidMenu();
        else if (App.openLoadProjectModalOrPromptSave) App.openLoadProjectModalOrPromptSave();
      };
    }
    const sidebarLink = document.getElementById('statusBarSidebar');
    if (sidebarLink) {
      sidebarLink.onclick = function () {
        if (window.matchMedia('(min-width: 769px)').matches) {
          document.body.classList.toggle('sidebar-collapsed');
        }
      };
    }
  }
  wireBidChip();

  App.renderBidChip = renderBidChip;
})();

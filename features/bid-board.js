(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Bid Board -- the overseer's "see every bid" surface (#bidBoardModal). An
  // overseer (profiles.is_overseer) gets every project from
  // list_accessible_projects with my_access_role 'viewer'; this board renders
  // them as large presentation-friendly cards (name, estimator, counts, last
  // edited) with a search box and an estimator filter. Clicking a card funnels
  // into the same load path as the Load Project modal
  // (App.loadCloudProjectRow, extracted from features/load-project.js), so a
  // bid always opens in the existing read-only viewer mode -- the overseer has
  // no checkout arm server-side. Admins can open the board too (same button);
  // it auto-opens only for pure overseers signing in with nothing else to
  // restore. Cross-file deps read from App at call time: getSupabase,
  // showModal, hideModal, escapeHtml, loadCloudProjectRow, showToast.

  let autoOpenDone = false;
  let boardRows = [];
  let loadInProgress = false;

  // Test-harness accounts whose spec-run projects would otherwise clutter the
  // board (a daily cron purges them after 7 days, but fresh runs appear every
  // day). Mirrors the TEST_ACCOUNTS list in
  // supabase/functions/cleanup-test-accounts/index.ts.
  const HIDDEN_TEST_OWNERS = ['dev-agent@clickplumbing.com', 'test@clickplumbing.com'];

  function esc(s) { return App.escapeHtml(s); }

  // "who made it" display: strip the domain so cards read as names, with the
  // full email on the title attribute.
  function ownerLabel(email) {
    if (!email) return 'Unknown';
    const at = email.indexOf('@');
    return at > 0 ? email.slice(0, at) : email;
  }

  // Relative age for the card date ("today" / "yesterday" / "12 days ago") —
  // calendar-day based, not 24h-based, so a bid edited last night says
  // "yesterday" even if fewer than 24 hours have passed.
  function daysAgoLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 864e5);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    return days + ' days ago';
  }

  function reviewBadgeHtml(proj) {
    if (proj.review_status === 'ready') {
      const since = proj.review_requested_at ? ' title="Ready since ' + esc(new Date(proj.review_requested_at).toLocaleDateString()) + '"' : '';
      return '<span class="bid-card-badge bid-card-badge-ready"' + since + '>Ready for review</span>';
    }
    if (proj.review_status === 'reviewed') {
      const when = proj.reviewed_at ? ' title="Reviewed ' + esc(new Date(proj.reviewed_at).toLocaleDateString()) + '"' : '';
      return '<span class="bid-card-badge bid-card-badge-reviewed"' + when + '>Reviewed ✓</span>';
    }
    return '';
  }

  function bidCardHtml(proj) {
    let date = proj.updated_at ? new Date(proj.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const ago = daysAgoLabel(proj.updated_at);
    if (date && ago) date += ' · ' + ago;
    const counts = [
      proj.counter_count > 0 ? (proj.counter_count + ' counts') : null,
      proj.line_count > 0 ? (proj.line_count + ' lines') : null,
    ].filter(Boolean).join(' · ');
    // Cloud completeness: a bid with its PDF in storage is fully in the cloud
    // (canvas markups always ride in the project row); without it, only the
    // canvas is backed up and the plan itself lives on the estimator's device.
    const cloudBadge = proj.pdf_path
      ? '<span class="bid-card-badge bid-card-badge-cloud" title="Canvas and PDF are both in the cloud">✓ Fully cloud</span>'
      : '<span class="bid-card-badge bid-card-badge-warn" title="Only the canvas markups are in the cloud — the PDF was never uploaded">Canvas only</span>';
    const canMarkReviewed = proj.review_status === 'ready' && (App.state.isOverseer || App.state.isAdmin);
    return '<div class="bid-card" role="button" tabindex="0" data-project-id="' + esc(proj.id) + '">' +
      '<div class="bid-card-name">' + esc(proj.name || 'Untitled') + '</div>' +
      '<div class="bid-card-owner" title="' + esc(proj.owner_email || '') + '">' + esc(ownerLabel(proj.owner_email)) + '</div>' +
      '<div class="bid-card-meta">' +
        reviewBadgeHtml(proj) +
        (counts ? '<span class="bid-card-badge">' + esc(counts) + '</span>' : '') +
        cloudBadge +
        (date ? '<span class="bid-card-date">' + esc(date) + '</span>' : '') +
      '</div>' +
      (canMarkReviewed ? '<button type="button" class="bid-card-review-btn">Mark reviewed</button>' : '') +
      '<div class="bid-card-status">Loading…</div>' +
      '</div>';
  }

  function getFilteredBidRows() {
    const searchEl = document.getElementById('bidBoardSearch');
    const ownerEl = document.getElementById('bidBoardOwnerFilter');
    let rows = boardRows.slice();
    const q = searchEl && searchEl.value ? searchEl.value.trim().toLowerCase() : '';
    if (q) rows = rows.filter(function (p) { return (p.name || 'Untitled').toLowerCase().indexOf(q) !== -1; });
    if (ownerEl && ownerEl.value) rows = rows.filter(function (p) { return (p.owner_email || '') === ownerEl.value; });
    return rows;
  }

  function renderBidBoardList() {
    const listEl = document.getElementById('bidBoardList');
    if (!listEl) return;
    const rows = getFilteredBidRows();
    if (!rows.length) {
      listEl.innerHTML = '<p class="bid-board-empty">' + (boardRows.length ? 'No bids match.' : 'No bids yet.') + '</p>';
      return;
    }
    // "Ready for review" bids get their own lane pinned above the rest — the
    // estimator's handoff signal is the first thing an overseer sees.
    const ready = rows.filter(function (p) { return p.review_status === 'ready'; });
    const rest = rows.filter(function (p) { return p.review_status !== 'ready'; });
    listEl.innerHTML = ready.length
      ? '<div class="bid-board-lane-title">Ready for review (' + ready.length + ')</div>' +
        ready.map(bidCardHtml).join('') +
        (rest.length ? '<div class="bid-board-lane-title">All bids</div>' + rest.map(bidCardHtml).join('') : '')
      : rows.map(bidCardHtml).join('');
    listEl.querySelectorAll('.bid-card').forEach(function (card) {
      const proj = boardRows.find(function (p) { return p.id === card.dataset.projectId; });
      if (!proj) return;
      const open = async function () {
        if (loadInProgress) return;
        loadInProgress = true;
        card.classList.add('loading');
        listEl.classList.add('loading');
        try {
          await App.loadCloudProjectRow(proj, {
            hostModalId: 'bidBoardModal',
            showError: function (html) {
              const errEl = document.getElementById('bidBoardError');
              if (errEl) { errEl.innerHTML = html; errEl.style.display = 'block'; }
            },
          });
        } catch (e) {
          App.showToast((e && e.message) || 'Failed to open bid.', 4000);
        } finally {
          loadInProgress = false;
          card.classList.remove('loading');
          listEl.classList.remove('loading');
        }
      };
      card.onclick = open;
      card.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void open(); } };
      const reviewBtn = card.querySelector('.bid-card-review-btn');
      if (reviewBtn) {
        reviewBtn.onclick = async function (e) {
          e.stopPropagation();
          reviewBtn.disabled = true;
          const res = await App.setProjectReviewStatus(proj.id, 'reviewed');
          if (res && res.ok) {
            proj.review_status = 'reviewed';
            proj.reviewed_at = new Date().toISOString();
            App.showToast('Marked "' + (proj.name || 'Untitled') + '" reviewed.', 3000);
            renderBidBoardList();
          } else {
            App.showToast((res && res.error) || 'Could not mark reviewed.', 4000);
            reviewBtn.disabled = false;
          }
        };
      }
    });
  }

  function fillOwnerFilter() {
    const ownerEl = document.getElementById('bidBoardOwnerFilter');
    if (!ownerEl) return;
    const seen = Object.create(null);
    const owners = [];
    for (let i = 0; i < boardRows.length; i++) {
      const em = boardRows[i].owner_email;
      if (em && !seen[em]) { seen[em] = true; owners.push(em); }
    }
    owners.sort();
    ownerEl.innerHTML = '<option value="">All estimators</option>' +
      owners.map(function (em) { return '<option value="' + esc(em) + '">' + esc(ownerLabel(em)) + '</option>'; }).join('');
    ownerEl.parentElement.style.display = owners.length > 1 ? '' : 'none';
  }

  async function openBidBoard() {
    const state = App.state;
    const supabase = App.getSupabase();
    const listEl = document.getElementById('bidBoardList');
    const errEl = document.getElementById('bidBoardError');
    if (!listEl) return;
    if (!supabase || !state.supabaseSession?.user) return;
    if (errEl) { errEl.style.display = 'none'; errEl.innerHTML = ''; }
    const searchEl = document.getElementById('bidBoardSearch');
    if (searchEl) { searchEl.value = ''; searchEl.oninput = renderBidBoardList; }
    const ownerEl = document.getElementById('bidBoardOwnerFilter');
    if (ownerEl) { ownerEl.value = ''; ownerEl.onchange = renderBidBoardList; }
    listEl.innerHTML = '<p class="bid-board-empty">Loading bids…</p>';
    App.showModal('bidBoardModal');
    try {
      const { data: projects, error } = await supabase.rpc('list_accessible_projects');
      if (error) {
        listEl.innerHTML = '<p class="bid-board-empty" style="color:var(--red);">Failed to load bids.</p>';
        return;
      }
      boardRows = (projects || []).filter(function (p) { return HIDDEN_TEST_OWNERS.indexOf(p.owner_email || '') === -1; });
      fillOwnerFilter();
      renderBidBoardList();
    } catch (e) {
      listEl.innerHTML = '<p class="bid-board-empty" style="color:var(--red);">Failed to load bids: ' + esc(e?.message || 'Unknown error') + '</p>';
    }
  }

  // Sign-in hook (called from app.js after the profile flags land): auto-open
  // once per page load for pure overseers with nothing else on screen. Admins
  // never auto-open (they use the button), and a stored last-project record
  // means the restore-last-session flow owns the boot -- the overseer comes
  // back to the bid they were viewing instead.
  function maybeAutoOpenBidBoard() {
    const state = App.state;
    if (autoOpenDone) return;
    if (!state.isOverseer || state.isAdmin) return;
    if (state.currentProjectId || state.pages.length) return;
    if (state.loadedViaViewLink) return;
    let hasLastProject = false;
    try { hasLastProject = !!localStorage.getItem('clickcount-last-project'); } catch (_) {}
    if (hasLastProject) { autoOpenDone = true; return; }
    autoOpenDone = true;
    void openBidBoard();
  }

  function wireBidBoard() {
    const btnSidebar = document.getElementById('bidBoardBtnSidebar');
    if (btnSidebar) btnSidebar.onclick = function () { void openBidBoard(); };
    const closeBtn = document.getElementById('bidBoardClose');
    if (closeBtn) closeBtn.onclick = function () { App.hideModal('bidBoardModal'); };
  }
  wireBidBoard();

  App.openBidBoard = openBidBoard;
  App.maybeAutoOpenBidBoard = maybeAutoOpenBidBoard;
})();

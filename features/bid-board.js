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
  // no checkout arm server-side. Admins and leads (LEAD-ROLE) open the board too (same button);
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

  // PEOPLE-TWINS (2026-10-13, Wendi's board): twin-owned bids are the fleet's
  // backtests and smoke runs, not an estimator's work, and they outnumber the
  // human bids many to one, so a lead's board opened on 41 machine bids. The
  // board carries a People · Twins · All switch (#bidBoardKind) and opens on
  // People for everyone but an admin, who opens on All (the view they had).
  // A twin is told by the owner's email, the same pattern twin-login enforces
  // (TWIN_EMAIL_RE in supabase/functions/twin-login/index.ts): the RPC carries
  // no twin flag, and a twin account outside the pattern cannot sign in, so
  // the pattern is the fleet. The switch hides itself when the company has
  // no twin bids; the estimator filter lists only the owners the segment shows.
  const TWIN_OWNER_RE = /^twin-estimator-\d+@twins\.counttooling\.local$/i;
  function isTwinOwner(email) { return TWIN_OWNER_RE.test(email || ''); }
  function boardKind() {
    const checked = document.querySelector('#bidBoardKind input:checked');
    return checked ? checked.value : 'people';
  }
  function setBoardKind(kind) {
    const input = document.querySelector('#bidBoardKind input[value="' + kind + '"]');
    if (input) input.checked = true;
  }
  function kindRows() {
    const kind = boardKind();
    if (kind === 'all') return boardRows.slice();
    return boardRows.filter(function (p) { return isTwinOwner(p.owner_email) === (kind === 'twins'); });
  }
  function hiddenTwinsNoteHtml() {
    if (boardKind() !== 'people') return '';
    const n = boardRows.filter(function (p) { return isTwinOwner(p.owner_email); }).length;
    if (!n) return '';
    return '<p class="bid-board-hidden-note">' + n + (n === 1 ? ' twin bid is' : ' twin bids are') + ' off · <button type="button" class="bid-board-show-twins">show twins</button></p>';
  }
  function onKindChange() {
    fillOwnerFilter();
    renderBidBoardList();
  }

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
    if (proj.review_status === 'changes') {
      const note = proj.review_note ? ' title="' + esc(proj.review_note) + '"' : '';
      return '<span class="bid-card-badge bid-card-badge-warn"' + note + '>Changes requested</span>';
    }
    return '';
  }

  function bidCardHtml(proj) {
    let date = proj.updated_at ? new Date(proj.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const ago = daysAgoLabel(proj.updated_at);
    if (date && ago) date += ' · ' + ago;
    const counts = [
      proj.counter_count > 0 ? (proj.counter_count + (proj.counter_count === 1 ? ' count' : ' counts')) : null,
      proj.line_count > 0 ? (proj.line_count + (proj.line_count === 1 ? ' line' : ' lines')) : null,
    ].filter(Boolean).join(' · ');
    // Cloud completeness (CLOUD-OFF-ICON, 2026-10-13, Will): a bid with its PDF in storage
    // is fully in the cloud (canvas markups always ride in the project row) and the card says
    // nothing about it. Without the PDF, only the canvas is backed up and the plan itself
    // lives on the estimator's device: a crossed-out cloud sits in the card's top-right
    // corner (over the title if it must), with the note on hover and in its label.
    const cloudOffNote = 'Canvas only. The markups are in the cloud, but the plan PDF was never uploaded and still lives on the estimator\'s device.';
    const cloudBadge = proj.pdf_path
      ? ''
      : '<span class="bid-card-cloud-off" role="img" aria-label="' + esc(cloudOffNote) + '" data-tip="' + esc(cloudOffNote) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M22.6 17A5 5 0 0 0 18 10h-1.3a8 8 0 0 0-7-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/>' +
          '</svg></span>';
    // DROP-CARD-BUTTONS (2026-10-13): a card carries no decision. Mark reviewed and
    // Request changes… live on the review bar in the opened bid (features/review-flow.js),
    // which the card click reaches, so a bid is reviewed where it is read.
    return '<div class="bid-card' + (cloudBadge ? ' bid-card-no-pdf' : '') + '" role="button" tabindex="0" data-project-id="' + esc(proj.id) + '">' +
      cloudBadge +
      '<div class="bid-card-name">' + esc(proj.name || 'Untitled') +
        (proj.external_ref ? ' <span class="bid-stamp" title="Upstream bid ' + esc(proj.external_ref) + '">' + esc(proj.external_ref) + '</span>' : '') +
      '</div>' +
      '<div class="bid-card-owner" title="' + esc(proj.owner_email || '') + '">' + esc(ownerLabel(proj.owner_email)) + '</div>' +
      '<div class="bid-card-meta">' +
        reviewBadgeHtml(proj) +
        (counts ? '<span class="bid-card-badge">' + esc(counts) + '</span>' : '') +
        (date ? '<span class="bid-card-date">' + esc(date) + '</span>' : '') +
      '</div>' +
      '<div class="bid-card-status">Loading…</div>' +
      '</div>';
  }

  function getFilteredBidRows() {
    const searchEl = document.getElementById('bidBoardSearch');
    const ownerEl = document.getElementById('bidBoardOwnerFilter');
    let rows = kindRows();
    const q = searchEl && searchEl.value ? searchEl.value.trim().toLowerCase() : '';
    if (q) rows = rows.filter(function (p) { return (p.name || 'Untitled').toLowerCase().indexOf(q) !== -1 || (p.external_ref || '').toLowerCase().indexOf(q) !== -1; });
    if (ownerEl && ownerEl.value) rows = rows.filter(function (p) { return (p.owner_email || '') === ownerEl.value; });
    return rows;
  }

  // Oldest waiting first (Will, 2026-10-13): the Ready lane runs oldest request first, so the
  // bid that has waited longest is the first card and the review bar's first Next ready. A
  // row with no stamp sorts last.
  function byOldestWaiting(a, b) {
    const ta = a.review_requested_at ? new Date(a.review_requested_at).getTime() : Infinity;
    const tb = b.review_requested_at ? new Date(b.review_requested_at).getTime() : Infinity;
    return ta - tb;
  }

  function renderBidBoardList() {
    const listEl = document.getElementById('bidBoardList');
    if (!listEl) return;
    const rows = getFilteredBidRows();
    const wireShowTwins = function () {
      const showTwins = listEl.querySelector('.bid-board-show-twins');
      if (showTwins) showTwins.onclick = function () { setBoardKind('twins'); onKindChange(); };
    };
    if (!rows.length) {
      listEl.innerHTML = '<p class="bid-board-empty empty-state">' + (boardRows.length ? 'No bids match.' : 'No bids yet.') + '</p>' + hiddenTwinsNoteHtml();
      wireShowTwins();
      return;
    }
    // "Ready for review" bids get their own lane pinned above the rest — the
    // estimator's handoff signal is the first thing an overseer sees.
    const ready = rows.filter(function (p) { return p.review_status === 'ready'; }).sort(byOldestWaiting);
    const rest = rows.filter(function (p) { return p.review_status !== 'ready'; });
    // REVIEW-BAR: the lane as shown is the bar's Next ready queue (features/review-flow.js).
    App.setReviewQueue && App.setReviewQueue(ready);
    listEl.innerHTML = ready.length
      ? '<div class="bid-board-lane-title">Ready for review (' + ready.length + ')<span class="bid-board-lane-hint"> · oldest waiting first</span></div>' +
        ready.map(bidCardHtml).join('') +
        (rest.length ? '<div class="bid-board-lane-title">All bids</div>' + rest.map(bidCardHtml).join('') : '')
      : rows.map(bidCardHtml).join('');
    listEl.innerHTML += hiddenTwinsNoteHtml();
    wireShowTwins();
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
    });
  }

  function fillOwnerFilter() {
    const ownerEl = document.getElementById('bidBoardOwnerFilter');
    if (!ownerEl) return;
    const seen = Object.create(null);
    const owners = [];
    const rows = kindRows();   // PEOPLE-TWINS: only the owners the segment shows
    for (let i = 0; i < rows.length; i++) {
      const em = rows[i].owner_email;
      if (em && !seen[em]) { seen[em] = true; owners.push(em); }
    }
    owners.sort();
    const keep = ownerEl.value && owners.indexOf(ownerEl.value) !== -1 ? ownerEl.value : '';
    ownerEl.innerHTML = '<option value="">All estimators</option>' +
      owners.map(function (em) { return '<option value="' + esc(em) + '">' + esc(ownerLabel(em)) + '</option>'; }).join('');
    ownerEl.value = keep;
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
    const kindEl = document.getElementById('bidBoardKind');
    if (kindEl) {
      setBoardKind(state.isAdmin ? 'all' : 'people');   // PEOPLE-TWINS: an admin keeps the whole board
      kindEl.querySelectorAll('input').forEach(function (r) { r.onchange = onKindChange; });
      kindEl.style.display = 'none';
    }
    listEl.innerHTML = '<p class="bid-board-empty">Loading bids…</p>';
    App.showModal('bidBoardModal');
    try {
      const { data: projects, error } = await supabase.rpc('list_accessible_projects');
      if (error) {
        listEl.innerHTML = '<p class="bid-board-empty" style="color:var(--red);">Failed to load bids.</p>';
        return;
      }
      boardRows = (projects || []).filter(function (p) { return HIDDEN_TEST_OWNERS.indexOf(p.owner_email || '') === -1; });
      if (kindEl) kindEl.style.display = boardRows.some(function (p) { return isTwinOwner(p.owner_email); }) ? '' : 'none';
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
    const statusLink = document.getElementById('statusBarBidBoard');
    if (statusLink) statusLink.onclick = function () { void openBidBoard(); };
    const closeBtn = document.getElementById('bidBoardClose');
    if (closeBtn) closeBtn.onclick = function () { App.hideModal('bidBoardModal'); };
  }
  wireBidBoard();

  App.openBidBoard = openBidBoard;
  App.maybeAutoOpenBidBoard = maybeAutoOpenBidBoard;
})();

(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Bid review handoff (estimator → overseer ops flow). Two surfaces:
  //   * Project Settings gains a "Bid review" row (#settingsReviewRow): the
  //     estimator marks the open cloud bid "Ready for review", withdraws it,
  //     or re-requests after changes. The row re-renders whenever
  //     #settingsModal becomes visible (MutationObserver on its class — no
  //     app.js hook needed) and reads the live status from the projects row.
  //   * features/bid-board.js calls App.setProjectReviewStatus for the
  //     overseer's per-card "Mark reviewed" action.
  //   * The review bar (#reviewBar, REVIEW-BAR 2026-10-13, BOARD-QUIET step 1): the
  //     decision happens where the evidence is. While a bid that is ready for
  //     review is open by someone who can oversee it (App.canOversee: admin,
  //     overseer, lead), a slim bar under the header says how long it has waited
  //     and carries the two decisions, Request changes… and Mark reviewed, plus
  //     Next ready, which opens the next bid in the board's Ready lane (oldest
  //     waiting first; the board hands the lane over with App.setReviewQueue each
  //     time it renders). It shows from App.onCloudProjectRowLoaded, which
  //     features/load-project.js calls at the end of a cloud load with the RPC
  //     row (review_status rides it), and hides when the open project is no
  //     longer the one it was shown for (App.refreshReviewBar, from updateUI).
  // All transitions go through the set_project_review_status RPC, which
  // enforces who can do what server-side ('ready'/clear: owner, editor share,
  // or admin; 'reviewed': overseer or admin) — this file never gates harder
  // than the server, it only hides the row where it could never apply.

  async function setProjectReviewStatus(projectId, status, note) {
    const supabase = App.getSupabase();
    if (!supabase) return { ok: false, error: 'Cloud not configured' };
    try {
      const args = { p_project_id: projectId, p_status: status };
      if (note != null) args.p_note = note;
      const { data, error } = await supabase.rpc('set_project_review_status', args);
      if (error) return { ok: false, error: error.message };
      return data || { ok: false, error: 'No response' };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'Failed' };
    }
  }

  function reviewStatusLine(status, requestedAt, reviewedAt, note) {
    if (status === 'ready') return 'Ready for review' + (requestedAt ? ' since ' + new Date(requestedAt).toLocaleDateString() : '');
    if (status === 'reviewed') return 'Reviewed' + (reviewedAt ? ' ' + new Date(reviewedAt).toLocaleDateString() : '');
    if (status === 'changes') return 'Changes requested' + (reviewedAt ? ' ' + new Date(reviewedAt).toLocaleDateString() : '') + (note ? ': “' + note + '”' : '');
    return 'Not submitted for review';
  }

  function reviewButtonLabel(status) {
    if (status === 'ready') return 'Withdraw';
    if (status === 'reviewed' || status === 'changes') return 'Mark ready again';
    return 'Mark ready for review';
  }

  async function refreshSettingsReviewRow() {
    const state = App.state;
    const row = document.getElementById('settingsReviewRow');
    if (!row) return;
    const supabase = App.getSupabase();
    // Only meaningful for a signed-in user with a cloud project open, and an
    // overseer's read-only session never requests reviews from here.
    const show = !!(supabase && state.supabaseSession?.user && state.currentProjectId && (!state.isViewer || App.canTakeOver()));
    row.style.display = show ? '' : 'none';
    if (!show) return;
    const textEl = document.getElementById('settingsReviewStatusText');
    const btn = document.getElementById('settingsReviewToggleBtn');
    if (textEl) textEl.textContent = 'Checking…';
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await supabase.from('projects')
        .select('review_status, review_requested_at, reviewed_at, review_note')
        .eq('id', state.currentProjectId).maybeSingle();
      if (error || !data) {
        if (textEl) textEl.textContent = 'Review status unavailable.';
        return;
      }
      if (textEl) textEl.textContent = reviewStatusLine(data.review_status, data.review_requested_at, data.reviewed_at, data.review_note);
      if (btn) {
        btn.textContent = reviewButtonLabel(data.review_status);
        btn.dataset.next = data.review_status === 'ready' ? '' : 'ready';
        btn.disabled = false;
      }
    } catch (_) {
      if (textEl) textEl.textContent = 'Review status unavailable.';
    }
  }

  // --- The review bar ---
  let reviewBar = null;      // { proj, decided: null | 'reviewed' | 'changes', note }
  let reviewQueue = [];      // the board's Ready lane as rendered, oldest waiting first

  function waitedLabel(iso) {
    if (!iso) return '';
    const days = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 864e5));
    if (days === 0) return 'ready today';
    if (days === 1) return 'waiting a day';
    return 'waiting ' + days + ' days';
  }
  function countsLabel(p) {
    return [
      p.counter_count > 0 ? p.counter_count + (p.counter_count === 1 ? ' count' : ' counts') : null,
      p.line_count > 0 ? p.line_count + (p.line_count === 1 ? ' line' : ' lines') : null,
    ].filter(Boolean).join(' · ');
  }
  function readyLeft() {
    const id = reviewBar ? reviewBar.proj.id : null;
    return reviewQueue.filter(function (q) { return q.review_status === 'ready' && q.id !== id; }).length;
  }
  // The next ready bid after the open one in lane order (the lane's head when the open bid
  // is not in it, e.g. opened from Load Project).
  function nextReadyRow() {
    if (!reviewBar) return null;
    const id = reviewBar.proj.id;
    const idx = reviewQueue.findIndex(function (q) { return q.id === id; });
    const after = idx === -1 ? reviewQueue : reviewQueue.slice(idx + 1);
    return after.find(function (q) { return q.id !== id && q.review_status === 'ready'; }) || null;
  }
  function renderReviewBar() {
    const bar = document.getElementById('reviewBar');
    if (!bar) return;
    const state = App.state;
    const show = !!(reviewBar && state.currentProjectId && state.currentProjectId === reviewBar.proj.id);
    bar.style.display = show ? '' : 'none';
    if (!show) return;
    const p = reviewBar.proj;
    const text = document.getElementById('reviewBarText');
    const changesBtn = document.getElementById('reviewBarChanges');
    const reviewedBtn = document.getElementById('reviewBarReviewed');
    const nextBtn = document.getElementById('reviewBarNext');
    const left = readyLeft();
    const tail = left ? ' · ' + left + ' more ready' : ' · none left ready';
    if (reviewBar.decided === 'reviewed') text.textContent = 'Reviewed ✓' + tail;
    else if (reviewBar.decided === 'changes') text.textContent = 'Sent back: “' + reviewBar.note + '”' + tail;
    else {
      const who = p.owner_email ? p.owner_email.split('@')[0] : '';
      text.textContent = [waitedLabel(p.review_requested_at), who, countsLabel(p)].filter(Boolean).join(' · ');
    }
    bar.classList.toggle('done', !!reviewBar.decided);
    changesBtn.style.display = reviewBar.decided ? 'none' : '';
    reviewedBtn.style.display = reviewBar.decided ? 'none' : '';
    changesBtn.disabled = false;
    reviewedBtn.disabled = false;
    const next = nextReadyRow();
    nextBtn.style.display = next ? '' : 'none';
    nextBtn.disabled = false;
    nextBtn.textContent = 'Next ready ▸';
  }
  function showReviewBar(proj) {
    const ok = !!(proj && proj.review_status === 'ready' && App.canOversee && App.canOversee());
    reviewBar = ok ? { proj: proj, decided: null, note: null } : null;
    renderReviewBar();
  }
  async function decideReviewBar(status) {
    if (!reviewBar || reviewBar.decided) return;
    const p = reviewBar.proj;
    let note = null;
    if (status === 'changes') {
      // The server refuses a blank note ('changes' without guidance is noise); cancel aborts.
      note = await App.confirmDialog({ title: 'What should change before this bid comes back?', input: { placeholder: 'One line the estimator will read' }, confirmLabel: 'Send back' });
      if (note == null || !note.trim()) return;
      note = note.trim();
    }
    document.getElementById('reviewBarChanges').disabled = true;
    document.getElementById('reviewBarReviewed').disabled = true;
    const res = await setProjectReviewStatus(p.id, status, note);
    if (!res || !res.ok) {
      App.showToast((res && res.error) || 'Could not update review status.', 4000);
      renderReviewBar();
      return;
    }
    p.review_status = status;   // the board holds this same row, so its lane agrees without a refetch
    p.reviewed_at = new Date().toISOString();
    if (note) p.review_note = note;
    reviewBar.decided = status;
    reviewBar.note = note;
    App.showToast(status === 'reviewed' ? 'Marked "' + (p.name || 'Untitled') + '" reviewed.' : 'Changes requested on "' + (p.name || 'Untitled') + '".', 3000);
    renderReviewBar();
  }
  async function openNextReady() {
    const next = nextReadyRow();
    if (!next) return;
    const nextBtn = document.getElementById('reviewBarNext');
    nextBtn.disabled = true;
    nextBtn.textContent = 'Opening…';
    try {
      await App.loadCloudProjectRow(next, {
        hostModalId: 'bidBoardModal',
        showError: function (html) { App.showToast(String(html).replace(/<[^>]+>/g, ''), 4000); },
      });
      showReviewBar(next);   // the load's own hook does this too; a load a spec stubs does not
    } catch (e) {
      App.showToast((e && e.message) || 'Failed to open bid.', 4000);
      renderReviewBar();
    }
  }

  function wireReviewFlow() {
    const modal = document.getElementById('settingsModal');
    const btn = document.getElementById('settingsReviewToggleBtn');
    if (btn) {
      btn.onclick = async function () {
        const state = App.state;
        if (!state.currentProjectId) return;
        const next = btn.dataset.next || null;
        btn.disabled = true;
        const res = await setProjectReviewStatus(state.currentProjectId, next);
        if (res.ok) {
          App.showToast(next === 'ready' ? 'Bid marked ready for review.' : 'Review request withdrawn.', 3000);
        } else {
          App.showToast(res.error || 'Could not update review status.', 4000);
        }
        void refreshSettingsReviewRow();
      };
    }
    const barChanges = document.getElementById('reviewBarChanges');
    if (barChanges) barChanges.onclick = function () { void decideReviewBar('changes'); };
    const barReviewed = document.getElementById('reviewBarReviewed');
    if (barReviewed) barReviewed.onclick = function () { void decideReviewBar('reviewed'); };
    const barNext = document.getElementById('reviewBarNext');
    if (barNext) barNext.onclick = function () { void openNextReady(); };
    if (modal && typeof MutationObserver !== 'undefined') {
      let wasVisible = modal.classList.contains('visible');
      new MutationObserver(function () {
        const visible = modal.classList.contains('visible');
        if (visible && !wasVisible) void refreshSettingsReviewRow();
        wasVisible = visible;
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
  }
  wireReviewFlow();

  App.setProjectReviewStatus = setProjectReviewStatus;
  App.onCloudProjectRowLoaded = showReviewBar;   // features/load-project.js, at the end of a cloud load
  App.showReviewBar = showReviewBar;             // the spec seam
  App.setReviewQueue = function (rows) { reviewQueue = Array.isArray(rows) ? rows.slice() : []; renderReviewBar(); };   // features/bid-board.js, the Ready lane as rendered
  App.refreshReviewBar = renderReviewBar;        // app.js updateUI
})();

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
  // All transitions go through the set_project_review_status RPC, which
  // enforces who can do what server-side ('ready'/clear: owner, editor share,
  // or admin; 'reviewed': overseer or admin) — this file never gates harder
  // than the server, it only hides the row where it could never apply.

  async function setProjectReviewStatus(projectId, status) {
    const supabase = App.getSupabase();
    if (!supabase) return { ok: false, error: 'Cloud not configured' };
    try {
      const { data, error } = await supabase.rpc('set_project_review_status', { p_project_id: projectId, p_status: status });
      if (error) return { ok: false, error: error.message };
      return data || { ok: false, error: 'No response' };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'Failed' };
    }
  }

  function reviewStatusLine(status, requestedAt, reviewedAt) {
    if (status === 'ready') return 'Ready for review' + (requestedAt ? ' since ' + new Date(requestedAt).toLocaleDateString() : '');
    if (status === 'reviewed') return 'Reviewed' + (reviewedAt ? ' ' + new Date(reviewedAt).toLocaleDateString() : '');
    return 'Not submitted for review';
  }

  function reviewButtonLabel(status) {
    if (status === 'ready') return 'Withdraw';
    if (status === 'reviewed') return 'Mark ready again';
    return 'Mark ready for review';
  }

  async function refreshSettingsReviewRow() {
    const state = App.state;
    const row = document.getElementById('settingsReviewRow');
    if (!row) return;
    const supabase = App.getSupabase();
    // Only meaningful for a signed-in user with a cloud project open, and an
    // overseer's read-only session never requests reviews from here.
    const show = !!(supabase && state.supabaseSession?.user && state.currentProjectId && (!state.isViewer || state.isAdmin));
    row.style.display = show ? '' : 'none';
    if (!show) return;
    const textEl = document.getElementById('settingsReviewStatusText');
    const btn = document.getElementById('settingsReviewToggleBtn');
    if (textEl) textEl.textContent = 'Checking…';
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await supabase.from('projects')
        .select('review_status, review_requested_at, reviewed_at')
        .eq('id', state.currentProjectId).maybeSingle();
      if (error || !data) {
        if (textEl) textEl.textContent = 'Review status unavailable.';
        return;
      }
      if (textEl) textEl.textContent = reviewStatusLine(data.review_status, data.review_requested_at, data.reviewed_at);
      if (btn) {
        btn.textContent = reviewButtonLabel(data.review_status);
        btn.dataset.next = data.review_status === 'ready' ? '' : 'ready';
        btn.disabled = false;
      }
    } catch (_) {
      if (textEl) textEl.textContent = 'Review status unavailable.';
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
  App.refreshSettingsReviewRow = refreshSettingsReviewRow;
})();

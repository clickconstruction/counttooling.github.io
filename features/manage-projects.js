/*
 * features/manage-projects.js - the admin Manage Projects modal
 * (#manageProjectsModal), extracted from the app.js IIFE as the nineteenth
 * feature-file split under the window.App registry pattern. It lists every
 * project via the list_projects_for_admin RPC, with per-row Delete
 * (admin-delete-project Edge Function) and an admin Force-turn-in
 * (force_check_in_project RPC). R1-ADMIN (2026-09-27): the row for the project
 * open and checked out in this tab offers the normal Turn in instead
 * (App.tryTurnIn, features/turn-in.js), which saves before it releases.
 *
 * Loaded as a classic <script src="features/manage-projects.js"> AFTER app.js.
 * Its own IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openManageProjectsModal back onto App, and binds the #manageProjectsModalClose
 * handler at this file's load.
 *
 * Cloud-coupled. It reaches the Supabase client through App.getSupabase() rather
 * than a captured reference, because app.js reassigns `supabase` when it recycles
 * a wedged client (recreateSupabaseClient) -- the same getter-accessor pattern as
 * Save Status's App.getSaveStatusLog(). The env config (App.SUPABASE_URL /
 * App.SUPABASE_ANON_KEY) and the checkout/clock engine helpers
 * (App.updateServerClockFromRpc / App.clearCheckoutExpiredAttention /
 * App.resetAutoRecheckoutCounter) are publish-only deps that stay in app.js.
 *
 * The #settingsManageProjects opener stays in app.js (reaches this via
 * App.openManageProjectsModal); the Escape-key close branch also stays.
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 * See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function openManageProjectsModal() {
    const state = App.state;
    const listEl = document.getElementById('manageProjectsList');
    const session = state.supabaseSession;
    if (!session?.access_token) return;
    listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
    App.hideModal('mySettingsModal');
    App.showModal('manageProjectsModal');
    const headers = { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY };
    const formatSizeMb = function (bytes) {
      if (bytes == null || bytes < 0) return '';
      const mb = bytes / (1024 * 1024);
      return mb < 0.01 ? (bytes / 1024).toFixed(2) + ' KB' : mb.toFixed(2) + ' MB';
    };
    fetch(App.SUPABASE_URL + '/rest/v1/rpc/list_projects_for_admin', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' })
      .then(async (res) => {
        let data;
        try { data = await res.json(); } catch (_) { data = {}; }
        if (!res.ok) {
          listEl.innerHTML = '<p style="color:var(--red);">' + ((data && data.message) || ('HTTP ' + res.status)).replace(/</g, '&lt;') + '</p>';
          return;
        }
        if (!Array.isArray(data) || data.length === 0) {
          listEl.innerHTML = '<p class="empty-state"><b>No projects in the cloud</b>Save a takeoff from Project Settings and it shows up here.</p>';
          return;
        }
        const esc = (s) => App.escapeHtml(s);
        const myId = session.user?.id || null;
        listEl.innerHTML = data.map((p) => {
          const sizeStr = formatSizeMb(p.size_bytes);
          const dateStr = p.updated_at ? new Date(p.updated_at).toLocaleString() : '';
          const metaLine1 = [esc(p.owner_email || 'none') + (App.twinBadgeHtml ? App.twinBadgeHtml(p.owner_email) : ''), dateStr, sizeStr].filter(Boolean).join(' · ');
          const metaLine2Parts = [];
          const countStr = (p.counter_count != null || p.line_count != null)
            ? [p.counter_count != null ? p.counter_count + (p.counter_count === 1 ? ' counter' : ' counters') : null, p.line_count != null ? p.line_count + (p.line_count === 1 ? ' line' : ' lines') : null].filter(Boolean).join(' · ')
            : '';
          if (countStr) metaLine2Parts.push(countStr);
          // STALE-LOCK: an expired lock is named as expired; the force below still clears it.
          if (p.checked_out_email && App.isCheckoutLockLive(p.checked_out_at)) metaLine2Parts.push('Checked out by ' + esc(p.checked_out_email) + (App.twinBadgeHtml ? App.twinBadgeHtml(p.checked_out_email) : ''));
          else if (p.checked_out_email) metaLine2Parts.push('Lock expired · last held by ' + esc(p.checked_out_email) + (App.twinBadgeHtml ? App.twinBadgeHtml(p.checked_out_email) : ''));
          const metaLine2 = metaLine2Parts.join(' · ');
          const canvasOnlyBadge = !p.pdf_path ? '<span class="badge" style="background:var(--surface2);color:var(--text2);font-size:11px;">Canvas only</span>' : '';
          const showForceCheckIn = state.isAdmin && (p.checked_out_by || p.checked_out_email);
          // R1-ADMIN (2026-09-27, Will's call): forcing the project you have open and
          // checked out in THIS tab is really your own Turn In, so that row offers the
          // normal one (save first, then release, "Project turned in."). A force there
          // skipped the save and brought up the "turned in while you had it checked out"
          // notice on your own release. Rows held by anyone else, or by you in a tab
          // where the project is not the open, held one, keep the admin force.
          const heldHere = isHeldInThisTab(p, myId);
          const forceCheckInBtn = !showForceCheckIn ? ''
            : heldHere
              ? '<button type="button" class="settings-project-force-checkin settings-project-turn-in" data-project-id="' + esc(p.id) + '">Turn in</button>'
              : '<button type="button" class="settings-project-force-checkin" data-project-id="' + esc(p.id) + '">Force turn-in (admin)</button>';
          return '<div class="settings-user-row settings-project-row" data-project-id="' + esc(p.id) + '">' +
            '<div class="settings-project-info">' +
            '<span class="settings-project-name" title="' + esc(p.name) + '">' + esc(p.name || 'Untitled') + '</span>' +
            '<div class="settings-project-meta">' + metaLine1 + '</div>' +
            (metaLine2 ? '<div class="settings-project-meta">' + metaLine2 + '</div>' : '') +
            '</div>' +
            '<div class="settings-project-actions">' +
            (canvasOnlyBadge ? '<div class="settings-project-badges">' + canvasOnlyBadge + '</div>' : '') +
            forceCheckInBtn +
            '<button type="button" class="settings-user-delete" data-project-id="' + esc(p.id) + '" data-project-name="' + esc(p.name || 'Untitled') + '">Delete</button>' +
            '</div>' +
            '</div>';
        }).join('');
        listEl.querySelectorAll('.settings-user-delete').forEach((btn) => {
          btn.onclick = () => deleteProject(btn.dataset.projectId, btn.dataset.projectName, btn);
        });
        listEl.querySelectorAll('.settings-project-force-checkin').forEach((btn) => {
          btn.onclick = btn.classList.contains('settings-project-turn-in')
            ? () => turnInOwnProjectFromManage(btn.dataset.projectId, btn)
            : () => forceCheckInProjectFromManage(btn.dataset.projectId, btn);
        });
      })
      .catch((e) => { listEl.innerHTML = '<p style="color:var(--red);">' + ((e && e.message) || 'Network error').replace(/</g, '&lt;') + '</p>'; });
  }

  // R1-ADMIN: the list row is the project open in this tab and this tab holds its
  // checkout (the same test that puts [Turn In] in the header), and the server
  // agrees it is checked out to us.
  function isHeldInThisTab(p, myId) {
    const state = App.state;
    return !!(myId && p && p.id === state.currentProjectId &&
      p.checked_out_by === myId && state.checkedOutBy === myId && !state.isViewer);
  }

  // R1-ADMIN: the row's Turn in runs the header's Turn In (features/turn-in.js
  // tryTurnIn: expired short-circuit, flush, release, "Project turned in."), then
  // redraws the list. Its failure toasts are its own.
  async function turnInOwnProjectFromManage(projectId, btnEl) {
    const state = App.state;
    if (state.currentProjectId !== projectId || typeof App.tryTurnIn !== 'function') {
      openManageProjectsModal();
      return;
    }
    btnEl.disabled = true;
    const origText = btnEl.textContent;
    btnEl.textContent = 'Turning in…';
    let result = null;
    try {
      result = await App.tryTurnIn({});
    } catch (e) {
      App.showToast((e && e.message) || 'Failed to turn in', 3000);
    }
    if (result && result.ok) {
      openManageProjectsModal();
      return;
    }
    // An expired edit session routes to the recovery dialog; clear the way to it.
    if (result && result.code === 'CHECKOUT_EXPIRED') {
      App.hideModal('manageProjectsModal');
      return;
    }
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }

  async function forceCheckInProjectFromManage(projectId, btnEl) {
    const state = App.state;
    const supabase = App.getSupabase();
    if (!supabase) return;
    btnEl.disabled = true;
    const origText = btnEl.textContent;
    btnEl.textContent = 'Turning in…';
    try {
      const { data, error } = await supabase.rpc('force_check_in_project', { p_project_id: projectId });
      App.updateServerClockFromRpc(data);
      const result = data || (error ? { ok: false, error: error.message } : { ok: false });
      if (result.ok) {
        if (state.currentProjectId === projectId) {
          try { App.clearCheckoutExpiredAttention(); } catch (_) {}
          try { App.resetAutoRecheckoutCounter(projectId); } catch (_) {}
        }
        App.showToast('Project force turned in.');
        openManageProjectsModal();
      } else {
        App.showToast(result.error || 'Failed to force turn-in', 3000);
        btnEl.disabled = false;
        btnEl.textContent = origText;
      }
    } catch (e) {
      App.showToast(e.message || 'Failed to force turn-in', 3000);
      btnEl.disabled = false;
      btnEl.textContent = origText;
    }
  }

  async function deleteProject(projectId, name, btnEl) {
    if (!(await App.confirmDialog({ title: 'Delete project?', body: '"' + (name || projectId) + '" will be deleted for everyone who can see it. This cannot be undone.', confirmLabel: 'Delete project', danger: true }))) return;
    const session = App.state.supabaseSession;
    if (!session?.access_token) return;
    btnEl.disabled = true;
    btnEl.textContent = 'Deleting…';
    try {
      const res = await fetch(App.SUPABASE_URL + '/functions/v1/admin-delete-project', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectId })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const row = btnEl.closest('.settings-user-row');
        row.remove();
        if (!document.getElementById('manageProjectsList').querySelector('.settings-user-row')) {
          document.getElementById('manageProjectsList').innerHTML = '<p class="empty-state"><b>No projects in the cloud</b>Save a takeoff from Project Settings and it shows up here.</p>';
        }
      } else {
        App.showToast(data.error || 'Delete failed', 5000);
        btnEl.disabled = false;
        btnEl.textContent = 'Delete';
      }
    } catch (e) {
      App.showToast(e.message || 'Delete failed', 5000);
      btnEl.disabled = false;
      btnEl.textContent = 'Delete';
    }
  }

  document.getElementById('manageProjectsModalClose').onclick = () => App.hideModal('manageProjectsModal');

  App.openManageProjectsModal = openManageProjectsModal;
})();

/*
 * features/manage-projects.js - the admin Manage Projects modal
 * (#manageProjectsModal), extracted from the app.js IIFE as the nineteenth
 * feature-file split under the window.App registry pattern. It lists every
 * project via the list_projects_for_admin RPC, with per-row Delete
 * (admin-delete-project Edge Function) and an admin Force-turn-in
 * (force_check_in_project RPC).
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
          listEl.innerHTML = '<p style="color:var(--text3);">No projects</p>';
          return;
        }
        const esc = (s) => App.escapeHtml(s);
        listEl.innerHTML = data.map((p) => {
          const sizeStr = formatSizeMb(p.size_bytes);
          const dateStr = p.updated_at ? new Date(p.updated_at).toLocaleString() : '';
          const metaLine1 = [esc(p.owner_email || '—'), dateStr, sizeStr].filter(Boolean).join(' · ');
          const metaLine2Parts = [];
          const countStr = (p.counter_count != null || p.line_count != null)
            ? [p.counter_count != null ? p.counter_count + ' counters' : null, p.line_count != null ? p.line_count + ' lines' : null].filter(Boolean).join(' · ')
            : '';
          if (countStr) metaLine2Parts.push(countStr);
          if (p.checked_out_email) metaLine2Parts.push('Checked out by ' + esc(p.checked_out_email));
          const metaLine2 = metaLine2Parts.join(' · ');
          const canvasOnlyBadge = !p.pdf_path ? '<span class="badge" style="background:var(--surface2);color:var(--text2);font-size:11px;">Canvas only</span>' : '';
          const showForceCheckIn = state.isAdmin && (p.checked_out_by || p.checked_out_email);
          const forceCheckInBtn = showForceCheckIn
            ? '<button type="button" class="settings-project-force-checkin" data-project-id="' + esc(p.id) + '">Force turn-in (admin)</button>'
            : '';
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
          btn.onclick = () => forceCheckInProjectFromManage(btn.dataset.projectId, btn);
        });
      })
      .catch((e) => { listEl.innerHTML = '<p style="color:var(--red);">' + ((e && e.message) || 'Network error').replace(/</g, '&lt;') + '</p>'; });
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
    if (!confirm('Delete project "' + (name || projectId) + '"? This cannot be undone.')) return;
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
          document.getElementById('manageProjectsList').innerHTML = '<p style="color:var(--text3);">No projects</p>';
        }
      } else {
        alert(data.error || 'Delete failed');
        btnEl.disabled = false;
        btnEl.textContent = 'Delete';
      }
    } catch (e) {
      alert(e.message || 'Delete failed');
      btnEl.disabled = false;
      btnEl.textContent = 'Delete';
    }
  }

  document.getElementById('manageProjectsModalClose').onclick = () => App.hideModal('manageProjectsModal');

  App.openManageProjectsModal = openManageProjectsModal;
})();

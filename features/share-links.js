/*
 * features/share-links.js - the Share Project modal & view links, extracted
 * from the app.js IIFE as the twenty-seventh feature-file split under the
 * window.App registry pattern. One cloud-coupled surface moves: the Share
 * modal (`#shareProjectModal`) with its people list (add / role change /
 * remove via `list_users_for_project_invite` / `list_project_shares` /
 * `add_project_share` / `remove_project_share` / the `invite-to-project` Edge
 * Function) and its view-links section (list / create / copy URL / access log
 * / revoke via the `*_view_link*` RPCs).
 *
 * Loaded as a classic <script src="/features/share-links.js"> AFTER app.js.
 * Its own IIFE: it reaches the cross-cutting state + helpers through the
 * shared window.App registry, registers App.openShareProjectModal, and binds
 * the `#shareViewLinkCreate` / `#shareProjectModalClose` / `#shareProjectAdd`
 * handlers plus the view-links collapse toggle at load.
 *
 * Cloud-coupled: reads the Supabase client via App.getSupabase() at call time
 * (the client is recycled on recovery, and the accessor is only registered
 * when SUPABASE_ENABLED — every entry guards on it). Revoking a link calls
 * App.onViewLinkRevoked() (registered by features/output.js) so the Copy to
 * PipeTooling export never hands out a revoked token — feature-to-feature
 * coupling mediated entirely by the registry, load order irrelevant. The two
 * openers (#sidebarLogoShare, #settingsShareProject) stay in app.js and reach
 * the modal via App.openShareProjectModal(); the shared view-link minting
 * (getOrCreateViewLinkUrl, used by the header copy-link button and the
 * export footer) also stays in app.js.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  async function openShareProjectModal() {
    const state = App.state;
    const supabase = App.getSupabase ? App.getSupabase() : null;
    if (!state.currentProjectId || !supabase) return;
    const listEl = document.getElementById('shareProjectList');
    const errEl = document.getElementById('shareProjectError');
    const userSelect = document.getElementById('shareProjectUserSelect');
    errEl.style.display = 'none';
    listEl.innerHTML = '<p style="color:var(--text3);font-size:0.9rem;">Loading...</p>';
    userSelect.innerHTML = '<option value="">Select a user...</option>';
    userSelect.value = '';
    App.showModal('shareProjectModal');
    const shareViewLinksSection = document.getElementById('shareViewLinksSection');
    if (shareViewLinksSection) shareViewLinksSection.style.display = state.loadedViaViewLink ? 'none' : '';
    const shareViewLinkCreate = document.getElementById('shareViewLinkCreate');
    if (shareViewLinkCreate) shareViewLinkCreate.style.display = state.loadedViaViewLink ? 'none' : '';
    let usersResult, sharesResult;
    try {
      [usersResult, sharesResult] = await Promise.all([
        supabase.rpc('list_users_for_project_invite', { p_project_id: state.currentProjectId }),
        supabase.rpc('list_project_shares', { p_project_id: state.currentProjectId })
      ]);
    } catch (e) {
      listEl.innerHTML = '';
      errEl.textContent = 'Failed to load: ' + (e.message || 'Network error');
      errEl.style.display = 'block';
      return;
    }
    const { data: users, error: usersErr } = usersResult;
    const { data: shares, error } = sharesResult;
    if (!usersErr && users && users.length > 0) {
      users.forEach(function(u) {
        const opt = document.createElement('option');
        opt.value = (u.email || '').toLowerCase();
        opt.textContent = u.email || u.id;
        userSelect.appendChild(opt);
      });
    }
    listEl.innerHTML = '';
    if (error) {
      errEl.textContent = 'Failed to load shares: ' + (error.message || 'Unknown error');
      errEl.style.display = 'block';
    } else if (shares && shares.length > 0) {
      const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const trashSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 640 640"><path fill="currentColor" d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/></svg>';
      shares.forEach(function(s) {
        const div = document.createElement('div');
        div.className = 'share-project-row' + (s.role === 'owner' ? ' share-project-owner-row' : '');
        div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);';
        if (s.role === 'owner') {
          div.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;"><span style="flex-shrink:0;color:var(--text2);">Owner: ' + esc(s.email || s.user_id) + '</span></div>';
        } else {
          div.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;"><span style="flex-shrink:0;">' + esc(s.email || s.user_id) + '</span><select class="share-project-role-select" style="padding:4px 8px;font-size:0.85rem;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--text);" data-user-id="' + s.user_id + '"><option value="viewer"' + (s.role === 'viewer' ? ' selected' : '') + '>Viewer</option><option value="editor"' + (s.role === 'editor' ? ' selected' : '') + '>Editor</option></select></div><button type="button" class="danger share-project-remove-btn" style="padding:6px;border-radius:4px;cursor:pointer;border:none;background:transparent;color:var(--red);" aria-label="Remove" data-user-id="' + s.user_id + '">' + trashSvg + '</button>';
          div.querySelector('.share-project-remove-btn').onclick = async () => {
            const sb = App.getSupabase ? App.getSupabase() : null;
            if (!sb) return;
            const { data: res } = await sb.rpc('remove_project_share', { p_project_id: App.state.currentProjectId, p_target_user_id: s.user_id });
            if (res && res.ok) openShareProjectModal();
            else App.showToast((res && res.error) || 'Failed to remove');
          };
          div.querySelector('.share-project-role-select').onchange = async function() {
            const newRole = this.value;
            const sb = App.getSupabase ? App.getSupabase() : null;
            if (!sb) return;
            const { data: res } = await sb.rpc('add_project_share', { p_project_id: App.state.currentProjectId, p_target_user_id: s.user_id, p_role: newRole });
            if (res && res.ok) openShareProjectModal();
            else App.showToast((res && res.error) || 'Failed to update role');
          };
        }
        listEl.appendChild(div);
      });
    } else {
      listEl.innerHTML = '<p style="color:var(--text3);font-size:0.9rem;">No one else has access yet.</p>';
    }
    const viewLinksListEl = document.getElementById('shareViewLinksList');
    if (viewLinksListEl) {
      viewLinksListEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">Loading...</p>';
      try {
        const { data: links, error: linksErr } = await supabase.rpc('list_view_links', { p_project_id: state.currentProjectId });
        viewLinksListEl.innerHTML = '';
        if (linksErr || !links || links.length === 0) {
          viewLinksListEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">No view links yet.</p>';
        } else {
          const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const base = window.location.origin + (window.location.pathname || '/');
          const baseUrl = base + (base.includes('?') ? '&' : '?') + 't=';
          links.forEach(function(l) {
            const div = document.createElement('div');
            div.className = 'share-view-link-row';
            div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;';
            const name = esc(l.name || 'View link');
            const date = l.created_at ? new Date(l.created_at).toLocaleString() : '';
            div.innerHTML = '<div style="flex:1;min-width:0;"><span style="font-weight:500;">' + name + '</span><div style="font-size:0.8rem;color:var(--text2);">' + date + '</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="settings-menu-btn share-view-link-copy" style="padding:4px 8px;font-size:0.85rem;" data-token="' + l.token + '" data-url="' + esc(baseUrl + l.token) + '">Copy URL</button><button type="button" class="settings-menu-btn share-view-link-log" style="padding:4px 8px;font-size:0.85rem;" data-id="' + l.id + '">Access log</button><button type="button" class="danger share-view-link-revoke" style="padding:4px 8px;font-size:0.85rem;border:none;cursor:pointer;" data-token="' + l.token + '">Revoke</button></div>';
            div.querySelector('.share-view-link-copy').onclick = function() {
              const url = this.dataset.url;
              navigator.clipboard.writeText(url).then(() => App.showToast('Copied to clipboard')).catch(() => App.showToast('Failed to copy'));
            };
            div.querySelector('.share-view-link-log').onclick = async function() {
              const id = this.dataset.id;
              const sb = App.getSupabase ? App.getSupabase() : null;
              if (!sb) return;
              const { data: log } = await sb.rpc('get_view_link_access_log', { p_view_link_id: id });
              const lines = (log || []).map(function(r) { return (r.email || '') + ' — ' + (r.accessed_at ? new Date(r.accessed_at).toLocaleString() : ''); });
              alert('Access log:\n\n' + (lines.length ? lines.join('\n') : 'No access yet'));
            };
            div.querySelector('.share-view-link-revoke').onclick = async function() {
              const tok = this.dataset.token;
              if (!confirm('Revoke this view link? It will stop working immediately.')) return;
              const sb = App.getSupabase ? App.getSupabase() : null;
              if (!sb) return;
              const { data: res } = await sb.rpc('revoke_view_link', { p_token: tok });
              if (res && res.ok) { App.onViewLinkRevoked && App.onViewLinkRevoked(); openShareProjectModal(); }
              else App.showToast((res && res.error) || 'Failed to revoke');
            };
            viewLinksListEl.appendChild(div);
          });
        }
      } catch (e) {
        viewLinksListEl.innerHTML = '<p style="color:var(--red);font-size:0.85rem;">Failed to load: ' + (e.message || 'Error') + '</p>';
      }
    }
  }

  (function() {
    const header = document.getElementById('shareViewLinksHeader');
    const content = document.getElementById('shareViewLinksContent');
    const icon = document.getElementById('shareViewLinksCollapseIcon');
    if (header && content && icon) {
      header.onclick = () => {
        const collapsed = content.classList.toggle('collapsed');
        icon.textContent = collapsed ? '▶' : '▼';
      };
    }
  })();

  document.getElementById('shareViewLinkCreate').onclick = async () => {
    const state = App.state;
    const supabase = App.getSupabase ? App.getSupabase() : null;
    if (!state.currentProjectId || !supabase) return;
    const btn = document.getElementById('shareViewLinkCreate');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    try {
      const { data, error } = await supabase.rpc('create_view_link', { p_project_id: state.currentProjectId, p_name: null, p_expires_at: null });
      if (error) throw new Error(error.message);
      if (data && data.ok && data.token) {
        const base = window.location.origin + (window.location.pathname || '/');
        const url = base + (base.includes('?') ? '&' : '?') + 't=' + data.token;
        navigator.clipboard.writeText(url).then(() => {
          App.showToast('View link created and copied to clipboard');
          openShareProjectModal();
        }).catch(() => {
          App.showToast('Link created: ' + url);
          openShareProjectModal();
        });
      } else {
        throw new Error((data && data.error) || 'Failed to create');
      }
    } catch (e) {
      App.showToast(e.message || 'Failed to create view link');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create view link';
    }
  };
  document.getElementById('shareProjectModalClose').onclick = () => App.hideModal('shareProjectModal');
  document.getElementById('shareProjectAdd').onclick = async () => {
    const state = App.state;
    const userSelect = document.getElementById('shareProjectUserSelect');
    const roleSel = document.getElementById('shareProjectRole');
    const errEl = document.getElementById('shareProjectError');
    const email = (userSelect.value || '').trim().toLowerCase();
    if (!email) {
      errEl.textContent = 'Select a user';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    try {
      const res = await fetch((App.SUPABASE_URL || '') + '/functions/v1/invite-to-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (state.supabaseSession?.access_token || '') },
        body: JSON.stringify({ project_id: state.currentProjectId, email: email, role: roleSel.value || 'viewer' })
      });
      const data = await res.json();
      if (data.ok) {
        userSelect.value = '';
        openShareProjectModal();
        App.showToast('Added ' + (data.email || email));
      } else {
        errEl.textContent = data.error || 'Failed to add user';
        errEl.style.display = 'block';
      }
    } catch (e) {
      errEl.textContent = e.message || 'Failed to add user';
      errEl.style.display = 'block';
    }
  };

  App.openShareProjectModal = openShareProjectModal;
})();

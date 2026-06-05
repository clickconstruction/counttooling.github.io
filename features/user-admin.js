/*
 * features/user-admin.js - the admin user-management modals, extracted from the
 * app.js IIFE as the twentieth feature-file split under the window.App registry
 * pattern. Three admin modals move together: the Manage User list
 * (#manageUserModal: list users via the list_users_for_admin RPC /
 * admin-list-users Edge Function, per-row Transfer + Delete + activity, with an
 * owned-project count column), the read-only All Users list (#allUsersModal), and
 * the Create User panel (#adminPanelModal: admin-create-user Edge Function).
 * Delete opens #deleteUserConfirmModal offering delete-projects-too OR
 * reassign-then-delete (admin-delete-user Edge Function, optional reassignToUserId).
 * The per-row Transfer action opens #transferProjectsModal (admin-reassign-projects
 * Edge Function) to move a user's projects to someone else without deleting them.
 *
 * Loaded as a classic <script src="features/user-admin.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared window.App
 * registry that app.js populates during its own load, registers
 * openManageUserModal + openAllUsersModal back onto App, and binds the
 * #manageUsersBtn / #adminCreateForm / modal-close handlers at this file's load.
 *
 * Scope is the admin user modals only. My Settings (#mySettingsModal, which owns
 * the airboard cloud-sync) and the User Activity modal (#userActivityModal) stay
 * in app.js; this feature reaches User Activity via App.openUserActivityModal and
 * reuses the publish-only App.SUPABASE_URL/SUPABASE_ANON_KEY,
 * App.formatLastSignIn (format.js global), and App.USER_ACTIVITY_ICON_SVG. The
 * #mySettingsManageUser/#mySettingsAllUsers openers stay in app.js (reaching the
 * feature via App.*); #mySettingsManageUsers opens the create-user panel via a DOM
 * #manageUsersBtn click.
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 * See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  // Latest admin user list (incl. project_count), captured by the Manage Users render so
  // the delete/transfer dialogs can populate their dropdowns + counts without a refetch.
  let lastUsers = [];
  let pendingDeleteUserId = null, pendingDeleteBtn = null, pendingTransferUserId = null, pendingSetPwUserId = null;
  const escHtml = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const TRANSFER_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21 9l-4-4v3H8v2h9v3l4-4zM3 15l4 4v-3h9v-2H7v-3l-4 4z"/></svg>';
  const KEY_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12.65 10A5.99 5.99 0 0 0 7 6a6 6 0 0 0 0 12 5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>';
  const EVENT_LABELS = {
    session_start: 'Signed in', project_open: 'Opened project', project_save: 'Saved project',
    export_pdf: 'Exported PDF', export_canvas: 'Exported canvas',
    counter_marker_added: 'Placed counter', line_added: 'Drew line'
  };
  const BREAKDOWN_ROWS = [
    ['Counters placed', 'counters_added'], ['Lines drawn', 'lines_added'],
    ['Project saves', 'project_saves'], ['Project opens', 'project_opens'],
    ['PDF exports', 'exports_pdf'], ['Canvas exports', 'exports_canvas'], ['Sessions', 'sessions']
  ];
  const projectCountNote = (u) => (u && u.project_count != null) ? ('Owns ' + u.project_count + ' project' + (u.project_count === 1 ? '' : 's') + '.') : '';

  function populateUserSelect(selectEl, excludeId) {
    const others = (lastUsers || []).filter((u) => u.id !== excludeId);
    if (!others.length) { selectEl.innerHTML = '<option value="">No other users</option>'; return; }
    selectEl.innerHTML = '<option value="">Select a user…</option>' +
      others.map((u) => '<option value="' + escHtml(u.id) + '">' + escHtml(u.email || u.id) + '</option>').join('');
  }

  function openManageUserModal() {
    const state = App.state;
    const listEl = document.getElementById('manageUserList');
    const session = state.supabaseSession;
    if (!session?.access_token) return;
    listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
    App.hideModal('mySettingsModal');
    App.showModal('manageUserModal');
    const headers = { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY };
    function fetchAndRender() {
      function tryEdgeFn() {
        fetch(App.SUPABASE_URL + '/functions/v1/admin-list-users', { method: 'GET', headers })
          .then(async (res) => {
            let data;
            try { data = await res.json(); } catch (_) { data = {}; }
            if (res.ok && data.users) renderList(data.users);
            else listEl.innerHTML = '<p style="color:var(--red);">' + ((data && data.error) || ('HTTP ' + res.status)).replace(/</g, '&lt;') + '</p>';
          }).catch((e) => { listEl.innerHTML = '<p style="color:var(--red);">' + ((e && e.message) || 'Network error').replace(/</g, '&lt;') + '</p>'; });
      }
      const rpcCtrl = new AbortController();
      setTimeout(() => rpcCtrl.abort(), 6000);
      fetch(App.SUPABASE_URL + '/rest/v1/rpc/list_users_for_admin', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}', signal: rpcCtrl.signal })
        .then(async (res) => {
          let data;
          try { data = await res.json(); } catch (_) { data = {}; }
          if (res.ok && Array.isArray(data)) { renderList(data); return; }
          tryEdgeFn();
        }).catch(() => tryEdgeFn());
    }
    function renderList(users) {
      lastUsers = users || [];
      if (!users || users.length === 0) {
        listEl.innerHTML = '<p style="color:var(--text3);">No users</p>';
        return;
      }
      const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const currentId = session.user?.id;
      const headerHtml = '<div class="settings-user-row settings-user-header">' +
        '<span class="settings-user-email">User</span>' +
        '<span class="settings-user-role">Role</span>' +
        '<span class="settings-user-count">Projects</span>' +
        '<span class="settings-user-dates"><span>Last sign-in</span><span>Last active</span></span>' +
        '<span class="settings-user-set-password-head"></span>' +
        '<span class="settings-user-transfer-head"></span>' +
        '<span class="settings-user-activity-head"></span>' +
        '<span class="settings-user-delete-head"></span>' +
        '</div>';
      listEl.innerHTML = headerHtml + users.map((u) => {
        const isSelf = u.id === currentId;
        return '<div class="settings-user-row" data-user-id="' + esc(u.id) + '">' +
          '<span class="settings-user-email" title="' + esc(u.email) + '">' + esc(u.email || '—') + '</span>' +
          '<span class="settings-user-role">' + (u.role || 'User') + '</span>' +
          '<span class="settings-user-count">' + (u.project_count == null ? '' : (u.project_count > 0 ? '<button type="button" class="settings-user-count-link" title="View projects" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + u.project_count + '</button>' : '0')) + '</span>' +
          '<button type="button" class="settings-user-dates settings-user-dates-btn" title="View activity" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' +
            '<span class="settings-user-last" title="Last sign-in">' + App.formatLastSignIn(u.last_sign_in_at) + '</span>' +
            '<span class="settings-user-last" title="Last active">' + App.formatLastSignIn(u.last_seen_at) + '</span>' +
          '</button>' +
          '<button type="button" class="settings-user-set-password" aria-label="Set password" title="Set password" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + KEY_ICON_SVG + '</button>' +
          '<button type="button" class="settings-user-transfer" aria-label="Transfer projects" title="Transfer projects" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + TRANSFER_ICON_SVG + '</button>' +
          '<button type="button" class="settings-user-activity" aria-label="View activity" title="View activity" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + App.USER_ACTIVITY_ICON_SVG + '</button>' +
          '<button type="button" class="settings-user-delete" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '"' + (isSelf ? ' disabled' : '') + '>Delete</button>' +
          '</div>';
      }).join('');
      listEl.querySelectorAll('.settings-user-activity').forEach((btn) => {
        btn.onclick = () => openUserActivityOverview(btn.dataset.userId, btn.dataset.email);
      });
      listEl.querySelectorAll('.settings-user-dates-btn').forEach((btn) => {
        btn.onclick = () => openUserActivityOverview(btn.dataset.userId, btn.dataset.email);
      });
      listEl.querySelectorAll('.settings-user-set-password').forEach((btn) => {
        btn.onclick = () => openSetPasswordModal(btn.dataset.userId, btn.dataset.email);
      });
      listEl.querySelectorAll('.settings-user-transfer').forEach((btn) => {
        btn.onclick = () => openTransferModal(btn.dataset.userId, btn.dataset.email);
      });
      listEl.querySelectorAll('.settings-user-count-link').forEach((btn) => {
        btn.onclick = () => openUserProjectsModal(btn.dataset.userId, btn.dataset.email);
      });
      listEl.querySelectorAll('.settings-user-delete:not([disabled])').forEach((btn) => {
        btn.onclick = () => deleteUser(btn.dataset.userId, btn.dataset.email, btn);
      });
    }
    fetchAndRender();
  }

  function openAllUsersModal() {
    const state = App.state;
    if (!state.isAdmin) return;
    const listEl = document.getElementById('allUsersList');
    const session = state.supabaseSession;
    if (!session?.access_token) {
      listEl.innerHTML = '<p style="color:var(--red);">Not authenticated. Please sign in again.</p>';
      App.hideModal('mySettingsModal');
      App.showModal('allUsersModal');
      return;
    }
    listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
    App.hideModal('mySettingsModal');
    App.showModal('allUsersModal');
    function renderUsers(list) {
      if (!list || list.length === 0) {
        listEl.innerHTML = '<p style="color:var(--text3);">No users</p>';
        return;
      }
      const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const headerHtml = '<div class="settings-user-row settings-user-header">' +
        '<span class="settings-user-email">User</span>' +
        '<span class="settings-user-role">Role</span>' +
        '<span class="settings-user-count">Projects</span>' +
        '<span class="settings-user-dates"><span>Last sign-in</span><span>Last active</span></span>' +
        '<span class="settings-user-activity-head"></span>' +
        '</div>';
      listEl.innerHTML = headerHtml + list.map((u) =>
        '<div class="settings-user-row">' +
        '<span class="settings-user-email" title="' + esc(u.email) + '">' + esc(u.email || '—') + '</span>' +
        '<span class="settings-user-role">' + (u.role || 'User') + '</span>' +
        '<span class="settings-user-count">' + (u.project_count == null ? '' : u.project_count) + '</span>' +
        '<span class="settings-user-dates">' +
        '<span class="settings-user-last" title="Last sign-in">' + App.formatLastSignIn(u.last_sign_in_at) + '</span>' +
        '<span class="settings-user-last" title="Last active">' + App.formatLastSignIn(u.last_seen_at) + '</span>' +
        '</span>' +
        '<button type="button" class="settings-user-activity" aria-label="View activity" title="View activity" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + App.USER_ACTIVITY_ICON_SVG + '</button>' +
        '</div>'
      ).join('');
      listEl.querySelectorAll('.settings-user-activity').forEach((btn) => {
        btn.onclick = () => openUserActivityOverview(btn.dataset.userId, btn.dataset.email);
      });
    }
    function showErr(msg, hint) {
      listEl.innerHTML = '<p style="color:var(--red);">' + (msg + '').replace(/</g, '&lt;') + '</p>' +
        (hint ? '<p style="font-size:12px;color:var(--text3);margin-top:8px;">' + hint + '</p>' : '');
    }
    const headers = { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY };
    function tryEdgeFn() {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 10000);
      fetch(App.SUPABASE_URL + '/functions/v1/admin-list-users', { method: 'GET', headers, signal: ctrl.signal })
        .then(async (res) => {
          let data;
          try { data = await res.json(); } catch (_) { data = {}; }
          if (res.ok && data.users) renderUsers(data.users);
          else showErr((data && data.error) || ('HTTP ' + res.status), 'Deploy: supabase functions deploy admin-list-users --no-verify-jwt');
        }).catch((e) => showErr((e && e.name === 'AbortError') ? 'Request timed out' : (e && e.message)));
    }
    const rpcCtrl = new AbortController();
    setTimeout(() => rpcCtrl.abort(), 6000);
    fetch(App.SUPABASE_URL + '/rest/v1/rpc/list_users_for_admin', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
      signal: rpcCtrl.signal
    }).then(async (res) => {
      let data;
      try { data = await res.json(); } catch (_) { data = {}; }
      if (res.ok && Array.isArray(data)) { renderUsers(data); return; }
      tryEdgeFn();
    }).catch(() => tryEdgeFn());
  }

  // Opens the delete dialog (delete-with-projects vs reassign-then-delete). The actual
  // request fires from submitDeleteUser when the admin confirms.
  function deleteUser(userId, email, btnEl) {
    pendingDeleteUserId = userId;
    pendingDeleteBtn = btnEl;
    const u = (lastUsers || []).find((x) => x.id === userId);
    document.getElementById('deleteUserName').textContent = email || userId;
    document.getElementById('deleteUserCountNote').textContent = projectCountNote(u);
    document.querySelectorAll('input[name="deleteUserMode"]').forEach((r) => { r.checked = r.value === 'delete'; });
    document.getElementById('deleteUserReassignGroup').style.display = 'none';
    const errEl = document.getElementById('deleteUserError'); errEl.style.display = 'none'; errEl.textContent = '';
    populateUserSelect(document.getElementById('deleteUserReassignSelect'), userId);
    const confirmBtn = document.getElementById('deleteUserConfirmBtn');
    confirmBtn.disabled = false; confirmBtn.textContent = 'Delete User';
    App.showModal('deleteUserConfirmModal');
  }

  function openTransferModal(userId, email) {
    pendingTransferUserId = userId;
    const u = (lastUsers || []).find((x) => x.id === userId);
    document.getElementById('transferFromName').textContent = email || userId;
    document.getElementById('transferCountNote').textContent = projectCountNote(u);
    populateUserSelect(document.getElementById('transferToSelect'), userId);
    const errEl = document.getElementById('transferError'); errEl.style.display = 'none'; errEl.textContent = '';
    const btn = document.getElementById('transferConfirmBtn'); btn.disabled = false; btn.textContent = 'Transfer';
    App.showModal('transferProjectsModal');
  }

  function openSetPasswordModal(userId, email) {
    pendingSetPwUserId = userId;
    document.getElementById('setPasswordUserName').textContent = email || userId;
    document.getElementById('setPasswordNew').value = '';
    document.getElementById('setPasswordConfirm').value = '';
    const errEl = document.getElementById('setPasswordError'); errEl.style.display = 'none'; errEl.textContent = '';
    const okEl = document.getElementById('setPasswordSuccess'); okEl.style.display = 'none'; okEl.textContent = '';
    const btn = document.getElementById('setPasswordConfirmBtn'); btn.disabled = false; btn.textContent = 'Set Password';
    App.showModal('setPasswordModal');
  }

  async function submitSetPassword() {
    const newPw = document.getElementById('setPasswordNew').value;
    const confirmPw = document.getElementById('setPasswordConfirm').value;
    const errEl = document.getElementById('setPasswordError');
    const okEl = document.getElementById('setPasswordSuccess');
    errEl.style.display = 'none'; okEl.style.display = 'none';
    if (!newPw || newPw.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; errEl.style.display = 'block'; return; }
    if (newPw !== confirmPw) { errEl.textContent = 'Passwords do not match'; errEl.style.display = 'block'; return; }
    const session = App.state.supabaseSession;
    if (!session?.access_token) return;
    const btn = document.getElementById('setPasswordConfirmBtn');
    btn.disabled = true; btn.textContent = 'Setting…';
    try {
      const res = await fetch(App.SUPABASE_URL + '/functions/v1/admin-set-password', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: pendingSetPwUserId, newPassword: newPw })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        okEl.textContent = 'Password updated. Share it with the user.'; okEl.style.display = 'block';
        document.getElementById('setPasswordNew').value = '';
        document.getElementById('setPasswordConfirm').value = '';
      } else {
        errEl.textContent = data.error || 'Failed to set password'; errEl.style.display = 'block';
      }
    } catch (e) {
      errEl.textContent = (e && e.message) || 'Failed to set password'; errEl.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = 'Set Password';
  }

  // Read-only: lists a single user's owned projects (name + last edit date), filtered
  // from the admin project list. Opened by clicking the project count in Manage Users.
  async function openUserProjectsModal(userId, email) {
    const listEl = document.getElementById('userProjectsList');
    document.getElementById('userProjectsSubtitle').textContent = email || userId || '';
    listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
    App.showModal('userProjectsModal');
    const session = App.state.supabaseSession;
    if (!session?.access_token) { listEl.innerHTML = '<p style="color:var(--red);">Not authenticated.</p>'; return; }
    const headers = { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    try {
      const res = await fetch(App.SUPABASE_URL + '/rest/v1/rpc/list_projects_for_admin', { method: 'POST', headers, body: '{}' });
      let data; try { data = await res.json(); } catch (_) { data = null; }
      if (!res.ok || !Array.isArray(data)) {
        listEl.innerHTML = '<p style="color:var(--red);">' + (((data && (data.message || data.error)) || ('HTTP ' + res.status)) + '').replace(/</g, '&lt;') + '</p>';
        return;
      }
      const mine = data.filter((p) => p.user_id === userId)
        .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
      document.getElementById('userProjectsSubtitle').textContent = (email || userId || '') + ' — ' + mine.length + ' project' + (mine.length === 1 ? '' : 's');
      if (!mine.length) { listEl.innerHTML = '<p style="color:var(--text3);">No projects</p>'; return; }
      listEl.innerHTML = mine.map((p) =>
        '<div class="settings-user-row settings-project-row">' +
        '<div class="settings-project-info">' +
        '<span class="settings-project-name" title="' + escHtml(p.name) + '">' + escHtml(p.name || 'Untitled') + '</span>' +
        '<div class="settings-project-meta">' + (p.updated_at ? 'Last edited ' + escHtml(new Date(p.updated_at).toLocaleString()) : 'No edit date') + '</div>' +
        '</div>' +
        '</div>'
      ).join('');
    } catch (e) {
      listEl.innerHTML = '<p style="color:var(--red);">' + (((e && e.message) || 'Network error') + '').replace(/</g, '&lt;') + '</p>';
    }
  }

  async function submitDeleteUser() {
    const mode = document.querySelector('input[name="deleteUserMode"]:checked')?.value || 'delete';
    const errEl = document.getElementById('deleteUserError');
    errEl.style.display = 'none';
    const body = { targetUserId: pendingDeleteUserId };
    if (mode === 'reassign') {
      const to = document.getElementById('deleteUserReassignSelect').value;
      if (!to) { errEl.textContent = 'Choose a user to reassign to.'; errEl.style.display = 'block'; return; }
      body.reassignToUserId = to;
    }
    const session = App.state.supabaseSession;
    if (!session?.access_token) return;
    const confirmBtn = document.getElementById('deleteUserConfirmBtn');
    confirmBtn.disabled = true; confirmBtn.textContent = mode === 'reassign' ? 'Reassigning…' : 'Deleting…';
    try {
      const res = await fetch(App.SUPABASE_URL + '/functions/v1/admin-delete-user', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        App.hideModal('deleteUserConfirmModal');
        if (pendingDeleteBtn) { const row = pendingDeleteBtn.closest('.settings-user-row'); if (row) row.remove(); }
        lastUsers = (lastUsers || []).filter((x) => x.id !== pendingDeleteUserId);
        const lst = document.getElementById('manageUserList');
        if (lst && !lst.querySelector('.settings-user-row:not(.settings-user-header)')) {
          lst.innerHTML = '<p style="color:var(--text3);">No users</p>';
        }
      } else {
        errEl.textContent = data.error || 'Delete failed'; errEl.style.display = 'block';
        confirmBtn.disabled = false; confirmBtn.textContent = 'Delete User';
      }
    } catch (e) {
      errEl.textContent = (e && e.message) || 'Delete failed'; errEl.style.display = 'block';
      confirmBtn.disabled = false; confirmBtn.textContent = 'Delete User';
    }
  }

  async function submitTransfer() {
    const to = document.getElementById('transferToSelect').value;
    const errEl = document.getElementById('transferError');
    errEl.style.display = 'none';
    if (!to) { errEl.textContent = 'Choose a user to transfer to.'; errEl.style.display = 'block'; return; }
    const session = App.state.supabaseSession;
    if (!session?.access_token) return;
    const btn = document.getElementById('transferConfirmBtn');
    btn.disabled = true; btn.textContent = 'Transferring…';
    try {
      const res = await fetch(App.SUPABASE_URL + '/functions/v1/admin-reassign-projects', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId: pendingTransferUserId, toUserId: to })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        App.hideModal('transferProjectsModal');
        openManageUserModal(); // refresh so both users' counts update
      } else {
        errEl.textContent = data.error || 'Transfer failed'; errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Transfer';
      }
    } catch (e) {
      errEl.textContent = (e && e.message) || 'Transfer failed'; errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Transfer';
    }
  }

  document.getElementById('manageUsersBtn').onclick = () => {
    document.getElementById('adminCreateEmail').value = '';
    document.getElementById('adminCreatePassword').value = '';
    document.getElementById('adminCreateError').style.display = 'none';
    document.getElementById('adminCreateSuccess').style.display = 'none';
    App.showModal('adminPanelModal');
  };
  document.getElementById('manageUsersBtnSidebar').onclick = () => document.getElementById('manageUsersBtn').click();
  document.getElementById('adminPanelClose').onclick = () => App.hideModal('adminPanelModal');
  // Rich per-user activity overview (clicking the dates cell or the heart icon). Pulls one
  // aggregated jsonb from user_activity_detail_for_admin and renders summary + timeline.
  function openUserActivityOverview(userId, email) {
    // Admins can view anyone; a regular user may view only their own (My Activity).
    const myId = App.state.supabaseSession?.user?.id;
    if (!App.state.isAdmin && userId !== myId) return;
    const session = App.state.supabaseSession;
    const body = document.getElementById('uaoBody');
    document.getElementById('uaoSubtitle').textContent = email || userId || '';
    body.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
    App.showModal('userActivityOverviewModal');
    if (!session?.access_token) { body.innerHTML = '<p style="color:var(--red);">Not authenticated.</p>'; return; }
    const headers = { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    fetch(App.SUPABASE_URL + '/rest/v1/rpc/user_activity_detail_for_admin', { method: 'POST', headers, body: JSON.stringify({ p_user_id: userId }) })
      .then(async (res) => {
        let d; try { d = await res.json(); } catch (_) { d = null; }
        if (!res.ok || !d || typeof d !== 'object') {
          const msg = (d && (d.message || d.error || d.hint)) || ('HTTP ' + res.status);
          body.innerHTML = '<p style="color:var(--red);">' + escHtml(String(msg)) + '</p>';
          return;
        }
        body.innerHTML = renderActivityHeader(d, email) + renderActivityTiles(d) + renderActivityWindows(d) + renderActivityBreakdown(d) + renderActivityTimeline(d);
      })
      .catch((e) => { body.innerHTML = '<p style="color:var(--red);">' + escHtml((e && e.message) || 'Network error') + '</p>'; });
  }
  function uaoTile(num, label) {
    return '<div class="ua-tile"><div class="ua-tile-num">' + (num || 0) + '</div><div class="ua-tile-label">' + label + '</div></div>';
  }
  function renderActivityHeader(d, email) {
    const member = d.member_since ? App.formatUserActivityDateTime(d.member_since) : '—';
    const n = d.project_count || 0;
    return '<div class="ua-overview-header">' +
      '<div><span style="font-weight:600;">' + escHtml(d.email || email || '') + '</span> <span class="ua-role-pill">' + escHtml(d.role || 'User') + '</span></div>' +
      '<div style="color:var(--text3);font-size:0.85rem;margin-top:4px;">Member since ' + escHtml(member) +
      ' · Owns ' + n + ' project' + (n === 1 ? '' : 's') +
      ' · Last sign-in ' + escHtml(App.formatLastSignIn(d.last_sign_in_at)) +
      ' · Last active ' + escHtml(App.formatLastSignIn(d.last_seen_at)) + '</div></div>';
  }
  function renderActivityTiles(d) {
    const b = d.breakdown || {};
    return '<div class="ua-tiles">' +
      uaoTile(d.total_events, 'Total events') +
      uaoTile(d.active_days_30d, 'Active days (30d)') +
      uaoTile(b.counters_added, 'Counters placed') +
      uaoTile(b.lines_added, 'Lines drawn') +
      uaoTile((b.exports_pdf || 0) + (b.exports_canvas || 0), 'Exports') +
      '</div>';
  }
  function renderActivityWindows(d) {
    return '<div class="ua-windows">' +
      '<span>Today <b>' + (d.events_1d || 0) + '</b></span>' +
      '<span>7 days <b>' + (d.events_7d || 0) + '</b></span>' +
      '<span>30 days <b>' + (d.events_30d || 0) + '</b></span>' +
      '<span>' + (d.distinct_projects_touched || 0) + ' projects touched</span>' +
      '</div>';
  }
  function renderActivityBreakdown(d) {
    const b = d.breakdown || {};
    const rows = BREAKDOWN_ROWS.map((r) => [r[0], b[r[1]] || 0]).filter((r) => r[1] > 0).sort((a, c) => c[1] - a[1]);
    if (!rows.length) return '';
    return '<div class="ua-section-title">What they do</div><div class="ua-breakdown">' +
      rows.map((r) => '<div class="ua-breakdown-row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join('') + '</div>';
  }
  const UA_TZ = 'America/Chicago'; // matches USER_ACTIVITY_TZ
  function uaDayKey(iso) { return new Intl.DateTimeFormat('en-CA', { timeZone: UA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); }
  function uaTime(iso) { return new Intl.DateTimeFormat('en-US', { timeZone: UA_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)); }
  function uaTimeRange(startIso, endIso) {
    const a = uaTime(startIso), b = uaTime(endIso);
    if (a === b) return b;
    if (a.slice(-2) === b.slice(-2)) return a.slice(0, -3) + '–' + b; // share AM/PM
    return a + ' – ' + b;
  }
  function uaDayLabel(key, todayKey, yestKey, sampleIso) {
    if (key === todayKey) return 'Today';
    if (key === yestKey) return 'Yesterday';
    return new Intl.DateTimeFormat('en-US', { timeZone: UA_TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(sampleIso));
  }
  function uaActionLabel(type, n) {
    switch (type) {
      case 'counter_marker_added': return n > 1 ? ('Placed ' + n + ' counters') : 'Placed a counter';
      case 'line_added': return n > 1 ? ('Drew ' + n + ' lines') : 'Drew a line';
      case 'project_save': return n > 1 ? ('Saved project ×' + n) : 'Saved project';
      case 'project_open': return n > 1 ? ('Opened project ×' + n) : 'Opened project';
      case 'export_pdf': return n > 1 ? ('Exported PDF ×' + n) : 'Exported PDF';
      case 'export_canvas': return n > 1 ? ('Exported canvas ×' + n) : 'Exported canvas';
      case 'session_start': return n > 1 ? ('Signed in ×' + n) : 'Signed in';
      default: return (EVENT_LABELS[type] || type) + (n > 1 ? (' ×' + n) : '');
    }
  }
  // Day-grouped, run-collapsed feed: turns a flat dump of micro-events into a readable
  // digest ("Placed 22 counters · Lobby · 9:12–9:31 AM" under Today/Yesterday headers).
  function renderActivityTimeline(d) {
    const items = Array.isArray(d.recent) ? d.recent : [];
    const title = '<div class="ua-section-title">Recent activity</div>';
    if (!items.length) return title + '<p style="color:var(--text3);">No activity recorded.</p>';
    const now = Date.now();
    const todayKey = uaDayKey(new Date(now).toISOString());
    const yestKey = uaDayKey(new Date(now - 86400000).toISOString());
    const days = []; const byKey = {};
    for (const it of items) { // items are newest-first
      const k = uaDayKey(it.created_at);
      if (!byKey[k]) { byKey[k] = { key: k, items: [] }; days.push(byKey[k]); }
      byKey[k].items.push(it);
    }
    let body = '';
    for (const day of days) {
      body += '<div class="ua-day-header">' + escHtml(uaDayLabel(day.key, todayKey, yestKey, day.items[0].created_at)) + '</div>';
      const runs = []; // collapse consecutive same action+project within the day
      for (const it of day.items) {
        const last = runs[runs.length - 1];
        const pid = it.project_id || null;
        if (last && last.type === it.event_type && last.projectId === pid) { last.count++; last.startIso = it.created_at; }
        else runs.push({ type: it.event_type, projectId: pid, projectName: it.project_name || null, count: 1, startIso: it.created_at, endIso: it.created_at });
      }
      for (const run of runs) {
        const proj = run.projectName ? ' · ' + escHtml(run.projectName) : '';
        const when = run.count > 1 ? uaTimeRange(run.startIso, run.endIso) : uaTime(run.endIso);
        const quiet = run.type === 'session_start' ? ' ua-event-quiet' : '';
        body += '<div class="settings-user-row settings-project-row' + quiet + '">' +
          '<div class="settings-project-info">' +
          '<span class="settings-project-name">' + escHtml(uaActionLabel(run.type, run.count)) + proj + '</span>' +
          '<div class="settings-project-meta">' + escHtml(when) + '</div>' +
          '</div></div>';
      }
    }
    return title + '<div class="settings-users-list" style="max-height:none;">' + body + '</div>';
  }

  document.getElementById('manageUserModalClose').onclick = () => App.hideModal('manageUserModal');
  document.querySelectorAll('input[name="deleteUserMode"]').forEach((r) => {
    r.onchange = () => {
      const mode = document.querySelector('input[name="deleteUserMode"]:checked')?.value;
      document.getElementById('deleteUserReassignGroup').style.display = mode === 'reassign' ? '' : 'none';
    };
  });
  document.getElementById('deleteUserCancel').onclick = () => App.hideModal('deleteUserConfirmModal');
  document.getElementById('deleteUserConfirmBtn').onclick = () => submitDeleteUser();
  document.getElementById('transferCancel').onclick = () => App.hideModal('transferProjectsModal');
  document.getElementById('transferConfirmBtn').onclick = () => submitTransfer();
  document.getElementById('setPasswordCancel').onclick = () => App.hideModal('setPasswordModal');
  document.getElementById('setPasswordForm').onsubmit = (e) => { e.preventDefault(); submitSetPassword(); };
  document.getElementById('userProjectsClose').onclick = () => App.hideModal('userProjectsModal');
  document.getElementById('uaoClose').onclick = () => App.hideModal('userActivityOverviewModal');
  const mySettingsMyActivityBtn = document.getElementById('mySettingsMyActivity');
  if (mySettingsMyActivityBtn) mySettingsMyActivityBtn.onclick = () => {
    const u = App.state.supabaseSession?.user;
    if (!u) return;
    App.hideModal('mySettingsModal');
    openUserActivityOverview(u.id, u.email);
  };
  const manageUserModalAllActivityBtn = document.getElementById('manageUserModalAllActivityBtn');
  if (manageUserModalAllActivityBtn) {
    manageUserModalAllActivityBtn.innerHTML = App.USER_ACTIVITY_ICON_SVG;
    manageUserModalAllActivityBtn.onclick = () => App.openUserActivityModal(null, null);
  }
  document.getElementById('allUsersModalClose').onclick = () => App.hideModal('allUsersModal');
  document.getElementById('adminCreateForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminCreateEmail').value.trim();
    const password = document.getElementById('adminCreatePassword').value;
    const errEl = document.getElementById('adminCreateError');
    const successEl = document.getElementById('adminCreateSuccess');
    errEl.style.display = 'none';
    successEl.style.display = 'none';
    if (!email || !password) {
      errEl.textContent = 'Email and password required';
      errEl.style.display = 'block';
      return;
    }
    const session = App.state.supabaseSession;
    if (!session?.access_token) return;
    try {
      const res = await fetch(App.SUPABASE_URL + '/functions/v1/admin-create-user', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();
      if (!res.ok) {
        errEl.textContent = json.error || 'Create failed';
        errEl.style.display = 'block';
        return;
      }
      successEl.textContent = 'User created. Share the password with them.';
      successEl.style.display = 'block';
      document.getElementById('adminCreateEmail').value = '';
      document.getElementById('adminCreatePassword').value = '';
    } catch (e) {
      errEl.textContent = e.message || 'Create failed';
      errEl.style.display = 'block';
    }
  };

  App.openManageUserModal = openManageUserModal;
  App.openAllUsersModal = openAllUsersModal;
})();

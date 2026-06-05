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
  let pendingDeleteUserId = null, pendingDeleteBtn = null, pendingTransferUserId = null;
  const escHtml = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const TRANSFER_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21 9l-4-4v3H8v2h9v3l4-4zM3 15l4 4v-3h9v-2H7v-3l-4 4z"/></svg>';
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
        '<span class="settings-user-transfer-head"></span>' +
        '<span class="settings-user-activity-head"></span>' +
        '<span class="settings-user-delete-head"></span>' +
        '</div>';
      listEl.innerHTML = headerHtml + users.map((u) => {
        const isSelf = u.id === currentId;
        return '<div class="settings-user-row" data-user-id="' + esc(u.id) + '">' +
          '<span class="settings-user-email" title="' + esc(u.email) + '">' + esc(u.email || '—') + '</span>' +
          '<span class="settings-user-role">' + (u.role || 'User') + '</span>' +
          '<span class="settings-user-count">' + (u.project_count == null ? '' : u.project_count) + '</span>' +
          '<span class="settings-user-dates">' +
            '<span class="settings-user-last" title="Last sign-in">' + App.formatLastSignIn(u.last_sign_in_at) + '</span>' +
            '<span class="settings-user-last" title="Last active">' + App.formatLastSignIn(u.last_seen_at) + '</span>' +
          '</span>' +
          '<button type="button" class="settings-user-transfer" aria-label="Transfer projects" title="Transfer projects" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + TRANSFER_ICON_SVG + '</button>' +
          '<button type="button" class="settings-user-activity" aria-label="View activity" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + App.USER_ACTIVITY_ICON_SVG + '</button>' +
          '<button type="button" class="settings-user-delete" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '"' + (isSelf ? ' disabled' : '') + '>Delete</button>' +
          '</div>';
      }).join('');
      listEl.querySelectorAll('.settings-user-activity').forEach((btn) => {
        btn.onclick = () => App.openUserActivityModal(btn.dataset.userId, btn.dataset.email);
      });
      listEl.querySelectorAll('.settings-user-transfer').forEach((btn) => {
        btn.onclick = () => openTransferModal(btn.dataset.userId, btn.dataset.email);
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
        '<button type="button" class="settings-user-activity" aria-label="View activity" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + App.USER_ACTIVITY_ICON_SVG + '</button>' +
        '</div>'
      ).join('');
      listEl.querySelectorAll('.settings-user-activity').forEach((btn) => {
        btn.onclick = () => App.openUserActivityModal(btn.dataset.userId, btn.dataset.email);
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

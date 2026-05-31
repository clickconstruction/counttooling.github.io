/*
 * features/user-admin.js - the admin user-management modals, extracted from the
 * app.js IIFE as the twentieth feature-file split under the window.App registry
 * pattern. Three admin modals move together: the Manage User list
 * (#manageUserModal: list users via the list_users_for_admin RPC /
 * admin-list-users Edge Function, per-row Delete + activity), the read-only All
 * Users list (#allUsersModal), and the Create User panel (#adminPanelModal:
 * admin-create-user Edge Function). Delete uses the admin-delete-user Edge
 * Function.
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
      if (!users || users.length === 0) {
        listEl.innerHTML = '<p style="color:var(--text3);">No users</p>';
        return;
      }
      const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const currentId = session.user?.id;
      listEl.innerHTML = users.map((u) => {
        const isSelf = u.id === currentId;
        return '<div class="settings-user-row" data-user-id="' + esc(u.id) + '">' +
          '<span class="settings-user-email" title="' + esc(u.email) + '">' + esc(u.email || '—') + '</span>' +
          '<span class="settings-user-role">' + (u.role || 'User') + '</span>' +
          '<span class="settings-user-last" title="Last sign-in">' + App.formatLastSignIn(u.last_sign_in_at) + '</span>' +
          '<span class="settings-user-last" title="Last active">' + App.formatLastSignIn(u.last_seen_at) + '</span>' +
          '<button type="button" class="settings-user-activity" aria-label="View activity" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + App.USER_ACTIVITY_ICON_SVG + '</button>' +
          '<button type="button" class="settings-user-delete" data-user-id="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '"' + (isSelf ? ' disabled' : '') + '>Delete</button>' +
          '</div>';
      }).join('');
      listEl.querySelectorAll('.settings-user-activity').forEach((btn) => {
        btn.onclick = () => App.openUserActivityModal(btn.dataset.userId, btn.dataset.email);
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
      listEl.innerHTML = list.map((u) =>
        '<div class="settings-user-row">' +
        '<span class="settings-user-email" title="' + esc(u.email) + '">' + esc(u.email || '—') + '</span>' +
        '<span class="settings-user-role">' + (u.role || 'User') + '</span>' +
        '<span class="settings-user-last" title="Last sign-in">' + App.formatLastSignIn(u.last_sign_in_at) + '</span>' +
        '<span class="settings-user-last" title="Last active">' + App.formatLastSignIn(u.last_seen_at) + '</span>' +
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

  async function deleteUser(userId, email, btnEl) {
    if (!confirm('Delete ' + (email || userId) + '? This cannot be undone.')) return;
    const session = App.state.supabaseSession;
    if (!session?.access_token) return;
    btnEl.disabled = true;
    btnEl.textContent = 'Deleting…';
    try {
      const res = await fetch(App.SUPABASE_URL + '/functions/v1/admin-delete-user', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const row = btnEl.closest('.settings-user-row');
        row.remove();
        if (!document.getElementById('manageUserList').querySelector('.settings-user-row')) {
          document.getElementById('manageUserList').innerHTML = '<p style="color:var(--text3);">No users</p>';
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

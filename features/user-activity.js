/*
 * features/user-activity.js - the admin User Activity modal, extracted from
 * the app.js IIFE as the thirty-third feature-file split under the window.App
 * registry pattern — the last rung of the modal ladder. The whole raw-log
 * surface moves: `openUserActivityModal` (per-user events via
 * `list_user_activity_for_admin`, or the all-users view), the Events/Summary
 * view toggle (`list_user_activity_summary_for_admin`), the user-select
 * dropdown, the client-side filter (over the `state.userActivityAllRowsCache`
 * the loaders fill), and the modal close binding. The rich per-user
 * **overview** modal (`openUserActivityOverview`) already lives in
 * features/user-admin.js, which keeps reaching this raw log via
 * App.openUserActivityModal — the registration **re-homes** here from
 * app.js's registry tail (the pdf-bundle pattern), so load order between the
 * two files stays irrelevant.
 *
 * Loaded as a classic <script src="/features/user-activity.js"> AFTER app.js.
 * Its own IIFE: raw fetch()es against the admin RPCs using the published
 * App.SUPABASE_URL/App.SUPABASE_ANON_KEY + the session token from App.state
 * (matching the original code — these calls never used supabase-js, so no
 * getSupabase() is needed). The pure formatters stay in format.js; the three
 * this split consumes (`filterUserActivityRows`,
 * `renderUserActivityAllUsersTableHtml`, `formatLastSignInUserActivity`) are
 * newly published on App alongside the existing formatUserActivityDateTime,
 * because format.js globals are lint-invisible to the features eslint group.
 * The `userActivitySelectSuppress` flag moves as a private `let`.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  let userActivitySelectSuppress = false;

  function applyUserActivityFilter() {
    const state = App.state;
    const listEl = document.getElementById('userActivityList');
    const filterInp = document.getElementById('userActivityFilterInput');
    const toolbar = document.getElementById('userActivityToolbar');
    if (!listEl || !toolbar || toolbar.classList.contains('user-activity-toolbar-hidden')) return;
    if (!Array.isArray(state.userActivityAllRowsCache)) return;
    const q = filterInp ? filterInp.value : '';
    const filtered = App.filterUserActivityRows(state.userActivityAllRowsCache, q);
    if (filtered.length === 0 && state.userActivityAllRowsCache.length > 0) {
      listEl.innerHTML = '<p style="color:var(--text3);">No rows match your filter.</p>';
      return;
    }
    if (filtered.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text3);">No activity recorded.</p>';
      return;
    }
    listEl.innerHTML = App.renderUserActivityAllUsersTableHtml(filtered);
  }

  function populateUserActivityUserSelect(users, listOk) {
    const sel = document.getElementById('userActivityUserSelect');
    const hint = document.getElementById('userActivityUserListHint');
    if (!sel) return;
    userActivitySelectSuppress = true;
    const esc = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let html = '<option value="">All users (latest)</option>';
    if (listOk && Array.isArray(users) && users.length) {
      const sorted = users.slice().sort((a, b) => String(a.email || '').localeCompare(String(b.email || ''), undefined, { sensitivity: 'base' }));
      sorted.forEach((u) => {
        html += '<option value="' + esc(u.id) + '" data-email="' + esc(u.email || '') + '">' + esc(u.email || '—') + '</option>';
      });
    }
    sel.innerHTML = html;
    sel.value = '';
    userActivitySelectSuppress = false;
    if (hint) {
      if (!listOk) {
        hint.textContent = 'Could not load user list; use Filter to narrow activity.';
        hint.style.display = 'block';
      } else {
        hint.textContent = '';
        hint.style.display = 'none';
      }
    }
  }

  function syncUserActivityViewToggleUI() {
    const ev = document.getElementById('userActivityViewEventsBtn');
    const sum = document.getElementById('userActivityViewSummaryBtn');
    const mode = App.state.userActivityViewMode;
    if (ev) ev.setAttribute('aria-pressed', mode === 'events' ? 'true' : 'false');
    if (sum) sum.setAttribute('aria-pressed', mode === 'summary' ? 'true' : 'false');
  }

  function renderUserActivitySummaryTableHtml(rows) {
    const esc = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const head = '<thead><tr><th>Email</th><th title="Relative labels use US Central (Chicago) calendar days">Last sign-in</th><th>1 day</th><th>7 days</th><th>30 days</th></tr></thead>';
    const body = rows.map((row) => {
      const signIn = esc(App.formatLastSignInUserActivity(row.last_sign_in_at));
      const e1 = row.events_1d != null ? String(row.events_1d) : '0';
      const e7 = row.events_7d != null ? String(row.events_7d) : '0';
      const e30 = row.events_30d != null ? String(row.events_30d) : '0';
      return '<tr><td>' + esc(row.email) + '</td><td>' + signIn + '</td><td>' + esc(e1) + '</td><td>' + esc(e7) + '</td><td>' + esc(e30) + '</td></tr>';
    }).join('');
    return '<table class="user-activity-table user-activity-summary-table">' + head + '<tbody>' + body + '</tbody></table>';
  }

  function loadUserActivityAllUsersContent() {
    const state = App.state;
    const session = state.supabaseSession;
    if (!session?.access_token) return;
    const listEl = document.getElementById('userActivityList');
    const toolbar = document.getElementById('userActivityToolbar');
    const filterInp = document.getElementById('userActivityFilterInput');
    const subEl = document.getElementById('userActivityModalSubtitle');
    const headers = { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (subEl) {
      subEl.textContent = state.userActivityViewMode === 'summary'
        ? 'Per-user event counts (rolling windows) and last sign-in. Days are in CST not UTC.'
        : 'Latest events across all users (newest first). Event times are US Central (Chicago).';
    }
    if (state.userActivityViewMode === 'summary') {
      state.userActivityAllRowsCache = null;
      if (toolbar) toolbar.classList.add('user-activity-toolbar-hidden');
      if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
      fetch(App.SUPABASE_URL + '/rest/v1/rpc/list_user_activity_summary_for_admin', {
        method: 'POST',
        headers: headers,
        body: '{}'
      }).then(async (res) => {
        let data;
        try { data = await res.json(); } catch (_) { data = []; }
        if (!res.ok) {
          const msg = (data && (data.message || data.error || data.hint)) ? String(data.message || data.error || data.hint) : ('HTTP ' + res.status);
          if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + msg.replace(/</g, '&lt;') + '</p>';
          return;
        }
        const rows = Array.isArray(data) ? data : [];
        if (rows.length === 0) {
          if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">No users.</p>';
          return;
        }
        if (listEl) listEl.innerHTML = renderUserActivitySummaryTableHtml(rows);
      }).catch((e) => {
        if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + ((e && e.message) || 'Network error').replace(/</g, '&lt;') + '</p>';
      });
      return;
    }
    if (toolbar) toolbar.classList.remove('user-activity-toolbar-hidden');
    if (filterInp) filterInp.value = '';
    if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
    const payload = { p_limit: 500, p_user_id: null, p_since: null };
    const actFetch = fetch(App.SUPABASE_URL + '/rest/v1/rpc/list_user_activity_for_admin', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    const usrFetch = fetch(App.SUPABASE_URL + '/rest/v1/rpc/list_users_for_admin', {
      method: 'POST',
      headers: headers,
      body: '{}'
    });
    Promise.all([actFetch, usrFetch]).then(async ([actRes, usrRes]) => {
      let actData;
      let usrData;
      try { actData = await actRes.json(); } catch (_) { actData = []; }
      try { usrData = await usrRes.json(); } catch (_) { usrData = []; }
      const usersOk = usrRes.ok && Array.isArray(usrData);
      populateUserActivityUserSelect(usersOk ? usrData : [], usersOk);
      if (!actRes.ok) {
        state.userActivityAllRowsCache = null;
        const msg = (actData && (actData.message || actData.error || actData.hint)) ? String(actData.message || actData.error || actData.hint) : ('HTTP ' + actRes.status);
        if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + msg.replace(/</g, '&lt;') + '</p>';
        if (toolbar) toolbar.classList.add('user-activity-toolbar-hidden');
        return;
      }
      const data = Array.isArray(actData) ? actData : [];
      state.userActivityAllRowsCache = data;
      if (data.length === 0) {
        if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">No activity recorded.</p>';
        return;
      }
      if (listEl) listEl.innerHTML = App.renderUserActivityAllUsersTableHtml(App.filterUserActivityRows(data, filterInp ? filterInp.value : ''));
    }).catch((e) => {
      state.userActivityAllRowsCache = null;
      if (toolbar) toolbar.classList.add('user-activity-toolbar-hidden');
      if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + ((e && e.message) || 'Network error').replace(/</g, '&lt;') + '</p>';
    });
  }

  function openUserActivityModal(userId, email) {
    const state = App.state;
    const session = state.supabaseSession;
    if (!session?.access_token || !state.isAdmin) return;
    const allUsers = userId == null;
    const titleEl = document.getElementById('userActivityModalTitle');
    const listEl = document.getElementById('userActivityList');
    const subEl = document.getElementById('userActivityModalSubtitle');
    const toolbar = document.getElementById('userActivityToolbar');
    const filterInp = document.getElementById('userActivityFilterInput');
    const viewToggle = document.getElementById('userActivityModalViewToggle');
    if (titleEl) titleEl.textContent = allUsers ? 'All user activity' : 'User activity';
    if (subEl) {
      if (allUsers) subEl.textContent = 'Latest events across all users (newest first).';
      else subEl.textContent = (email ? ('Activity for ' + email) : String(userId)) + ' Event times are US Central (Chicago).';
    }
    if (!allUsers) {
      state.userActivityAllRowsCache = null;
      if (toolbar) toolbar.classList.add('user-activity-toolbar-hidden');
      if (viewToggle) viewToggle.classList.add('user-activity-view-toggle-hidden');
    } else {
      state.userActivityViewMode = 'events';
      if (viewToggle) viewToggle.classList.remove('user-activity-view-toggle-hidden');
      syncUserActivityViewToggleUI();
      if (filterInp) filterInp.value = '';
    }
    if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">Loading…</p>';
    App.showModal('userActivityModal');
    const headers = { 'Authorization': 'Bearer ' + session.access_token, 'apikey': App.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (!allUsers) {
      const payload = { p_limit: 200, p_user_id: userId, p_since: null };
      fetch(App.SUPABASE_URL + '/rest/v1/rpc/list_user_activity_for_admin', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      }).then(async (res) => {
        let data;
        try { data = await res.json(); } catch (_) { data = []; }
        if (!res.ok) {
          const msg = (data && (data.message || data.error || data.hint)) ? String(data.message || data.error || data.hint) : ('HTTP ' + res.status);
          if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + msg.replace(/</g, '&lt;') + '</p>';
          return;
        }
        if (!Array.isArray(data) || data.length === 0) {
          if (listEl) listEl.innerHTML = '<p style="color:var(--text3);">No activity recorded.</p>';
          return;
        }
        const esc = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        if (listEl) {
          listEl.innerHTML = data.map((row) => {
            const when = row.created_at ? App.formatUserActivityDateTime(row.created_at) : '—';
            let meta;
            try { meta = row.metadata && typeof row.metadata === 'object' ? JSON.stringify(row.metadata) : String(row.metadata || ''); } catch (_) { meta = ''; }
            return '<div class="settings-user-row" style="flex-wrap:wrap;align-items:flex-start;">' +
              '<span style="min-width:120px;font-weight:600;">' + esc(row.event_type) + '</span>' +
              '<span style="color:var(--text3);min-width:150px;">' + esc(when) + '</span>' +
              '<span style="color:var(--text2);flex:1;word-break:break-all;">' + esc(meta) + '</span>' +
              '</div>';
          }).join('');
        }
      }).catch((e) => {
        if (listEl) listEl.innerHTML = '<p style="color:var(--red);">' + ((e && e.message) || 'Network error').replace(/</g, '&lt;') + '</p>';
      });
      return;
    }
    loadUserActivityAllUsersContent();
  }

  document.getElementById('userActivityModalClose').onclick = () => App.hideModal('userActivityModal');
  const userActivityUserSelect = document.getElementById('userActivityUserSelect');
  if (userActivityUserSelect) {
    userActivityUserSelect.onchange = function () {
      if (userActivitySelectSuppress) return;
      const v = this.value;
      if (v === '') openUserActivityModal(null, null);
      else {
        const opt = this.options[this.selectedIndex];
        const em = opt && opt.dataset ? opt.dataset.email : '';
        openUserActivityModal(v, em || '');
      }
    };
  }
  const userActivityFilterInput = document.getElementById('userActivityFilterInput');
  if (userActivityFilterInput) {
    userActivityFilterInput.addEventListener('input', () => applyUserActivityFilter());
  }
  const userActivityFilterClear = document.getElementById('userActivityFilterClear');
  if (userActivityFilterClear) {
    userActivityFilterClear.onclick = () => {
      if (userActivityFilterInput) userActivityFilterInput.value = '';
      applyUserActivityFilter();
    };
  }
  const userActivityViewEventsBtn = document.getElementById('userActivityViewEventsBtn');
  const userActivityViewSummaryBtn = document.getElementById('userActivityViewSummaryBtn');
  if (userActivityViewEventsBtn) {
    userActivityViewEventsBtn.onclick = () => {
      const state = App.state;
      if (state.userActivityViewMode === 'events') return;
      state.userActivityViewMode = 'events';
      syncUserActivityViewToggleUI();
      loadUserActivityAllUsersContent();
    };
  }
  if (userActivityViewSummaryBtn) {
    userActivityViewSummaryBtn.onclick = () => {
      const state = App.state;
      if (state.userActivityViewMode === 'summary') return;
      state.userActivityViewMode = 'summary';
      syncUserActivityViewToggleUI();
      loadUserActivityAllUsersContent();
    };
  }

  // Re-homed registration: features/user-admin.js keeps consuming
  // App.openUserActivityModal at call time.
  App.openUserActivityModal = openUserActivityModal;
})();

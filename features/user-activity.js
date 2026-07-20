/*
 * features/user-activity.js - the admin User Activity modal, extracted from
 * the app.js IIFE as the thirty-third feature-file split under the window.App
 * registry pattern — the last rung of the modal ladder. The whole raw-log
 * surface moves: `openUserActivityModal` (per-user events via
 * `list_user_activity_for_admin`, or the all-users view), the Events/Summary
 * view toggle (`list_user_activity_summary_for_admin`), the user-select
 * dropdown, the client-side filter (over the `state.userActivityAllRowsCache`
 * the loaders fill), and the modal close binding. The rich per-user
 * **overview** modal (`openUserActivityOverview`, #userActivityOverviewModal)
 * also lives HERE (moved from features/user-admin.js so both activity
 * surfaces share one file — it is not admin-only: My Settings -> My Activity
 * opens it for the signed-in user). user-admin.js reaches both via
 * App.openUserActivityModal / App.openUserActivityOverview at call time —
 * registrations re-home here (the pdf-bundle pattern), so load order between
 * the two files stays irrelevant.
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
    const esc = (s) => App.escapeHtml(s);
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
    const esc = (s) => App.escapeHtml(s);
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
        const esc = (s) => App.escapeHtml(s);
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

  // --- Rich per-user activity OVERVIEW modal (#userActivityOverviewModal) ---
  // Moved here from features/user-admin.js so both activity surfaces live in
  // one file (this file's raw log + the aggregated overview). Not admin-only:
  // a regular user reaches it via My Settings -> My Activity for their own id.
  const ovEsc = (s) => App.escapeHtml(s);
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
          body.innerHTML = '<p style="color:var(--red);">' + ovEsc(String(msg)) + '</p>';
          return;
        }
        body.innerHTML = renderActivityHeader(d, email) + renderActivityTiles(d) + renderActivityWindows(d) + renderActivityBreakdown(d) + renderActivityTimeline(d);
      })
      .catch((e) => { body.innerHTML = '<p style="color:var(--red);">' + ovEsc((e && e.message) || 'Network error') + '</p>'; });
  }
  function uaoTile(num, label) {
    return '<div class="ua-tile"><div class="ua-tile-num">' + (num || 0) + '</div><div class="ua-tile-label">' + label + '</div></div>';
  }
  function renderActivityHeader(d, email) {
    const member = d.member_since ? App.formatUserActivityDateTime(d.member_since) : '—';
    const n = d.project_count || 0;
    return '<div class="ua-overview-header">' +
      '<div><span style="font-weight:600;">' + ovEsc(d.email || email || '') + '</span> <span class="ua-role-pill">' + ovEsc(d.role || 'User') + '</span></div>' +
      '<div style="color:var(--text3);font-size:0.85rem;margin-top:4px;">Member since ' + ovEsc(member) +
      ' · Owns ' + n + ' project' + (n === 1 ? '' : 's') +
      ' · Last sign-in ' + ovEsc(App.formatLastSignIn(d.last_sign_in_at)) +
      ' · Last active ' + ovEsc(App.formatLastSignIn(d.last_seen_at)) + '</div></div>';
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
      body += '<div class="ua-day-header">' + ovEsc(uaDayLabel(day.key, todayKey, yestKey, day.items[0].created_at)) + '</div>';
      const runs = []; // collapse consecutive same action+project within the day
      for (const it of day.items) {
        const last = runs[runs.length - 1];
        const pid = it.project_id || null;
        if (last && last.type === it.event_type && last.projectId === pid) { last.count++; last.startIso = it.created_at; }
        else runs.push({ type: it.event_type, projectId: pid, projectName: it.project_name || null, count: 1, startIso: it.created_at, endIso: it.created_at });
      }
      for (const run of runs) {
        const proj = run.projectName ? ' · ' + ovEsc(run.projectName) : '';
        const when = run.count > 1 ? uaTimeRange(run.startIso, run.endIso) : uaTime(run.endIso);
        const quiet = run.type === 'session_start' ? ' ua-event-quiet' : '';
        body += '<div class="settings-user-row settings-project-row' + quiet + '">' +
          '<div class="settings-project-info">' +
          '<span class="settings-project-name">' + ovEsc(uaActionLabel(run.type, run.count)) + proj + '</span>' +
          '<div class="settings-project-meta">' + ovEsc(when) + '</div>' +
          '</div></div>';
      }
    }
    return title + '<div class="settings-users-list" style="max-height:none;">' + body + '</div>';
  }

  document.getElementById('uaoClose').onclick = () => App.hideModal('userActivityOverviewModal');
  const mySettingsMyActivityBtn = document.getElementById('mySettingsMyActivity');
  if (mySettingsMyActivityBtn) mySettingsMyActivityBtn.onclick = () => {
    const u = App.state.supabaseSession?.user;
    if (!u) return;
    App.hideModal('mySettingsModal');
    openUserActivityOverview(u.id, u.email);
  };

  // Registered for features/user-admin.js's row buttons (call-time resolution).
  App.openUserActivityOverview = openUserActivityOverview;

  // Re-homed registration: features/user-admin.js keeps consuming
  // App.openUserActivityModal at call time.
  App.openUserActivityModal = openUserActivityModal;
})();

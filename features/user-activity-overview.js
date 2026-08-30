/*
 * features/user-activity-overview.js - the rich per-user activity OVERVIEW
 * modal (#userActivityOverviewModal), split out of features/user-activity.js
 * at that file's documented domain seam (the raw admin log and the aggregated
 * overview shared zero symbols). Not admin-only: My Settings -> My Activity
 * opens it for the signed-in user (the #mySettingsMyActivity binding lives
 * here); features/user-admin.js's row buttons reach it via
 * App.openUserActivityOverview at call time, so load order is irrelevant.
 *
 * Loaded as a classic <script src="/features/user-activity-overview.js">
 * AFTER app.js. Raw fetch()es against the admin RPCs using the published
 * App.SUPABASE_URL/App.SUPABASE_ANON_KEY + the session token from App.state
 * (these calls never used supabase-js). Boundary rule: read shared deps from
 * App.* at call time, never captured at load. See ARCHITECTURE.md "Feature
 * files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  // --- Rich per-user activity OVERVIEW modal (#userActivityOverviewModal) ---
  // Moved here from features/user-admin.js so both activity surfaces live in
  // one file (this file's raw log + the aggregated overview). Not admin-only:
  // a regular user reaches it via My Settings -> My Activity for their own id.
  const ovEsc = (s) => App.escapeHtml(s);
  const EVENT_LABELS = {
    session_start: 'Signed in', project_open: 'Opened project', project_save: 'Saved project',
    export_pdf: 'Exported PDF', export_canvas: 'Exported canvas',
    counter_marker_added: 'Placed counter', line_added: 'Drew line',
    copy_summary: 'Copied summary', unscaled_ft_block: 'Blocked unscaled export',
    prepare_trim: 'Trimmed a plan set'
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
      '<div><span style="font-weight:600;">' + ovEsc(d.email || email || '') + '</span>' + (App.twinBadgeHtml ? App.twinBadgeHtml(d.email || email) : '') + ' <span class="ua-role-pill">' + ovEsc(d.role || 'User') + '</span></div>' +
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
      case 'copy_summary': return n > 1 ? ('Copied summary ×' + n) : 'Copied summary';
      case 'unscaled_ft_block': return n > 1 ? ('Blocked unscaled export ×' + n) : 'Blocked unscaled export';
      case 'prepare_trim': return n > 1 ? ('Trimmed plan set ×' + n) : 'Trimmed a plan set';
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
})();

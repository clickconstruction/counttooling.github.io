/*
 * format.js - Pure date/time/text formatting helpers for ClickCount, extracted
 * verbatim from the main app.js IIFE.
 *
 * Loaded as a classic <script src="format.js"> in <head>, AFTER constants.js
 * (whose USER_ACTIVITY_TZ it reads by bare name) and BEFORE app.js (which
 * resolves these functions by bare name). These top-level declarations live in
 * the shared global lexical scope.
 *
 * Everything here is context-free: no reference to `state`, the DOM, or any
 * closure-scoped helper. The DOM-coupled User Activity modal code that consumes
 * these (applyUserActivityFilter, populateUserActivityUserSelect, etc.) stays in
 * app.js. No build step.
 */

  // THE canonical HTML escaper (full superset: & < > " '). The codebase once
  // carried 27 inline copies in four behavioral variants — some skipped the
  // quote entities, an attribute-injection foot-gun whenever a copy was pasted
  // into a new context. All call sites now route here: app.js reads it by bare
  // name, feature files via App.escapeHtml (format.js globals are invisible to
  // their lint group). Escaping is a superset of every prior variant, so text
  // contexts render identically. (report.js keeps its own — it is part of that
  // file's exported CommonJS test contract.)
  function escapeHtml(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatLastSignIn(ts) {
    if (!ts) return 'Never';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return diffDays + ' days ago';
    if (diffDays < 30) return Math.floor(diffDays / 7) + ' weeks ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  }

  function dateKeyInTimeZone(isoOrTs, timeZone) {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoOrTs));
  }

  function calendarDaysFromSignInToNowInZone(signKey, nowKey) {
    const [sy, sm, sd] = signKey.split('-').map(Number);
    const [ny, nm, nd] = nowKey.split('-').map(Number);
    const s = Date.UTC(sy, sm - 1, sd);
    const n = Date.UTC(ny, nm - 1, nd);
    return Math.round((n - s) / 86400000);
  }

  function formatLastSignInUserActivity(ts) {
    if (!ts) return 'Never';
    const d = new Date(ts);
    const signKey = dateKeyInTimeZone(ts, USER_ACTIVITY_TZ);
    const nowKey = dateKeyInTimeZone(Date.now(), USER_ACTIVITY_TZ);
    const diff = calendarDaysFromSignInToNowInZone(signKey, nowKey);
    if (diff < 0) {
      const ySign = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: USER_ACTIVITY_TZ, year: 'numeric' }).format(d), 10);
      const yNow = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: USER_ACTIVITY_TZ, year: 'numeric' }).format(new Date()), 10);
      return d.toLocaleDateString('en-US', { timeZone: USER_ACTIVITY_TZ, month: 'short', day: 'numeric', year: ySign !== yNow ? 'numeric' : undefined });
    }
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return diff + ' days ago';
    if (diff < 30) return Math.floor(diff / 7) + ' weeks ago';
    const ySign = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: USER_ACTIVITY_TZ, year: 'numeric' }).format(d), 10);
    const yNow = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: USER_ACTIVITY_TZ, year: 'numeric' }).format(new Date()), 10);
    return d.toLocaleDateString('en-US', { timeZone: USER_ACTIVITY_TZ, month: 'short', day: 'numeric', year: ySign !== yNow ? 'numeric' : undefined });
  }

  function formatUserActivityDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { timeZone: USER_ACTIVITY_TZ, dateStyle: 'short', timeStyle: 'short' });
  }

  function filterUserActivityRows(rows, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const email = String(row.email || '').toLowerCase();
      const ev = String(row.event_type || '').toLowerCase();
      let meta;
      try { meta = row.metadata && typeof row.metadata === 'object' ? JSON.stringify(row.metadata) : String(row.metadata || ''); } catch (_) { meta = ''; }
      return email.includes(q) || ev.includes(q) || meta.toLowerCase().includes(q);
    });
  }

  function renderUserActivityAllUsersTableHtml(rows) {
    const esc = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const head = '<thead><tr><th>Email</th><th>Event</th><th title="US Central (Chicago)">Time</th><th>Project</th><th>Details</th></tr></thead>';
    const body = rows.map((row) => {
      const when = row.created_at ? formatUserActivityDateTime(row.created_at) : '—';
      let meta;
      try { meta = row.metadata && typeof row.metadata === 'object' ? JSON.stringify(row.metadata) : String(row.metadata || ''); } catch (_) { meta = ''; }
      const pid = row.project_id ? String(row.project_id) : '—';
      return '<tr><td>' + esc(row.email) + '</td><td>' + esc(row.event_type) + '</td><td>' + esc(when) + '</td><td>' + esc(pid) + '</td><td class="col-meta">' + esc(meta) + '</td></tr>';
    }).join('');
    return '<table class="user-activity-table">' + head + '<tbody>' + body + '</tbody></table>';
  }

  // Node test harness only: in a classic browser <script> `module` is undefined,
  // so this is a no-op there and the declarations above stay plain globals.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      escapeHtml,
      formatLastSignIn,
      dateKeyInTimeZone,
      calendarDaysFromSignInToNowInZone,
      formatLastSignInUserActivity,
      formatUserActivityDateTime,
      filterUserActivityRows,
      renderUserActivityAllUsersTableHtml,
    };
  }

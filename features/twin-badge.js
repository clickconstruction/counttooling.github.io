(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/twin-badge.js - digital-twin visibility (PipeTooling
   * docs/DIGITAL_TWINS_PLAN.md, Phase E2 - the CountTooling half). Twins are
   * agent-operated accounts that do real takeoffs; the program's review loop
   * only works if a twin is never mistaken for a person. Two surfaces:
   *
   *   1. Own session - `renderTwinBanner` shows the top chrome banner whenever
   *      `state.isDigitalTwin` (read from profiles.is_digital_twin alongside
   *      is_admin at every auth site in app.js). Driven from updateUI.
   *   2. Other people - `twinBadgeHtml` / `twinEmailText` badge a twin's email
   *      wherever a collaboration surface names one: the checkout holder
   *      (header status, status bar, Load Project, Manage Projects), project
   *      shares, and the admin user list.
   *
   * Identifying somebody ELSE as a twin has two sources and we accept either:
   *   - `is_digital_twin` from the row, when the surface has it (the admin user
   *     list; the truthful source, but it costs an RPC/edge-function field).
   *   - the fleet email pattern, everywhere else - checkout and share rows carry
   *     only an email. twin-login enforces this pattern as its own guard #2, so
   *     any twin it can mint matches. The role segment is left open (`<role>`)
   *     rather than pinned to `estimator` so a later role rollout does not
   *     silently stop badging.
   * Neither source is authoritative alone, so `isTwinUser` ORs them.
   *
   * Boundary rule: read shared deps from App.* at call time, never captured at
   * load. See ARCHITECTURE.md "Feature files / window.App registry".
   */

  // twin-<role>-<n>@twins.counttooling.local - the fleet convention from the plan.
  const TWIN_EMAIL_RE = /^twin-[a-z]+-\d+@twins\.counttooling\.local$/i;

  function isTwinEmail(email) {
    return TWIN_EMAIL_RE.test(String(email || '').trim().toLowerCase());
  }

  // Row-shaped check: an explicit flag wins, the email pattern is the fallback.
  function isTwinUser(user) {
    if (!user) return false;
    if (user.is_digital_twin === true) return true;
    return isTwinEmail(user.email);
  }

  // For innerHTML surfaces - a chip appended after the email. Static markup, so
  // it carries no escaping burden of its own.
  function twinBadgeHtml(emailOrUser) {
    const twin = (emailOrUser && typeof emailOrUser === 'object')
      ? isTwinUser(emailOrUser)
      : isTwinEmail(emailOrUser);
    if (!twin) return '';
    return ' <span class="twin-badge" title="Digital twin - an agent-operated account, not a person">🤖 twin</span>';
  }

  // For textContent surfaces (status bar, header status, alerts) - the same
  // signal where markup is not an option.
  function twinEmailText(email) {
    const e = String(email || '');
    return isTwinEmail(e) ? '🤖 ' + e : e;
  }

  // The signed-in twin's own banner. `body.twin-session` also shortens .app by
  // the banner height so the fixed-viewport layout is not clipped.
  function renderTwinBanner() {
    const el = document.getElementById('twinBanner');
    if (!el) return;
    const state = App.state;
    const isTwin = !!(state && state.isDigitalTwin);
    document.body.classList.toggle('twin-session', isTwin);
    if (!isTwin) return;
    const user = state.supabaseSession && state.supabaseSession.user;
    const who = (user && user.user_metadata && user.user_metadata.name) || (user && user.email) || '';
    const label = document.getElementById('twinBannerText');
    if (label) label.textContent = who ? ('DIGITAL TWIN — ' + who) : 'DIGITAL TWIN';
  }

  App.isTwinEmail = isTwinEmail;
  App.isTwinUser = isTwinUser;
  App.twinBadgeHtml = twinBadgeHtml;
  App.twinEmailText = twinEmailText;
  App.renderTwinBanner = renderTwinBanner;
})();

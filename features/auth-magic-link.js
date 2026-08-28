(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/auth-magic-link.js - the email sign-in fallback: after two failed
   * password attempts on the SAME email, the Sign In modal offers to email a
   * one-time magic link instead. The send is signInWithOtp with
   * shouldCreateUser: false (PipeTooling is the system of record for people -
   * a typo'd email must never provision a CT-only account) and redirects to
   * /app/ (allowlisted since the 2026-08-28 auth-config fix); the link is
   * consumed by supabase-js's detectSessionInUrl + onAuthStateChange - the
   * same path twin-login's minted links already exercise - so this file owns
   * only the modal UX:
   *
   *   - TWO entry points sharing one send path: the always-visible quiet link
   *     under the actions ("No password? Email me a sign-in link" - every
   *     PT-provisioned account is born with an unusable random password, so
   *     the link IS their sign-in and must not hide behind failure), and the
   *     louder offer box revealed by the per-email failure counter at 2
   *     (app.js reports failures via App.onAuthSignInFailed(email); per-email
   *     so a typo'd address's failures don't qualify the corrected one). The
   *     quiet link yields to the offer box - never both at once.
   *   - the send action + the "Check your email" sent state, with the
   *     open-on-THIS-device warning (the link signs in whichever browser opens
   *     it - the classic magic-link trap), a 60s resend cooldown (GoTrue's
   *     rate limit), and a way back to the password form.
   *   - reset on modal close (app.js hideModal calls App.onAuthMagicLinkReset,
   *     the groups.js precedent) and on successful password sign-in.
   *
   * OTP errors surface honestly but translated (friendlyOtpError):
   * GoTrue's "Signups not allowed for otp" is really "no account with that
   * email" (shouldCreateUser: false + invite-only), so say that and point at
   * the admin; rate limits and bans get plain words too. Enumeration-
   * hardening deliberately traded away for an invite-only tool.
   * Boundary rule: read shared deps from App.* at call time, never captured at
   * load. See ARCHITECTURE.md "Feature files / window.App registry".
   */

  const OFFER_AFTER = 2;
  const RESEND_COOLDOWN_S = 60;

  let failCounts = Object.create(null); // normalized email -> consecutive failures
  let cooldownTimer = null;
  let lastSentEmail = '';

  const $ = (id) => document.getElementById(id);
  const normEmail = (e) => String(e || '').trim().toLowerCase();

  function showEl(id, show) { const el = $(id); if (el) el.style.display = show ? '' : 'none'; }

  function syncEntryPoints(offerVisible) {
    showEl('authMagicOffer', offerVisible);
    showEl('authMagicAlwaysWrap', !offerVisible);
  }

  function onAuthSignInFailed(email) {
    const key = normEmail(email);
    if (!key) return;
    failCounts[key] = (failCounts[key] || 0) + 1;
    if (failCounts[key] >= OFFER_AFTER) syncEntryPoints(true);
  }

  // GoTrue's raw messages, translated for the two cases people actually hit.
  function friendlyOtpError(error) {
    const msg = String((error && error.message) || '');
    if (/signups? not allowed/i.test(msg)) return 'No account found for that email. CountTooling accounts are set up by your admin — ask them to add you.';
    if (/rate limit/i.test(msg)) return 'Email limit reached — wait a few minutes and try again.';
    if (/banned/i.test(msg)) return 'This account has been deactivated — ask your admin.';
    return msg || 'Could not send the link';
  }

  function reset() {
    failCounts = Object.create(null);
    lastSentEmail = '';
    stopCooldown();
    syncEntryPoints(false);
    showEl('authMagicSent', false);
    showEl('authForm', true);
    const err = $('authMagicSentError'); if (err) err.style.display = 'none';
    const btn = $('authMagicSend'); if (btn) { btn.disabled = false; }
    const label = $('authMagicSendLabel'); if (label) label.textContent = 'Email me a sign-in link';
  }

  function stopCooldown() {
    if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  }

  function startCooldown() {
    stopCooldown();
    const btn = $('authMagicResend');
    if (!btn) return;
    let left = RESEND_COOLDOWN_S;
    btn.disabled = true;
    const paint = () => { btn.textContent = 'Resend in ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); };
    paint();
    cooldownTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) { stopCooldown(); btn.disabled = false; btn.textContent = 'Resend link'; return; }
      paint();
    }, 1000);
  }

  function showSent(email) {
    const emailEl = $('authMagicSentEmail'); if (emailEl) emailEl.textContent = email;
    showEl('authForm', false);
    showEl('authMagicSent', true);
    startCooldown();
  }

  async function sendLink(email, errEl) {
    const supabase = App.getSupabase && App.getSupabase();
    if (!supabase) return { message: 'Cloud is not available right now.' };
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + '/app/' },
      });
      if (error) return error;
      return null;
    } catch (_) {
      return { message: 'Could not send the link - check your connection.' };
    } finally {
      void errEl;
    }
  }

  async function requestLink(btnId, labelId) {
    const email = normEmail($('authEmail') && $('authEmail').value);
    const errEl = $('authError');
    if (errEl) errEl.style.display = 'none';
    if (!email) {
      if (errEl) { errEl.textContent = 'Enter your email above first'; errEl.style.display = 'block'; }
      const em = $('authEmail'); if (em) em.focus();
      return;
    }
    const btn = $(btnId);
    const label = $(labelId);
    if (btn) btn.disabled = true;
    if (label) label.textContent = 'Sending…';
    const error = await sendLink(email, errEl);
    if (btn) btn.disabled = false;
    if (label) label.textContent = 'Email me a sign-in link';
    if (error) {
      if (errEl) { errEl.textContent = friendlyOtpError(error); errEl.style.display = 'block'; }
      return;
    }
    lastSentEmail = email;
    showSent(email);
  }

  async function onResendClick() {
    const errEl = $('authMagicSentError');
    if (errEl) errEl.style.display = 'none';
    const btn = $('authMagicResend');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    const error = await sendLink(lastSentEmail, errEl);
    if (error) {
      if (btn) { btn.disabled = false; btn.textContent = 'Resend link'; }
      if (errEl) { errEl.textContent = friendlyOtpError(error); errEl.style.display = 'block'; }
      return;
    }
    startCooldown();
  }

  function onBackClick() {
    showEl('authMagicSent', false);
    showEl('authForm', true);
    // The counter already qualified this email - keep the offer visible.
    const pw = $('authPassword'); if (pw) { pw.value = ''; pw.focus(); }
  }

  const sendBtn = $('authMagicSend');
  if (sendBtn) sendBtn.onclick = () => requestLink('authMagicSend', 'authMagicSendLabel');
  const alwaysBtn = $('authMagicAlways');
  if (alwaysBtn) alwaysBtn.onclick = () => requestLink('authMagicAlways', 'authMagicAlwaysLabel');
  const resendBtn = $('authMagicResend');
  if (resendBtn) resendBtn.onclick = onResendClick;
  const backBtn = $('authMagicBack');
  if (backBtn) backBtn.onclick = onBackClick;
  // Switching to a different email hides the offer until THAT email qualifies.
  const emailInput = $('authEmail');
  if (emailInput) emailInput.addEventListener('input', () => {
    const key = normEmail(emailInput.value);
    syncEntryPoints((failCounts[key] || 0) >= OFFER_AFTER);
  });

  App.onAuthSignInFailed = onAuthSignInFailed;
  App.onAuthMagicLinkReset = reset;
})();

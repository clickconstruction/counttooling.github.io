// @ts-check
/**
 * Tests: email sign-in fallback (features/auth-magic-link.js).
 *
 * After two failed password attempts on the SAME email, the Sign In modal
 * offers to email a one-time magic link (signInWithOtp, shouldCreateUser:
 * false). Auth endpoints are stubbed via Playwright routes (the GoTrue
 * password grant and /otp), so these always run - no cloud needed.
 */
const { test, expect } = require('@playwright/test');

const pageErrors = (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

async function stubAuth(page, otpCalls) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
  }));
  await page.route('**/auth/v1/otp**', (route) => {
    otpCalls.push({ url: route.request().url(), body: route.request().postDataJSON() });
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function openAuthModal(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.App.showModal('authModal'));
  await expect(page.locator('#authModal')).toHaveClass(/visible/);
}

async function failSignIn(page, email, password) {
  await page.fill('#authEmail', email);
  await page.fill('#authPassword', password);
  await page.click('#authSignIn');
  await expect(page.locator('#authError')).toBeVisible();
}

test.describe('Email sign-in fallback', () => {
  test('offer appears on the 2nd failure of the same email, not the 1st', async ({ page }) => {
    const errors = pageErrors(page);
    await stubAuth(page, []);
    await openAuthModal(page);

    await failSignIn(page, 'wendi@clickplumbingsupply.com', 'wrong1');
    await expect(page.locator('#authMagicOffer')).toBeHidden();

    await failSignIn(page, 'wendi@clickplumbingsupply.com', 'wrong2');
    await expect(page.locator('#authMagicOffer')).toBeVisible();
    await expect(page.locator('#authMagicSend')).toContainText('Email me a sign-in link');

    expect(errors).toEqual([]);
  });

  test('counter is per-email: one failure each on two emails offers nothing', async ({ page }) => {
    await stubAuth(page, []);
    await openAuthModal(page);

    await failSignIn(page, 'a@clickplumbingsupply.com', 'wrong');
    await failSignIn(page, 'b@clickplumbingsupply.com', 'wrong');
    await expect(page.locator('#authMagicOffer')).toBeHidden();

    // ...but the first email is one failure from qualifying: switching back
    // and failing again reveals the offer.
    await failSignIn(page, 'a@clickplumbingsupply.com', 'wrong');
    await expect(page.locator('#authMagicOffer')).toBeVisible();

    // Editing to a non-qualified email hides it again; back to a qualified one shows it.
    await page.fill('#authEmail', 'c@clickplumbingsupply.com');
    await expect(page.locator('#authMagicOffer')).toBeHidden();
    await page.fill('#authEmail', 'a@clickplumbingsupply.com');
    await expect(page.locator('#authMagicOffer')).toBeVisible();
  });

  test('send: OTP call carries shouldCreateUser false; sent state shows email, cooldown, way back', async ({ page }) => {
    const otpCalls = [];
    await stubAuth(page, otpCalls);
    await openAuthModal(page);

    await failSignIn(page, 'wendi@clickplumbingsupply.com', 'wrong1');
    await failSignIn(page, 'wendi@clickplumbingsupply.com', 'wrong2');
    await page.click('#authMagicSend');

    // Sent state replaces the form.
    await expect(page.locator('#authMagicSent')).toBeVisible();
    await expect(page.locator('#authForm')).toBeHidden();
    await expect(page.locator('#authMagicSentEmail')).toHaveText('wendi@clickplumbingsupply.com');

    // The OTP request: right email, never creates an account, lands on /app/.
    expect(otpCalls.length).toBe(1);
    expect(otpCalls[0].body.email).toBe('wendi@clickplumbingsupply.com');
    expect(otpCalls[0].body.create_user).toBe(false);
    // emailRedirectTo travels as the redirect_to query param.
    expect(decodeURIComponent(otpCalls[0].url)).toContain('/app/');

    // Resend starts cooldown-locked with a countdown label.
    await expect(page.locator('#authMagicResend')).toBeDisabled();
    await expect(page.locator('#authMagicResend')).toContainText('Resend in');

    // The device warning is present - the classic magic-link trap.
    await expect(page.locator('.auth-magic-sent-warn')).toContainText('whichever device opens it');

    // Back returns to the password form; the qualified offer stays visible.
    await page.click('#authMagicBack');
    await expect(page.locator('#authForm')).toBeVisible();
    await expect(page.locator('#authMagicSent')).toBeHidden();
    await expect(page.locator('#authMagicOffer')).toBeVisible();
  });

  test('OTP error surfaces honestly and the form stays', async ({ page }) => {
    await stubAuth(page, []);
    await page.unroute('**/auth/v1/otp**');
    await page.route('**/auth/v1/otp**', (route) => route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ code: 422, msg: 'Signups not allowed for otp' }),
    }));
    await openAuthModal(page);

    await failSignIn(page, 'nobody@clickplumbingsupply.com', 'wrong1');
    await failSignIn(page, 'nobody@clickplumbingsupply.com', 'wrong2');
    await page.click('#authMagicSend');

    await expect(page.locator('#authError')).toBeVisible();
    // GoTrue's raw "Signups not allowed for otp" is translated to the truth:
    // no account, and accounts come from the admin.
    await expect(page.locator('#authError')).toContainText('No account found for that email');
    await expect(page.locator('#authMagicSent')).toBeHidden();
    await expect(page.locator('#authForm')).toBeVisible();
  });

  test('quiet always-visible link: works with zero failures, yields to the offer box', async ({ page }) => {
    const otpCalls = [];
    await stubAuth(page, otpCalls);
    await openAuthModal(page);

    // Visible from the start - PT-provisioned accounts never had a password,
    // so the link must not hide behind failed attempts.
    await expect(page.locator('#authMagicAlwaysWrap')).toBeVisible();
    await expect(page.locator('#authMagicAlways')).toContainText('No password?');

    // Empty email: inline nudge, no request.
    await page.click('#authMagicAlways');
    await expect(page.locator('#authError')).toContainText('Enter your email above first');
    expect(otpCalls.length).toBe(0);

    // With an email: same send path, same sent state.
    await page.fill('#authEmail', 'wendi@clickplumbingsupply.com');
    await page.click('#authMagicAlways');
    await expect(page.locator('#authMagicSent')).toBeVisible();
    expect(otpCalls.length).toBe(1);
    expect(otpCalls[0].body.create_user).toBe(false);

    // Back, then qualify the offer box: the quiet link yields - never both.
    await page.click('#authMagicBack');
    await failSignIn(page, 'wendi@clickplumbingsupply.com', 'wrong1');
    await failSignIn(page, 'wendi@clickplumbingsupply.com', 'wrong2');
    await expect(page.locator('#authMagicOffer')).toBeVisible();
    await expect(page.locator('#authMagicAlwaysWrap')).toBeHidden();
  });

  test('rate-limit error gets plain words', async ({ page }) => {
    await stubAuth(page, []);
    await page.unroute('**/auth/v1/otp**');
    await page.route('**/auth/v1/otp**', (route) => route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ code: 429, msg: 'Email rate limit exceeded' }),
    }));
    await openAuthModal(page);

    await page.fill('#authEmail', 'wendi@clickplumbingsupply.com');
    await page.click('#authMagicAlways');
    await expect(page.locator('#authError')).toContainText('Email limit reached');
  });

  test('closing the modal resets everything', async ({ page }) => {
    await stubAuth(page, []);
    await openAuthModal(page);

    await failSignIn(page, 'wendi@clickplumbingsupply.com', 'wrong1');
    await failSignIn(page, 'wendi@clickplumbingsupply.com', 'wrong2');
    await expect(page.locator('#authMagicOffer')).toBeVisible();

    await page.click('#authCancel');
    await expect(page.locator('#authModal')).not.toHaveClass(/visible/);

    // Reopen: fresh modal, fresh counting - one failure shows no offer.
    await page.evaluate(() => window.App.showModal('authModal'));
    await expect(page.locator('#authMagicOffer')).toBeHidden();
    await failSignIn(page, 'wendi@clickplumbingsupply.com', 'wrong1');
    await expect(page.locator('#authMagicOffer')).toBeHidden();
  });
});

// The shared sender the admin panel consumes (features/user-admin.js "Email
// sign-in link" row action) — same stubs, driven through the App registry so
// it runs without an admin session.
test.describe('App.sendSignInMagicLink (shared with user-admin)', () => {
  test('sends the same no-create OTP and returns null on success', async ({ page }) => {
    const otpCalls = [];
    await stubAuth(page, otpCalls);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(() => window.App.sendSignInMagicLink(' Wendi@ClickPlumbingSupply.com '));
    expect(result).toBe(null);
    expect(otpCalls.length).toBe(1);
    expect(otpCalls[0].body.email).toBe('wendi@clickplumbingsupply.com');
    expect(otpCalls[0].body.create_user).toBe(false);
    expect(decodeURIComponent(otpCalls[0].url)).toContain('/app/');
  });

  test('returns the translated error string on failure', async ({ page }) => {
    await stubAuth(page, []);
    await page.unroute('**/auth/v1/otp**');
    await page.route('**/auth/v1/otp**', (route) => route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ code: 429, msg: 'Email rate limit exceeded' }),
    }));
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(() => window.App.sendSignInMagicLink('wendi@clickplumbingsupply.com'));
    expect(result).toContain('Email limit reached');
  });
});

// @ts-check
/**
 * Tests: the Sign-In wall copy & gate intents (Tier-3 B7, J13 J16 J17).
 *
 * - Static wall copy: "Accounts are set up by your office admin." + the
 *   landing's "New here? Call (512) 360-0599…" phone line (#authWallHelp).
 * - #authGateLine: shown with a why-am-I-here sentence only when a gated
 *   opener (User Settings / Project Settings > Save / Load Project) routed
 *   to the wall; hidden on a plain Sign In click.
 * - Reopen-after-sign-in: the gated surface reopens once sign-in completes
 *   (auth endpoints stubbed via Playwright routes, like auth-magic-link.spec).
 *   Cancel/Escape clears the parked intent.
 * - Fetch exceptions render as plain words ("Can’t reach the server…"), while
 *   real server messages (wrong password) pass through verbatim.
 * - The stale admin modal copy rewrite (Add User / Manage Users subtitles,
 *   de-duplicated Activity headings) — static DOM.
 */
const { test, expect } = require('@playwright/test');

const NET_COPY = 'Can’t reach the server — check your connection and try again.';

const pageErrors = (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

async function gotoApp(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
}

// A minimal GoTrue password-grant success. supabase-js stores the session and
// fires SIGNED_IN, which is where the parked gate intent is consumed.
function sessionJson() {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'header.payload.signature',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id: 'u-auth-wall-test',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'crew@clickplumbing.com',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
}

async function stubAuthSuccess(page) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(sessionJson()),
  }));
  // Everything the SIGNED_IN handler then touches (profiles, airboard, RPC
  // telemetry, presence) — benign empty object for all of it.
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));
}

async function signInFromWall(page) {
  await page.fill('#authEmail', 'crew@clickplumbing.com');
  await page.fill('#authPassword', 'a-password');
  await page.click('#authSignIn');
}

test.describe('Sign-In wall copy & gate intents (B7)', () => {
  test('static wall copy: office-admin line + phone CTA; plain open shows no gate line', async ({ page }) => {
    const errors = pageErrors(page);
    await gotoApp(page);

    await page.evaluate(() => document.getElementById('authBtn')?.click());
    await expect(page.locator('#authModal')).toHaveClass(/visible/);

    // Plain Sign In click: no why-am-I-here line.
    await expect(page.locator('#authGateLine')).toBeHidden();

    // The wall answers "how do I get in?" by itself (J13 + J17).
    const help = page.locator('#authWallHelp');
    await expect(help).toBeVisible();
    await expect(help).toContainText('Accounts are set up by your office admin.');
    await expect(help).toContainText('New here? Call');
    await expect(help).toContainText('(512) 360-0599');
    await expect(help.locator('a[href="tel:+15123600599"]')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('gated openers park an intent: gate line per surface, cleared on plain reopen', async ({ page }) => {
    const errors = pageErrors(page);
    await gotoApp(page);

    // User Settings gate (status: signed out).
    await page.evaluate(() => window.App.openMySettings());
    await expect(page.locator('#authModal')).toHaveClass(/visible/);
    await expect(page.locator('#authGateLine')).toBeVisible();
    await expect(page.locator('#authGateLine')).toHaveText('Sign in to open your settings and saved standards.');
    await page.keyboard.press('Escape');
    await expect(page.locator('#authModal')).not.toHaveClass(/visible/);

    // Load Project gate.
    await page.evaluate(() => window.App.openAuthGate('loadProject'));
    await expect(page.locator('#authModal')).toHaveClass(/visible/);
    await expect(page.locator('#authGateLine')).toHaveText('Sign in to open your cloud projects.');
    await page.click('#authCancel');
    await expect(page.locator('#authModal')).not.toHaveClass(/visible/);

    // A later plain open carries no leftover gate line.
    await page.evaluate(() => document.getElementById('authBtn')?.click());
    await expect(page.locator('#authModal')).toHaveClass(/visible/);
    await expect(page.locator('#authGateLine')).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('reopen-after-sign-in: the User Settings gate reopens User Settings', async ({ page }) => {
    const errors = pageErrors(page);
    await stubAuthSuccess(page);
    await gotoApp(page);

    await page.evaluate(() => window.App.openMySettings());
    await expect(page.locator('#authModal')).toHaveClass(/visible/);
    await expect(page.locator('#authGateLine')).toBeVisible();

    await signInFromWall(page);

    await expect(page.locator('#authModal')).not.toHaveClass(/visible/, { timeout: 5000 });
    // The surface the user originally asked for comes back on its own.
    await expect(page.locator('#mySettingsModal')).toHaveClass(/visible/, { timeout: 5000 });

    expect(errors).toEqual([]);
  });

  test('a cancelled gate does NOT reopen after a later plain sign-in', async ({ page }) => {
    const errors = pageErrors(page);
    await stubAuthSuccess(page);
    await gotoApp(page);

    // Park an intent, then back out of the wall.
    await page.evaluate(() => window.App.openMySettings());
    await expect(page.locator('#authModal')).toHaveClass(/visible/);
    await page.click('#authCancel');
    await expect(page.locator('#authModal')).not.toHaveClass(/visible/);

    // Sign in through the plain door.
    await page.evaluate(() => document.getElementById('authBtn')?.click());
    await expect(page.locator('#authModal')).toHaveClass(/visible/);
    await signInFromWall(page);
    await expect(page.locator('#authModal')).not.toHaveClass(/visible/, { timeout: 5000 });

    // Give any (wrong) reopen a moment to fire, then assert it did not.
    await page.waitForTimeout(600);
    await expect(page.locator('#mySettingsModal')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });

  test('dead connection: plain words instead of raw "Failed to fetch"; wrong password passes through', async ({ page }) => {
    const errors = pageErrors(page);
    await page.route('**/auth/v1/token**', (route) => route.abort('failed'));
    await gotoApp(page);

    await page.evaluate(() => document.getElementById('authBtn')?.click());
    await expect(page.locator('#authModal')).toHaveClass(/visible/);
    await signInFromWall(page);
    await expect(page.locator('#authError')).toBeVisible();
    await expect(page.locator('#authError')).toHaveText(NET_COPY);
    await expect(page.locator('#authModal')).toHaveClass(/visible/);

    // Server-side messages are NOT rewritten (the credentials path is honest).
    await page.unroute('**/auth/v1/token**');
    await page.route('**/auth/v1/token**', (route) => route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
    }));
    await signInFromWall(page);
    await expect(page.locator('#authError')).toHaveText('Invalid login credentials');

    expect(errors).toEqual([]);
  });

  test('magic-link send on a dead connection uses the same plain copy', async ({ page }) => {
    const errors = pageErrors(page);
    await page.route('**/auth/v1/otp**', (route) => route.abort('failed'));
    await gotoApp(page);

    await page.evaluate(() => document.getElementById('authBtn')?.click());
    await expect(page.locator('#authModal')).toHaveClass(/visible/);
    await page.fill('#authEmail', 'crew@clickplumbing.com');
    await page.click('#authMagicAlways');
    await expect(page.locator('#authError')).toBeVisible();
    await expect(page.locator('#authError')).toHaveText(NET_COPY);

    expect(errors).toEqual([]);
  });

  test('admin modal copy: Add User heading, honest subtitles, de-duplicated Activity headings', async ({ page }) => {
    const errors = pageErrors(page);
    await gotoApp(page);

    // Create-user modal is titled like its opener; no more "Supabase Dashboard".
    await expect(page.locator('#adminPanelModal h2')).toHaveText('Add User');
    const addUserSub = page.locator('#adminPanelModal .form-group').first();
    await expect(addUserSub).toHaveText('Create the account, then hand the teammate their email and password.');

    // The user table subtitle describes the whole toolkit, not just delete.
    await expect(page.locator('#manageUserModal .form-group').first())
      .toHaveText('Passwords, transfers, activity, and deletes — per user.');

    // The two activity modals no longer share one title.
    await expect(page.locator('#userActivityModalTitle')).toHaveText('Activity log');
    await expect(page.locator('#userActivityOverviewModal h2')).toHaveText('Activity overview');

    expect(errors).toEqual([]);
  });
});

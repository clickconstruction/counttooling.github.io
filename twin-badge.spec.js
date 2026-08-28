// @ts-check
/**
 * Tests: digital-twin visibility (features/twin-badge.js).
 *
 * Twins are agent-operated accounts that do real takeoffs, so the program's
 * review loop depends on a twin never reading as a person (PipeTooling
 * docs/DIGITAL_TWINS_PLAN.md, Phase E2). Two surfaces, both testable without
 * cloud auth because the feature file is a pure App.* registry module:
 *
 *   - The signed-in twin's own banner, driven from state.isDigitalTwin.
 *   - Everyone else's badge, resolved from the fleet email pattern or an
 *     explicit is_digital_twin flag on the row.
 *
 * These run signed-out: we drive App.state directly rather than minting a real
 * twin session, which would need TWIN_LOGIN_SECRET and a live account.
 */
const { test, expect } = require('@playwright/test');

const consoleErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

test.describe('Digital twin visibility', () => {
  test('fleet emails are recognised; real people and near-misses are not', async ({ page }) => {
    const errors = consoleErrors(page);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const verdicts = await page.evaluate(() => {
      const f = window.App.isTwinEmail;
      return {
        estimator: f('twin-estimator-1@twins.counttooling.local'),
        upper: f('Twin-Estimator-12@Twins.CountTooling.Local'),
        padded: f('  twin-estimator-3@twins.counttooling.local  '),
        // The role segment stays open so a later role rollout keeps badging.
        futureRole: f('twin-assistant-1@twins.counttooling.local'),
        person: f('todd@clickplumbingsupply.com'),
        lookalike: f('twin-estimator-1@counttooling.com'),
        noIndex: f('twin-estimator@twins.counttooling.local'),
        empty: f(''),
        nullish: f(null),
      };
    });

    expect(verdicts).toEqual({
      estimator: true, upper: true, padded: true, futureRole: true,
      person: false, lookalike: false, noIndex: false, empty: false, nullish: false,
    });
    expect(errors).toEqual([]);
  });

  test('isTwinUser trusts an explicit flag even when the email is off-pattern', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // PT's manage-user bridge can flag an account whose email does not match the
    // fleet pattern, so the row flag has to win on its own.
    const verdicts = await page.evaluate(() => {
      const f = window.App.isTwinUser;
      return {
        flagOnly: f({ email: 'agent@example.com', is_digital_twin: true }),
        patternOnly: f({ email: 'twin-estimator-9@twins.counttooling.local' }),
        neither: f({ email: 'agent@example.com' }),
        flagFalseButPattern: f({ email: 'twin-estimator-9@twins.counttooling.local', is_digital_twin: false }),
        nothing: f(null),
      };
    });

    expect(verdicts).toEqual({
      flagOnly: true, patternOnly: true, neither: false,
      flagFalseButPattern: true, nothing: false,
    });
  });

  test('badge markup appears only for twins, in both HTML and text form', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const out = await page.evaluate(() => ({
      twinHtml: window.App.twinBadgeHtml('twin-estimator-1@twins.counttooling.local'),
      personHtml: window.App.twinBadgeHtml('todd@clickplumbingsupply.com'),
      rowHtml: window.App.twinBadgeHtml({ email: 'agent@example.com', is_digital_twin: true }),
      twinText: window.App.twinEmailText('twin-estimator-1@twins.counttooling.local'),
      personText: window.App.twinEmailText('todd@clickplumbingsupply.com'),
    }));

    expect(out.twinHtml).toContain('twin-badge');
    expect(out.rowHtml).toContain('twin-badge');
    expect(out.personHtml).toBe('');
    expect(out.twinText).toBe('🤖 twin-estimator-1@twins.counttooling.local');
    // Non-twins must pass through untouched — this string is used as textContent.
    expect(out.personText).toBe('todd@clickplumbingsupply.com');
  });

  test('own-session banner shows on a twin, names them, and clears on sign-out', async ({ page }) => {
    const errors = consoleErrors(page);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Signed out: no banner, and the app keeps the full viewport.
    await expect(page.locator('#twinBanner')).toBeHidden();
    expect(await page.evaluate(() => document.body.classList.contains('twin-session'))).toBe(false);

    await page.evaluate(() => {
      window.App.state.isDigitalTwin = true;
      window.App.state.supabaseSession = { user: { email: 'twin-estimator-1@twins.counttooling.local', user_metadata: {} } };
      window.App.renderTwinBanner();
    });

    await expect(page.locator('#twinBanner')).toBeVisible();
    await expect(page.locator('#twinBannerText')).toHaveText('DIGITAL TWIN — twin-estimator-1@twins.counttooling.local');
    expect(await page.evaluate(() => document.body.classList.contains('twin-session'))).toBe(true);

    // The banner sits above .app, so the shell must give back its height rather
    // than overflowing the fixed viewport.
    const fits = await page.evaluate(() => {
      const app = document.querySelector('.app');
      return app.getBoundingClientRect().bottom <= document.documentElement.clientHeight + 1;
    });
    expect(fits).toBe(true);

    // A name, when PT supplied one, reads better than the fleet email.
    await page.evaluate(() => {
      window.App.state.supabaseSession.user.user_metadata = { name: 'Estimator Twin 1' };
      window.App.renderTwinBanner();
    });
    await expect(page.locator('#twinBannerText')).toHaveText('DIGITAL TWIN — Estimator Twin 1');

    await page.evaluate(() => {
      window.App.state.isDigitalTwin = false;
      window.App.state.supabaseSession = null;
      window.App.renderTwinBanner();
    });
    await expect(page.locator('#twinBanner')).toBeHidden();
    expect(await page.evaluate(() => document.body.classList.contains('twin-session'))).toBe(false);

    expect(errors).toEqual([]);
  });
});

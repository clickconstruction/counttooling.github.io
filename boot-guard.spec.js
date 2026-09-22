// @ts-check
/**
 * Tests: the boot sanity guard (inline tail script in app/index.html).
 *
 * If app.js fails to load or execute — the field case: a transient CDN 503 on
 * a FIRST visit, before the service worker exists to backstop the shell — the
 * static markup renders but nothing works and (pre-guard) no error showed.
 * The guard checks window.App.state after window load (+1.5s) and surfaces
 * the #globalReloadBanner with its own Reload/Dismiss wiring, since the
 * normal app.js wiring is dead in exactly this scenario.
 */
const { test, expect } = require('@playwright/test');

test.describe('Boot sanity guard', () => {
  test('app.js failing to load surfaces the reload banner; Reload re-navigates', async ({ page }) => {
    let block = true;
    await page.route('**/app.js', (route) => (block ? route.abort() : route.continue()));
    await page.goto('/app/');
    // The guard fires 1.5s after window load.
    await expect(page.locator('#globalReloadBanner')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#globalReloadBannerText')).toHaveText("Something didn't load. Reload to try again.");

    // Reload with app.js unblocked boots normally and the banner stays gone.
    // The guard's Reload first unregisters every service worker and deletes
    // every cache (the 2026-08-30 stale-shell cure), so the reload lands a beat
    // after the click: wait for the rebooted app, not for network-idle on the
    // dead page.
    block = false;
    await page.locator('#globalReloadBannerReload').click();
    await page.waitForFunction(() => !!(window.App && window.App.state), null, { timeout: 15000 });
    expect(await page.evaluate(() => !!(window.App && window.App.state))).toBe(true);
    await page.waitForTimeout(2000);
    await expect(page.locator('#globalReloadBanner')).toBeHidden();
  });

  test('healthy boot never shows the banner', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await page.waitForTimeout(2000);   // past the guard's 1.5s check
    await expect(page.locator('#globalReloadBanner')).toBeHidden();
  });
});

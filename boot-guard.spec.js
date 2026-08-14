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
    block = false;
    await page.locator('#globalReloadBannerReload').click();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => !!(window.App && window.App.state))).toBe(true);
    await page.waitForTimeout(2000);
    await expect(page.locator('#globalReloadBanner')).toBeHidden();
  });

  test('healthy boot never shows the banner', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);   // past the guard's 1.5s check
    await expect(page.locator('#globalReloadBanner')).toBeHidden();
  });
});

// @ts-check
/**
 * Clear Page reachability (JOURNEY-MAP Tier-2 #13, blocker-grade).
 *
 * A signed-out user must be able to reach Clear Page without sign-in at BOTH
 * desktop and mobile widths. History of the regression this pins:
 *   - the header #clearPage button is retired behind
 *     `.header .replaced-by-status-bar { display: none !important; }`;
 *   - the Project Settings gear route is sign-in-gated on desktop
 *     (#settingsGearBtn's onclick opens the auth modal when signed out) and
 *     the gear is CSS-hidden on mobile;
 *   - the sidebar route was dead everywhere: the mobile
 *     `.sidebar-clear-page { display: block; }` lost the cascade to a later
 *     base `.sidebar-clear-page { display: none; }` (same specificity, later
 *     source order), so NO width had a reachable Clear Page.
 * The fix removes the stale base display:none so the sidebar section shows at
 * every width; a `:has()` rule collapses the section in viewer mode, where
 * updateUI's viewerHideIds inline-hides the button.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadPdf(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

test.describe('Clear Page is reachable without sign-in', () => {
  test('desktop: sidebar Clear Page button is visible and opens the confirm modal', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await loadPdf(page);

    // Signed out (no auth flow was run).
    expect(await page.evaluate(() => !!window.state.supabaseSession?.user)).toBe(false);

    // The retired header button must stay hidden (replaced-by-status-bar).
    await expect(page.locator('#clearPage')).toBeHidden();

    // The sidebar route: actually visible, real user click (no JS .click()
    // bypass — the old spec's evaluate-click worked even on display:none).
    const sidebarBtn = page.locator('#clearPageSidebar');
    await expect(sidebarBtn).toBeVisible();
    await sidebarBtn.scrollIntoViewIfNeeded();
    await sidebarBtn.click();
    await expect(page.locator('#clearPageConfirmModal')).toHaveClass(/visible/);
    await expect(page.locator('#clearPageConfirmMessage')).toContainText('Main');
    await page.locator('#clearPageCancel').click();
    await expect(page.locator('#clearPageConfirmModal')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });

  test('mobile: hamburger drawer exposes a clickable Clear Page button', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 375, height: 812 });
    await loadPdf(page);

    expect(await page.evaluate(() => !!window.state.supabaseSession?.user)).toBe(false);

    // Mobile has no gear and no header button; the drawer is the route.
    await expect(page.locator('#settingsGearBtn')).toBeHidden();
    await expect(page.locator('#clearPage')).toBeHidden();

    await page.locator('#hamburger').click();
    const sidebarBtn = page.locator('#clearPageSidebar');
    await sidebarBtn.scrollIntoViewIfNeeded();
    await expect(sidebarBtn).toBeVisible();
    await sidebarBtn.click();
    await expect(page.locator('#clearPageConfirmModal')).toHaveClass(/visible/);
    await expect(page.locator('#clearPageConfirmMessage')).toContainText('Main');
    await page.locator('#clearPageCancel').click();

    expect(errors).toEqual([]);
  });

  test('viewer mode: the sidebar section collapses (viewers gain no Clear Page)', async ({ page }) => {
    await loadPdf(page);

    // updateUI's viewerHideIds inline-hides #clearPageSidebar for viewers;
    // the :has() rule must collapse the now-empty bordered section too.
    await page.evaluate(() => { window.state.isViewer = true; window.App.updateUI(); });
    await expect(page.locator('#clearPageSidebar')).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.sidebar-clear-page')).display)).toBe('none');

    await page.evaluate(() => { window.state.isViewer = false; window.App.updateUI(); });
    await expect(page.locator('#clearPageSidebar')).toBeVisible();
  });
});

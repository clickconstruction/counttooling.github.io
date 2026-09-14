// @ts-check
/**
 * Tests: the ADVANCED sample plan (2026-09-14, Will: "use both, A as the simple
 * plan and B as the advanced plan"). samples/sample-plan-advanced.pdf is a
 * restaurant plumbing sheet (Main St Restaurant, P-101); it opens through the
 * app's own intake from the empty canvas and from Project Settings, exactly like
 * a dropped file. The three tours keep the simple plan; their entry points and
 * separators are untouched, and the advanced offer stays even when every tour is
 * done (only its leading separator follows the tours).
 */
const { test, expect } = require('@playwright/test');

async function boot(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForFunction(() => window.App && window.state);
}

test.describe('Engineered (advanced) sample plan', () => {
  test('the empty canvas offers it beside the tours and opens it through the intake', async ({ page }) => {
    const errors = [];
    await boot(page, errors);
    const link = page.locator('#canvasEmptyHintAdvancedPlan');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('engineered sample plan');
    await expect(page.locator('#canvasEmptyHintAdvancedSep')).toBeVisible();   // the tours are not done: the separator shows
    await link.click();
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 15000 });
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    expect(await page.evaluate(() => window.state.pages[0].label)).toContain('sample-plan-advanced');
    // a true ANSI B sheet (2026-09-14): Set Scale shows no sheet-size warning on it
    expect(await page.evaluate(() => window.App.getPageSheetAnalysis(0).isStandard)).toBe(true);
    // the sheet's text layer carries the restaurant's room names (a real PDF, not a scan)
    await page.evaluate(() => { window.App.pageTextItems(0); });   // kicks the lazy text-layer fetch (the room-labels idiom)
    await page.waitForFunction(() => window.App.pageTextItems(0).length > 0, null, { timeout: 15000 });
    const text = await page.evaluate(() => window.App.pageTextItems(0).map((t) => t.str).join(' '));
    expect(text).toContain('KITCHEN');
    expect(text).toContain('GREASE INTERCEPTOR');
    expect(errors).toEqual([]);
  });

  test('Project Settings has the same door, and the offer outlives the tours', async ({ page }) => {
    const errors = [];
    await page.addInitScript(() => { try { localStorage.setItem('clickcount-tour-done', '1'); localStorage.setItem('clickcount-tour-done-plumbing', '1'); localStorage.setItem('clickcount-tour-done-hvac', '1'); } catch (_) {} });
    await boot(page, errors);
    // every tour done: the tour offer is gone, the advanced offer stays without a dangling separator
    await expect(page.locator('.canvas-empty-hint-tour')).toBeHidden();
    await expect(page.locator('#canvasEmptyHintAdvancedPlan')).toBeVisible();
    await expect(page.locator('#canvasEmptyHintAdvancedSep')).toBeHidden();
    await page.evaluate(() => window.App.showModal('settingsModal'));
    const door = page.locator('#settingsAdvancedPlan');
    await expect(door).toBeVisible();
    await door.click();
    await expect(page.locator('#settingsModal')).not.toHaveClass(/visible/);
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 15000 });
    expect(await page.evaluate(() => window.state.pages[0].label)).toContain('sample-plan-advanced');
    expect(typeof await page.evaluate(() => typeof window.App.openAdvancedSamplePlan)).toBe('string');
    expect(errors).toEqual([]);
  });
});

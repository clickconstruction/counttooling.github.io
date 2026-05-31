// @ts-check
/**
 * Tests: the window.App registry pilot #23 - the Quick Plumbing + Quick Count
 * modals extracted to features/quick-modals.js. Non-cloud; the populators render
 * from local modifier/icon state, and the #plumBtn opener exercises the
 * bidirectional path into features/counter.js (showCounterTab('quickcount') ->
 * App.populateCounterQuickCountPanel).
 */
const { test, expect } = require('@playwright/test');

test.describe('window.App registry pilot - Quick modals', () => {
  test('registry wired; both populators render without throwing', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => typeof window.App?.populatePlumModal)).toBe('function');
    expect(await page.evaluate(() => typeof window.App?.populateCounterQuickCountPanel)).toBe('function');
    expect(await page.evaluate(() => typeof window.App?.updateCounterQuickCountNamePreview)).toBe('function');

    // Both populators render from local modifier/icon state - no PDF needed.
    const result = await page.evaluate(() => {
      try {
        window.App.populatePlumModal();
        window.App.populateCounterQuickCountPanel();
        return true;
      } catch (e) { return String(e && e.message || e); }
    });
    expect(result).toBe(true);

    // The Quick Plumbing icon grid populated.
    expect(await page.locator('#plumIconGrid .icon-cell').count()).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test('showCounterTab(quickcount) crosses into the feature and populates the panel', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // counter.js's showCounterTab('quickcount') calls App.populateCounterQuickCountPanel
    // (registered by features/quick-modals.js) - exercise that registry-mediated
    // bidirectional path directly (the #plumBtn toolbar opener gates on scale).
    const result = await page.evaluate(() => {
      try { window.App.showCounterTab('quickcount'); return true; } catch (e) { return String((e && e.message) || e); }
    });
    expect(result).toBe(true);

    // The Quick Count panel rendered (proof the cross-feature call ran).
    const populated = await page.evaluate(() => {
      const p = document.getElementById('counterQuickCountPanel');
      return !!p && p.innerHTML.trim().length > 0;
    });
    expect(populated).toBe(true);

    expect(errors).toEqual([]);
  });
});

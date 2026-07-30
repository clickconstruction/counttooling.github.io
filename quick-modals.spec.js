// @ts-check
/**
 * Tests: the window.App registry pilot #23 - the Quick Count panel extracted
 * to features/quick-modals.js. Non-cloud; the populator renders from local
 * modifier/icon state. The legacy #plumModal surface (and its
 * App.populatePlumModal registration) was removed 2026-07-30 — the #plumBtn
 * opener now only routes into the Counter modal's Quick Count tab
 * (showCounterTab('quickcount') -> App.populateCounterQuickCountPanel).
 */
const { test, expect } = require('@playwright/test');

test.describe('window.App registry pilot - Quick modals', () => {
  test('registry wired; the Quick Count populator renders without throwing', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => typeof window.App?.populateCounterQuickCountPanel)).toBe('function');
    expect(await page.evaluate(() => typeof window.App?.updateCounterQuickCountNamePreview)).toBe('function');
    // The legacy Quick Plumbing modal is gone: neither the registration nor
    // its markup should exist.
    expect(await page.evaluate(() => typeof window.App?.populatePlumModal)).toBe('undefined');
    expect(await page.locator('#plumModal').count()).toBe(0);

    // The populator renders from local modifier/icon state - no PDF needed.
    const result = await page.evaluate(() => {
      try {
        window.App.populateCounterQuickCountPanel();
        return true;
      } catch (e) { return String(e && e.message || e); }
    });
    expect(result).toBe(true);

    // The Quick Count icon grid populated.
    expect(await page.locator('#counterQuickCountIconGrid .icon-cell').count()).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test('showCounterTab(quickcount) crosses into the feature and populates the panel', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
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

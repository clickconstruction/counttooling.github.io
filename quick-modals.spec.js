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

// T2 #16: Quick Count never mints a counter whose icon+color duplicate an
// existing counter — the color rotates to a free palette entry (shared
// nextUnusedCounterColor, recent-colors.js) and the panel previews the color
// that will actually mint. plumbingModifiers.defaultColor is never rewritten.
test.describe('Quick Count no-twin create', () => {
  const RED = 'rgb(232, 84, 71)'; // COLORS[0] #e85447
  const YELLOW = 'rgb(232, 197, 71)'; // COLORS[2] #e8c547 (the Quick Count default)

  async function openQuickCountWithSeed(page) {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    // Seed an existing counter on the default icon+color pairing (the stock
    // "Water Closet" shape from the dossier).
    await page.evaluate(() => {
      window.state.counters.push({ id: 'seed-wc', name: 'Water Closet', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' });
      document.getElementById('counterBtn').click();
      window.App.showCounterTab('quickcount');
    });
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
  }

  async function clickAddAndReadResult(page) {
    await page.locator('#counterQuickCountAdd').click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    return page.evaluate(() => {
      const cs = window.state.counters;
      const last = cs[cs.length - 1];
      let storedDefaultColor = null;
      try { storedDefaultColor = JSON.parse(localStorage.getItem('plumbingModifiers') || '{}').defaultColor || null; } catch { /* absent */ }
      return { count: cs.length, icon: last.icon, color: last.color, seedIcon: cs[0].icon, storedDefaultColor };
    });
  }

  test('untouched panel: swatch previews the rotated color and Add mints it (no identical twin)', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await openQuickCountWithSeed(page);

    // WYSIWYG before Add: the swatch (and icon preview) already show the
    // rotated color, with the explanatory title.
    const swatch = page.locator('#counterQuickCountSwatch');
    await expect(swatch).toHaveCSS('background-color', RED);
    await expect(swatch).toHaveAttribute('title', "Color adjusted so these marks don't match an existing counter");

    const result = await clickAddAndReadResult(page);
    expect(result.count).toBe(2);
    expect(result.icon).toBe(result.seedIcon); // icon behavior unchanged
    expect(result.color).toBe('#e85447'); // COLORS[0] — first free palette entry
    expect(result.storedDefaultColor).toBeNull(); // rotation is per-create, never saved

    // The two sidebar rows are visually distinct (different icon fills).
    const fills = await page.$$eval('#countersList .sidebar-item .counter-drag-handle path', (ps) => ps.map((p) => p.getAttribute('fill')));
    expect(fills.length).toBe(2);
    expect(fills[0]).not.toBe(fills[1]);

    expect(errors).toEqual([]);
  });

  test('deliberately distinct icon: no rotation, the saved default color mints', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await openQuickCountWithSeed(page);

    // Pick the second library icon — a different icon means no twin, so the
    // preview drops back to the default yellow.
    await page.locator('#counterQuickCountIconGrid .icon-cell').nth(1).click();
    const swatch = page.locator('#counterQuickCountSwatch');
    await expect(swatch).toHaveCSS('background-color', YELLOW);
    await expect(swatch).toHaveAttribute('title', 'Change color');

    const result = await clickAddAndReadResult(page);
    expect(result.icon).not.toBe(result.seedIcon);
    expect(result.color).toBe('#e8c547');
    expect(result.storedDefaultColor).toBeNull();

    expect(errors).toEqual([]);
  });

  test('a user-added custom type still gets the no-twin rotation (no stock-name dependence)', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await openQuickCountWithSeed(page);

    // Add a custom type via the "+" prompt flow, panel otherwise untouched.
    page.once('dialog', (dialog) => dialog.accept('Cleanout Tee'));
    await page.locator('#counterQuickCountAddType').click();
    await page.waitForFunction(() => document.getElementById('counterQuickCountType')?.value === 'Cleanout Tee', { timeout: 5000 });

    const result = await clickAddAndReadResult(page);
    expect(result.icon).toBe(result.seedIcon); // still the pre-selected first icon
    expect(result.color).toBe('#e85447'); // rotation carries custom types
    // The "+" flow re-saved the modifiers, but defaultColor stayed the base
    // yellow — the rotation never writes back.
    expect(result.storedDefaultColor).toBe('#e8c547');

    expect(errors).toEqual([]);
  });
});

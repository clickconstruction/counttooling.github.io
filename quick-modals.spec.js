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

  // T2-16: Quick Count counters used to silently inherit the first library
  // icon + the default color for EVERY Type — a "0.5in PEX Tee" mark rendered
  // identical to a "Water Closet" mark and the error only surfaced at pricing
  // time. The create path now defaults a per-Type icon (matched against the
  // bundled icon library's search terms) and rotates the color when the
  // icon+color pair would visually duplicate an existing counter.
  const quickCreate = (page, type) => page.evaluate((t) => {
    window.App.showCounterTab('quickcount');
    const sel = document.getElementById('counterQuickCountType');
    if (![...sel.options].some((o) => o.value === t)) {
      const mods = window.App.getPlumbingModifiers();
      mods.types.push(t);
      window.App.savePlumbingModifiers(mods);
      window.App.populateCounterQuickCountPanel();
    }
    sel.value = t;
    sel.dispatchEvent(new Event('change'));
    document.getElementById('counterQuickCountAdd').click();
    const c = window.App.state.counters[window.App.state.counters.length - 1];
    return { name: c.name, icon: c.icon, color: c.color };
  }, type);

  test('different Quick Count Types mint visually distinguishable counters', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const tee = await quickCreate(page, 'Tee');
    const valve = await quickCreate(page, 'Ball Valve');

    expect(tee.name).toContain('Tee');
    expect(valve.name).toContain('Ball Valve');
    // The marks must be tellable apart on the sheet: different icon, or —
    // when no per-Type icon exists — a rotated color.
    const sameIcon = tee.icon === valve.icon;
    const sameColor = tee.color.toLowerCase() === valve.color.toLowerCase();
    expect(sameIcon && sameColor).toBe(false);
    // "Tee" has a matching library glyph, so it should not fall back to the
    // first library icon (Water Closet).
    const teeIconName = await page.evaluate((p) => window.App.getIconName(p), tee.icon);
    expect(teeIconName).not.toBe('Water Closet');
  });

  test('icon+color collision with an existing counter rotates the color', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Same Type twice: same default icon, so the second create must rotate
    // its color off the first to stay distinguishable.
    const a = await quickCreate(page, 'Ball Valve');
    const b = await quickCreate(page, 'Ball Valve');
    expect(b.icon).toBe(a.icon);
    expect(b.color.toLowerCase()).not.toBe(a.color.toLowerCase());
    const palette = await page.evaluate(() => window.App.COLORS.map((c) => c.toLowerCase()));
    expect(palette).toContain(b.color.toLowerCase());
  });

  test('custom user Types create fine and keyword-match the library when possible', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const drain = await quickCreate(page, 'Floor Drain');
    expect(drain.name).toContain('Floor Drain');
    expect(typeof drain.icon).toBe('string');
    expect(drain.icon.length).toBeGreaterThan(0);
    // 'drain' is an icon-library search term (Circle Ring) — the default
    // should pick it up rather than the first library icon.
    const iconName = await page.evaluate((p) => window.App.getIconName(p), drain.icon);
    expect(iconName).not.toBe('Water Closet');

    // A fully unknown custom type still creates (library fallback icon).
    const mystery = await quickCreate(page, 'Zzyzx Widget');
    expect(mystery.name).toContain('Zzyzx Widget');
    expect(mystery.icon.length).toBeGreaterThan(0);

    // The modifier store survived the custom-type additions (persistence
    // regression guard for plumbingModifiers).
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('plumbingModifiers')));
    expect(persisted.types).toContain('Floor Drain');
    expect(persisted.types).toContain('Zzyzx Widget');
  });
});

// @ts-check
/**
 * The rulebook in the app (features/rules.js, rulebook slice 2).
 *
 * Guards: rules.json loads at boot and App.getRule reads it; a derived Bid
 * Check row carries a § chip naming its citation; the chip opens one popover
 * that states the value as the app applies it, the section, the editions, and
 * what uses it, and links to the rule page; Escape closes it without touching
 * the active tool; an outside click closes it; a static chip in Project
 * Settings is filled when the list arrives; the Chain palette cites the
 * mount-height and make-up rules when the counter has a mount height.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function seedElectrical(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => {
    const s = window.state, App = window.App;
    s.trade = 'electrical';
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    const CM = window.ConductorModel;
    const conductors = CM.parseConductorSpec('9 #12 THHN + 1 #12 G').conductors;
    s.lineTypes.push({ id: 'emt', name: '1/2" EMT', color: '#8a4bb0', curveStyle: 'straight', raceway: { kind: 'EMT', size: '1/2"' }, conductors });
    s.counters.push({ id: 'rcp', name: 'Duplex Receptacle', icon: App.getOrderedIcons()[0].value, color: '#e85447', mountHeightIn: 18 });
    const ann = App.getActiveAnnotations(s.pages[0]);
    ann.quickLines.push({ id: 'q1', x1: 20, y1: 20, x2: 200, y2: 20, color: '#8a4bb0', lineTypeId: 'emt', group: null });
    s.bidCheckCollapsed = false;
    App.markProjectDirty(); App.updateUI();
  });
}

test.describe('Rulebook chips and popover', () => {
  test('rules.json loads; a Bid Check row carries its § chip; the popover states the value as applied and closes on Escape and outside click', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await seedElectrical(page);
    await page.evaluate(() => window.App.rulesReady());
    expect(await page.evaluate(() => window.App.rulesCount())).toBeGreaterThanOrEqual(13);
    expect(await page.evaluate(() => window.App.getRule('elec.conduit.fill-limit').values[2].value)).toBe(40);
    // the row cites the rule
    const chip = page.locator('#bidCheckList .bid-check-row.auto .rule-chip[data-rule="elec.conduit.fill-limit"]');
    await expect(chip).toBeVisible();
    expect(await chip.textContent()).toBe('§ NEC Chapter 9');
    // no chip on a row the app checks without a public rule
    expect(await page.locator('#bidCheckList .rule-chip[data-rule="circuits-vs-panel"]').count()).toBe(0);
    // click → the popover, with the value as applied, the section, and the surfaces
    await chip.click();
    const pop = page.locator('#rulePopover');
    await expect(pop).toBeVisible();
    const text = (await pop.textContent()) || '';
    expect(text).toContain('Conduit fill limits');
    expect(text).toContain('3 or more conductors');
    expect(text).toContain('40');
    expect(text).toContain('Chapter 9, Table 1');
    expect(text).toContain('2017 · 2020 · 2023');
    expect(text).toContain('Bid Check');
    expect(await pop.locator('a[href="/rules/electrical/conduit-fill/"]').count()).toBe(1);
    // Escape closes it and does not reach the Esc ladder (tool unchanged)
    await page.evaluate(() => { window.state.tool = window.App.TOOL.COUNTER; window.App.updateUI(); });
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.COUNTER)).toBe(true);
    // a second click toggles it; an outside click closes it
    await chip.click();
    await expect(pop).toBeVisible();
    await page.mouse.click(700, 500);
    await expect(pop).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('a static chip in Project Settings is filled from the list; the Chain palette cites the vertical rules', async ({ page }) => {
    await seedElectrical(page);
    await page.evaluate(() => window.App.rulesReady());
    await page.evaluate(() => window.App.showModal('settingsModal'));
    const chip = page.locator('#settingsModal .rule-chip[data-rule="elec.vertical.make-up"]');
    await expect(chip).toBeVisible();
    expect(await chip.textContent()).toBe('convention');
    await chip.click();
    const pop = page.locator('#rulePopover');
    await expect(pop).toBeVisible();
    expect(await pop.textContent()).toContain('Make-up on a vertical');
    expect(await pop.textContent()).toContain('1');
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    // the settings modal is still open: Escape went to the popover, not the ladder
    expect(await page.locator('#settingsModal').evaluate((m) => m.classList.contains('visible'))).toBe(true);
    await page.evaluate(() => window.App.hideModal('settingsModal'));
    // chain palette with a mount-height counter
    await page.evaluate(() => { const s = window.state; s.activeCounterType = 'rcp'; s.activeLineTypeId = 'emt'; s.tool = window.App.TOOL.CHAIN; window.App.updateUI(); });
    await expect(page.locator('#chainPanelFoot .rule-chip[data-rule="elec.mount-height.defaults"]')).toBeVisible();
    await expect(page.locator('#chainPanelFoot .rule-chip[data-rule="elec.vertical.make-up"]')).toBeVisible();
  });

  test('the machine-readable rulebook is precached: a fresh load serves it from the service worker', async ({ page, context }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    // wait for the SW to control the page, then confirm rules.json is in the precache
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      for (const k of keys) { const c = await caches.open(k); if (await c.match('/rules/rules.json')) return true; }
      return false;
    });
    expect(cached).toBe(true);
    await context.close();
  });
});

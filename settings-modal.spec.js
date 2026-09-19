// @ts-check
/**
 * Project Settings on small viewports (from claude/settings-modal-small-viewports,
 * re-applied 2026-09-14 onto the rulebook-era block).
 *
 * Reported on a phone-sized window: the settings sheet had grown (Trade, Codes,
 * Jurisdiction, Ceiling height, three tour links) past the viewport and its top,
 * Save Project to Cloud, was centred off-screen with no way to reach it. Guards:
 * the card stays inside the viewport and scrolls internally; every row is
 * reachable; even if the card's own max-height were lost, the overlay scrolls so
 * the header is still reachable (safe centring: margin:auto on the card, overflow
 * on the overlay); the project rows keep working at phone width; the order reads
 * cloud actions → This project → footer links → Advanced.
 *
 * 2026-09-15 layout pass (direction A): the project name is a subtitle under the
 * title, the checkout state is a one-line status strip, the secondaries sit in a
 * grid under Save, each project row is label + control with a one-line hint under
 * them, Quick keys joined This project, and the footer holds Load project / Help
 * (the tours and shortcuts unfold under it) / Clear Page / Advanced as links.
 */
const { test, expect } = require('@playwright/test');

async function openSettings(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/app/');
  await page.waitForFunction(() => window.App && window.state);
  await page.evaluate(() => window.App.showModal('settingsModal'));
  await page.waitForSelector('#settingsModal.visible');
}
const rect = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel);

test.describe('Project Settings on small viewports', () => {
  for (const [w, h] of [[375, 812], [820, 560]]) {
    test(`${w}×${h}: the card fits the viewport, scrolls, and every row is reachable`, async ({ page }) => {
      await openSettings(page, w, h);
      const card = await rect(page, '#settingsModal .modal-card');
      expect(card.top).toBeGreaterThanOrEqual(0);
      expect(card.bottom).toBeLessThanOrEqual(h + 0.5);
      const scrolls = await page.evaluate(() => { const c = document.querySelector('#settingsModal .modal-card'); return c.scrollHeight > c.clientHeight && getComputedStyle(c).overflowY === 'auto'; });
      expect(scrolls).toBe(true);
      // the header is visible at rest
      const save = await rect(page, '#settingsSaveProject');
      expect(save.top).toBeGreaterThanOrEqual(card.top);
      // and the last row can be scrolled to and used
      await page.locator('#settingsAdvancedBtn').scrollIntoViewIfNeeded();
      const adv = await rect(page, '#settingsAdvancedBtn');
      expect(adv.bottom).toBeLessThanOrEqual(h + 0.5);
      // the project rows work at this width
      await page.locator('#settingsTradeSegment [data-trade="electrical"]').scrollIntoViewIfNeeded();
      await page.click('#settingsTradeSegment [data-trade="electrical"]');
      expect(await page.evaluate(() => window.state.trade)).toBe('electrical');
      await page.fill('#settingsCeilingHeight', "10'-0\"");
      await page.press('#settingsCeilingHeight', 'Enter');
      expect(await page.evaluate(() => window.state.ceilingHeightFt)).toBe(10);
      if (w <= 768) {
        // on a phone the trade segment sits under its label, full width, 44px targets
        const seg = await rect(page, '#settingsTradeSegment');
        const text = await rect(page, '#settingsTradeRow .settings-project-row-text');
        expect(seg.top).toBeGreaterThanOrEqual(text.bottom - 1);
        expect(seg.width).toBeGreaterThan(text.width * 0.9);
        const btn = await rect(page, '#settingsTradeSegment [data-trade="hvac"]');
        expect(btn.height).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test('safe centring: with the card max-height removed the overlay scrolls and the top stays reachable', async ({ page }) => {
    await openSettings(page, 375, 560);
    await page.evaluate(() => { const c = document.querySelector('#settingsModal .modal-card'); c.style.maxHeight = 'none'; c.style.overflowY = 'visible'; });
    await page.waitForTimeout(50);
    const top = await page.evaluate(() => { const o = document.getElementById('settingsModal'); o.scrollTop = 0; return document.querySelector('#settingsModal .modal-card').getBoundingClientRect().top; });
    expect(top).toBeGreaterThanOrEqual(0);
    const overlayScrolls = await page.evaluate(() => { const o = document.getElementById('settingsModal'); return o.scrollHeight > o.clientHeight && getComputedStyle(o).overflowY === 'auto'; });
    expect(overlayScrolls).toBe(true);
    await page.evaluate(() => { const o = document.getElementById('settingsModal'); o.scrollTop = o.scrollHeight; });
    const adv = await rect(page, '#settingsAdvancedBtn');
    expect(adv.bottom).toBeLessThanOrEqual(560.5);
  });

  test('order: This project (Trade, Codes, Jurisdiction, Ceiling, Use groups, Sheets, Quick keys), then the footer (Close project, Load project, Help, Advanced), then the one primary, Save', async ({ page }) => {
    await openSettings(page, 1280, 800);
    // Modal polish (2026-09-18): one primary action, in the footer .actions; Add pages /
    // Download PDF became the Sheets row; Close project is a footer link.
    const order = await page.evaluate(() => ['settingsProjectSection', 'settingsTradeRow', 'settingsCodesRow', 'settingsJurisdictionRow', 'settingsCeilingRow', 'settingsUseGroupsRow', 'settingsSheetsRow', 'settingsQuickKeysRow', 'settingsCloseProject', 'settingsLoadProject', 'settingsAdvancedBtn', 'settingsSaveProject'].map((id) => document.getElementById(id).getBoundingClientRect()).filter((r) => r.height > 0).map((r) => r.top));   // rows hidden with no project open (Sheets, Close project) drop out
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThanOrEqual(order[i - 1]);
    expect(await page.locator('#settingsProjectSection .settings-project-label').textContent()).toBe('This project');
    // desktop: label and control share the row, the hint sits under them
    const seg = await rect(page, '#settingsTradeSegment');
    const text = await rect(page, '#settingsTradeRow .settings-project-row-text');
    expect(Math.abs((seg.top + seg.height / 2) - (text.top + text.height / 2))).toBeLessThan(text.height);
    const hint = await rect(page, '#settingsTradeRow .settings-project-row-hint');
    expect(hint.top).toBeGreaterThanOrEqual(seg.bottom - 1);
    // the codes are three labelled selects on one line
    const cells = await page.$$eval('#settingsCodesRow .settings-code-cell', (els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    expect(cells.length).toBe(3);
    expect(Math.abs(cells[0].top - cells[2].top)).toBeLessThan(2);
  });

  test('header: the project name is a subtitle, never part of the title', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/app/');
    await page.waitForFunction(() => window.App && window.state);
    // no project: title only
    await page.evaluate(() => document.getElementById('settingsGearBtn').click());
    await page.waitForSelector('#settingsModal.visible');
    expect(await page.locator('#settingsTitle').textContent()).toBe('Project Settings');
    await expect(page.locator('#settingsSubtitle')).toBeHidden();
    await page.evaluate(() => window.App.hideModal('settingsModal'));
    // a (long) project name rides the subtitle line and the title stays put
    await page.evaluate(() => { window.state.currentProjectName = 'Prue Rd EC · Combined PPR Set 6-12-26'; window.state.currentProjectId = 'p1'; document.getElementById('settingsGearBtn').click(); });
    await page.waitForSelector('#settingsModal.visible');
    expect(await page.locator('#settingsTitle').textContent()).toBe('Project Settings');
    expect(await page.locator('#settingsSubtitle').textContent()).toBe('Prue Rd EC · Combined PPR Set 6-12-26');
    const title = await rect(page, '#settingsTitle');
    expect(title.height).toBeLessThan(30);
  });

  test('footer: Help unfolds the tour and shortcut links; the review row stays hidden signed out', async ({ page }) => {
    await openSettings(page, 1280, 800);
    await expect(page.locator('#settingsHelpLinks')).toBeHidden();
    await expect(page.locator('#settingsReviewRow')).toBeHidden();
    await page.click('#settingsHelpToggle');
    await expect(page.locator('#settingsHelpLinks')).toBeVisible();
    for (const id of ['settingsMacros', 'settingsTourPlumbing', 'settingsTour', 'settingsTourHvac', 'settingsAdvancedPlan']) await expect(page.locator('#' + id)).toBeVisible();
    expect(await page.getAttribute('#settingsHelpToggle', 'aria-expanded')).toBe('true');
    await page.click('#settingsHelpToggle');
    await expect(page.locator('#settingsHelpLinks')).toBeHidden();
    // a later updateUI (which resets every .supabase-only) must not resurrect the review row
    await page.evaluate(() => window.App.updateUI());
    await expect(page.locator('#settingsReviewRow')).toBeHidden();
  });
});

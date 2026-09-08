// @ts-check
/**
 * Project Settings on small viewports.
 *
 * Reported on a phone-sized window: the settings sheet had grown (Trade, Ceiling
 * height, the tour link) past the viewport and its top — Save Project to Cloud —
 * was centred off-screen with no way to reach it. Guards: the card stays inside
 * the viewport and scrolls internally; every row is reachable; even if the card's
 * own max-height were lost, the overlay scrolls so the header is still reachable
 * (safe centring — margin:auto on the card, overflow on the overlay); the project
 * rows keep working at phone width; the row order reads actions → this project →
 * footer links.
 */
const { test, expect } = require('@playwright/test');

async function openSettings(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.App.showModal('settingsModal'));
  await page.waitForSelector('#settingsModal.visible');
}
const rect = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel);

test.describe('Project Settings — small viewports', () => {
  for (const [w, h] of [[375, 812], [820, 560]]) {
    test(`${w}×${h}: the card fits the viewport, scrolls, and every row is reachable`, async ({ page }) => {
      await openSettings(page, w, h);
      const card = await rect(page, '#settingsModal .modal-card');
      expect(card.top).toBeGreaterThanOrEqual(0);
      expect(card.bottom).toBeLessThanOrEqual(h + 0.5);
      const scrolls = await page.evaluate(() => { const c = document.querySelector('#settingsModal .modal-card'); return c.scrollHeight > c.clientHeight && getComputedStyle(c).overflowY === 'auto'; });
      expect(scrolls).toBe(true);
      // the header is visible at rest…
      const save = await rect(page, '#settingsSaveProject');
      expect(save.top).toBeGreaterThanOrEqual(card.top);
      // …and the last row can be scrolled to and used
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
        // on a phone the trade segment sits under its label, full width
        const seg = await rect(page, '#settingsTradeSegment');
        const text = await rect(page, '#settingsTradeRow .settings-project-row-text');
        expect(seg.top).toBeGreaterThanOrEqual(text.bottom - 1);
        expect(seg.width).toBeGreaterThan(text.width * 0.9);
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

  test('order: cloud actions, then This project (Trade, Ceiling, Use groups), then the footer links and Advanced', async ({ page }) => {
    await openSettings(page, 1280, 800);
    const order = await page.evaluate(() => ['settingsSaveProject', 'settingsLoadProject', 'settingsProjectSection', 'settingsTradeRow', 'settingsCeilingRow', 'settingsUseGroupsRow', 'settingsQuickKeys', 'settingsTour', 'settingsAdvancedBtn'].map((id) => document.getElementById(id).getBoundingClientRect().top));
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThanOrEqual(order[i - 1]);
    expect(await page.locator('#settingsProjectSection .settings-project-label').textContent()).toBe('This project');
    // desktop: label and control share the row
    const seg = await rect(page, '#settingsTradeSegment');
    const text = await rect(page, '#settingsTradeRow .settings-project-row-text');
    expect(Math.abs((seg.top + seg.height / 2) - (text.top + text.height / 2))).toBeLessThan(text.height);
  });
});

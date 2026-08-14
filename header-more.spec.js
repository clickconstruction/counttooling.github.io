// @ts-check
/**
 * Tests: the header "⋯ More tools" overflow (features/header-more.js).
 * On desktop widths where the priority-reordered tools row would overflow
 * into the invisible-scrollbar scroll, the low-frequency tool group
 * (Polyline, Highlight, Multiply Zone, Scale Zone, Room Sizer, Delete Area,
 * Note, Legend, Grid) tucks behind #headerMoreBtn. The dropdown rows show icon + NAME + hotkey,
 * click through to the real buttons, and the ⋯ takes the shared gold
 * .active whenever the active tool lives in the menu. Wide headers show
 * every tool and no ⋯.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadPdf(page) {
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

test.describe('Header ⋯ More tools overflow', () => {
  test('wide header: all tools inline, no ⋯; priority order puts counting tools first', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);

    await expect(page.locator('#headerMoreBtn')).toBeHidden();
    await expect(page.locator('#multiplyZoneBtn')).toBeVisible();
    await expect(page.locator('#gridBtn')).toBeVisible();
    // Priority reorder: Counter/Quick Line now precede Measure (Polyline
    // moved into the overflow group 2026-08-14).
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.header-tools-tight > button')].map((b) => b.id));
    expect(order.indexOf('counterBtn')).toBeLessThan(order.indexOf('measureBtn'));
    expect(order.indexOf('quickLine')).toBeLessThan(order.indexOf('measureBtn'));
  });

  test('narrow desktop: group tucks behind ⋯; menu rows click through; active state tracks', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);

    // More mode engaged: ⋯ visible, the group hidden, everyday tools inline.
    await expect(page.locator('#headerMoreBtn')).toBeVisible();
    await expect(page.locator('#polylineBtn')).toBeHidden();
    await expect(page.locator('#highlightBtn')).toBeHidden();
    await expect(page.locator('#multiplyZoneBtn')).toBeHidden();
    await expect(page.locator('#counterBtn')).toBeVisible();
    await expect(page.locator('#quickLine')).toBeVisible();

    // Menu: 9 named rows with hotkey badges where defined.
    await page.locator('#headerMoreBtn').click();
    const rows = page.locator('#headerMoreMenu .hm-row');
    await expect(rows).toHaveCount(9);
    await expect(rows.first()).toContainText('Polyline');
    await expect(rows.first().locator('.hm-key')).toHaveText('P');
    await expect(page.locator('#headerMoreMenu')).toContainText('Multiply Zone');
    await expect(page.locator('#headerMoreMenu')).toContainText('Room Sizer');
    await expect(rows.filter({ hasText: 'Note' }).locator('.hm-key')).toHaveText('N');

    // Row click drives the REAL button: Note tool activates, menu closes,
    // and the ⋯ takes the gold active state since its tool is tucked away.
    await rows.filter({ hasText: 'Note' }).click();
    await expect(page.locator('#headerMoreMenu')).toBeHidden();
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.NOTE)).toBe(true);
    await expect(page.locator('#headerMoreBtn')).toHaveClass(/active/);

    // Picking a visible tool clears the ⋯ active state.
    await page.locator('#moveBtn').click();
    await expect(page.locator('#headerMoreBtn')).not.toHaveClass(/active/);

    // Escape / outside-click hygiene.
    await page.locator('#headerMoreBtn').click();
    await expect(page.locator('#headerMoreMenu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#headerMoreMenu')).toBeHidden();

    // Widening restores the inline group and hides ⋯.
    await page.setViewportSize({ width: 1700, height: 800 });
    await expect(page.locator('#headerMoreBtn')).toBeHidden();
    await expect(page.locator('#multiplyZoneBtn')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

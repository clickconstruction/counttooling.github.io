// @ts-check
/**
 * Tests: the header "⋯ More tools" group (features/header-more.js).
 * At EVERY desktop width the low-frequency tool group (Polyline, Highlight,
 * Multiply Zone, Scale Zone, Room Sizer, Delete Area, Note, Legend, Grid)
 * lives behind #headerMoreBtn unconditionally — no overflow measure
 * (2026-08-15 clutter feedback; previously the tuck was overflow-gated).
 * The dropdown rows show icon + NAME + hotkey, click through to the real
 * buttons, and the ⋯ takes the shared gold .active whenever the active tool
 * lives in the menu. Mobile (≤768px) is untouched.
 * D14 (2026-09-12, "keep the strip order"): Duct is a menu row too, but its
 * strip button stays inline at its DOM position (not in the CSS hide list);
 * at 390px the ⋯ is gone and Duct is reachable via B9's padded strip scroll.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadPdf(page) {
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

test.describe('Header ⋯ More tools overflow', () => {
  test('wide header: group still tucked behind ⋯ (unconditional); priority order holds', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);

    // Even with room to spare, the low-frequency group stays in the menu.
    await expect(page.locator('#headerMoreBtn')).toBeVisible();
    await expect(page.locator('#multiplyZoneBtn')).toBeHidden();
    await expect(page.locator('#gridBtn')).toBeHidden();
    await expect(page.locator('#counterBtn')).toBeVisible();
    // Priority reorder: Counter/Quick Line now precede Measure (Polyline
    // moved into the overflow group 2026-08-14).
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.header-tools-tight > button')].map((b) => b.id));
    expect(order.indexOf('counterBtn')).toBeLessThan(order.indexOf('measureBtn'));
    expect(order.indexOf('quickLine')).toBeLessThan(order.indexOf('measureBtn'));
  });

  test('menu rows click through; active state tracks; stays engaged when widening', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);

    // More mode engaged: ⋯ visible, the group hidden, everyday tools inline.
    await expect(page.locator('#headerMoreBtn')).toBeVisible();
    // D21 (J5-D): re-arranging the strip is opt-in, so a trade-less project
    // keeps D14's arrangement — Polyline tucked, Duct inline.
    await expect(page.locator('#polylineBtn')).toBeHidden();
    await expect(page.locator('#ductBtn')).toBeVisible();
    await expect(page.locator('#highlightBtn')).toBeHidden();
    await expect(page.locator('#multiplyZoneBtn')).toBeHidden();
    await expect(page.locator('#counterBtn')).toBeVisible();
    await expect(page.locator('#quickLine')).toBeVisible();

    // Menu: 11 named rows (10 tucked tools + the D14 Duct row) with hotkey
    // badges where defined.
    await page.locator('#headerMoreBtn').click();
    const rows = page.locator('#headerMoreMenu .hm-row');
    await expect(rows).toHaveCount(11);
    // Row ORDER still mirrors the strip's DOM order — D21 moves visibility, never
    // position, so the menu reads the same whichever tools are inline.
    await expect(rows.first()).toContainText('Polyline');
    await expect(rows.first().locator('.hm-key')).toHaveText('P');
    await expect(rows.nth(1)).toContainText('Duct');   // strip order: Polyline, Duct, Highlight …
    await expect(rows.nth(1)).toHaveAttribute('data-tool-id', 'ductBtn');
    // D18: the key column is READ from App.HOTKEYS (hotkeys.js) — Duct's row
    // shows the letter the keydown handler executes, and a row whose button
    // has no table entry renders no <kbd> at all.
    await expect(rows.nth(1).locator('.hm-key')).toHaveText(await page.evaluate(() => window.App.HOTKEYS.find((h) => h.btnId === 'ductBtn').key.toUpperCase()));
    await expect(rows.filter({ hasText: 'Scale Zone' }).locator('.hm-key')).toHaveCount(0);
    await expect(page.locator('#headerMoreMenu')).toContainText('Multiply Zone');
    await expect(page.locator('#headerMoreMenu')).toContainText('Room Sizer');
    await expect(rows.filter({ hasText: 'Ghost' }).locator('.hm-key')).toHaveText('G');
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

    // Widening does NOT restore the inline group — the tuck is unconditional.
    await page.setViewportSize({ width: 1700, height: 800 });
    await expect(page.locator('#headerMoreBtn')).toBeVisible();
    await expect(page.locator('#multiplyZoneBtn')).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('D14: Duct rides the ⋯ menu WITHOUT leaving the strip; desktop order unchanged', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);

    // D21 (J5-D): D14's arrangement survives as the unstated AND the HVAC case.
    // Inline: Duct stays VISIBLE in the strip at its shipped DOM position —
    // after Polyline, before Highlight. Only visibility is trade-aware; the
    // strip's DOM order never moves.
    await expect(page.locator('body')).toHaveClass(/header-more/);
    await expect(page.locator('#ductBtn')).toBeVisible();
    await expect(page.locator('#polylineBtn')).toBeHidden();
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.header-tools-tight > button')].map((b) => b.id));
    expect(order.indexOf('measureBtn')).toBeLessThan(order.indexOf('polylineBtn'));
    expect(order.indexOf('polylineBtn')).toBeLessThan(order.indexOf('ductBtn'));
    expect(order.indexOf('ductBtn')).toBeLessThan(order.indexOf('highlightBtn'));
    expect(order.indexOf('ductBtn')).toBeLessThan(order.indexOf('headerMoreBtn'));

    // The menu row clicks through to the REAL #ductBtn (same handler: the
    // click lands on the inline button — scale-gated arming and all).
    await page.locator('#headerMoreBtn').click();
    const ductRow = page.locator('#headerMoreMenu .hm-row[data-tool-id="ductBtn"]');
    await expect(ductRow).toBeVisible();
    await expect(ductRow).toContainText('Duct');
    await page.evaluate(() => { window.__ductClicks = 0; document.getElementById('ductBtn').addEventListener('click', () => { window.__ductClicks++; }); });
    await ductRow.click();
    await expect(page.locator('#headerMoreMenu')).toBeHidden();
    expect(await page.evaluate(() => window.__ductClicks)).toBe(1);

    // The ⋯ indicator stays quiet for Duct: the inline button shows the gold
    // itself (an inline tool is excluded from anyOverflowedToolActive — D21
    // resolves that from the trade + pins rather than a fixed `strip` flag).
    await page.evaluate(() => { document.getElementById('ductBtn').classList.add('active'); window.App.onHeaderMoreSync(); });
    await expect(page.locator('#headerMoreBtn')).not.toHaveClass(/active/);

    expect(errors).toEqual([]);
  });

  test('D14: at 390px the ⋯ is gone and Duct is reachable via the padded strip scroll', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 390, height: 844 });   // B9's mobile-touch.spec viewport
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);

    await expect(page.locator('body')).not.toHaveClass(/header-more/);
    await expect(page.locator('#headerMoreBtn')).toBeHidden();
    // Scroll the strip to Duct: the button lands fully inside the viewport
    // and clear of the burger's tap zone (B9's padding-right guarantee).
    const box = await page.evaluate(() => {
      const strip = document.querySelector('.header-tools-scroll');
      const btn = document.getElementById('ductBtn');
      btn.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r = btn.getBoundingClientRect();
      const burger = document.getElementById('headerBurger').getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, burgerLeft: burger.left, scrollable: strip.scrollWidth > strip.clientWidth };
    });
    expect(box.scrollable).toBe(true);   // the strip overflows at 390 — Duct is reached by scrolling
    expect(box.width).toBeGreaterThan(0);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(390);
    expect(box.burgerLeft - box.right).toBeGreaterThanOrEqual(0);   // not under the burger
    // …and it is actually clickable there (the real handler runs).
    await page.evaluate(() => { window.__ductClicks = 0; document.getElementById('ductBtn').addEventListener('click', () => { window.__ductClicks++; }); });
    await page.locator('#ductBtn').click();
    expect(await page.evaluate(() => window.__ductClicks)).toBe(1);

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: DUCT unit D21 — J5-D, the trade-aware tool strip + "Pin to strip"
 * (journeys/plans/_TODO.md D21; Will's decision option (b) + Pin, contra D14).
 *
 * The trade profile seeds WHICH drawing tools sit inline in the header strip
 * and which live behind the ⋯; a per-tool pin overrides that and is remembered
 * per project; and the strip never re-orders on its own mid-session.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page, errors, width = 1000) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  // header-more is the DESKTOP regime (>768px); the mobile case below asserts
  // its own absence instead.
  if (width > 768) await expect(page.locator('body')).toHaveClass(/header-more/);
}

const setTrade = (page, t) => page.evaluate((trade) => { window.App.setProjectTrade(trade); }, t);
const inline = (page, id) => page.locator('#' + id).isVisible();
const stripOrder = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.header-tools-tight > button')].map((b) => b.id));

test.describe('D21 — trade-aware strip + Pin to strip (J5-D)', () => {
  /** @type {string[]} */
  let errors;
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('each profile seeds its own inline set; HVAC keeps D14, the rest reverse it', async ({ page }) => {
    errors = []; await boot(page, errors);
    // Nothing stated: D14's shipped arrangement is untouched. Re-arranging the
    // toolbar is an OPT-IN — a project that has never named a trade keeps what
    // it had, since state.trade is explicit and null by default.
    expect(await inline(page, 'ductBtn')).toBe(true);
    expect(await inline(page, 'polylineBtn')).toBe(false);
    // Stating plumbing opts in: Polyline inline, Duct tucked.
    await setTrade(page, 'plumbing');
    expect(await inline(page, 'polylineBtn')).toBe(true);
    expect(await inline(page, 'ductBtn')).toBe(false);
    // HVAC: D14's arrangement — Duct inline, Polyline tucked.
    await setTrade(page, 'hvac');
    expect(await inline(page, 'ductBtn')).toBe(true);
    expect(await inline(page, 'polylineBtn')).toBe(false);
    // Electrical takes the plumbing side: Polyline is its daily tool too.
    await setTrade(page, 'electrical');
    expect(await inline(page, 'polylineBtn')).toBe(true);
    expect(await inline(page, 'ductBtn')).toBe(false);
    // Back to plumbing, and the low-frequency group is tucked throughout.
    await setTrade(page, 'plumbing');
    expect(await inline(page, 'polylineBtn')).toBe(true);
    for (const id of ['highlightBtn', 'multiplyZoneBtn', 'scaleZoneBtn', 'roomBtn', 'ghostBtn', 'deleteZoneBtn', 'noteBtn']) {
      expect(await inline(page, id), id).toBe(false);
    }
  });

  test('the strip never re-orders: only visibility moves, and only on a trade change or a pin', async ({ page }) => {
    errors = []; await boot(page, errors);
    const before = await stripOrder(page);
    await setTrade(page, 'hvac');
    expect(await stripOrder(page)).toEqual(before);
    // Using tools must not shift anything.
    await page.locator('#headerMoreBtn').click();
    await page.locator('#headerMoreMenu .hm-row[data-tool-id="noteBtn"]').click();
    expect(await stripOrder(page)).toEqual(before);
    expect(await inline(page, 'ductBtn')).toBe(true);      // still the HVAC set
    expect(await inline(page, 'polylineBtn')).toBe(false);
    // A pin moves visibility, still not order.
    await page.evaluate(() => window.App.setStripPin('polylineBtn', true));
    expect(await stripOrder(page)).toEqual(before);
    expect(await inline(page, 'polylineBtn')).toBe(true);
  });

  test('the ⋯ menu pins a tucked tool to the strip and unpins an inline one', async ({ page }) => {
    errors = []; await boot(page, errors);
    // Duct is tucked on a stated plumbing project; its row offers "Pin to the toolbar".
    await setTrade(page, 'plumbing');
    await page.locator('#headerMoreBtn').click();
    const ductPin = page.locator('#headerMoreMenu .hm-row[data-tool-id="ductBtn"] .hm-pin');
    await expect(ductPin).toHaveAttribute('title', /Pin Duct to the toolbar/);
    await expect(ductPin).not.toHaveClass(/pinned/);
    await ductPin.click();
    expect(await inline(page, 'ductBtn')).toBe(true);
    expect(await page.evaluate(() => window.state.stripPins.ductBtn)).toBe(true);
    // The pin click must NOT also arm the tool (the row's own click does that).
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.DUCT)).toBe(false);
    // Now it reads "Unpin", and unpinning sends it back.
    await expect(ductPin).toHaveClass(/pinned/);
    await expect(ductPin).toHaveAttribute('title', /Unpin Duct/);
    await ductPin.click();
    expect(await inline(page, 'ductBtn')).toBe(false);
    expect(await page.evaluate(() => window.state.stripPins.ductBtn)).toBe(false);
  });

  test('a pin overrides the trade default in both directions', async ({ page }) => {
    errors = []; await boot(page, errors);
    // Pin Duct on a stated plumbing project (where the trade tucks it) and
    // unpin Polyline.
    await setTrade(page, 'plumbing');
    await page.evaluate(() => {
      window.App.setStripPin('ductBtn', true);
      window.App.setStripPin('polylineBtn', false);
    });
    expect(await inline(page, 'ductBtn')).toBe(true);
    expect(await inline(page, 'polylineBtn')).toBe(false);
    // Switching to HVAC does not undo an explicit pin — the estimator's choice
    // outranks the profile.
    await setTrade(page, 'hvac');
    expect(await inline(page, 'ductBtn')).toBe(true);
    expect(await inline(page, 'polylineBtn')).toBe(false);
    // Clearing the pin hands the tool back to the profile.
    await page.evaluate(() => window.App.setStripPin('polylineBtn', null));
    expect(await page.evaluate(() => 'polylineBtn' in window.state.stripPins)).toBe(false);
    expect(await inline(page, 'polylineBtn')).toBe(false);   // HVAC tucks Polyline
  });

  test('pins persist across a reload and ride the project payload', async ({ page }) => {
    errors = []; await boot(page, errors);
    await page.evaluate(() => window.App.setStripPin('ductBtn', true));
    // The project payload carries them (save/load + export/import).
    expect(await page.evaluate(() => window.App.buildCanvasExportData().stripPins))
      .toEqual({ ductBtn: true });
    // A plain reload keeps the arrangement on this device.
    await page.reload();
    // Wait on the BOOT signal, not networkidle: after a reload the shell's
    // background requests keep the network busy under a loaded suite.
    await page.waitForFunction(() => !!(window.App && window.state));
    expect(await page.evaluate(() => window.state.stripPins)).toEqual({ ductBtn: true });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    expect(await inline(page, 'ductBtn')).toBe(true);
  });

  test('a project that arrives with pins (import / load) paints them on hydrate, not on the next resize', async ({ page }) => {
    errors = []; await boot(page, errors);
    expect(await inline(page, 'ductBtn')).toBe(true);   // unstated: D14 arrangement
    // Hydrate a payload that unpins Duct and states plumbing — the canvas JSON
    // intake, which sets state and calls updateUI with no resize in sight.
    await page.evaluate(() => {
      const data = window.App.buildCanvasExportData();
      data.stripPins = { ductBtn: false };
      data.trade = 'plumbing';
      window.state.stripPins = { ...data.stripPins };
      window.state.trade = data.trade;
      window.App.updateUI();
    });
    expect(await inline(page, 'ductBtn')).toBe(false);
    expect(await inline(page, 'polylineBtn')).toBe(true);
    // And closing the project returns to the DEVICE's arrangement, not to nothing.
    await page.evaluate(() => { try { localStorage.setItem('stripPins', JSON.stringify({ polylineBtn: true })); } catch (_) {} });
    // B20 (X8): closeProject asks through the app's confirm modal.
    await page.evaluate(() => { window.App.closeProject({ route: 'settings' }); });
    await expect(page.locator('#confirmModal')).toHaveClass(/visible/);
    await page.locator('#confirmOk').click();
    await page.waitForFunction(() => window.state.pages.length === 0);
    expect(await page.evaluate(() => window.state.stripPins)).toEqual({ polylineBtn: true });
  });

  test('mobile is untouched: no ⋯, the padded strip scroll still reaches every tool', async ({ page }) => {
    errors = []; await boot(page, errors, 390);
    await expect(page.locator('body')).not.toHaveClass(/header-more/);
    await expect(page.locator('#headerMoreBtn')).toBeHidden();
    // B9's regime owns this width: no tool carries the overflow class.
    expect(await page.evaluate(() =>
      [...document.querySelectorAll('.header-tools-tight > button')].filter((b) => b.classList.contains('hm-overflowed')).length
    )).toBe(0);
  });
});

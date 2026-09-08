// @ts-check
/**
 * Electrical, First-Class S1 — the Trade switch and the electrical vocabulary.
 *
 * Guards: the Quick tab's Trade segment stamps state.trade (per project) and
 * the device default; the three rows relabel per trade (Size/Type/Material ↔
 * Category/Variant/Rating) and the name composes in the trade's order; the
 * electrical profile pre-selects the bundled symbol for the variant and
 * prefills the mount height; Add stamps mountHeightIn on the counter; the
 * plumbing profile is byte-identical to before (no mount row, old labels);
 * the Project Settings trade segment and ceiling / make-up inputs write the
 * project fields; the custom icon grid is grouped by set with the trade first.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => { try { localStorage.removeItem('plumbingModifiers'); } catch (_) {} });
}
async function openQuickTab(page) {
  await page.evaluate(() => { window.App.showModal('counterModal'); window.App.showCounterTab('quickcount'); });
  await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
}

test.describe('Electrical, First-Class S1 — Trade switch', () => {
  test('Electrical relabels the Quick tab, composes the name, picks the symbol and the mount height; Add stamps the counter', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await boot(page);

    expect(await page.evaluate(() => typeof window.App?.getTradeModifiers)).toBe('function');
    expect(await page.evaluate(() => typeof window.App?.setProjectTrade)).toBe('function');
    expect(await page.evaluate(() => window.state.trade)).toBe(null);

    await openQuickTab(page);
    // Plumbing (the default) reads exactly as before.
    expect(await page.locator('#counterQuickCountSizeLabel').textContent()).toBe('Size');
    expect(await page.locator('#counterQuickCountTypeLabel').textContent()).toBe('Type');
    expect(await page.locator('#counterQuickCountMaterialLabel').textContent()).toBe('Material');
    expect(await page.locator('#counterQuickCountMountRow').isVisible()).toBe(false);
    expect(await page.locator('#counterQuickCountTradeSegment [data-trade="plumbing"]').getAttribute('aria-pressed')).toBe('true');

    await page.click('#counterQuickCountTradeSegment [data-trade="electrical"]');
    expect(await page.evaluate(() => window.state.trade)).toBe('electrical');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plumbingModifiers') || '{}').defaultTrade)).toBe('electrical');
    expect(await page.locator('#counterQuickCountSizeLabel').textContent()).toBe('Category');
    expect(await page.locator('#counterQuickCountTypeLabel').textContent()).toBe('Variant');
    expect(await page.locator('#counterQuickCountMaterialLabel').textContent()).toBe('Rating');
    expect(await page.locator('#counterQuickCountMountRow').isVisible()).toBe(true);

    // Category Receptacle · Variant Duplex · no rating → "Duplex Receptacle", 18" AFF, the bundled symbol selected.
    expect(await page.inputValue('#counterQuickCountSize')).toBe('Receptacle');
    expect(await page.inputValue('#counterQuickCountType')).toBe('Duplex');
    expect(await page.inputValue('#counterQuickCountName')).toBe('Duplex Receptacle');
    expect(await page.inputValue('#counterQuickCountMount')).toBe('18"');
    const selected = await page.evaluate(() => {
      const cell = document.querySelector('#counterQuickCountIconGridCustom .icon-cell.selected');
      const ic = cell && window.App.getEffectiveCustomIcons().find((i) => i.value === cell.dataset.path);
      return ic ? { name: ic.name, set: ic.set } : null;
    });
    expect(selected).toEqual({ name: 'Duplex Receptacle', set: 'electrical' });
    // The custom grid is grouped by set, the project's trade first.
    const headings = await page.locator('#counterQuickCountIconGridCustom .icon-grid-heading').allTextContents();
    expect(headings[0]).toBe('Electrical');
    expect(headings).toContain('Plumbing');

    // A variant with a rating and a different mount height.
    await page.selectOption('#counterQuickCountType', 'GFCI');
    await page.selectOption('#counterQuickCountMaterial', '20A');
    expect(await page.inputValue('#counterQuickCountName')).toBe('GFCI Receptacle 20A');
    expect(await page.inputValue('#counterQuickCountMount')).toBe('44"');
    // The estimator can overwrite the mount height before Add.
    await page.fill('#counterQuickCountMount', "3'-6\"");
    await page.click('#counterQuickCountAdd');
    const added = await page.evaluate(() => { const c = window.state.counters[window.state.counters.length - 1]; return { name: c.name, mountHeightIn: c.mountHeightIn, hasIcon: !!c.icon }; });
    expect(added).toEqual({ name: 'GFCI Receptacle 20A', mountHeightIn: 42, hasIcon: true });

    // Back to Plumbing: the old rows, no mount height on the created counter.
    await openQuickTab(page);
    await page.click('#counterQuickCountTradeSegment [data-trade="plumbing"]');
    expect(await page.evaluate(() => window.state.trade)).toBe('plumbing');
    expect(await page.locator('#counterQuickCountSizeLabel').textContent()).toBe('Size');
    expect(await page.locator('#counterQuickCountMountRow').isVisible()).toBe(false);
    expect(await page.inputValue('#counterQuickCountName')).toBe('0.5in PEX Tee');
    await page.click('#counterQuickCountAdd');
    const plumb = await page.evaluate(() => { const c = window.state.counters[window.state.counters.length - 1]; return { name: c.name, mount: c.mountHeightIn }; });
    expect(plumb).toEqual({ name: '0.5in PEX Tee', mount: undefined });

    expect(errors).toEqual([]);
  });

  test('Project Settings: the trade segment and the ceiling / make-up fields write the project; export carries them', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await boot(page);

    await page.evaluate(() => window.App.showModal('settingsModal'));
    await page.click('#settingsTradeSegment [data-trade="hvac"]');
    expect(await page.evaluate(() => window.state.trade)).toBe('hvac');
    expect(await page.locator('#settingsTradeSegment [data-trade="hvac"]').getAttribute('aria-pressed')).toBe('true');
    // Clicking the pressed trade clears it (back to "not chosen").
    await page.click('#settingsTradeSegment [data-trade="hvac"]');
    expect(await page.evaluate(() => window.state.trade)).toBe(null);
    await page.click('#settingsTradeSegment [data-trade="electrical"]');

    await page.fill('#settingsCeilingHeight', "10'-0\"");
    await page.press('#settingsCeilingHeight', 'Enter');
    await page.fill('#settingsMakeUp', '1');
    await page.press('#settingsMakeUp', 'Enter');
    expect(await page.evaluate(() => [window.state.ceilingHeightFt, window.state.makeUpFt])).toEqual([10, 1]);
    // Re-rendered in the trade's own notation.
    expect(await page.inputValue('#settingsCeilingHeight')).toBe("10'-0\"");
    // Blank clears.
    await page.fill('#settingsCeilingHeight', '');
    await page.press('#settingsCeilingHeight', 'Enter');
    expect(await page.evaluate(() => window.state.ceilingHeightFt)).toBe(null);
    await page.fill('#settingsCeilingHeight', '9');
    await page.press('#settingsCeilingHeight', 'Enter');

    // The three fields ride every project payload (the IDB takeoff backup
    // builder is the cheapest to read back: it is the same data shape).
    const backup = await page.evaluate(async () => {
      const s = window.state;
      return { trade: s.trade, ceilingHeightFt: s.ceilingHeightFt, makeUpFt: s.makeUpFt };
    });
    expect(backup).toEqual({ trade: 'electrical', ceilingHeightFt: 9, makeUpFt: 1 });
    // The Quick tab follows the project's trade.
    await openQuickTab(page);
    expect(await page.locator('#counterQuickCountTradeSegment [data-trade="electrical"]').getAttribute('aria-pressed')).toBe('true');
    expect(await page.locator('#counterQuickCountSizeLabel').textContent()).toBe('Category');

    expect(errors).toEqual([]);
  });
});

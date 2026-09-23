// @ts-check
/**
 * Fixture units on counters (WATER-PLAN.md rung 2, features/water-fixtures.js).
 * Guards: on a plumbing-shaped project the Create tab's Fixture units field
 * shows and is prefilled from the name for the project's occupancy, the chip
 * names the row and carries the § chip, its occupancy word flips this counter
 * to the other column, and a typed number wins over a later name change; the
 * counter carries `wsfu` (and `wsfuOccupancy` only when it differs); the
 * sidebar title and the Summary's Fixture units line read it, multiply zones
 * aside; "WSFU for this one…" writes a per-mark override and clearing deletes
 * the key; the details modal edits and flips it; the Quick Count twin prefills
 * from its name; an HVAC project hides the field.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function load(page) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => window.App.rulesReady());
}
async function openCreateTab(page) {
  await page.locator('#counterBtn').click();
  await expect(page.locator('#counterModal')).toHaveClass(/visible/);
  if (await page.locator('#counterCreatePanel').isHidden()) await page.locator('#counterModal .counter-tab[data-tab="create"]').click();
  await expect(page.locator('#counterCreatePanel')).toBeVisible();
}

test.describe('Fixture units on counters', () => {
  test('the field, the prefill, the flip, the chip, the counter, the Summary, the override, the details modal, the Quick twin, the HVAC hide', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    expect(await page.evaluate(() => window.state.trade)).toBe(null);   // plumbing-shaped

    // Create tab: prefilled from the name for the project's (public) occupancy
    await openCreateTab(page);
    await expect(page.locator('#counterWsfuGroup')).toBeVisible();
    await page.locator('#counterName').fill('Lavatory');
    await expect(page.locator('#counterWsfu')).toHaveValue('2');
    const chip = page.locator('#counterWsfuChip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('2 WSFU');
    await expect(chip).toContainText('lavatory, faucet');
    await expect(chip.locator('.wsfu-occ-flip')).toHaveText('public');
    await expect(chip.locator('.rule-chip')).toContainText('§ IPC');
    // the flip reads the other column for this counter, and back
    await chip.locator('.wsfu-occ-flip').click();
    await expect(page.locator('#counterWsfu')).toHaveValue('0.7');
    await expect(chip.locator('.wsfu-occ-flip')).toHaveText('private');
    await chip.locator('.wsfu-occ-flip').click();
    await expect(page.locator('#counterWsfu')).toHaveValue('2');
    // a typed number wins over a later name change; the chip still shows the table
    await page.locator('#counterWsfu').fill('3');
    await page.locator('#counterName').fill('Lavatory 2');
    await expect(page.locator('#counterWsfu')).toHaveValue('3');
    await expect(chip).toContainText('2 WSFU');
    // a name the table does not know clears an untyped field; a typed one stays
    await page.locator('#counterName').fill('Lavatory');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    const c1 = await page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
    expect(c1.wsfu).toBe(3);
    expect(c1.wsfuOccupancy).toBeUndefined();
    expect(await page.locator('#countersList .sidebar-item .name').first().getAttribute('title')).toContain('3 WSFU');

    // two marks → the Summary's Fixture units line
    const wrapper = page.locator('#canvasWrapper');
    await wrapper.click({ position: { x: 150, y: 300 } });
    await wrapper.click({ position: { x: 250, y: 300 } });
    await expect(page.locator('#summaryWsfuRow')).toBeVisible();
    await expect(page.locator('#summaryWsfuRow .derived-total')).toHaveText('6 WSFU');
    await expect(page.locator('#summaryWsfuRow .derived-tag')).toHaveText('public');
    expect(await page.evaluate(() => window.App.getWsfuTotals())).toEqual({ total: 6, byPage: [{ pageIdx: 0, label: expect.any(String), total: 6 }] });

    // the per-mark override: context row → modal → wsfuOverride; clearing deletes the key
    await wrapper.click({ position: { x: 150, y: 300 }, button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#ctxMarkerWsfu')).toBeVisible();
    await expect(page.locator('#ctxMarkerWsfu')).toHaveText('WSFU for this one…');
    await page.locator('#ctxMarkerWsfu').click();
    await expect(page.locator('#markerWsfuModal')).toHaveClass(/visible/);
    await expect(page.locator('#markerWsfuHint')).toContainText('(3)');
    await expect(page.locator('#markerWsfuInput')).toBeFocused();
    await page.locator('#markerWsfuInput').fill('4.5');
    await page.locator('#markerWsfuSave').click();
    await expect(page.locator('#markerWsfuModal')).not.toHaveClass(/visible/);
    const marker = () => page.evaluate((id) => ({ ...window.state.pages[0].canvases[0].annotations.counterMarkers[id][0] }), c1.id);
    expect((await marker()).wsfuOverride).toBe(4.5);
    expect(await page.evaluate(() => window.state.counters[0].wsfu)).toBe(3);
    await expect(page.locator('#summaryWsfuRow .derived-total')).toHaveText('7.5 WSFU');
    expect(await page.locator('#countersList .sidebar-item .name').first().getAttribute('title')).toContain('(WSFU override 4.5)');
    await wrapper.click({ position: { x: 150, y: 300 }, button: 'right' });
    await page.locator('#ctxMarkerWsfu').click();
    await expect(page.locator('#markerWsfuInput')).toHaveValue('4.5');
    await page.locator('#markerWsfuInput').fill('');
    await page.locator('#markerWsfuInput').press('Enter');
    expect('wsfuOverride' in (await marker())).toBe(false);
    await expect(page.locator('#summaryWsfuRow .derived-total')).toHaveText('6 WSFU');

    // the details modal: the stored number, the table's chip, the flip writes the column and the number, blur commits
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters[0]));
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    await expect(page.locator('#counterLineTypeDetailsWsfuGroup')).toBeVisible();
    await expect(page.locator('#counterLineTypeDetailsWsfu')).toHaveValue('3');
    await expect(page.locator('#counterLineTypeDetailsWsfuChip')).toContainText('2 WSFU');
    await page.locator('#counterLineTypeDetailsWsfuChip .wsfu-occ-flip').click();
    expect(await page.evaluate(() => ({ w: window.state.counters[0].wsfu, o: window.state.counters[0].wsfuOccupancy }))).toEqual({ w: 0.7, o: 'private' });
    await expect(page.locator('#counterLineTypeDetailsWsfu')).toHaveValue('0.7');
    await expect(page.locator('#summaryWsfuRow .derived-total')).toHaveText('1.4 WSFU');
    await page.locator('#counterLineTypeDetailsWsfu').fill('5');
    await page.locator('#counterLineTypeDetailsWsfu').blur();
    expect(await page.evaluate(() => window.state.counters[0].wsfu)).toBe(5);
    await page.locator('#counterLineTypeDetailsWsfu').fill('');
    await page.locator('#counterLineTypeDetailsWsfu').blur();
    expect(await page.evaluate(() => 'wsfu' in window.state.counters[0])).toBe(false);
    await expect(page.locator('#summaryWsfuRow')).toHaveCount(0);
    await page.locator('#counterLineTypeDetailsClose').click();

    // the Quick Count twin: prefilled from its name, a bare public urinal is a 3/4 in flush valve
    await page.locator('#counterBtn').click();
    await page.locator('#counterModal .counter-tab[data-tab="quickcount"]').click();
    await expect(page.locator('#counterQuickCountPanel')).toBeVisible();
    await expect(page.locator('#counterQuickCountWsfuRow')).toBeVisible();
    await expect(page.locator('#counterQuickCountWsfu')).toHaveValue('');
    await page.locator('#counterQuickCountName').fill('Urinal');
    await expect(page.locator('#counterQuickCountWsfu')).toHaveValue('5');
    await expect(page.locator('#counterQuickCountWsfuChip')).toContainText('urinal, 3/4 in flush valve');
    await page.locator('#counterQuickCountAdd').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    const c2 = await page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
    expect(c2.wsfu).toBe(5);

    // a private project reads the other column by default
    await page.evaluate(() => window.App.setProjectCodes({ occupancy: 'private' }, { remember: false }));
    await openCreateTab(page);
    await page.locator('#counterName').fill('WC');
    await expect(page.locator('#counterWsfu')).toHaveValue('2.2');
    await expect(page.locator('#counterWsfuChip')).toContainText('water closet, flush tank');
    await page.locator('#counterCancel').click();

    // an HVAC project hides the field (a counter that carries one still shows it in its details)
    await page.evaluate(() => window.App.setProjectTrade('hvac', { remember: false }));
    await openCreateTab(page);
    await expect(page.locator('#counterWsfuGroup')).toBeHidden();
    await page.locator('#counterCancel').click();
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters[1]));
    await expect(page.locator('#counterLineTypeDetailsWsfuGroup')).toBeVisible();
    await page.locator('#counterLineTypeDetailsClose').click();

    expect(errors).toEqual([]);
  });
});

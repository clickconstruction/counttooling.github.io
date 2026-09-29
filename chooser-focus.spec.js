// @ts-check
/**
 * FLAKE-WATER-FIELD (punch row, closed 2026-09-28). The Choose Line Type and Counter dialogs
 * hand the caret to their search box a beat after they open (a frame, then a tick). Under CI
 * load that beat landed between a spec's focus of the Create name field and its typing: the
 * name went into the search box, the name field never fired its input event, and the Water
 * radio it prefills stayed on "—" (main run 36331260907, 2026-09-27; the page snapshot showed
 * "Domestic cold water 1in" in the search box, active). The same race waits for a fast reader
 * who opens the chooser and goes straight to Create or Quick.
 *
 * The rule now: the deferred focus yields when another field of the dialog already holds the
 * caret, or when Choose is no longer the tab showing. These cases force the ordering the flake
 * needed (open, switch tab, focus a field, THEN let the beat fire), so they fail on the old
 * code every time, not now and then. The last case keeps the intended behaviour: with nothing
 * moved on, the search box does get the caret.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, uploadPdf, collectConsoleErrors } = require('./spec-helpers');

const activeId = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);

test.describe('The chooser search box yields the caret (FLAKE-WATER-FIELD)', () => {
  test('Choose Line Type: a name typed on the Create tab right after opening stays in the name field', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    await page.evaluate(() => {
      window.App.showChooseLineTypeModal();
      window.App.showLineTypeTab('create');
      document.getElementById('createLineTypeName').focus();
    });
    await page.waitForTimeout(250);   // the deferred focus has fired by now
    expect(await activeId(page)).toBe('createLineTypeName');
    await page.locator('#createLineTypeName').fill('Domestic cold water 1in');
    await expect(page.locator('input[name="createLineTypeWaterSide"][value="cold"]')).toBeChecked();
    expect(await page.locator('#lineTypeModalSearchInput').inputValue()).toBe('');
    errors.assertNoErrors();
  });

  test('Choose Line Type: the Quick tab keeps its name field the same way', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    await page.evaluate(() => {
      window.App.showChooseLineTypeModal();
      window.App.showLineTypeTab('quick');
      document.getElementById('quickLineName').focus();
    });
    await page.waitForTimeout(250);
    expect(await activeId(page)).toBe('quickLineName');
    await page.locator('#quickLineName').fill('1/2in CW');
    await expect(page.locator('input[name="quickLineWaterSide"][value="cold"]')).toBeChecked();
    errors.assertNoErrors();
  });

  test('Choose Line Type: with nothing moved on, the search box does get the caret', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    await page.evaluate(() => window.App.showChooseLineTypeModal());
    await page.waitForTimeout(250);
    expect(await activeId(page)).toBe('lineTypeModalSearchInput');
    errors.assertNoErrors();
  });

  test('the search row shows on Choose only, in both dialogs (B17, and its parity on the chooser)', async ({ page }) => {
    // The Counter dialog never had the race: B17 hides its search row off the Choose tab, and a
    // hidden box cannot take the caret. The Line Type chooser now does the same.
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    const rowShown = (modal) => page.evaluate((id) => { const r = document.querySelector('#' + id + ' .counter-modal-search-row'); return !!(r && r.offsetParent); }, modal);
    await page.evaluate(() => { window.App.showChooseLineTypeModal(); });
    expect(await rowShown('chooseLineTypeModal')).toBe(true);
    await page.evaluate(() => window.App.showLineTypeTab('create'));
    expect(await rowShown('chooseLineTypeModal')).toBe(false);
    await page.evaluate(() => window.App.showLineTypeTab('quick'));
    expect(await rowShown('chooseLineTypeModal')).toBe(false);
    await page.evaluate(() => window.App.showLineTypeTab('choose'));
    expect(await rowShown('chooseLineTypeModal')).toBe(true);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { window.state.counters.push({ id: 'c1', name: 'Water Closet', icon: 'M96 96h448v448H96z', color: '#47c88e' }); window.App.updateUI(); });
    await page.evaluate(() => { document.getElementById('counterBtn').click(); window.App.showCounterTab('create'); document.getElementById('counterName').focus(); });
    expect(await rowShown('counterModal')).toBe(false);
    await page.waitForTimeout(250);
    expect(await activeId(page)).toBe('counterName');
    await page.keyboard.press('Escape');
    await page.locator('#counterBtn').click();
    await page.waitForTimeout(250);
    expect(await activeId(page)).toBe('counterModalSearchInput');
    errors.assertNoErrors();
  });
});

// @ts-check
/**
 * MAP-SETTINGS (2026-09-26): the Counter and Line Type display settings are a
 * device preference. They survive a reload in localStorage (`counterSettings` /
 * `lineTypeSettings`), like Hide marks and the sidebar filter, never ride the
 * project, and go with the device key wipe (Project Settings → Advanced →
 * Clear cached data and reload). The blank tour puts the reader's Snap to 45°
 * back across a reload through the lessons' device snapshot.
 */
const { test, expect } = require('@playwright/test');

function collectErrors(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
}
const ready = (page) => page.waitForFunction(() => window.App && window.App.bootSettled === true, null, { timeout: 30000 });
const slide = (page, id, value) => page.evaluate(([i, v]) => {
  const s = document.getElementById(i);
  s.value = String(v);
  s.dispatchEvent(new Event('input', { bubbles: true }));
}, [id, value]);
const snapOn = (page) => page.evaluate(() => !!window.state.lineTypeSettings.snapToHorizontalVertical);

test.describe('Counter and line display settings persist per device', () => {
  test('marker size, opacity, number size, line width, Snap and the Lines toggle hold across a reload; the device wipe resets them', async ({ page }) => {
    test.setTimeout(90000);
    const errors = [];
    collectErrors(page, errors);
    await page.goto('/app/');
    await ready(page);

    await page.evaluate(() => window.App.openCounterSettingsModal());
    await page.waitForSelector('#counterSettingsModal.visible');
    await slide(page, 'counterSize', 40);
    await slide(page, 'counterOpacity', 60);
    await slide(page, 'counterNumberSize', 18);
    await page.locator('#counterShowRingsBtn').click();
    await page.locator('#counterSettingsClose').click();

    await page.evaluate(() => window.App.openLineTypeSettingsModal());
    await page.waitForSelector('#lineTypeSettingsModal.visible');
    await slide(page, 'lineTypeSize', 5);
    await slide(page, 'lineTypeLengthLabel', 16);
    await page.locator('#lineTypeSettingsClose').click();

    expect(await snapOn(page)).toBe(false);
    await page.evaluate(() => document.getElementById('lineTypeSnapToHVHeaderBtn').click());
    await page.evaluate(() => document.getElementById('linesShowOnlyOnPageBtn').click());
    expect(await snapOn(page)).toBe(true);

    // Never the project: the blob is its own key, and the sidebar filter scope keeps its own.
    const stored = await page.evaluate(() => [JSON.parse(localStorage.getItem('counterSettings') || 'null'), JSON.parse(localStorage.getItem('lineTypeSettings') || 'null')]);
    expect(stored[0]).toMatchObject({ size: 40, opacity: 0.6, numberSize: 18, showRings: true });
    expect(stored[1]).toMatchObject({ lineSize: 5, lengthLabelSize: 16, snapToHorizontalVertical: true, showOnlyLinesOnCurrentPage: true });
    expect(stored[0]).not.toHaveProperty('sidebarFilterScope');

    await page.reload();
    await ready(page);
    const after = await page.evaluate(() => {
      const cs = window.state.counterSettings, lts = window.state.lineTypeSettings;
      return [cs.size, cs.opacity, cs.numberSize, cs.showRings, cs.ringSolid, lts.lineSize, lts.lengthLabelSize, lts.snapToHorizontalVertical, lts.showOnlyLinesOnCurrentPage, lts.dropIconStyle];
    });
    // ringSolid and dropIconStyle were never touched: the stored blob merges over the defaults
    expect(after).toEqual([40, 0.6, 18, true, true, 5, 16, true, true, 'circle']);
    await expect(page.locator('#lineTypeSnapToHVHeaderBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#linesShowOnlyOnPageBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.App.openCounterSettingsModal());
    await expect(page.locator('#counterSizeVal')).toHaveText('40');
    await expect(page.locator('#counterOpacityVal')).toHaveText('60');
    await page.locator('#counterSettingsClose').click();
    await page.evaluate(() => window.App.openLineTypeSettingsModal());
    await expect(page.locator('#lineTypeSizeVal')).toHaveText('5');
    await expect(page.locator('#lineTypeSettingsModal #lineTypeSnapToHVBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#lineTypeSettingsClose').click();

    // A corrupt or stale entry falls back to the defaults field by field.
    await page.evaluate(() => localStorage.setItem('counterSettings', JSON.stringify({ size: 'huge', opacity: 0.5, bogus: 1 })));
    await page.reload();
    await ready(page);
    expect(await page.evaluate(() => [window.state.counterSettings.size, window.state.counterSettings.opacity, 'bogus' in window.state.counterSettings])).toEqual([22, 0.5, false]);

    // The device wipe (the key list Clear cached data and reload runs) takes them with the other device preferences.
    await page.evaluate(() => document.getElementById('advancedEmptyCacheReload').click());
    await page.locator('#confirmOk').click();
    await page.waitForLoadState('load');
    await ready(page);
    const wiped = await page.evaluate(() => [localStorage.getItem('counterSettings'), localStorage.getItem('lineTypeSettings'), window.state.counterSettings.size, window.state.counterSettings.opacity, window.state.lineTypeSettings.lineSize, !!window.state.lineTypeSettings.snapToHorizontalVertical]);
    expect(wiped).toEqual([null, null, 22, 1, 2, false]);
    expect(errors).toEqual([]);
  });

  test('the blank tour puts the reader\'s Snap back after a reload skipped its stop', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    collectErrors(page, errors);
    await page.goto('/app/');
    await ready(page);
    await page.evaluate(() => { try { localStorage.setItem('counterSearch', 'WC'); } catch (_) {} });
    await page.reload();
    await ready(page);
    expect(await snapOn(page)).toBe(false);

    await page.evaluate(() => window.App.startBlankTour());
    expect(await page.evaluate(() => window.App.tutorialId())).toBe('blank');
    // the tour turns Snap on (its own step), and the reader leaves by reloading
    await page.evaluate(() => document.getElementById('lineTypeSnapToHVHeaderBtn').click());
    expect(await snapOn(page)).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('clickcount-lesson-device-before') || 'null'))).toMatchObject({ snap: false });

    await page.reload();
    await ready(page);
    await page.waitForFunction(() => !window.state.lineTypeSettings.snapToHorizontalVertical && !localStorage.getItem('clickcount-lesson-device-before'), null, { timeout: 8000 });
    // the tour's own search snapshot still types the reader's word back; the device restore never clears it
    await page.waitForFunction(() => window.state.counterSearch === 'WC', null, { timeout: 8000 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lineTypeSettings') || '{}').snapToHorizontalVertical)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('stopping the blank tour in-session puts Snap back and keeps a reader\'s own Snap on', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await page.goto('/app/');
    await ready(page);
    await page.evaluate(() => document.getElementById('lineTypeSnapToHVHeaderBtn').click());
    expect(await snapOn(page)).toBe(true);
    await page.evaluate(() => window.App.startBlankTour());
    await page.evaluate(() => document.getElementById('lineTypeSnapToHVHeaderBtn').click());
    expect(await snapOn(page)).toBe(false);
    await page.evaluate(() => window.App.stopTutorial());
    expect(await snapOn(page)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('clickcount-lesson-device-before'))).toBe(null);
    await page.reload();
    await ready(page);
    expect(await snapOn(page)).toBe(true);
    expect(errors).toEqual([]);
  });
});

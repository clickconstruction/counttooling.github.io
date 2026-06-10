// @ts-check
/**
 * Tests: the inline create-color picker (setupCreateColorPicker) added to the
 * Create Counter and Create Line Type modals - the custom <input type="color">
 * + Recent row below the 18 presets (app.js, published on App; pure core
 * nextRecentColors in constants.js).
 *
 * Guards: the registry contract (App.setupCreateColorPicker / App.pushRecentColor);
 * value-based selection via the presets row's dataset.selectedColor (a custom
 * off-palette color leaves no preset ringed); only custom colors enter the shared
 * Recent list (state.recentLineColors) - presets are skipped; the Recent list is
 * shared across both Create modals; and it persists in localStorage across reload.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Create-modal custom color picker + recent colors', () => {
  test('custom picks, custom-only recents, shared + persisted', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Clean slate for recents (this origin may carry a prior list).
    await page.evaluate(() => {
      try { localStorage.removeItem('recentLineColors'); } catch (_) {}
      window.state.recentLineColors = [];
    });

    // Registry contract.
    expect(await page.evaluate(() => ({
      setup: typeof window.App?.setupCreateColorPicker,
      push: typeof window.App?.pushRecentColor,
    }))).toEqual({ setup: 'function', push: 'function' });

    const COLORS = await page.evaluate(() => window.App.COLORS);
    const CUSTOM = '#123456'; // off-palette

    // --- Create Line Type with a CUSTOM color ---
    await page.evaluate(() => window.App.showChooseLineTypeModal());
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });
    await page.evaluate(() => window.App.showLineTypeTab('create'));

    // Default selection = COLORS[2]; custom input present; Recent hidden (empty).
    expect(await page.evaluate(() => ({
      selected: document.getElementById('createLineTypeColorRow').dataset.selectedColor,
      hasCustom: !!document.getElementById('createLineTypeColorCustom'),
      recentHidden: document.getElementById('createLineTypeColorRecentGroup').style.display === 'none',
    }))).toEqual({ selected: COLORS[2].toLowerCase(), hasCustom: true, recentHidden: true });

    // Pick a custom color via the native input's change event.
    await page.evaluate((c) => {
      const inp = document.getElementById('createLineTypeColorCustom');
      inp.value = c;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }, CUSTOM);
    expect(await page.evaluate(() =>
      document.getElementById('createLineTypeColorRow').dataset.selectedColor)).toBe(CUSTOM);
    // Off-palette => no preset swatch ringed.
    expect(await page.evaluate(() =>
      document.querySelectorAll('#createLineTypeColorRow .color-swatch.selected').length)).toBe(0);

    await page.locator('#createLineTypeName').fill('Custom Color Line');
    await page.locator('#createLineTypeCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('chooseLineTypeModal')?.classList.contains('visible'),
      { timeout: 5000 });

    expect(await page.evaluate(() => {
      const lts = window.state.lineTypes;
      return {
        color: lts[lts.length - 1].color,
        recents: window.state.recentLineColors,
        ls: JSON.parse(localStorage.getItem('recentLineColors') || '[]'),
      };
    })).toEqual({ color: CUSTOM, recents: [CUSTOM], ls: [CUSTOM] });

    // --- Create Line Type with a PRESET color: must NOT enter recents ---
    await page.evaluate(() => window.App.showChooseLineTypeModal());
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });
    await page.evaluate(() => window.App.showLineTypeTab('create'));

    // Recent now visible and carries the custom swatch.
    expect(await page.evaluate((custom) => ({
      visible: document.getElementById('createLineTypeColorRecentGroup').style.display !== 'none',
      hasCustom: !!document.querySelector('#createLineTypeColorRecent .color-swatch[data-color="' + custom + '"]'),
    }), CUSTOM)).toEqual({ visible: true, hasCustom: true });

    await page.evaluate((preset) => {
      document.querySelector('#createLineTypeColorRow .color-swatch[data-color="' + preset + '"]').click();
    }, COLORS[0]);
    expect(await page.evaluate(() =>
      document.getElementById('createLineTypeColorRow').dataset.selectedColor)).toBe(COLORS[0].toLowerCase());
    await page.locator('#createLineTypeName').fill('Preset Color Line');
    await page.locator('#createLineTypeCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('chooseLineTypeModal')?.classList.contains('visible'),
      { timeout: 5000 });

    // Preset was not recorded; the custom color is still the only recent.
    expect(await page.evaluate(() => window.state.recentLineColors)).toEqual([CUSTOM]);

    // --- Shared: Create Counter shows the same recent custom color ---
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    expect(await page.evaluate((custom) => ({
      hasCustom: !!document.querySelector('#counterColorRecent .color-swatch[data-color="' + custom + '"]'),
      selected: document.getElementById('counterColorRow').dataset.selectedColor,
    }), CUSTOM)).toEqual({ hasCustom: true, selected: COLORS[2].toLowerCase() });
    await page.evaluate(() => document.getElementById('counterCancel').click());

    // --- Persistence across reload ---
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.state.recentLineColors)).toContain(CUSTOM);

    expect(errors).toEqual([]);
  });

  test('the "+ Add" Add Line Type modal (#lineTypeModal) has the same picker', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      try { localStorage.removeItem('recentLineColors'); } catch (_) {}
      window.state.recentLineColors = [];
    });

    const COLORS = await page.evaluate(() => window.App.COLORS);
    const CUSTOM = '#0a0b0c'; // off-palette

    // Open via the sidebar "+ Add" button -> the Add Line Type modal.
    await page.evaluate(() => document.getElementById('addLineType').click());
    await page.waitForSelector('#lineTypeModal.visible', { timeout: 5000 });

    // Default selection = COLORS[2]; custom input present; Recent hidden (empty).
    expect(await page.evaluate(() => ({
      selected: document.getElementById('lineTypeColorRow').dataset.selectedColor,
      hasCustom: !!document.getElementById('lineTypeColorCustom'),
      recentHidden: document.getElementById('lineTypeColorRecentGroup').style.display === 'none',
    }))).toEqual({ selected: COLORS[2].toLowerCase(), hasCustom: true, recentHidden: true });

    // Pick a custom color and create.
    await page.evaluate((c) => {
      const inp = document.getElementById('lineTypeColorCustom');
      inp.value = c;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }, CUSTOM);
    expect(await page.evaluate(() =>
      document.getElementById('lineTypeColorRow').dataset.selectedColor)).toBe(CUSTOM);
    await page.locator('#lineTypeName').fill('Add-Modal Line');
    await page.locator('#lineTypeCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('lineTypeModal')?.classList.contains('visible'),
      { timeout: 5000 });

    expect(await page.evaluate(() => {
      const lts = window.state.lineTypes;
      return { color: lts[lts.length - 1].color, recents: window.state.recentLineColors };
    })).toEqual({ color: CUSTOM, recents: [CUSTOM] });

    // Reopen: Recent now visible with the custom swatch.
    await page.evaluate(() => document.getElementById('addLineType').click());
    await page.waitForSelector('#lineTypeModal.visible', { timeout: 5000 });
    expect(await page.evaluate((custom) => ({
      visible: document.getElementById('lineTypeColorRecentGroup').style.display !== 'none',
      hasCustom: !!document.querySelector('#lineTypeColorRecent .color-swatch[data-color="' + custom + '"]'),
    }), CUSTOM)).toEqual({ visible: true, hasCustom: true });

    expect(errors).toEqual([]);
  });
});

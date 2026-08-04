// @ts-check
/**
 * Tests: features/scale-zone-settings.js - the Scale Zone settings modal (zone
 * label show/size/position), the sibling of multiply-zone-settings born from a
 * field report (the fallback "0.23 ft/pt" label rendered dead-center over the
 * fixtures being counted).
 *
 * Guards the registry failure modes (entry point never registered; binding
 * fires before the registry is populated), the right-click path (the Scale
 * Zone tool button moved OUT of the context menu's no-settings toast list),
 * and all three moved handlers: opening with current values, the ShowLabel
 * toggle + LabelSize slider live value, and the Close commit into
 * state.scaleZoneSettings.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Scale Zone settings modal (features/scale-zone-settings.js)', () => {
  test('registry wired; settings persist on close with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error' && !(msg.location()?.url || '').includes('config.local.js')) errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the entry point is registered, and the Scale Zone
    //    tool button is a context-menu tool, not a no-settings toast tool.
    const wired = await page.evaluate(() => typeof window.App?.openScaleZoneSettingsModal);
    expect(wired).toBe('function');
    const map = await page.evaluate(() => window.App.__toolContextMap());
    expect(map.tools.scaleZoneBtn).toEqual(['Scale Zone Settings…']);
    expect(map.noSettings).not.toContain('scaleZoneBtn');

    // 3. Defaults surface in state: label shown, 14px, top-left.
    const defaults = await page.evaluate(() => window.state.scaleZoneSettings);
    expect(defaults).toEqual({ showLabelOnZone: true, labelSize: 14, labelPosition: 'top-left' });

    // 4. Open via the registry.
    await page.evaluate(() => window.App.openScaleZoneSettingsModal());
    await page.waitForSelector('#scaleZoneSettingsModal.visible', { timeout: 5000 });

    // 5. Edit: label size -> 10 (dispatch input so the live val text updates),
    //    toggle the label off via its button, position -> bottom-right.
    await page.evaluate(() => {
      const size = /** @type {HTMLInputElement} */ (document.getElementById('scaleZoneSettingsLabelSize'));
      size.value = '10';
      size.dispatchEvent(new Event('input', { bubbles: true }));
      /** @type {HTMLSelectElement} */ (document.getElementById('scaleZoneSettingsLabelPosition')).value = 'bottom-right';
    });
    const valText = await page.locator('#scaleZoneSettingsLabelSizeVal').textContent();
    expect(valText).toBe('10');
    await page.locator('#scaleZoneSettingsShowLabelBtn').click();

    // 6. Close commits the settings.
    await page.locator('#scaleZoneSettingsClose').click();
    await page.waitForFunction(
      () => !document.getElementById('scaleZoneSettingsModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    const result = await page.evaluate(() => window.state.scaleZoneSettings);
    expect(result).toEqual({
      showLabelOnZone: false,
      labelSize: 10,
      labelPosition: 'bottom-right',
    });

    expect(errors).toEqual([]);
  });
});

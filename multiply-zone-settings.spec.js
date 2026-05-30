// @ts-check
/**
 * Tests: the window.App registry pilot #5 - the Multiply Zone settings modal
 * extracted to features/multiply-zone-settings.js still wires up and persists its
 * settings.
 *
 * First extraction needing zero new published deps (state/showModal/hideModal/
 * markProjectDirty/renderPdf/updateUI were already on App). Guards the registry
 * failure modes (entry point never registered; binding fires before the registry
 * is populated) plus all four moved handlers: opening, the ShowLabel toggle, the
 * LabelSize slider's live value, and the Close commit into state.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Multiply Zone settings modal', () => {
  test('registry wired; settings persist on close with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the entry point is registered.
    const wired = await page.evaluate(() => typeof window.App?.openMultiplyZoneSettingsModal);
    expect(wired).toBe('function');

    // 3. Open via the registry.
    await page.evaluate(() => window.App.openMultiplyZoneSettingsModal());
    await page.waitForSelector('#multiplyZoneSettingsModal.visible', { timeout: 5000 });

    // 4. Edit: multiplier -> 5, label size -> 20 (dispatch input so the live val
    //    text updates), toggle the label off via its button, position -> top-left.
    await page.evaluate(() => {
      document.getElementById('multiplyZoneSettingsDefaultMult').value = '5';
      const size = document.getElementById('multiplyZoneSettingsLabelSize');
      size.value = '20';
      size.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('multiplyZoneSettingsLabelPosition').value = 'top-left';
    });
    const valText = await page.locator('#multiplyZoneSettingsLabelSizeVal').textContent();
    expect(valText).toBe('20');
    await page.locator('#multiplyZoneSettingsShowLabelBtn').click();

    // 5. Close commits the settings.
    await page.locator('#multiplyZoneSettingsClose').click();
    await page.waitForFunction(
      () => !document.getElementById('multiplyZoneSettingsModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    const result = await page.evaluate(() => window.state.multiplyZoneSettings);
    expect(result).toEqual({
      showLabelOnZone: false,
      defaultMultiplier: 5,
      labelSize: 20,
      labelPosition: 'top-left',
    });

    expect(errors).toEqual([]);
  });
});

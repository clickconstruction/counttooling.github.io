// @ts-check
/**
 * Tests: the window.App registry pilot #7 - the Summary Legend settings modal
 * extracted to features/legend-settings.js still wires up and applies its
 * settings live.
 *
 * The lowest-risk move so far (zero new published deps - state/showModal/
 * hideModal/renderPdf were already on App). Guards the registry failure modes
 * (entry point never registered; bindings fire before the registry is
 * populated) plus the moved opener, the legendScale slider's live value +
 * state write, the show-border toggle, and the close handler.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Summary Legend settings modal', () => {
  test('registry wired; settings apply live and close works with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the entry point is registered.
    const wired = await page.evaluate(() => typeof window.App?.openLegendSettingsModal);
    expect(wired).toBe('function');

    // 3. Open via the registry.
    await page.evaluate(() => window.App.openLegendSettingsModal());
    await page.waitForSelector('#legendSettingsModal.visible', { timeout: 5000 });

    // 4. SLIDER: legend scale -> 150, dispatch input so the live val + state update.
    await page.evaluate(() => {
      const s = document.getElementById('legendScale');
      s.value = '150';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await page.locator('#legendScaleVal').textContent()).toBe('150');
    expect(await page.evaluate(() => window.state.legendSettings.legendScale)).toBe(1.5);

    // 5. TOGGLE: flip show-border via its button and assert the state flipped.
    const before = await page.evaluate(() => window.state.legendSettings.showBorder !== false);
    await page.locator('#legendShowBorderBtn').click();
    const after = await page.evaluate(() => window.state.legendSettings.showBorder);
    expect(after).toBe(!before);

    // 6. CLOSE dismisses the modal.
    await page.locator('#legendSettingsClose').click();
    await page.waitForFunction(
      () => !document.getElementById('legendSettingsModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    expect(errors).toEqual([]);
  });
});

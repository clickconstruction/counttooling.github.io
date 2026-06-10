// @ts-check
/**
 * Tests: the window.App registry pilot #13 - the Scale modal (scaleModal)
 * extracted to features/scale.js still wires up and applies a scale to the
 * current page from both the presets list and the custom-fraction Apply.
 *
 * First split to route geometry.js globals (ptDist, parseFraction,
 * parseRealWorldLength) and the SCALE_* constants through the registry, plus the
 * publish-only getActiveAnnotations; the rest were already on App. Guards the
 * registry contract (entry points + SCALE_PRESETS) and the two non-canvas apply
 * paths (preset + custom fraction). The two-point "Select on PDF" canvas flow is
 * out of scope (needs simulated canvas geometry).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Scale modal', () => {
  test('registry wired; preset + custom-fraction apply set page scale with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the two entry points + the published presets constant.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openScaleModal,
      reset: typeof window.App?.resetScaleModalZoneMode,
      presetsIsArray: Array.isArray(window.App?.SCALE_PRESETS),
    }));
    expect(wired).toEqual({ open: 'function', reset: 'function', presetsIsArray: true });

    // 3. Open via the registry; with no scale points it shows the presets tab.
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });

    // 4. PRESET: click the first preset; current page gains a scale + modal closes.
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(
      () => !document.getElementById('scaleModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const afterPreset = await page.evaluate(() => {
      const s = window.state.pages[window.state.currentPage].scale;
      return { hasScale: !!s, ppu: s?.pixelsPerUnit };
    });
    expect(afterPreset.hasScale).toBe(true);
    expect(typeof afterPreset.ppu).toBe('number');

    // 5. CUSTOM FRACTION: reopen, enter 1/4" = 4 ft, Apply; assert computed ppu.
    const expectedPpu = await page.evaluate(() => (window.App.parseFraction('1/4') * 72) / 4);
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    await page.locator('#scaleCustomFraction').fill('1/4');
    await page.locator('#scaleCustomFeet').fill('4');
    await page.locator('#scaleCustomApply').click();
    await page.waitForFunction(
      () => !document.getElementById('scaleModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const afterCustom = await page.evaluate(() => {
      const s = window.state.pages[window.state.currentPage].scale;
      return { ppu: s?.pixelsPerUnit, unit: s?.unit, label: s?.label };
    });
    expect(afterCustom.ppu).toBeCloseTo(expectedPpu, 6);
    expect(afterCustom.unit).toBe('ft');
    expect(afterCustom.label).toBe('1/4" = 4 ft');

    expect(errors).toEqual([]);
  });
});

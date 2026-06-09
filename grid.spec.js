// @ts-check
/**
 * Tests: the window.App registry pilot #15 - the Grid Settings modal
 * (gridSettingsModal) + grid-overlay toggle extracted to features/grid.js still
 * gates on a page scale, opens, and applies its settings.
 *
 * Two new publish-only deps (getPageScale, showSetScaleFirstToast); the rest were
 * already on App. The "set origin on page" handoff rides the shared
 * state.gridOriginPickMode flag (no registry callback). Guards the registry
 * contract plus the no-scale gate and the apply flow. The canvas origin-pick
 * round-trip needs a real click and is left to manual smoke-testing.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Grid Settings modal', () => {
  test('registry wired; scale gate + apply flow work with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract.
    expect(await page.evaluate(() => typeof window.App?.toggleGridOverlay)).toBe('function');

    // 3. NO-SCALE GATE: with no page scale, opening shows a toast, not the modal.
    await page.evaluate(() => window.App.toggleGridOverlay());
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.getElementById('gridSettingsModal')?.classList.contains('visible'))).toBe(false);

    // 4. Give the current page a scale, then open the modal via the registry.
    await page.evaluate(() => { window.state.pages[window.state.currentPage].scale = { pixelsPerUnit: 10, unit: 'ft' }; });
    await page.evaluate(() => window.App.toggleGridOverlay());
    await page.waitForSelector('#gridSettingsModal.visible', { timeout: 5000 });

    // 5. APPLY: set spacing -> 5 ft, apply; settings persist + overlay turns on + modal closes.
    const expectedSpacing = await page.evaluate(() => window.App.parseRealWorldLength('5', 'ft'));
    await page.locator('#gridSpacingValue').fill('5');
    await page.locator('#gridSettingsApply').click();
    await page.waitForFunction(
      () => !document.getElementById('gridSettingsModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const applied = await page.evaluate(() => ({
      spacing: window.state.gridSettings?.spacing,
      unit: window.state.gridSettings?.unit,
      overlayOn: window.state.showGridOverlay === true,
    }));
    expect(applied.spacing).toBe(expectedSpacing);
    expect(applied.unit).toBe('ft');
    expect(applied.overlayOn).toBe(true);

    expect(errors).toEqual([]);
  });
});

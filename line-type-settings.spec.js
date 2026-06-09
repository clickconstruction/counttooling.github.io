// @ts-check
/**
 * Tests: the window.App registry pilot #11 - the Line Type settings modal
 * extracted to features/line-type-settings.js still wires up and applies its
 * settings live. Drains the last settings-modal unit from the grab-bag.
 *
 * Two new publish-only deps (renderLineTypesList, DROP_ICON_STYLES);
 * renderAnnotations + state/showModal/hideModal/updateUI/showToast were already
 * on App. Guards the registry failure modes (entry point never registered;
 * bindings fire before the registry is populated) plus the moved opener, a value
 * slider, the orient-length toggle, the drop-icon grid, and the close handler.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Line Type settings modal', () => {
  test('registry wired; settings apply live and close works with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the entry point + the 2 new publish-only deps.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openLineTypeSettingsModal,
      renderLineTypes: typeof window.App?.renderLineTypesList,
      dropStylesIsArray: Array.isArray(window.App?.DROP_ICON_STYLES),
    }));
    expect(wired).toEqual({ open: 'function', renderLineTypes: 'function', dropStylesIsArray: true });

    // 3. Open via the registry.
    await page.evaluate(() => window.App.openLineTypeSettingsModal());
    await page.waitForSelector('#lineTypeSettingsModal.visible', { timeout: 5000 });

    // 4. SLIDER: line size -> 8, dispatch input so the live val + state update.
    await page.evaluate(() => {
      const s = document.getElementById('lineTypeSize');
      s.value = '8';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await page.locator('#lineTypeSizeVal').textContent()).toBe('8');
    expect(await page.evaluate(() => window.state.lineTypeSettings.lineSize)).toBe(8);

    // 5. TOGGLE: flip orient-length via its button; state flips.
    const before = await page.evaluate(() => window.state.lineTypeSettings.orientLengthWithLine !== false);
    await page.locator('#lineTypeOrientLengthBtn').click();
    const after = await page.evaluate(() => !!window.state.lineTypeSettings.orientLengthWithLine);
    expect(after).toBe(!before);

    // 6. DROP-ICON GRID: rendered from DROP_ICON_STYLES; clicking a non-selected
    //    cell updates the chosen style.
    const grid = await page.evaluate(() => ({
      cells: document.querySelectorAll('#lineTypeDropIconGrid .icon-cell').length,
      styles: window.App.DROP_ICON_STYLES.length,
    }));
    expect(grid.cells).toBe(grid.styles);
    const chosen = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('#lineTypeDropIconGrid .icon-cell'));
      const target = cells.find(c => !c.classList.contains('selected')) || cells[0];
      target.click();
      return target.dataset.style;
    });
    expect(await page.evaluate(() => window.state.lineTypeSettings.dropIconStyle)).toBe(chosen);

    // 7. CLOSE dismisses the modal.
    await page.locator('#lineTypeSettingsClose').click();
    await page.waitForFunction(
      () => !document.getElementById('lineTypeSettingsModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: the window.App registry pilot #8 - the Page settings modal extracted to
 * features/page-settings.js still wires up and persists its toggles.
 *
 * One new publish-only dep (renderPagesList); state/showModal/hideModal/updateUI
 * were already on App. Guards the registry failure modes (entry point never
 * registered; bindings fire before the registry is populated) plus the moved
 * opener, the two persisted toggles (truncate titles, hide unmarked pages), and
 * the close handler.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Page settings modal', () => {
  test('registry wired; toggles persist and close works with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the entry point + the new publish-only dep.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openPageSettingsModal,
      render: typeof window.App?.renderPagesList,
    }));
    expect(wired).toEqual({ open: 'function', render: 'function' });

    // 3. Open via the registry.
    await page.evaluate(() => window.App.openPageSettingsModal());
    await page.waitForSelector('#pageSettingsModal.visible', { timeout: 5000 });

    // 4. TRUNCATE: toggle flips state + persists to localStorage.
    const truncBefore = await page.evaluate(() => !!window.state.pagesTitlesTruncated);
    await page.locator('#pageSettingsTruncateBtn').click();
    const truncAfter = await page.evaluate(() => ({
      state: !!window.state.pagesTitlesTruncated,
      ls: localStorage.getItem('pagesTitlesTruncated'),
    }));
    expect(truncAfter.state).toBe(!truncBefore);
    expect(truncAfter.ls).toBe(truncAfter.state ? '1' : '0');

    // 5. HIDE-UNMARKED: toggle flips state.
    const hideBefore = await page.evaluate(() => !!window.state.hideUnmarkedPagesFromSidebar);
    await page.locator('#pageSettingsHideUnmarkedBtn').click();
    const hideAfter = await page.evaluate(() => !!window.state.hideUnmarkedPagesFromSidebar);
    expect(hideAfter).toBe(!hideBefore);

    // 6. CLOSE dismisses the modal.
    await page.locator('#pageSettingsClose').click();
    await page.waitForFunction(
      () => !document.getElementById('pageSettingsModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    expect(errors).toEqual([]);
  });
});

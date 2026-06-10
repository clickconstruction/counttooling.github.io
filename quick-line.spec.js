// @ts-check
/**
 * Tests: the window.App registry pilot #16 - the Quick Line modal (the "quick"
 * tab body of #chooseLineTypeModal) extracted to features/quick-line.js still
 * populates from the line modifiers and creates a line type.
 *
 * This split takes over publishing App.populateQuickLineModal (previously from
 * app.js, consumed by features/choose-create-line-type.js), so the cross-file
 * handoff is the key thing to guard (also covered by choose-create-line-type.spec.js).
 * Two new publish-only deps (getLineModifiers, saveLineModifiers).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Quick Line modal', () => {
  test('registry wired; quick tab populates and adds a line type with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the entry point this feature now publishes.
    expect(await page.evaluate(() => typeof window.App?.populateQuickLineModal)).toBe('function');

    // 3. Open the quick tab the way #plumLineBtn does (populate + quick tab + show).
    const before = await page.evaluate(() => window.state.lineTypes.length);
    await page.evaluate(() => {
      window.App.populateQuickLineModal();
      window.App.showLineTypeTab('quick');
      window.App.showModal('chooseLineTypeModal');
    });
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });

    // 4. The size / material selects are populated from the line modifiers.
    const opts = await page.evaluate(() => ({
      sizes: document.getElementById('quickLineSize').options.length,
      materials: document.getElementById('quickLineMaterial').options.length,
    }));
    expect(opts.sizes).toBeGreaterThan(0);
    expect(opts.materials).toBeGreaterThan(0);

    // 5. ADD: create a line type from the current size/material selection.
    await page.locator('#quickLineAdd').click();
    await page.waitForFunction(
      () => !document.getElementById('chooseLineTypeModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const after = await page.evaluate(() => {
      const lts = window.state.lineTypes;
      const last = lts[lts.length - 1];
      return { count: lts.length, activeIsLast: window.state.activeLineTypeId === last?.id };
    });
    expect(after.count).toBe(before + 1);
    expect(after.activeIsLast).toBe(true);

    expect(errors).toEqual([]);
  });
});

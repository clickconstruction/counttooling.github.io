// @ts-check
/**
 * Tests: the window.App registry pilot #15 - the Grid Settings modal
 * (gridSettingsModal) + grid-overlay toggle extracted to features/grid.js still
 * gates on a page scale, opens, and applies its settings.
 *
 * Two new publish-only deps (getPageScale, showSetScaleFirstToast); the rest were
 * already on App. The "set origin on page" handoff rides the shared
 * state.gridOriginPickMode flag (no registry callback). Guards the registry
 * contract plus the no-scale gate and the apply flow. The second describe walks the
 * canvas origin pick with a real click (and its Esc rung).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Grid Settings modal', () => {
  test('registry wired; scale gate + apply flow work with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });

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

// R14 (2026-09-26): the "Set origin on page" pick, pinned before it moved from app.js's
// canvas click into features/grid.js (App.commitGridOriginPick / App.cancelGridOriginPick).
test.describe('Grid Settings: set origin on page', () => {
  const { collectConsoleErrors, bootApp, uploadPdf } = require('./spec-helpers');
  const clientOf = (page, pt) => page.evaluate((pt) => {
    const p = window.App.toCanvas(pt);
    const c = document.getElementById('annCanvas');
    const r = c.getBoundingClientRect();
    return { x: r.left + p.x * (r.width / c.width), y: r.top + p.y * (r.height / c.height) };
  }, pt);

  test('Set origin on page, click the plan, Apply: the origin lands in grid settings', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    await page.evaluate(() => { window.state.pages[window.state.currentPage].scale = { pixelsPerUnit: 10, unit: 'ft' }; });
    await page.evaluate(() => window.App.toggleGridOverlay());
    await page.waitForSelector('#gridSettingsModal.visible', { timeout: 5000 });

    // Set origin on page hides the dialog and arms the pick.
    await page.locator('#gridSetOriginOnPage').click();
    await page.waitForFunction(() => !document.getElementById('gridSettingsModal')?.classList.contains('visible'));
    expect(await page.evaluate(() => window.state.gridOriginPickMode)).toBe(true);

    // One click on the plan writes the origin and gives the dialog back.
    const pt = { x: 120, y: 80 };
    const c = await clientOf(page, pt);
    await page.mouse.click(c.x, c.y);
    await page.waitForSelector('#gridSettingsModal.visible', { timeout: 5000 });
    const picked = await page.evaluate(() => ({
      armed: window.state.gridOriginPickMode,
      x: window.state.gridSettings?.offsetX,
      y: window.state.gridSettings?.offsetY,
      shown: getComputedStyle(document.getElementById('gridOriginDisplay')).display !== 'none',
      form: document.getElementById('gridSetOriginFormGroup').style.display,
      text: document.getElementById('gridOriginText').textContent,
    }));
    expect(picked.armed).toBe(false);
    expect(picked.x).toBeCloseTo(pt.x / 10, 0);
    expect(picked.y).toBeCloseTo(pt.y / 10, 0);
    expect(picked.shown).toBe(true);
    expect(picked.form).toBe('none');
    expect(picked.text).toBe(picked.x.toFixed(2) + ', ' + picked.y.toFixed(2) + ' ft');

    // Apply keeps it.
    await page.locator('#gridSettingsApply').click();
    await page.waitForFunction(() => !document.getElementById('gridSettingsModal')?.classList.contains('visible'));
    const applied = await page.evaluate(() => ({ x: window.state.gridSettings.offsetX, y: window.state.gridSettings.offsetY, on: window.state.showGridOverlay }));
    expect(applied.x).toBe(picked.x);
    expect(applied.y).toBe(picked.y);
    expect(applied.on).toBe(true);

    // Esc during a pick drops it and gives the dialog back, origin untouched.
    await page.evaluate(() => window.App.toggleGridOverlay());   // overlay off
    await page.evaluate(() => window.App.toggleGridOverlay());   // settings back
    await page.waitForSelector('#gridSettingsModal.visible', { timeout: 5000 });
    await page.locator('#gridClearOrigin').click();
    await page.locator('#gridSetOriginOnPage').click();
    await page.waitForFunction(() => window.state.gridOriginPickMode === true);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#gridSettingsModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => window.state.gridOriginPickMode)).toBe(false);
    expect(await page.evaluate(() => [window.state.gridSettings.offsetX, window.state.gridSettings.offsetY])).toEqual([0, 0]);

    errors.assertNoErrors();
  });
});

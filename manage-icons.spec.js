// @ts-check
/**
 * Tests: the window.App registry pilot #4 - the Manage Icons modal extracted to
 * features/manage-icons.js still wires up and behaves identically.
 *
 * First multi-region feature move (the opener + a separate Close/Cancel/Save
 * handler block). Guards the registry failure modes (entry point never
 * registered; binding fires before the registry is populated) plus the modal's
 * three real behaviors: built-in rename, built-in reorder, and custom-icon
 * delete. getOrderedIcons/iconVbFor/getUserCustomIcons/saveUserCustomIcons/
 * showToast are published-only (still defined in app.js), so this also asserts
 * they are reachable on App.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Manage Icons modal', () => {
  test('registry wired; rename, reorder, and custom delete work with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: entry point + the 5 published-only deps.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openManageIconsModal,
      ordered: typeof window.App?.getOrderedIcons,
      vb: typeof window.App?.iconVbFor,
      getCustom: typeof window.App?.getUserCustomIcons,
      saveCustom: typeof window.App?.saveUserCustomIcons,
      toast: typeof window.App?.showToast,
    }));
    expect(wired.open).toBe('function');
    expect(wired.ordered).toBe('function');
    expect(wired.vb).toBe('function');
    expect(wired.getCustom).toBe('function');
    expect(wired.saveCustom).toBe('function');
    expect(wired.toast).toBe('function');

    // 3. OPEN via the registry; built-in rows render.
    await page.evaluate(() => window.App.openManageIconsModal());
    await page.waitForSelector('#manageIconsModal.visible', { timeout: 5000 });
    const rowCount = await page.locator('#manageIconsList .manage-icon-row').count();
    expect(rowCount).toBeGreaterThan(0);

    // 4. RENAME: set the first row's input, Save, assert state.iconNames.
    const firstPath = await page.evaluate(() => {
      const row = document.querySelector('#manageIconsList .manage-icon-row');
      const inp = row.querySelector('input');
      inp.value = 'ZZ Renamed';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return row.dataset.iconPath;
    });
    await page.locator('#manageIconsSave').click();
    await page.waitForFunction(
      () => !document.getElementById('manageIconsModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const renamed = await page.evaluate((p) => window.state.iconNames?.[p], firstPath);
    expect(renamed).toBe('ZZ Renamed');

    // 5. REORDER: reopen, send the first row to the bottom, Save, assert order.
    await page.evaluate(() => window.App.openManageIconsModal());
    await page.waitForSelector('#manageIconsModal.visible', { timeout: 5000 });
    await page.locator('#manageIconsList .manage-icon-row').first()
      .locator('button[data-action="bottom"]').click();
    await page.locator('#manageIconsSave').click();
    await page.waitForFunction(
      () => !document.getElementById('manageIconsModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const reorder = await page.evaluate((p) => ({
      isArr: Array.isArray(window.state.iconOrder),
      last: window.state.iconOrder ? window.state.iconOrder[window.state.iconOrder.length - 1] : null,
    }), firstPath);
    expect(reorder.isArr).toBe(true);
    expect(reorder.last).toBe(firstPath);

    // 6. CUSTOM DELETE: seed a custom icon, reopen, Edit -> select -> Delete.
    await page.evaluate(() => window.App.saveUserCustomIcons([
      { value: 'M1 1 H10 V10 H1 Z', name: 'TestCustom', viewBox: '0 0 24 24' },
    ]));
    await page.evaluate(() => window.App.openManageIconsModal());
    await page.waitForSelector('#manageIconsModal.visible', { timeout: 5000 });
    const customVisibleBefore = await page.evaluate(() => {
      const sec = document.getElementById('manageIconsCustomSection');
      return sec && sec.style.display !== 'none';
    });
    expect(customVisibleBefore).toBe(true);
    expect(await page.locator('#manageIconsCustomList .manage-icon-row-custom').count()).toBe(1);

    await page.locator('#manageIconsEditToggle').click();
    await page.locator('#manageIconsCustomList .manage-icon-row-custom .icon-select-cb').first().check();
    await page.locator('#manageIconsDeleteSelected').click();

    const afterDelete = await page.evaluate(() => ({
      count: window.App.getUserCustomIcons().length,
      hidden: document.getElementById('manageIconsCustomSection').style.display === 'none',
    }));
    expect(afterDelete.count).toBe(0);
    expect(afterDelete.hidden).toBe(true);

    expect(errors).toEqual([]);
  });
});

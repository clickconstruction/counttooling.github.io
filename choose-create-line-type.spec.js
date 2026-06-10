// @ts-check
/**
 * Tests: the window.App registry pilot #12 - the Choose/Create Line Type modal
 * (chooseLineTypeModal) extracted to features/choose-create-line-type.js still
 * wires up, creates line types from the Create tab, and selects existing ones
 * from the searchable Choose list.
 *
 * First split to share *constants* via the registry (TOOL, COLORS) plus the
 * publish-only populateQuickLineModal; state/uid/pushUndoSnapshot/
 * markProjectDirty/showModal/hideModal/updateUI were already on App. Guards the
 * registry contract (entry points registered) plus the moved opener, the Create
 * flow, and the Choose-list search + select.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Choose/Create Line Type modal', () => {
  test('registry wired; create + choose flows work with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the two entry points the feature file registers.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.showChooseLineTypeModal,
      tab: typeof window.App?.showLineTypeTab,
    }));
    expect(wired).toEqual({ open: 'function', tab: 'function' });

    // 3. Open via the registry; default tab is Choose.
    await page.evaluate(() => window.App.showChooseLineTypeModal());
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });

    // 4. CREATE: switch to the Create tab, name a line type, create it.
    const beforeCount = await page.evaluate(() => window.state.lineTypes.length);
    await page.evaluate(() => window.App.showLineTypeTab('create'));
    await page.locator('#createLineTypeName').fill('Spec Line A');
    await page.locator('#createLineTypeCreate').click();

    // Modal closes; a new line type is appended and made active.
    await page.waitForFunction(
      () => !document.getElementById('chooseLineTypeModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const afterCreate = await page.evaluate(() => {
      const lts = window.state.lineTypes;
      const last = lts[lts.length - 1];
      return {
        count: lts.length,
        lastName: last?.name,
        activeIsLast: window.state.activeLineTypeId === last?.id,
      };
    });
    expect(afterCreate.count).toBe(beforeCount + 1);
    expect(afterCreate.lastName).toBe('Spec Line A');
    expect(afterCreate.activeIsLast).toBe(true);

    // 5. CHOOSE: reopen, search the list, select an existing line type.
    await page.evaluate(() => window.App.showChooseLineTypeModal());
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });
    await page.locator('#lineTypeModalSearchInput').fill('Spec Line A');
    await page.waitForSelector('#chooseLineTypeList .sidebar-item', { timeout: 5000 });

    const targetId = await page.evaluate(() => {
      const lts = window.state.lineTypes;
      return lts.find(lt => lt.name === 'Spec Line A')?.id;
    });
    await page.locator('#chooseLineTypeList .sidebar-item').first().click();

    await page.waitForFunction(
      () => !document.getElementById('chooseLineTypeModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => window.state.activeLineTypeId)).toBe(targetId);

    expect(errors).toEqual([]);
  });
});

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

  // T2-08: every line-type create surface arms the Line tool (was: 3 of 4
  // dropped back to Move, dead-ending the naive sidebar-+Add-then-click path).
  test('T2-08a: sidebar + Add on a scaled page arms the pen and draws', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error' && !(msg.location()?.url || '').includes('config.local.js')) errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      window.state.pages[window.state.currentPage].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });

    await page.evaluate(() => document.getElementById('addLineType').click());
    await page.waitForSelector('#lineTypeModal.visible', { timeout: 5000 });
    await page.locator('#lineTypeName').fill('Armed Line');
    await page.locator('#lineTypeCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('lineTypeModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    const armed = await page.evaluate(() => {
      const lts = window.state.lineTypes;
      const last = lts[lts.length - 1];
      return {
        toolIsLine: window.state.tool === window.App.TOOL.LINE,
        activeIsLast: window.state.activeLineTypeId === last?.id,
        lastId: last?.id,
      };
    });
    expect(armed.toolIsLine).toBe(true);
    expect(armed.activeIsLast).toBe(true);

    // Two plan clicks commit a quick line of the NEW type — the naive path works.
    const wrapper = page.locator('#canvasWrapper');
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 150 } });
    const committed = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
      const q = ann.quickLines?.[ann.quickLines.length - 1];
      return { count: ann.quickLines?.length || 0, lineTypeId: q?.lineTypeId };
    });
    expect(committed.count).toBe(1);
    expect(committed.lineTypeId).toBe(armed.lastId);

    expect(errors).toEqual([]);
  });

  test('T2-08b: create on an unscaled page selects the type, stays in Move, shows the scale-gate toast', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.evaluate(() => document.getElementById('addLineType').click());
    await page.waitForSelector('#lineTypeModal.visible', { timeout: 5000 });
    await page.locator('#lineTypeName').fill('Unscaled Line');
    await page.locator('#lineTypeCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('lineTypeModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    const after = await page.evaluate(() => {
      const lts = window.state.lineTypes;
      const last = lts[lts.length - 1];
      return {
        lastName: last?.name,
        activeIsLast: window.state.activeLineTypeId === last?.id,
        toolIsNone: window.state.tool === window.App.TOOL.NONE,
        toastVisible: document.getElementById('setScaleFirstModal')?.classList.contains('visible'),
      };
    });
    expect(after.lastName).toBe('Unscaled Line');
    expect(after.activeIsLast).toBe(true);
    expect(after.toolIsNone).toBe(true);
    expect(after.toastVisible).toBe(true);
  });

  test('T2-08c: Quick Line skips the chooser at exactly one type, opens it at two', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state;
      s.pages[s.currentPage].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      s.lineTypes = [{ id: 'lt-only', name: 'Only', color: '#4a9eff', curveStyle: 'straight' }];
      s.activeLineTypeId = null;
    });

    await page.evaluate(() => document.getElementById('quickLine').click());
    const single = await page.evaluate(() => ({
      toolIsLine: window.state.tool === window.App.TOOL.LINE,
      active: window.state.activeLineTypeId,
      chooserVisible: document.getElementById('chooseLineTypeModal')?.classList.contains('visible'),
    }));
    expect(single.toolIsLine).toBe(true);
    expect(single.active).toBe('lt-only');
    expect(single.chooserVisible).toBe(false);

    // With two types the chooser opens exactly as today.
    await page.evaluate(() => {
      window.state.lineTypes.push({ id: 'lt-2', name: 'Second', color: '#ff6b6b', curveStyle: 'straight' });
      document.getElementById('quickLine').click();
    });
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });
  });
});

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
const { bootApp, collectConsoleErrors, uploadPdf } = require('./spec-helpers');

test.describe('window.App registry pilot - Choose/Create Line Type modal', () => {
  test('the sidebar + Add dialog has a door to the Quick creator, by click and by Shift+Q, even with exactly one line type (by hand, 2026-09-24)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    // exactly one line type: the header's Quick Line arms it instead of opening the chooser (T2-08)
    await page.evaluate(() => { window.state.lineTypes.push({ id: 'only', name: 'Only One', color: '#47c88e' }); window.state.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1 ft' }; window.App.updateUI(); });
    await page.click('#quickLine');
    expect(await page.locator('#chooseLineTypeModal.visible').count()).toBe(0);
    expect(await page.evaluate(() => window.state.activeLineTypeId)).toBe('only');
    // the sidebar's + Add: the plain dialog, whose Quick link opens the chooser on its Quick tab
    await page.click('#addLineType');
    await page.waitForSelector('#lineTypeModal.visible');
    await page.click('#lineTypeQuickLink');
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 3000 });
    expect(await page.locator('#lineTypeModal.visible').count()).toBe(0);
    expect(await page.evaluate(() => document.querySelector('#chooseLineTypeModal .line-type-tab.active')?.dataset.tab)).toBe('quick');
    await expect(page.locator('#quickLineAdd')).toBeVisible();
    // a size picked before a material is added survives the repopulate
    await page.selectOption('#quickLineSize', '0.75in');
    await page.click('#quickLineAddMaterial');
    await page.waitForSelector('#confirmModal.visible');
    await page.fill('#confirmInput', 'EMT');
    await page.click('#confirmOk');
    await page.waitForFunction(() => !document.querySelector('#confirmModal.visible'));
    expect(await page.evaluate(() => [document.getElementById('quickLineSize').value, document.getElementById('quickLineMaterial').value])).toEqual(['0.75in', 'EMT']);
    await page.evaluate(() => window.App.hideModal('chooseLineTypeModal'));
    await page.waitForFunction(() => !document.querySelector('#chooseLineTypeModal.visible'), null, { timeout: 3000 });
    // and Shift+Q from the plain dialog does the same
    await page.click('#addLineType');
    await page.waitForSelector('#lineTypeModal.visible');
    await page.keyboard.press('Shift+Q');
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 3000 });
    expect(await page.evaluate(() => document.querySelector('#chooseLineTypeModal .line-type-tab.active')?.dataset.tab)).toBe('quick');
    errors.assertNoErrors();
  });

  test('registry wired; create + choose flows work with no errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await bootApp(page);

    // 1. Upload a 2-page PDF.
    await uploadPdf(page);

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

    errors.assertNoErrors();
  });

  // T2-08: every line-type create surface arms the Line tool (was: 3 of 4
  // dropped back to Move, dead-ending the naive sidebar-+Add-then-click path).
  test('T2-08a: sidebar + Add on a scaled page arms the pen and draws', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await bootApp(page);
    await uploadPdf(page);
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

    errors.assertNoErrors();
  });

  test('T2-08b: create on an unscaled page selects the type, stays in Move, shows the scale-gate toast', async ({ page }) => {
    await bootApp(page);
    await uploadPdf(page);

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
    await bootApp(page);
    await uploadPdf(page);
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
  // MAP-XSS (DECOMPOSITION_MAP R01): a line type's name and color, and a counter's
  // color and icon path, are the estimator's own words, or a shared or imported
  // project's. Every surface that writes them into markup writes them as text: the
  // Line chooser, the Polyline dialog's select, the sidebar lists, and the header's
  // active swatch and counter button.
  test('MAP-XSS: a line-type name, a color or an icon path written as markup is shown as text on every surface', async ({ page }) => {
    // The browser refusing the poisoned icon as path data ("<path> attribute d: Expected
    // path command") is the escape working: the string stayed an attribute value.
    const errors = collectConsoleErrors(page, { ignore: ['<path> attribute d'] });
    await bootApp(page);
    await uploadPdf(page);

    const NAME = '<img src=x onerror="window.__xss=1">Poison';
    const COLOR = '#4a9eff" onmouseover="window.__xss=2';
    const ICON = 'M0 0h10v10H0z"/><img src=x onerror="window.__xss=3"><path d="';
    const seed = { NAME, COLOR, ICON };

    // The sidebar lists and the header, with the poisoned pair active (the active
    // item is exempt from the usage filter, so it is always listed).
    await page.evaluate(({ NAME, COLOR, ICON }) => {
      window.state.lineTypes.push({ id: 'lt-xss', name: NAME, color: COLOR });
      window.state.counters.push({ id: 'c-xss', name: 'Poison Counter', icon: ICON, color: COLOR });
      window.state.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1 ft' };
      window.state.activeLineTypeId = 'lt-xss';
      window.state.activeCounterType = 'c-xss';
      window.state.tool = window.App.TOOL.LINE;
      window.App.updateUI();
    }, seed);
    expect(await page.locator('#lineTypesList img, #countersList img, #headerActiveLineType img').count()).toBe(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('#lineTypesList .line-type-name')].map((e) => e.textContent))).toContain(NAME);
    expect(await page.evaluate(() => document.querySelector('#countersList .counter-drag-handle path')?.getAttribute('d'))).toBe(ICON);
    expect(await page.locator('#headerActiveLineType .header-type-swatch').count()).toBe(1);

    await page.evaluate(() => { window.state.tool = window.App.TOOL.COUNTER; window.App.updateUI(); });
    expect(await page.locator('#counterBtn img, #counterBtnSidebar img').count()).toBe(0);
    expect(await page.evaluate(() => document.querySelector('#counterBtn path')?.getAttribute('d'))).toBe(ICON);

    // The Line chooser.
    await page.evaluate(() => window.App.showChooseLineTypeModal());
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });
    await page.waitForSelector('#chooseLineTypeList .sidebar-item', { timeout: 5000 });
    expect(await page.locator('#chooseLineTypeList img').count()).toBe(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('#chooseLineTypeList .line-type-name')].map((e) => e.textContent))).toContain(NAME);
    await page.evaluate(() => window.App.hideModal('chooseLineTypeModal'));
    await page.waitForFunction(() => !document.querySelector('#chooseLineTypeModal.visible'), null, { timeout: 3000 });

    // The Polyline dialog's select (opens only with no active line type).
    await page.evaluate(() => { window.state.activeLineTypeId = null; window.state.tool = window.App.TOOL.NONE; window.App.updateUI(); });
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });   // the button may sit behind the header's ⋯
    await page.waitForSelector('#polylineModal.visible', { timeout: 5000 });
    expect(await page.locator('#polylineLineType img').count()).toBe(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('#polylineLineType option')].map((o) => o.textContent))).toContain(NAME);

    // Nothing ran, and no attribute broke out of its value anywhere on the page.
    expect(await page.evaluate(() => ({ ran: window.__xss, handlers: document.querySelectorAll('[onmouseover], [onerror]').length }))).toEqual({ ran: undefined, handlers: 0 });
    errors.assertNoErrors();
  });
});

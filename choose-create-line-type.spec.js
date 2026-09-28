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

  // XSS-COLOR (DECOMPOSITION_MAP S02 / N02): the four surfaces MAP-XSS missed. A
  // group's color in the groups list, a line's color in the Lines list, a counter's
  // color and icon path in the Counter chooser, and a room's color and id in the room
  // picker. The hostile values are inert: breaking out of the attribute would only
  // plant a data-xss attribute or a <b data-xss> element, so the test asserts none
  // exists anywhere on the page and each value reads back whole as its attribute.
  test('XSS-COLOR: a color, an icon path or a room id that closes its attribute stays attribute text on the four surfaces MAP-XSS missed', async ({ page }) => {
    // The browser refusing the poisoned icon as path data is the escape working.
    const errors = collectConsoleErrors(page, { ignore: ['<path> attribute d'] });
    await bootApp(page);
    await uploadPdf(page);

    const COLOR = '#4a9eff" data-xss="attr"><b data-xss="el"></b><i title="';
    const ICON = 'M0 0h10v10H0z"/><b data-xss="icon"></b><path d="';
    const ROOM_ID = 'room-x" data-xss="room-id';
    const UNIT = 'ft<b data-xss="unit"></b>';
    const injected = () => page.evaluate(() => [...document.querySelectorAll('[data-xss]')].map((e) => e.tagName + ':' + e.getAttribute('data-xss')));

    await page.evaluate(({ COLOR, ICON, ROOM_ID, UNIT }) => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1 ft' };
      s.lineTypes.push({ id: 'lt-x', name: 'Plain', color: '#47c88e' });
      s.groupsEnabled = true;
      s.groups.push({ id: 'g-x', name: 'Plain Group', color: COLOR });
      s.pages[0].canvases[0].annotations.quickLines.push({ x1: 100, y1: 500, x2: 220, y2: 500, id: 'q-x', lineTypeId: 'lt-x', color: COLOR, endDrop: 3, endDropUnit: UNIT });
      s.counters.push({ id: 'c-x', name: 'Plain Counter', icon: ICON, color: COLOR });
      s.rooms.push({ id: ROOM_ID, name: 'Plain Room', color: COLOR });
      window.App.updateUI();
    }, { COLOR, ICON, ROOM_ID, UNIT });

    // The groups list and the Lines list (the swatch shows only to an editor).
    expect(await page.evaluate(() => document.querySelector('#groupsList .swatch')?.getAttribute('style'))).toBe('background:' + COLOR);
    expect(await page.evaluate(() => document.querySelector('#linesList .swatch')?.getAttribute('style'))).toBe('background:' + COLOR);
    expect(await page.evaluate(() => document.querySelector('#linesList .line-drops')?.textContent)).toContain(UNIT);
    expect(await injected()).toEqual([]);

    // The Counter chooser: the list opens on Choose when counters exist.
    await page.evaluate(() => document.getElementById('counterBtn').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.waitForSelector('#counterChooseList .sidebar-item', { timeout: 5000 });
    expect(await page.evaluate(() => document.querySelector('#counterChooseList path')?.getAttribute('d'))).toBe(ICON);
    expect(await page.evaluate(() => document.querySelector('#counterChooseList path')?.getAttribute('fill'))).toBe(COLOR);
    expect(await page.evaluate(() => document.querySelector('#counterChooseList .swatch')?.getAttribute('style'))).toBe('background:' + COLOR);
    expect(await injected()).toEqual([]);
    await page.evaluate(() => window.App.hideModal('counterModal'));

    // The room picker in the Room Size dialog.
    await page.evaluate(() => window.App.openRoomBoxModal({ x1: 0, y1: 0, x2: 240, y2: 120 }));
    await page.waitForSelector('#roomBoxModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => document.querySelector('#roomBoxRoomList .room-picker-item')?.dataset.roomId)).toBe(ROOM_ID);
    expect(await page.evaluate(() => document.querySelector('#roomBoxRoomList .room-swatch')?.getAttribute('style'))).toBe('background:' + COLOR);
    // Picking the room still selects it by its exact id.
    await page.click('#roomBoxRoomList .room-picker-item');
    expect(await page.locator('#roomBoxRoomList .room-picker-item.selected').count()).toBe(1);
    expect(await injected()).toEqual([]);
    errors.assertNoErrors();
  });

  // XSS-COLOR sweep: what the sweep found past the four named surfaces. A project's
  // custom icon (customIconPaths) sets the viewBox and the set heading of every icon
  // grid; a zone multiplier is SUMMED into every count; a circuit group's load and a
  // room's color print in the sidebar and the report. All inert, as above.
  test('XSS-COLOR sweep: a custom icon, a zone multiplier, a circuit load and a room color from a project stay text in the sidebar, the icon grid and the printed report', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: ['<path> attribute d', '<svg> attribute viewBox'] });
    await bootApp(page);
    await uploadPdf(page);

    const COLOR = '#4a9eff" data-xss="attr"><b data-xss="el"></b><i title="';
    const ICON = 'M0 0h5v5H0z';
    const VB = '0 0 5 5" data-xss="viewbox"><b data-xss="vb-el"></b><i title="';
    const SET = 'odd<b data-xss="set"></b>';
    const MULT = '<b data-xss="mult"></b>';
    const AMPS = '<b data-xss="amps"></b>';
    const injected = () => page.evaluate(() => [...document.querySelectorAll('[data-xss]')].map((e) => e.tagName + ':' + e.getAttribute('data-xss')));

    await page.evaluate(({ COLOR, ICON, VB, SET, MULT, AMPS }) => {
      const s = window.state;
      window.App.saveUserCustomIcons([{ value: ICON, viewBox: VB, name: 'Odd icon', set: SET }]);   // as a project's customIconPaths would
      s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1 ft' };
      s.lineTypes.push({ id: 'lt-s', name: 'Plain Line', color: COLOR });
      s.counters.push({ id: 'c-s', name: 'Plain Counter', icon: ICON, color: COLOR });
      s.groupsEnabled = true;
      s.groups.push({ id: 'g-s', name: 'Circuit', color: '#47c88e', panel: 'LP-1', circuit: '7', loadAmps: AMPS });
      s.rooms.push({ id: 'r-s', name: 'Plain Room', color: COLOR });
      const ann = s.pages[0].canvases[0].annotations;
      ann.counterMarkers['c-s'] = [{ x: 50, y: 50 }];
      ann.multiplyZones.push({ id: 'z-s', x1: 0, y1: 0, x2: 100, y2: 100, multiplier: MULT });
      ann.quickLines.push({ x1: 100, y1: 500, x2: 220, y2: 500, id: 'q-s', lineTypeId: 'lt-s', color: COLOR });
      ann.roomBoxes.push({ x1: 300, y1: 300, x2: 400, y2: 380, roomId: 'r-s', heightFt: 9 });
      window.App.updateUI();
    }, { COLOR, ICON, VB, SET, MULT, AMPS });

    // The sidebar: the counter row's viewBox and its repeat badge (the junk multiplier reads as 1),
    // and the circuit group's tag.
    expect(await page.evaluate(() => document.querySelector('#countersList .counter-drag-handle svg')?.getAttribute('viewBox'))).toBe(VB);
    expect(await page.evaluate(() => [...document.querySelectorAll('#countersList .badge')].map((b) => b.textContent))).toContain('1');
    expect(await page.evaluate(() => document.querySelector('#groupsList .group-system-tag')?.textContent)).toBe('LP-1/7 · ' + AMPS + ' A');
    expect(await injected()).toEqual([]);

    // The Counter dialog's Create tab: the custom icon grid, its cell and its set heading.
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.evaluate(() => window.App.buildCreateCustomIconGrid());
    expect(await page.evaluate((icon) => [...document.querySelectorAll('#counterIconGridCustom .icon-cell')].some((c) => c.dataset.path === icon), ICON)).toBe(true);
    expect(await page.evaluate(() => [...document.querySelectorAll('#counterIconGridCustom .icon-grid-heading')].map((h) => h.textContent))).toContain('Odd<b data-xss="set"></b>');
    expect(await injected()).toEqual([]);
    await page.evaluate(() => window.App.hideModal('counterModal'));

    // The printed report, parsed as the print window would parse it.
    const report = await page.evaluate(() => {
      const doc = new DOMParser().parseFromString(window.buildReportHtml(), 'text/html');
      return {
        injected: [...doc.querySelectorAll('[data-xss]')].map((e) => e.tagName + ':' + e.getAttribute('data-xss')),
        swatches: [...doc.querySelectorAll('.report-type-swatch')].map((e) => e.getAttribute('style')),
        viewBoxes: [...doc.querySelectorAll('.report-type-icon svg')].map((e) => e.getAttribute('viewBox')),
      };
    });
    expect(report.injected).toEqual([]);
    expect(report.swatches).toContain('background:' + COLOR + ';');
    expect(report.viewBoxes).toContain(VB);
    errors.assertNoErrors();
  });
});

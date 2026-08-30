// @ts-check
/**
 * Tests: the window.App registry pilot #17 - the Counter modal (#counterModal)
 * choose/create-counter picker extracted to features/counter.js still creates
 * counters and selects existing ones.
 *
 * Interleaved extraction with bidirectional quickcount coupling: the feature
 * registers App.showCounterTab and consumes App.populateCounterQuickCountPanel
 * (which stays in app.js's Quick Count section). Three new publish-only deps
 * (getIconName, getEffectiveCustomIcons, populateCounterQuickCountPanel). The
 * #counterBtn / #addCounter handlers are clicked programmatically to avoid
 * sidebar visibility flakiness; the in-modal buttons use real clicks.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Counter modal', () => {
  test('registry wired; create + choose flows work with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract.
    expect(await page.evaluate(() => typeof window.App?.showCounterTab)).toBe('function');

    // 3. CREATE: open the create tab via #addCounter, name it, Create.
    const beforeCount = await page.evaluate(() => window.state.counters.length);
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.locator('#counterName').fill('Spec Counter');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const afterCreate = await page.evaluate(() => {
      const cs = window.state.counters;
      const last = cs[cs.length - 1];
      return { count: cs.length, name: last?.name, id: last?.id, activeIsLast: window.state.activeCounterType === last?.id };
    });
    expect(afterCreate.count).toBe(beforeCount + 1);
    expect(afterCreate.name).toBe('Spec Counter');
    expect(afterCreate.activeIsLast).toBe(true);

    // 4. CHOOSE: reopen via #counterBtn (choose tab), select the counter.
    const targetId = afterCreate.id;
    await page.evaluate(() => document.getElementById('counterBtn').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.waitForSelector('#counterChooseList .sidebar-item', { timeout: 5000 });
    await page.locator('#counterChooseList .sidebar-item').first().click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => window.state.activeCounterType)).toBe(targetId);

    expect(errors).toEqual([]);
  });

  test('choose-tab badge sums counter marks across all canvases', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF and create a counter.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.locator('#counterName').fill('Badge Counter');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const cid = await page.evaluate(() => window.state.counters[window.state.counters.length - 1].id);

    // 2. Seed 4 marks spread across pages AND canvases (marker shape from
    // app.js: { x, y, id, group } — only .length matters to the badge):
    // 2 on page 0's active canvas, 1 on a second NON-active canvas of page 0
    // (the across-canvases half an active-only sum would miss), 1 on page 1.
    await page.evaluate((counterId) => {
      const App = window.App;
      const state = window.state;
      const mark = (n) => ({ x: 10 * n, y: 10 * n, id: 'spec-m' + n, group: null });
      const a0 = App.getActiveAnnotations(state.pages[0], 0);
      a0.counterMarkers[counterId] = a0.counterMarkers[counterId] || [];
      a0.counterMarkers[counterId].push(mark(1), mark(2));
      const layer2 = { id: 'spec-c2', name: 'Layer 2', annotations: App.makeAnnotations() };
      layer2.annotations.counterMarkers[counterId] = [mark(3)];
      state.pages[0].canvases.push(layer2);
      const a1 = App.getActiveAnnotations(state.pages[1], 1);
      a1.counterMarkers[counterId] = a1.counterMarkers[counterId] || [];
      a1.counterMarkers[counterId].push(mark(4));
    }, cid);

    // 3. Reopen the Choose tab: the badge must read the all-pages,
    // all-canvases total (4), not the dead p.annotations sum (0).
    await page.evaluate(() => document.getElementById('counterBtn').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.waitForSelector('#counterChooseList .sidebar-item', { timeout: 5000 });
    const badge = page.locator('#counterChooseList .sidebar-item', { hasText: 'Badge Counter' }).locator('.badge');
    await expect(badge).toHaveText('4');

    expect(errors).toEqual([]);
  });
});

// T2-05 commit 1 — create ergonomics: both openers share prepCreatePanel()
// (next-unused-icon name prefill, custom grid populated), C lands on Create
// when the palette is empty, the twin guard suffixes + rotates color on an
// exact duplicate, and a blank name never mints the literal "Counter".
test.describe('T2-05 counter-modal create ergonomics', () => {
  /** @param {import('@playwright/test').Page} page @param {string[]} errors */
  async function boot(page, errors) {
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  }

  test('zero counters: #counterBtn lands on Create prefilled like +Add; Choose empty state reworded', async ({ page }) => {
    const errors = [];
    await boot(page, errors);

    await page.evaluate(() => document.getElementById('counterBtn').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    const info = await page.evaluate(() => {
      const App = window.App;
      const icons = App.getOrderedIcons();
      const cells = Array.from(document.querySelectorAll('#counterIconGrid .icon-cell'));
      return {
        createVisible: document.getElementById('counterCreatePanel').style.display !== 'none',
        chooseVisible: document.getElementById('counterChoosePanel').style.display !== 'none',
        expectedName: App.getIconName(icons[0].value),
        name: /** @type {HTMLInputElement} */ (document.getElementById('counterName')).value,
        selectedIdx: cells.findIndex((c) => c.classList.contains('selected')),
        customCellCount: document.querySelectorAll('#counterIconGridCustom .icon-cell').length,
      };
    });
    expect(info.createVisible).toBe(true);
    expect(info.chooseVisible).toBe(false);
    expect(info.name).toBe(info.expectedName);
    expect(info.selectedIdx).toBe(0);
    expect(info.customCellCount).toBeGreaterThan(0);

    // Manual switch to Choose with zero counters shows the new copy verbatim.
    await page.locator('#counterModal .counter-tab[data-tab="choose"]').click();
    await expect(page.locator('#counterChooseEmpty')).toBeVisible();
    await expect(page.locator('#counterChooseEmpty')).toHaveText('No counters yet — use the Create tab above.');

    expect(errors).toEqual([]);
  });

  test('next-unused prefill, twin guard (suffix + color rotate), blank-name fallback', async ({ page }) => {
    const errors = [];
    await boot(page, errors);

    // Seed a counter named after icon[0]: the prefill must walk to icon[1].
    await page.evaluate(() => {
      const App = window.App;
      const icons = App.getOrderedIcons();
      window.state.counters.push({ id: 'seed-1', name: App.getIconName(icons[0].value), icon: icons[0].value, color: '#123456' });
    });
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    const prefill = await page.evaluate(() => {
      const App = window.App;
      const icons = App.getOrderedIcons();
      const cells = Array.from(document.querySelectorAll('#counterIconGrid .icon-cell'));
      return {
        expectedName: App.getIconName(icons[1].value),
        name: /** @type {HTMLInputElement} */ (document.getElementById('counterName')).value,
        selectedIdx: cells.findIndex((c) => c.classList.contains('selected')),
      };
    });
    expect(prefill.name).toBe(prefill.expectedName);
    expect(prefill.selectedIdx).toBe(1);
    const twinName = prefill.expectedName;

    // Create the prefilled counter as-is (default color).
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => !document.getElementById('counterModal')?.classList.contains('visible'), { timeout: 5000 });
    const first = await page.evaluate(() => {
      const c = window.state.counters[window.state.counters.length - 1];
      return { name: c.name, color: c.color };
    });
    expect(first.name).toBe(twinName);

    // Exact twin (same name + icon + default color, changed nothing else):
    // numbered suffix AND rotated color.
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.evaluate(() => {
      document.querySelectorAll('#counterIconGrid .icon-cell')[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.locator('#counterName').fill(twinName);
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => !document.getElementById('counterModal')?.classList.contains('visible'), { timeout: 5000 });
    const second = await page.evaluate(() => {
      const c = window.state.counters[window.state.counters.length - 1];
      return { name: c.name, color: c.color };
    });
    expect(second.name).toBe(twinName + ' 2');
    expect(second.color).not.toBe(first.color);

    // Same name but a deliberately different color: suffix only, color kept.
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.evaluate(() => {
      document.querySelectorAll('#counterIconGrid .icon-cell')[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const sw = document.querySelector('#counterColorRow .color-swatch[data-color="#2c3e50"]');
      if (sw) sw.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.locator('#counterName').fill(twinName);
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => !document.getElementById('counterModal')?.classList.contains('visible'), { timeout: 5000 });
    const third = await page.evaluate(() => {
      const c = window.state.counters[window.state.counters.length - 1];
      return { name: c.name, color: c.color };
    });
    expect(third.name).toBe(twinName + ' 3');
    expect(third.color).toBe('#2c3e50');

    // Blank name falls back to the selected icon's name — never "Counter".
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    const prefillName = await page.locator('#counterName').inputValue();
    await page.locator('#counterName').fill('');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => !document.getElementById('counterModal')?.classList.contains('visible'), { timeout: 5000 });
    const last = await page.evaluate(() => ({
      name: window.state.counters[window.state.counters.length - 1].name,
      anyLiteralCounter: window.state.counters.some((c) => c.name === 'Counter'),
    }));
    expect(last.name).toBe(prefillName);
    expect(last.anyLiteralCounter).toBe(false);

    expect(errors).toEqual([]);
  });

  // T2-05 commit 2 — the icon search ships visible: the inline display:none
  // on #counterIconSearchGroup is gone, the group shows on the Icon tab only
  // (the live handler filters the built-in grid), and typing filters the grid.
  test('icon search is visible on the Icon tab, hidden on Custom Icons, and filters the grid', async ({ page }) => {
    const errors = [];
    await boot(page, errors);

    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    const searchGroup = page.locator('#counterIconSearchGroup');
    await expect(searchGroup).toBeVisible();

    await page.locator('#counterCreatePanel .counter-icon-tab[data-icon-tab="custom"]').click();
    await expect(searchGroup).toBeHidden();
    await page.locator('#counterCreatePanel .counter-icon-tab[data-icon-tab="icon"]').click();
    await expect(searchGroup).toBeVisible();

    const fullCount = await page.locator('#counterIconGrid .icon-cell').count();
    await page.locator('#counterIconSearch').fill('water');
    // oninput fires on fill; the grid rebuilds synchronously.
    const filtered = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('#counterIconGrid .icon-cell'));
      return { count: cells.length, firstSelected: cells[0]?.classList.contains('selected') || false };
    });
    expect(filtered.count).toBeGreaterThan(0);
    expect(filtered.count).toBeLessThan(fullCount);
    expect(filtered.firstSelected).toBe(true);

    expect(errors).toEqual([]);
  });
});

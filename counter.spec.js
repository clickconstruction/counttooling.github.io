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

  test('create-tab icon search is visible and filters; modal counter search hides off the Choose tab', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });

    // #18: the icon search must actually be on screen (it used to ship with an
    // inline display:none — a live handler with no UI).
    await expect(page.locator('#counterIconSearchGroup')).toBeVisible();
    // B17: the modal-level "Search counters..." box only filters the Choose
    // list, so it must be hidden on the Create tab.
    await expect(page.locator('#counterModalSearchInput')).toBeHidden();

    // Filtering narrows the library grid.
    const allCells = await page.locator('#counterIconGrid .icon-cell').count();
    expect(allCells).toBeGreaterThan(1);
    await page.locator('#counterIconSearch').fill('shower');
    const filtered = await page.locator('#counterIconGrid .icon-cell').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(allCells);
    // A filtered cell still selects on click with the shared wiring.
    await page.locator('#counterIconGrid .icon-cell').first().click();
    expect(await page.locator('#counterIconGrid .icon-cell.selected').count()).toBe(1);

    // The search filters only the library grid, so it hides on the Custom tab.
    await page.locator('#counterCreatePanel .counter-icon-tab[data-icon-tab="custom"]').click();
    await expect(page.locator('#counterIconSearchGroup')).toBeHidden();
    await page.locator('#counterCreatePanel .counter-icon-tab[data-icon-tab="icon"]').click();
    await expect(page.locator('#counterIconSearchGroup')).toBeVisible();

    // Back on Choose, the counter search returns.
    await page.locator('#counterModal .counter-tab[data-tab="choose"]').click();
    await expect(page.locator('#counterModalSearchInput')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('C lands on Create when empty; back-to-back "+ Add" and exact twins never mint identical counters', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const modalClosed = () => page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    // With NO counters yet, the C hotkey lands on the prefilled Create tab
    // instead of the dead-end empty Choose tab.
    await page.keyboard.press('c');
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await expect(page.locator('#counterCreatePanel')).toBeVisible();
    const prefill0 = await page.locator('#counterName').inputValue();
    expect(prefill0.trim()).not.toBe('');
    await page.locator('#counterCreate').click();
    await modalClosed();

    // "+ Add" prefills the NEXT unused icon, so an untouched second create
    // cannot mint an identical twin.
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    const prefill1 = await page.locator('#counterName').inputValue();
    expect(prefill1).not.toBe(prefill0);
    await page.locator('#counterCreate').click();
    await modalClosed();

    const [c0, c1] = await page.evaluate(() =>
      window.state.counters.map((c) => ({ name: c.name, icon: c.icon, color: c.color })));
    expect(c1.name).not.toBe(c0.name);
    expect(c1.icon).not.toBe(c0.icon);

    // Forcing an exact twin (same name + icon + default color) de-twins with a
    // numbered suffix and a rotated color, so tallies cannot silently split
    // between two indistinguishable counters at pricing time.
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.locator('#counterIconGrid .icon-cell').first().click(); // c0's icon
    await page.locator('#counterName').fill(c0.name);
    await page.locator('#counterCreate').click();
    await modalClosed();

    const all = await page.evaluate(() =>
      window.state.counters.map((c) => ({ name: c.name, icon: c.icon, color: c.color })));
    const minted = all[all.length - 1];
    expect(minted.icon).toBe(c0.icon);
    expect(minted.name).toBe(c0.name + ' 2');
    expect(minted.color).not.toBe(c0.color);
    const keys = all.map((c) => c.name + '|' + c.icon + '|' + c.color);
    expect(new Set(keys).size).toBe(keys.length);

    // With counters existing, C still lands on Choose.
    await page.keyboard.press('c');
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await expect(page.locator('#counterChoosePanel')).toBeVisible();
    await expect(page.locator('#counterCreatePanel')).toBeHidden();

    expect(errors).toEqual([]);
  });
});

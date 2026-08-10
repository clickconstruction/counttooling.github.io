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

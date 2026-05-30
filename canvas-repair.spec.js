// @ts-check
/**
 * Tests: the window.App registry pilot - Canvas Repair extracted to
 * features/canvas-repair.js still wires up and runs a behavior-neutral apply.
 *
 * Guards against the two registry failure modes: (1) the feature file never
 * registers its entry points on window.App, and (2) the app.js call-site
 * bindings fire before the registry is populated. Also asserts a no-op apply
 * (defaults: same source page, same rotation) preserves a page-0 marker and
 * produces no console / page errors.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Canvas Repair', () => {
  test('registry is wired and a no-op apply preserves annotations without errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    const pdfPath = path.join(__dirname, 'test-2pages.pdf');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(pdfPath);
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    expect(await page.locator('#pagesList .sidebar-item').count()).toBe(2);

    // 2. Add a counter marker on page 0 via state.
    await page.evaluate(() => {
      const state = window.state;
      if (!state?.pages?.[0]?.canvases?.[0]) return;
      const cid = 'cc_' + Date.now();
      state.counters.push({ id: cid, name: 'Test', icon: 'M320 320', color: '#e8c547' });
      const canvas = state.pages[0].canvases[0];
      if (!canvas.annotations.counterMarkers) canvas.annotations.counterMarkers = {};
      canvas.annotations.counterMarkers[cid] = [{ x: 100, y: 100, n: 1 }];
    });

    const markerCount = () => page.evaluate(() => {
      const ann = window.state?.pages?.[0]?.canvases?.[0]?.annotations;
      if (!ann?.counterMarkers) return 0;
      return Object.values(ann.counterMarkers).flat().length;
    });
    expect(await markerCount()).toBe(1);

    // 3. Registry contract: app.js published the entry points onto window.App.
    const registryWired = await page.evaluate(() => ({
      hasApp: !!window.App,
      open: typeof window.App?.openCanvasRepairModal,
      apply: typeof window.App?.applyCanvasRepair,
      hasState: window.App?.state === window.state,
    }));
    expect(registryWired.hasApp).toBe(true);
    expect(registryWired.open).toBe('function');
    expect(registryWired.apply).toBe('function');
    expect(registryWired.hasState).toBe(true);

    // 4. Open the modal through the registry; rows populate from state.pages.
    await page.evaluate(() => window.App.openCanvasRepairModal());
    await page.waitForSelector('#canvasRepairModal.visible', { timeout: 5000 });
    expect(await page.locator('#canvasRepairBody tr[data-page-index]').count()).toBe(2);

    // 5. Apply with the default (no-op) mapping via the wired button binding.
    //    hideModal() drops the `.visible` class (element stays in the DOM).
    await page.locator('#canvasRepairApply').click();
    await page.waitForFunction(
      () => !document.getElementById('canvasRepairModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    // 6. Marker survives, page count unchanged, no errors fired.
    expect(await markerCount()).toBe(1);
    expect(await page.locator('#pagesList .sidebar-item').count()).toBe(2);
    expect(errors).toEqual([]);
  });
});

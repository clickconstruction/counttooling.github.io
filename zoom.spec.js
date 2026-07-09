// @ts-check
/**
 * Tests: the window.App registry pilot #3 - the Zoom Settings modal extracted to
 * features/zoom.js still wires up and persists its settings.
 *
 * Guards the registry failure modes (entry point never registered; binding
 * fires before the registry is populated) plus the modal's Close behavior:
 * editing max zoom + wheel speed and closing writes state.maxZoom and
 * localStorage.zoomSettings. getMaxZoom/getWheelZoomSpeed are published-only
 * (still defined in app.js), so this also asserts they are reachable on App.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Zoom modal', () => {
  test('registry wired; settings persist on close with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: entry point + the published-only getters.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.showZoomModal,
      getMax: typeof window.App?.getMaxZoom,
      getSpeed: typeof window.App?.getWheelZoomSpeed,
    }));
    expect(wired.open).toBe('function');
    expect(wired.getMax).toBe('function');
    expect(wired.getSpeed).toBe('function');

    // 3. Open via the registry (direct call avoids the matchMedia mobile branch).
    await page.evaluate(() => window.App.showZoomModal());
    await page.waitForSelector('#zoomModal.visible', { timeout: 5000 });

    // 4. Edit max zoom (-> 600%) and wheel speed (-> 200%), dispatching input.
    await page.evaluate(() => {
      const max = document.getElementById('zoomMax');
      max.value = '600';
      max.dispatchEvent(new Event('input', { bubbles: true }));
      const speed = document.getElementById('zoomSpeed');
      speed.value = '200';
      speed.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 5. Close commits the settings.
    await page.locator('#zoomModalClose').click();
    await page.waitForFunction(
      () => !document.getElementById('zoomModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    const result = await page.evaluate(() => ({
      maxZoom: window.state.maxZoom,
      speed: JSON.parse(localStorage.getItem('zoomSettings') || '{}').wheelZoomSpeed,
    }));
    expect(result.maxZoom).toBe(6);
    expect(result.speed).toBe(2);

    expect(errors).toEqual([]);
  });

  test('default is 400%; ceiling raised to 1200% and zoom reaches it without going black', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Default max zoom is 400%.
    expect(await page.evaluate(() => window.App.getMaxZoom())).toBe(4);

    await page.evaluate(() => window.App.showZoomModal());
    await page.waitForSelector('#zoomModal.visible', { timeout: 5000 });
    // The slider ceiling is now 1200 and it reflects the live 400% default.
    const slider = await page.evaluate(() => {
      const m = document.getElementById('zoomMax');
      return { max: m.max, value: m.value };
    });
    expect(slider.max).toBe('1200');
    expect(slider.value).toBe('400');

    // Raise to 1200% and close -> persisted as 12.
    await page.evaluate(() => { const m = document.getElementById('zoomMax'); m.value = '1200'; m.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#zoomModalClose').click();
    await page.waitForFunction(() => !document.getElementById('zoomModal')?.classList.contains('visible'), { timeout: 5000 });
    expect(await page.evaluate(() => window.state.maxZoom)).toBe(12);

    // Zoom all the way to 1200% and confirm it still renders (the canvas-cap clamp
    // keeps the buffer under the device limit instead of going black).
    await page.evaluate(() => { window.state.zoom = window.App.getMaxZoom(); window.App.renderPdf(); });
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, { timeout: 5000 });
    expect(await page.evaluate(() => window.state.zoom)).toBe(12);
    expect(errors).toEqual([]);
  });

  test('mobile: the zoom rail has a Settings gear that opens the Zoom modal (rail stays open)', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.setViewportSize({ width: 390, height: 844 });   // mobile -> zoom-% opens the rail only
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Tap the zoom % -> the zoom rail (replaced the old #zoomOverlay popover).
    await page.locator('#zoomPct').click();
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });

    // The gear opens the Zoom Settings modal; the rail is designed to coexist
    // with it (unlike the old popover, it does NOT dismiss).
    await page.locator('#zoomRailSettings').click();
    await page.waitForSelector('#zoomModal.visible', { timeout: 3000 });
    expect(await page.evaluate(() => document.getElementById('zoomMax').max)).toBe('1200');
    expect(await page.evaluate(() => document.getElementById('zoomRail').classList.contains('visible'))).toBe(true);

    expect(errors).toEqual([]);
  });
});

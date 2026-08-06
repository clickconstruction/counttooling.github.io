// @ts-check
/**
 * Tests: viewport clamping for fixed-position popovers (App.placeFixedMenu →
 * the pure clampMenuPosition in geometry.js). Field report: right-clicking a
 * line at the bottom of the screen opened the canvas context menu
 * (#contextMenu) half off-screen — Delete unreachable. Every popover now
 * routes its coordinates through the shared clamp, so a menu can never open
 * outside the viewport.
 *
 * The main test reproduces the report: a short viewport, a quick line seeded
 * so it sits ~20 CSS px above the canvas bottom, a REAL right-click on it —
 * the menu must open fully on-screen (pulled up above the pointer). A second
 * test covers the footer drop-up path (measured height + clamp).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function menuRect(page, sel) {
  return page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, vw: window.innerWidth, vh: window.innerHeight };
  }, sel);
}

test.describe('Popover viewport clamping (App.placeFixedMenu)', () => {
  test.use({ viewport: { width: 1000, height: 520 } });

  test('canvas context menu on a line at the screen bottom stays fully on-screen', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 300, { timeout: 10000 });

    // Seed a horizontal quick line ~20 CSS px above the canvas's bottom edge
    // (pdf-space = CSS px / zoom), then right-click its midpoint for real.
    const click = await page.evaluate(() => {
      const App = window.App, s = window.state;
      const rect = document.getElementById('annCanvas').getBoundingClientRect();
      const z = s.zoom;
      const pdfY = (rect.height - 20) / z;
      s.lineTypes.push({ id: 'lt-clamp', name: 'Clamp Line', color: '#e74c3c' });
      const c = App.ensureActiveCanvas(s.pages[0]);
      c.annotations.quickLines.push({ x1: 40 / z, y1: pdfY, x2: 160 / z, y2: pdfY, color: '#e74c3c', id: 'ql-clamp', lineTypeId: 'lt-clamp' });
      App.renderAnnotations();
      App.updateUI();
      return { x: rect.left + 100, y: rect.top + rect.height - 20 };
    });
    await page.mouse.click(click.x, click.y, { button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);

    const r = await menuRect(page, '#contextMenu');
    // Fully inside the viewport — the whole point. Without the clamp the menu
    // opened at the pointer and ran past the bottom edge.
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.bottom).toBeLessThanOrEqual(r.vh);
    expect(r.right).toBeLessThanOrEqual(r.vw);
    // And it was actually clamped (pulled up above the pointer), not just small.
    expect(r.top).toBeLessThan(click.y);

    // The menu still works: the target row shows the line's type name.
    expect(await page.locator('#ctxTargetNameRow').textContent()).toBe('Clamp Line');

    expect(errors).toEqual([]);
  });

  test('footer drop-up (Copy to /Tooling) opens with measured height inside the viewport', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const App = window.App, s = window.state;
      s.lineTypes.push({ id: 'lt1', name: 'Copper', color: '#4a9eff' });
      const c = App.ensureActiveCanvas(s.pages[0]);
      c.annotations.quickLines.push({ x1: 50, y1: 50, x2: 150, y2: 50, color: '#4a9eff', id: 'q1', lineTypeId: 'lt1' });
      App.updateUI();
    });
    await page.locator('#forPipeTooling').click();
    await expect(page.locator('#forPipeToolingMenu')).toHaveClass(/visible/);
    const r = await menuRect(page, '#forPipeToolingMenu');
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.bottom).toBeLessThanOrEqual(r.vh);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(r.vw);

    expect(errors).toEqual([]);
  });
});

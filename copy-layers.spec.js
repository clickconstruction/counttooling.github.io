// @ts-check
/**
 * Tests: DUCT unit D25 — X6 option D, layer-aware copy (journeys/plans/
 * _TODO.md D25; _STAGE6.md X6, Will: option D).
 *
 * "Every sheet (visible layers)" copied the ACTIVE layer per page and ignored
 * the show-all peek — J11's "11 on screen, 6 copied". The scopes are now This
 * sheet / Everything, plus a layer picker that appears only when a page in
 * scope has 2+ layers, pre-checked to what is on screen at copy time; the
 * paste header names the layers included, so the number is reproducible and
 * never silently depends on a view toggle.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const PDF = path.join(__dirname, 'test-2pages.pdf');
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function boot(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(PDF);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  // Page 1: Main (4 WC) + Gas (5 WC, not active). Page 2: Main only (2 WC).
  await page.evaluate(() => {
    const s = window.state;
    s.currentProjectName = 'Maple St TI';
    s.pages.forEach((p) => { p.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' }; });
    s.counters = [{ id: 'wc', name: 'Water Closet', icon: 'M0 0 H10 V10 H0 Z', color: '#e8c547' }];
    const mk = (n) => Array.from({ length: n }, (_, i) => ({ x: 50 + i * 20, y: 50, id: 'm' + Math.random() }));
    const p0 = s.pages[0];
    window.App.ensureActiveCanvas(p0).annotations.counterMarkers.wc = mk(4);
    p0.canvases.push({ id: 'gas', name: 'Gas', annotations: Object.assign(window.makeAnnotations(), { counterMarkers: { wc: mk(5) } }) });
    window.App.ensureActiveCanvas(s.pages[1]).annotations.counterMarkers.wc = mk(2);
    s.showAllCanvases = false;
    window.App.updateUI();
  });
}

const wcCount = (text) => { const m = /Water Closet\t(\d+)/.exec(text); return m ? Number(m[1]) : null; };
// The button TOGGLES its menu: open it only when it is closed.
const copyVia = async (page, optionSel) => {
  if (!(await page.evaluate(() => document.getElementById('forPipeToolingMenu').classList.contains('visible')))) await page.locator('#forPipeTooling').click();
  await page.locator(optionSel).click();
  await page.waitForFunction(() => document.getElementById('pipeToolingCopiedModal')?.classList.contains('visible') || (document.getElementById('toastRegion')?.textContent || '').includes('opied'));
  return page.evaluate(() => navigator.clipboard.readText());
};

test.describe('D25 — layer-aware copy (X6 option D)', () => {
  /** @type {string[]} */
  let errors;
  test.beforeEach(async ({ page }) => { errors = []; await boot(page, errors); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('the retired scope is gone; the picker lists the layers in scope and defaults to what is on screen', async ({ page }) => {
    await page.locator('#forPipeTooling').click();
    const opts = await page.evaluate(() => [...document.querySelectorAll('.pipe-tooling-option')].map((o) => o.dataset.mode));
    expect(opts).toEqual(['this-canvas', 'all']);
    const picker = page.locator('#pipeToolingLayerPicker');
    await expect(picker).toBeVisible();
    // Peek OFF: Main is on screen (and locked — the active layer always rides), Gas is not.
    expect(await page.evaluate(() => [...document.querySelectorAll('#pipeToolingLayerPicker input')].map((i) => ({ name: i.dataset.layerName, checked: i.checked, locked: i.disabled }))))
      .toEqual([{ name: 'Main', checked: true, locked: true }, { name: 'Gas', checked: false, locked: false }]);
  });

  test('the J11 moment cannot happen: with the peek on, the copy matches the screen and the header names the layers', async ({ page }) => {
    // Peek on: 9 WC on screen on page 1, 2 on page 2 → Everything copies 11.
    await page.evaluate(() => { window.state.showAllCanvases = true; window.App.renderAnnotations(); window.App.updateUI(); });
    const text = await copyVia(page, '.pipe-tooling-option[data-mode="all"]');
    expect(wcCount(text)).toBe(11);
    expect(text.split('\n')[0]).toBe('--- Counts, Maple St TI · every sheet · layers: Main, Gas ---');
  });

  test('peek off: Everything copies the active layers and says so; This sheet scopes the picker to this page', async ({ page }) => {
    const all = await copyVia(page, '.pipe-tooling-option[data-mode="all"]');
    expect(wcCount(all)).toBe(6);                                  // 4 + 2, Gas not on screen
    expect(all.split('\n')[0]).toBe('--- Counts, Maple St TI · every sheet · layers: Main ---');
    // This sheet, from page 2 (one layer): no picker, no layers clause.
    await page.evaluate(() => { window.state.currentPage = 1; window.App.updateUI(); });
    await page.locator('#forPipeTooling').click();
    await page.locator('.pipe-tooling-option[data-mode="this-canvas"]').hover();
    await expect(page.locator('#pipeToolingLayerPicker')).toBeHidden();
    const one = await copyVia(page, '.pipe-tooling-option[data-mode="this-canvas"]');
    expect(wcCount(one)).toBe(2);
    expect(one.split('\n')[0]).toBe('--- Counts, Maple St TI · this sheet ---');
  });

  test('ticking a layer in the picker includes it; the choice is explicit in the header', async ({ page }) => {
    await page.locator('#forPipeTooling').click();
    await page.locator('#pipeToolingLayerPicker input[data-layer-name="Gas"]').check();
    await expect(page.locator('#forPipeToolingMenu')).toHaveClass(/visible/);   // a tick does not close the menu
    await page.locator('.pipe-tooling-option[data-mode="all"]').click();
    await page.waitForFunction(() => document.getElementById('pipeToolingCopiedModal')?.classList.contains('visible') || (document.getElementById('toastRegion')?.textContent || '').includes('opied'));
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(wcCount(text)).toBe(11);
    expect(text.split('\n')[0]).toContain('layers: Main, Gas');
  });

  test('Copy Summary (Email/Text) carries the same scope line under its title', async ({ page }) => {
    await page.locator('#copySummaryText').click();
    await page.locator('.copy-summary-option[data-mode="all"]').click();
    await page.waitForFunction(() => (document.getElementById('toastRegion')?.textContent || '').includes('opied') || document.getElementById('pipeToolingCopiedModal')?.classList.contains('visible'));
    const text = await page.evaluate(() => navigator.clipboard.readText());
    const lines = text.split('\n');
    expect(lines[0]).toBe('Takeoff Summary');
    expect(lines[2]).toBe('Counts, Maple St TI · every sheet · layers: Main');
  });

  test('a copy with no scope (the bid-basis manifest path) carries no header — legacy pins hold', async ({ page }) => {
    const text = await page.evaluate(() => window.getPipeToolingSummary());
    expect(text.startsWith('---')).toBe(false);
    expect(text).not.toContain('Counts,');
  });

  test('single-layer projects: the picker never shows and the copy is unchanged apart from the scope line', async ({ page }) => {
    await page.evaluate(() => { window.state.pages[0].canvases = window.state.pages[0].canvases.slice(0, 1); window.App.updateUI(); });
    await page.locator('#forPipeTooling').click();
    await expect(page.locator('#pipeToolingLayerPicker')).toBeHidden();
    const text = await copyVia(page, '.pipe-tooling-option[data-mode="all"]');
    expect(wcCount(text)).toBe(6);
    expect(text.split('\n')[0]).toBe('--- Counts, Maple St TI · every sheet ---');
  });
});

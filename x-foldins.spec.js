// @ts-check
/**
 * Tests: the _STAGE6.md FOLD-IN rows swept alongside D19 (journeys/plans/
 * _STAGE6.md "The seventeen rows, bucketed" — X11, X12, X13).
 *
 * X11  A page with a SCALE but no marks joins Shift+←/→ marked-page nav — the
 *      pages list has badged it since B10, and skipping a sheet you just
 *      calibrated contradicts the badge. Import Canvas must NOT be disabled by
 *      a scale alone (projectHasAnyCanvasMarkup keeps its meaning).
 * X12  A blank line-type name numbers up instead of minting a second type
 *      called "Line"; "1 lines" / "1 counters" read as singular.
 * X13  The ↻ rotate button is disabled with no PDF instead of silently
 *      no-opping; the footer chip says "1 count".
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const PDF = path.join(__dirname, 'test-2pages.pdf');

async function boot(page, errors, withPdf = true) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  if (withPdf) {
    await page.locator('#pdfInput').setInputFiles(PDF);
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  }
}

test.describe('D19 fold-ins (X11 / X12 / X13)', () => {
  /** @type {string[]} */
  let errors;
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('X11: a scale-only page is a marked page for nav, but is not canvas markup', async ({ page }) => {
    errors = []; await boot(page, errors);
    // Nothing set: no marked pages at all.
    expect(await page.evaluate(() => window.App.getMarkedPageIndices())).toEqual([]);
    // Give page 2 a scale and nothing else.
    await page.evaluate(() => { window.state.pages[1].scale = { pixelsPerUnit: 12, unit: 'ft' }; window.App.updateUI(); });
    expect(await page.evaluate(() => window.App.getMarkedPageIndices())).toEqual([1]);
    // The pages list badges it — the behavior this aligns with.
    await expect(page.locator('#pagesList .sidebar-item').nth(1).locator('.badge-scale-set')).toHaveCount(1);
    // But a scale is page metadata, not markup: Import Canvas stays available,
    // because projectHasAnyCanvasMarkup must not be widened (B12).
    expect(await page.evaluate(() => window.App.projectHasAnyCanvasMarkup())).toBe(false);
    // A real mark still counts, and both pages then navigate.
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      window.state.counters = [{ id: 'c1', name: 'WC', icon: '', color: '#e8c547' }];
      ann.counterMarkers.c1 = [{ x: 10, y: 10, id: 'm1' }];
      window.App.updateUI();
    });
    expect(await page.evaluate(() => window.App.getMarkedPageIndices())).toEqual([0, 1]);
    expect(await page.evaluate(() => window.App.projectHasAnyCanvasMarkup())).toBe(true);
  });

  test('X12: a blank line-type name numbers up instead of minting a second "Line"', async ({ page }) => {
    errors = []; await boot(page, errors);
    const addBlank = () => page.evaluate(() => document.getElementById('addLineType').click());
    await addBlank();
    await page.waitForSelector('#lineTypeModal.visible', { timeout: 5000 });
    await page.locator('#lineTypeName').fill('');
    await page.locator('#lineTypeCreate').click();
    await addBlank();
    await page.waitForSelector('#lineTypeModal.visible', { timeout: 5000 });
    await page.locator('#lineTypeName').fill('');
    await page.locator('#lineTypeCreate').click();
    expect(await page.evaluate(() => window.state.lineTypes.map((lt) => lt.name))).toEqual(['Line', 'Line 2']);
  });

  test('X13: the rotate button is disabled until there is a page to rotate', async ({ page }) => {
    errors = []; await boot(page, errors, false);
    await expect(page.locator('#rotatePage')).toBeDisabled();
    await expect(page.locator('#rotatePage')).toHaveAttribute('title', /load a PDF first/);
    await page.locator('#pdfInput').setInputFiles(PDF);
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await expect(page.locator('#rotatePage')).toBeEnabled();
    await expect(page.locator('#rotatePage')).toHaveAttribute('title', 'Rotate 90° right');
  });

  test('X13: the footer chip says "1 count", not "1 counts"', async ({ page }) => {
    errors = []; await boot(page, errors);
    const chip = async () => {
      await page.evaluate(() => { window.App.invalidateFooterTotals(); window.App.updateUI(); });
      return page.locator('#statusTotals').textContent();
    };
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      window.state.counters = [{ id: 'c1', name: 'WC', icon: '', color: '#e8c547' }];
      ann.counterMarkers.c1 = [{ x: 10, y: 10, id: 'm1' }];
    });
    expect(await chip()).toContain('1 count');
    expect(await chip()).not.toContain('1 counts');
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      ann.counterMarkers.c1.push({ x: 20, y: 20, id: 'm2' });
    });
    expect(await chip()).toContain('2 counts');
  });
});

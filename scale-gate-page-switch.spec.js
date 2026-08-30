// @ts-check
/**
 * T1-05 Part 3: the Set-Scale gate re-fires on page switch. The arm-time gate
 * (tool buttons) only ran when a line tool was armed — an armed Quick Line
 * page-flipped onto an unscaled sheet kept placing px-measured lines. The
 * re-check lives in renderPdf (the sink for every page-nav entry point:
 * footer arrows, hotkeys, pages list, Lines-list jump, GoSet): switching onto
 * an unscaled page with a gated tool armed shows the existing "Set Scale
 * first" toast, drops the tool to Move, and clears in-flight starts —
 * switching between two SCALED pages leaves the armed tool alone.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Scale gate re-fires on page switch (T1-05)', () => {
  test('armed Quick Line disarms on an unscaled page; scaled-to-scaled keeps the tool', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Scale p1 only, create a line type, and arm Quick Line on p1.
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: 'p1' };
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      s.activeLineTypeId = 'lt1';
      s.tool = App.TOOL.LINE;
      App.updateUI();
    });

    // Flip to the unscaled p2 via the footer arrow: toast + disarm.
    await page.locator('#nextPage').click();
    await page.waitForSelector('#setScaleFirstModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('setScaleFirstText').textContent)).toContain('Quick Line');
    expect(await page.evaluate(() => window.state.tool)).toBe(0);   // TOOL.NONE
    expect(await page.evaluate(() => window.state.currentPage)).toBe(1);

    // Two canvas clicks place NO line on the unscaled page.
    const canvas = page.locator('#pdfCanvas');
    await canvas.click({ position: { x: 120, y: 120 }, force: true });
    await canvas.click({ position: { x: 220, y: 120 }, force: true });
    const p2Lines = await page.evaluate(() => {
      const s = window.state;
      const ann = window.App.getActiveAnnotations(s.pages[1], 1);
      return (ann?.quickLines || []).length;
    });
    expect(p2Lines).toBe(0);

    // Now scale p2 as well: flipping between two scaled pages with the tool
    // armed shows no toast and keeps the tool.
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.pages[1].scale = { pixelsPerUnit: 12, unit: 'ft', label: 'p2' };
      s.tool = App.TOOL.LINE;
      App.updateUI();
    });
    // Wait out any lingering toast timer, then flip back and forth.
    await page.waitForSelector('#setScaleFirstModal.visible', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.evaluate(() => window.App.hideModal('setScaleFirstModal'));
    await page.locator('#prevPage').click();
    expect(await page.evaluate(() => window.state.tool)).toBe(2);   // TOOL.LINE kept
    await page.locator('#nextPage').click();
    expect(await page.evaluate(() => window.state.tool)).toBe(2);
    expect(await page.evaluate(() => document.getElementById('setScaleFirstModal').classList.contains('visible'))).toBe(false);

    expect(errors).toEqual([]);
  });

  test('T2-06: the toast\'s Set Scale link opens the scale modal and clears the timer', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Scale p1 only and arm Quick Line, then flip onto the unscaled p2 —
    // the page-switch disarm toast appears.
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: 'p1' };
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      s.activeLineTypeId = 'lt1';
      s.tool = App.TOOL.LINE;
      App.updateUI();
    });
    await page.locator('#nextPage').click();
    await page.waitForSelector('#setScaleFirstModal.visible', { timeout: 5000 });

    // Click the in-toast Set Scale link: toast hides, scale modal opens.
    await page.locator('#setScaleFirstLink').click();
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => document.getElementById('setScaleFirstModal').classList.contains('visible'))).toBe(false);

    // The cleared 6s timer never fires: 7s later the modal is still open
    // (the old timer only hid the toast, but assert the modal anyway).
    await page.waitForTimeout(7000);
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => document.getElementById('setScaleFirstModal').classList.contains('visible'))).toBe(false);

    await page.evaluate(() => window.App.hideModal('scaleModal'));
    expect(errors).toEqual([]);
  });
});

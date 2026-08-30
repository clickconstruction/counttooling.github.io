// @ts-check
/**
 * Tests: the status-bar tool hint ("Tap start point" etc., features/status-bar.js)
 * only rides when the bar stays on ONE line. On narrow layouts the bar
 * flex-wraps; a long project name + hint used to shove the right-side actions
 * onto a second row (field feedback 2026-08-14). Guards both directions and
 * the wrap measurement's (text @ width) cache key across resizes.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function bootWithLineTool(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.currentProjectName = 'MF-P0002_PCT_IPRP-ChapterI Long Project Name For Wrap Test';
    s.lineTypes = [{ id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' }];
    s.activeLineTypeId = 'lt1';
    s.tool = window.App.TOOL.LINE;
    window.App.updateUI();
    window.App.updateStatus();
  });
}

test.describe('Status-bar tool hint (one-line-only)', () => {
  test('wide bar shows the hint; narrow bar drops it instead of wrapping the actions', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootWithLineTool(page);
    await expect(page.locator('#statusMode')).toContainText('Tap start point');

    // Desktop-width borderline case (the >768px regime is where the bar
    // wraps): the name + hint overflow the row, the name alone fits — so
    // dropping the hint is exactly what keeps the bar on one line.
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).not.toContainText('Tap start point');
    // The right-side actions stayed on the same row as the mode text.
    const sameRow = await page.evaluate(() => {
      const mode = document.getElementById('statusMode');
      const actions = document.getElementById('statusBarActions');
      return actions.offsetTop <= mode.offsetTop;
    });
    expect(sameRow).toBe(true);

    // Widening again brings the hint back (cache key includes the bar width).
    await page.setViewportSize({ width: 1600, height: 800 });
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).toContainText('Tap start point');
  });
});

test.describe('Distance chip (#statusMeasure, T2 #15)', () => {
  test('measure result rides the footer, outlives the old 5s toast, follows its sheet, and is replaced by a new measure', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1600, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.evaluate(() => {
      window.state.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
      document.getElementById('measureBtn').click();
    });
    const box = await page.locator('#canvasWrapper').boundingBox();
    const pts = await page.evaluate(() => {
      const p = window.state.pages[window.state.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const z = window.state.zoom, pan = window.state.pan;
      const y = (vp.height / 2) * z + pan.y;
      return [
        { x: vp.width * 0.25 * z + pan.x, y },
        { x: vp.width * 0.75 * z + pan.x, y },
        { x: vp.width * 0.25 * z + pan.x, y: y + 40 * z },
      ];
    });
    await page.mouse.click(box.x + pts[0].x, box.y + pts[0].y);
    await page.waitForTimeout(450); // measure's double-tap guard
    await page.mouse.click(box.x + pts[1].x, box.y + pts[1].y);

    // The result is a footer chip, not a toast.
    const chip = page.locator('#statusMeasure');
    await expect(chip).toBeVisible();
    const firstText = await chip.textContent();
    expect(firstText).toMatch(/^Distance: /);
    expect(await page.evaluate(() => document.getElementById('airboardToastModal').classList.contains('visible'))).toBe(false);
    expect(await page.evaluate(() => document.getElementById('airboardToastText').textContent)).not.toContain('Distance');

    // Still shown after 6s — it outlives the old 5s toast and stays while you work.
    await page.waitForTimeout(6000);
    await expect(chip).toBeVisible();
    expect(await chip.textContent()).toBe(firstText);

    // Page flip hides it (a fact about that sheet); flipping back shows it again.
    await page.locator('#nextPage').click();
    await page.waitForFunction(() => window.state.currentPage === 1, { timeout: 5000 });
    await expect(chip).toBeHidden();
    await page.locator('#prevPage').click();
    await page.waitForFunction(() => window.state.currentPage === 0, { timeout: 5000 });
    await expect(chip).toBeVisible();
    expect(await chip.textContent()).toBe(firstText);

    // A new measure replaces it.
    await page.evaluate(() => { document.getElementById('measureBtn').click(); });
    await page.waitForTimeout(450);
    await page.mouse.click(box.x + pts[0].x, box.y + pts[0].y);
    await page.waitForTimeout(450);
    await page.mouse.click(box.x + pts[2].x, box.y + pts[2].y);
    await expect(chip).toBeVisible();
    const secondText = await chip.textContent();
    expect(secondText).toMatch(/^Distance: /);
    expect(secondText).not.toBe(firstText);

    expect(errors).toEqual([]);
  });
});

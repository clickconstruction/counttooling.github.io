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

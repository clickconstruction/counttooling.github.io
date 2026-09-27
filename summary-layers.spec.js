// @ts-check
/**
 * MAP-SUMMARY-LAYERS (2026-09-27): on a sheet with several layers the Summary
 * counts EVERY layer, like the sidebar badges and the footer total, and the
 * by-page window shows how each sheet's number splits by layer.
 *
 * Pins: the Summary counter row, line-type row, child-count row and Fixture
 * units row sum every layer; the numbers do not move when the sheet's active
 * layer changes; the by-page window counts every layer, lists the split only
 * on a multi-layer sheet ("Main 2 · Alternate 1"), and hands the thumbnail
 * every layer's marks; no console errors.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Summary counts every layer (MAP-SUMMARY-LAYERS)', () => {
  test('Summary, badges and the by-page window agree on a multi-layer sheet', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Sheet 1: Main holds 2 WCs + a 12 ft run; Alternate holds 1 WC + a 6 ft run.
    // Sheet 2: one layer, 1 WC. Every layer everywhere = 4 WCs, 2 runs, 18 ft.
    await page.evaluate(() => {
      const s = window.state;
      const App = window.App;
      s.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
      s.counters.push({ id: 'c1', name: 'WC', icon: 'M0 0h10v10H0z', color: '#e8c547', wsfu: 2, childCounts: [{ name: 'Carrier bolt', qty: 2, per: 'count' }] });
      s.lineTypes.push({ id: 'lt1', name: 'Waste', color: '#47c88e', curveStyle: 'straight' });
      const main = App.ensureActiveCanvas(s.pages[0]);
      main.name = 'Main';
      main.annotations.counterMarkers.c1 = [{ x: 10, y: 10, id: 'm1' }, { x: 100, y: 100, id: 'm2' }];
      main.annotations.quickLines.push({ x1: 0, y1: 0, x2: 120, y2: 0, lineTypeId: 'lt1', color: '#47c88e', id: 'q1' });
      const alt = { id: 'cvAlt', name: 'Alternate', annotations: App.makeAnnotations() };
      alt.annotations.counterMarkers.c1 = [{ x: 200, y: 200, id: 'm3' }];
      alt.annotations.quickLines.push({ x1: 0, y1: 50, x2: 60, y2: 50, lineTypeId: 'lt1', color: '#47c88e', id: 'q2' });
      s.pages[0].canvases.push(alt);
      App.ensureActiveCanvas(s.pages[1]).annotations.counterMarkers.c1 = [{ x: 30, y: 30, id: 'm4' }];
      App.updateUI();
    });

    const badge = page.locator('#countersList .sidebar-item', { hasText: 'WC' }).locator('.badge');
    const summaryRow = page.locator('#summaryList .sidebar-item[data-type="counter"][data-id="c1"]');
    const summaryLine = page.locator('#summaryList .sidebar-item[data-type="lineType"][data-id="lt1"] .summary-line-meta');
    const expectEveryLayer = async () => {
      await expect(badge).toHaveText('4');
      await expect(summaryRow.locator('.badge')).toHaveText('[4]');
      await expect(summaryLine).toContainText('2 lines');
      await expect(summaryLine).toContainText('18.00 ft');
      // the child count and the fixture units follow the same rule (4 WCs)
      await expect(page.locator('#summaryList .summary-child-item', { hasText: 'Carrier bolt' }).locator('.child-total')).toHaveText('8');
      await expect(page.locator('#summaryWsfuRow .derived-total')).toHaveText('8 WSFU');
    };
    await expectEveryLayer();

    // The Summary no longer depends on which layer the sheet was left on.
    await page.evaluate(() => { window.state.activeCanvasIdByPage[0] = 'cvAlt'; window.App.updateUI(); });
    await expectEveryLayer();

    // By-page window: sheet 1 counts both layers and shows the split; sheet 2
    // (one layer) shows no split. The thumbnail is handed every layer's marks.
    await page.evaluate(() => {
      window.__thumbMarks = [];
      const orig = window.App.renderAnnotationsToContext;
      window.App.renderAnnotationsToContext = (ctx, pg, scale, ov, ann) => {
        window.__thumbMarks.push((ann?.counterMarkers?.c1 || []).length);
        return orig(ctx, pg, scale, ov, ann);
      };
    });
    await page.evaluate(() => window.App.openSummaryCountDetailModal('counter', 'c1'));
    await expect(page.locator('#summaryCountDetailModal')).toHaveClass(/visible/);
    const rows = page.locator('#summaryCountDetailList .summary-count-detail-row');
    await expect(rows).toHaveCount(2, { timeout: 15000 });
    await expect(rows.nth(0).locator('.summary-count-detail-count')).toHaveText('3');
    await expect(rows.nth(0).locator('.summary-count-detail-layers')).toHaveText('Main 2 · Alternate 1');
    await expect(rows.nth(1).locator('.summary-count-detail-count')).toHaveText('1');
    await expect(rows.nth(1).locator('.summary-count-detail-layers')).toHaveCount(0);
    await expect(page.locator('#summaryCountDetailList img')).toHaveCount(2, { timeout: 15000 });
    expect(await page.evaluate(() => window.__thumbMarks)).toEqual([3, 1]);
    await page.evaluate(() => window.App.hideModal('summaryCountDetailModal'));

    await page.evaluate(() => window.App.openSummaryCountDetailModal('lineType', 'lt1'));
    await expect(rows).toHaveCount(1, { timeout: 15000 });
    await expect(rows.nth(0).locator('.summary-count-detail-count')).toHaveText('2');
    await expect(rows.nth(0).locator('.summary-count-detail-length')).toHaveText('18.00 ft');
    await expect(rows.nth(0).locator('.summary-count-detail-layers')).toHaveText('Main 1 (12.00 ft) · Alternate 1 (6.00 ft)');
    await page.evaluate(() => window.App.hideModal('summaryCountDetailModal'));

    expect(errors).toEqual([]);
  });
});

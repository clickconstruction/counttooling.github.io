// @ts-check
/**
 * features/summary-detail.js (Tier-2 split): the Summary count-detail modal —
 * per-page breakdown of one counter or line type with rendered thumbnails.
 *
 * Pins: the registry contract (App.openSummaryCountDetailModal + the
 * published deps it consumes), the counter path (rows per page with
 * multiply-zone-adjusted counts + a thumbnail image), the line-type path
 * (runs + feet), the unknown-id no-op, and no console errors.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Summary count detail (features/summary-detail.js)', () => {
  test('registry contract, counter and line-type breakdowns', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const contract = await page.evaluate(() => ({
      open: typeof window.App.openSummaryCountDetailModal,
      mz: typeof window.App.getMultiplyZoneForPoint,
      feet: typeof window.App.getLineLengthFeetForTotals,
      fmt: typeof window.App.formatFeet,
    }));
    expect(contract.open).toBe('function');
    expect(contract.mz).toBe('function');
    expect(contract.feet).toBe('function');
    expect(contract.fmt).toBe('function');

    // Seed: a counter with two markers (one doubled by a multiply zone) and a line.
    await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
      s.counters.push({ id: 'c1', name: 'WC', icon: 'M0 0h10v10H0z', color: '#e8c547' });
      s.lineTypes.push({ id: 'lt1', name: 'Waste', color: '#47c88e', curveStyle: 'straight' });
      const canvas = window.App.ensureActiveCanvas(s.pages[0]);
      canvas.annotations.counterMarkers.c1 = [{ x: 10, y: 10, id: 'm1' }, { x: 100, y: 100, id: 'm2' }];
      canvas.annotations.multiplyZones.push({ x1: 0, y1: 0, x2: 50, y2: 50, multiplier: 2, id: 'z1' });
      canvas.annotations.quickLines.push({ x1: 0, y1: 0, x2: 120, y2: 0, lineTypeId: 'lt1', color: '#47c88e', id: 'q1' });
      window.App.updateUI();
    });

    // Counter path: 1 marker inside the x2 zone + 1 outside = 3 effective.
    await page.evaluate(() => window.App.openSummaryCountDetailModal('counter', 'c1'));
    await expect(page.locator('#summaryCountDetailModal')).toHaveClass(/visible/);
    await expect(page.locator('#summaryCountDetailTitle')).toContainText('WC — by page');
    await expect(page.locator('#summaryCountDetailList .summary-count-detail-count')).toHaveText('3');
    // Thumbnail renders (async pdf.js render into a data-URL img).
    await expect(page.locator('#summaryCountDetailList img')).toHaveCount(1, { timeout: 15000 });
    await page.evaluate(() => window.App.hideModal('summaryCountDetailModal'));

    // Line-type path: 1 run, 120pt @ 10pt/ft = 12.00 ft.
    await page.evaluate(() => window.App.openSummaryCountDetailModal('lineType', 'lt1'));
    await expect(page.locator('#summaryCountDetailTitle')).toContainText('Waste — by page');
    await expect(page.locator('#summaryCountDetailList .summary-count-detail-count')).toHaveText('1');
    await expect(page.locator('#summaryCountDetailList .summary-count-detail-length')).toHaveText('12.00 ft');
    await page.evaluate(() => window.App.hideModal('summaryCountDetailModal'));

    // Unknown id: safe no-op, modal stays closed.
    await page.evaluate(() => window.App.openSummaryCountDetailModal('counter', 'nope'));
    await expect(page.locator('#summaryCountDetailModal')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });
});

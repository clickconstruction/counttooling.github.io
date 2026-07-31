// @ts-check
/**
 * Scale Zone tool: a rectangular region of the page with its OWN scale — a
 * line whose endpoints both sit inside the zone measures with the zone's
 * scale instead of the page scale (detail plans / blown-up regions on the
 * same sheet). Zones affect measurement math (the thing estimates bill
 * from), so this pins:
 *  - tool activation (requires a page scale first — toast otherwise),
 *  - getScaleZoneForLine's inside/partial/outside endpoint rules,
 *  - getEffectiveScaleForLine + getLineLengthFeetForTotals using the zone
 *    scale for quick lines and polylines,
 *  - zones never stacking with the page scale for lines that straddle the
 *    boundary (partial containment = page scale).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function bootWithPdf(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

test.describe('Scale Zone tool', () => {
  test('buttons attached; activation gated on a page scale; sets TOOL.SCALE_ZONE once scaled', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    await expect(page.locator('#scaleZoneBtn')).toBeAttached();
    await expect(page.locator('#scaleZoneBtnSidebar')).toBeAttached();

    // No page scale yet: activation refuses with the set-scale-first toast.
    const before = await page.evaluate(() => {
      document.getElementById('scaleZoneBtn').click();
      return {
        tool: window.App.state.tool,
        toastVisible: document.getElementById('setScaleFirstModal')?.classList.contains('visible'),
        toastText: document.getElementById('setScaleFirstText')?.textContent || '',
      };
    });
    expect(before.tool).toBe(await page.evaluate(() => window.App.TOOL.NONE));
    expect(before.toastVisible).toBe(true);
    expect(before.toastText).toContain('Scale Zone');

    // With a scale: the tool arms.
    const after = await page.evaluate(() => {
      window.App.state.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
      document.getElementById('scaleZoneBtn').click();
      return window.App.state.tool === window.App.TOOL.SCALE_ZONE;
    });
    expect(after).toBe(true);
    expect(errors).toEqual([]);
  });

  test('zone containment rules + zone-scoped measurement math (quick line and polyline)', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    const result = await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };   // page: 10 px/ft
      s.lineTypes.push({ id: 'lt1', name: 'Waste', color: '#47c88e', curveStyle: 'straight' });
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      // Zone [0..200]^2 at 20 px/ft (a half-scale detail region).
      ann.scaleZones.push({ x1: 0, y1: 0, x2: 200, y2: 200, scale: { pixelsPerUnit: 20, unit: 'ft', label: 'detail' }, id: 'sz1' });
      const inside = { x1: 10, y1: 10, x2: 130, y2: 10, lineTypeId: 'lt1', color: '#47c88e', id: 'q-in' };      // 120pt
      const outside = { x1: 300, y1: 300, x2: 420, y2: 300, lineTypeId: 'lt1', color: '#47c88e', id: 'q-out' }; // 120pt
      const straddle = { x1: 100, y1: 100, x2: 400, y2: 100, lineTypeId: 'lt1', color: '#47c88e', id: 'q-mid' };// 300pt, one end out
      ann.quickLines.push(inside, outside, straddle);
      const polyInside = { points: [{ x: 10, y: 50 }, { x: 70, y: 50 }, { x: 70, y: 110 }], closed: false, lineTypeId: 'lt1', color: '#47c88e', id: 'p-in' }; // 120pt total
      ann.polylines.push(polyInside);
      window.App.updateUI();
      const w = /** @type {any} */ (window);
      return {
        zoneForInside: !!w.getScaleZoneForLine(ann, inside, false),
        zoneForOutside: !!w.getScaleZoneForLine(ann, outside, false),
        zoneForStraddle: !!w.getScaleZoneForLine(ann, straddle, false),
        zoneForPoly: !!w.getScaleZoneForLine(ann, polyInside, true),
        effInside: w.getEffectiveScaleForLine(ann, inside, false, 0).pixelsPerUnit,
        effOutside: w.getEffectiveScaleForLine(ann, outside, false, 0).pixelsPerUnit,
        // Lengths in feet: inside 120/20 = 6; outside 120/10 = 12;
        // straddle 300/10 = 30 (partial containment = page scale);
        // polyline 120/20 = 6.
        ftInside: w.getLineLengthFeetForTotals(inside, 0, false, ann),
        ftOutside: w.getLineLengthFeetForTotals(outside, 0, false, ann),
        ftStraddle: w.getLineLengthFeetForTotals(straddle, 0, false, ann),
        ftPoly: w.getLineLengthFeetForTotals(polyInside, 0, true, ann),
      };
    });
    expect(result.zoneForInside).toBe(true);
    expect(result.zoneForOutside).toBe(false);
    expect(result.zoneForStraddle).toBe(false);
    expect(result.zoneForPoly).toBe(true);
    expect(result.effInside).toBe(20);
    expect(result.effOutside).toBe(10);
    expect(result.ftInside).toBeCloseTo(6, 5);
    expect(result.ftOutside).toBeCloseTo(12, 5);
    expect(result.ftStraddle).toBeCloseTo(30, 5);
    expect(result.ftPoly).toBeCloseTo(6, 5);
    expect(errors).toEqual([]);
  });
});

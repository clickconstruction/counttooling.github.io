// @ts-check
/**
 * The S moment for water (WATER-PLAN.md rung 4, features/water-size.js).
 * Guards: while a polyline of a water-sided type is traced, the card reads the
 * fixture units still to serve beyond the tip (a flush valve picks the valve
 * column) and the smallest size of the type's material under the side's cap,
 * naming the run's own size as over; S opens the popover with the suggested
 * chip and the material's ladder, Escape closes it without costing a vertex;
 * taking a size commits the run so far and starts a new draft from the last
 * point in a line type of that size (found or made: the name with its size
 * swapped, the side carried, the hanger row re-read for the new size, a
 * palette color no type uses); a size the draft already has is a no-op; once
 * the trace has passed every fixture the card goes.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function load(page) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft' }; });
}
async function screenPointForPdf(page, pdf) {
  return page.evaluate((p) => {
    const c = document.getElementById('annCanvas');
    const rect = c.getBoundingClientRect();
    const bc = window.App.toCanvas(p);
    return { x: rect.left + bc.x * (rect.width / c.width), y: rect.top + bc.y * (rect.height / c.height) };
  }, pdf);
}

test.describe('The S moment for water (rung 4)', () => {
  test('the card, the popover, Escape, a new run from here, and the card going quiet', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'lt-cold', name: '3/4in PEX cold', color: '#4a9eff', curveStyle: 'straight', waterSide: 'cold', childCounts: [{ name: 'Hanger', qty: 1, per: 'ft', intervalIn: 32, ruleId: 'plumb.hanger.pex' }, { name: 'Tee', qty: 1, per: 'run' }] });
      s.counters.push({ id: 'c-lav', name: 'Lavatory', icon: 'M0 0h10v10H0z', color: '#47c88e', wsfu: 2 });
      s.counters.push({ id: 'c-wc', name: 'WC flush valve', icon: 'M0 0h10v10H0z', color: '#a47fff', wsfu: 10 });
      const ann = s.pages[0].canvases[0].annotations;
      ann.counterMarkers['c-lav'] = [{ x: 150, y: 210 }, { x: 200, y: 210 }, { x: 250, y: 210 }];
      ann.counterMarkers['c-wc'] = [{ x: 350, y: 205 }];
      s.activeLineTypeId = 'lt-cold';
      s.tool = window.App.TOOL.POLYLINE;
      s.drawingPolyline = { id: 'draft-1', name: 'Cold main', color: '#4a9eff', points: [{ x: 100, y: 200 }, { x: 300, y: 200 }], closed: false, lineTypeId: 'lt-cold', group: null };
      window.App.updateUI();
      window.App.renderAnnotations();
    });
    // the three lavatories are behind the tip (served); the flush-valve WC is the pool ahead: 10 WSFU at valves = 27 gpm,
    // 3/4 in PEX runs 24.5 fps, the first size under 8 fps cold is 1-1/2 in
    const sug = await page.evaluate(() => { const s = window.App.getWaterDraftSuggestion(); return { wsfu: s.wsfu, served: s.served, column: s.column, gpm: s.gpm, sizeIn: s.sizeIn, over: s.over, currentSizeIn: s.currentSizeIn, material: s.material, chipText: s.chipText }; });
    expect(sug).toEqual({ wsfu: 10, served: 4.5, column: 'flush-valve', gpm: 27, sizeIn: 1.5, over: true, currentSizeIn: 0.75, material: 'pex', chipText: '1-1/2″ suggested · 10 WSFU downstream · 7.1 fps · 3/4″ runs 24.5 ⚠. S accepts' });
    const card = page.locator('#waterHintCard');
    await expect(card).toBeVisible();
    await expect(card).toContainText('1-1/2″ suggested');
    await expect(card.locator('kbd')).toHaveText('S');
    // S opens the popover; Escape closes it without costing a vertex
    await page.keyboard.press('s');
    await expect(page.locator('#waterSizePopover')).toBeVisible();
    await expect(page.locator('#waterSizeCurrent')).toHaveText('3/4in PEX cold · Cold');
    await expect(page.locator('.water-suggest-chip')).toHaveText('1-1/2″ pex');
    expect(await page.locator('.water-size-step').count()).toBe(7);
    await expect(page.locator('.water-size-step.current .water-size-step-size')).toHaveText('3/4″');
    await expect(page.locator('.water-size-step.ok').first().locator('.water-size-step-size')).toHaveText('1-1/2″');
    await page.keyboard.press('Escape');
    await expect(page.locator('#waterSizePopover')).toBeHidden();
    expect(await page.evaluate(() => window.state.drawingPolyline.points.length)).toBe(2);
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.POLYLINE)).toBe(true);
    // taking the suggestion: the run so far is committed, a sized type is made, the next draft starts from the last point
    await page.keyboard.press('s');
    await page.locator('.water-suggest-chip').click();
    await expect(page.locator('#waterSizePopover')).toBeHidden();
    const after = await page.evaluate(() => {
      const s = window.state;
      const ann = s.pages[0].canvases[0].annotations;
      const lt = s.lineTypes[s.lineTypes.length - 1];
      return { polylines: ann.polylines.map((p) => [p.lineTypeId, p.points]), draft: { points: s.drawingPolyline.points, lineTypeId: s.drawingPolyline.lineTypeId }, lt: { name: lt.name, waterSide: lt.waterSide, color: lt.color, childCounts: lt.childCounts, curveStyle: lt.curveStyle }, active: s.activeLineTypeId, tool: s.tool === window.App.TOOL.POLYLINE, types: s.lineTypes.length };
    });
    expect(after.polylines).toEqual([['lt-cold', [{ x: 100, y: 200 }, { x: 300, y: 200 }]]]);
    expect(after.draft.points).toEqual([{ x: 300, y: 200 }]);
    expect(after.lt.name).toBe('1-1/2in PEX cold');
    expect(after.lt.waterSide).toBe('cold');
    expect(after.lt.color).not.toBe('#4a9eff');
    expect(after.lt.curveStyle).toBe('straight');
    // the hanger row is re-read for the new size (PEX over 1 in: 48 in); the other child row rides as it is
    expect(after.lt.childCounts).toEqual([{ name: 'Tee', qty: 1, per: 'run' }, { name: 'Hanger', qty: 1, per: 'ft', intervalIn: 48, ruleId: 'plumb.hanger.pex' }]);
    expect(after.draft.lineTypeId).toBe(after.active);
    expect(after.tool).toBe(true);
    expect(after.types).toBe(2);
    await expect(page.locator('#airboardToastText')).toContainText('1-1/2in PEX cold (new line type) from here.');
    // the same size again is a no-op
    await page.evaluate(() => window.App.applyWaterSize(1.5));
    expect(await page.evaluate(() => window.state.lineTypes.length)).toBe(2);
    expect(await page.evaluate(() => window.state.drawingPolyline.points.length)).toBe(1);
    // the sized type is reused, not made twice: step back to 3/4 finds the original
    expect(await page.evaluate(() => { const r = window.App.lineTypeForWaterSize(window.state.lineTypes[1], 0.75); return [r.lt.id, r.created]; })).toEqual(['lt-cold', false]);
    // the trace goes past the WC: it attaches behind the tip, nothing is left to serve, the card goes
    const next = await screenPointForPdf(page, { x: 420, y: 200 });
    await page.mouse.click(next.x, next.y);
    expect(await page.evaluate(() => window.state.drawingPolyline.points.length)).toBe(2);
    expect(await page.evaluate(() => window.App.getWaterDraftSuggestion())).toBe(null);
    await expect(card).toBeHidden();
    // S with nothing to size says so instead of opening Set Scale
    await page.keyboard.press('s');
    await expect(page.locator('#waterSizePopover')).toBeHidden();
    await expect(page.locator('#scaleModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#airboardToastText')).toContainText('No fixtures in reach yet');
    expect(errors).toEqual([]);
  });

  test('a plain polyline is untouched: no card, S is still Set Scale', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'lt-waste', name: '3in PVC waste', color: '#888', curveStyle: 'straight' });
      s.counters.push({ id: 'c-lav', name: 'Lavatory', icon: 'M0 0h10v10H0z', color: '#47c88e', wsfu: 2 });
      s.pages[0].canvases[0].annotations.counterMarkers['c-lav'] = [{ x: 150, y: 210 }];
      s.activeLineTypeId = 'lt-waste';
      s.tool = window.App.TOOL.POLYLINE;
      s.drawingPolyline = { id: 'draft-2', name: 'Waste', color: '#888', points: [{ x: 100, y: 200 }], closed: false, lineTypeId: 'lt-waste', group: null };
      window.App.updateUI();
      window.App.renderAnnotations();
    });
    expect(await page.evaluate(() => window.App.isWaterDrawing())).toBe(false);
    await expect(page.locator('#waterHintCard')).toBeHidden();
    await page.keyboard.press('s');
    await expect(page.locator('#waterSizePopover')).toBeHidden();
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
  });
});

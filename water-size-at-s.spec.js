// @ts-check
/**
 * The moment at S (WATER-PLAN.md rung 4, features/water-fixtures.js). Guards:
 * while a polyline is traced on a water type the card above the footer reads
 * what the trace still has to serve, the flow and the size under the cap, and
 * it changes as placed vertices pass fixtures; S opens the popover with the
 * suggestion first and every size of the material with its velocity; a tap
 * ends the run at its last point and starts the next one there in the sized
 * type (an existing type of that name is reused, a new one made in the traced
 * type's color), so the two share the point and the new run is the old one's
 * branch; a one-point draft just changes type; Escape closes the popover and
 * leaves the draft alone; S on plain pipe still opens Set Scale; the Lines
 * list's readout carries the flow and the velocity, ⚠ over the cap.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function load(page) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => window.App.rulesReady());
  await page.evaluate(() => {
    const s = window.state;
    window.App.setProjectTrade('plumbing', { route: 'settings' });
    localStorage.removeItem('codesDefault'); s.codes = null;
    s.pages[s.currentPage].scale = { pixelsPerUnit: 9, unit: 'ft' };
    const icon = window.App.getOrderedIcons()[0].value;
    s.lineTypes.push({ id: 'cw', name: '1.5in Copper CW', color: '#2e86de', curveStyle: 'straight' });
    s.lineTypes.push({ id: 'pvc', name: '3in PVC', color: '#47c88e', curveStyle: 'straight' });
    s.counters.push({ id: 'wc', name: 'WC-1 Water Closet', icon, color: '#e8c547', wsfu: 10, wsfuFixture: 'water-closet-valve' });
    s.counters.push({ id: 'lav', name: 'L-1 Lavatory', icon, color: '#4a9eff', wsfu: 2, wsfuFixture: 'lavatory' });
    const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
    // along y = 100: a water closet at x 150, two lavatories at 250 and 350
    ann.counterMarkers.wc = [{ x: 150, y: 110 }];
    ann.counterMarkers.lav = [{ x: 250, y: 110 }, { x: 350, y: 110 }];
    window.App.renderAnnotations(); window.App.updateUI();
  });
}
// A draft on the given type with the given placed points, the way the tool leaves it.
const draft = (page, lineTypeId, points) => page.evaluate(([lt, pts]) => {
  const s = window.state; const t = s.lineTypes.find((l) => l.id === lt);
  s.activeLineTypeId = lt;
  s.drawingPolyline = { id: window.App.uid(), name: 'Trace', color: t.color, points: pts, closed: false, lineTypeId: lt, group: null };
  s.tool = window.App.TOOL.POLYLINE;
  window.App.updateUI(); window.App.renderAnnotations();
}, [lineTypeId, points]);
const card = (page) => page.evaluate(() => { const el = document.getElementById('waterHintCard'); return el.hidden ? null : el.textContent; });

test.describe('The moment at S (WATER rung 4)', () => {
  test('the card follows the trace, S opens the popover, a tap starts a new run from here in the sized type', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    // one point placed: everything cold and unserved is ahead: 10 + 1.5 + 1.5 = 13 WSFU on the valve curve → 29.4 gpm → 1-1/4 in copper cold at 7.5 ft/s, under the cap of 8
    await draft(page, 'cw', [{ x: 50, y: 100 }]);
    let text = await card(page);
    expect(text).toContain('1-1/4 in suggested');
    expect(text).toContain('13 WSFU still to serve');
    expect(text).toContain('S accepts');
    const sug = await page.evaluate(() => { const s = window.App.waterDraftSuggestion(); return { gpm: s.gpm, key: s.key, column: s.column, v: s.velocityFps, currentKey: s.currentKey }; });
    expect(sug).toEqual({ gpm: 29.4, key: '1-1/4', column: 'flushValve', v: 7.5, currentKey: '1-1/2' });
    // past the water closet: 3 WSFU on the tank curve → 6.5 gpm → 1/2 in copper is 11 ft/s, 3/4 in 4.3 → 3/4 in
    await draft(page, 'cw', [{ x: 50, y: 100 }, { x: 200, y: 100 }]);
    text = await card(page);
    expect(text).toContain('3/4 in suggested');
    expect(text).toContain('3 WSFU still to serve');
    // S opens the popover: the suggestion first, the current size marked, over-cap sizes muted
    await page.keyboard.press('s');
    await expect(page.locator('#waterSizePopover')).toBeVisible();
    expect(await page.locator('#waterSizeCurrent').textContent()).toBe('1.5in Copper CW');
    expect(await page.locator('#waterSizeSuggested').textContent()).toBe('3/4 in');
    expect((await page.locator('#waterSizeSections').textContent()) || '').toContain('6.5 gpm on the flush-tank curve');
    expect(await page.locator('#waterSizePopover .water-size-chip-current').getAttribute('data-size')).toBe('1-1/2');
    expect(await page.locator('#waterSizePopover .water-size-chip-over').count()).toBeGreaterThan(0);
    expect(await page.locator('#waterSizePopover .water-size-chip[data-size="1/2"]').getAttribute('class')).toContain('water-size-chip-over');
    // Escape closes the popover and leaves the draft's two points alone
    await page.keyboard.press('Escape');
    await expect(page.locator('#waterSizePopover')).toBeHidden();
    expect(await page.evaluate(() => window.state.drawingPolyline.points.length)).toBe(2);
    // S again, take the suggestion: the run so far is committed, the next starts at (200,100) in 0.75in Copper CW, a new type in the same color
    await page.keyboard.press('s');
    await page.click('#waterSizeSuggested');
    await expect(page.locator('#waterSizePopover')).toBeHidden();
    const after = await page.evaluate(() => {
      const s = window.state; const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      const committed = ann.polylines.map((p) => ({ lt: p.lineTypeId, pts: p.points }));
      const d = s.drawingPolyline;
      const lt = s.lineTypes.find((l) => l.id === d.lineTypeId);
      return { committed, draft: { pts: d.points, ltName: lt.name, color: lt.color, side: window.WaterModel.lineTypeWaterSide(lt), hasKey: 'waterSide' in lt }, active: s.activeLineTypeId === lt.id, tool: s.tool === window.App.TOOL.POLYLINE };
    });
    expect(after.committed).toEqual([{ lt: 'cw', pts: [{ x: 50, y: 100 }, { x: 200, y: 100 }] }]);
    expect(after.draft.pts).toEqual([{ x: 200, y: 100 }]);
    expect(after.draft.ltName).toBe('0.75in Copper CW');
    expect(after.draft.color).toBe('#2e86de');
    expect(after.draft.side).toBe('cold');
    expect(after.draft.hasKey).toBe(false);   // the name says CW; no key needed
    expect(after.active).toBe(true); expect(after.tool).toBe(true);
    // the card on the new draft: the committed run's water closet is served by a committed run now; the lavs remain
    text = await card(page);
    expect(text).toContain('3 WSFU still to serve');
    // trace on past the lavs and finish: the new run is the old one's branch and the Lines list reads flow and velocity per run
    await draft(page, (await page.evaluate(() => window.state.drawingPolyline.lineTypeId)), [{ x: 200, y: 100 }, { x: 400, y: 100 }]);
    await page.evaluate(() => window.App.finishPolyline(false));
    const r = await page.evaluate(() => { const m = window.App.waterRunReadouts(window.state.currentPage); const o = []; m.forEach((v) => o.push(v.text)); return o.sort(); });
    expect(r).toEqual(['13 WSFU cold · 3 fixtures (2 on branches) · 29.4 gpm · 5.3 ft/s ✓', '3 WSFU cold · 2 fixtures · 6.5 gpm · 4.3 ft/s ✓']);
    // taking the same size does nothing but close; a one-point draft just changes type; an existing sized type is reused
    await draft(page, 'cw', [{ x: 50, y: 300 }]);
    await page.evaluate(() => window.App.applyWaterSize(1.5));
    expect(await page.evaluate(() => window.state.drawingPolyline.lineTypeId)).toBe('cw');
    const typesBefore = await page.evaluate(() => window.state.lineTypes.length);
    await page.evaluate(() => window.App.applyWaterSize(0.75));
    expect(await page.evaluate(() => window.state.lineTypes.length)).toBe(typesBefore);   // 0.75in Copper CW exists already
    expect(await page.evaluate(() => { const s = window.state; return { n: s.drawingPolyline.points.length, name: s.lineTypes.find((l) => l.id === s.drawingPolyline.lineTypeId).name }; })).toEqual({ n: 1, name: '0.75in Copper CW' });
    // the card goes with the draft
    await page.evaluate(() => { window.state.drawingPolyline = null; window.state.tool = window.App.TOOL.NONE; window.App.updateUI(); });
    expect(await card(page)).toBe(null);
    expect(errors).toEqual([]);
  });

  test('plain pipe: no card, and S is still Set Scale; a bore over the cap reads ⚠ in the Lines list', async ({ page }) => {
    await load(page);
    await draft(page, 'pvc', [{ x: 50, y: 100 }, { x: 200, y: 100 }]);
    expect(await card(page)).toBe(null);
    await page.keyboard.press('s');
    await expect(page.locator('#waterSizePopover')).toBeHidden();
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    await page.evaluate(() => { window.App.hideModal('scaleModal'); window.state.drawingPolyline = null; window.state.tool = window.App.TOOL.NONE; window.App.updateUI(); });
    // a 1/2 in cold main carrying the water closet and both lavs: 29.4 gpm in 1/2 in copper is 40 ft/s
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'small', name: '1/2in Copper CW', color: '#2e86de', curveStyle: 'straight' });
      const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      ann.polylines = ann.polylines || [];
      ann.polylines.push({ id: 'smallrun', name: 'Small', points: [{ x: 50, y: 100 }, { x: 400, y: 100 }], closed: false, color: '#2e86de', lineTypeId: 'small', group: null });
      window.App.updateUI();
    });
    const r = await page.evaluate(() => window.App.waterRunReadouts(window.state.currentPage).get('smallrun'));
    expect(r.gpm).toBe(29.4); expect(r.ok).toBe(false);
    expect(r.text).toContain('⚠ over 8');
    await page.evaluate(() => { window.state.linesTypeExpanded = { small: true }; window.App.renderLinesList(); });
    expect((await page.locator('#linesList').textContent()) || '').toContain('⚠ over 8');
  });
});

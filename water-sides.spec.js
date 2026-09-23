// @ts-check
/**
 * Water side on line types, attachment and the served readout (WATER-PLAN.md
 * rung 3, features/water-fixtures.js). Guards: a line type's side reads off its
 * name (CW / HW) and the sidebar row wears the tag; the Quick Line tab's picker
 * follows the composed name and a pick that differs is stored; the details
 * modal's picker sets, clears and defers to the name; fixtures attach per side
 * to the nearest run of that side within reach and the Lines list reads what
 * each run serves, branches included; a stray side's rescue on the context menu
 * stores the link on the mark without moving it and the leader follows; the
 * leaders the draw core paints come from the same rule; a line type with no
 * side is plain pipe.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function load(page) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => window.App.rulesReady());
  await page.evaluate(() => { window.App.setProjectTrade('plumbing', { route: 'settings' }); localStorage.removeItem('codesDefault'); window.state.codes = null; const s = window.state; s.pages[s.currentPage].scale = { pixelsPerUnit: 9, unit: 'ft' }; });
}
// P-101 in miniature: a cold main and a hot main along the top wall, a cold
// branch off the main to a second lavatory, three fixtures.
async function lay(page) {
  await page.evaluate(() => {
    const s = window.state;
    const icon = window.App.getOrderedIcons()[0].value;
    s.lineTypes.push({ id: 'cw', name: '1.5in Copper CW', color: '#2e86de', curveStyle: 'straight' });
    s.lineTypes.push({ id: 'hw', name: '1.25in Copper HW', color: '#e85447', curveStyle: 'straight' });
    s.lineTypes.push({ id: 'pvc', name: '3in PVC', color: '#47c88e', curveStyle: 'straight' });
    s.counters.push({ id: 'lav', name: 'L-1 Lavatory', icon, color: '#4a9eff', wsfu: 2, wsfuFixture: 'lavatory' });
    s.counters.push({ id: 'wc', name: 'WC-1 Water Closet', icon, color: '#e85447', wsfu: 10, wsfuFixture: 'water-closet-valve' });
    const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
    ann.quickLines = ann.quickLines || []; ann.polylines = ann.polylines || [];
    ann.quickLines.push({ id: 'cmain', x1: 100, y1: 100, x2: 400, y2: 100, color: '#2e86de', lineTypeId: 'cw', group: null });
    ann.quickLines.push({ id: 'hmain', x1: 100, y1: 130, x2: 400, y2: 130, color: '#e85447', lineTypeId: 'hw', group: null });
    ann.quickLines.push({ id: 'waste', x1: 100, y1: 400, x2: 400, y2: 400, color: '#47c88e', lineTypeId: 'pvc', group: null });
    ann.polylines.push({ id: 'cbranch', name: 'Lav branch', points: [{ x: 250, y: 102 }, { x: 250, y: 220 }, { x: 320, y: 220 }], closed: false, color: '#2e86de', lineTypeId: 'cw', group: null });
    ann.counterMarkers.lav = [{ x: 180, y: 115 }, { x: 330, y: 215 }];   // the first between both mains; the second on the branch's end, far from any hot run
    ann.counterMarkers.wc = [{ x: 350, y: 110 }];                        // cold only, on the main
    window.App.renderAnnotations();
    window.App.updateUI();
  });
}
const readouts = (page) => page.evaluate(() => { const m = window.App.waterRunReadouts(window.state.currentPage); const o = {}; m.forEach((v, k) => { o[k] = v.text; }); return o; });

test.describe('Water side, attachment and the served readout (WATER rung 3)', () => {
  test('sides from names, the tags, attachment per side, the served walk, the leaders, plain pipe', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    await lay(page);
    // the tags on the line type rows
    expect(await page.locator('#lineTypesList .sidebar-item[data-line-type-id="cw"] .line-water-tag-cold').count()).toBe(1);
    expect(await page.locator('#lineTypesList .sidebar-item[data-line-type-id="hw"] .line-water-tag-hot').count()).toBe(1);
    expect(await page.locator('#lineTypesList .sidebar-item[data-line-type-id="pvc"] .line-water-tag').count()).toBe(0);
    // what each run serves: the main carries lav1's cold (1.5) + the WC (10) + the branch's lav2 cold (1.5)
    let r = await readouts(page);
    // (rung 4 appends the flow and the velocity; water-size-at-s.spec.js pins those words)
    expect(r.cmain).toMatch(/^13 WSFU cold · 3 fixtures \(1 on branches\) · 29\.4 gpm · /);
    expect(r.cbranch).toMatch(/^1\.5 WSFU cold · 1 fixture · /);
    expect(r.hmain).toMatch(/^1\.5 WSFU hot · 1 fixture · /);
    expect(r.waste).toBeUndefined();
    // the Lines list shows it under each run
    await page.evaluate(() => { window.state.linesTypeExpanded = { cw: true, hw: true, pvc: true }; window.App.renderLinesList(); });
    const linesText = (await page.locator('#linesList').textContent()) || '';
    expect(linesText).toContain('13 WSFU cold · 3 fixtures (1 on branches)');
    expect(linesText).toContain('1.5 WSFU hot · 1 fixture');
    // the leaders the draw core paints: lav1 cold + hot, wc cold, lav2 cold = 4, in the run's color
    const leaders = await page.evaluate(() => window.App.waterLeaders(window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]), window.state.currentPage));
    expect(leaders.length).toBe(4);
    expect(leaders.filter((l) => l.side === 'hot').length).toBe(1);
    expect(leaders.find((l) => l.side === 'hot').color).toBe('#e85447');
    expect(leaders.find((l) => l.side === 'hot').to).toEqual({ x: 180, y: 130 });
    // plain pipe: strip the side from the name and nothing attaches to it
    await page.evaluate(() => { window.state.lineTypes.find((l) => l.id === 'cw').waterSide = 'none'; window.App.updateUI(); });
    r = await readouts(page);
    expect(r.cmain).toBeUndefined();
    expect(r.hmain).toMatch(/^1\.5 WSFU hot · 1 fixture · /);
    await page.evaluate(() => { delete window.state.lineTypes.find((l) => l.id === 'cw').waterSide; window.App.updateUI(); });
    expect(errors).toEqual([]);
  });

  test('the rescue stores the link on the mark, the leader follows, and a cleared side lets go', async ({ page }) => {
    await load(page);
    await lay(page);
    // lav2's hot side is a stray: the hot main is 85 pt away, past the snap, inside the reach
    await page.evaluate(() => { window.state.ctxTarget = { type: 'marker', typeId: 'lav', index: 1 }; window.App.showContextMenu(20, 20); });
    expect(await page.evaluate(() => document.getElementById('ctxAttachWater').style.display)).toBe('block');
    expect(await page.locator('#ctxAttachWater').textContent()).toBe('Attach to nearest hot run');
    await page.click('#ctxAttachWater');
    const mark = await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]).counterMarkers.lav[1]);
    expect(mark.waterRuns).toEqual({ hot: 'hmain' });
    expect(mark.x).toBe(330); expect(mark.y).toBe(215);   // the fixture stays on its symbol
    let r = await readouts(page);
    expect(r.hmain).toMatch(/^3 WSFU hot · 2 fixtures · /);
    const leaders = await page.evaluate(() => window.App.waterLeaders(window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]), window.state.currentPage));
    const linked = leaders.find((l) => l.side === 'hot' && l.from.x === 330);
    expect(linked).toBeTruthy();
    expect(linked.to).toEqual({ x: 330, y: 130 });
    expect(linked.explicit).toBe(true);
    // served now, so the row is gone; the WC (cold only, on the main) never had one
    await page.evaluate(() => { window.state.ctxTarget = { type: 'marker', typeId: 'lav', index: 1 }; window.App.showContextMenu(20, 20); });
    expect(await page.evaluate(() => document.getElementById('ctxAttachWater').style.display)).toBe('none');
    await page.evaluate(() => { window.state.ctxTarget = { type: 'marker', typeId: 'wc', index: 0 }; window.App.showContextMenu(20, 20); });
    expect(await page.evaluate(() => document.getElementById('ctxAttachWater').style.display)).toBe('none');
    await page.keyboard.press('Escape');
    // a fixture far from everything, both sides missing, both runs in reach: one row, both links
    await page.evaluate(() => {
      const s = window.state; const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      ann.counterMarkers.lav.push({ x: 120, y: 190 });   // 90 from the cold main, 60 from the hot main
      window.App.renderAnnotations(); window.App.updateUI();
      s.ctxTarget = { type: 'marker', typeId: 'lav', index: 2 }; window.App.showContextMenu(20, 20);
    });
    expect(await page.locator('#ctxAttachWater').textContent()).toBe('Attach to nearest cold and hot runs');
    await page.click('#ctxAttachWater');
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]).counterMarkers.lav[2].waterRuns)).toEqual({ cold: 'cmain', hot: 'hmain' });
    r = await readouts(page);
    expect(r.cmain).toMatch(/^14\.5 WSFU cold · 4 fixtures \(1 on branches\) · /);
    // delete the hot main: the link dangles harmlessly and the side is a stray again
    await page.evaluate(() => { const ann = window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]); ann.quickLines = ann.quickLines.filter((q) => q.id !== 'hmain'); window.App.updateUI(); });
    r = await readouts(page);
    expect(r.hmain).toBeUndefined();
    expect(r.cmain).toMatch(/^14\.5 WSFU cold · 4 fixtures \(1 on branches\) · /);
    // the keys ride the project data
    const data = await page.evaluate(() => JSON.parse(JSON.stringify(window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]).counterMarkers.lav[2])));
    expect(data.waterRuns).toEqual({ cold: 'cmain', hot: 'hmain' });
  });

  test('the Quick Line picker follows the name and stores a differing pick; the details picker sets, clears and defers', async ({ page }) => {
    await load(page);
    // Quick Line: the composed name has no side; pick Cold → stored
    await page.evaluate(() => { window.App.showLineTypeTab('quick'); window.App.showModal('chooseLineTypeModal'); });
    await expect(page.locator('#chooseLineTypeModal')).toHaveClass(/visible/);
    expect(await page.locator('#quickLineWaterSideSegment button[data-side="none"]').getAttribute('aria-pressed')).toBe('true');
    await page.click('#quickLineWaterSideSegment button[data-side="cold"]');
    expect((await page.locator('#quickLineWaterSideNote').textContent()) || '').toContain('fixtures within reach attach');
    await page.locator('#quickLineName').fill('3/4in PEX branch');
    await page.locator('#quickLineName').dispatchEvent('input');
    expect(await page.locator('#quickLineWaterSideSegment button[data-side="cold"]').getAttribute('aria-pressed')).toBe('true');   // a pick holds
    await page.click('#quickLineAdd');
    let lt = await page.evaluate(() => window.state.lineTypes[window.state.lineTypes.length - 1]);
    expect(lt.name).toBe('3/4in PEX branch');
    expect(lt.waterSide).toBe('cold');
    // a name that says the side: the picker follows it, and no key is written
    await page.evaluate(() => { window.App.showLineTypeTab('quick'); window.App.showModal('chooseLineTypeModal'); });
    await page.locator('#quickLineName').fill('1in PEX HW');
    await page.locator('#quickLineName').dispatchEvent('input');
    expect(await page.locator('#quickLineWaterSideSegment button[data-side="hot"]').getAttribute('aria-pressed')).toBe('true');
    expect((await page.locator('#quickLineWaterSideNote').textContent()) || '').toContain('from the name');
    await page.click('#quickLineAdd');
    lt = await page.evaluate(() => window.state.lineTypes[window.state.lineTypes.length - 1]);
    expect(lt.name).toBe('1in PEX HW');
    expect('waterSide' in lt).toBe(false);
    expect(await page.evaluate(() => window.WaterModel.lineTypeWaterSide(window.state.lineTypes[window.state.lineTypes.length - 1]))).toBe('hot');
    // the details modal: shown on a plumbing project; a pick over the name is stored, the name's own answer clears the key
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes[window.state.lineTypes.length - 1]));
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => document.getElementById('waterSideGroup').style.display)).toBe('');
    expect(await page.locator('#lineTypeWaterSideSegment button[data-side="hot"]').getAttribute('aria-pressed')).toBe('true');
    await page.click('#lineTypeWaterSideSegment button[data-side="cold"]');
    lt = await page.evaluate(() => window.state.lineTypes[window.state.lineTypes.length - 1]);
    expect(lt.waterSide).toBe('cold');
    expect((await page.locator('#lineTypeWaterSideNote').textContent()) || '').toContain('over the name');
    await page.click('#lineTypeWaterSideSegment button[data-side="none"]');
    lt = await page.evaluate(() => window.state.lineTypes[window.state.lineTypes.length - 1]);
    expect(lt.waterSide).toBe('none');
    await page.click('#lineTypeWaterSideSegment button[data-side="hot"]');
    lt = await page.evaluate(() => window.state.lineTypes[window.state.lineTypes.length - 1]);
    expect('waterSide' in lt).toBe(false);
    await page.evaluate(() => window.App.hideModal('counterLineTypeDetailsModal'));
    // on an HVAC project a plain type shows no picker, a type that carries a side still does
    await page.evaluate(() => { window.App.setProjectTrade('hvac', { route: 'settings' }); window.state.lineTypes.push({ id: 'plain', name: '12in Flex', color: '#47c88e', curveStyle: 'straight' }); });
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'plain')));
    expect(await page.evaluate(() => document.getElementById('waterSideGroup').style.display)).toBe('none');
    await page.evaluate(() => window.App.hideModal('counterLineTypeDetailsModal'));
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes[window.state.lineTypes.length - 2]));
    expect(await page.evaluate(() => document.getElementById('waterSideGroup').style.display)).toBe('');
    await page.evaluate(() => window.App.hideModal('counterLineTypeDetailsModal'));
  });
});

// @ts-check
/**
 * Water runs and the fixtures they serve (WATER-PLAN.md rung 3,
 * features/water-runs.js + water-model.js). Guards: a line type's Water field on
 * the sidebar Add Line Type modal, the Choose Line Type modal's Create and Quick
 * tabs and the details modal (prefilled from the name, a pick wins, set-only on
 * create, the details radio writes at once); fixture-unit marks attach per side
 * to the nearest run of that side within snap, the served totals show on the
 * line type row and the Lines list, the leaders exist for the attached sides,
 * and the shared "Attach to nearest run" row moves a stray fixture onto the
 * nearest run of a side nothing serves; an HVAC project hides the field.
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
// PDF-space -> viewport client coords, through the annotation canvas's rect.
async function screenPointForPdf(page, pdf) {
  return page.evaluate((p) => {
    const c = document.getElementById('annCanvas');
    const rect = c.getBoundingClientRect();
    const bc = window.App.toCanvas(p);
    return { x: rect.left + bc.x * (rect.width / c.width), y: rect.top + bc.y * (rect.height / c.height) };
  }, pdf);
}

test.describe('Water runs (rung 3)', () => {
  test('attachment per side, the served readouts, the leaders, the stray rescue', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'lt-cold', name: '3/4in PEX cold', color: '#4a9eff', curveStyle: 'straight', waterSide: 'cold' });
      s.lineTypes.push({ id: 'lt-hot', name: '3/4in PEX hot', color: '#e85447', curveStyle: 'straight', waterSide: 'hot' });
      s.lineTypes.push({ id: 'lt-waste', name: '3in PVC waste', color: '#888', curveStyle: 'straight' });
      s.counters.push({ id: 'c-lav', name: 'Lavatory', icon: 'M0 0h10v10H0z', color: '#47c88e', wsfu: 2 });
      s.counters.push({ id: 'c-wc', name: 'WC', icon: 'M0 0h10v10H0z', color: '#a47fff', wsfu: 10 });
      s.counters.push({ id: 'c-fd', name: 'Floor drain', icon: 'M0 0h10v10H0z', color: '#ff7a47' });
      const ann = s.pages[0].canvases[0].annotations;
      ann.quickLines.push({ id: 'q-cold', lineTypeId: 'lt-cold', color: '#4a9eff', x1: 100, y1: 200, x2: 400, y2: 200 });
      ann.polylines.push({ id: 'p-hot', lineTypeId: 'lt-hot', color: '#e85447', closed: false, points: [{ x: 100, y: 230 }, { x: 400, y: 230 }] });
      ann.quickLines.push({ id: 'q-waste', lineTypeId: 'lt-waste', color: '#888', x1: 100, y1: 300, x2: 400, y2: 300 });
      // a lavatory 10 from the cold run and 20 from the hot (only the cold side snaps at 12);
      // a WC 5 from the cold run; a floor drain on the run (no fixture units, never a fixture);
      // a stray lavatory 30 from the hot run and 60 from the cold
      ann.counterMarkers['c-lav'] = [{ x: 200, y: 210 }, { x: 250, y: 260 }];
      ann.counterMarkers['c-wc'] = [{ x: 300, y: 205 }];
      ann.counterMarkers['c-fd'] = [{ x: 350, y: 200 }];
      window.App.updateUI();
      window.App.renderAnnotations();
    });
    expect(await page.evaluate(() => window.App.getWaterServed(0))).toEqual({ 'q-cold': { side: 'cold', wsfu: 11.5, fixtures: 2 }, 'p-hot': { side: 'hot', wsfu: 0, fixtures: 0 } });
    expect(await page.evaluate(() => window.App.collectWaterFixtures(0).map((f) => [f.counterId, f.loads]))).toEqual([['c-lav', { cold: 1.5, hot: 1.5 }], ['c-lav', { cold: 1.5, hot: 1.5 }], ['c-wc', { cold: 10, hot: 0 }]]);
    // the leaders the draw core paints: the lavatory's cold tie and the WC's
    expect(await page.evaluate(() => window.WaterModel.waterFixtureLeaders(window.App.collectWaterFixtures(0), window.App.getWaterRuns(0)).map((l) => [l.side, l.to]))).toEqual([['cold', { x: 200, y: 200 }], ['cold', { x: 300, y: 200 }]]);
    // the sidebar: the line type rows and the Lines list carry the served totals
    const typeMeta = await page.evaluate(() => [...document.querySelectorAll('#lineTypesList .line-water-meta')].map((d) => d.textContent));
    expect(typeMeta).toEqual(['cold · 11.5 WSFU served · 2 fixtures', 'hot · 0 WSFU served']);
    const lineMeta = await page.evaluate(() => [...document.querySelectorAll('#linesList .line-water-meta')].map((d) => d.textContent));
    expect(lineMeta.sort()).toEqual(['cold · 11.5 WSFU · 2 fixtures', 'hot · 0 WSFU']);
    // a multiply zone triples what the fixture inside it serves
    await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      ann.multiplyZones.push({ id: 'mz', x1: 280, y1: 190, x2: 320, y2: 220, multiplier: 3 });
      window.App.updateUI();
    });
    expect(await page.evaluate(() => window.App.getWaterServed(0)['q-cold'].wsfu)).toBe(31.5);
    await page.evaluate(() => { window.state.pages[0].canvases[0].annotations.multiplyZones = []; window.App.updateUI(); });

    // the stray rescue: the shared context row moves the second lavatory onto the hot run (30 away beats the cold at 60)
    const stray = await screenPointForPdf(page, { x: 250, y: 260 });
    await page.mouse.click(stray.x, stray.y, { button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#ctxAttachToRun')).toBeVisible();
    await page.locator('#ctxAttachToRun').click();
    await expect(page.locator('#contextMenu')).not.toHaveClass(/visible/);
    const moved = await page.evaluate(() => ({ ...window.state.pages[0].canvases[0].annotations.counterMarkers['c-lav'][1] }));
    expect(moved.x).toBeCloseTo(250, 3);
    expect(moved.y).toBeCloseTo(230, 3);
    expect(await page.evaluate(() => window.App.getWaterServed(0)['p-hot'])).toEqual({ side: 'hot', wsfu: 1.5, fixtures: 1 });
    // an attached fixture is not offered the rescue; a floor drain never is
    const wc = await screenPointForPdf(page, { x: 300, y: 205 });
    await page.mouse.click(wc.x, wc.y, { button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#ctxAttachToRun')).toBeHidden();
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('the Water field on the four line-type surfaces, and the HVAC hide', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    // the sidebar Add Line Type modal: prefilled from the name, set-only on create
    await page.locator('#addLineType').click();
    await expect(page.locator('#lineTypeModal')).toHaveClass(/visible/);
    await expect(page.locator('#lineTypeWaterGroup')).toBeVisible();
    await expect(page.locator('input[name="lineTypeWaterSide"][value=""]')).toBeChecked();
    await page.locator('#lineTypeName').fill('3/4in PEX hot');
    await expect(page.locator('input[name="lineTypeWaterSide"][value="hot"]')).toBeChecked();
    await page.locator('#lineTypeCreate').click();
    let lt = await page.evaluate(() => window.state.lineTypes[window.state.lineTypes.length - 1]);
    expect(lt.waterSide).toBe('hot');
    await page.locator('#addLineType').click();
    await page.locator('#lineTypeName').fill('3in PVC waste');
    await expect(page.locator('input[name="lineTypeWaterSide"][value=""]')).toBeChecked();
    await page.locator('#lineTypeCreate').click();
    lt = await page.evaluate(() => window.state.lineTypes[window.state.lineTypes.length - 1]);
    expect('waterSide' in lt).toBe(false);
    // the Quick tab: the composed name, a pick that wins over a later name
    await page.evaluate(() => { window.App.showChooseLineTypeModal(); window.App.showLineTypeTab('quick'); });
    await expect(page.locator('#chooseLineTypeQuickPanel')).toBeVisible();
    await expect(page.locator('#quickLineWaterGroup')).toBeVisible();
    await page.locator('#quickLineName').fill('1/2in CW');
    await expect(page.locator('input[name="quickLineWaterSide"][value="cold"]')).toBeChecked();
    await page.locator('#quickLineWaterGroup label:has(input[value="hot"])').click();
    await page.locator('#quickLineName').fill('1/2in CW branch');
    await expect(page.locator('input[name="quickLineWaterSide"][value="hot"]')).toBeChecked();
    await page.locator('#quickLineAdd').click();
    lt = await page.evaluate(() => window.state.lineTypes[window.state.lineTypes.length - 1]);
    expect(lt.name).toBe('1/2in CW branch');
    expect(lt.waterSide).toBe('hot');
    // the Create tab
    await page.evaluate(() => { window.App.showChooseLineTypeModal(); window.App.showLineTypeTab('create'); });
    await expect(page.locator('#createLineTypeWaterGroup')).toBeVisible();
    await page.locator('#createLineTypeName').fill('Domestic cold water 1in');
    await expect(page.locator('input[name="createLineTypeWaterSide"][value="cold"]')).toBeChecked();
    await page.locator('#createLineTypeCreate').click();
    lt = await page.evaluate(() => window.state.lineTypes[window.state.lineTypes.length - 1]);
    expect(lt.waterSide).toBe('cold');
    // the details modal: the stored side, a click writes it, — deletes the key
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes[0]));
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    await expect(page.locator('#counterLineTypeDetailsWaterGroup')).toBeVisible();
    await expect(page.locator('input[name="counterLineTypeDetailsWaterSide"][value="hot"]')).toBeChecked();
    await page.locator('#counterLineTypeDetailsWaterGroup label:has(input[value="cold"])').click();
    expect(await page.evaluate(() => window.state.lineTypes[0].waterSide)).toBe('cold');
    await page.locator('#counterLineTypeDetailsWaterGroup label:has(input[value=""])').click();
    expect(await page.evaluate(() => 'waterSide' in window.state.lineTypes[0])).toBe(false);
    await page.locator('#counterLineTypeDetailsClose').click();
    // an HVAC project hides the field on the create surfaces; a sided type still shows it in its details
    await page.evaluate(() => window.App.setProjectTrade('hvac', { remember: false }));
    await page.locator('#addLineType').click();
    await expect(page.locator('#lineTypeWaterGroup')).toBeHidden();
    await page.locator('#lineTypeCancel').click();
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes[2]));
    await expect(page.locator('#counterLineTypeDetailsWaterGroup')).toBeVisible();
    await page.locator('#counterLineTypeDetailsClose').click();
    expect(errors).toEqual([]);
  });
});

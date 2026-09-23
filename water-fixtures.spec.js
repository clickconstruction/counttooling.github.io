// @ts-check
/**
 * Fixture units on counters (WATER-PLAN.md rung 2, features/water-fixtures.js).
 * Guards: on a plumbing project the Create tab's "More ▸ water supply" disclosure
 * is open and the WSFU field fills itself from the name in the project's
 * occupancy column with a chip naming the rule and the row; flipping occupancy
 * changes an untouched prefill; a typed value is kept and the chip says so; the
 * created counter carries `wsfu` and `wsfuFixture`; a non-fixture name gets
 * nothing; the details modal shows the field and offers the rulebook's reading;
 * a placed mark takes its own value through the context menu and the key goes
 * when cleared; the Summary's foot line adds it up, multiply-zone adjusted, with
 * the cold / hot split and the demand curve; the keys ride the export data; on an
 * HVAC project the disclosure starts closed.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function load(page, trade) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => window.App.rulesReady());
  await page.evaluate((t) => { window.App.setProjectTrade(t, { route: 'settings' }); window.state.counterWaterMoreOpen = null; window.state.counterAirMoreOpen = null; localStorage.removeItem('codesDefault'); window.state.codes = null; }, trade);
}
async function openCreate(page) {
  await page.locator('#counterBtn').click();
  await expect(page.locator('#counterModal')).toHaveClass(/visible/);
  if (await page.locator('#counterCreatePanel').isHidden()) await page.locator('#counterModal .counter-tab[data-tab="create"]').click();
}

test.describe('Fixture units on counters (WATER rung 2)', () => {
  test('the Create tab: the disclosure, the prefill from the name and the occupancy, typing over, the created counter', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page, 'plumbing');
    await openCreate(page);
    // open by itself on plumbing; the air disclosure stays closed
    expect(await page.evaluate(() => document.getElementById('counterWaterMoreFields').hidden)).toBe(false);
    expect(await page.evaluate(() => document.getElementById('counterAirMoreFields').hidden)).toBe(true);
    // the name earns its fixture units in the public column
    await page.locator('#counterName').fill('L-1 Lavatory');
    await expect(page.locator('#counterWsfu')).toHaveValue('2');
    let chip = (await page.locator('#counterWsfuChip').textContent()) || '';
    expect(chip).toContain('2 WSFU');
    expect(chip).toContain('public lavatory');
    expect(await page.locator('#counterWsfuChip .rule-chip[data-rule="plumb.wsfu.fixtures"]').count()).toBe(1);
    // a water closet that does not say tank or valve: the assumption is named
    await page.locator('#counterName').fill('WC-1 Water Closet');
    await expect(page.locator('#counterWsfu')).toHaveValue('10');
    chip = (await page.locator('#counterWsfuChip').textContent()) || '';
    expect(chip).toContain('flush valve assumed');
    // the occupancy flips the untouched prefill
    await page.evaluate(() => window.App.setProjectCodes({ occupancy: 'private' }, { remember: false }));
    await page.locator('#counterName').fill('Lavatory');
    await expect(page.locator('#counterWsfu')).toHaveValue('0.7');
    expect((await page.locator('#counterWsfuChip').textContent()) || '').toContain('private lavatory');
    await page.evaluate(() => window.App.setProjectCodes({ occupancy: 'public' }, { remember: false }));
    await page.locator('#counterName').fill('L-1 Lavatory');
    await expect(page.locator('#counterWsfu')).toHaveValue('2');
    // typed over: kept, and the chip says whose it is; a later name change leaves it alone
    await page.locator('#counterWsfu').fill('3');
    chip = (await page.locator('#counterWsfuChip').textContent()) || '';
    expect(chip).toContain('yours');
    expect(chip).toContain('the rulebook reads 2');
    await page.locator('#counterName').fill('L-1 Lavatory ADA');
    await expect(page.locator('#counterWsfu')).toHaveValue('3');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    let c = await page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
    expect(c.name).toBe('L-1 Lavatory ADA');
    expect(c.wsfu).toBe(3);
    expect(c.wsfuFixture).toBe('lavatory');   // the row the name declares, so the split survives a typed total
    // a fixture that draws no supply: no prefill, no chip, no key on the counter
    await openCreate(page);
    await page.locator('#counterName').fill('FD-1 Floor Drain');
    await expect(page.locator('#counterWsfu')).toHaveValue('');
    expect(await page.evaluate(() => document.getElementById('counterWsfuChip').hidden)).toBe(true);
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    c = await page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
    expect(c.name).toBe('FD-1 Floor Drain');
    expect('wsfu' in c).toBe(false);
    expect('wsfuFixture' in c).toBe(false);
    // the accepted prefill: the rulebook's own value and key
    await openCreate(page);
    await page.locator('#counterName').fill('MS-1 Mop Sink');
    await expect(page.locator('#counterWsfu')).toHaveValue('3');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    c = await page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
    expect(c.wsfu).toBe(3);
    expect(c.wsfuFixture).toBe('service-sink');
    // the estimator's own toggle wins for the project
    await openCreate(page);
    await page.locator('#counterWaterMoreToggle').click();
    expect(await page.evaluate(() => window.state.counterWaterMoreOpen)).toBe(false);
    await page.evaluate(() => window.App.hideModal('counterModal'));
    await openCreate(page);
    expect(await page.evaluate(() => document.getElementById('counterWaterMoreFields').hidden)).toBe(true);
    await page.evaluate(() => window.App.hideModal('counterModal'));
    expect(errors).toEqual([]);
  });

  test('the Quick Count twin reads the composed name; on an HVAC project the disclosure starts closed', async ({ page }) => {
    await load(page, 'plumbing');
    await page.locator('#counterBtn').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    if (await page.locator('#counterQuickCountPanel').isHidden()) await page.locator('#counterModal .counter-tab[data-tab="quickcount"]').click();
    expect(await page.evaluate(() => document.getElementById('counterQuickCountWaterMoreFields').hidden)).toBe(false);
    // a typed name over the composed one
    await page.locator('#counterQuickCountName').fill('HS-1 Hand Sink');
    await page.locator('#counterQuickCountName').dispatchEvent('input');
    await expect(page.locator('#counterQuickCountWsfu')).toHaveValue('2');
    expect((await page.locator('#counterQuickCountWsfuChip').textContent()) || '').toContain('read as a lavatory');
    await page.locator('#counterQuickCountAdd').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    const c = await page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
    expect(c.name).toBe('HS-1 Hand Sink');
    expect(c.wsfu).toBe(2);
    expect(c.wsfuFixture).toBe('lavatory');
    // an HVAC project: the water disclosure starts closed, the air one open
    await load(page, 'hvac');
    await openCreate(page);
    expect(await page.evaluate(() => document.getElementById('counterWaterMoreFields').hidden)).toBe(true);
    expect(await page.evaluate(() => document.getElementById('counterAirMoreFields').hidden)).toBe(false);
    // still reachable: unfold and the prefill works the same
    await page.locator('#counterWaterMoreToggle').click();
    await page.locator('#counterName').fill('Urinal');
    await expect(page.locator('#counterWsfu')).toHaveValue('5');
    await page.evaluate(() => window.App.hideModal('counterModal'));
  });

  test('the details modal, the per-mark override, the Summary foot line, and the export data', async ({ page }) => {
    await load(page, 'plumbing');
    // two counters and their marks, laid directly
    await page.evaluate(() => {
      const s = window.state;
      s.pages[s.currentPage].scale = { pixelsPerUnit: 10, unit: 'ft' };
      s.counters.push({ id: 'lav', name: 'L-1 Lavatory', icon: window.App.getOrderedIcons()[0].value, color: '#4a9eff', wsfu: 2, wsfuFixture: 'lavatory' });
      s.counters.push({ id: 'wc', name: 'WC-1 Water Closet', icon: window.App.getOrderedIcons()[1].value, color: '#e85447', wsfu: 10, wsfuFixture: 'water-closet-valve' });
      s.counters.push({ id: 'fd', name: 'FD-1 Floor Drain', icon: window.App.getOrderedIcons()[2].value, color: '#47c88e' });
      const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      ann.counterMarkers.lav = [{ x: 100, y: 100 }, { x: 140, y: 100 }, { x: 180, y: 100 }];
      ann.counterMarkers.wc = [{ x: 100, y: 200 }, { x: 140, y: 200 }];
      ann.counterMarkers.fd = [{ x: 100, y: 300 }];
      window.App.renderAnnotations();
      window.App.updateUI();
    });
    // the Summary foot line: 3 × 2 + 2 × 10 = 26 WSFU, cold 3 × 1.5 + 20 = 24.5, hot 4.5, a flush valve on the set
    let line = (await page.locator('#summaryWaterLine').textContent()) || '';
    expect(line).toContain('Water supply · 26 WSFU (cold 24.5 · hot 4.5) · public · flush-valve curve');
    expect(await page.locator('#summaryWaterLine .rule-chip[data-rule="plumb.wsfu.fixtures"]').count()).toBe(1);
    // the per-mark override through the context menu: app.js showContextMenu gates the
    // row on the target it holds (the spec seam drop-mode.spec.js uses)
    await page.evaluate(() => { window.state.ctxTarget = { type: 'marker', typeId: 'lav', index: 0 }; window.App.showContextMenu(20, 20); });
    expect(await page.evaluate(() => document.getElementById('ctxMarkerWsfu').style.display)).toBe('block');
    await page.click('#ctxMarkerWsfu');
    await expect(page.locator('#markerWsfuModal')).toHaveClass(/visible/);
    expect((await page.locator('#markerWsfuHint').textContent()) || '').toContain('(2)');
    await page.locator('#markerWsfuInput').fill('4');
    await page.locator('#markerWsfuSave').click();
    await expect(page.locator('#markerWsfuModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]).counterMarkers.lav[0].wsfuOverride)).toBe(4);
    line = (await page.locator('#summaryWaterLine').textContent()) || '';
    expect(line).toContain('28 WSFU (cold 26 · hot 6)');
    // the floor drain's mark gets no row
    await page.evaluate(() => { window.state.ctxTarget = { type: 'marker', typeId: 'fd', index: 0 }; window.App.showContextMenu && window.App.showContextMenu(20, 20); });
    expect(await page.evaluate(() => document.getElementById('ctxMarkerWsfu').style.display)).toBe('none');
    await page.keyboard.press('Escape');
    // the details modal: the field, the overrides note, the rulebook's reading with "use it"
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters.find((c) => c.id === 'lav')));
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => document.getElementById('counterLineTypeDetailsWaterSection').style.display)).toBe('');
    expect(await page.locator('#counterLineTypeDetailsWsfu').inputValue()).toBe('2');
    expect((await page.locator('#counterLineTypeDetailsWsfuOverrides').textContent()) || '').toContain('(override 4)');
    expect(await page.locator('#counterLineTypeDetailsWsfuUse').count()).toBe(0);   // stored equals the rulebook's
    await page.locator('#counterLineTypeDetailsWsfu').fill('5');
    await page.locator('#counterLineTypeDetailsWsfu').dispatchEvent('blur');
    expect(await page.evaluate(() => window.state.counters.find((c) => c.id === 'lav').wsfu)).toBe(5);
    expect(await page.locator('#counterLineTypeDetailsWsfuUse').count()).toBe(1);
    await page.click('#counterLineTypeDetailsWsfuUse');
    expect(await page.evaluate(() => window.state.counters.find((c) => c.id === 'lav').wsfu)).toBe(2);
    // cleared: both keys go
    await page.locator('#counterLineTypeDetailsWsfu').fill('');
    await page.locator('#counterLineTypeDetailsWsfu').dispatchEvent('blur');
    expect(await page.evaluate(() => { const c = window.state.counters.find((x) => x.id === 'lav'); return ['wsfu' in c, 'wsfuFixture' in c]; })).toEqual([false, false]);
    await page.evaluate(() => window.App.hideModal('counterLineTypeDetailsModal'));
    // a line type shows no water section
    await page.evaluate(() => { window.state.lineTypes.push({ id: 'lt1', name: '1/2in PEX', color: '#4a9eff' }); window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'lt1')); });
    expect(await page.evaluate(() => document.getElementById('counterLineTypeDetailsWaterSection').style.display)).toBe('none');
    await page.evaluate(() => window.App.hideModal('counterLineTypeDetailsModal'));
    // the override alone still counts (the counter lost its wsfu; the mark keeps 4); the split is unknown now
    line = (await page.locator('#summaryWaterLine').textContent()) || '';
    expect(line).toContain('24 WSFU');
    expect(line).not.toContain('cold');
    // the export data carries the keys wholesale
    const data = await page.evaluate(() => (window.App.getProjectData ? window.App.getProjectData() : JSON.parse(JSON.stringify({ counters: window.state.counters }))));
    expect(data.counters.find((c) => c.id === 'wc').wsfu).toBe(10);
    expect(data.counters.find((c) => c.id === 'wc').wsfuFixture).toBe('water-closet-valve');
    // cleared override: the key goes
    await page.evaluate(() => { window.state.ctxTarget = { type: 'marker', typeId: 'wc', index: 0 }; });
    await page.evaluate(() => { const s = window.state; const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]); window.App.openMarkerWsfuModal(ann.counterMarkers.wc[0], s.counters.find((c) => c.id === 'wc')); });
    await page.locator('#markerWsfuInput').fill('');
    await page.locator('#markerWsfuInput').press('Enter');
    expect(await page.evaluate(() => 'wsfuOverride' in window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]).counterMarkers.wc[0])).toBe(false);
  });
});

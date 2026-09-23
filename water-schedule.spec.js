// @ts-check
/**
 * The Water Sizing schedule (WATER-PLAN.md rung 5, features/water-schedule.js).
 * Guards: the Water button appears only while the project has a water run and
 * opens the modal; a row per run with its side, units, gpm, size, velocity and
 * ✓ / ⚠ (over the cap; under a fixture's supply minimum, with the size that
 * would pass); the cold and hot peaks are the largest run's, never a sum; the
 * knobs (the caps, the occupancy) re-read the rows, the Lines list and the
 * trace's suggestion, and ride the project data; Copy Schedule's exact text;
 * the report carries the table; Copy Summary and Copy to /Tooling carry the
 * "--- Water sizing ---" block and the summary parser counts it as its own unit.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

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
  });
}
async function lay(page) {
  await page.evaluate(() => {
    const s = window.state;
    const icon = window.App.getOrderedIcons()[0].value;
    s.lineTypes.push({ id: 'cw', name: '1.5in Copper CW', color: '#2e86de', curveStyle: 'straight' });
    s.lineTypes.push({ id: 'br', name: '0.75in Copper CW', color: '#2e86de', curveStyle: 'straight' });
    s.lineTypes.push({ id: 'hw', name: '1.25in Copper HW', color: '#e85447', curveStyle: 'straight' });
    s.counters.push({ id: 'wc', name: 'WC-1 Water Closet', icon, color: '#e8c547', wsfu: 10, wsfuFixture: 'water-closet-valve' });
    s.counters.push({ id: 'lav', name: 'L-1 Lavatory', icon, color: '#4a9eff', wsfu: 2, wsfuFixture: 'lavatory' });
    const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
    ann.quickLines = ann.quickLines || []; ann.polylines = ann.polylines || [];
    // the cold main along y 100 with the water closet on it; a 3/4 in branch off it to the lavs; the hot main under the lavs
    ann.quickLines.push({ id: 'cmain', x1: 50, y1: 100, x2: 200, y2: 100, color: '#2e86de', lineTypeId: 'cw', group: null });
    ann.polylines.push({ id: 'cbranch', name: 'Lav branch', points: [{ x: 200, y: 100 }, { x: 400, y: 100 }], closed: false, color: '#2e86de', lineTypeId: 'br', group: null });
    ann.quickLines.push({ id: 'hmain', x1: 200, y1: 130, x2: 400, y2: 130, color: '#e85447', lineTypeId: 'hw', group: null });
    ann.counterMarkers.wc = [{ x: 150, y: 110 }];
    ann.counterMarkers.lav = [{ x: 250, y: 115 }, { x: 350, y: 115 }];
    window.App.renderAnnotations(); window.App.updateUI();
  });
}

test.describe('The Water Sizing schedule (WATER rung 5)', () => {
  test('the button, the rows, the peaks, the knobs, the persistence', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    expect(await page.evaluate(() => document.getElementById('waterScheduleBtn').style.display)).toBe('none');
    await lay(page);
    expect(await page.evaluate(() => document.getElementById('waterScheduleBtn').style.display)).toBe('');
    await page.click('#waterScheduleBtn');
    await expect(page.locator('#waterScheduleModal')).toHaveClass(/visible/);
    // one page: no scope segment
    expect(await page.evaluate(() => document.getElementById('waterScheduleScope').style.display)).toBe('none');
    const s = await page.evaluate(() => { const x = window.App.computeWaterSchedule({}); return { rows: x.rows.map((r) => ({ id: r.runId, side: r.side, served: r.served, gpm: r.gpm, key: r.key, v: r.velocityFps, ok: r.ok, warnings: r.warnings, sug: r.suggestedKey, fixtures: r.fixtures })), totals: x.totals, occ: x.occupancy, warn: x.warnCount }; });
    // the main: its own water closet plus the branch's two lavatories → 13 WSFU on the valve curve, 29.4 gpm, 1-1/2 in copper at 5.3
    expect(s.rows.find((r) => r.id === 'cmain')).toEqual({ id: 'cmain', side: 'cold', served: 13, gpm: 29.4, key: '1-1/2', v: 5.3, ok: true, warnings: [], sug: '1-1/4', fixtures: 3 });
    // the branch: 3 WSFU on the tank curve, 6.5 gpm, 3/4 in at 4.3
    expect(s.rows.find((r) => r.id === 'cbranch')).toEqual({ id: 'cbranch', side: 'cold', served: 3, gpm: 6.5, key: '3/4', v: 4.3, ok: true, warnings: [], sug: '3/4', fixtures: 2 });
    // the hot main: the lavs' hot, 3 WSFU, 6.5 gpm in 1-1/4 in copper: 1.7 ft/s; 3/4 in is the smallest under the hot cap of 5
    expect(s.rows.find((r) => r.id === 'hmain')).toEqual({ id: 'hmain', side: 'hot', served: 3, gpm: 6.5, key: '1-1/4', v: 1.7, ok: true, warnings: [], sug: '3/4', fixtures: 2 });
    // the peaks are the largest run's, never a sum
    expect(s.totals.cold).toEqual({ runs: 2, wsfu: 13, gpm: 29.4, warn: 0, cap: 8 });
    expect(s.totals.hot).toEqual({ runs: 1, wsfu: 3, gpm: 6.5, warn: 0, cap: 5 });
    expect(s.occ).toBe('public'); expect(s.warn).toBe(0);
    const bodyText = (await page.locator('#waterScheduleBody').textContent()) || '';
    expect(bodyText).toContain('Cold water');
    expect(bodyText).toContain('Lav branch');
    expect(bodyText).toContain('Cold peak');
    expect(await page.locator('#waterScheduleBody .rule-chip[data-rule="plumb.wsfu.demand"]').count()).toBeGreaterThan(0);
    // the cold cap knob: tighten to 5 → the main is over; the row, the Lines list and the project data follow
    await page.locator('#waterCapCold').fill('5');
    await page.locator('#waterCapCold').dispatchEvent('change');
    const after = await page.evaluate(() => { const x = window.App.computeWaterSchedule({}); const m = x.rows.find((r) => r.runId === 'cmain'); return { ok: m.ok, warnings: m.warnings, sug: m.suggestedKey, cap: x.totals.cold.cap, warn: x.totals.cold.warn, settings: window.state.waterSettings }; });
    expect(after).toEqual({ ok: false, warnings: ['over 5 ft/s'], sug: '2', cap: 5, warn: 1, settings: { coldFps: 5, hotFps: 5 } });
    expect((await page.locator('#waterScheduleBody').textContent()) || '').toContain('⚠ over 5 ft/s → 2 in');
    expect(await page.evaluate(() => window.App.waterRunReadouts(window.state.currentPage).get('cmain').text)).toContain('⚠ over 5');
    // the trace's suggestion reads the knob too
    await page.evaluate(() => { const st = window.state; st.activeLineTypeId = 'cw'; st.drawingPolyline = { id: window.App.uid(), name: 'T', color: '#2e86de', points: [{ x: 50, y: 300 }], closed: false, lineTypeId: 'cw', group: null }; st.tool = window.App.TOOL.POLYLINE; window.App.updateUI(); });
    expect(await page.evaluate(() => window.App.waterDraftSuggestion())).toBe(null);   // everything cold is served now: nothing ahead
    await page.evaluate(() => { const st = window.state; st.drawingPolyline = null; st.tool = window.App.TOOL.NONE; window.App.updateUI(); });
    // the occupancy knob is Project Settings' field
    await page.click('#waterScheduleOccupancy button[data-occupancy="private"]');
    expect(await page.evaluate(() => window.App.getProjectCodes().occupancy)).toBe('private');
    expect(await page.evaluate(() => window.App.computeWaterSchedule({}).occupancy)).toBe('private');
    await page.click('#waterScheduleOccupancy button[data-occupancy="public"]');
    // an invalid cap falls back
    await page.locator('#waterCapHot').fill('-3');
    await page.locator('#waterCapHot').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.waterSettings.hotFps)).toBe(5);
    // the settings ride the project data and hydrate; junk normalizes
    const data = await page.evaluate(() => JSON.parse(JSON.stringify({ waterSettings: window.state.waterSettings })));
    expect(data.waterSettings).toEqual({ coldFps: 5, hotFps: 5 });
    await page.evaluate(() => window.App.hydrateStateFromProjectData({ counters: [], lineTypes: [], groups: [], waterSettings: { coldFps: 7, hotFps: 'x' } }));
    expect(await page.evaluate(() => window.App.getWaterSettings())).toEqual({ coldFps: 7, hotFps: 5 });
    await page.evaluate(() => window.App.applyTakeoffBackupToState({ counters: [], lineTypes: [], waterSettings: { hotFps: 4 } }));
    expect(await page.evaluate(() => window.App.getWaterSettings())).toEqual({ coldFps: 7, hotFps: 4 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#waterScheduleModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('Copy Schedule, the report table, the summary blocks and the parser', async ({ page }) => {
    await load(page);
    await lay(page);
    // a 1/2 in branch to the water closet: under its 1 in minimum and over the cap
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'tiny', name: '1/2in Copper CW', color: '#2e86de', curveStyle: 'straight' });
      const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      // off the main at x 100, clear of the first water closet's mark at (150, 110)
      ann.counterMarkers.wc.push({ x: 100, y: 210 });
      ann.quickLines.push({ id: 'tiny', x1: 100, y1: 100, x2: 100, y2: 200, color: '#2e86de', lineTypeId: 'tiny', group: null });
      window.App.updateUI();
    });
    const tinyRow = await page.evaluate(() => { const r = window.App.computeWaterSchedule({}).rows.find((x) => x.runId === 'tiny'); return { served: r.served, ok: r.ok, warnings: r.warnings, sug: r.suggestedKey }; });
    // the size that passes is the smallest under the CAP (27 gpm wants 1-1/4 in copper), which is above the fixture's 1 in floor
    expect(tinyRow).toEqual({ served: 10, ok: false, warnings: ['over 8 ft/s', 'under the 1 in a water closet valve needs'], sug: '1-1/4' });
    // Copy Schedule: the exact text
    await page.click('#waterScheduleBtn');
    await page.click('#waterScheduleCopy');
    await page.waitForFunction(() => document.querySelector('.toast, #toastRegion') !== null, null, { timeout: 5000 }).catch(() => {});
    const text = await page.evaluate(() => navigator.clipboard.readText());
    const lines = text.split('\n');
    expect(lines[0]).toBe('Water sizing');
    expect(lines[1]).toBe(['Run', 'Side', 'WSFU', 'gpm', 'Size', 'Velocity', 'Check'].join('\t'));
    expect(lines).toContain(['Lav branch (0.75in Copper CW)', 'cold', '3 WSFU', '6.5 gpm', '3/4 in', '4.3 ft/s', 'ok'].join('\t'));
    expect(lines).toContain(['Quick line (1/2in Copper CW)', 'cold', '10 WSFU', '27 gpm', '1/2 in', '37.1 ft/s', '⚠ over 8 ft/s; under the 1 in a water closet valve needs → 1-1/4 in'].join('\t'));
    expect(lines).toContain(['Cold peak', 'cold', '23 WSFU', '36.8 gpm', '', 'cap 8 ft/s', '1 ⚠'].join('\t'));
    expect(lines).toContain(['Hot peak', 'hot', '3 WSFU', '6.5 gpm', '', 'cap 5 ft/s', 'ok'].join('\t'));
    expect(lines[lines.length - 1]).toBe(['Occupancy', 'public', '', '', '', '', 'practice, not code'].join('\t'));
    await page.evaluate(() => window.App.hideModal('waterScheduleModal'));
    // the report carries the table
    const html = await page.evaluate(() => window.buildReportHtml({}));
    expect(html).toContain('Water Sizing');
    expect(html).toContain('<td>Lav branch (0.75in Copper CW)</td><td>cold</td><td>3</td><td>6.5</td><td>3/4 in</td><td>4.3</td><td>✓</td>');
    expect(html).toContain('Cold peak');
    // Copy Summary / Copy to /Tooling carry the block, and the parser counts it as its own unit
    const tooling = await page.evaluate(() => window.getPipeToolingSummary({}));
    expect(tooling).toContain('--- Water sizing ---');
    expect(tooling.split('--- Water sizing ---')[1]).toContain('Lav branch (0.75in Copper CW)\tcold\t3 WSFU');
    const parsed = await page.evaluate((t) => window.summarizeToolingExport(t), tooling);
    expect(parsed.water.rows).toBe(7);   // 3 cold runs + cold peak, hot run + hot peak, occupancy
    expect(parsed.ea.items).toBe(2);     // the two counters, unaffected by the block
    const email = await page.evaluate(() => window.getEmailTextSummary({}));
    expect(email).toContain('--- Water sizing ---');
  });
});

// @ts-check
/**
 * The water rows of Bid Check and the shared export gate (WATER-PLAN.md rung 6,
 * features/water-bidcheck.js). Guards: no water, no water rows; a water run adds
 * the five auto rows and the three manual rows; each auto row reads the app's own
 * tallies (over the cap, under a fixture's minimum, a stray side, an unscaled
 * sheet, a cold main under 3/4 in) and shows its work; ticks persist in the
 * project data; the gate arms on water alone (no duct): the badge, the
 * "Review · Export anyway" toast on Export PDFs and Copy to /Tooling, Review
 * flashing a water row, Export anyway proceeding and remembered.
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
    s.bidCheckCollapsed = false;
    window.App.updateUI();
  });
}
const rows = (page) => page.evaluate(() => { const c = window.App.getBidCheck(); return { auto: c.auto.filter((r) => r.id.startsWith('water-')).map((r) => ({ id: r.id, verdict: r.verdict, detail: r.detail })), manual: c.manual.filter((r) => r.id.startsWith('water-')).map((r) => ({ id: r.id, done: r.done })), open: c.open }; });

test.describe('Bid Check, the water rows (WATER rung 6)', () => {
  test('no water, no rows; a run adds them; each auto row reads the tallies; ticks persist', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    let r = await rows(page);
    expect(r.auto).toEqual([]); expect(r.manual).toEqual([]);
    // a fixture with units but no run yet: the rows arrive, every fixture served is the one that warns
    await page.evaluate(() => {
      const s = window.state; const icon = window.App.getOrderedIcons()[0].value;
      s.counters.push({ id: 'wc', name: 'WC-1 Water Closet', icon, color: '#e8c547', wsfu: 10, wsfuFixture: 'water-closet-valve' });
      s.counters.push({ id: 'lav', name: 'L-1 Lavatory', icon, color: '#4a9eff', wsfu: 2, wsfuFixture: 'lavatory' });
      const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      ann.counterMarkers.wc = [{ x: 150, y: 110 }];
      ann.counterMarkers.lav = [{ x: 250, y: 115 }, { x: 350, y: 115 }];
      window.App.renderAnnotations(); window.App.updateUI();
    });
    r = await rows(page);
    expect(r.auto.map((x) => x.id + ':' + x.verdict)).toEqual(['water-runs-sized:na', 'water-fixture-min:na', 'water-fixtures-served:warn', 'water-sheets-scaled:na', 'water-service-min:na']);
    expect(r.auto[2].detail).toBe('5 sides no run serves: WC-1 Water Closet cold, L-1 Lavatory cold ×2, L-1 Lavatory hot ×2 · right-click a fixture for Attach to nearest run ⚠');
    expect(r.manual.map((x) => x.id)).toEqual(['water-pressure', 'water-heater-load', 'water-recirc']);
    // the runs: a 1-1/2 in cold main, a 3/4 in branch to the lavs, a 1-1/4 in hot main: everything served, every row ✓
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'cw', name: '1.5in Copper CW', color: '#2e86de', curveStyle: 'straight' });
      s.lineTypes.push({ id: 'br', name: '0.75in Copper CW', color: '#2e86de', curveStyle: 'straight' });
      s.lineTypes.push({ id: 'hw', name: '1.25in Copper HW', color: '#e85447', curveStyle: 'straight' });
      const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      ann.quickLines = ann.quickLines || []; ann.polylines = ann.polylines || [];
      ann.quickLines.push({ id: 'cmain', x1: 50, y1: 100, x2: 200, y2: 100, color: '#2e86de', lineTypeId: 'cw', group: null });
      ann.polylines.push({ id: 'cbranch', name: 'Lav branch', points: [{ x: 200, y: 100 }, { x: 400, y: 100 }], closed: false, color: '#2e86de', lineTypeId: 'br', group: null });
      ann.quickLines.push({ id: 'hmain', x1: 200, y1: 130, x2: 400, y2: 130, color: '#e85447', lineTypeId: 'hw', group: null });
      window.App.renderAnnotations(); window.App.updateUI();
    });
    r = await rows(page);
    expect(r.auto.map((x) => x.id + ':' + x.verdict)).toEqual(['water-runs-sized:ok', 'water-fixture-min:ok', 'water-fixtures-served:ok', 'water-sheets-scaled:ok', 'water-service-min:ok']);
    expect(r.auto[0].detail).toBe('3 water runs under the velocity caps ✓');
    expect(r.auto[2].detail).toBe('3 fixtures on a run, every side ✓');
    expect(r.auto[4].detail).toBe('1 cold main at 3/4 in or more ✓');
    // the panel shows them with their rule chips
    expect(await page.locator('#bidCheckList .bid-check-row[data-row-id="water-runs-sized"] .rule-chip[data-rule="plumb.water.velocity"]').count()).toBe(1);
    expect(await page.locator('#bidCheckList .bid-check-row[data-row-id="water-service-min"] .rule-chip[data-rule="plumb.water.service-min"]').count()).toBe(1);
    // a 1/2 in stub off the main to a second water closet: over the cap and under the closet's 1 in
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'tiny', name: '1/2in Copper CW', color: '#2e86de', curveStyle: 'straight' });
      const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      ann.counterMarkers.wc.push({ x: 100, y: 210 });
      ann.quickLines.push({ id: 'tiny', x1: 100, y1: 100, x2: 100, y2: 200, color: '#2e86de', lineTypeId: 'tiny', group: null });
      window.App.updateUI();
    });
    r = await rows(page);
    expect(r.auto[0]).toEqual({ id: 'water-runs-sized', verdict: 'warn', detail: 'Quick line (1/2in Copper CW): 37.1 ft/s over 8 → 1-1/4 in ⚠' });
    expect(r.auto[1]).toEqual({ id: 'water-fixture-min', verdict: 'warn', detail: 'Quick line (1/2in Copper CW) on 1/2 in; a water closet valve needs 1 in ⚠' });
    // a lone 1/2 in cold run no run feeds, with its own fixture: the service end is under 3/4 in
    await page.evaluate(() => {
      const s = window.state; const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      ann.quickLines.push({ id: 'stub', x1: 500, y1: 300, x2: 600, y2: 300, color: '#2e86de', lineTypeId: 'tiny', group: null });
      ann.counterMarkers.lav.push({ x: 550, y: 310 });
      window.App.updateUI();
    });
    r = await rows(page);
    expect(r.auto[4].verdict).toBe('warn');
    expect(r.auto[4].detail).toContain('Quick line (1/2in Copper CW) starts the cold side at 1/2 in; the service is never under 3/4 in ⚠');
    // the sheet loses its scale: the water sheet row warns and names it
    await page.evaluate(() => { const s = window.state; s.pages[s.currentPage].scale = null; window.App.updateUI(); });
    r = await rows(page);
    expect(r.auto[3].verdict).toBe('warn');
    expect(r.auto[3].detail).toMatch(/has water runs but no scale ⚠$/);
    await page.evaluate(() => { const s = window.state; s.pages[s.currentPage].scale = { pixelsPerUnit: 9, unit: 'ft' }; window.App.updateUI(); });
    // a manual tick persists in the project data and counts
    const before = (await rows(page)).open;
    await page.click('#bidCheckList .bid-check-row[data-row-id="water-pressure"] .bid-check-box');
    r = await rows(page);
    expect(r.manual.find((x) => x.id === 'water-pressure').done).toBe(true);
    expect(r.open.manual).toBe(before.manual - 1);
    expect(await page.evaluate(() => window.state.bidCheck.manual['water-pressure'])).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the gate arms on water alone: the badge, the toast on Export PDFs and Copy to /Tooling, Review, Export anyway remembered', async ({ page }) => {
    await load(page);
    // a water run with a stray fixture and no duct anywhere
    await page.evaluate(() => {
      const s = window.state; const icon = window.App.getOrderedIcons()[0].value;
      s.lineTypes.push({ id: 'cw', name: '1.5in Copper CW', color: '#2e86de', curveStyle: 'straight' });
      s.counters.push({ id: 'lav', name: 'L-1 Lavatory', icon, color: '#4a9eff', wsfu: 2, wsfuFixture: 'lavatory' });
      const ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      ann.quickLines = ann.quickLines || [];
      ann.quickLines.push({ id: 'cmain', x1: 50, y1: 100, x2: 400, y2: 100, color: '#2e86de', lineTypeId: 'cw', group: null });
      ann.counterMarkers.lav = [{ x: 200, y: 110 }, { x: 500, y: 400 }];   // the second is a stray on both sides
      window.App.renderAnnotations(); window.App.updateUI();
    });
    expect(await page.evaluate(() => window.App.hasDuctRuns())).toBe(false);
    expect(await page.evaluate(() => window.App.hasWaterRuns())).toBe(true);
    const status = await page.evaluate(() => { const c = window.App.getBidCheck(); return { warn: c.auto.filter((r) => r.verdict === 'warn').map((r) => r.id), unticked: c.manual.filter((r) => !r.done).length, firstShort: (c.auto.find((r) => r.verdict === 'warn') || c.manual.find((r) => !r.done)).short || null }; });
    expect(status.warn).toContain('water-fixtures-served');
    await expect(page.locator('#forPipeTooling .bid-gate-badge')).toHaveText(status.warn.length + ' ⚠ · ' + status.unticked + ' unchecked');
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveText(status.warn.length + ' ⚠ · ' + status.unticked + ' unchecked');
    // Export PDFs → the toast, the modal not opened; Review flashes the first open row
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    const toast = (await page.locator('#bidGateToastText').textContent()) || '';
    expect(toast).toMatch(/^Bid Check: .+\?$/);
    await expect(page.locator('#specificPagesModal')).not.toHaveClass(/visible/);
    await page.click('#bidGateReview');
    await expect(page.locator('#bidGateToastModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#bidCheckList .bid-check-row.bid-check-flash')).toHaveCount(1);
    // make the water row the first ⚠ by resolving what sits above it: hangers on the copper type
    await page.evaluate(() => { window.state.lineTypes.find((l) => l.id === 'cw').childCounts = [{ name: 'Hanger', qty: 1, per: 'ft', intervalIn: 72, ruleId: 'plumb.hanger.copper' }]; window.App.updateUI(); });
    const first = await page.evaluate(() => { const c = window.App.getBidCheck(); return c.auto.find((r) => r.verdict === 'warn').id; });
    expect(first).toBe('water-fixtures-served');
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastText')).toHaveText('Bid Check: Every fixture served?');
    // Export anyway proceeds and is remembered: Copy to /Tooling goes through silently with the same set
    await page.click('#bidGateExportAnyway');
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await page.click('#specificPagesCancel');
    expect(await page.evaluate(() => Array.isArray(window.state.bidCheck.acknowledgedGate.rows) && window.state.bidCheck.acknowledgedGate.rows.some((r) => r.id === 'water-fixtures-served'))).toBe(true);
    await page.click('#forPipeTooling');
    await expect(page.locator('#bidGateToastModal.visible')).toHaveCount(0);
    // the set changes (the stray is rescued onto the main): the gate re-arms for the next export
    await page.evaluate(() => { const ann = window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]); ann.counterMarkers.lav[1].waterRuns = { cold: 'cmain' }; window.App.updateUI(); });
    const after = await page.evaluate(() => window.App.getBidCheck().auto.find((r) => r.id === 'water-fixtures-served'));
    // no hot run was laid, so both lavatories' hot sides are still strays; only the rescued cold side left the list
    expect(after.detail).toBe('2 sides no run serves: L-1 Lavatory hot ×2 · right-click a fixture for Attach to nearest run ⚠');
    // the same rows are still the unresolved set (a detail changed, not the set): the memory holds
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal.visible')).toHaveCount(0);
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await page.click('#specificPagesCancel');
    // the set changes (the sheet loses its scale: a new ⚠ row): the gate re-arms
    await page.evaluate(() => { const s = window.state; s.pages[s.currentPage].scale = null; window.App.updateUI(); });
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await expect(page.locator('#specificPagesModal')).not.toHaveClass(/visible/);
    await page.click('#bidGateReview');
  });
});

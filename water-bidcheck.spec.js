// @ts-check
/**
 * The water rows of Bid Check and the export gate (WATER-PLAN.md rung 6,
 * features/water-bidcheck.js). Guards: with no water run the panel carries no
 * water row; with one, the five auto rows judge the schedule (over the cap
 * naming the passing size, the supply minimum, the strays, the service, the
 * scale) with their § chips, the four manual rows tick into
 * state.bidCheck.manual, the open count counts them; the Copy to /Tooling and
 * Export PDFs badge and the "Review · Export anyway" toast serve a project
 * with water and no duct; the report's Bid Check block carries the rows.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function load(page) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft' }; window.state.pages[1].scale = { pixelsPerUnit: 12, unit: 'ft' }; });
  await page.evaluate(() => window.App.rulesReady());
}

test.describe('Water rows of Bid Check (rung 6)', () => {
  test('the rows, the ticks, the badge, the gate toast, the report', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    await page.evaluate(() => { window.state.trade = 'plumbing'; window.state.bidCheckCollapsed = false; window.App.updateUI(); });
    // no water run: no water rows, no gate
    expect(await page.evaluate(() => window.App.getBidCheck().auto.map((r) => r.id).filter((id) => id.startsWith('water-')))).toEqual([]);
    expect(await page.evaluate(() => window.App.getWaterBidCheck())).toBeNull();
    await expect(page.locator('#forPipeTooling .bid-gate-badge')).toHaveCount(0);
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'lt-cold', name: '3/4in PEX cold', color: '#4a9eff', curveStyle: 'straight', waterSide: 'cold' });
      s.lineTypes.push({ id: 'lt-svc', name: '1/2in PEX cold', color: '#2266aa', curveStyle: 'straight', waterSide: 'cold' });
      s.counters.push({ id: 'c-lav', name: 'Lavatory', icon: 'M0 0h10v10H0z', color: '#47c88e', wsfu: 2 });
      s.counters.push({ id: 'c-wc', name: 'WC flush valve', icon: 'M0 0h10v10H0z', color: '#a47fff', wsfu: 10 });
      const ann = s.pages[0].canvases[0].annotations;
      ann.quickLines.push({ id: 'q-cold', name: 'Cold main', lineTypeId: 'lt-cold', color: '#4a9eff', x1: 100, y1: 200, x2: 400, y2: 200 });
      ann.quickLines.push({ id: 'q-svc', name: 'Service', lineTypeId: 'lt-svc', color: '#2266aa', x1: 20, y1: 200, x2: 90, y2: 200 });
      ann.counterMarkers['c-lav'] = [{ x: 150, y: 210 }, { x: 200, y: 210 }, { x: 380, y: 600 }];
      ann.counterMarkers['c-wc'] = [{ x: 300, y: 205 }];
      window.App.updateUI();
    });
    const check = await page.evaluate(() => window.App.getBidCheck());
    const by = Object.fromEntries(check.auto.map((r) => [r.id, r]));
    // the WC's 10 at valves + 2 lav cold (1.5 each) = 13 WSFU → 29.4 gpm → 3/4 in PEX at 26.7 fps ⚠ → 1-1/2″ (7.8 fps);
    // the main taps off the service (its first vertex 10 pt from the service's end), so the service carries the same load on 1/2 in; the WC wants a 1 in supply
    expect(by['water-runs-sized'].verdict).toBe('warn');
    expect(by['water-runs-sized'].detail).toContain('Cold main (cold): 3/4″ at 26.7 fps ⚠ → 1-1/2″');
    expect(by['water-runs-sized'].detail).toContain('Service (cold): 1/2″ at 53.2 fps ⚠ → 1-1/2″');
    expect(by['water-supply-min'].verdict).toBe('warn');
    expect(by['water-supply-min'].detail).toContain('WC flush valve on Cold main (3/4″); needs 1″ ⚠');
    expect(by['water-fixtures-served'].verdict).toBe('warn');
    expect(by['water-fixtures-served'].detail).toContain('Lavatory, hot ×3: no hot run within reach');
    expect(by['water-fixtures-served'].detail).toContain('Lavatory, cold: no cold run within reach');
    expect(by['water-service-min'].verdict).toBe('warn');
    expect(by['water-service-min'].detail).toContain('Service 1/2″ is under 3/4″ ⚠');
    expect(by['water-sheets-scaled'].verdict).toBe('ok');
    expect(check.manual.filter((r) => r.trade === 'water').map((r) => r.id)).toEqual(['water-pressure-checked', 'water-backflow', 'water-heater-sized', 'water-recirc']);
    // the panel: rows with their § chips; a tick lands in state.bidCheck.manual and the count follows
    await expect(page.locator('#bidCheckList .bid-check-row[data-row-id="water-runs-sized"]')).toHaveClass(/warn/);
    await expect(page.locator('#bidCheckList .bid-check-row[data-row-id="water-runs-sized"] .rule-chip')).toHaveAttribute('data-rule', 'plumb.water.velocity');
    await expect(page.locator('#bidCheckList .bid-check-row[data-row-id="water-service-min"] .rule-chip')).toHaveAttribute('data-rule', 'plumb.water.distribution-min');
    const openBefore = check.open.total;
    await page.locator('#bidCheckList .bid-check-row[data-row-id="water-backflow"] .bid-check-box').dispatchEvent('click');
    expect(await page.evaluate(() => window.state.bidCheck.manual['water-backflow'])).toBe(true);
    expect(await page.evaluate(() => window.App.getBidCheck().open.total)).toBe(openBefore - 1);
    // the gate serves water with no duct: the badge, the toast on Export PDFs, Review flashes the first ⚠ row
    // the four water ⚠ rows plus plumbing's own hangers row; the water manual rows join the unchecked count
    await expect(page.locator('#forPipeTooling .bid-gate-badge')).toHaveText(/^5 ⚠ · \d+ unchecked$/);
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await expect(page.locator('#bidGateToastText')).toContainText('Bid Check:');
    await expect(page.locator('#specificPagesModal')).not.toHaveClass(/visible/);
    await page.click('#bidGateReview');
    await expect(page.locator('#bidGateToastModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#bidCheckList .bid-check-row.bid-check-flash')).toHaveCount(1);
    // Export anyway proceeds
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await page.click('#bidGateExportAnyway');
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await page.click('#specificPagesCancel');
    // the report's Bid Check block carries the water rows
    const html = await page.evaluate(() => window.buildReportHtml());
    expect(html).toContain('Every water run sized for its fixture units');
    expect(html).toContain('Water service at least 3/4″');
    // sizing both at 2 in clears every row: the service is over 3/4 in, the velocity passes, the WC's 1 in minimum is met
    await page.evaluate(() => { window.state.lineTypes[1].name = '2in PEX service cold'; window.state.lineTypes[0].name = '2in PEX cold'; window.App.updateUI(); });
    const after = await page.evaluate(() => window.App.getBidCheck());
    const byA = Object.fromEntries(after.auto.map((r) => [r.id, r]));
    expect(byA['water-service-min'].verdict).toBe('ok');
    expect(byA['water-runs-sized'].verdict).toBe('ok');
    expect(byA['water-supply-min'].verdict).toBe('ok');
    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * The Water Sizing schedule (WATER-PLAN.md rung 5, features/water-schedule.js).
 * Guards: the opener shows once a line type has a water side; the modal lists
 * one row per water run with its size, the fixture units it carries at its
 * head (branches included), the flow in the column its fixtures call for, the
 * velocity at that size and the check (over the cap → the passing size; under
 * a served fixture's supply minimum; no size in the name); the side totals and
 * the fixtures no run reaches; the velocity-cap knobs re-check live and stick
 * on state.waterSettings; the occupancy segment writes the codes blob; Copy
 * Schedule writes the tab-separated text; Show Report carries the table and
 * Copy Summary / Copy to /Tooling the "--- Water sizing ---" block; the caps
 * ride hydrate and the takeoff backup.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function load(page) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft' }; window.state.pages[1].scale = { pixelsPerUnit: 12, unit: 'ft' }; });
  await page.evaluate(() => window.App.rulesReady());
}

test.describe('Water Sizing schedule (rung 5)', () => {
  test('rows, checks, totals, the unreached, the knobs, copy, report, hydrate', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await load(page);
    await expect(page.locator('#waterScheduleBtn')).toBeHidden();
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'lt-cold', name: '3/4in PEX cold', color: '#4a9eff', curveStyle: 'straight', waterSide: 'cold' });
      s.lineTypes.push({ id: 'lt-hot', name: '1/2in PEX hot', color: '#e85447', curveStyle: 'straight', waterSide: 'hot' });
      s.lineTypes.push({ id: 'lt-nosize', name: 'PEX cold', color: '#888', curveStyle: 'straight', waterSide: 'cold' });
      s.counters.push({ id: 'c-lav', name: 'Lavatory', icon: 'M0 0h10v10H0z', color: '#47c88e', wsfu: 2 });
      s.counters.push({ id: 'c-wc', name: 'WC flush valve', icon: 'M0 0h10v10H0z', color: '#a47fff', wsfu: 10 });
      const ann = s.pages[0].canvases[0].annotations;
      // the cold main (y 200), a cold branch tapped off it at x 300 running down, the hot main (y 230)
      ann.quickLines.push({ id: 'q-cold', name: 'Cold main', lineTypeId: 'lt-cold', color: '#4a9eff', x1: 100, y1: 200, x2: 400, y2: 200 });
      ann.polylines.push({ id: 'p-branch', name: 'Branch', lineTypeId: 'lt-nosize', color: '#888', closed: false, points: [{ x: 300, y: 205 }, { x: 300, y: 320 }] });
      ann.polylines.push({ id: 'p-hot', name: 'Hot main', lineTypeId: 'lt-hot', color: '#e85447', closed: false, points: [{ x: 100, y: 230 }, { x: 400, y: 230 }] });
      // three lavatories between the mains (10 from cold, 20 from hot: cold attaches, hot does not), a flush-valve WC on the branch, a lavatory far away
      ann.counterMarkers['c-lav'] = [{ x: 150, y: 210 }, { x: 200, y: 210 }, { x: 250, y: 210 }, { x: 380, y: 600 }];
      ann.counterMarkers['c-wc'] = [{ x: 305, y: 300 }];
      window.App.updateUI();
    });
    await expect(page.locator('#waterScheduleBtn')).toBeVisible();
    const s = await page.evaluate(() => window.App.computeWaterSchedule({}));
    const byId = Object.fromEntries(s.rows.map((r) => [r.runId, r]));
    // the cold main carries its three lavatories (4.5) and the branch's flush-valve WC (10): 14.5 WSFU at valves → 30.6 gpm, 3/4 in PEX runs 27.8 fps
    expect(byId['q-cold'].wsfu).toBe(14.5);
    expect(byId['q-cold'].fixtures).toBe(4);
    expect(byId['q-cold'].column).toBe('flush-valve');
    expect(byId['q-cold'].gpm).toBe(30.6);
    expect(byId['q-cold'].over).toBe(true);
    expect(byId['q-cold'].suggestLabel).toBe('2″');
    // the branch's type has no size: unsized, never ✓, and the WC's 1 in supply minimum is noted on it
    expect(byId['p-branch'].unsized).toBe(true);
    expect(byId['p-branch'].supplyMinIn).toBe(1);
    // the hot main reaches nothing (the lavatories' hot side is 20 away, past the snap): 0 WSFU, fine at any size
    expect(byId['p-hot'].wsfu).toBe(0);
    expect(byId['p-hot'].ok).toBe(true);
    expect(s.totals.cold).toEqual({ wsfu: 14.5, fixtures: 4, runs: 2, warn: 1, unsized: 1 });
    expect(s.totals.hot).toEqual({ wsfu: 0, fixtures: 0, runs: 1, warn: 0, unsized: 0 });
    // not reached: the lavatories' hot sides (four of them) and the far lavatory's cold side
    expect(s.unserved.map((u) => [u.counterName, u.side, u.count, u.wsfu]).sort()).toEqual([['Lavatory', 'cold', 1, 1.5], ['Lavatory', 'hot', 4, 6]]);
    expect(s.capFps).toEqual({ cold: 8, hot: 5 });
    // the modal
    await page.locator('#waterScheduleBtn').click();
    await expect(page.locator('#waterScheduleModal')).toHaveClass(/visible/);
    const body = page.locator('#waterScheduleBody');
    await expect(body).toContainText('Cold water');
    await expect(body).toContainText('14.5 WSFU · 2 runs · 1 ⚠');
    await expect(body).toContainText('Cold main');
    await expect(body).toContainText('⚠ over 8 fps → 2″');
    await expect(body).toContainText('no size in the name');
    await expect(body).toContainText('Hot water');
    await expect(body).toContainText('Lavatory, hot ×4 · 6 WSFU: no hot run within reach');
    await expect(page.locator('#waterScheduleFoot')).toContainText('Sized at 8 fps cold / 5 fps hot');
    await expect(page.locator('#waterScheduleScope')).toBeVisible();   // two pages
    await expect(page.locator('#waterScheduleOccupancy button[data-occupancy="public"]')).toHaveAttribute('aria-pressed', 'true');
    // the cold cap knob re-checks live and sticks on the project
    await page.locator('#waterCapCold').fill('30');
    await page.locator('#waterCapCold').dispatchEvent('change');
    await expect(body).not.toContainText('⚠ over');
    expect(await page.evaluate(() => window.state.waterSettings)).toEqual({ capFps: { cold: 30, hot: 5 } });
    expect(await page.evaluate(() => window.App.getAutoSaveDirty())).toBe(true);
    await page.locator('#waterCapCold').fill('8');
    await page.locator('#waterCapCold').dispatchEvent('change');
    await expect(body).toContainText('⚠ over 8 fps → 2″');
    // the occupancy segment writes the codes blob (one writer) and the schedule follows
    await page.locator('#waterScheduleOccupancy button[data-occupancy="private"]').click();
    expect(await page.evaluate(() => window.App.getProjectCodes().occupancy)).toBe('private');
    await expect(page.locator('#waterScheduleFoot')).toContainText('read the private column');
    await page.locator('#waterScheduleOccupancy button[data-occupancy="public"]').click();
    // Copy Schedule: the tab-separated text
    await page.locator('#waterScheduleCopy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.split('\n')[0]).toBe('Water sizing');
    expect(copied).toContain('Cold · Cold main (3/4in PEX cold)\t3/4″\t14.5 WSFU · 4 fixtures\t30.6 gpm\t27.8 fps\t⚠ over 8 fps → 2″');
    expect(copied).toContain('Cold water total\t\t14.5 WSFU · 4 fixtures\t\t\t1 ⚠');
    expect(copied).toContain('Not reached · Lavatory, hot ×4\t\t6 WSFU\t\t\t⚠ no hot run within reach');
    await expect(page.locator('#airboardToastText')).toContainText('Water sizing copied: 3 runs, 1 ⚠');
    await page.locator('#waterScheduleClose').click();
    await expect(page.locator('#waterScheduleModal')).not.toHaveClass(/visible/);
    // the report table and the handoff block
    const html = await page.evaluate(() => window.buildReportHtml());
    expect(html).toContain('Water Sizing');
    expect(html).toContain('Cold · Cold main (3/4in PEX cold)');
    expect(html).toContain('⚠ over 8 fps → 2″');
    const tooling = await page.evaluate(() => window.getPipeToolingSummary());
    expect(tooling).toContain('--- Water sizing ---');
    expect(tooling).toContain('Cold · Cold main (3/4in PEX cold)\t3/4″');
    const email = await page.evaluate(() => window.getEmailTextSummary());
    expect(email).toContain('--- Water sizing ---');
    // the paste summary reads the block as its own unit
    expect(await page.evaluate((t) => window.App.formatToolingExportSummary ? window.App.formatToolingExportSummary(window.App.summarizeToolingExport(t)) : null, tooling)).toBeNull();
    // the caps ride hydrate and the takeoff backup, normalized
    await page.evaluate(() => window.App.hydrateStateFromProjectData({ counters: [], lineTypes: [], groups: [], waterSettings: { capFps: { cold: 6, hot: 'x' } } }));
    expect(await page.evaluate(() => window.state.waterSettings)).toEqual({ capFps: { cold: 6, hot: 5 } });
    await page.evaluate(() => window.App.applyTakeoffBackupToState({ counters: [], lineTypes: [], waterSettings: { capFps: { cold: 7, hot: 4 } } }));
    expect(await page.evaluate(() => window.state.waterSettings)).toEqual({ capFps: { cold: 7, hot: 4 } });
    // a project with no water-sided type hides the opener again
    await page.evaluate(() => { window.state.lineTypes = []; window.App.updateUI(); });
    await expect(page.locator('#waterScheduleBtn')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

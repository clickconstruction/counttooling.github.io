// @ts-check
/**
 * Electrical, First-Class S5 — Bid Check.
 *
 * Guards: the sidebar section is collapsed by default with the open-item
 * count on its header; an electrical project gets the four auto rows with
 * their work shown (conduit fill with the upsize, voltage drop to the farthest
 * device with the gauge that passes, circuits vs the panel schedule, devices
 * on circuits) plus the electrical manual rows; a plumbing project gets only
 * the trade-neutral manual rows; ticks persist in state.bidCheck; the
 * voltage-drop defaults are editable; the report, the email text and the
 * payload carry the check; the advisory toast shows after a copy when the app
 * itself found something, and never blocks the copy.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function seed(page, trade) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate((trade) => {
    const HOT = (n, g) => ({ n, gauge: g, insul: 'THHN', role: 'hot' });
    const GND = (g) => ({ n: 1, gauge: g, insul: 'THHN', role: 'ground' });
    const s = window.state;
    s.trade = trade;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    s.groups.push({ id: 'g7', name: 'Open office receptacles', color: '#c8963a', panel: 'LP-1', circuit: '7' });
    s.groupsEnabled = true;
    s.counters.push({ id: 'recep', name: 'Duplex Receptacle', icon: 'M96 96h448v448H96z', color: '#e85447' });
    s.counters.push({ id: 'panel', name: 'Panel LP-1', icon: 'M96 96h448v448H96z', color: '#6b6b6b', panelName: 'LP-1', poles: 42 });
    // 1/2" EMT carrying 10 #12: fill 43.8% ⚠ → 3/4" 25% ✓
    s.lineTypes.push({ id: 'emt', name: '1/2" EMT', color: '#8a4bb0', raceway: { kind: 'EMT', size: '1/2"' }, conductors: [HOT(9, '#12'), GND('#12')] });
    const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
    ann.counterMarkers.panel = [{ x: 0, y: 100, id: 'pm', group: null }];
    // 112 ft to the farthest device: 1344 px at 12 px/ft
    ann.counterMarkers.recep = [{ x: 1344, y: 100, id: 'r1', group: 'g7' }, { x: 600, y: 600, id: 'r2', group: null }];
    ann.quickLines.push({ x1: 0, y1: 100, x2: 1344, y2: 100, id: 'q1', lineTypeId: 'emt', color: '#8a4bb0', group: 'g7' });
    window.App.updateUI();
  }, trade);
}

test.describe('Electrical, First-Class S5 — Bid Check', () => {
  test('electrical: the four auto rows show their work; manual ticks persist; the surfaces carry the check', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await seed(page, 'electrical');
    expect(await page.evaluate(() => typeof window.App?.getBidCheck)).toBe('function');

    const bc = await page.evaluate(() => window.App.getBidCheck());
    const byId = Object.fromEntries(bc.auto.map((r) => [r.id, r]));
    expect(byId['conduit-fill'].verdict).toBe('warn');
    expect(byId['conduit-fill'].detail).toContain('1/2" EMT · 9 #12 THHN + 1 #12 THHN G · 43.8% ⚠ → 3/4" EMT 25% ✓');
    expect(byId['voltage-drop'].verdict).toBe('warn');
    expect(byId['voltage-drop'].detail).toContain('LP-1/7 · 112 ft · 12 A · #12 4.4% ⚠ → #10 2.8% ✓');
    expect(byId['circuits-vs-panel'].detail).toBe('LP-1 · 1 on plan · 42 scheduled ⚠');
    expect(byId['devices-on-circuits'].detail).toBe('1 device on no circuit');
    expect(bc.manual.length).toBe(8);
    expect(bc.open).toEqual({ auto: 4, manual: 8, total: 12 });

    // sidebar: collapsed by default, badge counts, expand shows rows
    expect(await page.locator('#bidCheckSection').isVisible()).toBe(true);
    expect(await page.locator('#bidCheckBadge').textContent()).toBe('12');
    expect(await page.locator('#bidCheckList').isVisible()).toBe(false);
    await page.click('#bidCheckSectionTitle');
    expect(await page.locator('#bidCheckList').isVisible()).toBe(true);
    expect(await page.locator('#bidCheckList .bid-check-row.auto').count()).toBe(4);
    expect(await page.locator('#bidCheckList .bid-check-row.manual').count()).toBe(8);
    // tick a manual row: persists in state and drops the count
    await page.click('#bidCheckList .bid-check-box[data-id="addenda"]');
    expect(await page.evaluate(() => window.state.bidCheck.manual.addenda)).toBe(true);
    expect(await page.locator('#bidCheckBadge').textContent()).toBe('11');
    await page.click('#bidCheckList .bid-check-box[data-id="addenda"]');
    expect(await page.evaluate(() => 'addenda' in window.state.bidCheck.manual)).toBe(false);
    // voltage-drop defaults: a 20 A load makes the drop worse; 277 V makes it pass
    await page.fill('#bidCheckLoadAmps', '20');
    await page.press('#bidCheckLoadAmps', 'Enter');
    expect(await page.evaluate(() => window.state.bidCheck.loadAmps)).toBe(20);
    expect(await page.evaluate(() => window.App.getBidCheck().auto.find((r) => r.id === 'voltage-drop').detail)).toContain('20 A · #12 7.4% ⚠');
    // 277 V still fails at 20 A over 112 ft on #12 (3.2%); 480 V passes (1.8%)
    await page.fill('#bidCheckVolts', '277');
    await page.press('#bidCheckVolts', 'Enter');
    expect(await page.evaluate(() => window.App.getBidCheck().auto.find((r) => r.id === 'voltage-drop').detail)).toContain('#12 3.2% ⚠');
    await page.fill('#bidCheckVolts', '480');
    await page.press('#bidCheckVolts', 'Enter');
    expect(await page.evaluate(() => window.App.getBidCheck().auto.find((r) => r.id === 'voltage-drop').verdict)).toBe('ok');

    // report, email, payload
    const html = await page.evaluate(() => window.buildReportHtml({}));
    expect(html).toContain('Bid Check');
    expect(html).toContain('Conduit fill within the table limit');
    const email = await page.evaluate(() => window.getEmailTextSummary());
    expect(email).toContain('--- Bid Check (');
    expect(email).toContain('⚠ Conduit fill within the table limit: 1/2" EMT');
    const payload = await page.evaluate(() => window.getTakeoffToolingPayload());
    expect(payload.checks.find((c) => c.id === 'conduit-fill').verdict).toBe('warn');
    expect(payload.checks.find((c) => c.id === 'addenda').verdict).toBe('open');
    expect(errors).toEqual([]);
  });

  test('plumbing: only the trade-neutral manual rows, no auto rows, no advisory; the advisory shows after an electrical copy and never blocks it', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await seed(page, 'plumbing');
    const bc = await page.evaluate(() => window.App.getBidCheck());
    expect(bc.auto).toEqual([]);
    expect(bc.manual.map((r) => r.id)).toEqual(['scope-vs-drawings', 'addenda', 'scale-verified']);
    expect(await page.locator('#bidCheckBadge').textContent()).toBe('3');
    // no advisory when nothing is at ⚠
    await page.evaluate(() => window.App.showBidCheckAdvisory('copy'));
    expect(await page.locator('#bidCheckAdvisoryModal.visible').count()).toBe(0);

    // electrical: a gated copy runs AND the advisory shows afterwards
    await page.evaluate(() => { window.state.trade = 'electrical'; window.App.updateUI(); });
    const ran = await page.evaluate(async () => {
      let copied = false;
      await window.App.runGatedCopy(null, [0], async () => { copied = true; }, 'copy', 'all');
      return copied;
    });
    expect(ran).toBe(true);
    await page.waitForSelector('#bidCheckAdvisoryModal.visible', { timeout: 3000 });
    expect(await page.locator('#bidCheckAdvisoryText').textContent()).toContain('Bid Check has 4 open items');
    // Review opens the section
    await page.click('#bidCheckAdvisoryReview');
    expect(await page.locator('#bidCheckList').isVisible()).toBe(true);
    expect(await page.locator('#bidCheckAdvisoryModal.visible').count()).toBe(0);
    expect(errors).toEqual([]);
  });
});

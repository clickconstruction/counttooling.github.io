// @ts-check
/**
 * Electrical, First-Class S4 — circuits.
 *
 * Guards: a group with a panel tag is a circuit — the schedule lists its
 * devices, conduit / homerun / wire feet and the farthest device along the
 * runs from the panel mark (or from the homerun's far end when no panel mark
 * touches the runs); the panel cross-check compares circuits on plan with the
 * panel counter's poles; the Chain tool inherits the group of the run it
 * continues; the group modal, the counter's Panel fields, the line type's and
 * the run's Homerun toggles write the fields; the sidebar shows the tag and the
 * cross-check; the report, the email text and the TakeoffTooling payload carry
 * the schedule; a plumbing project without tags sees none of it.
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
    s.groups.push({ id: 'g7', name: 'Open office receptacles', color: '#c8963a', panel: 'LP-1', circuit: '7', loadAmps: 12 });
    s.groups.push({ id: 'g1', name: 'Lighting 104', color: '#3a6fc8', panel: 'LP-1', circuit: '1' });
    s.groupsEnabled = true;
    s.counters.push({ id: 'recep', name: 'Duplex Receptacle', icon: 'M96 96h448v448H96z', color: '#e85447', mountHeightIn: 18 });
    s.counters.push({ id: 'panel', name: 'Panel LP-1', icon: 'M96 96h448v448H96z', color: '#6b6b6b', panelName: 'LP-1', poles: 42 });
    s.lineTypes.push({ id: 'emt', name: '3/4" EMT', color: '#8a4bb0', raceway: { kind: 'EMT', size: '3/4"' }, conductors: [HOT(3, '#12'), GND('#12')] });
    s.lineTypes.push({ id: 'hr', name: 'Homerun', color: '#8a4bb0', homerun: true, raceway: { kind: 'EMT', size: '3/4"' }, conductors: [HOT(3, '#12'), GND('#12')] });
    const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
    // panel at (0,100); homerun panel→(120,100) 10 ft; branch (120,100)→(240,100) 10 ft → (240,220) 10 ft
    ann.counterMarkers.panel = [{ x: 0, y: 100, id: 'pm', group: null }];
    ann.counterMarkers.recep = [{ x: 120, y: 100, id: 'r1', group: 'g7' }, { x: 240, y: 100, id: 'r2', group: 'g7' }, { x: 240, y: 220, id: 'r3', group: 'g7' }, { x: 900, y: 900, id: 'r4', group: 'g7' }];
    ann.quickLines.push({ x1: 0, y1: 100, x2: 120, y2: 100, id: 'q-hr', lineTypeId: 'hr', color: '#8a4bb0', group: 'g7' });
    ann.quickLines.push({ x1: 120, y1: 100, x2: 240, y2: 100, id: 'q-a', lineTypeId: 'emt', color: '#8a4bb0', group: 'g7' });
    ann.quickLines.push({ x1: 240, y1: 100, x2: 240, y2: 220, id: 'q-b', lineTypeId: 'emt', color: '#8a4bb0', group: 'g7', endDrop: 5, endDropUnit: 'ft' });
    window.App.updateUI();
  }, trade);
}

test.describe('Electrical, First-Class S4 — circuits', () => {
  test('the schedule: devices, feet, farthest device from the panel, and the cross-check — on every surface', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await seed(page, 'electrical');
    expect(await page.evaluate(() => typeof window.App?.getCircuitSchedule)).toBe('function');

    const sched = await page.evaluate(() => window.App.getCircuitSchedule());
    expect(sched.panels.length).toBe(1);
    expect(sched.panels[0].panel).toBe('LP-1');
    const c7 = sched.panels[0].circuits.find((c) => c.circuit === '7');
    expect(c7.tag).toBe('LP-1/7');
    expect(c7.devices).toEqual([{ name: 'Duplex Receptacle', count: 4 }]);
    // 10 ft homerun apart; branch 10 + (10 + 5 drop) = 25 ft conduit; wire 4 conductors × 35 ft = 140
    expect([c7.homerunFt, c7.conduitFt, c7.wireFt]).toEqual([10, 25, 140]);
    // farthest device along the runs from the panel mark: 10 + 10 + 15 = 35 ft; one device sits off the runs
    expect([c7.farthestFt, c7.farthestFrom, c7.devicesOffRuns]).toEqual([35, 'panel', 1]);
    expect(c7.loadAmps).toBe(12);
    // the empty circuit still lists
    expect(sched.panels[0].circuits.find((c) => c.circuit === '1').deviceCount).toBe(0);
    // cross-check: circuits 1 and 7 on plan vs 42 poles
    expect(sched.crossCheck).toEqual([{ panel: 'LP-1', onPlan: 2, scheduled: 42, verdict: 'under' }]);

    // sidebar: the tag on the group row and the cross-check footer
    const groupRows = await page.locator('#groupsList .group-system-tag').allTextContents();
    expect(groupRows).toContain('LP-1/7 · 12 A');
    expect((await page.locator('#groupsList .panel-check-row').allTextContents())[0]).toContain('2 on plan · 42 scheduled ⚠');

    // report + email + payload
    const html = await page.evaluate(() => window.buildReportHtml({}));
    expect(html).toContain('Circuit schedule');
    expect(html).toContain('Panel LP-1');
    expect(html).toContain('35 ft');
    const email = await page.evaluate(() => window.getEmailTextSummary());
    expect(email).toContain('--- Circuits ---');
    expect(email).toContain('Panel LP-1: 2 circuits on plan, 42 scheduled ⚠');
    expect(email).toContain('• Ckt 7 · Open office receptacles: 4 devices, 25.00 ft conduit, 10.00 ft homerun, 140.00 ft wire, farthest device 35 ft');
    const payload = await page.evaluate(() => window.getTakeoffToolingPayload());
    expect(payload.circuits.find((c) => c.circuit === '7')).toEqual({ group: 'Open office receptacles', panel: 'LP-1', circuit: '7', load_amps: 12, devices: 4, conduit_ft: 25, homerun_ft: 10, wire_ft: 140, farthest_ft: 35 });
    expect(payload.panels).toEqual([{ panel: 'LP-1', circuits_on_plan: 2, poles: 42, verdict: 'under' }]);
    // no panel mark on the runs → measured from the homerun's far end instead
    await page.evaluate(() => { window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers.panel = []; });
    const s2 = await page.evaluate(() => window.App.getCircuitSchedule().panels[0].circuits.find((c) => c.circuit === '7'));
    expect([s2.farthestFt, s2.farthestFrom]).toEqual([35, 'homerun']);
    expect(errors).toEqual([]);
  });

  test('editors write the fields; the Chain tool inherits the circuit; plumbing hides it all', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await seed(page, 'electrical');

    // group modal: panel · circuit · load
    await page.evaluate(() => window.App.openGroupModal(null));
    await page.waitForSelector('#groupModal.visible');
    expect(await page.locator('#groupModalCircuitRow').isVisible()).toBe(true);
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('#panelNamesList option')).map((o) => o.value))).toEqual(['LP-1']);
    await page.fill('#groupModalName', 'Kitchen recept');
    await page.fill('#groupModalPanel', 'LP-2');
    await page.fill('#groupModalCircuit', '3');
    await page.fill('#groupModalLoadAmps', '16');
    await page.click('#groupModalDone');
    const g = await page.evaluate(() => window.state.groups[window.state.groups.length - 1]);
    expect([g.name, g.panel, g.circuit, g.loadAmps]).toEqual(['Kitchen recept', 'LP-2', '3', 16]);
    // clearing the tag deletes the fields
    await page.evaluate(() => window.App.openGroupModal(window.state.groups[window.state.groups.length - 1]));
    await page.fill('#groupModalPanel', '');
    await page.fill('#groupModalCircuit', '');
    await page.click('#groupModalDone');
    const g2 = await page.evaluate(() => window.state.groups[window.state.groups.length - 1]);
    expect(['panel' in g2, 'circuit' in g2, 'loadAmps' in g2]).toEqual([false, false, false]);

    // counter: panel name + poles
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters.find((c) => c.id === 'recep')));
    await page.waitForSelector('#counterLineTypeDetailsModal.visible');
    expect(await page.locator('#panelGroup').isVisible()).toBe(true);
    await page.fill('#panelName', 'LP-3');
    await page.fill('#panelPoles', '24');
    await page.press('#panelPoles', 'Enter');
    expect(await page.evaluate(() => { const c = window.state.counters.find((x) => x.id === 'recep'); return [c.panelName, c.poles]; })).toEqual(['LP-3', 24]);
    await page.fill('#panelName', '');
    await page.press('#panelName', 'Enter');
    expect(await page.evaluate(() => { const c = window.state.counters.find((x) => x.id === 'recep'); return ['panelName' in c, 'poles' in c]; })).toEqual([false, false]);
    await page.click('#counterLineTypeDetailsClose');

    // line type homerun toggle
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'emt')));
    await page.waitForSelector('#counterLineTypeDetailsModal.visible');
    expect(await page.locator('#homerunGroup').isVisible()).toBe(true);
    await page.click('#lineTypeHomerunBtn');
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'emt').homerun)).toBe(true);
    await page.click('#lineTypeHomerunBtn');
    expect(await page.evaluate(() => 'homerun' in window.state.lineTypes.find((l) => l.id === 'emt'))).toBe(false);
    await page.click('#counterLineTypeDetailsClose');

    // per-run homerun in Line Properties
    await page.evaluate(() => { const ann = window.App.getActiveAnnotations(window.state.pages[0]); window.App.openLinePropertiesModal({ type: 'quick', q: ann.quickLines.find((q) => q.id === 'q-a'), pageIdx: 0 }); });
    await page.waitForSelector('#linePropertiesModal.visible');
    expect(await page.locator('#linePropertiesHomerunGroup').isVisible()).toBe(true);
    await page.click('#linePropertiesHomerunBtn');
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).quickLines.find((q) => q.id === 'q-a').homerun)).toBe(true);
    await page.click('#linePropertiesHomerunBtn');
    expect(await page.evaluate(() => 'homerun' in window.App.getActiveAnnotations(window.state.pages[0]).quickLines.find((q) => q.id === 'q-a'))).toBe(false);
    await page.click('#linePropertiesClose');

    // Chain inherits the circuit of the run it continues when no group is active
    await page.evaluate(() => {
      const s = window.state;
      s.activeCounterType = 'recep'; s.activeLineTypeId = 'emt'; s.tool = window.App.TOOL.CHAIN;
      s.activeGroupId = 'g7'; window.App.commitChainPoint({ x: 500, y: 500 });
      s.activeGroupId = null; window.App.commitChainPoint({ x: 620, y: 500 }); window.App.commitChainPoint({ x: 740, y: 500 });
    });
    const chained = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return { marks: ann.counterMarkers.recep.slice(-3).map((m) => m.group), lines: ann.quickLines.slice(-2).map((q) => q.group) };
    });
    expect(chained).toEqual({ marks: ['g7', 'g7', 'g7'], lines: ['g7', 'g7'] });

    // plumbing project, plain group: none of the electrical rows
    await page.evaluate(() => { window.state.trade = 'plumbing'; window.App.openGroupModal(null); });
    expect(await page.locator('#groupModalCircuitRow').isVisible()).toBe(false);
    await page.click('#groupModalCancel');
    expect(errors).toEqual([]);
  });
});

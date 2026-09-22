// @ts-check
/**
 * Tests: the Bid Check's static-path AUTO row (DUCT-PLAN.md unit D11 — the
 * master's "will it blow?").
 *
 * - A system group gains `espInWg` (the unit's available external static)
 *   beside its capacity in the group modal — stored only when > 0, deleted
 *   otherwise, so groups without an ESP (and plain groups) keep their shape;
 *   it rides the project data like the other group fields.
 * - "Static path within unit ESP" stays a MANUAL checkbox until a system has
 *   an ESP AND a duct run; then it is AUTO with the critical path's work —
 *   duct-model's ductStaticPath over the tap network (straight LF incl.
 *   verticals + fittings' equivalent feet at the friction rate, + the
 *   terminal allowance) — "RTU-1: 0.15" of 0.80" ESP · critical path 62 eq
 *   ft (40' duct + 1 elbow + 1 tap + 1 VD @ 0.08"/100' + 0.10" terminal) ✓";
 *   over the ESP it is ⚠ and names the long leg + the size to upsize.
 *   Clearing the ESP drops it back to a checkbox (the roof-row rule).
 * - The system group's sidebar header carries "· 0.15" of 0.8" ESP" on the
 *   capacity line once the walk has an answer (⚠ + .over when over).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Duct static path (D11)', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
  });

  const bidCheck = (page) => page.evaluate(() => window.App.getBidCheck());
  const rowById = (bc, id) => bc.auto.find((r) => r.id === id) || bc.manual.find((r) => r.id === id);
  // getBidCheck's merged rows carry no `kind` — which list a row sits in says it.
  const kindOf = (bc, id) => (bc.auto.some((r) => r.id === id) ? 'auto' : bc.manual.some((r) => r.id === id) ? 'manual' : undefined);

  // A system's tree on page 0 (12 pdf units = 1'): a 30' 24×12 trunk east from
  // (100,100); "Branch 3" (8×6) taps it 20' along and runs 15' south then 5'
  // east (one 90° elbow). Critical path = 20' trunk + tap (10) + VD (2) +
  // 20' branch + elbow (10) = 62 eq ft over the 30' straight trunk.
  const seedSystemTree = (page, groupId) => page.evaluate((gid) => {
    const s = window.state;
    const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
    ann.ductRuns = [
      window.makeDuctRun({
        id: 'run-trunk', name: 'Trunk', airside: 'supply', pressureClass: '1', systemGroupId: gid,
        vertices: [{ x: 100, y: 100 }, { x: 460, y: 100 }],
        segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
      }),
      window.makeDuctRun({
        id: 'run-b3', name: 'Branch 3', airside: 'supply', pressureClass: '1',
        vertices: [{ x: 340, y: 100 }, { x: 340, y: 280 }, { x: 400, y: 280 }],
        segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 8, h: 6 } }],
      }),
    ];
    window.App.reinferDuctFittings(0);
    window.App.updateUI();
  }, groupId);

  test('group modal: ESP round-trips beside the capacity, stored only when positive; plain groups keep their shape', async ({ page }) => {
    // Create a system through the REAL modal with an ESP.
    await page.evaluate(() => { window.App.openGroupModal(null); });
    await page.locator('#groupModalName').fill('Roof unit 1');
    await page.locator('#groupModalEquipTag').fill('RTU-1');
    await page.locator('#groupModalCapacityCfm').fill('600');
    await expect(page.locator('#groupModalEspInWg')).toBeVisible();
    await page.locator('#groupModalEspInWg').fill('0.8');
    await page.locator('#groupModalDone').click();
    let g = await page.evaluate(() => JSON.parse(JSON.stringify(window.state.groups[0])));
    expect(g.equipmentTag).toBe('RTU-1');
    expect(g.capacityCfm).toBe(600);
    expect(g.espInWg).toBe(0.8);

    // Edit shows it back; the project data carries it (groups ride wholesale).
    await page.evaluate(() => { window.App.openGroupModal(window.state.groups[0]); });
    await expect(page.locator('#groupModalEspInWg')).toHaveValue('0.8');
    await page.locator('#groupModalCancel').click();
    const data = await page.evaluate(() => JSON.parse(JSON.stringify(window.App.buildCanvasExportData())));
    expect(data.groups[0].espInWg).toBe(0.8);

    // Clearing the field deletes the key (never null) — a D4-era system shape.
    await page.evaluate(() => { window.App.openGroupModal(window.state.groups[0]); });
    await page.locator('#groupModalEspInWg').fill('');
    await page.locator('#groupModalDone').click();
    g = await page.evaluate(() => JSON.parse(JSON.stringify(window.state.groups[0])));
    expect('espInWg' in g).toBe(false);
    expect(Object.keys(g).sort()).toEqual(['capacityCfm', 'color', 'equipmentTag', 'id', 'name', 'plenumReturn']);
    // Zero / junk is "no ESP" too.
    await page.evaluate(() => { window.App.openGroupModal(window.state.groups[0]); });
    await page.locator('#groupModalEspInWg').fill('0');
    await page.locator('#groupModalDone').click();
    expect(await page.evaluate(() => 'espInWg' in window.state.groups[0])).toBe(false);

    // A group with NO equipment tag stays exactly { id, name, color } even
    // with an ESP typed — the system fields are one block.
    await page.evaluate(() => { window.App.openGroupModal(null); });
    await page.locator('#groupModalName').fill('Plain');
    await page.locator('#groupModalEspInWg').fill('0.5');
    await page.locator('#groupModalDone').click();
    const plain = await page.evaluate(() => JSON.parse(JSON.stringify(window.state.groups[1])));
    expect(Object.keys(plain).sort()).toEqual(['color', 'id', 'name']);
    expect(errors).toEqual([]);
  });

  test('the static-path row: manual without ESP → auto with the critical path\'s number → ⚠ naming the long leg → manual again when the ESP clears; the system header carries the ESP fragment', async ({ page }) => {
    // A system with a capacity but no ESP, and its duct tree.
    await page.evaluate(() => {
      const s = window.state;
      s.groups.push({ id: 'g1', name: 'RTU-1', color: '#e05d5d', equipmentTag: 'RTU-1', capacityCfm: 600 });
      s.groupsEnabled = true;
    });
    await seedSystemTree(page, 'g1');
    let bc = await bidCheck(page);
    let row = rowById(bc, 'duct-static-path');
    expect(kindOf(bc, 'duct-static-path')).toBe('manual');
    expect(row.done).toBe(false);
    expect(await page.evaluate(() => window.App.getDuctSystemStaticPath('g1'))).toBe(null);
    // The header: capacity line only, no ESP text.
    await expect(page.locator('#groupsList .group-capacity-line')).toHaveText('0 designed / 600 capacity ✓');

    // Tick it while manual — the tick persists in the S5 map.
    await page.click('#bidCheckSectionTitle');
    const staticRow = page.locator('#bidCheckList .bid-check-row[data-row-id="duct-static-path"]');
    await expect(staticRow).toHaveClass(/manual/);
    await staticRow.locator('.bid-check-box').click();
    expect(await page.evaluate(() => window.state.bidCheck.manual['duct-static-path'])).toBe(true);
    await expect(staticRow).toHaveClass(/done/);

    // Set the ESP: AUTO, showing its work — the tick is ignored (the app knows).
    await page.evaluate(() => { window.state.groups[0].espInWg = 0.8; window.App.updateUI(); });
    bc = await bidCheck(page);
    row = bc.auto.find((r) => r.id === 'duct-static-path');
    expect(row).toEqual(expect.objectContaining({
      verdict: 'ok',
      detail: 'RTU-1: 0.15" of 0.80" ESP · critical path 62 eq ft (40\' duct + 1 elbow + 1 tap + 1 VD @ 0.08"/100\' + 0.10" terminal) ✓',
    }));
    expect(bc.manual.find((r) => r.id === 'duct-static-path')).toBeUndefined();
    await expect(staticRow).toHaveClass(/auto/);
    await expect(staticRow.locator('.bid-check-box')).toHaveCount(0);
    await expect(staticRow.locator('.bid-check-detail')).toContainText('critical path 62 eq ft');
    const sp = await page.evaluate(() => window.App.getDuctSystemStaticPath('g1'));
    expect(sp).toEqual(expect.objectContaining({ eqFt: 62, straightFt: 40, path: ['run-trunk', 'run-b3'], longestLegName: 'Branch 3', over: false, espInWg: 0.8 }));
    expect(sp.staticInWg).toBeCloseTo(0.1496, 6);
    // The sidebar header: "· 0.15" of 0.8" ESP" after the capacity text.
    await expect(page.locator('#groupsList .group-capacity-line')).toHaveText('0 designed / 600 capacity ✓ · 0.15" of 0.8" ESP');
    await expect(page.locator('#groupsList .group-capacity-line')).not.toHaveClass(/over/);

    // Over the ESP: ⚠, naming the long leg and the size to upsize; the
    // gate counts it; the header goes ⚠.
    await page.evaluate(() => { window.state.groups[0].espInWg = 0.1; window.App.updateUI(); });
    bc = await bidCheck(page);
    row = bc.auto.find((r) => r.id === 'duct-static-path');
    expect(row).toEqual(expect.objectContaining({
      verdict: 'warn',
      detail: 'RTU-1: 0.15" of 0.10" ESP, Branch 3 is the long leg; upsize its 8×6 or lower the friction rate ⚠',
    }));
    expect(bc.open.auto).toBe(1);
    await expect(staticRow).toHaveClass(/warn/);
    await expect(page.locator('#groupsList .group-capacity-line')).toHaveText('0 designed / 600 capacity ✓ · 0.15" of 0.1" ESP ⚠');
    await expect(page.locator('#groupsList .group-capacity-line')).toHaveClass(/over/);
    await expect(page.locator('#specificPages .bid-gate-badge')).toContainText('1 ⚠');

    // The knobs feed the walk: a lower friction rate passes; the terminal
    // allowance moves the number and rides ductSettings.
    await page.evaluate(() => { window.App.getDuctSettings().frictionInPer100ft = 0.04; window.App.updateUI(); });
    row = rowById(await bidCheck(page), 'duct-static-path');
    expect(row.detail).toBe('RTU-1: 0.12" of 0.10" ESP, Branch 3 is the long leg; upsize its 8×6 or lower the friction rate ⚠');
    await page.evaluate(() => { window.App.getDuctSettings().terminalAllowanceInWg = 0; window.App.updateUI(); });
    row = rowById(await bidCheck(page), 'duct-static-path');
    expect(row.detail).toBe('RTU-1: 0.02" of 0.10" ESP · critical path 62 eq ft (40\' duct + 1 elbow + 1 tap + 1 VD @ 0.04"/100\') ✓');
    const data = await page.evaluate(() => JSON.parse(JSON.stringify(window.App.buildCanvasExportData())));
    expect(data.ductSettings.terminalAllowanceInWg).toBe(0);
    await page.evaluate(() => { window.App.getDuctSettings().terminalAllowanceInWg = 0.1; window.App.getDuctSettings().frictionInPer100ft = 0.08; window.App.updateUI(); });

    // Two systems: one line each; ⚠ overall when any is over.
    await page.evaluate(() => {
      const s = window.state;
      s.groups.push({ id: 'g2', name: 'RTU-2', color: '#4a9eff', equipmentTag: 'RTU-2', espInWg: 0.05 });
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.ductRuns.push(window.makeDuctRun({
        id: 'run-2', name: 'Trunk 2', airside: 'supply', pressureClass: '1', systemGroupId: 'g2',
        vertices: [{ x: 100, y: 400 }, { x: 220, y: 400 }],
        segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 12, h: 8 } }],
      }));
      s.groups[0].espInWg = 0.8;
      window.App.reinferDuctFittings(0);
      window.App.updateUI();
    });
    row = rowById(await bidCheck(page), 'duct-static-path');
    expect(row.verdict).toBe('warn');
    expect(row.detail).toBe('RTU-1: 0.15" of 0.80" ESP · critical path 62 eq ft (40\' duct + 1 elbow + 1 tap + 1 VD @ 0.08"/100\' + 0.10" terminal) ✓; '
      + 'RTU-2: 0.11" of 0.05" ESP, Trunk 2 is the long leg; upsize its 12×8 or lower the friction rate ⚠');
    await expect(page.locator('#groupsList .group-capacity-line').nth(1)).toHaveText('0.11" of 0.05" ESP ⚠');

    // Clearing the ESP drops the row back to a checkbox, the old tick honored.
    await page.evaluate(() => { delete window.state.groups[0].espInWg; delete window.state.groups[1].espInWg; window.App.updateUI(); });
    bc = await bidCheck(page);
    row = rowById(bc, 'duct-static-path');
    expect(kindOf(bc, 'duct-static-path')).toBe('manual');
    expect(row.done).toBe(true);
    await expect(staticRow).toHaveClass(/manual/);
    await expect(staticRow.locator('.bid-check-box')).toHaveCount(1);
    await expect(page.locator('#groupsList .group-capacity-line')).toHaveCount(1);
    await expect(page.locator('#groupsList .group-capacity-line')).toHaveText('0 designed / 600 capacity ✓');
    expect(errors).toEqual([]);
  });

  test('ESP without a run stays manual; the header shows nothing until the system has a root run', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.state;
      s.groups.push({ id: 'g1', name: 'RTU-1', color: '#e05d5d', equipmentTag: 'RTU-1', espInWg: 0.8 });
      s.groupsEnabled = true;
      // A run of ANOTHER system so the panel has duct rows at all.
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.ductRuns = [window.makeDuctRun({
        id: 'run-x', name: 'Other', airside: 'supply', pressureClass: '1',
        vertices: [{ x: 100, y: 400 }, { x: 220, y: 400 }],
        segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 12, h: 8 } }],
      })];
      window.App.reinferDuctFittings(0);
      window.App.updateUI();
    });
    expect(kindOf(await bidCheck(page), 'duct-static-path')).toBe('manual');
    await expect(page.locator('#groupsList .group-system-tag')).toHaveText('RTU-1');
    await expect(page.locator('#groupsList .group-capacity-line')).toHaveCount(0);
    // Give the system its trunk: the row upgrades and the header fills in.
    await seedSystemTree(page, 'g1');
    const after = await bidCheck(page);
    expect(kindOf(after, 'duct-static-path')).toBe('auto');
    expect(rowById(after, 'duct-static-path').detail).toContain('RTU-1: 0.15" of 0.80" ESP');
    await expect(page.locator('#groupsList .group-capacity-line')).toHaveText('0.15" of 0.8" ESP');
    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: the Bid Check's duct rows + export gate (DUCT-PLAN.md unit D9).
 *
 * - The panel (S5's #bidCheckSection) carries NO duct rows without a duct
 *   run; the first committed run adds duct-model's DUCT_BID_CHECK_ROWS —
 *   four AUTO rows (room balance, system capacity, flex max, sheet scale)
 *   with their verdicts, and the MANUAL checkboxes (fits-the-roof first).
 * - Manual ticks live in state.bidCheck.manual and ride the project data
 *   (export data → hydrate, the takeoff backup) — the S5 persistence.
 * - "Fits the roof" is MANUAL until deck height + a room ceiling under the
 *   run + the run's size/liner are all known, then AUTO showing its work
 *   ("24×12 + 2" wrap = 14" · plenum 30" ✓") and naming the offending run.
 * - The export gate: #forPipeTooling / #specificPages carry the badge
 *   ("1 ⚠ · 8 unchecked") while duct exists and rows are unresolved; the
 *   click shows the interactive toast "Bid Check: Fits the roof? — Review ·
 *   Export anyway" — Review opens the sidebar row (flashed), Export anyway
 *   proceeds (the modal opens / the copy runs); resolved rows = silent; no
 *   duct = no gate at all; the S5 post-action advisory yields to the gate.
 * - The S-popover depth line (order 40): "14" deep · plenum 30" ✓" while
 *   deck + ceiling are known; ⚠ past the plenum; absent otherwise.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Duct Bid Check (D9)', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
  });

  // A committed 24×12 wrapped trunk on page 0 (the D8 seeding recipe).
  const seedTrunk = (page) => page.evaluate(() => {
    const s = window.state;
    const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
    ann.ductRuns = [window.makeDuctRun({
      id: 'run-1', name: 'Trunk', airside: 'supply', pressureClass: '1', linerType: 'wrap',
      vertices: [{ x: 100, y: 100 }, { x: 500, y: 100 }],
      segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
    })];
    window.App.reinferDuctFittings(0);
    window.App.updateUI();
  });
  // A room box with a ceiling height around the trunk (rooms need no palette
  // entry for the ceiling lookup — roomHeightAtPoint reads the box).
  const seedRoomBox = (page, heightFt) => page.evaluate((h) => {
    const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
    (ann.roomBoxes = ann.roomBoxes || []).push({ x1: 50, y1: 50, x2: 600, y2: 200, heightFt: h, roomId: null, id: 'box-1' });
    window.App.updateUI();
  }, heightFt);
  const setDeck = (page, ft) => page.evaluate((v) => { window.App.getDuctSettings().deckHeightFt = v; window.App.updateUI(); }, ft);
  const bidCheck = (page) => page.evaluate(() => window.App.getBidCheck());
  const rowById = (bc, id) => bc.auto.find((r) => r.id === id) || bc.manual.find((r) => r.id === id);

  test('panel: no duct rows without duct; a run adds them; ticks persist through the project data; the roof row upgrades manual → auto', async ({ page }) => {
    // Without duct: only the trade-neutral manual rows, nothing contributed.
    let bc = await bidCheck(page);
    expect(bc.manual.map((r) => r.id)).toEqual(['scope-vs-drawings', 'addenda', 'scale-verified']);
    expect(bc.auto).toEqual([]);
    expect(await page.evaluate(() => window.App.getDuctBidCheck())).toBe(null);
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveCount(0);

    await seedTrunk(page);
    bc = await bidCheck(page);
    expect(bc.auto.map((r) => r.id)).toEqual(['duct-rooms-served', 'duct-systems-capacity', 'duct-flex-max', 'duct-sheets-scaled']);
    expect(bc.manual.map((r) => r.id)).toEqual(['duct-fits-roof', 'duct-fire-dampers', 'duct-oa-code', 'duct-static-path', 'duct-curb-power', 'duct-controls', 'scope-vs-drawings', 'addenda', 'scale-verified']);
    expect(rowById(bc, 'duct-rooms-served').verdict).toBe('na');
    expect(rowById(bc, 'duct-systems-capacity').verdict).toBe('na');
    expect(rowById(bc, 'duct-flex-max').verdict).toBe('na');
    expect(rowById(bc, 'duct-sheets-scaled')).toEqual(expect.objectContaining({ verdict: 'ok', detail: '1 duct sheet scaled ✓' }));
    expect(bc.open).toEqual({ auto: 0, manual: 9, total: 9 });
    await expect(page.locator('#bidCheckBadge')).toHaveText('9');

    // The sidebar rows: the roof row is a checkbox (manual) for now.
    await page.click('#bidCheckSectionTitle');
    await expect(page.locator('#bidCheckList .bid-check-row.auto')).toHaveCount(4);
    const roofRow = page.locator('#bidCheckList .bid-check-row[data-row-id="duct-fits-roof"]');
    await expect(roofRow).toHaveClass(/manual/);
    await expect(roofRow.locator('.bid-check-box')).toHaveCount(1);
    await expect(roofRow).toContainText('Fits the roof — deepest duct + insulation clears the plenum');
    // Tick it: state.bidCheck.manual carries it, the badge counts down.
    await roofRow.locator('.bid-check-box').click();
    expect(await page.evaluate(() => window.state.bidCheck.manual['duct-fits-roof'])).toBe(true);
    await expect(page.locator('#bidCheckBadge')).toHaveText('8');
    await expect(roofRow).toHaveClass(/done/);

    // Persistence: the ticks ride the project data — export data → hydrate,
    // and the takeoff backup shape (the S5 paths ductSettings also rides).
    const data = await page.evaluate(() => JSON.parse(JSON.stringify(window.App.buildCanvasExportData())));
    expect(data.bidCheck).toEqual({ manual: { 'duct-fits-roof': true } });
    await page.evaluate(() => { window.state.bidCheck = { manual: {} }; window.App.updateUI(); });
    await expect(page.locator('#bidCheckBadge')).toHaveText('9');
    await page.evaluate((d) => window.App.hydrateStateFromProjectData(d), data);
    expect(await page.evaluate(() => window.state.bidCheck.manual['duct-fits-roof'])).toBe(true);
    await page.evaluate(() => window.App.applyTakeoffBackupToState({ counters: [], lineTypes: [], bidCheck: { manual: { 'duct-oa-code': true } } }));
    expect(await page.evaluate(() => ({ ...window.state.bidCheck.manual }))).toEqual({ 'duct-oa-code': true });
    await page.evaluate(() => { window.state.bidCheck = { manual: { 'duct-fits-roof': true } }; window.App.updateUI(); });

    // The roof upgrade rule: deck height alone is not enough (no ceiling
    // under the run) — still a checkbox…
    await setDeck(page, 12.5);
    expect(rowById(await bidCheck(page), 'duct-fits-roof').done).toBe(true);
    await expect(roofRow.locator('.bid-check-box')).toHaveCount(1);
    // …a room box with a ceiling under the run completes the three numbers:
    // AUTO, showing its work, the stale tick ignored (the app knows).
    await seedRoomBox(page, 10);
    bc = await bidCheck(page);
    const roof = bc.auto.find((r) => r.id === 'duct-fits-roof');
    expect(roof).toEqual(expect.objectContaining({ verdict: 'ok', detail: '24×12 + 2" wrap = 14" · plenum 30" ✓' }));
    expect(bc.manual.find((r) => r.id === 'duct-fits-roof')).toBeUndefined();
    expect(bc.open).toEqual({ auto: 0, manual: 8, total: 8 });
    const roofAuto = page.locator('#bidCheckList .bid-check-row[data-row-id="duct-fits-roof"]');
    await expect(roofAuto).toHaveClass(/auto/);
    await expect(roofAuto.locator('.bid-check-box')).toHaveCount(0);
    await expect(roofAuto.locator('.bid-check-detail')).toHaveText('24×12 + 2" wrap = 14" · plenum 30" ✓');
    // A lower deck: the offending run is named.
    await setDeck(page, 11);
    bc = await bidCheck(page);
    expect(bc.auto.find((r) => r.id === 'duct-fits-roof')).toEqual(expect.objectContaining({ verdict: 'warn', detail: 'Trunk: 24×12 + 2" wrap = 14" · plenum 12" ⚠' }));
    expect(bc.open.auto).toBe(1);
    // Clearing the deck height drops the row back to a checkbox.
    await setDeck(page, null);
    expect(rowById(await bidCheck(page), 'duct-fits-roof').done).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the auto rows read the app\'s own tallies: under-served room, system over capacity, over-max flex, an unscaled duct sheet', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.state;
      s.groups.push({ id: 'g1', name: 'RTU-1', color: '#e05d5d', equipmentTag: 'RTU-1', capacityCfm: 300 });
      s.groupsEnabled = true;
      const icon = window.App.getOrderedIcons()[0].value;
      s.counters.push({ id: 'c-a', name: 'Diffuser A', icon, color: '#e8c547', cfm: 200 });
      s.counters.push({ id: 'c-b', name: 'Diffuser B', icon, color: '#4a9eff', cfm: 200, flexDropFt: 9 });
      s.rooms.push({ id: 'room-1', name: 'Office 101', color: '#47c88e', roomType: 'custom', targetCfmOverride: 900 });
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.ductRuns = [window.makeDuctRun({
        id: 'run-1', name: 'Trunk', airside: 'supply', pressureClass: '1', systemGroupId: 'g1',
        vertices: [{ x: 100, y: 100 }, { x: 500, y: 100 }],
        segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
      })];
      ann.counterMarkers['c-a'] = [{ x: 200, y: 105, id: 'm1' }];
      ann.counterMarkers['c-b'] = [{ x: 400, y: 108, id: 'm2' }];
      (ann.roomBoxes = ann.roomBoxes || []).push({ x1: 50, y1: 50, x2: 600, y2: 200, heightFt: 10, roomId: 'room-1', id: 'box-1' });
      // A second sheet carrying duct with NO scale.
      const ann2 = window.App.ensureActiveCanvas(s.pages[1]).annotations;
      ann2.ductRuns = [window.makeDuctRun({
        id: 'run-2', name: 'Branch', airside: 'supply', pressureClass: '1',
        vertices: [{ x: 100, y: 300 }, { x: 300, y: 300 }],
        segments: [{ startVertexIdx: 0, size: { kind: 'round', d: 10 } }],
      })];
      window.App.reinferDuctFittings(0);
      window.App.reinferDuctFittings(1);
      window.App.updateUI();
    });
    const bc = await bidCheck(page);
    expect(rowById(bc, 'duct-rooms-served')).toEqual(expect.objectContaining({ verdict: 'warn', detail: '1 of 1 room under-served: Office 101 needs 900 · served 400 ⚠' }));
    expect(rowById(bc, 'duct-systems-capacity')).toEqual(expect.objectContaining({ verdict: 'warn', detail: 'RTU-1 · 400 designed / 300 capacity ⚠' }));
    expect(rowById(bc, 'duct-flex-max')).toEqual(expect.objectContaining({ verdict: 'warn', detail: "1 drop over 6' max ⚠ (RTU-1)" }));
    expect(rowById(bc, 'duct-sheets-scaled')).toEqual(expect.objectContaining({ verdict: 'warn' }));
    expect(rowById(bc, 'duct-sheets-scaled').detail).toMatch(/^.+ has duct but no scale ⚠$/);
    expect(bc.open.auto).toBe(4);
    // The badge reads the whole panel: 4 ⚠ · 9 unchecked (6 duct + 3 neutral).
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveText('4 ⚠ · 9 unchecked');
    await expect(page.locator('#forPipeTooling .bid-gate-badge')).toHaveText('4 ⚠ · 9 unchecked');
    // Fixing them clears the rows one by one.
    await page.evaluate(() => {
      const s = window.state;
      s.rooms[0].targetCfmOverride = 400;
      s.groups[0].capacityCfm = 600;
      s.counters[1].flexDropFt = 6;
      s.pages[1].scale = { pixelsPerUnit: 12, unit: 'ft' };
      window.App.updateUI();
    });
    const fixed = await bidCheck(page);
    expect(rowById(fixed, 'duct-rooms-served').detail).toBe('1 room served ✓');
    expect(rowById(fixed, 'duct-systems-capacity').detail).toBe('RTU-1 · 400 designed / 600 capacity ✓');
    expect(rowById(fixed, 'duct-flex-max').detail).toBe("2 drops · all within 6' ✓");
    expect(rowById(fixed, 'duct-sheets-scaled').detail).toBe('2 duct sheets scaled ✓');
    expect(fixed.open.auto).toBe(0);
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveText('9 unchecked');
    expect(errors).toEqual([]);
  });

  test('export gate: badge, the "Review · Export anyway" toast on Export PDFs and Copy to /Tooling, Review flashes the row, resolved = silent, no duct = no gate', async ({ page }) => {
    // No duct: Export PDFs opens its modal straight away, no badge, no toast.
    await page.evaluate(() => { window.state.counters.push({ id: 'c1', name: 'Thing', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' }); window.App.ensureActiveCanvas(window.state.pages[0]).annotations.counterMarkers.c1 = [{ x: 50, y: 50, id: 'm0' }]; window.App.updateUI(); });
    await expect(page.locator('#specificPages')).toBeVisible();
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveCount(0);
    await page.click('#specificPages');
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await expect(page.locator('#bidGateToastModal.visible')).toHaveCount(0);
    await page.click('#specificPagesCancel');

    // Duct + a too-low deck under a known ceiling: one ⚠ (the roof row, auto
    // now) + 8 unchecked. The badge says so on both buttons.
    await seedTrunk(page);
    await seedRoomBox(page, 10);
    await setDeck(page, 11);
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveText('1 ⚠ · 8 unchecked');
    await expect(page.locator('#forPipeTooling .bid-gate-badge')).toHaveText('1 ⚠ · 8 unchecked');
    expect(await page.locator('#specificPages').getAttribute('title')).toContain('Bid Check: 1 ⚠ · 8 unchecked');

    // Export PDFs → the interactive toast, the modal NOT opened.
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await expect(page.locator('#bidGateToastText')).toHaveText('Bid Check: Fits the roof?');
    await expect(page.locator('#bidGateToastModal p')).toHaveText('Bid Check: Fits the roof? — Review · Export anyway');
    await expect(page.locator('#specificPagesModal')).not.toHaveClass(/visible/);
    // Review: toast gone, section expanded, the row scrolled + flashed.
    await page.click('#bidGateReview');
    await expect(page.locator('#bidGateToastModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#bidCheckList')).toBeVisible();
    const roofRow = page.locator('#bidCheckList .bid-check-row[data-row-id="duct-fits-roof"]');
    await expect(roofRow).toHaveClass(/bid-check-flash/);
    await expect(roofRow).toHaveClass(/warn/);
    await expect(page.locator('#specificPagesModal')).not.toHaveClass(/visible/);
    // Export anyway: proceeds — the Export PDFs modal opens.
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await page.click('#bidGateExportAnyway');
    await expect(page.locator('#bidGateToastModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await page.click('#specificPagesCancel');

    // Copy to /Tooling runs the same gate through runGatedCopy: the copy
    // waits for Export anyway; the S5 post-action advisory stays quiet.
    const before = await page.evaluate(async () => {
      window.__copied = 0;
      await window.App.runGatedCopy(null, [0], async () => { window.__copied++; }, 'pipe-tooling', 'this-canvas');
      return window.__copied;
    });
    expect(before).toBe(0);
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await page.click('#bidGateExportAnyway');
    await expect.poll(() => page.evaluate(() => window.__copied)).toBe(1);
    await expect(page.locator('#bidCheckAdvisoryModal.visible')).toHaveCount(0);
    // The first unresolved row names the toast: once the ⚠ clears it is the
    // first unticked manual row.
    await setDeck(page, 12.5);
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastText')).toHaveText('Bid Check: Fire dampers at rated walls?');
    await page.click('#bidGateReview');

    // Resolve everything: silent exports, no badge.
    await page.evaluate(() => {
      const bc = window.App.getBidCheck();
      bc.manual.forEach((r) => { window.state.bidCheck.manual[r.id] = true; });
      window.App.updateUI();
    });
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveCount(0);
    await expect(page.locator('#forPipeTooling .bid-gate-badge')).toHaveCount(0);
    expect(await page.locator('#specificPages').getAttribute('title')).toBeNull();
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal.visible')).toHaveCount(0);
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await page.click('#specificPagesCancel');
    const silent = await page.evaluate(async () => {
      window.__copied = 0;
      await window.App.runGatedCopy(null, [0], async () => { window.__copied++; }, 'pipe-tooling', 'this-canvas');
      return window.__copied;
    });
    expect(silent).toBe(1);

    // No duct at all (runs removed): untick everything — still no gate.
    await page.evaluate(() => {
      window.state.bidCheck = { manual: {} };
      window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns = [];
      window.App.reinferDuctFittings(0);
      window.App.updateUI();
    });
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveCount(0);
    const noDuct = await page.evaluate(async () => {
      window.__copied = 0;
      await window.App.runGatedCopy(null, [0], async () => { window.__copied++; }, 'pipe-tooling', 'this-canvas');
      return window.__copied;
    });
    expect(noDuct).toBe(1);
    await expect(page.locator('#bidGateToastModal.visible')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('S-popover depth line (order 40): the current size vs the plenum at the last vertex — ✓, ⚠, and absent without deck or ceiling', async ({ page }) => {
    await seedRoomBox(page, 10);
    // Arm a 24×12 wrapped run through the real create modal, place one
    // vertex inside the room box.
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateW').fill('24');
    await page.locator('#ductCreateH').fill('12');
    await page.selectOption('#ductCreateLiner', 'wrap');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
    const depthSection = page.locator('#ductSizeSections .duct-popover-section[data-section-id="depth-line"]');

    // No vertex yet → no line (nothing to stand under).
    await page.evaluate(() => window.App.openDuctSizePopover());
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    await expect(depthSection).toHaveCount(0);
    await page.evaluate(() => window.App.closeDuctSizePopover());
    await page.evaluate(() => window.App.commitDuctClick({ x: 100, y: 100 }));
    // Deck unknown → no line.
    await page.evaluate(() => window.App.openDuctSizePopover());
    await expect(depthSection).toHaveCount(0);
    await page.evaluate(() => window.App.closeDuctSizePopover());
    // Deck 12.5' over a 10' ceiling: 24×12 + 2" wrap = 14" deep, plenum 30" ✓.
    await setDeck(page, 12.5);
    await page.evaluate(() => window.App.openDuctSizePopover());
    await expect(depthSection.locator('.duct-depth-line')).toHaveText('14" deep · plenum 30" ✓');
    await expect(depthSection.locator('.duct-depth-line')).not.toHaveClass(/warn/);
    await page.evaluate(() => window.App.closeDuctSizePopover());
    // The seam reads the same line for the current size.
    expect(await page.evaluate(() => window.App.getDuctDraftDepthLine(window.App.getCurrentDuctSize(), window.state.drawingDuct))).toEqual({ ok: true, text: '14" deep · plenum 30" ✓' });
    // A 11' deck leaves 12": too deep → ⚠, quietly (the trace goes on).
    await setDeck(page, 11);
    await page.evaluate(() => window.App.openDuctSizePopover());
    await expect(depthSection.locator('.duct-depth-line')).toHaveText('14" deep · plenum 12" ⚠');
    await expect(depthSection.locator('.duct-depth-line')).toHaveClass(/warn/);
    await page.evaluate(() => window.App.closeDuctSizePopover());
    expect(await page.evaluate(() => !!window.state.drawingDuct)).toBe(true);
    // Stepping down to 12×8 fits again (8" + 2" = 10" in a 12" plenum).
    await page.evaluate(() => window.App.applyDuctSizeStep({ kind: 'rect', w: 12, h: 8 }));
    await page.evaluate(() => window.App.openDuctSizePopover());
    await expect(depthSection.locator('.duct-depth-line')).toHaveText('10" deep · plenum 12" ✓');
    await page.evaluate(() => window.App.closeDuctSizePopover());
    // A vertex outside every room box (the box ends at y = 200) → no line.
    await page.evaluate(() => window.App.commitDuctClick({ x: 300, y: 400 }));
    expect(await page.evaluate(() => window.state.drawingDuct.vertices.length)).toBe(2);
    await page.evaluate(() => window.App.openDuctSizePopover());
    await expect(depthSection).toHaveCount(0);
    await page.evaluate(() => window.App.closeDuctSizePopover());
    expect(errors).toEqual([]);
  });
});

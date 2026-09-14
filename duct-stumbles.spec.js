// @ts-check
/**
 * Tests: the J19 stumble fixes (DUCT-PLAN.md unit D17 — journeys/duct-takeoff.md
 * findings #1 / #2 / #4, plus the drift-patrol re-walk findings J6-G and J5-B).
 *
 * 1. Groups precondition — the duct surfaces that name Groups turn them on in
 *    place: the create modal's equipment-first line carries a "Turn on groups"
 *    link while the per-project gate is off (plain "(edit in Groups)" once on);
 *    the Bid Check "Systems within capacity" hint carries the same link; the
 *    FIRST committed duct run on a groups-off project flips the gate with one
 *    quiet toast ("Groups are on — assign this run to a system in Groups.") —
 *    once per project (a second run is silent); a polyline commit never does.
 * 2. Deck height before any run — the create modal's Deck height input
 *    (prefilled from ductSettings.deckHeightFt) writes the setting on Start
 *    Tracing, so the very first equipment-started run stages its auto riser;
 *    setting / changing / clearing the deck later (schedule-modal input, the
 *    one App.setDuctDeckHeight writer) adds / updates / removes the
 *    { vertexIdx: 0, auto: true } riser on every committed equipment-started
 *    run RETROACTIVELY, never duplicating a manual vertex-0 entry; the Room
 *    Size dialog carries the same project field on HVAC-shaped projects only.
 * 3. Copy Summary + Copy to /Tooling — both texts append a "--- Duct ---"
 *    block with the Copy Schedule rows (per-size LF · lb, straight total,
 *    fittings total, Bid weight), tab-separated, only when the scope has duct;
 *    a duct-only project exposes the copy buttons.
 * 4. Multiply zones multiply duct — a run inside a ×3 zone triples its LF, lb,
 *    fittings and the Bid weight on the sidebar / schedule / legend / report
 *    (a straddling run counts once — the line rule); the sidebar carries the
 *    T2-11 "placed · with repeats" title; the zone dialog preview says
 *    "… 1 duct run".
 * 5. Mutually exclusive drafts — arming Duct settles a live polyline draft by
 *    its own rules (≥2 points commit, fewer cancel) and P settles a live duct
 *    draft the same way; exactly one draft / finish bar survives.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const RUN_A = {
  id: 'run-a', name: 'Main', airside: 'supply', pressureClass: '1', linerType: null,
  vertices: [{ x: 100, y: 100 }, { x: 340, y: 100 }, { x: 340, y: 340 }],
  segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
};

test.describe('Duct stumbles (D17)', () => {
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
      // Every toast text, in order — the "once per project" assertions read it.
      window.__toasts = [];
      const orig = window.App.showToast;
      window.App.showToast = (msg, ms) => { window.__toasts.push(String(msg)); return orig(msg, ms); };
    });
  });

  // Arm a supply run through the real create modal (the duct-polish recipe).
  async function armDuct(page, w = 24, h = 12) {
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateW').fill(String(w));
    await page.locator('#ductCreateH').fill(String(h));
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
  }

  async function seedRun(page, run, pageIdx = 0) {
    await page.evaluate(({ cfg, pi }) => {
      const canvas = window.App.ensureActiveCanvas(window.state.pages[pi]);
      if (!canvas.annotations.ductRuns) canvas.annotations.ductRuns = [];
      canvas.annotations.ductRuns.push(window.makeDuctRun(cfg));
      window.App.reinferDuctFittings(pi);
      window.App.updateUI();
      window.App.renderAnnotations();
    }, { cfg: run, pi: pageIdx });
  }

  // A system group + its equipment marker at pdf (200, 300); groups ON.
  async function seedSystem(page) {
    await page.evaluate(() => {
      const s = window.state;
      s.groups.push({ id: 'g1', name: 'RTU-1', color: '#e05d5d', equipmentTag: 'RTU-1', capacityCfm: 2000 });
      s.groupsEnabled = true;
      s.activeGroupId = 'g1';
      s.counters.push({ id: 'rtu-counter', name: 'RTU-1', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' });
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.counterMarkers['rtu-counter'] = [{ x: 200, y: 300, group: 'g1' }];
      window.App.updateUI();
    });
  }

  const ductRuns = (page) => page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns || []);

  // ---- 1. Groups precondition -------------------------------------------------

  test('groups: the equipment-first line links "Turn on groups" while the gate is off and flips it in place', async ({ page }) => {
    // Rooms with a type (a target CFM) and NO system group → the D7 line shows.
    await page.evaluate(() => {
      const s = window.state;
      s.rooms = [{ id: 'r1', name: 'Office 101', color: '#4a9eff', roomType: 'office' }];
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.roomBoxes = [{ x1: 0, y1: 0, x2: 600, y2: 600, heightFt: 9, roomId: 'r1', id: 'b1' }];
      window.App.updateUI();
    });
    expect(await page.evaluate(() => window.state.groupsEnabled)).toBe(false);
    await expect(page.locator('#groupsSection')).toBeHidden();
    await page.locator('#ductBtn').click();
    const line = page.locator('#ductCreateEquipFirst');
    await expect(line).toBeVisible();
    await expect(line).toContainText(/Rooms total ~2,500 CFM, about \d systems? at [\d,]+ CFM \(/);
    await expect(line.locator('#ductCreateTurnOnGroups')).toHaveText('Turn on groups');
    await line.locator('#ductCreateTurnOnGroups').click();
    expect(await page.evaluate(() => window.state.groupsEnabled)).toBe(true);
    await expect(line).toContainText('(edit in Groups)');
    await expect(line.locator('#ductCreateTurnOnGroups')).toHaveCount(0);
    expect(await page.evaluate(() => window.__toasts)).toEqual(['Groups are on. The Groups section is in the sidebar.']);
    await page.locator('#ductCreateCancel').click();
    await expect(page.locator('#groupsSection')).toBeVisible();
    expect(await page.evaluate(() => document.getElementById('groupsSection').classList.contains('collapsed'))).toBe(false);
    expect(errors).toEqual([]);
  });

  test('groups: the first committed run turns the gate on with one toast — once per project; a second run and a polyline are silent', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    expect(await page.evaluate(() => window.state.groupsEnabled)).toBe(false);
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 300 } });
    await wrapper.click({ position: { x: 320, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct);
    expect((await ductRuns(page)).length).toBe(1);
    expect(await page.evaluate(() => window.state.groupsEnabled)).toBe(true);
    await expect(page.locator('#groupsSection')).toBeVisible();
    expect(await page.evaluate(() => window.__toasts)).toEqual(['Groups are on. Assign this run to a system in Groups.']);
    await expect(page.locator('#airboardToastText')).toHaveText('Groups are on. Assign this run to a system in Groups.');

    // Second run: silent.
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 400 } });
    await wrapper.click({ position: { x: 320, y: 400 } });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct);
    expect((await ductRuns(page)).length).toBe(2);
    expect(await page.evaluate(() => window.__toasts.length)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('groups: a non-duct project never sees it — a polyline commit leaves the gate off', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes = [{ id: 'lt1', name: 'Test', color: '#4a9eff', curveStyle: 'straight' }];
      s.activeLineTypeId = 'lt1';
      document.getElementById('polylineBtn').click();
    });
    const wrapper = page.locator('#canvasWrapper');
    await wrapper.click({ position: { x: 150, y: 300 } });
    await wrapper.click({ position: { x: 320, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingPolyline);
    expect(await page.evaluate(() => window.state.groupsEnabled)).toBe(false);
    await expect(page.locator('#groupsSection')).toBeHidden();
    expect(await page.evaluate(() => window.__toasts)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('groups: the Bid Check "Systems within capacity" hint carries the link while the gate is off', async ({ page }) => {
    await seedRun(page, RUN_A);
    expect(await page.evaluate(() => window.state.groupsEnabled)).toBe(false);   // seeded, never committed
    await page.evaluate(() => { window.state.bidCheckCollapsed = false; window.App.updateUI(); });
    const row = page.locator('#bidCheckList .bid-check-row[data-row-id="duct-systems-capacity"]');
    await expect(row).toContainText('Give a system group a unit capacity (Groups) to check it.');
    await expect(row.locator('.bid-check-groups-link')).toHaveText('Turn on groups');
    await row.locator('.bid-check-groups-link').click();
    expect(await page.evaluate(() => window.state.groupsEnabled)).toBe(true);
    await expect(page.locator('#groupsSection')).toBeVisible();
    await expect(row.locator('.bid-check-groups-link')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  // ---- 2. Deck height before any run -----------------------------------------

  test('deck height: set from the create modal BEFORE any run → the first equipment-started run stages its riser', async ({ page }) => {
    await seedSystem(page);
    expect(await page.evaluate(() => window.state.ductSettings.deckHeightFt)).toBeNull();
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await expect(page.locator('#ductCreateDeck')).toHaveValue('');
    await page.locator('#ductCreateDeck').fill('12');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => !!window.state.drawingDuct);
    expect(await page.evaluate(() => window.state.ductSettings.deckHeightFt)).toBe(12);
    await page.evaluate(() => window.App.commitDuctClick({ x: 200, y: 300 }));
    expect(await page.evaluate(() => window.state.drawingDuct.verticalFt)).toEqual([{ vertexIdx: 0, ft: 12, auto: true }]);
    await page.evaluate(() => window.App.commitDuctClick({ x: 500, y: 300 }));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct);
    expect((await ductRuns(page))[0].verticalFt).toEqual([{ vertexIdx: 0, ft: 12, auto: true }]);
    // The modal re-opens prefilled from the setting.
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateDeck')).toHaveValue('12');
    await page.locator('#ductCreateCancel').click();
    expect(errors).toEqual([]);
  });

  test('deck height: set after runs exist adds risers retroactively, updates on change, never duplicates a manual entry, clears on empty', async ({ page }) => {
    await seedSystem(page);
    // A: equipment-started system run, no riser. B: equipment-started with a
    // MANUAL vertex-0 entry. C: started away from the marker. D: no system.
    const mk = (id, x0, extra) => Object.assign({
      id, name: id, airside: 'supply', pressureClass: '1', systemGroupId: 'g1',
      vertices: [{ x: x0, y: 300 }, { x: 600, y: 300 }],
      segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
    }, extra || {});
    await seedRun(page, mk('A', 200));
    await seedRun(page, mk('B', 200, { verticalFt: [{ vertexIdx: 0, ft: 4 }] }));
    await seedRun(page, mk('C', 400));
    await seedRun(page, mk('D', 200, { systemGroupId: null }));
    const vf = async () => (await ductRuns(page)).map((r) => r.verticalFt || null);
    const lbBefore = await page.evaluate(() => window.App.computeDuctSchedule().straightTotalLb);

    // Through the schedule modal's Polish-row input (the one writer).
    await page.evaluate(() => window.App.openDuctScheduleModal());
    await page.locator('#ductDeckHeight').fill('12');
    await page.locator('#ductDeckHeight').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.ductSettings.deckHeightFt)).toBe(12);
    expect(await vf()).toEqual([[{ vertexIdx: 0, ft: 12, auto: true }], [{ vertexIdx: 0, ft: 4 }], null, null]);
    expect(await page.evaluate(() => window.__toasts.pop())).toBe("Deck height 12'. Auto riser set on 1 run.");
    // The riser prices like straight duct at the run's size (24×12 24 ga = 6.94 lb/ft).
    const lbAfter = await page.evaluate(() => window.App.computeDuctSchedule().straightTotalLb);
    expect(Math.round(lbAfter - lbBefore)).toBe(Math.round(12 * 6.94));

    // Change: the auto entry is UPDATED, not stacked.
    await page.locator('#ductDeckHeight').fill('15');
    await page.locator('#ductDeckHeight').dispatchEvent('change');
    expect(await vf()).toEqual([[{ vertexIdx: 0, ft: 15, auto: true }], [{ vertexIdx: 0, ft: 4 }], null, null]);

    // Clear: the auto entry goes; the manual one stays.
    await page.locator('#ductDeckHeight').fill('');
    await page.locator('#ductDeckHeight').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.ductSettings.deckHeightFt)).toBeNull();
    expect(await vf()).toEqual([null, [{ vertexIdx: 0, ft: 4 }], null, null]);
    expect(await page.evaluate(() => window.__toasts.pop())).toBe('Deck height cleared. Auto riser removed from 1 run.');

    // A room ceiling under the marker → riser = deck − ceiling, still retroactive.
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      (ann.roomBoxes = ann.roomBoxes || []).push({ x1: 100, y1: 200, x2: 300, y2: 400, heightFt: 9, roomId: null, id: 'box-1' });
    });
    await page.locator('#ductDeckHeight').fill('12');
    await page.locator('#ductDeckHeight').dispatchEvent('change');
    expect(await vf()).toEqual([[{ vertexIdx: 0, ft: 3, auto: true }], [{ vertexIdx: 0, ft: 4 }], null, null]);
    // Undo reverses the retroactive pass as one step.
    await page.locator('#ductScheduleClose').click();
    await page.keyboard.press('Control+z');
    expect(await vf()).toEqual([null, [{ vertexIdx: 0, ft: 4 }], null, null]);
    expect(errors).toEqual([]);
  });

  test('deck height: the Room Size dialog carries the project field on HVAC-shaped projects only', async ({ page }) => {
    // Plumbing-shaped project: no field.
    await page.evaluate(() => window.App.openRoomBoxModal({ x1: 100, y1: 100, x2: 400, y2: 300 }));
    await expect(page.locator('#roomBoxModal')).toHaveClass(/visible/);
    await expect(page.locator('#roomBoxDeckGroup')).toBeHidden();
    await page.locator('#roomBoxCancel').click();
    // HVAC trade: the field shows, prefilled empty; Apply writes the setting.
    await page.evaluate(() => { window.state.trade = 'hvac'; });
    await page.evaluate(() => window.App.openRoomBoxModal({ x1: 100, y1: 100, x2: 400, y2: 300 }));
    await expect(page.locator('#roomBoxDeckGroup')).toBeVisible();
    await expect(page.locator('#roomBoxDeck')).toHaveValue('');
    await page.locator('#roomBoxHeight').fill('9');
    await page.locator('#roomBoxNewRoomBtn').click();
    await page.locator('#roomBoxNewRoomName').fill('Office 101');
    await page.locator('#roomBoxDeck').fill("12'6");
    await page.locator('#roomBoxApply').click();
    await expect(page.locator('#roomBoxModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.state.ductSettings.deckHeightFt)).toBe(12.5);
    expect(await page.evaluate(() => (window.App.ensureActiveCanvas(window.state.pages[0]).annotations.roomBoxes || []).length)).toBe(1);
    // Re-open: prefilled; a plumbing trade with a deck already set still shows it.
    await page.evaluate(() => { window.state.trade = 'plumbing'; window.App.openRoomBoxModalForEdit(0); });
    await expect(page.locator('#roomBoxDeckGroup')).toBeVisible();
    await expect(page.locator('#roomBoxDeck')).toHaveValue('12.50');
    await page.locator('#roomBoxCancel').click();
    expect(errors).toEqual([]);
  });

  // ---- 3. Copy Summary + Copy to /Tooling carry the duct pounds ----------------

  test('copy: both texts append the Copy Schedule rows under "--- Duct ---" only when the scope has duct', async ({ page }) => {
    // Counters only: neither text mentions duct; the buttons show as before.
    await page.evaluate(() => {
      const s = window.state;
      s.counters.push({ id: 'wc', name: 'WC', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' });
      window.App.ensureActiveCanvas(s.pages[0]).annotations.counterMarkers.wc = [{ x: 50, y: 50 }];
      window.App.updateUI();
    });
    let texts = await page.evaluate(() => ({ pipe: window.getPipeToolingSummary(), email: window.getEmailTextSummary() }));
    expect(texts.pipe).toBe('WC\t1\t1');
    expect(texts.pipe).not.toContain('Duct');
    expect(texts.email).not.toContain('--- Duct ---');

    await seedRun(page, RUN_A);   // 24×12: 20' + 20' = 40' @ 6.94 lb/ft + 1 auto elbow
    texts = await page.evaluate(() => ({ pipe: window.getPipeToolingSummary(), email: window.getEmailTextSummary() }));
    const rows = [
      "24×12\t24 ga\t40'\t6.94 lb/ft\t277 lb",
      "Straight total\t\t40'\t\t277 lb",
      'Fittings total\t\t\t\t35 lb',
      'Bid weight\t\t\t\t359 lb',
    ];
    expect(texts.pipe).toBe(['WC\t1\t1', '', '--- Duct ---', ...rows].join('\n'));
    expect(texts.email).toContain(['--- Duct ---', ...rows, ''].join('\n'));
    // The Copy Schedule text is byte-identical to before (its own pins hold).
    const sched = await page.evaluate(() => window.App.buildDuctScheduleText(window.App.computeDuctSchedule()));
    expect(sched).toContain("24×12\t24 ga\t40'\t6.94 lb/ft\t277 lb");
    expect(sched).not.toContain('--- Duct ---');
    // The copied-detail mirror buckets the block as duct, never ea/ft.
    const detail = await page.evaluate(() => window.formatToolingExportSummary(window.summarizeToolingExport(window.getPipeToolingSummary())));
    expect(detail).toBe('1 count (1 ea) · duct (359 lb bid weight)');
    // Factor mode: the factor line replaces the counted total.
    await page.evaluate(() => { window.state.ductSettings.fittingMode = 'factor'; });
    expect(await page.evaluate(() => window.getPipeToolingSummary())).toContain('Fittings (factor 40% of straight)\t\t\t\t111 lb');
    expect(errors).toEqual([]);
  });

  test('copy: a duct-only project exposes Copy to /Tooling and Copy Summary, and the /Tooling text is the duct block alone', async ({ page }) => {
    await expect(page.locator('#forPipeToolingDropdown')).toBeHidden();
    await seedRun(page, RUN_A);
    await expect(page.locator('#forPipeToolingDropdown')).toBeVisible();
    await expect(page.locator('#copySummaryTextDropdown')).toBeVisible();
    const pipe = await page.evaluate(() => window.getPipeToolingSummary());
    expect(pipe.startsWith('--- Duct ---\n24×12\t24 ga')).toBe(true);
    // Scope honors the page: page 2 has no duct → nothing.
    expect(await page.evaluate(() => window.getPipeToolingSummary({ pageIndices: [1] }))).toBe('');
    expect(errors).toEqual([]);
  });

  // ---- 4. Multiply zones multiply duct -----------------------------------------

  test('multiply: a run inside a ×3 zone triples LF / lb / fittings / Bid weight everywhere; a straddling run counts once; the dialog preview counts duct', async ({ page }) => {
    await seedRun(page, RUN_A);                                             // inside the zone below
    await seedRun(page, Object.assign({}, RUN_A, { id: 'run-s', name: 'Straddle', vertices: [{ x: 100, y: 500 }, { x: 900, y: 500 }] }));
    const once = await page.evaluate(() => {
      const s = window.App.computeDuctSchedule();
      return { ft: s.straightTotalFt, lb: s.straightTotalLb, fit: s.fittingsCountedLb, bid: s.bidWeightLb, repeated: s.repeated, lbPerFt: s.straightRows[0].lbPerFt };
    });
    expect(once.repeated).toBe(false);
    // Expected strings from the app's own lb/ft (24×12 24 ga ≈ 6.93): A = 40',
    // the straddler = 66.67'; the run-row / All-duct labels round like the app.
    const R = (n) => Math.round(n).toLocaleString('en-US');
    const ftS = once.ft - 40;
    const lbA = 40 * once.lbPerFt, lbS = ftS * once.lbPerFt;
    const runA = R(120) + "' · " + R(3 * lbA) + ' lb';
    const runAPlaced = R(40) + "' · " + R(lbA) + ' lb';
    const allX3 = R(120 + ftS) + "' · " + R(3 * lbA + lbS) + ' lb';
    const allPlaced = R(40 + ftS) + "' · " + R(lbA + lbS) + ' lb';
    // The zone: ×3 around RUN_A only (0..400 × 0..400).
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      ann.multiplyZones = [{ x1: 0, y1: 0, x2: 400, y2: 400, multiplier: 3, id: 'z1' }];
      window.App.updateUI();
      window.App.renderAnnotations();
    });
    const x3 = await page.evaluate(() => {
      const s = window.App.computeDuctSchedule();
      return { ft: s.straightTotalFt, lb: s.straightTotalLb, fit: s.fittingsCountedLb, bid: s.bidWeightLb, repeated: s.repeated, placedFt: s.straightPlacedFt, placedLb: s.straightPlacedLb, rows: s.fittingRows.map((r) => [r.type, r.count]) };
    });
    // RUN_A = 40' · 278 lb · 1 elbow; straddle = 66.67' · 463 lb, no fittings.
    expect(Math.round(x3.ft)).toBe(Math.round(40 * 3 + (once.ft - 40)));
    expect(Math.round(x3.lb)).toBe(Math.round(once.lb + 2 * 40 * 6.94));
    expect(x3.fit).toBeCloseTo(once.fit * 3, 6);
    expect(x3.rows).toEqual([['elbow90', 3]]);
    expect(x3.bid).toBeCloseTo((x3.lb + x3.fit) * 1.15, 6);
    expect(x3.repeated).toBe(true);
    expect(Math.round(x3.placedFt)).toBe(Math.round(once.ft));
    expect(Math.round(x3.placedLb)).toBe(Math.round(once.lb));

    // Sidebar: the run row reads ×3 with the T2-11 title; the straddler is unchanged.
    const rowA = page.locator('#ductList .duct-run-row').filter({ hasText: 'Main' });
    await expect(rowA.locator('.badge')).toHaveText(runA);
    await expect(rowA.locator('.badge')).toHaveAttribute('title', runAPlaced + ' placed · ' + runA + ' with repeats');
    await expect(page.locator('#ductList .duct-run-row').filter({ hasText: 'Straddle' }).locator('.badge')).toHaveText(R(ftS) + "' · " + R(lbS) + ' lb');
    await expect(page.locator('#ductList .duct-run-wrap').filter({ hasText: 'Main' }).locator('.duct-fittings-line')).toHaveText('3 elbows');
    await expect(page.locator('#ductList .duct-all-total')).toHaveAttribute('title', allPlaced + ' placed · ' + allX3 + ' with repeats');

    // Schedule modal: the Straight duct heading carries the honesty phrase.
    await page.evaluate(() => window.App.openDuctScheduleModal());
    await expect(page.locator('#ductScheduleRepeats')).toHaveText('(' + allPlaced + ' placed · ' + allX3 + ' with repeats)');
    const copy = await page.evaluate(() => window.App.buildDuctScheduleText(window.App.computeDuctSchedule()));
    expect(copy).toContain('Straight total\t\t' + R(120 + ftS) + "'\t\t" + R(3 * lbA + lbS) + ' lb\nPlaced (before multiply zones)\t\t' + R(40 + ftS) + "'\t\t" + R(lbA + lbS) + ' lb');
    await page.locator('#ductScheduleClose').click();

    // Legend + report read the multiplied numbers.
    const legend = await page.evaluate(() => window.App.legendRowsFor(window.App.ensureActiveCanvas(window.state.pages[0]).annotations, 0).ductRows.map((x) => x.name + ' ' + x.lenStr));
    expect(legend).toEqual(['24×12 ' + allX3, 'All duct ' + allX3]);
    const report = await page.evaluate(() => window.buildReportHtml({}));
    expect(report).toContain(R(120 + ftS) + "'");
    expect(report).toContain('Placed (before multiply zones)');
    expect(report).toContain(R(40 + ftS) + "'");

    // Removing the zone restores the placed arithmetic exactly.
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      ann.multiplyZones = [];
      window.App.updateUI();
    });
    const back = await page.evaluate(() => { const s = window.App.computeDuctSchedule(); return { bid: s.bidWeightLb, repeated: s.repeated }; });
    expect(back.bid).toBeCloseTo(once.bid, 9);
    expect(back.repeated).toBe(false);

    // The zone dialog preview counts duct runs (two corners around RUN_A).
    await page.evaluate(() => { window.state.tool = window.App.TOOL.MULTIPLY_ZONE; });
    const wrapper = page.locator('#canvasWrapper');
    const corner = await page.evaluate(() => {
      const a = window.App.toCanvas({ x: 0, y: 0 }), b = window.App.toCanvas({ x: 400, y: 400 });
      const c = document.getElementById('annCanvas'); const r = c.getBoundingClientRect(); const w = document.getElementById('canvasWrapper').getBoundingClientRect();
      const k = r.width / c.width;
      return { ax: r.left - w.left + a.x * k + 2, ay: r.top - w.top + a.y * k + 2, bx: r.left - w.left + b.x * k, by: r.top - w.top + b.y * k };
    });
    await wrapper.click({ position: { x: corner.ax, y: corner.ay } });
    await wrapper.click({ position: { x: corner.bx, y: corner.by } });
    await expect(page.locator('#multiplyZoneModal')).toHaveClass(/visible/);
    await expect(page.locator('#multiplyZonePreview')).toHaveText('In this area: 0 counter(s), 0 line run(s) (0.00 ft), 1 duct run');
    await page.locator('#multiplyZoneCancel').click();
    expect(errors).toEqual([]);
  });

  // ---- 5. Mutually exclusive drafts --------------------------------------------

  const drafts = (page) => page.evaluate(() => ({
    poly: window.state.drawingPolyline ? window.state.drawingPolyline.points.length : null,
    duct: window.state.drawingDuct ? window.state.drawingDuct.vertices.length : null,
    tool: window.state.tool === window.App.TOOL.DUCT ? 'duct' : window.state.tool === window.App.TOOL.POLYLINE ? 'polyline' : window.state.tool,
    polyBar: document.getElementById('polylineFinishBar').classList.contains('visible'),
    ductBar: document.getElementById('ductFinishBar').classList.contains('visible'),
    polylines: (window.App.ensureActiveCanvas(window.state.pages[0]).annotations.polylines || []).length,
    ductRuns: (window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns || []).length,
  }));

  async function armPolyline(page) {
    await page.evaluate(() => {
      const s = window.state;
      if (!s.lineTypes.length) s.lineTypes = [{ id: 'lt1', name: 'Test', color: '#4a9eff', curveStyle: 'straight' }];
      s.activeLineTypeId = 'lt1';
      document.getElementById('polylineBtn').click();
    });
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.POLYLINE && !!window.state.drawingPolyline);
  }

  test('drafts: arming Duct over a 3-point polyline draft commits it; over a 1-point draft cancels it — one finish bar either way', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armPolyline(page);
    await wrapper.click({ position: { x: 150, y: 300 } });
    await wrapper.click({ position: { x: 320, y: 300 } });
    await wrapper.click({ position: { x: 320, y: 420 } });
    expect((await drafts(page)).poly).toBe(3);
    await armDuct(page);
    let d = await drafts(page);
    expect(d).toMatchObject({ poly: null, duct: 0, tool: 'duct', polyBar: false, ductBar: true, polylines: 1, ductRuns: 0 });
    // Esc ladder from here unwinds the duct draft only.
    await page.keyboard.press('Escape');
    d = await drafts(page);
    expect(d).toMatchObject({ poly: null, duct: null, polyBar: false, ductBar: false, polylines: 1 });

    await armPolyline(page);
    await wrapper.click({ position: { x: 150, y: 500 } });
    expect((await drafts(page)).poly).toBe(1);
    await armDuct(page);
    d = await drafts(page);
    expect(d).toMatchObject({ poly: null, duct: 0, tool: 'duct', polyBar: false, ductBar: true, polylines: 1 });
    expect(errors).toEqual([]);
  });

  test('drafts: P over a 2-vertex duct draft commits the run; over a 1-vertex draft cancels it — one finish bar either way', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 300 } });
    await wrapper.click({ position: { x: 320, y: 300 } });
    expect((await drafts(page)).duct).toBe(2);
    await armPolyline(page);
    let d = await drafts(page);
    expect(d).toMatchObject({ poly: 0, duct: null, tool: 'polyline', polyBar: true, ductBar: false, ductRuns: 1 });
    await page.keyboard.press('Escape');   // pops nothing → exits
    d = await drafts(page);
    expect(d).toMatchObject({ poly: null, duct: null, polyBar: false, ductBar: false, ductRuns: 1 });

    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 500 } });
    expect((await drafts(page)).duct).toBe(1);
    await armPolyline(page);
    d = await drafts(page);
    expect(d).toMatchObject({ poly: 0, duct: null, tool: 'polyline', polyBar: true, ductBar: false, ductRuns: 1 });
    // The dialog path (no active line type) settles the same way.
    await page.keyboard.press('Escape');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 420 } });
    await wrapper.click({ position: { x: 320, y: 420 } });
    await page.evaluate(() => { window.state.activeLineTypeId = null; document.getElementById('polylineBtn').click(); });
    await expect(page.locator('#polylineModal')).toHaveClass(/visible/);
    expect((await drafts(page)).duct).toBe(2);   // still alive while the dialog is up
    await page.locator('#polylineStart').click();
    d = await drafts(page);
    expect(d).toMatchObject({ poly: 0, duct: null, tool: 'polyline', polyBar: true, ductBar: false, ductRuns: 2 });
    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: Tier-3 batch B19 part 2 (DUCT unit D19 — journeys/plans/_TODO.md D19,
 * JOURNEY-MAP B19 "Ratchet 2026-09-13", _INDEX-DUCT.md Wave 3 row D19).
 *
 * 1. "More ▸ air & mounting" disclosure on the Create tab and its Quick Count
 *    twin: the CFM / Mount height / Flex drop fields fold under it, it opens
 *    by itself on the HVAC and Electrical trade profiles, an estimator's
 *    toggle wins for the project, and the fields stay REACHABLE on every trade
 *    (the first CFM device must be creatable). Legend Settings' duct rows and
 *    the room-volumes row appear only once the project has them (J5-E).
 * 2. Delete Area previews and removes duct runs + their fittings, one undo
 *    step, with the ft/lb the sidebar badge shows (J6-H).
 * 3. The email Bid Check block skips `na` rows (J11-I).
 * 4. Flex leaders make attachment visible, and a stray device can be rescued
 *    from the context menu (J19 Friction #3).
 * 5. The footer compacts the save stamp before dropping the tool hint at a
 *    laptop width (J19 Friction #5).
 * 6. Room type on the Room Size dialog (J19 Friction #6).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const PDF = path.join(__dirname, 'test-2pages.pdf');

async function boot(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(PDF);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    try { localStorage.removeItem('plumbingModifiers'); } catch (_) {}
  });
}

const setTrade = (page, trade) => page.evaluate((t) => {
  window.state.trade = t;
  window.state.counterAirMoreOpen = null;   // a fresh project follows its trade
}, trade);

async function openCreateTab(page) {
  await page.evaluate(() => { window.App.hideModal('counterModal'); document.getElementById('addCounter')?.click(); });
  await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
  await expect(page.locator('#counterCreatePanel')).toBeVisible();
}
async function openQuickTab(page) {
  await page.evaluate(() => { window.App.hideModal('counterModal'); document.getElementById('addCounter')?.click(); window.App.showCounterTab('quickcount'); });
  await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
  await expect(page.locator('#counterQuickCountPanel')).toBeVisible();
}

// A committed 24x12 trunk on page 0 with two corners (so fittings infer).
const seedTrunk = (page) => page.evaluate(() => {
  const s = window.state;
  const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
  ann.ductRuns = [window.makeDuctRun({
    id: 'run-1', name: 'Trunk', airside: 'supply', pressureClass: '1', linerType: 'wrap',
    vertices: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 300 }],
    segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
  })];
  window.App.reinferDuctFittings(0);
  window.App.renderAnnotations();
  window.App.updateUI();
});

// A CFM counter type with one placed marker at (x, y).
const seedDevice = (page, x, y) => page.evaluate(({ x, y }) => {
  const s = window.state;
  const c = { id: 'cfm-1', name: 'Supply Diffuser', icon: window.App.cfmDefaultIcon(), color: '#e8c547', cfm: 150 };
  s.counters = [c];
  const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
  ann.counterMarkers[c.id] = [{ x, y, id: 'm-1' }];
  window.App.renderAnnotations();
  window.App.updateUI();
}, { x, y });

test.describe('B19 part 2 (D19)', () => {
  /** @type {string[]} */
  let errors;
  test.beforeEach(async ({ page }) => { errors = []; await boot(page, errors); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  // --- 1. the disclosure ------------------------------------------------------
  test('1a. the air & mounting fields fold under one disclosure, open by trade', async ({ page }) => {
    const read = () => page.evaluate(() => {
      const b = document.getElementById('counterAirMoreToggle');
      const f = document.getElementById('counterAirMoreFields');
      return { expanded: b.getAttribute('aria-expanded'), hidden: f.hidden, caret: b.querySelector('.counter-air-more-caret').textContent };
    });
    // The three device fields live INSIDE the disclosure, not beside it.
    await setTrade(page, null);
    await openCreateTab(page);
    expect(await page.evaluate(() => {
      const f = document.getElementById('counterAirMoreFields');
      return ['counterCfm', 'counterMountHeight', 'counterFlexDrop'].every((id) => !!f.querySelector('#' + id));
    })).toBe(true);
    // Plumbing: closed.
    expect(await read()).toMatchObject({ expanded: 'false', hidden: true, caret: '▸' });
    // HVAC and Electrical: open by themselves.
    for (const t of ['hvac', 'electrical']) {
      await setTrade(page, t);
      await openCreateTab(page);
      expect(await read(), t).toMatchObject({ expanded: 'true', hidden: false, caret: '▾' });
    }
  });

  test('1b. the estimator\'s toggle wins for the project and both tabs share it', async ({ page }) => {
    await setTrade(page, 'hvac');
    await openCreateTab(page);
    await page.locator('#counterAirMoreToggle').click();
    expect(await page.evaluate(() => window.state.counterAirMoreOpen)).toBe(false);
    // Reopening respects the override rather than re-applying the trade default.
    await openCreateTab(page);
    expect(await page.evaluate(() => document.getElementById('counterAirMoreFields').hidden)).toBe(true);
    // The Quick Count twin reads the same flag and holds the same rows — and
    // STACKS them (the panel's modifier rows are flex rows; the disclosure is not one).
    await openQuickTab(page);
    await page.evaluate(() => { window.state.counterAirMoreOpen = true; window.App.applyCounterAirMore('counterQuickCountAirMoreToggle', 'counterQuickCountAirMoreFields'); });
    expect(await page.evaluate(() => {
      const b = document.getElementById('counterQuickCountAirMoreToggle').getBoundingClientRect();
      const f = document.getElementById('counterQuickCountAirMoreFields').getBoundingClientRect();
      return f.top >= b.bottom - 1 && Math.abs(f.left - b.left) < 2;
    })).toBe(true);
    await page.evaluate(() => { window.state.counterAirMoreOpen = false; window.App.applyCounterAirMore('counterQuickCountAirMoreToggle', 'counterQuickCountAirMoreFields'); });
    expect(await page.evaluate(() => {
      const f = document.getElementById('counterQuickCountAirMoreFields');
      return { hidden: f.hidden, hasCfm: !!f.querySelector('#counterQuickCountCfmRow'), hasMount: !!f.querySelector('#counterQuickCountMountRow') };
    })).toMatchObject({ hidden: true, hasCfm: true, hasMount: true });
  });

  test('1c. the fields stay reachable on plumbing — the first CFM device is creatable', async ({ page }) => {
    await setTrade(page, null);
    await openCreateTab(page);
    await page.locator('#counterAirMoreToggle').click();
    await expect(page.locator('#counterCfm')).toBeVisible();
    await page.locator('#counterCfm').fill('150');
    await page.locator('#counterName').fill('Diffuser A');
    await page.locator('#counterCreate').click();
    expect(await page.evaluate(() => (window.state.counters.find((c) => c.name === 'Diffuser A') || {}).cfm)).toBe(150);
  });

  test('1d. Legend Settings hides the duct and room rows until the project has them (J5-E)', async ({ page }) => {
    const rows = () => page.evaluate(() => {
      window.App.openLegendSettingsModal();
      const g = (id) => document.getElementById(id).hidden;
      const out = { duct: g('legendShowDuctRow'), ghost: g('legendShowDuctGhostRow'), rooms: g('legendShowRoomsRow') };
      window.App.hideModal('legendSettingsModal');
      return out;
    });
    expect(await rows()).toMatchObject({ duct: true, ghost: true, rooms: true });
    await seedTrunk(page);
    expect(await rows()).toMatchObject({ duct: false, ghost: false, rooms: true });
    await page.evaluate(() => { window.state.rooms = [{ id: 'r1', name: 'Office', color: '#47c88e' }]; });
    expect(await rows()).toMatchObject({ duct: false, rooms: false });
  });

  // --- 2. Delete Area ---------------------------------------------------------
  test('2. Delete Area previews and removes duct runs with their fittings, one undo (J6-H)', async ({ page }) => {
    await seedTrunk(page);
    const before = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return { runs: ann.ductRuns.length, fittings: ann.ductFittings.length };
    });
    expect(before.runs).toBe(1);
    expect(before.fittings).toBeGreaterThan(0);   // the corner infers an elbow
    // The real preview builder, over a rectangle covering the whole run.
    await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      window.App.openDeleteZoneForRect(ann, 0, 0, 0, 1000, 1000);
    });
    await expect(page.locator('#confirmModal')).toHaveClass(/visible/);
    const preview = await page.locator('#confirmBody').textContent();
    expect(preview).toContain('1 duct run');
    expect(preview).toMatch(/\d+' · [\d,]+ lb/);        // the sidebar's own ft/lb
    expect(preview).toContain(before.fittings === 1 ? '1 fitting' : before.fittings + ' fittings');
    // The ft/lb in the confirm are the ones the sidebar badge shows.
    const tally = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      const t = window.App.ductRunTally({ run: ann.ductRuns[0], ann, pageIdx: 0 });
      return { ft: Math.round(t.totalLengthFt), lb: Math.round(t.totalPounds) };
    });
    expect(preview).toContain(tally.ft + "' · " + tally.lb.toLocaleString() + ' lb');
    // Confirm deletes the run AND its fittings.
    await page.locator('#confirmOk').click();
    expect(await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return { runs: ann.ductRuns.length, fittings: ann.ductFittings.length };
    })).toMatchObject({ runs: 0, fittings: 0 });
    // ONE undo brings the whole thing back.
    await page.locator('#undoBtn').click();
    expect(await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return { runs: ann.ductRuns.length, fittings: ann.ductFittings.length };
    })).toMatchObject({ runs: before.runs, fittings: before.fittings });
  });

  test('2b. a duct-free area is unchanged — no duct fragment in the preview', async ({ page }) => {
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      (ann.notes = ann.notes || []).push({ x: 100, y: 100, text: 'n', id: 'n-1' });
      window.App.openDeleteZoneForRect(ann, 0, 0, 0, 1000, 1000);
    });
    const preview = await page.locator('#confirmBody').textContent();
    expect(preview).toContain('note');
    expect(preview).not.toContain('duct');
    await page.locator('#confirmCancel').click();
  });

  // --- 3. the email Bid Check block ------------------------------------------
  test('3. the email Bid Check block carries verdicts, not setup hints (J11-I)', async ({ page }) => {
    const text = await page.evaluate(() => {
      window.App.getBidCheck = () => ({
        auto: [
          { id: 'a1', label: 'Conduit fill', verdict: 'ok', detail: '3 of 9 wires' },
          { id: 'a2', label: 'Every room served', verdict: 'na', detail: 'Give a room a type on its Edit Room dialog to get a target.' },
          { id: 'a3', label: 'Voltage drop', verdict: 'warn', detail: '3.4% over 120 ft' },
        ],
        manual: [{ id: 'm1', label: 'Fire dampers located', done: false }],
        open: { auto: 1, manual: 1, total: 2 },
      });
      return window.getEmailTextSummary();
    });
    expect(text).toContain('Bid Check (2 open)');
    expect(text).toContain('✓ Conduit fill');
    expect(text).toContain('⚠ Voltage drop');
    expect(text).toContain('☐ Fire dampers located');
    // The setup hint and its "— " prefix are gone.
    expect(text).not.toContain('Every room served');
    expect(text).not.toContain('Edit Room dialog');
  });

  // --- 4. flex leaders + the stray rescue ------------------------------------
  test('4a. leaders exist for attached devices only, drawn to the tap point', async ({ page }) => {
    const res = await page.evaluate(() => {
      const trunk = { id: 't', vertices: [{ x: 0, y: 0 }, { x: 300, y: 0 }], airside: 'supply' };
      return {
        attached: window.ductDeviceLeaders([{ x: 100, y: 8 }], [trunk]),
        stray: window.ductDeviceLeaders([{ x: 100, y: 60 }], [trunk]),
        onRun: window.ductDeviceLeaders([{ x: 100, y: 0 }], [trunk]),
      };
    });
    expect(res.attached).toHaveLength(1);
    expect(res.attached[0]).toMatchObject({ runId: 't', from: { x: 100, y: 8 }, to: { x: 100, y: 0 } });
    expect(res.stray).toEqual([]);    // outside the tap snap — no leader, the bare glyph is the tell
    expect(res.onRun).toEqual([]);    // zero length would paint as dirt
  });

  test('4b. a stray device offers "Attach to nearest run"; an attached one does not', async ({ page }) => {
    await seedTrunk(page);
    // 30 pt off the trunk: outside the 12 pt tap snap, inside the 96 pt search.
    await seedDevice(page, 200, 130);
    const rowFor = (typeId, index) => page.evaluate(({ typeId, index }) => {
      window.state.ctxTarget = { type: 'marker', typeId, index };
      window.App.showContextMenu(10, 10);
      const shown = document.getElementById('ctxAttachToRun').style.display;
      return shown;
    }, { typeId, index });
    expect(await rowFor('cfm-1', 0)).toBe('block');
    // Rescue it: the marker moves onto the run and the leader appears.
    await page.evaluate(() => document.getElementById('ctxAttachToRun').click());
    const after = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      const m = ann.counterMarkers['cfm-1'][0];
      return { y: m.y, leaders: window.ductDeviceLeaders([{ x: m.x, y: m.y }], ann.ductRuns).length };
    });
    expect(after.y).toBeCloseTo(100, 1);   // snapped onto the trunk
    expect(after.leaders).toBe(0);          // sitting ON the run: attached, nothing to draw
    // Now attached, the row is gone — it is never a no-op.
    expect(await rowFor('cfm-1', 0)).toBe('none');
    // And one undo puts it back where it was.
    await page.locator('#undoBtn').click();
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers['cfm-1'][0].y)).toBeCloseTo(130, 1);
  });

  test('4c. a device with no run in reach gets no rescue row', async ({ page }) => {
    await seedTrunk(page);
    await seedDevice(page, 200, 700);   // far beyond the search radius
    expect(await page.evaluate(() => {
      window.state.ctxTarget = { type: 'marker', typeId: 'cfm-1', index: 0 };
      window.App.showContextMenu(10, 10);
      return document.getElementById('ctxAttachToRun').style.display;
    })).toBe('none');
  });

  // --- 5. the footer at a laptop width ---------------------------------------
  test('5. the footer never drops the hint while the save stamp is still spelled out (Friction #5)', async ({ page }) => {
    await seedTrunk(page);
    // A real takeoff's bar: counters and a line put totals in it too, which is
    // what made the dossier's 1380 px case tip over.
    await page.evaluate(() => {
      const s = window.state;
      s.currentProjectName = 'plan-A-design-build-second-floor';
      s.counters = [{ id: 'c1', name: 'Water Closet', icon: window.App.cfmDefaultIcon(), color: '#e8c547' }];
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.counterMarkers.c1 = [{ x: 50, y: 50, id: 'm1' }];
      ann.quickLines = [{ x1: 10, y1: 10, x2: 400, y2: 10, id: 'q1', lineTypeId: null, color: '#4a9eff' }];
      window.App.getLastLocalBackupAt = () => Date.now();
      s.tool = window.App.TOOL.DUCT;
      window.App.updateUI();
    });
    const sample = async (width) => {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { window.App.updateStatus(); });
      return page.evaluate(() => {
        const m = document.getElementById('statusMode');
        const a = document.getElementById('statusBarActions');
        const text = m.textContent || '';
        return {
          hint: text.includes('S = size'),
          fullStamp: text.includes('Saved on this device'),
          compactStamp: /Saved · /.test(text) && !text.includes('Saved on this device'),
          oneLine: a.offsetTop <= m.offsetTop,
        };
      });
    };
    const rows = [];
    for (let w = 1500; w >= 1180; w -= 20) rows.push({ w, ...(await sample(w)) });
    // The rule: the stamp's WORDS are spent before the hint is. So no width may
    // show the full stamp with the hint already gone — that was the bug.
    const violations = rows.filter((r) => !r.hint && r.fullStamp);
    expect(violations, JSON.stringify(violations)).toEqual([]);
    // The ladder is real: somewhere in this range the stamp compacts to keep
    // the hint, which is the behavior the item adds.
    expect(rows.some((r) => r.hint && r.compactStamp), JSON.stringify(rows)).toBe(true);
    // And the bar stays one line throughout.
    expect(rows.filter((r) => !r.oneLine)).toEqual([]);
  });

  // --- 6. room type on the Room Size dialog ----------------------------------
  test('6. the Room Size dialog carries the room type and its derived target (Friction #6)', async ({ page }) => {
    // Plumbing: the dialog is unchanged.
    await page.evaluate(() => { window.state.rooms = [{ id: 'r1', name: 'Office', color: '#47c88e' }]; });
    await page.evaluate(() => window.App.openRoomBoxModal({ x1: 0, y1: 0, x2: 240, y2: 120 }));
    expect(await page.locator('#roomBoxTypeGroup').isVisible()).toBe(false);
    await page.evaluate(() => window.App.hideModal('roomBoxModal'));
    // HVAC: the type is on the dialog that draws the box.
    await setTrade(page, 'hvac');
    await page.evaluate(() => window.App.openRoomBoxModal({ x1: 0, y1: 0, x2: 240, y2: 120 }));
    await expect(page.locator('#roomBoxTypeGroup')).toBeVisible();
    // Options are built from duct-model's ROOM_TYPE_CFM_PER_SQFT, exactly as
    // Edit Room builds them: a "None" row plus one labelled row per type,
    // each naming its rate. (The table is a classic-script const, so it is
    // reachable by shape here rather than by name.)
    const boxOpts = await page.evaluate(() => [...document.getElementById('roomBoxType').options].map((o) => ({ v: o.value, t: o.textContent })));
    expect(boxOpts[0]).toMatchObject({ v: '', t: 'None' });
    expect(boxOpts.length).toBeGreaterThan(1);
    expect(boxOpts.slice(1).every((o) => !!o.v)).toBe(true);
    // Rated types name their rate; Custom deliberately has none (its target is
    // the override on Edit Room), exactly as D7 renders it there.
    expect(boxOpts.filter((o) => /CFM\/ft²/.test(o.t)).length).toBeGreaterThan(0);
    expect(boxOpts.some((o) => o.v === 'office')).toBe(true);
    // Pick the room, then a type: the derived target counts the box being added.
    await page.locator('#roomBoxRoomList .room-picker-item').first().click();
    await page.selectOption('#roomBoxType', 'office');
    // 240x120 pdf pts at 12 px/ft = 20' x 10' = 200 ft², office = 1 CFM/ft².
    await expect(page.locator('#roomBoxTypeDerived')).toHaveText('Target 200 CFM (from 200 ft²)');
    await page.locator('#roomBoxHeight').fill('9');
    await page.locator('#roomBoxApply').click();
    expect(await page.evaluate(() => window.state.rooms[0].roomType)).toBe('office');
    // Reopening the box reflects the saved type.
    await page.evaluate(() => window.App.openRoomBoxModalForEdit(0));
    expect(await page.evaluate(() => document.getElementById('roomBoxType').value)).toBe('office');
  });
});

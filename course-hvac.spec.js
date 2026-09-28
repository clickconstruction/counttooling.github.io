// @ts-check
/**
 * The HVAC course (features/course-hvac.js): nine chapters, after an uncounted chapter 0
 * (id before, six read cards for a reader who has never seen a drawing), on the tour engine, on the
 * mechanical set (samples/sample-hvac.pdf), the third trade course. Plan:
 * journeys/plans/HVAC-COURSE.md.
 *
 * Guards: every chapter's path through the engine's seam runs end to end on REAL state and
 * leaves the takeoff it claims (rooms that read served, the main at the engineer's four
 * sizes with its transitions, the kitchen branch and its tap, Fits the roof and Static path
 * resolved by the app, an exhaust run that is exhaust); the questions refuse the wrong click
 * and say why; the schedule reader builds the seven tagged counters from M-501; the reference
 * and the compare card with the bid weight; a finished chapter ticks and hands back; the doors.
 */
const { test, expect } = require('@playwright/test');
const { pastStartHere } = require('./spec-helpers');

const stepId = (page) => page.evaluate(() => window.App.tutorialStepId());
async function boot(page, url, errors) {
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.startChapterHvac);
}
async function walk(page) {
  const walked = [], revealed = [], skipped = [];
  for (let i = 0; i < 40; i++) {
    const id = await stepId(page);
    if (!id) break;
    walked.push(id);
    if (await page.locator('#tourReveal').isVisible()) { await page.click('#tourReveal'); if (await page.locator('.tour-reveal').count()) revealed.push(id); }
    const info = await page.evaluate(() => window.App.tutorialStepInfo());
    if (info.kind === 'do' && !info.done) {
      if (info.hasAction) await page.evaluate(() => window.App.tutorialDoStep());
      try {
        await page.waitForFunction((was) => window.App.tutorialStepId() !== was || (window.App.tutorialStepInfo() || {}).done, id, { timeout: 30000 });
      } catch (_) { skipped.push(id); await page.click('#tourSkip'); }
    }
    if (await stepId(page) === id) { await page.waitForFunction(() => !document.getElementById('tourNext').disabled, null, { timeout: 5000 }).catch(() => {}); await page.click('#tourNext'); }
    await page.waitForTimeout(150);
  }
  return { walked, revealed, skipped };
}
const ann = (page, i) => page.evaluate((idx) => { const a = window.App.getActiveAnnotations(window.state.pages[idx]); return JSON.parse(JSON.stringify(a)); }, i);
const countOf = (page, tag) => page.evaluate((t) => { const c = window.state.counters.find((x) => String(x.tag || '').toUpperCase() === t || new RegExp('^' + t + '( ·|$)', 'i').test(x.name)); if (!c) return -1; let n = 0; window.state.pages.forEach((p) => (p.canvases || []).forEach((cv) => { n += (((cv.annotations || {}).counterMarkers || {})[c.id] || []).length; })); return n; }, tag);
const ductRow = (page, id) => page.evaluate((k) => { const bc = window.App.getDuctBidCheck(); const r = bc && (bc.rows || []).find((x) => x.id === k); return r ? { kind: r.kind, verdict: r.verdict, detail: r.detail } : null; }, id);
const schedule = (page) => page.evaluate(() => { const s = window.App.computeDuctSchedule(); return { rows: s.straightRows.map((r) => [String(r.sizeKey), Math.round(r.lengthFt * 100) / 100, r.gauge, Math.round(r.lbPerFt * 100) / 100, r.material || null]), fittings: s.fittingRows.map((r) => [r.type, r.count, r.material || null]), lb: Math.round(s.bidWeightLb), grease: s.grease ? { cleanouts: s.grease.cleanouts.total, atBends: s.grease.cleanouts.atBends, wrapSqFt: Math.round(s.grease.wrapSqFt * 10) / 10 } : null }; });
const runs = (page) => page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ductRuns || []).map((r) => ({ airside: r.airside, liner: r.linerType, material: r.material || null, sizes: r.segments.map((s) => (s.size.kind === 'round' ? s.size.d + '"ø' : s.size.w + 'x' + s.size.h)) })));
const gotoStep = (page, id) => page.evaluate((s) => window.App.tutorialGoTo(s), id);
const openSheets = async (page) => { await page.waitForFunction(() => window.App.tutorialStepId() === 'sheets', null, { timeout: 10000 }); await page.click('#tourShow'); await page.waitForFunction(() => window.App.tutorialStepId() !== 'sheets', null, { timeout: 25000 }); };

const EXPECT = {
  // chapter 0 reads and makes nothing: six read cards, no zones, the sheets open
  before: async (page) => {
    expect(await page.evaluate(() => [window.state.trade, window.state.currentPage])).toEqual(['hvac', 0]);
    expect(await page.evaluate(() => (window.state.counters || []).filter((c) => c.lesson).length)).toBe(0);
    expect(await page.evaluate(() => window.App.courseHvacIds()[0])).toBe('before');
  },
  sheet: async (page) => {
    expect(await page.evaluate(() => [window.App.getPageScale(0).pixelsPerUnit, window.state.trade, window.state.currentPage])).toEqual([9, 'hvac', 1]);
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 31\'-8"');
    expect(await countOf(page, 'RTU-1')).toBe(1);
    expect((await ann(page, 1)).highlights.length).toBe(1);                                    // the kitchen's row
  },
  rooms: async (page) => {
    const rooms = await page.evaluate(() => window.state.rooms.map((r) => [r.name, r.roomType, r.targetCfmOverride]));
    expect(rooms).toEqual([['DINING', 'custom', 1200], ['KITCHEN', 'custom', 800], ['HALL', 'custom', 100]]);
    expect((await ann(page, 0)).roomBoxes.map((b) => b.heightFt)).toEqual([9, 9, 9]);
    expect(await page.evaluate(() => window.App.getDuctSettings().deckHeightFt)).toBe(12);
    const bal = await page.evaluate(() => window.App.getRoomAirBalance().map((r) => [r.name, Math.round(r.targetCfm), Math.round(r.servedCfm)]));
    expect(bal.find((r) => r[0] === 'DINING').slice(1)).toEqual([1200, 0]);                   // needs 1,200, served nothing yet
  },
  diffusers: async (page) => {
    const tags = await page.evaluate(() => window.state.counters.filter((c) => c.tag).map((c) => [c.tag, c.cfm || 0, c.lesson === true]));
    expect(tags).toEqual([['SD-1', 150, true], ['SD-2', 100, true], ['SD-3', 200, true], ['RG-1', 0, true], ['EG-1', 75, true], ['EG-2', 120, true], ['MA-1', 2000, true]]);   // from M-501, then each row's CFM (EG-2, the mop room at 1.0 CFM a sq ft: HC-REVIEW R4)
    for (const [t, n] of [['SD-1', 11], ['SD-2', 2], ['SD-3', 4], ['RG-1', 3], ['EG-1', 2], ['EG-2', 1]]) expect([t, await countOf(page, t)]).toEqual([t, n]);
    const bal = await page.evaluate(() => window.App.getRoomAirBalance().map((r) => [r.name, Math.round(r.targetCfm), Math.round(r.servedCfm), !!r.under]));
    expect(bal.find((r) => r[0] === 'DINING')).toEqual(['DINING', 1200, 1200, false]);       // eight SD-1 at 150: the room reads ✓
    expect(bal.find((r) => r[0] === 'KITCHEN')).toEqual(['KITCHEN', 800, 800, false]);
  },
  system: async (page) => {
    const g = await page.evaluate(() => window.state.groups.find((x) => x.equipmentTag === 'RTU-1'));
    expect([g.capacityCfm, g.espInWg]).toEqual([3000, 1]);
    expect(await page.evaluate(() => Math.round(window.App.getDuctSystemDesignedCfm(window.state.groups[0].id)))).toBe(0);      // no run reaches a diffuser yet: chapter 5's
    expect(await ductRow(page, 'duct-systems-capacity')).toBeNull();                         // no duct yet, so no duct rows: the panel says nothing until chapter 5
  },
  main: async (page) => {
    const r = await runs(page);
    expect(r.map((x) => x.sizes.join(' '))).toEqual(['24x12 20x12 16x10 12x10', '16x10']);
    expect(r[0].liner).toBe('wrap');
    const s = await schedule(page);
    const by = Object.fromEntries(s.rows.map(([k, ft]) => [k.replace(/×/g, 'x'), ft]));
    expect(by['24x12']).toBeCloseTo(32.5, 1);                                                  // 46 + 344 plan px, roof to the dining wall
    expect(by['20x12']).toBeCloseTo(11.67, 1);                                                 // 140
    expect(by['16x10']).toBeCloseTo(10 + 40.5, 1);                                             // 120 on the main + the kitchen branch
    expect(by['12x10']).toBeCloseTo(10, 1);                                                    // 120
    expect(await page.evaluate(() => Math.round(window.App.getDuctSystemDesignedCfm(window.state.groups[0].id)))).toBe(2350);   // every diffuser the main or the kitchen branch reaches; the two along the bar stay strays
    expect(s.fittings.filter(([t]) => /transition/i.test(t)).reduce((n, [, c]) => n + c, 0)).toBeGreaterThanOrEqual(3);   // the three size steps, one row per size
    expect(s.fittings.some(([t]) => /elbow/i.test(t))).toBe(true);
    expect(s.fittings.some(([t]) => /tap/i.test(t))).toBe(true);                                // the kitchen branch off the main
    expect(s.lb).toBeGreaterThan(100);
  },
  plenum: async (page) => {
    expect(await page.evaluate(() => [window.App.getPageScale(2).pixelsPerUnit, window.state.lastMeasure.text])).toEqual([36, 'Distance: 1\'-4"']);   // the wrapped main, on the section
    const fits = await ductRow(page, 'duct-fits-roof');
    expect(fits.kind).toBe('auto');
    expect(fits.verdict).toBe('ok');
    expect(fits.detail).toMatch(/plenum 36"|3'-0"|36/);
    const st = await ductRow(page, 'duct-static-path');
    expect(st.kind).toBe('auto');
    expect(st.verdict).toBe('ok');
    expect(st.detail).toMatch(/of 1(\.0+)?" ESP/);
  },
  exhaust: async (page) => {
    const r = await runs(page);
    expect(r.find((x) => x.sizes.join() === '8"ø').airside).toBe('exhaust');
    expect(r.some((x) => x.sizes.join() === '20x16')).toBe(true);
    const grease = r.find((x) => x.sizes.join() === '18"ø');
    expect([grease.airside, grease.material]).toEqual(['exhaust', 'black-steel']);
    expect(await countOf(page, 'MA-1')).toBe(1);
    expect(await countOf(page, 'Fire Damper')).toBe(2);                                          // the two rated-wall penetrations
    // HC-TRADE T2 (settled 2026-09-27): the hood, restroom and make-up fans are their own systems.
    // Nothing traced in this chapter lands on RTU-1, which still reads the main and the kitchen
    // branch (it read 4,575 of 3,000 with the make-up and the restroom exhaust counted on it).
    expect(await page.evaluate(() => window.state.activeGroupId)).toBeNull();
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).ductRuns.filter((r) => r.systemGroupId).map((r) => r.name).sort())).toEqual(['Kitchen branch', 'Supply main']);
    expect(await page.evaluate(() => Math.round(window.App.getDuctSystemDesignedCfm(window.state.groups[0].id)))).toBe(2350);   // the interlock card's number
    expect((await ductRow(page, 'duct-systems-capacity')).verdict).toBe('ok');
    const s = await schedule(page);
    expect(s.rows.some(([k, ft]) => /^8/.test(k) && Math.abs(ft - 27.58) < 0.2)).toBe(true);   // 275 + 56 plan px of round, in ten-foot sticks
    const gd = s.rows.find(([k]) => /^18/.test(k));
    expect(gd[2]).toBe(16);                                                                    // the material's fixed gauge, not the table's 24
    expect(gd[1]).toBeCloseTo(10.08, 1);                                                       // 77 + 44 plan px at 0.75 pt each, 9 pt to the foot
    expect(gd[3]).toBeCloseTo(11.78, 1);                                                       // π·18/12 × 2.5 lb/ft²
    expect(s.fittings.some(([t, n, m]) => /elbow/i.test(t) && m === 'black-steel' && n >= 1)).toBe(true);
    expect(s.grease).toEqual({ cleanouts: 1, atBends: 1, wrapSqFt: 47.5 });                     // one at the elbow, none along 10 ft; 10.08 × π·18/12
  },
  whole: async (page) => {
    const ref = await page.evaluate(() => window.App.courseHvacReference());
    expect(Object.keys(ref.feet)).toEqual(['24x12', '20x12', '16x10', '12x10', '12x8', '10x8', '20x16', '8"ø', '18"ø']);
    const s = await schedule(page);
    const by = Object.fromEntries(s.rows.map(([k, ft]) => [k.replace(/×/g, 'x').replace(/\s/g, ''), ft]));
    for (const k of Object.keys(ref.feet)) { const mine = by[k] != null ? by[k] : by[Object.keys(by).find((x) => x.startsWith(k.replace(/"ø/, ''))) || '']; expect([k, Math.abs((mine || 0) - ref.feet[k]) < 0.1]).toEqual([k, true]); }
    expect(ref.counts.reduce((t, c) => t + c[1], 0)).toBe(26);
    expect(await page.locator('#tourBody').innerText().catch(() => '')).not.toContain('Counts short');
  },
  bid: async (page) => {
    expect(await page.evaluate(() => ['scale-verified', 'duct-oa-code', 'duct-fire-dampers'].map((k) => window.state.bidCheck.manual[k]))).toEqual([true, true, true]);
  },
};
const REVEALS = { before: [], sheet: ['what', 'balance'], rooms: ['why', 'deck'], diffusers: ['neck'], system: ['designed'], main: ['why'], plenum: ['static'], exhaust: ['why', 'nodamper', 'interlock'], whole: [], bid: ['rows'] };

test.describe('The HVAC course: the chapters', () => {
  for (const id of Object.keys(EXPECT)) {
    test('chapter "' + id + '": reveals its answers, does every step on real state, ticks it, and hands back to the course', async ({ page }) => {
      test.setTimeout(180000);
      const errors = [];
      await boot(page, '/app/?chapter=hvac:' + id, errors);
      await page.waitForFunction(() => window.App.tutorialStepId() === 'sheets', null, { timeout: 10000 });
      expect(await page.evaluate(() => window.App.tutorialId())).toBe('course:hvac:' + id);
      const { walked, revealed, skipped } = await walk(page);
      expect(skipped).toEqual([]);
      expect(walked[0]).toBe('sheets');
      expect(walked[walked.length - 1]).toBe('done');
      expect(revealed).toEqual(REVEALS[id]);
      if (id === 'before') expect(walked).toEqual(['sheets', 'set', 'estimator', 'verbs', 'header', 'sidebar', 'bottom', 'done']);   // read cards only, each passed with Next
      expect(await page.evaluate(() => [window.state.pages.length, window.state.currentProjectName, window.state.trade])).toEqual([3, 'sample-hvac', 'hvac']);
      await EXPECT[id](page);
      expect(await page.evaluate((k) => !!window.App.courseDone()['hvac:' + k], id)).toBe(true);
      await expect(page.locator('#learnModal')).toHaveClass(/visible/);
      await expect(page.locator('#learnCourseList-hvac .learn-row[data-chapter="' + id + '"]')).toHaveClass(/learn-row-done/);
      const ids = await page.evaluate(() => window.App.courseHvacIds());
      const next = ids[ids.indexOf(id) + 1];
      if (next) await expect(page.locator('#learnCourseList-hvac .learn-row[data-chapter="' + next + '"]')).toHaveClass(/learn-row-next/);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('The HVAC course: a question is answered with a click', () => {
  test('the wrong roof key is refused and told why', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:sheet', errors);
    await openSheets(page);
    await gotoStep(page, 'unit');
    await page.evaluate(() => { const k = window.App.lessonKit; const c = { id: window.App.uid(), name: 'RTU-1', icon: window.App.getOrderedIcons()[0].value, color: '#2e86de', lesson: true }; window.state.counters.push(c); k.mark(0, c, [k.P(998, 255)]); k.dirty(); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/EF-1 pulls 2,400 CFM out of the hood/);
    await page.evaluate(() => { const k = window.App.lessonKit; const c = window.state.counters.find((x) => x.name === 'RTU-1'); k.mark(0, c, [k.P(998, 328)]); k.dirty(); });
    await page.waitForFunction(() => window.App.tutorialStepId() === 'schedule', null, { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('a grease run traced galvanized is sent to its material; a fire damper at a wall that is not rated is refused', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:exhaust', errors);
    await openSheets(page);
    await gotoStep(page, 'grease');
    await page.evaluate(() => { const k = window.App.lessonKit; const a = window.App.ensureActiveCanvas(window.state.pages[0]).annotations; a.ductRuns.push(window.makeDuctRun({ name: "Hood", airside: "exhaust", vertices: [k.P(836, 323), k.P(836, 400), k.P(880, 400)], segments: [{ startVertexIdx: 0, size: window.makeRoundSize(18) }] })); window.App.reinferDuctFittings(0); k.dirty(); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/galvanized: right-click it and set its Material to Black steel/);
    await page.evaluate(() => { const a = window.App.ensureActiveCanvas(window.state.pages[0]).annotations; a.ductRuns[a.ductRuns.length - 1].material = 'black-steel'; window.App.lessonKit.dirty(); });
    await page.waitForFunction(() => window.App.tutorialStepId() === 'why', null, { timeout: 5000 });
    await gotoStep(page, 'dampers');
    await page.evaluate(() => { const k = window.App.lessonKit; const c = { id: window.App.uid(), name: 'Fire Damper', icon: window.App.getOrderedIcons()[0].value, color: '#e85447', lesson: true }; window.state.counters.push(c); k.mark(0, c, [k.P(904, 470)]); k.dirty(); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/That wall is not rated/);
    await page.evaluate(() => { const k = window.App.lessonKit; const c = window.state.counters.find((x) => x.name === 'Fire Damper'); const a = window.App.ensureActiveCanvas(window.state.pages[0]).annotations; a.counterMarkers[c.id] = []; k.mark(0, c, [k.P(572, 296), k.P(904, 296)]); k.dirty(); });
    await page.waitForFunction(() => window.App.tutorialStepId() === 'nodamper', null, { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('the main traced by hand at the wrong size is named: the plan says 24x12, 20x12, 16x10, 12x10', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:main', errors);
    await openSheets(page);
    await gotoStep(page, 'trace');
    await page.evaluate(async () => { const k = window.App.lessonKit; document.getElementById('ductBtn').click(); await new Promise((r) => setTimeout(r, 100)); window.App.setDuctCreateSize({ kind: 'rect', w: 24, h: 12 }); document.getElementById('ductCreateStart').click(); await new Promise((r) => setTimeout(r, 50)); window.App.commitDuctClick(k.P(904, 328)); window.App.commitDuctClick(k.P(904, 282)); window.App.commitDuctClick(k.P(560, 282)); window.App.applyDuctSizeStep({ kind: 'rect', w: 18, h: 12 }); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/The plan says 24x12, 20x12, 16x10, 12x10 along this run/);
    expect(errors).toEqual([]);
  });

  // HC-TRADE T3 (settled 2026-09-27): each size is printed at the line across the duct where it
  // changes, so a click at the change reads the new size. The labels sat 5 ft downstream of it.
  test('the plan prints each size at its change: the pointer at each change vertex reads that size', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:main', errors);
    await openSheets(page);
    await gotoStep(page, 'trace');
    await page.evaluate(async () => { const k = window.App.lessonKit; document.getElementById('ductBtn').click(); await new Promise((r) => setTimeout(r, 100)); window.App.setDuctCreateSize({ kind: 'rect', w: 24, h: 12 }); document.getElementById('ductCreateStart').click(); await new Promise((r) => setTimeout(r, 50)); window.App.commitDuctClick(k.P(904, 328)); window.App.commitDuctClick(k.P(904, 282)); });
    for (const [x, want] of [[560, '20x12'], [420, '16x10'], [300, '12x10']]) {
      await page.waitForFunction(([px, w]) => { const k = window.App.lessonKit; window.state.mousePos = k.P(px, 282); const o = window.App.getDuctCalloutOffer(); return !!o && o.str.replace(/\s/g, '') === w; }, [x, want], { timeout: 10000 });
      await page.evaluate(([px, w]) => { const k = window.App.lessonKit; window.App.commitDuctClick(k.P(px, 282)); const [a, b] = w.split('x').map(Number); window.App.applyDuctSizeStep({ kind: 'rect', w: a, h: b }); }, [x, want]);
    }
    expect(errors).toEqual([]);
  });

  test('a committed main survives the trace step\'s hint being read (the hint used to pop it)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:main', errors);
    await openSheets(page);
    await gotoStep(page, 'trace');
    // three committed runs at the wrong size, pushed straight in the way a reader's own traces land
    await page.evaluate(() => {
      const a = window.App.getActiveAnnotations(window.state.pages[0]);
      for (let i = 0; i < 3; i++) a.ductRuns.push(window.makeDuctRun({ vertices: [{ x: 900 - i * 10, y: 330 }, { x: 900 - i * 10, y: 280 }], startSize: { kind: 'rect', w: 24, h: 12 }, airside: 'supply' }));
      window.App.updateUI();
    });
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).ductRuns.length)).toBe(3);
    await expect(page.locator('#tourStatus')).toHaveText(/That run went in as/);
    await page.waitForTimeout(3000);   // the hint is re-read many times in three seconds
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).ductRuns.length)).toBe(3);
    expect(errors).toEqual([]);
  });

  test('the doors: the empty-canvas link, Project Settings, ?course=hvac; three courses in one menu', async ({ page }) => {
    const errors = [];
    await pastStartHere(page);   // a returning device: the empty canvas shows the course links
    await boot(page, '/app/?course=hvac', errors);
    await expect(page.locator('#learnModal')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#learnCourseList-hvac .learn-row')).toHaveCount(10);   // chapter 0, Before you count, then the nine
    await expect(page.locator('#learnCourseList-electrical .learn-row')).toHaveCount(await page.evaluate(() => window.App.courseElectricalIds().length));
    await expect(page.locator('#learnCourseList-plumbing .learn-row')).toHaveCount(await page.evaluate(() => window.App.courseChapterIds().length));
    await expect(page.locator('#learnCourseProgress-hvac')).toHaveText('0 of 9 done');   // the opener, row 0, is read, not counted
    await page.click('#learnModal [data-modal-close]');
    await page.click('#canvasEmptyHintCourseHvac');
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    await page.click('#learnModal [data-modal-close]');
    await page.click('#settingsGearBtn');
    if (await page.getAttribute('#settingsHelpToggle', 'aria-expanded') !== 'true') await page.click('#settingsHelpToggle');
    await page.click('#settingsCourseHvac');
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    await page.click('#learnCourseList-hvac .learn-row[data-chapter="main"]');
    await page.waitForFunction(() => window.App.tutorialId() === 'course:hvac:main');
    expect(errors).toEqual([]);
  });
});

// Walked by hand on a returning estimator's device (2026-09-25): a standing "RTU Roof" in the
// palette, the mouse and keyboard on every step, never the step's own button.
test.describe('The HVAC course, by hand', () => {
  const zones = (page) => page.evaluate(() => window.App.tutorialZoneScreen());
  const lit = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const a = e.getBoundingClientRect(), b = document.getElementById('tourSpot').getBoundingClientRect(); return b.width > 0 && Math.abs(a.left - 6 - b.left) < 3 && Math.abs(a.top - 6 - b.top) < 3; }, sel);
  const dragBox = async (page, z) => {
    const a = { x: (z.outer.x1 + z.inner.x1) / 2, y: (z.outer.y1 + z.inner.y1) / 2 }, b = { x: (z.outer.x2 + z.inner.x2) / 2, y: (z.outer.y2 + z.inner.y2) / 2 };
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
  };

  test('chapter 1: a standing "RTU Roof" is not an armed counter; a folded PAGES lights its ▶ and says so', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:sheet', errors);
    await page.evaluate(() => { window.state.counters.push({ id: 'st-rtu', name: 'RTU Roof', icon: window.App.getOrderedIcons()[0].value, color: '#8a4bb0' }); });
    await openSheets(page);
    await gotoStep(page, 'unit');
    await page.waitForTimeout(600);
    await expect(page.locator('#tourStatus')).not.toContainText('armed');
    await page.evaluate(() => { const k = window.App.lessonKit; const c = { id: window.App.uid(), name: 'RTU-1', icon: window.App.getOrderedIcons()[0].value, color: '#2e86de', lesson: true }; window.state.counters.push(c); k.mark(0, c, [k.P(998, 328)]); k.dirty(); });
    await page.waitForFunction(() => window.App.tutorialStepId() === 'schedule', null, { timeout: 5000 });
    await page.evaluate(() => { if (!document.getElementById('pagesSection').classList.contains('collapsed')) document.getElementById('pagesCollapseIcon').click(); });
    await page.waitForTimeout(600);
    await expect(page.locator('#tourStatus')).toContainText('PAGES is folded');
    expect(await lit(page, '#pagesCollapseIcon')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('chapter 2: the kitchen box is named KITCHEN, not the sideways FRYER; the ring goes Room type, Target CFM, Save', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:rooms', errors);
    await openSheets(page);
    await gotoStep(page, 'kitchen');
    await page.waitForTimeout(800);
    await page.keyboard.press('v');
    await dragBox(page, (await zones(page))[0]);
    await expect(page.locator('#roomBoxModal')).toHaveClass(/visible/);
    await expect(page.locator('#roomBoxNewRoomName')).toHaveValue('KITCHEN');
    await page.fill('#roomBoxHeight', '9'); await page.fill('#roomBoxDeck', '12');
    await page.click('#roomBoxApply');
    await page.locator('#roomsList .room-row', { hasText: 'KITCHEN' }).click();
    await page.waitForTimeout(600);
    expect(await lit(page, '#roomEditType')).toBe(true);
    await page.selectOption('#roomEditType', 'custom'); await page.waitForTimeout(600);
    expect(await lit(page, '#roomEditTargetCfm')).toBe(true);
    await page.fill('#roomEditTargetCfm', '800'); await page.waitForTimeout(600);
    expect(await lit(page, '#roomEditSave')).toBe(true);
    await page.click('#roomEditSave');
    await expect(page.locator('#tourStatus')).toContainText('Now the hall', { timeout: 3000 });
    expect(errors).toEqual([]);
  });

  test('chapter 3: Read a schedule is offered on an HVAC project, and a drag over M-501 proposes the seven counters', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:diffusers', errors);
    await openSheets(page);
    await page.waitForTimeout(600);
    expect(await lit(page, '#pagesList')).toBe(true);   // M-501 first, the card's line 1
    await page.locator('#pagesList .sidebar-item', { hasText: 'M-501' }).first().click({ position: { x: 80, y: 10 } });
    await page.waitForTimeout(800);
    await page.click('#addCounter');
    await page.click('#counterModal .counter-tab[data-tab="create"]');
    await expect(page.locator('#counterReadSchedule')).toBeVisible();
    await page.click('#counterReadSchedule');
    await page.waitForTimeout(700);
    const z = (await zones(page))[0];
    expect(z && z.kind).toBe('box');   // the boundary the drag goes in, and the card keeps off it
    await dragBox(page, z);
    await expect(page.locator('#schedulePaletteModal')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#schedulePaletteList .schedule-palette-row')).toHaveCount(7);
    await page.click('#schedulePaletteCreate');
    await page.waitForTimeout(600);
    const sd1 = await page.evaluate(() => window.state.counters.find((c) => c.tag === 'SD-1').id);
    expect(await lit(page, '#countersList [data-counter-id="' + sd1 + '"] .edit-btn')).toBe(true);   // the next CFM to type
    expect(errors).toEqual([]);
  });

  test('chapter 6: the depth proof ticks per click and holds when the reader moves to M-101 before Next', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:plenum', errors);
    await openSheets(page);
    await page.evaluate(() => window.App.tutorialDoStep());   // (spec seam) M-601's 1/2", the chapter's first step
    await page.waitForFunction(() => window.App.getPageScale(2), null, { timeout: 5000 });
    await gotoStep(page, 'depth');
    await page.waitForTimeout(800);
    await expect(page.locator('#tourStatus')).toHaveText('0 of 2 done');
    const z = await zones(page);
    await page.click('#measureBtn');
    await page.mouse.click(z[0].cx + 1, z[0].cy + 1);
    await expect(page.locator('#tourStatus')).toHaveText('1 of 2 done');
    await page.mouse.click(z[1].cx - 1, z[1].cy - 1);
    await expect(page.locator('#tourStatus')).toHaveText('✓ Done');
    await page.evaluate(() => { window.state.currentPage = 0; window.App.updateUI(); });   // a sheet change before Next
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.App.tutorialStepInfo().done || window.App.tutorialStepId() !== 'depth')).toBe(true);
    expect(errors).toEqual([]);
  });

  // CI-HVAC-PLENUM (2026-09-27): "Will it blow?" with its answer shown was 744 px tall at 1280 x 720.
  // Its Next sat 23 px below the window on a Mac and wholly below it on CI's Linux, where the same
  // text wraps a little taller, so the chapter could not be finished. The card now fits the window
  // and scrolls inside itself, with Back and Next pinned at its foot. 600 px is shorter than CI's.
  test('chapter 6: the longest card, its answer shown, fits a short window and Next stays on screen', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 600 });
    const errors = [];
    await boot(page, '/app/?chapter=hvac:plenum', errors);
    await openSheets(page);
    await gotoStep(page, 'static');
    await page.click('#tourReveal');
    await expect(page.locator('.tour-reveal')).toBeVisible();
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => { const c = document.getElementById('tourCard').getBoundingClientRect(); const n = document.getElementById('tourNext').getBoundingClientRect(); return { top: c.top, bottom: c.bottom, nextTop: n.top, nextBottom: n.bottom, vh: window.innerHeight }; });
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(box.vh);
    expect(box.nextBottom).toBeLessThanOrEqual(box.bottom);
    await page.click('#tourNext');
    await page.waitForFunction(() => window.App.tutorialStepId() !== 'static', null, { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('tourCard').scrollTop)).toBe(0);   // the next card opens at its title
    expect(errors).toEqual([]);
  });
});

// DS-DINING-ATTACH (journeys/plans/TESTER-DOSSIER-HVAC-2026-09-27.md, A1 and A2).
test.describe('The HVAC course: the air lands where the plan hangs it', () => {
  // M-101 plan px → sheet points (the course's K().P): 60 + 0.75·x, 70 + 0.75·y
  const P = (x, y) => ({ x: 60 + 0.75 * x, y: 70 + 0.75 * y });
  const hungOn = (page, spot) => page.evaluate((sp) => {
    const a = window.App.getActiveAnnotations(window.state.pages[0]);
    const devs = [];
    window.state.counters.filter((c) => c.cfm > 0).forEach((c) => (a.counterMarkers[c.id] || []).forEach((m) => devs.push({ x: m.x, y: m.y, tag: c.tag, cfm: c.cfm })));
    const here = devs.filter((d) => Math.hypot(d.x - sp.x, d.y - sp.y) < 1);
    return window.attachDuctDevices(here, a.ductRuns).attached.map((x) => [x.device.tag, (a.ductRuns.find((r) => r.id === x.runId) || {}).name]);
  }, spot);
  const balance = (page, name) => page.evaluate((n) => { const r = window.App.getRoomAirBalance().find((x) => x.name === n); return r ? [Math.round(r.targetCfm), Math.round(r.servedCfm), !!r.under] : null; }, name);

  test('chapter 5: Hang them for me hangs the south-east dining diffuser on the main its flex leaves from, and DINING stays served', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:main', errors);
    await openSheets(page);
    for (const s of ['trace', 'kitchen', 'attach']) { await gotoStep(page, s); await page.waitForTimeout(300); await page.evaluate(() => window.App.tutorialDoStep()); await page.waitForTimeout(500); }
    expect(await hungOn(page, P(520, 282))).toEqual([['SD-1', 'Supply main'], ['SD-1', 'Supply main']]);   // the north-east and the south-east, each up its flex to the main (68 px)
    expect(await hungOn(page, P(572, 350))).toEqual([]);                                // not across the dining wall onto the kitchen branch, 52 px
    expect(await balance(page, 'DINING')).toEqual([1200, 1200, false]);                 // the row chapter 3 ticked still reads ✓
    expect((await ductRow(page, 'duct-rooms-served')).verdict).toBe('ok');
    expect(await page.evaluate(() => Math.round(window.App.getDuctSystemDesignedCfm(window.state.groups[0].id)))).toBe(2350);   // the fittings card's number
    expect(errors).toEqual([]);
  });

  test('chapter 8: Finish the takeoff for me reads RTU-1 at the schedule\'s 2,650 and walks the supply for its Static path', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:whole', errors);
    await openSheets(page);
    expect(await stepId(page)).toBe('lay');
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 20000 });
    const g = await page.evaluate(() => window.state.groups.find((x) => x.equipmentTag === 'RTU-1').id);
    expect(await page.evaluate((id) => Math.round(window.App.getDuctSystemDesignedCfm(id)), g)).toBe(2650);   // chapter 4: "the schedule already says where it ends: 2,650"
    const cap = await ductRow(page, 'duct-systems-capacity');
    expect([cap.verdict, cap.detail]).toEqual(['ok', 'RTU-1 · 2,650 designed / 3,000 capacity ✓']);
    const path = await page.evaluate((id) => { const p = window.App.getDuctSystemStaticPath(id); const rs = window.App.getActiveAnnotations(window.state.pages[0]).ductRuns; return p && p.path.map((rid) => { const r = rs.find((x) => x.id === rid); return [r.name, r.airside]; }); }, g);
    expect(path[0]).toEqual(['Supply main', 'supply']);                                 // from RTU-1 down its supply, not the restroom exhaust
    expect(path.every(([, air]) => air === 'supply')).toBe(true);
    expect(await hungOn(page, P(596, 506))).toEqual([['SD-1', 'Back rooms']]);         // the dish diffuser on the run the plan draws to it
    expect(await balance(page, 'DINING')).toEqual([1200, 1200, false]);
    expect(errors).toEqual([]);
  });
});

// PP-WHOLE-SKIP (2026-09-27): Skip on chapter 8's lay step leaves the sheets as they are and nothing
// fills them in. The compare card says the takeoff was skipped, in place of a list of 0.0 ft and a
// 0 lb bid weight, and sends the reader Back to Finish the takeoff for me, a button the lay card draws.
test.describe('The HVAC course: the whole set, skipped', () => {
  test('the compare card says the takeoff was skipped and Back finds Finish the takeoff for me', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=hvac:whole', errors);
    await openSheets(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'lay');
    await expect(page.locator('#tourAlt')).toHaveText('Finish the takeoff for me');
    await page.click('#tourSkip');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'compare');
    await expect(page.locator('#tourBody')).toContainText('You skipped the takeoff');
    await expect(page.locator('#tourBody')).not.toContainText('Bid weight');
    await page.click('#tourBack');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'lay');
    await expect(page.locator('#tourAlt')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

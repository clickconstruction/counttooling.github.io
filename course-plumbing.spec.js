// @ts-check
/**
 * The plumbing course (features/course-plumbing.js): nine chapters on the tour engine,
 * on the lesson set (samples/sample-lessons.pdf), teaching the trade off the engineer's
 * sheet with the app's tools. Plan: journeys/plans/PLUMBING-COURSE.md.
 *
 * Guards: every chapter's do-it-for-me path runs end to end on REAL state (a reveal step
 * shows its answer, a doing step's check passes because the thing was done) and leaves
 * the takeoff it claims, with the numbers the bodies quote; the questions answered by a
 * click refuse the wrong click and say why; the schedule reader builds the counters from
 * P-501; the finish chapter's reference matches the sheet's geometry and its compare card
 * reads the reader's takeoff; a finished chapter is ticked on this device and hands back
 * to the Learn menu at the course with the next chapter lit; the doors; the reveal itself.
 */
const { test, expect } = require('@playwright/test');

const stepId = (page) => page.evaluate(() => window.App.tutorialStepId());
async function boot(page, url, errors) {
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.startChapter);
}
// Walk a chapter the way a spec can: every doing step through the engine's seam
// (App.tutorialDoStep, the same doors a click would use), every reveal shown, Next on
// every step once it is done. Returns the ids walked, the ids whose reveal was shown,
// and any doing-step the seam could not finish (a bug).
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
        await page.waitForFunction((was) => window.App.tutorialStepId() !== was || (window.App.tutorialStepInfo() || {}).done, id, { timeout: 25000 });
      } catch (_) { skipped.push(id); await page.click('#tourSkip'); }
    }
    if (await stepId(page) === id) { await page.waitForFunction(() => !document.getElementById('tourNext').disabled, null, { timeout: 5000 }).catch(() => {}); await page.click('#tourNext'); }
    await page.waitForTimeout(150);
  }
  return { walked, revealed, skipped };
}
const ann = (page, i) => page.evaluate((idx) => { const a = window.App.getActiveAnnotations(window.state.pages[idx]); return JSON.parse(JSON.stringify(a)); }, i);
const summary = (page) => page.evaluate(() => window.getPipeToolingSummary());
const countOf = (page, re) => page.evaluate((src) => { const c = window.state.counters.find((x) => new RegExp(src, 'i').test(x.name)); if (!c) return -1; let n = 0; window.state.pages.forEach((p) => (p.canvases || []).forEach((cv) => { n += (((cv.annotations || {}).counterMarkers || {})[c.id] || []).length; })); return n; }, re);
const gotoStep = (page, id) => page.evaluate((s) => window.App.tutorialGoTo(s), id);
const openSheets = async (page) => { await page.waitForFunction(() => window.App.tutorialStepId() === 'sheets', null, { timeout: 10000 }); await page.click('#tourShow'); await page.waitForFunction(() => window.App.tutorialStepId() !== 'sheets', null, { timeout: 25000 }); };

const EXPECT = {
  sheet: async (page) => {
    expect(await page.evaluate(() => [window.App.getPageScale(0).pixelsPerUnit, window.state.pages[2].rotation, window.state.currentPage])).toEqual([9, 90, 2]);
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 31\'-8"');   // the string the engineer wrote, at the scale the title block claims
    expect(await countOf(page, '^HB')).toBe(1);                                                    // the hose bibb, found
    const a = await ann(page, 2);
    expect(a.highlights.length).toBe(1);                                                           // the WC-1 row
  },
  fixtures: async (page) => {
    // the counters came from the schedule reader: named by tag, carrying the tag, stamped as the chapter's
    const c = await page.evaluate(() => window.state.counters.filter((x) => x.tag).map((x) => [x.tag, x.lesson === true]));
    expect(c).toEqual([['WC-1', true], ['U-1', true], ['L-1', true], ['HS-1', true], ['3CS-1', true], ['MS-1', true], ['FD-1', true], ['FS-1', true]]);
    for (const [re, n] of [['^WC-1', 2], ['^L-1', 2], ['^HS-1', 3], ['^3CS-1', 2], ['^MS-1', 1], ['^FD-1', 10], ['^FS-1', 2]]) expect([re, await countOf(page, re)]).toEqual([re, n]);
    expect(await page.evaluate(() => { const b = window.state.numberKeyBindings; const n = (id) => window.state.counters.find((c) => c.id === id).tag; return [n(b[1].id), n(b[2].id)]; })).toEqual(['FD-1', 'HS-1']);
    expect(await page.evaluate(() => window.state.counters.find((c) => c.tag === 'FD-1').childCounts)).toEqual([{ name: 'Trap primer', qty: 1, per: 'count' }]);
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 11\'-4"');   // water closet to water closet, the wet wall
  },
  water: async (page) => {
    const a = await ann(page, 0);
    const trunk = a.polylines.find((pl) => pl.points.length === 4);
    expect(trunk).toBeTruthy();
    expect(trunk.startDrop || trunk.endDrop).toBe(4);
    expect(a.quickLines.length).toBe(1);                              // the chained lavatories, lav to lav
    expect(await countOf(page, '^RPZ')).toBe(1);
    const s = await summary(page);
    expect(s).toMatch(/ft of 1\.5in Copper CW\t99\.17/);              // 40.33 + 30.5 + 24.33 plan feet + the 4 ft riser
    expect(s).toMatch(/ft of 0\.75in Copper HWR\t40\.42/);            // the return, down the east wall
    expect(s).toMatch(/90° elbow\t3/);                                // two corners and the riser
    expect(s).toMatch(/Hanger\t10\t/);                                // from the copper rule, 1 per 10 ft over 99 ft
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => /1\.5in Copper/.test(l.name)).childCounts[0].ruleId)).toBe('plumb.hanger.copper');
  },
  waste: async (page) => {
    // the waste lines live on their own layer, the marks on the base one
    const layers = await page.evaluate(() => ({ n: window.state.pages[0].canvases.length, names: window.state.pages[0].canvases.map((c) => c.name), active: window.state.activeCanvasIdByPage[0] === window.state.pages[0].canvases[1].id }));
    expect(layers.n).toBe(2); expect(layers.names[1]).toBe('Waste'); expect(layers.active).toBe(true);
    const a = await ann(page, 0);
    const lts = await page.evaluate(() => window.state.lineTypes.map((l) => ({ id: l.id, name: l.name })));
    const ss = lts.find((l) => l.name === '4in PVC'), gw = lts.find((l) => l.name === '3in PVC');
    expect(a.polylines.filter((pl) => pl.lineTypeId === ss.id).map((pl) => pl.points.length)).toEqual([4]);
    expect(a.polylines.filter((pl) => pl.lineTypeId === gw.id).length).toBe(2);
    expect([await countOf(page, '^CO '), await countOf(page, '^VTR')]).toEqual([4, 2]);
    expect(await summary(page)).toMatch(/ft of 4in PVC\t66\.25/);     // 29 + 10 + 27.25 plan feet, no riser: it is under the slab
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 29\'-0"');   // the cleanout under MEN to the east wall
    const base = await page.evaluate(() => JSON.parse(JSON.stringify(window.state.pages[0].canvases[0].annotations)));
    expect(base.notes.some((n) => /never enters the interceptor/.test(n.text))).toBe(true);
    expect(await page.evaluate(() => window.state.bidCheckCollapsed)).toBe(false);
  },
  riser: async (page) => {
    expect(await page.evaluate(() => [window.App.getPageScale(3).pixelsPerUnit, window.state.currentPage])).toEqual([18, 3]);
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 4\'-0"');    // the lavatory's trap arm, against the table's 6 ft
    const a = await ann(page, 3);
    expect(a.polylines.length).toBe(1);
    expect(await summary(page)).toMatch(/ft of 4in PVC\t17(\.0+)?\t/);  // the stack: 306 pt at 18 pt/ft
    expect(await countOf(page, '^CO ')).toBe(1);
  },
  gas: async (page) => {
    const a = await ann(page, 0);
    expect(a.polylines.length).toBe(1);
    expect(a.polylines[0].points.length).toBe(3);
    expect(await countOf(page, 'Gas Drop')).toBe(4);
    expect(a.notes.some((n) => /^RFI: Who furnishes/.test(n.text))).toBe(true);
    const s = await summary(page);
    expect(s).toMatch(/ft of 1\.25in BI\t35\.5/);                     // 23.83 + 11.67 plan feet
    expect(s).toMatch(/90° elbow\t1/);
    expect(await page.evaluate(() => { const l = window.state.lineTypes.find((x) => /BI/.test(x.name)); return [l.bendFittings.enabled, l.childCounts[0].ftInterval]; })).toEqual([true, 12]);
  },
  details: async (page) => {
    expect(await page.evaluate(() => window.App.getPageScale(1).pixelsPerUnit)).toBe(18);
    const a = await ann(page, 1);
    expect([a.scaleZones.length, a.multiplyZones.map((z) => z.multiplier)]).toEqual([1, [4]]);
    const s = await summary(page);
    expect(s).toContain('HS-1 Hand Sink\t4');
    expect(s).toContain('FD-1 Floor Drain\t4');
  },
  whole: async (page) => {
    // the reference is the sheet's geometry, and the laid takeoff meets it run for run
    const ref = await page.evaluate(() => window.App.courseReference());
    expect(Object.keys(ref.feet).sort()).toEqual(['0.75in Copper HWR', '1.25in BI', '1.25in Copper HW', '1.5in Copper CW', '2in Copper CW', '3in PVC', '4in PVC']);
    expect(ref.feet['4in PVC']).toBeCloseTo(66.25, 2);
    expect(ref.feet['3in PVC']).toBeCloseTo(96.25, 2);
    expect(ref.feet['1.5in Copper CW']).toBeCloseTo(99.17, 1);
    const s = await summary(page);
    for (const name of Object.keys(ref.feet)) {
      const m = new RegExp('ft of ' + name.replace(/[.]/g, '\\.') + '\\t([\\d.]+)').exec(s);
      expect([name, !!m]).toEqual([name, true]);
      expect(Math.abs(Number(m[1]) - ref.feet[name])).toBeLessThan(0.1);
    }
    for (const [label, n] of ref.counts) expect([label, await countOf(page, '^' + label.replace(/ /g, '.'))]).toEqual([label, n === 0 ? -1 : n]);
    expect(ref.counts.reduce((t, c) => t + c[1], 0)).toBe(34);
  },
  bid: async (page) => {
    expect(await page.evaluate(() => [window.state.bidCheck.manual['scale-verified'], window.state.bidCheck.manual['fixture-units'], window.state.bidCheck.manual['trap-arms']])).toEqual([true, true, true]);
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => /Copper/.test(l.name)).childCounts.length)).toBe(1);
  },
};
// The reveal steps each chapter carries: every one must have shown its answer on the walk.
const REVEALS = {
  sheet: ['what', 'units'], fixtures: [], water: ['trunk'], waste: ['underslab'], riser: ['why'], gas: ['meter'], details: ['why'], whole: [], bid: ['rows'],
};

test.describe('The plumbing course: the chapters', () => {
  for (const id of Object.keys(EXPECT)) {
    test('chapter "' + id + '": reveals its answers, does every step on real state, ticks it, and hands back to the course', async ({ page }) => {
      test.setTimeout(180000);
      const errors = [];
      await boot(page, '/app/?chapter=plumbing:' + id, errors);
      await page.waitForFunction(() => window.App.tutorialStepId() === 'sheets', null, { timeout: 10000 });
      expect(await page.evaluate(() => window.App.tutorialId())).toBe('course:plumbing:' + id);
      const { walked, revealed, skipped } = await walk(page);
      expect(skipped).toEqual([]);
      expect(walked[0]).toBe('sheets');
      expect(walked[walked.length - 1]).toBe('done');
      expect(revealed).toEqual(REVEALS[id]);
      expect(await page.evaluate(() => [window.state.pages.length, window.state.currentProjectName, window.state.trade])).toEqual([4, 'sample-lessons', 'plumbing']);
      await EXPECT[id](page);
      expect(await page.evaluate((k) => !!window.App.courseDone()['plumbing:' + k], id)).toBe(true);
      await expect(page.locator('#learnModal')).toHaveClass(/visible/);
      await expect(page.locator('#learnCourseList-plumbing .learn-row[data-chapter="' + id + '"]')).toHaveClass(/learn-row-done/);
      const ids = await page.evaluate(() => window.App.courseChapterIds());
      const next = ids[ids.indexOf(id) + 1];
      if (next) await expect(page.locator('#learnCourseList-plumbing .learn-row[data-chapter="' + next + '"]')).toHaveClass(/learn-row-next/);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('The plumbing course: a question is answered with a click', () => {
  test('the wrong fixture is refused and the hint says why: the hand sink for the cook line, the fixture that stays out of the interceptor, the cleanouts by name', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=plumbing:fixtures', errors);
    await openSheets(page);
    await gotoStep(page, 'handsinks');
    // the reader clicks the bar's hand sink: refused, and told which sink that was
    await page.evaluate(() => { const k = window.App.lessonKit; const c = k.counterNamed(/^hs-?1\b|hand sink/i) || k.makeCounter('HS-1 Hand Sink', 'Mounted Sink', '#47c88e'); k.mark(k.P101, c, [k.HAND_SINKS[0]]); k.dirty(); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/Not that one: it serves the bar/);
    await expect(page.locator('#tourNext')).toBeDisabled();
    await page.evaluate(() => { const k = window.App.lessonKit; const c = k.counterNamed(/^hs-?1\b|hand sink/i); k.mark(k.P101, c, [k.HAND_SINKS[1]]); k.dirty(); });
    await page.waitForFunction(() => window.App.tutorialStepId() === 'kitchen', null, { timeout: 5000 });
    // the count hint names what is missing, by room
    await page.evaluate(() => { const k = window.App.lessonKit; const c = k.counterNamed(/^fd-?1\b|floor drain/i) || k.makeCounter('FD-1 Floor Drain', 'Floor Drain', '#e85447'); k.mark(k.P101, c, [k.FD.bar1, k.FD.bar2, k.FD.kitchen1, k.FD.kitchen2, k.FD.kitchen3]); k.dirty(); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/FD-1 2 more: the dish pit, storage/);
    expect(errors).toEqual([]);
  });

  test('the note on the wrong fixture: a hand sink carries grease, and the card says so', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=plumbing:waste', errors);
    await openSheets(page);
    await gotoStep(page, 'two');
    await page.evaluate(() => { const k = window.App.lessonKit; k.addNote(k.HAND_SINKS[1], 'this one?', '#e8c547'); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/That fixture carries grease/);
    await page.evaluate(() => { const k = window.App.lessonKit; k.addNote(k.MOP, 'the mop sink: sewage, not grease', '#e8c547'); });
    await page.waitForFunction(() => window.App.tutorialStepId() === 'layer', null, { timeout: 5000 });
    await gotoStep(page, 'cleanouts');
    await page.evaluate(() => { const k = window.App.lessonKit; const c = k.makeCounter('CO Cleanout', 'Floor Drain', '#2e86de'); k.mark(k.P101, c, [k.P(592, 210), k.P(596, 436)]); k.dirty(); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/2 more: the bar's start, the turn outside the east wall/);
    expect(errors).toEqual([]);
  });

  test('the finish chapter: the status line names the first run not yet traced, and the compare card reads the takeoff live', async ({ page }) => {
    test.setTimeout(150000);
    const errors = [];
    await boot(page, '/app/?chapter=plumbing:whole', errors);
    await openSheets(page);
    await expect(page.locator('#tourStatus')).toHaveText(/Not yet traced: the 2 inch service/);
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => window.App.tutorialStepId() === 'compare', null, { timeout: 25000 });
    const text = await page.locator('#tourBody').innerText();
    expect(text).toContain('1.5in Copper CW: 99.2 ft, yours 99.2 ft ✓');
    expect(text).toContain('4in PVC: 66.3 ft, yours 66.3 ft ✓');
    expect(text).toContain('Every count matches: twelve fixture types, thirty-four marks.');
    // take one run away and the card says which
    await page.evaluate(() => { const a = window.App.getActiveAnnotations(window.state.pages[0]); const lt = window.state.lineTypes.find((l) => /HWR/.test(l.name)); a.polylines = a.polylines.filter((pl) => pl.lineTypeId !== lt.id); window.App.markProjectDirty(); window.App.updateUI(); });
    await page.waitForTimeout(600);
    expect(await page.locator('#tourBody').innerText()).toContain('0.75in Copper HWR: 40.4 ft, yours 0.0 ft, short: the hot water return');
    expect(errors).toEqual([]);
  });
});

// A returning estimator's device: a standing palette whose names share words with the course's
// counters, set BEFORE the chapter starts (the lesson remembers it), at a desktop size.
const seedStanding = (page) => page.evaluate(() => { const s = window.state, A = window.App; const icon = A.getOrderedIcons()[0].value; ['Panel Schedule Box', 'Floor Drain 4in', 'Lavatory', 'Water Closet', 'Hose Bibb', 'Duplex 15A', 'J-Box 4x4', 'Water Meter', 'RTU Roof', 'Exhaust Fan', 'Occupancy Sensor', 'Meter Base', 'Disconnect 60A', 'Diffuser 24x24', 'GFCI Bath', 'Type A'].forEach((name) => s.counters.push({ id: A.uid(), name, icon, color: '#888888' })); ['Gas 1in', '1/2in PEX', '4in PVC old'].forEach((name) => s.lineTypes.push({ id: A.uid(), name, color: '#888888' })); A.updateUI(); });
async function startOnDevice(page, chapter, errors) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(page, '/app/', errors);
  await page.waitForFunction(() => window.App.bootSettled === true);
  await page.waitForTimeout(1200);   // the restore offer for the last lesson's sheets arrives on a poll; a returning reader answers it first
  if (await page.locator('#lastSessionRestoreModal.visible').count()) await page.click('#lastSessionRestoreDiscard');
  await seedStanding(page);
  await page.evaluate((id) => window.App.startChapter(id), chapter);
  await openSheets(page);
}
const seam = async (page, until) => { for (let i = 0; i < 20; i++) { const id = await stepId(page); if (id === until) return; const info = await page.evaluate(() => window.App.tutorialStepInfo()); if (info.kind === 'do' && !info.done && info.hasAction) { await page.evaluate(() => window.App.tutorialDoStep()); await page.waitForFunction((was) => window.App.tutorialStepId() !== was || (window.App.tutorialStepInfo() || {}).done, id, { timeout: 15000 }).catch(() => {}); } if (await stepId(page) === id) await page.click('#tourNext'); await page.waitForTimeout(200); } };
// the card's box against an element's, and the step's circles under the card
const cardOver = (page, sel, text) => page.evaluate(([sel, text]) => { const el = Array.from(document.querySelectorAll(sel)).find((e) => !text || e.textContent.includes(text)); if (!el) return 'missing'; el.scrollIntoView({ block: 'nearest' }); const a = el.getBoundingClientRect(), c = document.getElementById('tourCard').getBoundingClientRect(); return !(c.right <= a.left || c.left >= a.right || c.bottom <= a.top || c.top >= a.bottom); }, [sel, text]);
const circlesUnderCard = (page) => page.evaluate(() => { const c = document.getElementById('tourCard').getBoundingClientRect(); return Array.from(document.querySelectorAll('#tourZones circle.tour-zone')).filter((z) => { const b = z.getBoundingClientRect(); return b.right > c.left && b.left < c.right && b.bottom > c.top && b.top < c.bottom; }).length; });

test.describe('The plumbing course by hand on a returning estimator\'s device (2026-09-25)', () => {
  test('the kitchen card keeps off FD-1 and the sheet moves its circles out from under it; the Quick Keys step waits for both keys and the closed dialog', async ({ page }) => {
    test.setTimeout(150000);
    const errors = [];
    await startOnDevice(page, 'fixtures', errors);
    await seam(page, 'kitchen');
    await page.waitForTimeout(1200);
    expect(await cardOver(page, '#countersList .sidebar-item', 'FD-1')).toBe(false);
    expect(await circlesUnderCard(page)).toBe(0);
    await seam(page, 'keys');
    await page.click('#statusBarQuickKeys');
    await page.waitForSelector('#quickKeysModal.visible');
    const val = (re) => page.evaluate((src) => { const o = Array.from(document.querySelector('#quickKeysModal select').options).find((x) => new RegExp(src).test(x.textContent)); return o && o.value; }, re);
    await page.locator('#quickKeysModal select').nth(0).selectOption(await val('^FD-1'));
    await page.waitForTimeout(1500);
    expect(await stepId(page)).toBe('keys');
    await expect(page.locator('#tourStatus')).toHaveText(/Now key 2: HS-1/);
    await page.locator('#quickKeysModal select').nth(1).selectOption(await val('^HS-1'));
    await expect(page.locator('#tourStatus')).toHaveText(/Close the dialog/);
    await page.click('#quickKeysDone');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'done', null, { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('the water chapter makes L-1 beside a standing Lavatory, and the card keeps off the Chain panel', async ({ page }) => {
    test.setTimeout(150000);
    const errors = [];
    await startOnDevice(page, 'water', errors);
    expect(await page.evaluate(() => window.state.counters.filter((c) => /lav/i.test(c.name)).map((c) => [c.name, !!c.lesson]))).toEqual([['Lavatory', false], ['L-1 Lavatory', true]]);
    await seam(page, 'chain');
    await page.mouse.move(700, 400);
    await page.keyboard.press('t');
    await page.waitForFunction(() => document.getElementById('chainPanel').style.display !== 'none');
    await page.waitForTimeout(900);
    expect(await cardOver(page, '#chainPanel')).toBe(false);
    expect(errors).toEqual([]);
  });

  test('the circles come back after a dialog closes on their step (the gas drops after Create Counter), and a trace counts with the reader\'s own same-named type', async ({ page }) => {
    test.setTimeout(150000);
    const errors = [];
    await startOnDevice(page, 'gas', errors);
    await seam(page, 'drops');
    await page.waitForTimeout(600);
    const circles = () => page.evaluate(() => document.querySelectorAll('#tourZones circle.tour-zone').length);
    expect(await circles()).toBe(4);
    await page.click('#addCounter');
    await page.waitForSelector('#counterModal.visible');
    expect(await circles()).toBe(0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#counterModal.visible'));
    await page.waitForTimeout(400);
    expect(await circles()).toBe(4);
    // the riser's stack: a "4in PVC" of the reader's own beside the chapter's, the trace made with the reader's
    await startOnDevice(page, 'riser', errors);
    await page.evaluate(() => { window.state.lineTypes.unshift({ id: 'mine-pvc', name: '4in PVC', color: '#888888' }); window.App.updateUI(); });
    await seam(page, 'stack');
    await page.waitForTimeout(800);
    const mine = page.locator('#lineTypesList .sidebar-item .line-type-name', { hasText: /^4in PVC$/ }).first();
    await mine.scrollIntoViewIfNeeded();
    await mine.click();
    expect(await page.evaluate(() => window.state.activeLineTypeId)).toBe('mine-pvc');
    await page.mouse.move(700, 400);
    await page.keyboard.press('p');
    const zs = await page.evaluate(() => Array.from(document.querySelectorAll('#tourZones circle.tour-zone')).map((c) => { const b = c.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }));
    expect(zs.length).toBe(2);
    for (const z of zs) { await page.mouse.click(z.x, z.y); await page.waitForTimeout(150); }
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'why', null, { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('after the whole-sheet takeoff is skipped, the Export PDFs step does not hold the reader on a hidden button', async ({ page }) => {
    test.setTimeout(150000);
    const errors = [];
    await startOnDevice(page, 'whole', errors);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'lay');
    await page.click('#tourSkip');
    await seam(page, 'pdfs');
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('specificPages')).display)).toBe('none');
    await expect(page.locator('#tourNext')).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('a question after a zoomed step gets the whole sheet back, and the cleanout question does not name its answers before the first mark', async ({ page }) => {
    test.setTimeout(150000);
    const errors = [];
    await startOnDevice(page, 'waste', errors);
    await seam(page, 'two');
    await page.waitForTimeout(600);
    const zoom = await page.evaluate(() => window.state.zoom);
    await page.evaluate(() => window.App.fitZoom());
    expect(Math.abs(zoom - await page.evaluate(() => window.state.zoom))).toBeLessThan(0.01);
    await seam(page, 'cleanouts');
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).not.toHaveText(/under MEN/);
    expect(errors).toEqual([]);
  });
});

test.describe('The plumbing course: the doors and the reveal', () => {
  test('the doors: the empty-canvas link, Project Settings, ?course=plumbing; the list and its progress', async ({ page }) => {
    const errors = [];
    await boot(page, '/app/?course=plumbing', errors);
    await expect(page.locator('#learnModal')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#learnCourseList-plumbing .learn-row')).toHaveCount(9);
    await expect(page.locator('#learnCourseList-plumbing .learn-row').first()).toHaveClass(/learn-row-next/);
    await expect(page.locator('#learnCourseProgress-plumbing')).toHaveText('0 of 9 done');
    await expect(page.locator('#learnCourseList-plumbing .learn-row').first().locator('.learn-row-title')).toHaveText('Read the sheet');
    await page.click('#learnModal [data-modal-close]');
    await expect(page.locator('#learnModal')).not.toHaveClass(/visible/);
    await page.click('#canvasEmptyHintCourse');
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    await page.click('#learnModal [data-modal-close]');
    await page.click('#settingsGearBtn');
    if (await page.getAttribute('#settingsHelpToggle', 'aria-expanded') !== 'true') await page.click('#settingsHelpToggle');
    await expect(page.locator('#settingsCourse')).toBeVisible();
    await page.click('#settingsCourse');
    await expect(page.locator('#settingsModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    // a chapter row starts that chapter
    await page.click('#learnCourseList-plumbing .learn-row[data-chapter="gas"]');
    await page.waitForFunction(() => window.App.tutorialId() === 'course:plumbing:gas');
    expect(await stepId(page)).toBe('sheets');
    expect(errors).toEqual([]);
  });

  test('a reveal step asks first: the answer waits behind the button, Next is lit throughout, Back hides it again', async ({ page }) => {
    const errors = [];
    await boot(page, '/app/?chapter=plumbing:sheet', errors);
    await openSheets(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'what', null, { timeout: 5000 });
    await expect(page.locator('#tourReveal')).toHaveText('Show the engineer\'s answer');
    await expect(page.locator('#tourNext')).toBeEnabled();
    await expect(page.locator('.tour-reveal')).toHaveCount(0);
    expect(await page.locator('#tourBody').innerText()).toContain('What does the P in P-101 tell you');
    await page.click('#tourReveal');
    await expect(page.locator('.tour-reveal')).toHaveCount(1);
    expect(await page.locator('.tour-reveal').innerText()).toContain('P is the discipline');
    await expect(page.locator('#tourReveal')).toBeHidden();
    // the card sits in the corner the step asked for (bottom right), off the sheet
    const at = await page.evaluate(() => { const r = document.getElementById('tourCard').getBoundingClientRect(); return { right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom }; });
    expect(at.right).toBeLessThan(40);
    expect(at.bottom).toBeLessThan(60);
    await page.click('#tourNext');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'scale');
    await page.click('#tourBack');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'what');
    await expect(page.locator('.tour-reveal')).toHaveCount(0);   // asked again
    await expect(page.locator('#tourReveal')).toHaveText('Show the engineer\'s answer');
    expect(errors).toEqual([]);
  });
});

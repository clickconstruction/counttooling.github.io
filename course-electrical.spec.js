// @ts-check
/**
 * The electrical course (features/course-electrical.js): nine chapters on the tour engine,
 * on the electrical set (samples/sample-electrical.pdf), the plumbing course's sibling.
 * Plan: journeys/plans/ELECTRICAL-COURSE.md.
 *
 * Guards: every chapter's path through the engine's seam runs end to end on REAL state and
 * leaves the takeoff it claims (the west-wall chain with its four verticals, the homerun to
 * LP-1, the feeder judged for fill, the voltage-drop row warning at 12 A and clearing at
 * the scheduled 6 A); the questions refuse the wrong click and say why (a duplex clicked as
 * a GFCI, a single-phase J-box for the three-phase one); the schedule reader builds the
 * five lettered counters from E-501; the reference and the compare card; a finished chapter
 * ticks and hands back to the menu at the course; the doors.
 */
const { test, expect } = require('@playwright/test');

const stepId = (page) => page.evaluate(() => window.App.tutorialStepId());
async function boot(page, url, errors) {
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.startChapterElectrical);
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
const countOf = (page, re) => page.evaluate((src) => { const c = window.state.counters.find((x) => new RegExp(src, 'i').test(x.name) || new RegExp(src, 'i').test('tag:' + (x.tag || ''))); if (!c) return -1; let n = 0; window.state.pages.forEach((p) => (p.canvases || []).forEach((cv) => { n += (((cv.annotations || {}).counterMarkers || {})[c.id] || []).length; })); return n; }, re);
const bidRow = (page, id) => page.evaluate((k) => { const r = (window.App.getBidCheck().auto || []).find((x) => x.id === k); return r ? { verdict: r.verdict, detail: r.detail } : null; }, id);
const gotoStep = (page, id) => page.evaluate((s) => window.App.tutorialGoTo(s), id);
const openSheets = async (page) => { await page.waitForFunction(() => window.App.tutorialStepId() === 'sheets', null, { timeout: 10000 }); await page.click('#tourShow'); await page.waitForFunction(() => window.App.tutorialStepId() !== 'sheets', null, { timeout: 25000 }); };

const EXPECT = {
  sheet: async (page) => {
    expect(await page.evaluate(() => [window.App.getPageScale(0).pixelsPerUnit, window.state.trade, window.state.currentPage])).toEqual([9, 'electrical', 2]);
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 3\'-0"');   // the working clearance in front of LP-1
    expect(await countOf(page, 'Panelboard')).toBe(1);
    expect((await ann(page, 2)).highlights.length).toBe(1);                                    // the dishwasher's row
  },
  devices: async (page) => {
    for (const [re, n] of [['Duplex', 11], ['GFCI', 10], ['J-Box', 6]]) expect([re, await countOf(page, re)]).toEqual([re, n]);
    expect((await ann(page, 0)).notes.some((n) => /^RFI: Kitchen receptacle drawn as a plain duplex/.test(n.text))).toBe(true);   // the engineer's miss, flagged
    expect(await page.evaluate(() => window.state.counters.filter((c) => /Duplex|GFCI/.test(c.name)).map((c) => c.mountHeightIn).sort())).toEqual([18, 44]);   // the rulebook's heights, from the Quick variants
    expect(await page.evaluate(() => { const b = window.state.numberKeyBindings; const n = (id) => window.state.counters.find((c) => c.id === id).name; return [n(b[1].id), n(b[2].id)]; })).toEqual(['Duplex Receptacle 20A', 'GFCI Receptacle 20A']);
  },
  lighting: async (page) => {
    const tags = await page.evaluate(() => window.state.counters.filter((c) => c.tag).map((c) => [c.tag, c.lesson === true]));
    expect(tags).toEqual([['A', true], ['B', true], ['C', true], ['X', true], ['EM', true]]);      // from E-501's fixture schedule, through the reader
    for (const [t, n] of [['A', 13], ['B', 10], ['C', 8], ['X', 2], ['EM', 3]]) expect([t, await countOf(page, '^tag:' + t + '$')]).toEqual([t, n]);
    expect(await countOf(page, 'Occupancy')).toBe(3);
    expect((await ann(page, 1)).notes.some((n) => /Exit sign: battery/.test(n.text))).toBe(true);
  },
  conduit: async (page) => {
    const a = await ann(page, 0);
    expect(a.quickLines.length).toBe(3);
    expect(a.quickLines.map((l) => l.endDrop)).toEqual([9.5, 9.5, 9.5]);                          // ceiling 10 ft, mount 18 in, make-up 1 ft
    expect(a.quickLines[0].startDrop).toBe(9.5);
    const s = await summary(page);
    expect(s).toMatch(/ft of 0\.75in EMT\t60\.5/);                                                // 3 × 7.5 ft on the plan + 4 verticals of 9.5
    expect(s).toMatch(/#12 THHN/);                                                                // the wire, derived
    expect(s).toMatch(/Strap\t\d+/);
    expect((await bidRow(page, 'conduit-fill')).verdict).toBe('ok');
    expect(await page.evaluate(() => [window.state.ceilingHeightFt, window.state.makeUpFt])).toEqual([10, 1]);
  },
  circuits: async (page) => {
    const g = await page.evaluate(() => window.state.groups.find((x) => x.panel === 'LP-1'));
    expect([g.circuit, g.loadAmps]).toEqual(['1', 6]);
    expect(await page.evaluate(() => { const c = window.state.counters.find((x) => x.panelName === 'LP-1'); return c && c.poles; })).toBe(42);
    expect(await summary(page)).toMatch(/ft of 0\.75in EMT HR\t84\.17/);                          // 50 + 564 + 396 plan px at 12 px/ft
    const vd = await bidRow(page, 'voltage-drop');
    expect(vd.verdict).toBe('ok');
    expect(vd.detail).toMatch(/6 A/);
    expect((await bidRow(page, 'circuits-vs-panel')).detail).toMatch(/LP-1 · 1 on plan · 42 scheduled/);
  },
  equipment: async (page) => {
    const a = await ann(page, 0);
    expect(a.notes.some((n) => /RTU-1 on the roof: 208 V three phase/.test(n.text))).toBe(true);
    expect(a.notes.some((n) => /^RFI: Who furnishes the shunt-trip breaker/.test(n.text))).toBe(true);
  },
  service: async (page) => {
    const a = await ann(page, 0);
    const lt = await page.evaluate(() => window.state.lineTypes.find((l) => /2in EMT/.test(l.name)));
    expect(lt.raceway).toEqual({ kind: 'EMT', size: '2"' });
    expect(lt.conductors.length).toBe(2);
    const feeder = a.polylines.find((pl) => pl.lineTypeId === lt.id);
    expect(feeder.startDrop || feeder.endDrop).toBe(5);
    expect(await summary(page)).toMatch(/ft of 2in EMT\t12\.33/);                                // 88 plan px + the 5 ft rise
    const fill = await bidRow(page, 'conduit-fill');
    expect(fill.verdict).toBe('ok');
    expect(fill.detail).toMatch(/2" EMT · .*3[0-9](\.\d)?% ✓/);                                   // four 3/0 and a #6: about a third
    expect([await countOf(page, '^Meter'), await countOf(page, 'Disconnect')]).toEqual([1, 1]);
  },
  whole: async (page) => {
    const ref = await page.evaluate(() => window.App.courseElectricalReference());
    expect(Object.keys(ref.feet).sort()).toEqual(['0.75in EMT', '0.75in EMT HR', '2in EMT']);
    expect(ref.feet['0.75in EMT']).toBeCloseTo(60.5, 2);
    const s = await summary(page);
    for (const name of Object.keys(ref.feet)) {
      const m = new RegExp('ft of ' + name.replace(/[.]/g, '\\.') + '\\t([\\d.]+)').exec(s);
      expect([name, !!m]).toEqual([name, true]);
      expect(Math.abs(Number(m[1]) - ref.feet[name])).toBeLessThan(0.1);
    }
    expect(ref.counts.reduce((t, c) => t + c[1], 0)).toBe(69);
    expect(await countOf(page, '^tag:B$')).toBe(10);
  },
  bid: async (page) => {
    expect(await page.evaluate(() => ['scale-verified', 'lighting-controls', 'equipment-connections'].map((k) => window.state.bidCheck.manual[k]))).toEqual([true, true, true]);
  },
};
const REVEALS = { sheet: ['what', 'row'], devices: ['heights'], lighting: ['why'], conduit: ['why12'], circuits: [], equipment: ['poles', 'dedicated'], service: ['read'], whole: [], bid: ['rows'] };

test.describe('The electrical course: the chapters', () => {
  for (const id of Object.keys(EXPECT)) {
    test('chapter "' + id + '": reveals its answers, does every step on real state, ticks it, and hands back to the course', async ({ page }) => {
      test.setTimeout(180000);
      const errors = [];
      await boot(page, '/app/?chapter=electrical:' + id, errors);
      await page.waitForFunction(() => window.App.tutorialStepId() === 'sheets', null, { timeout: 10000 });
      expect(await page.evaluate(() => window.App.tutorialId())).toBe('course:electrical:' + id);
      const { walked, revealed, skipped } = await walk(page);
      expect(skipped).toEqual([]);
      expect(walked[0]).toBe('sheets');
      expect(walked[walked.length - 1]).toBe('done');
      expect(revealed).toEqual(REVEALS[id]);
      expect(await page.evaluate(() => [window.state.pages.length, window.state.currentProjectName, window.state.trade])).toEqual([4, 'sample-electrical', 'electrical']);
      await EXPECT[id](page);
      expect(await page.evaluate((k) => !!window.App.courseDone()['electrical:' + k], id)).toBe(true);
      await expect(page.locator('#learnModal')).toHaveClass(/visible/);
      await expect(page.locator('#learnCourseList-electrical .learn-row[data-chapter="' + id + '"]')).toHaveClass(/learn-row-done/);
      const ids = await page.evaluate(() => window.App.courseElectricalIds());
      const next = ids[ids.indexOf(id) + 1];
      if (next) await expect(page.locator('#learnCourseList-electrical .learn-row[data-chapter="' + next + '"]')).toHaveClass(/learn-row-next/);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('The electrical course: a question is answered with a click', () => {
  test('the panel step passes on the counter the reader made, not an Artboard counter that shares the word (wendi, 2026-09-24)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=electrical:sheet', errors);
    await openSheets(page);
    await gotoStep(page, 'panel');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'panel');
    // A standing palette counter with "panel" in its name, no marks, ahead of the reader's in the list (the Artboard rides into the set).
    await page.evaluate(() => { const c = { id: window.App.uid(), name: 'Panel Schedule Box', icon: window.App.getOrderedIcons()[0].value, color: '#888888' }; window.state.counters.unshift(c); });
    // The reader adds Panelboard from the Quick tab (armed on Add Counter) and clicks LP-1.
    await page.evaluate(() => { const k = window.App.lessonKit; const c = { id: window.App.uid(), name: 'Panelboard Panel', icon: window.App.getOrderedIcons()[0].value, color: '#8a4bb0', mountHeightIn: 78 }; window.state.counters.push(c); window.state.activeCounterType = c.id; k.mark(0, c, [k.P(704, 506)]); k.dirty(); });
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done === true, null, { timeout: 5000 });
    await expect(page.locator('#tourNext')).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('a duplex clicked as a GFCI is refused and told why; the missing GFCIs are named by room', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=electrical:devices', errors);
    await openSheets(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'gfci');
    await page.evaluate(() => { const k = window.App.lessonKit; const c = { id: window.App.uid(), name: 'GFCI Receptacle 20A', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547', mountHeightIn: 44, lesson: true }; window.state.counters.push(c); k.mark(0, c, [k.P(136, 160)]); k.dirty(); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/no sink within 6 ft: a plain duplex/);
    await page.evaluate(() => { const k = window.App.lessonKit; const c = window.state.counters.find((x) => /GFCI/.test(x.name)); const a = window.App.getActiveAnnotations(window.state.pages[0]); a.counterMarkers[c.id] = []; k.mark(0, c, [k.P(200, 594), k.P(300, 594), k.P(640, 106), k.P(776, 106), k.P(900, 106), k.P(575, 302), k.P(930, 360), k.P(720, 358)]); k.dirty(); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/2 more: the cook line \(east\), the dish pit/);
    // the miss: a note on a labelled GFCI is refused, a note on the plain kitchen duplex is the answer
    await page.evaluate(() => { const k = window.App.lessonKit; const c = window.state.counters.find((x) => /GFCI/.test(x.name)); k.mark(0, c, [k.P(800, 358), k.P(660, 476)]); k.dirty(); });
    await page.waitForFunction(() => window.App.tutorialStepId() === 'missed', null, { timeout: 5000 });
    await page.evaluate(() => { const k = window.App.lessonKit; k.addNote(k.P(640, 106), 'RFI: this one?', '#e85447'); });
    await page.waitForTimeout(500);
    await expect(page.locator('#tourStatus')).toHaveText(/That one already says GFI/);
    await page.evaluate(() => { const k = window.App.lessonKit; k.addNote(k.P(600, 460), 'RFI: a plain duplex in the kitchen', '#e85447'); });
    await page.waitForFunction(() => window.App.tutorialStepId() === 'duplex', null, { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('the card keeps off every control a step names, not only the one it points at: COUNTERS + Add beside a sheet target (by hand, 2026-09-24)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    const apart = () => page.evaluate(() => { const c = document.getElementById('tourCard').getBoundingClientRect(), a = document.getElementById('addCounter').getBoundingClientRect(); return { apart: c.right <= a.left || c.left >= a.right || c.bottom <= a.top || c.top >= a.bottom, card: [Math.round(c.left), Math.round(c.top), Math.round(c.right), Math.round(c.bottom)], add: [Math.round(a.left), Math.round(a.top), Math.round(a.right), Math.round(a.bottom)] }; });
    await boot(page, '/app/?chapter=electrical:devices', errors);
    await openSheets(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'gfci');
    await page.waitForTimeout(600);
    expect(await apart()).toMatchObject({ apart: true });
    // the same shape in chapter 1: the panel step points at the sheet and asks for + Add
    await boot(page, '/app/?chapter=electrical:sheet', errors);
    await openSheets(page);
    await gotoStep(page, 'panel');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'panel');
    await page.waitForTimeout(600);
    expect(await apart()).toMatchObject({ apart: true });
    // chapter 4's strap row: "the pencil beside 0.75in EMT" is the sixth pencil on a device with five standing line types
    await boot(page, '/app/?course=electrical', errors);
    await page.evaluate(() => { const s = window.state; ['Gas 1in', '1/2in EMT old', '1/2in PEX', '2in EMT feeder old', '1in EMT old'].forEach((name) => s.lineTypes.push({ id: window.App.uid(), name, color: '#888888' })); window.App.updateUI(); });
    await page.evaluate(() => window.App.startChapterElectrical('conduit'));
    await openSheets(page);
    await page.evaluate(() => window.App.tutorialDoStep());   // makes 0.75in EMT, the type the strap step names
    await page.waitForFunction(() => window.state.lineTypes.some((l) => /0\.75in EMT/.test(l.name)), null, { timeout: 10000 });
    await gotoStep(page, 'straps');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'straps');
    await page.waitForTimeout(600);
    const pencil = await page.evaluate(() => { const row = Array.from(document.querySelectorAll('#lineTypesList .sidebar-item')).find((el) => el.textContent.includes('0.75in EMT')); row.scrollIntoView({ block: 'center' }); const b = row.querySelector('.edit-btn').getBoundingClientRect(), c = document.getElementById('tourCard').getBoundingClientRect(); return { apart: c.right <= b.left || c.left >= b.right || c.bottom <= b.top || c.top >= b.bottom }; });
    expect(pencil).toEqual({ apart: true });
    expect(errors).toEqual([]);
  });

  test('by hand on E-201: a click on a 2x4 troffer with A armed lands on B, and the card keeps off the counter row a long palette pushes down (2026-09-24)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?course=electrical', errors);
    // a returning estimator's palette: sixteen standing counters ahead of the chapter's
    await page.evaluate(() => { const s = window.state; const icon = window.App.getOrderedIcons()[0].value; ['Panel Schedule Box', 'Type A', 'Floor Drain 4in', 'Duplex 15A', 'GFCI Bath', 'J-Box 4x4', 'Water Meter', 'Diffuser 24x24', 'RTU Roof', 'Hose Bibb', 'Lavatory', 'Exhaust Fan', 'Occupancy Sensor', 'Disconnect 60A', 'Water Closet', 'Meter Base'].forEach((name) => s.counters.push({ id: window.App.uid(), name, icon, color: '#888888' })); window.App.updateUI(); });
    await page.evaluate(() => window.App.startChapterElectrical('lighting'));
    await openSheets(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'schedule');
    await page.evaluate(() => window.App.tutorialDoStep());   // the schedule reader; the by-hand box is the tag-reader spec's
    await page.waitForFunction(() => window.App.tutorialStepId() === 'plan', null, { timeout: 15000 });
    await page.evaluate(() => { window.App.goPage ? window.App.goPage(1) : window.App.lessonKit.goPage(1); });
    await page.waitForFunction(() => window.state.currentPage === 1 && window.App.pageTextItems(1).length > 0, null, { timeout: 15000 });
    await page.waitForTimeout(600);
    // the card is off the Type A row the step says to click
    const apart = await page.evaluate(() => { const row = Array.from(document.querySelectorAll('#countersList .sidebar-item')).find((el) => /Type A/.test(el.textContent)); const c = document.getElementById('tourCard').getBoundingClientRect(), a = row.getBoundingClientRect(); return { apart: c.right <= a.left || c.left >= a.right || c.bottom <= a.top || c.top >= a.bottom, under: (document.elementFromPoint(a.left + 30, a.top + a.height / 2) || {}).id || (document.elementFromPoint(a.left + 30, a.top + a.height / 2) || {}).className }; });
    expect(apart.apart).toBe(true);
    // A armed, a click on the center of a B troffer: the plan's letter, 20 pt away, wins
    await page.evaluate(() => { const s = window.state; s.activeCounterType = s.counters.find((c) => c.name === 'Type A').id; s.tool = window.App.TOOL.COUNTER; window.App.updateUI(); });
    await page.evaluate(() => window.App.handleCanvasClick(null, window.App.lessonKit.P(640, 380)));
    await page.evaluate(() => window.App.handleCanvasClick(null, window.App.lessonKit.P(665, 272)));
    expect(await page.evaluate(() => { const s = window.state; const m = window.App.getActiveAnnotations(s.pages[1]).counterMarkers; const n = (re) => { const c = s.counters.find((x) => re.test(x.name)); return c ? (m[c.id] || []).length : -1; }; return { a: n(/^Type A$/), b: n(/^B · /), c: n(/^C · /) }; })).toEqual({ a: 0, b: 1, c: 1 });
    expect(errors).toEqual([]);
  });

  test('a step change closes the Drop palette the rise step left open, so it never sits on the next step\'s + Add (by hand, 2026-09-24)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=electrical:service', errors);
    await openSheets(page);
    await gotoStep(page, 'feeder');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'feeder');
    await page.evaluate(() => window.App.tutorialDoStep());   // the feeder the rise goes on
    await page.waitForFunction(() => window.App.tutorialStepId() === 'rise', null, { timeout: 8000 });
    await page.mouse.click(700, 400);   // focus on the sheet, then the Drop hotkey
    await page.keyboard.press('b');
    await page.waitForFunction(() => document.getElementById('dropPanel').style.display !== 'none', null, { timeout: 3000 });
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => window.App.tutorialStepId() !== 'rise', null, { timeout: 8000 });
    await gotoStep(page, 'gear');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'gear');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.getElementById('dropPanel').style.display)).toBe('none');
    // the Chain step keeps its own palette
    await boot(page, '/app/?chapter=electrical:conduit', errors);
    await openSheets(page);
    await gotoStep(page, 'chain');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'chain');
    await page.keyboard.press('t');
    await page.waitForFunction(() => document.getElementById('chainPanel').style.display !== 'none', null, { timeout: 3000 });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.getElementById('chainPanel').style.display)).not.toBe('none');
    expect(errors).toEqual([]);
  });

  test('the voltage-drop row warns at the default load and clears at the scheduled one', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/?chapter=electrical:circuits', errors);
    await openSheets(page);
    for (const id of ['group', 'homerun', 'panelpoles', 'vd']) { await gotoStep(page, id); await page.evaluate(() => window.App.tutorialDoStep()); await page.waitForTimeout(300); }
    const warn = await bidRow(page, 'voltage-drop');
    expect(warn.verdict).toBe('warn');
    expect(warn.detail).toMatch(/12 A · #12 [4-6](\.\d)?% ⚠ → #(8|10)/);                          // the app's own arithmetic: the far receptacle at 12 A wants heavier wire
    await gotoStep(page, 'load');
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => (window.App.getBidCheck().auto.find((r) => r.id === 'voltage-drop') || {}).verdict === 'ok', null, { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('the doors: the empty-canvas link, Project Settings, ?course=electrical; the section, its progress, and both courses in one menu', async ({ page }) => {
    const errors = [];
    await boot(page, '/app/?course=electrical', errors);
    await expect(page.locator('#learnModal')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#learnCourseList-electrical .learn-row')).toHaveCount(9);
    await expect(page.locator('#learnCourseList-plumbing .learn-row')).toHaveCount(9);
    await expect(page.locator('#learnCourseList-electrical .learn-row').first()).toHaveClass(/learn-row-next/);
    await expect(page.locator('#learnCourseProgress-electrical')).toHaveText('0 of 9 done');
    await page.click('#learnModal [data-modal-close]');
    await page.click('#canvasEmptyHintCourseElectrical');
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    await page.click('#learnModal [data-modal-close]');
    await page.click('#settingsGearBtn');
    if (await page.getAttribute('#settingsHelpToggle', 'aria-expanded') !== 'true') await page.click('#settingsHelpToggle');
    await page.click('#settingsCourseElectrical');
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    await page.click('#learnCourseList-electrical .learn-row[data-chapter="lighting"]');
    await page.waitForFunction(() => window.App.tutorialId() === 'course:electrical:lighting');
    expect(errors).toEqual([]);
  });
});

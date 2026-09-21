// @ts-check
/**
 * Learn (features/lessons.js): thirteen short lessons on the tour engine, on the
 * three-sheet lesson set (samples/sample-lessons.pdf).
 *
 * Guards: every lesson's do-it-for-me path runs end to end on REAL state (each step's
 * check() passes because the thing was done, never because it was skipped) and leaves
 * the takeoff it claims; a finished lesson is ticked on this device and hands back to
 * the Learn menu with the next one lit; a lesson stands alone (each opens the sheets
 * fresh and sweeps the last lesson's palette); it never replaces a reader's own plan
 * without the app's Close project question; the doors (the empty-canvas link, Project
 * Settings, ?learn=1, ?lesson=<id>).
 */
const { test, expect } = require('@playwright/test');

const stepId = (page) => page.evaluate(() => window.App.tutorialStepId());
async function boot(page, url, errors) {
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.App && window.App.startLesson);
}
// Press "Do it for me" on every doing-step and Next on every reading (or holding) step.
// Returns the ids walked, and the ids of any doing-step that had to be SKIPPED (a bug).
async function walk(page) {
  const walked = [], skipped = [];
  for (let i = 0; i < 30; i++) {
    const id = await stepId(page);
    if (!id) break;
    walked.push(id);
    const hasAction = await page.evaluate(() => { const i = window.App.tutorialStepInfo(); return !!i && i.hasAction && !i.done; });
    if (hasAction) {
      await page.evaluate(() => window.App.tutorialDoStep());
      try {
        await page.waitForFunction((was) => window.App.tutorialStepId() !== was || document.getElementById('tourNext').classList.contains('tour-next-ready'), id, { timeout: 20000 });
      } catch (_) { skipped.push(id); }
    }
    if (await stepId(page) === id) await page.click('#tourNext');
    await page.waitForTimeout(150);
  }
  return { walked, skipped };
}
const ann = (page, i) => page.evaluate((idx) => { const a = window.App.getActiveAnnotations(window.state.pages[idx]); return JSON.parse(JSON.stringify(a)); }, i);

const EXPECT = {
  plans: async (page) => { expect(await page.evaluate(() => [window.state.pages[2].rotation, window.state.pages[2].label, window.state.currentPage])).toEqual([90, 'P-501 Fixture Schedule', 0]); },
  scale: async (page) => {
    // the sheet the lesson landed on is actually drawn (a double raster once left P-401 blank)
    await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), 40, 1, 1).data; return d[3] === 255; }, null, { timeout: 8000 });
    expect(await page.evaluate(() => window.App.getPageScale(1).pixelsPerUnit)).toBe(18);
    const a = await ann(page, 1);
    expect(a.scaleZones.length).toBe(1);
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 4\'-0"');   // the zone's 1/2" won over the sheet's 1/4"
  },
  counting: async (page) => {
    const r = await page.evaluate(() => { const c = window.state.counters.find((x) => x.name === 'Floor Drain'); return { marks: window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers[c.id].length, key: window.state.numberKeyBindings[1] && window.state.numberKeyBindings[1].id === c.id }; });
    expect(r).toEqual({ marks: 4, key: true });
  },
  measuring: async (page) => {
    expect(await page.evaluate(() => !!window.state.lineTypeSettings.snapToHorizontalVertical)).toBe(false);   // Snap is a device setting too: back as it was
    const a = await ann(page, 0);
    expect(a.polylines.length).toBe(1);
    expect(a.polylines[0].points.length).toBe(3);
    const summary = await page.evaluate(() => window.getPipeToolingSummary());
    expect(summary).toMatch(/ft of 1-1\/4in Gas\t39\.5/);      // 23.83 + 11.67 plan feet + the 4 ft riser
    expect(summary).toMatch(/90° elbow\t2/);                    // the corner, and the drop
  },
  chain: async (page) => {
    const a = await ann(page, 0);
    expect(a.quickLines.length).toBe(2);
    expect(await page.evaluate(() => window.getPipeToolingSummary())).toMatch(/Hanger\t\d+/);
  },
  repeats: async (page) => { const s = await page.evaluate(() => window.getPipeToolingSummary()); expect(s).toContain('Hand Sink\t4'); expect(s).toContain('Floor Drain\t4'); },
  organize: async (page) => {
    const r = await page.evaluate(() => { const g = window.state.groups.find((x) => x.name === 'Kitchen'); const a = window.App.getActiveAnnotations(window.state.pages[0]); let n = 0; Object.values(window.state.pages[0].canvases[0].annotations.counterMarkers).forEach((arr) => arr.forEach((m) => { if (m.group === g.id) n++; })); return { n, layers: window.state.pages[0].canvases.length, scope: window.App.getCounterListFilterScope(), hidden: window.state.hideMarks, a: !!a }; });
    expect(r).toEqual({ n: 3, layers: 2, scope: 'off', hidden: false, a: true });   // the filter is a DEVICE setting: the lesson put it back when it stopped
  },
  fixing: async (page) => {
    const r = await page.evaluate(() => { const c = window.state.counters.find((x) => /FD-1/.test(x.name)); return { name: c.name, marks: window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers[c.id].length }; });
    expect(r).toEqual({ name: 'FD-1 Floor Drain', marks: 3 });   // six seeded: the stray deleted, the bar's two cleared
  },
  notes: async (page) => { const a = await ann(page, 0); expect(a.notes.length).toBe(2); expect(a.notes.some((n) => /^RFI:/.test(n.text))).toBe(true); expect(a.highlights.length).toBe(1); },
  check: async (page) => { expect(await page.evaluate(() => [window.state.bidCheck.manual['scale-verified'], window.state.lineTypes.find((l) => /PEX/.test(l.name)).childCounts.length])).toEqual([true, 1]); },
  deliver: async () => {},
  speed: async () => {},
  cloud: async () => {},
};

test.describe('Learn: the lessons', () => {
  for (const id of Object.keys(EXPECT)) {
    test('lesson "' + id + '": do-it-for-me walks every step on real state, ticks it, and hands back to the menu', async ({ page }) => {
      test.setTimeout(120000);
      const errors = [];
      await boot(page, '/app/?lesson=' + id, errors);
      await page.waitForFunction(() => window.App.tutorialStepId() === 'sheets', null, { timeout: 10000 });
      expect(await page.evaluate(() => window.App.tutorialId())).toBe('lesson:' + id);
      if (id === 'plans') {
        // the Sheets lesson leaves Trim your set to the reader: the spotlight follows into it
        await page.evaluate(() => window.App.tutorialDoStep());
        await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 15000 });
        await page.waitForFunction(() => { const s = document.getElementById('tourSpot').getBoundingClientRect(), b = document.getElementById('preparePdfDone').getBoundingClientRect(); return s.width > 0 && Math.abs(s.left - (b.left - 6)) < 3; }, null, { timeout: 5000 });
        await page.click('#preparePdfDone');
        await page.waitForFunction(() => window.App.tutorialStepId() === 'jump', null, { timeout: 15000 });
      }
      const { walked, skipped } = await walk(page);
      expect(skipped).toEqual([]);
      expect(walked[0]).toBe(id === 'plans' ? 'jump' : 'sheets');
      expect(walked[walked.length - 1]).toBe('done');
      expect(await page.evaluate(() => [window.state.pages.length, window.state.currentProjectName, window.state.trade])).toEqual([4, 'sample-lessons', 'plumbing']);
      await EXPECT[id](page);
      expect(await page.evaluate((k) => !!window.App.lessonsDone()[k], id)).toBe(true);
      await expect(page.locator('#learnModal')).toHaveClass(/visible/);
      await expect(page.locator('#learnList .learn-row[data-lesson="' + id + '"]')).toHaveClass(/learn-row-done/);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('Learn: the menu, the doors, and the reader\'s own work', () => {
  test('the doors: the empty-canvas link, Project Settings, ?learn=1; the list, its ticks, the suggested next; the tours from the menu', async ({ page }) => {
    const errors = [];
    await page.addInitScript(() => { try { localStorage.setItem('clickcount-lessons-done', JSON.stringify({ plans: '2026-09-21T00:00:00Z' })); } catch (_) { /* noop */ } });
    await boot(page, '/app/?learn=1', errors);
    await expect(page.locator('#learnModal')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#learnList .learn-row')).toHaveCount(13);
    await expect(page.locator('#learnProgress')).toHaveText('1 of 13 done');
    await expect(page.locator('#learnList .learn-row[data-lesson="plans"]')).toHaveClass(/learn-row-done/);
    await expect(page.locator('#learnList .learn-row[data-lesson="scale"]')).toHaveClass(/learn-row-next/);   // the first one not done
    await page.click('#learnModal [data-modal-close]');
    await expect(page.locator('#learnModal')).not.toHaveClass(/visible/);
    // the empty-canvas door
    await expect(page.locator('#canvasEmptyHintLearn')).toBeVisible();
    await page.click('#canvasEmptyHintLearn');
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    // a trade tour from the menu closes the menu and starts on the engine
    await page.click('#learnTour-hvac');
    await expect(page.locator('#learnModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.App.tutorialId())).toBe('hvac');
    await page.click('#tourLeave');
    // Project Settings → Help → lessons
    await page.evaluate(() => window.App.showModal('settingsModal'));
    await page.click('#settingsHelpToggle');
    await page.click('#settingsLearn');
    await expect(page.locator('#settingsModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    // a row starts its lesson
    await page.click('#learnList .learn-row[data-lesson="counting"]');
    expect(await page.evaluate(() => window.App.tutorialId())).toBe('lesson:counting');
    expect(errors).toEqual([]);
  });

  test('a lesson never replaces the reader\'s own plan without asking, and the next lesson starts from clean sheets', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    await boot(page, '/app/', errors);
    // the reader's own plan, with a mark on it
    await page.locator('#pdfInput').setInputFiles('test-page.pdf');
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.state; s.counters.push({ id: 'mine', name: 'My Counter', icon: window.App.getOrderedIcons()[0].value, color: '#fff' }); window.App.ensureActiveCanvas(s.pages[0]).annotations.counterMarkers.mine = [{ x: 50, y: 50, id: 'm1', group: null }]; window.App.markProjectDirty(); window.App.updateUI(); });
    expect(await page.evaluate(() => window.App.startLesson('counting'))).toBe(true);
    await expect(page.locator('#tourShow')).toHaveText('Open the lesson sheets');   // the one step nobody can do by hand keeps a button that does it
    await page.click('#tourShow');
    // the app's own Close project question; Cancel keeps everything
    await expect(page.locator('#confirmModal')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#confirmTitle')).toHaveText('Close project?');
    await page.click('#confirmCancel');
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => [window.state.pages.length, window.App.projectHasAnyCanvasMarkup(), window.App.tutorialStepId()])).toEqual([1, true, 'sheets']);
    // agreeing opens the lesson sheets; the reader's palette rides along untouched
    await page.click('#tourShow');
    await page.click('#confirmOk');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'counter', null, { timeout: 30000 });
    expect(await page.evaluate(() => [window.state.pages.length, window.state.counters.map((c) => c.name)])).toEqual([4, ['My Counter']]);
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => window.App.tutorialStepId() === 'place', null, { timeout: 8000 });
    await page.click('#tourLeave');
    // the next lesson: no question over lesson sheets, the last lesson's counter swept, theirs kept
    expect(await page.evaluate(() => window.App.startLesson('notes'))).toBe(true);
    await page.click('#tourShow');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'note', null, { timeout: 30000 });
    await expect(page.locator('#confirmModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => [window.state.counters.map((c) => c.name), window.App.projectHasAnyCanvasMarkup()])).toEqual([['My Counter'], false]);
    expect(errors).toEqual([]);
  });

  test('the card never sits on the control it points at, takes the corner a step asks for, and drags', async ({ page }) => {
    test.setTimeout(90000);
    const errors = [];
    await boot(page, '/app/?lesson=repeats', errors);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'sheets', null, { timeout: 10000 });
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => window.App.tutorialStepId() === 'zone', null, { timeout: 30000 });
    const rects = () => page.evaluate(() => { const c = document.getElementById('tourCard').getBoundingClientRect(), s = document.getElementById('tourSpot').getBoundingClientRect(); return { c: { l: c.left, t: c.top, r: c.right, b: c.bottom }, s: { l: s.left + 6, t: s.top + 6, r: s.right - 6, b: s.bottom - 6 }, vw: window.innerWidth, vh: window.innerHeight }; });
    await page.waitForTimeout(500);
    let r = await rects();
    expect(r.c.r <= r.s.l || r.c.l >= r.s.r || r.c.b <= r.s.t || r.c.t >= r.s.b).toBe(true);   // no overlap with its control
    expect(r.c.l).toBeLessThan(40);                                                             // cardAt 'bl': off detail 2, which is on the right
    expect(r.c.b).toBeGreaterThan(r.vh - 80);
    // drag it by its head; it stays where it was put until the step changes
    const head = page.locator('#tourCard .tour-card-head');
    const hb = await head.boundingBox();
    await page.mouse.move(hb.x + 60, hb.y + 8);
    await page.mouse.down();
    await page.mouse.move(hb.x + 360, hb.y - 200, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    r = await rects();
    expect(r.c.l).toBeGreaterThan(250);
    expect(errors).toEqual([]);
  });
  test('by hand: the steps whose wording is easiest to get wrong pass on real clicks (rename, Quick Keys, the funnel, right-click Delete)', async ({ page }) => {
    test.setTimeout(180000);
    const errors = [];
    const open = async (id, first) => {
      await page.goto('/app/?lesson=' + id);
      await page.waitForFunction(() => window.App && window.App.tutorialStepId && window.App.tutorialStepId() === 'sheets', null, { timeout: 15000 });
      await page.evaluate(() => window.App.tutorialDoStep());
      if (id === 'plans') { await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 15000 }); await page.click('#preparePdfDone'); }
      await page.waitForFunction((want) => window.App.tutorialStepId() === want, first, { timeout: 30000 });
    };
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    // Sheets → rename: the number badge, a name, Enter
    await open('plans', 'jump');
    await page.click('#pagesList .sidebar-item[data-page-idx="2"] .name');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'rotate');
    await page.click('#rotatePage');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'rename', null, { timeout: 8000 });
    await page.click('#pagesList .sidebar-item.active .page-num-badge-editable');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('P-501 Fixture Schedule');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'marked', null, { timeout: 8000 });
    expect(await page.evaluate(() => window.state.pages[2].label)).toBe('P-501 Fixture Schedule');
    // Counting → the Quick Keys dialog's own dropdown
    await open('counting', 'counter');
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => window.App.tutorialStepId() === 'place');
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => window.App.tutorialStepId() === 'bind', null, { timeout: 8000 });
    await page.click('#statusBarQuickKeys');
    await expect(page.locator('#quickKeysModal')).toHaveClass(/visible/);
    await page.selectOption('#quickKeysList .quick-key-select[data-slot="1"]', { label: 'Floor Drain' });
    await page.click('#quickKeysDone');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'usekey', null, { timeout: 8000 });
    // Organizing → one click on the funnel
    await open('organize', 'groupson');
    await page.evaluate(() => window.App.tutorialGoTo('filter'));
    await page.click('#counterShowOnlyOnPageInlineBtn');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'layer', null, { timeout: 8000 });
    await expect(page.locator('#countersList')).not.toContainText('Urinal');
    // Fixing → right-click the stray mark, Delete
    await open('fixing', 'undo');
    await page.evaluate(() => window.App.tutorialGoTo('context'));
    const pt = await page.evaluate(() => { const c = window.App.toCanvas({ x: 60 + 0.75 * 345, y: 70 + 0.75 * 330 }); const r = document.getElementById('annCanvas').getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; return { x: r.left + c.x / dpr, y: r.top + c.y / dpr }; });
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    await expect(page.locator('#ctxDelete')).toBeVisible();
    await page.click('#ctxDelete');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'details', null, { timeout: 8000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Learn: on-sheet targets', () => {
  const zones = (page) => page.evaluate(() => window.App.tutorialZoneScreen());
  const openLesson = async (page, id, first) => {
    await page.goto('/app/?lesson=' + id);
    await page.waitForFunction(() => window.App && window.App.tutorialStepId && window.App.tutorialStepId() === 'sheets', null, { timeout: 15000 });
    await page.click('#tourShow');
    await page.waitForFunction((want) => window.App.tutorialStepId() === want, first, { timeout: 30000 });
  };
  const settle = (page) => page.waitForTimeout(700);   // the focus zoom and its raster

  test('circles: a click outside does not count and says so; a click anywhere inside each circle does; nothing on the card does the step for you', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openLesson(page, 'counting', 'counter');
    await page.evaluate(() => window.App.tutorialDoStep());   // (spec seam) the counter exists and is armed
    await page.waitForFunction(() => window.App.tutorialStepId() === 'place', null, { timeout: 8000 });
    await settle(page);
    // the card: no button does the step, Next is off, Skip is there
    await expect(page.locator('#tourAction')).toHaveCount(0);
    await expect(page.locator('#tourShow')).toHaveText('Show me where');
    await expect(page.locator('#tourNext')).toBeDisabled();
    await expect(page.locator('#tourSkip')).toBeVisible();
    // three circles, drawn on the sheet, each big enough to hit and inside the sheet area
    let zs = await zones(page);
    expect(zs.length).toBe(3);
    const wrap = await page.locator('.canvas-wrapper').boundingBox();
    zs.forEach((z) => { expect(z.r).toBeGreaterThanOrEqual(25); expect(z.cx - z.r).toBeGreaterThan(wrap.x); expect(z.cx + z.r).toBeLessThan(wrap.x + wrap.width); expect(z.cy + z.r).toBeLessThan(wrap.y + wrap.height); });
    await expect(page.locator('#tourZones circle.tour-zone')).toHaveCount(3);
    // Show me where pulses them
    await page.click('#tourShow');
    await expect(page.locator('#tourZones')).toHaveClass(/is-pulsing/);
    // outside every circle: a mark lands (the app is the app) but the step does not move, and the card says why
    const far = { x: zs[0].cx - zs[0].r - 60, y: zs[0].cy - zs[0].r - 40 };
    await page.mouse.click(far.x, far.y);
    await page.waitForTimeout(900);
    expect(await stepId(page)).toBe('place');
    expect((await zones(page)).filter((z) => z.done).length).toBe(0);
    await expect(page.locator('#tourStatus')).toContainText('outside the circles');
    // inside, but well off-centre: gracious
    for (let i = 0; i < 3; i++) {
      zs = await zones(page);
      await page.mouse.click(zs[i].cx + zs[i].r * 0.55, zs[i].cy - zs[i].r * 0.5);
      await page.waitForTimeout(250);
      expect((await zones(page))[i].done).toBe(true);
    }
    await page.waitForFunction(() => window.App.tutorialStepId() === 'bind', null, { timeout: 8000 });
    expect(errors).toEqual([]);
  });

  test('a boundary: a box that misses the detail is refused with a reason; one that wraps it inside the boundary passes', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openLesson(page, 'repeats', 'zone');
    await settle(page);
    const dragBox = async (a, b, mult) => {
      await page.keyboard.press('x');
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
      await expect(page.locator('#multiplyZoneModal')).toHaveClass(/visible/, { timeout: 5000 });
      await page.fill('#multiplyZoneMultiplier', String(mult));
      await page.click('#multiplyZoneApply');
      await page.waitForTimeout(600);
    };
    let z = (await zones(page))[0];
    expect(z.kind).toBe('box');
    await expect(page.locator('#tourZones rect.tour-zone')).toHaveCount(1);
    // 1. a box over only the left half of the detail
    await dragBox({ x: z.inner.x1 - 6, y: z.inner.y1 - 6 }, { x: (z.inner.x1 + z.inner.x2) / 2, y: z.inner.y2 + 6 }, 4);
    expect(await stepId(page)).toBe('zone');
    await expect(page.locator('#tourStatus')).toContainText('misses part');
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForTimeout(400);
    // 2. around the whole detail, corners anywhere in the boundary
    z = (await zones(page))[0];
    await dragBox({ x: (z.outer.x1 + z.inner.x1) / 2, y: (z.outer.y1 + z.inner.y1) / 2 }, { x: (z.outer.x2 + z.inner.x2) / 2, y: (z.outer.y2 + z.inner.y2) / 2 }, 4);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'read', null, { timeout: 8000 });
    expect(await page.evaluate(() => window.getPipeToolingSummary())).toContain('Hand Sink\t4');
    expect(errors).toEqual([]);
  });

  test('a traced run: a corner inside each circle, in order, ticks them as you go', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openLesson(page, 'measuring', 'snap');
    await page.click('#tourSkip');                      // snap off: the clicks below land where they are aimed
    await page.waitForFunction(() => window.App.tutorialStepId() === 'trace');
    await settle(page);
    await page.keyboard.press('p');
    for (let i = 0; i < 3; i++) {
      const zs = await zones(page);
      await page.mouse.click(zs[i].cx + 5, zs[i].cy - 4);
      await page.waitForTimeout(350);
      expect((await zones(page)).filter((c) => c.done).length).toBe(i + 1);
    }
    expect(await stepId(page)).toBe('trace');           // a trace in progress ticks circles but is not a run yet
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'bends', null, { timeout: 8000 });
    expect(errors).toEqual([]);
  });
});

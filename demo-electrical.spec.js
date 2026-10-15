// @ts-check
/**
 * The electrical demo track (features/demo-track.js + features/demo-electrical.js, DEMO-TRACK,
 * journeys/plans/DEMO-TRACK.md): five moments on the electrical set behind the test drive's
 * "Try it", one action and one payoff per card.
 *
 * Guards: every moment walked through the engine's seam (App.tutorialDoStep) with each card's check
 * passing on REAL state (the kitchen outlet counted as a GFCI and flagged with an RFI, the west wall
 * chained with its drops and its wire, the homerun traced and the voltage-drop row warning at 12 A and
 * clearing at the schedule's 6 A, the feeder traced and the fill row judging it, a signed row, Show
 * Report asked for); the ONE orientation card first; the quiet UI applied and gone when it stops, the
 * guest's device as it was; both doors; the circles held still on a zones card as a browser would
 * run it; the guest's own clicks; the ☰ wording and Trim your set never painted at 390 px; no toast
 * after a traced run; and THE CLOCK, from the goto to the first moment's payoff card, under 60 s by
 * the page's own timer, printed so a slow one is seen.
 */
const { test, expect } = require('@playwright/test');
const { collectConsoleErrors, bootApp, stepTo } = require('./spec-helpers');

const stepId = (page) => page.evaluate(() => window.App.tutorialStepId());

// Do the card (the seam, the card's own "Do it for me"), wait for its check on real state, read what
// the card says once it is done, and move on with Next. Returns the payoff text.
async function doCard(page, id) {
  await stepTo(page, id, 30000);
  const i = await page.evaluate(() => window.App.tutorialStepInfo());
  if (i.kind === 'do' && !i.done) await page.evaluate(() => window.App.tutorialDoStep());
  await page.waitForFunction((want) => window.App.tutorialStepId() !== want || (window.App.tutorialStepInfo() || {}).done, id, { timeout: 30000 });
  const said = (await page.locator('#tourBody').innerText()).trim();
  if (process.env.DEMO_SAY) console.log('[' + id + '] ' + said.replace(/\n/g, ' / '));
  return said;
}
async function next(page) {
  await page.waitForFunction(() => !document.getElementById('tourNext').disabled, null, { timeout: 5000 });
  await page.click('#tourNext');
}
const quiet = (page) => page.evaluate(() => ({
  on: document.body.classList.contains('demo-quiet'),
  folded: [...document.querySelectorAll('.demo-quiet-fold')].map((n) => n.id || 'export'),
  dimmed: [...document.querySelectorAll('.demo-quiet-dim')].map((n) => n.id),
}));
const row = (page, id) => page.evaluate((rid) => { const r = window.App.courseElectricalKit.bidRow(rid); return r ? r.verdict : null; }, id);
// A real browser glides the sheet onto a step's circles over 2.6 s; a spec (navigator.webdriver)
// gets the jump. These tests run as a browser would, so a glide under the guest's first tap shows.
const asABrowser = (page) => page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
async function pastTheOrientation(page, url, id, viewport) {
  await bootApp(page, { url, viewport: viewport || { width: 1280, height: 800 } });
  await page.waitForFunction((want) => window.App.tutorialId && window.App.tutorialId() === want, id);
  expect(await stepId(page)).toBe('welcome');
  await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
}
// Two reads of the card's circles 1.5 s apart, with no input between them, agree; each a finger wide.
async function heldStill(page, n) {
  await page.waitForFunction((want) => window.App.tutorialZoneScreen().length === want, n);
  await page.waitForTimeout(300);
  const first = await page.evaluate(() => window.App.tutorialZoneScreen());
  await page.waitForTimeout(1500);
  const again = await page.evaluate(() => window.App.tutorialZoneScreen());
  first.forEach((z, i) => { expect(Math.abs(z.cx - again[i].cx)).toBeLessThan(1); expect(Math.abs(z.cy - again[i].cy)).toBeLessThan(1); });
  first.forEach((z) => expect(z.r).toBeGreaterThanOrEqual(26));
  return again;
}

test.describe('the electrical demo track', () => {
  test.setTimeout(180000);

  test('?demo=electrical walks every moment on real state, the orientation first, the first payoff under a minute', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    // the device as the guest left it: a search word the demo must put back
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('counterSearch', 'zzz'); } });
    await pastTheOrientation(page, '/app/?demo=electrical', 'demo:electrical');
    await expect(page.locator('#tourBody')).toContainText('the lists on the left keep its totals');
    await expect(page.locator('#tourBody')).toContainText('clicks are coming');
    expect(await page.evaluate(() => [window.state.currentProjectName, window.state.trade, window.state.pages.length])).toEqual(['sample-electrical', 'electrical', 4]);
    expect(await page.evaluate(() => window.state.counterSearch || '')).toBe('');   // cleared for the demo
    const q0 = await quiet(page);
    expect(q0.on).toBe(true);
    expect(q0.folded).toEqual(expect.arrayContaining(['countersSection', 'summarySection']));
    expect(q0.dimmed).toEqual(expect.arrayContaining(['chainBtn', 'polylineBtn', 'measureBtn']));
    await next(page);

    // ----- gfci: the kitchen outlet drawn plain, counted as a GFCI, then flagged
    expect(await page.evaluate(() => window.App.courseElectricalKit.marksOf(window.App.courseElectricalKit.counter(/gfci/i), 0).length)).toBe(10);
    const firstPayoff = await doCard(page, 'count');
    const firstPayoffAt = await page.evaluate(() => performance.now());   // ms since navigation start
    expect(firstPayoff).toContain('That makes 11 GFCI outlets, not 10');
    expect(firstPayoff).toMatch(/leaves one plain on purpose/);
    await next(page);
    expect(await doCard(page, 'flag')).toMatch(/Caught before you bid/);
    const momentPayoffAt = await page.evaluate(() => performance.now());
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).notes || []).map((n) => n.text))).toEqual([expect.stringMatching(/^RFI: /)]);
    console.log('[demo-electrical clock] goto to the first payoff card: ' + Math.round(firstPayoffAt) + ' ms; to the first moment\'s last payoff: ' + Math.round(momentPayoffAt) + ' ms');
    expect(firstPayoffAt).toBeLessThan(60000);
    expect(momentPayoffAt).toBeLessThan(60000);
    await next(page);

    // ----- wire: Chain, then the west wall's four outlets
    expect((await quiet(page)).dimmed).not.toContain('chainBtn');   // the card names Chain
    expect(await doCard(page, 'chain')).toContain('knows its wires: two #12 wires and a #12 ground');
    await next(page);
    const wire = await doCard(page, 'wall');
    const feet = await page.evaluate(() => window.App.lessonKit.feetFor(/0?\.75\s*in.*emt/i, /\bhr\b/i));
    expect(feet).toBeGreaterThan(50);   // 3 runs between the outlets plus four 9.5 ft drops
    expect(wire).toContain('That is ' + String(Math.round(feet * 10) / 10) + ' feet of conduit');
    const wireFt = Number(/holds ([\d,]+) feet of #12 wire/.exec(wire)[1].replace(/,/g, ''));
    expect(Math.abs(wireFt - 3 * feet)).toBeLessThan(2);   // 2 #12 and a #12 ground in every foot
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.NONE));
    await next(page);

    // ----- circuit: the homerun, the row warning at 12 A, clearing at 6 A
    expect(await doCard(page, 'homerun')).toMatch(/That homerun is [\d.]+ feet\. Circuit 1 now reaches from panel LP-1 to its farthest outlet, \d+ feet away/);
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).polylines || []).filter((p) => p.group).length)).toBe(1);
    await next(page);
    const warned = await doCard(page, 'drop');
    expect(warned).toMatch(/⚠ At 12 amps the far outlet loses [\d.]+% of its voltage, over the 3%.*fix, #\d+ wire/);
    expect(await row(page, 'voltage-drop')).toBe('warn');
    await next(page);
    expect(await doCard(page, 'load')).toMatch(/✓ At 6 amps the drop is [\d.]+%, under 3%\. The engineer's #12 wire holds/);
    expect(await row(page, 'voltage-drop')).toBe('ok');
    await next(page);

    // ----- fill: the feeder traced, its fill against the 40% limit
    expect(await doCard(page, 'feeder')).toContain('four #3/0 wires and a #6 ground');
    await next(page);
    const fill = await doCard(page, 'limit');
    const f = await page.evaluate(() => { const lt = window.App.courseElectricalKit.lineType(/\b2\s*in.*emt/i); return window.BidCheckModel.conduitFill(lt.raceway, lt.conductors); });
    expect(f.ok).toBe(true);
    expect(fill).toContain('fill ' + String(Math.round(f.pct * 1000) / 10) + '% of the conduit, and the code allows 40%');
    expect(await row(page, 'conduit-fill')).toBe('ok');
    await next(page);

    // ----- handoff: check it, sign it, Show Report
    expect(await doCard(page, 'check')).toMatch(/\d rows checked themselves/);
    await next(page);
    expect(await doCard(page, 'sign')).toMatch(/Signed/);
    expect(await page.evaluate(() => window.state.bidCheck.manual['scale-verified'])).toBe(true);
    await next(page);
    expect(await doCard(page, 'report')).toMatch(/Learn/);
    await expect(page.locator('#showReportMenu')).toBeVisible();
    await next(page);   // Finish

    expect(await page.evaluate(() => window.App.isTutorialActive())).toBe(false);
    expect(await quiet(page)).toEqual({ on: false, folded: [], dimmed: [] });
    expect(await page.evaluate(() => window.state.counterSearch)).toBe('zzz');
    errors.assertNoErrors();
  });

  test('?demo=electrical:<moment> opens that moment alone; the orientation shows once a session', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await pastTheOrientation(page, '/app/?demo=electrical:handoff', 'demo:electrical:handoff');
    await next(page);
    // the moment stands alone: its seed laid the course's finished takeoff
    expect(await row(page, 'voltage-drop')).toBe('ok');
    expect(await row(page, 'conduit-fill')).toBe('ok');
    await doCard(page, 'check'); await next(page);
    await doCard(page, 'sign'); await next(page);
    await doCard(page, 'report'); await next(page);   // Finish
    expect(await quiet(page)).toEqual({ on: false, folded: [], dimmed: [] });

    // a second moment in the same session: no orientation, a card that waits for the sheets and moves on
    await page.evaluate(() => window.App.startDemo('electrical', 'circuit'));
    expect(await stepId(page)).toBe('open');
    await stepTo(page, 'homerun', 30000);
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).polylines || []).length)).toBe(0);   // the set reopened fresh
    expect(await page.evaluate(() => window.App.demoIds('electrical'))).toEqual(['gfci', 'wire', 'circuit', 'fill', 'handoff']);
    await page.click('#tourLeave');
    expect(await quiet(page)).toEqual({ on: false, folded: [], dimmed: [] });
    errors.assertNoErrors();
  });

  test('as a browser: the GFCI circle held still, the guest\'s own two clicks count it and flag it', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await asABrowser(page);
    await pastTheOrientation(page, '/app/?demo=electrical:gfci', 'demo:electrical:gfci');
    expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
    await next(page);
    const [z] = await heldStill(page, 1);
    await page.mouse.click(z.cx, z.cy);
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    await expect(page.locator('#tourBody')).toContainText('11 GFCI outlets');
    await next(page);
    const [n] = await heldStill(page, 1);
    await page.mouse.click(n.cx, n.cy);
    await expect(page.locator('#noteModal')).toBeVisible();
    // the demo writes the question and presses Done for the guest
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    await expect(page.locator('#noteModal')).toBeHidden();
    await expect(page.locator('#tourBody')).toContainText('Caught before you bid');
    errors.assertNoErrors();
  });

  test('as a browser: four clicks chain the west wall, two trace the feeder, a missed corner still counts, and no toast lands', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await asABrowser(page);
    await pastTheOrientation(page, '/app/?demo=electrical:wire', 'demo:electrical:wire');
    await next(page);
    // Chain is named, so it is not dimmed; a dimmed tool still works
    expect((await quiet(page)).dimmed).toContain('measureBtn');
    await page.click('#chainBtn');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done);
    await expect(page.locator('#tourBody')).toContainText('knows its wires');
    await next(page);
    const zs = await heldStill(page, 4);
    for (const z of zs) { await page.mouse.click(z.cx, z.cy); await page.waitForTimeout(120); }
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).quickLines || []).filter((l) => l.endDrop > 0).length)).toBe(3);
    await expect(page.locator('#tourBody')).toContainText('feet of #12 wire');
    await page.click('#tourLeave');

    // the circuit's homerun with its second corner 38 points off its circle: the feet still within 10%
    await page.evaluate(() => window.App.startDemo('electrical', 'circuit'));
    await stepTo(page, 'homerun', 30000);
    await page.waitForFunction(() => !!window.state.drawingPolyline);
    const hz = await heldStill(page, 4);
    const k = await page.evaluate(() => { const zs = window.App.tutorialZones(), sc = window.App.tutorialZoneScreen(); return (sc[2].cx - sc[1].cx) / (zs[2].x - zs[1].x); });
    const clicks = hz.map((z) => ({ x: z.cx, y: z.cy }));
    clicks[2] = { x: hz[2].cx - 38 * k, y: hz[2].cy };
    for (const p of clicks) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(120); }
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    expect(await page.evaluate(() => !!window.state.drawingPolyline)).toBe(false);   // finished for the guest
    expect(await page.evaluate(() => window.App.tutorialZones().every((z) => z.done))).toBe(true);
    await expect(page.locator('#tourBody')).toContainText('That homerun is');
    await page.click('#tourLeave');

    // the feeder: two clicks, finished for the guest, and the app's own notices stay quiet
    await page.evaluate(() => window.App.startDemo('electrical', 'fill'));
    await stepTo(page, 'feeder', 30000);
    await page.waitForFunction(() => !!window.state.drawingPolyline);
    const fz = await heldStill(page, 2);
    for (const z of fz) { await page.mouse.click(z.cx, z.cy); await page.waitForTimeout(120); }
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).polylines || []).length)).toBe(1);
    await page.waitForTimeout(400);
    expect(await page.locator('.toast-card:visible').count()).toBe(0);
    await page.click('#tourLeave');
    expect(await page.evaluate(() => window.App.toastMuted())).toBe(false);
    errors.assertNoErrors();
  });

  test('on a phone the sidebar cards say to open ☰ first, and Trim your set is never painted', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.addInitScript(() => {
      window.__trimSeen = 0;
      new MutationObserver(() => {
        const m = document.getElementById('preparePdfModal');
        if (m && m.classList.contains('visible') && getComputedStyle(m).visibility !== 'hidden') window.__trimSeen++;
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await pastTheOrientation(page, '/app/?demo=electrical:handoff', 'demo:electrical:handoff', { width: 390, height: 760 });
    expect(await page.evaluate(() => window.__trimSeen)).toBe(0);
    await page.waitForFunction(() => !document.body.classList.contains('demo-opening'), null, { timeout: 2000 });
    await expect(page.locator('#tourBody')).toContainText('the ☰ menu keeps its totals');
    await next(page);
    await expect(page.locator('#tourBody')).toContainText('Tap ☰, then tap BID CHECK');
    expect((await quiet(page)).dimmed).toEqual(expect.arrayContaining(['measureBtnSidebar']));
    errors.assertNoErrors();
  });
});

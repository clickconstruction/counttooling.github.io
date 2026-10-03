// @ts-check
/**
 * The HVAC demo track (features/demo-track.js + features/demo-hvac.js, DEMO-TRACK,
 * journeys/plans/DEMO-TRACK.md): five moments on the mechanical set behind the test drive's
 * "Try it", one action and one payoff per card.
 *
 * Guards: every moment walked through the engine's seam (App.tutorialDoStep) with each card's check
 * passing on REAL state (the leg traced, the schedule's pounds, DINING boxed and served, Bid Check's
 * Systems within capacity turned to ⚠ by the addendum, a signed row, Show Report asked for); the ONE
 * orientation card first, and not again in the same session; the quiet UI applied while it runs and
 * gone when it stops, the guest's device as it was; both doors; and THE CLOCK, from the goto to the
 * first moment's payoff card, under 60 s by the page's own timer, printed so a slow one is seen.
 */
const { test, expect } = require('@playwright/test');
const { collectConsoleErrors, bootApp, stepTo } = require('./spec-helpers');

const stepId = (page) => page.evaluate(() => window.App.tutorialStepId());
const info = (page) => page.evaluate(() => window.App.tutorialStepInfo());

// Do the card (the seam, the card's own "Do it for me"), wait for its check on real state, read what
// the card says once it is done, and move on with Next. Returns the payoff text.
async function doCard(page, id) {
  await stepTo(page, id, 30000);
  const i = await info(page);
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

test.describe('the HVAC demo track', () => {
  test.setTimeout(180000);

  test('?demo=hvac walks every moment on real state, the orientation first, the first payoff under a minute', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = collectConsoleErrors(page);
    // the device as the guest left it: a filter scope and a search word the demo must put back
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('counterSearch', 'zzz'); } });
    await bootApp(page, { url: '/app/?demo=hvac', viewport: { width: 1280, height: 800 } });

    // decision 3: ONE orientation card, the plan opening under it
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:hvac');
    expect(await stepId(page)).toBe('welcome');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    // the orientation reads ✓ only once the sheet is painted, and only then says what is on it
    expect(await page.evaluate(() => { const c = document.getElementById('pdfCanvas'), p = document.createElement('canvas'); p.width = p.height = 4; const x = p.getContext('2d'); x.drawImage(c, 0, 0, 4, 4); return Array.from(x.getImageData(0, 0, 4, 4).data).some((v, i) => i % 4 === 0 && v > 128); })).toBe(true);
    await expect(page.locator('#tourBody')).toContainText('the lists on the left keep its totals');
    await expect(page.locator('#tourBody')).toContainText('clicks are coming');
    expect(await page.evaluate(() => [window.state.currentProjectName, window.state.trade, window.state.pages.length])).toEqual(['sample-hvac', 'hvac', 3]);
    expect(await page.evaluate(() => window.state.counterSearch || '')).toBe('');   // cleared for the demo
    // decision 4: the quiet UI on the orientation card: every section folded, every tool dimmed
    const q0 = await quiet(page);
    expect(q0.on).toBe(true);
    expect(q0.folded).toEqual(expect.arrayContaining(['countersSection', 'summarySection']));
    expect(q0.dimmed).toEqual(expect.arrayContaining(['ductBtn', 'roomBtn', 'measureBtn']));
    await next(page);

    // ----- size: the plan tells you the duct size
    const sizeQuiet = await quiet(page);
    expect(sizeQuiet.dimmed).not.toContain('ductBtn');   // the card names Duct
    expect(sizeQuiet.dimmed).toContain('roomBtn');
    const firstPayoff = await doCard(page, 'duct');
    const firstPayoffAt = await page.evaluate(() => performance.now());   // ms since navigation start
    expect(firstPayoff).toMatch(/It read 24x12 off the plan/);
    await next(page);
    const tracePayoff = await doCard(page, 'trace');
    const momentPayoffAt = await page.evaluate(() => performance.now());
    expect(tracePayoff).toMatch(/feet of 24x12 duct/);
    expect(tracePayoff).toMatch(/elbow/);
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ductRuns || []).map((r) => r.segments.map((s) => s.size.w + 'x' + s.size.h).join(' ')))).toEqual(['24x12']);
    console.log('[demo-hvac clock] goto to the first payoff card: ' + Math.round(firstPayoffAt) + ' ms; to the first moment\'s last payoff: ' + Math.round(momentPayoffAt) + ' ms');
    expect(firstPayoffAt).toBeLessThan(60000);
    expect(momentPayoffAt).toBeLessThan(60000);
    await next(page);

    // ----- pounds: the leg made way for the whole set's duct
    const lb = await doCard(page, 'schedule');
    const bid = await page.evaluate(() => Math.round(window.App.computeDuctSchedule().bidWeightLb));
    expect(bid).toBeGreaterThan(500);
    expect(lb).toContain(bid.toLocaleString('en-US') + ' pounds of sheet metal');
    expect((await quiet(page)).folded).not.toContain('ductSection');
    await next(page);
    expect(await doCard(page, 'copy')).toMatch(/Paste it into your bid/);
    await next(page);

    // ----- rooms: DINING boxed with the schedule's air, then served
    const boxed = await doCard(page, 'box');
    expect(boxed).toMatch(/DINING is [\d,]+ square feet and [\d,]+ cubic feet\. It needs 1,200 CFM/);
    await next(page);
    expect(await doCard(page, 'serve')).toContain('DINING gets 1,200 of its 1,200 CFM');
    const dining = await page.evaluate(() => window.App.getRoomAirBalance().find((r) => r.name === 'DINING'));
    expect([dining.targetCfm, dining.servedCfm, dining.under]).toEqual([1200, 1200, false]);
    await next(page);

    // ----- mistake: ✓ until the addendum, ⚠ after it
    const capRow = () => page.evaluate(() => { const r = window.App.courseHvacKit.ductRow('duct-systems-capacity'); return r ? r.verdict : null; });
    await stepTo(page, 'open', 30000);
    expect(await capRow()).toBe('ok');
    expect(await doCard(page, 'open')).toMatch(/RTU-1 sends [\d,]+ CFM and can give 3,000/);
    await next(page);
    const caught = await doCard(page, 'addendum');
    expect(caught).toMatch(/more than its 3,000/);
    expect(await capRow()).toBe('warn');
    await expect(page.locator('#bidCheckList [data-row-id="duct-systems-capacity"]')).toHaveClass(/warn/);
    await next(page);

    // ----- handoff: check it, sign it, Show Report
    expect(await doCard(page, 'check')).toMatch(/rows checked themselves/);
    await next(page);
    expect(await doCard(page, 'sign')).toMatch(/Signed/);
    expect(await page.evaluate(() => window.state.bidCheck.manual['scale-verified'])).toBe(true);
    await next(page);
    expect(await doCard(page, 'report')).toMatch(/Learn/);
    await expect(page.locator('#showReportMenu')).toBeVisible();
    await next(page);   // Finish

    // stopped: the quiet UI gone, the guest's search word back
    expect(await page.evaluate(() => window.App.isTutorialActive())).toBe(false);
    expect(await quiet(page)).toEqual({ on: false, folded: [], dimmed: [] });
    expect(await page.evaluate(() => window.state.counterSearch)).toBe('zzz');
    errors.assertNoErrors();
  });

  test('?demo=hvac:<moment> opens that moment alone; the orientation shows once a session', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page, { url: '/app/?demo=hvac:mistake', viewport: { width: 1280, height: 800 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:hvac:mistake');
    expect(await stepId(page)).toBe('welcome');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    await next(page);
    // the moment stands alone: its seed laid the whole set, RTU-1 carrying its supply within capacity
    expect(await page.evaluate(() => { const r = window.App.courseHvacKit.ductRow('duct-systems-capacity'); return r && r.verdict; })).toBe('ok');
    await doCard(page, 'open'); await next(page);
    await doCard(page, 'addendum');
    expect(await page.evaluate(() => window.App.courseHvacKit.ductRow('duct-systems-capacity').verdict)).toBe('warn');
    await next(page);   // Finish
    expect(await quiet(page)).toEqual({ on: false, folded: [], dimmed: [] });

    // a second moment in the same session: no orientation, a card that waits for the sheets and moves on
    await page.evaluate(() => window.App.startDemo('hvac', 'size'));
    expect(await stepId(page)).toBe('open');
    await stepTo(page, 'duct', 30000);
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ductRuns || []).length)).toBe(0);   // the set reopened fresh
    // the door's ids
    expect(await page.evaluate(() => window.App.demoIds('hvac'))).toEqual(['size', 'pounds', 'rooms', 'mistake', 'handoff']);
    await page.click('#tourLeave');
    expect(await quiet(page)).toEqual({ on: false, folded: [], dimmed: [] });
    errors.assertNoErrors();
  });

  // A real browser glides the sheet onto a step's circles over 2.6 s; a spec (navigator.webdriver)
  // gets the jump. These tests run as a browser would, so a glide under the guest's first tap shows.
  const asABrowser = (page) => page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
  // Open demo:hvac:size past the orientation, click the real Duct, and stand on the trace card with
  // its circles HELD STILL: two reads 1.5 s apart, with no input between them, agree.
  async function onTheTraceCard(page) {
    await asABrowser(page);
    await bootApp(page, { url: '/app/?demo=hvac:size', viewport: { width: 1280, height: 800 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:hvac:size');
    expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    await next(page);
    await page.click('#ductBtn');
    await expect(page.locator('#ductCreateModal')).toBeVisible();
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done);
    await expect(page.locator('#tourBody')).toContainText('off the plan');
    await next(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'trace' && !!window.state.drawingDuct && window.App.tutorialZoneScreen().length === 3);
    await page.waitForTimeout(300);
    const first = await page.evaluate(() => window.App.tutorialZoneScreen());
    await page.waitForTimeout(1500);
    const again = await page.evaluate(() => window.App.tutorialZoneScreen());
    first.forEach((z, i) => { expect(Math.abs(z.cx - again[i].cx)).toBeLessThan(1); expect(Math.abs(z.cy - again[i].cy)).toBeLessThan(1); });
    // a finger's circle: 30 sheet points, at least 26 px on screen
    first.forEach((z) => expect(z.r).toBeGreaterThanOrEqual(26));
    return again;
  }

  test('a dimmed tool still works, and three taps in the held-still circles trace the leg', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await asABrowser(page);
    await bootApp(page, { url: '/app/?demo=hvac:size', viewport: { width: 1280, height: 800 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:hvac:size');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    await next(page);
    // Measure is dimmed on the Duct card and still arms
    expect((await quiet(page)).dimmed).toContain('measureBtn');
    await page.click('#measureBtn');
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.MEASURE)).toBe(true);
    await page.keyboard.press('Escape');
    await page.click('#tourLeave');
    // the trace card, its circles still, then the guest's three clicks where they are drawn
    const zs = await onTheTraceCard(page);
    for (const z of zs) { await page.mouse.click(z.cx, z.cy); await page.waitForTimeout(120); }
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ductRuns || []).length)).toBe(1);
    await expect(page.locator('#tourBody')).toContainText('elbow');
    errors.assertNoErrors();
  });

  test('a visibly right trace counts though its corner missed the circle, and Finish is pressed for the guest', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const [z1, z2, z3] = await onTheTraceCard(page);
    // the corner 38 sheet points west along the hall: outside circle 2 (30), the feet still within 10%
    const k = await page.evaluate(() => { const zs = window.App.tutorialZones(), sc = window.App.tutorialZoneScreen(); return (sc[2].cx - sc[1].cx) / (zs[2].x - zs[1].x); });
    const miss = { x: z2.cx + 38 * k * Math.sign(z3.cx - z2.cx), y: z2.cy };
    for (const p of [{ x: z1.cx, y: z1.cy }, miss, { x: z3.cx, y: z3.cy }]) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(120); }
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    expect(await page.evaluate(() => !!window.state.drawingDuct)).toBe(false);   // finished for the guest
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ductRuns || []).map((r) => r.vertices.length))).toEqual([3]);
    expect(await page.evaluate(() => window.App.tutorialZones().every((z) => z.done))).toBe(true);   // never "1 of 3 done" beside a drawn duct
    await expect(page.locator('#tourBody')).toContainText('feet of 24x12 duct');
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
    await bootApp(page, { url: '/app/?demo=hvac:pounds', viewport: { width: 390, height: 760 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:hvac:pounds');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    expect(await page.evaluate(() => window.__trimSeen)).toBe(0);
    await page.waitForFunction(() => !document.body.classList.contains('demo-opening'), null, { timeout: 2000 });   // off once the set is in
    await expect(page.locator('#tourBody')).toContainText('the ☰ menu keeps its totals');
    await next(page);
    await expect(page.locator('#tourBody')).toContainText('Tap ☰, then under DUCT tap');
    // the drawer's tool grid recedes like the header's tools
    expect((await quiet(page)).dimmed).toEqual(expect.arrayContaining(['measureBtnSidebar', 'roomBtnSidebar']));
    expect((await quiet(page)).dimmed).not.toContain('ductScheduleBtn');
    errors.assertNoErrors();
  });
});

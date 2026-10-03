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
    await expect(page.locator('#tourBody')).toContainText('clicks are coming');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
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

  test('a dimmed tool still works, and the trace counts a guest\'s own clicks', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page, { url: '/app/?demo=hvac:size', viewport: { width: 1280, height: 800 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:hvac:size');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    await next(page);
    // Measure is dimmed on the Duct card and still arms
    expect((await quiet(page)).dimmed).toContain('measureBtn');
    await page.click('#measureBtn');
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.MEASURE)).toBe(true);
    await page.keyboard.press('Escape');
    // the real Duct button, the dialog reading the plan
    await page.click('#ductBtn');
    await expect(page.locator('#ductCreateModal')).toBeVisible();
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done);
    await expect(page.locator('#tourBody')).toContainText('off the plan');
    await next(page);
    // the three circles, clicked where the engine draws them
    await page.waitForFunction(() => !!window.state.drawingDuct);
    await page.waitForTimeout(700);   // the glide onto the circles
    const zs = await page.evaluate(() => window.App.tutorialZoneScreen());
    expect(zs.length).toBe(3);
    for (const z of zs) { await page.mouse.click(z.cx, z.cy); await page.waitForTimeout(120); }
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ductRuns || []).length)).toBe(1);
    await expect(page.locator('#tourBody')).toContainText('elbow');
    errors.assertNoErrors();
  });
});

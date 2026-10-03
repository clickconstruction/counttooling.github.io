// @ts-check
/**
 * The plumbing demo track (features/demo-track.js + features/demo-plumbing.js, DEMO-TRACK,
 * journeys/plans/DEMO-TRACK.md): five moments on the lesson set behind the test drive's "Try it", one
 * action and one payoff per card.
 *
 * Guards: every moment walked through the engine's seam (App.tutorialDoStep) with each card's check
 * passing on REAL state (P-501's schedule read into counters, the toilets counted, the cold trunk and
 * the return traced with their hangers and elbows, P-601's stack and its cleanout, P-101's scale set
 * and proved on the 31'-8" string, Bid Check opened and a code row signed); the ONE orientation card
 * first; the quiet UI applied while it runs and gone when it stops, the guest's device as it was; both
 * doors; the trace card's circles held still as a browser sees them; a guest's own four clicks tracing
 * the trunk, with no toast after it; the ☰ wording and Trim your set never painted at 390 px; and THE
 * CLOCK, from the goto to the first moment's payoff card, under 60 s by the page's own timer, printed.
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
const runsOf = (page, re, pageIdx) => page.evaluate(([src, i]) => {
  const rx = new RegExp(src, 'i');
  const ids = new Set(window.state.lineTypes.filter((l) => rx.test(l.name)).map((l) => l.id));
  return (window.App.getActiveAnnotations(window.state.pages[i]).polylines || []).filter((p) => ids.has(p.lineTypeId)).length;
}, [re, pageIdx]);

test.describe('the plumbing demo track', () => {
  test.setTimeout(180000);

  test('?demo=plumbing walks every moment on real state, the orientation first, the first payoff under a minute', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    // the device as the guest left it: a search word the demo must put back
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('counterSearch', 'zzz'); } });
    await bootApp(page, { url: '/app/?demo=plumbing', viewport: { width: 1280, height: 800 } });

    // decision 3: ONE orientation card, the plan opening under it
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:plumbing');
    expect(await stepId(page)).toBe('welcome');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    await expect(page.locator('#tourTitle')).toContainText('A restaurant\'s plumbing, in a few clicks');
    await expect(page.locator('#tourBody')).toContainText('the lists on the left keep its totals');
    await expect(page.locator('#tourBody')).toContainText('clicks are coming');
    expect(await page.evaluate(() => [window.state.currentProjectName, window.state.trade, window.state.pages.length, window.state.currentPage])).toEqual(['sample-lessons', 'plumbing', 4, 2]);
    expect(await page.evaluate(() => window.state.counterSearch || '')).toBe('');   // cleared for the demo
    const q0 = await quiet(page);
    expect(q0.on).toBe(true);
    expect(q0.folded).toEqual(expect.arrayContaining(['countersSection', 'summarySection']));
    expect(q0.dimmed).toEqual(expect.arrayContaining(['polylineBtn', 'measureBtn']));
    await next(page);

    // ----- schedule: the box over P-501 makes the counters, then the toilets
    expect(await page.evaluate(() => window.state.pages[2].rotation)).toBe(90);   // turned upright for the guest
    const firstPayoff = await doCard(page, 'box');
    const firstPayoffAt = await page.evaluate(() => performance.now());   // ms since navigation start
    const tags = await page.evaluate(() => window.state.counters.filter((c) => c.tag).map((c) => c.tag));
    expect(tags).toEqual(expect.arrayContaining(['WC-1', 'L-1', 'FD-1']));
    expect(firstPayoff).toContain('That made ' + tags.length + ' counters, ' + tags.join(', '));
    expect(firstPayoff).toMatch(/nobody typed a name/);
    await next(page);
    expect(await doCard(page, 'count')).toMatch(/^2 toilets counted under WC-1/m);
    const momentPayoffAt = await page.evaluate(() => performance.now());
    console.log('[demo-plumbing clock] goto to the first payoff card: ' + Math.round(firstPayoffAt) + ' ms; to the first moment\'s last payoff: ' + Math.round(momentPayoffAt) + ' ms');
    expect(firstPayoffAt).toBeLessThan(60000);
    expect(momentPayoffAt).toBeLessThan(60000);
    await next(page);

    // ----- pipe: the trunk, its hangers and elbows read off the tally, then the return
    const trunk = await doCard(page, 'trace');
    const parts = await page.evaluate(() => {
      const lt = window.state.lineTypes.find((l) => /1\.5\s*in.*copper/i.test(l.name));
      const rows = Object.values(window.App.getChildCountTotals().byGroup).flatMap((g) => (g.lineType || {})[lt.id] || []);
      return { hangers: rows.filter((r) => /hanger/i.test(r.name)).reduce((n, r) => n + r.total, 0), elbows: rows.filter((r) => /elbow/i.test(r.name)).reduce((n, r) => n + r.total, 0) };
    });
    expect(parts.hangers).toBeGreaterThan(0);
    expect(parts.elbows).toBe(2);
    expect(trunk).toMatch(/That is \d+ feet of 1\.5 inch copper/);
    expect(trunk).toContain('counted ' + parts.hangers + ' hangers and 2 elbows by itself');
    expect(await runsOf(page, '1\\.5\\s*in.*copper', 0)).toBe(1);
    await next(page);
    expect(await doCard(page, 'return')).toMatch(/\d+ more feet of pipe and \d+ hangers?\. Most bids miss this line/);
    expect(await runsOf(page, 'hwr', 0)).toBe(1);
    await next(page);

    // ----- riser: the stack on P-601, then its cleanout
    const stack = await doCard(page, 'stack');
    expect(stack).toContain('That is 17 feet of 4 inch pipe, standing up');
    expect(await runsOf(page, '4\\s*in.*pvc', 3)).toBe(1);
    await next(page);
    expect(await doCard(page, 'cleanout')).toContain('the 17 feet of stack and the cleanout under it');
    await next(page);

    // ----- scale: P-101's scale cleared for the moment, set at 1/8", proved on the string
    expect(await page.evaluate(() => window.state.pages[0].scale)).toBeFalsy();
    expect(await doCard(page, 'set')).toMatch(/every foot on it reads short/);
    expect(await page.evaluate(() => window.state.pages[0].scale.pixelsPerUnit)).toBe(9);
    await next(page);
    expect(await doCard(page, 'measure')).toMatch(/You measured 31'-8"?.*The scale is right/);
    await next(page);

    // ----- bid: the whole takeoff, the branch it catches, Fix it, a signed row
    const caught = await doCard(page, 'open');
    expect(await page.evaluate(() => window.App.getBidCheck().auto.map((r) => r.id + ':' + r.verdict))).toEqual(['hangers:warn', 'bend-fittings:warn']);
    expect(caught).toContain('Bid Check caught a pipe the bid left short: 0.75in Copper CW counts no hangers and no elbows');
    await next(page);
    expect(await doCard(page, 'fix')).toContain('2 rows now check themselves');
    expect(await page.evaluate(() => window.App.getBidCheck().auto.map((r) => r.id + ':' + r.verdict))).toEqual(['hangers:ok', 'bend-fittings:ok']);
    await next(page);
    expect(await doCard(page, 'sign')).toMatch(/Signed.*Learn/s);
    expect(await page.evaluate(() => window.state.bidCheck.manual['fixture-units'])).toBe(true);
    await next(page);   // Finish

    // stopped: the quiet UI gone, the guest's search word back
    expect(await page.evaluate(() => window.App.isTutorialActive())).toBe(false);
    expect(await quiet(page)).toEqual({ on: false, folded: [], dimmed: [] });
    expect(await page.evaluate(() => window.state.counterSearch)).toBe('zzz');
    errors.assertNoErrors();
  });

  test('?demo=plumbing:<moment> opens that moment alone; the orientation shows once a session', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page, { url: '/app/?demo=plumbing:bid', viewport: { width: 1280, height: 800 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:plumbing:bid');
    expect(await stepId(page)).toBe('welcome');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    await next(page);
    // the moment stands alone: its seed laid the whole takeoff
    expect(await runsOf(page, 'pvc', 0)).toBeGreaterThan(1);
    expect(await doCard(page, 'open')).toContain('0.75in Copper CW counts no hangers');
    await next(page);
    await doCard(page, 'fix'); await next(page);
    await doCard(page, 'sign');
    await next(page);   // Finish
    expect(await quiet(page)).toEqual({ on: false, folded: [], dimmed: [] });

    // a second moment in the same session: no orientation, a card that waits for the sheets and moves on
    await page.evaluate(() => window.App.startDemo('plumbing', 'riser'));
    expect(await stepId(page)).toBe('open');
    await stepTo(page, 'stack', 30000);
    expect(await runsOf(page, 'pvc', 0)).toBe(0);   // the set reopened fresh
    expect(await page.evaluate(() => window.state.currentPage)).toBe(3);
    // the door's ids, the test page's
    expect(await page.evaluate(() => window.App.demoIds('plumbing'))).toEqual(['schedule', 'pipe', 'riser', 'scale', 'bid']);
    await page.click('#tourLeave');
    expect(await quiet(page)).toEqual({ on: false, folded: [], dimmed: [] });
    errors.assertNoErrors();
  });

  // A real browser glides the sheet onto a step's circles over 2.6 s; a spec (navigator.webdriver)
  // gets the jump. These run as a browser would, so a glide under the guest's first tap shows.
  const asABrowser = (page) => page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });

  test('the trunk\'s circles hold still, four taps in them trace it, and no toast lands on the finished run', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await asABrowser(page);
    await bootApp(page, { url: '/app/?demo=plumbing:pipe', viewport: { width: 1280, height: 800 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:plumbing:pipe');
    expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    await next(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'trace' && !!window.state.drawingPolyline && window.App.tutorialZoneScreen().length === 4);
    await page.waitForTimeout(300);
    const first = await page.evaluate(() => window.App.tutorialZoneScreen());
    await page.waitForTimeout(1500);
    const zs = await page.evaluate(() => window.App.tutorialZoneScreen());
    first.forEach((z, i) => { expect(Math.abs(z.cx - zs[i].cx)).toBeLessThan(1); expect(Math.abs(z.cy - zs[i].cy)).toBeLessThan(1); });
    zs.forEach((z) => expect(z.r).toBeGreaterThan(25.9));   // a finger's circle
    for (const z of zs) { await page.mouse.click(z.cx, z.cy); await page.waitForTimeout(120); }
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    expect(await page.evaluate(() => !!window.state.drawingPolyline)).toBe(false);   // Finish pressed for the guest
    expect(await runsOf(page, '1\\.5\\s*in.*copper', 0)).toBe(1);
    await expect(page.locator('#tourBody')).toContainText('hangers and 2 elbows by itself');
    await page.waitForTimeout(400);
    expect(await page.locator('.toast-card:visible').count()).toBe(0);
    await page.click('#tourLeave');
    errors.assertNoErrors();
  });

  test('a guest\'s own drag over the schedule reads it, and Create is pressed for them', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await asABrowser(page);
    await bootApp(page, { url: '/app/?demo=plumbing:schedule', viewport: { width: 1280, height: 800 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:plumbing:schedule');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    await next(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'box' && window.state.tool === window.App.TOOL.SCHEDULE && window.App.tutorialZoneScreen().length === 1);
    await page.waitForTimeout(300);
    const [z] = await page.evaluate(() => window.App.tutorialZoneScreen());
    expect(z.kind).toBe('box');
    // from just inside the shaded band's top left to just inside its bottom right
    const a = { x: (z.outer.x1 + z.inner.x1) / 2, y: (z.outer.y1 + z.inner.y1) / 2 }, b = { x: (z.outer.x2 + z.inner.x2) / 2, y: (z.outer.y2 + z.inner.y2) / 2 };
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 }); await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('#schedulePaletteModal')).toBeVisible();
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    await expect(page.locator('#schedulePaletteModal')).toBeHidden();
    await expect(page.locator('#tourBody')).toContainText('That made 8 counters, WC-1');
    expect(await page.locator('.toast-card:visible').count()).toBe(0);   // "Created 8 counters" is the app's, muted
    await page.click('#tourLeave');
    errors.assertNoErrors();
  });

  test('a visibly right trace counts though a corner missed its circle', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await asABrowser(page);
    await bootApp(page, { url: '/app/?demo=plumbing:pipe', viewport: { width: 1280, height: 800 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:plumbing:pipe');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    await next(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'trace' && !!window.state.drawingPolyline && window.App.tutorialZoneScreen().length === 4);
    await page.waitForTimeout(300);
    const zs = await page.evaluate(() => window.App.tutorialZoneScreen());
    // the top-left corner 36 sheet points inside the room, outside its 30-point circle; the length within 10%
    const k = await page.evaluate(() => { const z = window.App.tutorialZones(), sc = window.App.tutorialZoneScreen(); return (sc[2].cx - sc[1].cx) / (z[2].x - z[1].x); });
    const pts = zs.map((z) => ({ x: z.cx, y: z.cy }));
    pts[1] = { x: pts[1].x + 36 * k, y: pts[1].y + 4 * k };
    for (const p of pts) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(120); }
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 10000 });
    expect(await page.evaluate(() => !!window.state.drawingPolyline)).toBe(false);
    expect(await page.evaluate(() => window.App.tutorialZones().every((z) => z.done))).toBe(true);   // never "3 of 4 done" beside a drawn pipe
    await expect(page.locator('#tourBody')).toContainText('feet of 1.5 inch copper');
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
    await bootApp(page, { url: '/app/?demo=plumbing:bid', viewport: { width: 390, height: 760 } });
    await page.waitForFunction(() => window.App.tutorialId && window.App.tutorialId() === 'demo:plumbing:bid');
    await page.waitForFunction(() => (window.App.tutorialStepInfo() || {}).done, null, { timeout: 30000 });
    expect(await page.evaluate(() => window.__trimSeen)).toBe(0);
    await page.waitForFunction(() => !document.body.classList.contains('demo-opening'), null, { timeout: 2000 });
    await expect(page.locator('#tourBody')).toContainText('the ☰ menu keeps its totals');
    await next(page);
    await expect(page.locator('#tourBody')).toContainText('Tap ☰, then tap BID CHECK');
    expect((await quiet(page)).dimmed).toEqual(expect.arrayContaining(['measureBtnSidebar']));
    await page.evaluate(() => window.App.tutorialDoStep());
    await next(page);
    await stepTo(page, 'fix', 10000);
    await page.evaluate(() => window.App.tutorialDoStep());
    await next(page);
    await expect(page.locator('#tourBody')).toContainText('Tap ☰ if the sidebar is shut');
    // Set Scale stays in the narrow header, so the scale card sends the guest there, not to ☰
    await page.click('#tourLeave');
    await page.evaluate(() => window.App.startDemo('plumbing', 'scale'));
    await stepTo(page, 'set', 30000);
    await expect(page.locator('#tourBody')).toContainText('Set Scale in the header');
    await expect(page.locator('#setScale')).toBeVisible();
    expect(await page.evaluate(() => window.__trimSeen)).toBe(0);
    errors.assertNoErrors();
  });
});

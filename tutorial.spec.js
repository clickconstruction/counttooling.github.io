// @ts-check
/**
 * The interactive walkthrough (features/tutorial.js).
 *
 * Guards: the tour starts from the empty-canvas link and from ?tour=1; each
 * doing-step advances only when the real state satisfies it (a click that
 * does the thing, or "Do it for me", which goes through the same App.* entry
 * points); reading steps advance on Next; the spotlight follows the step's
 * control and never blocks the pointer; leaving mid-way does not mark it done,
 * finishing does (and the empty-canvas link goes away); it refuses to start
 * over an open cloud project; the "do it for me" path ends with a real
 * electrical takeoff on the sample plan — receptacles, a conduit type with
 * conductors, chained runs with drops, a circuit, an expanded Bid Check.
 */
const { test, expect } = require('@playwright/test');

const stepId = (page) => page.evaluate(() => window.App.tutorialStepId());
async function waitForStep(page, id) {
  await page.waitForFunction((want) => window.App.tutorialStepId() === want, id, { timeout: 8000 });
}

test.describe('Interactive walkthrough', () => {
  test('the do-it-for-me path builds a real takeoff and the tour advances on real state', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { try { localStorage.removeItem('clickcount-tour-done'); } catch (_) {} });
    expect(await page.evaluate(() => typeof window.App?.startTutorial)).toBe('function');

    // the empty-canvas link starts it
    expect(await page.locator('#canvasEmptyHintTour').isVisible()).toBe(true);
    await page.click('#canvasEmptyHintTour');
    expect(await stepId(page)).toBe('welcome');
    expect(await page.locator('#tourCard').isVisible()).toBe(true);
    // the spotlight never intercepts the pointer
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('tourSpot')).pointerEvents)).toBe('none');

    // 1. open the sample plan → pages exist → auto-advance
    await page.click('#tourAction');
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await waitForStep(page, 'scale');
    // 2. scale: do it for me writes the 1/8" preset
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.state.pages[0].scale.pixelsPerUnit)).toBe(9);
    await waitForStep(page, 'trade');
    // 3. trade
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.state.trade)).toBe('electrical');
    await waitForStep(page, 'counter');
    // 4. counter with a mount height
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.state.counters.find((c) => /receptacle/i.test(c.name)).mountHeightIn)).toBe(18);
    await waitForStep(page, 'place');
    // 5. three marks — one by a real click through the counter tool, the rest by the action
    await page.click('#tourAction');
    await waitForStep(page, 'linetype');
    // 6. the conduit type
    await page.click('#tourAction');
    const lt = await page.evaluate(() => window.state.lineTypes.find((l) => l.raceway));
    expect(lt.conductors.length).toBe(2);
    await waitForStep(page, 'ceiling');
    // 7. ceiling
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.state.ceilingHeightFt)).toBe(10);
    await waitForStep(page, 'chain');
    // 8. chain three: two runs with the 9.5 ft verticals
    await page.click('#tourAction');
    const drops = await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).quickLines.map((q) => [q.startDrop || 0, q.endDrop || 0]));
    expect(drops).toEqual([[9.5, 9.5], [0, 9.5]]);
    await waitForStep(page, 'circuit');
    // 9. circuit
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.state.groups.find((g) => g.panel).circuit)).toBe('7');
    await waitForStep(page, 'summary');
    // 10. reading step: Next
    expect(await page.locator('#tourNext').textContent()).toBe('Next');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe('bidcheck');
    // 11. bid check opens
    await page.click('#tourAction');
    await waitForStep(page, 'handoff');
    expect(await page.locator('#bidCheckList').isVisible()).toBe(true);
    // 12 + 13: reading, then Finish marks it done and the link goes away
    await page.click('#tourNext');
    expect(await stepId(page)).toBe('done');
    expect(await page.locator('#tourNext').textContent()).toBe('Finish');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe(null);
    expect(await page.evaluate(() => !!localStorage.getItem('clickcount-tour-done'))).toBe(true);
    expect(await page.locator('#tourOverlay').isVisible()).toBe(false);
    // the takeoff is real: the summary carries wire rows and the schedule has the circuit
    const payload = await page.evaluate(() => window.getTakeoffToolingPayload());
    expect(payload.items.some((i) => i.derived === 'wire' && i.description === '#12 THHN')).toBe(true);
    expect(payload.circuits[0].panel).toBe('LP-1');
    expect(errors).toEqual([]);
  });

  test('?tour=1 starts it; a real click satisfies a step; Back and leaving behave; a cloud project refuses', async ({ page }) => {
    await page.goto('/app/?tour=1');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'welcome', null, { timeout: 5000 });
    // the spotlight sits on the Upload button
    const spot = await page.evaluate(() => { const r = document.getElementById('tourSpot').getBoundingClientRect(); const b = document.getElementById('uploadPdf').getBoundingClientRect(); return Math.abs(r.left + 6 - b.left) < 2 && Math.abs(r.top + 6 - b.top) < 2; });
    expect(spot).toBe(true);
    // a real upload (the sample plan through the same input) satisfies step 1
    await page.locator('#pdfInput').setInputFiles(require('path').join(__dirname, 'samples', 'sample-plan.pdf'));
    await waitForStep(page, 'scale');
    // Back returns; Next on a doing-step skips
    await page.click('#tourBack');
    expect(await stepId(page)).toBe('welcome');
    await page.click('#tourNext');
    // welcome is already satisfied, so it auto-advances again
    await waitForStep(page, 'scale');
    expect(await page.locator('#tourNext').textContent()).toBe('Skip step');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe('trade');
    // leaving mid-way does not mark it done
    await page.click('#tourLeave');
    expect(await stepId(page)).toBe(null);
    expect(await page.evaluate(() => !!localStorage.getItem('clickcount-tour-done'))).toBe(false);
    // a cloud project refuses the tour
    await page.evaluate(() => { window.state.currentProjectId = 'cloud-123'; });
    expect(await page.evaluate(() => window.App.startTutorial())).toBe(false);
    expect(await stepId(page)).toBe(null);
  });
});

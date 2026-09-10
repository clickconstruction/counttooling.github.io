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
 * conductors, chained runs with drops, a circuit, an expanded Bid Check. Both tours
 * share the scale step (through the real dialog; the sample plan is a true ANSI B
 * sheet so no sheet-size correction rides along) and the prove-the-scale step, which
 * gates on the 20'-0" wall reading 20 ft and names a wrong reading. Back HOLDS
 * (a step re-entered with Back never auto-advances — Next lights up), and the
 * spotlight follows the reader INTO a dialog (the ladder's deepest visible
 * control wins; a control under the backdrop never does).
 *
 * The plumbing tour shares the engine: its own link, ?tour=plumbing, its own
 * done key (finishing it hides only its link), the project stamped plumbing on
 * open, and a do-it-for-me path that ends with three water closets, a 1in PEX
 * type with a hanger rule, three chained lavatories with a 3 ft riser on the
 * first run, a ×3 zone around Men 105, an RFI note, and the proof modal open.
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
    // 2. scale: do it for me picks the 1/8" preset THROUGH the dialog — on a true ANSI B
    // sheet there is no sheet-size correction, so the scale is the plain preset
    await page.click('#tourAction');
    await waitForStep(page, 'measure');
    expect(await page.evaluate(() => { const sc = window.state.pages[0].scale; return [sc.pixelsPerUnit, sc.correctionFactor, sc.sheetSize]; })).toEqual([9, undefined, undefined]);
    expect(await page.locator('#scaleModal').evaluate((m) => m.classList.contains('visible'))).toBe(false);
    // 2b. prove it: the 20'-0" wall reads 20'-0"
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 20\'-0"');
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
    // Back HOLDS: welcome is already satisfied, but a step re-entered with Back
    // never auto-advances — Next lights up instead (Wendi: "it won't let me stay back")
    await page.click('#tourBack');
    expect(await stepId(page)).toBe('welcome');
    await page.waitForTimeout(1500);
    expect(await stepId(page)).toBe('welcome');
    expect(await page.locator('#tourNext').textContent()).toBe('Next');
    expect(await page.locator('#tourNext').evaluate((b) => b.classList.contains('tour-next-ready'))).toBe(true);
    expect(await page.locator('#tourStatus').textContent()).toBe('✓ Done');
    await page.click('#tourNext');
    await waitForStep(page, 'scale');
    expect(await page.locator('#tourNext').textContent()).toBe('Skip step');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe('measure');
    // leaving mid-way does not mark it done
    await page.click('#tourLeave');
    expect(await stepId(page)).toBe(null);
    expect(await page.evaluate(() => !!localStorage.getItem('clickcount-tour-done'))).toBe(false);
    // a cloud project refuses the tour
    await page.evaluate(() => { window.state.currentProjectId = 'cloud-123'; });
    expect(await page.evaluate(() => window.App.startTutorial())).toBe(false);
    expect(await stepId(page)).toBe(null);
  });

  test('the empty-canvas link works even when the stylesheet is a deploy behind (mixed shell)', async ({ page }) => {
    // After a deploy a returning tab renders network-first HTML against the previous
    // version's cache-first CSS until the new service worker takes over. The link must
    // not depend on its stylesheet rule to receive the click: serve the current CSS with
    // the `.canvas-empty-hint-tour a` rule stripped and click it for real.
    const fs = require('fs');
    const css = fs.readFileSync(require('path').join(__dirname, 'styles.css'), 'utf8').replace(/\.canvas-empty-hint-tour a \{[^}]*\}/, '');
    expect(css.includes('.canvas-empty-hint-tour a')).toBe(false);
    await page.route('**/styles.css', (route) => route.fulfill({ body: css, contentType: 'text/css' }));
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { try { localStorage.removeItem('clickcount-tour-done'); } catch (_) {} });
    const box = await page.locator('#canvasEmptyHintTour').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitForStep(page, 'welcome');
  });

  test('the plumbing tour: its own link and ?tour=plumbing start it, do-it-for-me builds a plumbing takeoff, its own done key hides only its link', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { try { localStorage.removeItem('clickcount-tour-done'); localStorage.removeItem('clickcount-tour-done-plumbing'); } catch (_) {} });
    // a device whose last bid was electrical still gets a plumbing tour
    await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('plumbingModifiers') || '{}'); m.defaultTrade = 'electrical'; localStorage.setItem('plumbingModifiers', JSON.stringify(m)); });
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await page.locator('#canvasEmptyHintTourPlumbing').isVisible()).toBe(true);
    expect(await page.locator('#canvasEmptyHintTour').isVisible()).toBe(true);
    await page.click('#canvasEmptyHintTourPlumbing');
    expect(await page.evaluate(() => [window.App.tutorialId(), window.App.tutorialStepId()])).toEqual(['plumbing', 'welcome']);
    expect(await page.locator('#tourStepNo').textContent()).toBe('1 / 14');
    // the sample plan is a true ANSI B sheet — no sheet-size warning can greet the scale step

    // 1. the sample plan → the project is stamped plumbing (not remembered as the device default)
    await page.click('#tourAction');
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await waitForStep(page, 'scale');
    expect(await page.evaluate(() => window.state.trade)).toBe('plumbing');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plumbingModifiers')).defaultTrade)).toBe('electrical');
    // 2. scale — through the real dialog; the page is standard so no correction rides along
    expect(await page.evaluate(() => window.App.getPageSheetAnalysis(0).isStandard)).toBe(true);
    await page.click('#tourAction');
    await waitForStep(page, 'measure');
    expect(await page.evaluate(() => { const sc = window.state.pages[0].scale; return [sc.pixelsPerUnit, sc.correctionFactor]; })).toEqual([9, undefined]);
    // 3. the proof GATES: a wrong reading names itself and does not advance
    await page.evaluate(() => { window.state.lastMeasure = { text: 'Distance: 53\'-4"', pageIdx: 0, pts: 180, scale: { pixelsPerUnit: 3.375, unit: 'ft' } }; });
    await page.waitForTimeout(600);
    expect(await stepId(page)).toBe('measure');
    expect(await page.locator('#tourStatus').textContent()).toBe('Read 53\'-4" — go Back and set the scale again');
    // ...and the 20'-0" dimension measures 20 ft through the real Measure commit
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 20\'-0"');
    expect(await page.evaluate(() => window.state.tool)).toBe(0);
    await waitForStep(page, 'counter');
    // the spotlight follows the reader into the dialog: with the counter dialog
    // open the ladder lights Create Counter, never the + Add under the backdrop
    await page.click('#addCounter');
    await page.waitForSelector('#counterModal.visible');
    // the spot moves on the 400 ms tick with a 160 ms transition — poll, don't sleep
    // …and the lit control must actually be ON SCREEN: at this viewport Create
    // Counter starts clipped below the dialog's scroll panel, so the loop has to
    // scroll it into view (the first-tick scroll lands before the panel lays out)
    const spotOn = (id) => page.waitForFunction((want) => { const spot = document.getElementById('tourSpot'); const r = spot.getBoundingClientRect(); const b = document.getElementById(want).getBoundingClientRect(); return getComputedStyle(spot).display !== 'none' && Math.abs(r.left + 6 - b.left) < 2 && Math.abs(r.top + 6 - b.top) < 2 && b.top >= 0 && b.bottom <= window.innerHeight; }, id, { timeout: 4000 });
    await spotOn('counterCreate');
    expect(await page.evaluate(() => document.getElementById('counterCreatePanel').scrollTop)).toBeGreaterThan(0);
    await page.evaluate(() => window.App.hideModal('counterModal'));
    await spotOn('addCounter');
    // 4. a Water Closet with the plumbing set's Toilet symbol
    await page.click('#tourAction');
    const wc = await page.evaluate(() => { const c = window.state.counters.find((x) => x.name === 'Water Closet'); const t = window.App.getEffectiveCustomIcons().find((i) => i.name === 'Toilet'); return { has: !!c, toilet: !!c && c.icon === t.value }; });
    expect(wc).toEqual({ has: true, toilet: true });
    await waitForStep(page, 'place');
    // 5. three marks on the drawn water closets inside Men 105
    await page.click('#tourAction');
    const marks = await page.evaluate(() => { const c = window.state.counters.find((x) => x.name === 'Water Closet'); return window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers[c.id]; });
    expect(marks.length).toBe(3);
    marks.forEach((m) => { expect(m.x).toBeGreaterThan(322); expect(m.x).toBeLessThan(465); expect(m.y).toBeGreaterThan(266); expect(m.y).toBeLessThan(442); });
    await waitForStep(page, 'linetype');
    // 6. the Quick Line name
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.state.lineTypes.map((l) => l.name))).toEqual(['1in PEX']);
    await waitForStep(page, 'chain');
    // 7. three lavatories chained: two runs, no drops yet (no ceiling in a plumbing project)
    await page.click('#tourAction');
    const chained = await page.evaluate(() => { const a = window.App.getActiveAnnotations(window.state.pages[0]); const lav = window.state.counters.find((x) => x.name === 'Lavatory'); return { lavs: (a.counterMarkers[lav.id] || []).length, runs: a.quickLines.length, drops: a.quickLines.map((q) => [q.startDrop || 0, q.endDrop || 0]) }; });
    expect(chained).toEqual({ lavs: 3, runs: 2, drops: [[0, 0], [0, 0]] });
    await waitForStep(page, 'drop');
    // 8. a 3 ft riser on the branch's start, written through the shared drop-node model
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).quickLines.map((q) => [q.startDrop || 0, q.endDrop || 0]))).toEqual([[3, 0], [0, 0]]);
    expect(await page.evaluate(() => window.state.recentDrops[0])).toEqual({ value: 3, unit: 'ft' });
    await waitForStep(page, 'hangers');
    // 9. the hanger rule rides the line type and tallies in the summary
    await page.click('#tourAction');
    // the hanger comes from the rulebook: PEX at 1 in → 32 in, stamped with its rule
    expect(await page.evaluate(() => window.state.lineTypes[0].childCounts)).toEqual([{ name: 'Hanger', qty: 1, per: 'ft', intervalIn: 32, ruleId: 'plumb.hanger.pex' }]);
    await waitForStep(page, 'zone');
    // 10. the ×3 zone around Men 105 triples the water closets in the tally
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).multiplyZones.map((z) => z.multiplier))).toEqual([3]);
    expect(await page.evaluate(() => window.getPipeToolingSummary())).toContain('Water Closet\t9');
    await waitForStep(page, 'rfi');
    // 11. the RFI note is collected by Copy RFI Flags' collector
    await page.click('#tourAction');
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).notes.map((n) => n.text))).toEqual(['RFI: floor drain in Men 105?']);
    await waitForStep(page, 'proof');
    // 12. the proof modal opens on the Water Closet
    await page.click('#tourAction');
    await expect(page.locator('#summaryCountDetailModal')).toHaveClass(/visible/);
    await waitForStep(page, 'handoff');
    await page.click('#summaryCountDetailClose');
    // 13 + 14: reading, then Finish sets ONLY the plumbing key; the electrical link stays
    expect(await page.locator('#tourNext').textContent()).toBe('Next');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe('done');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe(null);
    expect(await page.evaluate(() => [!!localStorage.getItem('clickcount-tour-done-plumbing'), !!localStorage.getItem('clickcount-tour-done')])).toEqual([true, false]);
    // (a plan is open, so the whole hint is hidden — read the links' own display)
    expect(await page.evaluate(() => [document.getElementById('canvasEmptyHintTourPlumbing').style.display, document.getElementById('canvasEmptyHintTour').style.display])).toEqual(['none', '']);
    // the takeoff is real: the PipeTooling summary carries the fixtures, the pipe with its riser, and the hangers
    const summary = await page.evaluate(() => window.getPipeToolingSummary());
    expect(summary).toContain('Water Closet\t9');
    expect(summary).toContain('Lavatory\t9');
    expect(summary).toContain('ft of 1in PEX\t26.33');
    expect(summary).toContain('  Hanger\t15');
    expect(errors).toEqual([]);
  });

  test('?tour=plumbing opens the plumbing tour; the Settings link opens it; finishing electrical hides only its link', async ({ page }) => {
    await page.goto('/app/?tour=plumbing');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => window.App.tutorialStepId() === 'welcome', null, { timeout: 5000 });
    expect(await page.evaluate(() => window.App.tutorialId())).toBe('plumbing');
    await page.click('#tourLeave');
    // Settings → plumbing tour
    await page.evaluate(() => window.App.showModal('settingsModal'));
    await page.click('#settingsTourPlumbing');
    expect(await page.evaluate(() => [window.App.tutorialId(), window.App.tutorialStepId()])).toEqual(['plumbing', 'welcome']);
    await page.click('#tourLeave');
    // an electrical finish leaves the plumbing offer in place
    await page.evaluate(() => { localStorage.setItem('clickcount-tour-done', new Date().toISOString()); window.App.startTutorial('electrical'); window.App.stopTutorial(true); });
    expect(await page.locator('#canvasEmptyHintTour').isVisible()).toBe(false);
    expect(await page.locator('#canvasEmptyHintTourPlumbing').isVisible()).toBe(true);
    expect(await page.locator('#canvasEmptyHintTourSep').isVisible()).toBe(false);
    // both done → the whole offer goes
    await page.evaluate(() => { window.App.startTutorial('plumbing'); window.App.stopTutorial(true); });
    expect(await page.locator('.canvas-empty-hint-tour').isVisible()).toBe(false);
  });
});

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
 * first run, a ×3 zone around Women 108, an RFI note, and the proof modal open.
 */
const { test, expect } = require('@playwright/test');

const stepId = (page) => page.evaluate(() => window.App.tutorialStepId());
// "The app is ready" is the app's own signal, not a quiet network: every fresh context
// installs the service worker (about 155 precached files), and on a slow CI runner
// waitForLoadState('networkidle') outlived the whole test budget (19 of 19 flaky
// errors and the one hard failure on PR #161's run were exactly that wait).
const ready = (page) => page.waitForFunction(() => window.App && window.App.bootSettled === true && typeof window.App.startTutorial === 'function', null, { timeout: 30000 });
async function waitForStep(page, id) {
  await page.waitForFunction((want) => window.App.tutorialStepId() === want, id, { timeout: 8000 });
}

test.describe('Interactive walkthrough', () => {
  test('the do-it-for-me path builds a real takeoff and the tour advances on real state', async ({ page }) => {
    test.setTimeout(90000);   // a whole tour plus a reload: the 30 s default does not survive a slow CI runner's page loads
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.goto('/app/');
    await ready(page);
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
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await waitForStep(page, 'scale');
    // 2. scale: do it for me picks the 1/8" preset THROUGH the dialog — on a true ANSI B
    // sheet there is no sheet-size correction, so the scale is the plain preset
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'measure');
    expect(await page.evaluate(() => { const sc = window.state.pages[0].scale; return [sc.pixelsPerUnit, sc.correctionFactor, sc.sheetSize]; })).toEqual([9, undefined, undefined]);
    expect(await page.locator('#scaleModal').evaluate((m) => m.classList.contains('visible'))).toBe(false);
    // 2b. prove it: the 20'-0" wall reads 20'-0"
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 20\'-0"');
    await waitForStep(page, 'trade');
    // 3. trade
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await page.evaluate(() => window.state.trade)).toBe('electrical');
    await waitForStep(page, 'counter');
    // 4. counter with a mount height
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await page.evaluate(() => window.state.counters.find((c) => /receptacle/i.test(c.name)).mountHeightIn)).toBe(18);
    await waitForStep(page, 'place');
    // 5. three marks — one by a real click through the counter tool, the rest by the action
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'linetype');
    // 6. the conduit type
    await page.evaluate(() => window.App.tutorialDoStep());
    const lt = await page.evaluate(() => window.state.lineTypes.find((l) => l.raceway));
    expect(lt.conductors.length).toBe(2);
    await waitForStep(page, 'ceiling');
    // 7. ceiling
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await page.evaluate(() => window.state.ceilingHeightFt)).toBe(10);
    await waitForStep(page, 'chain');
    // 8. chain three: two runs with the 9.5 ft verticals
    await page.evaluate(() => window.App.tutorialDoStep());
    const drops = await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).quickLines.map((q) => [q.startDrop || 0, q.endDrop || 0]));
    expect(drops).toEqual([[9.5, 9.5], [0, 9.5]]);
    await waitForStep(page, 'circuit');
    // 9. circuit
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await page.evaluate(() => window.state.groups.find((g) => g.panel).circuit)).toBe('7');
    await waitForStep(page, 'summary');
    // 10. reading step: Next
    expect(await page.locator('#tourNext').textContent()).toBe('Next');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe('bidcheck');
    // 11. bid check opens
    await page.evaluate(() => window.App.tutorialDoStep());
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
    await ready(page);
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
    // an undone step: Next is off and does nothing; the quiet Skip link is the way past
    await expect(page.locator('#tourNext')).toBeDisabled();
    await expect(page.locator('#tourShow')).toHaveText('Show me where');
    await page.click('#tourSkip');
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
    await ready(page);
    await page.evaluate(() => { try { localStorage.removeItem('clickcount-tour-done'); } catch (_) {} });
    const box = await page.locator('#canvasEmptyHintTour').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitForStep(page, 'welcome');
  });

  test('the plumbing tour: its own link and ?tour=plumbing start it, do-it-for-me builds a plumbing takeoff, its own done key hides only its link', async ({ page }) => {
    test.setTimeout(90000);   // a whole tour plus a reload: the 30 s default does not survive a slow CI runner's page loads
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.goto('/app/');
    await ready(page);
    await page.evaluate(() => { try { localStorage.removeItem('clickcount-tour-done'); localStorage.removeItem('clickcount-tour-done-plumbing'); } catch (_) {} });
    // a device whose last bid was electrical still gets a plumbing tour
    await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('plumbingModifiers') || '{}'); m.defaultTrade = 'electrical'; localStorage.setItem('plumbingModifiers', JSON.stringify(m)); });
    await page.reload();
    await ready(page);
    expect(await page.locator('#canvasEmptyHintTourPlumbing').isVisible()).toBe(true);
    expect(await page.locator('#canvasEmptyHintTour').isVisible()).toBe(true);
    await page.click('#canvasEmptyHintTourPlumbing');
    expect(await page.evaluate(() => [window.App.tutorialId(), window.App.tutorialStepId()])).toEqual(['plumbing', 'welcome']);
    expect(await page.locator('#tourStepNo').textContent()).toBe('1 / 14');
    // the sample plan is a true ANSI B sheet — no sheet-size warning can greet the scale step

    // 1. the sample plan → the project is stamped plumbing (not remembered as the device default)
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await waitForStep(page, 'scale');
    expect(await page.evaluate(() => window.state.trade)).toBe('plumbing');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plumbingModifiers')).defaultTrade)).toBe('electrical');
    // 2. scale — through the real dialog; the page is standard so no correction rides along
    expect(await page.evaluate(() => window.App.getPageSheetAnalysis(0).isStandard)).toBe(true);
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'measure');
    expect(await page.evaluate(() => { const sc = window.state.pages[0].scale; return [sc.pixelsPerUnit, sc.correctionFactor]; })).toEqual([9, undefined]);
    // 3. the proof GATES: a wrong reading names itself and does not advance
    await page.evaluate(() => { window.state.lastMeasure = { text: 'Distance: 53\'-4"', pageIdx: 0, pts: 180, scale: { pixelsPerUnit: 3.375, unit: 'ft' } }; });
    await page.waitForTimeout(600);
    expect(await stepId(page)).toBe('measure');
    expect(await page.locator('#tourStatus').textContent()).toBe('Read 53\'-4". Go Back and set the scale again');
    // ...and the 20'-0" dimension measures 20 ft through the real Measure commit
    await page.evaluate(() => window.App.tutorialDoStep());
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
    await page.evaluate(() => window.App.tutorialDoStep());
    const wc = await page.evaluate(() => { const c = window.state.counters.find((x) => x.name === 'Water Closet'); const t = window.App.getEffectiveCustomIcons().find((i) => i.name === 'Toilet'); return { has: !!c, toilet: !!c && c.icon === t.value }; });
    expect(wc).toEqual({ has: true, toilet: true });
    await waitForStep(page, 'place');
    // 5. three marks on the drawn water closets inside Women 108
    await page.evaluate(() => window.App.tutorialDoStep());
    const marks = await page.evaluate(() => { const c = window.state.counters.find((x) => x.name === 'Water Closet'); return window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers[c.id]; });
    expect(marks.length).toBe(3);
    marks.forEach((m) => { expect(m.x).toBeGreaterThan(630); expect(m.x).toBeLessThan(765); expect(m.y).toBeGreaterThan(358); expect(m.y).toBeLessThan(520); });
    await waitForStep(page, 'linetype');
    // 6. the Quick Line name
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await page.evaluate(() => window.state.lineTypes.map((l) => l.name))).toEqual(['1in PEX']);
    await waitForStep(page, 'chain');
    // 7. three lavatories chained: two runs, no drops yet (no ceiling in a plumbing project)
    await page.evaluate(() => window.App.tutorialDoStep());
    const chained = await page.evaluate(() => { const a = window.App.getActiveAnnotations(window.state.pages[0]); const lav = window.state.counters.find((x) => x.name === 'Lavatory'); return { lavs: (a.counterMarkers[lav.id] || []).length, runs: a.quickLines.length, drops: a.quickLines.map((q) => [q.startDrop || 0, q.endDrop || 0]) }; });
    expect(chained).toEqual({ lavs: 3, runs: 2, drops: [[0, 0], [0, 0]] });
    await waitForStep(page, 'drop');
    // 8. a 3 ft riser on the branch's start, written through the shared drop-node model
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).quickLines.map((q) => [q.startDrop || 0, q.endDrop || 0]))).toEqual([[3, 0], [0, 0]]);
    expect(await page.evaluate(() => window.state.recentDrops[0])).toEqual({ value: 3, unit: 'ft' });
    await waitForStep(page, 'hangers');
    // 9. the hanger rule rides the line type and tallies in the summary
    await page.evaluate(() => window.App.tutorialDoStep());
    // the hanger comes from the rulebook: PEX at 1 in → 32 in, stamped with its rule
    expect(await page.evaluate(() => window.state.lineTypes[0].childCounts)).toEqual([{ name: 'Hanger', qty: 1, per: 'ft', intervalIn: 32, ruleId: 'plumb.hanger.pex' }]);
    await waitForStep(page, 'zone');
    // 10. the ×3 zone around Women 108 triples the water closets in the tally
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).multiplyZones.map((z) => z.multiplier))).toEqual([3]);
    expect(await page.evaluate(() => window.getPipeToolingSummary())).toContain('Water Closet\t9');
    await waitForStep(page, 'rfi');
    // 11. the RFI note is collected by Copy RFI Flags' collector
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).notes.map((n) => n.text))).toEqual(['RFI: ADA clearance at the end stall in Women 108?']);
    await waitForStep(page, 'proof');
    // 12. the proof modal opens on the Water Closet
    await page.evaluate(() => window.App.tutorialDoStep());
    await expect(page.locator('#summaryCountDetailModal')).toHaveClass(/visible/);
    // the proof step HOLDS (the dialog is the lesson): done, Next lit, no auto-advance
    await page.waitForTimeout(1500);
    expect(await stepId(page)).toBe('proof');
    await expect(page.locator('#tourNext')).toHaveClass(/tour-next-ready/);
    await page.click('#tourNext');
    expect(await stepId(page)).toBe('handoff');
    // entering Hand it off closes the proof dialog it would otherwise sit under, so the
    // export button is lit (2026-09-21: the step was dark behind the open breakdown)
    await expect(page.locator('#summaryCountDetailModal')).not.toHaveClass(/visible/);
    await page.waitForFunction(() => { const s = document.getElementById('tourSpot').getBoundingClientRect(), b = document.getElementById('forPipeTooling').getBoundingClientRect(); return s.width > 0 && Math.abs(s.left - (b.left - 6)) < 3 && Math.abs(s.top - (b.top - 6)) < 3; }, null, { timeout: 4000 });
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
    expect(summary).toContain('ft of 1in PEX\t28.00');   // 2 lav-to-lav runs of 3.17 ft × 3 floors + 3 risers of 3 ft
    expect(summary).toContain('  Hanger\t15');
    expect(errors).toEqual([]);
  });

  test('the HVAC tour: its own link and ?tour=hvac start it, do-it-for-me builds a real design-build duct takeoff, its own done key hides only its link', async ({ page }) => {
    test.setTimeout(90000);   // a whole tour plus a reload: the 30 s default does not survive a slow CI runner's page loads
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.goto('/app/');
    await ready(page);
    await page.evaluate(() => { try { ['clickcount-tour-done', 'clickcount-tour-done-plumbing', 'clickcount-tour-done-hvac'].forEach((k) => localStorage.removeItem(k)); } catch (_) {} });
    await page.reload();
    await ready(page);
    expect(await page.locator('#canvasEmptyHintTourHvac').isVisible()).toBe(true);
    await page.click('#canvasEmptyHintTourHvac');
    expect(await page.evaluate(() => [window.App.tutorialId(), window.App.tutorialStepId()])).toEqual(['hvac', 'welcome']);
    expect(await page.locator('#tourStepNo').textContent()).toBe('1 / 14');
    // 1. the sample plan → stamped HVAC, not remembered
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await waitForStep(page, 'scale');
    expect(await page.evaluate(() => window.state.trade)).toBe('hvac');
    // 2-3. scale + proof through the shared steps
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'measure');
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'room');
    // 4. the room: name read off the plan (D24), typed, decked, one totals tag
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'counter');
    const room = await page.evaluate(() => { const r = window.state.rooms.find((x) => /open office/i.test(x.name)); const a = window.App.getActiveAnnotations(window.state.pages[0]); return { name: r.name, fromPlan: !!r.nameFromPlan, type: r.roomType, boxes: a.roomBoxes.filter((b) => b.roomId === r.id).length, deck: window.App.getDuctSettings().deckHeightFt, tags: window.App.planRoomLabels(a, 0).tags.length }; });
    // the plan prints the name and the number as two items; D24 takes the larger print
    expect(room).toEqual({ name: 'OPEN OFFICE', fromPlan: true, type: 'office', boxes: 1, deck: 12, tags: 1 });
    // 5. a CFM counter wearing the diffuser glyph
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'place');
    expect(await page.evaluate(() => { const c = window.state.counters.find((x) => /diffuser/i.test(x.name)); return { cfm: c.cfm, icon: c.icon === window.App.cfmDefaultIcon() }; })).toEqual({ cfm: 150, icon: true });
    // 6. four placed inside the office
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'system');
    const marks = await page.evaluate(() => { const c = window.state.counters.find((x) => /diffuser/i.test(x.name)); return window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers[c.id].map((m) => [m.x, m.y]); });
    expect(marks.length).toBe(4);
    marks.forEach(([x, y]) => { expect(x).toBeGreaterThan(158); expect(x).toBeLessThan(412); expect(y).toBeGreaterThan(358); expect(y).toBeLessThan(520); });
    // 7. RTU-1 through the real Groups modal, and it is the active group
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'duct');
    expect(await page.evaluate(() => { const g = window.state.groups.find((x) => x.equipmentTag === 'RTU-1'); return { cfm: g.capacityCfm, active: window.state.activeGroupId === g.id, groupsOn: window.state.groupsEnabled }; })).toEqual({ cfm: 2000, active: true, groupsOn: true });
    // 8. the main: two segments (the suggestion taken at S), auto fittings, in the system
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'attach');
    const run = await page.evaluate(() => { const a = window.App.getActiveAnnotations(window.state.pages[0]); const r = a.ductRuns[0]; return { runs: a.ductRuns.length, segments: r.segments.length, first: r.segments[0].size, system: r.systemGroupId === window.state.activeGroupId, fittings: a.ductFittings.map((f) => f.type) }; });
    expect(run.runs).toBe(1); expect(run.segments).toBe(2); expect(run.first).toEqual({ kind: 'rect', w: 24, h: 12 }); expect(run.system).toBe(true);
    expect(run.fittings).toContain('transition');
    // the two near diffusers are attached, the two deep ones are strays — the hint says so
    expect(await page.locator('#tourStatus').textContent()).toBe('2 diffusers still hanging off nothing');
    // 9. a REAL right-click rescues one; do-it-for-me the other
    await page.evaluate(() => { const c = window.state.counters.find((x) => /diffuser/i.test(x.name)); window.state.ctxTarget = { type: 'marker', typeId: c.id, index: 2 }; window.App.showContextMenu(10, 10); });
    expect(await page.evaluate(() => document.getElementById('ctxAttachToRun').style.display)).toBe('block');
    await page.evaluate(() => document.getElementById('ctxAttachToRun').click());
    await page.waitForTimeout(600);
    expect(await page.locator('#tourStatus').textContent()).toBe('1 diffuser still hanging off nothing');
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'schedule');
    expect(await page.evaluate(() => { const c = window.state.counters.find((x) => /diffuser/i.test(x.name)); const a = window.App.getActiveAnnotations(window.state.pages[0]); const devs = a.counterMarkers[c.id].map((m) => ({ x: m.x, y: m.y })); return window.attachDuctDevices(devs, a.ductRuns).unattached.length; })).toBe(0);
    // 10. reading; 11. the manual row ticked; 12-13 reading; 14 finish
    expect(await page.locator('#tourNext').textContent()).toBe('Next');
    await page.click('#tourNext');
    await waitForStep(page, 'bidcheck');
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'handoff');
    expect(await page.evaluate(() => window.state.bidCheck.manual['duct-fits-roof'])).toBe(true);
    await page.click('#tourNext');
    expect(await stepId(page)).toBe('legend');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe('done');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe(null);
    expect(await page.evaluate(() => ['clickcount-tour-done-hvac', 'clickcount-tour-done-plumbing', 'clickcount-tour-done'].map((k) => !!localStorage.getItem(k)))).toEqual([true, false, false]);
    expect(await page.evaluate(() => ['canvasEmptyHintTourHvac', 'canvasEmptyHintTourPlumbing', 'canvasEmptyHintTour'].map((id) => document.getElementById(id).style.display))).toEqual(['none', '', '']);
    // the takeoff is real: the /Tooling text carries the diffusers and the duct block with a bid weight
    const summary = await page.evaluate(() => window.getPipeToolingSummary());
    expect(summary).toContain('Supply Diffuser\t4');
    expect(summary).toContain('--- Duct ---');
    expect(summary).toMatch(/Bid weight\t.*\d+ lb/);
    expect(errors).toEqual([]);
  });

  test('?tour=plumbing opens the plumbing tour; the Settings link opens it; finishing electrical hides only its link', async ({ page }) => {
    await page.goto('/app/?tour=plumbing');
    await ready(page);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'welcome', null, { timeout: 5000 });
    expect(await page.evaluate(() => window.App.tutorialId())).toBe('plumbing');
    await page.click('#tourLeave');
    // Settings → plumbing tour
    await page.evaluate(() => window.App.showModal('settingsModal'));
    if (await page.getAttribute('#settingsHelpToggle', 'aria-expanded') !== 'true') await page.click('#settingsHelpToggle');
    await page.click('#settingsTourPlumbing');
    expect(await page.evaluate(() => [window.App.tutorialId(), window.App.tutorialStepId()])).toEqual(['plumbing', 'welcome']);
    await page.click('#tourLeave');
    // an electrical finish leaves the plumbing offer in place
    await page.evaluate(() => { localStorage.setItem('clickcount-tour-done', new Date().toISOString()); window.App.startTutorial('electrical'); window.App.stopTutorial(true); });
    expect(await page.locator('#canvasEmptyHintTour').isVisible()).toBe(false);
    expect(await page.locator('#canvasEmptyHintTourPlumbing').isVisible()).toBe(true);
    expect(await page.locator('#canvasEmptyHintTourSep').isVisible()).toBe(false);
    // plumbing done too → the hvac link (H1) still holds the offer up; ?tour=hvac + its Settings link work
    await page.evaluate(() => { window.App.startTutorial('plumbing'); window.App.stopTutorial(true); });
    expect(await page.locator('.canvas-empty-hint-tour').isVisible()).toBe(true);
    expect(await page.locator('#canvasEmptyHintTourHvac').isVisible()).toBe(true);
    await page.evaluate(() => window.App.showModal('settingsModal'));
    if (await page.getAttribute('#settingsHelpToggle', 'aria-expanded') !== 'true') await page.click('#settingsHelpToggle');
    await page.click('#settingsTourHvac');
    expect(await page.evaluate(() => [window.App.tutorialId(), window.App.tutorialStepId()])).toEqual(['hvac', 'welcome']);
    await page.click('#tourLeave');
    // all three done → the whole offer goes
    await page.evaluate(() => { window.App.startTutorial('hvac'); window.App.stopTutorial(true); });
    expect(await page.locator('.canvas-empty-hint-tour').isVisible()).toBe(false);
  });
  test('a ?tour= link on a device that holds the last tour\'s session: the restore offer waits, and the sample plan opens clean', async ({ page }) => {
    test.setTimeout(90000);
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    // 1. a plumbing tour leaves a real session behind on the device
    await page.goto('/app/?tour=plumbing');
    await ready(page);
    await waitForStep(page, 'welcome');
    for (const next of ['scale', 'measure', 'counter', 'place', 'linetype']) { await page.evaluate(() => window.App.tutorialDoStep()); await waitForStep(page, next); }
    expect(await page.evaluate(() => window.state.counters.map((c) => c.name))).toEqual(['Water Closet']);
    await page.waitForFunction(async () => { const b = await window.App.takeoffBackupGet('local', null); return !!(b && b.data && (b.data.counters || []).length); }, null, { timeout: 15000 });
    // 2. the next visit arrives by an HVAC tour link. Before 2026-09-21 the boot's restore
    // offer beat the tour's 600 ms start and sat on top of it, the backup's palette was
    // pre-applied under it, and the sample plan (the same PDF, so the same hash) got the
    // plumbing marks re-applied: water closets inside an HVAC tour.
    await page.goto('/app/?tour=hvac');
    await ready(page);
    await waitForStep(page, 'welcome');
    await page.waitForTimeout(1500);   // the offer's 1 s poll must not sneak it in either
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.state.counters.length)).toBe(0);
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'scale');
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => [window.state.counters.length, window.App.projectHasAnyCanvasMarkup()])).toEqual([0, false]);
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('on a phone: no key asides, the sidebar step lights the ☰ and then follows into the drawer, the card docks clear of its control', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/?tour=plumbing');
    await ready(page);
    await waitForStep(page, 'welcome');
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'scale');
    expect(await page.locator('#tourBody').textContent()).not.toMatch(/press/i);
    await page.evaluate(() => window.App.tutorialGoTo('counter'));
    expect(await page.locator('#tourBody').textContent()).toContain('tap ☰ at the top left');
    const over = (sel) => page.waitForFunction((q) => { const s = document.getElementById('tourSpot').getBoundingClientRect(), b = document.querySelector(q).getBoundingClientRect(); return s.width > 0 && Math.abs(s.left - (b.left - 6)) < 3 && Math.abs(s.top - (b.top - 6)) < 3; }, sel, { timeout: 5000 });
    await over('#hamburger');
    // the card sits at the far edge from the control and inside the screen
    const card = await page.evaluate(() => { const r = document.getElementById('tourCard').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height }; });
    expect(card.top).toBeGreaterThan(812 / 2 - 1);
    expect(card.bottom).toBeLessThanOrEqual(812);
    expect(card.h).toBeLessThanOrEqual(812 * 0.4 + 1);
    await page.click('#hamburger');
    await over('#addCounter');
  });
  test('the plumbing tour asks for its work inside targets: circled water closets by real clicks, and a typical-floor box that must stay in its boundary', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.goto('/app/?tour=plumbing');
    await ready(page);
    await waitForStep(page, 'welcome');
    await expect(page.locator('#tourShow')).toHaveText('Open the sample plan');   // the one hands-off step keeps a button that does it
    await page.click('#tourShow');
    await waitForStep(page, 'scale');
    for (const next of ['measure', 'counter', 'place']) { await page.evaluate(() => window.App.tutorialDoStep()); await waitForStep(page, next); }
    await page.waitForTimeout(900);   // the focus zoom
    const zones = () => page.evaluate(() => window.App.tutorialZoneScreen());
    let zs = await zones();
    expect(zs.length).toBe(3);
    zs.forEach((z) => expect(z.r).toBeGreaterThanOrEqual(25));          // 30 pt apart on the sheet: the step zoomed in so they are worth clicking
    expect(zs[1].cx - zs[0].cx).toBeGreaterThan(zs[0].r * 1.6);         // and they do not swallow one another
    for (let i = 0; i < 3; i++) { zs = await zones(); await page.mouse.click(zs[i].cx - zs[i].r * 0.4, zs[i].cy + zs[i].r * 0.4); await page.waitForTimeout(250); }
    await waitForStep(page, 'linetype');
    // the typical floor: a box hanging out of the boundary is refused with the reason
    for (const next of ['chain', 'drop', 'hangers', 'zone']) { await page.evaluate(() => window.App.tutorialDoStep()); await waitForStep(page, next); }
    await page.waitForTimeout(900);
    const z = (await zones())[0];
    expect(z.kind).toBe('box');
    const drag = async (a, b) => {
      await page.keyboard.press('x');
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
      await expect(page.locator('#multiplyZoneModal')).toHaveClass(/visible/, { timeout: 5000 });
      await page.fill('#multiplyZoneMultiplier', '3');
      await page.click('#multiplyZoneApply');
      await page.waitForTimeout(600);
    };
    await drag({ x: z.outer.x1 - 60, y: z.outer.y1 - 40 }, { x: z.inner.x2 + 4, y: z.inner.y2 + 4 });
    expect(await stepId(page)).toBe('zone');
    await expect(page.locator('#tourStatus')).toContainText('outside the boundary');
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForTimeout(400);
    const z2 = (await zones())[0];
    await drag({ x: (z2.outer.x1 + z2.inner.x1) / 2, y: (z2.outer.y1 + z2.inner.y1) / 2 }, { x: (z2.outer.x2 + z2.inner.x2) / 2, y: (z2.outer.y2 + z2.inner.y2) / 2 });
    await waitForStep(page, 'rfi');
    expect(errors).toEqual([]);
  });
});

// The fourth tour (features/tour-blank.js): every button, on a blank sheet the tour makes
// itself. Its do-it-for-me path walks all 36 steps on real state, each one's own check
// satisfied through the same App.* door a click uses; its doors start it; finishing sets
// only its own key and hides only its own link; Snap to 45° goes back the way it was.
test.describe('Every button, on a blank sheet', () => {
  const walk = async (page, id, assertion) => {
    await waitForStep(page, id);
    const info = await page.evaluate(() => window.App.tutorialStepInfo());
    if (info.kind === 'do' && !info.done) await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => window.App.tutorialStepInfo().done, null, { timeout: 8000 });
    if (assertion) await assertion();
    // a doing step advances a beat after it is done; a reading or holding step waits for Next
    await page.waitForFunction((want) => window.App.tutorialStepId() !== want, id, { timeout: 2500 }).catch(async () => { await page.click('#tourNext'); });
  };

  test('the do-it-for-me path presses every button on a sheet the tour made, and finishing hides only its own link', async ({ page }) => {
    test.setTimeout(150000);
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.goto('/app/');
    await ready(page);
    await page.evaluate(() => { try { ['clickcount-tour-done', 'clickcount-tour-done-plumbing', 'clickcount-tour-done-hvac', 'clickcount-tour-done-blank'].forEach((k) => localStorage.removeItem(k)); } catch (_) {} });
    await page.reload();
    await ready(page);
    expect(await page.locator('#canvasEmptyHintTourBlank').isVisible()).toBe(true);
    const snapBefore = await page.evaluate(() => !!(window.state.lineTypeSettings && window.state.lineTypeSettings.snapToHorizontalVertical));
    const paletteBefore = await page.evaluate(() => [window.state.counters.length, window.state.lineTypes.length, (window.state.groups || []).length, !!window.state.groupsEnabled]);
    await page.click('#canvasEmptyHintTourBlank');
    expect(await page.evaluate(() => [window.App.tutorialId(), window.App.tutorialStepId()])).toEqual(['blank', 'welcome']);
    expect(await page.locator('#tourStepNo').textContent()).toBe('1 / 36');
    const ann = () => page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]));
    const fixture = () => page.evaluate(() => window.state.counters.find((c) => c.name === 'Fixture'));

    await walk(page, 'welcome', async () => {
      // two blank ANSI B sheets, made in the browser, through the normal intake
      expect(await page.evaluate(() => [window.state.pages.length, window.state.currentProjectName, window.App.getPageSheetAnalysis(0).isStandard])).toEqual([2, 'blank-sheet', true]);
      expect(await page.evaluate(() => window.state.trade)).toBe(null);   // no trade is stamped
      // the sheets name themselves off the title block the tour drew, so the card's "SK-2" is the sidebar's
      expect(await page.evaluate(() => window.state.pages.map((p) => p.label))).toEqual(['SK-1', 'SK-2']);
    });
    await walk(page, 'scale', async () => { expect(await page.evaluate(() => window.state.pages[0].scale.pixelsPerUnit)).toBe(9); });
    await walk(page, 'measure', async () => { expect(await page.evaluate(() => window.state.lastMeasure.text)).toBe('Distance: 20\'-0"'); });
    await walk(page, 'move');
    await walk(page, 'counter', async () => { expect(await fixture()).toBeTruthy(); });
    await walk(page, 'count', async () => { const c = await fixture(); expect((await ann()).counterMarkers[c.id].length).toBe(3); });
    await walk(page, 'quickkeys', async () => {
      const c = await fixture();
      expect(await page.evaluate(() => window.state.numberKeyBindings[1].id)).toBe(c.id);
      expect((await ann()).counterMarkers[c.id].length).toBe(4);
    });
    await walk(page, 'linetype', async () => {
      expect(await page.evaluate(() => window.state.lineTypes.some((l) => l.name === 'Pipe'))).toBe(true);
      expect((await ann()).quickLines.length).toBe(1);
    });
    await walk(page, 'snap', async () => { expect(await page.evaluate(() => window.state.lineTypeSettings.snapToHorizontalVertical)).toBe(true); });
    await walk(page, 'polyline', async () => { expect((await ann()).polylines.map((p) => p.points.length)).toEqual([3]); });
    await walk(page, 'chain', async () => { const c = await fixture(); const a = await ann(); expect([a.counterMarkers[c.id].length, a.quickLines.length]).toEqual([6, 2]); });
    await walk(page, 'drop', async () => {
      expect((await ann()).quickLines.map((q) => [q.startDrop || 0, q.endDrop || 0])).toEqual([[0, 0], [3, 0]]);
      expect(await page.evaluate(() => window.state.showDropSizes)).toBe(true);
    });
    await walk(page, 'duct', async () => { expect((await ann()).ductRuns.length).toBe(1); });
    await walk(page, 'highlight', async () => { expect((await ann()).highlights.length).toBe(1); });
    await walk(page, 'multiply', async () => { expect((await ann()).multiplyZones.map((z) => z.multiplier)).toEqual([2]); });
    await walk(page, 'scalezone', async () => { expect((await ann()).scaleZones.map((z) => z.scale.pixelsPerUnit)).toEqual([18]); });
    await walk(page, 'room', async () => { expect(await page.evaluate(() => window.state.rooms.map((r) => r.name))).toEqual(['Office']); expect((await ann()).roomBoxes.length).toBe(1); });
    await walk(page, 'ghost', async () => { expect((await ann()).ghosts.length).toBe(1); });
    await walk(page, 'deletearea', async () => { const c = await fixture(); expect((await ann()).counterMarkers[c.id].length).toBe(5); });
    await walk(page, 'note', async () => {
      expect((await ann()).notes.length).toBe(1);
      expect(await page.locator('#notesLedgerBtn').getAttribute('aria-expanded')).toBe('false');   // opened, read, closed
    });
    await walk(page, 'toggles', async () => { expect(await page.evaluate(() => [window.state.showLegendOverlay, window.state.showGridOverlay, window.state.hideMarks])).toEqual([true, false, false]); });
    await walk(page, 'undo', async () => { expect((await ann()).notes.length).toBe(1); });   // undone, then redone
    await walk(page, 'layers', async () => { expect(await page.evaluate(() => { const p = window.state.pages[0]; return [p.canvases.length, window.App.getActiveCanvas(p) === p.canvases[0]]; })).toEqual([2, true]); });
    await walk(page, 'pages', async () => { expect(await page.evaluate(() => [window.state.currentPage, window.state.pages[1].rotation])).toEqual([0, 90]); });
    await walk(page, 'zoom');
    await walk(page, 'sidebar', async () => { expect(await page.evaluate(() => document.body.classList.contains('sidebar-collapsed'))).toBe(false); });
    await walk(page, 'groups', async () => { expect(await page.evaluate(() => [window.state.groupsEnabled, window.state.groups.map((g) => g.name)])).toEqual([true, ['Area A']]); });
    await walk(page, 'summary', async () => { await expect(page.locator('#summaryCountDetailModal')).toHaveClass(/visible/); });
    await walk(page, 'bidcheck', async () => { expect(await page.evaluate(() => window.state.bidCheckCollapsed)).toBe(false); });
    await walk(page, 'settings', async () => { await expect(page.locator('#settingsModal')).toHaveClass(/visible/); });
    await walk(page, 'savestatus', async () => { await expect(page.locator('#saveStatusModal')).toHaveClass(/visible/); });
    await walk(page, 'exportmenu');
    await walk(page, 'exports');
    await walk(page, 'clearpage', async () => { expect(await page.evaluate(() => window.App.countCanvasMarks(window.App.getActiveCanvas(window.state.pages[0]).annotations))).toBe(0); });
    await walk(page, 'close', async () => { expect(await page.evaluate(() => window.state.pages.length)).toBe(0); });
    await waitForStep(page, 'done');
    expect(await page.locator('#tourNext').textContent()).toBe('Finish');
    await page.click('#tourNext');
    expect(await stepId(page)).toBe(null);
    // its own key, its own link; the trade tours' links stay
    expect(await page.evaluate(() => ['clickcount-tour-done-blank', 'clickcount-tour-done', 'clickcount-tour-done-plumbing', 'clickcount-tour-done-hvac'].map((k) => !!localStorage.getItem(k)))).toEqual([true, false, false, false]);
    expect(await page.evaluate(() => [document.getElementById('canvasEmptyHintBlank').style.display, document.getElementById('canvasEmptyHintTour').style.display])).toEqual(['none', '']);
    // Snap to 45° is the device's: put back
    expect(await page.evaluate(() => !!(window.state.lineTypeSettings && window.state.lineTypeSettings.snapToHorizontalVertical))).toBe(snapBefore);
    // the Fixture, the Pipe, Area A and the key binding do not follow the reader onto their next bid
    expect(await page.evaluate(() => [window.state.counters.length, window.state.lineTypes.length, (window.state.groups || []).length, !!window.state.groupsEnabled])).toEqual(paletteBefore);
    expect(await page.evaluate(() => Object.keys(window.state.numberKeyBindings || {}).length)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('?tour=blank, the Learn button and the Settings link start it; over a teaching set it resets without asking', async ({ page }) => {
    await page.goto('/app/?tour=blank');
    await ready(page);
    await waitForStep(page, 'welcome');
    expect(await page.evaluate(() => window.App.tutorialId())).toBe('blank');
    await page.click('#tourLeave');
    await page.evaluate(() => window.App.openLearnMenu());
    await page.click('#learnTour-blank');
    expect(await page.evaluate(() => [window.App.tutorialId(), window.App.tutorialStepId()])).toEqual(['blank', 'welcome']);
    // the sheet opens; leaving and starting again from Settings opens it fresh, no question asked
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'scale');
    await page.click('#tourLeave');
    await page.evaluate(() => window.App.showModal('settingsModal'));
    if (await page.getAttribute('#settingsHelpToggle', 'aria-expanded') !== 'true') await page.click('#settingsHelpToggle');
    await page.click('#settingsTourBlank');
    await waitForStep(page, 'welcome');
    await page.evaluate(() => window.App.tutorialDoStep());
    await waitForStep(page, 'scale');
    expect(await page.evaluate(() => [window.state.pages.length, window.state.currentProjectName, document.querySelectorAll('.modal-overlay.visible').length])).toEqual([2, 'blank-sheet', 0]);
  });
});

// @ts-check
/**
 * TOUR-RESTART (DECOMPOSITION_MAP.md S07, defect N11): a tour, lesson or course chapter that
 * starts while another is running stops the running one first, as "left, not finished", so
 * its clean-up runs (features/tutorial.js startTutorial). The doors stay reachable mid-tour
 * (the overlay takes no pointer events): Learn's tour buttons and rows, Project Settings →
 * Help, the empty-canvas links, the ?lesson= style links.
 *
 * Guards: a lesson's device settings (Snap, the sidebar filter) and the reader's search words
 * come back when a trade tour replaces it; a lesson that replaces a lesson still hands back the
 * READER's settings when it stops, not the first lesson's; the replaced tour's "left" event is
 * logged; a tour started again from the top logs its "left" and starts over.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, collectConsoleErrors, stepTo } = require('./spec-helpers');

const snapOn = (page) => page.evaluate(() => !!(window.state.lineTypeSettings && window.state.lineTypeSettings.snapToHorizontalVertical));
const scope = (page) => page.evaluate(() => window.App.getCounterListFilterScope());
// The tour_step events the engine sends, recorded in the page (no cloud session here).
const recordEvents = (page) => page.evaluate(() => { window.__events = []; window.App.logUserEvent = (type, _pid, meta) => { window.__events.push({ type, meta }); }; });
const tourEvents = (page) => page.evaluate(() => window.__events.filter((e) => e.type === 'tour_step' && (e.meta.step === 'left' || e.meta.step === 'start' || e.meta.step === 'finished')).map((e) => e.meta.tour + ':' + e.meta.step));

// Start a lesson the way a Learn row does, open its sheets, and land on `stepId`.
async function lessonAt(page, id, stepId) {
  await page.evaluate((l) => window.App.startLesson(l), id);
  await stepTo(page, 'sheets', 10000);
  await page.evaluate(() => window.App.tutorialDoStep());
  await page.waitForFunction(() => window.App.tutorialStepId() !== 'sheets', null, { timeout: 30000 });
  await page.evaluate((s) => window.App.tutorialGoTo(s), stepId);
  await page.waitForFunction((s) => window.App.tutorialStepId() === s, stepId, { timeout: 5000 });
}

test.describe('TOUR-RESTART: a tour that starts stops the one running', () => {
  test('a trade tour from Learn, mid-lesson: the lesson\'s Snap is put back, the reader\'s words come back with the tour, and the lesson is logged as left', async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectConsoleErrors(page);
    await bootApp(page, { ready: () => !!(window.App && window.App.startLesson) });
    // the reader's own device: Snap off, a word in the COUNTERS search
    await page.evaluate(() => { const s = window.state; s.counterSearch = 'FD'; localStorage.setItem('counterSearch', 'FD'); document.getElementById('counterSearchInput').value = 'FD'; window.App.updateUI(); });
    expect(await snapOn(page)).toBe(false);
    await recordEvents(page);
    await lessonAt(page, 'measuring', 'snap');
    await page.evaluate(() => window.App.tutorialDoStep());   // the lesson turns Snap on
    expect(await snapOn(page)).toBe(true);
    expect(await page.evaluate(() => window.state.counterSearch)).toBe('');   // the lesson cleared the word
    expect(await page.evaluate(() => !!localStorage.getItem('clickcount-lesson-device-before'))).toBe(true);
    // without leaving the lesson: Learn → Plumbing tour
    await page.evaluate(() => window.App.openLearnMenu());
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    await page.click('#learnTour-plumbing');
    expect(await page.evaluate(() => window.App.tutorialId())).toBe('plumbing');
    expect(await page.evaluate(() => window.App.tutorialStepId())).toBe(await page.evaluate(() => window.App.tutorialManifest('plumbing').steps[0].id));
    expect(await snapOn(page)).toBe(false);   // the lesson's stop put the reader's Snap back
    expect(await page.evaluate(() => localStorage.getItem('clickcount-lesson-device-before'))).toBe(null);
    expect(await page.evaluate(() => window.state.counterSearch)).toBe('');   // the tour holds the word while it runs
    expect(await tourEvents(page)).toEqual(['lesson:measuring:start', 'lesson:measuring:left', 'plumbing:start']);
    await page.click('#tourLeave');
    expect(await page.evaluate(() => [window.state.counterSearch, document.getElementById('counterSearchInput').value])).toEqual(['FD', 'FD']);   // and types it back
    expect(await snapOn(page)).toBe(false);
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    errors.assertNoErrors();
  });

  test('a lesson from a Learn row, mid-lesson: the first lesson\'s filter comes back, and the second lesson\'s stop hands back the READER\'s settings', async ({ page }) => {
    test.setTimeout(120000);
    const errors = collectConsoleErrors(page);
    await bootApp(page, { ready: () => !!(window.App && window.App.startLesson) });
    // the reader's own sidebar filter is "used anywhere in the project"
    await page.evaluate(() => { window.App.setCounterListFilterScope('project'); window.App.updateUI(); });
    expect(await scope(page)).toBe('project');
    await recordEvents(page);
    await lessonAt(page, 'organize', 'filter');
    await page.evaluate(() => window.App.tutorialDoStep());   // the lesson filters to this sheet
    expect(await scope(page)).toBe('page');
    // Learn → the Measuring row, without leaving Organizing
    await page.evaluate(() => window.App.openLearnMenu());
    await page.click('#learnList .learn-row[data-lesson="measuring"]');
    expect(await page.evaluate(() => window.App.tutorialId())).toBe('lesson:measuring');
    expect(await scope(page)).toBe('project');   // Organizing's stop put the reader's filter back
    expect(await tourEvents(page)).toEqual(['lesson:organize:start', 'lesson:organize:left', 'lesson:measuring:start']);
    // Measuring took its own snapshot of the reader's device: Snap on, then leave
    await stepTo(page, 'sheets', 10000);
    await page.evaluate(() => window.App.tutorialDoStep());
    await stepTo(page, 'snap', 30000);
    await page.evaluate(() => window.App.tutorialDoStep());
    expect(await snapOn(page)).toBe(true);
    await page.click('#tourLeave');
    expect(await snapOn(page)).toBe(false);
    expect(await scope(page)).toBe('project');
    expect(await page.evaluate(() => localStorage.getItem('clickcount-lesson-device-before'))).toBe(null);
    errors.assertNoErrors();
  });

  test('the same tour started again: the running one is logged as left and the new one starts at its first step', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectConsoleErrors(page);
    await bootApp(page, { ready: () => !!(window.App && window.App.startTutorial) });
    await page.evaluate(() => { const s = window.state; s.counterSearch = 'FD'; localStorage.setItem('counterSearch', 'FD'); document.getElementById('counterSearchInput').value = 'FD'; window.App.updateUI(); });
    await recordEvents(page);
    await page.evaluate(() => window.App.startTutorial('electrical'));
    const first = await page.evaluate(() => window.App.tutorialStepId());
    const second = await page.evaluate(() => window.App.tutorialManifest('electrical').steps[1].id);
    await page.evaluate((s) => window.App.tutorialGoTo(s), second);
    expect(await page.evaluate(() => window.App.tutorialStepId())).toBe(second);
    // Project Settings → Help → the electrical tour, from inside it
    await page.evaluate(() => window.App.showModal('settingsModal'));
    await page.click('#settingsHelpToggle');
    await page.click('#settingsTour');
    expect(await page.evaluate(() => [window.App.tutorialId(), window.App.tutorialStepId()])).toEqual(['electrical', first]);
    expect(await tourEvents(page)).toEqual(['electrical:start', 'electrical:left', 'electrical:start']);
    expect(await page.evaluate(() => window.state.counterSearch)).toBe('');
    await page.click('#tourLeave');
    expect(await page.evaluate(() => window.state.counterSearch)).toBe('FD');   // one snapshot, the reader's, typed back once
    expect(await page.evaluate(() => localStorage.getItem('clickcount-tour-searches-before'))).toBe(null);
    errors.assertNoErrors();
  });
});

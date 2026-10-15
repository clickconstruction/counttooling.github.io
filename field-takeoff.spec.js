// @ts-check
/**
 * The test drive's field door (FIELD-TAKEOFF, 2026-10-02): /app/?field=<course> opens that
 * course's sheets with its finished takeoff on them (chapter 8's seed, then its "Finish the
 * takeoff for me"), and no card (features/lessons.js registerCourse, openFinished).
 *
 * Guards: each trade lands on its answer key with no tour running and no dialog up; a SECOND
 * visit lands on the same takeoff, not the last visit's marks plus a fresh set (21 SD-1 for 11,
 * found by hand), and the last visit's sample sheets are never offered back as "your last
 * session" (restore-last-session.js drops a teaching set's local offer once a plan is open).
 *
 * The first-tap prompt (DEMO-TRACK decision 3, 2026-10-02): one line on the sheet ("Tap any mark
 * to read it", HVAC "Tap any diffuser") is up when the takeoff lands, is not a .modal-overlay (so
 * the restore offer and the Esc ladder never see it), goes on the first pointerdown, and does not
 * come back on the next visit in the same tab. On a 375 px phone it reads whole, under the sheet.
 */
const { test, expect } = require('@playwright/test');
const { collectConsoleErrors } = require('./spec-helpers');

const tally = (page) => page.evaluate(() => {
  const S = window.App.state;
  const marks = {};
  let runs = 0, ducts = 0, rooms = 0;
  S.pages.forEach((p) => (p.canvases || []).forEach((cv) => {
    const a = cv.annotations || {};
    Object.entries(a.counterMarkers || {}).forEach(([id, ms]) => {
      const c = S.counters.find((x) => x.id === id);
      if (c) marks[c.name] = (marks[c.name] || 0) + ms.length;
    });
    runs += (a.polylines || []).length + (a.quickLines || []).length;
    ducts += (a.ductRuns || []).length;
    rooms += (a.roomBoxes || []).length;
  }));
  const total = Object.values(marks).reduce((n, v) => n + v, 0);
  return { name: S.currentProjectName, marks, total, runs, ducts, rooms };
});

async function openField(page, trade) {
  await page.goto('/app/?field=' + trade);
  await page.waitForFunction((t) => window.App && window.App.finishedTakeoffReady === t, trade, { timeout: 45000 });
}
const PROMPT = { plumbing: 'Tap any mark to read it', electrical: 'Tap any mark to read it', hvac: 'Tap any diffuser' };
async function expectPrompt(page, trade) {
  const card = page.locator('#fieldPrompt');
  await expect(card).toBeVisible();
  await expect(card).toHaveText(PROMPT[trade]);
  const shape = await card.evaluate((c) => ({
    inOverlay: !!c.closest('.modal-overlay'), overlay: c.classList.contains('modal-overlay'),
    onSheet: !!c.closest('#canvasWrapper'), whole: c.scrollWidth <= c.clientWidth, clicks: getComputedStyle(c).pointerEvents,
  }));
  expect(shape).toEqual({ inOverlay: false, overlay: false, onSheet: true, whole: true, clicks: 'none' });
}
async function tapSheet(page) {
  // a corner of the sheet's own area, clear of the marks: the tap is a pointerdown like a finger's
  const box = await page.locator('#canvasWrapper').boundingBox();
  await page.mouse.click(box.x + 6, box.y + 6);
}
async function expectQuiet(page) {
  expect(await page.evaluate(() => !!(window.App.isTutorialActive && window.App.isTutorialActive()))).toBe(false);
  // the restore offer is checked a beat after boot; give a deferred one its turn before looking
  await page.waitForTimeout(1500);
  expect(await page.locator('.modal-overlay.visible').evaluateAll((els) => els.map((e) => e.id))).toEqual([]);
}

const TRADES = [
  { trade: 'plumbing', set: 'sample-lessons', check: (t) => { expect(t.total).toBe(36); expect(t.runs).toBeGreaterThanOrEqual(9); } },
  { trade: 'electrical', set: 'sample-electrical', check: (t) => { expect(t.total).toBe(69); expect(t.runs).toBeGreaterThanOrEqual(3); } },
  { trade: 'hvac', set: 'sample-hvac', check: (t) => { expect(t.marks['SD-1 · Supply Diffuser']).toBe(11); expect(t.ducts).toBe(7); expect(t.rooms).toBe(3); } },
];

for (const { trade, set, check } of TRADES) {
  test(`?field=${trade} lands on the finished takeoff, and a second visit lands on the same one`, async ({ page }) => {
    test.setTimeout(120000);
    const errors = collectConsoleErrors(page);
    await openField(page, trade);
    // the counts are drawn big and ringed for a phone, in memory only: the device's settings are untouched
    expect(await page.evaluate(() => ({ size: window.App.state.counterSettings.size, rings: window.App.state.counterSettings.showRings }))).toEqual({ size: 48, rings: true });
    expect(await page.evaluate(() => localStorage.getItem('counterSettings'))).toBe(null);
    const first = await tally(page);
    expect(first.name).toBe(set);
    check(first);
    await expectPrompt(page, trade);
    await expectQuiet(page);
    await expect(page.locator('#fieldPrompt')).toBeVisible();   // nothing but a tap takes it down
    await tapSheet(page);
    await expect(page.locator('#fieldPrompt')).toHaveCount(0);

    await openField(page, trade);
    const again = await tally(page);
    expect(again).toEqual(first);
    await expect(page.locator('#fieldPrompt')).toHaveCount(0);   // once a tab session
    await expectQuiet(page);
    errors.assertNoErrors();
  });
}

test('?field= on a 375 px phone: the prompt reads whole, just under the sheet, and one tap takes it', async ({ page }) => {
  test.setTimeout(90000);
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await openField(page, 'hvac');
  await expectPrompt(page, 'hvac');
  // the fitted sheet is a band at the top of a phone: the line sits under it, inside the screen
  await expect.poll(() => page.evaluate(() => {
    const c = document.getElementById('fieldPrompt').getBoundingClientRect();
    const s = document.getElementById('pdfCanvas').getBoundingClientRect();
    return c.top >= s.bottom && c.top - s.bottom < 40 && c.left >= 0 && c.right <= window.innerWidth;
  }), { timeout: 10000 }).toBe(true);
  await page.locator('#pdfCanvas').dispatchEvent('pointerdown');
  await expect(page.locator('#fieldPrompt')).toHaveCount(0);
  errors.assertNoErrors();
});

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
    const first = await tally(page);
    expect(first.name).toBe(set);
    check(first);
    await expectQuiet(page);

    await openField(page, trade);
    const again = await tally(page);
    expect(again).toEqual(first);
    await expectQuiet(page);
    errors.assertNoErrors();
  });
}

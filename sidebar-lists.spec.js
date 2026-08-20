// @ts-check
/**
 * Tests: the sidebar Counters / Line Types / Groups renderers extracted to
 * features/sidebar-lists.js (the lines-list recipe). Guards the registry
 * contract (the four re-homed registrations) and the moved behavior: rows
 * render through the real updateUI path, counter search filters, badge counts
 * aggregate across pages, row click runs the ONE selection path
 * (App.setActiveCounterType — same as Quick Keys), and group rows count their
 * members via countItemsInGroup.
 *
 * Second test: the multiply-zone agreement pin (JOURNEY-MAP Tier-2 #24) — the
 * COUNTERS badge and the SUMMARY row must show the SAME multiply-adjusted
 * number for the same counter, and both must say which number is which in
 * trade words ("7 placed · 13 with repeats"). Covers all three usage-filter
 * scopes (off / page / project), since a filtered list still tallies every
 * sheet.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Sidebar lists (features/sidebar-lists.js)', () => {
  test('registry wired; counters/line-types/groups render, search + selection work', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Registry contract: the four re-homed registrations.
    const wired = await page.evaluate(() =>
      ['renderCountersList', 'renderLineTypesList', 'renderGroupsList', 'countItemsInGroup']
        .every((k) => typeof window.App[k] === 'function'));
    expect(wired).toBe(true);

    // Seed a scaled takeoff: two counters (one with markers on both pages),
    // one line type with a run, and a group tagging one marker.
    await page.evaluate(() => {
      const s = window.state;
      s.pages.forEach((p) => { p.scale = { pixelsPerUnit: 12, unit: 'ft' }; });
      s.counters = [
        { id: 'c1', name: 'Water Closet', icon: 'M0 0h10v10H0z', color: '#e8c547' },
        { id: 'c2', name: 'Lavatory', icon: 'M0 0h10v10H0z', color: '#4a9eff' },
      ];
      s.lineTypes = [{ id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' }];
      s.groups = [{ id: 'g1', name: 'Restroom A', color: '#c94f7c' }];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 10, y: 10, id: 'm1', group: 'g1' }, { x: 20, y: 20, id: 'm2' }] };
      c0.annotations.quickLines = [{ x1: 0, y1: 0, x2: 120, y2: 0, color: '#47c88e', id: 'q1', lineTypeId: 'lt1' }];
      const c1 = window.App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.counterMarkers = { c1: [{ x: 30, y: 30, id: 'm3' }] };
      window.App.updateUI();
    });

    // Counters: both rows, cross-page badge count for c1 (2 + 1 = 3).
    await expect(page.locator('#countersList .sidebar-item')).toHaveCount(2);
    const wcRow = page.locator('#countersList .sidebar-item', { hasText: 'Water Closet' });
    await expect(wcRow.locator('.badge')).toHaveText('3');

    // Search filters through the real input handler.
    await page.locator('#counterSearchInput').fill('lav');
    await expect(page.locator('#countersList .sidebar-item')).toHaveCount(1);
    await page.locator('#counterSearchInput').fill('');
    await expect(page.locator('#countersList .sidebar-item')).toHaveCount(2);

    // Row click runs the ONE selection path (same function Quick Keys calls);
    // clicking again deselects.
    await wcRow.click();
    await page.waitForFunction(() => window.state.activeCounterType === 'c1');
    await page.locator('#countersList .sidebar-item', { hasText: 'Water Closet' }).click();
    await page.waitForFunction(() => window.state.activeCounterType === null);

    // Line types: run count + always-feet total (120 pdf-pts at 12 px/ft = 10 ft).
    const ltRow = page.locator('#lineTypesList .sidebar-item', { hasText: '2in Waste' });
    await expect(ltRow.locator('.badge')).toHaveText('1 · 10.00 ft');

    // Groups: the tagged marker counts via countItemsInGroup.
    await expect(page.locator('#groupsList .sidebar-item', { hasText: 'Restroom A' }).locator('.badge')).toHaveText('1');
    expect(await page.evaluate(() => window.App.countItemsInGroup('g1'))).toBe(1);

    expect(errors).toEqual([]);
  });

  test('multiply zones: COUNTERS badge and SUMMARY row agree, labelled in trade words', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Seed the exact shape of the finding: a typical-floor ×3 zone and a ×2
    // zone on sheet 1, plus a counter used only on sheet 2 (so the page-scope
    // filter has something to hide).
    //   Water Closet: 7 placed, 3 of them in the ×3 zone -> 13 with repeats
    //   Lavatory:     9 placed, 2 of them in the ×2 zone -> 11 with repeats
    //   Water Heater: 5 placed on sheet 2, no zone       ->  5 either way
    await page.evaluate(() => {
      const s = window.state;
      s.pages.forEach((p) => { p.scale = { pixelsPerUnit: 12, unit: 'ft' }; });
      s.counters = [
        { id: 'c1', name: 'Water Closet', icon: 'M0 0h10v10H0z', color: '#e8c547' },
        { id: 'c2', name: 'Lavatory', icon: 'M0 0h10v10H0z', color: '#4a9eff' },
        { id: 'c3', name: 'Water Heater', icon: 'M0 0h10v10H0z', color: '#c94f7c' },
      ];
      s.lineTypes = [];
      const mk = (x, y, id) => ({ x, y, id });
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.multiplyZones = [
        { id: 'z3', x1: 0, y1: 0, x2: 50, y2: 50, multiplier: 3 },
        { id: 'z2', x1: 200, y1: 200, x2: 260, y2: 260, multiplier: 2 },
      ];
      c0.annotations.counterMarkers = {
        c1: [mk(10, 10, 'a1'), mk(20, 20, 'a2'), mk(30, 30, 'a3'),
          mk(100, 100, 'a4'), mk(120, 100, 'a5'), mk(140, 100, 'a6'), mk(160, 100, 'a7')],
        c2: [mk(210, 210, 'b1'), mk(230, 230, 'b2'),
          mk(100, 300, 'b3'), mk(120, 300, 'b4'), mk(140, 300, 'b5'), mk(160, 300, 'b6'),
          mk(180, 300, 'b7'), mk(100, 320, 'b8'), mk(120, 320, 'b9')],
      };
      const c1 = window.App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.counterMarkers = {
        c3: [mk(10, 10, 'h1'), mk(30, 10, 'h2'), mk(50, 10, 'h3'), mk(70, 10, 'h4'), mk(90, 10, 'h5')],
      };
      window.App.updateUI();
    });

    const counterBadge = (name) => page.locator('#countersList .sidebar-item', { hasText: name }).locator('.badge');
    const summaryBadge = (name) => page.locator('#summaryList .sidebar-item', { hasText: name }).locator('.badge');

    // ONE arithmetic: both surfaces show the multiply-adjusted number.
    await expect(counterBadge('Water Closet')).toHaveText('13');
    await expect(summaryBadge('Water Closet')).toHaveText('13');
    await expect(counterBadge('Lavatory')).toHaveText('11');
    await expect(summaryBadge('Lavatory')).toHaveText('11');
    await expect(counterBadge('Water Heater')).toHaveText('5');
    await expect(summaryBadge('Water Heater')).toHaveText('5');

    // ...and both say which number is which, in trade words.
    await expect(counterBadge('Water Closet')).toHaveAttribute('title', '7 placed on the plan — Multiply Zones repeat them, so totals bill 13.');
    await expect(summaryBadge('Water Closet')).toHaveAttribute('title', '7 placed on the plan — Multiply Zones repeat them, so totals bill 13.');
    // An unmultiplied row says so too — no bare number anywhere.
    await expect(counterBadge('Water Heater')).toHaveAttribute('title', '5 placed');

    // The always-visible note (no hover needed) names both numbers and the
    // scope of the tally: 7+9+5 = 21 placed, 13+11+5 = 29 with repeats.
    const counterNote = page.locator('#countersList .sidebar-repeats-note');
    const summaryNote = page.locator('#summaryList .sidebar-repeats-note');
    await expect(counterNote).toContainText('21 placed');
    await expect(counterNote).toContainText('29 with repeats');
    await expect(counterNote).toContainText('all sheets');
    await expect(summaryNote).toContainText('21 placed');
    await expect(summaryNote).toContainText('29 with repeats');

    // Usage-filter scopes: 'page' hides the sheet-2-only counter, so the note
    // always matches the Summary footnote (21 placed / 29 with repeats) while
    // every visible badge keeps its all-sheets arithmetic. The Summary is not
    // filtered and keeps the project numbers.
    await page.evaluate(() => { window.App.setCounterListFilterScope('page'); window.App.updateUI(); });
    await expect(page.locator('#countersList .sidebar-item')).toHaveCount(2);
    await expect(counterBadge('Water Closet')).toHaveText('13');
    await expect(counterNote).toContainText('21 placed');
    await expect(counterNote).toContainText('29 with repeats');
    await expect(summaryNote).toContainText('21 placed');
    // The usage hint still renders alongside the repeats note.
    await expect(page.locator('#countersList .sidebar-filter-hint-clear')).toHaveCount(1);

    await page.evaluate(() => { window.App.setCounterListFilterScope('project'); window.App.updateUI(); });
    await expect(page.locator('#countersList .sidebar-item')).toHaveCount(3);
    await expect(counterBadge('Water Heater')).toHaveText('5');
    await expect(counterNote).toContainText('21 placed');

    await page.evaluate(() => { window.App.setCounterListFilterScope('off'); window.App.updateUI(); });
    await expect(page.locator('#countersList .sidebar-item')).toHaveCount(3);
    await expect(counterNote).toContainText('21 placed');

    // No multiply zones -> no note, and the badge is the plain placed count.
    await page.evaluate(() => {
      window.App.getPageCanvases(window.state.pages[0]).forEach((c) => { c.annotations.multiplyZones = []; });
      window.App.updateUI();
    });
    await expect(counterBadge('Water Closet')).toHaveText('7');
    await expect(summaryBadge('Water Closet')).toHaveText('7');
    await expect(page.locator('#countersList .sidebar-repeats-note')).toHaveCount(0);
    await expect(page.locator('#summaryList .sidebar-repeats-note')).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});

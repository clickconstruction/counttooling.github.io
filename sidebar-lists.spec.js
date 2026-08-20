// @ts-check
/**
 * Tests: the sidebar Counters / Line Types / Groups renderers extracted to
 * features/sidebar-lists.js (the lines-list recipe). Guards the registry
 * contract (the four re-homed registrations) and the moved behavior: rows
 * render through the real updateUI path, counter search filters, badge counts
 * aggregate across pages, row click runs the ONE selection path
 * (App.setActiveCounterType — same as Quick Keys), and group rows count their
 * members via countItemsInGroup.
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

  // JOURNEY Tier-2 #24: the COUNTERS badge used to show a RAW marker sum while
  // Summary (and the footer, count-detail modal, and report) showed the
  // multiply-zone-adjusted total — two disagreeing numbers in one sidebar,
  // neither labeled. Pins: one multiply-adjusted arithmetic everywhere, and
  // trade-word labels ("N placed · M with repeats") on both surfaces whenever
  // Multiply Zones inflate a count — across all three usage-filter scopes.
  test('multiply zones: COUNTERS badge, Summary rows, and footer agree, labeled across filter scopes', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // The journey-map repro: 7 markers for c1 on page 0 — 3 inside a x3
    // Multiply Zone, 4 outside — so 7 placed but totals bill 4 + 3x3 = 13.
    // c2 has one un-zoned marker on page 1 (plain badges must stay plain).
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [
        { id: 'c1', name: 'Water Closet', icon: 'M0 0h10v10H0z', color: '#e8c547' },
        { id: 'c2', name: 'Lavatory', icon: 'M0 0h10v10H0z', color: '#4a9eff' },
      ];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.multiplyZones = [{ x1: 0, y1: 0, x2: 50, y2: 50, multiplier: 3, id: 'z1' }];
      c0.annotations.counterMarkers = { c1: [
        { x: 10, y: 10, id: 'i1' }, { x: 20, y: 20, id: 'i2' }, { x: 30, y: 30, id: 'i3' },
        { x: 100, y: 100, id: 'o1' }, { x: 110, y: 110, id: 'o2' },
        { x: 120, y: 120, id: 'o3' }, { x: 130, y: 130, id: 'o4' },
      ] };
      const c1 = window.App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.counterMarkers = { c2: [{ x: 40, y: 40, id: 'm-p2' }] };
      window.App.updateUI();
    });

    const wcBadge = page.locator('#countersList .sidebar-item', { hasText: 'Water Closet' }).locator('.badge');
    const lavBadge = page.locator('#countersList .sidebar-item', { hasText: 'Lavatory' }).locator('.badge');
    const wcSummary = page.locator('#summaryList .sidebar-item[data-id="c1"] .badge');
    const lavSummary = page.locator('#summaryList .sidebar-item[data-id="c2"] .badge');

    // One arithmetic, labeled the same way on both surfaces.
    await expect(wcBadge).toHaveText('7 placed · 13 with repeats');
    await expect(wcSummary).toHaveText('7 placed · 13 with repeats');
    await expect(wcBadge).toHaveAttribute('title', /7 markers placed[\s\S]*13/);
    await expect(wcSummary).toHaveAttribute('title', /7 markers placed[\s\S]*13/);
    // Un-zoned counter: plain number, both places, no label noise.
    await expect(lavBadge).toHaveText('1');
    await expect(lavSummary).toHaveText('[1]');
    // Footer runs the same multiply-adjusted arithmetic: 13 + 1.
    expect(await page.evaluate(() => window.App.getFooterTotalsCached().count)).toBe(14);

    // The usage-filter scopes change row VISIBILITY only — never the
    // arithmetic or the label. (currentPage is 0; c2 lives on page 1.)
    for (const scope of ['page', 'project', 'off']) {
      await page.evaluate((sc) => { window.App.setCounterListFilterScope(sc); window.App.updateUI(); }, scope);
      await expect(wcBadge).toHaveText('7 placed · 13 with repeats');
      if (scope === 'page') {
        await expect(page.locator('#countersList .sidebar-item')).toHaveCount(1);
      } else {
        await expect(lavBadge).toHaveText('1');
      }
      await expect(wcSummary).toHaveText('7 placed · 13 with repeats');
    }

    // Grouped Summary path: tag one in-zone marker; every group row keeps the
    // adjusted arithmetic with its own per-group trade-word label.
    await page.evaluate(() => {
      const s = window.state;
      s.groups = [{ id: 'g1', name: 'Restroom A', color: '#c94f7c' }];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers.c1[0].group = 'g1';   // one x3 marker
      window.App.updateUI();
    });
    // Restroom A: 1 placed x3 = 3. Untagged: 6 placed -> 2x3 + 4 = 10.
    await expect(page.locator('#summaryList .sidebar-item[data-id="c1"] .badge')).toHaveText(
      ['1 placed · 3 with repeats', '6 placed · 10 with repeats']);

    expect(errors).toEqual([]);
  });
});

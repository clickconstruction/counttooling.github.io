// @ts-check
/**
 * Tests: the sidebar Lines section renderer extracted to features/lines-list.js
 * — the first split out of app.js's UI Render Functions region.
 *
 * Guards the registry failure modes (App.renderLinesList never registered; the
 * five new publish-only deps missing) plus the moved behavior end-to-end:
 * per-type grouping with run-count + always-feet totals, expand/collapse
 * persisting to localStorage, the lines search filter, row selection jumping to
 * the line's page, and deselect on second click. Also pins the defensive
 * updateUI seam: a full updateUI() must repopulate the list (the hot path calls
 * App.renderLinesList && App.renderLinesList()).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Lines list (features/lines-list.js)', () => {
  test('registry wired; grouping, totals, expand, search, select/jump all work', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Registry contract: entry point + the five new publish-only deps.
    const wired = await page.evaluate(() => ({
      renderLinesList: typeof window.App?.renderLinesList,
      deps: ['formatArea', 'polygonArea', 'pickScaleForLineType', 'getLineRealWorldLengthFeet', 'onDoubleTapOrDblClick']
        .every((k) => typeof window.App[k] === 'function'),
    }));
    expect(wired.renderLinesList).toBe('function');
    expect(wired.deps).toBe(true);

    // Seed: a scaled 2-page takeoff with two named quick lines on page 0 and a
    // polyline on page 1, all one line type, then let the real updateUI path
    // (which reaches the feature defensively) render the list.
    await page.evaluate(() => {
      const s = window.state;
      s.pages.forEach((p) => { p.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' }; });
      s.lineTypes = [{ id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' }];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.quickLines = [
        { x1: 0, y1: 0, x2: 120, y2: 0, color: '#47c88e', id: 'q1', name: 'Kitchen run', lineTypeId: 'lt1' },
        { x1: 0, y1: 20, x2: 60, y2: 20, color: '#47c88e', id: 'q2', name: 'Bath run', lineTypeId: 'lt1' },
      ];
      const c1 = window.App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.polylines = [
        { points: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }], closed: false, color: '#47c88e', id: 'p1', name: 'Main stack', lineTypeId: 'lt1' },
      ];
      s.linesTypeExpanded = { lt1: true };
      s.linesListCollapsed = false;   // the Lines SECTION starts minimized by default
      document.getElementById('linesSection')?.classList.remove('collapsed');
      window.App.updateUI();
    });

    // Grouping + totals: one type group, 3 runs, 10 + 5 + 10 = 25 ft.
    const group = page.locator('#linesList .lines-type-group');
    await expect(group).toHaveCount(1);
    await expect(group.locator('.lines-type-summary')).toHaveText('3 lines · 25.00 ft');
    await expect(group.locator('.sidebar-item')).toHaveCount(3);

    // Collapse: header click flips the group and persists the preference.
    await group.locator('.lines-type-header').click();
    await expect(group).toHaveClass(/collapsed/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('linesTypeExpanded'))['lt1'])).toBe(false);
    await group.locator('.lines-type-header').click();
    await expect(group).not.toHaveClass(/collapsed/);

    // Search filters by line name through the real input handler.
    await page.locator('#linesSearchInput').fill('kitchen');
    await expect(page.locator('#linesList .sidebar-item')).toHaveCount(1);
    await expect(page.locator('#linesList .sidebar-item .name')).toContainText('Kitchen run');
    await page.locator('#linesSearchInput').fill('');
    await expect(page.locator('#linesList .sidebar-item')).toHaveCount(3);

    // Selecting a page-1 line jumps there and marks it selected; clicking the
    // same row again deselects (same semantics the in-app.js version had).
    await page.locator('#linesList .sidebar-item', { hasText: 'Main stack' }).click();
    await page.waitForFunction(() => window.state.currentPage === 1);
    expect(await page.evaluate(() => ({ id: window.state.selectedLineId, poly: window.state.selectedLineIsPoly }))).toEqual({ id: 'p1', poly: true });
    await page.locator('#linesList .sidebar-item', { hasText: 'Main stack' }).click();
    await page.waitForFunction(() => window.state.selectedLineId === null);

    expect(errors).toEqual([]);
  });
});

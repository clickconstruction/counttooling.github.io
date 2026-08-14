// @ts-check
/**
 * Tests: the three-scope sidebar usage filter (off / page / project) on the
 * Counters and Line Types lists. Guards the scope cycle on the inline search
 * buttons (glyph swap + titles), the merged-canvas usage predicate and badges
 * (a mark on a non-active layer still counts — the T1-11 rule), the
 * active-type exemption (a just-created type stays visible before its first
 * mark), the "N hidden by filter — show all" hint row, the settings-modal
 * segmented controls (#counterShowOnlySegment / #lineTypeShowOnlySegment),
 * and the legacy boolean fallback (showOnly*OnCurrentPage -> 'page').
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadTwoPagePdf(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

function collectErrors(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
}

test.describe('Sidebar usage filter (off / page / project)', () => {
  test('counters: scope cycle, merged counting, exemption, hint row, modal segment', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await loadTwoPagePdf(page);

    // Seed: c1 marked on page 0 (active canvas), c2 marked ONLY on a second
    // canvas layer of page 1 (proves merged counting + project scope), c3
    // never placed.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [
        { id: 'c1', name: 'Water Closet', icon: 'M0 0h10v10H0z', color: '#e8c547' },
        { id: 'c2', name: 'Lavatory', icon: 'M0 0h10v10H0z', color: '#4a9eff' },
        { id: 'c3', name: 'Water Heater', icon: 'M0 0h10v10H0z', color: '#c94f7c' },
      ];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 10, y: 10, id: 'm1' }] };
      window.App.ensureActiveCanvas(s.pages[1]);
      s.pages[1].canvases.push({ id: 'layer2', name: 'Layer 2', annotations: window.makeAnnotations() });
      s.pages[1].canvases[1].annotations.counterMarkers = { c2: [{ x: 30, y: 30, id: 'm2' }] };
      window.App.updateUI();
    });

    const rows = page.locator('#countersList .sidebar-item');
    const hint = page.locator('#countersList .sidebar-filter-hint');
    const btn = page.locator('#counterShowOnlyOnPageInlineBtn');

    // Off: all three rows; c2's badge counts the non-active layer (merged).
    await expect(rows).toHaveCount(3);
    await expect(page.locator('#countersList .sidebar-item', { hasText: 'Lavatory' }).locator('.badge')).toHaveText('1');

    // Click 1 -> page scope: only c1 is used on page 0.
    await btn.click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Water Closet');
    await expect(hint).toHaveText('2 hidden by filter — show all');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveAttribute('data-scope', 'page');

    // Page scope follows the current page: page 1 shows only c2 (layer 2).
    await page.evaluate(() => { window.state.currentPage = 1; window.App.updateUI(); });
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Lavatory');
    await page.evaluate(() => { window.state.currentPage = 0; window.App.updateUI(); });

    // Click 2 -> project scope: c1 + c2 used anywhere; glyph swaps.
    await btn.click();
    await expect(rows).toHaveCount(2);
    await expect(hint).toHaveText('1 hidden by filter — show all');
    await expect(btn).toHaveAttribute('data-scope', 'project');
    expect(await btn.innerHTML()).toContain('viewBox="0 0 16 16"');

    // Active-type exemption: selecting the unused c3 keeps it visible.
    await page.evaluate(() => { window.App.setActiveCounterType('c3'); });
    await expect(rows).toHaveCount(3);
    await expect(hint).toHaveCount(0);
    await page.evaluate(() => { window.App.setActiveCounterType(null); });

    // The settings-modal segment mirrors the scope; "Off" clears from there.
    await page.evaluate(() => window.App.openCounterSettingsModal());
    const seg = page.locator('#counterShowOnlySegment');
    await expect(seg.locator('button[data-scope="project"]')).toHaveAttribute('aria-pressed', 'true');
    await seg.locator('button[data-scope="off"]').click();
    await expect(rows).toHaveCount(3);
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(await btn.innerHTML()).toContain('viewBox="0 0 640 640"');
    await page.evaluate(() => window.App.hideModal('counterSettingsModal'));

    // Hint-row "show all": re-enter project scope, then clear via the link.
    await btn.click();
    await btn.click();
    await expect(hint).toHaveCount(1);
    await page.locator('#countersList .sidebar-filter-hint-clear').click();
    await expect(rows).toHaveCount(3);
    expect(await page.evaluate(() => window.App.getCounterListFilterScope())).toBe('off');

    // Legacy boolean fallback: a settings object with only the old flag reads
    // as 'page'.
    expect(await page.evaluate(() => {
      window.state.counterSettings.sidebarFilterScope = undefined;
      window.state.counterSettings.showOnlyCountersOnCurrentPage = true;
      return window.App.getCounterListFilterScope();
    })).toBe('page');

    expect(errors).toEqual([]);
  });

  test('cycle clicks narrate the landed state via the three-line toast', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await loadTwoPagePdf(page);

    const toast = page.locator('#airboardToastText');
    const btn = page.locator('#counterShowOnlyOnPageInlineBtn');

    await btn.click();
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    await expect(toast).toContainText('Filter:');
    await expect(toast).toContainText('counters used on this page');
    await expect(toast.locator('.toast-hint-line')).toHaveText('(click again: this project)');

    await btn.click();
    await expect(toast).toContainText('counters used anywhere in this project');
    await expect(toast.locator('.toast-hint-line')).toHaveText('(click again: show all)');

    await btn.click();
    await expect(toast).toContainText('off — showing all counters');
    await expect(toast.locator('.toast-hint-line')).toHaveText('(click again: this page)');

    // The line-type button narrates its own kind.
    await page.locator('#lineTypeShowOnlyOnPageInlineBtn').click();
    await expect(toast).toContainText('line types used on this page');

    expect(errors).toEqual([]);
  });

  test('line types: scope cycle, merged usage + totals, hint row, modal segment', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await loadTwoPagePdf(page);

    // Seed: lt1 has a run on a second canvas layer of page 0 (merged usage),
    // lt2 is never drawn. Scale so the badge shows feet.
    await page.evaluate(() => {
      const s = window.state;
      s.pages.forEach((p) => { p.scale = { pixelsPerUnit: 12, unit: 'ft' }; });
      s.lineTypes = [
        { id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' },
        { id: 'lt2', name: 'Unused Type', color: '#999999', curveStyle: 'straight' },
      ];
      window.App.ensureActiveCanvas(s.pages[0]);
      s.pages[0].canvases.push({ id: 'layer2', name: 'Layer 2', annotations: window.makeAnnotations() });
      s.pages[0].canvases[1].annotations.quickLines = [{ x1: 0, y1: 0, x2: 120, y2: 0, color: '#47c88e', id: 'q1', lineTypeId: 'lt1' }];
      window.App.updateUI();
    });

    const rows = page.locator('#lineTypesList .sidebar-item');
    const hint = page.locator('#lineTypesList .sidebar-filter-hint');
    const btn = page.locator('#lineTypeShowOnlyOnPageInlineBtn');

    // Off: both rows; lt1's badge tallies the non-active layer (merged):
    // 120 pdf-pts at 12 px/ft = 10 ft.
    await expect(rows).toHaveCount(2);
    await expect(page.locator('#lineTypesList .sidebar-item', { hasText: '2in Waste' }).locator('.badge')).toHaveText('1 · 10.00 ft');

    // Page scope hides lt2; project scope keeps hiding it; off restores.
    await btn.click();
    await expect(rows).toHaveCount(1);
    await expect(hint).toHaveText('1 hidden by filter — show all');
    await btn.click();
    await expect(btn).toHaveAttribute('data-scope', 'project');
    await expect(rows).toHaveCount(1);
    await btn.click();
    await expect(rows).toHaveCount(2);
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    // The settings-modal segment drives the scope too.
    await page.evaluate(() => window.App.openLineTypeSettingsModal());
    const seg = page.locator('#lineTypeShowOnlySegment');
    await expect(seg.locator('button[data-scope="off"]')).toHaveAttribute('aria-pressed', 'true');
    await seg.locator('button[data-scope="project"]').click();
    await expect(rows).toHaveCount(1);
    await expect(btn).toHaveAttribute('data-scope', 'project');
    await page.evaluate(() => window.App.hideModal('lineTypeSettingsModal'));

    // Hint-row "show all" clears the scope and re-syncs the segment.
    await page.locator('#lineTypesList .sidebar-filter-hint-clear').click();
    await expect(rows).toHaveCount(2);
    expect(await page.evaluate(() => window.App.getLineTypeListFilterScope())).toBe('off');

    expect(errors).toEqual([]);
  });
});

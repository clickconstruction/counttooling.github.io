// @ts-check
/**
 * Tests: the three-scope sidebar usage filter (off / page / project) on the
 * Counters and Line Types lists. Guards the scope cycle on the inline search
 * buttons (glyph swap + titles), the merged-canvas usage predicate and badges
 * (a mark on a non-active layer still counts — the T1-11 rule), the
 * active-type exemption (a just-created type stays visible before its first
 * mark), the scope-aware "N not used on this sheet / in this project —
 * show all" hint row, per-device localStorage persistence, the settings-modal
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
    await expect(hint).toHaveText('2 not used on this sheet — show all');
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
    await expect(hint).toHaveText('1 not used in this project — show all');
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

  // T2-11 — the filter scope only HIDES unused rows; the badge expression is
  // all-pages in every scope. With a multiply zone in play, the with-repeats
  // badge number must be identical across off/page/project — this pins that a
  // future scope mode can never re-fork the badge arithmetic (the resolved
  // sidebar-lists.js:39 caution from the J18 dossier).
  test('counters badge value is identical across off/page/project scopes with a zone seeded', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await loadTwoPagePdf(page);

    // c1: 2 marks on page 0 (1 inside a x3 zone -> 4 with repeats) + 1 mark
    // on page 1 -> 5 with repeats all-pages, in every scope.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Water Closet', icon: 'M0 0h10v10H0z', color: '#e8c547' }];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 10, y: 10, id: 'm1' }, { x: 100, y: 100, id: 'm2' }] };
      c0.annotations.multiplyZones.push({ x1: 0, y1: 0, x2: 50, y2: 50, multiplier: 3, id: 'z1' });
      const c1 = window.App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.counterMarkers = { c1: [{ x: 30, y: 30, id: 'm3' }] };
      window.App.updateUI();
    });

    const badge = page.locator('#countersList .sidebar-item', { hasText: 'Water Closet' }).locator('.badge');
    const btn = page.locator('#counterShowOnlyOnPageInlineBtn');

    // Off scope.
    await expect(badge).toHaveText('5');
    await expect(badge).toHaveAttribute('title', '3 placed · 5 with repeats');

    // Page scope: row still visible (used on page 0), badge unchanged.
    await btn.click();
    await expect(btn).toHaveAttribute('data-scope', 'page');
    await expect(badge).toHaveText('5');
    await expect(badge).toHaveAttribute('title', '3 placed · 5 with repeats');

    // Project scope: same number again.
    await btn.click();
    await expect(btn).toHaveAttribute('data-scope', 'project');
    await expect(badge).toHaveText('5');
    await expect(badge).toHaveAttribute('title', '3 placed · 5 with repeats');

    // Back to off for a clean device state.
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(badge).toHaveText('5');

    expect(errors).toEqual([]);
  });

  test('cycle clicks narrate the landed state via the two-line toast', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await loadTwoPagePdf(page);

    const toast = page.locator('#airboardToastText');
    const btn = page.locator('#counterShowOnlyOnPageInlineBtn');

    await btn.click();
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    await expect(toast).toHaveText('Filter: counters used on this sheet');
    await expect(toast.locator('.toast-hint-line')).toHaveCount(0);

    await btn.click();
    await expect(toast).toHaveText('Filter: counters used anywhere in this project');
    await expect(toast.locator('.toast-hint-line')).toHaveCount(0);

    await btn.click();
    await expect(toast).toHaveText('Filter: counters off — showing all');
    await expect(toast.locator('.toast-hint-line')).toHaveCount(0);

    // The line-type button narrates its own kind.
    await page.locator('#lineTypeShowOnlyOnPageInlineBtn').click();
    await expect(toast).toHaveText('Filter: line types used on this sheet');

    // The two-state Lines toggle narrates too (both directions).
    await page.evaluate(() => { document.getElementById('linesSectionTitle').click(); });
    await page.locator('#linesShowOnlyOnPageBtn').click();
    await expect(toast).toHaveText('Filter: lines on this sheet only');
    await expect(toast.locator('.toast-hint-line')).toHaveCount(0);
    await page.locator('#linesShowOnlyOnPageBtn').click();
    await expect(toast).toHaveText('Filter: lines off — showing every sheet');

    expect(errors).toEqual([]);
  });

  test('collapse chevrons sit at the row end and still toggle their sections', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await loadTwoPagePdf(page);

    // Counters chevron moved out of the h3 (after "+ Add"): its own handler
    // still collapses the section.
    const countersIcon = page.locator('#countersCollapseIcon');
    expect(await page.evaluate(() =>
      document.getElementById('countersCollapseIcon').parentElement.classList.contains('sidebar-section-header-row'))).toBe(true);
    await countersIcon.click();
    await expect(page.locator('#countersSection')).toHaveClass(/collapsed/);
    await countersIcon.click();
    await expect(page.locator('#countersSection')).not.toHaveClass(/collapsed/);

    // Groups chevron (title-driven section) forwards to the title toggle.
    await page.evaluate(() => {
      window.state.groups = window.App.ensureGroupColors([{ id: 'g1', name: 'Restroom A' }]);
      window.App.updateUI();
    });
    await page.locator('#groupsCollapseIcon').click();
    await expect(page.locator('#groupsSection')).not.toHaveClass(/collapsed/);
    await page.locator('#groupsCollapseIcon').click();
    await expect(page.locator('#groupsSection')).toHaveClass(/collapsed/);

    expect(errors).toEqual([]);
  });

  test('filter scope persists per device across reloads (recovered bb19fa design)', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => window.App.setCounterListFilterScope('project'));
    expect(await page.evaluate(() => localStorage.getItem('counterSidebarFilterScope'))).toBe('project');

    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.App.getCounterListFilterScope())).toBe('project');
    // Boot updateUI reflects the restored scope on the inline button.
    await expect(page.locator('#counterShowOnlyOnPageInlineBtn')).toHaveAttribute('data-scope', 'project');

    // An explicit reset to off sticks across reloads too.
    await page.evaluate(() => window.App.setCounterListFilterScope('off'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.App.getCounterListFilterScope())).toBe('off');

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
    await expect(hint).toHaveText('1 not used on this sheet — show all');
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

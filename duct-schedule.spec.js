// @ts-check
/**
 * Tests: the Duct Schedule + go-live (DUCT-PLAN.md unit D5 — the shippable
 * core checkpoint).
 *
 * - GO-LIVE: #ductBtn is visible with NO preview flag (no localStorage key,
 *   the App.enableDuctPreview shim gone — also pinned in duct-tool.spec.js).
 * - The schedule modal's numbers are pinned END-TO-END against seeded runs
 *   whose rollup lands exactly on the DUCT-PLAN worked bid math:
 *   straight 1,435 lb + counted fittings 130 lb = 1,565 lb, ×1.15 seam &
 *   waste = 1,800 lb Bid weight. Rows re-derived through the REAL inference
 *   walk (elbows/transitions/tap) and the real gauge auto-pick — nothing
 *   hand-stamped. Round rows carry the joint count ("52' · 6 joints @ 10'").
 * - Counted ↔ Factor % toggle: flips the applied pounds without recomputing
 *   the takeoff (factor 40% default → 2,310 lb bid; editable %, both persist
 *   on state.ductSettings — the per-project field).
 * - Seam & waste % is editable and re-prices the bid line.
 * - Copy Schedule: exact clipboard text (tab-separated, PipeTooling-paste
 *   friendly) and the T1-05 pre-copy scale gate (a page with an unscaled
 *   duct run opens #toolingScaleCheckModal; Export anyway still copies).
 * - Scope: This sheet / Every sheet segment (visible at 2 pages) narrows the
 *   straight totals to the current page.
 * - Legend: duct rows paint behind legendSettings.showDuct (default ON) and
 *   the Legend Settings toggle turns them off (pixel probe on the box).
 * - Report/export integration: buildReportHtml() carries the Duct Schedule
 *   table (the same HTML the Export PDFs / pdf-bundle report path rasters).
 * - Telemetry: finishDuctRun fires duct_run via App.logUserEvent with
 *   { segments, totalFt, totalLb, airside, fittings }.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

// The worked seeds (12 pdf-pts per foot). Run A: 24×12 for 70' (elbow at the
// 35' corner) → steps to 20×12 for 83' (elbow at 40') → steps to 14×10 for
// 68' (elbow at 34'). Run B taps A (first vertex ON A's polyline): 10"Ø for
// 52' with one elbow. Auto gauges @1" w.g.: 24 ga rect rows, 26 ga on the
// 10"Ø. Straight = 1,435.01 lb; fittings (3+1 elbows + 2 transitions + tap)
// = 130.25 lb; subtotal 1,565.26; +15% = 1,800.05 → the pinned display run:
// 1,435 + 130 = 1,565 → ×1.15 → 1,800.
const RUN_A = {
  id: 'run-a', name: 'Trunk', airside: 'supply', pressureClass: '1', linerType: 'liner',
  vertices: [
    { x: 100, y: 100 }, { x: 520, y: 100 }, { x: 520, y: 520 }, { x: 520, y: 1000 },
    { x: 1036, y: 1000 }, { x: 1444, y: 1000 }, { x: 1444, y: 592 },
  ],
  segments: [
    { startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } },
    { startVertexIdx: 2, size: { kind: 'rect', w: 20, h: 12 } },
    { startVertexIdx: 4, size: { kind: 'rect', w: 14, h: 10 } },
  ],
};
const RUN_B = {
  id: 'run-b', name: 'Branch', airside: 'return', pressureClass: '1', linerType: 'wrap',
  vertices: [{ x: 520, y: 300 }, { x: 832, y: 300 }, { x: 832, y: 612 }],
  segments: [{ startVertexIdx: 0, size: { kind: 'round', d: 10 } }],
};

// The pinned Copy Schedule output for RUN_A + RUN_B (counted mode, whole
// project) — tab-separated columns, exactly what lands on the clipboard.
const EXPECTED_COPY = [
  'Duct Schedule',
  '-------------',
  '',
  'Straight duct',
  "24×12\t24 ga\t70'\t6.94 lb/ft\t486 lb",
  "20×12\t24 ga\t83'\t6.17 lb/ft\t512 lb",
  "14×10\t24 ga\t68'\t4.62 lb/ft\t314 lb",
  '10"Ø\t26 ga\t52\' · 6 joints @ 10\'\t2.37 lb/ft\t123 lb',
  "Straight total\t\t273'\t\t1,435 lb",
  '',
  'Fittings (counted)',
  '90° elbow\t10"Ø\t1\t11.9 lb ea\t12 lb',
  '90° elbow\t14×10\t1\t23.1 lb ea\t23 lb',
  '90° elbow\t20×12\t1\t30.8 lb ea\t31 lb',
  '90° elbow\t24×12\t1\t34.7 lb ea\t35 lb',
  'Transition\t20×12\t1\t12.3 lb ea\t12 lb',
  'Transition\t24×12\t1\t13.9 lb ea\t14 lb',
  'Tap\t10"Ø\t1\t3.6 lb ea\t4 lb',
  'Fittings total\t\t\t\t130 lb',
  '',
  'Liner\t1,135 sq ft',
  'Wrap\t136 sq ft',
  '',
  'Straight + fittings\t1,565 lb',
  'Seam & waste (+15%)\t235 lb',
  'Bid weight\t1,800 lb',
].join('\n');

test.describe('Duct Schedule + go-live (D5)', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 12 pdf-pts per foot on page 0, like the other duct specs.
    await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
  });

  // Seed a committed run on a page's active canvas + re-walk fittings (the
  // duct-sidebar.spec recipe, page-parameterized).
  async function seedRun(page, run, pageIdx = 0) {
    await page.evaluate(({ cfg, pi }) => {
      const canvas = window.App.ensureActiveCanvas(window.state.pages[pi]);
      if (!canvas.annotations.ductRuns) canvas.annotations.ductRuns = [];
      canvas.annotations.ductRuns.push(window.makeDuctRun(cfg));
      window.App.reinferDuctFittings(pi);
      window.App.updateUI();
      window.App.renderAnnotations();
    }, { cfg: run, pi: pageIdx });
  }

  async function openSchedule(page) {
    await expect(page.locator('#ductSection')).toBeVisible();
    await page.locator('#ductScheduleBtn').click();
    await expect(page.locator('#ductScheduleModal')).toHaveClass(/visible/);
  }

  test('go-live: #ductBtn visible with NO preview flag', async ({ page }) => {
    await expect(page.locator('#ductBtn')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('clickcount-duct-preview'))).toBeNull();
    expect(await page.evaluate(() => typeof window.App.enableDuctPreview)).toBe('undefined');
    expect(errors).toEqual([]);
  });

  test('schedule modal: the worked bid math end-to-end (1,435 + 130 = 1,565 ×1.15 = 1,800 lb)', async ({ page }) => {
    await seedRun(page, RUN_A);
    await seedRun(page, RUN_B);
    await openSchedule(page);

    const body = page.locator('#ductScheduleBody');
    // Straight rows, big-to-small, with the round row's joint count.
    const straightRows = body.locator('table').first().locator('tr');
    await expect(straightRows.nth(1)).toHaveText("24×1224 ga70'6.94486");
    await expect(straightRows.nth(2)).toHaveText("20×1224 ga83'6.17512");
    await expect(straightRows.nth(3)).toHaveText("14×1024 ga68'4.62314");
    await expect(straightRows.nth(4)).toHaveText('10"Ø26 ga52\' · 6 joints @ 10\'2.37123');
    await expect(straightRows.nth(5)).toHaveText("Straight total273'1,435");

    // Counted fittings (default mode) — 7 rows totalling 130 lb.
    await expect(body.locator('#ductFitModeSegment button[data-fitmode="counted"]')).toHaveClass(/active/);
    const fitTable = body.locator('table').nth(1);
    await expect(fitTable.locator('tr')).toHaveCount(9);   // header + 7 rows + total
    await expect(fitTable.locator('tr').nth(1)).toHaveText('90° elbow10"Ø111.912');
    await expect(fitTable.locator('tr').nth(8)).toHaveText('Fittings total130');

    // Insulation, subtotal, seam & waste, Bid weight.
    await expect(body).toContainText('Liner');
    await expect(body).toContainText('1,135 sq ft');
    await expect(body).toContainText('136 sq ft');
    const rollup = body.locator('.duct-schedule-rollup').last();
    await expect(rollup.locator('tr').nth(0)).toHaveText('Straight + fittings1,565 lb');
    await expect(rollup.locator('tr').nth(1)).toContainText('235 lb');
    await expect(rollup.locator('.duct-schedule-bid-row')).toHaveText('Bid weight1,800 lb');

    expect(errors).toEqual([]);
  });

  test('Counted ↔ Factor toggle: applied pounds flip, % edits re-price, both persist on ductSettings', async ({ page }) => {
    await seedRun(page, RUN_A);
    await seedRun(page, RUN_B);
    await openSchedule(page);
    const body = page.locator('#ductScheduleBody');

    // Factor mode: one row at the default 40% of straight → 574 lb, bid 2,310.
    await body.locator('#ductFitModeSegment button[data-fitmode="factor"]').click();
    await expect(body.locator('#ductFitFactorPct')).toHaveValue('40');
    await expect(body.locator('table').nth(1)).toContainText('574');
    await expect(body.locator('.duct-schedule-bid-row')).toHaveText('Bid weight2,310 lb');
    expect(await page.evaluate(() => window.state.ductSettings.fittingMode)).toBe('factor');

    // Edit the factor % → re-prices (50% → 718 lb applied, bid 2,475).
    await body.locator('#ductFitFactorPct').fill('50');
    await body.locator('#ductFitFactorPct').dispatchEvent('change');
    await expect(body.locator('.duct-schedule-bid-row')).toHaveText('Bid weight2,475 lb');
    expect(await page.evaluate(() => window.state.ductSettings.fittingFactorPct)).toBe(50);

    // Back to Counted → the pinned 1,800.
    await body.locator('#ductFitModeSegment button[data-fitmode="counted"]').click();
    await expect(body.locator('.duct-schedule-bid-row')).toHaveText('Bid weight1,800 lb');

    // Seam & waste edit: 0% → bid = the bare subtotal.
    await body.locator('#ductSeamWastePct').fill('0');
    await body.locator('#ductSeamWastePct').dispatchEvent('change');
    await expect(body.locator('.duct-schedule-bid-row')).toHaveText('Bid weight1,565 lb');
    expect(await page.evaluate(() => window.state.ductSettings.seamWastePct)).toBe(0);

    expect(errors).toEqual([]);
  });

  test('Copy Schedule: exact tab-separated clipboard table', async ({ page }) => {
    await seedRun(page, RUN_A);
    await seedRun(page, RUN_B);
    await openSchedule(page);

    await page.locator('#ductScheduleCopy').click();
    await expect(page.locator('#toolingScaleCheckModal')).not.toHaveClass(/visible/);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe(EXPECTED_COPY);

    expect(errors).toEqual([]);
  });

  test('Copy Schedule honors the T1-05 scale gate; Export anyway still copies', async ({ page }) => {
    await seedRun(page, RUN_A);
    // Drop the scale AFTER seeding: the copy walk must flag the page.
    await page.evaluate(() => { window.state.pages[0].scale = null; });
    await openSchedule(page);

    await page.locator('#ductScheduleCopy').click();
    await expect(page.locator('#toolingScaleCheckModal')).toHaveClass(/visible/);
    await expect(page.locator('#toolingScaleCheckList li')).toHaveCount(1);

    await page.locator('#toolingScaleCheckExport').click();
    await expect(page.locator('#toolingScaleCheckModal')).not.toHaveClass(/visible/);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Duct Schedule');
    expect(text).toContain('Bid weight');

    expect(errors).toEqual([]);
  });

  test('scope segment: This sheet narrows to the current page; Every sheet is the default', async ({ page }) => {
    await seedRun(page, RUN_A);
    await seedRun(page, RUN_B);
    // A 20' 24×12 stub on page 1 (its own scale).
    await page.evaluate(() => {
      const s = window.state;
      s.pages[1].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
    await seedRun(page, {
      id: 'run-p2', name: 'Sheet-2 stub', airside: 'supply', pressureClass: '1',
      vertices: [{ x: 100, y: 100 }, { x: 340, y: 100 }],
      segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
    }, 1);
    await openSchedule(page);

    // 2 pages → the segment shows, defaulted to Every sheet (273' + 20').
    const seg = page.locator('#ductScheduleScope');
    await expect(seg).toBeVisible();
    await expect(seg.locator('button[data-scope="project"]')).toHaveClass(/active/);
    const totalRow = page.locator('#ductScheduleBody table').first().locator('.duct-schedule-total-row');
    await expect(totalRow).toContainText("293'");

    await seg.locator('button[data-scope="page"]').click();
    await expect(totalRow).toContainText("273'");

    // Re-open resets to Every sheet (a stale narrow scope must not stick).
    await page.locator('#ductScheduleClose').click();
    await openSchedule(page);
    await expect(seg.locator('button[data-scope="project"]')).toHaveClass(/active/);

    expect(errors).toEqual([]);
  });

  test('legend duct rows: painted by default, hidden by the Legend Settings toggle', async ({ page }) => {
    // One small on-page run at the sheet's bottom; the legend parked top-left,
    // clear of the run's ink — so any pixel inside the legend box is legend ink.
    await seedRun(page, {
      id: 'run-legend', name: 'Legend run', airside: 'supply', pressureClass: '1',
      vertices: [{ x: 60, y: 700 }, { x: 300, y: 700 }],
      segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
    });
    await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      ann.legend.x = 340;
      ann.legend.y = 40;
      window.App.renderAnnotations();
    });
    const legendInk = () => page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
      const l = window.state.pages[0].canvases[0].annotations.legend;
      const tl = window.App.toCanvas({ x: l.x, y: l.y });
      const br = window.App.toCanvas({ x: l.x + l.w, y: l.y + l.h });
      const w = Math.max(1, Math.round(br.x - tl.x)), h = Math.max(1, Math.round(br.y - tl.y));
      const d = c.getContext('2d').getImageData(Math.round(tl.x), Math.round(tl.y), w, h).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
      return false;
    });

    // Default ON: the legend paints (its only rows are the duct rows).
    expect(await legendInk()).toBe(true);

    // Legend Settings → Show duct rows OFF → the legend has zero rows and
    // paints nothing at all (the B10 empty-legend gate).
    await page.evaluate(() => { window.App.openLegendSettingsModal(); });
    await expect(page.locator('#legendSettingsModal')).toHaveClass(/visible/);
    await expect(page.locator('#legendShowDuctBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#legendShowDuctBtn').click();
    await expect(page.locator('#legendShowDuctBtn')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#legendSettingsClose').click();
    expect(await page.evaluate(() => window.state.legendSettings.showDuct)).toBe(false);
    expect(await legendInk()).toBe(false);

    expect(errors).toEqual([]);
  });

  test('report integration: buildReportHtml carries the Duct Schedule table (Export PDFs report path)', async ({ page }) => {
    await seedRun(page, RUN_A);
    await seedRun(page, RUN_B);
    const html = await page.evaluate(() => window.buildReportHtml());
    expect(html).toContain('Duct Schedule');
    expect(html).toContain('Straight total');
    expect(html).toContain('1,435');
    expect(html).toContain('Bid weight');
    expect(html).toContain('1,800 lb');
    // Duct-free reports stay duct-free (a fresh page 1-only scope has runs —
    // use an empty-page scope instead).
    const emptyHtml = await page.evaluate(() => window.buildReportHtml({ pageIndices: [1] }));
    expect(emptyHtml).not.toContain('Duct Schedule');
    expect(errors).toEqual([]);
  });

  test('telemetry: duct_run fires on commit with the schedule units', async ({ page }) => {
    // Stub the registry seam — finishDuctRun resolves App.logUserEvent at
    // call time, so the stub catches the event without a cloud session.
    await page.evaluate(() => {
      window.__ductEvents = [];
      window.App.logUserEvent = (type, pid, meta) => { window.__ductEvents.push({ type, meta }); };
    });
    const wrapper = page.locator('#canvasWrapper');
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => !!window.state.drawingDuct);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 320, y: 150 } });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct);

    const events = await page.evaluate(() => window.__ductEvents.filter((e) => e.type === 'duct_run'));
    expect(events).toHaveLength(1);
    const meta = events[0].meta;
    expect(meta.segments).toBe(1);
    expect(meta.airside).toBe('supply');
    expect(meta.fittings).toBe(0);
    expect(meta.totalFt).toBeGreaterThan(0);
    expect(meta.totalLb).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: Child counts (features/child-counts.js) — words-only quantities that
 * ride a parent counter or line type into the Summary and every export.
 *
 * Rules: per count (counters), per run, per N ft (ceil per run — each run
 * carries its own supports; px runs excluded and flagged, never guessed).
 * Presentation contract: SEPARATE rows under each parent in the Summary;
 * INDENTED rows in the PipeTooling export where the same child name across
 * parents merges into ONE row (emitted under the first parent using it).
 * The rule lives on the palette item (childCounts[]), so it rides save/load,
 * export/import, and the Artboard wholesale.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function setupProject(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft' };
    s.counters.push({ id: 'c-box', name: '1-gang Box', icon: 'M96 96h448v448H96z', color: '#e8c547', childCounts: [{ name: 'Ground screw', qty: 2, per: 'count' }] });
    s.lineTypes.push({ id: 'lt-emt', name: '1in EMT', color: '#4a9eff', childCounts: [{ name: '1in EMT connector', qty: 2, per: 'run' }, { name: 'EMT strap', qty: 1, per: 'ft', ftInterval: 10 }] });
    const ann = s.pages[0].canvases[0].annotations;
    ann.counterMarkers['c-box'] = [
      { x: 50, y: 50, id: 'm1', group: null },
      { x: 60, y: 60, id: 'm2', group: null },
      { x: 70, y: 70, id: 'm3', group: null },
    ];
    // 120 px = 10.00 ft (ceil -> 1 strap), 140 px ≈ 11.67 ft (ceil -> 2 straps)
    ann.quickLines.push({ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt-emt', group: null });
    ann.quickLines.push({ x1: 220, y1: 100, x2: 220, y2: 240, color: '#4a9eff', id: 'q2', lineTypeId: 'lt-emt', group: null });
    window.App.updateUI();
  });
}

test.describe('Child counts', () => {
  test('engine math + Summary rows + PipeTooling + email bullets', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await setupProject(page);

    const totals = await page.evaluate(() => JSON.parse(JSON.stringify(window.App.getChildCountTotals())));
    const rows = totals.byGroup['null'];
    expect(rows.counter['c-box']).toEqual([{ name: 'Ground screw', qty: 2, per: 'count', ftInterval: null, total: 6, excludedPxRuns: 0 }]);
    expect(rows.lineType['lt-emt']).toEqual([
      { name: '1in EMT connector', qty: 2, per: 'run', ftInterval: null, total: 4, excludedPxRuns: 0 },
      { name: 'EMT strap', qty: 1, per: 'ft', ftInterval: 10, total: 3, excludedPxRuns: 0 },
    ]);

    // Summary sidebar: indented child rows under the parents.
    const childRows = await page.evaluate(() => [...document.querySelectorAll('#summaryList .summary-child-item')].map((d) => d.textContent.trim()));
    expect(childRows).toEqual(['Ground screw2/count6', '1in EMT connector2/run4', 'EMT strap1/10 ft3']);

    // PipeTooling: indented (two-space) tab rows under the parents.
    const pipe = await page.evaluate(() => window.getPipeToolingSummary());
    expect(pipe).toContain('1-gang Box\t3\t1\n  Ground screw\t6\t1');
    expect(pipe).toContain('  1in EMT connector\t4\t1');
    expect(pipe).toContain('  EMT strap\t3\t1');

    // Email summary: indented ↳ bullets; report HTML carries the rows too.
    const email = await page.evaluate(() => window.getEmailTextSummary());
    expect(email).toContain('   ↳ Ground screw: 6 (2/count)');
    expect(email).toContain('   ↳ EMT strap: 3 (1/10 ft)');
    expect(await page.evaluate(() => window.buildReportHtml().includes('↳ EMT strap'))).toBe(true);

    expect(errors).toEqual([]);
  });

  test('same child name under two parents: Summary separate, PipeTooling merged', async ({ page }) => {
    await setupProject(page);
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'lt-emt2', name: '1in EMT (ceiling)', color: '#a47fff', childCounts: [{ name: '1in EMT connector', qty: 2, per: 'run' }] });
      s.pages[0].canvases[0].annotations.quickLines.push({ x1: 300, y1: 300, x2: 420, y2: 300, color: '#a47fff', id: 'q3', lineTypeId: 'lt-emt2', group: null });
      window.App.updateUI();
    });
    const summaryConnectorRows = await page.evaluate(() => [...document.querySelectorAll('#summaryList .summary-child-item')].map((d) => d.textContent.trim()).filter((t) => t.includes('connector')));
    expect(summaryConnectorRows).toEqual(['1in EMT connector2/run4', '1in EMT connector2/run2']);
    const pipeConnectorRows = await page.evaluate(() => window.getPipeToolingSummary().split('\n').filter((l) => l.includes('EMT connector')));
    expect(pipeConnectorRows).toEqual(['  1in EMT connector\t6\t1']);
  });

  test('edit UI in the details modal: add per-ft child, remove child', async ({ page }) => {
    await setupProject(page);
    await page.evaluate(() => {
      window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'lt-emt'));
    });
    await expect(page.locator('#childCountsList .child-count-row')).toHaveCount(2);

    // The ft-interval input appears only for the per-ft rule.
    await expect(page.locator('#childCountFtNWrap')).toBeHidden();
    await page.locator('#childCountPer').selectOption('ft');
    await expect(page.locator('#childCountFtNWrap')).toBeVisible();
    await page.locator('#childCountQty').fill('1');
    await page.locator('#childCountName').fill('Beam clamp');
    await page.locator('#childCountFtN').fill('8');
    await page.locator('#childCountAdd').click();
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'lt-emt').childCounts.at(-1))).toEqual({ name: 'Beam clamp', qty: 1, per: 'ft', ftInterval: 8 });
    await expect(page.locator('#childCountsList .child-count-row')).toHaveCount(3);

    // Remove the row again.
    await page.locator('#childCountsList .child-count-row[data-idx="2"] .child-count-remove').click();
    await expect(page.locator('#childCountsList .child-count-row')).toHaveCount(2);
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'lt-emt').childCounts.length)).toBe(2);
  });

  test('per-ft children exclude unscaled (px) runs and flag them', async ({ page }) => {
    await setupProject(page);
    await page.evaluate(() => {
      // A run on the UNSCALED page 2: counts for per-run, excluded for per-ft.
      const ann2 = window.state.pages[1].canvases[0].annotations;
      ann2.quickLines.push({ x1: 100, y1: 100, x2: 300, y2: 100, color: '#4a9eff', id: 'qpx', lineTypeId: 'lt-emt', group: null });
      window.App.updateUI();
    });
    const rows = await page.evaluate(() => JSON.parse(JSON.stringify(window.App.getChildCountTotals())).byGroup['null'].lineType['lt-emt']);
    expect(rows[0]).toMatchObject({ name: '1in EMT connector', total: 6 });        // 3 runs x 2
    expect(rows[1]).toMatchObject({ name: 'EMT strap', total: 3, excludedPxRuns: 1 }); // px run excluded
    // The flag surfaces as * in the Summary row.
    const strapRow = await page.evaluate(() => [...document.querySelectorAll('#summaryList .summary-child-item')].map((d) => d.textContent.trim()).find((t) => t.includes('strap')));
    expect(strapRow).toContain('*');
  });

  test('from the rulebook: a PEX type is offered its hanger by name and size; Add stamps the rule; inch intervals tally and label', async ({ page }) => {
    await setupProject(page);
    await page.evaluate(() => window.App.rulesReady && window.App.rulesReady());
    // a PEX type with the same two runs (10.00 ft and 11.67 ft): 32 in → ceil(10/2.667)=4 + ceil(11.67/2.667)=5 = 9
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes.push({ id: 'lt-pex', name: '1in PEX', color: '#47c88e', curveStyle: 'straight', childCounts: [] });
      const ann = s.pages[0].canvases[0].annotations;
      ann.quickLines.push({ x1: 100, y1: 300, x2: 220, y2: 300, color: '#47c88e', id: 'p1', lineTypeId: 'lt-pex', group: null });
      ann.quickLines.push({ x1: 220, y1: 300, x2: 220, y2: 440, color: '#47c88e', id: 'p2', lineTypeId: 'lt-pex', group: null });
      window.App.updateUI();
    });
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'lt-pex')));
    const suggest = page.locator('#childCountsSuggest');
    await expect(suggest).toBeVisible();
    expect(await suggest.textContent()).toContain('Hanger · 1 per 32 in');
    expect(await suggest.textContent()).toContain('matches PEX · horizontal · 1 in');
    await expect(suggest.locator('.rule-chip[data-rule="plumb.hanger.pex"]')).toBeVisible();
    // no suggestion for a type with no supported material
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'lt-emt')));
    await expect(suggest).toBeHidden();
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'lt-pex')));
    await suggest.locator('.child-count-suggest-add').click();
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'lt-pex').childCounts)).toEqual([{ name: 'Hanger', qty: 1, per: 'ft', intervalIn: 32, ruleId: 'plumb.hanger.pex' }]);
    // taken: the suggestion is gone, the row shows the rule chip, the list shows "per 32 in"
    await expect(suggest).toBeHidden();
    expect(await page.locator('#childCountsList').textContent()).toContain('per 32 in');
    await expect(page.locator('#childCountsList .rule-chip[data-rule="plumb.hanger.pex"]')).toBeVisible();
    // the engine: 4 + 5 = 9, labeled in inches, stamped
    const rows = await page.evaluate(() => window.App.getChildCountTotals().byGroup.null.lineType['lt-pex']);
    expect(rows).toEqual([{ name: 'Hanger', qty: 1, per: 'ft', ftInterval: null, intervalIn: 32, ruleId: 'plumb.hanger.pex', total: 9, excludedPxRuns: 0 }]);
    await page.evaluate(() => window.App.hideModal('counterLineTypeDetailsModal'));
    const child = page.locator('#summaryList .summary-child-item', { hasText: 'Hanger' });
    expect(await child.locator('.child-rule').textContent()).toBe('1/32 in');
    expect(await child.locator('.child-total').textContent()).toBe('9');
    await expect(child.locator('.rule-chip[data-rule="plumb.hanger.pex"]')).toBeVisible();
    // the hand-off text carries the interval the same way
    expect(await page.evaluate(() => window.getPipeToolingSummary())).toContain('  Hanger\t9');
    // a hand-typed inch interval through the editor: 1 per 16 in
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'lt-pex')));
    await page.locator('#childCountName').fill('Riser clamp');
    await page.locator('#childCountPer').selectOption('ft');
    await page.locator('#childCountFtN').fill('16');
    await page.locator('#childCountIntervalUnit').selectOption('in');
    await page.click('#childCountAdd');
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'lt-pex').childCounts.at(-1))).toEqual({ name: 'Riser clamp', qty: 1, per: 'ft', intervalIn: 16 });
  });
});

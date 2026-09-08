// @ts-check
/**
 * Electrical, First-Class S3 — conductors on the run.
 *
 * Guards: a line type's raceway + conductor list yields wire rows per gauge
 * (feet × n, hots + neutrals one row, ground its own) rolled up across line
 * types; a per-line override replaces the type's list for that run; MC yields
 * one cable row and no wire; a counter's cablePerCount yields count × ft;
 * unscaled runs are excluded and flagged; the same numbers appear in the
 * engine, the sidebar Summary, Copy Summary, the TakeoffTooling payload
 * (`derived`, `type: 'wire'`) and the email text; the details-modal editor and
 * the Line Properties override write the fields; the raceway block hides on a
 * plumbing project with no electrical fields.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function seed(page, trade) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate((trade) => {
    const HOT = (n, g) => ({ n, gauge: g, insul: 'THHN', role: 'hot' });
    const GND = (g) => ({ n: 1, gauge: g, insul: 'THHN', role: 'ground' });
    const s = window.state;
    s.trade = trade;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    s.lineTypes.push({ id: 'emt', name: '3/4" EMT', color: '#8a4bb0', raceway: { kind: 'EMT', size: '3/4"' }, conductors: [HOT(3, '#12'), GND('#12')] });
    s.lineTypes.push({ id: 'mc', name: 'MC', color: '#2e8f6a', raceway: { kind: 'MC' }, conductors: [HOT(2, '#12'), GND('#12')] });
    s.counters.push({ id: 'data', name: 'Data drop', icon: 'M96 96h448v448H96z', color: '#4a9eff', cablePerCount: { ft: 150, name: 'Cat6' } });
    const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
    ann.quickLines.push({ x1: 0, y1: 100, x2: 120, y2: 100, id: 'q1', lineTypeId: 'emt', color: '#8a4bb0' });
    ann.quickLines.push({ x1: 0, y1: 200, x2: 120, y2: 200, id: 'q2', lineTypeId: 'emt', color: '#8a4bb0', conductors: [HOT(9, '#12'), GND('#12')] });
    ann.quickLines.push({ x1: 0, y1: 300, x2: 240, y2: 300, id: 'q3', lineTypeId: 'mc', color: '#2e8f6a' });
    ann.counterMarkers.data = [{ x: 50, y: 400, id: 'm1', group: null }, { x: 90, y: 400, id: 'm2', group: null }];
    const ann2 = window.App.ensureActiveCanvas(s.pages[1]).annotations;
    ann2.quickLines.push({ x1: 0, y1: 100, x2: 500, y2: 100, id: 'q4', lineTypeId: 'emt', color: '#8a4bb0' });
    window.App.updateUI();
  }, trade);
}
test.describe('Electrical, First-Class S3 — conductors on the run', () => {
  test('engine, sidebar, Copy Summary, payload and email agree on wire, cable and the exclusions', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await seed(page, 'electrical');
    expect(await page.evaluate(() => typeof window.App?.getConductorTotals)).toBe('function');
    expect(await page.evaluate(() => typeof window.ConductorModel?.parseConductorSpec)).toBe('function');

    // engine: 10 ft × 3 + 10 ft × 9 = 120 ft #12; 20 ft green; MC 20 ft; Cat6 2 × 150
    const totals = await page.evaluate(() => window.App.getConductorTotals());
    const g = totals.byGroup['null'];
    expect(g.wire.map((r) => [r.name, r.feet, r.excludedPxRuns])).toEqual([['#12 THHN', 120, 1], ['#12 THHN green', 20, 1]]);
    expect(g.cable.map((r) => [r.name, r.feet, r.source])).toEqual([['Cat6', 300, 'counter'], ['MC 12/2 w/G', 20, 'lineType']]);

    // sidebar Summary: derived rows, flagged
    const rows = await page.locator('#summaryList .summary-derived-item').allTextContents();
    expect(rows.some((t) => t.includes('#12 THHN') && t.includes('120.00 ft') && t.includes('*'))).toBe(true);
    expect(rows.some((t) => t.includes('MC 12/2 w/G') && t.includes('20.00 ft'))).toBe(true);
    expect(rows.some((t) => t.includes('Cat6') && t.includes('300.00 ft'))).toBe(true);

    // Copy Summary text: `ft of` rows, importers already read them as feet
    const text = await page.evaluate(() => window.getPipeToolingSummary());
    expect(text).toContain('ft of #12 THHN\t120.00');
    expect(text).toContain('ft of #12 THHN green\t20.00');
    expect(text).toContain('ft of MC 12/2 w/G\t20.00');
    expect(text).toContain('ft of Cat6\t300.00');
    expect(text).not.toContain('px of #12');

    // TakeoffTooling payload: facts, not conventions
    const payload = await page.evaluate(() => window.getTakeoffToolingPayload());
    const derived = payload.items.filter((i) => i.derived);
    expect(derived.map((i) => [i.description, i.quantity, i.unit, i.type, i.derived])).toEqual([
      ['Cat6', 300, 'ft', 'wire', 'cable'], ['MC 12/2 w/G', 20, 'ft', 'wire', 'cable'],
      ['#12 THHN', 120, 'ft', 'wire', 'wire'], ['#12 THHN green', 20, 'ft', 'wire', 'wire'],
    ]);
    // the conduit rows themselves are unchanged
    expect(payload.items.find((i) => i.description === '3/4" EMT' && i.unit === 'ft').quantity).toBe(20);
    expect(payload.items.find((i) => i.description === '3/4" EMT' && i.unit === 'px').quantity).toBe(500);

    // email text
    const email = await page.evaluate(() => window.getEmailTextSummary());
    expect(email).toContain('• 120.00 ft of #12 THHN (wire — some runs have no scale)');
    expect(email).toContain('• 300.00 ft of Cat6 (cable, Data drop)');

    // the HTML report carries the derived rows under the group
    const html = await page.evaluate(() => window.buildReportHtml({}));
    expect(html).toContain('⚡ #12 THHN');
    expect(html).toContain('MC 12/2 w/G');
    expect(errors).toEqual([]);
  });

  test('the details-modal editor and the Line Properties override write the fields; plumbing hides the block', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await seed(page, 'electrical');

    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'emt')));
    await page.waitForSelector('#counterLineTypeDetailsModal.visible');
    expect(await page.locator('#racewayGroup').isVisible()).toBe(true);
    expect(await page.inputValue('#racewayKind')).toBe('EMT');
    expect(await page.inputValue('#racewaySize')).toBe('3/4"');
    expect(await page.inputValue('#conductorsSpec')).toBe('3 #12 THHN + 1 #12 THHN G');
    // a new list, in shorthand
    await page.fill('#conductorsSpec', '4 #10 thwn + 1 #10 g');
    await page.press('#conductorsSpec', 'Enter');
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'emt').conductors)).toEqual([
      { n: 4, gauge: '#10', insul: 'THWN', role: 'hot' }, { n: 1, gauge: '#10', insul: 'THHN', role: 'ground' },
    ]);
    expect(await page.inputValue('#conductorsSpec')).toBe('4 #10 THWN + 1 #10 THHN G');
    // junk is refused and the field flagged, the stored list untouched
    await page.fill('#conductorsSpec', 'a bunch of wire');
    await page.press('#conductorsSpec', 'Enter');
    expect(await page.locator('#conductorsSpec').getAttribute('class')).toContain('field-invalid');
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'emt').conductors.length)).toBe(2);
    // raceway → MC disables the size and re-tallies as cable
    await page.selectOption('#racewayKind', 'MC');
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'emt').raceway)).toEqual({ kind: 'MC' });
    expect(await page.locator('#racewaySize').isDisabled()).toBe(true);
    expect(await page.locator('#conductorsSpecHint').textContent()).toContain('MC 10/4 w/G');
    // tick marks toggle
    await page.click('#lineTypeTickMarksBtn');
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'emt').tickMarks)).toBe(false);
    await page.click('#lineTypeTickMarksBtn');
    expect(await page.evaluate(() => 'tickMarks' in window.state.lineTypes.find((l) => l.id === 'emt'))).toBe(false);
    await page.click('#counterLineTypeDetailsClose');

    // counter: cable per count
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters.find((c) => c.id === 'data')));
    await page.waitForSelector('#counterLineTypeDetailsModal.visible');
    expect(await page.locator('#cablePerCountGroup').isVisible()).toBe(true);
    expect(await page.inputValue('#cablePerCountFt')).toBe('150');
    await page.fill('#cablePerCountFt', '175');
    await page.press('#cablePerCountFt', 'Enter');
    expect(await page.evaluate(() => window.state.counters.find((c) => c.id === 'data').cablePerCount)).toEqual({ ft: 175, name: 'Cat6' });
    await page.fill('#cablePerCountFt', '');
    await page.press('#cablePerCountFt', 'Enter');
    expect(await page.evaluate(() => 'cablePerCount' in window.state.counters.find((c) => c.id === 'data'))).toBe(false);
    await page.click('#counterLineTypeDetailsClose');

    // Line Properties: the per-run override
    await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      window.App.openLinePropertiesModal({ type: 'quick', q: ann.quickLines.find((q) => q.id === 'q1'), pageIdx: 0 });
    });
    await page.waitForSelector('#linePropertiesModal.visible');
    expect(await page.locator('#linePropertiesConductorsGroup').isVisible()).toBe(true);
    expect(await page.getAttribute('#linePropertiesConductors', 'placeholder')).toContain('inherits 4 #10 THWN');
    await page.fill('#linePropertiesConductors', '7 #10 + 1 #10 G');
    await page.press('#linePropertiesConductors', 'Enter');
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).quickLines.find((q) => q.id === 'q1').conductors.map((c) => c.n))).toEqual([7, 1]);
    await page.fill('#linePropertiesConductors', '');
    await page.press('#linePropertiesConductors', 'Enter');
    expect(await page.evaluate(() => 'conductors' in window.App.getActiveAnnotations(window.state.pages[0]).quickLines.find((q) => q.id === 'q1'))).toBe(false);
    await page.click('#linePropertiesClose');

    // a plumbing project with a plain line type never sees the block
    await page.evaluate(() => { window.state.trade = 'plumbing'; window.state.lineTypes.push({ id: 'cpvc', name: '1in CPVC', color: '#4a9eff' }); window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'cpvc')); });
    await page.waitForSelector('#counterLineTypeDetailsModal.visible');
    expect(await page.locator('#racewayGroup').isVisible()).toBe(false);
    // …but an electrical line type opened in that same project still shows its facts
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'mc')));
    expect(await page.locator('#racewayGroup').isVisible()).toBe(true);
    expect(errors).toEqual([]);
  });
});

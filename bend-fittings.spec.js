// @ts-check
/**
 * Tests: Fittings from bends (fitting-model.js + features/child-counts.js,
 * punch row BEND-FITTINGS, 2026-09-18). A line type with the option on derives
 * its elbows from each run's own bends (nearer 45° or nearer 90°) and drops,
 * as rows under the type in the Summary and the exports, never as marks. The
 * fitting each class produces is named and counted on the type. Also: the
 * details dialog's toggle and rows, the Bid Check row beside the hangers row,
 * and the bend chips drawing without errors.
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
    s.lineTypes.push({ id: 'lt-cu', name: '2in Cu', color: '#2e86de', curveStyle: 'straight', bendFittings: { enabled: true } });
    s.lineTypes.push({ id: 'lt-pex', name: '3/4in PEX', color: '#4a9eff', curveStyle: 'straight' });
    const ann = s.pages[0].canvases[0].annotations;
    // right, down (a 90), out at 45, back to level (another 45): 1 × 90, 2 × 45
    ann.polylines.push({ id: 'p1', lineTypeId: 'lt-cu', color: '#2e86de', closed: false, points: [{ x: 100, y: 100 }, { x: 220, y: 100 }, { x: 220, y: 220 }, { x: 300, y: 300 }, { x: 420, y: 300 }] });
    // a 10° wobble: no fitting
    ann.polylines.push({ id: 'p2', lineTypeId: 'lt-cu', color: '#2e86de', closed: false, points: [{ x: 100, y: 400 }, { x: 220, y: 400 }, { x: 340, y: 421 }] });
    // a chained device run with a drop at its end: one 90 from the drop
    ann.quickLines.push({ x1: 100, y1: 500, x2: 220, y2: 500, color: '#2e86de', id: 'q1', lineTypeId: 'lt-cu', endDrop: 3, endDropUnit: 'ft' });
    window.App.updateUI();
  });
}

const totalsFor = (page, id) => page.evaluate((ltId) => JSON.parse(JSON.stringify(window.App.getChildCountTotals().byGroup['null']?.lineType?.[ltId] || [])), id);

test.describe('Fittings from bends', () => {
  test('a run counts its own 45s and 90s and its drops; the rows ride the Summary and the exports', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await setupProject(page);

    expect(await totalsFor(page, 'lt-cu')).toEqual([
      { name: '2in Cu 45° elbow', qty: 1, per: 'bend', bendClass: 'bend45', derived: true, total: 2, excludedPxRuns: 0 },
      { name: '2in Cu 90° elbow', qty: 1, per: 'bend', bendClass: 'bend90', derived: true, total: 1, excludedPxRuns: 0 },
      { name: '2in Cu 90° elbow', qty: 1, per: 'drop', bendClass: 'drop', derived: true, total: 1, excludedPxRuns: 0 },
    ]);
    // the PEX type has the option off: no rows at all
    expect(await totalsFor(page, 'lt-pex')).toEqual([]);

    // Summary: indented derived rows under the type
    const childRows = await page.evaluate(() => [...document.querySelectorAll('#summaryList .summary-child-item')].map((d) => d.textContent.trim()));
    expect(childRows).toEqual(['2in Cu 45° elbow1/bend2', '2in Cu 90° elbow1/bend1', '2in Cu 90° elbow1/drop1']);

    // the PipeTooling text carries the rows under the type
    const tooling = await page.evaluate(() => window.App.getPipeToolingSummary ? window.App.getPipeToolingSummary() : (window.getPipeToolingSummary ? window.getPipeToolingSummary() : ''));
    if (tooling) {
      expect(tooling).toContain('2in Cu 45° elbow');
      expect(tooling).toContain('2in Cu 90° elbow');
    }
    // the chips drew (a canvas read: no errors is the assertion; pixels are the render-pixels spec's job)
    expect(errors).toEqual([]);
  });

  test('the details dialog: the toggle, the rows, a renamed fitting and a quantity follow into the tally', async ({ page }) => {
    await setupProject(page);
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'lt-cu')));
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    const group = page.locator('#bendFittingsGroup');
    await expect(group).toBeVisible();
    await expect(page.locator('#bendFittingsBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#bendFittingsRows .bend-fitting-row')).toHaveCount(3);
    await expect(page.locator('#bendFittingsRows .bend-fitting-row[data-class="bend45"] .bend-fitting-name')).toHaveValue('2in Cu 45° elbow');

    // rename the 90 row (DWV words) and make the drop row count two
    const name90 = page.locator('#bendFittingsRows .bend-fitting-row[data-class="bend90"] .bend-fitting-name');
    await name90.fill('2in Cu 1/4 bend');
    await name90.press('Enter');
    const qtyDrop = page.locator('#bendFittingsRows .bend-fitting-row[data-class="drop"] .bend-fitting-qty');
    await qtyDrop.fill('2');
    await qtyDrop.dispatchEvent('change');
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'lt-cu').bendFittings)).toEqual({
      enabled: true, bend45: { name: '2in Cu 45° elbow', qty: 1 }, bend90: { name: '2in Cu 1/4 bend', qty: 1 }, drop: { name: '2in Cu 90° elbow', qty: 2 },
    });
    const rows = await totalsFor(page, 'lt-cu');
    expect(rows.find((r) => r.bendClass === 'bend90').name).toBe('2in Cu 1/4 bend');
    expect(rows.find((r) => r.bendClass === 'drop').total).toBe(2);

    // off: the rows leave the dialog and the tally
    await page.locator('#bendFittingsBtn').click();
    await expect(page.locator('#bendFittingsBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#bendFittingsRows')).toBeHidden();
    expect(await totalsFor(page, 'lt-cu')).toEqual([]);
    // on again: the chosen names are kept
    await page.locator('#bendFittingsBtn').click();
    expect((await totalsFor(page, 'lt-cu')).find((r) => r.bendClass === 'bend90').name).toBe('2in Cu 1/4 bend');

    // a counter's dialog never shows the block
    await page.locator('#counterLineTypeDetailsClose').click();
    await page.evaluate(() => { window.state.counters.push({ id: 'c1', name: 'Water Closet', icon: 'M96 96h448v448H96z', color: '#47c88e' }); window.App.openCounterLineTypeDetailsModal('counter', window.state.counters.find((c) => c.id === 'c1')); });
    await expect(page.locator('#bendFittingsGroup')).toBeHidden();
  });

  test('Bid Check: informational while the option is off everywhere, a warning when some pipe types count and others do not, green when all do', async ({ page }) => {
    await setupProject(page);
    const row = () => page.evaluate(() => { const bc = window.App.getBidCheck(); return bc.auto.find((r) => r.id === 'bend-fittings') || null; });
    await page.evaluate(() => { window.state.trade = 'plumbing'; window.App.updateUI(); });
    // 2in Cu counts, 3/4in PEX does not: warn, naming both sides
    let r = await row();
    expect(r.verdict).toBe('warn');
    expect(r.detail).toContain('3/4in PEX');
    expect(r.detail).toContain('2in Cu');
    // turn PEX on too: ok
    await page.evaluate(() => { window.state.lineTypes.find((l) => l.id === 'lt-pex').bendFittings = { enabled: true }; window.App.updateUI(); });
    r = await row();
    expect(r.verdict).toBe('ok');
    // everything off: informational, not an open item
    await page.evaluate(() => { window.state.lineTypes.forEach((l) => { l.bendFittings = { enabled: false }; }); window.App.updateUI(); });
    r = await row();
    expect(r.verdict).toBe('na');
    // no supported material anywhere: no row
    await page.evaluate(() => { window.state.lineTypes.forEach((l, i) => { l.name = 'Line ' + String.fromCharCode(65 + i); }); window.App.updateUI(); });
    expect(await row()).toBeNull();
  });
});

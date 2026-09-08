// @ts-check
/**
 * Electrical, First-Class S6 — read the tags.
 *
 * A PDF with a real text layer is built in-page with the vendored pdf-lib
 * (fixture tags "A" / "B" beside two fixture symbols, and a small fixture
 * schedule), so the reader has something to read. Guards: the text layer
 * lands in app PDF-space; the cursor hint names the nearest tag and the
 * counter it maps to; a click lands on the tag's counter instead of the
 * active one; Enter creates "Type X" when no counter carries the tag; the
 * schedule tool's box proposes tag + description rows and creates counters;
 * the details modal writes the tag; a plumbing project reads nothing.
 */
const { test, expect } = require('@playwright/test');

// Build the fixture in the page (PDFLib is the app's vendored lib) and feed it
// to #pdfInput. Letter page 612 × 792 pt; pdf-lib y is bottom-up, the app's
// PDF-space is top-down: appY = 792 − y.
async function bootWithTextPdf(page, trade) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  const bytes = await page.evaluate(async () => {
    const { PDFDocument, StandardFonts } = window.PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p = doc.addPage([612, 792]);
    const t = (s, x, y, size = 12) => p.drawText(s, { x, y, size, font });
    // two fixtures with their tags beside them (the symbols are just rectangles)
    p.drawRectangle({ x: 280, y: 480, width: 24, height: 12, borderWidth: 1 });
    t('A', 310, 482);
    p.drawRectangle({ x: 400, y: 480, width: 24, height: 12, borderWidth: 1 });
    t('B', 430, 482);
    t('X', 500, 300);
    // a fixture schedule
    t('TYPE', 50, 740, 10); t('DESCRIPTION', 90, 740, 10);
    t('A', 50, 725, 10); t('2x4 LED troffer, 4000K', 90, 725, 10);
    t('B', 50, 710, 10); t('2x2 LED troffer', 90, 710, 10);
    t('EM', 50, 695, 10); t('Emergency wall pack', 90, 695, 10);
    t('NOTES: verify voltage', 50, 670, 10);
    t('OFFICE 104', 300, 200, 12);
    return Array.from(await doc.save());
  });
  await page.locator('#pdfInput').setInputFiles({ name: 'tags.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate((trade) => {
    const s = window.state;
    s.trade = trade;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    s.counters.push({ id: 'typeA', name: 'Type A', icon: 'M96 96h448v448H96z', color: '#3a6fc8' });
    s.counters.push({ id: 'typeB', name: 'B — 2x2 troffer', icon: 'M96 96h448v448H96z', color: '#47c88e' });
    s.activeCounterType = 'typeA';
    s.tool = window.App.TOOL.COUNTER;
    window.App.updateUI();
  }, trade);
  // prime the text layer and wait for it
  await page.evaluate(() => window.App.pageTextItems(0));
  await page.waitForFunction(() => window.App.pageTextItems(0).length > 0, null, { timeout: 5000 });
}

test.describe('Electrical, First-Class S6 — read the tags', () => {
  test('text layer in app space; hint, tag-aware click, Enter creates, schedule box proposes counters', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await bootWithTextPdf(page, 'electrical');
    expect(await page.evaluate(() => typeof window.App?.proposeCountersFromBox)).toBe('function');

    // the text layer, converted: "B" drawn at pdf (430, 482) reads near app (430, 792 − 482 − h)
    const bItem = await page.evaluate(() => window.App.pageTextItems(0).find((i) => i.str === 'B' && i.y > 250 && i.y < 320));
    expect(bItem).toBeTruthy();
    expect(Math.abs(bItem.x - 430)).toBeLessThan(2);
    expect(Math.abs(bItem.y + bItem.h - 310)).toBeLessThan(4);

    // hover beside the B symbol: "Plan says B → B — 2x2 troffer"
    const hint = await page.evaluate(() => { window.state.mousePos = { x: 425, y: 305 }; return window.App.tagHintText(); });
    expect(hint).toBe('Plan says B → B — 2x2 troffer');
    // the click lands on the tag's counter, not the active Type A
    await page.evaluate(() => window.App.handleCanvasClick ? window.App.handleCanvasClick(null, { x: 425, y: 305 }) : null);
    const placed = await page.evaluate(() => { const ann = window.App.getActiveAnnotations(window.state.pages[0]); return { a: (ann.counterMarkers.typeA || []).length, b: (ann.counterMarkers.typeB || []).length }; });
    expect(placed).toEqual({ a: 0, b: 1 });
    // far from any tag: the active counter places as before
    await page.evaluate(() => window.App.handleCanvasClick(null, { x: 100, y: 600 }));
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers.typeA || []).length)).toBe(1);

    // "X" has no counter: the hint offers Enter, Enter creates Type X (tagged) and activates it
    const hintX = await page.evaluate(() => { window.state.mousePos = { x: 503, y: 488 }; return window.App.tagHintText(); });
    expect(hintX).toBe('Plan says X · Enter creates Type X');
    await page.keyboard.press('Enter');
    const created = await page.evaluate(() => { const c = window.state.counters[window.state.counters.length - 1]; return { name: c.name, tag: c.tag, active: window.state.activeCounterType === c.id }; });
    expect(created).toEqual({ name: 'Type X', tag: 'X', active: true });

    // the schedule box: rows inside → proposal → counters (A and B exist; EM is new)
    await page.evaluate(() => window.App.proposeCountersFromBox({ x1: 40, y1: 40, x2: 400, y2: 110 }));
    await page.waitForSelector('#schedulePaletteModal.visible', { timeout: 3000 });
    const rows = await page.evaluate(() => Array.from(document.querySelectorAll('#schedulePaletteList .schedule-palette-row')).map((r) => ({ tag: r.querySelector('.tag').textContent, desc: r.querySelector('.desc').textContent, checked: r.querySelector('input').checked, exists: r.classList.contains('exists') })));
    expect(rows).toEqual([
      { tag: 'A', desc: '2x4 LED troffer, 4000K', checked: false, exists: true },
      { tag: 'B', desc: '2x2 LED troffer', checked: false, exists: true },
      { tag: 'EM', desc: 'Emergency wall pack', checked: true, exists: false },
    ]);
    await page.click('#schedulePaletteCreate');
    const em = await page.evaluate(() => window.state.counters.find((c) => c.tag === 'EM'));
    expect(em.name).toBe('EM — Emergency wall pack');
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.COUNTER)).toBe(true);
    // a box with no rows says so rather than opening an empty proposal
    await page.evaluate(() => window.App.proposeCountersFromBox({ x1: 0, y1: 700, x2: 50, y2: 790 }));
    expect(await page.locator('#schedulePaletteModal.visible').count()).toBe(0);

    // the details modal writes the tag
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters.find((c) => c.id === 'typeA')));
    await page.waitForSelector('#counterLineTypeDetailsModal.visible');
    expect(await page.locator('#counterLineTypeDetailsTagGroup').isVisible()).toBe(true);
    await page.fill('#counterLineTypeDetailsTag', 'a1');
    await page.press('#counterLineTypeDetailsTag', 'Enter');
    expect(await page.evaluate(() => window.state.counters.find((c) => c.id === 'typeA').tag)).toBe('A1');
    expect(errors).toEqual([]);
  });

  test('a plumbing project reads nothing: no hint, no swap, the Create-tab link hidden', async ({ page }) => {
    await bootWithTextPdf(page, 'plumbing').catch(() => {});
    // the text cache never primes for a non-electrical project with untagged counters
    const hint = await page.evaluate(() => { window.state.mousePos = { x: 425, y: 305 }; return window.App.tagHintText(); });
    expect(hint).toBe('');
    await page.evaluate(() => window.App.handleCanvasClick(null, { x: 425, y: 305 }));
    const placed = await page.evaluate(() => { const ann = window.App.getActiveAnnotations(window.state.pages[0]); return { a: (ann.counterMarkers.typeA || []).length, b: (ann.counterMarkers.typeB || []).length }; });
    expect(placed).toEqual({ a: 1, b: 0 });
    expect(await page.locator('#counterReadSchedule').isVisible()).toBe(false);
  });
});

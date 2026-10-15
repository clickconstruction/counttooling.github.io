// @ts-check
/**
 * Electrical, First-Class S6 — read the tags; AUTO-PICK (2026-10-01) — on a switch.
 *
 * A PDF with a real text layer is built in-page with the vendored pdf-lib
 * (fixture tags "A" / "B" beside two fixture symbols, and a small fixture
 * schedule), so the reader has something to read. Guards: the text layer
 * lands in app PDF-space; auto-pick is OFF by default and then the plan's
 * text never moves a click (wendi's report: it chose her counter for her),
 * the status bar only offers the switch; the A key, the header pill and the
 * Counter Settings row are one switch, saved per device; ON, a click lands on
 * the tag's counter unless the armed counter's name says the tag; Enter
 * creates a counter for a tag nobody carries; the schedule tool's box
 * proposes tag + description rows; the details modal writes the tag.
 */
const { test, expect } = require('@playwright/test');
const { collectConsoleErrors } = require('./spec-helpers.js');

// Build the fixture in the page (PDFLib is the app's vendored lib) and feed it
// to #pdfInput. Letter page 612 × 792 pt; pdf-lib y is bottom-up, the app's
// PDF-space is top-down: appY = 792 − y.
async function bootWithTextPdf(page, trade) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
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

const marks = (page) => page.evaluate(() => {
  const m = window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers;
  return Object.fromEntries(Object.keys(m).filter((k) => m[k].length).map((k) => [k, m[k].length]));
});
const hintAt = (page, pt) => page.evaluate((p) => { window.state.mousePos = p; return window.App.tagHintText(); }, pt);
const clickAt = (page, pt) => page.evaluate((p) => window.App.handleCanvasClick(null, p), pt);
const autoPick = (page) => page.evaluate(() => !!window.state.counterSettings.autoPick);
const B_SPOT = { x: 425, y: 305 };

test.describe('Read the tags · auto-pick on a switch', () => {
  test('off by default the plan never moves a click; A turns it on and the tag picks the counter; Enter and the schedule still build the palette', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootWithTextPdf(page, 'electrical');
    expect(await page.evaluate(() => typeof window.App?.proposeCountersFromBox)).toBe('function');

    // the text layer, converted: "B" drawn at pdf (430, 482) reads near app (430, 792 − 482 − h)
    const bItem = await page.evaluate(() => window.App.pageTextItems(0).find((i) => i.str === 'B' && i.y > 250 && i.y < 320));
    expect(bItem).toBeTruthy();
    expect(Math.abs(bItem.x - 430)).toBeLessThan(2);
    expect(Math.abs(bItem.y + bItem.h - 310)).toBeLessThan(4);

    // OFF (the default): the pill shows beside the armed Counter, unpressed; beside the B the
    // status bar only offers the switch, and the click is Type A's (wendi, 2026-10-01)
    expect(await autoPick(page)).toBe(false);
    await expect(page.locator('#counterAutoPickBtn')).toBeVisible();
    await expect(page.locator('#counterAutoPickBtn')).toHaveAttribute('aria-pressed', 'false');
    expect(await hintAt(page, B_SPOT)).toBe('Plan says B · A turns on auto-pick');
    await clickAt(page, B_SPOT);
    expect(await marks(page)).toEqual({ typeA: 1 });

    // A turns it on: the pill presses, the device keeps it
    await page.locator('#annCanvas').focus().catch(() => {});
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.keyboard.press('a');
    expect(await autoPick(page)).toBe(true);
    await expect(page.locator('#counterAutoPickBtn')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('counterSettings') || '{}').autoPick)).toBe(true);

    // ON: the same click lands on the tag's counter, and its sidebar row flashes
    expect(await hintAt(page, B_SPOT)).toBe('Plan says B · auto-pick → B — 2x2 troffer');
    await clickAt(page, B_SPOT);
    expect(await marks(page)).toEqual({ typeA: 1, typeB: 1 });
    await expect(page.locator('#countersList [data-counter-id="typeB"].tag-pick-flash')).toHaveCount(1);
    // far from any tag: the armed counter places as before
    await clickAt(page, { x: 100, y: 600 });
    expect(await marks(page)).toEqual({ typeA: 2, typeB: 1 });

    // "X" has no counter: Enter creates Type X (tagged, electrical's name) and arms it
    expect(await hintAt(page, { x: 503, y: 488 })).toBe('Plan says X · Enter makes it a counter');
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
    expect(em.name).toBe('EM · Emergency wall pack');
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
    errors.assertNoErrors();
  });

  test('on, a counter whose name says the tag keeps the click: 3IN B stays 3IN B beside a B (wendi, 2026-10-01)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootWithTextPdf(page, 'plumbing');
    await page.evaluate(() => { const s = window.state; s.counters.push({ id: 'b3', name: '3IN B', icon: 'M96 96h448v448H96z', color: '#d6338a' }); s.activeCounterType = 'b3'; window.App.updateUI(); });
    // off: nothing to offer, the armed counter's name already says B
    expect(await hintAt(page, B_SPOT)).toBe('');
    await page.click('#counterAutoPickBtn');
    expect(await autoPick(page)).toBe(true);
    expect(await hintAt(page, B_SPOT)).toBe('Plan says B · stays on 3IN B');
    await clickAt(page, B_SPOT);
    expect(await marks(page)).toEqual({ b3: 1 });
    // Type A armed, the B moves the click to the first counter that carries it
    await page.evaluate(() => { window.state.activeCounterType = 'typeA'; window.App.updateUI(); });
    await clickAt(page, B_SPOT);
    expect(await marks(page)).toEqual({ b3: 1, typeB: 1 });
    // on a plumbing project Enter names a new counter by its tag alone
    expect(await hintAt(page, { x: 503, y: 488 })).toBe('Plan says X · Enter makes it a counter');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => { const c = window.state.counters[window.state.counters.length - 1]; return [c.name, c.tag]; })).toEqual(['X', 'X']);
    errors.assertNoErrors();
  });

  test('two counters carry the same tag: the armed one takes the click, not the first in the list (by hand, 2026-09-24)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootWithTextPdf(page, 'electrical');
    await page.evaluate(() => window.App.setAutoPick(true, { toast: false }));
    // the standing palette's "B — 2x2 troffer" (typeB) sits first; the reader makes a second B and arms it
    await page.evaluate(() => { const s = window.state; s.counters.push({ id: 'typeB2', name: 'B — the one just made', icon: 'M96 96h448v448H96z', color: '#e85447' }); s.activeCounterType = 'typeB2'; window.App.updateUI(); });
    expect(await hintAt(page, B_SPOT)).toBe('Plan says B · stays on B — the one just made');
    await clickAt(page, B_SPOT);
    expect(await marks(page)).toEqual({ typeB2: 1 });
    // with Type A armed the tag wins, and the first B takes it as before
    await page.evaluate(() => { window.state.activeCounterType = 'typeA'; window.App.updateUI(); });
    expect(await hintAt(page, B_SPOT)).toBe('Plan says B · auto-pick → B — 2x2 troffer');
    await clickAt(page, B_SPOT);
    expect(await marks(page)).toEqual({ typeB: 1, typeB2: 1 });
    errors.assertNoErrors();
  });

  test('one switch: the pill, Counter Settings and a reload agree; a viewer never sees the pill; Move hides it', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootWithTextPdf(page, 'electrical');
    await page.evaluate(() => window.App.openCounterSettingsModal());
    await page.waitForSelector('#counterSettingsModal.visible');
    await expect(page.locator('#counterAutoPickBtnSetting')).toHaveAttribute('aria-pressed', 'false');
    await page.click('#counterAutoPickBtnSetting');
    expect(await autoPick(page)).toBe(true);
    await expect(page.locator('#counterAutoPickBtnSetting')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#counterAutoPickBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#counterSettingsClose');
    // the pill shows only with the Counter tool armed
    await page.evaluate(() => { window.state.tool = window.App.TOOL.NONE; window.App.updateUI(); });
    await expect(page.locator('#counterAutoPickBtn')).toBeHidden();
    await page.evaluate(() => { window.state.tool = window.App.TOOL.COUNTER; window.state.isViewer = true; window.App.updateUI(); });
    await expect(page.locator('#counterAutoPickBtn')).toBeHidden();
    await page.evaluate(() => { window.state.isViewer = false; window.App.updateUI(); });
    // per device: a reload keeps it
    await page.reload();
    await page.waitForFunction(() => window.App && window.App.bootSettled === true, null, { timeout: 30000 });
    expect(await autoPick(page)).toBe(true);
    errors.assertNoErrors();
  });

  test('an HVAC project offers Read a schedule on the Create tab before any counter carries a tag (by hand, 2026-09-25)', async ({ page }) => {
    await bootWithTextPdf(page, 'hvac');
    await page.click('#addCounter');
    await page.click('#counterModal .counter-tab[data-tab="create"]');
    await expect(page.locator('#counterReadSchedule')).toBeVisible();
  });

  test('a palette with no tag-like names reads nothing: no offer, no move', async ({ page }) => {
    await bootWithTextPdf(page, 'plumbing');
    await page.evaluate(() => { const s = window.state; s.counters = [{ id: 'lav', name: 'Lavatory', icon: 'M96 96h448v448H96z', color: '#3a6fc8' }]; s.activeCounterType = 'lav'; window.App.updateUI(); });
    expect(await hintAt(page, B_SPOT)).toBe('');
    await clickAt(page, B_SPOT);
    expect(await marks(page)).toEqual({ lav: 1 });
  });
});

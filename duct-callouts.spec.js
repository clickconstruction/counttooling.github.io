// @ts-check
/**
 * Tests: plan-and-spec callout reading (DUCT-PLAN.md unit D10 — the secondary
 * mode, "the PDF text layer already carries every printed callout").
 *
 * A PDF with a real text layer is built in-page with the vendored pdf-lib
 * ("24x12" and "20x12" at known coordinates, plus a date and a scale ratio as
 * decoys), so the reader has something to read. Guards:
 * - the text layer is fetched LAZILY and ONCE (getTextContent spied on the
 *   page proxy: 0 calls before the first arm, exactly 1 for the whole trace);
 * - arming Duct beside a callout pre-fills the starting size and says so
 *   ("from the plan: 24×12") — including when the text layer lands AFTER the
 *   modal opened (the deferred path);
 * - hovering a callout of a different size while tracing yields the offer
 *   ("Plan says 20×12 here — S accepts"), the same size yields nothing, a
 *   decoy yields nothing; the S popover shows the callout FIRST and accepting
 *   it records a sizeStep (→ a transition fitting at commit);
 * - precedence: with CFM devices present the plan callout outranks the
 *   ductulator suggestion on the chip line and sits above it in the popover;
 * - a PDF with no text layer shows no note, no prefill, no offer, no section.
 */
const { test, expect } = require('@playwright/test');

// Letter page 612 × 792 pt; pdf-lib y is bottom-up, the app's PDF-space is
// top-down: a 12-pt string drawn at (x, y) lands in app-space at
// x..x+w, (792 − y − 12)..(792 − y). Both callouts sit at app y ≈ 300..312.
async function bootWithPdf(page, withText) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  const bytes = await page.evaluate(async (withText) => {
    const { PDFDocument, StandardFonts } = window.PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p = doc.addPage([612, 792]);
    p.drawRectangle({ x: 80, y: 470, width: 380, height: 4, borderWidth: 0.5 });   // the "duct" the callouts label
    if (withText) {
      const t = (s, x, y, size = 12) => p.drawText(s, { x, y, size, font });
      t('24x12', 100, 480);
      t('12/25/2026', 250, 480);     // a date beside the run — must never read as a size
      t('20x12', 400, 480);
      t('1/4" = 1\'-0"', 50, 740);   // the scale ratio in the title block
      t('MECHANICAL PLAN', 300, 740);
    }
    return Array.from(await doc.save());
  }, withText);
  await page.locator('#pdfInput').setInputFiles({ name: withText ? 'callouts.pdf' : 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    // Spy on the text-layer fetch so laziness and once-ness are provable.
    const proxy = s.pages[0].pdfPage;
    const orig = proxy.getTextContent;
    proxy.__textContentCalls = 0;
    proxy.getTextContent = function (...a) { proxy.__textContentCalls++; return orig.apply(this, a); };
    window.App.updateUI();
  });
}

const textCalls = (page) => page.evaluate(() => window.state.pages[0].pdfPage.__textContentCalls);

// PDF-space → client coordinates (through the app's own toCanvas + the
// annotation canvas's rect), so real mouse events land where we say.
const clientOf = (page, pt) => page.evaluate((pt) => {
  const p = window.App.toCanvas(pt);
  const c = document.getElementById('annCanvas');
  const r = c.getBoundingClientRect();
  return { x: r.left + p.x * (r.width / c.width), y: r.top + p.y * (r.height / c.height) };
}, pt);

async function hoverPdf(page, pt) {
  const c = await clientOf(page, pt);
  await page.mouse.move(c.x, c.y);
  await page.waitForFunction((pt) => {
    const m = window.state.mousePos;
    return !!m && Math.abs(m.x - pt.x) < 2 && Math.abs(m.y - pt.y) < 2;
  }, pt);
}
async function clickPdf(page, pt) {
  const c = await clientOf(page, pt);
  await page.mouse.click(c.x, c.y);
}

const NEAR_24 = { x: 115, y: 322 };   // 10 pt under the "24x12" box
const NEAR_20 = { x: 415, y: 322 };   // 10 pt under the "20x12" box
const NEAR_DATE = { x: 280, y: 322 }; // under the date — 150 pt from 24x12, 120 from 20x12
const MID = { x: 250, y: 340 };       // a second vertex, off every callout

const offer = (page) => page.evaluate(() => window.App.getDuctCalloutOffer());
const cursorLine = (page) => page.evaluate(() => window.App.getDuctCursorLine());
const sectionIds = (page) => page.locator('#ductSizeSections .duct-popover-section').evaluateAll((els) => els.map((e) => e.getAttribute('data-section-id')));

test.describe('Duct plan-and-spec callouts (D10)', () => {
  /** @type {string[]} */
  let errors;
  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
  });

  test('lazy text layer; prefill on arm (deferred load); offer chip, S popover first, accept records the step; decoy + same-size read nothing', async ({ page }) => {
    await bootWithPdf(page, true);
    // Seed the create fields away from the callout so the prefill is visible.
    await page.evaluate(() => { document.getElementById('ductCreateW').value = '18'; document.getElementById('ductCreateH').value = '10'; });

    // Nothing has asked for the text layer yet: lazy means NOT fetched.
    await hoverPdf(page, NEAR_24);
    expect(await textCalls(page)).toBe(0);

    // Arm beside "24x12": the first fetch happens now; the modal opened before
    // it landed, so the prefill arrives through the deferred path.
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    const note = page.locator('#ductCreateCalloutNote');
    await expect(note).toBeVisible();
    await expect(note).toHaveText('from the plan: 24×12');
    await expect(page.locator('#ductCreateW')).toHaveValue('24');
    await expect(page.locator('#ductCreateH')).toHaveValue('12');
    expect(await textCalls(page)).toBe(1);
    // Editable as ever: the prefill is a starting point, not a lock.
    await page.locator('#ductCreateH').fill('14');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
    expect(await page.evaluate(() => window.state.drawingDuct.segments[0].size)).toEqual({ kind: 'rect', w: 24, h: 14 });

    // First vertex on the trunk at the 24x12 callout; the callout there
    // differs from the (edited) 24×14 → an offer; step back to 24×12 to make
    // the "same size" case honest.
    await clickPdf(page, NEAR_24);
    await hoverPdf(page, NEAR_24);
    let o = await offer(page);
    expect(o.chipText).toBe('Plan says 24×12 here — S accepts');
    await page.evaluate(() => window.App.applyDuctSizeStep({ kind: 'rect', w: 24, h: 12 }));
    // Same size as the current segment → nothing to step to.
    expect(await offer(page)).toBeNull();
    expect(await cursorLine(page)).toBeNull();

    // A second vertex, then the cursor reaches the "20x12" callout.
    await clickPdf(page, MID);
    await hoverPdf(page, NEAR_20);
    o = await offer(page);
    expect(o).not.toBeNull();
    expect(o.size).toEqual({ kind: 'rect', w: 20, h: 12 });
    expect(o.str).toBe('20x12');
    expect(o.chipText).toBe('Plan says 20×12 here — S accepts');
    const line = await cursorLine(page);
    expect(line.kind).toBe('callout');
    expect(line.text).toBe('Plan says 20×12 here — S accepts');

    // Under the date: the decoy never reads, the real callouts are out of reach.
    await hoverPdf(page, NEAR_DATE);
    expect(await offer(page)).toBeNull();
    await hoverPdf(page, NEAR_20);

    // S: the plan callout is the FIRST section; no ductulator section (no CFM).
    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    const ids = await sectionIds(page);
    expect(ids[0]).toBe('plan-callout');
    expect(ids).not.toContain('ductulator-suggestion');
    const chip = page.locator('#ductSizeSections .duct-callout-chip');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveText('20×12');
    expect(await chip.getAttribute('aria-label')).toBe('Plan says 20×12 here');
    await expect(page.locator('#ductSizeSections [data-section-id="plan-callout"] .duct-suggest-from')).toHaveText('reads "20x12" on the sheet');

    // Accepting applies through the normal step path: a new segment at the
    // last placed vertex + the recorded sizeStep. Never auto-applied before.
    expect(await page.evaluate(() => window.state.drawingDuct.segments.length)).toBe(1);
    await chip.click();
    await expect(page.locator('#ductSizePopover')).toBeHidden();
    const draft = await page.evaluate(() => ({ segments: window.state.drawingDuct.segments, sizeSteps: window.state.drawingDuct.sizeSteps }));
    expect(draft.segments).toEqual([
      { startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } },
      { startVertexIdx: 1, size: { kind: 'rect', w: 20, h: 12 } },
    ]);
    expect(draft.sizeSteps).toEqual([{ vertexIdx: 1, from: { kind: 'rect', w: 24, h: 12 }, to: { kind: 'rect', w: 20, h: 12 } }]);
    // Now that the segment IS 20×12, the same callout offers nothing.
    expect(await offer(page)).toBeNull();

    // Commit: the step becomes a transition fitting (D3); the text layer was
    // fetched exactly once for the whole trace.
    await clickPdf(page, NEAR_20);
    await page.evaluate(() => window.App.finishDuctRun());
    const committed = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return { runs: ann.ductRuns.length, steps: ann.ductRuns[0].sizeSteps.length, transitions: (ann.ductFittings || []).filter((f) => f.type === 'transition' && !f.suppressed).length };
    });
    expect(committed).toEqual({ runs: 1, steps: 1, transitions: 1 });
    expect(await textCalls(page)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('precedence: the plan callout outranks the ductulator suggestion on the chip line and in the popover', async ({ page }) => {
    await bootWithPdf(page, true);
    // A 150-CFM device through the real Create tab (the D6 idiom), placed
    // beyond the trace tip so the suggestion has air to size for.
    await page.locator('#counterBtn').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    if (await page.locator('#counterCreatePanel').isHidden()) await page.locator('#counterModal .counter-tab[data-tab="create"]').click();
    await page.locator('#counterName').fill('Diffuser 150');
    await page.locator('#counterCfm').fill('150');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    const created = await page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
    expect(created.name).toBe('Diffuser 150');
    expect(created.cfm).toBe(150);
    await clickPdf(page, { x: 300, y: 420 });

    await hoverPdf(page, MID);
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await expect(page.locator('#ductCreateCalloutNote')).toBeHidden();   // MID is off every callout
    await page.locator('#ductCreateW').fill('24');
    await page.locator('#ductCreateH').fill('12');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => !!window.state.drawingDuct);
    await clickPdf(page, NEAR_24);

    // Off the callouts: the D6 suggestion line is the one line.
    await hoverPdf(page, MID);
    let line = await cursorLine(page);
    expect(line.kind).toBe('suggestion');
    expect(line.text).toContain('150 CFM downstream');
    // On the "20x12" callout: the plan wins the line; both sections in the
    // popover, callout first (order 3 before 5).
    await hoverPdf(page, NEAR_20);
    line = await cursorLine(page);
    expect(line.kind).toBe('callout');
    expect(line.text).toBe('Plan says 20×12 here — S accepts');
    expect(await page.evaluate(() => !!window.App.getDuctDraftSuggestion())).toBe(true);
    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    const ids = await sectionIds(page);
    expect(ids.indexOf('plan-callout')).toBe(0);
    expect(ids.indexOf('ductulator-suggestion')).toBe(1);
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('a PDF with no text layer: no note, no prefill, no offer, no section — pure design-build', async ({ page }) => {
    await bootWithPdf(page, false);
    await page.evaluate(() => { document.getElementById('ductCreateW').value = '18'; document.getElementById('ductCreateH').value = '10'; });
    await hoverPdf(page, NEAR_24);
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    // The (empty) text layer is fetched once and finds nothing: fields untouched.
    await expect.poll(() => textCalls(page)).toBe(1);
    await expect(page.locator('#ductCreateCalloutNote')).toBeHidden();
    await expect(page.locator('#ductCreateW')).toHaveValue('18');
    await expect(page.locator('#ductCreateH')).toHaveValue('10');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => !!window.state.drawingDuct);
    await clickPdf(page, NEAR_24);
    await hoverPdf(page, NEAR_20);
    expect(await offer(page)).toBeNull();
    expect(await cursorLine(page)).toBeNull();
    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    expect(await sectionIds(page)).not.toContain('plan-callout');
    await page.keyboard.press('Escape');
    expect(await textCalls(page)).toBe(1);
    expect(errors).toEqual([]);
  });
});

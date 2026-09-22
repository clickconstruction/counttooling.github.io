// @ts-check
/**
 * SHEET-TITLE — a page's default label is read off its own title block.
 *
 * The intake reads each new page's text layer once (features/pdf-intake.js
 * applySheetTitles over sheet-title-model.js) and, where the title block gives up
 * a sheet number, labels the page "P-101 · Plumbing Plan" instead of
 * "bid-set.pdf, p24". Guards: the two sample sheets read their real title blocks;
 * a four-sheet set built in-page with the vendored pdf-lib reads a sheet with a
 * title, a sheet with a number only, keeps the file-name default on a sheet with
 * no title block, and reads a sheet stored sideways; the label reaches the
 * sidebar and Prepare PDF's Page Name tab; a PDF with no title block is untouched.
 * Signed out, so nothing here touches the cloud.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

function watch(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
  return errors;
}

// A small bid set, ANSI B landscape (1224 × 792 pt; pdf-lib's y runs bottom-up).
async function buildSet(page) {
  return page.evaluate(async () => {
    const { PDFDocument, StandardFonts, degrees } = window.PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const block = (p, number, title) => {
      const t = (s, x, y, size) => p.drawText(s, { x, y, size, font });
      t('PROJECT', 830, 100, 8); t('MAIN ST RESTAURANT', 890, 100, 10);
      t('SCALE', 830, 72, 8); t('1/8" = 1\'-0"', 830, 58, 10);
      if (title) t(title, 830, 38, 10);
      t('SHEET', 1090, 95, 8);
      if (number) t(number, 1090, 40, 26);
    };
    const a = doc.addPage([1224, 792]); block(a, 'M-101', 'HVAC PLAN - LEVEL 2'); a.drawText('RTU-1', { x: 400, y: 500, size: 10, font });
    const b = doc.addPage([1224, 792]); block(b, 'M-501', null);
    const c = doc.addPage([1224, 792]); c.drawText('OPEN OFFICE 105', { x: 300, y: 400, size: 12, font });   // a plan, no title block
    // stored sideways: the same block drawn on a portrait page turned a quarter, as some sets export
    const d = doc.addPage([792, 1224]);
    const r = (s, x, y, size) => d.drawText(s, { x, y, size, font, rotate: degrees(90) });
    r('SHEET', 792 - 95, 1090, 8); r('E-201', 792 - 40, 1090, 26); r('POWER PLAN', 792 - 38, 830, 10);
    return Array.from(await doc.save());
  });
}

test.describe('SHEET-TITLE — the default page label comes off the title block', () => {
  test('the sample sheets read their own title blocks, in the sidebar too', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'samples', 'sample-plan-advanced.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    expect(await page.evaluate(() => window.state.pages.map((p) => p.label))).toEqual(['P-101 · Plumbing Plan']);
    await expect(page.locator('#pagesList .sidebar-item').first()).toContainText('P-101 · Plumbing Plan');
    // the project is still named for the file; only the sheet's label is read
    expect(await page.evaluate(() => window.state.currentProjectName)).toBe('sample-plan-advanced');
    expect(errors).toEqual([]);
  });

  test('a set: title, number only, no title block, and a sheet stored sideways; Prepare PDF offers the label', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    const bytes = await buildSet(page);
    await page.locator('#pdfInput').setInputFiles({ name: 'bid-set.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
    // signed out, three sheets or more: the trim step opens over the loaded pages
    await page.waitForSelector('#preparePdfModal.visible', { timeout: 15000 });
    // (the pages live in the dialog while it is open; each tile's title is its page's label)
    expect(await page.locator('#preparePdfModal .prepare-pdf-tile-label').evaluateAll((els) => els.map((e) => e.title))).toEqual([
      'M-101 · HVAC Plan - Level 2',
      'M-501',
      'bid-set.pdf, p3',
      'E-201 · Power Plan',
    ]);
    // the Page Name tab is prefilled with the read label, and a typed name still wins
    await page.locator('#preparePdfPageTab').click();
    await expect(page.locator('#preparePdfName')).toHaveValue('M-101 · HVAC Plan - Level 2');
    await page.locator('#preparePdfName').fill('Level 2 mechanical');
    await page.locator('#preparePdfDone').click();
    await page.waitForFunction(() => !document.querySelector('#preparePdfModal.visible'), null, { timeout: 15000 });
    expect(await page.evaluate(() => window.state.pages.map((p) => p.label))).toEqual(['Level 2 mechanical', 'M-501', 'bid-set.pdf, p3', 'E-201 · Power Plan']);
    expect(errors).toEqual([]);
  });

  test('a PDF with no title block keeps its file-name labels', async ({ page }) => {
    const errors = watch(page);
    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    expect(await page.evaluate(() => window.state.pages.map((p) => p.label))).toEqual(['test-2pages.pdf, p1', 'test-2pages.pdf, p2']);
    expect(errors).toEqual([]);
  });
});

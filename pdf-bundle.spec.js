// @ts-check
/**
 * Tests: the window.App registry pilot #24 - the PDF-bundling helpers extracted
 * to features/pdf-bundle.js (their registrations re-homed from app.js). Non-cloud.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - PDF bundling helpers', () => {
  test('registry wired: the 5 bundling helpers are functions on App', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    const types = await page.evaluate(() => ({
      addReportPagesToPdf: typeof window.App?.addReportPagesToPdf,
      addNotesToPdf: typeof window.App?.addNotesToPdf,
      addHighlightsToPdf: typeof window.App?.addHighlightsToPdf,
      hasAnyHighlights: typeof window.App?.hasAnyHighlights,
      hasAnyNotes: typeof window.App?.hasAnyNotes,
    }));
    expect(types).toEqual({
      addReportPagesToPdf: 'function',
      addNotesToPdf: 'function',
      addHighlightsToPdf: 'function',
      hasAnyHighlights: 'function',
      hasAnyNotes: 'function',
    });
  });

  test('hasAnyHighlights/hasAnyNotes reflect page annotations', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Freshly loaded: no highlights/notes yet.
    expect(await page.evaluate(() => window.App.hasAnyHighlights())).toBe(false);
    expect(await page.evaluate(() => window.App.hasAnyNotes())).toBe(false);

    // Inject a highlight + a note into the first page's canvas, then re-check.
    await page.evaluate(() => {
      const c = window.App.getPageCanvases(window.state.pages[0])[0];
      c.annotations = c.annotations || {};
      c.annotations.highlights = c.annotations.highlights || [];
      c.annotations.notes = c.annotations.notes || [];
      c.annotations.highlights.push({});
      c.annotations.notes.push({});
    });
    expect(await page.evaluate(() => window.App.hasAnyHighlights())).toBe(true);
    expect(await page.evaluate(() => window.App.hasAnyNotes())).toBe(true);

    expect(errors).toEqual([]);
  });

  test('pagination: multi-page report + notes summary folded onto uniform A4 note pages', async ({ page }) => {
    test.setTimeout(90000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Seed a takeoff big enough to force a multi-page report (80 counter types
    // with markers on both pages -> two per-page tables + a summary table, each
    // 80 rows) plus 3 notes on page 1.
    await page.evaluate(() => {
      const state = window.state;
      for (let i = 0; i < 80; i++) state.counters.push({ id: 'sp_c' + i, name: 'Spec Counter ' + i, icon: '', color: '#e8c547' });
      state.pages.forEach((p) => {
        const c = window.App.getPageCanvases(p)[0];
        c.annotations = c.annotations || {};
        c.annotations.counterMarkers = c.annotations.counterMarkers || {};
        for (let i = 0; i < 80; i++) c.annotations.counterMarkers['sp_c' + i] = [{ x: 100, y: 100 }];
      });
      const first = window.App.getPageCanvases(state.pages[0])[0];
      first.annotations.notes = [
        { x: 60, y: 60, text: 'First note: check this riser', width: 150, fontSize: 14 },
        { x: 200, y: 120, text: 'Second note with a somewhat longer body of text so the bundled PDF has to wrap it across several lines below the image', width: 150, fontSize: 14 },
        { x: 300, y: 200, text: 'Third note', width: 150, fontSize: 14 },
      ];
    });

    const result = await page.evaluate(async () => {
      const { jsPDF } = window.jspdf;
      const reportDoc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
      const reportPages = await window.App.addReportPagesToPdf(reportDoc);
      const notesDoc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
      await window.App.addNotesToPdf(notesDoc, { scale: 2, exportOverrides: {} });
      const notePages = notesDoc.getNumberOfPages();
      const sizes = [];
      for (let i = 1; i <= notePages; i++) {
        const mb = notesDoc.getPageInfo(i).pageContext.mediaBox;
        sizes.push([Math.round(mb.topRightX), Math.round(mb.topRightY)]);
      }
      return { reportPages, reportDocPages: reportDoc.getNumberOfPages(), notePages, sizes };
    });

    // Multi-page report actually paginated, one image per doc page.
    expect(result.reportPages).toBeGreaterThan(1);
    expect(result.reportDocPages).toBe(result.reportPages);
    // Notes Summary folds onto the first notes page: 3 notes -> 3 pages
    // (summary + note 1, note 2, note 3); the old layout emitted 4.
    expect(result.notePages).toBe(3);
    // Uniform note pages: every page is A4 portrait (595.28 x 841.89 pt).
    for (const size of result.sizes) expect(size).toEqual([595, 842]);

    expect(errors).toEqual([]);
  });
});

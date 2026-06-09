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
});

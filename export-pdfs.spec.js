// @ts-check
/**
 * Tests: the window.App registry pilot #6 - the Export PDFs modal (the
 * specificPages* cluster) extracted to features/export-pdfs.js still wires up
 * and behaves identically. Largest single feature moved so far (9 publish-only
 * deps).
 *
 * Guards the registry failure modes (entry point never registered; the
 * #specificPages* bindings firing before the registry is populated) plus the
 * moved bulk-select + slider + cancel flows. Behavior-neutral: it deliberately
 * does NOT click Download (that triggers a real jsPDF render + file save, which
 * is covered by the manual smoke instead).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Export PDFs modal', () => {
  test('registry wired; open, bulk select, slider, cancel work with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the entry point + the 9 publish-only deps.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openSpecificPagesModal,
      getPageCanvases: typeof window.App?.getPageCanvases,
      renderAnn: typeof window.App?.renderAnnotationsToContext,
      addReport: typeof window.App?.addReportPagesToPdf,
      addHigh: typeof window.App?.addHighlightsToPdf,
      addNotes: typeof window.App?.addNotesToPdf,
      hasHigh: typeof window.App?.hasAnyHighlights,
      hasNotes: typeof window.App?.hasAnyNotes,
      sanitize: typeof window.App?.sanitizeForFilename,
      logEvent: typeof window.App?.logUserEvent,
    }));
    expect(wired).toEqual({
      open: 'function',
      getPageCanvases: 'function',
      renderAnn: 'function',
      addReport: 'function',
      addHigh: 'function',
      addNotes: 'function',
      hasHigh: 'function',
      hasNotes: 'function',
      sanitize: 'function',
      logEvent: 'function',
    });

    // 3. OPEN via the registry; one card per page renders.
    await page.evaluate(() => window.App.openSpecificPagesModal());
    await page.waitForSelector('#specificPagesModal.visible', { timeout: 5000 });
    const cardCount = await page.locator('#specificPagesGrid .specific-page-card').count();
    expect(cardCount).toBe(2);

    // 4. BULK SELECT: exclude all -> Download disabled; mark all -> enabled.
    await page.locator('#specificPagesAllExclude').click();
    expect(await page.locator('#specificPagesDownload').isDisabled()).toBe(true);
    await page.locator('#specificPagesAllMarked').click();
    expect(await page.locator('#specificPagesDownload').isDisabled()).toBe(false);

    // 5. SLIDER: set marker scale + dispatch input -> live val text updates.
    await page.evaluate(() => {
      const s = document.getElementById('specificPagesMarkerScale');
      s.value = '125';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await page.locator('#specificPagesMarkerScaleVal').textContent()).toBe('125');

    // 6. CANCEL closes the modal (no real download triggered).
    await page.locator('#specificPagesCancel').click();
    await page.waitForFunction(
      () => !document.getElementById('specificPagesModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    expect(errors).toEqual([]);
  });
});

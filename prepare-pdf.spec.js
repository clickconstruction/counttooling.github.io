// @ts-check
/**
 * Tests: the window.App registry pilot #22 - the Prepare PDF modal extracted to
 * features/prepare-pdf.js. Unlike the cloud modals this is a real, non-gated
 * end-to-end test: it uploads a 2-page PDF, opens the modal via the registry,
 * exercises page nav / rotate / delete, and commits.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Prepare PDF modal', () => {
  test('registry wired: App.openPreparePdfModal is a function', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => typeof window.App?.openPreparePdfModal)).toBe('function');
    expect(await page.evaluate(() => typeof window.closePreparePdfModal)).toBe('function');
  });

  test('opens via the registry, navigates/rotates/deletes a page, and commits', async ({ page }) => {
    const errors = [];
    // pdf.js logs a benign console error if the preview canvas gets a new
    // render() before the previous one finishes (rapid page nav in the test).
    // It is not an exception and the render recovers, so it is filtered out.
    const isBenignRenderRace = (t) => /multiple render\(\) operations/i.test(t || '');
    page.on('console', (msg) => { if (msg.type() === 'error' && !isBenignRenderRace(msg.text())) errors.push(msg.text()); });
    page.on('pageerror', (err) => { if (!isBenignRenderRace(err.message)) errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Load a 2-page PDF (the default upload renders pages directly).
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    const pagesBefore = await page.evaluate(() => window.state.pages.length);
    expect(pagesBefore).toBe(2);

    // Open the Prepare PDF modal via the registry (same args as the settings
    // "prepare/edit pages" entry that stays in app.js).
    await page.evaluate(() =>
      window.App.openPreparePdfModal(window.state.pages, window.state.pdfBuffer, window.state.currentProjectName || 'Untitled'),
    );
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 5000 });

    const label = page.locator('#preparePdfPageLabel');
    await expect(label).toContainText('of 2');

    // Next -> page 2; rotate (must not throw); back to page 1. Small settles let
    // each async pdf.js preview render finish before the next nav.
    await page.locator('#preparePdfNext').click();
    await expect(label).toContainText('2');
    await page.waitForTimeout(200);
    await page.locator('#preparePdfRotate').click();
    await page.waitForTimeout(200);
    await page.locator('#preparePdfPrev').click();
    await page.waitForTimeout(200);

    // Delete a page -> the kept count drops to 1.
    await page.locator('#preparePdfDelete').click();
    await expect(label).toContainText('of 1');

    // Commit; the modal closes.
    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 5000 });

    // The committed project reflects the trimmed page set.
    await page.waitForTimeout(300);
    const pagesAfter = await page.evaluate(() => window.state.pages.length);
    expect(pagesAfter).toBe(1);

    expect(errors).toEqual([]);
  });
});

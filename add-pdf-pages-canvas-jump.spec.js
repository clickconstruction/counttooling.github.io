// @ts-check
/**
 * Tests: Add additional PDF pages preserves annotations on correct pages.
 * Bug: When adding pages, canvases/annotations on existing pages would jump to wrong pages.
 * Fix: Include existing buffer in merge and reassign pdfPage for all pages from merged doc.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Add additional PDF pages - canvas jump fix', () => {
  test('annotations stay on correct pages when adding additional PDF pages', async ({ page }) => {
    const firstPdfPath = path.join(__dirname, 'test-2pages.pdf');
    const secondPdfPath = path.join(__dirname, 'test-page.pdf');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Upload first PDF (2 pages)
    const fileInput = page.locator('#pdfInput');
    await fileInput.setInputFiles(firstPdfPath);

    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    const pageCountBefore = await page.locator('#pagesList .sidebar-item').count();
    expect(pageCountBefore).toBe(2);

    // 2. Create a counter and add a marker on page 1 (index 0) via state
    await page.evaluate(() => {
      const state = window.state;
      if (!state?.pages?.[0]?.canvases?.[0]) return;
      const cid = 'cc_' + Date.now();
      state.counters.push({ id: cid, name: 'Test', icon: 'M320 320', color: '#e8c547' });
      const canvas = state.pages[0].canvases[0];
      if (!canvas.annotations.counterMarkers) canvas.annotations.counterMarkers = {};
      canvas.annotations.counterMarkers[cid] = [{ x: 100, y: 100, n: 1 }];
    });

    // 3. Verify marker exists on page 0
    const markerCountBefore = await page.evaluate(() => {
      const state = window.state;
      const p0 = state?.pages?.[0];
      if (!p0) return 0;
      const ann = p0.canvases?.[0]?.annotations;
      if (!ann?.counterMarkers) return 0;
      return Object.values(ann.counterMarkers).flat().length;
    });
    expect(markerCountBefore).toBe(1);

    // 4. Open Project Settings and trigger Add additional PDF pages
    await page.evaluate(() => document.getElementById('sidebarLogoGear')?.click());
    await page.waitForSelector('#settingsModal.visible', { timeout: 5000 });

    const addPagesBtn = page.locator('#settingsAddAdditionalPages');
    if (!(await addPagesBtn.isVisible())) {
      test.skip(true, 'Add additional PDF pages not visible (no PDF loaded?)');
      return;
    }

    // 5. Click Add additional PDF pages and set second PDF via file chooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      addPagesBtn.click(),
    ]);
    await fileChooser.setFiles(secondPdfPath);

    // 6. Wait for merge to complete - page count should increase
    await page.waitForTimeout(1500);
    const pageCountAfter = await page.locator('#pagesList .sidebar-item').count();
    expect(pageCountAfter).toBe(3);

    // 7. Verify marker still on page 0 (not jumped to another page)
    const markerCountPage0 = await page.evaluate(() => {
      const state = window.state;
      const p0 = state?.pages?.[0];
      if (!p0) return 0;
      const ann = p0.canvases?.[0]?.annotations;
      if (!ann?.counterMarkers) return 0;
      return Object.values(ann.counterMarkers).flat().length;
    });
    expect(markerCountPage0).toBe(1);

    // 8. Verify page 0 has valid pdfPage (not stale reference)
    const page0Valid = await page.evaluate(() => {
      const state = window.state;
      const p0 = state?.pages?.[0];
      return !!(p0?.pdfPage && typeof p0.pdfPage.getViewport === 'function');
    });
    expect(page0Valid).toBe(true);
  });
});

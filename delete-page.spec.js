// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('PDF page delete', () => {
  test('deleting a page updates sidebar and PDF view', async ({ page }) => {
    const pdfPath = path.join(__dirname, 'test-2pages.pdf');

    await page.goto('/app/');

    // Upload PDF via file input
    const fileInput = page.locator('#pdfInput');
    await fileInput.setInputFiles(pdfPath);

    // Wait for PDF to load - Pages section should show page items
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    const pageItemsBefore = await page.locator('#pagesList .sidebar-item').count();
    expect(pageItemsBefore).toBeGreaterThanOrEqual(1);

    expect(pageItemsBefore).toBeGreaterThanOrEqual(2);

    // Click the page-number badge on the first page to enter rename/delete mode
    const firstPageRow = page.locator('#pagesList .sidebar-item').first();
    await firstPageRow.locator('.page-num-badge-editable').click();

    // Rename input and delete button should appear
    const deleteBtn = page.locator('.page-delete-btn');
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
    await deleteBtn.click();

    // Confirm dialog appears
    await expect(page.locator('#deletePageConfirmModal.visible')).toBeVisible({ timeout: 2000 });
    await page.locator('#deletePageConfirm').click();

    // Sidebar should have one fewer page
    await page.waitForTimeout(300);
    const pageItemsAfter = await page.locator('#pagesList .sidebar-item').count();
    expect(pageItemsAfter).toBe(pageItemsBefore - 1);
  });
});

// MAP-PAGE-DELETE (DECOMPOSITION_MAP R11 / D18): the chosen layer is keyed by
// page INDEX. Deleting a page must shift the later pages' entries down one, or
// the sheet after it falls back to its first layer and the stale map is saved.
test.describe('PDF page delete keeps each later page\'s chosen layer (MAP-PAGE-DELETE)', () => {
  test('three pages, a second layer active on page 3: delete page 2, page 2 (was 3) keeps it', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1300, height: 900 });
    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    const bytes = await page.evaluate(async () => {
      const { PDFDocument } = window.PDFLib;
      const doc = await PDFDocument.create();
      for (let n = 0; n < 3; n++) doc.addPage([612, 792]);
      return Array.from(await doc.save());
    });
    await page.locator('#pdfInput').setInputFiles({ name: 'three-sheets.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
    // signed out, three sheets or more: the trim step opens over the loaded pages
    await page.waitForSelector('#preparePdfModal.visible', { timeout: 15000 });
    await page.locator('#preparePdfDone').click();
    await page.waitForFunction(() => !document.querySelector('#preparePdfModal.visible') && window.state.pages.length === 3, null, { timeout: 15000 });

    // Page 2 has a Waste layer chosen, page 3 a Gas layer; the estimator is on page 3.
    const page1Layer = await page.evaluate(() => {
      const s = window.state;
      s.pages.forEach((p) => window.App.ensureActiveCanvas(p));
      s.pages[1].canvases.push({ id: 'waste2', name: 'Waste 2', annotations: window.makeAnnotations() });
      s.pages[2].canvases.push({ id: 'gas3', name: 'Gas 3', annotations: window.makeAnnotations() });
      s.activeCanvasIdByPage[0] = s.pages[0].canvases[0].id;
      s.activeCanvasIdByPage[1] = 'waste2';
      s.activeCanvasIdByPage[2] = 'gas3';
      s.currentPage = 2;
      window.App.updateUI();
      return window.App.getActiveCanvas(s.pages[0]).id;
    });
    await expect(page.locator('#canvasCurrentName')).toHaveText('Gas 3');

    // Delete page 2 through the sidebar: badge, trash, confirm.
    await page.locator('#pagesList .sidebar-item').nth(1).locator('.page-num-badge-editable').click();
    await page.locator('.page-delete-btn').click();
    await expect(page.locator('#deletePageConfirmModal.visible')).toBeVisible({ timeout: 2000 });
    await page.locator('#deletePageConfirm').click();
    await expect(page.locator('#pagesList .sidebar-item')).toHaveCount(2);

    // Page 2 (was 3) is on screen, still on its Gas layer.
    const after = await page.evaluate(() => ({
      currentPage: window.state.currentPage,
      map: { ...window.state.activeCanvasIdByPage },
      active: window.App.getActiveCanvas(window.state.pages[1]).id,
      saved: window.App.buildCanvasExportData().activeCanvasIdByPage,
    }));
    expect(after.currentPage).toBe(1);
    expect(after.active).toBe('gas3');
    await expect(page.locator('#canvasCurrentName')).toHaveText('Gas 3');
    // the map is shifted, not stale, and that is what the save carries
    const shifted = { 0: page1Layer, 1: 'gas3' };   // page 1's entry stays put
    expect(after.map).toEqual(shifted);
    expect(after.saved).toEqual(shifted);

    expect(errors).toEqual([]);
  });
});

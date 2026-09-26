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

// MAP-PAGE-UNDO: the undo step of a page delete restores the page LIST. Laid
// back over the shorter list by index, the sheet after the deleted one took
// its marks, label and scale and lost its own until redo.
test.describe('Undo of a page delete puts the sheet back (MAP-PAGE-UNDO)', () => {
  test('three sheets with their own marks, labels, scales and layers: delete sheet 2, Ctrl+Z, every sheet has its own back', async ({ page }) => {
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
    await page.waitForSelector('#preparePdfModal.visible', { timeout: 15000 });
    await page.locator('#preparePdfDone').click();
    await page.waitForFunction(() => !document.querySelector('#preparePdfModal.visible') && window.state.pages.length === 3, null, { timeout: 15000 });

    // Each sheet gets its own label, scale, highlight and a second layer; the
    // second layer is the chosen one on sheets 2 and 3. The estimator is on sheet 3.
    const map = await page.evaluate(() => {
      const s = window.state;
      window.__sheets = () => s.pages.map((p, i) => ({
        label: p.label,
        pdfPage: p.pdfPage.pageNumber,
        scale: p.scale && p.scale.label,
        marks: p.canvases.map((c) => (c.annotations.highlights || []).map((h) => h.id)),
        active: window.App.getActiveCanvas(p, i).id,
      }));
      s.pages.forEach((p, i) => {
        const n = i + 1;
        window.App.ensureActiveCanvas(p);
        p.label = 'Sheet ' + n;
        p.scale = { pixelsPerUnit: 4 * n, unit: 'ft', label: 'custom ' + n };
        p.canvases[0].annotations.highlights.push({ id: 'hl' + n, x1: 50 * n, y1: 60, x2: 50 * n + 40, y2: 100, color: '#e8c547', opacity: 0.25 });
        const layer = { id: 'layer' + n, name: 'Layer ' + n, annotations: window.makeAnnotations() };
        layer.annotations.highlights.push({ id: 'hl' + n + 'b', x1: 20, y1: 20 * n, x2: 60, y2: 20 * n + 30, color: '#e8c547', opacity: 0.25 });
        p.canvases.push(layer);
      });
      s.activeCanvasIdByPage[0] = s.pages[0].canvases[0].id;
      s.activeCanvasIdByPage[1] = 'layer2';
      s.activeCanvasIdByPage[2] = 'layer3';
      s.currentPage = 2;
      window.App.updateUI();
      return { ...s.activeCanvasIdByPage };
    });
    const before = await page.evaluate(() => window.__sheets());
    expect(before.map((s) => s.label)).toEqual(['Sheet 1', 'Sheet 2', 'Sheet 3']);
    expect(before.map((s) => s.active)).toEqual([map[0], 'layer2', 'layer3']);
    await expect(page.locator('#canvasCurrentName')).toHaveText('Layer 3');

    // Delete sheet 2 through the sidebar: badge, trash, confirm.
    await page.locator('#pagesList .sidebar-item').nth(1).locator('.page-num-badge-editable').click();
    await page.locator('.page-delete-btn').click();
    await expect(page.locator('#deletePageConfirmModal.visible')).toBeVisible({ timeout: 2000 });
    await page.locator('#deletePageConfirm').click();
    await expect(page.locator('#pagesList .sidebar-item')).toHaveCount(2);

    // Ctrl+Z with the focus off any field.
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await expect(page.locator('#pagesList .sidebar-item')).toHaveCount(3);

    const after = await page.evaluate(() => ({
      sheets: window.__sheets(),
      map: { ...window.state.activeCanvasIdByPage },
      saved: window.App.buildCanvasExportData(),
      currentPage: window.state.currentPage,
    }));
    expect(after.sheets).toEqual(before);
    expect(after.map).toEqual(map);
    expect(after.saved.activeCanvasIdByPage).toEqual(map);
    expect(after.saved.pages.map((p) => p.label)).toEqual(['Sheet 1', 'Sheet 2', 'Sheet 3']);
    expect(after.currentPage).toBe(2);
    await expect(page.locator('#pagesList .sidebar-item').nth(1)).toContainText('Sheet 2');
    await expect(page.locator('#pagesList .sidebar-item').nth(2)).toContainText('Sheet 3');
    await expect(page.locator('#canvasCurrentName')).toHaveText('Layer 3');

    // Redo deletes sheet 2 again, and sheet 3 keeps its own things.
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('#pagesList .sidebar-item')).toHaveCount(2);
    const redone = await page.evaluate(() => ({ sheets: window.__sheets(), map: { ...window.state.activeCanvasIdByPage } }));
    expect(redone.sheets).toEqual([before[0], before[2]]);
    expect(redone.map).toEqual({ 0: map[0], 1: 'layer3' });

    expect(errors).toEqual([]);
  });
});

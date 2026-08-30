// @ts-check
/**
 * features/import-clear.js (feature-file split #28): the canvas JSON import
 * (#importInput + openers + the import-canvas-after-PDF prompt) and the Clear
 * Page confirm flow, extracted from app.js onto the window.App registry.
 *
 * Pins the moved surface end-to-end: the sidebar Clear Page button opens the
 * confirm modal naming the active canvas; Cancel leaves the annotations
 * intact; Confirm empties the active canvas (and only that page's canvas);
 * App.showClearPageModal is registered for the Project Settings row; and a
 * canvas JSON file chosen through #importInput replaces the palette
 * (counters/line types) via the moved change handler.
 *
 * Also pins the T2-01 visibility fix: #clearPageSidebar is hidden before a PDF
 * loads (body:not(.has-pdf) gate), visible and live via a real click at
 * desktop width once one is loaded, hidden for viewers, and reachable inside
 * the mobile hamburger drawer.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// Seed a counter marker on page 0's active canvas ("Main") — shared by the
// clear-flow tests below.
async function seedPage0Marker(page) {
  await page.evaluate(() => {
    const s = window.state;
    s.counters = [{ id: 'c1', name: 'Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
    const c0 = window.App.ensureActiveCanvas(s.pages[0]);
    c0.name = 'Main';
    c0.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }] };
    window.App.updateUI();
  });
}

test.describe('Import Canvas & Clear Page (features/import-clear.js)', () => {
  test('clear-page confirm flow and JSON import', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Seed markers on both pages.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.name = 'Main';
      c0.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }] };
      const c1 = window.App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.counterMarkers = { c1: [{ x: 60, y: 60, id: 'm2', group: null }] };
      window.App.updateUI();
    });

    expect(await page.evaluate(() => typeof window.App.showClearPageModal)).toBe('function');

    // Open via the sidebar button; the message names the active canvas.
    await page.evaluate(() => document.getElementById('clearPage').click());
    await page.waitForSelector('#clearPageConfirmModal.visible', { timeout: 5000 });
    await expect(page.locator('#clearPageConfirmMessage')).toContainText('Main');

    // Cancel leaves the markers alone.
    await page.evaluate(() => document.getElementById('clearPageCancel').click());
    await expect(page.locator('#clearPageConfirmModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers?.c1 || []).length)).toBe(1);

    // Confirm clears page 0's active canvas only.
    await page.evaluate(() => document.getElementById('clearPage').click());
    await page.waitForSelector('#clearPageConfirmModal.visible');
    await page.evaluate(() => document.getElementById('clearPageConfirm').click());
    const afterClear = await page.evaluate(() => ({
      p0: (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers?.c1 || []).length,
      p1: (window.App.getActiveAnnotations(window.state.pages[1]).counterMarkers?.c1 || []).length,
    }));
    expect(afterClear.p0).toBe(0);
    expect(afterClear.p1).toBe(1);

    // JSON import through the moved #importInput handler replaces the palette.
    const payload = JSON.stringify({
      counters: [{ id: 'c9', name: 'Imported Counter', icon: 'M0 0h24v24H0z', color: '#4a9eff' }],
      lineTypes: [{ id: 'lt9', name: 'Imported Line', color: '#e8c547' }],
      groups: [],
      pages: [],
    });
    await page.locator('#importInput').setInputFiles({ name: 'canvas.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
    await page.waitForFunction(() => window.state.counters.some((c) => c.id === 'c9'));
    const imported = await page.evaluate(() => ({
      names: window.state.counters.map((c) => c.name),
      lineType: window.state.lineTypes[0]?.name,
      // reconcileOrphanedCountersAndLineTypes must re-create a counter for
      // page 1's still-present markers whose palette entry the import dropped.
      orphanRecreated: window.state.counters.some((c) => c.id === 'c1'),
    }));
    expect(imported.names).toContain('Imported Counter');
    expect(imported.lineType).toBe('Imported Line');
    expect(imported.orphanRecreated).toBe(true);

    expect(errors).toEqual([]);
  });

  test('bad import file toasts in-app with the Export Canvas pointer (Tier-3 B2 / J12)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    // The deliberate console.error('[Import Canvas]', ...) diagnostic is
    // allowed; anything else is a regression.
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/\[Import Canvas\]/.test(m.text())) consoleErrors.push(m.text());
    });
    // A native alert would mean the old dialog is back — fail loudly if any
    // dialog fires.
    page.on('dialog', async (d) => { pageErrors.push('unexpected dialog: ' + d.message()); await d.dismiss(); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.locator('#importInput').setInputFiles({
      name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('this is not json {'),
    });
    await expect(page.locator('#airboardToastText'))
      .toHaveText('That file isn’t a canvas export — Import Canvas reads the .json file that Export Canvas creates.');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('page-count mismatch import toasts "Applied marks to 1 of 2 pages…" (Tier-3 B2 / J10)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    // 1-page plan + a 2-page export: the second entry has no page to land on.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const exportJson = JSON.stringify({
      counters: [{ id: 'c1', name: 'Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }],
      lineTypes: [],
      groups: [],
      pages: [
        { index: 0, label: 'Sheet 1', canvases: [{ id: 'cvA', name: 'Main', annotations: { counterMarkers: { c1: [{ x: 40, y: 40, id: 'mA' }] } } }], scale: null, rotation: 0 },
        { index: 1, label: 'Sheet 2', canvases: [{ id: 'cvB', name: 'Main', annotations: { counterMarkers: { c1: [{ x: 60, y: 60, id: 'mB' }] } } }], scale: null, rotation: 0 },
      ],
    });
    await page.locator('#importInput').setInputFiles({ name: 'two-pages.json', mimeType: 'application/json', buffer: Buffer.from(exportJson) });
    await expect(page.locator('#airboardToastText'))
      .toHaveText('Applied marks to 1 of 2 pages — the plan has fewer pages than the export.');
    // Page 0's marks did land; the palette import ran.
    const after = await page.evaluate(() => ({
      p0: (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers?.c1 || []).length,
      counters: window.state.counters.map((c) => c.id),
    }));
    expect(after.p0).toBe(1);
    expect(after.counters).toContain('c1');
    expect(errors).toEqual([]);
  });

  test('matching page-count import stays quiet (no mismatch toast)', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const exportJson = JSON.stringify({
      counters: [{ id: 'c1', name: 'Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }],
      lineTypes: [],
      groups: [],
      pages: [
        { index: 0, label: 'Sheet 1', canvases: [{ id: 'cvA', name: 'Main', annotations: { counterMarkers: { c1: [{ x: 40, y: 40, id: 'mA' }] } } }], scale: null, rotation: 0 },
      ],
    });
    await page.locator('#importInput').setInputFiles({ name: 'one-page.json', mimeType: 'application/json', buffer: Buffer.from(exportJson) });
    await page.waitForFunction(() => window.state.counters.some((c) => c.id === 'c1'));
    const toast = await page.evaluate(() => ({
      visible: document.getElementById('airboardToastModal').classList.contains('visible'),
      text: document.getElementById('airboardToastText').textContent,
    }));
    expect(toast.text).not.toContain('Applied marks to');
    expect(toast.visible).toBe(false);
  });

  test('sidebar Clear Page is visible and live at desktop width', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Before any PDF loads, the body:not(.has-pdf) gate hides the section.
    await expect(page.locator('#clearPageSidebar')).toBeHidden();

    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // With a PDF loaded the button is visible — no sign-in, no Project Settings.
    await expect(page.locator('#clearPageSidebar')).toBeVisible();

    await seedPage0Marker(page);

    // A REAL click (not evaluate) opens the confirm; Confirm empties the canvas.
    await page.locator('#clearPageSidebar').click();
    await page.waitForSelector('#clearPageConfirmModal.visible', { timeout: 5000 });
    await expect(page.locator('#clearPageConfirmMessage')).toContainText('Main');
    await page.locator('#clearPageConfirm').click();
    await expect(page.locator('#clearPageConfirmModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers?.c1 || []).length)).toBe(0);

    // Viewer sessions hide the button (app.js viewerHideIds inline-hide);
    // returning to a non-viewer session resets it to visible.
    await page.evaluate(() => { window.state.isViewer = true; window.App.updateUI(); });
    await expect(page.locator('#clearPageSidebar')).toBeHidden();
    await page.evaluate(() => { window.state.isViewer = false; window.App.updateUI(); });
    await expect(page.locator('#clearPageSidebar')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('sidebar Clear Page is reachable inside the mobile hamburger drawer', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await seedPage0Marker(page);

    // Open the left slide-in drawer; the Clear Page section renders inside it
    // and a real click on the button opens the confirm modal.
    await page.locator('#hamburger').click();
    await expect(page.locator('body')).toHaveClass(/sidebar-open/);
    await expect(page.locator('#clearPageSidebar')).toBeVisible();
    await page.locator('#clearPageSidebar').click();
    await page.waitForSelector('#clearPageConfirmModal.visible', { timeout: 5000 });
    await expect(page.locator('#clearPageConfirmMessage')).toContainText('Main');
    await page.locator('#clearPageCancel').click();
    await expect(page.locator('#clearPageConfirmModal')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });

  test('Import Canvas menu row greys out with the explainer instead of vanishing (Tier-3 B12 / J12)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const row = page.locator('.export-dropdown-option[data-action="import-canvas"]');
    const note = page.locator('#importCanvasBlockedNote');

    // Count row activations without opening a native file chooser.
    await page.evaluate(() => {
      window.__importClicks = 0;
      document.getElementById('importInput').click = () => { window.__importClicks++; };
    });

    // Empty canvas: row visible + enabled, no explainer; a real click fires it.
    await page.locator('#exportDropdownBtn').click();
    await expect(row).toBeVisible();
    await expect(row).toBeEnabled();
    await expect(note).toHaveText('');
    await row.click();
    expect(await page.evaluate(() => window.__importClicks)).toBe(1);
    await expect(page.locator('#exportDropdownMenu')).not.toHaveClass(/visible/);

    // Marks on the canvas: still visible, but disabled with the unblock path.
    await seedPage0Marker(page);
    await page.locator('#exportDropdownBtn').click();
    await expect(row).toBeVisible();
    await expect(row).toBeDisabled();
    await expect(note).toHaveText('(canvas has marks — clear or undo first)');

    // A click on the disabled row does nothing (no import, menu stays open).
    await row.click({ force: true });
    expect(await page.evaluate(() => window.__importClicks)).toBe(1);
    await expect(page.locator('#exportDropdownMenu')).toHaveClass(/visible/);
    await page.locator('#exportDropdownBtn').click(); // close the menu

    // Clear Page re-enables the row...
    await page.locator('#clearPageSidebar').click();
    await page.waitForSelector('#clearPageConfirmModal.visible', { timeout: 5000 });
    await page.locator('#clearPageConfirm').click();
    await expect(row).toBeEnabled();
    await expect(note).toHaveText('');

    // ...and undoing the clear (marks return) disables it again.
    await page.keyboard.press('Control+z');
    await expect(row).toBeDisabled();
    await expect(note).toHaveText('(canvas has marks — clear or undo first)');

    // Viewer behavior unchanged (B6): viewers never see the row at all.
    await page.evaluate(() => { window.state.isViewer = true; window.App.updateUI(); });
    expect(await page.evaluate(() => document.querySelector('.export-dropdown-option[data-action="import-canvas"]').style.display)).toBe('none');
    await page.evaluate(() => { window.state.isViewer = false; window.App.updateUI(); });
    expect(await page.evaluate(() => document.querySelector('.export-dropdown-option[data-action="import-canvas"]').style.display)).toBe('');

    expect(errors).toEqual([]);
  });

  test('burger drawer mirrors the disabled Import Canvas row on mobile (Tier-3 B12 / J12)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await seedPage0Marker(page);

    await page.locator('#headerBurger').click();
    const drawerRow = page.locator('.right-menu-item', { hasText: 'Import Canvas' });
    await expect(drawerRow).toBeVisible();
    await expect(drawerRow).toBeDisabled();
    await expect(drawerRow).toContainText('(canvas has marks — clear or undo first)');

    expect(errors).toEqual([]);
  });
});

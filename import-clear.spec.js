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
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

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
});

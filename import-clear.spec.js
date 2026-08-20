// @ts-check
/**
 * features/import-clear.js (feature-file split #28): the canvas JSON import
 * (#importInput + openers + the import-canvas-after-PDF prompt) and the Clear
 * Page confirm flow, extracted from app.js onto the window.App registry.
 *
 * Pins the moved surface end-to-end: the sidebar Clear Page button opens the
 * confirm modal (exact wording pinned — no layer qualifier on a single-layer
 * page; on a multi-layer page it names the active layer, default or renamed,
 * and scopes the wipe to it); Cancel leaves the annotations intact; Confirm
 * empties ONLY the active layer (sibling layer and other pages keep their
 * marks) and Undo restores it;
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

    // Open via the sidebar button. Page 0 has a single layer, so the message
    // needs no layer qualifier — clearing the only layer IS clearing the page.
    await page.evaluate(() => document.getElementById('clearPage').click());
    await page.waitForSelector('#clearPageConfirmModal.visible', { timeout: 5000 });
    await expect(page.locator('#clearPageConfirmMessage')).toHaveText(
      'Remove all marks from this page? You can undo this.');

    // Cancel leaves the markers alone.
    await page.evaluate(() => document.getElementById('clearPageCancel').click());
    await expect(page.locator('#clearPageConfirmModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers?.c1 || []).length)).toBe(1);

    // Add a second layer to page 0 with the default "Layer N" name and make it
    // active with its own marker. The multi-layer message must name the layer
    // and scope the wipe to it — without the awkward '"Layer 2" layer' doubling.
    await page.evaluate(() => {
      const s = window.state;
      const layer2 = { id: 'canvas-l2', name: 'Layer 2', annotations: window.App.makeAnnotations() };
      layer2.annotations.counterMarkers = { c1: [{ x: 70, y: 70, id: 'm3', group: null }] };
      s.pages[0].canvases.push(layer2);
      s.activeCanvasIdByPage[0] = 'canvas-l2';
      window.App.updateUI();
    });
    await page.evaluate(() => document.getElementById('clearPage').click());
    await page.waitForSelector('#clearPageConfirmModal.visible');
    await expect(page.locator('#clearPageConfirmMessage')).toHaveText(
      'Remove all marks from "Layer 2"? Other layers on this page keep their marks. You can undo this.');
    await page.evaluate(() => document.getElementById('clearPageCancel').click());

    // Renamed (free-text) layer: the message carries the user's name verbatim.
    await page.evaluate(() => {
      window.state.pages[0].canvases[1].name = 'Electrical';
    });
    await page.evaluate(() => document.getElementById('clearPage').click());
    await page.waitForSelector('#clearPageConfirmModal.visible');
    await expect(page.locator('#clearPageConfirmMessage')).toHaveText(
      'Remove all marks from "Electrical"? Other layers on this page keep their marks. You can undo this.');

    // Confirm clears ONLY page 0's active layer: its sibling "Main" layer and
    // page 1 both keep their marks (the layer qualifier is load-bearing).
    await page.evaluate(() => document.getElementById('clearPageConfirm').click());
    const afterClear = await page.evaluate(() => ({
      active: (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers?.c1 || []).length,
      sibling: (window.state.pages[0].canvases[0].annotations.counterMarkers?.c1 || []).length,
      p1: (window.App.getActiveAnnotations(window.state.pages[1]).counterMarkers?.c1 || []).length,
    }));
    expect(afterClear.active).toBe(0);
    expect(afterClear.sibling).toBe(1);
    expect(afterClear.p1).toBe(1);

    // "You can undo this." is a real promise: the handler pushes an undo
    // snapshot before wiping, so Undo restores the cleared layer.
    await page.evaluate(() => document.getElementById('undoBtn').click());
    expect(await page.evaluate(() => (window.state.pages[0].canvases[1].annotations.counterMarkers?.c1 || []).length)).toBe(1);

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

  // --- T3-B2: honest import feedback (narrowed catch + partial-import toast) ---
  // The old catch wrapped the whole apply, so a garbage file alerted "Invalid
  // import file", a valid-JSON-wrong-shape file silently WIPED the palette,
  // and a valid export tripping a downstream bug was mislabeled invalid.

  /** Boot with test-page.pdf loaded and a seeded counter palette. */
  async function bootWithPalette(page, dialogs) {
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 15000 });
    await page.evaluate(() => {
      window.state.counters = [{ id: 'keep1', name: 'Existing', icon: 'M0 0h10v10H0z', color: '#e8c547' }];
    });
  }

  test('garbage (non-JSON) file: toast, no alert, palette untouched', async ({ page }) => {
    const dialogs = [];
    await bootWithPalette(page, dialogs);
    await page.locator('#importInput').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{{{not json') });
    await expect(page.locator('#airboardToastText')).toHaveText("This file isn't a canvas export — use Export Canvas to make one.");
    expect(dialogs).toEqual([]);
    expect(await page.evaluate(() => window.state.counters[0]?.id)).toBe('keep1');
  });

  test('valid JSON that is not a canvas export: refused BEFORE wiping the palette', async ({ page }) => {
    const dialogs = [];
    await bootWithPalette(page, dialogs);
    await page.locator('#importInput').setInputFiles({ name: 'wrong.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"world"}') });
    await expect(page.locator('#airboardToastText')).toHaveText("This file isn't a canvas export — use Export Canvas to make one.");
    expect(dialogs).toEqual([]);
    // Pre-fix this silently emptied state.counters.
    expect(await page.evaluate(() => window.state.counters.length)).toBe(1);
  });

  test('valid export hitting a downstream bug: honest "Couldn\'t apply" toast, not "invalid"', async ({ page }) => {
    const dialogs = [];
    await bootWithPalette(page, dialogs);
    await page.evaluate(() => {
      window.App.reconcileOrphanedCountersAndLineTypes = () => { throw new Error('simulated downstream bug'); };
    });
    const payload = JSON.stringify({ counters: [{ id: 'c9', name: 'X', icon: 'M0 0h1v1H0z', color: '#fff' }], lineTypes: [], groups: [], pages: [] });
    await page.locator('#importInput').setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
    await expect(page.locator('#airboardToastText')).toHaveText("Couldn't apply this canvas file.");
    expect(dialogs).toEqual([]);
  });

  test('partial import: 2-page export onto a 1-page PDF toasts "Applied marks to 1 of 2 pages"', async ({ page }) => {
    const dialogs = [];
    await bootWithPalette(page, dialogs);
    const payload = JSON.stringify({
      counters: [{ id: 'c9', name: 'X', icon: 'M0 0h1v1H0z', color: '#fff' }],
      lineTypes: [], groups: [],
      pages: [
        { index: 0, label: 'p1', canvases: [{ id: 'cv1', name: 'Main', annotations: { counterMarkers: { c9: [{ x: 5, y: 5, id: 'm1' }] } } }] },
        { index: 1, label: 'p2', canvases: [{ id: 'cv2', name: 'Main', annotations: { counterMarkers: { c9: [{ x: 6, y: 6, id: 'm2' }] } } }] },
      ],
    });
    await page.locator('#importInput').setInputFiles({ name: 'two.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
    await expect(page.locator('#airboardToastText')).toHaveText('Applied marks to 1 of 2 pages — the export covers more pages than this PDF.');
    expect(dialogs).toEqual([]);
    // Page 0's marks did land.
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers.c9 || []).length)).toBe(1);
  });

  test('full-coverage import stays quiet (no partial toast)', async ({ page }) => {
    const dialogs = [];
    await bootWithPalette(page, dialogs);
    const payload = JSON.stringify({
      counters: [{ id: 'c9', name: 'X', icon: 'M0 0h1v1H0z', color: '#fff' }],
      lineTypes: [], groups: [],
      pages: [{ index: 0, label: 'p1', canvases: [{ id: 'cv1', name: 'Main', annotations: { counterMarkers: { c9: [{ x: 5, y: 5, id: 'm1' }] } } }] }],
    });
    await page.locator('#importInput').setInputFiles({ name: 'one.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
    await page.waitForFunction(() => window.state.counters.some((c) => c.id === 'c9'));
    const toast = await page.evaluate(() => ({
      visible: document.getElementById('airboardToastModal').classList.contains('visible'),
      text: document.getElementById('airboardToastText').textContent,
    }));
    expect(toast.text).not.toContain('Applied marks to');
    expect(dialogs).toEqual([]);
  });
});

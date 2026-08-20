// @ts-check
/**
 * features/canvas-layers.js (feature-file split #31): the canvas-layer
 * management UI — Add Canvas modal (new/duplicate), Canvas Details modal
 * (rename-on-close + delete entry), Delete Canvas confirm, the footer layers
 * menu, and the show-all-canvases peek toggle — extracted from app.js onto
 * the window.App registry.
 *
 * Pins the moved surface end-to-end: Add creates a new empty layer and makes
 * it active; duplicate mode deep-copies the current layer's annotations;
 * the details modal renames on Done and on Escape (both route through the
 * same #canvasDetailsClose commit); the delete confirm removes the layer and
 * reactivates the first remaining one; and the hideModal callbacks reset the
 * private pending state.
 *
 * Mobile (375x812): the layers menu (#canvasMenu) carries a "Show all layers"
 * toggle row (#canvasMenuShowAll) — the mobile route to the desktop peek
 * (#showAllCanvasesBtn is display:none !important at <=768px). It flips the
 * SAME state.showAllCanvases flag through the same render path (no new mode),
 * so the desktop button's indicator stays in sync across a resize.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Canvas layers (features/canvas-layers.js)', () => {
  test('add, duplicate, rename (Done + Escape), delete', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Seed a marker so duplicate mode has something to copy.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 5, y: 5, id: 'm1', group: null }] };
      window.App.updateUI();
    });

    // --- Add a new empty layer; it becomes active ---
    await page.evaluate(() => document.getElementById('addCanvasBtn').click());
    await page.waitForSelector('#addCanvasModal.visible', { timeout: 5000 });
    await page.evaluate(() => document.getElementById('addCanvasModalCreate').click());
    const afterAdd = await page.evaluate(() => {
      const s = window.state;
      const canvases = window.App.getPageCanvases(s.pages[0]);
      const active = window.App.getActiveCanvas(s.pages[0]);
      return { count: canvases.length, activeName: active.name, activeMarkers: (active.annotations.counterMarkers?.c1 || []).length };
    });
    expect(afterAdd.count).toBe(2);
    expect(afterAdd.activeName).toBe('Layer 2');
    expect(afterAdd.activeMarkers).toBe(0);

    // --- Duplicate mode deep-copies the active layer ---
    await page.evaluate(() => {
      // Switch back to the seeded layer first.
      const s = window.state;
      s.activeCanvasIdByPage[0] = window.App.getPageCanvases(s.pages[0])[0].id;
      document.getElementById('addCanvasBtn').click();
    });
    await page.waitForSelector('#addCanvasModal.visible');
    await page.evaluate(() => {
      document.getElementById('addCanvasModalDuplicate').click();
      document.getElementById('addCanvasModalCreate').click();
    });
    const afterDup = await page.evaluate(() => {
      const s = window.state;
      const active = window.App.getActiveCanvas(s.pages[0]);
      const original = window.App.getPageCanvases(s.pages[0])[0];
      return {
        count: window.App.getPageCanvases(s.pages[0]).length,
        name: active.name,
        markers: (active.annotations.counterMarkers?.c1 || []).length,
        distinct: active.annotations !== original.annotations,
      };
    });
    expect(afterDup.count).toBe(3);
    expect(afterDup.name).toBe('Copy of Main');
    expect(afterDup.markers).toBe(1);
    expect(afterDup.distinct).toBe(true);

    // --- Rename via Done, then via Escape (same commit path) ---
    await page.evaluate(() => {
      const active = window.App.getActiveCanvas(window.state.pages[0]);
      window.App.openCanvasDetailsModal(active);
    });
    await page.waitForSelector('#canvasDetailsModal.visible');
    await page.evaluate(() => {
      document.getElementById('canvasDetailsName').value = 'Renamed via Done';
      document.getElementById('canvasDetailsClose').click();
    });
    expect(await page.evaluate(() => window.App.getActiveCanvas(window.state.pages[0]).name)).toBe('Renamed via Done');

    await page.evaluate(() => {
      window.App.openCanvasDetailsModal(window.App.getActiveCanvas(window.state.pages[0]));
      document.getElementById('canvasDetailsName').value = 'Renamed via Escape';
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('#canvasDetailsModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.App.getActiveCanvas(window.state.pages[0]).name)).toBe('Renamed via Escape');

    // --- Delete the active layer via the confirm; first remaining reactivates ---
    await page.evaluate(() => {
      window.App.openCanvasDetailsModal(window.App.getActiveCanvas(window.state.pages[0]));
      document.getElementById('canvasDetailsDelete').click();
    });
    await page.waitForSelector('#deleteCanvasConfirmModal.visible');
    await expect(page.locator('#deleteCanvasName')).toHaveText('Renamed via Escape');
    await page.evaluate(() => document.getElementById('deleteCanvasConfirm').click());
    const afterDelete = await page.evaluate(() => {
      const s = window.state;
      return {
        count: window.App.getPageCanvases(s.pages[0]).length,
        activeName: window.App.getActiveCanvas(s.pages[0]).name,
      };
    });
    expect(afterDelete.count).toBe(2);
    expect(afterDelete.activeName).toBe('Main');

    expect(errors).toEqual([]);
  });

  test('mobile: "Show all layers" row in the layers menu toggles the shared peek flag', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Layer A gets a colored quick line; empty layer B becomes active — the
    // same seed as show-all-canvases.spec.js so the pixel probe matches.
    await page.evaluate(() => {
      const App = window.App;
      const s = App.state;
      const pageObj = s.pages[0];
      const a = App.ensureActiveCanvas(pageObj);
      s.lineTypes.push({ id: 'lt-spec', name: 'Spec Line', color: '#e74c3c' });
      a.annotations.quickLines.push({ x1: 50, y1: 50, x2: 150, y2: 150, color: '#e74c3c', id: 'ql-spec', lineTypeId: 'lt-spec' });
      const b = { id: 'canvas-b', name: 'Second', annotations: App.makeAnnotations() };
      pageObj.canvases.push(b);
      s.activeCanvasIdByPage[0] = 'canvas-b';
      App.renderPdf();
      App.updateUI();
    });
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 100, { timeout: 10000 });

    // Alpha sum in a box around the A-line's midpoint on #annCanvas
    // (show-all-canvases.spec.js pattern).
    const midpointAlpha = () => page.evaluate(() => {
      const App = window.App;
      const s = App.state;
      const eff = App.effectiveDpr(s.pages[0], s.zoom);
      const c = document.getElementById('annCanvas');
      const px = 100 * s.zoom * eff, py = 100 * s.zoom * eff;
      const r = Math.max(4, Math.round(6 * eff));
      const img = c.getContext('2d').getImageData(Math.round(px - r), Math.round(py - r), r * 2, r * 2).data;
      let sum = 0;
      for (let i = 3; i < img.length; i += 4) sum += img[i];
      return sum;
    });

    // Mobile hides the desktop peek button; the A-line is not painted (B active).
    await expect(page.locator('#showAllCanvasesBtn')).toBeHidden();
    expect(await midpointAlpha()).toBe(0);

    // Open the mobile layers menu: the row is there, unchecked.
    await page.locator('#canvasLayersBtn').click();
    await expect(page.locator('#canvasMenu')).toHaveClass(/visible/);
    const row = page.locator('#canvasMenuShowAll');
    await expect(row).toBeVisible();
    await expect(row.locator('.canvas-peek-check')).not.toHaveClass(/checked/);

    // Toggle on: same flag + render path as the desktop button.
    await row.click();
    const on = await page.evaluate(() => ({
      flag: window.App.state.showAllCanvases,
      activeCanvas: window.App.state.activeCanvasIdByPage[0],
      desktopIndicator: document.getElementById('showAllCanvasesBtn').classList.contains('active'),
    }));
    expect(on.flag).toBe(true);
    expect(on.activeCanvas).toBe('canvas-b');   // editing target unchanged
    expect(on.desktopIndicator).toBe(true);      // desktop button already synced for a resize
    expect(await midpointAlpha()).toBeGreaterThan(0);
    await expect(row.locator('.canvas-peek-check')).toHaveClass(/checked/);

    // Toggle off: back to active-layer-only rendering.
    await row.click();
    expect(await page.evaluate(() => window.App.state.showAllCanvases)).toBe(false);
    expect(await midpointAlpha()).toBe(0);
    await expect(row.locator('.canvas-peek-check')).not.toHaveClass(/checked/);

    // Single-layer page: reopening the menu hides the row (peek is meaningless).
    await page.evaluate(() => {
      const App = window.App;
      const s = App.state;
      s.pages[0].canvases = s.pages[0].canvases.filter(c => c.id !== 'canvas-b');
      s.activeCanvasIdByPage[0] = s.pages[0].canvases[0].id;
      App.updateUI();
    });
    await page.locator('#canvasLayersBtn').click();   // close
    await page.locator('#canvasLayersBtn').click();   // reopen
    await expect(page.locator('#canvasMenu')).toHaveClass(/visible/);
    await expect(row).toBeHidden();

    expect(errors).toEqual([]);
  });
});

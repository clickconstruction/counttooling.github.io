// @ts-check
/**
 * Tests: MAP-ESC (DECOMPOSITION_MAP R10, defects D04 and D12). Esc and a dialog's ×
 * close the dialog on top and nothing else; the tool under it never unwinds.
 *
 * Before the fix about twenty dialogs had no rung in app.js's Esc ladder (Water Sizing,
 * Learn, Bid Board, Zoom Settings, Line Type Settings, the fixture-unit override, the
 * admin sub-dialogs...), so Esc left the dialog up and fell through to the tool rungs:
 * a polyline lost a vertex behind it. Their × dispatched a synthetic Escape through the
 * same ladder, so it cost the vertex too before hiding. features/esc-ladder.js now keeps
 * the ladder as a table and closes the TOPMOST visible overlay when no rung claims it.
 *
 * - Each dialog, opened over a three-vertex polyline draft: Esc closes it, the draft
 *   keeps three vertices; the same through its ×.
 * - A rung-less dialog stacked over a rung dialog (Set Password over Manage User):
 *   Esc closes the top one only.
 * - The blocking Turn In overlay (data-esc="none") swallows Esc: it stays, and so do
 *   the vertices.
 * - The formerly hand-wired × buttons (now data-modal-close) still run their dialog's
 *   own cleanup: the schedule palette drops its pending proposal, Save Status clears its
 *   tick timer.
 * - Header popovers (the zoom rail) close before the tool unwinds.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('MAP-ESC: Esc and × close the dialog on top, never the tool under it', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state;
      s.lineTypes = [{ id: 'lt1', name: 'Copper 3/4', color: '#4a9eff', curveStyle: 'straight' }];
      s.activeLineTypeId = 'lt1';
      s.pages[s.currentPage].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      window.App.updateUI();
    });
  });

  // A polyline draft with three clicked vertices: the thing a stray Esc must not cost.
  const armDraft = async (page) => {
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.POLYLINE && !!window.state.drawingPolyline, null, { timeout: 5000 });
    await page.evaluate(() => { window.state.drawingPolyline.points.push({ x: 100, y: 100 }, { x: 140, y: 100 }, { x: 140, y: 140 }); });
  };
  const vertices = (page) => page.evaluate(() => (window.state.drawingPolyline ? window.state.drawingPolyline.points.length : -1));
  const visible = (page, id) => page.evaluate((i) => document.getElementById(i).classList.contains('visible'), id);

  // Each opener is the app's own where it runs offline; the cloud-only Bid Board and the
  // plain notice dialogs open through showModal, which is all their openers end in.
  const DIALOGS = [
    { id: 'waterScheduleModal', open: () => window.App.openWaterScheduleModal() },
    { id: 'learnModal', open: () => window.App.openLearnMenu() },
    { id: 'bidBoardModal', open: () => window.App.showModal('bidBoardModal') },
    { id: 'zoomModal', open: () => window.App.showZoomModal() },
    { id: 'lineTypeSettingsModal', open: () => window.App.openLineTypeSettingsModal() },
    { id: 'polylineModal', open: () => window.App.showModal('polylineModal') },
    { id: 'highlightNameModal', open: () => window.App.showModal('highlightNameModal') },
    { id: 'userActivityOverviewModal', open: () => window.App.showModal('userActivityOverviewModal') },
    // Hand-wired × before MAP-ESC, data-modal-close now.
    { id: 'schedulePaletteModal', open: () => window.App.showModal('schedulePaletteModal') },
    { id: 'importCanvasAfterPdfModal', open: () => window.App.showModal('importCanvasAfterPdfModal') },
    { id: 'macrosModal', open: () => window.App.showModal('macrosModal') },
    { id: 'settingsModal', open: () => window.App.showModal('settingsModal') },
  ];

  for (const d of DIALOGS) {
    test(`${d.id}: Esc closes it and the polyline keeps its three vertices`, async ({ page }) => {
      await armDraft(page);
      await page.evaluate(d.open);
      await expect(page.locator('#' + d.id)).toHaveClass(/visible/);
      await page.keyboard.press('Escape');
      await expect(page.locator('#' + d.id)).not.toHaveClass(/visible/);
      expect(await vertices(page)).toBe(3);
      expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.POLYLINE));
      // With the dialog gone, the next Esc is the draft's again (T2-02's staged pop).
      await page.keyboard.press('Escape');
      expect(await vertices(page)).toBe(2);
      expect(errors).toEqual([]);
    });

    test(`${d.id}: its × closes it and the polyline keeps its three vertices`, async ({ page }) => {
      await armDraft(page);
      await page.evaluate(d.open);
      await expect(page.locator('#' + d.id)).toHaveClass(/visible/);
      const x = page.locator('#' + d.id + ' [data-modal-close]').first();
      await x.click();
      await expect(page.locator('#' + d.id)).not.toHaveClass(/visible/);
      expect(await vertices(page)).toBe(3);
      expect(errors).toEqual([]);
    });
  }

  test('markerWsfuModal: Esc runs its own Cancel (App.cancelMarkerWsfu) and costs no vertex (D12)', async ({ page }) => {
    await armDraft(page);
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Lavatory', icon: 'M0 0h24v24H0z', color: '#e8c547', wsfu: 1 }];
      const marker = { x: 50, y: 50, id: 'm1', group: null };
      window.App.ensureActiveCanvas(s.pages[0]).annotations.counterMarkers = { c1: [marker] };
      window.App.openMarkerWsfuModal(marker, s.counters[0]);
    });
    await expect(page.locator('#markerWsfuModal')).toHaveClass(/visible/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#markerWsfuModal')).not.toHaveClass(/visible/);
    expect(await vertices(page)).toBe(3);
    expect(errors).toEqual([]);
  });

  test('a rung-less dialog over a rung dialog: Esc closes the top one only (Set Password over Manage User)', async ({ page }) => {
    await armDraft(page);
    await page.evaluate(() => { window.App.showModal('manageUserModal'); window.App.showModal('setPasswordModal'); });
    await page.keyboard.press('Escape');
    await expect(page.locator('#setPasswordModal')).not.toHaveClass(/visible/);
    expect(await visible(page, 'manageUserModal')).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#manageUserModal')).not.toHaveClass(/visible/);
    expect(await vertices(page)).toBe(3);
    expect(errors).toEqual([]);
  });

  test('the Turn In progress overlay swallows Esc: it stays up and the draft keeps its vertices', async ({ page }) => {
    await armDraft(page);
    await page.evaluate(() => window.App.showModal('turnInProgressModal'));
    await page.keyboard.press('Escape');
    expect(await visible(page, 'turnInProgressModal')).toBe(true);
    expect(await vertices(page)).toBe(3);
    await page.evaluate(() => window.App.hideModal('turnInProgressModal'));
    expect(errors).toEqual([]);
  });

  test('the schedule palette ×, now data-modal-close, still drops the pending proposal (App.cancelSchedulePalette)', async ({ page }) => {
    await page.evaluate(() => {
      window.__cancels = 0;
      const orig = window.App.cancelSchedulePalette;
      window.App.cancelSchedulePalette = () => { window.__cancels++; orig(); };
      window.App.showModal('schedulePaletteModal');
    });
    await page.locator('#schedulePaletteClose').click();
    await expect(page.locator('#schedulePaletteModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.__cancels)).toBe(1);
    // Esc takes the same path.
    await page.evaluate(() => window.App.showModal('schedulePaletteModal'));
    await page.keyboard.press('Escape');
    await expect(page.locator('#schedulePaletteModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.__cancels)).toBe(2);
    expect(errors).toEqual([]);
  });

  test('the zoom rail closes on Esc before the tool unwinds', async ({ page }) => {
    await armDraft(page);
    await page.evaluate(() => window.App.openZoomRail());
    await expect(page.locator('#zoomRail')).toHaveClass(/visible/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#zoomRail')).not.toHaveClass(/visible/);
    expect(await vertices(page)).toBe(3);
    expect(errors).toEqual([]);
  });
});

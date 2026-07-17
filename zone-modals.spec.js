// @ts-check
/**
 * features/zone-modals.js (feature-file split #29): the Multiply Zone value
 * modal, Delete Zone confirm, and Delete Page confirm handlers, extracted
 * from app.js onto the window.App registry (no registered entry points — all
 * handlers are element-bound and the pending state lives on `state`).
 *
 * Pins the moved surface: the Multiply Zone Apply creates a zone with the
 * typed multiplier from a pending rect (the create path the canvas click
 * seeds), the context-menu edit path updates an existing zone's multiplier,
 * Cancel clears the pending state, and the Delete Zone cancel/confirm
 * bindings behave (cancel clears; confirm with nothing pending is a no-op).
 * The Delete Page confirm handlers are exercised by delete-page.spec.js.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Zone & page-action modals (features/zone-modals.js)', () => {
  test('multiply-zone create/edit/cancel and delete-zone bindings', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // --- Create path: pending rect + typed multiplier -> new zone ---
    await page.evaluate(() => {
      const s = window.state;
      s.pendingMultiplyZone = { x1: 10, y1: 10, x2: 100, y2: 100 };
      s.pendingMultiplyZoneValue = null;
      document.getElementById('multiplyZoneMultiplier').value = '3';
      window.App.showModal('multiplyZoneModal');
      document.getElementById('multiplyZoneApply').click();
    });
    await page.waitForFunction(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return (ann.multiplyZones || []).length === 1;
    });
    const zone = await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).multiplyZones[0]);
    expect(zone.multiplier).toBe(3);
    expect(zone.x1).toBe(10);
    await expect(page.locator('#multiplyZoneModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.state.tool)).toBe(0); // TOOL.NONE after create

    // --- Edit path: pendingMultiplyZoneEdit updates the existing zone ---
    await page.evaluate(() => {
      const s = window.state;
      s.pendingMultiplyZoneEdit = { zoneIndex: 0 };
      s.pendingMultiplyZoneValue = null;
      document.getElementById('multiplyZoneMultiplier').value = '7';
      window.App.showModal('multiplyZoneModal');
      document.getElementById('multiplyZoneApply').click();
    });
    await page.waitForFunction(() => window.App.getActiveAnnotations(window.state.pages[0]).multiplyZones[0].multiplier === 7);

    // --- Cancel clears all pending multiply-zone state ---
    const afterCancel = await page.evaluate(() => {
      const s = window.state;
      s.pendingMultiplyZone = { x1: 1, y1: 1, x2: 2, y2: 2 };
      s.multiplyZoneStart = { x: 1, y: 1 };
      window.App.showModal('multiplyZoneModal');
      document.getElementById('multiplyZoneCancel').click();
      return {
        pending: s.pendingMultiplyZone, start: s.multiplyZoneStart,
        visible: document.getElementById('multiplyZoneModal').classList.contains('visible'),
      };
    });
    expect(afterCancel.pending).toBeNull();
    expect(afterCancel.start).toBeNull();
    expect(afterCancel.visible).toBe(false);

    // --- Delete Zone: cancel clears pending; confirm with none is a no-op ---
    const dz = await page.evaluate(() => {
      const s = window.state;
      s.pendingDeleteZone = { ann: null, collected: null };
      window.App.showModal('deleteZoneModal');
      document.getElementById('deleteZoneCancel').click();
      const cleared = s.pendingDeleteZone === null;
      window.App.showModal('deleteZoneModal');
      document.getElementById('deleteZoneConfirm').click();   // nothing pending
      return { cleared, visible: document.getElementById('deleteZoneModal').classList.contains('visible') };
    });
    expect(dz.cleared).toBe(true);
    expect(dz.visible).toBe(false);

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * features/zone-modals.js (feature-file split #29): the Multiply Zone value
 * modal and Delete Page confirm handlers, extracted
 * from app.js onto the window.App registry (no registered entry points — all
 * handlers are element-bound and the pending state lives on `state`).
 *
 * Pins the moved surface: the Multiply Zone Apply creates a zone with the
 * typed multiplier from a pending rect (the create path the canvas click
 * seeds) and keeps the tool armed with a visible hint (Tier-3 B8 / J6),
 * the context-menu edit path updates an existing zone's multiplier,
 * Cancel clears the pending state, and Delete Zone asks through the app's one
 * confirm (CONFIRM-ROUTE: Cancel and Esc keep the marks, the button deletes).
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
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
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
    // Tier-3 B8 / J6: a NEW zone commit keeps the tool armed (with a visible
    // armed-hint toast) so the next typical floor is one drag away.
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.MULTIPLY_ZONE));
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => document.getElementById('airboardToastText').textContent)).toContain('stays armed');

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

    // --- Delete Zone (CONFIRM-ROUTE): the app's one confirm. Cancel and Esc
    // keep the marks, the danger button names the count and deletes them. ---
    const zones = () => page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).multiplyZones || []).length);
    const openDeleteZone = () => page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      window.App.openDeleteZoneForRect(ann, 0, 0, 0, 1000, 1000);
    });
    const before = await zones();
    expect(before).toBeGreaterThan(0);
    await openDeleteZone();
    await expect(page.locator('#confirmModal')).toHaveClass(/visible/);
    await expect(page.locator('#confirmTitle')).toContainText('in this area?');
    await expect(page.locator('#confirmBody')).toContainText('multiply zone(s)');
    await expect(page.locator('#confirmOk')).toHaveClass(/danger/);
    await page.locator('#confirmCancel').click();
    await expect(page.locator('#confirmModal')).not.toHaveClass(/visible/);
    expect(await zones()).toBe(before);
    await openDeleteZone();
    await page.keyboard.press('Escape');
    await expect(page.locator('#confirmModal')).not.toHaveClass(/visible/);
    expect(await zones()).toBe(before);
    await openDeleteZone();
    await expect(page.locator('#confirmOk')).toHaveText(/^Delete \d+ marks?$/);
    await page.locator('#confirmOk').click();
    await page.waitForFunction(() => (window.App.getActiveAnnotations(window.state.pages[0]).multiplyZones || []).length === 0);

    expect(errors).toEqual([]);
  });
});

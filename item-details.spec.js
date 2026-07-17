// @ts-check
/**
 * features/item-details.js (feature-file split #25): the Counter / Line Type
 * details modal + its delete-confirm modal, the Line Properties modal, and
 * deleteGroup, moved out of app.js onto the window.App registry.
 *
 * Pins the moved surface end-to-end: the sidebar edit pen opens the details
 * modal via App.openCounterLineTypeDetailsModal; rename persists to state; the
 * delete flow routes through the (moved) deleteCounterLineTypeConfirm binding
 * and removes the counter + its markers; the (moved) close binding resets the
 * private details item read back through App.getCounterLineTypeDetailsItem;
 * Line Properties opens via the context-menu path, and Escape closes it via
 * App.closeLinePropertiesModal while persisting the drop just typed; and
 * App.deleteGroup (whose registration re-homed here from app.js) still clears
 * the group off annotations for its features/groups.js consumer.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Item detail & properties modals (features/item-details.js)', () => {
  test('details modal, delete flow, line properties, deleteGroup', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Seed: one counter with markers on both pages, one line type + quick line
    // assigned to a group, then rebuild the sidebar lists.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      s.lineTypes = [{ id: 'lt1', name: 'Copper 3/4', color: '#4a9eff' }];
      s.groups = [{ id: 'g1', name: 'Level 1', color: '#4a9eff' }];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: 'g1' }, { x: 80, y: 80, id: 'm2', group: null }] };
      c0.annotations.quickLines = [{ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt1', group: 'g1' }];
      const c1 = window.App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.counterMarkers = { c1: [{ x: 60, y: 60, id: 'm3', group: null }] };
      window.App.updateUI();
    });

    // --- Counter details modal via the sidebar edit pen (App.* call site) ---
    await page.evaluate(() => {
      const btn = document.querySelector('#countersList .edit-btn');
      if (!btn) throw new Error('no counter edit pen in sidebar');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('#counterLineTypeDetailsModal.visible', { timeout: 5000 });
    await expect(page.locator('#counterLineTypeDetailsTitle')).toHaveText('Counter');
    // Per-page usage list: 2 markers on page 1, 1 on page 2.
    const pageRows = await page.locator('#counterLineTypeDetailsPages .page-item').allTextContents();
    expect(pageRows.some((t) => /2 markers/.test(t))).toBe(true);
    expect(pageRows.some((t) => /1 marker\b/.test(t))).toBe(true);
    // The open item is readable through the feature-registered getter.
    expect(await page.evaluate(() => window.App.getCounterLineTypeDetailsItem()?.id)).toBe('c1');

    // Rename persists to state on blur.
    await page.evaluate(() => {
      const nameEl = document.getElementById('counterLineTypeDetailsName');
      nameEl.value = 'Roof Drain';
      nameEl.dispatchEvent(new Event('blur'));
    });
    expect(await page.evaluate(() => window.state.counters[0].name)).toBe('Roof Drain');

    // The (moved) close binding hides the modal and resets the details item.
    await page.evaluate(() => document.getElementById('counterLineTypeDetailsClose').click());
    await expect(page.locator('#counterLineTypeDetailsModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.App.getCounterLineTypeDetailsItem())).toBeNull();

    // --- Delete flow: confirm modal shows the marker count, confirm deletes ---
    await page.evaluate(() => {
      document.querySelector('#countersList .edit-btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('#counterLineTypeDetailsModal.visible');
    await page.evaluate(() => document.getElementById('counterLineTypeDetailsDelete').click());
    await page.waitForSelector('#deleteCounterLineTypeConfirmModal.visible', { timeout: 5000 });
    await expect(page.locator('#deleteCounterLineTypeMessage')).toContainText('3 markers');
    await page.evaluate(() => document.getElementById('deleteCounterLineTypeConfirm').click());
    const afterDelete = await page.evaluate(() => {
      const s = window.state;
      return {
        counters: s.counters.length,
        p0: (window.App.getActiveAnnotations(s.pages[0]).counterMarkers?.c1 || []).length,
        p1: (window.App.getActiveAnnotations(s.pages[1]).counterMarkers?.c1 || []).length,
        detailsVisible: document.getElementById('counterLineTypeDetailsModal').classList.contains('visible'),
        confirmVisible: document.getElementById('deleteCounterLineTypeConfirmModal').classList.contains('visible'),
      };
    });
    expect(afterDelete.counters).toBe(0);
    expect(afterDelete.p0).toBe(0);
    expect(afterDelete.p1).toBe(0);
    expect(afterDelete.detailsVisible).toBe(false);
    expect(afterDelete.confirmVisible).toBe(false);

    // --- Line Properties via the context-menu path; Escape persists + closes ---
    await page.evaluate(() => {
      window.state.ctxTarget = { type: 'quickLine', index: 0 };
      document.getElementById('ctxLineProperties').click();
    });
    await page.waitForSelector('#linePropertiesModal.visible', { timeout: 5000 });
    await expect(page.locator('#linePropertiesLineType')).toContainText('Copper 3/4');
    await page.evaluate(() => { document.getElementById('linePropertiesStartDrop').value = '5'; });
    await page.keyboard.press('Escape');
    await expect(page.locator('#linePropertiesModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return ann.quickLines[0].startDrop;
    })).toBe(5);

    // --- deleteGroup (registration re-homed here; groups.js consumes App.*) ---
    const groupResult = await page.evaluate(() => {
      const ok = window.App.deleteGroup('g1');   // confirm() auto-accepted above
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return { ok, groups: window.state.groups.length, lineGroup: ann.quickLines[0].group };
    });
    expect(groupResult.ok).toBe(true);
    expect(groupResult.groups).toBe(0);
    expect(groupResult.lineGroup).toBeNull();

    expect(errors).toEqual([]);
  });
});

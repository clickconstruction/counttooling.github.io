// @ts-check
/**
 * Tests: JOURNEY-MAP Tier-3 B1 — the new app.js Escape-ladder rungs.
 *
 * - saveStatusModal + lastSessionRestoreModal close on Esc (J12); the restore
 *   prompt's Esc is dismiss-for-now (clears the T1-01 clobber-guard pending
 *   flag, consumes nothing — the offer returns next boot).
 * - The five counter dialogs (counterSettingsModal, counterLineTypeDetailsModal,
 *   deleteCounterLineTypeConfirmModal, groupModal, groupAssignModal) close on
 *   Esc AND on a backdrop click (J4), each without double-closing the surface
 *   beneath (delete-confirm over details; groupModal over groupAssignModal).
 * - paletteInsightsModal (over My Settings) and legendSettingsModal (J16/J8).
 * - customIconTipsModal precedes counterModal (tips stack on top of it).
 * - Esc dismisses the mark #contextMenu ONLY (capture-phase, mirroring
 *   features/tool-context-menu.js) — never the modal/tool beneath (J9).
 * - Regression guards: the T2-13 counterModal→manageIconsModal hide-then-open
 *   chain, and the T2-02 staged polyline vertex pop still yielding to a
 *   visible modal (modal eats the Esc; no vertex pops).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Tier-3 B1 — Escape ladder additions', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Seed a counter with markers (so the details delete routes through the
    // confirm modal), a line type + scale (polyline arming), and a group.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      s.lineTypes = [{ id: 'lt1', name: 'Copper 3/4', color: '#4a9eff', curveStyle: 'straight' }];
      s.activeLineTypeId = 'lt1';
      s.groups = [{ id: 'g1', name: 'Level 1', color: '#4a9eff' }];
      s.pages[s.currentPage].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }, { x: 80, y: 80, id: 'm2', group: null }] };
      window.App.updateUI();
    });
  });

  const visible = (page, id) => page.evaluate((i) => document.getElementById(i).classList.contains('visible'), id);

  test('saveStatusModal closes on Esc (J12)', async ({ page }) => {
    await page.evaluate(() => window.App.showModal('saveStatusModal'));
    await expect(page.locator('#saveStatusModal')).toHaveClass(/visible/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#saveStatusModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('lastSessionRestoreModal: Esc dismisses for now — pending flag clears, nothing is consumed (J12/T1-01)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('clickcount-last-project', JSON.stringify({ projectId: 'p1', projectName: 'Bid A', userId: 'u1' }));
      window.App.openLastSessionRestorePrompt({ cloudLast: { projectId: 'p1', projectName: 'Bid A', userId: 'u1' } });
    });
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => window.App.isRestorePromptPending())).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    // The clobber-guard gate releases (backups resume) …
    expect(await page.evaluate(() => window.App.isRestorePromptPending())).toBe(false);
    // … but NOTHING was consumed: the offer must return next boot.
    expect(await page.evaluate(() => localStorage.getItem('clickcount-last-project'))).not.toBeNull();
    expect(errors).toEqual([]);
  });

  test('counterSettingsModal closes on Esc and on backdrop click (J4)', async ({ page }) => {
    await page.evaluate(() => window.App.openCounterSettingsModal());
    await expect(page.locator('#counterSettingsModal')).toHaveClass(/visible/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#counterSettingsModal')).not.toHaveClass(/visible/);

    await page.evaluate(() => window.App.openCounterSettingsModal());
    await page.locator('#counterSettingsModal').click({ position: { x: 8, y: 300 } });
    await expect(page.locator('#counterSettingsModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('details dialog closes on Esc (item reset) and on backdrop click (J4)', async ({ page }) => {
    const openDetails = () => page.evaluate(() => {
      document.querySelector('#countersList .edit-btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await openDetails();
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#counterLineTypeDetailsModal')).not.toHaveClass(/visible/);
    // Esc routed through the Close button, so the private item reset fired.
    expect(await page.evaluate(() => window.App.getCounterLineTypeDetailsItem())).toBeNull();

    await openDetails();
    await page.locator('#counterLineTypeDetailsModal').click({ position: { x: 8, y: 300 } });
    await expect(page.locator('#counterLineTypeDetailsModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('delete-confirm over details: Esc closes only the confirm; details survives; nothing deleted (J4)', async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('#countersList .edit-btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    // Markers exist, so Delete opens the confirm ON TOP (details stays up).
    await page.evaluate(() => document.getElementById('counterLineTypeDetailsDelete').click());
    await expect(page.locator('#deleteCounterLineTypeConfirmModal')).toHaveClass(/visible/);
    expect(await visible(page, 'counterLineTypeDetailsModal')).toBe(true);

    // First Esc: confirm only — the details dialog beneath must NOT close.
    await page.keyboard.press('Escape');
    await expect(page.locator('#deleteCounterLineTypeConfirmModal')).not.toHaveClass(/visible/);
    expect(await visible(page, 'counterLineTypeDetailsModal')).toBe(true);
    // Cancel path ran: the counter is untouched.
    expect(await page.evaluate(() => window.state.counters.length)).toBe(1);

    // Second Esc: now the details dialog closes.
    await page.keyboard.press('Escape');
    await expect(page.locator('#counterLineTypeDetailsModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.state.counters.length)).toBe(1);

    // Backdrop click on the confirm behaves like its Cancel too.
    await page.evaluate(() => {
      document.querySelector('#countersList .edit-btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.getElementById('counterLineTypeDetailsDelete').click();
    });
    await expect(page.locator('#deleteCounterLineTypeConfirmModal')).toHaveClass(/visible/);
    await page.locator('#deleteCounterLineTypeConfirmModal').click({ position: { x: 8, y: 300 } });
    await expect(page.locator('#deleteCounterLineTypeConfirmModal')).not.toHaveClass(/visible/);
    expect(await visible(page, 'counterLineTypeDetailsModal')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('groupModal over groupAssignModal: Esc unwinds one dialog per press; backdrop closes only the top (J4)', async ({ page }) => {
    // Assign dialog for the seeded marker, then "+ Add group" stacks groupModal.
    await page.evaluate(() => {
      const marker = window.App.ensureActiveCanvas(window.state.pages[0]).annotations.counterMarkers.c1[0];
      window.App.openGroupAssignModal(marker);
      document.getElementById('groupAssignAddGroup').click();
    });
    await expect(page.locator('#groupModal')).toHaveClass(/visible/);
    expect(await visible(page, 'groupAssignModal')).toBe(true);

    // Esc: groupModal only — assign stays up beneath it.
    await page.keyboard.press('Escape');
    await expect(page.locator('#groupModal')).not.toHaveClass(/visible/);
    expect(await visible(page, 'groupAssignModal')).toBe(true);

    // Second Esc: assign closes.
    await page.keyboard.press('Escape');
    await expect(page.locator('#groupAssignModal')).not.toHaveClass(/visible/);
    // No group was created by the cancels.
    expect(await page.evaluate(() => window.state.groups.length)).toBe(1);

    // Backdrop clicks, same stack: only the top dialog closes per click.
    await page.evaluate(() => {
      const marker = window.App.ensureActiveCanvas(window.state.pages[0]).annotations.counterMarkers.c1[0];
      window.App.openGroupAssignModal(marker);
      document.getElementById('groupAssignAddGroup').click();
    });
    await page.locator('#groupModal').click({ position: { x: 8, y: 300 } });
    await expect(page.locator('#groupModal')).not.toHaveClass(/visible/);
    expect(await visible(page, 'groupAssignModal')).toBe(true);
    await page.locator('#groupAssignModal').click({ position: { x: 8, y: 300 } });
    await expect(page.locator('#groupAssignModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('paletteInsightsModal closes first, My Settings beneath survives (J16)', async ({ page }) => {
    await page.evaluate(() => {
      window.App.showModal('mySettingsModal');
      window.App.showModal('paletteInsightsModal');
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('#paletteInsightsModal')).not.toHaveClass(/visible/);
    expect(await visible(page, 'mySettingsModal')).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#mySettingsModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('legendSettingsModal closes on Esc (J8)', async ({ page }) => {
    await page.evaluate(() => window.App.openLegendSettingsModal());
    await expect(page.locator('#legendSettingsModal')).toHaveClass(/visible/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#legendSettingsModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('customIconTipsModal over counterModal: Esc closes tips only', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('addCounter').click();
      window.App.showModal('customIconTipsModal');
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('#customIconTipsModal')).not.toHaveClass(/visible/);
    expect(await visible(page, 'counterModal')).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#counterModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('Esc dismisses the mark #contextMenu only — the modal beneath never sees the press (J9)', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('addCounter').click(); // counterModal beneath
      window.state.ctxTarget = { type: 'note', index: 0 };
      document.getElementById('contextMenu').classList.add('visible');
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('#contextMenu')).not.toHaveClass(/visible/);
    // Capture-phase stopImmediatePropagation: the ladder never ran.
    expect(await visible(page, 'counterModal')).toBe(true);
    expect(await page.evaluate(() => window.state.ctxTarget)).toBeNull();
    // The next Esc reaches the ladder normally.
    await page.keyboard.press('Escape');
    await expect(page.locator('#counterModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('T2-13 regression: counterModal→manageIconsModal hide-then-open chain, Esc closes Manage Icons alone', async ({ page }) => {
    await page.evaluate(() => document.getElementById('addCounter').click());
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    await page.evaluate(() => document.getElementById('counterManageIcons').click());
    // Hide-then-open is load-bearing: the two are never visible together.
    await expect(page.locator('#manageIconsModal')).toHaveClass(/visible/);
    expect(await visible(page, 'counterModal')).toBe(false);
    await page.keyboard.press('Escape');
    await expect(page.locator('#manageIconsModal')).not.toHaveClass(/visible/);
    expect(await visible(page, 'counterModal')).toBe(false);
    expect(errors).toEqual([]);
  });

  test('T2-02 regression: a visible modal eats the Esc — no polyline vertex pops; the staged pop still works after', async ({ page }) => {
    // Arm polyline (scale + active line type seeded in beforeEach) and give
    // the draft two vertices.
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.POLYLINE && !!window.state.drawingPolyline, null, { timeout: 5000 });
    await page.evaluate(() => {
      window.state.drawingPolyline.points.push({ x: 100, y: 100 }, { x: 140, y: 100 });
      window.App.openCounterSettingsModal(); // a new B1 rung, on top of the draft
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('#counterSettingsModal')).not.toHaveClass(/visible/);
    // The modal rung consumed the press: both vertices survive.
    expect(await page.evaluate(() => window.state.drawingPolyline.points.length)).toBe(2);
    // With no modal up, the T2-02 staged pop takes the next press.
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.state.drawingPolyline.points.length)).toBe(1);
    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: the per-project Groups gate. The Groups UI (sidebar #groupsSection +
 * the context-menu Assign-to-Group entry) shows only when the project opted
 * in (`state.groupsEnabled`, the Project Settings "Use groups in this
 * project" toggle) OR already contains groups (existing organized projects
 * keep their section with no migration). Guards: the default-hidden state,
 * the settings toggle both ways, the has-groups auto-show + locked-on
 * toggle, the create-latch (first group flips the flag so deleting the last
 * group cannot hide the section mid-session), the context-menu gate, and the
 * flag riding the save payload + both shared restore paths.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Per-project Groups gate', () => {
  test('hidden by default; settings toggle, has-groups auto-show + lock, create-latch, ctx gate, persistence', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const section = page.locator('#groupsSection');
    const toggle = page.locator('#settingsUseGroupsBtn');

    // Default: no groups, flag off -> section hidden.
    await expect(section).toBeHidden();

    // Project Settings toggle shows/hides it (per-project opt-in).
    await page.evaluate(() => window.App.showModal('settingsModal'));
    await toggle.click();
    await expect(section).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.state.groupsEnabled)).toBe(true);
    await toggle.click();
    await expect(section).toBeHidden();
    await page.evaluate(() => window.App.hideModal('settingsModal'));

    // A project that already has groups auto-shows the section and locks the
    // toggle on (no flag write needed).
    await page.evaluate(() => {
      window.state.groups = [{ id: 'g1', name: 'Restroom A', color: '#c94f7c' }];
      window.App.updateUI();
    });
    await expect(section).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toBeDisabled();
    await page.evaluate(() => { window.state.groups = []; window.App.updateUI(); });
    await expect(section).toBeHidden();

    // Create-latch: making the first group through the real modal flips the
    // flag, so deleting that group later keeps the section visible.
    await page.evaluate(() => { window.state.groupsEnabled = true; window.App.updateUI(); });
    await page.evaluate(() => window.App.openGroupModal(null));
    await page.waitForSelector('#groupModal.visible', { timeout: 5000 });
    await page.locator('#groupModalName').fill('Latch Group');
    await page.locator('#groupModalDone').click();
    await page.evaluate(() => { window.state.groups = []; window.App.updateUI(); });
    await expect(section).toBeVisible();
    expect(await page.evaluate(() => window.state.groupsEnabled)).toBe(true);

    // Context-menu gate: with the Groups UI off, right-clicking a marker
    // offers no Assign-to-group entry; with it on, it does. Seed in pdf-space
    // (CSS px / zoom) and right-click for real — the menu-clamp recipe.
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 300, { timeout: 10000 });
    const marker = await page.evaluate(() => {
      const App = window.App, s = window.state;
      s.groupsEnabled = false;
      const rect = document.getElementById('annCanvas').getBoundingClientRect();
      const z = s.zoom;
      s.counters = [{ id: 'c1', name: 'WC', icon: 'M0 0h10v10H0z', color: '#e8c547' }];
      const c0 = App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 100 / z, y: 100 / z, id: 'm1' }] };
      App.renderAnnotations();
      App.updateUI();
      return { x: rect.left + 100, y: rect.top + 100 };
    });
    await page.mouse.click(marker.x, marker.y, { button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#ctxAssignGroup')).toBeHidden();
    await page.mouse.click(marker.x + 220, marker.y + 220); // dismiss
    await page.evaluate(() => { window.state.groupsEnabled = true; });
    await page.mouse.click(marker.x, marker.y, { button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#ctxAssignGroup')).toBeVisible();
    await page.mouse.click(marker.x + 220, marker.y + 220); // dismiss

    // Persistence: the flag rides the canvas-JSON export payload and both
    // shared restore paths.
    const roundtrip = await page.evaluate(() => {
      const App = window.App, s = window.state;
      s.groupsEnabled = true;
      const out = {};
      s.groupsEnabled = false;
      App.applyTakeoffBackupToState
        ? App.applyTakeoffBackupToState({ groupsEnabled: true })
        : null;
      out.backupRestore = s.groupsEnabled;
      s.groupsEnabled = false;
      App.hydrateStateFromProjectData
        ? App.hydrateStateFromProjectData({ counters: [], lineTypes: [], groups: [], groupsEnabled: true, pages: [] })
        : null;
      out.hydrateRestore = s.groupsEnabled;
      return out;
    });
    expect(roundtrip).toEqual({ backupRestore: true, hydrateRestore: true });

    expect(errors).toEqual([]);
  });
});

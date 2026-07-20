// @ts-check
/**
 * features/restore-last-session.js (Tier-2 split): the last-session restore
 * flow — App.openLastSessionRestorePrompt, the Keep/Discard handlers, and
 * doRestoreLastProject.
 *
 * Pins: the registry contract, the prompt rendering (escaped project name in
 * the message), the Discard path (clears the clickcount-last-project key and
 * closes the modal), the reset callback, and the full LOCAL Keep path — a
 * pending {proj, cachedBlob} built from a real PDF restores pages, palette,
 * and annotations end-to-end with no cloud dependency.
 */
const { test, expect } = require('@playwright/test');

test.describe('Last-session restore (features/restore-last-session.js)', () => {
  test('registry contract, prompt, discard, local keep restore', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // --- Registry contract ---
    const contract = await page.evaluate(() => ({
      open: typeof window.App.openLastSessionRestorePrompt,
      reset: typeof window.App.onLastSessionRestoreReset,
    }));
    expect(contract.open).toBe('function');
    expect(contract.reset).toBe('function');

    // --- Prompt renders with the name escaped (no element injection) ---
    await page.evaluate(() => {
      window.App.openLastSessionRestorePrompt({
        proj: { id: 'local', name: '<b>evil</b>-takeoff', data: {} },
        cachedBlob: null,
      });
    });
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/);
    await expect(page.locator('#lastSessionRestoreMessage')).toContainText('<b>evil</b>');
    expect(await page.evaluate(() => !!document.querySelector('#lastSessionRestoreMessage b'))).toBe(false);

    // --- Reset callback clears the pending state; Keep then no-ops closed ---
    await page.evaluate(() => {
      window.App.onLastSessionRestoreReset();
      document.getElementById('lastSessionRestoreKeep').click();
    });
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);

    // --- Discard clears the last-project key and closes ---
    await page.evaluate(() => {
      localStorage.setItem('clickcount-last-project', JSON.stringify({ projectId: 'p1', userId: 'u1' }));
      window.App.openLastSessionRestorePrompt({ cloudLast: { projectId: 'p1', projectName: 'Cloud Job' } });
    });
    await expect(page.locator('#lastSessionRestoreMessage')).toContainText('Cloud Job');
    await page.evaluate(() => document.getElementById('lastSessionRestoreDiscard').click());
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    await page.waitForFunction(() => localStorage.getItem('clickcount-last-project') === null);

    // --- Local Keep path: restore a session from a real PDF blob, no cloud ---
    await page.evaluate(async () => {
      const res = await fetch('/test-page.pdf');
      const blob = await res.blob();
      const proj = {
        id: 'local',
        name: 'Restored Takeoff',
        updated_at: null,
        pdf_path: null,
        pdf_hash: null,
        user_id: null,
        checked_out_by: null,
        checked_out_at: null,
        data: {
          counters: [{ id: 'c1', name: 'WC', icon: 'M0 0h10v10H0z', color: '#e8c547' }],
          lineTypes: [],
          groups: [],
          rooms: [{ id: 'r1', name: 'Office', color: '#4a9eff' }],
          pages: [{
            index: 0,
            canvases: [{ id: 'cv1', name: 'Main', annotations: { counterMarkers: { c1: [{ x: 10, y: 10, id: 'm1' }] }, roomBoxes: [{ x1: 0, y1: 0, x2: 50, y2: 50, heightFt: 8, roomId: 'r1', id: 'b1' }] } }],
            scale: { pixelsPerUnit: 10, unit: 'ft' },
            rotation: 0,
          }],
        },
      };
      window.App.openLastSessionRestorePrompt({ proj, cachedBlob: blob });
      document.getElementById('lastSessionRestoreKeep').click();
    });
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 15000 });
    const restored = await page.evaluate(() => ({
      name: window.state.currentProjectName,
      counters: window.state.counters.length,
      rooms: window.state.rooms.length,
      markers: (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers.c1 || []).length,
      roomBoxes: (window.App.getActiveAnnotations(window.state.pages[0]).roomBoxes || []).length,
      scale: window.state.pages[0].scale?.pixelsPerUnit,
      modalOpen: document.getElementById('lastSessionRestoreModal').classList.contains('visible'),
    }));
    expect(restored.name).toBe('Restored Takeoff');
    expect(restored.counters).toBe(1);
    expect(restored.rooms).toBe(1);
    expect(restored.markers).toBe(1);
    expect(restored.roomBoxes).toBe(1);
    expect(restored.scale).toBe(10);
    expect(restored.modalOpen).toBe(false);

    expect(errors).toEqual([]);
  });
});

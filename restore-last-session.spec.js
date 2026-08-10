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

  // --- T1-01: signed-out boot offer + backup-clobber guard -----------------
  // These drive the REAL boot path (seed the 'local' IndexedDB record, reload)
  // with no cloud dependency: the backup is on-device data and the prompt +
  // Keep must work signed-out and fully offline.

  /** Seed a promptable 'local' takeoff backup (3 markers + a real PDF blob). */
  async function seedLocalBackup(page) {
    await page.evaluate(async () => {
      const res = await fetch('/test-page.pdf');
      const blob = await res.blob();
      const data = {
        counters: [{ id: 'c1', name: 'WC', icon: 'M0 0h10v10H0z', color: '#e8c547' }],
        lineTypes: [],
        pageCanvases: [[{ id: 'cv1', name: 'Main', annotations: { counterMarkers: { c1: [
          { x: 10, y: 10, id: 'm1' }, { x: 20, y: 20, id: 'm2' }, { x: 30, y: 30, id: 'm3' },
        ] } } }]],
        pageScales: [null],
        pageRotations: [0],
      };
      await window.__takeoffBackupPutForTest('local', data, blob, null, Date.now(), 'sample-plan', null);
    });
  }

  const countHeldMarkers = () => window.__takeoffBackupGetForTest(TAKEOFF_BACKUP_HELD_ID, null).then((e) => {
    if (!e || !e.data) return null;
    let n = 0;
    (e.data.pageCanvases || []).forEach((cs) => (cs || []).forEach((c) => {
      Object.values((c.annotations && c.annotations.counterMarkers) || {}).forEach((a) => { n += (a || []).length; });
    }));
    return n;
  });

  test('signed-out boot offer, clobber guard, keep-after-9s, post-Keep lifecycle', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await seedLocalBackup(page);
    await page.reload();

    // 1. The prompt appears signed-out, with the project name.
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/, { timeout: 15000 });
    await expect(page.locator('#lastSessionRestoreMessage')).toContainText('sample-plan');
    // Key-aside: the candidate now lives under the held key.
    expect(await page.evaluate(countHeldMarkers)).toBe(3);

    // 2. Clobber guard: force a write AND sit through a real 5s interval tick
    //    (>6s) with the prompt pending — the held record must survive, and
    //    'local' must not be repopulated with a marker-less record that
    //    outranks it (the exact reproduced self-destruct).
    await page.evaluate(() => window.__writeTakeoffStateBackupForTest());
    await page.waitForTimeout(6500);
    expect(await page.evaluate(countHeldMarkers)).toBe(3);
    const localAfterGuard = await page.evaluate(async () => {
      const held = await window.__takeoffBackupGetForTest(TAKEOFF_BACKUP_HELD_ID, null);
      const local = await window.__takeoffBackupGetForTest('local', null);
      const markerCount = (e) => {
        let n = 0;
        (e && e.data && e.data.pageCanvases || []).forEach((cs) => (cs || []).forEach((c) => {
          Object.values((c.annotations && c.annotations.counterMarkers) || {}).forEach((a) => { n += (a || []).length; });
        }));
        return n;
      };
      return {
        localOutranksHeldWithoutMarkers: !!(local && markerCount(local) === 0 && (local.lastModifiedAt || 0) > (held.lastModifiedAt || 0)),
        clobberAverted: (window.App.getSaveStatusLog() || []).some((ev) => ev.kind === 'backup_clobber_averted'),
      };
    });
    expect(localAfterGuard.localOutranksHeldWithoutMarkers).toBe(false);
    expect(localAfterGuard.clobberAverted).toBe(true);

    // 3. Keep after >9s total (the reproduced poisoning window): ALL markers
    //    restore (was 0 before this PR), the session is editable, modal closed.
    await page.waitForTimeout(3000);
    await page.evaluate(() => document.getElementById('lastSessionRestoreKeep').click());
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 15000 });
    const afterKeep = await page.evaluate(() => ({
      markers: (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers.c1 || []).length,
      isViewer: window.state.isViewer,
      modalOpen: document.getElementById('lastSessionRestoreModal').classList.contains('visible'),
    }));
    expect(afterKeep.markers).toBe(3);
    expect(afterKeep.isViewer).toBe(false);
    expect(afterKeep.modalOpen).toBe(false);
    // Held record consumed on Keep.
    expect(await page.evaluate(() => window.__takeoffBackupGetForTest(TAKEOFF_BACKUP_HELD_ID, null))).toBe(null);

    // 4. Post-Keep lifecycle: backups resumed (pins the isViewer fix) — a
    //    dirty mark repopulates a fresh 'local' backup with the markers.
    await page.evaluate(() => window.App.markProjectDirty());
    await page.waitForFunction(async () => {
      const local = await window.__takeoffBackupGetForTest('local', null);
      if (!local || !local.data) return false;
      let n = 0;
      (local.data.pageCanvases || []).forEach((cs) => (cs || []).forEach((c) => {
        Object.values((c.annotations && c.annotations.counterMarkers) || {}).forEach((a) => { n += (a || []).length; });
      }));
      return n === 3;
    }, null, { timeout: 15000 });
  });

  test('ignored prompt survives reloads; Discard consumes both records', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await seedLocalBackup(page);

    // Ignore the prompt across TWO reloads: still offered, markers intact.
    await page.reload();
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/, { timeout: 15000 });
    await page.reload();
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/, { timeout: 15000 });
    await expect(page.locator('#lastSessionRestoreMessage')).toContainText('sample-plan');
    expect(await page.evaluate(countHeldMarkers)).toBe(3);

    // Discard deletes the held record AND 'local'; next boot shows no prompt.
    await page.evaluate(() => document.getElementById('lastSessionRestoreDiscard').click());
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    await page.waitForFunction(async () => {
      const held = await window.__takeoffBackupGetForTest(TAKEOFF_BACKUP_HELD_ID, null);
      const local = await window.__takeoffBackupGetForTest('local', null);
      return held === null && local === null;
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
  });
});

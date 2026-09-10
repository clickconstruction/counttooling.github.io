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
 *
 * The offer waits its turn (2026-09-10): behind an open modal or a running
 * tour the prompt is DEFERRED (no write hold, nothing restored) and appears
 * when the modal hides / the tour stops; a boot that lands on a session that
 * already has pages never pre-applies the backup over them (the prompt still
 * comes; only Keep restores), while a quiet boot keeps the silent palette
 * pre-apply. The real-boot tests hold the boot at its storage-persist await
 * (`window.__releaseBoot`) to reproduce the slow-runner shape deterministically.
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
      pageLabel: window.state.pages[0].label,
      modalOpen: document.getElementById('lastSessionRestoreModal').classList.contains('visible'),
    }));
    expect(restored.name).toBe('Restored Takeoff');
    // B6 (J12): page labels carry the project name, not "document.pdf".
    expect(restored.pageLabel).toBe('Restored Takeoff');
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

  // = TAKEOFF_BACKUP_HELD_ID (constants.js; pinned in constants.test.js).
  // Passed into evaluate as an arg: the page-side const is not reachable from
  // a serialized closure, and the Node-side lint has no browser globals.
  const HELD_ID = 'local-held';

  const countHeldMarkers = (heldId) => window.__takeoffBackupGetForTest(heldId, null).then((e) => {
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
    expect(await page.evaluate(countHeldMarkers, HELD_ID)).toBe(3);

    // 2. Clobber guard: force a write AND sit through a real 5s interval tick
    //    (>6s) with the prompt pending — the held record must survive, and
    //    'local' must not be repopulated with a marker-less record that
    //    outranks it (the exact reproduced self-destruct).
    await page.evaluate(() => window.__writeTakeoffStateBackupForTest());
    await page.waitForTimeout(6500);
    expect(await page.evaluate(countHeldMarkers, HELD_ID)).toBe(3);
    const localAfterGuard = await page.evaluate(async (heldId) => {
      const held = await window.__takeoffBackupGetForTest(heldId, null);
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
    }, HELD_ID);
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
    expect(await page.evaluate((heldId) => window.__takeoffBackupGetForTest(heldId, null), HELD_ID)).toBe(null);

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
    expect(await page.evaluate(countHeldMarkers, HELD_ID)).toBe(3);

    // Discard deletes the held record AND 'local'; next boot shows no prompt.
    await page.evaluate(() => document.getElementById('lastSessionRestoreDiscard').click());
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    await page.waitForFunction(async (heldId) => {
      const held = await window.__takeoffBackupGetForTest(heldId, null);
      const local = await window.__takeoffBackupGetForTest('local', null);
      return held === null && local === null;
    }, HELD_ID);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
  });

  // --- The offer waits its turn (2026-09-10) ------------------------------

  const promptState = () => ({
    visible: document.getElementById('lastSessionRestoreModal').classList.contains('visible'),
    pending: window.App.isRestorePromptPending(),
    deferred: window.App.isRestorePromptDeferred(),
  });

  test('deferred behind an open modal: no write hold, shows when the modal hides', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      window.App.showModal('keyboardMapModal');
      window.App.openLastSessionRestorePrompt({ cloudLast: { projectId: 'p1', projectName: 'Bid A', userId: 'u1' } });
    });
    expect(await page.evaluate(promptState)).toEqual({ visible: false, pending: false, deferred: true });
    // A second modal on top, then both close: the offer surfaces only once the
    // last one is gone.
    await page.evaluate(() => { window.App.showModal('zoomModal'); window.App.hideModal('zoomModal'); });
    await page.waitForTimeout(1200);   // past the 1 s safety poll
    expect(await page.evaluate(promptState)).toEqual({ visible: false, pending: false, deferred: true });
    await page.evaluate(() => window.App.hideModal('keyboardMapModal'));
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/);
    await expect(page.locator('#lastSessionRestoreMessage')).toContainText('Bid A');
    expect(await page.evaluate(promptState)).toEqual({ visible: true, pending: true, deferred: false });

    // Esc-dismiss semantics are unchanged for a prompt that arrived late.
    await page.keyboard.press('Escape');
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(promptState)).toEqual({ visible: false, pending: false, deferred: false });

    // A session teardown drops a deferred offer (nothing consumed).
    await page.evaluate(() => {
      window.App.showModal('keyboardMapModal');
      window.App.openLastSessionRestorePrompt({ cloudLast: { projectId: 'p1', projectName: 'Bid A', userId: 'u1' } });
      window.App.onLastSessionRestoreReset();
      window.App.hideModal('keyboardMapModal');
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(promptState)).toEqual({ visible: false, pending: false, deferred: false });
    expect(errors).toEqual([]);
  });

  /** Hold the real boot at its storage-persist await until __releaseBoot(). */
  const holdBoot = (page) => page.addInitScript(() => {
    // app.js init awaits navigator.storage.persist() right after auth and
    // before the takeoff-backup read — the slow-runner window in which a
    // user or a ?tour= walkthrough gets ahead of the boot.
    const s = navigator.storage;
    if (!s) return;
    s.persisted = () => Promise.resolve(false);
    s.persist = () => new Promise((resolve) => { window.__releaseBoot = () => resolve(false); });
  });
  const releaseBoot = async (page) => {
    await page.waitForFunction(() => typeof window.__releaseBoot === 'function');
    await page.evaluate(() => window.__releaseBoot());
    await page.waitForFunction(() => window.App.bootSettled === true);
  };
  const markerCountOnPage0 = () => {
    const a = window.App.getActiveAnnotations(window.state.pages[0]);
    return Object.values((a && a.counterMarkers) || {}).reduce((n, arr) => n + (arr || []).length, 0);
  };

  test('real boot: a running tour defers the offer and keeps its takeoff; a busy session is never pre-applied over', async ({ page }) => {
    test.setTimeout(90000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await seedLocalBackup(page);
    await holdBoot(page);

    // 1. The tour is ahead of the boot (the ?tour= shape): the offer waits,
    //    nothing is pre-applied, backups are not held, the tour's plan and
    //    marks survive, and the prompt comes when the tour stops. (The boot is
    //    released as soon as the tour is up — before the 5 s backup interval
    //    can overwrite the seeded 'local' record with the tour's own session.)
    await page.reload();
    await page.evaluate(() => { try { localStorage.removeItem('clickcount-tour-done'); } catch (_) {} window.App.startTutorial('electrical'); });
    await releaseBoot(page);
    expect(await page.evaluate(promptState)).toEqual({ visible: false, pending: false, deferred: true });
    expect(await page.evaluate(() => window.state.counters.some((c) => c.name === 'WC'))).toBe(false);
    // Key-aside still happened: the candidate is safe under the held key.
    expect(await page.evaluate(countHeldMarkers, HELD_ID)).toBe(3);
    // The tour goes on — "do it for me" through the real steps to a real mark
    // on the sample plan (each step auto-advances a beat after its check).
    const waitForStep = (id) => page.waitForFunction((want) => window.App.tutorialStepId() === want, id, { timeout: 15000 });
    await page.click('#tourAction');   // welcome → opens the sample plan
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await waitForStep('scale');
    await page.click('#tourAction');   // scale
    await waitForStep('measure');
    await page.click('#tourAction');   // prove it
    await waitForStep('trade');
    await page.click('#tourAction');   // trade
    await waitForStep('counter');
    await page.click('#tourAction');   // the receptacle counter
    await waitForStep('place');
    await page.click('#tourAction');   // places the receptacles
    await page.waitForFunction(() => {
      const a = window.App.getActiveAnnotations(window.state.pages[0]);
      return Object.values((a && a.counterMarkers) || {}).some((arr) => arr && arr.length);
    }, null, { timeout: 8000 });
    const tourMarks = await page.evaluate(markerCountOnPage0);
    expect(tourMarks).toBeGreaterThan(0);
    await page.waitForTimeout(1200);   // the safety poll must not sneak it in mid-tour
    expect(await page.evaluate(promptState)).toEqual({ visible: false, pending: false, deferred: true });

    await page.evaluate(() => window.App.stopTutorial(false));
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/);
    await expect(page.locator('#lastSessionRestoreMessage')).toContainText('sample-plan');
    expect(await page.evaluate(promptState)).toEqual({ visible: true, pending: true, deferred: false });
    // Discard: the tour's takeoff is untouched.
    await page.evaluate(() => document.getElementById('lastSessionRestoreDiscard').click());
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(markerCountOnPage0)).toBe(tourMarks);
    expect(await page.evaluate(() => window.state.pages.length)).toBe(1);
    expect(await page.evaluate((heldId) => window.__takeoffBackupGetForTest(heldId, null), HELD_ID)).toBe(null);

    // 2. A user ahead of the boot: pages loaded and dirty when the candidate
    //    arrives — the prompt still comes, but nothing lands on their pages.
    await seedLocalBackup(page);
    await page.reload();
    await page.locator('#pdfInput').setInputFiles('test-2pages.pdf');
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await page.evaluate(() => window.App.markProjectDirty());
    await releaseBoot(page);
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/);
    expect(await page.evaluate(promptState)).toEqual({ visible: true, pending: true, deferred: false });
    expect(await page.evaluate(() => ({
      pages: window.state.pages.length,
      wc: window.state.counters.some((c) => c.name === 'WC'),
      marks: (() => { const a = window.App.getActiveAnnotations(window.state.pages[0]); return Object.values((a && a.counterMarkers) || {}).reduce((n, arr) => n + (arr || []).length, 0); })(),
    }))).toEqual({ pages: 2, wc: false, marks: 0 });
    await page.evaluate(() => document.getElementById('lastSessionRestoreDiscard').click());
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.state.pages.length)).toBe(2);

    // 3. A quiet boot is unchanged: the palette is pre-applied silently and
    //    the prompt is up (T1-01 as documented).
    await seedLocalBackup(page);
    await page.reload();
    await releaseBoot(page);
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => ({ pages: window.state.pages.length, wc: window.state.counters.some((c) => c.name === 'WC') }))).toEqual({ pages: 0, wc: true });
    await page.evaluate(() => document.getElementById('lastSessionRestoreDiscard').click());
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });
});

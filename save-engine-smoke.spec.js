// @ts-check
/**
 * Save-engine smoke (Stage 0 of the save/sync engine extraction plan): pins
 * the SIGNED-OUT engine behaviors every later engine stage must preserve,
 * with no cloud dependency.
 *
 * Round-trip under test: dirty edit → the 5s takeoff-backup tick writes the
 * full state (counters, markers, PDF blob) to IndexedDB under the 'local'
 * key → a fresh signed-out page load restores the PALETTE from that backup
 * (counters; pages/PDF intentionally stay in the backup for the recovery
 * flows), and the backup entry itself survives the reload intact.
 *
 * If an engine stage moves the dirty-tracking, backup writer, or boot
 * restore and this spec still passes, the wrappers + contracts held.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Save engine smoke (signed-out local backup round-trip)', () => {
  test('dirty edit -> 5s IDB backup -> reload restores the takeoff', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Dirty edit: a counter with one placed marker.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'smoke1', name: 'Smoke Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      const c = window.App.ensureActiveCanvas(s.pages[0]);
      c.annotations.counterMarkers = { smoke1: [{ x: 40, y: 40, id: 'sm1', group: null }] };
      window.App.markProjectDirty();
      window.App.updateUI();
    });

    // The 5s backup tick writes the takeoff (incl. the PDF blob) to IndexedDB
    // under the 'local' key for signed-out sessions. Poll inside ONE evaluate
    // and summarize from the same snapshot (a second read can transiently race
    // the next tick's write).
    const backup = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 20; i++) {
        const entry = await window.App.takeoffBackupGet('local', undefined);
        const d = entry && (entry.data || entry);
        if (d && Array.isArray(d.counters) && d.counters.some((c) => c.id === 'smoke1')) {
          // Backup format: per-page canvases live in d.pageCanvases (indexed by
          // page), not a pages[] array (see backupDataToProjFormat).
          const pc = (d.pageCanvases && (d.pageCanvases[0] || d.pageCanvases['0'])) || [];
          const canvases = Array.isArray(pc) ? pc : (pc.canvases || []);
          const markers = canvases[0]?.annotations?.counterMarkers?.smoke1 || [];
          return {
            found: true,
            counter: d.counters[0]?.name,
            markerCount: markers.length,
            hasPdf: !!(entry.pdfBlob || d.pdfBlob),
          };
        }
        await sleep(1000);
      }
      return { found: false };
    });
    expect(backup.found).toBe(true);
    expect(backup.counter).toBe('Smoke Drain');
    expect(backup.markerCount).toBe(1);

    // Fresh load, still signed out: boot restores the PALETTE from the backup
    // (pages/PDF deliberately stay in the backup for the recovery flows).
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const s = window.state;
      return !!(s && Array.isArray(s.counters) && s.counters.some((c) => c.id === 'smoke1'));
    }, null, { timeout: 20000, polling: 500 });

    // The backup entry survives the reload with the marker + PDF blob intact.
    const postReload = await page.evaluate(async () => {
      const entry = await window.App.takeoffBackupGet('local', undefined);
      const d = entry && (entry.data || entry);
      if (!d) return { intact: false };
      const pc = (d.pageCanvases && (d.pageCanvases[0] || d.pageCanvases['0'])) || [];
      const canvases = Array.isArray(pc) ? pc : (pc.canvases || []);
      const markers = canvases[0]?.annotations?.counterMarkers?.smoke1 || [];
      return { intact: true, markerCount: markers.length, hasPdf: !!entry.pdfBlob };
    });
    expect(postReload.intact).toBe(true);
    expect(postReload.markerCount).toBe(1);
    expect(postReload.hasPdf).toBe(true);

    expect(errors).toEqual([]);
  });
});

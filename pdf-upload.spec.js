// @ts-check
/**
 * Tests: the robust PDF upload work (Phase C size-aware/abortable/verify timeout
 * + Phase D resumable/TUS upload with cross-reload resume). Non-cloud smoke:
 *  - the tus-js-client CDN library loads and integrates with no page errors;
 *  - the pdf_upload_resume IndexedDB store round-trips in a real browser (the
 *    idb.js helpers are classic-script globals on window).
 * The actual large-file resumable upload + size-aware timeout need a signed-in
 * cloud session and a slow connection, so they are covered by the Node unit
 * tests (pdfUploadTimeoutMs, the resume store) + a manual large-file smoke.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('robust PDF upload', () => {
  test('tus-js-client loads and integrates with no page errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const tusInfo = await page.evaluate(() => ({
      defined: typeof window.tus !== 'undefined',
      upload: typeof (window.tus && window.tus.Upload),
      isSupported: !!(window.tus && window.tus.isSupported),
    }));
    expect(tusInfo.defined).toBe(true);
    expect(tusInfo.upload).toBe('function');
    expect(tusInfo.isSupported).toBe(true);
    // No error attributable to the tus integration (e.g. a failed CDN load or a
    // resumable-helper reference error). A pre-existing, unrelated boot-timing
    // race can log "App.hasAnyHighlights is not a function" before the feature
    // scripts register, so scope this assertion to tus/resumable rather than all.
    const tusErrors = errors.filter((e) => /tus|resumable|uploadPdf/i.test(e));
    expect(tusErrors).toEqual([]);
  });

  test('pdf_upload_resume IndexedDB store round-trips (real browser)', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const fp = 'spec-fp-' + Date.now();
      await window.idbPdfUploadResumePut({ urlStorageKey: fp + '::k1', fingerprint: fp, uploadUrl: 'https://example/1' });
      await window.idbPdfUploadResumePut({ urlStorageKey: fp + '::k2', fingerprint: fp, uploadUrl: 'https://example/2' });
      const afterPut = (await window.idbPdfUploadResumeGetByFingerprint(fp)).length;
      await window.idbPdfUploadResumeDelete(fp + '::k1');
      const afterDelete = (await window.idbPdfUploadResumeGetByFingerprint(fp)).length;
      await window.idbPdfUploadResumeDeleteByFingerprint(fp);
      const afterClear = (await window.idbPdfUploadResumeGetByFingerprint(fp)).length;
      return { afterPut, afterDelete, afterClear };
    });

    expect(result).toEqual({ afterPut: 2, afterDelete: 1, afterClear: 0 });
  });

  // --- T1-01 / J4: signed-out same-PDF re-upload re-applies backup marks ---
  // A DATA-ONLY backup (no PDF blob) never gets the boot restore prompt; the
  // hash-stamped record + the intake re-apply hook close that gap. The apply
  // is hash-verified: a different PDF must never receive the marks.

  /** Seed a data-only 'local' backup whose pdfHash matches /test-page.pdf. */
  async function seedDataOnlyBackup(page) {
    await page.evaluate(async () => {
      const buf = await (await fetch('/test-page.pdf')).arrayBuffer();
      const hash = await window.App.sha256Hex(buf);
      const data = {
        counters: [{ id: 'c1', name: 'WC', icon: 'M0 0h10v10H0z', color: '#e8c547' }],
        lineTypes: [],
        pageCanvases: [[{ id: 'cv1', name: 'Main', annotations: { counterMarkers: { c1: [{ x: 10, y: 10, id: 'm1' }] } } }]],
        pageScales: [null],
        pageRotations: [0],
      };
      await window.__takeoffBackupPutForTest('local', data, null, hash, Date.now(), 'sample-plan', null);
    });
  }

  test('signed-out same-PDF re-upload re-applies marks (hash-verified, backup consumed)', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await seedDataOnlyBackup(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Data-only backup: NO boot prompt (nothing to restore the PDF from)...
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    // ...but the palette pre-apply still ran.
    expect(await page.evaluate(() => window.state.counters.length)).toBe(1);

    // Re-upload the SAME PDF: the marker re-applies, the toast shows, and the
    // backup record is consumed.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForFunction(() => {
      try { return (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers.c1 || []).length === 1; } catch (_) { return false; }
    }, null, { timeout: 15000 });
    await expect(page.locator('#airboardToastText')).toHaveText('Restored your marks from the last session.');
    // Consumed-then-repopulated: the data-only record is deleted on apply and
    // the restored session's own dirty-debounce backup (marker + PDF blob)
    // takes its place — poll for that end state rather than racing the 1s
    // debounce.
    await page.waitForFunction(async () => {
      const local = await window.__takeoffBackupGetForTest('local', null);
      if (!local || !local.data) return false;
      let n = 0;
      (local.data.pageCanvases || []).forEach((cs) => (cs || []).forEach((c) => {
        Object.values((c.annotations && c.annotations.counterMarkers) || {}).forEach((a) => { n += (a || []).length; });
      }));
      return n === 1 && !!local.pdfBlob;
    }, null, { timeout: 15000 });
  });

  test('a different PDF never receives the backup marks (no apply, no toast)', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await seedDataOnlyBackup(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForFunction(() => window.state.pages.length === 2, null, { timeout: 15000 });
    const after = await page.evaluate(() => ({
      markup: window.App.projectHasAnyCanvasMarkup(),
      toastVisible: document.getElementById('airboardToastModal').classList.contains('visible'),
      toastText: document.getElementById('airboardToastText').textContent,
    }));
    expect(after.markup).toBe(false);
    expect(after.toastText).not.toBe('Restored your marks from the last session.');
    // (No "record not consumed" assertion: the new working session's own
    // dirty-debounce backup legitimately overwrites the data-only 'local'
    // record within ~1s of upload, which is indistinguishable from a delete.)
  });
});

// --- T1-08 / J2: append-upload never renames the open project ---
// Uploading a second PDF while pages are loaded (or a cloud project is open)
// appends the sheets WITHOUT clobbering state.currentProjectName, and toasts
// "Added N sheets to <project>". Fresh uploads into an empty session still
// take the first file's name. The pending-canvas-load decline-path rename
// (features/pdf-intake.js matchPendingCanvasLoad) needs cloud fixtures and is
// guarded by code review, not staged here.
test.describe('append never renames the open project', () => {
  /** Upload test-2pages.pdf into an empty session and wait for its 2 pages. */
  async function freshUploadTwoPages(page) {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.waitForFunction(() => window.state.pages.length === 2, null, { timeout: 15000 });
  }

  test('fresh upload still names the project from the first file (control)', async ({ page }) => {
    await freshUploadTwoPages(page);
    expect(await page.evaluate(() => window.state.currentProjectName)).toBe('test-2pages');
  });

  test('second upload keeps the project name and toasts "Added 1 sheet"', async ({ page }) => {
    await freshUploadTwoPages(page);
    await page.evaluate(() => { window.state.currentProjectName = 'Riverside Clinic Plumbing'; });

    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForFunction(() => window.state.pages.length === 3, null, { timeout: 15000 });
    expect(await page.evaluate(() => window.state.currentProjectName)).toBe('Riverside Clinic Plumbing');
    // Assert promptly — the toast auto-hides at 3500 ms (the text node persists,
    // but the visible-state check below would not). Content only, not styling,
    // so T2-15's non-blocking-corner rework won't break this.
    await expect(page.locator('#airboardToastText')).toHaveText('Added 1 sheet to Riverside Clinic Plumbing');
  });

  test('upload into an open cloud project (stubbed id) never renames it', async ({ page }) => {
    await freshUploadTwoPages(page);
    await page.evaluate(() => {
      window.state.currentProjectId = 'spec-proj-1';
      window.state.currentProjectName = 'Riverside Clinic Plumbing';
    });

    // No Project-Settings flag, so this routes through handleFreshUpload —
    // the verified worse-than-stated case (autosave would push the wrong name).
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForFunction(() => window.state.pages.length === 3, null, { timeout: 15000 });
    const after = await page.evaluate(() => ({
      id: window.state.currentProjectId,
      name: window.state.currentProjectName,
    }));
    expect(after.id).toBe('spec-proj-1');
    expect(after.name).toBe('Riverside Clinic Plumbing');
  });
});

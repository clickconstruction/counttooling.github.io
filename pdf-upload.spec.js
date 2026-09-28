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
const { bootApp, collectConsoleErrors, reloadApp, uploadPdf } = require('./spec-helpers');
const path = require('path');

test.describe('robust PDF upload', () => {
  test('tus-js-client loads and integrates with no page errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await bootApp(page);

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
    await bootApp(page);

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
    await bootApp(page);
    await seedDataOnlyBackup(page);
    await reloadApp(page);

    // Data-only backup: NO boot prompt (nothing to restore the PDF from)...
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    // ...but the palette pre-apply still ran.
    expect(await page.evaluate(() => window.state.counters.length)).toBe(1);

    // Re-upload the SAME PDF: the marker re-applies, the toast shows, and the
    // backup record is consumed.
    await uploadPdf(page, 'test-page.pdf', { waitForPages: false });
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
    await bootApp(page);
    await seedDataOnlyBackup(page);
    await reloadApp(page);

    await uploadPdf(page, 'test-2pages.pdf', { waitForPages: false });
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

// --- Tier-3 B2 / J2 friction #7: corrupt-PDF fresh upload says something ---
// A corrupt/unreadable file on the FRESH upload path used to die as a silent
// unhandled promise rejection (no dialog, no toast, pages stayed 0) while the
// append path alerted. handleFreshUpload now catches the pdf.js parse failure,
// rolls this upload back, and toasts the J2-verified copy.
test.describe('corrupt-PDF fresh upload feedback', () => {
  test('fresh corrupt upload toasts and leaves the session empty (no silent rejection)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    // The deliberate console.error('[Upload PDF]', ...) diagnostic is allowed;
    // anything else on the console error channel is a regression.
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/\[Upload PDF\]/.test(m.text())) consoleErrors.push(m.text());
    });

    await bootApp(page);
    await page.locator('#pdfInput').setInputFiles({
      name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('this is not a pdf'),
    });
    await expect(page.locator('#airboardToastText'))
      .toHaveText('"broken.pdf" didn’t open as a PDF. Try re-exporting it.');
    const after = await page.evaluate(() => ({
      pages: window.state.pages.length,
      inputCleared: document.getElementById('pdfInput').value === '',
    }));
    expect(after.pages).toBe(0);
    expect(after.inputCleared).toBe(true);
    // The whole point of the fix: the failure surfaces as a toast, not as an
    // unhandled rejection (Playwright reports those as pageerror).
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
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
    await bootApp(page);
    await uploadPdf(page);
    await page.waitForFunction(() => window.state.pages.length === 2, null, { timeout: 15000 });
  }

  test('fresh upload still names the project from the first file (control)', async ({ page }) => {
    await freshUploadTwoPages(page);
    expect(await page.evaluate(() => window.state.currentProjectName)).toBe('test-2pages');
  });

  test('second upload keeps the project name and toasts "Added 1 sheet"', async ({ page }) => {
    await freshUploadTwoPages(page);
    await page.evaluate(() => { window.state.currentProjectName = 'Riverside Clinic Plumbing'; });

    await uploadPdf(page, 'test-page.pdf', { waitForPages: false });
    await page.waitForFunction(() => window.state.pages.length === 3, null, { timeout: 15000 });
    expect(await page.evaluate(() => window.state.currentProjectName)).toBe('Riverside Clinic Plumbing');
    // Assert promptly — the toast auto-hides at 3500 ms (the text node persists,
    // but the visible-state check below would not). Content only, not styling,
    // so T2-15's non-blocking-corner rework won't break this.
    await expect(page.locator('#airboardToastText')).toHaveText('Added 1 sheet to Riverside Clinic Plumbing');
  });

  test('corrupt append upload rolls back and toasts — no pages added, name kept', async ({ page }) => {
    // Tier-3 B2 / J2 friction #7: the second-upload (append) route through
    // handleFreshUpload must also survive a corrupt file: pages roll back to
    // the pre-upload count and the toast says so.
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await freshUploadTwoPages(page);
    await page.locator('#pdfInput').setInputFiles({
      name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('this is not a pdf'),
    });
    await expect(page.locator('#airboardToastText'))
      .toHaveText('"broken.pdf" didn’t open as a PDF. Try re-exporting it. No pages were added.');
    const after = await page.evaluate(() => ({
      pages: window.state.pages.length,
      name: window.state.currentProjectName,
      hasBuffer: !!window.state.pdfBuffer,
    }));
    expect(after.pages).toBe(2);
    expect(after.name).toBe('test-2pages');
    expect(after.hasBuffer).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test('upload into an open cloud project (stubbed id) never renames it', async ({ page }) => {
    await freshUploadTwoPages(page);
    await page.evaluate(() => {
      window.state.currentProjectId = 'spec-proj-1';
      window.state.currentProjectName = 'Riverside Clinic Plumbing';
    });

    // No Project-Settings flag, so this routes through handleFreshUpload —
    // the verified worse-than-stated case (autosave would push the wrong name).
    await uploadPdf(page, 'test-page.pdf', { waitForPages: false });
    await page.waitForFunction(() => window.state.pages.length === 3, null, { timeout: 15000 });
    const after = await page.evaluate(() => ({
      id: window.state.currentProjectId,
      name: window.state.currentProjectName,
    }));
    expect(after.id).toBe('spec-proj-1');
    expect(after.name).toBe('Riverside Clinic Plumbing');
  });
});

// ---- Tier-3 B16: cold start — drag-and-drop + the empty-canvas hint (J1) ----
test.describe('cold start (Tier-3 B16)', () => {
  test('empty canvas shows the quiet hint; it hides once a plan loads', async ({ page }) => {
    await bootApp(page);
    await expect(page.locator('#canvasEmptyHint')).toBeVisible();
    await expect(page.locator('#canvasEmptyHint')).toContainText('Drop a plan here');
    await uploadPdf(page, 'test-page.pdf');
    await expect(page.locator('#canvasEmptyHint')).toBeHidden();
  });

  test('dropping a PDF anywhere on the app loads it through the normal intake', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await page.evaluate(async () => {
      const buf = await (await fetch('/test-page.pdf')).arrayBuffer();
      const file = new File([buf], 'dropped-plan.pdf', { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    // Same intake as Upload PDF: the project is named after the file.
    expect(await page.evaluate(() => window.state.currentProjectName)).toBe('dropped-plan');
    expect(await page.evaluate(() => window.state.pages.length)).toBe(1);
    errors.assertNoErrors();
  });

  test('a non-PDF drop is refused with a toast — and never navigates the app away', async ({ page }) => {
    await bootApp(page);
    const prevented = await page.evaluate(() => {
      const file = new File(['not a pdf'], 'notes.txt', { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const ev = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true });
      window.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(true);   // the browser default (navigate to the file) is blocked
    await expect(page.locator('#airboardToastText')).toHaveText('Drop a PDF plan to open it.');
    expect(await page.evaluate(() => window.state.pages.length)).toBe(0);
  });

  test('a drop while a dialog is open is ignored (no second intake mid-flow)', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(async () => {
      window.App.showModal('settingsModal');
      const buf = await (await fetch('/test-page.pdf')).arrayBuffer();
      const dt = new DataTransfer();
      dt.items.add(new File([buf], 'dropped-plan.pdf', { type: 'application/pdf' }));
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.state.pages.length)).toBe(0);
  });
});

// ---- B15b: signed-out 3+ sheet uploads get the trim step (⚑ resolved) ----
test.describe('signed-out trim step (B15b)', () => {
  test('a 3-sheet signed-out fresh upload opens Trim your set; committing Open lands the pages', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    // Two files, 3 pages total — over the >=3 gate.
    await page.locator('#pdfInput').setInputFiles([
      path.join(__dirname, 'test-2pages.pdf'),
      path.join(__dirname, 'test-page.pdf'),
    ]);
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 10000 });
    await expect(page.locator('#preparePdfTitle')).toHaveText('Trim your set');
    await expect(page.locator('#preparePdfSaveAndOpen')).toBeHidden();
    // The pages moved INTO the modal; the session under it is clean.
    expect(await page.evaluate(() => window.state.pages.length)).toBe(0);
    await expect(page.locator('#preparePdfGridStatus')).toHaveText('Keeping 3 of 3 sheets');
    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 10000 });
    await page.waitForFunction(() => window.state.pages.length === 3, null, { timeout: 15000 });
    errors.assertNoErrors();
  });

  test('a 2-sheet signed-out upload still goes straight in — no modal on the small cold start', async ({ page }) => {
    await bootApp(page);
    await uploadPdf(page);
    expect(await page.evaluate(() => window.state.pages.length)).toBe(2);
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/);
  });
});

// R12: a cloud bid opened without its PDF waits in state.pendingCanvasLoad, and
// uploading the PDF hydrates it (pdf-intake.js matchPendingCanvasLoad), now through
// the shared intake. Its own copy dropped the layer each sheet was on, and merged the
// saved duct knobs over the LAST project's, so a knob this bid never set kept the last
// bid's value. The pending load is seeded as load-project.js leaves it.
test.describe('a canvas-only bid getting its PDF (R12)', () => {
  test('comes back on the layer each sheet was on, with its own duct knobs and rooms', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(() => {
      const s = window.state;
      // The last bid's, still in the session.
      s.ductSettings = { ...s.ductSettings, seamWastePct: 3, maxFlexFt: 9 };
      s.rooms = [{ id: 'old-room', name: 'Old Room' }];
      s.pendingCanvasLoad = {
        projectId: 'p-canvas-only', name: 'Canvas Only Bid', pdf_hash: null,
        data: {
          counters: [{ id: 'pc', name: 'Pending Counter', icon: '', color: '#4a9eff' }],
          lineTypes: [], groups: [],
          pages: [{ index: 0, label: 'P-101', scale: null, rotation: 0, canvases: [
            { id: 'cvMain', name: 'Main', annotations: {} },
            { id: 'cvRough', name: 'Rough-in', annotations: { counterMarkers: { pc: [{ x: 40, y: 40, id: 'm1' }] } } },
          ] }],
          activeCanvasIdByPage: { 0: 'cvRough', 7: 'cvGone' },
          ductSettings: { seamWastePct: 12 },
        },
      };
    });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForFunction(() => window.state.pendingCanvasLoad === null && window.state.pages.length > 0, null, { timeout: 10000 });
    const after = await page.evaluate(() => ({
      map: JSON.parse(JSON.stringify(window.state.activeCanvasIdByPage)),
      layer: window.App.getActiveCanvas(window.state.pages[0]).name,
      seam: window.state.ductSettings.seamWastePct,
      maxFlex: window.state.ductSettings.maxFlexFt,
      rooms: window.state.rooms.length,
    }));
    expect(after.map).toEqual({ 0: 'cvRough' });   // the sheet this PDF lacks is not kept
    expect(after.layer).toBe('Rough-in');
    expect(after.seam).toBe(12);
    expect(after.maxFlex).toBe(6);                 // the default, not the last bid's 9
    expect(after.rooms).toBe(0);
  });
});

// --- REAPPLY-DUCT (DECOMPOSITION_MAP S08, N12) ---
// A signed-out HVAC takeoff whose only marks are duct runs. The re-apply check
// used to carry its own list of what counts as a mark, and duct runs were not on
// it, so the same PDF uploaded again came back bare. It now asks
// annotation-model.js's one predicate, which walks makeAnnotations()'s keys.
test.describe('a takeoff of duct runs alone comes back (REAPPLY-DUCT)', () => {
  const ductRunsOnPage0 = (page) => page.evaluate(() => {
    const p = window.state.pages[0];
    return p ? (window.App.getActiveAnnotations(p).ductRuns || []).length : -1;
  });
  const ductRunsInBackup = (page, key) => page.evaluate(async (k) => {
    const rec = await window.__takeoffBackupGetForTest(k, null);
    let n = 0;
    ((rec && rec.data && rec.data.pageCanvases) || []).forEach((cs) => (cs || []).forEach((c) => { n += ((c && c.annotations && c.annotations.ductRuns) || []).length; }));
    return n;
  }, key);

  test('trace one duct run, close the project, upload the same PDF: the run is put back', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page, 'test-page.pdf');
    await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' }; });

    // One supply run through the real tool, and nothing else on the sheet.
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateW').fill('24');
    await page.locator('#ductCreateH').fill('12');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
    const wrapper = page.locator('#canvasWrapper');
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 150 } });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window.App.getActiveAnnotations(window.state.pages[0]).ductRuns || []).length === 1);
    expect(await page.evaluate(() => {
      const a = window.App.getActiveAnnotations(window.state.pages[0]);
      return Object.values(a.counterMarkers || {}).flat().length + a.quickLines.length + a.polylines.length + a.roomBoxes.length + a.notes.length + a.highlights.length;
    })).toBe(0);

    // The on-device backup writes the run.
    await expect.poll(() => ductRunsInBackup(page, 'local'), { timeout: 15000 }).toBe(1);

    // Close the project (a local-only takeoff asks first).
    const closing = page.evaluate(() => window.App.closeProject({ route: 'settings' }));
    await expect(page.locator('#confirmModal')).toHaveClass(/visible/);
    await page.locator('#confirmOk').click();
    expect(await closing).toBe(true);
    expect(await page.evaluate(() => window.state.pages.length)).toBe(0);
    expect(await ductRunsInBackup(page, 'local')).toBe(1);   // closing keeps the backup

    // The same PDF again: the run is re-applied. (Close folds the pages list, so
    // wait on the pages themselves.)
    await uploadPdf(page, 'test-page.pdf', { waitForPages: false });
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 15000 });
    await expect.poll(() => ductRunsOnPage0(page), { timeout: 15000 }).toBe(1);
    await expect(page.locator('#airboardToastText')).toHaveText('Restored your marks from the last session.');
    errors.assertNoErrors();
  });

  test('a data-only backup holding one duct run is re-applied on the same PDF after a reload', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(async () => {
      const buf = await (await fetch('/test-page.pdf')).arrayBuffer();
      const hash = await window.App.sha256Hex(buf);
      const run = { id: 'r1', name: 'Duct run 1', airside: 'supply', pressureClass: '1',
        vertices: [{ x: 100, y: 100 }, { x: 200, y: 100 }],
        segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }], sizeSteps: [] };
      const data = {
        counters: [], lineTypes: [],
        pageCanvases: [[{ id: 'cv1', name: 'Main', annotations: { ductRuns: [run] } }]],
        pageScales: [{ pixelsPerUnit: 12, unit: 'ft' }], pageRotations: [0],
      };
      await window.__takeoffBackupPutForTest('local', data, null, hash, Date.now(), 'hvac-bid', null);
    });
    await reloadApp(page);
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);

    await uploadPdf(page, 'test-page.pdf', { waitForPages: false });
    await expect.poll(() => ductRunsOnPage0(page), { timeout: 15000 }).toBe(1);
    await expect(page.locator('#airboardToastText')).toHaveText('Restored your marks from the last session.');
  });
});

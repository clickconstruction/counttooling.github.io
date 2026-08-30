// @ts-check
/**
 * Tests: the window.App registry pilot #22 - the Prepare PDF modal extracted to
 * features/prepare-pdf.js. Unlike the cloud modals this is a real, non-gated
 * end-to-end test: it uploads a 2-page PDF, opens the modal via the registry,
 * exercises page nav / rotate / delete, and commits.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Prepare PDF modal', () => {
  test('registry wired: App.openPreparePdfModal is a function', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => typeof window.App?.openPreparePdfModal)).toBe('function');
    expect(await page.evaluate(() => typeof window.closePreparePdfModal)).toBe('function');
  });

  test('opens via the registry, navigates/rotates/deletes a page, and commits', async ({ page }) => {
    const errors = [];
    // pdf.js logs a benign console error if the preview canvas gets a new
    // render() before the previous one finishes (rapid page nav in the test).
    // It is not an exception and the render recovers, so it is filtered out.
    const isBenignRenderRace = (t) => /multiple render\(\) operations/i.test(t || '');
    page.on('console', (msg) => { if (msg.type() === 'error' && !isBenignRenderRace(msg.text())) errors.push(msg.text()); });
    page.on('pageerror', (err) => { if (!isBenignRenderRace(err.message)) errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Load a 2-page PDF (the default upload renders pages directly).
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    const pagesBefore = await page.evaluate(() => window.state.pages.length);
    expect(pagesBefore).toBe(2);

    // Open the Prepare PDF modal via the registry (same args as the settings
    // "prepare/edit pages" entry that stays in app.js).
    await page.evaluate(() =>
      window.App.openPreparePdfModal(window.state.pages, window.state.pdfBuffer, window.state.currentProjectName || 'Untitled'),
    );
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 5000 });

    // T2-15: the sheet GRID is the default view; the single-sheet walk is the
    // per-tile zoom view. Enter it via the first tile's zoom button, then keep
    // every pre-grid assertion unchanged.
    await expect(page.locator('#preparePdfGridWrap')).toBeVisible();
    await expect(page.locator('#preparePdfSheetWrap')).toBeHidden();
    await expect(page.locator('#preparePdfGridStatus')).toHaveText('Keeping 2 of 2 sheets');
    await page.locator('.prepare-pdf-tile[data-orig-idx="0"] .prepare-pdf-tile-zoom').click();
    await expect(page.locator('#preparePdfSheetWrap')).toBeVisible();
    await expect(page.locator('#preparePdfGridWrap')).toBeHidden();

    const label = page.locator('#preparePdfPageLabel');
    await expect(label).toContainText('of 2');

    // Next -> page 2; rotate (must not throw); back to page 1. Small settles let
    // each async pdf.js preview render finish before the next nav.
    await page.locator('#preparePdfNext').click();
    await expect(label).toContainText('2');
    await page.waitForTimeout(200);
    await page.locator('#preparePdfRotate').click();
    await page.waitForTimeout(200);
    await page.locator('#preparePdfPrev').click();
    await page.waitForTimeout(200);

    // Delete a page -> the kept count drops to 1.
    await page.locator('#preparePdfDelete').click();
    await expect(label).toContainText('of 1');

    // Commit; the modal closes.
    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 5000 });

    // The committed project reflects the trimmed page set.
    await page.waitForTimeout(300);
    const pagesAfter = await page.evaluate(() => window.state.pages.length);
    expect(pagesAfter).toBe(1);

    expect(errors).toEqual([]);
  });

  test('rotating never moves the controls: fixed-height preview keeps Rotate in place', async ({ page }) => {
    // Field report (Wendi, 2026-08-13): the preview wrap's height tracked the
    // rendered canvas, so each portrait<->landscape rotate shoved the
    // Prev/Next and Delete/Rotate/Undo rows up and down under the pointer.
    // The wrap is now fixed-height (min(400px, 55vh)) with a contain-fit
    // canvas — the Rotate button must not move a pixel across rotations.
    const isBenignRenderRace = (t) => /multiple render\(\) operations/i.test(t || '');
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error' && !isBenignRenderRace(msg.text())) errors.push(msg.text()); });
    page.on('pageerror', (err) => { if (!isBenignRenderRace(err.message)) errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() =>
      window.App.openPreparePdfModal(window.state.pages, window.state.pdfBuffer, 'Stability'),
    );
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 5000 });
    // T2-15: enter the single-sheet zoom view from the default grid.
    await page.locator('.prepare-pdf-tile[data-orig-idx="0"] .prepare-pdf-tile-zoom').click();
    await expect(page.locator('#preparePdfSheetWrap')).toBeVisible();
    await page.waitForTimeout(300);

    // Park the mouse off the buttons before each measure: the row's
    // deliberate :hover transform (translateY(-1px)) would otherwise read as
    // a phantom 1px "shift" on whichever button the click left the pointer on.
    const rotateBox = async () => {
      await page.mouse.move(5, 5);
      await page.waitForTimeout(250);   // let the 0.2s hover transition settle back
      return await page.locator('#preparePdfRotate').boundingBox();
    };
    const wrapHeight = async () => page.evaluate(() =>
      Math.round(document.getElementById('preparePdfPreviewWrap').getBoundingClientRect().height));

    const y0 = (await rotateBox()).y;
    const h0 = await wrapHeight();
    for (let i = 1; i <= 4; i++) {   // full cycle: 90/180/270/360
      await page.locator('#preparePdfRotate').click();
      await page.waitForTimeout(300);
      expect((await rotateBox()).y).toBe(y0);
      expect(await wrapHeight()).toBe(h0);
    }
    // The canvas stays contained inside the fixed wrap at every rotation.
    const contained = await page.evaluate(() => {
      const c = document.getElementById('preparePdfCanvas').getBoundingClientRect();
      const w = document.getElementById('preparePdfPreviewWrap').getBoundingClientRect();
      return c.height <= w.height + 1 && c.width <= w.width + 1;
    });
    expect(contained).toBe(true);
    expect(errors).toEqual([]);
  });

  test('Download Trimmed PDF: builds the trimmed buffer and downloads with a sanitized name', async ({ page }) => {
    // Regression: sanitizeForFilename/downloadPdfBuffer are registered by
    // features/output.js, which loads AFTER features/prepare-pdf.js — the
    // handler must read them from App.* at call time, not capture them at load
    // (a load-time capture sees undefined and the click throws a TypeError).
    const errors = [];
    const isBenignRenderRace = (t) => /multiple render\(\) operations/i.test(t || '');
    page.on('console', (msg) => { if (msg.type() === 'error' && !isBenignRenderRace(msg.text())) errors.push(msg.text()); });
    page.on('pageerror', (err) => { if (!isBenignRenderRace(err.message)) errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // A default name that needs sanitizing (":", "/", spaces).
    await page.evaluate(() =>
      window.App.openPreparePdfModal(window.state.pages, window.state.pdfBuffer, 'Trim: Job/Site Plan'),
    );
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 5000 });
    // T2-15: Delete lives in the sheet (zoom) view — enter it from the grid.
    await page.locator('.prepare-pdf-tile[data-orig-idx="0"] .prepare-pdf-tile-zoom').click();
    await expect(page.locator('#preparePdfSheetWrap')).toBeVisible();
    const label = page.locator('#preparePdfPageLabel');
    await expect(label).toContainText('of 2');

    // Delete a page so the download exercises the buildTrimmedPdfBuffer path
    // (kept.length !== pages.length), not the buffer passthrough.
    await page.locator('#preparePdfDelete').click();
    await expect(label).toContainText('of 1');

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#preparePdfDownload').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Trim__Job_Site_Plan.pdf');

    // The modal stays open (download does not commit or close).
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });

  test('append-mode commit toasts "Added N sheets to <project>" (T1-08 / J2 friction #8)', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Open a 2-page project, then stage the append route the way
    // handleAppendPages does: new pages + buffer into the modal in append mode.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(async () => {
      const buf = await (await fetch('/test-page.pdf')).arrayBuffer();
      const pdf = await window.App.getPdfDocument(buf.slice(0)).promise;
      const newPages = [];
      for (let i = 0; i < pdf.numPages; i++) {
        newPages.push({ pdfPage: await pdf.getPage(i + 1), label: 'test-page.pdf', rotation: 0 });
      }
      window.App.openPreparePdfModal(newPages, buf, window.state.currentProjectName || 'Untitled', { mode: 'append' });
    });
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#preparePdfTitle')).toContainText('Add pages — test-2pages');

    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 10000 });
    await page.waitForFunction(() => window.state.pages.length === 3, null, { timeout: 15000 });
    // Name kept (append mode locks it) + the parity feedback toast.
    expect(await page.evaluate(() => window.state.currentProjectName)).toBe('test-2pages');
    await expect(page.locator('#airboardToastText')).toHaveText('Added 1 sheet to test-2pages');
  });

  // ---- T2-15: the thumbnail-grid trim (grid replaces the walk as default) ----

  // Opens the modal in fresh-project mode with a 3-page set (test-2pages.pdf +
  // test-page.pdf merged in the page) so the grid cases can trim a middle sheet.
  async function openThreePageGrid(page, name) {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async (nm) => {
      const a = await (await fetch('/test-2pages.pdf')).arrayBuffer();
      const b = await (await fetch('/test-page.pdf')).arrayBuffer();
      const merged = await window.App.mergePdfBuffers([a, b]);
      const pdf = await window.App.getPdfDocument(merged.slice(0)).promise;
      const pages = [];
      for (let i = 0; i < pdf.numPages; i++) {
        pages.push({ pdfPage: await pdf.getPage(i + 1), label: 'Sheet ' + (i + 1), rotation: 0 });
      }
      window.App.openPreparePdfModal(pages, merged, nm);
    }, name);
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#preparePdfGridWrap')).toBeVisible();
  }

  test('grid tap-to-drop trims the committed set', async ({ page }) => {
    const errors = [];
    const isBenignRenderRace = (t) => /multiple render\(\) operations/i.test(t || '');
    page.on('console', (msg) => { if (msg.type() === 'error' && !isBenignRenderRace(msg.text())) errors.push(msg.text()); });
    page.on('pageerror', (err) => { if (!isBenignRenderRace(err.message)) errors.push(err.message); });

    await openThreePageGrid(page, 'GridTrim');
    await expect(page.locator('.prepare-pdf-tile')).toHaveCount(3);
    const tile2 = page.locator('.prepare-pdf-tile[data-orig-idx="1"]');
    const status = page.locator('#preparePdfGridStatus');

    // Tap tile 2 → dropped; status tracks.
    await tile2.click();
    await expect(tile2).toHaveClass(/dropped/);
    await expect(status).toHaveText('Keeping 2 of 3 sheets');
    // Tap again → restored (tap-again IS the undo in the grid).
    await tile2.click();
    await expect(tile2).not.toHaveClass(/dropped/);
    await expect(status).toHaveText('Keeping 3 of 3 sheets');
    // Drop it once more and commit via Open.
    await tile2.click();
    await expect(status).toHaveText('Keeping 2 of 3 sheets');
    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 10000 });
    await page.waitForFunction(() => window.state.pages.length === 2, null, { timeout: 15000 });
    // Labels carried from the kept originals (sheet 2 was dropped).
    expect(await page.evaluate(() => window.state.pages.map((p) => p.label))).toEqual(['Sheet 1', 'Sheet 3']);
    expect(errors).toEqual([]);
  });

  test('Keep none disables commit until a sheet is kept', async ({ page }) => {
    await openThreePageGrid(page, 'KeepNone');
    await page.locator('#preparePdfKeepNone').click();
    await expect(page.locator('.prepare-pdf-tile.dropped')).toHaveCount(3);
    await expect(page.locator('#preparePdfGridStatus')).toHaveText('Keeping 0 of 3 sheets');
    await expect(page.locator('#preparePdfDone')).toBeDisabled();
    await expect(page.locator('#preparePdfSaveAndOpen')).toBeDisabled();
    await expect(page.locator('#preparePdfDownload')).toBeDisabled();
    // Tap one tile back → all commit routes re-enable.
    await page.locator('.prepare-pdf-tile[data-orig-idx="0"]').click();
    await expect(page.locator('#preparePdfGridStatus')).toHaveText('Keeping 1 of 3 sheets');
    await expect(page.locator('#preparePdfDone')).toBeEnabled();
    await expect(page.locator('#preparePdfSaveAndOpen')).toBeEnabled();
    await expect(page.locator('#preparePdfDownload')).toBeEnabled();
    // Keep all restores everything.
    await page.locator('#preparePdfKeepAll').click();
    await expect(page.locator('.prepare-pdf-tile.dropped')).toHaveCount(0);
    await expect(page.locator('#preparePdfGridStatus')).toHaveText('Keeping 3 of 3 sheets');
  });

  test('sheet-view edits round-trip to the grid (rename, rotate, delete)', async ({ page }) => {
    const errors = [];
    const isBenignRenderRace = (t) => /multiple render\(\) operations/i.test(t || '');
    page.on('console', (msg) => { if (msg.type() === 'error' && !isBenignRenderRace(msg.text())) errors.push(msg.text()); });
    page.on('pageerror', (err) => { if (!isBenignRenderRace(err.message)) errors.push(err.message); });

    await openThreePageGrid(page, 'RoundTrip');
    // Zoom into sheet 1, rename via the "> Page Name" tab, rotate once.
    await page.locator('.prepare-pdf-tile[data-orig-idx="0"] .prepare-pdf-tile-zoom').click();
    await expect(page.locator('#preparePdfSheetWrap')).toBeVisible();
    await page.locator('#preparePdfPageTab').click();
    await page.locator('#preparePdfName').fill('A-102');
    await page.locator('#preparePdfName').blur();   // commit the rename before the rotate repaints the field
    await page.locator('#preparePdfRotate').click();
    await page.waitForTimeout(200);
    // Back to the grid: the tile shows the new name (kept-indices + labels are shared state).
    await page.locator('#preparePdfBackToGrid').click();
    await expect(page.locator('#preparePdfGridWrap')).toBeVisible();
    await expect(page.locator('.prepare-pdf-tile[data-orig-idx="0"] .prepare-pdf-tile-label')).toHaveText('p1 · A-102');
    // Sheet-view Delete reflects in the grid as a dropped tile.
    await page.locator('.prepare-pdf-tile[data-orig-idx="0"] .prepare-pdf-tile-zoom').click();
    await page.locator('#preparePdfDelete').click();
    await page.locator('#preparePdfBackToGrid').click();
    await expect(page.locator('.prepare-pdf-tile[data-orig-idx="0"]')).toHaveClass(/dropped/);
    await expect(page.locator('#preparePdfGridStatus')).toHaveText('Keeping 2 of 3 sheets');
    expect(errors).toEqual([]);
  });

  test('thumbnails render lazily and cancel cleanly on close', async ({ page }) => {
    const errors = [];
    const isBenignRenderRace = (t) => /multiple render\(\) operations/i.test(t || '');
    page.on('console', (msg) => { if (msg.type() === 'error' && !isBenignRenderRace(msg.text())) errors.push(msg.text()); });
    page.on('pageerror', (err) => { if (!isBenignRenderRace(err.message)) errors.push(err.message); });

    await openThreePageGrid(page, 'LazyThumbs');
    // The first visible tile's placeholder is replaced by a jpeg dataURL thumb.
    await expect(page.locator('.prepare-pdf-tile[data-orig-idx="0"] img')).toHaveAttribute('src', /^data:image\/jpeg/, { timeout: 15000 });
    // Close mid-load (later tiles may still be queued): the generation token +
    // in-flight cancel must shut the pipeline down with no console errors.
    await page.locator('#preparePdfCancel').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('commit logs prepare_trim with total/kept/dropped/mode', async ({ page }) => {
    await openThreePageGrid(page, 'TrimTelemetry');
    await page.evaluate(() => {
      window.__uaCalls = [];
      window.App.logUserEvent = (...a) => window.__uaCalls.push(a);
    });
    await page.locator('.prepare-pdf-tile[data-orig-idx="1"]').click();
    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 10000 });
    await page.waitForFunction(() => window.state.pages.length === 2, null, { timeout: 15000 });
    const calls = await page.evaluate(() => window.__uaCalls.filter((c) => c[0] === 'prepare_trim'));
    expect(calls).toEqual([['prepare_trim', null, { total: 3, kept: 2, dropped: 1, mode: 'project' }]]);
  });
});

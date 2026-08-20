// @ts-check
/**
 * Tests: the Prepare PDF modal (features/prepare-pdf.js) — the window.App
 * registry pilot #22, now with the JOURNEY-MAP Tier-2 #26 thumbnail-grid trim.
 * The modal opens on a grid of every sheet (tap toggles keep/drop, bulk
 * keep-all/drop-all/invert, shift-click ranges); the single-sheet preview is
 * the zoom view reached per-cell. Undo is one step per user action and
 * Ctrl/Cmd+Z is captured by the modal. Real, non-gated end-to-end tests.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// pdf.js logs a benign console error if a canvas gets a new render() before
// the previous one finishes (rapid nav / lazy thumb queue in the tests). It is
// not an exception and the render recovers, so it is filtered out.
const isBenignRenderRace = (t) => /multiple render\(\) operations/i.test(t || '');
function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error' && !isBenignRenderRace(msg.text())) errors.push(msg.text()); });
  page.on('pageerror', (err) => { if (!isBenignRenderRace(err.message)) errors.push(err.message); });
  return errors;
}

async function openWith2Pages(page, name) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate((n) =>
    window.App.openPreparePdfModal(window.state.pages, window.state.pdfBuffer, n || window.state.currentProjectName || 'Untitled'),
    name,
  );
  await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 5000 });
}

test.describe('window.App registry pilot - Prepare PDF modal', () => {
  test('registry wired: App.openPreparePdfModal is a function', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => typeof window.App?.openPreparePdfModal)).toBe('function');
    expect(await page.evaluate(() => typeof window.closePreparePdfModal)).toBe('function');
  });

  test('grid is the DEFAULT view: all sheets shown, lazy thumbs render, tap toggles keep/drop, commit excludes dropped', async ({ page }) => {
    const errors = collectErrors(page);
    await openWith2Pages(page);

    // Grid view is the default; the single-sheet preview is hidden.
    await expect(page.locator('#preparePdfGridWrap')).toBeVisible();
    await expect(page.locator('#preparePdfPreviewWrap')).toBeHidden();
    await expect(page.locator('#preparePdfGrid .ppg-cell')).toHaveCount(2);
    await expect(page.locator('#preparePdfKeptCount')).toHaveText('2 of 2 kept');

    // Thumbnails are rasterised lazily (IntersectionObserver + queue) —
    // visible cells get a real canvas raster.
    const thumbsRendered = () => page.waitForFunction(() => {
      const cells = [...document.querySelectorAll('#preparePdfGrid .ppg-cell')];
      return cells.length > 0 && cells.every((c) => c.dataset.rendered === '1');
    }, null, { timeout: 15000 });
    await thumbsRendered();

    // Regression: close mid-life and reopen — the serial thumb pump must keep
    // draining the NEW generation's queue (a gen-captured pump loop exited
    // early on reopen and stranded every queued thumb unrendered).
    await page.evaluate(() => window.closePreparePdfModal());
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/);
    await page.evaluate(() =>
      window.App.openPreparePdfModal(window.state.pages, window.state.pdfBuffer, 'Untitled'),
    );
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 5000 });
    await thumbsRendered();

    // Tap sheet 1 -> dropped (visual state + count), tap again -> kept.
    const cell0 = page.locator('#preparePdfGrid .ppg-cell[data-idx="0"]');
    await cell0.click();
    await expect(cell0).toHaveClass(/ppg-dropped/);
    await expect(page.locator('#preparePdfKeptCount')).toHaveText('1 of 2 kept');
    await cell0.click();
    await expect(cell0).not.toHaveClass(/ppg-dropped/);
    await expect(page.locator('#preparePdfKeptCount')).toHaveText('2 of 2 kept');

    // Drop sheet 1 for real and commit: only the kept sheet survives.
    await cell0.click();
    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 10000 });
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 10000 });

    expect(errors).toEqual([]);
  });

  test('single-sheet zoom view: per-cell magnifier opens it, nav/rotate work, Drop toggles, back to grid', async ({ page }) => {
    const errors = collectErrors(page);
    await openWith2Pages(page);

    // Open sheet 2 in the zoom view via its magnifier button.
    await page.locator('#preparePdfGrid .ppg-cell[data-idx="1"] .ppg-zoom').click();
    await expect(page.locator('#preparePdfPreviewWrap')).toBeVisible();
    await expect(page.locator('#preparePdfGridWrap')).toBeHidden();
    const label = page.locator('#preparePdfPageLabel');
    await expect(label).toContainText('Page 2 of 2');

    // Prev -> sheet 1; rotate (must not throw); Next back to sheet 2. Small
    // settles let each async pdf.js preview render finish before the next nav.
    await page.locator('#preparePdfPrev').click();
    await expect(label).toContainText('Page 1 of 2');
    await page.waitForTimeout(200);
    await page.locator('#preparePdfRotate').click();
    await page.waitForTimeout(200);
    await page.locator('#preparePdfNext').click();
    await expect(label).toContainText('Page 2 of 2');
    await page.waitForTimeout(200);

    // Drop the shown sheet: it stays visible (DROPPED marker), the button
    // flips to Restore, and the grid reflects it on return.
    await expect(page.locator('#preparePdfDelete')).toHaveText('Drop');
    await page.locator('#preparePdfDelete').click();
    await expect(label).toContainText('DROPPED');
    await expect(page.locator('#preparePdfDelete')).toHaveText('Restore');
    await page.locator('#preparePdfBackToGrid').click();
    await expect(page.locator('#preparePdfGridWrap')).toBeVisible();
    await expect(page.locator('#preparePdfGrid .ppg-cell[data-idx="1"]')).toHaveClass(/ppg-dropped/);
    await expect(page.locator('#preparePdfKeptCount')).toHaveText('1 of 2 kept');

    // Commit keeps only sheet 1.
    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 10000 });
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 10000 });

    expect(errors).toEqual([]);
  });

  test('bulk trim on a 6-sheet set: shift-click range + Drop all/Invert, undo is ONE step per action, Ctrl+Z is modal-scoped', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    // Boot on a real project, then stage a fresh 6-page set into the modal the
    // way the settings "prepare/edit pages" entry does.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(async () => {
      const doc = await window.PDFLib.PDFDocument.create();
      for (let i = 0; i < 6; i++) doc.addPage([612, 792]);
      const bytes = await doc.save();
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const pdf = await window.App.getPdfDocument(buf.slice(0)).promise;
      const pages = [];
      for (let i = 0; i < pdf.numPages; i++) pages.push({ pdfPage: await pdf.getPage(i + 1), label: 'S' + (i + 1), rotation: 0 });
      window.App.openPreparePdfModal(pages, buf, 'BulkTrim');
    });
    await expect(page.locator('#preparePdfModal')).toHaveClass(/visible/, { timeout: 5000 });
    const count = page.locator('#preparePdfKeptCount');
    await expect(page.locator('#preparePdfGrid .ppg-cell')).toHaveCount(6);
    await expect(count).toHaveText('6 of 6 kept');

    // Drop sheet 2, then shift-click sheet 5: the whole 2..5 range drops in
    // ONE action.
    await page.locator('#preparePdfGrid .ppg-cell[data-idx="1"]').click();
    await expect(count).toHaveText('5 of 6 kept');
    await page.locator('#preparePdfGrid .ppg-cell[data-idx="4"]').click({ modifiers: ['Shift'] });
    await expect(count).toHaveText('2 of 6 kept');

    // Undo: one press per ACTION — the range restores in one, the single
    // toggle in another.
    await page.locator('#preparePdfGridUndo').click();
    await expect(count).toHaveText('5 of 6 kept');
    await page.locator('#preparePdfGridUndo').click();
    await expect(count).toHaveText('6 of 6 kept');
    await expect(page.locator('#preparePdfGridUndo')).toBeDisabled();

    // Drop all disables commit; one undo brings everything back.
    await page.locator('#preparePdfDropAll').click();
    await expect(count).toHaveText('0 of 6 kept');
    await expect(page.locator('#preparePdfDone')).toBeDisabled();
    await expect(page.locator('#preparePdfSaveAndOpen')).toBeDisabled();
    await page.locator('#preparePdfGridUndo').click();
    await expect(count).toHaveText('6 of 6 kept');
    await expect(page.locator('#preparePdfDone')).toBeEnabled();

    // Invert flips the whole set in one action.
    await page.locator('#preparePdfGrid .ppg-cell[data-idx="0"]').click();
    await page.locator('#preparePdfInvert').click();
    await expect(count).toHaveText('1 of 6 kept');
    expect(await page.evaluate(() =>
      document.querySelector('#preparePdfGrid .ppg-cell[data-idx="0"]').classList.contains('ppg-dropped'))).toBe(false);

    // Ctrl+Z undoes the MODAL action (not the app's annotation undo).
    await page.keyboard.press('Control+z');
    await expect(count).toHaveText('5 of 6 kept');
    await page.keyboard.press('Control+z');
    await expect(count).toHaveText('6 of 6 kept');

    // Keep-all is a no-op at full keep (no phantom undo entry).
    await expect(page.locator('#preparePdfGridUndo')).toBeDisabled();
    await page.locator('#preparePdfKeepAll').click();
    await expect(page.locator('#preparePdfGridUndo')).toBeDisabled();

    // Trim to a 2-sheet set (drop 1..4 as a range) and commit.
    await page.locator('#preparePdfGrid .ppg-cell[data-idx="1"]').click();
    await page.locator('#preparePdfGrid .ppg-cell[data-idx="4"]').click({ modifiers: ['Shift'] });
    await expect(count).toHaveText('2 of 6 kept');
    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 10000 });
    await page.waitForFunction(() => window.state.pages.length === 2, null, { timeout: 10000 });

    expect(errors).toEqual([]);
  });

  test('rotating never moves the controls: fixed-height preview keeps Rotate in place', async ({ page }) => {
    // Field report (Wendi, 2026-08-13): the preview wrap's height tracked the
    // rendered canvas, so each portrait<->landscape rotate shoved the
    // nav and Drop/Rotate/Undo rows up and down under the pointer.
    // The wrap is fixed-height (min(400px, 55vh)) with a contain-fit
    // canvas — the Rotate button must not move a pixel across rotations.
    const errors = collectErrors(page);
    await openWith2Pages(page, 'Stability');
    // The single-sheet zoom view hosts the rotate control now.
    await page.locator('#preparePdfGrid .ppg-cell[data-idx="0"] .ppg-zoom').click();
    await expect(page.locator('#preparePdfPreviewWrap')).toBeVisible();
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
    const errors = collectErrors(page);
    await openWith2Pages(page, 'Trim: Job/Site Plan');

    // Drop a sheet in the grid so the download exercises the
    // buildTrimmedPdfBuffer path (kept !== all), not the buffer passthrough.
    await page.locator('#preparePdfGrid .ppg-cell[data-idx="0"]').click();
    await expect(page.locator('#preparePdfKeptCount')).toHaveText('1 of 2 kept');

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
    // Append mode opens on the grid too.
    await expect(page.locator('#preparePdfGridWrap')).toBeVisible();

    await page.locator('#preparePdfDone').click();
    await expect(page.locator('#preparePdfModal')).not.toHaveClass(/visible/, { timeout: 10000 });
    await page.waitForFunction(() => window.state.pages.length === 3, null, { timeout: 15000 });
    // Name kept (append mode locks it) + the parity feedback toast.
    expect(await page.evaluate(() => window.state.currentProjectName)).toBe('test-2pages');
    await expect(page.locator('#airboardToastText')).toHaveText('Added 1 sheet to test-2pages');
  });
});

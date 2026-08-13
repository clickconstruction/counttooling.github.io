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
});

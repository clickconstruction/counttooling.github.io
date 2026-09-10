// @ts-check
/**
 * Bid basis (features/bid-basis.js + the Export PDFs preset in
 * features/export-pdfs.js): PipeTooling opens a view link with
 * `export=bid-basis&ref=<bid>`; the dialog opens preset to the sheets that
 * carry marks with the bid chip and the "Saves as" name; Download saves the
 * file under exactly that name, shows the Downloaded card, and posts the
 * manifest to the tab that opened this one.
 *
 * The get-view-project Edge Function is stubbed at the CONTEXT level (the
 * popup tab needs it too); the "signed URL" is the same-origin 2-page test
 * PDF. The opener is the marketing page at `/` — same origin, so it receives
 * the manifest through the localhost self-origin rule in
 * bid-basis-model.js bidBasisTargetOrigins.
 */
const { test, expect } = require('@playwright/test');

const TOKEN = 'spec-bid-basis-token';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Marks on page 0 only (a counter and a run); page 1 carries a note alone,
 * which must NOT select it for the bid basis. */
function projectPayload() {
  return {
    projectId: 'proj-bid-basis-spec',
    name: 'Livingston Steel Office TI',
    pdfHash: 'hash-bid-basis-spec',
    updatedAt: '2026-09-09T18:58:00Z',
    externalRef: 'b409',
    pdfSignedUrl: '/test-2pages.pdf',
    data: {
      counters: [{ id: 'c1', name: 'Water Closet', icon: 'M0 0h24v24H0z', color: '#e8c547' }],
      lineTypes: [{ id: 'lt1', name: '4" PVC Waste', color: '#47c88e' }],
      groups: [],
      rooms: [],
      pages: [{
        index: 0,
        scale: { pixelsPerUnit: 5, unit: 'ft' },
        rotation: 0,
        canvases: [{
          id: 'cv1',
          name: 'Main',
          annotations: {
            counterMarkers: { c1: [{ x: 100, y: 120, id: 'm1' }, { x: 140, y: 160, id: 'm2' }] },
            quickLines: [{ x1: 10, y1: 10, x2: 60, y2: 10, color: '#47c88e', id: 'q1', lineTypeId: 'lt1' }],
            polylines: [], highlights: [], notes: [{ x: 30, y: 30, w: 80, h: 40, text: 'RFI: check riser', id: 'n1' }], multiplyZones: [], scaleZones: [], roomBoxes: [],
            legend: null,
          },
        }],
      }, {
        index: 1,
        scale: null,
        rotation: 0,
        canvases: [{
          id: 'cv2',
          name: 'Main',
          annotations: {
            counterMarkers: {}, quickLines: [], polylines: [], highlights: [],
            notes: [{ x: 30, y: 30, w: 80, h: 40, text: 'note only', id: 'n2' }],
            multiplyZones: [], scaleZones: [], roomBoxes: [], legend: null,
          },
        }],
      }],
      activeCanvasIdByPage: { 0: 'cv1', 1: 'cv2' },
    },
  };
}

/** @param {import('@playwright/test').BrowserContext} context */
async function stubViewProject(context) {
  await context.route('**/functions/v1/get-view-project', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    await route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(projectPayload()) });
  });
  // The email gate remembers an allowed address per token; pre-seed it so the
  // boot goes straight to the plan (the gate itself is pinned by view-only.spec.js).
  await context.addInitScript((token) => {
    try { localStorage.setItem('view:allowed:' + token, 'estimator@clickplumbing.com'); } catch (_) {}
  }, TOKEN);
}

const FILENAME_RE = /^bid-basis_b409_livingston-steel-office-ti_\d{4}-\d{2}-\d{2}_\d{4}\.pdf$/;

test.describe('Bid basis export (PipeTooling handoff)', () => {
  test('the link opens Export PDFs preset to the marked sheets, names the file, and hands the manifest to the opener', async ({ context, page }) => {
    test.setTimeout(90000);
    await stubViewProject(context);
    const errors = [];
    // Opener = a same-origin page standing in for PipeTooling's Cover Letter tab.
    await page.goto('/');
    await page.evaluate(() => {
      // @ts-ignore
      window.__bidBasisMessages = [];
      // @ts-ignore
      window.addEventListener('message', (e) => { window.__bidBasisMessages.push({ origin: e.origin, data: e.data }); });
    });
    const popupPromise = page.waitForEvent('popup');
    await page.evaluate((token) => { window.open('/app/?t=' + token + '&export=bid-basis&ref=B409', '_blank'); }, TOKEN);
    const popup = await popupPromise;
    popup.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    popup.on('pageerror', (err) => { errors.push(err.message); });

    // 1. The plan loads as a viewer and the dialog opens on its own.
    await popup.waitForSelector('body.has-pdf', { timeout: 30000 });
    await popup.waitForSelector('#specificPagesModal.visible', { timeout: 15000 });
    await expect(popup.locator('#specificPagesBidBasisChip')).toBeVisible();
    await expect(popup.locator('#specificPagesBidBasisChip')).toHaveText('Bid basis · b409 · for PipeTooling');
    await expect(popup.locator('#specificPagesIntro')).toContainText('the 1 sheet that carry marks');

    // 2. Preset: page 0 (counter + run) in, page 1 (note only) out; report on,
    //    highlights off, notes on.
    const sel = await popup.evaluate(() => window.App.getSpecificPagesSelections());
    expect(sel.selections).toEqual({ 0: 'marked', 1: 'exclude' });
    expect(sel.preset).toMatchObject({ preset: 'bid-basis', ref: 'b409' });
    expect(sel.preset.filename).toMatch(FILENAME_RE);
    const toggles = await popup.evaluate(() => ({
      report: document.getElementById('specificPagesIncludeReport').checked,
      highlights: document.getElementById('specificPagesBundleHighlights').checked,
      notes: document.getElementById('specificPagesBundleNotes').checked,
    }));
    expect(toggles).toEqual({ report: true, highlights: false, notes: true });
    // The excluded no-marks card is dimmed and says why; the marked one counts.
    await expect(popup.locator('.specific-page-card').nth(1)).toHaveClass(/specific-page-no-marks/);
    await expect(popup.locator('.specific-page-card').nth(1).locator('.specific-page-marks')).toHaveText('no marks');
    await expect(popup.locator('.specific-page-card').nth(0).locator('.specific-page-marks')).toHaveText('3 marks');
    // The file name row promises the name the download will use.
    await expect(popup.locator('#specificPagesFilenameRow')).toBeVisible();
    const promised = (await popup.locator('#specificPagesFilename').textContent() || '').trim();
    expect(promised).toMatch(FILENAME_RE);

    // 3. "Only sheets with marks" is repeatable by hand: after All Marked Up it
    //    returns to the preset selection.
    await popup.locator('#specificPagesAllMarked').click();
    expect((await popup.evaluate(() => window.App.getSpecificPagesSelections())).selections).toEqual({ 0: 'marked', 1: 'marked' });
    await popup.locator('#specificPagesMarksOnly').click();
    expect((await popup.evaluate(() => window.App.getSpecificPagesSelections())).selections).toEqual({ 0: 'marked', 1: 'exclude' });

    // 4. Download: saved under the promised name, the Downloaded card shows it,
    //    and the opener received the manifest.
    const downloadPromise = popup.waitForEvent('download', { timeout: 60000 });
    await popup.locator('#specificPagesDownload').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(promised);
    await popup.waitForSelector('#bidBasisDoneModal.visible', { timeout: 30000 });
    await expect(popup.locator('#bidBasisDoneFilename')).toHaveText(promised);
    await expect(popup.locator('#bidBasisDoneRef')).toHaveText('b409');
    await expect(popup.locator('#bidBasisDoneSheets span')).toHaveCount(1);
    await expect(popup.locator('#bidBasisDoneSheets span').first()).toHaveText('Livingston Steel Office TI — p1');
    await expect(popup.locator('#bidBasisDoneStatus')).toContainText('PipeTooling has been told');
    await expect(popup.locator('#bidBasisDoneStatus')).not.toHaveClass(/bid-basis-done-status-warn/);
    await expect(popup.locator('#bidBasisDoneBack')).toHaveText('Back to PipeTooling');

    // The loaded notice went out first (before any download), with the last-saved time.
    const loaded = await page.evaluate(() => {
      // @ts-ignore
      return window.__bidBasisMessages.filter((m) => m.data && m.data.type === 'counttooling:bid-basis-loaded');
    });
    expect(loaded.length).toBeGreaterThanOrEqual(1);
    expect(loaded[0].data).toMatchObject({ version: 1, ref: 'b409', projectId: 'proj-bid-basis-spec', ctUpdatedAt: '2026-09-09T18:58:00Z', viewToken: TOKEN });
    const messages = await page.evaluate(() => {
      // @ts-ignore
      return window.__bidBasisMessages.filter((m) => m.data && m.data.type === 'counttooling:bid-basis-export');
    });
    expect(messages.length).toBeGreaterThanOrEqual(1);
    const m = messages[0].data;
    expect(m.version).toBe(1);
    expect(m.ref).toBe('b409');
    expect(m.filename).toBe(promised);
    expect(m.sheets).toEqual(['Livingston Steel Office TI — p1']);
    expect(m.sheetCount).toBe(1);
    expect(m.pageIndices).toEqual([0]);
    expect(m.markTotals).toEqual({ counters: 2, runs: 1 });
    expect(m.notesCount).toBe(1);
    expect(m.includeReport).toBe(true);
    expect(m.projectName).toBe('Livingston Steel Office TI');
    expect(m.projectId).toBe('proj-bid-basis-spec');
    expect(m.viewToken).toBe(TOKEN);
    expect(m.pdfHash).toBe('hash-bid-basis-spec');
    expect(m.ctUpdatedAt).toBe('2026-09-09T18:58:00Z');
    expect(typeof m.fileSizeBytes).toBe('number');
    expect(m.fileSizeBytes).toBeGreaterThan(1000);
    expect(m.canvasSnapshot).toMatchObject({ version: 1 });
    expect(m.canvasSnapshot.pages.length).toBe(2);
    expect(Object.keys(m.canvasSnapshot.pages[0].canvases[0].annotations.counterMarkers)).toEqual(['c1']);
    // Same manifest is kept on the app for the Downloaded card.
    const kept = await popup.evaluate(() => window.App.getLastBidBasisManifest());
    expect(kept.filename).toBe(promised);

    // 5. Copy puts the file name on the clipboard.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await popup.locator('#bidBasisDoneCopy').click();
    await expect(popup.locator('#bidBasisDoneCopy')).toHaveText('Copied');
    const clip = await popup.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(promised);

    // 6. Download again re-opens the dialog, still on the preset, with a fresh name.
    await popup.locator('#bidBasisDoneAgain').click();
    await popup.waitForSelector('#specificPagesModal.visible', { timeout: 5000 });
    await expect(popup.locator('#specificPagesBidBasisChip')).toBeVisible();
    expect((await popup.evaluate(() => window.App.getSpecificPagesSelections())).selections).toEqual({ 0: 'marked', 1: 'exclude' });

    const real = errors.filter((e) => !/Failed to load resource|net::|Failed to fetch|config\.local\.js/.test(e));
    expect(real).toEqual([]);
  });

  test('without the flag a view link opens the plan and leaves Export PDFs closed; the sidebar dialog has no chip', async ({ context, page }) => {
    await stubViewProject(context);
    await page.goto('/app/?t=' + TOKEN);
    await page.waitForSelector('body.has-pdf', { timeout: 30000 });
    await page.waitForFunction(() => window.App?.state?.isViewer === true, { timeout: 10000 });
    await page.waitForTimeout(500);
    await expect(page.locator('#specificPagesModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.App.getBidBasisContext())).toBeNull();
    await page.evaluate(() => window.App.openSpecificPagesModal());
    await page.waitForSelector('#specificPagesModal.visible', { timeout: 5000 });
    await expect(page.locator('#specificPagesBidBasisChip')).toBeHidden();
    await expect(page.locator('#specificPagesFilenameRow')).toBeHidden();
    await expect(page.locator('#specificPagesIntro')).toHaveText('Adjust marker and line sizes for the exported PDF:');
    // Plain dialog: every page starts marked-up (unchanged behaviour), and the
    // new bulk button narrows to the sheets with marks.
    expect((await page.evaluate(() => window.App.getSpecificPagesSelections())).selections).toEqual({ 0: 'marked', 1: 'marked' });
    await page.locator('#specificPagesMarksOnly').click();
    expect((await page.evaluate(() => window.App.getSpecificPagesSelections())).selections).toEqual({ 0: 'marked', 1: 'exclude' });
  });

  test('the flag on a non-view-link boot is ignored', async ({ page }) => {
    await page.goto('/app/?export=bid-basis&ref=b409');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.App.getBidBasisContext())).toBeNull();
    await expect(page.locator('#specificPagesModal')).not.toHaveClass(/visible/);
  });
});

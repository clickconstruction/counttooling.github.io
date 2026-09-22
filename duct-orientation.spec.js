// @ts-check
/**
 * Tests: the Flat / On edge orientation chip on duct runs (DUCT-PLAN.md unit
 * D12 — "Duct Follow-ups" canvas row 4).
 *
 * - A run is FLAT by default: the draft inherits 'flat', the committed run
 *   carries NO `orientation` key, and the sidebar row shows no tag — a flat
 *   run's saved shape is byte-identical to a pre-D12 run.
 * - The run context menu (right-click an empty stretch of run) gains the
 *   "Orientation: Flat | On edge" segment (#ductRunOrientationSegment); picking
 *   On edge writes `orientation: 'edge'`, the Bid Check's "Fits the roof" row
 *   re-evaluates on the spot (the larger side hangs: "Supply Main (on edge):
 *   24×12 + 2" wrap = 26" · plenum 24" ⚠"), the sidebar row tags "on edge";
 *   Flat deletes the key again and every surface reverts.
 * - The S-popover: the depth line (order 40) follows the draft's orientation
 *   and the inline toggle (order 41, #ductDraftOrientationSegment) flips it
 *   mid-trace ("14" deep · plenum 24" ✓" → "26" deep · plenum 24" ⚠"); round
 *   drafts get no toggle.
 * - Round trip: 'edge' rides the export payload → hydrate; a flat run's export
 *   JSON is identical before and after an edge → flat round trip.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Duct orientation chip (D12)', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
  });

  // Arm a 24×12 wrapped supply run named "Supply Main" through the real create modal.
  async function armMain(page) {
    await expect(page.locator('#ductBtn')).toBeVisible();
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateName').fill('Supply Main');
    await page.locator('#ductCreateW').fill('24');
    await page.locator('#ductCreateH').fill('12');
    await page.selectOption('#ductCreateLiner', 'wrap');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
  }
  // A straight leg across the canvas, committed with Enter.
  async function traceMain(page) {
    const wrapper = page.locator('#canvasWrapper');
    await armMain(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 150 } });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct);
  }
  // A page-sized room box with a 10' ceiling (the plenum = deck − 10').
  const seedRoomBox = (page) => page.evaluate(() => {
    const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
    (ann.roomBoxes = ann.roomBoxes || []).push({ x1: 0, y1: 0, x2: 5000, y2: 5000, heightFt: 10, roomId: null, id: 'box-1' });
    window.App.updateUI();
  });
  const setDeck = (page, ft) => page.evaluate((v) => { window.App.getDuctSettings().deckHeightFt = v; window.App.updateUI(); }, ft);
  const roofRow = (page) => page.evaluate(() => {
    const bc = window.App.getBidCheck();
    const r = bc.auto.find((x) => x.id === 'duct-fits-roof') || bc.manual.find((x) => x.id === 'duct-fits-roof');
    return { kind: r.kind, verdict: r.verdict, detail: r.detail };
  });
  const runJson = (page) => page.evaluate(() => JSON.stringify(window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0]));
  const exportRun = (page) => page.evaluate(() => {
    const data = JSON.parse(JSON.stringify(window.App.buildCanvasExportData()));
    return data.pages[0].canvases[0].annotations.ductRuns[0];
  });

  test('default flat: the draft inherits flat, the committed run has no orientation key, no sidebar tag, no key in the export payload', async ({ page }) => {
    await armMain(page);
    expect(await page.evaluate(() => window.state.drawingDuct.orientation)).toBe('flat');
    await page.locator('#canvasWrapper').click({ position: { x: 150, y: 150 } });
    await page.locator('#canvasWrapper').click({ position: { x: 300, y: 150 } });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct);
    const run = await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0]);
    expect(run.name).toBe('Supply Main');
    expect('orientation' in run).toBe(false);
    expect(await runJson(page)).not.toContain('orientation');
    await expect(page.locator('#ductList .duct-run-row')).toHaveCount(1);
    await expect(page.locator('#ductList .duct-orientation-tag')).toHaveCount(0);
    const exported = await exportRun(page);
    expect('orientation' in exported).toBe(false);
    expect(errors).toEqual([]);
  });

  test('context menu: the Orientation segment flips the roof row detail + verdict and the sidebar tag; Flat deletes the key', async ({ page }) => {
    await seedRoomBox(page);
    await setDeck(page, 12);   // 12' deck − 10' ceiling = 24" plenum
    await traceMain(page);
    const flatJson = await runJson(page);
    expect(await roofRow(page)).toEqual({ kind: 'auto', verdict: 'ok', detail: '24×12 + 2" wrap = 14" · plenum 24" ✓' });
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveText('8 unchecked');

    // Right-click an empty stretch of the run → the run menu with the segment.
    const wrapper = page.locator('#canvasWrapper');
    await wrapper.click({ position: { x: 225, y: 150 }, button: 'right' });
    const menu = page.locator('#ductFittingMenu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.tool-context-menu-heading')).toContainText('Supply Main · 24×12');
    const seg = menu.locator('#ductRunOrientationSegment');
    await expect(seg).toBeVisible();
    await expect(menu.locator('.duct-menu-segment-label')).toHaveText(['Orientation', 'Material', 'Airside']);   // D25 added the material and the airside
    await expect(seg.locator('button')).toHaveText(['Flat', 'On edge']);
    await expect(seg.locator('button[data-value="flat"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(seg.locator('button[data-value="edge"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(menu.getByRole('menuitem', { name: 'Delete run' })).toHaveCount(1);

    // On edge: the state lands in place (menu stays open), the key is written,
    // the roof row re-evaluates immediately — the larger side hangs.
    await seg.locator('button[data-value="edge"]').click();
    await expect(menu).toBeVisible();
    await expect(seg.locator('button[data-value="edge"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(seg.locator('button[data-value="flat"]')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].orientation)).toBe('edge');
    expect(await roofRow(page)).toEqual({ kind: 'auto', verdict: 'warn', detail: 'Supply Main (on edge): 24×12 + 2" wrap = 26" · plenum 24" ⚠' });
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveText('1 ⚠ · 8 unchecked');
    await expect(page.locator('#ductList .duct-run-row .duct-orientation-tag')).toHaveText('on edge');
    await page.click('#bidCheckSectionTitle');
    const row = page.locator('#bidCheckList .bid-check-row[data-row-id="duct-fits-roof"]');
    await expect(row).toHaveClass(/warn/);
    await expect(row.locator('.bid-check-detail')).toHaveText('Supply Main (on edge): 24×12 + 2" wrap = 26" · plenum 24" ⚠');
    // A taller deck: on edge still fits and the subject stays named.
    await setDeck(page, 12.5);
    expect(await roofRow(page)).toEqual({ kind: 'auto', verdict: 'ok', detail: 'Supply Main (on edge): 24×12 + 2" wrap = 26" · plenum 30" ✓' });
    await setDeck(page, 12);

    // (The Bid Check title click was an outside pointerdown — the menu closed.
    // Re-open it: the segment comes back with On edge pressed.)
    await expect(menu).toBeHidden();
    await wrapper.click({ position: { x: 225, y: 150 }, button: 'right' });
    await expect(menu).toBeVisible();
    await expect(seg.locator('button[data-value="edge"]')).toHaveAttribute('aria-pressed', 'true');
    // Flat again: the key is DELETED — the run is byte-identical to before.
    await seg.locator('button[data-value="flat"]').click();
    await expect(seg.locator('button[data-value="flat"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await runJson(page)).toBe(flatJson);
    expect(await roofRow(page)).toEqual({ kind: 'auto', verdict: 'ok', detail: '24×12 + 2" wrap = 14" · plenum 24" ✓' });
    await expect(page.locator('#ductList .duct-orientation-tag')).toHaveCount(0);
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveText('8 unchecked');
    // Escape closes the menu; the seam mirrors the chip.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await page.evaluate(() => window.App.setDuctRunOrientation(0, 'edge'));
    expect((await roofRow(page)).verdict).toBe('warn');
    await page.evaluate(() => window.App.setDuctRunOrientation(0, 'flat'));
    expect(await runJson(page)).toBe(flatJson);
    // Undo covers the toggle (one snapshot per flip).
    await page.evaluate(() => window.App.setDuctRunOrientation(0, 'edge'));
    await page.keyboard.press('Control+z');
    await expect.poll(() => runJson(page)).toBe(flatJson);
    expect(errors).toEqual([]);
  });

  test('a round run gets no orientation chip on its menu', async ({ page }) => {
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      ann.ductRuns = [window.makeDuctRun({
        id: 'run-r', name: 'Branch', airside: 'supply', pressureClass: '1',
        vertices: [{ x: 100, y: 100 }, { x: 500, y: 100 }],
        segments: [{ startVertexIdx: 0, size: { kind: 'round', d: 10 } }],
      })];
      window.App.reinferDuctFittings(0);
      window.App.updateUI();
    });
    expect(await page.evaluate(() => window.App.tryOpenDuctContextMenu({ type: 'ductRun', index: 0 }, 200, 200))).toBe(true);
    const menu = page.locator('#ductFittingMenu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('#ductRunOrientationSegment')).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Delete run' })).toHaveCount(1);
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('S-popover: the depth line follows the draft orientation; the inline toggle flips it mid-trace; round drafts get no toggle', async ({ page }) => {
    await seedRoomBox(page);
    await setDeck(page, 12);
    await armMain(page);
    await page.evaluate(() => window.App.commitDuctClick({ x: 100, y: 100 }));
    const depth = page.locator('#ductSizeSections .duct-popover-section[data-section-id="depth-line"] .duct-depth-line');
    const orient = page.locator('#ductSizeSections .duct-popover-section[data-section-id="orientation"]');
    const seg = orient.locator('#ductDraftOrientationSegment');

    await page.evaluate(() => window.App.openDuctSizePopover());
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    await expect(depth).toHaveText('14" deep · plenum 24" ✓');
    await expect(orient).toHaveCount(1);
    await expect(orient.locator('.duct-orientation-label')).toHaveText('Orientation');
    await expect(seg.locator('button')).toHaveText(['Flat', 'On edge']);
    await expect(seg.locator('button[data-value="flat"]')).toHaveAttribute('aria-pressed', 'true');
    // Section order: the toggle sits right under the depth line it drives.
    const ids = await page.locator('#ductSizeSections .duct-popover-section').evaluateAll((els) => els.map((e) => e.getAttribute('data-section-id')));
    expect(ids.indexOf('orientation')).toBe(ids.indexOf('depth-line') + 1);

    // Flip on edge: the depth line re-renders on the spot — the trace goes on.
    await seg.locator('button[data-value="edge"]').click();
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    await expect(depth).toHaveText('26" deep · plenum 24" ⚠');
    await expect(depth).toHaveClass(/warn/);
    await expect(page.locator('#ductDraftOrientationSegment button[data-value="edge"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.state.drawingDuct.orientation)).toBe('edge');
    expect(await page.evaluate(() => window.App.getDuctDraftDepthLine(window.App.getCurrentDuctSize(), window.state.drawingDuct))).toEqual({ ok: false, text: '26" deep · plenum 24" ⚠' });
    // Back to flat, then a round step: no toggle for round.
    await page.locator('#ductDraftOrientationSegment button[data-value="flat"]').click();
    await expect(depth).toHaveText('14" deep · plenum 24" ✓');
    await page.evaluate(() => window.App.closeDuctSizePopover());
    await page.evaluate(() => window.App.applyDuctSizeStep({ kind: 'round', d: 12 }));
    await page.evaluate(() => window.App.openDuctSizePopover());
    await expect(depth).toHaveText('14" deep · plenum 24" ✓');   // 12"Ø + 2" wrap
    await expect(orient).toHaveCount(0);
    await page.evaluate(() => window.App.closeDuctSizePopover());
    // Without deck + ceiling the toggle still shows (the orientation is the run's, not the check's).
    await page.evaluate(() => window.App.applyDuctSizeStep({ kind: 'rect', w: 24, h: 12 }));
    await setDeck(page, null);
    await page.evaluate(() => window.App.openDuctSizePopover());
    await expect(page.locator('#ductSizeSections .duct-popover-section[data-section-id="depth-line"]')).toHaveCount(0);
    await expect(orient).toHaveCount(1);
    await page.evaluate(() => window.App.closeDuctSizePopover());
    expect(await page.evaluate(() => !!window.state.drawingDuct)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('round trip: on edge set mid-trace commits, rides the export payload → hydrate, and the sidebar tag survives; edge → flat leaves the export JSON identical', async ({ page }) => {
    await seedRoomBox(page);
    await setDeck(page, 12);
    await armMain(page);
    await page.locator('#canvasWrapper').click({ position: { x: 150, y: 150 } });
    await page.evaluate(() => window.App.setDuctDraftOrientation('edge'));
    await page.locator('#canvasWrapper').click({ position: { x: 300, y: 150 } });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct);
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].orientation)).toBe('edge');
    await expect(page.locator('#ductList .duct-run-row .duct-orientation-tag')).toHaveText('on edge');
    expect((await roofRow(page)).detail).toBe('Supply Main (on edge): 24×12 + 2" wrap = 26" · plenum 24" ⚠');

    const data = await page.evaluate(() => JSON.parse(JSON.stringify(window.App.buildCanvasExportData())));
    expect(data.pages[0].canvases[0].annotations.ductRuns[0].orientation).toBe('edge');
    // Wipe the run, hydrate the payload back: 'edge' persists on every surface.
    await page.evaluate(() => { window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns = []; window.App.updateUI(); });
    await expect(page.locator('#ductSection')).toBeHidden();
    await page.evaluate((d) => window.App.hydrateStateFromProjectData(d), data);
    await page.evaluate(() => window.App.updateUI());
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].orientation)).toBe('edge');
    await expect(page.locator('#ductList .duct-run-row .duct-orientation-tag')).toHaveText('on edge');
    expect((await roofRow(page)).verdict).toBe('warn');

    // Edge → flat: the export JSON of the run is identical to a never-edged run.
    await page.evaluate(() => window.App.setDuctRunOrientation(0, 'flat'));
    const flatRun = await exportRun(page);
    expect('orientation' in flatRun).toBe(false);
    const reference = { ...data.pages[0].canvases[0].annotations.ductRuns[0] };
    delete reference.orientation;
    expect(JSON.stringify(flatRun)).toBe(JSON.stringify(reference));
    expect(errors).toEqual([]);
  });
});

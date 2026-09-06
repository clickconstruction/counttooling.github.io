// @ts-check
/**
 * Tests: auto duct fittings (DUCT-PLAN.md unit D3; live since D5).
 *
 * - Inference at commit: an L-shaped run logs one auto elbow90 at the corner
 *   (marker ink in the amber fitting color); an S-stepped run logs a
 *   transition sized to the larger side; a run started on an existing run
 *   logs a tap on the PARENT; shallow (<30°) bends log nothing while a 45°
 *   bend logs an elbow45.
 * - The #ductFittingMenu context menu: reclassify flips type + auto:false and
 *   SURVIVES re-inference (the reconciliation contract in duct-model.js §3b);
 *   Delete leaves a suppressed tombstone that re-inference cannot resurrect;
 *   Delete run removes the run and dissolves its fittings.
 * - hideMarks hides fitting markers AND their hitTest (T2-03: the invisible
 *   must not catch the mouse — right-click opens nothing).
 * - Escape dismisses the menu ONLY (tool-context-menu capture-phase rule,
 *   B1): a modal underneath stays up.
 * - App.getDuctFittingCounts tallies by type + size for D4/D5.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Duct auto fittings (D3)', () => {
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
      s.pages[s.currentPage].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
  });

  // Arm a supply run through the real create modal (duct-tool.spec recipe).
  async function armDuct(page, w = 24, h = 12) {
    await expect(page.locator('#ductBtn')).toBeVisible();
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateW').fill(String(w));
    await page.locator('#ductCreateH').fill(String(h));
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
  }

  // Trace an L: two axis-aligned legs with a 90° corner at (300, 150).
  async function traceL(page) {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 300 } });
    await page.keyboard.press('Enter');
  }

  const fittings = (page) => page.evaluate(() =>
    (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.ductFittings || [])
      .map((f) => ({ runId: f.runId, vertexIdx: f.vertexIdx, position: f.position, type: f.type, size: f.size, auto: f.auto, origin: f.origin, suppressed: !!f.suppressed })));

  const visibleFittings = async (page) => (await fittings(page)).filter((f) => !f.suppressed);

  test('an L-shaped run logs one auto elbow90 at the corner, painted amber', async ({ page }) => {
    await traceL(page);
    const fits = await visibleFittings(page);
    expect(fits.length).toBe(1);
    const run = await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0]);
    expect(fits[0]).toEqual({
      runId: run.id, vertexIdx: 1, position: null, type: 'elbow90',
      size: { kind: 'rect', w: 24, h: 12 }, auto: true, origin: 'bend', suppressed: false,
    });

    // Marker ink: an amber-ish pixel near the corner vertex (the run stroke
    // there is supply blue, the backing disc white — amber is the fitting's).
    const amberAtCorner = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
      const run2 = window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0];
      const p = window.App.toCanvas(run2.vertices[1]);
      const d = c.getContext('2d').getImageData(Math.round(p.x) - 14, Math.round(p.y) - 14, 28, 28).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0 && d[i] > 200 && d[i + 1] > 140 && d[i + 1] < 215 && d[i + 2] < 130) return true;
      }
      return false;
    });
    expect(amberAtCorner).toBe(true);

    expect(errors).toEqual([]);
  });

  test('an S-stepped straight run logs a transition sized to the larger side', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 150 } });
    await page.evaluate(() => { window.App.applyDuctSizeStep({ kind: 'rect', w: 20, h: 12 }); });
    await wrapper.click({ position: { x: 450, y: 150 } });
    await page.keyboard.press('Enter');

    const fits = await visibleFittings(page);
    expect(fits.length).toBe(1);
    expect(fits[0].type).toBe('transition');
    expect(fits[0].origin).toBe('step');
    expect(fits[0].vertexIdx).toBe(1);
    expect(fits[0].size).toEqual({ kind: 'rect', w: 24, h: 12 });   // the larger side
    expect(fits[0].auto).toBe(true);

    expect(errors).toEqual([]);
  });

  test('a run started on an existing run logs a tap on the PARENT at the child start size', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await traceL(page);

    // Child branch: first click lands ON the parent's first leg.
    await armDuct(page, 10, 8);
    await wrapper.click({ position: { x: 225, y: 150 } });
    await wrapper.click({ position: { x: 225, y: 280 } });
    await page.keyboard.press('Enter');

    const runs = await page.evaluate(() =>
      window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns.map((r) => r.id));
    const fits = await visibleFittings(page);
    const taps = fits.filter((f) => f.type === 'tap');
    expect(taps.length).toBe(1);
    expect(taps[0].runId).toBe(runs[0]);                          // on the PARENT
    expect(taps[0].size).toEqual({ kind: 'rect', w: 10, h: 8 });  // the child's starting size
    expect(taps[0].auto).toBe(true);
    expect(taps[0].position).not.toBeNull();
    // The parent's elbow is still there — the walk is additive across runs.
    expect(fits.filter((f) => f.type === 'elbow90').length).toBe(1);

    expect(errors).toEqual([]);
  });

  test('shallow (<30°) bends log nothing; a 45° bend logs an elbow45', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    // ~11° wiggle: no fitting.
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 150 } });
    await wrapper.click({ position: { x: 450, y: 180 } });
    await page.keyboard.press('Enter');
    expect((await visibleFittings(page)).length).toBe(0);

    // 45° bend on a second run, placed clear of the first (no accidental tap).
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 320 } });
    await wrapper.click({ position: { x: 250, y: 320 } });
    await wrapper.click({ position: { x: 350, y: 420 } });
    await page.keyboard.press('Enter');
    const fits = await visibleFittings(page);
    expect(fits.length).toBe(1);
    expect(fits[0].type).toBe('elbow45');
    expect(fits[0].auto).toBe(true);

    expect(errors).toEqual([]);
  });

  test('reclassify via the context menu flips type + auto:false and survives re-inference', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await traceL(page);

    await wrapper.click({ position: { x: 300, y: 150 }, button: 'right' });
    const menu = page.locator('#ductFittingMenu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.tool-context-menu-heading')).toContainText('90° elbow · 24×12 · auto');
    await menu.getByRole('menuitem', { name: '45° elbow' }).click();
    await expect(menu).toBeHidden();

    let fits = await visibleFittings(page);
    expect(fits.length).toBe(1);
    expect(fits[0].type).toBe('elbow45');
    expect(fits[0].auto).toBe(false);

    // A later edit re-runs the walk — commit another run AND re-walk
    // explicitly: the human's call survives, no duplicate appears.
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 350 } });
    await wrapper.click({ position: { x: 300, y: 350 } });
    await page.keyboard.press('Enter');
    await page.evaluate(() => window.App.reinferDuctFittings());
    fits = await visibleFittings(page);
    expect(fits.length).toBe(1);
    expect(fits[0].type).toBe('elbow45');
    expect(fits[0].auto).toBe(false);

    expect(errors).toEqual([]);
  });

  test('Delete fitting tombstones it — re-inference cannot resurrect', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await traceL(page);
    expect((await visibleFittings(page)).length).toBe(1);

    await wrapper.click({ position: { x: 300, y: 150 }, button: 'right' });
    const menu = page.locator('#ductFittingMenu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Delete fitting' }).click();
    await expect(menu).toBeHidden();

    expect((await visibleFittings(page)).length).toBe(0);
    expect(await page.evaluate(() => window.App.getDuctFittingCounts())).toEqual([]);
    // The walk keeps it dead (suppressed non-auto tombstone by anchor).
    await page.evaluate(() => window.App.reinferDuctFittings());
    expect((await visibleFittings(page)).length).toBe(0);
    // A right-click at the old marker now hits the RUN, not the fitting.
    await wrapper.click({ position: { x: 300, y: 150 }, button: 'right' });
    await expect(menu).toBeVisible();
    await expect(menu.locator('.tool-context-menu-heading')).toContainText('Duct run 1');

    expect(errors).toEqual([]);
  });

  test('right-click on an empty stretch of run opens the run menu; Delete run dissolves its fittings', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await traceL(page);

    await wrapper.click({ position: { x: 225, y: 150 }, button: 'right' });
    const menu = page.locator('#ductFittingMenu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.tool-context-menu-heading')).toContainText('Duct run 1 · 24×12');
    await menu.getByRole('menuitem', { name: 'Delete run' }).click();
    await expect(menu).toBeHidden();

    const st = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      return { runs: ann.ductRuns.length, fittings: ann.ductFittings.length };
    });
    expect(st).toEqual({ runs: 0, fittings: 0 });

    expect(errors).toEqual([]);
  });

  test('hideMarks hides fitting markers AND their hitTest', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await traceL(page);

    await page.locator('#hideMarksBtn').click();
    await page.waitForFunction(() => window.state.hideMarks === true);
    // The invisible marker must not catch the mouse: no menu opens.
    await wrapper.click({ position: { x: 300, y: 150 }, button: 'right' });
    await expect(page.locator('#ductFittingMenu')).toBeHidden();
    // The overlay paints nothing at all (T2-03).
    const overlayHasInk = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) return true; }
      return false;
    });
    expect(overlayHasInk).toBe(false);

    // Marks back on: the same right-click opens the fitting menu again.
    await page.locator('#hideMarksBtn').click();
    await page.waitForFunction(() => window.state.hideMarks === false);
    await wrapper.click({ position: { x: 300, y: 150 }, button: 'right' });
    await expect(page.locator('#ductFittingMenu')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Escape dismisses the fitting menu ONLY (capture-phase, B1 rule)', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await traceL(page);

    await wrapper.click({ position: { x: 300, y: 150 }, button: 'right' });
    const menu = page.locator('#ductFittingMenu');
    await expect(menu).toBeVisible();
    // Put a modal under the menu: one Escape must close the menu and leave
    // the modal up (stopImmediatePropagation in the capture phase — the
    // app's global Escape handler never sees the press).
    await page.evaluate(() => { window.App.showModal('ductCreateModal'); });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.evaluate(() => window.App.hideModal('ductCreateModal'));

    // Outside click dismisses too (the pointerdown capture listener).
    await wrapper.click({ position: { x: 300, y: 150 }, button: 'right' });
    await expect(menu).toBeVisible();
    await page.locator('#pdfCanvas').click({ position: { x: 500, y: 500 }, force: true });
    await expect(menu).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('getDuctFittingCounts tallies by type + size (page and project scope)', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await traceL(page);                 // elbow90 24×12
    await armDuct(page, 20, 12);        // second run, stepped: transition
    await wrapper.click({ position: { x: 150, y: 400 } });
    await wrapper.click({ position: { x: 300, y: 400 } });
    await page.evaluate(() => { window.App.applyDuctSizeStep({ kind: 'rect', w: 16, h: 10 }); });
    await wrapper.click({ position: { x: 450, y: 400 } });
    await page.keyboard.press('Enter');

    const counts = await page.evaluate(() => window.App.getDuctFittingCounts());
    expect(counts).toEqual([
      { type: 'elbow90', sizeKey: '24×12', count: 1 },
      { type: 'transition', sizeKey: '20×12', count: 1 },
    ]);
    // Page scope: page 0 carries everything, page 1 nothing.
    expect(await page.evaluate(() => window.App.getDuctFittingCounts(0))).toHaveLength(2);
    expect(await page.evaluate(() => window.App.getDuctFittingCounts(1))).toEqual([]);

    expect(errors).toEqual([]);
  });
});

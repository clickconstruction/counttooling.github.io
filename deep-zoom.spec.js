// @ts-check
/**
 * DEEP-ZOOM (journeys/plans/DEEP-ZOOM.md): zoom past 1200%.
 *
 * Part 1, the overlay window: past the canvas budget the page overlay (#annCanvas) is
 * clamped as soft as the PDF base, so its marks read as blur beside the crisp tiles.
 * #annWindowCanvas is the visible area at full density, painted by the same painter with
 * toCanvas rebound (app.js renderAnnotationWindow). Part 2, the ceiling: getMaxZoom() is
 * the project's ceiling under the device's (12 on a small canvas cap or a low-memory
 * Chromium, else 50, then the layout wall over the sheet's longest side), and the Zoom
 * Settings slider follows it without ever lowering the project's own setting. Part 3,
 * the backdrop: past 4x the full-page buffer is held to 24 Mpx.
 *
 * Headless Chromium runs at dpr 1, so the deficit here comes from part 3's cap: at 3000%
 * on the 1224 x 792 pt restaurant sheet the base is clamped to about a sixth of the
 * screen's density. The seeded run is 8 px wide so a probe at its centre reads solid; the
 * sharp-versus-soft proof is that the SAME screen distance from the run's centre is still
 * ink on the page overlay and clear on the window. The page overlay is read where the run
 * leaves the window, since under the window its box is cleared (the window alone shows there).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, collectConsoleErrors, uploadPdf } = require('./spec-helpers');

const LINE_RGB = [71, 200, 142];                            // #47c88e, the seeded run's colour
const RUN = { x1: 500, y1: 400, x2: 560, y2: 400 };         // a 60 pt horizontal run near the sheet's centre
const MID = { x: (RUN.x1 + RUN.x2) / 2, y: RUN.y1 };
const EDGE = { x: RUN.x1 + 2, y: RUN.y1 };                   // on the run, 1500 px left of the viewport at 3000%: outside the window
const DEEP = 30;                                            // 3000%

async function seed(page) {
  await page.evaluate((L) => {
    const st = window.state, App = window.App;
    st.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
    st.lineTypes = [{ id: 'waste', name: 'Waste', color: '#47c88e', curveStyle: 'straight' }];
    st.counters = [{ id: 'wc', name: 'Water Closet', icon: '', color: '#e8c547' }];
    st.lineTypeSettings = Object.assign({}, st.lineTypeSettings, { lineSize: 8, opacity: 1 });
    const ann = App.getActiveAnnotations(st.pages[0]);
    ann.quickLines = [{ x1: L.x1, y1: L.y1, x2: L.x2, y2: L.y2, id: 'q1', lineTypeId: 'waste', color: '#47c88e' }];
    ann.counterMarkers = { wc: [{ x: L.x1 - 20, y: L.y1 - 20, id: 'm1' }] };
    App.updateUI();
  }, RUN);
}

// Zoom to `zoom` with the run's midpoint at the viewport's centre, then wait for the exact
// render to land (the window's k is 1 once lastRenderedZoom is the zoom asked for).
async function zoomTo(page, zoom) {
  await page.evaluate(({ zoom, mid }) => {
    const st = window.state, App = window.App;
    st.maxZoom = 50;
    const wrap = document.getElementById('canvasWrapper').getBoundingClientRect();
    st.zoom = zoom;
    st.pan = { x: wrap.width / 2 - mid.x * zoom, y: wrap.height / 2 - mid.y * zoom };
    App.renderPdf();
  }, { zoom, mid: MID });
  await page.waitForFunction((zoom) => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
    const box = window.App.__annWindow();
    return !!c && c.width > 0 && Math.abs(window.state.zoom - zoom) < 1e-9 && !!box && Math.abs(box.k - 1) < 1e-9;
  }, zoom, { timeout: 30000 });
  await page.waitForTimeout(300);
}

// One probe of both canvases at the run's midpoint, in each canvas's own buffer units.
const probe = (page) => page.evaluate(({ mid, edge }) => {
  const App = window.App, st = window.state;
  const box = App.__annWindow();
  const win = /** @type {HTMLCanvasElement} */ (document.getElementById('annWindowCanvas'));
  const base = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
  const pdfC = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
  const wrap = document.getElementById('canvasWrapper').getBoundingClientRect();
  const px = (canvas, x, y) => Array.from(canvas.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data);
  const effDpr = base.width / parseFloat(base.style.width);           // the page overlay's buffer px per CSS px
  const wx = mid.x * st.zoom * box.dpr - box.x0 * box.k * box.dpr;     // the midpoint in the window's buffer
  const wy = mid.y * st.zoom * box.dpr - box.y0 * box.k * box.dpr;
  const bx = mid.x * st.zoom * effDpr, by = mid.y * st.zoom * effDpr;  // and in the page overlay's (k is 1)
  const ex = edge.x * st.zoom * effDpr, ey = edge.y * st.zoom * effDpr;  // the run outside the window, page overlay units
  const dCss = 3 / effDpr;                                             // 3 page-overlay buffer px, in CSS px
  return {
    visible: win.style.display !== 'none' && win.width > 0,
    box, effDpr, winDensity: box.bw / (box.w * box.k),
    coversWrapper: Math.abs(box.w * box.k - wrap.width) <= 1 && Math.abs(box.h * box.k - wrap.height) <= 1,
    winCentre: px(win, wx, wy), winNear: px(win, wx, wy - 2), winSameCssAway: px(win, wx, wy - dCss * box.dpr),
    baseUnderWindow: px(base, bx, by), baseOutside: px(base, ex, ey), baseOutsideThreeAway: px(base, ex, ey - 3),
    baseArea: pdfC.width * pdfC.height, overlayArea: base.width * base.height,
    safety: App.__getRenderAreaSafety(),
  };
}, { mid: MID, edge: EDGE });

const isInk = (p) => p[3] === 255 && Math.abs(p[0] - LINE_RGB[0]) <= 8 && Math.abs(p[1] - LINE_RGB[1]) <= 8 && Math.abs(p[2] - LINE_RGB[2]) <= 8;

test.describe('DEEP-ZOOM: zoom past 1200%', () => {
  test('the overlay window is sharp at 3000% while the page overlay is soft; pans re-cut it; the backdrop is budgeted', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page, 'samples/sample-plan-advanced.pdf');
    await seed(page);

    // At fit zoom the page overlay is sharp enough: no window.
    const atFit = await page.evaluate(() => {
      const win = /** @type {HTMLCanvasElement} */ (document.getElementById('annWindowCanvas'));
      return { hidden: win.style.display === 'none' || win.width === 0, box: window.App.__annWindow() };
    });
    expect(atFit.hidden).toBe(true);
    expect(atFit.box).toBeNull();

    await zoomTo(page, DEEP);
    const deep = await probe(page);
    expect(deep.visible).toBe(true);
    expect(deep.coversWrapper).toBe(true);
    expect(deep.winDensity).toBeCloseTo(deep.box.dpr, 2);               // the window is one screen of pixels at full density
    expect(deep.effDpr).toBeLessThan(0.4);                                // the page overlay is clamped well under it
    expect(deep.baseArea).toBeLessThanOrEqual(24e6);                      // part 3: the full-page backdrop budget past 4x
    expect(deep.overlayArea).toBeLessThanOrEqual(24e6);
    expect(isInk(deep.winCentre)).toBe(true);                             // the window paints the run where the offset math says
    expect(isInk(deep.winNear)).toBe(true);
    expect(deep.winSameCssAway[3]).toBe(0);                               // ...and its edge is a few DEVICE px away
    expect(deep.baseUnderWindow[3]).toBe(0);                              // under the window the page overlay is cleared: no halo
    expect(isInk(deep.baseOutside)).toBe(true);                           // outside it the page overlay still has the run
    expect(isInk(deep.baseOutsideThreeAway)).toBe(true);                  // ...and the same screen distance is still ink there: soft

    // Twenty real drag pans (Move) re-cut the window at every mouse-up, land it where the
    // pan went, and never trip the blank-canvas ratchet.
    await page.keyboard.press('m');
    const wrap = await page.locator('#canvasWrapper').boundingBox();
    if (!wrap) throw new Error('no canvas wrapper');
    const cx = wrap.x + wrap.width / 2, cy = wrap.y + wrap.height / 2;
    for (let i = 0; i < 20; i++) {
      const dx = i % 2 === 0 ? 40 : -40;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + dx / 2, cy + 3);
      await page.mouse.move(cx + dx, cy + 6);
      await page.mouse.up();
      const after = await page.evaluate(() => {
        const box = window.App.__annWindow();
        return { x0: box ? box.x0 : null, expectX0: Math.max(0, -window.state.pan.x), k: box ? box.k : null };
      });
      expect(after.k).toBe(1);
      expect(Math.abs(after.x0 - after.expectX0)).toBeLessThanOrEqual(0.5);   // cut where the pan left the view
    }
    const panned = await page.evaluate(() => ({
      blank: JSON.stringify(window.App.getSaveStatusLog ? window.App.getSaveStatusLog() : []).includes('canvas_render_blank'),
    }));
    expect(panned.blank).toBe(false);
    const afterPans = await probe(page);
    expect(afterPans.safety).toBe(0.5);                                   // the ratchet never fired
    expect(isInk(afterPans.winCentre)).toBe(true);                        // the run is where the window says it is
    expect(afterPans.winSameCssAway[3]).toBe(0);

    // Hide marks clears the window too.
    await page.evaluate(() => { window.state.hideMarks = true; window.App.renderAnnotations(); });
    const hidden = await probe(page);
    expect(hidden.winCentre[3]).toBe(0);
    await page.evaluate(() => { window.state.hideMarks = false; window.App.renderAnnotations(); });
    expect(isInk((await probe(page)).winCentre)).toBe(true);

    // Back at 100% the window retires.
    await page.evaluate(() => { window.state.zoom = 1; window.state.pan = { x: 0, y: 0 }; window.App.renderPdf(); });
    await page.waitForFunction(() => window.App.__annWindow() === null && Math.abs(window.state.zoom - 1) < 1e-9, null, { timeout: 20000 });
    const atOne = await page.evaluate(() => {
      const win = /** @type {HTMLCanvasElement} */ (document.getElementById('annWindowCanvas'));
      return win.style.display === 'none' || win.width === 0;
    });
    expect(atOne).toBe(true);

    errors.assertNoErrors();
  });

  test('the ceiling: the project under the device, the layout wall, and a Zoom Settings slider that never lowers the project', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page, 'samples/sample-plan-advanced.pdf');

    const ceilings = await page.evaluate(() => {
      const App = window.App, st = window.state;
      const lowMemory = navigator.deviceMemory != null && navigator.deviceMemory < 4;
      st.maxZoom = 50;
      App.setCanvasCaps({ maxDim: 100000, maxArea: 300e6 });
      const big = App.getMaxZoom();                                   // 50 on a capable device
      const pg = st.pages[st.currentPage];
      pg.pdfPage.getViewport = () => ({ width: 400000, height: 100 });   // a sheet past Firefox's wall: 16e6 / 400000
      const wall = App.getMaxZoom();
      delete pg.pdfPage.getViewport;
      App.setCanvasCaps({ maxDim: 8192, maxArea: 10e6 });               // a small canvas cap (an iOS Safari probe)
      const small = App.getMaxZoom();
      st.maxZoom = 8;
      const project = App.getMaxZoom();                               // the project's own 800% under the device's
      st.maxZoom = 30;
      return { lowMemory, big, wall, small, project };
    });
    const capable = ceilings.lowMemory ? 12 : 50;
    expect(ceilings.big).toBe(capable);
    expect(ceilings.wall).toBe(Math.min(capable, 40));
    expect(ceilings.small).toBe(12);
    expect(ceilings.project).toBe(8);

    // Zoom Settings on the small-cap device, the project at 3000%: the slider runs to 1200 and
    // shows 1200 with the hint; Done without moving it leaves the project's 3000% alone.
    await page.evaluate(() => window.App.showZoomModal());
    await expect(page.locator('#zoomModal')).toBeVisible();
    expect(await page.locator('#zoomMax').getAttribute('max')).toBe('1200');
    expect(await page.locator('#zoomMax').inputValue()).toBe('1200');
    await expect(page.locator('#zoomMaxHint')).toBeVisible();
    await expect(page.locator('#zoomMaxHint')).toContainText('1200%');
    await expect(page.locator('#zoomMaxHint')).toContainText('3000%');
    await page.locator('#zoomModalClose').click();
    await expect(page.locator('#zoomModal')).toBeHidden();
    expect(await page.evaluate(() => window.state.maxZoom)).toBe(30);

    // A moved slider writes the project's ceiling as before.
    await page.evaluate(() => window.App.showZoomModal());
    await page.evaluate(() => { const m = /** @type {HTMLInputElement} */ (document.getElementById('zoomMax')); m.value = '800'; m.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#zoomModalClose').click();
    expect(await page.evaluate(() => window.state.maxZoom)).toBe(8);

    // A capable device runs the slider to its ceiling, with no hint.
    await page.evaluate(() => { window.App.setCanvasCaps({ maxDim: 100000, maxArea: 300e6 }); window.App.showZoomModal(); });
    expect(await page.locator('#zoomMax').getAttribute('max')).toBe(String(capable * 100));
    if (!ceilings.lowMemory) await expect(page.locator('#zoomMaxHint')).toBeHidden();
    await page.locator('#zoomModalClose').click();

    // The rail's ticks reach the new ceiling (the three past 1200 appear only when it allows).
    if (!ceilings.lowMemory) {
      await page.evaluate(() => { window.state.maxZoom = 50; });
      await page.locator('#zoomPct').click();
      await expect(page.locator('#zoomRail')).toBeVisible();
      expect(await page.locator('#zoomRailTicks .zoom-rail-tick').count()).toBe(14);
      await expect(page.locator('#zoomRailTicks .zoom-rail-tick-label', { hasText: '2000%' })).toHaveCount(1);
      await page.keyboard.press('Escape');
    }

    errors.assertNoErrors();
  });
});

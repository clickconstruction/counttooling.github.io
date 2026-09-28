// @ts-check
/**
 * MEASURE-BAND (punch row, from the 2026-09-27 decomposition map's N08): on a desktop,
 * Measure's dashed band did not follow the mouse between the first click and the second.
 * renderAnnotationsInner drew the band from the first point to state.mousePos, but the
 * mousemove handler's re-render gate (app.js, "Canvas mouse, wheel & touch handlers") had
 * no Measure branch, so nothing repainted until the second click. The mobile loupe never
 * had the fault (its aim path re-renders itself).
 *
 * The pin reads the live overlay's pixels: after one Measure click and a mouse move, the
 * middle of the segment between the two points carries the band's yellow. Before the fix
 * that stretch is blank (the only paint was at the click, a zero-length band at A).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, uploadPdf, collectConsoleErrors } = require('./spec-helpers');

test('Measure: the dashed band follows the mouse after the first click (MEASURE-BAND)', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await bootApp(page);
  await uploadPdf(page);

  // Measure needs a page scale: the first preset.
  await page.evaluate(() => window.App.openScaleModal());
  await page.locator('#scalePresetsList button').first().click();
  await page.waitForFunction(() => !!window.state.pages[window.state.currentPage].scale);

  await page.locator('#measureBtn').click();
  expect(await page.evaluate(() => window.state.tool === window.App.TOOL.MEASURE)).toBe(true);

  // First point a quarter of the way across the page, the mouse three quarters across: client
  // points from the page geometry, since the letter-size test sheet does not fill the wrapper.
  const box = await page.locator('#canvasWrapper').boundingBox();
  if (!box) throw new Error('no canvas wrapper');
  const pts = await page.evaluate(() => {
    const p = window.state.pages[window.state.currentPage];
    const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
    const z = window.state.zoom, pan = window.state.pan;
    const y = (vp.height / 2) * z + pan.y;
    return [{ x: vp.width * 0.25 * z + pan.x, y }, { x: vp.width * 0.75 * z + pan.x, y }];
  });
  const a = { x: box.x + pts[0].x, y: box.y + pts[0].y };
  const b = { x: box.x + pts[1].x, y: box.y + pts[1].y };
  await page.mouse.click(a.x, a.y);
  await page.waitForFunction(() => window.state.scaleMode === window.App.SCALE_MODES.POINT_B && !!window.state.scalePointA);
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.waitForTimeout(150);

  // The band's yellow (#e8c547) somewhere in the middle third of A to B, on the live overlay.
  const hit = await page.evaluate(([a, b]) => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
    const r = c.getBoundingClientRect();
    const kx = c.width / r.width, ky = c.height / r.height;
    const d = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).getImageData(0, 0, c.width, c.height).data;
    let yellow = 0;
    for (let t = 0.33; t <= 0.67; t += 0.01) {
      const cx = Math.round((a.x + (b.x - a.x) * t - r.left) * kx);
      const cy = Math.round((a.y + (b.y - a.y) * t - r.top) * ky);
      for (let dy = -2; dy <= 2; dy++) {
        const i = ((cy + dy) * c.width + cx) * 4;
        if (d[i + 3] > 0 && d[i] > 200 && d[i + 1] > 160 && d[i + 2] < 120) yellow++;
      }
    }
    return yellow;
  }, [a, b]);
  expect(hit).toBeGreaterThan(0);

  // The second click still finishes the measure the way it did.
  await page.mouse.click(b.x, b.y);
  await page.waitForFunction(() => window.state.tool === window.App.TOOL.NONE && !window.state.scalePointA);
  await expect(page.locator('#toastRegion')).toContainText('Distance:');
  errors.assertNoErrors();
});

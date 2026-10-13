// @ts-check
/**
 * RUBBER-BAND-CAPS (2026-10-12, Wendy): a dashed rubber band with two bare ends says
 * "somewhere around here". The Quick Line, Chain and Polyline previews now end in a short
 * solid tick across the line at both ends (app.js, the live overlay's drawBandCap): the
 * entry point, which nothing marks once the mouse has left it, and the cursor end, which
 * the dashes may stop a gap short of. The dash pattern itself stays anchored at the entry
 * point; it is never fitted to the length.
 *
 * The pin reads the live overlay's pixels: after one click and a mouse move, the pixels
 * 3 CSS px either side of a horizontal band carry the line's colour at the entry point and
 * at the cursor, and do NOT in the middle of the band (a tick, not a thicker line). On the
 * old app.js the end samples are blank: the band is two pixels wide and nothing crosses it.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, uploadPdf, collectConsoleErrors } = require('./spec-helpers');

const COLOR = '#e01010';

async function seed(page) {
  await page.evaluate((color) => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1\'' };
    s.zoom = 1; s.pan = { x: 60, y: 40 };
    s.lineTypes = [{ id: 'cw', name: 'Cold water', color, curveStyle: 'straight' }];
    s.activeLineTypeId = 'cw';
    s.tool = window.App.TOOL.NONE;
    window.App.hideModal && window.App.hideModal('airboardToastModal');
    window.App.renderPdf();
    window.App.updateUI();
  }, COLOR);
}

/** Client point for a sheet (PDF) point, from the page's own geometry. */
async function clientPt(page, pdf) {
  const box = await page.locator('#canvasWrapper').boundingBox();
  if (!box) throw new Error('no canvas wrapper');
  const p = await page.evaluate((pdf) => {
    const z = window.state.zoom, pan = window.state.pan;
    return { x: pdf.x * z + pan.x, y: pdf.y * z + pan.y };
  }, pdf);
  return { x: box.x + p.x, y: box.y + p.y };
}

/** How many of the 3x3 overlay pixels around (client + dx, dy CSS px) carry the line's red. */
async function redAt(page, client, dx, dy) {
  return page.evaluate(([pt, dx, dy]) => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
    const r = c.getBoundingClientRect();
    const kx = c.width / r.width, ky = c.height / r.height;
    const cx = Math.round((pt.x + dx - r.left) * kx), cy = Math.round((pt.y + dy - r.top) * ky);
    const d = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).getImageData(cx - 1, cy - 1, 3, 3).data;
    let hits = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] > 150 && d[i + 1] < 90 && d[i + 2] < 90) hits++;
    return hits;
  }, [client, dx, dy]);
}

/** Both ends of a horizontal band carry a tick (red above and below the line); its middle does not. */
async function expectTicks(page, a, b) {
  const mid = { x: (a.x + b.x) / 2, y: a.y };
  expect(await redAt(page, a, 0, 3)).toBeGreaterThan(0);
  expect(await redAt(page, a, 0, -3)).toBeGreaterThan(0);
  expect(await redAt(page, b, 0, 3)).toBeGreaterThan(0);
  expect(await redAt(page, b, 0, -3)).toBeGreaterThan(0);
  expect(await redAt(page, mid, 0, 3)).toBe(0);
  expect(await redAt(page, mid, 0, -3)).toBe(0);
}

test.describe('RUBBER-BAND-CAPS: the rubber band ends on a solid mark at both ends', () => {
  test('Quick Line: a tick at the entry point and at the cursor, none mid-band; the second click still commits', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    await seed(page);

    await page.evaluate(() => document.getElementById('quickLine').click());
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.LINE)).toBe(true);

    const a = await clientPt(page, { x: 100, y: 120 });
    const b = await clientPt(page, { x: 300, y: 120 });
    await page.mouse.click(a.x, a.y);
    await page.waitForFunction(() => !!window.state.quickLineStart);
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.waitForTimeout(150);
    await expectTicks(page, a, b);

    await page.mouse.click(b.x, b.y);
    await page.waitForFunction(() => !window.state.quickLineStart);
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0], 0).quickLines.length)).toBe(1);
    errors.assertNoErrors();
  });

  test('Polyline: a tick at the first point and at the cursor end, none mid-leg', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    await seed(page);

    await page.evaluate(() => document.getElementById('polylineBtn').click());
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.POLYLINE)).toBe(true);

    const a = await clientPt(page, { x: 100, y: 160 });
    const m = await clientPt(page, { x: 200, y: 160 });
    const b = await clientPt(page, { x: 300, y: 160 });
    await page.mouse.click(a.x, a.y);
    await page.waitForFunction(() => !!window.state.drawingPolyline && window.state.drawingPolyline.points.length === 1);
    await page.mouse.click(m.x, m.y);
    await page.waitForFunction(() => window.state.drawingPolyline.points.length === 2);
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.waitForTimeout(150);
    await expectTicks(page, a, b);
    // The fixed middle vertex carries no tick: only the two ends do.
    expect(await redAt(page, m, 0, 3)).toBe(0);
    errors.assertNoErrors();
  });
});

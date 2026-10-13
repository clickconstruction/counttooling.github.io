// @ts-check
/**
 * LABEL-SLIDE (2026-10-12, Wendi: "need ability to move length labels so they can be
 * legible when they overlap"). Right-click a line whose length shows, "Move label", and
 * the label slides along the line under the pointer, projected onto its nearest point;
 * the next click drops it, Esc puts it back, "Reset label" sends it home. The seat is
 * line.labelT, a fraction of the line's length (features/mark-context-menu.js owns the
 * rows and the slide; canvas-draw.js walks the seat; app.js's pointer handlers and the
 * Esc ladder call the hooks).
 *
 * The pins read state (labelT) and the live overlay's pixels: the label's white box is
 * at the new seat and no longer at the midpoint.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, uploadPdf, collectConsoleErrors } = require('./spec-helpers');

const COLOR = '#e01010';

async function seed(page, kind) {
  await page.evaluate(([color, kind]) => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1\'' };
    s.zoom = 1; s.pan = { x: 60, y: 40 };
    s.lineTypes = [{ id: 'cw', name: 'Cold water', color, curveStyle: 'straight' }];
    s.activeLineTypeId = 'cw';
    s.tool = window.App.TOOL.NONE;
    const ann = window.App.getActiveCanvas(s.pages[0]).annotations;
    if (kind === 'poly') ann.polylines.push({ id: 'p1', lineTypeId: 'cw', color, showLength: true, points: [{ x: 100, y: 160 }, { x: 300, y: 160 }, { x: 300, y: 360 }] });
    else ann.quickLines.push({ id: 'q1', lineTypeId: 'cw', color, showLength: true, x1: 100, y1: 120, x2: 300, y2: 120 });
    window.App.hideModal && window.App.hideModal('airboardToastModal');
    window.App.renderPdf();
    window.App.updateUI();
  }, [COLOR, kind]);
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

/** The line's seat as the app holds it (undefined until a label has been moved). */
const labelT = (page, kind) => page.evaluate((kind) => {
  const ann = window.App.getActiveCanvas(window.state.pages[0]).annotations;
  return (kind === 'poly' ? ann.polylines[0] : ann.quickLines[0]).labelT;
}, kind);

/**
 * How many overlay pixels in a 7x3 patch 8 CSS px above (client + dy) are the label's
 * white box: inside the box, clear of the text. 0 where no label sits.
 */
async function whiteAt(page, client, dy = -8) {
  return page.evaluate(([pt, dy]) => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
    const r = c.getBoundingClientRect();
    const kx = c.width / r.width, ky = c.height / r.height;
    const cx = Math.round((pt.x - r.left) * kx), cy = Math.round((pt.y + dy - r.top) * ky);
    const d = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).getImageData(cx - 3, cy - 1, 7, 3).data;
    let hits = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 150 && d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) hits++;
    return hits;
  }, [client, dy]);
}

test.describe('LABEL-SLIDE: a length label slides along its line', () => {
  test('Move label slides the quick line\'s label to the projected seat; the click drops it; undo, redo and Reset label', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    await seed(page, 'quick');

    const mid = await clientPt(page, { x: 200, y: 120 });
    const seat = await clientPt(page, { x: 250, y: 120 });
    expect(await whiteAt(page, mid)).toBeGreaterThan(0);     // the label sits at the midpoint
    expect(await whiteAt(page, seat)).toBe(0);

    // Right-click the label: the line's menu, with Move label and no Reset label yet.
    await page.mouse.click(mid.x, mid.y, { button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#ctxMoveLabel')).toBeVisible();
    await expect(page.locator('#ctxResetLabel')).toBeHidden();
    await page.locator('#ctxMoveLabel').click();
    await expect(page.locator('#contextMenu')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => !!window.state.movingLabel)).toBe(true);

    // The pointer 40 pt below the line, three quarters along: the label projects onto the line.
    const below = await clientPt(page, { x: 250, y: 160 });
    await page.mouse.move(below.x, below.y, { steps: 6 });
    await page.waitForTimeout(100);
    expect(Math.abs((await labelT(page, 'quick')) - 0.75)).toBeLessThan(0.02);
    expect(await whiteAt(page, seat)).toBeGreaterThan(0);
    expect(await whiteAt(page, mid)).toBe(0);

    // The click drops it and nothing else happens on the sheet.
    await page.mouse.click(below.x, below.y);
    expect(await page.evaluate(() => !!window.state.movingLabel)).toBe(false);
    expect(Math.abs((await labelT(page, 'quick')) - 0.75)).toBeLessThan(0.02);
    expect(await page.evaluate(() => window.App.getActiveCanvas(window.state.pages[0]).annotations.quickLines.length)).toBe(1);
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.NONE)).toBe(true);

    // One undo step per move; redo brings the seat back.
    await page.keyboard.press('Control+z');
    expect(await labelT(page, 'quick')).toBeUndefined();
    await page.keyboard.press('Control+Shift+z');
    expect(Math.abs((await labelT(page, 'quick')) - 0.75)).toBeLessThan(0.02);

    // Reset label sends it home.
    await page.mouse.click(seat.x, seat.y, { button: 'right' });
    await expect(page.locator('#ctxResetLabel')).toBeVisible();
    await page.locator('#ctxResetLabel').click();
    expect(await labelT(page, 'quick')).toBeUndefined();
    await page.waitForTimeout(50);
    expect(await whiteAt(page, mid)).toBeGreaterThan(0);
    expect(await whiteAt(page, seat)).toBe(0);
    errors.assertNoErrors();
  });

  test('Esc puts a label in hand back where it was, and the tool is untouched', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    await seed(page, 'quick');
    const mid = await clientPt(page, { x: 200, y: 120 });
    await page.mouse.click(mid.x, mid.y, { button: 'right' });
    await page.locator('#ctxMoveLabel').click();
    const below = await clientPt(page, { x: 250, y: 160 });
    await page.mouse.move(below.x, below.y, { steps: 6 });
    await page.waitForTimeout(100);
    expect(Math.abs((await labelT(page, 'quick')) - 0.75)).toBeLessThan(0.02);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => !!window.state.movingLabel)).toBe(false);
    expect(await labelT(page, 'quick')).toBeUndefined();
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.NONE)).toBe(true);
    await page.waitForTimeout(50);
    expect(await whiteAt(page, mid)).toBeGreaterThan(0);
    errors.assertNoErrors();
  });

  test('a polyline\'s label crosses onto the leg under the pointer', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    await seed(page, 'poly');
    // Two legs of 200: the label starts at the corner (halfway); the pointer beside the
    // second leg's middle seats it there, at three quarters of the run.
    const corner = await clientPt(page, { x: 300, y: 160 });
    await page.mouse.click(corner.x, corner.y, { button: 'right' });
    await expect(page.locator('#ctxMoveLabel')).toBeVisible();
    await page.locator('#ctxMoveLabel').click();
    const beside = await clientPt(page, { x: 340, y: 260 });
    await page.mouse.move(beside.x, beside.y, { steps: 6 });
    await page.waitForTimeout(100);
    expect(Math.abs((await labelT(page, 'poly')) - 0.75)).toBeLessThan(0.02);
    await page.mouse.click(beside.x, beside.y);
    expect(await page.evaluate(() => !!window.state.movingLabel)).toBe(false);
    // The box now sits on the vertical leg (its text turned with it): white beside the seat, none at the corner.
    const seat = await clientPt(page, { x: 300, y: 260 });
    expect(await whiteAt(page, { x: seat.x - 8, y: seat.y }, 0)).toBeGreaterThan(0);
    expect(await whiteAt(page, { x: corner.x - 8, y: corner.y }, 0)).toBe(0);
    errors.assertNoErrors();
  });
});

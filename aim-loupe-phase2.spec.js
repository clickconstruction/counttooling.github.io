// @ts-check
/**
 * Tests: phase 2 of the mobile aim loupe.
 *  (A) The press-and-hold loupe gesture generalized to the Quick Line tool — two
 *      holds place a line's start + end via commitLinePoint (same snap/bounds as a tap).
 *  (B) Touch drag of a polyline vertex in EDIT_POLY (previously mouse-only): press a
 *      vertex (state.draggingVertexIdx set + loupe shown), drag it (point follows the
 *      finger), release (drag finalized, loupe hidden).
 *
 * Both drive real TouchEvent sequences on #canvasWrapper and read back via window.state
 * and the published window.App helpers. Client<->PDF mapping uses the live pan/zoom so
 * the synthesized touches land on real in-bounds geometry.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function bootWithScale(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  // Set a page scale via the Scale modal preset (Line/Measure need one; harmless for poly).
  await page.evaluate(() => window.App.openScaleModal());
  await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
  await page.locator('#scalePresetsList button').first().click();
  await page.waitForFunction(() => !!window.state.pages[window.state.currentPage].scale, { timeout: 5000 });
  // Inject the touch-firing helper + a PDF-point -> client-point mapper.
  await page.evaluate(() => {
    window.__fireTouch = (type, x, y) => {
      const el = document.getElementById('canvasWrapper');
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      const isEnd = type === 'touchend' || type === 'touchcancel';
      el.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true,
        touches: isEnd ? [] : [t], changedTouches: [t], targetTouches: isEnd ? [] : [t],
      }));
    };
    window.__pdfToClient = (px, py) => {
      const r = document.getElementById('canvasWrapper').getBoundingClientRect();
      return { x: r.left + px * window.state.zoom + window.state.pan.x, y: r.top + py * window.state.zoom + window.state.pan.y };
    };
  });
}

test.describe('Aim loupe - phase 2', () => {
  test('(A) press-hold places a Quick Line start + end with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await bootWithScale(page);

    // Activate the Line tool with a line type (bypass the picker modal).
    await page.evaluate(() => {
      const s = window.state;
      if (!s.lineTypes || !s.lineTypes.length) {
        s.lineTypes = s.lineTypes || [];
        s.lineTypes.push({ id: 'lt-test', name: 'Test', color: '#4a9eff', curveStyle: 'straight' });
      }
      s.activeLineTypeId = s.lineTypes[0].id;
      s.tool = window.App.TOOL.LINE;
    });

    const linesBefore = await page.evaluate(() => {
      const c = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]);
      return (c.annotations.quickLines || []).length;
    });

    // Hold #1 -> start point (quickLineStart set, nothing committed yet).
    const center = await page.evaluate(() => {
      const r = document.getElementById('canvasWrapper').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await page.evaluate(({ x, y }) => window.__fireTouch('touchstart', x, y), center);
    await page.waitForFunction(() => window.state.aiming === true, { timeout: 3000 });
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('aimLoupe')).display)).toBe('block');
    await page.evaluate(({ x, y }) => window.__fireTouch('touchend', x, y), center);
    await page.waitForFunction(() => !!window.state.quickLineStart, { timeout: 3000 });

    // Hold #2 -> end point (commits one quick line).
    const p2 = { x: center.x + 80, y: center.y + 30 };
    await page.evaluate(({ x, y }) => window.__fireTouch('touchstart', x, y), p2);
    await page.waitForFunction(() => window.state.aiming === true, { timeout: 3000 });
    await page.evaluate(({ x, y }) => window.__fireTouch('touchend', x, y), p2);
    await page.waitForFunction((n) => {
      const c = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]);
      return (c.annotations.quickLines || []).length === n + 1;
    }, linesBefore, { timeout: 3000 });

    const after = await page.evaluate(() => ({
      lines: window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.quickLines.length,
      start: window.state.quickLineStart,
      loupe: getComputedStyle(document.getElementById('aimLoupe')).display,
    }));
    expect(after.lines).toBe(linesBefore + 1);
    expect(after.start).toBeNull();
    expect(after.loupe).toBe('none');
    expect(errors).toEqual([]);
  });

  test('(B) touch-drag moves a polyline vertex in EDIT_POLY with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await bootWithScale(page);

    // Enter EDIT_POLY with a 3-vertex polyline held in state.editingPolyline.
    await page.evaluate(() => {
      const s = window.state;
      s.tool = window.App.TOOL.EDIT_POLY;
      s.editingPolyline = { id: 'poly-test', name: 'P', color: '#4a9eff',
        points: [{ x: 120, y: 120 }, { x: 260, y: 120 }, { x: 260, y: 260 }], closed: false, lineTypeId: null };
      window.App.renderAnnotations();
    });

    // Press on vertex 0 -> it becomes the dragged vertex.
    const v0 = await page.evaluate(() => window.__pdfToClient(120, 120));
    await page.evaluate(({ x, y }) => window.__fireTouch('touchstart', x, y), v0);
    expect(await page.evaluate(() => window.state.draggingVertexIdx)).toBe(0);

    // Drag toward a new spot -> vertex 0 follows the finger; loupe is shown.
    const target = await page.evaluate(() => window.__pdfToClient(180, 200));
    await page.evaluate(({ x, y }) => window.__fireTouch('touchmove', x, y), target);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('aimLoupe')).display === 'block', { timeout: 3000 });
    const moved = await page.evaluate(() => ({ ...window.state.editingPolyline.points[0] }));
    // Vertex moved meaningfully away from its original (120,120).
    expect(Math.hypot(moved.x - 120, moved.y - 120)).toBeGreaterThan(40);

    // Release -> drag finalized, loupe hidden, others untouched.
    await page.evaluate(({ x, y }) => window.__fireTouch('touchend', x, y), target);
    const afterRelease = await page.evaluate(() => ({
      dragging: window.state.draggingVertexIdx,
      loupe: getComputedStyle(document.getElementById('aimLoupe')).display,
      count: window.state.editingPolyline.points.length,
      v1: { ...window.state.editingPolyline.points[1] },
    }));
    expect(afterRelease.dragging).toBeNull();
    expect(afterRelease.loupe).toBe('none');
    expect(afterRelease.count).toBe(3);
    expect(afterRelease.v1).toEqual({ x: 260, y: 120 }); // untouched vertex unchanged
    expect(errors).toEqual([]);
  });
});

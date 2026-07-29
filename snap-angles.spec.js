// @ts-check
/**
 * Tests: the `J` snap (state.lineTypeSettings.snapToHorizontalVertical) constrains
 * drawn geometry to 45° increments — horizontal, vertical, AND the four diagonals
 * (45/135/225/315) — as of 2026-07-23. It was horizontal/vertical only before.
 *
 * geometry.test.js covers the pure `snapLineToAngle` math exhaustively. THIS spec
 * covers the thing unit tests can't: that the real click path actually applies it,
 * for both quick lines and polyline legs, and that the committed annotation (not
 * just the rubber-band preview) lands on the ray.
 *
 * Angles are asserted in PDF space via the stored annotation. The canvas transform
 * is a uniform scale + translate with no rotation, so a 27°-off-horizontal drag on
 * screen is a 27° delta in PDF space too — which lets the test drive real mouse
 * clicks without needing to know the zoom/pan.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// Nearest 45° multiple of a stored segment, 0..315, in PDF space.
const angleOf = (dx, dy) => ((Math.round(Math.atan2(dy, dx) * 180 / Math.PI) % 360) + 360) % 360;

test.describe('J snap — 45° increments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // A scale is required before the Line/Polyline tools will draw. Seed a line
    // type + turn the snap on, then select the Line tool.
    await page.evaluate(() => {
      const s = window.state, p = s.pages[s.currentPage];
      p.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      s.lineTypes = [{ id: 'lt1', name: 'Test', color: '#4a9eff', curveStyle: 'straight' }];
      s.activeLineTypeId = 'lt1';
      s.lineTypeSettings.snapToHorizontalVertical = true;
    });
  });

  test('quick line: an off-axis drag commits to the nearest 45° ray', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    const wrapper = page.locator('#canvasWrapper');

    // ~27° off horizontal (dx 100, dy 51) -> must land exactly on 45°.
    await page.evaluate(() => { window.state.tool = window.App.TOOL.LINE; });
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 201 } });

    let line = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
      const q = ann.quickLines[ann.quickLines.length - 1];
      return { dx: q.x2 - q.x1, dy: q.y2 - q.y1 };
    });
    expect(angleOf(line.dx, line.dy)).toBe(45);
    // Exactly on the diagonal, not merely near it.
    expect(Math.abs(line.dx - line.dy)).toBeLessThan(1e-9);

    // ~14° off horizontal (dx 100, dy 25) stays HORIZONTAL — under the 22.5°
    // boundary, so adding diagonals must not steal shallow drags.
    await page.evaluate(() => { window.state.tool = window.App.TOOL.LINE; });
    await wrapper.click({ position: { x: 150, y: 300 } });
    await wrapper.click({ position: { x: 250, y: 325 } });

    line = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
      const q = ann.quickLines[ann.quickLines.length - 1];
      return { dx: q.x2 - q.x1, dy: q.y2 - q.y1, y1: q.y1, y2: q.y2 };
    });
    expect(angleOf(line.dx, line.dy)).toBe(0);
    // A horizontal snap must leave y bit-exact, not y1 + 6e-17.
    expect(line.y2).toBe(line.y1);

    expect(errors).toEqual([]);
  });

  test('quick line: all four diagonals are reachable', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    // Drags at ~±40° in each quadrant, from a center anchor.
    const cases = [
      { to: { x: 350, y: 301 }, expect: 45 },    // right-down
      { to: { x: 150, y: 301 }, expect: 135 },   // left-down
      { to: { x: 150, y: 199 }, expect: 225 },   // left-up
      { to: { x: 350, y: 199 }, expect: 315 },   // right-up
    ];
    for (const c of cases) {
      await page.evaluate(() => { window.state.tool = window.App.TOOL.LINE; });
      await wrapper.click({ position: { x: 250, y: 250 } });
      await wrapper.click({ position: c.to });
      const seg = await page.evaluate(() => {
        const ann = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
        const q = ann.quickLines[ann.quickLines.length - 1];
        return { dx: q.x2 - q.x1, dy: q.y2 - q.y1 };
      });
      expect(angleOf(seg.dx, seg.dy), `drag to ${JSON.stringify(c.to)}`).toBe(c.expect);
    }
  });

  test('polyline legs snap too, and turning J off restores freehand angles', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');

    // Polyline: each leg snaps against the PREVIOUS vertex. The toolbar button
    // opens a name/color dialog first; Start begins the actual drawing mode.
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });
    await page.waitForSelector('#polylineModal.visible', { timeout: 5000 });
    await page.locator('#polylineStart').click();
    await expect(page.locator('#polylineModal')).not.toHaveClass(/visible/, { timeout: 5000 });
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 201 } });   // ~27° -> 45°
    await wrapper.click({ position: { x: 350, y: 205 } });   // ~2°  -> horizontal
    await page.keyboard.press('Enter');

    const legs = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
      const pl = ann.polylines[ann.polylines.length - 1];
      return pl.points.slice(1).map((p, i) => ({ dx: p.x - pl.points[i].x, dy: p.y - pl.points[i].y }));
    });
    expect(legs.length).toBe(2);
    expect(angleOf(legs[0].dx, legs[0].dy)).toBe(45);
    expect(angleOf(legs[1].dx, legs[1].dy)).toBe(0);

    // Snap OFF -> the same off-axis drag stays off-axis.
    await page.evaluate(() => {
      window.state.lineTypeSettings.snapToHorizontalVertical = false;
      window.state.tool = window.App.TOOL.LINE;
    });
    await wrapper.click({ position: { x: 150, y: 400 } });
    await wrapper.click({ position: { x: 250, y: 451 } });
    const free = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
      const q = ann.quickLines[ann.quickLines.length - 1];
      return { dx: q.x2 - q.x1, dy: q.y2 - q.y1 };
    });
    expect(angleOf(free.dx, free.dy)).not.toBe(45);
    expect(angleOf(free.dx, free.dy)).not.toBe(0);
  });
});

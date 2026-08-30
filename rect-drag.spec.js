// @ts-check
/**
 * The rect-tool drag gesture (JOURNEY-MAP Tier-2 #14, plan T2-10): on all five
 * rectangle tools (Highlight, Multiply Zone, Scale Zone, Room Sizer, Delete
 * Area) a press-drag-release past the 6px threshold arms corner 1 at the PRESS
 * point and completes the rectangle at the RELEASE point through the tool's
 * normal corner-2 click path — dialogs, overlap checks, undo, dirty-marking
 * identical to two-click. A sub-threshold press stays a plain click (the
 * two-click path is untouched), and the aim loupe keeps its contract: hold
 * still 280ms -> loupe wins and commits ONE corner; move >6px first -> drag
 * wins. Uses REAL Playwright mouse input (down/move/up + the browser's own
 * trailing click) so the click-suppression flag is exercised the way a real
 * hand exercises it.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => window.App.openScaleModal());
  await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
  await page.locator('#scalePresetsList button').first().click();
  await page.waitForFunction(() => !!window.state.pages[window.state.currentPage].scale, { timeout: 5000 });
}

// Client (viewport) coords for a point at (fx, fy) fraction of the rendered page.
function pagePt(page, fx, fy) {
  return page.evaluate(({ fx, fy }) => {
    const s = window.state; const p = s.pages[s.currentPage];
    const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
    const r = document.getElementById('canvasWrapper').getBoundingClientRect();
    return { x: Math.round(r.left + (vp.width * fx) * s.zoom + s.pan.x), y: Math.round(r.top + (vp.height * fy) * s.zoom + s.pan.y) };
  }, { fx, fy });
}

// Expected PDF-space coords for the same fraction point (what the drag should store).
function pdfPt(page, fx, fy) {
  return page.evaluate(({ fx, fy }) => {
    const p = window.state.pages[window.state.currentPage];
    const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
    return { x: vp.width * fx, y: vp.height * fy };
  }, { fx, fy });
}

// Real press-drag-release: trusted mousedown / mousemoves / mouseup, and the
// browser fires the trailing native click itself (the suppression contract).
async function drag(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

function captureErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

// PDF-space tolerance: pagePt rounds to whole client px, so allow a few pdf pts.
const TOL = 6;

test.describe('Rect-tool drag gesture (T2-10)', () => {
  test('Highlight: drag completes one rect at press/release; next click arms fresh', async ({ page }) => {
    const errors = captureErrors(page);
    await boot(page);
    await page.evaluate(() => { window.state.tool = window.App.TOOL.HIGHLIGHT; });
    const a = await pagePt(page, 0.3, 0.3);
    const b = await pagePt(page, 0.55, 0.55);
    const expA = await pdfPt(page, 0.3, 0.3);
    const expB = await pdfPt(page, 0.55, 0.55);

    await drag(page, a, b);

    const out = await page.evaluate(() => {
      const hs = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.highlights || [];
      return { n: hs.length, h: hs[0] || null, start: window.state.highlightStart, dragging: window.state.rectDragging };
    });
    expect(out.n).toBe(1);
    expect(out.start).toBeNull();
    expect(out.dragging).toBe(false);
    expect(Math.abs(out.h.x1 - expA.x)).toBeLessThan(TOL);
    expect(Math.abs(out.h.y1 - expA.y)).toBeLessThan(TOL);
    expect(Math.abs(out.h.x2 - expB.x)).toBeLessThan(TOL);
    expect(Math.abs(out.h.y2 - expB.y)).toBeLessThan(TOL);

    // No leftover suppression: the next plain click arms a fresh corner 1.
    const c = await pagePt(page, 0.7, 0.7);
    await page.mouse.click(c.x, c.y);
    expect(await page.evaluate(() => !!window.state.highlightStart)).toBe(true);
    expect(await page.evaluate(() => (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.highlights || []).length)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('Two-click regression + sub-threshold press behaves as a click', async ({ page }) => {
    const errors = captureErrors(page);
    await boot(page);
    await page.evaluate(() => { window.state.tool = window.App.TOOL.HIGHLIGHT; });
    const hcount = () => page.evaluate(() => (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.highlights || []).length);

    // Two separated clicks still complete a rectangle (today's path, unchanged).
    const a = await pagePt(page, 0.25, 0.25);
    const b = await pagePt(page, 0.45, 0.45);
    await page.mouse.click(a.x, a.y);
    expect(await page.evaluate(() => !!window.state.highlightStart)).toBe(true);
    await page.mouse.click(b.x, b.y);
    expect(await hcount()).toBe(1);
    expect(await page.evaluate(() => window.state.highlightStart)).toBeNull();

    // A 3px "drag" is under the 6px threshold: it arms corner 1 only, exactly
    // like a click (whether the release beat the 280ms loupe timer or not).
    const c = await pagePt(page, 0.6, 0.6);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 3, c.y, { steps: 2 });
    await page.mouse.up();
    expect(await page.evaluate(() => !!window.state.highlightStart)).toBe(true);
    expect(await hcount()).toBe(1);   // nothing completed
    expect(errors).toEqual([]);
  });

  test('Delete Area: drag opens the confirm with correct counts; Cancel keeps marks', async ({ page }) => {
    const errors = captureErrors(page);
    await boot(page);
    // Two counters inside the future rect, one outside it.
    await page.evaluate(() => {
      const s = window.state;
      s.counters.push({ id: 'c1', name: 'Outlet', icon: 'M0 0L512 512', color: '#ff5d5d' });
      const p = s.pages[s.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const ann = window.App.ensureActiveCanvas(p).annotations;
      ann.counterMarkers.c1 = [
        { x: vp.width * 0.4, y: vp.height * 0.4, id: 'm1', group: null },
        { x: vp.width * 0.5, y: vp.height * 0.5, id: 'm2', group: null },
        { x: vp.width * 0.8, y: vp.height * 0.8, id: 'm3', group: null },
      ];
      s.tool = window.App.TOOL.DELETE_ZONE;
    });
    await drag(page, await pagePt(page, 0.35, 0.35), await pagePt(page, 0.55, 0.55));
    await expect(page.locator('#deleteZoneModal')).toHaveClass(/visible/);
    await expect(page.locator('#deleteZonePreview')).toContainText('2 counter(s)');
    await page.locator('#deleteZoneCancel').click();
    await expect(page.locator('#deleteZoneModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.counterMarkers.c1.length)).toBe(3);
    expect(errors).toEqual([]);
  });

  test('Multiply Zone: drag opens the modal; Apply stores the dragged rect', async ({ page }) => {
    const errors = captureErrors(page);
    await boot(page);
    await page.evaluate(() => { window.state.tool = window.App.TOOL.MULTIPLY_ZONE; });
    const expA = await pdfPt(page, 0.3, 0.3);
    const expB = await pdfPt(page, 0.5, 0.5);
    await drag(page, await pagePt(page, 0.3, 0.3), await pagePt(page, 0.5, 0.5));
    await expect(page.locator('#multiplyZoneModal')).toHaveClass(/visible/);
    await expect(page.locator('#multiplyZonePreview')).toContainText('In this area:');
    await page.locator('#multiplyZoneApply').click();
    // Apply commits on a deferred setTimeout(0) (input-blur ordering) — wait it out.
    await page.waitForFunction(() => (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.multiplyZones || []).length === 1);
    const z = await page.evaluate(() => (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.multiplyZones || [])[0] || null);
    expect(z).not.toBeNull();
    expect(Math.abs(z.x1 - Math.min(expA.x, expB.x))).toBeLessThan(TOL);
    expect(Math.abs(z.y1 - Math.min(expA.y, expB.y))).toBeLessThan(TOL);
    expect(Math.abs(z.x2 - Math.max(expA.x, expB.x))).toBeLessThan(TOL);
    expect(Math.abs(z.y2 - Math.max(expA.y, expB.y))).toBeLessThan(TOL);
    expect(errors).toEqual([]);
  });

  test('Room Sizer: drag on a scaled page opens the dialog with non-zero L x W', async ({ page }) => {
    const errors = captureErrors(page);
    await boot(page);
    await page.evaluate(() => { window.state.tool = window.App.TOOL.ROOM; });
    await drag(page, await pagePt(page, 0.3, 0.3), await pagePt(page, 0.55, 0.5));
    await expect(page.locator('#roomBoxModal')).toHaveClass(/visible/);
    const pend = await page.evaluate(() => window.state.pendingRoomBox);
    expect(pend).not.toBeNull();
    expect(Math.abs(pend.x2 - pend.x1)).toBeGreaterThan(0);
    expect(Math.abs(pend.y2 - pend.y1)).toBeGreaterThan(0);
    await expect(page.locator('#roomBoxDimsPreview')).toContainText('Length');
    await page.locator('#roomBoxCancel').click();
    expect(errors).toEqual([]);
  });

  test('Loupe coexistence: hold-still wins, commits ONE corner, drag stays inert', async ({ page }) => {
    const errors = captureErrors(page);
    await boot(page);
    await page.evaluate(() => { window.state.tool = window.App.TOOL.HIGHLIGHT; });
    const a = await pagePt(page, 0.35, 0.35);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.waitForFunction(() => window.state.aiming === true, { timeout: 3000 });
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('aimLoupe')).display)).toBe('block');
    // Drag after the loupe appeared: the crosshair tracks, but the drag
    // machinery must stay inert — release commits exactly one corner.
    const b = await pagePt(page, 0.55, 0.55);
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    const out = await page.evaluate(() => ({
      start: !!window.state.highlightStart,
      n: (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.highlights || []).length,
      dragging: window.state.rectDragging,
      aiming: window.state.aiming,
    }));
    expect(out.start).toBe(true);    // exactly one pending corner
    expect(out.n).toBe(0);           // NO drag completion
    expect(out.dragging).toBe(false);
    expect(out.aiming).toBe(false);
    expect(errors).toEqual([]);
  });

  test('Release outside the page clamps; leaving the canvas cancels the gesture', async ({ page }) => {
    const errors = captureErrors(page);
    await boot(page);
    await page.evaluate(() => { window.state.tool = window.App.TOOL.HIGHLIGHT; });

    // A release point right of the page edge but still inside the wrapper.
    const geo = await page.evaluate(() => {
      const s = window.state; const p = s.pages[s.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const r = document.getElementById('canvasWrapper').getBoundingClientRect();
      const pageRight = r.left + vp.width * s.zoom + s.pan.x;
      return { pageRight, wrapperRight: r.right, wrapperTop: r.top, pageW: vp.width };
    });
    expect(geo.wrapperRight - geo.pageRight).toBeGreaterThan(12);   // margin exists on this viewport
    const a = await pagePt(page, 0.6, 0.5);
    const outX = Math.min(geo.pageRight + 30, geo.wrapperRight - 4);
    await drag(page, a, { x: outX, y: a.y });
    const out = await page.evaluate(() => {
      const hs = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.highlights || [];
      return { n: hs.length, h: hs[0] || null, start: window.state.highlightStart };
    });
    expect(out.n).toBe(1);
    expect(out.start).toBeNull();                                   // no phantom corner
    expect(Math.max(out.h.x1, out.h.x2)).toBeLessThanOrEqual(geo.pageW + 0.001);   // clamped to the edge
    expect(Math.abs(Math.max(out.h.x1, out.h.x2) - geo.pageW)).toBeLessThan(TOL);

    // Leaving the canvas mid-drag cancels the whole gesture.
    const c = await pagePt(page, 0.4, 0.4);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 60, c.y + 60, { steps: 6 });
    expect(await page.evaluate(() => window.state.rectDragging)).toBe(true);
    await page.mouse.move(10, Math.max(0, geo.wrapperTop - 20), { steps: 4 });   // off the wrapper
    await page.mouse.up();
    const dead = await page.evaluate(() => ({
      start: window.state.highlightStart, dragging: window.state.rectDragging,
      n: (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.highlights || []).length,
    }));
    expect(dead.start).toBeNull();
    expect(dead.dragging).toBe(false);
    expect(dead.n).toBe(1);   // still just the clamped rect from above
    expect(errors).toEqual([]);
  });

  test('Scale Zone: drag opens the zone-scale dialog with the dragged rect pending', async ({ page }) => {
    const errors = captureErrors(page);
    await boot(page);
    await page.evaluate(() => { window.state.tool = window.App.TOOL.SCALE_ZONE; });
    await drag(page, await pagePt(page, 0.3, 0.3), await pagePt(page, 0.5, 0.45));
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    const pend = await page.evaluate(() => ({ zone: window.state.pendingScaleZone, target: window.state.scaleModalApplyTarget, start: window.state.scaleZoneStart }));
    expect(pend.zone).not.toBeNull();
    expect(pend.target).toBe('zone');
    expect(pend.start).toBeNull();
    expect(Math.abs(pend.zone.x2 - pend.zone.x1)).toBeGreaterThan(0);
    await page.evaluate(() => window.App.hideModal('scaleModal'));
    expect(errors).toEqual([]);
  });
});

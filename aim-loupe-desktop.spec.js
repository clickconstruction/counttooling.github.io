// @ts-check
/**
 * Tests the DESKTOP (mouse) aim-loupe gesture and its generalization to all placement
 * tools. A left press-and-hold (~280ms) summons the loupe; release commits at the
 * crosshair via the tool's normal commit path; a quick click still places instantly;
 * and the trailing native click after a loupe commit is suppressed (no duplicate).
 *
 * Drives real MouseEvents on #canvasWrapper. Manually-dispatched mousedown/mouseup do
 * NOT auto-emit a `click`, so the helpers dispatch `click` explicitly to mirror the
 * browser — which is exactly how the suppression guard is exercised. Points are mapped
 * from page fractions so they land inside the rendered page (a click outside the page
 * is correctly rejected, so wrapper-center is not safe on a wide viewport).
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
  await page.evaluate(() => {
    window.__fireMouse = (type, x, y) => document.getElementById('canvasWrapper').dispatchEvent(
      new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
  });
}

// Client coords for a point at (fx, fy) fraction of the rendered page — guaranteed in-bounds.
function pagePt(page, fx, fy) {
  return page.evaluate(({ fx, fy }) => {
    const s = window.state; const p = s.pages[s.currentPage];
    const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
    const r = document.getElementById('canvasWrapper').getBoundingClientRect();
    return { x: Math.round(r.left + (vp.width * fx) * s.zoom + s.pan.x), y: Math.round(r.top + (vp.height * fy) * s.zoom + s.pan.y) };
  }, { fx, fy });
}

// Press-and-hold: mousedown, wait for the loupe, then mouseup (commit) + click (suppressed).
async function hold(page, pt) {
  await page.evaluate((p) => window.__fireMouse('mousedown', p.x, p.y), pt);
  await page.waitForFunction(() => window.state.aiming === true, { timeout: 3000 });
  await page.evaluate((p) => window.__fireMouse('mousemove', p.x, p.y), pt);
  await page.evaluate((p) => { window.__fireMouse('mouseup', p.x, p.y); window.__fireMouse('click', p.x, p.y); }, pt);
}

test.describe('Aim loupe - desktop (mouse) + all tools', () => {
  test('Measure: hold shows loupe; release commits both points', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    await page.locator('#measureBtn').click();
    const a = await pagePt(page, 0.4, 0.4);

    await page.evaluate((p) => window.__fireMouse('mousedown', p.x, p.y), a);
    await page.waitForFunction(() => window.state.aiming === true, { timeout: 3000 });
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('aimLoupe')).display)).toBe('block');
    await page.evaluate((p) => { window.__fireMouse('mouseup', p.x, p.y); window.__fireMouse('click', p.x, p.y); }, a);
    const sm = await page.evaluate(() => ({ mode: window.state.scaleMode, B: window.App.SCALE_MODES.POINT_B, hasA: !!window.state.scalePointA }));
    expect(sm.mode).toBe(sm.B);
    expect(sm.hasA).toBe(true);

    await hold(page, await pagePt(page, 0.6, 0.6));
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.NONE, { timeout: 3000 });
    expect(await page.evaluate(() => window.state.scalePointA)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('Counter: hold adds a marker; quick click also places; suppressed click adds no dupe', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    await page.evaluate(() => {
      const s = window.state;
      s.counters = s.counters || [];
      s.counters.push({ id: 'c1', name: 'Outlet', icon: 'M0 0L512 512', color: '#ff5d5d' }); // any valid SVG path
      s.activeCounterType = 'c1';
      s.tool = window.App.TOOL.COUNTER;
    });
    const count = () => page.evaluate(() => (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.counterMarkers.c1 || []).length);
    expect(await count()).toBe(0);

    // Hold -> commit; the trailing click must be suppressed (exactly +1, not +2).
    await hold(page, await pagePt(page, 0.4, 0.4));
    expect(await count()).toBe(1);
    expect(await page.evaluate(() => window.state.aiming)).toBe(false);

    // Quick click (down->up->native click, no hold) places instantly.
    const q = await pagePt(page, 0.6, 0.6);
    await page.evaluate((p) => { window.__fireMouse('mousedown', p.x, p.y); window.__fireMouse('mouseup', p.x, p.y); window.__fireMouse('click', p.x, p.y); }, q);
    expect(await count()).toBe(2);
    expect(errors).toEqual([]);
  });

  test('Highlight: two holds (corner A, corner B) commit one rect', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);
    await page.evaluate(() => { window.state.tool = window.App.TOOL.HIGHLIGHT; });
    const hcount = () => page.evaluate(() => (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.highlights || []).length);

    await hold(page, await pagePt(page, 0.3, 0.3));
    expect(await page.evaluate(() => !!window.state.highlightStart)).toBe(true);
    await hold(page, await pagePt(page, 0.6, 0.6));
    expect(await hcount()).toBe(1);
    expect(await page.evaluate(() => window.state.highlightStart)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('Mouse aim uses no upward offset (crosshair at the cursor)', async ({ page }) => {
    await boot(page);
    await page.locator('#measureBtn').click();
    const a = await pagePt(page, 0.4, 0.4);
    await page.evaluate((p) => window.__fireMouse('mousedown', p.x, p.y), a);
    await page.waitForFunction(() => window.state.aiming === true, { timeout: 3000 });
    await page.evaluate((p) => window.__fireMouse('mousemove', p.x, p.y), a);
    const dy = await page.evaluate((p) => {
      const r = document.getElementById('canvasWrapper').getBoundingClientRect();
      const rawY = (p.y - r.top - window.state.pan.y) / window.state.zoom;
      return Math.abs(window.state.aimPoint.y - rawY); // touch offsets ~44/zoom; mouse should be ~0
    }, a);
    expect(dy).toBeLessThan(1);
    await page.evaluate((p) => window.__fireMouse('mouseup', p.x, p.y), a);
  });
});

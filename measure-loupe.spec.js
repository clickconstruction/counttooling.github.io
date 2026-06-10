// @ts-check
/**
 * Tests: the mobile "press-and-hold to aim with a magnifier loupe" gesture for the
 * Measure tool (phase 1). A short press summons the #aimLoupe magnifier + an offset
 * crosshair (state.aiming); the crosshair tracks touchmove; lifting commits the point
 * at the crosshair via commitMeasurePoint(). Two holds = first point A, then point B
 * -> a distance toast and a full state reset (tool back to NONE).
 *
 * Drives real TouchEvent sequences dispatched on #canvasWrapper (the gesture is the
 * whole feature), asserting via window.state and the published window.App.TOOL /
 * window.App.SCALE_MODES enums. A quick tap (release before the ~280ms hold) is the
 * unchanged instant-placement path and is covered by the existing click handler.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Measure tool - mobile aim loupe', () => {
  test('press-hold summons the loupe; release commits both points; no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. The loupe element exists and is hidden until a hold begins.
    const loupe0 = await page.evaluate(() => {
      const el = document.getElementById('aimLoupe');
      return { exists: !!el, display: el ? getComputedStyle(el).display : null };
    });
    expect(loupe0.exists).toBe(true);
    expect(loupe0.display).toBe('none');

    // 3. Set a page scale (Measure requires one) via the Scale modal preset.
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(() => !!window.state.pages[window.state.currentPage].scale, { timeout: 5000 });

    // 4. Activate Measure.
    await page.locator('#measureBtn').click();
    const enums = await page.evaluate(() => ({
      tool: window.state.tool,
      MEASURE: window.App.TOOL.MEASURE,
      NONE: window.App.TOOL.NONE,
      POINT_A: window.App.SCALE_MODES.POINT_A,
      POINT_B: window.App.SCALE_MODES.POINT_B,
    }));
    expect(enums.tool).toBe(enums.MEASURE);

    // 5. Inject a touch-firing helper + compute an in-bounds point (wrapper center).
    await page.evaluate(() => {
      window.__fireTouch = (type, x, y) => {
        const el = document.getElementById('canvasWrapper');
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        const isEnd = type === 'touchend' || type === 'touchcancel';
        el.dispatchEvent(new TouchEvent(type, {
          bubbles: true, cancelable: true,
          touches: isEnd ? [] : [t],
          changedTouches: [t],
          targetTouches: isEnd ? [] : [t],
        }));
      };
    });
    const center = await page.evaluate(() => {
      const r = document.getElementById('canvasWrapper').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });

    // 6. First hold -> loupe appears (state.aiming + #aimLoupe visible), then release
    //    commits point A (scalePointA set, scaleMode advances to POINT_B).
    await page.evaluate(({ x, y }) => window.__fireTouch('touchstart', x, y), center);
    await page.waitForFunction(() => window.state.aiming === true, { timeout: 3000 });
    const duringAim = await page.evaluate(() => ({
      aiming: window.state.aiming,
      loupeDisplay: getComputedStyle(document.getElementById('aimLoupe')).display,
      hasAimPoint: !!window.state.aimPoint,
    }));
    expect(duringAim.aiming).toBe(true);
    expect(duringAim.loupeDisplay).toBe('block');
    expect(duringAim.hasAimPoint).toBe(true);

    await page.evaluate(({ x, y }) => window.__fireTouch('touchmove', x + 8, y - 6), center);
    await page.evaluate(({ x, y }) => window.__fireTouch('touchend', x + 8, y - 6), center);

    const afterA = await page.evaluate(() => ({
      aiming: window.state.aiming,
      loupeDisplay: getComputedStyle(document.getElementById('aimLoupe')).display,
      hasA: !!window.state.scalePointA,
      scaleMode: window.state.scaleMode,
    }));
    expect(afterA.aiming).toBe(false);
    expect(afterA.loupeDisplay).toBe('none');
    expect(afterA.hasA).toBe(true);
    expect(afterA.scaleMode).toBe(enums.POINT_B);

    // 7. Second hold at a different point -> commits point B -> distance toast + reset.
    const p2 = { x: center.x + 60, y: center.y + 40 };
    await page.evaluate(({ x, y }) => window.__fireTouch('touchstart', x, y), p2);
    await page.waitForFunction(() => window.state.aiming === true, { timeout: 3000 });
    await page.evaluate(({ x, y }) => window.__fireTouch('touchend', x, y), p2);

    await page.waitForFunction((NONE) => window.state.tool === NONE, enums.NONE, { timeout: 3000 });
    const afterB = await page.evaluate(() => ({
      tool: window.state.tool,
      a: window.state.scalePointA,
      b: window.state.scalePointB,
      aiming: window.state.aiming,
    }));
    expect(afterB.tool).toBe(enums.NONE);
    expect(afterB.a).toBeNull();
    expect(afterB.b).toBeNull();
    expect(afterB.aiming).toBe(false);

    expect(errors).toEqual([]);
  });
});

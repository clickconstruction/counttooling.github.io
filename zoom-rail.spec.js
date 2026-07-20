// @ts-check
/**
 * Tests: the Zoom Rail (features/zoom-rail.js) - the giant floating vertical
 * zoom slider on the right edge, opened by clicking the footer zoom-%.
 *
 * Guards the registry failure modes (entry points never registered; the
 * zoom-% call site firing before the registry is populated) plus the rail's
 * behavior contract: the zoom-% toggle (rail only - Zoom Settings opens from
 * the rail's gear, coexisting above the modal backdrop), the log-scale drag
 * (clamped to [0.2, getMaxZoom()]), the ~5s idle auto-fade + yellow thumb,
 * tick rebuild when the max zoom changes, thumb resync on external zoom
 * changes, mobile parity (old #zoomOverlay popover gone), and outside-click /
 * Escape dismissal.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function bootWithPdf(page, errors) {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

test.describe('Zoom Rail (features/zoom-rail.js)', () => {
  test('registry wired; zoom-% toggles the rail (no modal); gear opens Zoom Settings', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    // 1. Registry contract: entry points + the 4 publish-only deps.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openZoomRail,
      close: typeof window.App?.closeZoomRail,
      toggle: typeof window.App?.toggleZoomRail,
      sync: typeof window.App?.onZoomRailSync,
      zoomIn: typeof window.App?.doZoomIn,
      zoomOut: typeof window.App?.doZoomOut,
      transform: typeof window.App?.updateContainerTransform,
      commit: typeof window.App?.commitWheelZoom,
    }));
    for (const [k, v] of Object.entries(wired)) expect(v, `App.${k}`).toBe('function');

    // 2. Clicking the zoom % opens the rail ONLY - Zoom Settings no longer
    // pops up in the middle of the screen (it lives behind the rail's gear).
    await page.locator('#zoomPct').click();
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });
    expect(await page.evaluate(() => document.getElementById('zoomModal').classList.contains('visible'))).toBe(false);

    // 3. Clicking the zoom % again toggles the rail closed.
    await page.locator('#zoomPct').click();
    await page.waitForFunction(() => !document.getElementById('zoomRail').classList.contains('visible'), { timeout: 3000 });

    // 4. The gear opens Zoom Settings; the rail stays up alongside the modal.
    await page.locator('#zoomPct').click();
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });
    await page.locator('#zoomRailSettings').click();
    await page.waitForSelector('#zoomModal.visible', { timeout: 3000 });
    expect(await page.evaluate(() => document.getElementById('zoomRail').classList.contains('visible'))).toBe(true);
    await page.locator('#zoomModalClose').click();
    await page.waitForFunction(() => !document.getElementById('zoomModal')?.classList.contains('visible'), { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('zoomRail').classList.contains('visible'))).toBe(true);

    expect(errors).toEqual([]);
  });

  test('rail auto-fades away after ~5s without interaction', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    await page.evaluate(() => window.App.openZoomRail());
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });

    // Untouched, the rail fades out (5s idle + 0.35s fade) and fully hides.
    await page.waitForFunction(() => !document.getElementById('zoomRail').classList.contains('visible'), { timeout: 8000 });

    // The thumb is the accent yellow (visual contract for the grab handle).
    await page.evaluate(() => window.App.openZoomRail());
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });
    const thumbBg = await page.evaluate(() => getComputedStyle(document.getElementById('zoomRailThumb')).backgroundColor);
    expect(thumbBg).toBe('rgb(232, 197, 71)');   // var(--accent) #e8c547

    expect(errors).toEqual([]);
  });

  test('dragging the track zooms (log scale) and clamps to [20%, maxZoom]; footer % stays in sync', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    await page.evaluate(() => window.App.openZoomRail());
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });
    const before = await page.evaluate(() => window.state.zoom);

    const box = await page.locator('#zoomRailTrack').boundingBox();
    expect(box).not.toBeNull();
    const cx = box.x + box.width / 2;

    // Drag from the middle to past the top (pointer capture tracks beyond the
    // element; t clamps to 1) -> zoom rises to the max (400% default).
    await page.mouse.move(cx, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(cx, box.y - 20, { steps: 8 });
    await page.mouse.up();
    const atTop = await page.evaluate(() => ({ zoom: window.state.zoom, max: window.App.getMaxZoom(), pct: document.getElementById('zoomPct').textContent }));
    expect(atTop.zoom).toBeGreaterThan(before);
    expect(atTop.zoom).toBeLessThanOrEqual(atTop.max);
    expect(atTop.zoom).toBeGreaterThan(atTop.max * 0.95);   // top of the track = max zoom
    expect(atTop.pct).toBe(Math.round(atTop.zoom * 100) + '%');

    // Drag to past the bottom (t clamps to 0) -> the hard 0.2 floor.
    await page.mouse.move(cx, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(cx, box.y + box.height + 20, { steps: 8 });
    await page.mouse.up();
    const atBottom = await page.evaluate(() => ({ zoom: window.state.zoom, pct: document.getElementById('zoomPct').textContent }));
    expect(atBottom.zoom).toBeCloseTo(0.2, 5);
    expect(atBottom.pct).toBe('20%');

    // The rail is still open and the PDF still renders after the commit.
    expect(await page.evaluate(() => document.getElementById('zoomRail').classList.contains('visible'))).toBe(true);
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, { timeout: 5000 });

    expect(errors).toEqual([]);
  });

  test('ticks are log-spaced round percents and rebuild when max zoom changes', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    await page.evaluate(() => window.App.openZoomRail());
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });

    // Default max 400% -> ticks at 25/50/75/100/150/200/300/400.
    expect(await page.locator('#zoomRailTicks .zoom-rail-tick').count()).toBe(8);

    // Raise the max to 1200% via the Zoom Settings modal while the rail is open;
    // the updateUI() on modal close fires onZoomRailSync -> ticks rebuild.
    await page.evaluate(() => window.App.showZoomModal());
    await page.waitForSelector('#zoomModal.visible', { timeout: 3000 });
    await page.evaluate(() => { const m = document.getElementById('zoomMax'); m.value = '1200'; m.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#zoomModalClose').click();
    await page.waitForFunction(() => !document.getElementById('zoomModal')?.classList.contains('visible'), { timeout: 5000 });
    expect(await page.locator('#zoomRailTicks .zoom-rail-tick').count()).toBe(11);   // + 600/800/1200

    expect(errors).toEqual([]);
  });

  test('thumb resyncs when zoom changes outside the rail (wheel/±/fit paths call updateUI)', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    await page.evaluate(() => window.App.openZoomRail());
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });
    const topBefore = await page.evaluate(() => document.getElementById('zoomRailThumb').style.top);

    await page.evaluate(() => { window.state.zoom = 2; window.App.renderPdf(); window.App.updateUI(); });
    const after = await page.evaluate(() => ({
      top: document.getElementById('zoomRailThumb').style.top,
      label: document.getElementById('zoomRailThumbLabel').textContent,
    }));
    expect(after.label).toBe('200%');
    expect(after.top).not.toBe(topBefore);

    expect(errors).toEqual([]);
  });

  test('mobile: zoom-% opens the rail only (no modal, old popover gone); +/− buttons step zoom', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 390, height: 844 });
    await bootWithPdf(page, errors);

    await page.locator('#zoomPct').click();
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });
    const opened = await page.evaluate(() => ({
      modalVisible: document.getElementById('zoomModal')?.classList.contains('visible'),
      popover: document.getElementById('zoomOverlay'),
    }));
    expect(opened.modalVisible).toBe(false);
    expect(opened.popover).toBeNull();

    // +/− step exactly one zoom-ladder rung (constants.js nextRungUp/Down).
    const before = await page.evaluate(() => window.state.zoom);
    await page.locator('#zoomRailPlus').click();
    // eslint-disable-next-line no-undef
    const expectedUp = await page.evaluate((z) => nextRungUp(z, 0.2, window.App.getMaxZoom()), before);
    expect(await page.evaluate(() => window.state.zoom)).toBeCloseTo(expectedUp, 5);
    await page.locator('#zoomRailMinus').click();
    // eslint-disable-next-line no-undef
    const expectedDown = await page.evaluate((z) => nextRungDown(z, 0.2, window.App.getMaxZoom()), expectedUp);
    expect(await page.evaluate(() => window.state.zoom)).toBeCloseTo(expectedDown, 5);

    // The +/− clicks must not dismiss the rail (stopPropagation).
    expect(await page.evaluate(() => document.getElementById('zoomRail').classList.contains('visible'))).toBe(true);

    expect(errors).toEqual([]);
  });

  test('outside click and Escape dismiss the rail', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    await page.evaluate(() => window.App.openZoomRail());
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });

    // Click on the canvas (outside the rail / zoom % / zoom modal) -> dismissed.
    await page.mouse.click(400, 300);
    await page.waitForFunction(() => !document.getElementById('zoomRail').classList.contains('visible'), { timeout: 3000 });

    // Reopen, then Escape -> dismissed.
    await page.evaluate(() => window.App.openZoomRail());
    await page.waitForSelector('#zoomRail.visible', { timeout: 3000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('zoomRail').classList.contains('visible'), { timeout: 3000 });

    expect(errors).toEqual([]);
  });
});

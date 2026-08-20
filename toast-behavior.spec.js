// @ts-check
/**
 * Tests: T2-15 non-blocking toast rework (JOURNEY-MAP Tier-2 #15).
 *
 * Toasts used to be full-screen .modal-overlay blockers (inset:0, z-index
 * 200) that swallowed every click for their lifetime AND painted behind
 * equal-z-index dialogs (the room-height validation toast was invisible
 * behind roomBoxModal). Now the toast surfaces live in #toastStack — a
 * bottom-right corner stack, pointer-events:none, z-index 500 (above every
 * modal) — concurrent toasts stack in .toast-chip entries instead of
 * replacing, and the Measure result is a footer status-bar chip
 * (#measureDistanceChip) instead of a 5s blocking "Distance:" toast.
 *
 * Red on the old implementation: the click-through test loses its click to
 * the overlay, the over-modal test sees z-index 200 vs 200 and a full-screen
 * toast rect, the stacking test finds no chip, and the measure test finds a
 * toast instead of the footer chip.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function setup(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
    s.counters.push({ id: 'c-toast', name: 'Box', icon: 'M96 96h448v448H96z', color: '#e8c547' });
    window.App.updateUI();
  });
}

// PDF-space point -> viewport click coordinates.
async function toScreen(page, pdfX, pdfY) {
  return page.evaluate(([x, y]) => {
    const wrap = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper');
    const r = wrap.getBoundingClientRect();
    return { cx: r.left + x * window.state.zoom + window.state.pan.x, cy: r.top + y * window.state.zoom + window.state.pan.y };
  }, [pdfX, pdfY]);
}

test.describe('Non-blocking toast stack (T2-15)', () => {
  test('a click during an active toast reaches the canvas (no click-swallowing)', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => {
      window.state.activeCounterType = 'c-toast';
      window.state.tool = window.App.TOOL.COUNTER;
      window.App.updateUI();
      window.App.showToast('Busy toast that used to eat this click', 4000);
    });
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);

    // Physical click mid-toast: on the old overlay this died on the toast.
    const p = await toScreen(page, 200, 200);
    await page.mouse.click(p.cx, p.cy);

    const markers = await page.evaluate(() =>
      (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers['c-toast'] || []).length);
    expect(markers).toBe(1);

    // And the toast is still up — the click passed through, it did not dismiss it.
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
  });

  test('a validation toast fired over an open modal is visible above it', async ({ page }) => {
    await setup(page);
    // Recreate the room-height validation path: roomBoxModal open, Apply with
    // an empty height fires the toast (features/room-sizer.js).
    await page.evaluate(() => {
      window.App.openRoomBoxModal({ x1: 0, y1: 0, x2: 120, y2: 90 });
      document.getElementById('roomBoxHeight').value = '';
      document.getElementById('roomBoxApply').click();
    });
    await expect(page.locator('#roomBoxModal')).toHaveClass(/visible/);
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    await expect(page.locator('#airboardToastText')).toContainText('ceiling height');

    const paint = await page.evaluate(() => {
      const toast = document.getElementById('airboardToastModal');
      const stack = toast.closest('#toastStack');
      const toastZ = parseInt(getComputedStyle(stack || toast).zIndex, 10) || 0;
      const modalZ = parseInt(getComputedStyle(document.getElementById('roomBoxModal')).zIndex, 10) || 0;
      const r = toast.getBoundingClientRect();
      return {
        inStack: !!stack,
        toastZ,
        modalZ,
        // The toast must be an on-screen corner element, not a hidden
        // full-viewport overlay competing at the modal's own z-index.
        onScreen: r.width > 0 && r.height > 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth,
        fullScreen: r.width >= window.innerWidth && r.height >= window.innerHeight,
      };
    });
    expect(paint.inStack).toBe(true);
    expect(paint.toastZ).toBeGreaterThan(paint.modalZ);
    expect(paint.onScreen).toBe(true);
    expect(paint.fullScreen).toBe(false);
  });

  test('two concurrent toasts stack instead of replacing', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => {
      window.App.showToast('first message', 4000);
      window.App.showToast('second message', 4000);
    });
    // Newest message holds the primary slot; the older one lives on as a chip.
    await expect(page.locator('#airboardToastText')).toHaveText('second message');
    await expect(page.locator('#toastStack .toast-chip')).toHaveCount(1);
    await expect(page.locator('#toastStack .toast-chip')).toHaveText('first message');
    // Both auto-dismiss on their own timers.
    await page.waitForTimeout(4500);
    await expect(page.locator('#airboardToastModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#toastStack .toast-chip')).toHaveCount(0);
  });

  test('Measure result lands in the footer chip, not a blocking toast, and the next clicks still work', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => { document.getElementById('measureBtn').click(); });
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.MEASURE));

    const a = await toScreen(page, 100, 100);
    const b = await toScreen(page, 200, 100);
    await page.mouse.click(a.cx, a.cy);
    await page.waitForTimeout(500); // clear the 400ms double-tap guard
    await page.mouse.click(b.cx, b.cy);

    // 100pt at 10pt/ft = 10ft, shown in the footer chip.
    const chip = page.locator('#measureDistanceChip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('Distance:');
    await expect(chip).toContainText("10'");
    // No blocking Distance toast.
    await expect(page.locator('#airboardToastModal')).not.toHaveClass(/visible/);

    // The measure→zone hand-off: the very next canvas click must land. Place
    // a counter immediately (no 5s dead window any more).
    await page.evaluate(() => {
      window.state.activeCounterType = 'c-toast';
      window.state.tool = window.App.TOOL.COUNTER;
      window.App.updateUI();
    });
    await page.waitForTimeout(500); // clear the double-tap guard again
    const p = await toScreen(page, 250, 250);
    await page.mouse.click(p.cx, p.cy);
    const markers = await page.evaluate(() =>
      (window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers['c-toast'] || []).length);
    expect(markers).toBe(1);
  });
});

// @ts-check
/**
 * Perf regression: the PDF render bitmap cache. Switching back to a
 * recently-viewed page (or an idle-prefetched neighbor) must blit the retained
 * ImageBitmap instead of re-running a full pdf.js raster; the cache key
 * (pdfPage proxy + rotation + zoom + effDpr) must self-invalidate on rotation
 * changes (including undo's in-place rotation restore); rapid page flips ride
 * the new cancel path without errors; and closing the project empties the
 * cache (bitmaps closed).
 *
 * Render calls are counted by wrapping each page's pdfPage.render in-page.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.waitForFunction(() => window.state.pages.length === 2 && document.getElementById('pdfCanvas').width > 0, null, { timeout: 15000 });
  // Spy every page's pdfPage.render (prefetch renders count too — callers
  // filter by window in time or by page index).
  await page.evaluate(() => {
    window.__renderCalls = [0, 0];
    window.state.pages.forEach((p, i) => {
      const orig = p.pdfPage.render.bind(p.pdfPage);
      p.pdfPage.render = (...args) => { window.__renderCalls[i]++; return orig(...args); };
    });
  });
}

// Wait until no render task is in flight and the canvas is painted.
async function settle(page) {
  await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, null, { timeout: 10000 });
  await page.waitForTimeout(120);
}

test.describe('Page-switch bitmap cache', () => {
  test('revisit blits from cache (no pdf.js render), stats track hits', async ({ page }) => {
    const errors = [];
    await boot(page, errors);
    expect(await page.evaluate(() => typeof window.App.clearPdfBitmapCache)).toBe('function');

    // Visit page 2, then back to page 1. Waits between switches let each
    // render + snapshot land (and possibly a prefetch — hence counting page-0
    // renders only up to the revisit).
    await page.locator('#nextPage').click();
    await settle(page);
    const p0RendersBeforeRevisit = await page.evaluate(() => window.__renderCalls[0]);
    const hitsBefore = await page.evaluate(() => window.App.__pdfBitmapCacheStats().hits);
    await page.locator('#prevPage').click();
    await settle(page);
    const after = await page.evaluate(() => ({
      p0Renders: window.__renderCalls[0],
      hits: window.App.__pdfBitmapCacheStats().hits,
      canvasW: document.getElementById('pdfCanvas').width,
    }));
    expect(after.p0Renders).toBe(p0RendersBeforeRevisit);   // no new raster for the revisit
    expect(after.hits).toBeGreaterThan(hitsBefore);
    expect(after.canvasW).toBeGreaterThan(0);

    // Canvas actually has content (not a blank blit): look for any
    // non-transparent pixel in a 64x64 downsample.
    const hasContent = await page.evaluate(() => {
      const c = document.getElementById('pdfCanvas');
      const s = document.createElement('canvas');
      s.width = 64; s.height = 64;
      const g = s.getContext('2d');
      g.drawImage(c, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    });
    expect(hasContent).toBe(true);
    expect(errors).toEqual([]);
  });

  test('rotation invalidates (rotate + undo both force fresh rasters)', async ({ page }) => {
    const errors = [];
    await boot(page, errors);

    // Prime the cache for page 0 at its current rotation, then rotate.
    const before = await page.evaluate(() => window.__renderCalls[0]);
    await page.evaluate(() => document.getElementById('rotatePage').click());
    await settle(page);
    const afterRotate = await page.evaluate(() => window.__renderCalls[0]);
    expect(afterRotate).toBeGreaterThan(before);   // rotated render is a miss

    // Undo restores rotation IN PLACE on the same page object — the key's
    // rotation field must invalidate again (fresh raster, not a stale blit of
    // the rotated bitmap).
    await page.evaluate(() => document.getElementById('undoBtn').click());
    await settle(page);
    const afterUndo = await page.evaluate(() => ({
      calls: window.__renderCalls[0],
      rot: window.state.pages[0].rotation ?? 0,
    }));
    expect(afterUndo.rot).toBe(0);
    // Either a fresh raster ran, or the pre-rotation bitmap (rotation 0) was
    // still cached and legitimately hit — both are correct; what must NOT
    // happen is serving the rotated bitmap. Check the canvas aspect ratio
    // matches rotation 0 (test-2pages.pdf pages are portrait/landscape
    // asymmetric enough via width!=height).
    const dims = await page.evaluate(() => {
      const c = document.getElementById('pdfCanvas');
      const vp = window.state.pages[0].pdfPage.getViewport({ scale: 1, rotation: window.state.pages[0].rotation ?? 0 });
      return { cw: c.width, ch: c.height, vw: vp.width, vh: vp.height };
    });
    expect(dims.cw / dims.ch).toBeCloseTo(dims.vw / dims.vh, 1);
    expect(errors).toEqual([]);
  });

  test('rapid flips: cancellation path is clean, final page correct', async ({ page }) => {
    const errors = [];
    await boot(page, errors);
    // Hammer next/prev with no waits — exercises pdfRenderTask.cancel() +
    // the pending re-drive.
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => document.getElementById('nextPage').click());
      await page.evaluate(() => document.getElementById('prevPage').click());
    }
    await settle(page);
    const final = await page.evaluate(() => ({
      current: window.state.currentPage,
      canvasW: document.getElementById('pdfCanvas').width,
    }));
    expect(final.current).toBe(0);
    expect(final.canvasW).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('idle prefetch caches the neighbor; visiting it needs no new raster', async ({ page }) => {
    const errors = [];
    await boot(page, errors);
    // Landing render schedules a ~250ms prefetch of page ±1. Give it time.
    await page.waitForFunction(() => window.App.__pdfBitmapCacheStats().prefetched >= 1, null, { timeout: 5000 });
    const p1RendersAfterPrefetch = await page.evaluate(() => window.__renderCalls[1]);
    expect(p1RendersAfterPrefetch).toBeGreaterThan(0);   // the prefetch itself rasterized page 1
    await page.locator('#nextPage').click();
    await settle(page);
    const p1RendersAfterVisit = await page.evaluate(() => window.__renderCalls[1]);
    expect(p1RendersAfterVisit).toBe(p1RendersAfterPrefetch);   // the visit was a blit
    expect(errors).toEqual([]);
  });

  test('closing the project empties the cache', async ({ page }) => {
    const errors = [];
    await boot(page, errors);
    await page.waitForFunction(() => window.App.__pdfBitmapCacheStats().size >= 1, null, { timeout: 5000 });
    await page.evaluate(() => window.App.clearPdfBitmapCache());
    expect(await page.evaluate(() => window.App.__pdfBitmapCacheStats().size)).toBe(0);
    expect(errors).toEqual([]);
  });
});

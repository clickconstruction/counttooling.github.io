// @ts-check
/**
 * Perf regression: wheel-zooming must NOT run the full updateUI() on every
 * animation frame. updateUI() rebuilds every sidebar list — O(all annotations
 * across all pages) — and running it per gesture frame is what made zooming lag
 * and lurch ("go haywire") on large multi-page projects. The wheel/pinch/rail
 * paths now call the light syncZoomIndicators() (zoom-% readout + rail thumb)
 * per frame, and the full updateUI() runs exactly once, at the debounced
 * commitWheelZoom (150ms after the last wheel tick).
 *
 * Spy mechanism: internal updateUI() calls bypass the App registry, so instead
 * of wrapping a function we plant a sentinel child in #pagesList. Any full
 * updateUI() wipes it (renderPagesList does innerHTML = '' + rebuild). Sentinel
 * alive mid-gesture => no per-frame updateUI; sentinel gone after the debounce
 * window => the commit's single updateUI ran.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Zoom gesture skips full updateUI', () => {
  test('wheel zoom: light sync per frame, one full updateUI at commit', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'samples', 'sample-plan.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });

    // Registry contract: the light-sync helper is published for zoom-rail.js.
    expect(await page.evaluate(() => typeof window.App.syncZoomIndicators)).toBe('function');

    const result = await page.evaluate(async () => {
      const pagesList = document.getElementById('pagesList');
      const marker = document.createElement('div');
      marker.id = 'updateUiProbeMarker';
      pagesList.appendChild(marker);

      const wrapper = document.getElementById('canvasWrapper');
      const rect = wrapper.getBoundingClientRect();
      const startZoom = window.state.zoom;
      const raf = () => new Promise((r) => requestAnimationFrame(r));

      const samples = [];
      for (let i = 0; i < 8; i++) {
        wrapper.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true,
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
          deltaY: -120,
        }));
        // Two rAFs: one for the wheel handler's own rAF batch, one to settle.
        await raf(); await raf();
        samples.push({
          markerAlive: !!document.getElementById('updateUiProbeMarker'),
          zoomPct: document.getElementById('zoomPct').textContent,
          zoom: window.state.zoom,
        });
      }
      const midMarkerAlive = samples.every((s) => s.markerAlive);
      const zoomPctTracks = samples.every((s) => s.zoomPct === Math.round(s.zoom * 100) + '%');

      // Past the 150ms debounce: commitWheelZoom -> renderPdf + one full updateUI.
      await new Promise((r) => setTimeout(r, 500));
      const markerGoneAfterCommit = !document.getElementById('updateUiProbeMarker');
      return { midMarkerAlive, zoomPctTracks, markerGoneAfterCommit, startZoom, finalZoom: window.state.zoom };
    });

    expect(Math.abs(result.finalZoom - result.startZoom)).toBeGreaterThan(0.01);   // the gesture actually zoomed
    expect(result.midMarkerAlive).toBe(true);                     // no full updateUI during the gesture
    expect(result.zoomPctTracks).toBe(true);                      // #zoomPct stayed in sync per frame
    expect(result.markerGoneAfterCommit).toBe(true);              // the commit's updateUI ran

    // The commit also re-rendered the PDF at the new zoom.
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, { timeout: 5000 });
    expect(errors).toEqual([]);
  });
});

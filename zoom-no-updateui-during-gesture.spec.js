// @ts-check
/**
 * Perf regression: zooming must not run the full updateUI() AT ALL — neither
 * per animation frame nor at the debounced commit. updateUI() rebuilds every
 * sidebar list — O(all annotations across all pages) — and none of that
 * depends on zoom; running it per gesture frame made zooming lag and lurch
 * ("go haywire") on large multi-page projects, and running it at the commit
 * put a jank spike right at gesture end. The wheel/pinch/rail/± paths call
 * only the light syncZoomIndicators() (zoom-% readout + rail thumb); the
 * commit does renderPdf + syncZoomIndicators.
 *
 * Spy mechanism: internal updateUI() calls bypass the App registry, so instead
 * of wrapping a function we plant a sentinel child in #pagesList. Any full
 * updateUI() wipes it (renderPagesList does innerHTML = '' + rebuild). Sentinel
 * alive mid-gesture AND after the debounce window => no full updateUI on the
 * zoom path; an explicit App.updateUI() at the end proves the sentinel
 * mechanism itself still works.
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

      // Past the 150ms debounce: commitWheelZoom -> renderPdf + light sync only.
      await new Promise((r) => setTimeout(r, 500));
      const markerAliveAfterCommit = !!document.getElementById('updateUiProbeMarker');
      const pctAfterCommit = document.getElementById('zoomPct').textContent;
      // Sanity: a real full updateUI still wipes the sentinel (the spy works).
      window.App.updateUI();
      const markerGoneAfterExplicitUpdateUI = !document.getElementById('updateUiProbeMarker');
      return { midMarkerAlive, zoomPctTracks, markerAliveAfterCommit, pctAfterCommit, markerGoneAfterExplicitUpdateUI, startZoom, finalZoom: window.state.zoom };
    });

    expect(Math.abs(result.finalZoom - result.startZoom)).toBeGreaterThan(0.01);   // the gesture actually zoomed
    expect(result.midMarkerAlive).toBe(true);                     // no full updateUI during the gesture
    expect(result.zoomPctTracks).toBe(true);                      // #zoomPct stayed in sync per frame
    expect(result.markerAliveAfterCommit).toBe(true);             // the commit skipped the full updateUI too
    expect(result.pctAfterCommit).toBe(Math.round(result.finalZoom * 100) + '%');  // commit kept indicators synced
    expect(result.markerGoneAfterExplicitUpdateUI).toBe(true);    // spy mechanism still valid

    // The commit also re-rendered the PDF at the new zoom.
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, { timeout: 5000 });
    expect(errors).toEqual([]);
  });
});

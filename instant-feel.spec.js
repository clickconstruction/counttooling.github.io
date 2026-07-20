// @ts-check
/**
 * Tests: the "instant feel" pass — rung-riding, the debounced placement
 * sidebar refresh, and the interaction-latency telemetry.
 *
 *   1. Rung-riding: with the surrounding rungs prefetched, a continuous wheel
 *      gesture swaps the BASE canvas to nearer cached rungs MID-GESTURE
 *      (buffer size changes between ticks, before any commit debounce), so
 *      the view re-sharpens while zooming instead of after.
 *   2. Placement: clicking a counter paints the mark immediately but does NOT
 *      rebuild the sidebar synchronously (sentinel survives the click); the
 *      debounced updateUI lands within ~300ms (sentinel gone).
 *   3. Telemetry: App.__perfSamples reports place/zoom/undo/render/updateUI
 *      sample rings with p50/p95, and the summary rides the display-info
 *      object used by the Save Status envelope.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Instant-feel pass', () => {
  test('rung-riding mid-gesture, debounced placement sidebar, telemetry', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.waitForFunction(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      return !!c && c.width > 0;
    });

    // Warm the ladder around the current zoom (r0 ± 2 now prefetched).
    const rungs = await page.evaluate(() => {
      const maxZ = window.App.getMaxZoom();
      /* eslint-disable no-undef */
      const r0 = snapZoomToRung(window.state.zoom, 0.2, maxZ);
      const u1 = nextRungUp(r0, 0.2, maxZ);
      return { r0, u1, u2: nextRungUp(u1, 0.2, maxZ) };
      /* eslint-enable no-undef */
    });
    await page.waitForFunction((r) => {
      const keys = window.App.__pdfBitmapCacheKeys();
      const has = (z) => keys.some((k) => Math.abs(k.zoom - z) < 1e-6);
      return has(r.r0) && has(r.u1) && has(r.u2);
    }, rungs, { timeout: 20000 });

    // 1. Continuous zoom-in gesture: the base buffer must change size
    //    MID-GESTURE (a rung-ride blit), not only after the 150ms commit.
    const ride = await page.evaluate(async () => {
      const wrapper = document.getElementById('canvasWrapper');
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      const pdfC = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      const widths = new Set([pdfC.width]);
      const hitsBefore = window.App.__pdfBitmapCacheStats().hits;
      for (let i = 0; i < 8; i++) {
        wrapper.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: 120 }));
        await raf(); await raf();
        widths.add(pdfC.width);   // sampled mid-gesture — commit debounce hasn't fired
      }
      return {
        distinctWidthsMidGesture: widths.size,
        hitsGained: window.App.__pdfBitmapCacheStats().hits - hitsBefore,
        zoomContinuous: window.state.zoom,
      };
    });
    expect(ride.distinctWidthsMidGesture).toBeGreaterThanOrEqual(2);   // base swapped during the gesture
    expect(ride.hitsGained).toBeGreaterThanOrEqual(1);                 // via cache blits, not rasters
    await page.waitForTimeout(400);                                    // let the commit settle

    // 2. Counter placement: mark paints immediately; sidebar rebuild is
    //    debounced (sentinel survives the click, gone within ~300ms).
    const placed = await page.evaluate(async () => {
      const s = window.state;
      const cid = window.App.uid();
      // eslint-disable-next-line no-undef
      s.counters.push({ id: cid, name: 'Instant Spec', icon: (typeof CIRCLE_PATH !== 'undefined') ? CIRCLE_PATH : 'M0 0h10v10H0z', color: '#e8c547' });
      s.tool = window.App.TOOL.COUNTER;
      s.activeCounterType = cid;
      const pagesList = document.getElementById('pagesList');
      const marker = document.createElement('div');
      marker.id = 'placeProbeMarker';
      pagesList.appendChild(marker);
      const wrapper = document.getElementById('canvasWrapper');
      const rect = wrapper.getBoundingClientRect();
      // Click a point guaranteed INSIDE the page: pdf (100,100) mapped to
      // wrapper coords (the wrapper center can sit beyond a portrait page's
      // right edge in a landscape window — out of bounds by design).
      const cx = rect.left + s.pan.x + 100 * s.zoom;
      const cy = rect.top + s.pan.y + 100 * s.zoom;
      wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
      const ann = window.App.ensureActiveCanvas(s.pages[s.currentPage]).annotations;
      const placedCount = (ann.counterMarkers[cid] || []).length;
      const sentinelAliveAfterClick = !!document.getElementById('placeProbeMarker');
      await new Promise((r) => setTimeout(r, 350));
      const sentinelGoneAfterDebounce = !document.getElementById('placeProbeMarker');
      return { placedCount, sentinelAliveAfterClick, sentinelGoneAfterDebounce };
    });
    expect(placed.placedCount).toBe(1);                       // the mark landed
    expect(placed.sentinelAliveAfterClick).toBe(true);        // no synchronous sidebar rebuild
    expect(placed.sentinelGoneAfterDebounce).toBe(true);      // debounced updateUI caught up

    // 3. Telemetry: sample rings populated, summary shape sound.
    const perf = await page.evaluate(() => window.App.__perfSamples());
    for (const k of ['placeMs', 'zoomCrispMs', 'undoSnapshotMs', 'renderAnnotationsMs', 'updateUIMs']) {
      expect(perf.summary[k]).toBeTruthy();
    }
    expect(perf.summary.placeMs.n).toBeGreaterThanOrEqual(1);
    expect(perf.summary.renderAnnotationsMs.n).toBeGreaterThanOrEqual(1);
    expect(perf.summary.updateUIMs.n).toBeGreaterThanOrEqual(1);
    expect(perf.summary.placeMs.p95).not.toBeNull();

    expect(errors).toEqual([]);
  });
});

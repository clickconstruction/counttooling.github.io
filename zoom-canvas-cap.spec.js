// @ts-check
/**
 * Regression: zooming in too far used to size the PDF canvas buffer beyond the
 * browser's max canvas dimension/area, so it rendered blank/black. The fix clamps
 * an "effective DPR" so the buffer always fits; the bitmap softens past the cap but
 * never disappears, and logical zoom/layout are unchanged.
 *
 * This drives the zoom past the device's dimension cap and asserts (a) the pdfCanvas
 * buffer stays within the detected cap, (b) the clamp actually engaged (effDpr < dpr),
 * and (c) the page still rendered content (not a blank canvas). Reads the caps via the
 * registry (window.App.getCanvasCaps / window.App.effectiveDpr).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Zoom canvas cap', () => {
  test('extreme zoom clamps the buffer under the device cap and still renders', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Use the sample floor plan (has real line content to detect after clamping).
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'samples', 'sample-plan.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });

    // Force a small cap so the clamp engages at a modest zoom (fast, deterministic
    // buffer) instead of rendering a ~16k-px canvas, then zoom 50% past it.
    const setup = await page.evaluate(() => {
      const maxDim = 2000, maxArea = 2000 * 1500;
      window.App.setCanvasCaps({ maxDim, maxArea });
      const p = window.state.pages[window.state.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const dpr = window.devicePixelRatio || 1;
      const longest = Math.max(vp.width, vp.height);
      const zoom = (maxDim / (longest * dpr)) * 1.5;
      window.state.maxZoom = Math.max(window.state.maxZoom || 0, zoom + 1);
      window.state.zoom = zoom;
      window.App.renderPdf();
      return { maxDim, maxArea, dpr, zoom };
    });

    // Wait until the buffer matches the clamped target for this zoom (render landed).
    await page.waitForFunction(() => {
      const c = document.getElementById('pdfCanvas');
      const p = window.state.pages[window.state.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const eff = window.App.effectiveDpr(p, window.state.zoom);
      const expectedW = Math.round(vp.width * window.state.zoom * eff);
      return c.width > 0 && Math.abs(c.width - expectedW) <= 2;
    }, null, { timeout: 12000 });

    const result = await page.evaluate(() => {
      const c = document.getElementById('pdfCanvas');
      const p = window.state.pages[window.state.currentPage];
      const eff = window.App.effectiveDpr(p, window.state.zoom);
      // Content check: downscale the whole buffer into 64x64 and look for any
      // non-transparent pixel (the plan's lines). A blank/black canvas has none.
      const tmp = document.createElement('canvas'); tmp.width = 64; tmp.height = 64;
      const tg = tmp.getContext('2d');
      tg.drawImage(c, 0, 0, 64, 64);
      const data = tg.getImageData(0, 0, 64, 64).data;
      let hasContent = false;
      for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) { hasContent = true; break; } }
      return { w: c.width, h: c.height, eff, hasContent };
    });

    // (a) buffer never exceeds the detected cap — the actual fix.
    expect(result.w).toBeLessThanOrEqual(setup.maxDim);
    expect(result.h).toBeLessThanOrEqual(setup.maxDim);
    expect(result.w * result.h).toBeLessThanOrEqual(setup.maxArea);
    // (b) the clamp engaged at this zoom.
    expect(result.eff).toBeLessThan(setup.dpr);
    // (c) the page still rendered content (not a blank/black canvas).
    expect(result.hasContent).toBe(true);

    expect(errors).toEqual([]);
  });

  // Helper: load the sample plan and inject a spread of counter markers so the
  // annotation overlay has real content to detect after a clamped render.
  async function loadPlanWithMarkers(page) {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'samples', 'sample-plan.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await page.evaluate(() => {
      const s = window.state, p = s.pages[s.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const cid = 'cap_' + Date.now();
      s.counters.push({ id: cid, name: 'CapTest', icon: 'M0 0 H512 V512 H0 Z', color: '#e8c547' });
      const cv = p.canvases[0];
      cv.annotations.counterMarkers = cv.annotations.counterMarkers || {};
      const marks = [];
      let n = 1;
      for (let r = 1; r <= 6; r++) for (let c = 1; c <= 6; c++) marks.push({ x: vp.width * c / 7, y: vp.height * r / 7, n: n++ });
      cv.annotations.counterMarkers[cid] = marks;
    });
  }

  // Regression for the reported bug: the annotation overlay (counts) must be sized to
  // exactly match the PDF canvas and must not be blank after an area-budgeted clamp.
  test('area budget keeps the overlay sized to the PDF canvas and painted', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await loadPlanWithMarkers(page);

    const setup = await page.evaluate(() => {
      const maxDim = 100000, maxArea = 6000000;   // dim non-binding -> area is the constraint
      window.App.setCanvasCaps({ maxDim, maxArea });
      window.state.maxZoom = 30;
      window.state.zoom = 8;
      window.App.renderPdf();
      return { maxDim, maxArea, safety: window.App.__getRenderAreaSafety() };
    });

    await page.waitForFunction(() => {
      const c = document.getElementById('pdfCanvas');
      const p = window.state.pages[window.state.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const eff = window.App.effectiveDpr(p, window.state.zoom);
      const expectedW = Math.round(vp.width * window.state.zoom * eff);
      return c.width > 0 && Math.abs(c.width - expectedW) <= 2;
    }, null, { timeout: 12000 });

    const result = await page.evaluate(() => {
      const pc = document.getElementById('pdfCanvas');
      const ac = document.getElementById('annCanvas');
      // overlay content: downscale annCanvas to 64x64, look for any painted pixel.
      const tmp = document.createElement('canvas'); tmp.width = 64; tmp.height = 64;
      const tg = tmp.getContext('2d');
      tg.drawImage(ac, 0, 0, 64, 64);
      const data = tg.getImageData(0, 0, 64, 64).data;
      let overlayPainted = false;
      for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) { overlayPainted = true; break; } }
      return { pcW: pc.width, pcH: pc.height, acW: ac.width, acH: ac.height, overlayPainted };
    });

    // overlay buffer matches the PDF buffer exactly (the consistency invariant).
    expect(result.acW).toBe(result.pcW);
    expect(result.acH).toBe(result.pcH);
    // buffer stays under the BUDGETED area cap (renderAreaSafety applied).
    expect(result.pcW * result.pcH).toBeLessThanOrEqual(setup.maxArea * setup.safety * 1.03);
    // the counts actually painted (not a blank overlay).
    expect(result.overlayPainted).toBe(true);
    expect(errors).toEqual([]);
  });

  // Helper: wait until the PDF render has landed at the clamped target for the zoom.
  function waitRenderSettled(page) {
    return page.waitForFunction(() => {
      const c = document.getElementById('pdfCanvas');
      const p = window.state.pages[window.state.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const eff = window.App.effectiveDpr(p, window.state.zoom);
      return c.width > 0 && Math.abs(c.width - Math.round(vp.width * window.state.zoom * eff)) <= 2;
    }, null, { timeout: 12000 });
  }

  // The read-back guard: a render that reads back blank ratchets renderAreaSafety down
  // and re-renders smaller, so a would-be-blank overlay becomes a softer, visible one.
  test('a blank read-back ratchets the safety knob down and still renders', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await loadPlanWithMarkers(page);

    // Clean baseline at safety 0.5 (no fault injection), fully settled.
    await page.evaluate(() => {
      window.App.setCanvasCaps({ maxDim: 100000, maxArea: 6000000 });
      window.state.maxZoom = 30;
      window.state.zoom = 8;
      window.App.renderPdf();
    });
    await waitRenderSettled(page);
    const safety0 = await page.evaluate(() => window.App.__getRenderAreaSafety());

    // Arm a one-shot blank on the next 1x1 corner probe (the guard), then re-render.
    await page.evaluate(() => {
      const orig = CanvasRenderingContext2D.prototype.getImageData;
      window.__origGID = orig;
      let armed = true;
      CanvasRenderingContext2D.prototype.getImageData = function (...a) {
        const d = orig.apply(this, a);
        if (armed && a[2] === 1 && a[3] === 1 && d.data.length >= 4) { armed = false; d.data[3] = 0; }
        return d;
      };
      window.App.renderPdf();
    });
    await page.waitForFunction(() => window.App.__getRenderAreaSafety() < 0.5, null, { timeout: 12000 });

    // Remove the fault and do one clean final render so the overlay settles consistently.
    await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.getImageData = window.__origGID;
      window.App.renderPdf();
    });
    await waitRenderSettled(page);

    const result = await page.evaluate(() => {
      const pc = document.getElementById('pdfCanvas');
      const ac = document.getElementById('annCanvas');
      const tmp = document.createElement('canvas'); tmp.width = 64; tmp.height = 64;
      const tg = tmp.getContext('2d');
      tg.drawImage(ac, 0, 0, 64, 64);
      const data = tg.getImageData(0, 0, 64, 64).data;
      let overlayPainted = false;
      for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) { overlayPainted = true; break; } }
      return { safety: window.App.__getRenderAreaSafety(), pcW: pc.width, acW: ac.width, overlayPainted };
    });

    expect(result.safety).toBeLessThan(safety0);   // ratcheted down at least one step
    expect(result.acW).toBe(result.pcW);           // overlay matches the PDF buffer after settling
    expect(result.overlayPainted).toBe(true);      // soft but visible, not blank
    expect(errors).toEqual([]);
  });

  // Always-blank: the ratchet is bounded — it settles at the floor without spinning.
  test('a persistently blank read-back settles at the floor without looping', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await loadPlanWithMarkers(page);

    await page.evaluate(() => {
      // Force EVERY corner read-back to look blank for the duration.
      const orig = CanvasRenderingContext2D.prototype.getImageData;
      window.__origGID = orig;
      CanvasRenderingContext2D.prototype.getImageData = function (...a) {
        const d = orig.apply(this, a);
        if (a[2] === 1 && a[3] === 1 && d.data.length >= 4) d.data[3] = 0;   // only 1x1 corner probes
        return d;
      };
      window.App.setCanvasCaps({ maxDim: 100000, maxArea: 6000000 });
      window.state.maxZoom = 30;
      window.state.zoom = 8;
      window.App.renderPdf();
    });

    // it must converge to the floor (0.12) within a few steps and stop
    await page.waitForFunction(() => {
      const c = document.getElementById('pdfCanvas');
      return c.width > 0 && window.App.__getRenderAreaSafety() <= 0.12;
    }, null, { timeout: 12000 });

    const result = await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.getImageData = window.__origGID;   // restore
      return { safety: window.App.__getRenderAreaSafety(), pcW: document.getElementById('pdfCanvas').width };
    });

    expect(result.safety).toBeLessThanOrEqual(0.12);   // reached the floor
    expect(result.pcW).toBeGreaterThan(0);             // still rendered (accepted soft bitmap)
    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: the Duct drawing tool (DUCT-PLAN.md unit D2, preview-flagged).
 *
 * - The preview flag gates the header button: hidden by default, shown by
 *   App.enableDuctPreview() (localStorage 'clickcount-duct-preview').
 * - Arm → trace → S-step → commit stores a run with 2+ segments on
 *   annotations.ductRuns whose per-segment lengths and pounds match the
 *   seeded scale (independent lb/ft math in the spec: perimeter/12 × 24-ga
 *   sheet weight — the DUCT-PLAN worked numbers).
 * - The staged Esc ladder: popover closes first, then vertices pop one per
 *   press, then the draft clears and the tool exits to Move (T2-02 pattern).
 * - The live footer readout ("24×12 · 38'-6" · 267 lb · run 1,196 lb") rides
 *   the T2-09 liveDrawReadout seam while tracing.
 * - Committed runs re-render after a reload once the annotations payload is
 *   re-applied through the load path (applyPageAnnotationsFromData keeps
 *   ductRuns) — pixel-level ink assertion on the overlay.
 * - hideMarks blanks the overlay (T2-03: hidden marks paint nothing) with the
 *   run data untouched.
 * - Viewer sessions hide the button and disarm the tool.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SHEET_24GA = 1.156; // lb/sqft — duct-model SHEET_WEIGHT_LB_PER_SQFT[24]
const lbPerFtRect = (w, h) => (2 * (w + h) / 12) * SHEET_24GA;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

test.describe('Duct tool (D2, preview flag)', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Arming Duct is scale-gated (like Polyline); 12 pdf-pts per foot.
    await page.evaluate(() => {
      const s = window.state;
      s.pages[s.currentPage].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
  });

  // Arm a 24×12 supply run through the real create modal.
  async function armDuct(page) {
    await page.evaluate(() => { window.App.enableDuctPreview(); });
    await expect(page.locator('#ductBtn')).toBeVisible();
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    // D4: the airside chip rides the create modal and defaults Supply.
    await expect(page.locator('#ductCreateAirside button[data-airside="supply"]')).toHaveClass(/active/);
    await page.locator('#ductCreateW').fill('24');
    await page.locator('#ductCreateH').fill('12');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
  }

  const draftState = (page) => page.evaluate(() => ({
    tool: window.state.tool,
    vertices: window.state.drawingDuct ? window.state.drawingDuct.vertices.length : null,
    segments: window.state.drawingDuct ? window.state.drawingDuct.segments.length : null,
    popoverOpen: window.App.isDuctPopoverOpen(),
    finishBarVisible: document.getElementById('ductFinishBar').classList.contains('visible'),
    committed: (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.ductRuns || []).length,
  }));

  test('preview flag gates the header button', async ({ page }) => {
    await expect(page.locator('#ductBtn')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('clickcount-duct-preview'))).toBeNull();

    await page.evaluate(() => { window.App.enableDuctPreview(); });
    await expect(page.locator('#ductBtn')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('clickcount-duct-preview'))).toBe('1');

    expect(errors).toEqual([]);
  });

  test('arm → trace → S-step → commit stores a run with correct segments, lengths, and pounds', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);

    // Auto-suggested name landed on the draft (T2-12 nextPolylineName idiom).
    expect(await page.evaluate(() => window.state.drawingDuct.name)).toBe('Duct run 1');
    expect(await page.evaluate(() => window.state.drawingDuct.airside)).toBe('supply');

    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 150 } });

    // S opens the step popover (outranks the Set Scale hotkey mid-trace).
    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    expect(await page.evaluate(() => document.getElementById('ductSizeCurrent').textContent)).toBe('24×12');
    // First derived step-down from 24×12 is 22×12 (larger side −2).
    const firstChip = page.locator('#ductSizeSections .duct-step-chip').first();
    await expect(firstChip).toHaveText('22×12');
    await firstChip.click();
    await expect(page.locator('#ductSizePopover')).toBeHidden();

    let st = await page.evaluate(() => ({
      segments: window.state.drawingDuct.segments,
      sizeSteps: window.state.drawingDuct.sizeSteps,
    }));
    expect(st.segments.length).toBe(2);
    expect(st.segments[1]).toEqual({ startVertexIdx: 1, size: { kind: 'rect', w: 22, h: 12 } });
    expect(st.sizeSteps).toEqual([{ vertexIdx: 1, from: { kind: 'rect', w: 24, h: 12 }, to: { kind: 'rect', w: 22, h: 12 } }]);

    await wrapper.click({ position: { x: 300, y: 320 } });
    await page.keyboard.press('Enter');

    const committed = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
      return { runs: ann.ductRuns, tool: window.state.tool, draft: window.state.drawingDuct };
    });
    expect(committed.draft).toBeNull();
    expect(committed.tool).toBe(0);
    expect(committed.runs.length).toBe(1);
    const run = committed.runs[0];
    expect(run.name).toBe('Duct run 1');
    expect(run.pressureClass).toBe('1');
    expect(run.vertices.length).toBe(3);
    expect(run.segments.length).toBe(2);
    expect(run.sizeSteps.length).toBe(1);

    // Independent length + pounds math from the stored PDF-space vertices:
    // 12 pdf-pts per foot (seeded scale); both sizes gauge to 24 ga at 1" w.g.
    const seg1Ft = dist(run.vertices[0], run.vertices[1]) / 12;
    const seg2Ft = dist(run.vertices[1], run.vertices[2]) / 12;
    expect(seg1Ft).toBeGreaterThan(1);
    expect(seg2Ft).toBeGreaterThan(1);
    const expectedSeg1Lb = seg1Ft * lbPerFtRect(24, 12);   // 6.936 lb/ft — DUCT-PLAN worked number
    const expectedSeg2Lb = seg2Ft * lbPerFtRect(22, 12);
    const inPage = await page.evaluate(() => {
      const run2 = window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0];
      /* eslint-disable no-undef */
      const items = runStraightItems(run2, (a, b) => Math.hypot(b.x - a.x, b.y - a.y) / 12);
      return items.map((it) => ({
        lengthFt: it.lengthFt,
        pounds: segmentPounds(it.size, selectGauge(run2.pressureClass, it.size), it.lengthFt),
      }));
      /* eslint-enable no-undef */
    });
    expect(inPage.length).toBe(2);
    expect(inPage[0].lengthFt).toBeCloseTo(seg1Ft, 5);
    expect(inPage[1].lengthFt).toBeCloseTo(seg2Ft, 5);
    expect(inPage[0].pounds).toBeCloseTo(expectedSeg1Lb, 3);
    expect(inPage[1].pounds).toBeCloseTo(expectedSeg2Lb, 3);

    expect(errors).toEqual([]);
  });

  test('staged Escape: popover → vertex pops → draft clear + exit to Move', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 260, y: 150 } });

    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();

    await page.keyboard.press('Escape');   // 1st: closes the popover, keeps everything
    let st = await draftState(page);
    expect(st.popoverOpen).toBe(false);
    expect(st.vertices).toBe(2);
    expect(st.tool).toBe(16); // TOOL.DUCT
    expect(st.finishBarVisible).toBe(true);

    await page.keyboard.press('Escape');   // 2 -> 1
    st = await draftState(page);
    expect(st.vertices).toBe(1);
    expect(st.tool).toBe(16);

    await page.keyboard.press('Escape');   // 1 -> 0 (draft kept, tool kept)
    st = await draftState(page);
    expect(st.vertices).toBe(0);
    expect(st.tool).toBe(16);

    await page.keyboard.press('Escape');   // 0 vertices -> draft cleared, exit to Move
    st = await draftState(page);
    expect(st.vertices).toBe(null);
    expect(st.tool).toBe(0);
    expect(st.finishBarVisible).toBe(false);
    expect(st.committed).toBe(0);

    await page.keyboard.press('Escape');   // nothing left — must not throw
    expect((await draftState(page)).tool).toBe(0);

    expect(errors).toEqual([]);
  });

  test('a size step popped back below its boundary vertex is discarded with it', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 260, y: 150 } });
    await page.evaluate(() => { window.App.applyDuctSizeStep({ kind: 'rect', w: 20, h: 12 }); });
    expect(await page.evaluate(() => window.state.drawingDuct.segments.length)).toBe(2);

    // Pop the boundary vertex (idx 1): its segment + recorded step go with it.
    await page.keyboard.press('Escape');
    const st = await page.evaluate(() => ({
      vertices: window.state.drawingDuct.vertices.length,
      segments: window.state.drawingDuct.segments,
      sizeSteps: window.state.drawingDuct.sizeSteps,
    }));
    expect(st.vertices).toBe(1);
    expect(st.segments).toEqual([{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }]);
    expect(st.sizeSteps).toEqual([]);

    expect(errors).toEqual([]);
  });

  test('live footer readout: size · length · lb · run lb while tracing', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.hover({ position: { x: 320, y: 150 } });

    await page.waitForFunction(() => {
      const t = document.getElementById('statusMode').textContent || '';
      return t.includes('24×12 ·') && t.includes('lb · run') && t.includes('lb');
    }, null, { timeout: 5000 });
    const readout = await page.evaluate(() => window.App.ductLiveReadout());
    expect(readout).toMatch(/^24×12 · \d+'-\d+(\.\d+)?" · [\d,]+ lb · run [\d,]+ lb$/);

    expect(errors).toEqual([]);
  });

  test('committed runs re-render after reload through the annotations load path', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 320, y: 150 } });
    await wrapper.click({ position: { x: 320, y: 300 } });
    await page.keyboard.press('Enter');
    expect((await draftState(page)).committed).toBe(1);

    // Ink at the first segment's midpoint before reload.
    const inkAtRun = () => page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      const run = ann.ductRuns[0];
      const a = window.App.toCanvas(run.vertices[0]);
      const b = window.App.toCanvas(run.vertices[1]);
      const mx = Math.round((a.x + b.x) / 2), my = Math.round((a.y + b.y) / 2);
      const d = c.getContext('2d').getImageData(mx - 8, my - 8, 16, 16).data;
      for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) return true; }
      return false;
    });
    expect(await inkAtRun()).toBe(true);

    // Serialize exactly what save/load carries, reload the app, re-apply the
    // payload through applyPageAnnotationsFromData (the shared load path),
    // and assert the draw path paints the run again.
    const payload = await page.evaluate(() => JSON.parse(JSON.stringify({ canvases: window.state.pages[0].canvases })));
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate((p) => {
      const s = window.state;
      window.App.applyPageAnnotationsFromData(s.pages[0], { canvases: p.canvases, scale: { pixelsPerUnit: 12, unit: 'ft' } });
      s.currentPage = 0;
      window.App.renderAnnotations();
    }, payload);
    expect(await page.evaluate(() => window.state.pages[0].canvases[0].annotations.ductRuns.length)).toBe(1);
    expect(await inkAtRun()).toBe(true);

    expect(errors).toEqual([]);
  });

  test('hideMarks blanks duct ink and paints no trace, with data untouched', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 320, y: 150 } });
    await page.keyboard.press('Enter');

    const overlayHasInk = () => page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
      if (!c || !c.width) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) return true; }
      return false;
    });
    expect(await overlayHasInk()).toBe(true);

    await page.locator('#hideMarksBtn').click();
    await page.waitForFunction(() => window.state.hideMarks === true);
    expect(await overlayHasInk()).toBe(false);
    expect(await page.evaluate(() => window.state.pages[0].canvases[0].annotations.ductRuns.length)).toBe(1);

    // Hidden marks stay hidden mid-trace too: re-arm and stage a vertex — the
    // preview draws nothing while hideMarks is on.
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateStart').click();
    await wrapper.click({ position: { x: 200, y: 250 } });
    expect(await page.evaluate(() => window.state.drawingDuct.vertices.length)).toBe(1);
    expect(await overlayHasInk()).toBe(false);

    expect(errors).toEqual([]);
  });

  test('viewer sessions hide the button and disarm the tool', async ({ page }) => {
    await armDuct(page);
    await page.locator('#canvasWrapper').click({ position: { x: 150, y: 150 } });

    await page.evaluate(() => {
      window.state.isViewer = true;
      window.App.updateUI();
    });
    await expect(page.locator('#ductBtn')).toBeHidden();
    const st = await page.evaluate(() => ({ tool: window.state.tool, draft: window.state.drawingDuct }));
    expect(st.tool).toBe(0);
    expect(st.draft).toBeNull();

    expect(errors).toEqual([]);
  });
});

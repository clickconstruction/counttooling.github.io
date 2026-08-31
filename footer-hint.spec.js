// @ts-check
/**
 * Tests: the status-bar tool hint ("Tap start point" etc., features/status-bar.js)
 * only rides when the bar stays on ONE line. On narrow layouts the bar
 * flex-wraps; a long project name + hint used to shove the right-side actions
 * onto a second row (field feedback 2026-08-14). Guards both directions and
 * the wrap measurement's (text @ width) cache key across resizes.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function bootWithLineTool(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.currentProjectName = 'MF-P0002_PCT_IPRP-ChapterI Long Project Name For Wrap Test';
    s.lineTypes = [{ id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' }];
    s.activeLineTypeId = 'lt1';
    s.tool = window.App.TOOL.LINE;
    window.App.updateUI();
    window.App.updateStatus();
  });
}

test.describe('Status-bar tool hint (one-line-only)', () => {
  test('wide bar shows the hint; narrow bar drops it instead of wrapping the actions', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootWithLineTool(page);
    await expect(page.locator('#statusMode')).toContainText('Tap start point');

    // Desktop-width borderline case (the >768px regime is where the bar
    // wraps): the name + hint overflow the row, the name alone fits — so
    // dropping the hint is exactly what keeps the bar on one line. (1050px,
    // not 1000: B4's status-bar links grew — "quick keys | shortcuts" — which
    // moved this borderline by ~50px.)
    await page.setViewportSize({ width: 1050, height: 800 });
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).not.toContainText('Tap start point');
    // The right-side actions stayed on the same row as the mode text.
    const sameRow = await page.evaluate(() => {
      const mode = document.getElementById('statusMode');
      const actions = document.getElementById('statusBarActions');
      return actions.offsetTop <= mode.offsetTop;
    });
    expect(sameRow).toBe(true);

    // Widening again brings the hint back (cache key includes the bar width).
    await page.setViewportSize({ width: 1600, height: 800 });
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).toContainText('Tap start point');
  });
});

// Live length readout while drawing (T2 #21): the LINE/POLYLINE tool hints
// grow a running feet-inches readout (Measure formatting, px fallback), and
// the wrap cache keys on a fixed worst-case placeholder so a growing number
// never re-measures or wraps the bar mid-draw.
async function bootForReadout(page, { scale = { pixelsPerUnit: 9, unit: 'ft' } } = {}) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate((sc) => {
    const s = window.state;
    s.currentProjectName = 'Readout';
    s.pages[0].scale = sc;
    s.lineTypes = [{ id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' }];
    s.activeLineTypeId = 'lt1';
    s.tool = window.App.TOOL.LINE;
    window.App.updateUI();
    window.App.updateStatus();
  }, scale);
}

test.describe('Live length readout while drawing (T2 #21)', () => {
  test('quick line shows live feet-inches readout', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootForReadout(page);
    await expect(page.locator('#statusMode')).toContainText('Tap start point');

    await page.evaluate(() => {
      window.state.quickLineStart = { x: 0, y: 0 };
      window.state.mousePos = { x: 90, y: 0 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Tap end point — 10\'-0"');

    // Moving the cursor updates the readout live.
    await page.evaluate(() => {
      window.state.mousePos = { x: 45, y: 0 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Tap end point — 5\'-0"');
  });

  test('polyline readout is cumulative', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootForReadout(page);
    await page.evaluate(() => {
      const s = window.state;
      s.tool = window.App.TOOL.POLYLINE;
      s.drawingPolyline = { id: 'p1', name: 'Run', color: '#47c88e', points: [{ x: 0, y: 0 }, { x: 90, y: 0 }], closed: false, lineTypeId: 'lt1', group: null };
      s.mousePos = { x: 90, y: 90 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Click to add points — 20\'-0"');
  });

  test('no scale reads px, never feet', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootForReadout(page, { scale: null });
    await page.evaluate(() => {
      window.state.quickLineStart = { x: 0, y: 0 };
      window.state.mousePos = { x: 90, y: 0 };
      window.App.updateStatus();
    });
    const text = await page.locator('#statusMode').textContent();
    expect(text).toMatch(/— \d+ px/);
    expect(text).not.toMatch(/\d+'-\d+"/);
  });

  test('narrow bar still drops the whole hint', async ({ page }) => {
    await page.setViewportSize({ width: 1900, height: 800 });
    await bootWithLineTool(page);
    await page.evaluate(() => {
      window.state.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft' };
      window.state.quickLineStart = { x: 0, y: 0 };
      window.state.mousePos = { x: 90, y: 0 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Tap end point — 10\'-0"');

    // The borderline-width regime from the wrap test (1050px since B4's wider
    // status-bar links): the long project name alone fits, name + hint
    // doesn't — hint AND readout drop together.
    await page.setViewportSize({ width: 1050, height: 800 });
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).not.toContainText('Tap end point');
    // The worst-case key keeps the verdict stable while the cursor moves.
    await page.evaluate(() => {
      window.state.mousePos = { x: 200, y: 0 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).not.toContainText('Tap end point');
    const sameRow = await page.evaluate(() => {
      const mode = document.getElementById('statusMode');
      const actions = document.getElementById('statusBarActions');
      return actions.offsetTop <= mode.offsetTop;
    });
    expect(sameRow).toBe(true);
  });
});

test.describe('Distance chip (#statusMeasure, T2 #15)', () => {
  test('measure result rides the footer, outlives the old 5s toast, follows its sheet, and is replaced by a new measure', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1600, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.evaluate(() => {
      window.state.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
      document.getElementById('measureBtn').click();
    });
    const box = await page.locator('#canvasWrapper').boundingBox();
    const pts = await page.evaluate(() => {
      const p = window.state.pages[window.state.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const z = window.state.zoom, pan = window.state.pan;
      const y = (vp.height / 2) * z + pan.y;
      return [
        { x: vp.width * 0.25 * z + pan.x, y },
        { x: vp.width * 0.75 * z + pan.x, y },
        { x: vp.width * 0.25 * z + pan.x, y: y + 40 * z },
      ];
    });
    // No wait between the clicks: the double-tap guard is positional, so a fast
    // second click on a DIFFERENT point must complete the measure (the time-only
    // guard silently swallowed it — field feedback 2026-08-31).
    await page.mouse.click(box.x + pts[0].x, box.y + pts[0].y);
    await page.mouse.click(box.x + pts[1].x, box.y + pts[1].y);

    // The result rides both surfaces: a non-blocking 5s toast (glanceable at the
    // point of attention) and the persistent footer chip.
    const chip = page.locator('#statusMeasure');
    await expect(chip).toBeVisible();
    const firstText = await chip.textContent();
    expect(firstText).toMatch(/^Distance: /);
    expect(await page.evaluate(() => document.getElementById('airboardToastModal').classList.contains('visible'))).toBe(true);
    expect(await page.evaluate(() => document.getElementById('airboardToastText').textContent)).toContain('Distance');

    // Still shown after 6s — the chip outlives the 5s toast and stays while you work.
    await page.waitForTimeout(6000);
    await expect(chip).toBeVisible();
    expect(await chip.textContent()).toBe(firstText);
    expect(await page.evaluate(() => document.getElementById('airboardToastModal').classList.contains('visible'))).toBe(false);

    // Page flip hides it (a fact about that sheet); flipping back shows it again.
    await page.locator('#nextPage').click();
    await page.waitForFunction(() => window.state.currentPage === 1, { timeout: 5000 });
    await expect(chip).toBeHidden();
    await page.locator('#prevPage').click();
    await page.waitForFunction(() => window.state.currentPage === 0, { timeout: 5000 });
    await expect(chip).toBeVisible();
    expect(await chip.textContent()).toBe(firstText);

    // A new measure replaces it (again with no waits between the clicks).
    await page.evaluate(() => { document.getElementById('measureBtn').click(); });
    await page.mouse.click(box.x + pts[0].x, box.y + pts[0].y);
    await page.mouse.click(box.x + pts[2].x, box.y + pts[2].y);
    await expect(chip).toBeVisible();
    const secondText = await chip.textContent();
    expect(secondText).toMatch(/^Distance: /);
    expect(secondText).not.toBe(firstText);

    expect(errors).toEqual([]);
  });

  test('double-tap guard swallows only same-spot taps — Measure and Set Scale', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1600, height: 800 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Synchronous dispatch guarantees the taps land well inside the 400ms window.
    const measured = await page.evaluate(() => {
      window.state.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
      document.getElementById('measureBtn').click();
      const wrap = document.getElementById('canvasWrapper');
      const rect = wrap.getBoundingClientRect();
      const click = (fx, fy) => {
        const p = window.state.pages[0];
        const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
        const x = rect.left + vp.width * fx * window.state.zoom + window.state.pan.x;
        const y = rect.top + vp.height * fy * window.state.zoom + window.state.pan.y;
        for (const type of ['mousedown', 'mouseup', 'click']) {
          wrap.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
        }
      };
      click(0.25, 0.5);            // point A
      click(0.25, 0.5);            // same-spot double-tap: must be swallowed
      const afterDoubleTap = { scaleMode: window.state.scaleMode, lastMeasure: window.state.lastMeasure || null };
      click(0.75, 0.5);            // fast but clearly elsewhere: completes A -> B
      return { afterDoubleTap, lastMeasure: window.state.lastMeasure, tool: window.state.tool };
    });
    // The double-tap did NOT complete a zero-length measure; the far click did.
    expect(measured.afterDoubleTap.scaleMode).toBe(2); // SCALE_MODES.POINT_B — still waiting
    expect(measured.afterDoubleTap.lastMeasure).toBe(null);
    expect(measured.lastMeasure.text).toMatch(/^Distance: /);
    expect(measured.lastMeasure.text).not.toBe('Distance: 0"');
    expect(measured.tool).toBe(0); // TOOL.NONE — measure completed

    // Same guard on the Set Scale tool: a same-spot double-tap must not open the
    // scale modal with a zero-length reference line.
    const scaled = await page.evaluate(() => {
      document.getElementById('setScale').click();          // opens the Scale modal
      document.getElementById('scaleSelectOnPdf').click();  // arms TOOL.SCALE / POINT_A
      const wrap = document.getElementById('canvasWrapper');
      const rect = wrap.getBoundingClientRect();
      const click = (fx, fy) => {
        const p = window.state.pages[0];
        const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
        const x = rect.left + vp.width * fx * window.state.zoom + window.state.pan.x;
        const y = rect.top + vp.height * fy * window.state.zoom + window.state.pan.y;
        for (const type of ['mousedown', 'mouseup', 'click']) {
          wrap.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
        }
      };
      click(0.25, 0.5);
      click(0.25, 0.5);
      const afterDoubleTap = {
        scaleMode: window.state.scaleMode,
        modalOpen: document.getElementById('scaleModal').classList.contains('visible'),
      };
      click(0.75, 0.5);
      return { afterDoubleTap, modalOpen: document.getElementById('scaleModal').classList.contains('visible') };
    });
    expect(scaled.afterDoubleTap.scaleMode).toBe(2);
    expect(scaled.afterDoubleTap.modalOpen).toBe(false);
    expect(scaled.modalOpen).toBe(true);

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: mid-draw polyline Escape is STAGED like Quick Line/Ghost (JOURNEY-MAP
 * Tier-2 #22) — each press unwinds one clicked vertex (tool stays armed, the
 * finish bar stays up, Enter still commits the remainder), and with no
 * vertices left, Escape exits to Move. Before this change one stray Esc
 * discarded every clicked vertex at once, unrecoverably (the draft is
 * pre-commit scratch state, invisible to undo).
 *
 * Also pins the ladder ordering: a visible modal still eats the Escape before
 * the tool branch runs, so a mid-draw modal close pops no vertex.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Polyline Escape — staged vertex unwind', () => {
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

    // A scale is required before the Polyline tool will draw; seed a line type
    // so the modal's Start has something to bind.
    await page.evaluate(() => {
      const s = window.state, p = s.pages[s.currentPage];
      p.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      s.lineTypes = [{ id: 'lt1', name: 'Test', color: '#4a9eff', curveStyle: 'straight' }];
      s.activeLineTypeId = 'lt1';
    });
  });

  // The toolbar button opens a name/color dialog first; Start begins the
  // actual drawing mode (same arm path as snap-angles.spec.js).
  async function armPolyline(page) {
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });
    await page.waitForSelector('#polylineModal.visible', { timeout: 5000 });
    await page.locator('#polylineStart').click();
    await expect(page.locator('#polylineModal')).not.toHaveClass(/visible/, { timeout: 5000 });
  }

  const draftState = (page) => page.evaluate(() => ({
    points: window.state.drawingPolyline ? window.state.drawingPolyline.points.length : null,
    tool: window.state.tool,
    finishBarVisible: document.getElementById('polylineFinishBar').classList.contains('visible'),
    committed: (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.polylines || []).length,
  }));

  test('one Escape pops one vertex, keeps the tool live, and Enter commits the remainder', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armPolyline(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 250 } });
    await wrapper.click({ position: { x: 350, y: 250 } });

    await page.keyboard.press('Escape');

    let st = await draftState(page);
    expect(st.points).toBe(3);
    expect(st.tool).toBe(3); // TOOL.POLYLINE — still armed
    expect(st.finishBarVisible).toBe(true);
    expect(st.committed).toBe(0);

    // Enter commits exactly the remaining vertices as one polyline.
    await page.keyboard.press('Enter');
    st = await draftState(page);
    expect(st.points).toBe(null);
    expect(st.committed).toBe(1);
    const committedPoints = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
      return ann.polylines[ann.polylines.length - 1].points.length;
    });
    expect(committedPoints).toBe(3);

    expect(errors).toEqual([]);
  });

  test('Escape unwinds vertex-by-vertex, then exits to Move; a further Escape is a no-op', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armPolyline(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 150 } });

    await page.keyboard.press('Escape'); // 2 -> 1
    let st = await draftState(page);
    expect(st.points).toBe(1);
    expect(st.tool).toBe(3);

    await page.keyboard.press('Escape'); // 1 -> 0 (draft kept, tool kept)
    st = await draftState(page);
    expect(st.points).toBe(0);
    expect(st.tool).toBe(3);
    expect(st.finishBarVisible).toBe(true);

    await page.keyboard.press('Escape'); // 0 vertices -> exit to Move
    st = await draftState(page);
    expect(st.points).toBe(null);
    expect(st.tool).toBe(0); // TOOL.NONE
    expect(st.finishBarVisible).toBe(false);
    expect(st.committed).toBe(0);

    await page.keyboard.press('Escape'); // nothing left — must not throw
    st = await draftState(page);
    expect(st.points).toBe(null);
    expect(st.tool).toBe(0);
    expect(st.committed).toBe(0);

    expect(errors).toEqual([]);
  });

  test('a visible modal still wins the Escape ladder — closes without popping a vertex', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armPolyline(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 150 } });

    await page.evaluate(() => { window.App.showModal('chooseLineTypeModal'); });
    await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });

    await page.keyboard.press('Escape');

    await expect(page.locator('#chooseLineTypeModal')).not.toHaveClass(/visible/);
    const st = await draftState(page);
    expect(st.points).toBe(2); // no vertex popped
    expect(st.tool).toBe(3);

    expect(errors).toEqual([]);
  });
});

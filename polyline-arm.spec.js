// @ts-check
/**
 * Tests: the polyline arm path without the dialog tax (JOURNEY-MAP Tier-2 #28).
 *
 * With an ACTIVE line type, P / the Polyline button starts vertex placement
 * immediately — no dialog — and the run takes the type's id + color and an
 * auto-name ("Polyline N"); the committed run groups under its type in the
 * Lines list, never "Unassigned". With NO active type the New Polyline dialog
 * opens exactly as before (the deliberate custom-name/color path). With ZERO
 * line types the dialog blocks Start Drawing with the picker's empty-state
 * copy — a lineTypeId:null polyline must never be committable (its footage
 * used to vanish into Lines → "Unassigned"). And an in-flight draft is
 * RESUMED, never replaced: a mid-draw P (or a P after the T1-05 page-switch
 * disarm leaves an orphan draft) keeps every clicked vertex.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Polyline arm — no dialog tax', () => {
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
    // (snap-angles.spec.js pattern). activeLineTypeId is set per test.
    await page.evaluate(() => {
      const s = window.state, p = s.pages[s.currentPage];
      p.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      s.lineTypes = [{ id: 'lt1', name: 'Test', color: '#4a9eff', curveStyle: 'straight' }];
    });
  });

  const armState = (page) => page.evaluate(() => ({
    modalVisible: document.getElementById('polylineModal').classList.contains('visible'),
    tool: window.state.tool,
    draft: window.state.drawingPolyline
      ? { name: window.state.drawingPolyline.name, color: window.state.drawingPolyline.color, lineTypeId: window.state.drawingPolyline.lineTypeId, points: window.state.drawingPolyline.points.length }
      : null,
    committed: (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.polylines || []).length,
  }));

  test('active line type: P arms immediately, commits under the type — no dialog, no Unassigned', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await page.evaluate(() => { window.state.activeLineTypeId = 'lt1'; });
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });

    let st = await armState(page);
    expect(st.modalVisible).toBe(false);
    expect(st.tool).toBe(await page.evaluate(() => window.App.TOOL.POLYLINE));
    expect(st.draft).toEqual({ name: 'Polyline 1', color: '#4a9eff', lineTypeId: 'lt1', points: 0 });

    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 250 } });
    await page.keyboard.press('Enter');

    st = await armState(page);
    expect(st.committed).toBe(1);
    expect(st.draft).toBe(null);
    const committed = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
      const pl = ann.polylines[ann.polylines.length - 1];
      return { lineTypeId: pl.lineTypeId, name: pl.name, color: pl.color };
    });
    expect(committed).toEqual({ lineTypeId: 'lt1', name: 'Polyline 1', color: '#4a9eff' });

    // Lines list groups it under "Test", never "Unassigned".
    const groupNames = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#linesList .lines-type-name')).map(el => el.textContent));
    expect(groupNames).toContain('Test');
    expect(groupNames).not.toContain('Unassigned');

    expect(errors).toEqual([]);
  });

  test('auto-name increments: the run after "Polyline 1" arms as "Polyline 2"', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await page.evaluate(() => { window.state.activeLineTypeId = 'lt1'; });
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 150 } });
    await page.keyboard.press('Enter');

    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });
    const st = await armState(page);
    expect(st.modalVisible).toBe(false);
    expect(st.draft?.name).toBe('Polyline 2');
    expect(st.committed).toBe(1);

    expect(errors).toEqual([]);
  });

  test('no active line type: the dialog still opens and Start arms with the selected type', async ({ page }) => {
    await page.evaluate(() => { window.state.activeLineTypeId = null; });
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });
    await page.waitForSelector('#polylineModal.visible', { timeout: 5000 });

    await expect(page.locator('#polylineStart')).toBeEnabled();
    await expect(page.locator('#polylineEmpty')).toBeHidden();

    await page.locator('#polylineStart').click();
    await expect(page.locator('#polylineModal')).not.toHaveClass(/visible/, { timeout: 5000 });
    const st = await armState(page);
    expect(st.tool).toBe(await page.evaluate(() => window.App.TOOL.POLYLINE));
    expect(st.draft?.lineTypeId).toBe('lt1'); // the select's (only) type

    expect(errors).toEqual([]);
  });

  test('zero line types: "—" is blocked — empty-state copy, disabled Start, forced click commits nothing', async ({ page }) => {
    await page.evaluate(() => { window.state.lineTypes = []; window.state.activeLineTypeId = null; });
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });
    await page.waitForSelector('#polylineModal.visible', { timeout: 5000 });

    const select = await page.evaluate(() => {
      const sel = /** @type {HTMLSelectElement} */ (document.getElementById('polylineLineType'));
      return { text: sel.options[0]?.textContent, value: sel.value };
    });
    expect(select.text).toBe('—');
    expect(select.value).toBe('');
    await expect(page.locator('#polylineEmpty')).toBeVisible();
    await expect(page.locator('#polylineEmpty')).toHaveText('Add a line type first using Create or Quick.');
    await expect(page.locator('#polylineStart')).toBeDisabled();

    // Belt-and-braces: a forced click on the disabled button still arms nothing.
    await page.evaluate(() => { document.getElementById('polylineStart').click(); });
    const st = await armState(page);
    expect(st.draft).toBe(null);
    expect(st.modalVisible).toBe(true); // guard returned before hideModal
    expect(st.committed).toBe(0);

    expect(errors).toEqual([]);
  });

  test('an in-flight draft is resumed, never replaced — mid-draw P and the page-switch orphan', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await page.evaluate(() => { window.state.activeLineTypeId = 'lt1'; });
    await page.evaluate(() => { document.getElementById('polylineBtn').click(); });
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 250, y: 150 } });

    // Mid-draw re-press: the 2 vertices survive and the modal never opens.
    await page.keyboard.press('p');
    let st = await armState(page);
    expect(st.modalVisible).toBe(false);
    expect(st.draft?.points).toBe(2);
    expect(st.tool).toBe(await page.evaluate(() => window.App.TOOL.POLYLINE));

    // The T1-05 page-switch disarm orphan: tool NONE with the draft in place —
    // P re-arms the same draft instead of opening the dialog over it.
    await page.evaluate(() => { window.state.tool = window.App.TOOL.NONE; window.App.updateUI(); });
    await page.keyboard.press('p');
    st = await armState(page);
    expect(st.modalVisible).toBe(false);
    expect(st.draft?.points).toBe(2);
    expect(st.tool).toBe(await page.evaluate(() => window.App.TOOL.POLYLINE));
    expect(st.committed).toBe(0);

    expect(errors).toEqual([]);
  });
});

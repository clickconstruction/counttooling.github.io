// @ts-check
/**
 * Per-drop unit selector in the Line Properties modal: each drop (start/end) gets a
 * unit dropdown matching the custom Set Scale units (ft/in/m/cm/yd). The value is
 * stored as entered plus its unit (line.startDrop / line.startDropUnit), and converted
 * into the page's scale unit only when the run length is computed — so entering "8" with
 * "in" on a feet-scaled page adds ~0.667 ft, and switching the unit to "ft" makes the
 * same "8" add 8 ft. Old lines (no *Unit) behave exactly as before.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Line Properties - per-drop unit', () => {
  test('unit selector matches Set Scale, defaults to scale unit, stores + converts', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Deterministic feet scale + a 10-ft quick line + ctxTarget on it.
    await page.evaluate(() => {
      const s = window.state, p = s.pages[s.currentPage];
      p.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      const canvas = window.App.ensureActiveCanvas(p);
      canvas.annotations.quickLines = [{ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: null }];
      s.ctxTarget = { type: 'quickLine', index: 0 };
    });

    // Open Line Properties via the context-menu action (the button is hidden until the
    // menu opens, so fire its handler directly).
    await page.evaluate(() => document.getElementById('ctxLineProperties').click());
    await page.waitForSelector('#linePropertiesModal.visible', { timeout: 5000 });

    // Unit options equal Set Scale's, and default to the page scale unit (ft).
    const ui = await page.evaluate(() => {
      const opts = (id) => Array.from(document.getElementById(id).options).map((o) => o.value);
      return {
        scaleOpts: opts('scaleUnit'),
        startOpts: opts('linePropertiesStartDropUnit'),
        endOpts: opts('linePropertiesEndDropUnit'),
        startDefault: document.getElementById('linePropertiesStartDropUnit').value,
        endDefault: document.getElementById('linePropertiesEndDropUnit').value,
      };
    });
    expect(ui.startOpts).toEqual(ui.scaleOpts);
    expect(ui.endOpts).toEqual(ui.scaleOpts);
    expect(ui.startDefault).toBe('ft');
    expect(ui.endDefault).toBe('ft');

    const lenBefore = await page.evaluate(() => {
      const s = window.state, ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      return window.getLineRealWorldLength(ann.quickLines[0], s.currentPage, false, ann);
    });
    expect(lenBefore).toBeCloseTo(10, 6);

    // Enter 8 + inches for the start drop; persist via blur then unit change.
    await page.evaluate(() => {
      const sd = document.getElementById('linePropertiesStartDrop');
      sd.value = '8'; sd.dispatchEvent(new Event('blur'));
      const u = document.getElementById('linePropertiesStartDropUnit');
      u.value = 'in'; u.dispatchEvent(new Event('change'));
    });
    const after = await page.evaluate(() => {
      const s = window.state, ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      const line = ann.quickLines[0];
      return { sd: line.startDrop, su: line.startDropUnit, len: window.getLineRealWorldLength(line, s.currentPage, false, ann) };
    });
    expect(after.sd).toBe(8);
    expect(after.su).toBe('in');
    expect(after.len - lenBefore).toBeCloseTo(8 * 0.0254 / 0.3048, 4); // ~0.667 ft

    // Switching the same "8" to ft makes it add 8 ft instead.
    await page.evaluate(() => { const u = document.getElementById('linePropertiesStartDropUnit'); u.value = 'ft'; u.dispatchEvent(new Event('change')); });
    const ftLen = await page.evaluate(() => {
      const s = window.state, ann = window.App.getActiveAnnotations(s.pages[s.currentPage]);
      return window.getLineRealWorldLength(ann.quickLines[0], s.currentPage, false, ann);
    });
    expect(ftLen - lenBefore).toBeCloseTo(8, 4);

    expect(errors).toEqual([]);
  });
});

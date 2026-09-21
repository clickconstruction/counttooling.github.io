// @ts-check
/**
 * Tests: the legend's corner grip sizes the legend as a whole (2026-09-21).
 * Dragging the bottom-right grip toward the legend shrinks it and dragging
 * away grows it: the drag scales legendSettings.legendScale, the knob the
 * Summary Legend size slider sets, so the rows follow and the box hugs them
 * (the grip used to grow a bare white patch and could never go below the
 * rows). Undo puts the size back; the slider floor is 25%; a size change is
 * an edit the project saves.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForFunction(() => window.App && window.state);
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0; }, { timeout: 10000 });
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay.visible').forEach((m) => m.classList.remove('visible'));
    const s = window.state, App = window.App, uid = () => App.uid();
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    const ann = s.pages[0].canvases[0].annotations;
    const a = { id: uid(), name: 'WC - Water Closet', icon: App.getOrderedIcons()[0].value, color: '#e85447' };
    const b = { id: uid(), name: 'LAV - Lavatory', icon: App.getOrderedIcons()[1].value, color: '#4a9eff' };
    s.counters = [a, b];
    ann.counterMarkers = { [a.id]: [{ x: 100, y: 100, id: uid(), group: null }, { x: 160, y: 100, id: uid(), group: null }], [b.id]: [{ x: 100, y: 200, id: uid(), group: null }] };
    ann.legend = { x: 200, y: 40, w: 100, h: 60 };
    s.showLegendOverlay = true;
    s.legendSettings.legendScale = 1;
    App.renderPdf(); App.updateUI(); App.renderAnnotations();
    App.setAutoSaveDirty(false);   // the upload marked it; the drag must mark it again
  });
  await page.waitForTimeout(300);
}
const legend = (page) => page.evaluate(() => {
  const l = window.state.pages[0].canvases[0].annotations.legend;
  return { x: l.x, y: l.y, w: l.w, h: l.h, scale: window.state.legendSettings.legendScale, dirty: !!window.App.getAutoSaveDirty() };
});
const screenPointForPdf = (page, pdf) => page.evaluate((p) => {
  const annCanvas = document.getElementById('annCanvas');
  const rect = annCanvas.getBoundingClientRect();
  const bc = window.App.toCanvas(p);
  return { x: rect.left + bc.x * (rect.width / annCanvas.width), y: rect.top + bc.y * (rect.height / annCanvas.height) };
}, pdf);
// Press on the grip (the box's last 16 pt each way) and drag by a fraction of
// the box's own diagonal: -0.5 is half the size, +1 is twice.
async function dragGrip(page, fraction) {
  const l = await legend(page);
  const grip = { x: l.x + l.w - 5, y: l.y + l.h - 5 };
  const a = await screenPointForPdf(page, grip);
  const b = await screenPointForPdf(page, { x: grip.x + fraction * l.w, y: grip.y + fraction * l.h });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

test.describe('Legend corner grip', () => {
  test('dragging the grip inward shrinks the legend and its rows; outward grows it; undo puts it back', async ({ page }) => {
    const errors = [];
    await boot(page, errors);
    const before = await legend(page);
    expect(before.scale).toBe(1);
    expect(before.dirty).toBe(false);

    await dragGrip(page, -0.5);
    const small = await legend(page);
    expect(small.scale).toBeGreaterThan(0.4);
    expect(small.scale).toBeLessThan(0.6);
    expect(small.w).toBeLessThan(before.w * 0.75);
    expect(small.h).toBeLessThan(before.h * 0.75);
    expect(small.x).toBe(before.x);
    expect(small.y).toBe(before.y);
    expect(small.dirty).toBe(true);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    const undone = await legend(page);
    expect(undone.scale).toBe(1);
    expect(Math.round(undone.w)).toBe(Math.round(before.w));
    expect(Math.round(undone.h)).toBe(Math.round(before.h));

    await dragGrip(page, 1);
    const big = await legend(page);
    expect(big.scale).toBeGreaterThan(1.8);
    expect(big.scale).toBeLessThan(2.2);
    expect(big.w).toBeGreaterThan(before.w * 1.5);
    expect(big.h).toBeGreaterThan(before.h * 1.5);
    expect(errors).toEqual([]);
  });

  test('the grip never leaves a box past the rows; the Summary Legend slider reads the drag and goes down to 25%', async ({ page }) => {
    const errors = [];
    await boot(page, errors);
    await dragGrip(page, -0.4);
    const dragged = await legend(page);
    // The box is the rows' size at the dragged scale: a second render does not move it.
    await page.evaluate(() => window.App.renderAnnotations());
    expect(await legend(page)).toEqual(dragged);
    await page.evaluate(() => window.App.openLegendSettingsModal());
    await expect(page.locator('#legendSettingsModal')).toHaveClass(/visible/);
    expect(await page.locator('#legendScale').inputValue()).toBe(String(Math.round(dragged.scale * 100)));
    expect(await page.locator('#legendScale').getAttribute('min')).toBe('25');
    await page.evaluate(() => { const r = document.getElementById('legendScale'); r.value = '25'; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); });
    const floor = await legend(page);
    expect(floor.scale).toBe(0.25);
    expect(floor.w).toBeLessThan(dragged.w);
    expect(await page.locator('#legendScaleVal').textContent()).toBe('25');
    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: DUCT unit D23 — X1 zone handles (journeys/plans/_TODO.md D23;
 * _STAGE6.md X1). In Move, a scale zone or multiply zone drags to move (body)
 * and resizes (corner handles); the cursor swap is the only chrome; the
 * label / multiply factor re-tally; one undo snapshot per drag. The rung sits
 * after T2-03's hideMarks return, and it coexists with the 280 ms aim loupe
 * (Move is not an aiming tool) and T2-10's drag-to-complete on the zone TOOLS.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const PDF = path.join(__dirname, 'test-page.pdf');

async function boot(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(PDF);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1\'' };
    s.zoom = 1; s.pan = { x: 0, y: 0 };
    s.counters = [{ id: 'c1', name: 'WC', icon: 'M0 0 H10 V10 H0 Z', color: '#e8c547' }];
    const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
    ann.multiplyZones.push({ id: 'mz1', x1: 100, y1: 100, x2: 300, y2: 250, multiplier: 3 });
    ann.scaleZones.push({ id: 'sz1', x1: 350, y1: 100, x2: 500, y2: 250, scale: { pixelsPerUnit: 24, unit: 'ft', label: 'detail' } });
    // One marker just OUTSIDE the multiply zone's right edge: moving/resizing the
    // zone over it changes the footer count (×3), which is the re-tally.
    ann.counterMarkers.c1 = [{ x: 330, y: 175, id: 'm1' }];
    s.tool = window.App.TOOL.NONE;
    window.App.invalidateFooterTotals();
    window.App.renderPdf();
    window.App.updateUI();
  });
}

const screenPointForPdf = (page, pdf) => page.evaluate((p) => {
  const annCanvas = document.getElementById('annCanvas');
  const rect = annCanvas.getBoundingClientRect();
  const bc = window.App.toCanvas(p);
  return { x: rect.left + bc.x * (rect.width / annCanvas.width), y: rect.top + bc.y * (rect.height / annCanvas.height) };
}, pdf);

const zone = (page, kind, idx = 0) => page.evaluate(({ kind, idx }) => {
  const z = window.App.getActiveAnnotations(window.state.pages[0])[kind][idx];
  return { x1: z.x1, y1: z.y1, x2: z.x2, y2: z.y2 };
}, { kind, idx });

async function drag(page, fromPdf, toPdf) {
  const a = await screenPointForPdf(page, fromPdf);
  const b = await screenPointForPdf(page, toPdf);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

const footerCount = (page) => page.evaluate(() => (document.getElementById('statusTotals').textContent || '').match(/\[(\d+)/)?.[1]);

test.describe('D23 — zone handles (X1)', () => {
  /** @type {string[]} */
  let errors;
  test.beforeEach(async ({ page }) => { errors = []; await boot(page, errors); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('body drag moves a multiply zone; the footer re-tallies and one undo restores it', async ({ page }) => {
    expect(await footerCount(page)).toBe('1');            // marker outside the ×3 zone
    const panBefore = await page.evaluate(() => ({ ...window.state.pan }));
    await drag(page, { x: 200, y: 175 }, { x: 260, y: 175 });   // +60 in x
    expect(await zone(page, 'multiplyZones')).toEqual({ x1: 160, y1: 100, x2: 360, y2: 250 });
    expect(await page.evaluate(() => ({ ...window.state.pan }))).toEqual(panBefore);   // it moved the zone, not the sheet
    expect(await footerCount(page)).toBe('3');            // now inside → ×3, re-tallied on release
    await page.locator('#undoBtn').click();
    expect(await zone(page, 'multiplyZones')).toEqual({ x1: 100, y1: 100, x2: 300, y2: 250 });
    expect(await footerCount(page)).toBe('1');
  });

  test('corner drag resizes: only that corner\'s two edges move', async ({ page }) => {
    await drag(page, { x: 300, y: 250 }, { x: 340, y: 300 });   // SE corner of the multiply zone
    expect(await zone(page, 'multiplyZones')).toEqual({ x1: 100, y1: 100, x2: 340, y2: 300 });
    expect(await footerCount(page)).toBe('3');
    // SE corner of the scale zone: x2/y2 move, x1/y1 stay. (Its NW corner now
    // sits 10 pt from the grown multiply zone's NE corner — inside the 12 pt
    // hit radius, where the first zone in the array wins, as with any
    // overlapping hit — so the test uses the far corner.)
    await drag(page, { x: 500, y: 250 }, { x: 540, y: 290 });
    expect(await zone(page, 'scaleZones')).toEqual({ x1: 350, y1: 100, x2: 540, y2: 290 });
  });

  test('a press that never moves is a click, not an edit', async ({ page }) => {
    const dirtyBefore = await page.evaluate(() => !!window.App.getAutoSaveDirty?.());
    const p = await screenPointForPdf(page, { x: 200, y: 175 });
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up();
    expect(await zone(page, 'multiplyZones')).toEqual({ x1: 100, y1: 100, x2: 300, y2: 250 });
    expect(await page.evaluate(() => window.state.justFinishedZoneDrag)).toBe(false);
    expect(await page.evaluate(() => !!window.App.getAutoSaveDirty?.())).toBe(dirtyBefore);
  });

  test('cursor swap is the only chrome: move over the body, resize over a corner, nothing elsewhere', async ({ page }) => {
    const cursorAt = async (pdf) => {
      const p = await screenPointForPdf(page, pdf);
      await page.mouse.move(p.x, p.y);
      return page.evaluate(() => document.getElementById('annCanvas').style.cursor);
    };
    expect(await cursorAt({ x: 200, y: 175 })).toBe('move');
    expect(await cursorAt({ x: 300, y: 250 })).toBe('nwse-resize');   // SE
    expect(await cursorAt({ x: 300, y: 100 })).toBe('nesw-resize');   // NE
    expect(await cursorAt({ x: 700, y: 600 })).toBe('');
    // No handle glyphs are painted: the hit is geometric only.
    expect(await page.evaluate(() => document.querySelectorAll('.zone-handle').length)).toBe(0);
  });

  test('hideMarks makes zones inert: no cursor, no drag', async ({ page }) => {
    await page.evaluate(() => { window.state.hideMarks = true; window.App.renderAnnotations(); });
    const p = await screenPointForPdf(page, { x: 200, y: 175 });
    await page.mouse.move(p.x, p.y);
    expect(await page.evaluate(() => document.getElementById('annCanvas').style.cursor)).toBe('');
    await drag(page, { x: 200, y: 175 }, { x: 260, y: 175 });
    expect(await zone(page, 'multiplyZones')).toEqual({ x1: 100, y1: 100, x2: 300, y2: 250 });
  });

  test('Move only: the zone TOOLS keep drag-to-complete, and the aim loupe never fires in Move', async ({ page }) => {
    // Multiply Zone TOOL over an existing zone: D23's handles do not engage
    // (Move only), and T2-10's press-drag runs as before — here it is refused
    // by the tool's own overlap rule (a zone cannot multiply twice), so the
    // existing zone is untouched and no dialog opens.
    await page.evaluate(() => { window.state.tool = window.App.TOOL.MULTIPLY_ZONE; window.App.updateUI(); });
    await drag(page, { x: 200, y: 175 }, { x: 280, y: 230 });
    expect(await zone(page, 'multiplyZones')).toEqual({ x1: 100, y1: 100, x2: 300, y2: 250 });
    await expect(page.locator('#multiplyZoneModal')).not.toHaveClass(/visible/);
    // Empty space: the same drag-to-complete opens the new-zone dialog.
    await drag(page, { x: 100, y: 400 }, { x: 220, y: 480 });
    await expect(page.locator('#multiplyZoneModal')).toHaveClass(/visible/);   // the open is deferred past the release
    await page.evaluate(() => { window.App.hideModal('multiplyZoneModal'); window.state.pendingMultiplyZone = null; window.state.multiplyZoneStart = null; window.state.tool = window.App.TOOL.NONE; window.App.updateUI(); });
    // In Move a held press does not summon the loupe.
    const p = await screenPointForPdf(page, { x: 200, y: 175 });
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.getElementById('aimLoupe')?.style.display || 'none')).toBe('none');
    await page.mouse.up();
  });

  test('a viewer cannot drag a zone', async ({ page }) => {
    await page.evaluate(() => { window.state.isViewer = true; window.App.updateUI(); });
    await drag(page, { x: 200, y: 175 }, { x: 260, y: 175 });
    expect(await zone(page, 'multiplyZones')).toEqual({ x1: 100, y1: 100, x2: 300, y2: 250 });
  });
});

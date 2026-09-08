// @ts-check
/**
 * Electrical, First-Class S2 — vertical by default.
 *
 * Guards: with a project ceiling and a counter mount height, every Chain tap
 * writes ceiling − mount + make-up feet as an ORDINARY drop on the run — the
 * first device as the first run's startDrop, every later device as the
 * arriving run's endDrop — so each device's vertical is counted exactly once
 * (no double count at chain joints); a Room Sizer room at the point overrides
 * the project ceiling; without a ceiling or a mount height Chain writes plain
 * runs as before; the status bar coaches the drop the next tap will add.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const ICON = 'M96 96h448v448H96z';

async function setup(page, opts) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(({ icon, o }) => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    s.counters.push({ id: 'c-recep', name: 'Duplex Receptacle', icon, color: '#e85447', ...(o.mount != null ? { mountHeightIn: o.mount } : {}) });
    s.lineTypes.push({ id: 'lt-emt', name: '3/4" EMT', color: '#8a4bb0' });
    s.ceilingHeightFt = o.ceiling == null ? null : o.ceiling;
    s.makeUpFt = o.makeUp == null ? null : o.makeUp;
    s.activeCounterType = 'c-recep';
    s.activeLineTypeId = 'lt-emt';
    s.tool = window.App.TOOL.CHAIN;
    window.App.updateUI();
  }, { icon: ICON, o: opts || {} });
}
async function chain(page, points) {
  await page.evaluate((pts) => { pts.forEach((p) => window.App.commitChainPoint(p)); }, points);
}
const lines = (page) => page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).quickLines || []).map((q) => ({ startDrop: q.startDrop, startDropUnit: q.startDropUnit, endDrop: q.endDrop, endDropUnit: q.endDropUnit })));

test.describe('Electrical, First-Class S2 — vertical by default', () => {
  test('ceiling 10 ft + 18" receptacle + 1 ft make-up: 9.5 ft per device, once each, in the totals', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await setup(page, { mount: 18, ceiling: 10, makeUp: 1 });
    expect(await page.evaluate(() => typeof window.App?.roomHeightAtPoint)).toBe('function');
    expect(await page.evaluate(() => window.App.chainDefaultDropFeetAt({ x: 100, y: 100 }))).toBe(9.5);

    await chain(page, [{ x: 100, y: 100 }, { x: 220, y: 100 }, { x: 340, y: 100 }]);
    const q = await lines(page);
    expect(q.length).toBe(2);
    // first run: the first device's vertical rides as startDrop, the second's as endDrop
    expect(q[0]).toEqual({ startDrop: 9.5, startDropUnit: 'ft', endDrop: 9.5, endDropUnit: 'ft' });
    // second run: the joint already carries the second device — only the third arrives here
    expect(q[1]).toEqual({ startDrop: undefined, startDropUnit: undefined, endDrop: 9.5, endDropUnit: 'ft' });
    // 2 runs × 120 px @ 12 px/ft = 20 ft of plan + 3 × 9.5 ft of verticals
    const total = await page.evaluate(() => {
      const s = window.state; const ann = window.App.getActiveAnnotations(s.pages[0]);
      return ann.quickLines.reduce((sum, q) => sum + window.getLineRealWorldLength(q, 0, false, ann), 0);
    });
    expect(total).toBeCloseTo(20 + 28.5, 4);
    // The drop-node view agrees: three nodes, one vertical each, no zeroed twins.
    const nodes = await page.evaluate(() => window.App.collectDropNodes(window.App.getActiveAnnotations(window.state.pages[0])).map((n) => n.value));
    expect(nodes.sort()).toEqual([9.5, 9.5, 9.5]);
    expect(errors).toEqual([]);
  });

  test('a Room Sizer room at the point overrides the project ceiling', async ({ page }) => {
    await setup(page, { mount: 48, ceiling: 10, makeUp: 1 });
    await page.evaluate(() => {
      const s = window.state; const canvas = window.App.ensureActiveCanvas(s.pages[0]);
      s.rooms.push({ id: 'r1', name: 'Corridor', color: '#47c88e' });
      canvas.annotations.roomBoxes = canvas.annotations.roomBoxes || [];
      canvas.annotations.roomBoxes.push({ x1: 300, y1: 50, x2: 400, y2: 150, heightFt: 12, roomId: 'r1', id: 'rb1' });
    });
    expect(await page.evaluate(() => window.App.roomHeightAtPoint({ x: 340, y: 100 }, 0))).toBe(12);
    expect(await page.evaluate(() => window.App.roomHeightAtPoint({ x: 100, y: 100 }, 0))).toBe(null);
    await chain(page, [{ x: 100, y: 100 }, { x: 340, y: 100 }]);
    const q = await lines(page);
    // switch at 48": outside the room 10 − 4 + 1 = 7; inside the 12 ft room 12 − 4 + 1 = 9
    expect(q[0]).toEqual({ startDrop: 7, startDropUnit: 'ft', endDrop: 9, endDropUnit: 'ft' });
  });

  test('no ceiling, or no mount height: Chain writes plain runs exactly as before', async ({ page }) => {
    await setup(page, { mount: 18, ceiling: null });
    await chain(page, [{ x: 100, y: 100 }, { x: 220, y: 100 }]);
    expect(await lines(page)).toEqual([{ startDrop: undefined, startDropUnit: undefined, endDrop: undefined, endDropUnit: undefined }]);
    await page.evaluate(() => { window.state.ceilingHeightFt = 10; delete window.state.counters.find((c) => c.id === 'c-recep').mountHeightIn; window.state.chainStart = null; });
    await chain(page, [{ x: 100, y: 300 }, { x: 220, y: 300 }]);
    const q = await lines(page);
    expect(q[1]).toEqual({ startDrop: undefined, startDropUnit: undefined, endDrop: undefined, endDropUnit: undefined });
  });

  test('the status bar coaches the drop the next tap will add', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await setup(page, { mount: 18, ceiling: 10, makeUp: 1 });
    await page.evaluate(() => { window.state.mousePos = { x: 100, y: 100 }; window.App.updateUI(); });
    const text = await page.locator('#statusMode').textContent();
    expect(text).toContain('+9.5 ft drop at Duplex Receptacle');
  });
});

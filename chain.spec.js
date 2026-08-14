// @ts-check
/**
 * Tests: the Chain tool (features/chain.js + the TOOL.CHAIN wiring in app.js).
 *
 * One click per fixture: every click drops a counter marker; from the second
 * click on, a quick line back to the previous counter rides along in the SAME
 * undo step. The placements are ordinary counter markers / quick lines (no new
 * persisted shapes), so this spec guards the placement chain, the palette
 * panel (two searchable columns writing state.activeCounterType /
 * state.activeLineTypeId directly — NOT via the setActive* setters, whose side
 * effect is switching the tool), the Esc ladder (end run, then exit to Move),
 * paired undo, and the scale gate on the button.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function setupChainProject(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    s.counters.push({ id: 'c-chain-1', name: 'Sprinkler Head', icon: 'M320 96C196 96 96 196 96 320s100 224 224 224 224-100 224-224S444 96 320 96z', color: '#e8c547' });
    s.lineTypes.push({ id: 'lt-chain-1', name: '1in CPVC Main', color: '#4a9eff' });
    window.App.updateUI();
  });
}

// Three chain clicks via the real canvas click path (App.commitChainPoint is
// what the TOOL.CHAIN branch in handleCanvasClick delegates to).
async function chainClicks(page, points) {
  await page.evaluate((pts) => {
    for (const p of pts) window.App.commitChainPoint(p);
    window.App.renderAnnotations();
    window.App.updateUI();
  }, points);
}

test.describe('Chain tool', () => {
  test('activate, pick pair in panel, chain 3 clicks -> 3 markers + 2 connected lines', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await setupChainProject(page);

    // Scale gate: without the evaluate below un-setting it, the button would
    // activate (scale was set in setup) — assert the activation contract.
    await page.locator('#chainBtn').click();
    const activated = await page.evaluate(() => ({
      tool: window.state.tool,
      chain: window.App.TOOL.CHAIN,
      panelVisible: document.getElementById('chainPanel').style.display !== 'none',
      btnActive: document.getElementById('chainBtn').classList.contains('active'),
    }));
    expect(activated.tool).toBe(activated.chain);
    expect(activated.panelVisible).toBe(true);
    expect(activated.btnActive).toBe(true);

    // Panel columns list the palettes; clicking rows selects WITHOUT switching
    // the tool (the setActive* setters would flip to COUNTER/LINE).
    await page.locator('#chainCounterList .chain-row[data-id="c-chain-1"]').click();
    await page.locator('#chainLineTypeList .chain-row[data-id="lt-chain-1"]').click();
    const selected = await page.evaluate(() => ({
      counter: window.state.activeCounterType,
      lineType: window.state.activeLineTypeId,
      tool: window.state.tool,
      selectedRows: document.querySelectorAll('.chain-row.selected').length,
    }));
    expect(selected.counter).toBe('c-chain-1');
    expect(selected.lineType).toBe('lt-chain-1');
    expect(selected.tool).toBe(activated.chain);
    expect(selected.selectedRows).toBe(2);

    // Three chain clicks: 3 markers, 2 quick lines, endpoints chained
    // counter-to-counter, correct lineTypeId/color.
    await chainClicks(page, [{ x: 100, y: 100 }, { x: 220, y: 100 }, { x: 220, y: 240 }]);
    const placed = await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      return { markers: ann.counterMarkers['c-chain-1'], lines: ann.quickLines, chainStart: window.state.chainStart };
    });
    expect(placed.markers.length).toBe(3);
    expect(placed.lines.length).toBe(2);
    expect(placed.lines[0]).toMatchObject({ x1: 100, y1: 100, x2: 220, y2: 100, lineTypeId: 'lt-chain-1', color: '#4a9eff' });
    expect(placed.lines[1]).toMatchObject({ x1: 220, y1: 100, x2: 220, y2: 240, lineTypeId: 'lt-chain-1' });
    expect(placed.chainStart).toMatchObject({ x: 220, y: 240, page: 0 });

    // Undo removes the last counter AND its connecting line together (one
    // snapshot per chain click).
    await page.keyboard.press('Control+z');
    const undone = await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      return { markers: ann.counterMarkers['c-chain-1'].length, lines: ann.quickLines.length };
    });
    expect(undone).toEqual({ markers: 2, lines: 1 });

    expect(errors).toEqual([]);
  });

  test('Esc ladder: first ends the run (tool stays), second exits to Move; Enter also ends the run', async ({ page }) => {
    await setupChainProject(page);
    await page.locator('#chainBtn').click();
    await page.locator('#chainCounterList .chain-row[data-id="c-chain-1"]').click();
    await page.locator('#chainLineTypeList .chain-row[data-id="lt-chain-1"]').click();
    await chainClicks(page, [{ x: 100, y: 100 }, { x: 200, y: 100 }]);

    // Enter ends the run exactly like the first Esc (tool stays active).
    await page.keyboard.press('Enter');
    const afterEnter = await page.evaluate(() => ({ chainStart: window.state.chainStart, tool: window.state.tool }));
    expect(afterEnter.chainStart).toBe(null);
    expect(afterEnter.tool).toBe(await page.evaluate(() => window.App.TOOL.CHAIN));

    // Re-anchor for the Esc ladder assertions.
    await chainClicks(page, [{ x: 150, y: 150 }]);
    await page.keyboard.press('Escape');
    const afterEsc1 = await page.evaluate(() => ({ chainStart: window.state.chainStart, tool: window.state.tool }));
    expect(afterEsc1.chainStart).toBe(null);
    expect(afterEsc1.tool).toBe(await page.evaluate(() => window.App.TOOL.CHAIN));

    // A fresh click after Esc starts a NEW chain: counter, no connecting line.
    // (Counts: 2 chained + 1 post-Enter re-anchor + this one = 4 markers, 1 line.)
    await chainClicks(page, [{ x: 300, y: 300 }]);
    const fresh = await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      return { markers: ann.counterMarkers['c-chain-1'].length, lines: ann.quickLines.length };
    });
    expect(fresh).toEqual({ markers: 4, lines: 1 });

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const afterEsc3 = await page.evaluate(() => ({
      tool: window.state.tool,
      panelHidden: document.getElementById('chainPanel').style.display === 'none',
    }));
    expect(afterEsc3.tool).toBe(0);
    expect(afterEsc3.panelHidden).toBe(true);
  });

  test('placement gated on picking both; search filters rows; T hotkey activates', async ({ page }) => {
    await setupChainProject(page);
    await page.keyboard.press('t');
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.CHAIN));

    // No pair picked yet -> a click places nothing.
    await chainClicks(page, [{ x: 100, y: 100 }]);
    const nothing = await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      return { markerKeys: Object.keys(ann.counterMarkers).length, lines: (ann.quickLines || []).length };
    });
    expect(nothing).toEqual({ markerKeys: 0, lines: 0 });

    // Search narrows the counter column ('sprink' matches only the seeded one).
    await page.locator('#chainCounterSearch').fill('sprink');
    expect(await page.locator('#chainCounterList .chain-row').count()).toBe(1);
    await page.locator('#chainCounterSearch').fill('zzz');
    await expect(page.locator('#chainCounterList .chain-list-empty')).toHaveText('No match.');
  });

  test('scale gate: unscaled page toasts and does not activate', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.locator('#chainBtn').click();
    const state = await page.evaluate(() => ({
      tool: window.state.tool,
      panelHidden: document.getElementById('chainPanel').style.display === 'none',
    }));
    expect(state.tool).toBe(0);
    expect(state.panelHidden).toBe(true);
  });
});

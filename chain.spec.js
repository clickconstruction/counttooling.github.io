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
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
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

  test('Esc/Enter ladders: end run -> close palette (tool stays, chip shows) -> exit to Move', async ({ page }) => {
    await setupChainProject(page);
    await page.locator('#chainBtn').click();
    await page.locator('#chainCounterList .chain-row[data-id="c-chain-1"]').click();
    await page.locator('#chainLineTypeList .chain-row[data-id="lt-chain-1"]').click();
    await chainClicks(page, [{ x: 100, y: 100 }, { x: 200, y: 100 }]);

    // Enter #1 ends the run (tool stays, palette stays).
    await page.keyboard.press('Enter');
    const afterEnter = await page.evaluate(() => ({ chainStart: window.state.chainStart, tool: window.state.tool, panelOpen: window.App.isChainPanelOpen() }));
    expect(afterEnter.chainStart).toBe(null);
    expect(afterEnter.tool).toBe(await page.evaluate(() => window.App.TOOL.CHAIN));
    expect(afterEnter.panelOpen).toBe(true);

    // Enter #2 (no run) closes the palette: tool stays CHAIN, chip appears,
    // placement STILL WORKS while closed.
    await page.keyboard.press('Enter');
    const closed = await page.evaluate(() => ({
      tool: window.state.tool,
      panelHidden: document.getElementById('chainPanel').style.display === 'none',
      chipVisible: document.getElementById('headerChainPair').style.display !== 'none',
      chipTitle: document.getElementById('headerChainPair').title,
    }));
    expect(closed.tool).toBe(await page.evaluate(() => window.App.TOOL.CHAIN));
    expect(closed.panelHidden).toBe(true);
    expect(closed.chipVisible).toBe(true);
    expect(closed.chipTitle).toContain('Sprinkler Head');
    await chainClicks(page, [{ x: 150, y: 150 }, { x: 250, y: 150 }]);
    const placedClosed = await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      return { markers: ann.counterMarkers['c-chain-1'].length, lines: ann.quickLines.length };
    });
    expect(placedClosed).toEqual({ markers: 4, lines: 2 });

    // Esc ladder from here: #1 ends the run, #2 exits to Move (palette is
    // already closed), and the chip leaves with the tool.
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.CHAIN));
    await page.keyboard.press('Escape');
    const out = await page.evaluate(() => ({
      tool: window.state.tool,
      chipVisible: document.getElementById('headerChainPair').style.display !== 'none',
    }));
    expect(out.tool).toBe(0);
    expect(out.chipVisible).toBe(false);

    // Esc with the palette OPEN and no run closes the palette first.
    await page.locator('#chainBtn').click();
    expect(await page.evaluate(() => window.App.isChainPanelOpen())).toBe(true);
    await page.keyboard.press('Escape');
    const mid = await page.evaluate(() => ({ tool: window.state.tool, open: window.App.isChainPanelOpen() }));
    expect(mid.tool).toBe(await page.evaluate(() => window.App.TOOL.CHAIN));
    expect(mid.open).toBe(false);
  });

  test('closable palette: × closes, chip reopens, T reopens, drag position persists', async ({ page }) => {
    await setupChainProject(page);
    await page.locator('#chainBtn').click();
    await page.locator('#chainCounterList .chain-row[data-id="c-chain-1"]').click();
    await page.locator('#chainLineTypeList .chain-row[data-id="lt-chain-1"]').click();

    // × closes without leaving the tool; chip shows the pair.
    await page.locator('#chainPanelClose').click();
    expect(await page.evaluate(() => ({
      tool: window.state.tool === window.App.TOOL.CHAIN,
      hidden: document.getElementById('chainPanel').style.display === 'none',
      chip: document.getElementById('headerChainPair').style.display !== 'none',
    }))).toEqual({ tool: true, hidden: true, chip: true });

    // Chip click reopens the palette; chip hides again.
    await page.locator('#headerChainPair').click();
    expect(await page.evaluate(() => ({
      open: window.App.isChainPanelOpen(),
      chip: document.getElementById('headerChainPair').style.display !== 'none',
    }))).toEqual({ open: true, chip: false });

    // T while in Chain reopens a closed palette (and never clears an anchor).
    await page.locator('#chainPanelClose').click();
    await chainClicks(page, [{ x: 100, y: 100 }]);
    await page.keyboard.press('t');
    const reopened = await page.evaluate(() => ({ open: window.App.isChainPanelOpen(), anchor: !!window.state.chainStart }));
    expect(reopened).toEqual({ open: true, anchor: true });

    // Drag by the title bar: the panel moves and the position persists in
    // localStorage, surviving a close/reopen.
    const head = page.locator('#chainPanelHead');
    const box = await head.boundingBox();
    await page.mouse.move(box.x + 60, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 360, box.y + 210, { steps: 5 });
    await page.mouse.up();
    const dragged = await page.evaluate(() => {
      const r = document.getElementById('chainPanel').getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), stored: JSON.parse(localStorage.getItem('chainPanelPos')) };
    });
    expect(dragged.left).toBeGreaterThan(200);
    expect(dragged.stored.x).toBe(dragged.left);
    await page.locator('#chainPanelClose').click();
    await page.locator('#headerChainPair').click();
    const reopenedPos = await page.evaluate(() => Math.round(document.getElementById('chainPanel').getBoundingClientRect().left));
    expect(reopenedPos).toBe(dragged.left);
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

    // Both columns end with a "+ New" action row that drives the real sidebar
    // create button — the panel is self-serve on a fresh project.
    await expect(page.locator('#chainCounterList .chain-new-row')).toHaveText('+ New counter');
    await page.locator('#chainLineTypeList .chain-new-row').click();
    await expect(page.locator('#lineTypeModal')).toHaveClass(/visible/);
    // Tool stays CHAIN under the modal, so creating returns straight to the panel.
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.CHAIN));
  });

  test('glyph click selects the row AND opens its settings modal; edits reflect live', async ({ page }) => {
    await setupChainProject(page);
    await page.evaluate(() => {
      window.state.counters.push({ id: 'c-chain-2', name: 'Floor Drain', icon: 'M96 96h448v448H96z', color: '#e85447' });
      window.App.updateUI();
    });
    await page.locator('#chainBtn').click();
    await page.locator('#chainCounterList .chain-row[data-id="c-chain-1"]').click();

    // Clicking the UNSELECTED row's glyph selects it for chaining AND opens
    // the details modal (decided: one click does both); tool stays CHAIN.
    await page.locator('#chainCounterList .chain-row[data-id="c-chain-2"] .chain-glyph').click();
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => ({
      selected: window.state.activeCounterType,
      tool: window.state.tool === window.App.TOOL.CHAIN,
      modalName: document.getElementById('counterLineTypeDetailsName').value,
    }))).toEqual({ selected: 'c-chain-2', tool: true, modalName: 'Floor Drain' });

    // A rename in the modal reflects in the palette row after close. (The
    // Close button sits below the 720px viewport fold inside the tall
    // counter modal — click it via the DOM, like child-counts.spec.js.)
    await page.locator('#counterLineTypeDetailsName').fill('FD-2');
    await page.locator('#counterLineTypeDetailsName').blur();
    await page.evaluate(() => document.getElementById('counterLineTypeDetailsClose').click());
    await expect(page.locator('#chainCounterList .chain-row[data-id="c-chain-2"] .chain-row-name')).toHaveText('FD-2');

    // The line swatch does the same for line types.
    await page.locator('#chainLineTypeList .chain-row[data-id="lt-chain-1"] .chain-glyph').click();
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    expect(await page.evaluate(() => window.state.activeLineTypeId)).toBe('lt-chain-1');
    await page.evaluate(() => document.getElementById('counterLineTypeDetailsClose').click());
  });

  // + New in the palette made the item but left the create surface's own tool armed (the Counter
  // tool; the Line tool for a line type), so the next clicks were plain marks with no branch: the
  // plumbing tour's chain step read 3 of 3 done and never passed (persona harness, 2026-09-25).
  test('+ New counter and + New line type hand the new item back to Chain, the pair kept, and the next clicks chain', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => { errors.push(err.message); });
    await setupChainProject(page);
    await page.locator('#chainBtn').click();
    await page.locator('#chainLineTypeList .chain-row[data-id="lt-chain-1"]').click();
    await page.locator('#chainCounterList .chain-new-row').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    await page.locator('#counterName').fill('Lavatory');
    await page.locator('#counterCreate').click();
    await expect(page.locator('#counterModal')).not.toHaveClass(/visible/);
    await expect.poll(() => page.evaluate(() => window.state.tool === window.App.TOOL.CHAIN)).toBe(true);
    const after = await page.evaluate(() => {
      const lav = window.state.counters.find((c) => c.name === 'Lavatory');
      return { picked: window.state.activeCounterType === (lav && lav.id), lineType: window.state.activeLineTypeId, panel: document.getElementById('chainPanel').style.display !== 'none' };
    });
    expect(after).toEqual({ picked: true, lineType: 'lt-chain-1', panel: true });
    // the next clicks chain: marks AND the branch between them
    const box = await page.locator('#annCanvas').boundingBox();
    for (const dx of [0, 80, 160]) await page.mouse.click(box.x + 120 + dx, box.y + 120);
    const placed = await page.evaluate(() => {
      const lav = window.state.counters.find((c) => c.name === 'Lavatory');
      const ann = window.state.pages[0].canvases[0].annotations;
      return { marks: (ann.counterMarkers[lav.id] || []).length, lines: ann.quickLines.length };
    });
    expect(placed).toEqual({ marks: 3, lines: 2 });
    // and a line type made from the palette comes back the same way, the counter kept
    await page.locator('#chainLineTypeList .chain-new-row').click();
    await expect(page.locator('#lineTypeModal')).toHaveClass(/visible/);
    await page.locator('#lineTypeName').fill('3/4in PEX');
    await page.locator('#lineTypeCreate').click();
    await expect.poll(() => page.evaluate(() => window.state.tool === window.App.TOOL.CHAIN)).toBe(true);
    const lt = await page.evaluate(() => {
      const made = window.state.lineTypes.find((l) => l.name === '3/4in PEX');
      const lav = window.state.counters.find((c) => c.name === 'Lavatory');
      return { picked: window.state.activeLineTypeId === (made && made.id), counterKept: window.state.activeCounterType === lav.id };
    });
    expect(lt).toEqual({ picked: true, counterKept: true });
    expect(errors).toEqual([]);
  });

  test('scale gate: unscaled page toasts and does not activate', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
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

  // Persona calibration C2 (2026-09-25): the palette was display:none below 769 px while the Chain
  // button sat in the header strip, so a tablet or phone could arm Chain but never pick the counter
  // or the line type. It shows at every width now and takes a tap.
  for (const [w, h] of [[768, 1024], [375, 812]]) {
    test.describe(`at ${w} px`, () => {
      test.use({ viewport: { width: w, height: h }, hasTouch: true });
      test('arming Chain shows the palette on screen, and a tap picks a row', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (err) => { errors.push(err.message); });
        await setupChainProject(page);
        await page.tap('#chainBtn');
        expect(await page.evaluate(() => window.state.tool === window.App.TOOL.CHAIN)).toBe(true);
        const panel = page.locator('#chainPanel');
        await expect(panel).toBeVisible();
        const box = await panel.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(w);
        await page.locator('#chainCounterList .chain-row[data-id="c-chain-1"]').tap();
        await page.locator('#chainLineTypeList .chain-row[data-id="lt-chain-1"]').tap();
        expect(await page.evaluate(() => [window.state.activeCounterType, window.state.activeLineTypeId])).toEqual(['c-chain-1', 'lt-chain-1']);
        expect(errors).toEqual([]);
      });

      // The palette sits above .modal-overlay (300 over 200): + New counter opened the Counter
      // dialog UNDER it, and a tap on the Name field landed on a palette row and changed the
      // chain's line type (persona calibration review, 2026-09-25). It steps aside while a
      // dialog shows and comes back when the dialog closes.
      test('+ New counter opens the Counter dialog over the palette, not under it', async ({ page }) => {
        await setupChainProject(page);
        await page.tap('#chainBtn');
        await expect(page.locator('#chainPanel')).toBeVisible();
        await page.locator('#chainCounterList .chain-new-row').tap();
        await expect(page.locator('#counterModal')).toHaveClass(/visible/);
        await expect(page.locator('#chainPanel')).toBeHidden();
        const hit = await page.evaluate(() => {
          // The left edge of the Name field and the first tab are where the palette used to sit.
          const hits = (el) => {
            const r = el.getBoundingClientRect();
            const at = document.elementFromPoint(r.left + 8, r.top + r.height / 2);
            return !!at && (at === el || el.contains(at));
          };
          return {
            name: hits(document.getElementById('counterName')),
            tab: hits(document.querySelector('#counterModal .counter-tab')),
          };
        });
        expect(hit).toEqual({ name: true, tab: true });
        await page.keyboard.press('Escape');
        await expect(page.locator('#counterModal')).not.toHaveClass(/visible/);
        await expect(page.locator('#chainPanel')).toBeVisible();
        expect(await page.evaluate(() => window.state.activeLineTypeId)).toBe(null);
      });
    });
  }
});

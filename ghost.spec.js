// @ts-check
/**
 * features/ghost.js (the Ghost tool): copy a batch of marks as a translucent
 * reference overlay, drag it, and stamp it down as real marks.
 *
 * Pins: the registry contract, the button/hotkey arming TOOL.GHOST, the
 * three-click capture->place gesture, the both-ends capture rule, the staged
 * Escape ladder, the per-ghost show/hide toggles, Stamp minting real counted
 * marks, and the two properties the whole design rests on —
 *   (1) a ghost NEVER moves a tally (footer totals, sidebar counts, the
 *       Summary, pageHasAnyAnnotations) until it is stamped, and
 *   (2) it survives the save/load sanitizer.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function seedPlan(page) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  // 10 pt per ft, one counter type, one line type, and a small "typical":
  // two fixtures and a run, all inside a 0,0-100,100 box.
  await page.evaluate(() => {
    const st = window.state;
    st.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
    st.counters = [{ id: 'wc', name: 'Water Closet', icon: window.App.state.counters[0]?.icon || '', color: '#e8c547' }];
    st.lineTypes = [{ id: 'waste', name: 'Waste', color: '#47c88e', curveStyle: 'straight' }];
    const ann = window.App.getActiveAnnotations(st.pages[0]);
    ann.counterMarkers = { wc: [{ x: 10, y: 10, id: 'm1' }, { x: 20, y: 20, id: 'm2' }] };
    ann.quickLines = [{ x1: 10, y1: 30, x2: 40, y2: 30, id: 'q1', lineTypeId: 'waste', color: '#47c88e' }];
    window.App.updateUI();
  });
}

const totals = (page) => page.evaluate(() => {
  const st = window.state;
  const ann = window.App.getActiveAnnotations(st.pages[0]);
  let counters = 0;
  Object.values(ann.counterMarkers || {}).forEach(a => { counters += a.length; });
  return {
    counters,
    lines: (ann.quickLines || []).length + (ann.polylines || []).length,
    ghosts: (ann.ghosts || []).length,
    footer: document.getElementById('statusTotals')?.textContent || '',
  };
});

test.describe('Ghost tool (features/ghost.js)', () => {
  test('registry contract + arming', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await seedPlan(page);

    const contract = await page.evaluate(() => ({
      handleGhostCanvasClick: typeof window.App.handleGhostCanvasClick,
      handleGhostEscape: typeof window.App.handleGhostEscape,
      tryOpenGhostMenuAt: typeof window.App.tryOpenGhostMenuAt,
      captureGhostFromRect: typeof window.App.captureGhostFromRect,
      stampGhostIntoAnnotations: typeof window.App.stampGhostIntoAnnotations,
      ghostBounds: typeof window.App.ghostBounds,
      ghostIndexAtPoint: typeof window.App.ghostIndexAtPoint,
      toolGhost: window.App.TOOL.GHOST,
    }));
    expect(contract.handleGhostCanvasClick).toBe('function');
    expect(contract.handleGhostEscape).toBe('function');
    expect(contract.tryOpenGhostMenuAt).toBe('function');
    expect(contract.captureGhostFromRect).toBe('function');
    expect(contract.stampGhostIntoAnnotations).toBe('function');
    expect(contract.ghostBounds).toBe('function');
    expect(contract.ghostIndexAtPoint).toBe('function');
    expect(contract.toolGhost).toBe(14);

    await page.evaluate(() => { document.getElementById('ghostBtn').click(); });
    expect(await page.evaluate(() => window.state.tool)).toBe(14);
    await expect(page.locator('#ghostBtn')).toHaveClass(/active/);

    // The G hotkey routes through the same button (HOTKEYS btnId contract).
    await page.evaluate(() => { document.getElementById('moveBtn').click(); });
    await page.locator('body').press('g');
    expect(await page.evaluate(() => window.state.tool)).toBe(14);

    expect(errors.filter(e => !/config\.local\.js|404/.test(e))).toEqual([]);
  });

  test('capture -> place leaves every tally untouched', async ({ page }) => {
    await seedPlan(page);
    const before = await totals(page);
    expect(before).toMatchObject({ counters: 2, lines: 1, ghosts: 0 });

    await page.evaluate(() => { document.getElementById('ghostBtn').click(); });
    // Three clicks: corner, corner, drop.
    await page.evaluate(() => { window.App.handleGhostCanvasClick({ x: 0, y: 0 }); });
    expect(await page.evaluate(() => !!window.state.ghostRectStart)).toBe(true);
    await page.evaluate(() => { window.App.handleGhostCanvasClick({ x: 100, y: 100 }); });
    expect(await page.evaluate(() => !!window.state.placingGhost)).toBe(true);
    // The drop click pins the ghost: it moves by (drop - last tracked point),
    // which on touch (no mousemove) is what carries it off the source. Last
    // tracked point starts at the capture box center (50,50), so dropping at
    // (300,100) shifts the batch by (+250,+50).
    await page.evaluate(() => { window.App.handleGhostCanvasClick({ x: 300, y: 100 }); });

    const after = await totals(page);
    expect(after.ghosts).toBe(1);
    // The whole point: a ghost is on the plan and in NO number.
    expect(after.counters).toBe(before.counters);
    expect(after.lines).toBe(before.lines);
    expect(after.footer).toBe(before.footer);

    // It captured copies at the moved position, not references.
    const shape = await page.evaluate(() => {
      const g = window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0];
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return {
        counts: window.App.ghostCounts(g),
        firstX: g.src.counterMarkers.wc[0].x,
        sourceFirstX: ann.counterMarkers.wc[0].x,
        showCounters: g.showCounters,
        showLines: g.showLines,
      };
    });
    expect(shape.counts).toEqual({ counters: 2, lines: 1 });
    expect(shape.firstX).toBe(260);
    expect(shape.sourceFirstX).toBe(10);
    expect(shape.showCounters).toBe(true);
    expect(shape.showLines).toBe(true);

    // A ghost alone must not badge the sheet as marked-up.
    const ghostOnlyIsMarked = await page.evaluate(() => {
      const clean = window.App.makeAnnotations();
      clean.ghosts = [window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0]];
      return !!window.App.pageHasAnyAnnotations({ canvases: [{ id: 'x', name: 'Main', annotations: clean }] });
    });
    expect(ghostOnlyIsMarked).toBe(false);
  });

  test('empty box refuses, and Escape unwinds one step at a time', async ({ page }) => {
    await seedPlan(page);
    await page.evaluate(() => { document.getElementById('ghostBtn').click(); });

    // A box with nothing in it makes no ghost.
    await page.evaluate(() => {
      window.App.handleGhostCanvasClick({ x: 400, y: 400 });
      window.App.handleGhostCanvasClick({ x: 450, y: 450 });
    });
    expect(await page.evaluate(() => !!window.state.placingGhost)).toBe(false);
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ghosts || []).length)).toBe(0);

    // Escape ladder: ghost in hand -> first corner -> exit to Move.
    await page.evaluate(() => {
      window.App.handleGhostCanvasClick({ x: 0, y: 0 });
      window.App.handleGhostCanvasClick({ x: 100, y: 100 });
    });
    expect(await page.evaluate(() => !!window.state.placingGhost)).toBe(true);
    await page.locator('body').press('Escape');
    expect(await page.evaluate(() => !!window.state.placingGhost)).toBe(false);
    expect(await page.evaluate(() => window.state.tool)).toBe(14);

    await page.evaluate(() => { window.App.handleGhostCanvasClick({ x: 0, y: 0 }); });
    await page.locator('body').press('Escape');
    expect(await page.evaluate(() => !!window.state.ghostRectStart)).toBe(false);
    expect(await page.evaluate(() => window.state.tool)).toBe(14);

    await page.locator('body').press('Escape');
    expect(await page.evaluate(() => window.state.tool)).toBe(0);
  });

  test('toggles gate the stamp; Stamp mints real marks and undo takes them back', async ({ page }) => {
    await seedPlan(page);
    await page.evaluate(() => {
      document.getElementById('ghostBtn').click();
      window.App.handleGhostCanvasClick({ x: 0, y: 0 });
      window.App.handleGhostCanvasClick({ x: 100, y: 100 });
      window.App.translateGhost(window.state.placingGhost, 200, 0);
      window.App.handleGhostCanvasClick({ x: 300, y: 100 });
    });

    // Runs hidden -> the stamp brings counts only.
    await page.evaluate(() => {
      const g = window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0];
      g.showLines = false;
    });
    const res1 = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return window.App.stampGhostIntoAnnotations(ann, ann.ghosts[0]);
    });
    expect(res1).toEqual({ counters: 2, lines: 0 });
    let now = await totals(page);
    expect(now.counters).toBe(4);
    expect(now.lines).toBe(1);

    // Re-enable runs and stamp again — the ghost survives its own stamp, so a
    // typical can be walked across the sheet and dropped repeatedly.
    const res2 = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      ann.ghosts[0].showLines = true;
      return window.App.stampGhostIntoAnnotations(ann, ann.ghosts[0]);
    });
    expect(res2).toEqual({ counters: 2, lines: 1 });
    now = await totals(page);
    expect(now).toMatchObject({ counters: 6, lines: 2, ghosts: 1 });

    // Stamped marks carry fresh ids (a stamp is a new mark, not an alias).
    const idsUnique = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      const ids = ann.counterMarkers.wc.map(m => m.id);
      return new Set(ids).size === ids.length;
    });
    expect(idsUnique).toBe(true);
  });

  test('dragging a ghost with the mouse never arms a capture corner', async ({ page }) => {
    await seedPlan(page);
    // Place a ghost via the gesture API, then interact with REAL pointer
    // events — the click that the browser fires after mouseup is the path
    // unit-style calls skip, and exactly where the drag/capture collision
    // lives.
    await page.evaluate(() => {
      document.getElementById('ghostBtn').click();
      window.App.handleGhostCanvasClick({ x: 0, y: 0 });
      window.App.handleGhostCanvasClick({ x: 100, y: 100 });
      window.App.handleGhostCanvasClick({ x: 300, y: 100 });
      // The "Ghost placed" toast is a full-screen overlay (the app-wide toast
      // behavior JOURNEY-MAP Tier-2 #15 exists to fix) and would swallow the
      // pointer events below for its 3.2s lifetime — dismiss it first.
      window.App.hideModal('airboardToastModal');
    });
    const toScreen = async (pdfX, pdfY) => page.evaluate(([x, y]) => {
      const wrap = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper');
      const r = wrap.getBoundingClientRect();
      return { cx: r.left + x * window.state.zoom + window.state.pan.x, cy: r.top + y * window.state.zoom + window.state.pan.y };
    }, [pdfX, pdfY]);

    const start = await page.evaluate(() => {
      const g = window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0];
      const b = window.App.ghostBounds(g);
      return { midX: (b.x1 + b.x2) / 2, midY: (b.y1 + b.y2) / 2, firstX: g.src.counterMarkers.wc[0].x };
    });
    const from = await toScreen(start.midX, start.midY);
    const to = await toScreen(start.midX + 50, start.midY);
    await page.mouse.move(from.cx, from.cy);
    await page.mouse.down();
    await page.mouse.move(to.cx, to.cy, { steps: 5 });
    await page.mouse.up();

    const after = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return {
        firstX: ann.ghosts[0].src.counterMarkers.wc[0].x,
        rectArmed: !!window.state.ghostRectStart,
        placing: !!window.state.placingGhost,
        ghosts: ann.ghosts.length,
      };
    });
    // The batch moved by the drag delta...
    expect(Math.abs(after.firstX - (start.firstX + 50))).toBeLessThan(2);
    // ...and the click the browser fires after mouseup did NOT start a new
    // capture box or pick anything up (the justFinishedDragGhost swallow).
    expect(after.rectArmed).toBe(false);
    expect(after.placing).toBe(false);
    expect(after.ghosts).toBe(1);

    // A plain click on the ghost (no movement) is also ghost interaction,
    // never the first corner of a capture.
    await page.mouse.move(to.cx, to.cy);
    await page.mouse.down();
    await page.mouse.up();
    expect(await page.evaluate(() => !!window.state.ghostRectStart)).toBe(false);
  });

  test('ghosts survive the save/load sanitizer', async ({ page }) => {
    await seedPlan(page);
    await page.evaluate(() => {
      document.getElementById('ghostBtn').click();
      window.App.handleGhostCanvasClick({ x: 0, y: 0 });
      window.App.handleGhostCanvasClick({ x: 100, y: 100 });
      window.App.handleGhostCanvasClick({ x: 100, y: 100 });
    });
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ghosts || []).length)).toBe(1);

    // Round-trip the page through the exact shape the cloud save writes and
    // the load path sanitizes.
    const restored = await page.evaluate(() => {
      const st = window.state;
      const wire = JSON.parse(JSON.stringify({
        index: 0, label: st.pages[0].label, canvases: st.pages[0].canvases,
        scale: st.pages[0].scale, rotation: st.pages[0].rotation ?? 0,
      }));
      st.pages[0].canvases = [];
      window.App.applyPageAnnotationsFromData(st.pages[0], wire);
      const ann = window.App.getActiveAnnotations(st.pages[0]);
      return {
        ghosts: (ann.ghosts || []).length,
        counts: ann.ghosts?.[0] ? window.App.ghostCounts(ann.ghosts[0]) : null,
        label: ann.ghosts?.[0]?.label,
      };
    });
    expect(restored.ghosts).toBe(1);
    expect(restored.counts).toEqual({ counters: 2, lines: 1 });
    expect(restored.label).toBe('Typical');
  });

  // MAP-GHOST-DELETE (DECOMPOSITION_MAP D32): deleting a counter, a line type
  // or a group used to prune the live marks only. The Typical kept them, drew
  // a deleted counter as a default circle, and Stamp put back marks no tally
  // counts. Each case deletes through the real surface, then stamps through
  // the ghost menu.
  test.describe('deleting a type or group reaches inside the Typical', () => {
    // A second counter type in the box, so a delete has a survivor to keep,
    // and a group on one fixture and the run.
    async function seedTypical(page) {
      await seedPlan(page);
      await page.evaluate(() => {
        const st = window.state;
        st.counters.push({ id: 'lav', name: 'Lavatory', icon: st.counters[0].icon, color: '#4a9eff' });
        st.groups = [{ id: 'grp', name: 'Level 1', color: '#4a9eff' }];
        const ann = window.App.getActiveAnnotations(st.pages[0]);
        ann.counterMarkers.lav = [{ x: 60, y: 60, id: 'm3' }];
        ann.counterMarkers.wc[0].group = 'grp';
        ann.quickLines[0].group = 'grp';
        window.App.updateUI();
        document.getElementById('ghostBtn').click();
        window.App.handleGhostCanvasClick({ x: 0, y: 0 });
        window.App.handleGhostCanvasClick({ x: 100, y: 100 });
        window.App.handleGhostCanvasClick({ x: 300, y: 100 });
        window.App.hideModal('airboardToastModal');
      });
      expect(await page.evaluate(() => window.App.ghostCounts(window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0])))
        .toEqual({ counters: 3, lines: 1 });
    }

    async function deleteItem(page, kind, id) {
      await page.evaluate(([k, i]) => {
        const list = k === 'counter' ? window.state.counters : window.state.lineTypes;
        window.App.openCounterLineTypeDetailsModal(k, list.find(x => x.id === i));
      }, [kind, id]);
      await page.waitForSelector('#counterLineTypeDetailsModal.visible', { timeout: 5000 });
      await page.evaluate(() => document.getElementById('counterLineTypeDetailsDelete').click());
      await page.waitForSelector('#deleteCounterLineTypeConfirmModal.visible', { timeout: 5000 });
      await page.evaluate(() => document.getElementById('deleteCounterLineTypeConfirm').click());
      await expect(page.locator('#counterLineTypeDetailsModal')).not.toHaveClass(/visible/);
    }

    // Right-click the ghost with the Ghost tool armed, then Stamp from its menu.
    async function stampFromMenu(page) {
      await page.evaluate(() => {
        const st = window.state;
        if (st.tool !== window.App.TOOL.GHOST) document.getElementById('ghostBtn').click();
        const b = window.App.ghostBounds(window.App.getActiveAnnotations(st.pages[0]).ghosts[0]);
        if (!window.App.tryOpenGhostMenuAt({ x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 }, 200, 200)) throw new Error('ghost menu did not open');
        document.querySelector('#ghostMenu [data-ghost-action="stamp"]').click();
      });
    }

    const liveMarks = (page) => page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      const byType = {};
      Object.entries(ann.counterMarkers || {}).forEach(([k, a]) => { byType[k] = a.length; });
      const lines = (ann.quickLines || []).concat(ann.polylines || []);
      return {
        byType,
        lineTypes: lines.map(l => l.lineTypeId),
        groups: Object.values(ann.counterMarkers || {}).flat().concat(lines).map(m => m.group || null),
        footer: document.getElementById('statusTotals')?.textContent || '',
      };
    });

    test('a deleted counter never comes back from a stamp', async ({ page }) => {
      await seedTypical(page);
      await deleteItem(page, 'counter', 'wc');
      const before = await liveMarks(page);
      expect(before.byType.wc || 0).toBe(0);
      expect(before.byType.lav).toBe(1);
      // The Typical lost the counter too, and still holds the rest.
      expect(await page.evaluate(() => window.App.ghostCounts(window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0])))
        .toEqual({ counters: 1, lines: 1 });

      await stampFromMenu(page);
      const after = await liveMarks(page);
      expect(after.byType.wc || 0).toBe(0);      // no marks of the deleted counter
      expect(after.byType.lav).toBe(2);          // the survivor stamped as usual
      expect(after.lineTypes).toEqual(['waste', 'waste']);
      // Every stamped mark belongs to a type the palette still has, so nothing
      // is drawn that the tallies skip.
      expect(await page.evaluate(() => {
        const ann = window.App.getActiveAnnotations(window.state.pages[0]);
        const ids = new Set(window.state.counters.map(c => c.id));
        return Object.keys(ann.counterMarkers).filter(k => ann.counterMarkers[k].length && !ids.has(k));
      })).toEqual([]);
    });

    test('a deleted line type never comes back from a stamp', async ({ page }) => {
      await seedTypical(page);
      await deleteItem(page, 'lineType', 'waste');
      const before = await liveMarks(page);
      expect(before.lineTypes).toEqual([]);
      expect(await page.evaluate(() => window.App.ghostCounts(window.App.getActiveAnnotations(window.state.pages[0]).ghosts[0])))
        .toEqual({ counters: 3, lines: 0 });

      await stampFromMenu(page);
      const after = await liveMarks(page);
      expect(after.lineTypes).toEqual([]);       // no run of the deleted line type
      expect(after.byType).toEqual({ wc: 4, lav: 2 });
    });

    test('a deleted group leaves no id inside the Typical to stamp back', async ({ page }) => {
      await seedTypical(page);
      await page.evaluate(() => { window.__delGroup = window.App.deleteGroup('grp'); });
      await expect(page.locator('#confirmModal')).toHaveClass(/visible/);
      await page.locator('#confirmOk').click();
      expect(await page.evaluate(() => window.__delGroup)).toBe(true);
      await stampFromMenu(page);
      const after = await liveMarks(page);
      expect(after.byType).toEqual({ wc: 4, lav: 2 });
      expect(after.groups.filter(Boolean)).toEqual([]);
    });

    test('deleting everything a Typical held removes the Typical', async ({ page }) => {
      await seedTypical(page);
      await deleteItem(page, 'counter', 'wc');
      await deleteItem(page, 'counter', 'lav');
      await deleteItem(page, 'lineType', 'waste');
      expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ghosts || []).length)).toBe(0);
      // The delete's own undo snapshot holds the Typical, so Ctrl+Z brings it
      // back with the line type.
      await page.locator('body').press('Control+z');
      const ghosts = await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ghosts || []).map(g => window.App.ghostCounts(g)));
      expect(ghosts).toEqual([{ counters: 0, lines: 1 }]);
    });
  });
});

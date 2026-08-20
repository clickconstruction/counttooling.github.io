// @ts-check
/**
 * Tests: the Drop tool (features/drop-mode.js + the TOOL.DROP wiring in
 * app.js) and the recent-drops speed surfaces around it.
 *
 * Pins: arming via #dropBtn shows the size palette; a custom size commits
 * through pushRecentDrop and becomes the selection; an armed click on a line
 * end writes the size (via the node model — a chain joint shared by two line
 * ends carries the drop ONCE, never twice); the same size again clears it
 * (click-to-toggle); each click is one undo step; the Esc ladder closes the
 * palette then exits the tool; the context menu's repeat row applies the
 * last-used size to the nearest end in one click; and the Line Properties
 * Recent chips read the same store.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function setupDropProject(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    s.lineTypes.push({ id: 'lt-drop-1', name: '2in Cu Riser', color: '#4a9eff' });
    // A chained pair: q1's end and q2's start meet at (100,100).
    const canvas = window.App.ensureActiveCanvas(s.pages[0]);
    canvas.annotations.quickLines = [
      { x1: 20, y1: 20, x2: 100, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt-drop-1' },
      { x1: 100, y1: 100, x2: 200, y2: 100, color: '#4a9eff', id: 'q2', lineTypeId: 'lt-drop-1' },
    ];
    window.App.updateUI();
    window.App.renderAnnotations();
  });
}

test.describe('Drop tool', () => {
  test('arm, custom size, node click sets once at a shared joint, toggle clears, undo, Esc ladder', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await setupDropProject(page);

    // Arm via the real header button; the palette panel appears.
    await page.click('#dropBtn');
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.DROP)).toBe(true);
    await expect(page.locator('#dropPanel')).toBeVisible();

    // No recents yet: empty state, then a custom 3 ft commits + selects.
    await expect(page.locator('#dropSizeList .chain-list-empty')).toBeVisible();
    await page.fill('#dropCustomValue', '3');
    await page.click('#dropCustomAdd');
    await expect(page.locator('#dropSizeList .drop-size-btn.selected')).toHaveText('3 ft');
    expect(await page.evaluate(() => window.App.getRecentDrops())).toEqual([{ value: 3, unit: 'ft' }]);

    // Armed click on the shared joint (100,100): the node model writes ONE
    // ref, so the two coincident line ends carry 3 ft total, not 6.
    await page.evaluate(() => window.App.commitDropClick({ x: 100, y: 100 }));
    const joint = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return { q1end: ann.quickLines[0].endDrop || 0, q2start: ann.quickLines[1].startDrop || 0 };
    });
    expect(joint.q1end + joint.q2start).toBe(3);

    // Same size again on the same node clears it (click-to-toggle)…
    await page.evaluate(() => window.App.commitDropClick({ x: 100, y: 100 }));
    expect(await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return (ann.quickLines[0].endDrop || 0) + (ann.quickLines[1].startDrop || 0);
    })).toBe(0);

    // …and one undo brings it back (each click was one snapshot).
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return (ann.quickLines[0].endDrop || 0) + (ann.quickLines[1].startDrop || 0);
    })).toBe(3);

    // The undo just toasted its remaining-count ("N undos left"); Escape
    // dismisses a visible toast before anything else, so wait it out.
    await expect(page.locator('#airboardToastModal')).not.toHaveClass(/visible/, { timeout: 5000 });

    // Esc ladder: first Escape closes the palette (tool stays), second exits.
    await page.keyboard.press('Escape');
    await expect(page.locator('#dropPanel')).toBeHidden();
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.DROP)).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.NONE)).toBe(true);

    expect(errors).toEqual([]);
  });

  test('context-menu repeat row + Line Properties Recent chips share the store', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await setupDropProject(page);

    // Seed the shared store the way any surface would.
    await page.evaluate(() => window.App.pushRecentDrop(10, 'ft'));

    // The context menu on a line offers "Drop 10 ft here"; clicking applies it
    // to the clicked line's NEAREST end (the click point rides ctxTarget.pdf).
    // Drive the REAL showContextMenu path so the row's visibility + label are
    // under test too, then click the row.
    await page.evaluate(() => {
      window.state.ctxTarget = { type: 'quickLine', index: 1, pdf: { x: 190, y: 100 } };
      window.App.showContextMenu(60, 60);
    });
    await expect(page.locator('#ctxRepeatDrop')).toBeVisible();
    await expect(page.locator('#ctxRepeatDrop')).toHaveText('Drop 10 ft here');
    await page.evaluate(() => document.getElementById('ctxRepeatDrop').click());
    const applied = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return { end: ann.quickLines[1].endDrop || 0, unit: ann.quickLines[1].endDropUnit || null, start: ann.quickLines[1].startDrop || 0 };
    });
    expect(applied.end).toBe(10);
    expect(applied.unit).toBe('ft');
    expect(applied.start).toBe(0);

    // Line Properties shows the same size as a Recent chip; clicking it
    // commits to the OTHER line's start drop in one click.
    await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      window.App.openLinePropertiesModal({ type: 'quick', q: ann.quickLines[0], pageIdx: 0 });
    });
    await page.waitForSelector('#linePropertiesModal.visible', { timeout: 5000 });
    const chip = page.locator('#linePropertiesStartDropRecent .drop-recent-chip').first();
    await expect(chip).toHaveText('10 ft');
    await chip.click();
    expect(await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return ann.quickLines[0].startDrop;
    })).toBe(10);
    // The field echoes the committed value (the parse/echo contract).
    await expect(page.locator('#linePropertiesStartDrop')).toHaveValue('10');
    await page.keyboard.press('Escape');

    expect(errors).toEqual([]);
  });

  test('decimal + ft-in entry store exactly what the field shows; no-op close stays clean', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await setupDropProject(page);

    await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      window.App.openLinePropertiesModal({ type: 'quick', q: ann.quickLines[0], pageIdx: 0 });
    });
    await page.waitForSelector('#linePropertiesModal.visible', { timeout: 5000 });

    // "10.5" is stored as 10.5 (parseInt used to truncate it to 10 while the
    // field kept reading 10.5); "8'6" means eight and a half feet.
    await page.evaluate(() => {
      const el = document.getElementById('linePropertiesStartDrop');
      el.value = '10.5'; el.dispatchEvent(new Event('blur'));
    });
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).quickLines[0].startDrop)).toBe(10.5);
    await page.evaluate(() => {
      const el = document.getElementById('linePropertiesStartDrop');
      el.value = "8'6"; el.dispatchEvent(new Event('blur'));
    });
    expect(await page.evaluate(() => window.App.getActiveAnnotations(window.state.pages[0]).quickLines[0].startDrop)).toBe(8.5);
    await expect(page.locator('#linePropertiesStartDrop')).toHaveValue('8.5');
    await page.keyboard.press('Escape');

    // Open + close with no edits: not dirty, no undo snapshot burned.
    await page.evaluate(() => window.App.setAutoSaveDirty(false));
    const depthBefore = await page.evaluate(() => window.App.getUndoDepth ? window.App.getUndoDepth() : null);
    await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      window.App.openLinePropertiesModal({ type: 'quick', q: ann.quickLines[1], pageIdx: 0 });
    });
    await page.waitForSelector('#linePropertiesModal.visible', { timeout: 5000 });
    await page.click('#linePropertiesClose');
    expect(await page.evaluate(() => window.App.getAutoSaveDirty())).toBe(false);
    if (depthBefore != null) {
      expect(await page.evaluate(() => window.App.getUndoDepth())).toBe(depthBefore);
    }

    expect(errors).toEqual([]);
  });
});

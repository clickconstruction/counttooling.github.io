// @ts-check
/**
 * Tests: drop-size disclosure (features/drop-peek.js + the TOOL.NONE wiring
 * in app.js) — wendi's view-mode request: read drop distances without
 * cluttering the sheet.
 *
 * Pins: the peek chip appears on a REAL hover over a drop marker (line-type
 * name + value in the drop's own unit) and hides on hover-away; a click PINS
 * the chip and it survives the pointer leaving; any pointerdown / wheel /
 * keydown dismisses it; a chain joint (two coincident line ends, drop carried
 * once by the node model) peeks ONE value; the #dropSizesBtn header toggle is
 * hidden until the project has drops, flips state.showDropSizes +
 * aria-pressed, persists per device (clickcount-show-drop-sizes), and
 * repaints without console errors.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadPdf(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

async function seedDrops(page) {
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    s.lineTypes.push({ id: 'lt-peek-1', name: '2in Cu Riser', color: '#4a9eff' });
    const canvas = window.App.ensureActiveCanvas(s.pages[0]);
    // q1 carries a 3 ft start drop at (100,100); q2's start is COINCIDENT at
    // (100,100) with no drop of its own (the node model's one-carrier rule).
    // q1's far end (250,100) carries a 6 in drop.
    canvas.annotations.quickLines = [
      { x1: 100, y1: 100, x2: 250, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt-peek-1', startDrop: 3, startDropUnit: 'ft', endDrop: 6, endDropUnit: 'in' },
      { x1: 100, y1: 100, x2: 100, y2: 220, color: '#4a9eff', id: 'q2', lineTypeId: 'lt-peek-1' },
    ];
    window.App.updateUI();
    window.App.renderAnnotations();
  });
}

// PDF-space -> viewport client coords, through the same canvas-rect mapping the
// chip positioner uses.
async function screenPointForPdf(page, pdf) {
  return page.evaluate((p) => {
    const annCanvas = document.getElementById('annCanvas');
    const rect = annCanvas.getBoundingClientRect();
    const bc = window.App.toCanvas(p);
    return {
      x: rect.left + bc.x * (rect.width / annCanvas.width),
      y: rect.top + bc.y * (rect.height / annCanvas.height),
    };
  }, pdf);
}

test.describe('Drop-size peek + Drop sizes toggle', () => {
  test('hover peeks, click pins, pointerdown/wheel/keydown dismiss, toggle persists', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await loadPdf(page);
    // Pages loaded but no drops anywhere: the toggle stays out of the header.
    await expect(page.locator('#dropSizesBtn')).toBeHidden();

    await seedDrops(page);
    // The header toggle appears once the project has drops to label.
    await expect(page.locator('#dropSizesBtn')).toBeVisible();

    const chip = page.locator('#dropPeekChip');
    const joint = await screenPointForPdf(page, { x: 100, y: 100 });
    const farEnd = await screenPointForPdf(page, { x: 250, y: 100 });
    const empty = await screenPointForPdf(page, { x: 180, y: 200 });

    // REAL hover over the chain joint: one chip, one value (the node model
    // carries the shared point's drop once), named for the line type.
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.move(joint.x, joint.y);
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('2in Cu Riser');
    await expect(chip).toContainText('3 ft drop');

    // The far end peeks its own drop in its own unit.
    await page.mouse.move(farEnd.x, farEnd.y);
    await expect(chip).toContainText('6 in drop');

    // Hover away: the unpinned chip hides.
    await page.mouse.move(empty.x, empty.y);
    await expect(chip).toBeHidden();

    // Click pins: the chip survives the pointer leaving the marker.
    await page.mouse.click(joint.x, joint.y);
    await expect(chip).toBeVisible();
    await page.mouse.move(empty.x, empty.y);
    await expect(chip).toBeVisible();

    // Any pointerdown dismisses a pinned chip (here: an empty-canvas click).
    await page.mouse.click(empty.x, empty.y);
    await expect(chip).toBeHidden();

    // Wheel dismisses (the zoom is about to move the sheet under the chip).
    await page.mouse.click(joint.x, joint.y);
    await expect(chip).toBeVisible();
    await page.mouse.move(joint.x, joint.y);
    await page.mouse.wheel(0, -40);
    await expect(chip).toBeHidden();

    // Keydown dismisses (covers page nav / rotate / undo; Shift is inert).
    await page.mouse.click(joint.x, joint.y);
    await expect(chip).toBeVisible();
    await page.keyboard.press('Shift');
    await expect(chip).toBeHidden();

    // The toggle: on -> state + aria + per-device persistence; off -> cleared.
    await page.click('#dropSizesBtn');
    expect(await page.evaluate(() => window.state.showDropSizes)).toBe(true);
    await expect(page.locator('#dropSizesBtn')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('clickcount-show-drop-sizes'))).toBe('1');
    await page.click('#dropSizesBtn');
    expect(await page.evaluate(() => window.state.showDropSizes)).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('clickcount-show-drop-sizes'))).toBe('0');

    // The persisted toggle survives a reload of the shell.
    await page.evaluate(() => localStorage.setItem('clickcount-show-drop-sizes', '1'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.state.showDropSizes)).toBe(true);

    expect(errors).toEqual([]);
  });

  test('peek stays out of the way: no chip while a draw tool is armed or marks are hidden', async ({ page }) => {
    await loadPdf(page);
    await seedDrops(page);
    const chip = page.locator('#dropPeekChip');
    const joint = await screenPointForPdf(page, { x: 100, y: 100 });
    const empty = await screenPointForPdf(page, { x: 180, y: 200 });

    // Armed Line tool: hovering the marker must NOT peek (the hook is gated to
    // TOOL.NONE, so draw gestures never fight a tooltip).
    await page.evaluate(() => { window.state.tool = window.App.TOOL.LINE; });
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.move(joint.x, joint.y);
    await expect(chip).toBeHidden();
    await page.evaluate(() => { window.state.tool = window.App.TOOL.NONE; });

    // Hide marks: the glyphs are blanked, so the peek is silenced with them.
    await page.click('#hideMarksBtn');
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.move(joint.x, joint.y);
    await expect(chip).toBeHidden();
  });
});

// @ts-check
/**
 * features/custom-icon-upload.js (registry split #37): the SVG upload path —
 * parseUploadedSvg (DOMParser walk over path/rect/circle/ellipse/line via the
 * pure App.svgShapeToPath), persistence through App.saveUserCustomIcons, and
 * the post-upload refresh of the paired built-in/custom picker grids (now
 * built by the shared App.customIconCellsHtml / App.iconGridCellsHtml from
 * icon-render.js).
 *
 * All always-run: a real file lands in #customIconUploadInput via
 * setInputFiles, so the genuine FileReader + DOMParser path executes.
 */
const { test, expect } = require('@playwright/test');

const GOOD_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
  + '<rect x="4" y="4" width="24" height="24"/><circle cx="16" cy="16" r="6"/></svg>');
const EMPTY_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text>no shapes</text></svg>');

async function bootWithCreateCounterOpen(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  // Open the Create Counter tab so the paired grids exist and are populated.
  await page.evaluate(() => document.getElementById('addCounter')?.click());
  await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
}

test.describe('Custom icon upload (features/custom-icon-upload.js)', () => {
  test('registry wired; shared grid builders published', async ({ page }) => {
    const errors = [];
    await bootWithCreateCounterOpen(page, errors);
    const wired = await page.evaluate(() => ({
      shape: typeof window.App?.svgShapeToPath,
      gridCells: typeof window.App?.iconGridCellsHtml,
      customCells: typeof window.App?.customIconCellsHtml,
    }));
    expect(wired).toEqual({ shape: 'function', gridCells: 'function', customCells: 'function' });
    // The custom grid leads with the upload cell.
    expect(await page.locator('#counterIconGridCustom .icon-cell-upload').count()).toBe(1);
    expect(errors).toEqual([]);
  });

  test('uploading an SVG adds the icon, refreshes the grid, selects it, scrolls it into view, and autofills the name', async ({ page }) => {
    const errors = [];
    await bootWithCreateCounterOpen(page, errors);
    // Show the Custom Icons panel so the T2-05 visible-success assertions run
    // against a rendered (laid-out, scrollable) grid.
    await page.locator('#counterCreatePanel .counter-icon-tab[data-icon-tab="custom"]').click();
    const before = await page.evaluate(() => window.App.getUserCustomIcons().length);
    // Create Counter prefills the name from the next unused built-in icon; the
    // upload autofill only applies to an EMPTY field. Clear it to pin that.
    await page.locator('#counterName').fill('');

    await page.locator('#customIconUploadInput').setInputFiles({
      name: 'floor-drain-special.svg', mimeType: 'image/svg+xml', buffer: GOOD_SVG,
    });
    await page.waitForFunction(
      (n) => window.App.getUserCustomIcons().length === n + 1,
      before, { timeout: 5000 },
    );

    const after = await page.evaluate(() => {
      const icons = window.App.getUserCustomIcons();
      const added = icons[icons.length - 1];
      const sel = document.querySelector('#counterIconGridCustom .icon-cell.selected');
      return {
        name: added.name,
        viewBox: added.viewBox,
        // rect + circle both converted by svgShapeToPath:
        hasRectPath: /M4 4 L28 4/.test(added.value),
        hasCirclePath: /a 6 6 0 1 1/.test(added.value),
        selectedIsAdded: sel?.getAttribute('data-path') === added.value,
        nameField: /** @type {HTMLInputElement} */ (document.getElementById('counterName'))?.value,
      };
    });
    expect(after.name).toBe('floor-drain-special');
    expect(after.viewBox).toBe('0 0 32 32');
    expect(after.hasRectPath).toBe(true);
    expect(after.hasCirclePath).toBe(true);
    expect(after.selectedIsAdded).toBe(true);
    expect(after.nameField).toBe('floor-drain-special');

    // T2-05 #19 — visible success: the new cell must sit inside the grid's
    // visible scroll window (pre-fix it appended ~308px down a 200px-tall
    // grid at scrollTop 0, pixel-identical to a no-op) and carry the
    // flash-new pulse class.
    const vis = await page.evaluate(() => {
      const grid = document.getElementById('counterIconGridCustom');
      const cell = grid.querySelector('.icon-cell.selected');
      const g = grid.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      return {
        scrolled: grid.scrollTop > 0,
        inWindow: c.top >= g.top - 1 && c.bottom <= g.bottom + 1,
        flash: cell.classList.contains('flash-new'),
      };
    });
    expect(vis.scrolled).toBe(true);
    expect(vis.inWindow).toBe(true);
    expect(vis.flash).toBe(true);

    expect(errors).toEqual([]);
  });

  test('an SVG with no supported shapes is rejected with the alert and adds nothing', async ({ page }) => {
    const errors = [];
    await bootWithCreateCounterOpen(page, errors);
    const before = await page.evaluate(() => window.App.getUserCustomIcons().length);

    let alertText = '';
    page.once('dialog', (d) => { alertText = d.message(); return d.accept(); });
    await page.locator('#customIconUploadInput').setInputFiles({
      name: 'empty.svg', mimeType: 'image/svg+xml', buffer: EMPTY_SVG,
    });
    await expect.poll(() => alertText).toContain('SVG must contain at least one');
    expect(await page.evaluate(() => window.App.getUserCustomIcons().length)).toBe(before);
    expect(errors).toEqual([]);
  });
});

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

  test('uploading an SVG adds the icon, refreshes the grid, selects it, and autofills the name', async ({ page }) => {
    const errors = [];
    await bootWithCreateCounterOpen(page, errors);
    const before = await page.evaluate(() => window.App.getUserCustomIcons().length);
    // Create Counter prefills the name from the first built-in icon; the
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
    expect(errors).toEqual([]);
  });

  test('uploaded icon is scrolled into the grid viewport without jolting the modal (Tier-2 #19)', async ({ page }) => {
    const errors = [];
    await bootWithCreateCounterOpen(page, errors);
    // Drive the REAL tab flow: the custom panel is display:none until the
    // Custom Icons tab is clicked; a hidden grid has zero height and would
    // make any visibility assertion vacuous.
    await page.click('#counterCreatePanel .counter-icon-tab[data-icon-tab="custom"]');
    const pre = await page.evaluate(() => {
      const g = document.getElementById('counterIconGridCustom');
      const card = document.querySelector('#counterModal .modal-card');
      return {
        gridVisible: g.getBoundingClientRect().height > 0,
        overflows: g.scrollHeight > g.clientHeight,
        cardScrollTop: card ? card.scrollTop : 0,
        pageScrollTop: document.scrollingElement.scrollTop,
      };
    });
    expect(pre.gridVisible).toBe(true);
    // The bundled custom icons alone overflow the 200px grid, so the appended
    // upload lands below the fold unless the grid is scrolled.
    expect(pre.overflows).toBe(true);

    await page.locator('#customIconUploadInput').setInputFiles({
      name: 'below-the-fold.svg', mimeType: 'image/svg+xml', buffer: GOOD_SVG,
    });
    await page.waitForSelector('#counterIconGridCustom .icon-cell.selected');

    const post = await page.evaluate(() => {
      const g = document.getElementById('counterIconGridCustom');
      const sel = g.querySelector('.icon-cell.selected');
      const gr = g.getBoundingClientRect();
      const cr = sel.getBoundingClientRect();
      const card = document.querySelector('#counterModal .modal-card');
      return {
        // Geometry, not a hardcoded offset: the cell's rect must sit inside
        // the grid's visible rect regardless of how many icons exist.
        cellTopInView: cr.top >= gr.top - 1,
        cellBottomInView: cr.bottom <= gr.bottom + 1,
        gridScrolled: g.scrollTop > 0,
        cardScrollTop: card ? card.scrollTop : 0,
        pageScrollTop: document.scrollingElement.scrollTop,
      };
    });
    expect(post.cellTopInView).toBe(true);
    expect(post.cellBottomInView).toBe(true);
    expect(post.gridScrolled).toBe(true);
    // Only the grid scrolled — no jolt of the modal card or the page.
    expect(post.cardScrollTop).toBe(pre.cardScrollTop);
    expect(post.pageScrollTop).toBe(pre.pageScrollTop);
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

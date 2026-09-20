// @ts-check
/**
 * Tests: the Modal Gallery (features/modal-gallery.js), the developer view at
 * /app/?gallery=1 that lays every modal out on one page in the app's own CSS.
 * Injected by app.js's boot only on the query param (never a shell script
 * tag), so a plain /app/ boot must not carry it. Doubles as the one place that
 * asserts every .modal-overlay in the shell renders with a real height: a
 * modal whose markup broke would show up here as a zero-height tile.
 */
const { test, expect } = require('@playwright/test');

async function bootGallery(page, errors, extra = '') {
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/?gallery=1' + extra);
  await page.waitForSelector('#modalGallery .mg-tile', { timeout: 15000 });
  await page.waitForFunction(() => window.App && window.state && window.App.modalGalleryPopulate);
}

test.describe('Modal Gallery', () => {
  test('a plain /app/ boot never loads the gallery', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForFunction(() => window.App && window.state);
    expect(await page.evaluate(() => Array.from(document.scripts).some((s) => (s.src || '').includes('modal-gallery')))).toBe(false);
    expect(await page.locator('#modalGallery').count()).toBe(0);
    expect(await page.evaluate(() => document.body.classList.contains('modal-gallery'))).toBe(false);
  });

  test('every modal, toast and popover renders as a tile with a real height and no errors', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await bootGallery(page, errors);
    const counts = await page.evaluate(() => ({
      overlaysInShell: document.querySelectorAll('.modal-overlay').length,
      modalTiles: document.querySelectorAll('.mg-tile-body > .modal-overlay').length,
      toastTiles: document.querySelectorAll('.mg-tile-body > .toast-card').length,
      popoverTiles: document.querySelectorAll('.mg-tile-body > .mg-popover').length,
      zeroHeight: Array.from(document.querySelectorAll('.mg-tile-body > .modal-overlay > .modal-card')).filter((c) => c.getBoundingClientRect().height === 0).map((c) => c.parentElement.id),
      anyVisible: document.querySelectorAll('.modal-overlay.visible').length,
      appChromeHidden: getComputedStyle(document.getElementById('sidebar') || document.body).display === 'none',
      cssBusted: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((l) => /styles\.css\?mg=/.test(l.getAttribute('href') || '')),
      headline: document.querySelector('#modalGalleryBar .mg-count')?.textContent,
    }));
    expect(counts.modalTiles).toBe(counts.overlaysInShell);
    expect(counts.modalTiles).toBeGreaterThanOrEqual(70);
    expect(counts.toastTiles).toBeGreaterThanOrEqual(5);
    expect(counts.popoverTiles).toBeGreaterThanOrEqual(10);
    expect(counts.zeroHeight).toEqual([]);
    expect(counts.anyVisible).toBe(0);
    expect(counts.cssBusted).toBe(true);
    expect(counts.headline).toContain(counts.modalTiles + ' modals');
    // The owner annotation resolves from the shell + the loaded feature files.
    await expect(page.locator('.mg-tile[data-id="zoomModal"] .mg-where')).toContainText('features/zoom.js');
    await expect(page.locator('.mg-tile[data-id="zoomModal"] .mg-where')).toContainText('app/index.html:');
    expect(errors).toEqual([]);
  });

  test('Populate runs the real opener in place and grid mode keeps .visible off', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await bootGallery(page, errors);
    const before = await page.locator('#keyboardMapModal .modal-card').boundingBox();
    await page.locator('.mg-tile[data-id="keyboardMapModal"] .mg-btns button', { hasText: 'Populate' }).click();
    await page.waitForTimeout(200);
    const after = await page.locator('#keyboardMapModal .modal-card').boundingBox();
    expect(after.height).toBeGreaterThan(before.height + 50);
    expect(await page.evaluate(() => document.getElementById('keyboardMapModal').classList.contains('visible'))).toBe(false);
    // A modal with variants offers one button per variant; the confirm dialog fills with the variant's copy.
    await page.locator('.mg-tile[data-id="confirmModal"] .mg-btns button', { hasText: 'Prompt' }).click();
    await expect(page.locator('#confirmTitle')).toHaveText('Name this layer');
    expect(await page.locator('#confirmInputGroup').isHidden()).toBe(false);
    expect(await page.evaluate(() => document.getElementById('confirmModal').classList.contains('visible'))).toBe(false);
    expect(await page.locator('.mg-tile[data-id="confirmModal"] .mg-err').textContent()).toBe('');
    // An opener that needs a plan says so in the tile head instead of failing silently.
    await page.locator('.mg-tile[data-id="linePropertiesModal"] .mg-btns button', { hasText: 'Populate' }).click();
    await expect(page.locator('.mg-tile[data-id="linePropertiesModal"] .mg-err')).toContainText('Load sample');
    expect(errors).toEqual([]);
  });

  test('Load sample opens the sample plan through the intake and feeds the state-hungry openers', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await bootGallery(page, errors);
    await page.locator('#modalGalleryLoadSample').click();
    await expect(page.locator('#modalGalleryLoadSample')).toHaveText('Sample loaded', { timeout: 20000 });
    expect(await page.evaluate(() => ({ pages: window.state.pages.length, counters: window.state.counters.length }))).toEqual({ pages: 1, counters: 2 });
    for (const id of ['linePropertiesModal', 'summaryCountDetailModal', 'groupAssignModal', 'canvasDetailsModal', 'ductScheduleModal', 'specificPagesModal']) {
      const r = await page.evaluate((i) => window.App.modalGalleryPopulate(i), id);
      expect(r.ran, id).toBe(true);
    }
    await page.waitForTimeout(400);
    await expect(page.locator('#linePropertiesModal')).toContainText('Waste line');
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('.mg-err')).map((e) => e.textContent).filter(Boolean))).toEqual([]);
    expect(await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').length)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Open live puts one overlay back on its fixed backdrop; Esc and Cancel return to the grid', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await bootGallery(page, errors);
    await page.locator('.mg-tile[data-id="pageSettingsModal"] .mg-btns button', { hasText: 'Open live' }).click();
    let live = await page.evaluate(() => {
      const o = document.getElementById('pageSettingsModal');
      return { body: document.body.classList.contains('mg-live'), pos: getComputedStyle(o).position, visible: o.classList.contains('visible'), cardW: o.querySelector('.modal-card').getBoundingClientRect().width, pill: getComputedStyle(document.getElementById('modalGalleryLivePill')).display };
    });
    expect(live.body).toBe(true);
    expect(live.pos).toBe('fixed');
    expect(live.visible).toBe(true);
    expect(live.cardW).toBeLessThanOrEqual(400);   // the real max-width, not the tile's
    expect(live.pill).toBe('flex');
    // The app's own Esc rung closes it; the gallery follows it back to the grid.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(50);
    live = await page.evaluate(() => ({ body: document.body.classList.contains('mg-live'), visible: document.getElementById('pageSettingsModal').classList.contains('visible'), pos: getComputedStyle(document.getElementById('pageSettingsModal')).position }));
    expect(live).toEqual({ body: false, visible: false, pos: 'static' });
    // A modal with no Esc rung (Zoom Settings closes by Done) still returns on Esc, through the gallery's fallback.
    await page.evaluate(() => window.App.modalGalleryOpenLive('zoomModal'));
    expect(await page.evaluate(() => document.body.classList.contains('mg-live'))).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => document.body.classList.contains('mg-live'))).toBe(false);
    // The Back pill exits too.
    await page.evaluate(() => window.App.modalGalleryOpenLive('legendSettingsModal'));
    await page.locator('#modalGalleryLivePill button').click();
    expect(await page.evaluate(() => document.body.classList.contains('mg-live'))).toBe(false);
    expect(errors).toEqual([]);
  });

  test('the filter narrows by id or owner; Mobile embeds the narrow gallery at phone width', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 1400, height: 900 });
    await bootGallery(page, errors);
    await page.locator('#modalGalleryFilter').fill('zoom');
    const shown = await page.evaluate(() => Array.from(document.querySelectorAll('.mg-tile:not(.mg-hidden)')).map((t) => t.dataset.id));
    expect(shown).toContain('zoomModal');
    expect(shown.length).toBeLessThan(10);
    await page.locator('#modalGalleryFilter').fill('features/scale.js');
    await expect(page.locator('.mg-tile[data-id="scaleModal"]')).not.toHaveClass(/mg-hidden/);
    await page.locator('#modalGalleryFilter').fill('');
    await page.locator('#modalGalleryPhoneToggle').click();
    const frame = page.frameLocator('#modalGalleryPhone iframe');
    await frame.locator('.mg-tile').first().waitFor({ timeout: 20000 });
    expect(await page.evaluate(() => document.querySelector('#modalGalleryPhone iframe').getBoundingClientRect().width)).toBe(375);
    expect(await frame.locator('body').evaluate((b) => b.classList.contains('mg-narrow'))).toBe(true);
    expect(await frame.locator('#modalGalleryBar').evaluate((b) => getComputedStyle(b).display)).toBe('none');
    expect(await frame.locator('.mg-tile-body > .modal-overlay').count()).toBeGreaterThanOrEqual(70);
    expect(errors).toEqual([]);
  });

  test('the narrow page stands alone at a phone viewport', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 375, height: 812 });
    await bootGallery(page, errors, '&narrow=1');
    const r = await page.evaluate(() => ({
      narrow: document.body.classList.contains('mg-narrow'),
      cols: getComputedStyle(document.querySelector('.mg-grid')).gridTemplateColumns.split(' ').length,
      overflowX: document.documentElement.scrollWidth <= window.innerWidth + 1,
    }));
    expect(r.narrow).toBe(true);
    expect(r.cols).toBe(1);
    expect(r.overflowX).toBe(true);
    expect(errors).toEqual([]);
  });
});

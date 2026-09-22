// @ts-check
/**
 * Tests: the four papercuts the 2026-09-14 drift patrol left open (B20):
 *   J6 #7  a scale zone's "Edit scale" opens preloaded (preset marked / custom filled), like the page's does since D20
 *   J6 #9  Ctrl/Cmd+Y redoes
 *   X7     Copy Summary sits with its export siblings, above the external-links row
 *   X8     ONE feedback system — no native alert()/confirm()/prompt(): the app's confirm dialog
 *          (App.confirmDialog: confirm, input and info modes; Esc cancels; sits above other modals)
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const PDF = path.join(__dirname, 'test-2pages.pdf');

async function boot(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  // Any native dialog is a failure of the sweep: record it and dismiss.
  page.on('dialog', async (d) => { errors.push('native dialog: ' + d.type() + ' ' + d.message()); await d.dismiss().catch(() => {}); });
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(PDF);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1\'' }; window.App.updateUI(); });
}

test.describe('B20 — the patrol\'s four papercuts', () => {
  /** @type {string[]} */
  let errors;
  test.beforeEach(async ({ page }) => { errors = []; await boot(page, errors); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('X8: confirm mode — OK resolves true, Cancel false, Esc false; it sits above other modals', async ({ page }) => {
    const ask = (opts) => page.evaluate((o) => { window.__ans = undefined; window.App.confirmDialog(o).then((v) => { window.__ans = v; }); }, opts);
    await ask({ title: 'Close project?', body: 'Any unsaved changes will be lost.', confirmLabel: 'Close project', danger: true });
    await expect(page.locator('#confirmModal')).toHaveClass(/visible/);
    await expect(page.locator('#confirmTitle')).toHaveText('Close project?');
    await expect(page.locator('#confirmOk')).toHaveText('Close project');
    await expect(page.locator('#confirmOk')).toHaveClass(/danger/);
    await page.locator('#confirmOk').click();
    expect(await page.evaluate(() => window.__ans)).toBe(true);
    await expect(page.locator('#confirmModal')).not.toHaveClass(/visible/);
    await ask({ body: 'plain' });
    await page.locator('#confirmCancel').click();
    expect(await page.evaluate(() => window.__ans)).toBe(false);
    await ask({ body: 'esc' });
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.__ans)).toBe(false);
    // Above another modal: the settings modal stays; Esc reaches the confirm first.
    await page.evaluate(() => window.App.showModal('settingsModal'));
    await ask({ body: 'over settings' });
    expect(await page.evaluate(() => parseInt(getComputedStyle(document.getElementById('confirmModal')).zIndex, 10) > parseInt(getComputedStyle(document.getElementById('settingsModal')).zIndex || '0', 10))).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => [window.__ans, document.getElementById('settingsModal').classList.contains('visible')])).toEqual([false, true]);
    await page.evaluate(() => window.App.hideModal('settingsModal'));
  });

  test('X8: input mode is the app\'s prompt — Enter submits the trimmed text, Cancel gives null; info mode has no Cancel', async ({ page }) => {
    await page.evaluate(() => { window.__ans = undefined; window.App.confirmDialog({ title: 'New size', input: { placeholder: 'e.g. 1in' }, confirmLabel: 'Add' }).then((v) => { window.__ans = v; }); });
    await expect(page.locator('#confirmInputGroup')).toBeVisible();
    await page.locator('#confirmInput').fill('  3/4in ');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__ans)).toBe('3/4in');
    await page.evaluate(() => { window.__ans = undefined; window.App.confirmDialog({ input: {} }).then((v) => { window.__ans = v; }); });
    await page.locator('#confirmCancel').click();
    expect(await page.evaluate(() => window.__ans)).toBeNull();
    await page.evaluate(() => { window.App.confirmDialog({ title: 'Access log', body: 'a@b.com — today', confirmLabel: 'Close', infoOnly: true }); });
    await expect(page.locator('#confirmCancel')).toBeHidden();
    await expect(page.locator('#confirmInputGroup')).toBeHidden();
    await page.locator('#confirmOk').click();
  });

  test('X8: the former native sites use it — Close project asks through the dialog, a Quick Line size through its input', async ({ page }) => {
    await page.evaluate(() => { window.state.counters = [{ id: 'c', name: 'WC', icon: '', color: '#e8c547' }]; window.App.ensureActiveCanvas(window.state.pages[0]).annotations.counterMarkers.c = [{ x: 1, y: 1, id: 'm' }]; window.App.markProjectDirty(); });
    const closing = page.evaluate(() => window.App.closeProject({ route: 'settings' }));
    await expect(page.locator('#confirmModal')).toHaveClass(/visible/);
    await expect(page.locator('#confirmTitle')).toHaveText('Close project?');
    await page.locator('#confirmCancel').click();
    expect(await closing).toBe(false);
    expect(await page.evaluate(() => window.state.pages.length)).toBe(2);
    // Quick Line "+ size" opens the input dialog, and the value lands in the modifiers.
    await page.evaluate(() => { window.App.showModal('chooseLineTypeModal'); document.querySelector('#chooseLineTypeModal .line-type-tab[data-tab="quick"]')?.click(); });
    await page.locator('#quickLineAddSize').click();
    await expect(page.locator('#confirmInputGroup')).toBeVisible();
    await page.locator('#confirmInput').fill('7/8in');
    await page.locator('#confirmOk').click();
    expect(await page.evaluate(() => window.App.getLineModifiers().sizes.includes('7/8in'))).toBe(true);
    await page.evaluate(() => window.App.hideModal('chooseLineTypeModal'));
    // (Every path in this file runs under the boot's dialog listener, which
    // fails the test on any native dialog — that is the sweep's real assertion.)
  });

  test('J6 #9: Ctrl+Y redoes what Ctrl+Z undid; the Macros table says so', async ({ page }) => {
    await page.evaluate(() => { window.App.pushUndoSnapshot(); window.state.counters.push({ id: 'y', name: 'Y', icon: '', color: '#fff' }); window.App.updateUI(); });
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => window.state.counters.some((c) => c.id === 'y'))).toBe(false);
    await page.keyboard.press('Control+y');
    expect(await page.evaluate(() => window.state.counters.some((c) => c.id === 'y'))).toBe(true);
    expect(await page.evaluate(() => (document.querySelector('#macrosModal') || document.body).textContent.includes('Y'))).toBe(true);
    expect(await page.evaluate(() => window.App.HOTKEYS.some((h) => h.bespoke && /Redo/.test(h.action) && /Y/.test(h.kbd)))).toBe(true);
  });

  test('X7: Copy Summary sits above the external-links row, beside its siblings', async ({ page }) => {
    expect(await page.evaluate(() => {
      const cs = document.getElementById('copySummaryTextDropdown'), links = document.querySelector('.sidebar-tooling-links'), pt = document.getElementById('forPipeTooling');
      const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { csBeforeLinks: before(cs, links), ptBeforeCs: before(pt, cs) };
    })).toEqual({ csBeforeLinks: true, ptBeforeCs: true });
  });

  test('J6 #7: a scale zone\'s Edit scale opens preloaded — preset marked, custom filled, page untouched', async ({ page }) => {
    const openEdit = (idx) => page.evaluate((i) => { window.state.ctxTarget = { type: 'scaleZone', index: i }; document.getElementById('ctxEditScaleZone').click(); }, idx);
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      ann.scaleZones.push({ id: 'z1', x1: 0, y1: 0, x2: 100, y2: 100, scale: { pixelsPerUnit: 18, unit: 'ft', label: '1/4" = 1\'' } });
      ann.scaleZones.push({ id: 'z2', x1: 200, y1: 0, x2: 300, y2: 100, scale: { pixelsPerUnit: 4.5, unit: 'ft', label: '3/32" = 1.5 ft' } });
      ann.scaleZones.push({ id: 'z3', x1: 400, y1: 0, x2: 500, y2: 100, scale: { pixelsPerUnit: 18, unit: 'ft', label: '1/4" = 1\' · ANSI D' } });
      window.App.renderAnnotations();
    });
    await openEdit(0);
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    await expect(page.locator('#scaleModal h2')).toHaveText('Edit zone scale');
    await expect(page.locator('#scalePresetsList button.selected')).toHaveText('1/4" = 1\'');
    await page.locator('#scalePresetsCancel').click();
    await openEdit(1);
    await expect(page.locator('#scaleCustomFraction')).toHaveValue('3/32');
    await expect(page.locator('#scaleCustomFeet')).toHaveValue('1.5');
    await expect(page.locator('#scalePresetsList button.selected')).toHaveCount(0);
    await page.locator('#scalePresetsCancel').click();
    // A corrected preset's label carries a sheet suffix — matched on its stem.
    await openEdit(2);
    await expect(page.locator('#scalePresetsList button.selected')).toHaveText('1/4" = 1\'');
    await page.locator('#scalePresetsCancel').click();
    // The page's own dialog still reads the PAGE scale, not a zone's.
    await page.locator('#setScale').click();
    await expect(page.locator('#scalePresetsList button.selected')).toHaveText('1/4" = 1\'');
    await page.locator('#scalePresetsCancel').click();
  });
});

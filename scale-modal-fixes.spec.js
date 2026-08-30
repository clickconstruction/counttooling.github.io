// @ts-check
/**
 * Scale modal small fixes (JOURNEY-MAP Tier-3 B8):
 *  - the custom-scale feet field ships a REAL default value "1" (not a
 *    placeholder) and openScaleModal re-seeds it when left empty, so Apply
 *    works after typing just the fraction (J3);
 *  - ONE no-plan gate for every scale entrance lives inside openScaleModal
 *    ("Open a plan first." — the copy the tool-context-menu guard used to
 *    carry), so no entrance can reach a preset and fake a "Scale set" success
 *    toast at 0 pages (J3);
 *  - zone tools stay armed after Apply with a visible armed-hint toast (J6;
 *    gated on T2-10's rect-drag gesture, shipped 2026-08-30) — and the T2-10
 *    drag completion still works on the re-armed tool, while context-menu
 *    zone EDITS still exit to Move and the T1-04 verify hand-off is untouched.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function bootWithPdf(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

async function bootEmpty(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
}

// Client (viewport) coords for a point at (fx, fy) fraction of the rendered page.
function pagePt(page, fx, fy) {
  return page.evaluate(({ fx, fy }) => {
    const s = window.state; const p = s.pages[s.currentPage];
    const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
    const r = document.getElementById('canvasWrapper').getBoundingClientRect();
    return { x: Math.round(r.left + (vp.width * fx) * s.zoom + s.pan.x), y: Math.round(r.top + (vp.height * fy) * s.zoom + s.pan.y) };
  }, { fx, fy });
}

// Real press-drag-release (the T2-10 gesture): trusted mousedown / mousemoves /
// mouseup, with the browser firing the trailing native click itself.
async function drag(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

function captureErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('Scale modal small fixes (Tier-3 B8)', () => {
  test('feet field: real default "1" on fresh open, re-seeded after clearing, typed value kept; fraction-only Apply works', async ({ page }) => {
    const errors = captureErrors(page);
    await bootWithPdf(page);

    // Fresh open: the markup default is a real value, not a placeholder.
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    expect(await page.locator('#scaleCustomFeet').inputValue()).toBe('1');

    // Clear it, close, reopen: openScaleModal re-seeds the default.
    await page.locator('#scaleCustomFeet').fill('');
    await page.locator('#scalePresetsCancel').click();
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    expect(await page.locator('#scaleCustomFeet').inputValue()).toBe('1');

    // A typed value survives a reopen (the re-seed only fills an EMPTY field).
    await page.locator('#scaleCustomFeet').fill('4');
    await page.locator('#scalePresetsCancel').click();
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    expect(await page.locator('#scaleCustomFeet').inputValue()).toBe('4');

    // The point of the default: typing ONLY the fraction applies 1/4" = 1 ft.
    await page.locator('#scaleCustomFeet').fill('1');
    await page.locator('#scaleCustomFraction').fill('1/4');
    await page.locator('#scaleCustomApply').click();
    await page.waitForFunction(() => !!window.state.pages[window.state.currentPage].scale, { timeout: 5000 });
    const sc = await page.evaluate(() => window.state.pages[window.state.currentPage].scale);
    expect(sc.pixelsPerUnit).toBeCloseTo((0.25 * 72) / 1, 9);
    expect(sc.unit).toBe('ft');
    expect(errors).toEqual([]);
  });

  test('no-plan gate: every entrance refuses at 0 pages with the shared copy and NO fake "Scale set" success', async ({ page }) => {
    const errors = captureErrors(page);
    await bootEmpty(page);

    const gateAssert = async () => {
      await page.waitForSelector('#airboardToastModal.visible', { timeout: 5000 });
      expect(await page.evaluate(() => document.getElementById('airboardToastText').textContent)).toBe('Open a plan first.');
      expect(await page.evaluate(() => document.getElementById('scaleModal').classList.contains('visible'))).toBe(false);
      // Reset the toast so the next entrance's assertion is its own.
      await page.evaluate(() => { window.App.hideModal('airboardToastModal'); document.getElementById('airboardToastText').textContent = ''; });
    };

    // Header button.
    await page.evaluate(() => document.getElementById('setScale').click());
    await gateAssert();
    // Sidebar button.
    await page.evaluate(() => document.getElementById('setScaleSidebar').click());
    await gateAssert();
    // S hotkey (routes through #setScale via the HOTKEYS table).
    await page.keyboard.press('s');
    await gateAssert();
    // Registry entrance (the tool context menu's "Set / edit scale…" and the
    // arm-time gate link both call this bare — the gate is INSIDE the mouth).
    await page.evaluate(() => window.App.openScaleModal());
    await gateAssert();

    // No page scale was ever faked into existence.
    expect(await page.evaluate(() => window.state.pages.length)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Scale Zone stays armed after Apply with the armed hint; T2-10 drag completes the next zone; edit path still exits to Move', async ({ page }) => {
    const errors = captureErrors(page);
    await bootWithPdf(page);
    // Page scale first (arm-time gate), set directly to stay correction-free.
    await page.evaluate(() => {
      window.state.pages[window.state.currentPage].scale = { pixelsPerUnit: 10, unit: 'ft' };
      window.App.updateUI();
    });
    await page.evaluate(() => document.getElementById('scaleZoneBtn').click());
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.SCALE_ZONE)).toBe(true);

    // Zone 1 by drag (T2-10) -> "Scale for zone" dialog -> preset Apply.
    await drag(page, await pagePt(page, 0.1, 0.1), await pagePt(page, 0.3, 0.3));
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => window.state.scaleModalApplyTarget)).toBe('zone');
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(() => {
      const p = window.state.pages[window.state.currentPage];
      return (window.App.ensureActiveCanvas(p).annotations.scaleZones || []).length === 1;
    }, undefined, { timeout: 5000 });

    // Stays armed, with the visible armed hint.
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.SCALE_ZONE)).toBe(true);
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    const hint = await page.evaluate(() => document.getElementById('airboardToastText').textContent);
    expect(hint).toContain('Scale Zone stays armed');
    expect(hint).toContain('Esc');

    // Regression: the re-armed tool still takes the T2-10 drag for zone 2
    // (non-overlapping), while the hint toast is still up (non-blocking cards).
    await drag(page, await pagePt(page, 0.5, 0.5), await pagePt(page, 0.7, 0.7));
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => !!window.state.pendingScaleZone)).toBe(true);
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(() => {
      const p = window.state.pages[window.state.currentPage];
      return (window.App.ensureActiveCanvas(p).annotations.scaleZones || []).length === 2;
    }, undefined, { timeout: 5000 });
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.SCALE_ZONE)).toBe(true);

    // Esc from the armed idle tool exits to Move (the hint's promise).
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.NONE, undefined, { timeout: 5000 });

    // Context-menu EDIT of a zone's scale still exits to Move, no armed hint.
    await page.evaluate(() => { document.getElementById('airboardToastText').textContent = ''; window.App.hideModal('airboardToastModal'); });
    await page.evaluate(() => {
      const s = window.state;
      s.scaleModalApplyTarget = 'zone';
      s.pendingScaleZone = null;
      s.pendingScaleZoneEdit = { zoneIndex: 0 };
      window.App.openScaleModal();
    });
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(() => !document.getElementById('scaleModal').classList.contains('visible'), undefined, { timeout: 5000 });
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.NONE)).toBe(true);
    expect(await page.evaluate(() => document.getElementById('airboardToastText').textContent)).not.toContain('stays armed');
    expect(errors).toEqual([]);
  });

  test('Multiply Zone stays armed after Apply with the armed hint; T2-10 drag completes the next zone', async ({ page }) => {
    const errors = captureErrors(page);
    await bootWithPdf(page);
    await page.evaluate(() => document.getElementById('multiplyZoneBtn').click());
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.MULTIPLY_ZONE)).toBe(true);

    // Zone 1 by drag (T2-10) -> multiplier dialog -> Apply.
    await drag(page, await pagePt(page, 0.1, 0.1), await pagePt(page, 0.3, 0.3));
    await page.waitForSelector('#multiplyZoneModal.visible', { timeout: 5000 });
    await page.locator('#multiplyZoneApply').click();
    await page.waitForFunction(() => {
      const p = window.state.pages[window.state.currentPage];
      return (window.App.ensureActiveCanvas(p).annotations.multiplyZones || []).length === 1;
    }, undefined, { timeout: 5000 });

    // Stays armed, with the visible armed hint.
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.MULTIPLY_ZONE)).toBe(true);
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    const hint = await page.evaluate(() => document.getElementById('airboardToastText').textContent);
    expect(hint).toContain('Multiply Zone stays armed');
    expect(hint).toContain('Esc');

    // Regression: the re-armed tool still takes the T2-10 drag for zone 2.
    await drag(page, await pagePt(page, 0.5, 0.5), await pagePt(page, 0.7, 0.7));
    await page.waitForSelector('#multiplyZoneModal.visible', { timeout: 5000 });
    await expect(page.locator('#multiplyZonePreview')).toContainText('In this area:');
    await page.locator('#multiplyZoneApply').click();
    await page.waitForFunction(() => {
      const p = window.state.pages[window.state.currentPage];
      return (window.App.ensureActiveCanvas(p).annotations.multiplyZones || []).length === 2;
    }, undefined, { timeout: 5000 });
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.MULTIPLY_ZONE)).toBe(true);

    // Esc exits to Move (the hint's promise).
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.NONE, undefined, { timeout: 5000 });
    expect(errors).toEqual([]);
  });
});

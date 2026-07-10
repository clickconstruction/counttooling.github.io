// @ts-check
/**
 * Tests: viewer scale status + temporary viewer-set scale.
 *
 * View-link viewers keep the Set Scale buttons (status display) and may run the
 * full Set Scale flow to set a TEMPORARY local-only scale (stamped
 * scale.temp = true, remembered per token in localStorage view:scale:<token>)
 * so the Measure tool reads real units. The owner's scale always wins on
 * restore, and nothing a viewer sets can reach the cloud (markProjectDirty /
 * performAutoSave are viewer-inert).
 *
 * View mode is simulated by poking state (initViewOnlyMode needs a real
 * get-view-project token): isViewer + loadedViaViewLink + viewToken, then
 * updateUI() - mirroring how scale.spec.js drives App.state directly.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const TOKEN = 'spec-token';

async function bootAsViewer(page, errors) {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate((token) => {
    localStorage.removeItem('view:scale:' + token);
    const s = window.App.state;
    s.isViewer = true;
    s.loadedViaViewLink = true;
    s.viewToken = token;
    window.App.updateUI();
  }, TOKEN);
}

test.describe('Viewer temp scale (view-link scale status + local-only Set Scale)', () => {
  test('registry wired; Set Scale stays visible for viewers while editing tools hide', async ({ page }) => {
    const errors = [];
    await bootAsViewer(page, errors);

    const wired = await page.evaluate(() => ({
      note: typeof window.App?.noteViewerTempScale,
      apply: typeof window.App?.applyViewerTempScales,
    }));
    expect(wired).toEqual({ note: 'function', apply: 'function' });

    const vis = await page.evaluate(() => {
      const disp = (id) => document.getElementById(id)?.style.display;
      return {
        setScale: disp('setScale'),
        setScaleSidebar: disp('setScaleSidebar'),
        counterBtn: disp('counterBtn'),
        quickLine: disp('quickLine'),
        measureBtn: disp('measureBtn'),
      };
    });
    expect(vis.setScale).not.toBe('none');
    expect(vis.setScaleSidebar).not.toBe('none');
    expect(vis.counterBtn).toBe('none');
    expect(vis.quickLine).toBe('none');
    expect(vis.measureBtn).not.toBe('none');

    expect(errors).toEqual([]);
  });

  test('preset apply as viewer: temp-stamped scale, per-token localStorage, "temp" in the status', async ({ page }) => {
    const errors = [];
    await bootAsViewer(page, errors);

    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(
      () => !document.getElementById('scaleModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    const after = await page.evaluate((token) => {
      const s = window.state.pages[window.state.currentPage].scale;
      const stored = JSON.parse(localStorage.getItem('view:scale:' + token) || '{}');
      return {
        hasScale: !!s,
        temp: s?.temp,
        storedPageIdxs: Object.keys(stored),
        storedPpu: stored[window.state.currentPage]?.pixelsPerUnit,
        sidebarText: document.getElementById('setScaleSidebar')?.textContent || '',
        displayText: document.getElementById('sidebarScaleDisplay')?.textContent || '',
      };
    }, TOKEN);
    expect(after.hasScale).toBe(true);
    expect(after.temp).toBe(true);
    expect(after.storedPageIdxs).toContain(String(0));
    expect(typeof after.storedPpu).toBe('number');
    expect(after.sidebarText).toContain('temp');
    expect(after.displayText).toContain('temp');

    // The viewer-inert save machinery must not have gone dirty.
    expect(await page.evaluate(() => window.state.isViewer)).toBe(true);

    expect(errors).toEqual([]);
  });

  test('viewer tool whitelist: TOOL.SCALE survives updateUI; owner tools still reset', async ({ page }) => {
    const errors = [];
    await bootAsViewer(page, errors);

    const scaleSurvives = await page.evaluate(() => {
      const s = window.App.state;
      s.tool = window.App.TOOL.SCALE;
      window.App.updateUI();
      return s.tool === window.App.TOOL.SCALE;
    });
    expect(scaleSurvives).toBe(true);

    const counterReset = await page.evaluate(() => {
      const s = window.App.state;
      s.tool = window.App.TOOL.COUNTER;
      window.App.updateUI();
      return s.tool === window.App.TOOL.NONE;
    });
    expect(counterReset).toBe(true);

    expect(errors).toEqual([]);
  });

  test('applyViewerTempScales restores only where the owner set no scale (owner wins)', async ({ page }) => {
    const errors = [];
    await bootAsViewer(page, errors);

    const result = await page.evaluate((token) => {
      const s = window.App.state;
      s.pages[0].scale = null;                                          // no owner scale
      s.pages[1].scale = { pixelsPerUnit: 9.9, unit: 'ft', label: 'owner' }; // owner scale
      localStorage.setItem('view:scale:' + token, JSON.stringify({
        0: { pixelsPerUnit: 3.5, unit: 'ft', label: null, temp: true },
        1: { pixelsPerUnit: 1.1, unit: 'ft', label: null, temp: true },
      }));
      window.App.applyViewerTempScales();
      return {
        p0: s.pages[0].scale ? { ppu: s.pages[0].scale.pixelsPerUnit, temp: s.pages[0].scale.temp } : null,
        p1: s.pages[1].scale ? { ppu: s.pages[1].scale.pixelsPerUnit, label: s.pages[1].scale.label } : null,
      };
    }, TOKEN);
    expect(result.p0).toEqual({ ppu: 3.5, temp: true });
    expect(result.p1).toEqual({ ppu: 9.9, label: 'owner' });   // untouched

    expect(errors).toEqual([]);
  });

  test('S hotkey opens the Scale modal for viewers', async ({ page }) => {
    const errors = [];
    await bootAsViewer(page, errors);

    await page.locator('body').press('s');
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => window.state.isViewer)).toBe(true);

    expect(errors).toEqual([]);
  });
});

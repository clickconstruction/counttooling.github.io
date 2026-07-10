// @ts-check
/**
 * Tests: viewer scale status + viewer-set scale shared for everyone.
 *
 * View-link viewers keep the Set Scale buttons (status display) and may run the
 * full Set Scale flow. A viewer-applied scale is shared for everyone through
 * the set-view-scale Edge Function; when that share fails (offline / bad token)
 * it stays as a local TEMPORARY scale (scale.temp = true, remembered per token
 * in localStorage view:scale:<token>). The server stamps shared scales with
 * viewerSet {email, at}; the project owner then gets a must-clear notice modal
 * whenever they land on that page, until acknowledged.
 *
 * View mode is simulated by poking state (initViewOnlyMode needs a real
 * get-view-project token); the share success path stubs window.fetch.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const TOKEN = 'spec-token';

async function bootWithPdf(page, errors) {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

async function bootAsViewer(page, errors) {
  await bootWithPdf(page, errors);
  await page.evaluate((token) => {
    localStorage.removeItem('view:scale:' + token);
    localStorage.setItem('view:allowed:' + token, 'spec@clickplumbing.com');
    const s = window.App.state;
    s.isViewer = true;
    s.loadedViaViewLink = true;
    s.viewToken = token;
    window.App.updateUI();
  }, TOKEN);
}

async function bootAsOwnerWithViewerSetScale(page, errors) {
  await bootWithPdf(page, errors);
  await page.evaluate(() => {
    const s = window.App.state;
    s.isViewer = false;
    s.currentProjectId = 'proj-1';
    s.projectOwnerId = 'user-1';
    s.supabaseSession = { user: { id: 'user-1', email: 'owner@clickplumbing.com' } };
    s.pages[0].scale = { pixelsPerUnit: 3.5, unit: 'ft', label: null, viewerSet: { email: 'crew@clickplumbing.com', at: '2026-07-10T00:00:00Z' } };
    window.App.updateUI();
  });
}

test.describe('Viewer scale (shared-for-everyone + temp fallback + owner notice)', () => {
  test('registry wired; Set Scale stays visible for viewers while editing tools hide', async ({ page }) => {
    const errors = [];
    await bootAsViewer(page, errors);

    const wired = await page.evaluate(() => ({
      share: typeof window.App?.shareViewerScale,
      note: typeof window.App?.noteViewerTempScale,
      apply: typeof window.App?.applyViewerTempScales,
    }));
    expect(wired).toEqual({ share: 'function', note: 'function', apply: 'function' });

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

  test('share failure (bad token): scale stays as local temp with per-token localStorage + "temp" label', async ({ page }) => {
    const errors = [];
    await bootAsViewer(page, errors);
    // TOKEN is not a real view link, so the set-view-scale POST is rejected ->
    // the applied scale stays on the temp fallback path.

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
        sidebarText: document.getElementById('setScaleSidebar')?.textContent || '',
      };
    }, TOKEN);
    expect(after.hasScale).toBe(true);
    expect(after.temp).toBe(true);
    expect(after.storedPageIdxs).toContain(String(0));
    expect(after.sidebarText).toContain('temp');

    expect(errors).toEqual([]);
  });

  test('share success (stubbed): temp flag cleared and localStorage entry removed', async ({ page }) => {
    const errors = [];
    await bootAsViewer(page, errors);

    await page.evaluate(() => {
      const origFetch = window.fetch.bind(window);
      window.fetch = (url, opts) => {
        if (String(url).includes('/functions/v1/set-view-scale')) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return origFetch(url, opts);
      };
    });

    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    await page.locator('#scalePresetsList button').first().click();

    // The share resolves async: wait until the temp flag clears.
    await page.waitForFunction(
      () => window.state.pages[0].scale && !window.state.pages[0].scale.temp,
      { timeout: 5000 },
    );
    const after = await page.evaluate((token) => ({
      stored: JSON.parse(localStorage.getItem('view:scale:' + token) || '{}'),
      sidebarText: document.getElementById('setScaleSidebar')?.textContent || '',
    }), TOKEN);
    expect(Object.keys(after.stored)).not.toContain(String(0));
    expect(after.sidebarText).not.toContain('temp');

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

  test('applyViewerTempScales restores only where the server set no scale (server wins)', async ({ page }) => {
    const errors = [];
    await bootAsViewer(page, errors);

    const result = await page.evaluate((token) => {
      const s = window.App.state;
      s.pages[0].scale = null;                                          // no server scale
      s.pages[1].scale = { pixelsPerUnit: 9.9, unit: 'ft', label: 'owner' }; // server scale
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

    expect(errors).toEqual([]);
  });

  test('owner notice: must-clear modal on a viewer-set scale page; ack removes the stamp', async ({ page }) => {
    const errors = [];
    await bootAsOwnerWithViewerSetScale(page, errors);

    await page.waitForSelector('#viewerScaleNoticeModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('viewerScaleNoticeText').textContent)).toContain('crew@clickplumbing.com');

    // Acknowledge: stamp removed, modal closed, no re-show on revisiting the page.
    await page.locator('#viewerScaleNoticeOk').click();
    await page.waitForFunction(() => !document.getElementById('viewerScaleNoticeModal')?.classList.contains('visible'), { timeout: 5000 });
    const after = await page.evaluate(() => {
      const s = window.App.state;
      const stampGone = !s.pages[0].scale.viewerSet;
      s.currentPage = 1; window.App.updateUI();
      s.currentPage = 0; window.App.updateUI();
      return { stampGone, reShown: document.getElementById('viewerScaleNoticeModal').classList.contains('visible') };
    });
    expect(after.stampGone).toBe(true);
    expect(after.reShown).toBe(false);

    expect(errors).toEqual([]);
  });

  test('owner notice re-appears on returning to the page while unacknowledged', async ({ page }) => {
    const errors = [];
    await bootAsOwnerWithViewerSetScale(page, errors);
    await page.waitForSelector('#viewerScaleNoticeModal.visible', { timeout: 5000 });

    // Close it WITHOUT acknowledging (hide directly), leave the page, come back:
    // the must-clear notice pops again.
    await page.evaluate(() => {
      window.App.hideModal('viewerScaleNoticeModal');
      const s = window.App.state;
      s.currentPage = 1; window.App.updateUI();
      s.currentPage = 0; window.App.updateUI();
    });
    await page.waitForSelector('#viewerScaleNoticeModal.visible', { timeout: 5000 });

    expect(errors).toEqual([]);
  });
});

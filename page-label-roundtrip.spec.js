// @ts-check
/**
 * Regression for the "sheet rename lost on load" persistence bug.
 *
 * Every save path serializes each page's `label` (the custom sheet name from the
 * pages-sidebar rename / Prepare PDF), but applyPageAnnotationsFromData dropped
 * it on restore — so a rename survived in the saved payload yet vanished on
 * every load (cloud load, restore-last-session, view links, copy/fork).
 *
 * Flow mirrors the repro: rename via the real UI, snapshot the exact per-page
 * shape the cloud/auto-save serializes, reload the app, reconstruct through the
 * shared cloud-load path (App.buildPagesFromPdfArrayBufferAndProjectData) and
 * assert the rename is back — in state AND in the rendered pages sidebar.
 * Also covers the companion fix: a payload with no labels falls back to the
 * plan name, never the old hardcoded "document.pdf".
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Page label save/load round trip', () => {
  test('rename → save shape → reload → load restores the sheet name; label-less payloads get plan-name defaults', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });

    // Rename page 1 through the real UI (badge-click rename, like the repro).
    const rows = page.locator('#pagesList .sidebar-item');
    const renameInput = page.locator('#pagesList .rename-input');
    await rows.nth(0).locator('.page-num-badge-editable').click();
    await expect(renameInput).toHaveCount(1);
    await renameInput.fill('P-101 Underground');
    await page.keyboard.press('Enter');
    await expect(renameInput).toHaveCount(0);
    await page.waitForFunction(() => window.state.pages[0].label === 'P-101 Underground');

    // Snapshot the exact per-page shape every save path serializes
    // (index/label/canvases/scale/rotation/bakeFrame).
    const snapshot = await page.evaluate(() => {
      const s = window.state;
      return {
        counters: JSON.parse(JSON.stringify(s.counters)),
        pages: s.pages.map((p, i) => {
          const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
          return { index: i, label: p.label, canvases: JSON.parse(JSON.stringify(p.canvases)), scale: p.scale, rotation: p.rotation ?? 0, bakeFrame: { w: Math.round(vp.width), h: Math.round(vp.height), intrinsic: p.pdfPage.rotate ?? 0 } };
        })
      };
    });
    expect(snapshot.pages.map(p => p.label)).toEqual(['P-101 Underground', 'test-2pages.pdf — p2']);

    // Reload the app (fresh state), then load through the shared cloud-load
    // path with the saved payload — the rename must come back.
    await page.reload();
    await page.waitForLoadState('networkidle');
    const restored = await page.evaluate(async (dd) => {
      const App = window.App, s = window.state;
      const buf = await (await fetch('/test-2pages.pdf')).arrayBuffer();
      await App.buildPagesFromPdfArrayBufferAndProjectData(buf, { counters: dd.counters, lineTypes: [], pages: dd.pages }, false, null, 'Riverside Plans');
      App.updateUI();
      return {
        labels: s.pages.map(p => p.label),
        sidebarNames: Array.from(document.querySelectorAll('#pagesList .sidebar-item .name')).map(el => el.textContent)
      };
    }, snapshot);
    expect(restored.labels).toEqual(['P-101 Underground', 'test-2pages.pdf — p2']);
    // The pages sidebar renders the restored name, not a rebuilt default.
    expect(restored.sidebarNames[0]).toBe('P-101 Underground');

    // A payload whose pages carry NO labels (legacy shape) falls back to the
    // plan name passed by the load/copy callers — never "document.pdf".
    const fallback = await page.evaluate(async (dd) => {
      const App = window.App, s = window.state;
      const stripped = dd.pages.map(p => { const c = JSON.parse(JSON.stringify(p)); delete c.label; return c; });
      const buf = await (await fetch('/test-2pages.pdf')).arrayBuffer();
      await App.buildPagesFromPdfArrayBufferAndProjectData(buf, { counters: dd.counters, lineTypes: [], pages: stripped }, false, null, 'Riverside Plans');
      return s.pages.map(p => p.label);
    }, snapshot);
    expect(fallback).toEqual(['Riverside Plans — p1', 'Riverside Plans — p2']);
    expect(fallback.join(' ')).not.toContain('document.pdf');

    expect(errors).toEqual([]);
  });
});

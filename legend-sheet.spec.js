// @ts-check
/**
 * Tests: the sheet legend (2026-09-19). An electrical or HVAC project draws the
 * on-plan legend as a ruled block (compact by default: title with the sheet,
 * symbol column, caps descriptions, the mount or neck · CFM column, counts on
 * the right); plumbing keeps the tally. The Summary Legend dialog's style
 * segment reads the resolved style and writes an explicit one; the PDF export
 * path draws the same block in ink; the block follows the sheet size.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page, errors, trade) {
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForFunction(() => window.App && window.state);
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0; }, { timeout: 10000 });
  await page.evaluate((t) => {
    document.querySelectorAll('.modal-overlay.visible').forEach((m) => m.classList.remove('visible'));
    const s = window.state, App = window.App, uid = () => App.uid();
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    App.setProjectTrade(t, { remember: false, route: 'tour' });
    const ann = s.pages[0].canvases[0].annotations;
    const ci = (n) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === n) || {}).value || App.getOrderedIcons()[0].value;
    const a = { id: uid(), name: 'Duplex Receptacle', icon: ci('Duplex Receptacle'), color: '#e85447', mountHeightIn: 18 };
    const b = { id: uid(), name: '12x12 Supply Diffuser', icon: ci('Supply Diffuser'), color: '#e8c547', cfm: 150 };
    s.counters = [a, b];
    ann.counterMarkers = { [a.id]: [{ x: 100, y: 100, id: uid(), group: null }, { x: 160, y: 100, id: uid(), group: null }], [b.id]: [{ x: 100, y: 200, id: uid(), group: null }] };
    s.groups = [{ id: uid(), name: 'Circuit 7', color: '#c8963a', panel: 'LP-1', circuit: '7' }]; s.groupsEnabled = true;
    ann.legend = { x: 300, y: 40, w: 100, h: 60, userResized: false };
    s.showLegendOverlay = true;
    App.renderPdf(); App.updateUI(); App.renderAnnotations();
  }, trade);
  await page.waitForTimeout(300);
}
const legendBox = (page) => page.evaluate(() => { const l = window.state.pages[0].canvases[0].annotations.legend; return { w: Math.round(l.w), h: Math.round(l.h) }; });

test.describe('Sheet legend', () => {
  test('electrical draws compact by default; tally and full are a setting away and change the box', async ({ page }) => {
    const errors = [];
    await boot(page, errors, 'electrical');
    expect(await page.evaluate(() => window.App.resolveLegendStyle())).toBe('compact');
    const compact = await legendBox(page);
    await page.evaluate(() => { window.state.legendSettings.style = 'tally'; window.App.renderAnnotations(); });
    const tally = await legendBox(page);
    await page.evaluate(() => { window.state.legendSettings.style = 'full'; window.App.renderAnnotations(); });
    const full = await legendBox(page);
    expect(compact.h).toBeLessThan(tally.h);
    expect(full.h).toBeGreaterThan(compact.h);
    expect(compact.w).toBeGreaterThan(60);
    expect(errors).toEqual([]);
  });

  test('plumbing keeps the tally; the Summary Legend segment reads the resolved style and writes an explicit one', async ({ page }) => {
    const errors = [];
    await boot(page, errors, 'plumbing');
    expect(await page.evaluate(() => window.App.resolveLegendStyle())).toBe('tally');
    await page.evaluate(() => window.App.openLegendSettingsModal());
    await page.waitForSelector('#legendSettingsModal.visible');
    await expect(page.locator('#legendStyleSegment button[data-style="tally"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#legendStyleSegment button[data-style="compact"]').click();
    expect(await page.evaluate(() => window.state.legendSettings.style)).toBe('compact');
    await expect(page.locator('#legendStyleSegment button[data-style="compact"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.App.resolveLegendStyle())).toBe('compact');
    // The choice rides the project payload like the other legend knobs.
    expect(errors).toEqual([]);
  });

  test('the export path draws the block in ink without error, and a D sheet scales the legend up', async ({ page }) => {
    const errors = [];
    await boot(page, errors, 'hvac');
    const ok = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 1600;
      const ctx = c.getContext('2d');
      try { window.App.renderAnnotationsToContext(ctx, window.state.pages[0], 2, { markerScale: 0.75, lineScale: 0.75 }); return true; } catch (e) { return String(e); }
    });
    expect(ok).toBe(true);
    const letter = await legendBox(page);
    // Pretend the page is a D sheet: the legend follows the sheet's long side.
    const big = await page.evaluate(() => {
      const p = window.state.pages[0]; const real = p.pdfPage.getViewport.bind(p.pdfPage);
      p.pdfPage.getViewport = (o) => { const v = real(o); return Object.assign({}, v, { width: v.width * 4, height: v.height * 4 }); };
      window.state.pages[0].canvases[0].annotations.legend.userResized = false;
      window.App.renderAnnotations();
      const l = window.state.pages[0].canvases[0].annotations.legend; const r = { w: Math.round(l.w), h: Math.round(l.h) };
      p.pdfPage.getViewport = real; return r;
    });
    expect(big.h).toBeGreaterThan(letter.h * 1.5);
    expect(errors).toEqual([]);
  });
});

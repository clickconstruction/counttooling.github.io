// @ts-check
/**
 * Regression: Line Types sidebar vs Copy to /Tooling vs Copy Summary (email/text)
 * must report the SAME line length, always denominated in decimal feet — even when the
 * page is scaled in a non-foot unit (the case that diverged: inch-scaled details showed
 * 12'-6" in the sidebar but 150.00 in in the export).
 *
 * A 240-pdf-pt line at 2 px/in = 120 in = 10 ft, and at 24 px/ft = 10 ft, must read
 * "10.00 ft" in all three surfaces.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Length tallies are always decimal feet and agree across surfaces', () => {
  test('inch-scaled and foot-scaled pages both read 10.00 ft everywhere', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'samples', 'sample-plan.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });

    // Inject a line type + a 240-pdf-pt quick line on the active canvas.
    await page.evaluate(() => {
      const s = window.state, p = s.pages[0];
      s.lineTypes.push({ id: 'lt_cw', name: 'Cold Water', color: '#4a9eff', curveStyle: 'straight' });
      const cv = p.canvases[0];
      cv.annotations.quickLines = cv.annotations.quickLines || [];
      cv.annotations.quickLines.push({ id: 'ql1', x1: 0, y1: 0, x2: 240, y2: 0, lineTypeId: 'lt_cw', color: '#4a9eff' });
    });

    // Read all three surfaces for the current page scale.
    const readAll = () => page.evaluate(() => {
      window.App.updateUI();
      const badge = (document.querySelector('#lineTypesList .badge') || {}).textContent || '';
      return {
        badge,
        pipe: window.getPipeToolingSummary(),
        email: window.getEmailTextSummary()
      };
    });

    // --- inch scale: 240 pt / 2 = 120 in = 10 ft ---
    await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 2, unit: 'in' }; });
    const inch = await readAll();
    expect(inch.badge).toContain('10.00 ft');          // sidebar (was 10'-0" before)
    expect(inch.pipe).toContain('ft of Cold Water');   // export label unit is always ft
    expect(inch.pipe).toMatch(/Cold Water\t10\.00\b/); // export value is feet, not 120.00 in
    expect(inch.email).toContain('10.00 ft of Cold Water');

    // --- foot scale: 240 pt / 24 = 10 ft (format parity: was 10'-0" vs 10.00) ---
    await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 24, unit: 'ft' }; });
    const feet = await readAll();
    expect(feet.badge).toContain('10.00 ft');
    expect(feet.pipe).toMatch(/Cold Water\t10\.00\b/);
    expect(feet.email).toContain('10.00 ft of Cold Water');

    expect(errors).toEqual([]);
  });

  test('mixed scaled/unscaled pages split into ft and px rows — never one summed number', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // p1 scaled at 24 px/ft with a 240-pt line (10 ft); p2 UNSCALED with a
    // 367.2-pt line (raw px). The old rollups summed 10 + 367.2 = "377.20 ft".
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.lineTypes.push({ id: 'lt_cw', name: 'Cold Water', color: '#4a9eff', curveStyle: 'straight' });
      s.pages[0].scale = { pixelsPerUnit: 24, unit: 'ft', label: 'p1' };
      const c0 = App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.quickLines = [{ id: 'ql1', x1: 0, y1: 0, x2: 240, y2: 0, lineTypeId: 'lt_cw', color: '#4a9eff' }];
      const c1 = App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.quickLines = [{ id: 'ql2', x1: 0, y1: 0, x2: 367.2, y2: 0, lineTypeId: 'lt_cw', color: '#4a9eff' }];
      App.invalidateFooterTotals();
      App.updateUI();
    });

    const all = await page.evaluate(() => ({
      badge: (document.querySelector('#lineTypesList .badge') || {}).textContent || '',
      footer: (document.getElementById('statusTotals') || {}).textContent || '',
      pipe: window.getPipeToolingSummary(),
      email: window.getEmailTextSummary(),
    }));

    // Copy to /Tooling: one ft row (page 1) + one px row (page 2).
    expect(all.pipe).toContain('ft of Cold Water\t10.00\t1');
    expect(all.pipe).toContain('px of Cold Water\t367\t2');
    expect(all.pipe).not.toContain('377');
    // Email summary: both bullets, px flagged as no-scale.
    expect(all.email).toContain('10.00 ft of Cold Water: 1 run (page 1)');
    expect(all.email).toContain('367 px of Cold Water: 1 run (page 2 — no scale set)');
    // Sidebar Line Types badge + footer totals hold the split too.
    expect(all.badge).toContain('10.00 ft + 367 px');
    expect(all.footer).toContain('10.00 ft + 367 px');

    expect(errors).toEqual([]);
  });
});

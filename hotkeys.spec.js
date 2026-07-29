// @ts-check
/**
 * Tests: hotkeys-as-data — the HOTKEYS table (constants.js) is the single
 * source the keydown handler EXECUTES and build:macros RENDERS (the Macros
 * table the Keyboard Map then derives from). The generated table is gated by
 * `npm run check`; THIS spec guards the executable half plus behavior smoke.
 *
 * The load-bearing test is coverage: every non-bespoke HOTKEYS entry must
 * resolve to a registered runner or a real clickable element — the failure
 * mode where a table entry LOOKS documented but presses into nothing.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Hotkeys as data', () => {
  test('every runnable HOTKEYS entry resolves; keys drive the app; viewer gating holds', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // COVERAGE: runner names exist for every `runner` entry, elements exist for
    // every `btnId` entry — both directions of the executable contract.
    const coverage = await page.evaluate(() => {
      const problems = [];
      const runners = window.App.__hotkeyRunnerNames || [];
      const used = new Set();
      for (const h of window.App.HOTKEYS) {
        if (h.bespoke) continue;
        if (h.runner) {
          used.add(h.runner);
          if (!runners.includes(h.runner)) problems.push(`${h.key}: runner '${h.runner}' not registered`);
        } else if (!document.getElementById(h.btnId)) {
          problems.push(`${h.key}: element #${h.btnId} missing`);
        }
      }
      for (const r of runners) if (!used.has(r)) problems.push(`runner '${r}' registered but unused by HOTKEYS`);
      return problems;
    });
    expect(coverage).toEqual([]);

    // BEHAVIOR smoke through the real keydown path (needs a PDF for the tools).
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    // Measure (and other scale-gated tools) show the Set-Scale-first toast and
    // refuse to arm on an unscaled page — give the pages a scale.
    await page.evaluate(() => {
      window.state.pages.forEach((p) => { p.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' }; });
    });
    const press = (k) => page.evaluate((key) => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }, k);

    await press('d');   // Measure — button-click entry, viewer-allowed
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.MEASURE));
    await press('m');   // Move — runner entry, resets tool
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.NONE));
    const snapBefore = await page.evaluate(() => !!window.state.lineTypeSettings.snapToHorizontalVertical);
    await press('j');   // Snap — runner entry, toggles
    expect(await page.evaluate(() => !!window.state.lineTypeSettings.snapToHorizontalVertical)).toBe(!snapBefore);
    await press('j');   // restore

    // VIEWER GATING rides the table: editor-only keys no-op for viewers,
    // viewer-allowed keys still work.
    await page.evaluate(() => { window.state.isViewer = true; });
    await press('h');   // Highlight — editor-only
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.NONE));
    await press('d');   // Measure — viewer-allowed
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.MEASURE));
    await page.evaluate(() => { window.state.isViewer = false; });

    // The generated table still feeds the Keyboard Map: every runnable key is
    // lit on the board (the V-row bug class, asserted end-to-end).
    await page.evaluate(() => document.getElementById('statusBarMacros').click());
    await page.waitForSelector('#macrosModal.visible', { timeout: 5000 });
    const unlit = await page.evaluate(() => {
      const out = [];
      for (const h of window.App.HOTKEYS) {
        if (h.bespoke) continue;
        const el = document.querySelector(`#macrosKeyboardBoard .kb-key[data-key="${h.key.toUpperCase()}"]`);
        if (!el || !(el.className.includes('is-mapped') || el.className.includes('is-modifier'))) out.push(h.key);
      }
      return out;
    });
    expect(unlit).toEqual([]);

    expect(errors).toEqual([]);
  });
});

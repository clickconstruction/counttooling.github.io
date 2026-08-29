// @ts-check
/**
 * Tests: RFI flags (features/rfi-flags.js) — the CountTooling half of the cross-app
 * RFI loop (PipeTooling docs/RFI_LOOP_PLAN.md R2). A canvas note whose text starts
 * with "RFI:" (case-insensitive, optional space before the colon) is a question for
 * the GC; Copy RFI Flags collects every such note across ALL pages and canvases into
 * a tab-delimited clipboard list headed by the project name. Non-RFI notes never
 * leak in; the empty case alerts instead of copying.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('RFI flags', () => {
  test('registry contract + collection + clipboard text', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Registry contract
    const registered = await page.evaluate(() => ({
      collect: typeof window.App.collectRfiFlags,
      build: typeof window.App.buildRfiFlagsText,
      copy: typeof window.App.copyRfiFlags,
      btn: !!document.getElementById('copyRfiFlags'),
    }));
    expect(registered).toEqual({ collect: 'function', build: 'function', copy: 'function', btn: true });

    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const text = await page.evaluate(() => {
      const s = window.state;
      s.currentProjectName = 'ZZ Twin LIVSTE';
      s.pages[0].name = 'P200';
      s.pages[0].canvases[0].annotations.notes.push(
        { x: 10, y: 10, id: 'n1', text: 'RFI: fixture on plan missing from schedule', width: 150, fontSize: 14 },
        { x: 20, y: 20, id: 'n2', text: 'plain note — never exported', width: 150, fontSize: 14 },
        { x: 30, y: 30, id: 'n3', text: 'rfi : riser disagrees with plan here', width: 150, fontSize: 14 },
      );
      s.pages[1].canvases[0].annotations.notes.push(
        { x: 5, y: 5, id: 'n4', text: 'RFI:unlabeled line near gridline 3/B', width: 150, fontSize: 14 },
      );
      const rows = window.App.collectRfiFlags();
      return { rows, text: window.App.buildRfiFlagsText(rows) };
    });

    expect(text.rows).toHaveLength(3);
    const lines = text.text.split('\n');
    expect(lines[0]).toBe('RFI flags\tZZ Twin LIVSTE');
    expect(lines[1]).toBe('p1 P200\tfixture on plan missing from schedule');
    expect(lines[2]).toBe('p1 P200\triser disagrees with plan here');
    expect(lines[3]).toMatch(/^p2\tunlabeled line near gridline 3\/B$/);

    // Clipboard path (stubbed) via the button
    const copied = await page.evaluate(async () => {
      let captured = null;
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
        configurable: true,
      });
      await window.App.copyRfiFlags();
      return captured;
    });
    expect(copied).toContain('RFI flags\tZZ Twin LIVSTE');
    expect(copied).not.toContain('plain note');

    expect(errors).toEqual([]);
  });
});

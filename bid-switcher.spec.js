// @ts-check
/**
 * Tests: the header bid switcher (BID-SWITCHER.md).
 *
 * Reported by an estimator 2026-09-15: "two different buttons to upload pdf on
 * top bar, none to load project". Both halves were true. The Export control
 * used to wear an "Import PDF" costume whenever no project was open
 * (updateUI's shieldImportMode), so the empty-state header shipped two upload
 * affordances and no door to a saved bid.
 *
 * Stage 0 pins the deletion of that costume. Later stages add the bid chip.
 */
const { test, expect } = require('@playwright/test');

function realErrors(errors) {
  return errors.filter((e) =>
    !/Failed to load resource|net::|Failed to fetch|config\.local\.js/.test(e));
}

test.describe('Empty-state header: one upload door, no decoy', () => {
  test('the Export control does not impersonate Upload PDF', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.waitForFunction(() => !!(window.App && window.App.state), null, { timeout: 15000 });

    // Nothing open: the Export control is gone entirely rather than disguised.
    await expect(page.locator('#exportDropdown')).toBeHidden();
    await expect(page.locator('#exportDropdownBtn')).toBeHidden();

    // The disguise itself is gone from the DOM.
    await expect(page.locator('#exportDropdownIconImport')).toHaveCount(0);

    // No control anywhere in the header claims to upload a PDF except #uploadPdf.
    const uploadish = await page.evaluate(() => {
      const hits = [];
      document.querySelector('header.header').querySelectorAll('button').forEach((b) => {
        const r = b.getBoundingClientRect();
        if (getComputedStyle(b).display === 'none' || r.width === 0) return;
        const text = [b.id, b.getAttribute('aria-label') || '', b.getAttribute('title') || '', b.textContent || ''].join(' ');
        if (/upload|import/i.test(text) && /pdf|plan/i.test(text)) hits.push(b.id || text.trim().slice(0, 30));
      });
      return hits;
    });
    expect(uploadish).toEqual(['uploadPdf']);

    expect(realErrors(errors)).toEqual([]);
  });

  test('with a plan open the Export menu is back and opens', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.locator('#pdfInput').setInputFiles(require('path').join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });

    const btn = page.locator('#exportDropdownBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-label', 'Export');
    await expect(btn).toHaveAttribute('aria-haspopup', 'menu');

    // It opens its menu now instead of firing the file picker.
    await btn.click();
    await expect(page.locator('#exportDropdownMenu')).toHaveClass(/visible/);

    expect(realErrors(errors)).toEqual([]);
  });
});

// @ts-check
/**
 * features/output.js (feature-file split #26): the output-actions cluster —
 * Copy to PipeTooling (with the view-link footer machinery), Copy Summary
 * (email/text), and Download current page — moved out of app.js onto the
 * window.App registry.
 *
 * Pins the moved surface end-to-end: the Copy Summary option writes the email
 * summary to the clipboard and shows the copied modal; the Copy to PipeTooling
 * option writes the tab-delimited summary and (cloud enabled, no cloud project)
 * shows the "save to include a view link" toast instead; the Download button
 * opens its mode menu on a multi-page project and the this-canvas option
 * produces a real PDF download with the expected filename; and the
 * App.onViewLinkRevoked callback used by the Share modal's revoke is
 * registered.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('Output cluster (features/output.js)', () => {
  test('copy summary, copy to PipeTooling, download current page', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Seed a scale, a counter with 2 markers, and a 10-ft quick line.
    await page.evaluate(() => {
      const s = window.state, p = s.pages[0];
      p.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      s.counters = [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      const canvas = window.App.ensureActiveCanvas(p);
      canvas.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }, { x: 80, y: 80, id: 'm2', group: null }] };
      canvas.annotations.quickLines = [{ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt1', group: null }];
      window.App.updateUI();
    });

    // --- Copy Summary (email/text): clipboard + copied modal ---
    await page.evaluate(() => {
      document.querySelector('.copy-summary-option[data-mode="this-canvas"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('#pipeToolingCopiedModal.visible', { timeout: 5000 });
    const emailText = await page.evaluate(() => navigator.clipboard.readText());
    expect(emailText).toContain('Floor Drain');
    expect(emailText).toContain('2');
    await page.waitForSelector('#pipeToolingCopiedModal.visible', { state: 'detached', timeout: 5000 }).catch(() => {});

    // --- Copy to PipeTooling: clipboard + no-link toast (no cloud project) ---
    await page.evaluate(() => {
      document.querySelector('.pipe-tooling-option[data-mode="this-canvas"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('airboardToastText');
      return el && /view link/i.test(el.textContent || '');
    }, { timeout: 5000 });
    const pipeText = await page.evaluate(() => navigator.clipboard.readText());
    expect(pipeText).toContain('Floor Drain');
    expect(pipeText).toContain('\t');
    expect(pipeText).not.toContain('View link:');   // no cloud project -> no footer
    const toast = await page.evaluate(() => document.getElementById('airboardToastText').textContent);
    expect(toast).toContain('Save the project to the cloud');

    // --- Download current page: menu opens (multi-page), option downloads ---
    await page.evaluate(() => document.getElementById('downloadCurrentPageBtn').click());
    await expect(page.locator('#downloadCurrentPageMenu')).toHaveClass(/visible/);
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.evaluate(() => {
      document.querySelector('.download-page-option[data-mode="this-canvas"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^takeoff-page1_.*\.pdf$/);
    await expect(page.locator('#downloadCurrentPageMenu')).not.toHaveClass(/visible/);

    // --- Share-revoke callback registered by the feature ---
    expect(await page.evaluate(() => typeof window.App.onViewLinkRevoked)).toBe('function');

    expect(errors).toEqual([]);
  });
});

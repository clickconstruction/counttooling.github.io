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

  test('scale check gates Copy to /Tooling: unscaled line pages flag, counter-only pages do not', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Page 1: NO scale, counters only (must not flag — pages without line
    // marks are never counted). Page 2: NO scale + a line (must flag).
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.counters = [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      const c0 = App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }] };
      s.pages[1].label = 'P-2 Underground';
      const c1 = App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.quickLines = [{ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt1', group: null }];
      App.updateUI();
    });
    // Clears the toast text first so each wait sees ITS copy's toast, not a
    // leftover from the previous step.
    const clickToolingOption = (mode) => page.evaluate((m) => {
      const toastEl = document.getElementById('airboardToastText');
      if (toastEl) toastEl.textContent = '';
      document.querySelector('.pipe-tooling-option[data-mode="' + m + '"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, mode);

    // All-pages copy -> the check modal opens, listing only the line page.
    await clickToolingOption('visible');
    await page.waitForSelector('#toolingScaleCheckModal.visible', { timeout: 5000 });
    const listed = await page.evaluate(() => [...document.querySelectorAll('#toolingScaleCheckList li')].map(li => li.textContent));
    expect(listed).toEqual(['P-2 Underground']);

    // Cancel: nothing copied, pending export dropped.
    await page.locator('#toolingScaleCheckCancel').click();
    await expect(page.locator('#toolingScaleCheckModal')).not.toHaveClass(/visible/);

    // Export anyway: the copy proceeds and carries the px unit.
    await clickToolingOption('visible');
    await page.waitForSelector('#toolingScaleCheckModal.visible', { timeout: 5000 });
    await page.locator('#toolingScaleCheckExport').click();
    await page.waitForFunction(() => {
      const el = document.getElementById('airboardToastText');
      return el && /view link/i.test(el.textContent || '');
    }, { timeout: 5000 });
    const pipeText = await page.evaluate(() => navigator.clipboard.readText());
    expect(pipeText).toContain('px of Copper');

    // Set scale: jumps to the flagged page and opens the Set Scale modal.
    await clickToolingOption('visible');
    await page.waitForSelector('#toolingScaleCheckModal.visible', { timeout: 5000 });
    await page.locator('#toolingScaleCheckGoSet').click();
    await expect(page.locator('#toolingScaleCheckModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.state.currentPage)).toBe(1);
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    await page.keyboard.press('Escape');

    // Current-page copy on the counter-only page: no modal, straight to copy.
    await page.evaluate(() => { window.state.currentPage = 0; window.App.fitZoom(); });
    await clickToolingOption('this-canvas');
    await page.waitForFunction(() => /view link/i.test(document.getElementById('airboardToastText')?.textContent || ''), { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('toolingScaleCheckModal').classList.contains('visible'))).toBe(false);

    // A scale zone around the line satisfies the check without a page scale.
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      const c1 = App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.scaleZones = [{ id: 'z1', x1: 50, y1: 50, x2: 300, y2: 200, scale: { pixelsPerUnit: 12, unit: 'ft', label: 'zone' } }];
      App.updateUI();
    });
    await clickToolingOption('visible');
    await page.waitForFunction(() => /view link/i.test(document.getElementById('airboardToastText')?.textContent || ''), { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('toolingScaleCheckModal').classList.contains('visible'))).toBe(false);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('of Copper');

    expect(errors).toEqual([]);
  });

  test('scale check gates Copy Summary too (T1-05)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // An unscaled page with a summarized line — the exact case that used to
    // copy a silent px-summed "ft" total straight to the clipboard.
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      s.pages[1].label = 'P-2 Underground';
      const c1 = App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.quickLines = [{ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt1', group: null }];
      App.updateUI();
    });
    await page.evaluate(() => navigator.clipboard.writeText('SENTINEL'));

    // Copy Summary opens the scale-check modal and writes NOTHING.
    await page.evaluate(() => {
      document.querySelector('.copy-summary-option[data-mode="visible"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('#toolingScaleCheckModal.visible', { timeout: 5000 });
    const listed = await page.evaluate(() => [...document.querySelectorAll('#toolingScaleCheckList li')].map(li => li.textContent));
    expect(listed).toEqual(['P-2 Underground']);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('SENTINEL');

    // Cancel drops the pending copy — still nothing written.
    await page.locator('#toolingScaleCheckCancel').click();
    await expect(page.locator('#toolingScaleCheckModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('SENTINEL');

    // Export anyway: the email summary copies with the honest px row.
    await page.evaluate(() => {
      document.querySelector('.copy-summary-option[data-mode="visible"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('#toolingScaleCheckModal.visible', { timeout: 5000 });
    await page.locator('#toolingScaleCheckExport').click();
    await page.waitForSelector('#pipeToolingCopiedModal.visible', { timeout: 5000 });
    const emailText = await page.evaluate(() => navigator.clipboard.readText());
    expect(emailText).toContain('px of Copper');
    expect(emailText).toContain('no scale set');

    expect(errors).toEqual([]);
  });
});

// B3 copy-cluster regressions: the view-link no-link toast must diagnose the
// view-only session FIRST (not "Sign in…"), the copy drop-ups must stay
// anchored to their buttons (the stylesheet's .show-report-menu right:0 must
// not stretch a fixed menu to the viewport edge), the two copy menus must
// close each other (their buttons stopPropagation, so the global document-
// click dismissal never runs), and the Set-scale detour must offer a one-tap
// "Copy again" resume that re-runs the gated copy inside a fresh user gesture.
test.describe('Copy cluster fixes (B3)', () => {
  const seedCounterData = () => async (page) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.counters = [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      const c0 = App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }] };
      App.updateUI();
    });
  };

  test('view-link session gets the view-only toast, not "Sign in"', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await seedCounterData()(page);

    // A view-link load (features/view-only.js) sets currentProjectId AND
    // loadedViaViewLink, with no signed-in session — the exact combination
    // that used to fall into the "Sign in to include a view link" branch.
    await page.evaluate(() => {
      window.state.currentProjectId = 'view-proj';
      window.state.loadedViaViewLink = true;
      window.state.supabaseSession = null;
    });
    await page.evaluate(() => {
      document.querySelector('.pipe-tooling-option[data-mode="this-canvas"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('airboardToastText');
      return el && (el.textContent || '').includes('Counts copied');
    }, { timeout: 5000 });
    const toast = await page.evaluate(() => document.getElementById('airboardToastText').textContent);
    expect(toast).toContain('You opened this from a view-only link, so no link was added');
    expect(toast).not.toContain('Sign in');
    expect(errors).toEqual([]);
  });

  test('Copy to /Tooling drop-up stays anchored to its button', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await seedCounterData()(page);

    await page.click('#forPipeTooling');
    await expect(page.locator('#forPipeToolingMenu')).toHaveClass(/visible/);
    const r = await page.evaluate(() => {
      const m = document.getElementById('forPipeToolingMenu').getBoundingClientRect();
      const b = document.getElementById('forPipeTooling').getBoundingClientRect();
      return { menu: { left: m.left, right: m.right, top: m.top, bottom: m.bottom, width: m.width }, btn: { left: b.left, top: b.top }, vw: window.innerWidth };
    });
    // Anchored, not stretched: without right:auto the stylesheet's right:0
    // pulled the fixed menu's right edge to the viewport edge.
    expect(r.menu.right).toBeLessThan(r.vw - 40);
    expect(r.menu.width).toBeLessThan(450);
    // Drop-up: opens above the button, left edge on the button (clamp slack).
    expect(r.menu.bottom).toBeLessThanOrEqual(r.btn.top + 1);
    expect(Math.abs(r.menu.left - r.btn.left)).toBeLessThan(30);
    expect(errors).toEqual([]);
  });

  test('the two copy menus close each other', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await seedCounterData()(page);

    await page.click('#forPipeTooling');
    await expect(page.locator('#forPipeToolingMenu')).toHaveClass(/visible/);
    await page.click('#copySummaryText');
    await expect(page.locator('#copySummaryTextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#forPipeToolingMenu')).not.toHaveClass(/visible/);
    await page.click('#forPipeTooling');
    await expect(page.locator('#forPipeToolingMenu')).toHaveClass(/visible/);
    await expect(page.locator('#copySummaryTextMenu')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('"Copy again" chip resumes the copy after the Set-scale detour', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      s.pages[1].label = 'P-2 Underground';
      const c1 = App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.quickLines = [{ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt1', group: null }];
      App.updateUI();
    });

    // Unscaled line page -> check modal -> Set scale detour.
    await page.evaluate(() => {
      document.querySelector('.pipe-tooling-option[data-mode="visible"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('#toolingScaleCheckModal.visible', { timeout: 5000 });
    await page.locator('#toolingScaleCheckGoSet').click();
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    // The resume chip is up, named for the surface it will re-run.
    await expect(page.locator('#copyAgainChip')).toBeVisible();
    await expect(page.locator('#copyAgainChip')).toContainText('Copy to /Tooling');

    // Set the scale (modal closed via Escape; scale seeded directly).
    await page.keyboard.press('Escape');
    await page.evaluate(() => { window.state.pages[1].scale = { pixelsPerUnit: 24, unit: 'ft', label: 'set' }; });

    // One tap: the chip's click re-runs the gated copy inside its own user
    // gesture — clean walk now, so the copy lands on the clipboard.
    await page.locator('#copyAgainChip').click();
    await page.waitForFunction(() => {
      const el = document.getElementById('airboardToastText');
      return el && /view link/i.test(el.textContent || '');
    }, { timeout: 5000 });
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('ft of Copper');
    await expect(page.locator('#copyAgainChip')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

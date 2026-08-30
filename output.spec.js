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
    // Copy Summary never shows the /Tooling by-unit detail line.
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('pipeToolingCopiedDetail')).display)).toBe('none');
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
    // The by-unit split rides along (mirror of PipeTooling's import toast):
    // 1 counter row totalling 2, 1 line type at 10 ft — never summed together.
    expect(toast).toContain('1 count (2 ea) · 1 line type (10 ft)');

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

  test('view-link sessions get the accurate no-link toast (branch order, B3)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // A view-link session shape: project id present, loadedViaViewLink set,
    // no supabase session. Before B3 the sign-in branch shadowed the accurate
    // view-only one ("Sign in to include a view link" — a lie for viewers).
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.counters = [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      const c0 = App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }] };
      s.currentProjectId = 'proj-viewer';
      s.loadedViaViewLink = true;
      App.updateUI();
    });
    await page.evaluate(() => {
      document.querySelector('.pipe-tooling-option[data-mode="this-canvas"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForFunction(() => /view-only/i.test(document.getElementById('airboardToastText')?.textContent || ''), { timeout: 5000 });
    const toast = await page.evaluate(() => document.getElementById('airboardToastText').textContent);
    expect(toast).toContain('View-only sessions cannot create a share link');
    expect(toast).not.toContain('Sign in');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Floor Drain');

    expect(errors).toEqual([]);
  });

  test('copy scope drop-ups anchor to their buttons and close each other (B3)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

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

    // Open the /Tooling drop-up: anchored to its button, NOT the full-window
    // band the stylesheet's right:0 used to make (J11 friction #8).
    await page.locator('#forPipeTooling').click();
    await expect(page.locator('#forPipeToolingMenu')).toHaveClass(/visible/);
    const geo = await page.evaluate(() => {
      const m = document.getElementById('forPipeToolingMenu').getBoundingClientRect();
      const b = document.getElementById('forPipeTooling').getBoundingClientRect();
      return { mLeft: m.left, mRight: m.right, mWidth: m.width, bLeft: b.left, vw: window.innerWidth };
    });
    expect(geo.mWidth).toBeLessThan(500);                    // not a viewport-wide band
    expect(geo.mRight).toBeLessThan(geo.vw - 200);           // right edge is nowhere near the viewport edge
    expect(Math.abs(geo.mLeft - geo.bLeft)).toBeLessThan(12); // anchored to the button's left

    // The two copy menus close each other (both buttons stopPropagation, so
    // the document click-away can't do it).
    await page.locator('#copySummaryText').click();
    await expect(page.locator('#copySummaryTextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#forPipeToolingMenu')).not.toHaveClass(/visible/);
    const geo2 = await page.evaluate(() => {
      const m = document.getElementById('copySummaryTextMenu').getBoundingClientRect();
      return { mWidth: m.width, mRight: m.right, vw: window.innerWidth };
    });
    expect(geo2.mWidth).toBeLessThan(500);
    expect(geo2.mRight).toBeLessThan(geo2.vw - 200);
    await page.locator('#forPipeTooling').click();
    await expect(page.locator('#forPipeToolingMenu')).toHaveClass(/visible/);
    await expect(page.locator('#copySummaryTextMenu')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });

  test('1 page / 1 canvas skips the scope chooser on both copy buttons (B3/J13)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state, App = window.App, p = s.pages[0];
      p.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
      s.counters = [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      const c = App.ensureActiveCanvas(p);
      c.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }] };
      c.annotations.quickLines = [{ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt1', group: null }];
      App.updateUI();
    });

    // Copy to /Tooling: no menu — straight to the gated copy (like Download).
    await page.locator('#forPipeTooling').click();
    await page.waitForFunction(() => /view link/i.test(document.getElementById('airboardToastText')?.textContent || ''), { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('forPipeToolingMenu').classList.contains('visible'))).toBe(false);
    const pipeText = await page.evaluate(() => navigator.clipboard.readText());
    expect(pipeText).toContain('Floor Drain');
    expect(pipeText).toContain('\t');

    // Copy Summary: same skip — copied modal, no menu.
    await page.evaluate(() => { document.getElementById('airboardToastText').textContent = ''; });
    await page.locator('#copySummaryText').click();
    await page.waitForSelector('#pipeToolingCopiedModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('copySummaryTextMenu').classList.contains('visible'))).toBe(false);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Floor Drain');

    expect(errors).toEqual([]);
  });

  test('Copy again resumes the copy after the Set-scale detour (B3/J11)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Page 2: unscaled line — the gate flags it. Spy logUserEvent to prove the
    // unscaled_ft_block event still fires from this surface.
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      s.pages[1].label = 'P-2 Underground';
      const c1 = App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.quickLines = [{ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt1', group: null }];
      window.__events = [];
      const orig = App.logUserEvent;
      App.logUserEvent = (name, pid, data) => { window.__events.push(name); return orig(name, pid, data); };
      App.updateUI();
    });
    await page.evaluate(() => navigator.clipboard.writeText('SENTINEL'));

    // Copy -> gate -> Set scale: jumps to the flagged page, arms the resume.
    await page.evaluate(() => {
      document.querySelector('.pipe-tooling-option[data-mode="visible"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('#toolingScaleCheckModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => window.__events.includes('unscaled_ft_block'))).toBe(true);
    await page.locator('#toolingScaleCheckGoSet').click();
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => window.state.currentPage)).toBe(1);

    // Apply a preset — the one-tap "Copy again" toast appears; nothing has
    // been copied yet.
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForSelector('#copyAgainModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('SENTINEL');

    // One tap: the gate re-walks (clean now) and the copy lands.
    await page.locator('#copyAgainLink').click();
    await page.waitForFunction(() => /view link/i.test(document.getElementById('airboardToastText')?.textContent || ''), { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('copyAgainModal').classList.contains('visible'))).toBe(false);
    expect(await page.evaluate(() => document.getElementById('toolingScaleCheckModal').classList.contains('visible'))).toBe(false);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('of Copper');
    expect(copied).not.toContain('px of Copper');   // scaled now — real feet, not pixels

    expect(errors).toEqual([]);
  });

  test('clipboard failure speaks plain words, not a raw DOMException (B3/J11)', async ({ page }) => {
    const errors = [];
    // The failure path intentionally console.errors the raw error for
    // diagnosis — filter it from the no-console-errors assertion.
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('[copy]')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const alerts = [];
    page.on('dialog', (d) => { alerts.push(d.message()); d.accept().catch(() => {}); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.counters = [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      const c0 = App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }] };
      // Break the clipboard the way a denied permission does.
      Clipboard.prototype.writeText = () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
      App.updateUI();
    });
    await page.evaluate(() => {
      document.querySelector('.copy-summary-option[data-mode="this-canvas"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect.poll(() => alerts.length, { timeout: 5000 }).toBeGreaterThan(0);
    expect(alerts[0]).toContain('Nothing was copied');
    expect(alerts[0]).toContain('clipboard access');
    expect(alerts[0]).not.toContain('NotAllowedError');
    expect(alerts[0]).not.toContain('Write permission denied');
    // No false "Copied to clipboard." card.
    expect(await page.evaluate(() => document.getElementById('pipeToolingCopiedModal').classList.contains('visible'))).toBe(false);

    expect(errors).toEqual([]);
  });

  test('B4 export naming: one trade dialect across the scope menus, layer qualifiers only when a page has layers', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const label = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim(), sel);
    const hidden = (sel) => page.evaluate((s) => document.querySelector(s)?.style.display === 'none', sel);

    // --- Single-canvas project: sheet dialect, no layer words anywhere ---
    expect(await label('.pipe-tooling-option[data-mode="this-canvas"]')).toBe('This sheet');
    expect(await label('.pipe-tooling-option[data-mode="visible"]')).toBe('Every sheet');
    expect(await label('.copy-summary-option[data-mode="visible"]')).toBe('Every sheet');
    expect(await label('.download-page-option[data-mode="this-canvas"]')).toBe('Download this sheet');
    expect(await label('.download-page-option[data-mode="all-pages"]')).toBe('Download every sheet');
    expect(await label('.show-report-option[data-mode="this-canvas"]')).toBe('This sheet');
    expect(await label('.show-report-option[data-mode="all-pages-current-canvas"]')).toBe('Every sheet');
    // "Everything" duplicates "Every sheet" when every page has one canvas — hidden.
    expect(await hidden('.pipe-tooling-option[data-mode="all"]')).toBe(true);
    expect(await hidden('.copy-summary-option[data-mode="all"]')).toBe(true);
    expect(await hidden('.download-page-option[data-mode="all-pages-canvases"]')).toBe(true);
    expect(await hidden('.show-report-option[data-mode="all-pages-canvases"]')).toBe(true);

    // --- Add a second layer to page 1: qualifiers fill in, Everything appears ---
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      App.ensureActiveCanvas(s.pages[0]);
      s.pages[0].canvases.push({ id: 'c-extra', name: 'Layer 2', annotations: App.makeAnnotations() });
      App.updateUI();
    });
    expect(await label('.pipe-tooling-option[data-mode="visible"]')).toBe('Every sheet (visible layers)');
    expect(await label('.copy-summary-option[data-mode="visible"]')).toBe('Every sheet (visible layers)');
    expect(await label('.download-page-option[data-mode="this-canvas"]')).toBe('Download this sheet (active layer)');
    expect(await label('.download-page-option[data-mode="all-canvases"]')).toBe('Download this sheet (every layer)');
    expect(await label('.download-page-option[data-mode="all-pages"]')).toBe('Download every sheet (active layer)');
    expect(await label('.show-report-option[data-mode="all-canvases-on-page"]')).toBe('This sheet — every layer');
    expect(await label('.show-report-option[data-mode="all-pages-current-canvas"]')).toBe('Every sheet (active layer)');
    expect(await hidden('.pipe-tooling-option[data-mode="all"]')).toBe(false);
    expect(await label('.pipe-tooling-option[data-mode="all"]')).toBe('Everything');
    expect(await hidden('.copy-summary-option[data-mode="all"]')).toBe(false);
    expect(await hidden('.download-page-option[data-mode="all-pages-canvases"]')).toBe(false);
    expect(await label('.download-page-option[data-mode="all-pages-canvases"]')).toBe('Download everything');
    expect(await hidden('.show-report-option[data-mode="all-pages-canvases"]')).toBe(false);
    expect(await label('.show-report-option[data-mode="all-pages-canvases"]')).toBe('Everything');

    // The mode strings behind the labels are untouched: "Everything" still runs
    // the merged-annotations copy.
    await page.evaluate(() => {
      document.querySelector('.pipe-tooling-option[data-mode="all"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // No marks -> the empty-summary alert path; just assert no crash happened.
    expect(errors).toEqual([]);
  });

  test('B4 export naming: cloud menu "Original PDF (no marks)", Export PDFs is the yellow primary, Highlight/Note Pages renamed', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const alerts = [];
    page.on('dialog', (d) => { alerts.push(d.message()); d.accept().catch(() => {}); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // The wrong-file-to-GC trap (J10): the original-PDF row says what it is.
    expect(await page.evaluate(() =>
      document.querySelector('.export-dropdown-option[data-action="pdf"]').textContent.trim()
    )).toBe('Original PDF (no marks)');

    // Weight swap (J10/J13): Export PDFs is the yellow primary; Copy to
    // /Tooling drops to neighbor weight.
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.counters = [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      const c = App.ensureActiveCanvas(s.pages[0]);
      c.annotations.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: null }] };
      App.updateUI();
    });
    const weights = await page.evaluate(() => {
      const exp = document.getElementById('specificPages');
      const pt = document.getElementById('forPipeTooling');
      return {
        expPrimary: exp.classList.contains('sidebar-btn-primary'),
        ptPrimary: pt.classList.contains('sidebar-btn-primary'),
        expBg: getComputedStyle(exp).backgroundColor,
        ptBg: getComputedStyle(pt).backgroundColor,
      };
    });
    expect(weights.expPrimary).toBe(true);
    expect(weights.ptPrimary).toBe(false);
    expect(weights.expBg).not.toBe(weights.ptBg);

    // Highlight/Note Pages (PDF) renames (J8) — buttons and the jsPDF fallback alert.
    expect(await page.evaluate(() => document.getElementById('bundleHighlights').textContent.trim())).toBe('Highlight Pages (PDF)');
    expect(await page.evaluate(() => document.getElementById('bundleNotes').textContent.trim())).toBe('Note Pages (PDF)');
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      const c = App.ensureActiveCanvas(s.pages[0]);
      c.annotations.highlights = [{ x: 10, y: 10, w: 40, h: 20, id: 'h1' }];
      const saved = window.jspdf;
      window.jspdf = null;              // simulate the vendored lib missing
      App.updateUI();
      document.getElementById('bundleHighlights').click();
      window.jspdf = saved;
    });
    await expect.poll(() => alerts.length, { timeout: 5000 }).toBeGreaterThan(0);
    expect(alerts[0]).toContain('Highlight Pages (PDF) requires jsPDF');

    expect(errors).toEqual([]);
  });
});

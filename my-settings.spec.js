// @ts-check
/**
 * features/my-settings.js (feature-file split #32): the My Settings modal —
 * opener, Artboard save/load/export/clear rows, change-password form,
 * sign-out, and the admin openers — extracted from app.js onto the
 * window.App registry.
 *
 * The cloud paths (airboard save/load, password, sign-out) are
 * Supabase-session-gated, so the always-run test pins what runs locally:
 * App.openMySettings is registered; opening while signed out falls through
 * to the auth modal (the dispatched #authBtn path); Export artboard yields a
 * real artboard-backup.json download; Clear artboard (confirm auto-accepted)
 * empties the palette and resets the modifiers; and the close binding hides
 * a force-shown modal. The stubbed-fetch Load tests pin the apply wiring and
 * the T1-09 relink flow: placed marks re-key to the loaded palette's ids by
 * trimmed case-insensitive name, unmatched marks surface under an "Unknown"
 * row, the confirm states the real numbers, and Ctrl+Z restores the pre-load
 * palette + marker keys.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('My Settings (features/my-settings.js)', () => {
  test('opener fallback, export + clear artboard, close binding', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const dialogMessages = [];
    page.on('dialog', (d) => { dialogMessages.push(d.message()); d.accept(); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => typeof window.App?.openMySettings)).toBe('function');

    // Signed out -> falls through to the auth modal via the #authBtn dispatch.
    await page.evaluate(() => window.App.openMySettings());
    await page.waitForSelector('#authModal.visible', { timeout: 5000 });
    await expect(page.locator('#mySettingsModal')).not.toHaveClass(/visible/);
    await page.keyboard.press('Escape');

    // Seed a palette, then Export artboard -> a real JSON download.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      window.App.updateUI();
    });
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.evaluate(() => document.getElementById('mySettingsExportAirboard').click());
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('artboard-backup.json');

    // Clear artboard (confirm auto-accepted) empties the palette. B14: with
    // NO plan open the undo snapshot no-ops (undo-stack.js pages.length
    // guard), so this state's confirm must not promise undo OR permanence.
    await page.evaluate(() => document.getElementById('mySettingsClearAirboard').click());
    await page.waitForFunction(() => window.state.counters.length === 0 && window.state.lineTypes.length === 0);
    expect(await page.evaluate(() => window.state.activeCounterType)).toBeNull();
    expect(dialogMessages.pop()).toBe('Empty your counters and line types?');

    // The close binding hides a force-shown modal.
    await page.evaluate(() => {
      document.getElementById('mySettingsModal').classList.add('visible');
      document.getElementById('mySettingsModalClose').click();
    });
    await expect(page.locator('#mySettingsModal')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });

  test('Load from Cloud applies custom icons + Quick Key bindings (stubbed fetch)', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Stub the cloud fetch; drive the REAL #mySettingsLoadAirboard handler so
    // the apply wiring (including the previously-dead customIconPaths branch
    // and the replace:true bindings seed) is what's under test.
    const applied = await page.evaluate(async () => {
      window.App.fetchUserAirboard = async () => ({
        counters: [{ id: 'c9', name: 'Cloud Counter', icon: 'M0 0h24v24H0z', color: '#e8c547' }],
        lineTypes: [],
        iconNames: {},
        iconOrder: null,
        plumbingModifiers: null,
        lineModifiers: null,
        numberKeyBindings: { 1: { kind: 'counter', id: 'c9' } },
        customIconPaths: [{ value: 'M0 0h10v10H0z', viewBox: '0 0 24 24', name: 'Spec Widget' }],
      });
      document.getElementById('mySettingsLoadAirboard').click();
      await new Promise((r) => setTimeout(r, 150));
      return {
        counter: window.state.counters[0]?.name,
        customIcons: window.App.getUserCustomIcons().map((i) => i.name),
        bindings: JSON.parse(JSON.stringify(window.state.numberKeyBindings)),
        seededFlag: window.state.numberKeyBindingsSeededFromArtboard,
      };
    });
    expect(applied.counter).toBe('Cloud Counter');
    expect(applied.customIcons).toContain('Spec Widget');
    expect(applied.bindings).toEqual({ 1: { kind: 'counter', id: 'c9' } });
    expect(applied.seededFlag).toBe(true);
  });

  test('Clear Artboard with a plan open: honest confirm copy, and undo restores the palette (B14)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      window.App.updateUI();
    });
    await page.evaluate(() => document.getElementById('mySettingsClearAirboard').click());
    await page.waitForFunction(() => window.state.counters.length === 0 && window.state.lineTypes.length === 0);
    // The copy replaced "This cannot be undone." — a snapshot IS pushed here.
    expect(dialogs.pop()).toBe('Empty this project\'s counters and line types? Marks stay but stop counting. Undo brings counters and lines back.');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.state.counters.length === 1 && window.state.lineTypes.length === 1);
    expect(await page.evaluate(() => window.state.counters[0].name)).toBe('Drain');

    expect(errors).toEqual([]);
  });

  test('Load from Cloud re-links placed marks by name and pushes an undo snapshot (stubbed fetch)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Seed the OLD palette + placed marks: 3 markers under name-matched
    // counters, 2 under a counter absent from the cloud artboard, and one
    // quickLine under a name-matched line type. 6 placed marks total.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [
        { id: 'old-wc', name: 'Water Closet', icon: 'M0 0h24v24H0z', color: '#e8c547' },
        { id: 'old-lav', name: 'Lavatory', icon: 'M0 0h24v24H0z', color: '#4a9eff' },
        { id: 'old-x', name: 'Floor Sink', icon: 'M0 0h24v24H0z', color: '#47c88e' },
      ];
      s.lineTypes = [{ id: 'old-cu', name: 'Copper', color: '#4a9eff', curveStyle: 'straight' }];
      const c0 = window.App.ensureActiveCanvas(s.pages[0]);
      c0.annotations.counterMarkers = {
        'old-wc': [{ x: 50, y: 50, id: 'm1', group: null }, { x: 60, y: 60, id: 'm2', group: null }],
        'old-x': [{ x: 70, y: 70, id: 'm3', group: null }, { x: 80, y: 80, id: 'm4', group: null }],
      };
      c0.annotations.quickLines = [{ id: 'q1', x1: 10, y1: 10, x2: 90, y2: 90, lineTypeId: 'old-cu' }];
      const c1 = window.App.ensureActiveCanvas(s.pages[1]);
      c1.annotations.counterMarkers = { 'old-lav': [{ x: 40, y: 40, id: 'm5', group: null }] };
      window.App.updateUI();
    });

    // Stub the cloud artboard: same trade names, DIFFERENT ids; no Floor Sink.
    await page.evaluate(() => {
      window.App.fetchUserAirboard = async () => ({
        counters: [
          { id: 'new-wc', name: ' water closet ', icon: 'M0 0h24v24H0z', color: '#e8c547' },
          { id: 'new-lav', name: 'LAVATORY', icon: 'M0 0h24v24H0z', color: '#4a9eff' },
        ],
        lineTypes: [{ id: 'new-cu', name: 'copper', color: '#4a9eff', curveStyle: 'straight' }],
        iconNames: {},
        iconOrder: null,
        plumbingModifiers: null,
        lineModifiers: null,
        numberKeyBindings: {},
        customIconPaths: [],
      });
      document.getElementById('mySettingsLoadAirboard').click();
    });
    await page.waitForFunction(() => window.state.counters.some((c) => c.id === 'new-wc'));

    // The confirm stated the real numbers and the Unknown fallback.
    expect(dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('6 placed marks stay');
    expect(dialogs[0]).toContain('4 match by name');
    expect(dialogs[0]).toContain("2 marks don't match");
    expect(dialogs[0]).toContain('"Unknown" row');
    expect(dialogs[0]).toContain('Undo brings your current counters, lines, and counts back');

    const after = await page.evaluate(() => {
      const s = window.state;
      const a0 = window.App.getActiveAnnotations(s.pages[0]);
      const a1 = window.App.getActiveAnnotations(s.pages[1]);
      return {
        wcTally: (a0.counterMarkers['new-wc'] || []).length,
        lavTally: (a1.counterMarkers['new-lav'] || []).length,
        oldKeysGone: !a0.counterMarkers['old-wc'] && !a1.counterMarkers['old-lav'],
        lineTypeId: a0.quickLines[0]?.lineTypeId,
        unknownRow: s.counters.find((c) => c.id === 'old-x')?.name,
        unknownTally: (a0.counterMarkers['old-x'] || []).length,
        undoDisabled: document.getElementById('undoBtn').disabled,
      };
    });
    // (a) markers re-keyed to the NEW counter ids — tallies non-zero.
    expect(after.wcTally).toBe(2);
    expect(after.lavTally).toBe(1);
    expect(after.oldKeysGone).toBe(true);
    // (b) the quickLine's lineTypeId rewritten.
    expect(after.lineTypeId).toBe('new-cu');
    // (c) the unmatched counter's marks count under a visible "Unknown" row.
    expect(after.unknownRow).toBe('Unknown');
    expect(after.unknownTally).toBe(2);
    // (d) the undo snapshot was pushed — the undo button is enabled...
    expect(after.undoDisabled).toBe(false);
    // ...and Ctrl+Z restores the old palette AND the old marker keys.
    await page.keyboard.press('Control+z');
    const undone = await page.evaluate(() => {
      const s = window.state;
      const a0 = window.App.getActiveAnnotations(s.pages[0]);
      return {
        counterIds: s.counters.map((c) => c.id),
        wcTally: (a0.counterMarkers['old-wc'] || []).length,
        lineTypeId: a0.quickLines[0]?.lineTypeId,
      };
    });
    expect(undone.counterIds).toEqual(['old-wc', 'old-lav', 'old-x']);
    expect(undone.wcTally).toBe(2);
    expect(undone.lineTypeId).toBe('old-cu');

    // (e) no console/page errors.
    expect(errors).toEqual([]);
  });
});

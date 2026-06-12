// @ts-check
/**
 * Tests: the window.App registry pilot #13 - the Scale modal (scaleModal)
 * extracted to features/scale.js still wires up and applies a scale to the
 * current page from both the presets list and the custom-fraction Apply.
 *
 * First split to route geometry.js globals (ptDist, parseFraction,
 * parseRealWorldLength) and the SCALE_* constants through the registry, plus the
 * publish-only getActiveAnnotations; the rest were already on App. Guards the
 * registry contract (entry points + SCALE_PRESETS) and the two non-canvas apply
 * paths (preset + custom fraction). The two-point "Select on PDF" canvas flow is
 * out of scope (needs simulated canvas geometry).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Scale modal', () => {
  test('registry wired; preset + custom-fraction apply set page scale with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the two entry points + the published presets constant.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openScaleModal,
      reset: typeof window.App?.resetScaleModalZoneMode,
      presetsIsArray: Array.isArray(window.App?.SCALE_PRESETS),
    }));
    expect(wired).toEqual({ open: 'function', reset: 'function', presetsIsArray: true });

    // 3. Open via the registry; with no scale points it shows the presets tab.
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });

    // 4. PRESET: click the first preset; current page gains a scale + modal closes.
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(
      () => !document.getElementById('scaleModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const afterPreset = await page.evaluate(() => {
      const s = window.state.pages[window.state.currentPage].scale;
      return { hasScale: !!s, ppu: s?.pixelsPerUnit };
    });
    expect(afterPreset.hasScale).toBe(true);
    expect(typeof afterPreset.ppu).toBe('number');

    // 5. CUSTOM FRACTION: reopen, enter 1/4" = 4 ft, Apply; assert computed ppu.
    const expectedPpu = await page.evaluate(() => (window.App.parseFraction('1/4') * 72) / 4);
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    await page.locator('#scaleCustomFraction').fill('1/4');
    await page.locator('#scaleCustomFeet').fill('4');
    await page.locator('#scaleCustomApply').click();
    await page.waitForFunction(
      () => !document.getElementById('scaleModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const afterCustom = await page.evaluate(() => {
      const s = window.state.pages[window.state.currentPage].scale;
      return { ppu: s?.pixelsPerUnit, unit: s?.unit, label: s?.label };
    });
    expect(afterCustom.ppu).toBeCloseTo(expectedPpu, 6);
    expect(afterCustom.unit).toBe('ft');
    expect(afterCustom.label).toBe('1/4" = 4 ft');

    expect(errors).toEqual([]);
  });

  test('two-point flow: friendly info, no-quote unit-aware placeholder, inline value+unit, applies', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Simulate the two-point "Select on PDF" finish (151 pt apart), then open the modal.
    await page.evaluate(() => {
      window.state.scaleModalApplyTarget = null;
      window.state.scalePointA = { x: 0, y: 0 };
      window.state.scalePointB = { x: 151, y: 0 };
      window.App.openScaleModal();
    });
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });

    // Friendly info (no "pdf-pts" jargon) + the length input group is shown.
    const ui = await page.evaluate(() => ({
      lenShown: getComputedStyle(document.getElementById('scaleLengthInputGroup')).display !== 'none',
      info: document.getElementById('scaleInfo').textContent,
    }));
    expect(ui.lenShown).toBe(true);
    expect(ui.info).not.toContain('pdf-pts');
    expect(ui.info.toLowerCase()).toContain('real-world length');

    // Placeholder: no inch-mark, decimal-first, and updates with the unit.
    const ph = await page.evaluate(() => {
      const u = document.getElementById('scaleUnit'), v = document.getElementById('scaleValue');
      u.value = 'ft'; u.dispatchEvent(new Event('change')); const ft = v.placeholder;
      u.value = 'm'; u.dispatchEvent(new Event('change')); const m = v.placeholder;
      return { ft, m };
    });
    expect(ph.ft).not.toContain('"');
    expect(ph.ft).toContain('5.75');
    expect(ph.m).toBe('e.g. 1.75');

    // Value + unit sit on the same row (inline), unit to the right of the input.
    const inline = await page.evaluate(() => {
      const v = document.getElementById('scaleValue').getBoundingClientRect();
      const u = document.getElementById('scaleUnit').getBoundingClientRect();
      return u.left >= v.right - 4 && v.bottom > u.top && u.bottom > v.top;
    });
    expect(inline).toBe(true);

    // Set Scale applies pixelsPerUnit = 151 / 5.75, unit ft, modal closes.
    await page.evaluate(() => {
      const u = document.getElementById('scaleUnit'); u.value = 'ft'; u.dispatchEvent(new Event('change'));
      document.getElementById('scaleValue').value = '5.75';
      document.getElementById('scaleSet').click();
    });
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    const scale = await page.evaluate(() => window.state.pages[window.state.currentPage].scale);
    expect(scale.unit).toBe('ft');
    expect(scale.pixelsPerUnit).toBeCloseTo(151 / 5.75, 6);

    expect(errors).toEqual([]);
  });

  test('degenerate scale line (identical points) is rejected, not applied', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Two identical points -> the modal opens, but Set Scale must reject it.
    await page.evaluate(() => {
      window.state.scaleModalApplyTarget = null;
      window.state.scalePointA = { x: 50, y: 50 };
      window.state.scalePointB = { x: 50, y: 50 };
      window.App.openScaleModal();
    });
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    await page.evaluate(() => {
      document.getElementById('scaleValue').value = '10';
      document.getElementById('scaleSet').click();
    });
    // No scale applied + modal stays open (rejected with a toast).
    const after = await page.evaluate(() => ({
      scale: window.state.pages[window.state.currentPage].scale,
      modalOpen: document.getElementById('scaleModal').classList.contains('visible'),
    }));
    expect(after.scale == null).toBe(true);
    expect(after.modalOpen).toBe(true);

    // A distinct line still applies.
    await page.evaluate(() => {
      window.state.scalePointB = { x: 201, y: 50 };
      document.getElementById('scaleValue').value = '10';
      document.getElementById('scaleSet').click();
    });
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    const applied = await page.evaluate(() => window.state.pages[window.state.currentPage].scale);
    expect(applied.pixelsPerUnit).toBeCloseTo(151 / 10, 6);

    expect(errors).toEqual([]);
  });

  test('Escape while picking scale points clears the SCALE tool state (no stray crosshair)', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // "Select on PDF" mid-flow: SCALE tool active, first point placed, modal hidden.
    await page.evaluate(() => {
      window.state.tool = window.App.TOOL.SCALE;
      window.state.scaleMode = window.App.SCALE_MODES.POINT_B;
      window.state.scalePointA = { x: 10, y: 10 };
      window.state.scalePointB = null;
      window.App.hideModal('scaleModal');
    });
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    const s = await page.evaluate(() => ({
      tool: window.state.tool, none: window.App.TOOL.NONE,
      mode: window.state.scaleMode, modeNone: window.App.SCALE_MODES.NONE,
      a: window.state.scalePointA, b: window.state.scalePointB,
    }));
    expect(s.tool).toBe(s.none);
    expect(s.mode).toBe(s.modeNone);
    expect(s.a).toBeNull();
    expect(s.b).toBeNull();

    expect(errors).toEqual([]);
  });

  test('two-point scale stores a refLine; preset has none; checkbox toggles the view flag', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Two-point apply stores the segment on page.scale.refLine; default checkbox is on.
    await page.evaluate(() => {
      window.state.scaleModalApplyTarget = null;
      window.state.scalePointA = { x: 0, y: 0 };
      window.state.scalePointB = { x: 151, y: 0 };
      window.App.openScaleModal();
    });
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('scaleShowRefLine').checked)).toBe(true);
    await page.evaluate(() => { document.getElementById('scaleValue').value = '10'; document.getElementById('scaleSet').click(); });
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    expect(await page.evaluate(() => window.state.pages[window.state.currentPage].scale.refLine)).toEqual({ x1: 0, y1: 0, x2: 151, y2: 0 });

    // A preset scale replaces it and carries no refLine.
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    expect(await page.evaluate(() => window.state.pages[window.state.currentPage].scale.refLine)).toBeUndefined();

    // Re-set a two-point scale, then uncheck -> flag false + localStorage, geometry kept.
    await page.evaluate(() => {
      window.state.scalePointA = { x: 0, y: 0 };
      window.state.scalePointB = { x: 100, y: 0 };
      window.App.openScaleModal();
    });
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    await page.evaluate(() => { document.getElementById('scaleValue').value = '5'; document.getElementById('scaleSet').click(); });
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
    await page.evaluate(() => { const c = document.getElementById('scaleShowRefLine'); c.checked = false; c.dispatchEvent(new Event('change')); });
    const toggled = await page.evaluate(() => ({
      flag: window.state.showScaleRefLine,
      ls: localStorage.getItem('showScaleRefLine'),
      refStillThere: !!window.state.pages[window.state.currentPage].scale.refLine,
    }));
    expect(toggled.flag).toBe(false);
    expect(toggled.ls).toBe('false');
    expect(toggled.refStillThere).toBe(true);

    expect(errors).toEqual([]);
  });
});

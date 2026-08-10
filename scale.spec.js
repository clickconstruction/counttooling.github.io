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

  // T1-04: a corrected preset/custom apply hands off into the two-point verify (escapable).
  // The test PDF is a standard size, so stub the sheet analysis to put a correction in play
  // (same technique as scripts/build-screenshots.js). Restoring the original function brings
  // back today's plain-toast behavior.
  const stubNonStandardSheet = (page) => page.evaluate(() => {
    window.__origGetPageSheetAnalysis = window.App.getPageSheetAnalysis;
    window.App.getPageSheetAnalysis = () => ({
      widthPt: 1224, heightPt: 792, isStandard: false,
      bestGuessSheet: window.App.STANDARD_SHEETS.find(s => s.id === 'ANSI_D'),
    });
  });

  test('correction-in-play preset apply flows into the two-point verify; Esc keeps the applied scale', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await stubNonStandardSheet(page);
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });

    // The sheet warning shows with the best-guess sheet pre-selected.
    const warning = await page.evaluate(() => ({
      shown: getComputedStyle(document.getElementById('scaleSheetWarning')).display !== 'none',
      selected: document.getElementById('scaleSheetSelect').value,
    }));
    expect(warning.shown).toBe(true);
    expect(warning.selected).toBe('ANSI_D');

    // Preset apply: corrected scale lands AND the two-point verify is armed.
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    const afterApply = await page.evaluate(() => ({
      scale: window.state.pages[window.state.currentPage].scale,
      checkMode: window.state.scaleCheckMode,
      tool: window.state.tool,
      scaleTool: window.App.TOOL.SCALE,
    }));
    expect(afterApply.checkMode).toBe(true);
    expect(afterApply.tool).toBe(afterApply.scaleTool);
    expect(typeof afterApply.scale.correctionFactor).toBe('number');
    expect(afterApply.scale.sheetSize).toBe('ANSI_D');

    // Esc keeps the applied (corrected) scale and disarms the verify. (Wait out the coaching
    // toast first — the Escape ladder dismisses a visible toast before reaching the tool.)
    await page.waitForFunction(() => !document.getElementById('airboardToastModal')?.classList.contains('visible'), { timeout: 5000 });
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    const afterEsc = await page.evaluate(() => ({
      scale: window.state.pages[window.state.currentPage].scale,
      checkMode: window.state.scaleCheckMode,
      tool: window.state.tool,
      noneTool: window.App.TOOL.NONE,
    }));
    expect(afterEsc.tool).toBe(afterEsc.noneTool);
    expect(afterEsc.checkMode).toBe(false);
    expect(afterEsc.scale).toEqual(afterApply.scale);

    expect(errors).toEqual([]);
  });

  test('correction-in-play custom apply hands off; standard sheet keeps the plain toast', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Custom fraction + feet with a correction in play -> same hand-off.
    await stubNonStandardSheet(page);
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    await page.locator('#scaleCustomFraction').fill('1/4');
    await page.locator('#scaleCustomFeet').fill('4');
    // In-page click: with the sheet warning shown the modal can outgrow the viewport and
    // push the custom Apply off-screen (the Tier-1 #3 height-clamp issue, fixed separately).
    await page.evaluate(() => document.getElementById('scaleCustomApply').click());
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    const afterCustom = await page.evaluate(() => ({
      scale: window.state.pages[window.state.currentPage].scale,
      checkMode: window.state.scaleCheckMode,
      tool: window.state.tool,
      scaleTool: window.App.TOOL.SCALE,
    }));
    expect(afterCustom.checkMode).toBe(true);
    expect(afterCustom.tool).toBe(afterCustom.scaleTool);
    expect(typeof afterCustom.scale.correctionFactor).toBe('number');
    expect(afterCustom.scale.label).toContain('ANSI D');

    // Clear the armed verify (wait out the toast — Esc dismisses it first), un-stub -> a
    // standard-sheet preset apply keeps today's plain-toast behavior (no hand-off).
    await page.waitForFunction(() => !document.getElementById('airboardToastModal')?.classList.contains('visible'), { timeout: 5000 });
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await page.evaluate(() => { window.App.getPageSheetAnalysis = window.__origGetPageSheetAnalysis; });
    await page.evaluate(() => window.App.openScaleModal());
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('scaleSheetWarning')).display)).toBe('none');
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    const afterStandard = await page.evaluate(() => ({
      scale: window.state.pages[window.state.currentPage].scale,
      checkMode: window.state.scaleCheckMode,
      tool: window.state.tool,
      noneTool: window.App.TOOL.NONE,
    }));
    expect(afterStandard.checkMode).toBe(false);
    expect(afterStandard.tool).toBe(afterStandard.noneTool);
    expect(afterStandard.scale.correctionFactor).toBeUndefined();

    expect(errors).toEqual([]);
  });

  test('verify hand-off completes: Check shows the delta, Use measured recalibrates', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await stubNonStandardSheet(page);

    // Corrected preset apply -> hand-off armed. Wait out the coaching toast (it is a
    // full-screen click-swallowing overlay), then click the two verify points on the canvas
    // (>400ms apart for the double-tap guard).
    const handOff = async () => {
      await page.evaluate(() => window.App.openScaleModal());
      await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });
      await page.locator('#scalePresetsList button').first().click();
      await page.waitForFunction(() => window.state.scaleCheckMode === true, { timeout: 5000 });
      await page.waitForFunction(() => !document.getElementById('airboardToastModal')?.classList.contains('visible'), { timeout: 5000 });
      const box = await page.locator('#canvasWrapper').boundingBox();
      // Click points computed from the page geometry (the letter-size test page does not
      // fill the wrapper, so its center can sit outside the page bounds).
      const pts = await page.evaluate(() => {
        const p = window.state.pages[window.state.currentPage];
        const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
        const z = window.state.zoom, pan = window.state.pan;
        const y = (vp.height / 2) * z + pan.y;
        return [
          { x: vp.width * 0.25 * z + pan.x, y },
          { x: vp.width * 0.75 * z + pan.x, y },
        ];
      });
      await page.mouse.click(box.x + pts[0].x, box.y + pts[0].y);
      await page.waitForTimeout(450);
      await page.mouse.click(box.x + pts[1].x, box.y + pts[1].y);
      await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('scaleCheckPanel')).display)).not.toBe('none');
      await page.locator('#scaleCheckValue').fill('10');
      await page.locator('#scaleCheckBtn').click();
      await page.waitForFunction(() => getComputedStyle(document.getElementById('scaleCheckResult')).display !== 'none', { timeout: 5000 });
    };

    // Branch 1: Check, then "Keep current scale" leaves the corrected scale in place.
    await handOff();
    const corrected = await page.evaluate(() => window.state.pages[window.state.currentPage].scale);
    expect(typeof corrected.correctionFactor).toBe('number');
    expect(await page.locator('#scaleCheckCancel').textContent()).toBe('Keep current scale');
    await page.locator('#scaleCheckCancel').click();
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    const afterKeep = await page.evaluate(() => ({
      scale: window.state.pages[window.state.currentPage].scale,
      checkMode: window.state.scaleCheckMode,
    }));
    expect(afterKeep.scale).toEqual(corrected);
    expect(afterKeep.checkMode).toBe(false);

    // Branch 2: Check, then "Use measured" recalibrates (refLine stamped, correction gone).
    await handOff();
    const expectedPpu = await page.evaluate(() =>
      window.App.ptDist(window.state.scalePointA, window.state.scalePointB) / 10);
    await page.locator('#scaleCheckUseMeasured').click();
    await page.waitForFunction(() => !document.getElementById('scaleModal')?.classList.contains('visible'), { timeout: 5000 });
    const recal = await page.evaluate(() => ({
      scale: window.state.pages[window.state.currentPage].scale,
      checkMode: window.state.scaleCheckMode,
      tool: window.state.tool,
      noneTool: window.App.TOOL.NONE,
    }));
    expect(recal.scale.pixelsPerUnit).toBeCloseTo(expectedPpu, 6);
    expect(recal.scale.correctionFactor).toBeUndefined();
    expect(recal.scale.refLine).toBeTruthy();
    expect(recal.checkMode).toBe(false);
    expect(recal.tool).toBe(recal.noneTool);

    expect(errors).toEqual([]);
  });
});

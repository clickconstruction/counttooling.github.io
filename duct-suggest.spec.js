// @ts-check
/**
 * Tests: the design-build ductulator suggestion layer (DUCT-PLAN.md unit D6).
 *
 * - Counters gain an optional CFM (Create tab input); placed markers inherit
 *   it and feed the live suggestion: total system CFM minus what the trace
 *   has already passed (duct-model's ductDraftRemainingCfm attachment rule).
 * - The S popover's FIRST section is the pre-highlighted suggested size
 *   (order 5 via the D2 seam); one tap applies it through applyDuctSizeStep
 *   and records the step. Suggestions never auto-apply.
 * - No-CFM projects show no suggestion line and no popover section (the
 *   clean-absence rule).
 * - A velocity-capped suggestion NAMES the binding constraint
 *   ("velocity-limited") — DUCT-PLAN §5.
 * - The friction-rate / max-velocity knobs live on the Duct Schedule modal,
 *   write state.ductSettings, and ride export → import with the counter CFM
 *   (the per-project persistence round trip).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Duct design-build suggestions (D6)', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.state;
      s.pages[s.currentPage].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
  });

  // Create a counter through the real Create tab, with the D6 CFM input.
  async function createCfmCounter(page, name, cfm) {
    await page.locator('#counterBtn').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    // With existing counters the modal lands on Choose — hop to Create.
    const createPanelHidden = await page.locator('#counterCreatePanel').isHidden();
    if (createPanelHidden) await page.locator('#counterModal .counter-tab[data-tab="create"]').click();
    await page.locator('#counterName').fill(name);
    if (cfm != null) await page.locator('#counterCfm').fill(String(cfm));
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    return page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
  }

  // Arm a 24×12 supply run through the create modal (duct-tool.spec idiom).
  async function armDuct(page) {
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateW').fill('24');
    await page.locator('#ductCreateH').fill('12');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
  }

  const suggestion = (page) => page.evaluate(() => window.App.getDuctDraftSuggestion());

  test('CFM counter + trace: the suggestion carries the remaining CFM; the S popover applies it and records the step', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');

    // Two air devices: 150 CFM at (150,300) — ON the trace path — and 200 CFM
    // at (350,300), beyond the tip (unattached → still to serve).
    const c1 = await createCfmCounter(page, 'Diffuser 150', 150);
    expect(c1.cfm).toBe(150);
    await wrapper.click({ position: { x: 150, y: 300 } });
    const c2 = await createCfmCounter(page, 'Diffuser 200', 200);
    expect(c2.cfm).toBe(200);
    await wrapper.click({ position: { x: 350, y: 300 } });
    expect(await page.evaluate(() => {
      const ann = window.App.getMergedAnnotationsForPage(window.state.pages[0]);
      return Object.values(ann.counterMarkers).reduce((n, a) => n + a.length, 0);
    })).toBe(2);

    await armDuct(page);
    // One vertex: nothing passed yet — the whole 350 CFM is downstream.
    await wrapper.click({ position: { x: 100, y: 300 } });
    let sug = await suggestion(page);
    expect(sug).not.toBeNull();
    expect(Math.round(sug.cfm)).toBe(350);
    expect(sug.chipText).toContain('350 CFM downstream');
    expect(sug.chipText).toContain('— S accepts');
    expect(sug.chipText).toContain('@ 0.08″/100′');

    // The trace passes the 150-CFM device (it sits on the drawn polyline
    // strictly behind the tip): its air is subtracted, the 200 remains.
    await wrapper.click({ position: { x: 250, y: 300 } });
    sug = await suggestion(page);
    expect(Math.round(sug.cfm)).toBe(200);
    expect(sug.binding).toBe('friction');
    expect(sug.size.kind).toBe('rect');   // rect draft → rect equivalent offered

    // S popover: the suggestion is the FIRST section, pre-highlighted.
    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    const firstSection = page.locator('#ductSizeSections .duct-popover-section').first();
    expect(await firstSection.getAttribute('data-section-id')).toBe('ductulator-suggestion');
    const chip = page.locator('#ductSizeSections .duct-suggest-chip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText(sug.sizeLabel);
    await expect(chip).toContainText('from 200 CFM');
    expect(await chip.getAttribute('aria-label')).toContain('Suggested: ' + sug.sizeLabel + ' · from 200 CFM');

    // Nothing auto-applied so far — the draft still carries its armed size.
    expect(await page.evaluate(() => window.state.drawingDuct.segments.length)).toBe(1);

    // One tap accepts: the step lands through applyDuctSizeStep + is recorded.
    await chip.click();
    await expect(page.locator('#ductSizePopover')).toBeHidden();
    const st = await page.evaluate(() => ({
      segments: window.state.drawingDuct.segments,
      sizeSteps: window.state.drawingDuct.sizeSteps,
    }));
    expect(st.segments.length).toBe(2);
    expect(st.segments[1].size).toEqual(sug.size);
    expect(st.sizeSteps.length).toBe(1);
    expect(st.sizeSteps[0].to).toEqual(sug.size);
    expect(st.sizeSteps[0].from).toEqual({ kind: 'rect', w: 24, h: 12 });

    expect(errors).toEqual([]);
  });

  test('no CFM data → no suggestion line, no popover section (clean absence)', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    // A counter with NO cfm placed near the path must not create data.
    await createCfmCounter(page, 'Hose Bib', null);
    expect(await page.evaluate(() => 'cfm' in window.state.counters[0])).toBe(false);
    await wrapper.click({ position: { x: 150, y: 300 } });

    await armDuct(page);
    await wrapper.click({ position: { x: 100, y: 300 } });
    await wrapper.click({ position: { x: 250, y: 300 } });
    expect(await suggestion(page)).toBeNull();

    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    await expect(page.locator('#ductSizeSections [data-section-id="ductulator-suggestion"]')).toHaveCount(0);
    // The D2 sections are untouched.
    await expect(page.locator('#ductSizeSections [data-section-id="step-grid"]')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('velocity-capped suggestion names the binding constraint', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    // 400 fpm cap: at 200 CFM the velocity diameter (~9.6") beats the
    // friction answer (~7.9") — the cap governs and must be NAMED.
    await page.evaluate(() => { window.state.ductSettings.maxVelocityFpm = 400; });
    await createCfmCounter(page, 'Diffuser', 200);
    await wrapper.click({ position: { x: 350, y: 300 } });

    await armDuct(page);
    await wrapper.click({ position: { x: 100, y: 300 } });
    const sug = await suggestion(page);
    expect(sug.binding).toBe('velocity');
    expect(sug.chipText).toContain('velocity-limited');

    await page.keyboard.press('s');
    await expect(page.locator('#ductSizeSections .duct-suggest-chip')).toContainText('velocity-limited');

    expect(errors).toEqual([]);
  });

  test('friction/velocity knobs live on the Duct Schedule modal and write ductSettings', async ({ page }) => {
    expect(await page.evaluate(() => ({ ...window.state.ductSettings }))).toEqual({
      seamWastePct: 15, fittingFactorPct: 40, fittingMode: 'counted',
      frictionInPer100ft: 0.08, maxVelocityFpm: 1200,
    });
    await page.evaluate(() => window.App.openDuctScheduleModal());
    await expect(page.locator('#ductScheduleModal')).toHaveClass(/visible/);
    await expect(page.locator('#ductFrictionRate')).toHaveValue('0.08');
    await expect(page.locator('#ductMaxVelocity')).toHaveValue('1200');

    await page.locator('#ductFrictionRate').fill('0.1');
    await page.locator('#ductFrictionRate').dispatchEvent('change');
    await page.locator('#ductMaxVelocity').fill('900');
    await page.locator('#ductMaxVelocity').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.ductSettings.frictionInPer100ft)).toBe(0.1);
    expect(await page.evaluate(() => window.state.ductSettings.maxVelocityFpm)).toBe(900);

    // A nonsense value snaps back to the default, never to NaN.
    await page.locator('#ductFrictionRate').fill('');
    await page.locator('#ductFrictionRate').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.ductSettings.frictionInPer100ft)).toBe(0.08);

    expect(errors).toEqual([]);
  });

  test('round trip: counter CFM + design knobs ride export → import', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await createCfmCounter(page, 'Diffuser 150', 150);
    await wrapper.click({ position: { x: 150, y: 300 } });   // a mark, so export is enabled
    await page.evaluate(() => {
      window.state.ductSettings.frictionInPer100ft = 0.1;
      window.state.ductSettings.maxVelocityFpm = 900;
    });

    // Capture the REAL export payload (the anchor the button builds).
    const exported = await page.evaluate(() => {
      let captured = null;
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { captured = this.href; };
      try { document.getElementById('exportBtn').click(); }
      finally { HTMLAnchorElement.prototype.click = orig; }
      return captured ? decodeURIComponent(captured.replace('data:application/json,', '')) : null;
    });
    expect(exported).not.toBeNull();
    const data = JSON.parse(exported);
    expect(data.counters[0].cfm).toBe(150);
    expect(data.ductSettings.frictionInPer100ft).toBe(0.1);
    expect(data.ductSettings.maxVelocityFpm).toBe(900);

    // Fresh app → import through the real #importInput path.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.locator('#importInput').setInputFiles({ name: 'takeoff.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
    await page.waitForFunction(() => (window.state.counters || []).some((c) => c.cfm === 150));
    expect(await page.evaluate(() => window.state.ductSettings.frictionInPer100ft)).toBe(0.1);
    expect(await page.evaluate(() => window.state.ductSettings.maxVelocityFpm)).toBe(900);

    // And the details modal (per-counter settings surface) shows + edits it.
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters.find((c) => c.cfm === 150)));
    await expect(page.locator('#counterLineTypeDetailsCfmGroup')).toBeVisible();
    await expect(page.locator('#counterLineTypeDetailsCfm')).toHaveValue('150');
    await page.locator('#counterLineTypeDetailsCfm').fill('225');
    await page.locator('#counterLineTypeDetailsCfm').dispatchEvent('blur');
    expect(await page.evaluate(() => window.state.counters.find((c) => c.name === 'Diffuser 150').cfm)).toBe(225);
    // Clearing it removes the field — a non-air counter keeps its old shape.
    await page.locator('#counterLineTypeDetailsCfm').fill('');
    await page.locator('#counterLineTypeDetailsCfm').dispatchEvent('blur');
    expect(await page.evaluate(() => 'cfm' in window.state.counters.find((c) => c.name === 'Diffuser 150'))).toBe(false);

    expect(errors).toEqual([]);
  });
});

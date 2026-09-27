// @ts-check
/**
 * Tests: the design-build ductulator suggestion layer (DUCT-PLAN.md unit D6).
 *
 * - Counters gain an optional CFM (Create tab input); placed markers inherit
 *   it and feed the live suggestion: total system CFM minus what the trace
 *   has already passed (duct-model's ductDraftRemainingCfm attachment rule).
 * - The S popover's FIRST section is the pre-highlighted suggestion (order 5
 *   via the D2 seam) — D8: round-first DUAL chips ('10"Ø or 12×8', spiral
 *   first); one tap on either applies that size through applyDuctSizeStep
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

// D19: the CFM / Mount height / Flex drop fields now fold under the
// "More ▸ air & mounting" disclosure on the Counter modal, which starts CLOSED
// on a trade-less (plumbing-default) project like these fixtures. Unfold it
// before touching them — the same click the estimator makes.
const unfoldAirMore = (page, which) => page.evaluate((w) => {
  const id = w === 'quick' ? 'counterQuickCountAirMore' : 'counterAirMore';
  const fields = document.getElementById(id + 'Fields');
  if (fields && fields.hidden) document.getElementById(id + 'Toggle').click();
}, which);

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
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
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
    await unfoldAirMore(page);
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

  test('DUCT-HINT: the suggestion rides a card fixed above the footer, clear of the cursor; it leaves with the draft', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await createCfmCounter(page, 'Diffuser 150', 150);
    await wrapper.click({ position: { x: 150, y: 300 } });
    await armDuct(page);
    const card = page.locator('#ductHintCard');
    await expect(card).toBeHidden();   // armed, no vertex: nothing to say yet
    await wrapper.click({ position: { x: 100, y: 300 } });
    await expect(card).toBeVisible();
    await expect(card).toContainText('150 CFM downstream');
    await expect(card.locator('b')).toHaveText('150 CFM downstream');
    await expect(card.locator('kbd')).toHaveText('S');
    // Fixed inside the canvas above its bottom edge, well below the row being traced,
    // and never a click target.
    const [cb, wb] = await Promise.all([card.boundingBox(), wrapper.boundingBox()]);
    expect(cb.y + cb.height).toBeLessThanOrEqual(wb.y + wb.height);
    expect(cb.y).toBeGreaterThan(wb.y + 300 + 24);
    expect(Math.abs((cb.x + cb.width / 2) - (wb.x + wb.width / 2))).toBeLessThan(4);
    expect(await card.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    // Finishing the run takes the card with it.
    await wrapper.click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct);
    await expect(card).toBeHidden();
  });

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
    expect(sug.chipText).toContain('. S accepts');
    expect(sug.chipText).toContain('@ 0.08″/100′');

    // The trace passes the 150-CFM device (it sits on the drawn polyline
    // strictly behind the tip): its air is subtracted, the 200 remains.
    await wrapper.click({ position: { x: 250, y: 300 } });
    sug = await suggestion(page);
    expect(Math.round(sug.cfm)).toBe(200);
    expect(sug.binding).toBe('friction');
    // D8 round-first dual suggestion: the primary size is the SPIRAL answer,
    // the rect equivalent rides beside it, and the label carries both.
    expect(sug.size.kind).toBe('round');
    expect(sug.roundSize).toEqual(sug.size);
    expect(sug.rectSize.kind).toBe('rect');
    expect(sug.sizeLabel).toContain(' or ');
    expect(sug.chipText).toContain(sug.sizeLabel);

    // S popover: the suggestion is the FIRST section — two chips, round first.
    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    const firstSection = page.locator('#ductSizeSections .duct-popover-section').first();
    expect(await firstSection.getAttribute('data-section-id')).toBe('ductulator-suggestion');
    const chips = page.locator('#ductSizeSections .duct-suggest-chip');
    await expect(chips).toHaveCount(2);
    const roundLabel = await page.evaluate(() => window.formatDuctSize(window.App.getDuctDraftSuggestion().roundSize));
    await expect(chips.first()).toHaveText(roundLabel);
    expect(await chips.first().getAttribute('aria-label')).toContain('Suggested: ' + roundLabel + ' · from 200 CFM');
    await expect(page.locator('#ductSizeSections .duct-suggest-from')).toContainText('from 200 CFM');

    // Nothing auto-applied so far — the draft still carries its armed size.
    expect(await page.evaluate(() => window.state.drawingDuct.segments.length)).toBe(1);

    // One tap accepts: the step lands through applyDuctSizeStep + is recorded
    // (the ROUND chip here; duct-polish.spec.js covers the rect twin).
    await chips.first().click();
    await expect(page.locator('#ductSizePopover')).toBeHidden();
    const st = await page.evaluate(() => ({
      segments: window.state.drawingDuct.segments,
      sizeSteps: window.state.drawingDuct.sizeSteps,
    }));
    expect(st.segments.length).toBe(2);
    expect(st.segments[1].size).toEqual(sug.roundSize);
    expect(st.sizeSteps.length).toBe(1);
    expect(st.sizeSteps[0].to).toEqual(sug.roundSize);
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
    await expect(page.locator('#ductSizeSections .duct-suggest-from')).toContainText('velocity-limited');

    expect(errors).toEqual([]);
  });

  test('friction/velocity knobs live on the Duct Schedule modal and write ductSettings', async ({ page }) => {
    expect(await page.evaluate(() => ({ ...window.state.ductSettings }))).toEqual({
      seamWastePct: 15, fittingFactorPct: 40, fittingMode: 'counted',
      frictionInPer100ft: 0.08, maxVelocityFpm: 1200,
      deckHeightFt: null, maxFlexFt: 6, countVdPerTap: true,   // D8
      terminalAllowanceInWg: 0.1,   // D11
    });
    await page.evaluate(() => window.App.openDuctScheduleModal());
    await expect(page.locator('#ductScheduleModal')).toHaveClass(/visible/);
    await expect(page.locator('#ductFrictionRate')).toHaveValue('0.08');
    await expect(page.locator('#ductMaxVelocity')).toHaveValue('1200');
    await expect(page.locator('#ductTerminalAllowance')).toHaveValue('0.1');   // D11

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
    // D11: the terminal allowance (0 is a legal "none"; junk → the default).
    await page.locator('#ductTerminalAllowance').fill('0.15');
    await page.locator('#ductTerminalAllowance').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.ductSettings.terminalAllowanceInWg)).toBe(0.15);
    await page.locator('#ductTerminalAllowance').fill('0');
    await page.locator('#ductTerminalAllowance').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.ductSettings.terminalAllowanceInWg)).toBe(0);
    await page.locator('#ductTerminalAllowance').fill('');
    await page.locator('#ductTerminalAllowance').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.ductSettings.terminalAllowanceInWg)).toBe(0.1);

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
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
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

  // DS-DUCT-DOWNSTREAM, A6 (TESTER-DOSSIER-HVAC-2026-09-27.md "Not trade: for an agent"): the
  // dossier pushed branch runs straight into the annotations (no undo snapshot, no dirty) and
  // saw one gone after clicking Duct. Arming never drops a committed run, down that path too.
  test('arming Duct keeps every committed run, even ones pushed in without an undo snapshot', async ({ page }) => {
    const runCount = () => page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[0]).ductRuns || []).length);
    await page.evaluate(() => {
      const a = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      if (!a.ductRuns) a.ductRuns = [];
      [100, 140, 180].forEach((y) => a.ductRuns.push(window.makeDuctRun({
        name: 'Branch ' + y, vertices: [{ x: 100, y }, { x: 300, y }],
        segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 12, h: 8 } }],
      })));
    });
    expect(await runCount()).toBe(3);
    await armDuct(page);
    expect(await runCount()).toBe(3);
    // Re-pressing Duct mid-draft re-arms and keeps them too.
    await page.locator('#canvasWrapper').click({ position: { x: 100, y: 400 } });
    await page.locator('#ductBtn').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
    expect(await runCount()).toBe(3);
    expect(errors).toEqual([]);
  });
});

// DS-DUCT-DOWNSTREAM (TESTER-DOSSIER-HVAC-2026-09-27.md P1): the HVAC course's chapter 5, the
// main traced BEFORE the diffusers are hung (the chapter's order), on the real sheet. The
// SUGGESTED row at each printed size change reads the air still ahead of it, not the whole
// building minus the hall diffuser (it read 22"Ø or 26×16 from 2,550 CFM at every corner).
test.describe('Duct suggestion on the HVAC course main (DS-DUCT-DOWNSTREAM)', () => {
  test('chapter 5: the SUGGESTED row at the 20x12 change sizes 1,500 CFM, 18"Ø or 20×14', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/app/?chapter=hvac:main');
    await page.waitForFunction(() => window.App && window.App.startChapterHvac);
    await page.waitForFunction(() => window.App.tutorialStepId() === 'sheets', null, { timeout: 10000 });
    await page.click('#tourShow');
    await page.waitForFunction(() => window.App.tutorialStepId() !== 'sheets', null, { timeout: 25000 });
    await page.evaluate(() => window.App.tutorialGoTo('trace'));
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.evaluate(() => window.App.setDuctCreateSize({ kind: 'rect', w: 24, h: 12 }));
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);

    const at = (x, y) => page.evaluate(([px, py]) => window.App.commitDuctClick(window.App.lessonKit.P(px, py)), [x, y]);
    const sug = () => page.evaluate(() => { const s = window.App.getDuctDraftSuggestion(); return s && { cfm: Math.round(s.cfm), label: s.sizeLabel }; });
    await at(904, 328);
    await at(904, 282);
    await at(560, 282);
    // The 20x12 change: the dining room's 1,200 and the bar's 300 are ahead; the kitchen
    // (its tap at 572), the dish pit, the storage room and the hall diffuser are behind.
    expect(await sug()).toEqual({ cfm: 1500, label: '18"Ø or 20×14' });
    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    await expect(page.locator('#ductSizeSections [data-section-id="ductulator-suggestion"] .duct-suggest-from')).toContainText('from 1,500 CFM');
    await expect(page.locator('#ductSizeSections .duct-suggest-chip').first()).toHaveText('18"Ø');
    await page.keyboard.press('Escape');
    await expect(page.locator('#ductSizePopover')).toBeHidden();
    await page.evaluate(() => window.App.applyDuctSizeStep({ kind: 'rect', w: 20, h: 12 }));
    await at(420, 282);
    expect(await sug()).toEqual({ cfm: 1200, label: '16"Ø or 16×14' });   // the dining pair at 520 passed
    await page.evaluate(() => window.App.applyDuctSizeStep({ kind: 'rect', w: 16, h: 10 }));
    await at(300, 282);
    expect((await sug()).label).toBe('14"Ø or 14×12');   // the far dining room and the bar
    await page.evaluate(() => window.App.applyDuctSizeStep({ kind: 'rect', w: 12, h: 10 }));
    await at(180, 282);
    expect(await sug()).toBeNull();   // the far end: nothing left ahead
    await page.evaluate(() => window.App.finishDuctRun());
    await page.waitForFunction(() => !window.state.drawingDuct);
    expect(await page.evaluate(() => (window.App.getActiveAnnotations(window.state.pages[window.state.currentPage]).ductRuns || []).length)).toBe(1);
    expect(errors).toEqual([]);
  });
});

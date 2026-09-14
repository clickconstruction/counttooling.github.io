// @ts-check
/**
 * Tests: DUCT unit D20 — X3 scale re-edit in EDIT mode + J5-A draft parking
 * (journeys/plans/_TODO.md D20; _STAGE6.md X3 and "Re-rank inputs" J5-A).
 *
 * X3    The header Set Scale button no longer hides once a scale is set: it
 *       stays in a "set" state reading the value, and clicking it reopens the
 *       dialog on the tab that SET the scale with that value preloaded.
 * J5-A  A live polyline / quick-line draft is PARKED across the Set Scale
 *       modal and resumes when it closes, instead of surviving invisibly "in
 *       Move" with every following click dead.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const PDF = path.join(__dirname, 'test-2pages.pdf');

async function boot(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(PDF);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

const setScale = (page, scale) => page.evaluate((sc) => {
  window.state.pages[0].scale = sc;
  window.App.updateUI();
}, scale);

const openScale = async (page) => {
  await page.locator('#setScale').click();
  await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
};

test.describe('D20 — scale re-edit (X3) + draft parking (J5-A)', () => {
  /** @type {string[]} */
  let errors;
  test.beforeEach(async ({ page }) => { errors = []; await boot(page, errors); });
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('X3: the header button stays visible and reads the value once a scale is set', async ({ page }) => {
    // Unset: the button is there, in its "unset" state, no value.
    await expect(page.locator('#setScale')).toBeVisible();
    expect(await page.evaluate(() => document.getElementById('setScale').className)).toContain('scale-unset');
    await expect(page.locator('#setScale .set-scale-header-value')).toHaveCount(0);
    // Set: still visible — this is the bug X3 names — and reading the value.
    await setScale(page, { pixelsPerUnit: 18, unit: 'ft', label: '1/4" = 1\'' });
    await expect(page.locator('#setScale')).toBeVisible();
    expect(await page.evaluate(() => document.getElementById('setScale').className)).toContain('scale-set');
    await expect(page.locator('#setScale .set-scale-header-value')).toHaveText('1/4" = 1\'');
    await expect(page.locator('#setScale')).toHaveAttribute('title', /Scale: 1\/4" = 1' · 1 ft = 18\.0 px — click to edit/);
    // An unlabelled scale shows the px readout, which is all it has.
    await setScale(page, { pixelsPerUnit: 12.5, unit: 'ft' });
    await expect(page.locator('#setScale .set-scale-header-value')).toHaveText('1 ft = 12.5 px');
  });

  test('X3: a preset scale reopens on Presets with that preset marked', async ({ page }) => {
    await setScale(page, { pixelsPerUnit: 18, unit: 'ft', label: '1/4" = 1\'' });
    await openScale(page);
    await expect(page.locator('#scalePresetsPanel')).toBeVisible();
    await expect(page.locator('#scalePointsPanel')).toBeHidden();
    const selected = page.locator('#scalePresetsList button.selected');
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveText('1/4" = 1\'');
  });

  test('X3: a custom scale reopens with its own numbers back in the custom row', async ({ page }) => {
    await setScale(page, { pixelsPerUnit: 4.5, unit: 'ft', label: '3/32" = 1.5 ft' });
    await openScale(page);
    await expect(page.locator('#scalePresetsPanel')).toBeVisible();
    await expect(page.locator('#scaleCustomFraction')).toHaveValue('3/32');
    await expect(page.locator('#scaleCustomFeet')).toHaveValue('1.5');
    // It is custom, so no preset claims to be the current scale.
    await expect(page.locator('#scalePresetsList button.selected')).toHaveCount(0);
  });

  test('X3: a two-point scale reopens on the points tab offering a re-measure', async ({ page }) => {
    await setScale(page, {
      pixelsPerUnit: 20, unit: 'ft', label: null,
      refLine: [{ x: 10, y: 10 }, { x: 210, y: 10 }],
    });
    await openScale(page);
    await expect(page.locator('#scalePointsPanel')).toBeVisible();
    await expect(page.locator('#scalePresetsPanel')).toBeHidden();
    const info = await page.locator('#scaleInfo').textContent();
    expect(info).toContain('Set from two points');
    expect(info).toContain('20.0 px/ft');       // names the scale it would replace
    expect(info).toMatch(/Select on PDF/);      // the re-measure route
  });

  test('X3: an unset page is unchanged — Presets, nothing preselected', async ({ page }) => {
    await openScale(page);
    await expect(page.locator('#scalePresetsPanel')).toBeVisible();
    await expect(page.locator('#scalePresetsList button.selected')).toHaveCount(0);
  });

  test('J5-A: a polyline draft survives S → Cancel and commits normally after', async ({ page }) => {
    await setScale(page, { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1\'' });
    const wrapper = page.locator('#canvasWrapper');
    await page.evaluate(() => {
      window.state.lineTypes = [{ id: 'lt1', name: 'Pipe', color: '#4a9eff', curveStyle: 'straight' }];
      window.state.activeLineTypeId = 'lt1';
      window.App.updateUI();
    });
    await page.keyboard.press('p');
    await wrapper.click({ position: { x: 120, y: 200 } });
    await wrapper.click({ position: { x: 260, y: 200 } });
    const draftBefore = await page.evaluate(() => window.state.drawingPolyline?.points?.length || 0);
    expect(draftBefore).toBe(2);
    // Set Scale parks it: the tool drops and the draft leaves the live state.
    await openScale(page);
    expect(await page.evaluate(() => ({
      toolIsNone: window.state.tool === window.App.TOOL.NONE,
      live: window.state.drawingPolyline?.points?.length || 0,
      parked: window.state.parkedScaleDraft?.drawingPolyline?.points?.length || 0,
    }))).toMatchObject({ toolIsNone: true, live: 0, parked: 2 });
    // Cancel resumes it, tool and vertices intact.
    await page.locator('#scalePresetsCancel').click();
    await expect(page.locator('#scaleModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => ({
      tool: window.state.tool === window.App.TOOL.POLYLINE,
      live: window.state.drawingPolyline?.points?.length || 0,
      parked: window.state.parkedScaleDraft,
    }))).toMatchObject({ tool: true, live: 2, parked: null });
    // And it commits normally — the click is live again, not dead.
    await wrapper.click({ position: { x: 260, y: 320 } });
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return ann.polylines.length;
    })).toBe(1);
  });

  test('J5-A: a quick-line draft parks and resumes the same way', async ({ page }) => {
    await setScale(page, { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1\'' });
    const wrapper = page.locator('#canvasWrapper');
    await page.evaluate(() => {
      window.state.lineTypes = [{ id: 'lt1', name: 'Pipe', color: '#4a9eff', curveStyle: 'straight' }];
      window.state.activeLineTypeId = 'lt1';
      window.state.tool = window.App.TOOL.LINE;
      window.App.updateUI();
    });
    await wrapper.click({ position: { x: 100, y: 150 } });
    expect(await page.evaluate(() => !!window.state.quickLineStart)).toBe(true);
    await openScale(page);
    expect(await page.evaluate(() => ({
      live: !!window.state.quickLineStart,
      parked: !!window.state.parkedScaleDraft?.quickLineStart,
    }))).toMatchObject({ live: false, parked: true });
    await page.locator('#scalePresetsCancel').click();
    expect(await page.evaluate(() => ({
      live: !!window.state.quickLineStart,
      tool: window.state.tool === window.App.TOOL.LINE,
    }))).toMatchObject({ live: true, tool: true });
  });

  test('J5-A: arming something else inside the dialog wins — the park is dropped', async ({ page }) => {
    await setScale(page, { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1\'' });
    const wrapper = page.locator('#canvasWrapper');
    await page.evaluate(() => {
      window.state.lineTypes = [{ id: 'lt1', name: 'Pipe', color: '#4a9eff', curveStyle: 'straight' }];
      window.state.activeLineTypeId = 'lt1';
      window.App.updateUI();
    });
    await page.keyboard.press('p');
    await wrapper.click({ position: { x: 120, y: 200 } });
    await wrapper.click({ position: { x: 260, y: 200 } });
    await openScale(page);
    // The estimator arms a different tool from inside the dialog's lifetime.
    await page.evaluate(() => { window.state.tool = window.App.TOOL.COUNTER; });
    await page.locator('#scalePresetsCancel').click();
    // The parked draft is dropped, not forced back over the new hand.
    expect(await page.evaluate(() => ({
      tool: window.state.tool === window.App.TOOL.COUNTER,
      live: window.state.drawingPolyline?.points?.length || 0,
      parked: window.state.parkedScaleDraft,
    }))).toMatchObject({ tool: true, live: 0, parked: null });
  });

  test('J5-A: with no draft, Set Scale behaves exactly as before', async ({ page }) => {
    await openScale(page);
    expect(await page.evaluate(() => window.state.parkedScaleDraft)).toBeNull();
    await page.locator('#scalePresetsCancel').click();
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.NONE)).toBe(true);
  });
});

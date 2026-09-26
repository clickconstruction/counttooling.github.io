// @ts-check
/**
 * MAP-NOSUPA (DECOMPOSITION_MAP.md D16): the app with Supabase disabled.
 *
 * AGENTS.md: "Keep the app functional with Supabase disabled." The Hide marks eye
 * and both Project Settings doors (the desktop header gear, the phone sidebar-logo
 * gear) were bound only inside app.js's `if (SUPABASE_ENABLED)` block, and both
 * gears sat under `.supabase-only`, so with no cloud config the eye did nothing and
 * Project Settings (Close project, Add pages, Advanced: Export / Import / Canvas
 * Repair) had no door at all.
 *
 * The seam: the committed config.js is the only thing that sets SUPABASE_URL /
 * SUPABASE_ANON_KEY, so routing /config.js to an empty script boots the app exactly
 * as a deploy without cloud config would (SUPABASE_ENABLED is false). The spec's
 * stub config.local.js sets nothing either.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

function annHasInkFn() {
  const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
  if (!c || !c.width || !c.height) return false;
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
  return false;
}

async function bootWithoutSupabase(page, errors) {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.route('**/config.js', (route) => route.fulfill({ contentType: 'application/javascript', body: '// no cloud config: Supabase disabled\n' }));
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  expect(await page.evaluate(() => window.App.SUPABASE_ENABLED)).toBe(false);
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

// The rows that only mean something with the cloud: none may show with it off.
const CLOUD_ROWS = ['#settingsCheckoutSection', '#settingsShareProject', '#settingsReviewRow', '#settingsLoadProject', '#settingsManageProjects', '#settingsSaveProject', '#advancedGlobalForceReload'];

test.describe('Supabase disabled (MAP-NOSUPA)', () => {
  test('desktop: the Hide marks eye works and the header gear opens Project Settings with only local rows', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootWithoutSupabase(page, errors);

    // Hide marks: inject a counter, then the real click blanks the overlay.
    await page.evaluate(() => {
      const s = window.state;
      const uid = window.App.uid;
      const cid = uid();
      s.counters.push({ id: cid, name: 'Spec Counter', icon: 'M512 320C512 426 426 512 320 512C214 512 128 426 128 320C128 214 214 128 320 128C426 128 512 214 512 320z', color: '#e8c547', size: 16 });
      s.pages[0].canvases[0].annotations.counterMarkers[cid] = [{ x: 120, y: 140, id: uid(), group: null }, { x: 260, y: 240, id: uid(), group: null }];
      s.currentPage = 0;
      window.App.renderAnnotations();
    });
    expect(await page.evaluate(annHasInkFn)).toBe(true);
    await expect(page.locator('#hideMarksBtn')).toBeVisible();
    await page.locator('#hideMarksBtn').click();
    expect(await page.evaluate(() => window.state.hideMarks)).toBe(true);
    await expect(page.locator('#hideMarksBtn')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(annHasInkFn)).toBe(false);
    await page.locator('#hideMarksBtn').click();
    expect(await page.evaluate(() => window.state.hideMarks)).toBe(false);
    expect(await page.evaluate(annHasInkFn)).toBe(true);

    // Project Settings: the header gear shows and opens the modal.
    await expect(page.locator('#settingsGearBtn')).toBeVisible();
    await page.locator('#settingsGearBtn').click();
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/);
    for (const sel of CLOUD_ROWS) await expect(page.locator(sel), sel).toBeHidden();
    for (const sel of ['#settingsCloseProject', '#settingsAddAdditionalPages', '#settingsAdvancedBtn', '#settingsHelpToggle', '#settingsTradeRow']) {
      await expect(page.locator(sel), sel).toBeVisible();
    }

    // The local rows work: Help unfolds, Advanced opens, the × closes.
    await page.locator('#settingsHelpToggle').click();
    await expect(page.locator('#settingsHelpLinks')).toBeVisible();
    await page.locator('#settingsAdvancedBtn').click();
    await expect(page.locator('#settingsAdvancedSection')).toHaveJSProperty('open', true);
    await expect(page.locator('#advancedImport')).toBeVisible();
    await expect(page.locator('#advancedCanvasRepair')).toBeVisible();
    await page.locator('#settingsModalClose').click();
    await expect(page.locator('#settingsModal')).not.toHaveClass(/visible/);

    // Reopening folds Help again (openProjectSettings), and Close project closes
    // this local-only takeoff after the house confirm.
    await page.locator('#settingsGearBtn').click();
    await expect(page.locator('#settingsHelpLinks')).toBeHidden();
    await page.locator('#settingsCloseProject').click();
    await page.locator('#confirmOk').click();
    await expect.poll(() => page.evaluate(() => window.state.pages.length)).toBe(0);
    await expect(page.locator('#settingsModal')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });

  test('phone: the sidebar-logo gear shows and opens Project Settings; the cloud user icon stays hidden', async ({ page }) => {
    const errors = [];
    await page.setViewportSize({ width: 375, height: 812 });
    await bootWithoutSupabase(page, errors);
    await page.locator('#hamburger').click();
    await expect(page.locator('body')).toHaveClass(/sidebar-open/);
    await expect(page.locator('#sidebarLogoGear')).toBeVisible();
    await expect(page.locator('#sidebarLogoUser')).toBeHidden();
    await expect(page.locator('#sidebarLogoShare')).toBeHidden();
    await page.locator('#sidebarLogoGear').click();
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/);
    for (const sel of CLOUD_ROWS) await expect(page.locator(sel), sel).toBeHidden();
    await expect(page.locator('#settingsCloseProject')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('control, Supabase enabled: the phone sidebar logo still shows the user icon beside the gear', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    expect(await page.evaluate(() => window.App.SUPABASE_ENABLED)).toBe(true);
    await page.locator('#hamburger').click();
    await expect(page.locator('#sidebarLogoUser')).toBeVisible();
    await expect(page.locator('#sidebarLogoGear')).toBeVisible();
    await page.locator('#sidebarLogoGear').click();
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/);
  });
});

// @ts-check
/**
 * features/copy-project.js: the copy/fork domain + save-before-load gate,
 * split out of features/load-project.js at its documented domain boundary.
 *
 * Always-run: registry contract (seven registered names), the not-dirty path
 * (openCopyProjectModalOrPromptSave goes straight to #copyProjectModal with
 * the "(copy)" name prefilled), the dirty path (routes through
 * #saveBeforeLoadModal with the copy-specific message; Cancel clears the
 * pending project), and Discard routing back to the copy modal. The dirty
 * flag is stubbed through App.getAutoSaveDirty — the gate's own call-time
 * dependency. The fork/load cloud flows themselves are cloud-gated elsewhere
 * (load-project.spec.js, upload-then-save.spec.js).
 */
const { test, expect } = require('@playwright/test');

const PROJ = { id: 'proj-copy-spec', name: 'Bid A', pdf_path: 'u1/proj/document.pdf' };

async function bootApp(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
}

test.describe('Copy project & save-before-load gate (features/copy-project.js)', () => {
  test('registry wired: all seven names registered', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    const wired = await page.evaluate(() => ({
      openCopy: typeof window.App?.openCopyProjectModalOrPromptSave,
      openLoad: typeof window.App?.openLoadProjectModalOrPromptSave,
      hydrate: typeof window.App?.hydrateProjectFromCloudRow,
      resolvePdf: typeof window.App?.resolvePdfBufferForCloudProject,
      buildPages: typeof window.App?.buildPagesFromPdfArrayBufferAndProjectData,
      reset: typeof window.App?.resetCopyProjectState,
      clearTarget: typeof window.App?.clearCopyProjectModalTarget,
    }));
    expect(wired).toEqual({
      openCopy: 'function', openLoad: 'function', hydrate: 'function',
      resolvePdf: 'function', buildPages: 'function', reset: 'function', clearTarget: 'function',
    });
    expect(errors).toEqual([]);
  });

  test('not dirty: opens the copy modal with "(copy)" prefilled', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await page.evaluate((proj) => {
      window.App.getAutoSaveDirty = () => false;
      window.App.openCopyProjectModalOrPromptSave(proj);
    }, PROJ);
    await page.waitForSelector('#copyProjectModal.visible', { timeout: 5000 });
    await expect(page.locator('#copyProjectNameInput')).toHaveValue('Bid A (copy)');
    await expect(page.locator('#copyProjectModalConfirm')).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('dirty: routes through save-before-load with the copy message; Cancel clears pending', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await page.evaluate((proj) => {
      window.App.getAutoSaveDirty = () => true;
      window.App.openCopyProjectModalOrPromptSave(proj);
    }, PROJ);
    await page.waitForSelector('#saveBeforeLoadModal.visible', { timeout: 5000 });
    await expect(page.locator('#saveBeforeLoadModal p'))
      .toHaveText('You have unsaved changes. Save before copying another project?');

    await page.locator('#saveBeforeLoadCancel').click();
    await page.waitForFunction(
      () => !document.getElementById('saveBeforeLoadModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    // Pending cleared: Discard on a later (load-flavored) open must not route
    // to the copy modal.
    await page.evaluate(() => window.App.openLoadProjectModalOrPromptSave());
    await page.waitForSelector('#saveBeforeLoadModal.visible', { timeout: 5000 });
    await expect(page.locator('#saveBeforeLoadModal p'))
      .toHaveText('You have unsaved changes. Save before loading another project?');
    expect(errors).toEqual([]);
  });

  test('dirty + Discard: proceeds to the copy modal without saving', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await page.evaluate((proj) => {
      window.App.getAutoSaveDirty = () => true;
      window.App.openCopyProjectModalOrPromptSave(proj);
    }, PROJ);
    await page.waitForSelector('#saveBeforeLoadModal.visible', { timeout: 5000 });
    await page.locator('#saveBeforeLoadDiscard').click();
    await page.waitForSelector('#copyProjectModal.visible', { timeout: 5000 });
    await expect(page.locator('#copyProjectNameInput')).toHaveValue('Bid A (copy)');
    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Shared helpers for cloud tests (Load Project, etc.).
 * Ensures user is signed in and at least one project exists.
 */

/**
 * Ensures the test user is signed in and has at least one project.
 * Creates a project via Load test PDF + Save if none exist.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ ok: boolean; skipReason?: string }>}
 */
async function ensureSignedInWithProject(page) {
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/app/?devAuth=1');
    await page.waitForLoadState('networkidle');

    // Open Project Settings
    await page.evaluate(() => document.getElementById('sidebarLogoGear')?.click());
    await page.waitForSelector('#settingsModal.visible', { timeout: 5000 });

    // Load Project button is hidden when Supabase is disabled
    const loadProjectBtn = page.locator('#settingsLoadProject');
    if (!(await loadProjectBtn.isVisible())) {
      return { ok: false, skipReason: 'Supabase not configured; set SUPABASE_URL and SUPABASE_ANON_KEY in config or env' };
    }

    // Click Load Project to check if we have projects
    await loadProjectBtn.click();

  const authModal = page.locator('#authModal.visible');
  const loadProjectModal = page.locator('#loadProjectModal.visible');
  await Promise.race([
    authModal.waitFor({ state: 'visible', timeout: 3000 }),
    loadProjectModal.waitFor({ state: 'visible', timeout: 5000 }),
  ]);

  if (await authModal.isVisible()) {
    return { ok: false, skipReason: 'Dev auth not configured or failed; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD in config' };
  }

  const projectRows = page.locator('#loadProjectList .load-project-item');
  const count = await projectRows.count();
  if (count > 0) {
    // Already have projects; close modals and we're done
    await page.locator('#loadProjectCancel').click();
    return { ok: true };
  }

  // No projects - create one via Load test PDF + Save
  await page.locator('#loadProjectCancel').click();
  await page.waitForTimeout(300);

  // Reopen settings
  await page.evaluate(() => document.getElementById('sidebarLogoGear')?.click());
  await page.waitForSelector('#settingsModal.visible', { timeout: 3000 });

  // Advanced is a disclosure in Project Settings (2026-09-19; #settingsAdvancedModal is gone).
  await page.locator('#settingsAdvancedBtn').click();
  await page.waitForSelector('#advancedLoadTestPdf', { state: 'visible', timeout: 5000 });
  await page.locator('#advancedLoadTestPdf').click();

  // SPEC-DUPES: ONE save. Signed in, Prepare PDF's Save & open already creates the cloud
  // project, so the name goes in here; a second Save Project raced that insert (it keys on
  // state.currentProjectId, which is null until the first save lands) and left two rows per
  // setup, the first under the PDF's default name, identical on every run.
  await createNamedCloudProject(page, 'Test Project ' + Date.now());

  return { ok: true };
  } catch (e) {
    return { ok: false, skipReason: 'Setup failed: ' + (e?.message || String(e)) };
  }
}

/**
 * From the open Prepare PDF modal: name the project, Save & open, and wait for
 * the one cloud row to exist and sync (the project id, then the green dot).
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function createNamedCloudProject(page, name) {
  await page.waitForSelector('#preparePdfModal.visible', { timeout: 15000 });
  await page.locator('#preparePdfName').fill(name);
  await page.locator('#preparePdfSaveAndOpen').click();
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.waitForFunction(() => !!window.state.currentProjectId, null, { timeout: 30000 });
  await page.waitForSelector('#statusBarDot.dot-green', { timeout: 30000 });
}

module.exports = { ensureSignedInWithProject, createNamedCloudProject };

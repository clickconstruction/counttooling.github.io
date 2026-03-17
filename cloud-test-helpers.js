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
    await page.goto('/?devAuth=1');
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

  // Expand Advanced and click Load test PDF
  const advancedSection = page.locator('#settingsAdvancedSection');
  if (await advancedSection.evaluate((el) => el.classList.contains('collapsed'))) {
    await page.locator('#settingsAdvancedHeader').click();
    await page.waitForTimeout(200);
  }
  await page.locator('#settingsLoadTestPdf').click();

  // Wait for Prepare PDF modal and click Save and Open
  await page.waitForSelector('#preparePdfModal.visible', { timeout: 15000 });
  await page.locator('#preparePdfSaveAndOpen').click();

  // Wait for PDF to load (pages in sidebar)
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.waitForTimeout(500);

  // Open settings and Save Project to Cloud
  await page.evaluate(() => document.getElementById('sidebarLogoGear')?.click());
  await page.waitForSelector('#settingsModal.visible', { timeout: 3000 });
  await page.locator('#settingsSaveProject').click();

  // Save Project modal
  await page.waitForSelector('#saveProjectModal.visible', { timeout: 5000 });
  const projectName = 'Test Project ' + Date.now();
  await page.locator('#saveProjectName').fill(projectName);
  await page.locator('#saveProjectDo').click();

  // Wait for save to complete (modal closes, then status bar shows synced)
  await page.waitForSelector('#saveProjectModal:not(.visible)', { timeout: 3000 });
  await page.waitForSelector('#statusBarDot.dot-green', { timeout: 30000 });

  return { ok: true };
  } catch (e) {
    return { ok: false, skipReason: 'Setup failed: ' + (e?.message || String(e)) };
  }
}

module.exports = { ensureSignedInWithProject };

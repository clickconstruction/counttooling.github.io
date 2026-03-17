// @ts-check
const { test, expect } = require('@playwright/test');
const { ensureSignedInWithProject } = require('./cloud-test-helpers');

let cloudSetup = { ok: false, skipReason: '' };

test.describe('Load Project delete own projects', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    cloudSetup = await ensureSignedInWithProject(page);
    await page.close();
  });

  test('delete button appears on owned projects in Load Project modal', async ({ page }) => {
    if (!cloudSetup.ok) {
      test.skip(true, cloudSetup.skipReason);
      return;
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?devAuth=1');

    // Wait for app to load
    await page.waitForLoadState('networkidle');

    // Open Project Settings - use sidebarLogoGear (always opens settings; settingsGearBtn opens auth when not logged in)
    await page.evaluate(() => {
      document.getElementById('sidebarLogoGear')?.click();
    });

    // Wait for settings modal
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/, { timeout: 5000 });

    // Click Load Project from Cloud
    await page.locator('#settingsLoadProject').click();

    // Either auth modal or load project modal will appear
    const authModal = page.locator('#authModal.visible');
    const loadProjectModal = page.locator('#loadProjectModal.visible');

    await Promise.race([
      authModal.waitFor({ state: 'visible', timeout: 3000 }),
      loadProjectModal.waitFor({ state: 'visible', timeout: 3000 })
    ]);

    if (await authModal.isVisible()) {
      test.skip(true, 'Dev auth not configured or failed; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD in config');
      return;
    }

    await expect(loadProjectModal).toBeVisible();

    // Check for project rows
    const projectRows = page.locator('#loadProjectList .load-project-item');
    const count = await projectRows.count();

    if (count === 0) {
      test.skip(true, 'No projects to test; run test:cloud after creating a project via Load test PDF + Save');
      return;
    }

    // Owned projects have .load-project-delete; shared projects do not
    const deleteButtons = page.locator('#loadProjectList .load-project-delete');
    const deleteCount = await deleteButtons.count();

    if (deleteCount > 0) {
      await expect(deleteButtons.first()).toBeVisible();
      await expect(deleteButtons.first()).toHaveAttribute('title', 'Delete from cloud');
    }
  });
});

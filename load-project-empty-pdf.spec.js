// @ts-check
const { test, expect } = require('@playwright/test');
const { ensureSignedInWithProject } = require('./cloud-test-helpers');

let cloudSetup = { ok: false, skipReason: '' };

test.describe('Load Project with empty PDF in storage', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    cloudSetup = await ensureSignedInWithProject(page);
    await page.close();
  });

  test('empty PDF triggers upload prompt instead of error', async ({ page }) => {
    if (!cloudSetup.ok) {
      test.skip(true, cloudSetup.skipReason);
      return;
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?devAuth=1');
    await page.waitForLoadState('networkidle');

    // Intercept Supabase storage downloads and return 0-byte response
    await page.route('**/storage/v1/object/**', async (route) => {
      const url = route.request().url();
      if (url.includes('download') || url.includes('object/public')) {
        return route.fulfill({ status: 200, body: Buffer.from([]), headers: { 'Content-Type': 'application/pdf' } });
      }
      return route.continue();
    });

    // Open Project Settings then Load Project
    await page.evaluate(() => document.getElementById('sidebarLogoGear')?.click());
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/, { timeout: 5000 });
    await page.locator('#settingsLoadProject').click();

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

    const projectRows = page.locator('#loadProjectList .load-project-item');
    const count = await projectRows.count();
    if (count === 0) {
      test.skip(true, 'No projects to test; run test:cloud after creating a project via Load test PDF + Save');
      return;
    }

    // Click first project - storage download will be intercepted and return 0 bytes
    await projectRows.first().click();

    // Load Project modal should close
    await expect(page.locator('#loadProjectModal')).not.toHaveClass(/visible/, { timeout: 8000 });

    // Toast should show our message
    const toast = page.locator('#airboardToastModal.visible');
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#airboardToastText')).toContainText(/empty or missing|Upload your PDF/i);
  });
});

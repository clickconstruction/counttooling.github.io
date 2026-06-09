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

    // Start from clean local state so no cached PDF / last-project restore
    // interferes; the only PDF source then is the (intercepted) download.
    await page.addInitScript(() => {
      try { indexedDB.deleteDatabase('clickcount-pdf-cache'); } catch (_) {}
      try { localStorage.removeItem('clickcount-last-project'); } catch (_) {}
    });

    // Neutralize the actual Supabase storage PDF *download* (GET of the object)
    // so resolvePdfBufferForCloudProject sees a 0-byte blob. Leave info/sign/
    // list/upload calls alone so the rest of the load flow still works.
    await page.route('**/storage/v1/object/**', async (route) => {
      const req = route.request();
      const url = req.url();
      const isDownload = req.method() === 'GET'
        && /\/storage\/v1\/object\/(authenticated\/)?pdfs\//.test(url)
        && !url.includes('/info/');
      if (isDownload) {
        return route.fulfill({ status: 200, body: Buffer.from([]), headers: { 'Content-Type': 'application/pdf' } });
      }
      return route.continue();
    });

    await page.goto('/app/?devAuth=1');
    await page.waitForLoadState('networkidle');

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

    // Empty/missing PDF now opens the canvas-only "Choose PDF" modal (not a toast)
    const needsPdfModal = page.locator('#canvasOnlyNeedsPdfModal.visible');
    await expect(needsPdfModal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#canvasOnlyNeedsPdfTitle')).toContainText(/PDF is missing|annotations but no PDF/i);
    await expect(page.locator('#canvasOnlyNeedsPdfChoose')).toBeVisible();
  });
});

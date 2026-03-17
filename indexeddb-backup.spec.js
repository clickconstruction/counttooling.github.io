// @ts-check
/**
 * Tests for Full Canvas + PDF Backup to IndexedDB.
 * Requires Supabase + dev auth; run with: npm run test:indexeddb-backup
 */
const { test, expect } = require('@playwright/test');
const { ensureSignedInWithProject } = require('./cloud-test-helpers');

let cloudSetup = { ok: false, skipReason: '' };

async function loadProjectWithPdfAndAddCounter(page) {
  // Always create a fresh project via Load test PDF to ensure we have a PDF
  await page.evaluate(() => document.getElementById('sidebarLogoGear')?.click());
  await page.waitForSelector('#settingsModal.visible', { timeout: 5000 });

  const advancedSection = page.locator('#settingsAdvancedSection');
  if (await advancedSection.evaluate((el) => el.classList.contains('collapsed'))) {
    await page.locator('#settingsAdvancedHeader').click();
    await page.waitForTimeout(200);
  }
  await page.locator('#settingsLoadTestPdf').click();
  await page.waitForSelector('#preparePdfModal.visible', { timeout: 15000 });
  await page.locator('#preparePdfSaveAndOpen').click();
  await page.waitForSelector('body.has-pdf', { timeout: 15000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => document.getElementById('sidebarLogoGear')?.click());
  await page.waitForSelector('#settingsModal.visible', { timeout: 3000 });
  await page.locator('#settingsSaveProject').click();
  await page.waitForSelector('#saveProjectModal.visible', { timeout: 5000 });
  await page.locator('#saveProjectName').fill('IndexedDB Test ' + Date.now());
  await page.locator('#saveProjectDo').click();
  await expect(page.locator('#saveProjectModal')).not.toHaveClass(/visible/, { timeout: 5000 });
  await page.waitForSelector('#statusBarDot.dot-green', { timeout: 30000 });

  await page.waitForTimeout(500);

  // Add a counter: click Counter tool, create/choose one, place on canvas
  await page.locator('#counterBtn').click();
  await page.waitForSelector('#counterModal.visible', { timeout: 3000 });
  await page.waitForTimeout(300);

  const chooseCounterList = page.locator('#counterChooseList .sidebar-item');
  const createTab = page.locator('.counter-tab[data-tab="create"]');
  if ((await chooseCounterList.count()) > 0) {
    await chooseCounterList.first().click();
  } else {
    await createTab.click();
    await page.waitForSelector('#counterCreatePanel', { state: 'visible', timeout: 3000 });
    await page.locator('#counterName').fill('Test Counter');
    await page.locator('#counterCreate').click();
  }

  await expect(page.locator('#counterModal')).not.toHaveClass(/visible/, { timeout: 5000 });

  // Place counter on canvas (click center of PDF area)
  const canvasWrapper = page.locator('#canvasWrapper');
  await canvasWrapper.click({ position: { x: 200, y: 200 } });
  await page.waitForTimeout(300);

  return true;
}

test.describe('IndexedDB Backup', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    cloudSetup = await ensureSignedInWithProject(page);
    await page.close();
  });

  test('backup written when enabled (default)', async ({ page }) => {
    if (!cloudSetup.ok) {
      test.skip(true, cloudSetup.skipReason);
      return;
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?devAuth=1');
    await page.waitForLoadState('networkidle');

    const loaded = await loadProjectWithPdfAndAddCounter(page);
    if (!loaded) {
      test.skip(true, 'Could not load or create project');
      return;
    }

    await page.waitForTimeout(7000);

    const projectId = await page.evaluate(() => window.state?.currentProjectId);
    if (!projectId) {
      test.skip(true, 'No project loaded');
      return;
    }

    const backup = await page.evaluate(
      async (id) => {
        const fn = window.__takeoffBackupGetForTest;
        return typeof fn === 'function' ? await fn(id) : null;
      },
      projectId
    );

    expect(backup).not.toBeNull();
    expect(backup.data).toBeDefined();
  });

  test('backup disabled when BACKUP_PDF_TO_INDEXEDDB is false', async ({ page }) => {
    if (!cloudSetup.ok) {
      test.skip(true, cloudSetup.skipReason);
      return;
    }
    await page.addInitScript(() => {
      window.BACKUP_PDF_TO_INDEXEDDB = false;
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?devAuth=1');
    await page.waitForLoadState('networkidle');

    const loaded = await loadProjectWithPdfAndAddCounter(page);
    if (!loaded) {
      test.skip(true, 'Could not load or create project');
      return;
    }

    await page.waitForTimeout(7000);

    const projectId = await page.evaluate(() => window.state?.currentProjectId);
    if (!projectId) {
      test.skip(true, 'No project loaded');
      return;
    }

    const backup = await page.evaluate(
      async (id) => {
        const fn = window.__takeoffBackupGetForTest;
        return typeof fn === 'function' ? await fn(id) : null;
      },
      projectId
    );

    expect(backup).toBeNull();
  });

  test('last session restore uses Idb when newer', async ({ page }) => {
    if (!cloudSetup.ok) {
      test.skip(true, cloudSetup.skipReason);
      return;
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?devAuth=1');
    await page.waitForLoadState('networkidle');

    const loaded = await loadProjectWithPdfAndAddCounter(page);
    if (!loaded) {
      test.skip(true, 'Could not load or create project');
      return;
    }

    await page.waitForTimeout(7000);

    await page.reload();
    await page.waitForLoadState('networkidle');

    const lastSessionModal = page.locator('#lastSessionRestoreModal.visible');
    await expect(lastSessionModal).toBeVisible({ timeout: 10000 });

    await page.locator('#lastSessionRestoreKeep').click();
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/, { timeout: 15000 });

    // Restore loads PDF and annotations; wait for counters to appear
    await page.waitForFunction(
      () => (window.state?.counters?.length ?? 0) >= 1,
      { timeout: 15000 }
    );
    const count = await page.evaluate(() => window.state?.counters?.length ?? 0);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('Discard clears backup', async ({ page }) => {
    if (!cloudSetup.ok) {
      test.skip(true, cloudSetup.skipReason);
      return;
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?devAuth=1');
    await page.waitForLoadState('networkidle');

    const loaded = await loadProjectWithPdfAndAddCounter(page);
    if (!loaded) {
      test.skip(true, 'Could not load or create project');
      return;
    }

    await page.waitForTimeout(7000);

    const projectId = await page.evaluate(() => window.state?.currentProjectId);
    if (!projectId) {
      test.skip(true, 'No project loaded');
      return;
    }

    await page.reload();
    await page.waitForLoadState('networkidle');

    const lastSessionModal = page.locator('#lastSessionRestoreModal.visible');
    await expect(lastSessionModal).toBeVisible({ timeout: 10000 });

    await page.locator('#lastSessionRestoreDiscard').click();
    await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/, { timeout: 5000 });

    await page.waitForTimeout(500);

    const backup = await page.evaluate(
      async (id) => {
        const fn = window.__takeoffBackupGetForTest;
        return typeof fn === 'function' ? await fn(id) : null;
      },
      projectId
    );

    expect(backup).toBeNull();
  });
});

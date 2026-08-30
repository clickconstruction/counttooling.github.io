// @ts-check
/**
 * Tests: the signed-out save signal (Tier-3 B11, J12/J15). Signed out, the
 * status-bar mode line shows the local-save stamp the engine already tracks
 * ("Saved on this device · 4:42 PM", getLastLocalBackupAt in save-engine.js)
 * instead of the permanent dash; narrow bars (<1280px, B10's footer-words
 * threshold) compact the words to "Saved · 4:42 PM". The Save Status panel
 * tells the truth signed-out: green "Saved on this device: <time>" summary
 * rows plus the "Sign in to sync across devices." nudge line — never the
 * false "Not signed in to cloud" while an IDB backup exists. Signed-in
 * behavior is unchanged (the cloudMode branch never shows the stamp).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function bootWithPdf(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

test.describe('Signed-out save signal (B11)', () => {
  test('status bar shows the local stamp after a backup lands, and it tracks new backups', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootWithPdf(page);

    // The real path: dirty -> the engine's 1s debounce -> IDB backup -> stamp.
    await page.evaluate(() => window.App.markProjectDirty());
    await expect
      .poll(() => page.evaluate(() => window.App.getLastLocalBackupAt()), { timeout: 10000 })
      .not.toBeNull();
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).toContainText('Saved on this device ·');

    // The stamp follows the engine value: a later backup shows the new time.
    const shown = await page.evaluate(() => {
      const d = new Date(Date.now() - 3 * 60 * 60 * 1000); // a distinct clock reading
      window.App.setLastLocalBackupAt(d.toISOString());
      window.App.updateStatus();
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    });
    await expect(page.locator('#statusMode')).toContainText('Saved on this device · ' + shown);
  });

  test('narrow desktop bar compacts the words (B10 width pattern)', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await bootWithPdf(page);
    await page.evaluate(() => {
      window.App.setLastLocalBackupAt(new Date().toISOString());
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Saved ·');
    await expect(page.locator('#statusMode')).not.toContainText('Saved on this device');

    // Widening swaps the full words back in.
    await page.setViewportSize({ width: 1600, height: 800 });
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).toContainText('Saved on this device ·');
  });

  test('signed-in status bar is unchanged (no local stamp in the mode line)', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootWithPdf(page);
    await page.evaluate(() => {
      window.App.setLastLocalBackupAt(new Date().toISOString());
      window.state.supabaseSession = { user: { id: 'test-user', email: 'test@clickplumbing.com' } };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).not.toContainText('Saved on this device');
    // The cloudMode branch renders the Canvas label + dot titles as before.
    expect(await page.evaluate(() => document.getElementById('statusCanvasLabel').textContent)).toContain('Canvas');
    expect(await page.evaluate(() => document.getElementById('statusBarDot').title)).toContain('Canvas sync:');
  });

  test('Save Status panel signed-out: truthful copy with a local backup', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootWithPdf(page);
    await page.evaluate(() => {
      window.App.setLastLocalBackupAt(new Date().toISOString());
      window.App.openSaveStatusModal();
    });
    await page.waitForSelector('#saveStatusModal.visible', { timeout: 5000 });

    await expect(page.locator('#saveStatusSummaryCanvas .save-status-summary-body')).toContainText('Saved on this device');
    await expect(page.locator('#saveStatusSummaryPdf .save-status-summary-body')).toContainText('Saved on this device');
    expect(await page.evaluate(() =>
      document.querySelector('#saveStatusSummaryCanvas .save-status-summary-icon').className
    )).toContain('dot-green');
    await expect(page.locator('#saveStatusSignedOutHint')).toBeVisible();
    await expect(page.locator('#saveStatusSignedOutHint')).toHaveText('Sign in to sync across devices.');

    // Signed in, the nudge line hides and the cloud summary takes over.
    await page.evaluate(() => {
      window.state.supabaseSession = { user: { id: 'test-user', email: 'test@clickplumbing.com' } };
      window.App.renderSaveStatusModalContent();
    });
    await expect(page.locator('#saveStatusSignedOutHint')).toBeHidden();
    await expect(page.locator('#saveStatusSummaryCanvas .save-status-summary-body')).not.toContainText('Saved on this device');
  });

  test('Save Status panel signed-out with no backup yet keeps the old copy', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.App.openSaveStatusModal());
    await page.waitForSelector('#saveStatusModal.visible', { timeout: 5000 });
    await expect(page.locator('#saveStatusSummaryCanvas .save-status-summary-body')).toContainText('Not signed in to cloud');
    await expect(page.locator('#saveStatusSignedOutHint')).toBeVisible();
  });
});

// @ts-check
/**
 * Tests: User uploads PDF while NOT signed in, then signs in, then saves.
 * Bug hypothesis: state.pdfBuffer is never set when upload happens while signed out,
 * so save ends up "canvas only" without the PDF.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Upload PDF then sign in then save', () => {
  test('PDF should be included in save when uploaded before sign-in', async ({ page }) => {
    const pdfPath = path.join(__dirname, 'test-2pages.pdf');

    // 1. Open app WITHOUT devAuth (user not signed in)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 2. Upload PDF while not signed in
    const fileInput = page.locator('#pdfInput');
    await fileInput.setInputFiles(pdfPath);

    // Wait for PDF to load
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    const pageCount = await page.locator('#pagesList .sidebar-item').count();
    expect(pageCount).toBeGreaterThanOrEqual(1);

    // 3. Sign in WITHOUT reload (so state.pdfBuffer is preserved) - open auth modal via JS (elements may be hidden)
    await page.evaluate(() => {
      const el = document.getElementById('statusBarAuth') || document.getElementById('authBtn');
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForSelector('#authModal.visible', { timeout: 5000 });
    const devAuthBtn = page.locator('#authDevBypass');
    if (!(await devAuthBtn.isVisible())) {
      test.skip(true, 'Dev auth not configured; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD');
      return;
    }
    await devAuthBtn.click();
    await page.waitForTimeout(2000);

    // 4. Open Project Settings and Save Project (gear opens settings; if still on auth, we may need to close it)
    await page.evaluate(() => document.getElementById('sidebarLogoGear')?.click());
    await page.waitForSelector('#settingsModal.visible', { timeout: 5000 });

    // Load Project button visible means Supabase + signed in
    const loadProjectBtn = page.locator('#settingsLoadProject');
    if (!(await loadProjectBtn.isVisible())) {
      test.skip(true, 'Supabase or dev auth not configured');
      return;
    }

    await page.locator('#settingsSaveProject').click();

    // 5. Save modal should open
    await page.waitForSelector('#saveProjectModal.visible', { timeout: 5000 });

    // 6. Check: Save modal should show PDF (not "Canvas only")
    const noPdfMessage = page.locator('#saveProjectNoPdfMessage');
    const includePdfLabel = page.locator('#saveProjectIncludePdfLabel');

    const noPdfVisible = await noPdfMessage.isVisible();
    const includePdfVisible = await includePdfLabel.isVisible();

    // BUG: If pdfBuffer was never set, we show "Canvas only" (noPdfMessage)
    // and the Include PDF toggle is hidden
    expect(noPdfVisible).toBe(false);
    expect(includePdfVisible).toBe(true);
  });
});

// @ts-check
/**
 * Tests: the window.App registry pilot #20 - the admin user-management modals
 * extracted to features/user-admin.js.
 *
 * The full list/create/delete-user flow is admin + Supabase-gated, so the
 * always-run test only guards the registry contract (the entry points are
 * functions, and opening with no session is a safe no-op). A second, cloud-gated
 * test (skipped without cloud secrets) exercises the real list render.
 */
const { test, expect } = require('@playwright/test');
const { ensureSignedInWithProject } = require('./cloud-test-helpers');

test.describe('window.App registry pilot - admin Manage-Users modals', () => {
  test('registry wired; opening without a session is a safe no-op', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const wired = await page.evaluate(() => ({
      manage: typeof window.App?.openManageUserModal,
      all: typeof window.App?.openAllUsersModal,
    }));
    expect(wired).toEqual({ manage: 'function', all: 'function' });

    // Not signed in -> both early-return; the modals stay hidden.
    await page.evaluate(() => { window.App.openManageUserModal(); window.App.openAllUsersModal(); });
    await page.waitForTimeout(200);
    const visible = await page.evaluate(() => ({
      manage: document.getElementById('manageUserModal')?.classList.contains('visible'),
      all: document.getElementById('allUsersModal')?.classList.contains('visible'),
    }));
    expect(visible).toEqual({ manage: false, all: false });

    expect(errors).toEqual([]);
  });

  test.describe('cloud-gated full flow', () => {
    let cloudSetup = { ok: false, skipReason: '' };
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      cloudSetup = await ensureSignedInWithProject(page);
      await page.close();
    });

    test('opens the manage-user list via the registry when signed in', async ({ page }) => {
      if (!cloudSetup.ok) { test.skip(true, cloudSetup.skipReason); return; }
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => { errors.push(err.message); });

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/app/?devAuth=1');
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => !!window.state?.supabaseSession?.access_token, { timeout: 10000 });

      await page.evaluate(() => window.App.openManageUserModal());
      await expect(page.locator('#manageUserModal')).toHaveClass(/visible/, { timeout: 5000 });

      // The list resolves to user rows, a "No users" message, or an admin-only
      // error (non-admin) - in all cases the list element gets content.
      await page.waitForFunction(
        () => (document.getElementById('manageUserList')?.textContent || '').replace(/Loading…/, '').trim().length > 0,
        { timeout: 10000 },
      );

      expect(errors).toEqual([]);
    });
  });
});

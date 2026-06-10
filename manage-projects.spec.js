// @ts-check
/**
 * Tests: the window.App registry pilot #19 - the admin Manage Projects modal
 * extracted to features/manage-projects.js.
 *
 * The full list/delete/force-turn-in flow is admin + Supabase-gated, so the
 * always-run test only guards the registry contract (the entry point is a
 * function, and opening with no session is a safe no-op). A second, cloud-gated
 * test (skipped without cloud secrets) exercises the real list + Delete render.
 */
const { test, expect } = require('@playwright/test');
const { ensureSignedInWithProject } = require('./cloud-test-helpers');

test.describe('window.App registry pilot - Manage Projects modal', () => {
  test('registry wired; opening without a session is a safe no-op', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => typeof window.App?.openManageProjectsModal)).toBe('function');

    // Not signed in -> openManageProjectsModal early-returns; modal stays hidden.
    await page.evaluate(() => window.App.openManageProjectsModal());
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.getElementById('manageProjectsModal')?.classList.contains('visible'))).toBe(false);

    expect(errors).toEqual([]);
  });

  test.describe('cloud-gated full flow', () => {
    let cloudSetup = { ok: false, skipReason: '' };
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      cloudSetup = await ensureSignedInWithProject(page);
      await page.close();
    });

    test('opens via the registry and renders its list when signed in', async ({ page }) => {
      if (!cloudSetup.ok) { test.skip(true, cloudSetup.skipReason); return; }
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => { errors.push(err.message); });

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/app/?devAuth=1');
      await page.waitForLoadState('networkidle');
      // Wait for the session to settle so openManageProjectsModal passes its gate.
      await page.waitForFunction(() => !!window.state?.supabaseSession?.access_token, { timeout: 10000 });

      // Open via the registry (the #settingsManageProjects opener is admin-gated UI).
      await page.evaluate(() => window.App.openManageProjectsModal());
      await expect(page.locator('#manageProjectsModal')).toHaveClass(/visible/, { timeout: 5000 });

      // The list resolves to rows, a "No projects" message, or an admin-only error
      // (non-admin accounts) - in all cases the list element gets content and the
      // modal stays up. A seeded admin sees a Delete button.
      await page.waitForFunction(
        () => (document.getElementById('manageProjectsList')?.textContent || '').replace(/Loading…/, '').trim().length > 0,
        { timeout: 10000 },
      );
      const rows = await page.locator('#manageProjectsList .settings-user-row').count();
      if (rows > 0) {
        await expect(page.locator('#manageProjectsList .settings-user-delete').first()).toBeVisible();
      }

      expect(errors).toEqual([]);
    });
  });
});

// @ts-check
/**
 * Tests: the window.App registry pilot #19 - the admin Manage Projects modal
 * extracted to features/manage-projects.js.
 *
 * The full list/delete/force-turn-in flow is admin + Supabase-gated, so the
 * always-run test only guards the registry contract (the entry point is a
 * function, and opening with no session is a safe no-op). A second, cloud-gated
 * test (skipped without cloud secrets) exercises the real list + Delete render.
 * R1-ADMIN (2026-09-27): an always-run test routes the list_projects_for_admin
 * fetch and stubs App.getSupabase() / App.tryTurnIn, and pins that the row for
 * the project open and checked out in this tab offers the normal "Turn in"
 * (App.tryTurnIn, no force RPC) while every other checked-out row keeps
 * "Force turn-in".
 */
const { test, expect } = require('@playwright/test');
const { ensureSignedInWithProject } = require('./cloud-test-helpers');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

test.describe('window.App registry pilot - Manage Projects modal', () => {
  test('registry wired; opening without a session is a safe no-op', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });

    expect(await page.evaluate(() => typeof window.App?.openManageProjectsModal)).toBe('function');

    // Not signed in -> openManageProjectsModal early-returns; modal stays hidden.
    await page.evaluate(() => window.App.openManageProjectsModal());
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.getElementById('manageProjectsModal')?.classList.contains('visible'))).toBe(false);

    expect(errors).toEqual([]);
  });

  test('R1-ADMIN: your own open, checked-out project offers Turn in (the normal one), every other held row keeps the admin force', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    let listFetches = 0;
    await page.route('**/rest/v1/rpc/list_projects_for_admin', async (route) => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
      listFetches++;
      const rows = [
        { id: 'p-open', name: 'Open here', owner_email: 'admin@clickplumbing.com', checked_out_by: 'u-admin', checked_out_email: 'admin@clickplumbing.com' },
        { id: 'p-other', name: 'Someone else', owner_email: 'est@clickplumbing.com', checked_out_by: 'u-est', checked_out_email: 'est@clickplumbing.com' },
        { id: 'p-mine-elsewhere', name: 'Mine, not open', owner_email: 'admin@clickplumbing.com', checked_out_by: 'u-admin', checked_out_email: 'admin@clickplumbing.com' },
        { id: 'p-free', name: 'Free', owner_email: 'admin@clickplumbing.com', checked_out_by: null, checked_out_email: null },
      ];
      await route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
    });

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    expect(await page.evaluate(() => typeof window.App?.tryTurnIn)).toBe('function');

    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.__rpcCalls = [];
      w.__turnIns = [];
      w.App.getSupabase = () => ({
        rpc: (name, args) => { w.__rpcCalls.push({ name, args }); return Promise.resolve({ data: { ok: true }, error: null }); },
      });
      // The header's Turn In, stubbed: this test pins which routine the row calls.
      w.App.tryTurnIn = async (opts) => { w.__turnIns.push(opts); return { ok: true }; };
      const st = w.App.state;
      st.supabaseSession = { user: { id: 'u-admin', email: 'admin@clickplumbing.com' }, access_token: 'spec-token' };
      st.isAdmin = true;
      st.currentProjectId = 'p-open';
      st.checkedOutBy = 'u-admin';
      st.isViewer = false;
    });

    const openList = async () => {
      await page.evaluate(() => window.App.openManageProjectsModal());
      await expect(page.locator('#manageProjectsModal')).toHaveClass(/visible/, { timeout: 5000 });
      await expect(page.locator('#manageProjectsList .settings-project-row')).toHaveCount(4, { timeout: 5000 });
    };
    const rowBtn = (id) => page.locator('#manageProjectsList .settings-project-row[data-project-id="' + id + '"] .settings-project-force-checkin');

    await openList();
    await expect(rowBtn('p-open')).toHaveText('Turn in');
    await expect(rowBtn('p-other')).toHaveText('Force turn-in');
    await expect(rowBtn('p-mine-elsewhere')).toHaveText('Force turn-in');
    await expect(rowBtn('p-free')).toHaveCount(0);

    // Turn in = the normal Turn In, never the force RPC; the list redraws after.
    const fetchesBefore = listFetches;
    await rowBtn('p-open').click();
    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__turnIns.length)).toBe(1);
    await expect.poll(() => listFetches).toBeGreaterThan(fetchesBefore);
    expect(await page.evaluate(() => /** @type {any} */ (window).__rpcCalls.map((c) => c.name))).toEqual([]);

    // Another holder's row still forces.
    await rowBtn('p-other').click();
    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__rpcCalls)).toEqual([{ name: 'force_check_in_project', args: { p_project_id: 'p-other' } }]);
    expect(await page.evaluate(() => /** @type {any} */ (window).__turnIns.length)).toBe(1);

    // Open here but NOT held by this tab (viewing only): the admin force, as before.
    await page.evaluate(() => { const st = /** @type {any} */ (window).App.state; st.isViewer = true; st.checkedOutBy = null; });
    await openList();
    await expect(rowBtn('p-open')).toHaveText('Force turn-in');

    await page.evaluate(() => { const st = /** @type {any} */ (window).App.state; st.supabaseSession = null; st.isAdmin = false; st.currentProjectId = null; });
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
      await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
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

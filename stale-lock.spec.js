// @ts-check
/**
 * STALE-LOCK (2026-10-02): an expired checkout reads as free, never as live.
 *
 * The server never clears a checkout; it stops honouring one whose stamp is
 * older than CHECKOUT_INACTIVITY_MS, and the row keeps its last holder's name.
 * Wendi's Save Status export showed a lock stamped 50.8 hours earlier still
 * read "grace@clickplumbing.com is editing" on every surface, because each
 * rendered checked_out_email without asking checked_out_at. Every surface
 * that names a holder now asks App.isCheckoutLockLive / App.checkoutHolderText.
 *
 * Always-run: the session is seeded on App.state and the two list RPCs are
 * stubbed on App.getSupabase, so no cloud is touched. The viewer has NO
 * checkout arm (can_check_out false, like an overseer or a viewer share), the
 * case in which "Available" was unreachable before.
 */
const { test, expect } = require('@playwright/test');
const { collectConsoleErrors, bootApp, uploadPdf } = require('./spec-helpers');

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;

async function seedViewerOn(page, { checkedOutAt }) {
  await page.evaluate(({ at }) => {
    const w = /** @type {any} */ (window);
    const st = w.App.state;
    st.supabaseSession = { user: { id: 'u-wendi', email: 'wendi@clickplumbing.com' }, access_token: 'spec-token' };
    st.isAdmin = false;
    st.currentProjectId = 'p-lone-star';
    st.currentProjectName = 'Lone Star Market';
    st.isViewer = true;
    st.canCheckOut = false;
    st.checkedOutBy = 'u-grace';
    st.checkedOutEmail = 'grace@clickplumbing.com';
    st.checkedOutAt = at;
    w.App.updateUI();
    w.App.updateStatus();
    w.App.updateSettingsCheckoutSection();
  }, { at: checkedOutAt });
}

test.describe('STALE-LOCK: an expired checkout reads as Available', () => {
  test('the header, the status bar and Project Settings name a live holder, and call an expired one Available', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    expect(await page.evaluate(() => typeof window.App?.isCheckoutLockLive)).toBe('function');
    // The status bar reaches its viewer branch only with a sheet open.
    await uploadPdf(page);

    // Live: stamped five minutes ago.
    await seedViewerOn(page, { checkedOutAt: new Date(Date.now() - FIVE_MIN_MS).toISOString() });
    await expect(page.locator('#headerEditStatusBanner')).toHaveText('grace@clickplumbing.com is editing');
    await expect(page.locator('#headerEditStatusBanner')).toHaveClass(/edit-status-viewing/);
    expect(await page.evaluate(() => document.getElementById('settingsCheckoutStatus')?.textContent)).toBe('grace@clickplumbing.com is editing');
    expect(await page.evaluate(() => document.getElementById('settingsCheckoutDot')?.className)).toMatch(/dot-yellow/);
    expect(await page.evaluate(() => document.body.textContent)).toContain('Viewing, grace@clickplumbing.com is editing');

    // Expired: Wendi's case, two days old. Same role, same row shape.
    await seedViewerOn(page, { checkedOutAt: new Date(Date.now() - TWO_DAYS_MS).toISOString() });
    await expect(page.locator('#headerEditStatusBanner')).toHaveText('Available · last edited by grace@clickplumbing.com, 2d ago');
    await expect(page.locator('#headerEditStatusBanner')).toHaveClass(/edit-status-available/);
    expect(await page.evaluate(() => document.getElementById('settingsCheckoutStatus')?.textContent)).toBe('Available · last edited by grace@clickplumbing.com, 2d ago');
    expect(await page.evaluate(() => document.getElementById('settingsCheckoutDot')?.className)).toMatch(/dot-grey/);
    const body = await page.evaluate(() => document.body.textContent || '');
    expect(body).toContain('Viewing, Available · last edited by grace@clickplumbing.com, 2d ago');
    expect(body).not.toContain('is editing');

    errors.assertNoErrors();
  });

  test('Load Project: Available before Locked by, and an expired lock is Available with its last editor', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await page.evaluate(({ twoDays, fiveMin }) => {
      const w = /** @type {any} */ (window);
      const st = w.App.state;
      st.supabaseSession = { user: { id: 'u-wendi', email: 'wendi@clickplumbing.com' }, access_token: 'spec-token' };
      const rows = [
        // The owner's own project whose lock expired: before STALE-LOCK this row read "Locked by" because
        // the email rung was tested before the available rung.
        { id: 'p-own-stale', name: 'Own, expired', user_id: 'u-wendi', is_owner: true, can_edit: false, can_check_out: true, checked_out_by: 'u-wendi', checked_out_email: 'wendi@clickplumbing.com', checked_out_at: new Date(Date.now() - twoDays).toISOString(), updated_at: new Date().toISOString(), pdf_path: 'x.pdf', my_access_role: 'owner' },
        // A viewer share on a live lock.
        { id: 'p-live', name: 'Live lock', user_id: 'u-grace', is_owner: false, can_edit: false, can_check_out: false, checked_out_by: 'u-grace', checked_out_email: 'grace@clickplumbing.com', checked_out_at: new Date(Date.now() - fiveMin).toISOString(), updated_at: new Date().toISOString(), pdf_path: 'x.pdf', my_access_role: 'viewer' },
        // A viewer share on Wendi's two-day-old lock.
        { id: 'p-stale', name: 'Lone Star Market', user_id: 'u-grace', is_owner: false, can_edit: false, can_check_out: false, checked_out_by: 'u-grace', checked_out_email: 'grace@clickplumbing.com', checked_out_at: new Date(Date.now() - twoDays).toISOString(), updated_at: new Date().toISOString(), pdf_path: 'x.pdf', my_access_role: 'viewer' },
      ];
      w.App.getSupabase = () => ({
        rpc: async (name) => name === 'list_accessible_projects' ? { data: rows, error: null } : { data: [], error: null },
        storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
      });
      w.App.updateUI();
    }, { twoDays: TWO_DAYS_MS, fiveMin: FIVE_MIN_MS });

    await page.evaluate(() => window.App.openLoadProjectModal());
    await expect(page.locator('#loadProjectModal')).toHaveClass(/visible/, { timeout: 5000 });
    const row = (name) => page.locator('#loadProjectList .load-project-item', { hasText: name });
    await expect(row('Own, expired').locator('.badge', { hasText: 'Available' })).toHaveCount(1);
    await expect(row('Own, expired')).not.toContainText('Locked by');
    await expect(row('Live lock')).toContainText('Locked by grace@clickplumbing.com');
    await expect(row('Lone Star Market')).toContainText('Available · last edited by grace@clickplumbing.com, 2d ago');
    await expect(row('Lone Star Market')).not.toContainText('Locked by');

    errors.assertNoErrors();
  });

  test('Manage Projects: an expired lock is named as expired; the admin force still clears it', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await page.route('**/rest/v1/rpc/list_projects_for_admin', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
        return;
      }
      const rows = [
        { id: 'p-live', name: 'Live', owner_email: 'grace@clickplumbing.com', checked_out_by: 'u-grace', checked_out_email: 'grace@clickplumbing.com', checked_out_at: new Date(Date.now() - FIVE_MIN_MS).toISOString() },
        { id: 'p-stale', name: 'Lone Star Market', owner_email: 'grace@clickplumbing.com', checked_out_by: 'u-grace', checked_out_email: 'grace@clickplumbing.com', checked_out_at: new Date(Date.now() - TWO_DAYS_MS).toISOString() },
      ];
      await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
    });
    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.__rpcCalls = [];
      w.App.getSupabase = () => ({ rpc: (name, args) => { w.__rpcCalls.push({ name, args }); return Promise.resolve({ data: { ok: true }, error: null }); } });
      const st = w.App.state;
      st.supabaseSession = { user: { id: 'u-admin', email: 'admin@clickplumbing.com' }, access_token: 'spec-token' };
      st.isAdmin = true;
    });
    await page.evaluate(() => window.App.openManageProjectsModal());
    await expect(page.locator('#manageProjectsModal')).toHaveClass(/visible/, { timeout: 5000 });
    const row = (id) => page.locator('#manageProjectsList .settings-project-row[data-project-id="' + id + '"]');
    await expect(row('p-live')).toContainText('Checked out by grace@clickplumbing.com');
    await expect(row('p-stale')).toContainText('Lock expired · last held by grace@clickplumbing.com');
    await expect(row('p-stale')).not.toContainText('Checked out by');
    await expect(row('p-stale').locator('.settings-project-force-checkin')).toHaveCount(1);

    errors.assertNoErrors();
  });
});

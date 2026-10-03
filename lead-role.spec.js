// @ts-check
/**
 * LEAD-ROLE (2026-10-02): the fourth role, under admin and over user.
 *
 * A lead (profiles.is_lead) sees every project, checks out any, forces a live
 * lock, manages shares, hands a bid to another estimator and reviews; never
 * users, passwords, deletes or the global reload. The client reads two
 * predicates, App.canOversee() and App.canTakeOver(), never the flags.
 *
 * Always-run: the session and the flag are seeded on App.state, the RPCs the
 * Hand to… dialog calls are stubbed on App.getSupabase. The server side (the
 * migration's arms) is not reachable from here; SUPABASE_SETUP.md lead_role.
 */
const { test, expect } = require('@playwright/test');
const { collectConsoleErrors, bootApp } = require('./spec-helpers');


async function seedLead(page, { isLead, isAdmin = false }) {
  await page.evaluate(({ isLead, isAdmin }) => {
    const w = /** @type {any} */ (window);
    const st = w.App.state;
    st.supabaseSession = { user: { id: 'u-wendi', email: 'wendi@clickplumbing.com' }, access_token: 'spec-token' };
    st.isAdmin = isAdmin;
    st.isOverseer = false;
    st.isLead = isLead;
    st.currentProjectId = 'p-lone-star';
    st.currentProjectName = 'Lone Star Market';
    st.isViewer = true;
    st.canCheckOut = false;
    st.checkedOutBy = 'u-grace';
    st.checkedOutEmail = 'grace@clickplumbing.com';
    st.checkedOutAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    w.App.updateUI();
    w.App.updateSettingsCheckoutSection();
  }, { isLead, isAdmin });
}

test.describe('LEAD-ROLE: a lead takes over, an estimator does not', () => {
  test('the predicates, the Bid Board link, the force and Hand to… buttons follow the flag; Manage Users stays admin-only', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    expect(await page.evaluate(() => [typeof window.App?.canOversee, typeof window.App?.canTakeOver, typeof window.App?.openHandOffModal]))
      .toEqual(['function', 'function', 'function']);

    // A plain estimator viewing someone's live lock: no force, no hand-off, no Bid Board.
    await seedLead(page, { isLead: false });
    expect(await page.evaluate(() => [window.App.canOversee(), window.App.canTakeOver()])).toEqual([false, false]);
    expect(await page.evaluate(() => document.getElementById('settingsForceCheckIn')?.style.display)).toBe('none');
    expect(await page.evaluate(() => document.getElementById('settingsHandOff')?.style.display)).toBe('none');
    expect(await page.evaluate(() => document.getElementById('bidBoardBtnSidebar')?.style.display)).toBe('none');

    // The same person as a lead.
    await seedLead(page, { isLead: true });
    expect(await page.evaluate(() => [window.App.canOversee(), window.App.canTakeOver()])).toEqual([true, true]);
    expect(await page.evaluate(() => document.getElementById('settingsForceCheckIn')?.style.display)).toBe('');
    expect(await page.evaluate(() => document.getElementById('settingsHandOff')?.style.display)).toBe('');
    expect(await page.evaluate(() => document.getElementById('bidBoardBtnSidebar')?.style.display)).toBe('');
    // Account management is not hers.
    expect(await page.evaluate(() => document.getElementById('manageUsersBtn')?.style.display)).toBe('none');
    expect(await page.evaluate(() => document.getElementById('settingsManageProjects')?.style.display)).toBe('none');
    expect(await page.evaluate(() => document.getElementById('advancedGlobalForceReload')?.style.display)).toBe('none');

    errors.assertNoErrors();
  });

  test('Hand to…: lists every other user, calls reassign_project for the chosen one, re-reads permissions, toasts', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await seedLead(page, { isLead: true });
    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.__rpcCalls = [];
      w.__permRefreshes = 0;
      w.App.getSupabase = () => ({
        rpc: async (name, args) => {
          w.__rpcCalls.push({ name, args });
          if (name === 'list_users_for_project_invite') {
            return { data: [{ id: 'u-bob', email: 'bob@clickplumbing.com' }, { id: 'u-wendi', email: 'wendi@clickplumbing.com' }], error: null };
          }
          if (name === 'reassign_project') return { data: { ok: true, from_email: 'grace@clickplumbing.com', to_email: 'bob@clickplumbing.com' }, error: null };
          return { data: { ok: true }, error: null };
        },
      });
      w.App.refreshProjectPermissions = async () => { w.__permRefreshes++; };
    });

    await page.evaluate(() => window.App.openHandOffModal());
    await expect(page.locator('#handOffModal')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#handOffProjectName')).toHaveText('Lone Star Market');
    await expect(page.locator('#handOffUserSelect option')).toHaveCount(3, { timeout: 5000 });
    await expect(page.locator('#handOffConfirm')).toBeDisabled();
    await page.locator('#handOffUserSelect').selectOption('u-bob');
    await expect(page.locator('#handOffConfirm')).toBeEnabled();
    await page.locator('#handOffConfirm').click();

    await expect(page.locator('#handOffModal')).not.toHaveClass(/visible/, { timeout: 5000 });
    const calls = await page.evaluate(() => /** @type {any} */ (window).__rpcCalls);
    expect(calls.find((c) => c.name === 'reassign_project')).toEqual({ name: 'reassign_project', args: { p_project_id: 'p-lone-star', p_to_user_id: 'u-bob' } });
    expect(await page.evaluate(() => /** @type {any} */ (window).__permRefreshes)).toBe(1);
    await expect(page.locator('#toastRegion')).toContainText('Handed to bob@clickplumbing.com', { timeout: 5000 });

    errors.assertNoErrors();
  });

  test('Hand to…: a refused hand-off stays open and says why', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await seedLead(page, { isLead: true });
    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.App.getSupabase = () => ({
        rpc: async (name) => name === 'list_users_for_project_invite'
          ? { data: [{ id: 'u-bob', email: 'bob@clickplumbing.com' }], error: null }
          : { data: { ok: false, error: 'Only the owner, a lead or an admin can hand a project off' }, error: null },
      });
    });
    await page.evaluate(() => window.App.openHandOffModal());
    await expect(page.locator('#handOffUserSelect option')).toHaveCount(2, { timeout: 5000 });
    await page.locator('#handOffUserSelect').selectOption('u-bob');
    await page.locator('#handOffConfirm').click();
    await expect(page.locator('#handOffError')).toHaveText('Only the owner, a lead or an admin can hand a project off');
    await expect(page.locator('#handOffModal')).toHaveClass(/visible/);
    await expect(page.locator('#handOffConfirm')).toBeEnabled();

    errors.assertNoErrors();
  });
});

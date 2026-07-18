// @ts-check
/**
 * features/user-activity.js (feature-file split #33): the admin User Activity
 * modal — openUserActivityModal, the all-users/summary loaders, the
 * user-select, and the client-side filter — extracted from app.js onto the
 * window.App registry (App.openUserActivityModal registration re-homed here;
 * features/user-admin.js keeps consuming it).
 *
 * The loaders are admin + Supabase-gated, so the always-run test pins what
 * runs locally: the registration is wired; opening with no admin session is
 * a safe no-op; and the client-side filter pipeline works against a seeded
 * state.userActivityAllRowsCache — typing filters the rendered table through
 * the published format.js helpers, a non-matching query shows the no-match
 * message, and Clear restores the full table. The close binding hides the
 * modal.
 */
const { test, expect } = require('@playwright/test');

test.describe('User Activity modal (features/user-activity.js)', () => {
  test('registry re-home, no-op guard, client-side filter pipeline', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => typeof window.App?.openUserActivityModal)).toBe('function');

    // Not signed in / not admin -> early return; the modal stays hidden.
    await page.evaluate(() => window.App.openUserActivityModal(null, null));
    await expect(page.locator('#userActivityModal')).not.toHaveClass(/visible/);

    // Seed the rows cache + show the toolbar, then drive the filter input.
    await page.evaluate(() => {
      window.state.userActivityAllRowsCache = [
        { email: 'alpha@clickplumbing.com', event_type: 'counter_add', created_at: '2026-07-01T12:00:00Z', metadata: {} },
        { email: 'beta@clickplumbing.com', event_type: 'export_pdf', created_at: '2026-07-02T12:00:00Z', metadata: {} },
      ];
      document.getElementById('userActivityToolbar').classList.remove('user-activity-toolbar-hidden');
      document.getElementById('userActivityModal').classList.add('visible');
      const inp = document.getElementById('userActivityFilterInput');
      inp.value = 'alpha';
      inp.dispatchEvent(new Event('input'));
    });
    let listHtml = await page.evaluate(() => document.getElementById('userActivityList').innerHTML);
    expect(listHtml).toContain('alpha@clickplumbing.com');
    expect(listHtml).not.toContain('beta@clickplumbing.com');

    // Non-matching query -> the no-match message.
    await page.evaluate(() => {
      const inp = document.getElementById('userActivityFilterInput');
      inp.value = 'zzz-no-match';
      inp.dispatchEvent(new Event('input'));
    });
    await expect(page.locator('#userActivityList')).toContainText('No rows match your filter.');

    // Clear restores the full table.
    await page.evaluate(() => document.getElementById('userActivityFilterClear').click());
    listHtml = await page.evaluate(() => document.getElementById('userActivityList').innerHTML);
    expect(listHtml).toContain('alpha@clickplumbing.com');
    expect(listHtml).toContain('beta@clickplumbing.com');

    // The close binding hides the modal.
    await page.evaluate(() => document.getElementById('userActivityModalClose').click());
    await expect(page.locator('#userActivityModal')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });
});

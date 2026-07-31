// @ts-check
/**
 * features/user-activity-overview.js: the rich per-user activity overview
 * (#userActivityOverviewModal), split out of features/user-activity.js at its
 * documented domain seam. Pins: the registry contract (re-homed
 * App.openUserActivityOverview), the self-or-admin gate, and a full stubbed
 * render (user_activity_detail_for_admin routed) — header, stat tiles,
 * windows, breakdown, and the empty-timeline placeholder. The My Settings ->
 * My Activity binding routes here too.
 */
const { test, expect } = require('@playwright/test');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DETAIL = {
  email: 'crew@clickplumbing.com', role: 'User',
  member_since: '2026-01-01T00:00:00Z', project_count: 2,
  last_sign_in_at: '2026-07-30T12:00:00Z', last_seen_at: '2026-07-30T12:30:00Z',
  total_events: 42, active_days_30d: 7,
  events_1d: 3, events_7d: 12, events_30d: 40, distinct_projects_touched: 2,
  breakdown: { counters_added: 20, lines_added: 10, exports_pdf: 1, exports_canvas: 1 },
  recent: [],
};

async function bootApp(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
}

async function routeDetail(page) {
  await page.route('**/rest/v1/rpc/user_activity_detail_for_admin', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    await route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(DETAIL) });
  });
}

test.describe('User activity overview (features/user-activity-overview.js)', () => {
  test('registry wired; non-admin viewing someone else is a no-op', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    expect(await page.evaluate(() => typeof window.App?.openUserActivityOverview)).toBe('function');

    await page.evaluate(() => {
      window.App.state.isAdmin = false;
      window.App.state.supabaseSession = { user: { id: 'me' }, access_token: 't' };
      window.App.openUserActivityOverview('someone-else', 'x@y.com');
    });
    await expect(page.locator('#userActivityOverviewModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('self view renders header, tiles, windows, breakdown from the stubbed RPC', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await routeDetail(page);
    await page.evaluate(() => {
      window.App.state.isAdmin = false;
      window.App.state.supabaseSession = { user: { id: 'me', email: 'crew@clickplumbing.com' }, access_token: 't' };
      window.App.openUserActivityOverview('me', 'crew@clickplumbing.com');
    });
    await expect(page.locator('#userActivityOverviewModal')).toHaveClass(/visible/);
    await expect(page.locator('#uaoSubtitle')).toHaveText('crew@clickplumbing.com');
    await expect(page.locator('#uaoBody .ua-overview-header')).toContainText('crew@clickplumbing.com');
    await expect(page.locator('#uaoBody .ua-overview-header')).toContainText('Owns 2 projects');
    await expect(page.locator('#uaoBody .ua-tile')).toHaveCount(5);
    await expect(page.locator('#uaoBody .ua-tiles')).toContainText('42');
    await expect(page.locator('#uaoBody .ua-windows')).toContainText('2 projects touched');
    await expect(page.locator('#uaoBody .ua-breakdown-row').first()).toContainText('20');
    await expect(page.locator('#uaoBody')).toContainText('No activity recorded.');

    // Close binding lives in this file.
    await page.locator('#uaoClose').click();
    await expect(page.locator('#userActivityOverviewModal')).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('My Settings -> My Activity opens the overview for the signed-in user', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await routeDetail(page);
    await page.evaluate(() => {
      window.App.state.isAdmin = false;
      window.App.state.supabaseSession = { user: { id: 'me', email: 'crew@clickplumbing.com' }, access_token: 't' };
      window.App.showModal('mySettingsModal');
      document.getElementById('mySettingsMyActivity')?.click();
    });
    await expect(page.locator('#userActivityOverviewModal')).toHaveClass(/visible/);
    await expect(page.locator('#mySettingsModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#uaoSubtitle')).toHaveText('crew@clickplumbing.com');
    expect(errors).toEqual([]);
  });
});

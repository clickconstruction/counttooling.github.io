// @ts-check
/**
 * Tests: the overseer Bid Board (features/bid-board.js) — the read-only
 * "see every bid" surface for profiles.is_overseer users.
 *
 * The full flow is cloud-gated (the overseer flag + list_accessible_projects
 * live server-side), so these tests stub App.getSupabase()/state in-page and
 * exercise the client contract: registry wiring, the signed-out no-op, card
 * rendering from RPC rows, the search/estimator filters, sidebar-button
 * gating via updateUI, and the auto-open-once guards.
 */
const { test, expect } = require('@playwright/test');

const STUB_ROWS = [
  { id: 'p1', name: 'Riverside Apartments', owner_email: 'wendi@example.com', counter_count: 214, line_count: 38, updated_at: '2026-08-27T12:00:00Z', pdf_path: 'u/p1.pdf', is_owner: false, can_edit: false, can_check_out: false, my_access_role: 'viewer' },
  { id: 'p2', name: 'Oak Hill Elementary', owner_email: 'wendi@example.com', counter_count: 96, line_count: 12, updated_at: '2026-08-26T12:00:00Z', pdf_path: 'u/p2.pdf', is_owner: false, can_edit: false, can_check_out: false, my_access_role: 'viewer' },
  { id: 'p3', name: 'Lakeway Medical Office', owner_email: 'jake@example.com', counter_count: 310, line_count: 54, updated_at: '2026-08-25T12:00:00Z', pdf_path: null, is_owner: false, can_edit: false, can_check_out: false, my_access_role: 'viewer' },
];

async function bootApp(page) {
  const errors = [];
  page.on('console', (msg) => {
    // config.local.js is gitignored and optional; its 404 is expected on
    // checkouts (e.g. worktrees) that don't carry the local file.
    if (msg.type() === 'error' && !(msg.location()?.url || '').includes('config.local.js')) errors.push(msg.text());
  });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  return errors;
}

function stubOverseerSession(page, rows) {
  return page.evaluate((stubRows) => {
    window.state.supabaseSession = { user: { id: 'overseer-test' }, access_token: 't' };
    window.state.isOverseer = true;
    window.App.getSupabase = () => ({ rpc: async () => ({ data: stubRows, error: null }) });
    window.App.updateUI();
  }, rows);
}

test.describe('Bid Board - overseer all-bids browser', () => {
  test('registry wired; opening without a session is a safe no-op', async ({ page }) => {
    const errors = await bootApp(page);

    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openBidBoard,
      auto: typeof window.App?.maybeAutoOpenBidBoard,
      loadRow: typeof window.App?.loadCloudProjectRow,
    }));
    expect(wired).toEqual({ open: 'function', auto: 'function', loadRow: 'function' });

    await page.evaluate(() => { window.App.openBidBoard(); window.App.maybeAutoOpenBidBoard(); });
    await page.waitForTimeout(200);
    const visible = await page.evaluate(() =>
      document.getElementById('bidBoardModal')?.classList.contains('visible'));
    expect(visible).toBe(false);

    // Signed out -> the sidebar entry stays hidden.
    const btnHidden = await page.evaluate(() =>
      document.getElementById('bidBoardBtnSidebar')?.style.display === 'none');
    expect(btnHidden).toBe(true);

    expect(errors).toEqual([]);
  });

  test('renders bid cards from RPC rows with search + estimator filters', async ({ page }) => {
    const errors = await bootApp(page);
    await stubOverseerSession(page, STUB_ROWS);

    // Overseer signed in -> the sidebar entry shows.
    const btnVisible = await page.evaluate(() =>
      document.getElementById('bidBoardBtnSidebar')?.style.display !== 'none');
    expect(btnVisible).toBe(true);

    await page.evaluate(() => window.App.openBidBoard());
    await expect(page.locator('#bidBoardModal')).toBeVisible();
    await expect(page.locator('#bidBoardList .bid-card')).toHaveCount(3);

    // Card content: name, estimator label (local-part), counts, No PDF badge.
    const firstCard = page.locator('#bidBoardList .bid-card').first();
    await expect(firstCard.locator('.bid-card-name')).toHaveText('Riverside Apartments');
    await expect(firstCard.locator('.bid-card-owner')).toHaveText('wendi');
    await expect(firstCard.locator('.bid-card-badge').first()).toHaveText('214 counts · 38 lines');
    // Cloud-completeness badges: pdf_path present -> "Fully cloud" (p1, p2);
    // missing -> "Canvas only" (p3). Date carries the relative age suffix.
    await expect(page.locator('#bidBoardList .bid-card-badge-cloud')).toHaveCount(2);
    await expect(firstCard.locator('.bid-card-badge-cloud')).toHaveText('✓ Fully cloud');
    await expect(page.locator('#bidBoardList .bid-card-badge-warn')).toHaveCount(1);
    await expect(page.locator('#bidBoardList .bid-card-badge-warn')).toHaveText('Canvas only');
    await expect(firstCard.locator('.bid-card-date')).toContainText(/today|yesterday|days ago/);

    // Search filter.
    await page.fill('#bidBoardSearch', 'oak');
    await expect(page.locator('#bidBoardList .bid-card')).toHaveCount(1);
    await page.fill('#bidBoardSearch', '');

    // Estimator filter (built from distinct owner emails).
    const ownerOptions = await page.locator('#bidBoardOwnerFilter option').allTextContents();
    expect(ownerOptions).toEqual(['All estimators', 'jake', 'wendi']);
    await page.selectOption('#bidBoardOwnerFilter', 'jake@example.com');
    await expect(page.locator('#bidBoardList .bid-card')).toHaveCount(1);
    await expect(page.locator('#bidBoardList .bid-card-name')).toHaveText('Lakeway Medical Office');

    await page.click('#bidBoardClose');
    await expect(page.locator('#bidBoardModal')).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test('auto-open: opens once for a pure overseer, never for admins', async ({ page }) => {
    await bootApp(page);
    await stubOverseerSession(page, STUB_ROWS);

    // Admin + overseer -> no auto-open (admins use the button).
    await page.evaluate(() => { window.state.isAdmin = true; window.App.maybeAutoOpenBidBoard(); });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() =>
      document.getElementById('bidBoardModal')?.classList.contains('visible'))).toBe(false);

    // Pure overseer -> auto-opens.
    await page.evaluate(() => { window.state.isAdmin = false; window.App.maybeAutoOpenBidBoard(); });
    await expect(page.locator('#bidBoardModal')).toBeVisible();

    // Once per page load: after closing, a later auth event must not reopen it.
    await page.click('#bidBoardClose');
    await page.evaluate(() => window.App.maybeAutoOpenBidBoard());
    await page.waitForTimeout(200);
    expect(await page.evaluate(() =>
      document.getElementById('bidBoardModal')?.classList.contains('visible'))).toBe(false);
  });
});

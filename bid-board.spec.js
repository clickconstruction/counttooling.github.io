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
  { id: 'p1', name: 'Riverside Apartments', owner_email: 'wendi@example.com', counter_count: 214, line_count: 38, updated_at: '2026-08-27T12:00:00Z', pdf_path: 'u/p1.pdf', is_owner: false, can_edit: false, can_check_out: false, my_access_role: 'viewer', review_status: 'ready', review_requested_at: '2026-08-27T12:00:00Z' },
  { id: 'p2', name: 'Oak Hill Elementary', owner_email: 'wendi@example.com', counter_count: 96, line_count: 12, updated_at: '2026-08-26T12:00:00Z', pdf_path: 'u/p2.pdf', is_owner: false, can_edit: false, can_check_out: false, my_access_role: 'viewer', review_status: 'reviewed', reviewed_at: '2026-08-26T13:00:00Z' },
  { id: 'p3', name: 'Lakeway Medical Office', owner_email: 'jake@example.com', counter_count: 310, line_count: 54, updated_at: '2026-08-25T12:00:00Z', pdf_path: null, is_owner: false, can_edit: false, can_check_out: false, my_access_role: 'viewer' },
  // Test-harness debris: must be hidden from the board entirely.
  { id: 'p4', name: 'IndexedDB Test 1787863165971', owner_email: 'dev-agent@clickplumbing.com', counter_count: 1, line_count: 0, updated_at: '2026-08-28T12:00:00Z', pdf_path: 'u/p4.pdf', is_owner: false, can_edit: false, can_check_out: false, my_access_role: 'viewer' },
  // A digital twin's backtest (PEOPLE-TWINS): off the board until Twins or All is picked, except for an admin.
  { id: 'p5', name: 'ZZ Twin Oak Hill (backtest)', owner_email: 'twin-estimator-1@twins.counttooling.local', counter_count: 90, line_count: 10, updated_at: '2026-08-28T13:00:00Z', pdf_path: 'u/p5.pdf', is_owner: false, can_edit: false, can_check_out: false, my_access_role: 'viewer', review_status: 'ready', review_requested_at: '2026-08-28T13:00:00Z' },
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
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  return errors;
}

function stubOverseerSession(page, rows) {
  return page.evaluate((stubRows) => {
    window.state.supabaseSession = { user: { id: 'overseer-test' }, access_token: 't' };
    window.state.isOverseer = true;
    window.App.getSupabase = () => ({
      rpc: async (name) => name === 'list_accessible_projects'
        ? { data: stubRows, error: null }
        : { data: { ok: true }, error: null },
    });
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

    // ...and so does the desktop status-bar entry (link + its separator).
    const statusHidden = await page.evaluate(() => ({
      link: document.getElementById('statusBarBidBoard')?.style.display === 'none',
      sep: document.getElementById('statusBarBidBoardSep')?.style.display === 'none',
    }));
    expect(statusHidden).toEqual({ link: true, sep: true });

    expect(errors).toEqual([]);
  });

  test('renders bid cards from RPC rows with search + estimator filters', async ({ page }) => {
    const errors = await bootApp(page);
    await stubOverseerSession(page, STUB_ROWS);

    // Overseer signed in -> the sidebar entry shows.
    const btnVisible = await page.evaluate(() =>
      document.getElementById('bidBoardBtnSidebar')?.style.display !== 'none');
    expect(btnVisible).toBe(true);

    // Desktop status-bar entry shows too, and clicking it opens the board.
    const statusVisible = await page.evaluate(() => ({
      link: document.getElementById('statusBarBidBoard')?.style.display !== 'none',
      sep: document.getElementById('statusBarBidBoardSep')?.style.display !== 'none',
    }));
    expect(statusVisible).toEqual({ link: true, sep: true });
    await page.evaluate(() => document.getElementById('statusBarBidBoard').click());
    await expect(page.locator('#bidBoardModal')).toBeVisible();
    await page.click('#bidBoardClose');

    await page.evaluate(() => window.App.openBidBoard());
    await expect(page.locator('#bidBoardModal')).toBeVisible();
    // 4 stub rows, but the dev-agent test-harness row is filtered out.
    await expect(page.locator('#bidBoardList .bid-card')).toHaveCount(3);
    await expect(page.locator('#bidBoardList')).not.toContainText('IndexedDB Test');

    // Card content: name, estimator label (local-part), counts, No PDF badge.
    const firstCard = page.locator('#bidBoardList .bid-card').first();
    await expect(firstCard.locator('.bid-card-name')).toHaveText('Riverside Apartments');
    await expect(firstCard.locator('.bid-card-owner')).toHaveText('wendi');
    await expect(firstCard.locator('.bid-card-badge:not([class*="bid-card-badge-"])')).toHaveText('214 counts · 38 lines');
    // Cloud completeness (CLOUD-OFF-ICON): a bid with its PDF in the cloud says nothing; one
    // without (p3) wears a crossed-out cloud in its corner with the note on it. Date carries
    // the relative age suffix.
    await expect(page.locator('#bidBoardList .bid-card-badge-cloud')).toHaveCount(0);
    await expect(page.locator('#bidBoardList .bid-card-badge-warn')).toHaveCount(0);
    await expect(page.locator('#bidBoardList .bid-card-cloud-off')).toHaveCount(1);
    await expect(page.locator('#bidBoardList .bid-card', { hasText: 'Lakeway Medical Office' }).locator('.bid-card-cloud-off')).toHaveAttribute('aria-label', /^Canvas only\./);
    await expect(firstCard.locator('.bid-card-cloud-off')).toHaveCount(0);
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

  test('review handoff: ready lane and badges; the card carries no decision', async ({ page }) => {
    const errors = await bootApp(page);
    await stubOverseerSession(page, STUB_ROWS);
    await page.evaluate(() => window.App.openBidBoard());
    await expect(page.locator('#bidBoardModal')).toBeVisible();

    // The ready bid gets its own pinned lane; the rest fall under "All bids".
    const laneTitles = await page.locator('.bid-board-lane-title').allTextContents();
    expect(laneTitles).toEqual(['Ready for review (1) · oldest waiting first', 'All bids']);
    await expect(page.locator('#bidBoardList .bid-card-badge-ready')).toHaveText('Ready for review');
    await expect(page.locator('#bidBoardList .bid-card-badge-reviewed')).toHaveText('Reviewed ✓');

    // DROP-CARD-BUTTONS: no button on any card. Mark reviewed and Request changes… live on
    // the review bar in the opened bid (the review-bar test below).
    await expect(page.locator('#bidBoardList .bid-card-review-btn')).toHaveCount(0);
    await expect(page.locator('#bidBoardList .bid-card-changes-btn')).toHaveCount(0);
    await expect(page.locator('#bidBoardList .bid-card button')).toHaveCount(0);

    // The registry entry the settings row shares is wired.
    expect(await page.evaluate(() => typeof window.App.setProjectReviewStatus)).toBe('function');
    expect(errors).toEqual([]);
  });

  test('People · Twins · All: the fleet is off for a lead and on for an admin', async ({ page }) => {
    const errors = await bootApp(page);
    await stubOverseerSession(page, STUB_ROWS);
    await page.evaluate(() => window.App.openBidBoard());
    await expect(page.locator('#bidBoardModal')).toBeVisible();

    // Not an admin: the board opens on People, the twin's bid is off, and a
    // line under the list says so. The ready lane counts only what shows.
    await expect(page.locator('#bidBoardKind')).toBeVisible();
    await expect(page.locator('#bidBoardKind input:checked')).toHaveValue('people');
    await expect(page.locator('#bidBoardList .bid-card')).toHaveCount(3);
    await expect(page.locator('#bidBoardList')).not.toContainText('ZZ Twin');
    await expect(page.locator('.bid-board-hidden-note')).toHaveText('1 twin bid is off · show twins');
    expect(await page.locator('.bid-board-lane-title').allTextContents()).toEqual(['Ready for review (1) · oldest waiting first', 'All bids']);

    // "show twins" flips the segment: only the fleet, and only its owner in the estimator list.
    await page.click('.bid-board-show-twins');
    await expect(page.locator('#bidBoardKind input:checked')).toHaveValue('twins');
    await expect(page.locator('#bidBoardList .bid-card')).toHaveCount(1);
    await expect(page.locator('#bidBoardList .bid-card-name')).toHaveText('ZZ Twin Oak Hill (backtest)');
    await expect(page.locator('.bid-board-hidden-note')).toHaveCount(0);
    expect(await page.locator('#bidBoardOwnerFilter option').allTextContents()).toEqual(['All estimators', 'twin-estimator-1']);

    // All: everyone, both ready bids in the lane, every owner in the list.
    await page.locator('#bidBoardKind label', { hasText: 'All' }).click();
    await expect(page.locator('#bidBoardList .bid-card')).toHaveCount(4);
    expect(await page.locator('.bid-board-lane-title').allTextContents()).toEqual(['Ready for review (2) · oldest waiting first', 'All bids']);
    // Oldest waiting first: p1 asked on the 27th, the twin on the 28th.
    expect(await page.locator('#bidBoardList .bid-card-name').allTextContents()).toEqual(['Riverside Apartments', 'ZZ Twin Oak Hill (backtest)', 'Oak Hill Elementary', 'Lakeway Medical Office']);
    expect(await page.locator('#bidBoardOwnerFilter option').allTextContents()).toEqual(['All estimators', 'jake', 'twin-estimator-1', 'wendi']);

    // An admin opens on All, the view they always had.
    await page.click('#bidBoardClose');
    await page.evaluate(() => { window.state.isAdmin = true; window.App.openBidBoard(); });
    await expect(page.locator('#bidBoardModal')).toBeVisible();
    await expect(page.locator('#bidBoardKind input:checked')).toHaveValue('all');
    await expect(page.locator('#bidBoardList .bid-card')).toHaveCount(4);
    await page.click('#bidBoardClose');

    // A company with no twin bids never sees the switch.
    await stubOverseerSession(page, STUB_ROWS.filter((r) => r.id !== 'p5'));
    await page.evaluate(() => { window.state.isAdmin = false; window.App.openBidBoard(); });
    await expect(page.locator('#bidBoardModal')).toBeVisible();
    await expect(page.locator('#bidBoardList .bid-card')).toHaveCount(3);
    await expect(page.locator('#bidBoardKind')).toBeHidden();
    await expect(page.locator('.bid-board-hidden-note')).toHaveCount(0);
    await page.click('#bidBoardClose');
    expect(errors).toEqual([]);
  });

  test('review bar: shows on an open ready bid, takes the decision, walks Next ready', async ({ page }) => {
    const errors = await bootApp(page);
    await stubOverseerSession(page, STUB_ROWS);
    // A cloud load needs the real backend; stand in for it the way the real one ends: the
    // project is open and the hook fires with the row.
    await page.evaluate(() => {
      window.__loaded = [];
      window.App.loadCloudProjectRow = async (proj, ui) => {
        window.__loaded.push(proj.id);
        window.state.currentProjectId = proj.id;
        if (ui && ui.hostModalId) window.App.hideModal(ui.hostModalId);
        window.App.onCloudProjectRowLoaded(proj);
      };
    });
    await page.evaluate(() => window.App.openBidBoard());
    await expect(page.locator('#bidBoardModal')).toBeVisible();
    await expect(page.locator('#reviewBar')).toBeHidden();
    await page.locator('#bidBoardKind label', { hasText: 'All' }).click();

    // Open the first ready card (the oldest waiting): the bar shows under the header.
    await page.locator('#bidBoardList .bid-card').first().click();
    await expect(page.locator('#reviewBar')).toBeVisible();
    await expect(page.locator('#reviewBarText')).toHaveText(/^waiting \d+ days · wendi · 214 counts · 38 lines$/);
    await expect(page.locator('#reviewBarReviewed')).toBeVisible();
    await expect(page.locator('#reviewBarChanges')).toBeVisible();
    await expect(page.locator('#reviewBarNext')).toBeVisible();

    // Mark reviewed: the decision buttons go, the text says what happened and what is left.
    await page.click('#reviewBarReviewed');
    await expect(page.locator('#reviewBarText')).toHaveText('Reviewed ✓ · 1 more ready');
    await expect(page.locator('#reviewBarReviewed')).toBeHidden();
    await expect(page.locator('#reviewBarChanges')).toBeHidden();

    // Next ready opens the next bid in the lane; nothing is left after it, so Next goes.
    await page.click('#reviewBarNext');
    await expect(page.locator('#reviewBarText')).toHaveText(/^waiting \d+ days · twin-estimator-1 · 90 counts · 10 lines$/);
    expect(await page.evaluate(() => window.__loaded)).toEqual(['p1', 'p5']);
    await expect(page.locator('#reviewBarNext')).toBeHidden();

    // Request changes goes through the confirm dialog; a note is required; the text quotes it.
    await page.click('#reviewBarChanges');
    await expect(page.locator('#confirmInput')).toBeVisible();
    await page.fill('#confirmInput', 'tighten the vent sizes');
    await page.click('#confirmOk');
    await expect(page.locator('#reviewBarText')).toHaveText('Sent back: “tighten the vent sizes” · none left ready');

    // Reopening the board shows the lane as the decisions left it; closing the project hides the bar.
    await page.evaluate(() => window.App.openBidBoard());
    await expect(page.locator('#bidBoardModal')).toBeVisible();
    await page.locator('#bidBoardKind label', { hasText: 'All' }).click();
    await expect(page.locator('.bid-board-lane-title')).toHaveCount(0);
    await expect(page.locator('#bidBoardList .bid-card-badge-warn', { hasText: 'Changes requested' })).toHaveCount(1);
    await page.click('#bidBoardClose');
    await page.evaluate(() => { window.state.currentProjectId = null; window.App.updateUI(); });
    await expect(page.locator('#reviewBar')).toBeHidden();

    // A bid that is not ready, or a user who cannot oversee, gets no bar.
    await page.evaluate(() => { window.state.currentProjectId = 'p2'; window.App.showReviewBar(Object.assign({}, window.__p2 || { id: 'p2', review_status: 'reviewed' })); });
    await expect(page.locator('#reviewBar')).toBeHidden();
    await page.evaluate(() => { window.state.isOverseer = false; window.state.currentProjectId = 'p9'; window.App.showReviewBar({ id: 'p9', review_status: 'ready', owner_email: 'x@example.com' }); });
    await expect(page.locator('#reviewBar')).toBeHidden();
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

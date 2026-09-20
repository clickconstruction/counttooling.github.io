// @ts-check
/**
 * Turn In on your own checked-out project must not be reported as a force
 * turn-in (field report 2026-09-15, wendi: "keeps kicking me to view only
 * after I check things out").
 *
 * The shape: our own check_in_project reaches the tab as a projects-row
 * UPDATE (realtime) AND as the post-release refreshProjectPermissions the
 * Turn In handler runs. Both saw "was the lock holder, now viewer, lock not
 * stale" and classified it as an external force — the "an admin turned this
 * project in" notice opened in the very tab that clicked [Turn In]. The
 * engine's self-release stamp (save-engine.js, SELF_RELEASE_GRACE_MS) makes
 * a refresh inside the window ours. It ships DORMANT behind the per-device
 * flag `?ff=self-release` (app.js feature flags) until _TODO.md R1-FLIP, so
 * this spec walks both halves on one project: flag off → the notice still
 * fires (what prod does today); flag on → turned-in toast only.
 *
 * Cloud-gated: needs SUPABASE_* plus DEV_AUTH_EMAIL/DEV_AUTH_PASSWORD in
 * config.local.js (the repo's test-account harness); self-skips otherwise,
 * like the other cloud specs. Creates one project on the test account via
 * the signed-in sample-plan intake ("Save & Open") and deletes it at the end
 * through the Load Project modal's own delete (the nightly purge is the
 * backstop).
 */
const { test, expect } = require('@playwright/test');

const PROJECT_NAME = 'spec-turn-in-self-release';

test.describe('Turn In is not a force turn-in', () => {
  test('flag off: [Turn In] still trips the notice; flag on: turned-in toast, no notice, Check out to Edit works again', async ({ page }) => {
    test.setTimeout(120000);   // a cloud upload, two turn-ins and a checkout: 30.3 s green against the default 30 s
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    const failedRequests = [];
    page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')); });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/app/?devAuth=1');
    await page.waitForLoadState('networkidle');

    const signedIn = await page.waitForFunction(() => !!window.state?.supabaseSession?.user, null, { timeout: 8000 }).catch(() => null);
    if (!signedIn) {
      test.skip(true, 'Dev auth not configured or failed; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD in config.local.js');
      return;
    }

    // The signed-in sample-plan intake. Two doors, depending on what the test
    // account already holds: no same-hash project → Prepare PDF for Cloud,
    // whose Save & Open creates the project and checks it out to us; a
    // same-hash project (debris from another run) → the Load Annotations
    // prompt, Skip, then Save Project from the header banner.
    await page.locator('#canvasEmptyHintAdvancedPlan').click();
    const prepare = page.locator('#preparePdfModal.visible');
    const loadAnn = page.locator('#loadAnnotationsModal.visible');
    await Promise.race([
      prepare.waitFor({ state: 'visible', timeout: 20000 }),
      loadAnn.waitFor({ state: 'visible', timeout: 20000 }),
    ]);
    if (await prepare.isVisible()) {
      await page.locator('#preparePdfName').fill(PROJECT_NAME);
      await page.locator('#preparePdfSaveAndOpen').click();
    } else {
      await page.locator('#loadAnnotationsSkip').click();
      await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 15000 });
      // The header banner's "Unsaved / Save" button is what a user clicks;
      // it forwards to #saveProjectBtn (which may sit behind the ⋯ menu).
      await page.locator('#headerEditStatusBanner .header-edit-status-btn[data-action="save"]').click();
      await expect(page.locator('#saveProjectModal')).toHaveClass(/visible/, { timeout: 10000 });
      await page.locator('#saveProjectName').fill(PROJECT_NAME);
      await page.locator('#saveProjectDo').click();
    }
    await page.waitForFunction(() => {
      const s = window.state;
      return !!s.currentProjectId && s.checkedOutBy === s.supabaseSession?.user?.id && !s.isViewer;
    }, null, { timeout: 30000 });
    const projectId = await page.evaluate(() => window.state.currentProjectId);
    const banner = page.locator('#headerEditStatusBanner .header-edit-status-btn');
    await expect(banner).toHaveText('[Turn In]');

    try {
      // --- flag OFF (prod today): our own Turn In is reported as a force ----
      expect(await page.evaluate(() => window.App.featureFlagEnabled('self-release'))).toBe(false);
      let logMark = await page.evaluate(() => (window.App.getSaveStatusLog() || []).length);
      await banner.click();
      await expect(page.locator('#forceTurnInNoticeModal')).toHaveClass(/visible/, { timeout: 15000 });
      await expect(page.locator('#forceTurnInNoticeBody')).toContainText('An admin turned this project in');
      let kinds = await page.evaluate((mark) => (window.App.getSaveStatusLog() || []).slice(mark).map((e) => e.type || e.kind), logMark);
      expect(kinds).toContain('turn_in_ok');
      expect(kinds).toContain('force_turn_in');
      expect(kinds).not.toContain('self_release_refresh');
      // The notice's own "Check out to edit" takes us back to editing.
      await page.locator('#forceTurnInNoticeCheckout').click();
      await page.waitForFunction(() => {
        const s = window.state;
        return s.checkedOutBy === s.supabaseSession?.user?.id && !s.isViewer;
      }, null, { timeout: 15000 });
      await page.evaluate(() => window.App.hideModal('turnedInToastModal'));
      await expect(banner).toHaveText('[Turn In]');

      // --- flag ON (what the tester opens: /app/?ff=self-release) -----------
      // Set the device flag the way the URL switch does; the engine reads it
      // at call time, no reload needed.
      await page.evaluate(() => localStorage.setItem('clickcount-ff-self-release', '1'));
      expect(await page.evaluate(() => window.App.featureFlagEnabled('self-release'))).toBe(true);
      logMark = await page.evaluate(() => (window.App.getSaveStatusLog() || []).length);

      // --- the release --------------------------------------------------
      await banner.click();
      await expect(page.locator('#turnedInToastModal')).toHaveClass(/visible/, { timeout: 15000 });
      await expect(page.locator('#turnedInToastText')).toHaveText('Project turned in.');
      // Give both refreshes (realtime UPDATE + the handler's own) time to land.
      await page.waitForTimeout(3000);
      expect(await page.locator('#forceTurnInNoticeModal').evaluate((m) => m.classList.contains('visible')))
        .toBe(false);
      await expect(banner).toHaveText('[Check out to Edit]');
      kinds = await page.evaluate((mark) => (window.App.getSaveStatusLog() || []).slice(mark).map((e) => e.type || e.kind), logMark);
      expect(kinds).toContain('turn_in_ok');
      expect(kinds).toContain('self_release_refresh');
      expect(kinds).not.toContain('force_turn_in');
      expect(kinds).not.toContain('checkout_expired_on_refresh');

      // --- and back in: the same button, now [Check out to Edit] -----------
      await banner.click();
      await page.waitForFunction(() => {
        const s = window.state;
        return s.checkedOutBy === s.supabaseSession?.user?.id && !s.isViewer;
      }, null, { timeout: 15000 });
      await expect(banner).toHaveText('[Turn In]');
      await page.waitForTimeout(1500);
      expect(await page.locator('#forceTurnInNoticeModal').evaluate((m) => m.classList.contains('visible')))
        .toBe(false);
      // The flow under test must be console-clean like every other flow.
      // Asserted BEFORE cleanup: closeProject logs 'project_close', which the
      // deployed log_user_event allowlist rejects with a 400 (pre-existing,
      // needs a migration — see _TODO.md); that noise is not this spec's.
      expect(errors, 'console errors: ' + errors.join('\n') + '\nfailed requests: ' + failedRequests.join('\n')).toEqual([]);
    } finally {
      // Cleanup: close (turns in) and delete the spec's project through the
      // Load Project modal's own delete control. Best effort — the purge is
      // the backstop.
      try {
        await page.evaluate(() => window.App.hideModal('turnedInToastModal'));
        await page.evaluate(() => window.App.closeProject({ route: 'spec_cleanup' }));
        await page.waitForFunction(() => window.state.pages.length === 0, null, { timeout: 10000 });
        await page.evaluate(() => window.App.openLoadProjectModalOrPromptSave());
        await expect(page.locator('#loadProjectModal')).toHaveClass(/visible/, { timeout: 10000 });
        const row = page.locator('#loadProjectList .load-project-item').filter({ hasText: PROJECT_NAME }).first();
        if (await row.count()) {
          await row.locator('.load-project-delete').click();
          await expect(page.locator('#confirmModal')).toHaveClass(/visible/, { timeout: 5000 });
          await page.locator('#confirmOk').click();
          await expect(row).toHaveCount(0, { timeout: 15000 });
        }
      } catch (_) { /* best effort */ }
      void projectId;
    }
  });
});

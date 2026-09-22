// @ts-check
/**
 * R1-RECLICK — the header's edit button holds a beat after it acts.
 *
 * [Check out to Edit] and [Turn In] are one button in the same pixels. The label
 * used to flip the instant the first action landed, so a double-click checked a
 * project out and turned it straight back in (or the reverse). After either action
 * succeeds from this button, the banner reads "Checked out ✓" / "Turned in ✓",
 * disabled, for 3 s, then offers the opposite action as before. Guards: a
 * double-click on [Turn In] turns in ONCE and leaves the project turned in; a
 * double-click on [Check out to Edit] checks out ONCE and leaves it checked out;
 * the sidebar's copy of the banner holds too; the hold ends by itself.
 *
 * Cloud-gated: needs SUPABASE_* plus DEV_AUTH_EMAIL/DEV_AUTH_PASSWORD in
 * config.local.js; self-skips otherwise. The self-release fix is switched on for
 * the device (?ff=self-release's flag), so the turn-in is quiet. Creates one
 * project named for its file and deletes it at the end.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FILE_NAME = 'spec-reclick-hold.pdf';
const PROJECT_NAME = 'spec-reclick-hold';

test.describe('R1-RECLICK — the edit button holds after it acts', () => {
  test('a double-click turns in once, and checks out once; the label holds, then offers the opposite action', async ({ page }) => {
    test.setTimeout(180000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => { try { localStorage.setItem('clickcount-ff-self-release', '1'); } catch (_) { /* private mode */ } });
    await page.goto('/app/?devAuth=1');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    const signedIn = await page.waitForFunction(() => !!window.state?.supabaseSession?.user, null, { timeout: 8000 }).catch(() => null);
    if (!signedIn) { test.skip(true, 'Dev auth not configured or failed; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD in config.local.js'); return; }
    await page.waitForFunction(() => window.App.bootSettled === true, null, { timeout: 20000 });
    await page.evaluate(() => { if (window.App.isRestorePromptPending()) window.App.dismissLastSessionRestorePrompt(); });

    // a cloud project checked out to us: open a plan, mark it, and autosave creates it
    await page.locator('#pdfInput').setInputFiles({ name: FILE_NAME, mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(__dirname, 'test-page.pdf')) });
    const door = await Promise.race([
      page.locator('#loadAnnotationsModal.visible').waitFor({ timeout: 30000 }).then(() => 'loadAnnotations'),
      page.locator('#preparePdfModal.visible').waitFor({ timeout: 30000 }).then(() => 'prepare'),
    ]);
    if (door === 'loadAnnotations') await page.locator('#loadAnnotationsSkip').click(); else await page.locator('#preparePdfDone').click();
    await page.waitForFunction(() => window.state.pages.length === 1 && !document.querySelector('.modal-overlay.visible'), null, { timeout: 30000 });
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      const c = { id: App.uid(), name: 'Floor Drain', icon: App.getOrderedIcons()[0].value, color: '#47d4d4' };
      s.counters.push(c);
      App.getActiveAnnotations(s.pages[0]).counterMarkers[c.id] = [{ x: 100, y: 100, id: App.uid(), group: null }];
      App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
    });
    await page.waitForFunction(() => !!window.state.currentProjectId && !!window.state.pdfStoragePath && window.state.checkedOutBy === window.state.supabaseSession.user.id, null, { timeout: 90000 });
    const banner = page.locator('#headerEditStatusBanner .header-edit-status-btn');
    await expect(banner).toHaveText('[Turn In]');
    const kindsSince = (mark) => page.evaluate((m) => (window.App.getSaveStatusLog() || []).slice(m).map((e) => e.kind), mark);
    const logLength = () => page.evaluate(() => (window.App.getSaveStatusLog() || []).length);

    try {
      // --- a double-click on [Turn In]: one turn-in, and it STAYS turned in ------------
      let mark = await logLength();
      await banner.dblclick();
      await expect(banner).toHaveText('Turned in ✓', { timeout: 20000 });
      await expect(banner).toBeDisabled();
      await expect(page.locator('#sidebarCheckoutBanner .header-edit-status-btn')).toHaveText('Turned in ✓');   // the sidebar's copy holds too
      // the field report's shape: a second click a couple of seconds later, inside the hold, does nothing
      await page.waitForTimeout(1800);
      await expect(banner).toHaveText('Turned in \u2713');
      await banner.click({ force: true }).catch(() => {});
      await expect(banner).toHaveText('[Check out to Edit]', { timeout: 8000 });   // the hold ends by itself
      await expect(banner).toBeEnabled();
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => window.state.isViewer)).toBe(true);
      let kinds = await kindsSince(mark);
      expect(kinds.filter((k) => k === 'turn_in_ok')).toHaveLength(1);

      // --- a double-click on [Check out to Edit]: one checkout, and it STAYS checked out --
      await page.evaluate(() => window.App.hideModal('turnedInToastModal'));
      mark = await logLength();
      await banner.dblclick();
      await expect(banner).toHaveText('Checked out ✓', { timeout: 20000 });
      await expect(banner).toBeDisabled();
      await expect(banner).toHaveText('[Turn In]', { timeout: 8000 });
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => { const s = window.state; return !s.isViewer && s.checkedOutBy === s.supabaseSession.user.id; })).toBe(true);
      kinds = await kindsSince(mark);
      expect(kinds).not.toContain('turn_in_ok');
      expect(kinds).not.toContain('turn_in_start');
      expect(errors, 'console errors: ' + errors.join('\n')).toEqual([]);
    } finally {
      try {
        await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => window.App.hideModal(m.id)));
        await page.evaluate(() => { window.App.closeProject({ route: 'spec_cleanup' }); });
        const ask = page.locator('#confirmModal.visible #confirmOk');
        if (await ask.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) await ask.click();
        await page.waitForFunction(() => window.state.pages.length === 0, null, { timeout: 15000 });
        await page.evaluate(() => window.App.openLoadProjectModalOrPromptSave());
        await expect(page.locator('#loadProjectModal')).toHaveClass(/visible/, { timeout: 10000 });
        const rows = page.locator('#loadProjectList .load-project-item').filter({ hasText: PROJECT_NAME });
        for (let n = await rows.count(); n > 0; n--) {
          await rows.first().locator('.load-project-delete').click();
          await expect(page.locator('#confirmModal')).toHaveClass(/visible/, { timeout: 5000 });
          await page.locator('#confirmOk').click();
          await expect(rows).toHaveCount(n - 1, { timeout: 15000 });
        }
      } catch (_) { /* best effort */ }
    }
  });
});

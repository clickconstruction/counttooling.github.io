// @ts-check
/**
 * Signing in must not cost the takeoff made signed out.
 *
 * The admin force-reload check runs at sign-in: a server stamp newer than the
 * browser's own means "reload now". A browser that had never been through one
 * had NO stamp, which read as 0, so the FIRST sign-in on any browser deleted the
 * on-device database (the takeoff backups with it) and reloaded: a takeoff made
 * signed out, then a sign-in to save it, ended on an empty canvas with nothing
 * offered back. Guards, against the real project's stamp:
 *   1. no stamp: signing in from inside the app does not reload; the plan, the
 *      marks and the device backup are all still there; the stamp is adopted.
 *   2. a stamp older than the server's: the reload still happens, and it keeps the
 *      takeoff backups, so "Project from Last Session" brings the work back.
 *
 * Cloud-gated: needs SUPABASE_* plus DEV_AUTH_EMAIL/DEV_AUTH_PASSWORD in
 * config.local.js (the Sign In dialog's test-user button); self-skips otherwise.
 * Signed in with unsaved marks, the engine's autosave creates the cloud project by
 * itself, so the plan carries a name of its own and each case deletes what it made
 * (the nightly purge is the backstop).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STAMP_KEY = 'clickcount-last-global-reload';
const FILE_NAME = 'spec-signin-keeps-takeoff.pdf';
const PROJECT_NAME = 'spec-signin-keeps-takeoff';
const markCount = (page) => page.evaluate(() => { const p = window.state.pages[0]; if (!p) return 0; const a = window.App.getActiveAnnotations(p); return Object.values(a.counterMarkers).reduce((n, x) => n + x.length, 0); });
const localBackupPdfBytes = (page) => page.evaluate(async () => { for (const k of ['local', 'local-held']) { const b = await window.__takeoffBackupGetForTest(k, null); if (b && b.pdfBlob && b.pdfBlob.size > 0) return b.pdfBlob.size; } return 0; });

async function takeoffSignedOut(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  const canDevAuth = await page.evaluate(() => typeof window.DEV_AUTH_EMAIL === 'string' && !!window.DEV_AUTH_EMAIL && !!window.DEV_AUTH_PASSWORD);
  if (!canDevAuth) return false;
  await page.locator('#pdfInput').setInputFiles({ name: FILE_NAME, mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(__dirname, 'test-page.pdf')) });
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => {
    const s = window.state, App = window.App;
    const c = { id: App.uid(), name: 'Floor Drain', icon: App.getOrderedIcons()[0].value, color: '#47d4d4' };
    s.counters.push(c);
    App.getActiveAnnotations(s.pages[0]).counterMarkers[c.id] = [[100, 100], [140, 100], [180, 100]].map(([x, y]) => ({ x, y, id: App.uid(), group: null }));
    App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
  });
  await expect.poll(() => localBackupPdfBytes(page), { timeout: 30000 }).toBeGreaterThan(0);   // the device backup has the work
  return true;
}
const signInFromInsideTheApp = async (page) => {
  await page.evaluate(() => window.App.showModal('authModal'));
  await page.locator('#authDevBypass').click();
};

// Best effort: close (turns in) and delete whatever autosave created for this spec.
async function cleanup(page) {
  try {
    if (!(await page.evaluate(() => !!window.state?.supabaseSession?.user))) return;
    await page.waitForTimeout(6000);   // let an autosave that is creating the project finish, so it can be found
    await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => window.App.hideModal(m.id)));
    // closeProject asks before dropping marks that are not in the cloud yet: answer it
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

test.describe('Signing in keeps the takeoff made signed out', () => {
  test.afterEach(async ({ page }) => { await cleanup(page); });

  test('a browser with no reload stamp: no reload, the plan and the marks stay, the stamp is adopted', async ({ page }) => {
    test.setTimeout(120000);
    let loads = 0;
    page.on('load', () => { loads++; });
    if (!(await takeoffSignedOut(page))) { test.skip(true, 'Dev auth not configured; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD in config.local.js'); return; }
    expect(await page.evaluate((k) => localStorage.getItem(k), STAMP_KEY)).toBeNull();
    const loadsBefore = loads;
    await signInFromInsideTheApp(page);
    await page.waitForFunction(() => !!window.state?.supabaseSession?.user, null, { timeout: 20000 });
    // the check is async after sign-in: wait for its verdict, then give a reload time to show itself
    await page.waitForFunction((k) => localStorage.getItem(k) != null, STAMP_KEY, { timeout: 20000 });
    await page.waitForTimeout(3000);
    expect(loads).toBe(loadsBefore);
    expect(await page.evaluate(() => window.state.pages.length)).toBe(1);
    expect(await markCount(page)).toBe(3);
    expect(await page.evaluate(() => (window.App.getSaveStatusLog() || []).map((e) => e.kind))).toContain('global_reload_baseline');
  });

  test('a stale stamp: the force reload happens, keeps the backups, and the work is offered back', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript((k) => { if (localStorage.getItem(k) == null) localStorage.setItem(k, '1000'); }, STAMP_KEY);   // long before any real broadcast
    if (!(await takeoffSignedOut(page))) { test.skip(true, 'Dev auth not configured; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD in config.local.js'); return; }
    const reloaded = page.waitForEvent('load', { timeout: 30000 });
    await signInFromInsideTheApp(page);
    await reloaded;
    await page.waitForFunction(() => window.App && window.App.bootSettled === true, null, { timeout: 30000 });
    expect(Number(await page.evaluate((k) => localStorage.getItem(k), STAMP_KEY))).toBeGreaterThan(1000);   // the reload committed the real stamp
    // the backups survived the cache clear, so the work is offered back and Keep restores it
    await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/, { timeout: 20000 });
    await page.locator('#lastSessionRestoreKeep').click();
    await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 30000 });
    expect(await markCount(page)).toBe(3);
  });
});

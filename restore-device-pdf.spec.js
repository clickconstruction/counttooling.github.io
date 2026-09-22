// @ts-check
/**
 * Keep restores from the device's PDF when the cloud has none, and the PDF then
 * reaches the cloud by itself.
 *
 * Signed in, a plan opened and marked but never explicitly saved: the engine's
 * autosave creates the cloud project and syncs the marks within seconds, then
 * starts uploading the PDF. A reload before that upload lands leaves the cloud
 * row with no pdf_path and the device backup holding the only copy of the file.
 * Keep on the "Project from Last Session" offer used to fail there with "No PDF
 * available for this project" (the device PDF was only trusted when the device's
 * MARKS were newer than the cloud's, and they had already synced). Guards: Keep
 * brings back the plan and the marks, editable; the engine uploads the PDF on its
 * own (no Save click); a later edit autosaves. Second case, the reload beat even
 * the device backup's first write, so the PDF is nowhere: Keep hands off to Load
 * Project's "this project needs its PDF" dialog instead of failing, the file is
 * given again, the saved marks land on it, and it uploads.
 *
 * Cloud-gated: needs SUPABASE_* plus DEV_AUTH_EMAIL/DEV_AUTH_PASSWORD in
 * config.local.js; self-skips otherwise, like the other cloud specs. Storage
 * uploads are held with page.route until the reload, so the cut-short upload is
 * deterministic. Creates one project named for its file and deletes it at the end
 * (the nightly purge is the backstop).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FILE_NAME = 'spec-restore-device-pdf.pdf';
const PROJECT_NAME = 'spec-restore-device-pdf';
const SAMPLE = path.join(__dirname, 'samples', 'sample-plan-advanced.pdf');
const STORAGE = /supabase\.co\/storage\/v1\//;
const holdUploads = (route) => (route.request().method() === 'GET' ? route.continue() : route.abort());
const deviceBackupPdfBytes = (page, id) => page.evaluate(async (k) => { const b = await window.__takeoffBackupGetForTest(k, null); return b && b.pdfBlob ? b.pdfBlob.size : 0; }, id);
const markCount = (page) => page.evaluate(() => { const a = window.App.getActiveAnnotations(window.state.pages[0]); return Object.values(a.counterMarkers).reduce((n, x) => n + x.length, 0); });

function watch(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' || (m.location()?.url || '').includes('config.local.js')) return;
    if (/ERR_FAILED|Failed to load resource/i.test(m.text())) return;   // the uploads this spec holds back on purpose
    errors.push(m.text());
  });
  page.on('pageerror', (err) => { errors.push(err.message); });
  return errors;
}

// Signed in, a plan opened and marked, never explicitly saved. Returns the project id the
// engine's autosave created, or null when dev auth is not configured (the caller skips).
async function startUnsavedSignedInProject(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app/?devAuth=1');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  const signedIn = await page.waitForFunction(() => !!window.state?.supabaseSession?.user, null, { timeout: 8000 }).catch(() => null);
  if (!signedIn) return null;
  await page.waitForFunction(() => window.App.bootSettled === true, null, { timeout: 20000 });
  await page.evaluate(() => { if (window.App.isRestorePromptPending()) window.App.dismissLastSessionRestorePrompt(); });
  // The PDF's way to the cloud is shut until the reload: the marks sync, the file does not.
  await page.route(STORAGE, holdUploads);
  await page.locator('#pdfInput').setInputFiles({ name: FILE_NAME, mimeType: 'application/pdf', buffer: fs.readFileSync(SAMPLE) });
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
    App.getActiveAnnotations(s.pages[0]).counterMarkers[c.id] = [[300, 300], [340, 300], [380, 300]].map(([x, y]) => ({ x, y, id: App.uid(), group: null }));
    App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
  });
  // autosave creates the cloud project on its own and syncs the marks
  await page.waitForFunction(() => !!window.state.currentProjectId && (window.App.getSaveStatusLog() || []).some((e) => e.kind === 'autosave_ok'), null, { timeout: 60000 });
  expect(await page.evaluate(() => window.state.pdfStoragePath)).toBeFalsy();
  return page.evaluate(() => window.state.currentProjectId);
}

async function reloadAndKeep(page) {
  await page.unroute(STORAGE, holdUploads);
  await page.goto('/app/');
  await page.waitForFunction(() => !!window.state?.supabaseSession?.user, null, { timeout: 20000 });
  await expect(page.locator('#lastSessionRestoreModal')).toHaveClass(/visible/, { timeout: 20000 });
  await expect(page.locator('#lastSessionRestoreMessage')).toContainText('restore-');
}

async function pdfReachesCloudAndEditsAutosave(page) {
  // the PDF reaches the cloud by itself: no Save click
  await page.waitForFunction(() => !!window.state.pdfStoragePath, null, { timeout: 90000 });
  // and the project keeps syncing: one more mark, autosaved
  const mark = await page.evaluate(() => (window.App.getSaveStatusLog() || []).length);
  await page.evaluate(() => { const s = window.state, App = window.App; const a = App.getActiveAnnotations(s.pages[0]); const id = Object.keys(a.counterMarkers)[0]; a.counterMarkers[id].push({ x: 420, y: 300, id: App.uid(), group: null }); App.markProjectDirty(); App.renderAnnotations(); App.updateUI(); });
  await page.waitForFunction((m) => (window.App.getSaveStatusLog() || []).slice(m).some((e) => e.kind === 'autosave_ok'), mark, { timeout: 60000 });
}

// Best effort: close (turns in) and delete the spec's projects. The nightly purge is the backstop.
async function cleanup(page) {
  try {
    await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => window.App.hideModal(m.id)));
    await page.evaluate(() => window.App.closeProject({ route: 'spec_cleanup' }));
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

test.describe('Keep on a cloud project whose PDF never reached the cloud', () => {
  test('the device holds the PDF: Keep restores from it, the PDF uploads by itself, a later edit autosaves', async ({ page }) => {
    test.setTimeout(240000);
    const errors = watch(page);
    const projectId = await startUnsavedSignedInProject(page);
    if (!projectId) { test.skip(true, 'Dev auth not configured or failed; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD in config.local.js'); return; }
    try {
      // the device backup (written on the engine's interval) holds the only copy of the file
      await expect.poll(() => deviceBackupPdfBytes(page, projectId), { timeout: 30000 }).toBeGreaterThan(0);
      await reloadAndKeep(page);
      await page.locator('#lastSessionRestoreKeep').click();
      await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 30000 });
      expect(await page.evaluate(() => ({ projectId: window.state.currentProjectId, isViewer: window.state.isViewer }))).toEqual({ projectId, isViewer: false });
      expect(await markCount(page)).toBe(3);
      await expect(page.locator('#toastRegion .toast-card.visible', { hasText: 'Failed to restore' })).toHaveCount(0);
      await pdfReachesCloudAndEditsAutosave(page);
      expect(errors, 'console errors: ' + errors.join('\n')).toEqual([]);
    } finally { await cleanup(page); }
  });

  test('the PDF is nowhere: Keep asks for the file instead of failing, lays the marks on it, and uploads it', async ({ page }) => {
    test.setTimeout(240000);
    const errors = watch(page);
    const projectId = await startUnsavedSignedInProject(page);
    if (!projectId) { test.skip(true, 'Dev auth not configured or failed; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD in config.local.js'); return; }
    try {
      await reloadAndKeep(page);
      // the reload beat the device backup's first write (made certain here): no copy anywhere
      await page.evaluate((id) => window.__takeoffBackupDeleteForTest(id), projectId);
      await page.locator('#lastSessionRestoreKeep').click();
      await expect(page.locator('#canvasOnlyNeedsPdfModal')).toHaveClass(/visible/, { timeout: 30000 });
      await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
      await expect(page.locator('#toastRegion .toast-card.visible', { hasText: 'Failed to restore' })).toHaveCount(0);
      expect(await page.evaluate(() => ({ pending: window.App.isRestorePromptPending(), projectId: window.state.currentProjectId }))).toEqual({ pending: false, projectId });
      // the estimator gives it the file again: the saved marks land on it
      await page.locator('#pdfInput').setInputFiles({ name: FILE_NAME, mimeType: 'application/pdf', buffer: fs.readFileSync(SAMPLE) });
      await page.waitForFunction(() => window.state.pages.length === 1, null, { timeout: 30000 });
      await expect.poll(() => markCount(page), { timeout: 20000 }).toBe(3);   // the intake lays the saved marks on after the pages land
      await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => window.App.hideModal(m.id)));
      await pdfReachesCloudAndEditsAutosave(page);
      expect(errors, 'console errors: ' + errors.join('\n')).toEqual([]);
    } finally { await cleanup(page); }
  });
});

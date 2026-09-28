// @ts-check
/**
 * Renaming a project from Project Settings (features/project-settings.js).
 *
 * Reported 2026-09-28: "I am not finding where to rename a project under project
 * settings". The name was read-only text under the title; its one door was the name
 * field inside the Save dialog. Now the name line is the control: the name, then Rename,
 * which turns the name into a field in place. Pinned here: the rename itself and every
 * place the name is read, Enter / Esc / a click away, the project that may not be
 * renamed (a viewer, a view link, a sample plan), the names no project may take, and
 * the second door in the header bid menu.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, uploadPdf, collectConsoleErrors } = require('./spec-helpers');

async function openBid(page, name, extra) {
  await page.evaluate(([nm, more]) => {
    const s = window.App.state;
    s.supabaseSession = { user: { id: 'u1', email: 'estimator@example.com' } };
    s.currentProjectId = 'proj-rename';
    s.currentProjectName = nm;
    s.checkedOutBy = 'u1';
    s.isViewer = false;
    s.loadedViaViewLink = false;
    Object.assign(s, more || {});
    window.App.updateUI();
  }, [name, extra || null]);
}
const openSettings = async (page) => {
  await page.evaluate(() => document.getElementById('settingsGearBtn').click());
  await page.waitForSelector('#settingsModal.visible');
};
const projectName = (page) => page.evaluate(() => window.App.state.currentProjectName);

test.describe('Rename a project (Project Settings)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    // The cloud is not what is under test: the rename rides the next save, like any edit.
    await page.route('**/rest/v1/**', (r) => r.abort());
    await page.route('**/auth/v1/**', (r) => r.abort());
  });

  test('Rename turns the name into a field; Enter keeps it everywhere the name is read', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: [/Failed to load resource/i, /net::ERR_FAILED/i, /fetch/i] });
    await bootApp(page);
    await uploadPdf(page);
    await openBid(page, 'Prue Rd EC');
    await openSettings(page);

    await expect(page.locator('#settingsSubtitle')).toHaveText('Prue Rd EC');
    const link = page.locator('#settingsRenameProject');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('Rename');
    await expect(page.locator('#settingsRenameEdit')).toBeHidden();

    await link.click();
    const input = page.locator('#settingsRenameInput');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Prue Rd EC');
    await expect(page.locator('#settingsSubtitle')).toBeHidden();

    await input.fill('  Second   Rodeo Brewing · Plumbing ');
    await input.press('Enter');

    // Trimmed, inner runs of spaces folded.
    expect(await projectName(page)).toBe('Second Rodeo Brewing · Plumbing');
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/);
    await expect(page.locator('#settingsSubtitle')).toHaveText('Second Rodeo Brewing · Plumbing');
    await expect(page.locator('#settingsRenameEdit')).toBeHidden();
    await expect(page.locator('#headerBidChipName')).toHaveText('Second Rodeo Brewing · Plumbing');
    await expect(page.locator('#airboardToastText')).toContainText('Renamed to');
    // The next save carries it: the project is dirty, and the Save dialog opens on the new name.
    expect(await page.evaluate(() => !!window.App.getAutoSaveDirty())).toBe(true);
    const recent = await page.evaluate(() => JSON.parse(localStorage.getItem('recentBids') || '[]'));
    expect(recent[0]).toMatchObject({ id: 'proj-rename', name: 'Second Rodeo Brewing · Plumbing' });
    errors.assertNoErrors();
  });

  test('the next autosave writes the new name to the project row', async ({ page }) => {
    const writes = [];
    await page.unroute('**/rest/v1/**');
    await page.route('**/rest/v1/**', async (r) => {
      const req = r.request();
      if (/\/rest\/v1\/projects/.test(req.url()) && req.method() === 'PATCH') {
        try { writes.push(JSON.parse(req.postData() || '{}')); } catch (_) { /* not JSON */ }
        return r.fulfill({ status: 200, contentType: 'application/json', body: '[{"id":"proj-rename"}]' });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await bootApp(page);
    await uploadPdf(page);
    await openBid(page, 'Prue Rd EC', { checkedOutAt: new Date().toISOString(), pdfStoragePath: 'u1/proj-rename.pdf', pdfHash: 'abc' });
    await openSettings(page);
    await page.locator('#settingsRenameProject').click();
    await page.locator('#settingsRenameInput').fill('Second Rodeo Brewing');
    await page.locator('#settingsRenameInput').press('Enter');
    await page.evaluate(() => window.App.performAutoSave && window.App.performAutoSave());
    await expect.poll(() => writes.map((w) => w.name), { timeout: 15000 }).toContain('Second Rodeo Brewing');
  });

  test('Esc puts the old name back and leaves the dialog open; a click away keeps the new one', async ({ page }) => {
    await bootApp(page);
    await uploadPdf(page);
    await openBid(page, 'Prue Rd EC');
    await openSettings(page);

    await page.locator('#settingsRenameProject').click();
    await page.locator('#settingsRenameInput').fill('Something else');
    await page.locator('#settingsRenameInput').press('Escape');
    expect(await projectName(page)).toBe('Prue Rd EC');
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/);
    await expect(page.locator('#settingsSubtitle')).toHaveText('Prue Rd EC');
    await expect(page.locator('#settingsRenameProject')).toBeVisible();

    await page.locator('#settingsRenameProject').click();
    await page.locator('#settingsRenameInput').fill('Prue Rd EC · Addendum 2');
    await page.locator('#settingsRenameSave').click();
    expect(await projectName(page)).toBe('Prue Rd EC · Addendum 2');

    await page.locator('#settingsRenameProject').click();
    await page.locator('#settingsRenameInput').fill('Prue Rd EC · Addendum 3');
    await page.locator('#settingsTitle').click();
    expect(await projectName(page)).toBe('Prue Rd EC · Addendum 3');

    // An empty field keeps the name the project had.
    await page.locator('#settingsRenameProject').click();
    await page.locator('#settingsRenameInput').fill('   ');
    await page.locator('#settingsRenameInput').press('Enter');
    expect(await projectName(page)).toBe('Prue Rd EC · Addendum 3');
  });

  test('a bid nobody named is asked for its name, and the field opens empty', async ({ page }) => {
    await bootApp(page);
    await uploadPdf(page);
    await openBid(page, 'Untitled');
    await openSettings(page);
    await expect(page.locator('#settingsRenameProject')).toHaveText('Name this project');
    await page.locator('#settingsRenameProject').click();
    await expect(page.locator('#settingsRenameInput')).toHaveValue('');
    await page.locator('#settingsRenameInput').fill('Second Rodeo Brewing');
    await page.locator('#settingsRenameInput').press('Enter');
    await expect(page.locator('#settingsRenameProject')).toHaveText('Rename');
  });

  test('signed out, a plan on this device is renamed the same way', async ({ page }) => {
    await bootApp(page);
    await uploadPdf(page);
    await openSettings(page);
    await page.locator('#settingsRenameProject').click();
    await page.locator('#settingsRenameInput').fill('Garage addition');
    await page.locator('#settingsRenameInput').press('Enter');
    expect(await projectName(page)).toBe('Garage addition');
  });

  test('who may not rename: nothing open, a view link, a viewer, a sample plan', async ({ page }) => {
    await bootApp(page);
    // Nothing open: no name line at all.
    await openSettings(page);
    await expect(page.locator('#settingsNameLine')).toBeHidden();
    await page.evaluate(() => window.App.hideModal('settingsModal'));

    await uploadPdf(page);
    // A view link is a window onto someone else's bid.
    await openBid(page, 'Prue Rd EC', { isViewer: true, loadedViaViewLink: true });
    await openSettings(page);
    await expect(page.locator('#settingsSubtitle')).toHaveText('Prue Rd EC');
    await expect(page.locator('#settingsRenameProject')).toBeHidden();
    expect((await page.evaluate(() => window.App.renameProject('Hijacked'))).ok).toBe(false);
    await page.evaluate(() => window.App.hideModal('settingsModal'));

    // A viewer who could check out is told how; the name does not change.
    await openBid(page, 'Prue Rd EC', { isViewer: true, canCheckOut: true, checkedOutBy: null });
    await openSettings(page);
    await page.locator('#settingsRenameProject').click();
    await expect(page.locator('#settingsRenameEdit')).toBeHidden();
    await expect(page.locator('#airboardToastText')).toContainText('Check out the project to rename it');
    expect(await projectName(page)).toBe('Prue Rd EC');
    await page.evaluate(() => window.App.hideModal('settingsModal'));

    // A sample plan is found by its name, so it keeps it.
    await openBid(page, 'sample-plan');
    await openSettings(page);
    await expect(page.locator('#settingsRenameProject')).toBeHidden();
  });

  test('no project may take a sample plan\'s name', async ({ page }) => {
    await bootApp(page);
    await uploadPdf(page);
    await openBid(page, 'Prue Rd EC');
    await openSettings(page);
    await page.locator('#settingsRenameProject').click();
    await page.locator('#settingsRenameInput').fill('sample-lessons');
    await page.locator('#settingsRenameInput').press('Enter');
    expect(await projectName(page)).toBe('Prue Rd EC');
    await expect(page.locator('#airboardToastText')).toContainText('sample plan');
  });

  test('the header bid menu offers Rename this bid, and opens the field', async ({ page }) => {
    await bootApp(page);
    await uploadPdf(page);
    await openBid(page, 'Prue Rd EC');
    await page.locator('#headerBidChip').click();
    const row = page.locator('#headerBidMenu .bm-row.bm-rename');
    await expect(row).toHaveText(/Rename this bid/);
    await row.click();
    await expect(page.locator('#headerBidMenu')).toBeHidden();
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/);
    await expect(page.locator('#settingsRenameInput')).toBeFocused();
    await expect(page.locator('#settingsRenameInput')).toHaveValue('Prue Rd EC');

    // A viewer's menu has no such row.
    await page.locator('#settingsRenameInput').press('Escape');
    await page.evaluate(() => window.App.hideModal('settingsModal'));
    await openBid(page, 'Prue Rd EC', { isViewer: true });
    await page.locator('#headerBidChip').click();
    await expect(page.locator('#headerBidMenu .bm-row.is-current')).toBeVisible();
    await expect(page.locator('#headerBidMenu .bm-row.bm-rename')).toHaveCount(0);
  });

  test('on a phone the field and Save fit the card', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await bootApp(page);
    await uploadPdf(page);
    await page.evaluate(() => { window.App.state.currentProjectName = 'Bastrop ISD High School Field House Addition · M-201'; document.getElementById('sidebarLogoGear').click(); });
    await page.waitForSelector('#settingsModal.visible');
    const box = (sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
    const card = await box('#settingsModal .modal-card');
    // A long name gives way to Rename, which stays on the card.
    const link = await box('#settingsRenameProject');
    expect(link.right).toBeLessThanOrEqual(card.right);
    expect(link.width).toBeGreaterThan(20);
    await page.locator('#settingsRenameProject').click();
    const save = await box('#settingsRenameSave');
    const input = await box('#settingsRenameInput');
    expect(save.right).toBeLessThanOrEqual(card.right);
    expect(input.width).toBeGreaterThan(120);
    expect(input.height).toBeGreaterThanOrEqual(40);
  });
});

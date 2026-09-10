// @ts-check
/**
 * Close project — one routine (App.closeProject) behind every door: Project
 * Settings, the header cloud menu, the "Project turned in." toast's link and
 * the admin force-turn-in notice (Wendi, 2026-09-10: "I just refresh after I
 * turn things in"). Guards: the cloud-menu row appears only once a project is
 * open (never for a view-link session); a local-only takeoff confirms before
 * it closes (the work lives on this device alone); the toast and the notice
 * carry the door and it closes the project; every door leaves an empty app.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// Wait for the intake to have reconciled the UI (the sidebar rows exist —
// attached, not visible: after a close the Pages section is collapsed), not
// for the transient moment state.pages is first assigned.
async function openLocalPlan(page) {
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForFunction(() => window.state.pages.length === 2 && document.querySelectorAll('#pagesList .sidebar-item').length === 2, null, { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('exportDropdownBtn').getAttribute('aria-label') === 'Export', null, { timeout: 10000 });
}

test.describe('Close project', () => {
  test('the cloud menu row: absent with no project, present once one is open, confirms for a local-only takeoff, empties the app', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => typeof window.App.closeProject)).toBe('function');
    const row = page.locator('.export-dropdown-option[data-action="close-project"]');
    // no project: the menu button is the upload shortcut and the row is hidden
    expect(await row.isVisible()).toBe(false);
    await openLocalPlan(page);
    expect(await page.locator('#exportDropdown').isVisible()).toBe(true);
    await page.click('#exportDropdownBtn');
    expect(await row.isVisible()).toBe(true);
    await row.click();
    await page.waitForFunction(() => window.state.pages.length === 0);
    expect(dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('Close project?');
    expect(await page.locator('#exportDropdownMenu').evaluate((m) => m.classList.contains('visible'))).toBe(false);
    expect(await row.isVisible()).toBe(false);
    // the Settings door is the same routine (cancelling the confirm keeps the project)
    await openLocalPlan(page);
    page.removeAllListeners('dialog');
    page.on('dialog', async (d) => { await d.dismiss(); });
    await page.evaluate(() => window.App.closeProject({ route: 'settings' }));
    expect(await page.evaluate(() => window.state.pages.length)).toBe(2);
    expect(errors).toEqual([]);
  });

  test('a view-link session never sees the row', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await openLocalPlan(page);
    await page.evaluate(() => { window.state.loadedViaViewLink = true; window.App.updateUI(); });
    expect(await page.locator('.export-dropdown-option[data-action="close-project"]').isVisible()).toBe(false);
    await page.evaluate(() => { window.state.loadedViaViewLink = false; window.App.updateUI(); });
    await page.click('#exportDropdownBtn');
    expect(await page.locator('.export-dropdown-option[data-action="close-project"]').isVisible()).toBe(true);
  });

  test('the "Project turned in." toast and the force-turn-in notice both carry Close project, and it closes', async ({ page }) => {
    page.on('dialog', async (d) => { await d.accept(); });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await openLocalPlan(page);
    // the toast: text rewritten per call, the link is a real button
    await page.evaluate(() => window.App.showTurnedInToast('Project turned in.'));
    expect(await page.locator('#turnedInToastModal').evaluate((m) => m.classList.contains('visible'))).toBe(true);
    expect(await page.locator('#turnedInToastText').textContent()).toBe('Project turned in.');
    await page.click('#turnedInToastClose');
    await page.waitForFunction(() => window.state.pages.length === 0);
    expect(await page.locator('#turnedInToastModal').evaluate((m) => m.classList.contains('visible'))).toBe(false);
    // the notice the demoted editor sees
    await openLocalPlan(page);
    expect(await page.evaluate(() => window.App.openForceTurnInNoticeModal({ hadDirty: false }))).toBe(true);
    expect(await page.locator('#forceTurnInNoticeModal').evaluate((m) => m.classList.contains('visible'))).toBe(true);
    await page.click('#forceTurnInNoticeClose');
    await page.waitForFunction(() => window.state.pages.length === 0);
    expect(await page.locator('#forceTurnInNoticeModal').evaluate((m) => m.classList.contains('visible'))).toBe(false);
  });
});

// @ts-check
/**
 * Tests: the window.App registry pilot #14 - the two Groups modals (groupModal
 * create/edit + groupAssignModal) extracted to features/groups.js still create /
 * edit groups and assign an item to a group.
 *
 * First two-modal move and first core-function -> feature callback (the
 * hideModal('groupModal') hook calls App.onGroupModalHidden to reset the
 * now-private openedGroupModalFromAssign flag). One new publish-only dep
 * (App.deleteGroup, stays in app.js); the rest were already on App. Guards the
 * registry contract plus the create, edit, and assign flows.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Groups modals', () => {
  test('registry wired; create / edit / assign flows work with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the three entry points the feature file registers.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openGroupModal,
      assign: typeof window.App?.openGroupAssignModal,
      onHidden: typeof window.App?.onGroupModalHidden,
    }));
    expect(wired).toEqual({ open: 'function', assign: 'function', onHidden: 'function' });

    // 3. CREATE: open the group modal (add mode), name it, Done.
    await page.evaluate(() => window.App.openGroupModal(null));
    await page.waitForSelector('#groupModal.visible', { timeout: 5000 });
    await page.locator('#groupModalName').fill('Spec Group');
    await page.locator('#groupModalDone').click();
    await page.waitForFunction(
      () => !document.getElementById('groupModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const created = await page.evaluate(() => {
      const groups = window.state.groups;
      const last = groups[groups.length - 1];
      return { count: groups.length, name: last?.name, id: last?.id, activeIsLast: window.state.activeGroupId === last?.id };
    });
    expect(created.count).toBe(1);
    expect(created.name).toBe('Spec Group');
    expect(created.activeIsLast).toBe(true);

    // 4. EDIT: reopen on the group object, rename, Done.
    await page.evaluate(() => window.App.openGroupModal(window.state.groups[0]));
    await page.waitForSelector('#groupModal.visible', { timeout: 5000 });
    expect(await page.locator('#groupModalTitle').textContent()).toBe('Edit Group');
    await page.locator('#groupModalName').fill('Spec Group Edited');
    await page.locator('#groupModalDone').click();
    await page.waitForFunction(
      () => !document.getElementById('groupModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => window.state.groups[0].name)).toBe('Spec Group Edited');

    // 5. ASSIGN: open the assign modal on a synthetic item, pick the group, Done.
    await page.evaluate(() => { window.__assignItem = { group: null }; window.App.openGroupAssignModal(window.__assignItem); });
    await page.waitForSelector('#groupAssignModal.visible', { timeout: 5000 });
    const groupId = created.id;
    await page.evaluate((gid) => {
      const btn = Array.from(document.querySelectorAll('#groupAssignButtons .group-assign-btn'))
        .find(b => b.dataset.groupId === gid);
      btn.click();
    }, groupId);
    await page.locator('#groupAssignDone').click();
    await page.waitForFunction(
      () => !document.getElementById('groupAssignModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => window.__assignItem.group)).toBe(groupId);

    expect(errors).toEqual([]);
  });
});

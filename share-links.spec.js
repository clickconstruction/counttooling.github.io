// @ts-check
/**
 * features/share-links.js (feature-file split #27): the Share Project modal
 * (people list + view links list/create/copy/access-log/revoke), extracted
 * from app.js onto the window.App registry.
 *
 * The always-run registry test guards the contract and load-time DOM bindings.
 * The behavioral tests exercise the full RPC surface WITHOUT cloud
 * credentials by stubbing App.getSupabase() with a fake client — legitimate
 * because the feature's own boundary rule is to re-read the client through
 * that accessor at every await site — and routing the invite-to-project Edge
 * Function fetch. Covered: people list + view-links render (incl. HTML
 * escaping), role change, remove, create view link, confirm-gated revoke
 * (+ the App.onViewLinkRevoked feature-to-feature hook), access log, invite
 * success/failure, RPC failure surfacing, and the loadedViaViewLink gate.
 */
const { test, expect } = require('@playwright/test');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function bootApp(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
}

/**
 * Install a fake Supabase client behind App.getSupabase() and give the page a
 * cloud project. RPC results live on window.__rpcData (mutable from tests);
 * every call is recorded on window.__rpcCalls.
 */
async function installRpcStub(page) {
  await page.evaluate(() => {
    const w = /** @type {any} */ (window);
    w.__rpcCalls = [];
    w.__rpcData = {
      list_users_for_project_invite: { data: [{ id: 'u9', email: 'new.crew@clickplumbing.com' }], error: null },
      list_project_shares: {
        data: [
          { user_id: 'u1', email: 'owner@clickplumbing.com', role: 'owner' },
          { user_id: 'u2', email: 'viewer<img src=x onerror="window.__xss=1">@clickplumbing.com', role: 'viewer' },
        ],
        error: null,
      },
      list_view_links: { data: [{ id: 'vl1', token: 'tok-1', name: 'Field crew', created_at: '2026-07-01T00:00:00Z' }], error: null },
      get_view_link_access_log: { data: [{ email: 'crew@clickplumbing.com', accessed_at: '2026-07-02T00:00:00Z' }], error: null },
      add_project_share: { data: { ok: true }, error: null },
      remove_project_share: { data: { ok: true }, error: null },
      create_view_link: { data: { ok: true, token: 'tok-new' }, error: null },
      revoke_view_link: { data: { ok: true }, error: null },
    };
    w.App.getSupabase = () => ({
      rpc: (name, args) => {
        w.__rpcCalls.push({ name, args });
        return Promise.resolve(w.__rpcData[name] || { data: null, error: { message: 'unstubbed rpc ' + name } });
      },
    });
    w.App.state.currentProjectId = 'proj-1';
    w.App.state.supabaseSession = { user: { id: 'u1', email: 'owner@clickplumbing.com' }, access_token: 'spec-token' };
  });
}

async function openModal(page) {
  await page.evaluate(() => window.App.openShareProjectModal());
  await page.waitForSelector('#shareProjectModal.visible', { timeout: 5000 });
  // The view-links list loads after the people list; wait for both to settle.
  await page.waitForFunction(() => {
    const links = document.getElementById('shareViewLinksList');
    return document.querySelectorAll('#shareProjectList .share-project-row').length > 0
      && links && !/Loading/.test(links.textContent || '');
  }, { timeout: 5000 });
  // The view-links section starts collapsed (app/index.html) — expand it so
  // its buttons are clickable.
  await page.evaluate(() => {
    const content = document.getElementById('shareViewLinksContent');
    if (content?.classList.contains('collapsed')) document.getElementById('shareViewLinksHeader')?.click();
  });
}

function rpcCalls(page, name) {
  return page.evaluate((n) => /** @type {any} */ (window).__rpcCalls.filter((c) => !n || c.name === n), name);
}

test.describe('Share project & view links (features/share-links.js)', () => {
  test('registry wired; no-session open is a no-op; bindings live', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);

    expect(await page.evaluate(() => typeof window.App?.openShareProjectModal)).toBe('function');
    expect(await page.evaluate(() => typeof window.App?.onViewLinkRevoked)).toBe('function');

    // No cloud project / no session -> early return; the modal stays hidden.
    await page.evaluate(() => window.App.openShareProjectModal());
    await expect(page.locator('#shareProjectModal')).not.toHaveClass(/visible/);

    // The view-links collapse toggle bound at feature load works.
    const toggled = await page.evaluate(() => {
      const content = document.getElementById('shareViewLinksContent');
      const icon = document.getElementById('shareViewLinksCollapseIcon');
      const before = content.classList.contains('collapsed');
      document.getElementById('shareViewLinksHeader').click();
      const mid = { collapsed: content.classList.contains('collapsed'), icon: icon.textContent };
      document.getElementById('shareViewLinksHeader').click();
      const after = { collapsed: content.classList.contains('collapsed'), icon: icon.textContent };
      return { before, mid, after };
    });
    expect(toggled.mid.collapsed).toBe(!toggled.before);
    expect(toggled.after.collapsed).toBe(toggled.before);

    // The close binding hides a force-shown modal.
    await page.evaluate(() => {
      document.getElementById('shareProjectModal').classList.add('visible');
      document.getElementById('shareProjectModalClose').click();
    });
    await expect(page.locator('#shareProjectModal')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });

  test('renders people + view links from the RPCs; emails HTML-escaped; URL carries ?t=', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await installRpcStub(page);
    await openModal(page);

    const view = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#shareProjectList .share-project-row')];
      const copyBtn = document.querySelector('#shareViewLinksList .share-view-link-copy');
      return {
        rowCount: rows.length,
        ownerText: rows[0]?.textContent || '',
        viewerHasRoleSelect: !!rows[1]?.querySelector('.share-project-role-select'),
        viewerHasRemove: !!rows[1]?.querySelector('.share-project-remove-btn'),
        viewerText: rows[1]?.textContent || '',
        injectedImg: !!document.querySelector('#shareProjectList img'),
        xssRan: /** @type {any} */ (window).__xss === 1,
        linkName: document.querySelector('#shareViewLinksList .share-view-link-row span')?.textContent,
        linkUrl: copyBtn?.getAttribute('data-url'),
      };
    });
    expect(view.rowCount).toBe(2);
    expect(view.ownerText).toContain('Owner: owner@clickplumbing.com');
    expect(view.viewerHasRoleSelect).toBe(true);
    expect(view.viewerHasRemove).toBe(true);
    // The hostile email renders as text — never as markup.
    expect(view.viewerText).toContain('viewer<img');
    expect(view.injectedImg).toBe(false);
    expect(view.xssRan).toBe(false);
    expect(view.linkName).toBe('Field crew');
    expect(view.linkUrl).toContain('/app/?t=tok-1');

    expect(await rpcCalls(page, 'list_users_for_project_invite')).toHaveLength(1);
    expect(await rpcCalls(page, 'list_project_shares')).toHaveLength(1);
    expect(await rpcCalls(page, 'list_view_links')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('role change and remove call their RPCs with the right args and refresh', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await installRpcStub(page);
    await openModal(page);

    await page.locator('#shareProjectList .share-project-role-select').selectOption('editor');
    await page.waitForFunction(
      () => /** @type {any} */ (window).__rpcCalls.some((c) => c.name === 'add_project_share'),
      { timeout: 5000 },
    );
    const roleCall = (await rpcCalls(page, 'add_project_share'))[0];
    expect(roleCall.args).toEqual({ p_project_id: 'proj-1', p_target_user_id: 'u2', p_role: 'editor' });

    // The success path re-opens the modal (a refresh): shares listed again.
    await page.waitForFunction(
      () => /** @type {any} */ (window).__rpcCalls.filter((c) => c.name === 'list_project_shares').length >= 2,
      { timeout: 5000 },
    );

    await page.locator('#shareProjectList .share-project-remove-btn').first().click();
    await page.waitForFunction(
      () => /** @type {any} */ (window).__rpcCalls.some((c) => c.name === 'remove_project_share'),
      { timeout: 5000 },
    );
    const removeCall = (await rpcCalls(page, 'remove_project_share'))[0];
    expect(removeCall.args).toEqual({ p_project_id: 'proj-1', p_target_user_id: 'u2' });
    expect(errors).toEqual([]);
  });

  test('revoke is confirm-gated: cancel = no RPC; accept revokes + fires onViewLinkRevoked + refreshes', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await installRpcStub(page);
    await page.evaluate(() => {
      /** @type {any} */ (window).__revokedHook = 0;
      window.App.onViewLinkRevoked = () => { /** @type {any} */ (window).__revokedHook++; };
    });
    await openModal(page);

    page.once('dialog', (d) => d.dismiss());
    await page.locator('.share-view-link-revoke').first().click();
    await page.waitForTimeout(300);
    expect(await rpcCalls(page, 'revoke_view_link')).toHaveLength(0);

    page.once('dialog', (d) => d.accept());
    await page.locator('.share-view-link-revoke').first().click();
    await page.waitForFunction(
      () => /** @type {any} */ (window).__rpcCalls.some((c) => c.name === 'revoke_view_link'),
      { timeout: 5000 },
    );
    const call = (await rpcCalls(page, 'revoke_view_link'))[0];
    expect(call.args).toEqual({ p_token: 'tok-1' });
    expect(await page.evaluate(() => /** @type {any} */ (window).__revokedHook)).toBe(1);
    // Refresh after revoke.
    await page.waitForFunction(
      () => /** @type {any} */ (window).__rpcCalls.filter((c) => c.name === 'list_view_links').length >= 2,
      { timeout: 5000 },
    );
    expect(errors).toEqual([]);
  });

  test('access log alert lists who opened the link', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await installRpcStub(page);
    await openModal(page);

    let alertText = '';
    page.once('dialog', (d) => { alertText = d.message(); return d.accept(); });
    await page.locator('.share-view-link-log').first().click();
    await page.waitForFunction(
      () => /** @type {any} */ (window).__rpcCalls.some((c) => c.name === 'get_view_link_access_log'),
      { timeout: 5000 },
    );
    await expect.poll(() => alertText).toContain('crew@clickplumbing.com');
    expect(errors).toEqual([]);
  });

  test('create view link calls create_view_link and refreshes the list', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await installRpcStub(page);
    await openModal(page);

    await page.locator('#shareViewLinkCreate').click();
    await page.waitForFunction(
      () => /** @type {any} */ (window).__rpcCalls.some((c) => c.name === 'create_view_link'),
      { timeout: 5000 },
    );
    const call = (await rpcCalls(page, 'create_view_link'))[0];
    expect(call.args).toEqual({ p_project_id: 'proj-1', p_name: null, p_expires_at: null });
    // Success path refreshes (clipboard may or may not be grantable headlessly;
    // both branches re-open the modal).
    await page.waitForFunction(
      () => /** @type {any} */ (window).__rpcCalls.filter((c) => c.name === 'list_view_links').length >= 2,
      { timeout: 5000 },
    );
    await expect(page.locator('#shareViewLinkCreate')).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('add person posts to invite-to-project; failure shows the server error', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);

    let inviteBody = null;
    let inviteMode = 'ok';
    await page.route('**/functions/v1/invite-to-project', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS });
        return;
      }
      inviteBody = route.request().postDataJSON();
      const body = inviteMode === 'ok'
        ? { ok: true, email: 'new.crew@clickplumbing.com' }
        : { ok: false, error: 'User not found' };
      await route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    });

    await installRpcStub(page);
    await openModal(page);

    await page.locator('#shareProjectUserSelect').selectOption('new.crew@clickplumbing.com');
    await page.locator('#shareProjectAdd').click();
    await expect.poll(() => inviteBody).toEqual({ project_id: 'proj-1', email: 'new.crew@clickplumbing.com', role: 'viewer' });
    // Success refreshes the people list.
    await page.waitForFunction(
      () => /** @type {any} */ (window).__rpcCalls.filter((c) => c.name === 'list_project_shares').length >= 2,
      { timeout: 5000 },
    );

    inviteMode = 'fail';
    await page.locator('#shareProjectUserSelect').selectOption('new.crew@clickplumbing.com');
    await page.locator('#shareProjectAdd').click();
    await expect(page.locator('#shareProjectError')).toBeVisible();
    await expect(page.locator('#shareProjectError')).toHaveText('User not found');
    expect(errors).toEqual([]);
  });

  test('shares RPC failure surfaces in the modal; view-links section hidden on a view-link session', async ({ page }) => {
    const errors = [];
    await bootApp(page, errors);
    await installRpcStub(page);
    await page.evaluate(() => {
      /** @type {any} */ (window).__rpcData.list_project_shares = { data: null, error: { message: 'permission denied' } };
    });
    await page.evaluate(() => window.App.openShareProjectModal());
    await page.waitForSelector('#shareProjectModal.visible', { timeout: 5000 });
    await expect(page.locator('#shareProjectError')).toBeVisible();
    await expect(page.locator('#shareProjectError')).toContainText('permission denied');

    // A session loaded via a view link never offers view-link management.
    await page.evaluate(() => {
      window.App.state.loadedViaViewLink = true;
      return window.App.openShareProjectModal();
    });
    const hidden = await page.evaluate(() => ({
      section: document.getElementById('shareViewLinksSection')?.style.display,
      create: document.getElementById('shareViewLinkCreate')?.style.display,
    }));
    expect(hidden.section).toBe('none');
    expect(hidden.create).toBe('none');
    expect(errors).toEqual([]);
  });
});

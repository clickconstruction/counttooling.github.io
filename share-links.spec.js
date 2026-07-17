// @ts-check
/**
 * features/share-links.js (feature-file split #27): the Share Project modal
 * (people list + view links list/create/copy/access-log/revoke), extracted
 * from app.js onto the window.App registry.
 *
 * The full share/view-link flow is Supabase-gated (RPCs + Edge Function), so
 * the always-run test guards the registry contract and the DOM the feature
 * bound at load: App.openShareProjectModal is a function; calling it with no
 * cloud project/session is a safe no-op (modal stays hidden, no errors); the
 * view-links section collapse toggle works; the modal close binding hides it;
 * and the feature-to-feature revoke hook (App.onViewLinkRevoked, registered by
 * features/output.js) is present alongside it.
 */
const { test, expect } = require('@playwright/test');

test.describe('Share project & view links (features/share-links.js)', () => {
  test('registry wired; no-session open is a no-op; bindings live', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

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
});

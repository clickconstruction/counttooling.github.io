// @ts-check
/**
 * Tests: the window.App registry pilot #21 - the cloud Load Project modal
 * extracted to features/load-project.js.
 *
 * The full project-browser + load flow is Supabase-gated, so the always-run test
 * only guards the registry contract (the entry point is an async function and
 * calling it is safe - it either surfaces "Cloud not configured" in the Load
 * Project modal, routes to the auth modal, or stays hidden, never throwing). A
 * second, cloud-gated test (skipped without cloud secrets) opens via the
 * registry and asserts the real project list renders.
 */
const { test, expect } = require('@playwright/test');
const { ensureSignedInWithProject } = require('./cloud-test-helpers');

test.describe('window.App registry pilot - Load Project modal', () => {
  test('registry wired; calling without a session is safe', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => typeof window.App?.openLoadProjectModal)).toBe('function');

    // Calling without a session must not throw. Depending on whether cloud is
    // configured it either shows the Load Project modal ("Cloud not configured")
    // or the auth modal; in all cases it resolves cleanly.
    const threw = await page.evaluate(async () => {
      try { await window.App.openLoadProjectModal(); return false; } catch (_) { return true; }
    });
    expect(threw).toBe(false);
    await page.waitForTimeout(200);

    // The admin-only "Advanced" access toggle exists in the modal header and is
    // hidden until shown for an admin session; the hide-access CSS rule is wired.
    const toggle = await page.evaluate(() => {
      const wrap = document.getElementById('loadProjectAdvancedWrap');
      const btn = document.getElementById('loadProjectAdvancedToggle');
      return { wrapHidden: !!wrap && wrap.style.display === 'none', isToggle: !!btn && btn.classList.contains('toggle-switch') };
    });
    expect(toggle).toEqual({ wrapHidden: true, isToggle: true });

    expect(errors).toEqual([]);
  });

  test.describe('cloud-gated full flow', () => {
    let cloudSetup = { ok: false, skipReason: '' };
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      cloudSetup = await ensureSignedInWithProject(page);
      await page.close();
    });

    test('opens via the registry and renders its project list when signed in', async ({ page }) => {
      if (!cloudSetup.ok) { test.skip(true, cloudSetup.skipReason); return; }
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => { errors.push(err.message); });

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/?devAuth=1');
      await page.waitForLoadState('networkidle');
      // Wait for the session to settle so openLoadProjectModal passes its gate.
      await page.waitForFunction(() => !!window.state?.supabaseSession?.access_token, { timeout: 10000 });

      // Open via the registry (the #loadProjectBtn opener routes through the
      // save-before-load gate, which stays in app.js).
      await page.evaluate(() => window.App.openLoadProjectModal());
      await expect(page.locator('#loadProjectModal')).toHaveClass(/visible/, { timeout: 5000 });

      // Either the list renders rows or the empty-state shows - in both cases the
      // modal is up and one of the two surfaces has resolved (no perpetual spinner).
      await page.waitForFunction(
        () => {
          const list = document.getElementById('loadProjectList');
          const empty = document.getElementById('loadProjectEmpty');
          const listReady = !!list && list.textContent.trim().length > 0;
          const emptyReady = !!empty && empty.style.display !== 'none';
          return listReady || emptyReady;
        },
        { timeout: 10000 },
      );

      expect(errors).toEqual([]);
    });
  });
});

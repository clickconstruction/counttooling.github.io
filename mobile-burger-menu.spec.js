// @ts-check
/**
 * Tests: the mobile right-side burger menu (#headerBurger / #rightMenu).
 *
 * On mobile (<=768px) with a PDF loaded, four header controls — Hide marks,
 * Share, Download current page, Export project — are hidden (class
 * `consolidated-mobile`) and consolidated into a right slide-in drawer. The
 * drawer's rows are built by updateBurgerMenu() from the existing option buttons'
 * current visibility and dispatch their clicks, so desktop behavior is reused.
 *
 * Verifies (at a 390px viewport): the burger is gated on a loaded PDF; the four
 * header controls are hidden on mobile; the drawer lists the expected rows; the
 * Hide-marks row toggles state.hideMarks and closes the drawer; the backdrop
 * closes the drawer; a single-page PDF collapses Download to one row; and desktop
 * is unaffected (burger hidden, header dropdowns visible).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const MOBILE = { width: 390, height: 844 };

test.describe('Mobile right-side burger menu', () => {
  test('burger gates on PDF, consolidates the four header controls, rows work', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.setViewportSize(MOBILE);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Burger hidden before a PDF is loaded.
    await expect(page.locator('#headerBurger')).toBeHidden();

    // 2. Load a 2-page PDF -> burger appears; the four header controls are hidden on mobile.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await expect(page.locator('#headerBurger')).toBeVisible();
    for (const id of ['#hideMarksBtn', '#headerShareBtn', '#exportDropdown', '#downloadCurrentPageDropdown']) {
      await expect(page.locator(id)).toBeHidden();
    }

    // 3. Open the drawer -> body.right-menu-open + expected rows.
    await page.locator('#headerBurger').click();
    await expect(page.locator('body')).toHaveClass(/right-menu-open/);
    // Normalize whitespace \u2014 the drawer forces a "(qualifier)" onto its own line
    // (white-space:pre-line + a "\n" before the "("), so labels contain newlines.
    const itemText = async () => (await page.locator('#rightMenuList .right-menu-item').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
    const sectionText = () => page.locator('#rightMenuList .right-menu-section').allTextContents();

    const items = await itemText();
    const sections = await sectionText();
    expect(items).toContain('Hide marks');                       // marks row
    expect(sections).toContain('Download');                       // download section present
    expect(items).toContain('Print Current Page (Current Canvas)'); // always-present download mode
    // 2 pages -> the all-plan-pages modes are present
    expect(items).toContain('Print All Plan Pages (Current Canvas)');
    expect(items).toContain('Print All Pages (All Canvases)');

    // 4. Tap the Hide-marks row -> state.hideMarks flips and the drawer closes.
    await page.locator('#rightMenuList .right-menu-item', { hasText: 'Hide marks' }).click();
    expect(await page.evaluate(() => window.state.hideMarks)).toBe(true);
    await expect(page.locator('body')).not.toHaveClass(/right-menu-open/);

    // 5. Reopen -> the marks row now reads "Show marks" (label reflects state).
    await page.locator('#headerBurger').click();
    await expect(page.locator('body')).toHaveClass(/right-menu-open/);
    expect(await itemText()).toContain('Show marks');

    // 6. Backdrop closes the drawer. Click the exposed left strip (the drawer
    //    covers the backdrop's center on a narrow viewport).
    await page.locator('#rightMenuBackdrop').click({ position: { x: 10, y: 120 } });
    await expect(page.locator('body')).not.toHaveClass(/right-menu-open/);

    expect(errors).toEqual([]);
  });

  test('single-page PDF collapses Download to one row', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.locator('#headerBurger').click();
    const downloadRows = (await page.locator('#rightMenuList .right-menu-item', { hasText: 'Print' }).allTextContents())
      .map(t => t.replace(/\s+/g, ' ').trim());
    expect(downloadRows).toEqual(['Print Current Page (Current Canvas)']);
  });

  test('mobile shared-project viewer gets the copy-link Share row, never the editor modal row', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Simulate a signed-in shared-project VIEWER (role=viewer, not a view link):
    // updateUI hides #sidebarLogoShare for isMobile && isViewer, so the drawer
    // must offer the copy-link row (#headerShareBtn), not the editor Share modal.
    await page.evaluate(() => {
      const s = window.state;
      s.supabaseSession = { user: { id: 'u1', email: 'viewer@clickplumbing.com' } };
      s.currentProjectId = 'p1';
      s.isViewer = true;
      s.loadedViaViewLink = false;
      window.App.updateBurgerMenu();
    });
    const shareTargets = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#rightMenuList .right-menu-item'))
        .filter((b) => /share/i.test(b.textContent || ''));
      // Identify which hidden control each Share row dispatches by clicking it
      // with spies on both candidates.
      let clickedSidebar = 0, clickedHeader = 0;
      const sidebar = document.getElementById('sidebarLogoShare');
      const header = document.getElementById('headerShareBtn');
      const origSidebar = sidebar.onclick, origHeader = header.onclick;
      sidebar.onclick = () => { clickedSidebar++; };
      header.onclick = () => { clickedHeader++; };
      rows.forEach((r) => r.click());
      sidebar.onclick = origSidebar; header.onclick = origHeader;
      return { rowCount: rows.length, clickedSidebar, clickedHeader };
    });
    expect(shareTargets.rowCount).toBe(1);
    expect(shareTargets.clickedSidebar).toBe(0);   // editor modal path must NOT be offered
    expect(shareTargets.clickedHeader).toBe(1);    // copy-link path is
  });

  test('desktop is unaffected: burger hidden, header dropdowns visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await expect(page.locator('#headerBurger')).toBeHidden();
    await expect(page.locator('#downloadCurrentPageDropdown')).toBeVisible();
    await expect(page.locator('#exportDropdown')).toBeVisible();
  });
});

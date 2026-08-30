// @ts-check
/**
 * Tests: desktop header overflow → layered modes.
 *
 * On desktop (>768px) the overflow pipeline is owned by features/header-more.js
 * and runs in ONE deterministic pass per resize: body.header-more engages
 * UNCONDITIONALLY (2026-08-15 clutter feedback — the low-frequency tool group
 * always lives behind ⋯), then the compact-mode measure runs against the
 * reduced row — body.header-collapsed, where the right PDF actions
 * consolidate into the #headerBurger drawer (same drawer as mobile). Normal
 * desktop widths get ⋯ alone; very narrow desktop gets both.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadPdf(page) {
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

test.describe('Desktop header overflow → compact mode', () => {
  test('narrow desktop collapses the right actions into the burger; nothing cut off', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 780, height: 820 }); // desktop (>768px), narrow
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);

    // Since the ⋯ overflow (features/header-more.js) tucks the 8-tool group,
    // the reduced signed-out row FITS at every desktop width — compact mode
    // is the fallback for states whose extra header content (checkout
    // banner, signed-in actions) widens the row. Simulate that content so
    // the burger machinery is exercised end-to-end.
    await page.evaluate(() => {
      const spacer = document.createElement('span');
      spacer.id = 'testHeaderWideContent';
      spacer.style.cssText = 'display:inline-block;width:640px;flex-shrink:0;';
      document.querySelector('.header-tools-tight').appendChild(spacer);
      window.App.scheduleHeaderMoreCheck();
    });

    // Both layers engage: ⋯ tucks the tool group AND the compact mode
    // consolidates the right actions into the burger.
    await expect(page.locator('body')).toHaveClass(/header-more/);
    await expect(page.locator('body')).toHaveClass(/header-collapsed/);
    await expect(page.locator('#headerBurger')).toBeVisible();
    for (const id of ['#hideMarksBtn', '#exportDropdown', '#downloadCurrentPageDropdown']) {
      await expect(page.locator(id)).toBeHidden();
    }
    // The burger sits within the viewport (reachable, not cut off off the right edge).
    const box = await page.locator('#headerBurger').boundingBox();
    expect(box).not.toBeNull();
    expect(box.x + box.width).toBeLessThanOrEqual(780);

    // Opening it shows the drawer with the consolidated actions.
    await page.locator('#headerBurger').click();
    await expect(page.locator('body')).toHaveClass(/right-menu-open/);
    const rows = await page.locator('#rightMenuList .right-menu-item').allTextContents();
    expect(rows.some((t) => /Hide marks/.test(t))).toBe(true);
    expect(rows.some((t) => /Original PDF/.test(t))).toBe(true); // B4: cloud-menu "Export PDF" renamed

    expect(errors).toEqual([]);
  });

  test('wide desktop stays normal: no burger, right icons visible', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);
    await expect(page.locator('body')).not.toHaveClass(/header-collapsed/);
    await expect(page.locator('#headerBurger')).toBeHidden();
    await expect(page.locator('#downloadCurrentPageDropdown')).toBeVisible();
    await expect(page.locator('#exportDropdown')).toBeVisible();
  });

  test('resizing steps through the layers deterministically and restores', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);
    await expect(page.locator('body')).not.toHaveClass(/header-collapsed/);
    // header-more is unconditional on desktop — on even at wide widths.
    await expect(page.locator('body')).toHaveClass(/header-more/);
    // Mid-narrow: ⋯ alone; compact stays off.
    await page.setViewportSize({ width: 900, height: 820 });
    await expect(page.locator('body')).toHaveClass(/header-more/);
    await expect(page.locator('body')).not.toHaveClass(/header-collapsed/);
    // Very narrow desktop with widened header content (checkout-banner-class
    // states): both layers.
    await page.setViewportSize({ width: 780, height: 820 });
    await page.evaluate(() => {
      const spacer = document.createElement('span');
      spacer.id = 'testHeaderWideContent';
      spacer.style.cssText = 'display:inline-block;width:640px;flex-shrink:0;';
      document.querySelector('.header-tools-tight').appendChild(spacer);
      window.App.scheduleHeaderMoreCheck();
    });
    await expect(page.locator('body')).toHaveClass(/header-more/);
    await expect(page.locator('body')).toHaveClass(/header-collapsed/);
    // Widening restores compact (path-independent); header-more stays on.
    await page.evaluate(() => { document.getElementById('testHeaderWideContent').remove(); });
    await page.setViewportSize({ width: 1400, height: 900 });
    await expect(page.locator('body')).not.toHaveClass(/header-collapsed/);
    await expect(page.locator('body')).toHaveClass(/header-more/);
  });
});

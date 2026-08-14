// @ts-check
/**
 * Tests: desktop header overflow → layered modes.
 *
 * On desktop (>768px) the overflow pipeline is owned by features/header-more.js
 * and runs in ONE deterministic pass per resize: measure the header clean, tuck
 * the low-frequency tool group behind the ⋯ menu first (body.header-more), then
 * re-measure for the deeper fallback — body.header-collapsed, where the right
 * PDF actions consolidate into the #headerBurger drawer (same drawer as
 * mobile). Mid-narrow widths get ⋯ alone; very narrow desktop gets both. At a
 * wide viewport the header is normal — no ⋯, no burger, right icons visible.
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

    await page.setViewportSize({ width: 780, height: 820 }); // desktop (>768px), narrow enough that even the ⋯-reduced row overflows
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);

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
    expect(rows.some((t) => /Export PDF/.test(t))).toBe(true);

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
    await expect(page.locator('body')).not.toHaveClass(/header-more/);
    // Mid-narrow: ⋯ alone absorbs the overflow; compact stays off.
    await page.setViewportSize({ width: 900, height: 820 });
    await expect(page.locator('body')).toHaveClass(/header-more/);
    await expect(page.locator('body')).not.toHaveClass(/header-collapsed/);
    // Very narrow desktop: both layers.
    await page.setViewportSize({ width: 780, height: 820 });
    await expect(page.locator('body')).toHaveClass(/header-more/);
    await expect(page.locator('body')).toHaveClass(/header-collapsed/);
    // Widening restores fully (path-independent: same verdicts as arriving fresh).
    await page.setViewportSize({ width: 1400, height: 900 });
    await expect(page.locator('body')).not.toHaveClass(/header-collapsed/);
    await expect(page.locator('body')).not.toHaveClass(/header-more/);
  });
});

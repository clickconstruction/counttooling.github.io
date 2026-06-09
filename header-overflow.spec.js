// @ts-check
/**
 * Tests: desktop header overflow → compact mode.
 *
 * On desktop (>768px), when the header row is wider than the viewport, JS adds
 * body.header-collapsed (measured in the expanded state so it can't oscillate):
 * the left tools scroll horizontally and the right-side PDF actions collapse into
 * the same #headerBurger drawer used on mobile, so none of them get cut off. At a
 * wide viewport the header is normal — no burger, right icons visible.
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

    await page.setViewportSize({ width: 820, height: 820 }); // desktop (>768px) but narrow
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);

    // Header collapses; burger shows; right PDF icons are hidden into it.
    await expect(page.locator('body')).toHaveClass(/header-collapsed/);
    await expect(page.locator('#headerBurger')).toBeVisible();
    for (const id of ['#hideMarksBtn', '#exportDropdown', '#downloadCurrentPageDropdown']) {
      await expect(page.locator(id)).toBeHidden();
    }
    // The burger sits within the viewport (reachable, not cut off off the right edge).
    const box = await page.locator('#headerBurger').boundingBox();
    expect(box).not.toBeNull();
    expect(box.x + box.width).toBeLessThanOrEqual(820);

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
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);
    await expect(page.locator('body')).not.toHaveClass(/header-collapsed/);
    await expect(page.locator('#headerBurger')).toBeHidden();
    await expect(page.locator('#downloadCurrentPageDropdown')).toBeVisible();
    await expect(page.locator('#exportDropdown')).toBeVisible();
  });

  test('resizing wide → narrow collapses, narrow → wide restores', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await loadPdf(page);
    await expect(page.locator('body')).not.toHaveClass(/header-collapsed/);
    await page.setViewportSize({ width: 820, height: 820 });
    await expect(page.locator('body')).toHaveClass(/header-collapsed/);
    await page.setViewportSize({ width: 1400, height: 900 });
    await expect(page.locator('body')).not.toHaveClass(/header-collapsed/);
  });
});

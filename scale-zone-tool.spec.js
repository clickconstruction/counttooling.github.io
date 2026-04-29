// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Scale Zone tool', () => {
  test('exposes header and sidebar Scale Zone buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#scaleZoneBtn')).toBeAttached();
    await expect(page.locator('#scaleZoneBtnSidebar')).toBeAttached();
  });
});

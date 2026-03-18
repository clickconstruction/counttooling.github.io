// @ts-check
/**
 * Tests for customIconPaths IndexedDB migration.
 * Verifies: load from IndexedDB, migration from localStorage, persistence after add.
 */
const { test, expect } = require('@playwright/test');

const SAMPLE_ICON = {
  value: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5z',
  name: 'Test Icon',
  viewBox: '0 0 24 24',
};

test.describe('customIconPaths IndexedDB', () => {
  test('add and persist to IndexedDB', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Add custom icon via saveUserCustomIcons (exposed on window for localhost)
    await page.evaluate((data) => {
      const arr = JSON.parse(data);
      const save = window.saveUserCustomIcons || (typeof saveUserCustomIcons !== 'undefined' && saveUserCustomIcons);
      if (typeof save === 'function') save(arr);
    }, JSON.stringify([SAMPLE_ICON]));

    await page.waitForTimeout(500);

    // Verify in cache
    const countBefore = await page.evaluate(() => {
      const get = window.getUserCustomIcons || (typeof getUserCustomIcons !== 'undefined' && getUserCustomIcons);
      return typeof get === 'function' ? get().length : 0;
    });
    expect(countBefore).toBe(1);

    // Verify in IndexedDB
    const idbIcons = await page.evaluate(async () => {
      const fn = window.__customIconsGetFromIndexedDBForTest;
      return typeof fn === 'function' ? await fn() : null;
    });
    expect(idbIcons).not.toBeNull();
    expect(Array.isArray(idbIcons)).toBe(true);
    expect(idbIcons.length).toBe(1);
    expect(idbIcons[0].name).toBe('Test Icon');

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    const countAfter = await page.evaluate(() => {
      const get = window.getUserCustomIcons || (typeof getUserCustomIcons !== 'undefined' && getUserCustomIcons);
      return typeof get === 'function' ? get().length : 0;
    });
    expect(countAfter).toBe(1);
  });

  test('migrates from localStorage on first load', async ({ page }) => {
    await page.addInitScript((icons) => {
      localStorage.setItem('customIconPaths', JSON.stringify(icons));
    }, [SAMPLE_ICON]);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify icons loaded from migration
    const count = await page.evaluate(() => {
      const get = window.getUserCustomIcons || (typeof getUserCustomIcons !== 'undefined' && getUserCustomIcons);
      return typeof get === 'function' ? get().length : 0;
    });
    expect(count).toBe(1);

    // Verify localStorage was cleared
    const hasLocalStorage = await page.evaluate(() => !!localStorage.getItem('customIconPaths'));
    expect(hasLocalStorage).toBe(false);

    // Verify in IndexedDB
    const idbIcons = await page.evaluate(async () => {
      const fn = window.__customIconsGetFromIndexedDBForTest;
      return typeof fn === 'function' ? await fn() : null;
    });
    expect(idbIcons).not.toBeNull();
    expect(idbIcons.length).toBe(1);
    expect(idbIcons[0].name).toBe('Test Icon');
  });

  test('delete clears IndexedDB', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Add then remove
    await page.evaluate((data) => {
      const arr = JSON.parse(data);
      const save = window.saveUserCustomIcons || (typeof saveUserCustomIcons !== 'undefined' && saveUserCustomIcons);
      if (typeof save === 'function') save(arr);
    }, JSON.stringify([SAMPLE_ICON]));

    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const save = window.saveUserCustomIcons || (typeof saveUserCustomIcons !== 'undefined' && saveUserCustomIcons);
      if (typeof save === 'function') save([]);
    });

    await page.waitForTimeout(500);

    // Verify IndexedDB is empty (returns [] when empty, null when store missing)
    const idbIcons = await page.evaluate(async () => {
      const fn = window.__customIconsGetFromIndexedDBForTest;
      return typeof fn === 'function' ? await fn() : null;
    });
    expect(idbIcons === null || (Array.isArray(idbIcons) && idbIcons.length === 0)).toBe(true);
  });
});

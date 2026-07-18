// @ts-check
/**
 * features/my-settings.js (feature-file split #32): the My Settings modal —
 * opener, Artboard save/load/export/clear rows, change-password form,
 * sign-out, and the admin openers — extracted from app.js onto the
 * window.App registry.
 *
 * The cloud paths (airboard save/load, password, sign-out) are
 * Supabase-session-gated, so the always-run test pins what runs locally:
 * App.openMySettings is registered; opening while signed out falls through
 * to the auth modal (the dispatched #authBtn path); Export artboard yields a
 * real artboard-backup.json download; Clear artboard (confirm auto-accepted)
 * empties the palette and resets the modifiers; and the close binding hides
 * a force-shown modal.
 */
const { test, expect } = require('@playwright/test');

test.describe('My Settings (features/my-settings.js)', () => {
  test('opener fallback, export + clear artboard, close binding', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => typeof window.App?.openMySettings)).toBe('function');

    // Signed out -> falls through to the auth modal via the #authBtn dispatch.
    await page.evaluate(() => window.App.openMySettings());
    await page.waitForSelector('#authModal.visible', { timeout: 5000 });
    await expect(page.locator('#mySettingsModal')).not.toHaveClass(/visible/);
    await page.keyboard.press('Escape');

    // Seed a palette, then Export artboard -> a real JSON download.
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Drain', icon: 'M0 0h24v24H0z', color: '#e8c547' }];
      s.lineTypes = [{ id: 'lt1', name: 'Copper', color: '#4a9eff' }];
      window.App.updateUI();
    });
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.evaluate(() => document.getElementById('mySettingsExportAirboard').click());
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('artboard-backup.json');

    // Clear artboard (confirm auto-accepted) empties the palette.
    await page.evaluate(() => document.getElementById('mySettingsClearAirboard').click());
    await page.waitForFunction(() => window.state.counters.length === 0 && window.state.lineTypes.length === 0);
    expect(await page.evaluate(() => window.state.activeCounterType)).toBeNull();

    // The close binding hides a force-shown modal.
    await page.evaluate(() => {
      document.getElementById('mySettingsModal').classList.add('visible');
      document.getElementById('mySettingsModalClose').click();
    });
    await expect(page.locator('#mySettingsModal')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });
});

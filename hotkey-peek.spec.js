// @ts-check
/**
 * Tests: hold-Cmd hotkey peek (features/hotkey-peek.js).
 *
 * Holding Meta (or Alt) for ~1.5s without another key sets body.hotkey-peek,
 * revealing <kbd class="hk-badge"> chips stamped from App.HOTKEYS on every
 * hotkey-carrying control (header + sidebar twins). Release hides them; a
 * second key during the hold cancels the pending peek (it's a combo, not a
 * question); focus loss (blur) force-ends a peek because Cmd+Tab never
 * delivers the Meta keyup.
 */
const { test, expect } = require('@playwright/test');

test.describe('Hotkey peek (hold Cmd ~1.5s)', () => {
  test('hold Meta 1.5s shows badges from HOTKEYS; release hides them', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    await page.keyboard.down('Meta');
    // Not yet — the peek waits out the 1.5s hold.
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.body.classList.contains('hotkey-peek'))).toBe(false);
    await expect(page.locator('body')).toHaveClass(/hotkey-peek/, { timeout: 3000 });

    // Badges are stamped from the HOTKEYS table: C on Counter, T on Chain,
    // L on Quick Line — and the sidebar twin gets one too.
    await expect(page.locator('#counterBtn .hk-badge')).toHaveText('C');
    await expect(page.locator('#chainBtn .hk-badge')).toHaveText('T');
    await expect(page.locator('#quickLine .hk-badge')).toHaveText('L');
    expect(await page.evaluate(() => !!document.querySelector('#counterBtnSidebar .hk-badge'))).toBe(true);

    await page.keyboard.up('Meta');
    await expect(page.locator('body')).not.toHaveClass(/hotkey-peek/);
    await expect(page.locator('#counterBtn .hk-badge')).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('a second key during the hold cancels the pending peek', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    await page.keyboard.down('Meta');
    await page.waitForTimeout(200);
    await page.keyboard.press('s');
    expect(await page.evaluate(() => window.App.__hotkeyPeekState())).toEqual({ pending: false, peeking: false });
    // Even after the hold window elapses, no peek appears.
    await page.waitForTimeout(1700);
    expect(await page.evaluate(() => document.body.classList.contains('hotkey-peek'))).toBe(false);
    await page.keyboard.up('Meta');
  });

  test('blur force-ends an active peek (Cmd+Tab never sends keyup)', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    await page.keyboard.down('Meta');
    await expect(page.locator('body')).toHaveClass(/hotkey-peek/, { timeout: 3000 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.locator('body')).not.toHaveClass(/hotkey-peek/);
    await page.keyboard.up('Meta');
  });
});

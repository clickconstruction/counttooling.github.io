// @ts-check
/**
 * Tests: the undo-count toast + the one-undo-per-press guard.
 *
 * Every successful undo (Ctrl+Z or the bottom-bar button) toasts how many
 * undos remain ("2 undos left", "1 undo left", "0 undos left" — no
 * denominator, 1s duration); a no-op undo (empty stack) toasts nothing.
 * Holding Ctrl+Z must NOT machine-gun through the stack: OS auto-repeat
 * keydowns (e.repeat) are ignored, one undo per physical press.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function setupWithThreeSnapshots(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft' };
    s.counters.push({ id: 'c-u', name: 'Box', icon: 'M96 96h448v448H96z', color: '#e8c547' });
    s.lineTypes.push({ id: 'lt-u', name: 'Run', color: '#4a9eff' });
    s.activeCounterType = 'c-u';
    s.activeLineTypeId = 'lt-u';
    s.tool = window.App.TOOL.CHAIN;
    // Three chain clicks = three undo snapshots.
    window.App.commitChainPoint({ x: 100, y: 100 });
    window.App.commitChainPoint({ x: 200, y: 100 });
    window.App.commitChainPoint({ x: 200, y: 200 });
    window.App.updateUI();
  });
}

test.describe('Undo count toast', () => {
  test('each undo toasts the remaining count; empty stack toasts nothing', async ({ page }) => {
    await setupWithThreeSnapshots(page);

    await page.keyboard.press('Control+z');
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    await expect(page.locator('#airboardToastText')).toHaveText('2 undos left');
    await page.keyboard.press('Control+z');
    await expect(page.locator('#airboardToastText')).toHaveText('1 undo left');
    await page.keyboard.press('Control+z');
    await expect(page.locator('#airboardToastText')).toHaveText('0 undos left');

    // The 1s toast hides on its own.
    await page.waitForTimeout(1300);
    await expect(page.locator('#airboardToastModal')).not.toHaveClass(/visible/);

    // Empty stack: a further Ctrl+Z is a silent no-op.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    await expect(page.locator('#airboardToastModal')).not.toHaveClass(/visible/);

    // The bottom-bar Undo button goes through the same choke point: redo one
    // step back in, then undo via the button.
    await page.keyboard.press('Control+Shift+z');
    await page.locator('#undoBtn').click();
    await expect(page.locator('#airboardToastText')).toHaveText('0 undos left');
  });

  test('holding Ctrl+Z (auto-repeat) performs only ONE undo per press', async ({ page }) => {
    await setupWithThreeSnapshots(page);
    const markers = () => page.evaluate(() => window.state.pages[0].canvases[0].annotations.counterMarkers['c-u'].length);
    expect(await markers()).toBe(3);

    // A held key = one real keydown followed by auto-repeat keydowns
    // (e.repeat true) with no keyup in between.
    await page.evaluate(() => {
      const fire = (repeat) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, repeat, bubbles: true, cancelable: true }));
      fire(false);
      for (let i = 0; i < 10; i++) fire(true);
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'z', ctrlKey: true, bubbles: true }));
    });
    expect(await markers()).toBe(2);   // exactly one undo, not eleven
    await expect(page.locator('#airboardToastText')).toHaveText('2 undos left');
  });
});

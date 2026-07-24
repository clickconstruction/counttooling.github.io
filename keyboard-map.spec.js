// @ts-check
/**
 * Tests: the Keyboard Map modal (features/keyboard-map.js) — the "See Keyboard"
 * board that shows which keys carry a shortcut.
 *
 * The load-bearing assertion is the DERIVATION one (test 2): the lit keys are
 * built from the Macros table at open time, not hand-declared, so this walks
 * every <kbd> in that table and asserts the corresponding board key exists and
 * is lit. That is what keeps the two surfaces from drifting — if someone adds a
 * shortcut row and the board can't represent its key, this fails.
 *
 * Also guards the registry failure modes (entry point never registered;
 * bindings fire before the registry is populated), the opener from inside the
 * Macros modal, the hover caption, and the Escape ordering (the board closes
 * first, leaving the shortcut list up behind it).
 *
 * No PDF needed — the modal is reachable from the status-bar macros link on a
 * cold app.
 */
const { test, expect } = require('@playwright/test');

test.describe('Keyboard Map modal', () => {
  test('registry wired; opens from Macros with keys lit, caption, and Escape ordering', async ({ page }) => {
    const errors = [];
    // Ignore the optional gitignored /config.local.js 404 (dev-only include).
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !(msg.location()?.url || '').includes('config.local.js')) errors.push(msg.text());
    });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Registry contract: the entry point is registered.
    const wired = await page.evaluate(() => typeof window.App?.openKeyboardMapModal);
    expect(wired).toBe('function');

    // 2. Open through the real path: status-bar macros -> "See Keyboard".
    await page.locator('#statusBarMacros').click();
    await page.waitForSelector('#macrosModal.visible', { timeout: 5000 });
    await page.locator('#macrosSeeKeyboard').click();
    await page.waitForSelector('#keyboardMapModal.visible', { timeout: 5000 });

    // The board stacks ON TOP of the shortcut list rather than replacing it.
    expect(await page.locator('#macrosModal').evaluate((el) => el.classList.contains('visible'))).toBe(true);

    // 3. DERIVATION: every <kbd> token in the Macros table must resolve to a key
    //    on the board, and that key must be lit. This is the anti-drift guard.
    const derivation = await page.evaluate(() => {
      // Mirror of normalizeKeyToken in features/keyboard-map.js.
      const ALIASES = {
        '←': 'ArrowLeft', '→': 'ArrowRight', '↑': 'ArrowUp', '↓': 'ArrowDown',
        'shift': 'Shift', 'ctrl': 'Control', 'cmd': 'Meta', 'alt': 'Alt',
        'esc': 'Escape', 'space': 'Space', 'enter': 'Enter', 'tab': 'Tab',
      };
      const normalize = (raw) => {
        const t = (raw || '').trim();
        if (!t) return null;
        const a = ALIASES[t.toLowerCase()] || ALIASES[t];
        if (a) return a;
        return t.length === 1 ? t.toUpperCase() : null;
      };
      const tokens = [...document.querySelectorAll('#macrosModal .macros-table kbd')]
        .map((k) => (k.textContent || '').trim());
      const unresolved = [];
      const missing = [];
      const unlit = [];
      tokens.forEach((raw) => {
        const id = normalize(raw);
        if (!id) { unresolved.push(raw); return; }
        const keys = [...document.querySelectorAll(`#keyboardMapBoard .kb-key[data-key="${CSS.escape(id)}"]`)];
        if (!keys.length) { missing.push(raw + ' -> ' + id); return; }
        if (!keys.some((k) => k.classList.contains('is-mapped') || k.classList.contains('is-modifier'))) {
          unlit.push(raw + ' -> ' + id);
        }
      });
      return { tokenCount: tokens.length, unresolved, missing, unlit };
    });
    expect(derivation.tokenCount).toBeGreaterThan(20);
    expect(derivation.unresolved).toEqual([]);
    expect(derivation.missing).toEqual([]);
    expect(derivation.unlit).toEqual([]);

    // 4. Spot-check the tool hotkeys light up — including V (Room Sizer), whose
    //    Macros row was missing until this feature landed.
    const litKeys = await page.evaluate(() =>
      [...document.querySelectorAll('#keyboardMapBoard .kb-key.is-mapped')].map((k) => k.dataset.key));
    for (const k of ['M', 'S', 'C', 'L', 'J', 'P', 'D', 'R', 'H', 'X', 'V', 'N', 'Z', 'Q']) {
      expect(litKeys, `expected ${k} to be lit`).toContain(k);
    }
    expect(litKeys).toContain('Space');
    expect(litKeys).toContain('Escape');
    expect(litKeys).toContain('ArrowLeft');

    // Modifiers get the softer outlined treatment, not the filled one.
    const modifierKeys = await page.evaluate(() =>
      [...document.querySelectorAll('#keyboardMapBoard .kb-key.is-modifier')].map((k) => k.dataset.key));
    expect(modifierKeys).toContain('Shift');
    expect(litKeys).not.toContain('Shift');

    // 5. An unmapped key stays a plain silhouette.
    const unmappedClass = await page.evaluate(() =>
      document.querySelector('#keyboardMapBoard .kb-key[data-key="G"]')?.className);
    expect(unmappedClass).toBe('kb-key');

    // 6. CAPTION: hovering a lit key names its action; leaving restores the hint.
    const caption = page.locator('#keyboardMapCaption');
    const hintText = await caption.textContent();
    expect(hintText).toContain('Hover');
    await page.locator('#keyboardMapBoard .kb-key[data-key="S"]').hover();
    await expect(caption).toHaveText('S — Set Scale');
    // A key used by two shortcuts lists both.
    await page.locator('#keyboardMapBoard .kb-key[data-key="R"]').hover();
    await expect(caption).toContainText('Rotate page');

    // 7. ESCAPE closes the board only — the shortcut list stays up behind it.
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.getElementById('keyboardMapModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await page.locator('#macrosModal').evaluate((el) => el.classList.contains('visible'))).toBe(true);

    // A second Escape then dismisses the list.
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.getElementById('macrosModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    // 8. The close button works too.
    await page.evaluate(() => window.App.openKeyboardMapModal());
    await page.waitForSelector('#keyboardMapModal.visible', { timeout: 5000 });
    await page.locator('#keyboardMapClose').click();
    await page.waitForFunction(
      () => !document.getElementById('keyboardMapModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    expect(errors).toEqual([]);
  });

  test('board fits a phone viewport without overflowing the page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => window.App.openKeyboardMapModal());
    await page.waitForSelector('#keyboardMapModal.visible', { timeout: 5000 });

    // The wide board scrolls inside its own container; the page body must not.
    const metrics = await page.evaluate(() => {
      const wrap = document.querySelector('.kb-board-wrap');
      return {
        pageOverflows: document.body.scrollWidth > document.body.clientWidth,
        wrapScrollsX: wrap.scrollWidth > wrap.clientWidth,
      };
    });
    expect(metrics.pageOverflows).toBe(false);
    expect(metrics.wrapScrollsX).toBe(true);
  });
});

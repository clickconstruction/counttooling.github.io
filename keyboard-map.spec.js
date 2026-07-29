// @ts-check
/**
 * Tests: the Keyboard Map (features/keyboard-map.js) — the board that shows which
 * keys carry a shortcut. It has TWO hosts chosen by CSS at the 769px breakpoint:
 * inline at the top of the Macros modal on desktop, behind the "See Keyboard"
 * button in #keyboardMapModal on mobile. Both are covered here.
 *
 * The load-bearing assertion is the DERIVATION one: the lit keys are built from
 * the Macros table, not hand-declared, so the test walks every <kbd> in that table
 * and asserts the corresponding board key exists and is lit. That is what keeps
 * the two surfaces from drifting — if someone adds a shortcut row and the board
 * can't represent its key, this fails.
 *
 * Also guards the registry failure modes (entry point never registered; bindings
 * fire before the registry is populated), the hover caption, and the mobile
 * Escape ordering (the board closes first, leaving the shortcut list up behind it).
 *
 * No PDF needed — Macros is reachable from the status-bar link on a cold app.
 */
const { test, expect } = require('@playwright/test');

// Ignore the optional gitignored /config.local.js 404 (dev-only include).
function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !(msg.location()?.url || '').includes('config.local.js')) errors.push(msg.text());
  });
  page.on('pageerror', (err) => { errors.push(err.message); });
  return errors;
}

/*
 * Walk every <kbd> in the Macros table and check it resolves to a lit key inside
 * `boardSel`. Runs in the page; mirrors normalizeKeyToken from the feature.
 */
function auditDerivation(page, boardSel) {
  return page.evaluate((sel) => {
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
    const unresolved = [], missing = [], unlit = [];
    tokens.forEach((raw) => {
      const id = normalize(raw);
      if (!id) { unresolved.push(raw); return; }
      const keys = [...document.querySelectorAll(`${sel} .kb-key[data-key="${CSS.escape(id)}"]`)];
      if (!keys.length) { missing.push(raw + ' -> ' + id); return; }
      if (!keys.some((k) => k.classList.contains('is-mapped') || k.classList.contains('is-modifier'))) {
        unlit.push(raw + ' -> ' + id);
      }
    });
    return { tokenCount: tokens.length, unresolved, missing, unlit };
  }, boardSel);
}

function expectCleanDerivation(d) {
  expect(d.tokenCount).toBeGreaterThan(20);
  expect(d.unresolved).toEqual([]);
  expect(d.missing).toEqual([]);
  expect(d.unlit).toEqual([]);
}

test.describe('Keyboard Map — desktop (inline in Macros)', () => {
  test('board is inline and pre-built; See Keyboard button is retired', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => typeof window.App?.openKeyboardMapModal)).toBe('function');

    // Opening Macros is enough — no second click. The inline host is built at
    // feature load, so the board is already populated when the modal appears.
    await page.locator('#statusBarMacros').click();
    await page.waitForSelector('#macrosModal.visible', { timeout: 5000 });

    await expect(page.locator('#macrosKeyboardInline')).toBeVisible();
    await expect(page.locator('#macrosKeyboardBoard .kb-key').first()).toBeVisible();
    // The button and its modal are the mobile path; both stay out of the way here.
    await expect(page.locator('#macrosSeeKeyboard')).toBeHidden();
    await expect(page.locator('#keyboardMapModal')).not.toHaveClass(/visible/);

    // DERIVATION against the inline board — the anti-drift guard.
    expectCleanDerivation(await auditDerivation(page, '#macrosKeyboardBoard'));

    // Tool hotkeys light up, incl. V (Room Sizer), whose Macros row was missing
    // until this feature landed.
    const lit = await page.evaluate(() =>
      [...document.querySelectorAll('#macrosKeyboardBoard .kb-key.is-mapped')].map((k) => k.dataset.key));
    for (const k of ['M', 'S', 'C', 'L', 'J', 'P', 'D', 'R', 'H', 'X', 'V', 'N', 'Z', 'Q']) {
      expect(lit, `expected ${k} to be lit`).toContain(k);
    }
    expect(lit).toEqual(expect.arrayContaining(['Space', 'Escape', 'ArrowLeft']));

    // Modifiers get the softer outlined treatment, not the filled one.
    const mods = await page.evaluate(() =>
      [...document.querySelectorAll('#macrosKeyboardBoard .kb-key.is-modifier')].map((k) => k.dataset.key));
    expect(mods).toContain('Shift');
    expect(lit).not.toContain('Shift');

    // An unmapped key stays a plain silhouette.
    expect(await page.evaluate(() =>
      document.querySelector('#macrosKeyboardBoard .kb-key[data-key="G"]')?.className)).toBe('kb-key');

    // CAPTION: hovering a lit key names its action, in the INLINE caption.
    const caption = page.locator('#macrosKeyboardCaption');
    expect(await caption.textContent()).toContain('Hover');
    await page.locator('#macrosKeyboardBoard .kb-key[data-key="S"]').hover();
    await expect(caption).toHaveText('S — Set Scale');
    // A key used by two shortcuts lists both.
    await page.locator('#macrosKeyboardBoard .kb-key[data-key="R"]').hover();
    await expect(caption).toContainText('Rotate page');

    expect(errors).toEqual([]);
  });

  test('the shortcut table still scrolls under the pinned board', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#statusBarMacros').click();
    await page.waitForSelector('#macrosModal.visible', { timeout: 5000 });

    // The card is capped to the viewport and the body — not the whole card —
    // is what scrolls, so the keyboard stays put while the list moves.
    const m = await page.evaluate(() => {
      const card = document.querySelector('.macros-modal-card');
      const body = document.querySelector('.macros-modal-body');
      return {
        cardWithinViewport: card.getBoundingClientRect().height <= window.innerHeight + 1,
        bodyScrolls: body.scrollHeight > body.clientHeight,
        boardAboveBody: document.getElementById('macrosKeyboardInline').getBoundingClientRect().bottom
          <= body.getBoundingClientRect().top + 1,
      };
    });
    expect(m.cardWithinViewport).toBe(true);
    expect(m.bodyScrolls).toBe(true);
    expect(m.boardAboveBody).toBe(true);
  });
});

test.describe('Keyboard Map — mobile (behind See Keyboard)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('button opens the modal; Escape closes the board and leaves the list up', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => document.getElementById('statusBarMacros').click());
    await page.waitForSelector('#macrosModal.visible', { timeout: 5000 });

    // Inverted from desktop: the button is the path, the inline board is hidden.
    await expect(page.locator('#macrosSeeKeyboard')).toBeVisible();
    await expect(page.locator('#macrosKeyboardInline')).toBeHidden();

    await page.locator('#macrosSeeKeyboard').click();
    await page.waitForSelector('#keyboardMapModal.visible', { timeout: 5000 });
    // The board stacks ON TOP of the shortcut list rather than replacing it.
    expect(await page.locator('#macrosModal').evaluate((el) => el.classList.contains('visible'))).toBe(true);

    expectCleanDerivation(await auditDerivation(page, '#keyboardMapBoard'));

    // The wide board scrolls inside its own container; the page body must not.
    const metrics = await page.evaluate(() => {
      const wrap = document.querySelector('#keyboardMapModal .kb-board-wrap');
      return {
        pageOverflows: document.body.scrollWidth > document.body.clientWidth,
        wrapScrollsX: wrap.scrollWidth > wrap.clientWidth,
      };
    });
    expect(metrics.pageOverflows).toBe(false);
    expect(metrics.wrapScrollsX).toBe(true);

    // ESCAPE closes the board only — the shortcut list stays up behind it.
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

    // The close button works too.
    await page.evaluate(() => window.App.openKeyboardMapModal());
    await page.waitForSelector('#keyboardMapModal.visible', { timeout: 5000 });
    await page.locator('#keyboardMapClose').click();
    await page.waitForFunction(
      () => !document.getElementById('keyboardMapModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: Quick Keys (features/quick-keys.js) — binding the number row (1-9, 0) to
 * counters and line types so the user can switch what they are placing without a
 * trip to the sidebar.
 *
 * The important guarantees, in order:
 *  1. A number key uses the SAME selection path as a sidebar row click
 *     (App.setActiveCounterType / setActiveLineType), so toggle-off semantics and
 *     the tool switch cannot drift between the two entry points. Asserted by
 *     driving both and comparing the resulting state.
 *  2. The digit branch does not steal keystrokes it shouldn't: unbound digits are
 *     no-ops, digits typed into an input are ignored, and modifier+digit
 *     (Ctrl+1 tab switching) falls through.
 *  3. state.numberKeyBindings survives the canvas-JSON import path.
 *  4. A stale binding (target deleted) reports rather than silently failing.
 *  5. The Keyboard Map picks bindings up as its second, dynamic source.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// Seed a palette the way a loaded project would have one.
async function seedPalette(page) {
  await page.evaluate(() => {
    window.state.counters = [
      { id: 'c1', name: 'Floor Drain', icon: '', color: '#e8c547' },
      { id: 'c2', name: 'Cleanout', icon: '', color: '#4a9eff' },
    ];
    window.state.lineTypes = [{ id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' }];
    window.state.numberKeyBindings = {};
  });
}

// Real keydown on <body> — dispatching on `document` is unrealistic (document has
// no .matches, which the handler's input guard calls).
async function pressDigit(page, key) {
  await page.evaluate((k) => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  }, key);
}

const selection = (page) => page.evaluate(() => ({
  counter: window.state.activeCounterType,
  lineType: window.state.activeLineTypeId,
  tool: window.state.tool,
}));

test.describe('Quick Keys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await seedPalette(page);
  });

  test('bind via the modal, then the number row switches the active type', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    expect(await page.evaluate(() => typeof window.App?.openQuickKeysModal)).toBe('function');
    expect(await page.evaluate(() => typeof window.App?.triggerQuickKey)).toBe('function');

    // Open through the real status-bar entry.
    await page.locator('#statusBarQuickKeys').click();
    await page.waitForSelector('#quickKeysModal.visible', { timeout: 5000 });
    expect(await page.locator('#quickKeysStrip .quick-key-cap').count()).toBe(10);

    // Key 1 is armed on an empty layout. A click on a row puts it on the armed
    // key, and the next empty key arms itself: two clicks fill keys 1 and 2.
    await expect(page.locator('.quick-key-cap.is-armed')).toHaveAttribute('data-slot', '1');
    await page.locator('.quick-key-item[data-value="counter:c1"]').click();
    await expect(page.locator('.quick-key-cap.is-armed')).toHaveAttribute('data-slot', '2');
    await page.locator('.quick-key-item[data-value="lineType:lt1"]').click();
    await expect(page.locator('.quick-key-cap.is-armed')).toHaveAttribute('data-slot', '3');
    expect(await page.evaluate(() => window.state.numberKeyBindings)).toEqual({
      1: { kind: 'counter', id: 'c1' },
      2: { kind: 'lineType', id: 'lt1' },
    });
    await page.locator('#quickKeysDone').click();
    await expect(page.locator('#quickKeysModal')).not.toHaveClass(/visible/);

    const TOOL = await page.evaluate(() => ({ NONE: window.App.TOOL.NONE, COUNTER: window.App.TOOL.COUNTER, LINE: window.App.TOOL.LINE }));

    await pressDigit(page, '1');
    expect(await selection(page)).toMatchObject({ counter: 'c1', tool: TOOL.COUNTER });

    await pressDigit(page, '2');
    expect(await selection(page)).toMatchObject({ lineType: 'lt1', tool: TOOL.LINE });

    // Pressing the same key again deselects — same as clicking the row twice.
    await pressDigit(page, '2');
    expect(await selection(page)).toMatchObject({ lineType: null, tool: TOOL.NONE });

    expect(errors).toEqual([]);
  });

  test('a number key and a sidebar row click produce identical state', async ({ page }) => {
    await page.evaluate(() => { window.state.numberKeyBindings = { 1: { kind: 'counter', id: 'c1' } }; });

    await pressDigit(page, '1');
    const viaKey = await selection(page);

    // Reset, then take the same action through the sidebar path.
    await page.evaluate(() => {
      window.state.activeCounterType = null;
      window.state.tool = window.App.TOOL.NONE;
      window.App.setActiveCounterType('c1');
    });
    const viaRow = await selection(page);

    expect(viaKey).toEqual(viaRow);
  });

  test('does not steal keystrokes it should not', async ({ page }) => {
    await page.evaluate(() => { window.state.numberKeyBindings = { 1: { kind: 'counter', id: 'c1' } }; });
    const TOOL_NONE = await page.evaluate(() => window.App.TOOL.NONE);

    // Unbound digit: no-op.
    await pressDigit(page, '7');
    expect(await selection(page)).toMatchObject({ counter: null, tool: TOOL_NONE });

    // Digit typed into an input must not fire the binding.
    await page.evaluate(() => {
      const inp = document.createElement('input');
      inp.id = 'qkProbe';
      document.body.appendChild(inp);
      inp.focus();
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    });
    expect(await selection(page)).toMatchObject({ counter: null, tool: TOOL_NONE });
    await page.evaluate(() => document.getElementById('qkProbe')?.remove());

    // Modifier+digit (e.g. Ctrl+1 browser tab switching) falls through untouched.
    await page.evaluate(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true }));
    });
    expect(await selection(page)).toMatchObject({ counter: null, tool: TOOL_NONE });
  });

  test('a binding whose target was deleted reports instead of failing silently', async ({ page }) => {
    await page.evaluate(() => {
      window.state.numberKeyBindings = { 3: { kind: 'counter', id: 'gone' } };
    });
    await pressDigit(page, '3');
    // Nothing activates, and the user is told why.
    expect(await selection(page)).toMatchObject({ counter: null });
    // showToast() drives #airboardToastModal / #airboardToastText (app.js).
    await expect(page.locator('#airboardToastText')).toContainText(/deleted/i, { timeout: 3000 });

    // The key shows it as stale rather than empty, and the id is retained so
    // re-creating the counter revives the slot.
    await page.evaluate(() => window.App.openQuickKeysModal());
    await expect(page.locator('.quick-key-cap[data-slot="3"]')).toHaveClass(/is-stale/);
    await page.locator('.quick-key-cap[data-slot="3"]').click();
    await expect(page.locator('#quickKeysNow .quick-key-stale')).toBeVisible();
    expect(await page.evaluate(() => window.state.numberKeyBindings['3'].id)).toBe('gone');
  });

  test('clearing a slot removes the binding', async ({ page }) => {
    await page.evaluate(() => { window.state.numberKeyBindings = { 5: { kind: 'counter', id: 'c1' } }; });
    await page.evaluate(() => window.App.openQuickKeysModal());
    await page.locator('.quick-key-cap[data-slot="5"]').click();
    await page.locator('.quick-key-clear[data-slot="5"]').click();
    expect(await page.evaluate(() => window.state.numberKeyBindings['5'])).toBeUndefined();

    await pressDigit(page, '5');
    expect(await selection(page)).toMatchObject({ counter: null });
  });

  test('bindings survive the canvas-JSON import path', async ({ page }) => {
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    const payload = JSON.stringify({
      counters: [{ id: 'ci', name: 'Imported Counter', icon: 'M0 0h24v24H0z', color: '#4a9eff' }],
      lineTypes: [{ id: 'lti', name: 'Imported Line', color: '#e8c547' }],
      groups: [],
      pages: [],
      numberKeyBindings: { 4: { kind: 'counter', id: 'ci' }, 9: { kind: 'lineType', id: 'lti' } },
    });
    await page.locator('#importInput').setInputFiles({ name: 'canvas.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
    await page.waitForFunction(() => window.state.counters.some((c) => c.id === 'ci'));

    expect(await page.evaluate(() => window.state.numberKeyBindings)).toEqual({
      4: { kind: 'counter', id: 'ci' },
      9: { kind: 'lineType', id: 'lti' },
    });
    // ...and the imported binding is live.
    await pressDigit(page, '4');
    expect(await selection(page)).toMatchObject({ counter: 'ci' });
  });

  test('bound rows show a keycap badge in the sidebar; it tracks binding changes', async ({ page }) => {
    await page.evaluate(() => {
      window.state.numberKeyBindings = { 1: { kind: 'counter', id: 'c1' }, 2: { kind: 'lineType', id: 'lt1' } };
      window.App.renderCountersList();
      window.App.renderLineTypesList();
    });

    // Badge digit + row pairing, both list kinds.
    const badges = await page.evaluate(() =>
      [...document.querySelectorAll('.quick-key-slot-badge')].map((b) => ({
        digit: b.textContent,
        row: b.closest('.sidebar-item')?.querySelector('.name')?.textContent || '',
      })));
    expect(badges.length).toBe(2);
    expect(badges[0].digit).toBe('1');
    expect(badges[0].row).toContain('Floor Drain');
    expect(badges[1].digit).toBe('2');
    expect(badges[1].row).toContain('2in Waste');
    // Unbound rows carry no badge.
    const cleanoutBadge = await page.evaluate(() =>
      [...document.querySelectorAll('#countersList .sidebar-item')]
        .find((r) => r.textContent.includes('Cleanout'))
        ?.querySelector('.quick-key-slot-badge') || null);
    expect(cleanoutBadge).toBeNull();

    // Unbinding through the modal refreshes the sidebar live.
    await page.evaluate(() => window.App.openQuickKeysModal());
    await page.locator('.quick-key-cap[data-slot="1"]').click();
    await page.locator('.quick-key-clear[data-slot="1"]').click();
    // (the sidebar's badges: the dialog's own list wears them too)
    expect(await page.evaluate(() => document.querySelectorAll('.sidebar-item .quick-key-slot-badge').length)).toBe(1);
  });

  test('artboard carry: seed rules, project replace-or-keep, import keeps a seeded layout', async ({ page }) => {
    // seedQuickKeysFromArtboard: fill-if-empty; never stomps an active layout;
    // replace:true (the explicit My Settings -> Load path) does.
    const seedRules = await page.evaluate(() => {
      const s = window.state;
      const r = {};
      s.numberKeyBindings = {};
      r.filled = window.App.seedQuickKeysFromArtboard({ 1: { kind: 'counter', id: 'c1' }, bogus: { kind: 'counter', id: 'x' }, 2: { kind: 'nope', id: 'y' } });
      r.afterFill = JSON.parse(JSON.stringify(s.numberKeyBindings));   // sanitized: slot 1 only
      r.flag = s.numberKeyBindingsSeededFromArtboard;
      r.refused = window.App.seedQuickKeysFromArtboard({ 3: { kind: 'lineType', id: 'lt9' } });
      r.afterRefusal = Object.keys(s.numberKeyBindings);
      r.replaced = window.App.seedQuickKeysFromArtboard({ 3: { kind: 'lineType', id: 'lt9' } }, { replace: true });
      r.afterReplace = Object.keys(s.numberKeyBindings);
      return r;
    });
    expect(seedRules.filled).toBe(true);
    expect(seedRules.afterFill).toEqual({ 1: { kind: 'counter', id: 'c1' } });
    expect(seedRules.flag).toBe(true);
    expect(seedRules.refused).toBe(false);
    expect(seedRules.afterRefusal).toEqual(['1']);
    expect(seedRules.replaced).toBe(true);
    expect(seedRules.afterReplace).toEqual(['3']);

    // applyProjectQuickKeys: with bindings -> replace + clear lineage; without ->
    // keep a seeded layout, drop a previous project's.
    const projRules = await page.evaluate(() => {
      const s = window.state;
      const r = {};
      window.App.applyProjectQuickKeys({ 5: { kind: 'counter', id: 'pc1' } });
      r.projectWins = Object.keys(s.numberKeyBindings);
      r.flagCleared = s.numberKeyBindingsSeededFromArtboard;
      window.App.applyProjectQuickKeys(null);                 // next project has none, prior was project-owned
      r.droppedAfterProject = Object.keys(s.numberKeyBindings);
      window.App.seedQuickKeysFromArtboard({ 7: { kind: 'counter', id: 'c1' } });
      window.App.applyProjectQuickKeys(null);                 // project has none, layout is artboard-seeded
      r.keptWhenSeeded = Object.keys(s.numberKeyBindings);
      return r;
    });
    expect(projRules.projectWins).toEqual(['5']);
    expect(projRules.flagCleared).toBe(false);
    expect(projRules.droppedAfterProject).toEqual([]);
    expect(projRules.keptWhenSeeded).toEqual(['7']);

    // End-to-end through a REAL intake path: canvas-JSON import with no
    // bindings payload must keep the artboard-seeded layout.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => {
      window.state.numberKeyBindings = {};
      window.App.seedQuickKeysFromArtboard({ 4: { kind: 'counter', id: 'ci' } });
    });
    const payload = JSON.stringify({
      counters: [{ id: 'ci', name: 'Imported Counter', icon: 'M0 0h24v24H0z', color: '#4a9eff' }],
      lineTypes: [], groups: [], pages: [],
    });
    await page.locator('#importInput').setInputFiles({ name: 'canvas.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
    await page.waitForFunction(() => window.state.counters.some((c) => c.id === 'ci'));
    expect(await page.evaluate(() => window.state.numberKeyBindings)).toEqual({ 4: { kind: 'counter', id: 'ci' } });
  });

  test('mobile: status-bar entries hide; the settings-modal row is the path in', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });

    // The desktop-only status-bar cluster must actually hide on a phone. This
    // regressed once: .has-icon carried a display that out-cascaded the
    // .status-bar-desktop-only hide (equal specificity, later in the file), so
    // the links leaked into the cramped mobile status bar.
    await expect(page.locator('#statusBarQuickKeys')).toBeHidden();
    await expect(page.locator('#statusBarQuickKeysSep')).toBeHidden();
    await expect(page.locator('#statusBarMacros')).toBeHidden();

    // The mobile path: Project Settings -> "quick keys" row.
    await page.evaluate(() => window.App.showModal('settingsModal'));
    await expect(page.locator('#settingsQuickKeys')).toBeVisible();
    await page.locator('#settingsQuickKeys').click();
    await expect(page.locator('#settingsModal')).not.toHaveClass(/visible/);
    await page.waitForSelector('#quickKeysModal.visible', { timeout: 5000 });
    expect(await page.locator('#quickKeysStrip .quick-key-cap').count()).toBe(10);
    // On a phone the card itself never scrolls: Done is on screen, the list scrolls alone.
    await expect(page.locator('#quickKeysDone')).toBeInViewport();
  });

  test('the Keyboard Map lights bound digits with their names', async ({ page }) => {
    await page.evaluate(() => {
      window.state.numberKeyBindings = { 1: { kind: 'counter', id: 'c1' }, 2: { kind: 'lineType', id: 'lt1' } };
    });
    // Opening Macros rebuilds the inline board, which is where bindings land.
    await page.locator('#statusBarMacros').click();
    await page.waitForSelector('#macrosModal.visible', { timeout: 5000 });

    const board = await page.evaluate(() => {
      const q = (s) => document.querySelector(`#macrosKeyboardBoard .kb-key[data-key="${s}"]`);
      return {
        one: { cls: q('1').className, caption: q('1').dataset.caption },
        two: { cls: q('2').className, caption: q('2').dataset.caption },
        seven: q('7').className,
      };
    });
    expect(board.one.cls).toContain('is-mapped');
    expect(board.one.caption).toBe('1: Floor Drain');
    expect(board.two.caption).toBe('2: 2in Waste');
    // An unbound digit stays a plain silhouette.
    expect(board.seven).toBe('kb-key');
  });

  test('one list, searched: ranked, typed loosely, and Enter fills key after key', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.evaluate(() => {
      window.state.counters = [
        { id: 'c1', name: 'Floor Drain', icon: '', color: '#e8c547' },
        { id: 'c2', name: 'Cleanout', icon: '', color: '#4a9eff' },
        { id: 's1', name: 'SK-1', icon: 'M0 0h24v24H0z', color: '#4a9eff' },
        { id: 's2', name: 'SK-2', icon: 'M0 0h24v24H0z', color: '#4a9eff' },
        { id: 'g1', name: 'Gate Valve', icon: '', color: '#e8a347' },
        { id: 'g2', name: 'Gate Valve', icon: '', color: '#e85447' },
      ];
      window.state.numberKeyBindings = { 1: { kind: 'counter', id: 'c1' } };
    });
    await page.locator('#statusBarQuickKeys').click();
    await page.waitForSelector('#quickKeysModal.visible', { timeout: 5000 });
    const values = () => page.evaluate(() => [...document.querySelectorAll('#quickKeysResults .quick-key-item')].map((r) => r.dataset.value));
    const lit = () => page.evaluate(() => document.querySelector('#quickKeysResults .quick-key-item.is-lit')?.dataset.value || null);

    // Opened: the whole palette, counters then line types; key 2 armed (1 is held);
    // the caret in the search; the lit row is the first one not yet on a key.
    expect(await values()).toEqual(['counter:c1', 'counter:c2', 'counter:s1', 'counter:s2', 'counter:g1', 'counter:g2', 'lineType:lt1']);
    await expect(page.locator('.quick-key-cap.is-armed')).toHaveAttribute('data-slot', '2');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('quickKeysSearch');
    expect(await lit()).toBe('counter:c2');
    // The row already on a key says which.
    await expect(page.locator('.quick-key-item[data-value="counter:c1"] .quick-key-slot-badge')).toHaveText('1');

    // Typed without the hyphen, in lower case.
    await page.locator('#quickKeysSearch').fill('sk1');
    expect(await values()).toEqual(['counter:s1']);
    // A word that starts a later word of the name still finds it.
    await page.locator('#quickKeysSearch').fill('waste');
    expect(await values()).toEqual(['lineType:lt1']);
    // Two items with one name are two rows.
    await page.locator('#quickKeysSearch').fill('gate');
    expect(await values()).toEqual(['counter:g1', 'counter:g2']);
    // Nothing matches: the list says so, and Enter changes nothing.
    await page.locator('#quickKeysSearch').fill('zzz');
    await expect(page.locator('#quickKeysResults .quick-key-none')).toBeVisible();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => Object.keys(window.state.numberKeyBindings))).toEqual(['1']);

    // "sk", Enter, Enter: SK-1 on key 2, SK-2 on key 3, the word kept and typing kept focus.
    await page.locator('#quickKeysSearch').fill('sk');
    await page.keyboard.press('Enter');
    expect(await lit()).toBe('counter:s2');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.state.numberKeyBindings)).toEqual({
      1: { kind: 'counter', id: 'c1' },
      2: { kind: 'counter', id: 's1' },
      3: { kind: 'counter', id: 's2' },
    });
    expect(await page.evaluate(() => document.getElementById('quickKeysSearch').value)).toBe('sk');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('quickKeysSearch');
    await expect(page.locator('.quick-key-cap.is-armed')).toHaveAttribute('data-slot', '4');

    // Arrow keys move the lit row; Enter takes it.
    await page.locator('#quickKeysSearch').fill('');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    expect(await lit()).toBe('counter:c2');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.state.numberKeyBindings['4'])).toEqual({ kind: 'counter', id: 'c2' });

    // An item sits on one key: picking Floor Drain (on 1) for key 7 moves it.
    await page.locator('.quick-key-cap[data-slot="7"]').click();
    await page.locator('.quick-key-item[data-value="counter:c1"]').click();
    expect(await page.evaluate(() => window.state.numberKeyBindings['7'])).toEqual({ kind: 'counter', id: 'c1' });
    expect(await page.evaluate(() => window.state.numberKeyBindings['1'])).toBeUndefined();
    // Key 1 is the next empty key to the right of 7, wrapping past 0.
    await expect(page.locator('.quick-key-cap.is-armed')).toHaveAttribute('data-slot', '8');

    // Reopening starts with an empty search.
    await page.locator('#quickKeysSearch').fill('drain');
    await page.locator('#quickKeysDone').click();
    await page.locator('#statusBarQuickKeys').click();
    await page.waitForSelector('#quickKeysModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => document.getElementById('quickKeysSearch').value)).toBe('');
    expect((await values()).length).toBe(7);

    expect(errors).toEqual([]);
  });

  test('the list puts what the project has placed first, with the sidebar\'s own numbers', async ({ page }) => {
    await page.setInputFiles('#pdfInput', path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForFunction(() => (window.state.pages || []).length === 2, null, { timeout: 30000 });
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay.visible').forEach((m) => window.App.hideModal(m.id)); });
    await seedPalette(page);
    await page.evaluate(() => {
      const ann = window.state.pages[1].canvases[0].annotations;
      ann.counterMarkers = { c2: [{ x: 100, y: 100, id: 'm1', group: null }, { x: 140, y: 100, id: 'm2', group: null }] };
      window.App.updateUI();
      window.App.openQuickKeysModal();
    });
    // Cleanout is second in the palette and the only one placed: it leads, with its total.
    const rows = await page.evaluate(() => [...document.querySelectorAll('#quickKeysResults .quick-key-item')]
      .map((r) => ({ value: r.dataset.value, used: r.querySelector('.quick-key-used').textContent })));
    expect(rows).toEqual([
      { value: 'counter:c2', used: '2' },
      { value: 'counter:c1', used: '' },
      { value: 'lineType:lt1', used: '' },
    ]);
  });

  // MAP-QUICKKEYS: the shared hydrator (restore-last-session.js when the cloud copy
  // is newer, and the view-link boot) never applied the project's Quick Keys or its
  // header pins, so the session kept the last bid's and the next autosave wrote them
  // over this one's. Driven through the published App seam, signed out: the cloud
  // fetch around it is the only part a signed-out run cannot reach.
  test('a restored cloud bid brings back its own Quick Keys and header pins', async ({ page }) => {
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    const after = await page.evaluate(() => {
      const s = window.state;
      // The last bid's layout, still in the session.
      s.numberKeyBindings = { 1: { kind: 'counter', id: 'c1' } };
      s.stripPins = {};
      window.App.hydrateStateFromProjectData({
        counters: [{ id: 'rc', name: 'Restored Counter', icon: '', color: '#4a9eff' }],
        lineTypes: [],
        stripPins: { polylineBtn: true },
        pages: [],
        numberKeyBindings: { 3: { kind: 'counter', id: 'rc' } },
      });
      window.App.updateUI();
      return {
        bindings: JSON.parse(JSON.stringify(s.numberKeyBindings)),
        seeded: s.numberKeyBindingsSeededFromArtboard,
        polylineBehindMore: window.App.isToolOverflowed('polylineBtn'),
      };
    });
    expect(after.bindings).toEqual({ 3: { kind: 'counter', id: 'rc' } });
    expect(after.seeded).toBe(false);                 // through applyProjectQuickKeys: the project owns them now
    expect(after.polylineBehindMore).toBe(false);     // the project's pin, not the trade default
    await pressDigit(page, '3');
    expect(await selection(page)).toMatchObject({ counter: 'rc' });
  });

  // MAP-QUICKKEYS / D44: a cloud project opened without its PDF waits in
  // state.pendingCanvasLoad; uploading the PDF hydrates it (pdf-intake.js
  // matchPendingCanvasLoad), which skipped the Quick Keys, the header pins and the
  // Groups gate. The pending load is seeded as load-project.js leaves it.
  test('a canvas-only bid gets its Quick Keys, header pins and Groups gate when its PDF is uploaded', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.state;
      s.numberKeyBindings = { 1: { kind: 'counter', id: 'c1' } };   // the last bid's
      s.stripPins = {};
      s.groupsEnabled = false;
      s.pendingCanvasLoad = {
        projectId: 'p-canvas-only', name: 'Canvas Only Bid', pdf_hash: null,
        data: {
          counters: [{ id: 'pc', name: 'Pending Counter', icon: '', color: '#4a9eff' }],
          lineTypes: [], groups: [], groupsEnabled: true,
          stripPins: { polylineBtn: true },
          pages: [],
          numberKeyBindings: { 6: { kind: 'counter', id: 'pc' } },
        },
      };
    });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForFunction(() => window.state.pendingCanvasLoad === null && window.state.pages.length > 0, null, { timeout: 10000 });
    const after = await page.evaluate(() => ({
      name: window.state.currentProjectName,
      bindings: JSON.parse(JSON.stringify(window.state.numberKeyBindings)),
      groupsEnabled: window.state.groupsEnabled,
      polylineBehindMore: window.App.isToolOverflowed('polylineBtn'),
    }));
    expect(after.name).toBe('Canvas Only Bid');
    expect(after.bindings).toEqual({ 6: { kind: 'counter', id: 'pc' } });
    expect(after.groupsEnabled).toBe(true);
    expect(after.polylineBehindMore).toBe(false);
  });
});

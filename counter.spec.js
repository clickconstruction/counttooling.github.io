// @ts-check
/**
 * Tests: the window.App registry pilot #17 - the Counter modal (#counterModal)
 * choose/create-counter picker extracted to features/counter.js still creates
 * counters and selects existing ones.
 *
 * Interleaved extraction with bidirectional quickcount coupling: the feature
 * registers App.showCounterTab and consumes App.populateCounterQuickCountPanel
 * (which stays in app.js's Quick Count section). Three new publish-only deps
 * (getIconName, getEffectiveCustomIcons, populateCounterQuickCountPanel). The
 * #counterBtn / #addCounter handlers are clicked programmatically to avoid
 * sidebar visibility flakiness; the in-modal buttons use real clicks.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Counter modal', () => {
  test('registry wired; create + choose flows work with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract.
    expect(await page.evaluate(() => typeof window.App?.showCounterTab)).toBe('function');

    // 3. CREATE: open the create tab via #addCounter, name it, Create.
    const beforeCount = await page.evaluate(() => window.state.counters.length);
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.locator('#counterName').fill('Spec Counter');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const afterCreate = await page.evaluate(() => {
      const cs = window.state.counters;
      const last = cs[cs.length - 1];
      return { count: cs.length, name: last?.name, id: last?.id, activeIsLast: window.state.activeCounterType === last?.id };
    });
    expect(afterCreate.count).toBe(beforeCount + 1);
    expect(afterCreate.name).toBe('Spec Counter');
    expect(afterCreate.activeIsLast).toBe(true);

    // 4. CHOOSE: reopen via #counterBtn (choose tab), select the counter.
    const targetId = afterCreate.id;
    await page.evaluate(() => document.getElementById('counterBtn').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.waitForSelector('#counterChooseList .sidebar-item', { timeout: 5000 });
    await page.locator('#counterChooseList .sidebar-item').first().click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => window.state.activeCounterType)).toBe(targetId);

    expect(errors).toEqual([]);
  });

  test('choose-tab badge sums counter marks across all canvases', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF and create a counter.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.locator('#counterName').fill('Badge Counter');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const cid = await page.evaluate(() => window.state.counters[window.state.counters.length - 1].id);

    // 2. Seed 4 marks spread across pages AND canvases (marker shape from
    // app.js: { x, y, id, group } — only .length matters to the badge):
    // 2 on page 0's active canvas, 1 on a second NON-active canvas of page 0
    // (the across-canvases half an active-only sum would miss), 1 on page 1.
    await page.evaluate((counterId) => {
      const App = window.App;
      const state = window.state;
      const mark = (n) => ({ x: 10 * n, y: 10 * n, id: 'spec-m' + n, group: null });
      const a0 = App.getActiveAnnotations(state.pages[0], 0);
      a0.counterMarkers[counterId] = a0.counterMarkers[counterId] || [];
      a0.counterMarkers[counterId].push(mark(1), mark(2));
      const layer2 = { id: 'spec-c2', name: 'Layer 2', annotations: App.makeAnnotations() };
      layer2.annotations.counterMarkers[counterId] = [mark(3)];
      state.pages[0].canvases.push(layer2);
      const a1 = App.getActiveAnnotations(state.pages[1], 1);
      a1.counterMarkers[counterId] = a1.counterMarkers[counterId] || [];
      a1.counterMarkers[counterId].push(mark(4));
    }, cid);

    // 3. Reopen the Choose tab: the badge must read the all-pages,
    // all-canvases total (4), not the dead p.annotations sum (0).
    await page.evaluate(() => document.getElementById('counterBtn').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.waitForSelector('#counterChooseList .sidebar-item', { timeout: 5000 });
    const badge = page.locator('#counterChooseList .sidebar-item', { hasText: 'Badge Counter' }).locator('.badge');
    await expect(badge).toHaveText('4');

    expect(errors).toEqual([]);
  });

  // JOURNEY-MAP #18: #counterIconSearchGroup shipped with an inline
  // display:none while features/counter.js kept a live #counterIconSearch
  // handler, so the guide promised an icon search that never appeared.
  test('create-tab icon search is visible and filters the icon grid', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await expect(page.locator('#counterIconSearchGroup')).toBeVisible();

    const total = await page.locator('#counterIconGrid .icon-cell').count();
    const expected = await page.evaluate(() =>
      window.App.getOrderedIcons().filter(ic => ic.terms.some(t => t.includes('shower'))).length);
    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(total);

    await page.locator('#counterIconSearch').fill('shower');
    await expect(page.locator('#counterIconGrid .icon-cell')).toHaveCount(expected);
    // The rebuild auto-selects the first hit; the untouched suggested name follows it.
    await expect(page.locator('#counterIconGrid .icon-cell.selected')).toHaveCount(1);
    await expect(page.locator('#counterName')).toHaveValue('Shower');

    // The search filters the bundled grid only, so it is hidden on Custom Icons.
    await page.locator('#counterCreatePanel .counter-icon-tab[data-icon-tab="custom"]').click();
    await expect(page.locator('#counterIconSearchGroup')).toBeHidden();
    await page.locator('#counterCreatePanel .counter-icon-tab[data-icon-tab="icon"]').click();
    await expect(page.locator('#counterIconSearchGroup')).toBeVisible();

    expect(errors).toEqual([]);
  });

  // JOURNEY-MAP #17 (the harmful one): "+ Add" used to prefill "Water Closet"
  // unconditionally, so two back-to-back adds minted identical twins whose
  // tallies split between them.
  test('two back-to-back "+ Add" creates never mint identical counter types', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => document.getElementById('addCounter').click());
      await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
      // Accept the prefill exactly as an estimator in a hurry would.
      await expect(page.locator('#counterName')).not.toHaveValue('');
      await page.locator('#counterCreate').click();
      await page.waitForFunction(
        () => !document.getElementById('counterModal')?.classList.contains('visible'),
        { timeout: 5000 },
      );
    }

    const counters = await page.evaluate(() => window.state.counters.map(c => ({ name: c.name, icon: c.icon, color: c.color })));
    expect(counters.length).toBe(2);
    expect(counters[0].name).not.toBe(counters[1].name);
    expect(counters[0].icon).not.toBe(counters[1].icon);
    // A blank/prefilled create must never fall back to the literal "Counter".
    expect(counters.map(c => c.name)).not.toContain('Counter');

    expect(errors).toEqual([]);
  });

  // The create-time backstop: it keys off the whole state.counters palette, so
  // it also catches names/icons that never came from this form (custom icons,
  // Quick Count, imported palettes).
  test('create suffixes a duplicate name and recolors an exact twin', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 1. A counter carrying a CUSTOM (non-library) icon path, seeded the way
    //    Quick Count / an imported palette would add it.
    await page.evaluate(() => {
      window.state.counters.push({ id: 'spec-custom', name: 'Custom Fixture', icon: 'M0 0L10 0L10 10Z', color: '#e85447' });
      window.App.updateUI();
    });
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.locator('#counterName').fill('Custom Fixture');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => window.state.counters[1].name)).toBe('Custom Fixture 2');

    // 2. An exact twin (same name AND icon AND color) gets the suffix AND a
    //    rotated color, so the two marks are not visually identical.
    const firstIcon = await page.evaluate(() => window.App.getOrderedIcons()[0].value);
    await page.evaluate((icon) => {
      window.state.counters.push({ id: 'spec-twin', name: 'Twin Fixture', icon, color: '#e85447' });
      window.App.updateUI();
    }, firstIcon);
    await page.evaluate(() => document.getElementById('addCounter').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await page.locator('#counterIconGrid .icon-cell').first().click();
    await page.locator('#counterColorRow .color-swatch').first().click();
    await page.locator('#counterName').fill('Twin Fixture');
    await page.locator('#counterCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const twins = await page.evaluate(() => {
      const cs = window.state.counters;
      return { seeded: cs.find(c => c.id === 'spec-twin'), made: cs[cs.length - 1] };
    });
    expect(twins.made.name).toBe('Twin Fixture 2');
    expect(twins.made.icon).toBe(twins.seeded.icon);
    expect(twins.made.color.toLowerCase()).not.toBe(twins.seeded.color.toLowerCase());

    expect(errors).toEqual([]);
  });

  // JOURNEY-MAP #17: C landed on an empty Choose list whose only instruction
  // named a button sitting on another tab.
  test('Counter button opens the pre-filled Create tab when there are no counters', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.evaluate(() => document.getElementById('counterBtn').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await expect(page.locator('#counterCreatePanel')).toBeVisible();
    await expect(page.locator('#counterChoosePanel')).toBeHidden();
    await expect(page.locator('#counterName')).not.toHaveValue('');
    // B17: the modal-level counter search does not filter the Create tab.
    await expect(page.locator('#counterModalSearchRow')).toBeHidden();

    // Once a counter exists, the same button goes back to Choose (with search).
    await page.locator('#counterCreate').click();
    await page.waitForFunction(
      () => !document.getElementById('counterModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    await page.evaluate(() => document.getElementById('counterBtn').click());
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await expect(page.locator('#counterChoosePanel')).toBeVisible();
    await expect(page.locator('#counterModalSearchRow')).toBeVisible();
    // The empty-state copy must not point at the off-panel "Create Counter".
    await page.locator('#counterModalSearchInput').fill('zzz-no-such-counter');
    await expect(page.locator('#counterChooseEmpty')).toBeVisible();
    await expect(page.locator('#counterChooseEmpty')).not.toContainText('Create Counter');

    expect(errors).toEqual([]);
  });
});

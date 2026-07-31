// @ts-check
/**
 * Tests: features/palette-insights.js — the cross-project palette analysis
 * modal with one-click additive adds to the cloud Artboard. Non-cloud: the
 * user_palette_usage RPC, the artboard fetch, and the upsert are stubbed
 * per-test (every dep is read via App.* / getSupabase() at call time), so the
 * ranking, the on-Artboard detection, the ADDITIVE merge payload, the
 * min-projects threshold (filters the lists AND drives "Add all shown"), the
 * immediate add-to-open-project behavior, and localStorage persistence are
 * all pinned without secrets.
 */
const { test, expect } = require('@playwright/test');

const RPC_ROWS = [
  { kind: 'counter', item_id: 'c-wc', name: 'Water Closet', icon: 'M0 0h10v10H0z', color: '#e8c547', curve_style: null, project_count: 11, placement_count: 431, last_used_at: '2026-07-30T00:00:00Z' },
  { kind: 'counter', item_id: 'c-fd', name: 'Floor Drain', icon: 'M0 0h10v10H0z', color: '#47c88e', curve_style: null, project_count: 9, placement_count: 122, last_used_at: '2026-07-29T00:00:00Z' },
  { kind: 'counter', item_id: 'c-hb', name: 'Hose Bibb', icon: 'M0 0h10v10H0z', color: '#ff7a47', curve_style: null, project_count: 1, placement_count: 4, last_used_at: '2026-07-01T00:00:00Z' },
  { kind: 'lineType', item_id: 'lt-w', name: '2in Waste', icon: null, color: '#47c88e', curve_style: 'straight', project_count: 9, placement_count: 340, last_used_at: '2026-07-30T00:00:00Z' },
  { kind: 'lineType', item_id: 'lt-c', name: '3/4in Copper Supply', icon: null, color: '#4a9eff', curve_style: 'straight', project_count: 8, placement_count: 288, last_used_at: '2026-07-28T00:00:00Z' },
];

async function openWithStubs(page) {
  await page.evaluate((rows) => {
    const App = window.App;
    window.__upserts = [];
    App.state.supabaseSession = { user: { id: 'u1' } };
    App.getSupabase = () => ({
      rpc: async () => ({ data: rows, error: null }),
      from: (table) => ({
        upsert: async (payload) => { window.__upserts.push({ table, payload }); return { error: null }; },
      }),
    });
    // Floor Drain (counter) and 3/4in Copper Supply (line type) are already on
    // the artboard — case-insensitive name matching is part of the contract.
    App.fetchUserAirboard = async () => ({
      counters: [{ id: 'ab-fd', name: 'floor drain', icon: 'M0 0', color: '#47c88e' }],
      lineTypes: [{ id: 'ab-cu', name: '3/4IN COPPER SUPPLY', color: '#4a9eff', curveStyle: 'straight' }],
    });
    return App.openPaletteInsightsModal();
  }, RPC_ROWS);
  await page.waitForSelector('#paletteInsightsCounters .pi-row');
}

test.describe('Palette insights (features/palette-insights.js)', () => {
  test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    // @ts-ignore
    page.__errors = errors;
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
  });

  test('registry wired; signed-out open is a toast, not a crash', async ({ page }) => {
    expect(await page.evaluate(() => typeof window.App?.openPaletteInsightsModal)).toBe('function');
    await page.evaluate(() => window.App.openPaletteInsightsModal());
    expect(await page.evaluate(() => document.getElementById('paletteInsightsModal').classList.contains('visible'))).toBe(false);
    // @ts-ignore
    expect(page.__errors).toEqual([]);
  });

  test('rows render ranked unadded-first; default 2+ threshold hides one-offs', async ({ page }) => {
    await openWithStubs(page);
    expect(await page.evaluate(() => document.getElementById('paletteInsightsModal').classList.contains('visible'))).toBe(true);
    // Default threshold is 2+: Hose Bibb (1 project) is hidden, with the
    // hidden-count chip explaining why; Water Closet (unadded, 11) sorts
    // before Floor Drain (on artboard, 9).
    const counterNames = await page.locator('#paletteInsightsCounters .pi-name').allTextContents();
    expect(counterNames).toEqual(['Water Closet', 'Floor Drain']);
    await expect(page.locator('#paletteInsightsHidden')).toHaveText('1 hidden');
    await expect(page.locator('#paletteInsightsAddAll')).toHaveText('Add all shown (2)');
    await expect(page.locator('#paletteInsightsCounters .pi-row').last().locator('.pi-on-badge')).toHaveText(/On Artboard/);
    // Stats read "N projects · M placed/runs".
    await expect(page.locator('#paletteInsightsCounters .pi-row').first().locator('.pi-stat')).toHaveText('11 projects · 431 placed');
    await expect(page.locator('#paletteInsightsLines .pi-row').first().locator('.pi-stat')).toHaveText('9 projects · 340 runs');
    // "Any" reveals the one-off; the chip clears; the choice persists.
    await page.locator('#paletteInsightsMinSeg button', { hasText: 'Any' }).click();
    await expect(page.locator('#paletteInsightsCounters .pi-name')).toHaveCount(3);
    await expect(page.locator('#paletteInsightsHidden')).toHaveText('');
    expect(await page.evaluate(() => localStorage.getItem('paletteInsightsMinProjects'))).toBe('1');
    // @ts-ignore
    expect(page.__errors).toEqual([]);
  });

  test('one-click add merges ADDITIVELY into the artboard, flips the row, and lands in the open project', async ({ page }) => {
    await openWithStubs(page);
    const wcRow = page.locator('#paletteInsightsCounters .pi-row', { hasText: 'Water Closet' });
    await wcRow.locator('.pi-add-btn').click();
    await expect(wcRow.locator('.pi-on-badge')).toHaveText(/Added/);
    // The Wendi fix: the item is usable NOW — it joins the open project's
    // palette (with the RPC's id) and renders in the sidebar picker.
    expect(await page.evaluate(() => window.state.counters.map((c) => c.name))).toContain('Water Closet');
    await expect(page.locator('#countersList .sidebar-item', { hasText: 'Water Closet' })).toHaveCount(1);
    // The Add-all count follows single adds too.
    await expect(page.locator('#paletteInsightsAddAll')).toHaveText('Add all shown (1)');
    const upsert = await page.evaluate(() => window.__upserts[0]);
    expect(upsert.table).toBe('user_airboard');
    // Additive: the existing artboard counter survives, the new one is appended
    // with the RPC's most-recent id, and line_types is untouched content-wise.
    expect(upsert.payload.counters.map((c) => c.name)).toEqual(['floor drain', 'Water Closet']);
    expect(upsert.payload.counters[1].id).toBe('c-wc');
    expect(upsert.payload.line_types.map((lt) => lt.name)).toEqual(['3/4IN COPPER SUPPLY']);
    // Narrow write: only the palette columns ride the upsert.
    expect(Object.keys(upsert.payload).sort()).toEqual(['counters', 'line_types', 'updated_at', 'user_id']);
    // @ts-ignore
    expect(page.__errors).toEqual([]);
  });

  test('add-all adds exactly the visible unadded set (threshold-driven)', async ({ page }) => {
    await openWithStubs(page);
    await page.locator('#paletteInsightsAddAll').click();
    await page.waitForFunction(() => window.__upserts.length === 1);
    const payload = await page.evaluate(() => window.__upserts[0].payload);
    // At the default 2+ threshold: Water Closet (11) + 2in Waste (9) are the
    // visible unadded items; Hose Bibb (1 project) is filtered out; the two
    // already-on-artboard items are not duplicated.
    expect(payload.counters.map((c) => c.name)).toEqual(['floor drain', 'Water Closet']);
    expect(payload.line_types.map((lt) => lt.name)).toEqual(['3/4IN COPPER SUPPLY', '2in Waste']);
    // Both also land in the open project.
    expect(await page.evaluate(() => window.state.counters.map((c) => c.name))).toContain('Water Closet');
    expect(await page.evaluate(() => window.state.lineTypes.map((lt) => lt.name))).toContain('2in Waste');
    // At 2+ every shown row is now added — no add buttons remain; the hidden
    // one-off is still reachable via "Any".
    await expect(page.locator('#paletteInsightsCounters .pi-add-btn')).toHaveCount(0);
    await expect(page.locator('#paletteInsightsLines .pi-add-btn')).toHaveCount(0);
    await expect(page.locator('#paletteInsightsAddAll')).toHaveText('Add all shown (0)');
    // @ts-ignore
    expect(page.__errors).toEqual([]);
  });

  test('threshold choice persists across reopen', async ({ page }) => {
    await openWithStubs(page);
    await page.locator('#paletteInsightsMinSeg button', { hasText: '5+' }).click();
    await expect(page.locator('#paletteInsightsCounters .pi-name')).toHaveCount(2);
    await page.locator('#paletteInsightsClose').click();
    await page.evaluate(() => window.App.openPaletteInsightsModal());
    await page.waitForSelector('#paletteInsightsCounters .pi-row');
    await expect(page.locator('#paletteInsightsMinSeg button.active')).toHaveText('5+');
    await expect(page.locator('#paletteInsightsCounters .pi-name')).toHaveCount(2);
    // @ts-ignore
    expect(page.__errors).toEqual([]);
  });
});

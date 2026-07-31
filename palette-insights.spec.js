// @ts-check
/**
 * Tests: features/palette-insights.js — the cross-project palette analysis
 * modal with one-click additive adds to the cloud Artboard. Non-cloud: the
 * user_palette_usage RPC, the artboard fetch, and the upsert are stubbed
 * per-test (every dep is read via App.* / getSupabase() at call time), so the
 * ranking, the on-Artboard detection, the ADDITIVE merge payload, and the
 * add-all filter are all pinned without secrets.
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

  test('rows render ranked unadded-first with on-Artboard badges', async ({ page }) => {
    await openWithStubs(page);
    expect(await page.evaluate(() => document.getElementById('paletteInsightsModal').classList.contains('visible'))).toBe(true);
    // Counters: Water Closet (unadded, 11) first, Hose Bibb (unadded, 1) next,
    // Floor Drain (already on artboard) last despite 9 projects.
    const counterNames = await page.locator('#paletteInsightsCounters .pi-name').allTextContents();
    expect(counterNames).toEqual(['Water Closet', 'Hose Bibb', 'Floor Drain']);
    await expect(page.locator('#paletteInsightsCounters .pi-row').last().locator('.pi-on-badge')).toHaveText(/On Artboard/);
    // Stats read "N projects · M placed/runs".
    await expect(page.locator('#paletteInsightsCounters .pi-row').first().locator('.pi-stat')).toHaveText('11 projects · 431 placed');
    await expect(page.locator('#paletteInsightsLines .pi-row').first().locator('.pi-stat')).toHaveText('9 projects · 340 runs');
    // @ts-ignore
    expect(page.__errors).toEqual([]);
  });

  test('one-click add merges ADDITIVELY into the artboard and flips the row', async ({ page }) => {
    await openWithStubs(page);
    const wcRow = page.locator('#paletteInsightsCounters .pi-row', { hasText: 'Water Closet' });
    await wcRow.locator('.pi-add-btn').click();
    await expect(wcRow.locator('.pi-on-badge')).toHaveText(/Added/);
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

  test('add-all adds only frequently-used unadded items (>= 2 projects)', async ({ page }) => {
    await openWithStubs(page);
    await page.locator('#paletteInsightsAddAll').click();
    await page.waitForFunction(() => window.__upserts.length === 1);
    const payload = await page.evaluate(() => window.__upserts[0].payload);
    // Water Closet (11 projects) + 2in Waste (9) qualify; Hose Bibb (1 project)
    // does not; the two already-on-artboard items are not duplicated.
    expect(payload.counters.map((c) => c.name)).toEqual(['floor drain', 'Water Closet']);
    expect(payload.line_types.map((lt) => lt.name)).toEqual(['3/4IN COPPER SUPPLY', '2in Waste']);
    // Rows re-rank: every remaining unadded row is the infrequent one.
    await expect(page.locator('#paletteInsightsCounters .pi-add-btn')).toHaveCount(1);
    await expect(page.locator('#paletteInsightsLines .pi-add-btn')).toHaveCount(0);
    // @ts-ignore
    expect(page.__errors).toEqual([]);
  });
});

// @ts-check
/**
 * Open in TakeoffTooling (features/output.js + report.js getTakeoffToolingPayload)
 * and the export contract both downstream apps read.
 *
 * Seeds a two-page project with the conventions that matter: a group (a
 * circuit), a counter with a per-count child rule, a scaled line type with a
 * per-10-ft child rule, and an unscaled page with a run. Asserts:
 *   1. the structured payload (v2) states units, groups, pages and nested
 *      children as facts;
 *   2. the sidebar button runs behind the same scale gate as Copy to /Tooling,
 *      then opens takeofftooling.com/#import=<base64 payload> (window.open
 *      is stubbed);
 *   3. the tab-delimited /Tooling text equals the checked-in fixture
 *      takeoff-handoff.fixture.txt — the same file lives in the TakeoffTooling
 *      repo (import-files/counttooling-export.real.fixture.txt) where its
 *      importer is tested against it, so the two repos cannot drift apart
 *      silently. Regenerate deliberately with UPDATE_FIXTURE=1.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIXTURE_PATH = path.join(__dirname, 'takeoff-handoff.fixture.txt');

async function seed(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state, App = window.App;
    s.currentProjectName = 'Maple St TI';
    s.groups = [{ id: 'g1', name: 'LP-1 / 7', color: '#4a9eff' }];
    s.groupsEnabled = true;
    s.counters = [
      { id: 'c1', name: 'Duplex Receptacle', icon: 'M0 0h24v24H0z', color: '#e8c547', childCounts: [{ name: '4" Square Box', qty: 1, per: 'count' }] },
      { id: 'c2', name: 'Panel LP-1', icon: 'M0 0h24v24H0z', color: '#a47fff' },
    ];
    s.lineTypes = [
      { id: 'lt1', name: '1/2" EMT', color: '#4a9eff', childCounts: [{ name: 'Coupling', qty: 1, per: 'ft', ftInterval: 10 }] },
      { id: 'lt2', name: 'Feeder', color: '#ff7a47' },
    ];
    const p1 = s.pages[0], p2 = s.pages[1];
    p1.scale = { pixelsPerUnit: 12, unit: 'ft', label: '1" = 1 ft' };   // page 2 stays unscaled
    const a1 = App.ensureActiveCanvas(p1).annotations;
    a1.counterMarkers = { c1: [{ x: 50, y: 50, id: 'm1', group: 'g1' }, { x: 80, y: 80, id: 'm2', group: 'g1' }], c2: [{ x: 300, y: 60, id: 'm3', group: null }] };
    a1.quickLines = [{ x1: 100, y1: 100, x2: 220, y2: 100, color: '#4a9eff', id: 'q1', lineTypeId: 'lt1', group: 'g1' }];  // 120 px = 10 ft
    const a2 = App.ensureActiveCanvas(p2).annotations;
    a2.quickLines = [{ x1: 100, y1: 100, x2: 200, y2: 100, color: '#ff7a47', id: 'q2', lineTypeId: 'lt2', group: null }];   // unscaled: 100 px
    App.updateUI();
  });
}

test.describe('Open in TakeoffTooling', () => {
  test('payload v2 states units, groups, pages and nested children', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await seed(page);

    const payload = await page.evaluate(() => window.getTakeoffToolingPayload());
    expect(payload.v).toBe(2);
    expect(payload.source).toBe('counttooling');
    expect(payload.project).toEqual({ name: 'Maple St TI' });
    expect(payload.items).toEqual([
      { description: 'Duplex Receptacle', quantity: 2, unit: 'ea', pages: '1', group: 'LP-1 / 7', children: [{ description: '4" Square Box', quantity: 2, unit: 'ea' }] },
      { description: '1/2" EMT', quantity: 10, unit: 'ft', pages: '1', group: 'LP-1 / 7', children: [{ description: 'Coupling', quantity: 1, unit: 'ea' }] },
      { description: 'Panel LP-1', quantity: 1, unit: 'ea', pages: '1', group: null, children: [] },
      { description: 'Feeder', quantity: 100, unit: 'px', pages: '2', group: null, children: [] },
    ]);

    // this-sheet scope: page 1 only
    const p1 = await page.evaluate(() => window.getTakeoffToolingPayload({ pageIndices: [0] }));
    expect(p1.items.map((i) => i.description)).toEqual(['Duplex Receptacle', '1/2" EMT', 'Panel LP-1']);

    expect(errors).toEqual([]);
  });

  test('the sidebar button gates on scale, then opens takeofftooling.com with the payload', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => {
      window.__opened = [];
      window.open = (url) => { const w = { location: { href: url || '' } }; window.__opened.push(w); return w; };
    });
    await expect(page.locator('#forTakeoffToolingDropdown')).toBeVisible();
    await page.evaluate(() => {
      document.querySelector('.takeoff-tooling-option[data-mode="all"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // page 2 has a run and no scale → the shared gate asks first
    await expect(page.locator('#toolingScaleCheckModal')).toHaveClass(/visible/);
    await page.locator('#toolingScaleCheckExport').click();
    await expect.poll(() => page.evaluate(() => (window.__opened[0] && window.__opened[0].location.href) || '')).toMatch(/^https:\/\/takeofftooling\.com\/#import=/);
    const decoded = await page.evaluate(() => {
      const b64 = window.__opened[0].location.href.split('#import=')[1];
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    });
    expect(decoded.v).toBe(2);
    expect(decoded.items).toHaveLength(4);
    expect(decoded.items.find((i) => i.description === 'Feeder').unit).toBe('px');
    expect(decoded.project.plansUrl).toBeUndefined();   // no cloud project → no plans link
    const toast = await page.evaluate(() => document.getElementById('airboardToastText').textContent);
    expect(toast).toContain('Opened TakeoffTooling with 4 rows');
  });

  test('the /Tooling text matches the fixture shared with TakeoffTooling', async ({ page }) => {
    await seed(page);
    const text = await page.evaluate(() => window.getPipeToolingSummary());
    if (process.env.UPDATE_FIXTURE) fs.writeFileSync(FIXTURE_PATH, text + '\n');
    const expected = fs.readFileSync(FIXTURE_PATH, 'utf8').replace(/\n$/, '');
    expect(text).toBe(expected);
  });
});

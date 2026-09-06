// @ts-check
/**
 * Tests: the Duct sidebar section + organization (DUCT-PLAN.md unit D4).
 *
 * - #ductSection stays hidden until the first duct run exists (the Rooms
 *   rule), then appears with the run's row.
 * - Grouped rows + totals: seeded runs (DUCT-PLAN worked numbers — 24×12 @
 *   24 ga = 6.936 lb/ft etc., re-derived in-spec) render per-size segment
 *   rows ("24×12 24 ga — 86' · 596"), a per-run LF·lb badge, a fittings line
 *   from the D3 inference walk, and the All-duct total; airside headers
 *   appear only once more than one airside exists.
 * - The create modal's airside chip (D4): defaults Supply, resets on re-open,
 *   stamps the run's airside; return runs stroke in the --red family
 *   (DUCT_AIRSIDE_COLORS mapping + a pixel probe on the overlay).
 * - System = group + equipment tag (DUCT-PLAN §2): the group modal's
 *   equipment/capacity/plenum fields persist through a REAL export→import
 *   round-trip (#importInput), the Groups sidebar header shows
 *   "RTU-1 · 600 CFM" + the plenum note, and a run drawn while a group is
 *   active inherits systemGroupId (the T2-12 activeGroupId convention).
 * - Run-row click selects the run (jump + canvas glow state), click again
 *   deselects; the section header chevron collapses/expands.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SHEET = { 26: 0.906, 24: 1.156 }; // lb/sqft — duct-model SHEET_WEIGHT_LB_PER_SQFT
const lbPerFtRect = (w, h, ga) => (2 * (w + h) / 12) * SHEET[ga];
const lbPerFtRound = (d, ga) => (Math.PI * d / 12) * SHEET[ga];
const fmtLb = (lb) => Math.round(lb).toLocaleString('en-US');
const fmtFt = (ft) => Math.round(ft).toLocaleString('en-US') + "'";

test.describe('Duct sidebar (D4)', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 12 pdf-pts per foot, like duct-tool.spec.js.
    await page.evaluate(() => {
      const s = window.state;
      s.pages[s.currentPage].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
  });

  // Arm through the real create modal (airside optional).
  async function armDuct(page, airside) {
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    if (airside) await page.locator('#ductCreateAirside button[data-airside="' + airside + '"]').click();
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
  }

  // Seed a committed run directly on page 0's active canvas (deterministic
  // PDF-space vertices, no click-coordinate noise), then re-walk fittings and
  // re-render — the same annotations surface the tool's commit writes to.
  async function seedRun(page, run) {
    await page.evaluate((cfg) => {
      const canvas = window.App.ensureActiveCanvas(window.state.pages[0]);
      if (!canvas.annotations.ductRuns) canvas.annotations.ductRuns = [];
      canvas.annotations.ductRuns.push(window.makeDuctRun(cfg));
      window.App.reinferDuctFittings(0);
      window.App.updateUI();
      window.App.renderAnnotations();
    }, run);
  }

  test('section hidden with no duct; appears on the first committed run', async ({ page }) => {
    await expect(page.locator('#ductSection')).toBeHidden();

    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await expect(page.locator('#ductSection')).toBeHidden();   // a draft alone is not a run
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 150 } });
    await page.keyboard.press('Enter');

    await expect(page.locator('#ductSection')).toBeVisible();
    await expect(page.locator('#ductList .duct-run-row')).toHaveCount(1);
    await expect(page.locator('#ductList .duct-run-row .duct-run-name')).toHaveText('Duct run 1');
    // Single airside — no airside group headers.
    await expect(page.locator('#ductList .duct-airside-header')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('grouped rows, per-size totals, fittings line, airside headers, All-duct total', async ({ page }) => {
    // Trunk (supply): straight 24×12 for 1032 pts (86'), size-stepped to
    // 20×12 for another 1032 pts — one auto transition, no elbows.
    await seedRun(page, {
      id: 'run-trunk', name: 'Trunk', airside: 'supply', pressureClass: '1',
      vertices: [{ x: 100, y: 100 }, { x: 1132, y: 100 }, { x: 2164, y: 100 }],
      segments: [
        { startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } },
        { startVertexIdx: 1, size: { kind: 'rect', w: 20, h: 12 } },
      ],
    });
    // Branch (return): straight 12"Ø for 516 pts (43').
    await seedRun(page, {
      id: 'run-branch', name: 'Branch', airside: 'return', pressureClass: '1',
      vertices: [{ x: 100, y: 300 }, { x: 616, y: 300 }],
      segments: [{ startVertexIdx: 0, size: { kind: 'round', d: 12 } }],
    });

    // Two airsides -> grouped under airside headers, supply first.
    const headers = page.locator('#ductList .duct-airside-header');
    await expect(headers).toHaveCount(2);
    await expect(headers.nth(0)).toHaveText('Supply');
    await expect(headers.nth(1)).toHaveText('Return');

    // Worked numbers, re-derived: 24×12 @ 24ga = 6.936 lb/ft, 20×12 @ 24ga,
    // 12"Ø @ 26ga; the sidebar's math must agree.
    const lbT1 = 86 * lbPerFtRect(24, 12, 24);
    const lbT2 = 86 * lbPerFtRect(20, 12, 24);
    const lbB = 43 * lbPerFtRound(12, 26);

    const trunk = page.locator('#ductList .duct-run-wrap', { hasText: 'Trunk' });
    await expect(trunk.locator('.duct-run-row .badge')).toHaveText(fmtFt(172) + ' · ' + fmtLb(lbT1 + lbT2) + ' lb');
    await expect(trunk.locator('.duct-seg-row')).toHaveCount(2);
    await expect(trunk.locator('.duct-seg-row').nth(0)).toHaveText("24×12 24 ga — 86' · " + fmtLb(lbT1));
    await expect(trunk.locator('.duct-seg-row').nth(1)).toHaveText("20×12 24 ga — 86' · " + fmtLb(lbT2));
    // D3's walk: the straight-through size boundary infers ONE transition.
    await expect(trunk.locator('.duct-fittings-line')).toHaveText('1 transition');

    const branch = page.locator('#ductList .duct-run-wrap', { hasText: 'Branch' });
    await expect(branch.locator('.duct-run-row .badge')).toHaveText(fmtFt(43) + ' · ' + fmtLb(lbB) + ' lb');
    await expect(branch.locator('.duct-seg-row')).toHaveText('12"Ø 26 ga — 43\' · ' + fmtLb(lbB));
    await expect(branch.locator('.duct-fittings-line')).toHaveCount(0);

    await expect(page.locator('#ductList .duct-all-total .duct-all-total-num'))
      .toHaveText(fmtFt(215) + ' · ' + fmtLb(lbT1 + lbT2 + lbB) + ' lb');

    expect(errors).toEqual([]);
  });

  test('airside chip: defaults Supply, resets on re-open, stamps the run + trade stroke color', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    // The one-place mapping (canvas-draw.js): supply keeps D2's blue, return
    // --red family, exhaust --green family.
    expect(await page.evaluate(() => {
      // eslint-disable-next-line no-undef -- classic-script global lexical const
      return { ...DUCT_AIRSIDE_COLORS };
    })).toEqual({
      supply: '#2e86de', return: '#e85447', exhaust: '#47c88e',
    });

    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateAirside button[data-airside="supply"]')).toHaveClass(/active/);
    await page.locator('#ductCreateAirside button[data-airside="return"]').click();
    await expect(page.locator('#ductCreateAirside button[data-airside="return"]')).toHaveClass(/active/);
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => !!window.state.drawingDuct);
    expect(await page.evaluate(() => window.state.drawingDuct.airside)).toBe('return');

    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 320, y: 150 } });
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].airside)).toBe('return');

    // Pixel probe at the segment's quarter point (the size chip covers the
    // midpoint): the stroke must read RED-dominant (#e85447).
    const probe = await page.evaluate(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
      const run = window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0];
      const a = window.App.toCanvas(run.vertices[0]);
      const b = window.App.toCanvas(run.vertices[1]);
      const qx = Math.round(a.x + (b.x - a.x) * 0.25), qy = Math.round(a.y + (b.y - a.y) * 0.25);
      const d = c.getContext('2d').getImageData(qx - 6, qy - 6, 12, 12).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 200 && d[i] > 150 && d[i] > d[i + 1] + 50 && d[i] > d[i + 2] + 50) return 'red';
      }
      return 'no-red-ink';
    });
    expect(probe).toBe('red');

    // Sidebar groups by airside once supply joins: seed a supply run too.
    await seedRun(page, {
      id: 'run-sup', name: 'Supply main', airside: 'supply', pressureClass: '1',
      vertices: [{ x: 100, y: 500 }, { x: 700, y: 500 }],
      segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 16, h: 10 } }],
    });
    await expect(page.locator('#ductList .duct-airside-header')).toHaveCount(2);

    // Re-open: the chip is back to Supply (never inherits the last pick).
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateAirside button[data-airside="supply"]')).toHaveClass(/active/);
    await page.locator('#ductCreateCancel').click();

    expect(errors).toEqual([]);
  });

  test('system group: modal fields, sidebar header tag, run inheritance, export→import round-trip', async ({ page }) => {

    // Create a system group through the REAL modal.
    await page.evaluate(() => { window.App.openGroupModal(null); });
    await page.locator('#groupModalName').fill('Roof unit 1');
    // Plenum row hidden until a tag exists (a per-system call).
    await expect(page.locator('#groupModalPlenumRow')).toBeHidden();
    await page.locator('#groupModalEquipTag').fill('RTU-1');
    await expect(page.locator('#groupModalPlenumRow')).toBeVisible();
    await page.locator('#groupModalCapacityCfm').fill('600');
    await page.locator('#groupModalPlenumBtn').click();
    await page.locator('#groupModalDone').click();

    const group = await page.evaluate(() => window.state.groups[0]);
    expect(group.equipmentTag).toBe('RTU-1');
    expect(group.capacityCfm).toBe(600);
    expect(group.plenumReturn).toBe(true);

    // Groups sidebar header: "RTU-1 · 600 CFM" + the plenum note.
    await expect(page.locator('#groupsList .group-system-tag')).toHaveText('RTU-1 · 600 CFM');
    await expect(page.locator('#groupsList .group-plenum-note')).toHaveText('plenum return');

    // A run drawn while the group is active inherits systemGroupId (create
    // latched activeGroupId to the new group — the T2-12 convention).
    expect(await page.evaluate(() => window.state.activeGroupId)).toBe(group.id);
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    expect(await page.evaluate(() => window.state.drawingDuct.systemGroupId)).toBe(group.id);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 320, y: 150 } });
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].systemGroupId)).toBe(group.id);

    // Round-trip: the Export Canvas payload shape, back in through the REAL
    // #importInput path after a full reload — groups (with the new fields)
    // and the run's systemGroupId must survive.
    const payload = await page.evaluate(() => JSON.parse(JSON.stringify({
      version: 1,
      counters: window.state.counters, lineTypes: window.state.lineTypes,
      groups: window.state.groups, groupsEnabled: true, rooms: [],
      pages: [{ index: 0, canvases: window.state.pages[0].canvases, scale: window.state.pages[0].scale, rotation: 0 }],
    })));

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.locator('#importInput').setInputFiles({
      name: 'takeoff.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    });
    await page.waitForFunction(() => (window.state.groups || []).length === 1);

    const restored = await page.evaluate(() => ({
      group: window.state.groups[0],
      run: window.state.pages[0].canvases[0].annotations.ductRuns[0],
    }));
    expect(restored.group.equipmentTag).toBe('RTU-1');
    expect(restored.group.capacityCfm).toBe(600);
    expect(restored.group.plenumReturn).toBe(true);
    expect(restored.run.systemGroupId).toBe(restored.group.id);
    expect(restored.run.airside).toBe('supply');
    // The imported takeoff re-renders the section + the system header.
    await expect(page.locator('#ductSection')).toBeVisible();
    await expect(page.locator('#groupsList .group-system-tag')).toHaveText('RTU-1 · 600 CFM');

    expect(errors).toEqual([]);
  });

  test('run-row click selects (jump + glow state) and toggles off; collapse chevron works', async ({ page }) => {
    await seedRun(page, {
      id: 'run-sel', name: 'Selectable', airside: 'supply', pressureClass: '1',
      vertices: [{ x: 100, y: 100 }, { x: 700, y: 100 }],
      segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
    });

    await page.locator('#ductList .duct-run-row').click();
    let sel = await page.evaluate(() => ({ id: window.state.selectedDuctRunId, pi: window.state.selectedDuctRunPageIdx, cur: window.state.currentPage }));
    expect(sel).toEqual({ id: 'run-sel', pi: 0, cur: 0 });
    await expect(page.locator('#ductList .duct-run-row')).toHaveClass(/active/);

    await page.locator('#ductList .duct-run-row').click();   // toggle off
    sel = await page.evaluate(() => ({ id: window.state.selectedDuctRunId, pi: window.state.selectedDuctRunPageIdx }));
    expect(sel).toEqual({ id: null, pi: null });
    await expect(page.locator('#ductList .duct-run-row')).not.toHaveClass(/active/);

    // Collapse: chevron flips, the list hides, rows come back on re-expand.
    await page.locator('#ductSectionTitle').click();
    await expect(page.locator('#ductList')).toBeHidden();
    await expect(page.locator('#ductCollapseIcon')).toHaveText('▶');
    await page.locator('#ductSectionTitle').click();
    await expect(page.locator('#ductList')).toBeVisible();
    await expect(page.locator('#ductCollapseIcon')).toHaveText('▼');
    await expect(page.locator('#ductList .duct-run-row')).toHaveCount(1);

    expect(errors).toEqual([]);
  });
});

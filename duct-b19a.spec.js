// @ts-check
/**
 * Tests: Tier-3 batch B19 part 1 (DUCT unit D18, ratcheted form — JOURNEY-MAP
 * B19 "Ratchet 2026-09-13" + journeys/plans/_INDEX-DUCT.md Wave 3 row D18).
 *
 * 1. Duct hotkey through the HOTKEYS single source: `u` (D is Measure's)
 *    arms Duct; the ⋯ row, the Keyboard Map, the Cmd-peek badge and the
 *    #ductBtn tooltip ("Duct · U") all read that row; mid-trace S still
 *    steps size and a re-press re-arms (never a second create dialog).
 * 2. The inline icon chip beside a CFM field — "→ [icon] Supply Diffuser ·
 *    change" — on the Create tab AND Quick Count: appears when a CFM is typed
 *    (no tab switch), an explicit pick replaces its icon, "change" opens the
 *    Custom Icons grid scrolled to the HVAC group; HVAC cells carry titles.
 * 3. ONE toast on Copy Schedule (the S5 advisory card no longer stacks; the
 *    open ⚠ rows + the PipeTooling hint ride the copied toast).
 * 4. Gate memory: "Export anyway" records the unresolved set on
 *    state.bidCheck.acknowledgedGate ({ rows: [{ id, verdict }], at }); the
 *    same set exports silently, any change re-arms, and it persists like the
 *    ticks (export data → hydrate).
 * 5. Flex-drop label/placeholder read DUCT_FLEX_DEFAULTS.dropFt at render;
 *    the seam & waste input is a 64 px `duct-schedule-num` box.
 * 6. Rise/drop markers join the fitting family: paint (offscreen render at
 *    duct-model's anchor), hitTest → the menu ("Edit rise/drop…" inline /
 *    "Remove"), an edited auto riser drops `auto`, reconciliation leaves the
 *    entries alone, and the schedule's straight LF counts them once.
 * 7. `build:icons --check` exits 1 on a stale icons-custom.js and is the
 *    eleventh `npm run check` step (the punch-list check made it eleven, 2026-09-16).
 */
const { test, expect } = require('@playwright/test');

// D19: the CFM / Mount height / Flex drop fields now fold under the
// "More ▸ air & mounting" disclosure on the Counter modal, which starts CLOSED
// on a trade-less (plumbing-default) project like these fixtures. Unfold it
// before touching them — the same click the estimator makes.
const unfoldAirMore = (page, which) => page.evaluate((w) => {
  const id = w === 'quick' ? 'counterQuickCountAirMore' : 'counterAirMore';
  const fields = document.getElementById(id + 'Fields');
  if (fields && fields.hidden) document.getElementById(id + 'Toggle').click();
}, which);

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const PDF = path.join(__dirname, 'test-2pages.pdf');

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });   // Copy Schedule writes the clipboard

async function boot(page, errors) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(PDF);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    try { localStorage.removeItem('plumbingModifiers'); } catch (_) {}
  });
}

// A committed 24×12 wrapped trunk on page 0 (the D9 seeding recipe), with
// optional verticalFt entries.
const seedTrunk = (page, verticalFt) => page.evaluate((vf) => {
  const s = window.state;
  const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
  ann.ductRuns = [window.makeDuctRun({
    id: 'run-1', name: 'Trunk', airside: 'supply', pressureClass: '1', linerType: 'wrap',
    vertices: [{ x: 100, y: 100 }, { x: 500, y: 100 }],
    segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
    verticalFt: vf || undefined,
  })];
  window.App.reinferDuctFittings(0);
  window.App.renderAnnotations();
  window.App.updateUI();
}, verticalFt || null);
const seedRoomBox = (page, heightFt) => page.evaluate((h) => {
  const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
  (ann.roomBoxes = ann.roomBoxes || []).push({ x1: 50, y1: 50, x2: 600, y2: 200, heightFt: h, roomId: null, id: 'box-1' });
  window.App.updateUI();
}, heightFt);
const setDeck = (page, ft) => page.evaluate((v) => { window.App.getDuctSettings().deckHeightFt = v; window.App.updateUI(); }, ft);
const diffuserPath = (page) => page.evaluate(() => window.App.cfmDefaultIcon());

async function openCreateTab(page) {
  await page.evaluate(() => document.getElementById('addCounter')?.click());
  await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
  await expect(page.locator('#counterCreatePanel')).toBeVisible();
  await unfoldAirMore(page);
}
async function openQuickTab(page) {
  await page.evaluate(() => { window.App.showModal('counterModal'); window.App.showCounterTab('quickcount'); });
  await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
  await expect(page.locator('#counterQuickCountPanel')).toBeVisible();
  await unfoldAirMore(page, 'quick');
}
// Is the HVAC heading inside the grid's visible box (the "pre-scrolled" claim)?
const hvacHeadingInView = (page, gridId) => page.evaluate((id) => {
  const grid = document.getElementById(id);
  const h = Array.from(grid.querySelectorAll('.icon-grid-heading')).find((x) => x.textContent.trim() === 'HVAC');
  if (!h) return { found: false };
  const g = grid.getBoundingClientRect(); const r = h.getBoundingClientRect();
  return { found: true, inView: r.top >= g.top - 1 && r.bottom <= g.bottom + 1, scrollTop: grid.scrollTop, scrollable: grid.scrollHeight > grid.clientHeight };
}, gridId);

test.describe('B19 part 1 (D18)', () => {
  /** @type {string[]} */
  let errors;
  test.beforeEach(async ({ page }) => { errors = []; await boot(page, errors); });

  test('1. hotkey: U arms Duct from the HOTKEYS table; tooltip, ⋯ row, Keyboard Map and peek badge read it; S mid-trace still steps size', async ({ page }) => {
    const row = await page.evaluate(() => window.App.HOTKEYS.find((h) => !h.bespoke && h.btnId === 'ductBtn'));
    expect(row).toBeTruthy();
    expect(row.key).toBe('u');   // D is Measure's; the first free letter of "Duct"
    // Every letter in the table is unique — no clash with Measure's D or anyone.
    const keys = await page.evaluate(() => window.App.HOTKEYS.filter((h) => !h.bespoke).map((h) => h.key));
    expect(new Set(keys).size).toBe(keys.length);
    // The tooltip reads the row.
    await expect(page.locator('#ductBtn')).toHaveAttribute('title', 'Duct · U');

    // Pressing U (scale set) opens the create dialog — the button's own path.
    await page.keyboard.press('u');
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateW').fill('24');
    await page.locator('#ductCreateH').fill('12');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
    const wrapper = page.locator('#canvasWrapper');
    await wrapper.click({ position: { x: 150, y: 300 } });
    await wrapper.click({ position: { x: 320, y: 300 } });
    // Mid-trace: S is the size popover (not Set Scale); U re-arms the same draft.
    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.DUCT));
    await page.keyboard.press('Escape');   // closes the popover (the first rung)
    await expect(page.locator('#ductSizePopover')).toBeHidden();
    await page.keyboard.press('u');
    await expect(page.locator('#ductCreateModal')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => window.state.drawingDuct.vertices.length)).toBe(2);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct);
    // D still means Measure.
    await page.keyboard.press('d');
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.MEASURE));
    await page.keyboard.press('m');

    // The ⋯ row's key column comes from the table.
    await page.locator('#headerMoreBtn').click();
    await expect(page.locator('#headerMoreMenu .hm-row[data-tool-id="ductBtn"] .hm-key')).toHaveText('U');
    await page.keyboard.press('Escape');

    // Keyboard Map: the generated Macros row + the lit U key.
    await page.evaluate(() => document.getElementById('statusBarMacros').click());
    await page.waitForSelector('#macrosModal.visible', { timeout: 5000 });
    const macrosRow = await page.evaluate(() => Array.from(document.querySelectorAll('#macrosModal .macros-table tr')).map((tr) => tr.textContent.replace(/\s+/g, ' ').trim()).find((t) => /Duct mode/.test(t)));
    expect(macrosRow).toMatch(/^U\s*Duct mode/);
    expect(await page.evaluate(() => document.querySelector('#macrosKeyboardBoard .kb-key[data-key="U"]')?.className)).toContain('is-mapped');
    await page.keyboard.press('Escape');

    // Cmd-peek badge (features/hotkey-peek.js stamps from App.HOTKEYS).
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', bubbles: true })));
    await page.waitForFunction(() => window.App.__hotkeyPeekState().peeking, null, { timeout: 4000 });
    await expect(page.locator('#ductBtn .hk-badge')).toHaveText('U');
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta', bubbles: true })));
    expect(errors).toEqual([]);
  });

  test('2. CFM icon chip: Create tab + Quick Count — appears on CFM, no tab switch, a pick replaces it, "change" lands on HVAC, cells carry titles', async ({ page }) => {
    const diffuser = await diffuserPath(page);
    await openCreateTab(page);
    const chip = page.locator('#counterCfmIconChip');
    await expect(chip).toBeHidden();
    await page.locator('#counterName').fill('SD-1');
    await page.locator('#counterCfm').fill('250');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText(/^→\s*Supply Diffuser\s*·\s*change$/);
    await expect(chip).toHaveAttribute('data-path', diffuser);
    await expect(chip.locator('svg path')).toHaveAttribute('d', diffuser);
    // NO automatic tab switch: the Icon panel stays up.
    await expect(page.locator('#counterIconCustomPanel')).toBeHidden();
    await expect(page.locator('#counterCreatePanel .counter-icon-tab[data-icon-tab="icon"]')).toHaveClass(/active/);
    // HVAC cells carry their names as tooltips.
    const titles = await page.evaluate(() => Array.from(document.querySelectorAll('#counterIconGridCustom .icon-cell[data-path]')).map((c) => c.getAttribute('title')));
    expect(titles).toEqual(expect.arrayContaining(['Supply Diffuser', 'Return Grille', 'RTU', 'VAV Box', 'Fire/Smoke Damper']));
    expect(titles.every((t) => !!t)).toBe(true);
    // "change" opens the Custom Icons grid pre-scrolled to the HVAC group.
    await chip.locator('.cfm-icon-chip-change').click();
    await expect(page.locator('#counterIconCustomPanel')).toBeVisible();
    const view = await hvacHeadingInView(page, 'counterIconGridCustom');
    expect(view.found).toBe(true);
    expect(view.scrollable).toBe(true);
    expect(view.scrollTop).toBeGreaterThan(0);
    expect(view.inView).toBe(true);
    // An explicit pick (the RTU) replaces the chip's icon; Create stamps it.
    await page.locator('#counterIconGridCustom .icon-cell[title="RTU"]').click();
    await expect(chip).toHaveText(/^→\s*RTU\s*·\s*change$/);
    // Clearing the CFM hides the chip; typing it again brings the pick back (not the default).
    await page.locator('#counterCfm').fill('');
    await expect(chip).toBeHidden();
    await page.locator('#counterCfm').fill('250');
    await expect(chip).toHaveText(/^→\s*RTU\s*·\s*change$/);
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    const made = await page.evaluate(() => { const c = window.state.counters[window.state.counters.length - 1]; return { name: c.name, cfm: c.cfm, icon: c.icon }; });
    expect(made.name).toBe('SD-1');
    expect(made.cfm).toBe(250);
    expect(made.icon).toBe(await page.evaluate(() => window.App.getEffectiveCustomIcons().find((i) => i.set === 'hvac' && i.name === 'RTU').value));

    // Quick Count: the twin chip beside #counterQuickCountCfm; the hint yields to it.
    await openQuickTab(page);
    const qchip = page.locator('#counterQuickCountCfmIconChip');
    await expect(qchip).toBeHidden();
    await expect(page.locator('#counterQuickCountCfmHint')).toBeVisible();
    await page.locator('#counterQuickCountCfm').fill('150');
    await expect(qchip).toBeVisible();
    await expect(qchip).toHaveText(/^→\s*Supply Diffuser\s*·\s*change$/);
    await expect(page.locator('#counterQuickCountCfmHint')).toBeHidden();
    await expect(page.locator('#counterQuickCountIconCustomPanel')).toBeHidden();   // no tab switch here either
    await qchip.locator('.cfm-icon-chip-change').click();
    await expect(page.locator('#counterQuickCountIconCustomPanel')).toBeVisible();
    const qview = await hvacHeadingInView(page, 'counterQuickCountIconGridCustom');
    expect(qview.found).toBe(true);
    expect(qview.inView).toBe(true);
    await page.locator('#counterQuickCountIconGridCustom .icon-cell[title="VAV Box"]').click();
    await expect(qchip).toHaveText(/^→\s*VAV Box\s*·\s*change$/);
    await page.locator('#counterQuickCountCancel').click();
    expect(errors).toEqual([]);
  });

  test('3. Copy Schedule shows ONE toast — the copied line carries the PipeTooling hint and the open ⚠ rows; no advisory card', async ({ page }) => {
    await seedTrunk(page);
    await seedRoomBox(page, 10);
    await setDeck(page, 11);   // "Fits the roof" → auto ⚠
    expect(await page.evaluate(() => window.App.getBidCheck().open.auto)).toBe(1);
    await page.evaluate(() => window.App.openDuctScheduleModal());
    await expect(page.locator('#ductScheduleModal')).toHaveClass(/visible/);
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    await page.locator('#ductScheduleCopy').click();
    expect(dialogs, 'no alert fired by the copy: ' + errors.join(' | ')).toEqual([]);
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    const toast = await page.locator('#airboardToastText').textContent();
    expect(toast).toMatch(/^Duct schedule copied\. Bid weight [\d,]+ lb\. Pastes into PipeTooling in columns\. Bid Check: 1 open item: fits the roof\.$/);
    await expect(page.locator('#bidCheckAdvisoryModal.visible')).toHaveCount(0);
    expect(await page.locator('.toast-card.visible').count()).toBe(1);
    // The clipboard still got the table.
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Bid weight');
    // Nothing open → the toast is just the number + the hint.
    await setDeck(page, 12.5);
    await page.evaluate(() => { const bc = window.App.getBidCheck(); bc.manual.forEach((r) => { window.state.bidCheck.manual[r.id] = true; }); window.App.updateUI(); });
    expect(await page.evaluate(() => window.App.ductCopiedToastText(window.App.computeDuctSchedule({ pageIndices: [0] })))).toMatch(/^Duct schedule copied\. Bid weight [\d,]+ lb\. Pastes into PipeTooling in columns\.$/);
    expect(errors).toEqual([]);
  });

  test('4. gate memory: Export anyway records the unresolved set; identical set → silent; any change re-arms; persists with the project', async ({ page }) => {
    await seedTrunk(page);
    await seedRoomBox(page, 10);
    await setDeck(page, 11);
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveText('1 ⚠ · 8 unchecked');
    expect(await page.evaluate(() => window.state.bidCheck.acknowledgedGate)).toBeUndefined();

    // First press: the toast. Export anyway → the exact set is recorded.
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await page.click('#bidGateExportAnyway');
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await page.click('#specificPagesCancel');
    const ack = await page.evaluate(() => JSON.parse(JSON.stringify(window.state.bidCheck.acknowledgedGate)));
    expect(ack.rows).toEqual([
      { id: 'addenda', verdict: 'unchecked' },
      { id: 'duct-controls', verdict: 'unchecked' },
      { id: 'duct-curb-power', verdict: 'unchecked' },
      { id: 'duct-fire-dampers', verdict: 'unchecked' },
      { id: 'duct-fits-roof', verdict: 'warn' },
      { id: 'duct-oa-code', verdict: 'unchecked' },
      { id: 'duct-static-path', verdict: 'unchecked' },
      { id: 'scale-verified', verdict: 'unchecked' },
      { id: 'scope-vs-drawings', verdict: 'unchecked' },
    ]);
    expect(typeof ack.at).toBe('string');
    expect(await page.evaluate(() => window.App.isDuctBidGateAcknowledged())).toBe(true);

    // Second press, same set: no toast — straight to the dialog. Same for the copy.
    await page.click('#specificPages');
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await expect(page.locator('#bidGateToastModal.visible')).toHaveCount(0);
    await page.click('#specificPagesCancel');
    expect(await page.evaluate(async () => { window.__copied = 0; await window.App.runGatedCopy(null, [0], async () => { window.__copied++; }, 'pipe-tooling', 'this-canvas'); return window.__copied; })).toBe(1);
    await expect(page.locator('#bidGateToastModal.visible')).toHaveCount(0);
    // The badge still tells the truth — memory silences the toast, not the count.
    await expect(page.locator('#specificPages .bid-gate-badge')).toHaveText('1 ⚠ · 8 unchecked');

    // A manual row ticked → the set changed → re-armed.
    await page.evaluate(() => { window.state.bidCheck.manual['addenda'] = true; window.App.updateUI(); });
    expect(await page.evaluate(() => window.App.isDuctBidGateAcknowledged())).toBe(false);
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await page.click('#bidGateExportAnyway');
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await page.click('#specificPagesCancel');
    expect(await page.evaluate(() => window.state.bidCheck.acknowledgedGate.rows.length)).toBe(8);
    // Unticked again → the ORIGINAL set, but not the LAST acknowledged one → re-armed.
    await page.evaluate(() => { delete window.state.bidCheck.manual['addenda']; window.App.updateUI(); });
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await page.click('#bidGateReview');
    await expect(page.locator('#bidGateToastModal')).not.toHaveClass(/visible/);
    // Review acknowledges nothing.
    expect(await page.evaluate(() => window.state.bidCheck.acknowledgedGate.rows.length)).toBe(8);
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastModal')).toHaveClass(/visible/);
    await page.click('#bidGateExportAnyway');
    await page.click('#specificPagesCancel');
    expect(await page.evaluate(() => window.App.isDuctBidGateAcknowledged())).toBe(true);
    // An auto ⚠ resolving is a change too (deck raised → the roof row clears).
    await setDeck(page, 12.5);
    expect(await page.evaluate(() => window.App.isDuctBidGateAcknowledged())).toBe(false);
    await page.click('#specificPages');
    await expect(page.locator('#bidGateToastText')).toHaveText('Bid Check: Fire dampers at rated walls?');
    await page.click('#bidGateExportAnyway');
    await page.click('#specificPagesCancel');

    // Persistence: rides the project data like the ticks (export → hydrate).
    const data = await page.evaluate(() => JSON.parse(JSON.stringify(window.App.buildCanvasExportData())));
    expect(data.bidCheck.acknowledgedGate.rows.length).toBe(8);
    await page.evaluate(() => { window.state.bidCheck = { manual: {} }; window.App.updateUI(); });
    expect(await page.evaluate(() => window.App.isDuctBidGateAcknowledged())).toBe(false);
    await page.evaluate((d) => window.App.hydrateStateFromProjectData(d), data);
    await page.evaluate(() => window.App.updateUI());
    expect(await page.evaluate(() => window.App.isDuctBidGateAcknowledged())).toBe(true);
    await page.click('#specificPages');
    await expect(page.locator('#specificPagesModal')).toHaveClass(/visible/);
    await expect(page.locator('#bidGateToastModal.visible')).toHaveCount(0);
    await page.click('#specificPagesCancel');
    expect(errors).toEqual([]);
  });

  test('5. flex-drop label + placeholder read DUCT_FLEX_DEFAULTS.dropFt; the seam & waste input is a duct-schedule-num box', async ({ page }) => {
    // (a top-level `const` in a classic script is a global binding, not a window property)
    const dropFt = await page.evaluate(() => DUCT_FLEX_DEFAULTS.dropFt);   // eslint-disable-line no-undef
    expect(dropFt).toBe(5);
    await openCreateTab(page);
    await expect(page.locator('#counterFlexDrop')).toHaveAttribute('placeholder', String(dropFt));
    await expect(page.locator('#counterFlexDropDefault')).toHaveText(dropFt + "'");
    expect((await page.locator('#counterFlexDrop').locator('xpath=..').locator('label').textContent()).replace(/\s+/g, ' ')).toContain("empty = " + dropFt + "')");
    // No literal "8" survives anywhere on the surface.
    expect(await page.locator('#counterCreatePanel').textContent()).not.toMatch(/empty = 8/);
    await page.locator('#counterCancel').click();

    await seedTrunk(page);
    await page.evaluate(() => window.App.openDuctScheduleModal());
    await expect(page.locator('#ductScheduleModal')).toHaveClass(/visible/);
    const seam = page.locator('#ductSeamWastePct');
    await expect(seam).toHaveClass(/duct-schedule-num/);
    const box = await seam.boundingBox();
    expect(box.width).toBeLessThanOrEqual(70);
    expect(box.width).toBeGreaterThanOrEqual(50);
    // The seam row stays on one line: the input is as tall as the knob-row inputs.
    const maxFlex = await page.locator('#ductMaxFlex').boundingBox();
    expect(Math.abs(box.width - maxFlex.width)).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  test('6. rise/drop markers: paint at the anchor, hit-test into the menu, edit inline / remove, auto riser survives as manual, schedule LF counted once', async ({ page }) => {
    await seedTrunk(page, [{ vertexIdx: 1, ft: 12 }, { vertexIdx: 0, ft: 3, auto: true }]);
    // Anchor: the vertex lifted 10 pt (duct-model ductVerticalMarkerAnchor).
    expect(await page.evaluate(() => ductVerticalMarkerAnchor(window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0], { vertexIdx: 1, ft: 12 }))).toEqual({ x: 500, y: 90 });   // eslint-disable-line no-undef

    // PAINT: an offscreen render at scale 1 (the export path — the same core
    // the live overlay uses) shows the vertical family color at the anchor
    // and none of it at a bare stretch of the run.
    const paint = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 700; c.height = 300;
      const ctx = c.getContext('2d');
      window.App.renderAnnotationsToContext(ctx, window.state.pages[0], 1);
      const isBlue = (px) => Math.abs(px[0] - 0x4a) < 12 && Math.abs(px[1] - 0x7f) < 12 && Math.abs(px[2] - 0xb5) < 12 && px[3] > 200;
      const count = (x0, y0) => { let n = 0; for (let x = x0 - 4; x <= x0 + 4; x++) for (let y = y0 - 4; y <= y0 + 4; y++) { if (isBlue(ctx.getImageData(x, y, 1, 1).data)) n++; } return n; };
      return { atEnd: count(500, 90), atStart: count(100, 90), bare: count(300, 70) };
    });
    expect(paint.atEnd).toBeGreaterThan(0);
    expect(paint.atStart).toBeGreaterThan(0);   // the auto riser paints too
    expect(paint.bare).toBe(0);

    // The schedule's straight LF: 400 pt / 12 = 33.33' flat + 12 + 3 vertical —
    // counted ONCE (runStraightItems already carries the entries; the marker
    // pass adds nothing to the tallies).
    const straightFt = () => page.evaluate(() => Math.round(window.App.computeDuctSchedule({ pageIndices: [0] }).straightTotalFt * 100) / 100);
    expect(await straightFt()).toBe(Math.round((400 / 12 + 12 + 3) * 100) / 100);

    // HIT-TEST → the menu at the marker (right-click at the anchor's screen point).
    const pt = await page.evaluate(() => {
      const s = window.state; const r = document.getElementById('canvasWrapper').getBoundingClientRect();
      const a = { x: 500, y: 90 };
      return { x: r.left + a.x * s.zoom + s.pan.x, y: r.top + a.y * s.zoom + s.pan.y };
    });
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    const menu = page.locator('#ductFittingMenu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.tool-context-menu-heading')).toHaveText("12' rise/drop · Trunk");
    await expect(menu.getByRole('menuitem', { name: 'Edit rise/drop…' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Remove' })).toBeVisible();
    // Edit inline: the S popover's field, prefilled; Enter commits.
    await menu.getByRole('menuitem', { name: 'Edit rise/drop…' }).click();
    await expect(menu).toBeVisible();
    const field = menu.locator('.duct-menu-vertical-edit input');
    await expect(field).toHaveValue('12');
    await field.fill('8');
    await field.press('Enter');
    await expect(menu).toBeHidden();
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].verticalFt)).toEqual([{ vertexIdx: 1, ft: 8 }, { vertexIdx: 0, ft: 3, auto: true }]);
    expect(await straightFt()).toBe(Math.round((400 / 12 + 8 + 3) * 100) / 100);
    // One undo snapshot per edit: Ctrl+Z restores the 12.
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })));
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].verticalFt[0].ft)).toBe(12);
    expect(await straightFt()).toBe(Math.round((400 / 12 + 12 + 3) * 100) / 100);

    // The auto riser: its heading says so; an edit makes it the human's (auto gone).
    const pt0 = await page.evaluate(() => {
      const s = window.state; const r = document.getElementById('canvasWrapper').getBoundingClientRect();
      return { x: r.left + 100 * s.zoom + s.pan.x, y: r.top + 90 * s.zoom + s.pan.y };
    });
    await page.mouse.click(pt0.x, pt0.y, { button: 'right' });
    await expect(menu.locator('.tool-context-menu-heading')).toHaveText("3' rise/drop · Trunk · auto riser");
    await menu.getByRole('menuitem', { name: 'Edit rise/drop…' }).click();
    await menu.locator('.duct-menu-vertical-edit input').fill('4.5');
    await menu.getByRole('button', { name: 'Save' }).click();
    await expect(menu).toBeHidden();
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].verticalFt)).toEqual([{ vertexIdx: 1, ft: 12 }, { vertexIdx: 0, ft: 4.5 }]);
    // Reconciliation (the fittings walk) leaves the entries alone; the D17 deck
    // pass respects the now-manual vertex-0 entry (no auto twin added).
    await page.evaluate(() => { window.App.reinferDuctFittings(0); window.App.setDuctDeckHeight && window.App.setDuctDeckHeight(14); window.App.updateUI(); });
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].verticalFt)).toEqual([{ vertexIdx: 1, ft: 12 }, { vertexIdx: 0, ft: 4.5 }]);

    // Remove: the entry goes; the last removal drops the key (pre-D8 shape).
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    await expect(menu.locator('.tool-context-menu-heading')).toHaveText("12' rise/drop · Trunk");
    await menu.getByRole('menuitem', { name: 'Remove' }).click();
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0].verticalFt)).toEqual([{ vertexIdx: 0, ft: 4.5 }]);
    // Nothing to hit at the old anchor now (the run itself is 10 pt below, outside the 12px/zoom radius? — the run wins the line contest, not the vertical).
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    if (await menu.isVisible()) await expect(menu.locator('.tool-context-menu-heading')).not.toContainText('rise/drop');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.App.removeDuctVerticalFt(0, 0));
    expect(await page.evaluate(() => 'verticalFt' in window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0])).toBe(false);
    // hideMarks hides the marker's hit-test with everything else (T2-03).
    await seedTrunk(page, [{ vertexIdx: 1, ft: 12 }]);
    await page.evaluate(() => { window.state.hideMarks = true; window.App.updateUI(); });
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    await expect(menu).toBeHidden();
    await page.evaluate(() => { window.state.hideMarks = false; window.App.updateUI(); });
    expect(errors).toEqual([]);
  });

  test('7. build:icons --check exits 1 on a stale icons-custom.js and is an npm run check step', async () => {
    const script = path.join(__dirname, 'scripts', 'build-custom-icons.js');
    const clean = spawnSync(process.execPath, [script, '--check'], { cwd: __dirname, encoding: 'utf8' });
    expect(clean.status).toBe(0);
    expect(clean.stdout).toMatch(/icons-custom\.js up to date/);
    // A deliberately stale copy (one extra byte) fails the check — against a
    // temp --out, so the committed file is never touched.
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ct-icons-')), 'icons-custom.js');
    fs.writeFileSync(tmp, fs.readFileSync(path.join(__dirname, 'icons-custom.js'), 'utf8') + '\n// stale\n');
    const stale = spawnSync(process.execPath, [script, '--check', '--out', tmp], { cwd: __dirname, encoding: 'utf8' });
    expect(stale.status).toBe(1);
    expect(stale.stderr).toMatch(/icons-custom\.js is stale vs my-counters\//);
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    // The aggregate runner lists it (13 steps since the project-map invariants, 2026-09-25; 12 since
    // the lesson rules check, 2026-09-25; 11 since the punch-list check, 2026-09-16).
    const check = fs.readFileSync(path.join(__dirname, 'scripts', 'check.js'), 'utf8');
    const steps = check.match(/^\s*\{ name: '/gm) || [];
    expect(steps.length).toBe(13);
    expect(check).toMatch(/name: 'build:icons --check', cmd: 'node', args: \['scripts\/build-custom-icons\.js', '--check'\]/);
  });
});

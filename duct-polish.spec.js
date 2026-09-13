// @ts-check
/**
 * Tests: duct polish (DUCT-PLAN.md unit D8).
 *
 * - Rise/drop in the S popover (§4): the order-30 section stages a verticalFt
 *   entry at the last placed vertex; the committed run carries it and the
 *   Duct Schedule's straight total grows by exactly those feet (at the
 *   segment's size — duct-model's runStraightItems contract).
 * - Auto deck riser: with ductSettings.deckHeightFt set (the schedule-modal
 *   Polish row), a run started on its system's equipment marker stages an
 *   { vertexIdx: 0, auto: true } riser — deck height minus the containing
 *   room box's ceiling when known — removable from the popover at vertex 0.
 * - Flex drops: CFM devices attached to duct feed the per-system Flex line
 *   (counter flexDropFt, default 8'), with the "N drops over X' max" warning
 *   past ductSettings.maxFlexFt (editable, re-renders live); the copy text
 *   carries the same lines. LF only — the bid weight is untouched.
 * - VD-per-tap (§6): the schedule's Volume damper row per tap, the
 *   #ductVdPerTapBtn toggle, and the per-fitting right-click Remove/Add
 *   volume damper (noVd survives re-inference — the auto:false pattern).
 * - Round-first dual suggestion: two chips ('10"Ø' then '12×8'); tapping
 *   EITHER applies that size through applyDuctSizeStep.
 * - Neck-size prefill: a CFM counter whose name has no explicit size carries
 *   the D1-table suggestion as its sidebar-row title and a details-modal
 *   line; a name that already says a size shows neither.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Duct polish (D8)', () => {
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
    await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    });
  });

  // Arm a supply run through the real create modal (duct-fittings.spec recipe).
  async function armDuct(page, w = 24, h = 12) {
    await expect(page.locator('#ductBtn')).toBeVisible();
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateW').fill(String(w));
    await page.locator('#ductCreateH').fill(String(h));
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
  }

  async function openSchedule(page) {
    await page.evaluate(() => window.App.openDuctScheduleModal());
    await expect(page.locator('#ductScheduleModal')).toHaveClass(/visible/);
  }

  test('rise/drop popover section: entry staged at the last vertex, committed, and counted in the schedule', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 300 } });
    await wrapper.click({ position: { x: 320, y: 300 } });

    await page.keyboard.press('s');
    await expect(page.locator('#ductSizePopover')).toBeVisible();
    const section = page.locator('#ductSizeSections [data-section-id="rise-drop"]');
    await expect(section).toBeVisible();
    await section.locator('input').fill('10');
    await section.getByRole('button', { name: 'Add' }).click();
    // The entry lists in place (requestRender) and sits on the draft at the
    // LAST placed vertex.
    await expect(section.locator('.duct-vertical-row')).toHaveText(/10' vertical/);
    expect(await page.evaluate(() => window.state.drawingDuct.verticalFt)).toEqual([{ vertexIdx: 1, ft: 10 }]);

    // Commit via the finish bar; the run carries the entry.
    await page.locator('#finishDuctRunBtn').click();
    await page.waitForFunction(() => !window.state.drawingDuct);
    const run = await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductRuns[0]);
    expect(run.verticalFt).toEqual([{ vertexIdx: 1, ft: 10 }]);

    // The schedule's straight total = flat trace + the 10 vertical feet.
    const { withV, flat } = await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      const r = ann.ductRuns[0];
      const distFt = (a, b) => window.App.getLineRealWorldLengthFeet({ points: [a, b] }, 0, true, ann) || 0;
      const items = window.runStraightItems(r, distFt);
      return {
        withV: items.reduce((n, i) => n + i.lengthFt, 0),
        flat: items.filter((i) => !i.vertical).reduce((n, i) => n + i.lengthFt, 0),
      };
    });
    expect(withV - flat).toBeCloseTo(10, 6);
    await openSchedule(page);
    const totalRow = page.locator('#ductScheduleBody table').first().locator('.duct-schedule-total-row');
    await expect(totalRow).toContainText(Math.round(withV).toLocaleString() + "'");

    expect(errors).toEqual([]);
  });

  test('auto deck riser: staged at vertex 0 on an equipment-started system run; ceiling-aware; removable', async ({ page }) => {
    // A system group with an equipment marker at pdf (200, 300).
    await page.evaluate(() => {
      const s = window.state;
      s.groups.push({ id: 'g1', name: 'RTU-1', color: '#e05d5d', equipmentTag: 'RTU-1', capacityCfm: 600 });
      s.groupsEnabled = true;
      s.activeGroupId = 'g1';
      s.counters.push({ id: 'rtu-counter', name: 'RTU-1', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' });
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.counterMarkers['rtu-counter'] = [{ x: 200, y: 300, group: 'g1' }];
      window.App.updateUI();
    });
    // Deck height through the real Polish-row input on the schedule modal.
    await openSchedule(page);
    await page.locator('#ductDeckHeight').fill('12');
    await page.locator('#ductDeckHeight').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.ductSettings.deckHeightFt)).toBe(12);
    await page.locator('#ductScheduleClose').click();

    // First vertex ON the equipment marker → the full-deck riser stages.
    await armDuct(page);
    await page.evaluate(() => window.App.commitDuctClick({ x: 200, y: 300 }));
    expect(await page.evaluate(() => window.state.drawingDuct.verticalFt)).toEqual([{ vertexIdx: 0, ft: 12, auto: true }]);

    // Removable via the popover at vertex 0 — labeled as the auto riser.
    await page.keyboard.press('s');
    const section = page.locator('#ductSizeSections [data-section-id="rise-drop"]');
    await expect(section.locator('.duct-vertical-row')).toHaveText(/12' vertical · auto riser/);
    await section.locator('.duct-vertical-remove').click();
    expect(await page.evaluate(() => window.state.drawingDuct.verticalFt)).toEqual([]);
    await page.keyboard.press('Escape');   // close the popover
    await page.keyboard.press('Escape');   // pop the vertex
    await page.keyboard.press('Escape');   // clear the draft

    // A known room ceiling under the marker → riser = deck − ceiling.
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      (ann.roomBoxes = ann.roomBoxes || []).push({ x1: 100, y1: 200, x2: 300, y2: 400, heightFt: 9, roomId: null, id: 'box-1' });
    });
    await armDuct(page);
    await page.evaluate(() => window.App.commitDuctClick({ x: 200, y: 300 }));
    expect(await page.evaluate(() => window.state.drawingDuct.verticalFt)).toEqual([{ vertexIdx: 0, ft: 3, auto: true }]);

    // A run started AWAY from the marker stages nothing.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await armDuct(page);
    await page.evaluate(() => window.App.commitDuctClick({ x: 600, y: 700 }));
    expect(await page.evaluate(() => window.state.drawingDuct.verticalFt)).toEqual([]);

    expect(errors).toEqual([]);
  });

  test('flex drops: per-system schedule line, default 8\', over-max warning tracks the editable cap', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.state;
      s.groups.push({ id: 'g1', name: 'RTU-1', color: '#e05d5d', equipmentTag: 'RTU-1', capacityCfm: 600 });
      s.groupsEnabled = true;
      // Two CFM counter types: default flex (8') and an explicit 9' drop.
      const icon = window.App.getOrderedIcons()[0].value;
      s.counters.push({ id: 'c-def', name: 'Diffuser A', icon, color: '#e8c547', cfm: 150 });
      s.counters.push({ id: 'c-nine', name: 'Diffuser B', icon, color: '#4a9eff', cfm: 200, flexDropFt: 9 });
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      // A committed 24×12 system run; both devices within tap-snap of it.
      ann.ductRuns = [window.makeDuctRun({
        id: 'run-1', name: 'Trunk', airside: 'supply', pressureClass: '1', systemGroupId: 'g1',
        vertices: [{ x: 100, y: 100 }, { x: 500, y: 100 }],
        segments: [{ startVertexIdx: 0, size: { kind: 'rect', w: 24, h: 12 } }],
      })];
      ann.counterMarkers['c-def'] = [{ x: 200, y: 105 }];
      ann.counterMarkers['c-nine'] = [{ x: 400, y: 108 }];
      window.App.reinferDuctFittings(0);
      window.App.updateUI();
    });
    await openSchedule(page);

    const body = page.locator('#ductScheduleBody');
    await expect(body).toContainText('Flex duct');
    const flexRow = body.locator('table').nth(2).locator('tr').nth(1);
    await expect(flexRow).toContainText('RTU-1');
    await expect(flexRow).toContainText('2');
    await expect(flexRow).toContainText("17'");
    // Both drops (the 8' default AND the 9') are past the default 6' cap.
    await expect(flexRow.locator('.duct-flex-warn')).toHaveText("⚠ 2 drops over 6' max");

    // The copy text carries the same line (LF only, flagged).
    const copyText = await page.evaluate(() => window.App.buildDuctScheduleText(window.App.computeDuctSchedule({})));
    expect(copyText).toContain('Flex duct (by the drop — not in bid weight)');
    expect(copyText).toContain("RTU-1\t2 drops\t17'\t⚠ 2 drops over 6' max");

    // The cap on the Polish row re-renders live: 8.5' flags only the 9' drop…
    await page.locator('#ductMaxFlex').fill('8.5');
    await page.locator('#ductMaxFlex').dispatchEvent('change');
    await expect(flexRow.locator('.duct-flex-warn')).toHaveText("⚠ 1 drop over 8.5' max");
    // …and 10' clears the warning.
    await page.locator('#ductMaxFlex').fill('10');
    await page.locator('#ductMaxFlex').dispatchEvent('change');
    expect(await page.evaluate(() => window.state.ductSettings.maxFlexFt)).toBe(10);
    await expect(body.locator('.duct-flex-warn')).toHaveCount(0);

    // Flex never moves the bid weight: pounds come from the straight rows only.
    const { straightTotalLb, fittingsCountedLb, bidWeightLb } = await page.evaluate(() => window.App.computeDuctSchedule({}));
    expect(fittingsCountedLb).toBe(0);
    expect(bidWeightLb).toBeCloseTo(straightTotalLb * 1.15, 6);
    await expect(body.locator('.duct-schedule-bid-row')).toContainText(Math.round(bidWeightLb).toLocaleString());

    expect(errors).toEqual([]);
  });

  test('VD-per-tap: schedule row, the Polish-row toggle, and the per-tap Remove/Add that survives re-inference', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    // Parent L + child branch tapping it (the duct-fittings.spec recipe).
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 150 } });
    await wrapper.click({ position: { x: 300, y: 300 } });
    await page.keyboard.press('Enter');
    await armDuct(page, 10, 8);
    await wrapper.click({ position: { x: 225, y: 150 } });
    await wrapper.click({ position: { x: 225, y: 280 } });
    await page.keyboard.press('Enter');

    await openSchedule(page);
    const body = page.locator('#ductScheduleBody');
    await expect(body).toContainText('Volume damper');

    // The toggle removes the derived rows live (and persists on ductSettings).
    await page.locator('#ductVdPerTapBtn').click();
    expect(await page.evaluate(() => window.state.ductSettings.countVdPerTap)).toBe(false);
    await expect(page.locator('#ductVdPerTapBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(body).not.toContainText('Volume damper');
    await page.locator('#ductVdPerTapBtn').click();
    await expect(body).toContainText('Volume damper');
    await page.locator('#ductScheduleClose').click();

    // Right-click the tap marker → Remove volume damper (noVd + auto:false).
    await wrapper.click({ position: { x: 225, y: 150 }, button: 'right' });
    const menu = page.locator('#ductFittingMenu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Remove volume damper' }).click();
    await expect(menu).toBeHidden();
    let tap = await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductFittings.find((f) => f.type === 'tap'));
    expect(tap.noVd).toBe(true);
    expect(tap.auto).toBe(false);

    // Re-inference cannot shake the flag loose (the preservation pattern).
    await page.evaluate(() => window.App.reinferDuctFittings());
    tap = await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductFittings.find((f) => f.type === 'tap'));
    expect(tap.noVd).toBe(true);
    await openSchedule(page);
    await expect(body).not.toContainText('Volume damper');
    await page.locator('#ductScheduleClose').click();

    // And the inverse action restores the damper.
    await wrapper.click({ position: { x: 225, y: 150 }, button: 'right' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Add volume damper' }).click();
    tap = await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.ductFittings.find((f) => f.type === 'tap'));
    expect(tap.noVd).toBeUndefined();
    await openSchedule(page);
    await expect(body).toContainText('Volume damper');

    expect(errors).toEqual([]);
  });

  test('round-first dual suggestion: two chips, tapping either applies that size', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    // One 300-CFM device ahead of the trace.
    await page.evaluate(() => {
      const s = window.state;
      s.counters.push({ id: 'c-dev', name: 'Diffuser', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547', cfm: 300 });
      const ann = window.App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.counterMarkers['c-dev'] = [{ x: 700, y: 600 }];
      window.App.updateUI();
    });
    await armDuct(page);
    await wrapper.click({ position: { x: 150, y: 300 } });

    const sug = await page.evaluate(() => window.App.getDuctDraftSuggestion());
    expect(sug.roundSize.kind).toBe('round');
    expect(sug.rectSize.kind).toBe('rect');
    expect(sug.sizeLabel).toBe(
      await page.evaluate(() => window.formatDuctSize(window.App.getDuctDraftSuggestion().roundSize)
        + ' or ' + window.formatDuctSize(window.App.getDuctDraftSuggestion().rectSize)));
    expect(sug.chipText).toContain(sug.sizeLabel);

    // Rect chip applies the rect size (still at vertex 0 → the armed size is
    // replaced through the normal applyDuctSizeStep path).
    await page.keyboard.press('s');
    const chips = page.locator('#ductSizeSections .duct-suggest-chip');
    await expect(chips).toHaveCount(2);
    await chips.nth(1).click();
    await expect(page.locator('#ductSizePopover')).toBeHidden();
    expect(await page.evaluate(() => window.state.drawingDuct.segments[0].size)).toEqual(sug.rectSize);

    // Round chip applies the round size.
    await page.keyboard.press('s');
    await chips.first().click();
    expect(await page.evaluate(() => window.state.drawingDuct.segments[0].size)).toEqual(sug.roundSize);

    expect(errors).toEqual([]);
  });

  test('neck-size prefill: sidebar-row title + details-modal line, only when the name has no explicit size', async ({ page }) => {
    await page.evaluate(() => {
      const s = window.state;
      const icon = window.App.getOrderedIcons()[0].value;
      s.counters.push({ id: 'c-plain', name: 'Diffuser', icon, color: '#e8c547', cfm: 150 });
      s.counters.push({ id: 'c-sized', name: '8"Ø Diffuser', icon, color: '#4a9eff', cfm: 150 });
      s.counters.push({ id: 'c-nocfm', name: 'Hose Bib', icon, color: '#47c88e' });
      window.App.updateUI();
    });

    // Sidebar: only the un-sized CFM counter carries the neck title.
    const rows = page.locator('#countersList .sidebar-item');
    await expect(rows.filter({ hasText: 'Diffuser' }).first().locator('.name'))
      .toHaveAttribute('title', '150 CFM → 8"Ø neck');
    expect(await rows.filter({ hasText: '8"Ø Diffuser' }).locator('.name').getAttribute('title')).toBeNull();
    expect(await rows.filter({ hasText: 'Hose Bib' }).locator('.name').getAttribute('title')).toBeNull();

    // Details modal: the neck line under the CFM field, plus the flex-drop
    // field with the CFM field's optional-field semantics.
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters.find((c) => c.id === 'c-plain')));
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    await expect(page.locator('#counterLineTypeDetailsNeck')).toBeVisible();
    await expect(page.locator('#counterLineTypeDetailsNeck')).toHaveText('150 CFM → 8"Ø neck');
    await page.locator('#counterLineTypeDetailsFlexDrop').fill('9');
    await page.locator('#counterLineTypeDetailsFlexDrop').dispatchEvent('blur');
    expect(await page.evaluate(() => window.state.counters.find((c) => c.id === 'c-plain').flexDropFt)).toBe(9);
    await page.locator('#counterLineTypeDetailsFlexDrop').fill('');
    await page.locator('#counterLineTypeDetailsFlexDrop').dispatchEvent('blur');
    expect(await page.evaluate(() => 'flexDropFt' in window.state.counters.find((c) => c.id === 'c-plain'))).toBe(false);
    // A CFM edit re-syncs the neck line (150 → 400 crosses a table row).
    await page.locator('#counterLineTypeDetailsCfm').fill('400');
    await page.locator('#counterLineTypeDetailsCfm').dispatchEvent('blur');
    await expect(page.locator('#counterLineTypeDetailsNeck')).toHaveText('400 CFM → 12"Ø neck');
    await page.locator('#counterLineTypeDetailsClose').click();

    // The sized name shows no neck line in the details modal either.
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters.find((c) => c.id === 'c-sized')));
    await expect(page.locator('#counterLineTypeDetailsNeck')).toBeHidden();

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: design-build layer 2 — room CFM defaults + air balance (DUCT-PLAN.md
 * unit D7).
 *
 * - Rooms gain an optional roomType on the Edit Room dialog (options from
 *   duct-model's editable ROOM_TYPE_CFM_PER_SQFT table) and a derived
 *   targetCfm = area × rate, with a per-room CFM override that wins.
 * - Rooms sidebar rows carry the §3 balance badge ("needs 450 · served 300 ⚠"):
 *   served = CFM devices whose markers lie inside the room's boxes; the ⚠
 *   fires only when under-served beyond the ~10% tolerance and clears when a
 *   CFM device lands inside. Typeless rooms show no badge (zero behavior
 *   change).
 * - System group headers with a capacityCfm carry the capacity line
 *   ("600 designed / 600 capacity ✓" — ⚠ when the attached device CFM
 *   exceeds the unit), designed via D6's accumulation; the group's
 *   equipment-tag marker resolves to equipmentPos (the D6 follow-up).
 * - The Duct create modal shows the equipment-first quiet line when rooms
 *   have targets but no system group has a capacity yet — and hides it as
 *   soon as one does.
 * - roomType + targetCfmOverride ride the existing rooms serialization
 *   (export → import round trip).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Duct air balance (D7)', () => {
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
    // 10 pt per ft — a 120×90 pt box is 12 ft × 9 ft = 108 ft².
    await page.evaluate(() => {
      const s = window.state;
      s.pages[s.currentPage].scale = { pixelsPerUnit: 10, unit: 'ft' };
    });
  });

  // Create a counter through the real Create tab, with the D6 CFM input
  // (duct-suggest.spec idiom).
  async function createCfmCounter(page, name, cfm) {
    await page.locator('#counterBtn').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    const createPanelHidden = await page.locator('#counterCreatePanel').isHidden();
    if (createPanelHidden) await page.locator('#counterModal .counter-tab[data-tab="create"]').click();
    await page.locator('#counterName').fill(name);
    if (cfm != null) await page.locator('#counterCfm').fill(String(cfm));
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    return page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
  }

  // The last-placed marker's PDF position for a counter id.
  const lastMarkerPos = (page, counterId) => page.evaluate((id) => {
    const arr = window.App.getMergedAnnotationsForPage(window.state.pages[0]).counterMarkers[id] || [];
    const m = arr[arr.length - 1];
    return m ? { x: m.x, y: m.y } : null;
  }, counterId);

  // Draw a room box AROUND a PDF-space center through the real modal path
  // (marker-first so point-in-rect is exercised on true positions).
  async function addRoomBoxAround(page, center, halfW, halfH, roomName) {
    await page.evaluate(({ c, hw, hh }) => {
      window.App.openRoomBoxModal({ x1: c.x - hw, y1: c.y - hh, x2: c.x + hw, y2: c.y + hh });
    }, { c: center, hw: halfW, hh: halfH });
    await expect(page.locator('#roomBoxModal')).toHaveClass(/visible/);
    await page.locator('#roomBoxHeight').fill('9');
    await page.locator('#roomBoxNewRoomBtn').click();
    await page.locator('#roomBoxNewRoomName').fill(roomName);
    await page.evaluate(() => { document.getElementById('roomBoxApply').click(); });
    await expect(page.locator('#roomBoxModal')).not.toHaveClass(/visible/);
  }

  test('room type on the edit dialog → needs/served badge; ⚠ under-served, clears when a device lands inside', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');

    // A 50-CFM diffuser, then a 120×90 pt (12×9 ft = 108 ft²) room box
    // centered on it — the marker is inside by construction.
    const c1 = await createCfmCounter(page, 'Diffuser 50', 50);
    await wrapper.click({ position: { x: 200, y: 300 } });
    const m1 = await lastMarkerPos(page, c1.id);
    expect(m1).not.toBeNull();
    await addRoomBoxAround(page, m1, 60, 45, 'Office 101');

    // No type yet: the Rooms row shows NO balance badge (zero behavior change).
    await expect(page.locator('#roomsList .room-row')).toHaveCount(1);
    await expect(page.locator('#roomsList .room-balance-row')).toHaveCount(0);

    // Edit Room dialog: the type dropdown carries the data table's options;
    // picking Office reveals the Target CFM override with the derived
    // area × rate as its placeholder (108 ft² × 1.0 = 108).
    await page.locator('#roomsList .room-row').click();
    await expect(page.locator('#roomEditModal')).toHaveClass(/visible/);
    const optionLabels = await page.locator('#roomEditType option').allTextContents();
    expect(optionLabels[0]).toBe('None');
    expect(optionLabels.join('|')).toContain('Office — 1 CFM/ft²');
    expect(optionLabels.join('|')).toContain('Storage — 0.5 CFM/ft²');
    expect(optionLabels.join('|')).toContain('Custom');
    await expect(page.locator('#roomEditTargetGroup')).toBeHidden();
    await page.selectOption('#roomEditType', 'office');
    await expect(page.locator('#roomEditTargetGroup')).toBeVisible();
    expect(await page.locator('#roomEditTargetCfm').getAttribute('placeholder')).toContain('108');
    await page.locator('#roomEditSave').click();

    // Room object carries the type (no override field), and the badge shows
    // under-served: needs 108, served 50 — beyond the 10% tolerance → ⚠.
    expect(await page.evaluate(() => ({ ...window.state.rooms[0] }))).toEqual(
      expect.objectContaining({ name: 'Office 101', roomType: 'office' }));
    expect(await page.evaluate(() => 'targetCfmOverride' in window.state.rooms[0])).toBe(false);
    const badge = page.locator('#roomsList .room-balance-row');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText('needs 108 · served 50 ⚠');
    await expect(badge).toHaveClass(/under/);

    // A second CFM device inside the box clears the ⚠ (served 150 ≥ 108).
    await createCfmCounter(page, 'Diffuser 100', 100);
    await wrapper.click({ position: { x: 200, y: 300 } });
    await expect(badge).toHaveText('needs 108 · served 150');
    await expect(badge).not.toHaveClass(/under/);

    // The per-room override wins over the derived rate: 500 → under again.
    await page.locator('#roomsList .room-row').click();
    await page.locator('#roomEditTargetCfm').fill('500');
    await page.locator('#roomEditSave').click();
    expect(await page.evaluate(() => window.state.rooms[0].targetCfmOverride)).toBe(500);
    await expect(badge).toHaveText('needs 500 · served 150 ⚠');
    await expect(badge).toHaveClass(/under/);

    // Back to None deletes both fields — the room's old shape, byte-identical.
    await page.locator('#roomsList .room-row').click();
    await page.selectOption('#roomEditType', '');
    await page.locator('#roomEditSave').click();
    expect(await page.evaluate(() => Object.keys(window.state.rooms[0]).sort())).toEqual(['color', 'id', 'name']);
    await expect(page.locator('#roomsList .room-balance-row')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('system group capacity line: designed vs capacity ✓/⚠, equipment marker → equipmentPos', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');

    // A system group through the real modal: tag RTU-1, capacity 600. (The
    // Groups section is opt-in per project — the groups-per-project idiom.)
    await page.evaluate(() => { window.state.groupsEnabled = true; window.App.updateUI(); });
    await page.locator('#groupsSectionTitle').click();   // expand the collapsed-by-default section
    await page.locator('#addGroup').click();
    await expect(page.locator('#groupModal')).toHaveClass(/visible/);
    await page.locator('#groupModalName').fill('RTU-1 system');
    await page.locator('#groupModalEquipTag').fill('RTU-1');
    await page.locator('#groupModalCapacityCfm').fill('600');
    await page.locator('#groupModalDone').click();
    const gid = await page.evaluate(() => window.state.groups[0].id);

    // No duct yet: the capacity line reads 0 designed, ✓.
    const capLine = page.locator('#groupsList .group-capacity-line');
    await expect(capLine).toHaveText('0 designed / 600 capacity ✓');
    await expect(capLine).not.toHaveClass(/over/);

    // An equipment counter NAMED like the tag: its marker resolves as the
    // system's equipmentPos (the documented matching ladder, rule 2 — a
    // unique tag-named marker).
    const rtu = await createCfmCounter(page, 'RTU-1', null);
    await wrapper.click({ position: { x: 120, y: 300 } });
    const rtuPos = await lastMarkerPos(page, rtu.id);
    const equipPos = await page.evaluate((id) => window.App.getDuctSystemEquipmentPos(id, 0), gid);
    expect(equipPos).not.toBeNull();
    expect(Math.abs(equipPos.x - rtuPos.x)).toBeLessThan(1e-6);
    expect(Math.abs(equipPos.y - rtuPos.y)).toBeLessThan(1e-6);

    // Two 400-CFM diffusers on the future main's path.
    const dif = await createCfmCounter(page, 'Diffuser 400', 400);
    await wrapper.click({ position: { x: 220, y: 300 } });
    await wrapper.click({ position: { x: 320, y: 300 } });
    expect(await page.evaluate((id) => window.App.getMergedAnnotationsForPage(window.state.pages[0]).counterMarkers[id].length, dif.id)).toBe(2);

    // Trace the main through both devices (the group is active, so the run
    // inherits the system) and commit.
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => !!window.state.drawingDuct);
    expect(await page.evaluate(() => window.state.drawingDuct.systemGroupId)).toBe(gid);
    await wrapper.click({ position: { x: 120, y: 300 } });
    await wrapper.click({ position: { x: 380, y: 300 } });
    await page.evaluate(() => window.App.finishDuctRun());

    // designed 800 > capacity 600 → ⚠ (accent class on).
    await expect(capLine).toHaveText('800 designed / 600 capacity ⚠');
    await expect(capLine).toHaveClass(/over/);
    expect(await page.evaluate((id) => window.App.getDuctSystemDesignedCfm(id), gid)).toBe(800);

    // Raising the unit's capacity flips it back to ✓.
    await page.locator('#groupsList .edit-btn').click();
    await page.locator('#groupModalCapacityCfm').fill('900');
    await page.locator('#groupModalDone').click();
    await expect(capLine).toHaveText('800 designed / 900 capacity ✓');
    await expect(capLine).not.toHaveClass(/over/);

    expect(errors).toEqual([]);
  });

  test('equipment-first line on the create modal; roomType + override ride export → import', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');

    // A 500-CFM device, a 200×150 pt (20×15 ft = 300 ft²) conference room
    // around it, and an override of 2,400 (the worked equipment-first line).
    const c1 = await createCfmCounter(page, 'Diffuser 500', 500);
    await wrapper.click({ position: { x: 250, y: 300 } });
    const m1 = await lastMarkerPos(page, c1.id);
    await addRoomBoxAround(page, m1, 100, 75, 'Suite 200');
    await page.locator('#roomsList .room-row').click();
    await page.selectOption('#roomEditType', 'conference');
    await page.locator('#roomEditTargetCfm').fill('2400');
    await page.locator('#roomEditSave').click();
    await expect(page.locator('#roomsList .room-balance-row')).toHaveText('needs 2,400 · served 500 ⚠');

    // No system group has a capacity → the quiet line shows the rule of
    // thumb: 2,400 CFM → about 2 systems at 1,200.
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    const equipLine = page.locator('#ductCreateEquipFirst');
    await expect(equipLine).toBeVisible();
    await expect(equipLine).toHaveText('Rooms total ~2,400 CFM — about 2 systems at 1,200 CFM (edit in Groups)');
    await page.locator('#ductCreateCancel').click();

    // Round trip: the REAL export payload carries the new room fields…
    const exported = await page.evaluate(() => {
      let captured = null;
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { captured = this.href; };
      try { document.getElementById('exportBtn').click(); }
      finally { HTMLAnchorElement.prototype.click = orig; }
      return captured ? decodeURIComponent(captured.replace('data:application/json,', '')) : null;
    });
    expect(exported).not.toBeNull();
    const data = JSON.parse(exported);
    expect(data.rooms[0].roomType).toBe('conference');
    expect(data.rooms[0].targetCfmOverride).toBe(2400);

    // …and a fresh app restores them through the real import path. Whether
    // the work above landed a promptable 'local' backup before the reload
    // depends on the 5 s backup interval, so settle the async boot and clear
    // a "Project from Last Session" offer if it came — on a slow runner it
    // arrived mid-test and intercepted the #groupsSectionTitle click below
    // (CI, 2026-09-10).
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => window.App.bootSettled === true);
    if (await page.evaluate(() => document.getElementById('lastSessionRestoreModal').classList.contains('visible'))) {
      await page.locator('#lastSessionRestoreDiscard').click();
      await expect(page.locator('#lastSessionRestoreModal')).not.toHaveClass(/visible/);
    }
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.locator('#importInput').setInputFiles({ name: 'takeoff.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
    await page.waitForFunction(() => (window.state.rooms || [])[0]?.roomType === 'conference');
    expect(await page.evaluate(() => window.state.rooms[0].targetCfmOverride)).toBe(2400);
    await expect(page.locator('#roomsList .room-balance-row')).toHaveText('needs 2,400 · served 500 ⚠');

    // Once ANY system group carries a capacity, the equipment-first line goes
    // quiet (the systems are real now — the capacity line takes over).
    await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' }; });
    await page.evaluate(() => { window.state.groupsEnabled = true; window.App.updateUI(); });
    await page.locator('#groupsSectionTitle').click();   // expand the collapsed-by-default section
    await page.locator('#addGroup').click();
    await page.locator('#groupModalName').fill('RTU-1 system');
    await page.locator('#groupModalEquipTag').fill('RTU-1');
    await page.locator('#groupModalCapacityCfm').fill('1200');
    await page.locator('#groupModalDone').click();
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await expect(page.locator('#ductCreateEquipFirst')).toBeHidden();
    await page.locator('#ductCreateCancel').click();

    expect(errors).toEqual([]);
  });
});

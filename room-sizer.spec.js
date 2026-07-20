// @ts-check
/**
 * features/room-sizer.js (the Room Sizer feature): draw room boxes, assign a
 * ceiling height + Room, and get per-room volumetric totals.
 *
 * Pins: the registry contract (openRoomBoxModal / openRoomBoxModalForEdit /
 * renderRoomsList / getRoomVolumeTotals + the app.js publishes it consumes),
 * the create path (pending rect + height + new room -> a roomBoxes entry, a
 * palette room, recent-height persistence, tool stays TOOL.ROOM), the totals
 * math against a known scale, the sidebar section appearing once a box
 * exists, the edit path (height/room rewrite), the room-delete cascade, and
 * the export/import roundtrip carrying rooms + roomBoxes.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Room Sizer (features/room-sizer.js)', () => {
  test('registry contract, create/edit/delete, totals, sidebar, roundtrip', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // --- Registry contract ---
    const contract = await page.evaluate(() => ({
      openRoomBoxModal: typeof window.App.openRoomBoxModal,
      openRoomBoxModalForEdit: typeof window.App.openRoomBoxModalForEdit,
      renderRoomsList: typeof window.App.renderRoomsList,
      getRoomVolumeTotals: typeof window.App.getRoomVolumeTotals,
      roomBoxDimsFeet: typeof window.App.roomBoxDimsFeet,
      getEffectiveScaleForLine: typeof window.App.getEffectiveScaleForLine,
      toolRoom: window.App.TOOL.ROOM,
    }));
    expect(contract.openRoomBoxModal).toBe('function');
    expect(contract.openRoomBoxModalForEdit).toBe('function');
    expect(contract.renderRoomsList).toBe('function');
    expect(contract.getRoomVolumeTotals).toBe('function');
    expect(contract.roomBoxDimsFeet).toBe('function');
    expect(contract.getEffectiveScaleForLine).toBe('function');
    expect(contract.toolRoom).toBe(12);

    // --- Header button gates on scale, then arms the tool ---
    await page.evaluate(() => { document.getElementById('roomBtn').click(); });
    await expect(page.locator('#setScaleFirstModal')).toHaveClass(/visible/);
    await page.evaluate(() => { window.App.hideModal('setScaleFirstModal'); });
    // 10 pt per ft: a 120x90 pt box is 12ft x 9ft.
    await page.evaluate(() => { window.state.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' }; });
    await page.evaluate(() => { document.getElementById('roomBtn').click(); });
    expect(await page.evaluate(() => window.state.tool)).toBe(12);
    await expect(page.locator('#roomBtn')).toHaveClass(/active/);

    // --- Create path: pending rect + height + new room ---
    await page.evaluate(() => {
      window.App.openRoomBoxModal({ x1: 0, y1: 0, x2: 120, y2: 90 });
    });
    await expect(page.locator('#roomBoxModal')).toHaveClass(/visible/);
    // Live dims table reflects the scale before any height is entered:
    // Length | Width | Height | Totals, with a Floor Area row that needs no height.
    const previewTable = page.locator('#roomBoxDimsPreview .room-dims-table');
    await expect(previewTable).toBeVisible();
    await expect(previewTable).toContainText('Length');
    await expect(previewTable).toContainText('12\'-0"');
    await expect(previewTable).toContainText('9\'-0"');
    await expect(previewTable).toContainText('108 ft² Floor Area');
    await page.locator('#roomBoxHeight').fill('8');
    // Typing the height fills in the Volume row live.
    await expect(previewTable).toContainText('864 ft³ Air Volume');
    // No rooms yet: the picker list is hidden and new-room mode is active.
    await expect(page.locator('#roomBoxRoomList')).toBeHidden();
    await expect(page.locator('#roomBoxNewRoomNameGroup')).toBeVisible();
    await page.locator('#roomBoxNewRoomName').fill('Office 101');
    await page.evaluate(() => { document.getElementById('roomBoxApply').click(); });
    await page.waitForFunction(() => (window.App.getActiveAnnotations(window.state.pages[0]).roomBoxes || []).length === 1);

    const created = await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      return {
        box: ann.roomBoxes[0],
        rooms: window.state.rooms,
        tool: window.state.tool,
        recents: window.state.recentRoomHeights,
        stored: localStorage.getItem('recentRoomHeights'),
      };
    });
    expect(created.box.heightFt).toBe(8);
    expect(created.rooms.length).toBe(1);
    expect(created.rooms[0].name).toBe('Office 101');
    expect(created.box.roomId).toBe(created.rooms[0].id);
    expect(created.tool).toBe(12);                       // tool stays armed for the next box
    expect(created.recents).toEqual([8]);
    expect(JSON.parse(created.stored || '[]')).toEqual([8]);

    // --- Totals: 12ft x 9ft x 8ft = 864 ft³ / 108 ft² ---
    const totals = await page.evaluate(() => window.App.getRoomVolumeTotals());
    expect(totals.length).toBe(1);
    expect(totals[0].name).toBe('Office 101');
    expect(totals[0].areaSqFt).toBeCloseTo(108, 6);
    expect(totals[0].volumeCuFt).toBeCloseTo(864, 6);

    // --- Sidebar section appears with the room's totals ---
    await page.evaluate(() => window.App.updateUI());
    await expect(page.locator('#roomsSection')).toBeVisible();
    await expect(page.locator('#roomsList')).toContainText('Office 101');
    await expect(page.locator('#roomsList')).toContainText('864 ft³');

    // --- Second box on the same room via sticky defaults ---
    await page.evaluate(() => { window.App.openRoomBoxModal({ x1: 200, y1: 0, x2: 260, y2: 60 }); });
    const sticky = await page.evaluate(() => ({
      height: document.getElementById('roomBoxHeight').value,
      room: document.querySelector('#roomBoxRoomList .room-picker-item.selected')?.dataset.roomId,
      listVisible: document.getElementById('roomBoxRoomList').style.display !== 'none',
      nameHidden: document.getElementById('roomBoxNewRoomNameGroup').style.display === 'none',
    }));
    expect(sticky.height).toBe('8');
    expect(sticky.room).toBe((await page.evaluate(() => window.state.rooms[0].id)));
    expect(sticky.listVisible).toBe(true);   // scrollable single-select list
    // Header row: Room | + New room (middle) | Area | Volume column caption (right).
    await expect(page.locator('.room-picker-header .room-picker-cols')).toHaveText('Area | Volume');
    expect(sticky.nameHidden).toBe(true);    // name input only in new-room mode
    // The row shows the room's floor area + volume so far on its right edge.
    await expect(page.locator('#roomBoxRoomList .room-picker-item .room-picker-vol')).toHaveText('108 ft² | 864 ft³');
    // "+ New room" flips to new-room mode and deselects the list.
    await page.evaluate(() => document.getElementById('roomBoxNewRoomBtn').click());
    await expect(page.locator('#roomBoxNewRoomNameGroup')).toBeVisible();
    expect(await page.evaluate(() => document.querySelectorAll('#roomBoxRoomList .room-picker-item.selected').length)).toBe(0);
    // Clicking the room row selects it again (single selection) and hides the name input.
    await page.evaluate(() => { document.querySelector('#roomBoxRoomList .room-picker-item').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(await page.evaluate(() => document.querySelectorAll('#roomBoxRoomList .room-picker-item.selected').length)).toBe(1);
    await expect(page.locator('#roomBoxNewRoomNameGroup')).toBeHidden();
    await page.evaluate(() => { document.getElementById('roomBoxApply').click(); });
    await page.waitForFunction(() => (window.App.getActiveAnnotations(window.state.pages[0]).roomBoxes || []).length === 2);
    const twoBoxTotals = await page.evaluate(() => window.App.getRoomVolumeTotals());
    expect(twoBoxTotals.length).toBe(1);                 // same room aggregates
    expect(twoBoxTotals[0].volumeCuFt).toBeCloseTo(864 + 6 * 6 * 8, 6);

    // --- Edit path rewrites height ---
    await page.evaluate(() => { window.App.openRoomBoxModalForEdit(0); });
    await expect(page.locator('#roomBoxDelete')).toBeVisible();
    await page.locator('#roomBoxHeight').fill("9'6");
    await page.evaluate(() => { document.getElementById('roomBoxApply').click(); });
    await page.waitForFunction(() => window.App.getActiveAnnotations(window.state.pages[0]).roomBoxes[0].heightFt === 9.5);

    // --- Undo restores the pre-edit height (rooms ride the undo snapshots) ---
    await page.evaluate(() => document.getElementById('undoBtn').click());
    await page.waitForFunction(() => window.App.getActiveAnnotations(window.state.pages[0]).roomBoxes[0].heightFt === 8);

    // --- Export JSON carries rooms + roomBoxes; import restores them ---
    const exported = await page.evaluate(() => {
      const s = window.state;
      return {
        rooms: s.rooms.length,
        boxes: window.App.getActiveAnnotations(s.pages[0]).roomBoxes.length,
      };
    });
    expect(exported.rooms).toBe(1);
    expect(exported.boxes).toBe(2);

    // --- Room delete cascades to its boxes ---
    await page.evaluate(() => {
      window.App.renderRoomsList();
      const row = document.querySelector('#roomsList .room-row');
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect(page.locator('#roomEditModal')).toHaveClass(/visible/);
    await page.evaluate(() => document.getElementById('roomEditDelete').click());
    await expect(page.locator('#roomDeleteConfirmModal')).toHaveClass(/visible/);
    await expect(page.locator('#roomDeleteConfirmText')).toContainText('2 box(es)');
    await page.evaluate(() => document.getElementById('roomDeleteConfirm').click());
    await page.waitForFunction(() =>
      window.state.rooms.length === 0
      && (window.App.getActiveAnnotations(window.state.pages[0]).roomBoxes || []).length === 0);
    // Sidebar section disappears again when the last box is gone.
    await page.evaluate(() => window.App.updateUI());
    await expect(page.locator('#roomsSection')).toBeHidden();

    expect(errors).toEqual([]);
  });
});

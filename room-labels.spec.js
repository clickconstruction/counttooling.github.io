// @ts-check
/**
 * Tests: DUCT unit D24 — X4 option D, room names from the plan
 * (journeys/plans/_TODO.md D24; _STAGE6.md X4).
 *
 * When a Room box is drawn, the printed text inside it is read through the
 * D10 text-layer primitive; a room-name-shaped string prefills the Room Size
 * dialog's name with a "from the plan" note. A room created that way is
 * labelled the option-D way: ONE small totals tag on its largest box, placed
 * where the printed text isn't; the plan's own room names stay legible. A
 * page with no text layer keeps per-box name-only labels (option B), silently.
 */
const { test, expect } = require('@playwright/test');

// A one-page plan with two rooms' names printed inside their outlines, a note
// inside one of them, and a title block — pdf-lib in the page, like D10's spec.
async function bootWithPlan(page, errors, withText = true) {
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  const bytes = await page.evaluate(async (withText) => {
    const { PDFDocument, StandardFonts } = window.PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p = doc.addPage([612, 792]);
    p.drawRectangle({ x: 60, y: 460, width: 240, height: 200, borderWidth: 1 });   // room A outline
    p.drawRectangle({ x: 340, y: 460, width: 200, height: 200, borderWidth: 1 });  // room B outline
    if (withText) {
      const t = (s, x, y, size = 12) => p.drawText(s, { x, y, size, font });
      t('OPEN OFFICE 204', 120, 560, 14);     // room A's name, centered-ish
      t('SEE NOTE 3', 90, 480, 8);            // a note inside room A — never a name
      t('MECH', 400, 560, 14);                // room B's name
      t('MECHANICAL PLAN', 60, 740, 12);      // title block, outside both
      t('24x12', 400, 500, 10);               // a duct callout inside room B
    }
    return Array.from(await doc.save());
  }, withText);
  await page.locator('#pdfInput').setInputFiles({ name: 'rooms.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1 ft' };
    s.trade = 'hvac';
    s.zoom = 1; s.pan = { x: 0, y: 0 };
    window.App.updateUI();
  });
  // The text layer is lazy: prime it and wait, so the tests are about the
  // behavior, not the fetch (the late-arrival case is tested on its own).
  if (withText) {
    await page.evaluate(() => { window.App.pageTextItems(0); });
    await page.waitForFunction(() => window.App.pageTextItems(0).length > 0);
  }
}

// PDF-space (top-left origin) boxes matching the drawn outlines on a 792-tall page.
const ROOM_A = { x1: 60, y1: 132, x2: 300, y2: 332 };
const ROOM_B = { x1: 340, y1: 132, x2: 540, y2: 332 };

const openBox = (page, rect) => page.evaluate((r) => window.App.openRoomBoxModal(r), rect);

test.describe('D24 — room names from the plan (X4 option D)', () => {
  /** @type {string[]} */
  let errors;
  test.afterEach(() => { expect(errors).toEqual([]); });

  test('drawing a box prefills the room name from the plan, with a note; a note string is never a name', async ({ page }) => {
    errors = []; await bootWithPlan(page, errors);
    await openBox(page, ROOM_A);
    await expect(page.locator('#roomBoxNewRoomNameGroup')).toBeVisible();
    await expect(page.locator('#roomBoxNewRoomName')).toHaveValue('OPEN OFFICE 204');   // not "SEE NOTE 3"
    await expect(page.locator('#roomBoxNameNote')).toBeVisible();
    await expect(page.locator('#roomBoxNameNote')).toContainText('from the plan');
    // Room B: the duct callout inside it is not a name either.
    await page.locator('#roomBoxCancel').click();
    await openBox(page, ROOM_B);
    await expect(page.locator('#roomBoxNewRoomName')).toHaveValue('MECH');
    await page.locator('#roomBoxCancel').click();
  });

  test('a plan-named room is labelled once with a totals tag placed off the printed text', async ({ page }) => {
    errors = []; await bootWithPlan(page, errors);
    await openBox(page, ROOM_A);
    await page.locator('#roomBoxHeight').fill('9');
    await page.selectOption('#roomBoxType', 'office');
    await page.locator('#roomBoxApply').click();
    const room = await page.evaluate(() => window.state.rooms[0]);
    expect(room).toMatchObject({ name: 'OPEN OFFICE 204', nameFromPlan: true, roomType: 'office' });
    // Add a SECOND, smaller box to the same room: the union is labelled once.
    await page.evaluate(() => {
      const ann = window.App.getActiveAnnotations(window.state.pages[0]);
      ann.roomBoxes.push({ x1: 60, y1: 332, x2: 160, y2: 380, heightFt: 9, roomId: window.state.rooms[0].id, id: 'box-2' });
      window.App.renderAnnotations();
    });
    const plan = await page.evaluate(() => window.App.planRoomLabels(window.App.getActiveAnnotations(window.state.pages[0]), 0));
    expect(plan.boxes.map((b) => b.mode)).toEqual(['none', 'none']);   // no full/name labels on plan-named boxes
    expect(plan.tags).toHaveLength(1);
    const tag = plan.tags[0];
    expect(tag.boxIndex).toBe(0);                                      // the largest box carries it
    // 20' x 16'-8" x 9' ≈ 3,000 ft³ + 100/12 x 48/12 x 9 ≈ 300 → about 3,300 ft³; office = 1 CFM/ft².
    expect(tag.text).toMatch(/^3,\d{3} ft³ · 3\d\d CFM · [✓⚠]$/);
    expect(tag.collided).toBe(false);
    // The tag rect clears BOTH printed strings inside the box.
    const items = await page.evaluate(() => window.App.pageTextItems(0).filter((it) => it.x > 60 && it.x < 300 && it.y > 132 && it.y < 332));
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const it of items) {
      const overlap = it.x < tag.rect.x + tag.rect.w && it.x + it.w > tag.rect.x && it.y < tag.rect.y + tag.rect.h && it.y + it.h > tag.rect.y;
      expect(overlap, it.str).toBe(false);
    }
  });

  test('a room the estimator named keeps the full label; renaming a plan-named room does too', async ({ page }) => {
    errors = []; await bootWithPlan(page, errors);
    await openBox(page, ROOM_A);
    await page.locator('#roomBoxNewRoomName').fill('Bullpen');     // overrides the plan's name
    await page.locator('#roomBoxHeight').fill('9');
    await page.locator('#roomBoxApply').click();
    expect(await page.evaluate(() => !!window.state.rooms[0].nameFromPlan)).toBe(false);
    const plan = await page.evaluate(() => window.App.planRoomLabels(window.App.getActiveAnnotations(window.state.pages[0]), 0));
    expect(plan.boxes[0].mode).toBe('full');
    expect(plan.tags).toEqual([]);
  });

  test('the plan names a room that already exists → the box joins that room instead of minting a twin', async ({ page }) => {
    errors = []; await bootWithPlan(page, errors);
    await page.evaluate(() => { window.state.rooms = [{ id: 'r-mech', name: 'Mech', color: '#47c88e' }]; });
    await openBox(page, ROOM_B);   // prints "MECH"
    await expect(page.locator('#roomBoxNewRoomNameGroup')).toBeHidden();
    await expect(page.locator('#roomBoxRoomList .room-picker-item.selected')).toContainText('Mech');
    await page.locator('#roomBoxCancel').click();
  });

  test('no text layer: nothing is prefilled and labels are untouched (option B holds only for plan-named rooms)', async ({ page }) => {
    errors = []; await bootWithPlan(page, errors, false);
    await openBox(page, ROOM_A);
    await expect(page.locator('#roomBoxNewRoomName')).toHaveValue('');
    await expect(page.locator('#roomBoxNameNote')).toBeHidden();
    await page.locator('#roomBoxNewRoomName').fill('Office');
    await page.locator('#roomBoxHeight').fill('9');
    await page.locator('#roomBoxApply').click();
    const plan = await page.evaluate(() => window.App.planRoomLabels(window.App.getActiveAnnotations(window.state.pages[0]), 0));
    expect(plan.boxes[0].mode).toBe('full');
  });

  test('a plan-named room whose text is not available at paint time falls back to name-only, silently', async ({ page }) => {
    errors = []; await bootWithPlan(page, errors);
    await openBox(page, ROOM_A);
    await page.locator('#roomBoxHeight').fill('9');
    await page.locator('#roomBoxApply').click();
    // Simulate the export-of-an-unfetched-page case: no items for the planner.
    const modes = await page.evaluate(() => {
      const real = window.App.peekPageTextItems;
      window.App.peekPageTextItems = () => [];
      try { return window.App.planRoomLabels(window.App.getActiveAnnotations(window.state.pages[0]), 0).boxes.map((b) => b.mode); }
      finally { window.App.peekPageTextItems = real; }
    });
    expect(modes).toEqual(['nameOnly']);
  });

  test('a text layer that lands after the dialog opened prefills then — unless the estimator already typed', async ({ page }) => {
    errors = []; await bootWithPlan(page, errors);
    // Evict the cache so the next open sees [] and the fetch lands later.
    await page.evaluate(() => { window.state.pages[0].rotation = 0; window.state.pages[0].pdfPage.__forceRefetch = true; });
    await page.evaluate(() => {
      // A fresh pdfPage identity invalidates tag-reader's cache entry.
      const pg = window.state.pages[0];
      const orig = pg.pdfPage;
      pg.pdfPage = Object.create(orig, { getTextContent: { value: (...a) => new Promise((res) => setTimeout(() => res(orig.getTextContent(...a)), 150)) } });
    });
    await openBox(page, ROOM_A);
    await expect(page.locator('#roomBoxNewRoomName')).toHaveValue('');
    await expect(page.locator('#roomBoxNewRoomName')).toHaveValue('OPEN OFFICE 204', { timeout: 3000 });
    await page.locator('#roomBoxCancel').click();
    // Typed first: the late text must not overwrite.
    await page.evaluate(() => {
      const pg = window.state.pages[0];
      const orig = Object.getPrototypeOf(pg.pdfPage);
      pg.pdfPage = Object.create(orig, { getTextContent: { value: (...a) => new Promise((res) => setTimeout(() => res(orig.getTextContent(...a)), 150)) } });
    });
    await openBox(page, ROOM_A);
    await page.locator('#roomBoxNewRoomName').fill('Mine');
    await page.waitForTimeout(400);
    await expect(page.locator('#roomBoxNewRoomName')).toHaveValue('Mine');
    await page.locator('#roomBoxCancel').click();
  });

  test('X4 option A: a room the estimator named, drawn as three boxes, is labelled once — name + room totals on the largest, "name · k/n" on the rest; a single-box room keeps the full label', async ({ page }) => {
    const errors = [];
    await bootWithPlan(page, errors, false);
    const plan = await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft', label: '1/4" = 1\'' };
      s.rooms = [{ id: 'r-cor', name: 'Corridor', color: '#4a9eff' }, { id: 'r-one', name: 'Closet', color: '#47c88e' }];
      const ann = App.getActiveAnnotations(s.pages[0]);
      ann.roomBoxes = [
        { id: 'b1', x1: 60, y1: 100, x2: 240, y2: 160, heightFt: 9, roomId: 'r-cor' },   // 15' × 5'  = 75 ft²
        { id: 'b2', x1: 240, y1: 100, x2: 360, y2: 160, heightFt: 9, roomId: 'r-cor' },  // 10' × 5'  = 50 ft²
        { id: 'b3', x1: 60, y1: 160, x2: 420, y2: 232, heightFt: 9, roomId: 'r-cor' },   // 30' × 6'  = 180 ft² (largest)
        { id: 'b4', x1: 420, y1: 300, x2: 540, y2: 380, heightFt: 8, roomId: 'r-one' },  // a single-box room
      ];
      App.updateUI();
      return App.planRoomLabels(ann, 0);
    });
    expect(plan.boxes.map((b) => b.mode)).toEqual(['namePart', 'namePart', 'roomFull', 'full']);
    expect(plan.boxes.map((b) => b.part || null)).toEqual(['1/3', '2/3', '3 boxes', null]);
    expect(Math.round(plan.boxes[2].roomSqft)).toBe(305);          // 75 + 50 + 180
    expect(Math.round(plan.boxes[2].roomVolume)).toBe(305 * 9);
    expect(plan.tags).toEqual([]);                                  // no plan-named room → no D24 tag
    // the sheet paints with no error
    await page.evaluate(() => window.App.renderAnnotations && window.App.renderAnnotations());
    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: Fittings from bends (fitting-model.js + features/child-counts.js,
 * punch row BEND-FITTINGS, 2026-09-18). A line type with the option on derives
 * its elbows from each run's own bends (nearer 45° or nearer 90°) and drops,
 * as rows under the type in the Summary and the exports, never as marks. The
 * fitting each class produces is named and counted on the type. Also: the
 * details dialog's toggle and rows, the Bid Check row beside the hangers row,
 * and the bend chips drawing without errors. BEND-OVERRIDE (2026-09-18): the
 * edit-mode vertex menu (features/bend-override.js) writes points[i].fitting;
 * a type with the option off keeps the old right-click-deletes-the-vertex.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function setupProject(page) {
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.pages[0].scale = { pixelsPerUnit: 12, unit: 'ft' };
    s.lineTypes.push({ id: 'lt-cu', name: '2in Cu', color: '#2e86de', curveStyle: 'straight', bendFittings: { enabled: true } });
    s.lineTypes.push({ id: 'lt-pex', name: '3/4in PEX', color: '#4a9eff', curveStyle: 'straight' });
    const ann = s.pages[0].canvases[0].annotations;
    // right, down (a 90), out at 45, back to level (another 45): 1 × 90, 2 × 45
    ann.polylines.push({ id: 'p1', lineTypeId: 'lt-cu', color: '#2e86de', closed: false, points: [{ x: 100, y: 100 }, { x: 220, y: 100 }, { x: 220, y: 220 }, { x: 300, y: 300 }, { x: 420, y: 300 }] });
    // a 10° wobble: no fitting
    ann.polylines.push({ id: 'p2', lineTypeId: 'lt-cu', color: '#2e86de', closed: false, points: [{ x: 100, y: 400 }, { x: 220, y: 400 }, { x: 340, y: 421 }] });
    // a chained device run with a drop at its end: one 90 from the drop
    ann.quickLines.push({ x1: 100, y1: 500, x2: 220, y2: 500, color: '#2e86de', id: 'q1', lineTypeId: 'lt-cu', endDrop: 3, endDropUnit: 'ft' });
    window.App.updateUI();
  });
}

// PDF-space -> viewport client coords, through the annotation canvas's rect.
async function screenPointForPdf(page, pdf) {
  return page.evaluate((p) => {
    const c = document.getElementById('annCanvas');
    const rect = c.getBoundingClientRect();
    const bc = window.App.toCanvas(p);
    return { x: rect.left + bc.x * (rect.width / c.width), y: rect.top + bc.y * (rect.height / c.height) };
  }, pdf);
}

const totalsFor = (page, id) => page.evaluate((ltId) => JSON.parse(JSON.stringify(window.App.getChildCountTotals().byGroup['null']?.lineType?.[ltId] || [])), id);

test.describe('Fittings from bends', () => {
  test('a run counts its own 45s and 90s and its drops; the rows ride the Summary and the exports', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await setupProject(page);

    expect(await totalsFor(page, 'lt-cu')).toEqual([
      { name: '2in Cu 45° elbow', qty: 1, per: 'bend', bendClass: 'bend45', derived: true, total: 2, excludedPxRuns: 0 },
      { name: '2in Cu 90° elbow', qty: 1, per: 'bend', bendClass: 'bend90', derived: true, total: 1, excludedPxRuns: 0 },
      { name: '2in Cu 90° elbow', qty: 1, per: 'drop', bendClass: 'drop', derived: true, total: 1, excludedPxRuns: 0 },
    ]);
    // the PEX type has the option off: no rows at all
    expect(await totalsFor(page, 'lt-pex')).toEqual([]);

    // Summary: indented derived rows under the type
    const childRows = await page.evaluate(() => [...document.querySelectorAll('#summaryList .summary-child-item')].map((d) => d.textContent.trim()));
    expect(childRows).toEqual(['2in Cu 45° elbow1/bend2', '2in Cu 90° elbow1/bend1', '2in Cu 90° elbow1/drop1']);

    // the PipeTooling text carries the rows under the type
    const tooling = await page.evaluate(() => window.App.getPipeToolingSummary ? window.App.getPipeToolingSummary() : (window.getPipeToolingSummary ? window.getPipeToolingSummary() : ''));
    if (tooling) {
      expect(tooling).toContain('2in Cu 45° elbow');
      expect(tooling).toContain('2in Cu 90° elbow');
    }
    // the chips drew (a canvas read: no errors is the assertion; pixels are the render-pixels spec's job)
    expect(errors).toEqual([]);
  });

  test('the details dialog: the toggle, the rows, a renamed fitting and a quantity follow into the tally', async ({ page }) => {
    await setupProject(page);
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('lineType', window.state.lineTypes.find((l) => l.id === 'lt-cu')));
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    const group = page.locator('#bendFittingsGroup');
    await expect(group).toBeVisible();
    await expect(page.locator('#bendFittingsBtn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#bendFittingsRows .bend-fitting-row')).toHaveCount(3);
    await expect(page.locator('#bendFittingsRows .bend-fitting-row[data-class="bend45"] .bend-fitting-name')).toHaveValue('2in Cu 45° elbow');

    // rename the 90 row (DWV words) and make the drop row count two
    const name90 = page.locator('#bendFittingsRows .bend-fitting-row[data-class="bend90"] .bend-fitting-name');
    await name90.fill('2in Cu 1/4 bend');
    await name90.press('Enter');
    const qtyDrop = page.locator('#bendFittingsRows .bend-fitting-row[data-class="drop"] .bend-fitting-qty');
    await qtyDrop.fill('2');
    await qtyDrop.dispatchEvent('change');
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'lt-cu').bendFittings)).toEqual({
      enabled: true, bend45: { name: '2in Cu 45° elbow', qty: 1 }, bend90: { name: '2in Cu 1/4 bend', qty: 1 }, drop: { name: '2in Cu 90° elbow', qty: 2 },
    });
    const rows = await totalsFor(page, 'lt-cu');
    expect(rows.find((r) => r.bendClass === 'bend90').name).toBe('2in Cu 1/4 bend');
    expect(rows.find((r) => r.bendClass === 'drop').total).toBe(2);

    // off: the rows leave the dialog and the tally
    await page.locator('#bendFittingsBtn').click();
    await expect(page.locator('#bendFittingsBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#bendFittingsRows')).toBeHidden();
    expect(await totalsFor(page, 'lt-cu')).toEqual([]);
    // on again: the chosen names are kept
    await page.locator('#bendFittingsBtn').click();
    expect((await totalsFor(page, 'lt-cu')).find((r) => r.bendClass === 'bend90').name).toBe('2in Cu 1/4 bend');

    // a counter's dialog never shows the block
    await page.locator('#counterLineTypeDetailsClose').click();
    await page.evaluate(() => { window.state.counters.push({ id: 'c1', name: 'Water Closet', icon: 'M96 96h448v448H96z', color: '#47c88e' }); window.App.openCounterLineTypeDetailsModal('counter', window.state.counters.find((c) => c.id === 'c1')); });
    await expect(page.locator('#bendFittingsGroup')).toBeHidden();
  });

  test('Bid Check: informational while the option is off everywhere, a warning when some pipe types count and others do not, green when all do', async ({ page }) => {
    await setupProject(page);
    const row = () => page.evaluate(() => { const bc = window.App.getBidCheck(); return bc.auto.find((r) => r.id === 'bend-fittings') || null; });
    await page.evaluate(() => { window.state.trade = 'plumbing'; window.App.updateUI(); });
    // 2in Cu counts, 3/4in PEX does not: warn, naming both sides
    let r = await row();
    expect(r.verdict).toBe('warn');
    expect(r.detail).toContain('3/4in PEX');
    expect(r.detail).toContain('2in Cu');
    // turn PEX on too: ok
    await page.evaluate(() => { window.state.lineTypes.find((l) => l.id === 'lt-pex').bendFittings = { enabled: true }; window.App.updateUI(); });
    r = await row();
    expect(r.verdict).toBe('ok');
    // everything off: informational, not an open item
    await page.evaluate(() => { window.state.lineTypes.forEach((l) => { l.bendFittings = { enabled: false }; }); window.App.updateUI(); });
    r = await row();
    expect(r.verdict).toBe('na');
    // no supported material anywhere: no row
    await page.evaluate(() => { window.state.lineTypes.forEach((l, i) => { l.name = 'Line ' + String.fromCharCode(65 + i); }); window.App.updateUI(); });
    expect(await row()).toBeNull();
  });

  test('edit mode: a right-click on a vertex offers no fitting / count as 45 / count as 90 / read from the angle; the override rides the run', async ({ page }) => {
    await setupProject(page);
    const menu = page.locator('#bendVertexMenu');
    const openOn = async (idx) => {
      const pdf = await page.evaluate((i) => window.state.editingPolyline.points[i], idx);
      const sp = await screenPointForPdf(page, pdf);
      await page.mouse.click(sp.x, sp.y, { button: 'right' });
      await expect(menu).toBeVisible();
    };
    await page.evaluate(() => window.App.enterEditMode('p1', 0));
    expect(await page.evaluate(() => window.state.editingPolyline?.id)).toBe('p1');

    // vertex 2 reads as a 90; say it is a jog, no fitting
    await openOn(1);
    await expect(menu.locator('.tool-context-menu-heading')).toHaveText('Vertex 2 · reads as 90°');
    await expect(menu.locator('button')).toHaveText(['No fitting here', 'Count as 45', 'Count as 90', 'Delete vertex']);
    await menu.locator('button[data-action="none"]').click();
    await expect(menu).toBeHidden();
    expect(await page.evaluate(() => window.state.editingPolyline.points[1].fitting)).toBe('none');
    // the heading shows the choice; "Read from the angle" appears; the 90 is offered again
    await openOn(1);
    await expect(menu.locator('.tool-context-menu-heading')).toHaveText('Vertex 2 · reads as 90° · set: no fitting');
    await expect(menu.locator('button')).toHaveText(['Count as 45', 'Count as 90', 'Read from the angle', 'Delete vertex']);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    // still in edit mode after the Escape (the menu ate it)
    expect(await page.evaluate(() => window.state.editingPolyline?.id)).toBe('p1');

    // vertex 3 reads as a 45; force a 90
    await openOn(2);
    await menu.locator('button[data-action="bend90"]').click();
    // an endpoint is never an elbow: delete only
    await openOn(0);
    await expect(menu.locator('.tool-context-menu-heading')).toHaveText('Vertex 1 · an end, never an elbow');
    await expect(menu.locator('button')).toHaveText(['Delete vertex']);
    await page.keyboard.press('Escape');

    // done: the run goes back with its overrides; the tally follows (was 2 × 45 + 1 × 90 + 1 drop)
    await page.locator('#doneEditing').click();
    expect(await page.evaluate(() => window.state.editingPolyline)).toBeFalsy();
    expect(await page.evaluate(() => window.state.pages[0].canvases[0].annotations.polylines.find((p) => p.id === 'p1').points.map((p) => p.fitting || null))).toEqual([null, 'none', 'bend90', null, null]);
    const rows = await totalsFor(page, 'lt-cu');
    expect(rows.find((r) => r.bendClass === 'bend45').total).toBe(1);
    expect(rows.find((r) => r.bendClass === 'bend90').total).toBe(1);
    expect(rows.find((r) => r.bendClass === 'drop').total).toBe(1);

    // read from the angle: the override leaves, the read returns
    await page.evaluate(() => window.App.enterEditMode('p1', 0));
    await openOn(2);
    await menu.locator('button[data-action="angle"]').click();
    await page.locator('#doneEditing').click();
    expect((await totalsFor(page, 'lt-cu')).find((r) => r.bendClass === 'bend45').total).toBe(2);

    // a type with the option off: the right-click deletes the vertex, no menu
    await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      ann.polylines.push({ id: 'p3', lineTypeId: 'lt-pex', color: '#4a9eff', closed: false, points: [{ x: 100, y: 600 }, { x: 220, y: 600 }, { x: 220, y: 700 }] });
      window.App.updateUI();
      window.App.enterEditMode('p3', 0);
    });
    const sp = await screenPointForPdf(page, { x: 220, y: 600 });
    await page.mouse.click(sp.x, sp.y, { button: 'right' });
    await expect(menu).toBeHidden();
    expect(await page.evaluate(() => window.state.editingPolyline.points.length)).toBe(2);
    await page.locator('#doneEditing').click();
  });

  test('edit mode edges: the menu\'s Delete vertex, undo and redo mid-edit, a closed run, outside click, screen-edge placement, touch long-press, and a save/import round trip', async ({ page }) => {
    test.setTimeout(90000);   // a long case with a full reload; against counttooling.com the live site's realtime traffic never goes network-idle quickly
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await setupProject(page);
    const menu = page.locator('#bendVertexMenu');
    const polyP1 = () => page.evaluate(() => { const p = window.App.ensureActiveCanvas(window.state.pages[0]).annotations.polylines.find((q) => q.id === 'p1'); return p ? p.points.map((q) => q.fitting || null) : null; });
    const editState = () => page.evaluate(() => ({ tool: window.state.tool, editing: !!window.state.editingPolyline, done: document.getElementById('doneEditing').style.display }));

    // Undo mid-edit: the run must come back whole, the change reverted, edit mode left cleanly
    await page.evaluate(() => window.App.enterEditMode('p1', 0));
    await page.evaluate(() => window.App.tryOpenBendVertexMenu(1, 300, 300));
    await menu.locator('button[data-action="none"]').click();
    expect(await page.evaluate(() => window.state.editingPolyline.points[1].fitting)).toBe('none');
    await page.locator('#undoBtn').click();
    expect(await polyP1()).toEqual([null, null, null, null, null]);
    expect(await editState()).toEqual({ tool: 0, editing: false, done: 'none' });
    await expect(page.locator('#annCanvas')).not.toHaveClass(/interactive/);
    // Redo brings the change back onto the saved run
    await page.locator('#redoBtn').click();
    expect(await polyP1()).toEqual([null, 'none', null, null, null]);
    expect(await editState()).toEqual({ tool: 0, editing: false, done: 'none' });
    await page.locator('#undoBtn').click();
    expect(await polyP1()).toEqual([null, null, null, null, null]);

    // The menu's own Delete vertex, then undo restores the five points
    await page.evaluate(() => window.App.enterEditMode('p1', 0));
    await page.evaluate(() => window.App.tryOpenBendVertexMenu(2, 300, 300));
    await menu.locator('button[data-action="delete"]').click();
    expect(await page.evaluate(() => window.state.editingPolyline.points.length)).toBe(4);
    await page.locator('#doneEditing').click();
    expect((await polyP1()).length).toBe(4);
    expect((await totalsFor(page, 'lt-cu')).find((r) => r.bendClass === 'bend45')).toBeUndefined();   // the two 45s left with the vertex
    await page.keyboard.press('Control+z');
    expect((await polyP1()).length).toBe(5);
    // A drag (no snapshot of its own) + Done Editing: one undo restores the run as it was when editing began
    await page.evaluate(() => { window.App.enterEditMode('p1', 0); window.state.editingPolyline.points[1].x = 250; });
    await page.locator('#doneEditing').click();
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.polylines.find((q) => q.id === 'p1').points[1].x)).toBe(250);
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => window.App.ensureActiveCanvas(window.state.pages[0]).annotations.polylines.find((q) => q.id === 'p1').points[1].x)).toBe(220);

    // A closed run: every vertex is interior, so vertex 1 offers the full menu
    await page.evaluate(() => {
      const ann = window.App.ensureActiveCanvas(window.state.pages[0]).annotations;
      ann.polylines.push({ id: 'p4', lineTypeId: 'lt-cu', color: '#2e86de', closed: true, points: [{ x: 500, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 200 }, { x: 500, y: 200 }] });
      window.App.updateUI();
      window.App.enterEditMode('p4', 0);
    });
    await page.evaluate(() => window.App.tryOpenBendVertexMenu(0, 300, 300));
    await expect(menu.locator('.tool-context-menu-heading')).toHaveText('Vertex 1 · reads as 90°');
    await expect(menu.locator('button')).toHaveText(['No fitting here', 'Count as 45', 'Count as 90', 'Delete vertex']);
    // Outside click dismisses without a change
    await page.mouse.click(5, 300);
    await expect(menu).toBeHidden();
    expect(await page.evaluate(() => window.state.editingPolyline.points[0].fitting)).toBeUndefined();
    // Screen-edge placement: opened at the bottom-right corner, the menu stays inside the viewport
    await page.evaluate(() => window.App.tryOpenBendVertexMenu(1, window.innerWidth - 2, window.innerHeight - 2));
    await expect(menu).toBeVisible();
    const fit = await page.evaluate(() => { const r = document.getElementById('bendVertexMenu').getBoundingClientRect(); return r.right <= window.innerWidth && r.bottom <= window.innerHeight && r.left >= 0 && r.top >= 0; });
    expect(fit).toBe(true);
    await page.keyboard.press('Escape');
    await page.locator('#doneEditing').click();

    // Touch: a 500 ms long-press on a vertex opens the menu (the app synthesizes the contextmenu), a tap picks
    await page.evaluate(() => {
      window.__fireTouch = (type, x, y) => {
        const el = document.getElementById('canvasWrapper');
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        const isEnd = type === 'touchend' || type === 'touchcancel';
        el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: isEnd ? [] : [t], changedTouches: [t], targetTouches: isEnd ? [] : [t] }));
      };
      window.App.enterEditMode('p1', 0);
    });
    const v3 = await screenPointForPdf(page, { x: 220, y: 220 });
    await page.evaluate(({ x, y }) => window.__fireTouch('touchstart', x, y), v3);
    await expect(menu).toBeVisible({ timeout: 3000 });
    await page.evaluate(({ x, y }) => window.__fireTouch('touchend', x, y), v3);
    await expect(menu).toBeVisible();
    await expect(menu.locator('.tool-context-menu-heading')).toHaveText('Vertex 3 · reads as 45°');
    await menu.locator('button[data-action="bend90"]').click();
    expect(await page.evaluate(() => { const p = window.state.editingPolyline.points[2]; return [p.x, p.y, p.fitting]; })).toEqual([220, 220, 'bend90']);   // picked, and the vertex did not drag
    await page.locator('#doneEditing').click();
    expect(await polyP1()).toEqual([null, null, 'bend90', null, null]);

    // Round trip: the Export Canvas payload back in through #importInput after a full reload
    const payload = await page.evaluate(() => JSON.parse(JSON.stringify({
      version: 1, counters: window.state.counters, lineTypes: window.state.lineTypes, groups: window.state.groups || [], groupsEnabled: false, rooms: [],
      pages: [{ index: 0, canvases: window.state.pages[0].canvases, scale: window.state.pages[0].scale, rotation: 0 }],
    })));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!(window.App && window.App.enterEditMode && document.getElementById('pdfInput')));
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 20000 });
    await page.locator('#importInput').setInputFiles({ name: 'takeoff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
    await page.waitForFunction(() => (window.state.lineTypes || []).some((l) => l.id === 'lt-cu'));
    expect(await polyP1()).toEqual([null, null, 'bend90', null, null]);
    const rows = await totalsFor(page, 'lt-cu');
    expect(rows.find((r) => r.bendClass === 'bend45').total).toBe(1);
    expect(rows.find((r) => r.bendClass === 'bend90').total).toBe(6);   // p1's forced 90 + its read 90, and the closed rectangle's four
    expect(await page.evaluate(() => window.state.lineTypes.find((l) => l.id === 'lt-cu').bendFittings.enabled)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('edit mode: the run keeps its stroke while it is edited (the segments paint under the dots and chips)', async ({ page }) => {
    await setupProject(page);
    await page.evaluate(() => window.App.renderAnnotations());   // updateUI alone does not repaint the overlay
    // The strongest pixel in a 5x5 window around a PDF point on the annotation canvas.
    const inkAt = (pdf) => page.evaluate((p) => {
      const c = document.getElementById('annCanvas');
      const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      const bc = window.App.toCanvas(p);
      const r = 2, n = 2 * r + 1;
      const d = ctx.getImageData(Math.round(bc.x) - r, Math.round(bc.y) - r, n, n).data;
      let best = { r: 0, g: 0, b: 0, a: 0 };
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > best.a) best = { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
      return best;
    }, pdf);
    // lt-cu's #2e86de = rgb(46,134,222)
    const isCu = (px) => px.a > 200 && Math.abs(px.r - 46) < 24 && Math.abs(px.g - 134) < 24 && Math.abs(px.b - 222) < 24;
    const mid1 = { x: 160, y: 100 };   // midpoint of p1's first segment, (100,100)->(220,100)
    const offRun = { x: 160, y: 140 }; // nothing painted here
    expect(isCu(await inkAt(mid1))).toBe(true);       // committed: the draw core paints it
    expect((await inkAt(offRun)).a).toBe(0);

    // editing: the run is spliced out of the annotations, so the edit block paints its segments
    await page.evaluate(() => window.App.enterEditMode('p1', 0));
    expect(await page.evaluate(() => window.state.editingPolyline?.id)).toBe('p1');
    expect(isCu(await inkAt(mid1))).toBe(true);
    expect((await inkAt(offRun)).a).toBe(0);
    await page.locator('#doneEditing').click();
    expect(isCu(await inkAt(mid1))).toBe(true);       // back in the annotations, still painted

    // a closed run closes back to its first point while edited: the closing segment paints too
    await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      ann.polylines.push({ id: 'p4', lineTypeId: 'lt-cu', color: '#2e86de', closed: true, points: [{ x: 500, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 200 }] });
      window.App.updateUI();
      window.App.enterEditMode('p4', 0);   // renders
    });
    expect(await page.evaluate(() => window.state.editingPolyline?.id)).toBe('p4');
    expect(isCu(await inkAt({ x: 550, y: 150 }))).toBe(true);   // midpoint of the closing segment, (600,200)->(500,100)
    expect(isCu(await inkAt({ x: 600, y: 150 }))).toBe(true);   // midpoint of a drawn segment
    await page.locator('#doneEditing').click();
  });
});

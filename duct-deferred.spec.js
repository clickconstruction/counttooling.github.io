// @ts-check
/**
 * Tests: the deferred duct choices closed (DUCT-PLAN.md unit D15).
 *
 * - Quick Count CFM: the Quick tab's create row carries an optional CFM box
 *   (#counterQuickCountCfm, the Create tab's #counterCfm twin). A positive
 *   value rides the new counter as `cfm`; empty leaves the key unset (a
 *   non-air counter's shape is unchanged), and the box opens empty each time.
 * - Legend room ⚠ line: an under-served room (D7's ~10% tolerance) adds one
 *   "⚠ Office 101 needs 108 · served 50" line to the on-canvas legend for
 *   that sheet — behind legendSettings.showDuct, no new toggle — and a served
 *   room adds nothing. The cross-page number comes from
 *   App.getRoomBalanceForPage through canvas-draw's deps seam.
 * - Per-marker CFM override: right-click a placed marker of a CFM-carrying
 *   counter → "CFM for this one…" → #markerCfmModal → `marker.cfmOverride`
 *   (absent when unset; clearing deletes the key). The override changes the
 *   downstream CFM the live suggestion reports and the room's served total;
 *   the sidebar row title + details modal show "(override 250)"; markers of
 *   a non-CFM type get no row. The key survives export → import.
 * - render-pixels.spec.js (run alongside) proves the legend baselines are
 *   byte-identical — its fixture has a room box but no room target.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Duct deferred choices (D15)', () => {
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
    // 10 pt per ft — a 120×90 pt box is 12 ft × 9 ft = 108 ft² (Office 1.0 → 108 CFM).
    await page.evaluate(() => {
      const s = window.state;
      s.pages[s.currentPage].scale = { pixelsPerUnit: 10, unit: 'ft' };
    });
  });

  // The Create-tab counter with the D6 CFM input (duct-balance.spec idiom).
  async function createCfmCounter(page, name, cfm) {
    await page.locator('#counterBtn').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    if (await page.locator('#counterCreatePanel').isHidden()) await page.locator('#counterModal .counter-tab[data-tab="create"]').click();
    await page.locator('#counterName').fill(name);
    if (cfm != null) await page.locator('#counterCfm').fill(String(cfm));
    await page.locator('#counterCreate').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    const created = await page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
    expect(created.name).toBe(name);
    if (cfm != null) expect(created.cfm).toBe(cfm);
    return created;
  }

  // A counter through the QUICK tab, with or without the D15 CFM box.
  async function quickCreate(page, cfm) {
    await page.locator('#counterBtn').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    await page.locator('#counterModal .counter-tab[data-tab="quickcount"]').click();
    await expect(page.locator('#counterQuickCountPanel')).toBeVisible();
    // The box always opens empty (the Create tab's stale-value rule).
    await expect(page.locator('#counterQuickCountCfm')).toHaveValue('');
    if (cfm != null) await page.locator('#counterQuickCountCfm').fill(String(cfm));
    await page.locator('#counterQuickCountAdd').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.COUNTER);
    return page.evaluate(() => window.state.counters[window.state.counters.length - 1]);
  }

  const lastMarkerPos = (page, counterId) => page.evaluate((id) => {
    const arr = window.App.getMergedAnnotationsForPage(window.state.pages[0]).counterMarkers[id] || [];
    const m = arr[arr.length - 1];
    return m ? { x: m.x, y: m.y } : null;
  }, counterId);

  // The strings the live legend painted on the last render (fillText tap
  // around one App.renderAnnotations — no draw-core seam needed).
  const legendTexts = (page) => page.evaluate(() => {
    const out = [];
    const proto = CanvasRenderingContext2D.prototype;
    const orig = proto.fillText;
    proto.fillText = function (t, ...rest) { out.push(String(t)); return orig.call(this, t, ...rest); };
    try { window.App.renderAnnotations(); } finally { proto.fillText = orig; }
    return out;
  });

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

  async function setRoomTypeOffice(page) {
    await page.locator('#roomsList .room-row').first().click();
    await expect(page.locator('#roomEditModal')).toHaveClass(/visible/);
    await page.selectOption('#roomEditType', 'office');
    await page.locator('#roomEditSave').click();
    await expect(page.locator('#roomEditModal')).not.toHaveClass(/visible/);
  }

  async function armDuct(page) {
    await page.locator('#ductBtn').click();
    await expect(page.locator('#ductCreateModal')).toHaveClass(/visible/);
    await page.locator('#ductCreateW').fill('24');
    await page.locator('#ductCreateH').fill('12');
    await page.locator('#ductCreateStart').click();
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.DUCT && !!window.state.drawingDuct);
  }

  test('Quick Count: a CFM value rides the new counter; empty leaves cfm unset', async ({ page }) => {
    const withCfm = await quickCreate(page, 150);
    expect(withCfm.cfm).toBe(150);
    expect(withCfm.name.length).toBeGreaterThan(0);

    const without = await quickCreate(page, null);
    expect('cfm' in without).toBe(false);

    // Zero / junk never stamps the key (the set-only-when-positive rule).
    const zero = await quickCreate(page, 0);
    expect('cfm' in zero).toBe(false);

    // The markup mirrors the Create tab's #counterCfm (number, min 0, step 5).
    const attrs = await page.evaluate(() => {
      const el = /** @type {HTMLInputElement} */ (document.getElementById('counterQuickCountCfm'));
      const twin = /** @type {HTMLInputElement} */ (document.getElementById('counterCfm'));
      return { type: el.type, min: el.min, step: el.step, twinType: twin.type, twinStep: twin.step };
    });
    expect(attrs.type).toBe('number');
    expect(attrs.min).toBe('0');
    expect(attrs.step).toBe(attrs.twinStep);
    expect(attrs.type).toBe(attrs.twinType);

    expect(errors).toEqual([]);
  });

  test('legend: an under-served room adds its ⚠ line on that sheet; a served room does not; showDuct gates it', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    // Legend overlay is on by default with a legend object on the canvas.
    expect(await page.evaluate(() => !!window.state.showLegendOverlay && !!window.state.pages[0].canvases[0].annotations.legend)).toBe(true);

    // A 50-CFM diffuser with a 12×9 ft Office box around it → needs 108, served 50 → ⚠.
    const c1 = await createCfmCounter(page, 'Diffuser 50', 50);
    await wrapper.click({ position: { x: 200, y: 300 } });
    const m1 = await lastMarkerPos(page, c1.id);
    expect(m1).not.toBeNull();
    await addRoomBoxAround(page, m1, 60, 45, 'Office 101');

    // No room type yet → no balance → no line (zero behavior change).
    let texts = await legendTexts(page);
    expect(texts.some((t) => t.startsWith('⚠'))).toBe(false);
    expect(texts.some((t) => t.startsWith('Office 101 '))).toBe(true);   // the D7-era volume row is still there

    await setRoomTypeOffice(page);
    expect(await page.evaluate(() => window.App.getRoomBalanceForPage(0))).toEqual([
      expect.objectContaining({ name: 'Office 101', targetCfm: 108, servedCfm: 50, under: true }),
    ]);
    texts = await legendTexts(page);
    expect(texts).toContain('⚠ Office 101 needs 108 · served 50');
    // Sidebar badge agrees (the D7 surface is unchanged).
    await expect(page.locator('#roomsList .room-balance-row')).toHaveText('needs 108 · served 50 ⚠');

    // The other sheet has no box of this room → no line there.
    expect(await page.evaluate(() => window.App.getRoomBalanceForPage(1))).toEqual([]);

    // Legend Settings → Show duct rows OFF gates the line too (no new toggle).
    await page.evaluate(() => { window.state.legendSettings.showDuct = false; });
    texts = await legendTexts(page);
    expect(texts.some((t) => t.startsWith('⚠'))).toBe(false);
    await page.evaluate(() => { window.state.legendSettings.showDuct = true; });

    // Drop a 100-CFM device inside → served 150 of 108 → the line goes.
    await createCfmCounter(page, 'Diffuser 100', 100);
    await wrapper.click({ position: { x: 210, y: 305 } });
    await expect(page.locator('#roomsList .room-balance-row')).toHaveText('needs 108 · served 150');
    texts = await legendTexts(page);
    expect(texts.some((t) => t.startsWith('⚠'))).toBe(false);

    expect(errors).toEqual([]);
  });

  test('per-marker override: context-menu row → modal → cfmOverride feeds the suggestion, the served total and the notes; clearing removes the key', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    const c1 = await createCfmCounter(page, 'Diffuser 150', 150);
    await wrapper.click({ position: { x: 150, y: 300 } });
    const m1 = await lastMarkerPos(page, c1.id);
    expect(m1).not.toBeNull();

    // Right-click the marker: the shared mark menu carries the new row.
    await wrapper.click({ position: { x: 150, y: 300 }, button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#ctxMarkerCfm')).toBeVisible();
    await expect(page.locator('#ctxMarkerCfm')).toHaveText('CFM for this one…');
    await page.locator('#ctxMarkerCfm').click();
    await expect(page.locator('#contextMenu')).not.toHaveClass(/visible/);
    await expect(page.locator('#markerCfmModal')).toHaveClass(/visible/);
    await expect(page.locator('#markerCfmHint')).toContainText('(150)');
    await expect(page.locator('#markerCfmInput')).toHaveValue('');
    await expect(page.locator('#markerCfmInput')).toBeFocused();
    await page.locator('#markerCfmInput').fill('250');
    await page.locator('#markerCfmSave').click();
    await expect(page.locator('#markerCfmModal')).not.toHaveClass(/visible/);
    const marker = () => page.evaluate((id) => ({ ...window.state.pages[0].canvases[0].annotations.counterMarkers[id][0] }), c1.id);
    expect((await marker()).cfmOverride).toBe(250);
    // The type itself is untouched.
    expect(await page.evaluate(() => window.state.counters[0].cfm)).toBe(150);

    // The device collector reads the override; the sidebar title + details
    // modal show the "(override 250)" note beside the type CFM.
    expect(await page.evaluate(() => window.App.collectDuctDevices(0).map((d) => d.cfm))).toEqual([250]);
    expect(await page.locator('#countersList .sidebar-item .name').first().getAttribute('title')).toContain('(override 250)');
    await page.evaluate(() => window.App.openCounterLineTypeDetailsModal('counter', window.state.counters[0]));
    await expect(page.locator('#counterLineTypeDetailsModal')).toHaveClass(/visible/);
    await expect(page.locator('#counterLineTypeDetailsCfmOverrides')).toBeVisible();
    await expect(page.locator('#counterLineTypeDetailsCfmOverrides')).toContainText('(override 250)');
    await page.locator('#counterLineTypeDetailsClose').click();
    await expect(page.locator('#counterLineTypeDetailsModal')).not.toHaveClass(/visible/);

    // The room's served total reads 250 (a 12×9 Office needs 108 → no ⚠).
    await addRoomBoxAround(page, m1, 60, 45, 'Office 101');
    await setRoomTypeOffice(page);
    await expect(page.locator('#roomsList .room-balance-row')).toHaveText('needs 108 · served 250');

    // The live suggestion's downstream number is the override, not the type.
    await armDuct(page);
    await wrapper.click({ position: { x: 100, y: 300 } });
    const sug = await page.evaluate(() => window.App.getDuctDraftSuggestion());
    expect(sug).not.toBeNull();
    expect(Math.round(sug.cfm)).toBe(250);
    expect(sug.chipText).toContain('250 CFM downstream');
    // Drop the trace (Escape ladder) and disarm.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.state.drawingDuct);
    await page.evaluate(() => { window.state.tool = window.App.TOOL.NONE; window.App.updateUI(); });

    // Reopen with the current value prefilled; clearing deletes the key.
    await wrapper.click({ position: { x: 150, y: 300 }, button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);
    await page.locator('#ctxMarkerCfm').click();
    await expect(page.locator('#markerCfmModal')).toHaveClass(/visible/);
    await expect(page.locator('#markerCfmInput')).toHaveValue('250');
    await page.locator('#markerCfmInput').fill('');
    await page.keyboard.press('Enter');   // Enter commits, like the highlight-name modal
    await expect(page.locator('#markerCfmModal')).not.toHaveClass(/visible/);
    expect('cfmOverride' in (await marker())).toBe(false);
    expect(await page.evaluate(() => window.App.collectDuctDevices(0).map((d) => d.cfm))).toEqual([150]);
    await expect(page.locator('#roomsList .room-balance-row')).toHaveText('needs 108 · served 150');
    expect(await page.locator('#countersList .sidebar-item .name').first().getAttribute('title') || '').not.toContain('override');

    // A marker of a non-CFM counter type gets no row.
    await createCfmCounter(page, 'Hose Bib', null);
    await wrapper.click({ position: { x: 400, y: 150 } });
    await wrapper.click({ position: { x: 400, y: 150 }, button: 'right' });
    await expect(page.locator('#contextMenu')).toHaveClass(/visible/);
    await expect(page.locator('#ctxMarkerCfm')).toBeHidden();
    await page.keyboard.press('Escape');

    expect(errors).toEqual([]);
  });

  test('cfmOverride survives export → import (markers serialize wholesale)', async ({ page }) => {
    const wrapper = page.locator('#canvasWrapper');
    const c1 = await createCfmCounter(page, 'Diffuser 150', 150);
    await wrapper.click({ position: { x: 150, y: 300 } });
    await wrapper.click({ position: { x: 250, y: 300 } });
    await page.evaluate((id) => {
      const arr = window.state.pages[0].canvases[0].annotations.counterMarkers[id];
      const c = window.state.counters.find((x) => x.id === id);
      window.App.openMarkerCfmModal(arr[1], c);
    }, c1.id);
    await expect(page.locator('#markerCfmModal')).toHaveClass(/visible/);
    await page.locator('#markerCfmInput').fill('300');
    await page.locator('#markerCfmSave').click();
    expect(await page.evaluate(() => window.App.collectDuctDevices(0).map((d) => d.cfm))).toEqual([150, 300]);

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
    const markers = data.pages[0].canvases[0].annotations.counterMarkers[c1.id];
    expect('cfmOverride' in markers[0]).toBe(false);   // the untouched marker keeps its pre-D15 shape
    expect(markers[1].cfmOverride).toBe(300);

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
    await page.waitForFunction((id) => (window.state.counters || []).some((c) => c.id === id), c1.id);
    expect(await page.evaluate((id) => window.state.pages[0].canvases[0].annotations.counterMarkers[id].map((m) => m.cfmOverride), c1.id)).toEqual([undefined, 300]);
    expect(await page.evaluate(() => window.App.collectDuctDevices(0).map((d) => d.cfm))).toEqual([150, 300]);

    expect(errors).toEqual([]);
  });
});

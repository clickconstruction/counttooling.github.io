// @ts-check
/**
 * Tests: Tier-3 B9 — the mobile / touch batch (J1 J15).
 *
 * 1. The mobile LEFT drawer (#hamburger / body.sidebar-open) auto-closes on a
 *    tool pick — the armed tool's next action is always on the plan, and the
 *    open drawer covered ~60% of a phone screen (stray taps landed on drawer
 *    buttons underneath). Closes on: the drawer tool grid (Move, Note, …),
 *    a Counters-list row pick (arm — NOT toggle-off), and Create Counter.
 *    Stays open on non-tool rows (section headers, Legend/Grid overlay
 *    toggles) and on a cancelled picker modal.
 * 2. The header tool strip (.header-tools-scroll) carries right padding in its
 *    scrollable overflow, so at full scroll the last tool rests clear of the
 *    #headerBurger tap zone instead of flush against the clip edge beside it.
 * 3. Coarse-pointer copy swaps: status-bar hints say "Tap …" (desktop keeps
 *    "Click …"), the Set Scale info line says tap, the "(right-click …)"
 *    tooltip suffixes are stripped (static titles at boot, dynamic writers via
 *    withRightClickHint), and the ⇧Q chord chips hide (pointer: coarse CSS).
 * 4. R08: a quick touch tap on the sheet places through the live path (the aim
 *    timer's synthetic click into handleCanvasClick): a Counter marker, Polyline
 *    vertices, a Highlight, a Multiply Zone (whose multiplier stays unfocused on
 *    touch, D22; the mouse focus is pinned by lessons.spec.js and tutorial.spec.js),
 *    and a Note, added and then reopened by a tap on it.
 * 5. R20: a touch drag on a floating palette's title bar (Chain, Drop, Highlights) that the
 *    browser cancels mid-way (pointercancel) unbinds its move handler, so the panel stays
 *    put and a later touch cannot drag it by a stale offset.
 *
 * (The zoom-rail half of B9 — stays until dismissed, no ~5s idle auto-fade —
 * lives in zoom-rail.spec.js.)
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { bootApp, uploadPdf, collectConsoleErrors } = require('./spec-helpers');

const MOBILE = { width: 390, height: 844 };

async function bootWithPdf(page, errors, file = 'test-page.pdf') {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, file));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

const drawerOpen = (page) => page.evaluate(() => document.body.classList.contains('sidebar-open'));
const openDrawer = async (page) => {
  await page.locator('#hamburger').click();
  await expect(page.locator('body')).toHaveClass(/sidebar-open/);
};

test.describe('B9: mobile left drawer auto-closes on tool pick', () => {
  test.use({ viewport: MOBILE });

  test('drawer tool-grid picks close it; non-tool rows and overlay toggles do not', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    await openDrawer(page);

    // Non-tool rows keep the drawer: the Pages collapse toggle …
    await page.locator('#pagesCollapseIcon').click();
    expect(await drawerOpen(page)).toBe(true);
    // … and the Legend / Grid overlay toggles (not tool picks).
    await page.locator('#legendBtnSidebar').click();
    expect(await drawerOpen(page)).toBe(true);
    await page.locator('#legendBtnSidebar').click();   // toggle the legend back off
    expect(await drawerOpen(page)).toBe(true);

    // A tool pick closes it: Move …
    await page.locator('#moveBtnSidebar').click();
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);

    // … and Note (arms TOOL.NOTE, no scale gate).
    await openDrawer(page);
    await page.locator('#noteBtnSidebar').click();
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.NOTE)).toBe(true);

    expect(errors).toEqual([]);
  });

  test('Counters-list row: arming closes the drawer, toggling off keeps it open', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    // Seed one counter through the shared helpers (no UI dance needed here).
    await page.evaluate(() => {
      window.state.counters.push({ id: 'b9-wc', name: 'Water Closet', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' });
      window.App.updateUI();
    });

    await openDrawer(page);
    await page.locator('#countersList .sidebar-item').first().click();
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.COUNTER && window.state.activeCounterType === 'b9-wc')).toBe(true);

    // Toggle-off (tap the active row again) is list management, not a pick —
    // the drawer stays.
    await openDrawer(page);
    await page.locator('#countersList .sidebar-item').first().click();
    expect(await drawerOpen(page)).toBe(true);
    expect(await page.evaluate(() => window.state.activeCounterType)).toBe(null);

    expect(errors).toEqual([]);
  });

  test('Create Counter closes the drawer; a cancelled picker leaves it open', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    // Opening the Counter picker from the drawer arms nothing yet — the
    // drawer waits underneath, so Cancel lands the user back where they were.
    await openDrawer(page);
    await page.locator('#counterBtnSidebar').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    expect(await drawerOpen(page)).toBe(true);
    await page.locator('#counterCancel').click();
    await expect(page.locator('#counterModal')).not.toHaveClass(/visible/);
    expect(await drawerOpen(page)).toBe(true);

    // Create Counter hands the user the pen -> modal AND drawer close.
    await page.locator('#counterBtnSidebar').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    await page.locator('#counterName').fill('Floor Drain');
    await page.locator('#counterCreate').click();
    await expect(page.locator('#counterModal')).not.toHaveClass(/visible/);
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.COUNTER)).toBe(true);

    expect(errors).toEqual([]);
  });
});

test.describe('B9: header tool strip clears the burger button', () => {
  test.use({ viewport: MOBILE });

  test('at full scroll the last tool rests clear of #headerBurger (390 and 768)', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);

    const measure = async () => {
      await page.evaluate(() => {
        const strip = document.querySelector('.header-tools-scroll');
        strip.scrollLeft = strip.scrollWidth;   // clamps to max scroll
      });
      return page.evaluate(() => {
        const strip = document.querySelector('.header-tools-scroll');
        const burger = document.getElementById('headerBurger').getBoundingClientRect();
        let lastRight = -Infinity;
        strip.querySelectorAll('button').forEach((b) => {
          const r = b.getBoundingClientRect();
          if (r.width > 0 && r.right > lastRight) lastRight = r.right;
        });
        return {
          scrollable: strip.scrollWidth > strip.clientWidth,
          clearance: burger.left - lastRight,
          burgerWidth: burger.width,
        };
      });
    };

    // 390: the strip scrolls; at max scroll the last tool's right edge clears
    // the burger by at least its own tap width — nothing can REST under it.
    const phone = await measure();
    expect(phone.scrollable).toBe(true);
    expect(phone.clearance).toBeGreaterThanOrEqual(phone.burgerWidth);

    // 768 (the media query includes 768 exactly): same guarantee — this was
    // the width where Quick Line sat untappable under the burger (J15 F3).
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(200);   // let the resize pipeline settle
    const tablet = await measure();
    expect(tablet.clearance).toBeGreaterThanOrEqual(tablet.burgerWidth);

    expect(errors).toEqual([]);
  });
});

test.describe('B9: coarse-pointer copy swaps', () => {
  // hasTouch flips (pointer: coarse) in Chromium — the app keys every swap on
  // that media feature (App.isCoarsePointer), not on viewport width, so a
  // desktop-sized touch tablet gets trade wording too.
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

  test('touch: "Tap" hints, tap scale copy, no right-click suffixes, no ⇧Q chips', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);

    // Static tooltip suffixes are scrubbed at boot on coarse pointers.
    expect(await page.locator('#gridBtn').getAttribute('title')).toBe('Grid overlay');
    expect(await page.locator('#quickLine').getAttribute('title')).toBe('Quick Line');
    expect(await page.locator('#counterBtnSidebar').getAttribute('title')).toBe('Counter');

    // Set Scale modal copy: tap, not click.
    await page.locator('#setScale').click();
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    expect(await page.locator('#scaleInfo').textContent()).toBe('Tap Select on PDF, then tap two points on the drawing to define a scale line.');
    await page.locator('#scalePresetsCancel').click();   // the modal opens on the Presets tab
    await expect(page.locator('#scaleModal')).not.toHaveClass(/visible/);

    // The ⇧Q chord chip hides on touch; the Quick tab itself stays.
    await page.locator('#counterBtn').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    await expect(page.locator('#counterModal .counter-tab[data-tab="quickcount"]')).toBeVisible();
    await expect(page.locator('#counterModal .counter-tab-shortcut')).toBeHidden();
    await page.locator('#counterCancel').click();

    // Arm a counter -> the status hint talks "Tap", and the dynamic title
    // writer (updateUI) keeps the suffix off.
    await page.evaluate(() => {
      window.state.counters.push({ id: 'b9-touch', name: 'Cleanout', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' });
      window.App.setActiveCounterType('b9-touch');
    });
    expect(await page.locator('#statusMode').textContent()).toContain('Tap to place marker');
    expect(await page.locator('#counterBtn').getAttribute('title')).toBe('Cleanout');

    expect(errors).toEqual([]);
  });
});

test.describe('B9: desktop wording is untouched', () => {
  test('mouse: "Click" hints, right-click suffixes and ⇧Q chips stay', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(false);

    expect(await page.locator('#gridBtn').getAttribute('title')).toBe('Grid overlay (right-click for settings)');

    await page.locator('#counterBtn').click();
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    await expect(page.locator('#counterModal .counter-tab-shortcut')).toBeVisible();
    await page.locator('#counterCancel').click();

    await page.evaluate(() => {
      window.state.counters.push({ id: 'b9-mouse', name: 'Cleanout', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' });
      window.App.setActiveCounterType('b9-mouse');
    });
    expect(await page.locator('#statusMode').textContent()).toContain('Click to place marker');
    expect(await page.locator('#counterBtn').getAttribute('title')).toBe('Cleanout (right-click for settings)');

    expect(errors).toEqual([]);
  });
});

// R08 (2026-09-26): a quick touch tap on the sheet reaches handleCanvasClick through the
// live touch path. A placement tool is an aim tool, so the touchstart starts the aim timer
// and a release before it fires dispatches one synthetic click (a tool that is not an aim
// tool, Move or Edit polyline, rides the long-press timer's click instead).
// Real touches (page.touchscreen, hasTouch) at phone width, one item per tap pair, and no
// duplicate from a compatibility mouse click.
test.describe('R08: a quick touch tap places through the live path', () => {
  test.use({ viewport: MOBILE, hasTouch: true });

  // Client coords of a page fraction, and a check that the canvas is what a finger there touches.
  const pagePt = async (page, fx, fy) => {
    const pt = await page.evaluate(({ fx, fy }) => {
      const s = window.state; const p = s.pages[s.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const r = document.getElementById('canvasWrapper').getBoundingClientRect();
      const x = Math.round(r.left + (vp.width * fx) * s.zoom + s.pan.x), y = Math.round(r.top + (vp.height * fy) * s.zoom + s.pan.y);
      const el = document.elementFromPoint(x, y);
      return { x, y, onCanvas: !!(el && el.closest('#canvasWrapper')) };
    }, { fx, fy });
    expect(pt.onCanvas).toBe(true);
    return pt;
  };
  const ann = (page) => page.evaluate(() => {
    const a = window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations;
    return { markers: (a.counterMarkers['r08-c'] || []).length, highlights: (a.highlights || []).length, notes: (a.notes || []).length };
  });
  const tap = async (page, pt) => { await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(150); };

  test('Counter, Polyline, Highlight, Multiply Zone and Note each take a quick tap', async ({ page }) => {
    const errors = [];
    await bootWithPdf(page, errors);
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);
    // Polyline asks for a scale first.
    await page.evaluate(() => window.App.openScaleModal());
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(() => !!window.state.pages[window.state.currentPage].scale, null, { timeout: 5000 });

    // Counter: one tap, one marker.
    await page.evaluate(() => {
      window.state.counters.push({ id: 'r08-c', name: 'Cleanout', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' });
      window.App.setActiveCounterType('r08-c');
    });
    await tap(page, await pagePt(page, 0.3, 0.3));
    expect((await ann(page)).markers).toBe(1);
    await tap(page, await pagePt(page, 0.35, 0.3));
    expect((await ann(page)).markers).toBe(2);

    // Polyline: each tap is one vertex.
    await page.evaluate(() => {
      window.state.lineTypes.push({ id: 'r08-lt', name: 'Cold', color: '#4a9eff', curveStyle: 'straight' });
      window.state.activeLineTypeId = 'r08-lt';
      document.getElementById('polylineBtn').click();
    });
    expect(await page.evaluate(() => window.state.tool)).toBe(await page.evaluate(() => window.App.TOOL.POLYLINE));
    await tap(page, await pagePt(page, 0.3, 0.5));
    await tap(page, await pagePt(page, 0.5, 0.5));
    await tap(page, await pagePt(page, 0.5, 0.6));
    expect(await page.evaluate(() => (window.state.drawingPolyline?.points || []).length)).toBe(3);
    await page.evaluate(() => document.getElementById('moveBtn').click());

    // Highlight: corner, corner, one highlight.
    await page.evaluate(() => { document.getElementById('highlightBtn').click(); window.App.closeHighlightPanel && window.App.closeHighlightPanel(); });
    await tap(page, await pagePt(page, 0.2, 0.2));
    expect(await page.evaluate(() => !!window.state.highlightStart)).toBe(true);
    await tap(page, await pagePt(page, 0.3, 0.25));
    expect((await ann(page)).highlights).toBe(1);
    expect(await page.evaluate(() => window.state.highlightStart)).toBe(null);

    // Multiply Zone: corner, corner, the dialog opens, and on touch the multiplier is not
    // focused (D22: the on-screen keyboard would cover the preview).
    await page.evaluate(() => document.getElementById('multiplyZoneBtn').click());
    await tap(page, await pagePt(page, 0.6, 0.2));
    await tap(page, await pagePt(page, 0.8, 0.3));
    await expect(page.locator('#multiplyZoneModal')).toHaveClass(/visible/);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe('multiplyZoneMultiplier');
    await page.locator('#multiplyZoneMultiplier').fill('3');
    await page.locator('#multiplyZoneApply').click();
    await page.waitForFunction(() => (window.App.ensureActiveCanvas(window.state.pages[window.state.currentPage]).annotations.multiplyZones || []).some((z) => z.multiplier === 3), null, { timeout: 3000 });

    // Note: a tap on the sheet opens Add Note; a tap on that note opens it for edit.
    await page.evaluate(() => document.getElementById('noteBtn').click());
    const n = await pagePt(page, 0.4, 0.8);
    await tap(page, n);
    await expect(page.locator('#noteModal')).toHaveClass(/visible/);
    expect(await page.locator('#noteModalTitle').textContent()).toBe('Add Note');
    await page.locator('#noteModalText').fill('R08 note');
    await page.locator('#noteModalDone').click();
    expect((await ann(page)).notes).toBe(1);
    await tap(page, n);
    await expect(page.locator('#noteModal')).toHaveClass(/visible/);
    expect(await page.locator('#noteModalTitle').textContent()).toBe('Edit Note');
    expect(await page.locator('#noteModalText').inputValue()).toBe('R08 note');
    await page.locator('#noteModalCancel').click();
    expect((await ann(page)).notes).toBe(1);

    expect(errors).toEqual([]);
  });
});

// R20 (2026-09-26, D43): the three floating palettes (Chain, Drop, Highlights) share one drag
// helper, App.makeFloatingPanel. A touch drag the browser cancels (a system gesture, a palm, an
// incoming call) ends in pointercancel, never pointerup; the helper used to unbind its move
// handler only on pointerup, so the cancelled drag's handler, with its stale offset, stayed on
// the title bar and dragged the panel on any later pointer movement over it. Real touches over
// CDP (touchCancel is what Chromium turns into pointercancel); the head's listeners are read
// with DOMDebugger.getEventListeners, so "no move handler left" is checked, not inferred.
test.describe('R20: a cancelled touch drag on a palette leaves nothing bound', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

  const PALETTES = [
    { tool: 'CHAIN', panel: 'chainPanel', head: 'chainPanelHead', posKey: 'chainPanelPos' },
    { tool: 'DROP', panel: 'dropPanel', head: 'dropPanelHead', posKey: 'dropPanelPos' },
    { tool: 'HIGHLIGHT', panel: 'highlightPanel', head: 'highlightPanelHead', posKey: 'highlightPanelPos' },
  ];

  test('Chain, Drop and Highlights: pointercancel unbinds the move handler and the panel stays put', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page);
    await uploadPdf(page);
    const cdp = await page.context().newCDPSession(page);
    const moveListeners = async (id) => {
      const { result } = await cdp.send('Runtime.evaluate', { expression: `document.getElementById(${JSON.stringify(id)})` });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
      await cdp.send('Runtime.releaseObject', { objectId: result.objectId });
      return listeners.filter((l) => l.type === 'pointermove').length;
    };
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchCancel' || type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const panelAt = (id) => page.evaluate((pid) => {
      const r = document.getElementById(pid).getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top) };
    }, id);

    for (const pal of PALETTES) {
      await page.evaluate((t) => { window.state.tool = window.App.TOOL[t]; window.App.updateUI(); }, pal.tool);
      await expect(page.locator('#' + pal.panel)).toBeVisible();
      const start = await panelAt(pal.panel);
      const box = await page.locator('#' + pal.head).boundingBox();
      const x0 = Math.round(box.x + 60), y0 = Math.round(box.y + 10);

      // A finger lands on the title bar and drags; the move handler is bound and the panel
      // follows the finger (touch moves land a frame later, so poll for the last one).
      await touch('touchStart', x0, y0);
      for (let i = 1; i <= 4; i++) await touch('touchMove', x0 + 40 * i, y0 + 30 * i);
      expect(await moveListeners(pal.head)).toBe(1);
      const moved = { left: start.left + 160, top: start.top + 120 };
      await expect.poll(() => panelAt(pal.panel)).toEqual(moved);

      // The browser cancels the touch: nothing stays bound, and the panel keeps the spot the drag
      // reached, remembered like a drop.
      await touch('touchCancel');
      await expect.poll(() => moveListeners(pal.head)).toBe(0);
      expect(await panelAt(pal.panel)).toEqual(moved);
      expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), pal.posKey)).toEqual({ x: moved.left, y: moved.top });

      // A later pointer movement over the head (no drag started) moves nothing.
      const hb = await page.locator('#' + pal.head).boundingBox();
      await page.evaluate(({ id, x, y }) => {
        document.getElementById(id).dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y }));
      }, { id: pal.head, x: Math.round(hb.x + 5), y: Math.round(hb.y + 300) });
      expect(await panelAt(pal.panel)).toEqual(moved);
    }

    errors.assertNoErrors();
  });
});

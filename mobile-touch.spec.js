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
 *
 * (The zoom-rail half of B9 — stays until dismissed, no ~5s idle auto-fade —
 * lives in zoom-rail.spec.js.)
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const MOBILE = { width: 390, height: 844 };

async function bootWithPdf(page, errors, file = 'test-page.pdf') {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
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

// @ts-check
/**
 * Tests: HEADING-CLICK (2026-09-27). One rule for every sidebar title: a click on it folds
 * or opens that section's list. PAGES, COUNTERS, LINE TYPES and SUMMARY used to open their
 * settings on a title click (only the arrow folded), while Lines, Groups, Duct, Bid Check
 * and Rooms folded, so a new reader could not tell which to expect. Their settings now sit
 * behind a small gear beside the title; the right-click routes on the tool buttons stay.
 *
 * 1. Desktop: each of the four titles folds and opens its list and opens no dialog; the
 *    arrow still folds; the gear opens that section's settings and folds nothing.
 * 2. The right-click menus on Counter, Quick Line and the legend button still open settings.
 * 3. Tablet and phone (touch, coarse pointer): every gear is reachable in the sidebar
 *    drawer, is at least 40 px square, and opens its dialog, Page Settings included (it has
 *    no other entrance).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SECTIONS = [
  { title: '#pagesSectionTitle', icon: '#pagesCollapseIcon', section: '#pagesSection', gear: '#pagesSettingsBtn', modal: '#pageSettingsModal', label: 'Page Settings' },
  { title: '#countersSectionTitle', icon: '#countersCollapseIcon', section: '#countersSection', gear: '#countersSettingsBtn', modal: '#counterSettingsModal', label: 'Counter Settings' },
  { title: '#lineTypesSectionTitle', icon: '#lineTypesCollapseIcon', section: '#lineTypesSection', gear: '#lineTypesSettingsBtn', modal: '#lineTypeSettingsModal', label: 'Line Type Settings' },
  { title: '#summarySectionTitle', icon: '#summaryCollapseIcon', section: '#summarySection', gear: '#summarySettingsBtn', modal: '#legendSettingsModal', label: 'Summary Legend settings' },
];
const MODALS = SECTIONS.map((s) => s.modal);

async function bootWithPdf(page, errors) {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.goto('/app/');
  await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}
const anyModalUp = (page) => page.evaluate((ids) => ids.some((id) => document.querySelector(id).classList.contains('visible')), MODALS);
const closeModal = async (page, modal) => {
  await page.locator(modal + ' [data-modal-close]').first().click();
  await expect(page.locator(modal)).not.toHaveClass(/visible/);
};

test.describe('HEADING-CLICK: every sidebar title folds its list; settings sit behind a gear', () => {
  test('desktop: title and arrow fold, the gear opens settings', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    const errors = [];
    await bootWithPdf(page, errors);

    for (const s of SECTIONS) {
      await expect(page.locator(s.title)).toHaveAttribute('title', 'Click to fold or open the list');
      await expect(page.locator(s.gear)).toHaveAttribute('aria-label', s.label);
      await expect(page.locator(s.section)).not.toHaveClass(/collapsed/);

      // the title folds, then opens, and never opens a dialog
      await page.locator(s.title).click();
      await expect(page.locator(s.section)).toHaveClass(/collapsed/);
      await expect(page.locator(s.icon)).toHaveText('▶');
      expect(await anyModalUp(page)).toBe(false);
      // folded, the gear is still there
      await expect(page.locator(s.gear)).toBeVisible();
      await page.locator(s.title).click();
      await expect(page.locator(s.section)).not.toHaveClass(/collapsed/);
      await expect(page.locator(s.icon)).toHaveText('▼');
      expect(await anyModalUp(page)).toBe(false);

      // the arrow folds too, one toggle per click
      await page.locator(s.icon).click();
      await expect(page.locator(s.section)).toHaveClass(/collapsed/);
      await page.locator(s.icon).click();
      await expect(page.locator(s.section)).not.toHaveClass(/collapsed/);
      expect(await anyModalUp(page)).toBe(false);

      // the gear opens the section's settings and folds nothing
      await page.locator(s.gear).click();
      await expect(page.locator(s.modal)).toHaveClass(/visible/);
      await expect(page.locator(s.section)).not.toHaveClass(/collapsed/);
      await closeModal(page, s.modal);
    }
    expect(errors).toEqual([]);
  });

  test('no tour, lesson or course sends the reader to a heading for its settings', () => {
    const fs = require('fs');
    const files = fs.readdirSync(path.join(__dirname, 'features'))
      .filter((f) => /^(tutorial|lessons|tour-.+|course-.+)\.js$/.test(f)).map((f) => 'features/' + f);
    expect(files.length).toBeGreaterThanOrEqual(6);
    // "click the SUMMARY heading", "the LINE TYPES heading in the sidebar: ... opens", "its heading
    // opens": each sent the reader to a title for settings before. The gear beside it does now.
    // (Both patterns fire on the pre-HEADING-CLICK text of tutorial, lessons, tour-blank and the
    // plumbing and electrical courses.)
    const H = '(SUMMARY|PAGES|COUNTERS|LINE TYPES)';
    const SENDS = new RegExp('(click|tap) the ' + H + ' heading|heading (itself )?opens|' + H + ' heading in the sidebar: [^.]*opens', 'i');
    const LIGHTS = /SettingsModal[^\]]*\]?[^\n]*'#(summary|pages|counters|lineTypes)SectionTitle'\]/;
    const hits = [];
    files.forEach((f) => {
      const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
      if (SENDS.test(src.replace(new RegExp('gear beside (the ' + H + ' |its )heading', 'g'), ''))) hits.push(f + ': a heading sent for settings');
      if (LIGHTS.test(src)) hits.push(f + ': a settings step lights a heading');
    });
    expect(hits).toEqual([]);
  });

  test('the right-click routes to settings stay', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    const errors = [];
    await bootWithPdf(page, errors);
    // the header buttons; a tool tucked behind ⋯ takes the right-click on its More row
    // (tool-context-menu.spec.js rightClickTool)
    const routes = [
      { btn: '#counterBtn', row: 'Counter', item: 'Counter Settings…', modal: '#counterSettingsModal' },
      { btn: '#quickLine', row: 'Quick Line', item: 'Line Type Settings…', modal: '#lineTypeSettingsModal' },
      { btn: '#legendBtn', row: 'legend', item: 'Legend Settings…', modal: '#legendSettingsModal' },
    ];
    for (const r of routes) {
      if (await page.locator(r.btn).isVisible()) await page.locator(r.btn).click({ button: 'right' });
      else {
        await page.locator('#headerMoreBtn').click();
        await page.locator('#headerMoreMenu .hm-row', { hasText: new RegExp(r.row, 'i') }).first().click({ button: 'right' });
      }
      await page.locator('#toolContextMenu button', { hasText: r.item }).click();
      await expect(page.locator(r.modal)).toHaveClass(/visible/);
      await closeModal(page, r.modal);
    }
    expect(errors).toEqual([]);
  });
});

for (const device of [
  { name: 'tablet', viewport: { width: 1024, height: 768 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
]) {
  test.describe('HEADING-CLICK on a ' + device.name, () => {
    test.use({ viewport: device.viewport, hasTouch: true, isMobile: true });

    test('every settings dialog is one tap on its gear away', async ({ page }) => {
      const errors = [];
      await bootWithPdf(page, errors);
      expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);
      const narrow = await page.evaluate(() => window.matchMedia('(max-width: 768px)').matches);
      for (const s of SECTIONS) {
        if (narrow && !(await page.evaluate(() => document.body.classList.contains('sidebar-open')))) {
          await page.locator('#hamburger').tap();
          await expect(page.locator('body')).toHaveClass(/sidebar-open/);
        }
        const gear = page.locator(s.gear);
        await gear.scrollIntoViewIfNeeded();
        await expect(gear).toBeVisible();
        const box = await gear.boundingBox();
        expect(box && box.width).toBeGreaterThanOrEqual(40);
        expect(box && box.height).toBeGreaterThanOrEqual(40);
        await gear.tap();
        await expect(page.locator(s.modal)).toHaveClass(/visible/);
        await closeModal(page, s.modal);
        // and the title still folds on a tap
        await page.locator(s.title).tap();
        await expect(page.locator(s.section)).toHaveClass(/collapsed/);
        await page.locator(s.title).tap();
        await expect(page.locator(s.section)).not.toHaveClass(/collapsed/);
      }
      expect(errors).toEqual([]);
    });
  });
}

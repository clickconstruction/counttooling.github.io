// @ts-check
/**
 * Tests: the Set Scale dialog (#scaleModal) stays inside the viewport on a
 * common laptop screen. Field report (J7 hvac-room-sizing walk): at 1380x900
 * the card grew to ~1109px, flex-centering pushed the title and the tab row
 * ("Select two points") above the top edge (tabs y ≈ -41), nothing could
 * scroll them into view (only the inner presets list scrolled), and clicks
 * aimed at the tabs hit the header toolbar underneath (#legendBtn). The card
 * is now clamped to the viewport with the active tab panel scrolling
 * internally, so the title + tab row are always visible and clickable.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function scaleModalRects(page) {
  return page.evaluate(() => {
    const card = document.querySelector('#scaleModal .modal-card').getBoundingClientRect();
    const tabs = document.querySelector('#scaleModal button[data-tab=points]').getBoundingClientRect();
    const title = document.querySelector('#scaleModal h2').getBoundingClientRect();
    const pick = (r) => ({ top: r.top, bottom: r.bottom, height: r.height });
    return { card: pick(card), tabs: pick(tabs), title: pick(title), vh: window.innerHeight };
  });
}

function expectOnScreen(rects) {
  // The whole card fits in the viewport — top edge on-screen is the point.
  expect(rects.card.top).toBeGreaterThanOrEqual(0);
  expect(rects.card.bottom).toBeLessThanOrEqual(rects.vh);
  expect(rects.title.top).toBeGreaterThanOrEqual(0);
  expect(rects.tabs.top).toBeGreaterThanOrEqual(0);
  expect(rects.tabs.bottom).toBeLessThanOrEqual(rects.vh);
}

test.describe('Set Scale dialog viewport clamp', () => {
  test.use({ viewport: { width: 1380, height: 900 } });

  test('tab row is on-screen and clickable at 900px height, from both entry points', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'samples', 'sample-plan.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 300, { timeout: 10000 });

    // ENTRY 1: toolbar #setScale button (real click).
    await page.locator('#setScale').click();
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    await page.waitForSelector('#scalePresetsList button', { timeout: 5000 });

    expectOnScreen(await scaleModalRects(page));

    // The regression's real victim: a REAL click on the "Select two points"
    // tab. Before the clamp it sat at y ≈ -41 and #legendBtn intercepted the
    // click; Playwright's actionability check fails on either condition.
    await page.locator('#scaleModal button[data-tab=points]').click();
    await expect(page.locator('#scalePointsPanel')).toBeVisible();
    await expect(page.locator('#scalePresetsPanel')).toBeHidden();

    // Presets still reachable: switch back and apply one (list scrolls
    // inside the clamped card).
    await page.locator('#scaleModal button[data-tab=presets]').click();
    await page.locator('#scalePresetsList button').first().click();
    await page.waitForFunction(
      () => !document.getElementById('scaleModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => !!window.state.pages[window.state.currentPage].scale)).toBe(true);

    // ENTRY 2: the sidebar scale readout (clickable once a scale is set).
    await page.locator('#sidebarScaleDisplay').click();
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    expectOnScreen(await scaleModalRects(page));
    await page.locator('#scaleModal button[data-tab=points]').click();
    await expect(page.locator('#scalePointsPanel')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

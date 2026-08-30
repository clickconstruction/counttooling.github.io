// @ts-check
/**
 * Tests: Tier-3 B10 — the legend & proof surface batch (JOURNEY-MAP row B10).
 *
 * - Empty legend (J8): a zero-mark sheet paints NO "No items" box, and the
 *   invisible box is not hittable — a drag there falls through to the sheet
 *   pan. With rows it paints and drags again.
 * - Hit order (J8): the legend paints on top of highlights, so it wins the
 *   hit contest — a legend fully overlapped by a highlight still drags (it
 *   used to be inert, and the failed drag panned the sheet).
 * - Rotation anchor (J18): after R the legend (anchored in page coords) is
 *   walked back fully onto the rotated sheet instead of hanging half off it,
 *   and a right-edge anchor keeps the box's ideal width (no row clipping).
 * - Summary heading tooltip (J8): says what a click does ("Legend settings —
 *   ▼ collapses"), not the lie "Click to collapse".
 * - Footer totals (J18): inline words ("counts" / "of lines"), and clicking
 *   the pair scrolls to + flashes the sidebar Summary (was 2 dead clicks).
 * - R gate (J18): R is ignored while the Count-by-Page modal is open (its
 *   thumbnails never re-render), and works again once it closes.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// Counts non-transparent pixels on the annotation overlay (marks only — the
// PDF paints to its own canvas, so a zero-mark sheet must be fully blank).
function annHasInkFn() {
  const c = /** @type {HTMLCanvasElement} */ (document.getElementById('annCanvas'));
  if (!c || !c.width || !c.height) return false;
  const ctx = c.getContext('2d');
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true;
  }
  return false;
}

/** Seeds one counter with one marker on page 0 (gives the legend a row). */
function seedCounterFn() {
  const s = window.state;
  const uid = window.App.uid;
  const cid = uid();
  // eslint-disable-next-line no-undef
  const icon = (typeof CIRCLE_PATH !== 'undefined') ? CIRCLE_PATH
    : 'M512 320C512 426 426 512 320 512C214 512 128 426 128 320C128 214 214 128 320 128C426 128 512 214 512 320z';
  s.counters.push({ id: cid, name: 'Audit WC', icon, color: '#e8c547' });
  const ann = s.pages[0].canvases[0].annotations;
  ann.counterMarkers[cid] = [{ x: 120, y: 380, id: uid(), group: null }];
  s.currentPage = 0;
  window.App.renderAnnotations();
  window.App.updateUI();
  return cid;
}

test.describe('Tier-3 B10 — legend & proof surface', () => {
  /** @type {string[]} */
  let errors;
  /** @param {import('@playwright/test').Page} page */
  async function boot(page) {
    errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await page.waitForFunction(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      return !!c && c.width > 0;
    });
  }

  // PDF-space -> viewport client coords through the live canvas rect.
  /** @param {import('@playwright/test').Page} page @param {{x:number,y:number}} pdf */
  const screenPointForPdf = (page, pdf) => page.evaluate((p) => {
    const annCanvas = document.getElementById('annCanvas');
    const rect = annCanvas.getBoundingClientRect();
    const bc = window.App.toCanvas(p);
    return {
      x: rect.left + bc.x * (rect.width / annCanvas.width),
      y: rect.top + bc.y * (rect.height / annCanvas.height),
    };
  }, pdf);

  /** @param {import('@playwright/test').Page} page */
  const legendPos = (page) => page.evaluate(() => {
    const l = window.state.pages[0].canvases[0].annotations.legend;
    return l ? { x: l.x, y: l.y, w: l.w, h: l.h } : null;
  });

  test('empty legend paints nothing and is not hittable; rows bring it back (J8)', async ({ page }) => {
    await boot(page);

    // Overlay defaults ON; the legend object exists but has zero rows.
    const before = await page.evaluate(() => ({
      overlayOn: !!window.state.showLegendOverlay,
      legend: window.state.pages[0].canvases[0].annotations.legend,
    }));
    expect(before.overlayOn).toBe(true);
    expect(before.legend).not.toBeNull();

    // 1. Nothing painted: the whole annotation overlay is blank (the old
    //    "No items" box was the only ink on a zero-mark sheet).
    expect(await page.evaluate(annHasInkFn)).toBe(false);

    // 2. Not hittable: a drag inside the (invisible) legend rect falls
    //    through to the sheet pan; the legend does not move.
    const leg0 = await legendPos(page);
    const panBefore = await page.evaluate(() => ({ ...window.state.pan }));
    let pt = await screenPointForPdf(page, { x: leg0.x + 20, y: leg0.y + 8 });
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.move(pt.x - 40, pt.y + 40, { steps: 5 });
    await page.mouse.up();
    const panAfter = await page.evaluate(() => ({ ...window.state.pan }));
    const leg1 = await legendPos(page);
    expect({ x: leg1.x, y: leg1.y }).toEqual({ x: leg0.x, y: leg0.y });
    expect(panAfter.x !== panBefore.x || panAfter.y !== panBefore.y).toBe(true);

    // 3. Seed one marker -> the legend paints and drags again.
    await page.evaluate(seedCounterFn);
    expect(await page.evaluate(annHasInkFn)).toBe(true);
    const leg2 = await legendPos(page);
    pt = await screenPointForPdf(page, { x: leg2.x + 20, y: leg2.y + 8 });
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.move(pt.x - 40, pt.y + 40, { steps: 5 });
    await page.mouse.up();
    const leg3 = await legendPos(page);
    expect(leg3.x).toBeLessThan(leg2.x);
    expect(leg3.y).toBeGreaterThan(leg2.y);

    expect(errors).toEqual([]);
  });

  test('legend wins the hit contest over an overlapping highlight (J8)', async ({ page }) => {
    await boot(page);
    await page.evaluate(seedCounterFn);

    // Cover the legend completely with a highlight.
    await page.evaluate(() => {
      const ann = window.state.pages[0].canvases[0].annotations;
      const l = ann.legend;
      ann.highlights.push({ id: window.App.uid(), x1: l.x - 20, y1: l.y - 20, x2: l.x + l.w + 20, y2: l.y + l.h + 20, color: '#e8c547', opacity: 0.3 });
      window.App.renderAnnotations();
    });

    // Drag on the legend BODY (below the 18pt header strip, clear of the
    // bottom-right resize grip): the legend must move — it used to be inert
    // (the highlight ate the hit) and the failed drag panned the sheet.
    const leg0 = await legendPos(page);
    const panBefore = await page.evaluate(() => ({ ...window.state.pan }));
    const pt = await screenPointForPdf(page, { x: leg0.x + 20, y: leg0.y + 30 });
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.move(pt.x - 50, pt.y + 40, { steps: 5 });
    await page.mouse.up();
    const leg1 = await legendPos(page);
    const panAfter = await page.evaluate(() => ({ ...window.state.pan }));
    expect(leg1.x).toBeLessThan(leg0.x);
    expect(leg1.y).toBeGreaterThan(leg0.y);
    expect(panAfter).toEqual(panBefore);
    // The highlight itself did not move.
    const hl = await page.evaluate(() => window.state.pages[0].canvases[0].annotations.highlights[0]);
    const legNow = await legendPos(page);
    expect(hl.x1).toBe(leg0.x - 20);
    // And a drag OUTSIDE the legend still hits the highlight region (control:
    // hover cursor over the un-overlapped highlight margin is not the pan).
    expect(legNow).not.toBeNull();

    expect(errors).toEqual([]);
  });

  test('R keeps the legend fully on the rotated sheet; right-edge anchor keeps ideal width (J18)', async ({ page }) => {
    await boot(page);
    await page.evaluate(seedCounterFn);

    // Right-edge behavior on the unrotated sheet: the default anchor
    // (pageW - 110) leaves less room than the auto width wants, so the
    // anchor walks left and the box sits fully inside the 10pt margin.
    const fit0 = await page.evaluate(() => {
      const p = window.state.pages[0];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const l = p.canvases[0].annotations.legend;
      return { pageW: vp.width, pageH: vp.height, x: l.x, y: l.y, w: l.w, h: l.h };
    });
    expect(fit0.x + fit0.w).toBeLessThanOrEqual(fit0.pageW - 10);
    expect(fit0.y + fit0.h).toBeLessThanOrEqual(fit0.pageH - 10);

    // Rotate to landscape (sheet widens), park the legend at the far right
    // of the WIDE sheet, then rotate again: the sheet narrows back under the
    // anchor — the legend must be walked back inside the new bounds (it used
    // to hang half off-sheet in exactly this page-coords-anchor case).
    await page.keyboard.press('r');
    await page.waitForFunction(() => (window.state.pages[0].rotation ?? 0) === 90);
    await page.evaluate(() => {
      const p = window.state.pages[0];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const l = p.canvases[0].annotations.legend;
      l.x = vp.width - l.w - 10;   // far right of the landscape sheet
      window.App.renderAnnotations();
    });
    const parked = await page.evaluate(() => {
      const p = window.state.pages[0];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const l = p.canvases[0].annotations.legend;
      return { pageW: vp.width, x: l.x, w: l.w };
    });
    expect(parked.x + parked.w).toBeLessThanOrEqual(parked.pageW - 10);
    await page.keyboard.press('r');
    await page.waitForFunction(() => (window.state.pages[0].rotation ?? 0) === 180);
    await page.evaluate(() => window.App.renderAnnotations());
    const fit180 = await page.evaluate(() => {
      const p = window.state.pages[0];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const l = p.canvases[0].annotations.legend;
      return { pageW: vp.width, pageH: vp.height, x: l.x, y: l.y, w: l.w, h: l.h };
    });
    // The 180° sheet is narrower than the parked anchor was — the legend
    // must sit fully on-sheet again, at unreduced width.
    expect(fit180.pageW).toBeLessThan(parked.pageW);
    expect(fit180.x).toBeGreaterThanOrEqual(0);
    expect(fit180.y).toBeGreaterThanOrEqual(0);
    expect(fit180.x + fit180.w).toBeLessThanOrEqual(fit180.pageW - 10);
    expect(fit180.y + fit180.h).toBeLessThanOrEqual(fit180.pageH - 10);
    expect(fit180.w).toBeCloseTo(parked.w, 6);

    expect(errors).toEqual([]);
  });

  test('Summary heading tooltip says what a click does (J8)', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#summarySectionTitle')).toHaveAttribute('title', 'Legend settings — ▼ collapses');
    // The heading still opens Legend Settings (the tooltip now tells the truth).
    await page.locator('#summarySectionTitle').click();
    await expect(page.locator('#legendSettingsModal')).toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('footer totals carry inline words and click scrolls/flashes the Summary (J18)', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await boot(page);
    await page.evaluate(seedCounterFn);

    const totals = page.locator('#statusTotals');
    await expect(totals).toBeVisible();
    const text = await totals.textContent();
    expect(text).toContain('counts');
    expect(text).toContain('of lines');
    const title = await totals.getAttribute('title');
    expect(title).toContain('click to see the Summary');

    // Wide bar: the words are visible. Narrow bar: the words hide (CSS) so
    // the compact pair keeps the status bar on one line — the full words
    // stay in the tooltip.
    await expect(totals.locator('.status-totals-words').first()).toBeVisible();
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(totals.locator('.status-totals-words').first()).toBeHidden();
    await expect(totals).toBeVisible();
    await page.setViewportSize({ width: 1600, height: 800 });

    // Click -> the Summary section flashes (and the sidebar is not collapsed).
    await totals.click();
    await expect(page.locator('#summarySection')).toHaveClass(/summary-flash/);
    expect(await page.evaluate(() => document.body.classList.contains('sidebar-collapsed'))).toBe(false);

    expect(errors).toEqual([]);
  });

  test('R is ignored while the Count-by-Page modal is open (J18)', async ({ page }) => {
    await boot(page);
    const cid = await page.evaluate(seedCounterFn);

    await page.evaluate((id) => { window.App.openSummaryCountDetailModal('counter', id); }, cid);
    await page.waitForSelector('#summaryCountDetailModal.visible', { timeout: 5000 });

    // R under the modal: the sheet must NOT rotate beneath the proof thumbnails.
    await page.keyboard.press('r');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.state.pages[0].rotation ?? 0)).toBe(0);

    // Close the modal -> R works again.
    await page.locator('#summaryCountDetailClose').click();
    await page.waitForFunction(() => !document.getElementById('summaryCountDetailModal').classList.contains('visible'));
    await page.keyboard.press('r');
    await page.waitForFunction(() => (window.state.pages[0].rotation ?? 0) === 90);

    expect(errors).toEqual([]);
  });
});

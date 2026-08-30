// @ts-check
/**
 * Tests: the toast-system contract (#toastRegion, JOURNEY-MAP Tier-2 #15).
 *
 * Every toast surface (#setScaleFirstModal, #outOfBoundsModal,
 * #pipeToolingCopiedModal, #airboardToastModal) is a passive corner card in
 * one stacked region: z-index 350 (paints above every modal), pointer-events
 * none (blocks nothing — .toast-interactive is the per-card opt-in, the
 * T2-06 hook), honest flex stacking for simultaneous toasts, and Escape is
 * never consumed by a toast (the ladder goes straight to real modals/tools).
 * Ids and .visible semantics are unchanged, so showModal/hideModal and every
 * existing spec selector keep working.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
}

// A canvas click point safely inside the page bounds (the letter-size test
// page does not fill the wrapper, so the wrapper center can sit outside it).
async function pointInPage(page, fx, fy) {
  const box = await page.locator('#canvasWrapper').boundingBox();
  const pt = await page.evaluate(([fracX, fracY]) => {
    const p = window.state.pages[window.state.currentPage];
    const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
    const z = window.state.zoom, pan = window.state.pan;
    return { x: vp.width * fracX * z + pan.x, y: vp.height * fracY * z + pan.y };
  }, [fx, fy]);
  return { x: box.x + pt.x, y: box.y + pt.y };
}

test.describe('Toast region (non-blocking toasts + honest stacking)', () => {
  test('a live toast blocks nothing: canvas takes clicks and a counter mark lands', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
      s.counters.push({ id: 'c-toast', name: 'Toast Counter', icon: 'M96 96h448v448H96z', color: '#e8c547' });
      s.activeCounterType = 'c-toast';
      s.tool = window.App.TOOL.COUNTER;
      window.App.updateUI();
      window.App.showToast('non-blocking test toast', 3000);
    });
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);

    // Hit-testing at canvas center reaches the canvas stack, not the toast.
    const pt = await pointInPage(page, 0.5, 0.5);
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return { id: el?.id, inWrapper: !!el?.closest('#canvasWrapper'), inToast: !!el?.closest('#toastRegion') };
    }, [pt.x, pt.y]);
    expect(hit.inWrapper).toBe(true);
    expect(hit.inToast).toBe(false);

    // A real click during the toast places the counter mark (the J3 eaten-click bug).
    await page.mouse.click(pt.x, pt.y);
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/); // still up
    const placed = await page.evaluate(() =>
      (window.state.pages[0].canvases[0].annotations.counterMarkers['c-toast'] || []).length);
    expect(placed).toBe(1);

    // Nothing dims: the region never paints a backdrop.
    const bg = await page.evaluate(() => getComputedStyle(document.getElementById('toastRegion')).backgroundColor);
    expect(bg).toBe('rgba(0, 0, 0, 0)');
    expect(errors).toEqual([]);
  });

  test('toasts paint above open modals (z-order contract)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    await page.evaluate(() => {
      window.App.showModal('counterModal');
      window.App.showToast('above-modal test toast', 4000);
    });
    await expect(page.locator('#counterModal')).toHaveClass(/visible/);
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);

    // The card's box is on-screen and inside the region's fixed corner slot.
    const card = await page.locator('#airboardToastModal').boundingBox();
    expect(card.width).toBeGreaterThan(0);
    expect(card.height).toBeGreaterThan(0);

    // elementFromPoint skips pointer-events:none nodes, so prove paint order
    // through the production opt-in: with .toast-interactive on the card, the
    // topmost hit at the card center must be the toast, NOT the full-screen
    // modal overlay under it (z 350 over z 200).
    const hitInteractive = await page.evaluate(() => {
      const cardEl = document.getElementById('airboardToastModal');
      cardEl.classList.add('toast-interactive');
      const r = cardEl.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      cardEl.classList.remove('toast-interactive');
      return { inToast: !!el?.closest('#airboardToastModal'), id: el?.id || el?.tagName };
    });
    expect(hitInteractive.inToast).toBe(true);

    // Without the opt-in the same point falls through to the modal overlay —
    // painting above never means blocking.
    const hitPassive = await page.evaluate(() => {
      const r = document.getElementById('airboardToastModal').getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { inToast: !!el?.closest('#airboardToastModal'), inModal: !!el?.closest('#counterModal') };
    });
    expect(hitPassive.inToast).toBe(false);
    expect(hitPassive.inModal).toBe(true);

    await page.evaluate(() => window.App.hideModal('counterModal'));
    expect(errors).toEqual([]);
  });

  test('two simultaneous toasts stack without overlap, each on its own timer', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    await page.evaluate(() => {
      window.App.showOutOfBoundsToast();            // 2s timer
      window.App.showToast('stacking test toast', 4000); // its own 4s timer
    });
    await expect(page.locator('#outOfBoundsModal')).toHaveClass(/visible/);
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);

    const a = await page.locator('#outOfBoundsModal').boundingBox();
    const b = await page.locator('#airboardToastModal').boundingBox();
    const intersect = a.x < b.x + b.width && b.x < a.x + a.width &&
      a.y < b.y + b.height && b.y < a.y + a.height;
    expect(intersect).toBe(false);

    // The 2s toast dismisses on its own; the 4s toast outlives it.
    await page.waitForFunction(() => !document.getElementById('outOfBoundsModal').classList.contains('visible'), { timeout: 4000 });
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);
    await page.waitForFunction(() => !document.getElementById('airboardToastModal').classList.contains('visible'), { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('pointer-events contract: region none, cards inherit, .toast-interactive opts in (T2-06 hook)', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    const pe = await page.evaluate(() => {
      const region = document.getElementById('toastRegion');
      const card = document.getElementById('airboardToastModal');
      const regionPe = getComputedStyle(region).pointerEvents;
      const cardPe = getComputedStyle(card).pointerEvents;
      card.classList.add('toast-interactive');
      const interactivePe = getComputedStyle(card).pointerEvents;
      card.classList.remove('toast-interactive');
      return { regionPe, cardPe, interactivePe };
    });
    expect(pe.regionPe).toBe('none');
    expect(pe.cardPe).toBe('none');
    expect(pe.interactivePe).toBe('auto');
    expect(errors).toEqual([]);
  });

  test('Escape is never eaten by a toast: one press reaches the open modal; the toast self-dismisses', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page);

    await page.evaluate(() => {
      window.App.showToast('escape test toast', 2500);
      window.App.openScaleModal();
    });
    await expect(page.locator('#scaleModal')).toHaveClass(/visible/);
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);

    // ONE Escape closes the real modal — the toast no longer sits on a ladder rung.
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await expect(page.locator('#scaleModal')).not.toHaveClass(/visible/);
    await expect(page.locator('#airboardToastModal')).toHaveClass(/visible/);

    // …and still dismisses on its own timer.
    await page.waitForFunction(() => !document.getElementById('airboardToastModal').classList.contains('visible'), { timeout: 4000 });
    expect(errors).toEqual([]);
  });
});

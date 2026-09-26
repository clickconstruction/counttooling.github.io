// @ts-check
/**
 * Tests: the window.App registry pilot #10 - the Counter settings modal extracted
 * to features/counter-settings.js still wires up and applies its settings live.
 *
 * First two-region consolidation (the opener/close/reorder + the separate value-
 * handlers section merged into one feature file). Two new publish-only deps
 * (renderAnnotations, renderCountersList). Guards the registry failure modes
 * (entry point never registered; bindings fire before the registry is populated)
 * plus the moved opener, a value slider, the show-rings toggle (+ ring section
 * show/hide), and the close handler.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Counter settings modal', () => {
  test('registry wired; settings apply live and close works with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: the entry point + the 2 new publish-only deps.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openCounterSettingsModal,
      renderAnn: typeof window.App?.renderAnnotations,
      renderCounters: typeof window.App?.renderCountersList,
    }));
    expect(wired).toEqual({ open: 'function', renderAnn: 'function', renderCounters: 'function' });

    // 3. Open via the registry.
    await page.evaluate(() => window.App.openCounterSettingsModal());
    await page.waitForSelector('#counterSettingsModal.visible', { timeout: 5000 });

    // 4. SLIDER: counter size -> 40, dispatch input so the live val + state update.
    await page.evaluate(() => {
      const s = document.getElementById('counterSize');
      s.value = '40';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await page.locator('#counterSizeVal').textContent()).toBe('40');
    expect(await page.evaluate(() => window.state.counterSettings.size)).toBe(40);

    // 5. TOGGLE: flip show-rings via its button; state flips and the ring
    //    section's display follows.
    const before = await page.evaluate(() => !!window.state.counterSettings.showRings);
    await page.locator('#counterShowRingsBtn').click();
    const after = await page.evaluate(() => ({
      state: !!window.state.counterSettings.showRings,
      ringDisplayed: document.getElementById('counterRingSection').style.display !== 'none',
    }));
    expect(after.state).toBe(!before);
    expect(after.ringDisplayed).toBe(after.state);

    // 6. CLOSE dismisses the modal.
    await page.locator('#counterSettingsClose').click();
    await page.waitForFunction(
      () => !document.getElementById('counterSettingsModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );

    expect(errors).toEqual([]);
  });

  // MAP-RING-DEFAULT: the ring size default was 1, under the Ring size slider's minimum
  // of 50, so the dialog showed "1" beside a slider sitting at 50 (and a ring at 1% of
  // the marker draws nothing). Every slider's number is the value its slider sits at, on
  // a fresh device and on one that stored the old 1 (MAP-SETTINGS persisted it).
  test('every slider shows the number it sits at, on a fresh device and over a stored ring size of 1', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    const boot = async () => page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    const shownVsSlider = () => page.evaluate(() => {
      window.App.openCounterSettingsModal();
      const out = {};
      ['counterSize', 'counterOpacity', 'counterOutline', 'counterNumberSize', 'counterRingSize', 'counterRingOpacity'].forEach((id) => {
        out[id] = { shown: document.getElementById(id + 'Val').textContent, slider: /** @type {HTMLInputElement} */ (document.getElementById(id)).value };
      });
      window.App.hideModal('counterSettingsModal');
      return { out, ringSize: window.state.counterSettings.ringSize };
    });
    const expectMatched = (res) => {
      Object.entries(res.out).forEach(([id, v]) => expect(v.shown, id).toBe(v.slider));
      expect(res.out.counterRingSize.shown).toBe('100');
      expect(res.ringSize).toBe(100);
    };

    await page.goto('/app/');
    await boot();
    await page.evaluate(() => { localStorage.removeItem('counterSettings'); });
    await page.reload();
    await boot();
    expectMatched(await shownVsSlider());

    // A device that saved its settings while the default was 1 reads the default.
    await page.evaluate(() => { localStorage.setItem('counterSettings', JSON.stringify({ size: 30, showRings: true, ringSize: 1 })); });
    await page.reload();
    await boot();
    const stored = await shownVsSlider();
    expectMatched(stored);
    expect(stored.out.counterSize.shown).toBe('30');
    expect(await page.evaluate(() => window.state.counterSettings.showRings)).toBe(true);

    expect(errors).toEqual([]);
  });
});

// @ts-check
/**
 * Tests: the Hide-marks header toggle (#hideMarksBtn).
 *
 * All marks render onto the single annotation overlay (#annCanvas) layered over
 * the PDF canvas, so toggleHideMarks flips state.hideMarks and renderAnnotations
 * sizes + clears the overlay then early-returns (bare PDF shows through). This is
 * purely visual — the annotation data is untouched.
 *
 * The test loads a 2-page PDF, injects a counter with 5 markers, and asserts at
 * the PIXEL level that the overlay is painted when shown and fully transparent
 * when hidden — plus the icon swap (eye <-> eye-slash), aria/title state, that the
 * marker data survives the toggle, and that the hidden state persists across page
 * navigation. The button is clicked for real (header is visible to everyone).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// Counts non-transparent pixels on the annotation overlay. Returns true once any
// ink is found (the PDF renders to a separate canvas, so #annCanvas holds only
// marks — vector paths, never tainting images — so getImageData is safe).
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

test.describe('Hide-marks header toggle', () => {
  test('eye toggle blanks/restores the overlay, swaps icon, preserves data, persists across nav', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Hidden before a PDF is loaded.
    await expect(page.locator('#hideMarksBtn')).toBeHidden();

    // 2. Load a 2-page PDF -> button appears, default state is "marks shown".
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await expect(page.locator('#hideMarksBtn')).toBeVisible();

    const initial = await page.evaluate(() => ({
      hideMarks: window.state.hideMarks,
      pressed: document.getElementById('hideMarksBtn').getAttribute('aria-pressed'),
      title: document.getElementById('hideMarksBtn').getAttribute('title'),
      showIconVisible: document.getElementById('hideMarksIconShow').style.display !== 'none',
      hideIconVisible: document.getElementById('hideMarksIconHide').style.display !== 'none',
    }));
    expect(initial.hideMarks).toBeFalsy();
    expect(initial.pressed).toBe('false');
    expect(initial.title).toBe('Hide marks');
    expect(initial.showIconVisible).toBe(true);
    expect(initial.hideIconVisible).toBe(false);

    // 3. Inject a counter with 5 markers on page 1's active canvas and paint.
    const injected = await page.evaluate(() => {
      const s = window.state;
      const uid = window.App.uid;
      const cid = uid();
      // eslint-disable-next-line no-undef
      const icon = (typeof CIRCLE_PATH !== 'undefined') ? CIRCLE_PATH
        : 'M512 320C512 426 426 512 320 512C214 512 128 426 128 320C128 214 214 128 320 128C426 128 512 214 512 320z';
      s.counters.push({ id: cid, name: 'Spec Counter', icon, color: '#e8c547', size: 16 });
      const ann = s.pages[0].canvases[0].annotations;
      ann.counterMarkers[cid] = [
        { x: 120, y: 140, id: uid(), group: null },
        { x: 260, y: 240, id: uid(), group: null },
        { x: 200, y: 360, id: uid(), group: null },
        { x: 340, y: 300, id: uid(), group: null },
        { x: 160, y: 460, id: uid(), group: null },
      ];
      s.currentPage = 0;
      window.App.renderAnnotations();
      return { cid, markers: ann.counterMarkers[cid].length };
    });
    expect(injected.markers).toBe(5);
    expect(await page.evaluate(annHasInkFn)).toBe(true); // marks painted

    // 4. Real click -> overlay blanks, icon swaps, state flips, data preserved.
    await page.locator('#hideMarksBtn').click();
    const hidden = await page.evaluate((cid) => ({
      hideMarks: window.state.hideMarks,
      pressed: document.getElementById('hideMarksBtn').getAttribute('aria-pressed'),
      title: document.getElementById('hideMarksBtn').getAttribute('title'),
      active: document.getElementById('hideMarksBtn').classList.contains('active'),
      showIconVisible: document.getElementById('hideMarksIconShow').style.display !== 'none',
      hideIconVisible: document.getElementById('hideMarksIconHide').style.display !== 'none',
      markersStillInState: window.state.pages[0].canvases[0].annotations.counterMarkers[cid].length,
    }), injected.cid);
    expect(hidden.hideMarks).toBe(true);
    expect(await page.evaluate(annHasInkFn)).toBe(false); // overlay fully transparent
    expect(hidden.markersStillInState).toBe(5);           // data untouched (purely visual)
    expect(hidden.pressed).toBe('true');
    expect(hidden.title).toBe('Show marks');
    expect(hidden.active).toBe(true);
    expect(hidden.showIconVisible).toBe(false);
    expect(hidden.hideIconVisible).toBe(true);

    // 5. Hidden state persists across page navigation (every render checks the flag).
    await page.locator('#nextPage').click();
    await page.waitForFunction(() => window.state.currentPage === 1);
    await page.locator('#prevPage').click();
    await page.waitForFunction(() => window.state.currentPage === 0);
    const afterNav = await page.evaluate(() => ({
      hideMarks: window.state.hideMarks,
      pressed: document.getElementById('hideMarksBtn').getAttribute('aria-pressed'),
    }));
    expect(afterNav.hideMarks).toBe(true);
    expect(afterNav.pressed).toBe('true');
    await page.waitForFunction(() => {
      const c = document.getElementById('annCanvas');
      if (!c || !c.width) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) return false; }
      return true;
    }, { timeout: 5000 }); // overlay still blank on page 1 after nav

    // 6. Toggle back -> marks restored on page 1, icon/title reset.
    await page.locator('#hideMarksBtn').click();
    const shown = await page.evaluate(() => ({
      hideMarks: window.state.hideMarks,
      title: document.getElementById('hideMarksBtn').getAttribute('title'),
      showIconVisible: document.getElementById('hideMarksIconShow').style.display !== 'none',
    }));
    expect(shown.hideMarks).toBe(false);
    expect(shown.title).toBe('Hide marks');
    expect(shown.showIconVisible).toBe(true);
    expect(await page.evaluate(annHasInkFn)).toBe(true); // marks painted again

    expect(errors).toEqual([]);
  });

  test('hidden marks do not catch the mouse: drag cannot move a note, context menu inert', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    await expect(page.locator('#hideMarksBtn')).toBeVisible();

    // Inject a note on page 1's active canvas (same shape as the Note modal's
    // add path) and a PDF-point -> client-point mapper (live zoom + pan).
    await page.evaluate(() => {
      const s = window.state;
      s.tool = window.App.TOOL.NONE;
      const page0 = s.pages[0];
      const canvas = window.App.ensureActiveCanvas(page0);
      canvas.annotations.notes = canvas.annotations.notes || [];
      canvas.annotations.notes.push({
        x: 200, y: 200, text: 'Anchor note', id: window.App.uid(),
        width: 150, fontSize: 14, placementRotation: page0.rotation ?? 0, color: '#e8c547',
      });
      s.currentPage = 0;
      window.App.renderAnnotations();
      window.__pdfToClient = (px, py) => {
        const r = document.getElementById('canvasWrapper').getBoundingClientRect();
        return { x: r.left + px * s.zoom + s.pan.x, y: r.top + py * s.zoom + s.pan.y };
      };
    });

    const notePos = () => page.evaluate(() => {
      const n = window.App.ensureActiveCanvas(window.state.pages[0]).annotations.notes[0];
      return { x: n.x, y: n.y };
    });
    // Drag from inside the note's text body (local +60,+7 — clear of the
    // font-size and width handles) by 32pt in PDF space.
    const dragOnNote = async () => {
      const { x, y } = await notePos();
      const from = await page.evaluate(([px, py]) => window.__pdfToClient(px, py), [x + 60, y + 7]);
      const to = await page.evaluate(([px, py]) => window.__pdfToClient(px, py), [x + 60 + 32, y + 7 + 32]);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 5 });
      await page.mouse.up();
    };

    // CONTROL (marks shown): the same drag DOES move the note — proves the
    // coordinates actually target it, so the hidden assertion can't pass by
    // missing the target.
    const p0 = await notePos();
    await dragOnNote();
    const p1 = await notePos();
    expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeGreaterThan(20);

    // Hide marks -> the invisible note must not catch the mouse.
    await page.locator('#hideMarksBtn').click();
    await page.waitForFunction(() => window.state.hideMarks === true);

    // The identical drag while hidden must NOT move the note (it pans instead).
    await dragOnNote();
    const p2 = await notePos();
    expect(p2).toEqual(p1);

    // Hover over the (hidden) note: no move cursor, no legend-resize hover.
    const hover = await page.evaluate(([px, py]) => window.__pdfToClient(px, py), [p1.x + 60, p1.y + 7]);
    await page.mouse.move(hover.x, hover.y);
    const hoverState = await page.evaluate(() => ({
      cursor: document.getElementById('annCanvas').style.cursor,
      hoverLegendResize: window.state.hoverLegendResize,
    }));
    expect(hoverState.cursor).not.toBe('move');
    expect(hoverState.hoverLegendResize).toBe(false);

    // Right-click on the hidden note: context targeting is inert.
    const ctxPt = await page.evaluate(([px, py]) => window.__pdfToClient(px, py), [p1.x + 60, p1.y + 7]);
    await page.mouse.click(ctxPt.x, ctxPt.y, { button: 'right' });
    const ctx = await page.evaluate(() => ({
      target: window.state.ctxTarget,
      menuVisible: document.getElementById('contextMenu').classList.contains('visible'),
    }));
    expect(ctx.target).toBeNull();
    expect(ctx.menuVisible).toBe(false);

    // Re-show -> position unchanged, and the same drag moves it again
    // (the target is still there and drag mechanics still work).
    await page.locator('#hideMarksBtn').click();
    await page.waitForFunction(() => window.state.hideMarks === false);
    const p3 = await notePos();
    expect(p3).toEqual(p1);
    await dragOnNote();
    const p4 = await notePos();
    expect(Math.hypot(p4.x - p3.x, p4.y - p3.y)).toBeGreaterThan(20);

    expect(errors).toEqual([]);
  });
});

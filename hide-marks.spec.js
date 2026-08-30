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

  // T2-03: hide-marks means the sheet is read-only-bare — hitTest early-returns
  // null while hidden, so invisible marks can't be dragged, right-clicked,
  // dblclick-edited, or hover-cursored. With marks shown everything behaves as
  // before (control assertions).
  test('hidden marks are inert to the mouse', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // Inject a note, a counter marker, and a legend on page 1's active canvas.
    await page.evaluate(() => {
      const s = window.state;
      const uid = window.App.uid;
      const cid = uid();
      // eslint-disable-next-line no-undef
      const icon = (typeof CIRCLE_PATH !== 'undefined') ? CIRCLE_PATH
        : 'M512 320C512 426 426 512 320 512C214 512 128 426 128 320C128 214 214 128 320 128C426 128 512 214 512 320z';
      s.counters.push({ id: cid, name: 'Inert Counter', icon, color: '#e8c547', size: 16 });
      const ann = s.pages[0].canvases[0].annotations;
      ann.counterMarkers[cid] = [{ x: 120, y: 380, id: uid(), group: null }];
      ann.notes.push({ x: 200, y: 200, text: 'Hidden note', id: uid(), width: 150, fontSize: 14, placementRotation: 0, color: '#e8c547' });
      ann.legend = { x: 350, y: 20, w: 100, h: 56 };
      s.currentPage = 0;
      window.App.renderAnnotations();
      window.App.updateUI();
    });

    // PDF-space -> viewport client coords through the live canvas rect (the
    // mapping tracks pan/zoom, so recompute after any pan).
    const screenPointForPdf = (pdf) => page.evaluate((p) => {
      const annCanvas = document.getElementById('annCanvas');
      const rect = annCanvas.getBoundingClientRect();
      const bc = window.App.toCanvas(p);
      return {
        x: rect.left + bc.x * (rect.width / annCanvas.width),
        y: rect.top + bc.y * (rect.height / annCanvas.height),
      };
    }, pdf);
    const notePos = () => page.evaluate(() => {
      const n = window.state.pages[0].canvases[0].annotations.notes[0];
      return { x: n.x, y: n.y };
    });
    const legendPos = () => page.evaluate(() => {
      const l = window.state.pages[0].canvases[0].annotations.legend;
      return { x: l.x, y: l.y };
    });
    const NOTE_BODY = { x: 230, y: 206 };    // inside the note's text box, clear of both handles
    const LEGEND_HEADER = { x: 400, y: 28 }; // inside the legend header drag strip

    // Hide marks.
    await page.locator('#hideMarksBtn').click();
    await page.waitForFunction(() => window.state.hideMarks === true);

    // (a) Real drag at the hidden note: the note must not move — the gesture
    // falls through to the normal sheet pan instead.
    const panBefore = await page.evaluate(() => ({ ...window.state.pan }));
    let pt = await screenPointForPdf(NOTE_BODY);
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.move(pt.x + 40, pt.y + 40, { steps: 5 });
    await page.mouse.up();
    const panAfter = await page.evaluate(() => ({ ...window.state.pan }));
    expect(await notePos()).toEqual({ x: 200, y: 200 });
    expect(panAfter.x !== panBefore.x || panAfter.y !== panBefore.y).toBe(true);

    // Same for the hidden legend header.
    pt = await screenPointForPdf(LEGEND_HEADER);
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.move(pt.x + 30, pt.y + 30, { steps: 5 });
    await page.mouse.up();
    expect(await legendPos()).toEqual({ x: 350, y: 20 });

    // (b) Right-click on the hidden note: no per-mark context menu.
    pt = await screenPointForPdf(NOTE_BODY);
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    expect(await page.evaluate(() => ({
      menuVisible: document.getElementById('contextMenu').classList.contains('visible'),
      ctxTarget: window.state.ctxTarget,
    }))).toEqual({ menuVisible: false, ctxTarget: null });

    // Dblclick on the hidden note: no note editor.
    await page.mouse.dblclick(pt.x, pt.y);
    expect(await page.evaluate(() => document.getElementById('noteModal').classList.contains('visible'))).toBe(false);

    // (c) Hover over the hidden note: no move cursor.
    pt = await screenPointForPdf(NOTE_BODY);
    await page.mouse.move(pt.x, pt.y);
    expect(await page.evaluate(() => document.getElementById('annCanvas').style.cursor)).not.toBe('move');

    // Control: show marks again — the same interactions come back.
    await page.locator('#hideMarksBtn').click();
    await page.waitForFunction(() => window.state.hideMarks === false);

    // Hover now shows the move cursor over the note.
    pt = await screenPointForPdf(NOTE_BODY);
    await page.mouse.move(pt.x, pt.y);
    expect(await page.evaluate(() => document.getElementById('annCanvas').style.cursor)).toBe('move');

    // Right-click now opens the per-mark menu on the note.
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    expect(await page.evaluate(() => ({
      menuVisible: document.getElementById('contextMenu').classList.contains('visible'),
      ctxType: window.state.ctxTarget && window.state.ctxTarget.type,
    }))).toEqual({ menuVisible: true, ctxType: 'note' });
    await page.evaluate(() => {   // dismiss (same statements the app's dismissers run)
      document.getElementById('contextMenu').classList.remove('visible');
      window.state.ctxTarget = null;
    });

    // The same drag now moves the note.
    pt = await screenPointForPdf(NOTE_BODY);
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.move(pt.x + 40, pt.y + 40, { steps: 5 });
    await page.mouse.up();
    const moved = await notePos();
    expect(moved.x).toBeGreaterThan(200);
    expect(moved.y).toBeGreaterThan(200);

    expect(errors).toEqual([]);
  });
});

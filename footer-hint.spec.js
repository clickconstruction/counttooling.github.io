// @ts-check
/**
 * Tests: the status-bar tool hint ("Click start point" etc., features/status-bar.js)
 * only rides when the bar stays on ONE line. On narrow layouts the bar
 * flex-wraps; a long project name + hint used to shove the right-side actions
 * onto a second row (field feedback 2026-08-14). Guards both directions and
 * the wrap measurement's (text @ width) cache key across resizes.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, collectConsoleErrors, uploadPdf } = require('./spec-helpers');

async function bootWithLineTool(page) {
  await bootApp(page);
  await uploadPdf(page, 'test-page.pdf');
  await page.evaluate(() => {
    const s = window.state;
    s.currentProjectName = 'MF-P0002_PCT_IPRP-ChapterI Long Project Name For Wrap Test';
    s.lineTypes = [{ id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' }];
    s.activeLineTypeId = 'lt1';
    s.tool = window.App.TOOL.LINE;
    window.App.updateUI();
    window.App.updateStatus();
  });
}

test.describe('Status-bar tool hint (one-line-only)', () => {
  test('wide bar shows the hint; narrow bar drops it instead of wrapping the actions', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootWithLineTool(page);
    await expect(page.locator('#statusMode')).toContainText('Click start point');

    // Desktop-width borderline case (the >768px regime is where the bar
    // wraps): the name + hint overflow the row, the name alone fits — so
    // dropping the hint is exactly what keeps the bar on one line. (1050px,
    // not 1000: B4's status-bar links grew — "quick keys | shortcuts" — which
    // moved this borderline by ~50px.)
    await page.setViewportSize({ width: 1050, height: 800 });
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).not.toContainText('Click start point');
    // The right-side actions stayed on the same row as the mode text.
    const sameRow = await page.evaluate(() => {
      const mode = document.getElementById('statusMode');
      const actions = document.getElementById('statusBarActions');
      return actions.offsetTop <= mode.offsetTop;
    });
    expect(sameRow).toBe(true);

    // Widening again brings the hint back (cache key includes the bar width).
    await page.setViewportSize({ width: 1600, height: 800 });
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).toContainText('Click start point');
  });
});

// Live length readout while drawing (T2 #21): the LINE/POLYLINE tool hints
// grow a running feet-inches readout (Measure formatting, px fallback), and
// the wrap cache keys on a fixed worst-case placeholder so a growing number
// never re-measures or wraps the bar mid-draw.
async function bootForReadout(page, { scale = { pixelsPerUnit: 9, unit: 'ft' } } = {}) {
  await bootApp(page);
  await uploadPdf(page, 'test-page.pdf');
  await page.evaluate((sc) => {
    const s = window.state;
    s.currentProjectName = 'Readout';
    s.pages[0].scale = sc;
    s.lineTypes = [{ id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' }];
    s.activeLineTypeId = 'lt1';
    s.tool = window.App.TOOL.LINE;
    window.App.updateUI();
    window.App.updateStatus();
  }, scale);
}

test.describe('Live length readout while drawing (T2 #21)', () => {
  // A mouse reads "Click", a finger "Tap" (B9): Measure and Line said "Tap" to a mouse
  // until 2026-09-24, the one line a new estimator reads mid-way through Prove the scale.
  test('the hint says Click to a mouse and Tap to a finger, for Line and Measure alike', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootWithLineTool(page);
    const mode = page.locator('#statusMode');
    const set = (tool, coarse) => page.evaluate(([t, c]) => {
      const s = window.state;
      s.currentProjectName = 'plan';
      s.tool = window.App.TOOL[t];
      s.scaleMode = window.App.SCALE_MODES.POINT_A;
      if (!window.__realCoarse) window.__realCoarse = window.App.isCoarsePointer;
      window.App.isCoarsePointer = c ? () => true : window.__realCoarse;
      window.App.updateUI(); window.App.updateStatus();
    }, [tool, coarse]);
    await set('MEASURE', false);
    await expect(mode).toContainText('Click first point (or hold to aim)');
    await set('LINE', false);
    await expect(mode).toContainText('Click start point');
    await set('MEASURE', true);
    await expect(mode).toContainText('Tap first point (or hold to aim)');
    await set('LINE', true);
    await expect(mode).toContainText('Tap start point');
  });

  test('quick line shows live feet-inches readout', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootForReadout(page);
    await expect(page.locator('#statusMode')).toContainText('Click start point');

    await page.evaluate(() => {
      window.state.quickLineStart = { x: 0, y: 0 };
      window.state.mousePos = { x: 90, y: 0 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Click end point: 10\'-0"');

    // Moving the cursor updates the readout live.
    await page.evaluate(() => {
      window.state.mousePos = { x: 45, y: 0 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Click end point: 5\'-0"');
  });

  test('polyline readout is cumulative', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootForReadout(page);
    await page.evaluate(() => {
      const s = window.state;
      s.tool = window.App.TOOL.POLYLINE;
      s.drawingPolyline = { id: 'p1', name: 'Run', color: '#47c88e', points: [{ x: 0, y: 0 }, { x: 90, y: 0 }], closed: false, lineTypeId: 'lt1', group: null };
      s.mousePos = { x: 90, y: 90 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Click to add points: 20\'-0"');
  });

  test('no scale reads px, never feet', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 800 });
    await bootForReadout(page, { scale: null });
    await page.evaluate(() => {
      window.state.quickLineStart = { x: 0, y: 0 };
      window.state.mousePos = { x: 90, y: 0 };
      window.App.updateStatus();
    });
    const text = await page.locator('#statusMode').textContent();
    expect(text).toMatch(/: \d+ px/);
    expect(text).not.toMatch(/\d+'-\d+"/);
  });

  test('narrow bar still drops the whole hint', async ({ page }) => {
    await page.setViewportSize({ width: 1900, height: 800 });
    await bootWithLineTool(page);
    await page.evaluate(() => {
      window.state.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft' };
      window.state.quickLineStart = { x: 0, y: 0 };
      window.state.mousePos = { x: 90, y: 0 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Click end point: 10\'-0"');

    // The borderline-width regime from the wrap test (1050px since B4's wider
    // status-bar links): the long project name alone fits, name + hint
    // doesn't — hint AND readout drop together.
    await page.setViewportSize({ width: 1050, height: 800 });
    await page.evaluate(() => window.App.updateStatus());
    await expect(page.locator('#statusMode')).not.toContainText('Click end point');
    // The worst-case key keeps the verdict stable while the cursor moves.
    await page.evaluate(() => {
      window.state.mousePos = { x: 200, y: 0 };
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).not.toContainText('Click end point');
    const sameRow = await page.evaluate(() => {
      const mode = document.getElementById('statusMode');
      const actions = document.getElementById('statusBarActions');
      return actions.offsetTop <= mode.offsetTop;
    });
    expect(sameRow).toBe(true);
  });
});

test.describe('Distance chip (#statusMeasure, T2 #15)', () => {
  test('measure result rides the footer, outlives the old 5s toast, follows its sheet, and is replaced by a new measure', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page, { viewport: { width: 1600, height: 800 } });
    await uploadPdf(page);

    await page.evaluate(() => {
      window.state.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
      document.getElementById('measureBtn').click();
    });
    const box = await page.locator('#canvasWrapper').boundingBox();
    const pts = await page.evaluate(() => {
      const p = window.state.pages[window.state.currentPage];
      const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
      const z = window.state.zoom, pan = window.state.pan;
      const y = (vp.height / 2) * z + pan.y;
      return [
        { x: vp.width * 0.25 * z + pan.x, y },
        { x: vp.width * 0.75 * z + pan.x, y },
        { x: vp.width * 0.25 * z + pan.x, y: y + 40 * z },
      ];
    });
    // No wait between the clicks: the double-tap guard is positional, so a fast
    // second click on a DIFFERENT point must complete the measure (the time-only
    // guard silently swallowed it — field feedback 2026-08-31).
    await page.mouse.click(box.x + pts[0].x, box.y + pts[0].y);
    await page.mouse.click(box.x + pts[1].x, box.y + pts[1].y);

    // The result rides both surfaces: a non-blocking 5s toast (glanceable at the
    // point of attention) and the persistent footer chip.
    const chip = page.locator('#statusMeasure');
    await expect(chip).toBeVisible();
    const firstText = await chip.textContent();
    expect(firstText).toMatch(/^Distance: /);
    expect(await page.evaluate(() => document.getElementById('airboardToastModal').classList.contains('visible'))).toBe(true);
    expect(await page.evaluate(() => document.getElementById('airboardToastText').textContent)).toContain('Distance');

    // Still shown after 6s — the chip outlives the 5s toast and stays while you work.
    await page.waitForTimeout(6000);
    await expect(chip).toBeVisible();
    expect(await chip.textContent()).toBe(firstText);
    expect(await page.evaluate(() => document.getElementById('airboardToastModal').classList.contains('visible'))).toBe(false);

    // Page flip hides it (a fact about that sheet); flipping back shows it again.
    await page.locator('#nextPage').click();
    await page.waitForFunction(() => window.state.currentPage === 1, { timeout: 5000 });
    await expect(chip).toBeHidden();
    await page.locator('#prevPage').click();
    await page.waitForFunction(() => window.state.currentPage === 0, { timeout: 5000 });
    await expect(chip).toBeVisible();
    expect(await chip.textContent()).toBe(firstText);

    // A new measure replaces it (again with no waits between the clicks).
    await page.evaluate(() => { document.getElementById('measureBtn').click(); });
    await page.mouse.click(box.x + pts[0].x, box.y + pts[0].y);
    await page.mouse.click(box.x + pts[2].x, box.y + pts[2].y);
    await expect(chip).toBeVisible();
    const secondText = await chip.textContent();
    expect(secondText).toMatch(/^Distance: /);
    expect(secondText).not.toBe(firstText);

    errors.assertNoErrors();
  });

  test('double-tap guard swallows only same-spot taps — Measure and Set Scale', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await bootApp(page, { viewport: { width: 1600, height: 800 } });
    await uploadPdf(page);

    // Synchronous dispatch guarantees the taps land well inside the 400ms window.
    const measured = await page.evaluate(() => {
      window.state.pages[0].scale = { pixelsPerUnit: 10, unit: 'ft' };
      document.getElementById('measureBtn').click();
      const wrap = document.getElementById('canvasWrapper');
      const rect = wrap.getBoundingClientRect();
      const click = (fx, fy) => {
        const p = window.state.pages[0];
        const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
        const x = rect.left + vp.width * fx * window.state.zoom + window.state.pan.x;
        const y = rect.top + vp.height * fy * window.state.zoom + window.state.pan.y;
        for (const type of ['mousedown', 'mouseup', 'click']) {
          wrap.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
        }
      };
      click(0.25, 0.5);            // point A
      click(0.25, 0.5);            // same-spot double-tap: must be swallowed
      const afterDoubleTap = { scaleMode: window.state.scaleMode, lastMeasure: window.state.lastMeasure || null };
      click(0.75, 0.5);            // fast but clearly elsewhere: completes A -> B
      return { afterDoubleTap, lastMeasure: window.state.lastMeasure, tool: window.state.tool };
    });
    // The double-tap did NOT complete a zero-length measure; the far click did.
    expect(measured.afterDoubleTap.scaleMode).toBe(2); // SCALE_MODES.POINT_B — still waiting
    expect(measured.afterDoubleTap.lastMeasure).toBe(null);
    expect(measured.lastMeasure.text).toMatch(/^Distance: /);
    expect(measured.lastMeasure.text).not.toBe('Distance: 0"');
    expect(measured.tool).toBe(0); // TOOL.NONE — measure completed

    // Same guard on the Set Scale tool: a same-spot double-tap must not open the
    // scale modal with a zero-length reference line.
    const scaled = await page.evaluate(() => {
      document.getElementById('setScale').click();          // opens the Scale modal
      document.getElementById('scaleSelectOnPdf').click();  // arms TOOL.SCALE / POINT_A
      const wrap = document.getElementById('canvasWrapper');
      const rect = wrap.getBoundingClientRect();
      const click = (fx, fy) => {
        const p = window.state.pages[0];
        const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
        const x = rect.left + vp.width * fx * window.state.zoom + window.state.pan.x;
        const y = rect.top + vp.height * fy * window.state.zoom + window.state.pan.y;
        for (const type of ['mousedown', 'mouseup', 'click']) {
          wrap.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
        }
      };
      click(0.25, 0.5);
      click(0.25, 0.5);
      const afterDoubleTap = {
        scaleMode: window.state.scaleMode,
        modalOpen: document.getElementById('scaleModal').classList.contains('visible'),
      };
      click(0.75, 0.5);
      return { afterDoubleTap, modalOpen: document.getElementById('scaleModal').classList.contains('visible') };
    });
    expect(scaled.afterDoubleTap.scaleMode).toBe(2);
    expect(scaled.afterDoubleTap.modalOpen).toBe(false);
    expect(scaled.modalOpen).toBe(true);

    errors.assertNoErrors();
  });
});

// MAP-HINTS (2026-09-26, the map's D01): signed in, the bar showed no tool hint and no live
// readout at all; the ladder was composed only in the signed-out branch. The first three tests
// reach the signed-in composition through the seam local-save-signal.spec.js uses (a session
// object on state, with the committed config's SUPABASE_ENABLED), so CI without dev-auth
// secrets covers it; the last one signs in for real and self-skips without DEV_AUTH_*.
async function bootSignedInSeam(page, { width = 1600, height = 800 } = {}) {
  await bootApp(page, { viewport: { width, height } });
  if (!(await page.evaluate(() => !!window.App.SUPABASE_ENABLED))) return false;
  await uploadPdf(page, 'test-page.pdf');
  await page.evaluate(() => {
    const s = window.state;
    s.currentProjectName = 'Signed-in plan';
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft' };
    s.lineTypes = [{ id: 'lt1', name: '2in Waste', color: '#47c88e', curveStyle: 'straight' }];
    s.activeLineTypeId = 'lt1';
    s.supabaseSession = { user: { id: 'test-user', email: 'test@clickplumbing.com' } };
    window.App.updateUI();
    window.App.updateStatus();
  });
  return true;
}

test.describe('Signed-in bar shows the tool hint and live readouts (MAP-HINTS)', () => {
  test('Line, Duct and Measure hints ride the signed-in bar, readout and all, with no leading bar', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    if (!(await bootSignedInSeam(page))) { test.skip(true, 'Supabase disabled in this config'); return; }
    const mode = page.locator('#statusMode');
    // Signed in: the Canvas label is the cloud branch's, and Move shows no hint.
    await expect(page.locator('#statusCanvasLabel')).toContainText('Canvas');
    expect(await mode.textContent()).not.toContain('Signed-in plan');

    await page.evaluate(() => { window.state.tool = window.App.TOOL.LINE; window.App.updateUI(); window.App.updateStatus(); });
    await expect(mode).toHaveText('Click start point');
    await page.evaluate(() => {
      window.state.quickLineStart = { x: 0, y: 0 };
      window.state.mousePos = { x: 90, y: 0 };
      window.App.updateStatus();
    });
    await expect(mode).toHaveText('Click end point: 10\'-0"');
    await page.evaluate(() => { window.state.mousePos = { x: 45, y: 0 }; window.App.updateStatus(); });
    await expect(mode).toHaveText('Click end point: 5\'-0"');

    // The duct trace: "S = size" and the pounds, the one on-screen mention of the key.
    await page.evaluate(() => {
      const s = window.state;
      s.quickLineStart = null;
      s.tool = window.App.TOOL.DUCT;
      window.__realDuctReadout = window.App.ductLiveReadout;
      window.App.ductLiveReadout = () => '24×12 · 38\'-6" · 267 lb · run 1,196 lb';
      window.App.updateStatus();
    });
    await expect(mode).toHaveText('Click to trace duct · S = size: 24×12 · 38\'-6" · 267 lb · run 1,196 lb');
    // An autosave in flight changes the labels beside the mode, not the hint.
    await page.evaluate(() => {
      window.__realSaving = window.App.isSaveInProgress;
      window.App.isSaveInProgress = () => true;
      window.App.updateStatus();
    });
    await expect(page.locator('#statusCanvasLabel')).toHaveText('Canvas Uploading...');
    await expect(mode).toContainText('S = size');
    await page.evaluate(() => {
      window.App.isSaveInProgress = window.__realSaving;
      window.App.ductLiveReadout = window.__realDuctReadout;
      window.state.tool = window.App.TOOL.MEASURE;
      window.state.scaleMode = window.App.SCALE_MODES.POINT_A;
      window.App.updateUI();
      window.App.updateStatus();
    });
    await expect(mode).toHaveText('Click first point (or hold to aim)');
    errors.assertNoErrors();
  });

  test('a signed-in viewer\'s line stays exactly as it was, Measure armed or not', async ({ page }) => {
    if (!(await bootSignedInSeam(page))) { test.skip(true, 'Supabase disabled in this config'); return; }
    const mode = page.locator('#statusMode');
    const set = (tool, email) => page.evaluate(([t, e]) => {
      const s = window.state;
      s.isViewer = true;
      s.lastSavedAt = null;
      s.checkedOutEmail = e;
      s.tool = window.App.TOOL[t];
      s.scaleMode = window.App.SCALE_MODES.POINT_A;
      window.App.updateStatus();
    }, [tool, email]);
    await set('NONE', null);
    await expect(mode).toHaveText('Viewing, Available (check out to edit)');
    await set('MEASURE', null);
    await expect(mode).toHaveText('Viewing, Available (check out to edit)');
    await set('MEASURE', 'estimator@clickplumbing.com');
    await expect(mode).toHaveText('Viewing, estimator@clickplumbing.com is editing');
  });

  test('from laptop to phone the signed-in hint never costs the bar a row or overflows it', async ({ page }) => {
    if (!(await bootSignedInSeam(page, { width: 1500, height: 900 }))) { test.skip(true, 'Supabase disabled in this config'); return; }
    await page.evaluate(() => {
      const s = window.state;
      s.counters = [{ id: 'c1', name: 'Water Closet', icon: window.App.getOrderedIcons()[0].value, color: '#e8c547' }];
      const ann = window.App.getActiveAnnotations(s.pages[0]);
      ann.counterMarkers.c1 = [{ x: 50, y: 50, id: 'm1' }];
      s.tool = window.App.TOOL.DUCT;
      window.App.ductLiveReadout = () => '24×12 · 38\'-6" · 267 lb · run 1,196 lb';
      window.App.invalidateFooterTotals();
      window.App.updateUI();
    });
    // Each width is read twice: Move (no hint, the bar as main renders it signed in) and the
    // duct trace. The hint may be dropped, never allowed to push the actions down a row.
    const sample = async (width, saving) => {
      await page.setViewportSize({ width, height: 900 });
      return page.evaluate((sv) => {
        const s = window.state, App = window.App;
        App.isSaveInProgress = () => sv;
        const m = document.getElementById('statusMode');
        const a = document.getElementById('statusBarActions');
        const bar = m.parentElement;
        s.tool = App.TOOL.NONE;
        App.updateStatus();
        const bareH = bar.offsetHeight;
        s.tool = App.TOOL.DUCT;
        App.updateStatus();
        return {
          hint: (m.textContent || '').includes('S = size'),
          noNewRow: bar.offsetHeight <= bareH,
          actionsBesideMode: a.offsetTop <= m.offsetTop,
          oneLineBare: bareH < 40,
          noOverflow: document.documentElement.scrollWidth <= window.innerWidth && bar.scrollWidth <= bar.clientWidth + 1,
        };
      }, saving);
    };
    const rows = [];
    for (const w of [1600, 1500, 1300, 1150, 1000, 900, 800, 769, 600, 414, 375]) {
      for (const saving of [false, true]) rows.push({ w, saving, ...(await sample(w, saving)) });
    }
    expect(rows.filter((r) => !r.noNewRow || !r.noOverflow), JSON.stringify(rows)).toEqual([]);
    // Where the bare bar is one line, it stays one line (the 2026-08-14 contract).
    expect(rows.filter((r) => r.oneLineBare && !r.actionsBesideMode), JSON.stringify(rows)).toEqual([]);
    // Wide, the hint is there in both label states (the fit key carries the labels).
    // "Wide" is 1600, not 1500 (fix(ci), 2026-09-27): at 1500 the uploading labels leave the
    // duct hint's worst-case key only ~12px (1%) of a 1256px bar on a Mac, and Linux draws
    // DM Sans about 2% wider (the CI trace's frames: the same bar's text runs ~10px longer by
    // the totals chip), so CI dropped the hint there correctly, with no new row and no
    // overflow, while this line wanted it. 1600 leaves ~110px. 1500 idle keeps ~80px.
    expect(rows.find((r) => r.w === 1600 && !r.saving).hint, JSON.stringify(rows)).toBe(true);
    expect(rows.find((r) => r.w === 1600 && r.saving).hint, JSON.stringify(rows)).toBe(true);
    expect(rows.find((r) => r.w === 1500 && !r.saving).hint, JSON.stringify(rows)).toBe(true);
    // On a phone the mode has a zero flex basis and ellipsizes, so the hint takes no room
    // and rides; the signed-in bar's second row there is the sync labels' own, hint or not.
    for (const w of [414, 375]) expect(rows.find((r) => r.w === w && !r.saving).hint, JSON.stringify(rows)).toBe(true);
  });

  test('signed in for real (dev auth): the Line hint and its live readout', async ({ page }) => {
    await bootApp(page, { url: '/app/?devAuth=1', viewport: { width: 1600, height: 800 } });
    const signedIn = await page.waitForFunction(() => !!window.state?.supabaseSession?.user, null, { timeout: 8000 }).catch(() => null);
    if (!signedIn) { test.skip(true, 'Dev auth not configured or failed; set DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD in config.local.js'); return; }
    await page.evaluate(() => { if (window.App.isRestorePromptPending && window.App.isRestorePromptPending()) window.App.dismissLastSessionRestorePrompt(); });
    // Open a plan and mark nothing, so no autosave creates a cloud project.
    await uploadPdf(page, 'test-page.pdf', { waitForPages: false });
    const opened = () => page.waitForFunction(() => window.state.pages.length === 1 && !document.querySelector('.modal-overlay.visible'), null, { timeout: 30000 });
    const door = await Promise.race([
      page.locator('#loadAnnotationsModal.visible').waitFor({ timeout: 30000 }).then(() => 'loadAnnotations'),
      page.locator('#preparePdfModal.visible').waitFor({ timeout: 30000 }).then(() => 'prepare'),
      opened().then(() => 'open'),
    ]);
    if (door === 'loadAnnotations') await page.locator('#loadAnnotationsSkip').click();
    else if (door === 'prepare') await page.locator('#preparePdfDone').click();
    await opened();
    await page.evaluate(() => {
      const s = window.state;
      s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft' };
      s.tool = window.App.TOOL.LINE;
      s.quickLineStart = { x: 0, y: 0 };
      s.mousePos = { x: 90, y: 0 };
      window.App.updateUI();
      window.App.updateStatus();
    });
    await expect(page.locator('#statusMode')).toContainText('Click end point: 10\'-0"');
  });
});

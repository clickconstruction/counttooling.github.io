// @ts-check
/**
 * Reproduction + regression for the "pages rotated under the canvas" share bug.
 *
 * Builds a PDF that carries an intrinsic /Rotate 90 (the architectural-sheet case),
 * loads it, places a marker, rotates the page (which BAKES the marker into the rotated
 * frame and stamps page.bakeFrame), then reconstructs the project the way a view-link
 * viewer does (App.buildPagesFromPdfArrayBufferAndProjectData) and asserts:
 *   (a) the intrinsic /Rotate is captured and page.rotation round-trips,
 *   (b) a faithful reconstruct produces NO bake-frame mismatch (no false warning),
 *   (c) a reconstruct whose saved bakeFrame disagrees with the loaded PDF DOES warn
 *       (page.bakeMismatch + a console warning) — the detector that turns a silent
 *       unusable share into a visible one.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Rotation share round-trip + bake-frame guard', () => {
  test('intrinsic /Rotate is stamped, rotation round-trips, and a frame mismatch is detected', async ({ page }) => {
    const pageErrors = [];
    const bakeWarns = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.text().includes('[bakeFrame]')) bakeWarns.push(m.text()); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // Generate a /Rotate-90 PDF in-browser via the vendored PDFLib; keep the bytes.
    const pdfBytes = await page.evaluate(async () => {
      const { PDFDocument, degrees } = window.PDFLib;
      const doc = await PDFDocument.create();
      const p = doc.addPage([612, 792]);
      p.drawRectangle({ x: 40, y: 40, width: 532, height: 712, borderWidth: 2 });
      p.setRotation(degrees(90));
      return Array.from(await doc.save());
    });

    // EDITOR: load the PDF cleanly, place a marker, rotate the page; capture the save snapshot.
    const editor = await page.evaluate(async (bytesArr) => {
      const s = window.state, App = window.App;
      const buf = new Uint8Array(bytesArr).buffer;
      await App.buildPagesFromPdfArrayBufferAndProjectData(buf, { counters: [], lineTypes: [], pages: [] });
      s.currentPage = 0;
      const pg = s.pages[0];
      const intrinsic = pg.pdfPage.rotate;
      const cid = 'rt';
      s.counters.push({ id: cid, name: 'RT', icon: 'M0 0 H10 V10 H0 Z', color: '#e8c547' });
      pg.canvases[0].annotations.counterMarkers[cid] = [{ x: 120, y: 300, n: 1 }];
      App.renderPdf();
      return { intrinsic, rotationBefore: pg.rotation };
    }, pdfBytes);

    expect(editor.intrinsic).toBe(90);        // the fixture really carries an intrinsic /Rotate
    expect(editor.rotationBefore).toBe(0);

    // Rotate the page via the real UI button (bakes the marker, sets page.rotation).
    await page.click('#rotatePage');

    const snapshot = await page.evaluate(() => {
      const s = window.state, pg = s.pages[0];
      const vp = pg.pdfPage.getViewport({ scale: 1, rotation: pg.rotation ?? 0 });
      const bakeFrame = { w: Math.round(vp.width), h: Math.round(vp.height), intrinsic: pg.pdfPage.rotate ?? 0 };
      const marker = pg.canvases[0].annotations.counterMarkers.rt[0];
      // the exact per-page shape the cloud/auto-save serializes (incl. the new bakeFrame)
      const savedPage = { index: 0, label: pg.label, canvases: JSON.parse(JSON.stringify(pg.canvases)), scale: pg.scale, rotation: pg.rotation ?? 0, bakeFrame };
      return { rotation: pg.rotation, bakeFrame, marker: { x: marker.x, y: marker.y }, savedPage, counters: JSON.parse(JSON.stringify(s.counters)) };
    });

    expect(snapshot.rotation).toBe(90);                 // rotation applied
    expect(snapshot.bakeFrame.intrinsic).toBe(90);      // stamp records the intrinsic /Rotate
    // at rotation 90 the page dims swap (612x792 -> ~792x612)
    expect(snapshot.bakeFrame.w).toBeGreaterThan(snapshot.bakeFrame.h);

    // VIEWER (faithful): reconstruct with the correct bakeFrame -> marker preserved, NO warning.
    const ok = await page.evaluate(async ({ bytesArr, savedPage, counters }) => {
      const App = window.App, s = window.state;
      const buf = new Uint8Array(bytesArr).buffer;
      await App.buildPagesFromPdfArrayBufferAndProjectData(buf, { counters, lineTypes: [], pages: [savedPage] });
      const pg = s.pages[0];
      const m = pg.canvases[0].annotations.counterMarkers.rt[0];
      return { rotation: pg.rotation, bakeMismatch: !!pg.bakeMismatch, marker: { x: m.x, y: m.y } };
    }, { bytesArr: pdfBytes, savedPage: snapshot.savedPage, counters: snapshot.counters });

    expect(ok.rotation).toBe(90);                        // rotation round-trips
    expect(ok.marker.x).toBeCloseTo(snapshot.marker.x, 3);
    expect(ok.marker.y).toBeCloseTo(snapshot.marker.y, 3);
    expect(ok.bakeMismatch).toBe(false);                 // faithful reconstruct: no false warning
    expect(bakeWarns).toEqual([]);

    // VIEWER (mismatched): a saved bakeFrame that disagrees with the loaded PDF -> detected.
    const bad = await page.evaluate(async ({ bytesArr, savedPage, counters }) => {
      const App = window.App, s = window.state;
      const corrupt = JSON.parse(JSON.stringify(savedPage));
      corrupt.bakeFrame = { w: savedPage.bakeFrame.w + 100, h: savedPage.bakeFrame.h, intrinsic: savedPage.bakeFrame.intrinsic };
      const buf = new Uint8Array(bytesArr).buffer;
      await App.buildPagesFromPdfArrayBufferAndProjectData(buf, { counters, lineTypes: [], pages: [corrupt] });
      return { bakeMismatch: !!s.pages[0].bakeMismatch };
    }, { bytesArr: pdfBytes, savedPage: snapshot.savedPage, counters: snapshot.counters });

    expect(bad.bakeMismatch).toBe(true);                 // the detector fires
    expect(bakeWarns.length).toBeGreaterThan(0);         // and logs

    expect(pageErrors).toEqual([]);
  });

  // Guard against false positives on real PDFs: a faithful multi-page round-trip (one page
  // rotated, one not) through the real upload + viewer-reconstruct path must NOT warn.
  test('faithful multi-page reconstruct on a real PDF produces no false warning', async ({ page }) => {
    const pageErrors = [];
    const bakeWarns = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.text().includes('[bakeFrame]')) bakeWarns.push(m.text()); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });

    // markers on both pages; rotate only page 0
    await page.evaluate(() => {
      const s = window.state;
      s.counters.push({ id: 'm', name: 'M', icon: 'M0 0 H10 V10 H0 Z', color: '#e8c547' });
      s.pages[0].canvases[0].annotations.counterMarkers.m = [{ x: 50, y: 60, n: 1 }];
      s.pages[1].canvases[0].annotations.counterMarkers.m = [{ x: 30, y: 40, n: 2 }];
      s.currentPage = 0;
    });
    await page.click('#rotatePage');

    // build the save-shape snapshot (incl. per-page bakeFrame, exactly as the save does)
    const d = await page.evaluate(() => {
      const s = window.state;
      return {
        counters: JSON.parse(JSON.stringify(s.counters)),
        rotations: s.pages.map(p => p.rotation ?? 0),
        pages: s.pages.map((p, i) => {
          const vp = p.pdfPage.getViewport({ scale: 1, rotation: p.rotation ?? 0 });
          return { index: i, label: p.label, canvases: JSON.parse(JSON.stringify(p.canvases)), scale: p.scale, rotation: p.rotation ?? 0, bakeFrame: { w: Math.round(vp.width), h: Math.round(vp.height), intrinsic: p.pdfPage.rotate ?? 0 } };
        })
      };
    });
    expect(d.rotations).toEqual([90, 0]);   // page 0 rotated, page 1 not

    // viewer reconstruct from the SAME PDF bytes (fetched fresh) + the saved snapshot
    const res = await page.evaluate(async (dd) => {
      const App = window.App, s = window.state;
      const buf = await (await fetch('/test-2pages.pdf')).arrayBuffer();
      await App.buildPagesFromPdfArrayBufferAndProjectData(buf, { counters: dd.counters, lineTypes: [], pages: dd.pages });
      return { rotations: s.pages.map(p => p.rotation ?? 0), mismatches: s.pages.map(p => !!p.bakeMismatch) };
    }, d);

    expect(res.rotations).toEqual([90, 0]);        // per-page rotation round-trips independently
    expect(res.mismatches).toEqual([false, false]); // no false warning on either page
    expect(bakeWarns).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

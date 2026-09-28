(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // PDF bundling helpers (report/notes/highlights -> jsPDF) -- extracted from
  // app.js via the window.App registry. Consumed by features/export-pdfs.js and
  // app.js's download/export flows via App.*. buildReportHtml/html2canvas are
  // runtime globals resolved at export time (after report.js loads). Shared
  // deps are read from App.* at call time (never captured at load).
  //
  // R25 (2026-09-26): the ONE page raster -> JPEG -> jsPDF pipeline lives here.
  // rasterPageCanvas / rasterPageJpeg render a sheet (plan + marks) and
  // addImagePage puts it on a jsPDF page, plain or captioned with its layer
  // name. runSpecificPagesExport (moved from features/export-pdfs.js) builds a
  // whole export on those two, and both the Export PDFs dialog and the header
  // Download (features/output.js downloadCurrentPageAsPdf) call it through
  // App.runSpecificPagesExport. Where the two callers always differed, the
  // difference is an option, never unified: Download's ensureActiveCanvas per
  // sheet, its caption on a single-layer sheet (all-canvases), its skip of a
  // sheet with no layers (all-pages-canvases) and its "plan" progress word
  // (all-pages). The notes and highlights bundles render each sheet once per
  // export (a one-sheet memo) instead of once per note or highlight.
  //
  // BUNDLE-ONE-SHEET (2026-09-27, DECOMPOSITION_MAP S05): the two bundle
  // builders share collectBundleItems (every layer, like the sidebar buttons
  // and the Summary), cropSheetJpeg and addBundleSummary (page-overflow guard
  // for both tables). Both take doc = null and make their own A4; a doc they
  // are given always gets a new page first, so a one-sheet export no longer
  // prints the summary over the sheet. The sidebar Highlight / Note Pages (PDF)
  // buttons call them through App.openBundlePdf (features/output.js).

  // Pure page-slicer for the rendered report raster (B5, J10): cut the tall
  // html2canvas raster into page-height slices, but never through a row.
  // keepRanges are the keep-together bands ({ top, bottom } in canvas px —
  // table rows + headings, measured from the DOM before rasterizing). A cut
  // that would land inside a band is pulled up to the band's top so the whole
  // row lands on the next page. Bands taller than a page can't be kept whole
  // and are ignored (the cut falls where it falls, as before).
  function computeReportSliceBounds(totalH, pageH, keepRanges) {
    const ranges = (keepRanges || [])
      .filter(r => r && r.bottom - r.top > 0 && r.bottom - r.top <= pageH)
      .slice()
      .sort((a, b) => a.top - b.top);
    const slices = [];
    let y = 0;
    while (y < totalH) {
      let end = Math.min(y + pageH, totalH);
      if (end < totalH) {
        for (const rg of ranges) {
          if (rg.top >= end) break;
          if (rg.bottom > end) {
            // First band straddling the cut (ranges don't overlap). Snap the
            // cut to its exact top — adjacent rows tile at fractional px, so
            // flooring would shave the previous row's bottom edge. Skip the
            // snap when the band started at/before this slice's start
            // (guarantees forward progress); rounding happens at draw time.
            if (rg.top > y) end = rg.top;
            break;
          }
        }
      }
      slices.push({ y, h: end - y });
      y = end;
    }
    return slices;
  }

  // Diagnostics from the last addReportPagesToPdf run ({ totalH, pageHeightPx,
  // keepRanges, slices }) — read by pdf-bundle.spec.js to assert no slice
  // boundary lands inside a measured row. Reassigned per run, so published as
  // a getter (registry rules).
  let lastReportPagination = null;

  async function addReportPagesToPdf(doc) {
    if (typeof window.buildReportHtml !== 'function' || typeof html2canvas !== 'function') return 0;
    const html = window.buildReportHtml();
    if (!html) return 0;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;left:-9999px;width:210mm;height:297mm;';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    await new Promise(r => setTimeout(r, 100));
    const body = iframeDoc.body;
    if (!body) { document.body.removeChild(iframe); return 0; }
    const scale = 2;
    // Measure the keep-together bands (table rows + headings) in canvas px
    // BEFORE rasterizing — html2canvas maps CSS px 1:1 at `scale`.
    const bodyRect = body.getBoundingClientRect();
    const keepRanges = [];
    body.querySelectorAll('tr, h1, h2').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height <= 0) return;
      keepRanges.push({ top: (r.top - bodyRect.top) * scale, bottom: (r.bottom - bodyRect.top) * scale });
    });
    const reportCanvas = await html2canvas(body, { scale, useCORS: true, logging: false });
    document.body.removeChild(iframe);
    const A4_W = 210, A4_H = 297;
    const pxPerMm = (96 / 25.4) * scale;
    const pageHeightPx = Math.floor(A4_H * pxPerMm);
    const totalH = reportCanvas.height;
    const slices = computeReportSliceBounds(totalH, pageHeightPx, keepRanges);
    lastReportPagination = { totalH, pageHeightPx, keepRanges, slices };
    let pageCount = 0;
    for (const { y, h } of slices) {
      const sliceH = Math.max(1, Math.round(h));
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = reportCanvas.width;
      sliceCanvas.height = sliceH;
      const sctx = sliceCanvas.getContext('2d');
      sctx.fillStyle = '#fff';
      sctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sctx.drawImage(reportCanvas, 0, y, reportCanvas.width, sliceH, 0, 0, reportCanvas.width, sliceH);
      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const imgH = sliceH / pxPerMm;
      if (pageCount > 0) doc.addPage([A4_W, A4_H], 'p');
      doc.addImage(imgData, 'JPEG', 0, 0, A4_W, imgH);
      pageCount++;
    }
    return pageCount;
  }

  const PT_TO_MM = 25.4 / 72;

  // Render one sheet at `scale` into a fresh canvas: the plan, then its marks.
  // `annotations`: omitted (undefined) = the sheet's active layer, a layer's
  // annotations object = that layer, null = the plain sheet with no marks.
  async function rasterPageCanvas(page, { scale, overrides, annotations } = {}) {
    const viewport = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
    if (annotations !== null) {
      // LEGEND-FACE: the sheet legend is measured in Barlow Condensed, so the face
      // must have loaded before the marks are drawn (never hangs: it times out).
      if (App.legendFaceReady) await App.legendFaceReady();
      App.renderAnnotationsToContext(ctx, page, scale, overrides, annotations);
    }
    return { canvas, viewport };
  }

  // The notes and highlights bundles crop every item out of its sheet's full
  // raster. Their items run sheet by sheet and layer by layer, so a one-raster
  // memo renders each (sheet, layer) once per export; the previous raster is
  // dropped before the next one renders (holding every sheet's 4x canvas at
  // once could run a big set out of memory). Returns
  // sheetCanvas(pageIdx, layer) -> the sheet's canvas drawn with THAT layer's
  // marks (BUNDLE-ONE-SHEET: an item's crop comes from its own layer).
  function makeSheetRasterMemo(scale, overrides) {
    let memo = { pageIdx: -1, layer: null, canvas: null };
    return async (pageIdx, layer) => {
      if (memo.pageIdx !== pageIdx || memo.layer !== layer) {
        memo = { pageIdx: -1, layer: null, canvas: null };
        const annotations = (layer && layer.annotations) || App.makeAnnotations();
        const { canvas } = await rasterPageCanvas(App.state.pages[pageIdx], { scale, overrides, annotations });
        memo = { pageIdx, layer, canvas };
      }
      return memo.canvas;
    };
  }

  // The sheet as a JPEG plus its size in mm (the sheet's own size, whatever the scale).
  async function rasterPageJpeg(page, { scale, overrides, annotations, quality } = {}) {
    const { canvas, viewport } = await rasterPageCanvas(page, { scale, overrides, annotations });
    return {
      imgData: canvas.toDataURL('image/jpeg', quality),
      wMm: (viewport.width / scale) * PT_TO_MM,
      hMm: (viewport.height / scale) * PT_TO_MM,
    };
  }

  // Put one sheet image on a new page of `doc`, creating the doc when it is
  // null; returns the doc. No caption: the page IS the sheet, image edge to
  // edge. A caption (a layer name): the image sits 14 mm in, the caption at
  // 9 pt above it, and the page is at least 210 mm wide with room below.
  function addImagePage(doc, img, { caption } = {}) {
    const { imgData, wMm, hMm } = img;
    if (caption == null) {
      if (!doc) doc = new window.jspdf.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
      else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
      doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
      return doc;
    }
    const captionTop = 10;
    const imageTop = 14;
    const pdfPageW = Math.max(210, wMm + 28);
    const pdfPageH = imageTop + hMm + 14 + 20;
    if (!doc) doc = new window.jspdf.jsPDF({ unit: 'mm', format: [pdfPageW, pdfPageH], orientation: pdfPageW > pdfPageH ? 'l' : 'p' });
    else doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
    doc.setFontSize(9);
    doc.text(caption, 14, captionTop);
    doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
    return doc;
  }

  /**
   * Build an export from an options object. Returns { doc, included } with the
   * jsPDF document unsaved (null doc when nothing was included), so a caller can
   * save it under any name. `onProgress(text)` drives the button label.
   *
   * options: selections { <pageIdx>: 'marked' | 'unmarked' | 'exclude' } (absent =
   * marked for the raster, included), canvasMode { <pageIdx>: 'current' | 'all' },
   * exportScale (4), jpegQuality (0.95), markerScale, lineScale, includeReport,
   * bundleHighlights, bundleNotes. The Download-only options (R25, features/output.js):
   * ensureActiveCanvas (make sure each included sheet has a layer before it is
   * read), captionSingleLayer (an 'all' sheet with ONE layer still gets the
   * captioned layer page), skipSheetsWithoutLayers (a sheet with no layers adds
   * nothing), progressNoun ('page' by default; 'plan').
   */
  async function runSpecificPagesExport(options, onProgress) {
    const state = App.state;
    const progress = typeof onProgress === 'function' ? onProgress : () => {};
    const selections = options.selections || {};
    const canvasModes = options.canvasMode || {};
    const included = state.pages.map((_, i) => i).filter(i => selections[i] !== 'exclude');
    if (!included.length) return { doc: null, included };
    const jsPDFLib = window.jspdf;
    const EXPORT_SCALE = options.exportScale || 4;
    const JPEG_QUALITY = options.jpegQuality != null ? options.jpegQuality : 0.95;
    const exportOverrides = { markerScale: options.markerScale, lineScale: options.lineScale };
    const noun = options.progressNoun || 'page';
    const raster = (page, annotations) => rasterPageJpeg(page, { scale: EXPORT_SCALE, overrides: exportOverrides, annotations, quality: JPEG_QUALITY });
    let doc = null;
    if (options.includeReport) {
      doc = new jsPDFLib.jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
      progress('Exporting report…');
      await addReportPagesToPdf(doc);
    }
    for (let idx = 0; idx < included.length; idx++) {
      const i = included[idx];
      const page = state.pages[i];
      if (options.ensureActiveCanvas) App.ensureActiveCanvas(page);
      const canvases = App.getPageCanvases(page);
      if (options.skipSheetsWithoutLayers && canvases.length === 0) continue;
      const canvasMode = canvasModes[i] || 'current';
      const minLayers = options.captionSingleLayer ? 1 : 2;
      const useAllCanvases = selections[i] === 'marked' && canvasMode === 'all' && canvases.length >= minLayers;
      const progressText = 'Exporting ' + noun + ' ' + (idx + 1) + '/' + included.length + '…';
      if (selections[i] === 'unmarked') {
        progress(progressText);
        doc = addImagePage(doc, await raster(page, null));
      } else if (useAllCanvases) {
        for (let ci = 0; ci < canvases.length; ci++) {
          progress(progressText);
          const c = canvases[ci];
          doc = addImagePage(doc, await raster(page, c.annotations || App.makeAnnotations()), { caption: c.name || 'Main' });
        }
      } else {
        progress(progressText);
        doc = addImagePage(doc, await raster(page));
      }
    }
    // BUNDLE-ONE-SHEET: each builder always starts its section on a new page of
    // the doc (and makes its own A4 doc when there is none), so a one-sheet
    // export no longer gets its summary table printed over the sheet.
    if (options.bundleHighlights && hasAnyHighlights()) {
      progress('Exporting highlights…');
      doc = await addHighlightsToPdf(doc, { scale: EXPORT_SCALE, exportOverrides, pageFilter: i => included.includes(i) });
    }
    if (options.bundleNotes && hasAnyNotes()) {
      progress('Exporting notes…');
      doc = await addNotesToPdf(doc, { scale: EXPORT_SCALE, exportOverrides, pageFilter: i => included.includes(i) });
    }
    return { doc, included };
  }

  function hasAnyHighlights() {
    return App.state.pages.some(p => App.getPageCanvases(p).some(c => (c.annotations?.highlights?.length || 0) > 0));
  }

  function hasAnyNotes() {
    return App.state.pages.some(p => App.getPageCanvases(p).some(c => (c.annotations?.notes?.length || 0) > 0));
  }

  // ---- The notes and highlights bundles (BUNDLE-ONE-SHEET, 2026-09-27) ----
  // Both builders share the three helpers below and one contract: pass the
  // export's jsPDF doc (the section starts on a NEW page of it, always) or
  // null (the builder makes its own A4 portrait doc). Each returns the doc it
  // drew on, or the doc it was given (null when given null) when there was
  // nothing to draw. Their layouts stay their own: notes run on uniform A4
  // pages with the first note folded under the summary; highlights get one
  // page sized to each crop.
  const BUNDLE_A4_W = 210, BUNDLE_A4_H = 297;
  const BUNDLE_MARGIN = 14;
  const BUNDLE_BOTTOM = BUNDLE_A4_H - 12;

  // Every note (with text) or highlight on the sheets pageFilter keeps, from
  // EVERY layer: the sidebar buttons (hasAnyNotes / hasAnyHighlights) and the
  // Summary count every layer, so the bundle does too. Sheet by sheet, then
  // layer by layer, so the raster memo renders each (sheet, layer) once.
  // kind: 'notes' | 'highlights'. Item: { pageIdx, pageLabel, layer, item }.
  function collectBundleItems(kind, pageFilter) {
    const keep = pageFilter || (() => true);
    const items = [];
    App.state.pages.forEach((page, pageIdx) => {
      if (!keep(pageIdx)) return;
      const pageLabel = page.label || 'Page ' + (pageIdx + 1);
      App.getPageCanvases(page).forEach(layer => {
        (layer.annotations?.[kind] || []).forEach(item => {
          if (kind === 'notes' && !item.text) return;
          items.push({ pageIdx, pageLabel, layer, item });
        });
      });
    });
    return items;
  }

  // Cut rect ({ x, y, w, h } in PDF points) out of a sheet raster drawn at
  // `scale`; returns the crop as a JPEG data URL.
  function cropSheetJpeg(sheetCanvas, rect, scale) {
    const cropW = Math.max(1, Math.round(rect.w * scale));
    const cropH = Math.max(1, Math.round(rect.h * scale));
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    cropCanvas.getContext('2d').drawImage(sheetCanvas, rect.x * scale, rect.y * scale, cropW, cropH, 0, 0, cropW, cropH);
    return cropCanvas.toDataURL('image/jpeg', 0.95);
  }

  // Draw the "<title>" table (one row per sheet: page number, label, count)
  // from the top of the doc's CURRENT page, breaking onto a fresh A4 page when
  // a row would pass the bottom margin. Returns the y (mm) below the last row.
  function addBundleSummary(doc, title, countLabel, rows) {
    doc.setFontSize(14);
    doc.text(title, BUNDLE_MARGIN, 20);
    doc.setFontSize(10);
    let y = 35;
    doc.text('Page', 14, y);
    doc.text('Label', 50, y);
    doc.text(countLabel, 120, y);
    y += 8;
    rows.forEach(row => {
      if (y > BUNDLE_BOTTOM) { doc.addPage([BUNDLE_A4_W, BUNDLE_A4_H], 'p'); y = 20; }
      doc.text(String(row.pageIdx + 1), 14, y);
      doc.text(row.pageLabel, 50, y);
      doc.text(String(row.count), 120, y);
      y += 7;
    });
    return y;
  }

  // One summary row per sheet, in sheet order, counting its items on every layer.
  function summaryRows(items) {
    const byPage = new Map();
    items.forEach(it => {
      if (!byPage.has(it.pageIdx)) byPage.set(it.pageIdx, { pageIdx: it.pageIdx, pageLabel: it.pageLabel, count: 0 });
      byPage.get(it.pageIdx).count++;
    });
    return [...byPage.values()];
  }

  // Start a bundle section on a fresh A4 portrait page: a new doc when there
  // is none, else a new page (never the doc's current page).
  function startBundleSection(doc) {
    if (!doc) return new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
    doc.addPage([BUNDLE_A4_W, BUNDLE_A4_H], 'p');
    return doc;
  }

  async function addNotesToPdf(doc = null, options = {}) {
    const scale = options.scale ?? 4;
    const exportOverrides = options.exportOverrides ?? {};
    const items = collectBundleItems('notes', options.pageFilter);
    if (!items.length) return doc;
    // B5 (J10): the notes section uses uniform A4 portrait pages, and the
    // Notes Summary folds onto the first notes page (the first note renders
    // beneath the summary table when it fits) instead of sitting on its own
    // mostly-empty page.
    const CONTENT_W = BUNDLE_A4_W - BUNDLE_MARGIN * 2;
    doc = startBundleSection(doc);
    let y = addBundleSummary(doc, 'Notes Summary', '# Notes', summaryRows(items));
    y += 6;
    let firstNoteRendered = false;
    const sheetCanvas = makeSheetRasterMemo(scale, exportOverrides);
    for (const it of items) {
      const page = App.state.pages[it.pageIdx];
      const n = it.item;
      const viewport = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
      const pageW = viewport.width / scale, pageH = viewport.height / scale;
      const noteW = n.width || 150;
      const noteFontSize = n.fontSize || 14;
      const font = (noteFontSize * scale) + 'px sans-serif';
      const { height: noteH } = App.wrapNoteText(n.text, noteW * scale, font, noteFontSize * scale);
      const pad = 8;
      const minX = Math.max(0, n.x - pad);
      const minY = Math.max(0, n.y - pad);
      const maxX = Math.min(pageW, n.x + noteW + pad);
      const maxY = Math.min(pageH, n.y + noteH / scale + pad);
      const w = maxX - minX, hh = maxY - minY;
      if (w < 1 || hh < 1) continue;
      const imgData = cropSheetJpeg(await sheetCanvas(it.pageIdx, it.layer), { x: minX, y: minY, w, h: hh }, scale);
      const imgWMm = w * PT_TO_MM;
      const imgHMm = hh * PT_TO_MM;
      const caption = 'From Page ' + (it.pageIdx + 1) + ': ' + it.pageLabel;
      // Note text height on the uniform page (10pt, wrapped to content width);
      // capped so a pathological note can't swallow the whole image area.
      doc.setFontSize(10);
      const textH = Math.min(doc.getTextDimensions(n.text, { maxWidth: CONTENT_W, fontSize: 10 }).h, 120);
      // Fold the first note under the summary when the remaining space fits a
      // caption + a usably-sized image + the note text; otherwise (and for
      // every later note) start a fresh uniform page.
      let captionTop;
      if (!firstNoteRendered && y + 4 + 20 + 8 + Math.min(textH, 60) + 8 <= BUNDLE_BOTTOM) {
        captionTop = y + 4;
      } else {
        doc.addPage([BUNDLE_A4_W, BUNDLE_A4_H], 'p');
        captionTop = 10;
      }
      firstNoteRendered = true;
      const imageTop = captionTop + 4;
      // Scale the crop down (never up) to fit the content box above the text.
      const availH = Math.max(15, BUNDLE_BOTTOM - imageTop - 8 - textH);
      const fit = Math.min(1, CONTENT_W / imgWMm, availH / imgHMm);
      const drawW = imgWMm * fit;
      const drawH = imgHMm * fit;
      const textTop = imageTop + drawH + 8;
      doc.setFontSize(9);
      doc.addImage(imgData, 'JPEG', BUNDLE_MARGIN, imageTop, drawW, drawH);
      doc.text(caption, BUNDLE_MARGIN, captionTop);
      doc.setFontSize(10);
      doc.text(n.text, BUNDLE_MARGIN, textTop, { maxWidth: CONTENT_W });
    }
    return doc;
  }

  async function addHighlightsToPdf(doc = null, options = {}) {
    const scale = options.scale ?? 4;
    const exportOverrides = options.exportOverrides ?? {};
    const items = collectBundleItems('highlights', options.pageFilter);
    if (!items.length) return doc;
    doc = startBundleSection(doc);
    addBundleSummary(doc, 'Highlights Summary', '# Highlights', summaryRows(items));
    const sheetCanvas = makeSheetRasterMemo(scale, exportOverrides);
    for (const it of items) {
      const page = App.state.pages[it.pageIdx];
      const h = it.item;
      const minX = Math.min(h.x1, h.x2), maxX = Math.max(h.x1, h.x2);
      const minY = Math.min(h.y1, h.y2), maxY = Math.max(h.y1, h.y2);
      if (maxX - minX < 1 || maxY - minY < 1) continue;
      const viewport = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
      const pageW = viewport.width / scale, pageH = viewport.height / scale;
      const clampMinX = Math.max(0, minX), clampMinY = Math.max(0, minY);
      const w = Math.min(pageW, maxX) - clampMinX;
      const hh = Math.min(pageH, maxY) - clampMinY;
      if (w < 1 || hh < 1) continue;
      const imgData = cropSheetJpeg(await sheetCanvas(it.pageIdx, it.layer), { x: clampMinX, y: clampMinY, w, h: hh }, scale);
      const wMm = w * PT_TO_MM;
      const hMm = hh * PT_TO_MM;
      const caption = 'From Page ' + (it.pageIdx + 1) + ': ' + it.pageLabel;
      const captionTop = 10;
      const imageTop = 14;
      const pdfPageW = Math.max(210, wMm + 28);
      const pdfPageH = imageTop + hMm + 14;
      doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
      doc.setFontSize(9);
      doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
      doc.text(caption, 14, captionTop);
    }
    return doc;
  }

  App.addReportPagesToPdf = addReportPagesToPdf;
  App.computeReportSliceBounds = computeReportSliceBounds;
  App.getLastReportPagination = () => lastReportPagination;
  App.hasAnyHighlights = hasAnyHighlights;
  App.hasAnyNotes = hasAnyNotes;
  App.addNotesToPdf = addNotesToPdf;
  App.addHighlightsToPdf = addHighlightsToPdf;
  // R25: the shared export, read at call time by features/export-pdfs.js
  // (the Export PDFs dialog) and features/output.js (the header Download).
  App.runSpecificPagesExport = runSpecificPagesExport;
})();

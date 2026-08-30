(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // PDF bundling helpers (report/notes/highlights -> jsPDF) -- extracted from
  // app.js via the window.App registry. Consumed by features/export-pdfs.js and
  // app.js's download/export flows via App.*. buildReportHtml/html2canvas are
  // runtime globals resolved at export time (after report.js loads). Shared
  // deps are read from App.* at call time (never captured at load).

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

  function hasAnyHighlights() {
    return App.state.pages.some(p => App.getPageCanvases(p).some(c => (c.annotations?.highlights?.length || 0) > 0));
  }

  function hasAnyNotes() {
    return App.state.pages.some(p => App.getPageCanvases(p).some(c => (c.annotations?.notes?.length || 0) > 0));
  }

  async function addNotesToPdf(doc, options = {}) {
    const scale = options.scale ?? 4;
    const exportOverrides = options.exportOverrides ?? {};
    const pageFilter = options.pageFilter ?? (() => true);
    const PT_TO_MM = 25.4 / 72;
    const items = [];
    App.state.pages.forEach((page, pageIdx) => {
      if (!pageFilter(pageIdx)) return;
      const notes = App.getActiveAnnotations(page)?.notes || [];
      notes.forEach(n => {
        if (n.text) items.push({ pageIdx, pageLabel: page.label || 'Page ' + (pageIdx + 1), note: n });
      });
    });
    if (!items.length) return 0;
    const summaryByPage = {};
    items.forEach(it => {
      const key = it.pageIdx;
      if (!summaryByPage[key]) summaryByPage[key] = { pageIdx: it.pageIdx, pageLabel: it.pageLabel, count: 0 };
      summaryByPage[key].count++;
    });
    // B5 (J10): the notes section uses uniform A4 portrait pages, and the
    // Notes Summary folds onto the first notes page (the first note renders
    // beneath the summary table when it fits) instead of sitting on its own
    // mostly-empty page.
    const A4_W = 210, A4_H = 297;
    const MARGIN = 14;
    const CONTENT_W = A4_W - MARGIN * 2;
    const BOTTOM = A4_H - 12;
    if (doc.getNumberOfPages() > 1) doc.addPage([A4_W, A4_H], 'p');
    doc.setFontSize(14);
    doc.text('Notes Summary', MARGIN, 20);
    doc.setFontSize(10);
    let y = 35;
    doc.text('Page', 14, y);
    doc.text('Label', 50, y);
    doc.text('# Notes', 120, y);
    y += 8;
    Object.values(summaryByPage).forEach(row => {
      if (y > BOTTOM) { doc.addPage([A4_W, A4_H], 'p'); y = 20; }
      doc.text(String(row.pageIdx + 1), 14, y);
      doc.text(row.pageLabel, 50, y);
      doc.text(String(row.count), 120, y);
      y += 7;
    });
    y += 6;
    let pageCount = doc.getNumberOfPages();
    let firstNoteRendered = false;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const page = App.state.pages[it.pageIdx];
      const n = it.note;
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
      let w = maxX - minX, hh = maxY - minY;
      if (w < 1 || hh < 1) continue;
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = viewport.width;
      fullCanvas.height = viewport.height;
      const ctx = fullCanvas.getContext('2d');
      await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
      App.renderAnnotationsToContext(ctx, page, scale, exportOverrides);
      const cropW = Math.max(1, Math.round(w * scale));
      const cropH = Math.max(1, Math.round(hh * scale));
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(fullCanvas, minX * scale, minY * scale, cropW, cropH, 0, 0, cropW, cropH);
      const imgData = cropCanvas.toDataURL('image/jpeg', 0.95);
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
      if (!firstNoteRendered && y + 4 + 20 + 8 + Math.min(textH, 60) + 8 <= BOTTOM) {
        captionTop = y + 4;
      } else {
        doc.addPage([A4_W, A4_H], 'p');
        pageCount++;
        captionTop = 10;
      }
      firstNoteRendered = true;
      const imageTop = captionTop + 4;
      // Scale the crop down (never up) to fit the content box above the text.
      const availH = Math.max(15, BOTTOM - imageTop - 8 - textH);
      const fit = Math.min(1, CONTENT_W / imgWMm, availH / imgHMm);
      const drawW = imgWMm * fit;
      const drawH = imgHMm * fit;
      const textTop = imageTop + drawH + 8;
      doc.setFontSize(9);
      doc.addImage(imgData, 'JPEG', MARGIN, imageTop, drawW, drawH);
      doc.text(caption, MARGIN, captionTop);
      doc.setFontSize(10);
      doc.text(n.text, MARGIN, textTop, { maxWidth: CONTENT_W });
    }
    return pageCount;
  }

  async function addHighlightsToPdf(doc, options = {}) {
    const scale = options.scale ?? 4;
    const exportOverrides = options.exportOverrides ?? {};
    const pageFilter = options.pageFilter ?? (() => true);
    const PT_TO_MM = 25.4 / 72;
    const items = [];
    App.state.pages.forEach((page, pageIdx) => {
      if (!pageFilter(pageIdx)) return;
      const highlights = App.getActiveAnnotations(page)?.highlights || [];
      highlights.forEach(h => {
        items.push({ pageIdx, pageLabel: page.label || 'Page ' + (pageIdx + 1), highlight: h });
      });
    });
    if (!items.length) return 0;
    const summaryByPage = {};
    items.forEach(it => {
      const key = it.pageIdx;
      if (!summaryByPage[key]) summaryByPage[key] = { pageIdx: it.pageIdx, pageLabel: it.pageLabel, count: 0 };
      summaryByPage[key].count++;
    });
    if (doc.getNumberOfPages() > 1) doc.addPage([210, 297], 'p');
    doc.setFontSize(14);
    doc.text('Highlights Summary', 14, 20);
    doc.setFontSize(10);
    let y = 35;
    doc.text('Page', 14, y);
    doc.text('Label', 50, y);
    doc.text('# Highlights', 120, y);
    y += 8;
    Object.values(summaryByPage).forEach(row => {
      doc.text(String(row.pageIdx + 1), 14, y);
      doc.text(row.pageLabel, 50, y);
      doc.text(String(row.count), 120, y);
      y += 7;
    });
    let pageCount = doc.getNumberOfPages();
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const page = App.state.pages[it.pageIdx];
      const h = it.highlight;
      const minX = Math.min(h.x1, h.x2), maxX = Math.max(h.x1, h.x2);
      const minY = Math.min(h.y1, h.y2), maxY = Math.max(h.y1, h.y2);
      let w = maxX - minX, hh = maxY - minY;
      if (w < 1 || hh < 1) continue;
      const viewport = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
      const pageW = viewport.width / scale, pageH = viewport.height / scale;
      const clampMinX = Math.max(0, minX), clampMinY = Math.max(0, minY);
      const clampMaxX = Math.min(pageW, maxX), clampMaxY = Math.min(pageH, maxY);
      w = clampMaxX - clampMinX;
      hh = clampMaxY - clampMinY;
      if (w < 1 || hh < 1) continue;
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = viewport.width;
      fullCanvas.height = viewport.height;
      const ctx = fullCanvas.getContext('2d');
      await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
      App.renderAnnotationsToContext(ctx, page, scale, exportOverrides);
      const cropW = Math.max(1, Math.round(w * scale));
      const cropH = Math.max(1, Math.round(hh * scale));
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(fullCanvas, clampMinX * scale, clampMinY * scale, cropW, cropH, 0, 0, cropW, cropH);
      const imgData = cropCanvas.toDataURL('image/jpeg', 0.95);
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
      pageCount++;
    }
    return pageCount;
  }

  App.addReportPagesToPdf = addReportPagesToPdf;
  App.computeReportSliceBounds = computeReportSliceBounds;
  App.getLastReportPagination = () => lastReportPagination;
  App.hasAnyHighlights = hasAnyHighlights;
  App.hasAnyNotes = hasAnyNotes;
  App.addNotesToPdf = addNotesToPdf;
  App.addHighlightsToPdf = addHighlightsToPdf;
})();

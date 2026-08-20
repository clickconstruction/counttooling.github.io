// PDF bundling helpers (report/notes/highlights -> jsPDF) -- extracted from
// app.js via the window.App registry. Consumed by features/export-pdfs.js and
// app.js's download/export flows via App.*. buildReportHtml/html2canvas are
// runtime globals resolved at export time (after report.js loads). Shared
// deps are read from App.* at call time (never captured at load).
//
// Pagination layer: the pure cut-point/layout helpers below are top-level (not
// inside the IIFE) so the guarded CommonJS footer can export them for
// pdf-bundle.test.js under `node --test`, matching the repo's pure-module
// pattern. In the browser they are plain globals the IIFE reads by bare name.

/*
 * Break-aware page cuts for the rasterised report.
 *
 * boundaries: candidate cut offsets in canvas px — y positions where a page
 * break may fall without slicing content (row bottoms, paragraph bottoms,
 * heading TOPS so a heading is never stranded at the bottom of a page).
 * totalHeight: full canvas height in px. pageHeight: max slice height in px.
 *
 * Returns ascending cut positions; the last cut === totalHeight. Each slice
 * (gap between consecutive cuts) is <= pageHeight. For every page window the
 * cut snaps to the LARGEST boundary <= ideal (y + pageHeight); when no
 * boundary falls inside the window (a block taller than a page) it falls back
 * to a hard cut at the ideal offset, which is the old fixed-stride behavior.
 */
function computeReportCutPoints(boundaries, totalHeight, pageHeight) {
  const cuts = [];
  if (!(totalHeight > 0) || !(pageHeight > 0)) return cuts;
  const sorted = Array.from(new Set((boundaries || []).map((b) => Math.round(b))))
    .filter((b) => b > 0 && b < totalHeight)
    .sort((a, b) => a - b);
  let y = 0;
  while (y < totalHeight) {
    const ideal = y + pageHeight;
    if (ideal >= totalHeight) { cuts.push(totalHeight); break; }
    let cut = ideal; // fallback: hard cut (no boundary inside this window)
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i] <= ideal) {
        if (sorted[i] > y) cut = sorted[i];
        break;
      }
    }
    cuts.push(cut);
    y = cut;
  }
  return cuts;
}

/*
 * Notes/Highlights summary block layout on an A4 page (mm, matching the jsPDF
 * draw calls): title baseline, column-header baseline, first row baseline,
 * row stride, and the bottom edge of the block for folding content beneath it.
 */
function computeNotesSummaryLayout(rowCount) {
  const titleY = 20;
  const headerY = 35;
  const rowH = 7;
  const firstRowY = headerY + 8;
  const bottom = firstRowY + Math.max(0, rowCount | 0) * rowH;
  return { titleY, headerY, firstRowY, rowH, bottom };
}

/*
 * Uniform note-page layout: every note renders on an A4 portrait page
 * (210x297mm) with fixed margins, instead of the old per-note page whose size
 * and scale tracked the crop. The image is fitted into the content box
 * preserving aspect ratio (upscale capped so tiny notes don't blow up blurry),
 * with the caption above and the note text below.
 *
 * imgW/imgH: natural crop size in mm. textH: measured wrapped-text height in
 * mm. startY: caption baseline — 10 for a standalone note page, or below the
 * summary block when folding the first note onto the summary page.
 *
 * availH is the height available for the image before fitting; callers use it
 * to decide whether folding under the summary leaves enough room.
 */
function computeNotePageLayout(opts) {
  const pageW = 210, pageH = 297, margin = 14;
  const contentW = pageW - 2 * margin;
  const MAX_UPSCALE = 2;
  const MIN_IMG_H = 20;
  const imgW = Math.max(0.001, opts.imgW || 0);
  const imgH = Math.max(0.001, opts.imgH || 0);
  const textH = Math.max(0, opts.textH || 0);
  const captionY = opts.startY;
  const imgY = captionY + 4;
  const availH = pageH - margin - textH - 8 - imgY;
  const maxImgH = Math.max(MIN_IMG_H, availH);
  const s = Math.min(MAX_UPSCALE, contentW / imgW, maxImgH / imgH);
  const drawW = imgW * s;
  const drawH = imgH * s;
  const textY = imgY + drawH + 8;
  return { pageW, pageH, margin, contentW, captionY, imgX: margin, imgY, drawW, drawH, textY, availH };
}

(function () {
  'use strict';
  if (typeof window === 'undefined') return; // node --test requires this file for the pure helpers only
  const App = (window.App = window.App || {});

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
    // Swap the body margin for padding so the whole page (inset included) sits
    // inside the border box html2canvas rasterises: DOM y-offsets then map
    // linearly onto canvas y (origin 0), and the canvas spans the full 210mm
    // width the mm math below assumes (the old margin-cropped raster was
    // stretched ~9% horizontally when drawn at A4 width).
    try {
      const cs = iframe.contentWindow.getComputedStyle(body);
      const pad = cs.marginTop + ' ' + cs.marginRight + ' ' + cs.marginBottom + ' ' + cs.marginLeft;
      body.style.margin = '0';
      body.style.padding = pad;
    } catch (_) {}
    const reportCanvas = await html2canvas(body, { scale: 2, useCORS: true, logging: false });
    // Measure the unbreakable-block boundaries while the iframe DOM is alive:
    // rows/paragraphs offer their BOTTOM edge as a cut point (plus a small pad
    // so the row's 1px bottom border stays with its row), headings offer their
    // TOP edge so a heading always travels with the table that follows it.
    const bodyRect = body.getBoundingClientRect();
    const r = bodyRect.height > 0 ? reportCanvas.height / bodyRect.height : 2;
    const CUT_PAD_PX = 2;
    const boundaries = [];
    body.querySelectorAll('tr, p, li').forEach(el => {
      const rect = el.getBoundingClientRect();
      boundaries.push(Math.ceil((rect.bottom - bodyRect.top) * r) + CUT_PAD_PX);
    });
    body.querySelectorAll('h1, h2, h3').forEach(el => {
      const rect = el.getBoundingClientRect();
      boundaries.push(Math.floor((rect.top - bodyRect.top) * r) - CUT_PAD_PX);
    });
    document.body.removeChild(iframe);
    const A4_W = 210, A4_H = 297;
    const scale = 2;
    const pxPerMm = (96 / 25.4) * scale;
    const pageHeightPx = Math.floor(A4_H * pxPerMm);
    const totalH = reportCanvas.height;
    const cuts = computeReportCutPoints(boundaries, totalH, pageHeightPx);
    let prevY = 0;
    let pageCount = 0;
    for (const cut of cuts) {
      const sliceH = cut - prevY;
      if (sliceH < 1) continue;
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = reportCanvas.width;
      sliceCanvas.height = sliceH;
      const sctx = sliceCanvas.getContext('2d');
      sctx.fillStyle = '#fff';
      sctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sctx.drawImage(reportCanvas, 0, prevY, reportCanvas.width, sliceH, 0, 0, reportCanvas.width, sliceH);
      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const imgH = sliceH / pxPerMm;
      if (pageCount > 0) doc.addPage([A4_W, A4_H], 'p');
      doc.addImage(imgData, 'JPEG', 0, 0, A4_W, imgH);
      prevY = cut;
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
    if (doc.getNumberOfPages() > 1) doc.addPage([210, 297], 'p');
    const summaryRows = Object.values(summaryByPage);
    const summary = computeNotesSummaryLayout(summaryRows.length);
    doc.setFontSize(14);
    doc.text('Notes Summary', 14, summary.titleY);
    doc.setFontSize(10);
    doc.text('Page', 14, summary.headerY);
    doc.text('Label', 50, summary.headerY);
    doc.text('# Notes', 120, summary.headerY);
    let y = summary.firstRowY;
    summaryRows.forEach(row => {
      doc.text(String(row.pageIdx + 1), 14, y);
      doc.text(row.pageLabel, 50, y);
      doc.text(String(row.count), 120, y);
      y += summary.rowH;
    });
    // The first note folds onto the summary page (below the table) when there
    // is room, instead of leaving the summary a mostly-empty page of its own.
    let foldStartY = summary.bottom + 12;
    let canFold = true;
    const lineHmm = 10 * PT_TO_MM * (typeof doc.getLineHeightFactor === 'function' ? doc.getLineHeightFactor() : 1.15);
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
      const wMm = w * PT_TO_MM;
      const hMm = hh * PT_TO_MM;
      const caption = 'From Page ' + (it.pageIdx + 1) + ': ' + it.pageLabel;
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(n.text, 182);
      const textH = lines.length * lineHmm;
      let layout = canFold ? computeNotePageLayout({ imgW: wMm, imgH: hMm, textH, startY: foldStartY }) : null;
      if (!layout || layout.availH < 40) {
        doc.addPage([210, 297], 'p');
        layout = computeNotePageLayout({ imgW: wMm, imgH: hMm, textH, startY: 10 });
      }
      canFold = false;
      doc.setFontSize(9);
      doc.text(caption, 14, layout.captionY);
      doc.addImage(imgData, 'JPEG', layout.imgX, layout.imgY, layout.drawW, layout.drawH);
      doc.setFontSize(10);
      doc.text(lines, 14, layout.textY);
    }
    return doc.getNumberOfPages();
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
  App.hasAnyHighlights = hasAnyHighlights;
  App.hasAnyNotes = hasAnyNotes;
  App.addNotesToPdf = addNotesToPdf;
  App.addHighlightsToPdf = addHighlightsToPdf;
})();

// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeReportCutPoints, computeNotesSummaryLayout, computeNotePageLayout };
}

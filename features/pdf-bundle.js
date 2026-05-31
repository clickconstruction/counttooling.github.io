(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // PDF bundling helpers (report/notes/highlights -> jsPDF) -- extracted from
  // app.js via the window.App registry. Consumed by features/export-pdfs.js and
  // app.js's download/export flows via App.*. buildReportHtml/html2canvas are
  // runtime globals resolved at export time (after report.js loads).
  const {
    state, renderAnnotationsToContext, getPageCanvases, getActiveAnnotations,
    wrapNoteText,
  } = App;

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
    const reportCanvas = await html2canvas(body, { scale: 2, useCORS: true, logging: false });
    document.body.removeChild(iframe);
    const A4_W = 210, A4_H = 297;
    const scale = 2;
    const pxPerMm = (96 / 25.4) * scale;
    const pageHeightPx = Math.floor(A4_H * pxPerMm);
    let totalH = reportCanvas.height;
    let y = 0;
    let pageCount = 0;
    while (y < totalH) {
      const sliceH = Math.min(pageHeightPx, totalH - y);
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
      y += sliceH;
      pageCount++;
    }
    return pageCount;
  }

  function hasAnyHighlights() {
    return state.pages.some(p => getPageCanvases(p).some(c => (c.annotations?.highlights?.length || 0) > 0));
  }

  function hasAnyNotes() {
    return state.pages.some(p => getPageCanvases(p).some(c => (c.annotations?.notes?.length || 0) > 0));
  }

  async function addNotesToPdf(doc, options = {}) {
    const scale = options.scale ?? 4;
    const exportOverrides = options.exportOverrides ?? {};
    const pageFilter = options.pageFilter ?? (() => true);
    const PT_TO_MM = 25.4 / 72;
    const items = [];
    state.pages.forEach((page, pageIdx) => {
      if (!pageFilter(pageIdx)) return;
      const notes = getActiveAnnotations(page)?.notes || [];
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
    doc.setFontSize(14);
    doc.text('Notes Summary', 14, 20);
    doc.setFontSize(10);
    let y = 35;
    doc.text('Page', 14, y);
    doc.text('Label', 50, y);
    doc.text('# Notes', 120, y);
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
      const page = state.pages[it.pageIdx];
      const n = it.note;
      const viewport = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
      const pageW = viewport.width / scale, pageH = viewport.height / scale;
      const noteW = n.width || 150;
      const noteFontSize = n.fontSize || 14;
      const font = (noteFontSize * scale) + 'px sans-serif';
      const { height: noteH } = wrapNoteText(n.text, noteW * scale, font, noteFontSize * scale);
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
      renderAnnotationsToContext(ctx, page, scale, exportOverrides);
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
      const captionTop = 10;
      const imageTop = 14;
      const textTop = imageTop + hMm + 8;
      const pdfPageW = Math.max(210, wMm + 28);
      const pdfPageH = imageTop + hMm + 14 + 20;
      doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
      doc.setFontSize(9);
      doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
      doc.text(caption, 14, captionTop);
      doc.setFontSize(10);
      doc.text(n.text, 14, textTop, { maxWidth: pdfPageW - 28 });
      pageCount++;
    }
    return pageCount;
  }

  async function addHighlightsToPdf(doc, options = {}) {
    const scale = options.scale ?? 4;
    const exportOverrides = options.exportOverrides ?? {};
    const pageFilter = options.pageFilter ?? (() => true);
    const PT_TO_MM = 25.4 / 72;
    const items = [];
    state.pages.forEach((page, pageIdx) => {
      if (!pageFilter(pageIdx)) return;
      const highlights = getActiveAnnotations(page)?.highlights || [];
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
      const page = state.pages[it.pageIdx];
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
      renderAnnotationsToContext(ctx, page, scale, exportOverrides);
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

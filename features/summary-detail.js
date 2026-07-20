/*
 * features/summary-detail.js - the Summary count-detail modal
 * (#summaryCountDetailModal), extracted from the app.js UI-render region
 * (Tier-2 audit item): clicking a Summary row opens a per-page breakdown of
 * one counter or line type, with async rendered page thumbnails
 * (pdf.js render + renderAnnotationsToContext at export marker/line scales).
 *
 * Loaded as a classic <script src="/features/summary-detail.js"> AFTER
 * app.js. Its own IIFE: registers App.openSummaryCountDetailModal; the four
 * renderSummary row bindings in app.js call it via deferred arrows. New
 * publish-only deps: App.getMultiplyZoneForPoint, App.getLineLengthFeetForTotals,
 * App.formatFeet (window/report-contract globals, lint-invisible to the
 * features group). Boundary rule: read shared deps from App.* at call time,
 * never captured at load. See ARCHITECTURE.md "Feature files / window.App
 * registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  async function openSummaryCountDetailModal(type, id) {
    const titleEl = document.getElementById('summaryCountDetailTitle');
    const listEl = document.getElementById('summaryCountDetailList');
    const exportOverrides = { markerScale: App.state.exportSettings?.markerScale ?? 0.75, lineScale: App.state.exportSettings?.lineScale ?? 0.75 };
    const THUMB_WIDTH = 200;
    let items = [];
    if (type === 'counter') {
      const c = App.state.counters.find(x => x.id === id);
      if (!c) return;
      titleEl.textContent = (c.name || 'Counter') + ' — by page';
      App.state.pages.forEach((p, pageIdx) => {
        const ann = App.getActiveAnnotations(p);
        const markers = ann?.counterMarkers?.[id] || [];
        if (markers.length > 0) {
          const count = markers.reduce((s, m) => s + App.getMultiplyZoneForPoint(ann, m), 0);
          items.push({ pageIdx, pageLabel: p.label || 'Page ' + (pageIdx + 1), count, isCounter: true });
        }
      });
    } else {
      const lt = App.state.lineTypes.find(x => x.id === id);
      if (!lt) return;
      titleEl.textContent = (lt.name || 'Line type') + ' — by page';
      App.state.pages.forEach((p, pageIdx) => {
        const ann = App.getActiveAnnotations(p);
        let runs = 0, len = 0;
        (ann?.quickLines || []).filter(q => q.lineTypeId === id).forEach(q => { runs++; len += App.getLineLengthFeetForTotals(q, pageIdx, false, ann); });
        (ann?.polylines || []).filter(poly => poly.lineTypeId === id).forEach(poly => { runs++; len += App.getLineLengthFeetForTotals(poly, pageIdx, true, ann); });
        if (runs > 0) items.push({ pageIdx, pageLabel: p.label || 'Page ' + (pageIdx + 1), runs, length: len, isCounter: false });
      });
    }
    if (!items.length) return;
    const esc = (s) => App.escapeHtml(s);
    listEl.innerHTML = '<p style="color:var(--text2);">Loading…</p>';
    App.showModal('summaryCountDetailModal');
    listEl.innerHTML = '';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const page = App.state.pages[it.pageIdx];
      const fullLabel = it.pageLabel || 'Page ' + (it.pageIdx + 1);
      let docName = 'document.pdf';
      let pagePart = 'p' + (it.pageIdx + 1);
      if (fullLabel.indexOf(' — ') >= 0) {
        const parts = fullLabel.split(' — ');
        docName = (parts[0] || 'document.pdf').trim();
        pagePart = (parts[1] || pagePart).trim();
      } else if (fullLabel.toLowerCase().endsWith('.pdf')) {
        docName = fullLabel;
        pagePart = 'p' + (it.pageIdx + 1);
      } else {
        pagePart = fullLabel;
      }
      const row = document.createElement('div');
      row.className = 'summary-count-detail-row';
      let metaHtml = '<div class="summary-count-detail-meta">';
      metaHtml += '<span class="summary-count-detail-count">' + esc(it.isCounter ? String(it.count) : String(it.runs)) + '</span>';
      if (!it.isCounter) {
        const ps = App.getPageScale(it.pageIdx);
        metaHtml += '<span class="summary-count-detail-length">' + esc(App.formatFeet(it.length, ps)) + '</span>';
      }
      metaHtml += '<span class="summary-count-detail-page">on ' + esc(pagePart) + '</span></div>';
      row.innerHTML = metaHtml;
      if (page.pdfPage) {
        try {
          const natView = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
          const scale = THUMB_WIDTH / natView.width;
          const viewport = page.pdfPage.getViewport({ scale, rotation: page.rotation ?? 0 });
          const pageW = viewport.width, pageH = viewport.height;
          const canvas = document.createElement('canvas');
          canvas.width = pageW;
          canvas.height = pageH;
          const ctx = canvas.getContext('2d');
          await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'display' }).promise;
          App.renderAnnotationsToContext(ctx, page, scale, exportOverrides);
          const previewWrap = document.createElement('div');
          previewWrap.className = 'summary-count-detail-preview';
          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/jpeg', 0.9);
          img.alt = fullLabel;
          previewWrap.appendChild(img);
          const docSpan = document.createElement('span');
          docSpan.className = 'summary-count-detail-doc';
          docSpan.textContent = docName;
          previewWrap.appendChild(docSpan);
          row.appendChild(previewWrap);
        } catch (e) {
          console.error('[Summary detail thumbnail]', e);
        }
      }
      listEl.appendChild(row);
    }
  }

  App.openSummaryCountDetailModal = openSummaryCountDetailModal;
})();

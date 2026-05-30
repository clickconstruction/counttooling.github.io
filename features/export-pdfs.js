/*
 * features/export-pdfs.js - the Export PDFs modal (specificPagesModal),
 * extracted from the app.js IIFE as the sixth feature-file split under the
 * window.App registry pattern. Largest single feature moved so far.
 *
 * Loaded as a classic <script src="features/export-pdfs.js"> AFTER app.js. Its
 * own IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, owns the
 * per-page selection module-locals (specificPagesSelections /
 * specificPagesCanvasMode), registers openSpecificPagesModal back onto App, and
 * binds the modal's buttons / scroll / nav handlers at this file's load.
 *
 * Scope is the Export PDFs feature only. The shared PDF-download helpers
 * (sanitizeForFilename / downloadPdfBuffer / downloadProjectPdf) and the
 * "Copy to PipeTooling" dropdown toggle stay in app.js. The render/bundle
 * helpers (renderAnnotationsToContext, addReportPagesToPdf, addHighlightsToPdf,
 * addNotesToPdf, hasAnyHighlights, hasAnyNotes, getPageCanvases,
 * sanitizeForFilename, logUserEvent) stay defined in app.js and are read here
 * via App.* (publish-only). Boundary rule: read shared deps from App.* at call
 * time, never captured at load. See ARCHITECTURE.md "Feature files / window.App
 * registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  let specificPagesSelections = {};
  let specificPagesCanvasMode = {};

  function openSpecificPagesModal() {
    const state = App.state;
    if (!state.pages.length) { alert('No pages loaded. Upload a PDF first.'); return; }
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib || !jsPDFLib.jsPDF) { alert('Export PDFs requires jsPDF. Please refresh the page.'); return; }
    specificPagesSelections = {};
    specificPagesCanvasMode = {};
    state.pages.forEach((_, i) => { specificPagesSelections[i] = 'marked'; specificPagesCanvasMode[i] = 'current'; });
    try {
      const stored = localStorage.getItem('specificPagesIncludeReport');
      document.getElementById('specificPagesIncludeReport').checked = stored !== '0';
    } catch (_) {}
    document.getElementById('specificPagesBundleHighlights').checked = state.exportSettings.bundleHighlightsToPdf !== false;
    document.getElementById('specificPagesBundleNotes').checked = state.exportSettings.bundleNotesToPdf !== false;
    const hasCountsOrLines = typeof window.getPipeToolingSummary === 'function' && window.getPipeToolingSummary().length > 0;
    const incReport = document.getElementById('specificPagesIncludeReport');
    const incReportBtn = document.getElementById('specificPagesIncludeReportBtn');
    const incReportNone = document.getElementById('specificPagesIncludeReportNone');
    if (hasCountsOrLines) { incReportNone.textContent = ''; incReportBtn.disabled = false; } else { incReportNone.textContent = ' — none to show'; incReportBtn.disabled = true; incReport.checked = false; }
    incReportBtn.setAttribute('aria-pressed', incReport.checked);
    const bundleHigh = document.getElementById('specificPagesBundleHighlights');
    const bundleHighBtn = document.getElementById('specificPagesBundleHighlightsBtn');
    const bundleHighNone = document.getElementById('specificPagesBundleHighlightsNone');
    if (App.hasAnyHighlights()) { bundleHighNone.textContent = ''; bundleHighBtn.disabled = false; } else { bundleHighNone.textContent = ' — none to show'; bundleHighBtn.disabled = true; bundleHigh.checked = false; }
    bundleHighBtn.setAttribute('aria-pressed', bundleHigh.checked);
    const bundleNotes = document.getElementById('specificPagesBundleNotes');
    const bundleNotesBtn = document.getElementById('specificPagesBundleNotesBtn');
    const bundleNotesNone = document.getElementById('specificPagesBundleNotesNone');
    if (App.hasAnyNotes()) { bundleNotesNone.textContent = ''; bundleNotesBtn.disabled = false; } else { bundleNotesNone.textContent = ' — none to show'; bundleNotesBtn.disabled = true; bundleNotes.checked = false; }
    bundleNotesBtn.setAttribute('aria-pressed', bundleNotes.checked);
    const grid = document.getElementById('specificPagesGrid');
    grid.innerHTML = '';
    state.pages.forEach((page, i) => {
      const card = document.createElement('div');
      card.className = 'specific-page-card';
      card.dataset.pageIndex = String(i);
      const img = document.createElement('img');
      img.className = 'specific-page-thumb';
      img.alt = 'Page ' + (i + 1);
      img.style.background = '#fff';
      const label = document.createElement('div');
      label.className = 'specific-page-label';
      label.textContent = page.label || 'Page ' + (i + 1);
      const select = document.createElement('select');
      select.innerHTML = '<option value="marked">Marked up</option><option value="unmarked">Not marked up</option><option value="exclude">Exclude</option>';
      select.value = 'marked';
      select.onchange = () => { specificPagesSelections[i] = select.value; updateSpecificPagesCanvasModeVisibility(); updateSpecificPagesDownloadState(); };
      card.appendChild(img);
      card.appendChild(label);
      card.appendChild(select);
      const canvases = App.getPageCanvases(page);
      const canvasModeSelect = document.createElement('select');
      canvasModeSelect.className = 'specific-page-canvas-mode';
      canvasModeSelect.dataset.pageIndex = String(i);
      canvasModeSelect.innerHTML = '<option value="current">Current canvas</option><option value="all">All canvases</option>';
      canvasModeSelect.value = specificPagesCanvasMode[i] || 'current';
      canvasModeSelect.style.display = (canvases.length > 1 && specificPagesSelections[i] === 'marked') ? '' : 'none';
      canvasModeSelect.onchange = () => { specificPagesCanvasMode[i] = canvasModeSelect.value; };
      card.appendChild(canvasModeSelect);
      grid.appendChild(card);
      (async () => {
        const THUMB_SCALE = 0.4;
        const viewport = page.pdfPage.getViewport({ scale: THUMB_SCALE, rotation: page.rotation ?? 0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'display' }).promise;
        img.src = canvas.toDataURL('image/jpeg', 0.8);
      })();
    });
    document.getElementById('specificPagesMarkerScale').value = Math.round((state.exportSettings.markerScale ?? 0.75) * 100);
    document.getElementById('specificPagesMarkerScaleVal').textContent = document.getElementById('specificPagesMarkerScale').value;
    document.getElementById('specificPagesLineScale').value = Math.round((state.exportSettings.lineScale ?? 0.75) * 100);
    document.getElementById('specificPagesLineScaleVal').textContent = document.getElementById('specificPagesLineScale').value;
    updateSpecificPagesDownloadState();
    updateSpecificPagesNavState();
    App.showModal('specificPagesModal');
  }
  function updateSpecificPagesCanvasModeVisibility() {
    const state = App.state;
    document.querySelectorAll('.specific-page-canvas-mode').forEach(sel => {
      const i = parseInt(sel.dataset.pageIndex, 10);
      const page = state.pages[i];
      const canvases = page ? App.getPageCanvases(page) : [];
      const show = canvases.length > 1 && specificPagesSelections[i] === 'marked';
      sel.style.display = show ? '' : 'none';
    });
  }
  function updateSpecificPagesDownloadState() {
    const hasIncluded = Object.values(specificPagesSelections).some(v => v !== 'exclude');
    document.getElementById('specificPagesDownload').disabled = !hasIncluded;
  }
  function updateSpecificPagesNavState() {
    const grid = document.getElementById('specificPagesGrid');
    const prev = document.querySelector('.specific-pages-nav-prev');
    const next = document.querySelector('.specific-pages-nav-next');
    if (!grid || !prev || !next) return;
    const { scrollLeft, scrollWidth, clientWidth } = grid;
    const atEnd = scrollWidth <= clientWidth || scrollLeft >= scrollWidth - clientWidth - 1;
    prev.disabled = scrollLeft <= 0;
    next.disabled = atEnd;
  }
  function setAllSpecificPagesTo(value) {
    const state = App.state;
    state.pages.forEach((_, i) => {
      specificPagesSelections[i] = value;
      if (value === 'marked') specificPagesCanvasMode[i] = 'current';
    });
    const grid = document.getElementById('specificPagesGrid');
    state.pages.forEach((_, i) => {
      const card = grid?.children[i];
      if (card) {
        const mainSelect = card.querySelector('select:not(.specific-page-canvas-mode)');
        const modeSelect = card.querySelector('.specific-page-canvas-mode');
        if (mainSelect) mainSelect.value = specificPagesSelections[i];
        if (modeSelect) modeSelect.value = specificPagesCanvasMode[i] || 'current';
      }
    });
    updateSpecificPagesCanvasModeVisibility();
    updateSpecificPagesDownloadState();
  }
  function setAllSpecificPagesToMarkedWithAllCanvases() {
    const state = App.state;
    state.pages.forEach((_, i) => {
      specificPagesSelections[i] = 'marked';
      specificPagesCanvasMode[i] = 'all';
    });
    const grid = document.getElementById('specificPagesGrid');
    state.pages.forEach((_, i) => {
      const card = grid?.children[i];
      if (card) {
        const mainSelect = card.querySelector('select:not(.specific-page-canvas-mode)');
        const modeSelect = card.querySelector('.specific-page-canvas-mode');
        if (mainSelect) mainSelect.value = specificPagesSelections[i];
        if (modeSelect) modeSelect.value = specificPagesCanvasMode[i] || 'all';
      }
    });
    updateSpecificPagesCanvasModeVisibility();
    updateSpecificPagesDownloadState();
  }
  async function downloadSpecificPages() {
    const state = App.state;
    const included = state.pages.map((_, i) => i).filter(i => specificPagesSelections[i] !== 'exclude');
    if (!included.length) return;
    const markerScale = parseInt(document.getElementById('specificPagesMarkerScale').value, 10) / 100;
    const lineScale = parseInt(document.getElementById('specificPagesLineScale').value, 10) / 100;
    state.exportSettings.markerScale = markerScale;
    state.exportSettings.lineScale = lineScale;
    App.hideModal('specificPagesModal');
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib || !jsPDFLib.jsPDF) { alert('Download requires jsPDF. Please refresh the page.'); return; }
    const includeReport = document.getElementById('specificPagesIncludeReport').checked;
    const bundleHighlights = document.getElementById('specificPagesBundleHighlights').checked;
    const bundleNotes = document.getElementById('specificPagesBundleNotes').checked;
    state.exportSettings.bundleHighlightsToPdf = bundleHighlights;
    state.exportSettings.bundleNotesToPdf = bundleNotes;
    try { localStorage.setItem('specificPagesIncludeReport', includeReport ? '1' : '0'); } catch (_) {}
    const EXPORT_SCALE = 4;
    const PT_TO_MM = 25.4 / 72;
    const exportOverrides = { markerScale, lineScale };
    const btn = document.getElementById('specificPages');
    const origText = btn.textContent;
    btn.textContent = 'Downloading…';
    try {
      let doc = null;
      if (includeReport) {
        doc = new jsPDFLib.jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
        btn.textContent = 'Exporting report…';
        await App.addReportPagesToPdf(doc);
      }
      for (let idx = 0; idx < included.length; idx++) {
        const i = included[idx];
        const page = state.pages[i];
        const canvases = App.getPageCanvases(page);
        const canvasMode = specificPagesCanvasMode[i] || 'current';
        const useAllCanvases = specificPagesSelections[i] === 'marked' && canvasMode === 'all' && canvases.length > 1;
        if (specificPagesSelections[i] === 'unmarked') {
          btn.textContent = 'Exporting page ' + (idx + 1) + '/' + included.length + '…';
          const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
          const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
          if (doc === null) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
          else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
          doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        } else if (useAllCanvases) {
          for (let ci = 0; ci < canvases.length; ci++) {
            btn.textContent = 'Exporting page ' + (idx + 1) + '/' + included.length + '…';
            const c = canvases[ci];
            const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
            App.renderAnnotationsToContext(ctx, page, EXPORT_SCALE, exportOverrides, c.annotations || App.makeAnnotations());
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
            const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
            const caption = c.name || 'Main';
            const captionTop = 10;
            const imageTop = 14;
            const pdfPageW = Math.max(210, wMm + 28);
            const pdfPageH = imageTop + hMm + 14 + 20;
            if (doc === null) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [pdfPageW, pdfPageH], orientation: pdfPageW > pdfPageH ? 'l' : 'p' });
            else doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
            doc.setFontSize(9);
            doc.text(caption, 14, captionTop);
            doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
          }
        } else {
          btn.textContent = 'Exporting page ' + (idx + 1) + '/' + included.length + '…';
          const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
          App.renderAnnotationsToContext(ctx, page, EXPORT_SCALE, exportOverrides);
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
          const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
          if (doc === null) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
          else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
          doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        }
      }
      if (doc && bundleHighlights && App.hasAnyHighlights()) {
        btn.textContent = 'Exporting highlights…';
        await App.addHighlightsToPdf(doc, { scale: EXPORT_SCALE, exportOverrides, pageFilter: i => included.includes(i) });
      }
      if (doc && bundleNotes && App.hasAnyNotes()) {
        btn.textContent = 'Exporting notes…';
        await App.addNotesToPdf(doc, { scale: EXPORT_SCALE, exportOverrides, pageFilter: i => included.includes(i) });
      }
      if (doc) {
        const baseName = App.sanitizeForFilename(state.currentProjectName);
        doc.save('takeoff-specific-pages_' + baseName + '.pdf');
        App.logUserEvent('export_pdf', state.currentProjectId, { source: 'specific-pages' });
      }
    } catch (err) {
      console.error(err);
      alert('Download failed: ' + (err.message || err));
    }
    btn.textContent = origText;
  }

  document.getElementById('specificPages').onclick = openSpecificPagesModal;
  document.getElementById('specificPagesCancel').onclick = () => App.hideModal('specificPagesModal');
  document.getElementById('specificPagesDownload').onclick = downloadSpecificPages;
  document.getElementById('specificPagesAllMarked').onclick = () => setAllSpecificPagesTo('marked');
  document.getElementById('specificPagesAllUnmarked').onclick = () => setAllSpecificPagesTo('unmarked');
  document.getElementById('specificPagesAllExclude').onclick = () => setAllSpecificPagesTo('exclude');
  document.getElementById('specificPagesAllCanvases').onclick = setAllSpecificPagesToMarkedWithAllCanvases;
  document.getElementById('specificPagesIncludeReport').onchange = () => {
    try { localStorage.setItem('specificPagesIncludeReport', document.getElementById('specificPagesIncludeReport').checked ? '1' : '0'); } catch (_) {}
  };

  document.getElementById('specificPagesIncludeReportBtn').onclick = (e) => {
    e.preventDefault();
    if (e.currentTarget.disabled) return;
    const cb = document.getElementById('specificPagesIncludeReport');
    cb.checked = !cb.checked;
    document.getElementById('specificPagesIncludeReportBtn').setAttribute('aria-pressed', cb.checked);
    cb.dispatchEvent(new Event('change'));
  };
  document.getElementById('specificPagesBundleHighlightsBtn').onclick = (e) => {
    e.preventDefault();
    if (e.currentTarget.disabled) return;
    const cb = document.getElementById('specificPagesBundleHighlights');
    cb.checked = !cb.checked;
    document.getElementById('specificPagesBundleHighlightsBtn').setAttribute('aria-pressed', cb.checked);
  };
  document.getElementById('specificPagesBundleNotesBtn').onclick = (e) => {
    e.preventDefault();
    if (e.currentTarget.disabled) return;
    const cb = document.getElementById('specificPagesBundleNotes');
    cb.checked = !cb.checked;
    document.getElementById('specificPagesBundleNotesBtn').setAttribute('aria-pressed', cb.checked);
  };
  document.getElementById('specificPagesMarkerScale').oninput = () => {
    document.getElementById('specificPagesMarkerScaleVal').textContent = document.getElementById('specificPagesMarkerScale').value;
  };
  document.getElementById('specificPagesLineScale').oninput = () => {
    document.getElementById('specificPagesLineScaleVal').textContent = document.getElementById('specificPagesLineScale').value;
  };
  const specificPagesGrid = document.getElementById('specificPagesGrid');
  if (specificPagesGrid) {
    specificPagesGrid.addEventListener('scroll', updateSpecificPagesNavState);
    specificPagesGrid.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        specificPagesGrid.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }
  document.querySelector('.specific-pages-nav-prev')?.addEventListener('click', () => {
    const grid = document.getElementById('specificPagesGrid');
    if (grid) { grid.scrollBy({ left: -156, behavior: 'smooth' }); }
  });
  document.querySelector('.specific-pages-nav-next')?.addEventListener('click', () => {
    const grid = document.getElementById('specificPagesGrid');
    if (grid) { grid.scrollBy({ left: 156, behavior: 'smooth' }); }
  });

  App.openSpecificPagesModal = openSpecificPagesModal;
})();

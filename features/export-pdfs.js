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
 *
 * Bid basis (2026-09-10, features/bid-basis.js): the dialog can open with a
 * PRESET — `openSpecificPagesModal({ preset: 'bid-basis', ref, filename })` —
 * that selects only the sheets carrying marks (bid-basis-model.js
 * bidBasisPageSelections), turns the report on, highlights off, notes on, shows
 * the bid chip and the "Saves as" file name, and after the download hands the
 * finished jsPDF to App.onBidBasisExported. The download function reads its
 * options through readSpecificPagesOptionsFromDom() and runs through
 * runSpecificPagesExport(options), so a preset never has to poke the controls.
 */
(function() {
  const App = (window.App = window.App || {});

  let specificPagesSelections = {};
  let specificPagesCanvasMode = {};
  // The preset the dialog is currently open with (null = the plain dialog).
  let activePreset = null;

  const DEFAULT_INTRO = 'Adjust marker and line sizes for the exported PDF:';

  // Marks on every layer of a page (what "Only sheets with marks" keys on):
  // counters, runs, ducts, rooms. Highlights and notes ride along but never
  // select a page — same rule as bid-basis-model.js pageHasBidMarks.
  function countPageMarks(page) {
    const canvases = App.getPageCanvases(page);
    let n = 0;
    canvases.forEach((c) => {
      const ann = c.annotations || {};
      if (ann.counterMarkers) Object.keys(ann.counterMarkers).forEach((k) => { n += (ann.counterMarkers[k] || []).length; });
      n += (ann.quickLines || []).length + (ann.polylines || []).length + (ann.ductRuns || []).length + (ann.roomBoxes || []).length;
    });
    return n;
  }

  function setToggle(id, on) {
    const cb = document.getElementById(id);
    const btn = document.getElementById(id + 'Btn');
    if (cb && !btn?.disabled) cb.checked = !!on;
    if (btn) btn.setAttribute('aria-pressed', String(!!(cb && cb.checked)));
  }

  function openSpecificPagesModal(opts) {
    const state = App.state;
    if (!state.pages.length) { alert('No pages loaded. Upload a PDF first.'); return; }
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib || !jsPDFLib.jsPDF) { alert('Export PDFs requires jsPDF. Please refresh the page.'); return; }
    // A PipeTooling-requested export (features/bid-basis.js) keeps its preset
    // on every open of the dialog in that tab, sidebar button included.
    const preset = (opts && opts.preset) ? opts : (App.getActiveBidBasisPreset ? App.getActiveBidBasisPreset() : null);
    activePreset = preset || null;
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
      select.onchange = () => { specificPagesSelections[i] = select.value; syncCardMarksClass(card, i); updateSpecificPagesCanvasModeVisibility(); updateSpecificPagesDownloadState(); };
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
      const marks = document.createElement('div');
      marks.className = 'specific-page-marks';
      const n = countPageMarks(page);
      marks.textContent = n ? (n + (n === 1 ? ' mark' : ' marks')) : 'no marks';
      card.dataset.markCount = String(n);
      card.appendChild(marks);
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
    applyPresetChrome();
    if (activePreset && activePreset.preset === 'bid-basis') applyBidBasisPreset();
    updateSpecificPagesDownloadState();
    updateSpecificPagesNavState();
    App.showModal('specificPagesModal');
  }

  // Title chip, intro line and the "Saves as" row follow the preset.
  function applyPresetChrome() {
    const chip = document.getElementById('specificPagesBidBasisChip');
    const intro = document.getElementById('specificPagesIntro');
    const row = document.getElementById('specificPagesFilenameRow');
    const name = document.getElementById('specificPagesFilename');
    const isBidBasis = !!(activePreset && activePreset.preset === 'bid-basis');
    if (chip) {
      chip.hidden = !isBidBasis;
      chip.textContent = isBidBasis ? ('Bid basis' + (activePreset.ref ? ' · ' + activePreset.ref : '') + ' · for PipeTooling') : '';
    }
    if (intro) intro.textContent = isBidBasis
      ? 'Preset: the sheets that carry marks, report first, notes at the back. Change anything before you download.'
      : DEFAULT_INTRO;
    if (row) row.hidden = !isBidBasis;
    if (name) name.textContent = isBidBasis ? (activePreset.filename || '') : '';
  }

  function applyBidBasisPreset() {
    setSpecificPagesToMarksOnly();
    setToggle('specificPagesIncludeReport', true);
    setToggle('specificPagesBundleHighlights', false);
    setToggle('specificPagesBundleNotes', true);
    if (activePreset) {
      const intro = document.getElementById('specificPagesIntro');
      const n = Object.values(specificPagesSelections).filter((v) => v === 'marked').length;
      if (intro) intro.textContent = 'Preset: the ' + n + (n === 1 ? ' sheet' : ' sheets') + ' that carry marks, report first, notes at the back, a lighter file for email. Change anything before you download.';
    }
  }

  function syncCardMarksClass(card, i) {
    if (!card) return;
    const excludedForNoMarks = specificPagesSelections[i] === 'exclude' && card.dataset.markCount === '0';
    card.classList.toggle('specific-page-no-marks', excludedForNoMarks);
  }
  function syncAllCardsToSelections() {
    const state = App.state;
    const grid = document.getElementById('specificPagesGrid');
    state.pages.forEach((_, i) => {
      const card = grid?.children[i];
      if (card) {
        const mainSelect = card.querySelector('select:not(.specific-page-canvas-mode)');
        const modeSelect = card.querySelector('.specific-page-canvas-mode');
        if (mainSelect) mainSelect.value = specificPagesSelections[i];
        if (modeSelect) modeSelect.value = specificPagesCanvasMode[i] || 'current';
        syncCardMarksClass(card, i);
      }
    });
    updateSpecificPagesCanvasModeVisibility();
    updateSpecificPagesDownloadState();
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
    syncAllCardsToSelections();
  }
  function setAllSpecificPagesToMarkedWithAllCanvases() {
    const state = App.state;
    state.pages.forEach((_, i) => {
      specificPagesSelections[i] = 'marked';
      specificPagesCanvasMode[i] = 'all';
    });
    syncAllCardsToSelections();
  }
  // "Only sheets with marks": pages carrying counters / runs / ducts / rooms
  // stay marked-up on the current canvas; every other page is excluded.
  function setSpecificPagesToMarksOnly() {
    const model = window.BidBasisModel;
    if (!model) return;
    const plan = model.bidBasisPageSelections(App.state.pages);
    specificPagesSelections = { ...plan.selections };
    specificPagesCanvasMode = { ...plan.canvasMode };
    syncAllCardsToSelections();
    return plan.included;
  }

  /** The dialog's controls as one options object — the only DOM read the export makes. */
  function readSpecificPagesOptionsFromDom() {
    const render = (activePreset && activePreset.render) || {};
    return {
      // Raster settings: Export PDFs' 4x / 0.95 unless the preset asks for lighter (bid basis: 3x / 0.85).
      exportScale: render.scale || 4,
      jpegQuality: render.jpegQuality != null ? render.jpegQuality : 0.95,
      markerScale: parseInt(document.getElementById('specificPagesMarkerScale').value, 10) / 100,
      lineScale: parseInt(document.getElementById('specificPagesLineScale').value, 10) / 100,
      includeReport: document.getElementById('specificPagesIncludeReport').checked,
      bundleHighlights: document.getElementById('specificPagesBundleHighlights').checked,
      bundleNotes: document.getElementById('specificPagesBundleNotes').checked,
      selections: { ...specificPagesSelections },
      canvasMode: { ...specificPagesCanvasMode },
    };
  }

  /**
   * Build the export from an options object. Returns { doc, included } with the
   * jsPDF document unsaved (null doc when nothing was included), so a caller can
   * save it under any name. `onProgress(text)` drives the button label.
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
    const PT_TO_MM = 25.4 / 72;
    const exportOverrides = { markerScale: options.markerScale, lineScale: options.lineScale };
    let doc = null;
    if (options.includeReport) {
      doc = new jsPDFLib.jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
      progress('Exporting report…');
      await App.addReportPagesToPdf(doc);
    }
    for (let idx = 0; idx < included.length; idx++) {
      const i = included[idx];
      const page = state.pages[i];
      const canvases = App.getPageCanvases(page);
      const canvasMode = canvasModes[i] || 'current';
      const useAllCanvases = selections[i] === 'marked' && canvasMode === 'all' && canvases.length > 1;
      if (selections[i] === 'unmarked') {
        progress('Exporting page ' + (idx + 1) + '/' + included.length + '…');
        const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
        const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
        const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
        if (doc === null) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
        else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
        doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
      } else if (useAllCanvases) {
        for (let ci = 0; ci < canvases.length; ci++) {
          progress('Exporting page ' + (idx + 1) + '/' + included.length + '…');
          const c = canvases[ci];
          const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
          App.renderAnnotationsToContext(ctx, page, EXPORT_SCALE, exportOverrides, c.annotations || App.makeAnnotations());
          const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
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
        progress('Exporting page ' + (idx + 1) + '/' + included.length + '…');
        const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
        App.renderAnnotationsToContext(ctx, page, EXPORT_SCALE, exportOverrides);
        const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
        const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
        if (doc === null) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
        else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
        doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
      }
    }
    if (doc && options.bundleHighlights && App.hasAnyHighlights()) {
      progress('Exporting highlights…');
      await App.addHighlightsToPdf(doc, { scale: EXPORT_SCALE, exportOverrides, pageFilter: i => included.includes(i) });
    }
    if (doc && options.bundleNotes && App.hasAnyNotes()) {
      progress('Exporting notes…');
      await App.addNotesToPdf(doc, { scale: EXPORT_SCALE, exportOverrides, pageFilter: i => included.includes(i) });
    }
    return { doc, included };
  }

  async function downloadSpecificPages() {
    const state = App.state;
    const options = readSpecificPagesOptionsFromDom();
    if (!Object.values(options.selections).some(v => v !== 'exclude')) return;
    state.exportSettings.markerScale = options.markerScale;
    state.exportSettings.lineScale = options.lineScale;
    state.exportSettings.bundleHighlightsToPdf = options.bundleHighlights;
    state.exportSettings.bundleNotesToPdf = options.bundleNotes;
    try { localStorage.setItem('specificPagesIncludeReport', options.includeReport ? '1' : '0'); } catch (_) {}
    App.hideModal('specificPagesModal');
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib || !jsPDFLib.jsPDF) { alert('Download requires jsPDF. Please refresh the page.'); return; }
    const preset = activePreset;
    const btn = document.getElementById('specificPages');
    const origText = btn.textContent;
    btn.textContent = 'Downloading…';
    try {
      const baseName = App.sanitizeForFilename(state.currentProjectName);
      const filename = (preset && preset.filename) || ('takeoff-specific-pages_' + baseName + '.pdf');
      // Bid basis: ask WHERE to save before the render (the save picker needs the click's
      // user activation, which a minutes-long export would spend) — features/bid-basis.js.
      let save = null;
      if (preset && preset.preset === 'bid-basis' && App.beginBidBasisSave) {
        save = await App.beginBidBasisSave(filename);
        if (save && save.cancelled) {
          btn.textContent = origText;
          App.showToast && App.showToast('Download cancelled — nothing was saved. Click Download to try again.', 3500);
          openSpecificPagesModal(preset);
          return;
        }
      }
      const { doc, included } = await runSpecificPagesExport(options, (text) => { btn.textContent = text; });
      if (doc) {
        let saved = { filename, saveMethod: 'intended' };
        if (save && save.handle && App.finishBidBasisSave) saved = await App.finishBidBasisSave(save.handle, doc, filename);
        else doc.save(filename);
        App.logUserEvent('export_pdf', state.currentProjectId, { source: preset ? preset.preset : 'specific-pages' });
        if (preset && preset.preset === 'bid-basis' && App.onBidBasisExported) {
          App.onBidBasisExported({ doc, included, filename: saved.filename, saveMethod: saved.saveMethod, options, preset });
        } else {
          App.showBidCheckAdvisory && App.showBidCheckAdvisory('export-pdfs');   // S5: advisory, never a block
        }
      }
    } catch (err) {
      console.error(err);
      alert('Download failed: ' + (err.message || err));
    }
    btn.textContent = origText;
  }

  document.getElementById('specificPages').onclick = () => openSpecificPagesModal();
  document.getElementById('specificPagesCancel').onclick = () => App.hideModal('specificPagesModal');
  document.getElementById('specificPagesDownload').onclick = downloadSpecificPages;
  document.getElementById('specificPagesMarksOnly').onclick = () => setSpecificPagesToMarksOnly();
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
  App.setSpecificPagesToMarksOnly = setSpecificPagesToMarksOnly;
  App.readSpecificPagesOptionsFromDom = readSpecificPagesOptionsFromDom;
  App.runSpecificPagesExport = runSpecificPagesExport;
  // Spec seam: a copy of the dialog's current per-page selection.
  App.getSpecificPagesSelections = () => ({ selections: { ...specificPagesSelections }, canvasMode: { ...specificPagesCanvasMode }, preset: activePreset ? { ...activePreset } : null });
})();

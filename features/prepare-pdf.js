(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // Prepare PDF modal (page trim/rotate/name + commit-into-app) -- extracted from
  // app.js via the window.App registry. T2-15: the default view is a sheet
  // THUMBNAIL GRID with tap-to-keep/drop + Keep all/none (lazy
  // IntersectionObserver thumbs through the App.rasterPdf render-service seam,
  // per-modal cache keyed origIdx:rotation); the single-sheet Prev/Next walk
  // survives as the per-tile zoom view. The PDF upload/file handler, loadTestPdf,
  // and the shared PDF helpers stay in app.js; the modal's #preparePdf* bindings
  // run at load below. Other flows open it via App.openPreparePdfModal().
  // Shared deps are read from App.* at call time (never captured at load):
  // sanitizeForFilename / downloadPdfBuffer are registered by
  // features/output.js, which loads AFTER this file.

  let preparePdfPages = [];
  let preparePdfBuffer = null;
  let preparePdfPageBytes = {};
  let preparePdfKeptIndices = [];
  let preparePdfUndoStack = [];
  let preparePdfCurrentIdx = 0;
  let preparePdfDefaultName = 'Untitled';
  let preparePdfEditMode = 'project';
  // #7a: Distinguishes "fresh PDF project" (default) from "append pages to
  // existing project". In append mode openPreparePdfModal hides the project
  // name editor and commitPreparePdfToState merges the trimmed buffer onto
  // state.pdfBuffer + appends new state.pages entries instead of replacing.
  let preparePdfMode = 'project';
  let preparePdfProjectName = 'Untitled';
  // T2-15: the sheet grid REPLACES the Prev/Next walk as the modal's default
  // view; the single-sheet preview survives as the per-tile zoom view.
  // 'grid' | 'sheet' — toggled by updatePreparePdfView().
  let preparePdfView = 'grid';
  let preparePdfTotalAtOpen = 0;   // original page count, for the prepare_trim event
  // Thumbnail pipeline state (summary-detail's generation-token pattern married
  // to the render-service seam): a per-modal Map cache keyed origIdx:rotation
  // (rotating a sheet in the zoom view invalidates exactly one entry), a lazy
  // IntersectionObserver queue, and a single-flight drain loop. All cleared on
  // close; the gen token invalidates any in-flight loop.
  let preparePdfThumbCache = new Map();
  let preparePdfThumbGen = 0;
  let preparePdfThumbQueue = [];
  let preparePdfThumbDraining = false;
  let inFlightThumbTask = null;
  let preparePdfGridObserver = null;
  const PREPARE_THUMB_W = 140;

  function updatePreparePdfView() {
    const gridWrap = document.getElementById('preparePdfGridWrap');
    const sheetWrap = document.getElementById('preparePdfSheetWrap');
    if (gridWrap) gridWrap.style.display = preparePdfView === 'grid' ? '' : 'none';
    if (sheetWrap) sheetWrap.style.display = preparePdfView === 'sheet' ? '' : 'none';
  }
  function updatePreparePdfGridStatus() {
    const el = document.getElementById('preparePdfGridStatus');
    if (el) el.textContent = 'Keeping ' + preparePdfKeptIndices.length + ' of ' + preparePdfPages.length + ' sheets';
  }
  function preparePdfTileLabel(page, origIdx) {
    const base = 'p' + (origIdx + 1);
    return page && page.label ? base + ' · ' + page.label : base;
  }
  function resetPreparePdfThumbPipeline() {
    preparePdfThumbGen++;
    preparePdfThumbQueue = [];
    if (inFlightThumbTask) { try { inFlightThumbTask.cancel(); } catch (_) {} inFlightThumbTask = null; }
    if (preparePdfGridObserver) { try { preparePdfGridObserver.disconnect(); } catch (_) {} preparePdfGridObserver = null; }
  }
  function renderPreparePdfGrid() {
    const grid = document.getElementById('preparePdfGrid');
    if (!grid) return;
    resetPreparePdfThumbPipeline();   // gen bump cancels any prior drain; the cache survives
    grid.innerHTML = '';
    preparePdfGridObserver = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        preparePdfGridObserver.unobserve(en.target);
        enqueuePreparePdfThumb(Number(en.target.dataset.origIdx));
      }
    }, { root: grid });
    const kept = preparePdfKeptIndices;
    for (let i = 0; i < preparePdfPages.length; i++) {
      const page = preparePdfPages[i];
      const tile = document.createElement('div');
      tile.className = 'prepare-pdf-tile' + (kept.includes(i) ? '' : ' dropped');
      tile.dataset.origIdx = String(i);
      const thumb = document.createElement('div');
      thumb.className = 'prepare-pdf-tile-thumb';
      const rot = (page && page.rotation) ?? 0;
      const cached = preparePdfThumbCache.get(i + ':' + rot);
      if (cached) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = cached;
        thumb.appendChild(img);
      } else {
        thumb.textContent = String(i + 1);
      }
      tile.appendChild(thumb);
      const label = document.createElement('div');
      label.className = 'prepare-pdf-tile-label';
      label.textContent = preparePdfTileLabel(page, i);
      label.title = (page && page.label) || ('Page ' + (i + 1));
      tile.appendChild(label);
      const zoom = document.createElement('button');
      zoom.type = 'button';
      zoom.className = 'prepare-pdf-tile-zoom';
      zoom.title = 'Open this sheet';
      zoom.setAttribute('aria-label', 'Open this sheet');
      zoom.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14"><path fill="currentColor" d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>';
      tile.appendChild(zoom);
      grid.appendChild(tile);
      if (!cached) preparePdfGridObserver.observe(tile);
    }
    updatePreparePdfGridStatus();
  }
  function setPreparePdfTileThumb(origIdx, dataUrl) {
    const grid = document.getElementById('preparePdfGrid');
    const tile = grid && grid.querySelector('.prepare-pdf-tile[data-orig-idx="' + origIdx + '"]');
    const thumbEl = tile && tile.querySelector('.prepare-pdf-tile-thumb');
    if (!thumbEl) return;
    let img = thumbEl.querySelector('img');
    if (!img) {
      thumbEl.textContent = '';
      img = document.createElement('img');
      img.alt = '';
      thumbEl.appendChild(img);
    }
    img.src = dataUrl;
  }
  function enqueuePreparePdfThumb(origIdx) {
    if (!Number.isInteger(origIdx)) return;
    preparePdfThumbQueue.push(origIdx);
    drainPreparePdfThumbQueue();
  }
  async function drainPreparePdfThumbQueue() {
    if (preparePdfThumbDraining) return;
    preparePdfThumbDraining = true;
    const gen = preparePdfThumbGen;
    try {
      while (preparePdfThumbQueue.length) {
        if (gen !== preparePdfThumbGen) return;
        const origIdx = preparePdfThumbQueue.shift();
        const page = preparePdfPages[origIdx];
        if (!page || !page.pdfPage) continue;
        const rot = page.rotation ?? 0;
        const key = origIdx + ':' + rot;
        let dataUrl = preparePdfThumbCache.get(key);
        if (!dataUrl) {
          try {
            const vp = page.pdfPage.getViewport({ scale: 1, rotation: rot });
            const scale = PREPARE_THUMB_W / vp.width;
            const viewport = page.pdfPage.getViewport({ scale, rotation: rot });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(viewport.width));
            canvas.height = Math.max(1, Math.round(viewport.height));
            // Off-main-thread when the render worker is eligible; automatic
            // MAIN fallback is the seam's contract. Prepare pages carry no
            // annotations yet, so renderAnnotationsToContext is skipped.
            inFlightThumbTask = App.rasterPdf({ pdfPage: page.pdfPage, scale, rotation: rot, canvasContext: canvas.getContext('2d'), kind: 'thumb' });
            await inFlightThumbTask.promise;
            inFlightThumbTask = null;
            if (gen !== preparePdfThumbGen) return;
            dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            preparePdfThumbCache.set(key, dataUrl);
          } catch (_) {
            // RenderingCancelledException on close is expected; any per-page
            // failure just leaves the placeholder (summary-detail pattern).
            inFlightThumbTask = null;
            continue;
          }
        }
        setPreparePdfTileThumb(origIdx, dataUrl);
      }
    } finally {
      preparePdfThumbDraining = false;
      // A grid rebuild mid-drain bumps the gen and returns this loop early;
      // anything enqueued for the NEW gen since then still needs a drain.
      if (preparePdfThumbQueue.length && preparePdfThumbGen !== gen) drainPreparePdfThumbQueue();
    }
  }
  function setPreparePdfKeptTo(indices) {
    preparePdfKeptIndices = indices;
    preparePdfCurrentIdx = Math.min(preparePdfCurrentIdx, Math.max(0, preparePdfKeptIndices.length - 1));
    const grid = document.getElementById('preparePdfGrid');
    if (grid) {
      grid.querySelectorAll('.prepare-pdf-tile').forEach((tile) => {
        tile.classList.toggle('dropped', !preparePdfKeptIndices.includes(Number(tile.dataset.origIdx)));
      });
    }
    updatePreparePdfGridStatus();
    updatePreparePdfControls();
  }
  function togglePreparePdfTile(origIdx, tile) {
    const kept = preparePdfKeptIndices;
    const pos = kept.indexOf(origIdx);
    if (pos >= 0) kept.splice(pos, 1);
    else { kept.push(origIdx); kept.sort((a, b) => a - b); }
    preparePdfCurrentIdx = Math.min(preparePdfCurrentIdx, Math.max(0, kept.length - 1));
    // Grid taps do NOT touch preparePdfUndoStack — tap-again is the undo; the
    // stack still serves sheet-view Delete unchanged.
    tile.classList.toggle('dropped', pos >= 0);
    updatePreparePdfGridStatus();
    updatePreparePdfControls();
  }
  function openPreparePdfSheetView(origIdx) {
    const idx = preparePdfKeptIndices.indexOf(origIdx);
    if (idx < 0) return;   // zoom is hidden on dropped tiles; invariant holds
    preparePdfCurrentIdx = idx;
    preparePdfView = 'sheet';
    updatePreparePdfView();
    renderPreparePdfPreview();
    updatePreparePdfControls();
  }
  function renderPreparePdfPreview() {
    const canvas = document.getElementById('preparePdfCanvas');
    const labelEl = document.getElementById('preparePdfPageLabel');
    const kept = preparePdfKeptIndices;
    if (!kept.length || !preparePdfPages.length) {
      canvas.width = 0;
      canvas.height = 0;
      labelEl.textContent = 'No pages';
      return;
    }
    const origIdx = kept[preparePdfCurrentIdx];
    const page = preparePdfPages[origIdx];
    if (!page || !page.pdfPage) {
      canvas.width = 0;
      canvas.height = 0;
      labelEl.textContent = 'Page ' + (preparePdfCurrentIdx + 1) + ' of ' + kept.length;
      return;
    }
    const maxH = 400;
    const rot = page.rotation ?? 0;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: rot });
    const scale = Math.min(1, maxH / vp.height);
    const viewport = page.pdfPage.getViewport({ scale, rotation: rot });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    // Contain-fit inside the FIXED-height preview wrap: both max constraints
    // with auto dims letterbox the page, so rotating between portrait and
    // landscape never changes the wrap's height — the Prev/Next and
    // Delete/Rotate/Undo rows below stay put (Wendi, 2026-08-13).
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.width = 'auto';
    canvas.style.height = 'auto';
    const wIn = (vp.width / 72).toFixed(1);
    const hIn = (vp.height / 72).toFixed(1);
    const fmt = (b) => (b / (1024 * 1024)) < 0.01 ? (b / 1024).toFixed(2) + ' KB' : (b / (1024 * 1024)).toFixed(2) + ' MB';
    let sizeStr = '';
    if (preparePdfBuffer) {
      const totalBytes = preparePdfBuffer.byteLength;
      const pageBytes = preparePdfPageBytes[origIdx];
      if (pageBytes != null) {
        sizeStr = ' — This page: ' + fmt(pageBytes) + ' — Total: ' + fmt(totalBytes);
      } else {
        sizeStr = ' — Total: ' + fmt(totalBytes);
      }
    }
    labelEl.textContent = 'Page ' + (preparePdfCurrentIdx + 1) + ' of ' + kept.length + ' — ' + wIn + ' × ' + hIn + ' in' + sizeStr;
    page.pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport });
    const nameEl = document.getElementById('preparePdfName');
    if (nameEl && preparePdfEditMode === 'page') nameEl.value = page.label || ('Page ' + (preparePdfCurrentIdx + 1));
  }
  function saveCurrentPageName() {
    const kept = preparePdfKeptIndices;
    if (!kept.length || preparePdfCurrentIdx >= kept.length) return;
    const origIdx = kept[preparePdfCurrentIdx];
    const page = preparePdfPages[origIdx];
    if (!page) return;
    const nameEl = document.getElementById('preparePdfName');
    if (nameEl && preparePdfEditMode === 'page') page.label = (nameEl.value || '').trim() || ('Page ' + (preparePdfCurrentIdx + 1));
  }
  function updatePreparePdfControls() {
    const kept = preparePdfKeptIndices;
    document.getElementById('preparePdfUndo').disabled = preparePdfUndoStack.length === 0;
    document.getElementById('preparePdfDelete').disabled = kept.length <= 1;
    document.getElementById('preparePdfRotate').disabled = kept.length === 0;
    document.getElementById('preparePdfPrev').disabled = preparePdfCurrentIdx <= 0;
    document.getElementById('preparePdfNext').disabled = preparePdfCurrentIdx >= kept.length - 1;
    document.getElementById('preparePdfDone').disabled = kept.length === 0;
    const downloadEl = document.getElementById('preparePdfDownload');
    if (downloadEl) downloadEl.disabled = kept.length === 0;
    const saveAndOpenEl = document.getElementById('preparePdfSaveAndOpen');
    if (saveAndOpenEl) saveAndOpenEl.disabled = kept.length === 0;
  }
  function openPreparePdfModal(pages, buffer, defaultName, opts) {
    opts = opts || {};
    preparePdfMode = opts.mode === 'append' ? 'append' : 'project';
    preparePdfPages = pages.map(p => ({ pdfPage: p.pdfPage, label: p.label, rotation: p.rotation ?? 0 }));
    preparePdfBuffer = buffer;
    preparePdfPageBytes = {};
    preparePdfKeptIndices = pages.map((_, i) => i);
    preparePdfUndoStack = [];
    preparePdfCurrentIdx = 0;
    preparePdfDefaultName = defaultName || 'Untitled';
    preparePdfProjectName = preparePdfDefaultName;
    preparePdfEditMode = 'project';
    document.getElementById('preparePdfName').value = preparePdfProjectName;
    document.getElementById('preparePdfProjectTab').classList.add('active');
    document.getElementById('preparePdfPageTab').classList.remove('active');
    // #7a: In append mode hide the project-name editor (we are not renaming
    // the current project) and adjust the title/description.
    const titleEl = document.getElementById('preparePdfTitle');
    const descEl = document.getElementById('preparePdfDescription');
    const nameRowEl = document.getElementById('preparePdfNameRow');
    if (preparePdfMode === 'append') {
      if (titleEl) titleEl.textContent = 'Add pages — ' + (App.state.currentProjectName || 'Untitled');
      if (descEl) descEl.textContent = 'Tap the sheets you don’t need, then add the rest to the project.';
      if (nameRowEl) nameRowEl.style.display = 'none';
    } else {
      if (titleEl) titleEl.textContent = 'Prepare PDF for Cloud';
      if (descEl) descEl.textContent = 'Name your project, then tap the sheets you don’t need — or Keep none and tap the ones you do.';
      if (nameRowEl) nameRowEl.style.display = '';
    }
    // T2-15: the grid is the default view in BOTH fresh and append modes; the
    // single-sheet walk is reached per tile via the zoom button.
    preparePdfTotalAtOpen = preparePdfPages.length;
    preparePdfView = 'grid';
    preparePdfThumbCache = new Map();
    resetPreparePdfThumbPipeline();
    updatePreparePdfView();
    renderPreparePdfGrid();
    updatePreparePdfControls();
    App.showModal('preparePdfModal');
    (async function computePageSizes() {
      if (typeof PDFLib === 'undefined' || !preparePdfBuffer) return;
      const indices = [...preparePdfKeptIndices].sort((a, b) => a - b);
      for (const i of indices) {
        if (!preparePdfBuffer) return;
        try {
          const buf = await App.buildTrimmedPdfBuffer(preparePdfBuffer, [i]);
          if (buf) preparePdfPageBytes[i] = buf.byteLength;
        } catch (_) {}
        // Repaint the size readout only when the sheet view is actually
        // showing — in grid view this would raster a hidden canvas.
        if (preparePdfView === 'sheet' &&
            document.getElementById('preparePdfModal')?.classList.contains('visible')) {
          renderPreparePdfPreview();
        }
      }
    })();
  }
  function closePreparePdfModal() {
    preparePdfPages = [];
    preparePdfBuffer = null;
    preparePdfPageBytes = {};
    preparePdfKeptIndices = [];
    preparePdfUndoStack = [];
    // Cancel the thumb pipeline (gen bump + in-flight cancel + observer
    // disconnect) and free the per-modal cache / tile dataURLs.
    resetPreparePdfThumbPipeline();
    preparePdfThumbCache = new Map();
    const grid = document.getElementById('preparePdfGrid');
    if (grid) grid.innerHTML = '';
    App.hideModal('preparePdfModal');
  }
  window.closePreparePdfModal = closePreparePdfModal;
  document.getElementById('preparePdfCancel').onclick = () => closePreparePdfModal();
  // T2-15: grid bindings — one delegated tile listener (zoom button → sheet
  // view; anywhere else on the tile → toggle keep/drop) + the bulk buttons +
  // the sheet view's way back.
  document.getElementById('preparePdfGrid').onclick = (e) => {
    const tile = e.target.closest('.prepare-pdf-tile');
    if (!tile) return;
    const origIdx = Number(tile.dataset.origIdx);
    if (e.target.closest('.prepare-pdf-tile-zoom')) { openPreparePdfSheetView(origIdx); return; }
    togglePreparePdfTile(origIdx, tile);
  };
  document.getElementById('preparePdfKeepAll').onclick = () => {
    setPreparePdfKeptTo(preparePdfPages.map((_, i) => i));
  };
  document.getElementById('preparePdfKeepNone').onclick = () => {
    setPreparePdfKeptTo([]);
  };
  document.getElementById('preparePdfBackToGrid').onclick = () => {
    saveCurrentPageName();
    preparePdfView = 'grid';
    updatePreparePdfView();
    // Re-render re-reads labels renamed via the "> Page Name" tab; a sheet
    // rotated in the zoom view gets a new cache key, so its tile re-rasters
    // on next visibility.
    renderPreparePdfGrid();
    updatePreparePdfControls();
  };
  (function() {
    const projectTab = document.getElementById('preparePdfProjectTab');
    const pageTab = document.getElementById('preparePdfPageTab');
    const nameInput = document.getElementById('preparePdfName');
    function switchToProject() {
      saveCurrentPageName();
      preparePdfEditMode = 'project';
      nameInput.value = preparePdfProjectName;
      nameInput.placeholder = 'Untitled';
      projectTab.classList.add('active');
      pageTab.classList.remove('active');
    }
    function switchToPage() {
      preparePdfProjectName = (nameInput.value || '').trim() || preparePdfDefaultName;
      preparePdfEditMode = 'page';
      const kept = preparePdfKeptIndices;
      const origIdx = kept.length && preparePdfCurrentIdx < kept.length ? kept[preparePdfCurrentIdx] : 0;
      const page = preparePdfPages[origIdx];
      nameInput.value = page?.label || ('Page ' + (preparePdfCurrentIdx + 1));
      nameInput.placeholder = 'Page 1';
      projectTab.classList.remove('active');
      pageTab.classList.add('active');
    }
    projectTab.onclick = () => { if (preparePdfEditMode !== 'project') switchToProject(); };
    pageTab.onclick = () => { if (preparePdfEditMode !== 'page') switchToPage(); };
    nameInput.onblur = () => {
      if (preparePdfEditMode === 'project') preparePdfProjectName = (nameInput.value || '').trim() || preparePdfDefaultName;
      else saveCurrentPageName();
    };
  })();
  document.getElementById('preparePdfUndo').onclick = () => {
    if (preparePdfUndoStack.length === 0) return;
    saveCurrentPageName();
    const { index } = preparePdfUndoStack.pop();
    preparePdfKeptIndices.push(index);
    preparePdfKeptIndices.sort((a, b) => a - b);
    const idxInKept = preparePdfKeptIndices.indexOf(index);
    if (idxInKept >= 0 && idxInKept <= preparePdfCurrentIdx) preparePdfCurrentIdx = Math.min(preparePdfCurrentIdx + 1, preparePdfKeptIndices.length - 1);
    renderPreparePdfPreview();
    updatePreparePdfControls();
  };
  document.getElementById('preparePdfDelete').onclick = () => {
    const kept = preparePdfKeptIndices;
    if (kept.length <= 1) return;
    saveCurrentPageName();
    const removed = kept.splice(preparePdfCurrentIdx, 1)[0];
    preparePdfUndoStack.push({ index: removed });
    if (preparePdfCurrentIdx >= kept.length) preparePdfCurrentIdx = Math.max(0, kept.length - 1);
    renderPreparePdfPreview();
    updatePreparePdfControls();
  };
  document.getElementById('preparePdfPrev').onclick = () => {
    if (preparePdfCurrentIdx > 0) {
      saveCurrentPageName();
      preparePdfCurrentIdx--;
      renderPreparePdfPreview();
      updatePreparePdfControls();
    }
  };
  document.getElementById('preparePdfNext').onclick = () => {
    if (preparePdfCurrentIdx < preparePdfKeptIndices.length - 1) {
      saveCurrentPageName();
      preparePdfCurrentIdx++;
      renderPreparePdfPreview();
      updatePreparePdfControls();
    }
  };
  function preparePdfRotatePage90() {
    const kept = preparePdfKeptIndices;
    if (!kept.length) return;
    const origIdx = kept[preparePdfCurrentIdx];
    const page = preparePdfPages[origIdx];
    if (!page || !page.pdfPage) return;
    page.rotation = ((page.rotation ?? 0) + 90) % 360;
    renderPreparePdfPreview();
  }
  document.getElementById('preparePdfRotate').onclick = preparePdfRotatePage90;
  async function commitPreparePdfToState() {
    try {
    const nameInput = document.getElementById('preparePdfName');
    if (preparePdfMode !== 'append') {
      if (preparePdfEditMode === 'project') preparePdfProjectName = (nameInput?.value || '').trim() || preparePdfDefaultName;
      else saveCurrentPageName();
    } else {
      // In append mode the project name is locked - keep page-label edits.
      if (preparePdfEditMode === 'page') saveCurrentPageName();
    }
    const kept = preparePdfKeptIndices;
    if (!kept.length || !preparePdfBuffer) return { ok: false };
    const name = preparePdfMode === 'append'
      ? (App.state.currentProjectName || preparePdfDefaultName)
      : (preparePdfProjectName || preparePdfDefaultName);
    const trimmedBuf = kept.length === preparePdfPages.length
      ? preparePdfBuffer
      : await App.buildTrimmedPdfBuffer(preparePdfBuffer, kept);
    if (!trimmedBuf) return { ok: false };
    const trimmedBufSize = trimmedBuf.byteLength ?? trimmedBuf.length ?? trimmedBuf.size ?? 0;
    if (preparePdfMode === 'append') {
      // #7a: Merge the new trimmed buffer onto the existing project buffer and
      // append pages. Enforce the size ceiling on the MERGED result so we do
      // not blow past the 50 MB cloud storage cap.
      const existingBuf = App.state.pdfBuffer;
      const existingSize = existingBuf ? (existingBuf.byteLength ?? existingBuf.length ?? 0) : 0;
      // Pre-flight size check (worst-case sum) to avoid a wasted merge of a
      // buffer that obviously cannot fit. The post-merge check below is the
      // authoritative gate.
      const projectedSize = existingSize + trimmedBufSize;
      const preCheck = App.assertPdfWithinLimit(projectedSize, 'commitPreparePdfToState.append.pre');
      if (preCheck && !preCheck.ok) {
        try { alert(preCheck.message); } catch (_) {}
        return { ok: false, error: preCheck.message };
      }
      if (!existingBuf) {
        // Append mode requires the current project's PDF buffer to be in
        // memory so we can merge onto it. Bail with a clear error rather than
        // silently replacing the project's PDF (which would orphan existing
        // page annotations).
        const msg = 'Could not load the current PDF to merge new pages. Save the project, then try again.';
        try { alert(msg); } catch (_) {}
        return { ok: false, error: msg };
      } else {
        const mergedBuf = await App.mergePdfBuffers([existingBuf, trimmedBuf]);
        if (!mergedBuf) return { ok: false, error: 'Failed to merge PDFs.' };
        const mergedSize = mergedBuf.byteLength ?? mergedBuf.length ?? mergedBuf.size ?? 0;
        const sizeCheck = App.assertPdfWithinLimit(mergedSize, 'commitPreparePdfToState.append.merged');
        if (sizeCheck && !sizeCheck.ok) {
          try { alert(sizeCheck.message); } catch (_) {}
          return { ok: false, error: sizeCheck.message };
        }
        const mergedPdf = await App.getPdfDocument(mergedBuf.slice(0)).promise;
        const startIdx = App.state.pages.length;
        const totalPages = mergedPdf.numPages;
        const newPages = [];
        for (let i = startIdx; i < totalPages; i++) {
          const pdfPage = await mergedPdf.getPage(i + 1);
          const keptOrigIdx = kept[i - startIdx];
          const label = preparePdfPages[keptOrigIdx]?.label || ('Page ' + (i + 1));
          const rotation = preparePdfPages[keptOrigIdx]?.rotation ?? 0;
          const canvasId = App.uid();
          newPages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: App.makeAnnotations() }], scale: null, rotation });
          App.state.activeCanvasIdByPage[i] = canvasId;
        }
        // Re-bind existing state.pages to the merged pdf so all pages share a
        // single pdfjs document. This avoids holding the old detached buffer.
        // Rebinding pdfPage proxies: drop any cached page bitmaps first so they
        // can't pin the old document (App.clearPdfBitmapCache is registered by
        // app.js, which always loads before this feature file).
        App.clearPdfBitmapCache && App.clearPdfBitmapCache();
        for (let i = 0; i < startIdx; i++) {
          if (App.state.pages[i]) App.state.pages[i].pdfPage = await mergedPdf.getPage(i + 1);
        }
        App.state.pages = App.state.pages.concat(newPages);
        App.state.pdfBuffer = mergedBuf;
        App.state.pdfBufferSize = mergedSize;
        // Pdf binary changed: clear the hash so the next manual save triggers
        // an upload. KEEP state.pdfStoragePath set to the previous cloud path
        // so performSaveProjectToCloud can clean it up via its prevPdfStoragePath
        // remove(). The path is replaced with the new uploaded path on save.
        App.state.pdfHash = null;
      }
      preparePdfPages = [];
      preparePdfBuffer = null;
      preparePdfKeptIndices = [];
      preparePdfUndoStack = [];
      return { ok: true, name, pdfBuffer: App.state.pdfBuffer, appended: true, appendedCount: kept.length };
    }
    const sizeCheck = App.assertPdfWithinLimit(trimmedBufSize, 'commitPreparePdfToState');
    if (sizeCheck && !sizeCheck.ok) {
      try { alert(sizeCheck.message); } catch (_) {}
      return { ok: false, error: sizeCheck.message };
    }
    const pdf = await App.getPdfDocument(trimmedBuf.slice(0)).promise;
    const numPages = pdf.numPages;
    App.clearPdfBitmapCache && App.clearPdfBitmapCache();
    App.state.pages = [];
    App.state.activeCanvasIdByPage = {};
    for (let i = 0; i < numPages; i++) {
      const pdfPage = await pdf.getPage(i + 1);
      const origIdx = kept[i];
      const label = preparePdfPages[origIdx]?.label || ('Page ' + (i + 1));
      const rotation = preparePdfPages[origIdx]?.rotation ?? 0;
      const canvasId = App.uid();
      App.state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: App.makeAnnotations() }], scale: null, rotation });
      App.state.activeCanvasIdByPage[i] = canvasId;
    }
    App.state.pdfBuffer = trimmedBuf;
    App.state.pdfBufferSize = trimmedBufSize;
    App.state.pdfStoragePath = null;
    App.state.currentProjectName = (name || '').trim() || preparePdfDefaultName;
    App.state.currentPage = 0;
    preparePdfPages = [];
    preparePdfBuffer = null;
    preparePdfKeptIndices = [];
    preparePdfUndoStack = [];
    App.resetGridOrigin();
    return { ok: true, name, pdfBuffer: trimmedBuf };
    } catch (e) {
      console.error('[Prepare PDF]', e);
      return { ok: false };
    }
  }
  // T2-15: prepare_trim telemetry — kept/mode captured BEFORE the commit
  // (commitPreparePdfToState clears preparePdfKeptIndices on success).
  function capturePrepareTrimMeta() {
    const kept = preparePdfKeptIndices.length;
    return { total: preparePdfTotalAtOpen, kept, dropped: preparePdfTotalAtOpen - kept, mode: preparePdfMode };
  }
  document.getElementById('preparePdfDone').onclick = async () => {
    const trimMeta = capturePrepareTrimMeta();
    const r = await commitPreparePdfToState();
    if (!r.ok) { if (!r.error) alert('Failed to build PDF.'); return; }
    App.logUserEvent('prepare_trim', App.state.currentProjectId || null, trimMeta);
    App.hideModal('preparePdfModal');
    App.markProjectDirty();
    App.updateUI();
    requestAnimationFrame(() => { App.fitZoom(); App.renderPdf(); });
    // J2 friction #8 parity: the Project-Settings append commit gets the same
    // "Added N sheets" feedback as the Upload-PDF append path (T1-08).
    if (r.appended) {
      const added = r.appendedCount || 0;
      App.showToast('Added ' + added + ' sheet' + (added === 1 ? '' : 's') + ' to ' +
        (App.state.currentProjectName || 'Untitled'), 3500);
    }
    await App.writeTakeoffStateBackup();
  };
  document.getElementById('preparePdfDownload').onclick = async () => {
    const kept = preparePdfKeptIndices;
    if (!kept.length || !preparePdfBuffer) return;
    const trimmedBuf = kept.length === preparePdfPages.length
      ? preparePdfBuffer
      : await App.buildTrimmedPdfBuffer(preparePdfBuffer, kept);
    if (!trimmedBuf) { alert('Failed to build PDF.'); return; }
    const name = preparePdfProjectName || preparePdfDefaultName;
    App.downloadPdfBuffer(trimmedBuf, App.sanitizeForFilename(name) + '.pdf');
  };
  document.getElementById('preparePdfSaveAndOpen').onclick = async () => {
    const trimMeta = capturePrepareTrimMeta();
    const r = await commitPreparePdfToState();
    if (!r.ok) { if (!r.error) alert('Failed to build PDF.'); return; }
    App.logUserEvent('prepare_trim', App.state.currentProjectId || null, trimMeta);
    App.hideModal('preparePdfModal');
    App.markProjectDirty();
    App.updateUI();
    requestAnimationFrame(() => { App.fitZoom(); App.renderPdf(); });
    // B2 / J2 friction #8 parity: an append committed through Save & Open gets
    // the same "Added N sheets" feedback as the Open commit above. (A save
    // failure toast below may replace it — the failure is the more urgent news.)
    if (r.appended) {
      const added = r.appendedCount || 0;
      App.showToast('Added ' + added + ' sheet' + (added === 1 ? '' : 's') + ' to ' +
        (App.state.currentProjectName || 'Untitled'), 3500);
    }
    const saveResult = await App.performSaveProjectToCloud({ name: r.name, includePdf: true, pdfBuffer: r.pdfBuffer });
    if (!saveResult.ok) {
      if (App.isAuthError(saveResult.error)) {
        App.showToast('Refresh the page to sync.', 4000);
      } else {
        const errMsg = (saveResult.error?.message) || (saveResult.error?.details) || (saveResult.error?.hint) || String(saveResult.error) || 'Save failed';
        App.showToast('Save failed: ' + errMsg + '. Open Project Settings to retry.', 4000);
      }
    }
  };

  App.openPreparePdfModal = openPreparePdfModal;
})();

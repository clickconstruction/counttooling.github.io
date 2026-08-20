(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // Prepare PDF modal (page trim/rotate/name + commit-into-app) -- extracted from
  // app.js via the window.App registry. The PDF upload/file handler, loadTestPdf,
  // and the shared PDF helpers stay in app.js; the modal's #preparePdf* bindings
  // run at load below. Other flows open it via App.openPreparePdfModal().
  // Shared deps are read from App.* at call time (never captured at load):
  // sanitizeForFilename / downloadPdfBuffer are registered by
  // features/output.js, which loads AFTER this file.
  //
  // JOURNEY-MAP Tier-2 #26: trimming a 200-sheet set was strictly
  // one-sheet-at-a-time (~185 clicks to reach a 15-sheet P-set). The modal now
  // opens on a THUMBNAIL GRID of every sheet — tap toggles keep/drop, with
  // Keep all / Drop all / Invert bulk actions and shift-click range toggling.
  // The single-sheet preview survives as the zoom view (per-cell magnifier or
  // the "All sheets" button to come back); it walks ALL sheets (kept and
  // dropped) and its Delete button became a Drop/Restore toggle. Undo is one
  // step per USER ACTION (the stack holds kept-set snapshots, so a bulk drop
  // undoes in one press), and Ctrl/Cmd+Z is captured while the modal is open
  // so it cannot leak into the app's annotation undo behind the overlay.
  //
  // Thumbnails are rasterised by a modal-local lazy queue (IntersectionObserver
  // + serial render pump) at ~140 CSS px wide, dpr-capped — NOT via
  // pdf-tile-cache.js: that LRU is the main-canvas substrate, keyed and
  // budgeted for full-size zoom-rung page bitmaps wired to app.js's render
  // loop; pushing 200 thumb-size entries through it would evict the bitmaps
  // it exists to keep and buys nothing for one-shot thumbs that die with the
  // modal. The grid DOM (and so every thumb canvas) is torn down on close.
  // The old open-time eager loop that built a trimmed PDF per page just to
  // show byte sizes (200 pdf-lib document builds on open for a 200-sheet set)
  // is gone; the size is computed lazily for the sheet shown in single view.

  let preparePdfPages = [];
  let preparePdfBuffer = null;
  let preparePdfPageBytes = {};
  let preparePdfKeptIndices = [];
  // Undo stack of kept-set SNAPSHOTS: one entry per user action (single
  // toggle, range toggle, or bulk keep/drop/invert), so undo is one press per
  // action — not one per sheet.
  let preparePdfUndoStack = [];
  // ORIGINAL page index shown by the single-sheet (zoom) view. The single
  // view walks ALL sheets, kept and dropped.
  let preparePdfCurrentIdx = 0;
  let preparePdfDefaultName = 'Untitled';
  let preparePdfEditMode = 'project';
  // #7a: Distinguishes "fresh PDF project" (default) from "append pages to
  // existing project". In append mode openPreparePdfModal hides the project
  // name editor and commitPreparePdfToState merges the trimmed buffer onto
  // state.pdfBuffer + appends new state.pages entries instead of replacing.
  let preparePdfMode = 'project';
  let preparePdfProjectName = 'Untitled';
  let preparePdfView = 'grid'; // 'grid' (default) | 'single'
  let preparePdfGen = 0; // bumped on open/close; stale async work checks it
  let preparePdfRangeAnchor = null; // { idx, dropped } for shift-click ranges
  const preparePdfPageBytesInFlight = new Set();
  const PREPARE_PDF_UNDO_MAX = 200;

  function preparePdfIsKept(idx) { return preparePdfKeptIndices.indexOf(idx) !== -1; }
  function preparePdfPushUndo() {
    preparePdfUndoStack.push(preparePdfKeptIndices.slice());
    if (preparePdfUndoStack.length > PREPARE_PDF_UNDO_MAX) preparePdfUndoStack.shift();
  }
  function preparePdfSetKeptSet(indices) {
    preparePdfKeptIndices = [...new Set(indices)].sort((a, b) => a - b);
  }

  // --- Grid view (default): scoped styles + DOM are owned by this feature ---
  // Minimal scoped styles injected here (NOT styles.css — another lane owns
  // that file); every selector is #preparePdfModal-scoped.
  function injectPreparePdfGridStyles() {
    if (document.getElementById('preparePdfGridStyles')) return;
    const st = document.createElement('style');
    st.id = 'preparePdfGridStyles';
    st.textContent = [
      '#preparePdfModal .ppg-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }',
      '#preparePdfModal .ppg-toolbar button { padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; font-family: inherit; cursor: pointer; background: var(--surface2); border: 1px solid var(--border); color: var(--text); }',
      '#preparePdfModal .ppg-toolbar button:hover:not(:disabled) { background: var(--surface3); border-color: var(--border2); }',
      '#preparePdfModal .ppg-toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }',
      '#preparePdfModal .ppg-count { margin-left: auto; font-size: 0.85rem; color: var(--text2); }',
      '#preparePdfModal .ppg-hint { width: 100%; font-size: 0.75rem; color: var(--text3); }',
      '#preparePdfModal #preparePdfGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; max-height: min(460px, 55vh); overflow-y: auto; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; }',
      '#preparePdfModal .ppg-cell { position: relative; border: 2px solid var(--border); border-radius: 6px; background: var(--surface); cursor: pointer; padding: 4px; display: flex; flex-direction: column; gap: 4px; user-select: none; }',
      '#preparePdfModal .ppg-cell:hover { border-color: var(--accent); }',
      '#preparePdfModal .ppg-thumbwrap { height: 120px; display: flex; align-items: center; justify-content: center; overflow: hidden; }',
      '#preparePdfModal .ppg-thumbwrap canvas { max-width: 100%; max-height: 100%; width: auto; height: auto; }',
      '#preparePdfModal .ppg-caption { font-size: 0.72rem; color: var(--text2); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '#preparePdfModal .ppg-cell.ppg-dropped { border-color: var(--red); }',
      '#preparePdfModal .ppg-cell.ppg-dropped .ppg-thumbwrap { opacity: 0.3; }',
      '#preparePdfModal .ppg-cell.ppg-dropped::after { content: "Dropped"; position: absolute; top: 42px; left: 50%; transform: translateX(-50%); background: var(--red); color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; pointer-events: none; }',
      '#preparePdfModal .ppg-cellbtns { position: absolute; top: 4px; right: 4px; display: flex; gap: 4px; }',
      '#preparePdfModal .ppg-cellbtns button { width: 24px; height: 24px; padding: 0; border-radius: 4px; border: 1px solid var(--border); background: var(--surface); color: var(--text2); font-size: 0.85rem; line-height: 1; cursor: pointer; }',
      '#preparePdfModal .ppg-cellbtns button:hover { background: var(--surface3); color: var(--text); border-color: var(--border2); }',
    ].join('\n');
    document.head.appendChild(st);
  }

  function preparePdfEls() {
    const previewWrap = document.getElementById('preparePdfPreviewWrap');
    return {
      card: document.querySelector('#preparePdfModal .modal-card'),
      previewGroup: previewWrap ? previewWrap.parentElement : null,
      controls: document.querySelector('#preparePdfModal .prepare-pdf-controls'),
      grid: document.getElementById('preparePdfGrid'),
      gridWrap: document.getElementById('preparePdfGridWrap'),
    };
  }

  function ensurePreparePdfGridDom() {
    if (document.getElementById('preparePdfGridWrap')) return;
    injectPreparePdfGridStyles();
    const els = preparePdfEls();
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.id = 'preparePdfGridWrap';
    wrap.innerHTML =
      '<div class="ppg-toolbar">' +
      '<button type="button" id="preparePdfKeepAll">Keep all</button>' +
      '<button type="button" id="preparePdfDropAll">Drop all</button>' +
      '<button type="button" id="preparePdfInvert">Invert</button>' +
      '<button type="button" id="preparePdfGridUndo" disabled>Undo</button>' +
      '<span class="ppg-count" id="preparePdfKeptCount"></span>' +
      '<span class="ppg-hint">Tap a sheet to keep or drop it &middot; Shift-click toggles a range &middot; &#128269; opens the sheet</span>' +
      '</div>' +
      '<div id="preparePdfGrid"></div>';
    els.previewGroup.parentElement.insertBefore(wrap, els.previewGroup);
    // "All sheets" back-to-grid button joins the single-view nav row.
    const nav = els.controls.querySelector('.prepare-pdf-nav');
    const back = document.createElement('button');
    back.type = 'button';
    back.id = 'preparePdfBackToGrid';
    back.textContent = '⊞ All sheets';
    nav.insertBefore(back, nav.firstChild);
    back.onclick = () => { saveCurrentPageName(); setPreparePdfView('grid'); };
    document.getElementById('preparePdfKeepAll').onclick = () => {
      if (preparePdfKeptIndices.length === preparePdfPages.length) return;
      preparePdfPushUndo();
      preparePdfSetKeptSet(preparePdfPages.map((_, i) => i));
      refreshPreparePdfKeptUi();
    };
    document.getElementById('preparePdfDropAll').onclick = () => {
      if (!preparePdfKeptIndices.length) return;
      preparePdfPushUndo();
      preparePdfKeptIndices = [];
      refreshPreparePdfKeptUi();
    };
    document.getElementById('preparePdfInvert').onclick = () => {
      preparePdfPushUndo();
      preparePdfSetKeptSet(preparePdfPages.map((_, i) => i).filter((i) => !preparePdfIsKept(i)));
      refreshPreparePdfKeptUi();
    };
    document.getElementById('preparePdfGridUndo').onclick = () => preparePdfUndo();
    const gridEl = document.getElementById('preparePdfGrid');
    gridEl.addEventListener('click', (e) => {
      const rotateBtn = e.target.closest('.ppg-rotate');
      const zoomBtn = e.target.closest('.ppg-zoom');
      const cell = e.target.closest('.ppg-cell');
      if (!cell) return;
      const idx = Number(cell.dataset.idx);
      if (rotateBtn) { preparePdfRotateSheet(idx); return; }
      if (zoomBtn) { showPreparePdfSingleView(idx); return; }
      preparePdfToggleSheet(idx, e.shiftKey);
    });
  }

  function setPreparePdfView(view) {
    preparePdfView = view;
    const els = preparePdfEls();
    const grid = view === 'grid';
    if (els.gridWrap) els.gridWrap.style.display = grid ? '' : 'none';
    if (els.previewGroup) els.previewGroup.style.display = grid ? 'none' : '';
    if (els.controls) els.controls.style.display = grid ? 'none' : '';
    // The grid earns a wider card; the single-sheet zoom keeps the classic one.
    if (els.card) els.card.style.maxWidth = grid ? 'min(960px, 94vw)' : '520px';
    if (!grid) renderPreparePdfPreview();
    updatePreparePdfControls();
  }

  function showPreparePdfSingleView(idx) {
    saveCurrentPageName();
    preparePdfCurrentIdx = Math.max(0, Math.min(idx, preparePdfPages.length - 1));
    setPreparePdfView('single');
  }

  // --- Thumbnail rasterisation: lazy IntersectionObserver + serial pump ---
  let preparePdfThumbObserver = null;
  const preparePdfThumbQueue = [];
  let preparePdfThumbPumping = false;

  function queuePreparePdfThumb(idx) {
    if (preparePdfThumbQueue.indexOf(idx) === -1) preparePdfThumbQueue.push(idx);
    pumpPreparePdfThumbs();
  }
  async function pumpPreparePdfThumbs() {
    if (preparePdfThumbPumping) return;
    preparePdfThumbPumping = true;
    try {
      // Drain whatever is queued. The gen is re-read per item (NOT captured
      // for the loop): a close/reopen mid-pump bumps it and refills the queue,
      // and a gen-captured loop would exit early and strand the new items.
      while (preparePdfThumbQueue.length) {
        const idx = preparePdfThumbQueue.shift();
        await renderPreparePdfThumb(idx, preparePdfGen);
      }
    } finally {
      preparePdfThumbPumping = false;
    }
  }
  async function renderPreparePdfThumb(idx, gen) {
    const cell = document.querySelector('#preparePdfGrid .ppg-cell[data-idx="' + idx + '"]');
    const page = preparePdfPages[idx];
    if (!cell || !page || !page.pdfPage) return;
    const rot = page.rotation ?? 0;
    if (Number(cell.dataset.renderedRot) === rot && cell.dataset.rendered === '1') return;
    const canvas = cell.querySelector('canvas');
    if (!canvas) return;
    try {
      const vp1 = page.pdfPage.getViewport({ scale: 1, rotation: rot });
      // ~140 CSS px wide at dpr<=1.25: ~30k px / ~120KB RGBA per thumb, so a
      // 200-sheet grid tops out around 25MB — all released with the grid DOM.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const scale = Math.min((140 * dpr) / vp1.width, (190 * dpr) / vp1.height);
      const viewport = page.pdfPage.getViewport({ scale, rotation: rot });
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      await page.pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (gen !== preparePdfGen) return;
      cell.dataset.rendered = '1';
      cell.dataset.renderedRot = String(rot);
    } catch (_) { /* raced a close or a rotate re-queue; benign */ }
  }

  function buildPreparePdfGrid() {
    ensurePreparePdfGridDom();
    const gridEl = document.getElementById('preparePdfGrid');
    if (preparePdfThumbObserver) preparePdfThumbObserver.disconnect();
    preparePdfThumbQueue.length = 0;
    gridEl.innerHTML = '';
    preparePdfThumbObserver = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        queuePreparePdfThumb(Number(en.target.dataset.idx));
        preparePdfThumbObserver.unobserve(en.target);
      }
    }, { root: gridEl, rootMargin: '200px' });
    const frag = document.createDocumentFragment();
    preparePdfPages.forEach((page, i) => {
      const cell = document.createElement('div');
      cell.className = 'ppg-cell' + (preparePdfIsKept(i) ? '' : ' ppg-dropped');
      cell.dataset.idx = String(i);
      cell.title = 'Tap to keep/drop';
      const thumbwrap = document.createElement('div');
      thumbwrap.className = 'ppg-thumbwrap';
      thumbwrap.appendChild(document.createElement('canvas'));
      cell.appendChild(thumbwrap);
      const caption = document.createElement('div');
      caption.className = 'ppg-caption';
      caption.textContent = (i + 1) + ' · ' + (page.label || 'Page ' + (i + 1));
      cell.appendChild(caption);
      const btns = document.createElement('div');
      btns.className = 'ppg-cellbtns';
      const rotateBtn = document.createElement('button');
      rotateBtn.type = 'button';
      rotateBtn.className = 'ppg-rotate';
      rotateBtn.title = 'Rotate 90°';
      rotateBtn.textContent = '⟳';
      const zoomBtn = document.createElement('button');
      zoomBtn.type = 'button';
      zoomBtn.className = 'ppg-zoom';
      zoomBtn.title = 'Open sheet';
      zoomBtn.textContent = '🔍';
      btns.appendChild(rotateBtn);
      btns.appendChild(zoomBtn);
      cell.appendChild(btns);
      frag.appendChild(cell);
      preparePdfThumbObserver.observe(cell);
    });
    gridEl.appendChild(frag);
  }

  function teardownPreparePdfGrid() {
    preparePdfGen++;
    if (preparePdfThumbObserver) { preparePdfThumbObserver.disconnect(); preparePdfThumbObserver = null; }
    preparePdfThumbQueue.length = 0;
    const gridEl = document.getElementById('preparePdfGrid');
    if (gridEl) gridEl.innerHTML = ''; // drops every thumb canvas -> memory released
    preparePdfPageBytesInFlight.clear();
  }

  // --- Keep/drop mutations (each is ONE undo step) ---
  function preparePdfToggleSheet(idx, shiftKey) {
    if (idx < 0 || idx >= preparePdfPages.length) return;
    if (shiftKey && preparePdfRangeAnchor && preparePdfRangeAnchor.idx !== idx) {
      // Shift-click: paint the anchor click's resulting state across the range.
      const lo = Math.min(preparePdfRangeAnchor.idx, idx);
      const hi = Math.max(preparePdfRangeAnchor.idx, idx);
      preparePdfPushUndo();
      const next = new Set(preparePdfKeptIndices);
      for (let i = lo; i <= hi; i++) {
        if (preparePdfRangeAnchor.dropped) next.delete(i); else next.add(i);
      }
      preparePdfSetKeptSet([...next]);
      refreshPreparePdfKeptUi();
      return;
    }
    preparePdfPushUndo();
    const next = new Set(preparePdfKeptIndices);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    preparePdfSetKeptSet([...next]);
    preparePdfRangeAnchor = { idx, dropped: !preparePdfIsKept(idx) };
    refreshPreparePdfKeptUi();
  }

  function preparePdfUndo() {
    if (!preparePdfUndoStack.length) return;
    saveCurrentPageName();
    preparePdfKeptIndices = preparePdfUndoStack.pop();
    refreshPreparePdfKeptUi();
  }

  function refreshPreparePdfKeptUi() {
    const gridEl = document.getElementById('preparePdfGrid');
    if (gridEl) {
      gridEl.querySelectorAll('.ppg-cell').forEach((cell) => {
        cell.classList.toggle('ppg-dropped', !preparePdfIsKept(Number(cell.dataset.idx)));
      });
    }
    const countEl = document.getElementById('preparePdfKeptCount');
    if (countEl) countEl.textContent = preparePdfKeptIndices.length + ' of ' + preparePdfPages.length + ' kept';
    if (preparePdfView === 'single') renderPreparePdfPreview();
    updatePreparePdfControls();
  }

  // --- Single-sheet (zoom) view: walks ALL sheets, kept and dropped ---
  function updateSinglePageLabel() {
    const labelEl = document.getElementById('preparePdfPageLabel');
    if (!labelEl) return;
    const total = preparePdfPages.length;
    if (!total) { labelEl.textContent = 'No pages'; return; }
    const idx = preparePdfCurrentIdx;
    const page = preparePdfPages[idx];
    let text = 'Page ' + (idx + 1) + ' of ' + total;
    if (page && page.pdfPage) {
      const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
      text += ' — ' + (vp.width / 72).toFixed(1) + ' × ' + (vp.height / 72).toFixed(1) + ' in';
    }
    const fmt = (b) => (b / (1024 * 1024)) < 0.01 ? (b / 1024).toFixed(2) + ' KB' : (b / (1024 * 1024)).toFixed(2) + ' MB';
    if (preparePdfBuffer) {
      const pageBytes = preparePdfPageBytes[idx];
      if (pageBytes != null) text += ' — This page: ' + fmt(pageBytes);
      text += ' — Total: ' + fmt(preparePdfBuffer.byteLength);
    }
    if (!preparePdfIsKept(idx)) text += ' — DROPPED';
    labelEl.textContent = text;
  }

  // Lazily compute the shown sheet's standalone byte size (a per-page trimmed
  // build). The old code did this EAGERLY for every page on open — 200 pdf-lib
  // builds for a 200-sheet set before the user had done anything.
  function ensurePreparePdfPageSize(idx) {
    if (preparePdfPageBytes[idx] != null || preparePdfPageBytesInFlight.has(idx)) return;
    if (typeof PDFLib === 'undefined' || !preparePdfBuffer) return;
    preparePdfPageBytesInFlight.add(idx);
    const gen = preparePdfGen;
    (async () => {
      try {
        const buf = await App.buildTrimmedPdfBuffer(preparePdfBuffer, [idx]);
        if (gen === preparePdfGen && buf) {
          preparePdfPageBytes[idx] = buf.byteLength;
          if (preparePdfView === 'single' && preparePdfCurrentIdx === idx) updateSinglePageLabel();
        }
      } catch (_) { /* size stays unknown; label omits it */ }
      finally { preparePdfPageBytesInFlight.delete(idx); }
    })();
  }

  function renderPreparePdfPreview() {
    const canvas = document.getElementById('preparePdfCanvas');
    if (!preparePdfPages.length) {
      canvas.width = 0;
      canvas.height = 0;
      updateSinglePageLabel();
      return;
    }
    const idx = preparePdfCurrentIdx;
    const page = preparePdfPages[idx];
    if (!page || !page.pdfPage) {
      canvas.width = 0;
      canvas.height = 0;
      updateSinglePageLabel();
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
    // landscape never changes the wrap's height — the nav and
    // Drop/Rotate/Undo rows below stay put (Wendi, 2026-08-13).
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.width = 'auto';
    canvas.style.height = 'auto';
    canvas.style.opacity = preparePdfIsKept(idx) ? '' : '0.35';
    updateSinglePageLabel();
    ensurePreparePdfPageSize(idx);
    page.pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport });
    const nameEl = document.getElementById('preparePdfName');
    if (nameEl && preparePdfEditMode === 'page') nameEl.value = page.label || ('Page ' + (idx + 1));
  }
  function saveCurrentPageName() {
    if (!preparePdfPages.length || preparePdfCurrentIdx >= preparePdfPages.length) return;
    const page = preparePdfPages[preparePdfCurrentIdx];
    if (!page) return;
    const nameEl = document.getElementById('preparePdfName');
    if (nameEl && preparePdfEditMode === 'page') page.label = (nameEl.value || '').trim() || ('Page ' + (preparePdfCurrentIdx + 1));
  }
  function updatePreparePdfControls() {
    const total = preparePdfPages.length;
    const keptCount = preparePdfKeptIndices.length;
    const undoDisabled = preparePdfUndoStack.length === 0;
    document.getElementById('preparePdfUndo').disabled = undoDisabled;
    const gridUndoEl = document.getElementById('preparePdfGridUndo');
    if (gridUndoEl) gridUndoEl.disabled = undoDisabled;
    const dropEl = document.getElementById('preparePdfDelete');
    dropEl.disabled = total === 0;
    dropEl.textContent = preparePdfIsKept(preparePdfCurrentIdx) ? 'Drop' : 'Restore';
    document.getElementById('preparePdfRotate').disabled = total === 0;
    document.getElementById('preparePdfPrev').disabled = preparePdfCurrentIdx <= 0;
    document.getElementById('preparePdfNext').disabled = preparePdfCurrentIdx >= total - 1;
    document.getElementById('preparePdfDone').disabled = keptCount === 0;
    const downloadEl = document.getElementById('preparePdfDownload');
    if (downloadEl) downloadEl.disabled = keptCount === 0;
    const saveAndOpenEl = document.getElementById('preparePdfSaveAndOpen');
    if (saveAndOpenEl) saveAndOpenEl.disabled = keptCount === 0;
  }
  function openPreparePdfModal(pages, buffer, defaultName, opts) {
    opts = opts || {};
    preparePdfGen++;
    preparePdfMode = opts.mode === 'append' ? 'append' : 'project';
    preparePdfPages = pages.map(p => ({ pdfPage: p.pdfPage, label: p.label, rotation: p.rotation ?? 0 }));
    preparePdfBuffer = buffer;
    preparePdfPageBytes = {};
    preparePdfKeptIndices = pages.map((_, i) => i);
    preparePdfUndoStack = [];
    preparePdfCurrentIdx = 0;
    preparePdfRangeAnchor = null;
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
      if (descEl) descEl.textContent = 'Tap the pages you do not need before adding the rest to the current project.';
      if (nameRowEl) nameRowEl.style.display = 'none';
    } else {
      if (titleEl) titleEl.textContent = 'Prepare PDF for Cloud';
      if (descEl) descEl.textContent = 'Name your project, then tap the pages you do not need before saving.';
      if (nameRowEl) nameRowEl.style.display = '';
    }
    buildPreparePdfGrid();
    setPreparePdfView('grid'); // the grid IS the trim view; single-sheet is the zoom
    refreshPreparePdfKeptUi();
    App.showModal('preparePdfModal');
  }
  function closePreparePdfModal() {
    teardownPreparePdfGrid();
    preparePdfPages = [];
    preparePdfBuffer = null;
    preparePdfPageBytes = {};
    preparePdfKeptIndices = [];
    preparePdfUndoStack = [];
    preparePdfRangeAnchor = null;
    const els = preparePdfEls();
    if (els.card) els.card.style.maxWidth = '520px';
    App.hideModal('preparePdfModal');
  }
  window.closePreparePdfModal = closePreparePdfModal;
  document.getElementById('preparePdfCancel').onclick = () => closePreparePdfModal();
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
      const page = preparePdfPages[preparePdfCurrentIdx];
      nameInput.value = page?.label || ('Page ' + (preparePdfCurrentIdx + 1));
      nameInput.placeholder = 'Page 1';
      projectTab.classList.remove('active');
      pageTab.classList.add('active');
    }
    projectTab.onclick = () => { if (preparePdfEditMode !== 'project') switchToProject(); };
    pageTab.onclick = () => { if (preparePdfEditMode !== 'page') switchToPage(); };
    nameInput.onblur = () => {
      if (preparePdfEditMode === 'project') preparePdfProjectName = (nameInput.value || '').trim() || preparePdfDefaultName;
      else { saveCurrentPageName(); refreshPreparePdfCaption(preparePdfCurrentIdx); }
    };
  })();
  function refreshPreparePdfCaption(idx) {
    const cell = document.querySelector('#preparePdfGrid .ppg-cell[data-idx="' + idx + '"] .ppg-caption');
    const page = preparePdfPages[idx];
    if (cell && page) cell.textContent = (idx + 1) + ' · ' + (page.label || 'Page ' + (idx + 1));
  }
  document.getElementById('preparePdfUndo').onclick = () => preparePdfUndo();
  // Single-view Drop/Restore: the old destructive "Delete" became a keep/drop
  // toggle on the sheet being zoomed — same undo stack as the grid.
  document.getElementById('preparePdfDelete').onclick = () => {
    if (!preparePdfPages.length) return;
    saveCurrentPageName();
    preparePdfToggleSheet(preparePdfCurrentIdx, false);
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
    if (preparePdfCurrentIdx < preparePdfPages.length - 1) {
      saveCurrentPageName();
      preparePdfCurrentIdx++;
      renderPreparePdfPreview();
      updatePreparePdfControls();
    }
  };
  function preparePdfRotateSheet(idx) {
    const page = preparePdfPages[idx];
    if (!page || !page.pdfPage) return;
    page.rotation = ((page.rotation ?? 0) + 90) % 360;
    const cell = document.querySelector('#preparePdfGrid .ppg-cell[data-idx="' + idx + '"]');
    if (cell && cell.dataset.rendered === '1') queuePreparePdfThumb(idx);
    if (preparePdfView === 'single' && preparePdfCurrentIdx === idx) renderPreparePdfPreview();
  }
  document.getElementById('preparePdfRotate').onclick = () => preparePdfRotateSheet(preparePdfCurrentIdx);
  // Modal-scoped keys, CAPTURE phase so they beat app.js's document-level
  // handler (which is not prepare-modal-aware): Ctrl/Cmd+Z must undo the trim
  // action, not fire the app's annotation undo behind the overlay; arrows walk
  // sheets in the single (zoom) view. Escape is left alone — app.js's handler
  // closes the modal via window.closePreparePdfModal.
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('preparePdfModal');
    if (!modal || !modal.classList.contains('visible')) return;
    if (e.target && e.target.matches && e.target.matches('input, textarea, [contenteditable="true"]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) preparePdfUndo();
      return;
    }
    if (preparePdfView === 'single') {
      if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); document.getElementById('preparePdfPrev').click(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); document.getElementById('preparePdfNext').click(); }
    }
  }, true);
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
      teardownPreparePdfGrid();
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
    teardownPreparePdfGrid();
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
  document.getElementById('preparePdfDone').onclick = async () => {
    const r = await commitPreparePdfToState();
    if (!r.ok) { if (!r.error) alert('Failed to build PDF.'); return; }
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
    const r = await commitPreparePdfToState();
    if (!r.ok) { if (!r.error) alert('Failed to build PDF.'); return; }
    App.hideModal('preparePdfModal');
    App.markProjectDirty();
    App.updateUI();
    requestAnimationFrame(() => { App.fitZoom(); App.renderPdf(); });
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

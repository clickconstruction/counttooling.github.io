(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // Prepare PDF modal (page trim/rotate/name + commit-into-app) -- extracted from
  // app.js via the window.App registry. The PDF upload/file handler, loadTestPdf,
  // and the shared PDF helpers stay in app.js; the modal's #preparePdf* bindings
  // run at load below. Other flows open it via App.openPreparePdfModal().
  const {
    state, showModal, hideModal, updateUI, showToast, renderPdf, uid,
    makeAnnotations, markProjectDirty, fitZoom, sanitizeForFilename,
    assertPdfWithinLimit, mergePdfBuffers, buildTrimmedPdfBuffer, resetGridOrigin,
    writeTakeoffStateBackup, downloadPdfBuffer, performSaveProjectToCloud, isAuthError,
  } = App;

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
    canvas.style.maxWidth = '100%';
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
      if (titleEl) titleEl.textContent = 'Add pages — ' + (state.currentProjectName || 'Untitled');
      if (descEl) descEl.textContent = 'Remove unnecessary pages before adding them to the current project.';
      if (nameRowEl) nameRowEl.style.display = 'none';
    } else {
      if (titleEl) titleEl.textContent = 'Prepare PDF for Cloud';
      if (descEl) descEl.textContent = 'Name your project and remove unnecessary pages before saving.';
      if (nameRowEl) nameRowEl.style.display = '';
    }
    renderPreparePdfPreview();
    updatePreparePdfControls();
    showModal('preparePdfModal');
    (async function computePageSizes() {
      if (typeof PDFLib === 'undefined' || !preparePdfBuffer) return;
      const indices = [...preparePdfKeptIndices].sort((a, b) => a - b);
      for (const i of indices) {
        if (!preparePdfBuffer) return;
        try {
          const buf = await buildTrimmedPdfBuffer(preparePdfBuffer, [i]);
          if (buf) preparePdfPageBytes[i] = buf.byteLength;
        } catch (_) {}
        if (document.getElementById('preparePdfModal')?.classList.contains('visible')) {
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
    hideModal('preparePdfModal');
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
      ? (state.currentProjectName || preparePdfDefaultName)
      : (preparePdfProjectName || preparePdfDefaultName);
    const trimmedBuf = kept.length === preparePdfPages.length
      ? preparePdfBuffer
      : await buildTrimmedPdfBuffer(preparePdfBuffer, kept);
    if (!trimmedBuf) return { ok: false };
    const trimmedBufSize = trimmedBuf.byteLength ?? trimmedBuf.length ?? trimmedBuf.size ?? 0;
    if (preparePdfMode === 'append') {
      // #7a: Merge the new trimmed buffer onto the existing project buffer and
      // append pages. Enforce the size ceiling on the MERGED result so we do
      // not blow past the 50 MB cloud storage cap.
      const existingBuf = state.pdfBuffer;
      const existingSize = existingBuf ? (existingBuf.byteLength ?? existingBuf.length ?? 0) : 0;
      // Pre-flight size check (worst-case sum) to avoid a wasted merge of a
      // buffer that obviously cannot fit. The post-merge check below is the
      // authoritative gate.
      const projectedSize = existingSize + trimmedBufSize;
      const preCheck = assertPdfWithinLimit(projectedSize, 'commitPreparePdfToState.append.pre');
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
        const mergedBuf = await mergePdfBuffers([existingBuf, trimmedBuf]);
        if (!mergedBuf) return { ok: false, error: 'Failed to merge PDFs.' };
        const mergedSize = mergedBuf.byteLength ?? mergedBuf.length ?? mergedBuf.size ?? 0;
        const sizeCheck = assertPdfWithinLimit(mergedSize, 'commitPreparePdfToState.append.merged');
        if (sizeCheck && !sizeCheck.ok) {
          try { alert(sizeCheck.message); } catch (_) {}
          return { ok: false, error: sizeCheck.message };
        }
        const mergedPdf = await pdfjsLib.getDocument(mergedBuf.slice(0)).promise;
        const startIdx = state.pages.length;
        const totalPages = mergedPdf.numPages;
        const newPages = [];
        for (let i = startIdx; i < totalPages; i++) {
          const pdfPage = await mergedPdf.getPage(i + 1);
          const keptOrigIdx = kept[i - startIdx];
          const label = preparePdfPages[keptOrigIdx]?.label || ('Page ' + (i + 1));
          const rotation = preparePdfPages[keptOrigIdx]?.rotation ?? 0;
          const canvasId = uid();
          newPages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: makeAnnotations() }], scale: null, rotation });
          state.activeCanvasIdByPage[i] = canvasId;
        }
        // Re-bind existing state.pages to the merged pdf so all pages share a
        // single pdfjs document. This avoids holding the old detached buffer.
        for (let i = 0; i < startIdx; i++) {
          if (state.pages[i]) state.pages[i].pdfPage = await mergedPdf.getPage(i + 1);
        }
        state.pages = state.pages.concat(newPages);
        state.pdfBuffer = mergedBuf;
        state.pdfBufferSize = mergedSize;
        // Pdf binary changed: clear the hash so the next manual save triggers
        // an upload. KEEP state.pdfStoragePath set to the previous cloud path
        // so performSaveProjectToCloud can clean it up via its prevPdfStoragePath
        // remove(). The path is replaced with the new uploaded path on save.
        state.pdfHash = null;
      }
      preparePdfPages = [];
      preparePdfBuffer = null;
      preparePdfKeptIndices = [];
      preparePdfUndoStack = [];
      return { ok: true, name, pdfBuffer: state.pdfBuffer, appended: true };
    }
    const sizeCheck = assertPdfWithinLimit(trimmedBufSize, 'commitPreparePdfToState');
    if (sizeCheck && !sizeCheck.ok) {
      try { alert(sizeCheck.message); } catch (_) {}
      return { ok: false, error: sizeCheck.message };
    }
    const pdf = await pdfjsLib.getDocument(trimmedBuf.slice(0)).promise;
    const numPages = pdf.numPages;
    state.pages = [];
    state.activeCanvasIdByPage = {};
    for (let i = 0; i < numPages; i++) {
      const pdfPage = await pdf.getPage(i + 1);
      const origIdx = kept[i];
      const label = preparePdfPages[origIdx]?.label || ('Page ' + (i + 1));
      const rotation = preparePdfPages[origIdx]?.rotation ?? 0;
      const canvasId = uid();
      state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: makeAnnotations() }], scale: null, rotation });
      state.activeCanvasIdByPage[i] = canvasId;
    }
    state.pdfBuffer = trimmedBuf;
    state.pdfBufferSize = trimmedBufSize;
    state.pdfStoragePath = null;
    state.currentProjectName = (name || '').trim() || preparePdfDefaultName;
    state.currentPage = 0;
    preparePdfPages = [];
    preparePdfBuffer = null;
    preparePdfKeptIndices = [];
    preparePdfUndoStack = [];
    resetGridOrigin();
    return { ok: true, name, pdfBuffer: trimmedBuf };
    } catch (e) {
      console.error('[Prepare PDF]', e);
      return { ok: false };
    }
  }
  document.getElementById('preparePdfDone').onclick = async () => {
    const r = await commitPreparePdfToState();
    if (!r.ok) { if (!r.error) alert('Failed to build PDF.'); return; }
    hideModal('preparePdfModal');
    markProjectDirty();
    updateUI();
    requestAnimationFrame(() => { fitZoom(); renderPdf(); });
    await writeTakeoffStateBackup();
  };
  document.getElementById('preparePdfDownload').onclick = async () => {
    const kept = preparePdfKeptIndices;
    if (!kept.length || !preparePdfBuffer) return;
    const trimmedBuf = kept.length === preparePdfPages.length
      ? preparePdfBuffer
      : await buildTrimmedPdfBuffer(preparePdfBuffer, kept);
    if (!trimmedBuf) { alert('Failed to build PDF.'); return; }
    const name = preparePdfProjectName || preparePdfDefaultName;
    downloadPdfBuffer(trimmedBuf, sanitizeForFilename(name) + '.pdf');
  };
  document.getElementById('preparePdfSaveAndOpen').onclick = async () => {
    const r = await commitPreparePdfToState();
    if (!r.ok) { if (!r.error) alert('Failed to build PDF.'); return; }
    hideModal('preparePdfModal');
    markProjectDirty();
    updateUI();
    requestAnimationFrame(() => { fitZoom(); renderPdf(); });
    const saveResult = await performSaveProjectToCloud({ name: r.name, includePdf: true, pdfBuffer: r.pdfBuffer });
    if (!saveResult.ok) {
      if (isAuthError(saveResult.error)) {
        showToast('Refresh the page to sync.', 4000);
      } else {
        const errMsg = (saveResult.error?.message) || (saveResult.error?.details) || (saveResult.error?.hint) || String(saveResult.error) || 'Save failed';
        showToast('Save failed: ' + errMsg + '. Open Project Settings to retry.', 4000);
      }
    }
  };

  App.openPreparePdfModal = openPreparePdfModal;
})();

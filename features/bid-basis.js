/*
 * features/bid-basis.js — the "Bid basis" handoff to PipeTooling.
 *
 * When the issued drawings are too rough to bid to, the estimator bids to the
 * marked-up plans and sends them with the proposal. PipeTooling's Cover Letter
 * opens this project's view link in a new tab with `export=bid-basis&ref=<bid>`;
 * this file, once the plan has loaded, opens Export PDFs with the bid-basis
 * preset (features/export-pdfs.js), names the file so it can be searched for
 * later (bid-basis-model.js buildBidBasisFilename), and after the download:
 *
 *   1. shows the Downloaded card (#bidBasisDoneModal) with the file name, a
 *      Copy button and the sheet list;
 *   2. posts the manifest (bid-basis-model.js buildBidBasisManifest — file
 *      name, sheets, mark totals, the takeoff's last-saved time, and the Canvas
 *      JSON snapshot) to the tab that opened this one, targeted only at the
 *      PipeTooling origins — never '*'.
 *
 * Loaded after features/export-pdfs.js. Reads shared deps from App.* at call
 * time (registry boundary rule); pure logic lives in bid-basis-model.js.
 * app.js calls App.maybeStartBidBasisExport() right after the view-link boot.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // The active handoff for this tab: { preset: 'bid-basis', ref, filename }.
  let ctx = null;
  let lastManifest = null;

  function model() { return window.BidBasisModel || null; }

  function freshFilename() {
    const M = model();
    if (!M || !ctx) return null;
    return M.buildBidBasisFilename({ ref: ctx.ref, projectName: App.state.currentProjectName, at: new Date() });
  }

  /** features/export-pdfs.js asks for this on every open of the dialog. */
  function getActiveBidBasisPreset() {
    const M = model();
    if (!ctx || !M) return null;
    ctx.filename = freshFilename();
    return { preset: 'bid-basis', ref: ctx.ref, filename: ctx.filename, render: M.BID_BASIS_RENDER };
  }

  function maybeStartBidBasisExport() {
    const M = model();
    if (!M) return false;
    const params = M.parseBidBasisParams(window.location.search || '');
    if (!params.active) return false;
    const state = App.state;
    if (!state.pages.length || !state.loadedViaViewLink) return false;
    ctx = { ref: params.ref || M.sanitizeRef(state.currentProjectExternalRef) || null, filename: null };
    // Tell the opener the plan is open and when the takeoff was last saved, so
    // PipeTooling can flag "takeoff changed since" before any download happens.
    postManifest(M.buildBidBasisLoadedNotice({
      ref: ctx.ref, projectId: state.currentProjectId, projectName: state.currentProjectName,
      viewToken: state.viewToken || null, pdfHash: state.pdfHash || null, ctUpdatedAt: state.currentProjectUpdatedAt || null,
    }));
    App.openSpecificPagesModal(getActiveBidBasisPreset());
    return true;
  }

  function postManifest(manifest) {
    const M = model();
    const opener = window.opener;
    let delivered = false;
    if (opener && !opener.closed && M) {
      M.bidBasisTargetOrigins(window.location.origin).forEach((origin) => {
        try { opener.postMessage(manifest, origin); delivered = true; } catch (_) {}
      });
    }
    return delivered;
  }

  // --- Save picker (File System Access API, Chrome / Edge) --------------------
  // The browser can rename a plain download on a collision ("(1)") and never
  // tells the page. With the picker the person chooses the folder and the page
  // learns the exact name it saved under — the manifest then carries
  // saveMethod 'confirmed'. Safari / Firefox (no API) fall back to the plain
  // download and 'intended'. Cancel = no download at all.
  function beginBidBasisSave(filename) {
    if (typeof window.showSaveFilePicker !== 'function') return Promise.resolve({ handle: null, cancelled: false });
    return window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
    }).then((handle) => ({ handle, cancelled: false }), (err) => {
      if (err && err.name === 'AbortError') return { handle: null, cancelled: true };
      // Not allowed / not supported here: plain download instead.
      return { handle: null, cancelled: false };
    });
  }
  async function finishBidBasisSave(handle, doc, fallbackName) {
    try {
      const writable = await handle.createWritable();
      await writable.write(doc.output('blob'));
      await writable.close();
      return { filename: handle.name || fallbackName, saveMethod: 'confirmed' };
    } catch (err) {
      console.warn('[Bid basis] save picker write failed, downloading instead:', err);
      doc.save(fallbackName);
      return { filename: fallbackName, saveMethod: 'intended' };
    }
  }

  function fileSizeOf(doc) {
    try { return doc.output('arraybuffer').byteLength; } catch (_) { return null; }
  }

  function onBidBasisExported(result) {
    const M = model();
    const state = App.state;
    if (!M || !result || !result.doc) return;
    const included = result.included || [];
    const summary = M.summarizeIncludedPages(state.pages, included, (p) => App.getActiveAnnotations(p));
    let snapshot = null;
    try { snapshot = App.buildCanvasExportData ? App.buildCanvasExportData() : null; } catch (_) { snapshot = null; }
    const manifest = M.buildBidBasisManifest({
      ref: ctx ? ctx.ref : null,
      filename: result.filename,
      saveMethod: result.saveMethod || 'intended',
      fileSizeBytes: fileSizeOf(result.doc),
      sheets: included.map((i) => state.pages[i]?.label || ('Page ' + (i + 1))),
      pageIndices: included,
      counters: summary.counters,
      runs: summary.runs,
      notes: result.options?.bundleNotes ? summary.notes : 0,
      includeReport: !!result.options?.includeReport,
      projectName: state.currentProjectName,
      projectId: state.currentProjectId,
      viewToken: state.viewToken || null,
      pdfHash: state.pdfHash || null,
      ctUpdatedAt: state.currentProjectUpdatedAt || null,
      exportedAt: new Date().toISOString(),
      canvasSnapshot: snapshot,
    });
    lastManifest = manifest;
    const delivered = postManifest(manifest);
    showDoneModal(manifest, delivered);
  }

  function showDoneModal(manifest, delivered) {
    const el = (id) => document.getElementById(id);
    const parts = [manifest.sheetCount + (manifest.sheetCount === 1 ? ' sheet' : ' sheets')];
    if (manifest.includeReport) parts.push('report');
    if (manifest.notesCount) parts.push(manifest.notesCount + (manifest.notesCount === 1 ? ' note' : ' notes'));
    if (manifest.fileSizeBytes) parts.push((manifest.fileSizeBytes / (1024 * 1024)).toFixed(1) + ' MB');
    parts.push(manifest.saveMethod === 'confirmed' ? 'saved where you chose' : 'in your Downloads folder');
    if (el('bidBasisDoneSummary')) el('bidBasisDoneSummary').textContent = parts.join(' · ');
    if (el('bidBasisDoneFilename')) el('bidBasisDoneFilename').textContent = manifest.filename;
    if (el('bidBasisDoneRef')) el('bidBasisDoneRef').textContent = manifest.ref || 'bid-basis';
    const sheets = el('bidBasisDoneSheets');
    if (sheets) {
      sheets.innerHTML = '';
      manifest.sheets.forEach((label) => { const s = document.createElement('span'); s.textContent = label; sheets.appendChild(s); });
    }
    const status = el('bidBasisDoneStatus');
    if (status) {
      status.classList.toggle('bid-basis-done-status-warn', !delivered);
      status.textContent = delivered
        ? 'PipeTooling has been told. Bid ' + (manifest.ref || '') + ' is stamped with this file and a snapshot of these marks. Attach the file to the proposal you send.'
        : 'Could not reach the PipeTooling tab that opened this one. Go back to PipeTooling and use "Mark as attached by hand" — the file name above is what it asks for.';
    }
    const copyBtn = el('bidBasisDoneCopy');
    if (copyBtn) {
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(manifest.filename);
          copyBtn.textContent = 'Copied';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        } catch (_) {
          App.showToast && App.showToast('Couldn’t copy — your browser blocked clipboard access.', 3000);
        }
      };
    }
    const again = el('bidBasisDoneAgain');
    if (again) again.onclick = () => { App.hideModal('bidBasisDoneModal'); App.openSpecificPagesModal(getActiveBidBasisPreset()); };
    const back = el('bidBasisDoneBack');
    if (back) {
      back.textContent = (window.opener && !window.opener.closed) ? 'Back to PipeTooling' : 'Done';
      back.onclick = () => {
        App.hideModal('bidBasisDoneModal');
        try { if (window.opener && !window.opener.closed) window.opener.focus(); } catch (_) {}
      };
    }
    App.showModal('bidBasisDoneModal');
  }

  App.maybeStartBidBasisExport = maybeStartBidBasisExport;
  App.getActiveBidBasisPreset = getActiveBidBasisPreset;
  App.onBidBasisExported = onBidBasisExported;
  App.beginBidBasisSave = beginBidBasisSave;
  App.finishBidBasisSave = finishBidBasisSave;
  // Spec seams.
  App.getBidBasisContext = () => (ctx ? { ...ctx } : null);
  App.getLastBidBasisManifest = () => lastManifest;
})();

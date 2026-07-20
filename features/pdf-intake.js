(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // PDF intake (registry split #38) -- extracted from app.js: the #pdfInput
  // onchange pipeline (size caps, multi-file merge, append mode via Prepare
  // PDF, pending-canvas-load hash match, the load-annotations prompt, the
  // first-upload Prepare PDF handoff), loadTestPdf, and
  // titleFromPdfFilename. This file owns the two intake flags; app.js
  // reaches them via the accessors registered at the bottom.

  let pendingImportCanvasAfterPdf = false;
  let pendingAddAdditionalPages = false;

  function titleFromPdfFilename(name) {
    if (!name) return 'Untitled';
    const s = String(name).replace(/\.pdf$/i, '').trim();
    return s || 'Untitled';
  }

  async function loadTestPdf() {
    // A2: When a project is already loaded, refuse to clobber its name/buffer.
    // The Advanced "Load test PDF" entry point is a dev fixture and should not
    // be a back-door for the load-annotations-modal-style data loss.
    if (App.state.currentProjectId) {
      App.showToast('Close the current project before loading the test PDF.', 4000);
      return;
    }
    try {
      const res = await fetch(LOAD_TEST_PDF_URL);
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      const buf = await res.arrayBuffer();
      const bufForDisplay = buf.slice(0);
      const pdf = await pdfjsLib.getDocument(buf).promise;
      const numPages = pdf.numPages;
      const pages = [];
      for (let i = 0; i < numPages; i++) {
        const pdfPage = await pdf.getPage(i + 1);
        const label = numPages > 1 ? ('Test PDF — p' + (i + 1)) : 'Test PDF';
        const canvasId = App.uid();
        pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: App.makeAnnotations() }], scale: null, rotation: 0 });
      }
      App.openPreparePdfModal(pages, bufForDisplay, 'Test PDF');
      App.clearPdfBitmapCache();
      App.state.pages = [];
      App.state.activeCanvasIdByPage = {};
      App.resetGridOrigin();
      App.state.pdfBuffer = null;
      App.state.pdfBufferSize = 0;
      App.state.currentProjectName = 'Untitled';
      App.state.currentPage = 0;
      App.updateUI();
      requestAnimationFrame(() => { App.fitZoom(); App.renderPdf(); });
    } catch (e) {
      console.error('[Load test PDF]', e);
      App.showToast('Failed to load test PDF: ' + (e?.message || 'Unknown error'), 4000);
    }
  }
  document.getElementById('pdfInput').onchange = async (e) => {
    // #7b: Capture and clear the "Add additional PDF pages" flag immediately
    // so it can never leak across calls (e.g. user dismisses picker, then
    // uses Upload PDF from elsewhere).
    const isAddAdditional = pendingAddAdditionalPages;
    pendingAddAdditionalPages = false;
    const files = e.target.files;
    if (!files?.length) {
      pendingImportCanvasAfterPdf = false;
      return;
    }
    // #7b: When this upload is an explicit "add additional pages" request and
    // we have a project already, route through Prepare PDF in append mode.
    // Single-file & multi-file uploads both work: multi-file is merged into a
    // single new buffer first so Prepare PDF can show one continuous preview.
    if (isAddAdditional && App.state.currentProjectId && App.state.pages.length > 0) {
      const filesToProcess = Array.from(files);
      for (const f of filesToProcess) {
        if (App.SUPABASE_ENABLED && f.size > PDF_MAX_SIZE_BYTES) {
          alert('File too large. Maximum size is 50 MB. Your file is ' + (f.size / 1024 / 1024).toFixed(1) + ' MB.');
          e.target.value = '';
          return;
        }
      }
      const newBuffers = [];
      const newPages = [];
      try {
        for (const f of filesToProcess) {
          const buf = await f.arrayBuffer();
          newBuffers.push(buf.slice(0));
          const pdf = await pdfjsLib.getDocument(buf).promise;
          const numPages = pdf.numPages;
          for (let i = 0; i < numPages; i++) {
            const pdfPage = await pdf.getPage(i + 1);
            const label = numPages > 1 ? (f.name + ' — p' + (i + 1)) : f.name;
            newPages.push({ pdfPage, label, rotation: 0 });
          }
        }
      } catch (err) {
        alert('Failed to read uploaded PDF: ' + (err?.message || 'unknown error'));
        e.target.value = '';
        return;
      }
      const newBuf = newBuffers.length === 1
        ? newBuffers[0]
        : await App.mergePdfBuffers(newBuffers);
      e.target.value = '';
      if (!newBuf || !newPages.length) {
        alert('Failed to read uploaded PDF.');
        return;
      }
      App.openPreparePdfModal(newPages, newBuf, App.state.currentProjectName || 'Untitled', { mode: 'append' });
      return;
    }
    const importBothFollowUp = pendingImportCanvasAfterPdf;
    pendingImportCanvasAfterPdf = false;
    const filesToProcess = Array.from(files);
    const startPageIdx = App.state.pages.length;
    if (startPageIdx === 0) App.resetGridOrigin();
    let firstBuf = null;
    const buffersForMerge = [];
    if (startPageIdx > 0 && App.state.pdfBuffer) {
      buffersForMerge.push(App.state.pdfBuffer.slice ? App.state.pdfBuffer.slice(0) : App.state.pdfBuffer);
    }
    for (const f of filesToProcess) {
      if (App.SUPABASE_ENABLED && f.size > PDF_MAX_SIZE_BYTES) {
        alert('File too large. Maximum size is 50 MB. Your file is ' + (f.size / 1024 / 1024).toFixed(1) + ' MB.');
        e.target.value = '';
        return;
      }
      const buf = await f.arrayBuffer();
      const bufCopy = buf.slice(0);
      if (!firstBuf) firstBuf = bufCopy;
      buffersForMerge.push(bufCopy);
      const pdf = await pdfjsLib.getDocument(buf).promise;
      const numPages = pdf.numPages;
      for (let i = 0; i < numPages; i++) {
        const pdfPage = await pdf.getPage(i + 1);
        const label = numPages > 1 ? (f.name + ' — p' + (i + 1)) : f.name;
        const canvasId = App.uid();
        const idx = App.state.pages.length;
        App.state.pages.push({ pdfPage, label, canvases: [{ id: canvasId, name: 'Main', annotations: App.makeAnnotations() }], scale: null, rotation: 0 });
        App.state.activeCanvasIdByPage[idx] = canvasId;
      }
    }
    if (App.SUPABASE_ENABLED && buffersForMerge.length > 0) {
      const projectedBytes = buffersForMerge.reduce(
        (s, b) => s + ((b && (b.byteLength || b.length)) || 0),
        0
      );
      if (projectedBytes > PDF_MAX_SIZE_BYTES) {
        App.state.pages.length = startPageIdx;
        Object.keys(App.state.activeCanvasIdByPage).forEach((k) => {
          if (Number(k) >= startPageIdx) delete App.state.activeCanvasIdByPage[k];
        });
        alert(
          'Total PDF size after merge would be ' +
          (projectedBytes / 1024 / 1024).toFixed(1) +
          ' MB. Maximum is 50 MB. No pages were added.'
        );
        e.target.value = '';
        return;
      }
    }
    if (buffersForMerge.length > 0) {
      const merged = await App.mergePdfBuffers(buffersForMerge);
      App.state.pdfBuffer = merged;
      App.state.pdfBufferSize = merged ? (merged.byteLength ?? merged.length ?? merged.size ?? 0) : 0;
      App.state.pdfStoragePath = null;
      const mergedPdf = await pdfjsLib.getDocument(merged.slice ? merged.slice(0) : merged).promise;
      const numPages = mergedPdf.numPages;
      App.clearPdfBitmapCache();   // pdfPage proxies rebound below — cached bitmaps would pin the old document
      for (let i = 0; i < numPages && i < App.state.pages.length; i++) {
        App.state.pages[i].pdfPage = await mergedPdf.getPage(i + 1);
      }
      if (!App.state.pendingCanvasLoad) App.markProjectDirty();
    }
    if (App.state.pendingCanvasLoad && firstBuf) {
      const d = App.state.pendingCanvasLoad.data;
      const hashBuf = App.state.pdfBuffer || firstBuf;
      const uploadHash = await App.sha256Hex(hashBuf);
      const hashMatches = !App.state.pendingCanvasLoad.pdf_hash || App.state.pendingCanvasLoad.pdf_hash === uploadHash;
      if (!hashMatches && !confirm('This PDF doesn\'t match the project. Annotations may not align. Load anyway?')) {
        App.state.pendingCanvasLoad = null;
        App.state.currentProjectId = null;
        App.state.currentProjectName = titleFromPdfFilename(filesToProcess[0].name);
        try { App.clearCheckoutExpiredAttention(); } catch (_) {}
      } else {
        const projName = App.state.pendingCanvasLoad.name;
        App.state.counters = Array.isArray(d.counters) ? d.counters : [];
        App.state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
        App.state.groups = App.ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
        App.state.rooms = Array.isArray(d.rooms) ? d.rooms : [];
        if (d.iconNames && typeof d.iconNames === 'object') App.state.iconNames = d.iconNames;
        if (Array.isArray(d.iconOrder)) App.state.iconOrder = d.iconOrder;
        if (Array.isArray(d.customIconPaths)) App.saveUserCustomIcons(d.customIconPaths);
        (d.pages || []).forEach(p => {
          App.applyPageAnnotationsFromData(App.state.pages[p.index], p);
        });
        if (d.pageScales) {
          d.pageScales.forEach((scale, i) => { if (App.state.pages[i]) App.state.pages[i].scale = scale; });
        } else if (d.scale) {
          App.state.pages.forEach(p => { p.scale = d.scale; });
        }
        App.state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
        if (d.legendSettings) App.state.legendSettings = { ...App.state.legendSettings, ...d.legendSettings };
        if (d.multiplyZoneSettings) App.state.multiplyZoneSettings = { ...App.state.multiplyZoneSettings, ...d.multiplyZoneSettings };
        if (d.showGridOverlay != null) App.state.showGridOverlay = !!d.showGridOverlay;
        if (d.gridSettings) App.state.gridSettings = d.gridSettings;
        App.reconcileOrphanedCountersAndLineTypes();
        App.clearUndoStacks();
        App.state.pendingCanvasLoad = null;
        App.state.currentProjectName = projName;
        App.state.pdfHash = uploadHash;
        // Do NOT push this hash to the cloud row here: the locally-uploaded PDF
        // has not been stored, so recording its hash would make the row claim a
        // PDF that isn't in storage (or that differs from the file pdf_path
        // points to). That both reintroduces the "saved but no PDF" bug and can
        // cause the manual-save hash-skip to skip the real upload. The next real
        // save (performSaveProjectToCloud with Include PDF) writes pdf_hash and
        // pdf_path together once the file is actually uploaded.
      }
    } else {
      App.state.currentProjectName = titleFromPdfFilename(filesToProcess[0].name);
    }
    App.state.currentPage = startPageIdx;
    App.updateUI();
    requestAnimationFrame(() => {
      App.fitZoom();
    });
    e.target.value = '';

    const hashBufForMatch = App.state.pdfBuffer || firstBuf;
    // Only prompt to load existing annotations / auto-open Prepare PDF when the
    // user is NOT already inside a loaded project. Otherwise the user is just
    // attaching/adding a PDF to their active project and these prompts would
    // either offer to switch projects (destructive) or clobber the project name.
    if (!importBothFollowUp && !App.state.pendingCanvasLoad && !App.state.currentProjectId && App.SUPABASE_ENABLED && App.getSupabase() && App.state.supabaseSession?.user && hashBufForMatch) {
      const uploadHash = await App.sha256Hex(hashBufForMatch);
      const user = App.state.supabaseSession.user;
      const { data: matches } = await App.getSupabase().from('projects').select('id, name, updated_at').eq('user_id', user.id).eq('pdf_hash', uploadHash).order('updated_at', { ascending: false });
      if (matches && matches.length > 0) {
        const listEl = document.getElementById('loadAnnotationsList');
        listEl.innerHTML = '';
        const esc = (s) => App.escapeHtml(s);
        matches.forEach(proj => {
          const div = document.createElement('div');
          const date = proj.updated_at ? new Date(proj.updated_at).toLocaleString() : '';
          div.className = 'sidebar-item load-annotations-item';
          div.innerHTML = '<span class="name">' + esc(proj.name || 'Untitled') + '</span><span class="load-annotations-date">' + esc(date) + '</span>';
          div.onclick = async () => {
            // B1b: Fetch the full project row via list_accessible_projects so
            // we have can_edit / can_check_out / checked_out_* / user_id and
            // can hydrate checkout/permissions via the shared helper.
            let fullProj;
            try {
              const { data: allProjects, error: allErr } = await App.getSupabase().rpc('list_accessible_projects');
              if (allErr) throw allErr;
              fullProj = (allProjects || []).find(p => p.id === proj.id) || null;
            } catch (fetchErr) {
              App.showToast('Failed to load project: ' + ((fetchErr && fetchErr.message) || 'unknown error'), 4000);
              return;
            }
            if (!fullProj) {
              App.showToast('Project is no longer accessible.', 4000);
              return;
            }
            const d = fullProj.data || {};
            // B2: Page-count mismatch warning. If the cloud project's pages
            // count differs from the just-uploaded PDF, the user might lose
            // annotations or end up with them on wrong pages. Only warn when
            // the cloud project actually has per-page data; an empty d.pages
            // array means nothing to misalign.
            const cloudPages = Array.isArray(d.pages) ? d.pages : [];
            const cloudPageCount = cloudPages.reduce((m, p) => Math.max(m, (p?.index ?? -1) + 1), 0) || cloudPages.length;
            if (cloudPages.length > 0 && cloudPageCount !== App.state.pages.length) {
              const ok = confirm(
                'These annotations were saved for a ' + cloudPageCount + '-page PDF; ' +
                'the PDF you uploaded has ' + App.state.pages.length + ' pages. ' +
                'Some annotations may be missing or misplaced. Continue?'
              );
              if (!ok) return;
            }
            App.state.counters = Array.isArray(d.counters) ? d.counters : [];
            App.state.lineTypes = Array.isArray(d.lineTypes) ? d.lineTypes : [];
            App.state.groups = App.ensureGroupColors(Array.isArray(d.groups) ? d.groups : []);
            App.state.rooms = Array.isArray(d.rooms) ? d.rooms : [];
            if (d.iconNames && typeof d.iconNames === 'object') App.state.iconNames = d.iconNames;
            if (Array.isArray(d.iconOrder)) App.state.iconOrder = d.iconOrder;
            if (Array.isArray(d.customIconPaths)) App.saveUserCustomIcons(d.customIconPaths);
            cloudPages.forEach(p => {
              if (App.state.pages[p.index]) App.applyPageAnnotationsFromData(App.state.pages[p.index], p);
            });
            // B2: Sanitize activeCanvasIdByPage to indices that exist in the
            // current PDF so we never reference canvases on pages that aren't
            // present.
            if (d.activeCanvasIdByPage && typeof d.activeCanvasIdByPage === 'object') {
              const sanitized = {};
              Object.entries(d.activeCanvasIdByPage).forEach(([k, v]) => {
                const idx = Number(k);
                if (Number.isFinite(idx) && App.state.pages[idx]) sanitized[idx] = v;
              });
              App.state.activeCanvasIdByPage = sanitized;
            }
            if (d.pageScales) {
              d.pageScales.forEach((scale, i) => { if (App.state.pages[i]) App.state.pages[i].scale = scale; });
            } else if (d.scale) {
              App.state.pages.forEach(p => { p.scale = d.scale; });
            }
            App.state.maxZoom = d.maxZoom != null ? d.maxZoom : null;
            if (d.legendSettings) App.state.legendSettings = { ...App.state.legendSettings, ...d.legendSettings };
            if (d.multiplyZoneSettings) App.state.multiplyZoneSettings = { ...App.state.multiplyZoneSettings, ...d.multiplyZoneSettings };
            if (d.showGridOverlay != null) App.state.showGridOverlay = !!d.showGridOverlay;
            if (d.gridSettings) App.state.gridSettings = d.gridSettings;
            App.reconcileOrphanedCountersAndLineTypes();
            App.clearUndoStacks();
            // B1b: Shared helper sets currentProjectId/Name, checkout/permissions,
            // realtime subscription, clickcount-last-project, etc. Reuse the
            // in-memory PDF (matched by hash) so next save doesn't re-upload.
            App.hydrateProjectFromCloudRow(fullProj, {
              reusePdfHash: uploadHash,
              reusePdfStoragePath: fullProj.pdf_path || null,
              source: 'load_annotations'
            });
            App.state.sidebarReorderModeActive = false;
            App.hideModal('loadAnnotationsModal');
            App.fitZoom();
            App.updateUI();
            App.renderPdf();
          };
          listEl.appendChild(div);
        });
        App.showModal('loadAnnotationsModal');
      } else if (startPageIdx === 0) {
        App.openPreparePdfModal(App.state.pages, App.state.pdfBuffer, App.state.currentProjectName);
        App.clearPdfBitmapCache();
        App.state.pages = [];
        App.state.activeCanvasIdByPage = {};
        App.state.pdfBuffer = null;
        App.state.pdfBufferSize = 0;
        App.state.currentProjectName = 'Untitled';
        App.state.currentPage = 0;
        App.updateUI();
        App.renderPdf();
      }
    }
    if (importBothFollowUp && App.state.pages.length > 0) {
      App.showModal('importCanvasAfterPdfModal');
    }
  };

  App.loadTestPdf = loadTestPdf;
  App.titleFromPdfFilename = titleFromPdfFilename;
  App.setPendingAddAdditionalPages = (v) => { pendingAddAdditionalPages = !!v; };
  App.resetPdfIntakeFlags = () => { pendingAddAdditionalPages = false; pendingImportCanvasAfterPdf = false; };
})();

/*
 * features/output.js - the output-actions cluster, extracted from the app.js
 * IIFE as the twenty-sixth feature-file split under the window.App registry
 * pattern. Three related surfaces move together (the "Output" features in
 * ARCHITECTURE.md): Copy to PipeTooling (`#forPipeTooling` dropdown +
 * doCopyPipeTooling with the view-link footer + the prefetched export
 * view-link cache), Copy Summary (`#copySummaryText` dropdown +
 * doCopyEmailSummary), and Download current page (`#downloadCurrentPageBtn` +
 * its mode menu + downloadCurrentPageAsPdf).
 *
 * Loaded as a classic <script src="/features/output.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, and binds the
 * three dropdown toggles + their option rows at load. The mobile burger menu
 * keeps working untouched: updateBurgerMenu() dispatches clicks on the same
 * `.download-page-option` / `.export-dropdown-option` DOM elements, and the
 * handlers move with the elements.
 *
 * The export view-link cache (exportViewLinkUrl / exportViewLinkProjectId)
 * lives here as private `let`s; revoking a link in the Share modal clears it
 * through the registered App.onViewLinkRevoked() callback (the Groups
 * pattern). The shared view-link minting (getOrCreateViewLinkUrl /
 * buildViewLinkUrl) STAYS in app.js (the header Share button uses it too) and
 * is reached via App.getOrCreateViewLinkUrl; likewise the shared download
 * helpers (sanitizeForFilename / downloadPdfBuffer / downloadProjectPdf) and
 * the header export/report dropdowns stay in app.js.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  // Cached view-link URL for the "Copy to /Tooling" export. Prefetched when the
  // dropdown opens so the clipboard write can stay inside the user gesture
  // (Safari/Firefox revoke clipboard permission across an await).
  let exportViewLinkUrl = null;
  let exportViewLinkProjectId = null;
  function canExportViewLink() {
    const state = App.state;
    const sb = App.getSupabase ? App.getSupabase() : null;
    return !!(App.SUPABASE_ENABLED && sb && state.currentProjectId && state.supabaseSession?.user && !state.loadedViaViewLink);
  }
  function prefetchExportViewLink() {
    const state = App.state;
    if (!canExportViewLink()) { exportViewLinkUrl = null; exportViewLinkProjectId = null; return; }
    if (exportViewLinkUrl && exportViewLinkProjectId === state.currentProjectId) return;
    const pid = state.currentProjectId;
    App.getOrCreateViewLinkUrl().then((url) => {
      if (App.state.currentProjectId === pid) { exportViewLinkUrl = url; exportViewLinkProjectId = pid; }
    }).catch(() => { /* best-effort; doCopyPipeTooling retries inline */ });
  }

  async function doCopyPipeTooling(getAnnFn, pageIndices, mode) {
    const state = App.state;
    const opts = {};
    if (getAnnFn) opts.getAnnotations = getAnnFn;
    if (pageIndices != null) opts.pageIndices = pageIndices;
    let text = typeof window.getPipeToolingSummary === 'function' ? window.getPipeToolingSummary(opts) : '';
    if (!text) {
      alert('No items to summarize. Add counters or line types first.');
      return;
    }
    // Append a project view link so importing tools (PipeTooling / TakeoffTooling)
    // can link the bid back to the source takeoff. Importers detect it by scanning
    // the pasted text for a counttooling URL with a ?t=<token>.
    let noLinkToast = null;
    if (App.SUPABASE_ENABLED) {
      if (canExportViewLink()) {
        let url = (exportViewLinkUrl && exportViewLinkProjectId === state.currentProjectId) ? exportViewLinkUrl : null;
        if (!url) {
          try {
            url = await App.getOrCreateViewLinkUrl();
            exportViewLinkUrl = url;
            exportViewLinkProjectId = state.currentProjectId;
          } catch (_) {
            noLinkToast = 'Counts copied, but the view link could not be created.';
          }
        }
        if (url) text += '\n\nView link:\t' + url;
      } else if (!state.currentProjectId) {
        noLinkToast = 'Counts copied. Save the project to the cloud to include a view link.';
      } else if (!state.supabaseSession?.user) {
        noLinkToast = 'Counts copied. Sign in to include a view link.';
      } else if (state.loadedViaViewLink) {
        noLinkToast = 'Counts copied. View-only sessions cannot create a share link.';
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      App.logUserEvent('copy_summary', state.currentProjectId || null, { surface: 'pipe-tooling', mode: mode || 'visible' });
      if (noLinkToast) {
        App.showToast(noLinkToast);
      } else {
        App.showModal('pipeToolingCopiedModal');
        setTimeout(() => App.hideModal('pipeToolingCopiedModal'), 1500);
      }
    } catch (err) {
      alert('Could not copy to clipboard: ' + (err.message || err));
    }
  }

  // --- Pre-copy scale check (#toolingScaleCheckModal), both copy surfaces ---
  // Copying with unscaled lines exports pixel lengths (as separate `px of`
  // rows since T1-05). Before the copy — Copy to /Tooling AND Copy Summary —
  // walk exactly the pages/annotations the chosen mode will export and flag
  // pages where a summarized line (known lineTypeId — the
  // getPipeToolingHasData rule) has no effective scale (page scale or its
  // scale zone's). Pages without line marks never flag. On a hit, a confirm
  // modal offers Set scale (jump + open the Set Scale modal), Export anyway,
  // or Cancel. Counters need no scale, so counter-only pages pass untouched.
  let pendingToolingExport = null;   // { getAnnFn, pageIndices, firstIdx, doCopy, mode } awaiting the modal's verdict

  function collectUnscaledLinePages(getAnnFn, pageIndices) {
    const state = App.state;
    const indices = pageIndices != null ? pageIndices : state.pages.map((_, i) => i);
    const lineTypeIds = new Set((state.lineTypes || []).map(lt => lt.id));
    const getAnn = getAnnFn
      || ((page, i) => (typeof window.getAnnotationsForReport === 'function' ? window.getAnnotationsForReport(page, i) : page?.annotations) || App.makeAnnotations());
    const flagged = [];
    indices.forEach(i => {
      const page = state.pages[i];
      if (!page) return;
      const ann = getAnn(page, i) || App.makeAnnotations();
      const unscaled = (line, isPoly) => {
        if (!lineTypeIds.has(line.lineTypeId)) return false;
        const eff = App.getEffectiveScaleForLine(ann, line, isPoly, i);
        return !(eff && eff.pixelsPerUnit);   // the same test the length math uses for its px fallback
      };
      if ((ann.quickLines || []).some(l => unscaled(l, false)) || (ann.polylines || []).some(l => unscaled(l, true))) flagged.push(i);
    });
    return flagged;
  }

  // T1-05: the one pre-copy scale gate, generalized to carry the copy function
  // so BOTH copy surfaces (Copy to /Tooling and Copy Summary) run the same
  // check. On a hit it stashes { …, doCopy } and opens the modal; on a clean
  // walk it copies straight away (zero added steps on the happy path).
  async function runGatedCopy(getAnnFn, pageIndices, doCopy, surface, mode) {
    const flagged = collectUnscaledLinePages(getAnnFn, pageIndices);
    if (flagged.length) {
      pendingToolingExport = { getAnnFn, pageIndices, firstIdx: flagged[0], doCopy, mode };
      App.logUserEvent('unscaled_ft_block', App.state.currentProjectId || null,
        { surface, flaggedPages: flagged.length });
      const listEl = document.getElementById('toolingScaleCheckList');
      if (listEl) {
        listEl.innerHTML = '';
        flagged.forEach(i => {
          const li = document.createElement('li');
          li.textContent = App.state.pages[i]?.label || 'Page ' + (i + 1);
          listEl.appendChild(li);
        });
      }
      App.showModal('toolingScaleCheckModal');
      return;
    }
    await doCopy(getAnnFn, pageIndices, mode);
  }

  const toolingScaleCheckCancel = document.getElementById('toolingScaleCheckCancel');
  const toolingScaleCheckExport = document.getElementById('toolingScaleCheckExport');
  const toolingScaleCheckGoSet = document.getElementById('toolingScaleCheckGoSet');
  if (toolingScaleCheckCancel) toolingScaleCheckCancel.onclick = () => App.hideModal('toolingScaleCheckModal');
  if (toolingScaleCheckExport) {
    toolingScaleCheckExport.onclick = async () => {
      const pending = pendingToolingExport;
      App.hideModal('toolingScaleCheckModal');
      // The click itself is the user gesture, so the clipboard write inside
      // the stashed doCopy stays permitted (same constraint as the dropdown).
      if (pending) await pending.doCopy(pending.getAnnFn, pending.pageIndices, pending.mode);
    };
  }
  if (toolingScaleCheckGoSet) {
    toolingScaleCheckGoSet.onclick = () => {
      const pending = pendingToolingExport;
      App.hideModal('toolingScaleCheckModal');
      if (!pending) return;
      if (pending.firstIdx !== App.state.currentPage) {
        App.state.currentPage = pending.firstIdx;
        App.fitZoom();
      }
      App.openScaleModal();
    };
  }
  // Core-function -> feature callback: any hide path (buttons, Escape) drops
  // the stashed export so a later reopen can't fire a stale copy.
  App.onToolingScaleCheckHidden = () => { pendingToolingExport = null; };

  const forPipeToolingBtn = document.getElementById('forPipeTooling');
  const forPipeToolingMenu = document.getElementById('forPipeToolingMenu');
  const forPipeToolingDropdown = document.getElementById('forPipeToolingDropdown');
  if (forPipeToolingBtn && forPipeToolingMenu) {
    forPipeToolingBtn.onclick = (e) => {
      e.stopPropagation();
      if (forPipeToolingMenu.classList.contains('visible')) {
        forPipeToolingMenu.classList.remove('visible');
        if (forPipeToolingDropdown && forPipeToolingMenu.parentElement !== forPipeToolingDropdown) forPipeToolingDropdown.appendChild(forPipeToolingMenu);
      } else {
        prefetchExportViewLink();
        forPipeToolingMenu.style.left = '-9999px';
        forPipeToolingMenu.style.right = '';
        forPipeToolingMenu.classList.add('visible');
        const btnRect = forPipeToolingBtn.getBoundingClientRect();
        forPipeToolingMenu.style.position = 'fixed';
        forPipeToolingMenu.style.minWidth = Math.max(btnRect.width, 280) + 'px';
        // Drop-up anchored to the button, measured (not estimated) height,
        // viewport-clamped via the shared helper.
        App.placeFixedMenu(forPipeToolingMenu, btnRect.left, btnRect.top - forPipeToolingMenu.offsetHeight - 4);
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && forPipeToolingMenu.parentElement !== document.body) document.body.appendChild(forPipeToolingMenu);
      }
    };
  }
  document.querySelectorAll('.pipe-tooling-option').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      if (forPipeToolingMenu) {
        forPipeToolingMenu.classList.remove('visible');
        if (forPipeToolingDropdown && forPipeToolingMenu.parentElement !== forPipeToolingDropdown) forPipeToolingDropdown.appendChild(forPipeToolingMenu);
      }
      if (mode === 'this-canvas') await runGatedCopy(null, [App.state.currentPage], doCopyPipeTooling, 'pipe-tooling', mode);
      else if (mode === 'visible') await runGatedCopy(null, null, doCopyPipeTooling, 'pipe-tooling', mode);
      else if (mode === 'all') await runGatedCopy(window.getMergedAnnotationsForPage, null, doCopyPipeTooling, 'pipe-tooling', mode);
    };
  });

  const copySummaryTextBtn = document.getElementById('copySummaryText');
  const copySummaryTextMenu = document.getElementById('copySummaryTextMenu');
  const copySummaryTextDropdown = document.getElementById('copySummaryTextDropdown');
  if (copySummaryTextBtn && copySummaryTextMenu) {
    copySummaryTextBtn.onclick = (e) => {
      e.stopPropagation();
      if (copySummaryTextMenu.classList.contains('visible')) {
        copySummaryTextMenu.classList.remove('visible');
        if (copySummaryTextDropdown && copySummaryTextMenu.parentElement !== copySummaryTextDropdown) copySummaryTextDropdown.appendChild(copySummaryTextMenu);
      } else {
        copySummaryTextMenu.style.left = '-9999px';
        copySummaryTextMenu.style.right = '';
        copySummaryTextMenu.classList.add('visible');
        const btnRect = copySummaryTextBtn.getBoundingClientRect();
        copySummaryTextMenu.style.position = 'fixed';
        copySummaryTextMenu.style.minWidth = Math.max(btnRect.width, 280) + 'px';
        // Below the button when it fits (measured, not estimated), else above;
        // either way viewport-clamped via the shared helper.
        const menuHeight = copySummaryTextMenu.offsetHeight;
        const spaceBelow = window.innerHeight - (btnRect.bottom + 4);
        const top = spaceBelow < menuHeight
          ? btnRect.top - menuHeight - 4
          : (btnRect.bottom + 4);
        App.placeFixedMenu(copySummaryTextMenu, btnRect.left, top);
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && copySummaryTextMenu.parentElement !== document.body) document.body.appendChild(copySummaryTextMenu);
      }
    };
  }
  async function doCopyEmailSummary(getAnnFn, pageIndices, mode) {
    const opts = {};
    if (getAnnFn) opts.getAnnotations = getAnnFn;
    if (pageIndices != null) opts.pageIndices = pageIndices;
    const text = typeof window.getEmailTextSummary === 'function' ? window.getEmailTextSummary(opts) : '';
    if (!text) {
      alert('No items to summarize. Add counters or line types first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      App.logUserEvent('copy_summary', App.state.currentProjectId || null, { surface: 'email-summary', mode: mode || 'visible' });
      App.showModal('pipeToolingCopiedModal');
      setTimeout(() => App.hideModal('pipeToolingCopiedModal'), 1500);
    } catch (err) {
      alert('Could not copy to clipboard: ' + (err.message || err));
    }
  }
  document.querySelectorAll('.copy-summary-option').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      if (copySummaryTextMenu) {
        copySummaryTextMenu.classList.remove('visible');
        if (copySummaryTextDropdown && copySummaryTextMenu.parentElement !== copySummaryTextDropdown) copySummaryTextDropdown.appendChild(copySummaryTextMenu);
      }
      // T1-05: Copy Summary runs the same pre-copy scale gate as Copy to
      // /Tooling (previously a direct, ungated call).
      if (mode === 'this-canvas') await runGatedCopy(null, [App.state.currentPage], doCopyEmailSummary, 'email-summary', mode);
      else if (mode === 'visible') await runGatedCopy(null, null, doCopyEmailSummary, 'email-summary', mode);
      else if (mode === 'all') await runGatedCopy(window.getMergedAnnotationsForPage, null, doCopyEmailSummary, 'email-summary', mode);
    };
  });

  async function downloadCurrentPageAsPdf(mode) {
    const state = App.state;
    const page = state.pages[state.currentPage];
    const isAllPages = mode === 'all-pages' || mode === 'all-pages-canvases';
    if (!isAllPages && !page?.pdfPage) return;
    if (!isAllPages) App.ensureActiveCanvas(page);
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib?.jsPDF) { alert('Download requires jsPDF. Please refresh the page.'); return; }
    const EXPORT_SCALE = 4;
    const PT_TO_MM = 25.4 / 72;
    const exportOverrides = { markerScale: state.exportSettings?.markerScale ?? 0.75, lineScale: state.exportSettings?.lineScale ?? 0.75 };
    const btn = document.getElementById('downloadCurrentPageBtn');
    const origText = btn?.title || '';
    if (btn) { btn.disabled = true; btn.title = 'Downloading…'; }
    const baseName = App.sanitizeForFilename(state.currentProjectName);
    const pageNum = state.currentPage + 1;
    try {
      if (mode === 'all-canvases') {
        const canvases = App.getPageCanvases(page);
        if (canvases.length === 0) { if (btn) { btn.disabled = false; btn.title = origText; } return; }
        let doc = null;
        for (let i = 0; i < canvases.length; i++) {
          const c = canvases[i];
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
          if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [pdfPageW, pdfPageH], orientation: pdfPageW > pdfPageH ? 'l' : 'p' });
          else doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
          doc.setFontSize(9);
          doc.text(caption, 14, captionTop);
          doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
        }
        if (doc) doc.save('takeoff-page' + pageNum + '_all-canvases_' + baseName + '.pdf');
      } else if (mode === 'all-pages') {
        if (state.pages.length === 0) { if (btn) { btn.disabled = false; btn.title = origText; } return; }
        let doc = null;
        for (let i = 0; i < state.pages.length; i++) {
          if (btn) btn.title = 'Exporting plan ' + (i + 1) + '/' + state.pages.length + '…';
          const p = state.pages[i];
          App.ensureActiveCanvas(p);
          const viewport = p.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: p.rotation ?? 0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await p.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
          App.renderAnnotationsToContext(ctx, p, EXPORT_SCALE, exportOverrides);
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
          const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
          if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
          else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
          doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        }
        if (doc) doc.save('takeoff-all-pages_' + baseName + '.pdf');
      } else if (mode === 'all-pages-canvases') {
        if (state.pages.length === 0) { if (btn) { btn.disabled = false; btn.title = origText; } return; }
        let doc = null;
        for (let pageIdx = 0; pageIdx < state.pages.length; pageIdx++) {
          const p = state.pages[pageIdx];
          App.ensureActiveCanvas(p);
          const canvases = App.getPageCanvases(p);
          if (canvases.length === 0) continue;
          for (let ci = 0; ci < canvases.length; ci++) {
            if (btn) btn.title = 'Exporting page ' + (pageIdx + 1) + '/' + state.pages.length + '…';
            const c = canvases[ci];
            const viewport = p.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: p.rotation ?? 0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await p.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
            App.renderAnnotationsToContext(ctx, p, EXPORT_SCALE, exportOverrides, c.annotations || App.makeAnnotations());
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
            const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
            if (canvases.length === 1) {
              if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
              else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
              doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
            } else {
              const caption = c.name || 'Main';
              const captionTop = 10;
              const imageTop = 14;
              const pdfPageW = Math.max(210, wMm + 28);
              const pdfPageH = imageTop + hMm + 14 + 20;
              if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [pdfPageW, pdfPageH], orientation: pdfPageW > pdfPageH ? 'l' : 'p' });
              else doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
              doc.setFontSize(9);
              doc.text(caption, 14, captionTop);
              doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
            }
          }
        }
        if (doc) doc.save('takeoff-all-pages-canvases_' + baseName + '.pdf');
      } else {
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
        const doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
        doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        doc.save('takeoff-page' + pageNum + '_' + baseName + '.pdf');
      }
      App.logUserEvent('export_pdf', state.currentProjectId, { source: 'download-current-page', mode: mode || 'this-canvas' });
    } catch (err) {
      console.error(err);
      alert('Download failed: ' + (err?.message || err));
    }
    if (btn) { btn.disabled = false; btn.title = origText; }
  }
  const downloadCurrentPageBtn = document.getElementById('downloadCurrentPageBtn');
  const downloadCurrentPageMenu = document.getElementById('downloadCurrentPageMenu');
  if (downloadCurrentPageBtn) {
    downloadCurrentPageBtn.onclick = (e) => {
      e.stopPropagation();
      const state = App.state;
      const page = state.pages[state.currentPage];
      const canvases = page ? App.getPageCanvases(page) : [];
      const multiPage = state.pages.length > 1;
      if (!multiPage && canvases.length <= 1) {
        downloadCurrentPageAsPdf('this-canvas');
      } else if (downloadCurrentPageMenu) {
        if (downloadCurrentPageMenu.classList.contains('visible')) {
          downloadCurrentPageMenu.classList.remove('visible');
        } else {
          downloadCurrentPageMenu.style.left = '-9999px';
          downloadCurrentPageMenu.style.right = '';
          downloadCurrentPageMenu.classList.add('visible');
          const btnRect = downloadCurrentPageBtn.getBoundingClientRect();
          downloadCurrentPageMenu.style.position = 'fixed';
          // Right-aligned to the button (measured width), viewport-clamped.
          App.placeFixedMenu(downloadCurrentPageMenu, btnRect.right - downloadCurrentPageMenu.offsetWidth, btnRect.bottom + 4);
        }
      }
    };
  }
  document.querySelectorAll('.download-page-option').forEach(opt => {
    opt.onclick = (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      if (downloadCurrentPageMenu) downloadCurrentPageMenu.classList.remove('visible');
      if (mode) downloadCurrentPageAsPdf(mode);
    };
  });

  // Share-modal revoke clears the export view-link cache so a revoked token is
  // never handed out (core-function -> feature callback).
  App.onViewLinkRevoked = () => { exportViewLinkUrl = null; exportViewLinkProjectId = null; };

  // --- Shared PDF download helpers (split #37, moved from app.js) ----------
  function sanitizeForFilename(s) {
    const raw = (s || 'Untitled').replace(/\.pdf$/i, '').trim();
    const cleaned = raw.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
    return cleaned || 'Untitled';
  }
  function downloadPdfBuffer(buffer, filename) {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.pdf') ? filename : filename + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function downloadProjectPdf() {
    let buf = null;
    if (App.state.pdfBuffer && App.state.pdfBuffer.byteLength > 0) {
      buf = App.state.pdfBuffer;
    } else if (App.state.pdfStoragePath && App.SUPABASE_ENABLED && App.getSupabase()) {
      try {
        const cachedBlob = App.state.currentProjectId && App.state.pdfHash ? await pdfCacheGet(App.state.currentProjectId, App.state.pdfHash) : null;
        if (cachedBlob && cachedBlob.size > 0) {
          buf = await cachedBlob.arrayBuffer();
        }
        if (!buf || buf.byteLength === 0) {
          const { data: blob, error: dlErr } = await App.getSupabase().storage.from('pdfs').download(App.state.pdfStoragePath);
          if (dlErr || !blob || blob.size === 0) {
            App.showToast('Failed to download PDF: ' + (dlErr?.message || 'PDF not found'), 4000);
            return;
          }
          buf = await blob.arrayBuffer();
        }
      } catch (e) {
        console.error('[Download PDF]', e);
        App.showToast('Failed to download PDF: ' + (e?.message || 'Unknown error'), 4000);
        return;
      }
    }
    if (!buf || buf.byteLength === 0) {
      App.showToast('No PDF available to download.', 3000);
      return;
    }
    downloadPdfBuffer(buf, sanitizeForFilename(App.state.currentProjectName) + '.pdf');
    App.logUserEvent('export_pdf', App.state.currentProjectId, { source: 'project-pdf' });
  }
  App.sanitizeForFilename = sanitizeForFilename;
  App.downloadPdfBuffer = downloadPdfBuffer;
  App.downloadProjectPdf = downloadProjectPdf;
})();

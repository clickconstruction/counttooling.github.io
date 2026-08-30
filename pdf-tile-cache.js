/*
 * pdf-tile-cache.js - the PDF raster-cache substrate, extracted from app.js
 * (stage 1 of the pdf-tile-cache extraction): the page-bitmap LRU, the
 * downsample pyramid, the cross-session persisted zoom rungs, the idle
 * neighbor/rung prefetcher, and the full-document warm-up walk. The deep-zoom
 * stage 2 (2026-07-30) moved the Sharp crop tile / tile grid compositor in
 * here too, completing the raster-cache substrate.
 *
 * Seam recipe (same as save-engine.js / annotation-model.js): exports ONE
 * factory, createPdfTileCache(ctx), instantiated once inside app.js's IIFE.
 * ctx entries are live-value accessor arrows resolved at CALL time, so
 * reassigned app.js `let`s (renderAreaSafety, pdfRenderTask,
 * lastPaintedPdfPage, zoomGestureDirection) and consts declared later in the
 * IIFE (renderService) are always seen current. app.js keeps same-named thin
 * wrappers so every call site, the App registry entries, and the
 * App.__pdfBitmapCache* / __docWarmupState debug seams stay frozen.
 *
 * ctx contract:
 *   getState()                 - the app state object
 *   getMaxZoom()               - current max zoom setting
 *   getCanvasCaps()            - probed device canvas caps ({maxArea, ...})
 *   getRenderAreaSafety()      - the renderAreaSafety ratchet's current value
 *   renderAreaSafetyMax        - RENDER_AREA_SAFETY_MAX (plain value; const)
 *   effectiveDpr(page, zoom)   - effective devicePixelRatio for a render
 *   getMarkedPageIndices()     - page indexes carrying any annotation
 *   renderPdf()                - re-enter the main render (restore-retrigger)
 *   getRenderService()         - the createRenderService instance
 *   isRenderInFlight()         - !!pdfRenderTask (a real render is running)
 *   getCropCanvas()            - the #cropCanvas overlay element
 *   getWrapper()               - the canvas wrapper element (cWrapper)
 *   getPdfCanvas()             - the base #pdfCanvas element
 *   getCurrentEffDpr()         - the last render's effective dpr
 *   getLastRenderedZoom()      - the zoom of the last FULL base render
 *   getLastPaintedPdfPage()    - pdfPage the visible canvas currently shows
 *   getZoomGestureDirection()  - +1 zooming in, -1 out (prefetch bias)
 *
 * Bare classic-script globals read at call time (load order: constants.js and
 * idb.js precede this file in app/index.html): snapZoomToRung, nextRungUp,
 * nextRungDown, ZOOM_RUNGS_MAX_PER_DOC (constants.js); idbZoomRungKey,
 * idbZoomRungsPut, idbZoomRungsGetForPage (idb.js).
 */
function createPdfTileCache(ctx) {
  // Small LRU of recently rendered page bitmaps so switching back to a recent
  // page (or to an idle-prefetched neighbor) blits in ~1 frame instead of
  // re-running a full pdf.js raster — the dominant page-switch cost on
  // vector-dense sheets. The key is SELF-VALIDATING: pdfPage proxy identity +
  // rotation + zoom + effDpr. That automatically invalidates on: page delete
  // (proxy never looked up again), prepare-pdf's pdfPage rebind (new proxy),
  // undo's in-place rotation write, wrapper resize (fitZoom yields a new
  // zoom), and any renderAreaSafety/caps change (new effDpr). Explicit clears
  // are hygiene only — they free memory when a document is torn down or the
  // device shows pressure.
  const PDF_BITMAP_CACHE_MAX = (typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory >= 8) ? 10 : 6;   // entries — rungs + neighbor pages coexist; the total-px budget below is the real memory bound
  const PDF_BITMAP_CACHE_AREA_FRAC = 0.35;           // of caps.maxArea × renderAreaSafety
  // Per-entry / whole-cache pixel budgets. A hi-DPI (2x) fit-zoom page buffer
  // is ~6M px, and the old budget (min(0.15 × maxArea × safety, 5M) — often
  // ~1.25M with the fallback caps) was BELOW it, so on Retina displays the
  // cache retained nothing and every zoom commit / page flip / re-render was
  // a full multi-second raster on dense sheets. 16M px ≈ 64MB RGBA per entry,
  // 24M px total across entries; both halved on low-memory devices.
  const PDF_BITMAP_LOW_MEM = typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory <= 4;
  const PDF_BITMAP_HIGH_MEM = typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory >= 8;
  const PDF_BITMAP_CACHE_AREA_ABS = PDF_BITMAP_LOW_MEM ? 8000000 : 16000000;
  const PDF_BITMAP_CACHE_TOTAL_PX = PDF_BITMAP_LOW_MEM ? 12000000 : (PDF_BITMAP_HIGH_MEM ? 48000000 : 24000000);
  const pdfBitmapCache = [];                          // LRU: oldest first, [{pdfPage, rotation, zoom, effDpr, bitmap, w, h}]
  let pdfBitmapCacheGeneration = 0;                   // bumped on clear; async inserts self-discard if it moved
  const pdfBitmapCacheStats = { hits: 0, misses: 0, prefetched: 0, derived: 0, persisted: 0, restored: 0 };
  function pdfBitmapCacheMaxArea() {
    return Math.min(PDF_BITMAP_CACHE_AREA_FRAC * ctx.getCanvasCaps().maxArea * ctx.getRenderAreaSafety(), PDF_BITMAP_CACHE_AREA_ABS);
  }
  function pdfBitmapCacheTotalArea() {
    return pdfBitmapCache.reduce((sum, e) => sum + e.w * e.h, 0);
  }
  function pdfBitmapCacheGet(pdfPage, rotation, zoom, effDpr) {
    for (let i = pdfBitmapCache.length - 1; i >= 0; i--) {
      const e = pdfBitmapCache[i];
      if (e.pdfPage === pdfPage && e.rotation === rotation && Math.abs(e.zoom - zoom) < 1e-6 && e.effDpr === effDpr) {
        // LRU touch: move to the end (most recent).
        pdfBitmapCache.splice(i, 1);
        pdfBitmapCache.push(e);
        return e;
      }
    }
    return null;
  }
  // Latest entry for the page regardless of zoom/effDpr — the stale-blit
  // preview source when a switch lands at a zoom we haven't cached.
  function pdfBitmapCacheGetAnyZoom(pdfPage, rotation) {
    for (let i = pdfBitmapCache.length - 1; i >= 0; i--) {
      const e = pdfBitmapCache[i];
      if (e.pdfPage === pdfPage && e.rotation === rotation) return e;
    }
    return null;
  }
  function pdfBitmapCacheDrop(entry) {
    const i = pdfBitmapCache.indexOf(entry);
    if (i >= 0) pdfBitmapCache.splice(i, 1);
    try { entry.bitmap.close(); } catch (_) { /* already closed */ }
  }
  function pdfBitmapCachePut(entry) {
    // Replace any same-key entry (same page re-rendered, e.g. after a blit
    // read-back drop), then evict oldest past the cap. close() everywhere —
    // ImageBitmap backing stores must never wait for GC.
    for (let i = pdfBitmapCache.length - 1; i >= 0; i--) {
      const e = pdfBitmapCache[i];
      if (e.pdfPage === entry.pdfPage && e.rotation === entry.rotation && Math.abs(e.zoom - entry.zoom) < 1e-6 && e.effDpr === entry.effDpr) {
        pdfBitmapCache.splice(i, 1);
        try { e.bitmap.close(); } catch (_) { /* already closed */ }
      }
    }
    pdfBitmapCache.push(entry);
    // Evict oldest past the entry cap OR the whole-cache pixel budget (but
    // never the entry just inserted — a single giant entry is legal as long
    // as it passed the per-entry cap).
    while (pdfBitmapCache.length > PDF_BITMAP_CACHE_MAX ||
           (pdfBitmapCache.length > 1 && pdfBitmapCacheTotalArea() > PDF_BITMAP_CACHE_TOTAL_PX)) {
      const old = pdfBitmapCache.shift();
      try { old.bitmap.close(); } catch (_) { /* already closed */ }
    }
  }
  function clearPdfBitmapCache() {
    pdfBitmapCacheGeneration++;
    clearPyramidQueue();
    docWarmupDone.clear();          // new document (or rebind): the warm-up walk restarts
    zoomRungsPersistedKeys.clear();   // new doc identity: persist dedupe resets
    zoomRungsRestoreAttempted.clear();   // restore attempts are per-generation — the bump just discarded any restored rungs, and the next document may share the content hash (Prepare commit of an untrimmed upload)
    updateDocWarmupIndicator();       // progress hint resets with the walk
    while (pdfBitmapCache.length) {
      const e = pdfBitmapCache.pop();
      try { e.bitmap.close(); } catch (_) { /* already closed */ }
    }
  }
  // Snapshot a just-rendered canvas into the cache. createImageBitmap copies
  // the pixels synchronously at call time (only delivery is async), so the
  // caller may free/reuse the source right after. The generation guard makes
  // a clear-between-snapshot-and-insert discard the late bitmap instead of
  // repopulating a torn-down cache.
  function pdfBitmapCacheCapture(sourceCanvas, key, { prefetch } = {}) {
    if (typeof createImageBitmap !== 'function') return;                 // old Safari: cache disabled, behavior as before
    if (sourceCanvas.width * sourceCanvas.height > pdfBitmapCacheMaxArea()) return;   // deep-zoom giants are never cached
    const gen = pdfBitmapCacheGeneration;
    const w = sourceCanvas.width, h = sourceCanvas.height;
    createImageBitmap(sourceCanvas).then((bitmap) => {
      if (gen !== pdfBitmapCacheGeneration) { try { bitmap.close(); } catch (_) {} return; }
      const entry = { pdfPage: key.pdfPage, rotation: key.rotation, zoom: key.zoom, effDpr: key.effDpr, bitmap, w, h };
      pdfBitmapCachePut(entry);
      if (prefetch) pdfBitmapCacheStats.prefetched++;
      schedulePyramidDerive(entry);
      schedulePersistZoomRung(entry);   // cross-session pyramid (rung captures only)
    }).catch(() => { /* capture is best-effort; a miss just re-renders */ });
  }

  // --- The downsample pyramid ---
  // A full-page bitmap rastered at zoom Z can produce every rung BELOW it by
  // GPU downscaling — a few ms of drawImage instead of a full pdf.js
  // operator-list re-walk. So after any capture, derive the rungs down to
  // ~PYRAMID_MIN_RATIO of the source (below that, quality and savings both
  // fade — a real raster at that size is cheap anyway). One derivation per
  // macrotask keeps the main thread jank-free; every level derives from the
  // ORIGINAL source (never derived-from-derived, which compounds smoothing).
  // Derived entries satisfy the prefetcher's cache checks, so idle warm-up
  // only spends real rasters on UP-rungs — zooming back out is always warm.
  const PYRAMID_MIN_RATIO = 0.55;      // derive down ~3 rungs (1/1.15^3 ≈ 0.66, with margin)
  const pyramidQueue = [];
  let pyramidTimer = null;
  let pyramidScratch = null;
  function clearPyramidQueue() {
    pyramidQueue.length = 0;
    if (pyramidTimer) { clearTimeout(pyramidTimer); pyramidTimer = null; }
  }
  function schedulePyramidDerive(srcEntry) {
    pyramidQueue.push(srcEntry);
    if (!pyramidTimer) pyramidTimer = setTimeout(runPyramidDerive, 0);
  }
  function runPyramidDerive() {
    pyramidTimer = null;
    const src = pyramidQueue.shift();
    if (src && pdfBitmapCache.includes(src)) {
      // Find the highest uncached rung at-or-below the source within ratio.
      const stubPage = { pdfPage: src.pdfPage, rotation: src.rotation };
      const maxZ = ctx.getMaxZoom();
      let rung = snapZoomToRung(src.zoom, 0.2, maxZ);
      if (rung > src.zoom * 1.0001) rung = nextRungDown(rung, 0.2, maxZ);   // never upscale
      let target = null;
      while (rung >= src.zoom * PYRAMID_MIN_RATIO) {
        if (rung < src.zoom * 0.9999) {   // skip a rung that IS the source zoom
          const effR = ctx.effectiveDpr(stubPage, rung);
          if (!pdfBitmapCacheGet(src.pdfPage, src.rotation, rung, effR)) { target = { rung, effR }; break; }
        }
        const next = nextRungDown(rung, 0.2, maxZ);
        if (Math.abs(next - rung) < 1e-9) break;
        rung = next;
      }
      if (target) {
        try {
          const vp = src.pdfPage.getViewport({ scale: target.rung * target.effR, rotation: src.rotation });
          const tw = Math.max(1, Math.round(vp.width)), th = Math.max(1, Math.round(vp.height));
          if (!pyramidScratch) pyramidScratch = document.createElement('canvas');
          pyramidScratch.width = tw;
          pyramidScratch.height = th;
          const g = pyramidScratch.getContext('2d');
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = 'high';
          g.drawImage(src.bitmap, 0, 0, src.w, src.h, 0, 0, tw, th);
          const gen = pdfBitmapCacheGeneration;
          createImageBitmap(pyramidScratch).then((bitmap) => {
            if (gen !== pdfBitmapCacheGeneration) { try { bitmap.close(); } catch (_) {} return; }
            pdfBitmapCachePut({ pdfPage: src.pdfPage, rotation: src.rotation, zoom: target.rung, effDpr: target.effR, bitmap, w: tw, h: th, derived: true });
            pdfBitmapCacheStats.derived++;
          }).catch(() => { /* best-effort */ });
          pyramidScratch.width = 0;
          pyramidScratch.height = 0;
          pyramidQueue.push(src);   // continue to the next level down on a later tick
        } catch (_) { /* a failed derive just leaves the rung cold */ }
      }
    }
    if (pyramidQueue.length && !pyramidTimer) pyramidTimer = setTimeout(runPyramidDerive, 0);
  }

  // --- Cross-session pyramid (persisted rung bitmaps) ---
  // Rastered RUNG bitmaps persist to IndexedDB as webp blobs keyed by the
  // document's content hash (renderService.ensureDocHash — works with or
  // without the worker), so a daily project reopens with yesterday's zoom
  // ladder warm. Restore is lazy per (doc, page) on first render; restored
  // entries feed the same cache — and the downsample pyramid re-derives the
  // levels below them for free. All best-effort; failures just stay cold.
  const zoomRungsRestoreAttempted = new Set();
  // Per-doc pyramid cap, page-count-aware: room for every page's fit rung
  // (the full-document warm-up) plus a working set of zoomed rungs. The
  // ~96MB global byte budget in idb.js remains the true bound.
  function zoomRungsPerDocCap() {
    return Math.max(ZOOM_RUNGS_MAX_PER_DOC, (ctx.getState().pages.length || 0) * 2);
  }
  const zoomRungsPersistedKeys = new Set();   // session dedupe — re-captures of an evicted rung don't re-write the same webp
  function schedulePersistZoomRung(entry) {
    if (entry.derived) return;
    if (Math.abs(snapZoomToRung(entry.zoom, 0.2, ctx.getMaxZoom()) - entry.zoom) > 1e-9) return;   // rungs only
    ctx.getRenderService().ensureDocHash(entry.pdfPage).then((hash) => {
      if (!hash || !pdfBitmapCache.includes(entry)) return;   // no identity, or already evicted
      const dedupeKey = idbZoomRungKey(hash, entry.pdfPage.pageNumber, entry.rotation, entry.zoom, entry.effDpr);
      if (zoomRungsPersistedKeys.has(dedupeKey)) return;
      zoomRungsPersistedKeys.add(dedupeKey);
      try {
        const c = document.createElement('canvas');
        c.width = entry.w;
        c.height = entry.h;
        c.getContext('2d').drawImage(entry.bitmap, 0, 0);
        c.toBlob((blob) => {
          c.width = 0; c.height = 0;
          if (!blob) return;
          idbZoomRungsPut({
            k: idbZoomRungKey(hash, entry.pdfPage.pageNumber, entry.rotation, entry.zoom, entry.effDpr),
            dp: hash + '|' + entry.pdfPage.pageNumber,
            docHash: hash, pageNumber: entry.pdfPage.pageNumber,
            rotation: entry.rotation, zoom: entry.zoom, effDpr: entry.effDpr,
            w: entry.w, h: entry.h, bytes: blob.size, at: Date.now(), blob,
          }, zoomRungsPerDocCap()).then((ok) => { if (ok) pdfBitmapCacheStats.persisted++; });
        }, 'image/webp', 0.85);
      } catch (_) { /* persistence is best-effort */ }
    });
  }
  function maybeRestorePersistedRungs(page) {
    if (!page || !page.pdfPage || typeof createImageBitmap !== 'function') return;
    const pdfPage = page.pdfPage;
    const gen = pdfBitmapCacheGeneration;
    ctx.getRenderService().ensureDocHash(pdfPage).then((hash) => {
      if (!hash) return;
      // Stale attempt from before a generation bump: its decodes would be
      // discarded below, so it must not consume the NEW generation's attempt
      // key either (the pre-Prepare transient render resolves its hash here
      // after the commit's clear — same content hash, poisoned forever).
      if (gen !== pdfBitmapCacheGeneration) return;
      const attemptKey = hash + '|' + pdfPage.pageNumber;
      if (zoomRungsRestoreAttempted.has(attemptKey)) return;
      zoomRungsRestoreAttempted.add(attemptKey);
      idbZoomRungsGetForPage(hash, pdfPage.pageNumber).then((rows) => {
        let retriggered = false;
        rows.forEach((row) => {
          if (!row || !row.blob) return;
          if (row.rotation !== (page.rotation ?? 0)) return;
          if (pdfBitmapCacheGet(pdfPage, row.rotation, row.zoom, row.effDpr)) return;
          createImageBitmap(row.blob).then((bitmap) => {
            if (gen !== pdfBitmapCacheGeneration ||
                pdfBitmapCacheGet(pdfPage, row.rotation, row.zoom, row.effDpr)) { try { bitmap.close(); } catch (_) {} return; }
            pdfBitmapCachePut({ pdfPage, rotation: row.rotation, zoom: row.zoom, effDpr: row.effDpr, bitmap, w: row.w, h: row.h, restored: true });
            pdfBitmapCacheStats.restored++;
            // Restore raced the flip's cold raster: renderPdf committed to a
            // full raster before this decode landed, so the user is staring
            // at the previous sheet while a dense page rasters. Re-enter
            // renderPdf once — the ladder now finds the restored rung and
            // paints it immediately (rung blit or stale-blit preview); the
            // crisp raster follows via the normal exact-refine/raster path.
            const st = ctx.getState();
            if (!retriggered &&
                st.pages[st.currentPage] === page &&
                ctx.getLastPaintedPdfPage() !== pdfPage) {
              retriggered = true;
              ctx.renderPdf();
            }
          }).catch(() => { /* a failed decode just stays cold */ });
        });
      });
    });
  }

  // --- Idle prefetch of adjacent pages ---
  // After a render settles, speculatively raster currentPage±1 at their
  // predicted fit zoom into the cache, so the common "flip to the next sheet"
  // is a blit. pdf.js executes operator lists in main-thread chunks, so a
  // prefetch must yield to ANY interaction: renderPdf's entry and the
  // wheel/touchstart/pointerdown listeners (bound in app.js's Event Binding
  // section) all call cancelPdfBitmapPrefetch. One prefetch at a time; the
  // completion re-arms the timer for the other neighbor.
  let pdfPrefetchTimer = null;
  let pdfPrefetchTask = null;
  let pdfPrefetchScratch = null;    // dedicated — never app.js's pdfOffscreenCanvas
  let pdfPrefetchGen = 0;           // bumped on cancel; async warm-up continuations self-discard
  // One attempt per key per CHAIN: a capture's pyramid derives can evict a
  // sibling candidate from the slot-capped cache, and without this guard the
  // idle chain re-rasters the evicted key, whose derives evict another —
  // a perpetual raster + IDB-persist loop on dense sheets (observed at ~12
  // rasters/s, hidden by interaction cancels). Cleared on cancel (user
  // interaction / render entry starts a fresh context), kept across the
  // chain's own re-arms.
  const pdfPrefetchAttempted = new Set();
  function pdfPrefetchKeyOf(pdfPage, rot, zoom, eff) {
    return pdfPage.pageNumber + '|' + rot + '|' + zoom.toFixed(6) + '|' + eff.toFixed(4);
  }
  function cancelPdfBitmapPrefetch() {
    pdfPrefetchGen++;
    pdfPrefetchAttempted.clear();
    if (pdfPrefetchTimer) { clearTimeout(pdfPrefetchTimer); pdfPrefetchTimer = null; }
    if (pdfPrefetchTask) { try { pdfPrefetchTask.cancel(); } catch (_) { /* settling */ } pdfPrefetchTask = null; }
  }
  function schedulePdfBitmapPrefetch(delayMs) {
    if (pdfPrefetchTimer) clearTimeout(pdfPrefetchTimer);
    // 50ms, not the old 250: with the render worker the main-thread cost of a
    // prefetch is a postMessage, and the wheel/touch/pointer listeners still
    // cancel instantly on interaction. The rung the user needs next should be
    // rastering before their finger leaves the wheel. (The document warm-up
    // tier re-arms at a gentler 250ms — background work, no user waiting.)
    pdfPrefetchTimer = setTimeout(runPdfBitmapPrefetch, delayMs || 50);
  }
  function predictedFitZoom(page) {
    const wrap = document.querySelector('.canvas-wrapper');
    if (!wrap || !page?.pdfPage) return null;
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    return Math.max(0.2, Math.min(ctx.getMaxZoom(), Math.min(r.width / vp.width, r.height / vp.height)));
  }
  function runPdfBitmapPrefetch() {
    pdfPrefetchTimer = null;
    if (typeof createImageBitmap !== 'function') return;
    if (document.hidden) return;
    if (ctx.getRenderAreaSafety() < ctx.renderAreaSafetyMax) return;   // device showed memory pressure: no speculation
    if (ctx.isRenderInFlight() || pdfPrefetchTask) return;             // real render or a prefetch already in flight
    // Candidate order: the current page at the ADJACENT ZOOM RUNGS first
    // (zooming is the hot path — commits snap to rungs, so warming rung±1
    // makes the next zoom step a synchronous blit), then the neighbor pages
    // at their predicted fit zoom (the page-flip path). Rung candidates only
    // apply when the current zoom sits on a rung (i.e. after a commit — never
    // mid-gesture, and not at a continuous fit zoom).
    const state = ctx.getState();
    const candidates = [];
    const curPage = state.pages[state.currentPage];
    if (curPage && curPage.pdfPage) {
      const maxZ = ctx.getMaxZoom();
      // state.zoom is continuous; the rung NEAREST it plus its neighbors are
      // the bitmaps the next commit in either direction will be served from.
      const rung0 = snapZoomToRung(state.zoom, 0.2, maxZ);
      candidates.push({ page: curPage, zoom: rung0 });   // loop below skips it when already cached
      // Two rungs out in each direction — rapid multi-tick zooms span several
      // rungs, and warm rungs are what rung-riding blits from mid-gesture.
      // Momentum bias: warm the direction the user has been zooming FIRST
      // (down-rungs usually arrive free via the downsample pyramid anyway).
      const ups = [], downs = [];
      let up = rung0, down = rung0;
      for (let step = 0; step < 2; step++) {
        const nu = nextRungUp(up, 0.2, maxZ);
        if (Math.abs(nu - up) > 1e-9) { ups.push({ page: curPage, zoom: nu }); up = nu; }
        const nd = nextRungDown(down, 0.2, maxZ);
        if (Math.abs(nd - down) > 1e-9) { downs.push({ page: curPage, zoom: nd }); down = nd; }
      }
      const ordered = ctx.getZoomGestureDirection() < 0 ? downs.concat(ups) : ups.concat(downs);
      candidates.push(...ordered);
    }
    for (const idx of [state.currentPage + 1, state.currentPage - 1]) {
      const page = state.pages[idx];
      if (!page || !page.pdfPage) continue;
      const zoom = predictedFitZoom(page);
      if (zoom == null) continue;
      candidates.push({ page, zoom });
    }
    for (const cand of candidates) {
      const page = cand.page;
      const zoom = cand.zoom;
      const eff = ctx.effectiveDpr(page, zoom);
      const rot = page.rotation ?? 0;
      if (pdfBitmapCacheGet(page.pdfPage, rot, zoom, eff)) continue;   // already cached
      const attemptKey = pdfPrefetchKeyOf(page.pdfPage, rot, zoom, eff);
      if (pdfPrefetchAttempted.has(attemptKey)) continue;   // once per chain — evictions don't re-trigger
      const viewport = page.pdfPage.getViewport({ scale: zoom * eff, rotation: rot });
      if (viewport.width * viewport.height > pdfBitmapCacheMaxArea()) continue;
      pdfPrefetchAttempted.add(attemptKey);
      if (!pdfPrefetchScratch) pdfPrefetchScratch = document.createElement('canvas');
      pdfPrefetchScratch.width = viewport.width;
      pdfPrefetchScratch.height = viewport.height;
      const key = { pdfPage: page.pdfPage, rotation: rot, zoom, effDpr: eff };
      const task = ctx.getRenderService().raster({ pdfPage: page.pdfPage, scale: zoom * eff, rotation: rot, canvasContext: pdfPrefetchScratch.getContext('2d'), kind: 'prefetch' });
      pdfPrefetchTask = task;
      task.promise.then(() => {
        if (pdfPrefetchTask === task) pdfPrefetchTask = null;
        // createImageBitmap copies synchronously at call time, so the scratch
        // can be freed immediately after the capture call.
        pdfBitmapCacheCapture(pdfPrefetchScratch, key, { prefetch: true });
        pdfPrefetchScratch.width = 0;
        pdfPrefetchScratch.height = 0;
        schedulePdfBitmapPrefetch();   // other neighbor on the next idle slot
      }).catch((err) => {
        if (pdfPrefetchTask === task) pdfPrefetchTask = null;
        pdfPrefetchScratch.width = 0;
        pdfPrefetchScratch.height = 0;
        if (err && err.name !== 'RenderingCancelledException') { /* speculative: swallow */ }
      });
      return;   // one at a time
    }
    // Near field fully warm — continue with the document warm-up walk.
    runDocWarmupStep();
  }

  // --- Full-document warm-up (the "last pages load slow" fix, part 2) ---
  // Once the near-field candidates (current-page rungs, neighbor pages) are
  // warm, idle time walks EVERY page of the document outward from the current
  // one, rastering each at its rung-snapped fit zoom through the same
  // one-at-a-time prefetch slot (kind 'prefetch' → the worker pool's
  // background seat when present). Rung-snapped captures flow through
  // schedulePersistZoomRung into the IndexedDB pyramid, so a first visit to
  // page 36 of a 39-page set blits warm — this session AND on tomorrow's
  // reopen. Pages whose fit rung is already persisted cost one IDB index read
  // and no raster. Same interaction discipline as the near-field tiers: any
  // renderPdf entry or wheel/touch/pointerdown cancels instantly
  // (pdfPrefetchGen invalidates in-flight async continuations), and the walk
  // resumes from where it left off at the next idle settle. Skipped on
  // low-memory devices and under memory pressure.
  const docWarmupDone = new Set();   // page indexes warmed (or found persisted) this document
  // Subtle status-bar progress ("Preparing pages 22/38") while the walk runs —
  // it makes the background work visible and teaches that letting a big set
  // sit for a few seconds after opening pays off. Hidden once complete (and
  // whenever no multi-page document is loaded).
  function updateDocWarmupIndicator() {
    const el = document.getElementById('statusWarmup');
    if (!el) return;
    const state = ctx.getState();
    const total = Math.max(0, state.pages.length - 1);
    const done = Math.min(docWarmupDone.size, total);
    const active = state.pages.length >= 2 && done > 0 && done < total;
    el.style.display = active ? '' : 'none';
    if (active) el.textContent = 'Preparing pages ' + done + '/' + total;
  }
  function runDocWarmupStep() {
    if (typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory <= 4) return;
    const state = ctx.getState();
    if (state.pages.length < 2) return;
    const cur = state.currentPage;
    let idx = -1;
    // MARKED pages first (nearest to the current page): the sheets carrying
    // the user's annotations are the ones they actually jump to, so they warm
    // in the first seconds instead of wherever the spiral reaches them.
    let bestDist = Infinity;
    for (const m of ctx.getMarkedPageIndices()) {
      if (m === cur || docWarmupDone.has(m) || !state.pages[m]?.pdfPage) continue;
      const d = Math.abs(m - cur);
      if (d < bestDist) { bestDist = d; idx = m; }
    }
    // Then the outward spiral over everything else.
    for (let d = 1; d < state.pages.length && idx < 0; d++) {
      for (const cand of [cur + d, cur - d]) {
        if (cand >= 0 && cand < state.pages.length && !docWarmupDone.has(cand) && state.pages[cand]?.pdfPage) { idx = cand; break; }
      }
    }
    if (idx < 0) { updateDocWarmupIndicator(); return; }   // whole document warm
    const page = state.pages[idx];
    const fitZ = predictedFitZoom(page);
    if (fitZ == null) return;
    const zoom = snapZoomToRung(fitZ, 0.2, ctx.getMaxZoom());
    const eff = ctx.effectiveDpr(page, zoom);
    const rot = page.rotation ?? 0;
    const advance = (delayMs) => { docWarmupDone.add(idx); updateDocWarmupIndicator(); schedulePdfBitmapPrefetch(delayMs); };
    if (pdfBitmapCacheGet(page.pdfPage, rot, zoom, eff)) { advance(50); return; }
    const gen = pdfPrefetchGen;
    const stale = () => gen !== pdfPrefetchGen || document.hidden || ctx.isRenderInFlight() || pdfPrefetchTask;
    ctx.getRenderService().ensureDocHash(page.pdfPage).then((hash) => {
      if (stale()) return;
      const raster = () => {
        if (stale()) return;
        const viewport = page.pdfPage.getViewport({ scale: zoom * eff, rotation: rot });
        if (viewport.width * viewport.height > pdfBitmapCacheMaxArea()) { advance(250); return; }
        pdfPrefetchAttempted.add(pdfPrefetchKeyOf(page.pdfPage, rot, zoom, eff));
        if (!pdfPrefetchScratch) pdfPrefetchScratch = document.createElement('canvas');
        pdfPrefetchScratch.width = viewport.width;
        pdfPrefetchScratch.height = viewport.height;
        const key = { pdfPage: page.pdfPage, rotation: rot, zoom, effDpr: eff };
        const task = ctx.getRenderService().raster({ pdfPage: page.pdfPage, scale: zoom * eff, rotation: rot, canvasContext: pdfPrefetchScratch.getContext('2d'), kind: 'prefetch' });
        pdfPrefetchTask = task;
        task.promise.then(() => {
          if (pdfPrefetchTask === task) pdfPrefetchTask = null;
          pdfBitmapCacheCapture(pdfPrefetchScratch, key, { prefetch: true });
          pdfPrefetchScratch.width = 0;
          pdfPrefetchScratch.height = 0;
          advance(250);   // gentler cadence — nobody is waiting on the far pages
        }).catch((err) => {
          if (pdfPrefetchTask === task) pdfPrefetchTask = null;
          pdfPrefetchScratch.width = 0;
          pdfPrefetchScratch.height = 0;
          if (err && err.name !== 'RenderingCancelledException') { /* speculative: swallow */ }
        });
      };
      if (!hash) { raster(); return; }   // no identity: still warm in-memory + pyramid-derive
      idbZoomRungsGetForPage(hash, page.pdfPage.pageNumber).then((rows) => {
        if (stale()) return;
        const persisted = (rows || []).some((r) => r && r.rotation === rot &&
          Math.abs(r.zoom - zoom) < 1e-6 && Math.abs(r.effDpr - eff) < 1e-3);
        if (persisted) { advance(50); return; }   // lazy-restores on first visit — no raster needed
        raster();
      });
    });
  }

  // --- Sharp crop tile (deep-zoom sharpening + window-first commits) ---
  // (stage 2 of the extraction; moved from app.js's Sharp crop tile section)
  // Two jobs, one canvas. (a) DEEP-ZOOM SHARPENING: when effectiveDpr clamps
  // the full-page buffer below devicePixelRatio the base render goes soft, so
  // raster just the visible window at full dpr on top. (b) WINDOW-FIRST COLD
  // COMMITS (renderCropTile({force, onDone}) from commitZoomRender): a zoom
  // commit whose rung isn't in the bitmap cache paints the visible window at
  // the NEW zoom first — sharp pixels under the cursor in a fraction of the
  // full-page raster time — then chains the full raster via onDone; renderPdf
  // keeps a target-matching tile up during that raster and retires it when
  // the crisp base paints (the baseZoom check). In both modes the tile is
  // a small overlay canvas
  // (#ctx.getCropCanvas(), DOM-sandwiched between ctx.getPdfCanvas() and the annotation
  // overlay). The tile is positioned in CONTENT space (style.left/top inside
  // the transformed container), so pans keep it glued to the sheet and the
  // zoom preview scales it with everything else. Debounce-scheduled after a
  // render settles or a pan ends; cleared the moment a new base raster starts
  // (renderPdf entry); hidden until its own raster completes so a
  // half-painted tile is never visible. Annotations are NOT in the tile —
  // the overlay above remains the single source of marks; this is purely a
  // sharpening layer for the PDF underneath. Best-effort: any failure just
  // leaves the (correct, soft) base render.
  let cropTileTask = null;
  let cropTileTimer = null;
  let cropTileKey = null;              // key of the tile currently shown
  let cropTileOnDone = null;           // pending force-mode chain (the commit's full render)
  const CROP_TILE_DELAY_MS = 200;      // settle time after render/pan before sharpening
  const CROP_TILE_MIN_DEFICIT = 1.15;  // only sharpen when dpr/effDpr is meaningfully soft
  function clearCropTile() {
    if (cropTileTimer) { clearTimeout(cropTileTimer); cropTileTimer = null; }
    if (cropTileTask) { try { cropTileTask.cancel(); } catch (_) { /* settling */ } cropTileTask = null; }
    cropTileOnDone = null;   // the caller that clears owns (or abandons) the follow-up render
    cropTileKey = null;
    flushTileGrid();
    if (ctx.getCropCanvas() && ctx.getCropCanvas().width) { ctx.getCropCanvas().width = 0; ctx.getCropCanvas().height = 0; }
    if (ctx.getCropCanvas()) ctx.getCropCanvas().style.display = 'none';
  }
  function scheduleCropTile() {
    if (!ctx.getCropCanvas()) return;
    if (cropTileTimer) clearTimeout(cropTileTimer);
    cropTileTimer = setTimeout(renderCropTile, CROP_TILE_DELAY_MS);
  }
  function renderCropTile(options) {
    const force = !!(options && options.force);
    const onDone = (options && options.onDone) || null;
    cropTileTimer = null;
    if (!ctx.getCropCanvas()) { if (onDone) onDone(); return; }
    // An idle/pan-end call must never disturb a commit tile whose chained
    // full render is still pending — clearing it here dropped the chain and
    // left the view stuck on the stretched preview (the black-screen bug).
    if (!force && cropTileOnDone) return;
    const page = ctx.getState().pages[ctx.getState().currentPage];
    if (!page || !page.pdfPage) { clearCropTile(); if (onDone) onDone(); return; }
    const dpr = window.devicePixelRatio || 1;
    if (!force && (!(ctx.getCurrentEffDpr() > 0) || dpr / ctx.getCurrentEffDpr() < CROP_TILE_MIN_DEFICIT)) { clearCropTile(); return; }
    if (!force) { ensureTileCoverage(); return; }   // idle deep-zoom sharpening = the tile compositor
    if (ctx.isRenderInFlight()) {
      // A real raster is in flight. Forced (commit) mode falls through to the
      // full-render orchestration; idle mode just waits its turn.
      if (onDone) { onDone(); return; }
      scheduleCropTile();
      return;
    }
    const wrap = ctx.getWrapper();
    if (!wrap) { if (onDone) onDone(); return; }
    const r = wrap.getBoundingClientRect();
    const pageCssW = parseFloat(ctx.getPdfCanvas().style.width) || 0;
    const pageCssH = parseFloat(ctx.getPdfCanvas().style.height) || 0;
    if (!r.width || !pageCssW || !pageCssH) { if (onDone) onDone(); return; }
    // The tile lives in CONTAINER units — the coordinate system of the last
    // FULL render (pageCss* = pagePts × ctx.getLastRenderedZoom()), which the preview
    // transform then scales by k = zoom/ctx.getLastRenderedZoom(). After a full render
    // k is 1 and this reduces to the plain visible-window math; during a
    // tile-first commit (base still at the old zoom) k ≠ 1 and the CSS box is
    // authored in old-zoom units while the buffer rasters at the NEW zoom, so
    // the on-screen result is exactly screen-resolution sharp.
    const k = (ctx.getLastRenderedZoom() > 0) ? ctx.getState().zoom / ctx.getLastRenderedZoom() : 1;
    const x0 = Math.max(0, -ctx.getState().pan.x / k);
    const y0 = Math.max(0, -ctx.getState().pan.y / k);
    const w = Math.min(pageCssW, x0 + r.width / k) - x0;
    const h = Math.min(pageCssH, y0 + r.height / k) - y0;
    if (w <= 0 || h <= 0) { if (onDone) onDone(); return; }
    const rot = page.rotation ?? 0;
    const key = { pdfPage: page.pdfPage, rot, zoom: ctx.getState().zoom, baseZoom: ctx.getLastRenderedZoom(), x0: Math.round(x0), y0: Math.round(y0), w: Math.round(w), h: Math.round(h) };
    if (cropTileKey && ctx.getCropCanvas().style.display !== 'none' &&
        cropTileKey.pdfPage === key.pdfPage && cropTileKey.rot === key.rot && cropTileKey.zoom === key.zoom &&
        cropTileKey.baseZoom === key.baseZoom &&
        cropTileKey.x0 === key.x0 && cropTileKey.y0 === key.y0 && cropTileKey.w === key.w && cropTileKey.h === key.h) {
      if (onDone) onDone();
      return;   // the identical tile is already up
    }
    // Buffer = on-screen px × dpr (w·k CSS px visible), bounded by the render
    // budget; and when the window IS most of the page (fit-ish zooms) the tile
    // buys nothing over the full raster — skip straight to it.
    const bw = Math.ceil(w * k * dpr), bh = Math.ceil(h * k * dpr);
    if (bw * bh > ctx.getCanvasCaps().maxArea * ctx.getRenderAreaSafety()) { if (onDone) onDone(); return; }
    if (force) {
      const effT = ctx.effectiveDpr(page, ctx.getState().zoom);
      const vpT = page.pdfPage.getViewport({ scale: ctx.getState().zoom * effT, rotation: rot });
      if (bw * bh > 0.7 * vpT.width * vpT.height) { onDone && onDone(); return; }
    }
    if (cropTileTask) { try { cropTileTask.cancel(); } catch (_) { /* settling */ } cropTileTask = null; }
    cropTileOnDone = onDone;   // this call owns the chain from here on
    ctx.getCropCanvas().style.display = 'none';
    ctx.getCropCanvas().width = bw;
    ctx.getCropCanvas().height = bh;
    ctx.getCropCanvas().style.width = w + 'px';
    ctx.getCropCanvas().style.height = h + 'px';
    ctx.getCropCanvas().style.left = x0 + 'px';
    ctx.getCropCanvas().style.top = y0 + 'px';
    // offsetX/offsetY are in output px of this viewport: container CSS px x0
    // is page-point x0/baseZoom, which lands at output px x0·k·dpr at scale
    // zoom·dpr — shift by its negative.
    const task = ctx.getRenderService().raster({ pdfPage: page.pdfPage, scale: ctx.getState().zoom * dpr, rotation: rot, offsetX: -x0 * k * dpr, offsetY: -y0 * k * dpr, canvasContext: ctx.getCropCanvas().getContext('2d'), kind: 'tile' });
    cropTileTask = task;
    task.promise.then(() => {
      if (cropTileTask !== task) return;   // superseded — the new owner runs its own chain
      cropTileTask = null;
      const chain = cropTileOnDone; cropTileOnDone = null;
      const cur = ctx.getState().pages[ctx.getState().currentPage];
      if (!cur || cur.pdfPage !== key.pdfPage || (cur.rotation ?? 0) !== key.rot || ctx.getState().zoom !== key.zoom) {
        clearCropTile();
        if (chain) chain();
        return;
      }
      cropTileKey = key;
      ctx.getCropCanvas().style.display = '';
      if (chain) chain();
    }).catch((err) => {
      // A superseded task must not touch the canvas the replacement is
      // rendering into, and its chain (if any) already moved to the new owner.
      if (cropTileTask !== task) return;
      cropTileTask = null;
      const chain = cropTileOnDone; cropTileOnDone = null;
      ctx.getCropCanvas().width = 0; ctx.getCropCanvas().height = 0;
      // A cancel came from clearCropTile — the clearer owns the follow-up.
      if (err && err.name === 'RenderingCancelledException') return;
      if (chain) chain();   // sharpening is best-effort; still run the full raster
    });
  }

  // --- Deep-zoom viewport TILE COMPOSITOR (the idle mode of the crop tile) ---
  // At deep zoom the full-page buffer is clamped soft and grows quadratically
  // with zoom — so instead of one visible-window raster (which dies on every
  // pan), keep a small cache of fixed-size TILES (TILE_CSS content-css px,
  // rastered at full dpr via the render service/worker) and COMPOSITE the
  // visible ones onto ctx.getCropCanvas(). Panning re-composites cached tiles
  // instantly and rasters only newly exposed cells (center-out); the cache is
  // keyed to (page, rotation, zoom) and budget-capped, evicting the tiles
  // farthest from the viewport center. Map-app behavior: raster cost is
  // bounded at ~one screen regardless of zoom or sheet density.
  const TILE_CSS = 512;
  const TILE_GRID_BUDGET_PX = (typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory >= 8) ? 32000000 : 12000000;
  const tileGrid = new Map();          // 'tx|ty' -> { bitmap, w, h, tx, ty }
  const tileTasks = new Map();         // 'tx|ty' -> render task (one in flight at a time)
  let tileGridBase = null;             // { pdfPage, rot, zoom } the cache is valid for
  let tileScratch = null;
  function flushTileGrid() {
    for (const t of tileGrid.values()) { try { t.bitmap.close(); } catch (_) { /* closed */ } }
    tileGrid.clear();
    for (const task of tileTasks.values()) { try { task.cancel(); } catch (_) { /* settling */ } }
    tileTasks.clear();
    tileGridBase = null;
  }
  function tileGridTotalPx() {
    let s = 0;
    for (const t of tileGrid.values()) s += t.w * t.h;
    return s;
  }
  function ensureTileCoverage() {
    const page = ctx.getState().pages[ctx.getState().currentPage];
    if (!page || !page.pdfPage || !ctx.getCropCanvas()) return;
    const dpr = window.devicePixelRatio || 1;
    if (!(ctx.getCurrentEffDpr() > 0) || dpr / ctx.getCurrentEffDpr() < CROP_TILE_MIN_DEFICIT) { clearCropTile(); return; }
    if (Math.abs(ctx.getState().zoom - ctx.getLastRenderedZoom()) > 0.001) return;   // mid-gesture: the commit flow owns sharpening
    const rot = page.rotation ?? 0;
    if (!tileGridBase || tileGridBase.pdfPage !== page.pdfPage || tileGridBase.rot !== rot || Math.abs(tileGridBase.zoom - ctx.getState().zoom) > 1e-9) {
      flushTileGrid();
      tileGridBase = { pdfPage: page.pdfPage, rot, zoom: ctx.getState().zoom };
    }
    const wrap = ctx.getWrapper();
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const pageCssW = parseFloat(ctx.getPdfCanvas().style.width) || 0;
    const pageCssH = parseFloat(ctx.getPdfCanvas().style.height) || 0;
    if (!r.width || !pageCssW || !pageCssH) return;
    const x0 = Math.max(0, -ctx.getState().pan.x);
    const y0 = Math.max(0, -ctx.getState().pan.y);
    const x1 = Math.min(pageCssW, x0 + r.width);
    const y1 = Math.min(pageCssH, y0 + r.height);
    if (x1 <= x0 || y1 <= y0) return;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const txMin = Math.floor(x0 / TILE_CSS), txMax = Math.floor((x1 - 0.01) / TILE_CSS);
    const tyMin = Math.floor(y0 / TILE_CSS), tyMax = Math.floor((y1 - 0.01) / TILE_CSS);
    const wanted = [];
    for (let ty = tyMin; ty <= tyMax; ty++) {
      for (let tx = txMin; tx <= txMax; tx++) {
        const k = tx + '|' + ty;
        if (!tileGrid.has(k) && !tileTasks.has(k)) {
          const dcx = (tx + 0.5) * TILE_CSS - cx, dcy = (ty + 0.5) * TILE_CSS - cy;
          wanted.push({ tx, ty, k, d: dcx * dcx + dcy * dcy });
        }
      }
    }
    compositeTileGrid(x0, y0, x1 - x0, y1 - y0, dpr);
    if (!wanted.length || tileTasks.size > 0) return;   // one raster in flight at a time
    wanted.sort((a, b) => a.d - b.d);                   // center-out
    requestTileRaster(page, rot, wanted[0], dpr);
  }
  function requestTileRaster(page, rot, cell, dpr) {
    const zoom = ctx.getState().zoom;
    const pageCssW = parseFloat(ctx.getPdfCanvas().style.width) || 0;
    const pageCssH = parseFloat(ctx.getPdfCanvas().style.height) || 0;
    const ox = cell.tx * TILE_CSS, oy = cell.ty * TILE_CSS;
    const wCss = Math.min(TILE_CSS, pageCssW - ox), hCss = Math.min(TILE_CSS, pageCssH - oy);
    if (wCss <= 0 || hCss <= 0) return;
    if (!tileScratch) tileScratch = document.createElement('canvas');
    const bw = Math.ceil(wCss * dpr), bh = Math.ceil(hCss * dpr);
    tileScratch.width = bw;
    tileScratch.height = bh;
    const task = ctx.getRenderService().raster({
      pdfPage: page.pdfPage, scale: zoom * dpr, rotation: rot,
      offsetX: -ox * dpr, offsetY: -oy * dpr,
      canvasContext: tileScratch.getContext('2d'), kind: 'tile',
    });
    tileTasks.set(cell.k, task);
    task.promise.then(() => {
      tileTasks.delete(cell.k);
      if (!tileGridBase || tileGridBase.pdfPage !== page.pdfPage || tileGridBase.rot !== rot || Math.abs(tileGridBase.zoom - zoom) > 1e-9) return;   // flushed mid-raster
      const snap = createImageBitmap(tileScratch);
      tileScratch.width = 0; tileScratch.height = 0;
      snap.then((bitmap) => {
        if (!tileGridBase || Math.abs(tileGridBase.zoom - zoom) > 1e-9) { try { bitmap.close(); } catch (_) {} return; }
        tileGrid.set(cell.k, { bitmap, w: bw, h: bh, tx: cell.tx, ty: cell.ty });
        evictTileGridToBudget();
        scheduleCropTile();   // composite + request the next missing cell
      }).catch(() => { /* best-effort */ });
    }).catch((err) => {
      tileTasks.delete(cell.k);
      if (err && err.name !== 'RenderingCancelledException') { /* tile stays cold; coverage retries later */ }
    });
  }
  function evictTileGridToBudget() {
    if (tileGridTotalPx() <= TILE_GRID_BUDGET_PX) return;
    const r = ctx.getWrapper() ? ctx.getWrapper().getBoundingClientRect() : { width: 0, height: 0 };
    const cx = Math.max(0, -ctx.getState().pan.x) + r.width / 2;
    const cy = Math.max(0, -ctx.getState().pan.y) + r.height / 2;
    const rows = Array.from(tileGrid.values()).sort((a, b) => {
      const da = Math.pow((a.tx + 0.5) * TILE_CSS - cx, 2) + Math.pow((a.ty + 0.5) * TILE_CSS - cy, 2);
      const db = Math.pow((b.tx + 0.5) * TILE_CSS - cx, 2) + Math.pow((b.ty + 0.5) * TILE_CSS - cy, 2);
      return db - da;   // farthest first
    });
    for (const t of rows) {
      if (tileGridTotalPx() <= TILE_GRID_BUDGET_PX) break;
      tileGrid.delete(t.tx + '|' + t.ty);
      try { t.bitmap.close(); } catch (_) { /* closed */ }
    }
  }
  function compositeTileGrid(x0, y0, w, h, dpr) {
    if (!tileGrid.size) return;
    const bw = Math.ceil(w * dpr), bh = Math.ceil(h * dpr);
    ctx.getCropCanvas().width = bw;
    ctx.getCropCanvas().height = bh;
    ctx.getCropCanvas().style.width = w + 'px';
    ctx.getCropCanvas().style.height = h + 'px';
    ctx.getCropCanvas().style.left = x0 + 'px';
    ctx.getCropCanvas().style.top = y0 + 'px';
    const g = ctx.getCropCanvas().getContext('2d');
    let drew = 0;
    for (const t of tileGrid.values()) {
      const dx = (t.tx * TILE_CSS - x0) * dpr, dy = (t.ty * TILE_CSS - y0) * dpr;
      if (dx + t.w < 0 || dy + t.h < 0 || dx > bw || dy > bh) continue;
      g.drawImage(t.bitmap, dx, dy);
      drew++;
    }
    if (drew > 0) {
      cropTileKey = { pdfPage: tileGridBase.pdfPage, rot: tileGridBase.rot, zoom: tileGridBase.zoom, baseZoom: ctx.getLastRenderedZoom(), grid: true };
      ctx.getCropCanvas().style.display = '';
    }
  }

  // After a commit was served from a RUNG bitmap (<=7% CSS residual), settle
  // to pixel-perfect once the user goes idle: re-render at the exact display
  // zoom. Cancelled by any newer render (renderPdf entry clears the timer).
  let pdfExactRefineTimer = null;
  const PDF_EXACT_REFINE_MS = 600;
  function schedulePdfExactRefine(forZoom) {
    if (pdfExactRefineTimer) clearTimeout(pdfExactRefineTimer);
    pdfExactRefineTimer = setTimeout(() => {
      pdfExactRefineTimer = null;
      if (ctx.getState().zoom !== forZoom) return;          // the user moved on
      if (ctx.isRenderInFlight() || cropTileTask) return;   // busy — the next paint reschedules if still residual
      ctx.renderPdf({ exactOnly: true });
    }, PDF_EXACT_REFINE_MS);
  }


  return {
    clearCropTile,
    // renderPdf's target-match logic reads the shown tile's key, retires the
    // pending sharpen debounce without dropping the tile, and cancels the
    // idle exact-refine on every entry.
    getCropTileKey: () => cropTileKey,
    clearCropTileTimer: () => { if (cropTileTimer) { clearTimeout(cropTileTimer); cropTileTimer = null; } },
    cancelPdfExactRefine: () => { if (pdfExactRefineTimer) { clearTimeout(pdfExactRefineTimer); pdfExactRefineTimer = null; } },
    scheduleCropTile,
    renderCropTile,
    schedulePdfExactRefine,
    ensureTileCoverage,
    tileGridStats: () => ({ tiles: tileGrid.size, totalPx: tileGridTotalPx(), inFlight: tileTasks.size }),
    // The stats object is shared by reference: renderPdf's cache hit/miss
    // accounting increments .hits/.misses directly (never reassigned).
    stats: pdfBitmapCacheStats,
    pdfBitmapCacheGet,
    pdfBitmapCacheGetAnyZoom,
    pdfBitmapCacheDrop,
    pdfBitmapCacheCapture,
    pdfBitmapCacheMaxArea,
    clearPdfBitmapCache,
    cancelPdfBitmapPrefetch,
    schedulePdfBitmapPrefetch,
    maybeRestorePersistedRungs,
    predictedFitZoom,
    updateDocWarmupIndicator,
    // Debug/spec introspection (the App.__pdfBitmapCache* / __docWarmupState
    // seams in app.js's registry delegate here; shapes are frozen — specs).
    debugStats: () => ({ size: pdfBitmapCache.length, hits: pdfBitmapCacheStats.hits, misses: pdfBitmapCacheStats.misses, prefetched: pdfBitmapCacheStats.prefetched, derived: pdfBitmapCacheStats.derived, persisted: pdfBitmapCacheStats.persisted, restored: pdfBitmapCacheStats.restored }),
    debugKeys: () => pdfBitmapCache.map((e) => ({ zoom: e.zoom, effDpr: e.effDpr, rotation: e.rotation, w: e.w, h: e.h })),
    debugDump: () => pdfBitmapCache.map(e => ({ zoom: e.zoom, effDpr: e.effDpr, rotation: e.rotation, w: e.w, h: e.h, pageIdx: ctx.getState().pages.findIndex(p => p.pdfPage === e.pdfPage) })),
    warmupState: () => ({ done: docWarmupDone.size, pages: ctx.getState().pages.length }),
  };
}

// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declaration above stays a plain global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createPdfTileCache };
}

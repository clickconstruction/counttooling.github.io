// render-service.js — the single seam every pdf.js raster goes through
// (renderPdf's full-page pass, the idle bitmap prefetcher, the crop tile).
//
// Two backends behind one contract:
//   MAIN   — pdfPage.render on the main thread (today's behavior; always
//            available; the automatic fallback for everything below).
//   WORKER — a dedicated render worker (render-worker.js) running its OWN
//            pdf.js instance over its own copy of the document bytes,
//            rastering into an OffscreenCanvas and posting back a
//            transferable ImageBitmap that we blit into the caller's canvas.
//            This takes the multi-second operator-list walks of dense sheets
//            OFF the main thread — panning, drawing, and the zoom preview
//            never stall behind a raster again.
//
// Classic <script src> loaded before app.js; app.js instantiates
// createRenderService(deps) once (the save-engine seam recipe) and swaps its
// three `pdfPage.render(...)` call sites for `renderService.raster(...)`,
// which returns the same { promise, cancel() } shape with the same
// RenderingCancelledException rejection contract — so renderPdf's
// cancel/pending machinery is untouched.
//
// deps contract: { logEvent(type, msg, detailJson)? }
//
// Document adoption is LAZY and site-free: the first worker-eligible raster
// reads the document bytes back out of pdf.js itself via the page proxy's
// transport (`pdfPage._transport.getData()` — a PRIVATE field of the
// version-pinned vendored pdf.js 3.11.174; the access is guarded, and any
// shape change simply disables the worker for the session). While adoption
// is in flight (or after any worker failure) rasters silently run MAIN.
// A new document (project load, prepare-PDF rebuild) is a new transport
// identity, which re-adopts automatically and generation-guards stale
// worker results.
//
// Gates: Worker + OffscreenCanvas support, the window.DISABLE_RENDER_WORKER
// config escape hatch, and a document-size × deviceMemory memory gate (the
// worker holds a full second copy of the document).

function createRenderService(deps) {
  const logEvent = (deps && deps.logEvent) || null;

  // -------- state --------
  // Worker POOL: slot 0 is the interactive renderer (full-page + crop tile);
  // slot 1 (high-memory machines, small-enough docs) exists so background
  // prefetches never queue behind an interactive raster — pdf.js serializes
  // within one worker thread, so parallel warm-up needs a second instance
  // (which also means a second copy of the document; hence the gates).
  const slots = [];                // [{ worker, pending: Map, loadedGen, rastered }]
  let workerState = 'idle';        // idle | adopting | ready | failed  (failed = off for the session)
  let adoptedTransport = null;     // the pdf.js transport whose bytes the workers hold
  let blockedTransport = null;     // per-document block (too large) — main-only for this doc
  let gen = 0;                     // document generation; stale worker messages self-discard
  let readyGen = 0;
  let seq = 0;

  const stats = { total: 0, byKind: {}, workerRastered: 0, mainRastered: 0, fallbacks: 0, log: [] };
  const STATS_LOG_MAX = 300;

  // Test/debug hook: artificial pre-raster delay for the Playwright specs
  // that used to wrap pdfPage.render (works identically in both modes).
  let testDelayMs = 0;
  let testDelayKinds = null;       // null = all kinds

  const WORKER_DOC_MAX_BYTES =
    (typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory <= 4)
      ? 26214400    // 25 MB on low-memory devices
      : 62914560;   // 60 MB otherwise (PDF uploads cap at 50 MB)

  function cancelError() {
    const e = new Error('Rendering cancelled by render-service');
    e.name = 'RenderingCancelledException';
    return e;
  }
  function workerSupported() {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return false;
    if (typeof window !== 'undefined' && window.DISABLE_RENDER_WORKER) return false;
    return true;
  }
  function log(type, msg, detail) {
    if (!logEvent) return;
    try { logEvent(type, msg, typeof detail === 'string' ? detail : JSON.stringify(detail || {})); } catch (_) { /* diagnostics are best-effort */ }
  }

  // -------- worker lifecycle --------
  function failWorker(reason) {
    if (workerState === 'failed') return;
    workerState = 'failed';
    stats.fallbacks++;
    for (const slot of slots) {
      try { slot.worker && slot.worker.terminate(); } catch (_) { /* already dead */ }
      // In-flight requests re-run on the main thread via the retry path.
      for (const [reqId, p] of Array.from(slot.pending)) {
        slot.pending.delete(reqId);
        const err = new Error('render worker failed: ' + reason);
        err.__retryMain = true;
        p.reject(err);
      }
    }
    slots.length = 0;
    log('render_worker_fallback', 'Render worker disabled for this session', { reason: String(reason) });
  }
  function makeSlot() {
    const slot = { worker: new Worker('/render-worker.js'), pending: new Map(), loadedGen: 0, rastered: 0 };
    slot.worker.onmessage = (e) => onWorkerMessage(slot, e);
    slot.worker.onerror = (e) => failWorker('worker-error: ' + ((e && e.message) || 'unknown'));
    return slot;
  }
  function poolSizeFor(docBytes) {
    const highMem = typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory >= 8;
    return (highMem && docBytes <= 26214400) ? 2 : 1;   // 2nd doc copy only when cheap
  }
  function slotFor(kind) {
    // Background prefetches use slot 1 when it's live so they never queue
    // behind an interactive raster; everything else (and the fallback when
    // slot 1 is absent/lagging) uses slot 0.
    if (kind === 'prefetch' && slots.length > 1 && slots[1].loadedGen === gen) return slots[1];
    return slots[0];
  }
  function onWorkerMessage(slot, e) {
    const m = e.data || {};
    if (m.type === 'loaded') {
      if (m.gen !== gen) return;                      // a newer document superseded this load
      if (!m.ok) { failWorker('doc-load: ' + m.error); return; }
      slot.loadedGen = m.gen;
      if (slots[0] && slots[0].loadedGen === m.gen) {  // interactive slot ready = service ready
        workerState = 'ready';
        readyGen = m.gen;
      }
      return;
    }
    if (m.type === 'result') {
      const p = slot.pending.get(m.reqId);
      if (!p) { if (m.bitmap) { try { m.bitmap.close(); } catch (_) {} } return; }   // late result after cancel/fallback
      slot.pending.delete(m.reqId);
      if (p.box.cancelled) {
        if (m.bitmap) { try { m.bitmap.close(); } catch (_) {} }
        p.reject(cancelError());
        return;
      }
      if (m.cancelled) { p.reject(cancelError()); return; }
      if (!m.bitmap) {
        const err = new Error('worker raster failed: ' + m.error);
        err.__retryMain = true;                        // best-effort: redo on main
        failWorker('raster: ' + m.error);
        p.reject(err);
        return;
      }
      try {
        p.canvasContext.drawImage(m.bitmap, 0, 0);
      } finally {
        try { m.bitmap.close(); } catch (_) { /* backing store already released */ }
      }
      slot.rastered++;
      p.resolve();
      return;
    }
  }

  // Lazy adoption: fetch the document bytes back out of pdf.js and ship them
  // to the worker. Guarded end-to-end — any surprise disables the worker.
  function kickAdoption(pdfPage) {
    if (workerState === 'failed' || workerState === 'adopting') return;
    const t = pdfPage && pdfPage._transport;
    if (!t || typeof t.getData !== 'function') { failWorker('no-transport (pinned pdf.js private API changed?)'); return; }
    if (t === blockedTransport) return;               // this doc is main-only (size gate)
    workerState = 'adopting';
    adoptedTransport = t;
    const myGen = ++gen;
    Promise.resolve(t.getData()).then((bytes) => {
      if (gen !== myGen || workerState === 'failed') return;
      const size = (bytes && bytes.byteLength) || 0;
      if (!size || size > WORKER_DOC_MAX_BYTES) {
        blockedTransport = t;
        adoptedTransport = null;
        workerState = 'idle';                          // future (smaller) docs may still adopt
        log('render_worker_doc_skipped', 'Document too large for the render worker', { size, cap: WORKER_DOC_MAX_BYTES });
        return;
      }
      // One slot per pool seat, each with its own transferable copy of the
      // bytes (the typed array from getData may be a view — normalize first).
      const poolSize = poolSizeFor(size);
      while (slots.length < poolSize) slots.push(makeSlot());
      for (const slot of slots) {
        const buf = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
          ? bytes.buffer.slice(0)
          : bytes.slice().buffer;
        slot.worker.postMessage({ type: 'load', gen: myGen, buffer: buf }, [buf]);
      }
    }).catch((err) => failWorker('getData: ' + ((err && err.message) || err)));
  }
  function workerReadyFor(pdfPage) {
    return workerState === 'ready' && readyGen === gen &&
      adoptedTransport && pdfPage && pdfPage._transport === adoptedTransport;
  }

  // Content hash of the current document's bytes (via the same guarded
  // transport getData used for adoption) — the key for cross-session
  // persisted rung bitmaps. Cached per transport; null when unavailable.
  const docHashByTransport = new Map();
  function ensureDocHash(pdfPage) {
    const t = pdfPage && pdfPage._transport;
    if (!t || typeof t.getData !== 'function') return Promise.resolve(null);
    if (!docHashByTransport.has(t)) {
      docHashByTransport.set(t, Promise.resolve(t.getData()).then(async (bytes) => {
        if (!bytes || !bytes.byteLength || typeof crypto === 'undefined' || !crypto.subtle) return null;
        const buf = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.slice().buffer;
        const digest = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }).catch(() => null));
    }
    return docHashByTransport.get(t);
  }

  // -------- backends --------
  function rasterMain(params, box) {
    const viewport = params.pdfPage.getViewport({
      scale: params.scale, rotation: params.rotation,
      offsetX: params.offsetX || 0, offsetY: params.offsetY || 0,
    });
    const t = params.pdfPage.render({ canvasContext: params.canvasContext, viewport });
    box.inner = t;
    return t.promise.then(() => { stats.mainRastered++; });
  }
  function rasterWorker(params, box) {
    return new Promise((resolve, reject) => {
      const reqId = ++seq;
      const slot = slotFor(params.kind);
      box.reqId = reqId;
      box.slot = slot;
      slot.pending.set(reqId, { resolve: () => { stats.workerRastered++; resolve(); }, reject, box, canvasContext: params.canvasContext });
      slot.worker.postMessage({
        type: 'render', reqId, gen,
        pageNumber: params.pdfPage.pageNumber,
        scale: params.scale, rotation: params.rotation,
        offsetX: params.offsetX || 0, offsetY: params.offsetY || 0,
        width: params.canvasContext.canvas.width,
        height: params.canvasContext.canvas.height,
      });
    });
  }

  // -------- the one public entry point --------
  // params: { pdfPage, scale, rotation, offsetX?, offsetY?, canvasContext, kind }
  // Returns { promise, cancel() }; rejects with name 'RenderingCancelledException'
  // on cancel — the exact contract of a pdf.js RenderTask, so callers keep
  // their existing catch logic.
  function raster(params) {
    const kind = params.kind || 'full';
    stats.total++;
    stats.byKind[kind] = (stats.byKind[kind] || 0) + 1;
    stats.log.push({ kind, pageNumber: params.pdfPage && params.pdfPage.pageNumber });
    if (stats.log.length > STATS_LOG_MAX) stats.log.splice(0, stats.log.length - STATS_LOG_MAX);
    const box = { cancelled: false, inner: null, reqId: null };
    const promise = (async () => {
      if (testDelayMs > 0 && (!testDelayKinds || testDelayKinds.includes(kind))) {
        await new Promise((r) => setTimeout(r, testDelayMs));
      }
      if (box.cancelled) throw cancelError();
      if (workerSupported() && workerState !== 'failed') {
        if (workerReadyFor(params.pdfPage)) {
          try {
            await rasterWorker(Object.assign({ kind }, params), box);
            return;
          } catch (err) {
            if (box.cancelled || !(err && err.__retryMain)) throw err;
            // fall through to main
          }
        } else if (workerState === 'idle' || (adoptedTransport && params.pdfPage && params.pdfPage._transport !== adoptedTransport)) {
          kickAdoption(params.pdfPage);               // adopt in the background; render main this time
        }
      }
      if (box.cancelled) throw cancelError();
      await rasterMain(params, box);
    })();
    promise.catch(() => { /* callers own rejection handling; avoid unhandled noise */ });
    return {
      promise,
      cancel() {
        box.cancelled = true;
        if (box.inner) { try { box.inner.cancel(); } catch (_) { /* settling */ } }
        if (box.reqId != null && box.slot && box.slot.worker) { try { box.slot.worker.postMessage({ type: 'cancel', reqId: box.reqId }); } catch (_) { /* worker gone */ } }
      },
    };
  }

  return {
    raster,
    ensureDocHash,
    mode: () => (workerState === 'ready' ? 'worker' : 'main'),
    workerState: () => workerState,
    statsSnapshot: () => ({
      total: stats.total,
      byKind: Object.assign({}, stats.byKind),
      workerRastered: stats.workerRastered,
      mainRastered: stats.mainRastered,
      fallbacks: stats.fallbacks,
      slots: slots.map((s) => ({ loaded: s.loadedGen === gen, rastered: s.rastered })),
      log: stats.log.slice(),
    }),
    setTestDelay: (ms, kinds) => { testDelayMs = ms || 0; testDelayKinds = Array.isArray(kinds) && kinds.length ? kinds.slice() : null; },
  };
}

// Dual-env export so render-service.test.js can require() the factory under
// `node --test`; inert in the browser (classic script).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createRenderService };
}

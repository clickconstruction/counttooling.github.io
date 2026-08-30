// render-worker.js — the dedicated pdf.js render worker behind
// render-service.js. Holds its OWN pdf.js instance and its own copy of the
// current document's bytes; rasters requested pages (optionally offset for
// the crop tile) into OffscreenCanvas and posts back transferable
// ImageBitmaps. This moves the multi-second operator-list walks of dense
// sheets off the main thread entirely.
//
// Protocol (all messages carry the document generation `gen`; stale-gen
// messages are answered with an error and otherwise ignored):
//   -> { type:'load', gen, buffer }                      buffer transferred in
//   <- { type:'loaded', gen, ok, error? }
//   -> { type:'render', reqId, gen, pageNumber, scale, rotation,
//        offsetX, offsetY, width, height }
//   <- { type:'result', reqId, bitmap }                  bitmap transferred out
//   <- { type:'result', reqId, cancelled:true }          after a cancel
//   <- { type:'result', reqId, error }                   raster failure
//   -> { type:'cancel', reqId }
//   -> { type:'dispose' }
//
// load/dispose are serialized through an internal promise chain — the shared
// pdf.js workerPort tolerates only one document handoff at a time, and the
// previous document's destroy() must be awaited before the next getDocument
// (see the docChain comment below).
//
// pdf.js parsing runs on this thread too (its nested worker is attempted
// first; pdf.js falls back to its "fake worker" transparently) — either
// way, none of it is the UI thread. Same-origin importScripts of the
// version-pinned vendored lib keeps the renderer byte-identical to the main
// thread's.

importScripts('/vendor/pdf.min-3.11.174.js');
// Inside a worker scope pdf.js 3.x sees no `window`, assumes Node, and falls
// back to its "fake worker" — which needs `document` and dies here. Handing
// it an explicit nested workerPort bypasses that detection entirely (nested
// workers are supported wherever OffscreenCanvas is, which gates this whole
// file). If construction throws, doc load fails cleanly and the service
// falls back to main-thread rendering.
pdfjsLib.GlobalWorkerOptions.workerPort = new Worker('/vendor/pdf.worker.min-3.11.174.js');

// pdf.js's DefaultCanvasFactory in a non-Node scope is DOMCanvasFactory —
// `document.createElement('canvas')`, and there is no `document` here. The
// factory is only consulted when a page needs an AUXILIARY canvas (tiling
// patterns, transparency groups, soft masks — routine on dense CAD sheets),
// so simple pages raster fine without it and the failure surfaces as a
// mid-session "createElement of undefined" on the first hatched/shaded
// sheet, wedging the service into main-thread fallback. Duck-typed
// replacements (getDocument accepts both): OffscreenCanvas for canvases, and
// a no-op filter factory (the DOM one builds SVG filter elements; "none"
// skips those niceties rather than crashing).
const offscreenCanvasFactory = {
  create(w, h) {
    if (w <= 0 || h <= 0) throw new Error('Invalid canvas size');
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, context: canvas.getContext('2d') };
  },
  reset(cc, w, h) {
    if (!cc.canvas) throw new Error('Canvas is not specified');
    if (w <= 0 || h <= 0) throw new Error('Invalid canvas size');
    cc.canvas.width = w; cc.canvas.height = h;
  },
  destroy(cc) {
    if (!cc.canvas) return;
    cc.canvas.width = 0; cc.canvas.height = 0;
    cc.canvas = null; cc.context = null;
  },
};
const noopFilterFactory = {
  addFilter: () => 'none',
  addHCMFilter: () => 'none',
  addHighlightHCMFilter: () => 'none',
  destroy() {},
};
// Embedded fonts: FontLoader wants `ownerDocument.fonts` (a FontFaceSet).
// Without one it falls back to a CSS-rule path that also needs the DOM and
// silently breaks — every glyph rasters as a black box. Worker scopes carry
// their own FontFaceSet (`self.fonts`), so hand that over; where it doesn't
// exist, `disableFontFace` makes pdf.js draw glyph outlines directly instead.
const workerFontsAvailable = typeof self.fonts !== 'undefined';

let doc = null;
let docGen = 0;
const tasks = new Map();   // reqId -> pdf.js RenderTask

// Load/dispose are SERIALIZED through this chain, and every previous
// document's destroy is AWAITED before the next getDocument touches the port.
// pdf.js caches one PDFWorker per workerPort (PDFWorker.fromPort) and
// `loadingTask.destroy()` marks that cached worker `_pendingDestroy`
// synchronously but clears it only after the async transport teardown — so a
// getDocument issued on the same port before the destroy settles throws
// "PDFWorker.fromPort - the worker is being destroyed", the doc load fails,
// and render-service permanently falls the session back to main-thread
// rasters. Awaiting inside one chain also stops a superseded load's cleanup
// from destroying the shared port worker under the newer document's feet.
let docChain = Promise.resolve();

async function destroyDoc(d) {
  if (!d) return;
  try { await d.destroy(); } catch (_) { /* already down */ }
}

async function handleLoad(m) {
  const old = doc;
  doc = null;
  await destroyDoc(old);
  if (m.gen !== docGen) return;   // superseded while destroying; the newer load is queued behind us
  try {
    // Same substitute-font config as App.getPdfDocument (app.js) — without it,
    // PDFs whose fonts aren't embedded raster every glyph as the .notdef box.
    // useWorkerFetch must be EXPLICIT here: with cMapUrl/standardFontDataUrl
    // set but useWorkerFetch unset, pdf.js computes the default by touching
    // `document.baseURI` — ReferenceError in worker scope, doc load fails,
    // session falls back to main. True is also the right value: the nested
    // pdf.js worker fetch()es both URLs itself.
    const loaded = await pdfjsLib.getDocument({
      data: m.buffer,
      useWorkerFetch: true,
      standardFontDataUrl: '/vendor/standard_fonts/',
      cMapUrl: '/vendor/cmaps/',
      cMapPacked: true,
      canvasFactory: offscreenCanvasFactory,
      filterFactory: noopFilterFactory,
      ownerDocument: workerFontsAvailable ? { fonts: self.fonts } : undefined,
      disableFontFace: !workerFontsAvailable,
    }).promise;
    if (m.gen !== docGen) { await destroyDoc(loaded); return; }   // superseded mid-load
    doc = loaded;
    self.postMessage({ type: 'loaded', gen: m.gen, ok: true });
  } catch (err) {
    if (m.gen === docGen) self.postMessage({ type: 'loaded', gen: m.gen, ok: false, error: String((err && err.message) || err) });
  }
}

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'load') {
    docGen = m.gen;   // stamped synchronously so an older load already in the chain sees itself superseded
    docChain = docChain.then(() => handleLoad(m));
    return;
  }
  if (m.type === 'dispose') {
    docChain = docChain.then(() => { const old = doc; doc = null; return destroyDoc(old); });
    return;
  }
  if (m.type === 'cancel') {
    const t = tasks.get(m.reqId);
    if (t) { try { t.cancel(); } catch (_) { /* settling */ } }
    return;
  }
  if (m.type === 'render') {
    if (!doc || m.gen !== docGen) {
      self.postMessage({ type: 'result', reqId: m.reqId, error: 'stale-generation' });
      return;
    }
    try {
      const page = await doc.getPage(m.pageNumber);
      const canvas = new OffscreenCanvas(m.width, m.height);
      const viewport = page.getViewport({
        scale: m.scale, rotation: m.rotation,
        offsetX: m.offsetX || 0, offsetY: m.offsetY || 0,
      });
      const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
      tasks.set(m.reqId, task);
      await task.promise;
      tasks.delete(m.reqId);
      const bitmap = canvas.transferToImageBitmap();
      self.postMessage({ type: 'result', reqId: m.reqId, bitmap }, [bitmap]);
    } catch (err) {
      tasks.delete(m.reqId);
      // A raster whose document was superseded mid-flight (new load destroyed
      // it) is a cancellation, not a worker failure — reporting it as an error
      // would fall the whole session back to main-thread rasters.
      const cancelled = !!(err && err.name === 'RenderingCancelledException') || m.gen !== docGen;
      self.postMessage({ type: 'result', reqId: m.reqId, cancelled, error: cancelled ? undefined : String((err && err.message) || err) });
    }
  }
};

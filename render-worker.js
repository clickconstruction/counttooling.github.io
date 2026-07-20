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

let doc = null;
let docGen = 0;
const tasks = new Map();   // reqId -> pdf.js RenderTask

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'load') {
    docGen = m.gen;
    if (doc) { try { doc.destroy(); } catch (_) { /* already down */ } doc = null; }
    try {
      doc = await pdfjsLib.getDocument({ data: m.buffer }).promise;
      if (m.gen !== docGen) { try { doc.destroy(); } catch (_) {} doc = null; return; }   // superseded mid-load
      self.postMessage({ type: 'loaded', gen: m.gen, ok: true });
    } catch (err) {
      if (m.gen === docGen) self.postMessage({ type: 'loaded', gen: m.gen, ok: false, error: String((err && err.message) || err) });
    }
    return;
  }
  if (m.type === 'dispose') {
    if (doc) { try { doc.destroy(); } catch (_) { /* already down */ } doc = null; }
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
      const cancelled = !!(err && err.name === 'RenderingCancelledException');
      self.postMessage({ type: 'result', reqId: m.reqId, cancelled, error: cancelled ? undefined : String((err && err.message) || err) });
    }
  }
};

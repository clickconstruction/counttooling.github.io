'use strict';
// Node unit tests for render-service.js (main-thread backend + the seam
// contract). Worker/OffscreenCanvas don't exist under node, so workerSupported
// is false and every raster runs the MAIN path — which is exactly the
// contract these tests pin: task shape, cancel parity with pdf.js
// (RenderingCancelledException), stats/log accounting, and the test-delay
// hook the Playwright specs rely on. Run with `npm run test:unit`.
const test = require('node:test');
const assert = require('node:assert');
const { createRenderService } = require('./render-service.js');

function makePdfPage(behavior) {
  const calls = [];
  return {
    pageNumber: (behavior && behavior.pageNumber) || 1,
    calls,
    getViewport(p) { calls.push(['getViewport', p]); return { width: 100, height: 80 }; },
    render(p) {
      calls.push(['render', p]);
      let rejectFn;
      const promise = (behavior && behavior.failWith)
        ? Promise.reject(behavior.failWith)
        : new Promise((resolve, reject) => {
          rejectFn = reject;
          setTimeout(resolve, (behavior && behavior.ms) || 5);
        });
      return {
        promise,
        cancel() {
          calls.push(['cancel']);
          if (rejectFn) { const e = new Error('cancelled'); e.name = 'RenderingCancelledException'; rejectFn(e); }
        },
      };
    },
  };
}
const ctxStub = { canvas: { width: 100, height: 80 } };

test('main raster resolves, forwards params, and counts stats + log', async () => {
  const svc = createRenderService({});
  const pdfPage = makePdfPage({ pageNumber: 3 });
  const t = svc.raster({ pdfPage, scale: 2, rotation: 90, offsetX: -5, offsetY: -7, canvasContext: ctxStub, kind: 'tile' });
  await t.promise;
  const vp = pdfPage.calls.find((c) => c[0] === 'getViewport')[1];
  assert.deepStrictEqual(vp, { scale: 2, rotation: 90, offsetX: -5, offsetY: -7 });
  const s = svc.statsSnapshot();
  assert.strictEqual(s.total, 1);
  assert.strictEqual(s.byKind.tile, 1);
  assert.strictEqual(s.mainRastered, 1);
  assert.strictEqual(s.workerRastered, 0);
  assert.deepStrictEqual(s.log, [{ kind: 'tile', pageNumber: 3 }]);
  assert.strictEqual(svc.mode(), 'main');
});

test('cancel of an in-flight raster rejects with RenderingCancelledException', async () => {
  const svc = createRenderService({});
  const pdfPage = makePdfPage({ ms: 200 });
  const t = svc.raster({ pdfPage, scale: 1, rotation: 0, canvasContext: ctxStub, kind: 'full' });
  await new Promise((r) => setTimeout(r, 10));   // let the inner task start
  t.cancel();
  await assert.rejects(t.promise, (e) => e.name === 'RenderingCancelledException');
  assert.ok(pdfPage.calls.some((c) => c[0] === 'cancel'), 'inner pdf.js task cancelled');
});

test('cancel during the test delay never starts the raster', async () => {
  const svc = createRenderService({});
  svc.setTestDelay(80, ['full']);
  const pdfPage = makePdfPage({});
  const t = svc.raster({ pdfPage, scale: 1, rotation: 0, canvasContext: ctxStub, kind: 'full' });
  t.cancel();
  await assert.rejects(t.promise, (e) => e.name === 'RenderingCancelledException');
  assert.strictEqual(pdfPage.calls.filter((c) => c[0] === 'render').length, 0);
});

test('test delay applies only to the configured kinds', async () => {
  const svc = createRenderService({});
  svc.setTestDelay(120, ['full']);
  const pdfPage = makePdfPage({ ms: 1 });
  const t0 = Date.now();
  await svc.raster({ pdfPage, scale: 1, rotation: 0, canvasContext: ctxStub, kind: 'tile' }).promise;
  assert.ok(Date.now() - t0 < 100, 'tile not delayed');
  const t1 = Date.now();
  await svc.raster({ pdfPage, scale: 1, rotation: 0, canvasContext: ctxStub, kind: 'full' }).promise;
  assert.ok(Date.now() - t1 >= 110, 'full delayed');
  svc.setTestDelay(0);
});

test('render failures propagate to the caller (non-cancel errors are not swallowed)', async () => {
  const svc = createRenderService({});
  const boom = new Error('raster exploded');
  const pdfPage = makePdfPage({ failWith: boom });
  await assert.rejects(svc.raster({ pdfPage, scale: 1, rotation: 0, canvasContext: ctxStub, kind: 'full' }).promise, /raster exploded/);
});

test('worker fallback fires onFallback once with the reason (and still rasters main)', async () => {
  // Stub Worker/OffscreenCanvas so workerSupported() is true; a pdfPage with
  // no _transport makes kickAdoption hit failWorker deterministically.
  global.Worker = class { postMessage() {} terminate() {} };
  global.OffscreenCanvas = class {};
  try {
    const events = [];
    const fallbacks = [];
    const svc = createRenderService({
      logEvent: (type, msg, detail) => events.push({ type, detail }),
      onFallback: (reason) => fallbacks.push(reason),
    });
    const pdfPage = makePdfPage({});
    await svc.raster({ pdfPage, scale: 1, rotation: 0, canvasContext: ctxStub, kind: 'full' }).promise;
    assert.strictEqual(fallbacks.length, 1);
    assert.match(fallbacks[0], /no-transport/);
    assert.strictEqual(svc.workerState(), 'failed');
    assert.strictEqual(svc.statsSnapshot().fallbacks, 1);
    assert.strictEqual(svc.statsSnapshot().mainRastered, 1);   // raster still landed, on main
    assert.ok(events.some((e) => e.type === 'render_worker_fallback'));
    // A second failure path is a no-op — the session is already failed.
    await svc.raster({ pdfPage, scale: 1, rotation: 0, canvasContext: ctxStub, kind: 'full' }).promise;
    assert.strictEqual(fallbacks.length, 1);
  } finally {
    delete global.Worker;
    delete global.OffscreenCanvas;
  }
});

// --- document swaps (worker mode) -------------------------------------------
// A fake Worker + a fake pdf.js transport make the document-generation seam
// drivable: adopt a document, raster through the worker, then swap documents
// with a raster still in flight. The production bug this pins: a second
// document in one session (project load, appended pages, prepare-PDF rebuild)
// re-adopts on the SAME worker, and nothing about that routine swap may read
// as a worker failure — one spurious fallback costs the user main-thread
// rasters for the rest of the session.
function withFakeWorker(fn) {
  const workers = [];
  global.Worker = class {
    constructor() { this.sent = []; this.terminated = false; workers.push(this); }
    postMessage(msg) { this.sent.push(msg); }
    terminate() { this.terminated = true; }
  };
  global.OffscreenCanvas = class {};
  return Promise.resolve(fn(workers)).finally(() => {
    delete global.Worker;
    delete global.OffscreenCanvas;
  });
}
function makeAdoptablePage(behavior) {
  const pdfPage = makePdfPage(behavior);
  pdfPage._transport = { getData: () => new Uint8Array(2048) };
  return pdfPage;
}
const drawCtx = { canvas: { width: 100, height: 80 }, drawn: 0, drawImage() { drawCtx.drawn++; } };
const settle = () => new Promise((r) => setTimeout(r, 10));
const lastOfType = (worker, type) => worker.sent.filter((m) => m.type === type).pop();

/** Adopt `pdfPage` into the worker and return the accepted 'load' message. */
async function adopt(svc, workers, pdfPage) {
  await svc.raster({ pdfPage, scale: 1, rotation: 0, canvasContext: drawCtx, kind: 'full' }).promise;
  await settle();
  const load = lastOfType(workers[0], 'load');
  assert.ok(load, 'document shipped to the worker');
  workers[0].onmessage({ data: { type: 'loaded', gen: load.gen, ok: true } });
  return load;
}

test('a second document re-adopts on the SAME worker without a spurious fallback', async () => {
  await withFakeWorker(async (workers) => {
    const events = [];
    const svc = createRenderService({ logEvent: (type) => events.push(type), onFallback: () => events.push('onFallback') });

    const pageA = makeAdoptablePage({});
    const load1 = await adopt(svc, workers, pageA);
    assert.strictEqual(workers.length, 1);
    assert.strictEqual(svc.workerState(), 'ready');

    // An interactive raster is in flight in the worker...
    const inFlight = svc.raster({ pdfPage: pageA, scale: 1, rotation: 0, canvasContext: drawCtx, kind: 'full' });
    await settle();
    const req = lastOfType(workers[0], 'render');
    assert.strictEqual(req.gen, load1.gen);

    // ...when the app swaps documents: the new transport re-adopts on the
    // SAME worker (this raster runs main while adoption is in flight).
    const pageB = makeAdoptablePage({});
    await svc.raster({ pdfPage: pageB, scale: 1, rotation: 0, canvasContext: drawCtx, kind: 'full' }).promise;
    await settle();
    assert.strictEqual(workers.length, 1, 'slot reused, not respawned');
    const load2 = lastOfType(workers[0], 'load');
    assert.notStrictEqual(load2.gen, load1.gen, 'new document generation');

    // The superseded raster comes back as an error from the old generation.
    // That is a document swap, not a broken worker: it must cancel, and the
    // session must stay on the worker.
    workers[0].onmessage({ data: { type: 'result', reqId: req.reqId, gen: load1.gen, error: 'stale-generation' } });
    await assert.rejects(inFlight.promise, (e) => e.name === 'RenderingCancelledException');
    assert.strictEqual(svc.statsSnapshot().fallbacks, 0);
    assert.ok(!events.includes('render_worker_fallback'), 'no fallback logged');

    // Document B lands and the worker keeps serving the session.
    workers[0].onmessage({ data: { type: 'loaded', gen: load2.gen, ok: true } });
    assert.strictEqual(svc.workerState(), 'ready');
    assert.strictEqual(svc.mode(), 'worker');
  });
});

test('a bitmap from a superseded document is dropped, not blitted', async () => {
  await withFakeWorker(async (workers) => {
    const svc = createRenderService({});
    const pageA = makeAdoptablePage({});
    const load1 = await adopt(svc, workers, pageA);
    const inFlight = svc.raster({ pdfPage: pageA, scale: 1, rotation: 0, canvasContext: drawCtx, kind: 'full' });
    await settle();
    const req = lastOfType(workers[0], 'render');

    await svc.raster({ pdfPage: makeAdoptablePage({}), scale: 1, rotation: 0, canvasContext: drawCtx, kind: 'full' }).promise;
    await settle();

    let closed = false;
    const drawnBefore = drawCtx.drawn;
    workers[0].onmessage({ data: { type: 'result', reqId: req.reqId, gen: load1.gen, bitmap: { close() { closed = true; } } } });
    await assert.rejects(inFlight.promise, (e) => e.name === 'RenderingCancelledException');
    assert.strictEqual(drawCtx.drawn, drawnBefore, 'stale pixels never reach the canvas');
    assert.ok(closed, 'stale bitmap released');
  });
});

test('a raster error on the CURRENT document still trips the session fallback', async () => {
  await withFakeWorker(async (workers) => {
    const fallbacks = [];
    const svc = createRenderService({ onFallback: (r) => fallbacks.push(r) });
    const pageA = makeAdoptablePage({});
    const load1 = await adopt(svc, workers, pageA);

    const t = svc.raster({ pdfPage: pageA, scale: 1, rotation: 0, canvasContext: drawCtx, kind: 'full' });
    await settle();
    const req = lastOfType(workers[0], 'render');
    workers[0].onmessage({ data: { type: 'result', reqId: req.reqId, gen: load1.gen, error: 'boom' } });
    await t.promise;                                   // retried on the main thread
    assert.strictEqual(svc.workerState(), 'failed');
    assert.strictEqual(fallbacks.length, 1);
    assert.match(fallbacks[0], /boom/);
  });
});

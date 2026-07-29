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

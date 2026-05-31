// Node unit tests for the pure helpers in save-utils.js.
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
const test = require('node:test');
const assert = require('node:assert');
const s = require('./save-utils.js');

test('isTransientSaveError: timeouts are transient', () => {
  assert.ok(s.isTransientSaveError(new Error('Turn in timed out after 8s')));
  assert.ok(s.isTransientSaveError(new Error('Update project timed out after 15s')));
  assert.ok(s.isTransientSaveError(new Error('Storage info timed out after 3s')));
});

test('isTransientSaveError: aborts and network errors are transient', () => {
  assert.ok(s.isTransientSaveError({ name: 'AbortError', message: 'aborted' }));
  assert.ok(s.isTransientSaveError(new Error('Failed to fetch')));
  assert.ok(s.isTransientSaveError(new Error('NetworkError when attempting to fetch resource')));
  assert.ok(s.isTransientSaveError({ code: 'ETIMEDOUT', message: '' }));
  assert.ok(s.isTransientSaveError({ code: 'ECONNRESET', message: '' }));
});

test('isTransientSaveError: 408/429/5xx statuses are transient', () => {
  assert.ok(s.isTransientSaveError({ status: 408, message: 'request timeout' }));
  assert.ok(s.isTransientSaveError({ status: 429, message: 'rate limit' }));
  assert.ok(s.isTransientSaveError({ status: 500, message: 'server error' }));
  assert.ok(s.isTransientSaveError({ status: 503, message: 'service unavailable' }));
});

test('isTransientSaveError: auth / checkout / other 4xx are NOT transient', () => {
  assert.ok(!s.isTransientSaveError({ code: 'CHECKOUT_EXPIRED' }));
  assert.ok(!s.isTransientSaveError({ code: 'CHECKOUT_NOT_OWNED' }));
  assert.ok(!s.isTransientSaveError({ code: '42501' }));
  assert.ok(!s.isTransientSaveError({ status: 401, message: 'unauthorized' }));
  assert.ok(!s.isTransientSaveError({ status: 403, message: 'forbidden' }));
  assert.ok(!s.isTransientSaveError({ status: 404, message: 'not found' }));
});

test('isTransientSaveError: null / undefined / empty are NOT transient', () => {
  assert.ok(!s.isTransientSaveError(null));
  assert.ok(!s.isTransientSaveError(undefined));
  assert.ok(!s.isTransientSaveError(new Error('some unrelated failure')));
});

test('getProjectCounts: empty / missing input', () => {
  assert.deepStrictEqual(s.getProjectCounts(null), { counter_count: 0, line_count: 0 });
  assert.deepStrictEqual(s.getProjectCounts({}), { counter_count: 0, line_count: 0 });
  assert.deepStrictEqual(s.getProjectCounts({ pages: [] }), { counter_count: 0, line_count: 0 });
});

test('getProjectCounts: legacy per-page annotations shape', () => {
  const data = {
    pages: [
      { annotations: { counterMarkers: { a: [{}, {}], b: [{}] }, quickLines: [{}], polylines: [{}, {}] } },
    ],
  };
  assert.deepStrictEqual(s.getProjectCounts(data), { counter_count: 3, line_count: 3 });
});

test('getProjectCounts: current canvases[].annotations shape', () => {
  const data = {
    pages: [
      { canvases: [{ annotations: { counterMarkers: { a: [{}] }, quickLines: [{}] } }] },
    ],
  };
  assert.deepStrictEqual(s.getProjectCounts(data), { counter_count: 1, line_count: 1 });
});

test('getProjectCounts: sums across multiple pages and canvases', () => {
  const data = {
    pages: [
      { canvases: [
        { annotations: { counterMarkers: { a: [{}, {}] }, quickLines: [{}] } },
        { annotations: { counterMarkers: { b: [{}] }, polylines: [{}, {}] } },
      ] },
      { annotations: { counterMarkers: { c: [{}, {}, {}] }, quickLines: [{}], polylines: [{}] } },
    ],
  };
  // counters: 2 + 1 + 3 = 6; lines: 1 + 2 + (1+1) = 5
  assert.deepStrictEqual(s.getProjectCounts(data), { counter_count: 6, line_count: 5 });
});

test('serializeSaveError: extracts the log-safe field set + transient flag', () => {
  const e = Object.assign(new Error('boom'), { code: 'X1', status: 500, details: 'd', hint: 'h' });
  assert.deepStrictEqual(s.serializeSaveError(e), {
    // status 500 -> transient (worth one retry)
    message: 'boom', name: 'Error', code: 'X1', status: 500, details: 'd', hint: 'h', transient: true,
  });
  // a definite failure (401) is not transient
  assert.strictEqual(s.serializeSaveError({ status: 401, message: 'unauthorized' }).transient, false);
});

test('serializeSaveError: null -> {}, message falls back to String(e)', () => {
  assert.deepStrictEqual(s.serializeSaveError(null), {});
  // an error-like object with no `message` falls back to String(e)
  const noMsg = { name: 'Weird', toString: () => 'stringified' };
  assert.strictEqual(s.serializeSaveError(noMsg).message, 'stringified');
});

test('formatSaveStatusErrDetail: JSON string of the serialized error; empty for null', () => {
  assert.strictEqual(s.formatSaveStatusErrDetail(null), '');
  const out = JSON.parse(s.formatSaveStatusErrDetail(new Error('nope')));
  assert.strictEqual(out.message, 'nope');
  assert.strictEqual(out.name, 'Error');
});

test('backoffDelayMs: failures=1 -> levels[0]; clamps at the last level', () => {
  const levels = [1000, 5000, 30000];
  assert.strictEqual(s.backoffDelayMs(1, levels), 1000);
  assert.strictEqual(s.backoffDelayMs(2, levels), 5000);
  assert.strictEqual(s.backoffDelayMs(3, levels), 30000);
  assert.strictEqual(s.backoffDelayMs(99, levels), 30000); // clamped
  assert.strictEqual(s.backoffDelayMs(0, levels), 1000);   // guarded to index 0
  assert.strictEqual(s.backoffDelayMs(3, []), 0);          // empty levels
});

test('computeClockOffsetMs: string / numeric server_now -> offset; missing -> null', () => {
  const localNow = 1_000_000;
  // numeric epoch ms
  assert.strictEqual(s.computeClockOffsetMs({ server_now: 1_005_000 }, localNow), 5000);
  // ISO string
  const iso = new Date(localNow + 2000).toISOString();
  assert.strictEqual(s.computeClockOffsetMs({ server_now: iso }, localNow), 2000);
  // missing / unparseable / null payload
  assert.strictEqual(s.computeClockOffsetMs({}, localNow), null);
  assert.strictEqual(s.computeClockOffsetMs({ server_now: 'not-a-date' }, localNow), null);
  assert.strictEqual(s.computeClockOffsetMs(null, localNow), null);
});

test('percentile: p95 of a known array; empty -> null', () => {
  const samples = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
  // nearest-rank index: floor(0.95 * 99) = 94 -> value 95
  assert.strictEqual(s.percentile(samples, 0.95), 95);
  assert.strictEqual(s.percentile([42], 0.95), 42);
  assert.strictEqual(s.percentile([], 0.95), null);
  assert.strictEqual(s.percentile(null, 0.95), null);
});

test('extractResponseDiagnostics: pulls request-correlation headers via .get', () => {
  const make = (map) => ({ get: (k) => (k in map ? map[k] : null) });
  assert.deepStrictEqual(
    s.extractResponseDiagnostics(make({ 'sb-request-id': 'req-1', 'cf-ray': 'ray-1', 'retry-after': '5', date: 'Sat, 30 May 2026 00:00:00 GMT' })),
    { requestId: 'req-1', cfRay: 'ray-1', retryAfter: '5', serverDate: 'Sat, 30 May 2026 00:00:00 GMT' },
  );
  // falls back to x-request-id when sb-request-id is absent
  assert.strictEqual(s.extractResponseDiagnostics(make({ 'x-request-id': 'req-2' })).requestId, 'req-2');
  // absent headers / no .get / throwing .get -> all null, never throws
  assert.deepStrictEqual(s.extractResponseDiagnostics(make({})), { requestId: null, cfRay: null, retryAfter: null, serverDate: null });
  assert.deepStrictEqual(s.extractResponseDiagnostics(null), { requestId: null, cfRay: null, retryAfter: null, serverDate: null });
  assert.deepStrictEqual(s.extractResponseDiagnostics({ get: () => { throw new Error('x'); } }), { requestId: null, cfRay: null, retryAfter: null, serverDate: null });
});

test('secondsToExpiry: epoch-seconds expiry relative to nowMs; missing -> null', () => {
  const nowMs = 1_000_000_000_000; // -> 1_000_000_000 s
  assert.strictEqual(s.secondsToExpiry(1_000_000_300, nowMs), 300); // 5 min out
  assert.strictEqual(s.secondsToExpiry(1_000_000_000 - 60, nowMs), -60); // already expired
  assert.strictEqual(s.secondsToExpiry(undefined, nowMs), null);
  assert.strictEqual(s.secondsToExpiry('nope', nowMs), null);
});

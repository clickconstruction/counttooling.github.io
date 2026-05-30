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

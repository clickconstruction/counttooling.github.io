// Node unit tests for the pure IndexedDB primitives in idb.js.
// Run with: npm run test:unit  (uses the built-in node:test runner)
//
// fake-indexeddb/auto installs a global `indexedDB`. idb.js references the
// store-name / cap constants by bare name, so we copy constants.js onto the
// global object before requiring idb.js (mirrors how constants.js is a classic
// <script> global in the browser). Each test gets a fresh IDBFactory so the
// single fixed-name database (clickcount-pdf-cache) starts empty.
const test = require('node:test');
const assert = require('node:assert');
require('fake-indexeddb/auto');
const { IDBFactory } = require('fake-indexeddb');
const C = require('./constants.js');
Object.assign(globalThis, C);
const idb = require('./idb.js');
const { CUSTOM_ICONS_KEY, SAVE_LOGS_SNAPSHOT_MAX_ENTRIES } = C;

test.beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

// blob stand-in: idb.js only ever reads `.size`, and fake-indexeddb structured-
// clones whatever is stored, so a plain object is sufficient for the logic.
const fakeBlob = (size) => ({ size });

test('pdfCache: put then get round-trips on matching hash', async () => {
  await idb.pdfCachePut('p1', fakeBlob(10), 'hashA');
  const got = await idb.pdfCacheGet('p1', 'hashA');
  assert.ok(got, 'expected a blob back');
  assert.strictEqual(got.size, 10);
});

test('pdfCache: get returns null on hash mismatch', async () => {
  await idb.pdfCachePut('p1', fakeBlob(10), 'hashA');
  const got = await idb.pdfCacheGet('p1', 'hashB');
  assert.strictEqual(got, null);
});

test('pdfCache: byte-cap eviction drops the least-recently-used entry', async () => {
  const big = 400 * 1024 * 1024; // 400 MB; two of these exceed the 500 MB cap
  await idb.pdfCachePut('old', fakeBlob(big), 'h1');
  await idb.pdfCachePut('new', fakeBlob(big), 'h2');
  assert.strictEqual(await idb.pdfCacheGet('old', 'h1'), null, 'old entry should be evicted');
  assert.ok(await idb.pdfCacheGet('new', 'h2'), 'new entry should survive');
});

test('viewCache: get returns null on hash mismatch, blob on match', async () => {
  await idb.viewCachePut('tok', fakeBlob(5), 'vhash', { projectId: 'p', name: 'n' });
  assert.strictEqual(await idb.viewCacheGet('tok', 'other'), null);
  const got = await idb.viewCacheGet('tok', 'vhash');
  assert.ok(got);
  assert.strictEqual(got.size, 5);
  const meta = await idb.viewCacheGetMeta('tok');
  assert.strictEqual(meta.projectId, 'p');
});

test('takeoffBackup: put then raw-get round-trips', async () => {
  const res = await idb.idbTakeoffBackupPut('proj', { foo: 1 }, null, 'ph', 100, 'My Project', 'user-1');
  assert.deepStrictEqual(res, { ok: true });
  const entry = await idb.idbTakeoffBackupGetRaw('proj');
  assert.strictEqual(entry.lastModifiedAt, 100);
  assert.deepStrictEqual(entry.data, { foo: 1 });
  assert.strictEqual(entry.userId, 'user-1');
});

test('takeoffBackup: stale put is skipped and does not overwrite newer data', async () => {
  await idb.idbTakeoffBackupPut('proj', { v: 'new' }, null, null, 100, null, null);
  const res = await idb.idbTakeoffBackupPut('proj', { v: 'old' }, null, null, 50, null, null);
  assert.strictEqual(res.skippedStale, true);
  assert.strictEqual(res.existing, 100);
  assert.strictEqual(res.incoming, 50);
  const entry = await idb.idbTakeoffBackupGetRaw('proj');
  assert.deepStrictEqual(entry.data, { v: 'new' }, 'newer data must remain');
});

test('takeoffBackup: delete removes the entry', async () => {
  await idb.idbTakeoffBackupPut('proj', { a: 1 }, null, null, 1, null, null);
  await idb.takeoffBackupDelete('proj');
  assert.strictEqual(await idb.idbTakeoffBackupGetRaw('proj'), null);
});

test('customIcons: legacy key migrates to per-user key once', async () => {
  await idb.idbCustomIconsPut(CUSTOM_ICONS_KEY, [{ name: 'a' }, { name: 'b' }]);
  const perUser = 'customIcons_user-123';
  const first = await idb.idbCustomIconsGet(perUser, CUSTOM_ICONS_KEY);
  assert.deepStrictEqual(first.data, [{ name: 'a' }, { name: 'b' }]);
  assert.strictEqual(first.migratedFrom, CUSTOM_ICONS_KEY);
  assert.strictEqual(first.migratedTo, perUser);
  // Second read finds the per-user key directly: no migration reported.
  const second = await idb.idbCustomIconsGet(perUser, CUSTOM_ICONS_KEY);
  assert.deepStrictEqual(second.data, [{ name: 'a' }, { name: 'b' }]);
  assert.strictEqual(second.migratedFrom, undefined);
  // Legacy key was deleted by the migration.
  const legacyGone = await idb.idbCustomIconsGet(CUSTOM_ICONS_KEY, CUSTOM_ICONS_KEY);
  assert.strictEqual(legacyGone.data, null);
});

test('pdfUploadResume: put, lookup-by-fingerprint, delete, and clear-by-fingerprint', async () => {
  await idb.idbPdfUploadResumePut({ urlStorageKey: 'k1', fingerprint: 'fp-A', uploadUrl: 'https://u/1' });
  await idb.idbPdfUploadResumePut({ urlStorageKey: 'k2', fingerprint: 'fp-A', uploadUrl: 'https://u/2' });
  await idb.idbPdfUploadResumePut({ urlStorageKey: 'k3', fingerprint: 'fp-B', uploadUrl: 'https://u/3' });
  const a = await idb.idbPdfUploadResumeGetByFingerprint('fp-A');
  assert.deepStrictEqual(a.map((e) => e.urlStorageKey).sort(), ['k1', 'k2']);
  assert.strictEqual((await idb.idbPdfUploadResumeGetAll()).length, 3);
  // single delete
  await idb.idbPdfUploadResumeDelete('k1');
  assert.strictEqual((await idb.idbPdfUploadResumeGetByFingerprint('fp-A')).length, 1);
  // clear all entries for a fingerprint (e.g. on upload success)
  await idb.idbPdfUploadResumeDeleteByFingerprint('fp-A');
  assert.strictEqual((await idb.idbPdfUploadResumeGetByFingerprint('fp-A')).length, 0);
  // a different fingerprint is untouched
  assert.strictEqual((await idb.idbPdfUploadResumeGetByFingerprint('fp-B')).length, 1);
  // a put without a urlStorageKey is a guarded no-op
  const res = await idb.idbPdfUploadResumePut({ fingerprint: 'fp-C' });
  assert.strictEqual(res.skipped, true);
});

test('saveLogsSnapshots: prunes to the max and returns newest-first', async () => {
  const total = SAVE_LOGS_SNAPSHOT_MAX_ENTRIES + 2;
  // capturedAt is an ISO string in production (new Date().toISOString()), so the
  // lexicographic sort()/`<` ordering in idb.js matches chronological order.
  const stamps = [];
  for (let i = 1; i <= total; i++) {
    const capturedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
    stamps.push(capturedAt);
    await idb.idbPutSaveLogsSnapshot({ capturedAt, events: [], tag: 'e' + i });
  }
  const newest5 = await idb.readSaveLogsSnapshots(5);
  assert.strictEqual(newest5.length, 5);
  assert.strictEqual(newest5[0].capturedAt, stamps[total - 1], 'first result is the newest');
  assert.strictEqual(newest5[4].capturedAt, stamps[total - 5]);
  // The store kept only the cap; the two oldest were pruned.
  const all = await idb.readSaveLogsSnapshots(100);
  assert.strictEqual(all.length, SAVE_LOGS_SNAPSHOT_MAX_ENTRIES);
  const remaining = all.map((e) => e.capturedAt);
  assert.ok(!remaining.includes(stamps[0]) && !remaining.includes(stamps[1]), 'two oldest pruned');
});

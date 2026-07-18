/*
 * idb.js - IndexedDB storage layer for ClickCount, extracted verbatim from the
 * main app.js IIFE.
 *
 * Loaded as a classic <script src="idb.js"> in <head>, AFTER constants.js (which
 * declares the store names + caps these functions reference by bare name) and
 * BEFORE app.js (which resolves these functions by bare name).
 *
 * Boundary rule: this module depends ONLY on constants.js globals + indexedDB +
 * its arguments. It contains NO reference to `state`, app-side loggers
 * (saveDebugLog / pushSaveEvent / buildSaveLogsEnvelope), or any IIFE-local
 * flag. Functions that previously logged or read app state stay in app.js as
 * same-named thin wrappers that call the pure primitives exported here. No build
 * step.
 *
 * Single IndexedDB database (clickcount-pdf-cache, version 6) with 9 stores:
 *   pdfs / meta            - cloud PDF cache (LRU)
 *   view_pdfs / *_meta     - view-link PDF cache
 *   takeoff_backup / *_meta- tab-crash recovery backups (LRU)
 *   custom_icons           - per-user custom icon SVGs
 *   save_logs_snapshots    - rolling save-log envelopes
 *   pdf_upload_resume      - tus/resumable PDF upload URLs (cross-reload resume)
 */

// In a classic browser <script> this reads the optional window flag; in Node
// (tests) window is undefined and it defaults to true.
const BACKUP_PDF_TO_INDEXEDDB = (typeof window !== 'undefined' && typeof window.BACKUP_PDF_TO_INDEXEDDB !== 'undefined') ? window.BACKUP_PDF_TO_INDEXEDDB : true;

function openPdfCacheDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PDF_CACHE_DB, 6);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PDF_CACHE_STORE)) {
        db.createObjectStore(PDF_CACHE_STORE, { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains(PDF_CACHE_META_STORE)) {
        db.createObjectStore(PDF_CACHE_META_STORE, { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains(VIEW_PDFS_STORE)) {
        db.createObjectStore(VIEW_PDFS_STORE, { keyPath: 'token' });
      }
      if (!db.objectStoreNames.contains(VIEW_PDFS_META_STORE)) {
        db.createObjectStore(VIEW_PDFS_META_STORE, { keyPath: 'token' });
      }
      if (!db.objectStoreNames.contains(TAKEOFF_BACKUP_STORE)) {
        db.createObjectStore(TAKEOFF_BACKUP_STORE, { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains(TAKEOFF_BACKUP_META_STORE)) {
        db.createObjectStore(TAKEOFF_BACKUP_META_STORE, { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains(CUSTOM_ICONS_STORE)) {
        db.createObjectStore(CUSTOM_ICONS_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(SAVE_LOGS_SNAPSHOT_STORE)) {
        db.createObjectStore(SAVE_LOGS_SNAPSHOT_STORE, { keyPath: 'capturedAt' });
      }
      if (!db.objectStoreNames.contains(PDF_UPLOAD_RESUME_STORE)) {
        db.createObjectStore(PDF_UPLOAD_RESUME_STORE, { keyPath: 'urlStorageKey' });
      }
    };
  });
}

async function viewCacheGet(token, pdfHash) {
  try {
    const db = await openPdfCacheDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VIEW_PDFS_STORE, 'readonly');
      const req = tx.objectStore(VIEW_PDFS_STORE).get(token);
      req.onsuccess = () => {
        const entry = req.result;
        if (entry && entry.pdfHash === pdfHash && entry.blob) resolve(entry.blob);
        else resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (_) { return null; }
}

async function viewCachePut(token, blob, pdfHash, meta) {
  try {
    const db = await openPdfCacheDb();
    const tx = db.transaction([VIEW_PDFS_STORE, VIEW_PDFS_META_STORE], 'readwrite');
    tx.objectStore(VIEW_PDFS_STORE).put({ token, blob, pdfHash });
    tx.objectStore(VIEW_PDFS_META_STORE).put({ token, lastUsed: Date.now(), size: blob.size, projectId: meta?.projectId, name: meta?.name, data: meta?.data, pdfHash: pdfHash, updatedAt: meta?.updatedAt ?? null });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  } catch (_) { /* ignore */ }
}

async function viewCacheGetMeta(token) {
  try {
    const db = await openPdfCacheDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VIEW_PDFS_META_STORE, 'readonly');
      const req = tx.objectStore(VIEW_PDFS_META_STORE).get(token);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (_) { return null; }
}

async function pdfCacheGet(projectId, pdfHash) {
  try {
    const db = await openPdfCacheDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_CACHE_STORE, 'readonly');
      const req = tx.objectStore(PDF_CACHE_STORE).get(projectId);
      req.onsuccess = () => {
        const entry = req.result;
        if (entry && entry.pdfHash === pdfHash && entry.blob) resolve(entry.blob);
        else resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (_) { return null; }
}

async function pdfCachePut(projectId, blob, pdfHash) {
  try {
    const db = await openPdfCacheDb();
    const size = blob.size;
    const lastUsed = Date.now();
    const tx = db.transaction([PDF_CACHE_STORE, PDF_CACHE_META_STORE], 'readwrite');
    const store = tx.objectStore(PDF_CACHE_STORE);
    const metaStore = tx.objectStore(PDF_CACHE_META_STORE);
    const entries = await new Promise((resolve, reject) => {
      const req = metaStore.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    let totalBytes = entries.reduce((s, e) => s + (e.size || 0), 0);
    const byLastUsed = [...entries].sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
    for (const evict of byLastUsed) {
      if (entries.length < PDF_CACHE_MAX_ENTRIES && totalBytes + size <= PDF_CACHE_MAX_BYTES) break;
      if (evict.projectId === projectId) break;
      store.delete(evict.projectId);
      metaStore.delete(evict.projectId);
      totalBytes -= evict.size || 0;
      entries.splice(entries.findIndex(e => e.projectId === evict.projectId), 1);
    }
    store.put({ projectId, blob, pdfHash });
    metaStore.put({ projectId, lastUsed, size });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  } catch (_) { /* ignore */ }
}

async function pdfCacheDelete(projectId) {
  try {
    const db = await openPdfCacheDb();
    const tx = db.transaction([PDF_CACHE_STORE, PDF_CACHE_META_STORE], 'readwrite');
    tx.objectStore(PDF_CACHE_STORE).delete(projectId);
    tx.objectStore(PDF_CACHE_META_STORE).delete(projectId);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  } catch (_) { /* ignore */ }
}

// Pure read of a takeoff backup entry. The user-mismatch check + logging live in
// the app.js takeoffBackupGet wrapper.
async function idbTakeoffBackupGetRaw(projectId) {
  if (!BACKUP_PDF_TO_INDEXEDDB) return null;
  try {
    const db = await openPdfCacheDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([TAKEOFF_BACKUP_STORE], 'readonly');
      const req = tx.objectStore(TAKEOFF_BACKUP_STORE).get(projectId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (_) { return null; }
}

// Pure write of a takeoff backup with LRU eviction + stale-skip. Returns a status
// object instead of logging; the app.js takeoffBackupPut wrapper does the logging
// and one-shot warning.
async function idbTakeoffBackupPut(projectId, data, pdfBlob, pdfHash, lastModifiedAt, projectName, userId) {
  if (!BACKUP_PDF_TO_INDEXEDDB) return { ok: false, skipped: true };
  try {
    const db = await openPdfCacheDb();
    const dataSize = JSON.stringify(data).length;
    const pdfSize = pdfBlob ? pdfBlob.size : 0;
    const size = dataSize + pdfSize;
    const lastUsed = Date.now();
    const tx = db.transaction([TAKEOFF_BACKUP_STORE, TAKEOFF_BACKUP_META_STORE], 'readwrite');
    const store = tx.objectStore(TAKEOFF_BACKUP_STORE);
    const metaStore = tx.objectStore(TAKEOFF_BACKUP_META_STORE);
    const existing = await new Promise((resolve, reject) => {
      const req = store.get(projectId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (existing && typeof existing.lastModifiedAt === 'number' && typeof lastModifiedAt === 'number' && existing.lastModifiedAt > lastModifiedAt) {
      try { tx.abort(); } catch (_) {}
      return { ok: false, skippedStale: true, existing: existing.lastModifiedAt, incoming: lastModifiedAt };
    }
    const entries = await new Promise((resolve, reject) => {
      const req = metaStore.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    let totalBytes = entries.reduce((s, e) => s + (e.size || 0), 0);
    const byLastUsed = [...entries].sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
    for (const evict of byLastUsed) {
      if (entries.length < TAKEOFF_BACKUP_MAX_ENTRIES && totalBytes + size <= TAKEOFF_BACKUP_MAX_BYTES) break;
      if (evict.projectId === projectId) break;
      store.delete(evict.projectId);
      metaStore.delete(evict.projectId);
      totalBytes -= evict.size || 0;
      entries.splice(entries.findIndex(e => e.projectId === evict.projectId), 1);
    }
    const entry = { projectId, data, pdfHash: pdfHash || null, lastModifiedAt, projectName: projectName || null, userId: userId || null };
    if (pdfBlob) entry.pdfBlob = pdfBlob;
    store.put(entry);
    metaStore.put({ projectId, lastUsed, size });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function takeoffBackupDelete(projectId) {
  if (!BACKUP_PDF_TO_INDEXEDDB) return;
  try {
    const db = await openPdfCacheDb();
    const tx = db.transaction([TAKEOFF_BACKUP_STORE, TAKEOFF_BACKUP_META_STORE], 'readwrite');
    tx.objectStore(TAKEOFF_BACKUP_STORE).delete(projectId);
    tx.objectStore(TAKEOFF_BACKUP_META_STORE).delete(projectId);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  } catch (_) { /* ignore */ }
}

// Pure write of a save-logs snapshot envelope with prune-to-max. Returns a status
// object; the app.js writeSaveLogsSnapshot wrapper owns the throttle, envelope
// construction, and logging.
async function idbPutSaveLogsSnapshot(envelope) {
  if (typeof indexedDB === 'undefined') return { ok: false, skipped: true };
  try {
    const db = await openPdfCacheDb();
    const tx = db.transaction(SAVE_LOGS_SNAPSHOT_STORE, 'readwrite');
    const store = tx.objectStore(SAVE_LOGS_SNAPSHOT_STORE);
    store.put({ capturedAt: envelope.capturedAt, envelope });
    const keys = await new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (keys.length > SAVE_LOGS_SNAPSHOT_MAX_ENTRIES) {
      const sorted = keys.slice().sort();
      const toDelete = sorted.slice(0, keys.length - SAVE_LOGS_SNAPSHOT_MAX_ENTRIES);
      for (const k of toDelete) store.delete(k);
    }
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function readSaveLogsSnapshots(limit) {
  if (typeof indexedDB === 'undefined') return [];
  const cap = typeof limit === 'number' && limit > 0 ? limit : SAVE_LOGS_SNAPSHOT_MAX_ENTRIES;
  try {
    const db = await openPdfCacheDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVE_LOGS_SNAPSHOT_STORE, 'readonly');
      const req = tx.objectStore(SAVE_LOGS_SNAPSHOT_STORE).getAll();
      req.onsuccess = () => {
        const rows = (req.result || []).slice().sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
        resolve(rows.slice(0, cap).map(r => r.envelope).filter(Boolean));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (_) { return []; }
}

// Pure read of custom icons with one-time legacy -> per-user key migration. The
// app.js customIconsGetFromIndexedDB wrapper supplies the keys (computed from
// state) and logs the migration. Returns { data, migratedFrom?, migratedTo? }.
async function idbCustomIconsGet(primaryKey, legacyKey) {
  try {
    const db = await openPdfCacheDb();
    const primary = await new Promise((resolve, reject) => {
      const tx = db.transaction(CUSTOM_ICONS_STORE, 'readonly');
      const req = tx.objectStore(CUSTOM_ICONS_STORE).get(primaryKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (primary && Array.isArray(primary.data)) return { data: primary.data };
    if (primaryKey !== legacyKey) {
      const legacy = await new Promise((resolve, reject) => {
        const tx = db.transaction(CUSTOM_ICONS_STORE, 'readonly');
        const req = tx.objectStore(CUSTOM_ICONS_STORE).get(legacyKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (legacy && Array.isArray(legacy.data) && legacy.data.length) {
        try {
          const tx = db.transaction(CUSTOM_ICONS_STORE, 'readwrite');
          tx.objectStore(CUSTOM_ICONS_STORE).put({ key: primaryKey, data: legacy.data });
          tx.objectStore(CUSTOM_ICONS_STORE).delete(legacyKey);
          await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
          return { data: legacy.data, migratedFrom: legacyKey, migratedTo: primaryKey };
        } catch (_) {
          return { data: legacy.data };
        }
      }
      return { data: null };
    }
    return { data: null };
  } catch (_) { return { data: null }; }
}

async function idbCustomIconsPut(key, arr) {
  try {
    const db = await openPdfCacheDb();
    const tx = db.transaction(CUSTOM_ICONS_STORE, 'readwrite');
    tx.objectStore(CUSTOM_ICONS_STORE).put({ key, data: Array.isArray(arr) ? arr : [] });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  } catch (_) { /* ignore */ }
}

// --- Resumable (tus) PDF upload URL storage ---
// Backs tus-js-client's UrlStorage interface so an interrupted large-PDF upload
// can resume after a page reload (instead of restarting from byte 0). Entries are
// keyed by `urlStorageKey` and carry the upload `fingerprint` (project+pdf_hash)
// so they can be looked up / cleared. The store is tiny (one in-flight upload per
// project), so fingerprint lookups scan the small set rather than indexing.

async function idbPdfUploadResumeGetAll() {
  try {
    const db = await openPdfCacheDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_UPLOAD_RESUME_STORE, 'readonly');
      const req = tx.objectStore(PDF_UPLOAD_RESUME_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (_) { return []; }
}

async function idbPdfUploadResumeGetByFingerprint(fingerprint) {
  const all = await idbPdfUploadResumeGetAll();
  return all.filter((e) => e && e.fingerprint === fingerprint);
}

// Store an upload entry. `entry` must carry `urlStorageKey` + `fingerprint`.
async function idbPdfUploadResumePut(entry) {
  if (!entry || !entry.urlStorageKey) return { ok: false, skipped: true };
  try {
    const db = await openPdfCacheDb();
    const tx = db.transaction(PDF_UPLOAD_RESUME_STORE, 'readwrite');
    tx.objectStore(PDF_UPLOAD_RESUME_STORE).put(entry);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    return { ok: true };
  } catch (e) { return { ok: false, error: e }; }
}

async function idbPdfUploadResumeDelete(urlStorageKey) {
  try {
    const db = await openPdfCacheDb();
    const tx = db.transaction(PDF_UPLOAD_RESUME_STORE, 'readwrite');
    tx.objectStore(PDF_UPLOAD_RESUME_STORE).delete(urlStorageKey);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  } catch (_) { /* ignore */ }
}

// Clear every stored resume entry for a fingerprint (e.g. on upload success).
async function idbPdfUploadResumeDeleteByFingerprint(fingerprint) {
  try {
    const matches = await idbPdfUploadResumeGetByFingerprint(fingerprint);
    for (const m of matches) await idbPdfUploadResumeDelete(m.urlStorageKey);
  } catch (_) { /* ignore */ }
}

// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    openPdfCacheDb,
    viewCacheGet, viewCachePut, viewCacheGetMeta,
    pdfCacheGet, pdfCachePut, pdfCacheDelete,
    idbTakeoffBackupGetRaw, idbTakeoffBackupPut, takeoffBackupDelete,
    idbPutSaveLogsSnapshot, readSaveLogsSnapshots,
    idbCustomIconsGet, idbCustomIconsPut,
    idbPdfUploadResumeGetAll, idbPdfUploadResumeGetByFingerprint,
    idbPdfUploadResumePut, idbPdfUploadResumeDelete, idbPdfUploadResumeDeleteByFingerprint,
    BACKUP_PDF_TO_INDEXEDDB,
  };
}

/*
 * constants.js - Pure, module-level constant literals for ClickCount, extracted
 * verbatim from index.html.
 *
 * Loaded as a classic <script src="constants.js"> in <head>, BEFORE the main IIFE.
 * These top-level `const` declarations live in the shared global lexical scope,
 * so the main script in index.html resolves them by bare name.
 *
 * Everything here is a plain literal/object/array with no reference to `state`,
 * `window`, `location`, the live `supabase` client, or icon data. Environment
 * reads (SUPABASE_*, BACKUP_PDF_TO_INDEXEDDB, IS_DEV_HOST), icon-derived consts,
 * and all function-local consts stay in index.html. No build step.
 */

// --- Domain enums & defaults ---
const TOOL = { NONE: 0, SCALE: 1, LINE: 2, POLYLINE: 3, COUNTER: 4, EDIT_POLY: 5, MEASURE: 6, HIGHLIGHT: 7, NOTE: 8, MULTIPLY_ZONE: 9, DELETE_ZONE: 10, SCALE_ZONE: 11, ROOM: 12 };
const SCALE_MODES = { NONE: 0, POINT_A: 1, POINT_B: 2 };
const PLUMBING_DEFAULTS = {
  sizes: ['0.5in', '0.75in', '1in', '1.25in', '1.5in', '2in'],
  types: ['Tee', 'Coupling', '90', 'Reducer', 'Drop Ear', 'Male Adapter', 'Female Adapter', 'Ball Valve'],
  materials: ['PEX', 'Brass', 'BI', 'Galv']
};
const LINE_DEFAULTS = {
  sizes: ['0.5in', '0.75in', '1in', '1.25in', '1.5in', '2in', '3in', '4in'],
  materials: ['PEX', 'Brass', 'BI', 'Galv']
};
const COLORS = ['#e85447','#4a9eff','#e8c547','#47c88e','#a47fff','#ff7a47','#47d4d4','#ff47b0','#bfff47','#2c3e50','#8b4513','#ff6b6b','#6366f1','#059669','#f59e0b','#0ea5e9','#7c3aed','#e11d48'];
const SCALE_PRESETS = [
  { label: '1/6" = 1\'', pixelsPerUnit: 12, unit: 'ft' },
  { label: '1/16" = 1\'', pixelsPerUnit: 72 / 16, unit: 'ft' },
  { label: '3/32" = 1\'', pixelsPerUnit: 72 * 3 / 32, unit: 'ft' },
  { label: '1/8" = 1\'', pixelsPerUnit: 72 / 8, unit: 'ft' },
  { label: '3/16" = 1\'', pixelsPerUnit: 72 * 3 / 16, unit: 'ft' },
  { label: '1/4" = 1\'', pixelsPerUnit: 72 / 4, unit: 'ft' },
  { label: '3/8" = 1\'', pixelsPerUnit: 72 * 3 / 8, unit: 'ft' },
  { label: '1/2" = 1\'', pixelsPerUnit: 72 / 2, unit: 'ft' },
  { label: '3/4" = 1\'', pixelsPerUnit: 72 * 3 / 4, unit: 'ft' },
  { label: '1" = 1\'', pixelsPerUnit: 72, unit: 'ft' },
  { label: '1 1/2" = 1\'', pixelsPerUnit: 72 * 1.5, unit: 'ft' },
  { label: '3" = 1\'', pixelsPerUnit: 72 * 3, unit: 'ft' },
  { label: '1" = 10\'', pixelsPerUnit: 72 / 10, unit: 'ft' },
  { label: '1" = 20\'', pixelsPerUnit: 72 / 20, unit: 'ft' },
  { label: '1" = 30\'', pixelsPerUnit: 72 / 30, unit: 'ft' },
  { label: '1" = 40\'', pixelsPerUnit: 72 / 40, unit: 'ft' },
  { label: '1" = 50\'', pixelsPerUnit: 72 / 50, unit: 'ft' },
  { label: '1" = 60\'', pixelsPerUnit: 72 / 60, unit: 'ft' },
  { label: '1" = 70\'', pixelsPerUnit: 72 / 70, unit: 'ft' },
  { label: '1" = 80\'', pixelsPerUnit: 72 / 80, unit: 'ft' },
  { label: '1" = 90\'', pixelsPerUnit: 72 / 90, unit: 'ft' },
  { label: '1" = 100\'', pixelsPerUnit: 72 / 100, unit: 'ft' }
];

// --- Autosave / checkout timing & thresholds ---
const AUTO_SAVE_INTERVAL_MS = 5000;
const AUTOSAVE_TIMEOUT_MS = 15000;
const STORAGE_INFO_TIMEOUT_MS = 3000;
const CLIENT_PROBE_TIMEOUT_MS = 5000;
const CLIENT_RECYCLE_COOLDOWN_MS = 30000;
const DIRTY_SNAPSHOT_THRESHOLD_MS = 10 * 60 * 1000;
const CHECK_IN_TIMEOUT_MS = 10000;
const LONG_IDLE_PROBE_MS = 5 * 60 * 1000;
const TURN_IN_STALENESS_MS = 5 * 60 * 1000;
const AUTOSAVE_BACKOFF_LEVELS_MS = [5000, 15000, 30000, 60000];
const AUTOSAVE_BANNER_THRESHOLD = 3;
const AUTOSAVE_RECOVERY_THRESHOLD = 5;
const AUTOSAVE_RECOVERY_TIMEOUT_MS = 5000;
const AUTOSAVE_SLOW_MS = 1000;
const AUTOSAVE_SLOW_WINDOW = 20;
const AUTOSAVE_SLOW_DEBOUNCE_MS = 60000;
const AUTOSAVE_SLOW_MIN_SAMPLES = 10;
const GLOBAL_RELOAD_STAMP_KEY = 'clickcount-last-global-reload';
const CHECKOUT_INACTIVITY_MS = 30 * 60 * 1000;
const CHECKOUT_REFRESH_DEBOUNCE_MS = 2 * 60 * 1000;
const CHECKOUT_KEEPALIVE_MS = 10 * 60 * 1000;
const CHECKOUT_NEAR_EXPIRY_MS = 5 * 60 * 1000;
const CHECKOUT_SOFT_GRACE_MS = 60 * 1000;
const AUTO_RECHECKOUT_MAX_PER_PROJECT = 3;
const AUTO_RECHECKOUT_MIN_GAP_MS = 5000;
const AUTO_RECHECKOUT_COOLDOWN_MS = 30 * 60 * 1000;
const REFRESH_PERMISSIONS_TIMEOUT_MS = 8000;
const PROJECTS_CHECKOUT_RECONNECT_BACKOFF_MS = [1000, 3000, 10000, 30000];
const PDF_ONESHOT_BACKOFF_MS = 30000;
// Background autosave-tick first-PDF uploads of LARGE files back off much harder
// so they don't burn a long upload every few seconds; explicit Save / Turn In
// (which pass ignoreBackoff) carry the big upload instead.
const PDF_ONESHOT_LARGE_BACKOFF_MS = 5 * 60 * 1000;

// --- Activity / presence ---
const ACTIVITY_HIGH_FREQ_MS = 60000;
const ACTIVITY_PROJECT_SAVE_MS = 5 * 60 * 1000;

// --- Save Status log & checkout messages ---
const SAVE_STATUS_LOG_MS = 300000;
const SAVE_STATUS_LOG_VERBOSE_MS = 3600000;
const CHECKOUT_EXPIRED_SAVE_STATUS_MSG = 'Edit session expired; check out again to continue editing.';
const CHECKOUT_EXPIRED_TOAST_MSG = 'Your edit session expired while idle. Check out again to keep editing.';

// --- Global force reload stamps ---
const PENDING_GLOBAL_RELOAD_STAMP_KEY = 'clickcount-pending-global-reload';

// --- Undo/redo ---
const UNDO_STACK_SIZE = 5;

// --- IndexedDB store names & caps ---
const PDF_CACHE_DB = 'clickcount-pdf-cache';
const PDF_CACHE_STORE = 'pdfs';
const PDF_CACHE_META_STORE = 'meta';
const VIEW_PDFS_STORE = 'view_pdfs';
const VIEW_PDFS_META_STORE = 'view_pdfs_meta';
const TAKEOFF_BACKUP_STORE = 'takeoff_backup';
const TAKEOFF_BACKUP_META_STORE = 'takeoff_backup_meta';
const CUSTOM_ICONS_STORE = 'custom_icons';
const SAVE_LOGS_SNAPSHOT_STORE = 'save_logs_snapshots';
const PDF_UPLOAD_RESUME_STORE = 'pdf_upload_resume';
// Persistent zoom-rung bitmaps (the cross-session pyramid): compressed webp
// blobs keyed by document hash + page + rotation + rung + effDpr, so daily
// projects reopen with yesterday's zoom ladder already warm.
const ZOOM_RUNGS_STORE = 'zoom_rungs';
const ZOOM_RUNGS_MAX_PER_DOC = 24;          // entries per document
const ZOOM_RUNGS_MAX_BYTES = 100663296;     // ~96MB across all documents
const PDF_CACHE_MAX_ENTRIES = 10;
const PDF_CACHE_MAX_BYTES = 500 * 1024 * 1024;
const TAKEOFF_BACKUP_MAX_ENTRIES = 5;
const TAKEOFF_BACKUP_MAX_BYTES = 200 * 1024 * 1024;
const SAVE_LOGS_SNAPSHOT_MAX_ENTRIES = 10;
const CUSTOM_ICONS_KEY = 'user';

// --- PDF / misc ---
const PDF_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB (Supabase storage limit)
// PDF upload timeout budget. A fixed 60s timeout is far too short for a
// multi-megabyte PDF on a slow uplink (it falsely fails Turn In), so the upload
// timeout is sized from the byte count at an assumed conservative throughput,
// floored at BASE and capped at MAX. See pdfUploadTimeoutMs in save-utils.js.
const PDF_UPLOAD_TIMEOUT_BASE_MS = 60000;           // floor for any upload
const PDF_UPLOAD_ASSUMED_BPS = 100 * 1024;          // ~100 KB/s conservative uplink (bytes/sec)
const PDF_UPLOAD_TIMEOUT_SLACK_MS = 15000;          // fixed slack added to the size-based budget
const PDF_UPLOAD_TIMEOUT_MAX_MS = 8 * 60 * 1000;    // cap (covers the 50 MB limit at the assumed rate)
const PDF_UPLOAD_VERIFY_ATTEMPTS = 3;               // storage.info() polls after an upload timeout
const PDF_UPLOAD_VERIFY_GAP_MS = 4000;              // spacing between verify polls
const PDF_RESUMABLE_THRESHOLD_BYTES = 8 * 1024 * 1024; // use resumable/TUS upload above this size
const LOAD_TEST_PDF_URL = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';
const USER_ACTIVITY_TZ = 'America/Chicago';

// --- Pure helpers ---
// Recent-color list update, shared by the Create Counter / Create Line Type
// pickers and the edit color picker (showLineColorModal/applyLineColor). Pure:
// depends only on its args, no state/DOM. Skips colors that are already in the
// preset palette (those are always visible, so they don't belong in "Recent"),
// dedupes case-insensitively, newest-first, capped at RECENT_COLORS_MAX. Returns
// a new array; never mutates `list`.
const RECENT_COLORS_MAX = 12;
function nextRecentColors(list, color, presets) {
  const base = (Array.isArray(list) ? list : []).slice(0, RECENT_COLORS_MAX);
  if (typeof color !== 'string' || !color) return base;
  const c = color.toLowerCase();
  const presetSet = (Array.isArray(presets) ? presets : []).map(p => String(p).toLowerCase());
  if (presetSet.includes(c)) return base;
  return [c].concat(base.filter(x => String(x).toLowerCase() !== c)).slice(0, RECENT_COLORS_MAX);
}

// --- Zoom ladder ---
// The ladder (min 0.2 x 1.15^n) is RASTER CURRENCY, not displayed values:
// state.zoom stays fully continuous. renderPdf serves a commit from the
// nearest rung's cached bitmap (CSS carries the <=7% residual, an idle
// exact-refine settles crisp), and the idle prefetcher warms the rungs
// around the current zoom — so repeat zooming becomes a synchronous blit
// instead of a multi-second re-raster on dense sheets.
// Pure: callers pass minZoom/maxZoom (state.maxZoom is user-configurable).
const ZOOM_LADDER_STEP = 1.15;
const ZOOM_LADDER_MIN = 0.2;
function snapZoomToRung(z, minZoom, maxZoom, step) {
  const s = step || ZOOM_LADDER_STEP;
  const lo = minZoom ?? ZOOM_LADDER_MIN;
  const hi = maxZoom ?? 4;
  if (!(z > 0)) return lo;
  const zc = Math.max(lo, Math.min(hi, z));
  const n = Math.round(Math.log(zc / lo) / Math.log(s));
  let rung = Math.max(lo, Math.min(hi, lo * Math.pow(s, n)));
  // The clamp ends are rungs too: a gesture that lands at/near maxZoom (rail
  // dragged to the top, wheel against the ceiling) must commit to maxZoom
  // itself, not get pulled down to the nearest interior rung. Pick whichever
  // of {rung, hi} is nearer in log space (lo is covered by the clamp above).
  if (Math.abs(Math.log(zc / hi)) < Math.abs(Math.log(zc / rung))) rung = hi;
  return rung;
}
// Smallest rung strictly above z (clamped to maxZoom). The 0.1% epsilon makes
// a value sitting ON a rung (within float noise) step to the NEXT rung.
function nextRungUp(z, minZoom, maxZoom, step) {
  const s = step || ZOOM_LADDER_STEP;
  const lo = minZoom ?? ZOOM_LADDER_MIN;
  const hi = maxZoom ?? 4;
  const zc = Math.max(lo, Math.min(hi, z > 0 ? z : lo));
  const n = Math.floor(Math.log(zc * 1.001 / lo) / Math.log(s)) + 1;
  return Math.max(lo, Math.min(hi, lo * Math.pow(s, n)));
}
// Largest rung strictly below z (clamped to minZoom); same epsilon reasoning.
function nextRungDown(z, minZoom, maxZoom, step) {
  const s = step || ZOOM_LADDER_STEP;
  const lo = minZoom ?? ZOOM_LADDER_MIN;
  const hi = maxZoom ?? 4;
  const zc = Math.max(lo, Math.min(hi, z > 0 ? z : lo));
  const n = Math.ceil(Math.log(zc * 0.999 / lo) / Math.log(s)) - 1;
  return Math.max(lo, Math.min(hi, lo * Math.pow(s, n)));
}

// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TOOL, SCALE_MODES, PLUMBING_DEFAULTS, LINE_DEFAULTS, COLORS, SCALE_PRESETS,
    AUTO_SAVE_INTERVAL_MS, AUTOSAVE_TIMEOUT_MS, STORAGE_INFO_TIMEOUT_MS, CLIENT_PROBE_TIMEOUT_MS,
    CLIENT_RECYCLE_COOLDOWN_MS, DIRTY_SNAPSHOT_THRESHOLD_MS, CHECK_IN_TIMEOUT_MS, LONG_IDLE_PROBE_MS,
    TURN_IN_STALENESS_MS, AUTOSAVE_BACKOFF_LEVELS_MS, AUTOSAVE_BANNER_THRESHOLD, AUTOSAVE_RECOVERY_THRESHOLD,
    AUTOSAVE_RECOVERY_TIMEOUT_MS, AUTOSAVE_SLOW_MS, AUTOSAVE_SLOW_WINDOW, AUTOSAVE_SLOW_DEBOUNCE_MS,
    AUTOSAVE_SLOW_MIN_SAMPLES, GLOBAL_RELOAD_STAMP_KEY, CHECKOUT_INACTIVITY_MS, CHECKOUT_REFRESH_DEBOUNCE_MS,
    CHECKOUT_KEEPALIVE_MS, CHECKOUT_NEAR_EXPIRY_MS, CHECKOUT_SOFT_GRACE_MS, AUTO_RECHECKOUT_MAX_PER_PROJECT,
    AUTO_RECHECKOUT_MIN_GAP_MS, AUTO_RECHECKOUT_COOLDOWN_MS, REFRESH_PERMISSIONS_TIMEOUT_MS,
    PROJECTS_CHECKOUT_RECONNECT_BACKOFF_MS, PDF_ONESHOT_BACKOFF_MS, PDF_ONESHOT_LARGE_BACKOFF_MS,
    ACTIVITY_HIGH_FREQ_MS, ACTIVITY_PROJECT_SAVE_MS,
    SAVE_STATUS_LOG_MS, SAVE_STATUS_LOG_VERBOSE_MS, CHECKOUT_EXPIRED_SAVE_STATUS_MSG, CHECKOUT_EXPIRED_TOAST_MSG,
    PENDING_GLOBAL_RELOAD_STAMP_KEY, UNDO_STACK_SIZE,
    PDF_CACHE_DB, PDF_CACHE_STORE, PDF_CACHE_META_STORE, VIEW_PDFS_STORE, VIEW_PDFS_META_STORE,
    TAKEOFF_BACKUP_STORE, TAKEOFF_BACKUP_META_STORE, CUSTOM_ICONS_STORE, SAVE_LOGS_SNAPSHOT_STORE,
    PDF_UPLOAD_RESUME_STORE, ZOOM_RUNGS_STORE, ZOOM_RUNGS_MAX_PER_DOC, ZOOM_RUNGS_MAX_BYTES,
    PDF_CACHE_MAX_ENTRIES, PDF_CACHE_MAX_BYTES, TAKEOFF_BACKUP_MAX_ENTRIES, TAKEOFF_BACKUP_MAX_BYTES,
    SAVE_LOGS_SNAPSHOT_MAX_ENTRIES, CUSTOM_ICONS_KEY,
    PDF_MAX_SIZE_BYTES, LOAD_TEST_PDF_URL, USER_ACTIVITY_TZ,
    PDF_UPLOAD_TIMEOUT_BASE_MS, PDF_UPLOAD_ASSUMED_BPS, PDF_UPLOAD_TIMEOUT_SLACK_MS,
    PDF_UPLOAD_TIMEOUT_MAX_MS, PDF_UPLOAD_VERIFY_ATTEMPTS, PDF_UPLOAD_VERIFY_GAP_MS,
    PDF_RESUMABLE_THRESHOLD_BYTES,
    RECENT_COLORS_MAX, nextRecentColors,
    ZOOM_LADDER_STEP, ZOOM_LADDER_MIN, snapZoomToRung, nextRungUp, nextRungDown
  };
}

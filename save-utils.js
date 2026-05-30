/*
 * save-utils.js - Pure helpers for the save/sync layer of ClickCount, extracted
 * verbatim from index.html.
 *
 * Loaded as a classic <script src="save-utils.js"> in <head>, BEFORE the main IIFE.
 * These top-level function declarations live in the shared global lexical scope,
 * so the main script in index.html resolves them by bare name.
 *
 * Everything here is context-free: no reference to `state`, the DOM, or any
 * closure-scoped helper. They take all inputs as arguments and return values.
 * No build step.
 */

  // True when a save/turn-in error is worth one automatic retry (timeouts,
  // aborts, network blips, 408/429/5xx). Definite failures (auth, checkout
  // ownership, 4xx other than 408/429) return false.
  function isTransientSaveError(e) {
    if (!e) return false;
    const code = e.code || '';
    const msg  = e.message || String(e);
    if (code === 'CHECKOUT_EXPIRED' || code === 'CHECKOUT_NOT_OWNED' || code === '42501') return false;
    if (e.name === 'AbortError') return true;
    if (typeof e.status === 'number') {
      if (e.status === 408 || e.status === 429) return true;
      if (e.status >= 500) return true;
      if (e.status >= 400) return false;
    }
    return /timed?\s*out|timeout|network|fetch|temporarily|connection\s+closed|socket|5\d\d/i.test(msg)
      || code === 'ETIMEDOUT'
      || code === 'ECONNRESET';
  }

  // Count total counter markers and lines across a project `data` object.
  // Handles both the legacy per-page `annotations` shape and the current
  // per-page `canvases[].annotations` shape.
  function getProjectCounts(data) {
    let counterCount = 0, lineCount = 0;
    (data?.pages || []).forEach(p => {
      const canvases = p?.canvases || (p?.annotations ? [{ annotations: p.annotations }] : []);
      canvases.forEach(c => {
        const ann = c?.annotations || {};
        Object.values(ann.counterMarkers || {}).forEach(arr => { counterCount += (arr?.length || 0); });
        lineCount += (ann.quickLines?.length || 0) + (ann.polylines?.length || 0);
      });
    });
    return { counter_count: counterCount, line_count: lineCount };
  }

  // Serialize an Error-like object to a plain, log-safe shape. Deduped from the
  // former app.js serializeSaveErrorForEvent / saveDebugSerializeError pair; the
  // `|| String(e)` message fallback is the superset of the two.
  function serializeSaveError(e) {
    if (!e) return {};
    return {
      message: e.message || String(e),
      name: e.name,
      code: e.code,
      status: e.status,
      details: e.details,
      hint: e.hint
    };
  }

  // Compact JSON string of a serialized error for the Save Status detail field,
  // with a defensive fallback when JSON.stringify throws.
  function formatSaveStatusErrDetail(e) {
    if (!e) return '';
    try { return JSON.stringify(serializeSaveError(e)); } catch (_) { return String((e && e.message) || e); }
  }

  // The auto-save backoff delay (ms) for a given consecutive-failure count,
  // picked from a precomputed levels array and clamped at the last level.
  function backoffDelayMs(failures, levels) {
    if (!levels || !levels.length) return 0;
    const idx = Math.min(Math.max(failures - 1, 0), levels.length - 1);
    return levels[idx];
  }

  // Server/local clock skew in ms from an RPC payload's `server_now` (ISO string
  // or epoch ms) relative to a supplied local now. Returns null when absent or
  // unparseable.
  function computeClockOffsetMs(rpcData, localNowMs) {
    const raw = rpcData && rpcData.server_now;
    if (!raw) return null;
    const t = typeof raw === 'string' ? new Date(raw).getTime() : Number(raw);
    if (!Number.isFinite(t)) return null;
    return t - localNowMs;
  }

  // The p-th percentile (0..1) of a numeric sample array using nearest-rank on a
  // sorted copy. Returns null for an empty/invalid array.
  function percentile(samples, p) {
    if (!Array.isArray(samples) || !samples.length) return null;
    const sorted = samples.slice().sort((a, b) => a - b);
    return sorted[Math.floor(p * (sorted.length - 1))];
  }

  // Node test harness only: in a classic browser <script> `module` is undefined,
  // so this is a no-op there and the declarations above stay plain globals.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      isTransientSaveError, getProjectCounts,
      serializeSaveError, formatSaveStatusErrDetail, backoffDelayMs,
      computeClockOffsetMs, percentile
    };
  }

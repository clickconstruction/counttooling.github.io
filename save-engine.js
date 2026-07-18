/*
 * save-engine.js — the save/sync engine, extracted from the app.js IIFE in
 * stages (Stage 1: the two leaf clusters — [sync] Global force reload and
 * [sync] Checkout keep-alive). Classic <script src> loaded AFTER constants.js
 * (it reads the GLOBAL_RELOAD_* keys and CHECKOUT_* tuning constants by bare
 * name) and BEFORE app.js, in the idb.js/save-utils.js slot.
 *
 * Shape: `createSaveEngine(ctx)` — app.js instantiates the engine once near
 * the top of its IIFE, passing a context of accessors/callbacks for
 * everything state- or closure-coupled (the live `state` object, the
 * recyclable supabase client, the Save Status log writers, the checkout
 * machinery still living in app.js). The engine never reads app.js closure
 * variables by name; app.js keeps same-named thin wrappers
 * (checkGlobalForceReload / doGlobalReloadNow / showGlobalReloadBanner /
 * checkoutKeepalive) so every call site, the App registry, and the window.*
 * contracts stay frozen while clusters migrate in behind this seam.
 *
 * ctx contract (grown per stage):
 *   getState()                        -> the live state object
 *   getSupabase()                     -> current supabase client (recycled)
 *   isSupabaseEnabled()               -> SUPABASE_ENABLED
 *   withTimeout(promise, ms, label)   -> app.js timeout wrapper
 *   probeCheckoutLock()               -> server-side lock probe
 *   handleBackgroundCheckoutExpired(trigger) -> background expiry wrapper
 *   isAutoSaveSuspended()             -> suspendAutoSaveUntilCheckout
 *   getLastCheckoutRefreshAt()        -> lastCheckoutRefreshAt
 *   -- Stage 2 (dirty core; these reach app-side state whose primary
 *      writers migrate in later stages):
 *   getAutoSaveDirty() / setAutoSaveDirty(v)
 *   setLastModifiedAt(ms)
 *   invalidateFooterTotals()
 *   autosaveEventDetail(extra)        -> enriched event detail builder
 *   scheduleTakeoffBackup()           -> debounced local-backup kick
 *   isCheckoutExpiredAttention()
 *   setLastCheckoutRefreshAt(ms)
 *   updateServerClockFromRpc(data)
 *
 * Stage 2: the engine OWNS the Save Status log (saveStatusLog + push/prune/
 * window/debug helpers) and the dirty bookkeeping (dirtyGeneration /
 *   dirtyStartedAt / the throttled dirty event) as instance state; app.js
 * keeps same-named wrappers for the ~230 call sites and delegates
 * App.getSaveStatusLog to the engine getter.
 *
 * The guarded CommonJS footer (inert in the browser) lets
 * save-engine.test.js `require()` createSaveEngine under node --test and
 * eslint.config.js derive the app.js lint global.
 */
function createSaveEngine(ctx) {
  // --- [sync] Save Status log core (Stage 2) ------------------------------
  // The rolling client-side telemetry log. Engine-owned state: the log array
  // (reassigned on clear) and the dirty-event throttle stamp.
  let saveStatusLog = [];
  let saveStatusDirtyLogAt = 0;

  function isSaveDebugEnabled() {
    try {
      if (typeof window.CLICKCOUNT_DEBUG_SAVE !== 'undefined' && window.CLICKCOUNT_DEBUG_SAVE) return true;
      return localStorage.getItem('clickcount-debug-save') === '1';
    } catch (_) { return false; }
  }
  function setSaveDebugEnabled(on) {
    try {
      if (on) localStorage.setItem('clickcount-debug-save', '1');
      else localStorage.removeItem('clickcount-debug-save');
    } catch (_) {}
  }
  function saveDebugRunId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function saveDebugLog(phase, payload) {
    if (!isSaveDebugEnabled()) return;
    const obj = payload && typeof payload === 'object' ? payload : {};
    console.log('[SaveDebug]', phase, obj);
    try {
      let detailStr;
      try { detailStr = JSON.stringify(obj); } catch (_) { detailStr = String(obj); }
      if (detailStr && detailStr.length > 4096) detailStr = detailStr.slice(0, 4096) + '…';
      pushSaveEvent('debug', phase, detailStr);
    } catch (_) {}
  }
  function saveDebugLogError(runId, context, e) {
    if (!isSaveDebugEnabled()) return;
    const msg = (e && e.message) || '';
    if (msg.includes('timed out')) {
      saveDebugLog(context + '.timeout', { runId, note: 'The HTTP request may still complete server-side.', message: msg });
    } else {
      saveDebugLog(context + '.error', Object.assign({ runId }, serializeSaveError(e)));
    }
  }
  function getSaveStatusLogWindowMs() {
    return isSaveDebugEnabled() ? SAVE_STATUS_LOG_VERBOSE_MS : SAVE_STATUS_LOG_MS;
  }
  function pruneSaveStatusLog() {
    const cutoff = Date.now() - getSaveStatusLogWindowMs();
    while (saveStatusLog.length && saveStatusLog[0].ts < cutoff) saveStatusLog.shift();
  }
  function pushSaveEvent(kind, message, detail) {
    if (!ctx.isSupabaseEnabled()) return;
    pruneSaveStatusLog();
    saveStatusLog.push({ ts: Date.now(), kind: kind, message: message || '', detail: detail !== undefined && detail !== '' ? detail : undefined });
  }
  function getSaveStatusLog() { return saveStatusLog; }
  function clearSaveStatusLog() { saveStatusLog = []; }

  // --- [sync] Dirty tracking core (Stage 2) -------------------------------
  // Engine-owned: the dirty generation counter (lost-edit correctness across
  // in-flight saves) and the first-dirty timestamp (snapshot threshold +
  // dirtyForMs telemetry). autoSaveDirty / lastModifiedAt stay app-side until
  // the save paths (their primary writers) migrate; the engine reaches them
  // through ctx.
  let dirtyGeneration = 0;
  let dirtyStartedAt = 0;

  function markProjectDirty() {
    const state = ctx.getState();
    if (state.isViewer || !state.pages.length && !state.currentProjectId) return;
    const wasDirty = ctx.getAutoSaveDirty();
    ctx.setAutoSaveDirty(true);
    dirtyGeneration++;
    ctx.setLastModifiedAt(Date.now());
    if (!wasDirty) dirtyStartedAt = Date.now();
    ctx.invalidateFooterTotals();
    if (ctx.isSupabaseEnabled() && state.supabaseSession?.user && !state.isViewer) {
      const now = Date.now();
      if (now - saveStatusDirtyLogAt >= 2000) {
        saveStatusDirtyLogAt = now;
        pushSaveEvent('dirty', 'Project marked dirty (pending cloud sync)', ctx.autosaveEventDetail({ dirtyForMs: dirtyStartedAt ? (now - dirtyStartedAt) : 0 }));
      }
    }
    ctx.scheduleTakeoffBackup();
    if (!ctx.isAutoSaveSuspended() && !ctx.isCheckoutExpiredAttention() && state.currentProjectId && state.checkedOutBy === state.supabaseSession?.user?.id && Date.now() - ctx.getLastCheckoutRefreshAt() >= CHECKOUT_REFRESH_DEBOUNCE_MS) {
      ctx.setLastCheckoutRefreshAt(Date.now());
      const supabase = ctx.getSupabase();
      if (supabase) supabase.rpc('refresh_checkout_activity', { p_project_id: state.currentProjectId }).then(({ data }) => {
        ctx.updateServerClockFromRpc(data);
        if (data?.ok) state.checkedOutAt = data.checked_out_at || new Date().toISOString();
      });
    }
  }
  function getDirtyGeneration() { return dirtyGeneration; }
  function getDirtyStartedAt() { return dirtyStartedAt; }
  function clearDirtyStartedAt() { dirtyStartedAt = 0; }
  function resetDirtyTracking() { dirtyGeneration = 0; dirtyStartedAt = 0; saveStatusDirtyLogAt = 0; }

  // --- [sync] Global force reload -----------------------------------------
  // Admin-triggered "everyone reload now" via the system_settings row
  // force_reload_after: newer server timestamp than the local stamp -> clear
  // local caches and reload; the stamp only commits after a confirmed reload
  // (load/pageshow in the fresh document), so a blocked reload retries.

  async function checkGlobalForceReload() {
    const state = ctx.getState();
    const supabase = ctx.getSupabase();
    if (!ctx.isSupabaseEnabled() || !supabase || !state.supabaseSession?.user) return;
    try {
      const { data, error } = await ctx.withTimeout(
        supabase.from('system_settings').select('value_ts,value_text').eq('key', 'force_reload_after').single(),
        5000,
        'check global reload'
      );
      if (error || !data?.value_ts) return;
      const serverTs = new Date(data.value_ts).getTime();
      const localTs = parseInt(localStorage.getItem(GLOBAL_RELOAD_STAMP_KEY) || '0', 10);
      state.globalReloadAtServerMs = serverTs;
      state.globalReloadReason = data.value_text || '';
      if (serverTs > localTs) doGlobalReloadNow('boot');
    } catch (_) {}
  }

  function doGlobalReloadNow(trigger) {
    const state = ctx.getState();
    const stamp = String(state.globalReloadAtServerMs || Date.now());
    try { localStorage.setItem(PENDING_GLOBAL_RELOAD_STAMP_KEY, stamp); } catch (_) {}
    try { pushSaveEvent('global_reload_triggered', 'Admin triggered global reload', JSON.stringify({ trigger, reason: state.globalReloadReason || '' })); } catch (_) {}
    try { indexedDB.deleteDatabase('clickcount-pdf-cache'); } catch (_) {}
    // PWA: best-effort clear the service-worker caches too, so the offline
    // fallback also refreshes. Fire-and-forget — must NOT block location.reload().
    try { if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {}); } catch (_) {}
    const keysToRemove = ['clickcount-last-project', 'clickcount-save-error', 'takeoff-state', 'lineModifiers', 'plumbingModifiers', 'groupColorDisplay', 'pagesTitlesTruncated', 'hideUnmarkedPagesFromSidebar', 'counterSearch', 'lineTypeSearch', 'linesSearch', 'linesTypeExpanded', 'zoomSettings', 'specificPagesIncludeReport', 'customIconPaths'];
    for (const k of keysToRemove) { try { localStorage.removeItem(k); } catch (_) {} }
    location.reload();
  }

  // Installed once at app.js load: commits the pending reload stamp after a
  // confirmed (non-prerender) navigation, so a blocked reload retries next time.
  function installGlobalReloadStampCommit() {
    if (typeof window === 'undefined') return;
    try {
      const commitPendingReloadStamp = () => {
        try {
          const pending = localStorage.getItem(PENDING_GLOBAL_RELOAD_STAMP_KEY);
          if (!pending) return;
          // We are running this code in a fresh document, so a navigation/load
          // has happened. Treat any non-"prerender" navigation as a confirmed
          // reload commit and write the real stamp.
          let confirmedReload = true;
          try {
            const entries = (performance.getEntriesByType && performance.getEntriesByType('navigation')) || [];
            if (entries.length && entries.every(e => e.type === 'prerender')) confirmedReload = false;
          } catch (_) {}
          if (confirmedReload) {
            localStorage.setItem(GLOBAL_RELOAD_STAMP_KEY, pending);
            localStorage.removeItem(PENDING_GLOBAL_RELOAD_STAMP_KEY);
            try { pushSaveEvent('global_reload_committed', 'Global reload stamp committed after successful reload', pending); } catch (_) {}
          }
        } catch (_) {}
      };
      if (document.readyState === 'complete' || document.readyState === 'interactive') commitPendingReloadStamp();
      else window.addEventListener('load', commitPendingReloadStamp, { once: true });
      window.addEventListener('pageshow', commitPendingReloadStamp, { once: true });
    } catch (_) {}
  }

  function showGlobalReloadBanner() {
    const state = ctx.getState();
    const el = document.getElementById('globalReloadBanner');
    const txt = document.getElementById('globalReloadBannerText');
    if (!el) return;
    const reason = state.globalReloadReason ? ' Reason: ' + state.globalReloadReason : '';
    if (txt) txt.textContent = 'Reload required for update.' + reason;
    el.style.display = '';
  }

  // --- [sync] Checkout keep-alive -----------------------------------------
  // Visible-tab interval (CHECKOUT_KEEPALIVE_MS) that probes the server-side
  // checkout lock and routes a detected expiry through the background
  // recovery wrapper.

  async function checkoutKeepalive() {
    const state = ctx.getState();
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabase()) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      saveDebugLog('keepalive.skip', { reason: 'not_visible' });
      return;
    }
    const userId = state.supabaseSession?.user?.id;
    if (!userId) return;
    if (!state.currentProjectId || state.checkedOutBy !== userId) return;
    if (state.isViewer || ctx.isAutoSaveSuspended()) {
      saveDebugLog('keepalive.skip', { reason: state.isViewer ? 'viewer' : 'suspended' });
      return;
    }
    if (Date.now() - ctx.getLastCheckoutRefreshAt() < CHECKOUT_REFRESH_DEBOUNCE_MS) {
      saveDebugLog('keepalive.skip', { reason: 'debounced' });
      return;
    }
    saveDebugLog('keepalive.tick', { projectId: state.currentProjectId });
    const probe = await ctx.probeCheckoutLock();
    if (probe.expired) {
      saveDebugLog('keepalive.expired', {});
      pushSaveEvent('keepalive_expired', CHECKOUT_EXPIRED_SAVE_STATUS_MSG);
      try {
        await ctx.handleBackgroundCheckoutExpired('keepalive');
      } catch (e) {
        try {
          pushSaveEvent('background_recovery_threw', 'Background recovery threw unexpectedly',
            JSON.stringify({ trigger: 'keepalive', message: (e && e.message) || String(e), name: e && e.name }));
        } catch (_) {}
      }
    }
  }

  return {
    // Stage 2: Save Status log core + dirty core
    pushSaveEvent,
    pruneSaveStatusLog,
    getSaveStatusLog,
    clearSaveStatusLog,
    getSaveStatusLogWindowMs,
    isSaveDebugEnabled,
    setSaveDebugEnabled,
    saveDebugRunId,
    saveDebugLog,
    saveDebugLogError,
    markProjectDirty,
    getDirtyGeneration,
    getDirtyStartedAt,
    clearDirtyStartedAt,
    resetDirtyTracking,
    // Stage 1: global force reload + checkout keep-alive
    checkGlobalForceReload,
    doGlobalReloadNow,
    installGlobalReloadStampCommit,
    showGlobalReloadBanner,
    checkoutKeepalive,
  };
}

// Dual-environment export (inert in the browser) so save-engine.test.js can
// require() this under node --test and eslint.config.js can derive the app.js
// lint global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSaveEngine };
}

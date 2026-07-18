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
 *   handleBackgroundCheckoutExpired(trigger) -> background expiry wrapper
 *   isAutoSaveSuspended()             -> suspendAutoSaveUntilCheckout
 *   getLastCheckoutRefreshAt()        -> lastCheckoutRefreshAt
 *   -- Stage 2 (dirty core; these reach app-side state whose primary
 *      writers migrate in later stages):
 *   getAutoSaveDirty() / setAutoSaveDirty(v)
 *   setLastModifiedAt(ms)
 *   invalidateFooterTotals()
 *   autosaveEventDetail(extra)        -> enriched event detail builder
 *   isCheckoutExpiredAttention()
 *   setLastCheckoutRefreshAt(ms)
 *   updateServerClockFromRpc(data)
 *   -- Stage 3 (storage ring):
 *   serverNowMs()                     -> skew-corrected clock
 *   noteSupabaseCallOk()              -> stamps lastSuccessfulSupabaseCallAt
 *   perfLog(label, ms, extra)         -> [Perf] console line
 *   getUserCustomIcons()              -> user icon list for the backup blob
 *   computePageBakeFrame(page)        -> orientation stamp for the backup
 *   getLastModifiedAt()               -> app-side lastModifiedAt
 *   -- Stage 4 (client resilience):
 *   setSupabase(client)               -> reassign the app-side client let
 *   getSupabaseUrl() / getSupabaseAnonKey()
 *   getConsecutiveAutoSaveFailures()  -> stage-6 failure counter (read-only)
 *   clearAutoSaveBackoff()            -> nextAutoSaveAttemptAt = 0
 *   resubscribeCheckout(projectId)    -> re-attach the realtime channel
 *   onCheckoutChannelDropped()        -> null the app-side channel handle
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
    scheduleTakeoffBackup();
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

  // --- [sync] Checkout probe, hashing & backup storage (Stage 3) ----------
  // Engine-owned: the backup write in-flight promise, the one-shot backup
  // warning, the last-local-backup stamps, and the 1s dirty->backup debounce.
  let takeoffBackupWriteInFlight = null;
  let takeoffBackupWarnShown = false;
  let lastLocalBackupAt = null;
  let lastLocalBackupOk = null;
  let backupDebounceTimer = null;

  async function probeCheckoutLock(runId) {
    const state = ctx.getState();
    const supabase = ctx.getSupabase();
    const userId = state.supabaseSession?.user?.id;
    if (!ctx.isSupabaseEnabled() || !supabase || !state.currentProjectId || !userId) {
      return { ok: false, error: new Error('Not signed in or no project') };
    }
    if (state.checkedOutBy !== userId) {
      return { ok: false, expired: true, error: 'Not the lock holder' };
    }
    const checkedAt = state.checkedOutAt ? new Date(state.checkedOutAt).getTime() : 0;
    const ageMs = checkedAt ? ctx.serverNowMs() - checkedAt : null;
    saveDebugLog('probe.start', { runId, ageMs, projectId: state.currentProjectId });
    const t0 = Date.now();
    try {
      const { data, error } = await ctx.withTimeout(
        supabase.rpc('refresh_checkout_activity', { p_project_id: state.currentProjectId }),
        10000,
        'Probe checkout'
      );
      const roundTripMs = Date.now() - t0;
      ctx.updateServerClockFromRpc(data);
      if (error) {
        saveDebugLog('probe.error', { runId, ageMs, roundTripMs, message: error.message, code: error.code });
        return { ok: false, error };
      }
      if (data?.ok) {
        state.checkedOutAt = data.checked_out_at || new Date().toISOString();
        ctx.setLastCheckoutRefreshAt(Date.now());
        ctx.noteSupabaseCallOk();
        saveDebugLog('probe.ok', { runId, ageMs, roundTripMs });
        return { ok: true, refreshed: true };
      }
      saveDebugLog('probe.expired', { runId, ageMs, roundTripMs, serverError: data?.error });
      return { ok: false, expired: true, error: data?.error || 'Checkout expired' };
    } catch (e) {
      const roundTripMs = Date.now() - t0;
      saveDebugLog('probe.error', { runId, ageMs, roundTripMs, message: e?.message, name: e?.name });
      return { ok: false, error: e };
    }
  }

  async function sha256Hex(buffer) {
    const t0 = Date.now();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    ctx.perfLog('sha256Hex', Date.now() - t0, { bytes: buffer.byteLength });
    return hex;
  }

  // Wrapper over idb.js idbTakeoffBackupGetRaw: the cross-user mismatch check
  // + logging live here; idb.js owns the raw get.
  async function takeoffBackupGet(projectId, currentUserId) {
    const entry = await idbTakeoffBackupGetRaw(projectId);
    if (!entry) return null;
    if (currentUserId && entry.userId && entry.userId !== currentUserId) {
      try { saveDebugLog('takeoffBackup.user_mismatch', { projectId, ownerUserId: entry.userId, currentUserId }); } catch (_) {}
      try { await takeoffBackupDelete(projectId); } catch (_) {}
      return null;
    }
    return entry;
  }

  // Wrapper over idb.js idbTakeoffBackupPut: the pure primitive does the eviction
  // + stale-skip inside one transaction and returns a status; the logging + the
  // one-shot warning stay here.
  async function takeoffBackupPut(projectId, data, pdfBlob, pdfHash, lastModifiedAtArg, projectName, userId) {
    const res = await idbTakeoffBackupPut(projectId, data, pdfBlob, pdfHash, lastModifiedAtArg, projectName, userId);
    if (res && res.skippedStale) {
      saveDebugLog('takeoffBackup.skip_stale', { projectId, existing: res.existing, incoming: res.incoming });
    } else if (res && res.error) {
      saveDebugLog('takeoffBackup.put_err', { projectId, message: res.error?.message });
      if (!takeoffBackupWarnShown) {
        takeoffBackupWarnShown = true;
        try {
          pushSaveEvent(
            'takeoff_backup_warn',
            'Local takeoff backup failed - tab-crash recovery may not work',
            res.error?.message || ''
          );
        } catch (_) {}
      }
    }
  }

  async function writeTakeoffStateBackup() {
    const state = ctx.getState();
    // Viewer sessions have nothing recoverable (no edits are possible) - don't
    // write local backups keyed by someone else's project id.
    if (state.isViewer) return;
    if (!state.pages.length && !state.counters.length && !state.lineTypes.length) return;
    // If an in-flight write exists, wait for it to finish then start a fresh write so
    // the latest state is captured (critical for doTurnIn / preparePdf commit paths).
    if (takeoffBackupWriteInFlight) {
      try { await takeoffBackupWriteInFlight; } catch (_) {}
    }
    try {
      await writeTakeoffBackupToIndexedDB();
    } catch (_) {}
  }

  async function writeTakeoffBackupToIndexedDB() {
    const state = ctx.getState();
    if (!BACKUP_PDF_TO_INDEXEDDB) return;
    if (!state.pages.length && !state.counters.length && !state.lineTypes.length) return;
    if (takeoffBackupWriteInFlight) {
      try { saveDebugLog('takeoff_backup_skip_inflight', {}); } catch (_) {}
      return takeoffBackupWriteInFlight;
    }
    let resolveInFlight;
    takeoffBackupWriteInFlight = new Promise((res) => { resolveInFlight = res; });
    try {
      return await doWriteTakeoffBackupToIndexedDB();
    } finally {
      const p = takeoffBackupWriteInFlight;
      takeoffBackupWriteInFlight = null;
      try { resolveInFlight && resolveInFlight(); } catch (_) {}
      void p;
    }
  }

  async function doWriteTakeoffBackupToIndexedDB() {
    const state = ctx.getState();
    let projectId = state.currentProjectId || 'local';
    let pdfBlob = state.pdfBuffer && (state.pdfBuffer.byteLength || state.pdfBuffer.length || 0) > 0
      ? new Blob([state.pdfBuffer], { type: 'application/pdf' }) : null;
    if (!pdfBlob) {
      let cacheProjectId = state.currentProjectId;
      let cachePdfHash = state.pdfHash;
      if (!cacheProjectId || !cachePdfHash) {
        try {
          const last = JSON.parse(localStorage.getItem('clickcount-last-project') || 'null');
          if (last && last.userId === state.supabaseSession?.user?.id) {
            if (!cacheProjectId) cacheProjectId = last.projectId;
            if (!cachePdfHash) cachePdfHash = last.pdfHash;
            if (!cachePdfHash && cacheProjectId && ctx.isSupabaseEnabled() && ctx.getSupabase()) {
              const { data: proj } = await ctx.getSupabase().from('projects').select('pdf_hash').eq('id', cacheProjectId).single();
              if (proj?.pdf_hash) cachePdfHash = proj.pdf_hash;
            }
          }
        } catch (_) {}
      }
      if (cacheProjectId && cachePdfHash) {
        try {
          const cached = await pdfCacheGet(cacheProjectId, cachePdfHash);
          if (cached && cached.size > 0) {
            pdfBlob = cached;
            if (projectId === 'local') projectId = cacheProjectId;
          }
        } catch (_) {}
      }
    }
    const data = {
      counters: state.counters,
      lineTypes: state.lineTypes,
      groups: state.groups || [],
      counterSettings: state.counterSettings,
      lineTypeSettings: state.lineTypeSettings,
      exportSettings: state.exportSettings,
      recentLineColors: state.recentLineColors,
      iconNames: state.iconNames || {},
      iconOrder: state.iconOrder || null,
      customIconPaths: ctx.getUserCustomIcons(),
      legendSettings: state.legendSettings,
      multiplyZoneSettings: state.multiplyZoneSettings,
      showGridOverlay: state.showGridOverlay,
      gridSettings: state.gridSettings,
      pageCanvases: state.pages.map(p => p.canvases),
      activeCanvasIdByPage: state.activeCanvasIdByPage || {},
      pageScales: state.pages.map(p => p.scale),
      pageRotations: state.pages.map(p => p.rotation ?? 0),
      pageBakeFrames: state.pages.map(p => ctx.computePageBakeFrame(p))
    };
    const lastMod = (state.currentProjectId && ctx.getLastModifiedAt()) ? ctx.getLastModifiedAt() : Date.now();
    const pdfHash = state.pdfHash || null;
    const projectName = state.currentProjectName || null;
    const userId = state.supabaseSession?.user?.id || null;
    lastLocalBackupOk = false;
    await takeoffBackupPut(projectId, data, pdfBlob, pdfHash, lastMod, projectName, userId);
    lastLocalBackupAt = new Date().toISOString();
    lastLocalBackupOk = true;
  }

  // The 1s dirty->backup debounce (markProjectDirty calls this).
  function scheduleTakeoffBackup() {
    if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
    backupDebounceTimer = setTimeout(() => { backupDebounceTimer = null; writeTakeoffStateBackup(); }, 1000);
  }
  function getLastLocalBackupAt() { return lastLocalBackupAt; }
  function getLastLocalBackupOk() { return lastLocalBackupOk; }
  function setLastLocalBackupAt(v) { lastLocalBackupAt = v; }
  function resetLocalBackupState() {
    lastLocalBackupAt = null;
    lastLocalBackupOk = null;
    takeoffBackupWarnShown = false;
  }

  // --- [sync] Sync recovery & client recycle (Stage 4) --------------------
  // Engine-owned: the probe/recycle in-flight guards, the recycle cooldown +
  // per-run count, and the wedged-supabase-js failure stamp.
  let recoveryProbeInFlight = false;
  let clientProbeInFlightGuard = false;
  let clientRecycleInFlight = false;
  let lastClientRecycleAt = 0;
  let clientRecycleCountThisRun = 0;
  let lastSupabaseJsFailureAt = 0;

  function noteSupabaseJsFailure(context, err) {
    if (err && typeof err.status === 'number' && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
      return;
    }
    if (err && (err.code === 'CHECKOUT_EXPIRED' || err.code === 'CHECKOUT_NOT_OWNED' || err.code === '42501' || err.code === 'PGRST116')) {
      return;
    }
    lastSupabaseJsFailureAt = Date.now();
    try {
      pushSaveEvent('sbjs_failure_recorded', 'Supabase-js call failed (raw-fetch may be safer)', ctx.autosaveEventDetail({
        context: context || 'unknown',
        message: err?.message,
        name: err?.name,
        code: err?.code,
        status: err?.status
      }));
    } catch (_) {}
  }

  async function runRecoveryProbe(trigger) {
    if (recoveryProbeInFlight) return { ok: false, ms: 0, status: null, errMsg: 'in_flight' };
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabaseUrl() || !ctx.getSupabaseAnonKey()) return { ok: false, ms: 0, status: null, errMsg: 'disabled' };
    recoveryProbeInFlight = true;
    const runId = saveDebugRunId();
    saveDebugLog('autosave.recovery.start', { runId, trigger, failures: ctx.getConsecutiveAutoSaveFailures() });
    pushSaveEvent('autosave_recovery_probe', 'Attempting to refresh connection', JSON.stringify({ trigger }));
    try {
      const token = ctx.getState().supabaseSession?.access_token || null;
      const controller = new AbortController();
      const timer = setTimeout(() => { try { controller.abort(); } catch (_) {} }, AUTOSAVE_RECOVERY_TIMEOUT_MS);
      const t0 = Date.now();
      let ok = false, status = null, errMsg = null, diag = null;
      try {
        const res = await fetch(ctx.getSupabaseUrl() + '/rest/v1/projects?select=id&limit=1', {
          method: 'GET',
          headers: {
            apikey: ctx.getSupabaseAnonKey(),
            ...(token ? { Authorization: 'Bearer ' + token } : {})
          },
          cache: 'no-store',
          signal: controller.signal
        });
        status = res.status;
        ok = res.ok;
        diag = extractResponseDiagnostics(res.headers);
      } catch (e) {
        errMsg = e?.message || String(e);
      } finally {
        clearTimeout(timer);
      }
      const ms = Date.now() - t0;
      if (ok) {
        saveDebugLog('autosave.recovery.ok', { runId, ms, status });
        pushSaveEvent('autosave_recovery_ok', 'Connection refreshed', JSON.stringify({ ms, status }));
        ctx.clearAutoSaveBackoff();
        ctx.noteSupabaseCallOk();
      } else {
        saveDebugLog('autosave.recovery.err', { runId, ms, status, message: errMsg });
        pushSaveEvent('autosave_recovery_err', 'Recovery probe failed', JSON.stringify({ ms, status, message: errMsg, diag }));
      }
      return { ok, ms, status, errMsg };
    } finally {
      recoveryProbeInFlight = false;
    }
  }

  async function runSupabaseClientProbe(trigger) {
    const supabase = ctx.getSupabase();
    if (!ctx.isSupabaseEnabled() || !supabase) return { ok: false, ms: 0, errMsg: 'disabled' };
    if (clientProbeInFlightGuard) return { ok: false, ms: 0, errMsg: 'in_flight' };
    clientProbeInFlightGuard = true;
    const t0 = Date.now();
    let ok = false, errMsg = null, errName = null, errStatus = null, errCode = null;
    try {
      const probeOp = ctx.withTimeout(
        (signal) => supabase.from('projects').select('id').limit(1).abortSignal(signal),
        CLIENT_PROBE_TIMEOUT_MS,
        'Client probe'
      );
      const { error } = await probeOp;
      if (error) {
        errMsg = error.message || String(error);
        errName = error.name;
        errStatus = (typeof error.status === 'number') ? error.status : null;
        errCode = error.code || null;
      } else {
        ok = true;
      }
    } catch (e) {
      errMsg = e?.message || String(e);
      errName = e?.name;
      errStatus = (typeof e?.status === 'number') ? e.status : null;
      errCode = e?.code || null;
    } finally {
      clientProbeInFlightGuard = false;
    }
    const ms = Date.now() - t0;
    if (ok) {
      saveDebugLog('autosave.client_probe.ok', { trigger, ms });
      pushSaveEvent('autosave_client_probe_ok', 'Supabase client responsive', ctx.autosaveEventDetail({ trigger, ms }));
      ctx.noteSupabaseCallOk();
    } else {
      saveDebugLog('autosave.client_probe.err', { trigger, ms, message: errMsg, name: errName });
      pushSaveEvent('autosave_client_probe_err', 'Supabase client appears wedged', ctx.autosaveEventDetail({ trigger, ms, message: errMsg, name: errName }));
      noteSupabaseJsFailure('client_probe', { message: errMsg, name: errName, status: errStatus, code: errCode });
    }
    return { ok, ms, errMsg };
  }

  async function recreateSupabaseClient(reason) {
    if (!ctx.isSupabaseEnabled() || typeof window.supabase === 'undefined') return false;
    if (clientRecycleInFlight) {
      saveDebugLog('autosave.client_recycle.skip', { reason, why: 'in_flight' });
      pushSaveEvent('client_recycle_skipped_inflight', 'Client recycle skipped (already running)', ctx.autosaveEventDetail({ reason }));
      return false;
    }
    if (Date.now() - lastClientRecycleAt < CLIENT_RECYCLE_COOLDOWN_MS) {
      saveDebugLog('autosave.client_recycle.skip', { reason, why: 'cooldown' });
      pushSaveEvent('client_recycle_skipped_cooldown', 'Client recycle skipped (cooldown)', ctx.autosaveEventDetail({ reason, msSinceLastRecycle: Date.now() - lastClientRecycleAt, cooldownMs: CLIENT_RECYCLE_COOLDOWN_MS }));
      return false;
    }
    clientRecycleInFlight = true;
    const t0 = Date.now();
    const state = ctx.getState();
    const previousSession = state.supabaseSession || null;
    let resubscribed = false;
    try {
      try { const prev = ctx.getSupabase(); if (prev) await prev.removeAllChannels(); } catch (_) {}
      ctx.onCheckoutChannelDropped();
      const { createClient } = window.supabase;
      const next = createClient(ctx.getSupabaseUrl(), ctx.getSupabaseAnonKey());
      ctx.setSupabase(next);
      if (previousSession?.access_token && previousSession?.refresh_token) {
        try {
          await ctx.withTimeout(
            next.auth.setSession({
              access_token: previousSession.access_token,
              refresh_token: previousSession.refresh_token
            }),
            5000,
            'Client recycle setSession'
          );
        } catch (sessErr) {
          saveDebugLog('autosave.client_recycle.setSession_err', { reason, message: sessErr?.message });
        }
      }
      if (state.currentProjectId && state.supabaseSession?.user) {
        try {
          ctx.resubscribeCheckout(state.currentProjectId);
          resubscribed = true;
        } catch (rtErr) {
          saveDebugLog('autosave.client_recycle.resubscribe_err', { reason, message: rtErr?.message });
        }
      }
      lastClientRecycleAt = Date.now();
      clientRecycleCountThisRun++;
      const elapsedMs = Date.now() - t0;
      saveDebugLog('autosave.client_recycle.ok', { reason, elapsedMs, resubscribed });
      pushSaveEvent('autosave_client_recycled', 'Supabase client recreated', ctx.autosaveEventDetail({ reason, elapsedMs, resubscribed, recycleCount: clientRecycleCountThisRun }));
      return true;
    } catch (e) {
      saveDebugLog('autosave.client_recycle.err', { reason, message: e?.message, name: e?.name });
      pushSaveEvent('autosave_client_recycle_err', 'Supabase client recreate failed', ctx.autosaveEventDetail({ reason, message: e?.message, name: e?.name }));
      return false;
    } finally {
      clientRecycleInFlight = false;
    }
  }

  async function runRecoveryProbeAndMaybeRecycle(trigger) {
    const probe = await runRecoveryProbe(trigger).catch(() => null);
    if (!probe || !probe.ok) return;
    if (ctx.getConsecutiveAutoSaveFailures() === 0) return;
    const clientProbe = await runSupabaseClientProbe(trigger).catch(() => null);
    if (clientProbe && !clientProbe.ok) {
      await recreateSupabaseClient('client_probe_failed:' + trigger).catch(() => {});
    } else if (!clientProbe) {
      await recreateSupabaseClient('client_probe_threw:' + trigger).catch(() => {});
    }
  }

  // Proactively recycle a wedged supabase-js client on a long-idle return (an
  // ACTIVE probe: an idle user has zero autosave failures, so the failure-count
  // trigger never fires). Returns true iff a recycle happened.
  async function recycleClientIfWedgedOnIdleReturn(trigger) {
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabase()) return false;
    const clientProbe = await runSupabaseClientProbe(trigger).catch(() => null);
    if (clientProbe && clientProbe.ok) return false;
    const reason = (clientProbe ? 'idle_return_client_wedged:' : 'idle_return_client_probe_threw:') + trigger;
    return await recreateSupabaseClient(reason).catch(() => false);
  }

  // Raw-fetch fallbacks: when the supabase-js client wedges after sleep, a raw
  // fetch to the same REST endpoint still returns quickly.
  async function rawProjectsUpdate(projectId, payload, signal) {
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabaseUrl() || !ctx.getSupabaseAnonKey()) {
      throw new Error('Supabase not configured');
    }
    const accessToken = ctx.getState().supabaseSession?.access_token || '';
    if (!accessToken) throw new Error('No access token for raw projects update');
    const url = ctx.getSupabaseUrl() + '/rest/v1/projects?id=eq.' + encodeURIComponent(projectId);
    const res = await fetch(url, {
      method: 'PATCH',
      cache: 'no-store',
      signal,
      headers: {
        apikey: ctx.getSupabaseAnonKey(),
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch (_) {}
      const e = new Error('Raw projects update failed: ' + res.status + (body ? (' ' + body.slice(0, 200)) : ''));
      e.status = res.status;
      e.code = 'RAW_UPDATE_HTTP_' + res.status;
      e.diag = extractResponseDiagnostics(res.headers);
      throw e;
    }
    return { ok: true, status: res.status };
  }

  async function rawProjectsInsert(payload, signal) {
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabaseUrl() || !ctx.getSupabaseAnonKey()) {
      return { data: null, error: { message: 'Supabase not configured', status: 0, code: 'RAW_INSERT_NOT_CONFIGURED' } };
    }
    const accessToken = ctx.getState().supabaseSession?.access_token || '';
    if (!accessToken) {
      return { data: null, error: { message: 'No access token for raw projects insert', status: 401, code: 'RAW_INSERT_NO_TOKEN' } };
    }
    const url = ctx.getSupabaseUrl() + '/rest/v1/projects';
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        signal,
        headers: {
          apikey: ctx.getSupabaseAnonKey(),
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      return { data: null, error: { message: (e && e.message) || 'fetch_failed', status: 0, name: e && e.name, code: 'RAW_INSERT_FETCH_ERR' } };
    }
    let body = null;
    let bodyText = '';
    try {
      bodyText = await res.text();
      if (bodyText) body = JSON.parse(bodyText);
    } catch (_) {}
    if (!res.ok) {
      const message = (body && (body.message || body.error)) || ('HTTP ' + res.status + (bodyText ? (' ' + bodyText.slice(0, 200)) : ''));
      return { data: null, error: { message, status: res.status, code: (body && body.code) || ('RAW_INSERT_HTTP_' + res.status), diag: extractResponseDiagnostics(res.headers) } };
    }
    const row = Array.isArray(body) ? body[0] : body;
    return { data: row || null, error: null };
  }

  async function rawCheckInProject(projectId, signal) {
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabaseUrl() || !ctx.getSupabaseAnonKey()) {
      throw new Error('Supabase not configured');
    }
    const accessToken = ctx.getState().supabaseSession?.access_token || '';
    if (!accessToken) throw new Error('No access token for raw check_in_project');
    const url = ctx.getSupabaseUrl() + '/rest/v1/rpc/check_in_project';
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: {
        apikey: ctx.getSupabaseAnonKey(),
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_project_id: projectId })
    });
    let bodyJson = null;
    let bodyText = '';
    try {
      bodyText = await res.text();
      if (bodyText) bodyJson = JSON.parse(bodyText);
    } catch (_) {}
    if (!res.ok) {
      const e = new Error('Raw check_in failed: ' + res.status + (bodyText ? (' ' + bodyText.slice(0, 200)) : ''));
      e.status = res.status;
      e.code = 'RAW_RPC_HTTP_' + res.status;
      e.diag = extractResponseDiagnostics(res.headers);
      return { data: bodyJson, error: e };
    }
    return { data: bodyJson, error: null };
  }

  // Raw-fetch twin of supabase.rpc('list_accessible_projects'); mirrors
  // rawCheckInProject's return contract.
  async function rawListAccessibleProjects(signal) {
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabaseUrl() || !ctx.getSupabaseAnonKey()) {
      throw new Error('Supabase not configured');
    }
    const accessToken = ctx.getState().supabaseSession?.access_token || '';
    if (!accessToken) throw new Error('No access token for raw list_accessible_projects');
    const url = ctx.getSupabaseUrl() + '/rest/v1/rpc/list_accessible_projects';
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: {
        apikey: ctx.getSupabaseAnonKey(),
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    let bodyJson = null;
    let bodyText = '';
    try {
      bodyText = await res.text();
      if (bodyText) bodyJson = JSON.parse(bodyText);
    } catch (_) {}
    if (!res.ok) {
      const e = new Error('Raw list_accessible_projects failed: ' + res.status + (bodyText ? (' ' + bodyText.slice(0, 200)) : ''));
      e.status = res.status;
      e.code = 'RAW_RPC_HTTP_' + res.status;
      e.diag = extractResponseDiagnostics(res.headers);
      return { data: bodyJson, error: e };
    }
    return { data: bodyJson, error: null };
  }

  function getLastSupabaseJsFailureAt() { return lastSupabaseJsFailureAt; }
  function getClientRecycleCount() { return clientRecycleCountThisRun; }
  function isClientRecycleInFlight() { return clientRecycleInFlight; }
  function resetClientRecycleCount() { clientRecycleCountThisRun = 0; }
  function resetRecycleState() { clientRecycleCountThisRun = 0; lastClientRecycleAt = 0; }

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
    const probe = await probeCheckoutLock();
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
    // Stage 3: storage ring
    probeCheckoutLock,
    sha256Hex,
    takeoffBackupGet,
    takeoffBackupPut,
    writeTakeoffStateBackup,
    writeTakeoffBackupToIndexedDB,
    scheduleTakeoffBackup,
    getLastLocalBackupAt,
    getLastLocalBackupOk,
    setLastLocalBackupAt,
    resetLocalBackupState,
    // Stage 4: client resilience
    noteSupabaseJsFailure,
    runRecoveryProbe,
    runSupabaseClientProbe,
    recreateSupabaseClient,
    runRecoveryProbeAndMaybeRecycle,
    recycleClientIfWedgedOnIdleReturn,
    rawProjectsUpdate,
    rawProjectsInsert,
    rawCheckInProject,
    rawListAccessibleProjects,
    getLastSupabaseJsFailureAt,
    getClientRecycleCount,
    isClientRecycleInFlight,
    resetClientRecycleCount,
    resetRecycleState,
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

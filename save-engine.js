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
 * ctx contract (grown per stage; Stage 6 graduated every entry that only
 * existed to reach the then-app-side save paths — getAutoSaveDirty/set,
 * autosaveEventDetail, noteSupabaseCallOk, getConsecutiveAutoSaveFailures,
 * clearAutoSaveBackoff, isSaveInProgress, getInFlightAutoSavePromise,
 * getLastSuccessfulSupabaseCallAt, performAutoSave,
 * uploadLocalPdfToCloudIfNeeded, setPdfUploadProgressHandler,
 * setLastCloudSaveAttemptFailed, captureNetworkInfoDetail — the engine owns
 * that state now):
 *   getState()                        -> the live state object
 *   getSupabase()                     -> current supabase client (recycled)
 *   setSupabase(client)               -> reassign the app-side client let
 *   isSupabaseEnabled()               -> SUPABASE_ENABLED
 *   getSupabaseUrl() / getSupabaseAnonKey()
 *   withTimeout(promise, ms, label)   -> app.js timeout wrapper
 *   isAutoSaveSuspended()             -> suspendAutoSaveUntilCheckout
 *   getLastCheckoutRefreshAt() / setLastCheckoutRefreshAt(ms)
 *   getLastModifiedAt() / setLastModifiedAt(ms)
 *   invalidateFooterTotals()
 *   isCheckoutExpiredAttention()
 *   setCheckoutExpiredAttention()     -> needsAttention + suspend, both true
 *   clearCheckoutExpiredAttention()   -> app-side attention-flag reset
 *   suspendAutoSave()                 -> suspendAutoSaveUntilCheckout = true
 *   updateServerClockFromRpc(data)
 *   serverNowMs()                     -> skew-corrected clock
 *   getServerClockOffsetMs()          -> raw offset for the export envelope
 *   perfLog(label, ms, extra)         -> [Perf] console line
 *   getUserCustomIcons()              -> user icon list for backup/save blobs
 *   computePageBakeFrame(page)        -> orientation stamp
 *   getMaxZoom()                      -> render-core zoom cap for save blobs
 *   assertPdfWithinLimit(bytes, context) -> size-cap check (app-side, shared
 *      with the Prepare PDF feature)
 *   maybeLogProjectSaveEvent(projectId) -> user-activity dedupe logger
 *   captureDisplayInfoObj()           -> render-core diagnostics (canvas dims)
 *   setLastSaveIncludedPdf(v)         -> app-side UI flag (load paths write it)
 *   setTurnInProgress(label)          -> Turn In banner UI
 *   showToast(msg, ms)                -> toast UI
 *   updateUI() / updateStatus() / updateSaveStatusIndicator()
 *   updateSettingsCheckoutSection()   -> settings-modal checkout row
 *   isAuthError(e)                    -> app-side auth-error classifier
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
    const wasDirty = autoSaveDirty;
    autoSaveDirty = true;
    dirtyGeneration++;
    ctx.setLastModifiedAt(Date.now());
    if (!wasDirty) dirtyStartedAt = Date.now();
    ctx.invalidateFooterTotals();
    if (ctx.isSupabaseEnabled() && state.supabaseSession?.user && !state.isViewer) {
      const now = Date.now();
      if (now - saveStatusDirtyLogAt >= 2000) {
        saveStatusDirtyLogAt = now;
        pushSaveEvent('dirty', 'Project marked dirty (pending cloud sync)', autosaveEventDetail({ dirtyForMs: dirtyStartedAt ? (now - dirtyStartedAt) : 0 }));
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
        noteSupabaseCallOk();
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
      rooms: state.rooms || [],
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
      numberKeyBindings: state.numberKeyBindings || {},
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
      pushSaveEvent('sbjs_failure_recorded', 'Supabase-js call failed (raw-fetch may be safer)', autosaveEventDetail({
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
    saveDebugLog('autosave.recovery.start', { runId, trigger, failures: consecutiveAutoSaveFailures });
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
        nextAutoSaveAttemptAt = 0;
        noteSupabaseCallOk();
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
      pushSaveEvent('autosave_client_probe_ok', 'Supabase client responsive', autosaveEventDetail({ trigger, ms }));
      noteSupabaseCallOk();
    } else {
      saveDebugLog('autosave.client_probe.err', { trigger, ms, message: errMsg, name: errName });
      pushSaveEvent('autosave_client_probe_err', 'Supabase client appears wedged', autosaveEventDetail({ trigger, ms, message: errMsg, name: errName }));
      noteSupabaseJsFailure('client_probe', { message: errMsg, name: errName, status: errStatus, code: errCode });
    }
    return { ok, ms, errMsg };
  }

  async function recreateSupabaseClient(reason) {
    if (!ctx.isSupabaseEnabled() || typeof window.supabase === 'undefined') return false;
    if (clientRecycleInFlight) {
      saveDebugLog('autosave.client_recycle.skip', { reason, why: 'in_flight' });
      pushSaveEvent('client_recycle_skipped_inflight', 'Client recycle skipped (already running)', autosaveEventDetail({ reason }));
      return false;
    }
    if (Date.now() - lastClientRecycleAt < CLIENT_RECYCLE_COOLDOWN_MS) {
      saveDebugLog('autosave.client_recycle.skip', { reason, why: 'cooldown' });
      pushSaveEvent('client_recycle_skipped_cooldown', 'Client recycle skipped (cooldown)', autosaveEventDetail({ reason, msSinceLastRecycle: Date.now() - lastClientRecycleAt, cooldownMs: CLIENT_RECYCLE_COOLDOWN_MS }));
      return false;
    }
    clientRecycleInFlight = true;
    const t0 = Date.now();
    const state = ctx.getState();
    const previousSession = state.supabaseSession || null;
    let resubscribed = false;
    try {
      try { const prev = ctx.getSupabase(); if (prev) await prev.removeAllChannels(); } catch (_) {}
      // The old client's channels are gone; drop the engine's handle so the
      // re-subscribe below builds a fresh one on the new client (Stage 5: the
      // subscription cluster is engine-internal, ex-ctx.onCheckoutChannelDropped).
      projectsCheckoutChannel = null;
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
          subscribeToProjectCheckoutChanges(state.currentProjectId);
          resubscribed = true;
        } catch (rtErr) {
          saveDebugLog('autosave.client_recycle.resubscribe_err', { reason, message: rtErr?.message });
        }
      }
      lastClientRecycleAt = Date.now();
      clientRecycleCountThisRun++;
      const elapsedMs = Date.now() - t0;
      saveDebugLog('autosave.client_recycle.ok', { reason, elapsedMs, resubscribed });
      pushSaveEvent('autosave_client_recycled', 'Supabase client recreated', autosaveEventDetail({ reason, elapsedMs, resubscribed, recycleCount: clientRecycleCountThisRun }));
      return true;
    } catch (e) {
      saveDebugLog('autosave.client_recycle.err', { reason, message: e?.message, name: e?.name });
      pushSaveEvent('autosave_client_recycle_err', 'Supabase client recreate failed', autosaveEventDetail({ reason, message: e?.message, name: e?.name }));
      return false;
    } finally {
      clientRecycleInFlight = false;
    }
  }

  async function runRecoveryProbeAndMaybeRecycle(trigger) {
    const probe = await runRecoveryProbe(trigger).catch(() => null);
    if (!probe || !probe.ok) return;
    if (consecutiveAutoSaveFailures === 0) return;
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
  function isSbJsRecentlyBad() { return lastSupabaseJsFailureAt > 0 && Date.now() - lastSupabaseJsFailureAt < 5 * 60 * 1000; }
  function getClientRecycleCount() { return clientRecycleCountThisRun; }
  function isClientRecycleInFlight() { return clientRecycleInFlight; }
  function resetClientRecycleCount() { clientRecycleCountThisRun = 0; }
  function resetRecycleState() { clientRecycleCountThisRun = 0; lastClientRecycleAt = 0; }

  // --- [sync] Checkout subscription & permission refresh (Stage 5) --------
  // Engine-owned: the realtime channel handle, its reconnect timer/backoff
  // attempt counter, and the subscription generation (stale-callback guard).
  let projectsCheckoutChannel = null;
  let projectsCheckoutReconnectTimer = null;
  let projectsCheckoutReconnectAttempt = 0;
  let projectsCheckoutGeneration = 0;

  function clearProjectsCheckoutReconnectTimer() {
    if (projectsCheckoutReconnectTimer) {
      clearTimeout(projectsCheckoutReconnectTimer);
      projectsCheckoutReconnectTimer = null;
    }
  }

  function scheduleProjectsCheckoutReconnect(projectId) {
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabase() || !projectId) return;
    if (projectsCheckoutReconnectTimer) return;
    const idx = Math.min(projectsCheckoutReconnectAttempt, PROJECTS_CHECKOUT_RECONNECT_BACKOFF_MS.length - 1);
    const delay = PROJECTS_CHECKOUT_RECONNECT_BACKOFF_MS[idx];
    projectsCheckoutReconnectAttempt += 1;
    saveDebugLog('realtime.checkout.reconnect.schedule', { projectId, attempt: projectsCheckoutReconnectAttempt, delayMs: delay });
    const scheduledGen = projectsCheckoutGeneration;
    projectsCheckoutReconnectTimer = setTimeout(() => {
      projectsCheckoutReconnectTimer = null;
      if (scheduledGen === projectsCheckoutGeneration && ctx.getState().currentProjectId === projectId) {
        subscribeToProjectCheckoutChanges(projectId);
      }
    }, delay);
  }

  async function subscribeToProjectCheckoutChanges(projectId) {
    const gen = ++projectsCheckoutGeneration;
    clearProjectsCheckoutReconnectTimer();
    const state = ctx.getState();
    const supabase = ctx.getSupabase();
    if (projectsCheckoutChannel && supabase) {
      const old = projectsCheckoutChannel;
      projectsCheckoutChannel = null;
      try { await supabase.removeChannel(old); } catch (_) {}
    }
    if (gen !== projectsCheckoutGeneration) return;
    if (!ctx.isSupabaseEnabled() || !supabase || !projectId || !state.supabaseSession?.user) {
      projectsCheckoutReconnectAttempt = 0;
      return;
    }
    projectsCheckoutChannel = supabase
      .channel('projects-checkout-' + projectId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: 'id=eq.' + projectId
      }, function() {
        if (gen !== projectsCheckoutGeneration) return;
        refreshProjectPermissions();
      })
      .subscribe((status, err) => {
        if (gen !== projectsCheckoutGeneration) return;
        saveDebugLog('realtime.checkout.status', { projectId, status, message: err?.message });
        if (status === 'SUBSCRIBED') {
          projectsCheckoutReconnectAttempt = 0;
          clearProjectsCheckoutReconnectTimer();
          refreshProjectPermissions().catch(() => {});
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleProjectsCheckoutReconnect(projectId);
        }
      });
  }

  async function refreshProjectPermissions() {
    const state = ctx.getState();
    const supabase = ctx.getSupabase();
    if (!supabase || !state.currentProjectId || !state.supabaseSession?.user) return;
    const prevCanCheckOut = state.canCheckOut;
    const prevCheckedOutEmail = state.checkedOutEmail;
    const prevWasCheckedOut = state.checkedOutBy === state.supabaseSession?.user?.id;
    let projects = null;
    let error = null;
    // When the supabase-js client has wedged recently (a frequent post-sleep /
    // post-background failure mode), skip it and hit the REST endpoint with raw
    // fetch -- which keeps returning sub-second while supabase-js hangs to the
    // full timeout. Same pattern Turn In uses for check_in_project.
    for (let attempt = 0; attempt < 2; attempt++) {
      const useRaw = isSbJsRecentlyBad() || attempt > 0;
      try {
        const r = useRaw
          ? await ctx.withTimeout((signal) => rawListAccessibleProjects(signal), REFRESH_PERMISSIONS_TIMEOUT_MS, 'list_accessible_projects')
          : await ctx.withTimeout(supabase.rpc('list_accessible_projects'), REFRESH_PERMISSIONS_TIMEOUT_MS, 'list_accessible_projects');
        projects = r.data;
        error = r.error;
      } catch (e) {
        projects = null;
        error = e;
      }
      if (!error && projects) break;
      // A supabase-js timeout/error here is the most reliable "client is wedged"
      // signal we get -- record it so other sync paths (Turn In) proactively
      // prefer raw fetch instead of each eating a full timeout first. Previously
      // these 10+/hour timeouts were dropped on the floor, so Turn In had no idea
      // the client was wedged and hung the full check-in timeout before retrying.
      if (error && !useRaw) noteSupabaseJsFailure('list_accessible_projects', error);
      if (attempt === 0) await new Promise(r2 => setTimeout(r2, 500));
    }
    if (error || !projects) {
      try { pushSaveEvent('refresh_permissions_err', 'refreshProjectPermissions failed', (error && (error.message || String(error))) || 'no data returned'); } catch (_) {}
      return;
    }
    const proj = projects.find(function(p) { return p.id === state.currentProjectId; });
    if (!proj) {
      try { pushSaveEvent('permissions_project_missing', 'You no longer have access to this project', JSON.stringify({ projectId: state.currentProjectId })); } catch (_) {}
      state.isViewer = true;
      state.canCheckOut = false;
      state.checkedOutBy = null;
      state.checkedOutAt = null;
      state.checkedOutEmail = null;
      ctx.suspendAutoSave();
      try { ctx.showToast('You no longer have access to this project.', 5000); } catch (_) {}
      try { ctx.updateUI(); ctx.updateStatus(); ctx.updateSaveStatusIndicator(); } catch (_) {}
      return;
    }
    const willBecomeViewer = prevWasCheckedOut && !proj.can_edit;
    const hadDirty = autoSaveDirty;
    const hadInflight = saveInProgress;
    if (willBecomeViewer && hadDirty && !hadInflight) {
      if (ctx.isAutoSaveSuspended()) {
        try { pushSaveEvent('force_turn_in_flush_skipped_suspended', 'Force turn-in flush skipped: autosave suspended pending re-checkout'); } catch (_) {}
      } else {
      performAutoSave()
        .then((res) => {
          if (res && res.ok === false) {
            const code = res.error?.code || res.error?.details || '';
            const msg  = res.error?.message || String(res.error || '');
            const lockedOut =
              code === 'CHECKOUT_EXPIRED' ||
              code === 'CHECKOUT_NOT_OWNED' ||
              code === '42501' ||
              /not[_ ]?owned|checked[_ ]?out|permission/i.test(msg);
            if (lockedOut) {
              pushSaveEvent('force_turn_in_flush_blocked', 'Force turn-in: unsaved edits could not be flushed (lock taken)', msg);
            } else {
              pushSaveEvent('force_turn_in_flush_err', 'Force turn-in: flush errored', msg);
            }
            autoSaveDirty = true;
            lastCloudSaveAttemptFailed = true;
            ctx.updateSaveStatusIndicator();
          }
        })
        .catch((err) => {
          pushSaveEvent('force_turn_in_flush_err', 'Force turn-in: flush threw', err?.message || String(err));
          autoSaveDirty = true;
          lastCloudSaveAttemptFailed = true;
          ctx.updateSaveStatusIndicator();
        });
      }
    }
    state.checkedOutBy = proj.checked_out_by || null;
    state.checkedOutAt = proj.checked_out_at || null;
    state.checkedOutEmail = proj.checked_out_email || null;
    state.loadedViaViewLink = false;
    state.isViewer = !proj.can_edit;
    state.canCheckOut = proj.can_check_out || false;
    ctx.updateUI();
    ctx.updateStatus();
    if (prevWasCheckedOut && state.isViewer) {
      pushSaveEvent('force_turn_in', hadDirty ? 'Force turn-in with unsaved edits' : 'Force turn-in');
      if (hadDirty) {
        ctx.showToast('Project was turned in by another user. Unsaved edits may have been lost - check Save status (bell).', 6000);
      } else {
        ctx.showToast('Project was turned in. You can check out to edit again.');
      }
    } else if (!prevCanCheckOut && state.canCheckOut) {
      if (prevCheckedOutEmail) {
        ctx.showToast('Project is now available. You can check out to edit.');
      } else {
        ctx.showToast('You have been promoted to editor. You can now check out to edit.');
      }
    }
  }

  // --- [sync] Checkout expired recovery (Stage 5) -------------------------
  // Engine-owned: the re-checkout in-flight guard, the auto-recheckout
  // rate-limit state (per-project count + cap stamp + global min-gap), the
  // background-expiry in-flight guard, the one-shot expired toast, and the
  // recovery-save promise Turn In awaits. The recovery MODAL (open/apply/
  // close + its button wiring) stays in app.js; the engine only reports
  // outcomes and flips the app-side attention flags via ctx.
  let checkoutExpiredRecoveryInFlight = false;
  const autoRecheckoutCountByProject = new Map();
  const autoRecheckoutCapReachedAt = new Map();
  let lastAutoRecheckoutAt = 0;
  let backgroundCheckoutExpiredInFlight = false;
  let checkoutExpiredToastShown = false;
  let inFlightRecoverySavePromise = null;

  // Best-effort "how long ago did the checkout expire" for the recovery modal
  // + telemetry: earliest of (checkedOutAt + inactivity window), the last
  // expiry event in the engine log, and (last successful call + window).
  function computeCheckoutExpiryAgeMs() {
    const state = ctx.getState();
    const candidates = [];
    if (state.checkedOutAt) {
      const t = new Date(state.checkedOutAt).getTime();
      if (Number.isFinite(t) && t > 0) candidates.push(t + CHECKOUT_INACTIVITY_MS);
    }
    try {
      for (let i = saveStatusLog.length - 1; i >= 0; i--) {
        const ev = saveStatusLog[i];
        if (ev && (ev.kind === 'checkout_expired' || ev.kind === 'keepalive_expired')) {
          candidates.push(ev.ts);
          break;
        }
      }
    } catch (_) {}
    const lastOk = lastSuccessfulSupabaseCallAt;
    if (lastOk > 0) candidates.push(lastOk + CHECKOUT_INACTIVITY_MS);
    if (!candidates.length) return 0;
    const expiredAt = Math.min(...candidates);
    const age = Date.now() - expiredAt;
    return age > 0 ? age : 0;
  }

  async function reCheckOutAfterExpiry(trigger, opts) {
    opts = opts || {};
    const silent = !!opts.silent;
    const state = ctx.getState();
    const supabase = ctx.getSupabase();
    if (!state.currentProjectId || !supabase) return { ok: false, error: 'No project' };
    if (checkoutExpiredRecoveryInFlight) return { ok: false, error: 'Re-check out already in progress' };
    checkoutExpiredRecoveryInFlight = true;
    const tStart = Date.now();
    const ageMsAtStart = computeCheckoutExpiryAgeMs();
    try {
      let data = null, error = null;
      try {
        const r = await ctx.withTimeout(
          supabase.rpc('check_out_project', { p_project_id: state.currentProjectId }),
          CHECK_IN_TIMEOUT_MS,
          'Re-check out'
        );
        data = r.data;
        error = r.error;
      } catch (e) {
        error = e;
      }
      ctx.updateServerClockFromRpc(data);
      const result = data || (error ? { ok: false, error: error.message } : { ok: false });
      if (result.ok) {
        const wasDirty = autoSaveDirty;
        ctx.clearCheckoutExpiredAttention();
        state.checkedOutBy = state.supabaseSession?.user?.id;
        state.checkedOutAt = result.checked_out_at || new Date().toISOString();
        ctx.setLastCheckoutRefreshAt(Date.now());
        state.isViewer = false;
        state.canCheckOut = false;
        pushSaveEvent('checkout_recovered', 'Re-checked out after expiry', JSON.stringify({
          trigger: trigger || 'unknown',
          msSinceExpiry: ageMsAtStart,
          elapsedMs: Date.now() - tStart,
          dirty: wasDirty
        }));
        saveDebugLog('checkoutRecovery.ok', { trigger, msSinceExpiry: ageMsAtStart, dirty: wasDirty });
        ctx.updateSettingsCheckoutSection();
        ctx.updateUI();
        ctx.updateStatus();
        refreshProjectPermissions().catch(() => {});
        if (!silent) {
          try { if (state.currentProjectId) resetAutoRecheckoutCounter(state.currentProjectId); } catch (_) {}
        }
        if (wasDirty) {
          const recoverySavePromise = performAutoSave('checkout_recovered').catch((e) => ({ ok: false, error: e }));
          inFlightRecoverySavePromise = recoverySavePromise;
          recoverySavePromise.finally(() => { if (inFlightRecoverySavePromise === recoverySavePromise) inFlightRecoverySavePromise = null; });
          try { await recoverySavePromise; } catch (_) {}
          if (!silent) ctx.showToast('Re-checked out. Saving your edits...');
        } else {
          if (!silent) ctx.showToast('Project checked out. You can now edit.');
        }
        return { ok: true };
      }
      await refreshProjectPermissions().catch(() => {});
      const errMsg = (error && error.message) || result.error || 'Re-check out failed';
      const otherEmail = state.checkedOutEmail || null;
      if (otherEmail && state.checkedOutBy && state.checkedOutBy !== state.supabaseSession?.user?.id) {
        pushSaveEvent('checkout_recover_blocked', 'Cannot re-check out: someone else has it', JSON.stringify({
          trigger: trigger || 'unknown',
          otherEmail,
          elapsedMs: Date.now() - tStart
        }));
        saveDebugLog('checkoutRecovery.blocked', { trigger, otherEmail });
        ctx.updateUI();
        return { ok: false, otherEmail, error: errMsg };
      }
      pushSaveEvent('checkout_recover_err', 'Re-check out failed', JSON.stringify({
        trigger: trigger || 'unknown',
        message: errMsg,
        status: error && error.status,
        elapsedMs: Date.now() - tStart
      }));
      saveDebugLog('checkoutRecovery.err', { trigger, message: errMsg });
      ctx.updateUI();
      return { ok: false, error: errMsg };
    } finally {
      checkoutExpiredRecoveryInFlight = false;
    }
  }

  function resetAutoRecheckoutCounter(projectId) {
    if (projectId) {
      autoRecheckoutCountByProject.delete(projectId);
      autoRecheckoutCapReachedAt.delete(projectId);
    } else {
      autoRecheckoutCountByProject.clear();
      autoRecheckoutCapReachedAt.clear();
    }
    lastAutoRecheckoutAt = 0;
  }

  async function tryAutoRecheckoutIfAllowed(detectionTrigger) {
    const trigger = detectionTrigger || 'unknown';
    const state = ctx.getState();
    const projectId = state.currentProjectId;
    if (!projectId || !ctx.getSupabase()) {
      pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: no project', JSON.stringify({ trigger, reason: 'no_project' }));
      return { skipped: true, reason: 'no_project' };
    }
    if (state.isViewer) {
      pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: viewer', JSON.stringify({ trigger, reason: 'viewer' }));
      return { skipped: true, reason: 'viewer' };
    }
    if (Date.now() - lastAutoRecheckoutAt < AUTO_RECHECKOUT_MIN_GAP_MS) {
      pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: too soon after previous attempt', JSON.stringify({ trigger, reason: 'min_gap', sinceLastMs: Date.now() - lastAutoRecheckoutAt }));
      return { skipped: true, reason: 'min_gap' };
    }
    let count = autoRecheckoutCountByProject.get(projectId) || 0;
    if (count >= AUTO_RECHECKOUT_MAX_PER_PROJECT) {
      const capReachedAt = autoRecheckoutCapReachedAt.get(projectId) || 0;
      if (capReachedAt && Date.now() - capReachedAt > AUTO_RECHECKOUT_COOLDOWN_MS) {
        autoRecheckoutCountByProject.set(projectId, 0);
        autoRecheckoutCapReachedAt.delete(projectId);
        count = 0;
        pushSaveEvent('auto_recheckout_cooldown_reset', 'Per-project auto-recheckout cap reset after cool-down',
          JSON.stringify({ trigger, projectId, cooldownMs: AUTO_RECHECKOUT_COOLDOWN_MS }));
      } else {
        if (!capReachedAt) autoRecheckoutCapReachedAt.set(projectId, Date.now());
        const stamp = capReachedAt || Date.now();
        pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: cap reached',
          JSON.stringify({
            trigger,
            reason: 'cap_reached',
            count,
            cap: AUTO_RECHECKOUT_MAX_PER_PROJECT,
            projectId,
            cooldownRemainingMs: Math.max(0, AUTO_RECHECKOUT_COOLDOWN_MS - (Date.now() - stamp))
          }));
        return { skipped: true, reason: 'cap_reached' };
      }
    }
    const tStart = Date.now();
    pushSaveEvent('auto_recheckout_attempt', 'Attempting silent re-check out', JSON.stringify({ trigger, count, projectId }));
    try {
      await refreshProjectPermissions();
    } catch (_) {}
    const selfId = state.supabaseSession?.user?.id;
    const heldByOther = state.checkedOutBy && selfId && state.checkedOutBy !== selfId;
    if (!state.canCheckOut || heldByOther) {
      pushSaveEvent('auto_recheckout_blocked', 'Auto re-check out skipped: not allowed', JSON.stringify({
        trigger,
        reason: 'not_allowed',
        canCheckOut: !!state.canCheckOut,
        heldByOther: !!heldByOther,
        otherEmail: state.checkedOutEmail || null
      }));
      return { skipped: true, reason: 'not_allowed', otherEmail: state.checkedOutEmail || null };
    }
    lastAutoRecheckoutAt = Date.now();
    const result = await reCheckOutAfterExpiry('auto_' + trigger, { silent: true });
    const elapsedMs = Date.now() - tStart;
    const isTransient = result && !result.ok && typeof isTransientSaveError === 'function' && isTransientSaveError({ message: (result.error || '').toString() });
    if (result && result.ok) {
      autoRecheckoutCountByProject.set(projectId, count + 1);
      pushSaveEvent('auto_recheckout_ok', 'Silent re-check out succeeded', JSON.stringify({
        trigger,
        count: count + 1,
        cap: AUTO_RECHECKOUT_MAX_PER_PROJECT,
        elapsedMs,
        projectId
      }));
      return { ok: true };
    }
    if (!isTransient) autoRecheckoutCountByProject.set(projectId, count + 1);
    pushSaveEvent('auto_recheckout_err', 'Silent re-check out failed', JSON.stringify({
      trigger,
      count: isTransient ? count : count + 1,
      message: (result && result.error) || 'unknown',
      otherEmail: (result && result.otherEmail) || null,
      transient: !!isTransient,
      elapsedMs
    }));
    return { ok: false, error: (result && result.error) || 'Auto re-check out failed', otherEmail: (result && result.otherEmail) || null };
  }

  // Background expiry entry point (keepalive / autosave / visibility probe /
  // manual-save preflight). When Supabase is disabled this preserves the old
  // app-side no-op forward declaration's contract.
  async function handleBackgroundCheckoutExpired(trigger) {
    if (!ctx.isSupabaseEnabled()) {
      return { silentlyRecovered: false, reason: 'supabase_disabled' };
    }
    if (backgroundCheckoutExpiredInFlight) {
      try { saveDebugLog('checkoutExpired.skip_inflight', { trigger }); } catch (_) {}
      return { silentlyRecovered: false, reason: 'already_handling' };
    }
    backgroundCheckoutExpiredInFlight = true;
    try {
      pushSaveEvent('checkout_expired', CHECKOUT_EXPIRED_SAVE_STATUS_MSG, JSON.stringify({ trigger }));
      ctx.setCheckoutExpiredAttention();
      ctx.updateSaveStatusIndicator();
      const auto = await tryAutoRecheckoutIfAllowed(trigger);
      if (auto && auto.ok) return { silentlyRecovered: true };
      if (!checkoutExpiredToastShown) {
        ctx.showToast(CHECKOUT_EXPIRED_TOAST_MSG, 6000);
        checkoutExpiredToastShown = true;
      }
      ctx.updateUI();
      return { silentlyRecovered: false, reason: auto && auto.reason };
    } finally {
      backgroundCheckoutExpiredInFlight = false;
    }
  }

  // app.js clearCheckoutExpiredAttention resets the app-side attention flags
  // and re-arms the one-shot expired toast through this.
  function clearCheckoutExpiredToastShown() { checkoutExpiredToastShown = false; }

  // --- [sync] Turn In core (Stage 5) --------------------------------------
  // Engine-owned: the Turn In in-flight guard. The result-handling UX
  // (doTurnInAndHandleResult / tryTurnIn: recovery-modal short-circuit,
  // toasts, settings-modal wiring) stays in app.js and calls doTurnIn().
  let turnInInProgress = false;

  async function doTurnIn() {
    if (turnInInProgress) {
      saveDebugLog('turnIn.skip', { reason: 'already_in_progress' });
      return { ok: false, error: 'Turn In is already running' };
    }
    if (inFlightRecoverySavePromise) {
      try {
        saveDebugLog('turnIn.awaitRecovery', {});
        pushSaveEvent('turn_in_await_recovery', 'Turn In waiting for recovery save to complete');
        await Promise.race([
          inFlightRecoverySavePromise,
          new Promise(r => setTimeout(r, 8000))
        ]);
      } catch (_) {}
    }
    turnInInProgress = true;
    const state = ctx.getState();
    const tTurnIn = Date.now();
    let currentStage = 'start';
    let stageStartedAt = Date.now();
    let checkInAttempt = 0;
    let usedRawFetchForCheckIn = false;
    const progress = (stage, label) => {
      if (currentStage && currentStage !== 'start') {
        pushSaveEvent('turn_in_phase_done', currentStage + ' done', JSON.stringify({ stage: currentStage, durationMs: Date.now() - stageStartedAt, elapsedMs: Date.now() - tTurnIn }));
      }
      currentStage = stage;
      stageStartedAt = Date.now();
      ctx.setTurnInProgress(label);
      pushSaveEvent('turn_in_stage', label, JSON.stringify({ stage, elapsedMs: Date.now() - tTurnIn }));
    };
    const errDetail = (e) => {
      try {
        return JSON.stringify(Object.assign(serializeSaveError(e) || {}, {
          elapsedMs: Date.now() - tTurnIn,
          stage: currentStage,
          attempt: checkInAttempt,
          online: (typeof navigator !== 'undefined') ? navigator.onLine : null,
          network: captureNetworkInfoDetail() || null
        }));
      } catch (_) { return formatSaveStatusErrDetail(e); }
    };
    try {
      if (!state.currentProjectId || !ctx.getSupabase()) return { ok: false, error: 'No project' };
      pushSaveEvent('turn_in_start', 'Turn In started', JSON.stringify({
        onLine: (typeof navigator !== 'undefined') ? navigator.onLine : null,
        network: captureNetworkInfoDetail() || null,
        lastOk: lastSuccessfulSupabaseCallAt,
        failures: consecutiveAutoSaveFailures,
        dirty: autoSaveDirty,
        saveInProgress: saveInProgress,
        projectId: state.currentProjectId
      }));
      const looksStale = consecutiveAutoSaveFailures > 0 ||
        (lastSuccessfulSupabaseCallAt > 0 && Date.now() - lastSuccessfulSupabaseCallAt > TURN_IN_STALENESS_MS) ||
        lastSuccessfulSupabaseCallAt === 0 ||
        isSbJsRecentlyBad();
      if (looksStale) {
        progress('pre_probe', 'Checking connection…');
        saveDebugLog('turnIn.preProbe', { failures: consecutiveAutoSaveFailures, lastOk: lastSuccessfulSupabaseCallAt });
        const probe = await runRecoveryProbe('turn_in_pre').catch(() => null);
        if (probe && !probe.ok && probe.errMsg !== 'in_flight') {
          pushSaveEvent('turn_in_pre_probe_failed', 'Connection seems offline; Turn In aborted (saved locally)', JSON.stringify({ ms: probe.ms, status: probe.status, message: probe.errMsg, elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
          return { ok: false, error: 'Connection offline. Saved locally; try Turn In again in a moment.' };
        }
      }
      progress('local_backup', 'Saving local backup…');
      await writeTakeoffStateBackup();
      const hadAutoSave = autoSaveDirty;
      // If this project has a local PDF that never reached cloud storage,
      // upload it as part of Turn In so the PDF doesn't get left behind.
      const needsPdfUpload = state.pages.length > 0 && !state.pdfStoragePath && !state.isViewer;
      if (needsPdfUpload) {
        if (saveInProgress) {
          saveDebugLog('turnIn.skip', { reason: 'save_in_progress' });
          pushSaveEvent('turn_in_save_in_progress', 'Turn In skipped: sync still in progress', JSON.stringify({ elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
          return { ok: false, error: 'Sync in progress, try again in a moment' };
        }
        progress('sync_to_cloud', 'Uploading PDF to cloud…');
        // Show determinate upload progress in the Turn In banner (resumable
        // path emits byte progress; the standard path stays on the plain label).
        onPdfUploadProgress = (sent, total) => {
          const pct = (total > 0) ? Math.min(100, Math.floor((sent / total) * 100)) : 0;
          ctx.setTurnInProgress('Uploading PDF to cloud… ' + pct + '%');
        };
        let pdfResult;
        try {
          pdfResult = await uploadLocalPdfToCloudIfNeeded('turn_in', { ignoreBackoff: true });
        } finally {
          onPdfUploadProgress = null;
        }
        if (pdfResult && pdfResult.skipped) {
          // No usable PDF buffer in memory or cache (detached + unrecoverable),
          // or some other skip. Don't strand the user: fall back to a
          // canvas-only save when dirty, warn, and continue releasing the lock.
          if (autoSaveDirty) {
            const saveResult = await performAutoSave();
            if (!saveResult.ok) {
              pushSaveEvent(
                'turn_in_blocked_by_save_err',
                'Turn In blocked: autosave failed before check-in',
                JSON.stringify({ message: (saveResult.error && saveResult.error.message) || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage })
              );
              if (ctx.isAuthError(saveResult.error)) return { ok: false, error: 'Refresh the page to sync.' };
              if (saveResult.error?.code === 'CHECKOUT_EXPIRED') return { ok: false, code: 'CHECKOUT_EXPIRED', error: CHECKOUT_EXPIRED_SAVE_STATUS_MSG };
              return { ok: false, error: (saveResult.error && saveResult.error.message) || 'Save failed' };
            }
          }
          if (pdfResult.reason === 'no_usable_buffer') {
            ctx.showToast('PDF couldn’t be uploaded — reopen the project to attach it.', 4000);
          }
        } else if (pdfResult && !pdfResult.ok) {
          pushSaveEvent(
            'turn_in_blocked_by_save_err',
            'Turn In blocked: PDF upload failed before check-in',
            JSON.stringify({ message: (pdfResult.error && pdfResult.error.message) || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage })
          );
          if (ctx.isAuthError(pdfResult.error)) return { ok: false, error: 'Refresh the page to sync.' };
          if (pdfResult.error?.code === 'CHECKOUT_EXPIRED') return { ok: false, code: 'CHECKOUT_EXPIRED', error: CHECKOUT_EXPIRED_SAVE_STATUS_MSG };
          return { ok: false, error: (pdfResult.error && pdfResult.error.message) || 'Save failed' };
        }
      } else if (autoSaveDirty) {
        if (saveInProgress) {
          saveDebugLog('turnIn.skip', { reason: 'save_in_progress' });
          pushSaveEvent('turn_in_save_in_progress', 'Turn In skipped: sync still in progress', JSON.stringify({ elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
          return { ok: false, error: 'Sync in progress, try again in a moment' };
        }
        progress('sync_to_cloud', 'Syncing edits to cloud…');
        const saveResult = await performAutoSave();
        if (!saveResult.ok) {
          pushSaveEvent(
            'turn_in_blocked_by_save_err',
            'Turn In blocked: autosave failed before check-in',
            JSON.stringify({ message: (saveResult.error && saveResult.error.message) || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage })
          );
          if (ctx.isAuthError(saveResult.error)) return { ok: false, error: 'Refresh the page to sync.' };
          if (saveResult.error?.code === 'CHECKOUT_EXPIRED') return { ok: false, code: 'CHECKOUT_EXPIRED', error: CHECKOUT_EXPIRED_SAVE_STATUS_MSG };
          return { ok: false, error: (saveResult.error && saveResult.error.message) || 'Save failed' };
        }
      }
      if (inFlightAutoSavePromise && saveInProgress) {
        const tAwait = Date.now();
        pushSaveEvent('turn_in_await_inflight_autosave', 'Turn In waiting briefly for in-flight autosave', JSON.stringify({ elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
        try {
          await Promise.race([
            inFlightAutoSavePromise,
            new Promise(r => setTimeout(r, 3000))
          ]);
        } catch (_) {}
        pushSaveEvent('turn_in_await_inflight_autosave_done', 'Done waiting for in-flight autosave', JSON.stringify({ waitMs: Date.now() - tAwait, saveStillInProgress: saveInProgress }));
      }
      progress('release_lock', 'Releasing edit lock…');
      let result;
      while (true) {
        try {
          const tCheckIn = Date.now();
          const sbJsBadNow = isSbJsRecentlyBad();
          const useRawForCheckIn = consecutiveAutoSaveFailures >= 3 ||
            (checkInAttempt > 0 && !usedRawFetchForCheckIn) ||
            sbJsBadNow;
          if (useRawForCheckIn && checkInAttempt === 0 && sbJsBadNow && consecutiveAutoSaveFailures < 3) {
            pushSaveEvent('turn_in_raw_fetch_engaged_proactively', 'Turn In using raw fetch (supabase-js wedged recently)', JSON.stringify({ msSinceSbJsFailure: Date.now() - lastSupabaseJsFailureAt, lastOk: lastSuccessfulSupabaseCallAt, failures: consecutiveAutoSaveFailures }));
          }
          usedRawFetchForCheckIn = useRawForCheckIn;
          let data = null, error = null;
          if (useRawForCheckIn) {
            try {
              const r = await ctx.withTimeout((signal) => rawCheckInProject(state.currentProjectId, signal), CHECK_IN_TIMEOUT_MS, 'Turn in');
              data = r.data || null;
              error = r.error || null;
              if (!error) pushSaveEvent('turn_in_via_raw_fetch_ok', 'Raw-fetch check-in succeeded', JSON.stringify({ ms: Date.now() - tCheckIn, attempt: checkInAttempt }));
              else pushSaveEvent('turn_in_via_raw_fetch_err', 'Raw-fetch check-in failed', JSON.stringify({ ms: Date.now() - tCheckIn, attempt: checkInAttempt, message: error?.message, status: error?.status, diag: error?.diag }));
            } catch (rawErr) {
              error = rawErr;
              pushSaveEvent('turn_in_via_raw_fetch_err', 'Raw-fetch check-in threw', JSON.stringify({ ms: Date.now() - tCheckIn, attempt: checkInAttempt, message: rawErr?.message, status: rawErr?.status, diag: rawErr?.diag }));
            }
          } else {
            const r = await ctx.withTimeout(
              ctx.getSupabase().rpc('check_in_project', { p_project_id: state.currentProjectId }),
              CHECK_IN_TIMEOUT_MS,
              'Turn in'
            );
            data = r.data;
            error = r.error;
          }
          ctx.updateServerClockFromRpc(data);
          ctx.perfLog('doTurnIn check_in_project', Date.now() - tCheckIn, { projectId: state.currentProjectId, attempt: checkInAttempt, raw: useRawForCheckIn });
          result = data || (error ? { ok: false, error: error.message } : { ok: false });
          const releaseMsg = (result?.error || '').toString();
          const releaseCode = error?.code || '';
          const alreadyReleased =
            releaseCode === 'CHECKOUT_EXPIRED' ||
            releaseCode === 'CHECKOUT_NOT_OWNED' ||
            /CHECKOUT_EXPIRED|NOT_OWNED|not.checked.out|do not have .* checked out|expired/i.test(releaseMsg);
          if (alreadyReleased) {
            pushSaveEvent('turn_in_already_released', 'Server had already released the lock; treating as Turn In success', JSON.stringify({ message: releaseMsg || releaseCode, elapsedMs: Date.now() - tTurnIn, stage: currentStage, attempt: checkInAttempt }));
            return { ok: true, releasedByServer: true };
          }
          if (error && checkInAttempt === 0 && isTransientSaveError(error)) {
            saveDebugLog('turnIn.retry', { message: error?.message });
            pushSaveEvent('turn_in_retry', 'Transient turn-in error, retrying once', JSON.stringify({ message: error?.message || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage }));
            checkInAttempt++;
            progress('retry', 'Retrying…');
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          break;
        } catch (e) {
          const isTimedOutMsg = /timed?\s*out/i.test(e?.message || '');
          if (checkInAttempt === 0 && (isTransientSaveError(e) || isTimedOutMsg)) {
            saveDebugLog('turnIn.retry', { message: e?.message });
            pushSaveEvent('turn_in_retry', 'Transient turn-in error, retrying once', JSON.stringify({ message: e?.message || '', elapsedMs: Date.now() - tTurnIn, stage: currentStage, viaTimedOutCatch: isTimedOutMsg && !isTransientSaveError(e) }));
            checkInAttempt++;
            progress('retry', 'Retrying…');
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          ctx.perfLog('doTurnIn total', Date.now() - tTurnIn, { hadAutoSave });
          pushSaveEvent('turn_in_err', (e && e.message) || 'Failed to turn in', errDetail(e));
          return { ok: false, error: (e && e.message) || 'Failed to turn in' };
        }
      }
      ctx.perfLog('doTurnIn total', Date.now() - tTurnIn, { hadAutoSave });
      if (currentStage && currentStage !== 'start') {
        pushSaveEvent('turn_in_phase_done', currentStage + ' done', JSON.stringify({ stage: currentStage, durationMs: Date.now() - stageStartedAt, elapsedMs: Date.now() - tTurnIn }));
      }
      if (result.ok) {
        pushSaveEvent('turn_in_ok', 'Project turned in (checkout released)', JSON.stringify({ elapsedMs: Date.now() - tTurnIn, attempts: checkInAttempt + 1, usedRawFetchForCheckIn }));
        return { ok: true };
      }
      pushSaveEvent('turn_in_err', (result.error || 'Failed to turn in').toString(), JSON.stringify({ elapsedMs: Date.now() - tTurnIn, stage: currentStage, attempt: checkInAttempt, usedRawFetchForCheckIn, online: (typeof navigator !== 'undefined') ? navigator.onLine : null, network: captureNetworkInfoDetail() || null }));
      return { ok: false, error: result.error || 'Failed to turn in' };
    } finally {
      ctx.setTurnInProgress(null);
      turnInInProgress = false;
    }
  }

  function isTurnInInProgress() { return turnInInProgress; }
  // Session-reset hook (resetLocalSessionState): drop the in-flight guard and
  // any recovery-save promise from the torn-down session.
  function resetTurnInState() { turnInInProgress = false; inFlightRecoverySavePromise = null; }

  // --- [sync] Save outcome, telemetry & envelope core (Stage 6) -----------
  // Engine-owned: the dirty flag itself (markProjectDirty and the save paths
  // are all engine-side now), the save-in-progress flags, the in-flight
  // autosave promise/controller/abort-reason, the failure/backoff/latency
  // bookkeeping, the sync-paused banner state, the last-success stamp, the
  // envelope snapshot throttles, and the per-tab session id.
  let autoSaveDirty = false;
  let saveInProgress = false;
  let savePdfInProgress = false;
  let saveProgressMessage = '';
  let inFlightAutoSavePromise = null;
  let inFlightAutoSaveController = null;
  let autoSaveAbortReason = null;
  let consecutiveAutoSaveFailures = 0;
  let firstAutoSaveFailureAt = 0;
  let nextAutoSaveAttemptAt = 0;
  let recoveryProbeFiredForFailureCount = 0;
  let autoSaveLatencySamples = [];
  let autosaveSlowEmittedAt = 0;
  let autosaveMilestoneFiredAt = { f3: 0, f5: 0, f10: 0 };
  let bannerShown = false;
  let lastSuccessfulSupabaseCallAt = 0;
  let lastCloudSaveAttemptFailed = false;
  let envelopeSnapshotFiredAt = 0;
  let envelopeSnapshotDirtyStamp = 0;
  let pdfCacheWarnShown = false;
  // Per-tab session id, stamped into the export envelope so concurrent tabs of
  // the same project (a real save/sync race) are distinguishable in logs.
  const TAB_SESSION_ID = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  function noteSupabaseCallOk() { lastSuccessfulSupabaseCallAt = Date.now(); }

  function noteAutoSaveOutcome(ok, errOrNull) {
    if (ok) {
      if (consecutiveAutoSaveFailures > 0) {
        pushSaveEvent('autosave_recovered', 'Cloud sync recovered', autosaveEventDetail({
          failures: consecutiveAutoSaveFailures,
          durationMs: firstAutoSaveFailureAt ? (Date.now() - firstAutoSaveFailureAt) : 0,
          clientRecycles: getClientRecycleCount()
        }));
      }
      consecutiveAutoSaveFailures = 0;
      firstAutoSaveFailureAt = 0;
      nextAutoSaveAttemptAt = 0;
      recoveryProbeFiredForFailureCount = 0;
      autosaveMilestoneFiredAt = { f3: 0, f5: 0, f10: 0 };
      resetClientRecycleCount();
      lastSuccessfulSupabaseCallAt = Date.now();
      updateSyncPausedBanner(false);
      return;
    }
    consecutiveAutoSaveFailures++;
    if (!firstAutoSaveFailureAt) firstAutoSaveFailureAt = Date.now();
    nextAutoSaveAttemptAt = Date.now() + backoffDelayMs(consecutiveAutoSaveFailures, AUTOSAVE_BACKOFF_LEVELS_MS);
    if (consecutiveAutoSaveFailures >= AUTOSAVE_BANNER_THRESHOLD) updateSyncPausedBanner(true);

    if (consecutiveAutoSaveFailures === 3 && !autosaveMilestoneFiredAt.f3) {
      autosaveMilestoneFiredAt.f3 = Date.now();
      pushSaveEvent('autosave_failing_3', 'Cloud sync has failed 3 times in a row', autosaveEventDetail({ milestone: 3 }));
    }
    if (consecutiveAutoSaveFailures === AUTOSAVE_RECOVERY_THRESHOLD && !autosaveMilestoneFiredAt.f5) {
      autosaveMilestoneFiredAt.f5 = Date.now();
      pushSaveEvent('autosave_failing_5', 'Cloud sync has failed 5 times in a row', autosaveEventDetail({ milestone: 5 }));
      writeSaveLogsSnapshot('autosave_failing_5').catch(() => {});
    }
    if (consecutiveAutoSaveFailures === 10 && !autosaveMilestoneFiredAt.f10) {
      autosaveMilestoneFiredAt.f10 = Date.now();
      pushSaveEvent('autosave_failing_10', 'Cloud sync has failed 10 times in a row', autosaveEventDetail({ milestone: 10 }));
    }

    if (consecutiveAutoSaveFailures >= 3 &&
        recoveryProbeFiredForFailureCount !== consecutiveAutoSaveFailures) {
      recoveryProbeFiredForFailureCount = consecutiveAutoSaveFailures;
      const trigger = consecutiveAutoSaveFailures >= AUTOSAVE_RECOVERY_THRESHOLD ? 'failure_threshold' : 'failure_threshold_early';
      runRecoveryProbeAndMaybeRecycle(trigger).catch(() => {});
    }
  }

  function updateSyncPausedBanner(show) {
    const el = document.getElementById('syncPausedBanner');
    if (!el) return;
    const next = !!show;
    if (next === bannerShown) return;
    bannerShown = next;
    el.style.display = next ? 'flex' : 'none';
  }

  async function retrySyncNow() {
    if (inFlightAutoSaveController) {
      autoSaveAbortReason = 'user_retry';
      try { inFlightAutoSaveController.abort(); } catch (_) {}
      inFlightAutoSaveController = null;
    }
    nextAutoSaveAttemptAt = 0;
    autoSaveDirty = true;
    try { await ctx.getSupabase().auth.getSession(); } catch (_) {}
    pushSaveEvent('manual_sync_retry', 'User requested manual retry');
  }

  function recordAutosaveLatency(ms) {
    if (typeof ms !== 'number' || ms < 0) return;
    autoSaveLatencySamples.push(ms);
    if (autoSaveLatencySamples.length > AUTOSAVE_SLOW_WINDOW) autoSaveLatencySamples.shift();
    if (autoSaveLatencySamples.length < AUTOSAVE_SLOW_MIN_SAMPLES) return;
    const p95 = percentile(autoSaveLatencySamples, 0.95);
    if (p95 > AUTOSAVE_SLOW_MS && Date.now() - autosaveSlowEmittedAt > AUTOSAVE_SLOW_DEBOUNCE_MS) {
      autosaveSlowEmittedAt = Date.now();
      pushSaveEvent('autosave_slow', 'Cloud writes are slow', JSON.stringify({
        p95, n: autoSaveLatencySamples.length, latest: ms
      }));
    }
  }

  function captureNetworkInfoDetail() {
    if (typeof navigator === 'undefined' || !navigator.connection) return undefined;
    const c = navigator.connection;
    try {
      return JSON.stringify({
        effectiveType: c.effectiveType,
        downlink: c.downlink,
        rtt: c.rtt,
        saveData: c.saveData
      });
    } catch (_) { return undefined; }
  }

  function captureNetworkInfoObj() {
    if (typeof navigator === 'undefined' || !navigator.connection) return null;
    const c = navigator.connection;
    try {
      return {
        effectiveType: c.effectiveType,
        downlink: c.downlink,
        rtt: c.rtt,
        saveData: c.saveData
      };
    } catch (_) { return null; }
  }

  // Canvas/display environment for the export envelope -- catches "my counts vanish at
  // high zoom" by revealing the device pixel ratio, the probed canvas caps, the current
  // render-area-safety knob (lowered if a blank was caught), and the last render's buffer
  // dims. Read at export time only; all identifiers are module-scope and initialised by
  // the time logs are exported.

  function autosaveEventDetail(extra) {
    const detail = {
      failures: consecutiveAutoSaveFailures,
      online: (typeof navigator !== 'undefined') ? navigator.onLine : null,
      msSinceLastSuccess: lastSuccessfulSupabaseCallAt ? (Date.now() - lastSuccessfulSupabaseCallAt) : null,
      network: captureNetworkInfoObj(),
      visibility: (typeof document !== 'undefined') ? document.visibilityState : null
    };
    if (extra && typeof extra === 'object') Object.assign(detail, extra);
    try { return JSON.stringify(detail); } catch (_) { return ''; }
  }

  function getProjectSummaryForLogs() {
    try {
      const pages = ctx.getState().pages || [];
      // Count across the current per-page `canvases[].annotations` shape (with a
      // fallback to the legacy per-page `annotations` shape), using the field
      // names the app actually writes (counterMarkers / quickLines / polylines).
      // The old code read `a.counts` / `a.lines` off `p.annotations`, which never
      // exist in the canvases shape -- so every count logged as 0 even on full
      // projects. counters/lines reuse getProjectCounts so the two never drift.
      const { counter_count: counters, line_count: lines } = getProjectCounts({ pages });
      let multiplyZones = 0, scaleZones = 0, highlights = 0, notes = 0;
      pages.forEach(p => {
        const canvases = p?.canvases || (p?.annotations ? [{ annotations: p.annotations }] : []);
        canvases.forEach(c => {
          const a = c?.annotations || {};
          multiplyZones += (a.multiplyZones || []).length;
          scaleZones    += (a.scaleZones || []).length;
          highlights    += (a.highlights || []).length;
          notes         += (a.notes || []).length;
        });
      });
      // Payload sizing (export-time only -- never called per save event). An
      // approximation of the cloud-save data blob, for "saves fail on big
      // projects / large PDFs" diagnosis.
      let dataJsonBytes = null;
      try {
        dataJsonBytes = JSON.stringify({
          pages: pages.map(p => p.annotations || p.canvases || null),
          counters: ctx.getState().counters, lineTypes: ctx.getState().lineTypes, groups: ctx.getState().groups
        }).length;
      } catch (_) {}
      const pdfBytes = (typeof ctx.getState().pdfBufferSize === 'number') ? ctx.getState().pdfBufferSize : null;
      return {
        projectId: ctx.getState().currentProjectId,
        projectName: ctx.getState().currentProjectName,
        pageCount: pages.length,
        pagesWithScale: pages.filter(p => p.scale && p.scale.feet > 0).length,
        // Per-page rotation diagnostics — root-causes "pages rotated under the canvas":
        // page.rotation, the PDF's intrinsic /Rotate, the current frame dims, and whether a
        // bake-frame mismatch was detected on load (verifyPageBakeFrame).
        pageRotation: pages.map(p => p.rotation ?? 0),
        pageBake: pages.map(p => { const f = ctx.computePageBakeFrame(p); return f ? { w: f.w, h: f.h, intrinsic: f.intrinsic } : null; }),
        bakeMismatchPages: pages.filter(p => p && p.bakeMismatch).length,
        counters, lines, multiplyZones, scaleZones, highlights, notes,
        isAdmin: !!ctx.getState().isAdmin,
        isViewer: !!ctx.getState().isViewer,
        // Checkout ownership (multi-user contention / expiry diagnosis)
        checkedOutBy: ctx.getState().checkedOutBy || null,
        checkedOutEmail: ctx.getState().checkedOutEmail || null,
        checkedOutAt: ctx.getState().checkedOutAt || null,
        checkedOutAgoMs: ctx.getState().checkedOutAt ? (Date.now() - new Date(ctx.getState().checkedOutAt).getTime()) : null,
        canCheckOut: !!ctx.getState().canCheckOut,
        projectOwnerId: ctx.getState().projectOwnerId || null,
        loadedViaViewLink: !!ctx.getState().loadedViaViewLink,
        // Payload sizing
        dataJsonBytes,
        pdfBufferBytes: pdfBytes,
        nearPdfCap: (pdfBytes != null && typeof PDF_MAX_SIZE_BYTES === 'number') ? (pdfBytes > PDF_MAX_SIZE_BYTES * 0.9) : null
      };
    } catch (_) { return null; }
  }

  async function buildSaveLogsEnvelopeWithSnapshots() {
    const envelope = buildSaveLogsEnvelope();
    try {
      const snapshots = await readSaveLogsSnapshots(5);
      if (snapshots && snapshots.length) envelope.autoSnapshotEnvelopes = snapshots;
    } catch (_) {}
    // Storage health -- catches "my work didn't recover" / private-mode / disk-full.
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        envelope.storage = { usage: est.usage ?? null, quota: est.quota ?? null };
      }
    } catch (_) {}
    envelope.lastLocalBackup = { at: getLastLocalBackupAt(), ok: getLastLocalBackupOk() };
    return envelope;
  }

  function buildSaveLogsEnvelope() {
    let userEmail = null;
    try { userEmail = ctx.getState().supabaseSession?.user?.email || null; } catch (_) {}
    return {
      schema: 'clickcount-save-logs/v1',
      capturedAt: new Date().toISOString(),
      tabSessionId: TAB_SESSION_ID,
      projectRef: (typeof ctx.getSupabaseUrl() === 'string' ? ((ctx.getSupabaseUrl().match(/^https?:\/\/([^.]+)\./) || [])[1] || null) : null),
      // Triage note for anyone -- especially an AI/LLM -- handed an exported copy
      // of these logs: these are CLIENT-side save/sync telemetry events. To
      // root-cause a failure, cross-reference each error event against THIS
      // project's Supabase server logs (Supabase MCP `get_logs` with service
      // "api", or the dashboard Logs Explorer) by timestamp + path + status_code
      // (and tabSessionId / user.email). The authoritative server request id
      // (sb-request-id) is recorded server-side but is NOT browser-readable here
      // (it is omitted from Access-Control-Expose-Headers), so it will be absent
      // from these events -- get it from the server logs, not from here.
      analysisNote: 'Client-side save/sync telemetry. To root-cause a failure, cross-reference each error event with this project\'s Supabase server logs (Supabase MCP get_logs service:"api", or the dashboard Logs Explorer) by timestamp + path + status_code (and tabSessionId / user.email). The authoritative sb-request-id lives in the server logs, not here (it is not browser-readable due to CORS). projectRef is included above.',
      user: {
        email: userEmail,
        isAdmin: !!ctx.getState().isAdmin,
        isViewer: !!ctx.getState().isViewer
      },
      browser: {
        ua: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
        platform: (typeof navigator !== 'undefined' && navigator.platform) || null,
        onLine: (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : null,
        network: captureNetworkInfoDetail() || null
      },
      display: ctx.captureDisplayInfoObj(),
      timing: {
        lastSuccessfulSupabaseCallAt,
        serverClockOffsetMs: ctx.getServerClockOffsetMs(),
        consecutiveAutoSaveFailures,
        autoSaveDirty,
        saveInProgress,
        turnInInProgress: isTurnInInProgress(),
        verbose: isSaveDebugEnabled(),
        windowMs: getSaveStatusLogWindowMs(),
        // Token expiry -- catches the JWT-expired 401 class on long-open tabs
        sessionExpiresAt: (ctx.getState().supabaseSession && ctx.getState().supabaseSession.expires_at) || null,
        secondsToExpiry: secondsToExpiry(ctx.getState().supabaseSession && ctx.getState().supabaseSession.expires_at, Date.now()),
        // Degradation metrics (computed in the engine; surfaced here for export)
        clientRecycles: getClientRecycleCount(),
        autosaveLatencyP50: percentile(autoSaveLatencySamples, 0.5),
        autosaveLatencyP95: percentile(autoSaveLatencySamples, 0.95),
        autosaveLatencyN: (autoSaveLatencySamples && autoSaveLatencySamples.length) || 0,
        degradedForMs: firstAutoSaveFailureAt ? (Date.now() - firstAutoSaveFailureAt) : 0,
        nextAutoSaveAttemptInMs: nextAutoSaveAttemptAt ? Math.max(0, nextAutoSaveAttemptAt - Date.now()) : 0
      },
      project: getProjectSummaryForLogs(),
      events: getSaveStatusLog().slice()
    };
  }

  function resetAutosaveDegradedState() {
    consecutiveAutoSaveFailures = 0;
    firstAutoSaveFailureAt = 0;
    nextAutoSaveAttemptAt = 0;
    recoveryProbeFiredForFailureCount = 0;
    autosaveMilestoneFiredAt = { f3: 0, f5: 0, f10: 0 };
    autoSaveLatencySamples = [];
    autosaveSlowEmittedAt = 0;
    envelopeSnapshotFiredAt = 0;
    envelopeSnapshotDirtyStamp = 0;
    clearDirtyStartedAt();
    resetRecycleState();
    autoSaveAbortReason = null;
    try { updateSyncPausedBanner(false); } catch (_) {}
  }

  async function writeSaveLogsSnapshot(reason) {
    if (typeof indexedDB === 'undefined') return;
    if (envelopeSnapshotFiredAt && Date.now() - envelopeSnapshotFiredAt < 60000) return;
    envelopeSnapshotFiredAt = Date.now();
    try {
      const envelope = buildSaveLogsEnvelope();
      envelope.autoSnapshotReason = reason || 'unknown';
      const res = await idbPutSaveLogsSnapshot(envelope);
      if (res && res.error) throw res.error;
      saveDebugLog('autosave.snapshot.put', { reason, capturedAt: envelope.capturedAt, eventCount: envelope.events.length });
    } catch (e) {
      saveDebugLog('autosave.snapshot.put_err', { reason, message: e?.message });
    }
  }

  // Interval-tick hook (app.js autosave loop): write a diagnostic envelope
  // snapshot once per long-dirty stretch (DIRTY_SNAPSHOT_THRESHOLD_MS).
  function maybeWriteDirtySnapshot() {
    const dirtyStartedAtNow = getDirtyStartedAt();
    if (dirtyStartedAtNow && Date.now() - dirtyStartedAtNow >= DIRTY_SNAPSHOT_THRESHOLD_MS && envelopeSnapshotDirtyStamp < dirtyStartedAtNow) {
      envelopeSnapshotDirtyStamp = dirtyStartedAtNow;
      writeSaveLogsSnapshot('dirty_10min').catch(() => {});
    }
  }

  // Abort the in-flight autosave request (visibility-hidden flush, session
  // reset). preferExisting keeps an already-set abort reason (session reset
  // must not clobber a user_retry that is still unwinding).
  function abortInFlightAutoSave(reason, preferExisting) {
    if (!inFlightAutoSaveController) return false;
    autoSaveAbortReason = preferExisting ? (autoSaveAbortReason || reason) : reason;
    try { inFlightAutoSaveController.abort(); } catch (_) {}
    inFlightAutoSaveController = null;
    return true;
  }

  function getAutoSaveDirty() { return autoSaveDirty; }
  function setAutoSaveDirty(v) { autoSaveDirty = !!v; }
  function isSaveInProgress() { return saveInProgress; }
  function isSavePdfInProgress() { return savePdfInProgress; }
  function getSaveProgressMessage() { return saveProgressMessage; }
  function getConsecutiveAutoSaveFailures() { return consecutiveAutoSaveFailures; }
  function getNextAutoSaveAttemptAt() { return nextAutoSaveAttemptAt; }
  function getLastSuccessfulSupabaseCallAt() { return lastSuccessfulSupabaseCallAt; }
  function wasLastCloudSaveAttemptFailed() { return lastCloudSaveAttemptFailed; }
  function setLastCloudSaveAttemptFailed(v) { lastCloudSaveAttemptFailed = !!v; }
  // Session-reset hook: the save flags a torn-down session must not leak.
  function resetSaveFlags() {
    saveInProgress = false;
    savePdfInProgress = false;
    saveProgressMessage = '';
    pdfCacheWarnShown = false;
  }

  // --- [sync] Manual save to cloud (Stage 6) ------------------------------
  // The PDF upload ladder (resumable/TUS with cross-reload resume, standard
  // upload with verify-after-timeout) + performSaveProjectToCloud + the
  // one-shot local-PDF uploader. Engine-owned: the upload progress sink and
  // the one-shot in-flight/backoff state.
  // Module-level progress sink for the active PDF upload. A flow that wants the
  // byte-level upload progress (e.g. Turn In, to show a percentage in its banner)
  // sets this before kicking off a save and clears it after; the upload helpers
  // invoke it. Null when nobody is listening.
  let onPdfUploadProgress = null;

  // Poll storage.info() to confirm an object actually landed after an upload that
  // timed out / aborted client-side (the underlying request can still complete
  // server-side). Returns true when the object exists with the expected byte size.
  async function confirmPdfUploaded(storagePath, expectedBytes) {
    if (!ctx.getSupabase() || !(expectedBytes > 0)) return false;
    for (let i = 0; i < PDF_UPLOAD_VERIFY_ATTEMPTS; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, PDF_UPLOAD_VERIFY_GAP_MS));
      try {
        const { data: info } = await ctx.withTimeout(ctx.getSupabase().storage.from('pdfs').info(storagePath), STORAGE_INFO_TIMEOUT_MS, 'Storage info');
        const sz = info && (info.metadata?.size ?? info.size);
        if (typeof sz === 'number' && sz === expectedBytes) return true;
      } catch (_) { /* keep polling */ }
    }
    return false;
  }

  // True when the resumable/TUS path can be used (large file + library loaded).
  function canUseResumableUpload(bytes) {
    return bytes > PDF_RESUMABLE_THRESHOLD_BYTES &&
      typeof tus !== 'undefined' && tus && typeof tus.Upload === 'function' && tus.isSupported;
  }

  // Resumable PDF upload via tus against Supabase Storage's resumable endpoint.
  // Chunked (6 MB, required by Supabase), reports byte progress via opts.onProgress,
  // honors opts.signal for abort, and resumes from a prior interrupted upload for
  // the same fingerprint (persisted in IndexedDB, so it survives a page reload).
  // Resolves { ok: true } or rejects with the tus error. opts: { fingerprint,
  // onProgress, signal }.
  async function uploadPdfResumable(storagePath, blob, opts) {
    opts = opts || {};
    if (typeof tus === 'undefined' || typeof tus.Upload !== 'function') throw new Error('Resumable upload library not loaded');
    const token = ctx.getState().supabaseSession?.access_token;
    if (!token) throw new Error('Not signed in');
    const fingerprint = 'clickcount-pdf::' + (opts.fingerprint || storagePath);
    // tus UrlStorage backed by IndexedDB (cross-reload resume).
    const idbUrlStorage = {
      addUpload: async (fp, upload) => {
        const urlStorageKey = 'tus::' + fp + '::' + Date.now();
        await idbPdfUploadResumePut({
          urlStorageKey, fingerprint: fp,
          uploadUrl: upload.uploadUrl || null,
          size: upload.size != null ? upload.size : null,
          metadata: upload.metadata || null,
          creationTime: upload.creationTime || new Date().toISOString(),
          parallelUploadUrls: upload.parallelUploadUrls || null
        });
        return urlStorageKey;
      },
      removeUpload: async (urlStorageKey) => { await idbPdfUploadResumeDelete(urlStorageKey); },
      findAllUploads: async () => { return await idbPdfUploadResumeGetAll(); },
      findUploadsByFingerprint: async (fp) => { return await idbPdfUploadResumeGetByFingerprint(fp); }
    };
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };
      const upload = new tus.Upload(blob, {
        endpoint: ctx.getSupabaseUrl() + '/storage/v1/upload/resumable',
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: 'Bearer ' + token,
          apikey: ctx.getSupabaseAnonKey(),
          'x-upsert': 'true'
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        fingerprint: () => Promise.resolve(fingerprint),
        urlStorage: idbUrlStorage,
        metadata: {
          bucketName: 'pdfs',
          objectName: storagePath,
          contentType: 'application/pdf',
          cacheControl: '3600'
        },
        onError: (err) => finish(reject, err),
        onProgress: (sent, total) => { if (typeof opts.onProgress === 'function') { try { opts.onProgress(sent, total); } catch (_) {} } },
        onSuccess: () => { idbPdfUploadResumeDeleteByFingerprint(fingerprint).catch(() => {}); finish(resolve, { ok: true }); }
      });
      if (opts.signal) {
        if (opts.signal.aborted) { try { upload.abort(); } catch (_) {} finish(reject, new DOMException('Aborted', 'AbortError')); return; }
        opts.signal.addEventListener('abort', () => { try { upload.abort(); } catch (_) {} finish(reject, new DOMException('Aborted', 'AbortError')); }, { once: true });
      }
      // Resume a prior interrupted upload for this fingerprint if one exists.
      upload.findPreviousUploads().then((prev) => {
        if (prev && prev.length) { try { upload.resumeFromPreviousUpload(prev[0]); } catch (_) {} }
        upload.start();
      }).catch(() => { upload.start(); });
    });
  }

  // Upload a PDF to the `pdfs` bucket. Large files (> PDF_RESUMABLE_THRESHOLD_BYTES)
  // go through the resumable/TUS path (chunked, progress, cross-reload resume, and
  // genuinely cancellable via tus); smaller files use a single standard upload with
  // a size-aware timeout (so a slow PDF is not falsely failed). NOTE: storage-js
  // `upload()` does not accept an AbortSignal, so the standard path cannot cancel an
  // in-flight request -- the timeout only bounds how long we WAIT, and the
  // verify-after-timeout net (confirmPdfUploaded) reconciles an upload that actually
  // completed server-side after the client gave up. Either path runs that verify net
  // on a transient failure before surfacing. Returns { ok, ms, timeoutMs, viaVerify,
  // resumable } or throws. upOpts: { runId, timeoutMs, onProgress, fingerprint }.
  async function uploadPdfToStorage(storagePath, pdfToUpload, upOpts) {
    upOpts = upOpts || {};
    const bytes = pdfToUpload.byteLength || pdfToUpload.size || 0;
    const timeoutMs = upOpts.timeoutMs || pdfUploadTimeoutMs(bytes, {
      baseMs: PDF_UPLOAD_TIMEOUT_BASE_MS, assumedBps: PDF_UPLOAD_ASSUMED_BPS,
      slackMs: PDF_UPLOAD_TIMEOUT_SLACK_MS, maxMs: PDF_UPLOAD_TIMEOUT_MAX_MS
    });
    const t1 = Date.now();
    if (canUseResumableUpload(bytes)) {
      try {
        const blob = (typeof Blob !== 'undefined' && pdfToUpload instanceof Blob) ? pdfToUpload : new Blob([pdfToUpload], { type: 'application/pdf' });
        await uploadPdfResumable(storagePath, blob, { fingerprint: upOpts.fingerprint || storagePath, onProgress: upOpts.onProgress, signal: upOpts.signal });
        return { ok: true, ms: Date.now() - t1, timeoutMs, resumable: true };
      } catch (e) {
        // The upload may have completed server-side even though tus reported an
        // error / was aborted; the object's presence is authoritative.
        const confirmed = await confirmPdfUploaded(storagePath, bytes).catch(() => false);
        if (confirmed) {
          pushSaveEvent('pdf_upload_verified_after_timeout', 'PDF upload confirmed via storage info after error', JSON.stringify({ path: storagePath, bytes, ms: Date.now() - t1, resumable: true, runId: upOpts.runId }));
          return { ok: true, ms: Date.now() - t1, timeoutMs, viaVerify: true, resumable: true };
        }
        throw e;
      }
    }
    try {
      // storage-js upload() is not cancellable (no AbortSignal param), so pass a
      // plain promise; withTimeout bounds the wait and verify-after-timeout below
      // reconciles a request that completed server-side after we stopped waiting.
      const { error: uploadErr } = await ctx.withTimeout(
        ctx.getSupabase().storage.from('pdfs').upload(storagePath, pdfToUpload, { contentType: 'application/pdf', upsert: true }),
        timeoutMs, 'PDF upload'
      );
      if (uploadErr) throw uploadErr;
      return { ok: true, ms: Date.now() - t1, timeoutMs };
    } catch (e) {
      // A timeout/network error does not prove the object failed to land: the
      // request may have finished server-side just as the client gave up.
      // Verify via storage.info() before surfacing a failure.
      if (isTransientSaveError(e)) {
        const confirmed = await confirmPdfUploaded(storagePath, bytes).catch(() => false);
        if (confirmed) {
          pushSaveEvent('pdf_upload_verified_after_timeout', 'PDF upload confirmed via storage info after timeout', JSON.stringify({ path: storagePath, bytes, ms: Date.now() - t1, timeoutMs, runId: upOpts.runId }));
          return { ok: true, ms: Date.now() - t1, timeoutMs, viaVerify: true };
        }
      }
      throw e;
    }
  }

  async function performSaveProjectToCloud(opts) {
    const runId = saveDebugRunId();
    const { name, includePdf, pdfBuffer: optsPdfBuffer } = opts;
    const user = ctx.getState().supabaseSession?.user;
    if (!user || !ctx.getSupabase()) {
      saveDebugLog('manual.save.skip', { runId, reason: 'not_signed_in' });
      return { ok: false, error: new Error('Not signed in') };
    }
    let rawPdf = optsPdfBuffer ?? ctx.getState().pdfBuffer;
    let rawPdfBytes = (rawPdf && (rawPdf.byteLength || rawPdf.length || 0)) | 0;
    if (includePdf && rawPdfBytes === 0 && ctx.getState().pdfBufferSize > 0 && ctx.getState().currentProjectId && ctx.getState().pdfHash) {
      try {
        const cached = await pdfCacheGet(ctx.getState().currentProjectId, ctx.getState().pdfHash);
        if (cached && cached.size > 0) {
          const recoveredBuf = await cached.arrayBuffer();
          if (recoveredBuf && recoveredBuf.byteLength > 0) {
            rawPdf = recoveredBuf;
            rawPdfBytes = recoveredBuf.byteLength;
            saveDebugLog('manual.save.recover_pdf', { runId, bytes: recoveredBuf.byteLength });
            pushSaveEvent('manual_save_recover', 'Recovered PDF from local cache');
          }
        }
      } catch (recoverErr) {
        saveDebugLog('manual.save.recover_pdf_err', { runId, message: recoverErr?.message });
      }
    }
    if (includePdf && rawPdfBytes === 0 && ctx.getState().pdfBufferSize > 0 && !ctx.getState().pdfStoragePath) {
      const detachedErr = new Error('PDF data is no longer in memory. Reload the project, then re-open Save.');
      saveDebugLog('manual.save.detached_pdf_fail', { runId, hadHash: !!ctx.getState().pdfHash, hasStoragePath: !!ctx.getState().pdfStoragePath });
      pushSaveEvent('manual_save_err', detachedErr.message);
      lastCloudSaveAttemptFailed = true;
      ctx.updateSaveStatusIndicator();
      return { ok: false, error: detachedErr };
    }
    const pdfToUpload = rawPdfBytes > 0 ? rawPdf : null;
    const willUploadPdf = pdfToUpload && includePdf;
    const prevPdfStoragePath = ctx.getState().pdfStoragePath || null;
    saveInProgress = true;
    savePdfInProgress = willUploadPdf;
    const wasDirty = autoSaveDirty;
    const genAtEntry = getDirtyGeneration();
    autoSaveDirty = false;
    ctx.updateStatus();
    const setProgress = (msg) => { saveProgressMessage = msg; ctx.updateStatus(); };
    // Determinate upload progress: drives the local status line and forwards to
    // any module-level listener (e.g. Turn In's banner). Only the resumable/TUS
    // path actually emits byte progress; the standard upload is a no-op here.
    const onUploadProgress = (sent, total) => {
      const pct = (total > 0) ? Math.min(100, Math.floor((sent / total) * 100)) : 0;
      setProgress('Uploading PDF... ' + pct + '%');
      if (typeof onPdfUploadProgress === 'function') { try { onPdfUploadProgress(sent, total); } catch (_) {} }
    };
    const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const data = {
      version: 1,
      counters: ctx.getState().counters,
      lineTypes: ctx.getState().lineTypes,
      iconNames: ctx.getState().iconNames || {},
      iconOrder: ctx.getState().iconOrder || null,
      customIconPaths: ctx.getUserCustomIcons(),
      maxZoom: ctx.getMaxZoom(),
      groups: ctx.getState().groups || [],
      rooms: ctx.getState().rooms || [],
      legendSettings: ctx.getState().legendSettings,
      multiplyZoneSettings: ctx.getState().multiplyZoneSettings,
      showGridOverlay: ctx.getState().showGridOverlay,
      gridSettings: ctx.getState().gridSettings,
      pages: ctx.getState().pages.map((p, i) => ({ index: i, label: p.label, canvases: p.canvases, scale: p.scale, rotation: p.rotation ?? 0, bakeFrame: ctx.computePageBakeFrame(p) })),
      activeCanvasIdByPage: ctx.getState().activeCanvasIdByPage || {},
      numberKeyBindings: ctx.getState().numberKeyBindings || {}
    };
    const counts = getProjectCounts(data);
    const tJson = Date.now();
    const dataJson = JSON.stringify(data);
    ctx.perfLog('Save JSON.stringify', Date.now() - tJson, { size: dataJson.length });
    const dataSize = dataJson.length;
    const log = (msg, extra) => { console.log('[Save]', msg, extra || ''); };
    log('Starting save', { userId: user.id, name, hasPdfBuffer: !!pdfToUpload, currentProjectId: ctx.getState().currentProjectId, payloadSize: dataSize, supabaseUrl: (typeof ctx.getSupabaseUrl() === 'string' ? ctx.getSupabaseUrl() : 'not set') });
    saveDebugLog('manual.save.start', {
      runId,
      name,
      includePdf,
      hasPdfBuffer: !!pdfToUpload,
      currentProjectId: ctx.getState().currentProjectId,
      willUploadPdf
    });
    saveDebugLog('manual.save.payload', {
      runId,
      dataSize,
      counter_count: counts.counter_count,
      line_count: counts.line_count
    });
    let orphanProjectIdForCleanup = null;
    let pendingNewProjectHydration = null;
    try {
      let pdfPath = ctx.getState().pdfStoragePath;
      let cachePdfHash = null;
      const originalProjectId = ctx.getState().currentProjectId;
      let manualSaveAttempt = 0;
      manualSaveLoop: while (true) {
        pdfPath = ctx.getState().pdfStoragePath;
        cachePdfHash = null;
        try {
          if (willUploadPdf) {
            let projectId = ctx.getState().currentProjectId;
            const pdfSize = pdfToUpload.byteLength;
            const sizeBytes = dataSize + pdfSize;
            let skipUpload = false;
            if (projectId) {
              const tSelect = Date.now();
              let row = null;
              try {
                const res = await ctx.withTimeout(ctx.getSupabase().from('projects').select('pdf_hash, pdf_path').eq('id', projectId).single(), 10000, 'pdf_hash check');
                row = res?.data || null;
              } catch (hashErr) {
                saveDebugLog('manual.save.pdf_hash_timeout', { runId, message: hashErr?.message });
              }
              ctx.perfLog('Save projects.select pdf_hash', Date.now() - tSelect);
              const newHash = await sha256Hex(pdfToUpload);
              // Skip the upload only when the cloud row carries a matching hash
              // AND actually has a pdf_path. A row can hold a pdf_hash with no
              // pdf_path (e.g. a project first created by autosave, which records
              // the hash but never uploads the file); in that case the storage
              // object does not exist, so we MUST upload even though the hashes
              // match — otherwise the project is left permanently without its PDF.
              if (row?.pdf_hash === newHash && row?.pdf_path) {
                skipUpload = true;
                cachePdfHash = newHash;
                log('PDF unchanged (hash match), skipping upload');
                saveDebugLog('manual.save.branch', { runId, branch: 'pdf_unchanged_hash_match' });
              } else if (row?.pdf_hash === newHash && !row?.pdf_path) {
                saveDebugLog('manual.save.branch', { runId, branch: 'hash_match_but_no_path_force_upload' });
                pushSaveEvent('manual_save_force_upload_missing_pdf', 'PDF hash matched but no file in cloud — uploading');
              }
            }
            if (!skipUpload) {
              // Check size BEFORE creating the project row so we don't leave an
              // orphan record behind when the PDF exceeds the limit.
              const sizeCheck = ctx.assertPdfWithinLimit(pdfToUpload.byteLength, 'performSaveProjectToCloud.upload');
              if (sizeCheck && !sizeCheck.ok) throw new Error(sizeCheck.message);
            }
            if (!projectId) {
              setProgress('Uploading project...');
              await tick();
              log('Inserting project...');
              saveDebugLog('manual.save.request.start', { runId, op: 'projects.insert', phase: 'with_pdf_new_project', timeoutMs: 60000, attempt: manualSaveAttempt, raw: true });
              const t0 = Date.now();
              const insertPayload = { user_id: user.id, name, data, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count };
              const { data: row, error } = await ctx.withTimeout((signal) => rawProjectsInsert(insertPayload, signal), 60000, 'Save project');
              log('Insert done', { duration: Date.now() - t0 + 'ms', error: error?.message, projectId: row?.id });
              if (error) {
                pushSaveEvent('manual_save_via_raw_fetch_err', 'Raw-fetch project insert (with PDF) failed', autosaveEventDetail({ runId, ms: Date.now() - t0, message: error.message, status: error.status, code: error.code, phase: 'with_pdf_new_project', diag: error.diag }));
                throw error;
              }
              pushSaveEvent('manual_save_via_raw_fetch_ok', 'Raw-fetch project insert (with PDF) succeeded', autosaveEventDetail({ runId, ms: Date.now() - t0, projectId: row?.id, phase: 'with_pdf_new_project' }));
              if (consecutiveAutoSaveFailures > 0 && !isClientRecycleInFlight()) {
                runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
              }
              saveDebugLog('manual.save.request.ok', { runId, op: 'projects.insert', phase: 'with_pdf_new_project', ms: Date.now() - t0, projectId: row?.id, raw: true });
              projectId = row?.id;
              if (!projectId) throw new Error('Project was created but no ID was returned. Please try again.');
              orphanProjectIdForCleanup = projectId;
              pendingNewProjectHydration = { projectId, userId: user.id };
              await tick();
            }
            if (!skipUpload) {
              setProgress('Uploading project...');
              await tick();
              const storagePath = user.id + '/' + projectId + '/document.pdf';
              log('Uploading PDF...', { path: storagePath, size: pdfToUpload.byteLength });
              // Hash before the upload so it can key the resumable-upload
              // fingerprint (project + content), so a resume after reload never
              // attaches to a stale partial upload of different PDF content. Reused
              // below as pdf_hash / cachePdfHash to avoid a second hash pass.
              const newHash = await sha256Hex(pdfToUpload);
              const uploadTimeoutMs = pdfUploadTimeoutMs(pdfToUpload.byteLength, { baseMs: PDF_UPLOAD_TIMEOUT_BASE_MS, assumedBps: PDF_UPLOAD_ASSUMED_BPS, slackMs: PDF_UPLOAD_TIMEOUT_SLACK_MS, maxMs: PDF_UPLOAD_TIMEOUT_MAX_MS });
              saveDebugLog('manual.save.request.start', { runId, op: 'storage.upload', path: storagePath, timeoutMs: uploadTimeoutMs, attempt: manualSaveAttempt });
              const t1 = Date.now();
              const uploadOutcome = await uploadPdfToStorage(storagePath, pdfToUpload, { runId, timeoutMs: uploadTimeoutMs, onProgress: onUploadProgress, fingerprint: projectId + '::' + newHash });
              log('Upload done', { duration: Date.now() - t1 + 'ms', viaVerify: !!uploadOutcome.viaVerify, resumable: !!uploadOutcome.resumable });
              saveDebugLog('manual.save.request.ok', { runId, op: 'storage.upload', ms: Date.now() - t1, viaVerify: !!uploadOutcome.viaVerify, resumable: !!uploadOutcome.resumable });
              pdfPath = storagePath;
              cachePdfHash = newHash;
              await tick();
              setProgress('Uploading project...');
              await tick();
              log('Updating project with pdf_path and pdf_hash...');
              saveDebugLog('manual.save.request.start', { runId, op: 'projects.update', phase: 'after_pdf_upload', projectId, timeoutMs: 30000, attempt: manualSaveAttempt });
              const t2 = Date.now();
              const updatePayload = { name, data, pdf_path: pdfPath, pdf_hash: newHash, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count, updated_at: new Date().toISOString() };
              if (ctx.getState().checkedOutBy === user.id) updatePayload.checked_out_at = new Date().toISOString();
              const { error: updateErr } = await ctx.withTimeout((signal) => ctx.getSupabase().from('projects').update(updatePayload).eq('id', projectId).abortSignal(signal), 30000, 'Update project');
              log('Update done', { duration: Date.now() - t2 + 'ms', error: updateErr?.message });
              if (updateErr) throw updateErr;
              saveDebugLog('manual.save.request.ok', { runId, op: 'projects.update', phase: 'after_pdf_upload', ms: Date.now() - t2, projectId });
            } else {
              setProgress('Uploading project...');
              await tick();
              log('Updating project data (PDF unchanged)...');
              saveDebugLog('manual.save.request.start', { runId, op: 'projects.update', phase: 'pdf_hash_skip', projectId, timeoutMs: 30000, attempt: manualSaveAttempt });
              const t2 = Date.now();
              const updatePayload = { name, data, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count, updated_at: new Date().toISOString() };
              if (ctx.getState().checkedOutBy === user.id) updatePayload.checked_out_at = new Date().toISOString();
              const { error: updateErr } = await ctx.withTimeout((signal) => ctx.getSupabase().from('projects').update(updatePayload).eq('id', projectId).abortSignal(signal), 30000, 'Update project');
              log('Update done', { duration: Date.now() - t2 + 'ms', error: updateErr?.message });
              if (updateErr) throw updateErr;
              saveDebugLog('manual.save.request.ok', { runId, op: 'projects.update', phase: 'pdf_hash_skip', ms: Date.now() - t2, projectId });
            }
          } else if (ctx.getState().currentProjectId) {
            setProgress('Uploading project...');
            await tick();
            let sizeBytes = dataSize;
            const skipStorageInfoForDegraded = consecutiveAutoSaveFailures > 0;
            if (ctx.getState().pdfStoragePath && !skipStorageInfoForDegraded) {
              const tInfo = Date.now();
              try {
                const { data: info } = await ctx.withTimeout(ctx.getSupabase().storage.from('pdfs').info(ctx.getState().pdfStoragePath), STORAGE_INFO_TIMEOUT_MS, 'Storage info');
                const sz = info && (info.metadata?.size ?? info.size);
                if (typeof sz === 'number' && sz >= 0) sizeBytes += sz;
                saveDebugLog('manual.save.storage.info.ok', { runId, ms: Date.now() - tInfo, path: ctx.getState().pdfStoragePath, pdfSizeBytes: typeof sz === 'number' ? sz : null, sizeBytes });
              } catch (se) {
                saveDebugLog('manual.save.storage.info.error', { runId, ms: Date.now() - tInfo, message: se?.message, name: se?.name });
                pushSaveEvent('manual_save_storage_info_err', 'Storage size check failed', autosaveEventDetail({ runId, ms: Date.now() - tInfo, message: se?.message, name: se?.name }));
              }
            } else if (ctx.getState().pdfStoragePath) {
              pushSaveEvent('manual_save_storage_info_skipped', 'Skipping size check while sync is degraded', autosaveEventDetail({ runId, reason: 'degraded_mode' }));
            }
            log('Updating existing project (no PDF)...');
            const useRawForManual = consecutiveAutoSaveFailures >= 3;
            saveDebugLog('manual.save.request.start', { runId, op: 'projects.update', phase: 'no_pdf_in_save', projectId: ctx.getState().currentProjectId, timeoutMs: 30000, attempt: manualSaveAttempt, raw: useRawForManual });
            const t3 = Date.now();
            const updatePayload = { name, data, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count, updated_at: new Date().toISOString() };
            if (ctx.getState().checkedOutBy === user.id) updatePayload.checked_out_at = new Date().toISOString();
            if (useRawForManual) {
              try {
                await ctx.withTimeout((signal) => rawProjectsUpdate(ctx.getState().currentProjectId, updatePayload, signal), 30000, 'Update project');
                pushSaveEvent('manual_save_via_raw_fetch_ok', 'Raw-fetch manual save succeeded', autosaveEventDetail({ runId, ms: Date.now() - t3 }));
                if (consecutiveAutoSaveFailures > 0 && !isClientRecycleInFlight()) {
                  runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
                }
              } catch (rawErr) {
                pushSaveEvent('manual_save_via_raw_fetch_err', 'Raw-fetch manual save failed', autosaveEventDetail({ runId, ms: Date.now() - t3, message: rawErr?.message, status: rawErr?.status, diag: rawErr?.diag }));
                throw rawErr;
              }
            } else {
              let mErr = null;
              try {
                const { error } = await ctx.withTimeout((signal) => ctx.getSupabase().from('projects').update(updatePayload).eq('id', ctx.getState().currentProjectId).abortSignal(signal), 30000, 'Update project');
                log('Update done', { duration: Date.now() - t3 + 'ms', error: error?.message });
                mErr = error || null;
              } catch (timeoutOrThrow) {
                mErr = timeoutOrThrow;
              }
              if (mErr) {
                noteSupabaseJsFailure('manual_save.projects.update', mErr);
                throw mErr;
              }
            }
            saveDebugLog('manual.save.request.ok', { runId, op: 'projects.update', phase: 'no_pdf_in_save', ms: Date.now() - t3, projectId: ctx.getState().currentProjectId, raw: useRawForManual });
          } else {
            setProgress('Uploading project...');
            await tick();
            log('Inserting project (no PDF)...');
            saveDebugLog('manual.save.request.start', { runId, op: 'projects.insert', phase: 'no_pdf', timeoutMs: 60000, attempt: manualSaveAttempt, raw: true });
            const t4 = Date.now();
            const insertPayloadNoPdf = { user_id: user.id, name, data, size_bytes: dataSize, counter_count: counts.counter_count, line_count: counts.line_count };
            const { data: row, error } = await ctx.withTimeout((signal) => rawProjectsInsert(insertPayloadNoPdf, signal), 60000, 'Save project');
            log('Insert done', { duration: Date.now() - t4 + 'ms', error: error?.message, projectId: row?.id });
            if (error) {
              pushSaveEvent('manual_save_via_raw_fetch_err', 'Raw-fetch project insert (no PDF) failed', autosaveEventDetail({ runId, ms: Date.now() - t4, message: error.message, status: error.status, code: error.code, phase: 'no_pdf', diag: error.diag }));
              throw error;
            }
            pushSaveEvent('manual_save_via_raw_fetch_ok', 'Raw-fetch project insert (no PDF) succeeded', autosaveEventDetail({ runId, ms: Date.now() - t4, projectId: row?.id, phase: 'no_pdf' }));
            if (consecutiveAutoSaveFailures > 0 && !isClientRecycleInFlight()) {
              runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
            }
            saveDebugLog('manual.save.request.ok', { runId, op: 'projects.insert', phase: 'no_pdf', ms: Date.now() - t4, projectId: row?.id, raw: true });
            const projectId = row?.id;
            if (!projectId) throw new Error('Project was created but no ID was returned. Please try again.');
            ctx.getState().currentProjectId = projectId;
            try { ctx.clearCheckoutExpiredAttention(); } catch (_) {}
            subscribeToProjectCheckoutChanges(projectId);
            ctx.getState().projectOwnerId = user.id;
            ctx.getState().loadedViaViewLink = false;
            ctx.getState().isViewer = false;
            ctx.getState().canCheckOut = true;
            ctx.getState().checkedOutBy = null;
            ctx.getState().checkedOutAt = null;
            ctx.getState().checkedOutEmail = null;
          }
          if (pendingNewProjectHydration && !ctx.getState().currentProjectId) {
            const h = pendingNewProjectHydration;
            ctx.getState().currentProjectId = h.projectId;
            try { ctx.clearCheckoutExpiredAttention(); } catch (_) {}
            subscribeToProjectCheckoutChanges(h.projectId);
            ctx.getState().projectOwnerId = h.userId;
            ctx.getState().loadedViaViewLink = false;
            ctx.getState().isViewer = false;
            ctx.getState().canCheckOut = true;
            ctx.getState().checkedOutBy = null;
            ctx.getState().checkedOutAt = null;
            ctx.getState().checkedOutEmail = null;
          }
          orphanProjectIdForCleanup = null;
          pendingNewProjectHydration = null;
          break manualSaveLoop;
        } catch (innerErr) {
          if (manualSaveAttempt === 0 && originalProjectId && isTransientSaveError(innerErr)) {
            saveDebugLog('manual.save.retry', { runId, message: innerErr?.message });
            pushSaveEvent('manual_save_retry', 'Transient save error, retrying once', innerErr?.message || '');
            manualSaveAttempt++;
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          throw innerErr;
        }
      }
      ctx.getState().currentProjectName = name;
      if (willUploadPdf && pdfToUpload && ctx.getState().currentProjectId && cachePdfHash) {
        ctx.withTimeout(pdfCachePut(ctx.getState().currentProjectId, new Blob([pdfToUpload]), cachePdfHash), 5000, 'PDF cache put')
          .catch((cacheErr) => {
            saveDebugLog('manual.save.pdf_cache_put_err', { runId, message: cacheErr?.message });
            if (!pdfCacheWarnShown) {
              pdfCacheWarnShown = true;
              pushSaveEvent(
                'manual_save_cache_warn',
                'Local PDF cache failed - recovery from a detached buffer may not work',
                cacheErr?.message || ''
              );
            }
          });
      }
      ctx.getState().pdfBuffer = null;
      ctx.getState().pdfBufferSize = 0;
      if (pdfPath) ctx.getState().pdfStoragePath = pdfPath;
      if (cachePdfHash) ctx.getState().pdfHash = cachePdfHash;
      if (pdfPath && prevPdfStoragePath && prevPdfStoragePath !== pdfPath) {
        ctx.withTimeout(
          ctx.getSupabase().storage.from('pdfs').remove([prevPdfStoragePath]),
          10000,
          'PDF cleanup remove'
        )
          .then((res) => {
            const error = res && res.error;
            if (error) saveDebugLog('manual.save.pdf_cleanup_err', { runId, message: error.message, path: prevPdfStoragePath });
            else       saveDebugLog('manual.save.pdf_cleanup_ok',  { runId, path: prevPdfStoragePath });
          })
          .catch((err) => saveDebugLog('manual.save.pdf_cleanup_err', { runId, message: err?.message, path: prevPdfStoragePath }));
      }
      ctx.setLastSaveIncludedPdf(willUploadPdf);
      ctx.getState().lastSavedAt = new Date().toISOString();
      if (ctx.isSupabaseEnabled() && ctx.getState().currentProjectId && user) {
        try {
          localStorage.setItem('clickcount-last-project', JSON.stringify({
            projectId: ctx.getState().currentProjectId,
            projectName: ctx.getState().currentProjectName || 'Untitled',
            pdfStoragePath: ctx.getState().pdfStoragePath || null,
            pdfHash: ctx.getState().pdfHash || null,
            userId: user.id
          }));
        } catch (_) {}
      }
      // Graduation cleanup: a projectless session that just became a cloud
      // project leaves a stale anonymous 'local' takeoff backup behind. That
      // 'local' snapshot would otherwise shadow this project at next boot
      // (boot prefers 'local' over clickcount-last-project), so drop it.
      if (!originalProjectId && ctx.getState().currentProjectId) {
        takeoffBackupDelete('local').catch(() => {});
      }
      log('Save complete');
      saveDebugLog('manual.save.complete', { runId });
      lastCloudSaveAttemptFailed = false;
      autoSaveDirty = (getDirtyGeneration() !== genAtEntry);
      pushSaveEvent('manual_save_ok', 'Manual save to cloud completed', autosaveEventDetail({ runId, genAtEntry, genNow: getDirtyGeneration(), stillDirty: autoSaveDirty }));
      saveProgressMessage = '';
      ctx.updateUI();
      return { ok: true };
    } catch (e) {
      console.error('[Save] Failed:', e);
      saveDebugLogError(runId, 'manual.save', e);
      log('Save failed', { message: e?.message, details: e?.details, hint: e?.hint });
      window.lastSaveError = e;
      if (orphanProjectIdForCleanup) {
        const orphanId = orphanProjectIdForCleanup;
        try {
          await ctx.withTimeout(ctx.getSupabase().from('projects').delete().eq('id', orphanId), 5000, 'Orphan project cleanup');
          pushSaveEvent('manual_save_orphan_cleanup_ok', 'Orphan project row deleted after save failure', JSON.stringify({ projectId: orphanId }));
        } catch (cleanupErr) {
          pushSaveEvent('manual_save_orphan_cleanup_err', 'Orphan project cleanup failed', JSON.stringify({ projectId: orphanId, message: cleanupErr?.message }));
        }
      }
      writeTakeoffBackupToIndexedDB();
      pushSaveEvent('manual_save_err', (e && e.message) || 'Manual save failed', formatSaveStatusErrDetail(e));
      lastCloudSaveAttemptFailed = true;
      autoSaveDirty = wasDirty || (getDirtyGeneration() !== genAtEntry);
      ctx.updateSaveStatusIndicator();
      try { localStorage.setItem('clickcount-save-error', JSON.stringify({ msg: e?.message, details: e?.details, hint: e?.hint, code: e?.code })); } catch (_) {}
      saveProgressMessage = '';
      ctx.updateUI();
      return { ok: false, error: e };
    } finally {
      saveInProgress = false;
      savePdfInProgress = false;
      saveProgressMessage = '';
    }
  }

  // One-shot PDF upload: closes the gap where a project has annotations + a
  // local PDF but no cloud storage object (e.g. created via Prepare PDF "Open",
  // then only autosaved). Autosave never uploads the file, so without this the
  // PDF would stay local until a manual Save-with-PDF. This runs from the
  // autosave interval tick and Turn In, but only when there is genuinely a
  // local-only PDF that is reachable (in memory or recoverable from cache),
  // and it stops firing once pdf_path is set.
  let pdfOneShotUploadInFlight = false;
  let pdfOneShotNextAttemptAt = 0;
  async function uploadLocalPdfToCloudIfNeeded(reason, opts) {
    opts = opts || {};
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabase() || !ctx.getState().supabaseSession?.user) return { skipped: true, reason: 'no_supabase' };
    if (!ctx.getState().currentProjectId) return { skipped: true, reason: 'no_project' };
    if (!ctx.getState().pages.length) return { skipped: true, reason: 'no_pages' };
    if (ctx.getState().pdfStoragePath) return { skipped: true, reason: 'already_in_cloud' };
    if (ctx.getState().isViewer) return { skipped: true, reason: 'viewer' };
    if (ctx.isAutoSaveSuspended()) return { skipped: true, reason: 'suspended' };
    if (saveInProgress) return { skipped: true, reason: 'save_in_progress' };
    if (pdfOneShotUploadInFlight) return { skipped: true, reason: 'in_flight' };
    // Turn In passes ignoreBackoff so an explicit user action is not blocked by
    // a prior background tick's failure backoff window.
    if (!opts.ignoreBackoff && Date.now() < pdfOneShotNextAttemptAt) return { skipped: true, reason: 'backoff' };
    // Large first-PDF uploads still run from the background autosave tick (so a
    // PDF opened via "Open", without an explicit Save/Turn In, still reaches the
    // cloud), but they cannot tight-loop: the pdfOneShotUploadInFlight guard
    // prevents overlapping ticks, the resumable/TUS path resumes rather than
    // restarts, the size-aware timeout avoids premature failure, and a failed
    // large upload backs off PDF_ONESHOT_LARGE_BACKOFF_MS (5 min) rather than 30s.
    const pdfBytesApprox = (ctx.getState().pdfBuffer && (ctx.getState().pdfBuffer.byteLength || ctx.getState().pdfBuffer.length)) || ctx.getState().pdfBufferSize || 0;
    const isLargePdf = pdfBytesApprox > PDF_RESUMABLE_THRESHOLD_BYTES;
    // Verify a usable PDF buffer is reachable before invoking the cloud save so
    // we don't trip performSaveProjectToCloud's detached-PDF error path (which
    // flips the save-status bell to a failure state). pdf.js detaches the
    // in-memory buffer after rendering, so fall back to the IndexedDB cache.
    let hasUsableBuffer = !!(ctx.getState().pdfBuffer && (ctx.getState().pdfBuffer.byteLength || ctx.getState().pdfBuffer.length || 0) > 0);
    if (!hasUsableBuffer && ctx.getState().pdfBufferSize > 0 && ctx.getState().pdfHash) {
      try {
        const cached = await pdfCacheGet(ctx.getState().currentProjectId, ctx.getState().pdfHash);
        if (cached && cached.size > 0) hasUsableBuffer = true;
      } catch (_) {}
    }
    if (!hasUsableBuffer) return { skipped: true, reason: 'no_usable_buffer' };
    pdfOneShotUploadInFlight = true;
    pushSaveEvent('pdf_oneshot_upload_start', 'Uploading local PDF to cloud', JSON.stringify({ reason }));
    try {
      const result = await performSaveProjectToCloud({ name: ctx.getState().currentProjectName || 'Untitled', includePdf: true });
      if (result && result.ok) {
        pushSaveEvent('pdf_oneshot_upload_ok', 'Local PDF uploaded to cloud', JSON.stringify({ reason }));
        pdfOneShotNextAttemptAt = 0;
      } else {
        pdfOneShotNextAttemptAt = Date.now() + (isLargePdf ? PDF_ONESHOT_LARGE_BACKOFF_MS : PDF_ONESHOT_BACKOFF_MS);
        pushSaveEvent('pdf_oneshot_upload_err', 'Local PDF upload failed', JSON.stringify({ reason, message: result?.error?.message, code: result?.error?.code }));
      }
      return result || { ok: false };
    } catch (e) {
      pdfOneShotNextAttemptAt = Date.now() + (isLargePdf ? PDF_ONESHOT_LARGE_BACKOFF_MS : PDF_ONESHOT_BACKOFF_MS);
      pushSaveEvent('pdf_oneshot_upload_err', 'Local PDF upload threw', JSON.stringify({ reason, message: e?.message }));
      return { ok: false, error: e };
    } finally {
      pdfOneShotUploadInFlight = false;
    }
  }

  // --- [sync] Auto-save (Stage 6) -----------------------------------------
  async function performAutoSave(externalRunId) {
    const runId = externalRunId || saveDebugRunId();
    if (!ctx.isSupabaseEnabled() || !ctx.getSupabase() || !ctx.getState().supabaseSession?.user) {
      saveDebugLog('autosave.skip', { runId, reason: 'no_supabase_or_user' });
      return { ok: false, error: null };
    }
    if (saveInProgress) {
      saveDebugLog('autosave.skip', { runId, reason: 'save_in_progress' });
      return { ok: false, error: null };
    }
    if (!ctx.getState().pages.length && !ctx.getState().currentProjectId) {
      saveDebugLog('autosave.skip', { runId, reason: 'no_pages_no_project' });
      return { ok: false, error: null };
    }
    if (ctx.getState().isViewer) {
      saveDebugLog('autosave.skip', { runId, reason: 'viewer' });
      return { ok: false, error: null };
    }
    if (ctx.isAutoSaveSuspended() && externalRunId !== 'checkout_recovered') {
      saveDebugLog('autosave.skip', { runId, reason: 'suspended_pending_recheckout' });
      return { ok: false, error: { code: 'CHECKOUT_EXPIRED' } };
    }
    const user = ctx.getState().supabaseSession.user;
    if (ctx.getState().currentProjectId && ctx.getState().checkedOutBy === user.id && ctx.getState().checkedOutAt) {
      const checkedAt = new Date(ctx.getState().checkedOutAt).getTime();
      const ageMs = ctx.serverNowMs() - checkedAt;
      if (ageMs > CHECKOUT_INACTIVITY_MS + CHECKOUT_SOFT_GRACE_MS) {
        saveDebugLog('autosave.skip', { runId, reason: 'checkout_expired', ageMs, mode: 'hard_skew' });
        return { ok: false, error: { code: 'CHECKOUT_EXPIRED' } };
      }
      if (ageMs > CHECKOUT_INACTIVITY_MS - CHECKOUT_NEAR_EXPIRY_MS) {
        const probe = await probeCheckoutLock(runId);
        if (probe.expired) {
          saveDebugLog('autosave.skip', { runId, reason: 'checkout_expired', ageMs, mode: 'probe' });
          return { ok: false, error: { code: 'CHECKOUT_EXPIRED' } };
        }
      }
    }
    const t0 = Date.now();
    const genAtEntry = getDirtyGeneration();
    autoSaveDirty = false;
    const data = {
      version: 1,
      counters: ctx.getState().counters,
      lineTypes: ctx.getState().lineTypes,
      iconNames: ctx.getState().iconNames || {},
      iconOrder: ctx.getState().iconOrder || null,
      customIconPaths: ctx.getUserCustomIcons(),
      maxZoom: ctx.getMaxZoom(),
      groups: ctx.getState().groups || [],
      rooms: ctx.getState().rooms || [],
      legendSettings: ctx.getState().legendSettings,
      multiplyZoneSettings: ctx.getState().multiplyZoneSettings,
      showGridOverlay: ctx.getState().showGridOverlay,
      gridSettings: ctx.getState().gridSettings,
      pages: ctx.getState().pages.map((p, i) => ({ index: i, label: p.label, canvases: p.canvases, scale: p.scale, rotation: p.rotation ?? 0, bakeFrame: ctx.computePageBakeFrame(p) })),
      activeCanvasIdByPage: ctx.getState().activeCanvasIdByPage || {},
      numberKeyBindings: ctx.getState().numberKeyBindings || {}
    };
    const counts = getProjectCounts(data);
    const dataSize = JSON.stringify(data).length;
    ctx.perfLog('performAutoSave JSON.stringify', Date.now() - t0, { dataSize, pages: ctx.getState().pages.length });
    const name = ctx.getState().currentProjectName || 'Untitled';
    saveDebugLog('autosave.payload', {
      runId,
      projectId: ctx.getState().currentProjectId || null,
      dataSize,
      pages: ctx.getState().pages.length,
      counter_count: counts.counter_count,
      line_count: counts.line_count,
      willInsert: !ctx.getState().currentProjectId
    });
    const tTotal = Date.now();
    saveInProgress = true;
    let _resolveAutoSaveInFlight = null;
    inFlightAutoSavePromise = new Promise(r => { _resolveAutoSaveInFlight = r; });
    let storageInfoFailedThisCall = false;
    let storageInfoMs = 0;
    let storageInfoStatus = 'not_run';
    let lastAttemptUsedRawFetch = false;
    let lastAttemptOpMs = 0;
    let lastAttemptPhase = 'init';
    let attempt = 0;
    try {
      pushSaveEvent(
        'autosave_start',
        ctx.getState().currentProjectId ? 'Autosave: updating project in cloud' : 'Autosave: creating project in cloud',
        autosaveEventDetail({
          runId,
          projectId: ctx.getState().currentProjectId || null,
          dataSize,
          pages: ctx.getState().pages.length,
          hasPdfStoragePath: !!ctx.getState().pdfStoragePath,
          attempt
        })
      );
      while (true) {
        try {
          if (ctx.getState().currentProjectId) {
            let sizeBytes = dataSize;
            const skipStorageInfoForDegraded = consecutiveAutoSaveFailures > 0;
            if (ctx.getState().pdfStoragePath && !storageInfoFailedThisCall && !skipStorageInfoForDegraded) {
              const t1 = Date.now();
              try {
                const { data: info } = await ctx.withTimeout(ctx.getSupabase().storage.from('pdfs').info(ctx.getState().pdfStoragePath), STORAGE_INFO_TIMEOUT_MS, 'Storage info');
                storageInfoMs = Date.now() - t1;
                storageInfoStatus = 'ok';
                ctx.perfLog('performAutoSave storage.info', storageInfoMs, { path: ctx.getState().pdfStoragePath });
                const sz = info && (info.metadata?.size ?? info.size);
                if (typeof sz === 'number' && sz >= 0) sizeBytes += sz;
                saveDebugLog('autosave.storage.info.ok', { runId, ms: storageInfoMs, path: ctx.getState().pdfStoragePath, pdfSizeBytes: typeof sz === 'number' ? sz : null, sizeBytes });
              } catch (se) {
                storageInfoMs = Date.now() - t1;
                storageInfoStatus = 'err';
                storageInfoFailedThisCall = true;
                saveDebugLog('autosave.storage.info.error', { runId, ms: storageInfoMs, message: se?.message, name: se?.name });
                pushSaveEvent('autosave_storage_info_err', 'Storage size check failed', autosaveEventDetail({ runId, ms: storageInfoMs, message: se?.message, name: se?.name, attempt }));
                noteSupabaseJsFailure('autosave.storage.info', se);
              }
            } else if (ctx.getState().pdfStoragePath) {
              storageInfoStatus = storageInfoFailedThisCall ? 'skipped_failed' : 'skipped_degraded';
              pushSaveEvent('autosave_storage_info_skipped', 'Skipping size check while sync is degraded', autosaveEventDetail({ runId, reason: storageInfoStatus, attempt }));
            }
            const updatePayload = { name, data, size_bytes: sizeBytes, counter_count: counts.counter_count, line_count: counts.line_count, updated_at: new Date().toISOString() };
            if (ctx.getState().checkedOutBy === user.id) updatePayload.checked_out_at = new Date().toISOString();
            const useRawFetch = (consecutiveAutoSaveFailures >= 3) || (attempt > 0 && lastAttemptUsedRawFetch === false && lastAttemptPhase === 'projects.update');
            lastAttemptUsedRawFetch = useRawFetch;
            lastAttemptPhase = 'projects.update';
            saveDebugLog('autosave.request.start', { runId, op: 'projects.update', projectId: ctx.getState().currentProjectId, timeoutMs: AUTOSAVE_TIMEOUT_MS, attempt, raw: useRawFetch });
            pushSaveEvent('autosave_request_start', useRawFetch ? 'Updating project (raw fetch)' : 'Updating project', autosaveEventDetail({ runId, op: 'projects.update', attempt, raw: useRawFetch }));
            const t3 = Date.now();
            let opErr = null;
            if (useRawFetch) {
              const op = ctx.withTimeout((signal) => rawProjectsUpdate(ctx.getState().currentProjectId, updatePayload, signal), AUTOSAVE_TIMEOUT_MS, 'Update project');
              inFlightAutoSaveController = op.controller;
              try {
                await op;
              } catch (rawErr) {
                opErr = rawErr;
              }
            } else {
              const op = ctx.withTimeout((signal) => ctx.getSupabase().from('projects').update(updatePayload).eq('id', ctx.getState().currentProjectId).abortSignal(signal), AUTOSAVE_TIMEOUT_MS, 'Update project');
              inFlightAutoSaveController = op.controller;
              const { error } = await op;
              opErr = error || null;
            }
            const updMs = Date.now() - t3;
            lastAttemptOpMs = updMs;
            ctx.perfLog('performAutoSave projects.update', updMs, { projectId: ctx.getState().currentProjectId, raw: useRawFetch });
            recordAutosaveLatency(updMs);
            if (opErr) {
              pushSaveEvent('autosave_request_end', useRawFetch ? 'Update failed (raw fetch)' : 'Update failed', autosaveEventDetail({ runId, op: 'projects.update', attempt, raw: useRawFetch, ms: updMs, ok: false, message: opErr?.message, code: opErr?.code, status: opErr?.status }));
              if (useRawFetch) pushSaveEvent('autosave_via_raw_fetch_err', 'Raw-fetch update failed', autosaveEventDetail({ runId, ms: updMs, message: opErr?.message, status: opErr?.status, diag: opErr?.diag }));
              throw opErr;
            }
            pushSaveEvent('autosave_request_end', useRawFetch ? 'Update OK (raw fetch)' : 'Update OK', autosaveEventDetail({ runId, op: 'projects.update', attempt, raw: useRawFetch, ms: updMs, ok: true }));
            if (useRawFetch) {
              pushSaveEvent('autosave_via_raw_fetch_ok', 'Raw-fetch update succeeded', autosaveEventDetail({ runId, ms: updMs }));
              if ((consecutiveAutoSaveFailures > 0 || attempt > 0) && !isClientRecycleInFlight()) {
                runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
              }
            }
            saveDebugLog('autosave.request.ok', { runId, op: 'projects.update', ms: updMs, projectId: ctx.getState().currentProjectId, raw: useRawFetch });
          } else {
            let sizeBytes = dataSize;
            if (ctx.getState().pdfBuffer) {
              sizeBytes += ctx.getState().pdfBuffer.byteLength;
            }
            // IMPORTANT: autosave never uploads the PDF file. We must NOT record
            // pdf_hash here. Doing so would poison the row — the cloud would claim
            // a PDF (pdf_hash set) while no storage object exists (pdf_path null),
            // and the manual-save hash-skip would then skip the upload forever,
            // leaving the project permanently without its PDF. pdf_hash is only
            // written once the file is actually uploaded (performSaveProjectToCloud).
            const insertData = { user_id: user.id, name, data, size_bytes: sizeBytes, pdf_path: null, counter_count: counts.counter_count, line_count: counts.line_count };
            lastAttemptPhase = 'projects.insert';
            lastAttemptUsedRawFetch = true;
            saveDebugLog('autosave.request.start', { runId, op: 'projects.insert', timeoutMs: 60000, hasPdfHash: false, attempt, raw: true });
            pushSaveEvent('autosave_request_start', 'Creating project (raw fetch)', autosaveEventDetail({ runId, op: 'projects.insert', attempt, raw: true }));
            const t4 = Date.now();
            const insertOp = ctx.withTimeout((signal) => rawProjectsInsert(insertData, signal), 60000, 'Save project');
            inFlightAutoSaveController = insertOp.controller;
            const { data: row, error } = await insertOp;
            const insMs = Date.now() - t4;
            lastAttemptOpMs = insMs;
            ctx.perfLog('performAutoSave projects.insert', insMs, { dataSize, raw: true });
            if (error) {
              pushSaveEvent('autosave_request_end', 'Create failed (raw fetch)', autosaveEventDetail({ runId, op: 'projects.insert', attempt, ms: insMs, ok: false, raw: true, message: error?.message, code: error?.code, status: error?.status }));
              pushSaveEvent('autosave_via_raw_fetch_err', 'Raw-fetch autosave insert failed', autosaveEventDetail({ runId, ms: insMs, message: error?.message, status: error?.status, code: error?.code, diag: error?.diag }));
              throw error;
            }
            const projectId = row?.id;
            if (!projectId) throw new Error('Project created but no ID returned');
            ctx.getState().currentProjectId = projectId;
            // Graduation cleanup: this branch only runs when there was no
            // currentProjectId, so the session just became a cloud project.
            // Drop the now-stale anonymous 'local' takeoff backup so it can't
            // shadow this project at next boot.
            takeoffBackupDelete('local').catch(() => {});
            try { ctx.clearCheckoutExpiredAttention(); } catch (_) {}
            subscribeToProjectCheckoutChanges(projectId);
            ctx.getState().projectOwnerId = user.id;
            ctx.getState().loadedViaViewLink = false;
            ctx.getState().isViewer = false;
            ctx.getState().canCheckOut = true;
            ctx.getState().checkedOutBy = null;
            ctx.getState().checkedOutAt = null;
            ctx.getState().checkedOutEmail = null;
            ctx.getState().currentProjectName = name;
            pushSaveEvent('autosave_request_end', 'Create OK (raw fetch)', autosaveEventDetail({ runId, op: 'projects.insert', attempt, ms: insMs, ok: true, raw: true, projectId }));
            pushSaveEvent('autosave_via_raw_fetch_ok', 'Raw-fetch autosave insert succeeded', autosaveEventDetail({ runId, ms: insMs, projectId }));
            if (consecutiveAutoSaveFailures > 0 && !isClientRecycleInFlight()) {
              runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue').catch(() => {});
            }
            saveDebugLog('autosave.request.ok', { runId, op: 'projects.insert', ms: insMs, projectId: ctx.getState().currentProjectId, raw: true });
          }
          break;
        } catch (innerErr) {
          if (!lastAttemptUsedRawFetch && lastAttemptPhase !== 'init') {
            noteSupabaseJsFailure('autosave.' + lastAttemptPhase, innerErr);
          }
          if (attempt === 0 && isTransientSaveError(innerErr)) {
            saveDebugLog('autosave.retry', { runId, message: innerErr?.message });
            pushSaveEvent('autosave_retry', 'Transient autosave error, retrying once', autosaveEventDetail({ runId, attempt, message: innerErr?.message }));
            attempt++;
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          throw innerErr;
        }
      }
      ctx.setLastSaveIncludedPdf(!!ctx.getState().pdfStoragePath);
      ctx.getState().lastSavedAt = new Date().toISOString();
      if (ctx.getState().currentProjectId && ctx.getState().supabaseSession?.user) {
        try {
          localStorage.setItem('clickcount-last-project', JSON.stringify({
            projectId: ctx.getState().currentProjectId,
            projectName: ctx.getState().currentProjectName || 'Untitled',
            pdfStoragePath: ctx.getState().pdfStoragePath || null,
            pdfHash: ctx.getState().pdfHash || null,
            userId: ctx.getState().supabaseSession.user.id
          }));
        } catch (_) {}
      }
      ctx.updateUI();
      ctx.perfLog('performAutoSave total', Date.now() - tTotal);
      saveDebugLog('autosave.complete', { runId, totalMs: Date.now() - tTotal });
      ctx.maybeLogProjectSaveEvent(ctx.getState().currentProjectId);
      lastCloudSaveAttemptFailed = false;
      autoSaveDirty = (getDirtyGeneration() !== genAtEntry);
      if (!autoSaveDirty) clearDirtyStartedAt();
      pushSaveEvent('autosave_ok', ctx.getState().currentProjectId ? 'Canvas synced with cloud (update)' : 'Canvas synced with cloud (new project)', autosaveEventDetail({ runId, totalMs: Date.now() - tTotal, attempts: attempt + 1, usedRawFetch: lastAttemptUsedRawFetch, genAtEntry, genNow: getDirtyGeneration() }));
      autoSaveAbortReason = null;
      noteAutoSaveOutcome(true, null);
      return { ok: true };
    } catch (e) {
      if (autoSaveAbortReason) {
        const reason = autoSaveAbortReason;
        autoSaveAbortReason = null;
        autoSaveDirty = true;
        saveDebugLog('autosave.aborted', { runId, reason, message: e?.message });
        return { ok: false, error: null };
      }
      console.error('[Auto-save] Failed:', e);
      saveDebugLogError(runId, 'autosave.request', e);
      window.lastSaveError = e;
      autoSaveDirty = true;
      writeTakeoffBackupToIndexedDB();
      lastCloudSaveAttemptFailed = true;
      const elapsedMs = Date.now() - tTotal;
      pushSaveEvent(
        'autosave_err',
        (e && e.message) || 'Autosave failed',
        autosaveEventDetail(Object.assign(
          serializeSaveError(e),
          {
            runId,
            elapsedMs,
            attempt,
            phase: lastAttemptPhase,
            usedRawFetch: lastAttemptUsedRawFetch,
            opMs: lastAttemptOpMs,
            storageInfoStatus,
            storageInfoMs
          }
        ))
      );
      noteAutoSaveOutcome(false, e);
      return { ok: false, error: e };
    } finally {
      saveInProgress = false;
      inFlightAutoSaveController = null;
      try { if (_resolveAutoSaveInFlight) _resolveAutoSaveInFlight(); } catch (_) {}
      inFlightAutoSavePromise = null;
    }
  }

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
        await handleBackgroundCheckoutExpired('keepalive');
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
    // Stage 5: checkout subscription & permission refresh
    subscribeToProjectCheckoutChanges,
    refreshProjectPermissions,
    // Stage 5: checkout expired recovery
    computeCheckoutExpiryAgeMs,
    reCheckOutAfterExpiry,
    resetAutoRecheckoutCounter,
    tryAutoRecheckoutIfAllowed,
    handleBackgroundCheckoutExpired,
    clearCheckoutExpiredToastShown,
    // Stage 5: Turn In core
    doTurnIn,
    isTurnInInProgress,
    resetTurnInState,
    // Stage 6: save outcome, telemetry & envelope core
    getAutoSaveDirty,
    setAutoSaveDirty,
    isSaveInProgress,
    isSavePdfInProgress,
    getSaveProgressMessage,
    getConsecutiveAutoSaveFailures,
    getNextAutoSaveAttemptAt,
    getLastSuccessfulSupabaseCallAt,
    wasLastCloudSaveAttemptFailed,
    setLastCloudSaveAttemptFailed,
    abortInFlightAutoSave,
    resetSaveFlags,
    resetAutosaveDegradedState,
    retrySyncNow,
    getProjectSummaryForLogs,
    buildSaveLogsEnvelope,
    buildSaveLogsEnvelopeWithSnapshots,
    writeSaveLogsSnapshot,
    maybeWriteDirtySnapshot,
    // Stage 6: save paths
    performSaveProjectToCloud,
    uploadLocalPdfToCloudIfNeeded,
    performAutoSave,
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

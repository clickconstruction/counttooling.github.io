# ClickCount — Implementation History

This file is the home for historical/implementation detail that used to live
inline in [AGENTS.md](AGENTS.md). For *current* behavior, read
[AGENTS.md](AGENTS.md) (conventions) and [ARCHITECTURE.md](ARCHITECTURE.md)
(feature catalog + code map). The base spec is [RECONSTITUTE.md](RECONSTITUTE.md).

The bulk below is the "Sync hardening" work — a series of PRs that made cloud
auto-save / manual-save / Turn In / checkout robust against flaky networks,
wedged `supabase-js` clients, clock skew, and multi-tab/multi-user hazards. PRs
are listed in numeric order (note: there is no separate PR 4 — the "Checkout
expired recovery UX" work occupies that slot).

---

## Sync hardening

### PR 1 — Abortable timeouts, backoff, and the sync-paused banner

- `withTimeout(promiseOrFactory, ms, label)` now accepts either a plain promise
  (legacy) or a `(signal) => promise` factory, and exposes `.controller` on the
  returned promise. The 7 Postgrest write call sites in `performAutoSave`
  (update + insert) and `performSaveProjectToCloud` (5 update/insert sites) use
  the factory form with `.abortSignal(signal)`, so the underlying fetch is
  aborted when the timer fires — freeing dead HTTP/2 sockets the browser would
  otherwise reuse.
- Autosave update timeout dropped from 30s to `AUTOSAVE_TIMEOUT_MS` (15s); manual
  save timeouts remain 30s / 60s.
- `performAutoSave` captures `inFlightAutoSaveController` per request and nulls it
  in the outer `finally`.
- `noteAutoSaveOutcome(ok, err)` tracks `consecutiveAutoSaveFailures` /
  `firstAutoSaveFailureAt` / `nextAutoSaveAttemptAt`, applies capped backoff
  `AUTOSAVE_BACKOFF_LEVELS_MS = [5000, 15000, 30000, 60000]`, shows
  `#syncPausedBanner` at `AUTOSAVE_BANNER_THRESHOLD = 3`, and emits
  `autosave_recovered` (`{failures, durationMs}`) on first success after a failure
  run.
- The autosave interval gates with `if (Date.now() < nextAutoSaveAttemptAt) return;`
  (logs `autosave.skip / reason: backoff` when debug enabled).
- `#syncPausedBanner` (above the status bar) reads "Cloud sync paused - your work
  is saved locally. Reconnecting..."; `#syncPausedBannerRetry` -> `retrySyncNow()`
  (aborts `inFlightAutoSaveController`, resets `nextAutoSaveAttemptAt = 0`, sets
  `autoSaveDirty = true`, refreshes the session, emits `manual_sync_retry`).
- `visibilitychange -> hidden` aborts `inFlightAutoSaveController` unconditionally
  before the fire-and-forget pre-close save so the next save opens a fresh socket.
  Both abort sites set `autoSaveAbortReason` (`'user_retry'` / `'hidden'`); the
  `performAutoSave` catch detects the flag and suppresses the failure path (no
  failure-count bump, no backoff, no `autosave_err`, no yellow bell).

### PR 2 — Recovery probe, milestones, latency tracking

- `runRecoveryProbe(trigger)` fires fire-and-forget at the 5th consecutive failure
  (`AUTOSAVE_RECOVERY_THRESHOLD`) and on every `window.online` event when
  `consecutiveAutoSaveFailures > 0`. It refreshes the JWT via
  `supabase.auth.getSession()` then issues a raw
  `fetch(SUPABASE_URL + '/rest/v1/projects?select=id&limit=1', {cache:'no-store', signal, headers:{apikey, Authorization}})`
  with a 5s `AbortController` timeout (`AUTOSAVE_RECOVERY_TIMEOUT_MS`), bypassing
  the supabase-js connection pool so a dead H/2 socket gets replaced.
- Success resets `nextAutoSaveAttemptAt = 0` but leaves `consecutiveAutoSaveFailures`
  and the banner intact (a real save success drives those via
  `noteAutoSaveOutcome(true)`).
- `recoveryProbeInFlight` re-entrancy flag; `recoveryProbeFiredForFailureCount`
  per-failure-run dedupe; emits `autosave_recovery_probe` / `_ok` / `_err`.
- Milestone events `autosave_failing_3` / `_5` / `_10` fire once per failure run
  (dedupe `autosaveMilestoneFiredAt`, reset in `noteAutoSaveOutcome(true)`).
- `captureNetworkInfoDetail()` attaches `{effectiveType, downlink, rtt, saveData}`
  when `navigator.connection` exists (Chromium only).
- P8 latency: `recordAutosaveLatency(updMs)` after each `projects.update`; samples
  capped at `AUTOSAVE_SLOW_WINDOW = 20`; emits `autosave_slow` `{p95, n, latest}`
  when `p95 > AUTOSAVE_SLOW_MS = 1000` after `AUTOSAVE_SLOW_MIN_SAMPLES = 10`,
  debounced by `AUTOSAVE_SLOW_DEBOUNCE_MS = 60000`.

### PR 3 — Self-sufficient telemetry, snapshots, client recycle, raw-fetch fallback

- Every autosave/manual-save/turn-in event funnels through `autosaveEventDetail(extra)`
  so the exported envelope is self-sufficient (always-on `failures`, `online`,
  `msSinceLastSuccess`, `network`, plus per-event `runId`/`elapsedMs`/`attempt`/
  `phase`/`usedRawFetch`/`opMs`/`storageInfoStatus`/`storageInfoMs`/`code`/`status`/
  `name`).
- Previously verbose-only debug logs now emit always-on `pushSaveEvent` siblings:
  `autosave_storage_info_err` / `_skipped`, `autosave_request_start` / `_end`.
- `dirty` events carry `dirtyForMs`; on the first `markProjectDirty` transition
  `dirtyStartedAt` stamps so the 5s interval triggers `writeSaveLogsSnapshot('dirty_10min')`
  once when dirty for `DIRTY_SNAPSHOT_THRESHOLD_MS` (10 min), gated by
  `envelopeSnapshotDirtyStamp` (reset on `autosave_ok`).
- IDB bumped to version 5 with a `save_logs_snapshots` store
  (`SAVE_LOGS_SNAPSHOT_STORE`, cap `SAVE_LOGS_SNAPSHOT_MAX_ENTRIES = 10`) written
  by `writeSaveLogsSnapshot(reason)` and read by `readSaveLogsSnapshots(limit=5)`.
  `buildSaveLogsEnvelopeWithSnapshots()` (async) is what the Save Status modal
  Export/Copy buttons use; it attaches `autoSnapshotEnvelopes` so a tab reloaded
  between an incident and the user opening the modal keeps the failure timeline.
- `runRecoveryProbe` chains into `runRecoveryProbeAndMaybeRecycle(trigger)`: on
  raw-probe OK it runs `runSupabaseClientProbe(trigger)`
  (`supabase.from('projects').select('id').limit(1)`, `CLIENT_PROBE_TIMEOUT_MS = 5000`,
  `clientProbeInFlightGuard`); on client-probe failure it calls
  `recreateSupabaseClient(reason)` (`removeAllChannels()`, fresh `createClient`,
  `setSession`, re-subscribe checkout channel) — gated by `clientRecycleInFlight`
  and `CLIENT_RECYCLE_COOLDOWN_MS = 30000`; emits `autosave_client_recycled` / `_err`.
- `STORAGE_INFO_TIMEOUT_MS = 3000` (down from 10s); storage.info skipped while
  `consecutiveAutoSaveFailures > 0` or after a per-call failure flag
  (`autosave_storage_info_skipped` with `reason`).
- Raw-fetch fallback for `projects.update`: `rawProjectsUpdate(projectId, payload, signal)`
  PATCHes `/rest/v1/projects?id=eq.X` (apikey + Bearer + `Prefer: return=minimal`,
  `cache:'no-store'`); engages at `failures >= 3` or after an in-run supabase-js
  update timeout. Same gating in `performSaveProjectToCloud`'s no-PDF update.
- Raw-fetch fallback for Turn In: `rawCheckInProject(projectId, signal)` POSTs
  `/rest/v1/rpc/check_in_project`; `doTurnIn` enables it at `failures >= 3` or as the
  second attempt; preserves `updateServerClockFromRpc` and the `alreadyReleased`
  regex.
- `doTurnIn` tracks `stageStartedAt` so each `progress(stage, label)` emits a
  matching `turn_in_phase_done` `{stage, durationMs, elapsedMs}`; `turn_in_ok` /
  `turn_in_err` carry `usedRawFetchForCheckIn`.

### PR 4 — Checkout expired recovery UX

- When a Turn In click returns `CHECKOUT_EXPIRED`, instead of a one-shot toast the
  client opens `#checkoutExpiredRecoveryModal` (z-index 220). Helpers:
  `openCheckoutExpiredRecoveryModal({trigger})`, `closeCheckoutExpiredRecoveryModal()`,
  and sub-modes via `applyCheckoutExpiredRecoveryMode('default' | 'someone_else' | 'error', ctx)`.
- Primary **Re-check out and save** -> `reCheckOutAfterExpiry(trigger)` calls
  `check_out_project` (8s `withTimeout`); on success `clearCheckoutExpiredAttention()`,
  set self as holder, fire-and-forget `performAutoSave('checkout_recovered')`; on RPC
  failure `refreshProjectPermissions()` then swap to "someone else is editing" or
  error mode.
- Secondary **Export local backup** re-clicks `#exportBtn`. Tertiary **Discard
  local edits and reload** confirms, gates on `!saveInProgress && !turnInInProgress`,
  clears `autoSaveDirty`, `takeoffBackupDelete(currentProjectId)`, emits
  `checkout_recover_discarded`, reloads.
- `doTurnInAndHandleResult` short-circuits to the modal when
  `checkoutExpiredNeedsAttention` is already set (`turn_in_short_circuit_expired`).
- The header `headerEditStatusBanner` and `sidebarCheckoutBanner` add a fourth
  state `edit-status-expired` (yellow, pulsing) labeled "Edit session expired —
  Re-check out"; `handleEditStatusBannerClick` routes to the recovery modal. The
  Save Status modal renders `#saveStatusExpiredCallout` while expired.
- Events: `checkout_recovered`, `checkout_recover_blocked`, `checkout_recover_err`,
  `checkout_recover_discarded`, `turn_in_short_circuit_expired`. Expiry-age via
  `computeCheckoutExpiryAgeMs()`; `checkoutExpiredRecoveryInFlight` dedupes presses.

### PR 5 — Silent self-heal (auto-recheckout) layered under the modal

- `handleBackgroundCheckoutExpired(trigger)` is the single wrapper for all
  background `CHECKOUT_EXPIRED` detections (autosave loop, `visibilitychange ->
  visible` post-probe, `checkoutKeepalive`). It sets `checkoutExpiredNeedsAttention`
  + `suspendAutoSaveUntilCheckout`, emits `checkout_expired {trigger}`, calls
  `tryAutoRecheckoutIfAllowed`, and only falls back to the one-shot toast when
  auto-recovery is blocked. (Explicit user paths still open the modal directly.)
- `tryAutoRecheckoutIfAllowed(trigger)` gated by `AUTO_RECHECKOUT_MAX_PER_PROJECT = 3`
  (`autoRecheckoutCountByProject`), `AUTO_RECHECKOUT_MIN_GAP_MS = 5000`, and
  `state.canCheckOut === true` after a fresh `refreshProjectPermissions()`. Emits
  `auto_recheckout_attempt` / `_ok` / `_blocked {reason}` / `_err`.
- `reCheckOutAfterExpiry(trigger, opts)` takes `{silent:true}` so the auto path
  suppresses the "Re-checked out..." toast.
- `resetAutoRecheckoutCounter(projectId)` on sign-out, Close Project, and explicit
  user check-out.
- `projects.insert` always uses raw fetch — `rawProjectsInsert(payload, signal)`
  (POST `/rest/v1/projects`, `Prefer: return=representation`). All three insert
  sites bypass supabase-js and emit the raw-fetch events.
- Every project teardown/switch site calls `clearCheckoutExpiredAttention()` so
  expiry state cannot leak from project A to B in the same tab.
- `performAutoSave` adds a suspend gate at entry: when
  `suspendAutoSaveUntilCheckout && externalRunId !== 'checkout_recovered'` it returns
  `{ok:false, error:{code:'CHECKOUT_EXPIRED'}}`.
- The autosave new-project insert path now mirrors the manual-save insert sites
  (subscribe to checkout changes + hydrate owner/viewer/canCheckOut).
- `saveBeforeLoadSave`'s CHECKOUT_EXPIRED branch mirrors `doTurnInAndHandleResult`.

### PR 6 — Sign-out teardown foundation

- `resetLocalSessionState({keepArtboard})` clears pages, project ids, PDF buffers,
  dirty/save/turnIn flags, undo stacks, pending canvas/copy state, checkout fields,
  and calls `resetAutosaveDegradedState()` (resets all the degraded-mode counters,
  latency samples, snapshot stamps, client-recycle state, hides `#syncPausedBanner`)
  plus clears `saveStatusLog`, user-activity caches, auto-recheckout maps,
  warn-flags, and `clearCheckoutExpiredAttention()`.
- `SIGNED_OUT` -> `resetLocalSessionState()` (default `keepArtboard:false`);
  `settingsCloseProject` -> `resetLocalSessionState({keepArtboard:true})`.
- `lastAuthUserId` tracks the signed-in user id; `TOKEN_REFRESHED` runs full reset +
  re-hydration when `session.user.id !== lastAuthUserId` (`auth_user_changed_on_refresh`).
- `BroadcastChannel('clickcount-auth')` posts `{kind:'signed_out'}`; other tabs run
  `handleCrossTabSignOut` (via channel or `clickcount-signout-broadcast` localStorage
  fallback) -> `cross_tab_signout`.
- `checkInCurrentProjectIfHeld` wraps `check_in_project` in `withTimeout(..., CHECK_IN_TIMEOUT_MS)`
  and swallows timeouts (`signout_checkin_timeout`) so a stuck RPC never blocks
  `signOut()`.

### PR 7 — Cross-user data hygiene

- `takeoffBackupGet(projectId, currentUserId)` checks `entry.userId`; on mismatch
  logs `takeoffBackup.user_mismatch`, deletes the entry, returns null. All callers
  pass `state.supabaseSession?.user?.id`.
- Custom-icons IndexedDB key is per-user: `customIconsCurrentKey()` returns
  `customIcons_${userId}` when signed in (legacy `'user'` only when no session);
  first read migrates the legacy entry (`customIcons.migrated_to_per_user`).
  `resetLocalSessionState({keepArtboard:false})` clears `customIconsCache`.
- `refreshProjectPermissions` when `!proj` after a successful RPC flips to viewer +
  suspends autosave + toasts "You no longer have access to this project."
  (`permissions_project_missing`).
- Boot-time last-session restore tags `PGRST116`/denied/permission errors as
  `projectAccessDenied` and wipes both `clickcount-last-project` and the IDB takeoff
  backup (`last_session_restore_skip_inaccessible`).

### PR 8 — Dirty-flag correctness

- `dirtyGeneration` counter, incremented by every `markProjectDirty()`.
  `performAutoSave` and `performSaveProjectToCloud` capture
  `genAtEntry = dirtyGeneration` at the top, clear `autoSaveDirty = false` inside the
  save, and on success set `autoSaveDirty = (dirtyGeneration !== genAtEntry)` so edits
  typed during a save are not lost. On failure restore `autoSaveDirty = true` (manual
  save OR-s with `wasDirty`). The autosave interval, `doTurnIn`, and
  `saveBeforeLoadSave` no longer pre-clear `autoSaveDirty`.
- `reCheckOutAfterExpiry` awaits the recovery save via `inFlightRecoverySavePromise`;
  `doTurnIn` `Promise.race`-waits up to 8s on it before starting.
- `refreshProjectPermissions` retries `list_accessible_projects` once (500ms backoff)
  and emits `refresh_permissions_err` instead of corrupting checkout state.
- Force-turn-in flush skips `performAutoSave()` when `suspendAutoSaveUntilCheckout`
  (`force_turn_in_flush_skipped_suspended`).

### PR 9 — Manual-save expiry parity

- Manual Save's `confirmedExpired` branch stops flipping `state.isViewer` /
  `canCheckOut` locally; instead `await handleBackgroundCheckoutExpired('manual_save')`
  + `refreshProjectPermissions()`, and if not silently recovered, opens
  `openCheckoutExpiredRecoveryModal({trigger:'manual_save'})` — matching Turn In and
  `saveBeforeLoadSave`.
- `handleBackgroundCheckoutExpired` reentrancy-guarded by
  `backgroundCheckoutExpiredInFlight` so concurrent detections produce one event and
  one modal.
- `markProjectDirty`'s `refresh_checkout_activity` call gated on
  `!suspendAutoSaveUntilCheckout && !checkoutExpiredNeedsAttention` so edits in an
  expired state never extend the server lock.
- `tryAutoRecheckoutIfAllowed` no longer increments the cap before the RPC; transient
  errors do not consume the cap.
- Admin force turn-in success (`settingsForceCheckIn`, `forceCheckInProjectFromManage`)
  calls `clearCheckoutExpiredAttention()` + `resetAutoRecheckoutCounter`.

### PR 10 — Save-path failure safety

- `performSaveProjectToCloud` with-PDF new-project flow defers state hydration until
  after the PDF upload AND `projects.update` succeed; it captures
  `orphanProjectIdForCleanup` + `pendingNewProjectHydration` and, on failure between
  insert and update, deletes the orphan row (`manual_save_orphan_cleanup_ok` / `_err`).
- Centralized `assertPdfWithinLimit(bytes, context)` (50MB ceiling, emits
  `pdf_size_exceeded`); called from `commitPreparePdfToState` and before
  `storage.upload`.
- `writeTakeoffBackupToIndexedDB` gated by `takeoffBackupWriteInFlight` so concurrent
  callers reuse the in-flight write (`takeoff_backup_skip_inflight`);
  `writeTakeoffStateBackup` awaits an in-flight backup instead of starting a second.

### PR 11 — Boot + view-link ordering

- Boot order: `initSupabaseAuth()` runs BEFORE `takeoffBackupGet('local', uid)` +
  `applyTakeoffBackupToState`, so cross-user takeoff data never flashes before auth
  resolves. Legacy `localStorage.takeoff-state` is filtered by `userId`
  (`takeoff_backup_skip_other_user`).
- `initViewOnlyMode` follows up with `initSupabaseAuth()` so view-link tabs see the
  session (`view_link_session_attached`); forces viewer/canCheckOut/loadedViaViewLink.
- `doGlobalReloadNow` writes a `clickcount-pending-global-reload` stamp; the real
  `GLOBAL_RELOAD_STAMP_KEY` commits only after `load`/`pageshow` confirms the reload
  (`global_reload_committed`), so a blocked reload retries next time.

### PR 12 — Wedged-supabase-js recovery

- `isTransientSaveError` regex widened to match `withTimeout`'s own
  "… timed out after Ns" messages plus `AbortError` / `ECONNRESET` /
  `connection closed` / `socket`, so the once-only retry in `doTurnIn`,
  `performAutoSave`, and `performSaveProjectToCloud` actually fires on its own
  timeouts.
- The five raw-fetch-OK sites fire-and-forget
  `runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue')` when
  `consecutiveAutoSaveFailures > 0 && !clientRecycleInFlight`, so a session where
  raw-fetch papered over a wedged supabase-js client now actively probes + recycles.
- `lastSupabaseJsFailureAt` stamps from any supabase-js error path
  (`noteSupabaseJsFailure(context, err)`, `sbjs_failure_recorded`). `doTurnIn`
  consumes it as `sbJsRecentlyBad = now - lastSupabaseJsFailureAt < 5min` and ORs it
  into `looksStale` and `useRawForCheckIn` (attempt 0 bypasses the wedged client);
  emits `turn_in_raw_fetch_engaged_proactively`.
- The `doTurnIn` catch treats any `/timed?\s*out/i` as always-retryable (belt and
  suspenders); retry event carries `viaTimedOutCatch:true`.
- `recreateSupabaseClient` skip paths emit `client_recycle_skipped_inflight` /
  `client_recycle_skipped_cooldown`.
- `noteAutoSaveOutcome` recycle gate lowered to fire from `failures >= 3` (per-level
  dedupe), `trigger` `'failure_threshold_early'` at 3-4 / `'failure_threshold'` at >=5;
  `CLIENT_RECYCLE_COOLDOWN_MS = 30000` prevents storms.
- `inFlightAutoSavePromise` created at `performAutoSave` entry; `doTurnIn` bounded
  `Promise.race([inFlightAutoSavePromise, sleep(3000)])` between the optional
  pre-checkin save and `release_lock` so a concurrent autosave finishes (or times
  out) before `check_in_project` competes for the same socket
  (`turn_in_await_inflight_autosave`).
- `CHECK_IN_TIMEOUT_MS` raised 8000 -> 10000 ms.
- Localhost-only `IS_DEV_HOST` block adds `console.assert` self-tests for
  `isTransientSaveError` so the regex regression cannot reappear silently.

---

## Other notable historical detail

- **Checkout server time / clock skew** — `check_out_project` and
  `refresh_checkout_activity` return `server_now` + `checked_out_at` (migration 038);
  the client tracks `serverClockOffsetMs` via `updateServerClockFromRpc` and uses
  `serverNowMs()` for all expiry math, so client clock skew never produces false
  "edit session expired" toasts. Migration 040 extends `check_in_project` /
  `force_check_in_project` to return `server_now` too. Migration 039 adds a BEFORE
  UPDATE trigger so `projects.updated_at` is server-set, removing multi-tab staleness
  races against IDB backups.
- **Checkout realtime channel** — `subscribeToProjectCheckoutChanges` is async, gates
  every callback on a captured `projectsCheckoutGeneration` token (rapid project
  switches cannot leak channels), uses capped backoff reconnect
  (`PROJECTS_CHECKOUT_RECONNECT_BACKOFF_MS` = 1s/3s/10s/30s), and forces one
  `refreshProjectPermissions` on `SUBSCRIBED`.
- **Save Status verbose mode** — `localStorage.clickcount-debug-save` (via
  `setSaveDebugEnabled`) tees `saveDebugLog` into `saveStatusLog` as kind `debug`
  (4 KB cap) and extends the rolling window from 5 to 60 minutes.
- **Manual-save PDF-mismatch guard** — Save Project modal blocks at a confirm when
  `!includePdf && state.pdfHash !== projects.pdf_hash` (`manual_save_canceled` /
  `manual_save_pdf_mismatch_accepted`), preventing saving new-PDF annotations against
  the old cloud PDF. `performSaveProjectToCloud` best-effort removes the previous
  storage object after a successful PDF replacement (`manual.save.pdf_cleanup_ok` /
  `_err`).
- **Prepare PDF append mode** — `openPreparePdfModal(..., {mode:'append'})` merges the
  trimmed buffer onto `state.pdfBuffer`, appends pages, re-binds `pdfPage` refs to the
  merged document, enforces the 50MB ceiling, and resets `pdfStoragePath` / `pdfHash`
  so the next save re-uploads.

---

## Modularization

A long-running effort to make the codebase more navigable by decomposing the one
monolithic `app.js` IIFE without a build step (the app stays vanilla
HTML/CSS/JS, classic `<script src>` only). `app.js` went from ~16.2k to ~13.7k
lines via two complementary techniques. *Current* structure lives in
[AGENTS.md](AGENTS.md) ("Tech constraints" / "`window.App` registry") and
[ARCHITECTURE.md](ARCHITECTURE.md) ("Files" / "Feature files"); this section is
the history and the rationale behind the patterns.

### Pure-module extraction

Self-contained math/data/format/storage helpers (no `state` / DOM / `window`
dependency) were lifted into standalone classic scripts loaded **before**
`app.js`, each ending in a guarded CommonJS export footer (inert in the browser,
`require()`-able in Node) so a sibling `*.test.js` can unit-test it under
`node --test`. Where a helper needed `state`-derived values, the pure function
took them as arguments and `app.js` kept a same-named **thin wrapper** that
resolves the value and delegates — so call sites (and the `report.js` `window.*`
contract) never changed.

- [geometry.js](geometry.js) — pure math/geometry/parse primitives (`ptDist`,
  `polylineDistance`, `polygonArea`, `distToSegment`, bezier helpers,
  `rotatePoint90CW`, zone locators, `parseRealWorldLength`, `formatAgo`, …).
- [constants.js](constants.js) — module-level constant literals (`TOOL`,
  `SCALE_MODES`, `PLUMBING_DEFAULTS`, `LINE_DEFAULTS`, `COLORS`, `SCALE_PRESETS`,
  the autosave/checkout timing & threshold block, IndexedDB store names + caps,
  Save Status log windows, …).
- [idb.js](idb.js) — the IndexedDB storage layer (`openPdfCacheDb` + the
  context-free `viewCache*` / `pdfCache*` / `takeoffBackup*` / save-logs
  accessors + pure primitives); `app.js` keeps the state/logging-coupled
  `takeoffBackupGet/Put`, `writeSaveLogsSnapshots`, `customIcons*` wrappers.
  Unit-tested with the `fake-indexeddb` devDependency.
- [format.js](format.js) — pure date/time/text formatters for the User Activity
  UI (`formatLastSignIn`, `dateKeyInTimeZone`, `filterUserActivityRows`,
  `renderUserActivityAllUsersTableHtml`, …); the DOM-coupled
  `applyUserActivityFilter` / `populateUserActivityUserSelect` stay in `app.js`.
- [icon-render.js](icon-render.js) — pure icon geometry / render-rule helpers
  (`CUSTOM_ICON_META`, `iconMetaFromList`, `iconViewBoxFromList`,
  `iconRenderVbRule`, `iconSvgHtml`, …); the user-icon-cache-coupled
  `getCustomIconMeta`, `renderIconHtml`, … stay in `app.js` as wrappers that
  inject `getEffectiveCustomIcons()`. Loaded after [icons.js](icons.js).
- [line-metrics.js](line-metrics.js) — pure line length/geometry helpers mined
  from the line-totals region (`getLineGeomPdfPts` and friends), taking
  scale/zone inputs as arguments; `app.js` keeps the `window.*` wrappers
  (`quickLineLength`, `getLineLengthForTotals`, …) consumed by `report.js`.
- [save-utils.js](save-utils.js) — pure save/sync helpers. Started as
  `isTransientSaveError` / `getProjectCounts`; later expanded with
  `serializeSaveError`, `formatSaveStatusErrDetail`, `backoffDelayMs`,
  `computeClockOffsetMs`, and `percentile`, consolidating error-serialization and
  timing math that had been inline in the sync-hardening code.

ESLint's flat config grew per-module global groups so each pure module sees only
its own dependencies' exports as `readonly` (avoiding `no-redeclare`), and the
`app.js` group auto-derives the sibling modules' exports as `readonly` globals.

### `window.App` registry (feature-file splits)

`app.js` is one big IIFE, so code moved to a separate `<script>` can't see its
closure-locals by bare name. The bridge is a `window.App` registry: `app.js`
publishes the shared surface near its tail (`App.state = state;
App.renderPdf = renderPdf; …`), and each `features/<name>.js` is its own IIFE
that reads deps from `App.*` **at call time** and registers its public entry
points back onto `App`. Call sites in `app.js` use deferred arrows
(`() => App.fn()`) so they never capture a binding before the feature file
loads. Feature files load **after** `app.js` and **before** `report.js`.

Patterns that emerged as the harder modals moved out:

- **Publish-only deps** — a helper used widely in `app.js` stays defined there
  and is merely exposed on `App` (only the feature's *own* functions relocate).
- **Getter-accessor** — for engine-owned `let`s that get reassigned
  (`saveStatusLog`, `checkoutExpiredNeedsAttention`, `supabase`), publish a
  getter (`App.getX = () => x;`) so features always read the live value, never a
  stale module-load snapshot.
- **Deferred wrapper** — sloppy-mode hoisted block-scoped functions assigned at
  runtime (e.g. `resetAutoRecheckoutCounter`) are published as
  `App.fn = (...a) => fn(...a)` to defer lookup to call time.
- **Bidirectional / callback registration** — when a moved modal and `app.js`
  call each other, both sides register on `App` (or the feature exposes a
  callback like `App.onGroupModalHidden`).

The 19 feature files in load order, each with a `*.spec.js` Playwright
regression (cloud-gated specs `test.skip` when Supabase secrets are absent):

1. [features/canvas-repair.js](features/canvas-repair.js) — Canvas Repair modal
   (first split; introduced the registry).
2. [features/note.js](features/note.js) — Note add/edit modal.
3. [features/zoom.js](features/zoom.js) — Zoom Settings modal.
4. [features/manage-icons.js](features/manage-icons.js) — Manage Icons modal
   (first multi-region move).
5. [features/multiply-zone-settings.js](features/multiply-zone-settings.js) —
   Multiply Zone settings modal.
6. [features/export-pdfs.js](features/export-pdfs.js) — Export PDFs modal's
   `specificPages*` cluster (largest single move; 9 publish-only deps).
7. [features/legend-settings.js](features/legend-settings.js) — Summary Legend
   settings modal.
8. [features/page-settings.js](features/page-settings.js) — Page settings modal.
9. [features/counter-settings.js](features/counter-settings.js) — Counter
   settings modal (first two-region consolidation).
10. [features/line-type-settings.js](features/line-type-settings.js) — Line Type
    settings modal.
11. [features/choose-create-line-type.js](features/choose-create-line-type.js) —
    Choose/Create Line Type modal.
12. [features/scale.js](features/scale.js) — Set Scale modal (per-page / zone
    scale).
13. [features/groups.js](features/groups.js) — Group + Group Assign modals
    (bidirectional callback for modal-hidden).
14. [features/grid.js](features/grid.js) — Grid overlay toggle + settings.
15. [features/quick-line.js](features/quick-line.js) — Quick Line modal +
    line-modifier preview.
16. [features/counter.js](features/counter.js) — Counter modal (Choose/Create/
    Icon tabs).
17. [features/save-status.js](features/save-status.js) — Save Status modal UI
    (getter-accessor + deferred-wrapper patterns).
18. [features/manage-projects.js](features/manage-projects.js) — Manage Projects
    admin modal (Supabase-gated).
19. [features/user-admin.js](features/user-admin.js) — Manage-Users admin modals
    (create/delete user, all-users; Supabase-gated).

### Tooling

`npm run check` (lint + `test:unit` + `build:toc --check`) runs on every push/PR
via [.github/workflows/ci.yml](.github/workflows/ci.yml) (Node 20; Playwright is
excluded since it needs a server + Supabase/dev-auth secrets). The
[ARCHITECTURE.md](ARCHITECTURE.md) section index is regenerated from the
`// SECTION:` markers by `npm run build:toc`
([scripts/build-toc.js](scripts/build-toc.js)); section markers were renamed or
removed as their code emptied out into feature files.

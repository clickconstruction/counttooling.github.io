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

## refactor(save-engine): Stage 3 — the storage ring

Third stage: `probeCheckoutLock` (which **graduates from the ctx to
engine-internal** — the keep-alive now calls it directly), `sha256Hex`, the
`takeoffBackupGet`/`takeoffBackupPut` cross-user-mismatch + one-shot-warn
wrappers, and the whole three-layer local-backup writer
(`writeTakeoffStateBackup` → `writeTakeoffBackupToIndexedDB` → the takeoff
serializer) move behind the seam, with the engine owning
`takeoffBackupWriteInFlight`, `takeoffBackupWarnShown`, and the
`lastLocalBackupAt`/`lastLocalBackupOk` stamps. The 1s dirty→backup debounce
also graduated from ctx (`markProjectDirty` kicks it internally). App-side:
the 5s interval + the visibilitychange backup kick call the wrappers;
`updateStatus` reads the stamp via a shadowing
`const lastLocalBackupAt = saveEngine.getLastLocalBackupAt()`;
`BACKUP_PDF_TO_INDEXEDDB` is now solely the idb.js classic-script global
(exported from its footer for lint/tests; app.js's duplicate const removed).
ctx grew by 6 (serverNowMs, noteSupabaseCallOk, perfLog, getUserCustomIcons,
computePageBakeFrame, getLastModifiedAt) and shrank by 2 (the graduations).
save-engine.test.js grew to 17 tests with stubbed idb primitives — the
backup writer, cross-user get, and probe now have Node coverage.

---

## refactor(save-engine): Stage 2 — the log core + dirty core (first engine-owned state)

Second stage: the engine now OWNS state instead of only borrowing accessors.
The Save Status **log core** moved in (`saveStatusLog` + `pushSaveEvent` /
`pruneSaveStatusLog` / `getSaveStatusLogWindowMs` + the `[SaveDebug]` helpers
`isSaveDebugEnabled`/`setSaveDebugEnabled`/`saveDebugRunId`/`saveDebugLog`/
`saveDebugLogError`), and the **dirty core** (`markProjectDirty` with
engine-owned `dirtyGeneration` / `dirtyStartedAt` / the 2s-throttled dirty
event). app.js keeps same-named wrappers for the ~230 call sites;
`App.getSaveStatusLog` delegates to the engine getter; the save paths read
generations via `saveEngine.getDirtyGeneration()`; `resetLocalSessionState` /
`resetAutosaveDegradedState` call the engine's `resetDirtyTracking` /
`clearDirtyStartedAt` / `clearSaveStatusLog`. Deliberately app-side still:
`autoSaveDirty` + `lastModifiedAt` (their primary writers are the Stage-6
save paths — the engine reaches them via ctx get/set), the debounced
local-backup kick (`ctx.scheduleTakeoffBackup`; the writer moves in Stage 3),
the envelope builders (wired to a dozen later-stage lets), and
`resetLocalSessionState`/`resetAutosaveDegradedState` (orchestrators). The
undo/redo machinery that shared the old dirty-tracking section got its own
honest `// SECTION: Undo/redo stacks` marker (it was never sync).
save-engine.js gained its own eslint group (constants + save-utils globals);
save-engine.test.js grew to 13 tests, now asserting against the engine's own
log (Stage 1's ctx-spy assertions were rewritten accordingly).

---

## refactor(save-engine): Stage 1 — the createSaveEngine(ctx) seam

First stage of the staged save/sync-engine extraction (the endgame after the
modal-ladder splits #25–#33). A feature-file split can't work for the engine
(feature files load after app.js, but boot needs the engine, and its ~48
reassigned `let`s are written from both sides), so the shape is the *other*
proven pattern scaled up: **[save-engine.js](save-engine.js)** as a classic
script in the pre-app.js slot exporting `createSaveEngine(ctx)`. app.js
instantiates it once near the top of its IIFE, passing accessors/callbacks
that resolve live values at call time (`getState`, `getSupabase`,
`isSupabaseEnabled`, `withTimeout`, `pushSaveEvent`, `saveDebugLog`,
`probeCheckoutLock`, `handleBackgroundCheckoutExpired`, `isAutoSaveSuspended`,
`getLastCheckoutRefreshAt`), and keeps **same-named thin wrappers** so every
call site, the App registry, and the `window.*` contracts stay frozen.

Stage 1 proves the seam on the two leaf clusters: `[sync] Global force
reload` (check + reload + the pending-stamp commit listener, installed via
`saveEngine.installGlobalReloadStampCommit()` at load + the banner) and
`[sync] Checkout keep-alive` (the visible-tab lock probe). Their `[sync]`
markers stay in app.js heading the wrappers, so `rg "SECTION: \[sync\]"`
still finds the whole subsystem. New
[save-engine.test.js](save-engine.test.js) gives the engine its first Node
unit coverage via a fully stubbed ctx (keep-alive skip ladder + expiry
routing; force-reload decision incl. the pending-stamp write). Groundwork
laid beforehand (same day): the Stage 0 smoke spec, dev-auth for the cloud
battery (suite baseline 120 passed / 1 known-red), and a telemetry baseline
envelope.

---

## perf: large-plan responsiveness, phases 1+2 (zoom gestures + page-switch bitmap cache)

**Problem.** On large multi-page plans, zooming lagged with erratic jumps and page switches
took seconds. Two root causes: (1) the wheel-zoom rAF and zoom-rail drag ran the full
`updateUI()` **every frame**, and `updateUI()` rebuilds every sidebar list with
O(all annotations across all pages) length math (16–31ms/call measured on a seeded 40-page
project — frames blew the 16ms budget, wheel deltas accumulated, the zoom lurched); (2) every
page switch re-rasterized the whole sheet from scratch via pdf.js, and rapid flips serialized
full renders of every intermediate page.

**Phase 1 — zoom gestures never run the full updateUI:**

- New `syncZoomIndicators()` (zoom-% readout + rail-thumb sync only): the wheel rAF, pinch
  rAF, and zoom-rail drag use it per frame; the full `updateUI()` still runs exactly once at
  the debounced gesture-end commit. Published as `App.syncZoomIndicators` for
  [features/zoom-rail.js](features/zoom-rail.js).
- `updateUI()` win A: new `getPipeToolingHasData()` (report.js, on `window`) replaces the
  `getPipeToolingSummary().length > 0` existence check — same counts-or-lines rule, but
  short-circuits at the first hit instead of building the whole summary per updateUI call.
- `updateUI()` win B: `getActiveCanvas`/`getActiveAnnotations` accept an optional `pageIdx`
  hint (validated, `indexOf` fallback) so the all-pages loops in the sidebar renderers and
  report walkers stop paying an O(pages) `indexOf` per page — removing the O(pages²) factor.
- Measured after: per-frame gesture work ~0ms (was 16–31ms). Regression:
  [zoom-no-updateui-during-gesture.spec.js](zoom-no-updateui-during-gesture.spec.js)
  (sidebar sentinel survives the gesture; `#zoomPct` tracks per frame; exactly one
  `updateUI()` at the commit).

**Phase 2 — PDF render bitmap cache:**

- New `// SECTION: PDF render bitmap cache`: an LRU (max 4) of rendered-page `ImageBitmap`s
  keyed by the **self-validating** tuple (pdfPage proxy identity + rotation + zoom +
  effDpr) — automatically invalidated by page deletes, prepare-pdf's `pdfPage` rebinds,
  undo's in-place rotation writes, wrapper resizes, and `renderAreaSafety`/caps changes.
  Area-capped per entry at min(0.15 × maxArea × safety, 5MP) so deep-zoom giants are never
  cached (worst-case retention ~20MB); every evict/drop/clear `close()`s the bitmap; a
  generation counter makes async inserts self-discard across clears. Entries are snapshotted
  from the offscreen pre-free, post read-back guard (never a blank), using a key tuple
  **captured at render start** so a cancel-lost race can't poison the cache (the same
  capture fixed a pre-existing hole where a mid-gesture completion set `lastRenderedZoom`
  from live state and made `commitWheelZoom` skip its crisp re-render).
- `renderPdf` cache-hit fast path: synchronous blit (no pdf.js), with a blank read-back
  mirroring the full path's pressure response (drop + clear + ratchet + re-enter).
- Rapid-flip cancellation: the in-flight guard now `cancel()`s the running render task
  (double-cancel guarded), landing in the existing `RenderingCancelledException` handling.
- Stale-blit preview: switching to a page cached at a different zoom paints it scaled
  immediately; the crisp render replaces it.
- Idle prefetch (250ms after a settled render) rasters `currentPage±1` at predicted fit
  zoom into the cache via a dedicated scratch canvas; skipped under memory pressure/hidden
  tab; cancelled by any `renderPdf` entry and by wheel/touchstart/pointerdown (pdf.js runs
  operator lists in main-thread chunks — speculation must never jank a gesture).
- Cache clears are wired at every `state.pages` rebuild / `pdfPage` rebind site (app.js ×7,
  features/prepare-pdf.js both branches, features/load-project.js ×3 via the new
  `App.clearPdfBitmapCache`) plus the ratchet branch. Debug seams:
  `App.__pdfBitmapCacheStats`, `App.__pdfBitmapCacheDump`.
- Measured (40-page synthetic): cold switch 64ms raster; revisit 6ms blit; prefetched
  neighbor first visit 12ms blit. On real dense sheets cold is seconds, so hits are the
  difference between instant and unusable. Regression:
  [page-switch-cache.spec.js](page-switch-cache.spec.js).

---

## fix(auth): INITIAL_SESSION no-session event wiped view-link projects

**Problem.** Share/view links (`/app/?t=<token>`) loaded the project and then went black on any
device with **no signed-in Supabase session** (fresh phones being the common case — "works on my
desktop, not on my phone"). `initViewOnlyMode` finished loading the project, then `initSupabaseAuth`
subscribed `onAuthStateChange`, and supabase-js v2 fires an immediate `INITIAL_SESSION` event on
subscription. With no session that event fell into the signed-out branch, whose per-user data
hygiene called `resetLocalSessionState()` unconditionally — wiping `state.pages` /
`currentProjectId` / `loadedViaViewLink` milliseconds after the view project loaded. Signed-in
browsers took the session branch instead, which is why desktop appeared fine. The same
unconditional wipe could also clobber a signed-out local session's restored backup at boot.

**Fix.** The signed-out branch wipes only on a **real** sign-out — `hadSession` (a user id existed
in this tab) — and never in a view-link tab (`state.loadedViaViewLink`), whose project access rides
on the token + email gate, not the session. `broadcastSignOut()` keeps its existing `hadSession`
gate. Diagnosed by tracing `state.pages`/`state.zoom` writes on the live link: pages went
`0 → 1 → 0` 13ms after `fitZoom`, stacked under the auth callback.

---

## feat(scale): "verify your scale" advisory + check mode

**Problem.** A preset / custom architectural scale is an assumption (the PDF is printed to true
scale), and even the sheet-size correction is a best guess — nothing prompted the user to confirm
it, so a wrong scale silently propagated into every length tally.

**Fix.** Two additions to the Set Scale modal, over the existing two-point pick flow:

- **Advisory** — a persistent **blue** `#scaleVerifyAdvisory` banner atop `#scalePresetsPanel`
  (covers presets + the custom row, which share the panel), calmer than the yellow sheet warning.
  Its **Verify by measuring two points** button (`startScaleCheck`) reuses the two-point pick flow
  (all input paths — mouse, touch, aim-loupe — funnel through the one `handleCanvasClick`
  `TOOL.SCALE` branch), gated by a new `state.scaleCheckMode` flag.
- **Check mode** — after the two points, `openScaleModal` routes to `#scaleCheckPanel`; the user
  enters the line's **known** length and **Check** calls the pure `scaleCheckDelta(distPts, scale,
  knownVal, knownUnit)` ([geometry.js](geometry.js)) → `{ reading, deltaPct }`, showing Expected
  vs "current scale reads" + the **% error** (green < 1%, yellow otherwise). **Keep current scale**
  leaves the preset; **Use measured** recalibrates via the shared `applyTwoPointScale` (extracted
  from `#scaleSet`, stamps a `refLine`). A brief **post-apply toast** fires whenever a preset/custom
  scale is set.

`resetScaleCheckMode` (published on `App`) unwinds the flag from every modal exit and the two
Escape-key `TOOL.SCALE` branches in app.js. Registry gains `App.scaleCheckDelta` /
`App.convertUnitValue` / `App.formatFeetInchesFromVal` / `App.resetScaleCheckMode`. Tests:
`scaleCheckDelta` cases (exact → 0%, 2× → 100%, cross-unit) in [geometry.test.js](geometry.test.js).

---

## fix(scale): sheet-size correction for compressed / re-boxed PDFs

**Problem.** Annotations are stored in PDF points and real lengths are
`geometricPdfPts / pixelsPerUnit`. The architectural presets ([constants.js](constants.js)
`SCALE_PRESETS`) and the custom dialog hard-code `pixelsPerUnit = fractionInches * 72 / feet`,
which only holds when the PDF page's point space equals the true physical sheet size
(72 pt = 1 real inch of paper). When a PDF is "compressed" / re-boxed / rasterized-and-rescaled,
the page MediaBox shrinks while still depicting a `1/4"=1'` drawing, so the preset is off by the
rescale ratio (a half-size page reports a 10 ft wall as 5 ft). Two-point "Select on PDF"
calibration (`pixelsPerUnit = ptDist/realLength`, no `72`) was the only immune method.

**Fix (three layered surfaces over one page-size analysis):**

- **Detect & warn (A).** [geometry.js](geometry.js) gains the pure `STANDARD_SHEETS` table
  (ANSI A–E, ARCH A–E + E1, ISO A0–A4, edges in points) and `analyzeSheet(w, h)` →
  `{ isStandard, matchedSheet, bestGuessSheet, candidates }` (orientation-normalized; standard =
  within ~3% of a real sheet; otherwise aspect-ratio candidates within ~2%, ties → larger sheet).
  app.js wraps it as `getPageSheetAnalysis(pageIdx)` (unrotated viewport dims) and publishes it
  + `STANDARD_SHEETS` + `sheetCorrectionFactor` on the `App` registry. On the presets tab in
  page-scale mode, a non-standard page shows the `#scaleSheetWarning` banner.
- **Correct (B).** `sheetCorrectionFactor(w, h, sheet) = actualLongEdge / sheetLongEdge`.
  `features/scale.js` multiplies the preset/custom `pixelsPerUnit` by it and stamps
  `scale.sheetSize` / `scale.correctionFactor` / a label suffix. **Page scale only** — the zone
  early-return in `applyScaleObjectToZoneOrPage` is untouched, and two-point is untouched. The
  picker (`#scaleSheetSelect`) defaults to the best guess and can override or disable. A
  standard-size page applies `correctionFactor` 1 with no banner (behavior byte-for-byte
  unchanged).
- **Verify (C).** `renderAnnotations` draws a synthetic dashed scale bar (round real length, ends
  + label) for preset/custom scales that lack a two-point `refLine`, reusing the existing
  `state.showScaleRefLine` toggle — a passive visual check and the backstop when a compression
  lands exactly on another standard size (e.g. half-size ARCH D == ARCH B).

New `scale` sub-fields auto-survive all persistence paths (cloud / IndexedDB / export / undo —
spread/JSON, no sub-field whitelist). Tests: `analyzeSheet` / `sheetCorrectionFactor` cases in
[geometry.test.js](geometry.test.js).

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

### PR 13 — Large-PDF upload: size-aware, abortable, verify-backed (Phase C)

- Root cause from a user's exported save logs (cross-referenced with the
  project's Supabase storage logs): a ~24 MB first-PDF upload hit the fixed 60s
  `withTimeout` on `supabase.storage.from('pdfs').upload(...)`, the once-only
  retry doubled it (~140s), and Turn In blocked on `turn_in_blocked_by_save_err`
  — yet the storage logs showed the object actually landing ~4.5 min later (a
  request the client had already abandoned, since the old timeout passed a plain
  promise and never aborted, so retries could stack a second concurrent upload).
- `pdfUploadTimeoutMs(bytes, opts)` (pure, in [save-utils.js](save-utils.js))
  sizes the upload timeout from the byte count at an assumed conservative uplink
  (`PDF_UPLOAD_ASSUMED_BPS`), floored at `PDF_UPLOAD_TIMEOUT_BASE_MS` (60s) and
  clamped to `PDF_UPLOAD_TIMEOUT_MAX_MS` (8 min). 24 MB now budgets ~4.3 min.
- storage-js `upload()` does not accept an `AbortSignal` (only `list`/`download`
  take `FetchParameters`), so the standard path cannot cancel an in-flight
  request; the size-aware timeout only bounds how long the client *waits*, and
  `confirmPdfUploaded` reconciles a request that completed server-side after the
  wait. Genuine cancellation (and resume) for large PDFs comes from the
  resumable/TUS path in PR 14, not from the standard upload.
- `uploadPdfToStorage()` wraps the upload with a **verify-after-timeout** safety
  net: on a transient failure it polls `confirmPdfUploaded()` (storage `.info()`,
  `PDF_UPLOAD_VERIFY_ATTEMPTS` × `PDF_UPLOAD_VERIFY_GAP_MS`) and, if the object
  is present with the expected byte size, treats the save as succeeded (computing
  `pdf_hash` from the local buffer) rather than re-uploading. Emits
  `pdf_upload_verified_after_timeout`.
- Autosave throttling: `uploadLocalPdfToCloudIfNeeded('autosave_tick')` keeps
  uploading large first-PDFs in the background (so a PDF opened via "Open" without
  an explicit Save/Turn In still reaches the cloud), but a *failed* large upload
  now backs off `PDF_ONESHOT_LARGE_BACKOFF_MS` (5 min) instead of 30s. Combined
  with the `pdfOneShotUploadInFlight` guard (no overlapping ticks), the resumable
  path (PR 14, resumes rather than restarts), and the size-aware timeout, this
  removes the tight 5s retry loop that stranded William's 24 MB PDF without
  stranding the PDF for autosave-only sessions.
- New unit coverage: `pdfUploadTimeoutMs` (save-utils.test.js) + the timeout-budget
  invariants (constants.test.js).

### PR 14 — Resumable (TUS) PDF upload + progress + cross-reload resume (Phase D)

- Large PDFs (`> PDF_RESUMABLE_THRESHOLD_BYTES`, default 8 MB) now upload via the
  resumable/TUS protocol against Supabase Storage's
  `/storage/v1/upload/resumable` endpoint (chunked at the required 6 MB), instead
  of a single PUT. `tus-js-client` is loaded via CDN ([index.html](index.html));
  smaller PDFs keep the Phase C standard path.
- `uploadPdfResumable(storagePath, blob, { fingerprint, onProgress, signal })`
  wraps `tus.Upload` with `authorization`/`apikey`/`x-upsert` headers and
  `bucketName`/`objectName`/`contentType` metadata; `uploadPdfToStorage()` routes
  by size and still runs the `confirmPdfUploaded()` verify net on any failure.
- Determinate progress: byte progress flows through a module-level
  `onPdfUploadProgress` sink into the manual-save status line ("Uploading PDF…
  NN%") and the Turn In banner, fixing the "feels stuck" perception on slow links.
- Cross-reload resume: an interrupted upload resumes from the last acked chunk
  after a page reload. tus's `UrlStorage` is backed by a new IndexedDB store
  `pdf_upload_resume` (DB `clickcount-pdf-cache` bumped v5 -> v6, now 9 stores;
  helpers `idbPdfUploadResume*` in [idb.js](idb.js)), keyed by a
  project-id + content-hash fingerprint so a resume never attaches to a stale
  partial upload of different PDF content; entries are cleared on success.
- New coverage: the `pdf_upload_resume` store round-trip ([idb.test.js](idb.test.js))
  and a non-cloud Playwright smoke ([pdf-upload.spec.js](pdf-upload.spec.js))
  asserting the tus CDN library loads and the resume store round-trips in a real
  browser. The large-file resumable upload itself needs a signed-in cloud session
  + slow link, so it stays a manual smoke.

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
- **Save Status diagnostic enrichment** — the export envelope
  (`buildSaveLogsEnvelope`, still schema `clickcount-save-logs/v1` — additive) gained
  fields to make user-reported save/sync errors root-causable: `tabSessionId`;
  `timing.sessionExpiresAt`/`secondsToExpiry` (JWT-expiry class on long-open tabs);
  `timing.clientRecycles`/`autosaveLatencyP50`/`P95`/`autosaveLatencyN`/`degradedForMs`/
  `nextAutoSaveAttemptInMs` (surfacing already-computed degradation); `project`
  checkout ownership (`checkedOutBy`/`Email`/`At`/`AgoMs`, `canCheckOut`,
  `projectOwnerId`, `loadedViaViewLink`) and payload sizing
  (`dataJsonBytes`/`pdfBufferBytes`/`nearPdfCap`, computed export-time only);
  `storage` (`navigator.storage.estimate`) + `lastLocalBackup` `{at, ok}`; and
  `visibility` on autosave events. Failed raw-fetch saves attach server
  request-correlation IDs (`serializeSaveError`'s pure sibling
  `extractResponseDiagnostics` -> `requestId`/`cfRay`/`retryAfter`/`serverDate`) at
  `rawProjectsUpdate`/`rawProjectsInsert`/`rawCheckInProject` + the recovery probe.
  Caveat: those response headers are only readable when Supabase sends
  `Access-Control-Expose-Headers` for them, so `requestId` can be null even when one
  exists server-side. Every serialized error now carries a `transient` triage flag
  (`isTransientSaveError`). New pure helpers `extractResponseDiagnostics` /
  `secondsToExpiry` live in `save-utils.js` (unit-tested).
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

The 33 feature files in load order, each with a `*.spec.js` Playwright
regression (cloud-gated specs `test.skip` when Supabase secrets are absent).
All but [features/zoom-rail.js](features/zoom-rail.js) are extractions from
app.js; the Zoom Rail was born as a feature file (a new feature built directly
on the registry). Note the "pilot #N" split numbering used in
AGENTS/ARCHITECTURE is **chronological by extraction**, not this load order —
zoom-rail loads 4th but arrived much later:

1. [features/canvas-repair.js](features/canvas-repair.js) — Canvas Repair modal
   (first split; introduced the registry).
2. [features/note.js](features/note.js) — Note add/edit modal.
3. [features/zoom.js](features/zoom.js) — Zoom Settings modal.
4. [features/zoom-rail.js](features/zoom-rail.js) — the Zoom Rail (right-edge
   vertical zoom slider; not an extraction — built registry-native).
5. [features/manage-icons.js](features/manage-icons.js) — Manage Icons modal
   (first multi-region move).
6. [features/multiply-zone-settings.js](features/multiply-zone-settings.js) —
   Multiply Zone settings modal.
7. [features/export-pdfs.js](features/export-pdfs.js) — Export PDFs modal's
   `specificPages*` cluster (largest single move; 9 publish-only deps).
8. [features/legend-settings.js](features/legend-settings.js) — Summary Legend
   settings modal.
9. [features/page-settings.js](features/page-settings.js) — Page settings modal.
10. [features/counter-settings.js](features/counter-settings.js) — Counter
    settings modal (first two-region consolidation).
11. [features/line-type-settings.js](features/line-type-settings.js) — Line Type
    settings modal.
12. [features/choose-create-line-type.js](features/choose-create-line-type.js) —
    Choose/Create Line Type modal.
13. [features/scale.js](features/scale.js) — Set Scale modal (per-page / zone
    scale).
14. [features/groups.js](features/groups.js) — Group + Group Assign modals
    (bidirectional callback for modal-hidden).
15. [features/grid.js](features/grid.js) — Grid overlay toggle + settings.
16. [features/quick-line.js](features/quick-line.js) — Quick Line modal +
    line-modifier preview.
17. [features/counter.js](features/counter.js) — Counter modal (Choose/Create/
    Icon tabs).
18. [features/save-status.js](features/save-status.js) — Save Status modal UI
    (getter-accessor + deferred-wrapper patterns).
19. [features/manage-projects.js](features/manage-projects.js) — Manage Projects
    admin modal (Supabase-gated).
20. [features/user-admin.js](features/user-admin.js) — Manage-Users admin modals
    (create/delete user, all-users; Supabase-gated).
21. [features/load-project.js](features/load-project.js) — cloud Load Project
    modal (most dependency-heavy split; ~20 `App.*` deps + four setters).
22. [features/prepare-pdf.js](features/prepare-pdf.js) — Prepare PDF modal
    (page keep/drop, rotate, append mode).
23. [features/quick-modals.js](features/quick-modals.js) — Quick Plumbing +
    Quick Count modifier-driven create panels.
24. [features/pdf-bundle.js](features/pdf-bundle.js) — PDF-bundling helpers
    (report/notes/highlights → jsPDF; re-homed already-registered `App.*`
    entries).
25. [features/item-details.js](features/item-details.js) — Counter/Line Type
    details modal + Line Properties modal + `deleteGroup` (re-homed
    `App.deleteGroup`; first feature-registered getter,
    `App.getCounterLineTypeDetailsItem`).
26. [features/output.js](features/output.js) — output-actions cluster: Copy to
    PipeTooling (+ export view-link cache), Copy Summary, Download current
    page (first split registering no entry points — bindings move with their
    DOM elements; one callback, `App.onViewLinkRevoked`).
27. [features/share-links.js](features/share-links.js) — Share Project modal:
    people list + view links (Supabase-gated; revoke reaches output.js's
    cache-clear via `App.onViewLinkRevoked` — feature-to-feature registry
    coupling; zero new published deps).
28. [features/import-clear.js](features/import-clear.js) — canvas JSON import
    (+ import-after-PDF prompt) and the Clear Page confirm flow (new
    publish-only deps `applyPageAnnotationsFromData`/`getActiveCanvas`; the
    custom-icon upload handler stays in app.js).
29. [features/zone-modals.js](features/zone-modals.js) — Multiply Zone value
    modal + Delete Zone confirm + Delete Page confirm handlers (no entry
    points; pending state rides on `state`; one publish-only dep,
    `performDeleteZone`).
30. [features/burger-menu.js](features/burger-menu.js) — mobile burger drawer
    + desktop header-overflow compact mode (zero new deps; `updateUI` calls
    `App.updateBurgerMenu`/`App.scheduleHeaderCollapseCheck` defensively;
    covered by the pre-existing mobile-burger-menu + header-overflow specs).
31. [features/canvas-layers.js](features/canvas-layers.js) — add / details /
    delete-canvas modals + footer layers menu + show-all-canvases peek (one
    publish-only dep `deepCopyAnnotations`; the Escape rename-commit reuses
    the Done button via a dispatched click; canvas JSON export stays).
32. [features/my-settings.js](features/my-settings.js) — My Settings modal:
    opener + Artboard save/load/export/clear + password form + sign-out +
    admin openers (new publishes `fetchUserAirboard`/`saveUserAirboard`/
    `PLUMBING_DEFAULTS`/`LINE_DEFAULTS`; the Airboard engine and auth
    sign-in form stay in app.js).
33. [features/user-activity.js](features/user-activity.js) — admin User
    Activity modal: raw event log + all-users/summary loaders + user-select
    + client-side filter (`App.openUserActivityModal` registration re-homed;
    three format.js helper publishes; user-admin.js keeps consuming it).

### Tooling

`npm run check` (lint + `test:unit` + `build:toc --check`) runs on every push/PR
via [.github/workflows/ci.yml](.github/workflows/ci.yml) (Node 20; Playwright is
excluded since it needs a server + Supabase/dev-auth secrets). The
[ARCHITECTURE.md](ARCHITECTURE.md) section index is regenerated from the
`// SECTION:` markers by `npm run build:toc`
([scripts/build-toc.js](scripts/build-toc.js)); section markers were renamed or
removed as their code emptied out into feature files.

## Manage Users — admin toolkit + self-service activity

A batch of admin user-management features built on top of the
[features/user-admin.js](features/user-admin.js) split. All client work is in
`features/user-admin.js` + `index.html` + `styles.css`; cloud pieces are Edge
Functions and RPCs. Live-verified (incl. a no-leak security check on each RPC/Edge
Function) and shipped via PRs #2–#9.

### Table & layout
- Manage Users / All Users became a real table: a sticky **header row**, a stacked
  **last-sign-in / last-active** column (one column, two lines), and an owned-
  **Projects** count column. `list_users_for_admin()` gained `project_count`
  (migration `…_list_users_for_admin_project_count`). The Manage Users modal was
  widened (`#manageUserModal .modal-card` → 780px) and the per-row action icons
  (Set Password / Transfer / activity) tightened into a button group (negative
  margins mirrored onto the header spacers to keep columns aligned).

### Reassign / Transfer ownership
- `supabase/functions/_shared/reassignProjects.ts` — the shared engine: for every
  project owned by `fromUserId`, **move the owner-scoped PDF storage object**
  (`{ownerId}/{projectId}/document.pdf`) and update `projects.user_id` + `pdf_path`,
  then reassign inherited view links (`project_view_links.created_by`, scoped to
  moved projects) and delete now-redundant share rows. Storage-move-then-DB
  ordering + idempotent retry; throws to abort so a user is **never deleted on
  partial failure**.
- `admin-delete-user` gained an optional `reassignToUserId` (reassign before delete;
  delete-only path unchanged when omitted). `admin-reassign-projects` is a new
  standalone **Transfer ownership** function. Client: a delete dialog
  (`#deleteUserConfirmModal`, delete-projects vs reassign) and a per-row Transfer
  dialog (`#transferProjectsModal`).

### Set password
- `admin-set-password` Edge Function (`updateUserById({ password })`, admin-gated,
  min 6). Per-row key icon → `#setPasswordModal`.

### Projects modal
- Clicking a user's Projects count opens `#userProjectsModal` (name + last-edited),
  filtered client-side from the existing `list_projects_for_admin` RPC.

### Activity overview + My Activity
- `user_activity_detail_for_admin(uuid)` RPC — one security-definer call returns a
  jsonb with identity/presence, all-time totals, per-event-type breakdown, rolling
  1d/7d/30d windows, active-days (CST), distinct projects, and a recent timeline
  with resolved project names. A `guard` CTE is the single auth choke point;
  relaxed to **self-or-admin** (a non-admin can read only their own — verified no
  leak), recent feed widened 40 → 200.
- `#userActivityOverviewModal` (`openUserActivityOverview`): summary card + stat
  tiles + a **day-grouped, run-collapsed** Recent-activity feed (consecutive
  identical actions merged into counted rows with a time range, e.g. "Placed 22
  counters · Lobby · 1:56–2:17 PM", under Today/Yesterday/date headers; sign-ins
  quieted). Opened from a row's stacked dates cell or heart icon, and — for the
  signed-in user — from **My Activity** in User Settings (`#mySettingsMyActivity`).
  `app.js` publishes `App.formatUserActivityDateTime` for the feed.

## Copy to /Tooling — embedded view link

The **Copy to PipeTooling** export (`doCopyPipeTooling`) appends the project's
**view link** as a trailing `View link:\t<url>` footer after the tab-delimited
count rows, so importing tools (PipeTooling / TakeoffTooling) can link the pasted
bid back to the source takeoff. Importers detect it by scanning the paste for a
counttooling `?t=<token>` URL — format-agnostic, so the label/placement can change
without breaking the contract.

- **Shared link helper** — extracted `getOrCreateViewLinkUrl()` (reuse the
  project's newest `list_view_links` token, else `create_view_link`) +
  `buildViewLinkUrl(token)` (`origin + path + ?t=token`) out of the header Share
  button. `copyOrCreateViewLinkToClipboard` now calls them, and the export reuses
  the same path — a project's link is shared, not minted fresh per export.
- **Gesture-safe clipboard** — `navigator.clipboard.writeText` needs transient
  user activation, which an `await` before the write can forfeit on Safari/Firefox.
  `prefetchExportViewLink()` runs when the `#forPipeTooling` dropdown opens (itself
  a gesture), caching the URL per `currentProjectId` so the option-click write
  stays synchronous. An inline `await` is the fallback if the prefetch hasn't
  resolved yet.
- **No-link cases** — when no link is possible the counts still copy and a context
  toast explains why: project not saved to cloud, signed out, or opened via a view
  link (view-only sessions can't mint a share link). The whole block is gated on
  `SUPABASE_ENABLED`, so the non-cloud build stays silent.
- **Cache hygiene** — revoking a view link in the Share modal clears the export
  prefetch cache (`exportViewLinkUrl` / `exportViewLinkProjectId`) so a stale,
  revoked token is never handed out; the per-project key also guards against
  carrying a link across a project switch.
- **Importer side** (PipeTooling / TakeoffTooling, separate repos) must detect +
  store the URL and strip the footer line; until then a not-yet-updated grid shows
  one stray trailing row.

## Hide marks — bare-drawing toggle

A header **eye toggle** (`#hideMarksBtn`) lets anyone peel the takeoff overlay off
the drawing and bring it back — built for view-link recipients reading plans on a
phone, but available to editors too.

- All marks (counters, lines, polylines, highlights, notes, the summary legend)
  render onto a single overlay canvas (`annCanvas`) layered over the PDF canvas —
  no DOM mark layers — so hiding is one cheap operation. `toggleHideMarks` flips
  `state.hideMarks`; `renderAnnotations` sizes + clears the overlay then
  **early-returns** when the flag is set, leaving the bare PDF visible. Toggling
  back repaints in full. It's **purely visual** — the annotation data is never
  touched, and exports/reports draw through `renderAnnotationsToContext`, so
  they're unaffected.
- The button sits in the top header next to Share, **shown to everyone** once a PDF
  is loaded (not `supabase-only`, not viewer-gated). Tap to toggle; the icon swaps
  **eye ⇄ eye-slash** and the button takes an `.active` state via
  `updateHideMarksButton` (called from `updateUI`); `aria-pressed` + title
  ("Hide marks" / "Show marks") track state.
- **Persistence:** the flag survives page/sheet changes and zoom automatically
  (every render checks it). For **view-link sessions** it also survives reloads —
  `state.viewToken` is captured in `initViewOnlyMode`, the preference is restored
  from `localStorage` (`view:hideMarks:<token>`) before the first paint, and saved
  on each toggle. Editor (non-view) sessions are session-only, defaulting to shown.
- **Regression test** — [hide-marks.spec.js](hide-marks.spec.js): loads a 2-page PDF,
  injects a counter with 5 markers, and asserts at the **pixel level** that the
  `#annCanvas` overlay is painted when shown and fully transparent when hidden, plus
  the eye ⇄ eye-slash icon swap, aria/title state, that the marker data survives the
  toggle, and that the hidden state persists across page navigation.

## Mobile right-side burger menu

On mobile the header was crowded with icon buttons. When a PDF is loaded on a phone
(`@media (max-width: 768px)`), four secondary header controls — **Hide marks**,
**Share**, **Download current page**, **Export project** — are now folded into a new
**right-side slide-in drawer** (`#headerBurger`), decluttering the header. Desktop is
unchanged.

- **Drawer mechanics mirror the left sidebar** — `#headerBurger` toggles
  `body.right-menu-open`; `#rightMenu` slides in from the right (`transform:
  translateX(100%)→0`) over a `#rightMenuBackdrop`, structurally cloned from the
  existing `#hamburger`/`#sidebarBackdrop`/`.sidebar` pattern. Burger visibility is
  **pure CSS** gated on the existing `body.has-pdf` class inside the mobile media
  query — no new JS show/hide.
- **Rows reuse desktop logic, no duplication** — `updateBurgerMenu()` (called at the
  end of `updateUI()`, after the option-visibility block) rebuilds `#rightMenuList`
  from the **currently-visible** `.download-page-option` / `.export-dropdown-option`
  buttons (whose `style.display` updateUI already computes), so the flattened list
  matches desktop exactly — including the single-page "smart" collapse (only the
  `this-canvas` download option is visible → one Download row) and the export gating.
  Each row **dispatches the original (CSS-hidden) control's click**: Download/Export
  options → their own `.click()`; Marks → `#hideMarksBtn`; Share → `#sidebarLogoShare`
  (editor → Share modal) or `#headerShareBtn` (signed-in view-link viewer → copy link).
  Each row also **clones its source control's `<svg>`** (eye / yellow printer / export
  glyph) into a leading icon (sized via `.right-menu-icon`), so the drawer is visually
  scannable and matches the header — no duplicated icon data.
  Dispatching clicks (rather than calling the functions) also sidesteps a scope split
  — `openShareProjectModal` lives in a deeper closure than `updateUI`.
- **Hiding the originals** — the four header controls carry a shared
  `consolidated-mobile` class; `body.has-pdf .header .consolidated-mobile { display:none
  !important }` (in the mobile media query) suppresses them on mobile, the `!important`
  overriding the inline `style.display` updateUI writes (and the now-redundant
  `#headerShareBtn.in-view-mode` rule). The DOM elements stay put — only their header
  rendering is hidden — so updateUI's logic and the drawer's row-building still read them.
- **Regression test** — [mobile-burger-menu.spec.js](mobile-burger-menu.spec.js) at a
  390px viewport: burger gated on a loaded PDF; the four controls hidden; expected rows
  + sections; the Marks row flips `state.hideMarks` and closes the drawer; the label
  reflects state on reopen; backdrop closes it; a single-page PDF collapses Download to
  one row; and a desktop-viewport case asserting the burger stays hidden and the header
  dropdowns stay visible.

### Desktop header overflow → compact mode

The same consolidation now also kicks in on **desktop** when the header is too narrow
to fit everything. Previously, below ~1080px the right-side header icons (eye / export /
download, widened further by the new eye button) were pushed past the right edge with
`overflow-x: visible` and **no way to scroll to them** — they were simply unreachable.

- **Overflow detection, oscillation-free** — `updateHeaderCollapsed()` runs on `resize`
  (rAF-throttled) and from `updateUI`. It measures the header in its **expanded** state
  — removes `body.header-collapsed`, reads `header.scrollWidth > header.clientWidth`,
  then re-adds the class if overflowing (all synchronous, so no flicker). Because the
  decision is always made against the *expanded* natural width, collapsing can't change
  the input and the toggle never oscillates at the boundary. On mobile (≤768px) it's a
  no-op — the media query still drives mobile.
- **Full compact layout** — CSS gated on `body.header-collapsed` makes `.header-tools-scroll`
  horizontally scrollable + collapses the spacer (so the left tools scroll instead of
  pushing the right cluster off), hides the `consolidated-mobile` right actions, shows
  `#headerBurger`, and enables the **same right slide-in drawer** as mobile. Settings /
  save-status stay visible as icons (and are also reachable via the desktop sidebar /
  status bar), so nothing is lost. The rules are duplicated from (not shared with) the
  mobile media query so mobile stays pure-CSS and unaffected.
- **Regression test** — [header-overflow.spec.js](header-overflow.spec.js): at 820px
  (desktop, narrow) the header collapses, the burger is visible **within** the viewport
  (not cut off), the right PDF icons are hidden, and the drawer opens with the actions;
  at 1400px it stays normal (no burger, dropdowns visible); and resizing wide↔narrow
  toggles it both ways.

## PWA / offline support

Made the app an installable PWA that works **fully offline for an already-loaded
takeoff** — built for estimators on phones in the field. The data layer was already
offline-tolerant (IndexedDB PDF cache + takeoff backups, hardened sync); the gap was that
the shell/JS/CSS/font/lib assets weren't cached and the runtime libs came from CDNs. This
was almost entirely an asset/caching/packaging change — no offline app logic. Shipped in
phases.

- **Phase 1 — self-host libs + fonts.** Vendored the six runtime libraries (pdf.js +
  worker, pdf-lib, html2canvas, jsPDF, supabase-js `2.108.0`, tus `4.3.1`) and the Google
  Fonts (DM Sans/Mono, Instrument Serif) under `vendor/` / `vendor/fonts/` with
  version-pinned filenames, and pointed the app at them. **The pdf.js `workerSrc` (app.js
  top) was repointed to the local worker** — it's fetched lazily on first render, so this
  is what makes offline (and large-PDF) rendering work. Now everything except Supabase is
  same-origin. `eslint.config.js` ignores `vendor/`.
- **Phase 2 — service worker.** [sw.js](sw.js) precaches the full same-origin shell (66
  assets) under a version-stamped cache (`counttooling-shell-vN`). Two-tier fetch:
  navigations/HTML **network-first** (always boot the freshest shell online; cached HTML
  offline), other same-origin assets **cache-first** so the offline shell is a coherent
  single version (avoids a mixed old/new shell on flaky deploys). Non-GET and cross-origin
  (Supabase REST/auth/realtime/storage **range-requests**/TUS/functions) pass straight to
  the network. `skipWaiting` + `clients.claim`; `activate` purges old versions. Registered
  at the top of `init()` so the view-link path gets it too. A dedicated `sw.js` eslint
  group uses the serviceworker globals.
- **Phase 3 — manifest + icons + meta.** [manifest.webmanifest](manifest.webmanifest)
  (standalone; theme `#17171a`, bg `#0f0f11`; 192/512/maskable icons; clean `start_url`
  that never bakes in `?t=`/`?devAuth=1`). Icons are a yellow takeoff-reticle generated by
  `npm run build:pwa-icons` ([scripts/build-pwa-icons.js](scripts/build-pwa-icons.js))
  using the existing Playwright Chromium — no new deps. Head meta: `apple-touch-icon`,
  `theme-color`, `apple/mobile-web-app-capable`, status-bar-style `black-translucent`
  (which pairs with the existing `--safe-top` header padding to fill the notch).
  `navigator.storage.persist()` is requested after auth so the OS doesn't evict the
  offline corpus.
- **Phase 4 — standalone polish + coordination.** A `--safe-bottom` token + `.status-bar`
  bottom padding clears the iOS home indicator in standalone mode (the bottom half of the
  earlier safe-area work). `doGlobalReloadNow` now also best-effort clears Cache Storage
  (fire-and-forget — must not block the reload); network-first HTML makes this
  non-load-bearing for correctness.
- **Deploy discipline (no build step):** bump `CACHE_VERSION` in [sw.js](sw.js) on every
  deploy that changes a precached asset, or the SW won't detect the update (the admin
  global-force-reload is the backstop). *(Since automated: the manual bump kept being
  forgotten, so `CACHE_VERSION` is now a content hash stamped by `npm run build:sw` and
  checked in `npm run check`.)* GitHub Pages caches `sw.js` ~10 min, so updates
  lag slightly. **iOS:** an installed app has a separate storage partition — sign in + open
  a takeoff once online before offline works.
- **Regression test** — [pwa.spec.js](pwa.spec.js): manifest linked/parseable with
  sized + maskable icons that resolve; head meta present; SW registers and precaches the
  shell (worker/app/HTML); and the headline — warm the SW online, go offline, reload, and
  assert the app boots **and renders a PDF from the cached worker** (no fake-worker
  fallback, no page errors). Local only (Playwright is excluded from CI).

## SEO — Tier 1 technical hygiene

The app had only a `<title>`. It's admin-provisioned (no public signup) and an auth-gated
SPA, so the SEO ceiling is low — the value here is **link-share previews + privacy + clean
indexing**, not lead-gen ranking (a marketing landing page + content would be the real
organic lever; out of scope).

- **Static head tags** ([index.html](index.html), after `<title>`): meta description
  (benefit-forward), `rel=canonical`, full Open Graph + Twitter Card set, and
  `WebApplication` JSON-LD with `sameAs` to the sister sites. All absolute URLs.
- **Privacy noindex** — a tiny inline head script injects `<meta name="robots"
  content="noindex, nofollow">` when the URL carries `?t=` (private view links hold customer
  takeoffs) or `?devAuth=1` (localhost bypass); the clean `/` stays indexable. Crawlers honor
  a JS-injected robots meta, and `robots.txt` deliberately does **not** disallow `?t=` (so the
  crawl reaches the noindex).
- **Branded social card** — `og-image.png` (1200×630): dark brand background, gold reticle
  logo + "CountTooling" wordmark (Instrument Serif), benefit tagline (DM Sans), and a faint
  blueprint/takeoff motif. Generated by `npm run build:og-image`
  ([scripts/build-og-image.js](scripts/build-og-image.js)) via the existing Playwright
  Chromium with the vendored brand fonts base64-embedded — no new deps.
- **`robots.txt` + `sitemap.xml`** at repo root (sitemap = just `/`). These plus the og-image
  are **crawler-only**, so they're left out of the `sw.js` precache (no `CACHE_VERSION` bump).
- **Regression** — [seo.spec.js](seo.spec.js): the tags/JSON-LD/og-image on `/` (indexable),
  and the noindex on `?t=`/`?devAuth=1`. Local only.
- **Follow-up (no code):** verify the domain in Google Search Console + submit the sitemap.

## SEO — Tier 2: relocate app to /app/, marketing landing at / (Phase 1)

Tier 1 was technical hygiene; the real organic lever is indexable content. But `/` was the
auth-gated app (a crawler saw an empty canvas). Phase 1 makes room: the **app moves to
`/app/`** and **`/` becomes a static marketing landing**. (Phase 2 builds out the full
landing + a guides section.) Admin-provisioned, so the landing's CTA is just "Open the app".

- **App relocated** — `index.html` → `app/index.html`; its `<script>`/`<link>` refs switched
  to **root-absolute** (`/config.js`, `/vendor/*`, `/features/*`, `/app.js`, …) so the shared
  assets stay at repo root and only the HTML moved. The app shell is now `noindex` with a
  `/app/` canonical (the landing owns public SEO); pdf.js `workerSrc` was already root-absolute.
- **Service worker scoped to `/app/`** — `register('/sw.js', { scope: '/app/' })`; precache
  `/` + `/index.html` → `/app/` + `/app/index.html`; nav fallback → `/app/index.html`;
  `CACHE_VERSION` `v1`→`v2`. The marketing site at `/` is plain/network-served (lightweight,
  great CWV). Manifest `id`/`start_url`/`scope` → `/app/`, icons root-absolute.
- **Backward-compat** — new view links already target `/app/?t=` (built from `location.pathname`);
  the landing has a blocking head script that forwards old `/?t=` and `/?devAuth=1` to `/app/`,
  plus a one-time unregister of any stale root-scoped service worker.
- **Minimal landing** at `/` (superseded by the Phase 2 generator): branded hero + feature
  list + "Open the app" CTA, carrying the canonical/OG/JSON-LD moved off the app shell.
- **Tests** — the ~17 app specs (and `cloud-test-helpers.js`) `goto('/')`→`goto('/app/')`;
  `pwa.spec.js` asserts the `/app/` scope + new precache paths; `seo.spec.js` now tests the
  landing at `/` and the `?t=`/`?devAuth=1` → `/app/` forwards.
- **Verified:** `npm run check` green; the full local Playwright suite (51 tests) passes; the
  app boots online + offline at `/app/` (SW scope `…/app/`, cache `…-v2`); `/` serves the
  landing; old `/?t=`/`/?devAuth=1` forward to `/app/`.

## SEO — Tier 2: evergreen Help/Guides section at /guides/ (Markdown-authored)

The real organic lever is indexable content. This adds a **Help/Guides section at `/guides/`**
the owner fills with help articles by **writing Markdown and running one build command** — no
per-article HTML/SEO boilerplate, output stays pure static HTML.

- **Authoring** — drop `content/guides/<slug>.md` with front-matter (title, description,
  updated, order, category), run `npm run build:guides`, commit the `.md` + generated files.
  Steps documented in `content/guides/README.md`.
- **Generator** — `scripts/build-guides.js` (mirrors `build-toc.js`): renders each article via
  a shared `layout()`/`head()`/`header()`/`footer()` (static nav/SEO — crawlable), builds the
  `/guides/` index, and regenerates `sitemap.xml`. Output is deterministic (dates from
  front-matter), so the `--check` mode is stable; `npm run check` now runs
  `build:guides -- --check` to fail CI if the committed HTML is stale. Uses **`marked`** (new
  build-time-only devDependency; ESM-only → loaded via dynamic `import()` from the CommonJS
  script). The deployed site stays pure static HTML.
- **Per-page SEO** — each article: unique title/description, self-canonical, OG `article` +
  Twitter (reusing `og-image.png`), and `Article` + `BreadcrumbList` JSON-LD; the index gets
  `CollectionPage` + `BreadcrumbList`. Real internal links (home ↔ guides ↔ app, breadcrumbs).
- **Shared `marketing.css`** — extracted the landing's inline styles into a top-level
  `marketing.css` (brand tokens + base + article **prose** styles) used by both the landing
  and the guides; the landing now links it and gained a **"Guides"** nav + footer link.
- **Seed content** — two real articles (`how-to-do-a-pdf-takeoff`, `plumbing-takeoff`) drafted
  from actual features, as a copy template.
- **Tests** — `guides.test.js` (Node, **in CI**): every generated page has one self-canonical
  + parseable JSON-LD, every internal link resolves, and the sitemap matches the pages.
  `guides.spec.js` (Playwright, local): the index + an article render with correct SEO/JSON-LD
  and working links. Verified: `npm run check` green (105 unit tests); both specs pass; the
  index + article render on-brand and the landing is unchanged after the CSS extraction.

### Guides — annotated screenshots

The text-only guides now carry **generated, annotated screenshots** (reproducible, not
hand-captured). The blocker was the blank sample PDF, so two new committed-artifact generators:

- **`scripts/build-sample-plan.js`** (`npm run build:sample-plan`) renders an inline SVG
  commercial floor plan (rooms, restroom fixtures, doors, dimensions, title block) to
  `samples/sample-plan.pdf` via Playwright `page.pdf()` — a realistic, non-confidential backdrop.
- **`scripts/build-screenshots.js`** (`npm run build:screenshots`) is self-contained (a tiny
  zero-dep static server + Playwright): it drives the real app at `/app/`, loads the sample plan,
  injects a takeoff (counters on each fixture as fractions of the real PDF page size, a measured
  line, a page scale, the legend), opens dialogs, overlays **numbered callout badges + highlight
  boxes anchored to real DOM elements**, and writes `guides/img/*.png` (2× for crispness). Shots
  are declared in a `SHOTS` manifest. Initial set: a plan-with-takeoff hero, a sidebar-tally
  "counting" shot, and annotated **Set Scale** + **Export PDFs** dialogs — wired into the
  matching articles with ①②③ steps.
- Both are manual (browser; PNG pixels aren't deterministic) → **not** in `npm run check`, like
  `build:og-image`. `marketing.css .prose img` frames/centers images; `guides.test.js`
  link-integrity fails CI if an article references a missing image; `guides.spec.js` asserts an
  article's screenshot actually loads. Authoring documented in `content/guides/README.md`.

## Counts vanishing at extreme zoom (canvas-blank guard)

Counter markers disappeared at extreme zoom and reappeared after zooming around — a
render/memory issue, not data loss. At high zoom three large canvases coexist
(`pdfOffscreenCanvas` + `pdfCanvas` + `annCanvas`), each up to the device's probed area cap
(~64M px); under memory pressure the last-allocated one (the annotation overlay) silently
allocates but paints blank. The existing per-single-canvas, boot-probed cap
(`detectMaxCanvasArea`/`clampEffectiveDpr`) didn't account for coexistence or current memory.

- **Free the offscreen after copy** (`pdfOffscreenCanvas.width = height = 0`) — 3 coexisting
  canvases → 2.
- **Budget the area cap** via a shared `renderAreaSafety` knob (starts at 0.5) applied to
  `maxArea` inside `effectiveDpr`; both `renderPdf` and `renderAnnotations` read the same knob,
  so buffer sizes stay consistent.
- **Read-back guard + ratchet:** after sizing/copying `pdfCanvas`, `canvasCornerReadsBack`
  (factored out of the boot probe) checks it actually allocated; on a blank read it ratchets
  `renderAreaSafety` down (bounded, ~3 steps) and re-renders — a silent blank becomes a softer
  but visible render instead of vanished counts, and a `canvas_render_blank` event is logged.
- The Save Status export envelope gained a passive `display` block (`devicePixelRatio`, probed
  `canvasCaps`, `renderAreaSafety`, last-render dims) so an affected user's exported logs reveal
  their environment.
- Tests: `clampEffectiveDpr` area-budget unit cases; `zoom-canvas-cap.spec.js` (overlay matches
  PDF + painted, single-blank ratchet, always-blank termination).

## Takeoff length tallies denominated in decimal feet

Copy to /Tooling showed different line lengths than the Line Types sidebar: both accumulate
per-line lengths in the page's scale unit (ft/in/m/cm/yd) but formatted differently — the
sidebar as feet-inches (`12'-6"`), the export as a decimal in the page unit (`150.00 in` on an
inch-scaled sheet). Fixed structurally: convert each line to feet **before summing** (also fixes
a latent mixed-unit summation bug) and format decimal feet everywhere.

- New pure helpers `formatFeet` (geometry.js), `lineLengthFeetForTotals` (line-metrics.js); app.js
  wrappers `getLineLengthFeetForTotals` (+`window.*` for report.js) and `getLineRealWorldLengthFeet`.
- Converted to decimal feet: Line Types sidebar, Lines list (totals + per-line), Summary panel +
  count-detail modal, footer totals, Multiply/Delete-zone preview modals, embedded PDF legend; and
  report.js Copy to /Tooling, Copy Summary (email/text), printable Report (unit token now constant
  `ft`; the `<unit> of <name>` + decimal export shape is unchanged, so PipeTooling/TakeoffTooling
  importers keep working). On-canvas per-line labels + the Measure ruler keep feet-inches.
- Tests: `formatFeet` + `lineLengthFeetForTotals` unit cases; `copy-tooling-feet.spec.js` asserts
  the three surfaces agree in feet on inch- and foot-scaled pages.

## View-link page/mark rotation misalignment (bake-frame guard + cache revalidation)

A view-link recipient saw the PDF rotated under the marks ("rotated under the canvas"). The
rotation pipeline is self-consistent for identical {PDF, data} (rotation is baked into mark
coordinates by `rotateAnnotations` and restored alongside `page.rotation`; the render always
overrides the PDF's intrinsic `/Rotate`, which the app otherwise never reads), so the corruption
is a mismatch between the frame the marks were baked against and what the viewer reconstructs.
No incident data — this is defense-in-depth that makes the class detectable + non-silent.

- **Bake-frame stamp + verify** (detect → warn → log, never auto-correct): each saved page carries
  `bakeFrame {w,h,intrinsic}` (`computePageBakeFrame`); both deserialize funnels
  (`applyPageAnnotationsFromData`, `applyTakeoffBackupToState`) recompute the frame and, on
  mismatch, `console.warn` + a one-time toast + `page.bakeMismatch`. Pure `bakeFramesMatch` in
  geometry.js; additive + backward-compatible (no stamp → skip; the IDB backup carries a parallel
  `pageBakeFrames` array).
- **Save-before-share:** `copyOrCreateViewLinkToClipboard` flushes dirty state first so a link's
  live cloud data reflects a just-applied rotation.
- **View-cache revalidation:** `initViewOnlyMode` revalidates against the server when online
  (reusing the cached PDF blob by hash; offline falls back to cache) instead of trusting a stale
  snapshot — and fixes a latent bug where the cached blob was reused even when the PDF hash changed.
  Backed by `updated_at` added to the `get-view-project` Edge Function + the view-cache meta.
- **Rotation telemetry** in the Save Status envelope (`pageRotation`/`pageBake`/`bakeMismatchPages`).
- Tests: `rotation-share-roundtrip.spec.js` generates a `/Rotate-90` PDF in-browser, runs
  editor→viewer-reconstruct (incl. a real multi-page case that must not warn), asserts the
  stamp/round-trip/guard; + `bakeFramesMatch` unit cases.

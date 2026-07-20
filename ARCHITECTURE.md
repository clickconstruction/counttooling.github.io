# ClickCount — Code Map for AI Navigation

Use this file to locate code in the app. The HTML shell + every modal live in
[app/index.html](app/index.html) (~2.3k lines, served at `/app/`; the repo-root
[index.html](index.html) is the static marketing landing); the bulk of the app
logic (the main JS
IIFE) lives in [app.js](app.js) (~14k lines, slimmed from ~16.2k as the pure
modules + the `window.App` feature-file splits were pulled out). The core data
model and invariants live in [RECONSTITUTE.md](RECONSTITUTE.md); this file is the
navigation map plus the catalog of features built on top of that core.
Implementation history (the sync-hardening work + the modularization arc) lives in
[CHANGELOG.md](CHANGELOG.md).

> Navigation philosophy: **do not rely on line numbers** — [app.js](app.js)
> is ~14k lines and edits shift them constantly. Navigate by the `// SECTION:`
> markers in the code and by the grep patterns in the Search Hints table below.

## Files

| File | Purpose |
|------|---------|
| [app/index.html](app/index.html) | The app shell, served at `/app/`: HTML structure + every modal; `<head>` loads the CSS/config/module scripts via root-absolute refs, the body ends by loading `app.js`, the `features/*.js` splits, then `report.js`. No inline JS logic (~2.3k lines) |
| [index.html](index.html) | The **static marketing landing** at `/` — plain HTML sharing `marketing.css`, no app JS, outside the SW scope; forwards old `/?t=`/`?devAuth=1` links to `/app/` |
| [app.js](app.js) | The bulk of the app logic — the former inline `index.html` IIFE, extracted into a classic `<script src>` (`(function() { … })();`, ~13.5k lines, slimmed from ~16k as the pure modules + `window.App` feature files were pulled out). Resolves the sibling modules' values by bare name (including the [idb.js](idb.js) storage primitives); exposes its own helpers to `report.js` via `window.*` at the IIFE tail. Linted (`no-undef` as error, the rest of the recommended set as warnings) |
| [styles.css](styles.css) | All CSS (design tokens, layout, modals, sidebar, mobile); linked from `<head>` |
| [icons.js](icons.js) | Bundled icon data — `*_PATH` consts, `VB_384_512_PATHS`, `FA_PATHS`, `RING_PATH`, `CUSTOM_ICONS`, `ICONS`; classic `<script src>` loaded before app.js; values resolve in the shared global lexical scope; guarded CommonJS export footer (`ICONS`, `CUSTOM_ICONS`, `VB_384_512_PATHS`, `FA_PATHS`, `RING_PATH`, `CIRCLE_PATH`, `SCALE_CROSSHAIR_PATH`) so `eslint.config.js` can derive the app.js lint globals **CUSTOM_ICONS moved out** to [icons-custom.js](icons-custom.js) (generated; loads right after this file) |
| [icons-custom.js](icons-custom.js) | **The GENERATED bundled custom-icon data** — the `CUSTOM_ICONS` array (79KB, `{value, viewBox, name}` literals sourced from `my-counters/*.svg`). `npm run build:icons` ([scripts/build-custom-icons.js](scripts/build-custom-icons.js)) overwrites the file wholesale — no more paste-into-icons.js step, and regenerations stop churning the 246KB icons.js. Classic `<script src>` loaded between [icons.js](icons.js) and [icon-render.js](icon-render.js) (which builds `CUSTOM_ICON_META` from `CUSTOM_ICONS` at parse time — the load-order constraint). Guarded CommonJS footer for the Node tests + the eslint derived-globals wiring |
| [geometry.js](geometry.js) | Pure math/geometry/parse primitives — `ptDist`, `polylineDistance`, `polygonArea`, `distToSegment`, the quadratic-bezier helpers, `rotatePoint90CW`, `pointInRect`, `rectsOverlap`, the zone locators (`getMultiplyZoneForPoint/Line`, `getScaleZoneForLine`), `formatLineLengthRealSum`, `parseRealWorldLength`, `parseFraction`, `formatAgo`, `formatFeetInchesFromVal`; classic `<script src>` loaded before the IIFE; no `state` dependency; has a guarded CommonJS export footer (`if (typeof module !== 'undefined' …)`, inert in the browser) so the primitives can be `require()`d by [geometry.test.js](geometry.test.js) |
| [constants.js](constants.js) | Pure module-level constant literals — `TOOL`, `SCALE_MODES`, `PLUMBING_DEFAULTS`, `LINE_DEFAULTS`, `COLORS`, `SCALE_PRESETS`, the autosave/checkout timing & threshold block, IndexedDB store names + caps, Save Status log windows, checkout messages, and assorted keys/URLs/TZ; plus the one pure helper `nextRecentColors(list, color, presets)` + its `RECENT_COLORS_MAX` cap (the recent-color list update shared by the create pickers and the edit color picker); classic `<script src>` loaded before the IIFE; no `state`/`window`/icon dependency (env reads like `SUPABASE_*`/`BACKUP_PDF_TO_INDEXEDDB`/`IS_DEV_HOST`, icon-derived consts, and function-local consts stay in app.js); guarded CommonJS export footer so the values can be `require()`d by [constants.test.js](constants.test.js) |
| [geometry.test.js](geometry.test.js) | Node `node:test` + `node:assert` unit tests for the [geometry.js](geometry.js) primitives; run with `npm run test:unit` (no deps). Naming split: `*.test.js` = Node unit tests, `*.spec.js` = Playwright (see `testMatch` in [playwright.config.js](playwright.config.js)) |
| [constants.test.js](constants.test.js) | Node `node:test` invariant tests for [constants.js](constants.js) (backoff arrays increasing & positive, timings/caps > 0, unique enum ids, valid hex colors, positive scale presets); run with `npm run test:unit` |
| [report.js](report.js) | Loads after app.js. Print report, Summary, `getPipeToolingSummary(options)`, `getEmailTextSummary(options)` (both accept `{ pageIndices, getAnnotations }`); `escapeHtml`; consumes globals exposed by app.js via `window.*`. Its `window.*` attachment is guarded by `typeof window` and it has a guarded CommonJS export footer (`escapeHtml`, `pickScaleForLineType`) — both inert in the browser — so those pure helpers can be `require()`d by [report.test.js](report.test.js) |
| [report.test.js](report.test.js) | Node `node:test` unit tests for [report.js](report.js)'s pure helpers — `escapeHtml` (null/undefined → `''`, entity escaping, `&`-first ordering, `String()` coercion) and `pickScaleForLineType` (preferred-unit selection via a `global.state` stub); run with `npm run test:unit` |
| [save-utils.js](save-utils.js) | Pure helpers for the save/sync layer — `isTransientSaveError` (which save/turn-in errors merit one retry), `getProjectCounts` (counter/line totals over a project `data` object, both legacy `annotations` and `canvases` shapes), plus the pure-mined set: `serializeSaveError` (the **deduped** error serializer that replaced app.js's near-identical `serializeSaveErrorForEvent` + `saveDebugSerializeError`), `formatSaveStatusErrDetail`, `backoffDelayMs` (auto-save backoff level for a failure count), `computeClockOffsetMs` (server/local skew from an RPC `server_now`), and `percentile` (p95 of latency samples). Classic `<script src>` loaded before the IIFE; no `state`/DOM dependency — app.js keeps the state-coupled callers (`updateServerClockFromRpc`, the backoff line, `recordAutosaveLatency`) that delegate to these. Guarded CommonJS export footer so the helpers can be `require()`d by [save-utils.test.js](save-utils.test.js) |
| [save-utils.test.js](save-utils.test.js) | Node `node:test` unit tests for [save-utils.js](save-utils.js) (the `isTransientSaveError` transient/non-transient matrix ported from the old localhost `console.assert` block, `getProjectCounts` shape/sum cases, plus the pure-mined helpers: `serializeSaveError` fields/null/`String(e)` fallback, `formatSaveStatusErrDetail`, `backoffDelayMs` clamp, `computeClockOffsetMs` string/numeric/null, and `percentile` p95/empty); run with `npm run test:unit` |
| [annotation-model.js](annotation-model.js) | **The canvas/annotation data model** (Tier-2 item 7) — exports `createAnnotationModel(ctx)` + `createUndoStack(ctx)`, the same seam recipe as the save engine. Classic `<script src>` loaded after [geometry.js](geometry.js) + [icons.js](icons.js) (reads `bakeFramesMatch`/`rotatePoint90CW`/`pointInRect`/`CIRCLE_PATH` by bare name) and before [save-engine.js](save-engine.js); app.js instantiates both once and keeps same-named thin wrappers so call sites, the App registry, and the feature-file contracts stay frozen. The model owns: `makeAnnotations` (the canonical shape), canvas-layer accessors (`getPageCanvases`/`getActiveCanvas`/`getActiveAnnotations`/`ensureActiveCanvas`/`getMergedAnnotationsForPage`/`mergeAnnotations`/`migratePageToCanvases`), has-any checks, backup↔proj format conversion, bake-frame stamp/verify, the backup/data appliers (`applyTakeoffBackupToState`/`applyPageAnnotationsFromData`), orphan reconcile, the **rect-select operations** (`countItemsInRect`, `collectItemsToDeleteInRect`, `deleteCollectedItems` — the Delete Area splice core with its load-bearing descending-index order; app.js's `performDeleteZone` keeps the undo/dirty/re-render choreography, ctx supplies `getLineRealWorldLengthFeet`), the **page-rotation math** (`rotateAnnotations`/`applyRotationDeltaToAnnotations` — node-tested 4×90° round trips), and `deepCopyAnnotations`. `createUndoStack` owns the undo/redo snapshot stacks (pages/counters/lineTypes/groups/rooms). Guarded CommonJS footer so [annotation-model.test.js](annotation-model.test.js) can `require()` it |
| [save-engine.js](save-engine.js) | **The save/sync engine module** (staged extraction; Stages 1–4 landed) — exports `createSaveEngine(ctx)`. Classic `<script src>` loaded after [constants.js](constants.js) + [save-utils.js](save-utils.js) (reads their exports by bare name — `GLOBAL_RELOAD_*`/`CHECKOUT_*`/`SAVE_STATUS_LOG_*` constants, `serializeSaveError`) and before [app.js](app.js), which instantiates it once near the top of its IIFE with a **ctx of accessors/callbacks** whose live contract is documented in the file header and grows per stage — arrows that resolve live values at call time, so client recycles and `let` reassignments are always seen. app.js keeps **same-named thin wrappers** so call sites, the App registry, and `window.*` contracts stay frozen as clusters migrate behind the seam. **Stage 1:** the `[sync] Global force reload` cluster (check + reload + the pending-stamp commit listener installed via `installGlobalReloadStampCommit()` + banner) and the `[sync] Checkout keep-alive` probe. **Stage 4 (client resilience):** `noteSupabaseJsFailure` + the wedge stamp, `runRecoveryProbe` (raw-fetch connection probe), `runSupabaseClientProbe`, `recreateSupabaseClient` (reassigns the app-side client via `ctx.setSupabase`; re-subscribes via `ctx.resubscribeCheckout`), the two orchestrators (`runRecoveryProbeAndMaybeRecycle`, `recycleClientIfWedgedOnIdleReturn`), and the four raw-fetch fallbacks (`rawProjectsUpdate`/`rawProjectsInsert`/`rawCheckInProject`/`rawListAccessibleProjects`) — with engine-owned in-flight guards, the recycle cooldown/count, and getters (`getLastSupabaseJsFailureAt`/`getClientRecycleCount`/`isClientRecycleInFlight`) for the app-side turn-in/save/envelope readers. **Stage 3 (storage ring):** `probeCheckoutLock` (graduated from ctx to engine-internal), `sha256Hex`, the `takeoffBackupGet`/`takeoffBackupPut` mismatch/warn wrappers, and the three-layer local-backup writer (`writeTakeoffStateBackup` → `writeTakeoffBackupToIndexedDB` → the serializer) with engine-owned `takeoffBackupWriteInFlight`/`takeoffBackupWarnShown`/`lastLocalBackupAt`/`lastLocalBackupOk` + the 1s dirty→backup debounce (also graduated from ctx); the 5s interval + visibilitychange kick stay app-side calling wrappers. **Stage 2 (the engine's first owned state):** the Save Status **log core** (the `saveStatusLog` array + `pushSaveEvent`/`pruneSaveStatusLog`/window + the `[SaveDebug]` helpers; `App.getSaveStatusLog` delegates to the engine getter) and the **dirty core** (`markProjectDirty` + engine-owned `dirtyGeneration`/`dirtyStartedAt` with `getDirtyGeneration`/`getDirtyStartedAt`/`clearDirtyStartedAt`/`resetDirtyTracking` for the app-side save paths; `autoSaveDirty`/`lastModifiedAt` stay app-side via ctx get/set until their primary writers migrate; the debounced backup kick stays app-side as `ctx.scheduleTakeoffBackup`). Guarded CommonJS footer so [save-engine.test.js](save-engine.test.js) can `require()` it |
| [save-engine.test.js](save-engine.test.js) | Node `node:test` unit tests for [save-engine.js](save-engine.js) — `createSaveEngine` with a fully stubbed ctx + stubbed idb primitives (21 tests). Stage 1: the keep-alive skip ladder / expiry routing / contained recovery throw (asserted against the engine's own log) and the force-reload decision matrix. Stage 2: log push/get/clear round-trip + disabled-Supabase drop, verbose-mode window widening + `saveDebugLog` gating, and `markProjectDirty` semantics (viewer/empty no-ops, generation bump, first-dirty stamped once, backup kick, 2s dirty-event throttle, holder-only checkout refresh + debounce, `resetDirtyTracking`). Stage 3: the backup writer (viewer/empty no-ops; local-key serialization + success stamps; the debounced markProjectDirty→backup landing in the idb stub), takeoffBackupGet cross-user delete-and-hide, and probeCheckoutLock (non-holder expired; healthy refresh stamping clocks). Stage 4: noteSupabaseJsFailure filtering, the recycle happy-path/cooldown (client swap + resubscribe + count), the orchestrator's zero-failures early exit, and the raw-insert no-token shape. Constants + save-utils exports come via `Object.assign(globalThis, require(...))` per the line-metrics pattern; run with `npm run test:unit` |
| [idb.js](idb.js) | IndexedDB storage layer extracted from app.js — the single `openPdfCacheDb` (one DB `clickcount-pdf-cache` v6, 9 stores) plus the context-free accessors `viewCache*`, `pdfCache*` (LRU), `takeoffBackupDelete`, `readSaveLogsSnapshots`, the resumable-upload URL store accessors `idbPdfUploadResume*` (get-all / get-by-fingerprint / put / delete / delete-by-fingerprint — backs tus's `UrlStorage` for cross-reload resume of large PDF uploads), and the pure primitives `idbTakeoffBackupGetRaw`, `idbTakeoffBackupPut` (eviction + stale-skip, returns a status), `idbPutSaveLogsSnapshot` (put + prune), `idbCustomIconsGet`/`idbCustomIconsPut`. Classic `<script src>` loaded after [constants.js](constants.js) (whose store-name/cap globals it reads by bare name) and before [app.js](app.js). Depends only on constants + `indexedDB` + args — no `state`/loggers; the state/logging concerns stay in app.js as same-named thin wrappers (`takeoffBackupGet`, `takeoffBackupPut`, `writeSaveLogsSnapshot`, `customIconsGetFromIndexedDB`/`customIconsPutToIndexedDB`). Guarded CommonJS export footer so the primitives can be `require()`d by [idb.test.js](idb.test.js) |
| [idb.test.js](idb.test.js) | Node `node:test` unit tests for [idb.js](idb.js) using `fake-indexeddb` (a fresh `IDBFactory` per test) — pdf-cache hash-mismatch + byte-cap LRU eviction, takeoff-backup round-trip + stale-skip + delete, custom-icon legacy→per-user migration, and save-logs-snapshot prune/newest-first ordering; run with `npm run test:unit` |
| [format.js](format.js) | Pure date/time/text formatters extracted from app.js — `wrapNoteTextCore` (the note word-wrap core with hyphen/underscore break opportunities; app.js's `wrapNoteText` wrapper supplies the canvas-backed measurer, tests stub it), `escapeHtml` (THE canonical HTML escaper, `& < > " '` superset; app.js reads it by bare name and publishes `App.escapeHtml` for feature files, replacing what were 27 inline copies in four behavioral variants — some skipped the quote entities), `formatLastSignIn`, `dateKeyInTimeZone`, `calendarDaysFromSignInToNowInZone`, `formatLastSignInUserActivity`, `formatUserActivityDateTime`, `filterUserActivityRows`, `renderUserActivityAllUsersTableHtml`. Classic `<script src>` loaded after [constants.js](constants.js) (reads `USER_ACTIVITY_TZ` by bare name) and before [app.js](app.js); no `state`/DOM dependency (the DOM-coupled User Activity modal code — `applyUserActivityFilter`, `populateUserActivityUserSelect` — stays in app.js). Guarded CommonJS export footer so the formatters can be `require()`d by [format.test.js](format.test.js) |
| [format.test.js](format.test.js) | Node `node:test` unit tests for [format.js](format.js) — `calendarDaysFromSignInToNowInZone` integer deltas (incl. year boundary / future), `filterUserActivityRows` match/case rules, `renderUserActivityAllUsersTableHtml` cells + escaping, `formatLastSignIn` relative buckets, `formatUserActivityDateTime`; the two en-CA-hyphen-dependent cases (`dateKeyInTimeZone`, `formatLastSignInUserActivity` Today) auto-skip on a limited-ICU runtime and run on full-ICU (browser-equivalent / CI Node 20); run with `npm run test:unit` |
| [icon-render.js](icon-render.js) | Pure icon geometry / render-rule helpers extracted from app.js — the `CUSTOM_ICON_META` table (derived from `CUSTOM_ICONS`) plus `iconMetaFromList`, `iconViewBoxFromList`, `iconRenderVbRule`, `iconRenderCenterRule`, `iconViewBoxStringRule`, `iconSvgHtml`. Classic `<script src>` loaded after [icons.js](icons.js) (reads `CUSTOM_ICONS`/`VB_384_512_PATHS`/`FA_PATHS` by bare name; the top-level `CUSTOM_ICON_META` read is `typeof`-guarded so Node `require` stays load-safe) and before [app.js](app.js). Depends only on icons.js globals + args — no `state`/DOM/user-icon-cache. app.js keeps the cache-coupled lookups (`getCustomIconMeta`, `getCustomIconViewBox`, `iconRenderVb`, `iconRenderCenter`, `iconViewBoxString`, `renderIconHtml`) as same-named thin wrappers that inject `getEffectiveCustomIcons()`. Guarded CommonJS export footer so the primitives can be `require()`d by [icon-render.test.js](icon-render.test.js) |
| [icon-render.test.js](icon-render.test.js) | Node `node:test` unit tests for [icon-render.js](icon-render.js) — `CUSTOM_ICON_META` derivation, `iconMetaFromList` (built-in fast path / injected user-icon parse / unknown→null), `iconViewBoxFromList`, the three rule functions across an `FA_PATHS` member / a `VB_384_512_PATHS` member / a default path, and `iconSvgHtml` markup + default color; run with `npm run test:unit` |
| [line-metrics.js](line-metrics.js) | Pure line-length / scale math extracted from app.js — `lineSegmentLength` (arc-aware chord), `lineGeomPdfPts`, `lineLengthPdfPts` (adds drop length), `effectiveScaleForLine` (scale-zone override vs page scale), `lineRealWorldLength`, `lineLengthForTotals` (× multiply-zone factor), `lineLengthFeetForTotals` (the same total converted to feet, for the always-feet tallies), `scaleForLineType` (unit-preference pick across pages). Classic `<script src>` loaded after [geometry.js](geometry.js) (reads `ptDist`/`polylineDistance`/the bezier helpers/`getScaleZoneForLine`/`getMultiplyZoneForLine` by bare name) and before [app.js](app.js). Depends only on geometry.js globals + args — no `state`. app.js keeps the state-coupled, report.js-facing API (`quickLineLength`, `getLineLengthPdfPts`, `getEffectiveScaleForLine`, `getLineRealWorldLength`, `getLineLengthForTotals`, `pickScaleForLineType`) as same-named thin wrappers that resolve the per-page scale / line-type / pages from `state` and keep their `window.*` exports; the module's function names are deliberately distinct from the wrappers so the app.js-derived globals don't trip `no-redeclare`. Guarded CommonJS export footer so the primitives can be `require()`d by [line-metrics.test.js](line-metrics.test.js) |
| [line-metrics.test.js](line-metrics.test.js) | Node `node:test` unit tests for [line-metrics.js](line-metrics.js) — straight vs arc segment length, polyline summation, drop-length addition (only when scaled), scale-zone override in `effectiveScaleForLine`, real-world length with/without drops, the multiply-zone factor in `lineLengthForTotals`, and `scaleForLineType` unit preference / fallbacks. Sets up the geometry globals via `Object.assign(globalThis, require('./geometry.js'))` before requiring the module; run with `npm run test:unit` |
| [features/canvas-repair.js](features/canvas-repair.js) | First feature-file split of the `app.js` IIFE (the `window.App` registry pilot) — the Canvas Repair modal (`openCanvasRepairModal` + `applyCanvasRepair`). Its own classic-script IIFE loaded **after** [app.js](app.js) (and before [report.js](report.js)); reads shared `state`/helpers from `window.App` at call time and registers `App.openCanvasRepairModal`/`App.applyCanvasRepair` back onto it. app.js invokes them via deferred bindings (`() => App.fn()`). See "Feature files / `window.App` registry" below |
| [canvas-repair.spec.js](canvas-repair.spec.js) | Playwright regression for the registry pilot — uploads `test-2pages.pdf`, adds a page-0 marker, asserts `window.App.openCanvasRepairModal`/`applyCanvasRepair` are functions and `App.state === window.state`, opens the modal + clicks `#canvasRepairApply` (no-op default mapping), and asserts the marker survives with no console / page errors; `npx playwright test canvas-repair.spec.js` |
| [features/note.js](features/note.js) | Second feature-file split (`window.App` registry pilot #2) — the Note add/edit modal (`openNoteModal` + its `noteModalCancel`/`noteModalDone` button bindings). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openNoteModal`, and binds the modal's Cancel/Done at load. app.js's 5 inbound call sites (canvas click / dblclick / context-menu / touch handlers) call it via `App.openNoteModal(...)` |
| [note.spec.js](note.spec.js) | Playwright regression for pilot #2 — uploads `test-2pages.pdf`, asserts `window.App.openNoteModal`/`ensureActiveCanvas`/`showLineColorModal` are functions, then exercises add (type + `#noteModalDone` persists a note), edit (reopen on the note object, change text), and cancel (`#noteModalCancel` clears `pendingNote`/`editingNote` and adds nothing), reading notes back via `window.App.ensureActiveCanvas`; asserts no console / page errors; `npx playwright test note.spec.js` |
| [features/zoom.js](features/zoom.js) | Third feature-file split (`window.App` registry pilot #3) — the Zoom Settings modal (`showZoomModal` + its `zoomModalClose`/`zoomMax`/`zoomSpeed` handlers). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.showZoomModal`, binds the modal inputs at load. `getMaxZoom`/`getWheelZoomSpeed` stay defined in app.js (used in ~10 places there) and are read via `App.*` — the first "publish-only, do-not-move" dep. its inbound call sites are the Zoom Rail's gear button ([features/zoom-rail.js](features/zoom-rail.js)) — the zoom-% click itself only toggles the rail |
| [features/zoom-rail.js](features/zoom-rail.js) | The **Zoom Rail** — the giant floating vertical zoom slider on the right edge, **toggled** by clicking the footer zoom-% (`#zoomPct`). Log-scale track (equal distance per doubling, 0.2 → `getMaxZoom()`) with round-percent tick marks (majors labelled), an accent-yellow %-readout draggable thumb with a light magnetic snap to ticks, +/− buttons, and a gear that opens the Zoom Settings modal (the modal's only entry point — the rail's z-index 300 sits above the modal overlay's 200, so both stay usable together). Drags anchor the zoom at the canvas-wrapper center and reuse app.js's cheap transform preview + debounced commit. Replaced the old `#zoomOverlay` popover (markup/handlers/dismisser removed). Registers `App.openZoomRail`/`App.closeZoomRail`/`App.toggleZoomRail` plus the `App.onZoomRailSync` core-→-feature callback (called from `updateUI` and the pinch rAF so the thumb tracks wheel/pinch/±/fit while open; also rebuilds ticks when Zoom Settings changes the max zoom, and closes the rail if the project unloads). Five publish-only deps `doZoomIn`/`doZoomOut`/`updateContainerTransform`/`commitWheelZoom`/`syncZoomIndicators` (the drag's per-move sync is the light `syncZoomIndicators` — zoom-% + thumb only, **never** the full `updateUI()`, whose all-pages sidebar rebuild made zoom gestures lag on large projects; the full `updateUI()` runs once in the commit — see [zoom-no-updateui-during-gesture.spec.js](zoom-no-updateui-during-gesture.spec.js)). Dismissal: re-click the zoom %, outside click (clicks inside `#zoomModal` don't count), Escape, or a ~5s idle **auto-fade** (0.3s opacity transition; never mid-drag or while the settings modal is open; hovering the rail cancels it; only actual zoom changes re-arm it — unrelated `updateUI` churn doesn't) |
| [zoom-rail.spec.js](zoom-rail.spec.js) | Playwright regression for the Zoom Rail — uploads `test-2pages.pdf`, asserts the registry contract (`openZoomRail`/`closeZoomRail`/`toggleZoomRail`/`onZoomRailSync` + the 4 publish-only deps), `#zoomPct` click toggles the rail (modal does **not** open; gear opens it with the rail staying up), mouse-drags the track past the ends asserting `state.zoom` rises to max then clamps to 0.2 with `#zoomPct` in sync, the ~5s idle auto-fade + the accent-yellow thumb, tick rebuild when max zoom changes 400% → 1200% (8 → 11 ticks), external `state.zoom` writes resync the thumb, mobile viewport tap shows the rail without the modal (and `#zoomOverlay` is gone), and outside-click + Escape dismiss; asserts no console / page errors; `npx playwright test zoom-rail.spec.js` |
| [page-switch-cache.spec.js](page-switch-cache.spec.js) | Perf regression for the **PDF render bitmap cache** (`// SECTION: PDF render bitmap cache` in app.js) — the LRU of recently-rendered page ImageBitmaps keyed by the self-validating tuple (pdfPage proxy + rotation + zoom + effDpr) that makes revisits and idle-prefetched neighbor visits a synchronous blit instead of a pdf.js raster. Wraps each page's `pdfPage.render` with a call-counting spy, then asserts: a revisit adds **zero** render calls with `App.__pdfBitmapCacheStats().hits` incremented and real canvas content; rotate + undo (which rewrites `page.rotation` in place) both force fresh rasters (key self-invalidation); 12 rapid no-wait page flips ride the new `pdfRenderTask.cancel()` path with no console errors and land on the right page; the ~250ms idle prefetch caches the neighbor so its first visit is a blit; and `App.clearPdfBitmapCache()` empties to size 0. `npx playwright test page-switch-cache.spec.js` |
| [zoom-no-updateui-during-gesture.spec.js](zoom-no-updateui-during-gesture.spec.js) | Perf regression for the zoom-gesture paths — asserts wheel zooming does **not** run the full `updateUI()` per frame (sentinel child planted in `#pagesList` must survive the gesture — any `updateUI()` wipes it via `renderPagesList`'s innerHTML rebuild), that `#zoomPct` still tracks `state.zoom` per frame via the light `syncZoomIndicators()` (published on the registry), and that exactly one full `updateUI()` + re-render lands at the debounced `commitWheelZoom` (sentinel gone after the 150 ms window); uploads `samples/sample-plan.pdf`; asserts no console / page errors; `npx playwright test zoom-no-updateui-during-gesture.spec.js` |
| [zoom.spec.js](zoom.spec.js) | Playwright regression for pilot #3 — uploads `test-2pages.pdf`, asserts `window.App.showZoomModal`/`getMaxZoom`/`getWheelZoomSpeed` are functions, opens via `window.App.showZoomModal()`, sets `#zoomMax` to 600 + `#zoomSpeed` to 200 (dispatching `input`), clicks `#zoomModalClose`, and asserts `state.maxZoom === 6` and `localStorage.zoomSettings.wheelZoomSpeed === 2` with no console / page errors; `npx playwright test zoom.spec.js` |
| [features/manage-icons.js](features/manage-icons.js) | Fourth feature-file split (`window.App` registry pilot #4) and the **first multi-region move** — the Manage Icons modal (`openManageIconsModal` + its `manageIconsModalClose`/`manageIconsCancel`/`manageIconsSave` handlers, which lived in app.js's event-binding block, a region away from the opener). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openManageIconsModal`, binds the modal's Close/Cancel/Save at load. `getOrderedIcons`/`iconVbFor`/`getUserCustomIcons`/`saveUserCustomIcons`/`showToast` stay defined in app.js (each used 10-15× there) and are read via `App.*` — publish-only deps. The Save handler reads `App.getOrderedIcons().find(...)` (ordered icon objects) instead of the bare `ICONS` array, and preserves the existing no-`markProjectDirty` behavior. app.js's single call site (Advanced → Manage Icons) calls `App.openManageIconsModal()` |
| [manage-icons.spec.js](manage-icons.spec.js) | Playwright regression for pilot #4 — uploads `test-2pages.pdf`, asserts `window.App.openManageIconsModal` + the 5 publish-only deps (`getOrderedIcons`/`iconVbFor`/`getUserCustomIcons`/`saveUserCustomIcons`/`showToast`) are functions, then exercises rename (set the first built-in row's input, `#manageIconsSave`, assert `state.iconNames[firstPath]`), reorder (reopen, `button[data-action="bottom"]` on the first row, Save, assert `state.iconOrder` ends with the former-first path), and custom delete (seed via `App.saveUserCustomIcons`, reopen, `#manageIconsEditToggle`, check the custom row's `.icon-select-cb`, `#manageIconsDeleteSelected`, assert `getUserCustomIcons().length === 0` and the custom section hides); asserts no console / page errors; `npx playwright test manage-icons.spec.js` |
| [features/multiply-zone-settings.js](features/multiply-zone-settings.js) | Fifth feature-file split (`window.App` registry pilot #5) and the **first needing no new published deps** — the Multiply Zone **settings** modal (`openMultiplyZoneSettingsModal` + its `multiplyZoneSettingsShowLabelBtn`/`multiplyZoneSettingsLabelSize`/`multiplyZoneSettingsClose` handlers). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openMultiplyZoneSettingsModal`, binds the modal's toggle/slider/Close at load. Every dep (`state`, `showModal`, `hideModal`, `markProjectDirty`, `renderPdf`, `updateUI`) was already on `App`. Scope is the settings modal only — the Multiply Zone **apply** flow (X-tool draw, `multiplyZoneModal`, `getMultiplyZoneForPoint`/`...ForLine`) stays in app.js. app.js's 2 call sites (right-click on the header / sidebar Multiply Zone button) call `App.openMultiplyZoneSettingsModal()` |
| [multiply-zone-settings.spec.js](multiply-zone-settings.spec.js) | Playwright regression for pilot #5 — uploads `test-2pages.pdf`, asserts `window.App.openMultiplyZoneSettingsModal` is a function, opens via the registry, sets `#multiplyZoneSettingsDefaultMult` to 5 + `#multiplyZoneSettingsLabelSize` to 20 (dispatching `input`, asserting `#multiplyZoneSettingsLabelSizeVal` reads `20`), clicks `#multiplyZoneSettingsShowLabelBtn` to toggle the label off, sets position to `top-left`, clicks `#multiplyZoneSettingsClose`, and asserts `state.multiplyZoneSettings` deep-equals `{ showLabelOnZone: false, defaultMultiplier: 5, labelSize: 20, labelPosition: 'top-left' }` with no console / page errors; `npx playwright test multiply-zone-settings.spec.js` |
| [features/export-pdfs.js](features/export-pdfs.js) | Sixth feature-file split (`window.App` registry pilot #6) and the **largest single move so far** (the ~250-line `specificPages*` cluster, 9 publish-only deps). The Export PDFs modal — the two module-locals `specificPagesSelections`/`specificPagesCanvasMode`, `openSpecificPagesModal`, `updateSpecificPagesCanvasModeVisibility`/`updateSpecificPagesDownloadState`/`updateSpecificPagesNavState`, `setAllSpecificPagesTo`/`setAllSpecificPagesToMarkedWithAllCanvases`, `downloadSpecificPages`, and all `#specificPages*` button/scroll/nav bindings. Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openSpecificPagesModal`, and binds `#specificPages.onclick = openSpecificPagesModal` plus the rest at load. **Interleaved move**: the shared PDF-download helpers (`sanitizeForFilename`/`downloadPdfBuffer`/`downloadProjectPdf`) and the "Copy to PipeTooling" dropdown toggle sat in the middle of the old section and **stay** in app.js. 9 publish-only deps stay defined in app.js (`getPageCanvases`, `renderAnnotationsToContext`, `addReportPagesToPdf`, `addHighlightsToPdf`, `addNotesToPdf`, `hasAnyHighlights`, `hasAnyNotes`, `sanitizeForFilename`, `logUserEvent`) and are read via `App.*`. The Escape-key `hideModal('specificPagesModal')` branch is modal-string-only and stays |
| [export-pdfs.spec.js](export-pdfs.spec.js) | Playwright regression for pilot #6 — uploads `test-2pages.pdf`, asserts `window.App.openSpecificPagesModal` + the 9 publish-only deps are functions, opens via the registry (asserts 2 `.specific-page-card`), exercises bulk select (`#specificPagesAllExclude` → `#specificPagesDownload` disabled; `#specificPagesAllMarked` → enabled), the marker-scale slider (set `#specificPagesMarkerScale` to 125 + dispatch `input`, assert `#specificPagesMarkerScaleVal` reads `125`), and `#specificPagesCancel` closing the modal; asserts no console / page errors. Behavior-neutral — deliberately does **not** click Download (real jsPDF render + save is covered by the manual smoke); `npx playwright test export-pdfs.spec.js` |
| [features/legend-settings.js](features/legend-settings.js) | Seventh feature-file split (`window.App` registry pilot #7) and the **lowest-risk move so far** — the Summary Legend **settings** modal (`openLegendSettingsModal` + its `legendSettingsClose` and 8 live appearance handlers `legendBgOpacity`/`legendBgColor`/`legendShowBorder(Btn)`/`legendScale`/`legendShowResizeHighlight(Btn)`/`legendTextOpacity`, plus the `#summarySectionTitle` opener). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openLegendSettingsModal`, binds the close/handlers/opener at load. **Second zero-new-dep move** — every dep (`state`, `showModal`, `hideModal`, `renderPdf`) was already on `App`. Each handler mutates `state.legendSettings` then calls `App.renderPdf()` (live). Scope is the settings modal only — the on-canvas legend overlay (`drawLegend`, the `legendBtn`/`legendBtnSidebar` toggles), the Summary section **collapse** icon (`#summaryCollapseIcon`, a different element — its toggle stays), and every `state.legendSettings` save/load/import site stay in app.js. The moved opener keeps its `closest('#summaryCollapseIcon')` guard |
| [legend-settings.spec.js](legend-settings.spec.js) | Playwright regression for pilot #7 — uploads `test-2pages.pdf`, asserts `window.App.openLegendSettingsModal` is a function, opens via the registry, sets `#legendScale` to 150 (dispatching `input`, asserting `#legendScaleVal` reads `150` and `state.legendSettings.legendScale === 1.5`), clicks `#legendShowBorderBtn` and asserts `state.legendSettings.showBorder` flipped, clicks `#legendSettingsClose` and waits for the modal to lose `.visible`; asserts no console / page errors; `npx playwright test legend-settings.spec.js` |
| [features/page-settings.js](features/page-settings.js) | Eighth feature-file split (`window.App` registry pilot #8) — the Page **settings** modal (`openPageSettingsModal` + its `pageSettingsTruncate`/`pageSettingsHideUnmarked` toggles + `pageSettingsClose`, plus the `#pagesSectionTitle` opener). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openPageSettingsModal`, binds the toggles/close/opener at load. One new publish-only dep — `renderPagesList` (stays defined in app.js, read via `App.*`); `state`/`showModal`/`hideModal`/`updateUI` were already on `App`. Each toggle mutates `state` (`pagesTitlesTruncated` / `hideUnmarkedPagesFromSidebar`), persists to `localStorage`, then calls `App.renderPagesList()` + `App.updateUI()`. Scope is the settings modal only — the Pages section **collapse** icon (`#pagesCollapseIcon`, a different element — its toggle stays), the scattered collapse-icon `textContent` writes, and the Escape-key close branch stay in app.js. The moved opener keeps its `closest('#pagesCollapseIcon')` guard |
| [page-settings.spec.js](page-settings.spec.js) | Playwright regression for pilot #8 — uploads `test-2pages.pdf`, asserts `window.App.openPageSettingsModal` + the publish-only `renderPagesList` are functions, opens via the registry, clicks `#pageSettingsTruncateBtn` and asserts `state.pagesTitlesTruncated` flipped + `localStorage.pagesTitlesTruncated` matches, clicks `#pageSettingsHideUnmarkedBtn` and asserts `state.hideUnmarkedPagesFromSidebar` flipped, clicks `#pageSettingsClose` and waits for the modal to lose `.visible`; asserts no console / page errors; `npx playwright test page-settings.spec.js` |
| [features/counter-settings.js](features/counter-settings.js) | Tenth feature-file split (`window.App` registry pilot #10) and the **first two-region consolidation** — the Counter **settings** modal, whose opener/close/reorder lived in the "Line type, counter & page settings modal handlers" grab-bag while its value handlers lived in a separate `// SECTION: Counter settings handlers` block; both are merged here. `openCounterSettingsModal` + `counterSettingsClose` + `counterSettingsReorder` + the value handlers (`counterSize`/`counterOpacity`/`counterOutline`/`counterShowRings(Btn)`/`counterNumberSize`/`counterRingSize`/`counterRingOpacity`/`counterRingSolid(Btn)`/`counterShowOnlyOnPage(Btn)`), plus the `#countersSectionTitle` opener. Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openCounterSettingsModal`, binds everything at load. Two new publish-only deps — `renderAnnotations`, `renderCountersList` (stay defined in app.js, read via `App.*`); `state`/`showModal`/`hideModal`/`updateUI`/`showToast` were already on `App`. Scope is the settings modal only — the Counters section **collapse** icon (`#countersCollapseIcon`), the sidebar **inline** `#counterShowOnlyOnPageInlineBtn`, the shared `#sidebarReorderFinish`, and the Escape-key close branch stay in app.js. The moved opener keeps its `closest('#countersCollapseIcon')` guard; the 2 right-click `countersSectionTitle.click()` callers keep working via DOM dispatch. **Removing the emptied `// SECTION: Counter settings handlers` marker drops the TOC count 50 → 49** |
| [counter-settings.spec.js](counter-settings.spec.js) | Playwright regression for pilot #10 — uploads `test-2pages.pdf`, asserts `window.App.openCounterSettingsModal` + the 2 publish-only deps (`renderAnnotations`/`renderCountersList`) are functions, opens via the registry, sets `#counterSize` to 40 (dispatching `input`, asserting `#counterSizeVal` reads `40` and `state.counterSettings.size === 40`), clicks `#counterShowRingsBtn` and asserts `state.counterSettings.showRings` flipped + `#counterRingSection` display follows, clicks `#counterSettingsClose` and waits for the modal to lose `.visible`; asserts no console / page errors; `npx playwright test counter-settings.spec.js` |
| [features/line-type-settings.js](features/line-type-settings.js) | Eleventh feature-file split (`window.App` registry pilot #11) — the Line Type **settings** modal, the **final settings-modal unit** drained from the old grab-bag (page #8, counter #10, line-type here). `openLineTypeSettingsModal` (incl. the drop-icon grid build from `DROP_ICON_STYLES`) + the value handlers (`lineTypeSize`/`lineTypeOpacity`/`lineTypeDropXSize`/`lineTypeOrientLength(Btn)`/`lineTypeParallelEnds`/`lineTypeLengthLabel`/`lineTypeSnapToHV(Btn)`/`lineTypeShowOnlyOnPage(Btn)`) + `lineTypeSettingsClose` + `lineTypeSettingsReorder`, plus the `#lineTypesSectionTitle` opener. Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openLineTypeSettingsModal`, binds everything at load. Two new publish-only deps — `renderLineTypesList`, `DROP_ICON_STYLES` (stay in app.js, read via `App.*`); `renderAnnotations` (from the counter pilot) + `state`/`showModal`/`hideModal`/`updateUI`/`showToast` were already on `App`. Scope is the settings modal only — the header snap button (`#lineTypeSnapToHVHeaderBtn`), the sidebar inline show-only buttons, the shared `#sidebarReorderFinish`, the J-hotkey snap toggle, and the Escape-key close branch stay in app.js. The moved opener keeps its `closest('#lineTypesCollapseIcon')` guard; the 5 right-click `lineTypesSectionTitle.click()` callers (Quick Line / Polyline) keep working via DOM dispatch. **Renamed** the now-stale `// SECTION: Line type, counter & page settings modal handlers` marker → `// SECTION: Choose/Create Line Type, line color & sidebar handlers` (TOC stays 49) |
| [line-type-settings.spec.js](line-type-settings.spec.js) | Playwright regression for pilot #11 — uploads `test-2pages.pdf`, asserts `window.App.openLineTypeSettingsModal` + `renderLineTypesList` are functions and `Array.isArray(App.DROP_ICON_STYLES)`, opens via the registry, sets `#lineTypeSize` to 8 (dispatching `input`, asserting `#lineTypeSizeVal` reads `8` and `state.lineTypeSettings.lineSize === 8`), clicks `#lineTypeOrientLengthBtn` and asserts `state.lineTypeSettings.orientLengthWithLine` flipped, asserts `#lineTypeDropIconGrid .icon-cell` count === `DROP_ICON_STYLES.length` and clicking a non-selected cell updates `state.lineTypeSettings.dropIconStyle`, clicks `#lineTypeSettingsClose` and waits for the modal to lose `.visible`; asserts no console / page errors; `npx playwright test line-type-settings.spec.js` |
| [features/choose-create-line-type.js](features/choose-create-line-type.js) | Twelfth feature-file split (`window.App` registry pilot #12) — the **Choose/Create Line Type** modal (`#chooseLineTypeModal`), the tabbed picker opened by the Quick Line button / `L` hotkey. `showLineTypeTab` (Choose/Create/Quick panels) + `populateChooseLineTypeList` (searchable existing-type list) + `showChooseLineTypeModal`, plus the `.line-type-tab` clicks, `#lineTypeModalSearchInput`, `#chooseLineTypeCancel`, `#createLineTypeCancel`, and `#createLineTypeCreate` handlers. Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.showChooseLineTypeModal` + `App.showLineTypeTab`, binds everything at load. **First split to share *constants* via the registry** — two new publish-only deps `TOOL`/`COLORS` (it also consumes `App.populateQuickLineModal`, which since pilot #16 is registered by [features/quick-line.js](features/quick-line.js), not app.js); `state`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`showModal`/`hideModal`/`updateUI` were already on `App`. Scope is this modal only — the **line color modal** (`showLineColorModal`/`applyLineColor` + `#lineColorCancel`/`#lineColorCustom`), the Quick tab body (`populateQuickLineModal`), and the Quick Line apply flow stay in app.js. The three call sites — `#quickLine.onclick`, `#plumLineBtn.onclick`, and the Shift+L hotkey — reach it via `App.showChooseLineTypeModal()` / `App.showLineTypeTab('quick')`. **Renamed** the section marker `// SECTION: Choose/Create Line Type, line color & sidebar handlers` → `// SECTION: Line color & sidebar handlers` (TOC stays 49) |
| [choose-create-line-type.spec.js](choose-create-line-type.spec.js) | Playwright regression for pilot #12 — uploads `test-2pages.pdf`, asserts `window.App.showChooseLineTypeModal` + `showLineTypeTab` are functions, opens via the registry, switches to the Create tab and creates a line type (asserts `state.lineTypes` grew by 1, `state.activeLineTypeId` points at the new type, and the modal closed), reopens and exercises the Choose-list search + select (asserts the modal closes and `state.activeLineTypeId` matches the picked type); asserts no console / page errors; `npx playwright test choose-create-line-type.spec.js` |
| [features/scale.js](features/scale.js) | Thirteenth feature-file split (`window.App` registry pilot #13) — the **Scale modal** (`#scaleModal`), opened by the Set Scale buttons / `S` hotkey and reused for per-page scale, scale-zone create, and scale-zone edit. `updateScalePlaceholder` + `openScaleModal` + `resetScaleModalZoneMode` + `applyScaleObjectToZoneOrPage` + `showScaleTab`, plus the `#setScale`/`#setScaleSidebar` openers and the `#scaleModalTabs`/`#scaleUnit`/`#scaleSelectOnPdf`/`#scalePresetsCancel`/`#scaleCustomApply`/`#scaleCancel`/`#scaleSet` handlers (which had lived down in the Counter-modal region). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openScaleModal` + `App.resetScaleModalZoneMode`, binds everything at load. **First split to route geometry.js globals + `SCALE_*` constants through the registry** — six new publish-only deps `SCALE_MODES`/`SCALE_PRESETS`/`ptDist`/`parseFraction`/`parseRealWorldLength`/`getActiveAnnotations` (stay in app.js, read via `App.*` so the `features/*.js` group's browser-only globals don't trip `no-undef`); `state`/`showModal`/`hideModal`/`updateUI`/`renderPdf`/`pushUndoSnapshot`/`markProjectDirty`/`uid`/`ensureActiveCanvas`/`showToast`/`TOOL` were already on `App`. The modal doubles as the scale-zone create/edit dialog (`scaleModalApplyTarget === 'zone'`), so `applyScaleObjectToZoneOrPage` moves with it; the four `openScaleModal` callers (canvas two-point finish + scale-zone context-menu Edit) and the Escape-key `resetScaleModalZoneMode` branch keep their zone-entry state/DOM setup inline and reach the modal via `App.*`. The toolbar tool buttons (`#measureBtn`/`#moveBtn`/`#quickLine`/`#undoBtn`/`#redoBtn`/`#polylineBtn`/`#highlightBtn`/`#multiplyZoneBtn`/`#scaleZoneBtn`/`#deleteZoneBtn`) that shared the grab-bag stay in app.js. **Renamed** the section marker `// SECTION: Scale modal` → `// SECTION: Toolbar tool buttons` (TOC stays 49) |
| [scale.spec.js](scale.spec.js) | Playwright regression for pilot #13 — uploads `test-2pages.pdf`, asserts `window.App.openScaleModal` + `resetScaleModalZoneMode` are functions and `Array.isArray(App.SCALE_PRESETS)`, opens via the registry, clicks a preset and asserts `state.pages[currentPage].scale` was set + the modal closed, reopens and exercises `#scaleCustomApply` with a valid fraction + feet asserting the computed `pixelsPerUnit` + closed modal; asserts no console / page errors; `npx playwright test scale.spec.js` |
| [features/groups.js](features/groups.js) | Fourteenth feature-file split (`window.App` registry pilot #14) and **first two-modal move** — the group create/edit modal (`#groupModal`) and the assign-item-to-group modal (`#groupAssignModal`). `openGroupModal` + `refreshGroupAssignButtons` + `openGroupAssignModal`, the three group-modal state flags (`pendingGroupEdit`/`pendingGroupAssignTarget`/`openedGroupModalFromAssign`, now private `let`s in the IIFE), and the `#addGroup` opener + `#groupModal*` / `#groupAssign*` handlers. Its own IIFE loaded **after** [app.js](app.js); registers `App.openGroupModal` + `App.openGroupAssignModal` + `App.onGroupModalHidden`. One new publish-only dep `App.deleteGroup` (the heavier group-deletion mutation, which clears the group off every annotation, stays in app.js); the rest (`state`/`COLORS`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`updateUI`/`renderPdf`/`showModal`/`hideModal`) were already on `App`. **First core-function → feature callback in the codebase**: the `hideModal('groupModal')` reset hook in app.js now calls `App.onGroupModalHidden()` instead of mutating the now-private `openedGroupModalFromAssign` directly. The `#showGroupColors` sidebar toggle stays in app.js; the two external callers (the groups-list Edit button in the render code, and the canvas right-click "Assign to Group") reach the modals via `App.*`. **Removed** the emptied `// SECTION: Groups` marker (TOC 49 → 48) |
| [groups.spec.js](groups.spec.js) | Playwright regression for pilot #14 — uploads `test-2pages.pdf`, asserts `window.App.openGroupModal` + `openGroupAssignModal` + `onGroupModalHidden` are functions, creates a group via `#addGroup` → name/color → `#groupModalDone` (asserts `state.groups` grew + `state.activeGroupId` points at it), edits via `App.openGroupModal(group)`, and runs the assign flow (`App.openGroupAssignModal(item)` → pick a group → `#groupAssignDone` sets `item.group`); asserts no console / page errors; `npx playwright test groups.spec.js` |
| [features/grid.js](features/grid.js) | Fifteenth feature-file split (`window.App` registry pilot #15) — the Grid Settings modal (`#gridSettingsModal`) + the grid-overlay toggle, carved out of the `// SECTION: Counter modal` grab-bag. `toggleGridOverlay` + the `gridBtn`/`gridBtnSidebar` bindings + the `#gridSettingsCancel`/`#gridSetOriginOnPage`/`#gridClearOrigin`/`.gridSpacingPreset`/`.grid-line-style-opt`/`#gridSettingsApply` handlers. Its own IIFE loaded **after** [app.js](app.js); registers `App.toggleGridOverlay` (only for the spec/symmetry — nothing in app.js calls it; the Grid buttons are bound inside the feature, and there is no grid hotkey). Two new publish-only deps `App.getPageScale` + `App.showSetScaleFirstToast`; the rest (`state`/`markProjectDirty`/`renderPdf`/`updateUI`/`showModal`/`hideModal`/`showToast`/`parseRealWorldLength`) were already on `App`. The `drawGrid` renderer, the snap-to-grid branch, the render-code grid-button active/disabled toggling, and `resetGridOrigin` (a state reset used by the prepare-PDF / page-setup flows, not the modal) all stay in app.js. **No registry callback needed** for the "set origin on page" handoff (contrast Groups): the feature sets the shared `state.gridOriginPickMode` flag and the app.js canvas handler reads it, writes the origin, flips it false, and reopens the modal — because the flag lives on `state`, not a closure `let`. No `// SECTION:` marker change (the grab-bag keeps the counter modal + sidebar buttons + legend + `resetGridOrigin`), so TOC stays 48 |
| [grid.spec.js](grid.spec.js) | Playwright regression for pilot #15 — uploads `test-2pages.pdf`, asserts `window.App.toggleGridOverlay` is a function, sets a page scale via `state.pages[0].scale`, opens the modal with `App.toggleGridOverlay()`, sets `#gridSpacingValue` + `#gridSettingsApply` and asserts `state.gridSettings.spacing` + `state.showGridOverlay === true` + the modal closed; also asserts that with no page scale the open path shows the "Set Scale first" toast and does NOT open the modal; asserts no console / page errors; `npx playwright test grid.spec.js` |
| [features/quick-line.js](features/quick-line.js) | Sixteenth feature-file split (`window.App` registry pilot #16) — the Quick Line modal (the "quick" tab body of `#chooseLineTypeModal`): `populateQuickLineModal` + `updateQuickLineNamePreview` + `removeLineModifier`, plus the `#plumLineBtn` opener and the `#quickLineSize`/`#quickLineMaterial`/`#quickLineRemoveSize`/`#quickLineRemoveMaterial`/`#quickLineAddSize`/`#quickLineAddMaterial`/`#quickLineCancel`/`#quickLineAdd` handlers. Its own IIFE loaded **after** [app.js](app.js). **Takes over publishing `App.populateQuickLineModal`** — that publish moved here from app.js, and [features/choose-create-line-type.js](features/choose-create-line-type.js) keeps consuming it via `App.*` at call time (load order between the two feature files is irrelevant: registration at load, the call on user action). Two new publish-only deps `App.getLineModifiers` + `App.saveLineModifiers` (the line-modifier persistence stays in app.js); the rest (`state`/`COLORS`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`showModal`/`hideModal`/`updateUI`/`showLineColorModal`/`showLineTypeTab`) were already on `App`. The separate "Add Line Type" modal (`#addLineType`/`#lineTypeModal`) stays in app.js. **Renamed** the now-stale `// SECTION: Quick Line modal` marker → `// SECTION: Add Line Type modal` (rename, not removal, TOC stays 48) |
| [quick-line.spec.js](quick-line.spec.js) | Playwright regression for pilot #16 — uploads `test-2pages.pdf`, asserts `window.App.populateQuickLineModal` is a function, opens the quick tab (`#plumLineBtn`), asserts the `#quickLineSize`/`#quickLineMaterial` selects are populated, then `#quickLineAdd` creates a line type (asserts `state.lineTypes` grew + `state.activeLineTypeId` points at it + the modal closed); asserts no console / page errors. The cross-file handoff is also guarded by [choose-create-line-type.spec.js](choose-create-line-type.spec.js) (which exercises `showLineTypeTab('quick') → App.populateQuickLineModal()`); `npx playwright test quick-line.spec.js` |
| [features/counter.js](features/counter.js) | Seventeenth feature-file split (`window.App` registry pilot #17) — the Counter modal (`#counterModal`) choose/create-counter picker, an **interleaved** extraction from the Counter-modal grab-bag. `showCounterTab` + `showCounterIconTab` + `populateCounterChooseList`, the choose-tab handlers (`#counterBtn`/`.counter-tab`/`#counterModalSearchInput`/`#counterChooseCancel`) and the create-tab handlers (`#addCounter`/`.counter-icon-tab`/`#counterIconSearch`/`#counterCancel`/`#counterCreate`). Its own IIFE loaded **after** [app.js](app.js); registers `App.showCounterTab`. **Bidirectional quickcount coupling** (same shape as Quick Line): it consumes `App.populateCounterQuickCountPanel` (the quickcount tab body stays in app.js's Quick Count section), and the Quick Count code (`#plumBtn`) + the Shift+C hotkey reach the tab via `App.showCounterTab('quickcount')`. Three new publish-only deps `App.getIconName` + `App.getEffectiveCustomIcons` + `App.populateCounterQuickCountPanel`; the rest (`state`/`COLORS`/`TOOL`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`showModal`/`hideModal`/`updateUI`/`getOrderedIcons`/`iconVbFor`) were already on `App`. The interleaved neighbors (`#doneEditing`, the sidebar tool buttons, `toggleLegendOverlay` + legend buttons, the `iconVbFor` global helper) stay in app.js; the many `#counterBtn.click()` DOM triggers keep working since the handler moves with the element. **Renamed** the `// SECTION: Counter modal` marker → `// SECTION: Tool sidebar buttons & legend overlay` (rename, not removal, TOC stays 48) |
| [counter.spec.js](counter.spec.js) | Playwright regression for pilot #17 — uploads `test-2pages.pdf`, asserts `window.App.showCounterTab` is a function, creates a counter via the Create tab (`#addCounter` → name → `#counterCreate`, asserts `state.counters` grew + `state.activeCounterType` points at it + the modal closed), reopens and selects it from the Choose list (asserts the modal closes and `state.activeCounterType` matches); asserts no console / page errors; `npx playwright test counter.spec.js` |
| [features/save-status.js](features/save-status.js) | Eighteenth feature-file split (`window.App` registry pilot #18) and **first save/sync-domain UI split** — the on-demand Save Status modal (`#saveStatusModal`): `renderSaveStatusModalContent` + `openSaveStatusModal` + the render helpers `escSaveStatusHtml`/`applySaveStatusSummaryBlock` + the bell open buttons and `#saveStatusModalClose`/`#saveStatusModalDone`/`#saveStatusVerboseToggle`/`#saveStatusExportBtn`/`#saveStatusCopyBtn` handlers; the modal's `saveStatusModalTickTimer` is now a private `let`. Its own IIFE loaded **after** [app.js](app.js); registers `App.openSaveStatusModal` + `App.renderSaveStatusModalContent` (the latter is also called by the checkout-expired recovery re-check handler). The **hot-path bell** `updateSaveStatusIndicator` (called from 25+ sites incl. updateUI) and the whole save engine stay in app.js. Seven new publish-only deps (`getCloudSaveSummary`, `pruneSaveStatusLog`, `getSaveStatusLogWindowMs`, `isSaveDebugEnabled`, `setSaveDebugEnabled`, `buildSaveLogsEnvelopeWithSnapshots`, `pushSaveEvent`) plus **two getter accessors** `App.getSaveStatusLog()` + `App.isCheckoutExpiredAttention()` — used instead of value publishes because the underlying app.js vars (`saveStatusLog` reset to `[]`; `checkoutExpiredNeedsAttention` with many engine writers) are reassigned and a captured reference would go stale. `#syncPausedBannerRetry` stays in app.js. **Removed** the emptied `// SECTION: Save Status modal` marker (TOC 48 → 47) |
| [save-status.spec.js](save-status.spec.js) | Playwright regression for pilot #18 — asserts `window.App.openSaveStatusModal` is a function, opens via `App.openSaveStatusModal()`, asserts `#saveStatusModal.visible` + the `#saveStatusEventList` renders, toggles `#saveStatusVerboseToggle`, asserts the `#saveStatusExportBtn`/`#saveStatusCopyBtn` exist and clicking does not throw (without asserting clipboard/download contents), closes via `#saveStatusModalClose`; asserts no console / page errors; `npx playwright test save-status.spec.js` |
| [features/manage-projects.js](features/manage-projects.js) | Nineteenth feature-file split (`window.App` registry pilot #19) — the admin Manage Projects modal (`#manageProjectsModal`): `openManageProjectsModal` (lists projects via the `list_projects_for_admin` RPC), the internal `forceCheckInProjectFromManage` (`force_check_in_project` RPC) + `deleteProject` (`admin-delete-project` Edge Function), and the `#manageProjectsModalClose` handler. Its own IIFE loaded **after** [app.js](app.js); registers `App.openManageProjectsModal`. **Cloud-coupled** — it reaches the Supabase client via **`App.getSupabase()`** (the second getter-accessor: `supabase` is reassigned by the client-recycle `recreateSupabaseClient`, so a value publish would go stale). Five other new publish-only deps: the env constants `SUPABASE_URL`/`SUPABASE_ANON_KEY`, and the engine helpers `updateServerClockFromRpc`/`clearCheckoutExpiredAttention`/`resetAutoRecheckoutCounter` (the last published as a **deferred wrapper** `App.fn = (a) => fn(a)` since it is a sloppy-mode hoisted block declaration); `state`/`showModal`/`hideModal`/`showToast` were already on `App`. The `#settingsManageProjects` opener (now `App.openManageProjectsModal()`) and the Escape-key close branch stay in app.js. **Renamed** the `// SECTION: Manage Projects modal` marker → `// SECTION: Auth & settings entry buttons` (the auth/settings entry-button block that shared it stays; rename, not removal, TOC stays 47) |
| [manage-projects.spec.js](manage-projects.spec.js) | Playwright regression for pilot #19 — an always-run registry-contract test (asserts `window.App.openManageProjectsModal` is a function and that calling it with no session is a safe no-op: `#manageProjectsModal` does not become visible and nothing throws), plus a cloud-gated test (`ensureSignedInWithProject` from `cloud-test-helpers.js` in `beforeAll`, `test.skip` when no cloud secrets) that opens Settings → Manage Projects and asserts the project list + a Delete button render. Asserts no console / page errors; `npx playwright test manage-projects.spec.js` |
| [features/user-admin.js](features/user-admin.js) | Twentieth feature-file split (`window.App` registry pilot #20) — the admin user-management modals: `openManageUserModal` (user list + delete + activity, via `list_users_for_admin` RPC / `admin-list-users` Edge Fn), `openAllUsersModal` (read-only list), `deleteUser` (`admin-delete-user`), plus the `#manageUsersBtn` create-user opener + `#adminCreateForm` (`admin-create-user`) and the `#adminPanelClose`/`#manageUserModalClose`/`#allUsersModalClose`/`manageUserModalAllActivityBtn` handlers. Its own IIFE loaded **after** [app.js](app.js); registers `App.openManageUserModal` + `App.openAllUsersModal`. Three new publish-only deps: `App.formatLastSignIn` (a `format.js` global, lint-invisible to the features group so it must be published), `App.USER_ACTIVITY_ICON_SVG`, and `App.openUserActivityModal` (the User Activity modal **stays** in app.js; the moved lists + the all-activity button reach it via `App.*`); `state`/`showModal`/`hideModal`/`SUPABASE_URL`/`SUPABASE_ANON_KEY` were already on `App`. **My Settings** (`openMySettings`, which owns the airboard cloud-sync) deliberately stays in app.js under the renamed marker `// SECTION: My Settings modal`; its `#mySettingsManageUser`/`#mySettingsAllUsers` openers reach the feature via `App.*`. The moved handlers were interleaved with the User Activity + Canvas Repair handlers (which stay) in the Event Binding region. **Renamed** the `// SECTION: User Settings & Manage Users` marker → `// SECTION: My Settings modal` (rename, not removal, TOC stays 47). **Since extended** with the full Manage Users toolkit: an owned-`project_count` column (`list_users_for_admin` gained the count; clicking it opens `#userProjectsModal`, a per-user project list from `list_projects_for_admin`); a stacked last-sign-in/last-active cell; per-row **Set Password** (🔑 → `#setPasswordModal` → `admin-set-password`), **Transfer projects** (⇄ → `#transferProjectsModal` → `admin-reassign-projects`), and a **Delete** dialog (`#deleteUserConfirmModal`) that can **reassign** the user's projects to someone else before deleting (`admin-delete-user` with `reassignToUserId`); transfer/reassign share `supabase/functions/_shared/reassignProjects.ts`, which moves the project rows **and** their owner-scoped PDF storage objects, reassigns inherited view links, and clears redundant shares. Clicking the stacked dates cell or the heart icon opens the rich **Activity overview** `#userActivityOverviewModal` via `App.openUserActivityOverview` — the overview itself (and the `#mySettingsMyActivity` **My Activity** opener) **moved to [features/user-activity.js](features/user-activity.js)** so both activity surfaces live in one file |
| [user-admin.spec.js](user-admin.spec.js) | Playwright regression for pilot #20 — an always-run registry-contract test (asserts `window.App.openManageUserModal` + `openAllUsersModal` are functions and that calling them with no session is a safe no-op: the modals do not become visible and nothing throws), plus a cloud-gated test (`ensureSignedInWithProject`, `test.skip` when no cloud) that opens via `App.openManageUserModal()` and asserts `#manageUserModal.visible` + the list element gets content. Asserts no console / page errors; `npx playwright test user-admin.spec.js` |
| [features/load-project.js](features/load-project.js) | Twenty-first feature-file split (`window.App` registry pilot #21) and the **most dependency-heavy** so far — the cloud Load Project modal `openLoadProjectModal` (~585 lines: project browser list, ownership/role filters, per-row access panels + invite via `invite-to-project`, copy/download/delete row actions, and the project-load action). Its own IIFE loaded **after** [app.js](app.js); reads deps from `App` and re-reads `App.getSupabase()` in the outer fn + each nested async helper (client can be recycled); registers `App.openLoadProjectModal`. The save-before-load gate `openLoadProjectModalOrPromptSave` + the `#loadProject*` bindings + Escape branch **stay** in app.js and call `App.openLoadProjectModal()`. Because the project-load action is fused with the boot/engine path, ~20 publish-only deps are exposed on `App` (`updateSaveStatusIndicator`, `canUseDevAuth`, `deleteProjectAsOwner`, `openCopyProjectModalOrPromptSave`, `hydrateProjectFromCloudRow`, `clearUndoStacks`, `subscribeToProjectCheckoutChanges`, `checkInCurrentProjectIfHeld`, `takeoffBackupGet`, `resolvePdfBufferForCloudProject`, `ensureGroupColors`, `openCanvasOnlyNeedsPdfModal`, `buildPagesFromPdfArrayBufferAndProjectData`, `backupDataToProjFormat`, `fitZoom`, `SUPABASE_URL`), incl. four **setters** (`setAutoSaveDirty`/`setLastModifiedAt`/`setLastLocalBackupAt`/`setLastSaveIncludedPdf`) for engine `let`-state the load resets (it cannot assign through the registry otherwise). The leftover grab-bag under the old `// SECTION: Load Project modal` marker was re-sectioned into 8 honest markers, and `// SECTION: Canvas Event Handlers` moved up to absorb the stray `showContextMenu`. The modal header has an admin-only **Advanced** toggle (`#loadProjectAdvancedToggle`, persisted via `loadProjectAdvanced`) that shows/hides every row's "Who has access" block by toggling a `hide-access` class on `#loadProjectList` (default OFF = hidden) |
| [load-project.spec.js](load-project.spec.js) | Playwright regression for pilot #21 — an always-run registry-contract test (`window.App.openLoadProjectModal` is a function; with Supabase unconfigured the modal shows "Cloud not configured" and becomes visible without throwing), plus a cloud-gated test (`ensureSignedInWithProject`, `test.skip` when no cloud) that opens via `App.openLoadProjectModal()` and asserts `#loadProjectModal.visible` + `#loadProjectList` (or `#loadProjectEmpty`) populated. Asserts no console / page errors; `npx playwright test load-project.spec.js` |
| [features/prepare-pdf.js](features/prepare-pdf.js) | Twenty-second feature-file split (`window.App` registry pilot #22) — the Prepare PDF modal: `openPreparePdfModal` + its preview/nav/render helpers (`renderPreparePdfPreview`, `saveCurrentPageName`, `updatePreparePdfControls`) + `preparePdfRotatePage90` + `commitPreparePdfToState` + `closePreparePdfModal` + the `#preparePdf*` bindings. Its own IIFE loaded **after** [app.js](app.js); the ~9 private `preparePdf*` state lets move **with** the feature as module-locals (no setters). Registers `App.openPreparePdfModal`; re-assigns `window.closePreparePdfModal` (inline-HTML/Escape use it). The PDF intake pipeline (upload, `loadTestPdf`, hashing) stays in app.js under the renamed `// SECTION: PDF intake (upload, test PDF, hashing)` marker and opens the modal via `App.openPreparePdfModal()`. Eight outer-scope publish-only deps (PDF helpers `assertPdfWithinLimit`/`mergePdfBuffers`/`buildTrimmedPdfBuffer`/`resetGridOrigin` + the Save-and-open flow's `writeTakeoffStateBackup`/`downloadPdfBuffer`/`performSaveProjectToCloud`/`isAuthError`); the `features/*.js` eslint group gained the vendored-lib globals (`pdfjsLib`/`PDFLib`/`jspdf`/`html2canvas`). Interleaved siblings `openCanvasOnlyNeedsPdfModal`/`updateCanvasOnlyNeedsPdfBanner` stay in app.js |
| [prepare-pdf.spec.js](prepare-pdf.spec.js) | Playwright regression for pilot #22 — a real (non-cloud) end-to-end test: loads a small multi-page test PDF, opens via `App.openPreparePdfModal(...)`, asserts `#preparePdfModal` visible, exercises next/prev/rotate/delete, commits, and asserts `state.pages` reflects the kept/trimmed pages. Plus the registry-contract (`window.App.openPreparePdfModal` is a function). Asserts no console / page errors; `npx playwright test prepare-pdf.spec.js` |
| [features/quick-modals.js](features/quick-modals.js) | Twenty-third feature-file split (`window.App` registry pilot #23), the cleanest since the early modals — the Quick Plumbing (`populatePlumModal` + icon-tab helpers + `removePlumbingModifier` + the `#plumBtn` opener) and Quick Count (`populateCounterQuickCountPanel` + parallel icon-tab helpers) clusters. Its own IIFE loaded **after** [app.js](app.js); no setters/flag-accessors, no private module state. Two new publish-only deps `getPlumbingModifiers`/`savePlumbingModifiers`. Registers `App.populatePlumModal`, `App.populateCounterQuickCountPanel` (registration **moved here from app.js** — `features/counter.js` `showCounterTab('quickcount')` calls it), and `App.updateCounterQuickCountNamePreview` (app.js's shared custom-icon-upload handler refreshes the Quick Count grid via it). Calls back into `App.showCounterTab`; the bidirectional coupling is mediated by the registry |
| [quick-modals.spec.js](quick-modals.spec.js) | Playwright regression for pilot #23 — registry-contract (`App.populatePlumModal` + `App.populateCounterQuickCountPanel` are functions) plus a real local flow opening Quick Plumbing via `App.populatePlumModal()` (asserts `#plumModal` renders) and Quick Count via `App.showCounterTab('quickcount')` (asserts the panel populates). Asserts no console / page errors; `npx playwright test quick-modals.spec.js` |
| [features/pdf-bundle.js](features/pdf-bundle.js) | Twenty-fourth feature-file split (`window.App` registry pilot #24) — the PDF-bundling helpers `addReportPagesToPdf`/`addNotesToPdf`/`addHighlightsToPdf`/`hasAnyHighlights`/`hasAnyNotes` (report/notes/highlights → jsPDF). Its own IIFE loaded **after** [app.js](app.js). These were **already all on `App`** (publish-only for [features/export-pdfs.js](features/export-pdfs.js)), so the split **re-homes** their registrations from app.js; export-pdfs.js keeps working via `App.*`. One new publish-only dep `wrapNoteText`; `renderAnnotationsToContext`/`getPageCanvases`/`getActiveAnnotations` already on `App`; `buildReportHtml` (report.js) + `html2canvas` (CDN) are runtime globals (added `buildReportHtml` to the `features/*.js` eslint globals). app.js's 6 internal callers convert to `App.*`; the interleaved `importCanvasAfterPdf`/`clearPage` modals stay |
| [pdf-bundle.spec.js](pdf-bundle.spec.js) | Playwright regression for pilot #24 — registry-contract (the 5 bundling fns are functions on `App`) plus a light real check: with a PDF loaded, `App.hasAnyHighlights()`/`hasAnyNotes()` are false, then flip true after a highlight/note is added. Asserts no console / page errors; `npx playwright test pdf-bundle.spec.js` |
| [features/item-details.js](features/item-details.js) | Twenty-fifth feature-file split (`window.App` registry pilot #25) — the Counter / Line Type **details modal** (`#counterLineTypeDetailsModal`: rename, color, icon grid, per-page usage jump list, delete with `#deleteCounterLineTypeConfirmModal` confirm via the private `performDeleteCounterLineType`), the **Line Properties modal** (`#linePropertiesModal`: name/color/drops ±1/±10/clear + per-drop units, polyline vertex-edit entry), and **`deleteGroup`** (registration **re-homed** from app.js's registry tail — [features/groups.js](features/groups.js) keeps consuming `App.deleteGroup` at call time). The three modal-state flags (`counterLineTypeDetailsItem`, `pendingDeleteCounterLineType`, `pendingLineProperties`) move as private `let`s; the close/confirm bindings move from the zone & page-action handler block. Two core hooks: `hideModal('counterLineTypeDetailsModal')` resets the flag via the `App.onCounterLineTypeDetailsHidden` callback (Groups pattern), and the shared custom-icon upload handler reads the open item via the **feature-registered getter** `App.getCounterLineTypeDetailsItem()`. Registers `App.openCounterLineTypeDetailsModal`/`App.openLinePropertiesModal`/`App.closeLinePropertiesModal`/`App.deleteGroup`. Two new publish-only deps `enterEditMode`/`countItemsInGroup`; reuses `state`/`TOOL`/`showModal`/`hideModal`/`pushUndoSnapshot`/`markProjectDirty`/`updateUI`/`renderPdf`/`getOrderedIcons`/`getEffectiveCustomIcons`/`iconVbFor`/`getPageCanvases`/`makeAnnotations`/`showLineColorModal`/`getActiveAnnotations`/`getPageScale`/`fitZoom`. `showModal`/`hideModal` **stay** in app.js under the renamed marker `// SECTION: Modal primitives (showModal / hideModal)`; the external callers (sidebar edit pens, lines-list edit/dblclick, context-menu Line Properties, Escape branch) reach the modals via `App.*` |
| [features/output.js](features/output.js) | Twenty-sixth feature-file split (`window.App` registry pilot #26) — the **output-actions cluster** (the "Output" features): **Copy to PipeTooling** (`#forPipeTooling` dropdown toggle + `doCopyPipeTooling` with the view-link footer + the prefetched export view-link cache `exportViewLinkUrl`/`exportViewLinkProjectId` + `canExportViewLink`/`prefetchExportViewLink`), **Copy Summary** (`#copySummaryText` dropdown + `doCopyEmailSummary`), and **Download current page** (`downloadCurrentPageAsPdf` + `#downloadCurrentPageBtn` + its mode menu). No entry points registered — the bindings move with their DOM elements, so the mobile burger menu's dispatched clicks keep working untouched; the one registration is the `App.onViewLinkRevoked()` callback (the Share modal's revoke clears the private cache through it). Two new publish-only deps `SUPABASE_ENABLED`/`getOrCreateViewLinkUrl` (the view-link minting **stays** in app.js — the header Share button uses it too — under the renamed marker `// SECTION: View-link URL helpers & show-highlights/notes`); reuses `state`/`getSupabase()`/`showToast`/`showModal`/`hideModal`/`sanitizeForFilename`/`ensureActiveCanvas`/`getPageCanvases`/`renderAnnotationsToContext`/`makeAnnotations`/`logUserEvent` + the `window.*` report fns. The `downloadProjectPdf`/`downloadPdfBuffer` helpers and the header export/report dropdowns stay in app.js (markers renamed `// SECTION: PDF download helpers` and `// SECTION: Export & report dropdown menus`) |
| [output.spec.js](output.spec.js) | Playwright regression for pilot #26 — with clipboard permissions granted: the Copy Summary option writes the email summary to the clipboard + shows the copied modal; the Copy to PipeTooling option writes the tab-delimited summary and shows the "save to include a view link" toast (cloud enabled, no cloud project → no footer); the Download button opens its mode menu on a multi-page project and the this-canvas option yields a real download named `takeoff-page1_*.pdf`; `App.onViewLinkRevoked` is registered. Asserts no console / page errors; `npx playwright test output.spec.js` |
| [features/share-links.js](features/share-links.js) | Twenty-seventh feature-file split (`window.App` registry pilot #27) — the **Share Project modal** (`#shareProjectModal`): the people list (add via the `invite-to-project` Edge Function, role change / remove via `add_project_share`/`remove_project_share`, loaded via `list_users_for_project_invite` + `list_project_shares`) and the **view-links section** (list / create / Copy URL / access log / revoke via the `*_view_link*` RPCs), plus the `#shareViewLinkCreate`/`#shareProjectModalClose`/`#shareProjectAdd` bindings and the collapse toggle. Registers `App.openShareProjectModal`. Cloud-coupled: reads the client via `App.getSupabase()` at call time in every handler (client recycle + the accessor only exists when `SUPABASE_ENABLED`); revoke calls `App.onViewLinkRevoked()` ([features/output.js](features/output.js)) — **feature-to-feature coupling mediated entirely by the registry**, load order irrelevant. No new published deps (`getSupabase`/`SUPABASE_URL`/`showModal`/`hideModal`/`showToast`/`state` all pre-existing). The two openers (`#sidebarLogoShare`, `#settingsShareProject`) stay in app.js as deferred `App.*` calls; the shared view-link minting `getOrCreateViewLinkUrl` + the copy-project openers stay under the renamed marker `// SECTION: Share modal pointer & copy-project openers` |
| [share-links.spec.js](share-links.spec.js) | Playwright regression for pilot #27 — always-run registry-contract smoke (the full flow is Supabase-gated): `App.openShareProjectModal` + `App.onViewLinkRevoked` are functions; opening with no cloud project/session is a safe no-op (modal stays hidden); the view-links collapse toggle round-trips; the close binding hides a force-shown modal. Asserts no console / page errors; `npx playwright test share-links.spec.js` |
| [features/import-clear.js](features/import-clear.js) | Twenty-eighth feature-file split (`window.App` registry pilot #28) — the **canvas JSON import** (`#importInput` change handler + the `#importBtn`/`#importBtnSidebar` openers + the import-canvas-after-PDF prompt modal `#importCanvasAfterPdfModal`) and the **Clear Page confirm flow** (`showClearPageModal` + the `#clearPage`/`#clearPageSidebar` openers + the `#clearPageCancel`/`#clearPageConfirm` handlers, consolidated from the zone & page-action handler block). Registers `App.showClearPageModal` (the Project Settings row stays in app.js as a deferred `App.*` call); the other bindings move with their DOM elements. Two new publish-only deps `applyPageAnnotationsFromData` (the shared per-page deserialize funnel — also used by cloud load / view mode / load-annotations) and `getActiveCanvas`; reuses `state`/`ensureGroupColors`/`saveUserCustomIcons`/`reconcileOrphanedCountersAndLineTypes`/`clearUndoStacks`/`markProjectDirty`/`updateUI`/`renderPdf`/`showModal`/`hideModal`/`pushUndoSnapshot`/`makeAnnotations`. The shared **custom-icon upload handler** that shared the old section stays in app.js under the renamed marker `// SECTION: Custom icon upload handler` (icon-domain infrastructure feeding four icon grids across app.js + three feature files) |
| [import-clear.spec.js](import-clear.spec.js) | Playwright regression for pilot #28 — Clear Page: the sidebar button opens the confirm naming the active canvas, Cancel preserves the markers, Confirm empties only the current page's active canvas, `App.showClearPageModal` is registered; Import: a JSON file through `#importInput` replaces the palette and `reconcileOrphanedCountersAndLineTypes` re-creates a counter for still-present orphaned markers. Asserts no console / page errors; `npx playwright test import-clear.spec.js` |
| [features/zone-modals.js](features/zone-modals.js) | Twenty-ninth feature-file split (`window.App` registry pilot #29) — the **zone & page-action modal handlers**: the Multiply Zone value modal (`#multiplyZoneModal` cancel + multiplier-input sync + the deferred Apply that creates a zone from `state.pendingMultiplyZone` or commits a `state.pendingMultiplyZoneEdit`), the Delete Zone confirm (`#deleteZoneModal` cancel/confirm → `App.performDeleteZone`), and the Delete Page confirm (`#deletePageConfirmModal` cancel/confirm → the pending `onDelete`). Like [features/output.js](features/output.js) it registers **no entry points** — every handler is element-bound and all the pending state lives on `state` (the Grid-split pattern: no callbacks needed; the canvas click handlers and page rows that seed the state stay in app.js). One new publish-only dep `performDeleteZone` (the heavy deletion mutation stays in app.js); reuses `state`/`showModal`/`hideModal`/`getActiveAnnotations`/`ensureActiveCanvas`/`pushUndoSnapshot`/`markProjectDirty`/`updateUI`/`renderPdf`/`uid`/`TOOL`. The `#hamburger`/`#sidebarBackdrop` toggles that shared the old section stay under the renamed marker `// SECTION: Sidebar drawer toggles` |
| [features/summary-detail.js](features/summary-detail.js) | The **Summary count-detail modal** (`#summaryCountDetailModal`, Tier-2 split out of the UI-render region) — `openSummaryCountDetailModal(type, id)`: per-page breakdown of one counter (multiply-zone-adjusted counts) or line type (runs + feet), each row with an async pdf.js-rendered thumbnail composited through `renderAnnotationsToContext` at the export marker/line scales. The four `renderSummary` row bindings in app.js call it via deferred `App.*` arrows. New publish-only deps: `getMultiplyZoneForPoint`, `getLineLengthFeetForTotals`, `formatFeet`. Regression: [summary-detail.spec.js](summary-detail.spec.js) |
| [features/restore-last-session.js](features/restore-last-session.js) | The **last-session restore flow** (Tier-2 split) — `doRestoreLastProject` (full session rebuild from a cloud project row or IDB takeoff backup; PDF ladder: IDB blob → cached blob → signed-URL render → storage download with background re-cache), the `#lastSessionRestoreModal` Keep/Discard handlers (Keep defers the Supabase fetch to click time; offline falls back to the IDB backup; inaccessible projects are cleaned up), and the private `pendingRestore`. Boot (app.js init) detects the candidate and hands it over via `App.openLastSessionRestorePrompt({proj,cachedBlob} | {cloudLast})`; `resetLocalSessionState` clears the flag via the defensive `App.onLastSessionRestoreReset`. idb primitives + `pdfjsLib` are classic-script globals; everything else via `App.*` at call time. Regression: [restore-last-session.spec.js](restore-last-session.spec.js) |
| [features/room-sizer.js](features/room-sizer.js) | The **Room Sizer** feature — draw room boxes on the plan, assign each a ceiling height + a Room, get per-room volumetric totals. Owns the Room Box modal (`#roomBoxModal` create/edit: height input parsed via `parseRealWorldLength`, recent-height chips persisted in `recentRoomHeights` localStorage, room choose/create with palette colors cycled from `COLORS`), the Room edit modal (`#roomEditModal` rename/recolor via `App.showLineColorModal` + delete cascade through `#roomDeleteConfirmModal`), the Rooms sidebar section (`#roomsSection`, hidden until the first box exists; box rows jump pages / delete), and `getRoomVolumeTotals({pageIndices?, getAnnotations?})` — consumed by report.js (guarded `window.App` lookup) for the report table + email summary. Registers `openRoomBoxModal` / `openRoomBoxModalForEdit` (called from the app.js `TOOL.ROOM` click/touch branches + `#ctxEditRoomBox`), `renderRoomsList` (called from `updateUI`, deferred), `getRoomVolumeTotals`. New publishes it consumes: `roomBoxDimsFeet` (pure, geometry.js), `getEffectiveScaleForLine`, `getMergedAnnotationsForPage`. The tool itself (TOOL.ROOM two-corner click path, rubber-band preview with live W×L readout, committed-box rendering via the shared `drawRoomBoxesToContext`, hit testing, delete-zone/rotation participation, legend room-volume rows, hotkey V) stays in app.js. Data: `state.rooms[]` `{id,name,color}` + per-canvas `annotations.roomBoxes[]` `{x1,y1,x2,y2,heightFt,roomId,id}`; both ride save/load/export/import/IDB-backup/undo. Regression: [room-sizer.spec.js](room-sizer.spec.js) |
| [zone-modals.spec.js](zone-modals.spec.js) | Playwright regression for pilot #29 — the Multiply Zone Apply creates a zone with the typed multiplier from a pending rect, the edit path updates an existing zone's multiplier, Cancel clears all pending multiply-zone state, and the Delete Zone cancel/confirm bindings behave (cancel clears pending; confirm with nothing pending is a no-op). Delete Page confirm is exercised by [delete-page.spec.js](delete-page.spec.js). Asserts no console / page errors; `npx playwright test zone-modals.spec.js` |
| [features/burger-menu.js](features/burger-menu.js) | Thirtieth feature-file split (`window.App` registry pilot #30) — the **mobile right-side burger drawer** (`closeBurgerMenu`/`updateBurgerMenu` + the `#headerBurger`/`#rightMenuBackdrop` bindings) and the **desktop header-overflow compact mode** (`updateHeaderCollapsed`/`scheduleHeaderCollapseCheck` + the resize listener + the load-time initial check), moved together because they are one consolidation feature sharing `closeBurgerMenu`. Registers `App.updateBurgerMenu` + `App.scheduleHeaderCollapseCheck`, which `updateUI` invokes **defensively** (`App.fn && App.fn()`) at its tail — a boot-time updateUI before this file loads is a harmless no-op (the load-time check + on-open rebuild cover it). Drawer rows dispatch the click of their CSS-hidden source control and clone its `<svg>`, so no deeper app.js functions are referenced; deps are just `state` + `SUPABASE_ENABLED` (both pre-published — zero new deps). Regressions: the pre-existing [mobile-burger-menu.spec.js](mobile-burger-menu.spec.js) + [header-overflow.spec.js](header-overflow.spec.js), which were written for this exact feature |
| [features/canvas-layers.js](features/canvas-layers.js) | Thirty-first feature-file split (`window.App` registry pilot #31; the last candidate named by the original extraction recipe) — the **canvas-layer management UI**: the Add Canvas modal (`#addCanvasModal`, new/duplicate modes; duplicate deep-copies the active layer via the new publish-only dep `App.deepCopyAnnotations`), the Canvas Details modal (`#canvasDetailsModal`, rename-committed on close; the Escape branch in app.js dispatches `#canvasDetailsClose`'s click so the commit lives in one place), the Delete Canvas confirm (→ the private `performDeleteCanvas`, which reactivates the first remaining layer), the footer layers menu (`#canvasLayersBtn`/`#canvasMenu`/`#canvasMenuAdd`), `#addCanvasBtn`, and the show-all-canvases peek toggle. The three state flags (`pendingAddCanvasMode`/`pendingCanvasEdit`/`pendingDeleteCanvas`) move as private `let`s; the `hideModal` resets go through the `App.onCanvasDetailsHidden`/`App.onDeleteCanvasConfirmHidden` callbacks; the canvas switcher's edit pen (renderCanvasSwitcher, app.js) opens the details modal via `App.openCanvasDetailsModal`. The canvas JSON export (`#exportBtn`) that shared the old section stays in app.js under the renamed marker `// SECTION: Export canvas JSON` |
| [canvas-layers.spec.js](canvas-layers.spec.js) | Playwright regression for pilot #31 — Add creates an empty active layer; duplicate mode deep-copies the seeded layer's markers into a distinct annotations object; rename commits via Done **and** via Escape (same `#canvasDetailsClose` path); the delete confirm names the layer, removes it, and reactivates the first remaining one. Asserts no console / page errors; `npx playwright test canvas-layers.spec.js` (the peek toggle is covered by [show-all-canvases.spec.js](show-all-canvases.spec.js)) |
| [features/my-settings.js](features/my-settings.js) | Thirty-second feature-file split (`window.App` registry pilot #32) — the **My Settings modal** (`#mySettingsModal`), the surface pilot #20 deliberately deferred: `openMySettings` (signed-out falls through to the auth modal via a dispatched `#authBtn` click), the **Artboard** rows (Save/Load via the newly-published engine helpers `App.saveUserAirboard`/`App.fetchUserAirboard`, Export to `artboard-backup.json`, Clear-with-defaults using the newly-published `App.PLUMBING_DEFAULTS`/`App.LINE_DEFAULTS`), the change-password form (`supabase.auth.updateUser` via `App.getSupabase()`), sign-out, close, and the admin Manage-Users/Manage-User/All-Users openers (feature-to-feature: `App.openManageUserModal`/`App.openAllUsersModal` + a dispatched `#manageUsersBtn` click into [features/user-admin.js](features/user-admin.js), whose `#mySettingsMyActivity` binding was already there). Registers `App.openMySettings`; the three openers (`#authBtn` signed-in path, `#sidebarLogoUser`, `#statusBarAuth`) stay in app.js as deferred `App.*` calls. The Airboard engine (`fetchUserAirboard`/`saveUserAirboard`) and the auth sign-in form stay in app.js (markers renamed `// SECTION: My Settings pointer` / `// SECTION: Settings menu actions` / `// SECTION: Auth sign-in form`) |
| [my-settings.spec.js](my-settings.spec.js) | Playwright regression for pilot #32 — always-run: `App.openMySettings` registered; signed-out open falls through to the auth modal; Export artboard yields a real `artboard-backup.json` download; Clear artboard empties the palette + resets active tool state; the close binding hides a force-shown modal. The airboard cloud round-trip and password change stay cloud-gated per convention. Asserts no console / page errors; `npx playwright test my-settings.spec.js` |
| [features/user-activity.js](features/user-activity.js) | Thirty-third feature-file split (`window.App` registry pilot #33; the last rung of the modal ladder) — the **admin User Activity modal** (`#userActivityModal`, the raw event log): `openUserActivityModal` (per-user events or the all-users view via raw `fetch()` against `list_user_activity_for_admin`), the Events/Summary view toggle (`list_user_activity_summary_for_admin`), the user-select dropdown (`list_users_for_admin`), the client-side filter over `state.userActivityAllRowsCache`, and the close binding; the `userActivitySelectSuppress` flag moves as a private `let`. ALSO owns the rich per-user **Activity overview** (`#userActivityOverviewModal`, moved from [features/user-admin.js](features/user-admin.js)): `openUserActivityOverview` → one `user_activity_detail_for_admin(uuid)` jsonb → summary card + stat tiles + a day-grouped, run-collapsed feed, plus the `#uaoClose`/`#mySettingsMyActivity` bindings — not admin-only (the RPC guard is **self-or-admin**; My Settings → My Activity opens it for the signed-in user). Both registrations (`App.openUserActivityModal`, `App.openUserActivityOverview`) **re-home here** — [features/user-admin.js](features/user-admin.js) consumes them at call time. Uses the published `SUPABASE_URL`/`SUPABASE_ANON_KEY` + the session token from `App.state` (these calls never used supabase-js). Three new publishes for the format.js helpers it renders with (`filterUserActivityRows`/`renderUserActivityAllUsersTableHtml`/`formatLastSignInUserActivity` — format.js globals are lint-invisible to the features eslint group); the pure formatters themselves stay in [format.js](format.js) |
| [user-activity.spec.js](user-activity.spec.js) | Playwright regression for pilot #33 — always-run: the re-homed `App.openUserActivityModal` is wired; opening without an admin session is a safe no-op; the client-side filter pipeline works against a seeded rows cache (typing filters the rendered table, a non-match shows the no-match message, Clear restores the full table); the close binding hides the modal. The loaders stay cloud-gated per convention. Asserts no console / page errors; `npx playwright test user-activity.spec.js` |
| [item-details.spec.js](item-details.spec.js) | Playwright regression for pilot #25 — seeds a counter (markers on 2 pages) + line type + grouped quick line, then drives the moved surface end-to-end: sidebar edit pen opens the details modal (title, per-page usage rows, getter returns the open item), rename persists on blur, the moved close binding resets the item, the delete flow routes confirm-modal → `performDeleteCounterLineType` (counter + all markers gone, both modals hidden), Line Properties opens via the context-menu path and Escape closes it via `App.closeLinePropertiesModal` persisting a just-typed drop, and `App.deleteGroup` clears the group off annotations. Asserts no console / page errors; `npx playwright test item-details.spec.js` |
| [scripts/build-toc.js](scripts/build-toc.js) | Node script (no deps) that regenerates the line-numbered section index in this file from the `// SECTION:` markers in [app.js](app.js), writing between the BEGIN/END SECTION TOC markers; `npm run build:toc` rewrites in place, `node scripts/build-toc.js --check` exits non-zero when stale |
| [eslint.config.js](eslint.config.js) | ESLint v9 flat config for all `.js` (browser modules + Node tooling + `app.js`); `npm run lint`. Enumerates report.js's cross-file project globals as `readonly` so `no-undef`/`no-redeclare` stay on. The `app.js` group auto-derives the sibling modules' exports as `readonly` globals (via `require()`, including [idb.js](idb.js), [format.js](format.js), [icon-render.js](icon-render.js), and [line-metrics.js](line-metrics.js)) and runs the recommended set as warnings with `no-undef` re-raised to error. The constants-only pure-module group (`idb.js` + `format.js`) gets a constants-only global set, [icon-render.js](icon-render.js) gets its own icons-only group (`icons.js` globals), and [line-metrics.js](line-metrics.js) gets a geometry-only group (`geometry.js` globals) — in all cases not their own exports, which would trip `no-redeclare`. A `features/*.js` group lints the registry feature files (browser globals + `module` readonly, `sourceType: 'script'`, `no-undef` error, `no-unused-vars` off since they exist to publish onto `App`). Now that the JS lives in `app.js` (not an inline `<script>`), the whole app is linted |

High level: the `<head>` of [index.html](index.html) loads `config.js`, the
**vendored** libs (`vendor/pdf.min-*`, `vendor/pdf-lib-*`, `vendor/html2canvas-*`,
`vendor/jspdf.umd-*`, `vendor/supabase-js-*`, `vendor/tus-js-client-*` — self-hosted,
not CDN, so the app is same-origin and offline-cacheable), the self-hosted fonts
(`vendor/fonts/fonts.css`), `styles.css`,
`icons.js`, `icon-render.js`, `geometry.js`, `line-metrics.js`, `constants.js`,
`idb.js`, `format.js`, and `save-utils.js`. The body holds the app shell + every modal,
then loads `app.js` (the main JS IIFE — the bulk of the app logic), then the
feature-file splits (`features/canvas-repair.js`, `features/note.js`,
`features/zoom.js`, `features/zoom-rail.js`, `features/manage-icons.js`,
`features/multiply-zone-settings.js`, `features/export-pdfs.js`,
`features/legend-settings.js`, `features/page-settings.js`,
`features/counter-settings.js`, `features/line-type-settings.js`,
`features/choose-create-line-type.js`, `features/scale.js`, `features/groups.js`, `features/grid.js`, `features/quick-line.js`, `features/counter.js`, `features/save-status.js`, `features/manage-projects.js`, `features/user-admin.js`), followed by `report.js`. The CSS, icon data, pure icon-render rules, pure geometry/parse
primitives, pure constant literals, the IndexedDB storage layer, pure
date/time/text formatters, pure save/sync helpers, and finally the main IIFE
itself were lifted out of `index.html` into `styles.css` / `icons.js` /
`icon-render.js` / `geometry.js` / `constants.js` / `idb.js` / `format.js` /
`save-utils.js` / `app.js` (no build step — plain `<link>` / `<script src>`).
`icon-render.js` loads after `icons.js` (it reads `CUSTOM_ICONS` /
`VB_384_512_PATHS` / `FA_PATHS` by bare name); `idb.js` and `format.js` load
after `constants.js` (they read its globals — store names/caps,
`USER_ACTIVITY_TZ` — by bare name); all load before `app.js`. `app.js` resolves
the module values by bare name (shared global lexical scope); `report.js`
resolves `app.js`'s output via `window.*`.

### Feature files / `window.App` registry

`app.js` is one ~14k-line IIFE: `state`, ~50 `let` flags, and ~100 functions
are closure-locals, so a feature file in a separate `<script>` cannot see them
by bare name. To split it incrementally without a build step, `app.js` publishes
a small, named contract onto a shared global registry, and feature files read
from / write to that registry. This formalizes the pre-existing `window.*`
report.js bridge.

Contract:

- **Registry object.** Near its export tail (`// SECTION: App feature registry`),
  `app.js` does `const App = (window.App = window.App || {});` and publishes the
  cross-cutting surface a feature needs: `App.state` (a live object reference, so
  it stays current), plus stable function refs (`App.uid`, `App.makeAnnotations`,
  `App.applyRotationDeltaToAnnotations`,
  `App.reconcileOrphanedCountersAndLineTypes`, `App.pushUndoSnapshot`,
  `App.markProjectDirty`, `App.showModal`, `App.hideModal`, `App.renderPdf`,
  `App.updateUI`, `App.showLineColorModal`, `App.ensureActiveCanvas`,
  `App.getMaxZoom`, `App.getWheelZoomSpeed`, `App.getOrderedIcons`,
  `App.iconVbFor`, `App.getUserCustomIcons`, `App.saveUserCustomIcons`,
  `App.showToast`, `App.getPageCanvases`, `App.renderAnnotationsToContext`,
  `App.addReportPagesToPdf`, `App.addHighlightsToPdf`, `App.addNotesToPdf`,
  `App.hasAnyHighlights`, `App.hasAnyNotes`, `App.sanitizeForFilename`,
  `App.logUserEvent`, `App.renderPagesList`, `App.renderAnnotations`,
  `App.renderCountersList`, `App.renderLineTypesList`, `App.DROP_ICON_STYLES`, …). Some entries are
  "publish-only" — the function stays defined in app.js because it is used
  widely there, and is merely exposed on `App` (e.g. `ensureActiveCanvas`,
  `getMaxZoom`, `getWheelZoomSpeed`, `getOrderedIcons`, `iconVbFor`,
  `getUserCustomIcons`, `saveUserCustomIcons`, `showToast`, the 9 Export
  PDFs deps `getPageCanvases`/`renderAnnotationsToContext`/`addReportPagesToPdf`/
  `addHighlightsToPdf`/`addNotesToPdf`/`hasAnyHighlights`/`hasAnyNotes`/
  `sanitizeForFilename`/`logUserEvent`, Page settings's `renderPagesList`, and
  Counter settings's `renderAnnotations`/`renderCountersList`, and Line type
  settings's `renderLineTypesList`/`DROP_ICON_STYLES`);
  only the feature's own functions move out.
  Grow this surface as more features move out. The existing `window.*` report.js
  exports are left untouched.
- **Feature file shape.** `features/<name>.js` is its own IIFE that opens with
  `const App = (window.App = window.App || {});`, declares its functions with
  every bare app-dep rewritten to `App.*` (function-local helpers like a
  `ROT_OPTS` array move with the function), then registers its public entry
  points: `App.openCanvasRepairModal = openCanvasRepairModal;` etc.
- **Load order.** Feature files load **after** `app.js` (and before `report.js`)
  in [index.html](index.html). Feature functions only run on user actions — long
  after every `<script>` has loaded and `app.js` has populated `App` — so all
  deps are present at call time. Read deps from `App.*` **inside** the functions
  (at call time), never captured at module load.
- **Deferred bindings.** Call sites in `app.js` must not read `App.fn` before the
  feature file registers it, so they use deferred arrows:
  `el.onclick = () => App.applyCanvasRepair();` (not `el.onclick = applyCanvasRepair`).
- **Extraction recipe.** Pick a contiguous, function-based section with few
  inbound call sites → move it to `features/<name>.js` → rewrite bare app-deps to
  `App.*` and register the publics on `App.*` → publish any newly-needed deps in
  app.js's registry block → add the `<script>` after `app.js` → defer the
  call-site bindings → add a Playwright spec. Candidate next sections: the
  line-type/counter/page-settings handler block, Canvas layers.

Extracted so far: Canvas Repair → [features/canvas-repair.js](features/canvas-repair.js),
the Note modal → [features/note.js](features/note.js), the Zoom Settings
modal → [features/zoom.js](features/zoom.js), the Zoom Rail (the giant
right-edge vertical zoom slider) → [features/zoom-rail.js](features/zoom-rail.js),
the Manage Icons modal →
[features/manage-icons.js](features/manage-icons.js) (the first multi-region
move — opener + a separate Close/Cancel/Save handler block), the Multiply
Zone **settings** modal → [features/multiply-zone-settings.js](features/multiply-zone-settings.js)
(the first move needing **no** new published deps — every dep was already on
`App`), the Export PDFs modal → [features/export-pdfs.js](features/export-pdfs.js)
(the largest single move so far — the ~250-line `specificPages*` cluster, 9
publish-only deps, an **interleaved** move where the shared download helpers +
PipeTooling toggle stayed in app.js), and the Summary Legend **settings** modal
→ [features/legend-settings.js](features/legend-settings.js) (the **second**
zero-new-dep move and lowest-risk yet — reuses only `state`/`showModal`/
`hideModal`/`renderPdf`; no `// SECTION:` marker changed), and the Page
**settings** modal → [features/page-settings.js](features/page-settings.js)
(one new publish-only dep `renderPagesList`; the second clean unit drained from
the settings grab-bag; no `// SECTION:` marker changed), and the Counter
**settings** modal → [features/counter-settings.js](features/counter-settings.js)
(the **first two-region consolidation** — its opener/close/reorder plus a
separate value-handlers section merged into one file, 2 new publish-only deps
`renderAnnotations`/`renderCountersList`, and the **first pilot to reduce the
TOC count**, 50 → 49), and the Line type **settings** modal →
[features/line-type-settings.js](features/line-type-settings.js) (the **final
settings-modal unit** — empties the grab-bag; 2 new publish-only deps
`renderLineTypesList`/`DROP_ICON_STYLES`; renamed the now-stale section marker).
Each feature's own functions left
`app.js`, so they no longer appear in the TOC below (`build-toc` only scans
`app.js`). Where the departing `// SECTION:` marker actually headed a grab-bag
of unrelated handlers, the marker was rewritten/replaced to stay honest: Note
left behind `// SECTION: Zone & page-action modal handlers` (multiply-zone /
delete-zone / clear-page / delete-page / counter-line-type / line-properties);
Zoom replaced its old marker with three accurate ones — `// SECTION: Counter
settings handlers`, `// SECTION: Polyline modal & drawing`, and `// SECTION:
Zoom bar & page navigation`. Manage Icons's `// SECTION: Manage Icons modal`
marker headed only its opener (the next marker followed immediately), so it
departed cleanly with no re-sectioning. Multiply Zone settings replaced its
mislabeled `// SECTION: Multiply Zone settings` marker (which actually headed a
grab-bag of line-color / line-type / counter / page-settings handlers) with
`// SECTION: Line type, counter & page settings modal handlers`. Export PDFs was
an **interleaved** move (the shared `sanitizeForFilename`/`downloadPdfBuffer`/
`downloadProjectPdf` helpers + the PipeTooling toggle sat in the middle of the
old section and stayed), so its `// SECTION: Export PDFs modal` marker was
**renamed** `// SECTION: PDF download helpers & PipeTooling menu` (it now heads
the 3 retained helpers + the dropdown toggle) rather than departing — net TOC
count unchanged. Legend settings changed **no** marker at all — its pieces were
interspersed within `// SECTION: Line type, counter & page settings modal
handlers` (which keeps all its other content), so removing them left the marker
and TOC count untouched. Page settings (pilot #8) likewise changed no marker —
its opener + toggles + close were interspersed within the same section, so they
departed without touching the marker or the TOC count. Counter settings (pilot
#10) is the exception that *removes* a marker: its value-handlers section
`// SECTION: Counter settings handlers` was emptied entirely and deleted (its
opener/close/reorder were plucked from the grab-bag, which still keeps its other
content), dropping the TOC count 50 → 49. Line type settings (pilot #11) then
emptied the grab-bag of its last settings modal and **renamed** the now-stale
`// SECTION: Line type, counter & page settings modal handlers` marker →
`// SECTION: Choose/Create Line Type, line color & sidebar handlers` (rename, not
removal, so the count stays 49); it now honestly heads the Choose/Create-Line-Type
modal, the line-color handlers, and the remaining sidebar plumbing. Choose/Create
Line Type (pilot #12) then plucked the Choose/Create modal (`showLineTypeTab` +
`populateChooseLineTypeList` + `showChooseLineTypeModal` + the modal handlers) out
of that section and **renamed** the marker again →
`// SECTION: Line color & sidebar handlers` (rename, not removal, count stays 49);
it now heads only the line-color handlers and the sidebar plumbing. This was the
**first split to share constants via the registry** (`TOOL`/`COLORS`). Scale
(pilot #13) pulled the Scale modal (`updateScalePlaceholder` + `openScaleModal` +
`resetScaleModalZoneMode` + `applyScaleObjectToZoneOrPage` + `showScaleTab` + its
`#scale*` handlers) out of the `// SECTION: Scale modal` grab-bag and **renamed**
that marker → `// SECTION: Toolbar tool buttons` (rename, not removal, count stays
49); it now heads only the measure/move/zone tool buttons that shared it. This was
the **first split to route geometry.js globals through the registry**
(`ptDist`/`parseFraction`/`parseRealWorldLength`, alongside the `SCALE_*`
constants and `getActiveAnnotations`). Groups (pilot #14) moved **two** modals at
once (`#groupModal` + `#groupAssignModal`) plus their three shared state flags
into [features/groups.js](features/groups.js), and was the **first split to need
a core-function → feature callback**: the `hideModal('groupModal')` reset hook in
app.js now calls `App.onGroupModalHidden()` to clear the now-private
`openedGroupModalFromAssign` flag (one new publish-only dep, `App.deleteGroup`,
stays in app.js). It **emptied and removed** the `// SECTION: Groups` marker
(removal, not rename), dropping the section count 49 → 48 — the second pilot to
reduce the TOC (after Counter settings #10's 50 → 49). Grid (pilot #15) carved the
self-contained Grid Settings modal (`toggleGridOverlay` + the `#gridSettings*`
handlers) out of the `// SECTION: Counter modal` grab-bag into
[features/grid.js](features/grid.js) — the **cleanest split to date**: no external
callers (the Grid buttons bind inside the feature, no hotkey), and the
"set origin on page" handoff needs **no callback** because it rides the shared
`state.gridOriginPickMode` flag rather than a closure `let`. Two new publish-only
deps (`getPageScale`/`showSetScaleFirstToast`); `drawGrid` and `resetGridOrigin`
stay in app.js, and the grab-bag keeps enough content that no marker changed (TOC
stays 48). Quick Line (pilot #16) extracted the "quick" tab body of
`#chooseLineTypeModal` into [features/quick-line.js](features/quick-line.js) — the
**first split to take over publishing a registry entry from another file**:
`App.populateQuickLineModal` (consumed by choose-create-line-type.js) moved from
app.js's registry tail to quick-line.js, which now registers it. Two new
publish-only deps (`getLineModifiers`/`saveLineModifiers`); the separate "Add Line
Type" modal stays, so the `// SECTION: Quick Line modal` marker was **renamed**
`// SECTION: Add Line Type modal` (rename, not removal, TOC stays 48). Counter
(pilot #17) was an **interleaved** extraction of the Counter modal from its
grab-bag (two counter blocks sandwiching the sidebar buttons + legend toggle +
`iconVbFor`, which all stay) into [features/counter.js](features/counter.js). It
has the same bidirectional quickcount coupling as Quick Line: it registers
`App.showCounterTab` (reached by the Quick Count `#plumBtn` and the Shift+C
hotkey) and consumes `App.populateCounterQuickCountPanel` (the quickcount tab body
stays in app.js's Quick Count section). Three new publish-only deps
(`getIconName`/`getEffectiveCustomIcons`/`populateCounterQuickCountPanel`); the
`// SECTION: Counter modal` marker was **renamed**
`// SECTION: Tool sidebar buttons & legend overlay` (rename, not removal, TOC
stays 48). Save Status (pilot #18) is the **first save/sync-domain UI split**: it
pulled the on-demand Save Status modal into
[features/save-status.js](features/save-status.js) while the **hot-path bell**
(`updateSaveStatusIndicator`, 25+ callers) and the whole save engine stay in
app.js. It introduced the **getter-accessor pattern** — `App.getSaveStatusLog()`
and `App.isCheckoutExpiredAttention()` are published as getters (not value
publishes) because the underlying vars are reassigned, so a captured reference
would go stale. Seven other publish-only deps; it **emptied and removed** the
`// SECTION: Save Status modal` marker (TOC 48 → 47). Manage Projects (pilot #19)
pulled the admin Manage Projects modal into
[features/manage-projects.js](features/manage-projects.js) — the **first
cloud-coupled split** to use the getter-accessor for the Supabase client
(`App.getSupabase()`, since `supabase` is reassigned by the client-recycle), and
the first to publish a function as a **deferred wrapper**
(`App.resetAutoRecheckoutCounter = (a) => resetAutoRecheckoutCounter(a)`, a
sloppy-mode hoisted block declaration). Six other publish-only deps; the
`// SECTION: Manage Projects modal` marker was **renamed**
`// SECTION: Auth & settings entry buttons` (rename, the shared auth/settings
block stays, TOC stays 47). User-admin (pilot #20) pulled the admin
user-management modals (manage-user list, all-users list, create-user panel +
delete-user) into [features/user-admin.js](features/user-admin.js), deliberately
leaving **My Settings** (which owns the airboard cloud-sync, ~15 deps) and the
**User Activity** modal in app.js — the feature reaches User Activity via
`App.openUserActivityModal`. Three new publish-only deps
(`formatLastSignIn`/`USER_ACTIVITY_ICON_SVG`/`openUserActivityModal`); it
**renamed** the `// SECTION: User Settings & Manage Users` marker →
`// SECTION: My Settings modal` (rename, My Settings stays, TOC stays 47).
Pilots #21–#24 (Load Project, Prepare PDF, Quick Plumbing/Count, PDF bundling)
are detailed in their Files-table rows above. Item details (pilot #25) pulled
the Counter/Line Type details modal, the Line Properties modal, and
`deleteGroup` into [features/item-details.js](features/item-details.js) — the
second registration **re-home** (`App.deleteGroup`, after Quick Line's
`populateQuickLineModal` and PDF bundling's helpers) and the first
**feature-registered getter** (`App.getCounterLineTypeDetailsItem()`, read by
the shared custom-icon upload handler in app.js — the reverse direction of the
save-status getter-accessors). Two new publish-only deps
(`enterEditMode`/`countItemsInGroup`); the emptied
`// SECTION: Item detail & properties modals` marker was **renamed**
`// SECTION: Modal primitives (showModal / hideModal)` since the app-wide
`showModal`/`hideModal` stay. The output cluster (pilot #26) pulled Copy to
PipeTooling, Copy Summary, and Download current page into
[features/output.js](features/output.js) — the first split registering **no
entry points** (every binding moves with its DOM element; the burger menu's
dispatched clicks keep working), just the `App.onViewLinkRevoked` cache-clear
callback; the shared view-link minting and download helpers stay in app.js
(three markers renamed: `PDF download helpers`, `View-link URL helpers &
show-highlights/notes`, `Export & report dropdown menus`). Share links
(pilot #27) pulled the Share Project modal (people list + view links) into
[features/share-links.js](features/share-links.js) — the first split whose
mutation path crosses **two** feature files by registry alone (its revoke
calls output.js's `App.onViewLinkRevoked`); zero new published deps; the
emptied marker renamed `// SECTION: Share modal pointer & copy-project
openers` (the copy-project openers that shared it stay). Import/Clear (pilot
#28) pulled the canvas JSON import + the Clear Page confirm flow into
[features/import-clear.js](features/import-clear.js) (two new publish-only
deps `applyPageAnnotationsFromData`/`getActiveCanvas`); the shared custom-icon
upload handler stays under the renamed marker
`// SECTION: Custom icon upload handler`. Zone modals (pilot #29) pulled the
Multiply Zone value modal, Delete Zone confirm, and Delete Page confirm
handlers into [features/zone-modals.js](features/zone-modals.js) (one new
publish-only dep `performDeleteZone`; no registered entry points — the
pending state rides on `state`); the sidebar drawer toggles that shared the
section stay under the renamed marker `// SECTION: Sidebar drawer toggles`.
Burger menu (pilot #30) pulled the mobile drawer + desktop header-overflow
compact mode into [features/burger-menu.js](features/burger-menu.js) — zero
new deps; `updateUI` reaches its two hooks (`updateBurgerMenu`/
`scheduleHeaderCollapseCheck`) defensively, the first **core-hot-path →
feature** callbacks (safe because a missed boot-time call is self-healing).
Canvas layers (pilot #31) closed out the original recipe's candidate list:
the add/details/delete-canvas modals + layers menu + peek toggle moved to
[features/canvas-layers.js](features/canvas-layers.js) (one new publish-only
dep `deepCopyAnnotations`; two `onX` hidden-callbacks; the Escape branch
reuses the Done button's commit via a dispatched click); the canvas JSON
export stays under the renamed marker `// SECTION: Export canvas JSON`.
My Settings (pilot #32) pulled the deferred My Settings modal into
[features/my-settings.js](features/my-settings.js) (new publishes
`fetchUserAirboard`/`saveUserAirboard`/`PLUMBING_DEFAULTS`/`LINE_DEFAULTS`;
the Airboard engine + auth sign-in form stay). User Activity (pilot #33)
closed the modal ladder: the admin raw-log modal moved to
[features/user-activity.js](features/user-activity.js) with its loaders,
filter, and view toggle — the `App.openUserActivityModal` registration
**re-homed** there (user-admin.js keeps consuming it), plus three format.js
helper publishes (`filterUserActivityRows`/
`renderUserActivityAllUsersTableHtml`/`formatLastSignInUserActivity`).

## Section index (grep `// SECTION:`)

The JS in [app.js](app.js) is organized with `// SECTION:` comment markers. The
live list with current `app.js` line numbers is generated by `npm run build:toc`
(run it after adding or moving a `// SECTION:` marker;
`node scripts/build-toc.js --check` fails if stale):

<!-- BEGIN SECTION TOC (generated by scripts/build-toc.js - do not edit by hand) -->

- L2 - Constants
- L53 - Icon data (icon *_PATH consts, VB_384_512_PATHS, CUSTOM_ICONS) lives in icons.js,
- L97 - ICONS array lives in icons.js (see icon-data note above).
- L144 - State
- L296 - [sync] Sync recovery & client recycle
- L347 - [sync] Global force reload
- L430 - [sync] Save Status log & envelope
- L443 - [sync] Dirty tracking & local session reset
- L449 - Undo/redo stacks
- L558 - [sync] Checkout probe, hashing & PDF cache
- L620 - Math & Format Helpers
- L1237 - Coordinate Helpers
- L1245 - PDF render bitmap cache
- L1412 - PDF Rendering
- L2988 - UI Render Functions
- L4053 - Inline rename & polyline edit mode
- L4167 - Modal primitives (showModal / hideModal)
- L4186 - Toasts & line color picker
- L4240 - Airboard cloud sync
- L4273 - Supabase RPC & presence heartbeat
- L4313 - User activity / event telemetry
- L4356 - Supabase auth & dev auth
- L4485 - [sync] Checkout subscription & permission refresh
- L4495 - Modals & Handlers
- L4563 - PDF intake (upload, test PDF, hashing)
- L4571 - Toolbar tool buttons
- L4697 - Tool sidebar buttons & legend overlay
- L4814 - Add Line Type modal
- L4884 - Line color & sidebar handlers
- L5026 - Polyline modal & drawing
- L5057 - Zoom bar & page navigation
- L5083 - Export canvas JSON
- L5099 - PDF download helpers
- L5108 - View-link URL helpers & show-highlights/notes
- L5180 - Custom icon upload handler
- L5190 - Export & report dropdown menus
- L5280 - Sidebar drawer toggles
- L5291 - Mobile actions burger menu pointer & header logo
- L5303 - User Activity pointer (format.js + features/user-activity.js)
- L5315 - My Settings pointer (features/my-settings.js)
- L5338 - Auth & settings entry buttons
  - L5383 - Project Settings checkout & Save Status bell
  - L5484 - [sync] Checkout expired recovery
  - L5540 - [sync] Turn In
  - L5819 - Share modal pointer & copy-project openers
  - L5850 - Settings menu actions
  - L5871 - Auth sign-in form
  - L5895 - Save Project modal
  - L5908 - Checkout expired recovery modal wiring
  - L6013 - Last-session restore prompt
  - L6020 - Canvas Repair modal wiring
- L6172 - Canvas Event Handlers
- L6560 - Event Binding
- L6570 - Aim loupe (mobile press-hold precise placement)
- L6709 - Zoom transform preview & commit
- L6745 - Canvas mouse, wheel & touch handlers
- L7382 - Global dropdown dismissal & keyboard hotkeys
- L7617 - [sync] Manual save to cloud
- L7627 - [sync] Auto-save
- L7634 - [sync] Local backup (IndexedDB takeoff state)
- L7767 - [sync] Checkout keep-alive
- L7781 - App feature registry
- L7971 - View-only mode
- L7977 - Init / boot

<!-- END SECTION TOC -->

### Save/sync engine map

The save/sync engine (autosave, cloud save, checkout, dirty-tracking, recovery)
is intentionally scattered across `app.js` rather than contiguous -- foundation
pieces sit early because later code depends on them, the checkout/Turn-In UX sits
next to the settings modal it drives, and the autosave loop sits near boot. Its
12 sections are tagged `[sync]` so the whole subsystem is greppable at once:
`rg "SECTION: \[sync\]" app.js`. **The staged extraction into
[save-engine.js](save-engine.js) (`createSaveEngine(ctx)`, loaded before
app.js) is COMPLETE: Stage 1 moved the Global force reload + Checkout
keep-alive implementations behind the seam, Stage 2 the Save Status log
core + the dirty core, Stage 3 the storage ring (checkout probe, hashing,
takeoff-backup wrappers, local backup writer), Stage 4 the
client-resilience layer (recovery/client probes, client recycle,
raw-fetch fallbacks), Stage 5 the checkout-UX domain (realtime checkout
subscription + `refreshProjectPermissions`, the expired-recovery core,
the Turn In core), and Stage 6 the save paths themselves —
`performAutoSave`, `performSaveProjectToCloud` with the PDF upload
ladder (resumable/TUS + verify-after-timeout), the one-shot local-PDF
uploader, the failure/backoff/latency bookkeeping
(`noteAutoSaveOutcome`), and the export-envelope builders. The engine
now OWNS all save/sync state: the log, dirty flag + generation, the
save-in-progress flags, the in-flight autosave promise/controller, the
failure ladder + backoff, the backup ring, the probe/recycle guards +
wedge stamp, the checkout channel + reconnect state, the auto-recheckout
rate limits, and the Turn In guard. app.js keeps the boot wiring (the 5s
autosave interval, the visibilitychange/online handlers), the UI
renderers reading engine getters, the modals, and same-named thin
wrappers under the `[sync]` markers — so the grep still finds the whole
subsystem.** In logical (not file) order:

- Foundation: `[sync] Save Status log & envelope` (the rolling event log),
  `[sync] Dirty tracking & local session reset` (dirty generation),
  `[sync] Checkout probe, hashing & PDF cache` (lock probe + hashing).
- Resilience: `[sync] Sync recovery & client recycle` (wedged-client recovery +
  raw-fetch fallbacks), `[sync] Global force reload` (cross-tab reload).
- Checkout: `[sync] Checkout subscription & permission refresh` (realtime),
  `[sync] Checkout expired recovery` (expiry UX + silent re-checkout),
  `[sync] Turn In` (handoff), `[sync] Checkout keep-alive` (inactivity timer).
- Save paths: `[sync] Manual save to cloud` (`performSaveProjectToCloud`) and
  `[sync] Auto-save` (the 5s dirty loop, `performAutoSave`).
- Local fallback: `[sync] Local backup (IndexedDB takeoff state)`.
- PDF upload (in `[sync] Manual save to cloud`): `uploadPdfToStorage` is the single
  entry point — it routes large PDFs (`> PDF_RESUMABLE_THRESHOLD_BYTES`) through
  the resumable/TUS `uploadPdfResumable` (chunked, progress via the module-level
  `onPdfUploadProgress` sink, cross-reload resume via the `pdf_upload_resume` IDB
  store, cancellable via tus) and smaller PDFs through a single standard upload
  with a size-aware timeout (`pdfUploadTimeoutMs` in save-utils.js; storage-js
  `upload()` takes no `AbortSignal`, so the timeout only bounds the wait); either
  way a transient failure runs the `confirmPdfUploaded` (storage `.info()`) verify
  net before surfacing, which reconciles a request that completed server-side
  after the client stopped waiting. `uploadLocalPdfToCloudIfNeeded` keeps uploading
  large first-PDFs from the background autosave tick but cannot tight-loop (the
  `pdfOneShotUploadInFlight` guard + resumable resume + size-aware timeout + a
  5-min `PDF_ONESHOT_LARGE_BACKOFF_MS` failure backoff). See CHANGELOG "Sync
  hardening" PR 13 (Phase C) + PR 14 (Phase D).

History/rationale for this subsystem lives in [CHANGELOG.md](CHANGELOG.md)
("Sync hardening").

Annotated, in rough order:

- Constants — `uid`, the `SUPABASE_*`/`supabase` setup, `getLineModifiers`/`getPlumbingModifiers` and friends, and the icon-derived consts (`CUSTOM_ICON_VIEWBOXES`, `CUSTOM_ICON_META`, etc.) stay here. The pure literals `TOOL`, `SCALE_MODES`, `COLORS`, `SCALE_PRESETS`, `PLUMBING_DEFAULTS`, `LINE_DEFAULTS` plus the autosave/checkout timing & threshold block, IndexedDB store names + caps, and assorted keys/URLs/TZ now live in [constants.js](constants.js); the icon path constants, `VB_384_512_PATHS`, `CUSTOM_ICONS`, and `ICONS` live in [icons.js](icons.js)
- State — the `state` object, `makeAnnotations()`, module-level sync/checkout vars and tuning constants, `withTimeout`, `serverNowMs`/`updateServerClockFromRpc`
- [sync] Sync recovery & client recycle — `runRecoveryProbe`, `runRecoveryProbeAndMaybeRecycle`, `recreateSupabaseClient`, `rawProjectsUpdate`/`rawProjectsInsert`/`rawCheckInProject`
- [sync] Global force reload — `checkGlobalForceReload`, `doGlobalReloadNow`
- [sync] Save Status log & envelope — `pushSaveEvent`, `buildSaveLogsEnvelope(WithSnapshots)`, `autosaveEventDetail`, `captureNetworkInfoDetail`
- [sync] Dirty tracking & local session reset — `markProjectDirty`, `dirtyGeneration`, `resetLocalSessionState`, `resetAutosaveDegradedState`
- [sync] Checkout probe, hashing & PDF cache — `probeCheckoutLock`, `sha256Hex`, `pdfCachePut`/`pdfCacheGet`, takeoff backup IDB helpers
- Math & Format Helpers — the state-coupled helpers: `getPageScale`, `pickScaleForLineType`, `quickLineLength`, `getLineLengthPdfPts`, `getEffectiveScaleForLine`, `getLineRealWorldLength`, `getLineLengthForTotals`, `formatDist`, `formatArea`, `rotateAnnotations` (the pure primitives `ptDist`, `polylineDistance`, `polygonArea`, `distToSegment`, bezier helpers, `pointInRect`, zone locators, `parseFraction`, etc. live in [geometry.js](geometry.js)). The wrappers `formatDistFeetInchesFromReal` / `formatDistFeetInches` keep their `getPageScale` lookup + px fallback then delegate to `formatFeetInchesFromVal`, and `formatSaveTime` / `formatSaveTimeParts` / the `updateStatus` inline delegate to `formatAgo` (both pure helpers live in [geometry.js](geometry.js))
- Save Status modal — `renderSaveStatusModalContent`, `openSaveStatusModal`
- Coordinate Helpers — `getClientCoords`, `canvasRect`, `toCanvas`, `pdfPos`, `canvasToPdf`, `hitTest`, `isPointInPageBounds`
- PDF render bitmap cache — the LRU of rendered-page ImageBitmaps that makes page revisits a synchronous blit: `pdfBitmapCacheKey`-tuple helpers, put/get/clear, the idle neighbor prefetch, `App.clearPdfBitmapCache` + the `App.__pdfBitmapCache*` debug seams (see [page-switch-cache.spec.js](page-switch-cache.spec.js) and CHANGELOG "perf: large-plan responsiveness")
- PDF Rendering — `renderPdf` (bitmap-cache fast path + render-task cancellation + stale-blit preview), `renderAnnotations`, `renderAnnotationsToContext`, `drawDropMarker`, `drawGrid`, `drawLegend`
- UI Render Functions — `updateUI`, `renderCanvasSwitcher`, `renderPagesList`, `renderCountersList`, `renderLineTypesList`, `renderGroupsList`, `renderLinesList`, `renderSummary`, `openSummaryCountDetailModal`, `computeFooterTotals`/`getFooterTotalsCached`
- Inline rename & polyline edit mode — `onDoubleTapOrDblClick`, `startRename`, `enterEditMode`, `exitEditMode`
- Modal primitives (showModal / hideModal) — the app-wide `showModal`/`hideModal` (the Counter/Line Type details modal, Line Properties modal, and `deleteGroup` moved to [features/item-details.js](features/item-details.js); `hideModal` resets the moved details item via `App.onCounterLineTypeDetailsHidden`)
- Toasts & line color picker — `showToast`, `setTurnInProgress`, `showSetScaleFirstToast`, `showOutOfBoundsToast`, `showLineColorModal`, `applyLineColor`
- Airboard cloud sync — `fetchUserAirboard`, `saveUserAirboard`
- Supabase RPC & presence heartbeat — `rpcSupabase`, `touchPresence`, `startPresenceHeartbeat`/`stopPresenceHeartbeat`
- User activity / event telemetry — `logUserEvent`, `maybeLogProjectSaveEvent`, `maybeLogSessionStartOnce`, `logProjectOpenEvent`
- Supabase auth & dev auth — `initSupabaseAuth`, `isAuthError`, `canUseDevAuth`, `devAuthSignIn`
- [sync] Checkout subscription & permission refresh — `subscribeToProjectCheckoutChanges`, `refreshProjectPermissions`, `scheduleProjectsCheckoutReconnect`
- Modals & Handlers — the big modal/feature region; finer sub-markers below
  - Prepare PDF modal (`openPreparePdfModal`, `commitPreparePdfToState`, preview/nav, `#preparePdf*` bindings) → moved to [features/prepare-pdf.js](features/prepare-pdf.js); the PDF intake pipeline (upload/test-PDF/hashing) + shared PDF helpers (`assertPdfWithinLimit`, `mergePdfBuffers`, `buildTrimmedPdfBuffer`) stay in app.js
  - Scale modal — `openScaleModal`, `applyScaleObjectToZoneOrPage`, `resetScaleModalZoneMode`
  - Counter modal — `showCounterTab`, `populateCounterChooseList`
  - Quick Plumbing / Quick Count modals (`populatePlumModal`, `populateCounterQuickCountPanel`, icon-tab helpers, `#plumBtn` opener) → moved to [features/quick-modals.js](features/quick-modals.js)
  - Quick Line modal — `populateQuickLineModal`, line modifiers (features/quick-line.js)
  - Groups — `openGroupAssignModal`, group color helpers
  - Multiply Zone settings — `openMultiplyZoneSettingsModal`
  - Zoom modal — `showZoomModal`
  - Export canvas JSON — the `#exportBtn`/`#exportBtnSidebar` canvas JSON export (the layer-management modals + layers menu moved to [features/canvas-layers.js](features/canvas-layers.js), reached via `App.openCanvasDetailsModal`)
  - Export PDFs modal — `openSpecificPagesModal`, `downloadSpecificPages`
  - View-link URL helpers & show-highlights/notes — the shared `buildViewLinkUrl`/`getOrCreateViewLinkUrl` (used by the header Share button and, via `App.getOrCreateViewLinkUrl`, the moved Copy to PipeTooling export) + the `#bundleHighlights`/`#bundleNotes` open-in-tab handlers (the copy flows themselves moved to [features/output.js](features/output.js))
  - PDF bundling helpers (`addReportPagesToPdf`, `addNotesToPdf`, `addHighlightsToPdf`, `hasAnyHighlights`, `hasAnyNotes`) → moved to [features/pdf-bundle.js](features/pdf-bundle.js); the interleaved `importCanvasAfterPdf`/`clearPage` modals stay (renamed marker)
  - Export & report dropdown menus — the header `#exportDropdown` (canvas/PDF/both/import), Show Report menu, Macros + custom-icon-tips bindings (`downloadCurrentPageAsPdf` + its mode menu moved to [features/output.js](features/output.js); `downloadProjectPdf` stays under PDF download helpers)
  - Note modal — `openNoteModal`
  - User Activity pointer — the pure formatters live in [format.js](format.js); the admin modal + loaders + filter live in [features/user-activity.js](features/user-activity.js) (reached via `App.openUserActivityModal`)
  - User Settings & Manage Users — `openMySettings`, `openManageUserModal`, `openAllUsersModal`, `deleteUser`, `openSetPasswordModal`, `openTransferModal`, `openUserProjectsModal`, `openUserActivityOverview`
  - Canvas Repair — `openCanvasRepairModal`, `applyCanvasRepair`
  - Manage Icons modal — `openManageIconsModal`
  - Manage Projects modal — `openManageProjectsModal`, `forceCheckInProjectFromManage`, `deleteProject`
  - Project Settings checkout & Save Status bell — `updateSettingsCheckoutSection`, view-link copy
  - [sync] Checkout expired recovery — `applyCheckoutExpiredRecoveryMode`, `openCheckoutExpiredRecoveryModal`, `reCheckOutAfterExpiry`, `tryAutoRecheckoutIfAllowed`
  - [sync] Turn In — `doTurnIn`, `doTurnInAndHandleResult`, `tryTurnIn`, `handleEditStatusBannerClick`
  - Share modal pointer & copy-project openers — `openShareProjectModal` moved to [features/share-links.js](features/share-links.js) (reached via `App.*`); `openCopyProjectModal`/`openCopyProjectModalOrPromptSave` stay
  - Cloud project hydrate / copy / fork — `hydrateProjectFromCloudRow`, `openCopyProjectModal`, `forkCloudProjectToLocalWorkingCopy`
  - Load Project modal (`openLoadProjectModal` + list/filters/access-panels/project-load) → moved to [features/load-project.js](features/load-project.js); the save-before-load gate + `#loadProject*` bindings stay in app.js
  - Settings menu actions & Airboard sync — `#settingsLoadProject`/`#settingsCloseProject`, `#mySettings*Airboard`
  - My Settings password & Auth sign-in — `#mySettingsPasswordForm`, `#authForm`
  - Save Project modal — `#saveProjectBtn`, includePdf toggles, `#saveProjectDo`
  - Copy project modal — `#copyProjectModalConfirm`
  - Checkout expired recovery modal wiring — `wireCheckoutExpiredRecoveryModal`, `#saveStatusExpired*`
  - Save-before-load modal — `#saveBeforeLoad*`
  - Last-session restore prompt — `#lastSessionRestoreKeep`/`Discard`
  - Canvas Repair modal wiring — the `#canvasRepair*` close/apply bindings (the `#userActivity*` filter/view handlers moved to [features/user-activity.js](features/user-activity.js))
- Canvas Event Handlers — `showContextMenu`, `handleCanvasClick`, `handleCanvasDblClick`, `handleContextMenu`
- Event Binding — the canvas-wrapper handle + the bitmap-prefetch cancellation guards
- Aim loupe (mobile press-hold precise placement) — the loupe core only: `isAimingTool`, `enterAiming`/`cancelAiming`, `drawAimLoupe`, `commitAimPoint`, `abortVertexDrag` (its call sites live in the mouse/touch handlers below)
- Zoom transform preview & commit — `lastRenderedZoom`, `updateContainerTransform`, `syncZoomIndicators`, `commitWheelZoom`/`commitPinchZoom`
- Canvas mouse, wheel & touch handlers — the mousedown/mousemove/mouseup stack (pan, legend drag/resize, note drag/resize, vertex drag, aim-loupe entry), the wheel-zoom rAF, the touch pinch/pan/tap/long-press stack, `handleTouchAsCanvasTap`
- Global dropdown dismissal & keyboard hotkeys — the document-level click-outside closer for every dropdown + the hotkey/Escape/arrow-key handler
- [sync] Manual save to cloud — `performSaveProjectToCloud`
- [sync] Auto-save — `performAutoSave`, `noteAutoSaveOutcome`, `recordAutosaveLatency`
- [sync] Local backup (IndexedDB takeoff state) — `writeTakeoffStateBackup`, `writeTakeoffBackupToIndexedDB`
- [sync] Checkout keep-alive — `checkoutKeepalive`
- View-only mode — `initViewOnlyMode`, `viewCacheGet`/`viewCachePut`
- Init / boot — `init()` IIFE, `initSupabaseAuth`, last-session restore

## Search Hints (grep patterns)

| To find | Pattern |
|---------|---------|
| Section markers | `// SECTION:` |
| Tool enum / modes | `const TOOL` or `SCALE_MODES` |
| State shape / annotations | `const state = {` or `function makeAnnotations` |
| PDF upload / size limit | `pdfInput` or `PDF_MAX_SIZE_BYTES` or `assertPdfWithinLimit` |
| PDF render logic | `function renderPdf` |
| Annotation drawing | `function renderAnnotations` or `renderAnnotationsToContext` |
| Out-of-bounds toast | `showOutOfBoundsToast` or `isPointInPageBounds` |
| Scale crosshair | `SCALE_CROSSHAIR_PATH` |
| Per-page scale | `getPageScale` or `page.scale` |
| Scale modal / custom fraction | `openScaleModal` or `parseFraction` or `applyScaleObjectToZoneOrPage` |
| Counter creation / settings | `counterCreate` or `counterSettingsModal` or `showCounterTab` |
| Line type creation / settings | `lineTypeCreate` or `lineTypeSettingsModal` or `chooseLineTypeModal` |
| Choose/Create Line Type modal | `showChooseLineTypeModal` or `showLineTypeTab` or `populateChooseLineTypeList` (features/choose-create-line-type.js) |
| Line color modal | `showLineColorModal` or `applyLineColor` |
| Create color picker (custom + recent) | `setupCreateColorPicker` or `pushRecentColor` (app.js) or `nextRecentColors` (constants.js) |
| Group modals | `groupModal` or `groupAssignModal` or `openGroupAssignModal` |
| Quick Plumbing | `plumModal` or `populatePlumModal` |
| Polyline drawing | `drawingPolyline` or `finishPolyline` |
| Line selection | `selectedLineId` or `selectedLinePageIdx` |
| Canvas click handling | `handleCanvasClick` |
| Measure tool / distance toast | `TOOL.MEASURE` or `measureBtn`; same-zone uses `getEffectiveScaleForLine` |
| Zoom / pan | `state.zoom` or `updateContainerTransform` or `showZoomModal` |
| Zoom gesture perf (no per-frame updateUI) | `syncZoomIndicators` or `commitWheelZoom` |
| Page-switch bitmap cache | `pdfBitmapCache` or `clearPdfBitmapCache` or `SECTION: PDF render bitmap cache` |
| hitTest | `function hitTest` |
| Context menu | `handleContextMenu` or `showContextMenu` or `ctxTargetNameRow` |
| Coordinate conversion | `canvasToPdf` or `toCanvas` |
| Rename | `startRename` |
| Pages list / collapse / badges | `renderPagesList` or `pagesListCollapsed` or `badge-scale-set` / `badge-has-ann` |
| Download current page | `downloadCurrentPageAsPdf` (features/output.js) |
| Export dropdown (cloud up/down) | `exportDropdown` or `projectHasAnyCanvasMarkup` |
| Export Canvas (Advanced + JSON) | `exportBtn` or `advancedExport` |
| Mobile sidebar / header tools | `sidebar-tool-buttons` or `sidebar-triggers` or `has-pdf` |
| Header active type | `headerActiveLineType` or `COUNTER_BTN_DEFAULT_SVG` |
| Toggle switches | `toggle-switch` or `toggle-switch-knob` |
| Bundled icons | `CUSTOM_ICONS` or `getEffectiveCustomIcons`; built via `npm run build:icons` (see [CUSTOM_ICONS.md](CUSTOM_ICONS.md)) |
| Custom icon upload | `customIconUploadInput` or `parseUploadedSvg` or `getUserCustomIcons` |
| Page rotation | `rotatePage90` or `page.rotation` |
| Rotation/share orientation guard | `bakeFrame` or `computePageBakeFrame` or `verifyPageBakeFrame` or `bakeFramesMatch` (geometry.js) or `page.bakeMismatch` |
| Canvas-blank-at-zoom guard | `renderAreaSafety` or `canvasCornerReadsBack` or `effectiveDpr` or `getCanvasCaps` |
| Counter/Line Type details modal | `openCounterLineTypeDetailsModal` (features/item-details.js) |
| Line Properties modal | `openLinePropertiesModal` or `closeLinePropertiesModal` (features/item-details.js) |
| Supabase auth | `initSupabaseAuth` or `state.supabaseSession` |
| Dev auth bypass | `canUseDevAuth` or `devAuthSignIn` (`?devAuth=1`, localhost) |
| Save / Load project | `performSaveProjectToCloud` or `openLoadProjectModal` or `saveProjectModal` |
| Share project / view links | `openShareProjectModal`; `invite-to-project` / `get-view-project` Edge Functions |
| Checkout / turn in | `check_out_project` / `check_in_project` / `force_check_in_project`; `doTurnIn`; `state.isViewer` / `state.canCheckOut` |
| Realtime checkout | `subscribeToProjectCheckoutChanges` or `refreshProjectPermissions` |
| Save before load | `saveBeforeLoadModal` or `openLoadProjectModalOrPromptSave` |
| Last session restore | `lastSessionRestoreModal` or `doRestoreLastProject` |
| Load annotations (hash match) | `loadAnnotationsModal` or `loadAnnotationsList` |
| Canvas-only load flow | `pendingCanvasLoad` or `openCanvasOnlyNeedsPdfModal` |
| PDF hash | `sha256Hex` |
| PDF IndexedDB cache | `pdfCachePut` or `pdfCacheGet` |
| Status bar indicators | `updateStatus` or `statusBarDot` or `statusBarSquare` |
| Status bar / footer totals | `statusTotals` or `computeFooterTotals` or `getFooterTotalsCached` |
| Marked page nav | `getMarkedPageIndices` or `prevMarkedPage` / `nextMarkedPage` |
| View-only mode | `initViewOnlyMode` or `viewCacheGet` |
| Auto-save | `performAutoSave` or `markProjectDirty` or `autoSaveDirty` or `suspendAutoSaveUntilCheckout` |
| Save Status bell + modal | `saveStatusModal` or `pushSaveEvent` or `updateSaveStatusIndicator` or `buildSaveLogsEnvelope` |
| Sync recovery / client recycle | `runRecoveryProbe` or `recreateSupabaseClient` or `rawProjectsUpdate` |
| Checkout keep-alive / probe | `probeCheckoutLock` or `checkoutKeepalive` or `CHECKOUT_KEEPALIVE_MS` |
| Checkout expired recovery | `openCheckoutExpiredRecoveryModal` or `tryAutoRecheckoutIfAllowed` or `handleBackgroundCheckoutExpired` |
| Global force reload | `checkGlobalForceReload` or `doGlobalReloadNow` or `admin_trigger_global_reload` |
| Local backup | `writeTakeoffStateBackup` or `takeoffBackupPut` / `takeoffBackupGet` |
| Prepare PDF modal | `openPreparePdfModal` or `commitPreparePdfToState` |
| Admin panel / users | `adminPanelModal` or `openManageUserModal` or `deleteUser` or `openSetPasswordModal`/`admin-set-password` or `openTransferModal`/`admin-reassign-projects` or `openUserProjectsModal` |
| User Activity (admin/self) | `openUserActivityModal` (raw log) or `openUserActivityOverview`/`user_activity_detail_for_admin` (rich overview) or `list_user_activity_for_admin` or `USER_ACTIVITY_TZ` |
| Manage Projects | `openManageProjectsModal` or `deleteProject` or `forceCheckInProjectFromManage` |
| Manage Icons | `openManageIconsModal` |
| User Settings / Artboard | `openMySettings` or `mySettingsSaveAirboard` |
| Export PDFs modal | `openSpecificPagesModal` or `downloadSpecificPages` |
| Copy to PipeTooling | `doCopyPipeTooling` (features/output.js) or `getPipeToolingSummary` (report.js); view-link footer via `getOrCreateViewLinkUrl` (app.js) |
| Copy Summary (Email/Text) | `copySummaryTextDropdown` or `getEmailTextSummary` |
| Summary count detail modal | `openSummaryCountDetailModal` |
| Legend overlay | `showLegendOverlay` or `legendSettingsModal` or `drawLegend` |
| Grid overlay | `showGridOverlay` or `gridSettingsModal` or `drawGrid` or `snapToGrid` |
| Undo / Redo | `undoStack` or `redoStack` or `pushUndoSnapshot` |
| Middle mouse pan | `state.isPanning` or `state.panStart` |
| Show Highlights / Notes | `addHighlightsToPdf` or `addNotesToPdf` or `hasAnyNotes` |
| Note modal | `openNoteModal` |
| Line real-world length / scale zones | `getLineRealWorldLength` or `getLineLengthForTotals` or `getEffectiveScaleForLine` |
| Length tally in feet (always-feet) | `getLineLengthFeetForTotals` or `lineLengthFeetForTotals` (line-metrics.js) or `formatFeet` (geometry.js) |
| Multiply Zone | `TOOL.MULTIPLY_ZONE` or `getMultiplyZoneForPoint` / `getMultiplyZoneForLine` |
| Scale Zone | `TOOL.SCALE_ZONE` or `getScaleZoneForLine` or `scaleModalApplyTarget` |
| Delete Zone | `TOOL.DELETE_ZONE` or `collectItemsToDeleteInRect` or `performDeleteZone` |
| Snap to H/V | `lineTypeSnapToHVHeaderBtn` or `snapToHorizontalVertical` |

## Key Globals (used by report.js)

These must remain on `window`: `state`, `makeAnnotations`, `ptDist`,
`polylineDistance`, `formatDist`, `renderIconHtml`, `quickLineLength`,
`getLineLengthPdfPts`, `getLineLengthForTotals`, `getLineLengthFeetForTotals`,
`getLineRealWorldLength`,
`getMultiplyZoneForLine`, `getMultiplyZoneForPoint`, `getEffectiveScaleForLine`,
`getMergedAnnotationsForPage`. [report.js](report.js) exposes back
`buildReportHtml`, `printReport`, `getPipeToolingSummary`, `getPipeToolingHasData`
(cheap counts-or-lines existence check used by `updateUI`), `getEmailTextSummary`.
Both summary functions accept optional `{ pageIndices?: number[], getAnnotations?: (page) => annotations }`.

## Data Flow

```
Events -> handlers -> state updates -> renderPdf() / renderAnnotations() / updateUI() -> DOM
```

- Annotations stored in PDF-space (zoom-independent).
- Scale is per-page: `page.scale`; read via `getPageScale(pageIdx)`.
- `canvasToPdf(x,y)` converts wrapper coords to PDF; `toCanvas(p)` converts PDF to
  canvas pixels (includes devicePixelRatio).
- See [RECONSTITUTE.md](RECONSTITUTE.md) for the full data model and invariants.

## Layout

- **Desktop header**: Logo + tools (Measure, Highlight, Note, Move, divider,
  Counter, Line, Polyline, divider, Snap to H/V when Line/Polyline selected) on
  the left; spacer; cloud import/export control (`#exportDropdown`, 28x28 icons):
  cloud-upload when editor has no pages (click triggers `#pdfInput`),
  cloud-download menu when pages exist (Canvas/Both gated by
  `projectHasAnyCanvasMarkup()`, Export PDF when PDF present, Import Canvas when
  editor + PDF + no markup); Copy view link, Save Status bell, settings gear top
  right (when Supabase enabled); Download current page (yellow printer, far right)
  when PDF loaded. Primary buttons (Sign In, Save, Load) live in the status bar.
- **Mobile header** (max-width 768px): Hamburger, Upload PDF (no PDF) or Set Scale
  (PDF, no scale), Measure, Highlight, Note, Move, Counter (+ active icon), Line
  (+ color swatch); Polyline/Done Editing hidden; `body.has-pdf` toggled in
  `updateUI`; settings gear hidden (access via sidebar logo).
- **Sidebar** (slide-in): ClickCount logo + User/Settings icons (mobile), Upload
  PDF / Set Scale, cloud project actions (Supabase), Export/Import Canvas, tools,
  Pages, Counters, Line Types, Lines, Summary, Show Report, Export PDFs, Copy to
  PipeTooling, Copy Summary, Show Highlights / Notes (when data), Clear Page.
- **Bottom bar** (page/zoom row): Page nav, zoom controls, rotate, Undo, Redo.
- **Status bar**: Dual indicators (circle = canvas sync, square = PDF sync),
  project/sync status, footer totals `#statusTotals`, Sign In (Supabase), Macros,
  Clear Page.
- **Touch**: single-finger pan, pinch-to-zoom, long-press (500ms) context menu;
  `touch-action: none` on canvas; `handleTouchAsCanvasTap` for LINE/HIGHLIGHT/NOTE;
  `preventDefault` on touchend; 25px movement threshold for LINE/POLYLINE taps.
- **Scale taps**: 400ms debounce to avoid double-tap on mobile.

## Features Beyond Spec

Everything below is built on top of the [RECONSTITUTE.md](RECONSTITUTE.md) core.

### Tools & drawing

- **Move button** — toggles active when `state.tool === TOOL.NONE`.
- **Set Scale button** — dynamic label: "Set Scale" -> "Scale 1 ft = X" when set;
  clicking when set restarts. Hidden in header once scale is set.
- **Set Scale modal** — tabs: Select two points, Architectural & Engineering
  presets; Custom scale (fraction e.g. `1/4` or `0.25`, feet, Apply). In zone mode
  (`scaleModalApplyTarget === 'zone'`) Apply writes `scaleZones[].scale` instead of
  `page.scale`.
- **Verify-your-scale advisory + check mode** — because a preset/custom scale is an
  *assumption* (and the sheet-size correction a best guess), a persistent **blue**
  `#scaleVerifyAdvisory` banner sits atop `#scalePresetsPanel` (covers presets **and**
  the custom row, which share the panel), deliberately calmer than the yellow sheet
  warning. Its **Verify by measuring two points** button (`startScaleCheck`) sets the
  `state.scaleCheckMode` flag and reuses the exact two-point pick flow (all input paths
  funnel through the one `handleCanvasClick` `TOOL.SCALE` branch). After the two points,
  `openScaleModal` routes to `#scaleCheckPanel`: the user enters the line's *known* real
  length and **Check** (`App.scaleCheckDelta`, pure in [geometry.js](geometry.js))
  reports Expected vs "current scale reads" + the **% error** (green < 1%, yellow
  otherwise), offering **Keep current scale** or **Use measured** (the latter recalibrates
  via the shared `applyTwoPointScale`, stamping a `refLine`). Applying any preset/custom
  scale also fires a brief **post-apply toast** nudging verification. `resetScaleCheckMode`
  (published on `App`) unwinds the flag from every modal exit + the two Escape-key
  `TOOL.SCALE` branches. Verify is a no-op with a "set a scale first" toast when the page
  has no scale.
- **Sheet-size correction (compressed-PDF fix)** — the architectural presets and
  the custom dialog assume `72 pt = 1 real inch of paper` (the PDF page point space
  equals the true physical sheet). A "compressed" / re-boxed / rescaled PDF breaks
  that, so a preset like `1/4" = 1'` reports lengths off by the rescale ratio. On the
  **presets tab in page-scale mode**, `features/scale.js` calls
  `App.getPageSheetAnalysis(currentPage)` (thin app.js wrapper over the pure
  `analyzeSheet` in [geometry.js](geometry.js), comparing the unrotated viewport dims
  against `STANDARD_SHEETS` — ANSI A–E, ARCH A–E + E1, ISO A0–A4). If the page is a
  recognized sheet size → **nothing changes** (`correctionFactor` 1, no banner). If
  **not** → a yellow `#scaleSheetWarning` banner + `#scaleSheetSelect` picker appears,
  defaulted to the best-guess sheet (closest aspect ratio; ties break to the **larger**
  sheet). Applying a preset/custom then multiplies `pixelsPerUnit` by
  `sheetCorrectionFactor = actualLongEdge / chosenSheetLongEdge` and stamps
  `scale.sheetSize` + `scale.correctionFactor` (+ a ` · ARCH D`-style label suffix).
  **Page scale only** — never scale zones (they inherit page scale) and never the
  two-point "Select on PDF" path (already ground truth, no `72`). Limitation: when a
  compression lands *exactly* on another standard size (e.g. half-size ARCH D == ARCH
  B) detection can't tell — the synthetic scale bar (below) is the backstop.
- **Scale crosshair** — plus icon at scale point A/B.
- **Synthetic verification scale bar** — for preset/custom scales (which have no
  two-point `refLine`), `renderAnnotations` draws a dashed-yellow bar of a round real
  length (1/2/5/10/… picked to span ~20% of page width) near the page's bottom-left,
  with crosshair ends + a length label — the same look/toggle as the two-point refLine
  (`state.showScaleRefLine`, the "Show the scale line on the plan" checkbox). Lets the
  user eyeball a preset scale against a known dimension; the safety net for the
  sheet-size correction's best-guess.
- **Set Scale first toasts** — for Quick Line / Polyline / Measure when no scale.
- **Choose Line Type modal** — tabs Choose | Create | Quick; search; `L` opens
  modal, `Shift+L` opens Quick tab. The Create tab's color picker is the shared
  `setupCreateColorPicker` (18 presets + custom `<input type="color">` + Recent).
- **Counter modal** — tabs Choose Counter / Create Counter; 18-color palette (no
  white); selected icon outlined. The Create tab's color picker is the shared
  `setupCreateColorPicker` (18 presets + custom picker + Recent row).
- **Create color picker** — `setupCreateColorPicker` renders the 18 presets, a
  custom `<input type="color">`, and a Recent row (shared `state.recentLineColors`)
  in all three create surfaces: Create Counter, the "+ Add" Add Line Type modal
  (`#lineTypeModal`), and the Quick-Line Create tab (`#createLineTypePanel`).
  Recents are custom-only (presets skipped), persisted in
  localStorage, and committed on Create via `pushRecentColor` /
  `nextRecentColors`. The edit picker (`showLineColorModal`) shares the same
  Recent list.
- **Line button / Quick Line restart** — tapping Line again clears the start point.
- **Quick line preview** — line renders from first click to cursor while placing.
- **Quick Line Escape** — first Escape removes first point; second exits to Move.
- **Line selection highlight** — selected line drawn thicker with glow;
  `selectedLineId` / `selectedLinePageIdx`.
- **Line drops** — per-line `startDrop` / `endDrop` (page-scale units) for vertical
  runs; X markers at endpoints when drop > 0; included in totals via
  `getLineLengthPdfPts`; Line Properties modal (`#linePropertiesLineType` shows the
  source line type) edits Name, Color, drops, +1/+10/-10/-1/Clear, polyline vertex
  edit.
- **Line types curveStyle** — `'straight'` (default) or `'arc'`; arc quick lines
  render as quadratic Beziers and use arc length for totals; persisted in
  save/load and export/import.
- **Measure tool** (`D`) — two-click distance; toast uses the enclosing Scale
  Zone's scale when both clicks fall in one zone, else page scale; available in
  view mode.
- **Viewer scale — status, set-for-everyone, temp fallback, owner notice** —
  view-link viewers see the page's scale status on the (no longer viewer-hidden)
  Set Scale buttons and the desktop `#sidebarScaleDisplay`, and may run the full
  Set Scale flow (`S`, two-point, presets, custom). A viewer-applied scale is
  **shared for everyone**: `shareViewerScale(pageIdx)` (called from the three
  apply sites in [features/scale.js](features/scale.js) via `App.*`) POSTs to the
  `set-view-scale` Edge Function (same token + email-domain gate as
  `get-view-project`), which sanitizes the payload and writes it into the owner's
  `projects.data.pages[i].scale` with a `viewerSet {email, at}` stamp. On success
  the local copy drops its temp marking; on failure (offline / rejected) it stays
  a **temporary local scale** — `noteViewerTempScale` stamps `scale.temp = true`
  (labels render "… · temp"), remembers it per link in localStorage
  `view:scale:<token>`, and `applyViewerTempScales()` restores it in
  `initViewOnlyMode` only for pages the server has no scale for. **Owner notice**:
  `maybeShowViewerScaleNotice()` (called from `updateUI`) pops the must-clear
  `#viewerScaleNoticeModal` for the project owner (checked-out, i.e.
  `!state.isViewer`) every time they land on a page whose scale carries
  `viewerSet`, until "Got it" deletes the stamp + `markProjectDirty()` persists
  the acknowledgment. The viewer tool whitelists (updateUI reset,
  `handleCanvasClick`, aim loupe) allow `TOOL.SCALE` alongside `TOOL.MEASURE`;
  scale zones stay owner-only. `writeTakeoffStateBackup` is viewer-gated (viewer
  sessions have nothing recoverable). Regression:
  [viewer-scale.spec.js](viewer-scale.spec.js).
- **Multiply Zone tool** (`X`) — two-click rectangle; multiplies counts and line
  lengths for items whose endpoints fall inside; `ann.multiplyZones`; first
  containing zone wins; settings via right-click on the toolbar icon; hidden for
  viewers.
- **Scale Zone tool** — two-click rectangle with a per-zone `scale`; lines fully
  inside use `getEffectiveScaleForLine`; requires page scale; no overlap; context
  menu Edit scale / Delete; toolbar icon is the Set Scale glyph rotated 180.
- **Delete Zone tool** — two-click rectangle; confirmation modal with counts;
  deletes counters/lines/polylines/highlights/notes/zones whose anchor falls in the
  rect; hidden for viewers.
- **Highlight annotation** (`H`) — two-click low-opacity rectangle;
  `page.annotations.highlights`.
- **Note annotation** (`N`) — click to place, modal for text; red text; resizable
  width and font size; moveable; double-click or context Edit to edit.
- **Page rotation** (`R`) — per-page `page.rotation` (0/90/180/270); annotations
  and notes transform; persisted.
- **Snap to H/V** (`J`) — header toggle (right of Polyline when Line/Polyline
  selected) and Line Type Settings; `snapToHorizontalVertical`.

### Counters / line types / sidebar

- **Counter Settings** — click "Counters" heading: icon size, opacity, number
  size, outline, show ring (size, opacity, solid toggle); "Show only counters on
  current page" filter. Ring section only visible when rings on.
- **Line Type Settings** — click "Line Types" heading: opacity, line size, drop X
  size + icon style, orient length with line direction, parallel ends, length
  label size, snap to H/V, "show only line types/lines on current page".
- **Counter button dynamic icon** — `counterBtn` / `counterBtnSidebar` show the
  active counter's icon + color when Counter tool is active.
- **Counter/Line Type details modal** — edit pen opens
  `counterLineTypeDetailsModal` (Name, Color, On pages jump, Delete; count>0
  confirms).
- **Counter/Line Type row** — row click selects for placing.
- **Custom icon upload** — Create Counter / Counter Details have a "+ Upload" cell;
  SVG parsed for path/rect/circle/ellipse/line; stored per-user in IndexedDB
  (`customIconPaths`), in-memory cache; included in export/import; "Custom Icons"
  label opens the tips modal; Manage Icons has an Edit/Delete-selected section.
- **Bundled custom icons** — SVGs in `my-counters/` -> `npm run build:icons` ->
  paste into `CUSTOM_ICONS` in [icons.js](icons.js) (see [CUSTOM_ICONS.md](CUSTOM_ICONS.md)).
- **Groups** — assign counters/lines to a group; `groupAssignModal` + `groupModal`
  (Add/Edit); Show group colors toggle.
- **Quick Plumbing / Quick Count / Quick Line** — modifier-driven quick creation
  (Size / Type / Material; `plumbingModifiers`, `lineModifiers`); type-to-icon
  mapping via `iconByType`.
- **Sidebar collapse** — click collapse icon or adjacent space to minimize a
  section; Groups and Lines start minimized.
- **Pages title truncation** — long titles split start/end across two lines;
  toggled by clicking the "Pages" heading; `pagesTitlesTruncated`.
- **Pages badges** — `badge-scale-set` (yellow number when scale set),
  `badge-has-ann` (yellow outline when the page has any annotation).
- **Marked page navigation** — guillemet buttons jump to previous/next page with
  annotations.

### Output

- **Length tallies are always decimal feet.** Every takeoff tally / summary / export
  (Line Types sidebar, Lines list, Summary panel + count-detail, footer totals, zone
  preview modals, Copy to PipeTooling, Copy Summary email/text, printable Report, embedded
  PDF legend) converts each line to feet **before summing** (via `getLineLengthFeetForTotals`
  → `lineLengthFeetForTotals` + `convertUnitValue`, also fixing mixed-unit summation) and
  formats decimal feet with `formatFeet` ("12.50 ft"), regardless of the page's scale unit.
  Only the **on-canvas per-line length labels** and the **Measure-tool** readout keep
  feet-inches notation (the construction-drawing convention).
- **Show Report** — `#showReportDropdown` (this canvas / all canvases on page / all
  plan pages current canvas / all pages and canvases); opens report in a new tab
  via `printReport(mode)`; hidden when no counts/lines.
- **Export PDFs** — `#specificPagesModal`: marker/line size sliders (25-150%),
  Include takeoff report / Bundle highlights / Bundle notes toggles, per-page
  marked/unmarked/exclude thumbnails, bulk actions; `downloadSpecificPages()`.
- **Copy to PipeTooling** — `#forPipeToolingDropdown` (drop-up): This Canvas Only /
  All Visible Canvases / All Canvases; tab-delimited via `getPipeToolingSummary`.
  `doCopyPipeTooling` then appends a project **view link** as a trailing
  `View link:\t<url>` footer so importing tools can link the bid back to the source
  takeoff (detect by scanning the paste for a counttooling `?t=<token>` URL). The
  link comes from the shared `getOrCreateViewLinkUrl()` and is **prefetched on
  dropdown open** (`prefetchExportViewLink`, cached per project) so the clipboard
  write stays inside the user gesture. When no link is possible (not saved to
  cloud / signed out / opened via a view link) the counts still copy and a toast
  explains why.
- **Copy Summary (Email/Text)** — `#copySummaryTextDropdown`, same canvas options,
  via `getEmailTextSummary`.
- **Show Highlights / Show Notes** — open summaries in a new tab; toggles in the
  Export PDFs modal bundle them into the PDF.
- **Hide marks** — `#hideMarksBtn` (header eye toggle, shown to everyone once a PDF
  is loaded): `toggleHideMarks` flips `state.hideMarks`; `renderAnnotations` sizes +
  clears the overlay then early-returns, so the bare PDF shows through (counters,
  lines, highlights, notes, legend all hide at once — purely visual; the underlying
  data is untouched, and exports/reports use `renderAnnotationsToContext` so they're
  unaffected). The icon swaps eye ⇄ eye-slash via `updateHideMarksButton` (called
  from `updateUI`). Persists across pages/zoom (every render checks the flag) and,
  in view-link sessions, across reloads (`localStorage` `view:hideMarks:<token>`,
  restored in `initViewOnlyMode`).
- **Download current page** — `#downloadCurrentPageBtn` (yellow printer): direct
  download for single page+canvas, otherwise a mode dropdown (this canvas / all
  canvases on page / all pages current canvas / all pages and canvases);
  `downloadCurrentPageAsPdf(mode)`.
- **Download PDF** — Project Settings downloads the project PDF as-is; Prepare PDF
  modal "Download Trimmed PDF" downloads kept pages.
- **Export / Import Canvas** — JSON canvas export/import (Advanced + header export
  dropdown + sidebar); export gated by `projectHasAnyCanvasMarkup()`.
- **Mobile actions menu** — on mobile (`@media (max-width:768px)`) with a PDF loaded,
  the header's Hide-marks / Share / Download-current-page / Export controls (tagged
  `consolidated-mobile`) are CSS-hidden and folded into a right slide-in drawer
  (`#headerBurger` → `body.right-menu-open` → `#rightMenu`/`#rightMenuBackdrop`,
  mirroring the left `#hamburger`/`.sidebar` pattern). `updateBurgerMenu()` (called at
  the end of `updateUI`) rebuilds `#rightMenuList` from the **currently-visible**
  `.download-page-option`/`.export-dropdown-option` buttons, so rows stay in lockstep
  with desktop; each row **dispatches the original control's click** (Share →
  `#sidebarLogoShare` for editors / `#headerShareBtn` for view-link viewers; Marks →
  `#hideMarksBtn`), reusing every handler, and **clones that control's `<svg>` icon**
  (eye / printer / export glyph) so rows are visually labelled. Burger visibility is pure CSS gated on the
  existing `body.has-pdf` class.
- **Desktop header overflow → compact mode** — the same consolidation also triggers on
  **desktop** when the header row is wider than the viewport (e.g. a narrow window),
  so the right-side icons can't get cut off with no way to scroll to them.
  `updateHeaderCollapsed()` (rAF-throttled on `resize` + called from `updateUI`)
  measures the header in its **expanded** state (removes the class, reads
  `scrollWidth > clientWidth`, re-adds) so the decision is stable and never
  oscillates, and toggles `body.header-collapsed`. CSS gated on `body.header-collapsed`
  then makes the left tools horizontally scrollable and folds the right PDF actions
  into the **same `#headerBurger` drawer** (Settings / save-status stay visible as
  icons). Mobile (≤768px) keeps using the media query; the class is desktop-only.
- **Summary count detail modal** — click a count/line in the Summary for a per-page
  breakdown with thumbnails.
- **Footer totals** — `#statusTotals` shows `[N | L unit]` across all pages and
  canvases with multiply/scale zones applied; cached via `getFooterTotalsCached`.

### Overlays

- **Summary legend overlay** — `state.showLegendOverlay` (default true); draggable,
  resizable; `legendSettingsModal` for appearance; `ann.legend` `{x,y,w,h,userResized?}`.
- **Grid overlay** — `state.showGridOverlay` (default false); `gridSettingsModal`
  (spacing, unit, origin, snap, color, major interval, opacity, width, style);
  `drawGrid`; view-only (not exported); `resetGridOrigin()` on new document.
- **Room Sizer (room volumes)** — header cube button / `TOOL.ROOM` / hotkey V (scale
  required, like Scale Zone). Two-corner click draws a room box (rubber-band preview
  with live W×L readout); the Room Box modal assigns a ceiling height (ft-in parse,
  recent-height chips) and a Room (choose existing / create — palette object
  `state.rooms[]`, multiple boxes per room aggregate, e.g. an L-shaped room). Boxes
  render in their room's color with name + W×L×H labels (shared by exports via
  `drawRoomBoxesToContext`), are context-menu editable (`Edit room box`), participate
  in Delete Area, rotate with the page, and honor scale zones via
  `getEffectiveScaleForLine`. Totals are always feet (ft²/ft³ via the pure
  `roomBoxDimsFeet`, geometry.js): Rooms sidebar section (appears with the first
  box), legend rows (`legendSettings.showRooms`, default on), report "Room Volumes"
  table + email-summary block. Multiply zones deliberately do NOT multiply volumes.
  See [features/room-sizer.js](features/room-sizer.js).

### Canvas layers

- **Multiple canvases per page** — each `page.canvases[]` is an overlay layer;
  active layer per page in `state.activeCanvasIdByPage`; pills + layers dropdown;
  Up/Down arrows switch layers; viewers can browse layers locally (no dirty).
- **Show-all-canvases peek** — `#showAllCanvasesBtn` (eye-on-layers icon next to
  the canvas selector in the footer; desktop only, shown only when the page has
  2+ canvases) toggles the in-memory `state.showAllCanvases`: `renderAnnotations`
  then draws `getMergedAnnotationsForPage(page)` instead of the active canvas —
  the opposite of the hide-marks eye. Purely visual: hit testing / editing /
  exports still target the active canvas only, nothing is persisted or marked
  dirty, and the flag auto-clears when the page drops back to one layer.
  Regression: [show-all-canvases.spec.js](show-all-canvases.spec.js).

### Editing aids

- **Undo/Redo** — last 5 moves in memory; `undoStack`/`redoStack`; Ctrl+Z /
  Ctrl+Shift+Z; cleared on load/switch/viewer.
- **Middle mouse pan** — hold middle button to pan regardless of tool.
- **Zoom Rail** — clicking the footer zoom % toggles a giant floating vertical
  slider on the right edge ([features/zoom-rail.js](features/zoom-rail.js)):
  log-scale track with labelled tick marks, a draggable accent-yellow %-readout
  thumb (magnetic snap to round percents), +/− buttons, and a gear — the sole
  entry point to Zoom Settings (the rail floats above the modal backdrop).
  Replaced the old mobile zoom popover. Drags zoom about the viewport center
  with the wheel handler's transform preview + debounced re-render; the thumb
  tracks wheel/pinch/±/fit via `App.onZoomRailSync` from `updateUI`. Dismissal:
  re-click the zoom %, outside click, Escape, or a ~5s idle auto-fade (hover
  cancels; never mid-drag or with the settings modal open).
- **Canvas context menu** — `#contextMenu` on right-click / long-press;
  `handleContextMenu` -> `hitTest` -> `state.ctxTarget`; `#ctxTargetNameRow` shows
  the counter/line-type name below Delete; not available in view mode.
- **Hotkeys** — M/S/C/L/J/P/D/H/X/N/R; Shift+Q open Quick tab (Counter or Choose Line Type modal); arrows:
  Left/Right page nav (Shift = marked-page jump), Up/Down canvas layers; Ctrl+Z /
  Ctrl+Shift+Z; Ctrl+R refresh; ignored while focus is in an input/textarea.
- **Macros modal** — Keyboard Shortcuts reference, opened from Project Settings.

### Cloud (Supabase)

- **Supabase Phase 1 & 2** — admin-provisioned auth, projects + PDF storage; see
  [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Cloud features hidden when
  `SUPABASE_ENABLED` is false. PDF uploads limited to 50 MB.
- **Save / Load project** — `saveProjectModal` (contents list, Include PDF toggle,
  size in MB); `loadProjectModal` via `list_accessible_projects` (search +
  filters: Mine/Shared, role, admin owner dropdown; counts badge; Canvas-only
  badge); save-before-load prompt.
- **Auto-save** — every 5s when dirty (Supabase signed-in, else localStorage); 5s
  localStorage backup for all users; PDF IndexedDB cache; last-project restore
  prompts Keep/Discard. The save/sync system is heavily hardened against flaky
  networks and wedged clients — see [CHANGELOG.md](CHANGELOG.md) for the full
  detail. Key symbols: `performAutoSave`, `performSaveProjectToCloud`,
  `markProjectDirty`, `noteAutoSaveOutcome`, `runRecoveryProbe`,
  `recreateSupabaseClient`, raw-fetch fallbacks (`rawProjectsUpdate` /
  `rawProjectsInsert` / `rawCheckInProject`).
- **Save Status** — header bell + in-modal bell open `saveStatusModal`; gray
  normally, yellow on sync failure or checkout expiry, dim when offline;
  300s/3600s `saveStatusLog`; Verbose mode, Copy logs, Export logs
  (`buildSaveLogsEnvelope`, schema `clickcount-save-logs/v1`).
- **Sharing / checkout** — `project_shares`; one editor at a time via
  checkout/turn-in; 30-minute inactivity expiry with keep-alive; admin force
  turn-in; realtime notifications via `subscribeToProjectCheckoutChanges`.
- **Checkout expired recovery** — recovery modal + silent auto-recheckout
  (`tryAutoRecheckoutIfAllowed`, `handleBackgroundCheckoutExpired`); see CHANGELOG.
- **View links** — `project_view_links` + `view_link_access_log`; Share modal
  create/list/copy/access-log/revoke; `?t=TOKEN`; `get-view-project` Edge Function
  (returns `updatedAt`); email domain gate; `initViewOnlyMode`. The shared
  `getOrCreateViewLinkUrl()` /
  `buildViewLinkUrl()` (reuse-or-create) back both the header Share button
  (`copyOrCreateViewLinkToClipboard`, which now flushes a pending save first) and the
  **Copy to PipeTooling** export footer;
  revoking a link clears the export's prefetch cache. View-link viewers also get the
  **Hide marks** header toggle, remembered per token across reloads. `initViewOnlyMode`
  **revalidates against the server when online** (reusing the cached PDF blob by hash,
  falling back to the cached snapshot offline) so a viewer isn't pinned to a stale copy
  after the owner re-saves — backed by the new `updatedAt` (Edge Function + view-cache
  meta). Loaded pages run the `bakeFrame` orientation check (see RECONSTITUTE.md / the
  page save shape) so a misaligned share is surfaced, not rendered silently wrong.
- **Artboard** — User Settings save/load counters, line types, and modifiers to the
  user profile (`user_airboard`).
- **Admin** — Add/Manage/All Users, Manage Projects (delete + force turn-in), User
  Activity (Events + Summary, Chicago time), Global force reload
  (`admin_trigger_global_reload`, `system_settings`).
- **Dev auth bypass** — `?devAuth=1` (localhost) or "Sign in as test user";
  requires `DEV_AUTH_EMAIL` / `DEV_AUTH_PASSWORD` in `config.js`.

### PWA / offline

- **Installable + fully offline for a loaded takeoff.** [manifest.webmanifest](manifest.webmanifest)
  (standalone, theme `#17171a` / bg `#0f0f11`, 192/512/maskable icons) + the head meta
  (`apple-touch-icon`, `theme-color`, `apple/mobile-web-app-capable`, status-bar-style
  `black-translucent`) make it installable; [sw.js](sw.js) makes it work offline.
- **Self-hosted assets** — the six runtime libs (pdf.js + worker, pdf-lib, html2canvas,
  jsPDF, supabase-js, tus) and the Google Fonts are vendored under `vendor/` /
  `vendor/fonts/` (version-pinned filenames), so the whole app is same-origin (only
  Supabase is remote). pdf.js's `GlobalWorkerOptions.workerSrc` points at the local
  worker (app.js top) — required for offline render.
- **Service worker** ([sw.js](sw.js)) — precaches the full same-origin shell (HTML, CSS,
  config, the head modules, app.js, every `features/*.js`, report.js, the vendored libs
  **incl. the pdf.js worker**, fonts, icons, manifest) under a version-stamped cache.
  Two-tier fetch: navigations/HTML **network-first** (fresh shell online, cached offline);
  other same-origin assets **cache-first** for a coherent offline version. Non-GET and
  cross-origin (Supabase REST/auth/realtime/storage range-requests/TUS) **pass through
  untouched**. `skipWaiting` + `clients.claim`; `activate` purges old `counttooling-shell-*`
  caches. Registered at the top of `init()`. **Mixed-shell auto-heal**: after a deploy, a
  returning tab renders one mixed shell (network-first HTML + the previous version's
  cached assets) until the updated SW takes control — the registration block reloads the
  page once on that `controllerchange` (guarded: only when the page was already controlled
  at load, i.e. an update rather than a first-install claim, and only when
  `state.pages` is empty and nothing is dirty, so work is never lost). `#zoomRail` also
  carries a `hidden` attribute as a belt-and-braces guard so a stale stylesheet (no
  `.zoom-rail` rules) can't render its markup as bottom-left artifacts during that one
  mixed load.
- **CACHE_VERSION is generated (`npm run build:sw`)** — `CACHE_VERSION` in [sw.js](sw.js)
  is a content hash of every asset in `PRECACHE_URLS`, stamped by
  [scripts/build-sw.js](scripts/build-sw.js); never edit it by hand. Run `npm run build:sw`
  after changing any precached asset (`npm run check` includes `build:sw -- --check`, so a
  stale hash fails CI — this replaced the old manual bump, which kept being forgotten).
  `PRECACHE_URLS` itself is still hand-maintained: when adding/renaming a shell file, update
  the app/index.html tag **and** `PRECACHE_URLS`, then rerun `build:sw`.
  `doGlobalReloadNow` also best-effort clears Cache Storage as
  a backstop. Icons are regenerated by `npm run build:pwa-icons`
  ([scripts/build-pwa-icons.js](scripts/build-pwa-icons.js), Playwright-rendered — no new
  deps). Storage durability: `navigator.storage.persist()` is requested after auth so the
  offline corpus (IndexedDB PDF cache + takeoff backups) isn't evicted. Regression:
  [pwa.spec.js](pwa.spec.js) (manifest/meta/SW + the offline-render headline; local only,
  not CI). **iOS caveat:** an installed iOS app has a separate storage partition, so the
  user must sign in + open a takeoff once online before offline works.

### SEO (Tier 1)

- **Static head tags** in [index.html](index.html) (after `<title>`): meta description,
  `rel=canonical` (`https://counttooling.com/`), Open Graph + Twitter Card (`og:image` =
  `/og-image.png`, a 1200×630 branded card), and `WebApplication` JSON-LD with `sameAs` to
  the sister sites (pipetooling.com / takeofftooling.com). Absolute URLs (social scrapers
  require them).
- **Privacy noindex** — a tiny inline head script adds `<meta name="robots" content="noindex,
  nofollow">` when the URL has `?t=` (private view link — carries customer takeoffs) or
  `?devAuth=1` (localhost bypass). The clean `/` stays indexable (no static robots tag).
- **`robots.txt` + `sitemap.xml`** at repo root (sitemap lists just `/`, the one indexable
  URL). robots.txt deliberately does **not** `Disallow: ?t=` — crawlers must fetch those to
  see the noindex. The OG card is generated by `npm run build:pwa-icons`'s sibling
  `npm run build:og-image` ([scripts/build-og-image.js](scripts/build-og-image.js),
  Playwright-rendered, brand fonts base64-embedded). These are **crawler-only** assets — not
  in the `sw.js` precache, so no `CACHE_VERSION` bump. Regression: [seo.spec.js](seo.spec.js)
  (tags on `/`; noindex on `?t=`/`?devAuth=1`; local only). The app is admin-provisioned (no
  public signup), so this is brand/link-preview/privacy hygiene, not lead-gen SEO.

## Migrations naming

`supabase/migrations/` contains two naming schemes: legacy numbered
`NNN_name.sql` (001-041) and Supabase-CLI timestamped `YYYYMMDDHHMMSS_name.sql`.
Apply in version order (numbered first, then timestamped); see
[SUPABASE_SETUP.md](SUPABASE_SETUP.md) for per-migration notes. New migrations
should be applied via the Supabase MCP `apply_migration` tool.
